const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// This suite exercises the real authentication and incremental-build HTTP
// APIs. GitLab content is intentionally a controlled fixture because the
// production OAuth connector is not connected in the test environment.
const baseUrl = process.env.KPG_BASE_URL;
const evidenceDir = path.resolve(__dirname, '../../../runtime/test-results/navigation-pane-p0');
function evidencePath(name, browserName) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  return path.join(evidenceDir, `${name}-${browserName}.png`);
}
const repositoryMarkdown = '# 安装手册\n\n<span id="YFS" name="YFS">YFS 参数说明</span>\n\n## 参数说明\n\n1. 准备环境\n   - [x] 检查版本\n   - [ ] 核对端口\n\n> 数据库版本必须与参数依赖一致。\n\n| 参数 | 版本依赖 |\n| :--- | ---: |\n| YAS_PORT | **23.4** |\n\n---\n\n```sql\nSELECT 1;\n```';

async function login(api, username, password) {
  const response = await api.post(`${baseUrl}/knowledge-center/api/auth/admin/login`, { data: { username, password } });
  expect(response.ok()).toBeTruthy();
  return response;
}

async function call(api, method, path, data, key) {
  const response = await api.fetch(`${baseUrl}${path}`, {
    method,
    data,
    // Playwright retries ECONNRESET only; never repeat a mutation or HTTP error.
    maxRetries: method === 'GET' ? 1 : 0,
    headers: key ? { 'Idempotency-Key': key } : undefined,
  });
  const body = await response.json();
  expect(response.ok(), `${method} ${path}: ${JSON.stringify(body)}`).toBeTruthy();
  return body.data;
}

async function ensureBaseline(api) {
  let baselines = await call(api, 'GET', '/knowledge-center/api/incremental-tasks/baselines?handbookId=DB-001&businessVersion=23.4');
  let current = baselines.find(item => item.current)?.id;
  if (!current) {
    await call(api, 'POST', '/knowledge-center/api/incremental-tasks/bootstrap-baseline', {
      handbookId: 'DB-001', businessVersion: '23.4',
      content: '# 安装手册\n\n## 参数说明\n\nYAS_PORT 必须与数据库版本一致。',
      commitSha: 'e2e-bootstrap', filePath: 'doc/install.md', branch: 'master',
    }, `e2e-bootstrap-${Date.now()}`);
    baselines = await call(api, 'GET', '/knowledge-center/api/incremental-tasks/baselines?handbookId=DB-001&businessVersion=23.4');
    current = baselines.find(item => item.current)?.id;
  }
  expect(current).toBeTruthy();
  return current;
}

async function seedUnderReview(api) {
  await login(api, 'test', 'test');
  const baselineVersionId = await ensureBaseline(api);
  const task = await call(api, 'POST', '/knowledge-center/api/incremental-tasks', {
    name: `E2E 审核 ${Date.now()}`,
    handbookId: 'DB-001', businessVersion: '23.4', baselineVersionId,
  }, `e2e-create-${Date.now()}`);
  await call(api, 'POST', `/knowledge-center/api/incremental-tasks/${task.id}/sources`, {
    sourceType: 'manual', label: 'E2E 需求', reference: 'E2E-REVIEW', content: '核对安装参数和版本依赖',
  }, `e2e-source-${task.id}`);
  await call(api, 'PATCH', `/knowledge-center/api/incremental-tasks/${task.id}/target`, {
    documentIds: ['doc-install'], sectionIds: ['section-1'], language: 'zh-CN',
  }, `e2e-target-${task.id}`);
  await call(api, 'PUT', `/knowledge-center/api/incremental-tasks/${task.id}/draft`, {
    editVersion: 0, content: '# 安装手册\n\n新增参数说明',
    operations: [{ type: 'update', documentId: 'doc-install', nodeId: 'section-1', beforeDigest: 'before-digest', after: { content: '新增参数说明' } }],
  }, `e2e-draft-${task.id}`);
  await call(api, 'POST', `/knowledge-center/api/incremental-tasks/${task.id}/checks`, {}, `e2e-checks-${task.id}`);
  const candidate = await call(api, 'POST', `/knowledge-center/api/incremental-tasks/${task.id}/candidate`, {}, `e2e-candidate-${task.id}`);
  const review = await call(api, 'POST', `/knowledge-center/api/incremental-tasks/${task.id}/reviews`, {}, `e2e-review-${task.id}`);
  return { task, candidate, review };
}

