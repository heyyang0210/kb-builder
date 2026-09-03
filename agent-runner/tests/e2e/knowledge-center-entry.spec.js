const { test, expect } = require('@playwright/test');

const baseUrl = process.env.KPG_BASE_URL || 'http://127.0.0.1:13510';
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'small-desktop', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 }
];
const navigation = ['工作台', '知识资产', '资料清洗', '大纲管理', '模板管理', '文档生产', '审核与发布', '平台管理'];

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
  await expect(page.locator('#view-root')).toContainText('资料清洗待建设');
  await expect(page.locator('#view-root')).not.toContainText('进入资料清洗');
  await page.getByRole('button', { name: '文档生产', exact: true }).click();
  await expect(page.getByRole('tab', { name: '来源选择' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '生成策略' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '生产任务' })).toBeVisible();
});

test('工作台采用风险优先的负责人信息层级', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/`);
  const root = page.locator('#view-root');
  await expect(root.getByRole('heading', { name: '风险与阻塞' })).toBeVisible();
  await expect(root.getByRole('heading', { name: '生产完成度' })).toBeVisible();
  await expect(root.getByRole('heading', { name: '手册完整度矩阵' })).toBeVisible();
  await expect(root.getByRole('heading', { name: '关键状态泳道' })).toBeVisible();
  await expect(root.getByRole('heading', { name: '最近活动' })).toBeVisible();
  await expect(root.getByRole('button', { name: '打印汇报' })).toHaveCount(0);
  await expect(root.getByRole('button', { name: '导出待确认' })).toHaveCount(0);
  const headings = await root.locator('h2').evaluateAll(nodes => nodes.map(node => node.textContent.trim()));
  expect(headings.slice(1, 6)).toEqual(['风险与阻塞', '生产完成度', '手册完整度矩阵', '关键状态泳道', '最近活动']);
});

test('常驻刷新入口已移除且数据变更事件触发投影重读', async ({ page }) => {
  let overviewRequests = 0;
  let contextRequests = 0;
  await page.route('**/knowledge-center/api/platform/overview', async route => {
    overviewRequests += 1;
    await route.continue();
  });
  await page.route('**/knowledge-center/api/platform/context', async route => {
    contextRequests += 1;
    await route.continue();
  });
  await page.goto(`${baseUrl}/knowledge-center/`);
  await expect.poll(() => contextRequests).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: '刷新', exact: true })).toHaveCount(0);
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
  await expect(page.locator('#view-root').getByRole('heading', { name: '工作台' })).toBeVisible();
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
  const before = await sidebar.boundingBox();
  await mainShell.evaluate(element => { element.scrollTop = 500; });
  await expect.poll(async () => mainShell.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const after = await sidebar.boundingBox();
  expect(after.y).toBe(before.y);
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible();
});
