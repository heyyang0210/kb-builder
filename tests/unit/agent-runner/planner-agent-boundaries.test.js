const PlannerAgent = require('../../../packages/agent-runner-core/lib/agents/planner-agent');
const { hash } = require('../../../packages/agent-runner-core/lib/template-store');

const createAgent = config => new PlannerAgent({ provider: 'openai', api_key: 'test', ...config });
const snapshot = content => ({ templateId: 'fixed', templateVersion: 2,
  templateSource: 'database', templateContent: content, templateHash: hash(content) });

test('合并提示词含知识点全部上下文、文件模板与用户参考', () => {
  const agent = createAgent();
  const messages = agent.buildPrompt({ knowledgePoint: {
    id: 'kp-1', name: '连接认证', type: '运维SOP', description: '认证流程',
    part: '管理', chapter: '连接', target_db: 'PostgreSQL', level: '★★★'
  }, template: 'knowledge/templates/operations.md', prompt: '请核对权限和异常恢复。' }, { mode: 'merged' });
  expect(messages.map(message => message.role)).toEqual(['system', 'user']);
  for (const value of ['kp-1', '连接认证', '认证流程', '管理', 'PostgreSQL', '★★★',
    'knowledge/templates/operations.md', '请核对权限和异常恢复。', 'document_structure', 'retrieval_plan']) {
    expect(messages[1].content).toContain(value);
  }
  expect(messages[0].content).toContain('同时生成文档结构和检索计划');
});

test.each([undefined, { mode: 'merged' }])('未提供注册提示词时仍输出对应模式的JSON要求 %#', step => {
  const agent = createAgent();
  jest.spyOn(agent, 'loadPromptTemplate').mockReturnValue('');
  const messages = agent.buildPrompt({ knowledgePoint: { name: '连接' } }, step);
  expect(messages[1].content).toContain(step ? '请根据知识点信息同时生成文档结构和检索计划 JSON。' : '请根据知识点信息生成执行计划 JSON。');
});

test('固定数据库模板覆盖文件模板，检索计划剔除模板文件但保留其他来源', async () => {
  const agent = createAgent({ mode: 'merged' });
  const input = { knowledgePoint: { name: '连接' }, template: 'templates/live.md',
    templateSnapshot: snapshot('# 固定版本正文') };
  const prompt = agent.buildPrompt(input, { mode: 'merged' });
  expect(prompt[1].content).toContain('# 固定版本正文');
  expect(prompt[1].content).not.toContain('templates/live.md');
  const result = await agent.parseResponse({ parsed: {
    document_structure: { title: '连接', sections: [{ name: '已有章节' }] },
    retrieval_plan: { mcp_queries: ['连接规则'], reference_files: [
      'templates/live.md', 'knowledge/templates/old.md', 'references/design-docs/connect.md'
    ] }
  } }, input);
  expect(result.document_structure.sections).toEqual([{ name: '已有章节' }]);
  expect(result.retrieval_plan).toEqual({ mcp_queries: ['连接规则'], reference_files: ['references/design-docs/connect.md'] });
});

test.each([
  { content: '不是合法JSON' },
  { content: '{}', parsed: '非结构化内容' },
  { parsed: { document_structure: { sections: 'invalid' }, retrieval_plan: { mcp_queries: null, reference_files: {} } } },
])('模型错误响应回退到可执行的兼容性规划 %#', async response => {
  const agent = createAgent({ mode: 'merged' });
  const result = await agent.parseResponse(structuredClone(response), {
    knowledge_point: { id: 'compat', name: '数值类型', type: '兼容性差异' }
  });
  expect(result.knowledge_point).toEqual({ id: 'compat', name: '数值类型', type: '兼容性差异' });
  expect(result.document_structure.sections.map(section => section.name)).toEqual([
    '概述与兼容性等级', '类型映射对比', '语法与行为差异', '迁移建议与验证'
  ]);
  expect(result.document_structure.sections.every(section => section.required)).toBe(true);
  expect(result.retrieval_plan.mcp_queries.length).toBeGreaterThan(0);
  expect(result.retrieval_plan.mcp_queries.every(query => query.includes('数值类型'))).toBe(true);
  expect(result.retrieval_plan.reference_files).toEqual([]);
  expect(result.validation_criteria).toEqual({ required_sections: [], sql_verification: false });
});

test('缺少知识点上下文时仍保留模型有效字段并产生明确默认章节', async () => {
  const agent = createAgent();
  const criteria = { required_sections: ['审核'], sql_verification: true };
  const result = await agent.parseResponse({ parsed: {
    knowledge_point: { name: '已有知识点' }, validation_criteria: criteria
  } }, {});
  expect(result.knowledge_point).toEqual({ name: '已有知识点' });
  expect(result.document_structure.title).toBe('未命名文档');
  expect(result.document_structure.sections[0]).toEqual({ name: '概述', description: '知识点 - 概述', required: true });
  expect(result.validation_criteria).toBe(criteria);
});

test('固定模板哈希失配明确拒绝，不混入当前文件模板', async () => {
  const agent = createAgent();
  const input = { knowledgePoint: { name: '连接' }, templateSnapshot: { ...snapshot('正文'), templateHash: 'bad' } };
  expect(() => agent.buildPrompt(input)).toThrow('任务模板快照不完整或哈希不匹配');
  await expect(agent.parseResponse({ parsed: {} }, input)).rejects.toMatchObject({ code: 'TEMPLATE_SNAPSHOT_INVALID', status: 409 });
});

test('旧知识点别名校验和去重兼容入口保留行为', () => {
  const agent = createAgent();
  expect(agent.validateInput({ knowledge_point: { name: '连接' } })).toBe(true);
  expect(() => agent.validateInput({ knowledgePoint: 0, knowledge_point: {} })).toThrow('knowledgePoint.name is required');
  expect(agent._unique([' 连接 ', '连接', '', '权限'])).toEqual(['连接', '权限']);
});
