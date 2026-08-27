const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadPlatformContext } = require('./lib/platform-context-gateway');

const PORT = Number(process.env.PORT || 3500);
const HOST = '0.0.0.0';
const PUBLIC_HOST = '192.168.130.180';
const ROOT = path.join(__dirname, 'frontend');
const PINGCODE_ROOT = path.join(__dirname, '..', 'scripts', 'pingcode', 'web', 'frontend', 'dist');
const PINGCODE_PREFIX = '/pingcode-materials';
const PINGCODE_API_PREFIX = '/pingcode-api';
const PINGCODE_APP_ROUTES = ['/workbench', '/upload', '/spaces', '/batches', '/knowledge'];
const PINGCODE_API_HOST = process.env.PINGCODE_API_HOST || '127.0.0.1';
const PINGCODE_API_PORT = Number(process.env.PINGCODE_API_PORT || 8001);
const DOCUMENT_API_HOST = process.env.DOCUMENT_API_HOST || '127.0.0.1';
const DOCUMENT_API_PORT = Number(process.env.DOCUMENT_API_PORT || 4100);
const PLATFORM_CONTEXT_TIMEOUT_MS = Number(process.env.PLATFORM_CONTEXT_TIMEOUT_MS || 2000);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

function sendFile(filePath, res) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

function proxyPingcodeApi(req, res) {
  const targetPath = req.url.slice(PINGCODE_API_PREFIX.length) || '/';
  const proxyRequest = http.request({
    hostname: PINGCODE_API_HOST,
    port: PINGCODE_API_PORT,
    path: targetPath,
    method: req.method,
    headers: { ...req.headers, host: `${PINGCODE_API_HOST}:${PINGCODE_API_PORT}` },
  }, proxyResponse => {
    res.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
    proxyResponse.pipe(res);
  });
  proxyRequest.on('error', error => {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, error: { code: 'PINGCODE_API_UNAVAILABLE', message: error.message } }));
  });
  req.pipe(proxyRequest);
}

function pingcodeFilePath(requestUrl) {
  const pathname = new URL(requestUrl, 'http://localhost').pathname;
  const relativePath = decodeURIComponent(pathname.slice(PINGCODE_PREFIX.length)).replace(/^\/+/, '');
  const requested = relativePath || 'index.html';
  const candidate = path.resolve(PINGCODE_ROOT, requested);
  if (!candidate.startsWith(`${path.resolve(PINGCODE_ROOT)}${path.sep}`) && candidate !== path.resolve(PINGCODE_ROOT)) {
    return null;
  }
  return path.extname(candidate) ? candidate : path.join(PINGCODE_ROOT, 'index.html');
}

async function servePlatformContext(res) {
  const result = await loadPlatformContext({
    timeoutMs: PLATFORM_CONTEXT_TIMEOUT_MS,
    documentGeneration: {
      hostname: DOCUMENT_API_HOST,
      port: DOCUMENT_API_PORT,
      path: '/api/platform/context'
    },
    materialProcessing: {
      hostname: PINGCODE_API_HOST,
      port: PINGCODE_API_PORT,
      path: '/api/platform/context'
    }
  });
  res.writeHead(result.statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(result.body));
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'GET' && pathname === '/knowledge-center/api/platform/context') {
    servePlatformContext(res);
    return;
  }
  if (req.url === PINGCODE_API_PREFIX || req.url.startsWith(`${PINGCODE_API_PREFIX}/`)) {
    proxyPingcodeApi(req, res);
    return;
  }
  if (req.url === PINGCODE_PREFIX || req.url.startsWith(`${PINGCODE_PREFIX}/`)) {
    const filePath = pingcodeFilePath(req.url);
    if (!filePath) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }
    sendFile(filePath, res);
    return;
  }
  if (PINGCODE_APP_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))) {
    const target = `${PINGCODE_PREFIX}${pathname}${new URL(req.url, 'http://localhost').search}`;
    res.writeHead(302, { Location: target });
    res.end();
    return;
  }
  const filePath = path.join(ROOT, pathname === '/' ? '/prompt-generator.html' : pathname);
  sendFile(filePath, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Frontend server listening on http://${HOST}:${PORT}`);
  console.log(`Open http://${PUBLIC_HOST}:${PORT}/prompt-generator.html in your browser`);
  console.log(`Open http://${PUBLIC_HOST}:${PORT}${PINGCODE_PREFIX}/ in your browser`);
});
