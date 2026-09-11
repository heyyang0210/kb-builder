const { test, expect } = require('@playwright/test');

// This suite exercises the real authentication and incremental-build HTTP
// APIs. GitLab content is intentionally a controlled fixture because the
// production OAuth connector is not connected in the test environment.
const baseUrl = process.env.KPG_BASE_URL || 'http://127.0.0.1:13510';

async function login(api, username, password) {
  const response = await api.post(`${baseUrl}/knowledge-center/api/auth/admin/login`, { data: { username, password } });
  expect(response.ok()).toBeTruthy();
  return response;
}

async function call(api, method, path, data, key) {
  const response = await api.fetch(`${baseUrl}${path}`, {
    method,
    data,
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
  await page.route('**/knowledge-center/api/gitlab/handbooks/DB-001/access-status', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { canRead: true, connected: true } }),
  }));
  await page.route('**/knowledge-center/api/gitlab/handbooks/DB-001/branches', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { defaultBranch: 'master', branches: [{ name: 'master' }, { name: 'br23.4' }] } }),
  }));
  await page.route('**/knowledge-center/api/gitlab/handbooks/DB-001/tree**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [{ type: 'tree', name: 'doc', path: 'doc' }, { type: 'blob', name: 'install.md', path: 'doc/install.md' }] }),
  }));
  await page.route('**/knowledge-center/api/gitlab/handbooks/DB-001/file**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { path: 'doc/install.md', content: '# 安装手册\n\n<span id="YFS" name="YFS">YFS 参数说明</span>\n\n## 参数说明\n\n1. 准备环境\n   - [x] 检查版本\n   - [ ] 核对端口\n\n> 数据库版本必须与参数依赖一致。\n\n| 参数 | 版本依赖 |\n| :--- | ---: |\n| YAS_PORT | **23.4** |\n\n---\n\n```sql\nSELECT 1;\n```', commitId: 'abcdef123456', updatedAt: '2026-09-06T10:00:00.000Z' } }),
  }));
}

