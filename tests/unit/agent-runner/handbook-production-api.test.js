const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const { createHandbookProductionService } = require('../../../packages/agent-runner-core/lib/handbook-production-service');

const repositoryRoot = path.resolve(__dirname, '../../..');
const editor = {
  authenticated: true,
  user: { id: 'author-1', displayName: '文档作者', roles: ['KNOWLEDGE_EDITOR'] },
  allowedActions: ['knowledge:read', 'knowledge:write'],
};

function memoryStore() {
  let state = { schemaVersion: 1, drafts: {}, attachments: {}, reviewBatches: [], idempotency: {}, audits: [] };
  return {
    read: () => structuredClone(state),
    transaction(mutator) {
      const next = structuredClone(state);
      const result = mutator(next);
      state = next;
      return structuredClone(result);
    },
  };
}

async function setup(t, options = {}) {
  // This HTTP fixture uses in-memory drafts and file-mode handbook context.
  // The explicit yashanDB adapter may still call the real isolated test database.
  const previousStorageMode = process.env.KNOWLEDGE_STORAGE_MODE;
  process.env.KNOWLEDGE_STORAGE_MODE = 'file';
  t.after(() => {
    if (previousStorageMode === undefined) delete process.env.KNOWLEDGE_STORAGE_MODE;
    else process.env.KNOWLEDGE_STORAGE_MODE = previousStorageMode;
  });
  const attachmentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'handbook-production-api-'));
  const store = memoryStore();
  // Catalog and execution must resolve the same frozen fixture configuration.
  // Production constructs both with Agent governance; injected services need
  // an explicit shared governance instance to avoid mixing catalog versions.
  const modelGovernance = options.ai?.modelGovernance || require('../../../packages/agent-runner-core/lib/platform-management/model-governance').createModelGovernance({
    configManager: { getModelConfigSync: () => ({ model: 'isolated-fixture-model', api_key: 'isolated-fixture-key', base_url: 'http://127.0.0.1:1' }) },
  });
  const service = createHandbookProductionService({ store, attachmentRoot, yashanDB: options.yashanDB, contentQuality: options.contentQuality, recoveryIntervalMs: options.recoveryIntervalMs, aiStageAdapterEnv: options.aiStageAdapterEnv, ai: { loadMCPConfig: async () => ({}), ...options.ai, modelGovernance } });
  const authModule = {
    authorize: options.authorize || (async () => options.session === undefined ? editor : options.session),
    repository: {
      listUsers: () => [
        { id: 'author-1', displayName: '文档作者', roles: ['KNOWLEDGE_EDITOR'] },
        { id: 'reviewer-1', displayName: '独立审核人', roles: ['REVIEWER'] },
      ],
    },
  };
  const handler = createKnowledgeCenterHandler({
    config: {
      KNOWLEDGE_CENTER_PREFIX: '/knowledge-center',
      KNOWLEDGE_CENTER_ROOT: '/tmp',
      KNOWLEDGE_CENTER_ENTRY: 'index.html',
      OUTLINE_TEMPLATE_PATH: path.join(repositoryRoot, 'knowledge/outlines/大纲模板.xlsx'),
      OUTLINE_SAMPLE_PATH: path.join(repositoryRoot, 'knowledge/outlines/基本数据库管理手册大纲示例.xlsx'),
      PINGCODE_PREFIX: '/pingcode',
      PINGCODE_ROOT: '/tmp',
      DOCUMENT_API_HOST: '127.0.0.1',
      DOCUMENT_API_PORT: 1,
      PINGCODE_API_HOST: '127.0.0.1',
      PINGCODE_API_PORT: 1,
      PLATFORM_CONTEXT_TIMEOUT_MS: 1000,
      AUTH_API_HOST: '127.0.0.1',
      AUTH_API_PORT: 1,
      GITLAB_CONFIG_PATH: options.gitlabConfigPath || '/tmp/not-used',
      GITLAB_DOCUMENT_TYPES_PATH: '/tmp/not-used',
      DATABASE_CONNECTION_CONFIG_PATH: '/tmp/not-used',
    },
    stores: {
      knowledgeAssetsStore: { read: () => ({ handbooks: [{ handbookId: 'HB-1', name: '隔离测试手册' }] }), write() {} },
      manualStatusStore: {},
      brandIconStore: {},
      domainStore: {},
      ...(options.templateStore ? { templateStore: options.templateStore } : {}),
    },
    ...(options.templateMappingService ? { templateMappingService: options.templateMappingService } : {}),
    moduleRegistry: { get: name => name === 'auth' ? authModule : null },
    handbookProductionService: service,
    modelGovernance,
    databaseConnectionGovernance: {},
    sendFile(_filePath, res) { res.writeHead(404); res.end(); },
    proxyAuth() {},
    proxyCleaning() {},
    proxyOutline() {},
    proxyPermission() {},
    handleIncrementalBuild() {},
  });
  const server = http.createServer((req, res) => {
    if (options.browser && req.url === '/browser-fixture') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html lang="zh"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/knowledge-center/common/tokens.css"><link rel="stylesheet" href="/knowledge-center/common/base.css"><link rel="stylesheet" href="/knowledge-center/styles.css"></head><body><h1>AI 候选隔离浏览器验证</h1></body></html>');
      return;
    }
    if (options.browser && req.url.startsWith('/knowledge-center/') && !req.url.startsWith('/knowledge-center/api/')) {
      const target = path.resolve(repositoryRoot, 'apps/knowledge-center-web/frontend', `.${req.url}`);
      const root = path.resolve(repositoryRoot, 'apps/knowledge-center-web/frontend/knowledge-center');
      if (target.startsWith(root + path.sep) && /\.(js|css)$/.test(target) && fs.existsSync(target)) {
        res.writeHead(200, { 'Content-Type': target.endsWith('.js') ? 'text/javascript' : 'text/css' });
        res.end(fs.readFileSync(target)); return;
      }
    }
    return handler(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    service.stopRecoveryScheduler();
    await new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections();
    });
    fs.rmSync(attachmentRoot, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/knowledge-center/api/production`;
  async function request(method, suffix, body, headers = {}) {
    const response = await fetch(`${baseUrl}${suffix}`, {
      method,
      headers: { accept: 'application/json', ...headers },
      body,
    });
    const contentType = response.headers.get('content-type') || '';
    return {
      status: response.status,
      body: contentType.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer()),
    };
  }
  return { request, store, origin: `http://127.0.0.1:${server.address().port}`, setSession(session) { options.session = session; } };
}

function draftPath(suffix = '') {
  return `/handbooks/HB-1/documents/doc-1/draft${suffix}`;
}

test('认证后端短暂失败返回503且后续真实HTTP请求仍可恢复', async t => {
  let unavailable = true;
  const api = await setup(t, { authorize: async () => {
    if (unavailable) throw Object.assign(new Error('认证服务暂时不可用'), { code: 'AUTH_SERVICE_UNAVAILABLE', status: 503 });
    return editor;
  } });
  const failed = await api.request('GET', `${draftPath()}?outlineVersionId=v1&branch=main`);
  assert.equal(failed.status, 503);
  assert.equal(failed.body.error.code, 'AUTH_SERVICE_UNAVAILABLE');
  unavailable = false;
  const recovered = await api.request('GET', `${draftPath()}?outlineVersionId=v1&branch=main`);
  assert.equal(recovered.status, 200);
});

test('网页验证页经真实来源 API 拒绝且不产生可引用快照', async t => {
  const upstream = http.createServer((req, res) => {
    if (req.url === '/article') { res.writeHead(302, { location: '/mp/wappoc_appmsgcaptcha' }); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<html><body>环境异常，完成验证后即可继续访问</body></html>');
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const rules = structuredClone(require('../../../config/knowledge-center/content-rules.json').productionAI);
  rules.sources.lookup = async () => [{ address: '1.1.1.1', family: 4 }];
  rules.sources.receive = (url, _address, signal) => new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port: upstream.address().port, path: url.pathname, signal }, resolve);
    request.on('error', reject);
  });
  const api = await setup(t, { browser: true, ai: { rules } });
  const result = await api.request('POST', '/handbooks/HB-1/documents/doc-1/ai-sources', JSON.stringify({
    outlineVersionId: 'outline-v1', branch: 'main', sourceType: 'url', locator: 'https://mp.weixin.qq.com/article',
  }), { 'content-type': 'application/json' });
  assert.equal(result.status, 422);
  assert.equal(result.body.error.code, 'AI_SOURCE_ACCESS_RESTRICTED');
  assert.deepEqual(api.store.read().aiSources || {}, {});
  const browser = await require('playwright').chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(`${api.origin}/browser-fixture`);
  await page.evaluate(async () => {
    const { openProductionAIDialog } = await import('/knowledge-center/modules/production/production-ai-dialog.js');
    openProductionAIDialog({ context: { handbookId: 'HB-1', documentId: 'doc-1', outlineVersionId: 'outline-v1', branch: 'main' },
      operation: 'update', editVersion: 0, getMarkdown: () => '原文', baselineDigest: async () => '', onAdopt() {} });
  });
  await page.locator('[data-ai-source-add]').click();
  await page.locator('[data-ai-source-locator]').fill('https://mp.weixin.qq.com/article');
  await page.locator('[data-ai-source-preview]').click();
  await page.getByRole('alert').filter({ hasText: '本地文档' }).waitFor();
  assert.equal(await page.locator('[data-ai-source-type] option[value="local-document"]').count(), 1);
  assert.equal(await page.locator('[data-ai-source-upload]').count(), 1);
});

test('来源图片经真实 HTTP 托管，失效图片降级，跨文档访问受限', async t => {
  const { imageReferences } = require('../../../packages/agent-runner-core/lib/source-image-resources');
  assert.deepEqual(imageReferences('`![代码](https://example.com/no.png)` ![真实][ref]\n\n[ref]: https://example.com/yes.png')
    .map(image => image.href), ['https://example.com/yes.png']);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZ0AAAAASUVORK5CYII=', 'base64');
  let imageRequests = 0;
  const upstream = http.createServer((req, res) => {
    if (req.url === '/page') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<main><h1>资料</h1><p>正文</p><img data-src="/image" alt="架构图"><img src="/missing" alt="缺失图"><img src="/fake" alt="伪造图"></main>');
    } else if (req.url === '/image') {
      imageRequests++;
      res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(png);
    } else if (req.url === '/fake') {
      res.writeHead(200, { 'Content-Type': 'image/png' }); res.end('<html>not an image</html>');
    } else if (req.url === '/api/pingcode/spaces/YASDOC/pages/page1/reference?include_images=true') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ spaceKey: 'YASDOC', pageId: 'page1', title: '设计文档', content: '正文 ![设计图](source-image:internal)',
        imageResources: [{ reference: 'source-image:internal', status: 'ready', dataBase64: png.toString('base64') }] }));
    } else { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { upstream.close(resolve); upstream.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${upstream.address().port}`;
  const webOrigin = 'http://public.example';
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'source-image-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const rules = structuredClone(require('../../../config/knowledge-center/content-rules.json').productionAI);
  rules.sources.urlOrigins = [webOrigin];
  rules.sources.allowPublicWeb = false;
  rules.sources.lookup = async () => [{ address: '1.1.1.1', family: 4 }];
  rules.sources.receive = (url, _address, signal) => new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port: upstream.address().port, path: url.pathname, signal }, resolve);
    request.on('error', reject);
  });
  rules.sources.pingcodeSpaces = ['YASDOC'];
  const api = await setup(t, { browser: true, ai: { rules, sourceImageRoot: root, pingcodeBaseURL: origin } });
  const endpoint = '/handbooks/HB-1/documents/doc-1/ai-sources';
  const preview = await api.request('POST', endpoint, JSON.stringify({ outlineVersionId: 'outline-v1', branch: 'main', sourceType: 'url', locator: `${webOrigin}/page` }), { 'content-type': 'application/json' });
  assert.equal(preview.status, 201, JSON.stringify(preview.body));
  const source = preview.body.data;
  assert.match(source.content, /正文/);
  assert.match(source.content, /图片未能读取：缺失图/);
  assert.match(source.content, /图片未能读取：伪造图/);
  const ready = source.imageResources.find(image => image.status === 'ready');
  assert.ok(ready, JSON.stringify(source.imageResources));
  assert.ok(!JSON.stringify(source).includes(`${webOrigin}/image`));
  assert.equal(imageRequests, 1);
  const pingcode = await api.request('POST', endpoint, JSON.stringify({ outlineVersionId: 'outline-v1', branch: 'main', sourceType: 'pingcode-design', locator: 'YASDOC/page1' }), { 'content-type': 'application/json' });
  assert.equal(pingcode.status, 201, JSON.stringify(pingcode.body));
  assert.match(pingcode.body.data.content, /ai-sources\/images\/[a-f0-9]{64}/);
  assert.equal(pingcode.body.data.imageResources[0].status, 'ready');
  assert.ok(!JSON.stringify(pingcode.body).includes('dataBase64'));
  const imageURL = new URL(ready.url, api.origin);
  const image = await fetch(imageURL, { headers: { accept: 'image/png' } });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
  assert.equal((await fetch(new URL(ready.url.replace('/doc-1/', '/other/'), api.origin))).status, 404);
  assert.equal((await fetch(new URL(ready.url.replace('branch=main', 'branch=other'), api.origin))).status, 404);
  api.setSession(null);
  assert.equal((await fetch(imageURL)).status, 401);
  api.setSession(editor);
  api.setSession({ ...editor, user: { ...editor.user, id: 'another-author' } });
  assert.equal((await fetch(imageURL)).status, 404);
  api.setSession(editor);
  assert.equal(imageRequests, 1);
  const browser = await require('playwright').chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${api.origin}/browser-fixture`);
  await page.evaluate(async () => {
    const { openProductionAIDialog } = await import('/knowledge-center/modules/production/production-ai-dialog.js');
    openProductionAIDialog({ context: { handbookId: 'HB-1', documentId: 'doc-1', outlineVersionId: 'outline-v1', branch: 'main' },
      operation: 'update', editVersion: 0, getMarkdown: () => '旧说明', baselineDigest: async () => '', onAdopt() {} });
  });
  await page.locator('[data-ai-source-add]').click();
  await page.locator('[data-ai-source-locator]').fill(`${webOrigin}/page`);
  await page.locator('[data-ai-source-preview]').click();
  await page.locator('[data-ai-source-list] [data-source-id]:not([data-source-id="knowledge-mcp"]) input[type="checkbox"]').waitFor({ state: 'attached' });
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: '预览资料：资料' }).click();
  const popup = await popupPromise;
  await popup.locator('#reading img').waitFor();
  assert.equal(await popup.locator('#reading img').evaluate(image => image.complete && image.naturalWidth > 0), true);
  assert.match(await popup.locator('#reading').innerText(), /图片未能读取：缺失图/);
  assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const reportRoot = path.join(repositoryRoot, 'runtime/test-results/source-images');
  fs.mkdirSync(reportRoot, { recursive: true });
  await popup.screenshot({ path: path.join(reportRoot, 'source-preview-mobile.png'), fullPage: true });
});

function contentReviewResponse() {
  return { parsed: {
    checks: ['structure', 'template', 'expression', 'sources'].map(check => ({ check, status: check === 'expression' ? 'failed' : 'passed', details: '协议测试检查结果' })),
    issues: [{ check: 'expression', severity: 'warning', start: 0, end: 1, message: '<script>待核验</script>', requirement: '请作者核对表达' }],
  }, model: 'isolated-review-model', usage: { total_tokens: 10 } };
}

