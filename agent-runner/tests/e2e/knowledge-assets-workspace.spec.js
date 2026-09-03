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

test('管理员看到必要字段、单一更新时间和真实服务端分页', async ({ page }) => {
  let assetRequests = 0;
  await page.route('**/knowledge-center/api/assets/handbooks*', async route => {
    assetRequests += 1;
    await route.continue();
  });
  await page.goto(`${baseUrl}/knowledge-center/assets?pageSize=10`);
  const root = page.locator('#view-root');
  await expect(root.getByRole('heading', { name: '知识资产' })).toBeVisible();
  await expect(root.getByRole('columnheader', { name: '手册名称' })).toBeVisible();
  await expect(root.getByRole('columnheader', { name: '责任人' })).toBeVisible();
  await expect(root.getByRole('columnheader', { name: '仓库版本' })).toBeVisible();
  await expect(root.getByRole('columnheader', { name: '内容规模' })).toBeVisible();
  await expect(root.getByText('A：', { exact: false }).first()).toBeVisible();
  await expect(root.getByText('B：', { exact: false }).first()).toBeVisible();
  await expect(root.getByRole('button', { name: '新增手册' })).toBeVisible();
  await expect(root.locator('.asset-page-intro .asset-context-label')).toHaveCount(0);
  await expect(root.getByRole('button', { name: '新增手册' })).toHaveCSS('color', 'rgb(3, 105, 161)');
  await expect(root.getByRole('link', { name: '已停用资产' })).toBeVisible();
  await expect(root.getByRole('columnheader', { name: '管理' })).toHaveCount(0);
  await expect(root.getByRole('button', { name: '查看', exact: true })).toHaveCount(0);
  await expect(root.getByText('手册发布')).toHaveCount(0);
  await expect(root.getByText('包含已归档')).toHaveCount(0);
  await expect(root.getByText(/(更新于|更新时间暂不可用)/)).toHaveCount(1);
  await expect(root.getByText(/第 1 \/ \d+ 页，共 \d+ 本/)).toBeVisible();

  const before = assetRequests;
  await root.getByRole('link', { name: '待创建' }).click();
  await expect(page).toHaveURL(/status=asset_created/);
  await expect.poll(() => assetRequests).toBeGreaterThan(before);
  await expect(root.getByText('目录条目')).toHaveCount(0);
});

test('新增对话框展示必要字段且取消不会提交', async ({ page }) => {
  let posts = 0;
  await page.route('**/knowledge-center/api/assets/handbooks', async route => {
    if (route.request().method() === 'POST') posts += 1;
    await route.continue();
  });
  await page.goto(`${baseUrl}/knowledge-center/assets`);
  await page.getByRole('button', { name: '新增手册' }).click();
  const dialog = page.getByRole('dialog', { name: '新增手册' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('建立基础信息，创建后继续完善大纲。')).toBeVisible();
  await expect(dialog.getByText('对外可见', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('switch')).not.toBeChecked();
  await expect(dialog.getByRole('button', { name: '创建手册' })).toBeVisible();
  await expect(dialog.locator('summary')).toHaveText('添加概要说明');
  await expect(dialog.locator('[data-asset-dialog-close] svg')).toHaveAttribute('data-lucide', 'x');
  await expect(dialog).toHaveCSS('border-radius', '8px');
  await expect(dialog.locator('input[name="name"]')).toHaveCSS('border-radius', '6px');
  const switchTrack = dialog.locator('.asset-switch > span').first();
  await expect(switchTrack).toHaveCSS('width', '38px');
  await expect(switchTrack).toHaveCSS('height', '22px');
  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(page.getByRole('dialog', { name: '新增手册' })).not.toBeVisible();
  expect(posts).toBe(0);
});

for (const viewport of [
  { name: '桌面', width: 1440, height: 900 },
  { name: '平板', width: 768, height: 1024 },
  { name: '移动', width: 375, height: 812 },
]) {
  test(`${viewport.name}端无页面级横向溢出`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}/knowledge-center/assets`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test('移动端从列表进入全屏操作视图并可返回', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${baseUrl}/knowledge-center/assets`);
  const firstManual = page.locator('[data-asset-id]').first();
  await firstManual.click();
  await expect(page).toHaveURL(/handbookId=/);
  await expect(page.getByRole('link', { name: '返回手册列表' })).toBeVisible();
  await expect(page.getByRole('link', { name: '大纲管理' })).toBeVisible();
  await expect(page.getByRole('link', { name: '文档生产' })).toBeVisible();
  await expect(page.getByRole('link', { name: '审核与发布' })).toBeVisible();
  await expect(page.getByRole('button', { name: /管理手册/ })).toBeVisible();
  await page.getByRole('link', { name: '返回手册列表' }).click();
  await expect(page).not.toHaveURL(/handbookId=/);
  await expect(page.getByRole('table', { name: '在用手册资产列表' })).toBeVisible();
});

