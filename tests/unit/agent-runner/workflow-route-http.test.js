const express = require('express');
const fs = require('node:fs');
const http = require('node:http');
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
    const resultsRoot = path.resolve(__dirname, '../../../runtime/test-results');
    fs.mkdirSync(resultsRoot, { recursive: true });
    root = fs.mkdtempSync(path.join(resultsRoot, 'workflow-route-'));
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

  test('重复加载路由保留已有默认流程文件', () => {
    const target = path.join(root, 'workflows', 'default.json');
    const before = fs.readFileSync(target, 'utf8');
    jest.resetModules();
    require('../../../packages/agent-runner-core/routes/workflow');
    expect(fs.readFileSync(target, 'utf8')).toBe(before);
  });

  test('缺失字段和不存在的工作流返回明确错误', async () => {
    expect((await request('POST', '/', { id: 'incomplete' })).status).toBe(400);
    expect((await request('GET', '/missing')).status).toBe(404);
    expect((await request('PUT', '/missing', { name: '修改' })).status).toBe(404);
    expect((await request('DELETE', '/missing')).status).toBe(404);
  });

  test('损坏JSON使单项、列表和更新失败，移除坏文件后可恢复', async () => {
    const target = path.join(root, 'workflows', 'broken.json');
    fs.writeFileSync(target, '{broken');
    try {
      for (const [method, route, body] of [['GET', '/broken'], ['GET', '/list'], ['PUT', '/broken', { name: '不能覆盖坏文件' }]]) {
        const response = await request(method, route, body);
        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({ success: false, message: expect.any(String) });
        expect(fs.readFileSync(target, 'utf8')).toBe('{broken');
      }
    } finally {
      fs.unlinkSync(target);
    }
    expect((await request('GET', '/list')).status).toBe(200);
    expect((await request('GET', '/default')).body.data.id).toBe('default');
  });

  test('软删除流程从列表隐藏且禁止读取和更新', async () => {
    const target = path.join(root, 'workflows', 'deleted.json');
    const payload = { id: 'deleted', name: '已删除', steps: [], deleted: true };
    fs.writeFileSync(target, JSON.stringify(payload));
    try {
      expect((await request('GET', '/deleted')).status).toBe(404);
      expect((await request('PUT', '/deleted', { name: '不能恢复' })).status).toBe(404);
      expect((await request('GET', '/list')).body.data.some(item => item.id === 'deleted')).toBe(false);
      expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toEqual(payload);
    } finally {
      fs.unlinkSync(target);
    }
  });

  test('写入父路径冲突返回500且不留下流程文件', async () => {
    const blocker = path.join(root, 'workflows', 'blocked');
    fs.writeFileSync(blocker, '占用父路径');
    try {
      const result = await request('POST', '/', { id: 'blocked/child', name: '无法存储', steps: [] });
      expect(result.status).toBe(500);
      expect(result.body.success).toBe(false);
      expect(fs.readFileSync(blocker, 'utf8')).toBe('占用父路径');
      expect(fs.existsSync(path.join(blocker, 'child.json'))).toBe(false);
    } finally {
      fs.unlinkSync(blocker);
    }
  });

  test('流程文件变为目录时更新和删除失败，清理后其它流程保持可用', async () => {
    const target = path.join(root, 'workflows', 'directory.json');
    fs.mkdirSync(target);
    try {
      for (const [method, body] of [['PUT', { name: '无效修改' }], ['DELETE']]) {
        const response = await request(method, '/directory', body);
        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(fs.statSync(target).isDirectory()).toBe(true);
      }
    } finally {
      fs.rmdirSync(target);
    }
    expect((await request('GET', '/list')).status).toBe(200);
  });
});