test('内容检查经真实 HTTP 绑定修订、检查四项并保留无来源局限，错误格式不能降级通过', async t => {
  const cases = [];
  for (const kind of ['valid', 'malformed', 'unavailable']) {
    let calls = 0; let databaseCalls = 0;
    const api = await setup(t, { contentQuality: {
      modelConfig: { provider: 'openai', model: 'isolated-review-model', api_key: 'test-only' },
      generate: async messages => {
        calls++;
        assert.equal(JSON.parse(messages[1].content).document, markdown);
        if (kind === 'unavailable') throw new Error('private provider diagnostic');
        return kind === 'malformed' ? { content: 'not valid JSON' } : contentReviewResponse();
      },
    }, yashanDB: { execute: async () => { databaseCalls++; return { rows: [{ C1: 1 }] }; } } });
    const endpoint = '/handbooks/HB-1/documents/doc-1/quality';
    const ctx = { outlineVersionId: 'outline-v1', branch: 'main' };
    const markdown = '# 检查\n```sql\nSELECT 1 AS C1 FROM DUAL;\n```\n```json quality-expected\n{"rows":[{"C1":1}]}\n```\n';
    let requestIndex = 0;
    const send = (method, path, value) => { const input = json(value, `content-${kind}-${++requestIndex}`); return api.request(method, path, input.body, input.headers); };
    const saved = await send('PUT', draftPath(), { ...ctx, markdown, editVersion: 0 });
    assert.equal(saved.status, 200);
    const revision = saved.body.data.draft.revision;
    const missing = await send('POST', endpoint, { ...ctx, markdown, checkContent: true });
    assert.equal(missing.status, 409);
    const mismatch = await send('POST', endpoint, { ...ctx, markdown: markdown + 'changed', revisionId: revision.revisionId, checkContent: true });
    assert.equal(mismatch.status, 409); assert.equal(calls, 0); assert.equal(databaseCalls, 0);
    const response = await send('POST', endpoint, { ...ctx, markdown, revisionId: revision.revisionId, checkContent: true });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const report = response.body.data;
    assert.equal(calls, 1); assert.equal(databaseCalls, 1);
    assert.equal(report.sqlGate, 'passed'); assert.equal(report.gate, 'not_passed');
    assert.equal(report.contentQuality.revisionId, revision.revisionId);
    assert.equal(report.contentQuality.documentDigest, report.document.contentDigest);
    assert.equal(report.contentQuality.checks.length, 4);
    if (kind === 'valid') {
      assert.equal(report.contentQuality.status, 'completed');
      assert.deepEqual(report.contentQuality.checks.map(item => item.status), ['passed', 'not_executed', 'failed', 'not_executed']);
      assert.equal(report.contentQuality.issues[0].requirement, '请作者核对表达');
    } else {
      assert.equal(report.contentQuality.status, 'not_executed');
      assert.ok(report.contentQuality.checks.every(item => item.status === 'not_executed'));
      assert.equal(report.contentQuality.error.code, kind === 'malformed' ? 'QUALITY_CONTENT_RESPONSE_INVALID' : 'QUALITY_CONTENT_MODEL_FAILED');
    }
    assert.ok(!JSON.stringify(report).includes('private provider diagnostic'));
    const read = await api.request('GET', endpoint + '/' + report.reportId);
    assert.deepEqual(read.body.data, report);
    const draft = await api.request('GET', draftPath() + '?outlineVersionId=outline-v1&branch=main');
    assert.equal(draft.body.data.draft.revision.markdown, markdown);
    assert.equal(draft.body.data.draft.revision.qualityReport.gate, 'not_passed');
    cases.push({ kind, report });
  }
  const evidenceDir = path.join(repositoryRoot, 'runtime/test-results/production-ai-quality/20261022/content-review');
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'http-report.json'), JSON.stringify({ realHTTP: true, realModel: false, realDatabase: false, cases }, null, 2));
});

test('内容检查复用真实 SDK 与隔离 Provider HTTP，JSON 格式参数保持嵌套契约', async t => {
  const requests = [];
  const provider = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    requests.push({ path: req.url, body: JSON.parse(body) });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 'fixture-response', object: 'chat.completion', model: 'isolated-sdk-model',
      choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(contentReviewResponse().parsed) }, finish_reason: 'stop' }], usage: { total_tokens: 10 } }));
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { provider.close(resolve); provider.closeAllConnections(); }));
  const api = await setup(t, { contentQuality: { modelConfig: { provider: 'custom', api_key: 'fixture-only', model: 'isolated-sdk-model', base_url: `http://127.0.0.1:${provider.address().port}/v1` } } });
  const ctx = { outlineVersionId: 'outline-v1', branch: 'main' };
  const markdown = '# SDK 协议验证\n';
  const savedInput = json({ ...ctx, markdown, editVersion: 0 }, 'sdk-draft');
  const saved = await api.request('PUT', draftPath(), savedInput.body, savedInput.headers);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const input = json({ ...ctx, markdown, revisionId: saved.body.data.draft.revision.revisionId, checkContent: true }, 'sdk-quality');
  const response = await api.request('POST', '/handbooks/HB-1/documents/doc-1/quality', input.body, input.headers);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.data.contentQuality.status, 'completed');
  assert.equal(response.body.data.contentQuality.model.model, 'isolated-sdk-model');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, '/v1/chat/completions');
  assert.deepEqual(requests[0].body.response_format, { type: 'json_object' });
  assert.ok(!Object.hasOwn(requests[0].body, 'type'));
  assert.equal(JSON.parse(requests[0].body.messages[1].content).document, markdown);
});

test('已保存草稿质量弹窗经真实 HTTP 展示逐条结果、下载和复测关联', async t => {
  const { chromium } = require('playwright');
  const api = await setup(t, { browser: true, contentQuality: {
    modelConfig: { provider: 'openai', model: 'isolated-review-model', api_key: 'test-only' }, generate: async () => contentReviewResponse(),
  }, yashanDB: {
    version: 'isolated-test-version', environment: 'isolated-test',
    execute: async () => ({ columns: ['C1'], rows: [{ C1: 1 }] }),
  } });
  const block = expected => '```sql\nSELECT 1 AS C1 FROM DUAL;\n```\n```json quality-expected\n' + JSON.stringify(expected) + '\n```\n';
  const input = json({ outlineVersionId: 'outline-v1', branch: 'main', editVersion: 0,
    markdown: '# 用例检查\n' + block({ rows: [{ C1: 1 }] }) + block({ rows: [{ C1: 2 }] }) + block({ rows: 'invalid' }) }, 'quality-ui-save');
  const saved = await api.request('PUT', draftPath(), input.body, input.headers);
  assert.equal(saved.status, 200);
  const revision = saved.body.data.draft.revision;
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await page.goto(`${api.origin}/browser-fixture`);
  await page.evaluate(async revision => {
    const sheet = document.createElement('link'); sheet.rel = 'stylesheet'; sheet.href = '/knowledge-center/modules/production/production.css'; document.head.append(sheet);
    const { openProductionQualityDialog } = await import('/knowledge-center/modules/production/production-quality-dialog.js');
    openProductionQualityDialog({ context: { handbookId: 'HB-1', documentId: 'doc-1', outlineVersionId: 'outline-v1', branch: 'main' }, markdown: revision.markdown, revisionId: revision.revisionId, editVersion: 1 });
  }, revision);
  await page.locator('[data-quality-run]').click();
  await page.waitForFunction(() => document.querySelector('[data-quality-status]')?.textContent.includes('通过 1，失败 1，未执行 1'));
  assert.equal(await page.locator('[data-quality-report] h3').count(), 3);
  assert.match(await page.locator('[data-quality-report]').textContent(), /isolated-test-version/);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-quality-download]').click();
  const download = await downloadPromise;
  const first = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  assert.equal(first.document.revisionId, revision.revisionId);
  assert.equal(first.skillInvocations.length, 4);
  assert.deepEqual(first.cases.map(row => row.status), ['passed', 'failed', 'not_executed']);
  assert.equal(await page.locator('dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  await page.locator('[data-quality-content]').check();
  await page.locator('[data-quality-run]').click();
  await page.waitForFunction(firstId => document.querySelector('[data-quality-report]')?.textContent.includes('报告编号：quality-') && !document.querySelector('[data-quality-report]')?.textContent.includes(`报告编号：${firstId}；`), first.reportId);
  const reread = await api.request('GET', draftPath() + '?outlineVersionId=outline-v1&branch=main');
  const reportId = reread.body.data.draft.revision.qualityReport.reportId;
  const rereport = await api.request('GET', '/handbooks/HB-1/documents/doc-1/quality/' + reportId);
  assert.equal(rereport.body.data.rerunOf.reportId, first.reportId);
  assert.equal(rereport.body.data.contentQuality.status, 'completed');
  assert.match(await page.locator('[data-quality-report]').textContent(), /模板：未执行/);
  assert.match(await page.locator('[data-quality-report]').textContent(), /处理要求：请作者核对表达/);
  assert.equal(await page.locator('[data-quality-report] script').count(), 0);
  const evidenceDir = path.join(repositoryRoot, 'runtime/test-results/production-ai-quality/20261022/workbench-dialog');
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'isolated-browser-report.json'), JSON.stringify({ realHTTP: true, realDatabase: false, fullPlatformAcceptance: false, report: rereport.body.data }, null, 2));
  await page.screenshot({ path: path.join(evidenceDir, 'mobile-report.png'), fullPage: true });
  await page.evaluate(() => new Promise(resolve => {
    const dialog = document.querySelector('dialog');
    dialog.addEventListener('close', resolve, { once: true });
    document.querySelector('[data-quality-close]').click();
  }));
  assert.equal(await page.locator('dialog').count(), 0);
});

test('真实 YashanDB 经质量 HTTP 验证预期结果匹配、失配、SQL 错误及未执行', {
  skip: !process.env.PRODUCTION_QUALITY_REAL_STORAGE_URL,
}, async t => {
  const { createYashanDBQualityAdapter } = require('../../../packages/agent-runner-core/lib/yashandb-quality-adapter');
  const adapter = createYashanDBQualityAdapter({ baseUrl: process.env.PRODUCTION_QUALITY_REAL_STORAGE_URL });
  const api = await setup(t, { yashanDB: adapter });
  const sql = statement => '```sql\n' + statement + '\n```\n';
  const expected = rows => '```json quality-expected\n' + JSON.stringify({ columns: ['C1'], rows }) + '\n```\n';
  const markdown = sql('SELECT 1 AS C1 FROM DUAL;') + expected([{ C1: 1 }]) +
    sql('SELECT 1 AS C1 FROM DUAL;') + expected([{ C1: 2 }]) +
    sql('SELECT FROM DUAL;') +
    sql('SELECT 1 AS C1 FROM DUAL;') + '```json quality-expected\n{"rows": "invalid"}\n```\n';
  const endpoint = '/handbooks/HB-1/documents/doc-1/quality';
  const input = json({ outlineVersionId: 'outline-v1', branch: 'main', markdown });
  const result = await api.request('POST', endpoint, input.body, input.headers);
  assert.equal(result.status, 201, JSON.stringify(result.body));
  const report = result.body.data;
  assert.deepEqual(report.coverage, { total: 4, executed: 3, passed: 1, failed: 2, notExecuted: 1 });
  assert.deepEqual(report.cases.map(row => row.status), ['passed', 'failed', 'failed', 'not_executed']);
  assert.equal(report.cases[0].comparison, 'matched');
  assert.equal(report.cases[1].comparison, 'mismatched');
  assert.equal(report.cases[2].error, 'YASHANDB_QUALITY_EXECUTION_FAILED');
  assert.equal(report.cases[3].attempts, 0);
  assert.ok(report.database.version);
  const reread = await api.request('GET', endpoint + '/' + report.reportId);
  assert.equal(reread.status, 200);
  assert.deepEqual(reread.body.data, report);
  const reportRoot = path.join(repositoryRoot, 'runtime/test-results/production-ai-quality/20261022/expected-results');
  fs.mkdirSync(reportRoot, { recursive: true });
  fs.writeFileSync(path.join(reportRoot, 'real-http-report.json'), JSON.stringify({ testedAt: new Date().toISOString(),
    realDatabase: true, realHTTP: true, auth: 'isolated editor fixture', store: 'isolated memory',
    sharedPlatformAcceptance: false, markdown, report }, null, 2));
});

test('真实配置模型经内容质量 HTTP 如实记录成功或失败，SQL 证据保持独立', {
  skip: process.env.PRODUCTION_CONTENT_REAL_PROVIDER !== '1' || !process.env.PRODUCTION_QUALITY_REAL_STORAGE_URL,
}, async t => {
  const logger = require('../../../packages/agent-runner-core/lib/logger');
  const originalSilent = logger.silent; logger.silent = true; t.after(() => { logger.silent = originalSilent; });
  const config = await require('../../../packages/agent-runner-core/lib/config-manager').getModelConfig();
  assert.ok(config?.model && config?.api_key, '需要已授权且可读取的现有模型配置');
  const adapter = require('../../../packages/agent-runner-core/lib/yashandb-quality-adapter').createYashanDBQualityAdapter({ baseUrl: process.env.PRODUCTION_QUALITY_REAL_STORAGE_URL });
  const api = await setup(t, { yashanDB: adapter });
  const markdown = '# 只读验证\n```sql\nSELECT 1 AS C1 FROM DUAL;\n```\n```json quality-expected\n{"rows":[{"C1":1}]}\n```\n';
  const ctx = { outlineVersionId: 'outline-v1', branch: 'main' };
  const savedInput = json({ ...ctx, markdown, editVersion: 0 }, 'real-content-save');
  const saved = await api.request('PUT', draftPath(), savedInput.body, savedInput.headers);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const input = json({ ...ctx, markdown, revisionId: saved.body.data.draft.revision.revisionId, checkContent: true }, 'real-content-quality');
  const endpoint = '/handbooks/HB-1/documents/doc-1/quality';
  const response = await api.request('POST', endpoint, input.body, input.headers);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const report = response.body.data;
  assert.equal(report.sqlGate, 'passed');
  assert.equal(report.cases[0].comparison, 'matched');
  assert.equal(report.contentQuality.checks.length, 4);
  assert.equal(report.contentQuality.gate, 'not_passed', '没有固定模板和来源不能宣称完整内容检查通过');
  if (report.contentQuality.status === 'not_executed') {
    assert.ok(report.contentQuality.error?.code);
    assert.ok(report.contentQuality.checks.every(check => check.status === 'not_executed'));
    assert.equal(report.contentQuality.model, null);
  } else assert.equal(report.contentQuality.status, 'completed');
  const loaded = await api.request('GET', endpoint + '/' + report.reportId);
  assert.deepEqual(loaded.body.data, report);
  const root = path.join(repositoryRoot, 'runtime/test-results/production-ai-quality/20261022/content-review'); fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'real-provider-http-report.json'), JSON.stringify({ at: new Date().toISOString(),
    realProvider: true, realHTTP: true, realDatabase: true, providerConfigured: true, auth: 'isolated editor fixture',
    contentModelExecuted: report.contentQuality.status === 'completed', fullBusinessAcceptance: false, report }, null, 2));
});

