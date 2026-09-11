const { test, expect, openPage, switchToTab, getActiveTab } = require('./helpers');

test.describe('Cross-Browser - 跨浏览器兼容性', () => {
  test('页面正常加载', async ({ page, browserName }) => {
    await openPage(page);
    const title = await page.title();
    expect(title).toBeTruthy();
    await expect(page.locator('.tab-btn').first()).toBeVisible();
  });

  test('Tab切换工作正常', async ({ page, browserName }) => {
    await openPage(page);
    await switchToTab(page, 'doc-mgmt');
    const activeTab = await getActiveTab(page);
    expect(activeTab).toBe('doc-mgmt');
  });

  test('配置弹窗正常打开', async ({ page, browserName }) => {
    await openPage(page);
    await page.locator('.btn-config').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.modal-overlay.show')).toBeVisible();
  });

  test('后端API可访问', async ({ page, browserName }) => {
    await openPage(page);
    const health = await page.evaluate(async () => {
      try {
        const resp = await fetch('http://localhost:4100/api/health');
        return await resp.json();
      } catch (e) { return null; }
    });
    expect(health).not.toBeNull();
    expect(health.status).toBe('ok');
  });
});
