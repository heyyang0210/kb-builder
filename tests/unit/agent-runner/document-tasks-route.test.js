const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDocumentTaskRouter } = require('../../../packages/agent-runner-core/routes/document-tasks');
const { IncrementalBuildService } = require('../../../packages/agent-runner-core/lib/incremental-build-service');
const people = ['owner', 'book-owner', 'writer', 'next'].map(id => ({ id, displayName: id }));
const catalog = { outlineVersionId: 'published-v1', versions: ['23.4'], documents: [{ id: 'd1', name: '安装', parentId: 'chapter' }, { id: 'd2', name: '新增', parentId: 'chapter' }], chapters: [{ id: 'chapter', name: '第一章' }] };
let reviewState, reviewError, proposalCalls, catalogOverride, versionResolver;
const context = req => {
  const id = req.get('x-test-user') || 'owner';
  return { session: { user: { id: `auth-${id}`, principalId: id, allowedActions: id === 'outsider' ? ['knowledge:read'] : ['knowledge:read', 'knowledge:write', 'outline:create', ...(['owner', 'admin'].includes(id) ? ['platform:manage'] : [])] } }, people, handbooks: [{ id: 'h1', name: '手册一', ownerId: 'book-owner' }, { id: 'h2', name: '手册二', ownerId: null }], catalog: async () => catalogOverride || catalog, resolveVersionMapping: versionResolver, createDocument: async () => { proposalCalls++; return { outlineId: 'new-candidate', documentId: 'd2' }; },
    reviewService: { list: () => reviewState ? [{ id: reviewState.id }] : [], get: () => { if (reviewError) throw reviewError; return IncrementalBuildService.prototype.project.call({ isOwner: () => false, canComment: () => false }, reviewState, { user: { id, allowedActions: [] } }); },
      listReviewComments: () => reviewState?.reviews?.flatMap(review => review.comments || []) || [] } };
};
describe('任务管理真实HTTP契约', () => {
  let server, base, directory;
  beforeEach(async () => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'task-v2-')); reviewState = null; reviewError = null; proposalCalls = 0; catalogOverride = null; versionResolver = null; const app = express(); app.use('/api', createDocumentTaskRouter({ filePath: path.join(directory, 'state.json'), defaultOwnerId: 'owner', context })); server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); base = `http://127.0.0.1:${server.address().port}/api`; });
  afterEach(async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(directory, { recursive: true, force: true }); });
  let serial = 0;
  async function request(method, suffix, body, user = 'owner', key) { const response = await fetch(base + suffix, { method, headers: { 'Content-Type': 'application/json', 'x-test-user': user, 'Idempotency-Key': key || `test-${++serial}` }, body: body === undefined ? undefined : JSON.stringify(body) }); const json = await response.json(); return { status: response.status, ...json }; }
  const get = number => request('GET', '/' + number);
  async function imported(number = 'P-1') { const tasks = [{ number, title: '连接说明', ownerId: 'writer', status: '关闭', startTime: '2000-01-01' }]; const p = await request('POST', '/import?preview=true', { tasks }); const result = await request('POST', '/import', { tasks, digest: p.data.digest }); expect(result.status).toBe(200); return (await get(number)).data; }
  async function ticket(task, fields = {}) { return request('PUT', `/${task.number}/decomposition`, { expectedRevision: task.revision, confirm: true, ticketImpact: 'involved', handbooks: [{ id: 'h1', ownerId: 'book-owner' }, { id: 'h2', ownerId: 'book-owner' }], ...fields }); }
  async function book(task, id = 'h1', fields = {}) { return request('PUT', `/${task.number}/handbooks/${id}`, { expectedRevision: task.revision, confirm: true, impact: 'involved', targetVersion: '23.4', documents: [{ id: 'd1', ownerId: 'writer' }], ...fields }, 'book-owner'); }
  test('预览不写入、全局编号去重和错误行', async () => { const preview = await request('POST', '/import?preview=true', { tasks: [{ number: 'P-1' }, { number: 'P-1' }, {}] }); expect(preview.data.summary).toEqual({ created: 1, updated: 0, unchanged: 0, error: 2 }); expect((await request('GET', '')).data.total).toBe(0); expect(fs.existsSync(path.join(directory, 'state.json'))).toBe(false); });
  test('新任务只使用配置责任人和平台时间，保留来源状态', async () => { const t = await imported(); expect(t.ownerId).toBe('owner'); expect(t.startTime).toBe(null); expect(t.sourceStatus).toBe('关闭'); expect(t.status).toBe('pending_scope'); expect(t.nextAction).toMatchObject({ label: '确认手册范围', action: 'ticket-scope' }); expect(t.pending).toContain('工单责任人确认手册范围'); const mine = await request('GET', '/mine'); expect(mine.data.items).toEqual(expect.arrayContaining([expect.objectContaining({ actionLabel: '确认手册范围', title: `确认 ${t.number} 的手册范围` })])); });
  test('重复导入更新来源，保留分派、历史、已确认范围', async () => { let t = (await ticket(await imported())).data; const tasks = [{ number: t.number, title: '新标题' }]; const p = await request('POST', '/import?preview=true', { tasks }); expect(p.data.summary.updated).toBe(1); await request('POST', '/import', { tasks, digest: p.data.digest }); const next = (await get(t.number)).data; expect(next.description).toBe('新标题'); expect(next.ownerId).toBe('owner'); expect(next.decomposition).toEqual(t.decomposition); expect(next.assignmentHistory.length).toBeGreaterThan(t.assignmentHistory.length); const same = await request('POST', '/import?preview=true', { tasks }); expect(same.data.summary.unchanged).toBe(1); });
  test('过期预览被拒绝；默认配置只影响新任务', async () => { const a = await imported(); const p = await request('POST', '/import?preview=true', { tasks: [{ number: 'P-2' }] }); const c = (await request('GET', '/config')).data; expect((await request('PUT', '/config', { expectedRevision: c.revision, defaultOwnerId: 'next' })).status).toBe(200); expect((await request('POST', '/import', { tasks: [{ number: 'P-2' }], digest: p.data.digest })).status).toBe(409); const b = await imported('P-2'); expect(b.ownerId).toBe('next'); expect((await get(a.number)).data.ownerId).toBe('owner'); });
  test('管理员配置一名知识中心负责人，首次正式分派责任人保留改派前人员', async () => {
    const initial = (await request('GET', '/config')).data;
    expect((await request('PUT', '/config', { expectedRevision: initial.revision, defaultOwnerId: 'owner', knowledgeCenterOwnerId: 'missing' })).status).toBe(422);
    expect((await request('PUT', '/config', { expectedRevision: initial.revision, defaultOwnerId: 'owner', knowledgeCenterOwnerId: 'next' }, 'writer')).status).toBe(403);
    const configured = await request('PUT', '/config', { expectedRevision: initial.revision, defaultOwnerId: 'owner', knowledgeCenterOwnerId: 'next' });
    expect(configured.data.knowledgeCenterOwnerId).toBe('next');
    let task = (await ticket(await imported())).data;
    task = (await book(task)).data;
    let doc = task.decomposition.handbooks[0].documents[0];
    expect(doc).toMatchObject({ ownerId: 'writer', firstAssignedOwnerId: 'writer', firstAssignedAt: expect.any(String) });
    task = (await request('PUT', '/P-1/documents/d1/owner', { expectedRevision: task.revision, handbookId: 'h1', ownerId: 'next' }, 'book-owner')).data;
    doc = task.decomposition.handbooks[0].documents[0];
    expect(doc.ownerId).toBe('next');
    expect(doc.firstAssignedOwnerId).toBe('writer');
  });
  test('人员管理已停用的人员不能配置为知识中心负责人', async () => {
    const candidate = people.find(person => person.id === 'next');
    candidate.state = 'INACTIVE';
    try {
      const config = (await request('GET', '/config')).data;
      const result = await request('PUT', '/config', {
        expectedRevision: config.revision, defaultOwnerId: 'owner', knowledgeCenterOwnerId: candidate.id,
      });
      expect(result).toMatchObject({ status: 422, success: false, error: { code: 'PERSON_INVALID' } });
      expect((await request('GET', '/config')).data.knowledgeCenterOwnerId || null).toBeNull();
    } finally {
      delete candidate.state;
    }
  });
  test('已采纳范围意见关联纠偏事项，不能重复创建活跃事项', async () => {
    let task = (await ticket(await imported())).data;
    task = (await book(task)).data;
    reviewState = { id: 'review-task', handbookId: 'h1', state: 'under_review', reviews: [{ id: 'review-1', comments: [{ id: 'comment-1', scopeOpinion: {
      level: 'handbook', status: 'accepted_pending_scope', ticketNumber: 'P-1', handbookId: 'h1',
    } }] }], candidate: { digest: 'digest', operations: [] } };
    const sourceOpinion = { taskId: 'review-task', reviewId: 'review-1', commentId: 'comment-1' };
    const body = { expectedRevision: task.revision, level: 'handbook', handbookId: 'h1', reason: '审核意见调整范围', affectedDocuments: [], sourceOpinion };
    const created = await request('POST', '/P-1/scope-changes', body, 'book-owner');
    expect(created).toMatchObject({ status: 200, data: { sourceOpinion } });
    expect((await request('POST', '/P-1/scope-changes', { ...body, expectedRevision: task.revision + 1 }, 'book-owner')).error.code).toBe('SCOPE_OPINION_LINKED');
    expect((await request('POST', '/P-1/scope-changes', { ...body, expectedRevision: task.revision + 1, sourceOpinion: { ...sourceOpinion, commentId: 'forged' } }, 'book-owner')).error.code).toBe('SCOPE_OPINION_INVALID');
  });
  test('采纳意见的纠偏记录可双向回读，取消后保持未生效', async () => {
    let task = (await ticket(await imported())).data;
    task = (await book(task)).data;
    reviewState = { id: 'review-task', handbookId: 'h1', state: 'under_review', reviews: [{ id: 'review-1', comments: [{ id: 'comment-1', scopeOpinion: {
      level: 'handbook', status: 'accepted_pending_scope', ticketNumber: 'P-1', handbookId: 'h1',
    } }] }], candidate: { digest: 'digest', operations: [] } };
    const sourceOpinion = { taskId: 'review-task', reviewId: 'review-1', commentId: 'comment-1' };
    const path = '/review/review-task/scope-opinions';
    expect((await request('GET', path)).data.items).toEqual([expect.objectContaining({
      ...sourceOpinion, status: 'accepted_pending_scope', correctionStatus: 'pending', scopeChangeId: null,
      retryUrl: expect.stringContaining('scope-decision'),
    })]);
    const body = { expectedRevision: task.revision, level: 'handbook', handbookId: 'h1', reason: '核对范围', affectedDocuments: [], sourceOpinion };
    const created = await request('POST', '/P-1/scope-changes', body, 'book-owner');
    expect(created.status).toBe(200);
    expect((await request('GET', path)).data.items).toEqual([expect.objectContaining({
      ...sourceOpinion, scopeChangeId: created.data.id, status: 'awaiting_confirmation', nextUrl: expect.stringContaining('scopeOpinionCommentId=comment-1'),
    })]);
    expect((await get('P-1')).data.scopeChanges).toEqual([expect.objectContaining({ id: created.data.id, sourceOpinion })]);
    const cancelled = await request('POST', `/P-1/scope-changes/${created.data.id}/cancel`, {
      expectedRevision: (await get('P-1')).data.revision, reason: '范围无需调整',
    }, 'book-owner');
    expect(cancelled.status).toBe(200);
    expect((await request('GET', path)).data.items).toEqual([expect.objectContaining({
      scopeChangeId: created.data.id, status: 'accepted_not_applied', nextUrl: null,
    })]);
    const repeated = await request('POST', '/P-1/scope-changes', { ...body, expectedRevision: (await get('P-1')).data.revision }, 'book-owner');
    expect(repeated).toMatchObject({ status: 409, error: { code: 'SCOPE_OPINION_LINKED' } });
    expect((await request('GET', path)).data.items).toHaveLength(1);
  });
  test('关联纠偏确认后，审核侧显示服务端计算的最终状态', async () => {
    let task = (await ticket(await imported())).data;
    task = (await book(task)).data;
    reviewState = { id: 'review-task', handbookId: 'h1', state: 'under_review', reviews: [{ id: 'review-1', comments: [{ id: 'comment-1', scopeOpinion: {
      level: 'handbook', status: 'accepted_pending_scope', ticketNumber: 'P-1', handbookId: 'h1',
    } }] }], candidate: { digest: 'digest', operations: [] } };
    const sourceOpinion = { taskId: 'review-task', reviewId: 'review-1', commentId: 'comment-1' };
    const created = await request('POST', '/P-1/scope-changes', {
      expectedRevision: task.revision, level: 'handbook', handbookId: 'h1', reason: '核对范围', affectedDocuments: [], sourceOpinion,
    }, 'book-owner');
    expect(created.status).toBe(200);
    const proposed = { impact: 'involved', targetVersion: '23.4', documents: [{ id: 'd1', ownerId: 'writer' }] };
    const preview = await request('POST', `/P-1/scope-changes/${created.data.id}/preview`, { proposed }, 'book-owner');
    expect(preview.status).toBe(200);
    const confirmed = await request('POST', `/P-1/scope-changes/${created.data.id}/confirm`, {
      expectedRevision: (await get('P-1')).data.revision, proposed, impactDigest: preview.data.impactDigest,
    }, 'book-owner');
    expect(confirmed.status).toBe(200);
    expect((await request('GET', '/review/review-task/scope-opinions')).data.items).toEqual([expect.objectContaining({
      scopeChangeId: created.data.id, status: 'closed', nextUrl: null,
    })]);
  });
  test('新增文档确认后原意见保持待处理，不能提前显示闭环', async () => {
    let task = (await ticket(await imported())).data;
    task = (await book(task)).data;
    reviewState = { id: 'review-task', handbookId: 'h1', state: 'under_review', reviews: [{ id: 'review-1', comments: [{ id: 'comment-1', scopeOpinion: {
      level: 'handbook', status: 'accepted_pending_scope', ticketNumber: 'P-1', handbookId: 'h1',
    } }] }], candidate: { digest: 'digest', operations: [] } };
    const created = await request('POST', '/P-1/scope-changes', {
      expectedRevision: task.revision, level: 'handbook', handbookId: 'h1', reason: '新增文档', affectedDocuments: [],
      sourceOpinion: { taskId: 'review-task', reviewId: 'review-1', commentId: 'comment-1' },
    }, 'book-owner');
    expect(created.status).toBe(200);
    const proposed = { impact: 'involved', targetVersion: '23.4', documents: [
      { id: 'd1', ownerId: 'writer' }, { id: 'd2', ownerId: 'writer' },
    ] };
    const preview = await request('POST', `/P-1/scope-changes/${created.data.id}/preview`, { proposed }, 'book-owner');
    expect(preview.status).toBe(200);
    const confirmed = await request('POST', `/P-1/scope-changes/${created.data.id}/confirm`, {
      expectedRevision: (await get('P-1')).data.revision, proposed, impactDigest: preview.data.impactDigest,
    }, 'book-owner');
    expect(confirmed.status).toBe(200);
    const projection = (await request('GET', '/review/review-task/scope-opinions')).data.items[0];
    expect(projection).toMatchObject({ scopeChangeId: created.data.id, status: 'rework_pending',
      blockingItems: expect.arrayContaining([expect.objectContaining({ documentId: 'd2' })]),
    });
  });
  test('两个层次独立确认，可保存草稿且不自动生成决定', async () => { let t = await imported(); t = (await ticket(t, { confirm: false, handbooks: [{ id: 'h1' }] })).data; expect(t.status).toBe('pending_scope'); expect(t.decomposition.handbooks[0].impact).toBe(null); t = (await ticket(t)).data; expect(t.startTime).toBeTruthy(); expect(t.decomposition.handbooks.every(b => !b.confirmed)).toBe(true); expect((await get(t.number)).data.nextAction).toMatchObject({ label: '确认文档范围', action: 'book-scope', handbookId: 'h1' }); t = (await book(t)).data; expect(t.decomposition.handbooks[0].confirmed).toBe(true); expect(t.decomposition.handbooks[1].confirmed).toBe(false); });
  test('业务版本自动映射并冻结；规则修改后旧任务仍保留原分支', async () => {
    versionResolver = async () => ({ id: 12, rowVersion: 1, connectionId: 'repo-1', branch: '23.4' });
    let task = (await ticket(await imported())).data;
    const catalogResult = await request('GET', `/catalog?handbookId=h1&ticketNumber=${task.number}`);
    expect(catalogResult.data.versionMapping.branch).toBe('23.4');
    task = (await book(task, 'h1', { targetVersion: 'malicious' })).data;
    expect(task.decomposition.handbooks[0]).toMatchObject({ targetVersion: '23.4', versionMapping: { mappingId: 12, mappingRowVersion: 1, targetBranch: '23.4' } });
    versionResolver = async () => ({ id: 13, rowVersion: 1, connectionId: 'repo-1', branch: 'dev' });
    expect((await request('GET', `/catalog?handbookId=h1&ticketNumber=${task.number}`)).data.versionMapping.branch).toBe('23.4');
    task = (await book(task, 'h1', { targetVersion: 'dev' })).data;
    expect(task.decomposition.handbooks[0].targetVersion).toBe('23.4');
    expect(task.decomposition.handbooks[0].versionMapping.mappingId).toBe(12);
  });
  test('同工单跨手册文档序号递增，重排与增补不复用', async () => {
    let t = (await ticket(await imported())).data;
    t = (await book(t, 'h1', { documents: [{ id: 'd1', ownerId: 'writer' }, { id: 'd2', ownerId: 'writer' }] })).data;
    expect(t.decomposition.handbooks[0].documents.map(doc => doc.subtaskNumber)).toEqual([1, 2]);
    t = (await book(t, 'h1', { documents: [{ id: 'd2', ownerId: 'writer' }, { id: 'd1', ownerId: 'writer' }] })).data;
    expect(t.decomposition.handbooks[0].documents.map(doc => doc.subtaskNumber)).toEqual([2, 1]);
    t = (await book(t, 'h2', { documents: [{ id: 'd1', ownerId: 'writer' }] })).data;
    expect(t.decomposition.handbooks[1].documents[0].subtaskNumber).toBe(3);
    const mine = await request('GET', '/mine', undefined, 'writer');
    expect(mine.data.items.filter(item => item.kind === 'document').map(item => item.subtaskNumber).sort()).toEqual([1, 2, 3]);
  });
  test('两级不涉及必须选理由，其他需要补充且总责任人确认完成', async () => { let t = await imported(); expect((await ticket(t, { ticketImpact: 'not_involved', reasonId: 'other' })).status).toBe(422); t = (await ticket(t, { ticketImpact: 'not_involved', reasonId: 'covered' })).data; expect(t.status).toBe('in_progress'); expect((await request('POST', '/P-1/complete', { expectedRevision: t.revision }, 'writer')).status).toBe(403); t = (await request('POST', '/P-1/complete', { expectedRevision: t.revision })).data; expect(t.status).toBe('completed'); expect(t.endTime).toBeTruthy(); });
  test('全部手册不涉及仍须总责任人确认', async () => { let t = (await ticket(await imported())).data; expect((await book(t, 'h1', { impact: 'not_involved' })).status).toBe(422); t = (await book(t, 'h1', { impact: 'not_involved', reasonId: 'covered' })).data; t = (await book(t, 'h2', { impact: 'not_involved', reasonId: 'no_impact' })).data; expect(t.status).toBe('in_progress'); expect((await request('POST', '/P-1/complete', { expectedRevision: t.revision })).data.status).toBe('completed'); });
  test('有效人员、真实版本与目录边界服务端验证', async () => { let t = await imported(); expect((await ticket(t, { handbooks: [{ id: 'h1', ownerId: 'fake' }] })).status).toBe(422); expect((await ticket(t, { handbooks: [{ id: 'hidden', ownerId: 'writer' }] })).status).toBe(403); t = (await ticket(t)).data; expect((await book(t, 'h1', { targetVersion: 'fake' })).status).toBe(422); expect((await book(t, 'h1', { documents: [{ id: 'fake', ownerId: 'writer' }] })).status).toBe(422); });
  test('手册 A 角预选并在保存端校验，大纲未发布时拒绝存量文档', async () => {
    let t = await imported();
    expect((await request('GET', '/context')).data.handbooks[0].ownerId).toBe('book-owner');
    t = (await ticket(t, { handbooks: [{ id: 'h1' }] })).data;
    expect(t.decomposition.handbooks[0].ownerId).toBe('book-owner');
    catalogOverride = { ...catalog, outlineVersionId: null };
    expect((await book(t, 'h1')).error.code).toBe('OUTLINE_PUBLISH_REQUIRED');
  });
  test('存量文档首次匹配主责，旧分派优先且显式改选生效', async () => {
    catalogOverride = { ...catalog, documents: [{ ...catalog.documents[0], ownerId: 'writer', ownerMatch: 'primary' }] };
    let t = (await ticket(await imported())).data;
    t = (await book(t, 'h1', { documents: [{ id: 'd1' }] })).data;
    expect(t.decomposition.handbooks[0].documents[0].ownerId).toBe('writer');
    catalogOverride.documents[0].ownerId = 'next';
    t = (await book(t, 'h1', { documents: [{ id: 'd1' }] })).data;
    expect(t.decomposition.handbooks[0].documents[0].ownerId).toBe('writer');
    t = (await book(t, 'h1', { documents: [{ id: 'd1', ownerId: 'next' }] })).data;
    expect(t.decomposition.handbooks[0].documents[0].ownerId).toBe('next');
  });
  test('失效候选不能自动分派；新增文档确认前必须显式选人', async () => {
    catalogOverride = { ...catalog, documents: [{ ...catalog.documents[0], ownerId: 'removed', ownerMatch: 'primary' }] };
    let t = (await ticket(await imported())).data;
    const existing = { documents: [{ id: 'd1' }] };
    expect((await book(t, 'h1', existing)).status).toBe(422);
    t = (await book(t, 'h1', { ...existing, confirm: false })).data;
    expect(t.decomposition.handbooks[0].documents[0].ownerId).toBeNull();
    t = (await ticket(await imported('P-2'))).data;
    const added = { documents: [{ id: 'proposal', kind: 'new', name: '新增', parentId: 'chapter' }] };
    expect((await book(t, 'h1', added)).status).toBe(422);
    t = (await book(t, 'h1', { ...added, documents: [{ ...added.documents[0], ownerId: 'writer' }] })).data;
    expect(t.decomposition.handbooks[0].documents[0].ownerId).toBe('writer');
  });
  test('未编号草稿可确认并分配序号，已确认旧文档仍需回填', async () => {
    let t = (await ticket(await imported())).data;
    t = (await book(t, 'h1', { confirm: false, documents: [{ id: 'd1', ownerId: 'writer' }] })).data;
    expect(t.decomposition.handbooks[0].documents[0].subtaskNumber).toBeUndefined();
    t = (await book(t, 'h1', { documents: [{ id: 'd1', ownerId: 'writer' }] })).data;
    expect(t.decomposition.handbooks[0].documents[0].subtaskNumber).toBe(1);
  });
  test('可信会话校验操作者，伪造请求体无效', async () => { const t = await imported(); expect((await request('PUT', '/P-1/decomposition', { ...t.decomposition, confirm: true, expectedRevision: t.revision, operatorId: 'owner', ticketImpact: 'not_involved', reasonId: 'covered' }, 'writer')).status).toBe(403); expect((await request('PUT', '/config', { expectedRevision: 0, defaultOwnerId: 'writer' }, 'writer')).status).toBe(403); });
  test('管理员代他人确认两级范围，保留责任人及实际操作者', async () => {
    let task = await imported();
    task = (await request('PUT', '/P-1/owner', { expectedRevision: task.revision, ownerId: 'next' })).data;
    const denied = await request('PUT', '/P-1/decomposition', { expectedRevision: task.revision, confirm: true, ticketImpact: 'involved', handbooks: [{ id: 'h1', ownerId: 'book-owner' }] }, 'writer');
    expect(denied.status).toBe(403);
    task = (await request('PUT', '/P-1/decomposition', { expectedRevision: task.revision, confirm: true, ticketImpact: 'involved', handbooks: [{ id: 'h1', ownerId: 'book-owner' }], operatorId: 'next' }, 'admin')).data;
    expect(task.ownerId).toBe('next');
    expect(task.assignmentHistory.at(-1)).toMatchObject({ type: 'ticket_scope', operatorId: 'admin', responsibleId: 'next', delegatedByAdmin: true });
    expect(task.canConfirm).toBe(true);
    task = (await request('PUT', '/P-1/handbooks/h1', { expectedRevision: task.revision, confirm: true, impact: 'not_involved', reasonId: 'covered' }, 'admin')).data;
    expect(task.decomposition.handbooks[0].ownerId).toBe('book-owner');
    expect(task.assignmentHistory.at(-1)).toMatchObject({ type: 'handbook_scope', operatorId: 'admin', responsibleId: 'book-owner', delegatedByAdmin: true });
    expect((await request('GET', '/P-1', undefined, 'writer')).data.canConfirm).toBe(false);
  });
  test('乐观并发与幂等重放，不覆盖他人修改', async () => { let t = await imported(); const body = { expectedRevision: t.revision, ownerId: 'next' }; const r = await request('PUT', '/P-1/owner', body, 'owner', 'same'); expect(r.status).toBe(200); expect((await request('PUT', '/P-1/owner', body, 'owner', 'same')).data.revision).toBe(r.data.revision); expect((await request('PUT', '/P-1/owner', { ...body, reason: '不同' }, 'owner', 'same')).status).toBe(409); expect((await request('PUT', '/P-1/owner', { ...body, ownerId: 'writer' })).status).toBe(409); expect((await request('PUT', '/P-1/owner', { ownerId: 'writer' })).status).toBe(428); });
  test('无理由改派保留原人与新人、真实操作者和时间', async () => { const t = await imported(); const r = await request('PUT', '/P-1/owner', { expectedRevision: t.revision, ownerId: 'next' }); expect(r.data.assignmentHistory.at(-1)).toMatchObject({ previous: 'owner', next: 'next', operatorId: 'owner' }); });
  test('手册和文档快捷改派：父级权限、并发、幂等、审计及关联保留', async () => {
    let t = (await ticket(await imported())).data;
    const handPath = '/P-1/handbooks/h1/owner';
    expect((await request('PUT', handPath, { expectedRevision: t.revision, ownerId: 'next', operatorId: 'owner' }, 'writer')).status).toBe(403);
    expect((await request('PUT', handPath, { expectedRevision: t.revision, ownerId: 'fake' })).status).toBe(422);
    t = (await book(t)).data;
    const docPath = '/P-1/documents/d1/owner', body = { expectedRevision: t.revision, handbookId: 'h1', ownerId: 'next' };
    expect((await request('PUT', docPath, body, 'writer')).status).toBe(403);
    expect((await request('PUT', docPath, { ...body, handbookId: 'h2' }, 'book-owner')).status).toBe(404);
    const before = t.decomposition.handbooks[0].documents[0];
    t = (await request('PUT', docPath, body, 'book-owner', 'doc-once')).data;
    expect((await request('PUT', docPath, body, 'book-owner', 'doc-once')).data.revision).toBe(t.revision);
    expect((await request('PUT', docPath, body, 'book-owner')).status).toBe(409);
    expect(t.decomposition.handbooks[0].documents[0]).toMatchObject({ id: before.id, name: before.name, ownerId: 'next' });
    expect(t.assignmentHistory.at(-1)).toMatchObject({ type: 'document_owner', previous: { ownerId: 'writer', handbookId: 'h1', documentId: 'd1' }, next: { ownerId: 'next' }, operatorId: 'book-owner', reason: null });
    expect((await request('GET', '/P-1', undefined, 'writer')).data.decomposition.handbooks[0].documents[0].canEdit).toBe(false);
    expect((await request('GET', '/P-1', undefined, 'next')).data.decomposition.handbooks[0].documents[0].canEdit).toBe(true);
    const confirmedBook = t.decomposition.handbooks[0];
    t = (await request('PUT', handPath, { expectedRevision: t.revision, ownerId: 'next' })).data;
    expect(t.decomposition.handbooks[0].documents.map(({ id, name, ownerId, reviewTaskId }) => ({ id, name, ownerId, reviewTaskId }))).toEqual(confirmedBook.documents.map(({ id, name, ownerId, reviewTaskId }) => ({ id, name, ownerId, reviewTaskId })));
    expect(t.assignmentHistory.at(-1)).toMatchObject({ type: 'handbook_owner', previous: { ownerId: 'book-owner' }, next: { ownerId: 'next' }, operatorId: 'owner' });
    expect((await book(t)).status).toBe(403);
  });
  test('草稿不授予下层操作，已转交/分派范围不能静默删除', async () => {
    let t = (await ticket(await imported(), { confirm: false })).data;
    expect((await request('GET', '/P-1', undefined, 'book-owner')).data.decomposition.handbooks[0].canEdit).toBe(false);
    expect((await book(t)).status).toBe(422);
    t = (await ticket(t)).data;
    expect((await ticket(t, { handbooks: [] })).status).toBe(422);
    expect((await ticket(t, { ticketImpact: 'not_involved', reasonId: 'covered', handbooks: [] })).error.code).toBe('SCOPE_WITHDRAWAL_REQUIRED');
    t = (await book(t)).data;
    expect((await book(t, 'h1', { impact: 'not_involved', reasonId: 'covered', documents: [] })).error.code).toBe('SCOPE_WITHDRAWAL_REQUIRED');
    expect((await get('P-1')).data.decomposition.handbooks[0].documents).toHaveLength(1);
  });
  test('新增文档保留稳定提案并验证创建后的真实目录', async () => { let t = (await ticket(await imported())).data; t = (await book(t, 'h1', { documents: [{ id: 'proposal', kind: 'new', name: '新增', parentId: 'chapter', ownerId: 'writer' }] })).data; const r = await request('POST', '/P-1/documents/proposal/resolve-new', { expectedRevision: t.revision, handbookId: 'h1', createdDocumentId: 'd2' }, 'writer'); expect(r.status).toBe(200); expect(r.data.decomposition.handbooks[0].documents[0].createdDocumentId).toBe('d2'); });
  test('创建候选先校验幂等键，重放成功不重复外部创建', async () => {
    let t = (await ticket(await imported())).data;
    t = (await book(t, 'h1', { documents: [{ id: 'proposal', kind: 'new', name: '新增', parentId: 'chapter', ownerId: 'writer' }] })).data;
    const body = { expectedRevision: t.revision, handbookId: 'h1' }, suffix = '/P-1/documents/proposal/prepare-new';
    const missing = await fetch(base + suffix, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-user': 'writer' }, body: JSON.stringify(body) });
    expect(missing.status).toBe(428); expect(proposalCalls).toBe(0);
    const first = await request('POST', suffix, body, 'writer', 'proposal-once'); expect(first.status).toBe(200);
    expect((await request('POST', suffix, body, 'writer', 'proposal-once')).data.revision).toBe(first.data.revision);
    expect(proposalCalls).toBe(1);
  });
  test('新增文档定义变化后解除旧交付，历史仍保留；工单草稿禁止处理', async () => {
    let t = (await ticket(await imported())).data;
    t = (await book(t, 'h1', { documents: [{ id: 'proposal', kind: 'new', name: '新增', parentId: 'chapter', ownerId: 'writer' }] })).data;
    t = (await request('POST', '/P-1/documents/proposal/resolve-new', { expectedRevision: t.revision, handbookId: 'h1', createdDocumentId: 'd2' }, 'writer')).data;
    t = (await book(t, 'h1', { documents: [{ id: 'proposal', kind: 'new', name: '重新新增', parentId: 'chapter', ownerId: 'writer' }] })).data;
    expect(t.decomposition.handbooks[0].documents[0].createdDocumentId).toBeUndefined();
    expect(t.scopeHistory.some(h => h.documents?.some(d => d.createdDocumentId === 'd2'))).toBe(true);
    t = (await ticket(t, { confirm: false })).data;
    expect(t.decomposition.handbooks[0].documents[0].canEdit).toBe(false);
    expect((await request('POST', '/P-1/documents/proposal/prepare-new', { expectedRevision: t.revision, handbookId: 'h1' }, 'writer')).status).toBe(422);
  });
  test('完成门禁复用真实审核服务投影：创建、关闭、退回、图片失败不算完成', async () => { let t = (await ticket(await imported())).data; t = (await book(t)).data; t = (await book(t, 'h2', { impact: 'not_involved', reasonId: 'covered' })).data;
    reviewState = { id: 'review', handbookId: 'h1', businessVersion: '23.4', state: 'mr_submitted', handbookSource: { branch: '23.4', documents: [{ documentId: 'd1', branch: '23.4' }] }, reviews: [], createdBy: 'writer', deliveryObservation: { state: 'opened' } };
    t = (await request('POST', '/P-1/documents/d1/link', { expectedRevision: t.revision, handbookId: 'h1', reviewTaskId: 'review' }, 'writer')).data; expect(t.status).toBe('in_progress');
    for (const delivery of [{ state: 'closed' }, { state: 'merged', readback: { status: 'consistent', resources: 'failed' } }]) { reviewState.deliveryObservation = delivery; expect((await get('P-1')).data.status).toBe('in_progress'); }
    reviewState.deliveryObservation = { state: 'closed' };
    const writerQueue = (await request('GET', '/mine', undefined, 'writer')).data;
    expect(writerQueue.items).toEqual(expect.arrayContaining([expect.objectContaining({ actionLabel: '进入编写', state: 'risk' })]));
    expect(writerQueue.following.some(item => item.lineage?.documentId === 'd1')).toBe(false);
    expect((await get('P-1')).data.nextAction).toMatchObject({ label: '进入编写' });
    reviewState.state = 'rejected'; reviewState.deliveryObservation = { state: 'opened' }; expect((await get('P-1')).data.status).toBe('in_progress'); expect((await get('P-1')).data.decomposition.handbooks[0].documents[0].completion.label).toContain('审核已退回'); reviewState.state = 'mr_submitted';
    reviewState.deliveryObservation = { state: 'merged', observedAt: new Date().toISOString(), readback: { status: 'consistent', resources: 'repository_relative_images_verified' } }; expect((await get('P-1')).data.status).toBe('completed'); expect((await request('PATCH', '/P-1', { status: '已完成' })).status).toBe(422);
  });
  test('部分交付后更换目标分支，保留历史但不沿用旧审核完成证据', async () => {
    let t = (await ticket(await imported())).data;
    t = (await book(t)).data;
    t = (await book(t, 'h2', { impact: 'not_involved', reasonId: 'covered' })).data;
    reviewState = { id: 'review-scope', handbookId: 'h1', state: 'mr_submitted',
      candidate: { digest: 'c1', operations: [] }, reviews: [], createdBy: { id: 'writer' },
      handbookSource: { branch: '23.4', documents: [{ documentId: 'd1', branch: '23.4' }] },
      deliveryObservation: { state: 'merged', observedAt: new Date().toISOString(), readback: { status: 'consistent', resources: 'repository_relative_images_verified' } } };
    t = (await request('POST', '/P-1/documents/d1/link', { expectedRevision: t.revision, handbookId: 'h1', reviewTaskId: reviewState.id }, 'writer')).data;
    expect(t.status).toBe('completed');
    const priorVersion = t.decomposition.handbooks[0].scopeVersion;
    catalogOverride = { ...catalog, versions: ['23.4', '24.1'] };
    t = (await book(t, 'h1', { targetVersion: '24.1' })).data;
    expect(t.status).toBe('in_progress');
    expect(t.decomposition.handbooks[0].scopeVersion).toBe(priorVersion + 1);
    expect(t.decomposition.handbooks[0].documents[0].reviewTaskId).toBeNull();
    expect(t.scopeHistory.some(scope => scope.documents?.some(doc => doc.reviewTaskId === reviewState.id))).toBe(true);
  });
  test('审核读取异常在真实任务查询中降级为待处理并保留错误码', async () => {
    let task = (await ticket(await imported())).data;
    task = (await book(task)).data;
    reviewState = { id: 'review-failing-read', handbookId: 'h1', businessVersion: '23.4', state: 'mr_submitted', handbookSource: { branch: '23.4', documents: [{ documentId: 'd1', branch: '23.4' }] }, reviews: [], createdBy: 'writer', deliveryObservation: { state: 'opened' } };
    const linked = await request('POST', '/P-1/documents/d1/link', { expectedRevision: task.revision, handbookId: 'h1', reviewTaskId: reviewState.id }, 'writer');
    expect(linked.status).toBe(200);
    task = linked.data;
    expect(task.decomposition.handbooks[0].documents[0].reviewTaskId).toBe(reviewState.id);
    reviewError = Object.assign(new Error('隔离审核读取失败'), { code: 'REVIEW_UNAVAILABLE' });
    const result = await get('P-1');
    expect(result.status).toBe(200);
    expect(result.data.decomposition.handbooks[0].documents[0].completion).toMatchObject({
      status: 'pending', label: '关联审核不可读取，请检查权限或重新关联', code: 'REVIEW_UNAVAILABLE',
    });
  });
  test('审核提及目标仅返回当前审核关联的已确认手册及目录负责人', async () => {
    let task = (await ticket(await imported())).data;
    task = (await book(task, 'h1')).data;
    task = (await book(task, 'h2', { impact: 'not_involved', reasonId: 'covered', documents: [] })).data;
    reviewState = { id: 'review-mention-targets', handbookId: 'h1', state: 'under_review', candidate: { digest: 'candidate', operations: [] }, reviews: [], handbookSource: { branch: '23.4', documents: [{ documentId: 'd1', branch: '23.4' }] } };
    task = (await request('POST', '/P-1/documents/d1/link', { expectedRevision: task.revision, handbookId: 'h1', reviewTaskId: reviewState.id }, 'writer')).data;
    const result = await request('GET', `/review/${reviewState.id}/mention-targets`, undefined, 'writer');
    expect(result.status).toBe(200);
    expect(result.data).toEqual([expect.objectContaining({ handbookId: 'h1', handbookName: '手册一', ownerId: 'book-owner', ownerName: 'book-owner', ticketNumber: 'P-1', targets: expect.arrayContaining([
      expect.objectContaining({ role: 'handbook_owner', recipientId: 'book-owner' }),
      expect.objectContaining({ role: 'document_first_owner', documentId: 'd1', recipientId: 'writer' }),
    ]) })]);
    expect((await request('GET', `/review/${reviewState.id}/mention-targets`, undefined, 'outsider')).status).toBe(403);
  });
  test('部分文档完成不能完成工单，关联错分支不允许', async () => { let t = (await ticket(await imported())).data; t = (await book(t)).data; t = (await book(t, 'h2')).data; reviewState = { id: 'review', handbookId: 'h1', businessVersion: '版本待核对', handbookSource: { branch: 'wrong', documents: [{ documentId: 'd1', branch: 'wrong' }] }, state: 'approved', reviews: [] }; expect((await request('POST', '/P-1/documents/d1/link', { expectedRevision: t.revision, handbookId: 'h1', reviewTaskId: 'review' }, 'writer')).status).toBe(422); reviewState.handbookSource.branch = '23.4'; reviewState.handbookSource.documents[0].branch = '23.4'; reviewState.deliveryObservation = { state: 'merged', readback: { status: 'consistent', resources: 'repository_relative_images_verified' } }; expect((await request('GET', '/P-1/reviews?handbookId=h1&documentId=d1', undefined, 'writer')).data.map(item => item.id)).toEqual(['review']); t = (await request('POST', '/P-1/documents/d1/link', { expectedRevision: t.revision, handbookId: 'h1', reviewTaskId: 'review' }, 'writer')).data; expect(t.status).toBe('in_progress'); });

  test('范围纠偏需影响预览，打开MR阻止确认，已合并撤出生成核对门禁', async () => {
    let t = (await ticket(await imported(), { handbooks: [{ id: 'h1', ownerId: 'book-owner' }] })).data;
    t = (await book(t, 'h1')).data;
    reviewState = { id: 'review-scope-withdraw', handbookId: 'h1', businessVersion: '23.4', state: 'mr_submitted', handbookSource: { branch: '23.4', documents: [{ documentId: 'd1', branch: '23.4' }] }, reviews: [], createdBy: 'writer', mergeRequest: { iid: 7 }, deliveryObservation: { state: 'opened', observedAt: new Date().toISOString() } };
    t = (await request('POST', `/${t.number}/documents/d1/link`, { expectedRevision: t.revision, handbookId: 'h1', reviewTaskId: reviewState.id }, 'writer')).data;
    const created = await request('POST', `/${t.number}/scope-changes`, { expectedRevision: t.revision, level: 'handbook', handbookId: 'h1', reason: '重复范围', affectedDocuments: [{ handbookId: 'h1', documentId: 'd1' }] }, 'book-owner');
    expect(created.status).toBe(200);
    expect(created.data.affectedDocuments[0].blocked).toBe(true);
    expect((await get(t.number)).data.decomposition.handbooks[0].documents[0].completion.recovery).toBe('scope_correction');
    const proposed = { impact: 'not_involved', reasonId: 'covered', targetVersion: '23.4', documents: [] };
    const beforePreview = (await get(t.number)).data;
    const preview = await request('POST', `/${t.number}/scope-changes/${created.data.id}/preview`, { proposed }, 'book-owner');
    expect(preview.status).toBe(200);
    expect((await get(t.number)).data.revision).toBe(beforePreview.revision);
    let confirmed = await request('POST', `/${t.number}/scope-changes/${created.data.id}/confirm`, { expectedRevision: beforePreview.revision, proposed, impactDigest: preview.data.impactDigest }, 'book-owner');
    expect(confirmed.error.code).toBe('MR_OPEN');
    reviewState.deliveryObservation = { state: 'merged', observedAt: new Date().toISOString(), targetCommit: 'abc123', readback: { status: 'consistent', resources: 'repository_relative_images_verified' } };
    const refreshed = await request('POST', `/${t.number}/scope-changes/${created.data.id}/preview`, { proposed }, 'book-owner');
    confirmed = await request('POST', `/${t.number}/scope-changes/${created.data.id}/confirm`, { expectedRevision: beforePreview.revision, proposed, impactDigest: refreshed.data.impactDigest }, 'book-owner');
    expect(confirmed.status).toBe(200);
    expect(confirmed.data.scopeChecks).toHaveLength(1);
    expect(confirmed.data.scopeChecks[0]).toMatchObject({ status: 'pending', reviewTaskId: reviewState.id, targetCommit: 'abc123' });
    expect(confirmed.data.status).not.toBe('completed');
  });
  test('分页、搜索、责任人与状态筛选', async () => { await imported(); await imported('P-2'); const r = await request('GET', '?pageSize=1&page=2'); expect(r.data.items.length).toBe(1); expect(r.data.total).toBe(2); expect((await request('GET', '?q=P-2&ownerId=owner&status=pending_scope')).data.total).toBe(1); });
  test('个人待办按可信会话责任人及层级确认过滤', async () => {
    let task = await imported();
    expect((await request('GET', '/mine', undefined, 'owner')).data.items.map(item => item.kind)).toEqual(['assign']);
    expect((await request('GET', '/mine', undefined, 'writer')).data.total).toBe(0);
    task = (await ticket(task)).data;
    expect((await request('GET', '/mine', undefined, 'book-owner')).data.items).toHaveLength(2);
    expect((await request('GET', '/P-1', undefined, 'book-owner')).data.nextAction).toMatchObject({ label: '确认文档范围', action: 'book-scope', handbookId: 'h1' });
    expect((await request('GET', '/mine', undefined, 'writer')).data.total).toBe(0);
    task = (await book(task)).data;
    const writer = (await request('GET', '/mine', undefined, 'writer')).data.items;
    expect(writer).toHaveLength(1);
    expect(writer[0]).toMatchObject({ kind: 'document', version: '23.4' });
    expect(writer[0].url).toContain('documentId=d1');
    expect((await request('GET', '/P-1', undefined, 'writer')).data.nextAction).toMatchObject({ label: '进入编写' });
    expect((await request('GET', '/mine?ownerId=writer', undefined, 'next')).data.total).toBe(0);
  });
  test('新增文档和无变更确认的个人待办提供对应动作深链', async () => {
    let task = (await ticket(await imported())).data;
    task = (await book(task, 'h1', { documents: [{ id: 'proposal', kind: 'new', name: '新增', parentId: 'chapter', ownerId: 'writer' }] })).data;
    const writing = (await request('GET', '/mine', undefined, 'writer')).data.items;
    expect(writing).toEqual([expect.objectContaining({ actionLabel: '创建/关联新增文档' })]);
    expect(writing[0].url).toContain('action=new-document&handbookId=h1&documentId=proposal');
    expect((await request('GET', '/P-1', undefined, 'writer')).data.nextAction).toMatchObject({ action: 'new-document', handbookId: 'h1', documentId: 'proposal' });

    let unchanged = await imported('P-2');
    unchanged = (await ticket(unchanged, { ticketImpact: 'not_involved', reasonId: 'covered', handbooks: [] })).data;
    const completion = (await request('GET', '/mine', undefined, 'owner')).data.items.find(item => item.id === 'ticket:P-2:complete');
    expect(completion).toMatchObject({ actionLabel: '确认不涉及并完成', url: '/knowledge-center/document-tasks?task=P-2&action=complete' });
    expect((await request('GET', '/P-2', undefined, 'writer')).data.nextAction).toBeNull();
    expect((await request('POST', '/P-2/complete', { expectedRevision: unchanged.revision }, 'writer')).status).toBe(403);
  });
  test('本人无当前动作时按业务阶段显示等待事项，交付标签来自审核投影', async () => {
    let task = (await ticket(await imported())).data;
    const owner = (await request('GET', '/mine')).data;
    expect(owner.items).toHaveLength(0);
    expect(owner.following).toHaveLength(2);
    expect(owner.following.map(item => item.lineage.handbookId)).toEqual(['h1', 'h2']);
    expect(owner.following[0]).toMatchObject({ number: 'P-1', kind: 'assign', status: '等待他人确认范围' });
    task = (await book(task)).data;
    const writing = (await request('GET', '/mine', undefined, 'writer')).data;
    expect(writing.items[0].lineage).toMatchObject({ ticketNumber: 'P-1', handbookId: 'h1', documentId: 'd1' });
    expect(writing.following).toHaveLength(0);
    reviewState = { id: 'review', handbookId: 'h1', businessVersion: '23.4', state: 'mr_submitted', handbookSource: { branch: '23.4', documents: [{ documentId: 'd1', branch: '23.4' }] }, reviews: [], createdBy: 'writer', deliveryObservation: { state: 'opened' } };
    task = (await request('POST', '/P-1/documents/d1/link', { expectedRevision: task.revision, handbookId: 'h1', reviewTaskId: 'review' }, 'writer')).data;
    const following = (await request('GET', '/mine', undefined, 'writer')).data;
    expect(following.items).toHaveLength(0);
    expect(following.following[0]).toMatchObject({ id: 'wait:document:P-1:h1:d1', kind: 'merge', taskType: '文档发布' });
    expect(following.following[0].status).toBe(task.decomposition.handbooks[0].documents[0].completion.label);
    expect((await request('GET', '/mine?ownerId=writer', undefined, 'next')).data.following).toHaveLength(0);
  });
  test('计划只允许责任人修改，验证时间范围、并发、幂等和实际时间隔离', async () => {
    let t = await imported();
    const body = { expectedRevision: t.revision, plannedStartTime: '2026-11-02T01:00:00.000Z', plannedEndTime: '2026-11-06T10:00:00.000Z', operatorId: 'owner' };
    expect((await request('PUT', '/P-1/plan', body, 'writer')).status).toBe(403);
    for (const bad of ['2026-02-30T01:00:00.000Z', 'no', '', 123, '2026-11-02']) expect((await request('PUT', '/P-1/plan', { ...body, plannedStartTime: bad })).status).toBe(422);
    expect((await request('PUT', '/P-1/plan', { ...body, plannedEndTime: '2026-11-01T00:00:00.000Z' })).status).toBe(422);
    expect((await request('PUT', '/P-1/plan', { expectedRevision: t.revision })).status).toBe(422);
    t = (await request('PUT', '/P-1/plan', body, 'owner', 'plan-once')).data;
    expect(t.plannedStartTime).toBe(body.plannedStartTime); expect(t.startTime).toBe(null); expect(t.endTime).toBe(null); expect(t.status).toBe('pending_scope');
    expect(t.assignmentHistory.at(-1)).toMatchObject({ type: 'plan', operatorId: 'owner', previous: { plannedStartTime: null, plannedEndTime: null } });
    expect((await request('PUT', '/P-1/plan', body, 'owner', 'plan-once')).data.revision).toBe(t.revision);
    expect((await request('PUT', '/P-1/plan', body)).status).toBe(409);
    t = (await request('PUT', '/P-1/plan', { expectedRevision: t.revision, plannedStartTime: null })).data;
    expect(t.plannedStartTime).toBe(null); expect(t.plannedEndTime).toBe(body.plannedEndTime);
    t = (await ticket(t, { ticketImpact: 'not_involved', reasonId: 'covered' })).data;
    expect(t.startTime).toBeTruthy(); expect(t.plannedEndTime).toBe(body.plannedEndTime);
    t = (await request('POST', '/P-1/complete', { expectedRevision: t.revision })).data;
    expect(t.status).toBe('completed'); expect(t.endTime).toBeTruthy(); expect(t.plannedEndTime).toBe(body.plannedEndTime);
  });
  test('管理员可从列表编辑其他责任人的时间，普通非责任人不可编辑', async () => {
    let t = await imported();
    t = (await request('PUT', '/P-1/owner', { expectedRevision: t.revision, ownerId: 'next' })).data;
    expect(t.canEditPlan).toBe(true);
    expect((await request('GET', '/P-1', undefined, 'writer')).data.canEditPlan).toBe(false);
    const result = await request('PUT', '/P-1/plan', { expectedRevision: t.revision, plannedStartTime: '2026-11-02T01:00:00.000Z' });
    expect(result.status).toBe(200); expect(result.data.ownerId).toBe('next');
    expect(result.data.assignmentHistory.at(-1).operatorId).toBe('owner');
    expect((await request('GET', '/P-1', undefined, 'next')).data.canEditPlan).toBe(true);
    expect((await get('P-1')).data.plannedStartTime).toBe('2026-11-02T01:00:00.000Z');
  });
  test('XLSX原始超链接预览不写入，重导保留计划及分派，不拼接来源', async () => {
    const XLSX = require('xlsx');
    const sheet = XLSX.utils.json_to_sheet([{ 编号: 'X-1', 标题: '真实链接' }, { 编号: 'X-2', 标题: '无链接' }]);
    sheet.A2.l = { Target: 'https://pingcode.yasdb.com/pjm/workitems/opaque' };
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, '工单');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const upload = async (preview, digest) => { const form = new FormData(); form.append('file', new Blob([buffer]), 'test.xlsx'); if (digest) form.append('digest', digest); const r = await fetch(base + '/import?preview=' + preview, { method: 'POST', headers: { 'Idempotency-Key': 'xlsx-' + (++serial) }, body: form }); return { status: r.status, ...(await r.json()) }; };
    const p = await upload(true); expect(p.data.summary.created).toBe(2); expect((await request('GET', '')).data.total).toBe(0);
    expect((await upload(false, p.data.digest)).status).toBe(200);
    let t = (await get('X-1')).data; expect(t.sourceUrl).toBe(sheet.A2.l.Target); expect((await get('X-2')).data.sourceUrl).toBe(null);
    t = (await request('PUT', '/X-1/plan', { expectedRevision: t.revision, plannedStartTime: '2026-11-02T01:00:00.000Z' })).data;
    const rows = [{ number: 'X-1', title: '新标题' }], pre = await request('POST', '/import?preview=true', { tasks: rows });
    await request('POST', '/import', { tasks: rows, digest: pre.data.digest });
    const after = (await get('X-1')).data; expect(after.sourceUrl).toBe(t.sourceUrl); expect(after.plannedStartTime).toBe(t.plannedStartTime); expect(after.ownerId).toBe(t.ownerId); expect(after.decomposition).toEqual(t.decomposition);
    const same = await upload(true); await upload(false, same.data.digest); expect((await upload(true)).data.summary.unchanged).toBe(2);
    for (const url of ['javascript:alert(1)', 'http://pingcode.yasdb.com/a', 'https://user:pass@example.com/']) expect((await request('POST', '/import?preview=true', { tasks: [{ number: 'BAD', sourceUrl: url }] })).data.summary.error).toBe(1);
  });
  test('直接内部API拒绝请求体和请求头身份', async () => { const app = express(); app.use('/api', createDocumentTaskRouter({ filePath: path.join(directory, 'private.json') })); const privateServer = await new Promise(resolve => { const s = app.listen(0, () => resolve(s)); }); try { const response = await fetch(`http://127.0.0.1:${privateServer.address().port}/api`, { headers: { 'x-actor-id': 'owner' } }); expect(response.status).toBe(403); } finally { await new Promise(resolve => privateServer.close(resolve)); } });
});
