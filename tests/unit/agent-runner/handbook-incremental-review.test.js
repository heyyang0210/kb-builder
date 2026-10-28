const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const { createHandbookProductionService } = require('../../../packages/agent-runner-core/lib/handbook-production-service');
const { MemoryIncrementalBuildRepository, IncrementalBuildService, createIncrementalBuildHandler } = require('../../../packages/agent-runner-core/lib/incremental-build-service');
const { submitDocumentMergeRequest, extractMarkdownResources } = require('../../../packages/agent-runner-core/lib/gitlab-connector');

const session = { authenticated: true, user: { id: 'author', roles: ['KNOWLEDGE_EDITOR', 'REVIEWER'] }, allowedActions: ['knowledge:read', 'knowledge:write', 'review:manage', 'publish:manage'] };
const context = { handbookId: 'HB-1', documentId: 'doc-1', outlineVersionId: 'outline-v1', branch: 'main' };
const oldContent = '# 仓库基线\n';
const markdown = '# 保存后的审核正文\n';
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
async function listen(t, handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('真实 HTTP：保存 → 增量评审 → 本人审核 → 创建 MR，失败与重试保持冻结版本', async t => {
  const previousStorageMode = process.env.KNOWLEDGE_STORAGE_MODE;
  process.env.KNOWLEDGE_STORAGE_MODE = 'file';
  t.after(() => {
    if (previousStorageMode === undefined) delete process.env.KNOWLEDGE_STORAGE_MODE;
    else process.env.KNOWLEDGE_STORAGE_MODE = previousStorageMode;
  });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'handbook-mr-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let branchSha = 'base-sha'; let commits = 0; let failMr = true;
  const resourceFiles = new Map(); const resourceReads = [];
  const branches = { main: { content: oldContent } }; const mrs = []; const committedActions = new Map();
  const upstream = await listen(t, async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const endpoint = url.pathname.replace(/^\/api\/v4\/projects\/[^/]+/, '');
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (endpoint === '/repository/tree') return send(200, [{ path: 'docs/page.md', name: 'page.md', type: 'blob' }, { path: 'docs/reference.md', name: 'reference.md', type: 'blob' }]);
    if (endpoint === '/repository/branches' && req.method === 'GET') return send(200, [{ name: 'main', commit: { id: branchSha } }]);
    if (endpoint.startsWith('/repository/branches/')) {
      const ref = decodeURIComponent(endpoint.slice('/repository/branches/'.length));
      return branches[ref] ? send(200, { name: ref, commit: { id: ref === 'main' ? branchSha : 'work-sha' } }) : send(404, {});
    }
    if (endpoint === '/repository/branches') { branches[body.branch] = { content: oldContent }; return send(201, { name: body.branch }); }
    if (endpoint.startsWith('/repository/files/')) {
      const requestedPath = decodeURIComponent(endpoint.slice('/repository/files/'.length));
      if (!/\.(md|markdown)$/i.test(requestedPath)) {
        resourceReads.push({ path: requestedPath, ref: url.searchParams.get('ref') });
        const bytes = resourceFiles.get(requestedPath);
        return bytes ? send(200, { encoding: 'base64', content: bytes.toString('base64'), blob_id: 'image-blob' }) : send(404, {});
      }
      const ref = url.searchParams.get('ref'); const file = branches[ref] || (['base-sha', branchSha].includes(ref) ? branches.main : null);
      return file ? send(200, { encoding: 'base64', content: Buffer.from(file.content).toString('base64'), commit_id: 'file-sha' }) : send(404, {});
    }
    if (endpoint === '/repository/commits') { commits++; branches[body.branch].content = body.actions[0].content; committedActions.set(body.branch, body.actions); return send(201, { id: 'commit-sha' }); }
    if (/^\/merge_requests\/\d+\/changes$/.test(endpoint)) {
      const mr = mrs.find(item => String(item.iid) === endpoint.split('/')[2]);
      return mr ? send(200, { ...mr, changes: (committedActions.get(mr.source_branch) || []).map(item => ({ old_path: item.file_path, new_path: item.file_path, diff: item.content })) }) : send(404, {});
    }
    if (/^\/merge_requests\/\d+$/.test(endpoint) && req.method === 'GET') {
      const mr = mrs.find(item => String(item.iid) === endpoint.split('/')[2]);
      return mr ? send(200, mr) : send(404, {});
    }
    if (endpoint === '/merge_requests' && req.method === 'GET') return send(200, mrs);
    if (endpoint === '/merge_requests') {
      if (failMr) { failMr = false; return send(503, { message: 'fixture outage' }); }
      const iid = mrs.length + 1;
      const mr = { ...body, iid, state: 'opened', web_url: `${upstream}/group/docs/-/merge_requests/${iid}` }; mrs.push(mr); return send(201, mr);
    }
    return send(404, { endpoint });
  });
  const connection = { id: 'fixture', host: upstream, project: 'group/docs', credentialRef: 'handbook_fixture', purpose: 'read_write', status: 'active' };
  process.env.GITLAB_TOKEN_handbook_fixture = 'local-fixture';
  t.after(() => delete process.env.GITLAB_TOKEN_handbook_fixture);
  const configPath = path.join(root, 'gitlab.json');
  fs.writeFileSync(configPath, JSON.stringify({ connections: [connection], mappings: [{ handbookId: 'HB-1', connectionId: 'fixture', defaultBranch: 'main', enabledBranches: ['main'], zhPaths: ['docs'], enPaths: [] }] }));
  let draftState = { schemaVersion: 1, drafts: {}, attachments: {}, reviewBatches: [], idempotency: {}, audits: [] };
  const production = createHandbookProductionService({ attachmentRoot: root, store: { read: () => structuredClone(draftState), transaction(fn) { const next = structuredClone(draftState); const result = fn(next); draftState = next; return structuredClone(result); } } });
  const repository = new MemoryIncrementalBuildRepository({ schemaVersion: 1, tasks: [], publishedVersions: [], idempotency: {}, audits: [] });
  const service = new IncrementalBuildService(repository);
  const auth = { authorize: async req => req.headers['x-user'] ? { ...session, user: { ...session.user, id: req.headers['x-user'] }, ...(req.headers['x-visible'] ? { visibleHandbookIds: [req.headers['x-visible']] } : {}) } : req.headers['x-no-review'] ? { ...session, allowedActions: ['knowledge:read', 'knowledge:write'] } : session, repository: { listUsers: () => [{ id: 'author', roles: ['REVIEWER'] }] } };
  const handler = createKnowledgeCenterHandler({
    config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, GITLAB_CONFIG_PATH: configPath, OUTLINE_TEMPLATE_PATH: path.resolve(__dirname, '../../../knowledge/outlines/大纲模板.xlsx'), OUTLINE_SAMPLE_PATH: path.resolve(__dirname, '../../../knowledge/outlines/基本数据库管理手册大纲示例.xlsx') },
    KNOWLEDGE_ASSETS_CONFIG_PATH: configPath,
    stores: { knowledgeAssetsStore: { read: () => ({ generatedAt: 'fixture', handbooks: [{ handbookId: 'HB-1', name: '隔离手册', status: 'content_building' }, { handbookId: 'HB-early', status: 'outline_published' }] }) }, manualStatusStore: {}, brandIconStore: {}, domainStore: {} },
    moduleRegistry: { get: name => name === 'auth' ? auth : null }, handbookProductionService: production,
    handleIncrementalBuild: createIncrementalBuildHandler({ service }), databaseConnectionGovernance: {},
    sendFile(_p, res) { res.writeHead(404); res.end(); },
  });
  const base = await listen(t, handler);
  let sequence = 0;
  async function call(method, endpoint, body, extra = {}) {
    const response = await fetch(`${base}/knowledge-center/api${endpoint}`, { method, headers: { 'content-type': 'application/json', 'idempotency-key': `key-${sequence++}`, ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const payload = await response.json(); return { status: response.status, ...payload };
  }
  const draftPath = '/production/handbooks/HB-1/documents/doc-1/draft';
  const saved = await call('PUT', draftPath, { ...context, editVersion: 0, baselineDigest: hash(oldContent), markdown, htmlSnapshot: '<h1>保存后的审核正文</h1>', attachmentIds: [] });
  assert.equal(saved.status, 200, JSON.stringify(saved));
  const input = { defaultReviewerIds: ['author'], documents: [{ ...context, filePath: 'docs/page.md', draftRevisionId: saved.data.draft.currentRevisionId }] };
  const submitPath = '/production/handbooks/HB-1/incremental-reviews';
  const created = await call('POST', submitPath, input);
  assert.equal(created.status, 201, JSON.stringify(created));
  const task = created.data.tasks[0]; const taskPath = `/incremental-tasks/${task.id}`;
  assert.equal(task.state, 'under_review'); assert.equal(task.candidate.content, markdown);
  assert.deepEqual(service.listBaselines(session), []);
  const repeat = await call('POST', submitPath, input);
  assert.equal(repeat.data.tasks[0].id, task.id); assert.equal(repository.read().tasks.length, 1);
  const hub = await call('GET', '/review/bootstrap?view=handbooks');
  assert.equal(hub.status, 200, JSON.stringify(hub));
  assert.equal(hub.data.detail, null);
  assert.deepEqual(hub.data.workbench.handbooks.map(item => item.handbookId), ['HB-1']);
  assert.equal(hub.data.workbench.handbooks[0].pendingCount, 1);
  assert.equal(hub.data.workbench.mine[0].documentId, 'doc-1');
  assert.equal((await call('GET', '/review/bootstrap?view=mine', null, { 'x-user': 'not-assigned' })).data.workbench.mine.length, 0);
  assert.equal((await call('GET', '/review/bootstrap?view=mine', null, { 'x-no-review': 'yes' })).data.workbench.mine.length, 0);
  const hidden = await call('GET', '/review/bootstrap?view=handbooks', null, { 'x-user': 'other', 'x-visible': 'HB-early' });
  assert.equal(hidden.data.workbench.handbooks.length, 0);
  assert.equal(hidden.data.workbench.documents.length, 0);
  assert.equal((await call('GET', `/review/bootstrap?view=reader&handbookId=HB-early&taskId=${task.id}`)).status, 409);
  assert.equal((await call('GET', `/review/bootstrap?view=reader&handbookId=HB-1&taskId=${task.id}&documentId=wrong&path=docs/page.md`)).status, 409);
  const publishBody = { expectedCandidateDigest: task.candidate.digest };
  assert.equal((await call('POST', `${taskPath}/publish`, publishBody)).status, 409);
  assert.equal((await call('POST', `${taskPath}/reviews/${task.reviews[0].id}/decision`, { decision: 'approve' }, { 'x-no-review': 'yes' })).status, 403);
  const beforeDecision = repository.read();
  for (const decision of ['approve', 'reject']) {
    const stale = await call('POST', `${taskPath}/reviews/${task.reviews[0].id}/decision`, { decision, comment: '需要修改', candidateDigest: 'stale-page' });
    assert.equal(stale.status, 409); assert.equal(stale.error.code, 'REVIEW_CANDIDATE_CONFLICT');
    assert.deepEqual(repository.read(), beforeDecision);
  }
  assert.equal((await call('POST', `${taskPath}/reviews/${task.reviews[0].id}/decision`, { decision: 'approve', candidateDigest: task.candidate.digest })).status, 200);
  assert.equal((await call('GET', '/review/bootstrap?view=mine')).data.workbench.mine.length, 0);
  assert.equal((await call('POST', `${taskPath}/publish`, publishBody)).status, 503);
  assert.equal(service.get(session, task.id).state, 'approved'); assert.equal(mrs.length, 0);
  const published = await call('POST', `${taskPath}/publish`, publishBody);
  assert.equal(published.status, 200, JSON.stringify(published)); assert.equal(published.data.iid, 1);
  assert.equal(commits, 1); assert.equal(mrs.length, 1); assert.equal(branches.main.content, oldContent);
  assert.equal((await call('POST', `${taskPath}/publish`, publishBody)).data.iid, 1);
  assert.equal(service.get(session, task.id).state, 'mr_submitted');
  assert.equal(repository.read().publishedVersions.some(item => item.current), false);
  const nextSaved = await call('PUT', draftPath, { ...context, editVersion: 1, baselineDigest: hash(oldContent), markdown: '# 后续修改', htmlSnapshot: '', attachmentIds: [] });
  assert.equal(nextSaved.status, 200); assert.equal(service.get(session, task.id).candidate.content, markdown);
  assert.equal((await call('POST', submitPath, input)).status, 409);
  if (process.env.HANDBOOK_BROWSER_CHECK === '1') {
    const { chromium } = require('../../../runtime/agent-runner/node_modules/playwright');
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const openHandbookMore = async () => { const menu = page.locator('.handbook-more-menu'); if (!await menu.evaluate(el => el.open)) await menu.locator('summary').click(); };
    const webRoot = path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center');
    const outline = { id: 'outline-v1', handbookId: 'HB-1', name: '隔离手册', status: 'published', nodes: [{ id: 'doc-1', kind: 'document', title: 'page.md', filePath: 'docs/page.md' }, { id: 'doc-initial', kind: 'document', title: 'page.md', filePath: 'docs/page.md' }] };
    let failNextSave = true;
    let failNextDecision = false;
    const browserDecisions = [];
    await page.route('**/*', async route => {
      const req = route.request(); const url = new URL(req.url());
      if (url.pathname.startsWith('/knowledge-center/api/')) {
        if (req.method() === 'POST' && url.pathname.endsWith('/decision')) browserDecisions.push({ taskId: url.pathname.split('/incremental-tasks/')[1].split('/')[0], body: req.postDataJSON() });
        if (failNextDecision && req.method() === 'POST' && url.pathname.endsWith('/decision')) {
          failNextDecision = false;
          return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'TEST_UNAVAILABLE', message: '测试审核失败，请重试' } }) });
        }
        if (failNextSave && req.method() === 'PUT' && url.pathname.endsWith('/draft')) {
          failNextSave = false;
          return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'STORAGE_UNAVAILABLE', message: '测试保存失败' } }) });
        }
        if (url.pathname.includes('/production/handbooks/') || url.pathname.includes('/incremental-tasks') || url.pathname.endsWith('/review/bootstrap') || url.pathname.endsWith('/review/repository-context')) {
          const response = await fetch(base + url.pathname + url.search, { method: req.method(), headers: req.headers(), ...(req.postData() ? { body: req.postData() } : {}) });
          const resultText = await response.text();
          return route.fulfill({ status: response.status, contentType: 'application/json', body: resultText });
        }
        let data = {};
        if (url.pathname.endsWith('/auth/session')) data = { ...session, visibleModules: ['*'] };
        else if (url.pathname.endsWith('/outline/governance/list')) data = [outline];
        else if (url.pathname.endsWith('/outline/governance/outline-v1')) data = outline;
        else if (url.pathname.endsWith('/assets/handbooks')) data = { items: [{ handbookId: 'HB-1', name: '隔离手册' }] };
        else if (url.pathname.includes('/gitlab/mappings/')) data = { connectionId: 'fixture', defaultBranch: 'main', enabledBranches: ['main'], zhPaths: ['docs'] };
        else if (url.pathname.endsWith('/access-status')) data = { canRead: true, connected: true };
        else if (url.pathname.endsWith('/branches')) data = { defaultBranch: 'main', branches: [{ name: 'main' }] };
        else if (url.pathname.endsWith('/tree')) data = [{ path: 'docs/page.md', name: 'page.md', type: 'blob' }, { path: 'docs/reference.md', name: 'reference.md', type: 'blob' }];
        else if (url.pathname.endsWith('/file')) data = { path: url.searchParams.get('path') || 'docs/page.md', content: oldContent };
        else if (url.pathname.endsWith('/templates')) data = [];
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
      }
      let relative = url.pathname.replace(/^\/knowledge-center\//, '');
      if (!relative || !path.extname(relative)) relative = 'knowledge-center-management.html';
      let file = path.join(webRoot, relative);
      if (relative.startsWith('common/vendor/vditor/')) file = path.resolve(__dirname, '../../../node_modules/vditor', relative.slice('common/vendor/vditor/'.length));
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      const mime = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream';
      return route.fulfill({ contentType: mime, body: fs.readFileSync(file) });
    });
    await page.goto(`${base}/knowledge-center/production/handbook/HB-1?documentId=doc-initial&branch=main`);
    await page.waitForFunction(() => document.querySelector('[data-handbook-save-status]')?.textContent === '尚未保存为共享草稿');
    assert.equal(await page.locator('[data-handbook-draft-save]').isEnabled(), true);
    assert.equal(await page.locator('[data-handbook-review-current]').isEnabled(), false);
    await openHandbookMore();
    assert.match(await page.locator('[data-handbook-review-hint]').innerText(), /点击“保存”/);
    failNextSave = false;
    await page.locator('[data-handbook-draft-save]').click();
    await page.waitForFunction(() => document.querySelector('[data-handbook-save-status]')?.textContent.includes('已保存 v1'));
    assert.equal(await page.locator('[data-handbook-review-current]').isEnabled(), true);
    failNextSave = true;
    await page.goto(`${base}/knowledge-center/production/handbook/HB-1?documentId=doc-1&branch=main`);
    await page.locator('[data-handbook-review-current]').waitFor({ state: 'attached', timeout: 5000 }).catch(async error => { t.diagnostic(JSON.stringify({ errors, body: await page.locator('body').innerText() })); throw error; });
    await page.locator('[data-handbook-mode="edit"]').click();
    await page.locator('[data-handbook-vditor] .vditor-toolbar[data-scroll-obstacle]').waitFor({ state: 'attached' });
    const editor = page.locator('[data-handbook-vditor] .vditor-wysiwyg [contenteditable="true"]');
    await editor.waitFor(); await editor.click(); await page.keyboard.press('Control+End'); await page.keyboard.type('浏览器实际编辑');
    assert.match(await editor.innerText(), /浏览器实际编辑/);
    const reviewAction = page.locator('[data-handbook-review-current]');
    await openHandbookMore();
    await reviewAction.waitFor();
    await page.waitForFunction(() => document.querySelector('[data-handbook-review-label]')?.textContent === '保存并提交审核').catch(async error => { t.diagnostic(JSON.stringify({ errors, label: await reviewAction.textContent(), status: await page.locator('[data-handbook-save-status]').textContent(), editor: await editor.innerText() })); throw error; });
    assert.equal(await reviewAction.isEnabled(), true);
    assert.equal(await reviewAction.innerText(), '保存并提交审核');
    await openHandbookMore();
    await reviewAction.click();
    await page.waitForFunction(() => document.querySelector('[data-handbook-save-status]')?.textContent.includes('保存失败'));
    assert.equal(await page.locator('[data-handbook-review-dialog]').evaluate(el => el.open), false);
    assert.equal(await reviewAction.isEnabled(), true);
    await openHandbookMore();
    await reviewAction.click();
    await page.waitForFunction(() => document.querySelector('[data-handbook-save-status]')?.textContent.includes('已保存 v3'));
    await page.locator('[data-handbook-review-selection-dialog][open]').waitFor();
    await page.locator('[data-handbook-review-submit]').click();
    await page.locator('[data-handbook-review-dialog][open]').waitFor();
    await page.locator('[data-handbook-reviewer]').selectOption('author');
    await page.locator('[data-handbook-review-path]').fill('docs/page.md');
    const evidenceRoot = path.resolve(__dirname, '../../../runtime/test-results/handbook-incremental-review');
    fs.mkdirSync(evidenceRoot, { recursive: true });
    await page.screenshot({ path: path.join(evidenceRoot, 'review-confirmation.png'), fullPage: true });
    await page.locator('[data-handbook-review-form] button[type="submit"]').click();
    await page.waitForFunction(() => !document.querySelector('[data-handbook-review-dialog]')?.open);
    await openHandbookMore();
    await page.getByRole('link', { name: '查看审核任务', exact: true }).click();
    await page.locator('.review-reader-snapshot').waitFor();
    await page.getByRole('link', { name: /我的审核/ }).click();
    await page.getByRole('link', { name: '开始审核' }).waitFor();
    await page.locator('input[name="q"]').fill('page');
    await page.getByRole('button', { name: '筛选', exact: true }).click();
    await page.getByRole('link', { name: '开始审核' }).click();
    await page.locator('.review-reader-snapshot').waitFor();
    assert.equal(await page.locator('[data-review-document="docs/reference.md"]').count(), 0);
    await page.locator('[data-review-show-all]').check();
    await page.locator('[data-review-document="docs/reference.md"]').click();
    await page.locator('.review-reader-repository').waitFor();
    assert.equal(await page.locator('[data-review-decision]').count(), 0);
    await page.locator('[data-review-document="docs/page.md"]').click();
    await page.locator('.review-reader-snapshot').waitFor();
    assert.match(await page.locator('.review-scope-notice').innerText(), /1 篇文档/);
    await page.screenshot({ path: path.join(evidenceRoot, 'review-workspace.png'), fullPage: true });
    assert.match(await page.locator('.review-reader-snapshot').innerText(), /浏览器实际编辑/);
    assert.doesNotMatch(await page.locator('.review-reader-snapshot').innerText(), /仓库基线/);
    await page.locator('[data-review-step="opinions"]').click();
    const renderedTaskId = new URL(page.url()).searchParams.get('taskId');
    const renderedDigest = service.get(session, renderedTaskId).candidate.digest;
    // Set the rendered digest and dispatch in one DOM turn: a pending render
    // between evaluate() and locator.click() must not replace the test control.
    const staleDecisionIndex = browserDecisions.length;
    await page.locator('[data-review-decision="approve"]').evaluate(el => { el.dataset.candidateDigest = 'stale-browser-page'; el.click(); });
    await page.waitForFunction(() => document.querySelector('#error-message')?.textContent.includes('候选版本已变化')).catch(async error => { t.diagnostic(JSON.stringify({ errors, browserDecisions, taskState: service.get(session, renderedTaskId).state, notice: await page.locator('#error-message').textContent(), body: await page.locator('body').innerText() })); throw error; });
    assert.deepEqual(browserDecisions[staleDecisionIndex], { taskId: renderedTaskId, body: { decision: 'approve', candidateDigest: 'stale-browser-page' } });
    assert.equal(service.get(session, renderedTaskId).state, 'under_review');
    await page.locator('[data-review-decision="approve"]').evaluate((el, digest) => { el.dataset.candidateDigest = digest; }, renderedDigest);
    await page.locator('[data-review-decision="approve"]').click();
    await page.getByRole('link', { name: '返回我的审核' }).click();
    await page.locator('.review-hub-empty').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('q'), 'page');
    await page.getByRole('link', { name: '手册视图', exact: true }).click();
    await page.locator('.review-count-link').click();
    await page.locator('.review-hub-table').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('view'), 'documents');
    assert.equal(await page.getByRole('link', { name: '查看文档', exact: true }).count(), 2);
    await page.screenshot({ path: path.join(evidenceRoot, 'review-document-list.png'), fullPage: true });
    await page.getByRole('link', { name: '查看文档', exact: true }).first().click();
    await page.locator('[data-review-step="opinions"]').click();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-review-publish]').click();
    await page.getByRole('link', { name: /查看 GitLab MR/ }).waitFor();
    await page.screenshot({ path: path.join(evidenceRoot, 'mr-submitted.png'), fullPage: true });
    const frozen = (submissionId, docs) => service.createHandbookReview(session, submissionId, {
      submissionId, name: submissionId, handbookId: 'HB-1', branch: 'main', commitSha: 'base-sha',
      content: docs.map(item => item.markdown).join('\n\n'), baselineContent: oldContent,
      documents: docs, operations: docs.map(item => ({ type: 'update', documentId: item.documentId, nodeId: item.documentId, beforeDigest: hash(oldContent), after: { content: item.markdown } })),
    });
    const shared = frozen('共享候选验证', [
      { documentId: 'shared-a', filePath: 'docs/shared-a.md', markdown: '# 冻结甲正文', draftRevisionId: 'revision-a', reviewerIds: ['author'] },
      { documentId: 'shared-b', filePath: 'docs/shared-b.md', markdown: '# 冻结乙正文', draftRevisionId: 'revision-b', reviewerIds: ['author', 'other'] },
    ]);
    const following = frozen('下一篇验证', [{ documentId: 'following', filePath: 'docs/following.md', markdown: '# 下一篇正文', reviewerIds: ['author'] }]);
    const mineBefore = await call('GET', '/review/bootstrap?view=mine');
    assert.equal(mineBefore.data.workbench.mine.length, 3);
    assert.equal((await call('GET', '/review/bootstrap?view=mine', null, { 'x-user': 'other' })).data.workbench.mine.length, 1);
    await page.goto(`${base}/knowledge-center/review?view=mine&q=shared`);
    await page.getByRole('link', { name: '开始审核' }).first().waitFor();
    await page.locator(`a[href*="taskId=${shared.id}"][href*="documentId=shared-a"]`).click();
    await page.locator('.review-reader-snapshot').waitFor();
    assert.match(await page.locator('.review-reader-snapshot').innerText(), /冻结甲正文/);
    assert.doesNotMatch(await page.locator('.review-reader-snapshot').innerText(), /冻结乙正文/);
    await page.locator('[data-review-document="docs/shared-b.md"]').click();
    await page.waitForFunction(() => document.querySelector('.review-reader-snapshot')?.textContent.includes('冻结乙正文'));
    assert.doesNotMatch(await page.locator('.review-reader-snapshot').innerText(), /冻结甲正文/);
    assert.match(await page.locator('.review-scope-notice').innerText(), /2 篇文档/);
    assert.equal(await page.getByRole('link', { name: '下一篇待我审核' }).count(), 1);
    await page.locator('[data-review-step="opinions"]').click();
    failNextDecision = true;
    await page.locator('[data-review-decision="approve"]').click();
    await page.waitForFunction(() => document.querySelector('#error-message')?.textContent.includes('测试审核失败'));
    assert.equal((await call('GET', '/review/bootstrap?view=mine')).data.workbench.mine.length, 3);
    await page.locator('[data-review-decision="approve"]').click();
    await page.locator('[data-review-publish]').waitFor();
    assert.equal((await call('GET', '/review/bootstrap?view=mine')).data.workbench.mine.length, 1);
    assert.equal((await call('GET', '/review/bootstrap?view=mine', null, { 'x-user': 'other' })).data.workbench.mine.length, 0);
    assert.equal((await call('GET', `/review/bootstrap?view=reader&taskId=${shared.id}`, null, { 'x-user': 'other' })).status, 200);
    await page.getByRole('link', { name: '下一篇待我审核' }).click();
    await page.locator('.review-reader-snapshot').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('taskId'), following.id);
    assert.match(await page.locator('.review-reader-snapshot').innerText(), /下一篇正文/);
    await page.getByRole('link', { name: '返回我的审核' }).click();
    await page.locator('.review-hub-empty').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('q'), 'shared');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('link', { name: '清空', exact: true }).click();
    await page.getByRole('link', { name: '开始审核' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: path.join(evidenceRoot, 'my-reviews-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 812, height: 375 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.goto(`${base}/knowledge-center/review?view=reader&handbookId=HB-1`);
    await page.locator('[data-review-online-start]').click();
    await page.locator('[data-review-online-dialog][open]').waitFor();
    await page.locator('[data-review-online-draft][data-document-id="doc-1"]').check();
    await page.locator('[data-review-online-path="doc-1"]').fill('docs/page.md');
    await page.locator('[data-review-online-reviewer]').selectOption('author');
    assert.match(await page.locator('[data-review-online-dialog]').innerText(), /已保存 v/);
    await page.locator('[data-review-online-form] button[type="submit"]').click();
    await page.locator('.review-workbench-detail').waitFor();
    const browserOnlineId = new URL(page.url()).searchParams.get('taskId');
    assert.equal(service.get(session, browserOnlineId).reviewMode, 'online_review');
    const productionReturn = new URL(await page.locator('.review-production-return').getAttribute('href'), base);
    assert.equal(productionReturn.pathname, '/knowledge-center/production/handbook/HB-1');
    assert.equal(productionReturn.searchParams.get('reviewPath'), 'docs/page.md');
    assert.equal(productionReturn.searchParams.get('branch'), 'main');
    assert.match(await page.locator('.review-reader-snapshot').innerText(), /浏览器实际编辑/);
    await page.locator('[data-review-decision="approve"]').click();
    await page.locator('[data-review-publish]').waitFor();
    const commitsBeforeOnlineRetry = commits;
    failMr = true;
    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-review-publish]').click();
    await page.waitForFunction(() => document.querySelector('.review-action-card .incremental-form-status')?.textContent.includes('重试创建 MR'));
    assert.equal(service.get(session, browserOnlineId).state, 'approved');
    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-review-publish]').click();
    await page.getByRole('link', { name: /查看 GitLab MR/ }).waitFor();
    assert.equal(service.get(session, browserOnlineId).state, 'mr_submitted');
    assert.equal(commits, commitsBeforeOnlineRetry + 1);
    assert.equal(mrs.filter(item => item.source_branch === `knowledge-review/${browserOnlineId}`).length, 1);
    const rejectedBrowserTask = frozen('退回摘要验证', [{ documentId: 'reject-doc', filePath: 'docs/reject.md', markdown: '# 待修订正文', reviewerIds: ['author'] }]);
    await page.goto(`${base}/knowledge-center/review?view=reader&taskId=${rejectedBrowserTask.id}&handbookId=HB-1&documentId=reject-doc`);
    await page.locator('[data-review-decision-form]').waitFor({ state: 'attached' });
    await page.locator('.review-return summary').click();
    await page.locator('[data-review-decision-form] textarea').fill('补齐必要说明');
    await page.locator('[data-review-decision-form] button[type="submit"]').click();
    await page.waitForFunction(() => !document.querySelector('[data-review-decision-form]'));
    assert.equal(service.get(session, rejectedBrowserTask.id).state, 'rejected');
    assert.equal(service.get(session, rejectedBrowserTask.id).reviews[0].decision.comment, '补齐必要说明');
    assert.ok(browserDecisions.some(request => request.body.decision === 'reject'));
    assert.equal(browserDecisions.filter(request => request.body.candidateDigest === 'stale-browser-page').length, 1);
    for (const request of browserDecisions.filter(request => request.body.candidateDigest !== 'stale-browser-page')) assert.equal(request.body.candidateDigest, service.get(session, request.taskId).candidate.digest);
    const equalBrowserContext = { ...context, documentId: 'doc-equal-browser' };
    const equalBrowserSaved = await call('PUT', '/production/handbooks/HB-1/documents/doc-equal-browser/draft', { ...equalBrowserContext, editVersion: 0, baselineDigest: hash(oldContent), markdown: oldContent, htmlSnapshot: '', attachmentIds: [] });
    const equalBrowserCreated = await call('POST', submitPath, { reviewMode: 'online_review', scope: 'document', defaultReviewerIds: ['author'], documents: [{ ...equalBrowserContext, draftRevisionId: equalBrowserSaved.data.draft.currentRevisionId, filePath: 'docs/equal-browser.md' }] });
    assert.equal(equalBrowserCreated.status, 422, JSON.stringify(equalBrowserCreated));
    assert.equal(equalBrowserCreated.error.code, 'GITLAB_NO_CHANGES');
    const driftBrowserContext = { ...context, documentId: 'doc-drift-browser' };
    const driftBrowserSaved = await call('PUT', '/production/handbooks/HB-1/documents/doc-drift-browser/draft', { ...driftBrowserContext, editVersion: 0, baselineDigest: hash(oldContent), markdown: '# 漂移时的修改稿', htmlSnapshot: '', attachmentIds: [] });
    const driftBrowserCreated = await call('POST', submitPath, { reviewMode: 'online_review', scope: 'document', defaultReviewerIds: ['author'], documents: [{ ...driftBrowserContext, draftRevisionId: driftBrowserSaved.data.draft.currentRevisionId, filePath: 'docs/drift-browser.md' }] });
    assert.equal(driftBrowserCreated.status, 201, JSON.stringify(driftBrowserCreated));
    const driftBrowserTask = driftBrowserCreated.data.tasks[0];
    assert.equal((await call('POST', `/incremental-tasks/${driftBrowserTask.id}/reviews/${driftBrowserTask.reviews[0].id}/decision`, { decision: 'approve' })).status, 200);
    branchSha = 'changed-sha';
    await page.goto(`${base}/knowledge-center/review?view=reader&handbookId=HB-1&taskId=${driftBrowserTask.id}`);
    await page.locator('[data-review-publish]').waitFor();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-review-publish]').click();
    await page.waitForFunction(() => document.querySelector('.review-action-card .incremental-form-status')?.textContent.includes('目标分支已变化'));
    assert.equal(service.get(session, driftBrowserTask.id).state, 'approved');
    branchSha = 'base-sha';
    assert.deepEqual(errors, []);
  }
  const splitContext = { ...context, documentId: 'doc-split' };
  const splitSaved = await call('PUT', '/production/handbooks/HB-1/documents/doc-split/draft', { ...splitContext, editVersion: 0, baselineDigest: hash(oldContent), markdown: '# 拆分验证正文', htmlSnapshot: '', attachmentIds: [] });
  assert.equal(splitSaved.status, 200, JSON.stringify(splitSaved));
  const splitBaseInput = { defaultReviewerIds: ['author'], documents: [{ ...splitContext, filePath: 'docs/split.md', draftRevisionId: splitSaved.data.draft.currentRevisionId }] };
  const splitBase = await call('POST', submitPath, splitBaseInput);
  assert.equal(splitBase.status, 201, JSON.stringify(splitBase));
  const splitParent = splitBase.data.tasks[0];
  assert.equal(splitParent.businessVersion, '版本待核对');
  assert.equal(splitParent.handbookSource.branch, 'main');
  const splitInput = { ...splitBaseInput, splitReason: '本次需要单独验证数据库版本差异，保留同源历史关联。' };
  const split = await call('POST', submitPath, splitInput);
  assert.equal(split.status, 201, JSON.stringify(split));
  const splitTask = split.data.tasks[0];
  assert.notEqual(splitTask.id, splitParent.id);
  assert.equal(splitTask.handbookSource.sourceSubmissionId, splitParent.handbookSource.sourceSubmissionId);
  assert.equal(splitTask.handbookSource.splitFromTaskId, splitParent.id);
  assert.equal(splitTask.handbookSource.splitReason, splitInput.splitReason);
  const splitRepeat = await call('POST', submitPath, splitInput);
  assert.equal(splitRepeat.data.tasks[0].id, splitTask.id);
  const tooLongSplit = await call('POST', submitPath, { ...splitBaseInput, splitReason: 'x'.repeat(501) });
  assert.equal(tooLongSplit.status, 422);
  assert.equal(tooLongSplit.error.code, 'SPLIT_REASON_TOO_LONG');
  const versionA = await call('POST', submitPath, { ...splitBaseInput, businessVersion: '23.4' });
  const versionB = await call('POST', submitPath, { ...splitBaseInput, businessVersion: '24.1' });
  assert.equal(versionA.status, 201, JSON.stringify(versionA));
  assert.equal(versionB.status, 201, JSON.stringify(versionB));
  assert.notEqual(versionA.data.tasks[0].id, versionB.data.tasks[0].id);
  assert.equal(versionA.data.tasks[0].businessVersion, '23.4');
  assert.equal(versionB.data.tasks[0].businessVersion, '24.1');
  assert.notEqual(versionA.data.tasks[0].handbookSource.sourceSubmissionId, versionB.data.tasks[0].handbookSource.sourceSubmissionId);
  const versionARepeat = await call('POST', submitPath, { ...splitBaseInput, businessVersion: '23.4' });
  assert.equal(versionARepeat.data.tasks[0].id, versionA.data.tasks[0].id);
  const onlineContext = { ...context, documentId: 'doc-online' };
  const onlineSaved = await call('PUT', '/production/handbooks/HB-1/documents/doc-online/draft', { ...onlineContext, editVersion: 0, baselineDigest: hash(oldContent), markdown: '# 在线修改正文', htmlSnapshot: '', attachmentIds: [] });
  assert.equal(onlineSaved.status, 200, JSON.stringify(onlineSaved));
  const listedDrafts = await call('GET', '/production/handbooks/HB-1/review-drafts');
  assert.ok(listedDrafts.data.items.some(item => item.documentId === 'doc-online' && item.draftRevisionId === onlineSaved.data.draft.currentRevisionId));
  const onlineInput = { reviewMode: 'online_review', scope: 'document', defaultReviewerIds: ['author'], documents: [{ ...onlineContext, draftRevisionId: onlineSaved.data.draft.currentRevisionId, filePath: 'docs/reference.md' }] };
  const onlineCreated = await call('POST', submitPath, onlineInput);
  assert.equal(onlineCreated.status, 201, JSON.stringify(onlineCreated));
  const online = onlineCreated.data.tasks[0];
  assert.equal(online.reviewMode, 'online_review');
  assert.equal(online.candidate.content, onlineSaved.data.draft.revision.markdown);
  assert.equal(online.handbookSource.commitSha, 'base-sha');
  assert.equal(online.handbookSource.repositoryIdentity.project, 'group/docs');
  assert.equal(online.handbookSource.documents[0].filePath, 'docs/reference.md');
  assert.equal((await call('POST', `/incremental-tasks/${online.id}/reviews/${online.reviews[0].id}/decision`, { decision: 'approve' })).status, 200);
  const onlinePublished = await call('POST', `/incremental-tasks/${online.id}/publish`, { expectedCandidateDigest: online.candidate.digest });
  assert.equal(onlinePublished.status, 200, JSON.stringify(onlinePublished));
  assert.ok(onlinePublished.data.iid >= 2);
  assert.equal(onlinePublished.data.sourceBranch, `knowledge-review/${online.id}`);
  assert.equal(onlinePublished.data.targetBranch, 'main');
  const mrChanges = await (await fetch(`${upstream}/api/v4/projects/group%2Fdocs/merge_requests/${onlinePublished.data.iid}/changes`)).json();
  assert.equal(mrChanges.changes[0].new_path, 'docs/reference.md');
  assert.equal(mrChanges.changes[0].diff, online.candidate.content);
  assert.equal(service.get(session, online.id).state, 'mr_submitted');
  assert.deepEqual(service.get(session, online.id).completion, {
    status: 'pending', label: '待合并回读', completedAt: null,
    criteria: ['gitlab_merged', 'target_branch_markdown_readback', 'repository_relative_images_readback'],
    facts: { mergeState: 'opened', markdownReadback: false, resourceReadback: false },
  });
  // Simulate the human merge: GitLab removes the task branch and advances the
  // target branch. The next publish call must refresh, not replay old creds.
  const onlineSourceBranch = `knowledge-review/${online.id}`;
  branches.main.content = online.candidate.content;
  branchSha = 'merged-online-sha';
  mrs.find(item => item.source_branch === onlineSourceBranch).state = 'merged';
  delete branches[onlineSourceBranch];
  const refreshedOnline = await call('POST', `/incremental-tasks/${online.id}/publish`, { expectedCandidateDigest: online.candidate.digest });
  assert.equal(refreshedOnline.status, 200, JSON.stringify(refreshedOnline));
  const refreshedTask = service.get(session, online.id);
  assert.equal(refreshedTask.deliveryObservation.state, 'merged');
  assert.equal(refreshedTask.deliveryObservation.readback.status, 'consistent');
  assert.equal(refreshedTask.completion.status, 'completed');
  assert.equal(refreshedTask.completion.facts.resourceReadback, true);
  assert.equal(refreshedTask.externalEvidence.some(item => item.type === 'gitlab_merge_readback'), true);
  assert.equal(refreshedTask.externalEvidence.some(item => item.type === 'gitlab_merge_resource_readback'), true);
  repository.transaction(state => {
    const legacy = state.tasks.find(item => item.id === online.id);
    legacy.externalEvidence = legacy.externalEvidence.filter(item => item.type !== 'gitlab_merge_resource_readback');
  });
  const refreshedLegacy = await call('POST', `/incremental-tasks/${online.id}/publish`, { expectedCandidateDigest: online.candidate.digest });
  assert.equal(refreshedLegacy.status, 200, JSON.stringify(refreshedLegacy));
  const legacyEvidence = service.get(session, online.id).externalEvidence;
  for (const type of ['gitlab_merge_readback', 'gitlab_merge_resource_readback']) assert.equal(legacyEvidence.filter(item => item.type === type).length, 1);
  branches.main.content = oldContent;
  branchSha = 'base-sha';

  const equalContext = { ...context, documentId: 'doc-equal' };
  const equalSaved = await call('PUT', '/production/handbooks/HB-1/documents/doc-equal/draft', { ...equalContext, editVersion: 0, baselineDigest: hash(oldContent), markdown: oldContent, htmlSnapshot: '', attachmentIds: [] });
  assert.equal(equalSaved.status, 200, JSON.stringify(equalSaved));
  const equalCreated = await call('POST', submitPath, { reviewMode: 'online_review', scope: 'document', defaultReviewerIds: ['author'], documents: [{ ...equalContext, draftRevisionId: equalSaved.data.draft.currentRevisionId, filePath: 'docs/equal.md' }] });
  const beforeNoChange = { commits, mrs: mrs.length };
  assert.equal(equalCreated.status, 422, JSON.stringify(equalCreated));
  assert.equal(equalCreated.error.code, 'GITLAB_NO_CHANGES');
  assert.equal(commits, beforeNoChange.commits); assert.equal(mrs.length, beforeNoChange.mrs);

  const driftContext = { ...context, documentId: 'doc-drift' };
  const driftSaved = await call('PUT', '/production/handbooks/HB-1/documents/doc-drift/draft', { ...driftContext, editVersion: 0, baselineDigest: hash(oldContent), markdown: '# 漂移候选', htmlSnapshot: '', attachmentIds: [] });
  const driftCreated = await call('POST', submitPath, { reviewMode: 'online_review', scope: 'document', defaultReviewerIds: ['author'], documents: [{ ...driftContext, draftRevisionId: driftSaved.data.draft.currentRevisionId, filePath: 'docs/drift.md' }] });
  assert.equal(driftCreated.status, 201, JSON.stringify(driftCreated));
  const driftTask = driftCreated.data.tasks[0];
  assert.equal((await call('POST', `/incremental-tasks/${driftTask.id}/reviews/${driftTask.reviews[0].id}/decision`, { decision: 'approve' })).status, 200);
  branchSha = 'changed-sha';
  const driftPublish = await call('POST', `/incremental-tasks/${driftTask.id}/publish`, { expectedCandidateDigest: driftTask.candidate.digest });
  assert.equal(driftPublish.status, 409, JSON.stringify(driftPublish));
  assert.equal(driftPublish.error.code, 'GITLAB_BASELINE_CHANGED');
  assert.equal(service.get(session, driftTask.id).state, 'approved');
  await assert.rejects(() => submitDocumentMergeRequest(connection, { ...task.handbookSource, taskId: 'another', title: 'test', candidateDigest: task.candidate.digest }), error => error.code === 'GITLAB_BASELINE_CHANGED');
  branches[`knowledge-review/${task.id}`].content = '篡改内容';
  await assert.rejects(() => submitDocumentMergeRequest(connection, { ...task.handbookSource, taskId: task.id, candidateDigest: task.candidate.digest }), error => error.code === 'GITLAB_SOURCE_CHANGED');

  branchSha = 'base-sha';
  const imageBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 255]);
  resourceFiles.set('docs/images/示例.png', imageBytes);
  resourceFiles.set('docs/images/vector.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><text>图</text></svg>'));
  async function submitResourceDraft(id, text) {
    const draftContext = { ...context, documentId: id };
    const result = await call('PUT', `/production/handbooks/HB-1/documents/${id}/draft`, { ...draftContext, editVersion: 0, baselineDigest: hash(oldContent), markdown: text, htmlSnapshot: '', attachmentIds: [] });
    assert.equal(result.status, 200, JSON.stringify(result));
    return call('POST', submitPath, { defaultReviewerIds: ['author'], documents: [{ ...draftContext, filePath: `docs/${id}.md`, draftRevisionId: result.data.draft.currentRevisionId, markdown: '# 客户端伪造正文', resources: [{ path: 'outside/forged.png', contentDigest: 'forged' }] }] });
  }
  const resourceText = '- ![位图][image]\n\n[image]: images/%E7%A4%BA%E4%BE%8B.png\n\n<div><img src="images/vector.svg" alt="矢量"></div>\n';
  const frozenResources = await submitResourceDraft('resource-valid', resourceText);
  assert.equal(frozenResources.status, 201, JSON.stringify(frozenResources));
  const frozenDocument = service.get(session, frozenResources.data.tasks[0].id).handbookSource.documents[0];
  assert.equal(frozenDocument.markdown, resourceText);
  assert.deepEqual(frozenDocument.resources.map(({ path, size, contentDigest }) => ({ path, size, contentDigest })), [...resourceFiles].map(([path, bytes]) => ({ path, size: bytes.length, contentDigest: hash(bytes) })));
  assert.equal(resourceReads.every(item => item.ref === 'base-sha'), true);
  const beforeInvalidResources = repository.read();
  const readsBeforeForbidden = resourceReads.length;
  const forbiddenResource = await submitResourceDraft('resource-forbidden', '![越界](../private/secret.png)');
  assert.equal(forbiddenResource.status, 403, JSON.stringify(forbiddenResource));
  assert.equal(forbiddenResource.error.code, 'GITLAB_PATH_FORBIDDEN');
  assert.equal(resourceReads.length, readsBeforeForbidden);
  assert.deepEqual(repository.read(), beforeInvalidResources);
  const missingResource = await submitResourceDraft('resource-missing', '![缺失](images/missing.png)');
  assert.equal(missingResource.status, 409, JSON.stringify(missingResource));
  assert.equal(missingResource.error.code, 'GITLAB_RESOURCE_READBACK_FAILED');
  assert.deepEqual(repository.read(), beforeInvalidResources);
  for (const [id, content] of [
    ['external-markdown', '![外链](https://example.test/image.png?token=private)'],
    ['external-html', '<img src="https://example.test/image.png?token=private">'],
    ['platform-html', '<img src="/knowledge-center/api/production/handbooks/HB-1/documents/doc/source-images/asset">'],
    ['responsive-html', '<img src="images/vector.svg" srcset="images/missing.png 2x">'],
  ]) {
    const rejected = await submitResourceDraft(id, content);
    assert.equal(rejected.status, 422, JSON.stringify(rejected));
    assert.equal(rejected.error.code, 'GITLAB_RESOURCE_DELIVERY_UNSUPPORTED');
    assert.equal(JSON.stringify(rejected).includes('token=private'), false);
    assert.deepEqual(repository.read(), beforeInvalidResources);
  }
  const htmlForbidden = await submitResourceDraft('html-forbidden', '<img src="../private/secret.png">');
  assert.equal(htmlForbidden.status, 403, JSON.stringify(htmlForbidden));
  assert.equal(htmlForbidden.error.code, 'GITLAB_PATH_FORBIDDEN');
  assert.deepEqual(repository.read(), beforeInvalidResources);
});


