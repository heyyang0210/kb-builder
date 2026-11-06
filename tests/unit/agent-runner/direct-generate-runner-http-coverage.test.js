const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');

const saved = [];
const written = [];
const mockState = {
  queries: ['数据库部署'],
  reviewed: null,
  results: [{ success: true, data: { structuredContent: { total: 1, results: [{ title: '部署指南', excerpt: '安全部署', ku_name: '产品知识库', score: 0.9 }] } } }],
  extracted: null,
  assembled: '参考正文'.repeat(20),
  content: '```yaml\ntitle: 部署指南\n资料来源追溯:\n  待补充: true\n```\n---\n## 一、部署\n```sql\nselect 1;\n```\n检查清单',
  yamlFixed: true,
  modelConfig: { model: '隔离模型', provider: 'fixture', max_tokens: 4096 },
  mcpConfig: {},
  dimensionMap: {},
  responseModel: '隔离模型',
  usage: { total_tokens: 32 },
  brandName: '隔离企业',
  snapshot: {},
  resourceRoot: '',
  failAt: '',
  logFails: false,
};

jest.mock('../../../packages/agent-runner-core/lib/process-store', () => jest.fn().mockImplementation(() => ({
  saveMeta: jest.fn(async value => { if (mockState.failAt === 'meta') throw Error('元数据存储失败'); saved.push(['meta', value]); }),
  save: jest.fn(async (stage, file, value) => { if (mockState.failAt === file) throw Error('中间产物存储失败'); saved.push([stage, file, value]); }),
  saveMcpQuery: jest.fn(async (index, query, value) => { if (mockState.failAt === 'mcp-save') throw Error('MCP 结果存储失败'); saved.push(['mcp', index, query, value]); }),
  saveLlmCall: jest.fn(async (_stage, messages, response) => { saved.push(['llm', messages, response]); }),
})));
jest.mock('../../../packages/agent-runner-core/lib/config-manager', () => ({
  getModelConfig: jest.fn(async () => mockState.modelConfig),
  getMCPConfig: jest.fn(async () => mockState.mcpConfig),
}));
jest.mock('../../../packages/agent-runner-core/lib/tools/tool-manager', () => jest.fn().mockImplementation(() => ({
  getTool: jest.fn(name => name === 'mcp' ? { batchQuery: async () => mockState.results } : {
    write: async (file, content) => {
      if (mockState.failAt === 'write') throw Error('输出写入失败');
      written.push([file, content]);
      return { fullPath: `/runtime/isolated/${file}`, size: content.length };
    },
  }),
})));
jest.mock('../../../packages/agent-runner-core/lib/llm-client', () => jest.fn().mockImplementation(() => ({
  chat: jest.fn(async messages => {
    if (mockState.failAt === 'llm') throw Error('模型生成失败');
    saved.push(['messages', messages]);
    return { content: mockState.content, model: mockState.responseModel, usage: mockState.usage };
  }),
})));
jest.mock('../../../packages/agent-runner-core/lib/direct-generate/prompt-parser', () => ({
  extractDirectReferences: jest.fn(async () => mockState.extracted || ({ referenceFiles: ['knowledge/templates/old.md', 'knowledge/references/guide.md'] })),
  resolveOutputFilename: jest.fn(({ filename }) => filename || '隔离文档.md'),
  standardizePrompt: jest.fn(prompt => `标准化：${prompt}`),
}));
jest.mock('../../../packages/agent-runner-core/lib/retrieval/query-planner', () => ({
  generateQueries: jest.fn(() => ({ queries: mockState.queries, dimensions: ['部署', '运维'], dimensionMap: mockState.dimensionMap })),
  reviewQueries: jest.fn(queries => mockState.reviewed || ({ queries, dropped: [] })),
}));
jest.mock('../../../packages/agent-runner-core/lib/retrieval/result-filter', () => ({
  pipeline: jest.fn(() => ({ stats: { kept: 1 }, grouped: { 部署: ['参考'] } })),
}));
jest.mock('../../../packages/agent-runner-core/lib/retrieval/context-assembler', () => ({
  convertRetrievalResults: jest.fn(() => ({ designDocs: [], oracleKb: [] })),
  assemble: jest.fn(() => mockState.assembled),
}));
jest.mock('../../../packages/agent-runner-core/lib/retrieval-strategy', () => jest.fn().mockImplementation(() => ({
  executeAll: jest.fn(async () => {
    if (mockState.failAt === 'retrieval') throw Error('检索策略失败');
    return mockState.retrievalResults || { designDocs: [], oracleKb: [], testCases: [], sourceCode: [] };
  }),
  assessCoverage: jest.fn(() => mockState.assessment || ({ score: 1 })),
  integrateResults: jest.fn(() => mockState.integrated ?? '本地参考资料'),
})));
jest.mock('../../../packages/agent-runner-core/lib/document/yaml-metadata-processor', () => jest.fn().mockImplementation(() => ({
  process: jest.fn(content => ({ content, fixed: mockState.yamlFixed, metadata: { title: '部署指南' } })),
})));
jest.mock('../../../packages/agent-runner-core/lib/direct-generate/execution-log', () => ({
  writeDirectExecutionLog: jest.fn(async () => {
    if (mockState.logFails) throw Error('日志写入失败');
    return { fullPath: '/runtime/isolated/log.md', size: 50 };
  }),
}));
jest.mock('../../../packages/agent-runner-core/lib/platform-profile/runtime-profile', () => ({
  getBrand: () => ({ enterpriseName: mockState.brandName }),
  getTrace: () => ({ profile: 'isolated' }),
  getResourceByReference: reference => ({ path: require('node:path').join(mockState.resourceRoot || '/runtime/isolated', reference.replace(/^knowledge\//, '')) }),
}));
jest.mock('../../../packages/agent-runner-core/lib/template-generation', () => ({
  frozenTemplateContent: input => input?.templateContent ?? null,
  templateMetadata: () => ({}),
  freezeTemplateForRequest: async () => mockState.snapshot,
  persistTemplateSnapshot: async () => {},
}));

const { getDirectTask } = require('../../../packages/agent-runner-core/lib/direct-generate/task-store');
const { createDirectTask } = require('../../../packages/agent-runner-core/lib/direct-generate/task-store');
const { executeDirectGenerate } = require('../../../packages/agent-runner-core/lib/direct-generate/direct-task-runner');
const router = require('../../../packages/agent-runner-core/routes/agent');

let server;
let base;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api/agent', router);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/agent`;
});
afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
  await fs.rm(path.join(__dirname, '../../../runtime/test-results/direct-runner-http-coverage'), { recursive: true, force: true });
});
beforeEach(() => {
  saved.length = 0; written.length = 0;
  Object.assign(mockState, { queries: ['数据库部署'], reviewed: null, results: [{ success: true, data: { structuredContent: { total: 1, results: [{ title: '部署指南', excerpt: '安全部署', ku_name: '产品知识库', score: 0.9 }] } } }], extracted: null, assembled: '参考正文'.repeat(25), content: '```yaml\ntitle: 部署指南\n资料来源追溯:\n  待补充: true\n```\n---\n## 一、部署\n```sql\nselect 1;\n```\n检查清单', yamlFixed: true, modelConfig: { model: '隔离模型', provider: 'fixture', max_tokens: 4096 }, mcpConfig: {}, dimensionMap: {}, responseModel: '隔离模型', usage: { total_tokens: 32 }, brandName: '隔离企业', snapshot: {}, resourceRoot: '', failAt: '', logFails: false, retrievalResults: null, assessment: null, integrated: undefined });
});

