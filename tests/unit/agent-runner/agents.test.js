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

  test('parseResponse 解析执行计划', async () => {
    const result = await agent.parseResponse(mockPlanResponse, { knowledgePoint: { name: 'test' } });
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

  test('生产内容检查严格拒绝无效格式、重复检查项及错误位置，不能用基础报告通过', () => {
    const input = { document: '正文😀', qualityReview: {} };
    const checks = ['structure', 'template', 'expression', 'sources'].map(check => ({ check, status: 'passed', details: '已核对' }));
    const report = { checks, issues: [] };
    expect(agent.parseResponse({ parsed: report }, input)).toEqual(report);
    expect(() => agent.parseResponse({ content: 'not JSON' }, input)).toThrow(/格式无效/);
    expect(() => agent.parseResponse({ parsed: { ...report, checks: [checks[0], checks[0], ...checks.slice(2)] } }, input)).toThrow(/格式无效/);
    expect(() => agent.parseResponse({ parsed: { ...report, issues: [{ check: 'expression', severity: 'warning', start: 3, end: 4, message: '问题', requirement: '核对' }] } }, input)).toThrow(/格式无效/);
    expect(() => agent.parseResponse({ parsed: { ...report, issues: [{ check: 'expression', severity: 'blocking', start: 0, end: 1, message: '问题', requirement: '修订' }] } }, input)).toThrow(/格式无效/);
  });

  test('validateInput 验证 document', () => {
    expect(() => agent.validateInput({})).toThrow('document is required');
    expect(agent.validateInput({ document: '正文' })).toBe(true);
  });

  test('质量检查消息保留冻结提示词和上下文', () => {
    expect(agent.buildPrompt({ document: '正文', qualityReview: { prompt: '冻结规则', context: { template: '模板' } } })).toEqual([
      { role: 'system', content: '冻结规则' },
      { role: 'user', content: JSON.stringify({ document: '正文', template: '模板' }) }
    ]);
  });

  test('旧验证提示词覆盖默认和显式检查标准', () => {
    jest.spyOn(agent, 'loadPromptTemplate').mockReturnValue('');
    const defaults = agent.buildPrompt({ document: '正文' });
    expect(defaults[0].content).toContain(agent.getEnterpriseName());
    expect(defaults[1].content).toContain('请验证文档质量并生成验证报告 JSON。');
    expect(defaults[1].content).toContain('必须章节: 无特殊要求');
    expect(defaults[1].content).toContain('SQL 验证: 否');
    expect(defaults[1].content).toContain('最大长度: 不限');
    agent.loadPromptTemplate.mockReturnValue('配置化提示词');
    const explicit = agent.buildPrompt({ document: '正文', validationCriteria: { required_sections: ['概述', '示例'], sql_verification: true, min_length: 50, max_length: 1000 } });
    expect(explicit[1].content).toContain('配置化提示词');
    expect(explicit[1].content).toContain('必须章节: 概述, 示例');
    expect(explicit[1].content).toContain('SQL 验证: 是');
    expect(explicit[1].content).toContain('最小长度: 50 字');
    expect(explicit[1].content).toContain('最大长度: 1000 字');
  });

  test('旧报告接受预解析对象和 JSON 正文，并保留最终正文', () => {
    const input = { document: '原始正文' };
    expect(agent.parseResponse(mockValidatorResponse, input)).toMatchObject({ passed: true, score: 95, final_document: mockValidatorResponse.parsed.final_document });
    expect(agent.parseResponse({ content: JSON.stringify({ score: 0, passed: false, checks: [{ passed: false }], warnings: ['需修改'] }) }, input)).toMatchObject({ score: 0, passed: false, final_document: '原始正文' });
    expect(agent.parseResponse({ parsed: { score: 99, passed: true } }, input)).toEqual({ score: 99, passed: true, final_document: '原始正文' });
  });

  test.each([
    ['解析失败', { content: 'invalid JSON' }],
    ['非对象', { content: 'null' }],
    ['缺分数', { parsed: { passed: true } }],
    ['缺结论', { parsed: { score: 100 } }],
    ['空响应', {}],
  ])('旧报告%s时显式返回基础检查', (_, response) => {
    const document = '普通短文';
    const report = agent.parseResponse(response, { document });
    expect(report).toMatchObject({ passed: false, score: 0, final_document: document, suggestions: [] });
    expect(report.checks).toEqual([
      { name: 'YAML 元数据', passed: false, details: '缺少 YAML 元数据头' },
      { name: '标题结构', passed: false, details: '共 0 个标题' },
      { name: '代码示例', passed: false, details: '共 0 个 SQL 代码块' },
      { name: '内容长度', passed: false, details: '文档长度 4 字' },
    ]);
    expect(report.warnings).toHaveLength(4);
  });

  test('生产质量调用冻结 JSON 参数；旧入口沿用基类调用', async () => {
    const messages = [{ role: 'user', content: '正文' }];
    await agent.callLLM(messages, { productionQuality: true, timeoutMs: 1234, maxTokens: 800 });
    expect(agent.llmClient.chatJSON).toHaveBeenLastCalledWith(messages, { timeout_ms: 1234, max_tokens: 800, max_retries: 0, json_repair: false, temperature: 0.2 });
    await agent.callLLM(messages);
    expect(agent.llmClient.chatJSON).toHaveBeenCalledTimes(2);
  });

  const qualityReport = () => ({ checks: ['structure', 'template', 'expression', 'sources'].map(check => ({ check, status: 'passed', details: '已核对' })), issues: [] });
  const qualityIssue = () => ({ check: 'expression', severity: 'warning', start: 0, end: 1, message: '问题', requirement: '修订要求' });

  test.each([
    ['缺报告', () => null],
    ['缺检查列表', report => ({ ...report, checks: null })],
    ['缺检查项', report => ({ ...report, checks: report.checks.slice(1) })],
    ['缺问题列表', report => ({ ...report, issues: null })],
    ['空检查项', report => { report.checks[0] = null; return report; }],
    ['未知检查项', report => { report.checks[0].check = 'unknown'; return report; }],
    ['非法状态', report => { report.checks[0].status = 'pending'; return report; }],
    ['说明非文本', report => { report.checks[0].details = null; return report; }],
    ['说明空白', report => { report.checks[0].details = ' '; return report; }],
    ['失败项无问题', report => { report.checks[0].status = 'failed'; return report; }],
  ])('生产协议拒绝%s', (_, transform) => {
    expect(() => agent.parseResponse({ parsed: transform(qualityReport()) }, { document: 'A😀B', qualityReview: {} })).toThrow(/格式无效/);
  });

  test.each([
    ['未知类别', { check: 'unknown' }], ['非法级别', { severity: 'error' }],
    ['非整数起点', { start: 0.5 }], ['非整数终点', { end: 1.5 }],
    ['负起点', { start: -1 }], ['逆向范围', { start: 3, end: 1 }],
    ['超出正文', { end: 5 }], ['消息非文本', { message: null }], ['消息空白', { message: ' ' }],
    ['要求非文本', { requirement: null }], ['要求空白', { requirement: ' ' }],
    ['起点拆开代理对', { start: 2, end: 3 }], ['终点拆开代理对', { start: 0, end: 2 }],
  ])('生产问题拒绝%s', (_, patch) => {
    const report = qualityReport();
    report.issues = [{ ...qualityIssue(), ...patch }];
    expect(() => agent.parseResponse({ parsed: report }, { document: 'A😀B', qualityReview: {} })).toThrow(/格式无效/);
  });

  test('生产协议接受正文边界、空范围和失败项，并丢弃模型替换正文', () => {
    const report = qualityReport();
    report.checks[2].status = 'failed';
    report.checks[3].status = 'not_executed';
    report.issues = [{ ...qualityIssue(), severity: 'blocking', start: 0, end: 4 }, { ...qualityIssue(), start: 1, end: 3 }, { ...qualityIssue(), start: 4, end: 4 }];
    const parsed = agent.parseResponse({ content: JSON.stringify({ ...report, final_document: '模型替换', passed: true }) }, { document: 'A😀B', qualityReview: {} });
    expect(parsed).toEqual(report);
    expect(parsed).not.toHaveProperty('final_document');
    expect(parsed).not.toHaveProperty('passed');
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
