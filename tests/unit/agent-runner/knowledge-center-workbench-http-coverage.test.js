const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const { emptyState } = require('../../../packages/agent-runner-core/routes/document-tasks');

const runtimeRoot = path.resolve(__dirname, '../../../runtime/test-results');
const users = [
  { id: 'auth-admin', principalId: 'admin', displayName: '管理员', enabled: true, roles: ['PLATFORM_ADMIN'] },
  { id: 'auth-writer', principalId: 'writer', displayName: '撰写人', enabled: true, roles: ['KNOWLEDGE_EDITOR'] },
  { id: 'auth-disabled', principalId: 'disabled', displayName: '停用人员', enabled: false, roles: ['EDITOR'] },
];

describe('工作台责任人和联合查询的真实 HTTP 覆盖', () => {
  let root, server, base, previous;
  beforeEach(async () => {
    previous = process.env.KNOWLEDGE_CENTER_LOCAL_OWNER_PREVIEW;
    fs.mkdirSync(runtimeRoot, { recursive: true });
    root = fs.mkdtempSync(path.join(runtimeRoot, 'workbench-http-coverage-'));
    for (const name of ['template.xlsx', 'sample.xlsx']) fs.writeFileSync(path.join(root, name), 'fixture');
    const taskState = emptyState('admin');
    taskState.tasks.push({ number: 'WB-100', description: '撰写人测试任务', ownerId: 'writer',
      decomposition: { confirmed: false, ticketImpact: null, handbooks: [] },
      createdAt: '2026-11-05T00:00:00Z', source: {} });
    fs.writeFileSync(path.join(root, 'tasks.json'), JSON.stringify(taskState));
    const handler = createKnowledgeCenterHandler({
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, KNOWLEDGE_CENTER_ENTRY: 'index.html',
        OUTLINE_TEMPLATE_PATH: path.join(root, 'template.xlsx'), OUTLINE_SAMPLE_PATH: path.join(root, 'sample.xlsx'),
        PINGCODE_PREFIX: '/pingcode', PINGCODE_ROOT: root, GITLAB_CONFIG_PATH: path.join(root, 'gitlab.json'),
        GITLAB_DOCUMENT_TYPES_PATH: path.join(root, 'rules.json') },
      stores: {
        knowledgeAssetsStore: { readAsync: async () => ({ handbooks: [] }), read: () => ({ handbooks: [] }) },
        manualStatusStore: { read: () => ({ statuses: {} }) }, brandIconStore: {},
        domainStore: { readPrincipalsAsync: async () => ({ items: users.map(user => ({ id: user.principalId, displayName: user.displayName })) }) },
      },
      documentTasksOptions: { filePath: path.join(root, 'tasks.json'), defaultOwnerId: 'admin' },
      moduleRegistry: { get: name => name === 'auth' ? {
        authorize: async req => req.headers['x-test-user'] === 'guest'
          ? { user: users[1], allowedActions: ['knowledge:read'] }
          : { user: users[0], allowedActions: ['platform:manage', 'knowledge:read'] },
        repository: { listUsers: async () => users },
      } : null },
      sendFile(_file, res) { res.writeHead(404); res.end(); },
      proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {},
      handleIncrementalBuild: { service: { readState: async () => ({ tasks: [] }), reviewBootstrap: () => ({ documents: [] }) } },
    });
    server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/knowledge-center/api/workbench`;
  });
  afterEach(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.KNOWLEDGE_CENTER_LOCAL_OWNER_PREVIEW;
    else process.env.KNOWLEDGE_CENTER_LOCAL_OWNER_PREVIEW = previous;
  });

  const query = (body, headers = {}) => fetch(`${base}/my-tasks/query`, { method: 'POST',
    headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

  test('责任人目录隐藏停用人员并拒绝非管理员', async () => {
    expect((await fetch(`${base}/responsibles`, { headers: { 'x-test-user': 'guest' } })).status).toBe(403);
    const response = await fetch(`${base}/responsibles`);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([
      { id: 'admin', displayName: '管理员' }, { id: 'writer', displayName: '撰写人' },
    ]);
  });

  test('只读预览和正式代办保留不同的操作能力', async () => {
    expect((await fetch(`${base}/preview?responsibleId=writer`)).status).toBe(403);
    process.env.KNOWLEDGE_CENTER_LOCAL_OWNER_PREVIEW = '1';
    expect((await fetch(`${base}/preview?responsibleId=disabled`)).status).toBe(404);
    expect((await fetch(`${base}/preview?responsibleId=missing`)).status).toBe(404);
    const preview = await fetch(`${base}/preview?responsibleId=writer`);
    expect(preview.status).toBe(200);
    const projected = (await preview.json()).data;
    expect(projected).toMatchObject({ readOnly: true, responsible: { id: 'writer' }, completeness: 'complete' });
    expect(projected.items[0]).toMatchObject({ id: 'ticket:WB-100:scope', title: '确认 WB-100 的工单范围' });
    expect(projected.items[0].url).toBeUndefined();
    expect((await fetch(`${base}/delegated?responsibleId=writer`, { headers: { 'x-test-user': 'guest' } })).status).toBe(403);
    const delegated = await fetch(`${base}/delegated?responsibleId=writer`);
    expect(delegated.status).toBe(200);
    const data = (await delegated.json()).data;
    expect(data).toMatchObject({ readOnly: false, operator: { id: 'admin' }, responsible: { id: 'writer' } });
    expect(data.items[0].url).toContain('action=ticket-scope');
  });

  test('联合查询执行嵌套条件、分页、本人权限和错误映射', async () => {
    const filter = { op: 'and', children: [
      { field: 'number', operator: 'eq', value: 'WB-100' },
      { op: 'or', children: [{ field: 'status', operator: 'eq', value: '待处理' },
        { field: 'description', operator: 'contains', value: '工单范围' }] },
    ] };
    expect((await fetch(`${base}/my-tasks/query`)).status).toBe(405);
    expect((await query({ responsibleId: 'admin' }, { 'x-test-user': 'guest' })).status).toBe(403);
    const response = await query({ responsibleId: 'writer', queue: 'actionable', type: 'all', page: 1, pageSize: 1, filter });
    expect(response.status).toBe(200);
    const data = (await response.json()).data;
    expect(data).toMatchObject({ total: 1, responsible: { id: 'writer' }, operator: { id: 'admin' }, facets: { types: { assign: 1 } } });
    expect(data.items[0].url).toContain('action=ticket-scope');
    const invalid = await query({ filter: { field: 'ownerId', operator: 'eq', value: 'writer' } });
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toMatchObject({ error: { code: 'WORKBENCH_QUERY_INVALID' } });
  });

  test('损坏的任务来源仍返回部分可用结果和来源标记', async () => {
    fs.writeFileSync(path.join(root, 'tasks.json'), '{broken');
    const response = await query({ queue: 'actionable', page: 1, pageSize: 20 });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ completeness: 'partial', unavailable: ['任务管理'], total: 0 });
  });
});
