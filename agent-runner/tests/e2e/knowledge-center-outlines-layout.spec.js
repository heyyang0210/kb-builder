const { test, expect } = require('@playwright/test');

const baseUrl = process.env.KPG_BASE_URL || 'http://127.0.0.1:13510';
const viewports = [
  { width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 375, height: 812 },
];

test.beforeEach(async ({ page }) => {
  const response = await page.request.post(`${baseUrl}/knowledge-center/api/auth/admin/login`, { data: { username: 'admin', password: 'admin' } });
  expect(response.ok()).toBe(true);
});

test('大纲列表与详情独立，返回后恢复筛选', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/outlines`);
  await expect(page.getByRole('heading', { name: '大纲管理', level: 2 })).toBeVisible();
  await expect(page.locator('.outline-detail-shell')).toHaveCount(0);
  const search = page.getByLabel('搜索手册');
  const firstName = await page.locator('[data-outline-row]:visible').first().locator('td').first().locator('strong').textContent();
  await search.fill(firstName.slice(0, 4));
  await expect(page).toHaveURL(/q=/);
  await page.locator('[data-outline-row]:visible [data-outline-id]').first().click();
  await expect(page).toHaveURL(/\/knowledge-center\/outlines\/[^?]+\?q=/);
  await expect(page.getByRole('tab', { name: /1\s*目录/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: /2\s*责任/ }).click();
  await expect(page).toHaveURL(/stage=responsibility/);
  await page.reload();
  await expect(page.getByRole('tab', { name: /2\s*责任/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: '手册信息' }).click();
  await expect(page.getByRole('heading', { name: '手册信息' })).toBeVisible();
  await page.getByRole('button', { name: '关闭手册信息' }).click();
  await page.getByRole('link', { name: '返回大纲列表' }).click();
  await expect(search).toHaveValue(firstName.slice(0, 4));
});

test('无效大纲深链不会回退到第一本手册', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/outlines/not-a-real-handbook`);
  await expect(page.getByText('手册不存在', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(`${baseUrl}/knowledge-center/outlines/not-a-real-handbook`);
});

for (const viewport of viewports) {
  test(`${viewport.width}px 列表和详情无页面级溢出`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}/knowledge-center/outlines`);
    await expect(page.locator('[data-outline-row]').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.locator('[data-outline-row] [data-outline-id]').first().click();
    await expect(page.locator('.outline-stage-canvas')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}
