const { buildWorkflowGraph, routeByType, routeAfterValidation } = require('../../../packages/agent-runner-core/lib/langgraph-workflow');

// Keep the real graph engine; replace only external agent execution.
function harness(outputs = {}, details = true) {
  const agents = {};
  for (const name of ['planner', 'retriever', 'comparator', 'generator', 'validator']) {
    let onDetail;
    agents[name] = {
      execute: jest.fn(async input => {
        onDetail?.({ name: `${name}事件`, type: 'tool', payload: name });
        const output = outputs[name] ?? (name === 'validator' ? { passed: true } : {});
        return typeof output === 'function' ? output(input) : output;
      }),
      setToolManager: jest.fn(),
    };
    if (details) agents[name].setOnDetail = jest.fn(callback => { onDetail = callback; });
  }
  return { agents, manager: { getAgent: name => agents[name] } };
}
function telemetry(extra = {}) {
  return { onStepStart: jest.fn(), onStepEnd: jest.fn(), onStepDetail: jest.fn(), ...extra };
}

describe('真实LangGraph边界契约', () => {
  test.each([false, true])('合并规划检索传递查询与快照，skipValidation=%s', async skipValidation => {
    const queries = [{ query: 'YashanDB备份' }];
    const plan = { document_structure: { sections: ['备份'] }, retrieval_plan: { mcp_queries: queries }, _meta: { tokens: { total_tokens: 12 }, duration: 7 } };
    const { agents, manager } = harness({ planner: plan, generator: { document: '备份正文' }, validator: { passed: true, score: 99 } });
    const options = telemetry({ steps: [{ name: 'planner_retriever' }], skipValidation });
    const snapshot = { sections: ['备份'] };
    const result = await buildWorkflowGraph(manager, null, options).invoke({ inputData: snapshot, template: '模板', prompt: '请编写', knowledgePoint: { type: '兼容性差异' } });
    expect(agents.planner.execute).toHaveBeenCalledWith({ templateSnapshot: snapshot, template: '模板', prompt: '请编写', knowledgePoint: { type: '兼容性差异' } }, { mode: 'merged' });
    expect(agents.generator.execute.mock.calls[0][0]).toMatchObject({ templateSnapshot: snapshot, executionPlan: plan, references: queries });
    expect(agents.retriever.execute).not.toHaveBeenCalled();
    expect(agents.comparator.execute).not.toHaveBeenCalled();
    const steps = ['planner_retriever', 'generator', ...skipValidation ? [] : ['validator']];
    expect(result.completedSteps).toEqual(steps);
    expect(options.onStepStart.mock.calls.map(c => c[0])).toEqual(steps);
    expect(options.onStepDetail.mock.calls.map(c => c[0])).toEqual(steps);
    expect(result.stepDetails.filter(d => d.type === 'tool').map(d => d.step)).toEqual(steps);
    expect(options.onStepEnd).toHaveBeenCalledWith('planner_retriever', { message: '规划完成，MCP 查询 1 条', tokens: 12, duration: 7 });
  });

  test.each([{}, { retrieval_plan: {} }, { document_structure: {}, _meta: {} }])('合并模式稀疏输出引用默认为空：%j', async planner => {
    const { manager } = harness({ planner }, false);
    const result = await buildWorkflowGraph(manager, null, { steps: [{ name: 'planner_retriever' }], skipValidation: true }).invoke({});
    expect(result.references).toEqual([]);
    expect(result.retryCount).toBe(0);
    expect(result.stepDetails[0]).toMatchObject({ step: 'planner_retriever', duration: 0, tokens: 0 });
  });

  test('兼容性全流程保留历史、详情、工具调用及阶段输入', async () => {
    const plan = { validation_criteria: { sql: true } };
    const toolCalls = [{ name: 'search' }];
    const { agents, manager } = harness({ planner: plan, comparator: { comparison: '差异' }, retriever: { references: '参考', _meta: { tool_calls: toolCalls } }, generator: { document: '最终正文' } });
    const options = telemetry();
    const toolManager = { search: jest.fn() };
    const result = await buildWorkflowGraph(manager, toolManager, options).invoke({ knowledgePoint: { type: 'SQL兼容性' }, completedSteps: ['导入'], stepDetails: [{ name: '已有详情' }], references: '先前引用', feedback: '初始反馈', inputData: { title: '模板快照' } });
    const steps = ['planner', 'comparator', 'retriever', 'generator', 'validator'];
    expect(result.completedSteps).toEqual(['导入', ...steps]);
    expect(result.stepDetails[0]).toEqual({ name: '已有详情' });
    expect(options.onStepDetail.mock.calls.map(c => c[0])).toEqual(steps);
    expect(result.stepDetails.filter(d => d.type === 'tool').map(d => d.step)).toEqual(steps);
    expect(agents.retriever.setToolManager).toHaveBeenCalledWith(toolManager);
    expect(agents.comparator.execute).toHaveBeenCalledWith({ executionPlan: plan, references: '先前引用' }, {});
    expect(agents.generator.execute.mock.calls[0][0]).toMatchObject({ references: '参考', comparison: '差异', feedback: '初始反馈', templateSnapshot: { title: '模板快照' } });
    expect(agents.validator.execute).toHaveBeenCalledWith({ document: '最终正文', validationCriteria: { sql: true } }, {});
    expect(result.feedback).toBeNull();
    expect(result.stepDetails.find(d => d.step === 'retriever' && d.type === 'stage').toolCalls).toEqual(toolCalls);
    expect(options.onStepEnd).toHaveBeenCalledWith('validator', expect.objectContaining({ message: '校验完成，评分 N/A，结果 通过', duration: 0, tokens: 0 }));
  });

  test('所有阶段接受无正文、无元数据的输出并报告零长度', async () => {
    const { manager } = harness({}, false);
    const options = telemetry();
    const result = await buildWorkflowGraph(manager, null, options).invoke({ knowledgePoint: { type: '兼容性差异' } });
    expect(result.completedSteps).toEqual(['planner', 'comparator', 'retriever', 'generator', 'validator']);
    for (const detail of result.stepDetails) expect(detail).toMatchObject({ duration: 0, tokens: 0 });
    expect(result.stepDetails.find(d => d.step === 'retriever').toolCalls).toEqual([]);
    expect(options.onStepDetail).not.toHaveBeenCalled();
    expect(options.onStepEnd).toHaveBeenCalledWith('generator', expect.objectContaining({ message: '文档生成完成，长度 0 字符' }));
  });

  test.each([{ passed: false, score: 0 }, { passed: false, warnings: ['缺示例'] }, { passed: false, suggestions: ['补SQL'] }])('失败校验反馈可省略一侧：%j', async report => {
    let attempts = 0;
    const { agents, manager } = harness({ validator: () => ++attempts === 1 ? report : { passed: true }, generator: { document: '正文' } });
    const options = telemetry();
    const result = await buildWorkflowGraph(manager, null, options).invoke({});
    const feedback = [...report.warnings || [], ...report.suggestions || []].join('\n');
    expect(result.retryCount).toBe(1);
    expect(agents.generator.execute.mock.calls[1][0].feedback).toBe(feedback);
    expect(result.stepDetails.find(d => d.step === 'retry_generator')).toMatchObject({ feedback, retryCount: 1, status: 'preparing' });
    expect(result.stepDetails.filter(d => d.step === 'generator' && d.type === 'stage').map(d => d.isRetry)).toEqual([false, true]);
    expect(options.onStepEnd).toHaveBeenCalledWith('validator', expect.objectContaining({ message: '校验完成，评分 N/A，结果 未通过' }));
  });

  test('外部Agent失败向调用方传播且停止下游', async () => {
    const error = new Error('检索服务暂不可用');
    const { agents, manager } = harness({ retriever: () => { throw error; } });
    const options = telemetry();
    await expect(buildWorkflowGraph(manager, null, options).invoke({})).rejects.toThrow(error.message);
    expect(agents.generator.execute).not.toHaveBeenCalled();
    expect(options.onStepEnd.mock.calls.map(c => c[0])).toEqual(['planner']);
  });

  test('缺知识点默认标准路由；未配置重试上限时使用三次上限', () => {
    expect(routeByType({})).toBe('retriever');
    expect(routeAfterValidation({ validationReport: { passed: false }, retryCount: 2 })).toBe('retry_generator');
    expect(routeAfterValidation({ validationReport: { passed: false }, retryCount: 3 })).toBe('__end__');
  });
});
