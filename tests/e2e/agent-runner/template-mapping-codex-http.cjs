// Run: NODE_PATH=runtime/agent-runner/node_modules node tests/e2e/agent-runner/template-mapping-codex-http.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createTemplateStore } = require('../../../packages/agent-runner-core/lib/template-store');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const root = path.resolve(__dirname, '../../..');
const web = path.join(root, 'apps/knowledge-center-web/frontend/knowledge-center');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => server.close(resolve));
const session = { authenticated: true, user: { id: 'codex-http', visibleHandbookIds: ['HB-CODEX'] }, visibleHandbookIds: ['HB-CODEX'], allowedActions: ['template:read', 'template:edit', 'template:manage'], visibleModules: ['templates'], roles: [] };
function memory(initial) { let value = structuredClone(initial); return { read: () => structuredClone(value), transaction(fn) { const next = structuredClone(value); const result = fn(next); value = next; return structuredClone(result); } }; }
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'template-codex-http-'));
  const oldFile = process.env.TEMPLATE_MAPPING_STORE_FILE;
  const oldMode = process.env.KNOWLEDGE_STORAGE_MODE;
  process.env.TEMPLATE_MAPPING_STORE_FILE = path.join(tmp, 'mappings.json');
  process.env.KNOWLEDGE_STORAGE_MODE = 'file';
  const auth = http.createServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ content: session })); });
  let server;
  try {
    await listen(auth);
    const templateStore = createTemplateStore({ store: memory({ schemaVersion: 1, templates: [], audits: [] }) });
    const perf = templateStore.create({ name: '性能模板', type: '性能', description: '性能诊断', content: '# 性能' }, { user: session.user });
    let calls = 0;
    const handler = createKnowledgeCenterHandler({
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: web, KNOWLEDGE_CENTER_ENTRY: 'knowledge-center-management.html', OUTLINE_TEMPLATE_PATH: path.join(root, 'knowledge/outlines/大纲模板.xlsx'), OUTLINE_SAMPLE_PATH: path.join(root, 'knowledge/outlines/基本数据库管理手册大纲示例.xlsx'), AUTH_API_HOST: '127.0.0.1', AUTH_API_PORT: auth.address().port, PLATFORM_CONTEXT_TIMEOUT_MS: 1000 },
      stores: { templateStore, knowledgeAssetsStore: { read: () => ({ handbooks: [{ handbookId: 'HB-CODEX', name: '隔离手册' }] }) } },
      documentTaskCatalog: async () => ({ outlineVersionId: 'v1', documents: [{ id: 'doc-1', name: '性能诊断', parentId: 'chapter' }], directory: { nodes: [{ id: 'chapter', title: '性能', kind: 'chapter' }] } }),
      agentGovernance: { available: async () => ({ defaultSelection: { serviceId: 'test', model: 'test', configVersion: 'v1' } }), resolve: () => ({ config: { executor: 'codex', model: 'test' } }) },
      codexRunner: { async run() { calls += 1; return { content: JSON.stringify({ markdown: JSON.stringify({ templateId: perf.id, reason: '标题和栏目均匹配性能' }), provenance: [] }) }; } },
      sendFile() {}, proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
    });
    server = http.createServer((req, res) => handler(req, res));
    await listen(server);
    const base = 'http://127.0.0.1:' + server.address().port + '/knowledge-center/api/templates';
    const start = await fetch(base + '/mappings/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handbookId: 'HB-CODEX' }) });
    assert.equal(start.status, 202);
    const id = (await start.json()).data.id;
    let batch;
    for (let i = 0; i < 40; i += 1) {
      const response = await fetch(base + '/mappings/' + id);
      assert.equal(response.status, 200);
      batch = (await response.json()).data;
      if (batch.status === 'completed') break;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.equal(batch.status, 'completed');
    assert.equal(calls, 1);
    assert.equal(batch.documents[0].ai.templateId, perf.id);
    assert.match(batch.documents[0].ai.reason, /性能/);
    console.log('PASS: real mapping HTTP handler parses Codex markdown envelope');
  } finally {
    if (server) await close(server);
    await close(auth);
    fs.rmSync(tmp, { recursive: true, force: true });
    if (oldFile === undefined) delete process.env.TEMPLATE_MAPPING_STORE_FILE; else process.env.TEMPLATE_MAPPING_STORE_FILE = oldFile;
    if (oldMode === undefined) delete process.env.KNOWLEDGE_STORAGE_MODE; else process.env.KNOWLEDGE_STORAGE_MODE = oldMode;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
