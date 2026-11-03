const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const base = process.env.KPG_BASE_URL;
const artifacts = path.resolve('runtime/test-results/handbook-workspace');
fs.mkdirSync(artifacts, { recursive: true });
async function open(page) {
  const api = page.context().request;
  expect((await api.post(base + '/knowledge-center/api/auth/admin/login', { data: { username: 'admin', password: 'admin' } })).ok()).toBeTruthy();
  const response = await api.get(base + '/knowledge-center/api/outline/governance/list');
  expect(response.ok()).toBeTruthy();
  const outline = (await response.json()).data.find(x => String(x.name).includes('mysql模式参考手册'));
  expect(outline?.handbookId).toBeTruthy();
  await page.goto(base + '/knowledge-center/production/handbook/' + outline.handbookId);
  await expect(page.locator('.handbook-production-content')).toBeVisible();
  await expect(page.locator('.handbook-production-toolbar [data-handbook-mode="edit"]')).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__handbookInteractions = [];
    for (const type of ['pointerdown', 'pointerup', 'click']) {
      document.addEventListener(type, event => {
        const control = event.target.closest('button, summary');
        if (!control?.closest('.handbook-production-editor')) return;
        // Only control metadata: never capture document text or source credentials.
        window.__handbookInteractions.push({ type, time: performance.now(), tag: control.tagName,
          controls: [...control.attributes].filter(attr => attr.name.startsWith('data-handbook-')).map(attr => [attr.name, attr.value]),
          format: Boolean(control.closest('.handbook-editor-format')), connected: control.isConnected });
        if (window.__handbookInteractions.length > 60) window.__handbookInteractions.shift();
      }, true);
    }
  });
  await open(page);
});
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus && !page.isClosed()) {
    const interactions = await page.evaluate(() => window.__handbookInteractions || []).catch(() => []);
    await testInfo.attach('handbook-control-interactions', { body: JSON.stringify(interactions), contentType: 'application/json' });
  }
});
test('生产页图标复用保留节点属性且重复增强不替换 SVG', async ({ page }) => {
  await page.waitForFunction(() => Boolean(window.lucide?.createElement));
  const source = fs.readFileSync(path.resolve('apps/knowledge-center-web/frontend/knowledge-center/app.js'), 'utf8');
  const start = source.indexOf('const handbookIconTemplates = new WeakMap();');
  const end = source.indexOf('function refreshHandbookEditor(', start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const result = await page.evaluate(helperSource => {
    const enhance = new Function('window', `${helperSource}\nreturn enhanceHandbookEditorIcons;`)(window);
    const root = document.createElement('div');
    root.innerHTML = '<i data-lucide="file-text" aria-label="甲" title="第一项" class="custom"></i>'
      + '<i data-lucide="file-text" aria-label="乙" title="第二项"></i>'
      + '<i data-lucide="missing-icon" aria-label="未知"></i>';
    document.body.append(root);
    enhance([root]);
    const icons = [...root.querySelectorAll('svg')];
    const first = icons[0];
    enhance([root]);
    const result = {
      count: icons.length,
      stable: first === root.querySelector('svg'),
      labels: icons.map(icon => icon.getAttribute('aria-label')),
      titles: icons.map(icon => icon.getAttribute('title')),
      classes: icons.map(icon => icon.getAttribute('class')),
      unknownUntouched: root.querySelector('[data-lucide="missing-icon"]')?.tagName === 'I',
    };
    root.remove();
    return result;
  }, source.slice(start, end));
  expect(result.count).toBe(2);
  expect(result.stable).toBe(true);
  expect(result.labels).toEqual(['甲', '乙']);
  expect(result.titles).toEqual(['第一项', '第二项']);
  expect(result.classes[0]).toContain('custom');
  expect(result.classes.every(value => value.includes('lucide-file-text'))).toBe(true);
  expect(result.unknownUntouched).toBe(true);
});
test('草稿与仓库读取完成后保留已出现的目录节点', async ({ page }) => {
  const handbookId = new URL(page.url()).pathname.split('/').pop();
  await page.addInitScript(() => {
    window.__firstHandbookDirectory = null;
    new MutationObserver(() => {
      window.__firstHandbookDirectory ||= document.querySelector('.handbook-production-directory[aria-hidden="false"]');
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto(base + '/knowledge-center/production', { waitUntil: 'networkidle' });
  const target = page.locator('[data-handbook-href]');
  await expect(target.first()).toBeVisible();
  const index = await target.evaluateAll((nodes, id) => nodes.findIndex(node => decodeURIComponent(node.dataset.handbookHref || '').includes(`/handbook/${id}`)), handbookId);
  expect(index).toBeGreaterThanOrEqual(0);
  await target.nth(index).click();
  await expect(page.locator('[data-handbook-save-status]')).toBeVisible();
  expect(await page.evaluate(() => window.__firstHandbookDirectory?.isConnected
    && window.__firstHandbookDirectory === document.querySelector('.handbook-production-directory'))).toBe(true);
  const untouchedId = await page.locator('[data-handbook-document]').evaluateAll(nodes =>
    nodes.find(node => node.querySelector('small')?.hidden)?.dataset.handbookDocument || '');
  expect(untouchedId).toBeTruthy();
  await page.goto(base + '/knowledge-center/production/handbook/' + handbookId + '?documentId=' + encodeURIComponent(untouchedId));
  await expect(page.locator('[data-handbook-save-status]')).toBeVisible();
  expect(await page.evaluate(() => window.__firstHandbookDirectory?.isConnected
    && window.__firstHandbookDirectory === document.querySelector('.handbook-production-directory'))).toBe(true);
});
test('真实模型与存储：拖拽参考文档、生成、采用及刷新回读', async ({ page }, testInfo) => {
  test.skip(process.env.WRITING_LIVE_MODEL !== '1' || testInfo.project.name !== 'chromium', '显式启用真实模型，仅运行Chromium，避免重复外部调用');
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('.handbook-production-toolbar [data-handbook-ai-action="generate"]').click();
  await page.locator('[data-ai-source-add]').click();
  await page.locator('[data-reference-type="local-document"]').click();
  const marker = `隔离写作依据${Date.now()}`;
  const content = `# ${marker}\n\n本文仅说明写作步骤：先核对参考资料，再整理正文，最后保存并交给审核人。`;
  const transfer = await page.evaluateHandle(content => {
    const data = new DataTransfer();
    data.items.add(new File([content], '写作步骤参考.md', { type: 'text/markdown' }));
    return data;
  }, content);
  const uploadResponse = page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/ai-sources/uploads?'));
  await page.locator('[data-ai-source-upload]').dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
  const uploaded = await uploadResponse;
  expect(uploaded.status()).toBe(201);
  expect((await uploaded.json()).data.content).toContain(marker);
  await expect(page.locator('[data-ai-source-list] section')).toHaveCount(2);
  await page.locator('[data-ai-reference-panel] footer [data-ai-reference-close]').click();
  await page.locator('[data-ai-requirements]').fill(`根据本地参考文档撰写三句话的写作步骤说明，必须保留“${marker}”，不包含SQL或数据库操作，不增加技术事实。`);
  try {
    await expect(page.locator('[data-ai-start]'), '生成前必须完成来源检查及个人GitLab授权；查看writing-origin附件定位阻塞').toBeEnabled();
    const [creation] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'POST' && /\/ai-jobs(?:\?|$)/.test(r.url())),
      page.locator('[data-ai-start]').click(),
    ]);
    const creationBody = await creation.json();
    await testInfo.attach('generation-creation', { body: JSON.stringify({ status: creation.status(), success: creationBody.success, code: creationBody.error?.code }), contentType: 'application/json' });
    expect(creation.status(), creationBody.error?.message || '真实生成任务必须成功创建').toBe(202);
    await page.waitForFunction(() => !document.querySelector('[data-ai-candidate]')?.hidden || /失败|无法生成/.test(document.querySelector('[data-ai-status]')?.textContent), null, { timeout: 120000 });
    await expect(page.locator('[data-ai-candidate]'), await page.locator('[data-ai-status]').textContent()).toBeVisible();
    await expect(page.locator('[data-ai-adopt]')).toBeEnabled();
    const candidate = await page.locator('[data-ai-fragment]').inputValue();
    expect(candidate.trim()).toBeTruthy();
    expect(candidate).toContain(marker);
    const adoptedResponse = page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/adopt'));
    await page.locator('[data-ai-adopt]').click();
    const adopted = await adoptedResponse;
    expect(adopted.status()).toBe(200);
    const result = (await adopted.json()).data;
    expect(result.draft.revision.markdown).toContain(marker);
    expect(result.draft.revision.generationMetadata.model).toBeTruthy();
    await expect(page.locator('.handbook-writing-page')).toHaveCount(0);
    const rereadResponse = page.waitForResponse(r => r.request().method() === 'GET' && /\/draft\?/.test(r.url()));
    await page.reload();
    const reread = await rereadResponse;
    expect(reread.status()).toBe(200);
    const saved = (await reread.json()).data;
    expect(saved.draft.currentRevisionId).toBe(result.draft.currentRevisionId);
    expect(saved.draft.revision.markdown).toBe(result.draft.revision.markdown);
    await expect(page.locator('.handbook-production-content')).toContainText(marker);
    await testInfo.attach('live-writing-result', { body: JSON.stringify({ storage: 'test_hy', model: result.draft.revision.generationMetadata.model, revisionId: result.draft.currentRevisionId, candidateChars: candidate.length, pageErrors: errors }), contentType: 'application/json' });
    expect(errors).toEqual([]);
  } finally {
    if (!page.isClosed()) {
      const state = await page.evaluate(() => ({
        origin: document.querySelector('[data-ai-origin-message]')?.textContent || '',
        status: document.querySelector('[data-ai-status]')?.textContent || '',
        generationDisabled: document.querySelector('[data-ai-start]')?.disabled ?? null,
      })).catch(() => null);
      if (state) await testInfo.attach('writing-origin', { body: JSON.stringify(state), contentType: 'application/json' });
      await page.screenshot({ path: testInfo.outputPath('live-writing-final.png'), fullPage: true }).catch(() => {});
    }
  }
});
test('工作台阅读、目录切换、编辑保存与刷新回读', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await expect(page.locator('.handbook-production-header')).toHaveCount(0);
  expect(await page.locator('.handbook-production-toolbar').evaluate(el => Math.round(el.getBoundingClientRect().height))).toBe(64);
  await expect(page.locator('.handbook-production-directory')).toBeVisible();
  await page.locator('[data-handbook-directory-open]').click();
  await expect(page.locator('.handbook-production-directory')).toBeHidden();
  await page.locator('[data-handbook-directory-open]').click();
  await expect(page.locator('.handbook-production-directory')).toBeVisible();
  await page.locator('.handbook-production-toolbar [data-handbook-mode="edit"]').click();
  await page.locator('.handbook-editor-format > summary').click();
  await page.locator('[data-handbook-editor-format="markdown"]').click();
  const input = page.locator('[data-handbook-markdown-editor]');
  const mark = '工作台端到端验证 ' + Date.now();
  await input.fill((await input.inputValue()) + '\n\n' + mark + '\n');
  const saved = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().includes('/draft'));
  await page.locator('[data-handbook-draft-save]').click();
  expect((await saved).ok()).toBeTruthy();
  await page.reload();
  await expect(page.locator('.handbook-production-content')).toContainText(mark);
  await page.locator('.handbook-more-menu > summary').click();
  await expect(page.locator('[data-handbook-history]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.handbook-more-menu')).not.toHaveAttribute('open', '');
  await page.screenshot({ path: path.join(artifacts, 'isolated-read-saved.png') });
  expect(errors).toEqual([]);
});
test('保存与取消局部刷新保留目录导航上下文', async ({ page }) => {
  const directory = page.locator('.handbook-production-directory');
  const group = directory.locator('[data-handbook-directory-group]').first();
  const search = directory.locator('[data-handbook-directory-search]');
  await expect(group).toBeVisible();
  const documentIcon = directory.locator('.handbook-production-document .handbook-document-icon').first();
  await expect(documentIcon).toBeVisible();
  expect(await documentIcon.evaluate(node => {
    const style = getComputedStyle(node);
    return style.maskImage !== 'none' && style.width === '16px' && style.height === '16px' && node.getAttribute('aria-hidden') === 'true';
  })).toBe(true);
  await page.locator('.handbook-production-toolbar [data-handbook-mode="edit"]').click();
  await page.locator('.handbook-editor-format > summary').click();
  await page.locator('[data-handbook-editor-format="markdown"]').click();
  await search.fill('SQL');
  const searchValue = await search.inputValue();
  const wasOpen = await group.evaluate(node => node.open);
  const scrollRegion = directory.locator('[data-scroll-region="panel"]');
  const scrollTop = await scrollRegion.evaluate(node => node.scrollTop);
  const directoryHandle = await directory.evaluateHandle(node => node);
  const groupHandle = await group.evaluateHandle(node => node);
  const directoryIcon = await directory.locator('svg[data-lucide]').first().evaluateHandle(node => node);
  const input = page.locator('[data-handbook-markdown-editor]');
  await input.fill((await input.inputValue()) + '\n\n局部刷新保存验证\n');
  const saved = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().includes('/draft'));
  await page.locator('[data-handbook-draft-save]').click();
  expect((await saved).ok()).toBeTruthy();
  await expect.poll(async () => ({
    sameDirectory: await directoryHandle.evaluate(node => node.isConnected && node === document.querySelector('.handbook-production-directory')),
    sameGroup: await groupHandle.evaluate(node => node.isConnected && node === document.querySelector('[data-handbook-directory-group]')),
  })).toEqual({ sameDirectory: true, sameGroup: true });
  await expect(search).toHaveValue(searchValue);
  await expect(group).toHaveJSProperty('open', wasOpen);
  await expect(scrollRegion).toHaveJSProperty('scrollTop', scrollTop);
  expect(await directoryIcon.evaluate(node => node.isConnected)).toBe(true);
  await expect(page.locator('.handbook-production-editor [data-lucide]:not(svg)')).toHaveCount(0);
  await expect(page.locator('.handbook-production-editor svg[data-lucide]').first()).toBeVisible();
  await input.fill('取消局部刷新验证');
  await page.locator('.handbook-more-menu > summary').click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-handbook-discard]').click();
  await expect(input).not.toHaveValue('取消局部刷新验证');
  await expect.poll(async () => ({
    sameDirectory: await directoryHandle.evaluate(node => node.isConnected && node === document.querySelector('.handbook-production-directory')),
    sameGroup: await groupHandle.evaluate(node => node.isConnected && node === document.querySelector('[data-handbook-directory-group]')),
  })).toEqual({ sameDirectory: true, sameGroup: true });
  await expect(search).toHaveValue(searchValue);
  await expect(group).toHaveJSProperty('open', wasOpen);
  await expect(scrollRegion).toHaveJSProperty('scrollTop', scrollTop);
  expect(await directoryIcon.evaluate(node => node.isConnected)).toBe(true);
  await expect(page.locator('.handbook-production-editor [data-lucide]:not(svg)')).toHaveCount(0);
  await expect(page.locator('.handbook-production-editor svg[data-lucide]').first()).toBeVisible();
  await directoryIcon.dispose();
  await directoryHandle.dispose();
  await groupHandle.dispose();
});
test('AI 嵌入面板与六类来源，关闭后人工正文保留', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.locator('.handbook-production-toolbar [data-handbook-mode="edit"]').click();
  await page.locator('.handbook-editor-format > summary').click();
  const formatVisibility = await page.locator('[data-handbook-editor-format="markdown"]').evaluate(node => {
    const rect = node.getBoundingClientRect();
    const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    return { rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      hit: node === document.elementFromPoint(center.x, center.y) || node.contains(document.elementFromPoint(center.x, center.y)) };
  });
  expect(formatVisibility.hit, JSON.stringify(formatVisibility)).toBe(true);
  await page.locator('[data-handbook-editor-format="markdown"]').click();
  const mark = '未保存人工内容 ' + Date.now();
  await page.locator('[data-handbook-markdown-editor]').fill(mark);
  await page.locator('.handbook-production-toolbar [data-handbook-ai-action="generate"]').click();
  await expect(page.locator('.handbook-writing-page.is-embedded')).toBeVisible();
  await expect(page.locator('.handbook-production-toolbar')).toBeVisible();
  await expect(page.locator('.handbook-production-directory')).toBeVisible();
  await expect(page.locator('[data-ai-original]')).toHaveValue(mark);
  await page.locator('[data-ai-settings-open]').click();
  await expect(page.locator('[data-ai-settings-panel] [data-ai-source-add]')).toHaveCount(0);
  await page.locator('[data-ai-settings-apply]').click();
  await page.locator('[data-ai-source-add]').click();
  expect((await page.locator('[data-ai-source-type] option').allTextContents()).map(x => x.replace('（未配置）', ''))).toEqual(['网页来源', 'Pingcode设计文档', 'Pingcode测试文档', '知识库（MCP）', '测试用例集', '本地文档']);
  await page.locator('[data-reference-type="knowledge-mcp"]').click();
  await expect(page.locator('[data-ai-source-locator]')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.locator('[data-ai-close]').click();
  await expect(page.locator('[data-handbook-markdown-editor]')).toHaveValue(mark);
  expect(errors).toEqual([]);
});
test('390px 目录抽屉、AI 写作与正文无横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.handbook-production-directory [data-handbook-directory-close]').click();
  await page.locator('[data-handbook-directory-open]').click();
  await expect(page.locator('.handbook-production-directory')).toBeVisible();
  await page.locator('.handbook-production-directory [data-handbook-directory-close]').click();
  await page.locator('.handbook-production-toolbar [data-handbook-ai-action="generate"]').click();
  await expect(page.locator('.handbook-writing-page.is-embedded')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: path.join(artifacts, 'isolated-mobile-ai.png'), fullPage: true });
});

