const express = require('express');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

describe('工作流路由真实 HTTP 契约', () => {
  let root;
  let server;
  let base;
  let priorMode;

  async function request(method, route, body) {
    const response = await fetch(`${base}/api/workflows${route}`, {
      method,
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-route-'));
    priorMode = process.env.KNOWLEDGE_STORAGE_MODE;
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    jest.resetModules();
    jest.doMock('../../../packages/agent-runner-core/lib/repo-paths', () => ({ AGENT_RUNNER_RUNTIME_ROOT: root }));
    const router = require('../../../packages/agent-runner-core/routes/workflow');
    const app = express();
    app.use(express.json());
    app.use('/api/workflows', router);
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
    jest.dontMock('../../../packages/agent-runner-core/lib/repo-paths');
    jest.resetModules();
    if (priorMode === undefined) delete process.env.KNOWLEDGE_STORAGE_MODE;
    else process.env.KNOWLEDGE_STORAGE_MODE = priorMode;
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  test('默认流程可读，新流程创建后可更新并从列表删除', async () => {
    const defaults = await request('GET', '/list');
    expect(defaults.body.data.map(item => item.id)).toEqual(['default', 'fast', 'high_quality']);
    expect((await request('GET', '/default')).body.data.steps).toHaveLength(4);
    const created = await request('POST', '/', { id: 'review', name: '审核流程', steps: [{ agent: 'validator' }] });
    expect(created.status).toBe(200);
    expect(created.body.data.deleted).toBe(false);
    expect((await request('POST', '/', { id: 'review', name: '重复', steps: [] })).status).toBe(400);
    const updated = await request('PUT', '/review', { id: 'forged', name: '二次审核' });
    expect(updated.body.data).toMatchObject({ id: 'review', name: '二次审核' });
    expect((await request('GET', '/list')).body.data.find(item => item.id === 'review').name).toBe('二次审核');
    expect((await request('DELETE', '/review')).status).toBe(200);
    expect((await request('GET', '/review')).status).toBe(404);
  });

  test('缺失字段和不存在的工作流返回明确错误', async () => {
    expect((await request('POST', '/', { id: 'incomplete' })).status).toBe(400);
    expect((await request('GET', '/missing')).status).toBe(404);
    expect((await request('PUT', '/missing', { name: '修改' })).status).toBe(404);
    expect((await request('DELETE', '/missing')).status).toBe(404);
  });
});