async function seedCandidateReady(api) {
  await login(api, 'test', 'test');
  const baselineVersionId = await ensureBaseline(api);
  const task = await call(api, 'POST', '/knowledge-center/api/incremental-tasks', {
    name: `E2E 待提交候选 ${Date.now()}`,
    handbookId: 'DB-001', businessVersion: '23.4', baselineVersionId,
  }, `e2e-direct-create-${Date.now()}`);
  await call(api, 'POST', `/knowledge-center/api/incremental-tasks/${task.id}/sources`, {
    sourceType: 'manual', label: 'E2E 需求', reference: 'E2E-DIRECT', content: '验证审核任务深链接',
  }, `e2e-direct-source-${task.id}`);
  await call(api, 'PATCH', `/knowledge-center/api/incremental-tasks/${task.id}/target`, {
    documentIds: ['doc-install'], sectionIds: ['section-1'], language: 'zh-CN',
  }, `e2e-direct-target-${task.id}`);
  await call(api, 'PUT', `/knowledge-center/api/incremental-tasks/${task.id}/draft`, {
    editVersion: 0, content: '# 安装手册\n\n候选内容',
    operations: [{ type: 'update', documentId: 'doc-install', nodeId: 'section-1', beforeDigest: 'before-digest', after: { content: '候选内容' } }],
  }, `e2e-direct-draft-${task.id}`);
  await call(api, 'POST', `/knowledge-center/api/incremental-tasks/${task.id}/checks`, {}, `e2e-direct-checks-${task.id}`);
  await call(api, 'POST', `/knowledge-center/api/incremental-tasks/${task.id}/candidate`, {}, `e2e-direct-candidate-${task.id}`);
  return task;
}

async function installGitLabFixture(page) {
  await page.route('**/knowledge-center/api/gitlab/handbooks/DB-001/commits**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [{ sha: 'abcdef123456', shortSha: 'abcdef12', title: 'E2E 安装手册基线', authorName: 'E2E', authoredDate: '2026-09-06T10:00:00.000Z' }] }),
  }));
  await page.route('**/knowledge-center/api/gitlab/handbooks/DB-001/file**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { path: 'doc/install.md', content: repositoryMarkdown, commitId: 'abcdef123456', updatedAt: '2026-09-06T10:00:00.000Z' } }),
  }));
  await page.route('**/knowledge-center/api/review/repository-context**', route => {
    const requestUrl = new URL(route.request().url());
    const handbookId = requestUrl.searchParams.get('handbookId') || 'DB-001';
    const branch = requestUrl.searchParams.get('branch') || 'master';
    const language = requestUrl.searchParams.get('language') === 'en' ? 'en' : 'zh';
    const file = { path: 'doc/install.md', content: repositoryMarkdown, commitId: 'abcdef123456', updatedAt: '2026-09-06T10:00:00.000Z' };
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {
        status: 'ok', handbookId,
        handbookName: handbookId === 'DB-001' ? '产品描述手册' : handbookId,
        connectionName: 'E2E GitLab', project: 'cod-doc/yasdoc',
        languages: { zh: true, en: true },
        branches: [{ name: 'master' }, { name: 'br23.4' }], branch, language,
        tree: [{ type: 'tree', name: 'doc', path: 'doc' }, { type: 'blob', name: 'install.md', path: 'doc/install.md' }],
        file, requestedPath: file.path, commitSha: file.commitId, updatedAt: file.updatedAt,
      } }),
    });
  });
}

