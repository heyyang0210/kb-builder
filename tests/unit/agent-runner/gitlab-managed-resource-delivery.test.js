const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const { submitDocumentMergeRequest, readMergeRequestDelivery } = require('../../../packages/agent-runner-core/lib/gitlab-connector');

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');

async function fixture(t) {
  const files = new Map([['base', new Map([['docs/a.md', Buffer.from('# 原稿\n')]])]]);
  const branches = new Map([['main', 'base']]);
  const writes = []; const mrs = [];
  let loseCommitResponse = false;
  let loseMergeResponse = false;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const endpoint = url.pathname.replace(/^\/api\/v4\/projects\/[^/]+/, '');
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    const send = (status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (req.method !== 'GET') writes.push({ endpoint, body });
    if (endpoint === '/users') return send(200, [{ id: 101, username: 'author', state: 'active', access_level: 40 }]);
    if (endpoint === '/merge_requests' && req.method === 'GET') return send(200, mrs);
    if (endpoint === '/repository/branches' && req.method === 'GET') return send(200, [...branches].map(([name, sha]) => ({ name, commit: { id: sha } })));
    if (/^\/merge_requests\/\d+$/.test(endpoint)) return send(200, mrs[0]);
    if (endpoint === '/repository/branches' && req.method === 'POST') {
      branches.set(body.branch, body.ref); return send(201, { name: body.branch });
    }
    if (endpoint.startsWith('/repository/branches/')) {
      const ref = decodeURIComponent(endpoint.slice('/repository/branches/'.length));
      return branches.has(ref) ? send(200, { commit: { id: branches.get(ref) } }) : send(404, {});
    }
    if (endpoint.startsWith('/repository/files/')) {
      const ref = url.searchParams.get('ref');
      const filePath = decodeURIComponent(endpoint.slice('/repository/files/'.length));
      const bytes = files.get(branches.get(ref) || ref)?.get(filePath);
      return bytes ? send(200, { encoding: 'base64', content: bytes.toString('base64'), commit_id: branches.get(ref) || ref }) : send(404, {});
    }
    if (endpoint === '/repository/commits') {
      const next = new Map(files.get(branches.get(body.branch)));
      for (const action of body.actions) {
        if (action.action === 'create' && next.has(action.file_path)) return send(409, { message: 'file exists' });
        next.set(action.file_path, Buffer.from(action.content, action.encoding === 'base64' ? 'base64' : 'utf8'));
      }
      const sha = `commit-${writes.length}`; files.set(sha, next); branches.set(body.branch, sha);
      if (loseCommitResponse) { loseCommitResponse = false; req.socket.destroy(); return; }
      return send(201, { id: sha });
    }
    if (endpoint === '/merge_requests' && req.method === 'POST') {
      const mr = { ...body, assignees: (body.assignee_ids || []).map(id => ({ id })), reviewers: (body.reviewer_ids || []).map(id => ({ id })), iid: 1, state: 'opened', web_url: 'http://fixture.test/mr/1' };
      mrs.push(mr);
      if (loseMergeResponse) { loseMergeResponse = false; req.socket.destroy(); return; }
      return send(201, mr);
    }
    return send(404, {});
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const connection = { host: `http://127.0.0.1:${server.address().port}`, project: 'group/docs', purpose: 'read_write', status: 'active' };
  const resource = { path: 'docs/images/managed.png', size: image.length, contentDigest: hash(image), delivery: 'create' };
  const input = { taskId: 'managed', title: '托管图片交付', branch: 'main', commitSha: 'base', candidateDigest: 'frozen', documents: [
    { filePath: 'docs/a.md', action: 'update', baselineContent: '# 原稿\n', markdown: '# 新稿\n\n![示意图](images/managed.png)\n', resources: [resource] },
    { filePath: 'docs/b.md', action: 'create', baselineContent: null, markdown: '<img src="images/managed.png">\n', resources: [{ ...resource }] },
  ] };
  const options = { accessToken: 'local-fixture', loadResource: async () => image };
  return { connection, input, options, files, branches, writes, mrs, loseResponse() { loseCommitResponse = true; }, loseMergeResponse() { loseMergeResponse = true; } };
}

test('真实 GitLab HTTP：两篇正文和共享托管图片原子提交，合并后回读并拒绝资源漂移', async t => {
  const f = await fixture(t);
  const result = await submitDocumentMergeRequest(f.connection, f.input, f.options);
  assert.equal(result.state, 'opened');
  const commits = f.writes.filter(write => write.endpoint === '/repository/commits');
  assert.equal(commits.length, 1);
  const actions = commits[0].body.actions;
  assert.deepEqual(actions.map(action => action.file_path), ['docs/images/managed.png', 'docs/a.md', 'docs/b.md']);
  assert.equal(actions[0].encoding, 'base64');
  assert.deepEqual(Buffer.from(actions[0].content, 'base64'), image);
  assert.equal(f.files.get('base').has('docs/images/managed.png'), false);
  await submitDocumentMergeRequest(f.connection, f.input, f.options);
  assert.equal(f.writes.filter(write => write.endpoint === '/repository/commits').length, 1);
  f.branches.set('main', f.branches.get(result.sourceBranch)); f.branches.delete(result.sourceBranch); f.mrs[0].state = 'merged';
  const readback = await readMergeRequestDelivery(f.connection, { ...f.input, mergeRequest: result }, f.options);
  assert.equal(readback.readback.status, 'consistent');
  assert.equal(readback.readback.documents.length, 2);
  assert.equal(readback.readback.documents[0].resources[0].contentDigest, hash(image));
  f.files.get(f.branches.get('main')).set('docs/images/managed.png', Buffer.from('changed'));
  await assert.rejects(() => readMergeRequestDelivery(f.connection, { ...f.input, mergeRequest: result }, f.options), error => error.code === 'GITLAB_RESOURCE_READBACK_FAILED');
});

test('MR 人员：创建、响应丢失恢复和重复提交均核对人员，不静默覆盖', async t => {
  const f = await fixture(t);
  f.input.participants = { assignees: [{ platformId: 'publisher', gitlabId: 11 }], reviewers: [{ platformId: 'reviewer', gitlabId: 12 }, { platformId: 'reviewer', gitlabId: 12 }] };
  f.loseMergeResponse();
  const created = await submitDocumentMergeRequest(f.connection, f.input, f.options);
  assert.equal(created.iid, 1);
  const post = f.writes.find(write => write.endpoint === '/merge_requests');
  assert.deepEqual(post.body.assignee_ids, [11]); assert.deepEqual(post.body.reviewer_ids, [12]);
  await submitDocumentMergeRequest(f.connection, f.input, f.options);
  assert.equal(f.mrs.length, 1);
  f.mrs[0].reviewers = [];
  await assert.rejects(() => submitDocumentMergeRequest(f.connection, f.input, f.options), error => error.code === 'GITLAB_MR_PARTICIPANTS_CONFLICT');
  assert.equal(f.mrs.length, 1);
});

test('MR 人员：已创建 MR 的人员被移除后拒绝复用，修复后幂等复用同 MR', async t => {
  const f = await fixture(t);
  f.input.participants = { assignees: [{ gitlabId: 11 }], reviewers: [{ gitlabId: 12 }] };
  await submitDocumentMergeRequest(f.connection, f.input, f.options);
  f.mrs[0].assignees = [];
  await assert.rejects(() => submitDocumentMergeRequest(f.connection, f.input, f.options), error => error.code === 'GITLAB_MR_PARTICIPANTS_CONFLICT');
  f.mrs[0].assignees = [{ id: 11 }];
  assert.equal((await submitDocumentMergeRequest(f.connection, f.input, f.options)).iid, 1);
});

test('真实 GitLab HTTP：提交已应用但响应丢失，重试对账后创建 MR，不重复提交', async t => {
  const f = await fixture(t); f.loseResponse();
  await assert.rejects(() => submitDocumentMergeRequest(f.connection, f.input, f.options), error => error.code === 'GITLAB_UNAVAILABLE');
  assert.equal(f.mrs.length, 0);
  const result = await submitDocumentMergeRequest(f.connection, f.input, f.options);
  assert.equal(result.iid, 1);
  assert.equal(f.writes.filter(write => write.endpoint === '/repository/commits').length, 1);
  assert.equal(f.writes.filter(write => write.endpoint === '/repository/branches').length, 1);
});

test('真实 GitLab HTTP：合并申请已创建但响应丢失，对账恢复且重放不重复创建', async t => {
  const f = await fixture(t); f.loseMergeResponse();
  const recovered = await submitDocumentMergeRequest(f.connection, f.input, f.options);
  assert.equal(recovered.iid, 1);
  assert.equal(recovered.state, 'opened');
  const replay = await submitDocumentMergeRequest(f.connection, f.input, f.options);
  assert.equal(replay.iid, recovered.iid);
  assert.equal(f.mrs.length, 1);
  assert.equal(f.writes.filter(write => write.endpoint === '/merge_requests').length, 1);
  assert.equal(f.writes.filter(write => write.endpoint === '/repository/commits').length, 1);
});

test('真实 GitLab HTTP：未授权读取器、内容漂移和清单冲突均在写入前拒绝', async t => {
  const f = await fixture(t);
  await assert.rejects(() => submitDocumentMergeRequest(f.connection, f.input, { accessToken: 'local-fixture' }), error => error.code === 'GITLAB_RESOURCE_READBACK_FAILED');
  await assert.rejects(() => submitDocumentMergeRequest(f.connection, f.input, { ...f.options, loadResource: async () => Buffer.from('bad') }), error => error.code === 'GITLAB_RESOURCE_SNAPSHOT_CHANGED');
  const conflicting = structuredClone(f.input); conflicting.documents[1].resources[0].contentDigest = 'changed';
  await assert.rejects(() => submitDocumentMergeRequest(f.connection, conflicting, f.options), error => error.code === 'GITLAB_RESOURCE_PATH_CONFLICT');
  const missing = structuredClone(f.input); missing.documents[0].resources = [];
  await assert.rejects(() => submitDocumentMergeRequest(f.connection, missing, f.options), error => error.code === 'GITLAB_RESOURCE_READBACK_FAILED');
  assert.deepEqual(f.writes, []);
});

test('真实 GitLab HTTP：任务分支同路径图片内容冲突时拒绝覆盖', async t => {
  const f = await fixture(t);
  f.files.set('work', new Map([...f.files.get('base'), ['docs/images/managed.png', Buffer.from('other')]]));
  f.branches.set('knowledge-review/managed', 'work');
  await assert.rejects(() => submitDocumentMergeRequest(f.connection, f.input, f.options), error => error.code === 'GITLAB_RESOURCE_READBACK_FAILED');
  assert.deepEqual(f.writes, []);
});

test('真实生产 HTTP：上传图片和共享来源图片随已保存修订冻结，审核后交付、合并回读一致', async t => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
  const { createHandbookProductionService, contextKey } = require('../../../packages/agent-runner-core/lib/handbook-production-service');
  const { MemoryIncrementalBuildRepository, IncrementalBuildService, createIncrementalBuildHandler } = require('../../../packages/agent-runner-core/lib/incremental-build-service');
  const oldMode = process.env.KNOWLEDGE_STORAGE_MODE; process.env.KNOWLEDGE_STORAGE_MODE = 'file';
  t.after(() => { if (oldMode === undefined) delete process.env.KNOWLEDGE_STORAGE_MODE; else process.env.KNOWLEDGE_STORAGE_MODE = oldMode; });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'production-managed-images-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const f = await fixture(t);
  const session = { authenticated: true, user: { id: 'author', roles: ['KNOWLEDGE_EDITOR', 'REVIEWER'] }, allowedActions: ['knowledge:read', 'knowledge:write', 'review:manage', 'publish:manage'] };
  const ctx = { handbookId: 'HB-1', documentId: 'doc-1', outlineVersionId: 'outline-v1', branch: 'main' };
  let draftState = { schemaVersion: 1, drafts: {}, attachments: {}, reviewBatches: [], idempotency: {}, audits: [] };
  let store = { read: () => structuredClone(draftState), transaction(fn) { const next = structuredClone(draftState); const result = fn(next); draftState = next; return structuredClone(result); } };
  const databaseCheck = process.env.HANDBOOK_DELIVERY_DATABASE === '1';
  let databaseStores;
  const aggregateKey = `delivery-${process.env.KNOWLEDGE_CENTER_TEST_RUN_ID}`;
  if (databaseCheck) {
    assert(process.env.KNOWLEDGE_CENTER_TEST_RUN_ID && process.env.YASDB_TEST_RUN_DIR, 'Database delivery requires unified isolated runner');
    const storageUrl = new URL(process.env.KC_STORAGE_URL);
    assert(['127.0.0.1', 'localhost'].includes(storageUrl.hostname));
    assert.notEqual(storageUrl.port, '14210', 'Never write shared Storage');
    const login = await fetch(process.env.KPG_BASE_URL + '/knowledge-center/api/auth/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin' }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const response = await fetch(process.env.KPG_BASE_URL + '/knowledge-center/api/outline/governance/list', { headers: { cookie } });
    assert.equal(response.status, 200);
    const outline = (await response.json()).data.find(item => item.id && item.outlineStructureVersion !== 'legacy-unversioned');
    assert(outline, 'Database delivery requires an existing active outline');
    ctx.outlineVersionId = outline.id;
    ctx.handbookId = outline.handbookId;
    databaseStores = require('../../../packages/agent-runner-core/lib/aggregate-store');
    store = new databaseStores.DatabaseAggregateStore('handbook-production', aggregateKey, draftState, { baseUrl: storageUrl.href });
  }
  const sourceRoot = path.join(root, 'source-images'); fs.mkdirSync(sourceRoot);
  const sourceImage = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'); const sourceDigest = hash(sourceImage);
  fs.writeFileSync(path.join(sourceRoot, sourceDigest), sourceImage);
  const repository = databaseCheck
    ? new databaseStores.DatabaseIncrementalStore(aggregateKey, { baseUrl: process.env.KC_STORAGE_URL })
    : new MemoryIncrementalBuildRepository({ schemaVersion: 1, tasks: [], publishedVersions: [], idempotency: {}, audits: [] });
  const service = new IncrementalBuildService(repository);
  const production = createHandbookProductionService({ store, attachmentRoot: path.join(root, 'attachments'), reviewService: service, ai: { sourceImageRoot: sourceRoot } });
  t.after(() => production.stopRecoveryScheduler());
  const connection = { ...f.connection, id: 'fixture', credentialRef: 'managed_fixture' };
  process.env.GITLAB_TOKEN_managed_fixture = 'local-fixture'; t.after(() => delete process.env.GITLAB_TOKEN_managed_fixture);
  const configPath = path.join(root, 'gitlab.json');
  fs.writeFileSync(configPath, JSON.stringify({ connections: [connection], mappings: [{ handbookId: ctx.handbookId, connectionId: connection.id, defaultBranch: 'main', enabledBranches: ['main'], zhPaths: ['docs'], enPaths: [] }] }));
  const auth = { authorize: async req => req.headers['x-test-anonymous'] ? null : req.headers['x-test-hidden'] ? { ...session, visibleHandbookIds: ['other'] } : session, repository: { listUsers: () => [{ id: 'author', loginName: 'author', roles: ['REVIEWER'] }] } };
  const handler = createKnowledgeCenterHandler({
    config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, GITLAB_CONFIG_PATH: configPath, OUTLINE_TEMPLATE_PATH: path.resolve(__dirname, '../../../knowledge/outlines/大纲模板.xlsx'), OUTLINE_SAMPLE_PATH: path.resolve(__dirname, '../../../knowledge/outlines/基本数据库管理手册大纲示例.xlsx') },
    KNOWLEDGE_ASSETS_CONFIG_PATH: configPath,
    stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [{ handbookId: ctx.handbookId, status: 'content_building' }] }) }, manualStatusStore: {}, brandIconStore: {}, domainStore: {} },
    moduleRegistry: { get: name => name === 'auth' ? auth : null }, handbookProductionService: production,
    handleIncrementalBuild: createIncrementalBuildHandler({ service }), databaseConnectionGovernance: {},
    sendFile(_p, res) { res.writeHead(404); res.end(); },
  });
  const server = http.createServer(handler); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}/knowledge-center/api`;
  let sequence = 0;
  async function call(method, endpoint, body, headers = {}) {
    const response = await fetch(`${base}${endpoint}`, { method, headers: { 'content-type': 'application/json', 'idempotency-key': `managed-key-${sequence++}`, ...headers }, ...(body ? { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) } : {}) });
    return { status: response.status, ...await response.json() };
  }
  const prefix = `/production/handbooks/${ctx.handbookId}/documents/${ctx.documentId}`;
  const upload = await call('POST', `${prefix}/draft-attachments?${new URLSearchParams(ctx)}`, image, { 'content-type': 'image/png', 'x-file-name': encodeURIComponent('截图.png') });
  assert.equal(upload.status, 201, JSON.stringify(upload));
  f.files.get('base').set('docs/images/existing.png', image);
  const sourceUrl = `/knowledge-center/api/production/handbooks/${encodeURIComponent(ctx.handbookId)}/documents/doc-1/ai-sources/images/${sourceDigest}?${new URLSearchParams({ outlineVersionId: ctx.outlineVersionId, branch: ctx.branch })}`;
  let content = `# 待交付稿\n\n![上传](${upload.data.stableReference})\n\n<div><img src="${sourceUrl.replace(/&/g, '&amp;')}" alt="来源"></div>\n\n<img src='images/existing.png' alt="基线">\n`;
  const saved = await call('PUT', `${prefix}/draft`, { ...ctx, editVersion: 0, baselineDigest: hash('# 原稿\n'), markdown: content, attachmentIds: [upload.data.attachmentId] });
  assert.equal(saved.status, 200, JSON.stringify(saved));
  const unchangedCtx = { ...ctx, documentId: 'doc-2' };
  const unchangedPrefix = `/production/handbooks/${ctx.handbookId}/documents/${unchangedCtx.documentId}`;
  const unchangedMarkdown = '# 使用说明\n\n这篇保持原样，验证通过结论可以保留。\n';
  const unchangedSaved = await call('PUT', `${unchangedPrefix}/draft`, { ...unchangedCtx, editVersion: 0, baselineDigest: hash(''), markdown: unchangedMarkdown });
  assert.equal(unchangedSaved.status, 200, JSON.stringify(unchangedSaved));
  let submitBody = { defaultReviewerIds: ['author'], documents: [
    { ...ctx, filePath: 'docs/a.md', draftRevisionId: saved.data.draft.currentRevisionId, markdown: '# 伪造正文', resources: [{ path: 'outside/forged.png' }] },
    { ...unchangedCtx, filePath: 'docs/b.md', draftRevisionId: unchangedSaved.data.draft.currentRevisionId },
  ] };
  // A valid digest/file alone does not grant source-image access.
  const denied = await call('POST', `/production/handbooks/${encodeURIComponent(ctx.handbookId)}/incremental-reviews`, submitBody);
  assert.equal(denied.status, 404, JSON.stringify(denied));
  assert.equal(repository.read().tasks.length, 0);
  assert.deepEqual(f.writes, []);
  // Shared source snapshots are read through the existing revision permission path.
  store.transaction(state => {
    state.drafts[contextKey(ctx)].revisions[0].generationMetadata = { sourceSnapshots: [{ contextKey: contextKey(ctx), imageResources: [{ status: 'ready', assetId: sourceDigest, contentDigest: sourceDigest, contentType: 'image/gif' }] }] };
  });
  // Exercise the same saved document through rejection and revision before delivery.
  const firstSubmission = await call('POST', `/production/handbooks/${encodeURIComponent(ctx.handbookId)}/incremental-reviews`, submitBody);
  assert.equal(firstSubmission.status, 201, JSON.stringify(firstSubmission));
  const rejectedTask = service.get(session, firstSubmission.data.tasks[0].id);
  assert.equal(rejectedTask.handbookSource.documents.length, 2);
  const rejectedSnapshot = structuredClone(rejectedTask.candidate);
  const unchangedReview = rejectedTask.reviews.find(review => review.documentId === unchangedCtx.documentId);
  assert(unchangedReview);
  const firstApproval = await call('POST', `/incremental-tasks/${rejectedTask.id}/reviews/${unchangedReview.id}/decision`, {
    decision: 'approve', candidateDigest: rejectedTask.candidate.digest,
  });
  assert.equal(firstApproval.status, 200, JSON.stringify(firstApproval));
  assert.equal(service.get(session, rejectedTask.id).state, 'under_review');
  const partialPublish = await call('POST', `/incremental-tasks/${rejectedTask.id}/publish`, { expectedCandidateDigest: rejectedTask.candidate.digest });
  assert.notEqual(partialPublish.status, 200, JSON.stringify(partialPublish));
  assert.deepEqual(f.writes, []);
  const rejection = await call('POST', `/incremental-tasks/${rejectedTask.id}/reviews/${rejectedTask.reviews[0].id}/decision`, {
    decision: 'reject', comment: '请补充操作说明后重新送审', candidateDigest: rejectedTask.candidate.digest,
  });
  assert.equal(rejection.status, 200, JSON.stringify(rejection));
  const rejectedReadback = await call('GET', `${prefix}/draft?${new URLSearchParams(ctx)}`);
  assert.equal(rejectedReadback.status, 200, JSON.stringify(rejectedReadback));
  assert.equal(rejectedReadback.data.draft.reviewState.reviewStatus, 'rejected');
  content += '\n补充操作说明：核对正文和三张图片后提交审核。\n';
  const revised = await call('PUT', `${prefix}/draft`, { ...ctx, editVersion: saved.data.draft.editVersion,
    baselineDigest: hash('# 原稿\n'), markdown: content, attachmentIds: [upload.data.attachmentId] });
  assert.equal(revised.status, 200, JSON.stringify(revised));
  assert.notEqual(revised.data.draft.currentRevisionId, saved.data.draft.currentRevisionId);
  submitBody = { ...submitBody, revisionOfTaskId: rejectedTask.id,
    documents: [{ ...submitBody.documents[0], draftRevisionId: revised.data.draft.currentRevisionId }, submitBody.documents[1]] };
  const submitted = await call('POST', `/production/handbooks/${encodeURIComponent(ctx.handbookId)}/incremental-reviews`, submitBody);
  assert.equal(submitted.status, 201, JSON.stringify(submitted));
  const task = service.get(session, submitted.data.tasks[0].id); const doc = task.handbookSource.documents[0];
  const carriedReview = task.reviews.find(review => review.documentId === unchangedCtx.documentId);
  assert.equal(carriedReview.status, 'approved');
  assert.equal(carriedReview.carriedFrom.taskId, rejectedTask.id);
  assert.equal(task.reviews.find(review => review.documentId === ctx.documentId).status, 'pending');
  assert.equal(task.capabilities.canPublish, false);
  assert.equal(doc.resources.length, 3);
  assert.deepEqual(doc.resources.map(resource => resource.contentDigest), [hash(image), sourceDigest, hash(image)]);
  assert.equal(doc.resources.filter(resource => resource.delivery === 'create').length, 2);
  assert.equal(doc.markdown.includes('/knowledge-center/api/'), false);
  assert.equal(doc.markdown.includes(`assets/${sourceDigest}.gif`), true);
  assert.equal(production.getDraft(ctx, session).draft.revision.markdown, content);
  assert.equal(task.candidate.content.includes(doc.markdown), true);
  assert.equal(task.candidate.content.includes(unchangedMarkdown), true);
  assert.equal(JSON.stringify(task).includes(root), false);
  assert.deepEqual(f.writes, []);
  const previewParams = new URLSearchParams({ candidateDigest: task.candidate.digest, documentId: ctx.documentId, path: doc.resources[0].path });
  const previewUrl = `${base}/incremental-tasks/${task.id}/resources?${previewParams}`;
  const preview = await fetch(previewUrl);
  assert.equal(preview.status, 200); assert.equal(preview.headers.get('content-type'), 'image/png');
  assert.equal(preview.headers.get('cache-control'), 'private, no-store');
  assert.equal(preview.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await preview.arrayBuffer()), image);
  assert.equal((await fetch(previewUrl, { headers: { 'x-test-anonymous': '1' } })).status, 401);
  assert.equal((await fetch(previewUrl, { headers: { 'x-test-hidden': '1' } })).status, 404);
  for (const [key, value, expected] of [['candidateDigest', 'old', 409], ['documentId', 'other', 404], ['path', '../private', 404]]) {
    const params = new URLSearchParams(previewParams); params.set(key, value);
    assert.equal((await fetch(`${base}/incremental-tasks/${task.id}/resources?${params}`)).status, expected);
  }
  const existingParams = new URLSearchParams(previewParams); existingParams.set('path', 'docs/images/existing.png');
  const existingUrl = `${base}/incremental-tasks/${task.id}/resources?${existingParams}`;
  // The current branch may move; preview must still read the frozen base SHA.
  f.files.set('later', new Map(f.files.get('base'))); f.files.get('later').set('docs/images/existing.png', Buffer.from('changed'));
  f.branches.set('main', 'later');
  const pinned = await fetch(existingUrl); assert.equal(pinned.status, 200); assert.deepEqual(Buffer.from(await pinned.arrayBuffer()), image);
  f.branches.set('main', 'base');
  const approve = await call('POST', `/incremental-tasks/${task.id}/reviews/${task.reviews[0].id}/decision`, { decision: 'approve', candidateDigest: task.candidate.digest });
  assert.equal(approve.status, 200, JSON.stringify(approve));
  // Frozen delivery survives original upload and source-image deletion.
  fs.unlinkSync(path.join(production.attachmentRoot, upload.data.storageName)); fs.unlinkSync(path.join(sourceRoot, sourceDigest));
  const replayed = await call('POST', `/production/handbooks/${encodeURIComponent(ctx.handbookId)}/incremental-reviews`, submitBody);
  assert.equal(replayed.status, 201, JSON.stringify(replayed));
  assert.equal(replayed.data.tasks[0].id, task.id);
  assert.equal(repository.read().tasks.length, 2);
  assert.equal(service.get(session, rejectedTask.id).state, 'rejected');
  assert.deepEqual(service.get(session, rejectedTask.id).candidate, rejectedSnapshot);
  assert.equal(service.get(session, rejectedTask.id).reviews[0].decision.comment, '请补充操作说明后重新送审');
  assert.deepEqual(Buffer.from(await (await fetch(previewUrl)).arrayBuffer()), image);
  if (process.env.HANDBOOK_BROWSER_CHECK === '1') {
    const { chromium } = require('../../../runtime/agent-runner/node_modules/playwright');
    const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const webRoot = path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center');
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/knowledge-center/api/')) return route.continue();
      if (url.pathname === '/knowledge-center/review-image-fixture') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="/knowledge-center/common/tokens.css"><link rel="stylesheet" href="/knowledge-center/common/base.css"><link rel="stylesheet" href="/knowledge-center/common/components.css"><link rel="stylesheet" href="/knowledge-center/styles.css"><link rel="stylesheet" href="/knowledge-center/modules/review-publishing/review-publishing.css"><link rel="stylesheet" href="/knowledge-center/modules/repository/repository.css"></head><body><main id="review"></main></body></html>' });
      const relative = url.pathname.replace(/^\/knowledge-center\//, '');
      const file = path.resolve(webRoot, relative);
      if (!file.startsWith(webRoot + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ contentType: path.extname(file) === '.js' ? 'application/javascript' : 'text/css', body: fs.readFileSync(file) });
    });
    await page.goto(`${base.replace('/knowledge-center/api', '')}/knowledge-center/review-image-fixture?documentId=${ctx.documentId}&path=docs/a.md`);
    await page.evaluate(async ({ taskId, handbookId }) => {
      const { renderReviewRepositoryRegion } = await import('/knowledge-center/modules/review-publishing/view.js');
      window.reviewImageRenderer = { renderReviewRepositoryRegion };
      const response = await fetch(`/knowledge-center/api/incremental-tasks/${taskId}`);
      const payload = await response.json(); const task = payload.data.task || payload.data;
      document.querySelector('#review').innerHTML = renderReviewRepositoryRegion({ reviewProjection: { items: [task], detail: { task } }, gitlabProjection: { handbookId, branch: 'main', language: 'zh', tree: [], branches: [] } });
    }, { taskId: task.id, handbookId: ctx.handbookId });
    const img = page.locator('.review-reader-snapshot img[alt="上传"]');
    await img.waitFor(); await img.evaluate(el => el.decode());
    assert.equal(await img.evaluate(el => el.naturalWidth), 1);
    for (const alt of ['来源', '基线']) {
      const resourceImage = page.locator(`.review-reader-snapshot img[alt="${alt}"]`);
      await resourceImage.evaluate(el => el.decode()); assert.equal(await resourceImage.evaluate(el => el.naturalWidth), 1);
    }
    assert.match(await img.getAttribute('src'), /incremental-tasks\/[^/]+\/resources\?/);
    assert.equal(new URL(await img.evaluate(el => el.src)).searchParams.get('candidateDigest'), task.candidate.digest);
    const overviewRows = task.handbookSource.documents.map(document => ({ taskId: task.id, candidateDigest: task.candidate.digest,
      documentId: document.documentId, path: document.filePath, handbookId: task.handbookId,
      branch: task.handbookSource.branch, title: document.filePath, state: task.state }));
    const overview = service.reviewOverview(session, overviewRows);
    await page.evaluate(({ rows, snapshots, handbookId }) => {
      window.history.replaceState(null, '', '/knowledge-center/review-image-fixture');
      const { renderReviewRepositoryRegion } = window.reviewImageRenderer;
      document.querySelector('#review').innerHTML = renderReviewRepositoryRegion({
        reviewProjection: { handbookId, workbench: { documents: rows, overview: snapshots }, allItems: [], detail: null },
        gitlabProjection: { handbookId, branch: 'main', language: 'zh', status: 'ok', tree: [], branches: [] },
      });
    }, { rows: overviewRows, snapshots: overview, handbookId: ctx.handbookId });
    for (const alt of ['上传', '来源', '基线']) {
      const resourceImage = page.locator(`.review-handbook-overview img[alt="${alt}"]`);
      await resourceImage.evaluate(el => el.decode()); assert.equal(await resourceImage.evaluate(el => el.naturalWidth), 1);
    }
    const evidence = path.resolve(__dirname, '../../../runtime/test-results/continuation-20261029'); fs.mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: path.join(evidence, 'frozen-review-image.png'), fullPage: true });
    assert.deepEqual(errors, []);
    t.diagnostic('Chromium实际审核阅读组件：原图删除后，真实HTTP冻结图片decode成功且naturalWidth=1；不是共享13510部署验收');
  }
  const publishBody = { expectedCandidateDigest: task.candidate.digest, assigneeId: 'author' };
  const frozenPath = path.join(production.attachmentRoot, 'delivery-images', hash(image));
  fs.unlinkSync(frozenPath);
  assert.equal((await fetch(previewUrl)).status, 409);
  const missing = await call('POST', `/incremental-tasks/${task.id}/publish`, publishBody);
  assert.equal(missing.status, 409, JSON.stringify(missing));
  assert.equal(service.get(session, task.id).state, 'approved');
  assert.deepEqual(f.writes, []);
  fs.writeFileSync(frozenPath, 'tampered', { mode: 0o600 });
  assert.equal((await fetch(previewUrl)).status, 409);
  const changed = await call('POST', `/incremental-tasks/${task.id}/publish`, publishBody);
  assert.equal(changed.status, 409, JSON.stringify(changed));
  assert.equal(service.get(session, task.id).state, 'approved');
  assert.deepEqual(f.writes, []);
  fs.writeFileSync(frozenPath, image);
  f.loseResponse();
  const lostResponse = await call('POST', `/incremental-tasks/${task.id}/publish`, publishBody);
  assert.notEqual(lostResponse.status, 200, JSON.stringify(lostResponse));
  assert.notEqual(service.get(session, task.id).completion.status, 'completed');
  assert.equal(f.writes.filter(write => write.endpoint === '/repository/commits').length, 1);
  assert.equal(f.mrs.length, 0);
  f.loseMergeResponse();
  const concurrentPublish = await Promise.all([
    call('POST', `/incremental-tasks/${task.id}/publish`, publishBody),
    call('POST', `/incremental-tasks/${task.id}/publish`, publishBody),
  ]);
  for (const response of concurrentPublish) assert.equal(response.status, 200, JSON.stringify(response));
  const published = concurrentPublish[0];
  assert.equal(published.status, 200, JSON.stringify(published));
  assert.equal(f.mrs.length, 1);
  assert.equal(f.writes.filter(write => write.endpoint === '/merge_requests').length, 1);
  assert.notEqual(service.get(session, task.id).completion.status, 'completed');
  const actions = f.writes.find(write => write.endpoint === '/repository/commits').body.actions;
  assert.equal(actions.length, 4); assert.equal(actions.filter(action => action.encoding === 'base64').length, 2);
  f.branches.set('main', f.branches.get(published.data.sourceBranch)); f.branches.delete(published.data.sourceBranch); f.mrs[0].state = 'merged';
  const mergedFiles = f.files.get(f.branches.get('main'));
  const mergedMarkdown = mergedFiles.get('docs/a.md');
  mergedFiles.set('docs/a.md', Buffer.from('# 远端已变化\n'));
  const drifted = await call('POST', `/incremental-tasks/${task.id}/publish`, publishBody);
  assert.notEqual(drifted.status, 200, JSON.stringify(drifted));
  assert.notEqual(service.get(session, task.id).completion.status, 'completed');
  mergedFiles.set('docs/a.md', mergedMarkdown);
  const refreshed = await call('POST', `/incremental-tasks/${task.id}/publish`, publishBody);
  assert.equal(refreshed.status, 200, JSON.stringify(refreshed));
  assert.equal(service.get(session, task.id).completion.status, 'completed');
  assert.equal(f.writes.filter(write => write.endpoint === '/repository/commits').length, 1);
  const savedAgain = await call('GET', `${prefix}/draft?${new URLSearchParams(ctx)}`);
  assert.equal(savedAgain.status, 200, JSON.stringify(savedAgain));
  assert.equal(savedAgain.data.draft.revision.markdown, content);
  assert.equal(savedAgain.data.draft.reviewState.reviewStatus, 'approved');
  const unchangedReadback = await call('GET', `${unchangedPrefix}/draft?${new URLSearchParams(unchangedCtx)}`);
  assert.equal(unchangedReadback.status, 200, JSON.stringify(unchangedReadback));
  assert.equal(unchangedReadback.data.draft.revision.markdown, unchangedMarkdown);
  assert.equal(unchangedReadback.data.draft.reviewState.reviewStatus, 'approved');
  assert.equal(mergedFiles.get('docs/b.md').toString('utf8'), unchangedMarkdown);
  if (databaseCheck) {
    const fresh = new IncrementalBuildService(new databaseStores.DatabaseIncrementalStore(aggregateKey, { baseUrl: process.env.KC_STORAGE_URL }));
    assert.equal(fresh.get(session, task.id).completion.status, 'completed');
    const evidence = { realDatabase: true, realHTTP: true, realEnterpriseGitLab: false, realModel: false,
      contextMode: 'file fixture', identity: 'fixture author', aggregateKey, taskId: task.id,
      rejectedTaskId: rejectedTask.id, rejectionHistoryPreserved: fresh.get(session, rejectedTask.id).state === 'rejected',
      revisedDraftRevisionId: revised.data.draft.currentRevisionId,
      documentCount: 2, unchangedApprovalCarried: true, partialApprovalDeliveryBlocked: true, bothDraftsReadback: 'exact',
      concurrentPublishReconciled: true, lostMergeRequestResponseRecovered: true, lostCommitResponseRecovered: true, mergedContentDriftRejected: true, completion: fresh.get(session, task.id).completion, draftReadback: 'exact', reviewStatus: savedAgain.data.draft.reviewState.reviewStatus,
      resourceCount: doc.resources.length, commitCount: f.writes.filter(write => write.endpoint === '/repository/commits').length };
    fs.writeFileSync(path.join(process.env.YASDB_TEST_RUN_DIR, 'delivery-database-http.json'), JSON.stringify(evidence, null, 2), { flag: 'wx' });
    t.diagnostic('真实test_hy保存、正式HTTP送审/审核/交付及新服务完成状态回读；GitLab为本地HTTP夹具');
  }
});

