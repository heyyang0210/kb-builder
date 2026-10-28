const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const { setup } = require('./fixtures/production-writing.cjs');
const artifacts = path.resolve('runtime/test-results/production-writing');
fs.mkdirSync(artifacts, { recursive: true });
const ctx = { outlineVersionId: 'outline-v1', branch: 'main' };
const suffix = '/handbooks/HB-1/documents/doc-1';
const initial = '# 安装准备\n\n前文相同。\n\n安装前，请确认环境满足部署要求，并准备所需文件。\n\n后文相同。\n';
const selected = '安装前，请确认环境满足部署要求，并准备所需文件。';

async function launch(t, ai = {}, fixtureOptions = {}) {
  const api = await setup(t, { ...fixtureOptions, browser: true, ai });
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(api.origin + '/browser-fixture');
  await page.addStyleTag({ url: '/knowledge-center/common/vendor/vditor/dist/index.css' });
  await page.addScriptTag({ url: '/knowledge-center/common/vendor/vditor/dist/index.min.js' });
  await page.evaluate(async ({ initial, ctx }) => {
    const { retainWritingSelection } = await import('/knowledge-center/modules/production/writing-selection.js');
    const { openProductionWritingPage } = await import('/knowledge-center/modules/production/production-writing-page.js');
    await new Promise(resolve => {
      window.editor = new Vditor(document.querySelector('[data-handbook-vditor]'), {
        cdn: location.origin + '/knowledge-center/common/vendor/vditor', mode: 'wysiwyg', lang: 'zh_CN',
        value: initial, cache: { enable: false }, after: resolve,
      });
    });
    window.getRange = retainWritingSelection(() => ({ editor: window.editor, element: document.querySelector('[data-handbook-vditor]') }));
    window.openWriting = (extra = {}) => openProductionWritingPage({
      context: { handbookId: 'HB-1', documentId: 'doc-1', ...ctx }, operation: 'polish',
      initialRange: window.getRange(), editVersion: window.version || 0, outline: '安装准备',
      onEdit: value => window.editor.setValue(value),
      getMarkdown: () => window.editor.getValue(), baselineDigest: async () => '',
      trigger: document.querySelector('#open-writing'),
      onAdopt: result => { window.saved = result; window.version = result.draft.editVersion; window.editor.setValue(result.draft.revision.markdown); }, ...extra,
    });
    document.querySelector('#open-writing').onclick = () => window.openWriting();
  }, { initial, ctx });
  return { api, page, errors };
}
async function selectText(page, text, collapsed = false) {
  await page.evaluate(({ text, collapsed }) => {
    const root = document.querySelector('.vditor-wysiwyg [contenteditable="true"]');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let node;
    while ((node = walker.nextNode())) {
      const offset = node.textContent.indexOf(text);
      if (offset < 0) continue;
      const range = document.createRange(); range.setStart(node, offset); range.setEnd(node, offset + text.length);
      if (collapsed) range.collapse(false);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange')); return;
    }
    throw new Error('Selection text not found');
  }, { text, collapsed });
}
async function waitCandidate(page) {
  await page.waitForFunction(() => !document.querySelector('[data-ai-candidate]')?.hidden && !document.querySelector('[data-ai-adopt]')?.disabled);
}
async function screenshot(page, name) {
  if (name.includes('candidate')) await page.locator('[data-ai-candidate]').evaluate(el => el.scrollIntoView({ block: 'start' }));
  else await page.locator('.handbook-writing-page').evaluate(dialog => { dialog.scrollTop = 0; });
  await page.screenshot({ path: path.join(artifacts, name + '.png') });
}

