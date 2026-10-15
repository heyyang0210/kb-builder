const http = require('http');
const fs = require('fs');
const path = require('path');
require('../../packages/agent-runner-core/lib/runtime-env').loadRuntimeEnv();
const { createProxy } = require('../../packages/agent-runner-core/lib/proxy-utils');
const { validateCleaningResponse, ensureSuccessEnvelope } = require('../../packages/agent-runner-core/lib/knowledge-center-runtime-contract');
const { createAggregateStore, DatabaseIncrementalStore } = require('../../packages/agent-runner-core/lib/aggregate-store');
const crypto = require('crypto');
const { createIncrementalBuildHandler } = require('../../packages/agent-runner-core/lib/incremental-build-service');
const { createKnowledgeCenterHandler } = require('../../packages/agent-runner-core/routes/knowledge-center');
const { createDatabaseConnectionGovernance } = require('../../packages/agent-runner-core/lib/platform-management/database-connection-governance');
const { REPOSITORY_ROOT, AGENT_RUNNER_RUNTIME_ROOT } = require('../../packages/agent-runner-core/lib/repo-paths');
const { CONFIG_PATHS } = require('../../packages/agent-runner-core/lib/config-registry');
const { createBrandIconStore } = require('../../packages/agent-runner-core/lib/brand-icon-store');
const { createTemplateStore } = require('../../packages/agent-runner-core/lib/template-store');
const { createDomainStore } = require('../../packages/agent-runner-core/lib/domain-store');
const { createKnowledgeCenterAuthService } = require('../../packages/agent-runner-core/lib/knowledge-center-auth');
const { PlatformModuleRegistry } = require('../../packages/agent-runner-core/lib/platform-module-registry');

const PORT = Number(process.env.PORT || 3500);
const HOST = '0.0.0.0';
const PUBLIC_HOST = process.env.KNOWLEDGE_CENTER_PUBLIC_HOST || 'localhost';
const PUBLIC_BASE_URL = String(process.env.KNOWLEDGE_CENTER_PUBLIC_BASE_URL || `http://${PUBLIC_HOST}:${PORT}`).replace(/\/$/, '');
const ROOT = process.env.KNOWLEDGE_CENTER_FRONTEND_ROOT
  ? path.resolve(process.env.KNOWLEDGE_CENTER_FRONTEND_ROOT)
  : path.join(__dirname, 'frontend');
const PINGCODE_ROOT = process.env.PINGCODE_WEB_DIST_DIR
  ? path.resolve(process.env.PINGCODE_WEB_DIST_DIR)
  : path.join(REPOSITORY_ROOT, 'apps', 'pingcode-web', 'dist');
const PINGCODE_PREFIX = '/pingcode-materials';
const KNOWLEDGE_CENTER_PREFIX = '/knowledge-center';
const KNOWLEDGE_CENTER_ROOT = path.join(ROOT, 'knowledge-center');
const outlineTemplateRules = require('../../config/knowledge-center/content-rules.json').outlineTemplate;
const OUTLINE_TEMPLATE_PATH = process.env.KNOWLEDGE_CENTER_OUTLINE_TEMPLATE_PATH
  ? path.resolve(process.env.KNOWLEDGE_CENTER_OUTLINE_TEMPLATE_PATH)
  : path.join(REPOSITORY_ROOT, outlineTemplateRules.templatePath);
const OUTLINE_SAMPLE_PATH = process.env.KNOWLEDGE_CENTER_OUTLINE_SAMPLE_PATH
  ? path.resolve(process.env.KNOWLEDGE_CENTER_OUTLINE_SAMPLE_PATH)
  : path.join(REPOSITORY_ROOT, outlineTemplateRules.sampleDownloadPath);
