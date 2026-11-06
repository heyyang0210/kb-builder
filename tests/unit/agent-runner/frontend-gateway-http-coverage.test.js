const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

describe('知识中心前端网关 HTTP 分流与资源响应', () => {
  let root;
  let gateway;
  let upstream;
  let base;
  let previousEnv;
  const forwarded = [];
  const upstreamCases = new Map();
  let gatewayOptions;

  const request = async (pathname, options = {}) => fetch(`${base}${pathname}`, { redirect: 'manual', ...options });

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-gateway-http-'));
    fs.writeFileSync(path.join(root, 'document-generation-workbench.html'), '<h1>隔离工作台</h1>');
    fs.writeFileSync(path.join(root, 'sample.js'), 'globalThis.sample = true;');
    fs.writeFileSync(path.join(root, 'sample.bin'), 'binary fixture');
    upstream = http.createServer((req, res) => {
      forwarded.push({ path: req.url, method: req.method, headers: req.headers });
      const caseResult = upstreamCases.get(req.url);
      if (caseResult) {
        res.writeHead(caseResult.status || 200, { 'Content-Type': caseResult.contentType || 'application/json' });
        res.end(caseResult.body);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ path: req.url, method: req.method }));
    });
    await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
    previousEnv = Object.fromEntries(['KNOWLEDGE_CENTER_FRONTEND_ROOT', 'PINGCODE_API_HOST', 'PINGCODE_API_PORT', 'DOCUMENT_API_HOST', 'DOCUMENT_API_PORT', 'KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN', 'KNOWLEDGE_CENTER_ADMIN_USERNAME', 'KNOWLEDGE_CENTER_ADMIN_PASSWORD', 'KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_USERNAME', 'KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_PASSWORD', 'KNOWLEDGE_ASSETS_CONFIG', 'KNOWLEDGE_CENTER_AUTH_STORE', 'KNOWLEDGE_CENTER_GITLAB_CONFIG', 'KNOWLEDGE_STORAGE_MODE'].map(key => [key, process.env[key]]));
    Object.assign(process.env, {
      KNOWLEDGE_CENTER_FRONTEND_ROOT: root,
      PINGCODE_API_HOST: '127.0.0.1', PINGCODE_API_PORT: String(upstream.address().port),
      DOCUMENT_API_HOST: '127.0.0.1', DOCUMENT_API_PORT: String(upstream.address().port),
      KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN: 'isolated-outline-token',
      KNOWLEDGE_CENTER_ADMIN_USERNAME: 'isolated-admin', KNOWLEDGE_CENTER_ADMIN_PASSWORD: 'isolated-pass',
      KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_USERNAME: 'isolated-editor', KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_PASSWORD: 'isolated-pass',
      KNOWLEDGE_ASSETS_CONFIG: path.join(root, 'assets.json'),
      KNOWLEDGE_CENTER_AUTH_STORE: path.join(root, 'auth.json'),
      KNOWLEDGE_CENTER_GITLAB_CONFIG: path.join(root, 'gitlab.json'),
      KNOWLEDGE_STORAGE_MODE: 'file',
    });
    fs.writeFileSync(path.join(root, 'assets.json'), JSON.stringify({ version: 1, handbooks: [], audits: [] }));
    jest.resetModules();
    jest.doMock('../../../packages/agent-runner-core/routes/knowledge-center', () => ({
      createKnowledgeCenterHandler: options => {
        gatewayOptions = options;
        return (req, res) => {
        if (req.url.includes('/throw-sync')) throw Object.assign(Error('同步网关错误'), { code: 'SYNC_ERROR' });
        if (req.url.includes('/reject-async')) return Promise.reject(Object.assign(Error('异步网关错误'), { status: 422, code: 'ASYNC_ERROR' }));
        if (req.url.includes('/reject-after-end')) { res.writeHead(202); res.end('已处理'); return Promise.reject(Error('结束后失败')); }
        if (req.url.startsWith('/knowledge-center/api/cleaning')) return options.proxyCleaning(req, res, { session: { user: { id: 'isolated-user', displayName: '隔离用户' } }, endpoint: { id: 'cleaning-fixture' } });
        if (req.url.startsWith('/knowledge-center/api/outline')) return options.proxyOutline(req, res, { user: { id: 'outline-user', allowedActions: ['outline:read'] } });
        if (req.url.startsWith('/knowledge-center/api/document-tasks')) return options.proxyDocumentTasks(req, res, { session: { user: { id: 'task-user' } } });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ route: 'knowledge-center', path: req.url }));
        };
      },
    }));
    gateway = require('../../../apps/knowledge-center-web/frontend-server').server;
    await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${gateway.address().port}`;
  });

  afterAll(async () => {
    await Promise.all([gateway, upstream].filter(Boolean).map(server => new Promise(resolve => server.close(resolve))));
    jest.dontMock('../../../packages/agent-runner-core/routes/knowledge-center');
    jest.resetModules();
    for (const [key, value] of Object.entries(previousEnv || {})) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  test('首页、脚本、未知类型及 ETag 条件请求使用实际文件响应', async () => {
    const home = await request('/');
    expect(home.status).toBe(200);
    expect(home.headers.get('content-type')).toContain('text/html');
    expect(home.headers.get('cache-control')).toBe('no-cache');
    expect(await home.text()).toContain('隔离工作台');
    const script = await request('/sample.js', { headers: { 'x-request-id': 'gateway-static-1' } });
    expect(script.status).toBe(200);
    expect(script.headers.get('content-type')).toContain('application/javascript');
    expect(script.headers.get('x-request-id')).toBe('gateway-static-1');
    const etag = script.headers.get('etag');
    expect(etag).toMatch(/^"[0-9a-f]+"$/);
    expect((await request('/sample.js', { headers: { 'if-none-match': etag } })).status).toBe(304);
    const htmlWithEtag = await request('/', { headers: { 'if-none-match': home.headers.get('etag') } });
    expect(htmlWithEtag.status).toBe(200);
    const binary = await request('/sample.bin');
    expect(binary.headers.get('content-type')).toBe('application/octet-stream');
    expect(await binary.text()).toBe('binary fixture');
    expect((await request('/missing.css')).status).toBe(404);
  });

  test('静态文件读取失败返回 500，资源不存在返回 404', async () => {
    const original = fs.readFile;
    const read = jest.spyOn(fs, 'readFile').mockImplementation((file, callback) => {
      if (String(file).endsWith('broken.json')) return callback(Object.assign(Error('隔离读取失败'), { code: 'EIO' }));
      return original(file, callback);
    });
    try {
      const response = await request('/broken.json');
      expect(response.status).toBe(500);
      expect(await response.text()).toBe('Server Error');
    } finally { read.mockRestore(); }
  });

  test('知识中心、PingCode 与文档代理经真实本地 HTTP 分流', async () => {
    const center = await request('/knowledge-center/api/probe');
    expect(center.status).toBe(200);
    expect(await center.json()).toMatchObject({ route: 'knowledge-center', path: '/knowledge-center/api/probe' });
    const ping = await request('/pingcode-api/health?source=web');
    expect(await ping.json()).toMatchObject({ path: '/health?source=web' });
    const pingRoot = await request('/pingcode-api');
    expect(await pingRoot.json()).toMatchObject({ path: '/' });
    const document = await request('/api/document', { method: 'POST', body: '{}' });
    expect(await document.json()).toMatchObject({ path: '/api/document', method: 'POST' });
    expect(forwarded.some(item => item.path === '/api/document' && item.method === 'POST')).toBe(true);
  });

  test('旧浏览器入口、重定向与失败知识中心请求的信封', async () => {
    const retired = await request('/pingcode-materials/legacy');
    expect(retired.status).toBe(410);
    expect(await retired.json()).toMatchObject({ error: { code: 'PINGCODE_WEB_RETIRED' } });
    const redirect = await request('/prompt-generator.html?topic=%E9%83%A8%E7%BD%B2');
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get('location')).toBe('/document-generation-workbench.html?topic=%E9%83%A8%E7%BD%B2');
    const sync = await request('/knowledge-center/throw-sync', { headers: { 'x-request-id': 'gateway-sync-1' } });
    expect(sync.status).toBe(503);
    expect(await sync.json()).toMatchObject({ error: { code: 'SYNC_ERROR', message: '同步网关错误', requestId: 'gateway-sync-1' } });
    const asyncResponse = await request('/knowledge-center/reject-async');
    expect(asyncResponse.status).toBe(422);
    expect(await asyncResponse.json()).toMatchObject({ error: { code: 'ASYNC_ERROR', message: '异步网关错误', retryable: false } });
    const ended = await request('/knowledge-center/reject-after-end');
    expect(ended.status).toBe(202);
    expect(await ended.text()).toBe('已处理');
  });

  test('资料加工代理以真实 HTTP 规范化对象、数组和旧版成功信封', async () => {
    upstreamCases.set('/api/workbench/summary', { body: JSON.stringify({ count: 2 }) });
    const summary = await request('/knowledge-center/api/cleaning/workbench/summary', { headers: { 'x-request-id': 'cleaning-request-1' } });
    expect(summary.status).toBe(200);
    expect(summary.headers.get('transfer-encoding')).toBeNull();
    const summaryBody = await summary.text();
    expect(Number(summary.headers.get('content-length'))).toBe(Buffer.byteLength(summaryBody));
    expect(JSON.parse(summaryBody)).toMatchObject({ success: true, requestId: 'cleaning-request-1', data: { count: 2 } });
    expect(forwarded.at(-1).headers['x-actor-id']).toBe('isolated-user');
    expect(forwarded.at(-1).headers['x-actor-display-name']).toBeUndefined();
    upstreamCases.set('/api/items', { body: JSON.stringify([{ id: 'first' }]) });
    const items = await request('/knowledge-center/api/cleaning/items');
    expect(await items.json()).toMatchObject({ success: true, items: [{ id: 'first' }], data: [{ id: 'first' }] });
    upstreamCases.set('/api/legacy', { body: JSON.stringify({ success: true, jobId: 'legacy-1' }) });
    const legacy = await request('/knowledge-center/api/cleaning/legacy');
    expect(await legacy.json()).toMatchObject({ success: true, jobId: 'legacy-1', data: { jobId: 'legacy-1' } });
    upstreamCases.set('/api/non-json', { body: 'plain response', contentType: 'text/plain' });
    const plain = await request('/knowledge-center/api/cleaning/non-json');
    expect(await plain.text()).toBe('plain response');
  });

  test('资料加工代理对标准与非标准错误、非法 JSON 做明确归一化', async () => {
    upstreamCases.set('/api/rejected', { status: 422, body: JSON.stringify({ detail: [{ loc: ['body', 'name'], msg: '必填' }] }) });
    const rejected = await request('/knowledge-center/api/cleaning/rejected');
    expect(rejected.status).toBe(422);
    expect(await rejected.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR', retryable: false, details: { status: 422, issues: [{ msg: '必填' }] } } });
    upstreamCases.set('/api/failure', { status: 503, body: JSON.stringify({ success: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: '上游暂不可用', retryable: true } }) });
    const failure = await request('/knowledge-center/api/cleaning/failure');
    expect(failure.status).toBe(503);
    expect(await failure.json()).toMatchObject({ error: { code: 'UPSTREAM_UNAVAILABLE', message: '上游暂不可用', requestId: expect.any(String) } });
    upstreamCases.set('/api/broken-error', { status: 500, body: '<html>broken</html>', contentType: 'text/html' });
    const broken = await request('/knowledge-center/api/cleaning/broken-error');
    expect(broken.status).toBe(500);
    expect(await broken.json()).toMatchObject({ error: { code: 'MATERIAL_PROCESSING_ERROR', retryable: true } });
    upstreamCases.set('/api/broken-success', { body: '{not-json' });
    const raw = await request('/knowledge-center/api/cleaning/broken-success');
    expect(raw.status).toBe(200);
    expect(await raw.text()).toBe('{not-json');
  });

  test('大纲与任务代理覆盖可信身份头及目录创建的内部请求', async () => {
    const outline = await request('/knowledge-center/api/outline/catalog?handbookId=HB-1', { headers: { 'x-actor-id': 'forged', 'x-outline-actions': 'forged' } });
    expect(outline.status).toBe(200);
    expect(forwarded.at(-1).path).toBe('/api/outline/catalog?handbookId=HB-1');
    expect(forwarded.at(-1).headers['x-actor-id']).toBe('outline-user');
    expect(forwarded.at(-1).headers['x-outline-actions']).toBe('outline:read');
    expect(forwarded.at(-1).headers['x-knowledge-center-internal-token']).toBe('isolated-outline-token');
    const tasks = await request('/knowledge-center/api/document-tasks/123');
    expect(tasks.status).toBe(200);
    expect(forwarded.at(-1).path).toBe('/api/document-tasks/123');
    expect(forwarded.at(-1).headers['x-actor-id']).toBe('task-user');

    upstreamCases.set('/api/outline/catalog?handbookId=HB-1&view=directory', { body: JSON.stringify({ success: true, data: { selectedId: 'outline-1', directory: { nodes: [{ id: 'doc-1', kind: 'document', title: '隔离正文' }] } } }) });
    const session = { user: { id: 'catalog-user', allowedActions: ['outline:read', 'outline:create'] } };
    const catalog = await gatewayOptions.documentTaskCatalog('HB-1', session);
    expect(catalog).toMatchObject({ outlineId: 'outline-1', documents: [{ id: 'doc-1', name: '隔离正文' }] });
    upstreamCases.set('/api/outline/governance/outline-1/document-proposals', { body: JSON.stringify({ success: true, data: { documentId: 'new-doc-1' } }) });
    const created = await gatewayOptions.documentTaskCreateDocument('HB-1', { proposalKey: 'proposal-1', title: '新文档' }, session);
    expect(created).toEqual({ documentId: 'new-doc-1' });
    expect(forwarded.at(-1).method).toBe('POST');
    expect(forwarded.at(-1).headers['idempotency-key']).toBe('task-document-proposal-1');
    expect(forwarded.at(-1).headers['x-actor-id']).toBe('catalog-user');
  });

  test('目录与新增候选失败保留上游状态及错误码', async () => {
    const session = { user: { id: 'catalog-user', allowedActions: [] } };
    upstreamCases.set('/api/outline/catalog?handbookId=HB-2&view=directory', { status: 503, body: JSON.stringify({ success: false, error: { message: '目录暂不可用' } }) });
    await expect(gatewayOptions.documentTaskCatalog('HB-2', session)).rejects.toMatchObject({ status: 503, message: '目录暂不可用' });
    upstreamCases.set('/api/outline/catalog?handbookId=HB-1&view=directory', { body: JSON.stringify({ success: true, data: { selectedId: 'outline-1', directory: { nodes: [] } } }) });
    upstreamCases.set('/api/outline/governance/outline-1/document-proposals', { status: 409, body: JSON.stringify({ success: false, error: { code: 'PROPOSAL_CONFLICT', message: '候选冲突' } }) });
    await expect(gatewayOptions.documentTaskCreateDocument('HB-1', { proposalKey: 'conflict' }, session)).rejects.toMatchObject({ status: 409, code: 'PROPOSAL_CONFLICT', message: '候选冲突' });
  });

  test('上游断连时各代理返回独立服务错误且不泄漏伪造身份', async () => {
    await new Promise(resolve => upstream.close(resolve));
    const ping = await request('/pingcode-api/failure');
    expect(ping.status).toBe(502);
    expect(await ping.json()).toMatchObject({ error: { code: 'PINGCODE_API_UNAVAILABLE' } });
    const document = await request('/api/failure');
    expect(document.status).toBe(502);
    expect(await document.json()).toMatchObject({ error: { code: 'DOCUMENT_API_UNAVAILABLE' } });
    const cleaning = await request('/knowledge-center/api/cleaning/failure');
    expect(cleaning.status).toBe(502);
    expect(await cleaning.json()).toMatchObject({ error: { code: 'MATERIAL_PROCESSING_UNAVAILABLE' } });
    const tasks = await request('/knowledge-center/api/document-tasks/failure');
    expect(tasks.status).toBe(502);
    expect(await tasks.json()).toMatchObject({ error: { code: 'DOCUMENT_TASK_SERVICE_UNAVAILABLE' } });
    const outline = await request('/knowledge-center/api/outline/failure', { headers: { 'x-actor-id': 'forged' } });
    expect(outline.status).toBe(502);
    expect(await outline.json()).toMatchObject({ error: { code: 'OUTLINE_SERVICE_UNAVAILABLE' } });
  });
});
