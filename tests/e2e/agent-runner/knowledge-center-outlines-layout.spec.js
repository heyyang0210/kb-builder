const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.KPG_BASE_URL;
const viewports = [
  { width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 375, height: 812 },
];

const evidenceDir = path.resolve(__dirname, '../../../runtime/test-results/navigation-pane-p0');
function evidencePath(name, browserName) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  return path.join(evidenceDir, `${name}-${browserName}.png`);
}

test.beforeEach(async ({ page }) => {
  const response = await page.request.post(`${baseUrl}/knowledge-center/api/auth/admin/login`, { data: { username: 'admin', password: 'admin' } });
  expect(response.ok()).toBe(true);
});

test('刷新首帧恢复收缩导航且隐藏导航恢复入口不覆盖页面标题', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowledge-center-sidebar-collapsed', 'true');
    localStorage.setItem('knowledge-center-sidebar-hidden', 'false');
    window.__sidebarFirstVisible = null;
    window.addEventListener('DOMContentLoaded', () => {
      const shell = document.querySelector('#app-shell');
      if (!shell) return;
      const capture = () => {
        if (shell.hidden || window.__sidebarFirstVisible) return;
        const sidebar = document.querySelector('#sidebar');
        window.__sidebarFirstVisible = {
          collapsed: shell.classList.contains('sidebar-collapsed'),
          width: sidebar.getBoundingClientRect().width,
          transitionDuration: getComputedStyle(sidebar).transitionDuration,
        };
      };
      new MutationObserver(capture).observe(shell, { attributes: true, attributeFilter: ['hidden'] });
      capture();
    }, { once: true });
  });

  await page.goto(`${baseUrl}/knowledge-center/outlines`);
  await expect(page.locator('#app-shell')).toHaveClass(/sidebar-collapsed/);
  const firstVisible = await page.evaluate(() => window.__sidebarFirstVisible);
  expect(firstVisible).toEqual({ collapsed: true, width: 64, transitionDuration: '0s' });

  await page.getByRole('button', { name: '展开导航' }).click();
  await page.getByRole('button', { name: '完全隐藏导航' }).click();
  const restore = page.getByRole('button', { name: '展开导航' });
  const heading = page.getByRole('heading', { name: '大纲管理', level: 2 });
  await expect(restore).toBeVisible();
  await expect(restore.locator('span')).toHaveCSS('position', 'absolute');
  const [restoreBox, headingBox] = await Promise.all([restore.boundingBox(), heading.boundingBox()]);
  expect(restoreBox && headingBox).toBeTruthy();
  const overlaps = !(restoreBox.x + restoreBox.width <= headingBox.x
    || headingBox.x + headingBox.width <= restoreBox.x
    || restoreBox.y + restoreBox.height <= headingBox.y
    || headingBox.y + headingBox.height <= restoreBox.y);
  expect(overlaps).toBe(false);
});

test('大纲版本标签中的空值不会导致详情视图渲染中断', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/knowledge-center/api/outline/governance/list', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [{ id: 'outline-null-tags', handbookId: 'null-tags', name: '空标签大纲', state: 'draft', businessVersionTags: [null] }] }),
  }));
  await page.route('**/knowledge-center/api/assets/handbooks?*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { items: [{ handbookId: 'null-tags', name: '空版本标签回归手册' }] } }),
  }));
  await page.route('**/knowledge-center/api/outline/governance/outline-null-tags', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { id: 'outline-null-tags', handbookId: 'null-tags', name: '空标签大纲', state: 'draft', businessVersionTags: [null], nodes: [], governance: {} } }),
  }));
  await page.route('**/knowledge-center/api/outline/build-tasks', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { tasks: [] } }),
  }));

  await page.goto(`${baseUrl}/knowledge-center/outlines/null-tags`);
  await expect(page.getByRole('heading', { name: '空版本标签回归手册' })).toBeVisible();
  await page.getByText('更多操作', { exact: true }).click();
  await page.getByRole('button', { name: '手册信息' }).click();
  await expect(page.locator('.outline-context')).toContainText('未设置');
  expect(pageErrors).toEqual([]);
});

