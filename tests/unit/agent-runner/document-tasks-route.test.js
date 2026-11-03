const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDocumentTaskRouter } = require('../../../packages/agent-runner-core/routes/document-tasks');
const { IncrementalBuildService } = require('../../../packages/agent-runner-core/lib/incremental-build-service');
const people = ['owner', 'book-owner', 'writer', 'next'].map(id => ({ id, displayName: id }));
const catalog = { versions: ['23.4'], documents: [{ id: 'd1', name: '安装', parentId: 'chapter' }, { id: 'd2', name: '新增', parentId: 'chapter' }], chapters: [{ id: 'chapter', name: '第一章' }] };
let reviewState, proposalCalls;
const context = req => {
  const id = req.get('x-test-user') || 'owner';
  return { session: { user: { id: `auth-${id}`, principalId: id, allowedActions: ['knowledge:read', 'knowledge:write', 'outline:create', ...(id === 'owner' ? ['platform:manage'] : [])] } }, people, handbooks: [{ id: 'h1', name: '手册一' }, { id: 'h2', name: '手册二' }], catalog: async () => catalog, createDocument: async () => { proposalCalls++; return { outlineId: 'new-candidate', documentId: 'd2' }; },
    reviewService: { list: () => reviewState ? [{ id: reviewState.id }] : [], get: () => IncrementalBuildService.prototype.project.call({ isOwner: () => false, canComment: () => false }, reviewState, { user: { id, allowedActions: [] } }) } };
};
describe('任务管理真实HTTP契约', () => {
  let server, base, directory;
  beforeEach(async () => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'task-v2-')); reviewState = null; proposalCalls = 0; const app = express(); app.use('/api', createDocumentTaskRouter({ filePath: path.join(directory, 'state.json'), defaultOwnerId: 'owner', context })); server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); base = `http://127.0.0.1:${server.address().port}/api`; });
  afterEach(async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(directory, { recursive: true, force: true }); });
  let serial = 0;
  async function request(method, suffix, body, user = 'owner', key) { const response = await fetch(base + suffix, { method, headers: { 'Content-Type': 'application/json', 'x-test-user': user, 'Idempotency-Key': key || `test-${++serial}` }, body: body === undefined ? undefined : JSON.stringify(body) }); const json = await response.json(); return { status: response.status, ...json }; }
  const get = number => request('GET', '/' + number);
  async function imported(number = 'P-1') { const tasks = [{ number, title: '连接说明', ownerId: 'writer', status: '关闭', startTime: '2000-01-01' }]; const p = await request('POST', '/import?preview=true', { tasks }); const result = await request('POST', '/import', { tasks, digest: p.data.digest }); expect(result.status).toBe(200); return (await get(number)).data; }
  async function ticket(task, fields = {}) { return request('PUT', `/${task.number}/decomposition`, { expectedRevision: task.revision, confirm: true, ticketImpact: 'involved', handbooks: [{ id: 'h1', ownerId: 'book-owner' }, { id: 'h2', ownerId: 'book-owner' }], ...fields }); }
  async function book(task, id = 'h1', fields = {}) { return request('PUT', `/${task.number}/handbooks/${id}`, { expectedRevision: task.revision, confirm: true, impact: 'involved', targetVersion: '23.4', documents: [{ id: 'd1', ownerId: 'writer' }], ...fields }, 'book-owner'); }
  test('预览不写入、全局编号去重和错误行', async () => { const preview = await request('POST', '/import?preview=true', { tasks: [{ number: 'P-1' }, { number: 'P-1' }, {}] }); expect(preview.data.summary).toEqual({ created: 1, updated: 0, unchanged: 0, error: 2 }); expect((await request('GET', '')).data.total).toBe(0); expect(fs.existsSync(path.join(directory, 'state.json'))).toBe(false); });
  test('新任务只使用配置责任人和平台时间，保留来源状态', async () => { const t = await imported(); expect(t.ownerId).toBe('owner'); expect(t.startTime).toBe(null); expect(t.sourceStatus).toBe('关闭'); expect(t.status).toBe('pending_scope'); });
  test('重复导入更新来源，保留分派、历史、已确认范围', async () => { let t = (await ticket(await imported())).data; const tasks = [{ number: t.number, title: '新标题' }]; const p = await request('POST', '/import?preview=true', { tasks }); expect(p.data.summary.updated).toBe(1); await request('POST', '/import', { tasks, digest: p.data.digest }); const next = (await get(t.number)).data; expect(next.description).toBe('新标题'); expect(next.ownerId).toBe('owner'); expect(next.decomposition).toEqual(t.decomposition); expect(next.assignmentHistory.length).toBeGreaterThan(t.assignmentHistory.length); const same = await request('POST', '/import?preview=true', { tasks }); expect(same.data.summary.unchanged).toBe(1); });
  test('过期预览被拒绝；默认配置只影响新任务', async () => { const a = await imported(); const p = await request('POST', '/import?preview=true', { tasks: [{ number: 'P-2' }] }); const c = (await request('GET', '/config')).data; expect((await request('PUT', '/config', { expectedRevision: c.revision, defaultOwnerId: 'next' })).status).toBe(200); expect((await request('POST', '/import', { tasks: [{ number: 'P-2' }], digest: p.data.digest })).status).toBe(409); const b = await imported('P-2'); expect(b.ownerId).toBe('next'); expect((await get(a.number)).data.ownerId).toBe('owner'); });
  test('两个层次独立确认，可保存草稿且不自动生成决定', async () => { let t = await imported(); t = (await ticket(t, { confirm: false, handbooks: [{ id: 'h1' }] })).data; expect(t.status).toBe('pending_scope'); expect(t.decomposition.handbooks[0].impact).toBe(null); t = (await ticket(t)).data; expect(t.startTime).toBeTruthy(); expect(t.decomposition.handbooks.every(b => !b.confirmed)).toBe(true); t = (await book(t)).data; expect(t.decomposition.handbooks[0].confirmed).toBe(true); expect(t.decomposition.handbooks[1].confirmed).toBe(false); });
  test('两级不涉及必须选理由，其他需要补充且总责任人确认完成', async () => { let t = await imported(); expect((await ticket(t, { ticketImpact: 'not_involved', reasonId: 'other' })).status).toBe(422); t = (await ticket(t, { ticketImpact: 'not_involved', reasonId: 'covered' })).data; expect(t.status).toBe('in_progress'); expect((await request('POST', '/P-1/complete', { expectedRevision: t.revision }, 'writer')).status).toBe(403); t = (await request('POST', '/P-1/complete', { expectedRevision: t.revision })).data; expect(t.status).toBe('completed'); expect(t.endTime).toBeTruthy(); });
  test('全部手册不涉及仍须总责任人确认', async () => { let t = (await ticket(await imported())).data; expect((await book(t, 'h1', { impact: 'not_involved' })).status).toBe(422); t = (await book(t, 'h1', { impact: 'not_involved', reasonId: 'covered' })).data; t = (await book(t, 'h2', { impact: 'not_involved', reasonId: 'no_impact' })).data; expect(t.status).toBe('in_progress'); expect((await request('POST', '/P-1/complete', { expectedRevision: t.revision })).data.status).toBe('completed'); });
  test('有效人员、真实版本与目录边界服务端验证', async () => { let t = await imported(); expect((await ticket(t, { handbooks: [{ id: 'h1', ownerId: 'fake' }] })).status).toBe(422); expect((await ticket(t, { handbooks: [{ id: 'hidden', ownerId: 'writer' }] })).status).toBe(403); t = (await ticket(t)).data; expect((await book(t, 'h1', { targetVersion: 'fake' })).status).toBe(422); expect((await book(t, 'h1', { documents: [{ id: 'fake', ownerId: 'writer' }] })).status).toBe(422); });
  test('可信会话校验操作者，伪造请求体无效', async () => { const t = await imported(); expect((await request('PUT', '/P-1/decomposition', { ...t.decomposition, confirm: true, expectedRevision: t.revision, operatorId: 'owner', ticketImpact: 'not_involved', reasonId: 'covered' }, 'writer')).status).toBe(403); expect((await request('PUT', '/config', { expectedRevision: 0, defaultOwnerId: 'writer' }, 'writer')).status).toBe(403); });
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
    expect(t.decomposition.handbooks[0].documents).toEqual(confirmedBook.documents);
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
    reviewState = { id: 'review', handbookId: 'h1', businessVersion: '23.4', state: 'mr_submitted', handbookSource: { documents: [{ documentId: 'd1' }] }, reviews: [], createdBy: 'writer', deliveryObservation: { state: 'opened' } };
    t = (await request('POST', '/P-1/documents/d1/link', { expectedRevision: t.revision, handbookId: 'h1', reviewTaskId: 'review' }, 'writer')).data; expect(t.status).toBe('in_progress');
    for (const delivery of [{ state: 'closed' }, { state: 'merged', readback: { status: 'consistent', resources: 'failed' } }]) { reviewState.deliveryObservation = delivery; expect((await get('P-1')).data.status).toBe('in_progress'); }
    reviewState.state = 'rejected'; reviewState.deliveryObservation = { state: 'opened' }; expect((await get('P-1')).data.status).toBe('in_progress'); expect((await get('P-1')).data.decomposition.handbooks[0].documents[0].completion.label).toContain('审核退回'); reviewState.state = 'mr_submitted';
    reviewState.deliveryObservation = { state: 'merged', observedAt: new Date().toISOString(), readback: { status: 'consistent', resources: 'repository_relative_images_verified' } }; expect((await get('P-1')).data.status).toBe('completed'); expect((await request('PATCH', '/P-1', { status: '已完成' })).status).toBe(422);
  });
  test('部分文档完成不能完成工单，关联错版本不允许', async () => { let t = (await ticket(await imported())).data; t = (await book(t)).data; t = (await book(t, 'h2')).data; reviewState = { id: 'review', handbookId: 'h1', businessVersion: 'wrong', handbookSource: { documents: [{ documentId: 'd1' }] }, state: 'approved', reviews: [] }; expect((await request('POST', '/P-1/documents/d1/link', { expectedRevision: t.revision, handbookId: 'h1', reviewTaskId: 'review' }, 'writer')).status).toBe(422); reviewState.businessVersion = '23.4'; reviewState.deliveryObservation = { state: 'merged', readback: { status: 'consistent', resources: 'repository_relative_images_verified' } }; t = (await request('POST', '/P-1/documents/d1/link', { expectedRevision: t.revision, handbookId: 'h1', reviewTaskId: 'review' }, 'writer')).data; expect(t.status).toBe('in_progress'); });
  test('分页、搜索、责任人与状态筛选', async () => { await imported(); await imported('P-2'); const r = await request('GET', '?pageSize=1&page=2'); expect(r.data.items.length).toBe(1); expect(r.data.total).toBe(2); expect((await request('GET', '?q=P-2&ownerId=owner&status=pending_scope')).data.total).toBe(1); });
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
