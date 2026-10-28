const { test, expect } = require('@playwright/test');

const baseUrl = process.env.KPG_BASE_URL;

// 手册生产列表按已发布大纲目录过滤；列表/抽屉测试同时提供匹配的大纲前提，
// 避免只替换资产而意外依赖运行环境的真实大纲数据。
async function mockPublishedProductionOutline(page, handbookId) {
  await page.route('**/knowledge-center/api/outline/catalog', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { items: [{ id: `outline-${handbookId}`, handbookId, state: 'published' }], total: 1, snapshotVersion: 'production-regression-fixture' } }),
  }));
}

test.beforeEach(async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/`);
  await expect(page.locator('#app-shell:not([hidden]), #auth-shell:not([hidden])')).toBeVisible();
  const adminLogin = page.locator('#admin-login-details > summary');
  if (await adminLogin.isVisible().catch(() => false)) {
    await adminLogin.click();
    await page.getByLabel('管理员账号').fill('admin');
    await page.getByLabel('管理员密码').fill('admin');
    await page.getByRole('button', { name: '登录平台管理' }).click();
    await expect(page).toHaveURL(`${baseUrl}/knowledge-center/platform`);
  }
});

test('增量任务展示真实状态、范围、草稿和检查结果', async ({ page }) => {
  const task = {
    id: 'inc-e2e', name: '更新安装说明', handbookId: 'DB-001', businessVersion: '23.4.5.100', baselineVersionId: 'baseline-v1', state: 'checked',
    sourceSnapshots: [{ id: 'src-1', sourceType: 'manual', label: 'SR 安装变更', reference: 'SR-100' }],
    target: { documentIds: ['doc-install'], sectionIds: ['section-1'], language: 'zh-CN' },
    draft: { editVersion: 1, content: '# 新安装步骤', operations: [{ type: 'update' }] },
    checks: { passed: true, issues: [] }, reviews: [], publication: null, externalEvidence: [], updatedAt: '2026-09-02T10:00:00.000Z',
  };
  await page.route('**/knowledge-center/api/incremental-tasks', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [task] }) }));
  await page.route('**/knowledge-center/api/incremental-tasks/inc-e2e', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: task }) }));
  await page.goto(`${baseUrl}/knowledge-center/production?taskId=inc-e2e`);
  await expect(page.getByRole('heading', { name: '更新安装说明' })).toBeVisible();
  await expect(page.getByText('完整性已检查', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('SR 安装变更')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '本次修改内容' })).toHaveValue('# 新安装步骤');
  await expect(page.getByRole('button', { name: '提交候选版本' })).toBeVisible();
});

test('服务失败时明确告知且移动端无横向溢出', async ({ page }) => {
  await page.route('**/knowledge-center/api/incremental-tasks', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'UNAVAILABLE', message: '增量服务暂时不可用' } }) }));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${baseUrl}/knowledge-center/production?view=tasks`);
  await expect(page.locator('.incremental-list-state.error').getByText('增量服务暂时不可用').first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('文档生产入口读取真实增量任务列表而非演示数据', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/production`);
  await expect(page.locator('#view-root')).toContainText(/增量任务|暂无|服务暂时不可用/);
  await expect(page.locator('#view-root')).not.toContainText('演示数据');
});

test('文档生产默认展示手册视图，任务视图继续提供增量工作区', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/production`);
  await expect(page.getByRole('tab', { name: '手册视图' })).toHaveAttribute('aria-selected', 'true');
  const generatorEntry = page.locator('a[href="/document-generation-workbench.html"]');
  await expect(generatorEntry).toHaveCount(1);
  await expect(generatorEntry).toHaveAttribute('target', '_blank');
  await expect(generatorEntry).toContainText('文档生成工作台');
  await page.getByRole('tab', { name: '任务视图' }).click();
  await expect(page.getByRole('tab', { name: '任务视图' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.incremental-sidebar')).toBeVisible();
  await expect(page.locator('.incremental-sidebar')).toContainText('增量任务');
});

test('数据库版本视图按版本汇总任务和目标文档，并复用完成投影', async ({ page }) => {
  await page.route('**/knowledge-center/api/incremental-tasks*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [
      { id: 'version-task-1', handbookId: 'DB-001', handbookName: '安装手册', businessVersion: '23.4', ownerName: '张三', target: { documentIds: ['d1', 'd2', 'd3', 'd4'] }, completion: { status: 'pending', label: '待合并回读', facts: { mergeState: 'opened' } }, updatedAt: '2026-09-28T08:00:00.000Z' },
      { id: 'version-task-2', handbookId: 'DB-001', handbookName: '安装手册', businessVersion: '23.4', target: { documentIds: ['d1'] }, completion: { status: 'completed', label: '已完成' }, updatedAt: '2026-09-28T09:00:00.000Z' },
      { id: 'version-task-3', handbookId: 'DB-002', handbookName: '运维手册', businessVersion: '24.1', ownerName: '李四', target: { documentIds: ['d9'] }, completion: { status: 'pending', label: '待合并回读', facts: { mergeState: 'opened' } }, updatedAt: '2026-09-28T10:00:00.000Z' },
    ] }),
  }));
  await page.route('**/knowledge-center/api/outline/catalog', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { items: [{ id: 'outline-1', handbookId: 'DB-001', state: 'published' }, { id: 'outline-2', handbookId: 'DB-002', state: 'published' }] } }),
  }));
  await page.goto(`${baseUrl}/knowledge-center/production?view=versions`);
  await expect(page.getByRole('tab', { name: '数据库版本' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.production-version-overview')).toContainText('23.4');
  await expect(page.locator('.production-version-overview')).toContainText('目标文档数');
  await expect(page.locator('.production-version-overview')).toContainText('待合并回读');
  await expect(page.locator('.production-version-overview')).toContainText('责任：李四');
  await expect(page.locator('.production-version-overview')).toContainText('下一步：等待合并并回读');
  await expect(page.locator('.production-version-overview tbody tr')).toHaveCount(2);
});

test('文档生产复用公共字段抽屉并迁移旧偏好', async ({ page }) => {
  await mockPublishedProductionOutline(page, 'field-config-e2e');
  await page.route('**/knowledge-center/api/assets/handbooks?*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { items: [{ handbookId: 'field-config-e2e', name: '字段配置回归手册', productName: 'YashanDB', ownerAName: '张三' }] } }),
  }));
  await page.evaluate(() => localStorage.setItem('kc-production-handbook-columns', JSON.stringify(['handbook', 'owner', 'progress', 'published'])));
  await page.goto(`${baseUrl}/knowledge-center/production`);

  await expect(page.locator('[data-table-view-id="production-handbooks"]')).toBeVisible();
  await expect(page.locator('[data-production-column-cell="product"]').first()).toBeHidden();
  await expect(page.getByRole('button', { name: '配置手册生产列表显示字段' })).toContainText('4/5');
  expect(await page.evaluate(() => localStorage.getItem('kc-production-handbook-columns'))).toBeNull();
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.includes(':production-handbooks:1')))).toBe(true);

  await page.getByRole('button', { name: '配置手册生产列表显示字段' }).click();
  await page.locator('[data-table-drawer-visible="product"]').check();
  await expect(page.locator('[data-production-column-cell="product"]').first()).toBeVisible();
  await expect(page.locator('[data-table-drawer-visible="product"]')).toBeFocused();
  await expect(page.getByRole('heading', { name: '配置显示字段' })).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-production-column-cell="product"]').first()).toBeVisible();
});