test('大纲列表与详情独立，返回后恢复筛选', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(`${baseUrl}/knowledge-center/outlines`);
  await expect(page.getByRole('heading', { name: '大纲管理', level: 2 })).toBeVisible();
  await expect(page.locator('.outline-detail-shell')).toHaveCount(0);
  const search = page.getByLabel('搜索手册');
  const firstName = await page.locator('[data-outline-row]:visible').first().locator('td').first().locator('strong').textContent();
  await search.fill(firstName.slice(0, 4));
  await expect(page).toHaveURL(/q=/);
  await page.locator('[data-outline-row]:visible [data-outline-id]').first().click();
  await expect(page).toHaveURL(/\/knowledge-center\/outlines\/[^?]+\?q=/);
  await expect(page.getByRole('tab', { name: '文档总览' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.outline-governance-workbench')).toBeVisible();
  await expect(page.locator('.outline-node-list')).toBeVisible();
  await expect(page.locator('.outline-node-inspector')).toBeVisible();
  await expect(page.locator('[data-outline-document]').first()).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-outline-document-panel]:visible')).toContainText('主责技术领域');
  await expect(page.locator('[data-outline-document-menu]')).toHaveCount(0);
  const firstDocument = page.locator('[data-outline-document]').first();
  const firstDocumentId = await firstDocument.getAttribute('data-outline-document');
  await firstDocument.click({ button: 'right' });
  await expect(page.locator('[data-outline-context-menu]')).toBeVisible();
  await expect(page.locator('[data-outline-context-menu]')).toContainText('移动到目录');
  await expect(page.locator('[data-outline-context-menu]')).toHaveAttribute('data-document-id', firstDocumentId);
  await page.keyboard.press('Escape');
  await firstDocument.focus();
  await page.keyboard.press('Shift+F10');
  await expect(page.locator('[data-outline-context-menu]')).toHaveAttribute('data-document-id', firstDocumentId);
  await page.keyboard.press('Escape');
  const box = await firstDocument.boundingBox();
  await firstDocument.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 91, clientX: box.x + 20, clientY: box.y + 20 });
  await firstDocument.dispatchEvent('pointermove', { pointerType: 'touch', pointerId: 91, clientX: box.x + 25, clientY: box.y + 24 });
  await page.waitForTimeout(600);
  await expect(page.locator('[data-outline-context-menu]')).toHaveAttribute('data-document-id', firstDocumentId);
  await firstDocument.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 91, clientX: box.x + 25, clientY: box.y + 24 });
  await page.keyboard.press('Escape');
  const secondDocument = page.locator('[data-outline-document]').nth(1);
  if (await secondDocument.count()) {
    await secondDocument.click();
    await expect(page).toHaveURL(/document=/);
  }
  const firstDirectory = page.locator('[data-outline-directory]').first();
  if (await firstDirectory.count()) {
    const directoryId = await firstDirectory.getAttribute('data-outline-directory');
    await firstDirectory.click();
    await expect(page).toHaveURL(new RegExp(`node=${encodeURIComponent(directoryId)}`));
    await expect(page.locator('.outline-node-inspector')).toContainText('目录节点');
    await expect(page.locator('[data-outline-node-row]')).toHaveCount(await page.locator(`[data-directory-key="${directoryId}"] > details > ul > li`).count());
  }
  await page.getByRole('tab', { name: '分工管理' }).click();
  await expect(page).toHaveURL(/tab=assignments/);
  await page.reload();
  await expect(page.getByRole('tab', { name: '分工管理' })).toHaveAttribute('aria-selected', 'true');
  await page.getByText('更多操作', { exact: true }).click();
  await page.getByRole('button', { name: '手册信息' }).click();
  await expect(page.getByRole('heading', { name: '手册信息' })).toBeVisible();
  await page.getByRole('button', { name: '关闭手册信息' }).click();
  await page.getByRole('link', { name: '返回大纲列表' }).click();
  await expect(search).toHaveValue(firstName.slice(0, 4));
  expect(pageErrors).toEqual([]);
});

