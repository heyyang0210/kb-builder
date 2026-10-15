const fs = require('fs');
const path = require('path');
const express = require('express');

const apiSource = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js'), 'utf8').replace(/^export /gm, '');
function loadWith(payloads) {
  const fetch = jest.fn(async url => {
    const payload = payloads[url];
    if (!payload) throw new Error(`未预期的请求：${url}`);
    return { status: payload.status || 200, ok: !payload.status || payload.status < 400, json: async () => payload.body };
  });
  const load = new Function('fetch', 'window', 'CustomEvent', `${apiSource}\nreturn loadOutlineData;`)(fetch, { dispatchEvent() {} }, function () {});
  return { load, fetch };
}
const catalog = '/knowledge-center/api/outline/catalog';
const list = '/knowledge-center/api/outline/governance/list';
const handbooks = '/knowledge-center/api/assets/handbooks?page=1&pageSize=100';
const detail = id => `/knowledge-center/api/outline/governance/${id}?view=compact`;
const ok = data => ({ body: { success: true, data } });

test('当前版只读 catalog 和精简详情，不读全量列表与手册', async () => {
  const { load, fetch } = loadWith({ [catalog]: ok({ items: [{ id: 'published', handbookId: 'DB-004', name: 'SQL参考手册' }] }), [detail('published')]: ok({ id: 'published', nodes: [] }) });
  expect(await load('DB-004')).toMatchObject({ status: 'ok', selectedId: 'published', detail: { id: 'published' } });
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([catalog, detail('published')]);
});

test('指定候选版不被当前版覆盖', async () => {
  const { load, fetch } = loadWith({ [list]: ok([{ id: 'published', handbookId: 'DB-004', state: 'published' }, { id: 'candidate', handbookId: 'DB-004', state: 'draft' }]), [handbooks]: ok({ items: [{ handbookId: 'DB-004' }] }), [detail('candidate')]: ok({ id: 'candidate', outlineStructureVersion: 'v2' }) });
  expect(await load('DB-004', 'candidate')).toMatchObject({ status: 'ok', selectedId: 'candidate', detail: { outlineStructureVersion: 'v2' } });
  expect(fetch.mock.calls.map(([url]) => url)).not.toContain(catalog);
});

test.each([['DB-002', 'empty'], ['missing', 'not_found']])('catalog 无记录时区分空手册与不存在：%s', async (id, status) => {
  const { load } = loadWith({ [catalog]: ok({ items: [] }), [list]: ok([]), [handbooks]: ok({ items: [{ handbookId: 'DB-002', name: '概念手册' }] }) });
  expect(await load(id)).toMatchObject({ status });
});

test('尚无发布版的手册可回退显示候选', async () => {
  const { load } = loadWith({ [catalog]: ok({ items: [] }), [list]: ok([{ id: 'candidate', handbookId: 'DB-004', state: 'draft' }]), [handbooks]: ok({ items: [{ handbookId: 'DB-004' }] }), [detail('candidate')]: ok({ id: 'candidate' }) });
  expect(await load('DB-004')).toMatchObject({ status: 'ok', selectedId: 'candidate' });
});

test.each([[403, 'forbidden'], [503, 'unavailable']])('真实 %s 失败不能转换成不存在或空数据', async (httpStatus, status) => {
  const failed = { status: httpStatus, body: { success: false, error: { code: 'OUTLINE_SERVICE_UNAVAILABLE' } } };
  expect(await loadWith({ [catalog]: failed }).load('DB-004')).toMatchObject({ status });
  expect(await loadWith({ [catalog]: ok({ items: [{ id: 'published', handbookId: 'DB-004' }] }), [detail('published')]: failed }).load('DB-004')).toMatchObject({ status });
});

describe('真实异步 HTTP 详情契约（隔离 Storage 替身，不连接数据库）', () => {
  let storage, worker, base, releaseMetadata;
  const saved = {};
  const nodes = [{ id: 'doc', title: '页面.md', kind: 'document', parentId: null, level: 1, order: 1 }];
  const governance = { manualId: 'DB-004', state: 'draft', editVersion: 3, nodes, assignments: [], effectiveDocumentAssignments: [], techDomains: [], tasks: [] };
  beforeAll(async () => {
    const app = express();
    app.get('/v1/domain/outlines', async (_req, res) => {
      if (releaseMetadata) { releaseMetadata.received(); await releaseMetadata.promise; }
      res.json({ success: true, data: { outlines: [{ id: 'candidate', handbookId: 'DB-004', name: 'SQL参考手册', state: 'draft', outlineStructureVersion: 'v2', editVersion: 3, content: { schemaVersion: 2, nodes } }] } });
    });
    app.get('/v1/domain/outlines/:id/governance', (req, res) => req.params.id === 'candidate' ? res.json({ success: true, data: governance }) : res.status(404).json({ success: false, error: { code: 'OUTLINE_NOT_FOUND' } }));
    storage = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    for (const key of ['KNOWLEDGE_STORAGE_MODE', 'YASDB_STORAGE_URL']) saved[key] = process.env[key];
    process.env.KNOWLEDGE_STORAGE_MODE = 'database';
    process.env.YASDB_STORAGE_URL = `http://127.0.0.1:${storage.address().port}`;
    jest.resetModules();
    const gateway = express();
    gateway.get('/health', (_req, res) => res.json({ ok: true }));
    gateway.use('/api/outline', require('../../../packages/agent-runner-core/routes/outline'));
    worker = await new Promise(resolve => { const instance = gateway.listen(0, '127.0.0.1', () => resolve(instance)); });
    base = `http://127.0.0.1:${worker.address().port}`;
  });
  afterAll(async () => {
    if (releaseMetadata) releaseMetadata.resolve();
    await Promise.all([storage, worker].filter(Boolean).map(server => new Promise(resolve => server.close(resolve))));
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  });
  test('精简响应保留候选元信息和节点、分工，不含重复字段；默认响应兼容', async () => {
    const compact = await (await fetch(`${base}/api/outline/governance/candidate?view=compact`)).json();
    expect(compact).toMatchObject({ success: true, data: { id: 'candidate', outlineStructureVersion: 'v2', nodes, governance: { editVersion: 3, tasks: [] } } });
    expect(compact.data.governance.nodes).toBeUndefined();
    expect(compact.data.responsibility).toBeUndefined();
    expect(compact.data.impact).toBeUndefined();
    const full = await (await fetch(`${base}/api/outline/governance/candidate`)).json();
    expect(full.data.governance).toEqual(governance);
    expect(full.data.responsibility).toEqual(governance);
    expect(full.data.impact).toBeDefined();
    expect((await fetch(`${base}/api/outline/governance/missing?view=compact`)).status).toBe(404);
  });
  test('Storage 未响应时 Worker 仍可响应健康请求', async () => {
    let resolve, received;
    const started = new Promise(r => { received = r; });
    releaseMetadata = { promise: new Promise(r => { resolve = r; }), resolve: () => resolve(), received };
    const pending = fetch(`${base}/api/outline/governance/candidate?view=compact`);
    try {
      await started;
      expect((await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) })).ok).toBe(true);
    } finally { releaseMetadata.resolve(); releaseMetadata = null; }
    expect((await pending).ok).toBe(true);
  });
});