test('质量报告经 HTTP 仅绑定实际被测草稿，正文和修订不一致时保留原关联', async t => {
  const api = await setup(t, { yashanDB: { execute: async () => ({ rows: [{ C1: 1 }] }) } });
  const requestJSON = (method, endpoint, data, key) => { const input = json(data, key); return api.request(method, endpoint, input.body, input.headers); };
  const ctx = { outlineVersionId: 'outline-v1', branch: 'main' };
  const saved = await requestJSON('PUT', draftPath(), { ...ctx, markdown: '# 测试\n```sql\nSELECT 1 AS C1 FROM DUAL;\n```\n', editVersion: 0 }, 'quality-draft');
  assert.equal(saved.status, 200);
  const revision = saved.body.data.draft.revision;
  const endpoint = '/handbooks/HB-1/documents/doc-1/quality';
  const passed = await requestJSON('POST', endpoint, { ...ctx, revisionId: revision.revisionId, markdown: revision.markdown });
  assert.equal(passed.status, 201);
  assert.equal(passed.body.data.revisionLinked, revision.revisionId);
  const mismatch = await requestJSON('POST', endpoint, { ...ctx, revisionId: revision.revisionId, markdown: revision.markdown + '新内容\n' });
  assert.equal(mismatch.status, 409);
  assert.match(JSON.stringify(mismatch.body), /QUALITY_CONTENT_MISMATCH/);
  const read = await api.request('GET', `${draftPath()}?outlineVersionId=outline-v1&branch=main`);
  assert.equal(read.body.data.draft.revision.qualityReport.reportId, passed.body.data.reportId);
  assert.equal(read.body.data.draft.revision.markdown, revision.markdown);
  const crossBranch = await requestJSON('POST', endpoint, { ...ctx, branch: 'other', markdown: revision.markdown, rerunOfReportId: passed.body.data.reportId });
  assert.equal(crossBranch.status, 404);
  assert.match(JSON.stringify(crossBranch.body), /QUALITY_RERUN_REPORT_NOT_FOUND/);
});

const query = '?outlineVersionId=outline-v1&branch=main';
const json = (value, key) => ({
  body: JSON.stringify(value?.markdown !== undefined && value.originSnapshot === undefined
    ? { ...value, originSnapshot: { originType: 'blank', contentDigest: crypto.createHash('sha256').update('').digest('hex') } }
    : value),
  headers: {
    'content-type': 'application/json',
    ...(key ? { 'idempotency-key': key } : {}),
  },
});

test('停用模板的旧映射不会自动填入新生成任务', async t => {
  const api = await setup(t, {
    templateStore: { get: () => ({ status: 'disabled' }) },
    templateMappingService: { resolve: () => ({ status: 'active', templateId: 'disabled-template', decisionId: 'old-decision' }) },
  });
  const input = json({ outlineVersionId: 'outline-v1', branch: 'main', operation: 'rewrite', markdown: '正文',
    editVersion: 0, range: { start: 0, end: 2 } }, 'disabled-mapping');
  const result = await api.request('POST', '/handbooks/HB-1/documents/doc-1/ai-jobs', input.body, input.headers);
  assert.notEqual(result.status, 202);
  assert.equal(result.body.error.code, 'AI_TEMPLATE_REQUIRED');
});

test('AI 任务评价和历史删除经真实 HTTP 保留作者边界', async t => {
  const api = await setup(t, { ai: { generate: async () => ({ content: '新句', model: 'isolated-http-model' }) } });
  const aiPath = '/handbooks/HB-1/documents/doc-1/ai-jobs';
  const payload = { outlineVersionId: 'outline-v1', branch: 'main', operation: 'polish', markdown: '前文旧句后文', editVersion: 0, range: { start: 2, end: 4 } };
  const created = await api.request('POST', aiPath, json(payload, 'feedback-http').body, json(payload, 'feedback-http').headers);
  assert.equal(created.status, 202, JSON.stringify(created.body));
  const jobId = created.body.data.jobId;
  const jobPath = `${aiPath}/${jobId}`;
  const saved = await api.request('POST', `${jobPath}/feedback`, JSON.stringify({ outlineVersionId: 'outline-v1', branch: 'main', rating: 'positive', comment: '可用' }), { 'content-type': 'application/json' });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.data.rating, 'positive');
  const list = await api.request('GET', `${aiPath}${query}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.data.find(item => item.jobId === jobId)?.feedback, 'positive');
  const removed = await api.request('DELETE', `${jobPath}${query}`);
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.equal(removed.body.data.jobId, jobId);
  assert.equal((await api.request('GET', `${jobPath}${query}`)).status, 404);
  assert.equal((await api.request('GET', `${aiPath}${query}`)).body.data.some(item => item.jobId === jobId), false);
  assert.deepEqual(api.store.read().audits.slice(-2).map(item => item.action), ['AI_FEEDBACK_UPDATED', 'AI_HISTORY_DELETED']);
});

test('AI HTTP creates isolated candidates and explicitly adopts once into the shared draft', async t => {
  let calls = 0;
  const api = await setup(t, { ai: { generate: async () => { calls++; return { content: '新句', model: 'isolated-http-model' }; } } });
  const aiPath = '/handbooks/HB-1/documents/doc-1/ai-jobs';
  const payload = { outlineVersionId: 'outline-v1', branch: 'main', operation: 'polish', markdown: '前文旧句后文', editVersion: 0, range: { start: 2, end: 4 } };
  const input = json(payload, 'ai-start');
  const created = await api.request('POST', aiPath, input.body, input.headers);
  assert.equal(created.status, 202, JSON.stringify(created.body));
  const jobId = created.body.data.jobId;
  const loaded = await api.request('GET', `${aiPath}/${jobId}${query}`);
  assert.equal(loaded.status, 200);
  assert.equal(loaded.body.data.status, 'completed');
  assert.equal(loaded.body.data.candidateMarkdown, '前文新句后文');
  const before = await api.request('GET', `${draftPath()}${query}`);
  assert.equal(before.body.data.exists, false);
  const retry = await api.request('POST', aiPath, input.body, input.headers);
  assert.equal(retry.body.data.jobId, jobId);
  assert.equal(calls, 1);
  const wrong = json({ ...payload, markdown: '不同原文' }, 'ai-start');
  assert.equal((await api.request('POST', aiPath, wrong.body, wrong.headers)).status, 409);
  const adoption = json({ ...payload, originalMarkdown: payload.markdown, markdown: '前文人工新句后文' });
  const adopted = await api.request('POST', `${aiPath}/${jobId}/adopt`, adoption.body, adoption.headers);
  assert.equal(adopted.status, 200, JSON.stringify(adopted.body));
  assert.equal(adopted.body.data.draft.revision.markdown, '前文人工新句后文\n');
  assert.equal(adopted.body.data.draft.revision.generationMetadata.humanEdited, true);
  const repeated = await api.request('POST', `${aiPath}/${jobId}/adopt`, adoption.body, adoption.headers);
  assert.equal(repeated.body.data.draft.currentRevisionId, adopted.body.data.draft.currentRevisionId);
  const saved = await api.request('GET', `${draftPath()}${query}`);
  assert.equal(saved.body.data.draft.revision.generationMetadata.taskId, jobId);
  const wrongDoc = await api.request('GET', `/handbooks/HB-1/documents/other/ai-jobs/${jobId}${query}`);
  assert.equal(wrongDoc.status, 404);
});

test('AI HTTP stage adapters receive frozen envelopes and invalid Planner output blocks Writer', async t => {
  const calls = [];
  const rules = structuredClone(require('../../../config/knowledge-center/content-rules.json').productionAI);
  const adapterOptions = {
    rules,
    stageAdapters: {
      planner: { run: async (envelope, context) => {
        calls.push({ stage: 'planner', envelope, payload: context.payload });
        return { operation: envelope.task.operation, range: envelope.document.range, requirements: context.payload.requirements, outline: context.payload.outline };
      } },
      evidence: { run: async (envelope, context) => {
        calls.push({ stage: 'evidence', envelope, planner: context.planner });
        return { sources: envelope.sources.map(source => ({ sourceId: source.sourceId, contentDigest: source.contentDigest })) };
      } },
      reviewer: { run: async (envelope, context) => {
        calls.push({ stage: 'reviewer', envelope, candidateDigest: context.candidateDigest });
        return { status: 'contract_valid', candidateDigest: context.candidateDigest, provenanceSegments: context.provenance.length };
      } },
    },
    generate: async messages => {
      calls.push({ stage: 'writer', messages });
      return { content: '适配器生成的候选正文。', model: 'adapter-model' };
    },
  };
  const api = await setup(t, { ai: adapterOptions });
  const ctx = { outlineVersionId: 'outline-v1', branch: 'main' };
  const input = json({ ...ctx, operation: 'update', markdown: '旧正文', editVersion: 0, range: { start: 0, end: 3 }, requirements: '只改正文' }, 'stage-adapter');
  const created = await api.request('POST', '/handbooks/HB-1/documents/doc-1/ai-jobs', input.body, input.headers);
  assert.equal(created.status, 202, JSON.stringify(created.body));
  const job = await api.request('GET', `/handbooks/HB-1/documents/doc-1/ai-jobs/${created.body.data.jobId}?outlineVersionId=outline-v1&branch=main`);
  assert.equal(job.body.data.status, 'completed');
  assert.deepEqual(calls.map(item => item.stage), ['planner', 'evidence', 'writer', 'reviewer']);
  assert.equal(calls[0].envelope.contractVersion, '1.0');
  assert.equal(calls[0].envelope.document.range.start, 0);
  assert.equal(calls[0].envelope.frozen.ruleVersion, rules.version);
  assert.equal(calls[1].planner.operation, 'update');
  assert.equal(job.body.data.stageRuns.find(run => run.stageId === 'reviewer').status, 'succeeded');

  const invalidCalls = [];
  const invalidApi = await setup(t, { ai: {
    rules,
    stageAdapters: {
      planner: { run: async () => ({ operation: 'update', range: { start: 0, end: 1 }, requirements: '', outline: '' }) },
      evidence: { run: async () => { invalidCalls.push('evidence'); return { sources: [] }; } },
    },
    generate: async () => { invalidCalls.push('writer'); return { content: '不应生成' }; },
  } });
  const invalidInput = json({ ...ctx, operation: 'update', markdown: '旧正文', editVersion: 0, range: { start: 0, end: 3 } }, 'invalid-stage');
  const invalid = await invalidApi.request('POST', '/handbooks/HB-1/documents/doc-1/ai-jobs', invalidInput.body, invalidInput.headers);
  assert.equal(invalid.status, 202);
  const failed = await invalidApi.request('GET', `/handbooks/HB-1/documents/doc-1/ai-jobs/${invalid.body.data.jobId}?outlineVersionId=outline-v1&branch=main`);
  assert.equal(failed.body.data.status, 'failed');
  assert.equal(failed.body.data.error.code, 'AI_STAGE_CONTRACT_INVALID');
  assert.deepEqual(invalidCalls, []);
});

test('AI HTTP stage adapter can call a separately hosted Planner with server configured credentials', async t => {
  let received;
  const agentServer = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received = { authorization: req.headers.authorization, request: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
    const { envelope, input } = received.request;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ artifact: { operation: envelope.task.operation, range: envelope.document.range,
      requirements: input.payload.requirements, outline: input.payload.outline } }));
  });
  await new Promise(resolve => agentServer.listen(0, '127.0.0.1', resolve));
  t.after(async () => new Promise(resolve => { agentServer.close(resolve); agentServer.closeAllConnections(); }));
  const aiStageAdapterEnv = {
    KNOWLEDGE_PRODUCTION_PLANNER_URL: `http://127.0.0.1:${agentServer.address().port}/run`,
    KNOWLEDGE_PRODUCTION_PLANNER_TOKEN: 'isolated-agent-token',
  };
  const api = await setup(t, { aiStageAdapterEnv, ai: { generate: async () => ({ content: '外置 Planner 生成候选。', model: 'isolated-writer' }) } });
  const ctx = { outlineVersionId: 'outline-v1', branch: 'main' };
  const input = json({ ...ctx, operation: 'update', markdown: '旧正文', editVersion: 0,
    range: { start: 0, end: 3 }, requirements: '仅更新正文' }, 'remote-planner');
  const created = await api.request('POST', '/handbooks/HB-1/documents/doc-1/ai-jobs', input.body, input.headers);
  assert.equal(created.status, 202, JSON.stringify(created.body));
  const job = await api.request('GET', `/handbooks/HB-1/documents/doc-1/ai-jobs/${created.body.data.jobId}?outlineVersionId=outline-v1&branch=main`);
  assert.equal(job.body.data.status, 'completed');
  assert.equal(job.body.data.candidateMarkdown, '外置 Planner 生成候选。');
  assert.equal(received.authorization, 'Bearer isolated-agent-token');
  assert.equal(received.request.envelope.contractVersion, '1.0');
  assert.equal(received.request.envelope.task.jobId, created.body.data.jobId);
  assert.equal(received.request.input.payload.requirements, '仅更新正文');
});