test('分工管理在团队未配置时提供阻断说明和团队配置入口', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/outlines/DB-017?tab=assignments`);
  await expect(page.getByRole('tab', { name: '分工管理' })).toHaveAttribute('aria-selected', 'true');
  const blocked = page.locator('.outline-assignment-blocked');
  if (await blocked.count()) {
    await expect(blocked).toContainText('团队尚未配置');
    await expect(page.locator('[data-domain-task-assignee]')).toHaveCount(0);
    await expect(page.locator('[data-outline-team-config-link]')).toBeVisible();
  } else {
    await expect(page.locator('.outline-assignment-workspace')).toBeVisible();
    await expect(page.locator('[data-outline-assignment-domain-filter]')).toHaveAttribute('data-searchable-select', 'true');
    const statsButton = page.getByRole('button', { name: '查看分工统计' });
    await expect(statsButton).toBeVisible();
    await expect(page.locator('.outline-assignment-leader')).toHaveCount(0);
    await expect(page.getByText('人员分派进度', { exact: true })).toHaveCount(0);
    await statsButton.click();
    const statsDialog = page.getByRole('dialog', { name: '分工统计' });
    await expect(statsDialog).toBeVisible();
    await expect(statsDialog).toContainText('领域负责人');
    await expect(statsDialog).toContainText('主责文档');
    await expect(statsDialog).toContainText('成员负载');
    await statsDialog.getByRole('button', { name: '关闭分工统计' }).click();
    await expect(statsButton).toBeFocused();
    const directory = page.locator('.outline-assignment-directory');
    await expect(directory).toBeVisible();
    await expect(directory).toHaveClass(/outline-navigation/);
    await expect(directory.locator('[data-directory-search]')).toBeVisible();
    await expect(directory.locator('details')).not.toHaveCount(0);
    const resizer = directory.locator('[data-navigation-pane-resizer]');
    await expect(resizer).toHaveAttribute('aria-valuemin', '240');
    await expect(resizer).toHaveAttribute('aria-valuemax', '380');
    const before = Number(await resizer.getAttribute('aria-valuenow'));
    await directory.locator('[data-directory-search]').fill('YashanDB');
    await expect(directory.locator('details[open]')).not.toHaveCount(0);
    await directory.locator('[data-directory-search]').fill('');
    await directory.locator('[data-navigation-pane-resizer]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(directory.locator('[data-navigation-pane-resizer]')).toHaveAttribute('aria-valuenow', String(before + 16));
    await directory.locator('[data-navigation-pane-toggle]').click();
    await expect(page.locator('.outline-assignment-layout')).toHaveClass(/navigation-pane-collapsed/);
    await directory.locator('[data-navigation-pane-toggle]').click();
    const scrollOwners = await page.evaluate(() => ({
      main: getComputedStyle(document.querySelector('.main-shell')).overflowY,
      directory: getComputedStyle(document.querySelector('.outline-assignment-directory')).overflowY,
      directoryBody: getComputedStyle(document.querySelector('.outline-assignment-directory .outline-navigation-scroll')).overflowY,
      table: getComputedStyle(document.querySelector('.outline-responsibility-table-wrap')).overflowY,
    }));
    expect(scrollOwners.main).toBe('auto');
    expect(scrollOwners.directory).toBe('visible');
    expect(scrollOwners.directoryBody).toBe('visible');
    expect(scrollOwners.table).toBe('visible');
  }
});

test('P0：文档总览目录可搜索、可调宽和可折叠，目录不提供待分领域筛选', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/outlines/DB-017`);
  const layout = page.locator('[data-navigation-layout-id="outline-overview"]');
  if (!await layout.count()) return;
  await expect(layout.locator('[data-outline-directory-search]')).toBeVisible();
  await expect(layout.locator('[data-outline-unassigned-filter]')).toHaveCount(0);
  const handle = layout.locator('[data-navigation-pane-resizer]');
  await expect(handle).toHaveAttribute('aria-valuemin', '240');
  await expect(handle).toHaveAttribute('aria-valuemax', '380');
  const before = Number(await handle.getAttribute('aria-valuenow'));
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await expect(handle).toHaveAttribute('aria-valuenow', String(before + 16));
  await page.keyboard.press('Enter');
  await expect(handle).toHaveAttribute('aria-valuenow', '280');
  await layout.locator('[data-navigation-pane-toggle]').click();
  await expect(layout).toHaveClass(/navigation-pane-collapsed/);
  await layout.locator('[data-navigation-pane-toggle]').click();
  await expect(layout).not.toHaveClass(/navigation-pane-collapsed/);
});

