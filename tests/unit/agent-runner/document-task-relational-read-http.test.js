const http = require('node:http');
const express = require('express');
const { createDocumentTaskRouter } = require('../../../packages/agent-runner-core/routes/document-tasks');
const { createDocumentTaskRelationalStore } = require('../../../packages/agent-runner-core/lib/document-task-relational-store');

const tasks = Array.from({ length: 101 }, (_, index) => ({
  number: `YDBRD-${index + 1}`, ownerId: 'owner', description: `任务 ${index + 1}`,
  status: 'pending_scope', decomposition: { confirmed: false, handbooks: [] },
}));

async function fixture(overrides = {}) {
  const pages = [];
  const relationalStore = {
    active: async () => true,
    config: async () => ({ revision: 0, defaultOwnerId: 'owner', reasonOptions: [] }),
    mine: async (_principalId, page) => {
      pages.push(page);
      return { items: page === 1 ? tasks.slice(0, 100) : tasks.slice(100), total: tasks.length };
    },
    list: async () => ({ items: tasks.slice(0, 1), total: 101, page: 1, pageSize: 1,
      filterOptions: { product: ['DB', 'YCM'], version: ['23.4', '27.1'] } }),
    ...overrides,
  };
  const app = express();
  app.use('/api', createDocumentTaskRouter({ relationalStore, context: () => ({
    session: { user: { id: 'owner', allowedActions: ['knowledge:read', 'knowledge:write'] } },
    people: [{ id: 'owner', displayName: '责任人' }], handbooks: [],
  }) }));
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { pages, get: async path => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`);
    return { status: response.status, body: await response.json() };
  }, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}

test('关系表个人工作遍历全部分页，筛选候选不依赖当前页', async () => {
  const api = await fixture();
  try {
    const mine = await api.get('/mine');
    expect(mine.status).toBe(200);
    expect(mine.body.data.total).toBe(101);
    expect(mine.body.data.items.at(-1).number).toBe('YDBRD-101');
    expect(api.pages).toEqual([1, 2]);
    const list = await api.get('/');
    expect(list.body.data.filterOptions).toEqual({ product: ['DB', 'YCM'], version: ['23.4', '27.1'] });
  } finally { await api.close(); }
});

test('关系表分页变动时不返回不完整的个人工作', async () => {
  const api = await fixture({ mine: async (_principalId, page) => ({
    items: page === 1 ? tasks.slice(0, 100) : [], total: tasks.length,
  }) });
  try {
    const response = await api.get('/mine');
    expect(response).toMatchObject({ status: 503, body: { success: false,
      error: { code: 'DOCUMENT_TASK_MINE_INCOMPLETE' } } });
  } finally { await api.close(); }
});

test('已确认来源详情经任务可见性校验并只返回公开快照字段', async () => {
  const expected = { number: 'YDBRD-1', title: 'SR 描述', markdown: '## 需求描述\n\n正文',
    ir: ['YASHAN-1'], sourceName: '需求基线', sourceUrl: 'https://pingcode.example.test/baseline',
    confirmedAt: '2026-11-16T01:00:00Z' };
  const api = await fixture({
    find: async number => ({ number, ownerId: 'owner', sourceType: 'REQUIREMENT',
      decomposition: { handbooks: [] } }),
    source: async () => ({ ...expected, resources: [{ internalPath: '/private/file' }], runId: 'run-secret' }),
  });
  try {
    const response = await api.get('/YDBRD-1/source');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expected);
  } finally { await api.close(); }
});

test('任务不可见时拒绝读取来源详情', async () => {
  const api = await fixture({
    find: async number => ({ number, ownerId: 'owner', sourceType: 'REQUIREMENT',
      decomposition: { handbooks: [{ id: 'private-handbook' }] } }),
    source: async () => ({ number: 'YDBRD-1', title: '不应返回', markdown: '不应返回' }),
  });
  try {
    const response = await api.get('/YDBRD-1/source');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  } finally { await api.close(); }
});

test('隔离关系存储适配器经公开 HTTP 路由编码读写及错误边界', async () => {
  const requests = [];
  let active = true;
  createDocumentTaskRelationalStore();
  const missing = Object.assign(new Error('missing'), { code: 'DOCUMENT_TASK_NOT_FOUND' });
  const storage = {
    requestAsync: async (method, path, body, headers) => {
      requests.push({ method, path, body, headers });
      if (path.endsWith('/status')) return { data: { active } };
      if (path.endsWith('/config')) return { data: { revision: 0, storageRevision: 2, defaultOwnerId: 'owner', reasonOptions: [] } };
      if (path.includes('/mine?')) return { data: { items: [], total: 0 } };
      if (path.includes('/document-tasks?')) return { data: { items: [], total: 0, page: 1, pageSize: 50, filterOptions: {} } };
      if (path.endsWith('/writes/missing')) throw Object.assign(new Error('missing'), { code: 'DOCUMENT_TASK_WRITE_NOT_FOUND' });
      if (method === 'GET' && path === '/v1/document-tasks/YDB%2F7') throw missing;
      if (path.endsWith('/failure')) throw Object.assign(new Error('unavailable'), { code: 'DOMAIN_UNAVAILABLE' });
      return { data: { method, path, body } };
    },
  };
  const relationalStore = createDocumentTaskRelationalStore({ storage });
  const app = express();
  app.use('/api', createDocumentTaskRouter({ relationalStore, context: () => ({
    session: { user: { id: 'owner', allowedActions: ['knowledge:read', 'knowledge:write'] } },
    people: [{ id: 'owner', displayName: '责任人' }], handbooks: [{ id: 'hb-1' }, { id: 'hb-2' }],
  }) }));
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const get = async path => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`);
    return { status: response.status, body: await response.json() };
  };
  try {
    const list = await get('/');
    expect(list.status).toBe(200);
    expect(requests.at(-1).path).toBe('/v1/document-tasks?visibleHandbooks=hb-1%2Chb-2');
    const mine = await get('/mine?visibleHandbooks=hb-1%2Chb-2');
    expect(mine.status).toBe(200);
    expect(requests.some(request => request.path.includes('/mine?principalId=owner&page=1&pageSize=100&visibleHandbooks=hb-1%2Chb-2'))).toBe(true);

    expect(await relationalStore.active()).toBe(true);
    active = false;
    expect(await relationalStore.active()).toBe(false);
    active = true;
    await relationalStore.config();
    await relationalStore.putConfig({ defaultOwnerId: 'owner' }, 2, 'owner:key', 'sha256');
    expect(await relationalStore.find('YDB/7')).toBeNull();
    await expect(relationalStore.find('failure')).rejects.toMatchObject({ code: 'DOMAIN_UNAVAILABLE' });
    await relationalStore.list({ q: 'YDB 7', ownerId: '', page: 3, absent: null });
    await relationalStore.list();
    await relationalStore.mine('owner', 2, 25, []);
    await relationalStore.mine('owner');
    await relationalStore.byReview('review/1');
    await relationalStore.source('YDB/7');
    await relationalStore.changes('YDB/7', 2, 10);
    await relationalStore.changes('YDB/7');
    expect(await relationalStore.replay('missing')).toBeNull();
    await relationalStore.replay('key/1');
    await expect(relationalStore.replay('failure')).rejects.toMatchObject({ code: 'DOMAIN_UNAVAILABLE' });
    await relationalStore.put('YDB/7', { number: 'YDB/7' }, 4, 'owner:key', 'sha256', { ok: true });

    expect(requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'PUT', path: '/v1/document-tasks/config', headers: { 'Idempotency-Key': 'owner:key' } }),
      expect.objectContaining({ method: 'GET', path: '/v1/document-tasks/by-review/review%2F1' }),
      expect.objectContaining({ method: 'GET', path: '/v1/pingcode-task-sync/tasks/YDB%2F7/source' }),
      expect.objectContaining({ method: 'GET', path: '/v1/pingcode-task-sync/tasks/YDB%2F7/changes?page=2&pageSize=10' }),
      expect.objectContaining({ method: 'PUT', path: '/v1/document-tasks/YDB%2F7', headers: { 'Idempotency-Key': 'owner:key' } }),
    ]));
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
