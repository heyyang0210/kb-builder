const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadPlatformContext, loadPlatformProjection } = require('../lib/platform-context-gateway');
const { GitLabConnectorError, readConfig: readGitLabConfig, upsertConnection, upsertMapping, findMapping, findConnection, listBranches, listTree, readFile: readGitLabFile, sanitizeConnection, authorizeMappedRequest } = require('../lib/gitlab-connector');
const { GitLabOAuthError, start: startGitLabOAuth, callback: completeGitLabOAuth, tokenForUser, status: gitLabOAuthStatus } = require('../lib/gitlab-oauth');
const { ASSET_STATUS_LABELS, systemAssetStatus, assetStatus, projectAsset, queryKnowledgeAssets: queryKnowledgeAssetsBase, isPlatformAdmin } = require('../lib/knowledge-asset-utils');

/**
 * Knowledge center route handler factory.
 * Encapsulates auth checks, asset management, GitLab integration, platform context,
 * outline proxy, incremental build proxy, and static file serving.
 */
function createKnowledgeCenterHandler(options) {
  const {
    sendFile, proxyAuth, proxyOutline, proxyPermission, handleIncrementalBuild,
    config, stores,
  } = options;

  const {
    KNOWLEDGE_CENTER_PREFIX, KNOWLEDGE_CENTER_ROOT, KNOWLEDGE_CENTER_ENTRY,
    PINGCODE_PREFIX, PINGCODE_ROOT,
    DOCUMENT_API_HOST, DOCUMENT_API_PORT,
    PINGCODE_API_HOST, PINGCODE_API_PORT,
    PLATFORM_CONTEXT_TIMEOUT_MS,
    AUTH_API_HOST, AUTH_API_PORT,
    GITLAB_CONFIG_PATH, GITLAB_DOCUMENT_TYPES_PATH,
  } = config;

  const { knowledgeAssetsStore } = stores;

  // --- Auth helpers ---

  function authorizeRequest(req) {
    return new Promise(resolve => {
      const request = http.request({
        hostname: AUTH_API_HOST, port: AUTH_API_PORT,
        path: '/knowledge-center/api/auth/session', method: 'GET',
        headers: { cookie: req.headers.cookie || '', accept: 'application/json' },
        timeout: PLATFORM_CONTEXT_TIMEOUT_MS,
      }, response => {
        let raw = '';
        response.on('data', chunk => { raw += chunk; });
        response.on('end', () => {
          if (response.statusCode !== 200) return resolve(null);
          try { resolve(JSON.parse(raw || '{}')?.content || null); } catch (_error) { resolve(null); }
        });
      });
      request.on('timeout', () => { request.destroy(); resolve(false); });
      request.on('error', () => resolve(false));
      request.end();
    });
  }

  async function requireSession(req, res, action) {
    const session = await authorizeRequest(req);
    if (session) { await action(session); return; }
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ success: false, error: { code: 'AUTH_REQUIRED', message: '请登录后继续', retryable: false } }));
  }

  function hasAction(session, action) {
    const actions = session?.allowedActions || session?.user?.allowedActions || [];
    return actions.includes(action);
  }

  function forbidUnlessOutlineAction(res, session, action) {
    if (hasAction(session, action)) return false;
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ success: false, error: { code: 'OUTLINE_PERMISSION_DENIED', message: '仅平台管理员可新增或删除大纲' } }));
    return true;
  }

  function forbidUnlessPlatformAdmin(res, session) {
    if (isPlatformAdmin(session)) return false;
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ success: false, error: { code: 'PLATFORM_ADMIN_REQUIRED', message: '仅平台管理员可维护手册资产' } }));
    return true;
  }

  // --- File path helpers ---

  function knowledgeCenterFilePath(requestUrl) {
    const pathname = new URL(requestUrl, 'http://localhost').pathname;
    const relativePath = decodeURIComponent(pathname.slice(KNOWLEDGE_CENTER_PREFIX.length)).replace(/^\/+/, '');
    const requested = !relativePath || relativePath === 'index.html' ? KNOWLEDGE_CENTER_ENTRY : relativePath;
    const candidate = path.resolve(KNOWLEDGE_CENTER_ROOT, requested);
    if (!candidate.startsWith(`${path.resolve(KNOWLEDGE_CENTER_ROOT)}${path.sep}`) && candidate !== path.resolve(KNOWLEDGE_CENTER_ROOT)) return null;
    return path.extname(candidate) ? candidate : path.join(KNOWLEDGE_CENTER_ROOT, KNOWLEDGE_CENTER_ENTRY);
  }

  // --- Asset store & query wrappers ---

  function readKnowledgeAssets() {
    const payload = knowledgeAssetsStore.read();
    if (!payload.generatedAt && fs.existsSync(options.KNOWLEDGE_ASSETS_CONFIG_PATH)) {
      payload.generatedAt = fs.statSync(options.KNOWLEDGE_ASSETS_CONFIG_PATH).mtime.toISOString();
    }
    return payload;
  }

  function writeKnowledgeAssets(payload) {
    payload.generatedAt = new Date().toISOString();
    knowledgeAssetsStore.write(payload);
  }

  function queryKnowledgeAssets(payload, searchParams, admin) {
    return queryKnowledgeAssetsBase(payload, searchParams, admin, GITLAB_CONFIG_PATH);
  }

  function readJsonBody(req) {
    return new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', chunk => { raw += chunk; if (raw.length > 1024 * 1024) reject(new Error('请求内容过大')); });
      req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (_error) { reject(new Error('请求内容不是有效 JSON')); } });
      req.on('error', reject);
    });
  }

  function ownerValue(value, required = false) {
    const displayName = typeof value === 'string' ? value.trim() : String(value?.displayName || '').trim();
    if (required && !displayName) throw new Error('A 角为必填项');
    return { displayName: displayName || null, userId: value?.userId || null, bindingStatus: displayName ? (value?.userId ? 'bound' : 'pending') : 'unassigned' };
  }

  function nextHandbookId(payload, productId) {
    const prefix = String(productId).replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'HB';
    const used = new Set(payload.handbooks.map(item => item.handbookId));
    let number = 1;
    while (used.has(`${prefix}-${String(number).padStart(3, '0')}`)) number += 1;
    return `${prefix}-${String(number).padStart(3, '0')}`;
  }

  function auditAsset(payload, action, handbookId, session, details = {}) {
    if (!Array.isArray(payload.audits)) payload.audits = [];
    payload.audits.push({ action, handbookId, operatorId: session?.user?.id || null, at: new Date().toISOString(), details });
  }

  function assetById(payload, handbookId) {
    const item = payload.handbooks.find(entry => entry.handbookId === handbookId);
    if (!item) throw Object.assign(new Error('手册不存在'), { code: 'ASSET_NOT_FOUND', status: 404 });
    return item;
  }

  // --- Asset CRUD ---

  async function createKnowledgeAsset(req, res, session) {
    try {
      const body = await readJsonBody(req);
      const name = String(body.name || '').trim();
      const productId = String(body.productId || '').trim();
      if (!name || !productId) throw new Error('手册名称和产品为必填项');
      const payload = readKnowledgeAssets();
      const item = {
        handbookId: nextHandbookId(payload, productId), productId, productType: productId, name,
        ownerA: ownerValue(body.ownerA, true), ownerB: ownerValue(body.ownerB),
        externalVisible: Boolean(body.externalVisible), summary: String(body.summary || '').trim(),
        outline: { outlineId: null, outlineVersion: null, bindingStatus: 'not_created' },
        documentSummary: { total: null, published: null, inProgress: null }, sourceStatus: 'created',
        assetVersion: 1, manualStatus: null,
      };
      payload.handbooks.push(item);
      auditAsset(payload, 'ASSET_CREATED', item.handbookId, session);
      writeKnowledgeAssets(payload);
      res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ success: true, data: projectAsset(item, true) }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: { code: 'ASSET_CREATE_FAILED', message: error.message } }));
    }
  }

  async function updateKnowledgeAsset(req, res, handbookId, session) {
    try {
      const changes = await readJsonBody(req);
      const payload = readKnowledgeAssets();
      const item = payload.handbooks.find(entry => entry.handbookId === handbookId);
      if (!item) { res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ success: false, error: { code: 'ASSET_NOT_FOUND', message: '手册不存在' } })); return; }
      const before = { name: item.name, ownerA: item.ownerA, ownerB: item.ownerB };
      if (Object.hasOwn(changes, 'name')) { const name = String(changes.name || '').trim(); if (!name) throw new Error('手册名称不能为空'); item.name = name; }
      if (Object.hasOwn(changes, 'ownerA')) item.ownerA = ownerValue(changes.ownerA, true);
      if (Object.hasOwn(changes, 'ownerB')) item.ownerB = ownerValue(changes.ownerB);
      item.assetVersion = Number(item.assetVersion || 1) + 1;
      auditAsset(payload, 'ASSET_UPDATED', handbookId, session, { before, after: { name: item.name, ownerA: item.ownerA, ownerB: item.ownerB } });
      writeKnowledgeAssets(payload);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ success: true, data: projectAsset(item, true) }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: { code: 'ASSET_UPDATE_FAILED', message: error.message } }));
    }
  }

  async function changeAssetStatus(req, res, handbookId, session) {
    try {
      const body = await readJsonBody(req);
      const payload = readKnowledgeAssets();
      const item = assetById(payload, handbookId);
      const expectedVersion = Number(body.expectedVersion);
      const currentVersion = Number(item.assetVersion || 1);
      if (!Number.isInteger(expectedVersion) || expectedVersion !== currentVersion) throw Object.assign(new Error('手册信息已变化，请刷新后重试'), { code: 'ASSET_VERSION_CONFLICT', status: 409 });
      const targetStatus = String(body.targetStatus || '');
      const reason = String(body.reason || '').trim();
      if (!reason) throw Object.assign(new Error('请填写状态变更原因'), { code: 'STATUS_REASON_REQUIRED', status: 400 });
      if (targetStatus === 'handbook_published') throw Object.assign(new Error('已发布必须通过审核与发布流程形成'), { code: 'HANDBOOK_PUBLISH_REQUIRED', status: 409 });
      if (targetStatus === 'outline_published' && systemAssetStatus(item) !== 'outline_published' && systemAssetStatus(item) !== 'content_building' && systemAssetStatus(item) !== 'handbook_published') throw Object.assign(new Error('当前尚无正式发布的大纲版本'), { code: 'OUTLINE_PUBLISH_REQUIRED', status: 409 });
      if (!['asset_created', 'outline_editing', 'outline_published', 'content_building'].includes(targetStatus)) throw Object.assign(new Error('不支持的手册状态'), { code: 'ASSET_STATUS_INVALID', status: 400 });
      const before = assetStatus(item);
      item.manualStatus = { value: targetStatus, reason, updatedBy: session?.user?.id || null, updatedAt: new Date().toISOString() };
      item.assetVersion = currentVersion + 1;
      auditAsset(payload, 'ASSET_STATUS_CHANGED', handbookId, session, { before, after: targetStatus, reason, systemStatus: systemAssetStatus(item) });
      writeKnowledgeAssets(payload);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ success: true, data: projectAsset(item, true) }));
    } catch (error) {
      res.writeHead(error.status || 400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ success: false, error: { code: error.code || 'ASSET_STATUS_CHANGE_FAILED', message: error.message } }));
    }
  }

  async function resolveAssetStatus(req, res, handbookId, session) {
    try {
      const body = await readJsonBody(req);
      const payload = readKnowledgeAssets();
      const item = assetById(payload, handbookId);
      const expectedVersion = Number(body.expectedVersion);
      const currentVersion = Number(item.assetVersion || 1);
      if (!Number.isInteger(expectedVersion) || expectedVersion !== currentVersion) throw Object.assign(new Error('手册信息已变化，请刷新后重试'), { code: 'ASSET_VERSION_CONFLICT', status: 409 });
      const action = String(body.action || '');
      if (!['accept_system', 'keep_manual'].includes(action)) throw Object.assign(new Error('不支持的冲突处理方式'), { code: 'ASSET_STATUS_RESOLUTION_INVALID', status: 400 });
      if (action === 'keep_manual' && !String(body.reason || '').trim()) throw Object.assign(new Error('保留人工状态必须填写原因'), { code: 'STATUS_REASON_REQUIRED', status: 400 });
      const before = assetStatus(item);
      if (action === 'accept_system') item.manualStatus = null;
      else item.manualStatus = { ...item.manualStatus, reason: String(body.reason).trim(), updatedBy: session?.user?.id || null, updatedAt: new Date().toISOString(), acknowledgedSystemStatus: systemAssetStatus(item) };
      item.assetVersion = currentVersion + 1;
      auditAsset(payload, 'ASSET_STATUS_CONFLICT_RESOLVED', handbookId, session, { action, before, after: assetStatus(item), reason: body.reason || null });
      writeKnowledgeAssets(payload);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ success: true, data: projectAsset(item, true) }));
    } catch (error) {
      res.writeHead(error.status || 400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ success: false, error: { code: error.code || 'ASSET_STATUS_RESOLVE_FAILED', message: error.message } }));
    }
  }

  function changeArchiveState(res, handbookId, archived, session) {
    const payload = readKnowledgeAssets();
    const item = payload.handbooks.find(entry => entry.handbookId === handbookId);
    if (!item) { res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ success: false, error: { code: 'ASSET_NOT_FOUND', message: '手册不存在' } })); return; }
    const running = Number(item.documentSummary?.runningTasks || 0);
    if (archived && running > 0) {
      res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: { code: 'ASSET_HAS_RUNNING_TASKS', message: '手册存在运行中任务，暂不能停用', details: { runningTasks: running } } }));
      return;
    }
    item.archivedAt = archived ? new Date().toISOString() : null;
    item.assetVersion = Number(item.assetVersion || 1) + 1;
    auditAsset(payload, archived ? 'ASSET_ARCHIVED' : 'ASSET_RESTORED', handbookId, session);
    writeKnowledgeAssets(payload);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ success: true, data: projectAsset(item, true) }));
  }

  function serveKnowledgeAssetsCatalog(res) {
    try {
      const body = readKnowledgeAssets();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ success: true, data: body }));
    } catch (error) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ success: false, error: { code: 'ASSET_CONFIG_UNAVAILABLE', message: '手册资产配置暂不可用' } }));
    }
  }

  // --- Platform context ---

  async function servePlatformContext(res) {
    const result = await loadPlatformContext({
      timeoutMs: PLATFORM_CONTEXT_TIMEOUT_MS,
      documentGeneration: { hostname: DOCUMENT_API_HOST, port: DOCUMENT_API_PORT, path: '/api/platform/context' },
      materialProcessing: { hostname: PINGCODE_API_HOST, port: PINGCODE_API_PORT, path: '/api/platform/context' },
    });
    res.writeHead(result.statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result.body));
  }

  async function servePlatformProjection(res) {
    const result = await loadPlatformProjection({
      documentGeneration: { hostname: DOCUMENT_API_HOST, port: DOCUMENT_API_PORT },
      materialProcessing: { hostname: PINGCODE_API_HOST, port: PINGCODE_API_PORT },
      targets: {
        documents: { hostname: DOCUMENT_API_HOST, port: DOCUMENT_API_PORT, path: '/api/document/stats' },
        outlines: { hostname: DOCUMENT_API_HOST, port: DOCUMENT_API_PORT, path: '/api/outline/governance/list' },
        workbench: { hostname: PINGCODE_API_HOST, port: PINGCODE_API_PORT, path: '/api/workbench/summary' },
        materialBatches: { hostname: PINGCODE_API_HOST, port: PINGCODE_API_PORT, path: '/api/material-batches?page=1&pageSize=1' },
        datasets: { hostname: PINGCODE_API_HOST, port: PINGCODE_API_PORT, path: '/api/datasets' },
        knowledgeIndex: { hostname: PINGCODE_API_HOST, port: PINGCODE_API_PORT, path: '/api/index/stats' },
      },
    });
    res.writeHead(result.statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result.body));
  }

  // --- GitLab handler ---

  function sendGitLabError(res, error) {
    const status = error instanceof GitLabConnectorError || error instanceof GitLabOAuthError ? error.status : 500;
    const body = { success: false, error: { code: error.code || 'GITLAB_REQUEST_FAILED', message: error.message || 'GitLab 请求失败', details: error.details || {} } };
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  }

  function repositoryDocumentRules() {
    try {
      const value = JSON.parse(fs.readFileSync(GITLAB_DOCUMENT_TYPES_PATH, 'utf8'));
      return { extensions: new Set((value.extensions || []).map(String)), excludedNames: new Set((value.excludedNames || []).map(String)) };
    } catch (_error) {
      throw new GitLabConnectorError('GITLAB_DOCUMENT_TYPES_UNAVAILABLE', '仓库文档类型配置不可用', 503);
    }
  }

  function minimizeMappedRoots(values) {
    return [...new Set(values)].sort((a, b) => a.length - b.length).filter((value, index, all) => !all.slice(0, index).some(parent => value.startsWith(`${parent}/`)));
  }

  async function handbookRepositoryStatistics(res, session, handbookId, params) {
    const { mapping, connection } = findMapping(handbookId, GITLAB_CONFIG_PATH);
    const ref = params.get('ref') || mapping.defaultBranch;
    const language = params.get('language') === 'en' ? 'en' : 'zh';
    const roots = minimizeMappedRoots(language === 'en' ? mapping.enPaths : mapping.zhPaths);
    if (!mapping.enabledBranches.includes(ref)) throw new GitLabConnectorError('GITLAB_BRANCH_NOT_ALLOWED', '该业务版本未在手册映射中启用', 403);
    if (!roots.length) throw new GitLabConnectorError('GITLAB_LANGUAGE_NOT_MAPPED', '该语言尚未配置仓库内容路径', 404);
    const rules = repositoryDocumentRules();
    const accessToken = tokenForUser(session?.user?.id, connection.host);
    const requestOptions = accessToken ? { accessToken } : {};
    const chapters = new Set();
    const documents = new Set();
    const branch = (await listBranches(connection, requestOptions)).find(item => item.name === ref);
    if (!branch) throw new GitLabConnectorError('GITLAB_BRANCH_NOT_FOUND', 'GitLab 分支不存在', 404);
    const headSha = branch.commitSha || null;
    for (const root of roots) {
      const rootExtension = path.extname(root).toLowerCase();
      if (rules.extensions.has(rootExtension) && !rules.excludedNames.has(path.basename(root).toLowerCase())) { documents.add(root); continue; }
      const entries = await listTree(connection, ref, root, requestOptions);
      for (const entry of entries) {
        if (entry.type === 'tree') { chapters.add(entry.path); continue; }
        const ext = path.extname(entry.path).toLowerCase();
        if (rules.extensions.has(ext) && !rules.excludedNames.has(path.basename(entry.path).toLowerCase())) documents.add(entry.path);
      }
    }
    return { handbookId, ref, language, headSha, chapters: chapters.size, documents: documents.size, mappedRoots: roots, extensions: [...rules.extensions] };
  }

  async function handleGitLabApi(req, res, session) {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    try {
      if (req.method === 'GET' && pathname === '/knowledge-center/api/gitlab/oauth/start') {
        const params = new URL(req.url, 'http://localhost').searchParams;
        const connection = findConnection(params.get('connectionId') || '', GITLAB_CONFIG_PATH);
        const returnTo = params.get('returnTo') || '/knowledge-center/platform';
        const authorizationUrl = startGitLabOAuth({ userId: session?.user?.id, connectionId: connection.id, host: connection.host, returnTo });
        res.writeHead(302, { Location: authorizationUrl, 'Cache-Control': 'no-store' }); res.end(); return;
      }
      if (req.method === 'GET' && pathname === '/knowledge-center/api/gitlab/oauth/callback') {
        const params = new URL(req.url, 'http://localhost').searchParams;
        const result = await completeGitLabOAuth({ userId: session?.user?.id, code: params.get('code'), state: params.get('state') });
        res.writeHead(302, { Location: result.returnTo || '/knowledge-center/platform', 'Cache-Control': 'no-store' }); res.end(); return;
      }
      if (req.method === 'GET' && pathname === '/knowledge-center/api/gitlab/oauth/status') {
        const params = new URL(req.url, 'http://localhost').searchParams;
        let host = params.get('host') || null;
        if (params.get('connectionId')) host = findConnection(params.get('connectionId'), GITLAB_CONFIG_PATH).host;
        const data = gitLabOAuthStatus(session?.user?.id, host);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data })); return;
      }
      if (req.method === 'GET' && pathname === '/knowledge-center/api/gitlab/oauth/config') {
        const oauth = require('../lib/gitlab-oauth');
        const cfg = oauth.config();
        const configured = Boolean(cfg.clientId && cfg.clientSecret && cfg.redirectUri);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data: { configured, devHttp: cfg.devHttp } })); return;
      }
      if (req.method === 'POST' && pathname === '/knowledge-center/api/gitlab/oauth/disconnect') {
        const params = new URL(req.url, 'http://localhost').searchParams;
        const host = params.get('host') || null;
        const data = gitLabOAuthStatus(session?.user?.id, host);
        const oauth = require('../lib/gitlab-oauth');
        if (typeof oauth.disconnect === 'function') oauth.disconnect(session?.user?.id, host);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data: { ...data, connected: false } })); return;
      }
      if (req.method === 'GET' && pathname === '/knowledge-center/api/gitlab/connections') {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        const cfg = readGitLabConfig(GITLAB_CONFIG_PATH);
        const items = (cfg.connections || []).map(sanitizeConnection);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data: { items } })); return;
      }
      if (req.method === 'PUT' && pathname === '/knowledge-center/api/gitlab/connections') {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
        if (!idempotencyKey) throw new GitLabConnectorError('IDEMPOTENCY_KEY_REQUIRED', '配置更新必须携带 Idempotency-Key', 400);
        const body = await readJsonBody(req);
        const connection = upsertConnection(body, GITLAB_CONFIG_PATH, { idempotencyKey, operatorId: session?.user?.id });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data: connection })); return;
      }
      const mappingUpdate = pathname.match(/^\/knowledge-center\/api\/gitlab\/mappings\/([^/]+)$/);
      if (mappingUpdate && req.method === 'GET') {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        const { mapping } = findMapping(decodeURIComponent(mappingUpdate[1]), GITLAB_CONFIG_PATH);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data: mapping })); return;
      }
      if (mappingUpdate && req.method === 'PUT') {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
        if (!idempotencyKey) throw new GitLabConnectorError('IDEMPOTENCY_KEY_REQUIRED', '配置更新必须携带 Idempotency-Key', 400);
        const handbookId = decodeURIComponent(mappingUpdate[1]);
        if (!readKnowledgeAssets().handbooks.some(item => item.handbookId === handbookId)) throw new GitLabConnectorError('ASSET_NOT_FOUND', '手册资产不存在', 404);
        const mapping = upsertMapping(handbookId, await readJsonBody(req), GITLAB_CONFIG_PATH, { idempotencyKey, operatorId: session?.user?.id });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data: mapping })); return;
      }
      const direct = pathname.match(/^\/knowledge-center\/api\/gitlab\/connections\/([^/]+)\/(branches|tree|file)$/);
      if (direct) {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
        const connection = findConnection(decodeURIComponent(direct[1]), GITLAB_CONFIG_PATH);
        const params = new URL(req.url, 'http://localhost').searchParams;
        const accessToken = tokenForUser(session?.user?.id, connection.host);
        const requestOptions = accessToken ? { accessToken } : {};
        let data;
        if (direct[2] === 'branches') data = await listBranches(connection, requestOptions);
        else if (direct[2] === 'tree') data = await listTree(connection, params.get('ref') || connection.defaultBranch, params.get('path') || '', requestOptions);
        else data = await readGitLabFile(connection, params.get('ref') || connection.defaultBranch, params.get('path') || '', requestOptions);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data })); return;
      }
      const mapped = pathname.match(/^\/knowledge-center\/api\/gitlab\/handbooks\/([^/]+)\/(branches|tree|file|statistics)$/);
      if (mapped) {
        const handbookId = decodeURIComponent(mapped[1]);
        if (mapped[2] === 'statistics') {
          if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
          const params = new URL(req.url, 'http://localhost').searchParams;
          const data = await handbookRepositoryStatistics(res, session, handbookId, params);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ success: true, data })); return;
        }
        const { mapping, connection } = findMapping(handbookId, GITLAB_CONFIG_PATH);
        const params = new URL(req.url, 'http://localhost').searchParams;
        const ref = params.get('ref') || mapping.defaultBranch;
        const language = params.get('language') === 'en' ? 'en' : 'zh';
        let data;
        if (mapped[2] === 'branches') {
          const asset = readKnowledgeAssets().handbooks.find(item => item.handbookId === mapping.handbookId);
          const accessToken = tokenForUser(session?.user?.id, connection.host);
          const requestOptions = accessToken ? { accessToken } : {};
          data = {
            items: (await listBranches(connection, requestOptions)).filter(item => mapping.enabledBranches.includes(item.name)),
            defaultBranch: mapping.defaultBranch, handbookName: asset?.name || mapping.handbookId,
            connectionName: connection.name, project: connection.project,
            languages: { zh: mapping.zhPaths.length > 0, en: mapping.enPaths.length > 0 },
          };
        } else if (mapped[2] === 'tree') {
          const requested = params.get('path') || '';
          const roots = language === 'en' ? mapping.enPaths : mapping.zhPaths;
          if (requested) authorizeMappedRequest(mapping, ref, language, requested);
          else authorizeMappedRequest(mapping, ref, language, roots[0]);
          const accessToken = tokenForUser(session?.user?.id, connection.host);
          const requestOptions = accessToken ? { accessToken } : {};
          const lists = await Promise.all((requested ? [requested] : roots).map(root => listTree(connection, ref, root, requestOptions)));
          data = lists.flat().filter(item => roots.some(root => item.path === root || item.path.startsWith(`${root}/`)));
        } else {
          const requested = authorizeMappedRequest(mapping, ref, language, params.get('path') || '');
          const accessToken = tokenForUser(session?.user?.id, connection.host);
          data = await readGitLabFile(connection, ref, requested, accessToken ? { accessToken } : {});
          if (params.get('raw') === '1' && data.encoding === 'base64') {
            const media = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' }[path.extname(requested).toLowerCase()] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': media, 'Cache-Control': 'private, max-age=60' });
            res.end(Buffer.from(data.content, 'base64')); return;
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data })); return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: { code: 'GITLAB_ROUTE_NOT_FOUND', message: '未知 GitLab 接口' } }));
    } catch (error) { sendGitLabError(res, error); }
  }

  // --- Main request handler ---

  return function handleKnowledgeCenterRequest(req, res) {
    const pathname = new URL(req.url, 'http://localhost').pathname;

    if (pathname === '/knowledge-center/auth' || pathname.startsWith('/knowledge-center/auth/') || pathname === '/knowledge-center/api/auth' || pathname.startsWith('/knowledge-center/api/auth/')) {
      proxyAuth(req, res); return;
    }
    if (req.method === 'GET' && pathname === '/knowledge-center/api/platform/context') {
      requireSession(req, res, () => servePlatformContext(res)); return;
    }
    if (pathname === '/knowledge-center/api/platform/permissions' || pathname.startsWith('/knowledge-center/api/platform/permissions/')) {
      proxyPermission(req, res); return;
    }
    if (req.method === 'GET' && pathname === '/knowledge-center/api/platform/overview') {
      requireSession(req, res, () => servePlatformProjection(res)); return;
    }
    if (req.method === 'GET' && pathname === '/knowledge-center/api/assets/catalog') {
      requireSession(req, res, () => serveKnowledgeAssetsCatalog(res)); return;
    }
    if (pathname === '/knowledge-center/api/assets/handbooks') {
      requireSession(req, res, session => {
        if (req.method === 'GET') {
          try {
            const data = queryKnowledgeAssets(readKnowledgeAssets(), new URL(req.url, 'http://localhost').searchParams, isPlatformAdmin(session));
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({ success: true, data }));
          } catch (_error) {
            res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, error: { code: 'ASSET_CONFIG_UNAVAILABLE', message: '手册资产配置暂不可用' } }));
          }
          return;
        }
        if (req.method === 'POST' && !forbidUnlessPlatformAdmin(res, session)) createKnowledgeAsset(req, res, session);
        else if (req.method !== 'POST') { res.writeHead(405); res.end(); }
      });
      return;
    }
    const assetStatusCommand = pathname.match(/^\/knowledge-center\/api\/assets\/handbooks\/([^/]+)\/status(?:\/(resolve))?$/);
    if (assetStatusCommand) {
      const handbookId = decodeURIComponent(assetStatusCommand[1]);
      requireSession(req, res, session => {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
        if (assetStatusCommand[2] === 'resolve') resolveAssetStatus(req, res, handbookId, session);
        else changeAssetStatus(req, res, handbookId, session);
      });
      return;
    }
    const assetCommand = pathname.match(/^\/knowledge-center\/api\/assets\/handbooks\/([^/]+)(?:\/(archive|restore))?$/);
    if (assetCommand) {
      const handbookId = decodeURIComponent(assetCommand[1]);
      requireSession(req, res, session => {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        if (req.method === 'PATCH' && !assetCommand[2]) updateKnowledgeAsset(req, res, handbookId, session);
        else if (req.method === 'POST' && assetCommand[2]) changeArchiveState(res, handbookId, assetCommand[2] === 'archive', session);
        else { res.writeHead(405); res.end(); }
      });
      return;
    }
    if (req.method === 'PATCH' && pathname.startsWith('/knowledge-center/api/assets/catalog/')) {
      const handbookId = decodeURIComponent(pathname.slice('/knowledge-center/api/assets/catalog/'.length));
      requireSession(req, res, session => {
        if (!forbidUnlessPlatformAdmin(res, session)) updateKnowledgeAsset(req, res, handbookId, session);
      });
      return;
    }
    if (req.method === 'GET' && (pathname === '/knowledge-center/api/outline/governance' || pathname.startsWith('/knowledge-center/api/outline/governance/'))) {
      requireSession(req, res, session => { if (!forbidUnlessOutlineAction(res, session, 'outline:read')) proxyOutline(req, res); }); return;
    }
    if (req.method === 'POST' && (pathname === '/knowledge-center/api/outline/import' || pathname === '/knowledge-center/api/outline/handbooks')) {
      requireSession(req, res, session => { if (!forbidUnlessOutlineAction(res, session, 'outline:create')) proxyOutline(req, res); }); return;
    }
    if (req.method === 'DELETE' && /^\/knowledge-center\/api\/outline\/governance\/[^/]+$/.test(pathname)) {
      requireSession(req, res, session => { if (!forbidUnlessOutlineAction(res, session, 'outline:delete')) proxyOutline(req, res); }); return;
    }
    if (pathname === '/knowledge-center/api/incremental-tasks' || pathname.startsWith('/knowledge-center/api/incremental-tasks/')) {
      requireSession(req, res, session => handleIncrementalBuild(req, res, session)); return;
    }
    if (pathname.startsWith('/knowledge-center/api/gitlab/')) {
      requireSession(req, res, session => handleGitLabApi(req, res, session)); return;
    }
    if (pathname === KNOWLEDGE_CENTER_PREFIX || pathname.startsWith(`${KNOWLEDGE_CENTER_PREFIX}/`)) {
      const filePath = knowledgeCenterFilePath(req.url);
      if (!filePath) { res.writeHead(400); res.end('Bad Request'); return; }
      sendFile(filePath, res); return;
    }
    return false;
  };
}

module.exports = { createKnowledgeCenterHandler };
