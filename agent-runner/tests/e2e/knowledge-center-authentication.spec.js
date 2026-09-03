const { test, expect } = require('@playwright/test');

const baseUrl = process.env.KPG_BASE_URL || 'http://127.0.0.1:13510';
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'small-desktop', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
];

for (const viewport of viewports) {
  test(`${viewport.name} 匿名用户看到可访问登录面板`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}/knowledge-center/assets`);
    await expect(page.getByRole('heading', { name: '知识中心管理' })).toBeVisible();
    const cas = page.getByRole('button', { name: '统一认证登录' });
    await expect(cas).toBeVisible();
    const box = await cas.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByText('平台管理登录')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('管理员通过真实认证 API 登录并进入平台管理', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/`);
  await page.getByText('平台管理登录').click();
  await page.getByLabel('管理员账号').fill('admin');
  await page.getByLabel('管理员密码').fill('admin');
  await page.getByRole('button', { name: '登录平台管理' }).click();
  await expect(page).toHaveURL(`${baseUrl}/knowledge-center/platform`);
  await expect(page.getByRole('button', { name: '平台管理', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => /token|ticket|session/i.test(key)))).toBe(false);
});

test('管理员错误密码显示就近错误并保持可恢复', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/`);
  await page.getByText('平台管理登录').click();
  await page.getByLabel('管理员账号').fill('admin');
  await page.getByLabel('管理员密码').fill('wrong-password');
  await page.getByRole('button', { name: '登录平台管理' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('管理员账号或密码错误');
  await expect(alert).toBeFocused();
  await expect(page.getByRole('button', { name: '统一认证登录' })).toBeVisible();
});
