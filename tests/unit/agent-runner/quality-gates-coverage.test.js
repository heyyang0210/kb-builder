const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

describe('生成质量门禁规则与结果', () => {
  let root;
  let originalProfile;
  let gates;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-gates-coverage-'));
    originalProfile = global.__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__;
    jest.resetModules();
    jest.doMock('../../../packages/agent-runner-core/lib/platform-profile/runtime-profile', () => ({
      getResource: (name, resource) => {
        expect([name, resource]).toEqual(['qualityRules', 'generation-quality']);
        return { path: global.__qualityRulesFixturePath };
      },
    }));
    gates = require('../../../packages/agent-runner-core/lib/quality-gates');
  });

  afterAll(() => {
    if (originalProfile === undefined) delete global.__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__;
    else global.__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__ = originalProfile;
    delete global.__qualityRulesFixturePath;
    jest.dontMock('../../../packages/agent-runner-core/lib/platform-profile/runtime-profile');
    jest.resetModules();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('加载运行时规则、兼容直通结构并在无效配置回退默认值', () => {
    const rulesFile = path.join(root, 'rules.json');
    global.__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__ = true;
    global.__qualityRulesFixturePath = rulesFile;
    fs.writeFileSync(rulesFile, JSON.stringify({ quality: { keyword_extraction: { min_base_queries: 3 } } }));
    expect(gates.loadQualityConfig()).toEqual({ keyword_extraction: { min_base_queries: 3 } });

    fs.writeFileSync(rulesFile, JSON.stringify({ custom: true }));
    expect(gates.loadQualityConfig()).toEqual({ custom: true });

    global.__qualityRulesFixturePath = path.join(root, 'missing.json');
    expect(gates.loadQualityConfig()).toBe(gates.DEFAULT_QUALITY_CONFIG);
    delete global.__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__;
    expect(gates.loadQualityConfig()).toBeTruthy();
  });

  test('关键词门禁报告数量与垃圾词问题并区分重试', () => {
    new gates.KeywordExtractionGate();
    const gate = gates.createQualityGate('keyword_extraction');
    const failed = gate.check({ base_queries: [], expanded_queries: Array(11).fill('A高B') });
    expect(failed).toMatchObject({ passed: false, retriable: true, degradable: true });
    expect(failed.issues).toHaveLength(3);
    expect(failed.issues[2]).toContain('垃圾词');
    expect(gate.check({ base_queries: ['数据库'], expanded_queries: ['集群'] })).toEqual({ passed: true, issues: [], retriable: false, degradable: true });
    expect(gate.check({}).issues).toEqual([expect.stringContaining('基础查询词数量不足')]);
    const strict = new gates.KeywordExtractionGate({ min_base_queries: 2, max_expanded_queries: 1, reject_patterns: [] });
    expect(strict.check({ base_queries: ['数据库'], expanded_queries: ['第一项', '第二项'] }).issues).toHaveLength(2);
  });

  test('MCP 门禁覆盖空结果、低成功率、内容不足和可接受结果', () => {
    new gates.McpQueryGate();
    const gate = gates.createQualityGate('mcp_query');
    expect(gate.check({ summary: { total: 0, success: 0, total_content_length: 0 } })).toMatchObject({ passed: false, retriable: true, issues: expect.arrayContaining([expect.stringContaining('成功率'), expect.stringContaining('总长度')]) });
    expect(gate.check({ summary: { total: 2, success: 1, total_content_length: 999 } }).passed).toBe(true);
    expect(gate.check({ summary: { total: 2, success: 2, total_content_length: 0 } })).toMatchObject({ passed: false, retriable: false, issues: [expect.stringContaining('总长度')] });
    expect(gate.check({})).toMatchObject({ passed: false, retriable: true });
    expect(new gates.McpQueryGate({ min_success_rate: 0, min_content_length: 0 }).check({ summary: { total: 0, success: 0, total_content_length: 0 } }).passed).toBe(true);
  });

  test('文档门禁覆盖最低长度、元数据、SQL、当前日期和可配置关闭项', () => {
    new gates.DocumentGenerationGate();
    const gate = gates.createQualityGate('document_generation');
    const failed = gate.check({ content: 'short' });
    expect(failed).toMatchObject({ passed: false, retriable: true, issues: expect.arrayContaining([expect.stringContaining('长度不足'), expect.stringContaining('YAML'), expect.stringContaining('SQL'), expect.stringContaining('当前日期')]) });
    const currentDate = new Date().toISOString().split('T')[0];
    const validContent = `日期 ${currentDate}\n\`\`\`yaml\nname: guide\n\`\`\`\n\`\`\`sql\nselect 1;\n\`\`\`` + 'x'.repeat(600);
    expect(gate.check({ content: validContent })).toMatchObject({ passed: true, retriable: false, issues: [] });
    const relaxed = gates.createQualityGate('document_generation', { min_length: 1, require_yaml: false, require_sql_examples: false, current_date_required: false });
    expect(relaxed.check({ content: 'brief' })).toMatchObject({ passed: true, retriable: true });
    expect(new gates.DocumentGenerationGate({ min_length: 0, require_yaml: false, require_sql_examples: false, current_date_required: true }).check({ content: '没有日期' }).issues).toEqual([expect.stringContaining('当前日期')]);
    expect(new gates.DocumentGenerationGate({ min_length: 0, require_yaml: false, require_sql_examples: false, current_date_required: false }).check({}).passed).toBe(true);
  });

  test('完整性门禁与门禁工厂拒绝未知类型', () => {
    new gates.CompletenessGate();
    const gate = gates.createQualityGate('content_validation');
    expect(gate.check({ completeness: { score: 0.2, missing_topics: ['权限', '备份'] } })).toMatchObject({ passed: false, retriable: false, issues: expect.arrayContaining([expect.stringContaining('评分过低'), expect.stringContaining('遗漏主题')]) });
    expect(gate.check({ completeness: { score: 1, missing_topics: [] } })).toMatchObject({ passed: true, issues: [] });
    expect(gate.check({}).issues).toEqual([expect.stringContaining('评分过低')]);
    expect(new gates.CompletenessGate({ min_completeness_score: 0 }).check({ completeness: { score: 0 } }).passed).toBe(true);
    expect(() => gates.createQualityGate('unknown')).toThrow('Unknown quality gate: unknown');
    expect(() => new gates.QualityGate('base').check({})).toThrow('check() must be implemented');
  });
});
