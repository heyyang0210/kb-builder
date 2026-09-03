const { test, expect } = require('@playwright/test');

const baseUrl = process.env.KPG_BASE_URL || 'http://127.0.0.1:13510';

test.beforeEach(async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/`);
  await page.getByText('平台管理登录').click();
  await page.getByLabel('管理员账号').fill('admin');
  await page.getByLabel('管理员密码').fill('admin');
  await page.getByRole('button', { name: '登录平台管理' }).click();
  await expect(page).toHaveURL(`${baseUrl}/knowledge-center/platform`);
});

test('管理员可配置 GitLab 连接且请求携带幂等键', async ({ page }) => {
  let savedRequest;
  await page.route('**/knowledge-center/api/gitlab/connections', async route => {
    if (route.request().method() === 'PUT') {
      savedRequest = route.request();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: 'gitlab-1', name: 'yasdoc', mode: 'disabled', credentialConfigured: true } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [] } }) });
  });
  await page.goto(`${baseUrl}/knowledge-center/platform`);
  const form = page.locator('[data-gitlab-connection-form]');
  await expect(form).toBeVisible();
  await form.getByLabel('GitLab 地址').fill('https://git-tools.yasdb.com');
  await form.getByLabel('项目路径').fill('cod-doc/yasdoc');
  await form.locator('summary', { hasText: '兼容模式' }).click();
  await form.getByLabel('凭证引用').fill('production_read');
  await form.getByRole('button', { name: '保存连接' }).click();
  await expect.poll(() => savedRequest?.headers()['idempotency-key']).toBeTruthy();
  expect(savedRequest.postDataJSON()).toMatchObject({ project: 'cod-doc/yasdoc', credentialRef: 'production_read' });
});

test('手册阅读页展示分支、语言、层级目录和正文', async ({ page }) => {
  await page.route('**/knowledge-center/api/gitlab/handbooks/DB-001/branches', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { handbookName: '数据库管理手册', connectionName: 'yasdoc', project: 'cod-doc/yasdoc', defaultBranch: 'master', languages: { zh: true, en: true }, items: [{ name: 'master', commitSha: 'abcdef123456' }] } }) }));
  await page.route('**/knowledge-center/api/gitlab/handbooks/DB-001/tree*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ name: '基础管理', path: 'doc/产品文档/基础管理', type: 'tree' }, { name: '_index.md', path: 'doc/产品文档/基础管理/_index.md', type: 'blob' }] }) }));
  await page.route('**/knowledge-center/api/gitlab/handbooks/DB-001/file*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { path: 'doc/产品文档/基础管理/_index.md', content: '# 基础管理\n\n这是仓库中的真实文档投影。', commitId: 'abcdef123456' } }) }));
  await page.goto(`${baseUrl}/knowledge-center/assets/DB-001/repository`);
  await expect(page.getByRole('heading', { name: '数据库管理手册' })).toBeVisible();
  await expect(page.getByRole('group', { name: '文档语言' })).toBeVisible();
  await expect(page.getByRole('button', { name: '_index.md' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '基础管理' }).last()).toBeVisible();
  await expect(page.getByText('abcdef12')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
