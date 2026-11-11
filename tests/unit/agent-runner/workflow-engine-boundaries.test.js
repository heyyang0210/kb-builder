jest.mock('../../../packages/agent-runner-core/lib/agent-manager', () => jest.fn());
jest.mock('../../../packages/agent-runner-core/lib/langgraph-workflow', () => ({ buildWorkflowGraph: jest.fn() }));
const WorkflowEngine = require('../../../packages/agent-runner-core/lib/workflow-engine');
const { buildWorkflowGraph } = require('../../../packages/agent-runner-core/lib/langgraph-workflow');

describe('工作流生命周期边界', () => {
  beforeEach(() => jest.clearAllMocks());

  test('空详情归一化与无步骤进度保持兼容', () => {
    const engine = new WorkflowEngine();
    expect(engine._normalizeDetail()).toMatchObject({ type: 'stage', name: '执行步骤', status: 'running', message: '', duration: 0, tokens: 0 });
    expect(engine._normalizeDetail({ message: '消息' })).toMatchObject({ name: '消息', message: '消息' });
    expect(engine._calculateProgress({ steps: [] })).toBe(0);
  });

  test('未知任务和并发拒绝保持计数', async () => {
    const engine = new WorkflowEngine({ maxConcurrent: 1 });
    await expect(engine.startWorkflow('missing')).rejects.toThrow('not found');
    expect(() => engine.forceContinue('missing')).toThrow('not found');
    const task = await engine.createWorkflow({ steps: [] });
    engine.runningCount = 1;
    await expect(engine.startWorkflow(task)).rejects.toThrow('Too many concurrent');
    expect(engine.getWorkflow(task).status).toBe('created');
    expect(engine.runningCount).toBe(1);
    engine.cancelWorkflow(task);
    expect(engine.getWorkflow(task).status).toBe('cancelled');
    expect(() => engine.forceContinue(task)).toThrow('no document');
  });

  test.each([false, true])('图异常返回失败事件并恢复运行计数，步骤已启动=%s', async started => {
    const engine = new WorkflowEngine();
    const task = await engine.createWorkflow({ steps: [{ name: 'generator' }] });
    const failures = [];
    engine.on('step_failed', event => failures.push(event));
    buildWorkflowGraph.mockImplementation((manager, tools, options) => ({ invoke: async () => {
      if (started) options.onStepStart('generator');
      throw new Error('graph unavailable');
    } }));
    await engine.startWorkflow(task);
    const result = engine.getWorkflow(task);
    expect(result.status).toBe('failed');
    expect(result.error).toBe('graph unavailable');
    expect(engine.runningCount).toBe(0);
    expect(failures).toEqual([{ taskId: task, step: started ? 'generator' : 'unknown', error: 'graph unavailable' }]);
    if (started) {
      expect(result.steps[0].status).toBe('failed');
      expect(result.steps[0].details.at(-1)).toMatchObject({ type: 'error', error: 'graph unavailable' });
    }
  });

  test('图回调详情与最终输出可经公开状态读取和强制继续', async () => {
    const engine = new WorkflowEngine({ retryCount: 7 });
    const tools = {};
    engine.setToolManager(tools);
    const steps = ['planner', 'planner_retriever', 'retriever', 'comparator', 'generator', 'validator', 'custom'].map(name => ({ name }));
    const task = await engine.createWorkflow({ steps, inputData: { knowledgePoint: { name: '兼容输入' } } });
    const details = [];
    engine.on('step_detail', event => details.push(event));
    buildWorkflowGraph.mockImplementation((manager, passedTools, options) => ({ invoke: async initial => {
      expect(passedTools).toBe(tools);
      expect(initial.knowledgePoint).toEqual({ name: '兼容输入' });
      expect(initial.maxRetries).toBe(7);
      options.onStepStart('missing');
      options.onStepDetail('missing');
      options.onStepEnd('missing');
      options.onStepStart('generator', { message: '开始生成' });
      options.onStepDetail('generator', { input: '输入', output: { error: 'diagnostic' }, tokens: 2 });
      options.onStepEnd('generator');
      options.onStepDetail('custom');
      options.onStepEnd('custom', { message: '扩展完成' });
      return { executionPlan: { plan: true }, references: 'r'.repeat(501), comparison: '比较', document: '文档', validationReport: { passed: true }, currentStep: 'validator', stepDetails: [{ step: 'planner', duration: 4 }, { step: 'planner', duration: 0 }] };
    } }));
    await engine.startWorkflow(task);
    let state = engine.getWorkflow(task);
    expect(state.status).toBe('completed');
    expect(state.steps.find(s => s.name === 'retriever').output_preview).toBe('r'.repeat(500) + '...');
    expect(state.steps.find(s => s.name === 'comparator').output_preview).toBe('比较');
    expect(state.steps.find(s => s.name === 'generator').output_preview).toBe('文档');
    expect(state.steps.find(s => s.name === 'planner').duration).toBe(4);
    expect(details.some(event => event.detail.error === 'diagnostic')).toBe(true);
    engine.cancelWorkflow(task);
    engine.forceContinue(task);
    state = engine.getWorkflow(task);
    expect(state.status).toBe('completed');
    expect(state.progress).toBe(100);
    expect(engine.runningCount).toBe(0);
  });

  test.each(['短文本', '文'.repeat(501), { references: '引用' }, { comparison: '比'.repeat(501) }])('公开输出预览保持长度边界：%j', async output => {
    const engine = new WorkflowEngine();
    const task = await engine.createWorkflow({ steps: [{ name: 'validator' }] });
    buildWorkflowGraph.mockImplementation((manager, tools, options) => ({ invoke: async () => {
      options.onStepStart('validator');
      options.onStepStart('validator');
      options.onStepDetail('validator', { name: '诊断', input_summary: '输入', output_summary: '输出', duration: 1, timestamp: 1 });
      return { validationReport: output };
    } }));
    await engine.startWorkflow(task);
    const text = typeof output === 'string' ? output : output.references || output.comparison;
    expect(engine.getWorkflow(task).steps[0].output_preview).toBe(text.slice(0, 500) + (text.length > 500 ? '...' : ''));
  });

  test.each([[{ strict_mode: true }, 5], [{ maxRetries: 2 }, 2]])('验证步骤重试配置生效：%j', async (config, expected) => {
    const engine = new WorkflowEngine();
    const task = await engine.createWorkflow({ steps: [{ name: 'validator', config }] });
    buildWorkflowGraph.mockImplementation((manager, tools, options) => ({ invoke: async initial => {
      expect(initial.maxRetries).toBe(expected);
      options.onStepEnd('validator');
      return { validationReport: { passed: true } };
    } }));
    await engine.startWorkflow(task);
    expect(engine.getWorkflow(task).steps[0]).toMatchObject({ status: 'completed', duration: 0 });
  });

  test.each([{}, { retryCount: 6 }])('空步骤与无最终详情仍正常完成：%j', async config => {
    const engine = new WorkflowEngine(config);
    const task = await engine.createWorkflow({ steps: [] });
    buildWorkflowGraph.mockReturnValue({ invoke: async initial => {
      expect(initial.knowledgePoint).toEqual({});
      expect(initial.skipValidation).toBe(true);
      return {};
    } });
    await engine.startWorkflow(task);
    expect(engine.getWorkflow(task)).toMatchObject({ status: 'completed', steps: [] });
  });
});
