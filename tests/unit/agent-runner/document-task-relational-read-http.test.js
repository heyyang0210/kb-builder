const http = require('node:http');
const express = require('express');
const { createDocumentTaskRouter } = require('../../../packages/agent-runner-core/routes/document-tasks');

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
