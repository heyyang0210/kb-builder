const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const artifacts = path.resolve('runtime/test-results/platform-models'); fs.mkdirSync(artifacts, { recursive: true });
const configRoot = fs.mkdtempSync(path.join(artifacts, 'config-'));
const configFile = path.join(configRoot, 'service.json');
fs.writeFileSync(configFile, JSON.stringify({ mcp: { untouched: true }, model: {} }));
const registryPath = require.resolve('../../../packages/agent-runner-core/lib/config-registry');
const registry = require(registryPath);
require.cache[registryPath].exports = { ...registry, CONFIG_PATHS: { ...registry.CONFIG_PATHS, service: configFile } };
const manager = require('../../../packages/agent-runner-core/lib/config-manager');
const { createModelGovernance } = require('../../../packages/agent-runner-core/lib/platform-management/model-governance');
const governance = createModelGovernance({ configManager: manager });
const { setup } = require('./fixtures/production-writing.cjs');
const { instrumentFrontend } = require('./fixtures/frontend-coverage.cjs');

test('模型管理与写作闭环：真实加密配置、双协议HTTP、权限、默认模型与采用追溯', async t => {
  t.after(() => { manager.watcher?.close(); fs.rmSync(configRoot, { recursive: true, force: true }); });
  const calls = []; let upstreamFail = false; let holdNext = false; let releaseUpstream;
  const upstream = http.createServer(async (req, res) => {
    let text = ''; for await (const chunk of req) text += chunk;
    const body = JSON.parse(text); calls.push({ url: req.url, model: body.model, authorization: req.headers.authorization });
    if (holdNext) { holdNext = false; await new Promise(resolve => { releaseUpstream = resolve; }); }
    if (upstreamFail) { res.writeHead(401); res.end('model-fixture-secret'); return; }
    if (body.stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const chunks = req.url.endsWith('/responses')
        ? [{ type: 'response.created', response: { model: body.model + '-actual' } }, { type: 'response.output_text.delta', delta: '由所选模型生成的 SQL 文档。' }, { type: 'response.completed', response: { status: 'completed', model: body.model + '-actual', usage: { input_tokens: 5, output_tokens: 8, total_tokens: 13 } } }]
        : [{ model: body.model + '-actual', choices: [{ delta: { role: 'assistant' } }] }, { model: body.model + '-actual', choices: [{ delta: { content: 'OK' } }] }];
      for (const chunk of chunks) res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      res.end('data: [DONE]\n\n'); return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(req.url.endsWith('/responses') ? {
      id: 'resp-fixture', status: 'completed', model: body.model + '-actual',
      output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '由所选模型生成的 SQL 文档。', annotations: [] }] }],
      usage: { input_tokens: 5, output_tokens: 8, total_tokens: 13 },
    } : { choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }], model: body.model + '-actual', usage: { total_tokens: 1 } }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { upstream.close(resolve); upstream.closeAllConnections(); }));
  const base_url = `http://127.0.0.1:${upstream.address().port}/v1`;
  const session = { authenticated: true, user: { id: 'model-admin', roles: ['PLATFORM_ADMIN'] }, allowedActions: ['knowledge:read', 'knowledge:write'] };
  const api = await setup(t, { browser: true, session, ai: { modelGovernance: governance } });
  const browser = await chromium.launch({ headless: true, args: ['--host-resolver-rules=MAP model-http.test 127.0.0.1', '--no-proxy-server'] }); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } }); page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const captureCoverage = await instrumentFrontend(page, 'platform-model');
  await page.goto(api.origin.replace('127.0.0.1', 'model-http.test') + '/browser-fixture');
  assert.equal(await page.evaluate(() => window.isSecureContext), false, '按非安全 HTTP 地址复现');
  assert.equal(await page.evaluate(() => typeof globalThis.crypto?.randomUUID), 'undefined');
  const openModelAdmin = async () => {
    await page.addStyleTag({ url: '/knowledge-center/modules/platform-admin/platform-admin.css' });
    await page.evaluate(async () => {
      const { renderPlatformAdmin } = await import('/knowledge-center/modules/platform-admin/view.js');
      const { mountModelConnection: mountModelAdmin } = await import('/knowledge-center/modules/platform-admin/model-connection.js');
      document.querySelector('#view-root').innerHTML = renderPlatformAdmin({ platformTab: 'models', platformAdmin: true });
      mountModelAdmin(document.querySelector('[data-model-admin]'));
    });
    await page.waitForFunction(() => document.querySelector('[data-model-admin]')?.dataset.dirty === 'false' && document.querySelector('[data-model-admin]')?.getAttribute('aria-busy') === 'false');
    assert.equal(await page.locator('[data-model-status]').textContent(), '', '正常首次加载不残留成功提示');
    assert.match(await page.locator('[data-model-add]').textContent(), /添加服务/);
  };
  await openModelAdmin();
  const platformApiChecks = await page.evaluate(async () => {
    const api = await import('/knowledge-center/common/api/platform-api.js');
    const calls = [];
    const originalFetch = window.fetch;
    let mode = 'ok';
    window.addEventListener('knowledge-center:session-expired', () => { window.apiSessionExpired = true; });
    window.addEventListener('knowledge-center:permission-denied', () => { window.apiPermissionDenied = true; });
    window.fetch = async (url, options = {}) => {
      const path = String(url);
      calls.push({ path, method: options.method || 'GET', headers: options.headers || {}, body: options.body });
      if (mode === 'network') throw new TypeError('Failed to fetch');
      if (mode === 'catalog-miss' && path.includes('/outline/catalog')) return new Response(JSON.stringify({ success: true, data: { items: [] } }), { status: 200 });
      if (mode === 'catalog-selected' && path.includes('/outline/catalog')) return new Response(JSON.stringify({ success: true, data: { items: [{ id: 'out 1', handbookId: 'HB 1', name: '手册' }], selectedId: 'out 1', directory: { nodes: [] } } }), { status: 200 });
      if (mode === 'list-empty' && path.endsWith('/governance/list')) return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
      if (mode === 'list-empty' && path.includes('/assets/handbooks')) return new Response(JSON.stringify({ success: true, data: { items: [] } }), { status: 200 });
      if (mode === 'list-with-item' && path.endsWith('/governance/list')) return new Response(JSON.stringify({ success: true, data: [{ id: 'version-1', handbookId: 'HB 1', state: 'PUBLISHED' }] }), { status: 200 });
      if (mode === 'list-with-item' && path.includes('/assets/handbooks')) return new Response(JSON.stringify({ success: true, data: { items: [{ id: 'HB 1', name: '手册' }] } }), { status: 200 });
      if (mode === 'forbidden') return new Response(JSON.stringify({ success: false, error: { code: 'DENIED', message: 'forbidden' } }), { status: 403 });
      if (mode === 'unauthorized') return new Response(JSON.stringify({ success: false, error: { code: 'AUTH_REQUIRED' } }), { status: 401 });
      if (mode === 'failed-import') return new Response(JSON.stringify({ data: { items: [{ status: 'failed', error: { message: '行失败' } }] } }), { status: 422 });
      if (mode === 'failed-code') return new Response(JSON.stringify({ error: { code: 'PUBLISHED_CONTENT_LOCKED', message: 'locked' } }), { status: 409 });
      if (mode === 'invalid-json') return new Response('{', { status: 200 });
      return new Response(JSON.stringify({ success: true, data: { items: [], total: 0, id: 'ok', roles: ['REVIEWER'] } }), { status: 200 });
    };
    await api.loadTemplates({ q: 'SQL 参考' });
    await api.loadDatabaseConnection(); await api.loadDatabaseConnectionStatus();
    await api.testDatabaseConnection({ host: 'db' }); await api.saveDatabaseConnection({ host: 'db' }, 3);
    await api.loadTeamGroups(); await api.createTeamGroup({ name: '团队' }); await api.loadTeamGroup('组 / 1');
    await api.previewTeamRoster('组 / 1', { people: [] }); await api.saveTeamRoster('组 / 1', { people: [] }, 4);
    await api.loadTemplate('模板 / 1'); await api.createTemplate({ name: '模板' }); await api.saveTemplate('模板 / 1', {});
    await api.importTemplate(new FormData()); await api.loadTemplateVersions('模板 / 1'); await api.loadTemplateVersion('模板 / 1', 2);
    await api.restoreTemplateDraft('模板 / 1', 2); await api.updateTemplateMetadata('模板 / 1', {});
    await api.setTemplateEnabled('模板 / 1', true); await api.setTemplateEnabled('模板 / 1', false);
    await api.loadTemplateMappingRules(); await api.previewTemplateMappingRules({}); await api.saveTemplateMappingRules({});
    await api.loadTemplateMappings({ handbookId: 'HB 1' }); await api.analyzeTemplateMappings('HB 1');
    await api.loadTemplateMappingBatch('批次 / 1'); await api.cancelTemplateMappingBatch('批次 / 1'); await api.decideTemplateMapping({});
    await api.loadPlatformData(); await api.loadPlatformData(['context']); await api.loadPlatformData(['overview']);
    mode = 'catalog-selected'; await api.loadOutlineData('HB 1', null, 'directory');
    mode = 'ok'; await api.loadOutlineData('HB 1', null, 'compact');
    mode = 'catalog-miss'; const missing = await api.loadOutlineData('HB missing');
    mode = 'list-empty'; const notFound = await api.loadOutlineData('HB absent', 'version-x');
    mode = 'list-with-item'; await api.loadOutlineData('HB 1', 'version-1');
    mode = 'forbidden'; const forbidden = await api.loadOutlineData('HB 1');
    mode = 'failed-code'; await api.loadOutlineData('HB 1');
    mode = 'network'; await api.loadOutlineData('HB 1');
    mode = 'ok'; await api.importOutline(new FormData()); await api.validateOutline(new FormData());
    mode = 'unauthorized'; try { await api.importOutline(new FormData()); } catch {}
    mode = 'failed-import'; try { await api.importOutline(new FormData()); } catch (error) { if (error.message !== '行失败') throw error; }
    mode = 'invalid-json'; try { await api.validateOutline(new FormData()); } catch {}
    mode = 'ok'; await api.deleteOutline('out / 1'); await api.loadOutlineRecycle();
    await api.outlineLifecycle('out / 1', 'restore', {}); await api.outlineLifecycle('out / 1', 'purge-preflight');
    await api.saveOutlineGovernance('out / 1', {}); await api.publishOutlineGovernance('out / 1');
    await api.loadTechDomains(); await api.loadDomainBuildTasks(); await api.loadDomainBuildTask('task / 1');
    await api.updateDomainBuildTaskItem('task / 1', 'item / 1', {}); await api.updateAsset('HB / 1', {}); await api.loadAssets({ state: 'ACTIVE' });
    await api.createAsset({ name: '手册' }); await api.archiveAsset('HB / 1'); await api.restoreAsset('HB / 1');
    await api.updateAssetStatus('HB / 1', {}); await api.resolveAssetStatus('HB / 1', {});
    await api.loadPlatformPermissions({ page: 2 }); await api.loadPrincipals({ q: '何阳' });
    try { await api.updatePlatformUserPermissions('用户 / 1', { rowVersion: 1, idempotencyKey: 'key', roles: ['REVIEWER'] }); } catch {}
    try { await api.updatePlatformUserPermissions('u', { rowVersion: 'bad', idempotencyKey: 'key' }); } catch {}
    try { await api.updatePlatformUserPermissions('u', { rowVersion: 1 }); } catch {}
    await api.createPrincipal({ displayName: '何阳' }); await api.updatePrincipal('用户 / 1', {});
    await api.importPrincipals(new Blob(['csv']), 'apply');
    mode = 'forbidden'; try { await api.loadTeamGroups(); } catch {}
    mode = 'unauthorized'; try { await api.loadTeamGroups(); } catch {}
    mode = 'invalid-json'; try { await api.createTeamGroup({ name: 'bad' }); } catch {}
    mode = 'failed-code'; try { await api.createPrincipal({}); } catch {}
    const { renderPlatformAdmin, renderPermissionResults } = await import('/knowledge-center/modules/platform-admin/view.js');
    const rendered = [];
    const render = state => rendered.push(renderPlatformAdmin(state));
    render({ platformTab: 'governance', projection: { asOf: '2026-01-01' }, platformAdmin: false,
      governanceProjection: { services: [{ name: '认证', status: 'ok' }, { name: '文档', status: 'warning' }], pendingItems: [{ title: '待处理', description: '描述', actionUrl: '/review' }], recentOperations: [{ result: 'success' }, { result: 'failure' }, { result: 'warning' }] },
      databaseConnectionProjection: { healthStatus: 'healthy', environmentOverride: true, restartRequired: true, configured: true, connection: { jdbcUrl: 'jdbc:fixture', username: 'reader' }, lastVerification: { verifiedAt: '2026-01-01' } },
      databaseConnectionDrawerOpen: true, databaseConnectionAdvancedOpen: true, databaseConnectionStatus: { kind: 'pending' } });
    render({ platformTab: 'governance', governanceProjection: { services: [], pendingItems: [] }, databaseConnectionProjection: { healthStatus: 'unavailable', healthError: { message: 'offline' } }, databaseConnectionDrawerOpen: true });
    render({ platformTab: 'principals', principalProjection: { status: 'unavailable', error: 'offline' }, platformAdmin: true });
    render({ platformTab: 'principals', teamGroupView: 'groups', teamGroupProjection: { status: 'loading' }, principalProjection: { items: [] } });
    render({ platformTab: 'principals', teamGroupView: 'groups', teamGroupProjection: { status: 'unavailable', statusCode: 404 }, principalProjection: { items: [] } });
    render({ platformTab: 'principals', teamGroupView: 'groups', teamGroupProjection: { items: [{ teamGroupId: 1, groupName: '研发', members: [{ principalId: 2, displayName: '成员' }], leader: { principalId: 1 } }], total: 1 }, principalProjection: { items: [{ principalId: 1, displayName: '负责人', state: 'ACTIVE' }, { principalId: 2, displayName: '成员', state: 'ACTIVE' }] }, teamGroupUi: { saveStatus: { groupId: '1', kind: 'saved' }, impact: { groupId: '1', summary: '影响提示' } } });
    render({ platformTab: 'principals', principalProjection: { items: [{ principalId: 1, displayName: '何阳', casLoginName: 'heyang', state: 'ACTIVE', manualReferenceCount: 2, lastLoginAt: '2026-01-01' }, { principalId: 2, displayName: '离职', state: 'INACTIVE' }] }, principalListState: { search: '何', bindingStatus: 'BOUND', state: 'ACTIVE' } });
    render({ platformTab: 'permissions', permissionProjection: { status: 'unavailable' } });
    render({ platformTab: 'permissions', permissionProjection: { users: [] } });
    const permissionData = { users: [{ id: 'u1', displayName: '何阳', loginName: 'heyang', enabled: true, roles: ['REVIEWER'], rolesEditable: true, identitySource: 'cas' }, { id: 'u2', name: '本地用户', enabled: false, status: 'disabled', roles: [], identitySource: 'local' }], roles: ['REVIEWER', 'UNKNOWN'], pagination: { page: 2, totalPages: 3, total: 20 }, generatedAt: '2026-01-01' };
    const results = renderPermissionResults(permissionData, 'u1', 'saving', '何', { status: 'active', role: 'REVIEWER', page: 2, pageSize: 1 });
    rendered.push(results.listHtml + results.detailHtml);
    render({ platformTab: 'permissions', permissionProjection: permissionData, selectedPermissionUserId: 'u2', permissionSaveStatus: { error: '保存失败' }, permissionListState: { status: 'inactive' }, platformAdmin: true });
    render({ platformTab: 'gitlab', platformAdmin: false, gitlabProjection: { connections: [] } });
    render({ platformTab: 'gitlab', platformAdmin: true, gitlabListState: { search: 'none' }, gitlabProjection: { connections: [] } });
    render({ platformTab: 'gitlab', platformAdmin: true, gitlabAddingConnection: true });
    render({ platformTab: 'gitlab', platformAdmin: true, gitlabEditingConnection: { id: 'c1', name: '编辑', authMode: 'service_account', credentialConfigured: true, purpose: 'read_write' } });
    const connections = [
      { id: 'c1', name: 'OAuth', projectPath: 'team/docs', authMode: 'user_oauth', purpose: 'read_write', status: 'active', lastVerification: { status: 'verified', verifiedAt: '2026-01-01', branchCount: 2 } },
      { id: 'c2', name: 'Disabled', project: 'team/old', managementStatus: 'disabled', authMode: 'service_account', credentialConfigured: false, lastVerification: { status: 'failed', error: { message: 'error', recovery: 'retry' } } },
      { id: 'c3', name: 'Pending', authMode: 'user_oauth', status: 'active', lastVerification: { status: 'pending_auth', message: '授权' } },
    ];
    render({ platformTab: 'gitlab', platformAdmin: true, gitlabProjection: { connections, oauthStatus: { connected: false }, oauthConfig: { configured: false } }, gitlabListState: { selectedConnectionId: 'c1', page: 1, pageSize: 1 }, gitlabVerification: { connectionId: 'c1', status: 'verifying' } });
    render({ platformTab: 'gitlab', platformAdmin: false, gitlabProjection: { connections }, gitlabListState: { search: 'Pending' }, gitlabVerification: { connectionId: 'c3', status: 'pending_auth', message: '授权中' } });
    if (rendered.length < 14 || !rendered.some(html => html.includes('尚未初始化')) || !rendered.some(html => html.includes('REVIEWER'))) throw new Error('platform admin rendering matrix incomplete');
    window.fetch = originalFetch;
    return { calls: calls.length, missing: missing.status, notFound: notFound.status,
      forbidden: forbidden.status, sessionExpired: window.apiSessionExpired,
      permissionDenied: window.apiPermissionDenied,
      checkedMethods: calls.some(item => item.method === 'PATCH') && calls.some(item => item.method === 'DELETE') && calls.some(item => item.method === 'PUT'), rendered: rendered.length };
  });
  assert(platformApiChecks.calls >= 60, '平台 API 公开方法均实际执行');
  assert.equal(platformApiChecks.missing, 'not_found');
  assert.equal(platformApiChecks.notFound, 'not_found');
  assert.equal(platformApiChecks.forbidden, 'forbidden');
  assert.equal(platformApiChecks.sessionExpired, true);
  assert.equal(platformApiChecks.permissionDenied, true);
  assert.equal(platformApiChecks.checkedMethods, true);
  assert(platformApiChecks.rendered >= 14, '平台管理视图状态矩阵已渲染');
  await page.locator('[data-model-add]').click();
  let row = page.locator('.model-service').first();
  assert.equal(await row.locator('.model-advanced').evaluate(el => el.open), false);
  assert.equal(await row.locator('[name=enabled]').isChecked(), true);
  assert.equal(await row.locator('[name=base_url]').inputValue(), 'https://api.openai.com/v1');
  await row.locator('[name=provider]').selectOption('deepseek');
  assert.equal(await row.locator('[name=base_url]').inputValue(), 'https://api.deepseek.com/v1');
  await row.locator('[name=base_url]').fill(base_url);
  await row.locator('[name=provider]').selectOption('alibaba');
  assert.equal(await row.locator('[name=base_url]').inputValue(), base_url, '手填地址不能被预设覆盖');
  await row.locator('[name=name]').fill('默认服务'); await row.locator('[name=provider]').selectOption('custom');
  await row.locator('[name=base_url]').fill(base_url); await row.locator('[name=api_key]').fill('model-fixture-secret');
  await row.locator('[name=models]').fill('model-a\nmodel-a2'); await row.locator('[name=enabled]').check();
  assert.equal(await page.locator('[data-model-default] option:checked').textContent(), '默认服务 / model-a', '首个模型自动成为默认');
  await row.locator('[data-test-model]').click(); await row.locator('[data-row-result]').filter({ hasText: '测试成功' }).waitFor();
  assert.equal(governance.available().options.length, 0, '测试不得保存');
  await page.locator('[data-model-admin] button[type=submit]').click();
  await page.waitForFunction(() => document.querySelector('[data-model-admin]').dataset.dirty === 'false');
  assert.equal(await row.locator('.model-service-editor').evaluate(el => el.open), false, '保存后服务默认折叠');
  assert(await row.locator('[data-test-saved]').isVisible(), '折叠行应显示测试按钮');
  await row.locator('.model-service-summary').click();
  await row.locator('[name=testModel]').selectOption('model-a2');
  assert.equal(await page.locator('[data-model-admin]').getAttribute('data-dirty'), 'false', '测试选择不属于配置修改');
  await row.locator('.model-service-summary').click();
  const previousTestCount = calls.length;
  await row.locator('[data-test-saved]').click();
  await page.waitForFunction(() => document.querySelector('[data-row-result]')?.textContent.includes('model-a2-actual'));
  assert.equal(calls.length, previousTestCount + 1, '测试按钮真实调用已保存的服务');
  assert.equal(calls.at(-1).model, 'model-a2', '折叠测试使用记忆选择');
  assert.equal(await row.locator('.model-service-editor').evaluate(el => el.open), false, '测试不展开服务行');
  assert(await row.locator('[data-row-result] strong').isVisible(), '折叠时可看到测试结果');
  assert.equal(await row.locator('[data-row-result] strong').textContent(), '测试成功');
  const successColor = await row.locator('[data-row-result] strong').evaluate(el => getComputedStyle(el).color);
  await page.screenshot({ path: path.join(artifacts, 'test-feedback-success.png'), fullPage: true });
  upstreamFail = true;
  await row.locator('[data-test-saved]').click();
  await row.locator('[data-row-result]').filter({ hasText: '测试失败' }).waitFor();
  const failureColor = await row.locator('[data-row-result] strong').evaluate(el => getComputedStyle(el).color);
  assert.notEqual(successColor, failureColor, '成功和失败颜色不同');
  await page.screenshot({ path: path.join(artifacts, 'test-feedback-failure.png'), fullPage: true });
  upstreamFail = false;
  await page.locator('[data-model-reload]').click();
  await page.waitForFunction(() => document.querySelector('[data-model-status]').textContent.includes('已读取'));
  assert.equal(await row.locator('[name=testModel]').inputValue(), 'model-a2', '重新打开配置恢复选择');
  await captureCoverage();
  await page.reload();
  await openModelAdmin();
  assert.equal(await row.locator('[name=testModel]').inputValue(), 'model-a2', '整页刷新恢复上次测试模型');
  assert.equal(await row.locator('[data-row-result]').textContent(), '', '不将历史测试结果当作当前状态');

  await row.locator('.model-service-summary').click();
  assert.equal(await row.locator('[name=base_url]').isVisible(), true, '点击摘要展开配置');
  await row.locator('.model-service-summary').click();
  assert.equal(await row.locator('[name=api_key]').inputValue(), '');
  assert(!fs.readFileSync(configFile, 'utf8').includes('model-fixture-secret'));
  assert.deepEqual(JSON.parse(fs.readFileSync(configFile, 'utf8')).mcp, { untouched: true });
  assert.equal(manager.getModelConfigSync().services[0].api_key, 'model-fixture-secret');
  await page.locator('[data-model-add]').click(); row = page.locator('.model-service').last();
  await row.locator('[name=name]').fill('Responses 服务'); await row.locator('[name=provider]').selectOption('custom');
  await row.locator('.model-advanced > summary').click();
  await row.locator('[name=protocol]').selectOption('responses'); await row.locator('[name=base_url]').fill(base_url);
  await row.locator('[name=api_key]').fill('model-fixture-secret'); await row.locator('[name=models]').fill('model-b'); await row.locator('[name=enabled]').check();
  await row.locator('[data-test-model]').click(); await row.locator('[data-row-result]').filter({ hasText: 'model-b-actual' }).waitFor();
  await page.locator('[data-model-admin] button[type=submit]').click(); await page.waitForFunction(() => document.querySelector('[data-model-admin]').dataset.dirty === 'false');
  assert.equal(await page.locator('.model-service-editor[open]').count(), 0, '已有服务全部折叠');
  assert((await page.locator('.model-service').first().boundingBox()).height < 90, '折叠行保持紧凑');
  await page.locator('[data-model-add]').click();
  assert.equal(await page.locator('.model-service-editor[open]').count(), 1, '新建服务展开编辑');
  await page.locator('.model-service').last().locator('[data-remove-model]').click();
  assert.equal(await page.locator('.model-service').count(), 2, '删除未保存的新服务');
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('.model-service').first().locator('[data-remove-model]').click();
  assert.equal(await page.locator('.model-service').count(), 2, '取消删除保留服务');
  await page.locator('[data-model-admin] button[type=submit]').click();
  await page.waitForFunction(() => document.querySelector('[data-model-admin]').dataset.dirty === 'false');
  const initial = governance.get();
  const p = await governance.save({ services: initial.services, defaultSelection: { serviceId: initial.services[1].id, model: 'model-b' } }, initial.rowVersion, 'admin');
  const oldCatalog = governance.available();
  assert(!JSON.stringify(p).includes('model-fixture-secret')); assert(!JSON.stringify(oldCatalog).includes(base_url));
  await assert.rejects(governance.save({ services: p.services, defaultSelection: p.defaultSelection }, 'stale', 'test'), { code: 'MODEL_CONFIG_CONFLICT' });
  await assert.rejects(governance.save({ services: p.services.map((s, i) => ({ ...s, base_url: i ? s.base_url : base_url + '/changed' })), defaultSelection: p.defaultSelection }, p.rowVersion, 'test'), { code: 'MODEL_CONFIG_INVALID' });
  upstreamFail = true;
  await assert.rejects(governance.test({ service: p.services[0], model: 'model-a' }, p.rowVersion), e => e.code === 'MODEL_CONNECTION_FAILED' && !e.message.includes('model-fixture-secret'));
  upstreamFail = false;
  await page.screenshot({ path: path.join(artifacts, 'admin-models.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '模型配置窄屏无横向溢出');
  await page.screenshot({ path: path.join(artifacts, 'admin-models-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1366, height: 1000 });
  session.user.roles = ['KNOWLEDGE_EDITOR'];
  const denied = await fetch(api.origin + '/knowledge-center/api/platform/models'); assert.equal(denied.status, 403);
  const catalog = await api.request('GET', '/models'); assert.equal(catalog.status, 200); assert.equal(catalog.body.data.options.length, 3);
  await page.evaluate(async () => {
    const { openProductionWritingPage } = await import('/knowledge-center/modules/production/production-writing-page.js');
    document.querySelector('#view-root').innerHTML = '<button id="open">写作</button>';
    openProductionWritingPage({ context: { handbookId: 'HB-1', documentId: 'sql-one', outlineVersionId: 'outline-v1', branch: 'main' },
      operation: 'polish', editVersion: 0, outline: 'SQL 参考手册', getMarkdown: () => '原始 SQL 资料。', baselineDigest: async () => '',
      onAdopt: result => { window.adopted = result; }, trigger: document.querySelector('#open') });
  });
  await page.locator('[data-ai-start]').click();
  try { await page.locator('[data-ai-candidate]:visible').waitFor(); } catch (error) {
    await page.screenshot({ path: path.join(artifacts, 'writing-failure.png'), fullPage: true });
    error.message += '\n页面状态：' + await page.locator('[data-ai-status]').textContent(); throw error;
  }
  assert(await page.locator('[data-ai-fragment]').inputValue());
  assert.equal(calls.at(-1).url, '/v1/responses'); assert.equal(calls.at(-1).model, 'model-b'); assert.equal(calls.at(-1).authorization, 'Bearer model-fixture-secret');
  await page.screenshot({ path: path.join(artifacts, 'writing-model-selection.png'), fullPage: true });
  await page.locator('[data-ai-adopt]').click(); await page.waitForFunction(() => window.adopted);
  const suffix = '/handbooks/HB-1/documents/sql-one'; const ctx = { outlineVersionId: 'outline-v1', branch: 'main' };
  const draft = await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx));
  assert.equal(draft.body.data.draft.revision.generationMetadata.modelSelection.model, 'model-b');
  assert.equal(draft.body.data.draft.revision.generationMetadata.model, 'model-b-actual'); assert(!JSON.stringify(draft).includes('model-fixture-secret'));
  holdNext = true;
  const snapshotBody = { ...ctx, operation: 'polish', markdown: '原文', range: { start: 0, end: 2 }, editVersion: 0, modelSelection: oldCatalog.options[2] };
  const snapshotPath = '/handbooks/HB-1/documents/snapshot/ai-jobs';
  const snapshotHeaders = { 'Content-Type': 'application/json', 'Idempotency-Key': 'snapshot-model' };
  const started = await api.request('POST', snapshotPath, JSON.stringify(snapshotBody), snapshotHeaders);
  assert.equal(started.status, 202);
  for (let i = 0; i < 100 && !releaseUpstream; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert(releaseUpstream, '所选请求应已到达上游');
  const changed = await governance.save({ services: p.services.map((s, i) => ({ ...s, enabled: i === 0 })), defaultSelection: { serviceId: p.services[0].id, model: 'model-a' } }, p.rowVersion, 'admin');
  releaseUpstream();
  let finished;
  for (let i = 0; i < 100; i++) {
    finished = await api.request('GET', snapshotPath + '/' + started.body.data.jobId + '?' + new URLSearchParams(ctx));
    if (finished.body.data.status === 'completed') break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(finished.body.data.status, 'completed');
  assert.equal(finished.body.data.metadata.modelSelection.configVersion, oldCatalog.configVersion);
  const callCount = calls.length;
  const replay = await api.request('POST', snapshotPath, JSON.stringify(snapshotBody), snapshotHeaders);
  assert.equal(replay.status, 202); assert.equal(replay.body.data.jobId, started.body.data.jobId); assert.equal(calls.length, callCount);
  const payload = { ...ctx, operation: 'polish', markdown: '原始 SQL 资料。', range: { start: 0, end: 10 }, editVersion: 0, modelSelection: oldCatalog.options[2] };
  const stale = await api.request('POST', '/handbooks/HB-1/documents/another/ai-jobs', JSON.stringify(payload), { 'Content-Type': 'application/json', 'Idempotency-Key': 'stale-model' });
  assert.equal(stale.status, 409); assert.equal(stale.body.error.code, 'MODEL_SELECTION_STALE');
  session.allowedActions = []; session.user.roles = [];
  assert.equal((await api.request('GET', '/models')).status, 403);
  session.allowedActions = ['knowledge:read', 'knowledge:write'];
  session.user.roles = ['KNOWLEDGE_EDITOR'];
  assert.throws(() => governance.resolve({ ...oldCatalog.options[2], configVersion: changed.rowVersion }), { code: 'MODEL_NOT_AVAILABLE' });
  const disabled = await governance.save({ services: changed.services.map(s => ({ ...s, enabled: false })), defaultSelection: null }, changed.rowVersion, 'admin');
  const cleared = await governance.save({ services: disabled.services.map(s => ({ ...s, clearApiKey: true })), defaultSelection: null }, disabled.rowVersion, 'admin');
  assert(cleared.services.every(s => !s.api_key_configured && !s.credentialAvailable));
  await assert.rejects(governance.save({ services: cleared.services.map(s => ({ ...s, enabled: true })), defaultSelection: { serviceId: cleared.services[0].id, model: 'model-a' } }, cleared.rowVersion, 'admin'), { code: 'MODEL_CONFIG_INVALID' });
  await captureCoverage();
  await page.goto(api.origin.replace('127.0.0.1', 'model-http.test') + '/browser-fixture');
  assert.equal(await page.evaluate(() => window.isSecureContext), false, '按非安全 HTTP 地址复现');
  assert.equal(await page.evaluate(() => typeof globalThis.crypto?.randomUUID), 'undefined');
  await page.evaluate(async () => { const { openProductionWritingPage } = await import('/knowledge-center/modules/production/production-writing-page.js'); openProductionWritingPage({ context: { handbookId: 'HB-1', documentId: 'empty', outlineVersionId: 'outline-v1', branch: 'main' }, operation: 'polish', getMarkdown: () => '正文', editVersion: 0 }); });
  await page.locator('[data-ai-settings-open]').click();
  assert(await page.locator('[data-ai-start]').isDisabled());
  await page.locator('[data-ai-settings-apply]').click();
  await page.setViewportSize({ width: 390, height: 844 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  session.user.roles = ['PLATFORM_ADMIN'];
  await page.evaluate(async () => {
    const { renderPlatformAdmin } = await import('/knowledge-center/modules/platform-admin/view.js');
    const { mountModelConnection: mountModelAdmin } = await import('/knowledge-center/modules/platform-admin/model-connection.js');
    document.querySelector('#view-root').innerHTML = renderPlatformAdmin({ platformTab: 'models', platformAdmin: true });
    mountModelAdmin(document.querySelector('[data-model-admin]'));
  });
  await page.locator('.model-service').last().waitFor();
  assert.equal(await page.locator('.model-service-editor[open]').count(), 0, '重新进入服务列表保持折叠');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.model-service').last().locator('[data-remove-model]').click();
  await page.locator('[data-model-admin] button[type=submit]').click();
  await page.waitForFunction(() => document.querySelector('[data-model-admin]').dataset.dirty === 'false');
  assert.equal(governance.get().services.length, 1, '删除后保存并从后端回读');
  assert.deepEqual(errors, []);
  const versionBeforeInvalid = governance.get().rowVersion;
  const firstService = page.locator('.model-service').first();
  await firstService.locator('.model-service-summary').click();
  await firstService.locator('[name=name]').fill('');
  await firstService.locator('.model-service-summary').click();
  await page.locator('[data-model-admin] button[type=submit]').click();
  assert.equal(await firstService.locator('.model-service-editor').evaluate(node => node.open), true, '折叠项验证失败时展开输入');
  assert.equal(governance.get().rowVersion, versionBeforeInvalid, '无效配置不应保存');
  assert.deepEqual(errors, []);
  await captureCoverage();
});