test('我的生成只展示服务端个人运行投影，旧待办链接自动迁移', async ({ page }) => {
  await page.route('**/knowledge-center/api/production/generations?scope=mine', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { scope: 'mine', items: [{
      generationId: 'gen-mine-1', taskId: 'inc-mine-1', taskName: '生成安装说明', handbookId: 'DB-017', handbookName: 'mysql模式参考手册',
      status: 'running', statusDisplayName: '生成中', association: 'participant', progress: 45, progressMessage: '正在校验生成内容', updatedAt: '2026-09-28T08:00:00.000Z',
      nextAction: { label: '查看生成进度', href: '/knowledge-center/production?view=tasks&taskId=inc-mine-1&stage=generation' },
    }] } }),
  }));
  await page.goto(`${baseUrl}/knowledge-center/production?view=todo`);
  await expect(page).toHaveURL(/view=generations/);
  await expect(page.getByRole('tab', { name: '我的生成' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('生成安装说明')).toBeVisible();
  await expect(page.getByText('我参与的运行')).toBeVisible();
  await expect(page.getByText('正在校验生成内容')).toBeVisible();
  await expect(page.locator('.production-generations')).not.toContainText('审核待办');
  await expect(page.locator('.production-generations')).not.toContainText('发布待办');
});

test('手册与任务视图往返时可恢复，空负责人数据不会中断渲染', async ({ page }) => {
  await mockPublishedProductionOutline(page, 'e2e-null-owner');
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/knowledge-center/api/assets/handbooks?*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { items: [{ handbookId: 'e2e-null-owner', name: '空负责人回归手册', productName: 'YashanDB', ownerA: null, ownerB: null }] } }),
  }));

  await page.goto(`${baseUrl}/knowledge-center/production`);
  const handbooksTab = page.getByRole('tab', { name: '手册视图' });
  const tasksTab = page.getByRole('tab', { name: '任务视图' });
  await expect(handbooksTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-production-handbook-row]')).toContainText('空负责人回归手册');
  await expect(page.locator('[data-production-column-cell="owner"]').first()).toContainText('未分配');

  await tasksTab.click();
  await expect(tasksTab).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/\?view=tasks$/);
  await expect(page.locator('.incremental-sidebar')).toBeVisible();

  await handbooksTab.click();
  await expect(handbooksTab).toHaveAttribute('aria-selected', 'true');
  await expect(page).not.toHaveURL(/view=tasks/);
  await expect(page.locator('[data-production-handbook-row]')).toContainText('空负责人回归手册');

  await tasksTab.click();
  await page.reload();
  await expect(tasksTab).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/\?view=tasks$/);
  expect(pageErrors).toEqual([]);
});

test('文档生产任务视图支持深链并在刷新后与 URL 保持一致', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(`${baseUrl}/knowledge-center/production?view=tasks`);
  const tasksTab = page.getByRole('tab', { name: '任务视图' });
  await expect(tasksTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.incremental-sidebar')).toBeVisible();
  await page.reload();
  await expect(tasksTab).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/\?view=tasks$/);
  expect(pageErrors).toEqual([]);
});