async function openReferences(page) {
  if (await page.locator('[data-ai-settings-panel]').isVisible()) await page.locator('[data-ai-settings-apply]').click();
  if (!await page.locator('[data-ai-reference-panel]').isVisible()) await page.locator('[data-ai-source-add]').click();
}
async function closeReferences(page) {
  if (await page.locator('[data-ai-reference-panel]').isVisible()) await page.locator('[data-ai-reference-panel] footer button').click();
}
async function finishConfiguration(page) {
  await closeReferences(page);
  if (await page.locator('[data-ai-settings-panel]').isVisible()) await page.locator('[data-ai-settings-apply]').click();
}
test('网页资料多选按作者调整的引用优先级进入生成任务', async t => {
  let imageReads = 0;
  const web = http.createServer((req, res) => {
    if (req.url === '/diagram.png') { imageReads++; res.setHeader('Content-Type', 'image/png'); res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64')); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<html><head><title>${req.url === '/a' ? '甲资料' : '乙资料'}</title></head><body><main><h1>${req.url === '/a' ? '甲资料' : '乙资料'}</h1><p>${req.url === '/a' ? '甲事实' : '乙事实'}</p>${req.url === '/a' ? '<img src="/diagram.png" alt="结构图"><p>&lt;img src=x onerror=alert(1)&gt;</p>' : ''}</main></body></html>`);
  });
  await new Promise(resolve => web.listen(0, '127.0.0.1', resolve));
  t.after(() => { web.closeAllConnections(); web.close(); });
  const origin = `http://127.0.0.1:${web.address().port}`;
  const rules = structuredClone(require('../../../config/knowledge-center/content-rules.json').productionAI);
  rules.sources.urlOrigins = [origin];
  const calls = [];
  const { api, page, errors } = await launch(t, { rules, generate: async messages => {
    calls.push(JSON.parse(messages.at(-1).content));
    return { content: '整理后的正文', model: 'deterministic-e2e' };
  } });
  let jobId;
  page.on('response', async response => {
    if (response.request().method() === 'POST' && response.url().includes('/ai-jobs')) {
      try { jobId = (await response.json()).data.jobId; } catch (_) {}
    }
  });
  await page.evaluate(() => window.openWriting({ initialRange: { start: 0, end: 6 } }));
  await page.locator('[data-ai-settings-open]').click();
  await openReferences(page);
  await page.locator('[data-reference-type=\"url\"]').click();
  for (const path of ['/a', '/b']) {
    if (path === '/b') await openReferences(page);
    await page.locator('[data-ai-source-locator]').fill(origin + path);
    await page.locator('[data-ai-source-preview]').click();
    await page.waitForFunction(count => document.querySelectorAll('[data-ai-source-list] section').length === count && !document.querySelector('[data-ai-source-preview]').disabled, path === '/a' ? 2 : 3);
    assert.equal(await page.locator('[data-ai-source-list] section').last().locator('input[type="checkbox"]').isChecked(), true);
  }
  assert.match(await page.locator('[data-ai-source-count]').textContent(), /已添加 2 项 · 默认引用知识库/);
  assert.equal(await page.locator('[data-ai-model]').count(), 0);
  await closeReferences(page);
  const previewPagePromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: '预览资料：甲资料' }).click();
  const previewPage = await previewPagePromise;
  assert.match(await previewPage.locator('main').textContent(), /甲事实/);
  assert.match(await previewPage.locator('header').textContent(), /甲资料/);
  assert.equal(await previewPage.getByRole('button', { name: '阅读视图' }).getAttribute('aria-pressed'), 'true');
  await previewPage.locator('#reading img').waitFor();
  await previewPage.waitForFunction(() => document.querySelector('#reading img')?.complete);
  assert.equal(await previewPage.locator('#reading img').evaluate(img => img.naturalWidth), 1);
  assert.ok(imageReads > 0);
  assert.equal(await previewPage.locator('#reading img[onerror]').count(), 0);
  await previewPage.screenshot({ path: path.join(artifacts, 'source-reading-preview.png'), fullPage: true });
  await previewPage.getByRole('button', { name: '原始内容' }).click();
  assert.equal(await previewPage.locator('#raw').isVisible(), true);
  assert.equal(await previewPage.locator('#reading').isVisible(), false);
  assert.match(await previewPage.locator('#raw').textContent(), /!\[结构图\]/);
  await previewPage.getByRole('button', { name: '阅读视图' }).click();
  assert.equal(await previewPage.locator('#reading').isVisible(), true);
  await previewPage.setViewportSize({ width: 390, height: 844 });
  assert.equal(await previewPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await previewPage.screenshot({ path: path.join(artifacts, 'source-reading-preview-mobile.png'), fullPage: true });
  await previewPage.close();
  assert.deepEqual(await page.locator('[data-source-priority]').allTextContents(), ['优先级 1', '优先级 2', '优先级 3']);
  await page.getByRole('button', { name: '上移资料：乙资料' }).click();
  assert.deepEqual(await page.locator('[data-ai-source-list] section label').allTextContents(), ['⋮⋮知识库（MCP）', '⋮⋮乙资料', '⋮⋮甲资料']);
  assert.deepEqual(await page.locator('[data-source-priority]').allTextContents(), ['优先级 1', '优先级 2', '优先级 3']);
  assert.equal(await page.getByRole('button', { name: '上移资料：知识库（MCP）' }).isDisabled(), true);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('[data-ai-settings-panel] .handbook-ai-settings-dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  await page.screenshot({ path: path.join(artifacts, 'mobile-source-priority.png') });
  await finishConfiguration(page);
  await page.locator('[data-ai-start]').click();
  await waitCandidate(page);
  const response = await api.request('GET', `${suffix}/ai-jobs/${jobId}?${new URLSearchParams(ctx)}`);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const sources = response.body.data.sourceSnapshots;
  assert.deepEqual(sources.map(source => [source.title, source.priority]), [['乙资料', 1], ['甲资料', 2]]);
  assert.deepEqual(calls[0].sources.map(source => [source.title, source.priority]), [['乙资料', 1], ['甲资料', 2]]);
  assert.deepEqual(errors, []);
});

test('真实编辑器与 HTTP：范围继承、重生成恢复、取消、候选采用回读及版本冲突', async t => {
  let release; const calls = [];
  const { api, page, errors } = await launch(t, { generate: async messages => {
    const payload = JSON.parse(messages.at(-1).content); calls.push(payload);
    if (payload.requirements === '测试失败') throw new Error('测试生成失败');
    if (payload.requirements === '等待取消') return new Promise(resolve => { release = resolve; });
    return { content: payload.requirements === '更简洁' ? '确认部署环境，并备齐安装文件。' : '请确认部署环境符合要求，并备齐所需安装文件。', model: 'deterministic-e2e' };
  } });
  await selectText(page, selected);
  const range = await page.evaluate(() => window.getRange());
  assert.deepEqual(range, { start: initial.indexOf(selected), end: initial.indexOf(selected) + selected.length });
  await page.locator('#open-writing').click();
  assert.match(await page.locator('[data-ai-range]').textContent(), /已确认处理/);
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.equal(new URL(page.url()).searchParams.get('writing'), 'polish');
  assert.equal(await page.locator('.handbook-writing-page').evaluate(el => el.parentElement.id), 'view-root');
  assert.equal(await page.locator('[data-ai-sources]').getAttribute('open'), null);
  assert.ok(await page.locator('.handbook-writing-page').evaluate(el => el.clientWidth) > 1000);
  const columns = await page.locator('.handbook-writing-layout').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length); assert.equal(columns, 2);
  const assistant = page.locator('.handbook-writing-assistant');
  assert.equal(await page.locator('[data-ai-cancel]').isVisible(), false);
  assert.equal(await page.locator('[data-ai-resume]').isVisible(), false);
  assert.equal(await page.locator('[data-ai-operation]').isVisible(), false, '低频写作方式收纳到设置');
  const compact = await assistant.boundingBox();
  assert.ok(compact.height <= 700, `初始侧栏应紧凑，实际高度 ${compact.height}`);
  fs.writeFileSync(path.join(artifacts, 'assistant-density.json'), JSON.stringify({ viewport: '1366x900', width: compact.width, height: compact.height, idleCancelVisible: false, emptyResumeVisible: false }, null, 2));
  await screenshot(page, 'desktop-writing');
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.equal(calls[0].selectedContent, selected);
  assert.equal((await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx))).body.data.exists, false);
  await page.locator('[data-ai-fragment]').fill('人工微调的候选');
  await page.locator('[data-ai-refine]').click();
  assert.equal(await page.locator('[data-ai-requirements]').evaluate(el => el === document.activeElement), true);
  await page.locator('[data-ai-requirements]').fill('测试失败');
  await page.locator('[data-ai-start]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-status]').textContent.includes('上次候选仍保留'));
  assert.equal(await page.locator('[data-ai-fragment]').inputValue(), '人工微调的候选');
  await page.locator('[data-ai-requirements]').fill('等待取消'); await page.locator('[data-ai-start]').click();
  await page.locator('[data-ai-cancel]:enabled').waitFor(); await page.locator('[data-ai-cancel]').click();
  await waitCandidate(page); assert.equal(await page.locator('[data-ai-fragment]').inputValue(), '人工微调的候选');
  release({ content: '迟到内容' });
  await page.locator('[data-ai-requirements]').fill('更简洁'); await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.equal(await page.locator('[data-ai-fragment]').inputValue(), '确认部署环境，并备齐安装文件。');
  await screenshot(page, 'desktop-candidate');
  await page.locator('[data-ai-close]').click();
  await page.locator('#open-writing').click(); await page.locator('[data-ai-resume]').click(); await waitCandidate(page);
  assert.equal(await page.locator('[data-ai-before]').inputValue(), selected);
  await page.locator('[data-ai-fragment]').fill('先确认部署环境，再备齐文件。'); await page.locator('[data-ai-adopt]').click();
  await page.waitForFunction(() => !!window.saved);
  const reread = await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx));
  assert.equal(reread.status, 200); assert.equal(reread.body.data.draft.revision.markdown, initial.replace(selected, '先确认部署环境，再备齐文件。'));
  assert.ok(reread.body.data.draft.revision.generationMetadata.provenance.some(item => item.kind === 'human_edit'));
  // A second author saves after generation. Adoption must retain the newer draft.
  await page.evaluate(() => window.openWriting({ initialRange: { start: 0, end: 6 } }));
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  const newer = await api.request('PUT', suffix + '/draft', JSON.stringify({ ...ctx, editVersion: 1, markdown: '其他作者的新正文' }), { 'Content-Type': 'application/json', 'Idempotency-Key': 'writing-conflict' });
  assert.equal(newer.status, 200, JSON.stringify(newer.body));
  await page.locator('[data-ai-adopt]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-status]').textContent.includes('采用未完成'));
  assert.match((await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx))).body.data.draft.revision.markdown, /其他作者的新正文/);
  assert.equal(await page.locator('[data-ai-candidate]').isVisible(), true);
  assert.deepEqual(errors, []);
});