test('AI retry is available over HTTP, is idempotent, and preserves attempts after a Writer failure', async t => {
  let calls = 0;
  const api = await setup(t, { ai: { generate: async () => {
    calls++;
    if (calls === 1) throw new Error('isolated transient model error');
    return { content: '重试成功' };
  } } });
  const aiPath = '/handbooks/HB-1/documents/doc-1/ai-jobs';
  const payload = { outlineVersionId: 'outline-v1', branch: 'main', operation: 'polish', markdown: '前文旧句后文', editVersion: 0, range: { start: 2, end: 4 } };
  const createInput = json(payload, 'ai-retry-create');
  const created = await api.request('POST', aiPath, createInput.body, createInput.headers);
  assert.equal(created.status, 202, JSON.stringify(created.body));
  const jobId = created.body.data.jobId;

  let failed;
  for (let attempt = 0; attempt < 20; attempt++) {
    failed = await api.request('GET', `${aiPath}/${jobId}${query}`);
    if (failed.body.data.status === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  assert.equal(failed.body.data.status, 'failed');
  const firstWriter = failed.body.data.stageRuns.find(run => run.stageId === 'writer');
  assert.equal(firstWriter.status, 'failed');

  const retryHeaders = { 'content-type': 'application/json', 'idempotency-key': 'http-retry-once' };
  const retryBody = JSON.stringify({ outlineVersionId: 'outline-v1', branch: 'main' });
  const retried = await api.request('POST', `${aiPath}/${jobId}/retry`, retryBody, retryHeaders);
  assert.equal(retried.status, 202, JSON.stringify(retried.body));
  assert.equal(retried.body.data.jobId, jobId);
  const duplicate = await api.request('POST', `${aiPath}/${jobId}/retry`, retryBody, retryHeaders);
  assert.equal(duplicate.status, 202, JSON.stringify(duplicate.body));
  assert.equal(duplicate.body.data.jobId, jobId);

  let completed;
  for (let attempt = 0; attempt < 20; attempt++) {
    completed = await api.request('GET', `${aiPath}/${jobId}${query}`);
    if (completed.body.data.status === 'completed') break;
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  assert.equal(completed.body.data.status, 'completed', JSON.stringify(completed.body.data));
  assert.equal(completed.body.data.candidateMarkdown, '前文重试成功后文');
  assert.equal(completed.body.data.stageRuns.filter(run => run.stageId === 'writer').length, 2);
  assert.deepEqual(completed.body.data.stageRuns.filter(run => run.stageId === 'writer').map(run => run.attempt), [1, 2]);
  assert.deepEqual(completed.body.data.stageRuns.filter(run => run.stageId === 'writer').map(run => run.status), ['failed', 'succeeded']);
  assert.equal(calls, 2);
  const unavailable = await api.request('POST', `${aiPath}/${jobId}/retry`, JSON.stringify({ outlineVersionId: 'outline-v1', branch: 'main' }), { ...retryHeaders, 'idempotency-key': 'new-completed-retry' });
  assert.equal(unavailable.status, 409);
  assert.equal(unavailable.body.error.code, 'AI_JOB_NOT_RETRYABLE');
});

test('AI recovery resumes an expired job over HTTP and reuses verified planner/evidence artifacts', async t => {
  const config = JSON.parse(fs.readFileSync(path.resolve(repositoryRoot, 'config/knowledge-center/content-rules.json'), 'utf8')).productionAI;
  let calls = 0;
  let clock = Date.now();
  const api = await setup(t, { ai: {
    now: () => clock,
    rules: { ...config, leaseMs: 50 },
    generate: async () => { calls++; if (calls === 1) return new Promise(() => {}); return { content: '恢复内容' }; },
  } });
  const aiPath = '/handbooks/HB-1/documents/doc-1/ai-jobs';
  const payload = { outlineVersionId: 'outline-v1', branch: 'main', operation: 'polish', markdown: '前文旧句后文', editVersion: 0, range: { start: 2, end: 4 } };
  const created = await api.request('POST', aiPath, JSON.stringify(payload), { 'content-type': 'application/json', 'idempotency-key': 'http-recovery-create' });
  assert.equal(created.status, 202);
  const jobId = created.body.data.jobId;
  for (let attempt = 0; attempt < 100 && calls === 0; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(calls, 1, '写作调用开始后才能模拟租约过期');
  clock += 51;
  const expired = await api.request('GET', `${aiPath}/${jobId}${query}`);
  assert.equal(expired.body.data.status, 'interrupted');
  api.setSession(null);
  const anonymous = await api.request('POST', `${aiPath}/${jobId}/recover`, JSON.stringify({ outlineVersionId: 'outline-v1', branch: 'main' }), { 'content-type': 'application/json' });
  assert.equal(anonymous.status, 401);
  api.setSession({ authenticated: true, user: { id: 'author-2', displayName: '其他作者', roles: ['KNOWLEDGE_EDITOR'] }, allowedActions: ['knowledge:read', 'knowledge:write'] });
  const otherAuthor = await api.request('POST', `${aiPath}/${jobId}/recover`, JSON.stringify({ outlineVersionId: 'outline-v1', branch: 'main' }), { 'content-type': 'application/json' });
  assert.equal(otherAuthor.status, 404);
  api.setSession({ authenticated: true, user: { id: 'viewer-1', displayName: '只读用户', roles: ['KNOWLEDGE_VIEWER'] }, allowedActions: ['knowledge:read'] });
  const readOnly = await api.request('POST', `${aiPath}/${jobId}/recover`, JSON.stringify({ outlineVersionId: 'outline-v1', branch: 'main' }), { 'content-type': 'application/json' });
  assert.equal(readOnly.status, 403);
  api.setSession(editor);
  const wrongDocument = await api.request('POST', `/handbooks/HB-1/documents/doc-2/ai-jobs/${jobId}/recover`, JSON.stringify({ outlineVersionId: 'outline-v1', branch: 'main' }), { 'content-type': 'application/json' });
  assert.equal(wrongDocument.status, 404);
  const recovered = await api.request('POST', `${aiPath}/${jobId}/recover`, JSON.stringify({ outlineVersionId: 'outline-v1', branch: 'main' }), { 'content-type': 'application/json' });
  assert.equal(recovered.status, 202, JSON.stringify(recovered.body));
  let completed;
  for (let attempt = 0; attempt < 30; attempt++) {
    completed = await api.request('GET', `${aiPath}/${jobId}${query}`);
    if (completed.body.data.status === 'completed') break;
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  assert.equal(completed.body.data.status, 'completed', JSON.stringify(completed.body.data));
  assert.equal(completed.body.data.candidateMarkdown, '前文恢复内容后文');
  assert.deepEqual(completed.body.data.stageRuns.filter(run => run.stageId === 'planner').map(run => run.status), ['succeeded']);
  assert.deepEqual(completed.body.data.stageRuns.filter(run => run.stageId === 'evidence').map(run => run.status), ['succeeded']);
  assert.deepEqual(completed.body.data.stageRuns.filter(run => run.stageId === 'writer').map(run => run.attempt), [1, 2]);
});

test('AI periodic recovery resumes an expired job without an explicit recover request over HTTP', async t => {
  const config = JSON.parse(fs.readFileSync(path.resolve(repositoryRoot, 'config/knowledge-center/content-rules.json'), 'utf8')).productionAI;
  let calls = 0;
  let clock = Date.now();
  const api = await setup(t, { recoveryIntervalMs: 5, ai: {
    now: () => clock,
    rules: { ...config, leaseMs: 30 },
    generate: async () => { calls++; if (calls === 1) return new Promise(() => {}); return { content: '后台恢复内容' }; },
  } });
  const aiPath = '/handbooks/HB-1/documents/doc-1/ai-jobs';
  const payload = { outlineVersionId: 'outline-v1', branch: 'main', operation: 'polish', markdown: '前文旧句后文', editVersion: 0, range: { start: 2, end: 4 } };
  const created = await api.request('POST', aiPath, JSON.stringify(payload), { 'content-type': 'application/json', 'idempotency-key': 'http-periodic-recovery-create' });
  assert.equal(created.status, 202);
  const jobId = created.body.data.jobId;
  for (let attempt = 0; attempt < 100 && calls === 0; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(calls, 1, '写作调用开始后才能模拟租约过期');
  clock += 31;
  let result;
  for (let attempt = 0; attempt < 100; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 10));
    result = await api.request('GET', `${aiPath}/${jobId}${query}`);
    if (result.body.data.status === 'completed') break;
  }
  assert.equal(result.body.data.status, 'completed', JSON.stringify(result.body.data));
  assert.equal(result.body.data.candidateMarkdown, '前文后台恢复内容后文');
  assert.deepEqual(result.body.data.stageRuns.filter(run => run.stageId === 'writer').map(run => run.attempt), [1, 2]);
});

test('AI HTTP verifies GitLab origin against the authorized mapping and server file snapshot', async t => {
  const originalAllowedHosts = process.env.KNOWLEDGE_CENTER_GITLAB_ALLOWED_HOSTS;
  const originalToken = process.env.GITLAB_TOKEN_PRODUCTION_ORIGIN_TEST;
  process.env.KNOWLEDGE_CENTER_GITLAB_ALLOWED_HOSTS = '127.0.0.1';
  process.env.GITLAB_TOKEN_PRODUCTION_ORIGIN_TEST = 'isolated-token';
  t.after(() => {
    if (originalAllowedHosts === undefined) delete process.env.KNOWLEDGE_CENTER_GITLAB_ALLOWED_HOSTS;
    else process.env.KNOWLEDGE_CENTER_GITLAB_ALLOWED_HOSTS = originalAllowedHosts;
    if (originalToken === undefined) delete process.env.GITLAB_TOKEN_PRODUCTION_ORIGIN_TEST;
    else process.env.GITLAB_TOKEN_PRODUCTION_ORIGIN_TEST = originalToken;
  });
  let fileContent = '原始 GitLab 正文';
  let fileCommitId = 'commit-1';
  let fileBlobId = 'blob-1';
  let filePath = 'docs/doc-1.md';
  let readCount = 0;
  const requestedRefs = [];
  const gitLab = http.createServer((req, res) => {
    readCount++;
    requestedRefs.push(new URL(req.url, 'http://gitlab.test').searchParams.get('ref'));
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ file_path: filePath, encoding: 'base64', content: Buffer.from(fileContent).toString('base64'), commit_id: fileCommitId, blob_id: fileBlobId }));
  });
  await new Promise(resolve => gitLab.listen(0, '127.0.0.1', resolve));
  t.after(() => gitLab.close());
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'production-ai-gitlab-origin-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const gitlabConfigPath = path.join(root, 'gitlab.json');
  const gitlabConnector = require('../../../packages/agent-runner-core/lib/gitlab-connector');
  const connection = gitlabConnector.upsertConnection({
    name: 'production-origin-test', baseUrl: `http://127.0.0.1:${gitLab.address().port}`,
    projectPath: 'fixture/project', defaultBranch: 'main', mode: 'sandbox', authMode: 'service_account',
    credentialRef: 'PRODUCTION_ORIGIN_TEST', purpose: 'read',
  }, gitlabConfigPath);
  gitlabConnector.upsertMapping('HB-1', { connectionId: connection.id, defaultBranch: 'main', enabledBranches: ['main'], zhPaths: ['docs'], enPaths: [] }, gitlabConfigPath);

  let calls = 0;
  const api = await setup(t, { gitlabConfigPath, ai: { generate: async () => { calls++; return { content: '候选' }; } } });
  const pathName = '/handbooks/HB-1/documents/doc-1/ai-jobs';
  const digest = crypto.createHash('sha256').update(fileContent).digest('hex');
  const payload = {
    outlineVersionId: 'outline-v1', branch: 'main', operation: 'polish', markdown: `${fileContent} working`,
    editVersion: 0, range: { start: 0, end: fileContent.length },
    originSnapshot: { originType: 'gitlab', snapshotId: 'commit-1', contentDigest: digest, handbookId: 'HB-1', documentId: 'doc-1', branch: 'main', path: 'docs/doc-1.md', commitId: 'commit-1', blobId: 'blob-1' },
  };
  const rejectedSnapshots = [
    ['mapped handbook requires an origin snapshot', { ...payload, originSnapshot: undefined }, 'AI_ORIGIN_SNAPSHOT_REQUIRED'],
    ['snapshot handbook identity must match', { ...payload, originSnapshot: { ...payload.originSnapshot, handbookId: 'HB-OTHER' } }, 'AI_ORIGIN_SNAPSHOT_INVALID'],
    ['snapshot document identity must match', { ...payload, originSnapshot: { ...payload.originSnapshot, documentId: 'doc-other' } }, 'AI_ORIGIN_SNAPSHOT_INVALID'],
    ['platform origin requires a valid digest', { ...payload, originSnapshot: { originType: 'platform', contentDigest: 'invalid', handbookId: 'HB-1', documentId: 'doc-1' } }, 'AI_ORIGIN_SNAPSHOT_INVALID'],
    ['platform origin rejects stale content digest', { ...payload, originSnapshot: { originType: 'platform', contentDigest: '0'.repeat(64), handbookId: 'HB-1', documentId: 'doc-1' } }, 'AI_ORIGIN_SNAPSHOT_INVALID'],
    ['platform origin branch must match the write branch', { ...payload, originSnapshot: { originType: 'platform', contentDigest: crypto.createHash('sha256').update(`${fileContent} working`).digest('hex'), handbookId: 'HB-1', documentId: 'doc-1', branch: 'release' } }, 'AI_ORIGIN_SNAPSHOT_INVALID'],
    ['mapped handbook cannot use a blank origin', { ...payload, originSnapshot: { originType: 'blank', contentDigest: crypto.createHash('sha256').update('').digest('hex'), handbookId: 'HB-1', documentId: 'doc-1' } }, 'AI_ORIGIN_MAPPING_REQUIRED'],
    ['GitLab origin requires path branch and revision identity', { ...payload, originSnapshot: { originType: 'gitlab', contentDigest: digest, handbookId: 'HB-1', documentId: 'doc-1' } }, 'AI_ORIGIN_SNAPSHOT_INVALID'],
    ['GitLab snapshot branch must match the write branch', { ...payload, branch: 'release' }, 'AI_ORIGIN_SNAPSHOT_INVALID'],
    ['pinned GitLab baseline requires a commit id', { ...payload, originSnapshot: { ...payload.originSnapshot, commitId: undefined, blobId: 'blob-1', pinToCommit: true } }, 'AI_ORIGIN_SNAPSHOT_INVALID'],
  ];
  for (const [name, invalidPayload, code] of rejectedSnapshots) {
    const response = await api.request('POST', pathName, JSON.stringify(invalidPayload), {
      'content-type': 'application/json', 'idempotency-key': `invalid-origin-${code}-${name}`,
    });
    assert.equal(response.status, 409, `${name}: ${JSON.stringify(response.body)}`);
    assert.equal(response.body.error.code, code, name);
  }
  assert.equal(readCount, 0, 'invalid snapshots must be rejected before reading GitLab');
  assert.equal(calls, 0, 'invalid snapshots must be rejected before invoking AI');

  const invalidPath = json({ ...payload, originSnapshot: { ...payload.originSnapshot, path: 'private/doc-1.md' } }, 'blocked-path');
  const forbidden = await api.request('POST', pathName, invalidPath.body, invalidPath.headers);
  assert.equal(forbidden.status, 403, JSON.stringify(forbidden.body));
  assert.equal(calls, 0);

  const started = await api.request('POST', pathName, json(payload, 'verified-origin').body, { 'content-type': 'application/json', 'idempotency-key': 'verified-origin' });
  assert.equal(started.status, 202, JSON.stringify(started.body));
  const jobId = started.body.data.jobId;
  const loaded = await api.request('GET', `${pathName}/${jobId}${query}`);
  assert.equal(loaded.body.data.document.origin.contentDigest, digest);
  assert.equal(loaded.body.data.document.origin.commitId, 'commit-1');
  assert.equal(loaded.body.data.document.origin.blobId, 'blob-1');
  assert.ok(loaded.body.data.document.origin.fetchedAt);
  assert.equal(readCount, 1);
  assert.equal(requestedRefs[0], 'main', '初次验证应读取分支当前内容以发现基线漂移');

  fileContent = '已漂移的 GitLab 正文';
  const stale = await api.request('POST', pathName, json(payload, 'stale-origin').body, { 'content-type': 'application/json', 'idempotency-key': 'stale-origin' });
  assert.equal(stale.status, 409, JSON.stringify(stale.body));
  assert.match(JSON.stringify(stale.body), /AI_ORIGIN_BASELINE_CHANGED/);
  assert.equal(calls, 1);

  fileContent = '原始 GitLab 正文';
  const pinned = await api.request('POST', pathName, json({ ...payload, originSnapshot: { ...payload.originSnapshot, pinToCommit: true } }, 'pinned-origin').body, { 'content-type': 'application/json', 'idempotency-key': 'pinned-origin' });
  assert.equal(pinned.status, 202, JSON.stringify(pinned.body));
  assert.equal(requestedRefs.at(-1), 'commit-1', '作者确认保留旧基线后应按不可变 commit 校验');

  fileCommitId = 'commit-2';
  const changedCommit = await api.request('POST', pathName, json(payload, 'changed-origin-commit').body, { 'content-type': 'application/json', 'idempotency-key': 'changed-origin-commit' });
  assert.equal(changedCommit.status, 409);
  assert.equal(changedCommit.body.error.code, 'AI_ORIGIN_BASELINE_CHANGED');
  assert.equal(calls, 2);

  fileCommitId = 'commit-1';
  fileBlobId = 'blob-2';
  const changedBlob = await api.request('POST', pathName, json(payload, 'changed-origin-blob').body, { 'content-type': 'application/json', 'idempotency-key': 'changed-origin-blob' });
  assert.equal(changedBlob.status, 409);
  assert.equal(changedBlob.body.error.code, 'AI_ORIGIN_BASELINE_CHANGED');
  assert.equal(calls, 2);

  fileBlobId = 'blob-1';
  const changedSnapshotId = await api.request('POST', pathName, json({ ...payload, originSnapshot: { ...payload.originSnapshot, snapshotId: 'stale-snapshot' } }, 'changed-origin-snapshot-id').body, { 'content-type': 'application/json', 'idempotency-key': 'changed-origin-snapshot-id' });
  assert.equal(changedSnapshotId.status, 409);
  assert.equal(changedSnapshotId.body.error.code, 'AI_ORIGIN_BASELINE_CHANGED');
  assert.equal(calls, 2);

  fileCommitId = undefined;
  fileBlobId = undefined;
  filePath = undefined;
  const fallbackSnapshot = { ...payload.originSnapshot, snapshotId: undefined };
  const fallback = await api.request('POST', pathName, json({ ...payload, originSnapshot: fallbackSnapshot }, 'origin-fallback-fields').body, { 'content-type': 'application/json', 'idempotency-key': 'origin-fallback-fields' });
  assert.equal(fallback.status, 202, JSON.stringify(fallback.body));
  const fallbackJob = await api.request('GET', `${pathName}/${fallback.body.data.jobId}${query}`);
  assert.equal(fallbackJob.body.data.document.origin.path, 'docs/doc-1.md');
  assert.equal(fallbackJob.body.data.document.origin.commitId, 'commit-1');
  assert.equal(fallbackJob.body.data.document.origin.blobId, 'blob-1');
  assert.equal(calls, 3);

  const configWithoutMapping = gitlabConnector.readConfig(gitlabConfigPath);
  gitlabConnector.writeConfig({ ...configWithoutMapping, mappings: [] }, gitlabConfigPath);
  const legacyBlank = await api.request('POST', pathName, json({ ...payload, originSnapshot: undefined }, 'legacy-blank-origin').body, { 'content-type': 'application/json', 'idempotency-key': 'legacy-blank-origin' });
  assert.equal(legacyBlank.status, 202, JSON.stringify(legacyBlank.body));
  const legacyBlankJob = await api.request('GET', `${pathName}/${legacyBlank.body.data.jobId}${query}`);
  assert.equal(legacyBlankJob.body.data.document.origin.originType, 'blank');
  assert.equal(legacyBlankJob.body.data.document.origin.contentDigest, crypto.createHash('sha256').update('').digest('hex'));

  const explicitBlank = await api.request('POST', pathName, json({ ...payload, originSnapshot: { originType: 'blank', contentDigest: crypto.createHash('sha256').update('').digest('hex'), handbookId: 'HB-1', documentId: 'doc-1' } }, 'explicit-blank-origin').body, { 'content-type': 'application/json', 'idempotency-key': 'explicit-blank-origin' });
  assert.equal(explicitBlank.status, 202, JSON.stringify(explicitBlank.body));
  const explicitBlankJob = await api.request('GET', `${pathName}/${explicitBlank.body.data.jobId}${query}`);
  assert.equal(explicitBlankJob.body.data.document.origin.originType, 'blank');
  assert.equal(calls, 5);
});

test('已映射手册中的未映射文档可基于平台正文生成，不强制匹配仓库文件', async t => {
  const previousAllowedHosts = process.env.KNOWLEDGE_CENTER_GITLAB_ALLOWED_HOSTS;
  process.env.KNOWLEDGE_CENTER_GITLAB_ALLOWED_HOSTS = '127.0.0.1';
  t.after(() => {
    if (previousAllowedHosts === undefined) delete process.env.KNOWLEDGE_CENTER_GITLAB_ALLOWED_HOSTS;
    else process.env.KNOWLEDGE_CENTER_GITLAB_ALLOWED_HOSTS = previousAllowedHosts;
  });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'production-ai-platform-origin-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const gitlabConfigPath = path.join(root, 'gitlab.json');
  const connector = require('../../../packages/agent-runner-core/lib/gitlab-connector');
  const connection = connector.upsertConnection({
    name: 'platform-origin-test', baseUrl: 'http://127.0.0.1:9', projectPath: 'fixture/project',
    defaultBranch: 'main', mode: 'sandbox', authMode: 'service_account', credentialRef: 'PLATFORM_ORIGIN_TEST', purpose: 'read',
  }, gitlabConfigPath);
  connector.upsertMapping('HB-1', { connectionId: connection.id, defaultBranch: 'main', enabledBranches: ['main'], zhPaths: ['docs'], enPaths: [] }, gitlabConfigPath);
  let generateCalls = 0;
  const api = await setup(t, { gitlabConfigPath, ai: { generate: async () => { generateCalls++; return { content: '平台正文候选', model: 'fixture' }; } } });
  const markdown = '# 平台新建文档\n\n正文来自知识中心草稿。';
  const contentDigest = crypto.createHash('sha256').update(markdown).digest('hex');
  const input = json({ outlineVersionId: 'outline-v1', branch: 'main', operation: 'polish', markdown,
    editVersion: 0, range: { start: 0, end: markdown.length },
    originSnapshot: { originType: 'platform', contentDigest, handbookId: 'HB-1', documentId: 'doc-1', branch: 'main' },
  }, 'platform-origin-mapped-handbook');
  const stale = json({ ...JSON.parse(input.body), originSnapshot: { ...JSON.parse(input.body).originSnapshot, contentDigest: '0'.repeat(64) } }, 'platform-origin-stale');
  const rejected = await api.request('POST', '/handbooks/HB-1/documents/doc-1/ai-jobs', stale.body, stale.headers);
  assert.equal(rejected.status, 409);
  assert.equal(rejected.body.error.code, 'AI_ORIGIN_SNAPSHOT_INVALID');
  assert.equal(generateCalls, 0);
  const created = await api.request('POST', '/handbooks/HB-1/documents/doc-1/ai-jobs', input.body, input.headers);
  assert.equal(created.status, 202, JSON.stringify(created.body));
  const jobId = created.body.data.jobId;
  const result = await api.request('GET', `/handbooks/HB-1/documents/doc-1/ai-jobs/${jobId}${query}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.document.origin.originType, 'platform');
  assert.equal(result.body.data.document.origin.contentDigest, contentDigest);
  assert.equal(generateCalls, 1);
});

test('测试用例库引用经生成采用与质量 HTTP 关联到正文位置，人工修改后旧来源失效', async t => {
  const storageUrl = process.env.PRODUCTION_QUALITY_REAL_STORAGE_URL;
  const yashanDB = storageUrl
    ? require('../../../packages/agent-runner-core/lib/yashandb-quality-adapter').createYashanDBQualityAdapter({ baseUrl: storageUrl })
    : { version: 'isolated-test-version', environment: 'isolated-fixture', execute: async () => ({ columns: ['C1'], rows: [{ C1: 1 }], truncated: false }) };
  const api = await setup(t, { browser: true, yashanDB, ai: { generate: async messages => {
    const source = JSON.parse(messages.find(message => message.role === 'user').content).sources[0];
    const start = source.content.indexOf('SELECT'); const end = source.content.indexOf(';', start) + 1;
    const sql = source.content.slice(start, end);
    const markdown = '# 来源用例\n```sql\n' + sql + '\n```\n```json quality-expected\n{"rows":[{"C1":1}]}\n```\n';
    return { model: 'isolated-source-fixture', content: JSON.stringify({ markdown,
      provenance: [{ start: markdown.indexOf(sql), end: markdown.indexOf(sql) + sql.length, kind: 'direct_quote',
        evidence: [{ sourceId: source.sourceId, start, end }] }] }) };
  } } });
  const root = '/handbooks/HB-1/documents/doc-1';
  const ctx = { outlineVersionId: 'outline-v1', branch: 'main' };
  async function post(suffix, payload, key) {
    const input = json({ ...ctx, ...payload }, key); return api.request('POST', root + suffix, input.body, input.headers);
  }
  const preview = await post('/ai-sources', { sourceType: 'test-case-library', locator: 'ai-quality-smoke-select.sql' });
  assert.equal(preview.status, 201, JSON.stringify(preview.body));
  const request = { operation: 'update', markdown: '旧正文', editVersion: 0, range: { start: 0, end: 3 }, confirmedSourceIds: [preview.body.data.sourceId] };
  const created = await post('/ai-jobs', request, 'source-case-generate');
  assert.equal(created.status, 202, JSON.stringify(created.body));
  const jobId = created.body.data.jobId;
  const loaded = await api.request('GET', root + '/ai-jobs/' + jobId + query);
  assert.equal(loaded.body.data.status, 'completed');
  const adopted = await post(`/ai-jobs/${jobId}/adopt`, { ...request, originalMarkdown: request.markdown, markdown: loaded.body.data.candidateMarkdown });
  assert.equal(adopted.status, 200, JSON.stringify(adopted.body));
  const revision = adopted.body.data.draft.revision;
  const result = await post('/quality', { revisionId: revision.revisionId, markdown: revision.markdown,
    generationMetadata: { sourceSnapshots: [{ sourceId: 'forged' }] } }, 'source-case-quality');
  assert.equal(result.status, 201, JSON.stringify(result.body));
  const report = result.body.data;
  assert.equal(report.gate, 'passed');
  assert.equal(report.cases[0].comparison, 'matched');
  assert.equal(report.cases[0].references[0].sourceId, preview.body.data.sourceId);
  assert.equal(report.cases[0].references[0].locator, 'ai-quality-smoke-select.sql');
  assert.equal(report.cases[0].references[0].verification, 'text_matched');
  assert.equal(JSON.stringify(report).includes('forged'), false);
  const ref = report.cases[0].references[0];
  assert.equal(revision.markdown.slice(ref.documentRange.start, ref.documentRange.end), preview.body.data.content.slice(ref.sourceRange.start, ref.sourceRange.end));
  const browser = await require('playwright').chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage(); await page.goto(api.origin + '/browser-fixture');
  await page.evaluate(async ({ revision, ctx }) => {
    const { openProductionQualityDialog } = await import('/knowledge-center/modules/production/production-quality-dialog.js');
    openProductionQualityDialog({ context: { handbookId: 'HB-1', documentId: 'doc-1', ...ctx }, markdown: revision.markdown, revisionId: revision.revisionId, editVersion: 1 });
  }, { revision, ctx });
  await page.locator('[data-quality-run]').click();
  await page.waitForFunction(() => document.querySelector('[data-quality-report]')?.textContent.includes('测试用例库条目'));
  assert.match(await page.locator('[data-quality-report]').textContent(), /ai-quality-smoke-select.sql/);
  assert.match(await page.locator('[data-quality-report]').textContent(), /引用文本匹配/);
  const changedInput = json({ ...ctx, markdown: revision.markdown.replace('1 AS', '2 AS'), editVersion: 1 }, 'source-case-human-edit');
  const changed = await api.request('PUT', draftPath(), changedInput.body, changedInput.headers);
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  const next = changed.body.data.draft.revision;
  const retested = await post('/quality', { revisionId: next.revisionId, markdown: next.markdown, rerunOfReportId: report.reportId }, 'source-case-retest');
  assert.equal(retested.status, 201, JSON.stringify(retested.body));
  // Unchanged parts remain traceable, but the changed numeric value has no inherited evidence.
  const changedOffset = next.markdown.indexOf('2 AS');
  assert.equal(retested.body.data.cases[0].references.some(ref => ref.documentRange.start <= changedOffset && ref.documentRange.end > changedOffset), false);
  const reread = await api.request('GET', root + '/quality/' + report.reportId);
  assert.deepEqual(reread.body.data, report);
  const evidence = path.join(repositoryRoot, 'runtime/test-results/production-ai-quality/20261022/case-sources'); fs.mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: path.join(evidence, storageUrl ? 'real-database-report.png' : 'isolated-report.png'), fullPage: true });
  fs.writeFileSync(path.join(evidence, storageUrl ? 'real-http-report.json' : 'isolated-http-report.json'), JSON.stringify({ testedAt: new Date().toISOString(),
    realHTTP: true, realDatabase: Boolean(storageUrl), realModel: false, auth: 'isolated editor fixture', browser: 'Chromium',
    report, retested: retested.body.data }, null, 2));
});

test('AI HTTP requires write permission and explicit range', async t => {
  const reader = { ...editor, allowedActions: ['knowledge:read'] };
  const api = await setup(t, { session: reader, ai: { generate: async () => ({ content: '不应执行' }) } });
  const input = json({ outlineVersionId: 'outline-v1', branch: 'main', operation: 'polish', markdown: '原文', editVersion: 0, range: { start: 0, end: 2 } }, 'reader-denied');
  const denied = await api.request('POST', '/handbooks/HB-1/documents/doc-1/ai-jobs', input.body, input.headers);
  assert.equal(denied.status, 403, JSON.stringify(denied.body));
});

test('AI browser dialog uses real HTTP, preserves editor until adoption and reads saved human edits', async t => {
  const { chromium } = require('playwright');
  const api = await setup(t, { browser: true, ai: { generate: async () => ({ content: '浏览器候选', model: 'isolated-browser-model' }) } });
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${api.origin}/browser-fixture`);
  await page.evaluate(async () => {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet'; stylesheet.href = '/knowledge-center/modules/production/production.css'; document.head.append(stylesheet);
    const { openProductionAIDialog } = await import('/knowledge-center/modules/production/production-ai-dialog.js');
    window.editorMarkdown = '前文旧句后文';
    openProductionAIDialog({
      context: { handbookId: 'HB-1', documentId: 'doc-1', outlineVersionId: 'outline-v1', branch: 'main' },
      operation: 'polish', editVersion: 0, getMarkdown: () => window.editorMarkdown,
      baselineDigest: async () => '',
      onAdopt: result => { window.adoptedResult = result; window.editorMarkdown = result.draft.revision.markdown; },
    });
  });
  await page.locator('[data-ai-original]').evaluate(field => { field.focus(); field.setSelectionRange(2, 4); });
  // The current writing surface applies the selected polish range automatically.
  await page.locator('[data-ai-start]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-fragment]')?.value === '浏览器候选');
  assert.equal(await page.evaluate(() => window.editorMarkdown), '前文旧句后文');
  await page.locator('[data-ai-inline-editor]').fill('人工核对后的候选');
  const evidenceDir = path.join(repositoryRoot, 'runtime/test-results/production-ai-browser');
  fs.mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDir, 'candidate-human-edit.png'), fullPage: true });
  await page.locator('[data-ai-adopt]').click();
  await page.waitForFunction(() => !!window.adoptedResult);
  assert.equal(await page.evaluate(() => window.editorMarkdown), '前文人工核对后的候选后文\n');
  const saved = await api.request('GET', `${draftPath()}${query}`);
  assert.equal(saved.body.data.draft.revision.markdown, '前文人工核对后的候选后文\n');
  assert.equal(saved.body.data.draft.revision.generationMetadata.humanEdited, true);
  fs.writeFileSync(path.join(evidenceDir, 'result.json'), JSON.stringify({
    model: 'isolated-browser-model', realHTTP: true, candidateDidNotChangeEditor: true,
    savedMarkdown: saved.body.data.draft.revision.markdown, fullPlatformAcceptance: false,
  }, null, 2));
});

