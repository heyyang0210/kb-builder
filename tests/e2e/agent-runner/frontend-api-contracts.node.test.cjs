const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { instrumentFrontend } = require('./fixtures/frontend-coverage.cjs');

const frontend = path.resolve('apps/knowledge-center-web/frontend/knowledge-center');
const moduleUrl = '/knowledge-center/common/api/gitlab-api.js';
const base = '/knowledge-center/api/gitlab';

async function setup(t, name, targetModule = moduleUrl) {
  const requests = [];
  let reply = { status: 200, body: { success: true, data: { accepted: true } } };
  const server = http.createServer(async (req, res) => {
    if (req.url === '/fixture') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<!doctype html><html lang="zh-CN"><title>前端API契约</title></html>');
    }
    if (req.url.startsWith('/knowledge-center/common/')) {
      const file = path.resolve(frontend, req.url.slice('/knowledge-center/'.length));
      if (!file.startsWith(frontend + path.sep) || !fs.existsSync(file)) {
        res.writeHead(404); return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return res.end(fs.readFileSync(file));
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const request = { url: req.url, method: req.method, headers: req.headers, body: Buffer.concat(chunks).toString() };
    requests.push(request);
    const response = typeof reply === 'function' ? await reply(request) : reply;
    if (response.disconnect) return req.socket.destroy();
    res.writeHead(response.status, response.headers || { 'Content-Type': 'application/json' });
    res.end(response.raw === undefined ? JSON.stringify(response.body) : response.raw);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const browser = await chromium.launch({ headless: true });
  let save = async () => {};
  const errors = [];
  t.after(async () => {
    try { await save(); assert.deepEqual(errors, []); }
    finally { await browser.close(); }
  });
  const page = await browser.newPage();
  save = await instrumentFrontend(page, name);
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
  return {
    page, requests,
    reply(value) { reply = value; },
    async call(method, args = [], options = {}) {
      return page.evaluate(async ({ moduleUrl, method, args, options }) => {
        const api = await import(moduleUrl);
        if (options.searchParams) args[0] = new URLSearchParams(args[0]);
        try { return { value: await api[method](...args) }; }
        catch (error) { return { error: { message: error.message, code: error.code, status: error.status, recovery: error.recovery, details: error.details, requestId: error.requestId } }; }
      }, { moduleUrl: targetModule, method, args, options });
    },
  };
}

test('GitLab客户端读取契约：查询默认值、编码和全部只读入口', async t => {
  const api = await setup(t, 'gitlab-api-read');
  const cases = [
    ['loadGitLabConnections', [], `${base}/connections`],
    ['loadGitLabConnections', [{ q: '中文 &/' }], `${base}/connections?${new URLSearchParams({ q: '中文 &/' })}`],
    ['loadGitLabVersionMappings', [], `${base}/version-mappings`],
    ['previewGitLabVersionMapping', [{ handbookId: 'H/1' }], `${base}/version-mappings/resolve-preview?handbookId=H%2F1`],
    ['loadGitLabOAuthStatus', [], `${base}/oauth/status`],
    ['loadGitLabOAuthAccounts', [], `${base}/oauth/accounts`],
    ['loadGitLabOAuthConfig', [], `${base}/oauth/config`],
    ['loadHandbookGitLabAccess', ['H/1'], `${base}/handbooks/H%2F1/access-status`],
    ['loadGitLabBranches', ['C/1'], `${base}/connections/C%2F1/branches`],
    ['loadGitLabTree', ['C/1', 'release/1'], `${base}/connections/C%2F1/tree?ref=release%2F1&path=`],
    ['loadGitLabTree', ['C/1', 'main', '中文/a.md'], `${base}/connections/C%2F1/tree?ref=main&path=${encodeURIComponent('中文/a.md')}`],
    ['loadGitLabFile', ['C/1', 'main', 'a b.md'], `${base}/connections/C%2F1/file?ref=main&path=a%20b.md`],
    ['loadHandbookRepository', ['H/1'], `${base}/handbooks/H%2F1/branches`],
    ['loadHandbookRepositoryStatistics', ['H/1', 'release/1'], `${base}/handbooks/H%2F1/statistics?ref=release%2F1&language=zh`],
    ['loadHandbookRepositoryStatistics', ['H/1', 'main', 'en'], `${base}/handbooks/H%2F1/statistics?ref=main&language=en`],
    ['loadHandbookRepositoryTree', ['H/1', 'main', 'zh'], `${base}/handbooks/H%2F1/tree?ref=main&language=zh&path=`],
    ['loadHandbookRepositoryTree', ['H/1', 'main', 'zh', 'a/b'], `${base}/handbooks/H%2F1/tree?ref=main&language=zh&path=a%2Fb`],
    ['loadHandbookRepositoryFile', ['H/1', 'main', 'en', 'a/b'], `${base}/handbooks/H%2F1/file?ref=main&language=en&path=a%2Fb`],
    ['loadHandbookRepositoryCommits', ['H/1', 'main'], `${base}/handbooks/H%2F1/commits?ref=main`],
    ['loadReviewRepositoryContext', ['H/1'], '/knowledge-center/api/review/repository-context?handbookId=H%2F1&language=zh'],
    ['loadReviewRepositoryContext', ['H/1', { branch: 'a/b', language: 'en', path: 'x/y', preferredPath: 'z/a' }], '/knowledge-center/api/review/repository-context?handbookId=H%2F1&language=en&branch=a%2Fb&path=x%2Fy&preferredPath=z%2Fa'],
    ['loadHandbookRepositoryMapping', ['H/1'], `${base}/mappings/H%2F1`],
    ['loadHandbookRepositoryMapping', ['H/1', 'production'], `${base}/mappings/H%2F1?view=production`],
    ['loadGitLabConnectionAudit', ['C/1'], `${base}/connections/C%2F1/audit`],
    ['searchGitLabConnections', [], `${base}/connections?page=1&pageSize=20`],
    ['searchGitLabConnections', [{ q: '中文', status: 'enabled', page: 2, pageSize: 5 }], `${base}/connections?q=${encodeURIComponent('中文')}&status=enabled&page=2&pageSize=5`],
  ];
  for (const [method, args, expected] of cases) {
    assert.deepEqual(await api.call(method, args), { value: { accepted: true } }, method);
    const request = api.requests.at(-1);
    assert.equal(request.method, 'GET', method);
    assert.equal(request.url, expected, method);
    assert.equal(request.body, '');
  }
  assert.deepEqual(await api.call('loadGitLabConnections', [{ q: 'a b' }], { searchParams: true }), { value: { accepted: true } });
  assert.equal(api.requests.at(-1).url, `${base}/connections?q=a+b`);
  const count = api.requests.length;
  assert.equal((await api.call('gitLabOAuthHref', ['C/1'])).value, `${base}/oauth/start?connectionId=C%2F1&returnTo=%2Fknowledge-center%2F%3FexternalAccount%3D1`);
  assert.equal((await api.call('handbookGitLabOAuthHref', ['H/1', '/knowledge-center/?a=1'])).value, `${base}/handbooks/H%2F1/oauth/start?returnTo=%2Fknowledge-center%2F%3Fa%3D1`);
  assert.equal(api.requests.length, count, '链接构造不发送请求');
});

test('GitLab客户端写入契约：JSON、CAS与幂等键', async t => {
  const api = await setup(t, 'gitlab-api-write');
  const value = { name: '中文连接', rowVersion: 3 };
  const cases = [
    ['saveGitLabVersionMapping', [value], 'POST', `${base}/version-mappings`, value],
    ['saveGitLabVersionMapping', [value, { id: 'V/1', rowVersion: 0 }], 'PUT', `${base}/version-mappings/V%2F1`, value, '0'],
    ['setGitLabVersionMappingState', [{ id: 'V/1', rowVersion: 2 }, 'disable'], 'POST', `${base}/version-mappings/V%2F1/disable`, {}, '2'],
    ['setGitLabVersionMappingState', [{ id: 'V/1', rowVersion: 2 }, 'delete'], 'POST', `${base}/version-mappings/V%2F1/delete`, {}, '2'],
    ['disconnectGitLabOAuth', ['C/1'], 'POST', `${base}/oauth/disconnect?connectionId=C%2F1`],
    ['saveGitLabConnection', [value], 'PUT', `${base}/connections`, value],
    ['disableGitLabConnection', ['C/1'], 'POST', `${base}/connections/C%2F1/disable`],
    ['enableGitLabConnection', ['C/1'], 'POST', `${base}/connections/C%2F1/enable`],
    ['saveHandbookRepositoryMapping', ['H/1', value], 'PUT', `${base}/mappings/H%2F1`, value],
    ['createGitLabConnection', [value], 'POST', `${base}/connections`, value],
    ['updateGitLabConnection', ['C/1', value], 'PATCH', `${base}/connections/C%2F1`, value, '3'],
    ['updateGitLabConnection', ['C/1', { name: '修改' }], 'PATCH', `${base}/connections/C%2F1`, { name: '修改' }],
  ];
  const keys = new Set();
  for (const [method, args, verb, url, body, version] of cases) {
    assert.deepEqual(await api.call(method, args), { value: { accepted: true } }, method);
    const request = api.requests.at(-1);
    assert.equal(request.url, url, method);
    assert.equal(request.method, verb, method);
    assert.equal(request.headers['if-match'], version, method);
    assert.equal(request.headers.accept, 'application/json');
    assert.ok(request.headers['idempotency-key']);
    assert.ok(!keys.has(request.headers['idempotency-key']), '独立命令使用独立幂等键');
    keys.add(request.headers['idempotency-key']);
    if (body) {
      assert.equal(request.headers['content-type'], 'application/json');
      assert.deepEqual(JSON.parse(request.body), body);
    } else assert.equal(request.body, '');
  }
});

test('GitLab客户端验证响应：标识与状态必须同时匹配', async t => {
  const api = await setup(t, 'gitlab-api-verification');
  for (const data of [null, {}, { connectionId: 'other', status: 'verified' }, { connectionId: 'C/1' }, { connectionId: 'C/1', status: 'failed' }]) {
    api.reply({ status: 200, body: { success: true, data } });
    const result = await api.call('verifyGitLabConnection', ['C/1']);
    assert.match(result.error.message, /验证接口未返回有效结果/);
    assert.equal(api.requests.at(-1).url, `${base}/connections/C%2F1/verify`);
    assert.equal(api.requests.at(-1).method, 'POST');
    assert.match(api.requests.at(-1).headers['idempotency-key'], /^gitlab-verify-C\/1-/);
  }
  api.reply({ status: 200, body: { data: { connectionId: 'C/1', status: 'verified' } } });
  assert.deepEqual(await api.call('verifyGitLabConnection', ['C/1']), { value: { connectionId: 'C/1', status: 'verified' } });
});

test('GitLab客户端失败恢复：HTTP、业务错误、坏JSON和恢复投影', async t => {
  const api = await setup(t, 'gitlab-api-errors');
  const cases = [
    [{ status: 403, body: { error: { message: '禁止访问', code: 'FORBIDDEN', details: { recovery: { action: 'connect' } } } } }, { message: '禁止访问', code: 'FORBIDDEN', status: 403, recovery: { action: 'connect' } }],
    [{ status: 200, body: { success: false, error: { message: '版本冲突', code: 'CONFLICT' } } }, { message: '版本冲突', code: 'CONFLICT', status: 200 }],
    [{ status: 503, body: {} }, { message: 'GitLab 请求失败（HTTP 503）', status: 503 }],
    [{ status: 500, body: { error: {} } }, { message: 'GitLab 请求失败（HTTP 500）', status: 500 }],
    [{ status: 502, raw: 'invalid JSON' }, { message: 'GitLab 请求失败（HTTP 502）', status: 502 }],
  ];
  for (const [reply, expected] of cases) {
    api.reply(reply);
    const result = await api.call('loadGitLabConnections');
    assert.deepEqual(JSON.parse(JSON.stringify(result.error)), expected);
  }
  api.reply({ status: 200, raw: 'invalid JSON' });
  assert.equal((await api.call('loadGitLabConnections')).error, undefined, '保留现有成功响应坏JSON的兼容行为');
  api.reply({ status: 200, body: { data: ['recovered'] } });
  assert.deepEqual(await api.call('loadGitLabConnections'), { value: ['recovered'] });
});

test('GitLab客户端缺少randomUUID时仍发送独立命令幂等键', async t => {
  const api = await setup(t, 'gitlab-api-fallback');
  await api.page.evaluate(() => { Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined }); });
  assert.deepEqual(await api.call('createGitLabConnection', [{ name: '兼容浏览器' }]), { value: { accepted: true } });
  assert.match(api.requests.at(-1).headers['idempotency-key'], /^gitlab-create-\d+-[0-9a-f]+$/);
});

const productionModule = '/knowledge-center/common/api/handbook-production-api.js';
const draftContext = { handbookId: 'H/1', documentId: 'D/1', outlineVersionId: 'V/1', branch: 'release/1' };
const productionBase = '/knowledge-center/api/production/handbooks/H%2F1';
const documentBase = `${productionBase}/documents/D%2F1`;
const contextQuery = 'outlineVersionId=V%2F1&branch=release%2F1';

test('手册生产客户端：全部读取与写入端点和上下文契约', async t => {
  const api = await setup(t, 'handbook-api-methods', productionModule);
  const ctx = draftContext;
  const body = { text: '正文', outlineVersionId: '不能覆盖', branch: '不能覆盖' };
  const expectedBody = { ...body, outlineVersionId: ctx.outlineVersionId, branch: ctx.branch };
  const cases = [
    ['loadHandbookDraft', [ctx], 'GET', `${documentBase}/draft?${contextQuery}`],
    ['loadHandbookAI', [ctx, 'J/1'], 'GET', `${documentBase}/ai-jobs/J%2F1?${contextQuery}`],
    ['loadHandbookAIHistory', [ctx], 'GET', `${documentBase}/ai-jobs?${contextQuery}`],
    ['deleteHandbookAIHistory', [ctx, 'J/1'], 'DELETE', `${documentBase}/ai-jobs/J%2F1?${contextQuery}`],
    ['loadHandbookAISkills', [ctx], 'GET', `${documentBase}/ai-skills?${contextQuery}`],
    ['loadHandbookAISources', [ctx], 'GET', `${documentBase}/ai-sources?${contextQuery}`],
    ['loadHandbookQuality', [ctx, 'Q/1'], 'GET', `${documentBase}/quality/Q%2F1?${contextQuery}`],
    ['loadHandbookDraftRevisions', [ctx], 'GET', `${documentBase}/draft/revisions?${contextQuery}`],
    ['loadHandbookReviewers', ['H/1'], 'GET', `${productionBase}/reviewers`],
    ['loadHandbookReviewDrafts', ['H/1'], 'GET', `${productionBase}/review-drafts`],
    ['loadProductionModels', [], 'GET', '/knowledge-center/api/production/models'],
    ['startHandbookAI', [ctx, body], 'POST', `${documentBase}/ai-jobs`, expectedBody, true],
    ['startHandbookAI', [ctx, body, 'explicit-key'], 'POST', `${documentBase}/ai-jobs`, expectedBody, 'explicit-key'],
    ['saveHandbookAIFeedback', [ctx, 'J/1', body], 'POST', `${documentBase}/ai-jobs/J%2F1/feedback`, expectedBody],
    ['previewHandbookAISource', [ctx, body], 'POST', `${documentBase}/ai-sources`, expectedBody],
    ['actHandbookAI', [ctx, 'J/1', 'cancel'], 'POST', `${documentBase}/ai-jobs/J%2F1/cancel`, { outlineVersionId: ctx.outlineVersionId, branch: ctx.branch }],
    ['actHandbookAI', [ctx, 'J/1', 'retry', body], 'POST', `${documentBase}/ai-jobs/J%2F1/retry`, expectedBody, true],
    ['actHandbookAI', [ctx, 'J/1', 'retry', { idempotencyKey: 'retry-key' }], 'POST', `${documentBase}/ai-jobs/J%2F1/retry`, { idempotencyKey: 'retry-key', outlineVersionId: ctx.outlineVersionId, branch: ctx.branch }, 'retry-key'],
    ['runHandbookQuality', [ctx, body], 'POST', `${documentBase}/quality`, expectedBody, true],
    ['runHandbookQuality', [ctx, { idempotencyKey: 'quality-key' }], 'POST', `${documentBase}/quality`, { idempotencyKey: 'quality-key', outlineVersionId: ctx.outlineVersionId, branch: ctx.branch }, 'quality-key'],
    ['saveHandbookDraft', [ctx, body], 'PUT', `${documentBase}/draft`, expectedBody, true],
    ['restoreHandbookDraftRevision', [ctx, body], 'POST', `${documentBase}/draft/restore`, expectedBody, true],
    ['createHandbookIncrementalReview', ['H/1', body], 'POST', `${productionBase}/incremental-reviews`, body, true],
  ];
  for (const [method, args, verb, url, body, key] of cases) {
    assert.deepEqual(await api.call(method, args), { value: { accepted: true } }, method);
    const req = api.requests.at(-1);
    assert.equal(req.url, url, method);
    assert.equal(req.method, verb, method);
    if (body) { assert.equal(req.headers['content-type'], 'application/json'); assert.deepEqual(JSON.parse(req.body), body); }
    else assert.equal(req.body, '');
    if (key === true) assert.ok(req.headers['idempotency-key'], method);
    else assert.equal(req.headers['idempotency-key'], key, method);
  }
  await api.page.evaluate(() => { Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined }); });
  await api.call('saveHandbookDraft', [ctx, {}]);
  assert.match(api.requests.at(-1).headers['idempotency-key'], /^web-\d+-[a-z0-9]+$/);
});

