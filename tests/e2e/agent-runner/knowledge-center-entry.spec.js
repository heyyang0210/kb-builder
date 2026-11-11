const { test, expect } = require('@playwright/test');

const baseUrl = process.env.KPG_BASE_URL;
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'small-desktop', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 }
];
const navigation = ['工作台', '知识资产', '资料清洗', '大纲管理', '模板管理', '文档生产', '审核与发布', '平台管理'];

// Keep bounded, credential-free diagnostics for intermittent shell readiness failures.
const entryDiagnostics = new WeakMap();
test.beforeEach(async ({ page }) => {
  const started = Date.now();
  const diagnostics = { requests: [], pageErrors: [] };
  entryDiagnostics.set(page, diagnostics);
  const pending = new WeakMap();
  const relevant = request => {
    const pathname = new URL(request.url()).pathname;
    return ['/knowledge-center/api/platform/context', '/knowledge-center/api/platform/overview',
      '/knowledge-center/api/auth/session'].includes(pathname) ? pathname : null;
  };
  page.on('request', request => {
    const pathname = relevant(request);
    if (!pathname || diagnostics.requests.length >= 40) return;
    const row = { path: pathname, startedMs: Date.now() - started };
    diagnostics.requests.push(row); pending.set(request, row);
  });
  page.on('response', response => {
    const row = pending.get(response.request());
    if (row) Object.assign(row, { status: response.status(), headersReceivedMs: Date.now() - started });
  });
  page.on('requestfinished', request => {
    const row = pending.get(request);
    if (row) row.finishedMs = Date.now() - started;
  });
  page.on('requestfailed', request => {
    const row = pending.get(request);
    if (row) Object.assign(row, { failedMs: Date.now() - started, failure: request.failure()?.errorText });
  });
  page.on('pageerror', error => {
    if (diagnostics.pageErrors.length < 20) diagnostics.pageErrors.push({ atMs: Date.now() - started, message: error.message });
  });
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  const diagnostics = entryDiagnostics.get(page) || {};
  diagnostics.shell = await page.evaluate(() => ({
    path: location.pathname,
    status: document.querySelector('#platform-status')?.textContent || null,
    busy: document.querySelector('#main')?.getAttribute('aria-busy') || null,
  })).catch(() => ({ unavailable: true }));
  await testInfo.attach('入口加载诊断', { body: Buffer.from(JSON.stringify(diagnostics, null, 2)), contentType: 'application/json' });
});

test.beforeEach(async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/`);
  await page.getByText('平台管理登录').click();
  await page.getByLabel('管理员账号').fill('admin');
  await page.getByLabel('管理员密码').fill('admin');
  await page.getByRole('button', { name: '登录平台管理' }).click();
  await expect(page).toHaveURL(`${baseUrl}/knowledge-center/platform`);
});

for (const viewport of viewports) {
  test(`${viewport.name} 入口无溢出且八个模块可达`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}/knowledge-center/`);
    if (viewport.width <= 900) await page.getByRole('button', { name: '打开导航' }).click();
    for (const name of navigation) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    await expect(page.getByText(/(平台运行正常|部分服务降级|平台数据不可用)/)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('资料清洗和文档生产使用独立页面语义', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/`);
  await page.getByRole('button', { name: '资料清洗', exact: true }).click();
  await expect(page.locator('#view-root').getByRole('heading', { name: '资料清洗' })).toBeVisible();
  await expect(page.locator('#view-root')).not.toContainText('资料清洗待建设');
  await expect(page.locator('#view-root')).toContainText(/资料批次|资料加工服务暂时不可用/);
  await expect(page.locator('#view-root')).toContainText(/知识库版本|资料加工服务暂时不可用/);
  await page.getByRole('button', { name: '文档生产', exact: true }).click();
  await expect(page.locator('#view-root').getByRole('heading', { name: '文档生产' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '手册视图' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: '任务视图' }).click();
  await expect(page.locator('#view-root').getByRole('heading', { name: '增量任务' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '任务视图' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#view-root').getByRole('button', { name: '创建增量任务' })).toBeVisible();
});

test('资料清洗工作区为有写权限用户提供真实上传入口', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/cleaning`);
  await expect(page.getByRole('button', { name: '上传资料', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '上传资料', exact: true }).click();
  await expect(page.getByRole('heading', { name: '上传资料' })).toBeVisible();
  await expect(page.locator('[data-cleaning-upload-form] input[type="file"]')).toHaveCount(1);
});

test('审核与发布默认入口读取真实手册工作台并支持我的审核', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/review`);
  const root = page.locator('#view-root');
  await expect(root.locator('.review-hub')).toHaveCount(1);
  await expect(root.getByRole('heading', { name: '按手册掌握审核全局' })).toBeVisible();
  await expect(root.getByRole('link', { name: '手册视图', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(root.getByRole('link', { name: /我的审核/ })).toBeVisible();
  await expect(root).toContainText(/审核|发布|暂无|服务暂时不可用/);
  await expect(root).not.toContainText('示例数据');
});

test('工作台以个人待办、处理状态和任务字段组织工作', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/`);
  const root = page.locator('#view-root');
  await expect(root.getByRole('heading', { name: '我的工作' })).toBeVisible();
  await expect(root.getByRole('navigation', { name: '工作类别' })).toBeVisible();
  await expect(root.getByRole('group', { name: '处理状态' })).toBeVisible();
  await expect(root.getByRole('button', { name: /待我处理/ })).toBeVisible();
  await expect(root.getByRole('button', { name: /等待他人/ })).toBeVisible();
  await expect(root.getByRole('button', { name: '打印汇报' })).toHaveCount(0);
  await expect(root.getByRole('button', { name: '导出待确认' })).toHaveCount(0);
  await expect(root.getByRole('columnheader')).toHaveText(['编号', '工作项', '关联范围', '计划截止', '下一步', '详情']);
});

