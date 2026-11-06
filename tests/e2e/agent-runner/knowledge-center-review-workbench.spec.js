const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const coverageDir = process.env.KC_FRONTEND_ISTANBUL_CASE_DIR;
const coverageKey = '__kc_istanbul_coverage__';
let coveragePageNumber = 0;
const { findMapping, findConnection } = require('../../../packages/agent-runner-core/lib/gitlab-connector');
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
      submissionId: id, name: id, handbookId, repositoryIdentity: 'fixture:group/docs', branch: 'main', commitSha: 'base-sha', content: docs.map(d => d.markdown).join('\n\n'), baselineContent: '# 旧正文', documents: docs,
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
    stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [{ handbookId: 'HB-1', name: '隔离审核手册', status: 'content_building' }, { handbookId: 'HB-early', name: '早期手册', status: 'outline_published' }, { handbookId: 'HB-hidden', name: '不可见手册', status: 'content_building' }, { handbookId: 'HB-archived', status: 'archived' }] }) }, manualStatusStore: {}, brandIconStore: {}, domainStore: {
      readPlatformGitLabMapping(handbookId) {
        try { return findMapping(handbookId, configPath).mapping; }
        catch (error) { if (error.code === 'GITLAB_MAPPING_NOT_FOUND') return null; throw error; }
      },
      async readPlatformGitLabMappingAsync(handbookId) { return this.readPlatformGitLabMapping(handbookId); },
      readPlatformGitLabConnection: id => findConnection(id, configPath),
      readPlatformGitLabConnectionAsync: async id => findConnection(id, configPath),
    } },
    moduleRegistry: { get: name => name === 'auth' ? {
      authorize: async () => activeSession,
      repository: { listUsers: () => [{ id: 'author', displayName: '提交者', roles: ['REVIEWER'] }, { id: 'usr_heyang', principalId: 178, displayName: '何阳', roles: ['REVIEWER'] }] },
    } : null },
    handleIncrementalBuild: createIncrementalBuildHandler({ service }), databaseConnectionGovernance: {}, sendFile(_file, res) { res.writeHead(404); res.end(); },
    proxyAuth(_req, res) { res.writeHead(404); res.end(); },
    proxyPermission(_req, res) { res.writeHead(404); res.end(); },
  });
  const base = await listen(handler);
  const webRoot = path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center');
  let coveragePageId;
  if (coverageDir) {
    const pageId = `${process.pid}-${++coveragePageNumber}`;
    coveragePageId = pageId;
    await page.addInitScript(({ key, id }) => {
      globalThis[key] = {};
      if (!globalThis.__kc_coverage_pagehide_installed) {
        globalThis.__kc_coverage_pagehide_installed = true;
        addEventListener('pagehide', () => {
          try {
            sessionStorage.setItem(`${key}:${performance.timeOrigin}`, JSON.stringify(globalThis[key] || {}));
          } catch (_) {}
        });
      }
    }, { key: coverageKey, id: pageId });
  }
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
    let body = fs.readFileSync(file);
    if (coverageDir && file.endsWith('.js') && !relative.split(path.sep).includes('vendor')) {
      const { createInstrumenter } = require('istanbul-lib-instrument');
      body = createInstrumenter({ esModules: true, coverageVariable: coverageKey, compact: false }).instrumentSync(body.toString('utf8'), file);
    }
    return route.fulfill({ contentType: mime, body });
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
  return { base, shared, following, unassigned, api, identity, reviseShared() {
    const body = structuredClone(shared.handbookSource);
    body.submissionId = '共享候选修订'; body.name = '共享候选修订'; body.revisionOfTaskId = shared.id;
    body.documents.find(item => item.documentId === 'shared-b').markdown += '\n\n已补充操作步骤。';
    body.content = body.documents.map(item => item.markdown).join('\n\n');
    body.operations = body.documents.map(item => ({ type: 'update', documentId: item.documentId, nodeId: item.documentId,
      beforeDigest: crypto.createHash('sha256').update('# 旧正文').digest('hex'), after: { content: item.markdown } }));
    return service.createHandbookReview(session, '共享候选修订', body);
  }, seedEarlyReview() { return seed('早期阶段候选', [doc('early')], 'HB-early'); }, seedPrincipalReview() { return seed('人员 ID 指派', [doc('principal-assigned', ['178'])]); }, seedOnlineDocument() {
    const filePath = 'doc/产品文档/开发手册/SQL参考手册/00SQL参考手册.md';
    return seedLegacyOnline('sql-online-review', 'document', [filePath], '# SQL参考手册\n\n已发布原文');
  }, seedOnline() {
    return seedLegacyOnline('online-scope-handbook', 'handbook', [], '# 整册不可变快照');
  }, setRepositoryError(status) { upstreamError = status; }, gitlabWrites: () => gitlabWrites, async close() {
    if (coverageDir) {
      try {
        const values = await page.evaluate(key => {
          const result = [globalThis[key] || {}];
          for (let index = 0; index < sessionStorage.length; index++) {
            const name = sessionStorage.key(index);
            if (name?.startsWith(`${key}:`)) result.push(JSON.parse(sessionStorage.getItem(name)));
          }
          return result;
        }, coverageKey);
        fs.mkdirSync(coverageDir, { recursive: true });
        fs.writeFileSync(path.join(coverageDir, `${coveragePageId}.json`), JSON.stringify(values));
      } catch (_) {}
    }
    await page.unrouteAll({ behavior: 'wait' }); delete process.env.GITLAB_TOKEN_workbench_e2e; await Promise.all(servers.map(server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }))); fs.rmSync(root, { recursive: true, force: true });
  } };
}