test('选区边界、续写、手动确认、资料与窄屏键盘访问', async t => {
  const { api, page, errors } = await launch(t, { generate: async () => ({ content: '续写内容', model: 'deterministic-e2e' }) });
  // Real Lute conversion must preserve Markdown offsets with bold and repeated text.
  await page.evaluate(() => window.editor.setValue('重复段落。\n\n重复段落。\n\n请**检查环境**后继续。\n'));
  await selectText(page, '检查环境');
  assert.deepEqual(await page.evaluate(() => window.getRange()), { start: 17, end: 21 });
  assert.equal(await page.evaluate(async () => {
    const { markdownRangeFromDOM } = await import('/knowledge-center/modules/production/writing-selection.js');
    return markdownRangeFromDOM(window.editor, document.querySelector('[data-handbook-vditor]'), window.getSelection().getRangeAt(0), '内容已变化');
  }), null);
  await selectText(page, '后继续。', true);
  const caret = await page.evaluate(() => window.getRange()); assert.equal(caret.start, caret.end);
  await page.evaluate(() => window.openWriting({ operation: 'continue' }));
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.equal(await page.locator('[data-ai-before]').inputValue(), '');
  await page.locator('[data-ai-adopt]').click(); await page.waitForFunction(() => !!window.saved);
  assert.ok((await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx))).body.data.draft.revision.markdown.includes('续写内容'));
  await page.evaluate(() => window.openWriting({ initialRange: null }));
  assert.equal(await page.locator('[data-ai-start]').isDisabled(), true);
  await page.locator('[data-ai-full]').click(); assert.equal(await page.locator('[data-ai-start]').isEnabled(), true);
  await page.locator('[data-ai-settings-open]').click();
  await openReferences(page);
  await page.locator('[data-ai-source-type] option[value="test-case-library"]').waitFor({ state: 'attached' });
  await page.locator('[data-reference-type=\"test-case-library\"]').click();
  await page.locator('[data-ai-source-locator]').fill('ai-quality-smoke-select.sql'); await page.locator('[data-ai-source-preview]').click();
  const checkbox = page.locator('[data-ai-source-list] input[type="checkbox"]').last(); await checkbox.waitFor({ state: 'attached' });
  await page.waitForFunction(() => document.querySelectorAll('[data-ai-source-list] section').length === 2);
  assert.equal(await checkbox.isChecked(), true);
  await closeReferences(page);
  assert.match(await page.locator('[data-ai-source-count]').textContent(), /已添加 1 项 · 默认引用知识库/);
  assert.equal(await page.locator('[data-ai-source-list] textarea').isVisible(), false);
  await page.getByRole('button', { name: '移除资料', exact: true }).click();
  assert.match(await page.locator('[data-ai-source-count]').textContent(), /已添加 0 项/);
  await finishConfiguration(page);
  await page.setViewportSize({ width: 390, height: 844 }); await screenshot(page, 'mobile-writing');
  assert.deepEqual(await page.locator('[data-ai-original]').evaluate(el => {
    const style = getComputedStyle(el);
    return { overflow: style.overflowY, fits: el.scrollHeight <= el.clientHeight + 1, border: style.borderTopWidth };
  }), { overflow: 'hidden', fits: true, border: '0px' }, '窄屏正文无框并随内容伸展，无输入区内部滚动');
  await page.locator('[data-ai-start]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(artifacts, 'mobile-writing-controls.png') });
  assert.equal(await page.locator('.handbook-writing-page').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  await page.locator('[data-ai-settings-summary]').evaluate(el => { el.textContent = '模型名称'.repeat(30) + ' · 安装模板 · 2 项资料'; });
  assert.equal(await page.locator('.handbook-writing-assistant').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, '窄屏长摘要不溢出');
  await page.locator('[data-ai-close]').click();
  await page.locator('.handbook-writing-page').waitFor({ state: 'detached' });
  assert.equal(await page.locator('#open-writing').evaluate(el => el === document.activeElement), true);
  assert.deepEqual(errors, []);
});