test('P1：目录树支持键盘移动、展开收起和当前项滚动定位', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/outlines/DB-017`);
  const tree = page.locator('[data-navigation-layout-id="outline-overview"] [role="tree"]').first();
  await expect(tree).toBeVisible();
  const items = tree.locator('[role="treeitem"]');
  await expect(items).not.toHaveCount(0);
  const first = items.first();
  await first.focus();
  await expect(first).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(tree.locator('[role="treeitem"]:focus')).toHaveCount(1);
  await page.keyboard.press('End');
  await expect(tree.locator('[role="treeitem"]:focus')).toHaveCount(1);
  await page.keyboard.press('Home');
  await expect(tree.locator('[role="treeitem"]:focus')).toHaveCount(1);
  const expandable = tree.locator('[role="treeitem"][aria-expanded="true"], [role="treeitem"][aria-expanded="false"]').first();
  if (await expandable.count()) {
    await expandable.focus();
    const before = await expandable.getAttribute('aria-expanded');
    await page.keyboard.press(before === 'true' ? 'ArrowLeft' : 'ArrowRight');
    await expect(expandable).toHaveAttribute('aria-expanded', before === 'true' ? 'false' : 'true');
  }
});

test('P0：目录鼠标拖动可提交，Escape 和 pointercancel 可回退，动态重绘后仍可操作', async ({ page, browserName }, testInfo) => {
  await page.goto(`${baseUrl}/knowledge-center/outlines/DB-017`);
  let layout = page.locator('[data-navigation-layout-id="outline-overview"]');
  let handle = layout.locator('[data-navigation-pane-resizer]');
  await expect(handle).toBeVisible();
  const initial = Number(await handle.getAttribute('aria-valuenow'));
  const box = await handle.boundingBox();
  expect(box).toBeTruthy();

  const layoutBox = await layout.boundingBox();
  expect(layoutBox).toBeTruthy();
  await handle.evaluate((element, coordinates) => {
    element.setPointerCapture = () => {};
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 70, button: 0, clientX: coordinates.startX, clientY: coordinates.y }));
    element.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 70, button: 0, clientX: coordinates.endX, clientY: coordinates.y }));
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 70, button: 0, clientX: coordinates.endX, clientY: coordinates.y }));
  }, { startX: layoutBox.x + initial, endX: layoutBox.x + initial + 40, y: box.y + box.height / 2 });
  const committed = Number(await handle.getAttribute('aria-valuenow'));
  expect(committed).toBeGreaterThan(initial);

  await handle.dispatchEvent('pointerdown', { pointerId: 71, button: 0, clientX: box.x, clientY: box.y });
  await handle.dispatchEvent('pointermove', { pointerId: 71, clientX: box.x + 70, clientY: box.y });
  await handle.focus();
  await page.keyboard.press('Escape');
  await expect(handle).toHaveAttribute('aria-valuenow', String(committed));
  await expect(layout).not.toHaveClass(/navigation-pane-resizing/);

  await handle.dispatchEvent('pointerdown', { pointerId: 72, button: 0, clientX: box.x, clientY: box.y });
  await handle.dispatchEvent('pointermove', { pointerId: 72, clientX: box.x + 60, clientY: box.y });
  await handle.dispatchEvent('pointercancel', { pointerId: 72 });
  await expect(handle).toHaveAttribute('aria-valuenow', String(committed));
  await expect(layout).not.toHaveClass(/navigation-pane-resizing/);

  await page.getByRole('tab', { name: '分工管理' }).click();
  await expect(page.locator('[data-navigation-layout-id="outline-assignment"]')).toBeVisible();
  await page.getByRole('tab', { name: '文档总览' }).click();
  layout = page.locator('[data-navigation-layout-id="outline-overview"]');
  handle = layout.locator('[data-navigation-pane-resizer]');
  await expect(handle).toBeVisible();
  await handle.focus();
  const redrawn = Number(await handle.getAttribute('aria-valuenow'));
  await page.keyboard.press('ArrowLeft');
  await expect(handle).toHaveAttribute('aria-valuenow', String(Math.max(240, redrawn - 16)));

  const desktopScreenshot = await page.screenshot({ fullPage: true, path: evidencePath('outline-desktop', browserName) });
  await testInfo.attach('大纲目录桌面拖动与重绘', {
    body: desktopScreenshot,
    contentType: 'image/png',
  });
});

test('P0：移动端目录为单列且不暴露拖拽条', async ({ page, browserName }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${baseUrl}/knowledge-center/outlines/DB-017`);
  const layout = page.locator('[data-navigation-layout-id="outline-overview"]');
  await expect(layout).toBeVisible();
  await expect(layout.locator('[data-navigation-pane-resizer]')).toBeHidden();
  await expect(layout.locator('[data-navigation-pane]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const mobileScreenshot = await page.screenshot({ fullPage: true, path: evidencePath('outline-mobile', browserName) });
  await testInfo.attach('大纲目录移动端', {
    body: mobileScreenshot,
    contentType: 'image/png',
  });
});

