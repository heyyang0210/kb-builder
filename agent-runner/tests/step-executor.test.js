const StepExecutor = require('../lib/step-executor');

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

  test('transformInput - planner 步骤', () => {
    const inputData = {
      knowledge_point: { name: '测试', type: '通用基础' },
      template: 'templates/test.md'
    };

    const result = executor.transformInput({ agent: 'planner' }, null, inputData);
    expect(result.knowledgePoint).toEqual({ name: '测试', type: '通用基础' });
    expect(result.template).toBe('templates/test.md');
  });

  test('transformInput - planner 兼容 knowledgePoint 字段', () => {
    const inputData = {
      knowledgePoint: { name: '测试' }
    };

    const result = executor.transformInput({ agent: 'planner' }, null, inputData);
    expect(result.knowledgePoint.name).toBe('测试');
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
});
