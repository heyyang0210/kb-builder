const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { createMcpGovernance } = require('../../../packages/agent-runner-core/lib/platform-management/mcp-governance');
const { MCPClient } = require('../../../packages/agent-runner-core/lib/tools/mcp-client');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const repositoryRoot = path.resolve(__dirname, '../../..');
const registryPath = path.join(repositoryRoot, 'packages/agent-runner-core/lib/config-registry');
const managerPath = path.join(repositoryRoot, 'packages/agent-runner-core/lib/config-manager');
const actualRegistry = require(registryPath);
const loggerPath = path.join(repositoryRoot, 'packages/agent-runner-core/lib/logger');
const actualLogger = require(loggerPath);
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); });

function fixture() {
  const root = fs.mkdtempSync(path.join(repositoryRoot, 'runtime/mcp-governance-'));
  const file = path.join(root, 'service.json');
  fs.writeFileSync(file, JSON.stringify({ model: { untouched: true }, mcp: {} }));
  let manager;
  jest.isolateModules(() => {
    jest.doMock(loggerPath, () => actualLogger);
    jest.doMock(registryPath, () => ({ ...actualRegistry, CONFIG_PATHS: { ...actualRegistry.CONFIG_PATHS, service: file } }));
    manager = require(managerPath);
  });
  jest.dontMock(registryPath);
  jest.dontMock(loggerPath);
  return { file, manager, service: createMcpGovernance({ configManager: manager }), cleanup() { manager.watcher?.close(); fs.rmSync(root, { recursive: true, force: true }); } };
}
function input(url = 'http://127.0.0.1:12345/mcp') {
  return { server_url: url, timeout: 1000, api_key: 'fixture-api-secret', headers: [{ name: 'X-Test-Token', value: 'fixture-header-secret', description: '测试凭据' }], cache: { enabled: true, ttl: 0, max_size: 10 } };
}

let upstream, baseURL, methods, mode, observedKnowledgeBases;
beforeAll(async () => {
  upstream = http.createServer(async (req, res) => {
    let text = ''; for await (const chunk of req) text += chunk;
    const body = JSON.parse(text); methods.push(body.method);
    const knowledgeBaseId = req.headers['x-ksacraft-kb-id'];
    if (knowledgeBaseId) observedKnowledgeBases.push(knowledgeBaseId);
    if (mode === 'timeout') return;
    if (body.method === 'notifications/initialized') { res.writeHead(202); res.end(); return; }
    let result = body.method === 'initialize' ? { protocolVersion: '2024-11-05', serverInfo: { name: '隔离 MCP 服务', version: '1.0' }, capabilities: { tools: {} } } : { tools: [{ name: 'search_ku', description: '查询知识库' }, { name: 'get_ku_detail', description: '读取文档' }] };
    if (body.method === 'tools/call') result = ['search', 'fail24'].includes(mode) ? {
      structuredContent: { results: [{ ku_name: `doc-${knowledgeBaseId}`, title: `知识库${knowledgeBaseId}`, score: knowledgeBaseId === '1' ? 0.7 : 0.9 }, { ku_name: 'shared-doc', title: '共享文档', score: knowledgeBaseId === '1' ? 0.8 : 0.4 }], total: 2 },
      content: [{ type: 'text', text: '搜索结果' }]
    } : { content: [{ type: 'text', text: '# 配置复用验证\n来自同一 MCP 服务。' }] };
    const payload = mode === 'rpcError' || (mode === 'fail24' && body.method === 'tools/call' && knowledgeBaseId === '24') ? { error: { code: -32603, message: 'fixture-api-secret' } } : { result: mode === 'badTools' && body.method === 'tools/list' ? {} : result };
    res.writeHead(200, { 'Content-Type': mode === 'sse' ? 'text/event-stream' : 'application/json', 'Mcp-Session-Id': 'fixture-session' });
    const reply = JSON.stringify({ jsonrpc: '2.0', id: mode === 'badId' ? -1 : body.id, ...payload });
    res.end(mode === 'sse' ? `event: message\ndata: ${reply}\n\n` : reply);
  });
  await listen(upstream); baseURL = `http://127.0.0.1:${upstream.address().port}/mcp`;
});
afterAll(() => close(upstream));
beforeEach(() => { methods = []; observedKnowledgeBases = []; mode = 'json'; });