test('shared draft HTTP contract covers empty read, save, idempotency, conflict and restore', async t => {
  const api = await setup(t);
  const empty = await api.request('GET', `${draftPath()}${query}`);
  assert.equal(empty.status, 200);
  assert.equal(empty.body.data.exists, false);

  const payload = {
    outlineVersionId: 'outline-v1', branch: 'main', baselineDigest: 'baseline-a', editVersion: 0,
    markdown: '# 参数\n', htmlSnapshot: '<h1>参数</h1><script>alert(1)</script>', templateVersionId: 'template-v1', attachmentIds: [],
  };
  const firstInput = json(payload, 'save-1');
  const saved = await api.request('PUT', draftPath(), firstInput.body, firstInput.headers);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.data.draft.editVersion, 1);
  assert.doesNotMatch(saved.body.data.draft.revision.htmlSnapshot, /script/i);

  const replay = await api.request('PUT', draftPath(), firstInput.body, firstInput.headers);
  assert.equal(replay.body.data.draft.currentRevisionId, saved.body.data.draft.currentRevisionId);

  const conflictInput = json({ ...payload, markdown: '# 过期修改\n' }, 'save-stale');
  const conflict = await api.request('PUT', draftPath(), conflictInput.body, conflictInput.headers);
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, 'DRAFT_VERSION_CONFLICT');
  assert.equal(conflict.body.error.details.serverDraft.editVersion, 1);

  const history = await api.request('GET', `${draftPath('/revisions')}${query}`);
  assert.equal(history.body.data.items.length, 1);
  const restoreInput = json({ outlineVersionId: 'outline-v1', branch: 'main', editVersion: 1, revisionId: history.body.data.items[0].revisionId }, 'restore-1');
  const restored = await api.request('POST', draftPath('/restore'), restoreInput.body, restoreInput.headers);
  assert.equal(restored.status, 200);
  assert.equal(restored.body.data.draft.editVersion, 2);
  assert.equal(restored.body.data.draft.revision.restoredFromRevisionId, history.body.data.items[0].revisionId);
});