test('默认列表全宽，点击手册名称后打开并可关闭弹性操作栏', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/knowledge-center/assets`);
  const workspace = page.locator('.asset-workspace');
  await expect(workspace).not.toHaveClass(/asset-detail-open/);
  await expect(page.getByLabel('当前手册操作')).toHaveCount(0);
  await expect(page.locator('.asset-workspace-list')).toBeVisible();
  const before = await page.locator('.asset-workspace-list').boundingBox();
  expect(before).not.toBeNull();
  await page.locator('[data-asset-id]').first().click();
  await expect(workspace).toHaveClass(/asset-detail-open/);
  const actionPanel = page.getByLabel('当前手册操作');
  await expect(actionPanel).toBeVisible();
  await expect(actionPanel.locator('.asset-context-label')).toHaveCount(0);
  const actions = actionPanel.locator('.asset-action-row');
  expect(await actions.count()).toBeGreaterThanOrEqual(5);
  await expect(actionPanel.getByText('文档工作', { exact: true })).toHaveCount(0);
  await expect(actionPanel.getByText('手册管理', { exact: true })).toHaveCount(0);
  await expect(actionPanel.getByRole('button', { name: /管理手册/ })).toBeVisible();
  await expect(actionPanel.getByText('配置仓库映射', { exact: true }).or(actionPanel.getByText('维护仓库映射', { exact: true }))).toBeVisible();
  await expect(actionPanel.getByText('仓库内容', { exact: true })).toHaveCount(0);
  await expect(actionPanel.locator('[data-asset-detail-close] svg')).toHaveAttribute('data-lucide', 'x');
  await expect(actionPanel.getByText('A 角', { exact: true })).toHaveCount(0);
  await expect(actionPanel.getByText('B 角', { exact: true })).toHaveCount(0);
  await expect(actionPanel.getByText('章节', { exact: true })).toHaveCount(0);
  await expect(actionPanel.getByText('页面', { exact: true })).toHaveCount(0);
  await expect(page.locator('.asset-workspace-list')).toBeVisible();
  await expect.poll(async () => (await page.locator('.asset-workspace-list').boundingBox())?.width ?? before.width).toBeLessThan(before.width);
  await page.getByRole('button', { name: '关闭手册操作' }).click();
  await expect(page).not.toHaveURL(/handbookId=/);
  await expect(page.getByLabel('当前手册操作')).toHaveCount(0);
});

test('管理手册集中展示基本信息、责任人、状态与停用能力', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/assets`);
  await page.locator('[data-asset-id]').first().click();
  await page.getByRole('button', { name: /管理手册/ }).click();
  const dialog = page.getByRole('dialog', { name: '管理手册' });
  await expect(dialog.getByLabel('手册名称')).toBeVisible();
  await expect(dialog.getByLabel('A 角')).toBeVisible();
  await expect(dialog.getByLabel('B 角')).toBeVisible();
  await expect(dialog.getByLabel('手册状态')).toBeVisible();
  await expect(dialog.getByLabel('变更原因')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '停用手册' })).toBeVisible();
  await dialog.getByRole('button', { name: '取消' }).click();
});

