const { test, expect, getActiveTab, switchToTab, openPage } = require('./helpers');

test.describe('Tab Navigation - 标签页切换', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page);
  });

  test('切换到文档管理Tab', async ({ page }) => {
    await switchToTab(page, 'doc-mgmt');
    const activeTab = await getActiveTab(page);
    expect(activeTab).toBe('doc-mgmt');
  });

  test('切换到统计分析Tab', async ({ page }) => {
    await switchToTab(page, 'analytics');
    const activeTab = await getActiveTab(page);
    expect(activeTab).toBe('analytics');
  });

  test('切换回文档生成Tab', async ({ page }) => {
    await switchToTab(page, 'doc-mgmt');
    await switchToTab(page, 'doc-gen');
    const activeTab = await getActiveTab(page);
    expect(activeTab).toBe('doc-gen');
  });

  test('Tab切换后按钮高亮正确', async ({ page }) => {
    await switchToTab(page, 'doc-mgmt');
    const activeBtn = page.locator('.tab-btn.active');
    await expect(activeBtn).toHaveAttribute('data-tab', 'doc-mgmt');
  });

  test('多次快速切换Tab不会崩溃', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await switchToTab(page, 'doc-gen');
      await switchToTab(page, 'doc-mgmt');
      await switchToTab(page, 'analytics');
    }
    const activeTab = await getActiveTab(page);
    expect(activeTab).toBe('analytics');
  });
});