// Keep the directory URL stable while using a descriptive source filename.
// This avoids relying on an ambiguous generic index.html in the platform bundle.
const KNOWLEDGE_CENTER_ENTRY = 'knowledge-center-management.html';
const PINGCODE_API_PREFIX = '/pingcode-api';
const PINGCODE_APP_ROUTES = ['/workbench', '/upload', '/spaces', '/batches', '/knowledge'];
const PINGCODE_API_HOST = process.env.PINGCODE_API_HOST || '127.0.0.1';
const PINGCODE_API_PORT = Number(process.env.PINGCODE_API_PORT || 8001);
const DOCUMENT_API_HOST = process.env.DOCUMENT_API_HOST || '127.0.0.1';
const DOCUMENT_API_PORT = Number(process.env.DOCUMENT_API_PORT || 4100);
const PLATFORM_CONTEXT_TIMEOUT_MS = Number(process.env.PLATFORM_CONTEXT_TIMEOUT_MS || 2000);
const OUTLINE_INTERNAL_TOKEN = process.env.KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN || '';
const KNOWLEDGE_ASSETS_CONFIG = process.env.KNOWLEDGE_ASSETS_CONFIG
  ? path.resolve(process.env.KNOWLEDGE_ASSETS_CONFIG)
  : CONFIG_PATHS.knowledgeAssets;
const domainStore = createDomainStore();
const knowledgeAssetsStore = String(process.env.KNOWLEDGE_STORAGE_MODE || 'file').toLowerCase() === 'database'
  ? (() => {
      return {
        read: () => domainStore.readHandbooks(),
        readAsync: () => domainStore.readHandbooksAsync(),
        write: payload => domainStore.writeHandbooksSnapshot(payload),
      };
    })()
  : createAggregateStore({ namespace: 'assets', key: 'catalog', filePath: KNOWLEDGE_ASSETS_CONFIG, emptyValue: { version: 1, handbooks: [], audits: [] } });
const manualStatusStore = createAggregateStore({
  namespace: 'assets',
  key: 'manual-status-overrides',
  filePath: path.join(AGENT_RUNNER_RUNTIME_ROOT, 'tmp', 'knowledge-center-manual-status.json'),
  emptyValue: { version: 1, statuses: {}, audits: [] },
});
const templateStore = createTemplateStore({});

// 数据库模式下在启动阶段核对迁移源，避免文件源与数据库聚合不一致时静默展示空列表。
if (String(process.env.KNOWLEDGE_STORAGE_MODE || 'file').toLowerCase() === 'database' && fs.existsSync(KNOWLEDGE_ASSETS_CONFIG)) {
  try {
    const source = JSON.parse(fs.readFileSync(KNOWLEDGE_ASSETS_CONFIG, 'utf8'));
    const stored = knowledgeAssetsStore.read();
    const sourceHash = crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex');
    const storedHash = crypto.createHash('sha256').update(JSON.stringify(stored)).digest('hex');
    if (sourceHash !== storedHash || (source.handbooks || []).length !== (stored.handbooks || []).length) {
      console.warn(`[assets-consistency] 文件源与数据库聚合不一致：file=${source.handbooks?.length || 0}, database=${stored.handbooks?.length || 0}；请执行受控迁移。`);
    } else {
      console.info(`[assets-consistency] 手册资产校验通过：${stored.handbooks?.length || 0} 条。`);
    }
  } catch (error) {
    console.warn(`[assets-consistency] 启动校验失败：${error.message}`);
  }
}
const brandIconStore = createBrandIconStore({
  platformPath: process.env.KNOWLEDGE_CENTER_PRODUCT_CONFIG || process.env.KNOWLEDGE_CENTER_PLATFORM_CONFIG
    ? path.resolve(process.env.KNOWLEDGE_CENTER_PRODUCT_CONFIG || process.env.KNOWLEDGE_CENTER_PLATFORM_CONFIG)
    : CONFIG_PATHS.product,
  brandingRoot: process.env.KNOWLEDGE_CENTER_BRANDING_ROOT ? path.resolve(process.env.KNOWLEDGE_CENTER_BRANDING_ROOT) : undefined,
});
const INCREMENTAL_BUILD_STATE = process.env.INCREMENTAL_BUILD_STATE
  ? path.resolve(__dirname, process.env.INCREMENTAL_BUILD_STATE)
  : path.join(AGENT_RUNNER_RUNTIME_ROOT, 'tmp', 'incremental-build-state.json');