async function execute(body = {}) {
  const response = await fetch(`${base}/execute`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'direct_generate', prompt: '写部署文档', knowledge_point: { name: '1.1 数据库部署', description: '数据库部署操作' }, output_path: '/runtime/isolated', filename: '部署.md', ...body }) });
  expect(response.status).toBe(200);
  const started = await response.json();
  expect(started.success).toBe(true);
  for (let i = 0; i < 40; i++) {
    const status = await fetch(`${base}/status/${started.task_id}`).then(r => r.json());
    if (status.status !== 'running') return status;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw Error('隔离直写任务未收敛');
}

test('真实 HTTP 直写成功：MCP 结果、来源追溯、格式检查及输出回读', async () => {
  const status = await execute({ debug: true });
  expect(status).toMatchObject({ status: 'completed', progress: 100, current_step: 'write' });
  expect(status.steps.map(step => step.status)).toEqual(['completed', 'completed', 'completed', 'completed']);
  expect(saved.some(entry => entry[1] === '09-filter-stats.json')).toBe(true);
  expect(saved.some(entry => entry[1] === '04-format-check.json' && entry[2].hasSqlExamples)).toBe(true);
  expect(written[0][0]).toContain('部署.md');
  expect(written[0][1]).toContain('资料来源追溯:');
  expect(written[0][1]).not.toContain('待补充: true');
  expect(getDirectTask(status.task_id).document).toBe(written[0][1]);
  expect(saved.find(entry => entry[0] === 'messages')[1][0].content).toContain('隔离企业');
});