test('真实配置管理器加密保存、脱敏回读、留空保留、显式清除及跨进程读取', async () => {
  const f = fixture();
  try {
    let p = await f.service.save(input(), (await f.service.get()).rowVersion, 'mcp-admin');
    expect(p).toMatchObject({ api_key_configured: true, updatedBy: 'mcp-admin', headers: [{ value: '', valueConfigured: true }] });
    expect(JSON.stringify(p)).not.toContain('fixture-api-secret');
    expect(JSON.stringify(p)).not.toContain('fixture-header-secret');
    const stored = fs.readFileSync(f.file, 'utf8');
    expect(stored).not.toContain('fixture-api-secret'); expect(stored).not.toContain('fixture-header-secret');
    expect(JSON.parse(stored).model).toEqual({ untouched: true });
    const blank = { ...input(), api_key: '', headers: [{ name: 'x-test-token', value: '', description: '' }] };
    p = await f.service.save(blank, p.rowVersion, 'mcp-admin');
    expect((await f.manager.getMCPConfig()).api_key).toBe('fixture-api-secret');
    const script = `const r=require(${JSON.stringify(registryPath)});require.cache[require.resolve(${JSON.stringify(registryPath)})].exports={...r,CONFIG_PATHS:{...r.CONFIG_PATHS,service:process.env.MCP_TEST_FILE}};const m=require(${JSON.stringify(managerPath)});m.getMCPConfig().then(c=>{if(c.api_key!=='fixture-api-secret'||c.headers[0].value!=='fixture-header-secret')process.exitCode=1;m.watcher?.close()});`;
    execFileSync(process.execPath, ['-e', script], { env: { ...process.env, MCP_TEST_FILE: f.file }, stdio: 'pipe' });
    p = await f.service.save({ ...blank, clearApiKey: true, headers: [] }, p.rowVersion, 'mcp-admin');
    expect(p).toMatchObject({ api_key_configured: false, headers: [] });
  } finally { f.cleanup(); }
});

test('真实握手和工具发现不保存、不执行业务工具（JSON 与 SSE）', async () => {
  const f = fixture();
  try {
    const original = fs.readFileSync(f.file, 'utf8');
    for (const protocol of ['json', 'sse']) {
      mode = protocol;
      expect(await f.service.test(input(baseURL), (await f.service.get()).rowVersion)).toMatchObject({ status: 'verified', tools: [{ name: 'search_ku' }, { name: 'get_ku_detail' }] });
    }
    expect(methods).toEqual(['initialize', 'notifications/initialized', 'tools/list', 'initialize', 'notifications/initialized', 'tools/list']);
    expect(fs.readFileSync(f.file, 'utf8')).toBe(original);
  } finally { f.cleanup(); }
});

test.each(['rpcError', 'badId', 'badTools'])('错误协议 %s 不能误判成功且错误脱敏', async badMode => {
  const f = fixture();
  try {
    mode = badMode;
    await expect(f.service.test(input(baseURL), (await f.service.get()).rowVersion)).rejects.toMatchObject({ code: 'MCP_CONNECTION_FAILED', status: 502 });
  } finally { f.cleanup(); }
});

test('过期版本与并发保存不会覆盖当前配置', async () => {
  const f = fixture();
  try {
    const version = (await f.service.get()).rowVersion;
    const results = await Promise.allSettled([f.service.save(input(), version, 'one'), f.service.save(input(), version, 'two')]);
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'rejected']);
    expect(results[1].reason.code).toBe('MCP_CONFIG_CONFLICT');
    await expect(f.service.test(input(baseURL), version)).rejects.toMatchObject({ status: 409 });
  } finally { f.cleanup(); }
});

test('改变服务地址不能隐式转发已保存凭据', async () => {
  const f = fixture();
  try {
    const p = await f.service.save(input(), (await f.service.get()).rowVersion, 'admin');
    const changed = { ...input(baseURL), api_key: '', headers: [{ name: 'X-Test-Token', value: '', description: '' }] };
    await expect(f.service.test(changed, p.rowVersion)).rejects.toMatchObject({ code: 'MCP_CONFIG_INVALID' });
    await expect(f.service.test({ ...changed, clearApiKey: true }, p.rowVersion)).rejects.toMatchObject({ code: 'MCP_CONFIG_INVALID' });
    expect(methods).toEqual([]);
  } finally { f.cleanup(); }
});

