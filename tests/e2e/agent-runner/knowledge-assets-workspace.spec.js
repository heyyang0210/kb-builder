const { test, expect } = require('@playwright/test');

const baseUrl = process.env.KPG_BASE_URL;

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
  await expect(root.locator('[data-asset-more-menu] summary')).toBeVisible();
  await expect(root.getByRole('link', { name: /查看已停用资产/ })).not.toBeVisible();
  await expect(root.getByRole('columnheader', { name: '操作' })).toHaveCount(0);
  await expect(root.locator('tbody .asset-name').first()).toBeVisible();
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
  await expect(workspace).toHaveAttribute('data-asset-loaded', 'true');
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

test('长列表下方选择手册时保持滚动位置并显示吸顶操作栏', async ({ page }) => {
  const items = Array.from({ length: 50 }, (_, index) => ({
    handbookId: `STICKY-${String(index + 1).padStart(2, '0')}`,
    name: `吸顶测试手册 ${index + 1}`,
    status: 'asset_created',
    statusDisplayName: '待创建',
    ownerA: { principalId: 1, displayName: '测试负责人' },
    ownerB: null,
    repositoryMapped: false,
    chapterCount: index,
    documentCount: index,
    assetVersion: 1,
  }));
  await page.route('**/knowledge-center/api/assets/handbooks*', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {
      items, page: 1, pageSize: 50, total: 50, products: [], generatedAt: '2026-09-21T07:00:00.000Z',
      statistics: { asset_created: 50, outline_editing: 0, outline_published: 0, content_building: 0, handbook_published: 0 },
    } }) });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/knowledge-center/assets?pageSize=50`);
  const lastManual = page.getByRole('link', { name: '吸顶测试手册 50' });
  await lastManual.scrollIntoViewIfNeeded();
  const mainShell = page.locator('#main-shell');
  const before = await mainShell.evaluate(element => element.scrollTop);
  expect(before).toBeGreaterThan(0);
  await lastManual.click();
  const actionPanel = page.getByLabel('当前手册操作');
  await expect(actionPanel).toBeVisible();
  await expect(actionPanel.getByRole('button', { name: /管理手册/ })).toBeVisible();
  await expect.poll(async () => Math.abs(await mainShell.evaluate(element => element.scrollTop) - before)).toBeLessThan(1);
  const box = await actionPanel.boundingBox();
  expect(box).not.toBeNull();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeLessThan(100);
});

test('管理手册折叠高级操作并通过专用对话框确认停用', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/assets`);
  await page.locator('[data-asset-id]').first().click();
  await page.getByRole('button', { name: /管理手册/ }).click();
  const dialog = page.getByRole('dialog', { name: '管理手册' });
  await expect(dialog.getByLabel('手册名称')).toBeVisible();
  const ownerA = dialog.getByRole('combobox', { name: 'A 角，可输入筛选' });
  const ownerB = dialog.getByRole('combobox', { name: 'B 角，可输入筛选' });
  await expect(ownerA).toBeVisible();
  await expect(ownerB).toBeVisible();
  await expect(ownerA).toHaveAttribute('aria-autocomplete', 'list');
  await expect(ownerB).toHaveAttribute('aria-autocomplete', 'list');
  await expect(dialog.locator('select[name="ownerA"]')).toHaveAttribute('aria-hidden', 'true');
  await expect(dialog.locator('select[name="ownerB"]')).toHaveAttribute('aria-hidden', 'true');
  await ownerA.fill('heyang');
  const heyangOption = dialog.getByRole('option', { name: '何阳', exact: true });
  await expect(heyangOption).toBeVisible();
  await expect(dialog.getByRole('option', { name: /heyang/i })).toHaveCount(0);
  await heyangOption.click();
  await expect(ownerA).toHaveValue('何阳');
  await expect(dialog.locator('select[name="ownerA"]')).not.toHaveValue('');
  // 后续继续验证停用流程；恢复弹框初始快照，避免把 Combobox 选择测试当作未保存业务变更。
  await dialog.locator('form').evaluate(form => form.reset());
  const ownerLabels = await dialog.locator('select[name="ownerA"] option, select[name="ownerB"] option').allTextContents();
  expect(ownerLabels.some(label => label.includes(' · '))).toBe(false);
  if (ownerLabels.some(label => label.includes('何阳'))) expect(ownerLabels).toContain('何阳');
  await expect(dialog.getByLabel('手册状态')).toBeVisible();
  await expect(dialog.getByLabel('变更原因')).toBeVisible();
  const advanced = dialog.locator('[data-asset-advanced-actions]');
  await expect(advanced).not.toHaveAttribute('open', '');
  await expect(dialog.getByRole('button', { name: '停用手册' })).not.toBeVisible();
  await advanced.locator('summary').click();
  const archiveButton = dialog.getByRole('button', { name: '停用手册' });
  await expect(archiveButton).toBeVisible();

  const nameInput = dialog.getByLabel('手册名称');
  const originalName = await nameInput.inputValue();
  await nameInput.fill(`${originalName} 临时修改`);
  await archiveButton.click();
  await expect(dialog.getByText('请先保存或取消当前修改，再停用手册。')).toBeVisible();
  await expect(page.getByRole('dialog', { name: /确认停用/ })).toHaveCount(0);

  await nameInput.fill(originalName);
  await archiveButton.click();
  const confirmDialog = page.getByRole('dialog', { name: /确认停用/ });
  await expect(confirmDialog).toBeVisible();
  await expect(dialog).not.toBeVisible();
  await expect(confirmDialog.getByText('从在用资产列表和阶段统计中隐藏')).toBeVisible();
  await expect(confirmDialog.getByText('仓库映射、文档和版本继续保留')).toBeVisible();
  await expect(confirmDialog.getByText('责任关系和审计记录继续保留')).toBeVisible();
  await confirmDialog.getByRole('button', { name: '取消' }).click();
  await expect(dialog).toBeVisible();
  await expect(archiveButton).toBeFocused();
  await dialog.getByRole('button', { name: '取消' }).click();
});