test('生成设置弹框按操作提供 Skill，并将作者选择冻结到续写任务', async t => {
  const { api, page, errors } = await launch(t, { generate: async () => ({ content: '补充的续写内容', model: 'deterministic-e2e' }) });
  let createdJobId = null;
  page.on('response', async response => {
    if (response.request().method() !== 'POST' || !response.url().includes('/ai-jobs')) return;
    try { createdJobId = (await response.json()).data.jobId; } catch (_) {}
  });
  await page.evaluate(() => window.openWriting({ operation: 'continue', initialRange: { start: 8, end: 8 } }));
  await page.locator('[data-ai-settings-open]').click();
  await page.locator('[data-ai-skills]').evaluate(el => el.open = true);
  const skill = page.locator('[data-ai-skill-list] input[value="continue-technical-document"]');
  await skill.waitFor();
  assert.equal(await skill.isChecked(), false);
  assert.doesNotMatch(await page.locator('[data-ai-settings-summary]').textContent(), /0 个 Skill|0 项资料|未选模板/);
  await skill.check();
  assert.match(await page.locator('[data-ai-settings-summary]').textContent(), /1 个 Skill/);
  await finishConfiguration(page);
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.ok(createdJobId);
  const response = await api.request('GET', `${suffix}/ai-jobs/${createdJobId}?${new URLSearchParams(ctx)}`);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const job = response.body.data;
  assert.deepEqual(job.skillSnapshots.map(item => item.skillId), ['continue-technical-document']);
  assert.deepEqual(errors, []);
});

test('真实配置模型：选文润色 → 候选 → 采用 → HTTP 草稿回读', { skip: process.env.WRITING_LIVE_MODEL !== '1', timeout: 180000 }, async t => {
  const { api, page, errors } = await launch(t); page.setDefaultTimeout(120000);
  const observations = [];
  page.on('response', async response => {
    if (!response.url().includes('/ai-jobs/') || response.request().method() !== 'GET') return;
    try {
      const body = await response.json(); const value = body.data?.job || body.data;
      if (value?.status) observations.push({ status: value.status, stages: value.stageRuns?.map(run => ({ stage: run.stageId, status: run.status, tool: run.toolName })), previewChars: value.executionPreview?.text?.length || 0 });
    } catch (_) {}
  });
  await selectText(page, selected); await page.locator('#open-writing').click();
  await page.locator('[data-ai-requirements]').fill('仅润色选中的部署准备句子，保持原意，简洁自然，不增加参数、版本、事实。不要联网。');
  await page.locator('[data-ai-start]').click();
  await page.waitForFunction(() => !document.querySelector('[data-ai-candidate]')?.hidden || /失败|无法生成/.test(document.querySelector('[data-ai-status]')?.textContent), null, { timeout: 120000 });
  assert.equal(await page.locator('[data-ai-candidate]').isVisible(), true, await page.locator('[data-ai-status]').textContent());
  const fragment = await page.locator('[data-ai-fragment]').inputValue(); assert.ok(fragment.trim());
  assert.ok(observations.some(value => value.status === 'running' && value.stages?.some(run => run.status === 'running' && run.tool)), '真实模型完成前必须可查询执行中的工具调用');
  fs.writeFileSync(path.join(artifacts, 'live-model-progress.json'), JSON.stringify(observations, null, 2));
  assert.equal(await page.evaluate(() => window.editor.getValue()), initial);
  await screenshot(page, 'live-model-candidate');
  await page.locator('[data-ai-adopt]').click(); await page.waitForFunction(() => !!window.saved);
  const reread = await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx));
  assert.equal(reread.status, 200); assert.equal(reread.body.data.draft.revision.markdown, initial.replace(selected, fragment).trimEnd() + '\n');
  const metadata = reread.body.data.draft.revision.generationMetadata; assert.ok(metadata.model);
  fs.writeFileSync(path.join(artifacts, 'live-model-result.json'), JSON.stringify({ passed: true, testedAt: new Date().toISOString(), model: metadata.model, modelSelection: metadata.modelSelection, revisionId: reread.body.data.draft.revision.revisionId, candidateChars: fragment.length, authentication: 'injected editor fixture', storage: 'isolated memory', sharedDraftsChanged: false, pageErrors: errors }, null, 2));
  assert.deepEqual(errors, []);
});


test('沉浸式富文本编辑、单一资料入口与浏览器返回保留正文', async t => {
  const { page, errors } = await launch(t);
  await page.evaluate(() => window.openWriting({ loadEditor: async () => window.Vditor }));
  const rich = page.locator('[data-ai-rich-editor] .vditor-wysiwyg [contenteditable="true"]');
  await rich.waitFor();
  assert.equal(await page.locator('dialog').count(), 0);
  assert.equal(await page.locator('[data-ai-source-preview]').count(), 1);
  await rich.click(); await page.keyboard.press('Control+End'); await page.keyboard.type('新增人工说明。');
  await page.waitForFunction(() => window.editor.getValue().includes('新增人工说明。'));
  assert.equal(await page.locator('[data-ai-start]').isDisabled(), true);
  await page.goBack();
  await page.locator('.handbook-writing-page').waitFor({ state: 'detached' });
  assert.ok(await page.evaluate(() => window.editor.getValue().includes('新增人工说明。')));
  assert.equal(await page.locator('#open-writing').isVisible(), true);
  assert.deepEqual(errors, []);
});

test('GitLab 基线漂移显示对照，载入新基线后要求重新确认范围', async t => {
  const { page, errors } = await launch(t);
  await page.route('**/ai-jobs', route => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'AI_ORIGIN_BASELINE_CHANGED', message: '基线已更新' } }) }));
  await page.evaluate(() => window.openWriting({
    initialRange: { start: 0, end: window.editor.getValue().length },
    originSnapshot: { originType: 'gitlab', snapshotId: 'old-commit', contentDigest: 'a'.repeat(64), handbookId: 'HB-1', documentId: 'doc-1', branch: 'main', path: 'docs/doc-1.md', commitId: 'old-commit' },
    loadLatestOrigin: async () => ({ content: '# 安装准备\n\nGitLab 新增了前置检查。\n', snapshot: { originType: 'gitlab', snapshotId: 'new-commit', contentDigest: 'b'.repeat(64), handbookId: 'HB-1', documentId: 'doc-1', branch: 'main', path: 'docs/doc-1.md', commitId: 'new-commit' } }),
  }));
  await page.locator('[data-ai-start]').click();
  const drift = page.locator('.handbook-origin-drift-dialog'); await drift.waitFor();
  assert.match(await drift.textContent(), /当前基线[\s\S]*GitLab 最新基线/);
  assert.match(await drift.locator('pre').nth(1).textContent(), /新增了前置检查/);
  await drift.getByRole('button', { name: '载入 GitLab 最新基线' }).click();
  assert.equal(await page.locator('[data-ai-original]').inputValue(), '# 安装准备\n\nGitLab 新增了前置检查。\n');
  assert.match(await page.locator('[data-ai-range]').textContent(), /尚未选择/);
  assert.equal(await page.locator('[data-ai-start]').isDisabled(), true);
  assert.deepEqual(errors, []);
});

