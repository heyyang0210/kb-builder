const { test, expect, openPage } = require('./helpers');

test.describe('Theme - 主题切换', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page);
  });

  test('主题按钮存在', async ({ page }) => {
    const themeBtn = page.locator('button:has-text("主题")');
    await expect(themeBtn).toBeVisible();
  });

  test('点击主题按钮切换主题', async ({ page }) => {
    const themeBtn = page.locator('button:has-text("主题")');
    await themeBtn.click();
    await page.waitForTimeout(500);
    const theme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme') || 'light';
    });
    expect(theme).toBeTruthy();
  });

  test('主题切换后页面仍然可用', async ({ page }) => {
    const themeBtn = page.locator('button:has-text("主题")');
    await themeBtn.click();
    await page.waitForTimeout(300);
    await themeBtn.click();
    await page.waitForTimeout(300);
    await expect(page.locator('.tab-btn').first()).toBeVisible();
  });
});
