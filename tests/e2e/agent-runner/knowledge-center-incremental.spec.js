const { test, expect } = require('@playwright/test');

const baseUrl = process.env.KPG_BASE_URL || 'http://127.0.0.1:13510';

test.beforeEach(async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/`);
  await expect(page.locator('#app-shell:not([hidden]), #auth-shell:not([hidden])')).toBeVisible();
  const adminLogin = page.locator('#admin-login-details > summary');
  if (await adminLogin.isVisible().catch(() => false)) {
    await adminLogin.click();
    await page.getByLabel('管理员账号').fill('admin');
    await page.getByLabel('管理员密码').fill('admin');
    await page.getByRole('button', { name: '登录平台管理' }).click();
    await expect(page).toHaveURL(`${baseUrl}/knowledge-center/platform`);
  }
});

test('增量任务展示真实状态、范围、草稿和检查结果', async ({ page }) => {
  const task = {
    id: 'inc-e2e', name: '更新安装说明', handbookId: 'DB-001', businessVersion: '23.4.5.100', baselineVersionId: 'baseline-v1', state: 'checked',
    sourceSnapshots: [{ id: 'src-1', sourceType: 'manual', label: 'SR 安装变更', reference: 'SR-100' }],
    target: { documentIds: ['doc-install'], sectionIds: ['section-1'], language: 'zh-CN' },
    draft: { editVersion: 1, content: '# 新安装步骤', operations: [{ type: 'update' }] },
    checks: { passed: true, issues: [] }, reviews: [], publication: null, externalEvidence: [], updatedAt: '2026-09-02T10:00:00.000Z',
  };
  await page.route('**/knowledge-center/api/incremental-tasks', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [task] }) }));
  await page.route('**/knowledge-center/api/incremental-tasks/inc-e2e', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: task }) }));
  await page.goto(`${baseUrl}/knowledge-center/production?taskId=inc-e2e`);
  await expect(page.getByRole('heading', { name: '更新安装说明' })).toBeVisible();
  await expect(page.getByText('完整性已检查', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('SR 安装变更')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '本次修改内容' })).toHaveValue('# 新安装步骤');
  await expect(page.getByRole('button', { name: '提交候选版本' })).toBeVisible();
});

test('服务失败时明确告知且移动端无横向溢出', async ({ page }) => {
  await page.route('**/knowledge-center/api/incremental-tasks', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'UNAVAILABLE', message: '增量服务暂时不可用' } }) }));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${baseUrl}/knowledge-center/production`);
  await expect(page.getByText('增量服务暂时不可用')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('文档生产入口读取真实增量任务列表而非演示数据', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/production`);
  await expect(page.locator('#view-root')).toContainText(/增量任务|暂无|服务暂时不可用/);
  await expect(page.locator('#view-root')).not.toContainText('演示数据');
});