test('手册生产客户端错误恢复：格式、权限事件与请求ID', async t => {
  const api = await setup(t, 'handbook-api-errors', productionModule);
  await api.page.evaluate(() => {
    window.authEvents = [];
    for (const type of ['session-expired', 'permission-denied']) window.addEventListener(`knowledge-center:${type}`, () => window.authEvents.push(type));
  });
  const cases = [
    [{ status: 401, body: { error: { code: 'LOGIN', message: '请登录' } } }, 'LOGIN', '请登录', 'session-expired'],
    [{ status: 403, body: { error: { code: 'FORBIDDEN' } } }, 'FORBIDDEN', '操作失败（HTTP 403）', 'permission-denied'],
    [{ status: 403, body: { error: { code: 'AI_SOURCE_SCOPE_DENIED' } } }, 'AI_SOURCE_SCOPE_DENIED', '操作失败（HTTP 403）'],
    [{ status: 403, body: { error: { code: 'AI_SOURCE_URL_DENIED' } } }, 'AI_SOURCE_URL_DENIED', '操作失败（HTTP 403）'],
    [{ status: 503, body: {} }, undefined, '操作失败（HTTP 503）'],
    [{ status: 200, body: { success: false } }, undefined, '操作失败（HTTP 200）'],
    [{ status: 200, raw: 'bad json' }, 'DRAFT_API_UNAVAILABLE', '共享草稿服务暂不可用，请稍后重试'],
    [{ status: 200, body: null }, 'DRAFT_API_UNAVAILABLE', '共享草稿服务暂不可用，请稍后重试'],
    [{ status: 502, raw: '<html>网关错误</html>', headers: { 'Content-Type': 'text/html' } }, 'DRAFT_API_UNAVAILABLE', '共享草稿服务暂不可用，请稍后重试'],
    [{ status: 502, raw: 'no content type', headers: {} }, 'DRAFT_API_UNAVAILABLE', '共享草稿服务暂不可用，请稍后重试'],
  ];
  const events = [];
  for (const [reply, code, message, event] of cases) {
    api.reply(reply);
    const result = await api.call('loadHandbookDraft', [draftContext]);
    assert.equal(result.error.code, code);
    assert.equal(result.error.message, message);
    assert.equal(result.error.status, reply.status);
    if (event) events.push(event);
    assert.deepEqual(await api.page.evaluate(() => window.authEvents), events);
  }
  for (const header of [undefined, 'header-request']) {
    api.reply({ status: 409, headers: { 'Content-Type': 'application/json', ...(header ? { 'X-Request-Id': header } : {}) }, body: { error: { code: 'CONFLICT', details: { requestId: 'body-request' } } } });
    const result = await api.call('loadHandbookDraft', [draftContext]);
    assert.equal(result.error.requestId, header || 'body-request');
    assert.deepEqual(result.error.details, { requestId: 'body-request' });
  }
  api.reply({ status: 200, body: { legacy: true } });
  assert.deepEqual(await api.call('loadHandbookDraft', [draftContext]), { value: { legacy: true } });
});

