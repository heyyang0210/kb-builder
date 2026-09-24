const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// 手册级文档生成页面的 P0/P1 浏览器验收。该用例只验证页面草稿状态，
// 不调用草稿保存、评审批次或 GitLab 写接口。
const baseUrl = process.env.KPG_BASE_URL;
const evidenceDir = path.resolve(__dirname, '../../../runtime/test-results/navigation-pane-p0');
function evidencePath(name, browserName) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  return path.join(evidenceDir, `${name}-${browserName}.png`);
}

async function login(api) {
  const response = await api.post(`${baseUrl}/knowledge-center/api/auth/admin/login`, {
    data: { username: 'admin', password: 'admin' },
  });
  expect(response.ok(), `管理员登录失败：HTTP ${response.status()}`).toBeTruthy();
}

async function handbookFixture(api, testInfo) {
  const response = await api.get(`${baseUrl}/knowledge-center/api/outline/governance/list`);
  if (!response.ok()) {
    testInfo.skip(true, `大纲服务不可用：HTTP ${response.status()}`);
    return null;
  }
  const body = await response.json();
  const outline = (body.data || []).find(item => String(item.name || '').includes('mysql模式参考手册'));
  if (!outline?.handbookId) {
    testInfo.skip(true, '测试环境没有 mysql 模式参考手册大纲 fixture');
    return null;
  }
  return outline;
}

async function ensureWorkspace(page, testInfo) {
  await expect(page.locator('.handbook-production-layout')).toBeVisible();
  const template = page.locator('[data-handbook-template]');
  if (!await template.count() || await template.isDisabled() || await template.locator('option').count() < 1) {
    testInfo.skip(true, '测试环境没有可用文档模板');
    return false;
  }
  await template.selectOption({ index: 0 });
  await expect(page.locator('.handbook-production-content')).toBeVisible();
  return true;
}

