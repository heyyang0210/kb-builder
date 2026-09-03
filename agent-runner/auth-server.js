require('dotenv').config();

const http = require('http');
const path = require('path');
const { createKnowledgeCenterAuthService } = require('./lib/knowledge-center-auth');

const PORT = Number(process.env.KNOWLEDGE_CENTER_AUTH_PORT || 4200);
const HOST = process.env.KNOWLEDGE_CENTER_AUTH_HOST || '127.0.0.1';
const repositoryPath = process.env.KNOWLEDGE_CENTER_AUTH_STORE || path.join(__dirname, 'tmp', 'knowledge-center-auth.json');

const service = createKnowledgeCenterAuthService({
  casBaseUrl: process.env.KNOWLEDGE_CENTER_CAS_URL || 'https://cas.yasdb.com/cas',
  serviceUrl: process.env.KNOWLEDGE_CENTER_SERVICE_URL || 'http://127.0.0.1:3500/knowledge-center/',
  adminUsername: process.env.KNOWLEDGE_CENTER_ADMIN_USERNAME || 'admin',
  adminPassword: process.env.KNOWLEDGE_CENTER_ADMIN_PASSWORD || 'admin',
  sessionTtlMs: Number(process.env.KNOWLEDGE_CENTER_SESSION_TTL_MS || 8 * 60 * 60 * 1000),
  secureCookie: process.env.KNOWLEDGE_CENTER_COOKIE_SECURE !== 'false',
  repositoryPath,
  repository: process.env.KNOWLEDGE_STORAGE_MODE === 'database' ? 'database' : undefined,
});

const server = http.createServer(service.handler);
server.listen(PORT, HOST, () => {
  console.log(`知识中心认证服务已启动：http://${HOST}:${PORT}`);
});

module.exports = { server, service };
