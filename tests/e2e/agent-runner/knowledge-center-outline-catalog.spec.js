const { test, expect } = require('@playwright/test');

const baseUrl = process.env.KPG_BASE_URL;
const catalogItems = [
  { id: 'c-drive', handbookId: 'c-drive', name: 'C驱动参考手册', productName: 'YashanDB', state: 'draft', updated_at: '2026-10-12T08:00:00Z' },
  { id: 'mysql-mode', handbookId: 'mysql-mode', name: 'mysql模式参考手册', productName: 'YashanDB', state: 'draft', updated_at: '2026-10-12T08:00:00Z' },
  { id: 'basic-db', handbookId: 'basic-db', name: '基本数据库管理手册', productName: 'YashanDB', state: 'published', updated_at: '2026-10-12T08:00:00Z' },
];

test.beforeEach(async ({ page }) => {
  const response = await page.request.post(`${baseUrl}/knowledge-center/api/auth/admin/login`, { data: { username: 'admin', password: 'admin' } });
  expect(response.ok()).toBe(true);

  await page.route('**/knowledge-center/api/outline/catalog', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        items: catalogItems,
        total: catalogItems.length,
        snapshotVersion: 'e2e-catalog-snapshot-1',
        generatedAt: '2026-10-12T08:00:00Z',
      },
    }),
  }));
  await page.route('**/knowledge-center/api/outline/governance/list', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [{ id: 'c-drive-outline', handbookId: 'c-drive', name: 'C驱动参考手册大纲', state: 'draft' }] }),
  }));
  await page.route('**/knowledge-center/api/assets/handbooks?*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { items: catalogItems.map(({ handbookId, name }) => ({ handbookId, name })) } }),
  }));
  await page.route('**/knowledge-center/api/outline/governance/c-drive*', async route => {
    await new Promise(resolve => setTimeout(resolve, 250));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { id: 'c-drive-outline', handbookId: 'c-drive', name: 'C驱动参考手册大纲', state: 'draft', nodes: [], governance: {} } }),
    });
  });
  await page.route('**/knowledge-center/api/outline/build-tasks', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { tasks: [] } }),
  }));
});

test('大纲目录读模型在详情返回后仍保持全量且刷新一致', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/outlines`);
  await expect(page.getByRole('heading', { name: '大纲管理', level: 2 })).toBeVisible();

  const rows = page.locator('[data-outline-row]:visible');
  await expect(rows).toHaveCount(3);
  await expect(page.locator('[data-outline-row] [data-outline-id]')).toHaveCount(3);
  const firstIds = await page.locator('[data-outline-row] [data-outline-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-outline-id')));
  expect(firstIds).toEqual(['c-drive', 'mysql-mode', 'basic-db']);
  expect(await page.locator('[data-outline-row]').evaluateAll(nodes => nodes.some(node => node.querySelector('[data-outline-nodes], [data-outline-node]')))).toBe(false);

  await page.locator('[data-outline-row] [data-outline-id="c-drive"]').click();
  await expect(page).toHaveURL(/\/knowledge-center\/outlines\/c-drive/);
  await expect(page.getByRole('heading', { name: 'C驱动参考手册' })).toBeVisible();
  await page.getByRole('link', { name: '返回大纲列表' }).click();
  await expect(page).toHaveURL(/\/knowledge-center\/outlines$/);
  await expect(page.locator('[data-outline-row]:visible')).toHaveCount(3);

  await page.reload();
  await expect(page.locator('[data-outline-row]:visible')).toHaveCount(3);
  const refreshedIds = await page.locator('[data-outline-row] [data-outline-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-outline-id')));
  expect(refreshedIds).toEqual(firstIds);
});

test('详情迟到响应不能覆盖已返回的全量目录', async ({ page }) => {
  let releaseDetail;
  let detailStarted;
  const detailGate = new Promise(resolve => { releaseDetail = resolve; });
  const started = new Promise(resolve => { detailStarted = resolve; });
  await page.route(url => url.pathname === '/knowledge-center/api/outline/governance/c-drive', async route => {
    detailStarted();
    await detailGate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { id: 'c-drive', handbookId: 'c-drive', name: 'C驱动参考手册大纲', state: 'draft', nodes: [], governance: {} } }),
    });
  });
  try {
    await page.goto(`${baseUrl}/knowledge-center/outlines`);
    await expect(page.locator('[data-outline-row]:visible')).toHaveCount(3);
    await page.locator('[data-outline-id="c-drive"]').click();
    await started;
    await page.locator('[data-view="outlines"]').click();
    await expect(page.locator('[data-outline-row]:visible')).toHaveCount(3);
    const lateResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/knowledge-center/api/outline/governance/c-drive');
    releaseDetail();
    await lateResponse;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page).toHaveURL(/\/knowledge-center\/outlines$/);
    await expect(page.locator('[data-outline-row]:visible')).toHaveCount(3);
    await expect(page.locator('.outline-detail-shell')).toHaveCount(0);
  } finally {
    releaseDetail();
  }
});

test('领域任务迟到刷新保留已展开的更多操作菜单', async ({ page }) => {
  let releaseTasks;
  let tasksStarted;
  const tasksGate = new Promise(resolve => { releaseTasks = resolve; });
  const started = new Promise(resolve => { tasksStarted = resolve; });
  await page.route('**/knowledge-center/api/outline/build-tasks', async route => {
    tasksStarted();
    await tasksGate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { tasks: [] } }),
    });
  });
  try {
    await page.goto(`${baseUrl}/knowledge-center/outlines/c-drive`);
    await started;
    await page.getByText('更多操作', { exact: true }).click();
    const menu = page.locator('.outline-more-actions');
    await expect(menu).toHaveAttribute('open', '');
    await expect(page.getByRole('button', { name: '手册信息', exact: true })).toBeVisible();
    const tasksResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/knowledge-center/api/outline/build-tasks');
    releaseTasks();
    await tasksResponse;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(menu).toHaveAttribute('open', '');
    await page.getByRole('button', { name: '手册信息', exact: true }).click();
    await expect(page.locator('#outline-handbook-info')).toBeVisible();
  } finally {
    releaseTasks();
  }
});
