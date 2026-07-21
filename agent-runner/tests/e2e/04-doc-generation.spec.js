const { test, expect, openPage } = require('./helpers');

test.describe('Document Generation - 文档生成流程', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page);
  });

  test('文档生成Tab包含核心按钮', async ({ page }) => {
    await expect(page.locator('#executeBtn')).toBeVisible();
    await expect(page.locator('.btn-execute')).toBeVisible();
    await expect(page.locator('button[onclick="generatePrompt()"]')).toBeVisible();
    await expect(page.locator('button[onclick="resetForm()"]')).toBeVisible();
  });

  test('输出区域相关按钮存在于DOM中', async ({ page }) => {
    const copyBtn = page.locator('button[onclick="copyPrompt()"]');
    expect(await copyBtn.count()).toBeGreaterThan(0);
  });

  test('生成提示词按钮存在', async ({ page }) => {
    const genBtn = page.locator('button[onclick="generatePrompt()"]');
    await expect(genBtn).toBeVisible();
  });

  test('重置按钮可点击', async ({ page }) => {
    const resetBtn = page.locator('button[onclick="resetForm()"]');
    await expect(resetBtn).toBeEnabled();
  });

  test('执行Agent按钮存在且可用', async ({ page }) => {
    await expect(page.locator('#executeBtn')).toBeVisible();
    await expect(page.locator('#executeBtn')).toBeEnabled();
  });
});