const incrementalRepository = String(process.env.KNOWLEDGE_STORAGE_MODE || 'file').toLowerCase() === 'database'
  ? new DatabaseIncrementalStore() : undefined;
const handleIncrementalBuild = createIncrementalBuildHandler({ repository: incrementalRepository, repositoryPath: INCREMENTAL_BUILD_STATE });
const GITLAB_CONFIG_PATH = process.env.KNOWLEDGE_CENTER_GITLAB_CONFIG
  ? path.resolve(process.env.KNOWLEDGE_CENTER_GITLAB_CONFIG)
  : CONFIG_PATHS.gitlabConnections;
const DATABASE_CONNECTION_CONFIG_PATH = path.join(
  process.env.YASDB_CONFIG_DIR ? path.resolve(process.env.YASDB_CONFIG_DIR) : path.join(REPOSITORY_ROOT, 'config', 'yashandb'),
  'service.env',
);
const GITLAB_DOCUMENT_TYPES_PATH = process.env.KNOWLEDGE_CENTER_GITLAB_DOCUMENT_TYPES
  ? path.resolve(process.env.KNOWLEDGE_CENTER_GITLAB_DOCUMENT_TYPES)
  : CONFIG_PATHS.contentRules;
const authModule = createKnowledgeCenterAuthService({
  casBaseUrl: process.env.KNOWLEDGE_CENTER_CAS_URL || 'https://cas.yasdb.com/cas',
  serviceUrl: process.env.KNOWLEDGE_CENTER_SERVICE_URL || `${PUBLIC_BASE_URL}/knowledge-center/`,
  adminUsername: process.env.KNOWLEDGE_CENTER_ADMIN_USERNAME || 'admin',
  adminPassword: process.env.KNOWLEDGE_CENTER_ADMIN_PASSWORD || 'admin',
  knowledgeEditorUsername: process.env.KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_USERNAME || 'test',
  knowledgeEditorPassword: process.env.KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_PASSWORD || 'test',
  sessionTtlMs: Number(process.env.KNOWLEDGE_CENTER_SESSION_TTL_MS || 8 * 60 * 60 * 1000),
  secureCookie: process.env.KNOWLEDGE_CENTER_COOKIE_SECURE !== 'false',
  environment: process.env.KNOWLEDGE_CENTER_ENVIRONMENT || process.env.KNOWLEDGE_CENTER_ENV || 'development',
  testRunId: process.env.KNOWLEDGE_CENTER_TEST_RUN_ID || null,
  repositoryPath: process.env.KNOWLEDGE_CENTER_AUTH_STORE || path.join(AGENT_RUNNER_RUNTIME_ROOT, 'tmp', 'knowledge-center-auth.json'),
  // 会话、Ticket 和认证日志保留在本地运行时；CAS 用户和角色通过
  // DomainStore 的原生异步 HTTP 路径读写，不得在 13510 事件循环中启动同步 curl。
  repository: undefined,
  domainStore,
  principalDirectory: {
    upsertCas: info => domainStore.syncCasPrincipal({
      casLoginName: String(info.user || info.uid || '').trim(),
      displayName: String(info.cn || info.user || info.uid || '').trim(),
      actor: 'system:cas',
    }),
  },
});
const usingDefaultAdmin = !process.env.KNOWLEDGE_CENTER_ADMIN_USERNAME && !process.env.KNOWLEDGE_CENTER_ADMIN_PASSWORD;
const usingDefaultEditor = !process.env.KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_USERNAME && !process.env.KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_PASSWORD;
if (usingDefaultAdmin || usingDefaultEditor) {
  console.warn('[认证模块] 警告：正在使用内置默认凭据，请通过环境变量配置正式账号密码后重新启动。');
}
const platformModules = new PlatformModuleRegistry();
platformModules.register({ id: 'auth', version: '1.0.0', ...authModule });
const databaseConnectionGovernance = createDatabaseConnectionGovernance({
  filePath: DATABASE_CONNECTION_CONFIG_PATH,
  autoStartHealthMonitor: false,
});

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function sendFile(filePath, res, req) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') { res.writeHead(404); res.end('Not Found'); }
      else { res.writeHead(500); res.end('Server Error'); }
    } else {
      const etag = `"${crypto.createHash('sha1').update(content).digest('hex')}"`;
      const cacheControl = ext === '.html' ? 'no-cache' : 'private, max-age=0, must-revalidate';
      if (ext !== '.html' && req?.headers?.['if-none-match'] === etag) {
        res.writeHead(304, { ETag: etag, 'Cache-Control': cacheControl });
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': cacheControl, ETag: etag });
      res.end(content);
    }
  });
}

