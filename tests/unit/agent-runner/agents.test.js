const PlannerAgent = require('../../../packages/agent-runner-core/lib/agents/planner-agent');
const RetrieverAgent = require('../../../packages/agent-runner-core/lib/agents/retriever-agent');
const GeneratorAgent = require('../../../packages/agent-runner-core/lib/agents/generator-agent');
const ValidatorAgent = require('../../../packages/agent-runner-core/lib/agents/validator-agent');
const AgentManager = require('../../../packages/agent-runner-core/lib/agent-manager');

// Mock LLM responses
const mockPlanResponse = {
  content: JSON.stringify({
    knowledge_point: { id: '1.1.1', name: '测试', type: '通用基础' },
    document_structure: { title: '测试文档', sections: [{ name: '概述', required: true }] },
    retrieval_plan: { mcp_queries: ['测试'], reference_files: [] },
    validation_criteria: { required_sections: ['概述'], sql_verification: false }
  }),
  parsed: {
    knowledge_point: { id: '1.1.1', name: '测试', type: '通用基础' },
    document_structure: { title: '测试文档', sections: [{ name: '概述', required: true }] },
    retrieval_plan: { mcp_queries: ['测试'], reference_files: [] },
    validation_criteria: { required_sections: ['概述'], sql_verification: false }
  },
  usage: { total_tokens: 100 }
};

const mockDocResponse = {
  content: '---\ntitle: 测试文档\n---\n## 概述\n\n这是测试文档。',
  usage: { total_tokens: 200 }
};

const mockValidatorResponse = {
  content: JSON.stringify({
    passed: true,
    score: 95,
    checks: [{ name: '章节完整性', passed: true, details: 'OK' }],
    warnings: [],
    suggestions: [],
    final_document: '---\ntitle: 测试文档\n---\n## 概述\n\n这是测试文档。'
  }),
  parsed: {
    passed: true,
    score: 95,
    checks: [{ name: '章节完整性', passed: true, details: 'OK' }],
    warnings: [],
    suggestions: [],
    final_document: '---\ntitle: 测试文档\n---\n## 概述\n\n这是测试文档。'
  },
  usage: { total_tokens: 150 }
};

// Mock LLMClient
jest.mock('../../../packages/agent-runner-core/lib/llm-client', () => {
  return jest.fn().mockImplementation(() => ({
    chat: jest.fn().mockResolvedValue(mockDocResponse),
    chatJSON: jest.fn().mockResolvedValue(mockPlanResponse),
    updateConfig: jest.fn()
  }));
});

describe('PlannerAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new PlannerAgent({ provider: 'openai', api_key: 'test' });
  });

  test('名称和描述正确', () => {
    expect(agent.name).toBe('planner');
    expect(agent.description).toBe('规划执行计划');
  });

  test('输出格式为 JSON', () => {
    expect(agent.getOutputFormat()).toBe('json');
  });

  test('validateInput 验证 knowledgePoint', () => {
    expect(() => agent.validateInput({})).toThrow('knowledgePoint is required');
    expect(() => agent.validateInput({ knowledgePoint: {} })).toThrow('knowledgePoint.name is required');
    expect(() => agent.validateInput({ knowledgePoint: { name: 'test' } })).not.toThrow();
  });

  test('buildPrompt 生成正确的消息', () => {
    const messages = agent.buildPrompt({
      knowledgePoint: { name: 'B+树索引', type: '理论机制' }
    });
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('B+树索引');
  });

  test('parseResponse 解析执行计划', () => {
    const result = agent.parseResponse(mockPlanResponse, { knowledgePoint: { name: 'test' } });
    expect(result.knowledge_point).toBeDefined();
    expect(result.document_structure).toBeDefined();
    expect(result.retrieval_plan).toBeDefined();
    expect(result.validation_criteria).toBeDefined();
  });

  test('execute 完整执行流程', async () => {
    const result = await agent.execute({
      knowledgePoint: { name: '测试知识点', type: '通用基础' }
    });
    expect(result.knowledge_point).toBeDefined();
    expect(result._meta.agent).toBe('planner');
    expect(result._meta.duration).toBeGreaterThan(0);
  });
});

