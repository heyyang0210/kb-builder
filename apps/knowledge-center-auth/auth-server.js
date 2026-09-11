require('../../packages/agent-runner-core/lib/runtime-env').loadRuntimeEnv();

const http = require('http');
const path = require('path');
const { createKnowledgeCenterAuthService } = require('../../packages/agent-runner-core/lib/knowledge-center-auth');
const { AGENT_RUNNER_RUNTIME_ROOT } = require('../../packages/agent-runner-core/lib/repo-paths');

const PORT = Number(process.env.KNOWLEDGE_CENTER_AUTH_PORT || 4200);
const HOST = process.env.KNOWLEDGE_CENTER_AUTH_HOST || '127.0.0.1';
const repositoryPath = process.env.KNOWLEDGE_CENTER_AUTH_STORE || path.join(AGENT_RUNNER_RUNTIME_ROOT, 'tmp', 'knowledge-center-auth.json');

const usingDefaultAdmin = !process.env.KNOWLEDGE_CENTER_ADMIN_USERNAME && !process.env.KNOWLEDGE_CENTER_ADMIN_PASSWORD;
const usingDefaultEditor = !process.env.KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_USERNAME && !process.env.KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_PASSWORD;
if (usingDefaultAdmin || usingDefaultEditor) {
  console.warn('[认证服务] 警告：正在使用内置默认凭据，请通过环境变量配置正式账号密码后重新启动。');
}

const service = createKnowledgeCenterAuthService({
  casBaseUrl: process.env.KNOWLEDGE_CENTER_CAS_URL || 'https://cas.yasdb.com/cas',
  serviceUrl: process.env.KNOWLEDGE_CENTER_SERVICE_URL || 'http://127.0.0.1:3500/knowledge-center/',
  adminUsername: process.env.KNOWLEDGE_CENTER_ADMIN_USERNAME || 'admin',
  adminPassword: process.env.KNOWLEDGE_CENTER_ADMIN_PASSWORD || 'admin',
  knowledgeEditorUsername: process.env.KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_USERNAME || 'test',
  knowledgeEditorPassword: process.env.KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_PASSWORD || 'test',
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