test('托管图片适配：保留代码和周围正文，引用式/嵌套 Markdown 与 HTML 共用冻结路径', t => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const { createProductionResourceDelivery } = require('../../../packages/agent-runner-core/lib/production-resource-delivery');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'image-rewrite-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const ctx = { handbookId: 'HB-1', documentId: 'doc-1', outlineVersionId: 'outline-v1', branch: 'main' };
  const id = 'attachment-test'; const url = `/knowledge-center/api/production/attachments/${id}`;
  const delivery = createProductionResourceDelivery({ root, readAttachment: () => ({ metadata: { ...ctx, kind: 'image', digest: hash(image) }, buffer: image }) });
  const code = `\`![示例](${url})\`\n\n\`\`\`html\n<img src="${url}">\n\`\`\`\n`;
  const content = `开头\n\n${code}\n- ![内嵌][ref]\n\n[ref]: ${url}\n\n正文 <em>保持</em> <img src='${url}' alt='截图'> 结尾\n`;
  const document = { ...ctx, filePath: 'docs/chapter/page.md', markdown: content };
  const authorized = [];
  const result = delivery.prepare(document, { attachmentIds: [id] }, {}, resourcePath => authorized.push(resourcePath));
  assert.equal(result.managedResources.length, 1);
  assert.equal(result.markdown.includes(code), true);
  assert.equal(result.markdown.includes(`- ![内嵌](assets/${hash(image)}.png)`), true);
  assert.equal(result.markdown.includes(`正文 <em>保持</em> <img src="assets/${hash(image)}.png" alt='截图'> 结尾`), true);
  assert.equal(authorized.every(resourcePath => resourcePath === `docs/chapter/assets/${hash(image)}.png`), true);
  assert.equal(fs.statSync(path.join(root, hash(image))).mode & 0o777, 0o600);
  assert.deepEqual(delivery.readFrozen(result.managedResources[0]), image);
  fs.writeFileSync(path.join(root, hash(image)), 'tampered');
  assert.throws(() => delivery.readFrozen(result.managedResources[0]), error => error.code === 'GITLAB_RESOURCE_SNAPSHOT_CHANGED');
});

