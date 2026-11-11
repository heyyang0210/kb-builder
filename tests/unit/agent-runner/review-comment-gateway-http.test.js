const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');

describe('审核意见可信提及网关真实HTTP契约', () => {
  let root, taskFile, server, base, state, session, service, dispatch, originalEnv;
  const runtime = path.resolve(__dirname, '../../../runtime/test-results');
  const route = '/incremental-tasks/task%20one/reviews/review%20one/comments';
  beforeEach(() => {
    originalEnv = [process.env.KNOWLEDGE_STORAGE_MODE, process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE];
    process.env.KNOWLEDGE_STORAGE_MODE = 'file'; process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE = 'file';
    fs.mkdirSync(runtime, { recursive: true });
    root = fs.mkdtempSync(path.join(runtime, 'review-comment-gateway-'));
    taskFile = path.join(root, 'tasks.json');
    state = { schemaVersion: 2, revision: 0, tasks: [{ number: 'ticket', decomposition: { handbooks: [{
      id: 'book', name: '数据库管理', ownerId: 'trusted-owner', confirmed: true, impact: 'involved',
      documents: [{ id: 'doc', reviewTaskId: 'review one' }]
    }] } }], audits: [], idempotency: {} };
    session = { authenticated: true, user: { id: 'reviewer' }, allowedActions: ['knowledge:read', 'review:write'], visibleHandbookIds: ['book'] };
    service = { commentOnReview: jest.fn(() => ({ id: 'comment', saved: true })) };
    dispatch = jest.fn((_req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: true, data: 'delegated' })); });
  });
  afterEach(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); server = null; }
    fs.rmSync(root, { recursive: true, force: true });
    ['KNOWLEDGE_STORAGE_MODE', 'KNOWLEDGE_PLATFORM_CONFIG_MODE'].forEach((key, index) => {
      if (originalEnv[index] === undefined) delete process.env[key]; else process.env[key] = originalEnv[index];
    });
  });
  async function start() {
    fs.writeFileSync(taskFile, JSON.stringify(state));
    const workbook = path.join(root, 'fixture.xlsx');
    fs.writeFileSync(workbook, 'isolated workbook fixture');
    dispatch.service = service;
    const handler = createKnowledgeCenterHandler({
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, KNOWLEDGE_CENTER_ENTRY: 'index.html', GITLAB_CONFIG_PATH: path.join(root, 'gitlab.json'), OUTLINE_TEMPLATE_PATH: workbook, OUTLINE_SAMPLE_PATH: workbook },
      stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [{ handbookId: 'book', name: '数据库管理' }] }) }, domainStore: {}, manualStatusStore: {}, brandIconStore: {} },
      moduleRegistry: { get: name => name === 'auth' ? { authorize: () => session } : null },
      handbookProductionService: {}, documentTasksOptions: { filePath: taskFile },
      handleIncrementalBuild: dispatch,
      sendFile: (_file, res) => { res.writeHead(404); res.end(); },
    });
    server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/knowledge-center/api`;
  }
  async function post(body = { content: '请核对权限' }, key = 'comment-key', target = route) {
    const response = await fetch(base + target, { method: 'POST', headers: {
      'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {})
    }, body: JSON.stringify(body) });
    return { status: response.status, cache: response.headers.get('cache-control'), ...await response.json() };
  }
  async function rejected(body, status, code, key) {
    const before = fs.readFileSync(taskFile, 'utf8');
    const response = await post(body, key);
    expect(response).toMatchObject({ status, cache: 'no-store', success: false, ...(code ? { error: { code } } : {}) });
    expect(service.commentOnReview).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(fs.readFileSync(taskFile, 'utf8')).toBe(before);
    return response;
  }

  test('服务不可用时返回503而不转发未知请求', async () => {
    service.commentOnReview = undefined;
    await start();
    expect(await post()).toMatchObject({ status: 503, success: false, error: { message: '审核服务暂不可用' } });
    expect(dispatch).not.toHaveBeenCalled();
  });
  test('缺幂等键拒绝提交', async () => {
    await start(); await rejected({ content: '说明' }, 400, 'IDEMPOTENCY_KEY_REQUIRED', '');
  });
  test('无提及时只传空可信列表，解码任务和审核ID', async () => {
    await start();
    const body = { content: '核对内容', mentions: 'invalid' };
    expect(await post(body)).toMatchObject({ status: 200, success: true, data: { id: 'comment', saved: true } });
    expect(service.commentOnReview).toHaveBeenCalledWith(session, 'task one', 'review one', 'comment-key', body, { mentions: [] });
  });
  test('提及接收人和手册名只信任任务关联，忽略客户端伪造字段', async () => {
    await start();
    const body = { content: '请负责人核对', mentions: [{ handbookId: 'book', handbookName: '伪造手册', recipientId: 'attacker' }] };
    expect(await post(body)).toMatchObject({ status: 200, success: true });
    expect(service.commentOnReview).toHaveBeenCalledWith(session, 'task one', 'review one', 'comment-key', body,
      { mentions: [{ handbookId: 'book', handbookName: '数据库管理', recipientId: 'trusted-owner' }] });
    expect(JSON.parse(fs.readFileSync(taskFile, 'utf8'))).toEqual(state);
  });
  test.each([
    [[{ handbookId: 'book' }, { handbookId: 'book' }], 'MENTION_DUPLICATE'],
    [[null, {}], 'MENTION_DUPLICATE'],
    [[{ handbookId: 'missing' }], 'MENTION_SCOPE_INVALID'],
  ])('重复和无效范围提及拒绝 %#', async (mentions, code) => {
    await start(); await rejected({ mentions }, 422, code);
  });
  test.each(['unconfirmed', 'uninvolved', 'other-review', 'ambiguous', 'missing-owner'])('任务关联不满足可信提及条件 %s', async kind => {
    const book = state.tasks[0].decomposition.handbooks[0];
    if (kind === 'unconfirmed') book.confirmed = false;
    if (kind === 'uninvolved') book.impact = 'not_involved';
    if (kind === 'other-review') book.documents[0].reviewTaskId = 'different';
    if (kind === 'ambiguous') state.tasks.push(structuredClone(state.tasks[0]));
    if (kind === 'missing-owner') delete book.ownerId;
    await start();
    await rejected({ mentions: [{ handbookId: 'book' }] }, 422, kind === 'missing-owner' ? 'MENTION_RECIPIENT_MISSING' : 'MENTION_SCOPE_INVALID');
  });
  test.each(['visibility', 'action'])('不可读手册不能提及 %s', async kind => {
    if (kind === 'visibility') session.visibleHandbookIds = [];
    else session.allowedActions = ['review:write'];
    await start(); await rejected({ mentions: [{ handbookId: 'book' }] }, 403, 'HANDBOOK_READ_FORBIDDEN');
  });
  test('未登录意见提交401且无服务调用', async () => {
    session = null;
    await start(); await rejected({ content: '意见' }, 401);
  });
  test('范围纠偏阻止审核决定，解除后恢复转发', async () => {
    const task = state.tasks[0];
    task.decomposition.handbooks[0].documents[0].reviewTaskId = 'task one';
    task.scopeChanges = [{ status: 'reported', affectedDocuments: [{ handbookId: 'book', documentId: 'doc' }] }];
    await start();
    const target = '/incremental-tasks/task%20one/reviews/review%20one/decision';
    expect(await post({ decision: 'approved' }, 'key', target)).toMatchObject({ status: 409, error: { code: 'SCOPE_BLOCKED' } });
    expect(dispatch).not.toHaveBeenCalled();
    task.scopeChanges[0].status = 'cancelled';
    fs.writeFileSync(taskFile, JSON.stringify(state));
    expect(await post({ decision: 'approved' }, 'key', target)).toMatchObject({ status: 200, data: 'delegated' });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
