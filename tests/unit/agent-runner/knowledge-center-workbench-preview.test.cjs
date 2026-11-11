const fs = require('fs');
const { describe, it: test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const os = require('os');
const path = require('path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const { emptyState } = require('../../../packages/agent-runner-core/routes/document-tasks');

describe('工作台责任人目录、正式代办和兼容预览 HTTP 契约', () => {
  let root, server, base, previous;
  const users = [
    { id: 'auth-admin', principalId: 'admin', displayName: '管理员', enabled: true, roles: ['PLATFORM_ADMIN'] },
    { id: 'auth-writer', principalId: 'writer', displayName: '撰写人', enabled: true, roles: ['KNOWLEDGE_EDITOR'] },
    { id: 'auth-disabled', principalId: 'disabled', displayName: '停用人员', enabled: false, roles: ['EDITOR'] },
  ];
  beforeEach(async () => {
    previous = process.env.KNOWLEDGE_CENTER_LOCAL_OWNER_PREVIEW;
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-preview-'));
    for (const name of ['template.xlsx', 'sample.xlsx']) fs.writeFileSync(path.join(root, name), 'fixture');
    const taskState = emptyState('admin');
    taskState.tasks.push({ number: 'WB-100', description: '撰写人测试任务', ownerId: 'writer', decomposition: { confirmed: false, ticketImpact: null, handbooks: [] }, createdAt: '2026-11-05T00:00:00Z', source: {} });
    fs.writeFileSync(path.join(root, 'tasks.json'), JSON.stringify(taskState));
    const handler = createKnowledgeCenterHandler({
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, KNOWLEDGE_CENTER_ENTRY: 'index.html', OUTLINE_TEMPLATE_PATH: path.join(root, 'template.xlsx'), OUTLINE_SAMPLE_PATH: path.join(root, 'sample.xlsx'), PINGCODE_PREFIX: '/pingcode', PINGCODE_ROOT: root, GITLAB_CONFIG_PATH: path.join(root, 'gitlab.json'), GITLAB_DOCUMENT_TYPES_PATH: path.join(root, 'rules.json') },
      stores: {
        knowledgeAssetsStore: { readAsync: async () => ({ handbooks: [] }), read: () => ({ handbooks: [] }) },
        manualStatusStore: { read: () => ({ statuses: {} }) }, brandIconStore: {},
        domainStore: { readPrincipalsAsync: async () => ({ items: users.map(user => ({ id: user.principalId, displayName: user.displayName })) }) },
      },
      documentTasksOptions: { filePath: path.join(root, 'tasks.json'), defaultOwnerId: 'admin' },
      moduleRegistry: { get: name => name === 'auth' ? { authorize: async req => req.headers['x-test-user'] === 'guest' ? { user: users[1], allowedActions: ['knowledge:read'] } : { user: users[0], allowedActions: ['platform:manage', 'knowledge:read'] }, repository: { listUsers: async () => users } } : null },
      sendFile(_file, res) { res.writeHead(404); res.end(); }, proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {},
      handleIncrementalBuild: { service: { readState: async () => ({ tasks: [] }), reviewBootstrap: () => ({ documents: [] }) } },
    });
    server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  afterEach(async () => {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.KNOWLEDGE_CENTER_LOCAL_OWNER_PREVIEW;
    else process.env.KNOWLEDGE_CENTER_LOCAL_OWNER_PREVIEW = previous;
  });
  test('正式人员目录仅管理员可见且不列停用人员', async () => {
    const url = `${base}/knowledge-center/api/workbench/responsibles`;
    assert.equal((await fetch(url, { headers: { 'x-test-user': 'guest' } })).status, 403);
    const result = await (await fetch(url)).json();
    assert.deepEqual(result.data, [{ id: 'admin', displayName: '管理员' }, { id: 'writer', displayName: '撰写人' }]);
  });
  test('预览只读、非法责任人拒绝，不修改默认本人接口', async () => {
    process.env.KNOWLEDGE_CENTER_LOCAL_OWNER_PREVIEW = '1';
    const url = `${base}/knowledge-center/api/workbench/preview?responsibleId=`;
    assert.equal((await fetch(url + 'disabled')).status, 404);
    assert.equal((await fetch(url + 'missing')).status, 404);
    const response = await fetch(url + 'writer');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.responsible.id, 'writer');
    assert.equal(body.data.readOnly, true);
    assert.equal(body.data.completeness, 'complete');
    assert.deepEqual(body.data.unavailable, []);
    assert.equal(body.data.items.length, 1);
    assert.equal(body.data.items[0].id, 'ticket:WB-100:scope');
    assert.equal(body.data.items[0].url, undefined);
    assert.equal(body.data.items[0].title, '确认 WB-100 的手册范围');
  });
  test('正式代办返回来源链接且仍使用管理员会话', async () => {
    const url = `${base}/knowledge-center/api/workbench/delegated?responsibleId=`;
    assert.equal((await fetch(url + 'writer', { headers: { 'x-test-user': 'guest' } })).status, 403);
    assert.equal((await fetch(url + 'disabled')).status, 404);
    const response = await fetch(url + 'writer');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.readOnly, false);
    assert.equal(body.data.operator.id, 'admin');
    assert.equal(body.data.responsible.id, 'writer');
    assert.match(body.data.items[0].url, /document-tasks\?task=WB-100&action=ticket-scope/);
  });
  test('统一查询真实 HTTP：本人权限、嵌套过滤、分页与错误条件', async () => {
    const url = `${base}/knowledge-center/api/workbench/my-tasks/query`;
    const query = (body, headers = {}) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const filter = { op: 'and', children: [
      { field: 'number', operator: 'eq', value: 'WB-100' },
      { op: 'or', children: [{ field: 'status', operator: 'eq', value: '待处理' }, { field: 'description', operator: 'contains', value: '工单范围' }] },
    ] };
    const denied = await query({ responsibleId: 'admin', queue: 'actionable', type: 'all', page: 1, pageSize: 20 }, { 'x-test-user': 'guest' });
    assert.equal(denied.status, 403);
    const response = await query({ responsibleId: 'writer', queue: 'actionable', type: 'all', page: 1, pageSize: 1, filter });
    assert.equal(response.status, 200);
    const result = (await response.json()).data;
    assert.equal(result.total, 1);
    assert.equal(result.items[0].number, 'WB-100');
    assert.equal(result.facets.types.assign, 1);
    assert.equal(result.items[0].url.includes('action=ticket-scope'), true);
    assert.equal((await query({ queue: 'actionable', page: 1, pageSize: 20, filter: { field: 'ownerId', operator: 'eq', value: 'writer' } })).status, 422);
  });
  test('任务来源损坏时返回部分数据并标明来源', async () => {
    fs.writeFileSync(path.join(root, 'tasks.json'), '{broken');
    const response = await fetch(`${base}/knowledge-center/api/workbench/my-tasks/query`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queue: 'actionable', page: 1, pageSize: 20 }),
    });
    assert.equal(response.status, 200);
    const data = (await response.json()).data;
    assert.equal(data.completeness, 'partial');
    assert.deepEqual(data.unavailable, ['任务管理']);
    assert.equal(data.total, 0);
  });
});