test('个人工作刷新读取真实待办且数据变更事件触发平台投影重读', async ({ page }) => {
  let overviewRequests = 0;
  let contextRequests = 0;
  let myTaskRequests = 0;
  await page.route('**/knowledge-center/api/platform/overview', async route => {
    overviewRequests += 1;
    await route.continue();
  });
  await page.route('**/knowledge-center/api/platform/context', async route => {
    contextRequests += 1;
    await route.continue();
  });
  await page.route('**/knowledge-center/api/workbench/my-tasks/query', async route => {
    myTaskRequests += 1;
    await route.continue();
  });
  await page.goto(`${baseUrl}/knowledge-center/`);
  await expect.poll(() => contextRequests).toBeGreaterThan(0);
  await expect.poll(() => myTaskRequests).toBeGreaterThan(0);
  await page.locator('#view-root').getByRole('button', { name: '刷新', exact: true }).click();
  await expect.poll(() => myTaskRequests).toBeGreaterThan(1);
  const initialRequests = overviewRequests;
  const initialContextRequests = contextRequests;
  await page.evaluate(async () => {
    const { notifyKnowledgeDataChanged } = await import('/knowledge-center/common/state/data-change.js');
    notifyKnowledgeDataChanged(['overview'], 'e2e');
  });
  await expect.poll(() => overviewRequests).toBeGreaterThan(initialRequests);
  expect(contextRequests).toBe(initialContextRequests);
});

test('模块路由支持深链、刷新恢复和浏览器后退', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/assets`);
  await expect(page).toHaveURL(`${baseUrl}/knowledge-center/assets`);
  await expect(page.locator('#view-root').getByRole('heading', { name: '知识资产' })).toBeVisible();
  await page.reload();
  await expect(page.locator('#view-root').getByRole('heading', { name: '知识资产' })).toBeVisible();
  await page.getByRole('button', { name: '资料清洗', exact: true }).click();
  await expect(page).toHaveURL(`${baseUrl}/knowledge-center/cleaning`);
  await page.goBack();
  await expect(page).toHaveURL(`${baseUrl}/knowledge-center/assets`);
  await expect(page.locator('#view-root').getByRole('heading', { name: '知识资产' })).toBeVisible();
  await page.goto(`${baseUrl}/knowledge-center/unknown-module`);
  await expect(page).toHaveURL(`${baseUrl}/knowledge-center/`);
  await expect(page.locator('#view-root').getByRole('heading', { name: '我的工作' })).toBeVisible();
});

test('全部数据不可用时显示可恢复错误且不冒充实时数据', async ({ page }) => {
  const unavailable = JSON.stringify({ status: 'unavailable', errors: [{ code: 'MODULE_UNAVAILABLE', message: '模块不可用' }] });
  await page.route('**/knowledge-center/api/platform/context', route => route.fulfill({ status: 503, contentType: 'application/json', body: unavailable }));
  await page.route('**/knowledge-center/api/platform/overview', route => route.fulfill({ status: 503, contentType: 'application/json', body: unavailable }));
  await page.goto(`${baseUrl}/knowledge-center/`);
  await expect(page.getByText('平台数据暂时不可用')).toBeVisible();
  await expect(page.getByRole('button', { name: '重新检查' })).toBeVisible();
  await expect(page.getByText('实时数据', { exact: true })).toHaveCount(0);
});

test('平板使用可访问抽屉并阻止焦点穿透', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${baseUrl}/knowledge-center/`);
  const menu = page.locator('#mobile-menu');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#sidebar')).toHaveAttribute('inert', '');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#sidebar')).not.toHaveAttribute('inert', '');
  await expect(page.locator('#main-shell')).toHaveAttribute('inert', '');
  const close = page.getByRole('button', { name: '关闭导航' });
  const box = await close.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.querySelector('#sidebar').contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(page.locator('#sidebar')).toHaveAttribute('inert', '');
  await expect(page.locator('#main-shell')).not.toHaveAttribute('inert', '');
});

test('移动侧栏底部退出按钮保持可见', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${baseUrl}/knowledge-center/outlines`);
  await page.getByRole('button', { name: '打开导航' }).click();
  const logout = page.getByRole('button', { name: '退出登录' });
  await expect(logout).toBeVisible();
  await expect(logout).toHaveAttribute('title', '退出登录');
});

test('桌面端侧栏固定且右侧主内容独立滚动', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/knowledge-center/`);
  const sidebar = page.locator('#sidebar');
  const mainShell = page.locator('#main-shell');
  await expect(page.locator('#app-shell')).toBeVisible();
  // 工作台数据量不固定；明确制造溢出后再验证独立滚动容器。
  await mainShell.evaluate(element => {
    const spacer = document.createElement('div');
    spacer.style.height = '1200px';
    spacer.setAttribute('data-scroll-test-spacer', '');
    element.append(spacer);
  });
  await expect.poll(async () => mainShell.evaluate(element => element.scrollHeight > element.clientHeight)).toBeTruthy();
  const before = await sidebar.boundingBox();
  await mainShell.evaluate(element => { element.scrollTop = 500; });
  await expect.poll(async () => mainShell.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const after = await sidebar.boundingBox();
  expect(after.y).toBe(before.y);
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible();
});