test.each([
  { server_url: 'file:///tmp/foo' }, { server_url: 'https://user:password@example.com' },
  { timeout: 999 }, { api_key: 'bad\r\nvalue' },
  { headers: [{ name: 'Host', value: 'evil', description: '' }] },
  { headers: [{ name: 'X-a', value: 'a', description: '' }, { name: 'x-A', value: 'b', description: '' }] },
])('字段校验拒绝非法配置 %#', async patch => {
  const f = fixture();
  try { await expect(f.service.save({ ...input(), ...patch }, (await f.service.get()).rowVersion, 'admin')).rejects.toMatchObject({ code: 'MCP_CONFIG_INVALID' }); }
  finally { f.cleanup(); }
});

test('重复搜索路由标头作为知识库目标保存，普通重复标头仍拒绝', async () => {
  const f = fixture();
  try {
    const config = { ...input(), headers: [
      { name: 'X-Ksacraft-Kb-Id', value: '1', description: '' },
      { name: 'x-ksacraft-kb-id', value: '24', description: '' }
    ] };
    const saved = await f.service.save(config, (await f.service.get()).rowVersion, 'admin');
    const stored = await f.manager.getMCPConfig();
    expect(stored.search_knowledge_bases).toEqual(['1', '24']);
    expect(stored.search_knowledge_base_header).toBe('X-Ksacraft-Kb-Id');
    expect(saved.headers.filter(header => header.name.toLowerCase() === 'x-ksacraft-kb-id')).toEqual([
      expect.objectContaining({ value: '1', searchTargetIndex: 0 }),
      expect.objectContaining({ value: '24', searchTargetIndex: 1 }),
    ]);
    await expect(f.service.save({ ...config, headers: [
      { name: 'X-Test-Token', value: 'a', description: '' }, { name: 'x-test-token', value: 'b', description: '' }
    ] }, saved.rowVersion, 'admin')).rejects.toMatchObject({ code: 'MCP_CONFIG_INVALID' });
  } finally { f.cleanup(); }
});

test('脱敏目标行删除后按原目标序号保留值，未标记空行仍拒绝', async () => {
  const f = fixture();
  try {
    const original = { ...input(), headers: [
      { name: 'X-Ksacraft-Kb-Id', value: '1', description: '' },
      { name: 'X-Ksacraft-Kb-Id', value: '24', description: '' },
    ] };
    const saved = await f.service.save(original, (await f.service.get()).rowVersion, 'admin');
    expect(saved.headers.filter(header => header.name.toLowerCase() === 'x-ksacraft-kb-id')).toEqual([
      expect.objectContaining({ searchTargetIndex: 0, value: '1' }),
      expect.objectContaining({ searchTargetIndex: 1, value: '24' }),
    ]);

    const keptSecond = await f.service.save({ ...original, headers: [
      { name: 'X-Ksacraft-Kb-Id', value: '', description: '', searchTargetIndex: 1 },
    ] }, saved.rowVersion, 'admin');
    expect((await f.manager.getMCPConfig()).search_knowledge_bases).toEqual(['24']);
    await expect(f.service.save({ ...original, headers: [
      { name: 'X-Ksacraft-Kb-Id', value: '', description: '' },
    ] }, keptSecond.rowVersion, 'admin')).rejects.toMatchObject({ code: 'MCP_CONFIG_INVALID' });
  } finally { f.cleanup(); }
});

test('缓存 TTL 为 0 时不会命中', async () => {
  const client = new MCPClient({ server_url: baseURL, cache: { enabled: true, ttl: 0 } });
  client.cache.set('q', { value: 1 }); expect(client.cache.get('q')).toBeNull();
});

test('双知识库搜索分别路由并合并去重，缓存键包含目标列表', async () => {
  mode = 'search';
  const client = new MCPClient({ server_url: baseURL, headers: [
    { name: 'X-Ksacraft-Kb-Id', value: '1' }, { name: 'X-Ksacraft-Kb-Id', value: '24' }
  ], cache: { enabled: true, ttl: 3600 } });
  const result = await client.query('事务提交');
  expect([...new Set(observedKnowledgeBases)].sort()).toEqual(['1', '24']);
  expect(result.structuredContent.results.map(item => item.ku_name)).toEqual(['doc-24', 'shared-doc', 'doc-1']);
  expect(result.structuredContent.results[1].score).toBe(0.8);
  expect(result.structuredContent.kb_ids).toEqual(['1', '24']);
  methods = []; observedKnowledgeBases = [];
  await client.query('事务提交');
  expect(observedKnowledgeBases).toEqual([]);
  expect(methods).toEqual([]);
});

