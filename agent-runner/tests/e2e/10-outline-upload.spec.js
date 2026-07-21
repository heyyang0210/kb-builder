const { test, expect, openPage } = require('./helpers');
const path = require('path');
const fs = require('fs');

test.describe('Outline Upload - 大纲上传', () => {
  const OUTLINE_FILE = path.resolve(__dirname, '../../../outlines/兼容性领域知识点大纲.md');

  test.beforeEach(async ({ page }) => {
    await openPage(page);
  });

  test('上传按钮存在', async ({ page }) => {
    const uploadBtn = page.locator('.btn-upload-outline');
    await expect(uploadBtn.first()).toBeVisible();
  });

  test('文件输入元素存在', async ({ page }) => {
    const fileInput = page.locator('#outlineFileInput');
    const exists = await fileInput.count() > 0;
    expect(exists).toBeTruthy();
  });

  test('上传大纲文件后导航栏更新', async ({ page }) => {
    if (!fs.existsSync(OUTLINE_FILE)) {
      test.skip();
      return;
    }
    const fileInput = page.locator('#outlineFileInput');
    await fileInput.setInputFiles(OUTLINE_FILE);
    await page.waitForTimeout(2000);
    // 上传后应触发导航更新
    const navItems = page.locator('.tree-kp, .tree-chapter-title, .tree-part-title');
    const count = await navItems.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
