const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
function send(res, body, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

describe('认证网关传输真实HTTP边界', () => {
  let root, upstream, gateway, base, mode, seen, dispatched, originalEnv;
  const session = { authenticated: true, user: { id: 'reader' }, allowedActions: ['knowledge:read'] };
  beforeEach(async () => {
    originalEnv = [process.env.KNOWLEDGE_STORAGE_MODE, process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE];
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE = 'file';
    const runtime = path.resolve(__dirname, '../../../runtime/test-results');
    fs.mkdirSync(runtime, { recursive: true });
    root = fs.mkdtempSync(path.join(runtime, 'auth-transport-'));
    mode = 'success'; seen = []; dispatched = jest.fn();
    upstream = http.createServer((req, res) => {
      seen.push({ url: req.url, cookie: req.headers.cookie, accept: req.headers.accept });
      if (mode === 'timeout') return;
      if (mode === 'disconnect') return req.socket.destroy();
      if (mode === 'status') return send(res, { content: session }, 503);
      if (mode === 'bad-json') return res.end('{');
      if (mode === 'empty') return res.end();
      if (mode === 'null') return res.end('null');
      send(res, { content: session });
    });
    await listen(upstream);
  });
  afterEach(async () => {
    if (gateway) { await close(gateway); gateway = null; }
    await close(upstream);
    fs.rmSync(root, { recursive: true, force: true });
    ['KNOWLEDGE_STORAGE_MODE', 'KNOWLEDGE_PLATFORM_CONFIG_MODE'].forEach((key, index) => {
      if (originalEnv[index] === undefined) delete process.env[key]; else process.env[key] = originalEnv[index];
    });
  });
  async function start(auth) {
    const workbook = path.join(root, 'fixture.xlsx'); fs.writeFileSync(workbook, 'fixture');
    const handler = createKnowledgeCenterHandler({
      config: {
        KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root,
        KNOWLEDGE_CENTER_ENTRY: 'index.html', OUTLINE_TEMPLATE_PATH: workbook, OUTLINE_SAMPLE_PATH: workbook,
        GITLAB_CONFIG_PATH: path.join(root, 'gitlab.json'), AUTH_API_HOST: '127.0.0.1',
        AUTH_API_PORT: upstream.address().port, PLATFORM_CONTEXT_TIMEOUT_MS: 40,
      },
      stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [] }) }, domainStore: {}, manualStatusStore: {}, brandIconStore: {} },
      modules: { auth }, handbookProductionService: {}, documentTasksOptions: { filePath: path.join(root, 'tasks.json') },
      handleIncrementalBuild: (req, res, value) => { dispatched(value); send(res, { success: true, userId: value.user.id }); },
      proxyAuth: (req, res) => send(res, { proxy: 'auth', url: req.url }),
      proxyPermission: (req, res) => send(res, { proxy: 'permissions', url: req.url }),
      sendFile: (_file, res) => { res.writeHead(404); res.end(); },
    });
    gateway = http.createServer(handler); await listen(gateway);
    base = `http://127.0.0.1:${gateway.address().port}/knowledge-center/api`;
  }
  async function get(endpoint = '/incremental-tasks', headers = {}) {
    const response = await fetch(base + endpoint, { headers });
    return { status: response.status, cache: response.headers.get('cache-control'),
      requestId: response.headers.get('x-request-id'), correlationId: response.headers.get('x-correlation-id'),
      body: await response.json() };
  }
  test('有效会话转发Cookie及JSON协商并传递会话', async () => {
    await start();
    expect(await get('/incremental-tasks', { cookie: 'kc_session=local-fixture' })).toMatchObject({ status: 200, body: { success: true, userId: 'reader' } });
    expect(seen).toEqual([{ url: '/knowledge-center/api/auth/session', cookie: 'kc_session=local-fixture', accept: 'application/json' }]);
    expect(dispatched).toHaveBeenCalledWith(session);
  });
  test.each(['status', 'bad-json', 'empty', 'null', 'disconnect', 'timeout'])('会话上游%s拒绝进入业务，恢复后可访问', async failure => {
    await start(); mode = failure;
    const response = await get('/incremental-tasks', { 'x-request-id': 'transport-request', 'x-correlation-id': 'transport-correlation' });
    expect(response).toMatchObject({ status: 401, cache: 'no-store', requestId: 'transport-request', correlationId: 'transport-correlation',
      body: { success: false, error: { code: 'AUTH_REQUIRED', retryable: false, requestId: 'transport-request', correlationId: 'transport-correlation' } } });
    expect(dispatched).not.toHaveBeenCalled();
    expect(seen[0].cookie).toBe('');
    mode = 'success';
    expect(await get()).toMatchObject({ status: 200, body: { userId: 'reader' } });
    expect(dispatched).toHaveBeenCalledTimes(1);
  });
  test('无插件时保留认证与权限代理各自入口和查询参数', async () => {
    await start();
    expect((await get('/auth/session?refresh=1')).body).toEqual({ proxy: 'auth', url: '/knowledge-center/api/auth/session?refresh=1' });
    expect((await get('/platform/permissions/u/roles?version=2')).body).toEqual({ proxy: 'permissions', url: '/knowledge-center/api/platform/permissions/u/roles?version=2' });
    expect(seen).toEqual([]);
  });
  test('权限插件看到重写URL，完成后原请求URL恢复', async () => {
    let observedRequest;
    await start({ handler: async (req, res) => { observedRequest = req; send(res, { url: req.url }); } });
    const target = '/platform/permissions/user/roles?version=2';
    expect((await get(target)).body.url).toBe('/knowledge-center/api/auth/users/user/roles?version=2');
    expect(observedRequest.url).toBe('/knowledge-center/api' + target);
  });
  test('插件异步失败输出结构化错误，下一次请求恢复', async () => {
    const auth = { handler: jest.fn(async () => { throw Object.assign(new Error('暂不可用'), { status: 502, code: 'UPSTREAM_FAILED', details: { component: 'auth' } }); }) };
    await start(auth);
    expect(await get('/auth/session')).toMatchObject({ status: 502, cache: 'no-store', body: { success: false, error: { code: 'UPSTREAM_FAILED', message: '暂不可用', retryable: true, details: { component: 'auth' } } } });
    auth.handler.mockImplementationOnce(async (_req, res) => send(res, { recovered: true }));
    expect(await get('/auth/session')).toMatchObject({ status: 200, body: { recovered: true } });
  });
  test.each([null, { status: 399 }, { status: 600 }, { status: 400.5 }])('插件非法错误状态回退503 %#', async error => {
    await start({ handler: () => Promise.reject(error) });
    expect(await get('/auth/session')).toMatchObject({ status: 503, body: { error: { code: 'AUTH_SERVICE_UNAVAILABLE', retryable: true } } });
  });
});