test('模板同框搜索、面板图标切换、运行详情和临时断线恢复同一任务', async t => {
  let release; let progress; let calls = 0; let captured;
  const hash = require('../../../packages/agent-runner-core/lib/template-store').hash;
  const templates = [
    { id: 'tpl-install', name: '安装指南', status: 'active', currentVersion: 1, versions: [{ version: 1, content: '# 安装步骤', contentHash: hash('# 安装步骤'), validationStatus: 'passed' }] },
    { id: 'tpl-sql', name: 'SQL 参考模板', status: 'active', currentVersion: 2, versions: [{ version: 2, content: '# SQL 语法', contentHash: hash('# SQL 语法'), validationStatus: 'passed' }] },
    { id: 'tpl-disabled', name: '已停用模板', status: 'disabled' },
  ];
  const { api, page, errors } = await launch(t, { generate: async (messages, _model, execution) => {
    calls++; captured = JSON.parse(messages.at(-1).content); progress = execution.onProgress;
    progress('{"markdown":"已生成第一段');
    return new Promise(resolve => { release = resolve; });
  } }, { templates });
  await page.evaluate(() => window.openWriting({ initialRange: { start: 0, end: 6 }, templateId: 'tpl-install' }));
  await page.locator('[data-ai-settings-open]').click();
  assert.equal(await page.locator('[data-ai-settings-operation="polish"]').isVisible(), false);
  assert.equal(await page.locator('[data-ai-settings-panel] [data-ai-sources]').count(), 0);
  assert.equal(await page.locator('[data-ai-operation]').inputValue(), 'polish');
  assert.deepEqual(await page.locator('[data-ai-operation] option').allTextContents(), ['文档生成', '内容修订', '内容续写']);
  assert.equal(await page.locator('[data-ai-template-section]').isVisible(), true);
  await finishConfiguration(page);
  await page.locator('[data-ai-quick-operation=\"continue\"]').click();
  await page.locator('[data-ai-settings-open]').click();
  assert.equal(await page.locator('[data-ai-template-section]').isVisible(), false);
  assert.doesNotMatch(await page.locator('[data-ai-settings-summary]').textContent(), /安装指南/);
  await finishConfiguration(page);
  await page.locator('[data-ai-quick-operation=\"generate\"]').click();
  await page.locator('[data-ai-settings-open]').click();
  assert.equal(await page.locator('[data-ai-template-section]').isVisible(), true);
  assert.match(await page.locator('[data-ai-operation] option:checked').textContent(), /文档生成/);
  const combo = page.getByRole('combobox', { name: '模板，可输入筛选' });
  await combo.waitFor();
  await page.waitForFunction(() => document.querySelector('[data-ai-template-select]').value === 'tpl-install');
  await page.getByRole('button', { name: '展开文档模板', exact: true }).click();
  assert.equal(await page.getByRole('option', { name: /已停用模板/ }).count(), 0);
  await combo.fill('SQL');
  await page.getByRole('option', { name: 'SQL 参考模板 · v2', exact: true }).click();
  assert.equal(await combo.inputValue(), 'SQL 参考模板 · v2');
  await finishConfiguration(page);
  await page.locator('[data-ai-quick-operation=\"continue\"]').click();
  await page.locator('[data-ai-settings-open]').click();
  assert.equal(await combo.isVisible(), false);
  assert.doesNotMatch(await page.locator('[data-ai-settings-summary]').textContent(), /SQL 参考模板/);
  await finishConfiguration(page);
  await page.locator('[data-ai-quick-operation=\"polish\"]').click();
  await page.locator('[data-ai-settings-open]').click();
  await finishConfiguration(page);
  await page.locator('[data-ai-full]').click();
  await page.locator('[data-ai-settings-open]').click();
  assert.equal(await combo.inputValue(), 'SQL 参考模板 · v2');
  const settingsBox = await page.locator('[data-ai-settings-panel] .handbook-ai-settings-dialog').boundingBox();
  assert.ok(settingsBox.width === 600 && settingsBox.height <= 860, JSON.stringify(settingsBox));
  await page.screenshot({ path: path.join(artifacts, 'settings-compact-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('[data-ai-settings-panel] .handbook-ai-settings-dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  await page.screenshot({ path: path.join(artifacts, 'settings-compact-mobile.png') });
  await page.setViewportSize({ width: 1366, height: 900 });
  await finishConfiguration(page);
  await page.locator('[data-ai-start]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-preview]')?.textContent.includes('已生成第一段'));
  assert.equal(captured.template, '# SQL 语法');
  assert.equal(captured.operation, 'polish');
  assert.match(captured.instruction, /修订选定范围.*参考资料.*提供模板/);
  assert.equal(calls, 1);
  await page.locator('[data-ai-panel-toggle]').click();
  assert.equal(await page.locator('.handbook-writing-assistant').isVisible(), false);
  assert.equal(await page.locator('[data-ai-panel-toggle]').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('[data-ai-execution]').isVisible(), true);
  assert.equal(await page.locator('[data-ai-execution-cancel]').isEnabled(), true);
  const writer = page.locator('[data-ai-stages] details').filter({ hasText: '生成正文' });
  await writer.locator('summary').click();
  assert.match(await writer.locator('[aria-label="调用输入摘要"]').textContent(), /selectedChars/);
  let dropped = 0;
  await page.route('**/ai-jobs/*?*', async route => {
    if (!dropped++) await route.abort('connectionreset'); else await route.continue();
  });
  await page.waitForFunction(() => document.querySelector('[data-ai-status]')?.textContent.includes('连接暂时中断'));
  await page.waitForFunction(() => document.querySelector('[data-ai-status]')?.textContent === '正在生成');
  assert.equal(calls, 1);
  assert.equal(await writer.getAttribute('open'), '');
  await page.screenshot({ path: path.join(artifacts, 'feedback-assistant-hidden.png'), fullPage: true });
  release({ content: '{"markdown":"已生成第一段完成","provenance":[]}', model: 'fixture-model' });
  await waitCandidate(page);
  assert.equal(await page.locator('[data-ai-fragment]').inputValue(), '已生成第一段完成');
  await page.locator('[data-ai-refine]').click();
  assert.equal(await page.locator('.handbook-writing-assistant').isVisible(), true);
  assert.equal(await page.locator('[data-ai-requirements]').evaluate(el => el === document.activeElement), true);
  await page.locator('[data-ai-settings-open]').click();
  assert.equal(await combo.inputValue(), 'SQL 参考模板 · v2');
  await combo.focus(); await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-ai-settings-panel]').isVisible(), false);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('.handbook-writing-page').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  await page.locator('[data-ai-settings-summary]').evaluate(el => { el.textContent = '模型名称'.repeat(30) + ' · 安装模板 · 2 项资料'; });
  assert.equal(await page.locator('.handbook-writing-assistant').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, '窄屏长摘要不溢出');
  await page.locator('[data-ai-panel-toggle]').click();
  await page.screenshot({ path: path.join(artifacts, 'feedback-mobile.png'), fullPage: true });
  // New attempt: cancel from the main area while the assistant is hidden.
  await page.locator('[data-ai-panel-toggle]').click();
  await page.locator('[data-ai-start]').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('[data-ai-execution]').evaluate(el => el.getBoundingClientRect().bottom < 0), true, '手机长页面提交前执行区在视口上方');
  await page.locator('[data-ai-start]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-preview]')?.textContent === '已生成第一段');
  assert.equal(await page.locator('[data-ai-phase]').evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), true, '生成中当前阶段必须进入视口');
  assert.match(await page.locator('[data-ai-phase]').textContent(), /当前：生成正文/);
  await page.waitForFunction(() => /已用 [1-9]\d* 秒/.test(document.querySelector('[data-ai-elapsed]').textContent));
  await page.screenshot({ path: path.join(artifacts, 'feedback-mobile-running-viewport.png') });
  await page.locator('[data-ai-panel-toggle]').click();
  await page.locator('[data-ai-execution-cancel]').click();
  await waitCandidate(page); // the previous completed candidate remains available
  progress('{"markdown":"取消后迟到输出');
  release({ content: '取消后迟到输出' });
  assert.deepEqual(errors, []);
  const draft = await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx));
  assert.equal(draft.body.data.exists, false);
});