test.describe('手册级文档生成页面 P0/P1', () => {
  test.beforeEach(async ({ page }) => {
    await login(page.context().request);
  });

  test('P0：进入手册即展示目录、文档级模板和编辑器', async ({ page }, testInfo) => {
    const outline = await handbookFixture(page.context().request, testInfo);
    if (!outline) return;
    await page.goto(`${baseUrl}/knowledge-center/production/handbook/${encodeURIComponent(outline.handbookId)}`, { waitUntil: 'networkidle' });

    await expect(page.getByText('1 产品', { exact: true })).toHaveCount(0);
    await expect(page.getByText('生成上下文', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '生成文档结构', exact: true })).toHaveCount(0);
    if (!await ensureWorkspace(page, testInfo)) return;

    // 目录必须由大纲节点的 parentId 组装为树，而不是平铺文件列表。
    await expect(page.locator('[data-handbook-directory-group]').first()).toBeVisible({ timeout: 10000 });
    expect(await page.locator('[data-handbook-directory-group] ul').count()).toBeGreaterThan(0);
    await expect(page.locator('[data-handbook-directory-group] summary').first()).toBeVisible();

    const currentTitle = page.locator('.handbook-production-editor h2').first();
    await expect(currentTitle).toBeVisible();
    await expect(currentTitle).not.toContainText('.md');
    await expect(currentTitle).not.toHaveText(/^\d/);
    await expect(page.getByRole('combobox', { name: '文档模板，可输入筛选' })).toBeVisible();
    await expect(page.getByText('GitLab 未匹配正文', { exact: true })).toHaveCount(0);
    await expect(page.getByText('GitLab 中未找到对应正文', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Markdown / 富文本', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'AI助手' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '引用资料' })).toBeVisible();
    await page.getByRole('tab', { name: '引用资料' }).click();
    await page.getByRole('button', { name: '引用资料', exact: true }).click();
    const referenceDialog = page.getByRole('dialog', { name: '引用资料' });
    await expect(referenceDialog).toBeVisible();
    await referenceDialog.getByLabel('上传 Markdown').check();
    await referenceDialog.getByLabel('Markdown 文件').setInputFiles({
      name: 'e2e-reference.md', mimeType: 'text/markdown', buffer: Buffer.from('# E2E 参考资料\n\n只用于页面预览。'),
    });
    await expect(referenceDialog.getByLabel('内容预览')).toHaveValue(/E2E 参考资料/);
    await referenceDialog.getByRole('button', { name: '取消' }).click();
    await expect(page.getByText('预览', { exact: true })).toBeVisible();
    await expect(page.getByText('编辑', { exact: true })).toBeVisible();
    await expect(page.getByText('尚未形成页面草稿')).toBeVisible();

    // 底部评审区应在页面流中，不得固定遮挡正文工作区。
    const tray = page.locator('.handbook-review-tray');
    const editor = page.locator('.handbook-production-editor');
    const trayBox = await tray.boundingBox();
    const editorBox = await editor.boundingBox();
    expect(trayBox).toBeTruthy();
    expect(editorBox).toBeTruthy();
    expect(trayBox.y).toBeGreaterThanOrEqual(editorBox.y);
  });

  test('P0：预览/编辑切换只形成页面草稿，且恢复不写回 GitLab', async ({ page }, testInfo) => {
    const outline = await handbookFixture(page.context().request, testInfo);
    if (!outline) return;
    await page.goto(`${baseUrl}/knowledge-center/production/handbook/${encodeURIComponent(outline.handbookId)}`, { waitUntil: 'networkidle' });
    if (!await ensureWorkspace(page, testInfo)) return;

    const edit = page.getByRole('button', { name: '编辑', exact: true });
    await edit.click();
    const editor = page.locator('[contenteditable="true"][data-handbook-document-content]');
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type('\n\nE2E 页面草稿内容');
    await expect(page.getByText('有未保存修改。')).toBeVisible();

    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    await expect(page.getByText(/页面草稿 · /)).toBeVisible();
    await expect(page.getByRole('button', { name: '恢复原文', exact: true })).toBeVisible();

    const apiCalls = [];
    page.on('request', request => {
      if (request.method() !== 'GET' && request.url().includes('/knowledge-center/api/')) apiCalls.push(request.url());
    });
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '恢复原文', exact: true }).click();
    // 恢复操作只清除页面草稿，不应产生后端写请求。
    await expect(page.getByText('尚未编辑', { exact: true })).toBeVisible();
    expect(apiCalls).toEqual([]);
  });

  test('P1：责任人过滤、sticky 辅助栏、全局预览、单滚动和移动端抽屉', async ({ page, browserName }, testInfo) => {
    const outline = await handbookFixture(page.context().request, testInfo);
    if (!outline) return;
    await page.goto(`${baseUrl}/knowledge-center/production/handbook/${encodeURIComponent(outline.handbookId)}`, { waitUntil: 'networkidle' });
    if (!await ensureWorkspace(page, testInfo)) return;

    const mine = page.getByRole('button', { name: '只看我负责', exact: true });
    await mine.click();
    await expect(page.locator('.handbook-production-directory').getByText(/只看我负责 · \d+ 篇/).first()).toBeVisible();
    await page.getByRole('button', { name: '全部文档', exact: true }).click();
    await expect(page.getByText(/\d+ 篇文档/).first()).toBeVisible();

    const overflowModes = await page.evaluate(() => ({
      root: getComputedStyle(document.documentElement).overflowY,
      body: getComputedStyle(document.body).overflowY,
      main: getComputedStyle(document.querySelector('.main-shell')).overflowY,
      directory: getComputedStyle(document.querySelector('.handbook-production-directory-scroll')).overflowY,
      assistant: getComputedStyle(document.querySelector('.handbook-assistant-panel')).overflowY,
    }));
    expect(overflowModes.root).toBe('hidden');
    expect(overflowModes.body).toBe('hidden');
    expect(overflowModes.main).toBe('auto');
    expect(['auto', 'scroll']).not.toContain(overflowModes.directory);
    expect(['auto', 'scroll']).not.toContain(overflowModes.assistant);

    const assistantTopBefore = await page.locator('.handbook-assistant-panel').evaluate(element => element.getBoundingClientRect().top);
    await page.locator('.main-shell').evaluate(element => { element.scrollTop = 900; element.dispatchEvent(new Event('scroll')); });
    await page.waitForTimeout(100);
    const assistantTopAfter = await page.locator('.handbook-assistant-panel').evaluate(element => element.getBoundingClientRect().top);
    expect(Math.abs(assistantTopAfter - 16)).toBeLessThanOrEqual(2);
    expect(assistantTopAfter).toBeLessThan(assistantTopBefore);

    await page.getByRole('button', { name: '全局预览', exact: true }).click();
    await expect(page.locator('.handbook-production-directory')).toBeHidden();
    await expect(page.locator('.handbook-assistant-panel')).toBeHidden();
    await expect(page.locator('.sidebar')).toBeHidden();
    await expect(page.locator('.handbook-production-editor')).toBeVisible();
    await page.getByRole('button', { name: '退出全局预览', exact: true }).click();
    await expect(page.locator('.handbook-production-directory')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '打开辅助工具', exact: true }).click();
    await expect(page.locator('.handbook-assistant-panel')).toHaveClass(/is-open/);
    await page.getByRole('button', { name: '关闭辅助工具', exact: true }).last().click();
    await expect(page.locator('.handbook-assistant-panel')).not.toHaveClass(/is-open/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBeFalsy();
    const mobileScreenshot = await page.screenshot({ fullPage: true, path: evidencePath('handbook-mobile', browserName) });
    await testInfo.attach('手册生产移动端辅助抽屉', {
      body: mobileScreenshot,
      contentType: 'image/png',
    });
  });

  test('P0：手册目录支持搜索、独立宽度和显式收起', async ({ page }, testInfo) => {
    const outline = await handbookFixture(page.context().request, testInfo);
    if (!outline) return;
    await page.goto(`${baseUrl}/knowledge-center/production/handbook/${encodeURIComponent(outline.handbookId)}`, { waitUntil: 'networkidle' });
    if (!await ensureWorkspace(page, testInfo)) return;
    const layout = page.locator('[data-navigation-layout-id="production-handbook"]');
    await expect(layout).toBeVisible();
    await expect(layout.locator('[data-handbook-directory-search]')).toBeVisible();
    const handle = layout.locator('[data-navigation-pane-resizer]');
    await expect(handle).toHaveAttribute('aria-valuemin', '220');
    await expect(handle).toHaveAttribute('aria-valuemax', '360');
    await layout.locator('[data-handbook-directory-search]').fill('不存在的文档');
    await expect(layout.locator('.handbook-production-directory-scroll li:visible')).toHaveCount(0);
    await layout.locator('[data-handbook-directory-search]').fill('');
    await page.getByRole('button', { name: '只看我负责', exact: true }).click();
    await page.getByRole('button', { name: '全部文档', exact: true }).click();
    const redrawnHandle = page.locator('[data-navigation-layout-id="production-handbook"] [data-navigation-pane-resizer]');
    await expect(redrawnHandle).toBeVisible();
    const redrawnWidth = Number(await redrawnHandle.getAttribute('aria-valuenow'));
    await redrawnHandle.focus();
    await page.keyboard.press('ArrowRight');
    await expect(redrawnHandle).toHaveAttribute('aria-valuenow', String(Math.min(360, redrawnWidth + 16)));
    await layout.locator('[data-navigation-pane-toggle]').click();
    await expect(layout).toHaveClass(/navigation-pane-collapsed/);
    await layout.locator('[data-navigation-pane-toggle]').click();
    await expect(layout).not.toHaveClass(/navigation-pane-collapsed/);
  });
});