async function isolateInitialEmptyReview(page, handbookId = 'DB-001', { withoutBaseline = false } = {}) {
  await page.route('**/knowledge-center/api/review/bootstrap**', async route => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.data = { ...payload.data, items: [], allItems: [], detail: null, handbookId, workbench: { ...payload.data.workbench, documents: [], mine: [] } };
    // This scenario starts before the first baseline; other suites may have
    // legitimately created versions for this handbook in the shared database.
    if (withoutBaseline) Object.assign(payload.data, { onlineReviewBaselines: [], onlineReviewBaselineError: null });
    await route.fulfill({ response, json: payload });
  }, { times: 1 });
}

test.describe('审核与发布多角色 E2E', () => {
  test('P0：审核阅读目录支持调宽、取消回退、刷新后重新增强和移动端单列', async ({ page, browserName }, testInfo) => {
    await login(page.context().request, 'admin', 'admin');
    await installGitLabFixture(page);
    await isolateInitialEmptyReview(page);
    await page.goto(`${baseUrl}/knowledge-center/review?view=reader&handbookId=DB-001&showAll=1`);
    let layout = page.locator('[data-navigation-layout-id="review"]');
    let handle = layout.locator('[data-navigation-pane-resizer]');
    await expect(handle).toBeVisible();
    const initial = Number(await handle.getAttribute('aria-valuenow'));
    const layoutBox = await layout.boundingBox();
    const handleBox = await handle.boundingBox();
    expect(layoutBox).toBeTruthy();
    expect(handleBox).toBeTruthy();
    await handle.evaluate((element, coordinates) => {
      element.setPointerCapture = () => {};
      element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 80, button: 0, clientX: coordinates.startX, clientY: coordinates.y }));
      element.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 80, button: 0, clientX: coordinates.endX, clientY: coordinates.y }));
      element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 80, button: 0, clientX: coordinates.endX, clientY: coordinates.y }));
    }, { startX: layoutBox.x + initial, endX: layoutBox.x + initial + 32, y: handleBox.y + handleBox.height / 2 });
    const committed = Number(await handle.getAttribute('aria-valuenow'));
    expect(committed).toBeGreaterThan(initial);

    await handle.evaluate((element, coordinates) => {
      element.setPointerCapture = () => {};
      element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 81, button: 0, clientX: coordinates.startX, clientY: coordinates.y }));
      element.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 81, button: 0, clientX: coordinates.endX, clientY: coordinates.y }));
    }, { startX: layoutBox.x + committed, endX: layoutBox.x + committed + 40, y: handleBox.y + handleBox.height / 2 });
    await handle.focus();
    await page.keyboard.press('Escape');
    await expect(handle).toHaveAttribute('aria-valuenow', String(committed));

    await page.locator('.review-reader-controls .review-more-menu > summary').click();
    await page.getByRole('button', { name: '刷新阅读' }).click();
    layout = page.locator('[data-navigation-layout-id="review"]');
    handle = layout.locator('[data-navigation-pane-resizer]');
    await expect(handle).toBeVisible();
    await handle.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(handle).toHaveAttribute('aria-valuenow', String(Math.max(220, committed - 16)));

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(layout.locator('[data-navigation-pane-resizer]')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    const directoryBox = await layout.locator('[data-navigation-pane]').boundingBox();
    const contentBox = await layout.locator('.review-document-content').boundingBox();
    const responsiveMetrics = await page.evaluate(() => {
      const selectors = ['.review-main-grid', '.review-main-grid > div:first-child', '.review-reading-layout', '.review-document-tree', '.review-document-content', '.review-evidence-column'];
      return Object.fromEntries(selectors.map(selector => {
        const element = document.querySelector(selector);
        if (!element) return [selector, null];
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return [selector, { width: box.width, display: style.display, gridTemplateColumns: style.gridTemplateColumns, minWidth: style.minWidth }];
      }));
    });
    expect(directoryBox?.width || 0).toBeGreaterThan(220);
    expect(contentBox?.width || 0, JSON.stringify(responsiveMetrics)).toBeGreaterThan(220);
    expect(await layout.locator('.review-document-content').evaluate(element => getComputedStyle(element).writingMode)).toBe('horizontal-tb');
    const mobileScreenshot = await page.screenshot({ fullPage: true, path: evidencePath('review-mobile', browserName) });
    await testInfo.attach('审核阅读目录移动端', {
      body: mobileScreenshot,
      contentType: 'image/png',
    });
  });

  test('显式手册阅读入口无待办时仍可读取仓库完整正文', async ({ page }) => {
    await login(page.context().request, 'admin', 'admin');
    await installGitLabFixture(page);
    await isolateInitialEmptyReview(page);
    await page.goto(`${baseUrl}/knowledge-center/review?view=reader&handbookId=DB-001&showAll=1`);
    await expect(page.getByRole('heading', { name: '产品描述手册' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '尚无待审核修改稿' })).toBeVisible();
    await expect(page.getByText('YAS_PORT')).toBeVisible();
    await expect(page.getByText('准备环境')).toBeVisible();
    await expect(page.locator('.repository-markdown input[type="checkbox"]')).toHaveCount(2);
    await expect(page.locator('blockquote')).toContainText('数据库版本');
    await expect(page.locator('hr')).toHaveCount(1);
    await expect(page.locator('pre[data-language="sql"]')).toContainText('SELECT 1');
    await expect(page.locator('.repository-markdown #YFS[name="YFS"]')).toHaveCount(1);
    await expect(page.locator('.repository-markdown')).not.toContainText('<span id="YFS"');
    await expect(page.getByText('当前没有待处理审核事项')).toHaveCount(0);
  });

  test('手册无候选时保留阅读工作台并提供发起评审入口', async ({ page }) => {
    await login(page.context().request, 'admin', 'admin');
    await installGitLabFixture(page);
    await page.goto(`${baseUrl}/knowledge-center/review?view=reader&handbookId=DB-NOT-FOUND&showAll=1`);
    await expect(page.getByRole('heading', { name: 'DB-NOT-FOUND' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '尚无待审核修改稿' })).toBeVisible();
    await expect(page.getByRole('link', { name: '前往文档生产' })).toHaveAttribute('href', '/knowledge-center/production?handbookId=DB-NOT-FOUND');
    await expect(page.locator('.review-workspace')).toHaveCount(1);
    await expect(page.locator('.review-document-content')).toHaveCount(1);
    await expect(page.getByRole('button', { name: '2 查看修改' })).toHaveCount(0);
    await expect(page.getByText('正文阅读', { exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('unknown');
    await expect(page.locator('body')).not.toContainText('未返回');
  });

  test('指定任务深链接优先读取详情，不受活动状态列表过滤', async ({ page, request }) => {
    const task = await seedCandidateReady(request);
    await login(page.context().request, 'test', 'test');
    await installGitLabFixture(page);
    await page.goto(`${baseUrl}/knowledge-center/review?taskId=${encodeURIComponent(task.id)}&handbookId=DB-001&showAll=1`);
    await expect(page.locator('#view-root').getByRole('heading', { name: task.name })).toBeVisible();
    await expect(page.getByText('当前没有待处理审核事项')).toHaveCount(0);
    await expect(page.getByText('YAS_PORT')).toBeVisible();
  });

  test('存量手册阅读页提供当前文档编辑送审入口，不直接创建无差异快照', async ({ page }) => {
    await login(page.context().request, 'test', 'test');
    await installGitLabFixture(page);
    await isolateInitialEmptyReview(page, 'DB-001', { withoutBaseline: true });
    await page.goto(`${baseUrl}/knowledge-center/review?view=reader&handbookId=DB-001&showAll=1`);

    await expect(page.getByText('YAS_PORT')).toBeVisible();
    const entry = page.getByRole('link', { name: '进入编写' });
    await expect(entry).toHaveAttribute('href', /\/knowledge-center\/production\/handbook\/DB-001\?reviewPath=doc%2Finstall\.md&branch=master/);
    await expect(page.getByRole('button', { name: '发起在线评审' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: '发起在线评审' })).toHaveCount(0);
    const before = await call(page.context().request, 'GET', '/knowledge-center/api/incremental-tasks?handbookId=DB-001');
    await entry.click();
    await expect(page).toHaveURL(/\/knowledge-center\/production\/handbook\/DB-001/);
    await expect(page).toHaveURL(/reviewPath=doc%2Finstall\.md/);
    const after = await call(page.context().request, 'GET', '/knowledge-center/api/incremental-tasks?handbookId=DB-001');
    expect(after.map(item => item.id)).toEqual(before.map(item => item.id));
  });

  test('阅读、差异、行级意见、审核和发布均由真实后端驱动', async ({ page, request }) => {
    test.setTimeout(60000);
    const seeded = await seedUnderReview(request);
    await login(page.context().request, 'admin', 'admin');
    await installGitLabFixture(page);
    await page.goto(`${baseUrl}/knowledge-center/review?taskId=${encodeURIComponent(seeded.task.id)}&handbookId=DB-001&step=read&showAll=1`);

    await expect(page.locator('#view-root').getByRole('heading', { name: seeded.task.name })).toBeVisible();
    await expect(page.locator('.review-reading-layout')).toBeVisible();
    await expect(page.getByText('安装手册')).toBeVisible();
    await expect(page.getByText('YAS_PORT')).toBeVisible();
    await expect(page.locator('code').filter({ hasText: 'SELECT 1' })).toBeVisible();
    const resizer = page.getByRole('separator', { name: '调整文档目录宽度' });
    await resizer.focus();
    await resizer.press('ArrowRight');
    await expect(resizer).toHaveAttribute('aria-valuenow', '276');
    await expect(page.locator('.review-reading-layout')).toHaveClass(/density-comfortable/);
    await expect(page.getByRole('button', { name: 'English' })).toBeVisible();
    await expect(page.getByRole('button', { name: '专注阅读' })).toBeVisible();
    await page.getByRole('button', { name: '专注阅读' }).click();
    await expect(page.locator('body')).toHaveClass(/review-focus-mode/);
    await expect(page.locator('#sidebar')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/review-focus-mode/);
    const expandedWidth = await page.locator('.review-document-content').evaluate(element => element.getBoundingClientRect().width);
    const directoryToggle = page.getByRole('button', { name: '收起文档目录' });
    await expect(directoryToggle).toHaveAttribute('aria-expanded', 'true');
    await directoryToggle.click();
    await expect(page.getByRole('button', { name: '展开文档目录' })).toHaveAttribute('aria-expanded', 'false');
    const collapsedWidth = await page.locator('.review-document-content').evaluate(element => element.getBoundingClientRect().width);
    expect(collapsedWidth).toBeGreaterThan(expandedWidth + 150);
    await page.reload();
    await expect(page.getByRole('button', { name: '展开文档目录' })).toBeVisible();
    await page.getByRole('button', { name: '展开文档目录' }).click();
    await expect(page.locator('.review-evidence-drawer')).not.toHaveAttribute('open', '');
    const finalEvidenceDrawer = page.locator('.review-evidence-drawer');
    if (await finalEvidenceDrawer.getAttribute('open') === null) await finalEvidenceDrawer.locator(':scope > summary').click();
    await expect(page.locator('[data-role-card="reader"]')).toContainText('可用');
    await expect(page.locator('[data-role-card="reviewer"]')).toContainText('可用');
    await expect(page.locator('[data-role-card="publisher"]')).toContainText('不可用');

    await page.locator('.review-steps [data-review-step="opinions"]').click();
    await expect(page.getByRole('heading', { name: '当前没有审核意见' })).toBeVisible();
    await expect(page.getByRole('button', { name: '查看修改并添加意见' })).toBeVisible();

    await page.locator('.review-steps [data-review-step="diff"]').click();
    await expect(page.getByText('修改前后全文对照')).toBeVisible();
    await page.keyboard.press('j');
    await expect(page.locator('[data-review-line].keyboard-current')).toHaveCount(1);
    await page.locator('[data-review-line="1"]').click();
    await expect(page.locator('[data-review-anchor-status]').filter({ hasText: '已定位第 1 行' })).toBeVisible();
    const activeCommentForm = page.locator('[data-review-comment-form]:visible').first();
    await activeCommentForm.locator('textarea').fill('请核对 23.4 参数依赖');
    await activeCommentForm.getByRole('button', { name: '提交意见' }).click();
    await page.locator('.review-steps [data-review-step="opinions"]').click();
    const opinion = page.locator('[data-review-opinion]').filter({ hasText: '请核对 23.4 参数依赖' });
    await expect(opinion).toBeVisible();
    await expect(opinion.getByRole('button', { name: '回复' })).toBeVisible();
    await expect(opinion.getByRole('button', { name: '标记已处理' })).toBeVisible();
    await opinion.getByRole('button', { name: '回复' }).click();
    await opinion.getByRole('textbox', { name: '回复内容' }).fill('已核对 23.4 参数规则，修改说明准确。');
    await opinion.getByRole('button', { name: '发送回复' }).click();
    await expect(page.getByText('已核对 23.4 参数规则，修改说明准确。')).toBeVisible();
    await opinion.getByRole('button', { name: '标记已处理' }).click();
    await expect(opinion.getByText('已处理')).toBeVisible();
    await expect(opinion.getByRole('button', { name: '重新打开' })).toBeVisible();
    await opinion.getByRole('button', { name: '重新打开' }).click();
    await expect(opinion.getByText('待处理')).toBeVisible();
    const decisionEvidenceDrawer = page.locator('.review-evidence-drawer');
    if (await decisionEvidenceDrawer.getAttribute('open') === null) await decisionEvidenceDrawer.locator(':scope > summary').click();
    await expect(page.getByRole('heading', { name: '角色与门禁' })).toBeVisible();
    await expect(page.getByText(/数据库语法、参数依赖、版本适配、错误码和运维命令专项检查尚未执行/)).toBeVisible();
    await expect(page.getByText(/暂无真实 AI 分析结果/)).toBeVisible();
    await expect(page.getByText('候选冻结')).toBeVisible();
    await expect(page.getByRole('heading', { name: '审核历史' })).toBeVisible();
    await page.keyboard.press(']');
    await expect(page.locator('.review-opinion.keyboard-current')).toHaveCount(1);

    await page.getByRole('button', { name: '审核通过' }).click();
    await expect(page.getByRole('button', { name: '确认发布' })).toBeVisible();

    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '确认发布' }).click();
    await expect(page.locator(`[data-review-task="${seeded.task.id}"]`)).toHaveCount(0);

    const detail = await call(page.context().request, 'GET', `/knowledge-center/api/incremental-tasks/${seeded.task.id}`);
    expect(detail.state).toBe('published');
    expect(detail.publication.candidateDigest).toBe(seeded.candidate.digest);
  });

  test('只读阅读角色不能看到审核或发布动作，且多断点无横向溢出', async ({ page, request }) => {
    const seeded = await seedUnderReview(request);
    await login(page.context().request, 'test', 'test');
    await installGitLabFixture(page);
    await page.goto(`${baseUrl}/knowledge-center/review?taskId=${encodeURIComponent(seeded.task.id)}&handbookId=DB-001&showAll=1`);
    await expect(page.locator('[data-role-card="reviewer"]')).toContainText('不可用');
    await expect(page.locator('[data-role-card="publisher"]')).toContainText('不可用');
    await page.locator('.review-steps [data-review-step="opinions"]').click();
    await expect(page.getByRole('button', { name: '审核通过' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '确认发布' })).toHaveCount(0);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 375, height: 812 }]) {
      await page.setViewportSize(viewport);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${viewport.width}px 出现横向溢出`).toBeLessThanOrEqual(1);
    }
  });
});