test('真实 HTTP 直写：空 MCP、上下文回退和非致命日志故障', async () => {
  mockState.queries = []; mockState.results = []; mockState.assembled = ''; mockState.logFails = true;
  mockState.content = '# 简短正文';
  const status = await execute({ debug: false, knowledge_point: { name: '运维' } });
  expect(status.status).toBe('completed');
  expect(status.steps.find(step => step.name === 'write').details).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'failed', message: expect.stringContaining('日志写入失败') })]));
  expect(saved.find(entry => entry[1] === '01-context-prompt.md')[2]).toBe('本地参考资料');
  expect(written[0][1]).toBe('# 简短正文');
});

test.each([
  ['meta', 'prepare', '元数据存储失败'],
  ['mcp-save', 'retrieve', 'MCP 结果存储失败'],
  ['retrieval', 'retrieve', '检索策略失败'],
  ['llm', 'generate', '模型生成失败'],
  ['03-generated-document.md', 'generate', '中间产物存储失败'],
  ['write', 'write', '输出写入失败'],
])('真实 HTTP 直写失败阶段 %s', async (failAt, step, message) => {
  mockState.failAt = failAt;
  const status = await execute();
  expect(status).toMatchObject({ status: 'failed', current_step: step, error: message });
  expect(status.steps.find(item => item.name === step)).toMatchObject({ status: 'failed', error: message });
});

test('MCP 内容解析分支：JSON 文本结果上限、失败项、无内容及损坏 JSON 兜底', async () => {
  mockState.queries = Array.from({ length: 10 }, (_, i) => `查询${i + 1}`);
  mockState.results = [
    { success: true, data: { content: [{ type: 'text', text: JSON.stringify({ total: 10, results: Array.from({ length: 10 }, (_, i) => ({ title: i ? '' : '结果', excerpt: i ? '' : '摘要', ku_name: i ? '' : '知识库', score: i ? 0 : 0.8 })) }) }] } },
    { success: true, data: { content: [{ type: 'image', text: '忽略' }] } },
    { success: true, data: { content: [{ type: 'text', text: '{broken' }] } },
    { success: false, error: '' },
  ];
  const status = await execute({ debug: true, max_tokens: 0, temperature: 0 });
  expect(status.status).toBe('completed');
  expect(status.steps[1].details.filter(detail => detail.name.startsWith('MCP 查询:')).map(detail => detail.status)).toEqual(['success', 'success', 'success', 'failed']);
  expect(saved.some(entry => entry[0] === 'mcp' && entry[1] === 1)).toBe(true);
  expect(saved.find(entry => entry[0] === 'messages')[1][1].content).toContain('共 10 条结果，展示前 8 条');
  expect(saved.find(entry => entry[0] === 'messages')[1][1].content).toContain('查询失败: 未知错误');
  const llm = require('../../../packages/agent-runner-core/lib/llm-client');
  expect(llm.mock.results.at(-1).value.chat).toHaveBeenCalledWith(expect.any(Array), { max_tokens: 4096, temperature: 0 });
});

