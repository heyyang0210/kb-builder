const http = require('node:http');
let mockRules = { platformMcp: { multiSearchHeaderName: 'X-Fixture-Kb' } };
jest.mock('../../../packages/agent-runner-core/lib/json-config', () => ({
  ...jest.requireActual('../../../packages/agent-runner-core/lib/json-config'),
  readJson: () => { if (mockRules instanceof Error) throw mockRules; return mockRules; },
}));
const { MCPClient, MCPCache } = require('../../../packages/agent-runner-core/lib/tools/mcp-client');
let server;
let base;
let mode;
let calls;
let outputs;
let failedTargets;
function client(extra = {}) {
  return new MCPClient({ server_url: base, timeout: 1000, search_knowledge_base_header: 'X-Fixture-Kb', ...extra });
}
function multi(extra = {}) {
  return client({ search_knowledge_bases: ['one', 'two'], ...extra });
}
beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    let raw = ''; for await (const part of req) raw += part;
    const body = JSON.parse(raw); calls.push({ body, headers: req.headers });
    if (mode === 'http-error' || failedTargets.has(req.headers['x-fixture-kb'])) return res.writeHead(503).end('隔离服务不可用');
    if (body.method === 'notifications/initialized') return res.writeHead(202).end();
    let result;
    if (body.method === 'initialize') {
      res.setHeader('mcp-session-id', 'session-isolated');
      result = { serverInfo: { name: '隔离MCP', version: '1.0' }, capabilities: {} };
      if (mode === 'init-result-missing') result = undefined;
      if (mode === 'init-name-missing') result = { serverInfo: {}, capabilities: {} };
      if (mode === 'init-capabilities-missing') result = { serverInfo: { name: '测试' } };
    } else if (body.method === 'tools/list') {
      result = { tools: [{ name: 'search_ku' }, { name: 'get_ku_detail' }] };
      if (mode === 'tools-result-missing') result = undefined;
      if (mode === 'tools-not-array') result = { tools: {} };
      if (mode === 'tools-null') result = { tools: [null] };
      if (mode === 'tools-empty-name') result = { tools: [{ name: '' }] };
      if (mode === 'tools-number-name') result = { tools: [{ name: 12 }] };
    } else {
      result = Object.hasOwn(outputs, req.headers['x-fixture-kb']) ? outputs[req.headers['x-fixture-kb']] : { structuredContent: { results: [{ title: '单库正文' }] } };
    }
    const response = { jsonrpc: '2.0', id: body.id, ...(result === undefined ? {} : { result }) };
    if (mode === 'bad-jsonrpc') response.jsonrpc = '1.0';
    if (mode === 'bad-id') response.id = -1;
    if (mode === 'rpc-error') response.error = { code: -1, message: '失败' };
    if (mode === 'null-response') return res.end('null');
    if (mode === 'bad-sse') return res.end('event: message\ndata: {invalid\n\n');
    if (mode === 'bad-format') return res.end('event: message\ndata:invalid\n\n');
    res.end(mode === 'sse' ? `event: message\ndata: ${JSON.stringify(response)}\n\n` : JSON.stringify(response));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => {
  mode = ''; calls = []; outputs = {}; failedTargets = new Set();
  mockRules = { platformMcp: { multiSearchHeaderName: 'X-Fixture-Kb' } };
});
afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });

test('缓存容量逐出最早条目，清空与默认配置可观察', () => {
  const defaults = new MCPCache();
  expect(defaults.ttl).toBe(3600000); expect(defaults.maxSize).toBe(1000);
  const cache = new MCPCache({ max_size: 2 });
  cache.set('a', 1); cache.set('b', 2); cache.set('c', 3);
  expect(cache.get('a')).toBeNull(); expect(cache.get('b')).toBe(2); expect(cache.size).toBe(2);
  cache.clear(); expect(cache.size).toBe(0); expect(cache.get('c')).toBeNull();
});

test.each([new Error('配置不可读'), { platformMcp: {} }])('配置标头不可用时使用空标头：%j', rules => {
  mockRules = rules;
  const c = new MCPClient({ headers: [{ value: '忽略' }, { name: 'X-Empty', value: '' }] });
  expect(c.searchKnowledgeBaseHeader).toBe(''); expect(c.customHeaders).toEqual({});
  expect(c.baseUrl).toBe('http://localhost:8080');
});

test('显式知识库去重，自动注入首目标且保留其他标头', () => {
  const c = client({ search_knowledge_bases: ['one', 'one', '', 2], headers: [{ name: 'X-Custom', value: '保留' }] });
  expect(c.searchKnowledgeBases).toEqual(['one', '2']);
  expect(c.customHeaders).toEqual({ 'X-Custom': '保留', 'X-Fixture-Kb': 'one' });
  expect(() => client({ enabled: false })).toThrow('MCP 服务已停用');
});

test('真实SSE握手、会话/认证标头、工具详情与单库缓存命中', async () => {
  mode = 'sse';
  const c = client({ api_key: 'fixture-token' });
  expect(await c.testConnection()).toMatchObject({ success: true, tools: ['search_ku', 'get_ku_detail'] });
  expect(calls[0].headers.authorization).toBe('Bearer fixture-token');
  const notification = calls.find(c => c.body.method === 'notifications/initialized');
  expect(notification.body).not.toHaveProperty('id');
  expect(notification.headers['mcp-session-id']).toBe('session-isolated');
  const data = await c.query('部署');
  const count = calls.length;
  expect(await c.query('部署')).toEqual(data); expect(calls).toHaveLength(count);
  await c.getDocument('文档甲');
  expect(calls.at(-1).body.params).toEqual({ name: 'get_ku_detail', arguments: { ku_name: '文档甲' } });
  expect(c.getCacheStats()).toMatchObject({ enabled: true, size: 1 });
});

