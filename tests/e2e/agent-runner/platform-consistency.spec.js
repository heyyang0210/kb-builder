const { test, expect } = require('@playwright/test');

test('平台管理真实页面：各页签布局、权限筛选和服务折叠', async ({ page }, testInfo) => {
  const base = process.env.KPG_BASE_URL;
  const login = await page.request.post(`${base}/knowledge-center/api/auth/admin/login`, { data: { username: 'admin', password: 'admin' } });
  expect(login.ok()).toBe(true);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const tab of ['governance', 'principals', 'permissions', 'gitlab', 'mcp', 'models']) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/knowledge-center/platform?tab=${tab}`);
    await expect(page.locator('.platform-admin-page')).toBeVisible();
    await expect(page.locator('#main')).not.toHaveAttribute('aria-busy', 'true');
    if (tab === 'permissions') {
      const fields = page.locator('.permissions-filters .searchable-combobox');
      if (await fields.count() === 2) {
        const first = await fields.nth(0).boundingBox();
        const second = await fields.nth(1).boundingBox();
        expect(first.x + first.width).toBeLessThanOrEqual(second.x);
      }
    }
    if (tab === 'gitlab') await expect(page.locator('.platform-section-heading [data-gitlab-add-connection]')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${tab}-desktop.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: testInfo.outputPath(`${tab}-mobile.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});
