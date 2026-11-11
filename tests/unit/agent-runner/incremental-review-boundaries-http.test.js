const http = require('http');
const { MemoryIncrementalBuildRepository, IncrementalBuildService, createIncrementalBuildHandler } = require('../../../packages/agent-runner-core/lib/incremental-build-service');

describe('增量审核辅助接口真实HTTP边界', () => {
  let server, base, repository, sequence, session;
  const editor = { user: { id: 'owner', displayName: '作者' }, allowedActions: ['knowledge:read', 'knowledge:write'] };
  const task = () => ({
    id: 'task', handbookId: 'manual', name: '隔离审核', state: 'under_review', createdBy: editor.user,
    createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-10T00:00:00Z',
    candidate: { id: 'candidate', digest: 'candidate-digest', content: 'SELECT *FROM users; TODO 补充参数', operations: [{ id: 'operation', documentId: 'doc', nodeId: 'node', type: 'update' }] },
    reviews: [{ id: 'review', status: 'pending', candidateDigest: 'candidate-digest', comments: [] }]
  });
  async function request(method, route, body, key) {
    const response = await fetch(`${base}/knowledge-center/api/incremental-tasks/task${route}`, {
      method, headers: { 'content-type': 'application/json', 'idempotency-key': key || `request-${sequence++}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, body: await response.json() };
  }
  beforeEach(async () => {
    sequence = 0;
    session = editor;
    repository = new MemoryIncrementalBuildRepository({ schemaVersion: 1, tasks: [task()], publishedVersions: [], audits: [], idempotency: {} });
    const handler = createIncrementalBuildHandler({ service: new IncrementalBuildService(repository) });
    server = http.createServer((req, res) => handler(req, res, session));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  afterEach(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const stateTask = () => repository.read().tasks[0];
  test.each([
    ['/reviews/review/decision', { decision: 'unknown' }, {}, 'REVIEW_DECISION_INVALID', 422],
    ['/reviews/absent/decision', { decision: 'approve' }, {}, 'REVIEW_NOT_FOUND', 404],
    ['/reviews/review/decision', { decision: 'approve' }, { reviews: [{ id: 'review', status: 'pending', candidateDigest: 'old' }] }, 'REVIEW_CANDIDATE_CONFLICT', 409],
    ['/reviews/review/cancel', {}, {}, 'REVIEW_CANCEL_REASON_REQUIRED', 422],
    ['/reviews/absent/cancel', { reason: '终止', candidateDigest: 'candidate-digest' }, {}, 'REVIEW_NOT_FOUND', 404],
    ['/reviews/review/cancel', { reason: '终止', candidateDigest: 'old' }, {}, 'REVIEW_CANDIDATE_CONFLICT', 409],
    ['/publish', { expectedCandidateDigest: 'candidate-digest' }, {}, 'APPROVAL_REQUIRED', 409],
    ['/publish', { expectedCandidateDigest: 'old' }, { state: 'approved' }, 'CANDIDATE_CONFLICT', 409],
    ['/publish', { expectedCandidateDigest: 'candidate-digest' }, { state: 'approved', reviews: [] }, 'APPROVAL_REQUIRED', 409],
    ['/publish', { expectedCandidateDigest: 'candidate-digest' }, { state: 'approved' }, 'APPROVAL_REQUIRED', 409],
    ['/publish', { expectedCandidateDigest: 'candidate-digest' }, { reviewMode: 'online_review' }, 'GITLAB_NO_CHANGES', 422],
    ['/external-evidence', { type: 'gitlab', reference: 'fixture' }, {}, 'PUBLICATION_REQUIRED', 409],
    ['/revisions', {}, {}, 'REJECTED_TASK_REQUIRED', 409],
    ['/revisions', {}, { handbookSource: {} }, 'HANDBOOK_REVISION_REQUIRED', 409],
  ])('状态守卫拒绝 %s %# 且无存储副作用', async (route, body, patch, code, status) => {
    session = { ...editor, allowedActions: [...editor.allowedActions, 'review:manage', 'publish:manage'] };
    repository.transaction(state => Object.assign(state.tasks[0], patch));
    const before = repository.read();
    expect(await request('POST', route, body)).toMatchObject({ status, body: { success: false, error: { code } } });
    expect(repository.read()).toEqual(before);
  });
  async function comment() {
    const result = await request('POST', '/reviews/review/comments', { comment: '检查参数', candidateDigest: 'candidate-digest' });
    expect(result.status).toBe(200);
    return result.body.data;
  }
  test('畸形 JSON 不改变审核任务，合法评论可在错误后提交', async () => {
    const before = repository.read();
    const response = await fetch(`${base}/knowledge-center/api/incremental-tasks/task/reviews/review/comments`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'invalid-json' }, body: '{"comment":',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, error: { code: 'INVALID_JSON' } });
    expect(repository.read()).toEqual(before);
    const created = await comment();
    expect(created).toMatchObject({ content: '检查参数' });
    expect(stateTask().reviews[0].comments).toHaveLength(1);
  });
  async function rootRequest(method, route, body, key = `root-${sequence++}`) {
    const response = await fetch(`${base}/knowledge-center/api/incremental-tasks/${route}`, {
      method, headers: { 'content-type': 'application/json', 'idempotency-key': key },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, body: await response.json() };
  }
  test('合成基线只替换相同手册版本的当前记录，幂等重试仅一次审计', async () => {
    repository.transaction(state => {
      state.publishedVersions = [
        { id: 'old-current', handbookId: 'manual', businessVersion: 'v1', current: true },
        { id: 'old-history', handbookId: 'manual', businessVersion: 'v1', current: false },
        { id: 'other-version', handbookId: 'manual', businessVersion: 'v2', current: true },
        { id: 'other-handbook', handbookId: 'other', businessVersion: 'v1', current: true },
      ];
    });
    const existing = repository.read().publishedVersions;
    const body = { handbookId: 'manual', businessVersion: 'v1', content: '# 原始全文',
      commitSha: 'commit-1', filePath: 'docs/manual.md', branch: 'main' };
    const created = await rootRequest('POST', 'bootstrap-baseline', body, 'baseline-create');
    expect(created).toMatchObject({ status: 200, body: { data: {
      handbookId: 'manual', businessVersion: 'v1', current: true, synthetic: true,
      source: { type: 'gitlab_bootstrap', commitSha: 'commit-1', filePath: 'docs/manual.md', branch: 'main' }
    } } });
    const after = repository.read();
    expect(after.publishedVersions.slice(0, 4)).toEqual(existing.map(item =>
      item.id === 'old-current' ? { ...item, current: false } : item));
    expect(after.publishedVersions[4]).toMatchObject({ id: created.body.data.id, content: body.content });
    expect(after.audits.map(item => item.action)).toEqual(['SYNTHETIC_BASELINE_CREATED']);
    expect(await rootRequest('POST', 'bootstrap-baseline', body, 'baseline-create')).toEqual(created);
    expect(repository.read()).toEqual(after);
    const listed = await rootRequest('GET', 'baselines?handbookId=manual&businessVersion=v1');
    expect(listed.status).toBe(200);
    expect(listed.body.data.find(item => item.id === created.body.data.id)).toMatchObject({ current: true });
    expect(listed.body.data.every(item => !Object.hasOwn(item, 'content'))).toBe(true);
  });
  test.each(['handbookId', 'businessVersion', 'content'])('合成基线缺少%s时存储与审计不变', async field => {
    const body = { handbookId: 'manual', businessVersion: 'v1', content: '基线' };
    delete body[field];
    const before = repository.read();
    expect(await rootRequest('POST', 'bootstrap-baseline', body)).toMatchObject({ status: 422,
      body: { error: { code: 'VALIDATION_FAILED', details: { field } } } });
    expect(repository.read()).toEqual(before);
  });
  test('手册审核摘要排序、状态筛选和未解决阻断意见计数保持可读边界', async () => {
    repository.transaction(state => {
      const original = state.tasks[0];
      state.tasks = [
        { ...original, id: 'early', updatedAt: '2026-01-01', reviews: [{ comments: [
          { id: 'blocker', severity: 'blocker', resolved: false },
          { id: 'normal', severity: 'normal' }, { id: 'resolved', severity: 'blocker', resolved: true }
        ] }] },
        { ...original, id: 'later', state: 'approved', updatedAt: '2026-02-01', reviews: [] },
        { ...original, id: 'rejected', state: 'rejected', updatedAt: undefined, createdAt: '2026-03-01', reviews: [] },
        { ...original, id: 'published', state: 'published', updatedAt: '2026-04-01', reviews: [] },
        { ...original, id: 'different', handbookId: 'other', reviews: [] },
        { ...original, id: 'invisible', state: 'editing', createdBy: { id: 'someone-else' }, reviews: [] },
      ];
    });
    const before = repository.read();
    const summary = await rootRequest('GET', 'handbooks/manual/review-summary');
    expect(summary.status).toBe(200);
    expect(summary.body.data.tasks.map(item => item.id)).toEqual(['published', 'rejected', 'later', 'early']);
    expect(summary.body.data.summary).toEqual({ total: 4, underReview: 1, pendingPublish: 1,
      rejected: 1, published: 1, unresolvedComments: 2, blockers: 1 });
    const filtered = await rootRequest('GET', 'handbooks/manual/review-summary?state=under_review');
    expect(filtered.body.data.tasks.map(item => item.id)).toEqual(['early']);
    expect(filtered.body.data.summary).toMatchObject({ total: 1, underReview: 1, pendingPublish: 0, unresolvedComments: 2, blockers: 1 });
    expect(repository.read()).toEqual(before);
  });
  test('静态分析、建议与幂等重放保持候选正文，只新增各一次审计', async () => {
    expect((await request('GET', '/ai-analysis')).body.data).toEqual({ status: 'not_started', candidateDigest: 'candidate-digest' });
    expect((await request('GET', '/ai-fix-proposals')).body.data).toEqual([]);
    const before = stateTask().candidate;
    const analysis = await request('POST', '/ai-analysis', {}, 'analysis');
    expect(analysis.status).toBe(200);
    expect(analysis.body.data).toMatchObject({ status: 'completed', verdict: '需人工确认', candidateDigest: 'candidate-digest', analysisType: 'database_document_review' });
    expect(analysis.body.data.findings.map(item => item.code)).toEqual(['SQL_SELECT_STAR', 'DOC_TODO_MARKER']);
    expect(await request('POST', '/ai-analysis', {}, 'analysis')).toEqual(analysis);
    expect((await request('GET', '/ai-analysis')).body.data).toEqual(analysis.body.data);
    const body = { findingCode: 'DOC_TODO_MARKER', proposedText: '完整参数说明' };
    const proposal = await request('POST', '/ai-fix-proposals', body, 'proposal');
    expect(proposal.body.data).toMatchObject({ status: 'proposed', findingCode: body.findingCode, proposedText: body.proposedText, sourceAnalysisId: analysis.body.data.id });
    expect(await request('POST', '/ai-fix-proposals', body, 'proposal')).toEqual(proposal);
    expect((await request('GET', '/ai-fix-proposals')).body.data).toEqual([proposal.body.data]);
    expect(stateTask().candidate).toEqual(before);
    expect(repository.read().audits.map(item => item.action)).toEqual(['AI_REVIEW_ANALYSIS_COMPLETED', 'AI_FIX_PROPOSAL_CREATED']);
  });
  test('无规则命中时返回明确结论，并支持指定分析类型和建议理由', async () => {
    repository.transaction(state => { state.tasks[0].candidate.content = '# 参数\n说明范围'; });
    const analysis = await request('POST', '/ai-analysis', { analysisType: 'parameter_review' });
    expect(analysis.body.data).toMatchObject({ findings: [], verdict: '未发现规则问题', analysisType: 'parameter_review' });
    expect((await request('POST', '/ai-fix-proposals', { findingCode: 'manual', proposedText: '建议文本', rationale: '人工建议' })).body.data.rationale).toBe('人工建议');
  });
  test.each([
    ['candidate', '/ai-analysis', {}, 'CANDIDATE_REQUIRED'],
    ['candidate', '/ai-fix-proposals', { findingCode: 'x', proposedText: '修订' }, 'CANDIDATE_REQUIRED'],
    ['analysis', '/ai-fix-proposals', { findingCode: 'x', proposedText: '修订' }, 'AI_ANALYSIS_REQUIRED'],
    ['stale', '/ai-fix-proposals', { findingCode: 'x', proposedText: '修订' }, 'AI_ANALYSIS_REQUIRED']
  ])('拒绝%s依赖缺失 %s', async (kind, route, body, code) => {
    repository.transaction(state => {
      if (kind === 'candidate') delete state.tasks[0].candidate;
      if (kind === 'stale') state.tasks[0].aiAnalysis = { candidateDigest: 'old' };
    });
    const before = repository.read();
    expect(await request('POST', route, body)).toMatchObject({ status: 409, body: { error: { code } } });
    expect(repository.read()).toEqual(before);
  });
  test.each([{}, { findingCode: 'x' }, { proposedText: '修订' }])('建议必填校验 %j', async body => {
    const before = repository.read();
    expect(await request('POST', '/ai-fix-proposals', body)).toMatchObject({ status: 422, body: { error: { code: 'VALIDATION_FAILED' } } });
    expect(repository.read()).toEqual(before);
  });
  test('回复兼容body与comment，解决/重开和操作关联可回读且幂等', async () => {
    const item = await comment();
    const route = `/reviews/review/comments/${item.id}`;
    const reply = await request('POST', `${route}/replies`, { body: ' 第一条回复 ' }, 'reply');
    expect(reply.body.data).toMatchObject({ content: '第一条回复', body: '第一条回复', author: editor.user });
    expect(await request('POST', `${route}/replies`, { body: ' 第一条回复 ' }, 'reply')).toEqual(reply);
    await request('POST', `${route}/replies`, { comment: '第二条回复' });
    const resolved = await request('POST', `${route}/resolve`, { reason: '已修订' });
    expect(resolved.body.data).toMatchObject({ resolved: true, anchorStatus: 'resolved', resolvedBy: editor.user, resolvedAt: expect.any(String) });
    const reopened = await request('POST', `${route}/reopen`, {});
    expect(reopened.body.data).toMatchObject({ resolved: false, anchorStatus: 'valid', resolvedBy: null, resolvedAt: null });
    const linked = await request('POST', `${route}/link-operation`, { operationId: 'operation' });
    expect(linked.body.data.operationId).toBe('operation');
    const read = await request('GET', '/reviews/review');
    expect(read.body.data.comments[0]).toMatchObject({ operationId: 'operation', replies: [reply.body.data, expect.objectContaining({ content: '第二条回复' })] });
    const actions = repository.read().audits.map(item => item.action);
    expect(actions.filter(value => value === 'REVIEW_COMMENT_REPLIED')).toHaveLength(2);
    expect(actions).toEqual(expect.arrayContaining(['REVIEW_COMMENT_RESOLVED', 'REVIEW_COMMENT_REOPENED', 'REVIEW_COMMENT_LINKED_OPERATION']));
  });
  test('失效锚点解决和重开仍保留失效状态', async () => {
    const item = await comment();
    repository.transaction(state => { state.tasks[0].reviews[0].comments[0].anchorStatus = 'invalidated'; });
    for (const action of ['resolve', 'reopen']) {
      const response = await request('POST', `/reviews/review/comments/${item.id}/${action}`, {});
      expect(response.body.data.anchorStatus).toBe('invalidated');
    }
  });
  test.each([
    ['/reviews/absent/comments/no/replies', { comment: '回复' }, 'REVIEW_NOT_FOUND', 404],
    ['/reviews/review/comments/no/replies', { comment: '回复' }, 'COMMENT_NOT_FOUND', 404],
    ['/reviews/review/comments/no/replies', {}, 'VALIDATION_FAILED', 422],
    ['/reviews/review/comments/no/resolve', {}, 'COMMENT_NOT_FOUND', 404],
    ['/reviews/review/comments/no/reopen', {}, 'COMMENT_NOT_FOUND', 404],
    ['/reviews/review/comments/no/link-operation', {}, 'VALIDATION_FAILED', 422],
    ['/reviews/review/comments/no/link-operation', { operationId: 'operation' }, 'COMMENT_NOT_FOUND', 404]
  ])('无效评论操作 %s', async (route, body, code, status) => {
    const before = repository.read();
    expect(await request('POST', route, body)).toMatchObject({ status, body: { error: { code } } });
    expect(repository.read()).toEqual(before);
  });
  test('已有评论关联不存在操作被拒绝；缺失审核读取返回404', async () => {
    const item = await comment();
    const before = repository.read();
    expect(await request('POST', `/reviews/review/comments/${item.id}/link-operation`, { operationId: 'absent' })).toMatchObject({ status: 422, body: { error: { code: 'OPERATION_NOT_FOUND' } } });
    expect(await request('GET', '/reviews/absent')).toMatchObject({ status: 404, body: { error: { code: 'REVIEW_NOT_FOUND' } } });
    expect(repository.read()).toEqual(before);
  });

  test.each([
    [{ commentType: 'unknown' }, 'COMMENT_TYPE_INVALID'],
    [{ severity: 'important' }, 'COMMENT_SEVERITY_INVALID'],
    [{ anchor: { documentId: 'doc', nodeId: 'node', anchorKind: 'unknown' } }, 'COMMENT_ANCHOR_INVALID'],
    [{ anchor: { documentId: 'doc', anchorKind: 'baseline' } }, 'COMMENT_ANCHOR_INVALID'],
    [{ anchor: { documentId: 'absent', nodeId: 'node', anchorKind: 'after_operation' } }, 'COMMENT_ANCHOR_NOT_FOUND'],
  ])('非法评论契约拒绝且不留下记录 %j', async (extra, code) => {
    const before = repository.read();
    expect(await request('POST', '/reviews/review/comments', { comment: '检查锚点', candidateDigest: 'candidate-digest', ...extra })).toMatchObject({
      status: 422, body: { success: false, error: { code } },
    });
    expect(repository.read()).toEqual(before);
  });

  test.each([
    ['lineRange', { startLine: -1, endLine: 2 }],
    ['lineRange', { startLine: 3, endLine: 2 }],
    ['lineRange', { startLine: 0.5, endLine: 2 }],
    ['lineRange', { startLine: 0 }],
    ['charRange', { startChar: -1, endChar: 2 }],
    ['charRange', { startChar: 3, endChar: 2 }],
    ['charRange', { startChar: 0, endChar: 1.5 }],
    ['charRange', { endChar: 2 }],
  ])('非法 %s 范围 %j 不改变评论或审计', async (rangeName, range) => {
    const before = repository.read();
    expect(await request('POST', '/reviews/review/comments', {
      comment: '检查范围', candidateDigest: 'candidate-digest',
      anchor: { documentId: 'doc', nodeId: 'node', anchorKind: 'after_operation', [rangeName]: range },
    })).toMatchObject({ status: 422, body: { error: { code: 'COMMENT_ANCHOR_INVALID', details: { field: `anchor.${rangeName}` } } } });
    expect(repository.read()).toEqual(before);
  });

  test.each([
    ['after_operation', 'node', 'valid'],
    ['before_operation', 'node', 'valid'],
    ['baseline', 'node', 'valid'],
    ['document_span', 'node', 'valid'],
    ['document_span', 'unchanged-node', 'needs_manual_confirmation'],
  ])('%s 锚点节点 %s 支持兼容范围，持久化状态为 %s', async (anchorKind, nodeId, anchorStatus) => {
    const anchor = { documentId: 'doc', nodeId, anchorKind, lineRange: { startLine: 0, endLine: 2 }, charRange: { start: 0, end: 3 } };
    const body = { body: ' 范围说明 ', candidateDigest: 'candidate-digest', anchor, diffView: { side: 'after' }, commentType: 'question', severity: 'blocker' };
    const response = await request('POST', '/reviews/review/comments', body, 'anchored-comment');
    expect(response).toMatchObject({ status: 200, body: { data: { content: '范围说明', body: '范围说明', mode: 'anchored', anchor, anchorStatus, severity: 'blocker', commentType: 'question', diffView: body.diffView } } });
    expect(await request('POST', '/reviews/review/comments', body, 'anchored-comment')).toEqual(response);
    expect((await request('GET', '/reviews/review')).body.data.comments).toEqual([response.body.data]);
    expect(repository.read().audits).toHaveLength(1);
    expect(stateTask().candidate.digest).toBe('candidate-digest');
  });

  test.each([
    ['POST', '/sources', { sourceType: 'manual', label: '来源', content: '新增来源' }, 'TASK_SOURCE_FROZEN'],
    ['PATCH', '/target', { documentIds: ['doc'] }, 'TASK_TARGET_FROZEN'],
    ['PUT', '/draft', { content: '# 新草稿', editVersion: 0, operations: [{ type: 'update', documentId: 'doc', nodeId: 'node', beforeDigest: 'previous', after: { content: '新正文' } }] }, 'DRAFT_IMMUTABLE'],
    ['POST', '/checks', {}, 'TASK_CHECK_NOT_ALLOWED'],
  ])('冻结任务拒绝 %s %s 并保留候选及审核', async (method, route, body, code) => {
    const before = repository.read();
    expect(await request(method, route, body)).toMatchObject({ status: 409, body: { error: { code } } });
    expect(repository.read()).toEqual(before);
  });

  test.each([
    ['editing', { passed: true, checkedDraftDigest: 'draft-digest' }],
    ['checked', null],
    ['checked', { passed: false, checkedDraftDigest: 'draft-digest' }],
    ['checked', { passed: true, checkedDraftDigest: 'stale-digest' }],
  ])('候选冻结拒绝状态 %s 和非最新检查 %j', async (state, checks) => {
    repository.transaction(snapshot => { Object.assign(snapshot.tasks[0], { state, checks, draft: { content: '草稿', contentDigest: 'draft-digest' } }); });
    const before = repository.read();
    expect(await request('POST', '/candidate', {})).toMatchObject({ status: 409, body: { error: { code: 'CHECK_REQUIRED' } } });
    expect(repository.read()).toEqual(before);
  });

  test('未知路由返回404且不改变任务', async () => {
    const before = repository.read();
    expect(await request('GET', '/unknown/subroute')).toMatchObject({ status: 404, body: { error: { code: 'ROUTE_NOT_FOUND' } } });
    expect(repository.read()).toEqual(before);
  });
  function deferred() {
    let resolve, reject;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
  }
  async function parallelReads(complete) {
    const received = deferred();
    let count = 0;
    const listener = () => { if (++count === 2) received.resolve(); };
    server.on('request', listener);
    const pending = [rootRequest('GET', ''), rootRequest('GET', 'task')];
    try {
      await received.promise;
      await complete();
      return await Promise.all(pending);
    } finally { server.off('request', listener); }
  }
  test('并发HTTP列表和详情共享一次异步读取，响应与仓库隔离', async () => {
    const read = deferred();
    repository.writeEpoch = 0;
    repository.readAsync = jest.fn(() => read.promise);
    const [list, detail] = await parallelReads(() => {
      expect(repository.readAsync).toHaveBeenCalledTimes(1);
      read.resolve(repository.read());
    });
    expect(list).toMatchObject({ status: 200, body: { data: [{ id: 'task', name: '隔离审核' }] } });
    expect(detail).toMatchObject({ status: 200, body: { data: { id: 'task', name: '隔离审核' } } });
    list.body.data[0].name = '客户端修改';
    expect(detail.body.data.name).toBe('隔离审核');
    expect(stateTask().name).toBe('隔离审核');
    repository.readAsync = jest.fn(async () => repository.read());
    expect((await rootRequest('GET', '')).status).toBe(200);
    expect(repository.readAsync).toHaveBeenCalledTimes(1);
  });
  test('读取中发生写入时丢弃旧快照并重读，两请求均看到最新状态', async () => {
    const read = deferred();
    repository.writeEpoch = 0;
    const stale = repository.read();
    repository.readAsync = jest.fn().mockImplementationOnce(() => read.promise)
      .mockImplementation(async () => repository.read());
    const [list, detail] = await parallelReads(() => {
      repository.transaction(state => { state.tasks[0].name = '最新任务'; });
      repository.writeEpoch++;
      read.resolve(stale);
    });
    expect(repository.readAsync).toHaveBeenCalledTimes(2);
    expect(list.body.data[0].name).toBe('最新任务');
    expect(detail.body.data.name).toBe('最新任务');
  });
  test('异步读取失败释放共用请求，HTTP隐藏内部错误并允许后续重试', async () => {
    const read = deferred();
    repository.writeEpoch = 0;
    repository.readAsync = jest.fn(() => read.promise);
    const before = repository.read();
    const results = await parallelReads(() => read.reject(new Error('private database endpoint')));
    for (const result of results) {
      expect(result).toEqual({ status: 500, body: { success: false,
        error: { code: 'INCREMENTAL_BUILD_FAILED', message: '增量构建处理失败' } } });
    }
    expect(repository.readAsync).toHaveBeenCalledTimes(1);
    expect(repository.read()).toEqual(before);
    repository.readAsync = jest.fn(async () => repository.read());
    expect((await rootRequest('GET', 'task')).body.data.id).toBe('task');
    expect(repository.readAsync).toHaveBeenCalledTimes(1);
  });
  test.each([undefined, null, ''])('正式基线正文为%p时拒绝在线评审且不写入', async content => {
    repository.transaction(state => { state.publishedVersions.push({ id: 'baseline', handbookId: 'manual',
      businessVersion: 'v1', current: true, content }); });
    const before = repository.read();
    expect(await rootRequest('POST', 'online-reviews', { handbookId: 'manual', businessVersion: 'v1', baselineVersionId: 'baseline' }))
      .toMatchObject({ status: 409, body: { error: { code: 'ONLINE_REVIEW_SNAPSHOT_UNAVAILABLE', details: { baselineVersionId: 'baseline' } } } });
    expect(repository.read()).toEqual(before);
  });
  test.each([
    [{ type: 'bad' }, ['type', 'documentId', 'nodeId']],
    [{ type: 'move', documentId: 'doc', nodeId: 'node', beforeDigest: 'before' }, ['targetParentId', 'ordinal']],
    [{ type: 'move', documentId: 'doc', nodeId: 'node', beforeDigest: 'before', targetParentId: 'parent', ordinal: -1 }, ['ordinal']],
    [{ type: 'move', documentId: 'doc', nodeId: 'node', beforeDigest: 'before', targetParentId: 'parent', ordinal: 0.5 }, ['ordinal']],
    [{ type: 'update', documentId: 'doc', nodeId: 'node' }, ['beforeDigest', 'after']],
    [null, ['type', 'documentId', 'nodeId']],
  ])('无效变更操作 %# 返回逐字段错误且无写入', async (operation, fields) => {
    const before = repository.read();
    const result = await request('PUT', '/draft', { content: '草稿', editVersion: 0, operations: [operation] });
    expect(result).toMatchObject({ status: 422, body: { error: { code: 'CHANGESET_INVALID' } } });
    expect(result.body.error.details.errors.map(item => item.field)).toEqual(fields.map(field => `operations[0].${field}`));
    expect(repository.read()).toEqual(before);
  });
  test('合法移动操作按版本递增保存，陈旧草稿写入拒绝且幂等重试不重复递增', async () => {
    repository.transaction(state => { state.tasks[0].state = 'editing'; });
    const operation = { type: 'move', documentId: 'doc', nodeId: 'node', beforeDigest: 'before', targetParentId: 'parent', ordinal: 0 };
    const body = { content: '移动后草稿', editVersion: 0, operations: [operation] };
    const saved = await request('PUT', '/draft', body, 'save-move');
    expect(saved).toMatchObject({ status: 200, body: { data: { content: body.content, editVersion: 1, operations: [operation] } } });
    const before = repository.read();
    expect(await request('PUT', '/draft', body, 'save-move')).toEqual(saved);
    expect(await request('PUT', '/draft', { ...body, content: '陈旧草稿' }))
      .toMatchObject({ status: 409, body: { error: { code: 'DRAFT_EDIT_CONFLICT', details: { expected: 1, received: 0 } } } });
    expect(repository.read()).toEqual(before);
  });

});