// --- Proxy functions ---

const proxyPingcodeApi = createProxy({
  targetHost: PINGCODE_API_HOST, targetPort: PINGCODE_API_PORT,
  pathTransform: req => req.url.slice(PINGCODE_API_PREFIX.length) || '/',
  errorPayload: error => ({ success: false, error: { code: 'PINGCODE_API_UNAVAILABLE', message: error.message } }),
});

const proxyDocumentApi = createProxy({
  targetHost: DOCUMENT_API_HOST, targetPort: DOCUMENT_API_PORT,
  pathTransform: req => req.url || '/',
  errorPayload: () => ({ success: false, error: { code: 'DOCUMENT_API_UNAVAILABLE', message: '文档服务暂时不可用', retryable: true } }),
});

const proxyKnowledgeCenterCleaning = createProxy({
  targetHost: PINGCODE_API_HOST, targetPort: PINGCODE_API_PORT,
  pathTransform: req => `/api${req.url.slice('/knowledge-center/api/cleaning'.length) || '/workbench/summary'}`,
  requestHeaders: (_req, context) => {
    const headers = context?.session?.user?.id ? { 'x-actor-id': String(context.session.user.id) } : {};
    const displayName = String(context?.session?.user?.displayName || '');
    // HTTP header values must be Latin-1; avoid leaking or corrupting Chinese names.
    if (displayName && /^[\x20-\x7e]+$/.test(displayName)) headers['x-actor-display-name'] = displayName;
    return headers;
  },
  normalizeErrorResponse: (raw, status, requestId, correlationId) => {
    let upstream = null;
    try { upstream = JSON.parse(raw || '{}'); } catch (_error) { upstream = null; }
    if (upstream?.success === false && upstream.error) {
      return { ...upstream, error: { ...upstream.error, requestId: upstream.error.requestId || requestId, correlationId: upstream.error.correlationId || correlationId } };
    }
    const detail = upstream?.detail;
    const issues = Array.isArray(detail) ? detail : (detail ? [detail] : []);
    return {
      success: false,
      error: {
        code: status === 422 ? 'VALIDATION_ERROR' : 'MATERIAL_PROCESSING_ERROR',
        message: status === 422 ? '请求参数校验失败' : '资料加工请求失败',
        retryable: status >= 500,
        requestId,
        correlationId,
        details: { status, issues, legacyDetail: detail || null },
      },
    };
  },
  transformResponse: (raw, _status, requestId, correlationId, context) => {
    let parsed;
    try { parsed = JSON.parse(raw || '{}'); } catch (_error) { return undefined; }
    if (parsed && typeof parsed === 'object' && parsed.success !== undefined) {
      const normalized = ensureSuccessEnvelope({ ...parsed, requestId: parsed.requestId || requestId, correlationId: parsed.correlationId || correlationId });
      // Some legacy command endpoints already expose success=true but return
      // their result fields at the top level. Preserve those fields while
      // adding the v1 data envelope required by the unified entry.
      return normalized;
    }
    const endpoint = context?.endpoint;
    const envelope = { success: true, requestId, correlationId, data: parsed };
    // Preserve legacy top-level fields on the new route while exposing a stable data field.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return { ...parsed, ...envelope };
    if (Array.isArray(parsed)) envelope.items = parsed;
    if (endpoint?.id) envelope.endpoint = endpoint.id;
    return envelope;
  },
  validateResponse: validateCleaningResponse,
  errorPayload: (_error, requestId, correlationId) => ({ success: false, error: { code: 'MATERIAL_PROCESSING_UNAVAILABLE', message: '资料加工服务暂时不可用', retryable: true, requestId, correlationId } }),
});

