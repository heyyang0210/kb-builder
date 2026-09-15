// Run: NODE_PATH=runtime/agent-runner/node_modules node tests/e2e/agent-runner/template-workspace.cjs
// Uses real application JS and template HTTP handler; auth/aggregate are isolated doubles unless an external URL is supplied.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createTemplateStore } = require('../../../packages/agent-runner-core/lib/template-store');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const root = path.resolve(__dirname, '../../..');
const web = path.join(root, 'apps/knowledge-center-web/frontend/knowledge-center');
const session = actions => ({ authenticated: true, user: { id: 'p2-browser', displayName: 'P2 测试' }, allowedActions: actions, visibleModules: ['templates'], roles: [] });
const edit = ['template:read', 'template:edit', 'template:manage'];
const json = (res, data) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(data)); };
async function fixture() {
  let state = { schemaVersion: 1, templates: [], audits: [] };
  const templateStore = createTemplateStore({ store: { read: () => structuredClone(state), transaction(fn) { const next = structuredClone(state); const result = fn(next); state = next; return structuredClone(result); } } });
  templateStore.create({ id: 'browser-initial', name: '初始测试模板', type: '数据库', description: '浏览器验证', content: '# 初始正文\n\n测试段落' }, { user: { id: 'seed' } });
  const auth = http.createServer((req, res) => json(res, { content: session((req.headers.cookie || '').includes('read-only') ? ['template:read'] : edit) }));
  await new Promise(resolve => auth.listen(0, '127.0.0.1', resolve));
  const handler = createKnowledgeCenterHandler({ config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: web, KNOWLEDGE_CENTER_ENTRY: 'knowledge-center-management.html', AUTH_API_HOST: '127.0.0.1', AUTH_API_PORT: auth.address().port, PLATFORM_CONTEXT_TIMEOUT_MS: 1000 }, stores: { templateStore, knowledgeAssetsStore: { read: () => ({ handbooks: [] }) } }, sendFile() {}, proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {} });
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/knowledge-center/api/templates')) return handler(req, res);
    if (pathname === '/knowledge-center/api/auth/session') return json(res, { content: session((req.headers.cookie || '').includes('read-only') ? ['template:read'] : edit) });
    if (pathname.startsWith('/knowledge-center/api/')) return json(res, { content: {}, context: {}, status: 'ok' });
    const relative = pathname.replace(/^\/knowledge-center\/?/, '');
    const file = path.resolve(web, path.extname(relative) ? relative : 'knowledge-center-management.html');
    if (!file.startsWith(web + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.setHeader('content-type', ({ '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream'));
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => auth.close(resolve))]) };
}