describe('RetrieverAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new RetrieverAgent({ provider: 'openai', api_key: 'test' });
  });

  test('名称正确', () => {
    expect(agent.name).toBe('retriever');
  });

  test('validateInput 验证 executionPlan', () => {
    expect(() => agent.validateInput({})).toThrow('executionPlan is required');
    expect(() => agent.validateInput({ executionPlan: {} })).not.toThrow();
  });

  test('parseResponse 返回 references', () => {
    const result = agent.parseResponse({ content: '参考资料内容', usage: {} });
    expect(result.references).toBe('参考资料内容');
  });

  test('setToolManager 注入工具管理器', () => {
    const mockTM = { getTool: jest.fn() };
    agent.setToolManager(mockTM);
    expect(agent.toolManager).toBe(mockTM);
  });
});

describe('GeneratorAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new GeneratorAgent({ provider: 'openai', api_key: 'test' });
  });

  test('名称正确', () => {
    expect(agent.name).toBe('generator');
  });

  test('默认 temperature 为 0.7', () => {
    expect(agent.config.temperature).toBe(0.7);
  });

  test('validateInput 验证 executionPlan', () => {
    expect(() => agent.validateInput({})).toThrow('executionPlan is required');
  });

  test('buildPrompt 包含执行计划和参考资料', () => {
    const messages = agent.buildPrompt({
      executionPlan: {
        knowledge_point: { name: '测试' },
        document_structure: { title: '测试文档', sections: [{ name: '概述' }] },
        validation_criteria: {}
      },
      references: '一些参考资料'
    });
    expect(messages[1].content).toContain('测试文档');
    expect(messages[1].content).toContain('一些参考资料');
  });

  test('parseResponse 返回 document', () => {
    const result = agent.parseResponse({ content: '生成的文档', usage: {} });
    expect(result.document).toBe('生成的文档');
  });
});

describe('ValidatorAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new ValidatorAgent({ provider: 'openai', api_key: 'test' });
  });

  test('名称正确', () => {
    expect(agent.name).toBe('validator');
  });

  test('输出格式为 JSON', () => {
    expect(agent.getOutputFormat()).toBe('json');
  });

  test('validateInput 验证 document', () => {
    expect(() => agent.validateInput({})).toThrow('document is required');
  });

  test('_generateBasicReport 生成基础验证报告', () => {
    const doc = '---\ntitle: Test\n---\n## 概述\n\n' + '这是一段足够长的测试文档内容，用于验证内容长度检查。'.repeat(50) + '\n\n```sql\nSELECT 1;\n```';
    const report = agent._generateBasicReport(doc);
    expect(report.passed).toBe(true);
    expect(report.score).toBeGreaterThan(0);
    expect(report.checks.length).toBeGreaterThan(0);
    expect(report.final_document).toBe(doc);
  });

  test('_generateBasicReport 缺少 YAML 报错', () => {
    const doc = '## 概述\n\n没有 YAML 头';
    const report = agent._generateBasicReport(doc);
    const yamlCheck = report.checks.find(c => c.name === 'YAML 元数据');
    expect(yamlCheck.passed).toBe(false);
  });
});

describe('AgentManager', () => {
  let manager;

  beforeEach(() => {
    manager = new AgentManager({ provider: 'openai', api_key: 'test' });
  });

  test('注册默认 5 个 Agent', () => {
    const agents = manager.listAgents();
    expect(agents).toContain('planner');
    expect(agents).toContain('retriever');
    expect(agents).toContain('generator');
    expect(agents).toContain('validator');
    expect(agents).toContain('comparator');
    expect(agents).toHaveLength(5);
  });

  test('getAgent 返回正确的 Agent', () => {
    const planner = manager.getAgent('planner');
    expect(planner.name).toBe('planner');
  });

  test('getAgent 不存在报错', () => {
    expect(() => manager.getAgent('nonexistent')).toThrow('Agent not found');
  });

  test('registerAgent 注册自定义 Agent', () => {
    const mockAgent = { name: 'custom', description: '自定义' };
    manager.registerAgent('custom', mockAgent);
    expect(manager.getAgent('custom')).toBe(mockAgent);
  });

  test('updateAllConfigs 更新所有 Agent 配置', () => {
    manager.updateAllConfigs({ provider: 'alibaba', api_key: 'new-key' });
    // 不报错即为成功
  });
});
