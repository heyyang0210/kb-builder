const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const { MemoryIncrementalBuildRepository, IncrementalBuildService, createIncrementalBuildHandler } = require('../../../packages/agent-runner-core/lib/incremental-build-service');

// Isolated real HTTP gateway and repositories. Only GitLab and authentication
// identity are fixtures: bootstrap, document authorization and decisions execute
// production handlers. No real GitLab or shared business data is written.
async function fixture(page) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-workbench-e2e-'));
  const servers = [];
  async function listen(handler) {
    const server = http.createServer(handler); servers.push(server);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${server.address().port}`;
  }
  let gitlabWrites = 0; let upstreamError = 0;
  const upstream = await listen((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const endpoint = url.pathname.replace(/^\/api\/v4\/projects\/[^/]+/, '');
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.method !== 'GET') { gitlabWrites++; return send(405, { message: 'fixture is read only' }); }
    if (upstreamError) return send(upstreamError, { message: `fixture repository ${upstreamError}` });
    if (endpoint === '/repository/tree') return send(200, [{ path: 'docs/reference.md', name: 'reference.md', type: 'blob' }]);
    if (endpoint === '/repository/branches') return send(200, [{ name: 'main', commit: { id: 'base-sha' } }]);
    if (endpoint.startsWith('/repository/files/')) return send(200, { encoding: 'base64', content: Buffer.from('# 仓库只读参考正文').toString('base64'), commit_id: 'base-sha' });
    return send(404, {});
  });
  const configPath = path.join(root, 'gitlab.json');
  fs.writeFileSync(configPath, JSON.stringify({ connections: [{ id: 'fixture', host: upstream, project: 'group/docs', credentialRef: 'workbench_e2e', purpose: 'read_write', status: 'active' }], mappings: [{ handbookId: 'HB-1', connectionId: 'fixture', defaultBranch: 'main', enabledBranches: ['main'], zhPaths: ['docs'], enPaths: [] }] }));
  process.env.GITLAB_TOKEN_workbench_e2e = 'local-fixture';
  const session = { authenticated: true, user: { id: 'author', roles: ['REVIEWER'] }, allowedActions: ['knowledge:read', 'knowledge:write', 'review:manage', 'publish:manage'], visibleModules: ['*'] };
  let activeSession = session;
  const repository = new MemoryIncrementalBuildRepository({ schemaVersion: 1, tasks: [], publishedVersions: [], idempotency: {}, audits: [] });
  const service = new IncrementalBuildService(repository);
  function seed(id, docs, handbookId = 'HB-1') {
    return service.createHandbookReview(session, id, {
      submissionId: id, name: id, handbookId, branch: 'main', commitSha: 'base-sha', content: docs.map(d => d.markdown).join('\n\n'), baselineContent: '# 旧正文', documents: docs,
      operations: docs.map(d => ({ type: 'update', documentId: d.documentId, nodeId: d.documentId, beforeDigest: crypto.createHash('sha256').update('# 旧正文').digest('hex'), after: { content: d.markdown } })),
    });
  }
  const doc = (id, reviewers = ['author']) => ({ documentId: id, filePath: `docs/${id}.md`, markdown: `# 冻结正文 ${id}`, draftRevisionId: `revision-${id}`, reviewerIds: reviewers });
  const shared = seed('共享候选', [doc('shared-a'), doc('shared-b', ['author', 'other'])]);
  const following = seed('下一候选', [doc('following')]);
  const unassigned = seed('未指派本人', [doc('other-only', ['other'])]);
  seed('不可见候选', [doc('hidden')], 'HB-hidden');
  const handler = createKnowledgeCenterHandler({
    config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, GITLAB_CONFIG_PATH: configPath, OUTLINE_TEMPLATE_PATH: path.resolve(__dirname, '../../../knowledge/outlines/大纲模板.xlsx'), OUTLINE_SAMPLE_PATH: path.resolve(__dirname, '../../../knowledge/outlines/基本数据库管理手册大纲示例.xlsx') }, KNOWLEDGE_ASSETS_CONFIG_PATH: configPath,
    stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [{ handbookId: 'HB-1', name: '隔离审核手册', status: 'content_building' }, { handbookId: 'HB-early', name: '早期手册', status: 'outline_published' }, { handbookId: 'HB-hidden', name: '不可见手册', status: 'content_building' }, { handbookId: 'HB-archived', status: 'archived' }] }) }, manualStatusStore: {}, brandIconStore: {}, domainStore: {} },
    moduleRegistry: { get: name => name === 'auth' ? {
      authorize: async () => activeSession,
      repository: { listUsers: () => [{ id: 'author', displayName: '提交者', roles: ['REVIEWER'] }, { id: 'usr_heyang', principalId: 178, displayName: '何阳', roles: ['REVIEWER'] }] },
    } : null },
    handleIncrementalBuild: createIncrementalBuildHandler({ service }), databaseConnectionGovernance: {}, sendFile(_file, res) { res.writeHead(404); res.end(); },
  });
  const base = await listen(handler);
  const webRoot = path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center');
  await page.route('**/*', async route => {
    const req = route.request(); const url = new URL(req.url());
    if (url.pathname.startsWith('/knowledge-center/api/')) {
      if (url.pathname.endsWith('/reviewers') && url.pathname.includes('/production/handbooks/')) return route.fulfill({ json: { success: true, data: { items: [{ id: 'author', displayName: '提交者' }, { id: '178', displayName: '何阳' }] } } });
      if (url.pathname.includes('/review/') || url.pathname.includes('/incremental-tasks')) {
        const response = await fetch(base + url.pathname + url.search, { method: req.method(), headers: req.headers(), ...(req.postData() ? { body: req.postData() } : {}) });
        return route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
      }
      return route.fulfill({ json: { success: true, data: url.pathname.endsWith('/auth/session') ? activeSession : {} } });
    }
    let relative = url.pathname.replace(/^\/knowledge-center\//, '');
    if (!relative || !path.extname(relative)) relative = 'knowledge-center-management.html';
    const file = path.join(webRoot, relative);
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    const mime = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream';
    return route.fulfill({ contentType: mime, body: fs.readFileSync(file) });
  });
  async function api(endpoint) { const response = await fetch(base + '/knowledge-center/api' + endpoint); return { status: response.status, ...(await response.json()) }; }
  function identity(id = 'author', actions = session.allowedActions, principalId = null) { activeSession = { ...session, user: { ...session.user, id, ...(principalId ? { principalId } : {}) }, allowedActions: actions, visibleHandbookIds: ['HB-1', 'HB-early'] }; }
  identity();
  function seedLegacyOnline(id, scope, documentIds, content) {
    const baseline = service.createSyntheticBaseline(session, `${id}-baseline`, { handbookId: 'HB-1', businessVersion: `${id}-version`, content, commitSha: 'base-sha', branch: 'main' });
    const task = {
      id, name: id, handbookId: 'HB-1', businessVersion: `${id}-version`, baselineVersionId: baseline.id,
      state: 'under_review', reviewMode: 'online_review', createdBy: { id: 'author' }, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      target: { scope, documentIds, sectionIds: [], language: 'zh-CN' },
      candidate: { digest: `${id}-digest`, content, operations: [], createdBy: { id: 'author' }, createdAt: '2026-01-01T00:00:00Z' },
      reviews: [{ id: `${id}-review`, candidateDigest: `${id}-digest`, status: 'pending', comments: [], submittedBy: { id: 'author' }, submittedAt: '2026-01-01T00:00:00Z' }],
      publication: null, externalEvidence: [],
    };
    repository.transaction(state => state.tasks.push(task));
    return task;
  }
  return { base, shared, following, unassigned, api, identity, seedEarlyReview() { return seed('早期阶段候选', [doc('early')], 'HB-early'); }, seedPrincipalReview() { return seed('人员 ID 指派', [doc('principal-assigned', ['178'])]); }, seedOnlineDocument() {
    const filePath = 'doc/产品文档/开发手册/SQL参考手册/00SQL参考手册.md';
    return seedLegacyOnline('sql-online-review', 'document', [filePath], '# SQL参考手册\n\n已发布原文');
  }, seedOnline() {
    return seedLegacyOnline('online-scope-handbook', 'handbook', [], '# 整册不可变快照');
  }, setRepositoryError(status) { upstreamError = status; }, gitlabWrites: () => gitlabWrites, async close() { delete process.env.GITLAB_TOKEN_workbench_e2e; await Promise.all(servers.map(server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }))); fs.rmSync(root, { recursive: true, force: true }); } };
}