test('真实配置模型长文：完成前在浏览器展示正文增量与调用详情', { skip: process.env.WRITING_LIVE_MODEL !== '1', timeout: 180000 }, async t => {
  const { api, page, errors } = await launch(t);
  await page.evaluate(() => window.openWriting({ operation: 'continue', initialRange: { start: 0, end: window.editor.getValue().length } }));
  await page.locator('[data-ai-requirements]').fill('这是界面执行反馈的隔离测试。续写一份约800至1000字的通用文档编写流程说明，分八个段落，覆盖目标、范围、资料整理、结构、表达、审阅、修订和归档。只讨论通用写作流程，不增加数据库参数或具体产品事实。不要省略段落。');
  await page.locator('[data-ai-start]').click();
  try {
    await page.waitForFunction(() => {
      const preview = document.querySelector('[data-ai-preview]')?.textContent;
      const writer = document.querySelector('[data-ai-stages] [data-state="running"]');
      return preview?.length > 30 && writer?.textContent.includes('生成正文');
    }, null, { timeout: 120000 });
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, 'live-model-streaming-failed.png'), fullPage: true });
    throw new Error(`真实模型增量未出现：${await page.locator('[data-ai-status]').textContent()}；${await page.locator('[data-ai-phase]').textContent()}`, { cause: error });
  }
  assert.equal(await page.locator('[data-ai-candidate]').isVisible(), false, '正文增量出现时任务尚未完成');
  const writer = page.locator('[data-ai-stages] details').filter({ hasText: '生成正文' });
  await writer.locator('summary').click();
  assert.match(await writer.locator('[aria-label="调用输入摘要"]').textContent(), /selectedChars/);
  const observed = { testedAt: new Date().toISOString(), status: await page.locator('[data-ai-status]').textContent(), phase: await page.locator('[data-ai-phase]').textContent(), previewCharsBeforeCompletion: (await page.locator('[data-ai-preview]').textContent()).length, candidateVisible: false, storage: 'isolated memory', sharedDraftsChanged: false };
  await page.screenshot({ path: path.join(artifacts, 'live-model-running-preview.png'), fullPage: true });
  fs.writeFileSync(path.join(artifacts, 'live-model-streaming-result.json'), JSON.stringify(observed, null, 2));
  // Stop the isolated task after proving streaming; never adopt it into a shared draft.
  await page.locator('[data-ai-execution-cancel]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-status]')?.textContent === '已取消');
  assert.equal((await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx))).body.data.exists, false);
  assert.deepEqual(errors, []);
});

test('内容修订可不使用模板，续写不携带继承模板', async t => {
  let capturedRevision;
  const hash = require('../../../packages/agent-runner-core/lib/template-store').hash;
  const { page, errors } = await launch(t, { generate: async messages => { capturedRevision = JSON.parse(messages.at(-1).content); return { content: '修订后的正文', model: 'deterministic-e2e' }; } }, {
    templates: [{ id: 'inherited-template', name: '继承模板', status: 'active', currentVersion: 1,
      versions: [{ version: 1, content: '# 不应用于润色', contentHash: hash('# 不应用于润色'), validationStatus: 'passed' }] }],
  });
  let submitted;
  page.on('request', request => {
    if (request.method() === 'POST' && /\/ai-jobs$/.test(request.url())) submitted = request.postDataJSON();
  });
  await page.evaluate(() => window.openWriting({ templateId: 'inherited-template', initialRange: { start: 0, end: 6 } }));
  await page.locator('[data-ai-settings-open]').click();
  assert.equal(await page.locator('[data-ai-template-section]').isVisible(), true);
  await page.waitForFunction(() => document.querySelector('[data-ai-template-select]').value === 'inherited-template');
  await page.locator('[data-ai-template-select]').selectOption('__none', { force: true });
  await openReferences(page);
  await page.locator('[data-ai-source-type] option[value="test-case-library"]').waitFor({ state: 'attached' });
  await page.locator('[data-reference-type=\"test-case-library\"]').click();
  await page.locator('[data-ai-source-locator]').fill('ai-quality-smoke-select.sql');
  await page.locator('[data-ai-source-preview]').click();
  await page.waitForFunction(() => document.querySelectorAll('[data-ai-source-list] section').length === 2 && !document.querySelector('[data-ai-source-preview]').disabled);
  await finishConfiguration(page);
  await page.locator('[data-ai-requirements]').fill('依据参考资料修订，保留有依据的事实。');
  await page.locator('[data-ai-start]').click();
  await waitCandidate(page);
  assert.equal(submitted.operation, 'polish');
  assert.equal(submitted.templateId, null);
  assert.equal(submitted.confirmedSourceIds.length, 1);
  assert.match(capturedRevision.instruction, /事实变更必须有明确依据/);
  await page.locator('[data-ai-close]').click();
  await page.evaluate(() => window.openWriting({ operation: 'continue', templateId: 'inherited-template', initialRange: { start: 6, end: 6 } }));
  await page.locator('[data-ai-settings-open]').click();
  assert.equal(await page.locator('[data-ai-template-section]').isVisible(), false);
  await finishConfiguration(page);
  await page.locator('[data-ai-start]').click();
  await waitCandidate(page);
  assert.equal(submitted.operation, 'continue');
  assert.equal(submitted.templateId, null);
  await page.locator('[data-ai-close]').click();
  for (const operation of ['rewrite', 'update']) {
    await page.evaluate(operation => window.openWriting({ operation }), operation);
    assert.equal(await page.locator('[data-ai-operation]').inputValue(), 'polish');
    await page.locator('[data-ai-close]').click();
  }
  assert.deepEqual(errors, []);
});


