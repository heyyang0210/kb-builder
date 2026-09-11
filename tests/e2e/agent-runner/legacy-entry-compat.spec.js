const { test, expect } = require('@playwright/test');
const baseUrl = process.env.KPG_BASE_URL || 'http://127.0.0.1:13502';

test('旧入口保留迁移提示且不改变当前地址', async ({ page }) => {
  await page.goto(`${baseUrl}/prompt-generator.html?tab=doc-mgmt`);
  await expect(page.getByRole('link', { name: '知识中心建设平台' })).toHaveAttribute('href', '/knowledge-center/');
  await expect(page).toHaveURL(/\/prompt-generator\.html\?tab=doc-mgmt$/);
  await page.getByRole('button', { name: '知道了' }).click();
  await expect(page.getByText('这是文档生成专业工作区')).toBeHidden();
});

test('资料加工旧入口保留迁移提示且统一入口可访问', async ({ page }) => {
  await page.goto(`${baseUrl}/pingcode-materials/workbench?space=ops`);
  await expect(page.getByRole('link', { name: '知识中心建设平台' })).toHaveAttribute('href', '/knowledge-center/');
  await expect(page).toHaveURL(/\/pingcode-materials\/workbench\?space=ops$/);
});

test('既有 API 代理不被迁移提示改写', async ({ request }) => {
  const response = await request.get(`${baseUrl}/pingcode-api/api/health`);
  expect(response.status()).toBe(200);
});