test('从详情通过侧栏返回时恢复完整列表和知识资产产品', async ({ page }) => {
  const response = await page.request.get(`${baseUrl}/knowledge-center/api/outline/catalog`);
  expect(response.ok()).toBe(true);
  const { data: catalog } = await response.json();
  const expectedIds = catalog.items.map(item => String(item.handbookId || item.id || item.outlineId));
  expect(expectedIds.length).toBeGreaterThan(0);
  await page.goto(`${baseUrl}/knowledge-center/outlines`);
  await expect(page.locator('[data-outline-row]')).toHaveCount(expectedIds.length);
  const renderedIds = () => page.locator('[data-outline-row] [data-outline-id]').evaluateAll(nodes => nodes.map(node => node.dataset.outlineId));
  expect(await renderedIds()).toEqual(expectedIds);
  await expect(page.locator('.outline-table thead')).toContainText('手册');
  await expect(page.locator('.outline-table thead')).toContainText('产品');
  await expect(page.locator('.outline-table thead')).toContainText('状态');
  await expect(page.locator('.outline-table thead')).toContainText('更新时间');
  await expect(page.locator('.outline-table thead')).not.toContainText('产品 / 业务版本');
  await expect(page.locator('.outline-table thead')).not.toContainText('待处理');
  await expect(page.locator('.outline-table thead')).not.toContainText('下一步');
  await expect(page.locator('.outline-list-summary')).not.toContainText('待处理问题');
  await expect(page.locator('[data-outline-row] td:nth-child(2)')).toHaveText(catalog.items.map(item => item.productDisplayName || item.productName || '未指定产品'));

  const outlineName = page.locator('.outline-list-link').first();
  const outlineStyle = await outlineName.evaluate(element => {
    const style = getComputedStyle(element);
    return { color: style.color, fontSize: style.fontSize, fontFamily: style.fontFamily, fontWeight: getComputedStyle(element.querySelector('strong')).fontWeight };
  });
  await page.goto(`${baseUrl}/knowledge-center/assets`);
  const assetName = page.locator('.asset-name').first();
  await expect(assetName).toBeVisible();
  const assetStyle = await assetName.evaluate(element => {
    const style = getComputedStyle(element);
    return { color: style.color, fontSize: style.fontSize, fontFamily: style.fontFamily, fontWeight: getComputedStyle(element.querySelector('strong')).fontWeight };
  });
  expect(outlineStyle).toEqual(assetStyle);

  await page.goto(`${baseUrl}/knowledge-center/outlines/DB-017`);
  await expect(page.locator('.outline-detail-shell')).toBeVisible();
  await page.locator('[data-view="outlines"]').click();
  await expect(page).toHaveURL(`${baseUrl}/knowledge-center/outlines`);
  await expect(page.locator('[data-outline-row]')).toHaveCount(expectedIds.length);
  expect(await renderedIds()).toEqual(expectedIds);
});