test.each([
  ['http-error', '503'], ['bad-sse', 'Failed to parse SSE data'], ['bad-format', 'Invalid SSE response format'],
  ['bad-jsonrpc', 'Invalid MCP JSON-RPC response'], ['bad-id', 'Invalid MCP JSON-RPC response'],
  ['rpc-error', 'Invalid MCP JSON-RPC response'], ['null-response', 'Invalid MCP JSON-RPC response'],
  ['init-result-missing', 'Invalid MCP initialize response'], ['init-name-missing', 'Invalid MCP initialize response'], ['init-capabilities-missing', 'Invalid MCP initialize response'],
])('真实HTTP协议失败%s明确拒绝', async (scenario, message) => {
  mode = scenario;
  await expect(client().initialize()).rejects.toThrow(message);
  expect(calls.some(c => c.body.method === 'notifications/initialized')).toBe(false);
});

test.each(['tools-result-missing', 'tools-not-array', 'tools-null', 'tools-empty-name', 'tools-number-name'])('工具目录非法%s明确拒绝', async scenario => {
  mode = scenario;
  await expect(client().listTools()).rejects.toThrow('Invalid MCP tools/list response');
});

test('多库文本/结构化结果去重与排序、缓存隔离', async () => {
  outputs = {
    one: { content: [ { type: 'image' }, { type: 'text', text: '{invalid' }, { type: 'text', text: JSON.stringify({ results: [{ ku_name: '同文档', score: 0.5 }, { title: '匿名', excerpt: '摘要' }, { score: 0.3, kb_id: 'override' }] }) } ] },
    two: { structuredContent: { results: [{ ku_name: '同文档', score: 0.9 }, { title: '其他', score: 0 }, { title: '', excerpt: '', score: 0 }] } },
  };
  const c = multi({ headers: [{ name: 'X-Fixture-Kb', value: 'unused' }, { name: 'X-Trace', value: 'kept' }] });
  const result = await c.query('事务', { limit: 5 });
  expect(result.structuredContent).toMatchObject({ total: 5, kb_ids: ['one', 'two'] });
  expect(result.structuredContent.results[0]).toMatchObject({ ku_name: '同文档', score: 0.9, kb_id: 'two' });
  expect(result.structuredContent.results.some(r => r.kb_id === 'override')).toBe(true);
  expect(calls.filter(c => c.body.method === 'tools/call').map(c => c.headers['x-fixture-kb']).sort()).toEqual(['one', 'two']);
  expect(calls.every(c => c.headers['x-trace'] === 'kept')).toBe(true);
  const count = calls.length; await c.query('事务', { limit: 5 }); expect(calls).toHaveLength(count);
  await c.query('事务', { limit: 6 }); expect(calls.length).toBeGreaterThan(count);
});

test.each([
  [{ structuredContent: {} }, { structuredContent: { results: 'invalid' } }, true],
  [{ content: [{ type: 'text', text: '{}' }] }, { content: [{ type: 'text', text: '{"results":null}' }] }, true],
  [null, { content: [{ type: 'image' }, { type: 'text', text: 'invalid' }] }, false],
  [{ structuredContent: [] }, {}, false],
])('多库无可合并结果保持空集合或原始载荷：%j/%j', async (one, two, structured) => {
  outputs = { one, two };
  const result = await multi({ cache: { enabled: false } }).query('空结果');
  expect(result.searchKnowledgeBases).toEqual(['one', 'two']);
  if (structured) expect(result.structuredContent).toMatchObject({ total: 0, results: [] });
  else expect(Array.isArray(result.structuredContent) || result.structuredContent === undefined).toBe(true);
});

test('全部知识库失败明确拒绝；无结构化结果时部分失败仍可返回', async () => {
  failedTargets.add('one'); failedTargets.add('two');
  await expect(multi().query('失败')).rejects.toThrow('MCP search failed for all configured knowledge bases');
  failedTargets.delete('two'); outputs.two = { content: [] };
  const result = await multi({ cache: { enabled: false } }).query('降级');
  expect(result.searchKnowledgeBases).toEqual(['two']); expect(result).not.toHaveProperty('structuredContent');
});

test('无缓存单库空结果原样返回；批查询保留成功项', async () => {
  outputs = { undefined: null };
  const c = client({ cache: { enabled: false } });
  expect(await c.query('空')).toBeNull();
  expect(c.getCacheStats()).toEqual({ enabled: false, size: 0, ttl: 0 });
  expect(await c.batchQuery(['甲', '乙'])).toEqual([{ query: '甲', success: true, data: null, error: null }, { query: '乙', success: true, data: null, error: null }]);
});

test('默认构造与真实连接失败/批查询错误保持公开契约', async () => {
  expect(new MCPClient().timeout).toBe(30000);
  mode = 'http-error';
  expect(await client().testConnection()).toMatchObject({ success: false, message: expect.stringContaining('503') });
  expect(await client().batchQuery(['失败查询'])).toEqual([{ query: '失败查询', success: false, data: null, error: expect.stringContaining('503') }]);
});

test('重复无分数文档保持首项，有分数项替换缺省零分', async () => {
  outputs = {
    one: { structuredContent: { results: [{ ku_name: '无分重复', title: '首项' }, { ku_name: '后续高分', title: '低分' }] } },
    two: { structuredContent: { results: [{ ku_name: '无分重复', title: '后项' }, { ku_name: '后续高分', score: 0.8 }] } },
  };
  const result = await multi().query('重复项');
  expect(result.structuredContent.results).toEqual([
    { ku_name: '后续高分', score: 0.8, kb_id: 'two' },
    { ku_name: '无分重复', title: '首项', kb_id: 'one' },
  ]);
});