test('应用导航：移动菜单、侧栏持久化与会话失效', async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${f.base}/knowledge-center/review?view=mine`);
    await expect(page.locator('#app-shell')).toBeVisible();
    const menu = page.locator('#mobile-menu');
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#sidebar')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#main-shell')).toHaveAttribute('inert', '');
    await expect(page.locator('#mobile-close')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeFocused();
    await menu.click();
    await page.locator('#mobile-overlay').click({ position: { x: 380, y: 400 } });
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await menu.click();
    await page.locator('#mobile-close').click();
    await expect(menu).toBeFocused();

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('#sidebar-collapse').click();
    await expect(page.locator('#app-shell')).toHaveClass(/sidebar-collapsed/);
    await expect(page.locator('#sidebar-collapse')).toHaveAttribute('aria-label', '展开导航');
    await page.locator('#sidebar-collapse').click();
    await page.locator('#sidebar-hide').click();
    await expect(page.locator('#app-shell')).toHaveClass(/sidebar-hidden/);
    await page.locator('#sidebar-restore').click();
    await expect(page.locator('#app-shell')).not.toHaveClass(/sidebar-hidden/);
    expect(await page.evaluate(() => localStorage.getItem('knowledge-center-sidebar-hidden'))).toBe('false');
    const keyboard = await page.evaluate(() => {
      const host = document.createElement('section');
      host.innerHTML = '<button data-production-handbook-row>手册行</button><button data-outline-tab>概览</button><button data-outline-tab>目录</button><button data-outline-tab>责任</button><button data-outline-document="doc-1">文档</button><div data-outline-context-menu data-document-id="doc-1">操作</div><div id="outline-handbook-info"><button data-outline-info-close>关闭</button></div>';
      document.body.append(host);
      const tabs = [...host.querySelectorAll('[data-outline-tab]')];
      let rowClicks = 0;
      const tabClicks = [];
      host.querySelector('[data-production-handbook-row]').addEventListener('click', () => rowClicks++);
      tabs.forEach((tab, index) => tab.addEventListener('click', () => tabClicks.push(index)));
      host.querySelector('[data-outline-info-close]').addEventListener('click', () => { host.querySelector('#outline-handbook-info').hidden = true; });
      const press = (node, key) => node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      press(host.querySelector('[data-production-handbook-row]'), 'Enter');
      host.querySelector('[data-outline-context-menu]').hidden = true;
      press(tabs[0], 'ArrowRight');
      press(tabs[1], 'End');
      press(tabs[2], 'Home');
      press(tabs[0], 'ArrowLeft');
      const focusedLast = document.activeElement === tabs[2];
      host.querySelector('[data-outline-context-menu]').hidden = false;
      press(tabs[0], 'Escape');
      const menuClosed = host.querySelector('[data-outline-context-menu]').hidden;
      const focusReturned = document.activeElement === host.querySelector('[data-outline-document]');
      press(tabs[0], 'Escape');
      const drawerClosed = host.querySelector('#outline-handbook-info').hidden;
      host.remove();
      return { rowClicks, tabClicks, focusedLast, menuClosed, focusReturned, drawerClosed };
    });
    expect(keyboard).toEqual({ rowClicks: 1, tabClicks: [1, 2, 0, 2], focusedLast: true, menuClosed: true, focusReturned: true, drawerClosed: true });
    const mapping = await page.evaluate(async () => {
      const { appState } = await import('/knowledge-center/common/state/app-state.js');
      const host = document.createElement('section');
      host.innerHTML = '<form data-repository-mapping-form data-handbook-id="HB-1"><select name="connectionId"><option value="fixture" selected>测试连接</option></select><select name="defaultBranch"><option value="main" selected>main</option></select><button type="button" data-mapping-language="zh">中文内容</button><button type="button" data-mapping-language="en">英文内容</button><input data-mapping-tree-search><div data-mapping-path-browser></div><div data-mapping-zh-tags></div><div data-mapping-en-tags></div><div data-mapping-preview></div></form>';
      document.body.append(host);
      appState.mappingState = {
        connectionId: 'fixture', treeItems: [
          { path: 'docs', name: '文档', type: 'tree' },
          { path: 'docs/zh', name: '中文目录', type: 'tree' },
          { path: 'docs/en', name: 'English', type: 'tree' },
          { path: 'docs/readme.md', name: '说明', type: 'blob' },
        ], expandedPaths: new Set(), branches: [{ name: 'main' }], enabledBranches: ['main'],
        zhPaths: [], enPaths: [], activeLang: 'zh', search: '', searchOriginalExpandedPaths: null,
      };
      const browser = host.querySelector('[data-mapping-path-browser]');
      const search = host.querySelector('[data-mapping-tree-search]');
      host.querySelector('[data-mapping-language="zh"]').click();
      const collapsed = browser.querySelector('[data-mapping-tree-item="docs"]')?.getAttribute('aria-expanded');
      browser.querySelector('[data-mapping-tree-expand="docs"]').click();
      const expanded = browser.querySelector('[data-mapping-tree-item="docs"]')?.getAttribute('aria-expanded');
      browser.querySelector('[data-mapping-tree-toggle="docs/zh"]').click();
      const zhTag = host.querySelector('[data-mapping-zh-tags]').textContent;
      const zhPreview = host.querySelector('[data-mapping-preview]').textContent;
      search.value = 'English'; search.dispatchEvent(new Event('input', { bubbles: true }));
      const matched = [...browser.querySelectorAll('[data-mapping-tree-item]')].map(node => node.dataset.mappingTreeItem);
      search.value = 'missing'; search.dispatchEvent(new Event('input', { bubbles: true }));
      const empty = browser.textContent;
      search.value = ''; search.dispatchEvent(new Event('input', { bubbles: true }));
      host.querySelector('[data-mapping-language="en"]').click();
      browser.querySelector('[data-mapping-tree-toggle="docs/en"]').click();
      const enTag = host.querySelector('[data-mapping-en-tags]').textContent;
      const bilingualPreview = host.querySelector('[data-mapping-preview]').textContent;
      host.querySelector('[data-mapping-path-remove="zh"]').click();
      const removed = host.querySelector('[data-mapping-zh-tags]').textContent;
      const finalPreview = host.querySelector('[data-mapping-preview]').textContent;
      host.remove();
      return { collapsed, expanded, zhTag, zhPreview, matched, empty, enTag, bilingualPreview, removed, finalPreview };
    });
    expect(mapping.collapsed).toBe('false');
    expect(mapping.expanded).toBe('true');
    expect(mapping.zhTag).toContain('docs/zh');
    expect(mapping.zhPreview).toContain('中文路径');
    expect(mapping.matched).toEqual(['docs', 'docs/en']);
    expect(mapping.empty).toContain('没有匹配的目录或文件');
    expect(mapping.enTag).toContain('docs/en');
    expect(mapping.bilingualPreview).toContain('英文路径');
    expect(mapping.removed).toContain('尚未从目录选择中文路径');
    expect(mapping.finalPreview).not.toContain('中文路径');
    const formBoundaries = await page.evaluate(() => {
      const host = document.createElement('section');
      host.innerHTML = '<form data-team-group-create-form><input name="groupName" value="   "><p data-team-group-create-status></p><button type="submit">创建</button></form><form data-principal-import-form><input name="file" type="file"><p data-principal-import-status></p><button type="submit">预检</button></form><dialog data-principal-cas-correction-dialog><form data-principal-cas-correction-form><button type="submit">确认</button></form></dialog>';
      document.body.append(host);
      const group = host.querySelector('[data-team-group-create-form]');
      const importForm = host.querySelector('[data-principal-import-form]');
      const correction = host.querySelector('[data-principal-cas-correction-dialog]');
      const submit = form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      submit(group);
      submit(importForm);
      correction.showModal();
      submit(correction.querySelector('form'));
      const result = {
        groupStatus: group.querySelector('[data-team-group-create-status]').textContent,
        importStatus: importForm.querySelector('[data-principal-import-status]').textContent,
        correctionClosed: !correction.open,
      };
      host.remove();
      return result;
    });
    expect(formBoundaries).toEqual({ groupStatus: '请输入小组名称。', importStatus: '请选择 Excel 文件。', correctionClosed: true });
    await page.evaluate(() => window.dispatchEvent(new Event('knowledge-center:session-expired')));
    await expect(page.locator('#auth-shell')).toBeVisible();
    await expect(page.locator('#auth-error')).toContainText('登录状态已过期');
  } finally { await f.close(); }
});

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
  // This scenario deliberately covers two documents, a rejected decision,
  // a retry, and a handoff to the next assigned document.
  testInfo.setTimeout(coverageDir ? 180000 : 60000);
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
    await expect(page.locator('.review-context-strip')).toContainText('shared-a.md');
    await expect(page.locator('.review-context-strip [title]')).toHaveAttribute('title', 'docs/shared-a.md');
    await expect(page.locator('.review-context-strip')).toContainText('来源');
    await expect(page.locator('.review-action-card [data-review-decision="approve"]')).toBeVisible();
    await expect(page.locator('.review-reader-snapshot')).not.toContainText('冻结正文 shared-b');
    await expect(page.locator('.review-scope-notice')).toContainText('2 篇文档');
    await page.locator('.review-scope-notice summary').click();
    await expect(page.locator('.review-scope-notice')).toContainText('本次仅审核当前文档：docs/shared-a.md');
    await expect(page.locator('.review-scope-notice')).toContainText('范围内每篇通过才可交付');
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
    await expect(page.locator('[data-review-publish]')).toHaveCount(0);
    expect((await f.api('/review/bootstrap?view=mine')).data.workbench.mine).toHaveLength(2);
    const remainingDocumentUrl = new URL(page.url());
    remainingDocumentUrl.searchParams.set('documentId', 'shared-a');
    remainingDocumentUrl.searchParams.set('path', 'docs/shared-a.md');
    await page.goto(remainingDocumentUrl.href);
    await page.getByRole('button', { name: '阅读文档', exact: true }).click();
    await expect(page.locator('.review-reader-snapshot')).toContainText('冻结正文 shared-a');
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


test('逐篇退回与重审：未改篇保留通过，只审核修改篇，旧退回记录保留', async ({ page }) => {
  const f = await fixture(page);
  try {
    const reader = (taskId, documentId) => `${f.base}/knowledge-center/review?view=reader&handbookId=HB-1&taskId=${taskId}&documentId=${documentId}&path=${encodeURIComponent(`docs/${documentId}.md`)}`;
    await page.goto(reader(f.shared.id, 'shared-a'));
    await expect(page.locator('.review-reader-snapshot')).toContainText('冻结正文 shared-a');
    await page.locator('[data-review-decision="approve"]').click();
    await expect(page.locator('[data-review-publish]')).toHaveCount(0);
    await page.goto(reader(f.shared.id, 'shared-b'));
    await page.locator('.review-return summary').click();
    await page.locator('[data-review-decision-form] textarea[name="comment"]').fill('请补充操作步骤。');
    await page.getByRole('button', { name: '确认退回', exact: true }).click();
    await expect.poll(async () => (await f.api(`/incremental-tasks/${f.shared.id}`)).data.state).toBe('rejected');
    await expect(page.locator('[data-review-publish]')).toHaveCount(0);
    const child = f.reviseShared();
    expect(child.reviews.find(item => item.documentId === 'shared-a').status).toBe('approved');
    expect(child.reviews.find(item => item.documentId === 'shared-b').status).toBe('pending');
    await page.goto(reader(child.id, 'shared-b'));
    await expect(page.locator('.review-reader-snapshot')).toContainText('已补充操作步骤。');
    await page.locator('[data-review-decision="approve"]').click();
    await expect(page.locator('[data-review-publish]')).toBeVisible();
    const after = (await f.api(`/incremental-tasks/${child.id}`)).data;
    expect(after.state).toBe('approved');
    expect(after.reviews.find(item => item.documentId === 'shared-a').carriedFrom.taskId).toBe(f.shared.id);
    const original = (await f.api(`/incremental-tasks/${f.shared.id}`)).data;
    expect(original.state).toBe('rejected');
    expect(original.reviews.find(item => item.documentId === 'shared-b').decision.comment).toBe('请补充操作步骤。');
    expect(f.gitlabWrites()).toBe(0);
  } finally { await f.close(); }
});

test('审核锚点：重复文本消歧、Markdown 选区映射与旧行号回退', async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.goto(`${f.base}/knowledge-center/review?view=documents&handbookId=HB-1`);
    const outcomes = await page.evaluate(async () => {
      const base = '/knowledge-center/modules/review-publishing/';
      const { renderReviewPublishing } = await import(base + 'view.js');
      const { textPosition, highlightAnchor, commentPath, bodyNodes, legacyQuote } = await import(base + 'anchors.js');
      const task = {
        id: 'anchor-fixture', handbookId: 'HB-1', businessVersion: '1', baselineVersionId: 'base',
        candidateDigest: 'digest', state: 'under_review', candidate: { digest: 'digest', operations: [] },
        capabilities: { canComment: true },
        reviews: [{ id: 'review', comments: [{ id: 'comment', content: '检查', anchor: { path: 'one.md', documentId: 'logical', selectedText: '目标文字' } }] }],
      };
      document.body.innerHTML = renderReviewPublishing({
        reviewProjection: { status: 'ok', items: [task], detail: { task } },
        gitlabProjection: {
          file: { path: 'one.md', content: '# 标题\n\n普通段落目标文字。\n\n| 列 |\n|---|\n| 表格内容 |\n\n```sql\nselect 1;\n```' },
          tree: [{ path: 'one.md', type: 'blob' }],
        },
        reviewUi: {},
      });
      const root = document.querySelector('.repository-markdown');
      const checks = [
        textPosition('重复重复', { selectedText: '重复' }) === null,
        textPosition('甲重复乙重复丙', { selectedText: '重复', contextBefore: '乙' })?.[0] === 4,
      ];
      for (const selectedText of ['目标文字', '表格内容', 'select 1;']) {
        checks.push(Boolean(highlightAnchor(root, { selectedText })) && getSelection().toString() === selectedText);
      }
      checks.push(!bodyNodes(root).map(node => node.textContent).join('').includes('复制'));
      checks.push(commentPath({ documentId: 'logical' }, { candidate: { operations: [{ documentId: 'logical', path: 'two.md' }] } }) === 'two.md');
      checks.push(commentPath({ documentId: 'unknown' }, {}) === '');
      checks.push(textPosition('变化后的内容', { selectedText: '旧内容' }) === null);
      checks.push(Boolean(highlightAnchor(root, { selectedText: '标题\n普通段落目标文字。' })));
      checks.push(legacyQuote({ documentId: 'x', nodeId: 'n' }, { candidate: { operations: [{ documentId: 'x', nodeId: 'n', type: 'delete' }] } }, '')?.deleted === true);
      const legacy = legacyQuote({ lineRange: { startLine: 3 } }, {}, '# 标题\n\n普通段落目标文字。\n');
      checks.push(Boolean(highlightAnchor(root, legacy)));
      return checks;
    });
    expect(outcomes.every(Boolean), JSON.stringify(outcomes)).toBe(true);
  } finally { await f.close(); }
});

test('手册生产视图：目录、正文、草稿状态与历史冲突投影真实渲染', async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.goto(`${f.base}/knowledge-center/review?view=documents&handbookId=HB-1`);
    await page.evaluate(() => {
      const host = document.createElement('div'); host.id = 'handbook-render-fixture'; document.body.append(host);
    });
    const render = async (projection, ui = {}, options = {}) => {
      await page.evaluate(async ({ projection, ui, options }) => {
        history.replaceState({}, '', `/knowledge-center/review?view=${options.view || 'all'}${options.documentId ? `&documentId=${encodeURIComponent(options.documentId)}` : ''}`);
        const { renderHandbookProduction } = await import('/knowledge-center/modules/production/handbook-view.js');
        document.querySelector('#handbook-render-fixture').innerHTML = renderHandbookProduction({
          projection, currentUser: options.currentUser || { id: 'author', displayName: '提交者' }, ui: { directoryInitialized: true, directoryDrawerOpen: true, ...ui },
          templateProjection: options.templateProjection || {}, region: options.region || 'page',
        });
      }, { projection, ui, options });
    };
    const outline = {
      id: 'outline-1', name: '隔离手册', nodes: [{ id: 'group-1', title: '运维', children: [
        { id: 'doc-1', documentId: 'doc-1', title: '01_部署指南.md', kind: 'document', path: '运维/01_部署指南.md', body: '' },
        { id: 'doc-2', documentId: 'doc-2', title: '02-只读参考.md', kind: 'document', path: '运维/02-只读参考.md', body: '参考正文' },
      ] }],
      governance: { effectiveDocumentAssignments: [{ nodeId: 'doc-1', ownerships: [{ assigneeId: 'author', assigneeName: '提交者' }] }] },
    };
    const projection = { status: 'ok', requestedHandbookId: 'HB-1', handbookOutline: { status: 'ok', handbook: { name: '隔离手册' }, detail: outline } };

    await render({ status: 'loading' });
    await expect(page.locator('#handbook-render-fixture')).toContainText('正在读取手册目录');
    await render({ status: 'ok', requestedHandbookId: 'HB-1' });
    await expect(page.locator('#handbook-render-fixture')).toContainText('手册工作区暂时不可用');
    for (const [status, message] of [['forbidden', '无权访问当前手册'], ['not_found', '当前手册不存在'], ['empty', '尚未建立大纲'], ['offline', '目录暂时不可用']]) {
      await render({ ...projection, handbookOutline: { status, error: { message: '隔离错误' } } });
      await expect(page.locator('#handbook-render-fixture')).toContainText(message);
    }
    await render(projection, {}, { documentId: 'removed-doc' });
    await expect(page.locator('#handbook-render-fixture')).toContainText('无法打开当前文档');
    await render(projection, {}, { documentId: 'doc-2', view: 'mine' });
    await expect(page.locator('#handbook-render-fixture')).toContainText('当前文档不在“只看我负责”范围');

    const emptyProjection = { ...projection, handbookOutline: { ...projection.handbookOutline, detail: { id: 'outline-1', nodes: [] } } };
    await render(emptyProjection);
    await expect(page.locator('#handbook-render-fixture')).toContainText('选择一个文档');
    await expect(page.locator('#handbook-render-fixture')).toContainText('当前手册没有可编辑文档');

    const readyDraft = {
      exists: true, capabilities: { canEdit: true, canSubmitReview: true },
      draft: { editVersion: 4, updatedAt: '2026-11-05T01:02:00Z', currentRevisionId: 'revision-4',
        revision: { markdown: '# 服务器版本' }, reviewState: { reviewStatus: 'rejected', taskState: 'mr_submitted', revisionId: 'revision-3', editVersion: 3, completion: { label: '待人工合并' }, reviewHref: '/knowledge-center/review?taskId=t1', taskId: 't1' } },
    };
    const templateProjection = { items: [{ id: 'active-template', name: '标准模板', status: 'active' }, { id: 'off-template', status: 'disabled' }] };
    await render(projection, { repository: { branch: 'main', status: 'ready', filesByDocument: {}, contentByDocument: {} } }, { documentId: 'doc-1' });
    await expect(page.locator('#handbook-render-fixture .handbook-empty-intro')).toContainText('当前还没有正文');
    await render(projection, {
      repository: { branch: 'main', status: 'ready', handbookId: 'HB-1', filesByDocument: { 'doc-1': { matched: true, path: '运维/01_部署指南.md' } }, contentByDocument: { 'doc-1': '# 仓库正文' } },
      serverDrafts: { 'doc-1': readyDraft }, draftLoadState: { 'doc-1': 'ready' }, draftSaveState: { 'doc-1': { status: 'failed' } },
      dirtyDocuments: ['doc-1'], drafts: { 'doc-1': '# 本地正文\n\n正文段落' }, selectedForReview: ['doc-1'],
      reviewDraftSummaries: { 'doc-1': { editVersion: 4 } }, reviewSelectionStatus: '请确认所选文档',
      history: { documentId: 'doc-1', loading: false, compareRevisionId: 'old-1', items: [{ revisionId: 'old-1', version: 2, markdown: '旧内容', createdAt: '2026-01-01T00:00:00Z', createdBy: { displayName: '历史作者' }, contentDigest: 'abcdef0123456789' }] },
      conflict: { localMarkdown: '本地冲突内容', serverDraft: { revision: { markdown: '服务器冲突内容' } } },
    }, { documentId: 'doc-1', templateProjection });
    const host = page.locator('#handbook-render-fixture');
    await expect(host.locator('[data-handbook-current-document="doc-1"]')).toBeVisible();
    await expect(host.locator('.repository-markdown')).toContainText('本地正文');
    await expect(host.locator('.handbook-save-status')).toContainText('保存失败');
    await expect(host.locator('.handbook-review-submission-status')).toContainText('已退回');
    await expect(host.locator('.handbook-review-submission-status')).toContainText('待人工合并');
    await expect(host.locator('[data-handbook-document="doc-1"]')).toContainText('未保存');
    await expect(host.locator('[data-handbook-document="doc-1"]')).toContainText('待评审');
    await expect(host.locator('[data-handbook-review-selection-dialog]')).toContainText('请先保存当前修改');
    await expect(host.locator('[data-handbook-review-selection-status]')).toContainText('请确认所选文档');
    await expect(host.locator('[data-handbook-history-dialog]')).toContainText('历史 v2');
    await expect(host.locator('[data-handbook-conflict-dialog]')).toContainText('服务器冲突内容');
    await expect(host.locator('[data-handbook-template]')).toHaveValue('active-template');

    await render(projection, {
      repository: { branch: 'main', status: 'ready', filesByDocument: {}, contentByDocument: {} },
      serverDrafts: { 'doc-1': readyDraft }, draftLoadState: { 'doc-1': 'ready' }, modeByDocument: { 'doc-1': 'edit' },
      editorFormatByDocument: { 'doc-1': 'markdown' }, markdownPreviewByDocument: { 'doc-1': true }, drafts: { 'doc-1': '# 可编辑正文' },
    }, { documentId: 'doc-1', region: 'editor', templateProjection });
    await expect(page.locator('#handbook-render-fixture .handbook-markdown-editor')).toHaveValue('# 可编辑正文');
    await expect(page.locator('#handbook-render-fixture .handbook-markdown-preview')).toContainText('可编辑正文');
    await expect(page.locator('#handbook-render-fixture [data-handbook-editor-format="markdown"]')).toHaveAttribute('aria-pressed', 'true');

    for (const [loadState, expected] of [['loading', '正在加载文档'], ['forbidden', '无共享草稿访问权限'], ['failed', '读取失败']]) {
      await render(projection, { draftLoadState: { 'doc-1': loadState }, draftContextResolved: false }, { documentId: 'doc-1', region: 'editor' });
      await expect(page.locator('#handbook-render-fixture')).toContainText(expected);
    }
    await render(projection, { draftLoadState: { 'doc-1': 'failed' }, draftContextResolved: true, modeByDocument: { 'doc-1': 'edit' }, editorFormatByDocument: { 'doc-1': 'rich' } }, { documentId: 'doc-1', region: 'editor' });
    await expect(page.locator('#handbook-render-fixture')).toContainText('共享草稿服务暂不可用');
    await expect(page.locator('#handbook-render-fixture .handbook-editor-loading')).toContainText('正在加载编辑器');
    await render(projection, { repository: { status: 'loading' }, draftLoadState: { 'doc-1': 'ready' } }, { documentId: 'doc-1', region: 'editor' });
    await expect(page.locator('#handbook-render-fixture [aria-busy="true"]')).toBeVisible();

    await render(projection, { draftLoadState: { 'doc-1': 'ready' }, serverDrafts: { 'doc-1': { ...readyDraft, exists: false, capabilities: { canEdit: false } } } }, { documentId: 'doc-1', view: 'mine', region: 'page' });
    await expect(page.locator('#handbook-render-fixture')).toContainText('运维');
    await expect(page.locator('#handbook-render-fixture [data-handbook-mode="edit"]')).toBeDisabled();
    await render(projection, {}, { view: 'mine', currentUser: { id: 'nobody' } });
    await expect(page.locator('#handbook-render-fixture')).toContainText('当前没有由你负责的文档');
  } finally { await f.close(); }
});

test('生产总览与增量工作区：投影状态、阶段、权限及交付分支真实渲染', async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.goto(`${f.base}/knowledge-center/review?view=documents&handbookId=HB-1`);
    const result = await page.evaluate(async () => {
      const { renderProduction, renderStages } = await import('/knowledge-center/modules/production/view.js');
      const host = document.createElement('main'); host.id = 'production-view-coverage-fixture'; document.body.append(host);
      const draw = (projection, query = '', options = {}) => {
        history.replaceState({}, '', `/knowledge-center/production${query}`);
        host.innerHTML = renderProduction({ incrementalProjection: projection, assetCatalog: options.assetCatalog, platformAdmin: options.platformAdmin, currentUser: options.currentUser });
        const text = host.innerText;
        return {
          text,
          alert: host.querySelector('[role="alert"]')?.innerText || '',
          stageHeaderMarkup: host.querySelector('.incremental-stage-panel header p')?.innerHTML || '',
          status: host.querySelector('[role="status"]')?.innerText || '',
          reload: Boolean(host.querySelector('[data-incremental-reload]')),
          createDisabled: host.querySelector('[data-incremental-create-form] select[name="handbookId"]')?.disabled ?? null,
          dialogHandbookOption: host.querySelector('[data-incremental-create-form] select[name="handbookId"] option[value="dlg"]')?.textContent || '',
          dialogBaselineEnabled: host.querySelector('[data-incremental-load-baselines]')?.disabled === false,
          tabs: [...host.querySelectorAll('[role="tab"]')].map(tab => [tab.dataset.productionOverviewTab, tab.getAttribute('aria-selected')]),
          rowCount: host.querySelectorAll('[data-production-handbook-row]').length,
          visibleRowCount: [...host.querySelectorAll('[data-production-handbook-row]')].filter(row => !row.hidden).length,
          handbookCount: host.querySelector('[data-production-handbook-count]')?.textContent || '',
          publishDisabled: host.querySelector('[data-incremental-publish]')?.disabled ?? null,
          revision: Boolean(host.querySelector('[data-incremental-revision]')),
          candidate: Boolean(host.querySelector('[data-incremental-candidate]')),
          evidenceForm: Boolean(host.querySelector('[data-incremental-evidence-form]')),
          sourceForm: Boolean(host.querySelector('[data-incremental-source-form]')),
          targetForm: Boolean(host.querySelector('[data-incremental-target-form]')),
          checkedSections: host.querySelectorAll('[data-incremental-target-form] input[name="sectionIds"]:checked').length,
          nodeControl: host.querySelector('[data-incremental-draft-form] [name="nodeId"]')?.tagName || '',
          draftReadOnly: host.querySelector('[data-incremental-draft-form] textarea[name="content"]')?.readOnly ?? null,
          selectedTask: host.querySelector('[data-incremental-task][aria-pressed="true"]')?.dataset.incrementalTask || '',
        };
      };
      const states = {};
      states.loading = draw(undefined);
      states.unavailable = draw({ status: 'unavailable', error: { message: '任务服务维护中' } });
      states.outlineError = draw({ status: 'ok', outlineCatalog: { status: 'offline', error: { message: '大纲读取失败' } } });
      const handbooks = [
        { id: 'hb-a', name: '甲手册', product: { name: '数据库' }, ownerA: { displayName: '甲' }, ownerBName: '乙', latestPublishedVersion: { versionName: 'v1', publishedAt: 'bad-time' } },
        { handbookId: 'hb-b', handbookName: '乙手册', productType: '中间件', primaryOwnerName: '丙', assistantOwnerName: '丙' },
        { id: 'hb-hidden', name: '未发布手册' },
        { id: 'hb-no-name', ownerA: { name: '对象负责人' }, ownerB: { userName: '协作人' } },
        { id: 'hb-single', name: '单待办手册', ownerA: '   ' },
      ];
      const handbookProjection = {
        status: 'ok', handbooks,
        outlineCatalog: { status: 'ok', items: [{ handbookId: 'hb-a', state: 'published' }, { manualId: 'hb-b', status: 'PUBLISHED' }, { handbookId: 'hb-hidden', state: 'draft' }] },
        items: [
          { id: 'a-old', handbookId: 'hb-a', state: 'editing', updatedAt: '2026-01-01T00:00:00Z' },
          { id: 'a-current', handbookId: 'hb-a', state: 'under_review', updatedAt: '2026-02-01T00:00:00Z', completion: { status: 'pending' } },
          { id: 'b-done', handbookId: 'hb-b', state: 'completed', completion: { status: 'completed', label: '已交付' }, publication: { versionName: 'v2', createdAt: '2026-03-01T00:00:00Z' } },
          { handbook: { id: 'hb-no-name' }, status: 'custom-a' },
          { handbook: { handbookId: 'hb-no-name' }, status: 'custom-b' },
          {},
          { handbookId: 'hb-single', state: 'editing' },
        ],
      };
      states.handbooks = draw(handbookProjection);
      states.handbookSearch = draw(handbookProjection, '?view=handbooks&q=%E4%B9%99');
      states.handbookNoMatches = draw(handbookProjection, '?view=handbooks&q=不存在');
      states.handbookAssetFallback = draw({ status: 'ok', outlineCatalog: { status: 'ok', items: [{ handbookId: 'hb-c', status: 'published' }] }, handbooks: [], items: [] }, '?view=handbooks', { assetCatalog: { items: [{ handbookId: 'hb-c', name: '丙手册', ownerAName: '丁' }, { name: '缺少标识资产' }] } });
      states.handbookRowsFallback = draw({ status: 'ok', outlineCatalog: { status: 'ok', items: [{ handbookId: 'hb-no-name', status: 'published' }, { handbookId: 'hb-single', state: 'published' }] }, handbooks: [{ id: 'hb-no-name', productName: '产品名', publishedVersion: { name: '版本名' }, ownerA: { name: '对象负责人' }, ownerB: { userName: '协作人' } }, { id: 'hb-single', productType: '产品类型', latestPublishedVersionName: '兼容版本' }], items: handbookProjection.items });
      states.noPublishedHandbooks = draw({ status: 'ok', outlineCatalog: { status: 'ok', items: [] }, handbooks: [{ id: 'hb-d', name: '未发布' }] });
      states.dialogOptions = draw({ status: 'ok', outlineCatalog: { status: 'ok', items: [] }, availableHandbooks: [{ id: 'dlg', name: '对话框手册' }] });
      states.outlineFallback = draw({ status: 'ok', outlineCatalog: { status: 'offline' } });
      states.invalidView = draw({ status: 'ok', outlineCatalog: { status: 'ok', items: [] } }, '?view=unknown');

      states.versionLoading = draw({ status: 'loading' }, '?view=versions');
      states.versionUnavailable = draw({ status: 'unavailable' }, '?view=versions');
      states.versionEmpty = draw({ status: 'ok', items: [] }, '?view=versions');
      states.versions = draw({ status: 'ok', items: [
        { id: 'v23-4-2', businessVersion: '23.4.2', handbookId: 'h1', updatedAt: '2026-01-01', ownerName: '责任甲', completion: { status: 'completed', label: '已合并', facts: { mergeState: 'merged' } }, handbookSource: { documents: [{ documentId: 'd1' }, { documentId: 'd1' }] } },
        { id: 'v23-4-10', businessVersion: '23.4.10', handbookName: '隔离手册', updatedAt: '2026-02-01', completion: { status: 'pending', label: '待合并', facts: { mergeState: 'opened' } }, target: { documentIds: ['d1', 'd1', 'd2'] } },
        { id: 'v23-4-10-old', businessVersion: '23.4.10', updatedAt: '2026-01-01', owner: '责任乙', target: { documentIds: [] }, candidate: { operations: [{ documentId: 'd3' }, { documentId: 'd3' }, {}] } },
        { id: 'version-missing', businessVersion: ' ', assigneeName: '责任丙', candidate: { operations: [{ documentId: 'd4' }] } },
      ] }, '?view=versions');
      states.versionsTasksFallback = draw({ status: 'ok', tasks: [
        { id: 'fallback-task', businessVersion: '9.1', statusDisplayName: '状态回退', handbook: { handbookId: 'HB-fallback' }, candidate: { operations: [{ documentId: 'x' }, { documentId: 'y' }] } },
        { businessVersion: '9.2', handbookId: 'HB-no-id' },
        { businessVersion: '9.2' },
      ] }, '?view=versions');

      states.generationsLoading = draw({ status: 'ok', generations: { status: 'loading' } }, '?view=generations');
      states.generationsForbidden = draw({ status: 'ok', generations: { status: 'forbidden', error: { message: '无生成记录权限' } } }, '?view=generations');
      states.generationsUnavailable = draw({ status: 'ok', generations: { status: 'unavailable' } }, '?view=generations');
      states.generationsEmpty = draw({ status: 'ok', generations: { status: 'ok', items: [] } }, '?view=todo');
      states.generations = draw({ status: 'ok', generations: { status: 'ok', items: [
        { taskId: 'g1', taskName: '失败运行', generationId: 'gen-1', status: 'failed', statusDisplayName: '生成失败', updatedAt: 'bad-time', progress: 0, progressMessage: '模型不可用', failureReason: { message: '连接超时' }, association: 'participant', nextAction: { href: '/next', label: '处理失败' }, completion: { label: '待确认' } },
        { taskId: 'g2', taskName: '完成运行', generationId: 'gen-2', status: 'completed', updatedAt: '2026-01-01T00:00:00Z', progress: 100, failureReason: '', completion: { status: 'completed', label: '已交付' } },
        { taskId: 'g3', status: 'running', generationId: 'gen-3', updatedAt: '', progress: null, failureReason: '上游返回错误', completion: {}, association: 'owner' },
      ] } }, '?view=generations');
      states.generationsFallbacks = draw({ status: 'ok', generations: { status: 'ok', items: [
        { taskId: '', status: 'cancelled', generationId: 'gen-4', failureReason: {}, completion: {}, nextAction: { href: '/partial' } },
        { id: 'gen-task', status: 'queued', generationId: 'gen-5', failureReason: '', completion: { label: '排队中' }, nextAction: { label: '打开记录' } },
      ] } }, '?view=generations');
      states.generationsDefault = draw({ status: 'ok', generations: null }, '?view=generations');

      const base = { id: 'task-1', handbookId: 'HB-1', handbookName: '隔离手册', name: '阶段任务', businessVersion: '1.2', state: 'draft', updatedAt: '2026-01-01T00:00:00Z', baselineVersionName: 'v1' };
      const taskView = (task, stage, extra = {}, options = {}) => draw({ status: 'ok', detail: { task }, items: [task], handbooks: [{ id: 'HB-1', name: '隔离手册' }], ...extra }, `?view=tasks&taskId=${task.id}&stage=${stage}`, options);
      states.noTask = draw({ status: 'ok', items: [] }, '?view=tasks');
      states.taskListLoading = draw({ status: 'loading' }, '?view=tasks');
      states.taskListUnavailable = draw({ status: 'ok', items: [], detail: null }, '?view=tasks');
      states.setup = taskView({ ...base }, 'setup');
      states.inputs = taskView({ ...base, sources: [{ title: '来源甲', sourceType: 'local', reference: 'R-1' }], target: { documentIds: ['d1'], sectionIds: ['s1'], language: 'en-US' }, availableTargets: [{ id: 's1', title: '安装', path: '第一章', documentId: 'd1' }] }, 'inputs');
      states.inputFallbacks = taskView({ id: 'fallback-input', state: 'editing', status: 'editing', sourceSnapshots: [{ name: '来源名称' }, { sourceType: 'manual' }, {}], targetScope: { sectionIds: ['chapter-a'] }, availableChapters: [{ chapterId: 'chapter-a', name: '章节甲' }, { nodeId: 'chapter-b', documentId: 'd2', documentName: '章节乙', path: '路径乙' }], draftContent: '备用正文' }, 'inputs');
      states.inputLocked = taskView({ ...base, state: 'rejected', target: { documentIds: ['d-locked'] } }, 'inputs');
      states.inputUnconfirmedLocked = taskView({ id: 'input-locked-empty', state: 'rejected' }, 'inputs');
      states.generation = taskView({ ...base, state: 'checked', sourceSnapshots: [], targetScope: { sectionIds: ['s2'] }, target: { documentIds: ['d2'], sectionIds: [] }, draft: { editVersion: 2, content: '草稿' }, checkReport: { passed: true, issues: [] } }, 'generation');
      states.checksBlocked = taskView({ ...base, state: 'editing', capabilities: { canEdit: false }, draftContent: '已冻结', target: { documentIds: ['d1'] }, checks: { passed: false, items: [{ code: 'missing-source', message: '缺少来源', level: 'error' }, { title: '提示', description: '人工确认', blocking: false }] } }, 'generation');
      states.generationRun = taskView({ ...base, generationPlan: {}, generationRun: { status: 'running', progressMessage: '' }, state: 'pending_submission', target: { sectionIds: ['node-1'], documentIds: ['d1'] }, draftContent: '旧草稿', checkReport: { items: [{ blocking: true, description: '需要确认' }, { level: 'warning', message: '建议检查' }] } }, 'generation');
      states.generationRunFallback = taskView({ ...base, state: 'editing', generationRun: {}, target: { sectionIds: [], documentIds: [] } }, 'generation');
      states.reviewStatuses = taskView({ id: 'review-statuses', status: 'changes_requested', target: { documentIds: ['pending', 'unknown', 'rejected', 'published'] }, reviews: [
        { targetDocumentId: 'pending', status: 'pending' }, { documentId: 'unknown', status: 'custom' }, { documentId: 'rejected', status: 'rejected' },
      ], capabilities: { canEdit: false } }, 'review');
      states.reviewPublished = taskView({ ...base, state: 'published', target: { documentIds: ['published'] }, reviews: [] }, 'review');
      states.reviewCapabilityFallback = taskView({ id: 'review-no-state', status: 'candidate_ready', target: { documentIds: ['d1'] }, reviews: [], capabilities: { canEdit: true } }, 'review');
      states.reviewStatusFallback = taskView({ id: 'review-status-fallback', state: 'under_review', target: { documentIds: ['d1'] }, reviews: [{ documentId: 'd1', status: 'custom' }] }, 'review');
      states.review = taskView({ ...base, state: 'candidate_ready', target: { documentIds: ['d1', 'd2'] }, availableChapters: [{ documentId: 'd1', documentName: '部署指南' }], reviews: [], capabilities: { canRevise: false } }, 'review');
      states.reviewRejected = taskView({ ...base, state: 'rejected', target: { documentIds: ['d1'] }, reviews: [{ id: 'r1', documentId: 'd1', status: 'rejected' }], capabilities: { canRevise: true } }, 'review');
      states.reviewSingleFallback = taskView({ ...base, state: 'approved', target: { documentIds: ['d1'] }, reviews: [{ status: 'approved' }] }, 'review');
      states.reviewMissing = taskView({ ...base, state: 'under_review', target: { documentIds: ['d1', 'd2'] }, reviews: [] }, 'review');
      states.publishDenied = taskView({ ...base, state: 'approved', target: { documentIds: ['d1'] }, capabilities: { canPublish: false }, publication: { id: 'pub-1', publishedAt: '2026-01-01' } }, 'publish', { platformAdmin: true });
      states.publishAllowed = taskView({ ...base, state: 'pending_publish', target: { documentIds: ['d1', 'd2'] }, capabilities: { canPublish: true, canRecordEvidence: true }, externalEvidence: [{ status: 'success', note: 'CI 通过' }], publishedVersion: { id: 'pub-2', publishedAt: '2026-02-01' } }, 'publish');
      states.publishPrivilegedFallback = taskView({ ...base, state: 'approved', target: { documentIds: [] } }, 'publish', {}, { platformAdmin: true });
      states.publishCapabilityFallback = taskView({ ...base, state: 'draft', target: { documentIds: [] }, publication: { id: 'pub-3', publishedAt: '2026-03-01' }, externalEvidence: [{ reference: 'MR-3' }] }, 'publish');
      states.gitlabComplete = taskView({ ...base, handbookSource: { branch: 'main' }, completion: { status: 'completed', facts: { markdownReadback: true, resourceReadback: true } }, mergeRequest: { iid: 4, webUrl: 'https://example.test/mr/4' } }, 'publish');
      states.gitlabClosed = taskView({ ...base, handbookSource: { branch: 'release' }, completion: { facts: { mergeState: 'closed' } }, mergeRequest: { iid: 5, webUrl: 'https://example.test/mr/5' } }, 'publish');
      states.gitlabWaiting = taskView({ ...base, handbookSource: { branch: 'main' }, mergeRequest: { iid: 6, webUrl: 'https://example.test/mr/6' } }, 'publish');
      states.gitlabUncreated = taskView({ ...base, handbookSource: { branch: 'main' }, capabilities: { canPublish: false } }, 'publish');
      states.gitlabEscaped = taskView({ ...base, handbookSource: { branch: 'feature/<unsafe>' }, completion: { facts: {} } }, 'publish');
      states.unselectedTask = draw({ status: 'ok', detail: { id: 'selected' }, items: [{ id: 'other', title: '未选中任务', state: 'editing' }] }, '?view=tasks&taskId=selected&stage=not-a-stage');

      host.innerHTML = renderStages({ incrementalProjection: { items: [] } });
      states.stagesEmpty = { text: host.innerText };
      host.innerHTML = renderStages({ incrementalProjection: { items: [{ name: '已完成任务', state: 'published' }, {}] } });
      states.stagesPopulated = { text: host.innerText };
      host.innerHTML = renderStages({ incrementalProjection: { tasks: [
        { taskId: 'pending-with-mr', completion: { status: 'pending' }, mergeRequest: { iid: 7 } },
        { id: 'pending-label', completion: { status: 'pending', label: '人工待处理' }, mergeRequest: { iid: 8 } },
        { id: 'unknown-status', status: 'future_state' },
        { id: 'display-status', statusDisplayName: '服务端状态' },
        { id: 'missing-status' },
        { id: 'completed-status', completion: { status: 'completed' } },
      ] } });
      states.stagesStatuses = { text: host.innerText };
      states.requestedHandbook = draw({ status: 'ok', requestedHandbookId: 'HB-1', handbookOutline: { status: 'loading' } });
      return states;
    });

    expect(result.loading.text).toContain('正在读取已发布大纲');
    expect(result.loading.createDisabled).toBe(true);
    expect(result.unavailable.alert).toContain('任务服务维护中');
    expect(result.unavailable.reload).toBe(true);
    expect(result.outlineError.alert).toContain('大纲读取失败');
    expect(result.handbooks.text).toContain('甲手册');
    expect(result.handbooks.text).toContain('2 个任务待处理');
    expect(result.handbooks.text).not.toContain('未发布手册');
    expect(result.handbooks.handbookCount).toBe('2 / 2 本');
    expect(result.handbookSearch.handbookCount).toBe('1 / 2 本');
    expect(result.handbookSearch.text).toContain('乙手册');
    expect(result.handbookNoMatches.text).toContain('没有匹配');
    expect(result.handbookNoMatches.visibleRowCount).toBe(0);
    expect(result.handbookAssetFallback.text).toContain('丙手册');
    expect(result.handbookRowsFallback.text).toContain('对象负责人、协作人');
    expect(result.handbookRowsFallback.text).toContain('未命名手册');
    expect(result.handbookRowsFallback.text).toContain('1 个任务待处理');
    expect(result.noPublishedHandbooks.text).toContain('暂无可生产的手册');
    expect(result.dialogOptions.dialogHandbookOption).toBe('对话框手册');
    expect(result.dialogOptions.dialogBaselineEnabled).toBe(true);
    expect(result.outlineFallback.alert).toContain('请稍后重新读取');
    expect(result.invalidView.tabs.find(([key]) => key === 'handbooks')[1]).toBe('true');
    expect(result.versionLoading.status).toContain('正在读取数据库版本任务');
    expect(result.versionUnavailable.text).toContain('增量服务暂时不可用');
    expect(result.versionEmpty.text).toContain('暂无数据库版本任务');
    expect(result.versions.text).toContain('23.4.2');
    expect(result.versions.text).toContain('23.4.10');
    expect(result.versions.text).toContain('等待合并并回读');
    expect(result.versions.text).toContain('版本待核对');
    expect(result.versionsTasksFallback.text).toContain('状态回退');
    expect(result.versionsTasksFallback.text).toContain('责任人待确认');
    expect(result.versionsTasksFallback.text).toContain('9.2');
    expect(result.generationsLoading.status).toContain('正在读取我的生成');
    expect(result.generationsForbidden.alert).toContain('无生成记录权限');
    expect(result.generationsUnavailable.alert).toContain('我的生成暂时无法读取');
    expect(result.generationsEmpty.text).toContain('暂无生成记录');
    expect(result.generations.text).toContain('失败运行');
    expect(result.generations.text).toContain('上游返回错误');
    expect(result.generations.text).toContain('100%');
    expect(result.generations.tabs.find(([key]) => key === 'generations')[1]).toBe('true');
    expect(result.generationsFallbacks.text).toContain('生成失败');
    expect(result.generationsFallbacks.text).toContain('打开记录');
    expect(result.generationsDefault.status).toContain('正在读取我的生成');
    expect(result.noTask.text).toContain('选择一个增量任务');
    expect(result.taskListLoading.status).toContain('正在读取增量任务');
    expect(result.setup.text).toContain('建立任务');
    expect(result.inputs.text).toContain('来源甲');
    expect(result.inputs.sourceForm).toBe(true);
    expect(result.inputs.targetForm).toBe(true);
    expect(result.inputFallbacks.text).toContain('来源名称');
    expect(result.inputFallbacks.text).toContain('人工固化');
    expect(result.inputFallbacks.checkedSections).toBe(1);
    expect(result.inputLocked.text).toContain('已确认：d-locked');
    expect(result.inputUnconfirmedLocked.text).toContain('未确认修改范围');
    expect(result.generation.text).toContain('提交候选版本');
    expect(result.checksBlocked.text).toContain('缺少来源');
    expect(result.checksBlocked.text).toContain('当前候选已冻结');
    expect(result.generationRun.text).toContain('生成任务已建立');
    expect(result.generationRun.text).toContain('需要确认');
    expect(result.generationRunFallback.text).toContain('运行状态待返回');
    expect(result.review.text).toContain('提交文档审核');
    expect(result.review.text).toContain('部署指南');
    expect(result.reviewRejected.text).toContain('创建修订草稿');
    expect(result.reviewSingleFallback.text).toContain('已通过');
    expect(result.reviewMissing.text).toContain('审核事实待接入');
    expect(result.reviewStatuses.text).toContain('审核中');
    expect(result.reviewStatuses.text).toContain('状态待确认');
    expect(result.reviewPublished.text).toContain('已发布');
    expect(result.reviewCapabilityFallback.text).toContain('提交文档审核');
    expect(result.reviewStatusFallback.text).toContain('状态待确认');
    expect(result.publishDenied.publishDisabled).toBe(null);
    expect(result.publishDenied.text).toContain('服务端已返回发布版本');
    expect(result.publishAllowed.text).toContain('确认整体发布');
    expect(result.publishAllowed.evidenceForm).toBe(true);
    expect(result.publishPrivilegedFallback.text).toContain('确认整体发布');
    expect(result.publishCapabilityFallback.text).toContain('发布后的外部证据');
    expect(result.gitlabComplete.text).toContain('GitLab 已合并');
    expect(result.gitlabClosed.text).toContain('MR 已关闭且未合并');
    expect(result.gitlabWaiting.text).toContain('等待合并及目标分支回读');
    expect(result.gitlabUncreated.text).toContain('审核通过后创建 GitLab MR');
    expect(result.gitlabEscaped.stageHeaderMarkup).toContain('feature/&lt;unsafe&gt;');
    expect(result.unselectedTask.text).toContain('未选中任务');
    expect(result.requestedHandbook.text).toContain('手册目录暂时不可用');
    expect(result.stagesStatuses.text).toContain('待合并回读');
    expect(result.stagesStatuses.text).toContain('人工待处理');
    expect(result.stagesStatuses.text).toContain('状态未返回');
    expect(result.stagesEmpty.text).toContain('暂无生产进展');
    expect(result.stagesPopulated.text).toContain('已完成任务');
  } finally { await f.close(); }
});

test('GitLab 仓库阅读器：错误状态、目录投影和安全 Markdown 真实渲染', async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.goto(`${f.base}/knowledge-center/review?view=documents&handbookId=HB-1`);
    const result = await page.evaluate(async () => {
      const base = '/knowledge-center/modules/repository/';
      const { renderRepository, safeMarkdown, treeHierarchy } = await import(base + 'view.js');
      const host = document.createElement('main'); host.id = 'repository-view-coverage-fixture'; document.body.append(host);
      const draw = (projection, platformAdmin) => {
        host.innerHTML = renderRepository({ projection, ...(platformAdmin === undefined ? {} : { platformAdmin }) });
        return { html: host.innerHTML, text: host.innerText, role: host.querySelector('[role="alert"], [role="status"]')?.getAttribute('role') || '' };
      };
      const states = {};
      states.loading = draw({ status: 'loading' });
      states.unauthorized = draw({ status: 'unauthorized', handbookId: 'HB-1', handbookName: '隔离手册', branch: 'release', language: 'en', path: 'docs/intro.md' });
      states.unauthorizedDefaults = draw({ status: 'unauthorized' });
      states.unauthorizedIdFallback = draw({ status: 'unauthorized', handbookId: 'HB-fallback' });
      states.forbidden = draw({ status: 'forbidden', error: { message: 'GitLab 拒绝读取' } });
      states.forbiddenDefault = draw({ status: 'forbidden' });
      states.unmapped = draw({ status: 'not-mapped' });
      states.missing = draw({ status: 'not-found', error: { message: '仓库文件不存在' } });
      states.missingDefault = draw({ status: 'not-found' });
      states.conflict = draw({ status: 'conflict' });
      states.unavailable = draw({ status: 'unavailable', error: { message: 'GitLab 暂不可用' } });
      states.unknown = draw({ status: 'future-error' });
      states.unknownDefault = draw({ status: 'unavailable', error: { message: '' } });

      const markdown = [
        '# 安全阅读 ##',
        '段落 **加粗** *强调* ~~删除~~ `行内代码`，特殊字符 & <tag>。',
        '<span id="safe-anchor" name="safe-anchor"></span>',
        '<span id="id-only"></span>',
        "<span name='name-anchor'></span>",
        '<span id="bad id"></span>',
        '<span id="duplicate" id="again"></span>',
        '<span id="unsafe" onclick="run()"></span>',
        '[相对链接](../config.md?raw=1#top) [绝对链接](/README.md) [](./empty.png) [站内锚点](#safe-anchor) [外部链接](https://example.test/docs) [危险协议](javascript:alert(1))',
        '![安全图片](./images/setup.webp) ![不安全图片](data:image/svg+xml,x) ![外部图片](https://example.test/a.png) ![其他图片](./diagram.svg)',
        '',
        '- 普通项',
        '- [x] 已完成',
        '- [ ] 未完成',
        '  - 子项',
        '1. 有序项',
        '+ 切换列表类型',
        '',
        '> 引用内容',
        '引用第二行',
        '',
        '---',
        '',
        '| 名称 | 说明 | 缺省 |',
        '| :--- | ---: | :---: |',
        '| `端口` | **监听** | |',
        '| 第二行 | | 有效 |',
        '| 少列 |',
        '| 转义 | left\\|right | 末列 |',
        '',
        '名称 | 无对齐',
        '--- | ---',
        '纯文本 | 普通值',
        '',
        '```sql title="示例"',
        'SELECT <unsafe>;',
        '```',
        '~~~',
        '无语言围栏',
        '~~~',
        '````js',
        '未闭合代码块',
      ].join('\n');
      const context = { handbookId: 'HB-1/隔离', branch: 'feature/demo', language: 'en' };
      const markdownHtml = safeMarkdown(markdown, 'docs/setup/install.md', context);
      const emptyMarkdown = safeMarkdown();
      const defaultTableRow = safeMarkdown('| 标题 | 短行 |\n| --- | --- |\n| 单元格 |');
      const pathFallback = safeMarkdown('[相对文件](file.md)');
      const unclosedPlainFence = safeMarkdown('```\n无语言且未闭合');
      const selected = [{ path: 'docs', name: 'docs', type: 'tree' }, { path: 'docs/a.md', name: 'a.md', type: 'blob' }];
      const tree = treeHierarchy([
        { path: 'docs/z.md', name: 'z.md', type: 'blob' },
        { path: 'docs/sub/b.md', name: 'b.md', type: 'blob' },
        { path: 'docs/sub', name: 'sub', type: 'tree' },
        { path: 'docs', name: 'docs', type: 'tree' },
        { path: 'orphan/file.md', name: 'file.md', type: 'blob' },
      ]);
      const hierarchyFallbacks = treeHierarchy([
        { name: '缺省路径', type: 'blob' }, { path: 'a.md', name: '甲', type: 'blob' },
        { path: 'b.md', name: '乙', type: 'blob' }, { path: 'z-folder', name: '目录', type: 'tree' },
      ]);
      states.emptyTree = draw({ status: 'ok', handbookId: 'HB-1', tree: [], branches: [] });
      states.defaultProjection = draw();
      states.nullProjection = draw(null);
      states.normal = draw({
        status: 'ok', handbookId: 'HB-1', handbookName: '隔离手册', project: 'group/docs', connectionName: '只读连接', branch: '',
        branches: [{ name: 'main' }, { name: 'release/<unsafe>' }], languages: { zh: false, en: true }, language: 'en',
        tree: selected, commitSha: '', updatedAt: '2026-11-05T01:02:00Z',
        file: { path: 'docs/a.md', content: '# 浏览器投影\n\n![相对图片](./images/a.png)' },
      }, true);
      states.normalWithoutFile = draw({ status: 'ok', handbookId: 'HB-1', branches: [{ name: 'main' }], tree: [{ path: 'docs', name: 'docs', type: 'tree' }, { path: 'docs/README.md', name: 'README.md', type: 'blob' }] });
      states.nonArrayTree = draw({ status: 'ok', tree: 'invalid', branches: [] });
      states.normalWithoutLanguage = draw({ status: 'ok', handbookId: 'HB-lang', file: { path: 'README.md', content: '![图片](./a.jpg)' }, tree: [{ name: 'README.md', type: 'blob' }], branches: [] });
      states.normalWithCommit = draw({ status: 'ok', handbookId: 'HB-commit', connectionName: '主连接', branch: 'main', commitSha: '123456789abc', updatedAt: '', languages: { zh: true, en: false }, tree: [{ name: 'README.md', type: 'blob' }], file: { path: 'README.md', content: '# 中文' } });
      return { states, markdownHtml, emptyMarkdown, defaultTableRow, pathFallback, unclosedPlainFence, hierarchy: tree, hierarchyFallbacks, context };
    });

    expect(result.states.loading.text).toContain('正在读取仓库内容');
    expect(result.states.unauthorized.role).toBe('alert');
    expect(result.states.unauthorized.html).toContain('/oauth/start?returnTo=');
    expect(result.states.unauthorized.text).toContain('English');
    expect(result.states.unauthorizedDefaults.text).toContain('默认分支 / 中文 / 上次阅读位置');
    expect(result.states.unauthorizedDefaults.text).toContain('当前手册');
    expect(result.states.unauthorizedIdFallback.text).toContain('HB-fallback');
    expect(result.states.forbidden.text).toContain('GitLab 拒绝读取');
    expect(result.states.forbiddenDefault.text).toContain('没有读取该手册仓库');
    expect(result.states.unmapped.text).toContain('尚未配置可读内容');
    expect(result.states.missing.text).toContain('仓库文件不存在');
    expect(result.states.missingDefault.text).toContain('可能已被删除或调整');
    expect(result.states.conflict.text).toContain('连接已停用');
    expect(result.states.unavailable.text).toContain('GitLab 暂不可用');
    expect(result.states.unknown.html).toContain('data-repository-refresh');
    expect(result.states.unknownDefault.text).toContain('GitLab 服务暂时不可达');
    expect(result.states.emptyTree.text).toContain('目录为空');
    expect(result.states.normal.html).toContain('管理员专属');
    expect(result.states.normal.html).toContain('维护映射');
    expect(result.states.normal.html).toContain('value="release/&lt;unsafe&gt;"');
    expect(result.states.normal.html).toContain('data-repository-language="zh" aria-pressed="false" disabled');
    expect(result.states.normal.html).toContain('提交 未知');
    expect(result.states.normal.text).toContain('更新时间');
    expect(result.states.normalWithoutFile.text).toContain('请选择左侧文档');
    expect(result.states.normalWithoutFile.html).toContain('aria-current="false"');
    expect(result.states.nonArrayTree.text).toContain('目录为空');
    expect(result.states.normalWithoutLanguage.html).toContain('language=zh');
    expect(result.states.normalWithCommit.text).toContain('提交 12345678');
    expect(result.states.normalWithCommit.html).toContain('data-repository-language=\"en\" aria-pressed=\"false\" disabled');
    expect(result.states.defaultProjection.text).toContain('请选择左侧文档');
    expect(result.states.nullProjection.text).toContain('请选择左侧文档');
    expect(result.markdownHtml).toContain('<span id="safe-anchor" name="safe-anchor" class="repository-anchor"');
    expect(result.markdownHtml).toContain('<span id="name-anchor" name="name-anchor" class="repository-anchor"');
    expect(result.markdownHtml).toContain('<span id="id-only" name="id-only" class="repository-anchor"');
    expect(result.markdownHtml).toContain('&lt;span id=&quot;bad id&quot;&gt;&lt;/span&gt;');
    expect(result.markdownHtml).toContain('&lt;span id=&quot;duplicate&quot; id=&quot;again&quot;&gt;&lt;/span&gt;');
    expect(result.markdownHtml).toContain('path=docs%2Fsetup%2Fimages%2Fsetup.webp');
    expect(result.markdownHtml).toContain('path=README.md');
    expect(result.markdownHtml).toContain('path=docs%2Fsetup%2Fempty.png"></a>');
    expect(result.markdownHtml).toContain('target="_blank" rel="noopener noreferrer"');
    expect(result.markdownHtml).not.toContain('javascript:alert(1)');
    expect(result.markdownHtml).not.toContain('data:image/svg+xml');
    expect(result.markdownHtml).toContain('<ol>');
    expect(result.markdownHtml).toContain('<ul>');
    expect(result.markdownHtml).toContain('<blockquote>');
    expect(result.markdownHtml).toContain('<hr>');
    expect(result.markdownHtml).toContain('text-align:center');
    expect(result.markdownHtml).toContain('left|right');
    expect(result.markdownHtml).toContain('<th>无对齐</th>');
    expect(result.markdownHtml).toContain('language-sql');
    expect(result.markdownHtml).toContain('language-text');
    expect(result.markdownHtml).toContain('未闭合代码块');
    expect(result.emptyMarkdown).toContain('class="repository-markdown"');
    expect(result.defaultTableRow).toContain('<td></td>');
    expect(result.pathFallback).toContain('path=file.md');
    expect(result.unclosedPlainFence).toContain('language-text');
    expect(result.hierarchy).toHaveLength(2);
    expect(result.hierarchy[0].children[0].children[0].path).toBe('docs/sub/b.md');
    expect(result.hierarchyFallbacks.some(node => node.path === undefined)).toBe(true);
    expect(result.hierarchyFallbacks.find(node => node.type === 'tree')).toBeTruthy();
  } finally { await f.close(); }
});

