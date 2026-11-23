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

  test('工作台范围入口只打开任务详情，按钮显示查看', async () => {
    const response = await query({ responsibleId: 'writer', queue: 'actionable', page: 1, pageSize: 20 });
    expect(response.status).toBe(200);
    expect((await response.json()).data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ primaryAction: expect.objectContaining({ code: 'confirm_scope', label: '查看', url: expect.stringContaining('/knowledge-center/document-tasks?task=WB-100') }) }),
    ]));
  });

  test('工作台为范围、完成、创建、编写和等待任务投影对应操作', async () => {
    const state = JSON.parse(fs.readFileSync(path.join(root, 'tasks.json'), 'utf8'));
    const task = (number, ownerId, decomposition) => ({ number, description: `${number} 投影场景`, ownerId, decomposition,
      source: {}, createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-10T00:00:00Z' });
    state.tasks.push(
      task('WB-101', 'writer', { confirmed: true, ticketImpact: 'not_involved', ticketReason: '无文档影响', handbooks: [] }),
      task('WB-102', 'admin', { confirmed: true, ticketImpact: 'involved', handbooks: [
        { id: 'HB-1', name: '待确认手册', ownerId: 'writer', confirmed: false, documents: [] },
      ] }),
      task('WB-103', 'admin', { confirmed: true, ticketImpact: 'involved', handbooks: [
        { id: 'HB-1', name: '新增文档手册', ownerId: 'writer', confirmed: true, impact: 'involved', targetVersion: '23.4.3', documents: [
          { id: 'new-doc', name: '新增说明', kind: 'new', ownerId: 'writer' },
        ] },
      ] }),
      task('WB-104', 'admin', { confirmed: true, ticketImpact: 'involved', handbooks: [
        { id: 'HB-1', name: '编写手册', ownerId: 'writer', confirmed: true, impact: 'involved', targetVersion: '23.4.3', documents: [
          { id: 'existing-doc', name: '现存说明', kind: 'existing', ownerId: 'writer' },
        ] },
      ] }),
      task('WB-105', 'admin', { confirmed: true, ticketImpact: 'involved', handbooks: [
        { id: 'HB-1', name: '等待手册', ownerId: 'writer', confirmed: true, impact: 'involved', documents: [
          { id: 'waiting-doc', name: '等待编写', kind: 'existing', ownerId: 'admin' },
        ] },
      ] }),
    );
    fs.writeFileSync(path.join(root, 'tasks.json'), JSON.stringify(state));
    reviewTasks.push({ id: 'visible-handbook-context', handbookId: 'HB-1' });

    const response = await query({ responsibleId: 'writer', queue: 'actionable', page: 1, pageSize: 20 });
    expect(response.status).toBe(200);
    const data = (await response.json()).data;
    const items = Object.fromEntries(data.items.map(item => [item.number, item]));
    expect(items['WB-100'].primaryAction).toMatchObject({ code: 'confirm_scope', label: '查看' });
    expect(items['WB-101'].primaryAction).toMatchObject({ code: 'complete_scope', label: '查看' });
    expect(items['WB-102'].primaryAction).toMatchObject({ code: 'confirm_scope', label: '查看' });
    expect(items['WB-103'].primaryAction).toMatchObject({ code: 'create_document', label: '查看' });
    expect(items['WB-103'].primaryAction.url).toContain('action=new-document');
    expect(items['WB-104'].primaryAction).toMatchObject({ code: 'write_document', label: '进入编写' });
    const waitingResponse = await query({ responsibleId: 'writer', queue: 'waiting', page: 1, pageSize: 20 });
    expect(waitingResponse.status).toBe(200);
    const waitingItems = (await waitingResponse.json()).data.items;
    expect(waitingItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ number: 'WB-105', title: '等待编写', primaryAction: { code: 'view_progress', label: '查看进度', url: expect.any(String) } }),
    ]));
  });

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

  test('责任人目录兼容 userId/loginName 并排除没有身份标识的账号', async () => {
    users.push({ userId: 'legacy-user', loginName: 'legacy-login' }, { displayName: '无身份账号' });
    try {
      const response = await fetch(base + '/responsibles');
      expect(response.status).toBe(200);
      expect((await response.json()).data).toEqual([
        { id: 'admin', displayName: '管理员' },
        { id: 'writer', displayName: '撰写人' },
        { id: 'legacy-user', displayName: 'legacy-login' },
      ]);
    } finally {
      users.splice(-2);
    }
  });

  test('增量审核测试夹具路由在实例开关关闭时不可用', async () => {
    const previousFlag = process.env.KNOWLEDGE_CENTER_ENABLE_E2E_FIXTURES;
    delete process.env.KNOWLEDGE_CENTER_ENABLE_E2E_FIXTURES;
    try {
      for (const route of ['/test-fixtures/incremental-baselines', '/test-fixtures/incremental-tasks']) {
        const methodMismatch = await fetch(base.replace('/workbench', route));
        expect(methodMismatch.status).toBe(404);
        expect(await methodMismatch.json()).toMatchObject({ success: false, error: { code: 'API_NOT_FOUND' } });
        const response = await fetch(base.replace('/workbench', route), {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fixture: true }),
        });
        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({ success: false, error: { code: 'ROUTE_NOT_FOUND' } });
      }
    } finally {
      if (previousFlag === undefined) delete process.env.KNOWLEDGE_CENTER_ENABLE_E2E_FIXTURES;
      else process.env.KNOWLEDGE_CENTER_ENABLE_E2E_FIXTURES = previousFlag;
    }
  });

  test('测试实例夹具路由传递服务输入并映射创建失败', async () => {
    const previousFlag = process.env.KNOWLEDGE_CENTER_ENABLE_E2E_FIXTURES;
    process.env.KNOWLEDGE_CENTER_ENABLE_E2E_FIXTURES = '1';
    const baselineInput = { seen: null };
    const taskInput = { seen: null };
    incremental.service.createSyntheticBaseline = (session, key, body) => {
      baselineInput.seen = { session, key, body };
      return { baselineId: 'baseline-1' };
    };
    incremental.service.create = (session, key, body) => {
      taskInput.seen = { session, key, body };
      return { taskId: 'task-1' };
    };
    const postFixture = (route, key, body) => fetch(base.replace('/workbench', route), {
      method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify(body),
    });
    try {
      const baselineBody = { handbookId: 'HB-1', baseRef: 'release' };
      const baseline = await postFixture('/test-fixtures/incremental-baselines', 'baseline-key', baselineBody);
      expect(baseline.status).toBe(201);
      expect(baseline.headers.get('x-content-type-options')).toBe('nosniff');
      await expect(baseline.json()).resolves.toMatchObject({ success: true, data: { baselineId: 'baseline-1' } });
      expect(baselineInput.seen).toMatchObject({ session: { user: { id: 'auth-admin' } }, key: 'baseline-key', body: baselineBody });

      const taskBody = { handbookId: 'HB-1', baseRef: 'release', documents: ['doc-1'] };
      const task = await postFixture('/test-fixtures/incremental-tasks', 'task-key', taskBody);
      expect(task.status).toBe(201);
      await expect(task.json()).resolves.toMatchObject({ success: true, data: { taskId: 'task-1' } });
      expect(taskInput.seen).toMatchObject({ session: { user: { id: 'auth-admin' } }, key: 'task-key', body: taskBody });

      incremental.service.createSyntheticBaseline = () => { throw Object.assign(new Error('基线冲突'), { status: 409, code: 'BASELINE_CONFLICT' }); };
      const conflict = await postFixture('/test-fixtures/incremental-baselines', 'conflict-key', baselineBody);
      expect(conflict.status).toBe(409);
      await expect(conflict.json()).resolves.toMatchObject({ success: false, error: { code: 'BASELINE_CONFLICT', message: '基线冲突' } });

      incremental.service.createSyntheticBaseline = () => { throw new Error(''); };
      const baselineFailed = await postFixture('/test-fixtures/incremental-baselines', 'failed-baseline-key', baselineBody);
      expect(baselineFailed.status).toBe(500);
      await expect(baselineFailed.json()).resolves.toMatchObject({ success: false, error: { code: 'TEST_FIXTURE_FAILED', message: '测试夹具创建失败' } });

      incremental.service.create = () => { throw new Error(''); };
      const failed = await postFixture('/test-fixtures/incremental-tasks', 'failed-key', taskBody);
      expect(failed.status).toBe(500);
      await expect(failed.json()).resolves.toMatchObject({ success: false, error: { code: 'TEST_FIXTURE_FAILED', message: '测试夹具创建失败' } });

      incremental.service = null;
      for (const [route, key, body] of [
        ['/test-fixtures/incremental-baselines', 'unavailable-baseline-key', baselineBody],
        ['/test-fixtures/incremental-tasks', 'unavailable-task-key', taskBody],
      ]) {
        const unavailable = await postFixture(route, key, body);
        expect(unavailable.status).toBe(503);
        await expect(unavailable.json()).resolves.toMatchObject({ success: false, error: { code: 'TEST_FIXTURE_FAILED', message: '增量审核服务暂不可用' } });
      }
    } finally {
      if (previousFlag === undefined) delete process.env.KNOWLEDGE_CENTER_ENABLE_E2E_FIXTURES;
      else process.env.KNOWLEDGE_CENTER_ENABLE_E2E_FIXTURES = previousFlag;
    }
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

  test('正式工作台投影审核、交付能力和安全 MR 链接', async () => {
    const assignedDocuments = [
      { taskId: 'review-1', reviewId: 'review-1a', documentId: 'doc-1', handbookId: 'HB-1', assignedToMe: true, title: '已分配审核' },
      { taskId: 'review-other', reviewId: 'review-other-a', documentId: 'doc-2', handbookId: 'HB-1', assignedToMe: false },
      { taskId: 'review-hidden', reviewId: 'review-hidden-a', documentId: 'doc-3', handbookId: 'HB-HIDDEN', assignedToMe: true },
    ];
    const deliveryTask = (id, deliveryObservation, state = 'editing', webUrl) => ({
      id, name: id, handbookId: 'HB-1', state, createdBy: { id: 'auth-writer' },
      handbookSource: { documents: [{ documentId: `${id}-doc`, title: `${id} 文档`, filePath: `docs/${id}.md` }] },
      deliveryObservation, mergeRequest: webUrl ? { iid: '12', webUrl, state: 'opened', participants: { assignees: [{ platformId: 'writer' }] } } : undefined,
      createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-11T00:00:00Z',
    });
    reviewTasks.push(
      deliveryTask('delivery-close', { state: 'closed' }),
      deliveryTask('delivery-publish', { state: 'pending' }),
      deliveryTask('delivery-refresh', { state: 'pending' }),
      deliveryTask('delivery-none', { state: 'pending' }),
      deliveryTask('merge-valid', { state: 'opened' }, 'mr_submitted', 'https://gitlab.example/project/-/merge_requests/12'),
      deliveryTask('merge-http', { state: 'opened' }, 'mr_submitted', 'http://gitlab.example/project/-/merge_requests/13'),
      deliveryTask('merge-credentials', { state: 'opened' }, 'mr_submitted', 'https://user:secret@gitlab.example/project/-/merge_requests/14'),
    );
    incremental.service.readState = async () => ({ tasks: reviewTasks });
    incremental.service.reviewBootstrap = () => ({ documents: assignedDocuments });
    incremental.service.project = task => ({
      completion: { label: '进行中', facts: { mergeState: null, markdownReadback: null, resourceReadback: null } },
      capabilities: {
        canPublish: task.id === 'delivery-publish',
        canRefreshDelivery: task.id === 'delivery-refresh',
      },
    });

    const response = await fetch(`${base}/delegated?responsibleId=writer`);
    expect(response.status).toBe(200);
    const data = (await response.json()).data;
    const items = Object.fromEntries(data.items.map(item => [item.id, item]));
    expect(items['review:review-1:review-1a:doc-1']).toMatchObject({ kind: 'review', primaryAction: { code: 'review_document', label: '查看审核' } });
    expect(items['review:review-other:review-other-a:doc-2']).toBeUndefined();
    expect(items['review:review-hidden:review-hidden-a:doc-3']).toBeUndefined();
    expect(items['delivery:delivery-close'].primaryAction).toMatchObject({ code: 'revise_document', enabled: false });
    expect(items['delivery:delivery-publish'].primaryAction).toMatchObject({ code: 'create_mr', enabled: true });
    expect(items['delivery:delivery-refresh'].primaryAction).toMatchObject({ code: 'sync_delivery', taskId: 'delivery-refresh' });
    expect(items['delivery:delivery-none']).toBeUndefined();
    expect(items['merge:merge-valid:12']).toMatchObject({ external: true, primaryAction: { code: 'merge_mr', external: true, enabled: false } });
    expect(items['merge:merge-http:12']).toBeUndefined();
    expect(items['merge:merge-credentials:12']).toBeUndefined();
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
    expect(owner.find(item => item.id.startsWith('delivery:'))?.primaryAction).toMatchObject({ code: 'sync_delivery', label: '状态刷新', taskId: 'delivery-1', candidateDigest: 'digest-1', enabled: true });
    expect(assignee.find(item => item.id.startsWith('merge:'))?.primaryAction).toMatchObject({ code: 'merge_mr', label: 'MR链接', external: true, enabled: false });
    expect(assignee.some(item => item.primaryAction?.code === 'sync_delivery')).toBe(false);
    process.env.KNOWLEDGE_CENTER_LOCAL_OWNER_PREVIEW = '1';
    const preview = (await (await fetch(`${base}/preview?responsibleId=writer`)).json()).data.items;
    expect(preview.every(item => item.url === undefined && item.primaryAction === undefined)).toBe(true);
    reviewTasks[0].deliveryObservation.state = 'closed';
    expect((await (await query({ ...body, responsibleId: 'writer' })).json()).data.items.some(item => item.primaryAction?.code === 'merge_mr')).toBe(false);
    const recoveryQuery = { ...body, type: 'document' };
    expect((await (await query({ ...recoveryQuery, responsibleId: 'admin' })).json()).data.items.find(item => item.id.startsWith('delivery:'))?.primaryAction).toMatchObject({ code: 'revise_document', label: '查看审核' });
    expect((await (await query({ ...body, responsibleId: 'admin' })).json()).data.items.some(item => item.id.startsWith('delivery:'))).toBe(false);
    const limited = (await (await query({ ...recoveryQuery, responsibleId: 'admin' }, { 'x-test-user': 'admin-no-publish' })).json()).data.items;
    expect(limited.find(item => item.id.startsWith('delivery:'))?.primaryAction.enabled).toBe(false);
    reviewTasks[0].state = 'approved';
    reviewTasks[0].mergeRequest = null;
    reviewTasks[0].deliveryObservation = null;
    expect((await (await query({ ...body, responsibleId: 'admin' })).json()).data.items.find(item => item.id.startsWith('delivery:'))?.primaryAction).toMatchObject({ code: 'create_mr', label: '创建 MR' });

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
      assignedToMe: true, title: '审核文档', path: 'docs/23.4.3/guide/审核文档.md', businessVersion: '1.0', submittedAt: '2026-11-10T00:00:00Z',
    }] });
    const response = await query({ responsibleId: 'admin', queue: 'actionable', page: 1, pageSize: 20 });
    expect(response.status).toBe(200);
    expect((await response.json()).data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'review:review-task:review-1:doc-1', taskType: '文档审核', status: '待审核', source: '审核与发布', lineage: expect.objectContaining({ documentName: '审核文档', documentPath: 'docs/23.4.3/guide/审核文档.md' }), primaryAction: expect.objectContaining({ code: 'review_document', label: '查看审核' }) }),
    ]));

    incremental.service.reviewBootstrap = () => { throw new Error('审核服务暂不可用'); };
    const degraded = await query({ responsibleId: 'admin', queue: 'actionable', page: 1, pageSize: 20 });
    expect(degraded.status).toBe(200);
    expect((await degraded.json()).data).toMatchObject({ completeness: 'partial', unavailable: ['审核与发布'] });
  });
});
