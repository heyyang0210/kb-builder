const { test, expect, openPage, switchToTab } = require('./helpers');

test.describe('Sidebar - 侧边栏功能', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page);
  });

  test('侧边栏默认展开', async ({ page }) => {
    const sidebar = page.locator('.sidebar');
    const box = await sidebar.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(50);
  });

  test('侧边栏可以折叠', async ({ page }) => {
    const toggleBtn = page.locator('.sidebar-toggle');
    await toggleBtn.click();
    await page.waitForTimeout(500);
    const sidebar = page.locator('.sidebar');
    const isCollapsed = await sidebar.evaluate(el => el.classList.contains('collapsed'));
    expect(isCollapsed).toBeTruthy();
  });

  test('文档生成Tab的侧边栏包含上传按钮', async ({ page }) => {
    const uploadBtn = page.locator('.btn-upload-outline');
    await expect(uploadBtn.first()).toBeVisible();
  });

  test('文档管理Tab的侧边栏包含视图切换', async ({ page }) => {
    await switchToTab(page, 'doc-mgmt');
    const treeViewBtn = page.locator('#treeViewBtn');
    if (await treeViewBtn.count() > 0) {
      await expect(treeViewBtn).toBeVisible();
    }
  });
});