test('真实存储：本地拖拽上传、长引用列表折叠与跨滚动优先级调整', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.locator('.handbook-production-toolbar [data-handbook-ai-action="generate"]').click();
  await page.locator('[data-ai-source-add]').click();
  await page.locator('[data-reference-type="local-document"]').click();
  for (let index = 1; index <= 8; index++) {
    const name = `隔离长列表参考${index}.md`;
    const content = `# 参考依据 ${index}\n\n用于本地上传、解析和引用顺序验证。`;
    const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/ai-sources/uploads?'));
    if (index === 1) {
      const transfer = await page.evaluateHandle(({ name, content }) => {
        const data = new DataTransfer(); data.items.add(new File([content], name, { type: 'text/markdown' })); return data;
      }, { name, content });
      await page.locator('[data-ai-source-upload]').dispatchEvent('drop', { dataTransfer: transfer });
      await transfer.dispose();
    } else {
      await page.locator('[data-ai-source-file]').setInputFiles({ name, mimeType: 'text/markdown', buffer: Buffer.from(content) });
    }
    const uploaded = await response;
    expect(uploaded.status()).toBe(201);
    const source = (await uploaded.json()).data;
    expect(source.content).toContain(`参考依据 ${index}`);
    expect(source.contentDigest).toMatch(/^[a-f0-9]{64}$/);
    await expect(page.locator('[data-ai-source-file]')).toBeEnabled();
    await expect(page.locator('[data-ai-source-list] section')).toHaveCount(index + 1);
  }
  await page.locator('[data-ai-reference-panel] footer [data-ai-reference-close]').click();
  await expect(page.locator('[data-ai-reference-panel]')).toBeHidden();
  await page.locator('[data-ai-source-add]').click();
  await expect(page.locator('[data-ai-source-list] section:visible')).toHaveCount(3);
  await page.locator('[data-ai-references-toggle]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-ai-references-toggle]')).toHaveAttribute('aria-expanded', 'true');
  const list = page.locator('[data-ai-source-list]');
  const rows = list.locator('section');
  expect(await list.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  const original = await rows.evaluateAll(nodes => nodes.map(node => node.dataset.sourceId));
  const source = rows.last().locator('[draggable]');
  await source.scrollIntoViewIfNeeded();
  const start = await source.boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 12, start.y + start.height / 2, { steps: 5 });
  await expect(rows.last()).toHaveClass(/is-dragging/);
  // Keep the native browser drag active while scrolling its list to the first row.
  await list.evaluate(el => { el.scrollTop = 0; });
  const end = await rows.first().boundingBox();
  await page.mouse.move(end.x + 40, end.y + 8, { steps: 10 });
  await page.mouse.up();
  await expect(rows.first()).toHaveAttribute('data-source-id', original.at(-1));
  expect(await rows.evaluateAll(nodes => nodes.map(node => node.dataset.sourceId))).toEqual([original.at(-1), ...original.slice(0, -1)]);
  await expect(rows.first().locator('[data-source-priority]')).toHaveText('优先级 1');
  await page.locator('[data-ai-references-toggle]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-ai-references-toggle]')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('[data-ai-source-list] section:visible')).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath('reference-order-after-scroll.png'), fullPage: true });
});