test('我的审核：人员 ID 指派给何阳时展示待办并可阅读冻结正文', async ({ page }) => {
  const f = await fixture(page);
  try {
    f.seedPrincipalReview();
    f.identity('usr_heyang', undefined, 178);
    await page.goto(`${f.base}/knowledge-center/review?view=mine`);
    const row = page.locator('.review-hub-table tbody tr').filter({ hasText: 'principal-assigned' });
    await expect(row).toBeVisible();
    // 我的审核显示指派发起人；审核人姓名在文档清单中展示。
    await expect(row.locator('td').nth(4)).toHaveText(await row.locator('td').nth(3).innerText());
    await expect(row).not.toContainText('178');
    await page.goto(`${f.base}/knowledge-center/review?view=documents&handbookId=HB-1`);
    const documentRow = page.locator('.review-hub-table tbody tr').filter({ hasText: 'principal-assigned' });
    await expect(documentRow.locator('td').nth(4)).toHaveText('何阳');
    await page.goto(`${f.base}/knowledge-center/review?view=mine`);
    await expect(row).toBeVisible();
    await row.getByRole('link', { name: '开始审核' }).click();
    await expect(page.locator('.review-reader-snapshot')).toContainText('冻结正文 principal-assigned');
    await expect(page.locator('.review-action-card [data-review-decision="approve"]')).toBeVisible();
  } finally { await f.close(); }
});

