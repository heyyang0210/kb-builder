const express = require('express');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

describe('工作流数据库模式真实双层HTTP', () => {
  let worker, server, root, base, previous;
  const seed = { id: 'default', name: '保留人工流程', steps: [{ agent: 'planner' }] };
  async function control(type, value) {
    return new Promise(resolve => { worker.once('message', resolve); worker.postMessage({ type, value }); });
  }
  async function request(method, route, body) {
    const response = await fetch(base + route, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  beforeEach(async () => {
    previous = Object.fromEntries(['KNOWLEDGE_STORAGE_MODE', 'YASDB_STORAGE_URL'].map(k => [k, process.env[k]]));
    const parent = path.resolve(__dirname, '../../../runtime/test-results');
    fs.mkdirSync(parent, { recursive: true });
    root = fs.mkdtempSync(path.join(parent, 'workflow-db-'));
    fs.mkdirSync(path.join(root, 'workflows'));
    worker = new Worker(path.join(__dirname, 'fixtures/workflow-record-http-worker.cjs'), { workerData: {
      records: { default: seed, fast: { id: 'fast', deleted: true }, unrelated: { id: 'unrelated' }, hidden: { id: 'hidden', deleted: true }, absent: null }, failFirstRead: 'high_quality',
    } });
    const { port } = await new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); });
    process.env.KNOWLEDGE_STORAGE_MODE = 'database';
    process.env.YASDB_STORAGE_URL = `http://127.0.0.1:${port}`;
    jest.resetModules();
    jest.doMock('../../../packages/agent-runner-core/lib/repo-paths', () => ({ AGENT_RUNNER_RUNTIME_ROOT: root }));
    const app = express();
    app.use(express.json());
    app.use('/workflow', require('../../../packages/agent-runner-core/routes/workflow'));
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/workflow`;
  });
  afterEach(async () => {
    if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
    if (worker) await worker.terminate();
    jest.dontMock('../../../packages/agent-runner-core/lib/repo-paths');
    jest.resetModules();
    for (const [k,v] of Object.entries(previous)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    fs.rmSync(root, { recursive: true, force: true });
  });
  test('初始化保留人工流程、恢复软删除默认项并从读取故障恢复', async () => {
    const state = await control('inspect');
    expect(state.records.default).toEqual(seed);
    expect(state.records.fast).toMatchObject({ id: 'fast', deleted: false });
    expect(state.records.high_quality.steps).toHaveLength(5);
    expect(state.writes.map(w => w.id)).toEqual(['fast', 'high_quality']);
    const list = await request('GET', '/list');
    expect(list.status).toBe(200);
    expect(list.body.data.map(w => w.id).sort()).toEqual(['default', 'fast', 'high_quality']);
    expect(fs.readdirSync(path.join(root, 'workflows'))).toEqual([]);
  });
  test('创建更新删除使用数据库且更新不能伪造标识', async () => {
    expect((await request('POST', '/', { id: 'default', name: '重复', steps: [] })).status).toBe(400);
    const created = await request('POST', '/', { id: 'review', name: '审核', steps: [], is_default: true });
    expect(created.status).toBe(200);
    expect(created.body.data).toMatchObject({ id: 'review', is_default: true, deleted: false });
    expect((await request('PUT', '/review', { id: 'forged', name: '更新审核' })).body.data).toMatchObject({ id: 'review', name: '更新审核' });
    expect((await request('GET', '/review')).body.data.name).toBe('更新审核');
    expect((await request('DELETE', '/review')).status).toBe(200);
    for (const [method,body] of [['GET'], ['PUT', { name: '不得恢复' }], ['DELETE']]) {
      expect((await request(method, '/review', body)).status).toBe(404);
    }
    const state = await control('inspect');
    expect(state.records.review).toMatchObject({ id: 'review', deleted: true, deleted_at: expect.any(String) });
    expect(state.records.forged).toBeUndefined();
    expect(state.writes.filter(w => w.id === 'review')).toHaveLength(3);
    expect(state.writes.every(w => /^\d+$/.test(w.revision))).toBe(true);
  });
  test('空请求和无记录导出安全返回，不覆盖已有工作流', async () => {
    expect((await request('POST', '/')).status).toBe(400);
    expect((await request('PUT', '/default')).body.data).toMatchObject(seed);
    await control('empty-export', true);
    expect((await request('GET', '/list')).body).toEqual({ success: true, data: [] });
    await control('empty-export', false);
    expect((await request('GET', '/list')).body.data).toHaveLength(3);
  });
  test('导出、读取和写入故障返回失败且保留已有记录', async () => {
    await control('failure', '/v1/export');
    expect((await request('GET', '/list')).status).toBe(500);
    await control('failure', 'GET');
    for (const method of ['GET', 'PUT', 'DELETE']) expect((await request(method, '/default', method === 'PUT' ? { name: '不得写' } : undefined)).status).toBe(500);
    await control('failure', 'PUT');
    expect((await request('POST', '/', { id: 'new', name: '不得创建', steps: [] })).status).toBe(500);
    expect((await request('PUT', '/default', { name: '不得写' })).status).toBe(500);
    expect((await request('DELETE', '/default')).status).toBe(500);
    const state = await control('failure', null);
    expect(state.records.default).toEqual(seed);
    expect(state.records.new).toBeUndefined();
    expect(state.writes).toHaveLength(2);
    expect((await request('GET', '/default')).body.data).toEqual(seed);
  });
});
