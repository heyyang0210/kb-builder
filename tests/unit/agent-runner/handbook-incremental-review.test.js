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
const { submitDocumentMergeRequest } = require('../../../packages/agent-runner-core/lib/gitlab-connector');

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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'handbook-mr-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let branchSha = 'base-sha'; let commits = 0; let failMr = true;
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
      const ref = url.searchParams.get('ref'); const file = branches[ref] || (ref === 'base-sha' ? branches.main : null);
      return file ? send(200, { encoding: 'base64', content: Buffer.from(file.content).toString('base64'), commit_id: 'file-sha' }) : send(404, {});
    }
    if (endpoint === '/repository/commits') { commits++; branches[body.branch].content = body.actions[0].content; committedActions.set(body.branch, body.actions); return send(201, { id: 'commit-sha' }); }
    if (/^\/merge_requests\/\d+\/changes$/.test(endpoint)) {
      const mr = mrs.find(item => String(item.iid) === endpoint.split('/')[2]);
      return mr ? send(200, { ...mr, changes: (committedActions.get(mr.source_branch) || []).map(item => ({ old_path: item.file_path, new_path: item.file_path, diff: item.content })) }) : send(404, {});
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
  assert.equal((await call('POST', `${taskPath}/reviews/${task.reviews[0].id}/decision`, { decision: 'approve' })).status, 200);
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
    const webRoot = path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center');
    const outline = { id: 'outline-v1', handbookId: 'HB-1', name: '隔离手册', status: 'published', nodes: [{ id: 'doc-1', kind: 'document', title: 'page.md', filePath: 'docs/page.md' }, { id: 'doc-initial', kind: 'document', title: 'page.md', filePath: 'docs/page.md' }] };
    let failNextSave = true;
    let failNextDecision = false;
    await page.route('**/*', async route => {
      const req = route.request(); const url = new URL(req.url());
      if (url.pathname.startsWith('/knowledge-center/api/')) {
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
    assert.match(await page.locator('[data-handbook-review-hint]').innerText(), /点击“保存”/);
    failNextSave = false;
    await page.locator('[data-handbook-draft-save]').click();
    await page.waitForFunction(() => document.querySelector('[data-handbook-save-status]')?.textContent.includes('已保存 v1'));
    assert.equal(await page.locator('[data-handbook-review-current]').isEnabled(), true);
    failNextSave = true;
    await page.goto(`${base}/knowledge-center/production/handbook/HB-1?documentId=doc-1&branch=main`);
    await page.locator('[data-handbook-review-current]').waitFor({ timeout: 5000 }).catch(async error => { t.diagnostic(JSON.stringify({ errors, body: await page.locator('body').innerText() })); throw error; });
    await page.locator('[data-handbook-mode="edit"]').click();
    const editor = page.locator('[data-handbook-vditor] .vditor-wysiwyg');
    await editor.waitFor(); await editor.click(); await page.keyboard.press('Control+End'); await page.keyboard.type('浏览器实际编辑');
    const reviewAction = page.locator('[data-handbook-review-current]');
    await reviewAction.waitFor();
    await page.waitForFunction(() => document.querySelector('[data-handbook-review-current]')?.textContent === '保存并发起评审');
    assert.equal(await reviewAction.isEnabled(), true);
    assert.equal(await reviewAction.innerText(), '保存并发起评审');
    await reviewAction.click();
    await page.waitForFunction(() => document.querySelector('[data-handbook-save-status]')?.textContent.includes('保存失败'));
    assert.equal(await page.locator('[data-handbook-review-dialog]').evaluate(el => el.open), false);
    assert.equal(await reviewAction.isEnabled(), true);
    await reviewAction.click();
    await page.waitForFunction(() => document.querySelector('[data-handbook-save-status]')?.textContent.includes('已保存 v3'));
    await page.locator('[data-handbook-review-dialog][open]').waitFor();
    await page.locator('[data-handbook-reviewer]').selectOption('author');
    await page.locator('[data-handbook-review-path]').fill('docs/page.md');
    const evidenceRoot = path.resolve(__dirname, '../../../runtime/test-results/handbook-incremental-review');
    fs.mkdirSync(evidenceRoot, { recursive: true });
    await page.screenshot({ path: path.join(evidenceRoot, 'review-confirmation.png'), fullPage: true });
    await page.locator('[data-handbook-review-form] button[type="submit"]').click();
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
    assert.match(await page.locator('.review-production-return').getAttribute('href'), /\/production\/handbook\/HB-1\?documentId=doc-1&branch=main/);
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