test('文档清单可改派审核人并由审核角色终止误提任务', async ({ page }) => {
  const f = await fixture(page);
  try {
    f.seedPrincipalReview();
    await page.goto(`${f.base}/knowledge-center/review?view=documents&handbookId=HB-1`);
    const row = page.locator('.review-hub-table tbody tr').filter({ hasText: 'principal-assigned' });
    await expect(row.getByRole('button', { name: '修改审核人' })).toBeVisible();
    await row.getByRole('button', { name: '修改审核人' }).click();
    const dialog = page.locator('[data-review-assignment-dialog]');
    await expect(dialog.getByRole('option', { name: '何阳' })).toHaveText('何阳');
    await expect(dialog.locator('select')).toHaveValue('178');
    await expect(dialog.locator('select')).toHaveAttribute('name', 'reviewerIds');
    await dialog.locator('select').selectOption('author');
    await dialog.getByRole('button', { name: '保存' }).click();
    await expect(row.locator('td').nth(4)).toHaveText('提交者');
    await row.getByRole('button', { name: '终止任务' }).click();
    const cancel = page.locator('[data-review-cancel-dialog]');
    await cancel.locator('textarea').fill('误提审核任务');
    await cancel.getByRole('button', { name: '确认终止' }).click();
    await expect(row).toHaveCount(0);
  } finally { await f.close(); }
});

test('00SQL 历史无差异在线审核发布 422，保留待发布状态和操作入口', async ({ page }) => {
  const f = await fixture(page);
  try {
    const task = f.seedOnlineDocument();
    expect(task.candidate.operations).toEqual([]);
    await page.goto(`${f.base}/knowledge-center/review?view=documents&handbookId=HB-1`);
    const row = page.locator('.review-hub-table tbody tr').filter({ hasText: '00SQL参考手册.md' });
    await expect(row).toBeVisible();
    await row.getByRole('link', { name: '查看文档' }).click();
    await expect(page.locator('.review-reader-snapshot')).toContainText('已发布原文');
    const decision = await fetch(`${f.base}/knowledge-center/api/incremental-tasks/${task.id}/reviews/${task.reviews[0].id}/decision`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'sql-e2e-decision' }, body: JSON.stringify({ decision: 'approve' }),
    });
    expect(decision.status).toBe(200);
    const publish = await fetch(`${f.base}/knowledge-center/api/incremental-tasks/${task.id}/publish`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'sql-e2e-publish' }, body: JSON.stringify({ expectedCandidateDigest: task.candidate.digest }),
    });
    const publishBody = await publish.json();
    expect(publish.status, JSON.stringify(publishBody)).toBe(422);
    expect(publishBody.error.code).toBe('GITLAB_NO_CHANGES');
    await page.reload();
    await expect(page.locator('[data-review-status]')).toHaveText('待发布');
    await expect(page.locator('[data-review-publish]')).toContainText('创建 GitLab MR');
    await expect(page.getByRole('link', { name: /GitLab MR/ })).toHaveCount(0);
    await page.goto(`${f.base}/knowledge-center/review?view=documents&handbookId=HB-1`);
    await expect(page.locator('.review-hub-table tbody tr').filter({ hasText: '00SQL参考手册.md' })).toContainText('待发布');
    expect(f.gitlabWrites()).toBe(0);
  } finally { await f.close(); }
});

test('审核工作台：早期资产阶段的真实待审候选仍可发现，个人待办按指派显示', async ({ page }) => {
  const f = await fixture(page);
  try {
    f.seedEarlyReview();
    await page.goto(`${f.base}/knowledge-center/review`);
    const early = page.locator('.review-hub-table tbody tr').filter({ hasText: '早期手册' });
    await expect(early).toBeVisible();
    await expect(early).toContainText('大纲已发布');
    await expect(early.locator('.review-count-link')).toHaveText('1');
    await page.getByRole('link', { name: /我的审核/ }).click();
    await expect(page.locator('.review-hub-table')).toContainText('docs/early.md');
  } finally { await f.close(); }
});