test('手册生产客户端上传：真实XHR字节、进度、失败和断线', async t => {
  const api = await setup(t, 'handbook-api-uploads', productionModule);
  async function upload(method, type, progress = true) {
    return api.page.evaluate(async ({ productionModule, context, method, type, progress }) => {
      const module = await import(productionModule);
      const values = [];
      const file = new File(['上传正文'], '中文 a.md', { type });
      try { return { value: await module[method](context, file, progress ? value => values.push(value) : undefined), progress: values }; }
      catch (e) { return { error: { message: e.message, code: e.code, status: e.status, details: e.details, requestId: e.requestId }, progress: values }; }
    }, { productionModule, context: draftContext, method, type, progress });
  }
  for (const [method, suffix, disconnectCode] of [
    ['uploadHandbookAISource', 'ai-sources/uploads', 'AI_SOURCE_UPLOAD_FAILED'],
    ['uploadHandbookDraftAttachment', 'draft-attachments', 'ATTACHMENT_UPLOAD_FAILED'],
  ]) {
    for (const [type, progress] of [['text/markdown', true], ['', false]]) {
      api.reply({ status: 201, body: { success: true, data: { id: 'uploaded' } } });
      const result = await upload(method, type, progress);
      assert.deepEqual(result.value, { id: 'uploaded' });
      assert.deepEqual(result.progress, progress ? [100] : []);
      const req = api.requests.at(-1);
      assert.equal(req.url, `${documentBase}/${suffix}?${contextQuery}`);
      assert.equal(req.method, 'POST');
      assert.equal(req.headers['content-type'], type || 'application/octet-stream');
      assert.equal(req.headers['x-file-name'], encodeURIComponent('中文 a.md'));
      assert.equal(req.body, '上传正文');
    }
    for (const body of [{ legacy: true }, null]) {
      api.reply({ status: 200, body });
      assert.deepEqual((await upload(method, '')).value, body);
    }
    for (const [status, body, message] of [
      [200, { success: false, error: { message: '拒绝上传', code: 'DENIED', details: { retry: true } } }, '拒绝上传'],
      [400, {}, '上传失败（HTTP 400）'],
      [500, null, '上传失败（HTTP 500）'],
    ]) {
      api.reply({ status, body, headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'upload-request' } });
      const result = await upload(method, '');
      assert.equal(result.error.message, message);
      assert.equal(result.error.status, status);
      assert.equal(result.error.code, body?.error?.code);
      if (method === 'uploadHandbookAISource') assert.equal(result.error.requestId, 'upload-request');
      else assert.deepEqual(result.error.details, body?.error?.details);
    }
    api.reply({ disconnect: true });
    const result = await upload(method, '');
    assert.equal(result.error.code, disconnectCode);
    assert.match(result.error.message, /检查网络后重试/);
  }
});

const incrementalModule = '/knowledge-center/common/api/incremental-api.js';
const incrementalBase = '/knowledge-center/api/incremental-tasks';

test('增量审核客户端读取：默认查询、编码与审核引导参数', async t => {
  const api = await setup(t, 'incremental-api-read', incrementalModule);
  const cases = [
    ['loadIncrementalTasks', [], incrementalBase],
    ['loadIncrementalTasks', [{ status: '待审核 /', page: 2 }], `${incrementalBase}?${new URLSearchParams({ status: '待审核 /', page: 2 })}`],
    ['loadMyGenerations', [], '/knowledge-center/api/production/generations?scope=mine'],
    ['loadIncrementalBaselines', ['H/1'], `${incrementalBase}/baselines?handbookId=H%2F1`],
    ['loadIncrementalBaselines', ['H/1', 'release/1'], `${incrementalBase}/baselines?handbookId=H%2F1&businessVersion=release%2F1`],
    ['loadIncrementalTask', ['T/1'], `${incrementalBase}/T%2F1`],
    ['loadCandidateDiff', ['T/1'], `${incrementalBase}/T%2F1/diff`],
    ['loadHandbookReviewSummary', ['H/1'], `${incrementalBase}/handbooks/H%2F1/review-summary`],
    ['loadReviewMentionTargets', ['R/1'], '/knowledge-center/api/document-tasks/review/R%2F1/mention-targets'],
    ['loadMRParticipants', ['T/1'], `${incrementalBase}/T%2F1/mr-participants`],
    ['loadReviewBootstrap', [], '/knowledge-center/api/review/bootstrap?step=read'],
    ['loadReviewBootstrap', [{ step: '' }], '/knowledge-center/api/review/bootstrap?'],
    ['loadReviewBootstrap', [{ handbookId: 'H/1', taskId: 'T/1', step: 'comment', view: 'diff', documentId: 'D/1', path: '中文/a.md' }], `/knowledge-center/api/review/bootstrap?${new URLSearchParams({ handbookId: 'H/1', taskId: 'T/1', step: 'comment', view: 'diff', documentId: 'D/1', path: '中文/a.md' })}`],
  ];
  for (const [method, args, url] of cases) {
    assert.deepEqual(await api.call(method, args), { value: { accepted: true } }, method);
    assert.equal(api.requests.at(-1).url, url, method);
    assert.equal(api.requests.at(-1).method, 'GET');
    assert.equal(api.requests.at(-1).headers.accept, 'application/json');
    assert.equal(api.requests.at(-1).headers['idempotency-key'], undefined);
  }
  assert.deepEqual(await api.call('loadIncrementalTasks', [{ q: 'a b' }], { searchParams: true }), { value: { accepted: true } });
  assert.equal(api.requests.at(-1).url, `${incrementalBase}?q=a+b`);
});

