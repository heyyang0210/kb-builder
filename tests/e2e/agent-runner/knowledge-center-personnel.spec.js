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

function directory(items) {
  return { success: true, data: { generatedAt: '2026-09-21T09:00:00.000Z', total: items.length, items, summary: {
    total: items.length,
    bound: items.filter(item => item.casLoginName).length,
    pending: items.filter(item => !item.casLoginName).length,
    inactive: items.filter(item => item.state === 'INACTIVE').length,
  } } };
}

test('未登录人员可更正错误 CAS 预绑定并需要二次确认', async ({ page }) => {
  const items = [{ principalId: 185, displayName: '史鑫', casLoginName: 'wrong-shixin', state: 'ACTIVE', firstLoginAt: null, lastLoginAt: null, rowVersion: 2, manualReferenceCount: 0, loginStatus: 'BOUND' }];
  let patchPayload = null;
  await page.route('**/knowledge-center/api/platform/principals/**', async route => {
    patchPayload = route.request().postDataJSON();
    items[0] = { ...items[0], casLoginName: patchPayload.casLoginName, rowVersion: 3 };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: items[0] }) });
  });
  await page.route('**/knowledge-center/api/platform/principals*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(directory(items)) });
  });
  await loginAsAdmin(page);
  await page.goto(`${baseUrl}/knowledge-center/platform?tab=principals`);
  await page.getByRole('button', { name: '编辑' }).click();
  const editor = page.locator('[data-principal-editor-dialog]');
  const loginInput = editor.getByLabel('CAS 登录名');
  await expect(loginInput).toBeEnabled();
  await expect(editor.getByText('尚未通过 CAS 登录，可更正错误的预绑定账号')).toBeVisible();
  await loginInput.fill('shixin');
  await editor.getByRole('button', { name: '保存修改' }).click();
  const confirmation = page.getByRole('dialog', { name: '确认更正 CAS 登录名' });
  await expect(confirmation).toContainText('wrong-shixin');
  await expect(confirmation).toContainText('shixin');
  await confirmation.getByRole('button', { name: '确认更正' }).click();
  await expect.poll(() => patchPayload?.casLoginName).toBe('shixin');
  await expect(page.getByText('CAS 登录名已更正。')).toBeVisible();
});

test('已有 CAS 登录记录的人员仍禁止直接换绑', async ({ page }) => {
  const items = [{ principalId: 178, displayName: '何阳', casLoginName: 'heyang', state: 'ACTIVE', firstLoginAt: '2026-09-18T07:49:55.000Z', lastLoginAt: '2026-09-21T06:22:37.000Z', rowVersion: 8, manualReferenceCount: 2, loginStatus: 'BOUND' }];
  await page.route('**/knowledge-center/api/platform/principals*', route => route.request().method() === 'GET'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(directory(items)) })
    : route.continue());
  await loginAsAdmin(page);
  await page.goto(`${baseUrl}/knowledge-center/platform?tab=principals`);
  await page.getByRole('button', { name: '编辑' }).click();
  const editor = page.locator('[data-principal-editor-dialog]');
  await expect(editor.getByLabel('CAS 登录名')).toBeDisabled();
  await expect(editor.getByText('该人员已有 CAS 登录记录，不能直接更正')).toBeVisible();
});
