const { buildWorkflowGraph, routeByType, routeAfterValidation, WorkflowState } = require('../../../packages/agent-runner-core/lib/langgraph-workflow');
const AgentManager = require('../../../packages/agent-runner-core/lib/agent-manager');

// Mock all agents
jest.mock('../../../packages/agent-runner-core/lib/agents/planner-agent');
jest.mock('../../../packages/agent-runner-core/lib/agents/retriever-agent');
jest.mock('../../../packages/agent-runner-core/lib/agents/generator-agent');
jest.mock('../../../packages/agent-runner-core/lib/agents/validator-agent');
jest.mock('../../../packages/agent-runner-core/lib/agents/comparator-agent');

function createMockAgentManager(overrides = {}) {
  const agentManager = new AgentManager({});

  const defaultPlan = {
    knowledge_point: { name: 'test' },
    document_structure: { title: '测试', sections: [{ name: '概述' }] },
    retrieval_plan: {},
    validation_criteria: {},
    _meta: { duration: 10, tokens: { total_tokens: 50 } },
  };

  agentManager.getAgent('planner').execute = overrides.plannerExecute || jest.fn().mockResolvedValue(defaultPlan);
  agentManager.getAgent('retriever').execute = overrides.retrieverExecute || jest.fn().mockResolvedValue({ references: '参考资料', _meta: { duration: 5, tokens: { total_tokens: 20 } } });
  agentManager.getAgent('generator').execute = overrides.generatorExecute || jest.fn().mockResolvedValue({ document: '## 概述\n\n文档内容', _meta: { duration: 20, tokens: { total_tokens: 100 } } });
  agentManager.getAgent('validator').execute = overrides.validatorExecute || jest.fn().mockResolvedValue({ passed: true, score: 95, checks: [], warnings: [], suggestions: [], final_document: 'doc', _meta: { duration: 5, tokens: { total_tokens: 30 } } });
  agentManager.getAgent('comparator').execute = overrides.comparatorExecute || jest.fn().mockResolvedValue({ comparison: '对比分析', _meta: { duration: 15, tokens: { total_tokens: 80 } } });

  return agentManager;
}

function createInitialState(overrides = {}) {
  return {
    knowledgePoint: { name: '测试', type: '通用基础' },
    template: null,
    prompt: null,
    inputData: {},
    executionPlan: null,
    references: null,
    comparison: null,
    document: null,
    validationReport: null,
    feedback: null,
    retryCount: 0,
    maxRetries: 3,
    skipValidation: false,
    strictMode: false,
    currentStep: null,
    completedSteps: [],
    stepDetails: [],
    ...overrides,
  };
}

describe('routeByType', () => {
  test('兼容性差异类型路由到 comparator', () => {
    const state = { knowledgePoint: { type: '兼容性差异' } };
    expect(routeByType(state)).toBe('comparator');
  });

  test('包含兼容性的类型路由到 comparator', () => {
    const state = { knowledgePoint: { type: 'DML兼容性' } };
    expect(routeByType(state)).toBe('comparator');
  });

  test('通用基础类型路由到 retriever', () => {
    const state = { knowledgePoint: { type: '通用基础' } };
    expect(routeByType(state)).toBe('retriever');
  });

  test('无类型默认路由到 retriever', () => {
    const state = { knowledgePoint: {} };
    expect(routeByType(state)).toBe('retriever');
  });
});

describe('routeAfterValidation', () => {
  test('验证通过路由到 END', () => {
    const state = { validationReport: { passed: true, score: 95 }, retryCount: 0, maxRetries: 3 };
    expect(routeAfterValidation(state)).toBe('__end__');
  });

  test('验证失败且未超重试上限路由到 retry_generator', () => {
    const state = { validationReport: { passed: false, score: 60, warnings: ['问题'], suggestions: ['建议'] }, retryCount: 1, maxRetries: 3 };
    expect(routeAfterValidation(state)).toBe('retry_generator');
  });

  test('验证失败且已达重试上限路由到 END', () => {
    const state = { validationReport: { passed: false, score: 50 }, retryCount: 3, maxRetries: 3 };
    expect(routeAfterValidation(state)).toBe('__end__');
  });

  test('无验证报告路由到 END', () => {
    const state = { validationReport: null, retryCount: 0, maxRetries: 3 };
    expect(routeAfterValidation(state)).toBe('__end__');
  });
});

