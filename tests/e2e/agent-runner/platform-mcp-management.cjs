// Isolated browser + real platform HTTP handler + real ConfigManager/MCPClient.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '../../../runtime/agent-runner/node_modules/playwright');
const repo = path.resolve(__dirname, '../../..');
const output = path.join(repo, 'runtime/test-results/platform-mcp');
fs.mkdirSync(output, { recursive: true });
const root = fs.mkdtempSync(path.join(repo, 'runtime/platform-mcp-browser-'));
const configFile = path.join(root, 'service.json');
fs.writeFileSync(configFile, JSON.stringify({ mcp: {}, model: { untouched: true } }));
const registry = require('../../../packages/agent-runner-core/lib/config-registry');
require.cache[require.resolve('../../../packages/agent-runner-core/lib/config-registry')].exports = { ...registry, CONFIG_PATHS: { ...registry.CONFIG_PATHS, service: configFile } };
const manager = require('../../../packages/agent-runner-core/lib/config-manager');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const { createMcpGovernance } = require('../../../packages/agent-runner-core/lib/platform-management/mcp-governance');
const governance = createMcpGovernance({ configManager: manager });
const frontend = path.join(repo, 'apps/knowledge-center-web/frontend/knowledge-center');
const checks = [];
const methods = [];
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); });
let mode = 'ok';
const searchedKnowledgeBases = [];
const upstream = http.createServer(async (req, res) => {
  let text = ''; for await (const chunk of req) text += chunk;
  const message = JSON.parse(text); methods.push(message.method);
  const knowledgeBaseId = req.headers['x-ksacraft-kb-id'];
  if (knowledgeBaseId) searchedKnowledgeBases.push(knowledgeBaseId);
  if (message.method === 'notifications/initialized') { res.writeHead(202); res.end(); return; }
  if (mode === 'fail') { res.writeHead(401); res.end('fixture-secret-must-not-leak'); return; }
  const result = message.method === 'initialize' ? { serverInfo: { name: '浏览器测试 MCP', version: '1.0' }, capabilities: { tools: {} }, protocolVersion: '2024-11-05' } : message.method === 'tools/call' && message.params?.name === 'get_ku_detail' ? { content: [{ type: 'text', text: '# SQL参考手册\nSELECT 语法参考。' }] } : message.method === 'tools/call' ? {
    structuredContent: { results: [{ ku_name: `doc-${knowledgeBaseId}`, score: knowledgeBaseId === '1' ? 0.7 : 0.9 }, { ku_name: 'shared-doc', score: knowledgeBaseId === '1' ? 0.8 : 0.4 }], total: 2 }, content: [{ type: 'text', text: '搜索结果' }]
  } : { tools: [{ name: 'search_ku', description: '<img src=x onerror="window.injected=true">' }, { name: 'get_ku_detail', description: '读取文档' }] };
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
});
const handler = createKnowledgeCenterHandler({
  config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: frontend, KNOWLEDGE_CENTER_ENTRY: 'index.html',
    OUTLINE_TEMPLATE_PATH: path.join(repo, 'knowledge/outlines/大纲模板.xlsx'), OUTLINE_SAMPLE_PATH: path.join(repo, 'knowledge/outlines/基本数据库管理手册大纲示例.xlsx'),
    PINGCODE_PREFIX: '/pingcode', PINGCODE_ROOT: repo, DOCUMENT_API_HOST: '127.0.0.1', DOCUMENT_API_PORT: 1, PINGCODE_API_HOST: '127.0.0.1', PINGCODE_API_PORT: 1, AUTH_API_HOST: '127.0.0.1', AUTH_API_PORT: 1,
    GITLAB_CONFIG_PATH: '/tmp/not-used', GITLAB_DOCUMENT_TYPES_PATH: '/tmp/not-used', DATABASE_CONNECTION_CONFIG_PATH: '/tmp/not-used' },
  stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [] }), write() {} } },
  moduleRegistry: { get: key => key === 'auth' ? { authorize: async () => ({ roles: ['PLATFORM_ADMIN'], user: { id: 'browser-admin' } }) } : null },
  mcpGovernance: governance,
  sendFile(file, res) { res.writeHead(200, { 'Content-Type': file.endsWith('.css') ? 'text/css' : 'text/javascript' }); res.end(fs.readFileSync(file)); },
  proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
});
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/knowledge-center/api/')) return handler(req, res);
  if (req.url === '/' || req.url.startsWith('/knowledge-center/platform')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/knowledge-center/modules/platform-admin/platform-admin.css"><style>body{font:14px sans-serif;margin:16px}.button{padding:10px 16px}button:disabled{opacity:.6}</style></head><body><main id="view"></main><script type="module">import {renderPlatformAdmin} from '/knowledge-center/modules/platform-admin/view.js';import {mountMcpAdmin,confirmLeavingMcp} from '/knowledge-center/modules/platform-admin/mcp-admin.js';import {pathForView,platformTabFromSearch} from '/knowledge-center/common/state/navigation.js';document.querySelector('#view').innerHTML=renderPlatformAdmin({platformTab:platformTabFromSearch('?tab=mcp'),platformAdmin:true});mountMcpAdmin(document.querySelector('[data-mcp-admin]'));window.confirmLeavingMcp=confirmLeavingMcp;window.mcpPath=pathForView('platform',{tab:'mcp'});</script></body></html>`); return;
  }
  const file = path.resolve(frontend, '.' + new URL(req.url, 'http://localhost').pathname.replace('/knowledge-center', ''));
  if (!file.startsWith(frontend + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': file.endsWith('.css') ? 'text/css' : 'text/javascript' }); res.end(fs.readFileSync(file));
});
(async () => {
  let browser;
  try {
    await listen(upstream); await listen(server);
    const url = `http://127.0.0.1:${upstream.address().port}/mcp`;
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/knowledge-center/platform?tab=mcp`);
    await page.locator('[data-mcp-add]').waitFor();
    const rows = page.locator('[data-mcp-service]');
    async function addService(name, kb, locator) {
      await page.locator('[data-mcp-add]').click();
      const row = rows.last();
      await row.locator('[name=name]').fill(name);
      await row.locator('[name=server_url]').fill(url);
      await row.locator('[name=api_key]').fill('fixture-secret-must-not-leak');
      await row.locator('[data-kb-add]').click();
      await row.locator('[name=kb_name]').fill(kb);
      await row.locator('[name=kb_locator]').fill(locator);
      const saved = page.waitForResponse(r => r.url().endsWith('/services/save') && r.request().method() === 'POST');
      await row.locator('button[type=submit]').click();
      assert.equal((await saved).status(), 200);
      await page.waitForFunction(() => document.querySelector('[data-mcp-admin]').dataset.dirty === 'false');
      assert.equal(await rows.last().locator('.mcp-service-editor').evaluate(n => n.open), false);
    }
    await addService('官方文档服务', '官方知识库', '1');
    await addService('运维文档服务', '运维知识库', '24');
    assert.equal(await rows.count(), 2); checks.push('新增两个服务，独立保存后默认折叠');
    assert(!fs.readFileSync(configFile, 'utf8').includes('fixture-secret-must-not-leak')); checks.push('服务凭据加密保存与脱敏回读');
    await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
    const first = rows.first(); const second = rows.last();
    assert.equal(await page.locator('[name=adapter],[name=enabled],[name=makeDefault]').count(), 0);
    assert.equal(await first.locator('button[type=submit]').textContent(), '保存配置');
    assert.equal(await page.locator('[data-mcp-collapse]').textContent(), '全部展开');
    await page.locator('[data-mcp-collapse]').click();
    assert.equal(await page.locator('.mcp-service-editor[open]').count(), 2);
    assert.equal(await page.locator('[data-mcp-collapse]').textContent(), '全部收起');
    await page.locator('[data-mcp-collapse]').click();
    assert.equal(await page.locator('.mcp-service-editor[open]').count(), 0);
    assert.equal(await first.locator('[data-kb-verify]').textContent(), '测试');
    await first.locator('[data-service-test]').click();
    await page.waitForFunction(() => document.querySelector('[data-row-result]')?.textContent.includes('测试成功'));
    assert.equal(await first.locator('.mcp-service-editor').evaluate(n => n.open), false);
    assert.equal(await first.locator('[data-row-result] img').count(), 0);
    assert.equal(await page.evaluate(() => Boolean(window.injected)), false); checks.push('折叠行真实连接测试、绿色结果与工具描述转义');
    await first.locator('.mcp-service-summary').click();
    assert.equal(await first.locator('[data-connection-settings]').isVisible(), false);
    assert.equal(await first.locator('[data-kb-row]').count(), 1);
    const dialogs = []; const rejectDialog = dialog => { dialogs.push(dialog.type()); dialog.dismiss(); };
    page.on('dialog', rejectDialog);
    await first.locator('[data-kb-verify]').click();
    await page.waitForFunction(() => document.querySelector('[data-kb-status]')?.textContent === '测试成功');
    page.off('dialog', rejectDialog); assert.deepEqual(dialogs, []);
    assert.match(await first.locator('[data-row-result]').textContent(), /ID 1.*毫秒.*search_ku.*本次匹配 2 条/);
    assert.equal(searchedKnowledgeBases.at(-1), '1'); checks.push('展开仅显示知识库表，逐库真实读取验证路由');
    await first.locator('[data-service-settings]').first().click();
    assert.equal(await first.locator('[data-service-savebar]').isVisible(), true, '打开设置即可看到保存和取消');
    await first.locator('[name=name]').fill('官方文档服务修改');
    await second.locator('[data-service-settings]').first().click();
    await second.locator('[name=name]').fill('运维服务未保存草稿');
    const saved = page.waitForResponse(r => r.url().endsWith('/services/save') && r.request().method() === 'POST');
    await first.locator('button[type=submit]').click(); assert.equal((await saved).status(), 200);
    assert.equal(await second.locator('[name=name]').inputValue(), '运维服务未保存草稿');
    assert.equal((await governance.get()).services[1].name, '运维文档服务'); checks.push('保存一个服务保留另一服务未保存草稿及已存配置');
    await second.locator('[data-service-cancel]').click();
    await second.locator('[data-service-test]').click();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-service-test-status]')].some(n => n.textContent === '测试成功'));
    mode = 'fail';
    await second.locator('[data-service-test]').click();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-service-test-status]')].some(n => n.textContent === '测试失败'));
    assert(!(await second.locator('[data-row-result]').textContent()).includes('fixture-secret')); checks.push('连接失败红色结果，错误脱敏'); mode = 'ok';
    await page.locator('[data-mcp-search]').fill('运维知识库'); assert.equal(await page.locator('[data-mcp-service]:visible').count(), 1);
    await page.locator('[data-mcp-search]').fill(''); checks.push('按服务及知识库搜索');
    await page.locator('[data-mcp-collapse]').click();
    await page.reload(); await page.locator('[data-mcp-service]').first().waitFor();
    assert.equal(await page.locator('.mcp-service-editor[open]').count(), 0); checks.push('整页重载默认折叠');
    await rows.first().locator('.mcp-service-summary').click();
    await page.screenshot({ path: path.join(output, 'expanded.png'), fullPage: true });
    await rows.first().locator('[data-service-settings]').first().click();
    await page.screenshot({ path: path.join(output, 'settings.png'), fullPage: true });
    await page.setViewportSize({ width: 360, height: 800 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); checks.push('360px窄屏无横向溢出');
    await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
    assert.equal(errors.length, 0, errors.join('\n'));
    fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ status: 'passed', checkedAt: new Date().toISOString(), checks, pageErrors: errors, protocolMethods: methods, scope: '隔离配置、真实平台HTTP路由、真实MCP协议fixture；不代表企业服务验收' }, null, 2));
    console.log(JSON.stringify({ status: 'passed', checks }));
  } finally { await browser?.close(); await close(server); await close(upstream); manager.watcher?.close(); fs.rmSync(root, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
