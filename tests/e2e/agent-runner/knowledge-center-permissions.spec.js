const { test, expect } = require('@playwright/test');

const baseUrl = process.env.KPG_BASE_URL;

test.beforeEach(async ({ page }) => {
  const response = await page.request.post(`${baseUrl}/knowledge-center/api/auth/admin/login`, { data: { username: 'admin', password: 'admin' } });
  expect(response.ok()).toBe(true);
});

async function permissionsFixture(page, failure = false) {
  let rowVersion = 7;
  let roles = ['KNOWLEDGE_EDITOR'];
  const writes = [];
  await page.route('**/knowledge-center/api/auth/users**', async route => {
    const request = route.request();
    if (request.method() === 'GET') {
      await route.fulfill({ json: { success: true, content: {
        users: [
          { id: 'fixture-cas', loginName: 'fixture', displayName: '赋权测试用户', identitySource: 'cas', enabled: true, roles, rowVersion, rolesEditable: true },
          { id: 'fixture-local', loginName: 'local', displayName: '本地测试账号', identitySource: 'local', enabled: true, roles: ['PLATFORM_ADMIN'], rolesEditable: false },
        ],
        assignableRoles: ['KNOWLEDGE_EDITOR', 'REVIEWER', 'PLATFORM_ADMIN'],
      } } });
      return;
    }
    const headers = request.headers();
    writes.push({ headers, body: request.postDataJSON() });
    if (failure) {
      await route.fulfill({ status: 409, json: { success: false, error: { message: '用户权限已被更新，请刷新后重试' } } });
      return;
    }
    if (headers['if-match'] !== String(rowVersion) || !headers['idempotency-key']) {
      await route.fulfill({ status: 428, json: { success: false, error: { message: '缺少角色保存前置条件' } } });
      return;
    }
    roles = request.postDataJSON().roles;
    rowVersion += 1;
    await route.fulfill({ json: { success: true, content: { user: { id: 'fixture-cas', roles } } } });
  });
  await page.goto(`${baseUrl}/knowledge-center/platform?tab=permissions`);
  await page.locator('[data-permission-user="fixture-cas"]').click();
  return writes;
}

test('CAS 用户赋权保存和撤销携带最新行版本，迟到概览不覆盖撤销草稿', async ({ page }) => {
  let releaseOverview;
  const overviewGate = new Promise(resolve => { releaseOverview = resolve; });
  await page.route('**/knowledge-center/api/platform/overview**', async route => {
    const response = await route.fetch();
    await overviewGate;
    await route.fulfill({ response });
  });
  try {
    const writes = await permissionsFixture(page);
    await page.getByLabel('审核管理员', { exact: true }).check();
    await page.getByRole('button', { name: '保存权限', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('权限已保存');
    await expect(page.getByLabel('审核管理员', { exact: true })).toBeChecked();
    await page.getByLabel('审核管理员', { exact: true }).uncheck();
    // The unrelated overview is deliberately delivered while a role draft is
    // dirty, reproducing the real initial-load render race without sleeps.
    await expect(page.locator('#main')).toHaveAttribute('aria-busy', 'true');
    releaseOverview();
    await expect(page.locator('#main')).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.getByLabel('审核管理员', { exact: true })).not.toBeChecked();
    await page.getByRole('button', { name: '保存权限', exact: true }).click();
    await expect.poll(() => writes.length).toBe(2);
    expect(writes[0].headers['if-match']).toBe('7');
    expect(writes[1].headers['if-match']).toBe('8');
    expect(writes[1].headers['idempotency-key']).not.toBe(writes[0].headers['idempotency-key']);
    expect(writes[0].body).toEqual({ roles: ['KNOWLEDGE_EDITOR', 'REVIEWER'] });
    expect(writes[1].body).toEqual({ roles: ['KNOWLEDGE_EDITOR'] });
  } finally {
    releaseOverview();
  }
});

test('本地账号赋权保持只读，数据库冲突显示具体错误且不显示成功', async ({ page }) => {
  const writes = await permissionsFixture(page, true);
  await page.locator('[data-permission-user="fixture-local"]').click();
  await expect(page.getByRole('button', { name: '保存权限', exact: true })).toBeDisabled();
  await expect(page.getByLabel('审核管理员', { exact: true })).toBeDisabled();
  expect(writes).toHaveLength(0);
  await page.locator('[data-permission-user="fixture-cas"]').click();
  await page.getByLabel('审核管理员', { exact: true }).check();
  await page.getByRole('button', { name: '保存权限', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('用户权限已被更新，请刷新后重试');
  await expect(page.getByText('权限已保存', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('审核管理员', { exact: true })).toBeChecked();
});
