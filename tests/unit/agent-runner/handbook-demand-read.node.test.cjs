const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const { DatabaseAggregateStore } = require('../../../packages/agent-runner-core/lib/aggregate-store');
const { createHandbookProductionService } = require('../../../packages/agent-runner-core/lib/handbook-production-service');
const editor = { user: { roles: ['PLATFORM_ADMIN'] } };
const context = { handbookId: 'HB', outlineVersionId: 'v1', branch: 'main', documentId: 'doc-1' };

test('单篇草稿真实 HTTP 仅请求上下文投影，不调用全局 read；权限先于存储', async () => {
  const requests = [];
  const revision = { revisionId: 'r1', markdown: 'current' };
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ success: true, payload: { draftId: 'd1', context,
      currentRevisionId: 'r1', editVersion: 1, revisions: [revision] } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const store = new DatabaseAggregateStore('handbook-production', 'state', {}, { baseUrl: `http://127.0.0.1:${server.address().port}` });
  store.read = () => { throw new Error('全局读取被禁止'); };
  const service = createHandbookProductionService({ store });
  try {
    await assert.rejects(service.getDraftAsync(context, {}), { status: 403 });
    assert.equal(requests.length, 0);
    const result = await service.getDraftAsync(context, editor);
    assert.equal(result.exists, true); assert.equal(result.draft.editVersion, 1); assert.deepEqual(result.draft.revision, revision);
    const url = new URL(requests[0], 'http://localhost');
    assert.equal(url.pathname, '/v1/records/handbook-production/state');
    assert.equal(url.searchParams.get('draftKey'), 'HB|v1|main|doc-1');
  } finally {
    service.stopRecoveryScheduler();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('旧版 Storage 忽略 draftKey 时从聚合响应选择当前草稿，缺失时返回空', async () => {
  const draft = { draftId: 'd1', context, currentRevisionId: 'r1', revisions: [{ revisionId: 'r1', markdown: '正文' }] };
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ success: true, payload: { schemaVersion: 1, drafts: { 'HB|v1|main|doc-1': draft }, aiJobs: { other: {} } } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const store = new DatabaseAggregateStore('handbook-production', 'state', {}, { baseUrl: `http://127.0.0.1:${server.address().port}` });
    assert.deepEqual(await store.readDraftAsync('HB|v1|main|doc-1'), draft);
    assert.equal(await store.readDraftAsync('HB|v1|main|missing'), null);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('Java 当前草稿投影保留最新正文，拒绝迟到快照覆盖并清除已删除状态', () => {
  const root = path.resolve(__dirname, '../../..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draft-projection-'));
  try {
    const compiled = spawnSync('java', ['-m', 'jdk.compiler/com.sun.tools.javac.Main', '-d', dir,
      path.join(root, 'apps/yashandb-storage/src/DraftReadProjection.java'),
      path.join(__dirname, 'fixtures/DraftReadProjectionCheck.java')], { encoding: 'utf8' });
    assert.equal(compiled.status, 0, compiled.stderr);
    const checked = spawnSync('java', ['-cp', dir, 'DraftReadProjectionCheck'], { encoding: 'utf8' });
    assert.equal(checked.status, 0, checked.stderr);
    assert.match(checked.stdout, /PASS:/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('目录先于慢草稿和仓库显示；切换文档后迟到响应不覆盖新工作区', async () => {
  const vm = require('node:vm');
  const source = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/app.js'), 'utf8');
  const workspaceSource = source.slice(source.indexOf('let handbookWorkspaceSequence ='), source.indexOf('async function loadIncrementalWorkspace('));
  let releaseMapping;
  const mapping = new Promise(resolve => { releaseMapping = resolve; });
  let route = { handbookId: 'HB', documentId: 'doc-1', branch: 'main' };
  const ui = { draftLoadState: {}, serverDrafts: {} };
  const renders = [];
  let draftCalls = 0;
  const appState = { activeView: 'production' };
  const sandbox = { appState, handbookUi: () => ui, collectDocuments: items => items, outlineNodes: outline => outline.nodes || [],
    productionRouteState: () => route,
    render: () => renders.push(appState.incrementalProjection.status),
    loadOutlineData: async () => ({ status: 'ok', detail: { nodes: [{ id: 'doc-1', kind: 'document' }, { id: 'doc-2', kind: 'document' }] } }),
    loadTemplates: async () => ({ data: [] }),
    loadHandbookRepositoryMapping: () => mapping,
    loadSharedHandbookDraft: async () => { draftCalls++; },
    loadHandbookProductionRepository: async () => ({}),
    repositoryStatusFor: () => 'failed',
  };
  vm.createContext(sandbox);
  vm.runInContext(workspaceSource + '\nthis.loadWorkspace = loadHandbookWorkspace;', sandbox);
  const loading = sandbox.loadWorkspace(route, new URLSearchParams());
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(renders, ['loading', 'ok']);
  assert.equal(draftCalls, 0);
  assert.equal(ui.draftLoadState['doc-1'], 'loading');
  route = { ...route, documentId: 'doc-2' };
  const sentinel = { status: 'ok', selected: 'new-route' };
  appState.incrementalProjection = sentinel;
  releaseMapping({ defaultBranch: 'main' });
  await loading;
  assert.equal(appState.incrementalProjection, sentinel);
  assert.equal(draftCalls, 0);
});


test('草稿读取失败不会降级为空草稿或调用全局读取', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: { code: 'DRAFT_PROJECTION_REBUILDING', message: 'retry' } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const store = new DatabaseAggregateStore('handbook-production', 'state', {}, { baseUrl: `http://127.0.0.1:${server.address().port}` });
    store.read = () => { throw Error('forbidden aggregate'); };
    await assert.rejects(store.readDraftAsync('HB|v1|main|doc-1'), { code: 'DRAFT_PROJECTION_REBUILDING', status: 503 });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