describe('LangGraph 完整流程', () => {
  test('标准流程: planner → retriever → generator → validator', async () => {
    const agentManager = createMockAgentManager();
    const graph = buildWorkflowGraph(agentManager, null, { skipValidation: false, maxRetries: 3 });
    const result = await graph.invoke(createInitialState());

    expect(result.completedSteps).toEqual(['planner', 'retriever', 'generator', 'validator']);
    expect(result.retryCount).toBe(0);
    expect(result.document).toBeTruthy();
    expect(result.executionPlan).toBeTruthy();
    expect(result.references).toBeTruthy();
  });

  test('兼容性类型: planner → comparator → retriever → generator → validator', async () => {
    const agentManager = createMockAgentManager();
    const graph = buildWorkflowGraph(agentManager, null, { skipValidation: false, maxRetries: 3 });
    const result = await graph.invoke(createInitialState({
      knowledgePoint: { name: '直接路径插入', type: '兼容性差异' },
    }));

    expect(result.completedSteps).toContain('comparator');
    expect(result.comparison).toBeTruthy();
    expect(result.completedSteps.indexOf('comparator')).toBeLessThan(result.completedSteps.indexOf('retriever'));
  });

  test('验证重试: generator → validator → retry → generator → validator', async () => {
    let validatorCallCount = 0;
    const agentManager = createMockAgentManager({
      validatorExecute: jest.fn().mockImplementation(async (input) => {
        validatorCallCount++;
        if (validatorCallCount === 1) {
          return { passed: false, score: 60, checks: [], warnings: ['缺少SQL示例'], suggestions: ['请添加SQL代码'], final_document: input.document, _meta: { duration: 5, tokens: { total_tokens: 30 } } };
        }
        return { passed: true, score: 92, checks: [], warnings: [], suggestions: [], final_document: input.document, _meta: { duration: 5, tokens: { total_tokens: 30 } } };
      }),
    });

    const graph = buildWorkflowGraph(agentManager, null, { skipValidation: false, maxRetries: 3 });
    const result = await graph.invoke(createInitialState());

    expect(result.retryCount).toBe(1);
    // feedback is cleared by generator after use, check stepDetails instead
    const retryDetail = result.stepDetails.find(d => d.step === 'retry_generator');
    expect(retryDetail.feedback).toContain('缺少SQL示例');
    expect(result.completedSteps).toEqual(['planner', 'retriever', 'generator', 'validator', 'retry_generator', 'generator', 'validator']);
  });

  test('达到最大重试次数后停止', async () => {
    const agentManager = createMockAgentManager({
      validatorExecute: jest.fn().mockResolvedValue({
        passed: false, score: 40, checks: [], warnings: ['严重问题'], suggestions: ['需要重写'],
        final_document: 'doc', _meta: { duration: 5, tokens: { total_tokens: 30 } }
      }),
    });

    const graph = buildWorkflowGraph(agentManager, null, { skipValidation: false, maxRetries: 2 });
    const result = await graph.invoke(createInitialState({ maxRetries: 2 }));

    expect(result.retryCount).toBe(2);
    // generator called 3 times: initial + 2 retries
    expect(agentManager.getAgent('generator').execute).toHaveBeenCalledTimes(3);
  });

  test('fast 模式跳过验证', async () => {
    const agentManager = createMockAgentManager();
    const graph = buildWorkflowGraph(agentManager, null, { skipValidation: true, maxRetries: 0 });
    const result = await graph.invoke(createInitialState({ skipValidation: true }));

    expect(result.completedSteps).toEqual(['planner', 'retriever', 'generator']);
    expect(result.validationReport).toBeNull();
    expect(agentManager.getAgent('validator').execute).not.toHaveBeenCalled();
  });

  test('generator 接收 feedback 用于改进', async () => {
    let validatorCallCount = 0;
    const generatorMock = jest.fn().mockImplementation(async (input) => {
      return {
        document: '文档内容' + (input.feedback ? ' [已修正]' : ''),
        _meta: { duration: 20, tokens: { total_tokens: 100 } }
      };
    });

    const agentManager = createMockAgentManager({
      generatorExecute: generatorMock,
      validatorExecute: jest.fn().mockImplementation(async () => {
        validatorCallCount++;
        if (validatorCallCount === 1) {
          return { passed: false, score: 50, checks: [], warnings: ['格式错误'], suggestions: ['修正格式'], final_document: 'doc', _meta: { duration: 5, tokens: { total_tokens: 30 } } };
        }
        return { passed: true, score: 90, checks: [], warnings: [], suggestions: [], final_document: 'doc', _meta: { duration: 5, tokens: { total_tokens: 30 } } };
      }),
    });

    const graph = buildWorkflowGraph(agentManager, null, { skipValidation: false, maxRetries: 3 });
    const result = await graph.invoke(createInitialState());

    // Second generator call should have received feedback
    const secondCall = generatorMock.mock.calls[1][0];
    expect(secondCall.feedback).toContain('格式错误');
    expect(result.document).toContain('[已修正]');
  });
});
