const StepExecutor = require('../../../packages/agent-runner-core/lib/step-executor');

// Mock AgentManager
const mockAgent = {
  execute: jest.fn().mockResolvedValue({ result: 'mock output', _meta: { duration: 100 } }),
  setToolManager: jest.fn()
};

const mockAgentManager = {
  getAgent: jest.fn().mockReturnValue(mockAgent)
};

describe('StepExecutor', () => {
  let executor;

  beforeEach(() => {
    executor = new StepExecutor(mockAgentManager);
    mockAgent.execute.mockClear();
    mockAgent.setToolManager.mockClear();
  });

  test('execute 调用正确的 agent', async () => {
    const step = { name: 'test', agent: 'planner', config: {} };
    const input = { knowledgePoint: { name: 'test' } };

    const result = await executor.execute(step, input);
    expect(mockAgentManager.getAgent).toHaveBeenCalledWith('planner');
    expect(mockAgent.execute).toHaveBeenCalledWith(input, {});
    expect(result.result).toBe('mock output');
  });

  test('execute 注入 toolManager', async () => {
    const mockTM = { getTool: jest.fn() };
    const executorWithTM = new StepExecutor(mockAgentManager, mockTM);

    await executorWithTM.execute({ name: 'test', agent: 'planner' }, {});
    expect(mockAgent.setToolManager).toHaveBeenCalledWith(mockTM);
  });

  test('execute 兼容仅使用 name 的旧步骤', async () => {
    await executor.execute({ name: 'planner' }, {});
    expect(mockAgentManager.getAgent).toHaveBeenCalledWith('planner');
  });

  test('transformInput - planner 步骤', () => {
    const inputData = {
      knowledge_point: { name: '测试', type: '通用基础' },
      template: 'knowledge/templates/test.md'
    };

    const result = executor.transformInput({ agent: 'planner' }, null, inputData);
    expect(result.knowledgePoint).toEqual({ name: '测试', type: '通用基础' });
    expect(result.template).toBe('knowledge/templates/test.md');
  });

  test('transformInput - planner 兼容 knowledgePoint 字段', () => {
    const inputData = {
      knowledgePoint: { name: '测试' }
    };

    const result = executor.transformInput({ agent: 'planner' }, null, inputData);
    expect(result.knowledgePoint.name).toBe('测试');
  });

  test('transformInput 兼容旧步骤和旧步骤列表字段', () => {
    const prevOutput = { references: '参考资料' };
    const workflowInput = { steps: [{ name: 'planner', output: '执行计划' }] };
    const result = executor.transformInput({ name: 'generator' }, prevOutput, workflowInput);
    expect(result.executionPlan).toBe('执行计划');
    expect(result.references).toBe('参考资料');
  });

  test('transformInput - retriever 步骤', () => {
    const prevOutput = { knowledge_point: { name: 'test' }, document_structure: {} };
    const result = executor.transformInput({ agent: 'retriever' }, prevOutput, {});
    expect(result.executionPlan).toBe(prevOutput);
  });

  test('transformInput - generator 步骤', () => {
    const prevOutput = { references: '参考资料', executionPlan: { name: 'test' } };
    const result = executor.transformInput({ agent: 'generator' }, prevOutput, {});
    expect(result.references).toBe('参考资料');
    expect(result.executionPlan).toBeDefined();
  });

  test('transformInput - validator 步骤', () => {
    const prevOutput = { document: '生成的文档' };
    const result = executor.transformInput({ agent: 'validator' }, prevOutput, {});
    expect(result.document).toBe('生成的文档');
  });

  test('transformInput - 未知 agent 直接返回', () => {
    const prevOutput = { data: 'test' };
    const result = executor.transformInput({ agent: 'unknown' }, prevOutput, {});
    expect(result).toBe(prevOutput);
  });

  test('不存在的Agent明确失败，注册后可使用旧方法名恢复执行', async () => {
    const manager = { getAgent: jest.fn().mockReturnValue(null) };
    const local = new StepExecutor(manager);
    await expect(local.execute({ name: 'missing' }, {})).rejects.toThrow('Agent not found: missing');
    const execute = jest.fn().mockResolvedValue({ document: '恢复正文' });
    manager.getAgent.mockReturnValue({ execute });
    await expect(local.executeStep({ name: 'missing' }, { retry: true })).resolves.toEqual({ document: '恢复正文' });
    expect(execute).toHaveBeenCalledWith({ retry: true }, {});
  });

  test('详情回调传给Agent，执行错误原样传播且允许后续重试', async () => {
    const failure = new Error('执行失败');
    const agent = { setOnDetail: jest.fn(), execute: jest.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce('完成') };
    const local = new StepExecutor({ getAgent: () => agent });
    const detail = jest.fn();
    const config = { option: 1 };
    await expect(local.execute({ name: 'writer', config }, { value: 1 }, detail)).rejects.toBe(failure);
    expect(agent.setOnDetail).toHaveBeenCalledWith(detail);
    expect(agent.execute).toHaveBeenCalledWith({ value: 1 }, config);
    await expect(local.executeStep({ name: 'writer' }, {}, detail)).resolves.toBe('完成');
  });

  test('缺步骤标识保持前序对象，生成和校验兼容非包装的前序值', () => {
    const previous = { content: '正文' };
    expect(executor.transformInput({}, previous, {})).toBe(previous);
    const generated = executor.transformInput({ name: 'generator' }, previous, { steps: [] });
    expect(generated.references).toBe(previous);
    expect(generated.executionPlan).toBe(previous);
    expect(executor.transformInput({ name: 'validator' }, null, {})).toMatchObject({ document: null, executionPlan: undefined });
    expect(executor.transformInput({ name: 'validator' }, '纯正文', { steps: [{ agent: 'planner', output: '计划' }] }))
      .toMatchObject({ document: '纯正文', executionPlan: '计划' });
  });
});