test('单个知识库查询失败时保留另一库结果并记录失败数量', async () => {
  mode = 'fail24';
  const client = new MCPClient({ server_url: baseURL, headers: [
    { name: 'X-Ksacraft-Kb-Id', value: '1' }, { name: 'X-Ksacraft-Kb-Id', value: '24' }
  ], cache: { enabled: false } });
  const result = await client.query('单库故障降级');
  expect(result.structuredContent.kb_ids).toEqual(['1']);
  expect(result.structuredContent.results.map(item => item.ku_name)).toEqual(['shared-doc', 'doc-1']);
  expect(result.structuredContent.search_warnings).toBe(1);
});

test('真实平台 HTTP API：权限、GET、未保存测试、PUT、冲突与方法限制', async () => {
  const f = fixture();
  const handler = createKnowledgeCenterHandler({
    config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: repositoryRoot, KNOWLEDGE_CENTER_ENTRY: 'index.html',
      OUTLINE_TEMPLATE_PATH: path.join(repositoryRoot, 'knowledge/outlines/大纲模板.xlsx'), OUTLINE_SAMPLE_PATH: path.join(repositoryRoot, 'knowledge/outlines/基本数据库管理手册大纲示例.xlsx'),
      PINGCODE_PREFIX: '/pingcode', PINGCODE_ROOT: repositoryRoot, DOCUMENT_API_HOST: '127.0.0.1', DOCUMENT_API_PORT: 1,
      PINGCODE_API_HOST: '127.0.0.1', PINGCODE_API_PORT: 1, PLATFORM_CONTEXT_TIMEOUT_MS: 1000,
      AUTH_API_HOST: '127.0.0.1', AUTH_API_PORT: 1, GITLAB_CONFIG_PATH: '/tmp/not-used', GITLAB_DOCUMENT_TYPES_PATH: '/tmp/not-used', DATABASE_CONNECTION_CONFIG_PATH: '/tmp/not-used' },
    stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [] }), write() {} } },
    moduleRegistry: { get: key => key === 'auth' ? { authorize: async req => req.headers['x-test-role'] === 'none' ? null : ({ roles: [req.headers['x-test-role'] || 'PLATFORM_ADMIN'], user: { id: 'mcp-admin' } }) } : null },
    mcpGovernance: f.service,
    handbookProductionService: {},
    sendFile(_path, res) { res.writeHead(404); res.end(); }, proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
  });
  const server = http.createServer(handler); await listen(server);
  const url = `http://127.0.0.1:${server.address().port}/knowledge-center/api/platform/mcp`;
  const call = (method, body, version, suffix = '') => fetch(url + suffix, { method, headers: { 'Content-Type': 'application/json', 'If-Match': version || '' }, body: body ? JSON.stringify(body) : undefined });
  const status = async response => { await response.arrayBuffer(); return response.status; };
  try {
    for (const method of ['GET', 'PUT', 'POST']) {
      const suffix = method === 'POST' ? '/test' : '';
      expect(await status(await fetch(url + suffix, { method, headers: { 'x-test-role': 'none' } }))).toBe(401);
      expect(await status(await fetch(url + suffix, { method, headers: { 'x-test-role': 'KNOWLEDGE_EDITOR' } }))).toBe(403);
    }
    const read = await fetch(url); expect(read.status).toBe(200); expect(read.headers.get('cache-control')).toBe('no-store');
    const p = (await read.json()).data;
    expect(await status(await call('POST', input(baseURL), p.rowVersion, '/test'))).toBe(200);
    expect((await f.service.get()).configured).toBe(false);
    const save = await call('PUT', input(baseURL), p.rowVersion); expect(save.status).toBe(200);
    const text = await save.text(); expect(text).not.toContain('fixture-api-secret'); expect(text).not.toContain('fixture-header-secret');
    expect(await status(await call('PUT', input(baseURL), p.rowVersion))).toBe(409);
    mode = 'search';
    const multiConfig = { ...input(baseURL), headers: [
      { name: 'X-Ksacraft-Kb-Id', value: '1', description: '' },
      { name: 'X-Ksacraft-Kb-Id', value: '24', description: '' }
    ] };
    const multiSave = await call('PUT', multiConfig, (await f.service.get()).rowVersion);
    expect(await status(multiSave)).toBe(200);
    const runtimeConfig = await f.manager.getMCPConfig();
    const merged = await new MCPClient(runtimeConfig).query('双知识库 API 验证');
    expect(merged.structuredContent.kb_ids).toEqual(['1', '24']);
    expect(merged.structuredContent.results).toHaveLength(3);
    expect(await status(await call('DELETE'))).toBe(405);
    mode = 'rpcError';
    const failure = await call('POST', input(baseURL), (await f.service.get()).rowVersion, '/test');
    expect(failure.status).toBe(502); expect(await failure.text()).not.toContain('fixture-api-secret');
  } finally { await close(server); f.cleanup(); }
});