test('增量审核客户端写入：全部命令端点与默认正文', async t => {
  const api = await setup(t, 'incremental-api-write', incrementalModule);
  const body = { text: '审核意见', rowVersion: 3 };
  const cases = [
    ['createIncrementalTask', [body], 'POST', incrementalBase, body],
    ['createOnlineReview', [body], 'POST', `${incrementalBase}/online-reviews`, body],
    ['bootstrapBaseline', [body], 'POST', `${incrementalBase}/bootstrap-baseline`, body],
    ['addIncrementalSource', ['T/1', body], 'POST', `${incrementalBase}/T%2F1/sources`, body],
    ['updateIncrementalTarget', ['T/1', body], 'PATCH', `${incrementalBase}/T%2F1/target`, body],
    ['saveIncrementalDraft', ['T/1', body], 'PUT', `${incrementalBase}/T%2F1/draft`, body],
    ['runIncrementalChecks', ['T/1'], 'POST', `${incrementalBase}/T%2F1/checks`, {}],
    ['submitIncrementalCandidate', ['T/1'], 'POST', `${incrementalBase}/T%2F1/candidate`, {}],
    ['createIncrementalReview', ['T/1'], 'POST', `${incrementalBase}/T%2F1/reviews`, {}],
    ['commentIncrementalReview', ['T/1', 'R/1', body], 'POST', `${incrementalBase}/T%2F1/reviews/R%2F1/comments`, body],
    ['replyIncrementalReviewComment', ['T/1', 'R/1', 'C/1', body], 'POST', `${incrementalBase}/T%2F1/reviews/R%2F1/comments/C%2F1/replies`, body],
    ['resolveIncrementalReviewComment', ['T/1', 'R/1', 'C/1'], 'POST', `${incrementalBase}/T%2F1/reviews/R%2F1/comments/C%2F1/resolve`, {}],
    ['reopenIncrementalReviewComment', ['T/1', 'R/1', 'C/1'], 'POST', `${incrementalBase}/T%2F1/reviews/R%2F1/comments/C%2F1/reopen`, {}],
    ['linkIncrementalReviewCommentOperation', ['T/1', 'R/1', 'C/1', body], 'POST', `${incrementalBase}/T%2F1/reviews/R%2F1/comments/C%2F1/link-operation`, body],
    ['decideIncrementalReview', ['T/1', 'R/1', body], 'POST', `${incrementalBase}/T%2F1/reviews/R%2F1/decision`, body],
    ['cancelIncrementalReview', ['T/1', 'R/1', body], 'POST', `${incrementalBase}/T%2F1/reviews/R%2F1/cancel`, body],
    ['reassignIncrementalReview', ['T/1', 'R/1', body], 'PUT', '/knowledge-center/api/review/tasks/T%2F1/reviews/R%2F1/reviewers', body],
    ['publishIncrementalTask', ['T/1'], 'POST', `${incrementalBase}/T%2F1/publish`, {}],
    ['recordIncrementalEvidence', ['T/1', body], 'POST', `${incrementalBase}/T%2F1/external-evidence`, body],
    ['createIncrementalRevision', ['T/1'], 'POST', `${incrementalBase}/T%2F1/revisions`, {}],
    ['addIncrementalSource', ['T/1', null], 'POST', `${incrementalBase}/T%2F1/sources`, {}],
  ];
  const keys = new Set();
  for (const [method, args, verb, url, expected] of cases) {
    assert.deepEqual(await api.call(method, args), { value: { accepted: true } }, method);
    const req = api.requests.at(-1);
    assert.equal(req.url, url, method);
    assert.equal(req.method, verb, method);
    assert.deepEqual(JSON.parse(req.body), expected, method);
    assert.equal(req.headers['content-type'], 'application/json');
    assert.ok(req.headers['idempotency-key']);
    assert.ok(!keys.has(req.headers['idempotency-key']), '成功命令不保留幂等键');
    keys.add(req.headers['idempotency-key']);
  }
});

test('增量审核客户端幂等：错误与断线重试复用、成功释放、并发合并', async t => {
  const api = await setup(t, 'incremental-api-idempotency', incrementalModule);
  const args = ['T/1', { operation: 'publish' }];
  api.reply({ status: 409, body: { success: false, error: { code: 'CONFLICT', message: '需刷新', details: { currentVersion: 4 } } } });
  assert.deepEqual(JSON.parse(JSON.stringify((await api.call('publishIncrementalTask', args)).error)), { message: '需刷新', status: 409, code: 'CONFLICT', details: { currentVersion: 4 } });
  const key = api.requests.at(-1).headers['idempotency-key'];
  api.reply({ disconnect: true });
  assert.match((await api.call('publishIncrementalTask', args)).error.message, /fetch/i);
  assert.equal(api.requests.at(-1).headers['idempotency-key'], key);
  api.reply({ status: 200, body: { data: { published: true } } });
  assert.deepEqual(await api.call('publishIncrementalTask', args), { value: { published: true } });
  assert.equal(api.requests.at(-1).headers['idempotency-key'], key);
  assert.deepEqual(await api.call('publishIncrementalTask', args), { value: { published: true } });
  assert.notEqual(api.requests.at(-1).headers['idempotency-key'], key);
  const start = api.requests.length;
  const results = await api.page.evaluate(async url => {
    const api = await import(url);
    return Promise.all([api.runIncrementalChecks('parallel', { check: true }), api.runIncrementalChecks('parallel', { check: true })]);
  }, incrementalModule);
  assert.deepEqual(results, [{ published: true }, { published: true }]);
  assert.equal(api.requests.length, start + 2);
  assert.equal(api.requests[start].headers['idempotency-key'], api.requests[start + 1].headers['idempotency-key']);
  await api.page.evaluate(() => { Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined }); });
  await api.call('createOnlineReview', [{ title: '旧浏览器' }]);
  assert.match(api.requests.at(-1).headers['idempotency-key'], /^web-\d+-[a-z0-9]+$/);
});

test('增量审核客户端错误：权限通知开关、业务错误与坏JSON兼容', async t => {
  const api = await setup(t, 'incremental-api-errors', incrementalModule);
  await api.page.evaluate(() => {
    window.authEvents = [];
    for (const event of ['session-expired', 'permission-denied']) window.addEventListener(`knowledge-center:${event}`, () => window.authEvents.push(event));
  });
  for (const status of [401, 403]) {
    api.reply({ status, body: {} });
    assert.equal((await api.call('loadReviewBootstrap')).error.message, `操作失败（HTTP ${status}）`);
    assert.equal((await api.call('loadReviewBootstrap', [{}, { notifyAuthErrors: false }])).error.status, status);
  }
  assert.deepEqual(await api.page.evaluate(() => window.authEvents), ['session-expired', 'permission-denied']);
  api.reply({ status: 200, body: { success: false, error: { message: '不能提交', code: 'INVALID' } } });
  assert.deepEqual(JSON.parse(JSON.stringify((await api.call('loadIncrementalTasks')).error)), { message: '不能提交', status: 200, code: 'INVALID' });
  api.reply({ status: 503, raw: 'not JSON' });
  assert.deepEqual(JSON.parse(JSON.stringify((await api.call('loadIncrementalTask', ['T/1'])).error)), { message: '操作失败（HTTP 503）', status: 503 });
  api.reply({ status: 200, raw: 'not JSON' });
  assert.deepEqual(await api.call('loadIncrementalTasks'), { value: null });
  api.reply({ status: 200, body: ['legacy'] });
  assert.deepEqual(await api.call('loadIncrementalTasks'), { value: ['legacy'] });
  assert.deepEqual(await api.call('loadReviewBootstrap', [{}, { method: 'POST' }]), { value: ['legacy'] });
  assert.equal(api.requests.at(-1).body, '');
  assert.equal(api.requests.at(-1).headers['content-type'], undefined);
  assert.ok(api.requests.at(-1).headers['idempotency-key']);
});

