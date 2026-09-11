const { test, expect, openPage, getActiveTab } = require('./helpers');

test.describe('Smoke Tests - 基础可用性', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page);
  });

  test('前端页面能正常加载', async ({ page }) => {
    const title = await page.title();
    expect(title).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('后端健康检查通过', async ({ request }) => {
    const resp = await request.get('http://localhost:4100/api/health');
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.status).toBe('ok');
  });

  test('前端静态资源可访问', async ({ request }) => {
    const resp = await request.get('http://localhost:3500/prompt-generator.html');
    expect(resp.ok()).toBeTruthy();
    const text = await resp.text();
    expect(text).toContain('<!DOCTYPE html>');
  });

  test('三个主Tab按钮都存在', async ({ page }) => {
    await expect(page.locator('.tab-btn[data-tab="doc-gen"]')).toBeVisible();
    await expect(page.locator('.tab-btn[data-tab="doc-mgmt"]')).toBeVisible();
    await expect(page.locator('.tab-btn[data-tab="analytics"]')).toBeVisible();
  });

  test('默认激活的是文档生成Tab', async ({ page }) => {
    const activeTab = await getActiveTab(page);
    expect(activeTab).toBe('doc-gen');
  });

  test('配置按钮存在且可点击', async ({ page }) => {
    const configBtn = page.locator('.btn-config');
    await expect(configBtn).toBeVisible();
    await expect(configBtn).toBeEnabled();
  });

  test('主题切换按钮存在', async ({ page }) => {
    const themeBtn = page.locator('button:has-text("主题")');
    await expect(themeBtn).toBeVisible();
  });

  test('侧边栏存在', async ({ page }) => {
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();
  });

  test('连接状态指示器存在', async ({ page }) => {
    const indicator = page.locator('#connectionIndicator');
    await expect(indicator).toBeVisible();
  });
});
