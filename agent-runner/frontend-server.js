const http = require('http');
const fs = require('fs');
const path = require('path');
const { createProxy } = require('./lib/proxy-utils');
const { createAggregateStore, DatabaseIncrementalStore } = require('./lib/aggregate-store');
const { createIncrementalBuildHandler } = require('./lib/incremental-build-service');
const { createKnowledgeCenterHandler } = require('./routes/knowledge-center');

const PORT = Number(process.env.PORT || 3500);
const HOST = '0.0.0.0';
const PUBLIC_HOST = process.env.KNOWLEDGE_CENTER_PUBLIC_HOST || 'localhost';
const ROOT = path.join(__dirname, 'frontend');
const PINGCODE_ROOT = path.join(__dirname, '..', 'scripts', 'pingcode', 'web', 'frontend', 'dist');
const PINGCODE_PREFIX = '/pingcode-materials';
const KNOWLEDGE_CENTER_PREFIX = '/knowledge-center';
const KNOWLEDGE_CENTER_ROOT = path.join(ROOT, 'knowledge-center');
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
const AUTH_API_HOST = process.env.KNOWLEDGE_CENTER_AUTH_HOST || '127.0.0.1';
const AUTH_API_PORT = Number(process.env.KNOWLEDGE_CENTER_AUTH_PORT || 4200);
const OUTLINE_INTERNAL_TOKEN = process.env.KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN || '';
const KNOWLEDGE_ASSETS_CONFIG = process.env.KNOWLEDGE_ASSETS_CONFIG
  ? path.resolve(process.env.KNOWLEDGE_ASSETS_CONFIG)
  : path.join(__dirname, 'config', 'knowledge-assets.json');
const knowledgeAssetsStore = createAggregateStore({
  namespace: 'assets', key: 'catalog',
  filePath: KNOWLEDGE_ASSETS_CONFIG,
  emptyValue: { version: 1, handbooks: [], audits: [] },
});
const INCREMENTAL_BUILD_STATE = process.env.INCREMENTAL_BUILD_STATE
  ? path.resolve(__dirname, process.env.INCREMENTAL_BUILD_STATE)
  : path.join(__dirname, 'tmp', 'incremental-build-state.json');
const incrementalRepository = String(process.env.KNOWLEDGE_STORAGE_MODE || 'file').toLowerCase() === 'database'
  ? new DatabaseIncrementalStore() : undefined;
const handleIncrementalBuild = createIncrementalBuildHandler({ repository: incrementalRepository, repositoryPath: INCREMENTAL_BUILD_STATE });
const GITLAB_CONFIG_PATH = process.env.KNOWLEDGE_CENTER_GITLAB_CONFIG
  ? path.resolve(process.env.KNOWLEDGE_CENTER_GITLAB_CONFIG)
  : path.join(__dirname, 'config', 'gitlab-connections.json');
const GITLAB_DOCUMENT_TYPES_PATH = process.env.KNOWLEDGE_CENTER_GITLAB_DOCUMENT_TYPES
  ? path.resolve(process.env.KNOWLEDGE_CENTER_GITLAB_DOCUMENT_TYPES)
  : path.join(__dirname, 'config', 'gitlab-document-types.json');

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

function sendFile(filePath, res) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') { res.writeHead(404); res.end('Not Found'); }
      else { res.writeHead(500); res.end('Server Error'); }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
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

const proxyKnowledgeCenterAuth = createProxy({
  targetHost: AUTH_API_HOST, targetPort: AUTH_API_PORT,
  pathTransform: req => req.url,
  errorPayload: () => ({ success: false, error: { code: 'AUTH_SERVICE_UNAVAILABLE', message: '认证服务暂时不可用', retryable: true } }),
});

const proxyPermissionApi = createProxy({
  targetHost: AUTH_API_HOST, targetPort: AUTH_API_PORT,
  pathTransform: req => `/knowledge-center/api/auth/users${req.url.slice('/knowledge-center/api/platform/permissions'.length)}`,
  errorPayload: () => ({ success: false, error: { code: 'AUTH_SERVICE_UNAVAILABLE', message: '认证服务暂时不可用' } }),
});

function proxyKnowledgeCenterOutline(req, res) {
  const suffix = req.url.slice('/knowledge-center/api/outline'.length);
  const targetPath = `/api/outline${suffix}`;
  const headers = { ...req.headers, host: `${DOCUMENT_API_HOST}:${DOCUMENT_API_PORT}` };
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
  proxyAuth: proxyKnowledgeCenterAuth,
  proxyOutline: proxyKnowledgeCenterOutline,
  proxyPermission: proxyPermissionApi,
  handleIncrementalBuild,
  KNOWLEDGE_ASSETS_CONFIG_PATH: KNOWLEDGE_ASSETS_CONFIG,
  config: {
    KNOWLEDGE_CENTER_PREFIX, KNOWLEDGE_CENTER_ROOT, KNOWLEDGE_CENTER_ENTRY,
    PINGCODE_PREFIX, PINGCODE_ROOT,
    DOCUMENT_API_HOST, DOCUMENT_API_PORT,
    PINGCODE_API_HOST, PINGCODE_API_PORT,
    PLATFORM_CONTEXT_TIMEOUT_MS,
    AUTH_API_HOST, AUTH_API_PORT,
    GITLAB_CONFIG_PATH, GITLAB_DOCUMENT_TYPES_PATH,
  },
  stores: { knowledgeAssetsStore },
});

// --- Main server ---

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;

  // Knowledge center routes (auth, assets, gitlab, outline, incremental, static)
  if (pathname === KNOWLEDGE_CENTER_PREFIX || pathname.startsWith(`${KNOWLEDGE_CENTER_PREFIX}/`)) {
    handleKnowledgeCenter(req, res);
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
    sendFile(filePath, res);
    return;
  }

  // Pingcode app route redirects
  if (PINGCODE_APP_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))) {
    const target = `${PINGCODE_PREFIX}${pathname}${new URL(req.url, 'http://localhost').search}`;
    res.writeHead(302, { Location: target });
    res.end();
    return;
  }

  // Default: serve prompt generator static files
  const filePath = path.join(ROOT, pathname === '/' ? '/prompt-generator.html' : pathname);
  sendFile(filePath, res);
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`Frontend server listening on http://${HOST}:${PORT}`);
    console.log(`Open http://${PUBLIC_HOST}:${PORT}/prompt-generator.html in your browser`);
    console.log(`Open http://${PUBLIC_HOST}:${PORT}${PINGCODE_PREFIX}/ in your browser`);
  });
}

module.exports = {
  server,
};

// Re-export asset utilities for test compatibility.
const { ASSET_STATUS_LABELS, systemAssetStatus, assetStatus, projectAsset, queryKnowledgeAssets, isPlatformAdmin } = require('./lib/knowledge-asset-utils');
module.exports.ASSET_STATUS_LABELS = ASSET_STATUS_LABELS;
module.exports.systemAssetStatus = systemAssetStatus;
module.exports.assetStatus = assetStatus;
module.exports.projectAsset = projectAsset;
module.exports.queryKnowledgeAssets = queryKnowledgeAssets;
module.exports.isPlatformAdmin = isPlatformAdmin;
