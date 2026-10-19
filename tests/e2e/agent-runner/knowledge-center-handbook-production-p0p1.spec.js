const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// 手册级文档生成页面的 P0/P1 浏览器验收。草稿用例调用隔离环境真实保存接口，
// 验证刷新回读，但不调用 GitLab 写接口。
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

  test('P0：局域网 HTTP 缺少 Web Crypto 时仍可生成正确基线摘要', async ({ page }) => {
    await page.goto(`${baseUrl}/knowledge-center/`);
    const digests = await page.evaluate(async () => {
      const { sha256Text } = await import('/knowledge-center/common/utils/sha256.js');
      return {
        empty: await sha256Text('', null),
        ascii: await sha256Text('abc', null),
        chinese: await sha256Text('中文基线', null),
      };
    });
    expect(digests).toEqual({
      empty: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      ascii: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      chinese: 'ac3514a1574535afdd44188ce10256bf2395072ed9049a23d997fbc707bcf663',
    });
  });

  test('P1：大纲分工责任人必须进入手册生产目录的有效责任投影', async ({ page }, testInfo) => {
    const outline = await handbookFixture(page.context().request, testInfo);
    if (!outline) return;
    const detailResponse = await page.context().request.get(`${baseUrl}/knowledge-center/api/outline/governance/${encodeURIComponent(outline.id)}`);
    expect(detailResponse.ok(), `大纲治理详情读取失败：HTTP ${detailResponse.status()}`).toBeTruthy();
    const detail = (await detailResponse.json()).data || {};
    const governance = detail.governance || {};
    const taskItems = (governance.tasks || []).flatMap(task => task.items || [])
      .filter(item => item.assigneeId || item.assigneeName);
    testInfo.skip(!taskItems.length, '测试环境没有已绑定责任人的大纲分工数据');
    const effective = governance.effectiveDocumentAssignments || [];
    for (const taskItem of taskItems) {
      const projected = effective.find(item => String(item.documentId || item.nodeId) === String(taskItem.documentId || taskItem.outlineNodeId));
      expect(projected, `页面 ${taskItem.documentId} 未进入有效责任投影`).toBeTruthy();
      const ownership = (projected.ownerships || []).find(item => String(item.techDomainId) === String(taskItem.techDomainId));
      expect(ownership, `页面 ${taskItem.documentId} 的技术领域 ${taskItem.techDomainId} 未进入责任投影`).toBeTruthy();
      expect(String(ownership.assigneeId || '')).toBe(String(taskItem.assigneeId || ''));
      expect(String(ownership.assigneeName || '')).toBe(String(taskItem.assigneeName || ''));
    }
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
    await page.getByRole('button', { name: '目录', exact: true }).click();
    await expect(page.locator('[data-handbook-directory-group]').first()).toBeVisible({ timeout: 10000 });
    expect(await page.locator('[data-handbook-directory-group] ul').count()).toBeGreaterThan(0);
    await expect(page.locator('[data-handbook-directory-group] summary').first()).toBeVisible();
    const documentRowHeight = await page.locator('.handbook-production-document button').first().evaluate(node => node.getBoundingClientRect().height);
    expect(documentRowHeight).toBeLessThanOrEqual(44);

    const currentTitle = page.locator('.handbook-production-editor h2').first();
    await expect(currentTitle).toBeVisible();
    await expect(currentTitle).not.toContainText('.md');
    await expect(currentTitle).not.toHaveText(/^\d/);
    await expect(page.getByRole('combobox', { name: '文档模板，可输入筛选' })).toBeVisible();
    await expect(page.getByText('GitLab 未匹配正文', { exact: true })).toHaveCount(0);
    await expect(page.getByText('GitLab 中未找到对应正文', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Markdown / 富文本', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '关闭文档目录', exact: true }).last().click();
    await page.getByRole('button', { name: '工具', exact: true }).click();
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
    await page.getByRole('button', { name: '关闭辅助工具', exact: true }).last().click();
    await expect(page.getByText('预览', { exact: true })).toBeVisible();
    await expect(page.getByText('编辑', { exact: true })).toBeVisible();
    await expect(page.getByText(/尚未形成共享草稿|共享草稿 ·/)).toBeVisible();

    // 底部评审区应在页面流中，不得固定遮挡正文工作区。
    const tray = page.locator('.handbook-review-tray');
    const editor = page.locator('.handbook-production-editor');
    const trayBox = await tray.boundingBox();
    const editorBox = await editor.boundingBox();
    expect(trayBox).toBeTruthy();
    expect(editorBox).toBeTruthy();
    expect(trayBox.y).toBeGreaterThanOrEqual(editorBox.y);
  });

  test('P0：没有历史草稿时按正常空状态展示且不出现历史入口', async ({ page }, testInfo) => {
    const outline = await handbookFixture(page.context().request, testInfo);
    if (!outline) return;
    await page.route('**/knowledge-center/api/production/handbooks/*/documents/*/draft?*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { exists: false, draft: null, capabilities: { canEdit: true } } }),
    }));
    await page.goto(`${baseUrl}/knowledge-center/production/handbook/${encodeURIComponent(outline.handbookId)}`, { waitUntil: 'networkidle' });
    if (!await ensureWorkspace(page, testInfo)) return;

    await expect(page.locator('[data-handbook-save-status]')).toHaveText('尚未保存为共享草稿');
    await expect(page.locator('[data-handbook-draft-save]')).toBeEnabled();
    await expect(page.getByText('草稿读取失败', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/共享草稿服务暂不可用/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: '查看草稿历史' })).toHaveCount(0);
  });

  test('P0：草稿接口异常不冒充空草稿且正文仍可编辑', async ({ page }, testInfo) => {
    const outline = await handbookFixture(page.context().request, testInfo);
    if (!outline) return;
    await page.route('**/knowledge-center/api/production/handbooks/*/documents/*/draft?*', route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>SPA fallback</title>',
    }));
    await page.goto(`${baseUrl}/knowledge-center/production/handbook/${encodeURIComponent(outline.handbookId)}`, { waitUntil: 'networkidle' });
    if (!await ensureWorkspace(page, testInfo)) return;

    await expect(page.getByText('草稿读取失败', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/共享草稿服务暂不可用，当前正文仍可编辑/)).toBeVisible();
    await page.getByRole('button', { name: '编辑', exact: true }).click();
    const editor = page.locator('[data-handbook-vditor] .vditor-wysiwyg');
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type('\n接口异常下的本地编辑');
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '查看草稿历史' })).toHaveCount(0);
  });

  test('P0：Vditor 编辑保存形成共享草稿，刷新后可以恢复且不写回 GitLab', async ({ page }, testInfo) => {
    const outline = await handbookFixture(page.context().request, testInfo);
    if (!outline) return;
    await page.goto(`${baseUrl}/knowledge-center/production/handbook/${encodeURIComponent(outline.handbookId)}`, { waitUntil: 'networkidle' });
    if (!await ensureWorkspace(page, testInfo)) return;

    const edit = page.getByRole('button', { name: '编辑', exact: true });
    await edit.click();
    const editor = page.locator('[data-handbook-vditor] .vditor-wysiwyg');
    await expect(editor).toBeVisible();
    await editor.click();
    const marker = `E2E 共享草稿 ${Date.now()}`;
    await page.keyboard.type(`\n\n${marker}`);
    await expect(page.getByText('有未保存修改', { exact: true })).toBeVisible();

    const apiCalls = [];
    page.on('request', request => {
      if (request.method() !== 'GET' && request.url().includes('/knowledge-center/api/')) apiCalls.push({ method: request.method(), url: request.url() });
    });
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText(/已保存 v\d+ ·/)).toBeVisible();
    await expect(page.getByText(/共享草稿 · /)).toBeVisible();
    await page.getByRole('button', { name: '预览', exact: true }).click();
    await expect(page.locator('.handbook-production-content.is-reading .repository-markdown')).toContainText(marker);
    await expect(page.locator('.handbook-production-content.is-reading .repository-markdown')).toHaveCSS('line-height', '28px');
    expect(apiCalls.some(item => item.method === 'PUT' && item.url.includes('/draft'))).toBeTruthy();
    expect(apiCalls.some(item => item.url.includes('/gitlab/') && item.method !== 'GET')).toBeFalsy();

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.handbook-production-content.is-reading .repository-markdown')).toContainText(marker);
    await page.getByRole('button', { name: '编辑', exact: true }).click();
    await expect(page.locator('[data-handbook-vditor] .vditor-wysiwyg')).toContainText(marker);
    await expect(page.getByRole('button', { name: '恢复原文', exact: true })).toHaveCount(0);
  });

  test('P0：长文滚动时编辑控制栏和加粗命令持续可见', async ({ page }, testInfo) => {
    const outline = await handbookFixture(page.context().request, testInfo);
    if (!outline) return;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${baseUrl}/knowledge-center/production/handbook/${encodeURIComponent(outline.handbookId)}`, { waitUntil: 'networkidle' });
    if (!await ensureWorkspace(page, testInfo)) return;

    await page.getByRole('button', { name: '编辑', exact: true }).click();
    const commandBar = page.locator('.handbook-production-toolbar');
    const formatBar = page.locator('.vditor-toolbar');
    const bold = page.locator('.vditor-toolbar [data-type="bold"]');
    const canvas = page.locator('.vditor-wysiwyg');
    await expect(bold).toBeVisible();
    await canvas.evaluate(element => { element.style.minHeight = '1800px'; });
    await page.locator('.main-shell').evaluate(main => {
      const bar = document.querySelector('.handbook-production-toolbar');
      main.scrollTop = bar.getBoundingClientRect().top + main.scrollTop + 450;
    });
    await page.waitForTimeout(150);

    const commandBox = await commandBar.boundingBox();
    const formatBox = await formatBar.boundingBox();
    const boldBox = await bold.boundingBox();
    const canvasBox = await canvas.boundingBox();
    expect(commandBox).toBeTruthy();
    expect(formatBox).toBeTruthy();
    expect(boldBox).toBeTruthy();
    expect(canvasBox).toBeTruthy();
    expect(Math.abs(commandBox.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(formatBox.y - commandBox.height)).toBeLessThanOrEqual(2);
    expect(boldBox.y).toBeGreaterThanOrEqual(formatBox.y);
    expect(boldBox.y + boldBox.height).toBeLessThanOrEqual(formatBox.y + formatBox.height + 1);
    expect(canvasBox.width).toBeLessThanOrEqual(861);

    const reviewTray = page.locator('.handbook-review-tray');
    // 真实保存用例会留下共享草稿，有草稿时评审区按业务规则默认展开。
    // 先显式收起以建立交互前提，再验证展开/收起，不依赖共享fixture初始状态。
    if (await reviewTray.getAttribute('open') !== null) await reviewTray.locator('summary').click();
    await expect(reviewTray).not.toHaveAttribute('open', '');
    await reviewTray.locator('summary').click();
    await expect(reviewTray).toHaveAttribute('open', '');
    await reviewTray.locator('summary').click();
    await expect(reviewTray).not.toHaveAttribute('open', '');

    for (const width of [1024, 768, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `${width}px 视口不应出现水平溢出`).toBeFalsy();
    }
  });

  test('P1：沉浸布局、抽屉互斥、键盘返回与移动端', async ({ page, browserName }, testInfo) => {
    const outline = await handbookFixture(page.context().request, testInfo);
    if (!outline) return;
    await page.goto(`${baseUrl}/knowledge-center/production/handbook/${encodeURIComponent(outline.handbookId)}`, { waitUntil: 'networkidle' });
    if (!await ensureWorkspace(page, testInfo)) return;
    const directory = page.locator('.handbook-production-directory');
    const assistant = page.locator('.handbook-assistant-panel');
    await expect(directory).toBeHidden();
    await expect(assistant).toBeHidden();
    await expect(page.locator('.handbook-review-tray')).not.toHaveAttribute('open');
    await page.getByRole('button', { name: '目录', exact: true }).click();
    await expect(directory).toBeVisible();
    await page.getByRole('button', { name: '只看我负责', exact: true }).click();
    await expect(directory.getByText(/只看我负责 · \d+ 篇/).first()).toBeVisible();
    await page.getByRole('button', { name: '全部文档', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(directory).toBeHidden();
    await expect(page.getByRole('button', { name: '目录', exact: true })).toBeFocused();
    await page.getByRole('button', { name: '工具', exact: true }).click();
    await expect(assistant).toBeVisible();
    await expect(directory).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(assistant).toBeHidden();
    await expect(page.getByRole('button', { name: '工具', exact: true })).toBeFocused();
    await page.getByRole('button', { name: '全局预览', exact: true }).click();
    await expect(page.locator('.sidebar')).toBeHidden();
    await expect(page.locator('.handbook-production-editor')).toBeVisible();
    await page.getByRole('button', { name: '退出全局预览', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: '目录', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '目录', exact: true }).click();
    await expect(directory).toBeVisible();
    await page.getByRole('button', { name: '关闭文档目录', exact: true }).last().click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBeFalsy();
    const screenshot = await page.screenshot({ fullPage: true, path: evidencePath('handbook-mobile', browserName) });
    await testInfo.attach('手册生产移动端沉浸布局', { body: screenshot, contentType: 'image/png' });
  });

  test('P0：目录抽屉支持搜索和显式关闭', async ({ page }, testInfo) => {
    const outline = await handbookFixture(page.context().request, testInfo);
    if (!outline) return;
    await page.goto(`${baseUrl}/knowledge-center/production/handbook/${encodeURIComponent(outline.handbookId)}`, { waitUntil: 'networkidle' });
    if (!await ensureWorkspace(page, testInfo)) return;
    await page.getByRole('button', { name: '目录', exact: true }).click();
    const directory = page.locator('.handbook-production-directory');
    await directory.locator('[data-handbook-directory-search]').fill('不存在的文档');
    await expect(directory.locator('.handbook-production-directory-scroll li:visible')).toHaveCount(0);
    await directory.locator('[data-handbook-directory-search]').fill('');
    await expect(directory.locator('[data-handbook-directory-group]').first()).toBeVisible();
    await page.getByRole('button', { name: '关闭文档目录', exact: true }).last().click();
    await expect(directory).toBeHidden();
  });

  test('P1：无效 documentId 显示明确错误且不静默切换文档', async ({ page }, testInfo) => {
    const outline = await handbookFixture(page.context().request, testInfo);
    if (!outline) return;
    await page.goto(`${baseUrl}/knowledge-center/production/handbook/${encodeURIComponent(outline.handbookId)}?documentId=missing-document-for-e2e`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: '无法打开当前文档' })).toBeVisible();
    await expect(page.getByText('当前文档不在这本手册的已发布大纲中，可能已被移除。请从目录选择现有文档。')).toBeVisible();
    await expect(page.locator('[data-handbook-current-document]')).toHaveCount(0);
  });

  test('P1：手册目录返回 403 时显示无权访问而非文档不存在', async ({ page }, testInfo) => {
    const outline = await handbookFixture(page.context().request, testInfo);
    if (!outline) return;
    await page.route(`**/knowledge-center/api/outline/governance/${encodeURIComponent(outline.id)}?view=compact`, route => route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: '没有权限读取当前手册目录' } }),
    }));
    await page.goto(`${baseUrl}/knowledge-center/production/handbook/${encodeURIComponent(outline.handbookId)}?documentId=missing-document-for-e2e`, { waitUntil: 'networkidle' });
    await expect(page.getByText('无权访问当前手册')).toBeVisible();
    await expect(page.getByText('无法打开当前文档')).toHaveCount(0);
  });

  test('P0：写作时抽屉和辅助标签不重建编辑器，离开后恢复导航状态', async ({ page }, testInfo) => {
    const outline = await handbookFixture(page.context().request, testInfo);
    if (!outline) return;
    await page.goto(`${baseUrl}/knowledge-center/production`, { waitUntil: 'networkidle' });
    await expect(page.locator('#app-shell')).not.toHaveClass(/sidebar-collapsed/);
    await page.goto(`${baseUrl}/knowledge-center/production/handbook/${encodeURIComponent(outline.handbookId)}`, { waitUntil: 'networkidle' });
    if (!await ensureWorkspace(page, testInfo)) return;
    await expect(page.locator('#app-shell')).toHaveClass(/sidebar-collapsed/);
    await page.getByRole('button', { name: '编辑', exact: true }).click();
    const canvas = page.locator('[data-handbook-vditor] .vditor-wysiwyg');
    await expect(canvas).toBeVisible();
    await canvas.evaluate(element => { window.__handbookCanvasBeforeDrawer = element; });
    await page.getByRole('button', { name: '目录', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '工具', exact: true }).click();
    await page.getByRole('tab', { name: '属性' }).click();
    await page.getByRole('tab', { name: '引用资料' }).click();
    await page.keyboard.press('Escape');
    expect(await canvas.evaluate(element => element === window.__handbookCanvasBeforeDrawer)).toBeTruthy();
    await page.getByRole('button', { name: '文档生产', exact: true }).click();
    await expect(page.locator('#app-shell')).not.toHaveClass(/sidebar-collapsed/);
  });

});
