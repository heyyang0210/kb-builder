const WorkflowEngine = require('../lib/workflow-engine');

// Mock agents
jest.mock('../lib/agents/planner-agent', () => {
  return jest.fn().mockImplementation(() => ({
    name: 'planner',
    description: '规划',
    llmClient: {},
    execute: jest.fn().mockResolvedValue({
      knowledge_point: { name: 'test' },
      document_structure: { title: '测试文档', sections: [{ name: '概述' }] },
      retrieval_plan: { mcp_queries: [], reference_files: [] },
      validation_criteria: { required_sections: ['概述'], sql_verification: false },
      _meta: { duration: 100, tokens: { total_tokens: 100 } }
    }),
    setToolManager: jest.fn(),
    setOnDetail: jest.fn(),
  }));
});

jest.mock('../lib/agents/retriever-agent', () => {
  return jest.fn().mockImplementation(() => ({
    name: 'retriever',
    description: '检索',
    llmClient: {},
    execute: jest.fn().mockResolvedValue({
      references: '参考资料内容',
      _meta: { duration: 200, tokens: { total_tokens: 50 } }
    }),
    setToolManager: jest.fn(),
    setOnDetail: jest.fn(),
  }));
});

jest.mock('../lib/agents/generator-agent', () => {
  return jest.fn().mockImplementation(() => ({
    name: 'generator',
    description: '生成',
    llmClient: {},
    execute: jest.fn().mockResolvedValue({
      document: '---\ntitle: 测试\n---\n## 概述\n\n生成的文档内容',
      _meta: { duration: 300, tokens: { total_tokens: 200 } }
    }),
    setToolManager: jest.fn(),
    setOnDetail: jest.fn(),
  }));
});

jest.mock('../lib/agents/validator-agent', () => {
  return jest.fn().mockImplementation(() => ({
    name: 'validator',
    description: '验证',
    llmClient: {},
    execute: jest.fn().mockResolvedValue({
      passed: true,
      score: 95,
      checks: [],
      warnings: [],
      suggestions: [],
      final_document: '最终文档',
      _meta: { duration: 150, tokens: { total_tokens: 50 } }
    }),
    setToolManager: jest.fn(),
    setOnDetail: jest.fn(),
  }));
});

jest.mock('../lib/agents/comparator-agent', () => {
  return jest.fn().mockImplementation(() => ({
    name: 'comparator',
    description: '对比分析',
    llmClient: {},
    execute: jest.fn().mockResolvedValue({
      comparison: 'Oracle 与 YashanDB 对比分析',
      _meta: { duration: 150, tokens: { total_tokens: 150 } }
    }),
    setToolManager: jest.fn(),
    setOnDetail: jest.fn(),
  }));
});

describe('WorkflowEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new WorkflowEngine({ provider: 'openai', api_key: 'test' });
  });

  test('createWorkflow 返回 taskId', async () => {
    const taskId = await engine.createWorkflow({
      inputData: { knowledge_point: { name: 'test' } }
    });
    expect(taskId).toMatch(/^task_\d+_[a-z0-9]+$/);
  });

  test('getWorkflow 返回正确状态', async () => {
    const taskId = await engine.createWorkflow({
      inputData: { knowledge_point: { name: 'test' } }
    });
    const wf = engine.getWorkflow(taskId);
    expect(wf.status).toBe('created');
    expect(wf.progress).toBe(0);
    expect(wf.steps).toHaveLength(4);
    expect(wf.steps.map(s => s.name)).toEqual(['planner', 'retriever', 'generator', 'validator']);
  });

  test('getWorkflow 不存在返回 null', () => {
    expect(engine.getWorkflow('nonexistent')).toBeNull();
  });

  test('startWorkflow 执行完整流程', async () => {
    const taskId = await engine.createWorkflow({
      inputData: { knowledge_point: { name: 'test' } }
    });

    await engine.startWorkflow(taskId);

    const wf = engine.getWorkflow(taskId);
    expect(wf.status).toBe('completed');
    expect(wf.progress).toBe(100);
  });

  test('cancelWorkflow 不存在报错', () => {
    expect(() => engine.cancelWorkflow('nonexistent')).toThrow('not found');
  });

  test('progress 事件触发', async () => {
    const progressEvents = [];
    engine.on('progress', data => progressEvents.push(data));

    const taskId = await engine.createWorkflow({
      inputData: { knowledge_point: { name: 'test' } }
    });

    await engine.startWorkflow(taskId);

    expect(progressEvents.length).toBeGreaterThan(0);
    const lastEvent = progressEvents[progressEvents.length - 1];
    expect(lastEvent.status).toBe('completed');
    expect(lastEvent.progress).toBe(100);
  });

  test('_getOutputPreview 截断长文本', () => {
    const longDoc = 'a'.repeat(1000);
    const preview = engine._getOutputPreview({ document: longDoc });
    expect(preview.length).toBeLessThanOrEqual(503);
    expect(preview.endsWith('...')).toBe(true);
  });

  test('_getOutputPreview 短文本不截断', () => {
    const preview = engine._getOutputPreview({ document: 'short' });
    expect(preview).toBe('short');
  });

  test('fast 模式跳过验证', async () => {
    const taskId = await engine.createWorkflow({
      steps: [
        { name: 'planner', agent: 'planner', config: {} },
        { name: 'retriever', agent: 'retriever', config: {} },
        { name: 'generator', agent: 'generator', config: {} },
      ],
      inputData: { knowledge_point: { name: 'test' } }
    });

    await engine.startWorkflow(taskId);

    const wf = engine.getWorkflow(taskId);
    expect(wf.status).toBe('completed');
    expect(wf.progress).toBe(100);
  });
});

describe('WorkflowEngine - LangGraph 条件路由', () => {
  let engine;

  beforeEach(() => {
    engine = new WorkflowEngine({ provider: 'openai', api_key: 'test' });
  });

  test('兼容性类型自动路由到 comparator', async () => {
    const taskId = await engine.createWorkflow({
      inputData: { knowledge_point: { name: '直接路径插入', type: '兼容性差异' } }
    });

    await engine.startWorkflow(taskId);

    const wf = engine.getWorkflow(taskId);
    expect(wf.status).toBe('completed');
    // comparator step should have been executed
    const comparatorStep = wf.steps.find(s => s.agent === 'comparator');
    // In the default steps, there's no comparator step defined,
    // but the graph routes through it. The final state should have comparison data.
    const workflow = engine.workflows.get(taskId);
    expect(workflow.finalState.comparison).toBeTruthy();
  });

  test('非兼容性类型不经过 comparator', async () => {
    const taskId = await engine.createWorkflow({
      inputData: { knowledge_point: { name: '表空间管理', type: '通用基础' } }
    });

    await engine.startWorkflow(taskId);

    const workflow = engine.workflows.get(taskId);
    expect(workflow.finalState.comparison).toBeNull();
    expect(workflow.finalState.completedSteps).not.toContain('comparator');
  });
});