(async () => {
  const local = process.env.TEMPLATE_TEST_BASE_URL ? null : await fixture();
  const url = process.env.TEMPLATE_TEST_BASE_URL || local.url;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  if (process.env.TEMPLATE_TEST_DEBUG) { page.on('console', message => console.log('browser:', message.type(), message.text())); page.on('response', response => { if (response.status() >= 400) console.log('http:', response.status(), response.url()); }); }
  page.on('dialog', dialog => dialog.accept());
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const unique = `P2浏览器-${Date.now()}`;
  try {
    if (process.env.TEMPLATE_TEST_LOGIN_PASSWORD) await context.request.post(`${url}/knowledge-center/api/auth/admin/login`, { data: { username: process.env.TEMPLATE_TEST_LOGIN_USERNAME || 'admin', password: process.env.TEMPLATE_TEST_LOGIN_PASSWORD } });
    await page.goto(`${url}/knowledge-center/templates`);
    await page.locator('[data-template-new]').waitFor();
    await page.locator('[data-template-new]').click();
    await page.locator('[data-template-field="name"]').fill(unique);
    await page.locator('[data-template-field="type"]').fill('测试类型');
    await page.locator('[data-template-field="description"]').fill('隔离浏览器测试');
    await page.locator('[data-template-mode="edit"]').click();
    await page.locator('[data-template-content]').fill('# 浏览器初始正文\n\n|项目|说明|\n|---|---|\n|SQL|示例|');
    await page.locator('[data-template-mode="preview"]').click();
    assert.equal(await page.locator('.template-preview table').count(), 1);
    await page.locator('[data-template-save]').click();
    await page.locator('[data-template-status]').filter({ hasText: '保存成功' }).waitFor();
    const id = await page.locator('.template-list-item.active').getAttribute('data-template-id');
    assert.equal(await page.locator('.template-history').count(), 0);
    await page.locator('[data-template-mode="edit"]').click();
    await page.locator('[data-template-content]').fill('# 第二版本正文');
    await page.locator('[data-template-save]').click();
    await page.locator('[data-template-status]').filter({ hasText: '当前版本 v2' }).waitFor();
    await page.locator('[data-template-history]').click();
    await page.locator('[data-template-version="1"]').click();
    await page.locator('.template-history-banner').filter({ hasText: 'v1' }).waitFor();
    assert.match(await page.locator('.template-preview').innerText(), /初始正文/);
    assert.equal(await page.locator('[data-template-content]').count(), 0);
    await page.locator('[data-template-restore="1"]').click();
    await page.locator('[data-template-status]').filter({ hasText: '历史内容已载入草稿' }).waitFor();
    await page.locator('[data-template-save]').click();
    await page.locator('[data-template-status]').filter({ hasText: '当前版本 v3' }).waitFor();
    await page.reload();
    await page.locator(`[data-template-id="${id}"]`).click();
    assert.match(await page.locator('.template-preview').innerText(), /初始正文/);
    // A concurrent writer produces 409; the editor must retain its draft.
    await page.locator('[data-template-mode="edit"]').click();
    await page.locator('[data-template-content]').fill('# 冲突仍保留的草稿');
    const concurrent = await context.request.post(`${url}/knowledge-center/api/templates/${id}/save`, { data: { baseVersion: 3, content: '# 其他窗口内容' } }); assert.equal(concurrent.status(), 200);
    await page.locator('[data-template-save]').click();
    await page.locator('[data-template-status]').filter({ hasText: '其他用户更新' }).waitFor();
    assert.equal(await page.locator('[data-template-content]').inputValue(), '# 冲突仍保留的草稿');
    const templateDir = path.join(root, 'knowledge/templates');
    const uploadFiles = ['01-通用基础模板.md', '07-兼容性差异类模板.md'].map(name => ({ name, mimeType: 'text/markdown', buffer: fs.readFileSync(path.join(templateDir, name)) }));
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-template-dropzone]').click();
    await (await chooser).setFiles(uploadFiles);
    await page.locator('[data-template-status]').filter({ hasText: '模板上传成功：已保存 2 个 Markdown 模板' }).waitFor();
    assert.equal(await page.locator('.template-list-item').count(), 4);
    const importedId = await page.locator('.template-list-item.active').getAttribute('data-template-id');
    const stored = await context.request.get(`${url}/knowledge-center/api/templates/${importedId}`);
    assert.equal((await stored.json()).data.current.content, uploadFiles[0].buffer.toString('utf8'));
    await page.reload();
    await page.locator(`[data-template-id="${importedId}"]`).click();
    await page.waitForFunction(id => document.querySelector('.template-list-item.active')?.dataset.templateId === id, importedId);
    assert.match(await page.locator('.template-preview').innerText(), /通用/);
    // 中文输入法回归：组词期间输入框节点和焦点必须保持，提交中文后再筛选。
    const ime = page.locator('[data-template-search]');
    const unfilteredCount = await page.locator('.template-list-item').count();
    const beforeIme = await ime.evaluate((el) => {
      window.__imeSearchNode = el;
      el.focus();
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      for (const text of ['t', 'tong', 'tongyong']) {
        el.value = text;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, isComposing: true }));
      }
      return { same: window.__imeSearchNode === document.querySelector('[data-template-search]'), focused: document.activeElement === el };
    });
    assert.deepEqual(beforeIme, { same: true, focused: true });
    assert.equal(await page.locator('.template-list-item').count(), unfilteredCount);
    await ime.evaluate((el) => {
      el.value = '通用';
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '通用' }));
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: '通用' }));
    });
    assert.equal(await ime.inputValue(), '通用');
    assert.deepEqual(await page.locator('.template-list-item strong').allTextContents(), ['01-通用基础模板']);
    assert.equal(await ime.evaluate(el => el === window.__imeSearchNode && document.activeElement === el), true);
    await ime.fill('');
    assert.equal(await page.locator('.template-list-item').count(), unfilteredCount);
    // 非 IME 的整段输入（粘贴等）与中英文混合查询仍能即时筛选。
    await ime.evaluate(el => {
      el.value = '兼容性差异';
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: el.value }));
    });
    assert.deepEqual(await page.locator('.template-list-item strong').allTextContents(), ['07-兼容性差异类模板']);
    await page.locator('[data-template-search]').fill(unique);
    assert.equal(await page.locator('.template-list-item').count(), 1);
    await page.locator(`[data-template-id="${id}"]`).click();
    for (const width of [1440, 768, 375]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
      await page.locator('[data-template-history]').click();
      assert.ok(await page.locator('.template-history').isVisible());
      if (width <= 900) assert.ok((await page.locator('.template-history').boundingBox()).width <= 320);
      await page.screenshot({ path: `/tmp/template-workspace-${width}.png`, fullPage: true });
      await page.keyboard.press('Escape'); assert.equal(await page.locator('.template-history').count(), 0);
    }
    if (local) {
      const readonly = await browser.newContext(); await readonly.addCookies([{ name: 'role', value: 'read-only', url }]);
      const reader = await readonly.newPage(); await reader.goto(`${url}/knowledge-center/templates`); await reader.locator('.template-list-item').first().waitFor();
      assert.equal(await reader.locator('[data-template-save],[data-template-upload],[data-template-mode="edit"]').count(), 0); await readonly.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: create/preview/save/history/restore/refresh/conflict draft/upload/search/narrow drawer/keyboard/read-only. Screenshots: /tmp/template-workspace-{1440,768,375}.png');
    console.log(`Boundary: ${local ? 'production handler and frontend; isolated auth and in-memory aggregate' : 'external HTTP backend; external credentials/configuration'}`);
  } finally { await browser.close(); if (local) await local.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