test('工作台：阶段与指派准入、完整清单、冻结正文、只读目录、决定与下一篇', async ({ page }, testInfo) => {
  const f = await fixture(page);
  try {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${f.base}/knowledge-center/review`);
    await expect(page.getByRole('heading', { name: '按手册掌握审核全局' })).toBeVisible();
    await expect(page.locator('.review-hub-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.review-hub-table')).not.toContainText('早期手册');
    await expect(page.locator('.review-hub-table')).not.toContainText('不可见手册');
    await expect(page.getByLabel('业务阶段')).toHaveValue('');
    await page.getByLabel('业务阶段').selectOption('content_building');
    await page.getByRole('button', { name: '筛选', exact: true }).click();
    await expect(page).toHaveURL(/status=content_building/);
    await expect(page.locator('.review-hub-table tbody tr')).toHaveCount(1);
    await page.getByRole('link', { name: '清空' }).click();
    await page.getByRole('link', { name: '打开手册' }).click();
    await expect(page.locator('.review-handbook-overview')).toContainText('冻结正文 shared-a');
    await expect(page.locator('.review-handbook-overview')).toContainText('冻结正文 shared-b');
    await expect(page.locator('.review-handbook-overview')).not.toContainText('仓库只读参考正文');
    await expect(page.locator('[data-review-decision]')).toHaveCount(0);
    await page.getByRole('link', { name: '手册视图', exact: true }).click();
    await page.locator('.review-count-link').click();
    await expect(page.getByRole('link', { name: '查看文档', exact: true })).toHaveCount(4);
    await expect(page.locator('.review-hub-table thead')).toContainText('文档 / 路径');
    await expect(page.locator('.review-hub-table')).toContainText('docs/shared-a.md');
    await expect(page.getByLabel('审核状态')).toHaveValue('');
    await page.getByRole('link', { name: /我的审核/ }).click();
    await expect(page.getByRole('link', { name: '开始审核' })).toHaveCount(3);
    await expect(page.locator('.review-hub-table thead')).toContainText('指派人');
    const firstMineRow = page.locator('.review-hub-table tbody tr').first();
    expect(await firstMineRow.locator('td').nth(4).textContent()).toBe(await firstMineRow.locator('td').nth(3).textContent());
    expect((await firstMineRow.locator('td').nth(4).textContent()).trim()).not.toBe('暂无记录');
    await expect(page.locator('.review-hub-table')).not.toContainText('other-only');
    await page.getByLabel('关键词').fill('shared');
    await page.getByRole('button', { name: '筛选', exact: true }).click();
    await expect(page.getByRole('link', { name: '开始审核' })).toHaveCount(2);
    await page.locator('a[href*="documentId=shared-a"]').click();
    await expect(page.locator('.review-reader-snapshot')).toContainText('冻结正文 shared-a');
    await expect(page.locator('.review-context-strip')).toContainText('docs/shared-a.md');
    await expect(page.locator('.review-context-strip')).toContainText('来源');
    await expect(page.locator('.review-action-card [data-review-decision="approve"]')).toBeVisible();
    await expect(page.locator('.review-reader-snapshot')).not.toContainText('冻结正文 shared-b');
    await expect(page.locator('.review-scope-notice')).toContainText('2 篇文档');
    await expect(page.locator('[data-review-document="docs/reference.md"]')).toHaveCount(0);
    await page.locator('[data-review-show-all]').check();
    const referenceLink = page.locator('a[data-review-document="docs/reference.md"]');
    await expect(referenceLink).toHaveAttribute('href', /view=reader.*path=docs%2Freference.md/);
    await page.locator('[data-review-document="docs/reference.md"]').click();
    await expect(page.locator('.review-reader-repository')).toContainText('仓库只读参考正文');
    await expect(page.locator('[data-review-decision]')).toHaveCount(0);
    await page.goto(new URL(await referenceLink.getAttribute('href'), f.base).href);
    await expect(page.locator('.review-reader-repository')).toContainText('仓库只读参考正文');
    await expect(page.locator('[data-review-decision]')).toHaveCount(0);
    expect((await f.api('/review/bootstrap?view=mine')).data.workbench.mine).toHaveLength(3);
    await page.locator('[data-review-document="docs/shared-b.md"]').click();
    await expect(page.locator('.review-reader-snapshot')).toContainText('冻结正文 shared-b');
    await expect(page.locator('.review-reader-snapshot')).not.toContainText('冻结正文 shared-a');
    await page.locator('[data-review-step="opinions"]').click();
    await page.route('**/reviews/*/decision', route => route.fulfill({ status: 503, json: { success: false, error: { code: 'TEST_UNAVAILABLE', message: '测试审核失败，请重试' } } }), { times: 1 });
    await page.locator('[data-review-decision="approve"]').click();
    await expect(page.locator('#error-message')).toContainText('测试审核失败');
    expect((await f.api('/review/bootstrap?view=mine')).data.workbench.mine).toHaveLength(3);
    await page.locator('[data-review-decision="approve"]').click();
    await expect(page.locator('[data-review-publish]')).toBeVisible();
    expect((await f.api('/review/bootstrap?view=mine')).data.workbench.mine).toHaveLength(1);
    await page.getByRole('link', { name: '下一篇待我审核' }).click();
    await expect(page).toHaveURL(new RegExp(`taskId=${f.following.id}`));
    await expect(page.locator('.review-reader-snapshot')).toContainText('冻结正文 following');
    await page.getByRole('link', { name: '返回我的审核' }).click();
    await expect(page.getByLabel('关键词')).toHaveValue('shared');
    await expect(page.getByRole('heading', { name: '没有符合筛选条件的文档' })).toBeVisible();
    await page.getByRole('link', { name: '手册视图', exact: true }).click();
    await page.locator('.review-count-link').click();
    await expect(page.getByRole('link', { name: '查看文档', exact: true })).toHaveCount(4);
    await expect(page.locator('.review-hub-table')).toContainText('待发布');
    const mismatch = await f.api(`/review/bootstrap?view=reader&handbookId=HB-1&taskId=${f.shared.id}&documentId=wrong`);
    expect(mismatch.status).toBe(409);
    f.identity('other');
    expect((await f.api('/review/bootstrap?view=mine')).data.workbench.mine.map(row => row.documentId)).toEqual(['other-only']);
    expect((await f.api(`/review/bootstrap?view=reader&taskId=${f.shared.id}`)).status).toBe(200);
    f.identity('author', ['knowledge:read']);
    expect((await f.api('/review/bootstrap?view=mine')).data.workbench.mine).toHaveLength(0);
    await page.goto(`${f.base}/knowledge-center/review?view=mine`);
    await expect(page.getByRole('heading', { name: '暂无待我审核的文档' })).toBeVisible();
    for (const viewport of [{ width: 375, height: 812 }, { width: 812, height: 375 }]) {
      await page.setViewportSize(viewport);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${viewport.width}px页面溢出`).toBeLessThanOrEqual(1);
    }
    expect(f.gitlabWrites()).toBe(0);
    expect(errors).toEqual([]);
    await testInfo.attach('审核工作台只读角色空待办', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  } finally { await f.close(); }
});