test('托管图片适配：越权上下文、伪造内容、未引用附件、外链及大小限制均拒绝', t => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const { createProductionResourceDelivery } = require('../../../packages/agent-runner-core/lib/production-resource-delivery');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'image-boundary-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const ctx = { handbookId: 'HB-1', documentId: 'doc-1', outlineVersionId: 'outline-v1', branch: 'main' };
  const url = '/knowledge-center/api/production/attachments/test';
  let metadata = { ...ctx, kind: 'image', digest: hash(image) }; let sourceReads = 0;
  let policy = { version: 'test', resourceDirectory: 'assets', maxCount: 2, maxBytes: 1000, maxTotalBytes: 1000 };
  const delivery = createProductionResourceDelivery({ root, policy: () => policy, readAttachment: () => ({ metadata, buffer: image }), readSourceImage: () => { sourceReads++; return { data: image }; } });
  const document = { ...ctx, filePath: 'docs/page.md', markdown: `![图片](${url})` };
  const revision = { attachmentIds: ['test'] };
  const prepare = (doc = document, rev = revision, authorize = () => {}) => delivery.prepare(doc, rev, {}, authorize);
  assert.throws(() => prepare(document, { attachmentIds: [] }), error => error.code === 'ATTACHMENT_CONTEXT_MISMATCH');
  metadata = { ...metadata, documentId: 'other' };
  assert.throws(() => prepare(), error => error.code === 'ATTACHMENT_CONTEXT_MISMATCH');
  metadata = { ...metadata, documentId: ctx.documentId, digest: 'forged' };
  assert.throws(() => prepare(), error => error.code === 'GITLAB_RESOURCE_SNAPSHOT_CHANGED');
  metadata = { ...metadata, digest: hash(image) };
  assert.throws(() => prepare({ ...document, markdown: '# 无图片' }), error => error.code === 'ATTACHMENT_DELIVERY_UNSUPPORTED');
  assert.throws(() => prepare({ ...document, markdown: '<img src="https://example.test/private.png?token=secret">' }, { attachmentIds: [] }), error => error.code === 'GITLAB_RESOURCE_DELIVERY_UNSUPPORTED' && !error.message.includes('secret'));
  assert.throws(() => prepare(document, revision, () => { throw Object.assign(new Error('路径越界'), { code: 'GITLAB_PATH_FORBIDDEN' }); }), error => error.code === 'GITLAB_PATH_FORBIDDEN');
  for (const [documentId, query] of [['other', 'outlineVersionId=outline-v1&branch=main'], ['doc-1', 'outlineVersionId=old&branch=main'], ['doc-1', 'outlineVersionId=outline-v1&branch=other']]) {
    assert.throws(() => prepare({ ...document, markdown: `![来源](/knowledge-center/api/production/handbooks/HB-1/documents/${documentId}/ai-sources/images/${hash(image)}?${query})` }, { attachmentIds: [] }), error => error.code === 'GITLAB_RESOURCE_CONTEXT_MISMATCH');
  }
  assert.equal(sourceReads, 0);
  policy = { ...policy, maxBytes: image.length - 1 };
  assert.throws(() => prepare(), error => error.code === 'GITLAB_RESOURCE_TOO_LARGE');
  assert.deepEqual(fs.readdirSync(root), []);
});
