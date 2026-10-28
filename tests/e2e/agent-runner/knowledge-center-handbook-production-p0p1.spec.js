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
  await expect(page.locator('.handbook-production-content')).toBeVisible();
  return true;
}

test.describe('手册级文档生成页面 P0/P1', () => {
  test.beforeEach(async ({ page }) => {
    await login(page.context().request);
  });

  test('P0：运行服务来源目录与生成设置一致，MCP 默认引用且无需地址', async ({ page }, testInfo) => {
    const outline = await handbookFixture(page.context().request, testInfo);
    if (!outline) return;
    const names = ['网页来源', 'Pingcode设计文档', 'Pingcode测试文档', '知识库（MCP）', '测试用例集', '本地文档'];
    await page.goto(`${baseUrl}/knowledge-center/production/handbook/${encodeURIComponent(outline.handbookId)}`, { waitUntil: 'domcontentloaded' });
    const sourceResponse = page.waitForResponse(response => response.url().includes('/ai-sources?') && response.request().method() === 'GET');
    await page.getByRole('button', { name: 'AI 辅助写作', exact: true }).click();
    const response = await sourceResponse;
    expect(response.ok()).toBeTruthy();
    const catalog = (await response.json()).data;
    expect(catalog.items.map(item => item.name)).toEqual(names);
    expect(catalog.items.find(item => item.sourceType === 'knowledge-mcp').automatic).toBe(true);
    await page.locator('[data-ai-settings-open]').click();
    await page.locator('[data-ai-settings-apply]').click();
    await page.locator('[data-ai-source-add]').click();
    await expect(page.locator('[data-ai-source-type] option')).toHaveText(names.map((name, index) => `${name}${catalog.items[index].available ? '' : '（未配置）'}`));
    await page.locator('[data-reference-type="knowledge-mcp"]').click();
    await expect(page.locator('[data-ai-source-locator]')).toBeHidden();
    await expect(page.locator('[data-ai-source-preview]')).toBeDisabled();
    await expect(page.locator('[data-ai-mcp-status]')).toContainText('默认');
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

  test('P0：进入手册即展示目录、编辑器并隐藏低频模板上下文', async ({ page }, testInfo) => {
    const outline = await handbookFixture(page.context().request, testInfo);
    if (!outline) return;
    await page.goto(`${baseUrl}/knowledge-center/production/handbook/${encodeURIComponent(outline.handbookId)}`, { waitUntil: 'networkidle' });

    await expect(page.getByText('1 产品', { exact: true })).toHaveCount(0);
    await expect(page.getByText('生成上下文', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '生成文档结构', exact: true })).toHaveCount(0);
    if (!await ensureWorkspace(page, testInfo)) return;

    // 目录必须由大纲节点的 parentId 组装为树，而不是平铺文件列表。
    await expect(page.getByRole('button', { name: '切换文档目录', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[data-handbook-directory-group]').first()).toBeVisible({ timeout: 10000 });
    expect(await page.locator('[data-handbook-directory-group] ul').count()).toBeGreaterThan(0);
    await expect(page.locator('[data-handbook-directory-group] summary').first()).toBeVisible();
    const documentRowHeight = await page.locator('.handbook-production-document button').first().evaluate(node => node.getBoundingClientRect().height);
    // Firefox字体度量存在不足1px差异，紧凑目录行容许一个CSS像素。
    expect(documentRowHeight).toBeLessThanOrEqual(45);

    const currentTitle = page.locator('h1[data-handbook-document-title]');
    await expect(currentTitle).toBeVisible();
    await expect(currentTitle).not.toContainText('.md');
    await expect(currentTitle).not.toHaveText(/^\d/);
    await expect(page.getByRole('combobox', { name: '文档模板，可输入筛选' })).toHaveCount(0);
    await expect(page.locator('[data-handbook-template][type="hidden"]')).toHaveCount(1);
    await expect(page.getByText('GitLab 未匹配正文', { exact: true })).toHaveCount(0);
    await expect(page.getByText('GitLab 中未找到对应正文', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Markdown / 富文本', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '关闭文档目录', exact: true }).last().click();
    await page.locator('.handbook-more-menu summary').click();
    await expect(page.getByRole('button', { name: '校验', exact: true })).toBeVisible();
    await expect(page.locator('.handbook-attachment-button')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '预览', exact: true })).toHaveCount(0);
    await expect(page.getByText('编辑', { exact: true })).toBeVisible();
    await expect(page.locator('.handbook-review-tray, [data-handbook-add-chapter]')).toHaveCount(0);
    await expect(page.locator('[data-handbook-review-selection-dialog]')).not.toBeVisible();
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
    const editor = page.locator('[data-handbook-vditor] .vditor-wysiwyg > [contenteditable="true"]');
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
    const editor = page.locator('[data-handbook-vditor] .vditor-wysiwyg > [contenteditable="true"]');
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
    await page.getByRole('button', { name: '预览', exact: true }).click();
    await expect(page.locator('.handbook-production-content.is-reading .repository-markdown')).toContainText(marker);
    await expect(page.locator('.handbook-production-content.is-reading .repository-markdown')).toHaveCSS('line-height', '28px');
    expect(apiCalls.some(item => item.method === 'PUT' && item.url.includes('/draft'))).toBeTruthy();
    expect(apiCalls.some(item => item.url.includes('/gitlab/') && item.method !== 'GET')).toBeFalsy();

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.handbook-production-content.is-reading .repository-markdown')).toContainText(marker);
    await page.getByRole('button', { name: '编辑', exact: true }).click();
    await expect(page.locator('[data-handbook-vditor] .vditor-wysiwyg > [contenteditable="true"]')).toContainText(marker);
    await expect(page.getByRole('button', { name: '恢复原文', exact: true })).toHaveCount(0);
  });

  test('P0：工作台检查真实 YashanDB 用例并绑定已保存修订及复测报告', async ({ page, browserName }, testInfo) => {
    // Includes saving a revision and two real database executions, each with durable report writes.
    test.setTimeout(90000);
    const api = page.context().request;
    const outline = await handbookFixture(api, testInfo);
    if (!outline) return;
    const draftResponse = page.waitForResponse(response => response.request().method() === 'GET' && /\/production\/handbooks\/[^/]+\/documents\/[^/]+\/draft\?/.test(response.url()));
    await page.goto(`${baseUrl}/knowledge-center/production/handbook/${encodeURIComponent(outline.handbookId)}`, { waitUntil: 'networkidle' });
    const loaded = await draftResponse;
    expect(loaded.ok()).toBeTruthy();
    const previous = (await loaded.json()).data;
    const draftURL = new URL(loaded.url());
    const endpoint = draftURL.origin + draftURL.pathname;
    const context = Object.fromEntries(draftURL.searchParams);
    const sql = expected => '```sql\nSELECT 1 AS C1 FROM DUAL;\n```\n```json quality-expected\n' + JSON.stringify(expected) + '\n```\n';
    const markdown = '# 工作台真实用例检查\n\n' + sql({ rows: [{ C1: 1 }] }) + sql({ rows: [{ C1: 2 }] }) + sql({ rows: 'invalid' });
    const savedResponse = await api.put(endpoint, {
      headers: { 'Idempotency-Key': `quality-workbench-${browserName}-${Date.now()}` },
      data: { ...context, editVersion: previous.draft?.editVersion || 0, markdown },
    });
    expect(savedResponse.ok(), await savedResponse.text()).toBeTruthy();
    const saved = (await savedResponse.json()).data.draft;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.handbook-production-content.is-reading .repository-markdown')).toContainText('工作台真实用例检查');
    await page.locator('.handbook-more-menu summary').click();
    await page.locator('[data-handbook-ai-action="check"]').click();
    const dialog = page.getByRole('dialog', { name: '文档用例质量报告' });
    await expect(dialog).toBeVisible();
    const qualityResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/quality'), { timeout: 30000 });
    await dialog.getByRole('button', { name: '执行用例校验', exact: true }).click();
    const checked = await qualityResponse;
    expect(checked.status(), await checked.text()).toBe(201);
    const report = (await checked.json()).data;
    if (!report.database.adapter) {
      expect(report.coverage).toEqual({ total: 3, executed: 0, passed: 0, failed: 0, notExecuted: 3 });
      expect(report.gate).toBe('not_passed');
      await expect(dialog.locator('[data-quality-status]')).toContainText('未执行 3');
      await testInfo.attach('缺少独立质量测试库时保持门禁关闭', { body: JSON.stringify({ database: report.database, coverage: report.coverage, gate: report.gate }), contentType: 'application/json' });
      testInfo.skip(true, '未配置独立 YASDB_QUALITY 测试库；已核对未执行且门禁不通过，真实SQL执行及复测仍待验');
      return;
    }
    expect(report.coverage).toEqual({ total: 3, executed: 2, passed: 1, failed: 1, notExecuted: 1 });
    expect(report.document.revisionId).toBe(saved.revision.revisionId);
    expect(report.database.version).toBeTruthy();
    expect(report.skillInvocations).toHaveLength(4);
    await expect(dialog.locator('[data-quality-status]')).toContainText('通过 1，失败 1，未执行 1');
    const rerunResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/quality'), { timeout: 30000 });
    await dialog.getByRole('button', { name: '重新执行并保留复测记录' }).click();
    const rerunHTTP = await rerunResponse;
    expect(rerunHTTP.status(), await rerunHTTP.text()).toBe(201);
    const rerun = (await rerunHTTP.json()).data;
    expect(rerun.rerunOf.reportId).toBe(report.reportId);
    await expect(dialog.locator('[data-quality-report]')).toContainText(rerun.reportId);
    const reread = await api.get(draftURL.href);
    expect((await reread.json()).data.draft.revision.qualityReport.reportId).toBe(rerun.reportId);
    const evidence = path.resolve(__dirname, '../../../runtime/test-results/production-ai-quality/20261022/workbench-e2e');
    fs.mkdirSync(evidence, { recursive: true });
    fs.writeFileSync(path.join(evidence, `report-${browserName}.json`), JSON.stringify({ realDatabase: true, realPlatformHTTP: true, isolatedUnifiedE2E: true, realModel: false, revisionId: saved.revision.revisionId, report, rerun }, null, 2));
    await page.screenshot({ path: path.join(evidence, `report-${browserName}.png`) });
    await dialog.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(dialog).toHaveCount(0);
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
    await page.evaluate(() => {
      const main = document.documentElement.dataset.scrollMode === 'main'
        ? document.querySelector('[data-scroll-owner="main"]') : document.scrollingElement;
      const bar = document.querySelector('.handbook-production-toolbar');
      main.scrollTop = bar.getBoundingClientRect().top + main.scrollTop + 450;
    });
    expect(await page.evaluate(() => (document.documentElement.dataset.scrollMode === 'main'
      ? document.querySelector('[data-scroll-owner="main"]') : document.scrollingElement).scrollTop)).toBeGreaterThan(300);
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
    const writingBox = await page.locator('.handbook-production-writing').boundingBox();
    expect(canvasBox.width).toBeGreaterThan(writingBox.width * .9);
    expect(canvasBox.width).toBeLessThanOrEqual(writingBox.width);

    await expect(page.locator('.handbook-review-tray')).toHaveCount(0);

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
    await expect(directory).toBeVisible();
    await expect(assistant).toBeHidden();
    await expect(page.locator('.handbook-review-tray')).toHaveCount(0);
    await page.getByRole('button', { name: '只看我负责', exact: true }).click();
    await expect(directory.getByRole('button', { name: '只看我负责', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(directory.locator('.handbook-production-directory-scroll')).toBeVisible();
    await page.getByRole('button', { name: '全部文档', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(directory).toBeHidden();
    await expect(page.getByRole('button', { name: '切换文档目录', exact: true })).toBeFocused();
    await page.locator('.handbook-production-toolbar [data-handbook-ai-action="generate"]').click();
    await expect(page.locator('.handbook-writing-page.is-embedded')).toBeVisible();
    await page.locator('[data-ai-close]').click();
    await page.locator('.handbook-more-menu > summary').click();
    await page.getByRole('button', { name: '全局预览', exact: true }).click();
    await expect(page.locator('.sidebar')).toBeHidden();
    await expect(page.locator('.handbook-production-writing')).toBeVisible();
    await page.locator('.handbook-more-menu > summary').click();
    await page.getByRole('button', { name: '退出全局预览', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: '切换文档目录', exact: true })).toBeVisible();
    // 刷新落在文档深链时默认阅读；移动端通过显式目录入口打开。
    await page.getByRole('button', { name: '切换文档目录', exact: true }).click();
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
    await page.route(`**/knowledge-center/api/outline/governance/${encodeURIComponent(outline.id)}?view=directory`, route => route.fulfill({
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
    const canvas = page.locator('[data-handbook-vditor] .vditor-wysiwyg > [contenteditable="true"]');
    await expect(canvas).toBeVisible();
    await canvas.evaluate(element => { window.__handbookCanvasBeforeDrawer = element; });
    await page.getByRole('button', { name: '关闭文档目录', exact: true }).last().click();
    await page.getByRole('button', { name: '切换文档目录', exact: true }).click();
    await page.locator('.handbook-more-menu > summary').click();
    await page.keyboard.press('Escape');
    expect(await canvas.evaluate(element => element === window.__handbookCanvasBeforeDrawer)).toBeTruthy();
    await page.getByRole('link', { name: '返回知识资产', exact: true }).click();
    await expect(page.locator('#app-shell')).not.toHaveClass(/sidebar-collapsed/);
  });

  test('P1：正文支持富文本与 Markdown 两种编写格式且主次层级清晰', async ({ page }, testInfo) => {
    const outline = await handbookFixture(page.context().request, testInfo);
    if (!outline) return;
    await page.goto(`${baseUrl}/knowledge-center/production/handbook/${encodeURIComponent(outline.handbookId)}`, { waitUntil: 'networkidle' });
    if (!await ensureWorkspace(page, testInfo)) return;
    await page.getByRole('button', { name: '编辑', exact: true }).click();
    await expect(page.getByRole('button', { name: 'AI 辅助写作', exact: true })).toBeVisible();
    await page.locator('.handbook-editor-format > summary').click();
    await expect(page.getByRole('button', { name: 'Markdown', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '可视化编辑', exact: true })).toBeVisible();
    await page.locator('.handbook-editor-format [data-handbook-editor-format="markdown"]').click();
    const markdown = page.locator('[data-handbook-markdown-editor]');
    await expect(markdown).toBeVisible();
    await markdown.fill('# Markdown 编辑验证\n\n正文内容');
    await page.getByRole('button', { name: '显示预览', exact: true }).click();
    await expect(page.locator('.handbook-markdown-preview')).toContainText('Markdown 编辑验证');
    await expect(page.locator('.handbook-markdown-workspace.is-previewing')).toBeVisible();
    await page.getByRole('button', { name: '返回编辑', exact: true }).click();
    await page.locator('.handbook-editor-format > summary').click();
    await page.getByRole('button', { name: '可视化编辑', exact: true }).click();
    await expect(page.locator('[data-handbook-vditor] .vditor-wysiwyg > [contenteditable="true"]')).toContainText('Markdown 编辑验证');
    await expect(page.getByRole('link', { name: '查看审核任务' })).toHaveCount(0);
  });

});
