const { test, expect } = require('@playwright/test');

const baseUrl = process.env.KPG_BASE_URL || 'http://127.0.0.1:13510';

async function loginAsAdmin(page) {
  await page.goto(`${baseUrl}/knowledge-center/`);
  await page.getByText('平台管理登录').click();
  await page.getByLabel('管理员账号').fill('admin');
  await page.getByLabel('管理员密码').fill('admin');
  await page.getByRole('button', { name: '登录平台管理' }).click();
  await expect(page).toHaveURL(`${baseUrl}/knowledge-center/platform`);
}

test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });

test('已认证用户刷新 GitLab 标签页保持登录且没有页面异常', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(`${baseUrl}/knowledge-center/platform?tab=gitlab`);
  await expect(page.getByRole('tab', { name: 'GitLab 仓库' })).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(page.locator('#app-shell')).toBeVisible();
  await expect(page.locator('#auth-shell')).toBeHidden();
  expect(pageErrors).toEqual([]);
});

test('未连接 OAuth 时展示授权入口并阻止无效验证', async ({ page }) => {
  await page.route('**/knowledge-center/api/gitlab/oauth/status', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { connected: false } }) }));
  await page.route('**/knowledge-center/api/gitlab/oauth/config', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { configured: true, devHttp: true } }) }));
  await page.route('**/knowledge-center/api/gitlab/connections', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [{ id: 'gitlab-yasdoc', name: 'yasdoc', baseUrl: 'https://git-tools.yasdb.com', projectPath: 'cod-doc/yasdoc', mode: 'production', authMode: 'user_oauth', purpose: 'read', status: 'pending' }] } }) }));
  await page.goto(`${baseUrl}/knowledge-center/platform?tab=gitlab`);
  await expect(page.getByText('尚未连接 GitLab 账号')).toBeVisible();
  await expect(page.getByRole('link', { name: '连接 GitLab 账号' })).toHaveAttribute('href', /connectionId=gitlab-yasdoc/);
  await expect(page.getByRole('button', { name: '验证连接' })).toBeDisabled();
});

test('验证连接展示进行中、成功结果并在刷新数据后保留', async ({ page }) => {
  let verified = false;
  await page.route('**/knowledge-center/api/gitlab/oauth/status', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { connected: true } }) }));
  await page.route('**/knowledge-center/api/gitlab/connections', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [{ id: 'gitlab-yasdoc', name: 'yasdoc', baseUrl: 'https://git-tools.yasdb.com', projectPath: 'cod-doc/yasdoc', mode: 'production', authMode: 'user_oauth', purpose: 'read', status: verified ? 'verified' : 'pending', lastVerification: verified ? { status: 'verified', branchCount: 3, verifiedAt: '2026-09-04T08:00:00.000Z' } : null }] } }) }));
  await page.route('**/knowledge-center/api/gitlab/connections/gitlab-yasdoc/verify', async route => {
    await new Promise(resolve => setTimeout(resolve, 150));
    verified = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { connectionId: 'gitlab-yasdoc', status: 'verified', branchCount: 3, verifiedAt: '2026-09-04T08:00:00.000Z' } }) });
  });
  await page.goto(`${baseUrl}/knowledge-center/platform?tab=gitlab`);
  await page.getByRole('button', { name: '验证连接' }).click();
  await expect(page.getByText('正在验证连接…')).toBeVisible();
  await expect(page.getByText('3 个分支', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '重新验证' })).toBeVisible();
});

test('验证失败显示原因并允许重新验证', async ({ page }) => {
  await page.route('**/knowledge-center/api/gitlab/oauth/status', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { connected: true } }) }));
  await page.route('**/knowledge-center/api/gitlab/connections', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [{ id: 'gitlab-yasdoc', name: 'yasdoc', baseUrl: 'https://git-tools.yasdb.com', projectPath: 'cod-doc/yasdoc', mode: 'production', authMode: 'user_oauth', purpose: 'read', status: 'failed', lastVerification: { status: 'failed', verifiedAt: '2026-09-04T08:00:00.000Z', error: { code: 'GITLAB_FORBIDDEN', message: '没有仓库读取权限' } } }] } }) }));
  await page.goto(`${baseUrl}/knowledge-center/platform?tab=gitlab`);
  await expect(page.getByRole('alert')).toContainText('没有仓库读取权限');
  await expect(page.getByRole('button', { name: '重新验证' })).toBeEnabled();
});

test('新增连接使用当前多仓库表单和幂等请求', async ({ page }) => {
  let savedRequest;
  await page.route('**/knowledge-center/api/gitlab/connections', async route => {
    if (route.request().method() === 'POST') {
      savedRequest = route.request();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: 'gitlab-new', name: 'docs', mode: 'production', authMode: 'user_oauth', purpose: 'read' } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [] } }) });
  });
  await page.goto(`${baseUrl}/knowledge-center/platform?tab=gitlab`);
  await page.getByRole('button', { name: '添加仓库连接' }).click();
  const form = page.locator('[data-gitlab-add-form]');
  await form.getByLabel('连接名称').fill('docs');
  await form.getByLabel('GitLab 地址').fill('https://git-tools.yasdb.com');
  await form.getByLabel('项目路径').fill('cod-doc/docs');
  await form.getByRole('button', { name: '保存并验证' }).click();
  await expect.poll(() => savedRequest?.headers()['idempotency-key']).toBeTruthy();
  expect(savedRequest.postDataJSON()).toMatchObject({ baseUrl: 'https://git-tools.yasdb.com', projectPath: 'cod-doc/docs', authMode: 'user_oauth', purpose: 'read' });
});

test('GitLab 管理页在常用宽度下无横向溢出', async ({ page }) => {
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 700 ? 812 : 900 });
    await page.goto(`${baseUrl}/knowledge-center/platform?tab=gitlab`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
});