const taskModule = '/knowledge-center/common/api/document-tasks-api.js';
const taskBase = '/knowledge-center/api/document-tasks';

test('文档任务客户端读写：参数编码、JSON及独立幂等键', async t => {
  const api = await setup(t, 'document-task-api-methods', taskModule);
  const body = { rowVersion: 2, owner: '中文用户' };
  const cases = [
    ['taskRequest', [], 'GET', taskBase],
    ['loadDocumentTasks', [], 'GET', `${taskBase}?`],
    ['loadDocumentTasks', [{ q: '中文 /', page: 2 }], 'GET', `${taskBase}?${new URLSearchParams({ q: '中文 /', page: 2 })}`],
    ['loadDocumentTask', ['T/1'], 'GET', `${taskBase}/T%2F1`],
    ['loadDocumentTaskConfig', [], 'GET', `${taskBase}/config`],
    ['saveDocumentTaskConfig', [body], 'PUT', `${taskBase}/config`, body],
    ['saveDocumentTaskScope', ['T/1', body], 'PUT', `${taskBase}/T%2F1/decomposition`, body],
    ['saveDocumentTaskOwner', ['T/1', body], 'PUT', `${taskBase}/T%2F1/owner`, body],
    ['taskWrite', ['/direct', body, 'PATCH'], 'PATCH', `${taskBase}/direct`, body],
  ];
  const keys = new Set();
  for (const [method, args, verb, url, expected] of cases) {
    assert.deepEqual(await api.call(method, args), { value: { accepted: true } });
    const req = api.requests.at(-1);
    assert.equal(req.url, url, method);
    assert.equal(req.method, verb, method);
    if (expected) {
      assert.deepEqual(JSON.parse(req.body), expected);
      assert.equal(req.headers['content-type'], 'application/json');
      assert.ok(req.headers['idempotency-key']);
      assert.ok(!keys.has(req.headers['idempotency-key']));
      keys.add(req.headers['idempotency-key']);
    } else assert.equal(req.headers['idempotency-key'], undefined);
  }
});

test('文档任务客户端导入：真实File字节、预览默认值与摘要', async t => {
  const api = await setup(t, 'document-task-api-import', taskModule);
  for (const withDigest of [false, true]) {
    const value = await api.page.evaluate(async ({ url, withDigest }) => {
      const api = await import(url);
      const file = new File(['任务导入内容\n'], 'tasks.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      return withDigest ? api.importDocumentTasks(file, false, 'sha256-digest') : api.importDocumentTasks(file);
    }, { url: taskModule, withDigest });
    assert.deepEqual(value, { accepted: true });
    const req = api.requests.at(-1);
    assert.equal(req.method, 'POST');
    assert.equal(req.url, `${taskBase}/import?preview=${!withDigest}`);
    assert.match(req.headers['content-type'], /^multipart\/form-data; boundary=/);
    assert.match(req.body, /filename="tasks.xlsx"/);
    assert.match(req.body, /任务导入内容\r?\n/);
    assert.equal(req.body.includes('sha256-digest'), withDigest);
    assert.ok(req.headers['idempotency-key']);
  }
});

test('文档任务客户端错误与兼容：HTTP、坏JSON、真实中断及随机ID降级', async t => {
  const api = await setup(t, 'document-task-api-errors', taskModule);
  for (const [reply, expected] of [
    [{ status: 409, body: { success: false, error: { message: '版本冲突', code: 'CAS' } } }, { message: '版本冲突', status: 409, code: 'CAS' }],
    [{ status: 200, body: { success: false } }, { message: '任务服务异常（HTTP 200）', status: 200 }],
    [{ status: 503, raw: 'not JSON' }, { message: '任务服务异常（HTTP 503）', status: 503 }],
  ]) {
    api.reply(reply);
    assert.deepEqual(JSON.parse(JSON.stringify((await api.call('loadDocumentTasks')).error)), expected);
  }
  api.reply({ status: 200, raw: 'not JSON' });
  assert.match((await api.call('loadDocumentTasks')).error.message, /null/);
  api.reply({ disconnect: true });
  assert.match((await api.call('loadDocumentTasks')).error.message, /fetch/i);
  const count = api.requests.length;
  for (const name of ['AbortError', 'TimeoutError']) {
    const message = await api.page.evaluate(async ({ url, name }) => {
      const api = await import(url);
      const controller = new AbortController();
      controller.abort(new DOMException('调用方中断', name));
      try { await api.taskRequest('/abort', { signal: controller.signal }); }
      catch (error) { return error.message; }
    }, { url: taskModule, name });
    assert.equal(message, '任务读取或提交超过30秒，请刷新后核对结果再重试');
  }
  assert.equal(api.requests.length, count, '已中断的请求不应到达后端');
  const ids = await api.page.evaluate(async url => {
    const api = await import(url);
    const normal = api.taskOperationId();
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
    const arrays = [api.taskOperationId(), api.taskOperationId()];
    Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: undefined });
    const fallback = [api.taskOperationId(), api.taskOperationId()];
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
    return { normal, arrays, fallback: [...fallback, api.taskOperationId()] };
  }, taskModule);
  assert.match(ids.normal, /^[0-9a-f-]{36}$/);
  for (const id of ids.arrays) assert.match(id, /^task-[0-9a-f]{32}$/);
  for (const id of ids.fallback) assert.match(id, /^task-\d+-[a-z0-9]+-[a-z0-9]+$/);
  assert.equal(new Set([...ids.arrays, ...ids.fallback]).size, 5);
});

const platformModule = '/knowledge-center/common/api/platform-api.js';
const platformBase = '/knowledge-center/api/platform';
const outlineBase = '/knowledge-center/api/outline/governance';
const assetBase = '/knowledge-center/api/assets/handbooks';
const templateBase = '/knowledge-center/api/templates';
const jsonError = result => JSON.parse(JSON.stringify(result.error));
const okResponse = body => ({ status: 200, body });

function routedReplies(api, routes) {
  api.reply(req => {
    assert.ok(Object.hasOwn(routes, req.url), `未声明的HTTP请求：${req.method} ${req.url}`);
    return routes[req.url];
  });
}