test('PingCode 页面网址与短标识兼容，来源受限不误报账号权限', async t => {
  const calls = [];
  const upstream = http.createServer((req, res) => {
    calls.push(req.url);
    const [, spaceKey, pageId] = req.url.match(/spaces\/([^/]+)\/pages\/([^/]+)\/reference/) || [];
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ spaceKey, pageId, title: '设计依据', content: '# 设计依据\n已确认的事实。' }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const { api, page, errors } = await launch(t, { pingcodeBaseURL: `http://127.0.0.1:${upstream.address().port}` });
  const preview = (sourceType, locator) => api.request('POST', suffix + '/ai-sources', JSON.stringify({ ...ctx, sourceType, locator }), { 'Content-Type': 'application/json' });
  const full = 'https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/page-1';
  // A real backend request reproduces the original full-URL failure before the fix.
  const good = await preview('pingcode-design', full);
  assert.equal(good.status, 201, JSON.stringify(good.body));
  assert.equal(good.body.data.locator, 'YASDOC/page-1');
  assert.equal(good.body.data.originalUrl, full);
  for (const sourceType of ['pingcode-design', 'pingcode-test', 'url']) {
    assert.equal((await preview(sourceType, full)).status, 201);
  }
  assert.equal((await preview('pingcode-test', 'YASDOC/page-1')).status, 201);
  const pagePath = await preview('pingcode-design', 'YASDOC/pages/page-1');
  assert.equal(pagePath.status, 201, JSON.stringify(pagePath.body));
  assert.equal(pagePath.body.data.locator, 'YASDOC/page-1');
  for (const locator of ['https://other.example/wiki/spaces/YASDOC/pages/page-1', full + '?redirect=1', 'page-1']) {
    assert.equal((await preview('pingcode-design', locator)).status, 400, locator);
  }
  const beforeDenied = calls.length;
  const denied = await preview('pingcode-design', 'DENIED/page-1');
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, 'AI_SOURCE_SCOPE_DENIED');
  assert.match(denied.body.error.details.requestId, /^[a-f0-9-]{36}$/);
  assert.equal(calls.length, beforeDenied);
  await page.evaluate(() => {
    window.permissionNotices = 0;
    window.addEventListener('knowledge-center:permission-denied', () => window.permissionNotices++);
    window.openWriting({ initialRange: { start: 0, end: 6 } });
  });
  await page.locator('[data-ai-settings-open]').click();
  await openReferences(page);
  await page.locator('[data-ai-source-type] option[value="pingcode-design"]').waitFor({ state: 'attached' });
  await page.locator('[data-reference-type=\"pingcode-design\"]').click();
  assert.match(await page.locator('[data-ai-source-info]').textContent(), /页面网址/);
  await page.locator('[data-ai-source-locator]').fill('DENIED/page-1');
  await page.locator('[data-ai-source-preview]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-source-info]').textContent.includes('不在已配置'));
  assert.equal(await page.evaluate(() => window.permissionNotices), 0);
  assert.match(await page.locator('[data-ai-source-info]').textContent(), /诊断编号：[a-f0-9-]{36}/);
  await page.locator('[data-reference-type=\"url\"]').click();
  await page.locator('[data-ai-source-locator]').fill('file:///etc/passwd');
  await page.locator('[data-ai-source-preview]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-source-info]').textContent.includes('来源范围'));
  assert.equal(await page.evaluate(() => window.permissionNotices), 0);
  await page.locator('[data-reference-type=\"pingcode-design\"]').click();
  await page.locator('[data-ai-source-locator]').fill(full);
  await page.locator('[data-ai-source-preview]').click();
  await page.waitForFunction(() => document.querySelectorAll('[data-ai-source-list] section').length === 2 && !document.querySelector('[data-ai-source-preview]').disabled);
  assert.match(await page.locator('[data-ai-source-info]').textContent(), /资料已添加/);
  await openReferences(page);
  await page.locator('[data-ai-source-locator]').fill(full);
  // Account-level denial must still dispatch its global notice.
  await page.route('**/ai-sources', route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'HANDBOOK_PRODUCTION_FORBIDDEN', message: '当前用户无权执行此操作' } }) }));
  await page.locator('[data-ai-source-preview]').click();
  await page.waitForFunction(() => window.permissionNotices === 1);
  assert.deepEqual(errors, []);
});

test('嵌入工作台：目录与命令栏保留、正文编辑、候选采用和窄屏无溢出', async t => {
  const { api, page, errors } = await launch(t, { generate: async () => ({ content: '确认部署环境并准备安装文件。', model: 'deterministic-e2e' }) });
  await page.evaluate(() => {
    const root = document.querySelector('#view-root');
    const bar = document.createElement('header'); bar.id = 'fixture-commandbar'; bar.textContent = '知识资产 / 安装手册';
    root.prepend(bar);
    const surface = document.createElement('section'); surface.className = 'handbook-production-writing';
    document.querySelector('[data-handbook-vditor]').before(surface);
    surface.append(document.querySelector('[data-handbook-vditor]'));
    window.openWriting({ embedded: true, loadEditor: async () => window.Vditor, initialRange: { start: 0, end: window.editor.getValue().length } });
  });
  await page.locator('.handbook-writing-page.is-embedded').waitFor();
  assert.equal(await page.locator('#fixture-commandbar').isVisible(), true);
  assert.equal(await page.locator('.handbook-writing-page').evaluate(el => el.parentElement.className), 'handbook-production-writing has-writing-assistant');
  await page.locator('[data-ai-rich-editor] .vditor-wysiwyg [contenteditable="true"]').waitFor();
  const columns = await page.locator('.handbook-writing-layout').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  assert.equal(columns, 2);
  await page.locator('[data-ai-requirements]').fill('完善部署要求');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: path.join(artifacts, 'embedded-mobile.png') });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.match(await page.locator('[data-ai-fragment]').inputValue(), /部署环境/);
  await page.locator('[data-ai-adopt]').click();
  await page.waitForFunction(() => !!window.saved);
  const reread = await api.request('GET', `${suffix}/draft?${new URLSearchParams(ctx)}`);
  assert.equal(reread.status, 200); assert.match(reread.body.data.draft.revision.markdown, /部署环境并准备/);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: path.join(artifacts, 'embedded-mobile.png') });
  assert.equal(await page.locator('.handbook-writing-page').count(), 0);
  assert.equal(await page.locator('[data-handbook-vditor]').isVisible(), true);
  assert.deepEqual(errors, []);
});