test('attachment and review batch HTTP contracts bind stable content and clone the work draft', async t => {
  const api = await setup(t);
  const attachment = await api.request('POST', `/handbooks/HB-1/documents/doc-1/draft-attachments${query}`, Buffer.from('image-bytes'), {
    'content-type': 'image/png',
    'x-file-name': encodeURIComponent('图片.png'),
  });
  assert.equal(attachment.status, 201, JSON.stringify(attachment.body));
  assert.equal(attachment.body.data.scanStatus, 'validated');

  const saveInput = json({
    outlineVersionId: 'outline-v1', branch: 'main', baselineDigest: 'baseline-a', editVersion: 0,
    markdown: `# 文档\n\n![图片](${attachment.body.data.stableReference})\n`, htmlSnapshot: '<h1>文档</h1>',
    attachmentIds: [attachment.body.data.attachmentId],
  }, 'save-with-attachment');
  const saved = await api.request('PUT', draftPath(), saveInput.body, saveInput.headers);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const binary = await api.request('GET', attachment.body.data.stableReference.replace('/knowledge-center/api/production', ''));
  assert.equal(binary.status, 200);
  assert.deepEqual(binary.body, Buffer.from('image-bytes'));

  const reviewers = await api.request('GET', '/handbooks/HB-1/reviewers');
  assert.equal(reviewers.status, 200);
  assert.deepEqual(reviewers.body.data.items.map(item => item.id), ['reviewer-1']);

  const batchInput = json({
    documents: [{ documentId: 'doc-1', outlineVersionId: 'outline-v1', branch: 'main', draftRevisionId: saved.body.data.draft.currentRevisionId, reviewerIds: ['reviewer-1'] }],
  }, 'batch-1');
  const batch = await api.request('POST', '/handbooks/HB-1/review-batches', batchInput.body, batchInput.headers);
  assert.equal(batch.status, 201, JSON.stringify(batch.body));
  assert.equal(batch.body.data.documents[0].state, 'pending');

  const current = await api.request('GET', `${draftPath()}${query}`);
  assert.equal(current.body.data.draft.editVersion, 2);
  assert.equal(current.body.data.draft.reviewState.revisionId, saved.body.data.draft.currentRevisionId);
  assert.equal(current.body.data.draft.revision.clonedFromRevisionId, saved.body.data.draft.currentRevisionId);
});

test('AI source HTTP freezes confirmed URL and MCP snapshots and rejects cross-document or failed reads', async t => {
  const receivedTools = [];
  let sourceText = '# 引用资料\n参数值为 42。';
  let modelCalls = 0;
  const sourceServer = http.createServer(async (req, res) => {
    if (req.url === '/mcp') {
      let text = ''; for await (const chunk of req) text += chunk;
      const message = JSON.parse(text);
      if (message.method === 'notifications/initialized') { res.writeHead(202); res.end(); return; }
      let result = { serverInfo: { name: 'isolated-mcp', version: '1' }, capabilities: {} };
      if (message.method === 'tools/call') {
        receivedTools.push(message.params);
        result = message.params.name === 'search_ku' ? { structuredContent: { results: [] } } : message.params.arguments.ku_name === 'unavailable'
          ? { isError: true, content: [{ type: 'text', text: 'secret-provider-detail' }] }
          : { content: [{ type: 'text', text: '知识库原文，参数值 42。' }] };
      }
      res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result })); return;
    }
    if (req.url === '/redirect') { res.writeHead(302, { location: '/document' }); res.end(); return; }
    if (req.url === '/missing') { res.writeHead(404); res.end('secret-error-body'); return; }
    if (req.url === '/html') { res.setHeader('content-type', 'text/html'); res.end('<h1>不可冒充已解析正文</h1>'); return; }
    res.setHeader('content-type', 'text/markdown'); res.end(sourceText);
  });
  await new Promise(resolve => sourceServer.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { sourceServer.close(resolve); sourceServer.closeAllConnections(); }));
  const sourceOrigin = `http://127.0.0.1:${sourceServer.address().port}`;
  const webOrigin = 'http://public.example';
  const rules = structuredClone(require('../../../config/knowledge-center/content-rules.json').productionAI);
  rules.sources.urlOrigins = [webOrigin];
  rules.sources.allowPublicWeb = false;
  rules.sources.lookup = async () => [{ address: '1.1.1.1', family: 4 }];
  rules.sources.receive = (url, _address, signal) => new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port: sourceServer.address().port, path: url.pathname, signal }, resolve);
    request.on('error', reject);
  });
  let modelPayload;
  const api = await setup(t, { browser: true, ai: { rules,
    loadMCPConfig: async () => ({ server_url: `${sourceOrigin}/mcp` }),
    generate: async messages => { modelCalls++; modelPayload = JSON.parse(messages[1].content); return { content: '参考资料说明参数为 42。' }; },
  } });
  const ctx = { outlineVersionId: 'outline-v1', branch: 'main' };
  const sourcesPath = '/handbooks/HB-1/documents/doc-1/ai-sources';
  const aiPath = '/handbooks/HB-1/documents/doc-1/ai-jobs';
  async function post(suffix, value, key) { const input = json({ ...ctx, ...value }, key); return api.request('POST', suffix, input.body, input.headers); }
  const available = await api.request('GET', `${sourcesPath}${query}`);
  assert.equal(available.status, 200, JSON.stringify(available.body));
  assert.deepEqual(available.body.data.items.map(item => item.available), [true, false, false, true, true, true]);
  assert.equal(available.body.data.items.find(item => item.sourceType === 'test-case-library').available, true);
  const preview = await post(sourcesPath, { sourceType: 'url', locator: `${webOrigin}/document` });
  assert.equal(preview.status, 201, JSON.stringify(preview.body));
  assert.equal(preview.body.data.content, '# 引用资料\n参数值为 42。');
  const mcp = await post(sourcesPath, { sourceType: 'knowledge-mcp', locator: '参数说明' });
  assert.equal(mcp.status, 201, JSON.stringify(mcp.body));
  assert.equal(receivedTools[0].name, 'get_ku_detail');
  assert.equal(receivedTools[0].arguments.ku_name, '参数说明');
  const testCase = await post(sourcesPath, { sourceType: 'test-case-library', locator: 'ai-quality-smoke-select.sql' });
  assert.equal(testCase.status, 201, JSON.stringify(testCase.body));
  assert.match(testCase.body.data.content, /SELECT 1 AS C1 FROM DUAL/i);
  const confirmedSourceIds = [preview.body.data.sourceId, mcp.body.data.sourceId, testCase.body.data.sourceId];
  const generation = { operation: 'update', markdown: '旧说明', editVersion: 0, range: { start: 0, end: 3 }, confirmedSourceIds };
  const created = await post(aiPath, generation, 'confirmed');
  assert.equal(created.status, 202, JSON.stringify(created.body));
  const waitForJob = async id => {
    for (let i = 0; i < 100; i++) {
      const result = await api.request('GET', `${aiPath}/${id}${query}`);
      if (!['queued', 'running'].includes(result.body.data.status)) return result;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.fail('AI job did not finish');
  };
  const candidate = await waitForJob(created.body.data.jobId);
  assert.equal(candidate.body.data.status, 'completed');
  assert.equal(modelPayload.sources.length, 3);
  assert.equal(modelPayload.sources[0].contentDigest, preview.body.data.contentDigest);
  assert.equal(candidate.body.data.metadata.sourceSnapshots[1].content, '知识库原文，参数值 42。');
  sourceText = '# 引用资料\n参数值更新为 43。';
  const refreshed = await post(sourcesPath, { sourceType: 'url', locator: `${webOrigin}/document#fragment` });
  assert.equal(refreshed.status, 201);
  assert.equal(refreshed.body.data.locator, preview.body.data.locator);
  const callsBeforeConflict = modelCalls;
  const conflict = await post(aiPath, { ...generation, confirmedSourceIds: [preview.body.data.sourceId, refreshed.body.data.sourceId] }, 'source-version-conflict');
  assert.equal(conflict.status, 409, JSON.stringify(conflict.body));
  assert.equal(conflict.body.error.code, 'AI_SOURCE_VERSION_CONFLICT');
  assert.equal(modelCalls, callsBeforeConflict);
  const newest = await post(aiPath, { ...generation, confirmedSourceIds: [refreshed.body.data.sourceId] }, 'source-version-selected');
  assert.equal(newest.status, 202, JSON.stringify(newest.body));
  assert.equal((await waitForJob(newest.body.data.jobId)).body.data.status, 'completed');
  assert.equal(modelPayload.sources[0].content, sourceText);
  const originalJob = await api.request('GET', `${aiPath}/${created.body.data.jobId}${query}`);
  assert.equal(originalJob.body.data.sourceSnapshots[0].content, '# 引用资料\n参数值为 42。');
  sourceText = '# 引用资料\n参数值为 42。';
  // Having sources is not proof that the generated text is a direct quotation.
  assert.equal(candidate.body.data.metadata.provenance[0].kind, 'model_inference');
  assert.equal((await post(aiPath.replace('/doc-1/', '/other/'), generation, 'cross-context')).status, 404);
  assert.equal((await post(aiPath, { ...generation, confirmedSourceIds: ['client-invented-source'] }, 'invented')).status, 404);
  assert.equal((await post(sourcesPath, { sourceType: 'url', locator: 'http://unconfigured.invalid/document' })).status, 403);
  for (const pathname of ['/redirect', '/html']) {
    const parsed = await post(sourcesPath, { sourceType: 'url', locator: `${webOrigin}${pathname}` });
    assert.equal(parsed.status, 201, JSON.stringify(parsed.body));
    assert.ok(parsed.body.data.content.trim());
  }
  for (const pathname of ['/missing']) {
    const failed = await post(sourcesPath, { sourceType: 'url', locator: `${webOrigin}${pathname}` });
    assert.ok(failed.status >= 400, pathname);
    assert.ok(!JSON.stringify(failed.body).includes('secret-error-body'));
  }
  const failedMCP = await post(sourcesPath, { sourceType: 'knowledge-mcp', locator: 'unavailable' });
  assert.equal(failedMCP.status, 502);
  assert.ok(!JSON.stringify(failedMCP.body).includes('secret-provider-detail'));
  const reportRoot = path.join(repositoryRoot, 'runtime/test-results/production-ai-sources');
  fs.mkdirSync(reportRoot, { recursive: true });
  const browser = await require('playwright').chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto(`${api.origin}/browser-fixture`);
  await page.evaluate(async () => {
    const { openProductionAIDialog } = await import('/knowledge-center/modules/production/production-ai-dialog.js');
    const stylesheet = document.createElement('link'); stylesheet.rel = 'stylesheet';
    stylesheet.href = '/knowledge-center/modules/production/production.css'; document.head.append(stylesheet);
    openProductionAIDialog({ context: { handbookId: 'HB-1', documentId: 'doc-1', outlineVersionId: 'outline-v1', branch: 'main' },
      operation: 'update', editVersion: 0, getMarkdown: () => '旧说明', baselineDigest: async () => '', onAdopt() {} });
  });
  await page.locator('[data-ai-source-add]').click();
  await page.locator('[data-ai-source-locator]').fill(`${webOrigin}/document`);
  await page.locator('[data-ai-source-preview]').click();
  await page.locator('[data-ai-source-list] [data-source-id]:not([data-source-id="knowledge-mcp"]) input[type="checkbox"]').waitFor({ state: 'attached' });
  assert.equal(await page.locator('[data-ai-source-list] [data-source-id]:not([data-source-id="knowledge-mcp"]) input[type="checkbox"]').isChecked(), true);
  assert.equal(await page.locator('[data-ai-source-list] [data-source-id]:not([data-source-id="knowledge-mcp"]) input[type="checkbox"]').isChecked(), true);
  await page.getByRole('button', { name: '关闭添加参考文档' }).click();
  // Update defaults to the whole document unless an inline range is selected.
  await page.locator('[data-ai-start]').click();
  await page.locator('[data-ai-candidate]').waitFor({ state: 'visible' });
  assert.equal(modelPayload.sources.length, 1);
  assert.equal(modelPayload.sources[0].content, '# 引用资料\n参数值为 42。');
  await page.locator('.handbook-writing-page').scrollIntoViewIfNeeded();
  const bounds = await page.locator('.handbook-writing-page').boundingBox();
  assert.ok(bounds && bounds.y < 1000 && bounds.y + bounds.height > 0 && bounds.height > 0 && bounds.width > 0, '沉浸式写作页应在视口中可见');
  await page.locator('.handbook-writing-page').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: path.join(reportRoot, 'source-confirmation.png'), fullPage: true });
  fs.writeFileSync(path.join(reportRoot, 'result.json'), JSON.stringify({
    realHTTP: true, sourceProvider: 'isolated-http-and-mcp-fixtures', realExternalIntegration: false,
    confirmedSnapshotCount: 2, browserExplicitConfirmation: true, sourceDigest: preview.body.data.contentDigest,
    checked: ['MCP initialization and document tool', 'URL preview', 'confirmed snapshots reach model', 'source metadata', 'cross-context denial', 'unknown ID denial', 'origin denial', 'redirect denial', 'HTTP failure', 'format failure', 'MCP isError'],
  }, null, 2));
});

