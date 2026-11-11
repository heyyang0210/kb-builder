const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const {
  FileIncrementalBuildRepository,
  MemoryIncrementalBuildRepository,
  IncrementalBuildService,
  createIncrementalBuildHandler,
} = require('../../../packages/agent-runner-core/lib/incremental-build-service');

const editor = {
  user: { id: 'editor-1', displayName: '作者' },
  allowedActions: ['knowledge:read', 'knowledge:write'],
};
const reviewer = {
  user: { id: 'reviewer-1', displayName: '审核者' },
  allowedActions: ['knowledge:read', 'knowledge:write', 'review:manage', 'publish:manage'],
};
const otherEditor = {
  user: { id: 'editor-2', displayName: '其他作者' },
  allowedActions: ['knowledge:read', 'knowledge:write'],
};
const initialState = () => ({
  schemaVersion: 1,
  tasks: [],
  publishedVersions: [
    { id: 'baseline-v1', handbookId: 'DB-001', businessVersion: '23.4.5.100', current: true, contentDigest: 'digest-baseline' },
    { id: 'v1', handbookId: 'DB-001', businessVersion: '23.4', current: true, contentDigest: 'digest-v1', content: '# YashanDB 产品规格\n\n<span id="YFS"></span>物理规格正文。' },
  ],
  idempotency: {}, audits: [],
});

function startApi() {
  const repository = new MemoryIncrementalBuildRepository(initialState());
  const service = new IncrementalBuildService(repository);
  const handler = createIncrementalBuildHandler({ service });
  const server = http.createServer((req, res) => {
    const session = req.headers['x-test-actor'] === 'reviewer' ? reviewer : req.headers['x-test-actor'] === 'other' ? otherEditor : editor;
    handler(req, res, session);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, repository, service, baseUrl: `http://127.0.0.1:${server.address().port}` })));
}

