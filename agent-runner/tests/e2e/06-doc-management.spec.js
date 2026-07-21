const { test, expect, openPage, switchToTab } = require('./helpers');

test.describe('Document Management - 文档管理', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page);
    await switchToTab(page, 'doc-mgmt');
  });

  test('文档管理Tab正常加载', async ({ page }) => {
    const activeBtn = page.locator('.tab-btn.active');
    await expect(activeBtn).toHaveAttribute('data-tab', 'doc-mgmt');
  });

  test('文档管理API - 获取文档列表', async ({ request }) => {
    const resp = await request.get('http://localhost:4100/api/document/list');
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty('success');
  });

  test('文档管理API - 获取文档树', async ({ request }) => {
    const resp = await request.get('http://localhost:4100/api/document/tree');
    expect(resp.ok()).toBeTruthy();
  });

  test('文档管理API - 搜索文档', async ({ request }) => {
    const resp = await request.post('http://localhost:4100/api/document/search', {
      data: { query: 'test', limit: 5 }
    });
    expect(resp.ok()).toBeTruthy();
  });
});