test('无效大纲深链不会回退到第一本手册', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/outlines/not-a-real-handbook`);
  await expect(page.getByText('手册不存在', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(`${baseUrl}/knowledge-center/outlines/not-a-real-handbook`);
});

test('大纲结构复用公共字段配置抽屉并保持个人视图', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/outlines/DB-017?node=document_59ee19fae237c866&document=document_59ee19fae237c866`);
  await expect(page.getByRole('heading', { name: '大纲结构' })).toBeVisible();
  for (const label of ['章节名称', '类型', '状态', '技术领域', '主责负责人', '操作']) {
    await expect(page.locator(`th[data-outline-column="${label === '章节名称' ? 'chapter' : label === '类型' ? 'kind' : label === '状态' ? 'status' : label === '技术领域' ? 'domain' : label === '主责负责人' ? 'owner' : 'actions'}"]`)).toContainText(label);
  }
  await expect(page.getByLabel('查询章节名称')).toBeVisible();
  await expect(page.getByRole('combobox', { name: '按技术领域筛选，可输入筛选' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: '按主责负责人筛选，可输入筛选' })).toBeVisible();
  await page.getByRole('button', { name: '配置大纲结构' }).click();
  await expect(page.getByRole('heading', { name: '配置显示字段' })).toBeVisible();
  const ownerToggle = page.locator('[data-table-drawer-visible="owner"]');
  await ownerToggle.uncheck();
  await expect(page.locator('th[data-outline-column="owner"]')).toBeHidden();
  await expect(page.locator('[data-table-drawer-visible="owner"]')).toBeFocused();
  await expect(page.getByRole('heading', { name: '配置显示字段' })).toBeVisible();
  await page.locator('[data-table-view-column="status"][data-table-view-move="up"]').click();
  await expect(page.locator('.outline-node-table thead th').nth(1)).toContainText('状态');
  await expect(page.locator('[data-table-view-column="status"][data-table-view-move="up"]')).toBeFocused();
  await page.reload();
  await expect(page.locator('th[data-outline-column="owner"]')).toBeHidden();
  await expect(page.locator('.outline-node-table thead th').nth(1)).toContainText('状态');
  await page.getByRole('button', { name: '配置大纲结构' }).click();
  await page.getByRole('button', { name: '恢复默认' }).click();
  await expect(page.locator('th[data-outline-column="owner"]')).toBeVisible();
  await expect(page.locator('.outline-node-table thead th').nth(1)).toContainText('类型');
  await page.getByRole('button', { name: '关闭字段配置' }).click();
  const firstRow = page.locator('[data-outline-node-row]').first();
  const chapterName = await firstRow.locator('[data-outline-node]').textContent();
  await page.getByLabel('查询章节名称').fill(chapterName.trim());
  await expect(page.locator('[data-outline-node-row]:visible')).toHaveCount(1);
  await page.getByLabel('查询章节名称').fill('');
  await expect(page.locator('[data-outline-description-readonly]')).toBeVisible();
  await expect(page.locator('.outline-node-inspector textarea')).toHaveCount(0);
  const edit = page.locator('[data-outline-description-edit]').first();
  await edit.click();
  await expect(page.locator('[data-outline-description-dialog]')).toBeVisible();
  await expect(page.locator('[data-outline-description-draft]')).toBeVisible();
});

test('稳定业务表格接入同一公共字段配置能力', async ({ page }) => {
  await page.goto(`${baseUrl}/knowledge-center/assets`);
  await expect(page.locator('[data-table-view-id="asset-catalog"]')).toBeVisible();
  await expect(page.getByRole('button', { name: '配置知识资产' })).toBeVisible();
  await page.goto(`${baseUrl}/knowledge-center/outlines`);
  await expect(page.locator('[data-table-view-id="outline-catalog"]')).toBeVisible();
  await expect(page.getByRole('button', { name: '配置手册大纲' })).toBeVisible();
  await page.goto(`${baseUrl}/knowledge-center/platform?tab=principals&view=people`);
  await expect(page.locator('[data-table-view-id="platform-principals"]')).toBeVisible();
  await expect(page.getByRole('button', { name: '配置人员管理' })).toBeVisible();
});

for (const viewport of viewports) {
  test(`${viewport.width}px 列表和详情无页面级溢出`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}/knowledge-center/outlines`);
    await expect(page.locator('[data-outline-row]').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.locator('[data-outline-row] [data-outline-id]').first().click();
    await expect(page.locator('.outline-stage-canvas')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}
