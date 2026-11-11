const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const { emptyState } = require('../../../packages/agent-runner-core/routes/document-tasks');
const { IncrementalBuildService, MemoryIncrementalBuildRepository } = require('../../../packages/agent-runner-core/lib/incremental-build-service');

const runtimeRoot = path.resolve(__dirname, '../../../runtime/test-results');
const users = [
  { id: 'auth-admin', principalId: 'admin', displayName: '管理员', enabled: true, roles: ['PLATFORM_ADMIN'] },
  { id: 'auth-writer', principalId: 'writer', displayName: '撰写人', enabled: true, roles: ['KNOWLEDGE_EDITOR'] },
  { id: 'auth-disabled', principalId: 'disabled', displayName: '停用人员', enabled: false, roles: ['EDITOR'] },
];

describe('工作台责任人和联合查询的真实 HTTP 覆盖', () => {
  let root, server, base, previous, reviewTasks, incremental, generationFailure, generationCall;
  beforeEach(async () => {
    previous = process.env.KNOWLEDGE_CENTER_LOCAL_OWNER_PREVIEW;
    fs.mkdirSync(runtimeRoot, { recursive: true });
    root = fs.mkdtempSync(path.join(runtimeRoot, 'workbench-http-coverage-'));
    reviewTasks = [];
    generationFailure = null;
    generationCall = null;
    for (const name of ['template.xlsx', 'sample.xlsx']) fs.writeFileSync(path.join(root, name), 'fixture');
    const taskState = emptyState('admin');
    taskState.tasks.push({ number: 'WB-100', description: '撰写人测试任务', ownerId: 'writer',
      decomposition: { confirmed: false, ticketImpact: null, handbooks: [] },
      createdAt: '2026-11-05T00:00:00Z', source: {} });
    fs.writeFileSync(path.join(root, 'tasks.json'), JSON.stringify(taskState));
    incremental = { service: {
      readState: async () => ({ tasks: reviewTasks }), reviewBootstrap: () => ({ documents: [] }),
      project: (task, session, summary) => new IncrementalBuildService(new MemoryIncrementalBuildRepository()).project(task, session, summary),
      listMyGenerations: (session, params, state) => {
        generationCall = { session, params, state };
        if (generationFailure) throw generationFailure;
        return { items: [{ id: 'generation-1' }] };
      },
    } };
    const handler = createKnowledgeCenterHandler({
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, KNOWLEDGE_CENTER_ENTRY: 'index.html',
        OUTLINE_TEMPLATE_PATH: path.join(root, 'template.xlsx'), OUTLINE_SAMPLE_PATH: path.join(root, 'sample.xlsx'),
        PINGCODE_PREFIX: '/pingcode', PINGCODE_ROOT: root, GITLAB_CONFIG_PATH: path.join(root, 'gitlab.json'),
        GITLAB_DOCUMENT_TYPES_PATH: path.join(root, 'rules.json') },
      stores: {
        knowledgeAssetsStore: { readAsync: async () => ({ handbooks: reviewTasks.length ? [{ handbookId: 'HB-1', name: '测试手册' }] : [] }), read: () => ({ handbooks: reviewTasks.length ? [{ handbookId: 'HB-1', name: '测试手册' }] : [] }) },
        manualStatusStore: { read: () => ({ statuses: {} }) }, brandIconStore: {},
        domainStore: { readPrincipalsAsync: async () => ({ items: users.map(user => ({ id: user.principalId, displayName: user.displayName })) }) },
      },
      documentTasksOptions: { filePath: path.join(root, 'tasks.json'), defaultOwnerId: 'admin' },
      moduleRegistry: { get: name => name === 'auth' ? {
        authorize: async req => req.headers['x-test-user'] === 'guest'
          ? { user: users[1], allowedActions: ['knowledge:read'] }
          : { user: users[0], allowedActions: ['platform:manage', 'knowledge:read', ...(req.headers['x-test-user'] === 'admin-no-publish' ? [] : ['publish:manage'])] },
        repository: { listUsers: async () => users },
      } : null },
      sendFile(_file, res) { res.writeHead(404); res.end(); },
      proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {},
      handleIncrementalBuild: incremental,
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

  test.each(['ticket', 'handbook'])('漏报文档的%s级纠偏仍阻断审核决定', async level => {
    const state = JSON.parse(fs.readFileSync(path.join(root, 'tasks.json'), 'utf8'));
    state.tasks[0].decomposition = { confirmed: true, ticketImpact: 'involved', handbooks: [{
      id: 'HB-1', confirmed: true, ownerId: 'admin', documents: [{ id: 'doc-1', reviewTaskId: 'review-task' }],
    }] };
    state.tasks[0].scopeChanges = [{ status: 'reported', level, handbookId: level === 'handbook' ? 'HB-1' : null, affectedDocuments: [] }];
    fs.writeFileSync(path.join(root, 'tasks.json'), JSON.stringify(state));
    reviewTasks.push({ id: 'review-task', handbookId: 'HB-1', state: 'under_review' });
    const endpoint = base.replace('/api/workbench', '/api/incremental-tasks/review-task/reviews/review-1/decision');
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decision: 'approved' }) });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: 'SCOPE_BLOCKED' } });
  });

  test('本人生成记录读取透传会话、筛选和快照，并映射服务错误', async () => {
    reviewTasks.push({ id: 'task-1' });
    const endpoint = base.replace('/api/workbench', '/api/production/generations');
    const response = await fetch(`${endpoint}?scope=mine&page=2`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, data: { items: [{ id: 'generation-1' }] } });
    expect(generationCall).toMatchObject({ session: { user: { id: 'auth-admin' } },
      params: { scope: 'mine', page: '2' }, state: { tasks: [{ id: 'task-1' }] } });

    generationFailure = Object.assign(new Error('无权读取其他人的生成记录'), { code: 'GENERATION_FORBIDDEN', status: 403 });
    const forbidden = await fetch(`${endpoint}?userId=other`);
    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toMatchObject({ error: { code: 'GENERATION_FORBIDDEN' } });

    incremental.service = null;
    const unavailable = await fetch(endpoint);
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toMatchObject({ error: { code: 'GENERATION_SERVICE_UNAVAILABLE' } });
  });

  test.each([
    ['文档不属于候选', { documentId: 'unknown' }, '文档不属于当前审核候选'],
    ['路径不属于候选', { path: 'docs/unknown.md' }, '文档路径不属于当前审核候选'],
    ['文档与路径来自不同操作', { documentId: 'doc-a', path: 'docs/b.md' }, '文档标识与仓库路径不匹配'],
  ])('真实审核上下文拒绝%s且存储不变', async (_name, context, message) => {
    const task = { id: 'context-task', handbookId: 'HB-1', state: 'under_review', createdBy: { id: 'auth-admin' },
      createdAt: '2026-01-01', updatedAt: '2026-01-01', reviews: [],
      target: { documentIds: ['doc-a', 'doc-b'], documentPaths: ['docs/a.md', 'docs/b.md'] },
      candidate: { id: 'candidate', digest: 'digest', operations: [
        { id: 'op-a', documentId: 'doc-a', path: 'docs/a.md', type: 'update' },
        { id: 'op-b', documentId: 'doc-b', path: 'docs/b.md', type: 'update' },
      ] } };
    reviewTasks.push(task);
    const repository = new MemoryIncrementalBuildRepository({ tasks: [task], publishedVersions: [], audits: [], idempotency: {} });
    incremental.service = new IncrementalBuildService(repository);
    const before = repository.read();
    const endpoint = base.replace('/api/workbench', '/api/review/bootstrap');
    const params = new URLSearchParams({ handbookId: 'HB-1', taskId: task.id, ...context });
    const response = await fetch(`${endpoint}?${params}`);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ success: false, error: { code: 'REVIEW_DOCUMENT_MISMATCH', message } });
    expect(repository.read()).toEqual(before);
  });

  test('责任人目录隐藏停用人员并拒绝非管理员', async () => {
    expect((await fetch(`${base}/responsibles`, { headers: { 'x-test-user': 'guest' } })).status).toBe(403);
    const response = await fetch(`${base}/responsibles`);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([
      { id: 'admin', displayName: '管理员' }, { id: 'writer', displayName: '撰写人' },
    ]);
  });

  test.each([
    ['字符串', 'draft-string', { id: 'draft-string' }],
    ['数字', 42, { id: '42' }],
    ['id', { id: 'draft-id', editVersion: 0, privatePrompt: 'secret' }, { id: 'draft-id', editVersion: 0 }],
    ['draftId', { draftId: 'legacy-draft' }, { id: 'legacy-draft' }],
    ['versionId', { versionId: 'version-1' }, { id: 'version-1' }],
    ['ref', { ref: 'ref-1' }, { id: 'ref-1' }],
    ['空对象', {}, { editVersion: 3 }],
    ['缺少引用', null, { editVersion: 3 }],
  ])('本人生成记录通过真实服务规范化%s草稿引用', async (_name, draftRef, expected) => {
    const state = { tasks: [{ id: 'generation-task', handbookId: 'HB-1', name: '隔离生成', state: 'editing',
      createdBy: { id: 'auth-admin' }, reviews: [], draft: { editVersion: 3 },
      generationRun: { id: 'generation-real', status: 'failed', initiatedBy: { id: 'auth-admin', name: '管理员' },
        participants: [null, '', { userId: 'writer', name: '撰写人', accessToken: 'private-token' }, 7],
        draftRef, progress: 'invalid-progress', resultSummary: { text: '等待重试', privatePrompt: 'private-prompt' },
        error: { message: '隔离执行失败', accessToken: 'private-token' }, privatePrompt: 'private-prompt',
        updatedAt: '2026-11-10T00:00:00Z' },
    }], publishedVersions: [], audits: [], idempotency: {} };
    const repository = new MemoryIncrementalBuildRepository(state);
    incremental.service = new IncrementalBuildService(repository);
    const before = repository.read();
    const endpoint = base.replace('/api/workbench', '/api/production/generations');
    const response = await fetch(`${endpoint}?scope=mine`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.items).toEqual([expect.objectContaining({ generationId: 'generation-real', taskId: 'generation-task',
      association: 'initiator', draftRef: expected, progress: null, statusDisplayName: '生成失败',
      resultSummary: '等待重试', failureReason: '隔离执行失败', initiatedBy: { id: 'auth-admin', displayName: '管理员' },
      participants: [{ id: 'writer', displayName: '撰写人' }, { id: '7' }],
      nextAction: { type: 'open_generation', label: '查看失败原因', href: expect.stringContaining('taskId=generation-task') },
    })]);
    expect(JSON.stringify(body)).not.toMatch(/private-token|private-prompt|privatePrompt|accessToken/);
    expect(repository.read()).toEqual(before);
    for (const [params, code] of [['scope=all', 'GENERATION_SCOPE_INVALID'], ['userId=writer', 'GENERATION_USER_FILTER_FORBIDDEN']]) {
      const rejected = await fetch(`${endpoint}?${params}`);
      expect(rejected.status).toBe(422);
      expect(await rejected.json()).toMatchObject({ error: { code } });
      expect(repository.read()).toEqual(before);
    }
  });

  test('本人生成按实际关联筛选兼容运行字段并按更新时间排序', async () => {
    const task = { id: 'generation-task', handbookId: 'HB-1', title: '兼容生成', state: 'editing', createdBy: { id: 'auth-admin' }, reviews: [],
      generationRuns: [
        { runId: 'fallback', status: 'custom', progress: '12', resultSummary: '等待结果', failureReason: '兼容原因', updatedAt: '2026-11-10T01:00:00Z' },
        { id: 'participant', status: 'completed', createdBy: 'someone-else', participants: ['auth-admin'], resultSummary: { text: '完成' }, updatedAt: '2026-11-10T03:00:00Z' },
        { generationId: 'initiator', status: 'running', startedBy: { principalId: 'auth-admin' }, startedAt: '2026-11-10T02:00:00Z' },
        { id: 'unrelated', status: 'completed', initiatedBy: 'someone-else', updatedAt: '2026-11-10T05:00:00Z' },
        { status: 'completed', updatedAt: '2026-11-10T06:00:00Z' },
      ] };
    const repository = new MemoryIncrementalBuildRepository({ tasks: [task], publishedVersions: [], audits: [], idempotency: {} });
    incremental.service = new IncrementalBuildService(repository);
    const response = await fetch(base.replace('/api/workbench', '/api/production/generations'));
    expect(response.status).toBe(200);
    const items = (await response.json()).data.items;
    expect(items.map(item => item.generationId)).toEqual(['participant', 'initiator', 'fallback']);
    expect(items.map(item => item.association)).toEqual(['participant', 'initiator', 'task_creator_fallback']);
    expect(items[0]).toMatchObject({ draftRef: null, resultSummary: '完成', nextAction: { label: '查看生成结果' } });
    expect(items[1]).toMatchObject({ initiatedBy: { id: 'auth-admin' }, nextAction: { label: '查看生成进度' } });
    expect(items[2]).toMatchObject({ taskName: '兼容生成', handbookName: 'HB-1', progress: 12, resultSummary: '等待结果', failureReason: '兼容原因', statusDisplayName: '状态待确认' });
    expect(repository.read().audits).toEqual([]);
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
    expect(projected.items[0]).toMatchObject({ id: 'ticket:WB-100:scope', title: '确认 WB-100 的手册范围' });
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

  test('MR 工作项按提交人和合入负责人区分动作，关闭后由提交人修订', async () => {
    const mr = { iid: 73, state: 'opened', webUrl: 'https://git.example.test/project/-/merge_requests/73', participants: { assignees: [{ platformId: 'writer' }] } };
    reviewTasks.push({ id: 'delivery-1', handbookId: 'HB-1', name: '测试交付', state: 'mr_submitted', createdBy: { id: 'admin' },
      candidate: { digest: 'digest-1', operations: [] }, reviews: [], businessVersion: '23.4',
      handbookSource: { branch: 'release', documents: [{ documentId: 'doc-1', title: '数值型', filePath: 'docs/number.md' }, { documentId: 'doc-2', title: '字符型', filePath: 'docs/char.md' }] }, mergeRequest: mr,
      deliveryObservation: { state: 'opened' }, createdAt: '2026-11-09T00:00:00Z' });
    const body = { queue: 'actionable', type: 'merge', page: 1, pageSize: 20 };
    const owner = (await (await query({ ...body, responsibleId: 'admin' })).json()).data.items;
    const assignee = (await (await query({ ...body, responsibleId: 'writer' })).json()).data.items;
    expect(owner.filter(item => item.id.startsWith('delivery:'))).toHaveLength(1);
    expect(assignee.filter(item => item.id.startsWith('merge:'))).toHaveLength(1);
    expect(owner.find(item => item.id.startsWith('delivery:'))?.primaryAction).toMatchObject({ code: 'sync_delivery', label: '同步状态', taskId: 'delivery-1', candidateDigest: 'digest-1', enabled: true });
    expect(assignee.find(item => item.id.startsWith('merge:'))?.primaryAction).toMatchObject({ code: 'merge_mr', label: '合入MR', external: true, enabled: false });
    expect(assignee.some(item => item.primaryAction?.code === 'sync_delivery')).toBe(false);
    process.env.KNOWLEDGE_CENTER_LOCAL_OWNER_PREVIEW = '1';
    const preview = (await (await fetch(`${base}/preview?responsibleId=writer`)).json()).data.items;
    expect(preview.every(item => item.url === undefined && item.primaryAction === undefined)).toBe(true);
    reviewTasks[0].deliveryObservation.state = 'closed';
    expect((await (await query({ ...body, responsibleId: 'writer' })).json()).data.items.some(item => item.primaryAction?.code === 'merge_mr')).toBe(false);
    const recoveryQuery = { ...body, type: 'document' };
    expect((await (await query({ ...recoveryQuery, responsibleId: 'admin' })).json()).data.items.find(item => item.id.startsWith('delivery:'))?.primaryAction).toMatchObject({ code: 'revise_document', label: '修订文档' });
    expect((await (await query({ ...body, responsibleId: 'admin' })).json()).data.items.some(item => item.id.startsWith('delivery:'))).toBe(false);
    const limited = (await (await query({ ...recoveryQuery, responsibleId: 'admin' }, { 'x-test-user': 'admin-no-publish' })).json()).data.items;
    expect(limited.find(item => item.id.startsWith('delivery:'))?.primaryAction.enabled).toBe(false);
    reviewTasks[0].state = 'approved';
    reviewTasks[0].mergeRequest = null;
    reviewTasks[0].deliveryObservation = null;
    expect((await (await query({ ...body, responsibleId: 'admin' })).json()).data.items.find(item => item.id.startsWith('delivery:'))?.primaryAction).toMatchObject({ code: 'create_mr', label: '创建MR' });

    reviewTasks.push({ id: 'safe-url', handbookId: 'HB-1', state: 'mr_submitted', createdBy: { id: 'admin' },
      handbookSource: { documents: [{ documentId: 'safe-doc', title: '安全链接', filePath: 'docs/safe.md' }] },
      mergeRequest: { iid: 72, state: 'opened', webUrl: 'https://git.example.test/project/-/merge_requests/72', participants: { assignees: [{ platformId: 'writer' }] } },
    });
    for (const [id, webUrl] of [['bad-url', 'not a url'], ['http-url', 'http://git.example.test/project/-/merge_requests/74'], ['credentials-url', 'https://user:pass@git.example.test/project/-/merge_requests/75']]) {
      reviewTasks.push({ id, handbookId: 'HB-1', state: 'mr_submitted', createdBy: { id: 'admin' },
        handbookSource: { documents: [{ documentId: `${id}-doc`, title: id, filePath: `docs/${id}.md` }] },
        mergeRequest: { iid: id, state: 'opened', webUrl, participants: { assignees: [{ platformId: 'writer' }] } },
      });
    }
    const safeItems = (await (await query({ ...body, responsibleId: 'writer' })).json()).data.items;
    expect(safeItems.filter(item => item.id.startsWith('merge:')).map(item => item.id)).toEqual(['merge:safe-url:72']);
  });

  test('损坏的任务来源仍返回部分可用结果和来源标记', async () => {
    fs.writeFileSync(path.join(root, 'tasks.json'), '{broken');
    const response = await query({ queue: 'actionable', page: 1, pageSize: 20 });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ completeness: 'partial', unavailable: ['任务管理'], total: 0 });
  });

  test('审核文档加入工作台并在审核服务失败时标记部分可用', async () => {
    reviewTasks.push({ id: 'review-task', handbookId: 'HB-1' });
    incremental.service.reviewBootstrap = () => ({ documents: [{
      taskId: 'review-task', reviewId: 'review-1', documentId: 'doc-1', handbookId: 'HB-1',
      assignedToMe: true, title: '审核文档', businessVersion: '1.0', submittedAt: '2026-11-10T00:00:00Z',
    }] });
    const response = await query({ responsibleId: 'admin', queue: 'actionable', page: 1, pageSize: 20 });
    expect(response.status).toBe(200);
    expect((await response.json()).data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'review:review-task:review-1:doc-1', taskType: '文档审核', status: '待审核', source: '审核与发布' }),
    ]));

    incremental.service.reviewBootstrap = () => { throw new Error('审核服务暂不可用'); };
    const degraded = await query({ responsibleId: 'admin', queue: 'actionable', page: 1, pageSize: 20 });
    expect(degraded.status).toBe(200);
    expect((await degraded.json()).data).toMatchObject({ completeness: 'partial', unavailable: ['审核与发布'] });
  });
});