test('停用失败时确认对话框保留错误并允许重试', async ({ page }) => {
  await page.route('**/knowledge-center/api/assets/handbooks/*/archive', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, error: { code: 'ASSET_ARCHIVE_FAILED', message: '模拟停用失败' } }),
  }));
  await page.goto(`${baseUrl}/knowledge-center/assets`);
  await page.locator('[data-asset-id]').first().click();
  await page.getByRole('button', { name: /管理手册/ }).click();
  const dialog = page.getByRole('dialog', { name: '管理手册' });
  await dialog.locator('[data-asset-advanced-actions] summary').click();
  await dialog.getByRole('button', { name: '停用手册' }).click();
  const confirmDialog = page.getByRole('dialog', { name: /确认停用/ });
  const confirmButton = confirmDialog.getByRole('button', { name: '确认停用' });
  await confirmButton.click();
  await expect(confirmDialog).toBeVisible();
  await expect(confirmDialog.getByText('模拟停用失败')).toBeVisible();
  await expect(confirmButton).toBeEnabled();
});

test('手册名称打开操作栏，大纲和手册管理保持独立入口', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/assets`);
  await expect(page.locator('.asset-workspace')).toHaveAttribute('data-asset-loaded', 'true');
  const nameLink = page.locator('tbody tr').first().locator('.asset-name');
  const handbookId = await nameLink.getAttribute('data-asset-id');
  expect(handbookId).toBeTruthy();
  await nameLink.click();
  await expect(page).toHaveURL(new RegExp(`/knowledge-center/assets\\?handbookId=${handbookId}`));
  await expect(page.getByRole('button', { name: /管理手册/ })).toBeVisible();
  const actionPanel = page.getByLabel('当前手册操作');
  await expect(actionPanel).toBeVisible();
  await expect(actionPanel.getByRole('link', { name: /大纲管理/ })).toBeVisible();
  await actionPanel.getByRole('link', { name: /大纲管理/ }).click();
  await expect(page).toHaveURL(new RegExp(`/knowledge-center/outlines/${handbookId}`));
  await expect(page.getByRole('link', { name: '手册管理', exact: true })).toHaveCount(0);
});

test('仓库映射配置默认分支和可切换分支并使用平台配色', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/assets?handbookId=DB-001`);
  await page.getByRole('button', { name: /仓库映射/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('combobox', { name: '选择分支，可输入筛选' })
  ).toBeVisible();
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
  const initialBranchResponse = page.waitForResponse(response => response.url().includes('/branches'));
  const initialTreeResponse = page.waitForResponse(response => response.url().includes('/tree'));
  await page.getByRole('button', { name: /仓库映射/ }).click();
  await Promise.all([initialBranchResponse, initialTreeResponse]);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('手册映射路径', { exact: true })).toBeVisible();
  await expect(dialog.getByText('选择内容路径', { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('tree', { name: 'GitLab 仓库目录' })).toBeVisible();
  const dispatchTreeClick = selector => page.evaluate(currentSelector => {
    const control = document.querySelector(currentSelector);
    if (!control) return false;
    control.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  }, selector);
  const ensureTreeExpanded = path => page.evaluate(currentPath => {
    const item = document.querySelector(`[data-mapping-tree-item="${CSS.escape(currentPath)}"]`);
    if (!item) return false;
    if (item.getAttribute('aria-expanded') === 'true') return true;
    const control = item.querySelector('[data-mapping-tree-expand]');
    if (!control) return false;
    control.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  }, path);
  expect(await ensureTreeExpanded('doc')).toBe(true);
  expect(await ensureTreeExpanded('doc/产品文档')).toBe(true);
  expect(await ensureTreeExpanded('doc/产品文档/产品描述')).toBe(true);
  const fileNode = dialog.locator('[data-mapping-tree-item="doc/产品文档/产品描述/_index.md"]');
  await expect(fileNode).toBeVisible();
  await expect(fileNode.locator('[data-mapping-tree-toggle]')).toHaveCount(0);
  // 连接切换会并行刷新分支与目录；等待最后一次目录渲染落定后再选择路径。
  await page.waitForTimeout(300);
  const chineseTags = dialog.locator('[data-mapping-zh-tags]');
  if (!(await chineseTags.textContent())?.includes('doc/产品文档/产品描述')) {
    const selectedChinesePath = await dispatchTreeClick('[data-mapping-tree-toggle="doc/产品文档/产品描述"]');
    expect(selectedChinesePath).toBe(true);
  }
  await expect(dialog.locator('[data-mapping-zh-tags]')).toContainText('doc/产品文档/产品描述');
  expect(await dispatchTreeClick('[data-mapping-language="en"]')).toBe(true);
  expect(await ensureTreeExpanded('doc/Manuals')).toBe(true);
  const englishTags = dialog.locator('[data-mapping-en-tags]');
  if (!(await englishTags.textContent())?.includes('doc/Manuals/Product Overview')) {
    const selectedEnglishPath = await dispatchTreeClick('[data-mapping-tree-toggle="doc/Manuals/Product Overview"]');
    expect(selectedEnglishPath).toBe(true);
  }
  await expect(dialog.locator('[data-mapping-en-tags]')).toContainText('doc/Manuals/Product Overview');
  const branchInput = dialog.getByRole('combobox', {
    name: '选择分支，可输入筛选',
  });
  const releaseTreeResponse = page.waitForResponse(response => response.url().includes('/tree'));
  await branchInput.click();
  await branchInput.fill('release');
  await page.getByRole('option', { name: 'release', exact: true }).click();
  await releaseTreeResponse;
  await expect(dialog.locator('[data-mapping-zh-tags]')).toContainText('尚未从目录选择中文路径');
  await expect(dialog.locator('[data-mapping-en-tags]')).toContainText('尚未从目录选择英文路径');
});

test('管理员通过二级入口查看已停用资产', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/assets`);
  const moreTrigger = page.locator('[data-asset-more-menu] summary');
  await moreTrigger.click();
  const inactiveLink = page.getByRole('link', { name: /查看已停用资产/ });
  await expect(inactiveLink).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(inactiveLink).not.toBeVisible();
  await expect(moreTrigger).toBeFocused();
  await moreTrigger.click();
  await inactiveLink.click();
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
  await expect(page.locator('[data-asset-more-menu]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /查看已停用资产/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '停用手册' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重新启用' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: '管理' })).toHaveCount(0);
});