test('AI Skill browser selection reaches backend execution and persists frozen capability metadata', async t => {
  const { chromium } = require('playwright');
  const received = [];
  const api = await setup(t, { browser: true, ai: { generate: async messages => {
    received.push(messages);
    const usesSkill = messages.some(message => message.role === 'system' && message.content.includes('技术文档续写'));
    return { content: usesSkill ? '补充：示例需在授权测试库中验证。' : '普通新增内容', model: 'isolated-skill-model' };
  } } });
  const root = '/handbooks/HB-1/documents/doc-1';
  const listed = await api.request('GET', `${root}/ai-skills${query}`);
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  const skill = listed.body.data.items.find(item => item.skillId === 'continue-technical-document');
  assert.ok(skill?.contentDigest);
  assert.equal(JSON.stringify(listed.body).includes(repositoryRoot), false);
  const invalid = json({ outlineVersionId: 'outline-v1', branch: 'main', operation: 'continue', markdown: '前文后文', editVersion: 0, range: { start: 2, end: 2 }, selectedSkills: [{ skillId: skill.skillId, contentDigest: 'stale' }] }, 'stale-skill');
  assert.equal((await api.request('POST', `${root}/ai-jobs`, invalid.body, invalid.headers)).status, 409);
  assert.equal(received.length, 0);
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${api.origin}/browser-fixture`);
  await page.evaluate(async () => {
    const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/knowledge-center/modules/production/production.css'; document.head.append(style);
    const { openProductionAIDialog } = await import('/knowledge-center/modules/production/production-ai-dialog.js');
    window.editorMarkdown = '前文后文';
    openProductionAIDialog({ context: { handbookId: 'HB-1', documentId: 'doc-1', outlineVersionId: 'outline-v1', branch: 'main' }, operation: 'continue', editVersion: 0,
      getMarkdown: () => window.editorMarkdown, baselineDigest: async () => '',
      onAdopt: result => { window.adoptedResult = result; window.editorMarkdown = result.draft.revision.markdown; } });
  });
  await page.locator('[data-ai-skills-open]').waitFor({ state: 'visible' });
  await page.locator('[data-ai-skills-open]').click();
  const checkbox = page.locator('[data-ai-skill-list] input');
  await checkbox.waitFor({ state: 'attached' });
  if (!await page.locator('[data-ai-skills]').evaluate(node => node.open)) await page.locator('[data-ai-skills] > summary').click(); assert.equal(await checkbox.isChecked(), false);
  await page.locator('[data-ai-picker-details]').click();
  await page.locator('[data-ai-skill-list] summary').click();
  assert.match(await page.locator('[aria-label="续写能力指令预览"]').inputValue(), /技术文档续写/);
  await checkbox.check();
  await page.locator('[data-ai-settings-apply]').click();
  await page.locator('[data-ai-original]').evaluate(field => { field.focus(); field.setSelectionRange(2, 2); });
  await page.locator('[data-ai-start]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-fragment]')?.value === '补充：示例需在授权测试库中验证。');
  assert.equal(await page.evaluate(() => window.editorMarkdown), '前文后文');
  assert.equal(received.length, 1);
  assert.equal(received[0].filter(message => message.role === 'system').length, 2);
  const evidenceDir = path.join(repositoryRoot, 'runtime/test-results/production-ai-skills'); fs.mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDir, 'skill-selection.png'), fullPage: true });
  await page.locator('[data-ai-candidate]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidenceDir, 'skill-continuation.png'), fullPage: true });
  await page.locator('[data-ai-adopt]').click(); await page.waitForFunction(() => !!window.adoptedResult);
  const saved = await api.request('GET', `${draftPath()}${query}`);
  assert.equal(saved.body.data.draft.revision.markdown, '前文补充：示例需在授权测试库中验证。后文\n');
  const metadata = saved.body.data.draft.revision.generationMetadata;
  assert.equal(metadata.skillVersions[0].contentDigest, skill.contentDigest);
  assert.equal(metadata.skillVersions[0].content, skill.content);
  fs.writeFileSync(path.join(evidenceDir, 'result.json'), JSON.stringify({ realHTTP: true, browser: 'Chromium', skill: metadata.skillVersions[0], savedMarkdown: saved.body.data.draft.revision.markdown, realModel: false, fullPlatformAcceptance: false }, null, 2));
});

test('PingCode design and test sources use fixed service, accessible spaces and confirmed snapshots', async t => {
  const paths = [];
  const sourceServer = http.createServer((req, res) => {
    paths.push(req.url);
    res.setHeader('content-type', 'application/json');
    const pageId = req.url.split('/')[6];
    const spaceKey = req.url.split('/')[4];
    if (spaceKey === 'denied') { res.writeHead(403); res.end('secret-provider-detail'); return; }
    if (pageId === 'missing') { res.writeHead(404); res.end('secret-provider-detail'); return; }
    res.end(JSON.stringify({
      content: pageId === 'large' ? '字'.repeat(600) : `# ${pageId}\n已授权的文档正文。`,
      title: `文档 ${pageId}`, spaceKey, pageId: pageId === 'wrong' ? 'other' : pageId,
      sourceVersion: 'v7', originalUrl: `https://pingcode.example/wiki/spaces/${spaceKey}/pages/${pageId}`,
    }));
  });
  await new Promise(resolve => sourceServer.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { sourceServer.close(resolve); sourceServer.closeAllConnections(); }));
  const rules = structuredClone(require('../../../config/knowledge-center/content-rules.json').productionAI);
  rules.sources.pingcodeSpaces = ['space1']; rules.sources.maxBytes = 512;
  rules.sources.urlOrigins = ['https://pingcode.example']; rules.sources.pingcodeOrigins = ['https://pingcode.example'];
  let modelPayload;
  const api = await setup(t, { browser: true, ai: { rules,
    pingcodeBaseURL: `http://127.0.0.1:${sourceServer.address().port}`,
    generate: async messages => { modelPayload = JSON.parse(messages[1].content); return { content: '结合设计与测试资料修订。' }; },
  } });
  const ctx = { outlineVersionId: 'outline-v1', branch: 'main' };
  const sourcesPath = '/handbooks/HB-1/documents/doc-1/ai-sources';
  async function post(value) { const input = json({ ...ctx, ...value }); return api.request('POST', sourcesPath, input.body, input.headers); }
  const catalog = await api.request('GET', `${sourcesPath}${query}`);
  assert.deepEqual(catalog.body.data.items.filter(item => item.sourceType.startsWith('pingcode-')).map(item => item.available), [true, true]);
  const design = await post({ sourceType: 'pingcode-design', locator: 'space1/design1' });
  const testDoc = await post({ sourceType: 'pingcode-test', locator: 'space1/test1' });
  assert.equal(design.status, 201, JSON.stringify(design.body));
  assert.equal(testDoc.status, 201, JSON.stringify(testDoc.body));
  assert.equal(design.body.data.sourceVersion, 'v7');
  assert.equal(testDoc.body.data.pageId, 'test1');
  const urlDoc = await post({ sourceType: 'url', locator: 'https://pingcode.example/wiki/spaces/space1/pages/design1' });
  assert.equal(urlDoc.status, 201);
  assert.equal(urlDoc.body.data.sourceType, 'url');
  assert.equal(urlDoc.body.data.content, design.body.data.content);
  const otherUrl = await post({ sourceType: 'url', locator: 'https://pingcode.example/wiki/spaces/other/pages/design1' });
  assert.equal(otherUrl.status, 201, JSON.stringify(otherUrl.body));
  assert.equal(otherUrl.body.data.spaceKey, 'other');
  const otherDesign = await post({ sourceType: 'pingcode-design', locator: 'other/design1' });
  assert.equal(otherDesign.status, 201, JSON.stringify(otherDesign.body));
  assert.equal(otherDesign.body.data.spaceKey, 'other');
  assert.equal((await post({ sourceType: 'url', locator: 'https://pingcode.example/other' })).status, 403);
  assert.equal((await post({ sourceType: 'url', locator: 'https://pingcode.example/wiki/spaces/space1/pages/design1?ticket=x' })).status, 403);
  const before = paths.length;
  assert.equal((await post({ sourceType: 'pingcode-design', locator: 'space1/../page' })).status, 400);
  assert.equal(paths.length, before, '非法路径不能进入资料服务');
  const denied = await post({ sourceType: 'pingcode-design', locator: 'denied/design1' });
  assert.equal(denied.status, 502);
  assert.ok(!JSON.stringify(denied.body).includes('secret-provider-detail'));
  for (const [pageId, status] of [['missing', 502], ['wrong', 502], ['large', 413]]) {
    const result = await post({ sourceType: 'pingcode-design', locator: `space1/${pageId}` });
    assert.equal(result.status, status, JSON.stringify(result.body));
    assert.ok(!JSON.stringify(result.body).includes('secret-provider-detail'));
  }
  const generation = json({ ...ctx, operation: 'update', markdown: '旧说明', editVersion: 0, range: { start: 0, end: 3 }, confirmedSourceIds: [design.body.data.sourceId, testDoc.body.data.sourceId] }, 'pingcode-sources');
  const created = await api.request('POST', '/handbooks/HB-1/documents/doc-1/ai-jobs', generation.body, generation.headers);
  assert.equal(created.status, 202, JSON.stringify(created.body));
  assert.deepEqual(modelPayload.sources.map(item => item.sourceType), ['pingcode-design', 'pingcode-test']);
  assert.equal(modelPayload.sources[0].content, design.body.data.content);
  assert.ok(paths.every(value => /^\/api\/pingcode\/spaces\/(space1|other|denied)\/pages\/[A-Za-z0-9_-]+\/reference\?include_images=true$/.test(value)));
  const browser = await require('playwright').chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto(`${api.origin}/browser-fixture`);
  await page.evaluate(async () => {
    const { openProductionAIDialog } = await import('/knowledge-center/modules/production/production-ai-dialog.js');
    const stylesheet = document.createElement('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = '/knowledge-center/modules/production/production.css'; document.head.append(stylesheet);
    openProductionAIDialog({ context: { handbookId: 'HB-1', documentId: 'doc-1', outlineVersionId: 'outline-v1', branch: 'main' }, operation: 'update', editVersion: 0, getMarkdown: () => '旧说明', baselineDigest: async () => '', onAdopt() {} });
  });
  await page.locator('[data-ai-source-type] option[value="pingcode-design"]').waitFor({ state: 'attached' });
  await page.locator('[data-ai-source-add]').click();
  await page.locator('[data-reference-type="pingcode-design"]').click();
  await page.evaluate(() => {
    window.permissionDeniedCount = 0;
    window.addEventListener('knowledge-center:permission-denied', () => window.permissionDeniedCount++);
  });
  assert.equal(await page.locator('[data-ai-source-locator]').getAttribute('placeholder'), 'PingCode 页面网址或空间标识/页面ID');
  assert.match(await page.locator('[data-ai-source-info]').textContent(), /当前账号有权访问的空间页面/);
  await page.locator('[data-ai-source-locator]').fill('design1');
  await page.locator('[data-ai-source-preview]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-source-info]').textContent.includes('资料读取失败'));
  assert.match(await page.locator('[data-ai-source-info]').textContent(), /空间标识\/页面ID/);
  assert.equal(await page.locator('[data-ai-execution]').isVisible(), false);
  await page.locator('[data-ai-source-locator]').fill('denied/design1');
  await page.locator('[data-ai-source-preview]').click();
  await page.waitForFunction(() => document.querySelector('[data-ai-source-info]').textContent.includes('资料读取失败'));
  assert.equal(await page.evaluate(() => window.permissionDeniedCount), 0, '远端资料拒绝不能误报平台账号权限');
  assert.equal(await page.locator('[data-ai-execution]').isVisible(), false);
  await page.locator('[data-ai-source-locator]').fill('space1/design1');
  await page.locator('[data-ai-source-preview]').click();
  await page.locator('[data-ai-source-list] [data-source-id]:not([data-source-id="knowledge-mcp"]) input[type="checkbox"]').waitFor({ state: 'attached' });
  assert.match(await page.locator('[data-ai-source-info]').textContent(), /资料已添加/);
  await page.getByRole('button', { name: '关闭添加参考文档' }).click();
  const expandSources = page.locator('[data-ai-references-toggle]');
  if (await expandSources.isVisible()) await expandSources.click();
  const previewButton = page.locator('[data-ai-source-list] [data-source-id]:not([data-source-id="knowledge-mcp"]) button[aria-label^="预览资料："]');
  const popupPromise = page.waitForEvent('popup');
  await previewButton.evaluate(button => button.click());
  const previewPage = await popupPromise;
  await previewPage.waitForLoadState();
  assert.match(await previewPage.locator('body').textContent(), /已授权的文档正文/);
  await previewPage.close();
  assert.equal(await page.locator('[data-ai-source-list] [data-source-id]:not([data-source-id="knowledge-mcp"]) input[type="checkbox"]').isChecked(), true);
  // Update defaults to the whole document unless an inline range is selected.
  await page.locator('[data-ai-start]').click();
  await page.locator('[data-ai-candidate]').waitFor({ state: 'visible' });
  assert.equal(modelPayload.sources[0].sourceType, 'pingcode-design');
  const reportRoot = path.join(repositoryRoot, 'runtime/test-results/production-ai-pingcode');
  fs.mkdirSync(reportRoot, { recursive: true });
  await page.screenshot({ path: path.join(reportRoot, 'source-preview.png'), fullPage: true });
  fs.writeFileSync(path.join(reportRoot, 'result.json'), JSON.stringify({ realHTTP: true, realBrowser: true, realExternalPingCode: false,
    sourceTypes: ['pingcode-design', 'pingcode-test'], checked: ['fixed service path', 'accessible spaces', 'remote access denied', 'invalid locator', 'failed read', 'page mismatch', 'content size limit', 'frozen model sources', 'browser preview and explicit confirmation'],
  }, null, 2));
});

