const { REVIEW_ASSET_STATUSES } = require('../lib/knowledge-asset-utils');
const http = require('http');
const crypto = require('crypto');
const { submitDocumentMergeRequest } = require('../lib/gitlab-connector');
const { imageType } = require('../lib/source-image-resources');
const fs = require('fs');
const path = require('path');
const { loadPlatformContext, loadPlatformProjection } = require('../lib/platform-context-gateway');
const { GitLabConnectorError, readConfig: readFileGitLabConfig, upsertConnection: upsertFileConnection, normalizeGitLabAddress, recordVerification: recordFileVerification, setConnectionStatus: setFileConnectionStatus, upsertMapping: upsertFileMapping, findMapping: findFileMapping, findConnection: findFileConnection, listBranches, listTree, readFile: readGitLabFile, readDocumentResources, extractMarkdownResources, listCommits, sanitizeConnection, authorizeMappedRequest, readMergeRequestDelivery } = require('../lib/gitlab-connector');
const { GitLabOAuthError, config: gitLabOAuthConfig, start: startGitLabOAuth, callback: completeGitLabOAuth, tokenForUser, status: gitLabOAuthStatus, disconnect: disconnectGitLabOAuth } = require('../lib/gitlab-oauth');
const { ASSET_STATUS_LABELS, systemAssetStatus, assetStatus, projectAsset, queryKnowledgeAssets: queryKnowledgeAssetsBase, isPlatformAdmin } = require('../lib/knowledge-asset-utils');
const { matchCleaningEndpoint } = require('../lib/knowledge-center-cleaning-contract');
const { createTemplateStore } = require('../lib/template-store');
const { readTemplateUpload } = require('../lib/template-import');
const { previewPersonnelImport, readPersonnelUpload, templateWorkbook } = require('../lib/personnel-import');
const { REPOSITORY_ROOT } = require('../lib/repo-paths');
const { createGitLabVerificationStore } = require('../lib/gitlab-verification-store');
const verificationRepairs = require('../../../config/knowledge-center/content-rules.json').gitlabVerificationErrors;
const { readTechDomainConfig } = require('./outline-management');
const { rules: outlineTemplateRules } = require('../lib/outline-path-template');
const { createDatabaseConnectionGovernance } = require('../lib/platform-management/database-connection-governance');
const { createHandbookProductionService } = require('../lib/handbook-production-service');
let logger;
try { logger = require('../lib/logger'); } catch (_) { logger = { info() {} }; }

function perfTrace(message, meta) {
  if (process.env.PERF_TRACE === '1') logger.info(`[perf] ${message}`, meta);
}

class KnowledgeCenterConfigError extends Error {
  constructor(key, reason) {
    super(`知识中心启动配置无效：${key} ${reason}`);
    this.code = 'KNOWLEDGE_CENTER_CONFIG_INVALID';
    this.key = key;
  }
}

function validateOutlineWorkbookPath(key, filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new KnowledgeCenterConfigError(key, '缺失');
  }
  if (!path.isAbsolute(filePath)) {
    throw new KnowledgeCenterConfigError(key, '必须为绝对路径');
  }
  if (path.extname(filePath).toLowerCase() !== '.xlsx') {
    throw new KnowledgeCenterConfigError(key, '必须指向 .xlsx 文件');
  }
  try {
    if (!fs.statSync(filePath).isFile()) {
      throw new KnowledgeCenterConfigError(key, '必须指向普通文件');
    }
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch (error) {
    if (error instanceof KnowledgeCenterConfigError) throw error;
    throw new KnowledgeCenterConfigError(key, '不存在或不可读');
  }
}

/**
 * Knowledge center route handler factory.
 * Encapsulates auth checks, asset management, GitLab integration, platform context,
 * outline proxy, incremental build proxy, and static file serving.
 */
