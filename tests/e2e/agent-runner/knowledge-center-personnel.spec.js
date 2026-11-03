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

test('点击人员管理展开子菜单并进入团队小组', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${baseUrl}/knowledge-center/platform?tab=governance`);
  const personnel = page.locator('.platform-tab-summary');
  await expect(personnel).toBeVisible();
  await expect(page.locator('#main')).not.toHaveAttribute('aria-busy', 'true');
  await personnel.click();
  await expect(page.getByRole('menuitem', { name: '人员管理' })).toBeVisible();
  const teamItem = page.getByRole('menuitem', { name: '团队小组' });
  await expect(teamItem).toBeVisible();
  const tabsBox = await page.locator('.platform-tabs').boundingBox();
  const teamItemBox = await teamItem.boundingBox();
  expect(tabsBox).not.toBeNull();
  expect(teamItemBox).not.toBeNull();
  expect(teamItemBox.y + teamItemBox.height).toBeGreaterThan(tabsBox.y + tabsBox.height);
  await page.getByRole('menuitem', { name: '人员管理' }).click();
  await expect(page).toHaveURL(/tab=principals&view=people/);
  await expect(page.getByRole('heading', { name: '人员管理', exact: true })).toBeVisible();
  await page.locator('.platform-tab-summary').click();
  await expect(page.getByRole('menuitem', { name: '团队小组' })).toBeVisible();
  await page.getByRole('menuitem', { name: '团队小组' }).click();
  await expect(page).toHaveURL(/tab=principals&view=groups/);
  await expect(page.getByRole('heading', { name: '团队小组', exact: true })).toBeVisible();
});

test('团队小组工作区只保留名册编辑和新建入口', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${baseUrl}/knowledge-center/platform?tab=principals&view=groups`);
  await expect(page.getByRole('button', { name: '添加团队小组' })).toBeVisible();
  const form = page.locator('[data-team-group-form]');
  await expect(form).toBeVisible();
  await expect(form.getByRole('combobox', { name: '负责人，可输入筛选' })).toBeVisible();
  await expect(form.getByText('团队成员', { exact: true })).toBeVisible();
  await expect(form.getByText('影响预览')).toHaveCount(0);
  await expect(form.getByText('变更原因')).toHaveCount(0);
  const save = form.getByRole('button', { name: '保存', exact: true });
  const cancel = form.getByRole('button', { name: '取消', exact: true });
  await expect(save).toBeVisible();
  await expect(cancel).toBeVisible();
  expect(await form.locator('.team-group-actions button').allTextContents()).toEqual(['保存', '取消']);
});

test('修改团队成员时会话失效进入统一重新登录页', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${baseUrl}/knowledge-center/platform?tab=principals&view=groups`);
  const form = page.locator('[data-team-group-form]');
  await expect(form).toBeVisible();
  await page.route('**/knowledge-center/api/platform/team-groups/*/roster', route => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, error: { code: 'AUTH_REQUIRED', message: '请登录后继续' } }),
  }));
  await form.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('登录状态已过期，请重新登录。')).toBeVisible();
  await expect(page.getByText('请登录后继续')).toHaveCount(0);
  await expect(page.getByText('平台管理登录')).toBeVisible();
});

test('登录后可通过真实 API 保存当前团队名册', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${baseUrl}/knowledge-center/platform?tab=principals&view=groups`);
  const form = page.locator('[data-team-group-form]');
  await expect(form).toBeVisible();
  await form.getByRole('button', { name: '保存', exact: true }).click();
  await expect(form.locator('[data-team-group-status]')).toContainText('团队名册已保存');
});

test('旧页面的名册预览请求不再返回 405', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${baseUrl}/knowledge-center/platform?tab=principals&view=groups`);
  const form = page.locator('[data-team-group-form]');
  await expect(form).toBeVisible();
  const groupId = await form.getAttribute('data-team-group-id');
  const response = await page.evaluate(async id => {
    const result = await fetch(`/knowledge-center/api/platform/team-groups/${encodeURIComponent(id)}/roster/preview`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return { status: result.status, body: await result.json() };
  }, groupId);
  expect(response.status).toBe(200);
  expect(response.body?.data?.deprecated).toBe(true);
});

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
  const contextRefresh = page.waitForRequest(request => request.method() === 'GET' && request.url().includes('/knowledge-center/api/platform/context'));
  await page.evaluate(async () => {
    const { notifyKnowledgeDataChanged } = await import('/knowledge-center/common/state/data-change.js');
    notifyKnowledgeDataChanged(['context'], 'e2e-platform-editor-rerender');
  });
  const refreshedContextRequest = await contextRefresh;
  expect((await refreshedContextRequest.response())?.ok()).toBeTruthy();
  await expect(editor).toBeVisible();
  await expect(loginInput).toHaveValue('shixin');
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
  await expect(page.getByRole('button', { name: '编辑' })).toBeVisible();
  // This case checks the CAS binding rule after the initial platform load;
  // the overview can otherwise replace the edit button during a mouse click.
  await expect(page.locator('#main')).not.toHaveAttribute('aria-busy', 'true');
  await page.getByRole('button', { name: '编辑' }).click();
  const editor = page.locator('[data-principal-editor-dialog]');
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel('CAS 登录名')).toBeDisabled();
  await expect(editor.getByText('该人员已有 CAS 登录记录，不能直接更正')).toBeVisible();
});
