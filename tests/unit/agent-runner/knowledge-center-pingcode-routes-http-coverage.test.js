const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');

describe('PingCode 来源同步真实 HTTP 路由覆盖', () => {
  let root, server, base, calls, failure;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'pingcode-routes-http-'));
    for (const name of ['template.xlsx', 'sample.xlsx']) fs.writeFileSync(path.join(root, name), 'fixture');
    calls = [];
    const domainStore = {
      requestAsync: jest.fn(async (method, endpoint, body, headers) => {
        calls.push({ method, endpoint, body, headers });
        if (failure) throw failure;
        if (endpoint.endsWith('/sources/source-1/runs')) return { data: [] };
        if (/\/runs\/[^/]+\/resources\?/.test(endpoint)) return { data: { items: [], total: 0 } };
        return { data: { endpoint } };
      }),
      readPrincipalsAsync: async () => ({ items: [] }),
    };
    const handler = createKnowledgeCenterHandler({
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root,
        KNOWLEDGE_CENTER_ENTRY: 'index.html', OUTLINE_TEMPLATE_PATH: path.join(root, 'template.xlsx'),
        OUTLINE_SAMPLE_PATH: path.join(root, 'sample.xlsx'), PINGCODE_PREFIX: '/pingcode', PINGCODE_ROOT: root,
        PINGCODE_API_HOST: '127.0.0.1', PINGCODE_API_PORT: 1, GITLAB_CONFIG_PATH: path.join(root, 'gitlab.json'),
        GITLAB_DOCUMENT_TYPES_PATH: path.join(root, 'rules.json') },
      stores: { knowledgeAssetsStore: { readAsync: async () => ({ handbooks: [] }), read: () => ({ handbooks: [] }) },
        manualStatusStore: { read: () => ({ statuses: {} }) }, brandIconStore: {}, domainStore },
      moduleRegistry: { get: name => name === 'auth' ? { authorize: async req => {
        if (req.headers['x-test-user'] === 'anonymous') return null;
        const roles = req.headers['x-test-user'] === 'reader' ? ['KNOWLEDGE_EDITOR'] : ['PLATFORM_ADMIN'];
        return { user: { id: 'admin', roles }, roles };
      } } : null },
      sendFile(_file, res) { res.writeHead(404); res.end(); },
      proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
    });
    server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/knowledge-center/api/platform/plugins/pingcode`;
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  beforeEach(() => { calls.length = 0; failure = null; });

  const call = (route, method = 'GET', body, user = 'admin') => fetch(`${base}${route}`, {
    method,
    headers: { 'x-test-user': user, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  test('列表、分页、详情和运行读取映射到隔离 Storage HTTP', async () => {
    const requests = [
      ['/sources', 'GET'], ['/sources/source-1/items?page=2&pageSize=7', 'GET'],
      ['/sources/source-1/items/SR%2F1', 'GET'], ['/runs/run-1/items?page=3&pageSize=9', 'GET'],
      ['/runs/run-1/items/SR-2', 'GET'], ['/runs/run-1/unlinked-irs?page=2&pageSize=11', 'GET'],
      ['/sources/source-1', 'GET'], ['/sources/source-1/runs', 'GET'], ['/runs/run-1', 'GET'],
      ['/runs/run-1/preview?page=2&pageSize=8&view=updated', 'GET'],
      ['/runs/run-1/resources?page=2&pageSize=13', 'GET'],
    ];
    for (const [route, method] of requests) {
      const response = await call(route, method);
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.success).toBe(true);
      if (route.endsWith('/runs')) expect(payload.data).toEqual([]);
      else expect(payload.data).toBeDefined();
    }
    expect(calls.map(({ endpoint }) => endpoint)).toEqual([
      '/v1/pingcode-task-sync/sources',
      '/v1/pingcode-task-sync/sources/source-1/items?page=2&pageSize=7',
      '/v1/pingcode-task-sync/sources/source-1/items/SR%2F1',
      '/v1/pingcode-task-sync/runs/run-1/items?page=3&pageSize=9',
      '/v1/pingcode-task-sync/runs/run-1/items/SR-2',
      '/v1/pingcode-task-sync/runs/run-1/unlinked-irs?page=2&pageSize=11',
      '/v1/pingcode-task-sync/sources/source-1', '/v1/pingcode-task-sync/sources/source-1/runs',
      '/v1/pingcode-task-sync/runs/run-1',
      '/v1/pingcode-task-sync/runs/run-1/preview?page=2&pageSize=8&view=updated',
      '/v1/pingcode-task-sync/runs/run-1/resources?page=2&pageSize=13',
    ]);
  });

  test('创建、更新、状态切换、删除和运行控制转发 HTTP 契约', async () => {
    const mutations = [
      ['/sources', 'POST', { name: '需求', type: 'REQUIREMENT', productType: 'DB', url: 'https://pingcode.yasdb.com/source' }],
      ['/sources/source-1', 'PATCH', { name: '更新', type: 'TICKET', productType: 'DB', url: 'https://pingcode.yasdb.com/source', revision: 2 }],
      ['/sources/source-1/state', 'PATCH', { state: 'ACTIVE', revision: 2 }],
      ['/runs/run-1/resources/retry', 'POST', {}], ['/runs/run-1/confirm', 'POST', { digest: 'a'.repeat(64), expectedRevision: 1 }],
      ['/runs/run-1/cancel', 'POST'],
    ];
    for (const [route, method, body] of mutations) expect((await call(route, method, body)).status).toBe(200);
    expect(calls.map(({ method, endpoint }) => [method, endpoint])).toEqual([
      ['POST', '/v1/pingcode-task-sync/sources'], ['PATCH', '/v1/pingcode-task-sync/sources/source-1'],
      ['PATCH', '/v1/pingcode-task-sync/sources/source-1/state'],
      ['GET', '/v1/pingcode-task-sync/runs/run-1/resources?page=1&pageSize=100'],
      ['GET', '/v1/pingcode-task-sync/runs/run-1'],
      ['POST', '/v1/pingcode-task-sync/runs/run-1/confirm'], ['POST', '/v1/pingcode-task-sync/runs/run-1/cancel'],
    ]);
    expect(calls[0].body).toMatchObject({ actor: 'admin', connectionId: '127.0.0.1:1' });
  });

  test('只允许管理员访问，并将未知操作拒绝为 405', async () => {
    expect((await call('/sources', 'GET', undefined, 'anonymous')).status).toBe(401);
    expect((await call('/sources', 'GET', undefined, 'reader')).status).toBe(403);
    const unsupported = await call('/sources', 'PUT');
    expect(unsupported.status).toBe(405);
    expect(await unsupported.json()).toMatchObject({ error: { code: 'METHOD_NOT_ALLOWED' } });
    expect(calls).toHaveLength(0);
  });

  test('存储错误保留允许的状态码，未知状态映射为安全 503', async () => {
    failure = Object.assign(new Error('来源版本冲突'), { code: 'PINGCODE_SOURCE_CONFLICT', status: 409 });
    const conflict = await call('/sources');
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ error: { code: 'PINGCODE_SOURCE_CONFLICT', message: '来源版本冲突' } });

    failure = Object.assign(new Error('详情不能泄露'), { code: 'UPSTREAM_FAILURE', status: 500 });
    const unavailable = await call('/sources');
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({ error: { code: 'UPSTREAM_FAILURE', message: 'Pingcode 同步服务暂时不可用' } });
  });
});
