const { test, expect } = require('@playwright/test');

const baseUrl = process.env.KPG_BASE_URL;

async function loginAsAdmin(page) {
  await page.goto(`${baseUrl}/knowledge-center/`);
  await page.getByText('平台管理登录').click();
  await page.getByLabel('管理员账号').fill('admin');
  await page.getByLabel('管理员密码').fill('admin');
  await page.getByRole('button', { name: '登录平台管理' }).click();
  await expect(page).toHaveURL(`${baseUrl}/knowledge-center/platform`);
}

test('模板管理员可新建模板、保存 v1 并在刷新后回读正文', async ({ page }) => {
  await loginAsAdmin(page);
  let releaseList;
  const listGate = new Promise(resolve => { releaseList = resolve; });
  let markListReady;
  const listReady = new Promise(resolve => { markListReady = resolve; });
  const listPattern = '**/knowledge-center/api/templates?summary=1';
  await page.route(listPattern, async route => {
    const response = await route.fetch();
    markListReady();
    await listGate;
    await route.fulfill({ response });
  });
  try {
    await page.goto(`${baseUrl}/knowledge-center/templates`);
    await expect(page.locator('#view-root').getByRole('heading', { name: '模板管理' })).toBeVisible();
    await listReady;
    await expect(page.getByRole('button', { name: '新建模板' })).toBeDisabled();
  } finally {
    releaseList();
  }
  await expect(page.getByRole('button', { name: '新建模板' })).toBeEnabled();
  await page.unroute(listPattern);

  const name = `E2E 模板 ${Date.now()}`;
  await page.getByRole('button', { name: '新建模板' }).click();
  await page.getByRole('button', { name: '空白创建' }).click();
  await page.locator('[data-template-field="name"]').fill(name);
  await page.locator('[data-template-field="type"]').fill('E2E 回归');
  await page.locator('[data-template-field="description"]').fill('E2E 创建与刷新回读');
  await page.locator('[data-template-content]').fill('# E2E 模板正文\n\n刷新后仍应保留。');
  await page.getByRole('button', { name: '保存', exact: true }).click();

  await expect(page.locator('[data-template-status]')).toContainText(/保存成功/);
  await expect(page.locator('[data-template-results]')).toContainText(name);
  await expect(page.locator('.template-editor')).toContainText('v1');

  await page.reload();
  await expect(page.locator('[data-template-results]')).toContainText(name);
  await page.locator('[data-template-results] [data-template-id]').filter({ hasText: name }).click();
  await expect(page.locator('.template-preview')).toContainText('刷新后仍应保留');

  const toggle = page.locator('[data-template-toggle]');
  if (await toggle.count()) {
    await toggle.click();
    await expect(page.locator('[data-template-status]')).toContainText(/模板状态已更新/);
  }
});
