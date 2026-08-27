const { test, expect } = require('@playwright/test');
const baseUrl = process.env.KPG_BASE_URL || 'http://127.0.0.1:13502';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'small-desktop', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 }
];

for (const viewport of viewports) {
  test(`${viewport.name} 入口无溢出且工作区可达`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}/knowledge-center/`);
    await expect(page.getByRole('heading', { name: '选择当前工作区' })).toBeVisible();
    await expect(page.getByText('平台运行正常')).toBeVisible();
    await expect(page.getByRole('link', { name: /进入资料加工/ })).toHaveAttribute('href', '/pingcode-materials/');
    await expect(page.getByRole('link', { name: /进入文档生成/ })).toHaveAttribute('href', '/prompt-generator.html');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `/tmp/kpg08-${viewport.name}.png`, fullPage: true });
  });
}

test('单模块故障时禁用对应入口且保留恢复动作', async ({ page }) => {
  await page.route('**/knowledge-center/api/platform/context', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      status: 'degraded',
      context: {
        profileId: 'yashandb', enterpriseId: 'yashandb', displayName: 'YashanDB 企业能力包',
        brand: { platformName: '知识中心建设平台', enterpriseName: 'YashanDB' },
        capabilities: [], connectors: [], configFingerprint: `sha256:${'a'.repeat(64)}`
      },
      modules: {
        documentGeneration: { status: 'ok' },
        materialProcessing: { status: 'unavailable', error: { code: 'MODULE_TIMEOUT' } }
      }
    })
  }));
  await page.goto(`${baseUrl}/knowledge-center/`);
  await expect(page.getByText('部分服务降级')).toBeVisible();
  await expect(page.locator('[data-module="materialProcessing"] .workspace-link')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('button', { name: '刷新状态' })).toBeVisible();
});
