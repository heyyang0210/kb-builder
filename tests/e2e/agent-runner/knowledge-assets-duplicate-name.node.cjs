const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const messages = require('../../../config/knowledge-center/content-rules.json').handbookValidation;
const outlineRules = require('../../../config/knowledge-center/content-rules.json').outlineTemplate;

// Focused browser integration: real views, API client, submit handlers and BFF;
// authentication and persistence are isolated fixtures, never production services.
test('新建与改名弹框：真实 HTTP 重名提示、保留输入、恢复按钮', async () => {
  const previousMode = process.env.KNOWLEDGE_STORAGE_MODE;
  process.env.KNOWLEDGE_STORAGE_MODE = 'database';
  const frontend = path.resolve('apps/knowledge-center-web/frontend/knowledge-center');
  const app = fs.readFileSync(path.join(frontend, 'app.js'), 'utf8');
  function slice(start, end) {
    const from = app.indexOf(start), to = app.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `submit handler boundary: ${start}`);
    return app.slice(from, to);
  }
  const submitSource = [
    slice("  const createForm = event.target.closest('[data-asset-create-form]');", '  const assetArchiveForm ='),
    slice("  const assetForm = event.target.closest('[data-asset-edit-form]');", "  const form = event.target.closest('[data-outline-import]');"),
  ].join('\n');
  const principalSource = slice('function principalFromSelect(select)', 'async function loadAssetCatalog()');
  const owner = { principalId: 1, userId: 1, id: 1, displayName: '测试负责人' };
  const current = {
    handbookId: 'DB-001', name: '当前手册', productId: 1, productName: 'DB',
    ownerA: owner, ownerB: null, assetVersion: 1, status: 'asset_created',
  };
  const payload = { handbooks: [current,
    { ...current, handbookId: 'DB-002', name: '在用手册' },
    { ...current, handbookId: 'DB-041', name: '已停用手册', archivedAt: '2026-09-22' },
  ], audits: [] };
  let writes = 0, requests = 0, browser;
  const handler = createKnowledgeCenterHandler({
    documentTasksOptions: {
      store: {
        readAsync: async () => { throw new Error('本测试不应读取文档任务'); },
        write: () => { throw new Error('本测试不应写入文档任务'); },
      },
    },
    config: {
      KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: frontend,
      KNOWLEDGE_CENTER_ENTRY: 'index.html', OUTLINE_TEMPLATE_PATH: path.resolve(outlineRules.templatePath),
      OUTLINE_SAMPLE_PATH: path.resolve(outlineRules.sampleDownloadPath), GITLAB_CONFIG_PATH: __filename,
      GITLAB_DOCUMENT_TYPES_PATH: __filename,
    },
    stores: {
      knowledgeAssetsStore: { read: () => structuredClone(payload), write: () => { writes++; } },
      manualStatusStore: { read: () => ({ statuses: {}, audits: [] }), write: () => { writes++; } },
      brandIconStore: {}, templateStore: {}, domainStore: { readTechDomains: () => ({ techDomains: [] }) },
    },
    moduleRegistry: { get: () => ({ authorize: async () => ({
      user: { id: 'fixture-admin' }, roles: ['PLATFORM_ADMIN'], allowedActions: ['platform:manage', 'knowledge:read'],
    }) }) },
    sendFile(_file, res) { res.writeHead(404); res.end(); },
    proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
    databaseConnectionGovernance: {}, modelGovernance: {}, mcpGovernance: {}, handbookProductionService: {},
    templateMappingService: {}, agentGovernance: {}, codexRunner: {},
  });
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/knowledge-center/api/')) { requests++; handler(req, res); return; }
    if (pathname === '/fixture') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><meta charset="utf-8"><div id="root"></div>');
      return;
    }
    const file = path.resolve(frontend, `.${pathname}`);
    if (!file.startsWith(frontend + path.sep) || !file.endsWith('.js') || !fs.existsSync(file)) {
      res.writeHead(404); res.end(); return;
    }
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.end(fs.readFileSync(file));
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({
      headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    });
    const page = await browser.newPage();
    page.on('pageerror', error => console.error('浏览器测试页面错误:', error.message));
    for (const mode of ['create', 'edit']) {
      for (const [name, message] of [
        ['在用手册', messages.duplicateName],
        ['已停用手册', messages.duplicateInactiveName],
      ]) {
        await page.goto(`${base}/fixture?handbookId=DB-001`);
        await page.addScriptTag({ type: 'module', content: `
          import { renderAssets } from '/modules/assets/view.js';
          import { createAsset, updateAsset, updateAssetStatus } from '/common/api/platform-api.js';
          const appState = { assetCatalog: { items: [${JSON.stringify(current)}] } };
          document.getElementById('root').innerHTML = renderAssets({
            assetCatalog: { items: appState.assetCatalog.items, products: [{ id: 1, name: 'DB' }] },
            principalProjection: { items: [${JSON.stringify(owner)}] }, platformAdmin: true
          });
          ${principalSource}
          async function loadAssetCatalog() { throw new Error('Unexpected success'); }
          document.addEventListener('submit', async event => { ${submitSource} });
          document.querySelector('[data-asset-${mode === 'create' ? 'create' : 'edit'}-dialog]').showModal();
        ` });
        const dialog = page.locator(`[data-asset-${mode === 'create' ? 'create' : 'edit'}-dialog]`);
        await dialog.waitFor({ state: 'visible' });
        await dialog.locator('input[name="name"]').fill(name);
        if (mode === 'create') {
          await dialog.locator('select[name="productId"]').selectOption('1');
          await dialog.locator('select[name="ownerA"]').selectOption('1');
        }
        await dialog.locator('button[type="submit"]').click();
        await page.waitForFunction(expected =>
          document.querySelector('dialog[open] [data-asset-form-status]').textContent === expected, message);
        assert.equal(await dialog.evaluate(element => element.open), true);
        assert.equal(await dialog.locator('input[name="name"]').inputValue(), name);
        assert.equal(await dialog.locator('select[name="ownerA"]').inputValue(), '1');
        assert.equal(await dialog.locator('button[type="submit"]').isEnabled(), true);
      }
    }
    assert.equal(requests, 4);
    assert.equal(writes, 0);
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    if (previousMode === undefined) delete process.env.KNOWLEDGE_STORAGE_MODE;
    else process.env.KNOWLEDGE_STORAGE_MODE = previousMode;
  }
});
