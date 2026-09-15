const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const { createTemplateStore } = require('../../../packages/agent-runner-core/lib/template-store');

// Real HTTP route and domain implementation. Authentication and aggregate
// persistence are deliberately isolated doubles, not JDBC acceptance evidence.
async function setup(t) {
  const auth = http.createServer((req, res) => {
    const role = req.headers.cookie;
    if (!role) { res.writeHead(401); res.end('{}'); return; }
    const allowedActions = role === 'edit' ? ['template:read', 'template:edit']
      : role === 'read' ? ['template:read'] : role === 'knowledge' ? ['knowledge:write'] : [];
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ content: { allowedActions, roles: role === 'admin' ? ['PLATFORM_ADMIN'] : [], user: { id: 'p2-test-user' } } }));
  });
  await new Promise(resolve => auth.listen(0, '127.0.0.1', resolve));
  let state = { schemaVersion: 1, templates: [], audits: [] };
  const store = {
    read: () => structuredClone(state),
    transaction(mutator) {
      const draft = structuredClone(state);
      const result = mutator(draft);
      state = draft;
      return structuredClone(result);
    },
  };
  const handler = createKnowledgeCenterHandler({
    config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: '/tmp', KNOWLEDGE_CENTER_ENTRY: 'index.html', PINGCODE_PREFIX: '/pingcode', PINGCODE_ROOT: '/tmp', DOCUMENT_API_HOST: '127.0.0.1', DOCUMENT_API_PORT: 1, PINGCODE_API_HOST: '127.0.0.1', PINGCODE_API_PORT: 1, PLATFORM_CONTEXT_TIMEOUT_MS: 1000, AUTH_API_HOST: '127.0.0.1', AUTH_API_PORT: auth.address().port, GITLAB_CONFIG_PATH: '/tmp/not-used', GITLAB_DOCUMENT_TYPES_PATH: '/tmp/not-used' },
    stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [] }), write() {} }, templateStore: createTemplateStore({ store }) },
    sendFile(_path, res) { res.writeHead(404); res.end(); }, proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
  });
  const server = http.createServer((req, res) => handler(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await Promise.all([server, auth].map(service => new Promise(resolve => {
      service.close(resolve);
      service.closeIdleConnections();
    })));
  });
  async function request(suffix = '', { role = 'edit', method = 'GET', data, form } = {}) {
    const headers = role ? { cookie: role } : {};
    if (data !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(`http://127.0.0.1:${server.address().port}/knowledge-center/api/templates${suffix}`, {
      method, headers, body: form || (data !== undefined ? JSON.stringify(data) : undefined),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }
  async function create(id = 'p2-template', extra = {}) {
    const response = await request('', { method: 'POST', data: { id, name: '原模板', type: '通用基础', description: '原描述', content: '# 原始正文\n\n参数说明。', ...extra } });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body.data;
  }
  return { request, create, snapshot: store.read };
}

function upload(filename, bytes, fields = {}) {
  const form = new FormData();
  form.append('file', new Blob([bytes]), filename);
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return form;
}

function docxFixture() {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'));
  zip.addFile('_rels/.rels', Buffer.from('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'));
  zip.addFile('word/document.xml', Buffer.from('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>DOCX 模板参数说明</w:t></w:r></w:p></w:body></w:document>'));
  return zip.toBuffer();
}

test('P2 upload Markdown immediately persists a readable first version', async t => {
  const s = await setup(t);
  let expected = 0;
  for (const filename of ['01-通用基础模板.md', 'template.markdown']) {
    const r = await s.request('/import', { method: 'POST', form: upload(filename, '# 上传正文\n\n参数范围', { name: '上传模板', type: '操作指南', description: '上传来源' }) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.templates?.length, 1);
    assert.equal(r.body.data.templates[0].name, '上传模板');
    assert.equal(r.body.data.templates[0].current.sourceType, 'upload');
    assert.equal(r.body.data.templates[0].current.sourceFilename, filename);
    assert.equal(r.body.data.templates[0].current.content, '# 上传正文\n\n参数范围');
    assert.equal(s.snapshot().templates.length, ++expected);
    const detail = await s.request(`/${r.body.data.templates[0].id}`);
    assert.equal(detail.body.data.current.content, '# 上传正文\n\n参数范围');
  }
});

test('P2 batch Markdown keeps valid drafts when one file is rejected', async t => {
  const s = await setup(t); const form = new FormData();
  form.append('files', new Blob(['# 合法']), 'ok.md'); form.append('files', new Blob(['pdf']), 'bad.pdf');
  const r = await s.request('/import', { method: 'POST', form });
  assert.equal(r.status, 200); assert.equal(r.body.data.drafts.length, 2);
  assert.equal(r.body.data.drafts.filter(item => item.draft).length, 1);
  assert.equal(r.body.data.drafts.find(item => item.error)?.error.code, 'TEMPLATE_FORMAT_UNSUPPORTED');
  assert.equal(s.snapshot().templates.length, 1);
});

test('P2 preserves UTF-8 Chinese filename on import', async t => {
  const s = await setup(t); const form = new FormData();
  form.append('files', new Blob(['# 中文文件名']), '01-通用基础模板.md');
  const r = await s.request('/import', { method: 'POST', form });
  assert.equal(r.status, 200); assert.equal(r.body.data.templates[0].sourceFilename, '01-通用基础模板.md');
});

test('P2 non-Markdown formats are rejected without persistence', async t => {
  const s = await setup(t);
  const r = await s.request('/import', { method: 'POST', form: upload('template.docx', docxFixture()) });
  assert.equal(r.status, 415); assert.equal(r.body.error.code, 'TEMPLATE_FORMAT_UNSUPPORTED');
  const broken = await s.request('/import', { method: 'POST', form: upload('broken.txt', 'not markdown') });
  assert.equal(broken.status, 415); assert.equal(broken.body.error.code, 'TEMPLATE_FORMAT_UNSUPPORTED');
  assert.equal(s.snapshot().templates.length, 0);
});

test('P2 upload authorization precedes parsing and rejects invalid/unsafe input', async t => {
  const s = await setup(t);
  for (const [role, status] of [[null, 401], ['read', 403], ['knowledge', 403]]) {
    const r = await s.request('/import', { method: 'POST', role, data: { malformed: true } });
    assert.equal(r.status, status);
  }
  for (const [filename, bytes, expected] of [
    ['template.pdf', '%PDF-1.7', 415],
    ['template.txt', Buffer.from([0xff, 0xfe]), 415],
    ['empty.md', '   ', 422],
    ['secret.md', '{"password":"sample-secret-value"}', 422],
    ['large.md', Buffer.alloc(10 * 1024 * 1024 + 1, 'a'), 413],
  ]) {
    const r = await s.request('/import', { method: 'POST', form: upload(filename, bytes) });
    assert.equal(r.status, expected, `${filename}: ${JSON.stringify(r.body)}`);
  }
  const missing = await s.request('/import', { method: 'POST', form: new FormData() });
  assert.equal(missing.status, 400);
  assert.deepEqual(s.snapshot(), { schemaVersion: 1, templates: [], audits: [] });
});

test('P2 upload -> create -> history -> restore draft -> save is immutable', async t => {
  const s = await setup(t);
  const imported = await s.request('/import', { method: 'POST', form: upload('original.md', '# 原始内容') });
  const importedTemplate = imported.body.data.templates[0];
  assert.equal(imported.status, 200); assert.equal(importedTemplate.current.sourceFilename, 'original.md');
  const id = importedTemplate.id;
  const v1 = await s.request(`/${id}/versions/1`, { role: 'read' });
  assert.equal(v1.status, 200);
  const saved = await s.request(`/${id}/save`, { method: 'POST', data: { baseVersion: 1, content: '# 第二版' } });
  assert.equal(saved.status, 200);
  const beforeRestore = s.snapshot();
  const draft = await s.request(`/${id}/restore-draft`, { method: 'POST', data: { version: 1 } });
  assert.equal(draft.status, 200);
  assert.equal(draft.body.data.baseVersion, 2);
  assert.equal(draft.body.data.content, '# 原始内容');
  assert.deepEqual(s.snapshot(), beforeRestore);
  const restored = await s.request(`/${id}/save`, { method: 'POST', data: draft.body.data });
  assert.equal(restored.status, 200, JSON.stringify(restored.body));
  assert.equal(restored.body.data.currentVersion, 3);
  assert.equal(restored.body.data.current.contentHash, v1.body.data.contentHash);
  assert.deepEqual((await s.request(`/${id}/versions/1`)).body, v1.body);
  assert.equal((await s.request(`/${id}/versions`)).body.data.length, 3);
});

test('P2 metadata PATCH versions, preserves body, rejects stale updates', async t => {
  const s = await setup(t);
  const original = await s.create();
  const before = (await s.request('/p2-template/versions/1')).body.data;
  const updated = await s.request('/p2-template', { method: 'PATCH', data: { baseVersion: 1, name: '更新名称', type: '兼容性', description: '更新描述' } });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal(updated.body.data.currentVersion, 2);
  assert.equal(updated.body.data.name, '更新名称');
  assert.equal(updated.body.data.type, '兼容性');
  assert.equal(updated.body.data.description, '更新描述');
  assert.equal(updated.body.data.current.content, original.current.content);
  assert.deepEqual((await s.request('/p2-template/versions/1')).body.data, before);
  const baseline = s.snapshot();
  const stale = await s.request('/p2-template', { method: 'PATCH', data: { baseVersion: 1, name: '过期名称' } });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, 'TEMPLATE_VERSION_CONFLICT');
  assert.deepEqual(s.snapshot(), baseline);
});

test('P2 metadata and content save atomically; invalid save retains metadata', async t => {
  const s = await setup(t);
  await s.create();
  const r = await s.request('/p2-template/save', { method: 'POST', data: { baseVersion: 1, name: '正文元数据同步', type: 'SQL', description: '一起保存', content: '# 同步正文' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.name, '正文元数据同步');
  assert.equal(r.body.data.current.content, '# 同步正文');
  const baseline = s.snapshot();
  const invalid = await s.request('/p2-template/save', { method: 'POST', data: { baseVersion: 2, name: '不得保存', content: '' } });
  assert.equal(invalid.status, 422);
  assert.deepEqual(s.snapshot(), baseline);
});

test('P2 list filters combine and logical deletion preserves readable history', async t => {
  const s = await setup(t);
  await s.create('active', { name: 'SQL 模板', type: 'SQL' });
  await s.create('disabled', { name: 'SQL 停用', type: 'SQL' });
  await s.create('other', { name: '其他模板', type: '运维' });
  assert.equal((await s.request('/disabled/disable', { method: 'POST', role: 'admin' })).status, 200);
  const filtered = await s.request('?q=SQL&type=SQL&status=active', { role: 'read' });
  assert.deepEqual(filtered.body.data.map(item => item.id), ['active']);
  const before = (await s.request('/active/versions/1')).body.data;
  const denied = await s.request('/active', { method: 'DELETE', role: 'edit' });
  assert.equal(denied.status, 403);
  const removed = await s.request('/active', { method: 'DELETE', role: 'admin' });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.status, 'deleted');
  assert.deepEqual((await s.request('/active/versions/1', { role: 'read' })).body.data, before);
  assert.deepEqual((await s.request('?status=deleted')).body.data.map(item => item.id), ['active']);
  assert.equal(s.snapshot().templates.length, 3);
});

test('P2 detail/history/restore/metadata enforce independent permissions', async t => {
  const s = await setup(t);
  await s.create();
  const baseline = s.snapshot();
  for (const suffix of ['/p2-template', '/p2-template/versions', '/p2-template/versions/1']) {
    assert.equal((await s.request(suffix, { role: 'knowledge' })).status, 403);
    assert.equal((await s.request(suffix, { role: 'read' })).status, 200);
  }
  assert.equal((await s.request('/p2-template', { method: 'PATCH', role: 'read', data: { baseVersion: 1, name: '越权' } })).status, 403);
  assert.equal((await s.request('/p2-template/restore-draft', { method: 'POST', role: 'read', data: { version: 1 } })).status, 403);
  assert.deepEqual(s.snapshot(), baseline);
  assert.equal((await s.request('/p2-template/unknown', { role: 'read' })).status, 405);
  assert.equal((await s.request('/p2-template/versions/999', { role: 'read' })).status, 404);
});