async function request(baseUrl, method, pathname, body, key, who = 'editor') {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-test-actor': who,
      ...(key ? { 'idempotency-key': key } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

function updateOperation(documentId = 'doc-install', nodeId = 'section-1') {
  return { type: 'update', documentId, nodeId, beforeDigest: 'before-digest', after: { content: '更新后内容' } };
}

async function buildApprovedCandidate(baseUrl, suffix = 'a', baselineVersionId = 'baseline-v1') {
  const created = await request(baseUrl, 'POST', '/knowledge-center/api/incremental-tasks', {
    name: `安装手册增量 ${suffix}`, handbookId: 'DB-001', businessVersion: '23.4.5.100', baselineVersionId,
  }, `create-${suffix}`);
  const taskId = created.body.data.id;
  await request(baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/sources`, { sourceType: 'manual', label: 'SR 需求', reference: `SR-${suffix}`, content: '需要更新安装步骤' }, `source-${suffix}`);
  await request(baseUrl, 'PATCH', `/knowledge-center/api/incremental-tasks/${taskId}/target`, { documentIds: ['doc-install'], sectionIds: ['section-1'], language: 'zh-CN' }, `target-${suffix}`);
  await request(baseUrl, 'PUT', `/knowledge-center/api/incremental-tasks/${taskId}/draft`, { editVersion: 0, content: '# 新安装步骤', operations: [updateOperation()] }, `draft-${suffix}`);
  await request(baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/checks`, {}, `checks-${suffix}`);
  const candidate = await request(baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/candidate`, {}, `candidate-${suffix}`);
  const review = await request(baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/reviews`, {}, `review-${suffix}`);
  await request(baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/reviews/${review.body.data.id}/decision`, { decision: 'approve', comment: '检视通过' }, `decision-${suffix}`, 'reviewer');
  return { taskId, candidate: candidate.body.data };
}

describe('P0 平台内增量构建 API', () => {
  let api;
  beforeEach(async () => { api = await startApi(); });
  afterEach(() => new Promise(resolve => api.server.close(resolve)));

  test('真实 HTTP 闭环：来源快照、范围、草稿、检查、候选、审核、发布和外部证据', async () => {
    const { taskId, candidate } = await buildApprovedCandidate(api.baseUrl);
    const published = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/publish`, { expectedCandidateDigest: candidate.digest }, 'publish-a', 'reviewer');
    expect(published).toMatchObject({ status: 200, body: { success: true, data: { handbookId: 'DB-001', baseVersionId: 'baseline-v1' } } });

    const evidence = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/external-evidence`, { type: 'gitlab_mr', reference: 'MR-100', status: 'merged' }, 'evidence-a', 'reviewer');
    expect(evidence.body.data).toMatchObject({ type: 'gitlab_mr', reference: 'MR-100', status: 'merged' });

    const detail = await request(api.baseUrl, 'GET', `/knowledge-center/api/incremental-tasks/${taskId}`);
    expect(detail.body.data).toMatchObject({ state: 'published', checks: { passed: true }, publication: { id: published.body.data.id } });
    expect(detail.body.data.sourceSnapshots[0]).toMatchObject({ sourceType: 'manual', contentDigest: expect.any(String) });
    expect(detail.body.data).toMatchObject({ capabilities: { canEdit: false }, candidateSummary: { operationCount: 1 }, reviewSummary: { approved: 1 } });
  });

  test('逐篇审核：一篇通过时任务仍审核中，范围内全部通过后才可发布', async () => {
    const created = await request(api.baseUrl, 'POST', '/knowledge-center/api/incremental-tasks', {
      name: '双文档逐篇审核', handbookId: 'DB-001', businessVersion: '23.4.5.100', baselineVersionId: 'baseline-v1',
    }, 'per-doc-create');
    const taskId = created.body.data.id;
    await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/sources`, { sourceType: 'manual', label: '需求', reference: 'PER-DOC', content: '更新两个文档' }, 'per-doc-source');
    await request(api.baseUrl, 'PATCH', `/knowledge-center/api/incremental-tasks/${taskId}/target`, { documentIds: ['doc-a', 'doc-b'], sectionIds: ['section-a', 'section-b'], language: 'zh-CN' }, 'per-doc-target');
    await request(api.baseUrl, 'PUT', `/knowledge-center/api/incremental-tasks/${taskId}/draft`, { editVersion: 0, content: '# 双文档', operations: [updateOperation('doc-a', 'section-a'), updateOperation('doc-b', 'section-b')] }, 'per-doc-draft');
    await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/checks`, {}, 'per-doc-checks');
    await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/candidate`, {}, 'per-doc-candidate');
    api.repository.transaction(state => { state.tasks.find(item => item.id === taskId).handbookSource = { documents: [{ documentId: 'doc-a', title: '文档 A', reviewerIds: ['reviewer-1'] }, { documentId: 'doc-b', title: '文档 B', reviewerIds: ['reviewer-1'] }] }; });
    const submitted = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/reviews`, {}, 'per-doc-review');
    expect(submitted.body.data).toHaveLength(2);
    const [first, second] = submitted.body.data;
    const firstDecision = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/reviews/${first.id}/decision`, { decision: 'approve', candidateDigest: first.candidateDigest }, 'per-doc-decision-a', 'reviewer');
    expect(firstDecision.body.data).toMatchObject({ documentId: 'doc-a', status: 'approved' });
    expect((await request(api.baseUrl, 'GET', `/knowledge-center/api/incremental-tasks/${taskId}`)).body.data.state).toBe('under_review');
    const premature = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/publish`, { expectedCandidateDigest: first.candidateDigest }, 'per-doc-publish', 'reviewer');
    expect(premature.body.error.code).toBe('GITLAB_MR_REQUIRED');
    await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/reviews/${second.id}/decision`, { decision: 'approve', candidateDigest: second.candidateDigest }, 'per-doc-decision-b', 'reviewer');
    expect((await request(api.baseUrl, 'GET', `/knowledge-center/api/incremental-tasks/${taskId}`)).body.data.state).toBe('approved');
  });

  test.each([false, true])('真实HTTP：客户端候选摘要拒绝零副作用及幂等重放（手册=%s）', async handbook => {
    const taskId = 'digest-task'; const reviewId = 'digest-review';
    api.repository.transaction(state => state.tasks.push({
      id: taskId, handbookId: 'DB-001', state: 'under_review', createdBy: editor.user,
      candidate: { id: 'candidate', digest: 'frozen-digest', operations: [], content: '# 冻结正文' },
      reviews: [{ id: reviewId, status: 'pending', candidateDigest: 'frozen-digest', reviewerIds: ['reviewer-1'], comments: [] }],
      ...(handbook ? { handbookSource: { documents: [{ documentId: 'doc', reviewerIds: ['reviewer-1'] }] } } : {}),
    }));
    const endpoint = `/knowledge-center/api/incremental-tasks/${taskId}/reviews/${reviewId}/decision`;
    const before = api.repository.read();
    for (const decision of ['approve', 'reject']) {
      for (const candidateDigest of ['stale', '', null, 42, { digest: 'frozen-digest' }]) {
        const result = await request(api.baseUrl, 'POST', endpoint, { decision, candidateDigest, comment: '需要修改' }, 'digest-retry', 'reviewer');
        expect(result).toMatchObject({ status: 409, body: { error: { code: 'REVIEW_CANDIDATE_CONFLICT' } } });
        expect(api.repository.read()).toEqual(before);
      }
    }
    const body = { decision: 'approve', candidateDigest: 'frozen-digest' };
    const accepted = await request(api.baseUrl, 'POST', endpoint, body, 'digest-retry', 'reviewer');
    expect(accepted).toMatchObject({ status: 200, body: { data: { status: 'approved' } } });
    const after = api.repository.read();
    expect(after.tasks[0].candidate).toEqual(before.tasks[0].candidate);
    expect(after.audits).toHaveLength(1);
    expect((await request(api.baseUrl, 'POST', endpoint, body, 'digest-retry', 'reviewer')).body).toEqual(accepted.body);
    expect(api.repository.read()).toEqual(after);
    expect(await request(api.baseUrl, 'POST', endpoint, { ...body, candidateDigest: 'stale' }, 'digest-retry', 'reviewer')).toMatchObject({ status: 409, body: { error: { code: 'IDEMPOTENCY_KEY_REUSED' } } });
    expect(await request(api.baseUrl, 'POST', endpoint, body, 'new-digest-key', 'reviewer')).toMatchObject({ status: 409, body: { error: { code: 'REVIEW_ALREADY_DECIDED' } } });
    expect(api.repository.read()).toEqual(after);
  });

  test('基线必须来自已发布事实，并提供只读查询', async () => {
    const baselines = await request(api.baseUrl, 'GET', '/knowledge-center/api/incremental-tasks/baselines?handbookId=DB-001&businessVersion=23.4');
    expect(baselines.body.data).toEqual([{ id: 'v1', handbookId: 'DB-001', businessVersion: '23.4', current: true, contentDigest: 'digest-v1', publishedAt: null }]);
    const missing = await request(api.baseUrl, 'POST', '/knowledge-center/api/incremental-tasks', { name: '无基线', handbookId: 'DB-001', businessVersion: '23.4', baselineVersionId: 'typed-by-user' }, 'missing-baseline');
    expect(missing).toMatchObject({ status: 422, body: { error: { code: 'BASELINE_NOT_FOUND' } } });
  });

  test('我的生成只投影当前用户发起或实际参与的持久化运行', () => {
    api.repository.transaction(state => {
      state.tasks.push(
        {
          id: 'task-own', name: '我发起的生成', handbookId: 'DB-001', state: 'editing', createdBy: editor.user,
          generationRun: { id: 'gen-own', status: 'running', initiatedBy: editor.user, participants: [], progress: 40, updatedAt: '2026-09-28T08:00:00.000Z' },
          reviews: [], updatedAt: '2026-09-28T08:00:00.000Z',
        },
        {
          id: 'task-participated', name: '我参与的生成', handbookId: 'DB-001', state: 'under_review', createdBy: otherEditor.user,
          generationRuns: [{ runId: 'gen-participated', status: 'completed', initiatedBy: otherEditor.user, participants: [editor.user], resultSummary: { text: '已形成草稿', privatePrompt: '不得返回' }, updatedAt: '2026-09-28T09:00:00.000Z' }],
          reviews: [], updatedAt: '2026-09-28T09:00:00.000Z',
        },
        {
          id: 'task-visible-only', name: '只是可读', handbookId: 'DB-001', state: 'under_review', createdBy: otherEditor.user,
          generationRun: { id: 'gen-visible-only', status: 'completed', initiatedBy: otherEditor.user, participants: [] },
          reviews: [], updatedAt: '2026-09-28T10:00:00.000Z',
        },
        { id: 'task-without-run', name: '没有运行事实', handbookId: 'DB-001', state: 'draft', createdBy: editor.user, reviews: [] },
      );
    });
    const result = new IncrementalBuildService(api.repository).listMyGenerations(editor, { scope: 'mine' });
    expect(result.items.map(item => item.generationId)).toEqual(['gen-participated', 'gen-own']);
    expect(result.items[0]).toMatchObject({ association: 'participant', resultSummary: '已形成草稿', nextAction: { type: 'open_generation' } });
    expect(result.items[0].completion).toMatchObject({ status: 'pending', label: '待合并回读', criteria: expect.arrayContaining(['gitlab_merged']) });
    expect(result.items[0]).not.toHaveProperty('privatePrompt');
    expect(result.items.find(item => item.generationId === 'gen-visible-only')).toBeUndefined();
    expect(() => new IncrementalBuildService(api.repository).listMyGenerations(editor, { scope: 'mine', userId: 'editor-2' }))
      .toThrow(expect.objectContaining({ code: 'GENERATION_USER_FILTER_FORBIDDEN', status: 422 }));
  });

  test('知识编辑者可对非自有待审核任务提意见，但不能读取或修改任务', async () => {
    const created = await request(api.baseUrl, 'POST', '/knowledge-center/api/incremental-tasks', { name: '归属验证', handbookId: 'DB-001', businessVersion: '23.4', baselineVersionId: 'v1' }, 'owner-create');
    const id = created.body.data.id;
    expect((await request(api.baseUrl, 'GET', '/knowledge-center/api/incremental-tasks', undefined, undefined, 'other')).body.data).toEqual([]);
    expect(await request(api.baseUrl, 'GET', `/knowledge-center/api/incremental-tasks/${id}`, undefined, undefined, 'other')).toMatchObject({ status: 404, body: { error: { code: 'INCREMENTAL_TASK_NOT_FOUND' } } });
    expect(await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/sources`, { sourceType: 'manual', label: '越权', content: 'x' }, 'other-source', 'other')).toMatchObject({ status: 404, body: { error: { code: 'INCREMENTAL_TASK_NOT_FOUND' } } });

    await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/sources`, { sourceType: 'manual', label: '来源', content: 'x' }, 'owner-source');
    await request(api.baseUrl, 'PATCH', `/knowledge-center/api/incremental-tasks/${id}/target`, { documentIds: ['doc-1'] }, 'owner-target');
    await request(api.baseUrl, 'PUT', `/knowledge-center/api/incremental-tasks/${id}/draft`, { editVersion: 0, content: '# x', operations: [updateOperation('doc-1', 'node-1')] }, 'owner-draft');
    await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/checks`, {}, 'owner-checks');
    await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/candidate`, {}, 'owner-candidate');
    const submitted = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/reviews`, {}, 'owner-review');
    const reviewView = await request(api.baseUrl, 'GET', `/knowledge-center/api/incremental-tasks/${id}`, undefined, undefined, 'reviewer');
    expect(reviewView.body.data.capabilities).toMatchObject({ canEdit: false, canReview: true, canComment: true, canPublish: false });
    expect((await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/reviews/${submitted.body.data.id}/comments`, { comment: '审核意见' }, 'reviewer-comment', 'reviewer')).status).toBe(200);
    const editorComment = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/reviews/${submitted.body.data.id}/comments`, { comment: '请补充参数版本约束' }, 'other-comment', 'other');
    expect(editorComment).toMatchObject({ status: 200, body: { data: { commentType: 'suggestion', severity: 'normal', mode: 'global', content: '请补充参数版本约束' } } });
    const invalidSeverity = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/reviews/${submitted.body.data.id}/comments`, { comment: '旧的重要级别不可再提交', severity: 'important' }, 'other-important', 'other');
    expect(invalidSeverity).toMatchObject({ status: 422, body: { error: { code: 'COMMENT_SEVERITY_INVALID' } } });
    api.repository.transaction(state => {
      state.tasks.find(task => task.id === id).reviews[0].comments.push({
        id: 'legacy-important-comment', content: '历史重要意见', body: '历史重要意见',
        author: { id: 'legacy-user', displayName: '历史用户' }, severity: 'important', commentType: 'issue', mode: 'global', resolved: false,
      });
    });
    const legacyDetail = await request(api.baseUrl, 'GET', `/knowledge-center/api/incremental-tasks/${id}`, undefined, undefined, 'reviewer');
    expect(legacyDetail.body.data.reviews[0].comments).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'legacy-important-comment', severity: 'important' })]));
    const reviewerEdit = await request(api.baseUrl, 'PUT', `/knowledge-center/api/incremental-tasks/${id}/draft`, { editVersion: 1, content: '# changed', operations: [{ type: 'update' }] }, 'reviewer-edit', 'reviewer');
    expect(reviewerEdit.status).toBe(404);
  });

  test('所有写操作必须使用幂等键，重放返回同一任务，异请求复用键被阻断', async () => {
    const body = { name: '增量任务', handbookId: 'DB-001', businessVersion: '23.4', baselineVersionId: 'v1' };
    expect((await request(api.baseUrl, 'POST', '/knowledge-center/api/incremental-tasks', body)).body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    const first = await request(api.baseUrl, 'POST', '/knowledge-center/api/incremental-tasks', body, 'same-key');
    const replay = await request(api.baseUrl, 'POST', '/knowledge-center/api/incremental-tasks', body, 'same-key');
    expect(replay.body.data.id).toBe(first.body.data.id);
    const conflict = await request(api.baseUrl, 'POST', '/knowledge-center/api/incremental-tasks', { ...body, name: '另一任务' }, 'same-key');
    expect(conflict).toMatchObject({ status: 409, body: { error: { code: 'IDEMPOTENCY_KEY_REUSED' } } });
  });

  test('完整性检查只声明真正执行的项目', async () => {
    const created = await request(api.baseUrl, 'POST', '/knowledge-center/api/incremental-tasks', { name: '检查范围', handbookId: 'DB-001', businessVersion: '23.4', baselineVersionId: 'v1' }, 'check-scope-create');
    const checks = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${created.body.data.id}/checks`, {}, 'check-scope-run');
    expect(checks.body.data.scope).toBe('incremental_completeness');
    expect(checks.body.data.checks.map(item => item.code)).toEqual(['SOURCE_SNAPSHOT_PRESENT', 'TARGET_DOCUMENT_PRESENT', 'DRAFT_CONTENT_PRESENT', 'CHANGESET_OPERATION_VALID', 'CHANGESET_TARGET_DOCUMENTS_MATCH', 'CHANGESET_TARGET_SECTIONS_MATCH']);
    expect(JSON.stringify(checks.body.data)).not.toMatch(/structure|reference|quality/i);
  });

  test('变更集必须可重放，并且只能修改已确认目标', async () => {
    const created = await request(api.baseUrl, 'POST', '/knowledge-center/api/incremental-tasks', { name: '变更集契约', handbookId: 'DB-001', businessVersion: '23.4', baselineVersionId: 'v1' }, 'operation-create');
    const id = created.body.data.id;
    await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/sources`, { sourceType: 'manual', label: '来源', content: 'x' }, 'operation-source');
    await request(api.baseUrl, 'PATCH', `/knowledge-center/api/incremental-tasks/${id}/target`, { documentIds: ['doc-1'], sectionIds: ['node-1'] }, 'operation-target');
    const invalid = await request(api.baseUrl, 'PUT', `/knowledge-center/api/incremental-tasks/${id}/draft`, { editVersion: 0, content: '# x', operations: [{ type: 'move', documentId: 'doc-1', nodeId: 'node-1' }] }, 'operation-invalid');
    expect(invalid).toMatchObject({ status: 422, body: { error: { code: 'CHANGESET_INVALID' } } });
    expect(invalid.body.error.details.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'operations[0].beforeDigest' })]));
    await request(api.baseUrl, 'PUT', `/knowledge-center/api/incremental-tasks/${id}/draft`, { editVersion: 0, content: '# x', operations: [updateOperation('doc-other', 'node-other')] }, 'operation-outside');
    const checks = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/checks`, {}, 'operation-checks');
    expect(checks.body.data.passed).toBe(false);
    expect(checks.body.data.issues.map(item => item.code)).toEqual(expect.arrayContaining(['CHANGESET_TARGET_DOCUMENTS_MATCH', 'CHANGESET_TARGET_SECTIONS_MATCH']));
  });

  test('未具备审核权限的候选作者不能作出审核决定，退回后可创建修订', async () => {
    const created = await request(api.baseUrl, 'POST', '/knowledge-center/api/incremental-tasks', { name: '退回样例', handbookId: 'DB-001', businessVersion: '23.4', baselineVersionId: 'v1' }, 'reject-create');
    const taskId = created.body.data.id;
    await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/sources`, { sourceType: 'local', label: '本地文件', content: '# a' }, 'reject-source');
    await request(api.baseUrl, 'PATCH', `/knowledge-center/api/incremental-tasks/${taskId}/target`, { documentIds: ['doc-1'] }, 'reject-target');
    await request(api.baseUrl, 'PUT', `/knowledge-center/api/incremental-tasks/${taskId}/draft`, { editVersion: 0, content: '# b', operations: [updateOperation('doc-1', 'node-1')] }, 'reject-draft');
    await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/checks`, {}, 'reject-check');
    await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/candidate`, {}, 'reject-candidate');
    const review = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/reviews`, {}, 'reject-review');
    const selfReview = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/reviews/${review.body.data.id}/decision`, { decision: 'approve' }, 'self-review');
    expect(selfReview).toMatchObject({ status: 403, body: { error: { code: 'ACTION_FORBIDDEN' } } });
    const rejected = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/reviews/${review.body.data.id}/decision`, { decision: 'reject', comment: '请补充验证' }, 'reject-decision', 'reviewer');
    expect(rejected.body.data.status).toBe('rejected');
    const revision = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/revisions`, {}, 'revision-create');
    expect(revision.body.data).toMatchObject({ revisionOf: taskId, state: 'editing', draft: null });
  });

  test('行级评论绑定候选摘要和稳定锚点，旧请求保持全局评论兼容', async () => {
    const created = await request(api.baseUrl, 'POST', '/knowledge-center/api/incremental-tasks', { name: '行级评论', handbookId: 'DB-001', businessVersion: '23.4', baselineVersionId: 'v1' }, 'anchor-create');
    const id = created.body.data.id;
    await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/sources`, { sourceType: 'manual', label: '来源', content: 'x' }, 'anchor-source');
    await request(api.baseUrl, 'PATCH', `/knowledge-center/api/incremental-tasks/${id}/target`, { documentIds: ['doc-1'], sectionIds: ['node-1'] }, 'anchor-target');
    await request(api.baseUrl, 'PUT', `/knowledge-center/api/incremental-tasks/${id}/draft`, { editVersion: 0, content: '# x', operations: [updateOperation('doc-1', 'node-1')] }, 'anchor-draft');
    await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/checks`, {}, 'anchor-checks');
    const candidate = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/candidate`, {}, 'anchor-candidate');
    const review = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/reviews`, {}, 'anchor-review');
    const reviewId = review.body.data.id;
    const anchored = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/reviews/${reviewId}/comments`, {
      body: '参数值需要核对', commentType: 'issue', candidateDigest: candidate.body.data.digest,
      anchor: { documentId: 'doc-1', nodeId: 'node-1', anchorKind: 'after_operation', lineRange: { start: 1, end: 1 }, contextBefore: '前', contextAfter: '后' },
      diffView: { operationType: 'update', beforeContent: '旧', afterContent: '新' },
    }, 'anchor-comment', 'reviewer');
    expect(anchored.body.data).toMatchObject({ mode: 'anchored', body: '参数值需要核对', candidateDigest: candidate.body.data.digest, anchor: { nodeId: 'node-1' } });
    const global = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/reviews/${reviewId}/comments`, { comment: '全局意见' }, 'global-comment', 'reviewer');
    expect(global.body.data).toMatchObject({ mode: 'global', content: '全局意见' });
    const forged = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/reviews/${reviewId}/comments`, { comment: '伪造收件人不可生效', mentions: [{ handbookId: 'DB-001', recipientId: 'attacker' }] }, 'forged-mention', 'reviewer');
    expect(forged.body.data.mentions).toEqual([]);
    const notified = api.service.commentOnReview(reviewer, id, reviewId, 'trusted-mention', { comment: '通知负责人' }, {
      mentions: [{ handbookId: 'DB-001', handbookName: '安装手册', recipientId: 'book-owner' }],
    });
    expect(notified).toMatchObject({ mentions: [{ handbookId: 'DB-001', recipientId: 'book-owner' }], notificationStatus: 'pending_configuration' });
    expect(notified.notificationEvents).toEqual([expect.objectContaining({ recipientId: 'book-owner', status: 'pending_configuration', channels: { inApp: 'not_configured', wecom: 'not_configured', email: 'not_configured' } })]);
    const listed = await request(api.baseUrl, 'GET', `/knowledge-center/api/incremental-tasks/${id}/reviews/${reviewId}/comments?mode=anchored`, undefined, undefined, 'reviewer');
    expect(listed.body.data).toHaveLength(1);
    const invalid = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/reviews/${reviewId}/comments`, { comment: '漂移', candidateDigest: 'stale', anchor: { documentId: 'doc-1', nodeId: 'node-1', anchorKind: 'after_operation' } }, 'anchor-stale', 'reviewer');
    expect(invalid).toMatchObject({ status: 409, body: { error: { code: 'REVIEW_CANDIDATE_CONFLICT' } } });
  });

  test('阻断意见未解决时禁止审核通过，解决后允许通过', async () => {
    const { taskId, candidate } = await (async () => {
      const created = await request(api.baseUrl, 'POST', '/knowledge-center/api/incremental-tasks', { name: '阻断意见', handbookId: 'DB-001', businessVersion: '23.4', baselineVersionId: 'v1' }, 'block-create');
      const id = created.body.data.id;
      await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/sources`, { sourceType: 'manual', label: '来源', content: 'x' }, 'block-source');
      await request(api.baseUrl, 'PATCH', `/knowledge-center/api/incremental-tasks/${id}/target`, { documentIds: ['doc-1'] }, 'block-target');
      await request(api.baseUrl, 'PUT', `/knowledge-center/api/incremental-tasks/${id}/draft`, { editVersion: 0, content: '# x', operations: [updateOperation('doc-1', 'node-1')] }, 'block-draft');
      await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/checks`, {}, 'block-check');
      const candidate = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/candidate`, {}, 'block-candidate');
      const review = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/reviews`, {}, 'block-review');
      const comment = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/reviews/${review.body.data.id}/comments`, { comment: '必须修复', severity: 'blocker', candidateDigest: candidate.body.data.digest, anchor: { documentId: 'doc-1', nodeId: 'node-1', anchorKind: 'after_operation' } }, 'block-comment', 'reviewer');
      return { taskId: id, candidate: candidate.body.data, reviewId: review.body.data.id, commentId: comment.body.data.id };
    })();
    const review = (await request(api.baseUrl, 'GET', `/knowledge-center/api/incremental-tasks/${taskId}`)).body.data.reviews[0];
    const commentId = review.comments[0].id;
    const blocked = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/reviews/${review.id}/decision`, { decision: 'approve' }, 'block-decision', 'reviewer');
    expect(blocked).toMatchObject({ status: 409, body: { error: { code: 'REVIEW_BLOCKED_BY_COMMENTS' } } });
    expect((await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/reviews/${review.id}/comments/${commentId}/resolve`, {}, 'block-resolve', 'reviewer')).status).toBe(200);
    const approved = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${taskId}/reviews/${review.id}/decision`, { decision: 'approve' }, 'block-decision-ok', 'reviewer');
    expect(approved.body.data.status).toBe('approved');
  });

  test('同时拥有编辑和审核权限的提交者可以审核通过自己的候选', async () => {
    const create = body => request(api.baseUrl, body.method, body.path, body.data, body.key, 'reviewer');
    const task = await create({ method: 'POST', path: '/knowledge-center/api/incremental-tasks', data: { name: '管理员创建', handbookId: 'DB-001', businessVersion: '23.4', baselineVersionId: 'v1' }, key: 'admin-create' });
    const id = task.body.data.id;
    await create({ method: 'POST', path: `/knowledge-center/api/incremental-tasks/${id}/sources`, data: { sourceType: 'manual', label: '来源', content: '内容' }, key: 'admin-source' });
    await create({ method: 'PATCH', path: `/knowledge-center/api/incremental-tasks/${id}/target`, data: { documentIds: ['doc-1'] }, key: 'admin-target' });
    await create({ method: 'PUT', path: `/knowledge-center/api/incremental-tasks/${id}/draft`, data: { editVersion: 0, content: '# 内容', operations: [updateOperation('doc-1', 'node-1')] }, key: 'admin-draft' });
    await create({ method: 'POST', path: `/knowledge-center/api/incremental-tasks/${id}/checks`, data: {}, key: 'admin-checks' });
    await create({ method: 'POST', path: `/knowledge-center/api/incremental-tasks/${id}/candidate`, data: {}, key: 'admin-candidate' });
    const review = await create({ method: 'POST', path: `/knowledge-center/api/incremental-tasks/${id}/reviews`, data: {}, key: 'admin-review' });
    const detail = await request(api.baseUrl, 'GET', `/knowledge-center/api/incremental-tasks/${id}`, undefined, undefined, 'reviewer');
    expect(detail.body.data.capabilities).toMatchObject({ canReview: true, canComment: true });
    const decision = await create({ method: 'POST', path: `/knowledge-center/api/incremental-tasks/${id}/reviews/${review.body.data.id}/decision`, data: { decision: 'approve' }, key: 'admin-decision' });
    expect(decision).toMatchObject({ status: 200, body: { data: { status: 'approved', decision: { decidedBy: { id: 'reviewer-1' } } } } });
  });

  test('真实 HTTP：无差异正式正文不能直接创建在线评审任务', async () => {
    const payload = {
      name: 'YashanDB 物理规格在线评审',
      handbookId: 'DB-001',
      businessVersion: '23.4',
      baselineVersionId: 'v1',
      scope: 'document',
      documentId: 'doc-product-spec',
      language: 'zh-CN',
    };
    const first = await request(api.baseUrl, 'POST', '/knowledge-center/api/incremental-tasks/online-reviews', payload, 'online-review-create', 'reviewer');
    const replay = await request(api.baseUrl, 'POST', '/knowledge-center/api/incremental-tasks/online-reviews', payload, 'online-review-create', 'reviewer');
    expect(first).toMatchObject({ status: 422, body: { success: false, error: { code: 'GITLAB_NO_CHANGES' } } });
    expect(replay).toMatchObject({ status: 422, body: { success: false, error: { code: 'GITLAB_NO_CHANGES' } } });
    expect(api.repository.read().tasks).toHaveLength(0);
    expect(api.repository.read().audits).not.toEqual(expect.arrayContaining([expect.objectContaining({ action: 'ONLINE_REVIEW_SNAPSHOT_CREATED' })]));
  });

  test('在线评审快照在已发布版本缺少正文时返回明确冲突', async () => {
    const unavailable = await request(api.baseUrl, 'POST', '/knowledge-center/api/incremental-tasks/online-reviews', {
      handbookId: 'DB-001',
      businessVersion: '23.4.5.100',
      baselineVersionId: 'baseline-v1',
      scope: 'handbook',
    }, 'online-review-missing-content');
    expect(unavailable).toMatchObject({ status: 409, body: { success: false, error: { code: 'ONLINE_REVIEW_SNAPSHOT_UNAVAILABLE' } } });
  });

  test('已发布基线变化时阻断旧任务发布', async () => {
    const first = await buildApprovedCandidate(api.baseUrl, 'first');
    const firstPublished = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${first.taskId}/publish`, { expectedCandidateDigest: first.candidate.digest }, 'publish-first', 'reviewer');
    expect(firstPublished.status).toBe(200);
    const switched = await request(api.baseUrl, 'GET', '/knowledge-center/api/incremental-tasks/baselines?handbookId=DB-001&businessVersion=23.4.5.100');
    expect(switched.body.data.map(item => [item.id, item.current])).toEqual([['baseline-v1', false], [firstPublished.body.data.id, true]]);

    const current = await buildApprovedCandidate(api.baseUrl, 'current', firstPublished.body.data.id);
    const stale = await buildApprovedCandidate(api.baseUrl, 'stale', firstPublished.body.data.id);
    expect((await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${current.taskId}/publish`, { expectedCandidateDigest: current.candidate.digest }, 'publish-current', 'reviewer')).status).toBe(200);
    const conflict = await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${stale.taskId}/publish`, { expectedCandidateDigest: stale.candidate.digest }, 'publish-stale', 'reviewer');
    expect(conflict).toMatchObject({ status: 409, body: { error: { code: 'BASELINE_CONFLICT' } } });
  });

  test('审核启动默认选择当前可读任务，显式列表模式保留基线与文档边界', async () => {
    const { taskId } = await buildApprovedCandidate(api.baseUrl, 'bootstrap');
    const automatic = api.service.reviewBootstrap(editor, { handbookId: 'DB-001' });
    expect(automatic.detail).toMatchObject({ id: taskId, state: 'approved' });
    expect(automatic.readerHandbookId).toBe('DB-001');
    expect(automatic.baselines).toEqual([]);
    const list = api.service.reviewBootstrap(editor, { handbookId: 'DB-001', view: 'all' });
    expect(list.detail).toBeNull();
    expect(list.items.some(item => item.id === taskId)).toBe(true);
    expect(list.baselines.some(item => item.id === 'baseline-v1')).toBe(true);
    expect(() => api.service.reviewBootstrap(editor, { taskId, documentId: 'unknown' })).toThrow(expect.objectContaining({ code: 'REVIEW_DOCUMENT_MISMATCH' }));
    expect(api.service.reviewBootstrap(editor, { taskId, documentId: 'doc-install' }).detail.id).toBe(taskId);
  });

  test('按手册汇总审核事项，并提供真实的前后全文与变更统计', async () => {
    const created = await request(api.baseUrl, 'POST', '/knowledge-center/api/incremental-tasks', { name: '审核汇总', handbookId: 'DB-001', businessVersion: '23.4', baselineVersionId: 'v1' }, 'summary-create');
    const id = created.body.data.id;
    await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/sources`, { sourceType: 'manual', label: '来源', content: '依据' }, 'summary-source');
    await request(api.baseUrl, 'PATCH', `/knowledge-center/api/incremental-tasks/${id}/target`, { documentIds: ['doc-1'] }, 'summary-target');
    await request(api.baseUrl, 'PUT', `/knowledge-center/api/incremental-tasks/${id}/draft`, { editVersion: 0, content: '# 修改后', operations: [{ type: 'update', documentId: 'doc-1', nodeId: 'node-1', beforeDigest: 'before', beforeContent: '# 修改前', after: '# 修改后' }, { type: 'add', documentId: 'doc-1', nodeId: 'node-2', after: '新增' }] }, 'summary-draft');
    await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/checks`, {}, 'summary-checks');
    await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/candidate`, {}, 'summary-candidate');
    await request(api.baseUrl, 'POST', `/knowledge-center/api/incremental-tasks/${id}/reviews`, {}, 'summary-review');
    const summary = await request(api.baseUrl, 'GET', '/knowledge-center/api/incremental-tasks/handbooks/DB-001/review-summary');
    expect(summary).toMatchObject({ status: 200, body: { success: true, data: { handbookId: 'DB-001', summary: { underReview: 1 } } } });
    expect(summary.body.data.tasks[0]).toMatchObject({ id, state: 'under_review', handbookId: 'DB-001' });
    const diff = await request(api.baseUrl, 'GET', `/knowledge-center/api/incremental-tasks/${id}/diff`);
    expect(diff).toMatchObject({ status: 200, body: { success: true, data: { taskId: id, counts: { added: 1, updated: 1 }, candidate: { content: '# 修改后' } } } });
    expect(diff.body.data.operations[0]).toMatchObject({ beforeContent: '# 修改前', after: '# 修改后' });
    expect(diff.body.data.completeness.afterFullText).toBe(true);
  });
});