test('平台客户端读写端点：模板、团队、数据库、人员、资产与大纲治理', async t => {
  const api = await setup(t, 'platform-api-methods', platformModule);
  const body = { name: '配置', rowVersion: 3 };
  const data = { accepted: true };
  const response = { success: true, data };
  const cases = [
    ['loadTemplates', [], 'GET', templateBase],
    ['loadTemplates', [{ q: '中文 /' }], 'GET', `${templateBase}?${new URLSearchParams({ q: '中文 /' })}`],
    ['loadTemplate', ['X/1'], 'GET', `${templateBase}/X%2F1`],
    ['createTemplate', [body], 'POST', templateBase, body],
    ['saveTemplate', ['X/1', body], 'POST', `${templateBase}/X%2F1/save`, body],
    ['loadTemplateVersions', ['X/1'], 'GET', `${templateBase}/X%2F1/versions`],
    ['loadTemplateVersion', ['X/1', 2], 'GET', `${templateBase}/X%2F1/versions/2`],
    ['restoreTemplateDraft', ['X/1', 2], 'POST', `${templateBase}/X%2F1/restore-draft`, { version: 2 }],
    ['updateTemplateMetadata', ['X/1', body], 'PATCH', `${templateBase}/X%2F1`, body],
    ['setTemplateEnabled', ['X/1', true], 'POST', `${templateBase}/X%2F1/restore`],
    ['setTemplateEnabled', ['X/1', false], 'POST', `${templateBase}/X%2F1/disable`],
    ['loadTemplateMappingRules', [], 'GET', `${templateBase}/mapping-rules`],
    ['previewTemplateMappingRules', [body], 'POST', `${templateBase}/mapping-rules/preview`, body],
    ['saveTemplateMappingRules', [body], 'PUT', `${templateBase}/mapping-rules`, body],
    ['loadTemplateMappings', [{ q: 'a b' }], 'GET', `${templateBase}/mappings?q=a+b`],
    ['analyzeTemplateMappings', ['H/1'], 'POST', `${templateBase}/mappings/analyze`, { handbookId: 'H/1' }],
    ['loadTemplateMappingBatch', ['X/1'], 'GET', `${templateBase}/mappings/X%2F1`],
    ['cancelTemplateMappingBatch', ['X/1'], 'POST', `${templateBase}/mappings/X%2F1/cancel`],
    ['decideTemplateMapping', [body], 'POST', `${templateBase}/mappings/decisions`, body],
    ['loadDatabaseConnection', [], 'GET', `${platformBase}/database-connection`],
    ['loadDatabaseConnectionStatus', [], 'GET', `${platformBase}/database-connection/status`],
    ['testDatabaseConnection', [body], 'POST', `${platformBase}/database-connection/test`, body],
    ['saveDatabaseConnection', [body], 'PUT', `${platformBase}/database-connection`, body],
    ['saveDatabaseConnection', [body, 0], 'PUT', `${platformBase}/database-connection`, body, '0'],
    ['loadTeamGroups', [], 'GET', `${platformBase}/team-groups?groupType=TECH_DOMAIN`],
    ['createTeamGroup', [body], 'POST', `${platformBase}/team-groups`, body],
    ['loadTeamGroup', ['G/1'], 'GET', `${platformBase}/team-groups/G%2F1`],
    ['previewTeamRoster', ['G/1', body], 'POST', `${platformBase}/team-groups/G%2F1/roster/preview`, body],
    ['saveTeamRoster', ['G/1', body], 'PUT', `${platformBase}/team-groups/G%2F1/roster`, body],
    ['saveTeamRoster', ['G/1', body, 0], 'PUT', `${platformBase}/team-groups/G%2F1/roster`, body, '0'],
    ['loadAssets', [], 'GET', assetBase],
    ['loadAssets', [{ q: '中文 /' }], 'GET', `${assetBase}?${new URLSearchParams({ q: '中文 /' })}`],
    ['createAsset', [body], 'POST', assetBase, body],
    ['updateAsset', ['H/1', body], 'PATCH', `${assetBase}/H%2F1`, body],
    ['archiveAsset', ['H/1'], 'POST', `${assetBase}/H%2F1/archive`],
    ['restoreAsset', ['H/1'], 'POST', `${assetBase}/H%2F1/restore`],
    ['updateAssetStatus', ['H/1', body], 'POST', `${assetBase}/H%2F1/status`, body],
    ['resolveAssetStatus', ['H/1', body], 'POST', `${assetBase}/H%2F1/status/resolve`, body],
    ['loadPlatformPermissions', [], 'GET', '/knowledge-center/api/auth/users'],
    ['loadPlatformPermissions', [{ q: 'a b' }], 'GET', '/knowledge-center/api/auth/users?q=a+b'],
    ['loadPrincipals', [], 'GET', `${platformBase}/principals`],
    ['loadPrincipals', [{ q: 'a b' }], 'GET', `${platformBase}/principals?q=a+b`],
    ['createPrincipal', [body], 'POST', `${platformBase}/principals`, body],
    ['updatePrincipal', ['P/1', body], 'PATCH', `${platformBase}/principals/P%2F1`, body],
    ['deleteOutline', ['O/1'], 'DELETE', `${outlineBase}/O%2F1`],
    ['saveOutlineGovernance', ['O/1', body], 'PUT', `${outlineBase}/O%2F1/governance`, body],
    ['saveOutlineGovernance', ['O/1', null], 'PUT', `${outlineBase}/O%2F1/governance`, {}],
    ['publishOutlineGovernance', ['O/1'], 'POST', `${outlineBase}/O%2F1/publish`, {}],
    ['outlineLifecycle', ['O/1', 'restore'], 'POST', `${outlineBase}/O%2F1/restore`, {}],
    ['outlineLifecycle', ['O/1', 'purge-preflight'], 'GET', `${outlineBase}/O%2F1/purge-preflight`],
    ['loadTechDomains', [], 'GET', '/knowledge-center/api/outline/tech-domains'],
    ['loadDomainBuildTasks', [], 'GET', '/knowledge-center/api/outline/build-tasks'],
    ['loadDomainBuildTask', ['T/1'], 'GET', '/knowledge-center/api/outline/build-tasks/T%2F1'],
    ['updateDomainBuildTaskItem', ['T/1', 'I/1', body], 'PATCH', '/knowledge-center/api/outline/build-tasks/T%2F1/items/I%2F1', body],
    ['loadOutlineRecycle', [], 'GET', `${outlineBase}/recycle`],
  ];
  const unwrap = new Set(['createAsset', 'updateAsset', 'archiveAsset', 'restoreAsset', 'updateAssetStatus', 'resolveAssetStatus', 'loadPrincipals', 'createPrincipal', 'updatePrincipal', 'saveOutlineGovernance', 'publishOutlineGovernance', 'outlineLifecycle', 'loadTechDomains', 'loadDomainBuildTasks', 'loadDomainBuildTask', 'updateDomainBuildTaskItem', 'loadOutlineRecycle']);
  for (const [method, args, verb, url, expectedBody, version] of cases) {
    assert.deepEqual(await api.call(method, args), { value: unwrap.has(method) ? data : response }, method);
    const req = api.requests.at(-1);
    assert.equal(req.method, verb, method);
    assert.equal(req.url, url, method);
    assert.equal(req.headers['if-match'], version, method);
    assert.deepEqual(req.body ? JSON.parse(req.body) : undefined, expectedBody, method);
    if (expectedBody) assert.equal(req.headers['content-type'], 'application/json');
    if (method === 'createTeamGroup') assert.match(req.headers['idempotency-key'], /^team-group-\d+$/);
    if (method === 'saveTeamRoster') assert.match(req.headers['idempotency-key'], /^team-roster-G\/1-\d+$/);
  }
  assert.deepEqual(await api.call('loadAssets', [{ q: 'a b' }], { searchParams: true }), { value: response });
  assert.equal(api.requests.at(-1).url, `${assetBase}?q=a+b`);
  api.reply(okResponse(['legacy']));
  for (const method of ['loadTechDomains', 'loadDomainBuildTasks', 'loadPrincipals']) assert.deepEqual(await api.call(method), { value: ['legacy'] });
  assert.deepEqual(await api.call('loadDomainBuildTask', ['T']), { value: ['legacy'] });
  assert.deepEqual(await api.call('saveOutlineGovernance', ['O', {}]), { value: ['legacy'] });
  api.reply(okResponse({}));
  assert.deepEqual(await api.call('loadOutlineRecycle'), { value: [] });
});

test('平台客户端异常：权限事件、模板团队格式错误与写入失败', async t => {
  const api = await setup(t, 'platform-api-errors', platformModule);
  await api.page.evaluate(() => {
    window.authEvents = [];
    for (const event of ['session-expired', 'permission-denied']) window.addEventListener(`knowledge-center:${event}`, () => window.authEvents.push(event));
  });
  for (const status of [401, 403]) {
    for (const method of ['loadTeamGroups', 'loadTemplates']) {
      api.reply({ status, raw: 'bad JSON' });
      const error = jsonError(await api.call(method));
      assert.equal(error.status, status);
      assert.equal(error.message, status === 401 ? '登录状态已过期' : '没有执行此操作的权限');
      if (method === 'loadTeamGroups') assert.equal(error.code, status === 401 ? 'AUTH_REQUIRED' : 'TEAM_GROUP_MANAGE_FORBIDDEN');
    }
    api.reply({ status, body: { error: { code: 'CUSTOM_AUTH' } } });
    assert.equal((await api.call('loadTeamGroups')).error.code, 'CUSTOM_AUTH');
  }
  assert.deepEqual(await api.page.evaluate(() => window.authEvents), ['session-expired', 'session-expired', 'session-expired', 'permission-denied', 'permission-denied', 'permission-denied']);
  for (const [method, label] of [['loadTeamGroups', '团队小组服务响应异常'], ['loadTemplateVersions', '模板服务响应无效']]) {
    const args = method === 'loadTemplateVersions' ? ['X'] : [];
    for (const reply of [{ status: 200, raw: 'bad JSON' }, { status: 200, body: { success: false } }, { status: 502, body: {} }]) {
      api.reply(reply);
      assert.equal((await api.call(method, args)).error.message, `${label}（HTTP ${reply.status}）`);
    }
    api.reply({ status: 409, body: { error: { code: 'CAS', message: '版本已变更' } } });
    assert.deepEqual(jsonError(await api.call(method, args)), { message: '版本已变更', status: 409, code: 'CAS' });
  }
  api.reply({ status: 500, body: {} });
  assert.deepEqual(jsonError(await api.call('loadTemplates')), { message: 'HTTP 500', status: 500 });
  api.reply({ status: 503, body: { service: 'degraded' } });
  assert.deepEqual(await api.call('loadTemplates'), { value: { service: 'degraded' } });
  api.reply({ status: 200, raw: 'bad JSON' });
  assert.ok((await api.call('loadTemplates')).error);
  for (const [method, args, label] of [
    ['updateAsset', ['H', {}], '保存失败'], ['createAsset', [{}], '操作失败'],
    ['createPrincipal', [{}], '人员新增失败'], ['updatePrincipal', ['P', {}], '人员更新失败'],
  ]) {
    api.reply({ status: 502, raw: 'bad JSON' });
    assert.equal((await api.call(method, args)).error.message, `${label}（HTTP 502）`);
    api.reply({ status: 409, body: { error: { code: 'CAS', message: '服务器说明' } } });
    assert.equal((await api.call(method, args)).error.message, '服务器说明');
  }
});

