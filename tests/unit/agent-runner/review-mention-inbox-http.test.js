const http = require('node:http');
const { MemoryIncrementalBuildRepository, IncrementalBuildService, createIncrementalBuildHandler } = require('../../../packages/agent-runner-core/lib/incremental-build-service');

describe('审核提及站内收件箱真实HTTP契约', () => {
  let server, base, repository, service, session;
  const task = () => ({
    id: 'task', handbookId: 'book', name: '站内通知验收', state: 'under_review',
    createdBy: { id: 'author', displayName: '作者' },
    candidate: { id: 'candidate', digest: 'digest-1', content: '正文', operations: [] },
    reviews: [{ id: 'review', status: 'pending', reviewerIds: ['reviewer'], candidateDigest: 'digest-1', comments: [] }],
  });
  beforeEach(async () => {
    repository = new MemoryIncrementalBuildRepository({ schemaVersion: 1, tasks: [task()], publishedVersions: [], audits: [], idempotency: {} });
    service = new IncrementalBuildService(repository);
    session = { user: { id: 'reviewer', displayName: '审核人' }, allowedActions: ['knowledge:read', 'knowledge:write'] };
    const handler = createIncrementalBuildHandler({ service });
    server = http.createServer((req, res) => handler(req, res, session));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/knowledge-center/api/incremental-tasks`;
  });
  afterEach(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  async function request(method, path, body, key) {
    const response = await fetch(`${base}${path}`, { method, headers: {
      'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}),
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, ...(await response.json()) };
  }

  test('评论与站内通知同事务保存，同人多角色只入箱一次且本人可读已读', async () => {
    const comment = service.commentOnReview(session, 'task', 'review', 'comment-1', {
      comment: '请核对范围', commentType: 'scope_opinion', scopeLevel: 'handbook', candidateDigest: 'digest-1',
    }, { mentions: [
      { role: 'handbook_owner', recipientId: 'owner-1', recipientName: '手册负责人', handbookId: 'book', handbookName: '数据库管理' },
      { role: 'document_first_owner', recipientId: 'owner-1', recipientName: '手册负责人', handbookId: 'book', handbookName: '数据库管理' },
    ] });
    expect(comment.notificationStatus).toBe('inbox');
    expect(comment.notificationEvents).toHaveLength(1);
    expect(comment.notificationEvents[0]).toMatchObject({ recipientId: 'owner-1', status: 'inbox', readAt: null });

    session = { user: { id: 'owner-1' }, allowedActions: ['knowledge:read', 'knowledge:write'] };
    expect(await request('GET', '/notifications?state=unread&limit=20')).toMatchObject({ status: 200, success: true, data: {
      unreadCount: 1, items: [expect.objectContaining({ id: comment.notificationEvents[0].id, commentId: comment.id, readAt: null })],
    } });
    expect(await request('PUT', `/notifications/${comment.notificationEvents[0].id}/read`, {}, 'read-1')).toMatchObject({ status: 200, success: true, data: { readAt: expect.any(String) } });
    expect(await request('GET', '/notifications?state=unread')).toMatchObject({ status: 200, success: true, data: { unreadCount: 0, items: [] } });
  });

  test('非收件人不能标记他人通知已读', async () => {
    const comment = service.commentOnReview(session, 'task', 'review', 'comment-2', { comment: '核对' }, {
      mentions: [{ role: 'knowledge_center_owner', recipientId: 'admin-1', recipientName: '平台负责人' }],
    });
    expect(comment.notificationEvents).toHaveLength(1);
    expect(await request('PUT', `/notifications/${comment.notificationEvents[0].id}/read`, {}, 'read-other')).toMatchObject({
      status: 404, success: false, error: { code: 'NOTIFICATION_NOT_FOUND' },
    });
    expect(repository.read().tasks[0].reviews[0].comments[0].notificationEvents[0].readAt).toBeNull();
  });

  test('人员停用后，历史审核意见与通知仍保留原收件人快照', async () => {
    const comment = service.commentOnReview(session, 'task', 'review', 'historical-mention', {
      comment: '请核对范围', candidateDigest: 'digest-1',
    }, { mentions: [{ role: 'handbook_owner', recipientId: 'owner-1',
      recipientName: '原手册负责人', handbookId: 'book', handbookName: '数据库管理' }] });
    session.people = [{ id: 'owner-1', state: 'INACTIVE' }];
    const comments = await request('GET', '/task/reviews/review/comments');
    expect(comments).toMatchObject({ status: 200, success: true, data: [expect.objectContaining({
      id: comment.id, mentions: [expect.objectContaining({ recipientId: 'owner-1', recipientName: '原手册负责人' })],
    })] });
    session = { user: { id: 'owner-1' }, people: [{ id: 'owner-1', state: 'INACTIVE' }],
      allowedActions: ['knowledge:read'] };
    const notices = await request('GET', '/notifications');
    expect(notices).toMatchObject({ status: 200, success: true, data: {
      items: [expect.objectContaining({ commentId: comment.id, recipientId: 'owner-1', recipientName: '原手册负责人' })],
    } });
  });

  test('范围意见只能由对应负责人决定，拒绝理由和重复决定受保护', () => {
    const comment = service.commentOnReview(session, 'task', 'review', 'scope-1', {
      comment: '建议调整文档范围', commentType: 'scope_opinion', scopeLevel: 'handbook', candidateDigest: 'digest-1',
    });
    expect(() => service.decideScopeOpinion(session, 'task', 'review', comment.id, 'scope-decision-1', { decision: 'accept' }, {
      level: 'handbook', responsibleId: 'owner-1',
    })).toThrow(expect.objectContaining({ code: 'SCOPE_DECISION_FORBIDDEN' }));
    const owner = { user: { id: 'owner-1' }, allowedActions: ['knowledge:read', 'knowledge:write'] };
    expect(() => service.decideScopeOpinion(owner, 'task', 'review', comment.id, 'scope-decision-2', { decision: 'reject' }, {
      level: 'handbook', responsibleId: 'owner-1',
    })).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    const decision = service.decideScopeOpinion(owner, 'task', 'review', comment.id, 'scope-decision-3', { decision: 'accept' }, {
      level: 'handbook', responsibleId: 'owner-1',
    });
    expect(decision.status).toBe('accepted_pending_scope');
    expect(service.decideScopeOpinion(owner, 'task', 'review', comment.id, 'scope-decision-3', { decision: 'accept' }, {
      level: 'handbook', responsibleId: 'owner-1',
    })).toEqual(decision);
    expect(() => service.decideScopeOpinion(owner, 'task', 'review', comment.id, 'scope-decision-4', { decision: 'reject', reason: '不同意' }, {
      level: 'handbook', responsibleId: 'owner-1',
    })).toThrow(expect.objectContaining({ code: 'SCOPE_OPINION_DECIDED' }));
  });
});