test('工作台：无选中候选时仓库权限、服务失败与无映射错误保持可见', async ({ page }) => {
  const f = await fixture(page);
  try {
    for (const status of [503, 403]) {
      f.setRepositoryError(status);
      await page.goto(`${f.base}/knowledge-center/review?view=reader&handbookId=HB-1`);
      await expect(page.locator('.review-document-content [role="alert"]')).toBeVisible();
      await expect(page.locator('.review-document-content')).not.toContainText('从目录选择审核文档');
      await expect(page.locator('[data-review-decision]')).toHaveCount(0);
    }
    f.setRepositoryError(0);
    await page.goto(`${f.base}/knowledge-center/review?view=reader&handbookId=HB-early`);
    await expect(page.locator('.review-document-content')).not.toContainText('从目录选择审核文档');
    await expect(page.locator('.review-document-content')).toContainText(/映射|关联|GitLab/);
    await expect(page.locator('[data-review-decision]')).toHaveCount(0);
    expect(f.gitlabWrites()).toBe(0);
  } finally { await f.close(); }
});


test('整本手册在线评审聚合事项可从完整清单发现并阅读', async ({ page }) => {
  const f = await fixture(page);
  try {
    const task = f.seedOnline();
    await page.goto(`${f.base}/knowledge-center/review`);
    await page.locator('.review-count-link').click();
    const row = page.locator('.review-hub-table tbody tr').filter({ hasText: '整本手册在线评审（聚合事项）' });
    await expect(row).toHaveCount(1);
    await row.getByRole('link', { name: '查看文档', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`taskId=${task.id}`));
    await expect(page.locator('.review-reader-snapshot')).toContainText('整册不可变快照');
    await expect(page).not.toHaveURL(/documentId=null/);
    expect(f.gitlabWrites()).toBe(0);
  } finally { await f.close(); }
});