describe('增量构建文件仓储', () => {
  let directory;
  beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'incremental-build-')); });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  test('原子写入保留备份，主文件损坏时可恢复', () => {
    const file = path.join(directory, 'state.json');
    const repository = new FileIncrementalBuildRepository(file);
    repository.write({ ...repository.empty(), tasks: [{ id: 'first' }] });
    repository.write({ ...repository.empty(), tasks: [{ id: 'second' }] });
    fs.writeFileSync(file, '{broken', 'utf8');
    expect(repository.read().tasks).toEqual([{ id: 'first' }]);
  });

  test('锁已被占用时拒绝覆盖写入', () => {
    const file = path.join(directory, 'state.json');
    const repository = new FileIncrementalBuildRepository(file, { lockTimeoutMs: 20, lockRetryMs: 2 });
    fs.writeFileSync(`${file}.lock`, 'occupied');
    expect(() => repository.write(repository.empty())).toThrow(expect.objectContaining({ code: 'INCREMENTAL_STORE_BUSY' }));
  });

  test('多进程并发读改写不丢失更新', async () => {
    const file = path.join(directory, 'concurrent.json');
    const repository = new FileIncrementalBuildRepository(file);
    repository.write({ ...repository.empty(), counter: 0 });
    const modulePath = path.resolve(__dirname, '../../../packages/agent-runner-core/lib/incremental-build-service.js');
    const script = `const {FileIncrementalBuildRepository}=require(process.argv[1]);const r=new FileIncrementalBuildRepository(process.argv[2],{lockTimeoutMs:10000});for(let i=0;i<20;i++)r.transaction(s=>{s.counter=(s.counter||0)+1;});`;
    const workers = Array.from({ length: 4 }, () => new Promise((resolve, reject) => execFile(process.execPath, ['-e', script, modulePath, file], error => error ? reject(error) : resolve())));
    await Promise.all(workers);
    expect(repository.read().counter).toBe(80);
  });
});