test('平台聚合读取：默认范围、显式范围与单侧失败隔离', async t => {
  const api = await setup(t, 'platform-api-context', platformModule);
  for (const [args, requested] of [
    [[], { context: true, overview: true }], [[[]], { context: false, overview: false }],
    [[['context']], { context: true, overview: false }], [[['overview']], { context: false, overview: true }],
    [[['all']], { context: true, overview: true }],
  ]) {
    const start = api.requests.length;
    const result = (await api.call('loadPlatformData', args)).value;
    assert.deepEqual(result.requested, requested);
    assert.deepEqual(result.errors, { context: null, overview: null });
    assert.equal(api.requests.length - start, Number(requested.context) + Number(requested.overview));
    assert.deepEqual(result.context, requested.context ? { success: true, data: { accepted: true } } : null);
    assert.deepEqual(result.overview, requested.overview ? { success: true, data: { accepted: true } } : null);
  }
  for (const failed of ['context', 'overview']) {
    routedReplies(api, {
      [`${platformBase}/context`]: failed === 'context' ? { status: 500, body: {} } : okResponse({ source: 'context' }),
      [`${platformBase}/overview`]: failed === 'overview' ? { status: 500, body: {} } : okResponse({ source: 'overview' }),
    });
    const value = await api.page.evaluate(async ({ url, failed }) => {
      const api = await import(url); const result = await api.loadPlatformData();
      return { failed: result[failed], error: result.errors[failed]?.message, other: result[failed === 'context' ? 'overview' : 'context'] };
    }, { url: platformModule, failed });
    assert.deepEqual(value, { failed: null, error: 'HTTP 500', other: { source: failed === 'context' ? 'overview' : 'context' } });
  }
});

test('平台大纲读取：目录快捷路径、版本选择和手册降级', async t => {
  const api = await setup(t, 'platform-api-outline-selection', platformModule);
  const catalog = '/knowledge-center/api/outline/catalog';
  const list = `${outlineBase}/list`;
  const handbooks = `${assetBase}?page=1&pageSize=100`;
  const time = '2026-11-10T00:00:00Z';
  for (const response of [null, {}, { items: 'invalid' }, { data: { items: [], total: 7, snapshotVersion: 's1', generatedAt: time } }, { items: [{ id: 'O' }], total: 1 }]) {
    routedReplies(api, { [catalog]: okResponse(response) });
    const value = (await api.call('loadOutlineData')).value;
    if (response === null) { assert.equal(value.status, 'unavailable'); continue; }
    assert.equal(value.status, 'ok');
    assert.equal(value.detail, null);
    assert.equal(value.selectedId, null);
    assert.ok(Number.isFinite(Date.parse(value.asOf)));
    assert.deepEqual(value.items, Array.isArray(response?.items) ? response.items : []);
    assert.equal(value.total, response?.data?.total || response?.total || 0);
    assert.equal(value.snapshotVersion, response?.data?.snapshotVersion || null);
  }
  const selected = { id: 'O/1', handbookId: 'H/1', name: '手册' };
  routedReplies(api, { [`${catalog}?handbookId=H%2F1&view=directory`]: okResponse({ data: { items: [selected], directory: { nodes: ['目录'] }, selectedId: 'O/1', generatedAt: time } }) });
  const before = api.requests.length;
  assert.deepEqual((await api.call('loadOutlineData', ['H/1', null, 'directory'])).value, { status: 'ok', items: [selected], handbook: { handbookId: 'H/1', name: '手册' }, detail: { nodes: ['目录'] }, selectedId: 'O/1', asOf: time });
  assert.equal(api.requests.length, before + 1, '目录快照命中不重复读取详情');
  for (const view of ['compact', 'directory']) {
    const item = { outlineId: 'O/2', manualId: 'H/1', name: '旧版手册' };
    const catalogUrl = view === 'directory' ? `${catalog}?handbookId=H%2F1&view=directory` : catalog;
    routedReplies(api, { [catalogUrl]: okResponse({ items: [item], generatedAt: time }), [`${outlineBase}/O%2F2?view=${view}`]: okResponse({ data: { nodes: [] } }) });
    const value = (await api.call('loadOutlineData', ['H/1', null, view])).value;
    assert.equal(value.selectedId, 'O/2');
    assert.deepEqual(value.detail, { nodes: [] });
    assert.equal(value.asOf, time);
  }
  const items = [
    { id: 'draft', handbookId: 'H', state: 'draft', updatedAt: '2026-11-10' },
    { outlineId: 'old', manualId: 'H', status: 'published', updated_at: '2026-01-01' },
    { id: 'new', handbookId: 'H', state: 'published', updatedAt: '2026-10-01' },
    { id: 'other', handbookId: 'other' },
  ];
  routedReplies(api, { [catalog]: okResponse({ items: [] }), [list]: okResponse({ data: items, generatedAt: time }), [handbooks]: okResponse({ data: { items: [{ handbookId: 'H', name: '手册H' }] } }), [`${outlineBase}/new?view=compact`]: okResponse({ data: { id: 'new' }, generatedAt: '2026-11-11T00:00:00Z' }) });
  let value = (await api.call('loadOutlineData', ['H'])).value;
  assert.equal(value.selectedId, 'new');
  assert.equal(value.items.length, 3);
  assert.equal(value.handbook.name, '手册H');
  assert.equal(value.asOf, '2026-11-11T00:00:00Z');
  routedReplies(api, { [list]: okResponse({ data: items }), [handbooks]: okResponse({ handbooks: [{ id: 'H' }] }), [`${outlineBase}/old?view=compact`]: okResponse({}) });
  value = (await api.call('loadOutlineData', ['H', 'old'])).value;
  assert.equal(value.selectedId, 'old');
  assert.equal(value.detail, null);
  assert.deepEqual(value.handbook, { id: 'H' });
  value = (await api.call('loadOutlineData', ['H', 'missing'])).value;
  assert.equal(value.status, 'not_found');
  assert.equal(value.selectedId, null);
  for (const [bookResponse, expected] of [
    [okResponse({}), 'not_found'], [okResponse({ items: [{ id: 'H' }] }), 'empty'], [{ status: 500, body: {} }, 'empty'],
  ]) {
    routedReplies(api, { [list]: okResponse({ data: 'invalid' }), [handbooks]: bookResponse });
    value = (await api.call('loadOutlineData', ['H', 'v'])).value;
    assert.equal(value.status, expected);
    if (expected === 'empty') assert.equal(value.handbook.id || value.handbook.handbookId, 'H');
  }
  routedReplies(api, { [catalog]: okResponse({}), [list]: okResponse({ data: [{ handbookId: 'H' }, { manualId: 'H' }] }), [handbooks]: okResponse(null) });
  value = (await api.call('loadOutlineData', ['H'])).value;
  assert.equal(value.status, 'ok');
  assert.equal(value.selectedId, null);
  assert.equal(value.detail, null);
});