test('真实仓库无授权时显示恢复入口且不提交空白来源', async ({ page }, testInfo) => {
  test.skip(process.env.WRITING_AUTH_RECOVERY !== '1', '显式启用无OAuth隔离账号场景');
  const handbookId = new URL(page.url()).pathname.split('/').at(-1);
  const access = await page.context().request.get(base + '/knowledge-center/api/gitlab/handbooks/' + handbookId + '/access-status');
  expect(access.status()).toBe(200);
  const status = (await access.json()).data;
  expect(status.canRead, '该场景验证隔离账号缺少OAuth的真实前提').toBe(false);
  let submissions = 0;
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() === 'POST' && /\/ai-jobs(?:\?|$)/.test(request.url())) submissions++; });
  await page.locator('.handbook-production-toolbar [data-handbook-ai-action="generate"]').click();
  await expect(page.locator('[data-ai-origin-message]')).toContainText('授权 GitLab');
  await expect(page.locator('[data-ai-origin-authorize]')).toBeVisible();
  await expect(page.locator('[data-ai-start]')).toBeDisabled();
  await page.locator('[data-ai-requirements]').fill('来源恢复前保留写作要求');
  const checks = page.waitForResponse(response => response.url().includes('/access-status') && response.request().method() === 'GET');
  await page.locator('[data-ai-origin-recheck]').click();
  expect((await checks).status()).toBe(200);
  await expect(page.locator('[data-ai-origin-recheck]')).toBeEnabled();
  await expect(page.locator('[data-ai-origin-message]')).toContainText('授权 GitLab');
  await expect(page.locator('[data-ai-requirements]')).toHaveValue('来源恢复前保留写作要求');
  expect(submissions).toBe(0); expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('origin-authorization-recovery.png'), fullPage: true });
});
