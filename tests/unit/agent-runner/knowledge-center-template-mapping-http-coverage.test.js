const http = require('node:http');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const { createTemplateStore } = require('../../../packages/agent-runner-core/lib/template-store');
const { createTemplateMappingService } = require('../../../packages/agent-runner-core/lib/template-mapping-service');

function memory(initial) {
  let state = structuredClone(initial);
  return {
    read: () => structuredClone(state),
    transaction(fn) { const next = structuredClone(state); const value = fn(next); state = next; return structuredClone(value); },
  };
}

describe('模板映射 HTTP 路由边界', () => {
  let server;
  let auth;
  let base;
  let service;
  let catalog;
  let otherCatalog;

  async function request(route, options = {}) {
    const response = await fetch(`${base}${route}`, {
      ...options,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      headers: { ...(options.body === undefined ? {} : { 'content-type': 'application/json' }), ...(options.headers || {}) },
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  beforeAll(async () => {
    const root = path.resolve(__dirname, '../../..');
    auth = http.createServer((req, res) => {
      const role = String(req.headers.cookie || '');
      const actions = role === 'manage' ? ['template:read', 'template:manage'] : role === 'edit' ? ['template:read', 'template:edit'] : role === 'read' ? ['template:read'] : [];
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ content: { allowedActions: actions, user: { id: role || 'anonymous', visibleHandbookIds: role === 'limited' ? ['OTHER'] : role === 'manage' ? ['HB-1', 'HB-2'] : ['HB-1'] } } }));
    });
    await new Promise(resolve => auth.listen(0, '127.0.0.1', resolve));
    const templateStore = createTemplateStore({ store: memory({ schemaVersion: 1, templates: [], audits: [] }) });
    templateStore.create({ id: 'tpl-sql', name: 'SQL 模板', type: 'SQL', content: '# SQL' }, { user: { id: 'seed' } });
    service = createTemplateMappingService({
      store: memory({ version: 1, rules: [], batches: [], effective: {}, audits: [] }),
      templateStore,
      analyzeAI: async () => ({ templateId: '', reason: '未匹配' }),
      config: { ai: { enabled: false, prompt: '', maxEvidenceChars: 80, maxConcurrency: 2 } },
    });
    catalog = { outlineVersionId: 'outline-v1', documents: [
      { id: 'doc-1', name: 'SQL 章节', parentId: 'group' },
      { id: 'doc-2', name: '性能章节', parentId: 'group' },
    ], directory: { nodes: [{ id: 'group', title: '数据库手册', kind: 'chapter' }] } };
    otherCatalog = { ...catalog, documents: [{ id: 'other-doc', name: 'SQL 章节', parentId: 'group' }] };
    const handler = createKnowledgeCenterHandler({
      config: {
        KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, KNOWLEDGE_CENTER_ENTRY: 'index.html',
        OUTLINE_TEMPLATE_PATH: path.join(root, 'knowledge/outlines/大纲模板.xlsx'), OUTLINE_SAMPLE_PATH: path.join(root, 'knowledge/outlines/基本数据库管理手册大纲示例.xlsx'),
        PINGCODE_PREFIX: '/pingcode', PINGCODE_ROOT: root, DOCUMENT_API_HOST: '127.0.0.1', DOCUMENT_API_PORT: 1,
        PINGCODE_API_HOST: '127.0.0.1', PINGCODE_API_PORT: 1, AUTH_API_HOST: '127.0.0.1', AUTH_API_PORT: auth.address().port,
        PLATFORM_CONTEXT_TIMEOUT_MS: 1000, GITLAB_CONFIG_PATH: path.join(root, 'runtime/test-results/template-map-http-gitlab.json'), GITLAB_DOCUMENT_TYPES_PATH: path.join(root, 'runtime/test-results/template-map-http-types.json'),
      },
      stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [{ handbookId: 'HB-1' }, { handbookId: 'HB-2' }] }) }, templateStore },
      templateMappingService: service,
      documentTaskCatalog: async handbookId => handbookId === 'HB-2' ? otherCatalog : catalog,
      sendFile(_file, res) { res.writeHead(404); res.end(); }, proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
    });
    server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    for (const item of [server, auth]) if (item) await new Promise(resolve => item.close(resolve));
  });

  test('规则读取、权限、方法门禁和预览保存版本冲突', async () => {
    expect((await request('/knowledge-center/api/templates/mapping-rules', { headers: { cookie: 'read' } })).status).toBe(200);
    expect((await request('/knowledge-center/api/templates/mapping-rules', { headers: { cookie: 'edit' } })).status).toBe(200);
    expect((await request('/knowledge-center/api/templates/mapping-rules', { method: 'DELETE', headers: { cookie: 'manage' } })).status).toBe(405);
    const preview = await request('/knowledge-center/api/templates/mapping-rules/preview', { method: 'POST', headers: { cookie: 'manage' }, body: { handbookId: 'HB-1', baseVersion: 1, rules: [] } });
    expect(preview.status).toBe(200);
    expect(preview.body.data.outlineVersionId).toBe('outline-v1');
    const stale = await request('/knowledge-center/api/templates/mapping-rules', { method: 'PUT', headers: { cookie: 'manage' }, body: { handbookId: 'HB-1', candidateDigest: 'stale', outlineVersionId: 'outline-v1', baseVersion: 1, rules: [] } });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('MAPPING_PREVIEW_STALE');
    const saved = await request('/knowledge-center/api/templates/mapping-rules', { method: 'PUT', headers: { cookie: 'manage' }, body: { handbookId: 'HB-1', candidateDigest: preview.body.data.candidateDigest, outlineVersionId: 'outline-v1', baseVersion: 1, rules: [] } });
    expect(saved.status).toBe(200);
    expect(saved.body.data.version).toBe(2);
    const globalRules = [{ id: 'global-sql', priority: 10, templateId: 'tpl-sql', when: { titleContains: 'SQL' } }];
    const globalPreview = await request('/knowledge-center/api/templates/mapping-rules/preview', { method: 'POST', headers: { cookie: 'manage' }, body: { handbookId: 'HB-1', baseVersion: 2, rules: globalRules } });
    expect(globalPreview.status).toBe(200);
    expect(globalPreview.body.data.handbookChanges).toEqual(expect.arrayContaining([
      expect.objectContaining({ handbookId: 'HB-2', changed: 1 }),
    ]));
    const globalSaved = await request('/knowledge-center/api/templates/mapping-rules', { method: 'PUT', headers: { cookie: 'manage' }, body: { handbookId: 'HB-1', candidateDigest: globalPreview.body.data.candidateDigest, outlineVersionId: 'outline-v1', baseVersion: 2, rules: globalRules } });
    expect(globalSaved.status).toBe(200);
    const secondPreview = await request('/knowledge-center/api/templates/mapping-rules/preview', { method: 'POST', headers: { cookie: 'manage' }, body: { handbookId: 'HB-1', baseVersion: 3, rules: globalRules } });
    otherCatalog = { ...otherCatalog, documents: [...otherCatalog.documents, { id: 'other-new', name: 'SQL 新文档', parentId: 'group' }] };
    const changedElsewhere = await request('/knowledge-center/api/templates/mapping-rules', { method: 'PUT', headers: { cookie: 'manage' }, body: { handbookId: 'HB-1', candidateDigest: secondPreview.body.data.candidateDigest, outlineVersionId: 'outline-v1', baseVersion: 3, rules: globalRules } });
    expect(changedElsewhere.status).toBe(409);
    expect(changedElsewhere.body.error.code).toBe('MAPPING_PREVIEW_STALE');
  });

  test('映射列表、越权和批次分析取消', async () => {
    expect((await request('/knowledge-center/api/templates/mappings', { headers: { cookie: 'read' } })).status).toBe(400);
    expect((await request('/knowledge-center/api/templates/mappings?handbookId=OTHER', { headers: { cookie: 'limited' } })).status).toBe(403);
    expect((await request('/knowledge-center/api/templates/mappings?handbookId=HB-1&limit=0&cursor=-2', { headers: { cookie: 'read' } })).status).toBe(200);
    const started = await request('/knowledge-center/api/templates/mappings/analyze', { method: 'POST', headers: { cookie: 'manage' }, body: { handbookId: 'HB-1' } });
    expect(started.status).toBe(202);
    const batchId = started.body.data.id;
    expect((await request(`/knowledge-center/api/templates/mappings/${batchId}`, { headers: { cookie: 'read' } })).status).toBe(200);
    expect((await request(`/knowledge-center/api/templates/mappings/${batchId}/cancel`, { method: 'POST', headers: { cookie: 'manage' }, body: {} })).status).toBe(200);
    expect((await request(`/knowledge-center/api/templates/mappings/missing/cancel`, { method: 'POST', headers: { cookie: 'manage' }, body: {} })).status).toBe(404);
  });

  test('决策接口处理缺失批次、越权和无效目录', async () => {
    const missing = await request('/knowledge-center/api/templates/mappings/decisions', { method: 'POST', headers: { cookie: 'manage' }, body: { batchId: 'missing', documentId: 'doc-1', templateId: 'tpl-sql' } });
    expect(missing.status).toBe(403);
    const started = service.start('HB-1', catalog, 'seed');
    const denied = await request('/knowledge-center/api/templates/mappings/decisions', { method: 'POST', headers: { cookie: 'limited' }, body: { batchId: started.id, documentId: 'doc-1', templateId: 'tpl-sql' } });
    expect(denied.status).toBe(403);
    const invalid = await request('/knowledge-center/api/templates/mappings/decisions', { method: 'POST', headers: { cookie: 'manage' }, body: { batchId: started.id, documentId: 'missing', templateId: 'tpl-sql' } });
    expect(invalid.status).toBe(403);
  });
});