test('真实请求超时返回可识别失败', async () => {
  const f = fixture();
  try {
    mode = 'timeout';
    await expect(f.service.test(input(baseURL), (await f.service.get()).rowVersion)).rejects.toMatchObject({ code: 'MCP_CONNECTION_FAILED', status: 502 });
  } finally { f.cleanup(); }
});

test('旧重复请求头不能留空时偷偷选取某一个值', async () => {
  const f = fixture();
  try {
    await f.manager.save('mcp-config', { ...input(), headers: [{ name: 'X-A', value: 'one', encrypted: true }, { name: 'X-A', value: 'two', encrypted: true }] });
    await expect(f.service.save({ ...input(), headers: [{ name: 'X-A', value: '', description: '' }] }, (await f.service.get()).rowVersion, 'admin')).rejects.toMatchObject({ code: 'MCP_CONFIG_INVALID' });
  } finally { f.cleanup(); }
});

test('历史同名请求头标记为需人工重填，移除重复项并重填后可保存', async () => {
  const f = fixture();
  try {
    await f.manager.save('mcp-config', { ...input(), headers: [
      { name: 'X-Docs-Token', value: 'official-docs-secret', encrypted: true },
      { name: 'x-docs-token', value: 'ops-docs-secret', encrypted: true },
    ] });
    const loaded = await f.service.get();
    expect(loaded.headers).toEqual([
      expect.objectContaining({ name: 'X-Docs-Token', value: '', valueConfigured: true, legacyDuplicate: true }),
      expect.objectContaining({ name: 'x-docs-token', value: '', valueConfigured: true, legacyDuplicate: true }),
    ]);
    expect(JSON.stringify(loaded)).not.toContain('official-docs-secret');
    expect(JSON.stringify(loaded)).not.toContain('ops-docs-secret');
    await expect(f.service.save({ ...input(), headers: [{ name: 'X-Docs-Token', value: '', description: '' }] }, loaded.rowVersion, 'admin'))
      .rejects.toMatchObject({ code: 'MCP_CONFIG_INVALID', message: '历史配置存在同名请求头，请移除重复项并重新填写保留项的值' });
    const saved = await f.service.save({ ...input(), headers: [{ name: 'X-Docs-Token', value: 'replacement-secret', description: '' }] }, loaded.rowVersion, 'admin');
    expect(saved.headers).toEqual([expect.objectContaining({ name: 'X-Docs-Token', valueConfigured: true, legacyDuplicate: false })]);
    expect((await f.manager.getMCPConfig()).headers).toEqual([expect.objectContaining({ name: 'X-Docs-Token', value: 'replacement-secret' })]);
  } finally { f.cleanup(); }
});