test('真实 HTTP：已合并 MR 删除源分支后按目标提交回读，异常不误判恢复成功', async t => {
  const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const documents = [
    { filePath: 'docs/one.md', markdown: '# 第一篇\n\n<div><img src="images/a.png" alt="图"></div>\n', resources: [{ path: 'docs/images/a.png', size: image.length, contentDigest: hash(image) }] },
    { filePath: 'docs/two.md', markdown: '# 第二篇\n' },
  ];
  const input = { taskId: 'merged-task', branch: 'main', candidateDigest: 'reviewed-digest', documents };
  const mr = { iid: 17, web_url: 'http://gitlab.test/mr/17', description: '审核候选：reviewed-digest', source_branch: 'knowledge-review/merged-task', target_branch: 'main', state: 'merged' };
  let targetSha = 'merged-sha';
  let branchReads = 0;
  let driftAfterRead = false;
  let files = { ...Object.fromEntries(documents.map(document => [document.filePath, document.markdown])), 'docs/images/a.png': image };
  let sourceFiles = null;
  const requests = [];
  const upstream = await listen(t, (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const endpoint = url.pathname.replace(/^\/api\/v4\/projects\/[^/]+/, '');
    requests.push({ method: req.method, endpoint, ref: url.searchParams.get('ref') });
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (endpoint === '/merge_requests') return send(200, [mr]);
    if (/^\/merge_requests\/\d+$/.test(endpoint)) return send(200, mr);
    if (endpoint === '/repository/branches/main') {
      branchReads += 1;
      return send(200, { commit: { id: driftAfterRead && branchReads > 1 ? 'later-sha' : targetSha } });
    }
    if (endpoint.startsWith('/repository/files/')) {
      const selected = url.searchParams.get('ref') === targetSha ? files : url.searchParams.get('ref') === mr.source_branch ? sourceFiles : null;
      if (!selected) return send(404, {});
      const filePath = decodeURIComponent(endpoint.slice('/repository/files/'.length));
      return selected[filePath] === undefined ? send(404, {}) : send(200, { encoding: 'base64', content: Buffer.from(selected[filePath]).toString('base64') });
    }
    return send(404, {});
  });
  const connection = { host: upstream, project: 'group/docs', purpose: 'read_write', status: 'active' };
  const recover = (candidate = input) => submitDocumentMergeRequest(connection, candidate, { accessToken: 'local-fixture' });
  const refresh = () => require('../../../packages/agent-runner-core/lib/gitlab-connector').readMergeRequestDelivery(connection, { branch: 'main', documents, mergeRequest: { iid: 17, sourceBranch: mr.source_branch, targetBranch: mr.target_branch, webUrl: mr.web_url } }, { accessToken: 'local-fixture' });
  assert.deepEqual(await recover(), { iid: 17, webUrl: mr.web_url, state: 'merged', sourceBranch: mr.source_branch, targetBranch: 'main' });
  assert.deepEqual(requests.filter(item => item.endpoint.startsWith('/repository/files/')).map(item => item.ref), ['merged-sha', 'merged-sha', 'merged-sha']);
  assert.equal(requests.some(item => item.method !== 'GET'), false);
  const htmlReadback = (await refresh()).readback;
  assert.equal(htmlReadback.resources, 'repository_relative_images_verified');
  assert.equal(htmlReadback.scope, 'markdown_html_repository_relative_images');
  const reviewedMarkdown = documents[0].markdown;
  documents[0].markdown = '<img src="https://example.test/legacy.png">';
  files['docs/one.md'] = documents[0].markdown;
  await assert.rejects(() => recover(), error => error.code === 'GITLAB_RESOURCE_DELIVERY_UNSUPPORTED');
  await assert.rejects(() => refresh(), error => error.code === 'GITLAB_RESOURCE_DELIVERY_UNSUPPORTED');
  documents[0].markdown = reviewedMarkdown;
  files['docs/one.md'] = reviewedMarkdown;
  const frozenManifest = documents[0].resources;
  delete documents[0].resources;
  await assert.rejects(() => refresh(), error => error.code === 'GITLAB_RESOURCE_READBACK_FAILED');
  documents[0].resources = frozenManifest;
  files['docs/images/a.png'] = Buffer.from('changed image');
  await assert.rejects(() => recover(), error => error.code === 'GITLAB_RESOURCE_READBACK_FAILED');
  await assert.rejects(() => refresh(), error => error.code === 'GITLAB_RESOURCE_READBACK_FAILED');
  delete files['docs/images/a.png'];
  await assert.rejects(() => refresh(), error => error.code === 'GITLAB_RESOURCE_READBACK_FAILED');
  files['docs/images/a.png'] = image;
  await assert.rejects(() => recover({ ...input, candidateDigest: 'other' }), error => error.code === 'GITLAB_MR_CANDIDATE_CONFLICT');
  files['docs/two.md'] = '# 被修改\n';
  await assert.rejects(() => recover(), error => error.code === 'GITLAB_SOURCE_CHANGED');
  delete files['docs/two.md'];
  await assert.rejects(() => recover(), error => error.code === 'GITLAB_SOURCE_CHANGED');
  files = { ...Object.fromEntries(documents.map(document => [document.filePath, document.markdown])), 'docs/images/a.png': image };
  branchReads = 0; driftAfterRead = true;
  await assert.rejects(() => recover(), error => error.code === 'GITLAB_BASELINE_CHANGED');
  branchReads = 0;
  await assert.rejects(() => refresh(), error => error.code === 'GITLAB_BASELINE_CHANGED');
  driftAfterRead = false;
  mr.state = 'closed';
  await assert.rejects(() => recover(), error => error.code === 'GITLAB_MR_CLOSED');
  mr.state = 'opened';
  sourceFiles = { ...files };
  assert.equal((await recover()).state, 'opened');
  sourceFiles['docs/images/a.png'] = Buffer.from('changed on task branch');
  await assert.rejects(() => recover(), error => error.code === 'GITLAB_RESOURCE_READBACK_FAILED');
  sourceFiles = null;
  await assert.rejects(() => recover(), error => error.code === 'GITLAB_NOT_FOUND');
  assert.equal(requests.some(item => item.method !== 'GET'), false);
});

