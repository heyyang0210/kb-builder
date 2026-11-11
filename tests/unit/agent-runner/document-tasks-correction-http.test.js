const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { createDocumentTaskRouter, emptyState } = require('../../../packages/agent-runner-core/routes/document-tasks');

describe('文档任务范围纠偏与发布核对真实 HTTP', () => {
  let directory, file, state, server, base, reviews, context, serial;
  const people = ['owner', 'book-owner', 'writer', 'next', 'publisher', 'admin'].map(id => ({ id, displayName: id }));
  const catalog = {
    outlineVersionId: 'outline-1', versions: ['main', 'next'], chapters: [{ id: 'chapter' }],
    documents: [{ id: 'd1', name: '安装', ownerId: 'writer' }, { id: 'd2', name: '运行', ownerId: 'next' }],
  };
  const doc = (overrides = {}) => ({ id: 'd1', name: '安装', kind: 'existing', parentId: null,
    ownerId: 'writer', scopeVersion: 1, subtaskNumber: 1, ...overrides });
  const book = (overrides = {}) => ({ id: 'h1', name: '手册一', ownerId: 'book-owner', impact: 'involved',
    confirmed: true, targetVersion: 'main', scopeVersion: 1, documents: [doc()], ...overrides });
  const proposedBook = (overrides = {}) => ({ impact: 'involved', targetVersion: 'main',
    documents: [{ id: 'd1', ownerId: 'writer' }], ...overrides });

  beforeEach(async () => {
    const parent = path.resolve(__dirname, '../../../runtime/test-results');
    fs.mkdirSync(parent, { recursive: true });
    directory = fs.mkdtempSync(path.join(parent, 'document-task-correction-'));
    file = path.join(directory, 'state.json');
    state = emptyState('owner');
    state.tasks.push({ number: 'P-1', ownerId: 'owner', revision: 0, scopeVersion: 1, nextSubtaskNumber: 2,
      source: {}, description: '安装说明', assignmentHistory: [],
      decomposition: { ticketImpact: 'involved', confirmed: true, handbooks: [book()] } });
    reviews = new Map(); serial = 0;
    context = {
      people, handbooks: [{ id: 'h1', name: '手册一', ownerId: 'book-owner' }, { id: 'h2', name: '手册二', ownerId: 'next' }],
      catalog: async () => structuredClone(catalog),
      reviewService: { get: (_session, id) => {
        const value = reviews.get(id);
        if (value instanceof Error) throw value;
        if (!value) throw Object.assign(new Error('审核不存在'), { code: 'REVIEW_NOT_FOUND' });
        return structuredClone(value);
      } },
    };
    const app = express();
    app.use('/api', createDocumentTaskRouter({ filePath: file, context: req => {
      const id = req.get('x-test-user') || 'owner';
      const allowedActions = id === 'reader' ? ['knowledge:read'] : ['knowledge:read', 'knowledge:write'];
      if (id === 'admin') allowedActions.push('platform:manage');
      if (id === 'publisher') allowedActions.push('publish:manage');
      return { ...context, session: { user: { principalId: id, allowedActions } } };
    } }));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    base = `http://127.0.0.1:${server.address().port}/api`;
  });
  afterEach(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    fs.rmSync(directory, { recursive: true, force: true });
  });
  function seed() { fs.writeFileSync(file, JSON.stringify(state)); }
  function persisted() { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  async function request(method, suffix, body, user = 'owner', key = `key-${++serial}`) {
    const response = await fetch(base + suffix, { method, headers: { 'Content-Type': 'application/json',
      'x-test-user': user, 'Idempotency-Key': key }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, ...(await response.json()) };
  }
  async function task() { const r = await request('GET', '/P-1'); expect(r.status).toBe(200); return r.data; }
  async function unchanged(method, url, body, code, status = 422, user = 'owner') {
    const before = fs.readFileSync(file, 'utf8');
    const response = await request(method, url, body, user);
    expect(response).toMatchObject({ status, success: false, error: { code } });
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
  }
  async function report(level = 'handbook', fields = {}, user = level === 'ticket' ? 'owner' : 'book-owner') {
    const t = await task();
    const r = await request('POST', '/P-1/scope-changes', { expectedRevision: t.revision, level,
      handbookId: level === 'handbook' ? 'h1' : undefined, reason: '核实文档范围', ...fields }, user);
    expect(r.status).toBe(200); return r.data;
  }
  async function preview(change, proposed, user = change.level === 'ticket' ? 'owner' : 'book-owner') {
    const r = await request('POST', `/P-1/scope-changes/${change.id}/preview`, { proposed }, user);
    expect(r.status).toBe(200); return r.data;
  }
  async function confirm(change, proposed, user = change.level === 'ticket' ? 'owner' : 'book-owner') {
    const impact = await preview(change, proposed, user), t = await task();
    const body = { expectedRevision: t.revision, proposed, impactDigest: impact.impactDigest };
    const result = await request('POST', `/P-1/scope-changes/${change.id}/confirm`, body, user);
    return { result, body };
  }
  function linkReview(overrides = {}) {
    state.tasks[0].decomposition.handbooks[0].documents[0].reviewTaskId = 'review-1';
    reviews.set('review-1', { id: 'review-1', handbookId: 'h1', state: 'mr_submitted',
      handbookSource: { branch: 'main', documents: [{ documentId: 'd1', branch: 'main' }] },
      completion: { status: 'pending', label: '等待合并' }, mergeRequest: { iid: 7, webUrl: 'https://git.example/mr/7' },
      deliveryObservation: { state: 'closed', observedAt: new Date().toISOString(), targetCommit: 'commit-1' }, ...overrides });
  }

  test('工单纠偏增加手册，保留既有文档，完成后幂等重放不重复审计', async () => {
    seed(); const change = await report('ticket');
    const proposed = { ticketImpact: 'involved', handbooks: [{ id: 'h1' }, { id: 'h2' }] };
    const impact = await preview(change, proposed);
    expect(impact.operations).toEqual([]);
    const { result, body } = await confirm(change, proposed);
    expect(result.status).toBe(200);
    expect(result.data.scopeVersion).toBe(2);
    expect(result.data.decomposition.handbooks).toEqual([
      expect.objectContaining({ id: 'h1', membership: 'active', documents: [expect.objectContaining({ id: 'd1', subtaskNumber: 1 })] }),
      expect.objectContaining({ id: 'h2', ownerId: 'next', membership: 'active', documents: [], confirmed: false }),
    ]);
    expect(result.data.scopeChanges[0]).toMatchObject({ status: 'confirmed', confirmedBy: 'owner' });
    expect(result.data.assignmentHistory.at(-1).type).toBe('scope_correction_confirmed');
    const latest = await task();
    const replayKey = 'explicit-replay';
    // A fresh change gives a stable public replay request with a known key.
    const next = await report('ticket');
    const p = await preview(next, proposed), current = await task();
    const replayBody = { ...body, expectedRevision: current.revision, impactDigest: p.impactDigest };
    const first = await request('POST', `/P-1/scope-changes/${next.id}/confirm`, replayBody, 'owner', replayKey);
    expect(first.status).toBe(200);
    const before = fs.readFileSync(file, 'utf8');
    expect((await request('POST', `/P-1/scope-changes/${next.id}/confirm`, replayBody, 'owner', replayKey)).data).toEqual(first.data);
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
    expect(latest.revision).toBeGreaterThan(0);
  });

  test('工单纠偏可恢复历史手册及既有分派，纯分派不提升范围版本', async () => {
    state.tasks[0].scopeHistory = [{ handbooks: [book({ id: 'h2', name: '手册二', ownerId: 'next', documents: [doc({ id: 'd2', name: '运行', subtaskNumber: 5 })] })] }];
    seed(); const change = await report('ticket');
    const { result } = await confirm(change, { ticketImpact: 'involved', handbooks: [{ id: 'h1', ownerId: 'next' }, { id: 'h2' }] });
    expect(result.status).toBe(200);
    expect(result.data.decomposition.handbooks[1]).toMatchObject({ ownerId: 'next', documents: [expect.objectContaining({ subtaskNumber: 5 })] });
    const next = await report('ticket');
    const stableVersion = result.data.scopeVersion;
    const reassigned = await confirm(next, { ticketImpact: 'involved', handbooks: [{ id: 'h1', ownerId: 'writer' }, { id: 'h2' }] });
    expect(reassigned.result.data.scopeVersion).toBe(stableVersion);
    expect(reassigned.result.data.decomposition.handbooks[0].ownerId).toBe('writer');
  });

  test.each([
    [{ ticketImpact: 'unknown' }, 'IMPACT_INVALID'],
    [{ ticketImpact: 'involved', handbooks: [] }, 'HANDBOOK_REQUIRED'],
    [{ ticketImpact: 'involved', handbooks: [{ id: 'h1' }, { id: 'h1' }] }, 'DUPLICATE_HANDBOOK'],
    [{ ticketImpact: 'involved', handbooks: [{ id: 'hidden' }] }, 'HANDBOOK_FORBIDDEN', 403],
    [{ ticketImpact: 'involved', handbooks: [{ id: 'h1', ownerId: 'missing' }] }, 'PERSON_INVALID'],
    [{ ticketImpact: 'not_involved' }, 'REASON_REQUIRED'],
    [{ ticketImpact: 'not_involved', reasonId: 'other' }, 'REASON_DETAIL_REQUIRED'],
  ])('工单纠偏非法范围被拒绝 %#', async (...entry) => {
    const [proposed, code, status = 422] = entry;
    seed(); const change = await report('ticket'), p = await preview(change, proposed), t = await task();
    await unchanged('POST', `/P-1/scope-changes/${change.id}/confirm`, { expectedRevision: t.revision, proposed, impactDigest: p.impactDigest }, code, status);
  });

  test('工单不涉及纠偏保存详细理由，仍需责任人明确确认完成', async () => {
    seed(); const change = await report('ticket');
    const { result } = await confirm(change, { ticketImpact: 'not_involved', reasonId: 'other', reasonDetail: '已由其他工单覆盖' });
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ status: 'in_progress', decomposition: { ticketImpact: 'not_involved', handbooks: [], ticketReason: { id: 'other', detail: '已由其他工单覆盖' } } });
    const completed = await request('POST', '/P-1/complete', { expectedRevision: result.data.revision });
    expect(completed.data.status).toBe('completed');
  });

  test('手册纠偏切换分支并新增提案，解除旧审核关联且序号不复用', async () => {
    linkReview(); seed(); const change = await report();
    const proposed = proposedBook({ targetVersion: 'next', documents: [{ id: 'd1' }, { id: 'proposal', kind: 'new', name: ' 新文档 ', parentId: 'chapter', ownerId: 'next' }] });
    const { result } = await confirm(change, proposed);
    expect(result.status).toBe(200);
    const b = result.data.decomposition.handbooks[0];
    expect(b).toMatchObject({ scopeVersion: 2, targetVersion: 'next' });
    expect(b.documents).toEqual([
      expect.objectContaining({ id: 'd1', subtaskNumber: 1, scopeVersion: 2, reviewTaskId: null, linkedScopeVersion: null, ownerId: 'writer' }),
      expect.objectContaining({ id: 'proposal', kind: 'new', name: '新文档', parentId: 'chapter', subtaskNumber: 2, ownerId: 'next', membership: 'active' }),
    ]);
    expect(result.data.scopeHistory.some(scope => scope.handbooks?.[0].documents[0].reviewTaskId === 'review-1')).toBe(true);
    expect(result.data.scopeVersion).toBe(2);
  });

  test('手册纠偏恢复历史文档编号，继承目录负责人且未变范围版本不增长', async () => {
    state.tasks[0].scopeHistory = [{ handbooks: [book({ documents: [doc({ id: 'd2', name: '运行', ownerId: 'next', subtaskNumber: 9 })] })] }];
    seed(); const change = await report();
    const { result } = await confirm(change, proposedBook({ documents: [{ id: 'd1' }, { id: 'd2' }] }));
    expect(result.status).toBe(200);
    expect(result.data.decomposition.handbooks[0].documents[1]).toMatchObject({ subtaskNumber: 9, ownerId: 'next', membership: 'active' });
    const next = await report();
    const same = await confirm(next, proposedBook({ documents: [{ id: 'd1', ownerId: 'next' }, { id: 'd2' }] }));
    expect(same.result.status).toBe(200);
    expect(same.result.data.decomposition.handbooks[0].scopeVersion).toBe(result.data.decomposition.handbooks[0].scopeVersion);
    expect(same.result.data.scopeVersion).toBe(result.data.scopeVersion);
  });

  test.each([
    [proposedBook({ impact: 'unknown' }), 'IMPACT_INVALID'],
    [proposedBook({ targetVersion: 'missing' }), 'VERSION_INVALID'],
    [proposedBook({ documents: [{ id: '' }] }), 'DOCUMENT_INVALID'],
    [proposedBook({ documents: [{ id: 'missing' }] }), 'DOCUMENT_INVALID'],
    [proposedBook({ documents: [{ id: 'new', kind: 'new', name: '', parentId: 'chapter' }] }), 'DOCUMENT_INVALID'],
    [proposedBook({ documents: [{ id: 'new', kind: 'new', name: '新增', parentId: 'missing' }] }), 'DOCUMENT_INVALID'],
    [proposedBook({ documents: [{ id: 'd1' }, { id: 'd1' }] }), 'DOCUMENT_DUPLICATE'],
    [proposedBook({ documents: [] }), 'DOCUMENT_SCOPE_REQUIRED'],
    [proposedBook({ targetVersion: null }), 'DOCUMENT_SCOPE_REQUIRED'],
    [proposedBook({ documents: [{ id: 'd1', ownerId: 'missing' }] }), 'PERSON_INVALID'],
    [proposedBook({ impact: 'not_involved', reasonId: 'other', documents: [] }), 'REASON_DETAIL_REQUIRED'],
  ])('手册纠偏非法文档与目标范围被拒绝 %#', async (proposed, code) => {
    seed(); const change = await report(), p = await preview(change, proposed), t = await task();
    await unchanged('POST', `/P-1/scope-changes/${change.id}/confirm`, { expectedRevision: t.revision, proposed, impactDigest: p.impactDigest }, code, 422, 'book-owner');
  });

  test('未发布大纲的存量文档纠偏不能确认', async () => {
    context.catalog = async () => ({ ...catalog, outlineVersionId: null });
    seed(); const change = await report(), proposed = proposedBook(), p = await preview(change, proposed), t = await task();
    await unchanged('POST', `/P-1/scope-changes/${change.id}/confirm`, { expectedRevision: t.revision, proposed, impactDigest: p.impactDigest }, 'DOCUMENT_INVALID', 422, 'book-owner');
  });

  test.each(['missing', 'scope'])('审核依赖%s时预览拒绝，禁止将无法验证的审核视为可撤出', async mode => {
    linkReview();
    if (mode === 'missing') reviews.set('review-1', new Error('后端断开'));
    else reviews.get('review-1').handbookSource.branch = 'other';
    seed(); const change = await report();
    await unchanged('POST', `/P-1/scope-changes/${change.id}/preview`, { proposed: proposedBook({ documents: [] }) },
      mode === 'missing' ? 'DEPENDENCY_UNAVAILABLE' : 'REVIEW_SCOPE_MISMATCH', mode === 'missing' ? 503 : 409, 'book-owner');
  });

  test.each([undefined, { state: 'closed', observedAt: 'invalid' }, { state: 'closed', observedAt: '2000-01-01T00:00:00Z' }, { state: 'unknown', observedAt: new Date().toISOString() }])('MR 观测缺失、陈旧或未知均不放行 %#', async observation => {
    linkReview({ deliveryObservation: observation }); seed(); const change = await report();
    const proposed = proposedBook({ impact: 'not_involved', reasonId: 'covered', documents: [] });
    const p = await preview(change, proposed), t = await task();
    expect(p.canConfirm).toBe(false); expect(p.blockedBy).toHaveLength(1);
    await unchanged('POST', `/P-1/scope-changes/${change.id}/confirm`, { expectedRevision: t.revision, proposed, impactDigest: p.impactDigest }, 'IMPACT_STALE', 409, 'book-owner');
  });

  test('影响摘要变化拒绝确认，不覆盖现有范围', async () => {
    linkReview(); seed(); const change = await report(), proposed = proposedBook({ documents: [] });
    const p = await preview(change, proposed), t = await task();
    reviews.get('review-1').deliveryObservation.targetCommit = 'different';
    await unchanged('POST', `/P-1/scope-changes/${change.id}/confirm`, { expectedRevision: t.revision, proposed, impactDigest: p.impactDigest }, 'IMPACT_STALE', 409, 'book-owner');
  });

  test.each(['owner', 'book-owner', 'admin'])('取消纠偏按发起人、责任人和管理员权限校验：%s', async user => {
    seed(); const change = await report('handbook', {}, user === 'owner' ? 'admin' : 'book-owner');
    if (user === 'owner') {
      // The owner is neither this handbook's responsible person nor its creator.
      const t = await task();
      await unchanged('POST', `/P-1/scope-changes/${change.id}/cancel`, { expectedRevision: t.revision }, 'FORBIDDEN', 403, user);
      return;
    }
    const t = await task();
    const r = await request('POST', `/P-1/scope-changes/${change.id}/cancel`, { expectedRevision: t.revision, reason: '继续原范围' }, user);
    expect(r.status).toBe(200); expect(r.data.scopeChanges[0]).toMatchObject({ status: 'cancelled', cancelledBy: user });
    expect(r.data.assignmentHistory.at(-1).type).toBe('scope_correction_cancelled');
    const current = await task();
    await unchanged('POST', `/P-1/scope-changes/${change.id}/cancel`, { expectedRevision: current.revision }, 'SCOPE_CHANGE_NOT_ACTIVE', 409, user);
    expect((await request('GET', '/P-1', undefined, 'writer')).data.nextAction.url).toContain('documentId=d1');
  });

  test.each([
    ['preview', 'SCOPE_CHANGE_NOT_FOUND', 404], ['confirm', 'SCOPE_CHANGE_NOT_FOUND', 404], ['cancel', 'SCOPE_CHANGE_NOT_ACTIVE', 409],
  ])('不存在的纠偏%s返回明确错误', async (action, code, status) => {
    seed(); await unchanged('POST', `/P-1/scope-changes/missing/${action}`, { expectedRevision: 0, proposed: proposedBook() }, code, status);
  });

  function publicationFixture() {
    state.tasks[0].scopeChecks = [{ id: 'check-1', handbookId: 'h1', documentId: 'd1', documentName: '安装',
      targetCommit: 'commit-1', status: 'pending', revision: 0 }];
  }
  test('发布核对依次标记需修复、核对无需修复，保留证据与审计', async () => {
    publicationFixture(); seed();
    let t = await task(); expect(t.nextAction).toMatchObject({ action: 'publication-check', checkId: 'check-1' });
    let r = await request('POST', '/P-1/publication-checks/check-1/complete', { expectedRevision: t.revision, conclusion: 'needs_fix', note: '图片待修复' }, 'publisher');
    expect(r.status).toBe(200);
    expect(r.data.scopeChecks[0]).toMatchObject({ status: 'needs_fix', revision: 1, operatorId: 'publisher', evidence: { note: '图片待修复' } });
    t = r.data;
    r = await request('POST', '/P-1/publication-checks/check-1/complete', { expectedRevision: t.revision, conclusion: 'no_repair_required', targetCommit: 'commit-1', bodyVerified: true, resourcesVerified: true }, 'admin');
    expect(r.status).toBe(200);
    expect(r.data.scopeChecks[0]).toMatchObject({ status: 'completed', revision: 2, operatorId: 'admin', evidence: { targetCommit: 'commit-1', bodyVerified: true, resourcesVerified: true } });
    expect(r.data.scopeChecks[0].completedAt).toEqual(expect.any(String));
    expect(persisted().tasks[0].assignmentHistory.at(-1)).toMatchObject({ type: 'publication_check', operatorId: 'admin' });
  });

  test.each([
    [{}, 'PUBLICATION_CONCLUSION_INVALID'],
    [{ conclusion: 'no_repair_required', targetCommit: 'wrong', bodyVerified: true, resourcesVerified: true }, 'PUBLICATION_EVIDENCE_REQUIRED'],
    [{ conclusion: 'no_repair_required', targetCommit: 'commit-1', bodyVerified: false, resourcesVerified: true }, 'PUBLICATION_EVIDENCE_REQUIRED'],
    [{ conclusion: 'no_repair_required', targetCommit: 'commit-1', bodyVerified: true, resourcesVerified: false }, 'PUBLICATION_EVIDENCE_REQUIRED'],
    [{ conclusion: 'no_repair_required', bodyVerified: true, resourcesVerified: true }, 'PUBLICATION_EVIDENCE_REQUIRED'],
  ])('发布结论和证据守卫拒绝无效提交 %#', async (fields, code) => {
    publicationFixture(); seed(); await unchanged('POST', '/P-1/publication-checks/check-1/complete', { expectedRevision: 0, ...fields }, code, 422, 'publisher');
  });

  test('发布核对不存在、权限不足和并发冲突均无持久副作用', async () => {
    publicationFixture(); seed();
    await unchanged('POST', '/P-1/publication-checks/missing/complete', { expectedRevision: 0 }, 'PUBLICATION_CHECK_NOT_FOUND', 404, 'publisher');
    await unchanged('POST', '/P-1/publication-checks/check-1/complete', { expectedRevision: 0, conclusion: 'needs_fix' }, 'FORBIDDEN', 403, 'writer');
    await unchanged('POST', '/P-1/publication-checks/check-1/complete', { expectedRevision: 99, conclusion: 'needs_fix' }, 'REVISION_CONFLICT', 409, 'publisher');
  });

  test.each(['completed', 'pending', 'wrong-book', 'wrong-document', 'wrong-branch', 'absent-document'])('修复交付必须有同范围完成证据：%s', async mode => {
    publicationFixture(); linkReview({ state: 'mr_submitted', completion: { status: mode === 'pending' ? 'pending' : 'completed', label: '已验证' } });
    const review = reviews.get('review-1');
    if (mode === 'wrong-book') review.handbookId = 'h2';
    if (mode === 'wrong-document') review.handbookSource.documents[0].documentId = 'other';
    if (mode === 'wrong-branch') review.handbookSource.documents[0].branch = 'other';
    if (mode === 'absent-document') state.tasks[0].decomposition.handbooks[0].documents = [];
    seed(); const fields = { expectedRevision: 0, conclusion: 'repair_delivered', reviewTaskId: 'review-1' };
    if (mode !== 'completed') {
      await unchanged('POST', '/P-1/publication-checks/check-1/complete', fields, 'PUBLICATION_REPAIR_UNVERIFIED', 409, 'publisher');
    } else {
      const r = await request('POST', '/P-1/publication-checks/check-1/complete', fields, 'publisher');
      expect(r.status).toBe(200);
      expect(r.data.scopeChecks[0]).toMatchObject({ status: 'completed', reviewTaskId: 'review-1', revision: 1, evidence: { reviewTaskId: 'review-1', targetCommit: 'commit-1' } });
    }
  });

  test('已合并文档撤回后以新审核完成修复交付，原审核不能复用', async () => {
    linkReview({ deliveryObservation: { state: 'merged', observedAt: new Date().toISOString(), targetCommit: 'commit-1' } });
    seed();
    const change = await report('handbook', { affectedDocuments: [] });
    const { result } = await confirm(change, proposedBook({ impact: 'not_involved', reasonId: 'covered', documents: [] }));
    expect(result.status).toBe(200);
    expect(result.data.scopeChecks).toEqual([expect.objectContaining({ documentId: 'd1', reviewTaskId: 'review-1', status: 'pending' })]);
    const check = result.data.scopeChecks[0];
    reviews.get('review-1').completion.status = 'completed';
    await unchanged('POST', `/P-1/publication-checks/${check.id}/complete`,
      { expectedRevision: result.data.revision, conclusion: 'repair_delivered', reviewTaskId: 'review-1' },
      'PUBLICATION_REPAIR_UNVERIFIED', 409, 'publisher');
    reviews.set('review-2', { ...reviews.get('review-1'), id: 'review-2' });
    const delivered = await request('POST', `/P-1/publication-checks/${check.id}/complete`,
      { expectedRevision: result.data.revision, conclusion: 'repair_delivered', reviewTaskId: 'review-2' }, 'publisher');
    expect(delivered.status).toBe(200);
    expect(delivered.data.scopeChecks[0]).toMatchObject({ status: 'completed', reviewTaskId: 'review-2' });
  });

  test('恢复查询返回文档与纠偏、核对事项的当前快照', async () => {
    linkReview({ deliveryFailure: { at: '2026-11-01T00:00:00Z', message: '回读中断' } }); publicationFixture(); seed();
    const r = await request('GET', '/P-1/recovery', undefined, 'writer');
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ number: 'P-1', revision: 0, scopeVersion: 1, scopeChanges: [], scopeChecks: [expect.objectContaining({ id: 'check-1' })],
      documents: [expect.objectContaining({ handbookId: 'h1', documentId: 'd1', responsibleId: 'writer', phase: 'mr_submitted', observedAt: '2026-11-01T00:00:00Z' })] });
    expect(r.data.documents[0].nextAction).toContain('documentId=d1');
  });

  test.each([
    [{ level: 'other' }, 'SCOPE_CHANGE_INVALID'],
    [{ level: 'handbook', handbookId: null }, 'SCOPE_CHANGE_INVALID'],
    [{ reason: '  ' }, 'SCOPE_CHANGE_INVALID'],
    [{ affectedDocuments: {} }, 'SCOPE_CHANGE_INVALID'],
    [{ affectedDocuments: [{ handbookId: 'h1', documentId: 'missing' }] }, 'SCOPE_DOCUMENT_INVALID'],
    [{ affectedDocuments: [{ handbookId: 'h1', documentId: 'd1' }, { handbookId: 'h1', documentId: 'd1' }] }, 'SCOPE_DOCUMENT_DUPLICATE'],
    [{ handbookId: 'missing' }, 'HANDBOOK_NOT_FOUND', 404],
  ])('纠偏发起校验输入格式与有效范围 %#', async (...entry) => {
    const [fields, code, status = 422] = entry;
    seed(); await unchanged('POST', '/P-1/scope-changes', { expectedRevision: 0, level: 'handbook', handbookId: 'h1', reason: '范围变更', ...fields }, code, status, 'book-owner');
  });

  test.each(['ticket-draft', 'book-draft', 'reader', 'other-owner', 'cross-book'])('纠偏发起的层级与责任人守卫：%s', async mode => {
    if (mode === 'ticket-draft') state.tasks[0].decomposition.confirmed = false;
    if (mode === 'book-draft') state.tasks[0].decomposition.handbooks[0].confirmed = false;
    if (mode === 'cross-book') state.tasks[0].decomposition.handbooks.push(book({ id: 'h2' }));
    seed();
    const fields = { expectedRevision: 0, level: 'handbook', handbookId: 'h1', reason: '纠偏',
      ...(mode === 'cross-book' ? { affectedDocuments: [{ handbookId: 'h2', documentId: 'd1' }] } : {}) };
    const user = mode === 'reader' ? 'reader' : mode === 'other-owner' ? 'writer' : 'book-owner';
    await unchanged('POST', '/P-1/scope-changes', fields, mode.endsWith('draft') ? 'SCOPE_NOT_CONFIRMED' : mode === 'cross-book' ? 'SCOPE_DOCUMENT_INVALID' : 'FORBIDDEN', mode.endsWith('draft') ? 409 : mode === 'cross-book' ? 422 : 403, user);
  });

  test('纠偏预览要求方案与责任人权限，取消后不能确认', async () => {
    seed(); const change = await report();
    await unchanged('POST', `/P-1/scope-changes/${change.id}/preview`, {}, 'SCOPE_PROPOSAL_REQUIRED', 422, 'book-owner');
    await unchanged('POST', `/P-1/scope-changes/${change.id}/preview`, { proposed: 'wrong' }, 'SCOPE_PROPOSAL_REQUIRED', 422, 'book-owner');
    await unchanged('POST', `/P-1/scope-changes/${change.id}/preview`, { proposed: proposedBook() }, 'FORBIDDEN', 403, 'writer');
    const t = await task();
    expect((await request('POST', `/P-1/scope-changes/${change.id}/cancel`, { expectedRevision: t.revision }, 'book-owner')).status).toBe(200);
    const current = await task();
    await unchanged('POST', `/P-1/scope-changes/${change.id}/confirm`, { expectedRevision: current.revision, proposed: proposedBook() }, 'SCOPE_CHANGE_NOT_ACTIVE', 409, 'book-owner');
  });

  test('纠偏发起人被改派后仍可取消自己的报告', async () => {
    seed(); const change = await report();
    const t = await task();
    const reassigned = await request('PUT', '/P-1/handbooks/h1/owner', { expectedRevision: t.revision, ownerId: 'next' });
    expect(reassigned.status).toBe(200);
    const r = await request('POST', `/P-1/scope-changes/${change.id}/cancel`, { expectedRevision: reassigned.data.revision }, 'book-owner');
    expect(r.status).toBe(200); expect(r.data.scopeChanges[0].cancelledBy).toBe('book-owner');
  });

  test('纠偏按新增真实文档标出 add，旧任务全局编号冲突时拒绝确认', async () => {
    state.tasks[0].decomposition.handbooks.push(book({ id: 'h2', documents: [doc({ subtaskNumber: 1 })] }));
    seed(); const change = await report();
    const proposed = proposedBook({ documents: [{ id: 'd1' }, { id: 'd2' }] }), p = await preview(change, proposed), t = await task();
    expect(p.operations).toEqual([expect.objectContaining({ operation: 'add', handbookId: 'h1', documentId: 'd2', canConfirm: true })]);
    await unchanged('POST', `/P-1/scope-changes/${change.id}/confirm`, { expectedRevision: t.revision, proposed, impactDigest: p.impactDigest }, 'SUBTASK_NUMBER_CONFLICT', 409, 'book-owner');
  });

  test('旧审核范围版本失配时显示重新送审，不复用完成状态', async () => {
    linkReview({ completion: { status: 'completed', label: '已完成' } });
    Object.assign(state.tasks[0].decomposition.handbooks[0].documents[0], { linkedScopeVersion: 1, scopeVersion: 2 });
    seed(); const t = await task();
    expect(t.status).toBe('in_progress');
    expect(t.decomposition.handbooks[0].documents[0].completion).toMatchObject({ status: 'pending', recovery: 'scope_changed' });
  });

  test('映射读取失败清空可选分支并返回错误，未确认范围不写入', async () => {
    let calls = 0;
    context.resolveVersionMapping = async () => { calls++; throw new Error('未配置版本规则'); };
    state.tasks[0].decomposition.handbooks[0].confirmed = false;
    seed();
    let r = await request('GET', '/catalog?handbookId=h1&ticketNumber=P-1');
    expect(r.status).toBe(200); expect(r.data).toMatchObject({ versions: [], versionMappingError: '未配置版本规则' });
    expect(calls).toBe(1);
    const confirmed = await request('PUT', '/P-1/handbooks/h1', { expectedRevision: 0, confirm: true, impact: 'involved', targetVersion: 'main', documents: [{ id: 'd1', ownerId: 'writer' }] }, 'book-owner');
    expect(confirmed.status).toBe(500); // unresolved mapping must not write any scope
    expect(persisted().tasks[0].decomposition.handbooks[0].confirmed).toBe(false);
  });

  test('已确认但没有映射快照的旧手册目录沿用目标分支', async () => {
    context.resolveVersionMapping = jest.fn(async () => { throw new Error('不应重新解析'); });
    seed(); const r = await request('GET', '/catalog?handbookId=h1&ticketNumber=P-1');
    expect(r.status).toBe(200); expect(r.data).toMatchObject({ versions: ['main'], versionMapping: { branch: 'main' } });
    expect(context.resolveVersionMapping).not.toHaveBeenCalled();
  });

  test('开启计时后真实请求返回任务读取与投影耗时', async () => {
    seed(); const prior = process.env.KC_DOCUMENT_TASK_TIMING;
    process.env.KC_DOCUMENT_TASK_TIMING = '1';
    try {
      const response = await fetch(base + '/P-1');
      expect(response.status).toBe(200);
      expect(response.headers.get('Server-Timing')).toMatch(/^task-read;dur=\d+\.\d, task-project;dur=\d+\.\d$/);
      expect((await response.json()).data.number).toBe('P-1');
    } finally {
      if (prior === undefined) delete process.env.KC_DOCUMENT_TASK_TIMING;
      else process.env.KC_DOCUMENT_TASK_TIMING = prior;
    }
  });

  test.each([
    [{ reasonOptions: {} }, 'REASONS_INVALID'],
    [{ reasonOptions: [] }, 'REASONS_INVALID'],
    [{ reasonOptions: [{ id: 'other', label: '' }] }, 'REASONS_INVALID'],
    [{ reasonOptions: [{ id: '', label: '空编号' }] }, 'REASONS_INVALID'],
    [{ reasonOptions: [{ id: 'other', label: '其他' }, { id: 'other', label: '重复' }] }, 'REASONS_INVALID'],
    [{ reasonOptions: [{ id: 'covered', label: '已覆盖' }] }, 'REASONS_INVALID'],
    [{ pingcodeProjectUrl: 'http://example.com' }, 'SOURCE_URL_INVALID'],
  ])('任务配置校验理由集合和HTTPS地址 %#', async (fields, code) => {
    seed(); await unchanged('PUT', '/config', { expectedRevision: 0, defaultOwnerId: 'owner', ...fields }, code, 422, 'admin');
  });

  test('任务配置保存规范化理由和HTTPS链接，清除链接保留理由', async () => {
    seed();
    let r = await request('PUT', '/config', { expectedRevision: 0, defaultOwnerId: 'next', pingcodeProjectUrl: ' https://example.com/project ', reasonOptions: [{ id: ' other ', label: ' 其他 ' }, { id: 'covered', label: '已有覆盖' }] }, 'admin');
    // IDs are validated before normalization, so the required built-in id must be exact.
    expect(r.error.code).toBe('REASONS_INVALID');
    r = await request('PUT', '/config', { expectedRevision: 0, defaultOwnerId: 'next', pingcodeProjectUrl: ' https://example.com/project ', reasonOptions: [{ id: 'other', label: ' 其他 ' }, { id: 'covered', label: '已有覆盖' }] }, 'admin');
    expect(r.status).toBe(200); expect(r.data).toMatchObject({ revision: 1, defaultOwnerId: 'next', pingcodeProjectUrl: 'https://example.com/project', reasonOptions: [{ id: 'other', label: '其他' }, { id: 'covered', label: '已有覆盖' }] });
    const options = r.data.reasonOptions;
    r = await request('PUT', '/config', { expectedRevision: 1, defaultOwnerId: 'next', pingcodeProjectUrl: '' }, 'admin');
    expect(r.status).toBe(200); expect(r.data.pingcodeProjectUrl).toBeNull(); expect(r.data.reasonOptions).toEqual(options);
  });
});
