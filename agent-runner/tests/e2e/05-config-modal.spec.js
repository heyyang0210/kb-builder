const { test, expect, openPage } = require('./helpers');

test.describe('Configuration Modal - 配置弹窗', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page);
  });

  test('点击配置按钮打开弹窗', async ({ page }) => {
    await page.locator('.btn-config').click();
    await page.waitForTimeout(500);
    const modal = page.locator('.modal-overlay.show');
    await expect(modal).toBeVisible();
  });

  test('配置弹窗包含三个Tab', async ({ page }) => {
    await page.locator('.btn-config').click();
    await page.waitForTimeout(500);
    await expect(page.locator('button[onclick="switchConfigTab(\'model\')"]')).toBeVisible();
    await expect(page.locator('button[onclick="switchConfigTab(\'mcp\')"]')).toBeVisible();
    await expect(page.locator('button[onclick="switchConfigTab(\'agent\')"]')).toBeVisible();
  });

  test('模型配置Tab包含Provider选择', async ({ page }) => {
    await page.locator('.btn-config').click();
    await page.waitForTimeout(500);
    const providers = page.locator('.provider-card');
    const count = await providers.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('模型配置Tab包含测试连接按钮', async ({ page }) => {
    await page.locator('.btn-config').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#testModelBtn')).toBeVisible();
  });

  test('切换到MCP配置Tab', async ({ page }) => {
    await page.locator('.btn-config').click();
    await page.waitForTimeout(500);
    await page.locator('button[onclick="switchConfigTab(\'mcp\')"]').click();
    await page.waitForTimeout(500);
    const mcpTab = page.locator('button[onclick="switchConfigTab(\'mcp\')"]');
    const isActive = await mcpTab.evaluate(el => el.classList.contains('active'));
    expect(isActive).toBeTruthy();
  });

  test('切换到Agent配置Tab', async ({ page }) => {
    await page.locator('.btn-config').click();
    await page.waitForTimeout(500);
    await page.locator('button[onclick="switchConfigTab(\'agent\')"]').click();
    await page.waitForTimeout(500);
    const agentTab = page.locator('button[onclick="switchConfigTab(\'agent\')"]');
    const isActive = await agentTab.evaluate(el => el.classList.contains('active'));
    expect(isActive).toBeTruthy();
  });

  test('弹窗可以关闭', async ({ page }) => {
    await page.locator('.btn-config').click();
    await page.waitForTimeout(500);
    await page.locator('.modal-close').first().click();
    await page.waitForTimeout(500);
    const modal = page.locator('.modal-overlay.show');
    const isVisible = await modal.count() > 0 && await modal.isVisible().catch(() => false);
    expect(isVisible).toBeFalsy();
  });

  test('保存配置按钮存在', async ({ page }) => {
    await page.locator('.btn-config').click();
    await page.waitForTimeout(500);
    await expect(page.locator('button[onclick="saveConfig()"]')).toBeVisible();
  });
});