test('本地参考文档：拖拽上传、折叠、拖动优先级、键盘调整与生成真实传递', async t => {
  let captured;
  const mcp = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const message = JSON.parse(raw);
    if (message.method === 'notifications/initialized') { res.writeHead(202); res.end(); return; }
    const result = message.method !== 'tools/call' ? { serverInfo: { name: 'test', version: '1' }, capabilities: {} }
      : message.params.name === 'search_ku' ? { structuredContent: { results: [{ ku_name: 'select-reference', score: .95 }] } }
      : { structuredContent: { title: 'SELECT知识库原文', content: '# SELECT\n\n知识库中的语法依据。' } };
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
  });
  await new Promise(resolve => mcp.listen(0, '127.0.0.1', resolve));
  t.after(() => { mcp.closeAllConnections(); mcp.close(); });
  const { api, page, errors } = await launch(t, {
    loadMCPConfig: async () => ({ services: [{ id: 'official-service', name: '知识库', enabled: true, server_url: `http://127.0.0.1:${mcp.address().port}`, knowledgeBases: [{ id: 'official', name: '官方文档', locator: '1' }] }] }),
    generate: async messages => { captured = JSON.parse(messages.at(-1).content); return { content: '依据优先级修订后的 SELECT 正文。', model: 'deterministic-e2e' }; },
  });
  await page.evaluate(() => {
    const surface = document.createElement('section'); surface.className = 'handbook-production-writing';
    document.querySelector('[data-handbook-vditor]').before(surface); surface.append(document.querySelector('[data-handbook-vditor]'));
    window.openWriting({ embedded: true, loadEditor: async () => window.Vditor, initialRange: { start: 0, end: window.editor.getValue().length } });
  });
  assert.equal(await page.locator('.handbook-writing-configuration-heading strong').isVisible(), true);
  await page.locator('[data-ai-settings-open]').click();
  assert.equal(await page.locator('[data-ai-settings-panel] [data-ai-source-entry]').count(), 0);
  await finishConfiguration(page);
  await openReferences(page);
  assert.equal(await page.locator('[data-reference-type]').count(), 6);
  await page.locator('[data-reference-type="local-document"]').click();
  assert.equal(await page.locator('[data-reference-type="local-document"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-reference-type="url"]').getAttribute('aria-pressed'), 'false');
  await page.screenshot({ path: path.join(artifacts, 'reference-local-upload.png') });
  for (let index = 1; index <= 4; index++) {
    const payload = { name: `参考${index}.md`, mimeType: 'text/markdown', buffer: Buffer.from(`# SELECT依据${index}\n\n引用事实${index}。`) };
    if (index === 1) {
      const data = await page.evaluateHandle(({ name, content }) => {
        const transfer = new DataTransfer(); transfer.items.add(new File([content], name, { type: 'text/markdown' })); return transfer;
      }, { name: payload.name, content: payload.buffer.toString() });
      await page.locator('[data-ai-source-upload]').dispatchEvent('drop', { dataTransfer: data });
      await data.dispose();
    } else await page.locator('[data-ai-source-file]').setInputFiles(payload);
    await page.waitForFunction(count => document.querySelectorAll('[data-ai-source-list] section').length === count && !document.querySelector('[data-ai-source-file]').disabled, index + 1);
  }
  await closeReferences(page);
  assert.equal(await page.locator('[data-ai-source-list] section:visible').count(), 3);
  assert.equal(await page.locator('[data-ai-references-toggle]').getAttribute('aria-expanded'), 'false');
  await page.locator('[data-ai-references-toggle]').click();
  assert.equal(await page.locator('[data-ai-source-list] section:visible').count(), 5);
  const rows = page.locator('[data-ai-source-list] section');
  await rows.nth(1).locator('[draggable]').dragTo(rows.nth(0), { targetPosition: { x: 20, y: 5 } });
  assert.match(await rows.first().textContent(), /参考1.md/);
  await page.getByRole('button', { name: '下移资料：知识库（MCP）' }).click();
  assert.deepEqual(await rows.locator('label').allTextContents(), ['⋮⋮参考1.md','⋮⋮参考2.md','⋮⋮知识库（MCP）','⋮⋮参考3.md','⋮⋮参考4.md']);
  await page.getByRole('button', { name: '上移资料：参考4.md' }).focus();
  await page.keyboard.press('Enter');
  assert.match(await rows.nth(3).textContent(), /参考4.md/);
  await page.locator('[data-ai-requirements]').fill('SELECT SQL，根据参考文档补充准确事实。');
  await page.screenshot({ path: path.join(artifacts, 'reference-priority-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await openReferences(page);
  await page.screenshot({ path: path.join(artifacts, 'reference-local-upload-mobile.png') });
  assert.equal(await page.locator('[data-ai-reference-panel] .handbook-ai-settings-dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  await page.keyboard.press('Escape');
  await page.locator('[data-ai-references-toggle]').click();
  assert.equal(await page.locator('[data-ai-source-list] section:visible').count(), 3);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.locator('[data-ai-start]').click(); await waitCandidate(page);
  assert.deepEqual(captured.sources.map(source => source.title), ['参考1.md','参考2.md','SELECT知识库原文','参考4.md','参考3.md']);
  assert.deepEqual(captured.sources.map(source => source.priority), [1,2,3,4,5]);
  assert.match(captured.sources[0].content, /引用事实1/);
  assert.deepEqual(errors, []);
});
