jest.mock('../../../packages/agent-runner-core/lib/tools/mcp-client', () => ({
  MCPClient: jest.fn().mockImplementation(() => ({
    query: jest.fn(async query => ({ query, results: [{ id: 'result-1' }] })),
    getDocument: jest.fn(async documentId => ({ id: documentId, content: 'document' })),
  })),
}));

const { createMcpBridge } = require('../../../packages/agent-runner-core/lib/agent-runtime/mcp-bridge');

async function send(bridge, body, { method = 'POST', token = bridge.token } = {}) {
  const response = await fetch(bridge.url, {
    method,
    headers: token ? { authorization: `Bearer ${token}`, 'content-type': 'application/json', connection: 'close' } : { connection: 'close' },
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: response.status === 200 ? JSON.parse(text) : null };
}

test('桥接没有启用的知识库时不开放本地 MCP 端点', async () => {
  expect(await createMcpBridge()).toBeNull();
  expect(await createMcpBridge({ services: [{ id: 'off', enabled: false, adapter: 'yashandb', knowledgeBases: [] }] })).toBeNull();
  expect(await createMcpBridge({ services: [{ id: 'generic', enabled: true, adapter: 'generic', knowledgeBases: [] }] })).toBeNull();
  expect(await createMcpBridge({ services: [{ id: 'empty', enabled: true, adapter: 'yashandb', knowledgeBases: [] }] })).toBeNull();
  const legacy = await createMcpBridge({ server_url: 'http://127.0.0.1', name: '旧服务' });
  expect(legacy).toMatchObject({ token: expect.any(String), url: expect.stringContaining('/mcp') });
  legacy.close();
});

test('桥接强制 Bearer POST、支持通知/初始化/工具清单与授权调用', async () => {
  const bridge = await createMcpBridge({ services: [{ id: 'svc', name: '测试', adapter: 'yashandb', server_url: 'http://127.0.0.1',
    knowledgeBases: [{ id: 'kb', name: '知识库', locator: 'locator' }, { id: 'off', enabled: false, locator: 'off' }] }] });
  try {
    expect((await send(bridge, { id: 1, method: 'initialize' }, { token: '' })).status).toBe(403);
    expect((await send(bridge, null, { method: 'GET', token: null })).status).toBe(403);
    expect((await send(bridge, { id: 1 }, { method: 'GET' })).status).toBe(405);
    expect((await send(bridge, { method: 'notifications/initialized' })).status).toBe(202);
    expect((await send(bridge, '{invalid-json')).body.error.code).toBe(-32602);
    expect((await send(bridge, { id: 1, method: 'initialize' })).body.result.protocolVersion).toBe('2024-11-05');
    expect((await send(bridge, { id: 2, method: 'tools/list' })).body.result.tools).toHaveLength(2);
    const search = await send(bridge, { id: 3, method: 'tools/call', params: { name: 'knowledge_search', arguments: { knowledgeBase: 'svc/kb', query: 'CHAR' } } });
    expect(JSON.parse(search.body.result.content[0].text)).toMatchObject({ query: 'CHAR' });
    const read = await send(bridge, { id: 4, method: 'tools/call', params: { name: 'knowledge_read', arguments: { knowledgeBase: 'svc/kb', documentId: 'doc-1' } } });
    expect(JSON.parse(read.body.result.content[0].text)).toEqual({ id: 'doc-1', content: 'document' });
    const emptySearch = await send(bridge, { id: 9, method: 'tools/call', params: { name: 'knowledge_search', arguments: { knowledgeBase: 'svc/kb' } } });
    expect(JSON.parse(emptySearch.body.result.content[0].text).query).toBe('');
    const emptyRead = await send(bridge, { id: 10, method: 'tools/call', params: { name: 'knowledge_read', arguments: { knowledgeBase: 'svc/kb' } } });
    expect(JSON.parse(emptyRead.body.result.content[0].text).id).toBe('');
    for (const message of [
      { id: 5, method: 'unknown' },
      { id: 6, method: 'tools/call', params: { name: 'knowledge_search', arguments: { knowledgeBase: 'outside' } } },
      { id: 7, method: 'tools/call', params: { name: 'other', arguments: { knowledgeBase: 'svc/kb' } } },
      { id: 8, method: 'tools/call', params: { name: 'knowledge_search', arguments: { knowledgeBase: 'svc/off' } } },
      { id: 11, method: 'tools/call' },
    ]) {
      expect((await send(bridge, message)).body.error.code).toBe(-32602);
    }
  } finally {
    bridge.close();
  }
});