test('兼容入口与工作台小组件：AI 写作、领域任务和 MR 参与人真实 DOM', async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.goto(`${f.base}/knowledge-center/review?view=documents&handbookId=HB-1`);
    const authTargets = await page.evaluate(async () => {
      const auth = await import('/knowledge-center/common/auth/auth-controller.js');
      const initial = `${location.pathname}${location.search}${location.hash}`;
      const safe = auth.sanitizeReturnTo('/knowledge-center/review?view=documents&ticket=secret#item');
      const outside = auth.sanitizeReturnTo('https://outside.example/knowledge-center/review');
      const relativeProtocol = auth.sanitizeReturnTo('//outside.example/knowledge-center/review');
      const unrelated = auth.sanitizeReturnTo('/admin');
      history.replaceState(history.state, '', '/knowledge-center/review?view=documents&ticket=secret#item');
      const current = auth.currentSafeTarget();
      auth.rememberCurrentTarget();
      const remembered = auth.consumeRememberedTarget();
      const consumed = auth.consumeRememberedTarget();
      auth.removeTicketFromAddress();
      const address = `${location.pathname}${location.search}${location.hash}`;
      auth.removeTicketFromAddress();
      history.replaceState(history.state, '', initial);
      return { safe, outside, relativeProtocol, unrelated, current, remembered, consumed, address };
    });
    expect(authTargets).toEqual({
      safe: '/knowledge-center/review?view=documents#item',
      outside: '/knowledge-center/',
      relativeProtocol: '/knowledge-center/',
      unrelated: '/knowledge-center/',
      current: '/knowledge-center/review?view=documents#item',
      remembered: '/knowledge-center/review?view=documents#item',
      consumed: null,
      address: '/knowledge-center/review?view=documents#item',
    });
    let participantRequests = 0;
    await page.route('**/knowledge-center/api/incremental-tasks/*/mr-participants', async route => {
      const count = ++participantRequests;
      if (count === 3) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: '参与人服务不可用' } }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: count === 2
        ? { candidateDigest: 'digest-2', reviewers: [{ platformId: 'reviewer-2', displayName: '审核人', username: 'reviewer' }], assignees: [], canSubmit: false }
        : { candidateDigest: 'digest-1', reviewers: [{ platformId: 'reviewer-1', error: '账号未映射' }, { platformId: 'reviewer-2', displayName: '审核人', username: 'reviewer' }], assignees: [{ platformId: 'author', displayName: '提交者', username: 'author' }], canSubmit: true } }) });
    });
    const widget = await page.evaluate(async () => {
      const host = document.createElement('div'); host.id = 'small-widget-fixture'; document.body.append(host);
      const { openProductionAIDialog } = await import('/knowledge-center/modules/production/production-ai-dialog.js');
      const result = openProductionAIDialog({ context: { handbookId: 'HB-1', documentId: 'doc-1', branch: 'main' } });
      const defaultHost = document.getElementById('view-root');
      const defaults = { hasPage: Boolean(defaultHost.querySelector('.handbook-writing-page')), operation: defaultHost.querySelector('[data-ai-operation]')?.value, resultType: typeof result?.close };
      result.close();
      const custom = openProductionAIDialog({ host, context: { handbookId: 'HB-1', documentId: 'doc-2', branch: 'main' }, operation: 'update', editVersion: -1, getMarkdown: () => '自定义正文', baselineDigest: async () => 'baseline', onAdopt() {} });
      const explicit = { hasPage: Boolean(host.querySelector('.handbook-writing-page')), operation: host.querySelector('[data-ai-operation]')?.value, closeType: typeof custom?.close };
      custom.close();
      return { defaults, explicit };
    });
    expect(widget.defaults).toEqual({ hasPage: true, operation: 'generate', resultType: 'function' });
    expect(widget.explicit).toEqual({ hasPage: true, operation: 'polish', closeType: 'function' });

    const dashboard = await page.evaluate(async () => {
      const { renderDashboard } = await import('/knowledge-center/modules/dashboard/view.js');
      const root = document.createElement('main');
      const task = { id: 'domain/one', techDomainName: '数据库', domainLeaderName: '领域负责人', domainMembers: [{ id: 'author', name: '提交者' }, { id: 'author', name: '重复人员' }], items: [{ id: 'page-1', documentTitle: '部署指南', status: 'in_progress', assigneeId: '' }, { id: 'page-2', documentTitle: '参考手册', status: 'completed', assigneeId: 'author' }] };
      root.innerHTML = renderDashboard({ projection: { asOf: '2026-11-05T00:00:00Z' }, domainBuildTaskProjection: { tasks: [task] }, openDomainTaskId: 'domain/one' });
      const full = renderDashboard({ projection: { asOf: '2026-11-05T00:00:00Z', sections: {
        workbench: { status: 'ok', data: { counts: { pending: 2, review: 1, publishable: 3, failed: 0 } } },
        documents: { status: 'ok', data: { total: 5, roots: 2 } }, datasets: { status: 'ok', data: { total: 4 } },
        materialBatches: { status: 'ok', data: { total: 3, active: 1 } },
      } }, domainBuildTaskProjection: { tasks: [] } });
      const unavailable = renderDashboard({ projection: {}, domainBuildTaskProjection: { status: 'unavailable' } });
      return { heading: root.querySelector('.domain-task-summary-heading h4')?.textContent, pending: root.querySelector('.domain-task-summary-state')?.textContent, dialog: root.querySelector('[data-domain-task-dialog]')?.dataset.domainTaskDialog, options: root.querySelectorAll('[data-domain-task-assignee] option').length, selected: root.querySelector('[data-domain-task-assignee]')?.value, full, unavailable };
    });
    expect(dashboard).toMatchObject({ heading: '数据库', pending: '有待分派页面', dialog: 'domain/one', options: 4, selected: '' });
    expect(dashboard.full).toContain('当前待处理任务');
    expect(dashboard.full).toContain('2 个资产目录');
    expect(dashboard.full).toContain('1 个正在处理');
    expect(dashboard.unavailable).toContain('领域建设任务暂不可用');

    const trigger = await page.evaluate(() => { const button = document.createElement('button'); button.id = 'mr-trigger'; document.body.append(button); button.focus(); return true; });
    expect(trigger).toBeTruthy();
    const first = page.evaluate(async taskId => { const { chooseMRParticipants } = await import('/knowledge-center/modules/review-publishing/mr-participants.js'); window.__mrPromise = chooseMRParticipants(taskId, document.querySelector('#mr-trigger')); }, f.shared.id);
    await expect(page.locator('dialog[aria-label="创建 GitLab MR"]')).toBeVisible();
    await expect(page.locator('[data-mr-reviewers]')).toContainText('账号未映射');
    await expect(page.locator('select[name="assigneeId"]')).toBeEnabled();
    await page.locator('select[name="assigneeId"]').selectOption('author');
    await page.locator('dialog[aria-label="创建 GitLab MR"] [type="submit"]').click();
    await expect.poll(() => page.evaluate(() => window.__mrPromise)).toEqual({ assigneeId: 'author', expectedCandidateDigest: 'digest-1' });
    await expect(page.locator('#mr-trigger')).toBeFocused();
    await page.evaluate(async taskId => { const { chooseMRParticipants } = await import('/knowledge-center/modules/review-publishing/mr-participants.js'); window.__mrPromise = chooseMRParticipants(taskId, document.querySelector('#mr-trigger')); }, f.shared.id);
    await expect(page.locator('dialog[aria-label="创建 GitLab MR"]')).toBeVisible();
    await expect(page.locator('[data-mr-error]')).toContainText('人员映射不完整');
    await page.locator('[data-mr-cancel]').click();
    await page.evaluate(async taskId => { const { chooseMRParticipants } = await import('/knowledge-center/modules/review-publishing/mr-participants.js'); window.__mrPromise = chooseMRParticipants(taskId, document.querySelector('#mr-trigger')); }, f.shared.id);
    await expect(page.locator('[data-mr-error]')).toContainText('参与人服务不可用');
    await page.locator('[data-mr-cancel]').click();
    await first;

    const utilities = await page.evaluate(async () => {
      const { sha256Text } = await import('/knowledge-center/common/utils/sha256.js');
      const fallbackDigest = await sha256Text('abc', null);
      const nativeDigest = await sha256Text('abc', globalThis.crypto.subtle);
      const emptyDigest = await sha256Text(null, null);
      const { notifyKnowledgeDataChanged, onKnowledgeDataChanged } = await import('/knowledge-center/common/state/data-change.js');
      const events = [];
      const unsubscribe = onKnowledgeDataChanged(detail => events.push(detail.scopes));
      notifyKnowledgeDataChanged(['assets', 'assets', '', 'outlines'], 'coverage-test');
      window.dispatchEvent(new CustomEvent('knowledge-data-changed', { detail: { scopes: [] } }));
      window.dispatchEvent(new CustomEvent('knowledge-data-changed', { detail: { scopes: 'assets' } }));
      unsubscribe();
      notifyKnowledgeDataChanged('assets', 'after-unsubscribe');
      let emptyRejected = false;
      try { notifyKnowledgeDataChanged([]); } catch (error) { emptyRejected = error instanceof TypeError; }
      return { fallbackDigest, nativeDigest, emptyDigest, events, emptyRejected };
    });
    expect(utilities).toEqual({ fallbackDigest: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', nativeDigest: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', emptyDigest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', events: [['assets', 'outlines']], emptyRejected: true });

    const cleaningCalls = [];
    await page.route('**/knowledge-center/api/cleaning/**', async route => {
      const request = route.request(); const url = new URL(request.url());
      cleaningCalls.push({ method: request.method(), path: url.pathname, contentType: request.headers()['content-type'], idempotency: request.headers()['idempotency-key'] });
      if (url.pathname.endsWith('/index/stats')) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'INDEX_OFFLINE', message: '索引服务不可用' } }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: 'upload-response', status: 'ok' } }) });
    });
    const cleaning = await page.evaluate(async () => {
      const { loadCleaningWorkspace, createUploadSession, addUploadFile, uploadChunk, completeUploadFile, completeUploadSession, createUploadBatch } = await import('/knowledge-center/common/api/cleaning-api.js');
      const workspace = await loadCleaningWorkspace();
      const session = await createUploadSession({ idempotencyKey: 'upload-one', name: '导入资料' });
      const file = await addUploadFile('session/one', { name: 'a.md' });
      const chunk = await uploadChunk('session/one', 'file one', 2, 'chunk-content', { 'X-Chunk-SHA256': 'digest' });
      const completeFile = await completeUploadFile('session/one', 'file one');
      const completeSession = await completeUploadSession('session/one');
      const batch = await createUploadBatch('session/one', '业务资料');
      return { workspace, session, file, chunk, completeFile, completeSession, batch };
    });
    expect(cleaning.workspace.indexStats).toEqual({ status: 'unavailable', error: { code: 'INDEX_OFFLINE', message: '索引服务不可用' } });
    expect(cleaning.session.id).toBe('upload-response');
    expect(cleaningCalls.map(item => item.method)).toEqual(['GET', 'GET', 'GET', 'GET', 'POST', 'POST', 'PUT', 'POST', 'POST', 'POST']);
    expect(cleaningCalls.find(item => item.path.endsWith('/upload-sessions')).idempotency).toBe('upload-one');
    expect(cleaningCalls.find(item => item.path.endsWith('/chunks/2')).contentType).toBe('application/octet-stream');
    expect(cleaningCalls.some(item => item.path.endsWith('/upload-sessions/session%2Fone/files/file%20one/complete'))).toBe(true);
    const authBootstrap = await page.evaluate(async () => {
      const auth = await import('/knowledge-center/common/auth/auth-controller.js');
      const { authState } = await import('/knowledge-center/common/state/auth-state.js');
      const originalFetch = window.fetch;
      const originalAddress = `${location.pathname}${location.search}${location.hash}`;
      const calls = [];
      let mode = 'session';
      window.fetch = async input => {
        const path = new URL(input, location.origin).pathname;
        calls.push(path);
        if (mode === 'unauthorized' && path.endsWith('/session')) return new Response(JSON.stringify({ error: { code: 'AUTH_REQUIRED' } }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        if (mode === 'callback-error' && path.endsWith('/cas/callback')) return new Response(JSON.stringify({ error: { code: 'INVALID_TICKET' } }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        const data = path.endsWith('/config') ? { casEnabled: true, serviceId: 'fixture-service' }
          : path.endsWith('/session') ? { authenticated: true, user: { id: 'author' } }
          : { authenticated: true };
        return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };
      try {
        const statuses = [];
        const session = await auth.bootstrapAuth(status => statuses.push(status));
        mode = 'unauthorized';
        const unauthorized = await auth.bootstrapAuth();
        const unauthorizedState = authState.status;
        mode = 'callback';
        history.replaceState(history.state, '', '/knowledge-center/review?ticket=good');
        const callback = await auth.bootstrapAuth();
        const callbackAddress = `${location.pathname}${location.search}`;
        mode = 'callback-error';
        history.replaceState(history.state, '', '/knowledge-center/review?ticket=bad');
        const callbackError = await auth.bootstrapAuth();
        const errorState = authState.status;
        const errorAddress = `${location.pathname}${location.search}`;
        return { sessionUser: session?.user?.id, statuses, unauthorized, unauthorizedState, callbackAuthenticated: callback?.authenticated,
          callbackAddress, callbackError, errorState, errorAddress, calls };
      } finally {
        window.fetch = originalFetch;
        history.replaceState(history.state, '', originalAddress);
      }
    });
    expect(authBootstrap).toMatchObject({
      sessionUser: 'author', statuses: ['正在检查登录状态'], unauthorized: null, unauthorizedState: 'anonymous',
      callbackAuthenticated: true, callbackAddress: '/knowledge-center/review', callbackError: null,
      errorState: 'anonymous', errorAddress: '/knowledge-center/review',
    });
    expect(authBootstrap.calls.filter(path => path.endsWith('/cas/callback'))).toHaveLength(2);
  } finally { await f.close(); }
});

test('生产质量弹窗：报告分项、失败保留、复测下载与关闭焦点恢复', async ({ page }) => {
  const f = await fixture(page);
  try {
    let requestNumber = 0;
    const requestBodies = [];
    const report = {
      reportId: 'quality-report-1',
      document: { revisionId: 'revision-1', contentDigest: 'digest-1' },
      database: { environment: '隔离测试库', version: 'YashanDB 23.4' },
      gate: 'not_passed',
      coverage: { passed: 1, failed: 1, notExecuted: 1 },
      contentQuality: {
        checks: [
          { check: 'structure', status: 'passed', details: '结构完整' },
          { check: 'template', status: 'failed', details: '模板字段缺失' },
          { check: 'expression', status: 'not_executed', details: '未配置模型' },
          { check: 'custom-check', status: 'review', details: '需要人工复核' },
        ],
        issues: [{ severity: 'blocking', start: 0, end: 6, message: '补充前置条件', requirement: '列出适用版本' }],
        error: { code: 'CONTENT_PARTIAL' },
        limitations: ['本次未访问外部系统'],
      },
      cases: [
        {
          caseId: 'TC-1', status: 'passed', documentStart: 8, documentEnd: 20, source: '用例库',
          references: [{ sourceType: 'test-case-library', title: '连接检查', locator: 'cases/connect.md', sourceRange: { start: 0, end: 4 }, kind: 'direct_quote', sourceVersion: 'v2', fetchedAt: '2026-11-05T00:00:00Z' }],
          sql: 'select 1;', expected: '一行', actual: '一行', comparison: 'equal',
        },
        { caseId: 'TC-2', status: 'not_executed', documentStart: 24, documentEnd: 29, source: '手册', references: [], sql: 'select 2;' },
      ],
      limitations: ['报告供人工复核'],
      skillInvocations: [{ skillId: 'quality-check', status: 'completed' }],
    };
    await page.route('**/api/production/handbooks/HB-1/documents/doc-1/quality', async route => {
      requestBodies.push(JSON.parse(route.request().postData() || '{}'));
      requestNumber++;
      if (requestNumber === 2) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: '质量服务暂时不可用' } }) });
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: report }) });
    });
    await page.goto(`${f.base}/knowledge-center/review?view=documents&handbookId=HB-1`);
    await page.evaluate(async () => {
      const trigger = document.createElement('button');
      trigger.type = 'button'; trigger.textContent = '运行质量检查'; trigger.dataset.qualityFixtureTrigger = '';
      document.body.append(trigger); trigger.focus();
      const { openProductionQualityDialog } = await import('/knowledge-center/modules/production/production-quality-dialog.js');
      window.qualityDialog = openProductionQualityDialog({
        context: { handbookId: 'HB-1', documentId: 'doc-1', outlineVersionId: 'outline-1', branch: 'main' },
        markdown: '正文内容与前置条件', revisionId: 'revision-1', editVersion: 2, trigger,
      });
    });
    const dialog = page.locator('dialog.handbook-ai-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-quality-download]')).toBeDisabled();
    await dialog.locator('[data-quality-content]').check();
    await dialog.locator('[data-quality-run]').click();
    await expect(dialog.locator('[data-quality-status]')).toContainText('通过 1，失败 1，未执行 1');
    await expect(dialog.locator('[data-quality-report]')).toContainText('结构：通过；结构完整');
    await expect(dialog.locator('[data-quality-report]')).toContainText('模板：失败；模板字段缺失');
    await expect(dialog.locator('[data-quality-report]')).toContainText('内容检查未完成：CONTENT_PARTIAL');
    await expect(dialog.locator('[data-quality-report]')).toContainText('连接检查');
    await expect(dialog.locator('[data-quality-report]')).toContainText('无已保存的可核验引用关联');
    await expect(dialog.locator('[data-quality-report]')).toContainText('查看质量能力执行记录');
    await expect(dialog.locator('[data-quality-download]')).toBeEnabled();
    const download = page.waitForEvent('download');
    await dialog.locator('[data-quality-download]').click();
    expect((await download).suggestedFilename()).toBe('quality-report-1.json');

    await dialog.locator('[data-quality-run]').click();
    await expect(dialog.locator('[data-quality-status]')).toContainText('质量检查未完成：质量服务暂时不可用');
    await expect(dialog.locator('[data-quality-report]')).toContainText('quality-report-1');
    await expect(dialog.locator('[data-quality-download]')).toBeEnabled();

    await dialog.locator('[data-quality-content]').uncheck();
    await dialog.locator('[data-quality-run]').click();
    await expect(dialog.locator('[data-quality-status]')).toContainText('通过 1，失败 1，未执行 1');
    expect(requestBodies.map(body => body.checkContent)).toEqual([true, true, false]);
    expect(requestBodies[2].rerunOfReportId).toBe('quality-report-1');
    await dialog.locator('[data-quality-close]').click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('[data-quality-fixture-trigger]')).toBeFocused();
  } finally { await f.close(); }
});
