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
  async function get(target) {
    const response = await fetch(base + target);
    return { status: response.status, ...await response.json() };
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
      { mentions: [expect.objectContaining({ role: 'handbook_owner', handbookId: 'book', handbookName: '数据库管理', recipientId: 'trusted-owner' })] });
    expect(JSON.parse(fs.readFileSync(taskFile, 'utf8'))).toEqual(state);
  });
  test('首次责任人与平台负责人由服务端配置解析，伪造收件人无效', async () => {
    state.config = { knowledgeCenterOwnerId: 'platform-owner' };
    state.tasks[0].decomposition.handbooks[0].documents[0].firstAssignedOwnerId = 'first-owner';
    await start();
    const body = { content: '请核对', mentions: [
      { role: 'document_first_owner', handbookId: 'book', documentId: 'doc', recipientId: 'attacker' },
      { role: 'knowledge_center_owner', handbookId: 'book', recipientId: 'attacker' },
    ] };
    expect(await post(body)).toMatchObject({ status: 200, success: true });
    expect(service.commentOnReview.mock.calls[0][5].mentions).toEqual([
      expect.objectContaining({ role: 'document_first_owner', recipientId: 'first-owner', documentId: 'doc' }),
      expect.objectContaining({ role: 'knowledge_center_owner', recipientId: 'platform-owner' }),
    ]);
  });
  test('停用人员不能成为新意见收件人，失败时意见不写入', async () => {
    session.people = [{ id: 'trusted-owner', displayName: '手册负责人', state: 'INACTIVE' }];
    await start();
    await rejected({ content: '核对范围', mentions: [{ role: 'handbook_owner', handbookId: 'book' }] }, 422, 'MENTION_RECIPIENT_INACTIVE');
  });
  test('停用后历史提及保留姓名快照并标记人员已失效', async () => {
    session.people = [{ id: 'trusted-owner', displayName: '手册负责人', state: 'INACTIVE' }];
    service.listReviewComments = jest.fn(() => [{ id: 'old-comment', content: '核对范围', mentions: [{
      role: 'handbook_owner', handbookId: 'book', recipientId: 'trusted-owner', recipientName: '原手册负责人',
    }] }]);
    await start();
    const comments = await get(route);
    expect(comments).toMatchObject({ status: 200, success: true, data: [expect.objectContaining({
      id: 'old-comment', mentions: [expect.objectContaining({
        recipientId: 'trusted-owner', recipientName: '原手册负责人', disabled: true,
      })],
    })] });
  });
  test('再次提出范围意见只可关联已取消纠偏的已采纳意见', async () => {
    state.tasks[0].decomposition.confirmed = true;
    state.tasks[0].decomposition.handbooks[0].documents[0].reviewTaskId = 'task one';
    const previous = { id: 'old-comment', scopeOpinion: {
      level: 'handbook', status: 'accepted_pending_scope', ticketNumber: 'ticket', handbookId: 'book',
    } };
    service.get = jest.fn(() => ({ id: 'task one', handbookId: 'book' }));
    service.listReviewComments = jest.fn(() => [previous]);
    state.tasks[0].scopeChanges = [{ id: 'old-change', status: 'cancelled', sourceOpinion: {
      taskId: 'task one', reviewId: 'review one', commentId: previous.id,
    } }];
    await start();
    const body = { content: '重新核对文档范围', commentType: 'scope_opinion', scopeLevel: 'handbook',
      relatedOpinionId: previous.id };
    const accepted = await post(body, 'related-valid');
    expect(accepted).toMatchObject({ status: 200, success: true });
    expect(service.commentOnReview).toHaveBeenCalledWith(session, 'task one', 'review one', 'related-valid', body,
      expect.objectContaining({ scopeResponsibleId: 'trusted-owner' }));

    const stored = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
    stored.tasks[0].scopeChanges[0].status = 'reported';
    fs.writeFileSync(taskFile, JSON.stringify(stored));
    service.commentOnReview.mockClear();
    const denied = await post(body, 'related-invalid');
    expect(denied).toMatchObject({ status: 422, success: false, error: { code: 'RELATED_OPINION_INVALID' } });
    expect(service.commentOnReview).not.toHaveBeenCalled();
  });
  test('范围通知仅当前负责人可处理，改派与停用后保留旧通知但移除操作', async () => {
    session.user = { id: 'trusted-owner', principalId: 'trusted-owner' };
    session.allowedActions = ['knowledge:read', 'knowledge:write'];
    session.people = [{ id: 'trusted-owner', displayName: '原负责人', state: 'ACTIVE' },
      { id: 'new-owner', displayName: '新负责人', state: 'ACTIVE' }];
    state.tasks[0].ownerId = 'ticket-owner';
    state.tasks[0].decomposition.handbooks[0].documents[0].reviewTaskId = 'task one';
    const notice = { id: 'notice-1', type: 'review_scope_opinion', recipientId: 'trusted-owner',
      recipientName: '原负责人', taskId: 'task one', reviewId: 'review one', commentId: 'comment-1',
      ticketNumber: 'ticket', handbookId: 'book', status: 'inbox' };
    service.listNotifications = jest.fn(() => ({ items: [notice], unreadCount: 1 }));
    service.get = jest.fn(() => ({ id: 'task one', capabilities: { canComment: true } }));
    service.listReviewComments = jest.fn(() => [{ id: 'comment-1', scopeOpinion: { level: 'handbook', status: 'open' } }]);
    await start();
    const endpoint = '/incremental-tasks/notifications';
    expect(await get(endpoint)).toMatchObject({ status: 200, success: true, data: { items: [expect.objectContaining({
      recipientName: '原负责人', recipientActive: true, actions: ['reply', 'scope_decide'],
    })] } });

    const stored = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
    stored.tasks[0].decomposition.handbooks[0].ownerId = 'new-owner';
    fs.writeFileSync(taskFile, JSON.stringify(stored));
    expect(await get(endpoint)).toMatchObject({ status: 200, success: true, data: { items: [expect.objectContaining({
      recipientName: '原负责人', recipientActive: true, actions: ['reply'],
    })] } });

    session.people[0].state = 'INACTIVE';
    expect(await get(endpoint)).toMatchObject({ status: 200, success: true, data: { items: [expect.objectContaining({
      recipientName: '原负责人', recipientActive: false, actions: ['reply'],
    })] } });
  });
  test('首次责任人无可信记录及无效文档均拒绝提及', async () => {
    await start();
    await rejected({ mentions: [{ role: 'document_first_owner', handbookId: 'book', documentId: 'doc' }] }, 422, 'MENTION_RECIPIENT_MISSING');
    await rejected({ mentions: [{ role: 'document_first_owner', handbookId: 'book', documentId: 'other' }] }, 422, 'MENTION_SCOPE_INVALID');
  });
  test('范围意见决定由网关实时解析当前层级责任人', async () => {
    state.tasks[0].ownerId = 'ticket-owner';
    state.tasks[0].decomposition.handbooks[0].documents[0].reviewTaskId = 'task one';
    service.get = jest.fn(() => ({ id: 'task one', handbookId: 'book' }));
    service.listReviewComments = jest.fn(() => [{ id: 'comment-1', scopeOpinion: { level: 'handbook' } }]);
    service.decideScopeOpinion = jest.fn(() => ({ status: 'accepted_pending_scope' }));
    await start();
    const target = '/incremental-tasks/task%20one/reviews/review%20one/comments/comment-1/scope-decision';
    const response = await post({ decision: 'accept' }, 'scope-key', target);
    expect(response).toMatchObject({ status: 200, success: true, data: { status: 'accepted_pending_scope', ticketNumber: 'ticket', handbookId: 'book' } });
    expect(service.decideScopeOpinion).toHaveBeenCalledWith(session, 'task one', 'review one', 'comment-1', 'scope-key', { decision: 'accept' }, {
      level: 'handbook', responsibleId: 'trusted-owner',
    });
  });
  test('采纳后立即创建关联纠偏，重复提交不创建第二条', async () => {
    session.user = { id: 'trusted-owner', principalId: 'trusted-owner' };
    session.allowedActions = ['knowledge:read', 'knowledge:write'];
    session.people = [{ id: 'trusted-owner', displayName: '手册负责人', state: 'ACTIVE' }];
    state.tasks[0].decomposition.confirmed = true;
    state.tasks[0].decomposition.handbooks[0].documents[0].reviewTaskId = 'task one';
    const comment = { id: 'comment-1', content: '调整范围', scopeOpinion: {
      level: 'handbook', status: 'open', ticketNumber: 'ticket', handbookId: 'book',
    } };
    service.get = jest.fn(() => ({ id: 'task one', handbookId: 'book' }));
    service.listReviewComments = jest.fn(() => [comment]);
    service.decideScopeOpinion = jest.fn(() => {
      comment.scopeOpinion.status = 'accepted_pending_scope';
      return comment.scopeOpinion;
    });
    await start();
    const target = '/incremental-tasks/task%20one/reviews/review%20one/comments/comment-1/scope-decision';
    const first = await post({ decision: 'accept' }, 'accept-1', target);
    expect(first).toMatchObject({ status: 200, success: true, data: {
      correctionStatus: 'ready', scopeChangeId: expect.any(String), retryUrl: null,
    } });
    expect(first.data.correctionError).toBeNull();
    const second = await post({ decision: 'accept' }, 'accept-2', target);
    expect(second).toMatchObject({ status: 200, success: true, data: {
      correctionStatus: 'ready', scopeChangeId: first.data.scopeChangeId,
    } });
    expect(service.decideScopeOpinion).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fs.readFileSync(taskFile, 'utf8')).tasks[0].scopeChanges).toEqual([expect.objectContaining({
      id: first.data.scopeChangeId, sourceOpinion: { taskId: 'task one', reviewId: 'review one', commentId: 'comment-1' },
    })]);
  });
  test('自动建单失败明确返回待恢复状态，再次采纳可恢复', async () => {
    session.user = { id: 'trusted-owner', principalId: 'trusted-owner' };
    session.allowedActions = ['knowledge:read', 'knowledge:write'];
    session.people = [{ id: 'trusted-owner', displayName: '手册负责人', state: 'ACTIVE' }];
    state.tasks[0].decomposition.confirmed = false;
    state.tasks[0].decomposition.handbooks[0].documents[0].reviewTaskId = 'task one';
    const comment = { id: 'comment-1', content: '调整范围', scopeOpinion: {
      level: 'handbook', status: 'open', ticketNumber: 'ticket', handbookId: 'book',
    } };
    service.get = jest.fn(() => ({ id: 'task one', handbookId: 'book' }));
    service.listReviewComments = jest.fn(() => [comment]);
    service.decideScopeOpinion = jest.fn(() => {
      comment.scopeOpinion.status = 'accepted_pending_scope';
      return comment.scopeOpinion;
    });
    await start();
    const target = '/incremental-tasks/task%20one/reviews/review%20one/comments/comment-1/scope-decision';
    const pending = await post({ decision: 'accept' }, 'accept-1', target);
    expect(pending).toMatchObject({ status: 200, success: true, data: {
      correctionStatus: 'pending', scopeChangeId: null, retryUrl: expect.stringContaining('scope-decision'),
      correctionError: { code: 'SCOPE_NOT_CONFIRMED' },
    } });
    expect(JSON.parse(fs.readFileSync(taskFile, 'utf8')).tasks[0].scopeChanges || []).toEqual([]);
    const stored = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
    stored.tasks[0].decomposition.confirmed = true;
    fs.writeFileSync(taskFile, JSON.stringify(stored));
    const recovered = await post({ decision: 'accept' }, 'accept-2', target);
    expect(recovered).toMatchObject({ status: 200, success: true, data: {
      correctionStatus: 'ready', scopeChangeId: expect.any(String), retryUrl: null,
    } });
    expect(service.decideScopeOpinion).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fs.readFileSync(taskFile, 'utf8')).tasks[0].scopeChanges).toHaveLength(1);
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
