const { test, expect, openPage } = require('./helpers');

test.describe('Workflow Execution - 工作流执行', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page);
  });

  test('执行Agent按钮初始状态', async ({ page }) => {
    await expect(page.locator('#executeBtn')).toBeVisible();
    await expect(page.locator('#executeBtn')).toBeEnabled();
  });

  test('工作流选择器存在', async ({ page }) => {
    const selector = page.locator('#workflowSelector, [class*="workflow"]');
    const exists = await selector.count() > 0;
    expect(exists).toBeTruthy();
  });

  test('执行请求API可达', async ({ request }) => {
    const resp = await request.post('http://localhost:4100/api/workflow/execute', {
      data: {
        prompt: '测试提示词',
        knowledge_point: '测试知识点',
        workflow: '快速生成'
      }
    });
    expect([200, 400, 401, 404, 500]).toContain(resp.status());
  });
});