test('平台大纲异常投影：业务码中文提示、权限与真实断线', async t => {
  const api = await setup(t, 'platform-api-outline-errors', platformModule);
  const messages = [
    ['OUTLINE_NOT_FOUND', '候选大纲不存在'],
    ['OUTLINE_GATEWAY_REQUIRED', '大纲权限网关配置异常'], ['OUTLINE_AUTH_NOT_CONFIGURED', '大纲权限网关配置异常'],
    ['PUBLISHED_CONTENT_LOCKED', '已发布大纲只能调整技术领域'],
    ['PUBLISHED_ASSIGNMENT_REQUIRED', '已发布大纲不能取消页面的全部技术领域分工'],
    ['OUTLINE_IMMUTABLE', '当前大纲版本已发布或已被替代'],
    ['OUTLINE_VERSION_CONFLICT', '大纲数据已被更新'], ['OUTLINE_EDIT_CONFLICT', '大纲数据已被更新'], ['OUTLINE_GOVERNANCE_CONFLICT', '大纲数据已被更新'],
    ['INVALID_DOMAIN_PAYLOAD', '技术领域分工数据不合法'],
    ['OUTLINE_SERVICE_UNAVAILABLE', '大纲服务暂时不可用'], ['DOCUMENT_API_UNAVAILABLE', '大纲服务暂时不可用'],
  ];
  for (const [code, message] of messages) {
    api.reply({ status: 400, body: { error: { code } } });
    const error = (await api.call('deleteOutline', ['O/1'])).error;
    assert.equal(error.code, code);
    assert.ok(error.message.startsWith(message), code);
    assert.equal(api.requests.at(-1).method, 'DELETE');
  }
  for (const [reply, text] of [
    [{ status: 404, body: {} }, '候选大纲不存在'],
    [{ status: 502, body: {} }, '大纲服务暂时不可用'],
    [{ status: 503, body: {} }, '大纲服务暂时不可用'],
    [{ status: 400, body: { message: ' 上游说明 ' } }, '上游说明'],
    [{ status: 400, raw: 'bad JSON' }, '大纲操作失败，请稍后重试。'],
    [{ status: 400, body: { message: 'Failed to fetch' } }, '无法连接大纲服务'],
  ]) {
    api.reply(reply);
    assert.ok((await api.call('deleteOutline', ['O'])).error.message.startsWith(text));
    assert.ok((await api.call('saveOutlineGovernance', ['O', {}])).error.message.startsWith(text));
  }
  api.reply({ status: 401, body: {} });
  assert.equal((await api.call('deleteOutline', ['O'])).error.message, '登录状态已过期');
  api.reply({ disconnect: true });
  for (const [method, args] of [['deleteOutline', ['O']], ['saveOutlineGovernance', ['O', {}]]]) {
    const error = (await api.call(method, args)).error;
    assert.equal(error.code, 'OUTLINE_SERVICE_UNAVAILABLE');
    assert.match(error.message, /无法连接大纲服务/);
  }
  for (const status of [401, 403, 503, 200]) {
    api.reply({ status, body: status === 200 ? { success: false, error: { code: 'OUTLINE_IMMUTABLE' } } : {} });
    const value = (await api.call('loadOutlineData')).value;
    assert.equal(value.status, status === 403 ? 'forbidden' : 'unavailable');
  }
  api.reply({ status: 503, body: { error: { code: 'OUTLINE_AUTH_NOT_CONFIGURED', message: 'gateway' } } });
  assert.match((await api.call('loadOutlineData')).value.error.message, /权限网关配置异常/);
  for (const [method, args, fallback] of [['loadOutlineRecycle', [], '回收站读取失败'], ['outlineLifecycle', ['O', 'purge-preflight'], '删除检查失败']]) {
    api.reply({ status: 500, body: {} });
    assert.equal((await api.call(method, args)).error.message, fallback);
    api.reply({ status: 409, body: { error: { message: '需刷新', code: 'CAS' } } });
    assert.equal((await api.call(method, args)).error.message, '需刷新');
  }
});

test('平台上传契约：模板、大纲校验导入与人员真实multipart及错误优先级', async t => {
  const api = await setup(t, 'platform-api-imports', platformModule);
  async function upload(method, mode) {
    return api.page.evaluate(async ({ url, method, mode }) => {
      const api = await import(url);
      const file = new File(['导入测试字节\n'], 'contract.xlsx', { type: 'application/octet-stream' });
      const form = new FormData(); form.append('file', file);
      try { return { value: await (method === 'importPrincipals' ? (mode === undefined ? api[method](file) : api[method](file, mode)) : api[method](form)) }; }
      catch (e) { return { error: { message: e.message, status: e.status, code: e.code, details: e.details } }; }
    }, { url: platformModule, method, mode });
  }
  for (const [method, mode, url, unwrap] of [
    ['importTemplate', undefined, `${templateBase}/import`, false],
    ['importOutline', undefined, '/knowledge-center/api/outline/import', false],
    ['validateOutline', undefined, '/knowledge-center/api/outline/validate', false],
    ['importPrincipals', undefined, `${platformBase}/principals/import?mode=preview`, true],
    ['importPrincipals', '确认 /', `${platformBase}/principals/import?mode=${encodeURIComponent('确认 /')}`, true],
  ]) {
    const result = await upload(method, mode);
    assert.deepEqual(result.value, unwrap ? { accepted: true } : { success: true, data: { accepted: true } });
    const req = api.requests.at(-1);
    assert.equal(req.url, url);
    assert.equal(req.method, 'POST');
    assert.match(req.headers['content-type'], /^multipart\/form-data; boundary=/);
    assert.match(req.body, /filename="contract.xlsx"/);
    assert.match(req.body, /导入测试字节\r?\n/);
  }
  for (const status of [401, 403]) {
    api.reply({ status, raw: 'bad JSON' });
    assert.equal((await upload('importOutline')).error.message, status === 401 ? '登录状态已过期' : '没有执行此操作的权限');
  }
  for (const [body, expected, details] of [
    [{ error: { message: '顶层错误', details: ['字段'] }, message: '次要错误' }, '顶层错误', ['字段']],
    [{ message: '次要错误' }, '次要错误', []],
    [{ data: { items: [{ status: 'failed', error: { message: '错误一' } }, { status: 'ok', error: { message: '忽略' } }, { status: 'failed' }, { status: 'failed', error: { message: '错误二' } }] } }, '错误一；错误二', []],
    [{}, '导入失败（HTTP 422）', []],
  ]) {
    api.reply({ status: 422, body });
    const error = (await upload('importOutline')).error;
    assert.equal(error.message, expected);
    assert.deepEqual(error.details, details);
  }
  api.reply({ status: 422, raw: 'bad JSON' });
  assert.equal((await upload('importOutline')).error.message, '导入失败（HTTP 422）');
  assert.equal((await upload('validateOutline')).error.message, '校验未通过，请按提示修改');
  assert.equal((await upload('importPrincipals')).error.message, '人员导入失败（HTTP 422）');
  api.reply({ status: 422, body: { error: { message: '格式错误', code: 'FORMAT' } } });
  for (const method of ['validateOutline', 'importPrincipals']) assert.equal((await upload(method)).error.message, '格式错误');
  api.reply(okResponse(null));
  for (const method of ['validateOutline', 'importOutline']) assert.deepEqual((await upload(method)).value, null);
});

test('平台权限客户端：本地版本和幂等校验、CAS请求与失败恢复', async t => {
  const api = await setup(t, 'platform-api-permissions', platformModule);
  for (const changes of [undefined, null, {}, { rowVersion: null }, { rowVersion: 'invalid' }, { rowVersion: 1.5 }]) {
    assert.equal((await api.call('updatePlatformUserPermissions', ['U/1', changes])).error.message, '用户权限数据已过期，请刷新后重试');
  }
  for (const changes of [{ rowVersion: 0 }, { rowVersion: 2, idempotencyKey: '  ' }]) assert.equal((await api.call('updatePlatformUserPermissions', ['U/1', changes])).error.message, '权限保存请求缺少幂等标识，请重试');
  assert.equal(api.requests.length, 0, '本地无效输入不发出权限写请求');
  for (const rowVersion of [0, '3']) {
    assert.deepEqual(await api.call('updatePlatformUserPermissions', ['U/1', { rowVersion, idempotencyKey: ' key ', roles: ['reader'], ignored: true }]), { value: { accepted: true } });
    const req = api.requests.at(-1);
    assert.equal(req.url, '/knowledge-center/api/auth/users/U%2F1/roles');
    assert.equal(req.method, 'PATCH');
    assert.equal(req.headers['if-match'], String(rowVersion));
    assert.equal(req.headers['idempotency-key'], 'key');
    assert.deepEqual(JSON.parse(req.body), { roles: ['reader'] });
  }
  const args = ['U', { rowVersion: 1, idempotencyKey: 'same-key', roles: [] }];
  api.reply({ status: 409, body: { error: { message: '版本冲突' } } });
  assert.deepEqual(jsonError(await api.call('updatePlatformUserPermissions', args)), { message: '版本冲突', status: 409 });
  api.reply({ status: 500, raw: 'bad JSON' });
  assert.equal((await api.call('updatePlatformUserPermissions', args)).error.message, '权限保存失败（HTTP 500）');
  api.reply(okResponse({ legacy: true }));
  assert.deepEqual(await api.call('updatePlatformUserPermissions', args), { value: { legacy: true } });
  api.reply(okResponse(null));
  assert.deepEqual(await api.call('updatePlatformUserPermissions', args), { value: null });
});