function proxyKnowledgeCenterOutline(req, res, session) {
  const suffix = req.url.slice('/knowledge-center/api/outline'.length);
  const targetPath = `/api/outline${suffix}`;
  const headers = { ...req.headers, host: `${DOCUMENT_API_HOST}:${DOCUMENT_API_PORT}` };
  delete headers['x-actor-id'];
  delete headers['x-outline-actions'];
  if (session?.user) {
    headers['x-actor-id'] = session.user.id;
    headers['x-outline-actions'] = (session.user.allowedActions || []).join(',');
  }
  if (OUTLINE_INTERNAL_TOKEN) headers['x-knowledge-center-internal-token'] = OUTLINE_INTERNAL_TOKEN;
  const proxyRequest = http.request({ hostname: DOCUMENT_API_HOST, port: DOCUMENT_API_PORT, path: targetPath, method: req.method, headers }, proxyResponse => {
    res.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
    proxyResponse.pipe(res);
  });
  proxyRequest.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ success: false, error: { code: 'OUTLINE_SERVICE_UNAVAILABLE', message: '大纲服务暂不可用', retryable: true } }));
  });
  req.pipe(proxyRequest);
}

// --- Knowledge center handler ---

const handleKnowledgeCenter = createKnowledgeCenterHandler({
  sendFile,
  proxyAuth: null,
  proxyCleaning: proxyKnowledgeCenterCleaning,
  proxyOutline: proxyKnowledgeCenterOutline,
  proxyPermission: null,
  handleIncrementalBuild,
  KNOWLEDGE_ASSETS_CONFIG_PATH: KNOWLEDGE_ASSETS_CONFIG,
  config: {
    KNOWLEDGE_CENTER_PREFIX, KNOWLEDGE_CENTER_ROOT, KNOWLEDGE_CENTER_ENTRY,
    OUTLINE_TEMPLATE_PATH, OUTLINE_SAMPLE_PATH,
    PINGCODE_PREFIX, PINGCODE_ROOT,
    DOCUMENT_API_HOST, DOCUMENT_API_PORT,
    PINGCODE_API_HOST, PINGCODE_API_PORT,
    PLATFORM_CONTEXT_TIMEOUT_MS,
    GITLAB_CONFIG_PATH, GITLAB_DOCUMENT_TYPES_PATH,
    DATABASE_CONNECTION_CONFIG_PATH,
  },
  stores: { knowledgeAssetsStore, manualStatusStore, templateStore, brandIconStore, domainStore },
  moduleRegistry: platformModules,
  databaseConnectionGovernance,
});

