const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../../packages/agent-runner-core/routes/knowledge-center');
const { createHandbookProductionService } = require('../../../../packages/agent-runner-core/lib/handbook-production-service');

const repositoryRoot = path.resolve(__dirname, '../../../..');
const editor = {
  authenticated: true,
  user: { id: 'author-1', displayName: '文档作者', roles: ['KNOWLEDGE_EDITOR'] },
  allowedActions: ['knowledge:read', 'knowledge:write', 'template:read'],
};

function memoryStore(initialState) {
  let state = initialState || { schemaVersion: 1, drafts: {}, attachments: {}, reviewBatches: [], idempotency: {}, audits: [] };
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
  const runtimeRoot = path.join(repositoryRoot, 'runtime/test-results/production-writing');
  fs.mkdirSync(runtimeRoot, { recursive: true });
  const attachmentRoot = fs.mkdtempSync(path.join(runtimeRoot, 'attachments-'));
  const store = options.store || memoryStore();
  // Catalog and execution must resolve the same Agent-scoped configuration.
  const agentGovernance = options.agentGovernance || require('../../../../packages/agent-runner-core/lib/platform-management/agent-governance').createAgentGovernance();
  const fixtureSelection = { serviceId: 'fixture', model: 'fixture', configVersion: 'v1' };
  const fixtureModelGovernance = {
    available: () => ({ options: [fixtureSelection], defaultSelection: fixtureSelection }),
    resolve: selection => ({ selection: selection || fixtureSelection, config: { executor: 'fixture', model: 'fixture' } }),
  };
  const modelGovernance = options.ai?.modelGovernance || (options.ai?.generate ? fixtureModelGovernance : agentGovernance);
  const templateStore = require('../../../../packages/agent-runner-core/lib/template-store').createTemplateStore({ store: memoryStore({ schemaVersion: 1, templates: options.templates || [], audits: [] }) });
  const service = createHandbookProductionService({ store, attachmentRoot, yashanDB: options.yashanDB, contentQuality: options.contentQuality, ai: { modelGovernance, loadMCPConfig: async () => ({}), resolveTemplate: id => templateStore.resolveForGeneration(id), ...options.ai } });
  const authModule = {
    authorize: async () => options.session || editor,
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
      GITLAB_CONFIG_PATH: '/tmp/not-used',
      GITLAB_DOCUMENT_TYPES_PATH: '/tmp/not-used',
      DATABASE_CONNECTION_CONFIG_PATH: '/tmp/not-used',
    },
    stores: {
      templateStore,
      knowledgeAssetsStore: { read: () => ({ handbooks: [{ handbookId: 'HB-1', name: '隔离测试手册' }] }), write() {} },
      manualStatusStore: {},
      brandIconStore: {},
      domainStore: {},
    },
    moduleRegistry: { get: name => name === 'auth' ? authModule : null },
    handbookProductionService: service,
    modelGovernance: options.ai?.generate || options.ai?.modelGovernance ? modelGovernance : undefined,
    agentGovernance,
    codexRunner: options.codexRunner,
    dshRunner: options.dshRunner,
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
      res.end('<!doctype html><html lang="zh"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/knowledge-center/common/tokens.css"><link rel="stylesheet" href="/knowledge-center/common/base.css"><link rel="stylesheet" href="/knowledge-center/common/components.css"><link rel="stylesheet" href="/knowledge-center/styles.css"><link rel="stylesheet" href="/knowledge-center/modules/production/production.css"></head><body><div id="view-root"><button id="open-writing">AI 辅助写作</button><div data-handbook-vditor></div></div></body></html>');
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
  return { request, origin: `http://127.0.0.1:${server.address().port}` };
}

module.exports={setup};