test('仓库映射配置默认分支和可切换分支并使用平台配色', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/assets?handbookId=DB-001`);
  await page.getByRole('button', { name: /仓库映射/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('选择分支')).toBeVisible();
  await expect(dialog.getByText('允许在知识资产中切换的分支', { exact: true })).toBeVisible();
  await expect(dialog.locator('[data-mapping-enabled-branches]')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '中文内容' })).toHaveCSS('background-color', 'rgb(3, 105, 161)');
});

test('仓库映射以多层目录树展示且文件不可选', async ({ page }) => {
  await page.route('**/knowledge-center/api/gitlab/connections/*/branches', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ name: 'master', protected: true }, { name: 'release', protected: false }] }) }));
  await page.route('**/knowledge-center/api/gitlab/connections/*/tree*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [
    { name: 'doc', path: 'doc', type: 'tree' },
    { name: '产品文档', path: 'doc/产品文档', type: 'tree' },
    { name: '产品描述', path: 'doc/产品文档/产品描述', type: 'tree' },
    { name: '_index.md', path: 'doc/产品文档/产品描述/_index.md', type: 'blob' },
    { name: 'Manuals', path: 'doc/Manuals', type: 'tree' },
    { name: 'Product Overview', path: 'doc/Manuals/Product Overview', type: 'tree' },
    { name: '_index.md', path: 'doc/Manuals/Product Overview/_index.md', type: 'blob' },
  ] }) }));
  await page.goto(`${baseUrl}/knowledge-center/assets?handbookId=DB-001`);
  await page.getByRole('button', { name: /仓库映射/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('手册映射路径', { exact: true })).toBeVisible();
  await expect(dialog.getByText('选择内容路径', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('GitLab 连接').selectOption({ index: 1 });
  await expect(dialog.getByRole('tree', { name: 'GitLab 仓库目录' })).toBeVisible();
  await dialog.getByRole('button', { name: '展开 doc' }).click();
  await dialog.getByRole('button', { name: '展开 产品文档' }).click();
  await dialog.getByRole('button', { name: '展开 产品描述' }).click();
  const fileNode = dialog.locator('[data-mapping-tree-item="doc/产品文档/产品描述/_index.md"]');
  await expect(fileNode).toBeVisible();
  await expect(fileNode.locator('[data-mapping-tree-toggle]')).toHaveCount(0);
  await dialog.locator('[data-mapping-tree-item="doc/产品文档/产品描述"] [data-mapping-tree-toggle]').click();
  await expect(dialog.locator('[data-mapping-zh-tags]')).toContainText('doc/产品文档/产品描述');
  await dialog.getByRole('button', { name: '英文内容' }).click();
  await dialog.getByRole('button', { name: '展开 Manuals' }).click();
  await dialog.locator('[data-mapping-tree-item="doc/Manuals/Product Overview"] [data-mapping-tree-toggle]').click();
  await expect(dialog.locator('[data-mapping-en-tags]')).toContainText('doc/Manuals/Product Overview');
  await dialog.getByLabel('选择分支').selectOption('release');
  await expect(dialog.locator('[data-mapping-zh-tags]')).toContainText('尚未从目录选择中文路径');
  await expect(dialog.locator('[data-mapping-en-tags]')).toContainText('尚未从目录选择英文路径');
});

test('管理员通过二级入口查看已停用资产', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/assets`);
  await page.getByRole('link', { name: '已停用资产' }).click();
  await expect(page).toHaveURL(/lifecycle=inactive/);
  await expect(page.getByRole('heading', { name: '已停用资产' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '手册阶段筛选' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '返回在用资产' })).toBeVisible();
});

test('普通角色不显示资产生命周期管理入口', async ({ page }) => {
  await page.route('**/knowledge-center/api/auth/session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, content: { authenticated: true, user: { displayName: '普通用户', roles: ['KNOWLEDGE_EDITOR'], visibleModules: ['dashboard', 'assets'], allowedActions: ['knowledge:read'] }, roles: ['KNOWLEDGE_EDITOR'], visibleModules: ['dashboard', 'assets'], allowedActions: ['knowledge:read'] } }),
  }));
  await page.goto(`${baseUrl}/knowledge-center/assets`);
  await expect(page.getByRole('link', { name: '已停用资产' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '停用手册' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重新启用' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: '管理' })).toHaveCount(0);
});