test('混合元信息经真实 HTTP 与浏览器预览、人工采用、再次生成及保存保留证据', { timeout: 90000 }, async t => {
  const sourceText = '引用原句。参数为42。';
  const sourceServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(sourceText);
  });
  await new Promise(resolve => sourceServer.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { sourceServer.close(resolve); sourceServer.closeAllConnections(); }));
  const sourceOrigin = `http://127.0.0.1:${sourceServer.address().port}`;
  const webOrigin = 'http://public.example';
  const rules = structuredClone(require('../../../config/knowledge-center/content-rules.json').productionAI);
  rules.sources.urlOrigins = [webOrigin];
  rules.sources.allowPublicWeb = false;
  rules.sources.lookup = async () => [{ address: '1.1.1.1', family: 4 }];
  rules.sources.receive = (url, _address, signal) => new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port: sourceServer.address().port, path: url.pathname, signal }, resolve);
    request.on('error', reject);
  });
  let calls = 0;
  const api = await setup(t, { browser: true, ai: { rules, generate: async messages => {
    calls++;
    if (calls > 1) return { content: '再次补充。', model: 'isolated-provenance-fixture' };
    const payload = JSON.parse(messages.find(message => message.role === 'user').content);
    const sourceId = payload.sources[0].sourceId;
    return { model: 'isolated-provenance-fixture', content: JSON.stringify({ markdown: '引用原句。归纳参数。推理内容。', provenance: [
      { start: 0, end: 5, kind: 'direct_quote', evidence: [{ sourceId, start: 0, end: 5 }] },
      { start: 5, end: 10, kind: 'source_summary', evidence: [{ sourceId, start: 5, end: 11 }] },
    ] }) };
  } } });
  const browser = await require('playwright').chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  await page.goto(`${api.origin}/browser-fixture`);
  await page.evaluate(async () => {
    const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/knowledge-center/modules/production/production.css'; document.head.append(style);
    const { openProductionAIDialog } = await import('/knowledge-center/modules/production/production-ai-dialog.js');
    openProductionAIDialog({ context: { handbookId: 'HB-1', documentId: 'doc-1', outlineVersionId: 'outline-v1', branch: 'main' }, operation: 'update', editVersion: 0,
      getMarkdown: () => '旧说明', baselineDigest: async () => '', onAdopt: result => { window.adoptedResult = result; } });
  });
  await page.locator('[data-ai-source-add]').click();
  await page.locator('[data-ai-source-locator]').fill(`${webOrigin}/reference.md`);
  await page.locator('[data-ai-source-preview]').click();
  assert.equal(await page.locator('[data-ai-source-list] [data-source-id]:not([data-source-id="knowledge-mcp"]) input[type="checkbox"]').isChecked(), true);
  await page.getByRole('button', { name: '关闭添加参考文档' }).click();
  // Update defaults to the whole document unless an inline range is selected.
  await page.locator('[data-ai-start]').click();
  await page.locator('[data-ai-provenance]').waitFor();
  await page.locator('[data-ai-provenance] > summary').click();
  const provenanceText = await page.locator('[data-ai-provenance]').textContent();
  for (const expected of ['直接引用', '依据资料归纳', '模型推理', '文本对应，事实仍待核验', '参数为42。']) assert.ok(provenanceText.includes(expected), expected);
  await page.locator('[data-ai-provenance] li details > summary').first().click();
  const evidenceDir = path.join(repositoryRoot, 'runtime/test-results/production-ai-provenance'); fs.mkdirSync(evidenceDir, { recursive: true });
  await page.locator('[data-ai-provenance]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidenceDir, 'candidate-provenance.png'), fullPage: true });
  await page.locator('[data-ai-inline-editor]').fill('引用原句。归纳参数。人工补充。');
  await page.locator('[data-ai-adopt]').click(); await page.waitForFunction(() => !!window.adoptedResult);
  const saved = await api.request('GET', `${draftPath()}${query}`);
  const revision = saved.body.data.draft.revision;
  assert.equal(revision.markdown, '引用原句。归纳参数。人工补充。\n');
  const metadata = revision.generationMetadata;
  assert.deepEqual(metadata.provenance.slice(0, 3).map(item => item.kind), ['direct_quote', 'source_summary', 'human_edit']);
  assert.equal(metadata.verification, 'needs_revalidation');
  assert.equal(metadata.sourceSnapshots[0].content, sourceText);
  assert.equal(metadata.provenanceHistory.length, 1);
  for (const span of metadata.provenance) assert.ok(span.start >= 0 && span.end <= revision.markdown.length);
  await page.evaluate(async revision => {
    document.querySelector('dialog')?.remove();
    const { renderProductionProvenance } = await import('/knowledge-center/modules/production/production-provenance.js');
    document.body.innerHTML = renderProductionProvenance(revision.generationMetadata, revision.markdown, '已保存版本的内容依据');
  }, revision);
  await page.locator('[data-ai-provenance] > summary').click();
  assert.match(await page.locator('[data-ai-provenance]').textContent(), /人工修改/);
  await page.screenshot({ path: path.join(evidenceDir, 'saved-provenance.png'), fullPage: true });
  // Generate from unsaved editor changes: unaffected quote and summary must survive.
  const original = revision.markdown.replace('人工补充', '人工新补充');
  const input = json({ outlineVersionId: 'outline-v1', branch: 'main', operation: 'continue', markdown: original, editVersion: 1,
    range: { start: original.length, end: original.length } }, 'provenance-regenerate');
  const root = '/handbooks/HB-1/documents/doc-1';
  const created = await api.request('POST', `${root}/ai-jobs`, input.body, input.headers);
  assert.equal(created.status, 202, JSON.stringify(created.body));
  const generated = await api.request('GET', `${root}/ai-jobs/${created.body.data.jobId}${query}`);
  assert.equal(generated.body.data.status, 'completed');
  const nextMetadata = generated.body.data.metadata;
  assert.equal(nextMetadata.provenance[0].kind, 'direct_quote');
  assert.equal(nextMetadata.provenance[1].kind, 'source_summary');
  assert.equal(nextMetadata.sourceSnapshots[0].sourceId, metadata.sourceSnapshots[0].sourceId);
  assert.ok(nextMetadata.provenanceHistory.length > metadata.provenanceHistory.length);
  assert.ok(nextMetadata.provenance.some(item => item.kind === 'human_edit' && original.slice(item.start, item.end).includes('新')));
  assert.deepEqual((await api.request('GET', `${draftPath()}${query}`)).body.data.draft.revision, revision, '再次生成不覆盖已保存版本');
  fs.writeFileSync(path.join(evidenceDir, 'result.json'), JSON.stringify({ realHTTP: true, realBrowser: true, realModel: false, externalSource: false,
    checked: ['quote text match', 'summary unverified', 'uncovered inference', 'human edit retention', 'normalization coordinates', 'saved renderer', 'unsaved regeneration retains sources', 'immutable saved revision'], metadata, regeneratedMetadata: nextMetadata }, null, 2));
});

test('质量检查 HTTP 通过独立 Agent 生成绑定文档版本的报告', async t => {
  const executed = [];
  const api = await setup(t, { yashanDB: { version: 'YashanDB-isolated', environment: 'test', execute: async sql => { executed.push(sql); return { rows: 1 }; } } });
  const response = await api.request('POST', '/handbooks/HB-1/documents/doc-1/quality', json({ outlineVersionId: 'outline-v1', branch: 'main', revisionId: 'r1', markdown: '```sql\nselect 1;\n```' }).body, { 'Idempotency-Key': 'quality-http-1' });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.data.gate, 'passed'); assert.equal(response.body.data.coverage.passed, 1); assert.deepEqual(executed, ['select 1']);
  const report = await api.request('GET', `/handbooks/HB-1/documents/doc-1/quality/${response.body.data.reportId}?outlineVersionId=outline-v1&branch=main`);
  assert.equal(report.status, 200); assert.equal(report.body.data.document.revisionId, 'r1');
  const unavailable = await (await setup(t)).request('POST', '/handbooks/HB-1/documents/doc-1/quality', json({ outlineVersionId: 'outline-v1', branch: 'main', markdown: '```sql\nselect 1;\n```' }).body, { 'Idempotency-Key': 'quality-http-2' });
  assert.equal(unavailable.body.data.gate, 'not_passed'); assert.equal(unavailable.body.data.coverage.notExecuted, 1);
});

test('默认 MCP 真实 HTTP 与浏览器：五类来源、免填地址、自动引用、失败重试和证据复用', async t => {
  let mode = 'success'; let searches = 0; let writerFails = false; let payload;
  let detailStarted; let releaseDetail;
  const mcp = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const message = JSON.parse(raw);
    if (message.method === 'notifications/initialized') { res.writeHead(202); res.end(); return; }
    let result = { serverInfo: { name: 'isolated-auto-mcp', version: '1' }, capabilities: {} };
    if (message.method === 'tools/call') {
      if (message.params.name === 'search_ku') {
        searches++;
        assert.equal(req.headers['x-kb'], '1');
        result = mode === 'failure' ? { isError: true } : { structuredContent: { results: [{ ku_name: 'sql-select', score: .95 }] } };
      } else {
        if (mode === 'delay') { detailStarted(); await new Promise(resolve => { releaseDetail = resolve; }); }
        result = { content: [{ type: 'text', text: JSON.stringify({ title: 'SQL SELECT', content: 'SELECT用于查询。', version: '1' }) }] };
      }
    }
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
  });
  await new Promise(resolve => mcp.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { mcp.close(resolve); mcp.closeAllConnections(); }));
  const rules = structuredClone(require('../../../config/knowledge-center/content-rules.json').productionAI);
  const api = await setup(t, { browser: true, ai: { rules,
    loadMCPConfig: async () => ({ services: [{ id: 'official', name: '隔离知识库', server_url: `http://127.0.0.1:${mcp.address().port}`, search_knowledge_base_header: 'X-Kb', knowledgeBases: [{ id: 'docs', name: '官方文档', locator: '1' }] }] }),
    generate: async messages => {
      if (writerFails) throw new Error('isolated writer failure');
      payload = JSON.parse(messages.at(-1).content);
      const source = payload.sources[0];
      return { content: JSON.stringify({ markdown: source.content, provenance: [{ start: 0, end: source.content.length, kind: 'direct_quote', evidence: [{ sourceId: source.sourceId, start: 0, end: source.content.length }] }] }) };
    },
  } });
  const aiPath = '/handbooks/HB-1/documents/doc-1/ai-jobs';
  const ctx = { outlineVersionId: 'outline-v1', branch: 'main' };
  const post = (suffix, body, key) => { const input = json({ ...ctx, ...body }, key); return api.request('POST', suffix, input.body, input.headers); };
  const terminal = async id => {
    for (let i = 0; i < 100; i++) {
      const result = await api.request('GET', `${aiPath}/${id}${query}`);
      if (!['running', 'queued'].includes(result.body.data.status)) return result.body.data;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.fail('AI job did not finish');
  };
  const catalog = await api.request('GET', `/handbooks/HB-1/documents/doc-1/ai-sources${query}`);
  assert.deepEqual(catalog.body.data.items.map(item => item.name), ['网页来源', 'Pingcode设计文档', 'Pingcode测试文档', '知识库（MCP）', '测试用例集', '本地文档']);
  assert.equal(catalog.body.data.items[3].automatic, true);
  const generation = { operation: 'update', markdown: '旧说明', editVersion: 0, range: { start: 0, end: 3 }, requirements: '关键词：SELECT SQL' };
  const created = await post(aiPath, generation, 'default-mcp');
  assert.equal(created.status, 202);
  const completed = await terminal(created.body.data.jobId);
  assert.equal(completed.status, 'completed', JSON.stringify(completed.error));
  assert.equal(completed.mcpRetrieval.status, 'succeeded');
  assert.equal(payload.sources[0].automatic, true);
  assert.equal(completed.metadata.provenance[0].kind, 'direct_quote');
  assert.equal(completed.metadata.sourceSnapshots[0].content, 'SELECT用于查询。');
  assert.equal(completed.artifacts.evidence.sources[0].sourceId, payload.sources[0].sourceId);
  writerFails = true;
  const retryCreated = await post(aiPath, generation, 'writer-failure-mcp');
  const failedWriter = await terminal(retryCreated.body.data.jobId);
  assert.equal(failedWriter.status, 'failed');
  const beforeRetry = searches; writerFails = false;
  const retried = await post(`${aiPath}/${failedWriter.jobId}/retry`, {}, 'retry-frozen-evidence');
  assert.equal(retried.status, 202, JSON.stringify(retried.body));
  assert.equal((await terminal(failedWriter.jobId)).status, 'completed');
  assert.equal(searches, beforeRetry, 'Writer retry must reuse frozen MCP snapshots');
  mode = 'failure';
  const failedCreated = await post(aiPath, generation, 'retrieval-failure');
  const failed = await terminal(failedCreated.body.data.jobId);
  assert.equal(failed.error.code, 'AI_MCP_RETRIEVAL_FAILED');
  assert.equal(failed.mcpRetrieval.status, 'failed');
  mode = 'success';
  assert.equal((await post(`${aiPath}/${failed.jobId}/retry`, {}, 'retry-retrieval')).status, 202);
  assert.equal((await terminal(failed.jobId)).status, 'completed');
  mode = 'delay';
  const started = new Promise(resolve => { detailStarted = resolve; });
  const late = await post(aiPath, generation, 'cancel-during-mcp');
  await started;
  const lateId = late.body.data.jobId;
  const cancelled = await post(`${aiPath}/${lateId}/cancel`, {}, 'cancel-mcp');
  assert.equal(cancelled.body.data.status, 'cancelled');
  const priorPayload = payload;
  releaseDetail();
  await new Promise(resolve => setTimeout(resolve, 80));
  const afterCancel = await terminal(lateId);
  assert.equal(afterCancel.status, 'cancelled');
  assert.equal(afterCancel.sourceSnapshots.length, 0);
  assert.equal(afterCancel.mcpRetrieval, undefined);
  assert.equal(payload, priorPayload, 'Cancelled MCP retrieval must not reach writer');
  mode = 'success';
  const browser = await require('playwright').chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${api.origin}/browser-fixture`);
  await page.evaluate(async () => {
    const stylesheet = document.createElement('link'); stylesheet.rel = 'stylesheet';
    stylesheet.href = '/knowledge-center/modules/production/production.css'; document.head.append(stylesheet);
    const { openProductionAIDialog } = await import('/knowledge-center/modules/production/production-ai-dialog.js');
    openProductionAIDialog({ context: { handbookId: 'HB-1', documentId: 'doc-1', outlineVersionId: 'outline-v1', branch: 'main' }, operation: 'update', editVersion: 0, getMarkdown: () => '旧说明', baselineDigest: async () => '', onAdopt() {} });
  });
  await page.locator('[data-ai-source-add]').click();
  await page.locator('[data-reference-type="knowledge-mcp"]').click();
  assert.equal(await page.locator('[data-ai-source-locator]').isVisible(), false);
  assert.equal(await page.locator('[data-ai-source-preview]').isVisible(), true);
  assert.equal(await page.locator('[data-ai-source-preview]').textContent(), '已引用');
  assert.equal(await page.locator('[data-ai-source-preview]').isDisabled(), true);
  assert.equal(await page.locator('[data-ai-mcp-service]').count(), 0);
  assert.match(await page.locator('[data-ai-source-info]').textContent(), /按写作要求检索知识库/);
  const reportRoot = path.join(repositoryRoot, 'runtime/test-results/production-ai-default-mcp'); fs.mkdirSync(reportRoot, { recursive: true });
  await page.screenshot({ path: path.join(reportRoot, 'automatic-mcp-settings.png'), fullPage: true });
  await page.getByRole('button', { name: '关闭添加参考文档' }).click();
  await page.locator('[data-ai-requirements]').fill('关键词：SELECT SQL');
  await page.locator('[data-ai-start]').click();
  await page.locator('[data-ai-candidate]').waitFor({ state: 'visible' });
  assert.match(await page.locator('[data-ai-mcp-status]').textContent(), /已取得引用/);
  assert.equal(await page.locator('[data-ai-fragment]').inputValue(), 'SELECT用于查询。');
  await page.screenshot({ path: path.join(reportRoot, 'automatic-mcp.png'), fullPage: true });
  await page.goto(`${api.origin}/browser-fixture`);
  await page.evaluate(async () => {
    const { openProductionAIDialog } = await import('/knowledge-center/modules/production/production-ai-dialog.js');
    openProductionAIDialog({ context: { handbookId: 'HB-1', documentId: 'doc-1', outlineVersionId: 'outline-v1', branch: 'main' }, operation: 'update', editVersion: 0, getMarkdown: () => '旧说明', baselineDigest: async () => '', onAdopt() {} });
  });
  await page.locator('[data-ai-resume]').click();
  await page.locator('[data-ai-candidate]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-ai-source-list] [data-source-id]:not([data-source-id="knowledge-mcp"]) input[type="checkbox"]').count(), 0, 'Automatic sources must not become manual confirmed IDs on recovery');
  const nextResponse = page.waitForResponse(response => response.url().endsWith('/ai-jobs') && response.request().method() === 'POST');
  await page.locator('[data-ai-start]').click();
  const next = await nextResponse;
  assert.equal(next.status(), 202);
  const nextJob = await next.json();
  assert.equal((await terminal(nextJob.data.jobId)).status, 'completed');
});

test('生产映射真实 HTTP 按手册授权裁剪，普通作者不能读取管理配置', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'production-mapping-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const gitlabConfigPath = path.join(root, 'gitlab.json');
  fs.writeFileSync(gitlabConfigPath, JSON.stringify({
    connections: [{ id: 'connection-1', credentialRef: 'secret-reference' }],
    mappings: [{ handbookId: 'HB-1', connectionId: 'connection-1', defaultBranch: 'main', enabledBranches: ['main'], zhPaths: ['docs'], enPaths: [], updatedBy: 'private-admin' }],
  }));
  const { origin, setSession } = await setup(t, { gitlabConfigPath });
  const endpoint = `${origin}/knowledge-center/api/gitlab/mappings/HB-1`;
  assert.equal((await fetch(endpoint)).status, 403);
  const response = await fetch(`${endpoint}?view=production`);
  assert.equal(response.status, 200);
  const data = (await response.json()).data;
  assert.equal(data.defaultBranch, 'main');
  assert.deepEqual(Object.keys(data).sort(), ['handbookId', 'connectionId', 'defaultBranch', 'enabledBranches', 'zhPaths', 'enPaths'].sort());
  setSession({ ...editor, visibleHandbookIds: ['another-handbook'] });
  assert.equal((await fetch(`${endpoint}?view=production`)).status, 403);
  setSession(editor);
  assert.equal((await fetch(`${origin}/knowledge-center/api/gitlab/mappings/missing?view=production`)).status, 404);
});