test('来源追溯保留成功查询标题与知识库名称', async () => {
  mockState.reviewed = { queries: [
    { success: true, query: '首个查询', ku_name: '知识库甲' },
    { success: true, query: '', ku_name: '' },
    { success: true },
    { success: true, query: '第四条' },
  ], dropped: ['短词'] };
  mockState.results = mockState.reviewed.queries.map(() => ({ success: false }));
  mockState.extracted = { referenceFiles: [] };
  const status = await execute();
  expect(status.status).toBe('completed');
  expect(written[0][1]).toContain('首个查询" (ku_name: 知识库甲)');
  expect(written[0][1]).toContain('"N/A" (ku_name: N/A)');
  expect(written[0][1]).not.toContain('第四条');
});

test('无提示词与空知识点：配置缺省、空上下文、默认生成参数和输出目录', async () => {
  mockState.queries = []; mockState.results = []; mockState.dimensionMap = null;
  mockState.modelConfig = null; mockState.mcpConfig = null; mockState.responseModel = '';
  mockState.usage = undefined; mockState.brandName = ''; mockState.assembled = '';
  mockState.integrated = ''; mockState.content = '# 最小正文'; mockState.yamlFixed = false;
  const status = await execute({ prompt: '', knowledge_point: {}, output_path: null, filename: null, max_tokens: 0, temperature: undefined });
  expect(status.status).toBe('completed');
  expect(written[0][0]).toContain('../output/');
  const llm = require('../../../packages/agent-runner-core/lib/llm-client');
  expect(llm.mock.results.at(-1).value.chat).toHaveBeenCalledWith(expect.any(Array), { max_tokens: 60000, temperature: 0.3 });
  const task = getDirectTask(status.task_id);
  expect(task.steps.find(step => step.name === 'generate').details[0]).toMatchObject({ tokens: 0 });
  expect(task.steps.find(step => step.name === 'generate').details[0]).not.toHaveProperty('model');
  expect(saved.find(entry => entry[0] === 'messages')[1][0].content).toContain('YashanDB');
  expect(saved.find(entry => entry[0] === 'messages')[1][1].content).toContain('无额外参考资料');
});

test('MCP 结构化结果字段缺失及非数组内容使用轻量回退', async () => {
  mockState.dimensionMap = null;
  mockState.queries = ['A', 'B', 'C'];
  mockState.results = [
    { success: true, data: { structuredContent: { total: 0, results: null } } },
    { success: true, data: { content: 'raw string payload', extra: 'kept' } },
    { success: true },
  ];
  mockState.content = '不含来源追溯的普通文档';
  mockState.extracted = { referenceFiles: ['refs/guide.md'] };
  const status = await execute({ temperature: 0.6 });
  expect(status.status).toBe('completed');
  const userPrompt = saved.find(entry => entry[0] === 'messages')[1][1].content;
  expect(userPrompt).toContain('共 0 条结果：');
  expect(userPrompt).toContain('"extra": "kept"');
  expect(userPrompt).not.toContain('raw string payload');
  expect(userPrompt).toContain('参考资料');
});