// --- Main server ---

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;

  // Knowledge center routes (auth, assets, gitlab, outline, incremental, static)
  if (pathname === KNOWLEDGE_CENTER_PREFIX || pathname.startsWith(`${KNOWLEDGE_CENTER_PREFIX}/`)) {
    try {
      Promise.resolve(handleKnowledgeCenter(req, res)).catch(error => {
        if (res.headersSent || res.writableEnded) return;
        const status = Number.isInteger(Number(error?.status)) ? Number(error.status) : 503;
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: false, error: { code: error?.code || 'KNOWLEDGE_CENTER_REQUEST_FAILED', message: error?.message || '知识中心服务暂时不可用，请稍后重试。', retryable: status >= 500 } }));
      });
    } catch (error) {
      if (!res.headersSent && !res.writableEnded) {
        res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ success: false, error: { code: error?.code || 'KNOWLEDGE_CENTER_REQUEST_FAILED', message: error?.message || '知识中心服务暂时不可用，请稍后重试。', retryable: true } }));
      }
    }
    return;
  }

  // Pingcode API proxy
  if (req.url === PINGCODE_API_PREFIX || req.url.startsWith(`${PINGCODE_API_PREFIX}/`)) {
    proxyPingcodeApi(req, res);
    return;
  }

  // Document API proxy
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    proxyDocumentApi(req, res);
    return;
  }

  // Pingcode materials static files
  if (req.url === PINGCODE_PREFIX || req.url.startsWith(`${PINGCODE_PREFIX}/`)) {
    const pingcodePathname = new URL(req.url, 'http://localhost').pathname;
    const relativePath = decodeURIComponent(pingcodePathname.slice(PINGCODE_PREFIX.length)).replace(/^\/+/, '');
    const requested = relativePath || 'index.html';
    const candidate = path.resolve(PINGCODE_ROOT, requested);
    if (!candidate.startsWith(`${path.resolve(PINGCODE_ROOT)}${path.sep}`) && candidate !== path.resolve(PINGCODE_ROOT)) {
      res.writeHead(400); res.end('Bad Request'); return;
    }
    const filePath = path.extname(candidate) ? candidate : path.join(PINGCODE_ROOT, 'index.html');
    sendFile(filePath, res, req);
    return;
  }

  // Pingcode app route redirects
  if (PINGCODE_APP_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))) {
    const target = `${PINGCODE_PREFIX}${pathname}${new URL(req.url, 'http://localhost').search}`;
    res.writeHead(302, { Location: target });
    res.end();
    return;
  }

  // Default: serve the semantically named document-generation workbench.
  // Keep the historical prompt-generator URL as a redirect-only compatibility entry.
  if (pathname === '/prompt-generator.html') {
    res.writeHead(302, { Location: `/document-generation-workbench.html${new URL(req.url, 'http://localhost').search}` });
    res.end();
    return;
  }
  const filePath = path.join(ROOT, pathname === '/' ? '/document-generation-workbench.html' : pathname);
  sendFile(filePath, res, req);
});

if (require.main === module) {
  databaseConnectionGovernance.startHealthMonitor();
  server.listen(PORT, HOST, () => {
    console.log(`Frontend server listening on http://${HOST}:${PORT}`);
    console.log(`Open ${PUBLIC_BASE_URL}/document-generation-workbench.html in your browser`);
    console.log(`Open ${PUBLIC_BASE_URL}${PINGCODE_PREFIX}/ in your browser`);
  });
}

server.on('close', () => databaseConnectionGovernance.stopHealthMonitor());

module.exports = {
  server,
};

// Re-export asset utilities for test compatibility.
const { ASSET_STATUS_LABELS, systemAssetStatus, assetStatus, projectAsset, queryKnowledgeAssets, isPlatformAdmin } = require('../../packages/agent-runner-core/lib/knowledge-asset-utils');
module.exports.ASSET_STATUS_LABELS = ASSET_STATUS_LABELS;
module.exports.systemAssetStatus = systemAssetStatus;
module.exports.assetStatus = assetStatus;
module.exports.projectAsset = projectAsset;
module.exports.queryKnowledgeAssets = queryKnowledgeAssets;
module.exports.isPlatformAdmin = isPlatformAdmin;