test('Markdown 图片提取覆盖嵌套与引用式语法，拒绝越界和不支持的仓库资源', () => {
  assert.deepEqual(extractMarkdownResources('- ![图][asset]\n\n[asset]: ../images/a%20b.png\n\n`![忽略](no.png)`', 'docs/chapter/page.md').map(item => item.path), ['docs/images/a b.png']);
  assert.throws(() => extractMarkdownResources('![越界](../../escape.png)', 'docs/page.md'), error => error.code === 'GITLAB_RESOURCE_PATH_INVALID');
  assert.throws(() => extractMarkdownResources('![未知](file.pdf)', 'docs/page.md'), error => error.code === 'GITLAB_RESOURCE_TYPE_NOT_ALLOWED');
  assert.deepEqual(extractMarkdownResources('<figure><img src="images/a&#32;b.png" alt="示意图"></figure>', 'docs/page.md'), [{ path: 'docs/images/a b.png', alt: '示意图' }]);
  assert.deepEqual(extractMarkdownResources('`<img src="external.png">`\n\n```html\n<img src="https://example.test/a.png">\n```', 'docs/page.md'), []);
  for (const content of ['<img data-src="a.png">', '<picture><source srcset="a.png 1x"><img src="b.png"></picture>', '![内联](data:image/png;base64,abcd)', '![站点](//example.test/a.png)', '![平台](/source/a.png)']) {
    assert.throws(() => extractMarkdownResources(content, 'docs/page.md'), error => error.code === 'GITLAB_RESOURCE_DELIVERY_UNSUPPORTED');
  }
});