test.describe('审核与发布多角色 E2E', () => {
  test('全局入口无待办时自动进入可见手册阅读工作台', async ({ page }) => {
    await login(page.context().request, 'admin', 'admin');
    await installGitLabFixture(page);
    await page.goto(`${baseUrl}/knowledge-center/review`);
    await expect(page.locator('#app-shell')).toHaveClass(/sidebar-collapsed/);
    await expect(page.getByRole('heading', { name: '产品描述手册' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '尚无待审核修改稿' })).toBeVisible();
    await expect(page.getByText('YAS_PORT')).toBeVisible();
    await expect(page.getByText('准备环境')).toBeVisible();
    await expect(page.locator('input[type="checkbox"]')).toHaveCount(2);
    await expect(page.locator('blockquote')).toContainText('数据库版本');
    await expect(page.locator('hr')).toHaveCount(1);
    await expect(page.locator('pre[data-language="sql"]')).toContainText('SELECT 1');
    await expect(page.locator('.repository-markdown #YFS[name="YFS"]')).toHaveCount(1);
    await expect(page.locator('.repository-markdown')).not.toContainText('<span id="YFS"');
    await expect(page.getByRole('combobox', { name: '当前手册' })).toHaveValue('DB-001');
    await expect(page.getByText('当前没有待处理审核事项')).toHaveCount(0);
  });

  test('手册无候选时保留阅读工作台并提供发起评审入口', async ({ page }) => {
    await login(page.context().request, 'admin', 'admin');
    await installGitLabFixture(page);
    await page.goto(`${baseUrl}/knowledge-center/review?handbookId=DB-NOT-FOUND`);
    await expect(page.getByRole('heading', { name: 'DB-NOT-FOUND' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '尚无待审核修改稿' })).toBeVisible();
    await expect(page.getByRole('link', { name: '前往文档生产' })).toHaveAttribute('href', '/knowledge-center/production?handbookId=DB-NOT-FOUND');
    await expect(page.locator('.review-workspace')).toHaveCount(1);
    await expect(page.locator('.review-document-content')).toHaveCount(1);
    await expect(page.getByRole('button', { name: '2 查看修改' })).toBeDisabled();
    await expect(page.locator('body')).not.toContainText('unknown');
    await expect(page.locator('body')).not.toContainText('未返回');
  });

  test('指定任务深链接优先读取详情，不受活动状态列表过滤', async ({ page, request }) => {
    const task = await seedCandidateReady(request);
    await login(page.context().request, 'test', 'test');
    await installGitLabFixture(page);
    await page.goto(`${baseUrl}/knowledge-center/review?taskId=${encodeURIComponent(task.id)}&handbookId=DB-001`);
    await expect(page.locator('#view-root').getByRole('heading', { name: task.name })).toBeVisible();
    await expect(page.getByText('当前没有待处理审核事项')).toHaveCount(0);
    await expect(page.getByText('YAS_PORT')).toBeVisible();
  });

  test('存量手册可从阅读页发起在线评审，并对快照提出行级意见', async ({ page }) => {
    await login(page.context().request, 'test', 'test');
    await installGitLabFixture(page);
    await page.goto(`${baseUrl}/knowledge-center/review?handbookId=DB-001`);

    await page.getByRole('button', { name: '发起在线评审' }).click();
    const dialog = page.getByRole('dialog', { name: '发起在线评审' });
    await expect(dialog.getByText('产品', { exact: true })).toBeVisible();
    await expect(dialog.getByText('YashanDB')).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: '当前正式版本' })).toHaveValue('v1');
    await expect(dialog.getByRole('radio', { name: /当前文档/ })).toBeChecked();
    await dialog.getByRole('textbox', { name: '评审说明（可选）' }).fill('核对 23.4 参数依赖与运维命令');
    await dialog.getByRole('button', { name: '创建评审快照' }).click();

    await expect(page).toHaveURL(/taskId=inc_/);
    await expect(page).toHaveURL(/step=read/);
    const taskId = new URL(page.url()).searchParams.get('taskId');
    expect(taskId).toBeTruthy();
    const task = await call(page.context().request, 'GET', `/knowledge-center/api/incremental-tasks/${taskId}`);
    expect(task).toMatchObject({
      id: taskId,
      state: 'under_review',
      reviewMode: 'online_review',
      target: { scope: 'document', documentIds: ['doc/install.md'] },
      candidate: { snapshotOfPublishedVersionId: 'v1', operations: [] },
    });

    await expect(page.locator('#view-root').getByRole('heading', { name: task.name })).toBeVisible();
    await expect(page.locator('[data-review-document-id="doc/install.md"]')).toHaveCount(1);
    await expect(page.getByText('当前显示正式版本评审快照')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'YashanDB 产品描述手册' })).toBeVisible();
    await expect(page.getByText('准备环境')).toHaveCount(0);
    await page.locator('#YFS').evaluate(element => {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    const bubble = page.locator('[data-review-selection-bubble]');
    await expect(bubble).toBeVisible();
    await bubble.getByRole('button', { name: '对选中文字提出意见' }).click();
    const inlineForm = page.locator('[data-review-inline-form]');
    await expect(inlineForm).toBeVisible();
    await expect(inlineForm.locator('.review-inline-input-quote')).toContainText('YFS 参数说明');
    await inlineForm.locator('textarea[name="comment"]').fill('请核对 YFS 参数说明的版本依赖。');
    await inlineForm.getByRole('button', { name: '提交意见' }).click();
    await expect(page.locator('[data-review-inline-form]')).toHaveCount(0);
    await page.getByRole('button', { name: /3 处理审核意见/ }).click();
    await expect(page.getByText('请核对 YFS 参数说明的版本依赖。')).toBeVisible();
  });

  test('阅读、差异、行级意见、审核和发布均由真实后端驱动', async ({ page, request }) => {
    const seeded = await seedUnderReview(request);
    await login(page.context().request, 'admin', 'admin');
    await installGitLabFixture(page);
    await page.goto(`${baseUrl}/knowledge-center/review?taskId=${encodeURIComponent(seeded.task.id)}&handbookId=DB-001&step=read`);

    await expect(page.locator('#view-root').getByRole('heading', { name: seeded.task.name })).toBeVisible();
    await expect(page.getByText('待审核版本：修改稿')).toBeVisible();
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
    await page.locator('.review-evidence-drawer > summary').click();
    await expect(page.locator('[data-role-card="reader"]')).toContainText('可用');
    await expect(page.locator('[data-role-card="reviewer"]')).toContainText('可用');
    await expect(page.locator('[data-role-card="publisher"]')).toContainText('不可用');

    await page.getByRole('button', { name: /3 处理审核意见/ }).click();
    await expect(page.getByRole('heading', { name: '当前没有审核意见' })).toBeVisible();
    await expect(page.getByRole('button', { name: '查看修改并添加意见' })).toBeVisible();

    await page.getByRole('button', { name: '2 查看修改' }).click();
    await expect(page.getByText('修改前后全文对照')).toBeVisible();
    await page.keyboard.press('j');
    await expect(page.locator('[data-review-line].keyboard-current')).toHaveCount(1);
    await page.locator('[data-review-line="1"]').click();
    await expect(page.locator('[data-review-anchor-status]').filter({ hasText: '已定位第 1 行' })).toBeVisible();
    const activeCommentForm = page.locator('[data-review-comment-form]:visible').first();
    await activeCommentForm.locator('textarea').fill('请核对 23.4 参数依赖');
    await activeCommentForm.getByRole('button', { name: '提交意见' }).click();
    await page.getByRole('button', { name: '3 处理审核意见' }).click();
    await expect(page.getByText('请核对 23.4 参数依赖')).toBeVisible();
    const opinion = page.locator('[data-review-opinion]').filter({ hasText: '请核对 23.4 参数依赖' });
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
    await page.locator('.review-evidence-drawer > summary').click();
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
    await page.goto(`${baseUrl}/knowledge-center/review?taskId=${encodeURIComponent(seeded.task.id)}&handbookId=DB-001`);
    await expect(page.locator('[data-role-card="reviewer"]')).toContainText('不可用');
    await expect(page.locator('[data-role-card="publisher"]')).toContainText('不可用');
    await page.getByRole('button', { name: '3 处理审核意见' }).click();
    await expect(page.getByRole('button', { name: '审核通过' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '确认发布' })).toHaveCount(0);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 375, height: 812 }]) {
      await page.setViewportSize(viewport);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${viewport.width}px 出现横向溢出`).toBeLessThanOrEqual(1);
    }
  });
});