test('内部任务边界：空知识点继续执行，未知阶段失败不伪造步骤', async () => {
  const task = createDirectTask({});
  const result = await executeDirectGenerate({ body: { mode: 'direct_generate', prompt: '', knowledge_point: null } }, task);
  expect(result.status).toBe('completed');
  expect(saved.find(entry => entry[0] === 'messages')[1][1].content).toContain('知识点信息');

  mockState.failAt = 'meta';
  const invalidTask = { task_id: 'isolated-invalid-step', current_step: 'missing', steps: [], inputData: {} };
  const failed = await executeDirectGenerate({ body: { prompt: '', knowledge_point: {} } }, invalidTask);
  expect(failed).toMatchObject({ status: 'failed', error: '元数据存储失败', steps: [] });
});

test('真实 HTTP 固定模板过滤旧路径，模板与技能文件成功读取', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path');
  const root = path.join(__dirname, '../../../runtime/test-results/direct-runner-http-coverage');
  await fs.mkdir(path.join(root, 'templates'), { recursive: true });
  await fs.mkdir(path.join(root, 'skills'), { recursive: true });
  await fs.writeFile(path.join(root, 'templates', 'legacy.md'), '不应覆盖固定模板');
  await fs.writeFile(path.join(root, 'skills', 'writer.md'), '隔离技能规则');
  mockState.resourceRoot = root;
  mockState.snapshot = { templateId: 'template.test', templateVersion: 3, templateSource: 'database', templateContent: '固定模板正文' };
  mockState.extracted = { referenceFiles: ['knowledge/templates/legacy.md', 'knowledge/references/guide.md'] };
  const status = await execute({ template: 'knowledge/templates/current.md', skill: 'knowledge/skills/writer.md', debug: true });
  expect(status.status).toBe('completed');
  expect(saved.find(entry => entry[1] === '03-keyword-extraction.json')[2].reference_files).toEqual(['knowledge/references/guide.md']);
  const userPrompt = saved.find(entry => entry[0] === 'messages')[1][1].content;
  expect(userPrompt).toContain('隔离技能规则');
  expect(userPrompt).toContain('固定模板正文');
  expect(userPrompt).not.toContain('不应覆盖固定模板');
  expect(saved.some(entry => entry[1] === '00-skill-content.md')).toBe(true);
});

test('模板和技能读取失败可降级，空知识点不生成关键词', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const root = path.join(__dirname, '../../../runtime/test-results/direct-runner-http-coverage');
  mockState.resourceRoot = root;
  mockState.extracted = { referenceFiles: [] };
  const missing = await execute({ template: 'templates/missing.md', skill: 'skills/missing.md', knowledge_point: {} });
  expect(missing.status).toBe('completed');
  const prompt = saved.find(entry => entry[0] === 'messages')[1][1].content;
  expect(prompt).toContain('模板未读取到');
  expect(prompt).toContain('Skill 文件未读取到');
  expect(require('../../../packages/agent-runner-core/lib/direct-generate/prompt-parser').extractDirectReferences).toHaveBeenCalled();
  await fs.rm(root, { recursive: true, force: true });
});

test.each([
  [0, 0, 'B', '30/60'],
  [3, 1, 'B', '40/60'],
  [4, 1, 'B+', '50/60'],
  [9, 0, 'A', '60/60'],
  [9, 1, 'A', '60/60'],
])('资料追溯评分覆盖引用比例 %i/%i', async (queryCount, referenceCount, grade, score) => {
  mockState.queries = Array.from({ length: queryCount }, (_, i) => `主题${i + 1}`);
  mockState.results = mockState.queries.map(() => ({ success: false, error: '无结果' }));
  mockState.extracted = { referenceFiles: Array.from({ length: referenceCount }, (_, i) => `refs/${i}.md`) };
  mockState.content = '资料来源追溯:\n旧内容\n## 一、正文';
  mockState.yamlFixed = false;
  await execute();
  const trace = written[0][1];
  expect(trace).toContain(`可信度等级：${grade} 级`);
  expect(trace).toContain(`引用覆盖率得分：${score}`);
});