test('送审入口区分无草稿、未保存、权限、服务错误和保存中状态', async () => {
  const { canSaveHandbookDraft, handbookReviewAction } = await import('../../../apps/knowledge-center-web/frontend/knowledge-center/modules/production/handbook-view.js');
  const ui = { draftLoadState: { doc: 'ready' }, serverDrafts: { doc: { exists: false, capabilities: { canEdit: true, canSubmitReview: true } } }, dirtyDocuments: [] };
  assert.equal(handbookReviewAction('doc', ui).disabled, true);
  assert.match(handbookReviewAction('doc', ui).reason, /尚未保存为共享草稿/);
  assert.equal(canSaveHandbookDraft('doc', ui), true);
  ui.dirtyDocuments = ['doc'];
  assert.equal(handbookReviewAction('doc', ui).disabled, false);
  assert.equal(handbookReviewAction('doc', ui).label, '保存并发起评审');
  ui.draftSaveState = { doc: { status: 'saving' } };
  assert.equal(handbookReviewAction('doc', ui).disabled, true);
  assert.equal(canSaveHandbookDraft('doc', ui), false);
  ui.draftSaveState = {};
  ui.serverDrafts.doc.exists = true; ui.dirtyDocuments = [];
  assert.equal(handbookReviewAction('doc', ui).disabled, false);
  assert.equal(canSaveHandbookDraft('doc', ui), false);
  ui.serverDrafts.doc.capabilities.canSubmitReview = false;
  assert.match(handbookReviewAction('doc', ui).reason, /权限/);
  ui.serverDrafts.doc.capabilities.canSubmitReview = true; ui.draftLoadState.doc = 'failed';
  assert.match(handbookReviewAction('doc', ui).reason, /读取失败/);
});