test('服务级配置支持独立保存、隔离过期编辑、删除及知识库读取路由', async () => {
  const f = fixture();
  try {
    async function create(name, locator) {
      const current = await f.service.get();
      return f.service.saveService({ service: { name, server_url: baseURL, api_key: '', enabled: true, adapter: 'yashandb', timeout: 1000, cache: { enabled: false, ttl: 0, max_size: 10 }, headers: [], knowledgeBases: [{ name: `${name} 库`, locator, enabled: true }] } }, current.rowVersion, 'admin');
    }
    const one = await create('服务 A', '1');
    const a = one.services.find(service => service.name === '服务 A');
    const two = await create('服务 B', '24');
    const b = two.services.find(service => service.name === '服务 B');
    expect(two.services).toHaveLength(2);
    // Management tests must work even for an existing disabled service, without
    // changing the configuration or requiring a known document name.
    const stored = await f.manager.getMCPConfig();
    stored.services[1].enabled = false;
    await f.manager.save('mcp-config', stored);
    const disabled = (await f.service.get()).services.find(s => s.id === b.id);
    expect(await f.service.testService({ serviceId: b.id }, disabled.rowVersion)).toMatchObject({ status: 'verified' });
    mode = 'search';
    expect(await f.service.verifyKnowledgeBase({ serviceId: b.id, knowledgeBaseId: b.knowledgeBases[0].id }, disabled.rowVersion)).toMatchObject({ status: 'verified', message: '测试成功' });
    expect(observedKnowledgeBases.at(-1)).toBe('24');
    mode = 'rpcError';
    await expect(f.service.verifyKnowledgeBase({ serviceId: b.id, knowledgeBaseId: b.knowledgeBases[0].id }, disabled.rowVersion)).rejects.toMatchObject({ code: 'MCP_READ_FAILED' });
    expect((await f.manager.getMCPConfig()).services[1].enabled).toBe(false);
    stored.services[1].enabled = true;
    await f.manager.save('mcp-config', stored);
    mode = 'json';
    const { createProductionAISources } = require('../../../packages/agent-runner-core/lib/production-ai-sources');
    const sourceState = {};
    const sources = createProductionAISources({
      store: { transaction: callback => callback(sourceState) }, context: () => ({ handbookId: 'fixture' }), contextKey: () => 'fixture', actor: () => ({ id: 'author' }), requireCapability() {}, ErrorType: Error,
      rules: () => ({ sources: { urlOrigins: [], maxLocatorChars: 1000, maxBytes: 10000 } }), now: Date.now,
      loadMCPConfig: () => f.service.currentForSources(),
    });
    const catalog = await sources.list({}, {});
    expect(catalog.mcpServices.map(service => service.name)).toEqual(['服务 A', '服务 B']);
    expect(catalog.mcpServices[1]).not.toHaveProperty('server_url');
    const snapshot = await sources.preview({ sourceType: 'knowledge-mcp', locator: 'SQL参考手册', mcpServiceId: b.id, mcpKnowledgeBaseId: b.knowledgeBases[0].id }, {});
    expect(snapshot).toMatchObject({ mcpServiceId: b.id, mcpKnowledgeBaseId: b.knowledgeBases[0].id, mcpServiceName: '服务 B' });
    expect(observedKnowledgeBases.at(-1)).toBe('24');
    await expect(sources.preview({ sourceType: 'knowledge-mcp', locator: 'SQL参考手册', mcpServiceId: a.id, mcpKnowledgeBaseId: b.knowledgeBases[0].id }, {})).rejects.toThrow();
    expect(await f.service.verifyKnowledgeBase({ serviceId: a.id, knowledgeBaseId: a.knowledgeBases[0].id, document: 'SQL参考手册' }, a.rowVersion)).toMatchObject({ status: 'verified' });
    expect(observedKnowledgeBases.at(-1)).toBe('1');
    const changed = await f.service.saveService({ service: { ...a, name: '服务 A 修改', api_key: '', clearApiKey: false } }, a.rowVersion, 'admin');
    expect(changed.services.map(service => service.name)).toEqual(['服务 A 修改', '服务 B']);
    await expect(f.service.saveService({ service: a }, a.rowVersion, 'admin')).rejects.toMatchObject({ code: 'MCP_CONFIG_CONFLICT', status: 409 });
    const deleted = await f.service.deleteService({ serviceId: b.id }, b.rowVersion);
    expect(deleted.services.map(service => service.id)).toEqual([a.id]);
  } finally { f.cleanup(); }
});

test('平台保存后原生成器客户端与 AI 来源读取同一配置', async () => {
  const f = fixture();
  try {
    await f.service.save(input(baseURL), (await f.service.get()).rowVersion, 'admin');
    const generatorClient = new MCPClient(await f.manager.getMCPConfig());
    expect(await generatorClient.getDocument('test-doc')).toMatchObject({ content: [{ type: 'text' }] });
    const { createProductionAISources } = require('../../../packages/agent-runner-core/lib/production-ai-sources');
    const state = {};
    const sources = createProductionAISources({
      store: { transaction: callback => callback(state) }, context: () => ({ handbookId: 'fixture' }), contextKey: () => 'fixture', actor: () => ({ id: 'author' }), requireCapability() {}, ErrorType: Error,
      rules: () => ({ sources: { maxLocatorChars: 1000, maxBytes: 10000 } }), now: Date.now,
      loadMCPConfig: () => f.manager.getMCPConfig(),
    });
    const snapshot = await sources.preview({ sourceType: 'knowledge-mcp', locator: 'test-doc' }, {});
    expect(snapshot.content).toContain('来自同一 MCP 服务');
    expect(methods.filter(method => method === 'tools/call')).toHaveLength(2);
  } finally { f.cleanup(); }
});