function createKnowledgeCenterHandler(options) {
  const {
    sendFile, proxyAuth, proxyCleaning, proxyOutline, proxyPermission, handleIncrementalBuild,
    config, stores, moduleRegistry, modules = {},
  } = options;

  const {
    KNOWLEDGE_CENTER_PREFIX, KNOWLEDGE_CENTER_ROOT, KNOWLEDGE_CENTER_ENTRY,
    OUTLINE_TEMPLATE_PATH, OUTLINE_SAMPLE_PATH,
    PINGCODE_PREFIX, PINGCODE_ROOT,
    DOCUMENT_API_HOST, DOCUMENT_API_PORT,
    PINGCODE_API_HOST, PINGCODE_API_PORT,
    PLATFORM_CONTEXT_TIMEOUT_MS,
    AUTH_API_HOST, AUTH_API_PORT,
    GITLAB_CONFIG_PATH, GITLAB_DOCUMENT_TYPES_PATH,
    DATABASE_CONNECTION_CONFIG_PATH,
  } = config;

  const { knowledgeAssetsStore, manualStatusStore, brandIconStore, domainStore } = stores;
  const databasePlatformMode = String(process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE || process.env.KNOWLEDGE_STORAGE_MODE || '').toLowerCase() === 'database';
  const verificationStore = createGitLabVerificationStore();
  const readGitLabConfig = filePath => {
    if (!databasePlatformMode) return readFileGitLabConfig(filePath);
    const result = domainStore.readPlatformGitLabConnections();
    return { connections: (result.items || []).map(item => verificationStore.project(item)), mappings: [], idempotency: [], audit: [] };
  };
  const findConnection = (id, filePath) => {
    if (!databasePlatformMode) return findFileConnection(id, filePath);
    const item = domainStore.readPlatformGitLabConnection(id);
    if (!item) throw new GitLabConnectorError('GITLAB_CONNECTION_NOT_FOUND', 'GitLab 仓库连接不存在', 404);
    return item;
  };
  const findMapping = handbookId => {
    if (!databasePlatformMode) return findFileMapping(handbookId, GITLAB_CONFIG_PATH);
    const mapping = domainStore.readPlatformGitLabMapping(handbookId);
    if (!mapping) throw new GitLabConnectorError('GITLAB_MAPPING_NOT_FOUND', '该手册尚未配置 GitLab 内容映射', 404);
    const connection = findConnection(mapping.connectionId);
    return { mapping, connection };
  };
  const findMappingAsync = async handbookId => {
    if (!databasePlatformMode) return findFileMapping(handbookId, GITLAB_CONFIG_PATH);
    const mapping = await domainStore.readPlatformGitLabMappingAsync(handbookId);
    if (!mapping) throw new GitLabConnectorError('GITLAB_MAPPING_NOT_FOUND', '该手册尚未配置 GitLab 内容映射', 404);
    const connection = await domainStore.readPlatformGitLabConnectionAsync(mapping.connectionId);
    if (!connection) throw new GitLabConnectorError('GITLAB_CONNECTION_NOT_FOUND', 'GitLab 仓库连接不存在', 404);
    return { mapping, connection };
  };
  const upsertConnection = (input, filePath, audit = {}) => {
    if (!databasePlatformMode) return upsertFileConnection(input, filePath, audit);
    const normalized = normalizeGitLabAddress(input);
    if (!String(normalized.defaultBranch || '').trim()) throw new GitLabConnectorError('GITLAB_DEFAULT_BRANCH_REQUIRED', '请填写仓库实际使用的默认分支');
    return domainStore.upsertPlatformGitLabConnection({ mode: 'production', status: 'active', ...normalized }, normalized.rowVersion ?? null, audit.idempotencyKey, audit.operatorId);
  };
  const setConnectionStatus = (id, status, filePath, audit = {}) => {
    if (!databasePlatformMode) return setFileConnectionStatus(id, status, filePath, audit);
    const current = findConnection(id); const rowVersion = audit.rowVersion == null ? current.rowVersion : Number(String(audit.rowVersion).replace(/\"/g, ''));
    return domainStore.setPlatformGitLabConnectionState(id, status, rowVersion, audit.idempotencyKey, audit.operatorId);
  };
  const upsertMapping = (handbookId, input, filePath, audit = {}) => {
    if (!databasePlatformMode) return upsertFileMapping(handbookId, input, filePath, audit);
    return domainStore.replacePlatformGitLabMapping(handbookId, input, input.rowVersion ?? null, audit.idempotencyKey, audit.operatorId);
  };
  const recordVerification = (id, verification, filePath, audit = {}, snapshot) => {
    if (!databasePlatformMode) return recordFileVerification(id, verification, filePath, audit);
    try {
      verificationStore.record(snapshot || findConnection(id), verification);
    } catch (error) {
      error.details = { ...error.details, recovery: verificationRepairs[error.code] || verificationRepairs.default };
      throw error;
    }
  };
  validateOutlineWorkbookPath('OUTLINE_TEMPLATE_PATH', OUTLINE_TEMPLATE_PATH);
  validateOutlineWorkbookPath('OUTLINE_SAMPLE_PATH', OUTLINE_SAMPLE_PATH);
  const templateStore = stores.templateStore || createTemplateStore();
  const databaseConnection = options.databaseConnectionGovernance || createDatabaseConnectionGovernance({
    filePath: DATABASE_CONNECTION_CONFIG_PATH,
    autoStartHealthMonitor: false,
  });
  const authModule = moduleRegistry?.get?.('auth') || modules.auth;
  const modelGovernance = options.modelGovernance || require('../lib/platform-management/model-governance').createModelGovernance();
  const mcpGovernance = options.mcpGovernance || require('../lib/platform-management/mcp-governance').createMcpGovernance();
  const databaseMode = String(process.env.KNOWLEDGE_STORAGE_MODE || 'file').toLowerCase() === 'database';
  const qualityAdapter = require('../lib/yashandb-quality-adapter');
  const defaultQualityDatabase = databaseMode && qualityAdapter.isolatedQualityDatabaseConfigured() ? qualityAdapter.createYashanDBQualityAdapter({
    baseUrl: process.env.YASDB_STORAGE_URL || undefined,
    timeoutMs: Number(process.env.YASDB_STORAGE_TIMEOUT_MS || 15000),
    environment: process.env.YASDB_QUALITY_ENVIRONMENT || '独立 YashanDB 测试库',
  }) : undefined;
  const handbookProductionService = options.handbookProductionService || createHandbookProductionService({
    autoRecoverOnStart: true,
    recoveryIntervalMs: process.env.KNOWLEDGE_PRODUCTION_RECOVERY_INTERVAL_MS,
    ai: { modelGovernance, loadMCPConfig: () => mcpGovernance.currentForSources(), pingcodeBaseURL: PINGCODE_API_HOST && PINGCODE_API_PORT ? `http://${PINGCODE_API_HOST}:${PINGCODE_API_PORT}` : undefined },
    yashanDB: defaultQualityDatabase,
  });

  // --- Auth helpers ---

  async function authorizeRequest(req) {
    if (authModule?.authorize) return authModule.authorize(req);
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

  function dispatchAuth(req, res, targetUrl = req.url) {
    if (!authModule?.handler) {
      if (targetUrl === req.url) proxyAuth(req, res);
      else proxyPermission(req, res);
      return;
    }
    const originalUrl = req.url;
    req.url = targetUrl;
    Promise.resolve(authModule.handler(req, res))
      .catch(error => sendRequestError(res, error, 'AUTH_SERVICE_UNAVAILABLE'))
      .finally(() => { req.url = originalUrl; });
  }

  function sendRequestError(res, error, fallbackCode = 'KNOWLEDGE_CENTER_REQUEST_FAILED') {
    if (res.headersSent || res.writableEnded) return;
    const declaredStatus = Number(error?.status);
    const status = Number.isInteger(declaredStatus) && declaredStatus >= 400 && declaredStatus <= 599 ? declaredStatus : 503;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ success: false, error: {
      code: error?.code || fallbackCode,
      message: error?.message || '知识中心服务暂时不可用，请稍后重试。',
      retryable: status >= 500,
      ...(error?.details === undefined ? {} : { details: error.details }),
    } }));
  }

  async function requireSession(req, res, action) {
    let session;
    try { session = await authorizeRequest(req); }
    catch (error) { sendRequestError(res, error, 'AUTH_SERVICE_UNAVAILABLE'); return; }
    if (session) {
      try { await action(session); } catch (error) { sendRequestError(res, error); }
      return;
    }
    const requestId = String(req.headers['x-request-id'] || '');
    const correlationId = String(req.headers['x-correlation-id'] || requestId);
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ success: false, error: { code: 'AUTH_REQUIRED', message: '请登录后继续', retryable: false, requestId, correlationId } }));
  }

  function hasAction(session, action) {
    const actions = session?.allowedActions || session?.user?.allowedActions || [];
    return actions.includes(action);
  }

  function forbidUnlessOutlineAction(res, session, action) {
    if (hasAction(session, action)) return false;
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ success: false, error: { code: 'OUTLINE_PERMISSION_DENIED', message: '当前账号无大纲管理权限' } }));
    return true;
  }

  function forbidUnlessPlatformAdmin(res, session) {
    if (isPlatformAdmin(session)) return false;
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ success: false, error: { code: 'PLATFORM_ADMIN_REQUIRED', message: '仅平台管理员可维护手册资产' } }));
    return true;
  }

  function forbidUnlessCleaningAction(res, session, action) {
    if (isPlatformAdmin(session)) return false;
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ success: false, error: { code: 'PLATFORM_ADMIN_REQUIRED', message: '仅平台管理员可访问资料清洗治理能力', retryable: false } }));
    return true;
  }

  function forbidUnlessTemplateAction(res, session, action) {
    if (hasAction(session, action) || isPlatformAdmin(session)) return false;
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ success: false, error: { code: 'TEMPLATE_PERMISSION_DENIED', message: `没有${action === 'template:read' ? '模板读取' : action === 'template:edit' ? '模板编辑' : '模板管理'}权限` } }));
    return true;
  }

  function templateResponse(res, content, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ success: true, data: content })); }

  function sendBrandIcon(res) {
    try {
      const icon = brandIconStore.current();
      res.writeHead(200, { 'Content-Type': icon.mimeType, 'Content-Length': icon.buffer.length, 'Cache-Control': 'public, max-age=300', 'ETag': `"${icon.fingerprint.slice(7)}"`, 'X-Content-Type-Options': 'nosniff' });
      res.end(icon.buffer);
    } catch (error) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify({ success: false, error: { code: error.code || 'BRAND_ICON_UNAVAILABLE', message: '品牌图标暂不可用' } }));
    }
  }

  async function handleTemplates(req, res, session) {
    const parsed = new URL(req.url, 'http://localhost'); const parts = parsed.pathname.split('/').filter(Boolean); const id = parts[3] ? decodeURIComponent(parts[3]) : null;
    const startedAt = process.hrtime.bigint();
    perfTrace('template request start', { method: req.method, path: parsed.pathname, id });
    try {
      const action = req.method === 'GET' ? 'template:read' : req.method === 'DELETE' || ['disable', 'restore'].includes(parts[4]) ? 'template:manage' : 'template:edit';
      if (forbidUnlessTemplateAction(res, session, action)) return;
      if (req.method === 'POST' && parts.length === 4 && parts[3] === 'import') {
        const { batch, files } = await readTemplateUpload(req);
        const drafts = files.map(upload => {
          try {
            if (upload.error) throw upload.error;
            return { ...templateStore.importDraft(upload, session), clientIndex: upload.clientIndex, warnings: upload.warnings };
          } catch (error) {
            if (!batch && files.length === 1) throw error;
            return { draft: false, clientIndex: upload.clientIndex, sourceFilename: upload.sourceFilename, error: { code: error.code || 'TEMPLATE_ERROR', message: error.message } };
          }
        });
        const templates = [];
        for (const draft of drafts.filter(item => item.draft)) {
          try {
            templates.push(templateStore.create({ ...draft, sourceType: 'upload' }, session));
          } catch (error) {
            const target = drafts.find(item => item.clientIndex === draft.clientIndex);
            target.error = { code: error.code || 'TEMPLATE_CREATE_FAILED', message: error.message }; target.draft = false;
          }
        }
        return templateResponse(res, { drafts, templates });
      }
      if (req.method === 'PATCH' || req.method === 'POST' && (!id || ['save', 'validate', 'restore-draft'].includes(parts[4]))) {
        try {
          if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new Error();
          if (req.body === undefined) req.body = await readJsonBody(req);
          if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || !Object.keys(req.body).length) throw new Error();
        } catch (_) { throw Object.assign(new Error('请提供有效的 JSON 对象及 application/json 请求类型'), { status: 400, code: 'TEMPLATE_INVALID_JSON' }); }
      }
      if (req.method === 'GET' && !id) {
        const result = await (templateStore.listAsync ? templateStore.listAsync(Object.fromEntries(parsed.searchParams.entries())) : templateStore.list(Object.fromEntries(parsed.searchParams.entries())));
        perfTrace('template list completed', { count: result.length, durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6 });
        return templateResponse(res, result);
      }
      if (id && !templateStore.get(id)) throw Object.assign(new Error('模板不存在'), { status: 404, code: 'TEMPLATE_NOT_FOUND' });
      if (req.method === 'GET' && id && parts.length === 6 && parts[4] === 'versions' && /^\d+$/.test(parts[5])) { const item = templateStore.get(id); const version = item?.versions.find(v => v.version === Number(parts[5])); if (!version) throw Object.assign(new Error('历史版本不存在'), { status: 404, code: 'TEMPLATE_VERSION_NOT_FOUND' }); return templateResponse(res, version); }
      if (req.method === 'GET' && id && parts[4] === 'versions') { if (forbidUnlessTemplateAction(res, session, 'template:read')) return; const item = templateStore.get(id); if (!item) return templateResponse(res, { message: '模板不存在' }, 404); return templateResponse(res, item.versions || []); }
      if (req.method === 'GET' && id && !parts[4]) return templateResponse(res, templateStore.get(id));
      if (req.method === 'PATCH' && id && !parts[4]) return templateResponse(res, templateStore.updateMetadata(id, req.body, session));
      if (req.method === 'DELETE' && id && !parts[4]) return templateResponse(res, templateStore.remove(id, session));
      if (req.method === 'POST' && !id) { if (forbidUnlessTemplateAction(res, session, 'template:edit')) return; return templateResponse(res, templateStore.create(req.body || {}, session), 201); }
      if (req.method === 'POST' && id && parts[4] === 'validate') { if (forbidUnlessTemplateAction(res, session, 'template:edit')) return; return templateResponse(res, templateStore.validateContent(req.body?.content)); }
      if (req.method === 'POST' && id && parts[4] === 'save') { if (forbidUnlessTemplateAction(res, session, 'template:edit')) return; return templateResponse(res, templateStore.save(id, req.body || {}, session)); }
      if (req.method === 'POST' && id && parts[4] === 'restore-draft') { if (forbidUnlessTemplateAction(res, session, 'template:edit')) return; return templateResponse(res, templateStore.restoreDraft(id, req.body?.version, session)); }
      if (req.method === 'POST' && id && ['disable', 'restore'].includes(parts[4])) { if (forbidUnlessTemplateAction(res, session, 'template:manage')) return; return templateResponse(res, templateStore.disable(id, session, parts[4] === 'restore')); }
      res.writeHead(405); res.end();
    } catch (error) { res.writeHead(error.status || 500, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ success: false, error: { code: error.code || 'TEMPLATE_ERROR', message: error.message } })); }
  }

  async function requireHandbookRead(session, handbookId) {
    if (!hasAction(session, 'knowledge:read')) throw new GitLabConnectorError('HANDBOOK_READ_FORBIDDEN', '没有权限查看此手册', 403);
    const visible = session?.visibleHandbookIds || session?.user?.visibleHandbookIds;
    if (Array.isArray(visible) && !visible.map(String).includes(String(handbookId))) throw new GitLabConnectorError('HANDBOOK_READ_FORBIDDEN', '没有权限查看此手册', 403);
    return assetById(await readKnowledgeAssets(), handbookId);
  }

  async function requireHandbookReadAsync(session, handbookId) {
    if (!hasAction(session, 'knowledge:read')) throw new GitLabConnectorError('HANDBOOK_READ_FORBIDDEN', '没有权限查看此手册', 403);
    const visible = session?.visibleHandbookIds || session?.user?.visibleHandbookIds;
    if (Array.isArray(visible) && !visible.map(String).includes(String(handbookId))) throw new GitLabConnectorError('HANDBOOK_READ_FORBIDDEN', '没有权限查看此手册', 403);
    return requireHandbookRead(session, handbookId);
  }

  function serveOutlineWorkbook(res, filePath, filename, unavailableCode) {
    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(error.code === 'ENOENT' ? 404 : 503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: false, error: { code: unavailableCode, message: '大纲工作簿暂不可用' } }));
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': content.length,
        'Cache-Control': 'no-store',
      });
      res.end(content);
    });
  }

  function workbookPackage(name) {
    return require(require.resolve(name, { paths: [path.join(REPOSITORY_ROOT, 'apps', 'knowledge-center-api'), REPOSITORY_ROOT] }));
  }

  function configuredTechDomainNames() {
    let payload = null;
    const databaseMode = String(process.env.KNOWLEDGE_STORAGE_MODE || 'file').toLowerCase() === 'database';
    try {
      payload = domainStore?.readTechDomains ? domainStore.readTechDomains() : null;
    } catch (error) {
      if (databaseMode) throw Object.assign(new Error('数据库技术领域配置暂不可用'), { code: error.code || 'TECH_DOMAINS_UNAVAILABLE' });
    }
    if (databaseMode && !payload) throw Object.assign(new Error('数据库技术领域配置暂不可用'), { code: 'TECH_DOMAINS_UNAVAILABLE' });
    const domains = Array.isArray(payload?.techDomains) ? payload.techDomains
      : Array.isArray(payload?.items) ? payload.items
      : Array.isArray(payload) ? payload
      : readTechDomainConfig();
    return [...new Set(domains.map(domain => String(domain?.name || domain?.displayName || domain?.code || domain?.id || '').trim()).filter(Boolean))];
  }

  function addWorksheetDataValidation(buffer, domainCount) {
    if (!domainCount) return buffer;
    const AdmZip = workbookPackage('adm-zip');
    const zip = new AdmZip(buffer);
    const worksheetEntry = zip.getEntry('xl/worksheets/sheet1.xml');
    const workbookEntry = zip.getEntry('xl/workbook.xml');
    if (!worksheetEntry || !workbookEntry) return buffer;
    const definedName = `<definedName name="TECH_DOMAIN_OPTIONS">'技术领域'!$A$2:$A$${domainCount + 1}</definedName>`;
    let workbookXml = workbookEntry.getData().toString('utf8');
    if (workbookXml.includes('</definedNames>')) {
      workbookXml = workbookXml.replace('</definedNames>', `${definedName}</definedNames>`);
    } else {
      workbookXml = workbookXml.replace('</workbook>', `<definedNames>${definedName}</definedNames></workbook>`);
    }
    const validationXml = '<dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="技术领域分工不合法" error="请从下拉列表中选择数据库已规划的技术领域名称。" sqref="F2:F1000"><formula1>TECH_DOMAIN_OPTIONS</formula1></dataValidation></dataValidations>';
    let worksheetXml = worksheetEntry.getData().toString('utf8');
    if (worksheetXml.includes('<dataValidations')) {
      worksheetXml = worksheetXml.replace(/<dataValidations[\s\S]*?<\/dataValidations>/, validationXml);
    } else if (worksheetXml.includes('<pageMargins')) {
      worksheetXml = worksheetXml.replace('<pageMargins', `${validationXml}<pageMargins`);
    } else {
      worksheetXml = worksheetXml.replace('</worksheet>', `${validationXml}</worksheet>`);
    }
    zip.updateFile('xl/workbook.xml', Buffer.from(workbookXml, 'utf8'));
    zip.updateFile('xl/worksheets/sheet1.xml', Buffer.from(worksheetXml, 'utf8'));
    return zip.toBuffer();
  }

  function outlineTemplateWorkbookBuffer() {
    const XLSX = workbookPackage('xlsx');
    const headers = outlineTemplateRules.headers;
    const domainNames = configuredTechDomainNames();
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([headers]);
    sheet['!cols'] = [{ wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 32 }, { wch: 68 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(workbook, sheet, '大纲模板');
    const domainSheet = XLSX.utils.aoa_to_sheet([['技术领域名称'], ...domainNames.map(name => [name])]);
    domainSheet['!cols'] = [{ wch: 24 }];
    XLSX.utils.book_append_sheet(workbook, domainSheet, '技术领域');
    workbook.Workbook = workbook.Workbook || {};
    workbook.Workbook.Sheets = workbook.SheetNames.map(name => ({ name, Hidden: name === '技术领域' ? 1 : 0 }));
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true });
    return addWorksheetDataValidation(buffer, domainNames.length);
  }

  function sendWorkbookBuffer(res, content, filename) {
    res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': content.length,
      'Cache-Control': 'no-store',
    });
    res.end(content);
  }

  function serveOutlineTemplateWorkbook(res) {
    fs.access(OUTLINE_TEMPLATE_PATH, fs.constants.R_OK, error => {
      if (error) {
        res.writeHead(error.code === 'ENOENT' ? 404 : 503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: false, error: { code: 'OUTLINE_TEMPLATE_UNAVAILABLE', message: '大纲工作簿暂不可用' } }));
        return;
      }
      try {
        sendWorkbookBuffer(res, outlineTemplateWorkbookBuffer(), '大纲模板.xlsx');
      } catch (templateError) {
        res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: false, error: { code: templateError.code || 'OUTLINE_TEMPLATE_UNAVAILABLE', message: '大纲模板暂不可用' } }));
      }
    });
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

  async function readKnowledgeAssets() {
    const payload = knowledgeAssetsStore.readAsync
      ? await knowledgeAssetsStore.readAsync()
      : knowledgeAssetsStore.read();
    if (!payload.generatedAt && fs.existsSync(options.KNOWLEDGE_ASSETS_CONFIG_PATH)) {
      payload.generatedAt = fs.statSync(options.KNOWLEDGE_ASSETS_CONFIG_PATH).mtime.toISOString();
    }
    const overrides = databaseMode && manualStatusStore
      ? await readManualStatusOverridesAsync()
      : null;
    return applyManualStatusOverrides(payload, overrides?.statuses || {});
  }

  async function readKnowledgeAssetsAsync() {
    return readKnowledgeAssets();
  }

  let reviewAssetsCache = null;
  async function readReviewAssetsAsync() {
    const now = Date.now();
    if (reviewAssetsCache && now - reviewAssetsCache.loadedAt < 5000) return reviewAssetsCache.payload;
    const payload = await readKnowledgeAssetsAsync();
    reviewAssetsCache = { loadedAt: now, payload };
    return payload;
  }

  async function writeKnowledgeAssets(payload) {
    await persistManualStatusOverrides(payload);
    payload.generatedAt = new Date().toISOString();
    knowledgeAssetsStore.write(payload);
    reviewAssetsCache = null;
  }

  async function writeAssetStatusPayload(payload) {
    if (databaseMode) {
      await persistManualStatusOverrides(payload);
      reviewAssetsCache = null;
      return;
    }
    await writeKnowledgeAssets(payload);
  }

  function manualStatusKey(handbook) {
    return String(handbook?.handbookId || handbook?.id || handbook?.code || '').trim();
  }

  async function readManualStatusOverridesAsync() {
    if (!manualStatusStore) return { version: 1, statuses: {}, audits: [] };
    const payload = manualStatusStore.readAsync
      ? await manualStatusStore.readAsync()
      : manualStatusStore.read
        ? manualStatusStore.read()
        : null;
    return {
      version: Number(payload?.version || 1),
      statuses: payload?.statuses && typeof payload.statuses === 'object' && !Array.isArray(payload.statuses) ? payload.statuses : {},
      audits: Array.isArray(payload?.audits) ? payload.audits : [],
    };
  }

  async function writeManualStatusOverrides(payload) {
    if (!manualStatusStore || (!manualStatusStore.writeAsync && !manualStatusStore.write)) return;
    const next = { version: Number(payload.version || 1), statuses: payload.statuses || {}, audits: payload.audits || [], updatedAt: new Date().toISOString() };
    manualStatusStore.write(next);
  }

  function applyManualStatusOverrides(payload, statuses = null) {
    if (!databaseMode || !manualStatusStore || !Array.isArray(payload?.handbooks)) return payload;
    const overrides = statuses || {};
    return {
      ...payload,
      handbooks: payload.handbooks.map(item => {
        const key = manualStatusKey(item);
        const override = key ? overrides[key] : null;
        return override ? { ...item, manualStatus: override.manualStatus || null, assetVersion: Number(override.assetVersion || item.assetVersion || 1) } : item;
      }),
    };
  }

  async function persistManualStatusOverrides(payload) {
    if (!databaseMode || !manualStatusStore || !Array.isArray(payload?.handbooks)) return;
    const overrides = await readManualStatusOverridesAsync();
    for (const item of payload.handbooks) {
      const key = manualStatusKey(item);
      if (!key) continue;
      if (item.manualStatus) {
        overrides.statuses[key] = { manualStatus: item.manualStatus, assetVersion: Number(item.assetVersion || 1), updatedAt: new Date().toISOString() };
      } else if (overrides.statuses[key]) {
        overrides.statuses[key] = { manualStatus: null, assetVersion: Number(item.assetVersion || overrides.statuses[key].assetVersion || 1), updatedAt: new Date().toISOString() };
      }
    }
    await writeManualStatusOverrides(overrides);
  }

  async function queryKnowledgeAssets(payload, searchParams, admin) {
    if (!databasePlatformMode) return queryKnowledgeAssetsBase(payload, searchParams, admin, GITLAB_CONFIG_PATH);
    // 数据库配置模式下，连接与映射由平台配置服务提供；不能继续传入文件配置路径，
    // 否则资产目录会把已保存映射投影成 repositoryMapped=false，前端也不会请求统计。
    const result = queryKnowledgeAssetsBase(payload, searchParams, admin, { mappings: [] });
    const originals = new Map(payload.handbooks.map(item => [item.handbookId, item]));
    // 只读取当前页，并受控并发加载映射。资产页最多 100 条，全部串行会把
    // 每条映射的 Storage 往返时间叠加到首屏；当前页并发读取不会改变结果顺序。
    const mappingConcurrency = Math.min(20, Math.max(1, result.items.length));
    for (let start = 0; start < result.items.length; start += mappingConcurrency) {
      const projected = await Promise.all(result.items.slice(start, start + mappingConcurrency).map(async item => {
        let mapping = null;
        try { mapping = await domainStore.readPlatformGitLabMappingAsync(item.handbookId); }
        catch (error) {
          if (error.status !== 404 || error.code !== 'GITLAB_MAPPING_NOT_FOUND') throw error;
        }
        return projectAsset(originals.get(item.handbookId), admin, mapping);
      }));
      result.items.splice(start, projected.length, ...projected);
    }
    return result;
  }

  function readJsonBody(req) {
    return new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', chunk => { raw += chunk; if (raw.length > 1024 * 1024) reject(new Error('请求内容过大')); });
      req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (_error) { reject(new Error('请求内容不是有效 JSON')); } });
      req.on('error', reject);
    });
  }

  function readBinaryBody(req, limit = 50 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      let settled = false;
      req.on('data', chunk => {
        if (settled) return;
        size += chunk.length;
        if (size > limit) {
          settled = true;
          reject(Object.assign(new Error('附件大小超过允许范围'), { code: 'ATTACHMENT_TOO_LARGE', status: 413 }));
          req.resume();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => { if (!settled) resolve(Buffer.concat(chunks)); });
      req.on('error', error => { if (!settled) reject(error); });
    });
  }

  function productionContext(handbookId, documentId, source) {
    const value = key => typeof source?.get === 'function' ? source.get(key) : source?.[key];
    return {
      handbookId,
      documentId,
      outlineVersionId: value('outlineVersionId'),
      branch: value('branch'),
    };
  }

  function sendProductionData(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify({ success: true, data }));
  }

  async function eligibleReviewers(handbookId, session) {
    const users = await Promise.resolve(authModule?.repository?.listUsers?.() || []);
    return users.filter(user => {
      const roles = new Set(user.roles || []);
      const visible = user.visibleHandbookIds;
      return (!Array.isArray(visible) || visible.map(String).includes(String(handbookId))) && (roles.has('REVIEWER') || roles.has('PLATFORM_ADMIN') || user.allowedActions?.includes('review:manage'));
    }).map(user => ({
      id: String(user.principalId || user.id || user.userId),
      displayName: String(user.displayName || user.name || user.loginName || '未命名审核人'),
      roles: user.roles || [],
      handbookId,
      disabled: false,
      disabledReason: null,
    }));
  }

  async function assertActiveProductionOutline(context) {
    if (!databaseMode) return;
    const ids = new Set([context?.outlineVersionId, ...(context?.documents || []).map(item => item.outlineVersionId)].filter(Boolean));
    for (const id of ids) {
      const outline = await domainStore.readOutlineGovernanceAsync(id);
      if (outline.deletedAt) throw Object.assign(new Error('大纲已移入回收站，请恢复后再进行文档生产'), { status: 409, code: 'OUTLINE_DELETED' });
    }
  }

  async function verifyProductionOriginSnapshot(input, session) {
    const snapshot = input.originSnapshot;
    const reject = (code, message, status = 409) => { throw Object.assign(new Error(message), { code, status }); };
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      // Keep compatibility for isolated/legacy callers only when the handbook
      // has no GitLab mapping; a mapped handbook must provide an explicit
      // server-verifiable snapshot.
      try { findMapping(input.handbookId, GITLAB_CONFIG_PATH); }
      catch (error) {
        if (error.code === 'GITLAB_MAPPING_NOT_FOUND') {
          const digest = crypto.createHash('sha256').update('').digest('hex');
          return { originType: 'blank', snapshotId: null, contentDigest: digest, handbookId: input.handbookId, documentId: input.documentId, branch: input.branch || null, fetchedAt: new Date().toISOString() };
        }
        throw error;
      }
      reject('AI_ORIGIN_SNAPSHOT_REQUIRED', '原文来源快照缺失，请重新打开文档后重试');
    }
    if (snapshot.handbookId && String(snapshot.handbookId) !== String(input.handbookId)) reject('AI_ORIGIN_SNAPSHOT_INVALID', '原文快照与当前手册不匹配');
    if (snapshot.documentId && String(snapshot.documentId) !== String(input.documentId)) reject('AI_ORIGIN_SNAPSHOT_INVALID', '原文快照与当前文档不匹配');
    if (snapshot.originType === 'blank') {
      let mapped = true;
      try { findMapping(input.handbookId, GITLAB_CONFIG_PATH); }
      catch (error) {
        if (error.code === 'GITLAB_MAPPING_NOT_FOUND') mapped = false;
        else throw error;
      }
      if (mapped) reject('AI_ORIGIN_MAPPING_REQUIRED', '手册已配置 GitLab 映射，请重新读取文档来源后再生成');
      const digest = crypto.createHash('sha256').update('').digest('hex');
      if (String(snapshot.contentDigest || '').toLowerCase() !== digest) reject('AI_ORIGIN_SNAPSHOT_INVALID', '空白原文摘要不匹配，请重新打开文档后重试');
      return { originType: 'blank', snapshotId: null, contentDigest: digest, handbookId: input.handbookId, documentId: input.documentId, branch: input.branch || null, fetchedAt: new Date().toISOString() };
    }
    if (snapshot.originType !== 'gitlab' || !snapshot.path || !snapshot.branch || (!snapshot.commitId && !snapshot.blobId)) {
      reject('AI_ORIGIN_SNAPSHOT_INVALID', 'GitLab 原文快照缺少路径、分支或版本标识');
    }
    const { mapping, connection } = findMapping(input.handbookId, GITLAB_CONFIG_PATH);
    const branch = String(snapshot.branch);
    const filePath = authorizeMappedRequest(mapping, branch, 'zh', snapshot.path);
    if (input.branch && String(input.branch) !== branch) reject('AI_ORIGIN_SNAPSHOT_INVALID', '原文快照分支与当前写作分支不一致');
    const ref = snapshot.pinToCommit ? snapshot.commitId : branch;
    if (snapshot.pinToCommit && !snapshot.commitId) reject('AI_ORIGIN_SNAPSHOT_INVALID', '固定旧基线需要 GitLab commit 标识');
    const file = await gitLabRequestForUser(session, connection, options => readGitLabFile(connection, ref, filePath, options));
    if (file.encoding !== 'utf-8' || typeof file.content !== 'string') reject('AI_ORIGIN_FILE_INVALID', 'GitLab 原文不是有效的 Markdown 文本', 415);
    const digest = crypto.createHash('sha256').update(file.content).digest('hex');
    if (digest !== String(snapshot.contentDigest || '').toLowerCase()) reject('AI_ORIGIN_BASELINE_CHANGED', 'GitLab 原文与当前编辑基线不一致，请重新载入文档或恢复原快照');
    if (snapshot.commitId && file.commitId && snapshot.commitId !== file.commitId) reject('AI_ORIGIN_BASELINE_CHANGED', 'GitLab commit 已变化，请重新载入文档或恢复原快照');
    if (snapshot.blobId && file.blobId && snapshot.blobId !== file.blobId) reject('AI_ORIGIN_BASELINE_CHANGED', 'GitLab blob 已变化，请重新载入文档或恢复原快照');
    const snapshotId = file.commitId || file.blobId || digest;
    if (snapshot.snapshotId && snapshot.snapshotId !== snapshotId) reject('AI_ORIGIN_BASELINE_CHANGED', 'GitLab 快照标识已变化，请重新载入文档或恢复原快照');
    return {
      originType: 'gitlab', snapshotId, contentDigest: digest, handbookId: input.handbookId, documentId: input.documentId,
      outlineVersionId: input.outlineVersionId || snapshot.outlineVersionId || null,
      repository: connection.projectPath || connection.project, project: connection.projectPath || connection.project,
      branch, path: file.path || filePath, commitId: file.commitId || snapshot.commitId || null,
      blobId: file.blobId || snapshot.blobId || null, fetchedAt: new Date().toISOString(),
    };
  }

  async function handleHandbookProduction(req, res, session, pathname) {
    const qualityMatch = pathname.match(/^\/knowledge-center\/api\/production\/handbooks\/([^/]+)\/documents\/([^/]+)\/quality(?:\/([^/]+))?$/);
    if (qualityMatch) {
      const handbookId = decodeURIComponent(qualityMatch[1]);
      const documentId = decodeURIComponent(qualityMatch[2]);
      await requireHandbookReadAsync(session, handbookId);
      const reportId = qualityMatch[3] ? decodeURIComponent(qualityMatch[3]) : null;
      if (req.method === 'GET' && reportId) {
        sendProductionData(res, handbookProductionService.quality.get({ handbookId, documentId, reportId }, session));
      } else if (req.method === 'POST' && !reportId) {
        const body = await readJsonBody(req);
        await assertActiveProductionOutline(body);
        const report = await handbookProductionService.quality.run({ ...body, handbookId, documentId }, session);
        let linked = report;
        if (body.revisionId) {
          try {
            linked = handbookProductionService.quality.linkToRevision({ handbookId, documentId, revisionId: body.revisionId, reportId: report.reportId, outlineVersionId: body.outlineVersionId, branch: body.branch }, session);
          } catch (error) {
            // Candidate reports may be created before the candidate is adopted into a saved revision.
            // Keep the report revision-bound by digest and link it on the subsequent save.
            if (error.code !== 'QUALITY_REVISION_NOT_FOUND') throw error;
          }
        }
        sendProductionData(res, linked, 201);
      } else { res.writeHead(405, { Allow: 'GET, POST' }); res.end(); }
      return true;
    }
    const skillMatch = pathname.match(/^\/knowledge-center\/api\/production\/handbooks\/([^/]+)\/documents\/([^/]+)\/ai-skills$/);
    if (skillMatch) {
      const handbookId = decodeURIComponent(skillMatch[1]);
      const documentId = decodeURIComponent(skillMatch[2]);
      await requireHandbookReadAsync(session, handbookId);
      if (req.method === 'GET') {
        const params = new URL(req.url, 'http://localhost').searchParams;
        sendProductionData(res, handbookProductionService.ai.skills.list(productionContext(handbookId, documentId, params), session));
      } else { res.writeHead(405, { Allow: 'GET' }); res.end(); }
      return true;
    }
    const sourceImageMatch = pathname.match(/^\/knowledge-center\/api\/production\/handbooks\/([^/]+)\/documents\/([^/]+)\/ai-sources\/images\/([a-f0-9]{64})$/);
    if (sourceImageMatch) {
      if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }); res.end(); return true; }
      const handbookId = decodeURIComponent(sourceImageMatch[1]);
      const documentId = decodeURIComponent(sourceImageMatch[2]);
      await requireHandbookReadAsync(session, handbookId);
      const params = new URL(req.url, 'http://localhost').searchParams;
      const image = handbookProductionService.ai.sources.readImage({ ...productionContext(handbookId, documentId, params), assetId: sourceImageMatch[3] }, session);
      res.writeHead(200, { 'Content-Type': image.contentType, 'Content-Length': image.data.length,
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store', 'Content-Security-Policy': "default-src 'none'; sandbox" });
      res.end(image.data);
      return true;
    }
    const sourceMatch = pathname.match(/^\/knowledge-center\/api\/production\/handbooks\/([^/]+)\/documents\/([^/]+)\/ai-sources$/);
    const sourceUploadMatch = pathname.match(/^\/knowledge-center\/api\/production\/handbooks\/([^/]+)\/documents\/([^/]+)\/ai-sources\/uploads$/);
    if (sourceMatch) {
      const traceId = require('crypto').randomUUID();
      const startedAt = Date.now();
      const diagnostic = { stage: 'context', requestId: traceId };
      const meta = { requestId: traceId, method: req.method };
      res.setHeader('X-Request-ID', traceId);
      logger.info('production.source.started', meta);
      try {
        const handbookId = decodeURIComponent(sourceMatch[1]);
        const documentId = decodeURIComponent(sourceMatch[2]);
        Object.assign(meta, { handbookId, documentId });
        diagnostic.stage = 'authorization';
        await requireHandbookReadAsync(session, handbookId);
        if (req.method === 'GET') {
          const params = new URL(req.url, 'http://localhost').searchParams;
          sendProductionData(res, await handbookProductionService.ai.sources.list(productionContext(handbookId, documentId, params), session));
        } else if (req.method === 'POST') {
          diagnostic.stage = 'request_validation';
          const body = await readJsonBody(req);
          Object.assign(meta, {
            sourceType: typeof body.sourceType === 'string' ? body.sourceType.slice(0, 40) : null,
            locatorDigest: require('crypto').createHash('sha256').update(String(body.locator || '')).digest('hex'),
            locatorChars: typeof body.locator === 'string' ? body.locator.length : 0,
          });
          await assertActiveProductionOutline(body);
          const source = await handbookProductionService.ai.sources.preview({ ...body, handbookId, documentId }, session, diagnostic);
          meta.sourceId = source.sourceId;
          meta.contentBytes = Buffer.byteLength(source.content);
          sendProductionData(res, source, 201);
        } else { res.writeHead(405, { Allow: 'GET, POST' }); res.end(); }
        logger.info('production.source.completed', { ...meta, ...diagnostic, status: res.statusCode, durationMs: Date.now() - startedAt });
      } catch (error) {
        logger.info('production.source.failed', { ...meta, ...diagnostic, status: error.status || 500, errorCode: error.code || 'SOURCE_REQUEST_FAILED', durationMs: Date.now() - startedAt });
        error.details = { ...error.details, requestId: traceId };
        throw error;
      }
      return true;
    }
    if (sourceUploadMatch) {
      if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); res.end(); return true; }
      const handbookId = decodeURIComponent(sourceUploadMatch[1]);
      const documentId = decodeURIComponent(sourceUploadMatch[2]);
      const params = new URL(req.url, 'http://localhost').searchParams;
      const context = productionContext(handbookId, documentId, params);
      await requireHandbookReadAsync(session, handbookId);
      await assertActiveProductionOutline(context);
      const rawName = String(req.headers['x-file-name'] || '本地文档');
      let fileName; try { fileName = decodeURIComponent(rawName); } catch (_) { fileName = rawName; }
      const buffer = await readBinaryBody(req, handbookProductionService.ai.sources.uploadPolicy().maxBytes);
      const source = await handbookProductionService.ai.sources.previewUpload(context, buffer, fileName, req.headers['content-type'], session);
      sendProductionData(res, source, 201);
      return true;
    }
    const aiMatch = pathname.match(/^\/knowledge-center\/api\/production\/handbooks\/([^/]+)\/documents\/([^/]+)\/ai-jobs(?:\/([^/]+)(?:\/(cancel|adopt|retry|recover))?)?$/);
    if (aiMatch) {
      const handbookId = decodeURIComponent(aiMatch[1]);
      const documentId = decodeURIComponent(aiMatch[2]);
      const jobId = aiMatch[3] ? decodeURIComponent(aiMatch[3]) : null;
      const action = aiMatch[4];
      await requireHandbookReadAsync(session, handbookId);
      if (req.method === 'GET' && jobId && !action) {
        const params = new URL(req.url, 'http://localhost').searchParams;
        sendProductionData(res, handbookProductionService.ai.get({ ...productionContext(handbookId, documentId, params), jobId }, session));
      } else if (req.method === 'POST' && (!jobId || action)) {
        const body = await readJsonBody(req);
        await assertActiveProductionOutline(body);
        let input = { ...body, handbookId, documentId, jobId };
        if (!jobId) {
          input.originSnapshot = await verifyProductionOriginSnapshot(input, session);
          sendProductionData(res, handbookProductionService.ai.start(input, session, req.headers['idempotency-key']), 202);
        }
        else if (action === 'cancel') sendProductionData(res, handbookProductionService.ai.cancel(input, session));
        else if (action === 'retry') sendProductionData(res, handbookProductionService.ai.retry(input, session, req.headers['idempotency-key']), 202);
        else if (action === 'recover') sendProductionData(res, handbookProductionService.ai.recover(input, session), 202);
        else sendProductionData(res, handbookProductionService.ai.adopt(input, session));
      } else {
        res.writeHead(405, { Allow: 'GET, POST' }); res.end();
      }
      return true;
    }
    const storedAttachmentMatch = pathname.match(/^\/knowledge-center\/api\/production\/attachments\/([^/]+)$/);
    const documentMatch = pathname.match(/^\/knowledge-center\/api\/production\/handbooks\/([^/]+)\/documents\/([^/]+)\/draft(?:\/(revisions|restore))?$/);
    const attachmentMatch = pathname.match(/^\/knowledge-center\/api\/production\/handbooks\/([^/]+)\/documents\/([^/]+)\/draft-attachments$/);
    const reviewersMatch = pathname.match(/^\/knowledge-center\/api\/production\/handbooks\/([^/]+)\/reviewers$/);
    const incrementalReviewMatch = pathname.match(/^\/knowledge-center\/api\/production\/handbooks\/([^/]+)\/incremental-reviews$/);
    const reviewDraftsMatch = pathname.match(/^\/knowledge-center\/api\/production\/handbooks\/([^/]+)\/review-drafts$/);
    const reviewBatchMatch = pathname.match(/^\/knowledge-center\/api\/production\/handbooks\/([^/]+)\/review-batches$/);
    if (!documentMatch && !attachmentMatch && !reviewersMatch && !reviewBatchMatch && !incrementalReviewMatch && !reviewDraftsMatch && !storedAttachmentMatch) return false;

    if (reviewDraftsMatch && req.method === 'GET') {
      const handbookId = decodeURIComponent(reviewDraftsMatch[1]);
      await requireHandbookReadAsync(session, handbookId);
      sendProductionData(res, { items: handbookProductionService.listReviewDrafts(handbookId, session) });
      return true;
    }

    if (storedAttachmentMatch && req.method === 'GET') {
      const result = handbookProductionService.readAttachment(decodeURIComponent(storedAttachmentMatch[1]), session);
      res.writeHead(200, {
        'Content-Type': result.metadata.mimeType,
        'Content-Length': result.buffer.length,
        'Content-Disposition': `${result.metadata.kind === 'image' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(result.metadata.fileName)}`,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(result.buffer);
      return true;
    }

    if (reviewersMatch && req.method === 'GET') {
      sendProductionData(res, { items: await eligibleReviewers(decodeURIComponent(reviewersMatch[1]), session), capabilities: handbookProductionService.capabilities(session) });
      return true;
    }
    if (incrementalReviewMatch && req.method === 'POST') {
      const handbookId = decodeURIComponent(incrementalReviewMatch[1]);
      await requireHandbookReadAsync(session, handbookId);
      if (!hasAction(session, 'knowledge:write')) throw Object.assign(new Error('没有提交评审权限'), { status: 403 });
      const key = req.headers['idempotency-key'];
      if (!key) throw Object.assign(new Error('提交评审需要幂等键'), { status: 400 });
      const body = await readJsonBody(req);
      if (body.reviewMode && body.reviewMode !== 'online_review') throw Object.assign(new Error('不支持的评审模式'), { status: 422 });
      await assertActiveProductionOutline(body);
      if (!Array.isArray(body.documents) || !body.documents.length) throw Object.assign(new Error('至少选择一篇已保存文档'), { status: 422 });
      if (body.reviewMode === 'online_review' && (!['document', 'handbook'].includes(body.scope) || (body.scope === 'document' && body.documents.length !== 1))) throw Object.assign(new Error('在线评审范围与所选文档不一致'), { status: 422, code: 'ONLINE_REVIEW_SCOPE_INVALID' });
      const service = handleIncrementalBuild?.service;
      if (!service) throw Object.assign(new Error('增量审核服务暂不可用'), { status: 503 });
      const { mapping, connection } = findMapping(handbookId, GITLAB_CONFIG_PATH);
      const branch = body.documents[0].branch;
      // 分支与数据库版本是独立维度；缺少权威版本时保留待核对状态，
      // 不把仓库分支名伪装成数据库版本。
      const businessVersion = String(body.businessVersion || '').trim() || '版本待核对';
      if (body.documents.some(item => item.branch !== branch)) throw Object.assign(new Error('一次评审只能提交同一分支'), { status: 422 });
      const eligible = new Set((await eligibleReviewers(handbookId, session)).map(item => item.id));
      const savedRevisions = new Map();
      const documents = body.documents.map(item => {
        const result = handbookProductionService.getDraft({ ...item, handbookId }, session);
        if (!result.capabilities.canSubmitReview || !result.exists || result.draft.currentRevisionId !== item.draftRevisionId) throw Object.assign(new Error('草稿版本已变化，请刷新后重新提交'), { status: 409, code: 'REVIEW_REVISION_STALE' });
        savedRevisions.set(item.documentId, result.draft.revision);
        const filePath = authorizeMappedRequest(mapping, branch, 'zh', item.filePath);
        if (!filePath || !/\.(md|markdown)$/i.test(filePath)) throw Object.assign(new Error('请选择映射目录中的 Markdown 文件路径'), { status: 422 });
        const reviewerIds = item.reviewerIds || body.defaultReviewerIds || [];
        if (!reviewerIds.length || reviewerIds.some(id => !eligible.has(String(id)))) throw Object.assign(new Error('请选择有审核权限的审核人（可以是本人）'), { status: 422 });
        return { handbookId, documentId: item.documentId, draftRevisionId: item.draftRevisionId, outlineVersionId: result.draft.outlineVersionId, branch: result.draft.branch, filePath, reviewerIds, markdown: result.draft.revision.markdown, templateVersionId: result.draft.revision.templateVersionId, baselineDigest: result.draft.revision.baselineDigest };
      });
      if (new Set(documents.map(item => item.documentId)).size !== documents.length) throw Object.assign(new Error('文档不能重复提交'), { status: 422 });
      if (new Set(documents.map(item => item.filePath)).size !== documents.length) throw Object.assign(new Error('多个文档不能映射同一仓库文件'), { status: 422 });
      const splitReason = String(body.splitReason || '').trim();
      if (splitReason.length > 500) throw Object.assign(new Error('拆分原因不能超过500字'), { status: 422, code: 'SPLIT_REASON_TOO_LONG' });
      // 同一手册、同一版本和同一来源默认复用原任务；只有明确填写原因
      // 才将原因纳入身份，允许建立一条可追溯的拆分任务。保留不含拆分
      // 原因的来源身份，供拆分任务回指原任务和审计同源历史。
      const sourceIdentity = [handbookId, businessVersion, documents.map(item => [item.documentId, item.draftRevisionId, item.filePath])];
      if (body.reviewMode === 'online_review') sourceIdentity.push(body.reviewMode, body.scope);
      const sourceSubmissionId = crypto.createHash('sha256').update(JSON.stringify(sourceIdentity)).digest('hex');
      const submissionIdentity = [...sourceIdentity];
      if (splitReason) submissionIdentity.push({ splitReason });
      const submissionId = crypto.createHash('sha256').update(JSON.stringify(submissionIdentity)).digest('hex');
      // A retry returns the original frozen task even if the repository has
      // moved since its creation; it never creates another candidate.
      const previous = service.repository.read().tasks.find(item => item.handbookSource?.submissionId === submissionId && service.isOwner(session, item));
      const splitFrom = splitReason && !previous
        ? service.repository.read().tasks.find(item => item.handbookSource?.sourceSubmissionId === sourceSubmissionId && service.isOwner(session, item))
        : null;
      let task = previous ? service.get(session, previous.id) : null;
      if (!task) {
        const branches = await gitLabRequestForUser(session, connection, options => listBranches(connection, options));
        const commitSha = branches.find(item => item.name === branch)?.commitSha;
        if (!commitSha) throw Object.assign(new Error('目标分支不可读取'), { status: 409 });
        for (const document of documents) {
          authorizeMappedRequest(mapping, branch, 'zh', document.filePath);
          const prepared = handbookProductionService.delivery.prepare(document, savedRevisions.get(document.documentId), session,
            resourcePath => authorizeMappedRequest(mapping, branch, 'zh', resourcePath));
          document.markdown = prepared.markdown;
          const resourcePaths = extractMarkdownResources(document.markdown, document.filePath);
          resourcePaths.forEach(resource => authorizeMappedRequest(mapping, branch, 'zh', resource.path));
          const file = await gitLabRequestForUser(session, connection, options => readGitLabFile(connection, commitSha, document.filePath, options)).catch(error => {
            if (error.status === 404) return null;
            throw error;
          });
          document.baselineContent = file?.content ?? null;
          document.action = file ? 'update' : 'create';
          const actualDigest = crypto.createHash('sha256').update(document.baselineContent || '').digest('hex');
          if (actualDigest !== document.baselineDigest) throw Object.assign(new Error('仓库正文与保存时基线不同，请重新加载并保存'), { status: 409, code: 'GITLAB_BASELINE_CHANGED' });
          if (document.markdown === document.baselineContent) throw Object.assign(new Error('候选正文与 GitLab 内容完全一致，没有可提交的变更'), { status: 422, code: 'GITLAB_NO_CHANGES' });
          document.resources = await gitLabRequestForUser(session, connection, options => readDocumentResources(connection, commitSha, document, { ...options, managedResources: prepared.managedResources }));
        }
        const content = documents.length === 1 ? documents[0].markdown : documents.map(item => `# ${item.filePath}\n\n${item.markdown}`).join('\n\n');
        const baselineContent = documents.length === 1 ? documents[0].baselineContent || '\n' : documents.map(item => `# ${item.filePath}\n\n${item.baselineContent || ''}`).join('\n\n');
        task = service.createHandbookReview(session, key, {
          handbookId, branch, businessVersion, commitSha, submissionId, documents, content, baselineContent, reviewMode: body.reviewMode || null,
          repositoryIdentity: { connectionId: connection.id, host: connection.host, project: connection.projectPath || connection.project },
          name: body.note || `手册文档评审：${documents.map(item => item.filePath).join('、')}`,
          sourceSubmissionId, splitFromTaskId: splitFrom?.id || null, splitReason: splitReason || null,
          operations: documents.map(item => ({ type: item.action === 'create' ? 'add' : 'update', documentId: item.documentId, nodeId: item.documentId, beforeDigest: item.baselineDigest, after: { content: item.markdown } })),
        });
      }
      const reviewHref = `/knowledge-center/review?handbookId=${encodeURIComponent(handbookId)}&taskId=${encodeURIComponent(task.id)}`;
      documents.forEach(item => handbookProductionService.linkIncrementalReview({ ...item, handbookId, taskId: task.id, reviewHref }, session));
      sendProductionData(res, { tasks: [task], reviewHref }, 201);
      return true;
    }
    if (reviewBatchMatch && req.method === 'POST') {
      const handbookId = decodeURIComponent(reviewBatchMatch[1]);
      const body = await readJsonBody(req);
      await assertActiveProductionOutline(body);
      const reviewers = await eligibleReviewers(handbookId, session);
      sendProductionData(res, handbookProductionService.createReviewBatch({ ...body, handbookId }, session, req.headers['idempotency-key'], reviewers), 201);
      return true;
    }
    if (attachmentMatch && req.method === 'POST') {
      const params = new URL(req.url, 'http://localhost').searchParams;
      const handbookId = decodeURIComponent(attachmentMatch[1]);
      const documentId = decodeURIComponent(attachmentMatch[2]);
      await assertActiveProductionOutline(productionContext(handbookId, documentId, params));
      const rawName = String(req.headers['x-file-name'] || '');
      let fileName;
      try { fileName = decodeURIComponent(rawName); } catch (_error) { fileName = rawName; }
      const buffer = await readBinaryBody(req);
      sendProductionData(res, handbookProductionService.stageAttachment({
        ...productionContext(handbookId, documentId, params),
        fileName,
        mimeType: req.headers['content-type'],
      }, buffer, session), 201);
      return true;
    }
    if (documentMatch) {
      const handbookId = decodeURIComponent(documentMatch[1]);
      const documentId = decodeURIComponent(documentMatch[2]);
      const suffix = documentMatch[3] || '';
      if (req.method === 'GET' && !suffix) {
        const params = new URL(req.url, 'http://localhost').searchParams;
        const started = performance.now();
        const readDraft = handbookProductionService.getDraftAsync || handbookProductionService.getDraft;
        const data = await readDraft(productionContext(handbookId, documentId, params), session);
        res.setHeader('Server-Timing', `draft_read;dur=${(performance.now() - started).toFixed(2)}`);
        sendProductionData(res, data);
        return true;
      }
      if (req.method === 'PUT' && !suffix) {
        const body = await readJsonBody(req);
        await assertActiveProductionOutline(body);
        sendProductionData(res, handbookProductionService.saveDraft({ ...body, handbookId, documentId }, session, req.headers['idempotency-key']));
        return true;
      }
      if (req.method === 'GET' && suffix === 'revisions') {
        const params = new URL(req.url, 'http://localhost').searchParams;
        sendProductionData(res, handbookProductionService.listRevisions(productionContext(handbookId, documentId, params), session));
        return true;
      }
      if (req.method === 'POST' && suffix === 'restore') {
        const body = await readJsonBody(req);
        await assertActiveProductionOutline(body);
        sendProductionData(res, handbookProductionService.restoreRevision({ ...body, handbookId, documentId }, session, req.headers['idempotency-key']));
        return true;
      }
    }
    res.writeHead(405, { Allow: 'GET, PUT, POST' }); res.end();
    return true;
  }

  function ownerValue(value, required = false) {
    if (value == null || value === '') {
      if (required) throw new Error('A 角为必填项');
      return null;
    }
    if (typeof value !== 'object') throw new Error('责任人必须从人员列表中选择');
    const principalId = Number(value.principalId ?? value.userId ?? value.id);
    const displayName = String(value.displayName || '').trim();
    if (!Number.isSafeInteger(principalId) || principalId <= 0 || !displayName) throw new Error('责任人信息不完整，请重新选择');
    return { principalId, userId: principalId, id: principalId, displayName, bindingStatus: 'bound' };
  }

  function validateOwnerPair(ownerA, ownerB) {
    if (ownerA && ownerB && Number(ownerA.principalId) === Number(ownerB.principalId)) throw new Error('A 角和 B 角不能是同一人');
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
      const payload = await readKnowledgeAssets();
      const product = payload.handbooks.find(entry => String(entry.productId || entry.productType) === productId);
      const productName = product?.productName || product?.productType;
      if (!productName) throw new Error('产品不存在或未配置产品名称');
      const ownerA = ownerValue(body.ownerA, true); const ownerB = ownerValue(body.ownerB);
      validateOwnerPair(ownerA, ownerB);
      const item = {
        handbookId: nextHandbookId(payload, productName), productId, productName, productType: productName, name,
        ownerA, ownerB,
        externalVisible: Boolean(body.externalVisible), summary: String(body.summary || '').trim(),
        outline: { outlineId: null, outlineVersion: null, bindingStatus: 'not_created' },
        documentSummary: { total: null, published: null, inProgress: null }, sourceStatus: 'created',
        assetVersion: 1, manualStatus: null,
      };
      payload.handbooks.push(item);
      auditAsset(payload, 'ASSET_CREATED', item.handbookId, session);
      await writeKnowledgeAssets(payload);
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
      const payload = await readKnowledgeAssets();
      const item = payload.handbooks.find(entry => entry.handbookId === handbookId);
      if (!item) { res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ success: false, error: { code: 'ASSET_NOT_FOUND', message: '手册不存在' } })); return; }
      const expectedVersion = Number(changes.expectedVersion);
      const currentVersion = Number(item.assetVersion || 1);
      if (!Number.isInteger(expectedVersion) || expectedVersion !== currentVersion) throw Object.assign(new Error('手册信息已变化，请刷新后重试'), { code: 'ASSET_VERSION_CONFLICT', status: 409 });
      const before = { name: item.name, ownerA: item.ownerA, ownerB: item.ownerB };
      if (Object.hasOwn(changes, 'name')) { const name = String(changes.name || '').trim(); if (!name) throw new Error('手册名称不能为空'); item.name = name; }
      if (Object.hasOwn(changes, 'ownerA')) item.ownerA = ownerValue(changes.ownerA, true);
      if (Object.hasOwn(changes, 'ownerB')) item.ownerB = ownerValue(changes.ownerB);
      validateOwnerPair(item.ownerA, item.ownerB);
      item.assetVersion = Number(item.assetVersion || 1) + 1;
      auditAsset(payload, 'ASSET_UPDATED', handbookId, session, { before, after: { name: item.name, ownerA: item.ownerA, ownerB: item.ownerB } });
      await writeKnowledgeAssets(payload);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ success: true, data: projectAsset(item, true) }));
    } catch (error) {
      res.writeHead(error.status || (error.code === 'ASSET_VERSION_CONFLICT' ? 409 : 400), { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: { code: error.code || 'ASSET_UPDATE_FAILED', message: error.message } }));
    }
  }

  async function changeAssetStatus(req, res, handbookId, session) {
    try {
      const body = await readJsonBody(req);
      const payload = await readKnowledgeAssets();
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
      await writeAssetStatusPayload(payload);
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
      const payload = await readKnowledgeAssets();
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
      await writeAssetStatusPayload(payload);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ success: true, data: projectAsset(item, true) }));
    } catch (error) {
      res.writeHead(error.status || 400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ success: false, error: { code: error.code || 'ASSET_STATUS_RESOLVE_FAILED', message: error.message } }));
    }
  }

  async function changeArchiveState(res, handbookId, archived, session) {
    const payload = await readKnowledgeAssets();
    const item = payload.handbooks.find(entry => entry.handbookId === handbookId);
    if (!item) { res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ success: false, error: { code: 'ASSET_NOT_FOUND', message: '手册不存在' } })); return; }
    const running = Number(item.documentSummary?.runningTasks || 0);
    if (archived && running > 0) {
      res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: { code: 'ASSET_HAS_RUNNING_TASKS', message: '手册存在运行中任务，暂不能停用', details: { runningTasks: running } } }));
      return;
    }
    const previousArchivedAt = item.archivedAt || null;
    const previousStatus = item.status;
    // The database projection enforces STATE=ARCHIVED iff ARCHIVED_AT is set.
    // Keep the file-backed contract (archivedAt controls visibility) while
    // emitting the corresponding database state for database-backed writes.
    item.archivedAt = archived ? new Date().toISOString() : null;
    if (databaseMode) item.status = archived ? 'archived' : 'active';
    item.assetVersion = Number(item.assetVersion || 1) + 1;
    auditAsset(payload, archived ? 'ASSET_ARCHIVED' : 'ASSET_RESTORED', handbookId, session);
    try {
      await writeKnowledgeAssets(payload);
    } catch (error) {
      item.archivedAt = previousArchivedAt;
      item.status = previousStatus;
      const status = Number(error.status) >= 500 ? 503 : (Number(error.status) || 503);
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ success: false, error: { code: error.code || 'ASSET_ARCHIVE_FAILED', message: error.message || '手册生命周期更新失败，请稍后重试。' } }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ success: true, data: projectAsset(item, true) }));
  }

  async function serveKnowledgeAssetsCatalog(res) {
    try {
      const body = await readKnowledgeAssets();
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
    const declaredStatus = Number(error?.status);
    const status = error instanceof GitLabConnectorError || error instanceof GitLabOAuthError
      ? error.status
      : Number.isInteger(declaredStatus) && declaredStatus >= 400 && declaredStatus <= 599 ? declaredStatus : 500;
    const body = { success: false, error: { code: error.code || 'GITLAB_REQUEST_FAILED', message: error.message || 'GitLab 请求失败', details: error.details || {} } };
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  }

  function repositoryDocumentRules() {
    try {
      const payload = JSON.parse(fs.readFileSync(GITLAB_DOCUMENT_TYPES_PATH, 'utf8'));
      const value = payload.gitlabDocumentTypes || payload;
      return { extensions: new Set((value.extensions || []).map(String)), excludedNames: new Set((value.excludedNames || []).map(String)) };
    } catch (_error) {
      throw new GitLabConnectorError('GITLAB_DOCUMENT_TYPES_UNAVAILABLE', '仓库文档类型配置不可用', 503);
    }
  }

  function minimizeMappedRoots(values) {
    return [...new Set(values)].sort((a, b) => a.length - b.length).filter((value, index, all) => !all.slice(0, index).some(parent => value.startsWith(`${parent}/`)));
  }

  async function gitLabRequestForUser(session, connection, operation) {
    const accessToken = await tokenForUser(session?.user?.id, connection);
    try {
      return await operation(accessToken ? { accessToken } : {});
    } catch (error) {
      if (error?.code !== 'GITLAB_UNAUTHORIZED' || !accessToken) throw error;
      const refreshed = await tokenForUser(session?.user?.id, connection, { forceRefresh: true });
      if (!refreshed) throw error;
      return operation({ accessToken: refreshed });
    }
  }

  async function handbookRepositoryStatistics(res, session, handbookId, params) {
    await requireHandbookRead(session, handbookId);
    const { mapping, connection } = findMapping(handbookId, GITLAB_CONFIG_PATH);
    const ref = params.get('ref') || mapping.defaultBranch;
    const language = params.get('language') === 'en' ? 'en' : 'zh';
    const roots = minimizeMappedRoots(language === 'en' ? mapping.enPaths : mapping.zhPaths);
    if (!mapping.enabledBranches.includes(ref)) throw new GitLabConnectorError('GITLAB_BRANCH_NOT_ALLOWED', '该业务版本未在手册映射中启用', 403);
    if (!roots.length) throw new GitLabConnectorError('GITLAB_LANGUAGE_NOT_MAPPED', '该语言尚未配置仓库内容路径', 404);
    const rules = repositoryDocumentRules();
    const chapters = new Set();
    const documents = new Set();
    const branch = (await gitLabRequestForUser(session, connection, options => listBranches(connection, options))).find(item => item.name === ref);
    if (!branch) throw new GitLabConnectorError('GITLAB_BRANCH_NOT_FOUND', 'GitLab 分支不存在', 404);
    const headSha = branch.commitSha || null;
    for (const root of roots) {
      const rootExtension = path.extname(root).toLowerCase();
      if (rules.extensions.has(rootExtension) && !rules.excludedNames.has(path.basename(root).toLowerCase())) { documents.add(root); continue; }
      const entries = await gitLabRequestForUser(session, connection, options => listTree(connection, ref, root, options));
      for (const entry of entries) {
        if (entry.type === 'tree') { chapters.add(entry.path); continue; }
        const ext = path.extname(entry.path).toLowerCase();
        if (rules.extensions.has(ext) && !rules.excludedNames.has(path.basename(entry.path).toLowerCase())) documents.add(entry.path);
      }
    }
    return { handbookId, ref, language, headSha, branch: ref, chapterCount: chapters.size, documentCount: documents.size, chapters: chapters.size, documents: documents.size, mappedRoots: roots, extensions: [...rules.extensions] };
  }

  async function handleGitLabApi(req, res, session) {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    try {
      if (req.method === 'GET' && pathname === '/knowledge-center/api/gitlab/oauth/start') {
        const params = new URL(req.url, 'http://localhost').searchParams;
        const connection = findConnection(params.get('connectionId') || '', GITLAB_CONFIG_PATH);
        const projected = sanitizeConnection(connection);
        if (projected.authMode !== 'user_oauth') throw new GitLabOAuthError('GITLAB_OAUTH_NOT_REQUIRED', '该连接由平台统一维护，无需连接个人账号', 409);
        if (projected.managementStatus === 'disabled' || connection.mode === 'disabled') throw new GitLabOAuthError('GITLAB_CONNECTION_INACTIVE', '该 GitLab 连接已由平台停用', 409);
        const returnTo = params.get('returnTo') || '/knowledge-center/?externalAccount=1';
        const authorizationUrl = startGitLabOAuth({ userId: session?.user?.id, connectionId: connection.id, host: connection.host, returnTo });
        res.writeHead(302, { Location: authorizationUrl, 'Cache-Control': 'no-store' }); res.end(); return;
      }
      if (req.method === 'GET' && pathname === '/knowledge-center/api/gitlab/oauth/callback') {
        const params = new URL(req.url, 'http://localhost').searchParams;
        const result = await completeGitLabOAuth({ userId: session?.user?.id, code: params.get('code'), state: params.get('state') });
        const connection = findConnection(result.connectionId, GITLAB_CONFIG_PATH);
        let returnTo = result.returnTo || '/knowledge-center/platform?tab=gitlab';
        try {
          const branches = await gitLabRequestForUser(session, connection, options => listBranches(connection, options));
          recordVerification(connection.id, { connectionId: connection.id, status: 'verified', branchCount: branches.length, verifiedAt: new Date().toISOString() }, GITLAB_CONFIG_PATH, { operatorId: session?.user?.id }, connection);
          const target = new URL(returnTo, 'http://knowledge-center.local');
          target.searchParams.set('gitlabConnection', connection.id);
          target.searchParams.set('gitlabConnectionStatus', 'verified');
          returnTo = `${target.pathname}${target.search}${target.hash}`;
        } catch (error) {
          const recovery = verificationRepairs[error.code] || verificationRepairs.default;
          const failed = { connectionId: connection.id, status: 'failed', verifiedAt: new Date().toISOString(), error: { code: error.code || 'GITLAB_VERIFY_FAILED', message: error.message, recovery } };
          recordVerification(connection.id, failed, GITLAB_CONFIG_PATH, { operatorId: session?.user?.id }, connection);
          const target = new URL(returnTo, 'http://knowledge-center.local');
          target.searchParams.set('gitlabConnection', connection.id);
          target.searchParams.set('gitlabConnectionStatus', 'failed');
          returnTo = `${target.pathname}${target.search}${target.hash}`;
        }
        res.writeHead(302, { Location: returnTo, 'Cache-Control': 'no-store' }); res.end(); return;
      }
      if (req.method === 'GET' && pathname === '/knowledge-center/api/gitlab/oauth/status') {
        const params = new URL(req.url, 'http://localhost').searchParams;
        const cfg = readGitLabConfig(GITLAB_CONFIG_PATH);
        const connection = params.get('connectionId') ? findConnection(params.get('connectionId'), GITLAB_CONFIG_PATH) : (cfg.connections || []).find(item => item.authMode === 'user_oauth') || null;
        const data = await gitLabOAuthStatus(session?.user?.id, connection);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data })); return;
      }
      if (req.method === 'GET' && pathname === '/knowledge-center/api/gitlab/oauth/accounts') {
        const cfg = readGitLabConfig(GITLAB_CONFIG_PATH);
        const mappingCounts = new Map();
        for (const mapping of cfg.mappings || []) {
          if (!mappingCounts.has(mapping.connectionId)) mappingCounts.set(mapping.connectionId, new Set());
          mappingCounts.get(mapping.connectionId).add(mapping.handbookId);
        }
        const candidates = (cfg.connections || []).filter(item => sanitizeConnection(item).authMode === 'user_oauth');
        const items = await Promise.all(candidates.map(async connection => {
          const projected = sanitizeConnection(connection);
          const disabled = projected.managementStatus === 'disabled' || connection.mode === 'disabled';
          const account = disabled ? { connected: false, status: 'platform_disabled', updatedAt: null, lastUsedAt: null } : await gitLabOAuthStatus(session?.user?.id, connection);
          return { connectionId: connection.id, name: projected.name, host: new URL(connection.host).host, linkedHandbookCount: databasePlatformMode ? (connection.linkedHandbookCount ?? null) : (mappingCounts.get(connection.id)?.size || 0), status: account.status, connected: account.connected, updatedAt: account.updatedAt, lastUsedAt: account.lastUsedAt };
        }));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data: { items } })); return;
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
        const connectionId = String(params.get('connectionId') || '');
        if (!connectionId) throw new GitLabOAuthError('GITLAB_CONNECTION_REQUIRED', '请选择要解除的 GitLab 连接', 400);
        const connection = findConnection(connectionId, GITLAB_CONFIG_PATH);
        if (sanitizeConnection(connection).authMode !== 'user_oauth') throw new GitLabOAuthError('GITLAB_OAUTH_NOT_REQUIRED', '该连接不属于个人账号', 409);
        disconnectGitLabOAuth(session?.user?.id, connection.id);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data: { connectionId, connected: false, status: 'disconnected' } })); return;
      }
      const handbookAccess = pathname.match(/^\/knowledge-center\/api\/gitlab\/handbooks\/([^/]+)\/access-status$/);
      if (handbookAccess && req.method === 'GET') {
        const handbookId = decodeURIComponent(handbookAccess[1]);
        await requireHandbookReadAsync(session, handbookId);
        const { connection } = await findMappingAsync(handbookId);
        const projected = sanitizeConnection(connection);
        if (projected.managementStatus === 'disabled' || connection.mode === 'disabled') {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ success: true, data: { connectionId: connection.id, connectionName: projected.name, project: projected.project, authMode: projected.authMode, connected: false, canRead: false, nextAction: 'contact_admin', message: '仓库连接暂不可用' } })); return;
        }
        if (projected.authMode === 'service_account') {
          const configured = Boolean(connection.credentialRef);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ success: true, data: { connectionId: connection.id, connectionName: projected.name, project: projected.project, authMode: 'service_account', connected: configured, canRead: configured, nextAction: configured ? null : 'contact_admin', message: configured ? '可读取仓库内容' : '平台读取凭证尚未配置' } })); return;
        }
        const oauthStatus = await gitLabOAuthStatus(session?.user?.id, connection);
        const oauth = gitLabOAuthConfig();
        const configured = Boolean(oauth.clientId && oauth.clientSecret && oauth.redirectUri);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data: { connectionId: connection.id, connectionName: projected.name, project: projected.project, authMode: 'user_oauth', connected: oauthStatus.connected, canRead: oauthStatus.connected, nextAction: oauthStatus.connected ? null : (configured ? 'connect_gitlab' : 'contact_admin'), message: oauthStatus.connected ? 'GitLab 账号已连接' : (configured ? '需要连接 GitLab 账号' : 'GitLab OAuth 尚未配置') } })); return;
      }
      const handbookOAuthStart = pathname.match(/^\/knowledge-center\/api\/gitlab\/handbooks\/([^/]+)\/oauth\/start$/);
      if (handbookOAuthStart && req.method === 'GET') {
        const handbookId = decodeURIComponent(handbookOAuthStart[1]);
        await requireHandbookRead(session, handbookId);
        const { connection } = findMapping(handbookId, GITLAB_CONFIG_PATH);
        if (sanitizeConnection(connection).authMode !== 'user_oauth') throw new GitLabOAuthError('GITLAB_OAUTH_NOT_REQUIRED', '该手册使用平台只读账号，无需连接个人 GitLab', 409);
        const params = new URL(req.url, 'http://localhost').searchParams;
        const fallback = `/knowledge-center/assets/${encodeURIComponent(handbookId)}/repository`;
        const authorizationUrl = startGitLabOAuth({ userId: session?.user?.id, connectionId: connection.id, host: connection.host, returnTo: params.get('returnTo') || fallback });
        res.writeHead(302, { Location: authorizationUrl, 'Cache-Control': 'no-store' }); res.end(); return;
      }
      if (req.method === 'GET' && pathname === '/knowledge-center/api/gitlab/connections') {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        const cfg = readGitLabConfig(GITLAB_CONFIG_PATH);
        const params = new URL(req.url, 'http://localhost').searchParams;
        const q = String(params.get('q') || '').trim().toLowerCase();
        const status = String(params.get('status') || '').trim();
        const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(params.get('pageSize') || '20', 10) || 20));
        const mappingCounts = new Map();
        for (const mapping of cfg.mappings || []) {
          if (!mappingCounts.has(mapping.connectionId)) mappingCounts.set(mapping.connectionId, new Set());
          mappingCounts.get(mapping.connectionId).add(mapping.handbookId);
        }
        const projected = (cfg.connections || []).map(item => ({
          ...sanitizeConnection(item),
          linkedHandbookCount: databasePlatformMode ? (item.linkedHandbookCount ?? null) : (mappingCounts.get(item.id)?.size || 0),
        }));
        const filtered = projected.filter(item => (!q || `${item.name} ${item.host} ${item.project}`.toLowerCase().includes(q)) && (!status || item.managementStatus === status || item.verificationStatus === status || item.status === status));
        const items = filtered.slice((page - 1) * pageSize, page * pageSize);
        const generatedAt = projected.map(item => item.updatedAt).filter(Boolean).sort().at(-1) || null;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data: { items, page, pageSize, total: filtered.length, generatedAt } })); return;
      }
      if ((req.method === 'PUT' || req.method === 'POST') && pathname === '/knowledge-center/api/gitlab/connections') {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
        if (!idempotencyKey) throw new GitLabConnectorError('IDEMPOTENCY_KEY_REQUIRED', '配置更新必须携带 Idempotency-Key', 400);
        const body = await readJsonBody(req);
        const rowVersion = req.headers['if-match'] == null ? null : Number(String(req.headers['if-match']).replace(/\"/g, ''));
        const connection = upsertConnection({ ...body, ...(rowVersion != null ? { rowVersion } : {}) }, GITLAB_CONFIG_PATH, { idempotencyKey, operatorId: session?.user?.id });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data: connection })); return;
      }
      const connectionUpdate = pathname.match(/^\/knowledge-center\/api\/gitlab\/connections\/([^/]+)$/);
      if (connectionUpdate && req.method === 'PATCH') {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
        if (!idempotencyKey) throw new GitLabConnectorError('IDEMPOTENCY_KEY_REQUIRED', '配置更新必须携带 Idempotency-Key', 400);
        const id = decodeURIComponent(connectionUpdate[1]);
        const existing = findConnection(id, GITLAB_CONFIG_PATH);
        const rowVersion = req.headers['if-match'] == null ? null : Number(String(req.headers['if-match']).replace(/\"/g, ''));
        const connection = upsertConnection({ ...existing, ...await readJsonBody(req), id, ...(rowVersion != null ? { rowVersion } : {}) }, GITLAB_CONFIG_PATH, { idempotencyKey, operatorId: session?.user?.id });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data: connection })); return;
      }
      const connectionCommand = pathname.match(/^\/knowledge-center\/api\/gitlab\/connections\/([^/]+)\/(verify|disable|enable)$/);
      if (connectionCommand) {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
        const connectionId = decodeURIComponent(connectionCommand[1]);
        const action = connectionCommand[2];
        if (action === 'disable' || action === 'enable') {
          const idempotencyKey = String(req.headers['idempotency-key'] || '').trim() || null;
          const connection = setConnectionStatus(connectionId, action === 'enable' ? 'active' : 'inactive', GITLAB_CONFIG_PATH, { idempotencyKey, operatorId: session?.user?.id, rowVersion: req.headers['if-match'] });
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ success: true, data: connection })); return;
        }
        const connection = findConnection(connectionId, GITLAB_CONFIG_PATH);
        let data;
        try {
          if ((connection.status || 'active') === 'inactive') throw new GitLabConnectorError('GITLAB_CONNECTION_INACTIVE', '已停用连接不能验证，请先重新启用', 409);
          const branches = await gitLabRequestForUser(session, connection, options => listBranches(connection, options));
          data = { connectionId: connection.id, status: 'verified', branchCount: branches.length, verifiedAt: new Date().toISOString() };
        } catch (error) {
          const recovery = verificationRepairs[error.code] || verificationRepairs.default;
          error.details = { ...error.details, recovery };
          const failed = { connectionId: connection.id, status: 'failed', verifiedAt: new Date().toISOString(), error: { code: error.code || 'GITLAB_VERIFY_FAILED', message: error.message, recovery } };
          recordVerification(connection.id, failed, GITLAB_CONFIG_PATH, { operatorId: session?.user?.id }, connection);
          throw error;
        }
        try {
          recordVerification(connection.id, data, GITLAB_CONFIG_PATH, { operatorId: session?.user?.id }, connection);
        } catch (error) {
          error.details = { ...error.details, recovery: verificationRepairs[error.code] || verificationRepairs.default };
          throw error;
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data })); return;
      }
      const mappingUpdate = pathname.match(/^\/knowledge-center\/api\/gitlab\/mappings\/([^/]+)$/);
      if (mappingUpdate && req.method === 'GET') {
        const handbookId = decodeURIComponent(mappingUpdate[1]);
        const productionView = new URL(req.url, 'http://localhost').searchParams.get('view') === 'production';
        if (productionView) await requireHandbookReadAsync(session, handbookId);
        else if (forbidUnlessPlatformAdmin(res, session)) return;
        const { mapping } = await findMappingAsync(handbookId);
        const data = productionView ? Object.fromEntries(
          ['handbookId', 'connectionId', 'defaultBranch', 'enabledBranches', 'zhPaths', 'enPaths']
            .filter(key => Object.hasOwn(mapping, key)).map(key => [key, mapping[key]])) : mapping;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data })); return;
      }
      if (mappingUpdate && req.method === 'PUT') {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
        if (!idempotencyKey) throw new GitLabConnectorError('IDEMPOTENCY_KEY_REQUIRED', '配置更新必须携带 Idempotency-Key', 400);
        const handbookId = decodeURIComponent(mappingUpdate[1]);
        if (!(await readKnowledgeAssets()).handbooks.some(item => item.handbookId === handbookId)) throw new GitLabConnectorError('ASSET_NOT_FOUND', '手册资产不存在', 404);
        const rowVersion = req.headers['if-match'] == null ? null : Number(String(req.headers['if-match']).replace(/\"/g, ''));
        const mapping = upsertMapping(handbookId, { ...await readJsonBody(req), ...(rowVersion != null ? { rowVersion } : {}) }, GITLAB_CONFIG_PATH, { idempotencyKey, operatorId: session?.user?.id });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data: mapping })); return;
      }
      const direct = pathname.match(/^\/knowledge-center\/api\/gitlab\/connections\/([^/]+)\/(branches|tree|file)$/);
      if (direct) {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
        const connection = findConnection(decodeURIComponent(direct[1]), GITLAB_CONFIG_PATH);
        const params = new URL(req.url, 'http://localhost').searchParams;
        let data;
        if (direct[2] === 'branches') data = await gitLabRequestForUser(session, connection, options => listBranches(connection, options));
        else if (direct[2] === 'tree') data = await gitLabRequestForUser(session, connection, options => listTree(connection, params.get('ref') || connection.defaultBranch, params.get('path') || '', options));
        else data = await gitLabRequestForUser(session, connection, options => readGitLabFile(connection, params.get('ref') || connection.defaultBranch, params.get('path') || '', options));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: true, data })); return;
      }
      const mapped = pathname.match(/^\/knowledge-center\/api\/gitlab\/handbooks\/([^/]+)\/(branches|tree|file|statistics|commits)$/);
      if (mapped) {
        const handbookId = decodeURIComponent(mapped[1]);
        const readableAsset = await requireHandbookReadAsync(session, handbookId);
        if (mapped[2] === 'statistics') {
          if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
          const params = new URL(req.url, 'http://localhost').searchParams;
          const data = await handbookRepositoryStatistics(res, session, handbookId, params);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ success: true, data })); return;
        }
        const { mapping, connection } = await findMappingAsync(handbookId);
        const params = new URL(req.url, 'http://localhost').searchParams;
        const ref = params.get('ref') || mapping.defaultBranch;
        const language = params.get('language') === 'en' ? 'en' : 'zh';
        let data;
        if (mapped[2] === 'branches') {
          const asset = readableAsset;
          data = {
            items: (await gitLabRequestForUser(session, connection, options => listBranches(connection, options))).filter(item => mapping.enabledBranches.includes(item.name)),
            defaultBranch: mapping.defaultBranch, handbookName: asset?.name || mapping.handbookId,
            connectionName: connection.name, project: connection.project,
            languages: { zh: mapping.zhPaths.length > 0, en: mapping.enPaths.length > 0 },
          };
        } else if (mapped[2] === 'commits') {
          data = await gitLabRequestForUser(session, connection, options => listCommits(connection, ref, options));
        } else if (mapped[2] === 'tree') {
          const requested = params.get('path') || '';
          const roots = language === 'en' ? mapping.enPaths : mapping.zhPaths;
          if (requested) authorizeMappedRequest(mapping, ref, language, requested);
          else authorizeMappedRequest(mapping, ref, language, roots[0]);
          const lists = await gitLabRequestForUser(session, connection, options => Promise.all((requested ? [requested] : roots).map(root => listTree(connection, ref, root, options))));
          data = lists.flat().filter(item => roots.some(root => item.path === root || item.path.startsWith(`${root}/`)));
        } else {
          const requested = authorizeMappedRequest(mapping, ref, language, params.get('path') || '');
          data = await gitLabRequestForUser(session, connection, options => readGitLabFile(connection, ref, requested, options));
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

  async function serveReviewBootstrap(req, res, session) {
    const startedAt = process.hrtime.bigint();
    try {
      const service = handleIncrementalBuild?.service;
      if (!service) throw Object.assign(new Error('审核服务暂不可用'), { code: 'REVIEW_SERVICE_UNAVAILABLE', status: 503 });
      const params = new URL(req.url, 'http://localhost').searchParams;
      const handbookId = String(params.get('handbookId') || '');
      const requestedTaskId = String(params.get('taskId') || '');
      const step = params.get('step') || 'read';
      const view = params.get('view') || (requestedTaskId ? 'reader' : handbookId ? 'reader' : 'handbooks');
      if (!['handbooks', 'mine', 'documents', 'reader'].includes(view)) throw Object.assign(new Error('未知审核视图'), { status: 400 });
      const timings = {};
      const measure = async (name, operation) => {
        const start = process.hrtime.bigint();
        const result = await operation();
        timings[name] = Number(process.hrtime.bigint() - start) / 1e6;
        return result;
      };
      const [snapshot, assets] = await Promise.all([
        measure('review-state', () => service.readState(session)),
        measure('review-assets', () => readReviewAssetsAsync()),
      ]);
      const review = await measure('review-projection', () => service.reviewBootstrap(session, { handbookId: view === 'mine' ? '' : handbookId, taskId: requestedTaskId, view, documentId: params.get('documentId'), path: params.get('path') }, snapshot));
      // Empty/unassigned document lists have no reviewer identities to resolve.
      const needsReviewerNames = review.documents.some(item => item.reviewerIds?.length || item.decidedBy?.id);
      const users = needsReviewerNames ? await measure('review-users', () => authModule?.repository?.listUsers?.() || []) : [];
      const selectedId = requestedTaskId;
      const visible = session?.visibleHandbookIds || session?.user?.visibleHandbookIds;
      const permittedAssets = await measure('review-assets-filter', () => ({ ...assets, handbooks: assets.handbooks.filter(item => !Array.isArray(visible) || visible.map(String).includes(String(item.handbookId))) }));
      // A pending review is an authoritative workflow fact. The asset stage
      // projection can lag behind it, so do not hide an actionable review.
      const pendingReviewHandbookIds = new Set(review.documents.filter(item => item.state === 'under_review').map(item => String(item.handbookId)));
      // Filter before the database-mode asset projection. The projection reads
      // the GitLab mapping for every candidate item; review only needs assets
      // in the review lifecycle or with an actionable pending task.
      const reviewCandidates = {
        ...permittedAssets,
        handbooks: permittedAssets.handbooks.filter(item => REVIEW_ASSET_STATUSES.has(assetStatus(item)) || pendingReviewHandbookIds.has(String(item.handbookId))),
      };
      const reviewHandbooks = [];
      let page = 1;
      let projection;
      await measure('review-handbook-projection', async () => {
        do {
          projection = await queryKnowledgeAssets(reviewCandidates, new URLSearchParams({ pageSize: '100', page: String(page++) }), isPlatformAdmin(session));
          reviewHandbooks.push(...projection.items.filter(item => REVIEW_ASSET_STATUSES.has(item.status) || pendingReviewHandbookIds.has(String(item.handbookId))));
        } while (page <= Math.ceil(projection.total / projection.pageSize));
      });
      const eligibleIds = new Set(reviewHandbooks.map(item => String(item.handbookId)));
      const reviewerNames = new Map();
      for (const user of users) {
        const name = String(user.displayName || user.name || user.loginName || '').trim();
        if (!name) continue;
        for (const id of [user.principalId, user.id, user.userId]) {
          if (id !== undefined && id !== null) reviewerNames.set(String(id), name);
        }
      }
      const documents = await measure('review-document-projection', () => review.documents.filter(item => eligibleIds.has(String(item.handbookId))).map(item => ({
        ...item,
        reviewerDisplay: (item.decidedBy?.id && reviewerNames.get(String(item.decidedBy.id))) || (item.decidedBy?.displayName !== '未知用户' && item.decidedBy?.displayName) || item.decidedBy?.name
          || (item.decidedBy ? '人员未匹配' : item.reviewerIds.length ? item.reviewerIds.map(id => reviewerNames.get(String(id)) || '人员未匹配').join('、') : '未明确指派'),
      })));
      const handbooks = await measure('review-handbook-summary', () => reviewHandbooks.map(item => {
        const rows = documents.filter(document => document.handbookId === item.handbookId);
        return { ...item, reviewCount: rows.length, pendingCount: rows.filter(document => document.state === 'under_review').length,
          pendingPublishCount: rows.filter(document => document.state === 'approved').length,
          updatedAt: rows.map(document => document.updatedAt || document.submittedAt).filter(Boolean).sort().at(-1) || null };
      }));
      const resolvedHandbookId = review.readerHandbookId || '';
      const diff = selectedId && step === 'diff' ? service.getCandidateDiff(session, selectedId, snapshot) : null;
      const overview = view === 'reader' && !requestedTaskId && eligibleIds.has(handbookId)
        ? service.reviewOverview(session, documents.filter(item => item.handbookId === handbookId), snapshot)
        : null;
      const totalMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
        'Server-Timing': [`review-bootstrap;dur=${totalMs.toFixed(3)}`, ...Object.entries(timings).map(([name, ms]) => `${name};dur=${ms.toFixed(3)}`)].join(', '),
      });
      res.end(JSON.stringify({ success: true, data: { view, workbench: { handbooks, documents, mine: documents.filter(item => item.assignedToMe), ...(overview ? { overview } : {}) }, items: review.items, allItems: review.allItems, detail: review.detail ? { task: review.detail } : null, handbookId: resolvedHandbookId, reviewHandbooks, onlineReviewBaselines: review.baselines, onlineReviewBaselineError: null, diff } }));
    } catch (error) {
      res.writeHead(error.status || 500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ success: false, error: { code: error.code || 'REVIEW_BOOTSTRAP_FAILED', message: error.message || '审核工作区读取失败' } }));
    }
  }

  async function serveReviewReassignment(req, res, session, taskId, reviewId) {
    try {
      const service = handleIncrementalBuild?.service;
      if (!service) throw Object.assign(new Error('审核服务暂不可用'), { status: 503 });
      const key = req.headers['idempotency-key'];
      const body = await readJsonBody(req);
      const task = service.get(session, taskId);
      const eligible = new Set((await eligibleReviewers(task.handbookId, session)).map(item => String(item.id)));
      const data = service.updateReviewers(session, taskId, reviewId, key, body, eligible);
      sendProductionData(res, data);
    } catch (error) {
      res.writeHead(error.status || 500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ success: false, error: { code: error.code || 'REVIEW_REASSIGN_FAILED', message: error.status ? error.message : '修改审核人失败' } }));
    }
  }

  async function serveMyGenerations(req, res, session) {
    try {
      const service = handleIncrementalBuild?.service;
      if (!service) throw Object.assign(new Error('生成记录服务暂不可用'), { code: 'GENERATION_SERVICE_UNAVAILABLE', status: 503 });
      const params = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
      const data = service.listMyGenerations(session, params, await service.readState(session));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ success: true, data }));
    } catch (error) {
      res.writeHead(Number(error.status || 500), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ success: false, error: { code: error.code || 'GENERATION_QUERY_FAILED', message: error.message || '生成记录读取失败' } }));
    }
  }

  async function serveReviewRepositoryContext(req, res, session) {
    const startedAt = process.hrtime.bigint();
    try {
      const params = new URL(req.url, 'http://localhost').searchParams;
      const handbookId = String(params.get('handbookId') || '');
      if (!handbookId) throw new GitLabConnectorError('HANDBOOK_REQUIRED', '必须指定手册', 400);
      // Resolve access before reading the mapping so a missing handbook cannot
      // leave a rejected promise unobserved when mapping lookup also fails.
      const asset = await requireHandbookReadAsync(session, handbookId);
      const { mapping, connection } = await findMappingAsync(handbookId);
      const metadataStartedAt = process.hrtime.bigint();
      const projected = sanitizeConnection(connection);
      const language = params.get('language') === 'en' ? 'en' : 'zh';
      const roots = language === 'en' ? mapping.enPaths : mapping.zhPaths;
      if (!roots.length) throw new GitLabConnectorError('GITLAB_LANGUAGE_NOT_MAPPED', '该语言尚未配置仓库内容路径', 404);
      const metadataMs = Number(process.hrtime.bigint() - metadataStartedAt) / 1e6;
      const branchesStartedAt = process.hrtime.bigint();
      const allBranches = await gitLabRequestForUser(session, connection, options => listBranches(connection, options));
      const branchesMs = Number(process.hrtime.bigint() - branchesStartedAt) / 1e6;
      const branches = allBranches.filter(item => mapping.enabledBranches.includes(item.name));
      const branch = params.get('branch') || mapping.defaultBranch || branches[0]?.name || '';
      if (!mapping.enabledBranches.includes(branch)) throw new GitLabConnectorError('GITLAB_BRANCH_NOT_ALLOWED', '该业务版本未在手册映射中启用', 403);
      const treeStartedAt = process.hrtime.bigint();
      const lists = await gitLabRequestForUser(session, connection, options => Promise.all(roots.map(root => listTree(connection, branch, root, options))));
      const tree = lists.flat().filter(item => roots.some(root => item.path === root || item.path.startsWith(`${root}/`)));
      const treeMs = Number(process.hrtime.bigint() - treeStartedAt) / 1e6;
      const preferred = params.get('path') || params.get('preferredPath') || tree.find(item => item.type !== 'tree' && /\.md$/i.test(item.path || item.name))?.path || '';
      let file = null;
      let fileError = null;
      let fileMs = 0;
      if (preferred) {
        const requested = authorizeMappedRequest(mapping, branch, language, preferred);
        const fileStartedAt = process.hrtime.bigint();
        file = await gitLabRequestForUser(session, connection, options => readGitLabFile(connection, branch, requested, options)).catch(error => {
          if (error.status !== 404) throw error;
          fileError = { code: error.code || 'GITLAB_FILE_NOT_FOUND', message: '当前文档尚不存在于仓库；已保留手册目录，审核文档仍可读取冻结快照。' };
          return null;
        });
        fileMs = Number(process.hrtime.bigint() - fileStartedAt) / 1e6;
      }
      const totalMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const data = {
        status: 'ok', handbookId, handbookName: asset?.name || handbookId,
        connectionName: projected.name, project: projected.project,
        languages: { zh: mapping.zhPaths.length > 0, en: mapping.enPaths.length > 0 },
        branches, branch, language, tree, file, error: fileError, requestedPath: preferred,
        commitSha: file?.commitId || branches.find(item => item.name === branch)?.commitSha || null,
        updatedAt: file?.updatedAt || null,
      };
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
        'Server-Timing': `metadata;dur=${metadataMs.toFixed(3)}, branches;dur=${branchesMs.toFixed(3)}, tree;dur=${treeMs.toFixed(3)}, file;dur=${fileMs.toFixed(3)}, repository-context;dur=${totalMs.toFixed(3)}`,
      });
      res.end(JSON.stringify({ success: true, data }));
    } catch (error) { sendGitLabError(res, error); }
  }

  // --- Main request handler ---

  return function handleKnowledgeCenterRequest(req, res) {
    const pathname = new URL(req.url, 'http://localhost').pathname;

    if (pathname === '/knowledge-center/auth' || pathname.startsWith('/knowledge-center/auth/') || pathname === '/knowledge-center/api/auth' || pathname.startsWith('/knowledge-center/api/auth/')) {
      dispatchAuth(req, res); return;
    }
    if (req.method === 'GET' && pathname === '/knowledge-center/api/platform/context') {
      requireSession(req, res, () => servePlatformContext(res)); return;
    }
    if (pathname === '/knowledge-center/api/platform/models' || pathname === '/knowledge-center/api/platform/models/test') {
      requireSession(req, res, async session => {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        const reply = (status, payload) => {
          res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify(payload));
        };
        try {
          const testing = pathname.endsWith('/test');
          if ((!testing && !['GET', 'PUT'].includes(req.method)) || (testing && req.method !== 'POST')) {
            res.writeHead(405, { Allow: testing ? 'POST' : 'GET, PUT' }); res.end(); return;
          }
          if (req.method === 'GET') { reply(200, { success: true, data: await modelGovernance.get() }); return; }
          const input = await readJsonBody(req);
          const expected = req.headers['if-match'] || input.rowVersion;
          const data = testing ? await modelGovernance.test(input, expected) : await modelGovernance.save(input, expected, session.user?.id);
          reply(200, { success: true, data });
        } catch (error) {
          const known = error.code?.startsWith('MODEL_');
          reply(known ? error.status : 503, { success: false, error: { code: known ? error.code : 'MODEL_CONFIG_UNAVAILABLE', message: known ? error.message : '模型配置服务暂不可用，请稍后重试' } });
        }
      }); return;
    }
    if (pathname === '/knowledge-center/api/production/models') {
      requireSession(req, res, session => {
        if (!hasAction(session, 'knowledge:read') && !isPlatformAdmin(session)) {
          res.writeHead(403, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ success: false, error: { message: '无文档读取权限' } })); return;
        }
        if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }); res.end(); return; }
        sendProductionData(res, modelGovernance.available());
      }); return;
    }
    if (pathname === '/knowledge-center/api/platform/mcp' || pathname === '/knowledge-center/api/platform/mcp/test' || /^\/knowledge-center\/api\/platform\/mcp\/services\/(save|delete|test|verify)$/.test(pathname)) {
      requireSession(req, res, async session => {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        const reply = (status, payload) => {
          res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify(payload));
        };
        try {
          const serviceAction = pathname.match(/\/services\/(save|delete|test|verify)$/)?.[1];
          const testing = pathname.endsWith('/test') || Boolean(serviceAction);
          if ((!testing && !['GET', 'PUT'].includes(req.method)) || (testing && req.method !== 'POST')) {
            res.writeHead(405, { Allow: testing ? 'POST' : 'GET, PUT' }); res.end(); return;
          }
          if (req.method === 'GET') { reply(200, { success: true, data: await mcpGovernance.get() }); return; }
          const input = await readJsonBody(req);
          const expected = req.headers['if-match'] || input.rowVersion;
          const actions = { save: 'saveService', delete: 'deleteService', test: 'testService', verify: 'verifyKnowledgeBase' };
          const data = serviceAction ? await mcpGovernance[actions[serviceAction]](input, expected, session.user?.id) : testing ? await mcpGovernance.test(input, expected) : await mcpGovernance.save(input, expected, session.user?.id);
          reply(200, { success: true, data });
        } catch (error) {
          const known = error.code?.startsWith('MCP_');
          reply(known ? error.status : 503, { success: false, error: { code: known ? error.code : 'MCP_CONFIG_UNAVAILABLE', message: known ? error.message : 'MCP 配置服务暂不可用，请稍后重试' } });
        }
      }); return;
    }
    if (pathname === '/knowledge-center/api/platform/database-connection' || pathname === '/knowledge-center/api/platform/database-connection/test' || pathname === '/knowledge-center/api/platform/database-connection/status') {
      requireSession(req, res, async session => {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        try {
          if (pathname.endsWith('/status')) {
            if (req.method === 'POST') {
              const data = await databaseConnection.refreshHealth({ force: true });
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
              res.end(JSON.stringify({ success: true, data }));
              return;
            }
            if (req.method === 'GET') {
              const data = databaseConnection.currentHealth();
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
              res.end(JSON.stringify({ success: true, data }));
              return;
            }
            res.writeHead(405, { Allow: 'GET, POST' });
            res.end();
            return;
          }
          if (pathname.endsWith('/test')) {
            if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); res.end(); return; }
            const result = await databaseConnection.test(await readJsonBody(req));
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ success: true, data: result })); return;
          }
          if (req.method === 'GET') {
            const data = databaseConnection.projection();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({ success: true, data }));
            return;
          }
          if (req.method === 'PUT') { const body = await readJsonBody(req); const result = await databaseConnection.save(body, req.headers['if-match'] || body.rowVersion, { actorId: session?.user?.id }); res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ success: true, data: result })); return; }
          res.writeHead(405, { Allow: 'GET, PUT' }); res.end();
        } catch (error) { res.writeHead(error.status || 503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ success: false, error: { code: error.code || 'DATABASE_CONNECTION_ERROR', message: error.message || '数据库连接操作失败', retryable: error.status === 503, serverTime: new Date().toISOString() } })); }
      }); return;
    }
    if (pathname === '/knowledge-center/api/platform/brand/icon') {
      if (req.method === 'GET') { sendBrandIcon(res); return; }
      res.writeHead(405, { Allow: 'GET' }); res.end(); return;
    }
    if (pathname === '/knowledge-center/api/platform/permissions' || pathname.startsWith('/knowledge-center/api/platform/permissions/')) {
      dispatchAuth(req, res, `/knowledge-center/api/auth/users${req.url.slice('/knowledge-center/api/platform/permissions'.length)}`); return;
    }
    if (pathname === '/knowledge-center/api/platform/team-groups' || pathname.startsWith('/knowledge-center/api/platform/team-groups/')) {
      requireSession(req, res, async session => {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        try {
          if (req.method === 'GET' && pathname === '/knowledge-center/api/platform/team-groups') {
            const params = new URL(req.url, 'http://localhost').searchParams;
            const data = await domainStore.readTeamGroups({ groupType: params.get('groupType') || 'TECH_DOMAIN' });
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({ success: true, data })); return;
          }
          if (req.method === 'POST' && pathname === '/knowledge-center/api/platform/team-groups') {
            const key = req.headers['idempotency-key'];
            if (!key) throw Object.assign(new Error('新建团队小组必须携带 Idempotency-Key'), { code: 'IDEMPOTENCY_KEY_REQUIRED', status: 400 });
            const data = await domainStore.createTeamGroup({ ...(await readJsonBody(req)), actor: session.user?.id || 'platform:admin' }, key);
            res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({ success: true, data })); return;
          }
          const rosterPreview = pathname.match(/^\/knowledge-center\/api\/platform\/team-groups\/([^/]+)\/roster\/preview$/);
          const roster = pathname.match(/^\/knowledge-center\/api\/platform\/team-groups\/([^/]+)\/roster$/);
          const detail = pathname.match(/^\/knowledge-center\/api\/platform\/team-groups\/([^/]+)$/);
          if (rosterPreview && req.method === 'POST') {
            await readJsonBody(req);
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-store',
              Deprecation: 'true',
            });
            res.end(JSON.stringify({
              success: true,
              data: {
                previewToken: 'roster-preview-compatibility',
                previewedImpactDigest: 'roster-preview-compatibility',
                unfinishedTaskCount: 0,
                removedMemberTaskCount: 0,
                deprecated: true,
              },
            }));
            return;
          }
          if (detail && req.method === 'GET') {
            const data = await domainStore.readTeamGroup(decodeURIComponent(detail[1]));
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ success: true, data })); return;
          }
          if (roster && req.method === 'PUT') {
            const body = await readJsonBody(req);
            const key = req.headers['idempotency-key'];
            if (!key) throw Object.assign(new Error('团队名册保存必须携带 Idempotency-Key'), { code: 'IDEMPOTENCY_KEY_REQUIRED', status: 400 });
            const rowVersion = req.headers['if-match'] || body.rowVersion;
            const data = await domainStore.replaceTeamRoster(decodeURIComponent(roster[1]), { ...body, actor: session.user?.id || 'platform:admin' }, rowVersion, key);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ success: true, data })); return;
          }
          res.writeHead(405, { Allow: 'GET, POST, PUT' }); res.end();
        } catch (error) {
          res.writeHead(error.status || 503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ success: false, error: { code: error.code || 'TEAM_GROUP_SERVICE_UNAVAILABLE', message: error.message || '团队名册服务暂不可用' } }));
        }
      }); return;
    }
    if (pathname === '/knowledge-center/api/platform/principals/template') {
      requireSession(req, res, session => {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }); res.end(); return; }
        try {
          const buffer = templateWorkbook();
          res.writeHead(200, {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="knowledge-center-personnel-template.xlsx"',
            'Content-Length': buffer.length,
            'Cache-Control': 'no-store',
          });
          res.end(buffer);
        } catch (_) {
          res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: { code: 'PERSONNEL_TEMPLATE_UNAVAILABLE', message: '人员导入模板暂不可用' } }));
        }
      }); return;
    }
    if (pathname === '/knowledge-center/api/platform/principals/import') {
      requireSession(req, res, async session => {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); res.end(); return; }
        try {
          const upload = await readPersonnelUpload(req);
          const mode = new URL(req.url, 'http://localhost').searchParams.get('mode') || 'preview';
          const directory = await domainStore.readPrincipalsAsync();
          const preview = previewPersonnelImport(upload.items, directory.items || []);
          if (mode === 'preview') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({ success: true, data: { filename: upload.filename, sourceSha256: upload.sourceSha256, ...preview } }));
            return;
          }
          if (mode !== 'apply') throw Object.assign(new Error('人员导入模式无效'), { code: 'PERSONNEL_IMPORT_MODE_INVALID', status: 422 });
          if (preview.summary.conflict > 0) throw Object.assign(new Error(`存在 ${preview.summary.conflict} 条冲突，请修正 Excel 后重新预检`), { code: 'PERSONNEL_IMPORT_CONFLICT', status: 409 });
          const data = await domainStore.importPrincipals({ ...upload, actor: session.user?.id || 'system:import' });
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ success: true, data: { directory: data, importSummary: preview.summary } }));
        } catch (error) {
          res.writeHead(error.status || 422, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ success: false, error: { code: error.code || 'PERSONNEL_IMPORT_FAILED', message: error.message || '人员导入失败' } }));
        }
      }); return;
    }
    if (pathname.startsWith('/knowledge-center/api/platform/principals/') && pathname.length > '/knowledge-center/api/platform/principals/'.length) {
      requireSession(req, res, async session => {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        if (req.method !== 'PATCH') { res.writeHead(405, { Allow: 'PATCH' }); res.end(); return; }
        try {
          const principalId = pathname.slice('/knowledge-center/api/platform/principals/'.length);
          const body = await readJsonBody(req);
          const data = await domainStore.updatePrincipal(principalId, { ...body, actor: session.user?.id || 'system:api' });
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ success: true, data }));
        } catch (error) {
          res.writeHead(error.status || 503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ success: false, error: { code: error.code || 'PERSONNEL_UPDATE_FAILED', message: error.message || '人员更新失败' } }));
        }
      }); return;
    }
    if (pathname === '/knowledge-center/api/platform/principals') {
      requireSession(req, res, async session => {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        try {
          if (req.method === 'GET') {
            const params = new URL(req.url, 'http://localhost').searchParams;
            const data = await domainStore.readPrincipalsAsync({ q: params.get('q') || '', state: params.get('state') || '', bindingStatus: params.get('bindingStatus') || '' });
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({ success: true, data })); return;
          }
          if (req.method === 'POST') {
            const body = await readJsonBody(req);
            const data = await domainStore.createPrincipal({ ...body, actor: session.user?.id || 'system:api' });
            res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({ success: true, data })); return;
          }
          res.writeHead(405, { Allow: 'GET, POST' }); res.end();
        } catch (error) {
          res.writeHead(error.status || 503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ success: false, error: { code: error.code || 'PERSONNEL_SERVICE_UNAVAILABLE', message: error.message || '人员服务暂不可用' } }));
        }
      }); return;
    }
    if (req.method === 'GET' && pathname === '/knowledge-center/api/platform/overview') {
      requireSession(req, res, () => servePlatformProjection(res)); return;
    }
    if (req.method === 'GET' && pathname === '/knowledge-center/api/review/bootstrap') {
      requireSession(req, res, session => serveReviewBootstrap(req, res, session)); return;
    }
    const reassignMatch = pathname.match(/^\/knowledge-center\/api\/review\/tasks\/([^/]+)\/reviews\/([^/]+)\/reviewers$/);
    if (req.method === 'PUT' && reassignMatch) {
      requireSession(req, res, session => serveReviewReassignment(req, res, session, decodeURIComponent(reassignMatch[1]), decodeURIComponent(reassignMatch[2]))); return;
    }
    if (req.method === 'GET' && pathname === '/knowledge-center/api/review/repository-context') {
      requireSession(req, res, session => serveReviewRepositoryContext(req, res, session)); return;
    }
    if (pathname.startsWith('/knowledge-center/api/cleaning/')) {
      const endpoint = matchCleaningEndpoint(req.method, pathname);
      if (!endpoint) {
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: { code: 'CLEANING_ROUTE_NOT_ALLOWED', message: '资料清洗工作区暂不支持该请求', retryable: false } }));
        return;
      }
      if (typeof proxyCleaning !== 'function') {
        res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: false, error: { code: 'MATERIAL_PROCESSING_UNAVAILABLE', message: '资料加工服务暂时不可用', retryable: true } }));
        return;
      }
      requireSession(req, res, session => {
        if (forbidUnlessCleaningAction(res, session, endpoint.action)) return;
        proxyCleaning(req, res, { session, endpoint });
      }); return;
    }
    if (req.method === 'GET' && pathname === '/knowledge-center/api/assets/catalog') {
      requireSession(req, res, () => serveKnowledgeAssetsCatalog(res)); return;
    }
    if (pathname === '/knowledge-center/api/assets/handbooks') {
      requireSession(req, res, async session => {
        if (req.method === 'GET') {
          try {
            const data = await queryKnowledgeAssets(await readKnowledgeAssetsAsync(), new URL(req.url, 'http://localhost').searchParams, isPlatformAdmin(session));
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({ success: true, data }));
          } catch (_error) {
            res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, error: { code: 'ASSET_CONFIG_UNAVAILABLE', message: '手册资产配置暂不可用' } }));
          }
          return;
        }
        if (req.method === 'POST' && !forbidUnlessPlatformAdmin(res, session)) await createKnowledgeAsset(req, res, session);
        else if (req.method !== 'POST') { res.writeHead(405); res.end(); }
      });
      return;
    }
    const assetStatusCommand = pathname.match(/^\/knowledge-center\/api\/assets\/handbooks\/([^/]+)\/status(?:\/(resolve))?$/);
    if (assetStatusCommand) {
      const handbookId = decodeURIComponent(assetStatusCommand[1]);
      requireSession(req, res, async session => {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
        if (assetStatusCommand[2] === 'resolve') await resolveAssetStatus(req, res, handbookId, session);
        else await changeAssetStatus(req, res, handbookId, session);
      });
      return;
    }
    const assetCommand = pathname.match(/^\/knowledge-center\/api\/assets\/handbooks\/([^/]+)(?:\/(archive|restore))?$/);
    if (assetCommand) {
      const handbookId = decodeURIComponent(assetCommand[1]);
      requireSession(req, res, async session => {
        if (forbidUnlessPlatformAdmin(res, session)) return;
        if (req.method === 'PATCH' && !assetCommand[2]) await updateKnowledgeAsset(req, res, handbookId, session);
        else if (req.method === 'POST' && assetCommand[2]) await changeArchiveState(res, handbookId, assetCommand[2] === 'archive', session);
        else { res.writeHead(405); res.end(); }
      });
      return;
    }
    if (req.method === 'PATCH' && pathname.startsWith('/knowledge-center/api/assets/catalog/')) {
      const handbookId = decodeURIComponent(pathname.slice('/knowledge-center/api/assets/catalog/'.length));
      requireSession(req, res, async session => {
        if (!forbidUnlessPlatformAdmin(res, session)) await updateKnowledgeAsset(req, res, handbookId, session);
      });
      return;
    }
    if (req.method === 'GET' && pathname === '/knowledge-center/api/outline/template') {
      requireSession(req, res, session => { if (!forbidUnlessOutlineAction(res, session, 'outline:read')) serveOutlineTemplateWorkbook(res); }); return;
    }
    if (req.method === 'GET' && pathname === '/knowledge-center/api/outline/sample') {
      requireSession(req, res, session => { if (!forbidUnlessOutlineAction(res, session, 'outline:read')) serveOutlineWorkbook(res, OUTLINE_SAMPLE_PATH, outlineTemplateRules.sampleDownloadName, 'OUTLINE_SAMPLE_UNAVAILABLE'); }); return;
    }
    if ((req.method === 'POST' && /^\/knowledge-center\/api\/outline\/governance\/[^/]+\/purge$/.test(pathname)) || (req.method === 'GET' && pathname.endsWith('/purge-preflight') && pathname.startsWith('/knowledge-center/api/outline/governance/'))) {
      requireSession(req, res, session => { if (!forbidUnlessOutlineAction(res, session, 'outline:purge')) proxyOutline(req, res, session); }); return;
    }
    if (req.method === 'POST' && /^\/knowledge-center\/api\/outline\/governance\/[^/]+\/restore$/.test(pathname)) {
      requireSession(req, res, session => { if (!forbidUnlessOutlineAction(res, session, 'outline:delete')) proxyOutline(req, res, session); }); return;
    }
    if (req.method === 'GET' && (pathname === '/knowledge-center/api/outline/catalog' || pathname === '/knowledge-center/api/outline/governance' || pathname.startsWith('/knowledge-center/api/outline/governance/') || pathname === '/knowledge-center/api/outline/tech-domains' || pathname === '/knowledge-center/api/outline/build-tasks' || pathname.startsWith('/knowledge-center/api/outline/build-tasks/'))) {
      requireSession(req, res, session => { if (!forbidUnlessOutlineAction(res, session, 'outline:read')) proxyOutline(req, res, session); }); return;
    }
    if ((req.method === 'PUT' && /^\/knowledge-center\/api\/outline\/governance\/[^/]+\/governance$/.test(pathname)) ||
        (req.method === 'POST' && /^\/knowledge-center\/api\/outline\/governance\/[^/]+\/publish$/.test(pathname)) ||
        (req.method === 'PATCH' && /^\/knowledge-center\/api\/outline\/build-tasks\/[^/]+\/items\/[^/]+$/.test(pathname))) {
      requireSession(req, res, session => { if (!forbidUnlessOutlineAction(res, session, 'outline:create')) proxyOutline(req, res, session); }); return;
    }
    if (pathname === '/knowledge-center/api/templates' || pathname.startsWith('/knowledge-center/api/templates/')) {
      requireSession(req, res, session => handleTemplates(req, res, session)); return;
    }
    if (req.method === 'POST' && (pathname === '/knowledge-center/api/outline/import' || pathname === '/knowledge-center/api/outline/validate' || pathname === '/knowledge-center/api/outline/handbooks')) {
      requireSession(req, res, session => { if (!forbidUnlessOutlineAction(res, session, 'outline:create')) proxyOutline(req, res, session); }); return;
    }
    if (req.method === 'DELETE' && /^\/knowledge-center\/api\/outline\/governance\/[^/]+$/.test(pathname)) {
      requireSession(req, res, session => { if (!forbidUnlessOutlineAction(res, session, 'outline:delete')) proxyOutline(req, res, session); }); return;
    }
    if (req.method === 'GET' && pathname === '/knowledge-center/api/production/generations') {
      requireSession(req, res, session => serveMyGenerations(req, res, session)); return;
    }
    if (pathname.startsWith('/knowledge-center/api/production/handbooks/') || pathname.startsWith('/knowledge-center/api/production/attachments/')) {
      requireSession(req, res, session => handleHandbookProduction(req, res, session, pathname)); return;
    }
    const reviewResource = pathname.match(/^\/knowledge-center\/api\/incremental-tasks\/([^/]+)\/resources$/);
    if (reviewResource && req.method === 'GET') {
      requireSession(req, res, async session => {
        const service = handleIncrementalBuild?.service;
        const task = service?.get(session, decodeURIComponent(reviewResource[1]), await service.readState(session));
        if (!task?.handbookSource) throw new GitLabConnectorError('REVIEW_RESOURCE_NOT_FOUND', '审核图片不存在', 404);
        await requireHandbookReadAsync(session, task.handbookId);
        const params = new URL(req.url, 'http://localhost').searchParams;
        if (params.get('candidateDigest') !== task.candidate?.digest) throw new GitLabConnectorError('CANDIDATE_CHANGED', '审核候选已变化，请重新打开审核文档', 409);
        const source = task.handbookSource;
        const document = source.documents.find(item => item.documentId === params.get('documentId'));
        const resource = document?.resources?.find(item => item.path === params.get('path'));
        if (!resource) throw new GitLabConnectorError('REVIEW_RESOURCE_NOT_FOUND', '图片不属于当前审核文档', 404);
        const { mapping, connection } = findMapping(task.handbookId, GITLAB_CONFIG_PATH);
        const identity = { connectionId: connection.id, host: connection.host, project: connection.projectPath || connection.project };
        if (JSON.stringify(identity) !== JSON.stringify(source.repositoryIdentity)) throw new GitLabConnectorError('REVIEW_MAPPING_CHANGED', '仓库映射已变化，请重新发起评审', 409);
        authorizeMappedRequest(mapping, source.branch, 'zh', document.filePath);
        authorizeMappedRequest(mapping, source.branch, 'zh', resource.path);
        let bytes;
        if (resource.delivery === 'create') bytes = handbookProductionService.delivery.readFrozen(resource);
        else {
          if (!source.commitSha) throw new GitLabConnectorError('GITLAB_RESOURCE_SNAPSHOT_CHANGED', '缺少审核图片的固定仓库版本', 409);
          const file = await gitLabRequestForUser(session, connection, options => readGitLabFile(connection, source.commitSha, resource.path, options));
          bytes = Buffer.from(file.content, file.encoding === 'base64' ? 'base64' : 'utf8');
        }
        if (bytes.length !== resource.size || crypto.createHash('sha256').update(bytes).digest('hex') !== resource.contentDigest) throw new GitLabConnectorError('GITLAB_RESOURCE_SNAPSHOT_CHANGED', '审核图片快照不一致', 409);
        const media = imageType(bytes) || (resource.delivery !== 'create' && path.extname(resource.path).toLowerCase() === '.svg' ? 'image/svg+xml' : null);
        if (!media) throw new GitLabConnectorError('GITLAB_RESOURCE_TYPE_NOT_ALLOWED', '审核图片格式不受支持', 415);
        res.writeHead(200, { 'Content-Type': media, 'Content-Length': bytes.length, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'" });
        res.end(bytes);
      }); return;
    }
    const mrPublish = pathname.match(/^\/knowledge-center\/api\/incremental-tasks\/([^/]+)\/publish$/);
    if (mrPublish && req.method === 'POST') {
      requireSession(req, res, async session => {
        const service = handleIncrementalBuild?.service;
        const task = service?.get(session, decodeURIComponent(mrPublish[1]));
        if (!task?.handbookSource) {
          if (task?.reviewMode === 'online_review') throw Object.assign(new Error('候选正文与 GitLab 内容完全一致，没有可提交的变更；请在文档生产修改并重新送审'), { status: 422, code: 'GITLAB_NO_CHANGES' });
          return handleIncrementalBuild(req, res, session);
        }
        if (!hasAction(session, 'publish:manage')) throw Object.assign(new Error('没有发布权限'), { status: 403 });
        await requireHandbookReadAsync(session, task.handbookId);
        const body = await readJsonBody(req);
        const key = req.headers['idempotency-key'];
        if (!key) throw Object.assign(new Error('发布需要幂等键'), { status: 400 });
        if (body.expectedCandidateDigest !== task.candidate?.digest) throw Object.assign(new Error('候选版本已变化'), { status: 409 });
        if (task.state === 'mr_submitted') {
          const { mapping, connection } = findMapping(task.handbookId, GITLAB_CONFIG_PATH);
          const identity = { connectionId: connection.id, host: connection.host, project: connection.projectPath || connection.project };
          if (JSON.stringify(identity) !== JSON.stringify(task.handbookSource.repositoryIdentity)) throw Object.assign(new Error('仓库映射已变化，请重新发起评审'), { status: 409 });
          task.handbookSource.documents.forEach(item => {
            authorizeMappedRequest(mapping, task.handbookSource.branch, 'zh', item.filePath);
            extractMarkdownResources(item.markdown, item.filePath).forEach(resource => authorizeMappedRequest(mapping, task.handbookSource.branch, 'zh', resource.path));
          });
          const delivery = await gitLabRequestForUser(session, connection, options => readMergeRequestDelivery(connection, {
            branch: task.handbookSource.branch,
            documents: task.handbookSource.documents,
            mergeRequest: task.mergeRequest,
          }, options));
          return sendProductionData(res, service.recordMergeRequestDelivery(session, task.id, key, { delivery }));
        }
        if (task.state !== 'approved' || !task.reviews.some(item => item.status === 'approved' && item.candidateDigest === task.candidate.digest)) throw Object.assign(new Error('候选必须通过审核'), { status: 409 });
        const { mapping, connection } = findMapping(task.handbookId, GITLAB_CONFIG_PATH);
        const identity = { connectionId: connection.id, host: connection.host, project: connection.projectPath || connection.project };
        if (JSON.stringify(identity) !== JSON.stringify(task.handbookSource.repositoryIdentity)) throw Object.assign(new Error('仓库映射已变化，请重新发起评审'), { status: 409 });
        if (task.candidate.content !== task.handbookSource.content || JSON.stringify(task.candidate.operations) !== JSON.stringify(task.handbookSource.operations)) throw Object.assign(new Error('候选与保存快照不一致，请返回手册重新提交'), { status: 409 });
        task.handbookSource.documents.forEach(item => {
          authorizeMappedRequest(mapping, task.handbookSource.branch, 'zh', item.filePath);
          extractMarkdownResources(item.markdown, item.filePath).forEach(resource => authorizeMappedRequest(mapping, task.handbookSource.branch, 'zh', resource.path));
        });
        const mergeRequest = await gitLabRequestForUser(session, connection, options => submitDocumentMergeRequest(connection, {
          ...task.handbookSource, taskId: task.id, title: task.name, candidateDigest: task.candidate.digest,
        }, { ...options, loadResource: resource => handbookProductionService.delivery.readFrozen(resource) }));
        sendProductionData(res, service.recordMergeRequest(session, task.id, key, { expectedCandidateDigest: body.expectedCandidateDigest, mergeRequest }));
      }); return;
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
      sendFile(filePath, res, req); return;
    }
    return false;
  };
}

module.exports = { createKnowledgeCenterHandler, KnowledgeCenterConfigError };
