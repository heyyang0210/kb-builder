const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const rootPath = path.resolve(__dirname, '../../..');
const { createKnowledgeCenterHandler } = require(path.join(rootPath, 'packages/agent-runner-core/routes/knowledge-center'));
const { createCodexRunner } = require(path.join(rootPath, 'packages/agent-runner-core/lib/agent-runtime/codex-runner'));

let root, server, base, mode = 'complete';
const model = () => ({ protocol: 'responses', base_url: 'http://127.0.0.1/isolated', model: mode, api_key: 'isolated-secret', mcp: { services: [
  { id: 'enabled', adapter: 'yashandb', knowledgeBases: [{ id: 'active' }, { id: 'disabled', enabled: false }] },
  { id: 'no-bases', adapter: 'yashandb' },
  { id: 'disabled-service', adapter: 'generic', enabled: false },
] } });
async function request(route, method = 'GET') {
  const response = await fetch(base + route, { method });
  return { status: response.status, body: await response.json() };
}
async function until(id, predicate) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const result = await request(`/agent-runs/${id}`);
    expect(result.status).toBe(200);
    if (predicate(result.body.data)) return result.body.data;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw new Error('公开运行状态未在期限内收敛');
}
beforeAll(async () => {
  const parent = path.join(rootPath, 'runtime/test-results'); fs.mkdirSync(parent, { recursive: true });
  root = fs.mkdtempSync(path.join(parent, 'codex-process-http-'));
  fs.writeFileSync(path.join(root, 'template.xlsx'), 'template'); fs.writeFileSync(path.join(root, 'sample.xlsx'), 'sample');
  const runner = createCodexRunner({ runtimeRoot: path.join(root, 'runs'), workerPath: path.join(__dirname, 'fixtures/codex-process-worker.cjs'), rules: { timeoutMs: 15000, maxEvents: 3, codexVersion: 'isolated' } });
  const handler = createKnowledgeCenterHandler({
    config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, OUTLINE_TEMPLATE_PATH: path.join(root, 'template.xlsx'), OUTLINE_SAMPLE_PATH: path.join(root, 'sample.xlsx'), GITLAB_CONFIG_PATH: path.join(root, 'gitlab.json') },
    stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [] }) } },
    moduleRegistry: { get: key => key === 'auth' ? { authorize: async () => ({ user: { id: 'isolated-admin' }, roles: ['PLATFORM_ADMIN'] }) } : null },
    agentGovernance: { agent: async id => ({ id, executor: 'codex' }), models: () => ({ available: () => ({ defaultSelection: {}, configVersion: 'isolated' }) }), resolve: () => ({ config: model() }) },
    codexRunner: runner, handbookProductionService: {},
    sendFile(_file, res) { res.writeHead(404); res.end(); }, proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
  });
  server = http.createServer(handler); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/knowledge-center/api/platform`;
});
afterAll(async () => { if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } if (root) fs.rmSync(root, { recursive: true, force: true }); });

test('真实Worker完成：异步启动、启用MCP清单、脱敏截断与SSE续读', async () => {
  mode = 'complete';
  const started = await request('/agents/isolated/run-test', 'POST');
  expect(started).toMatchObject({ status: 202, body: { data: { status: 'running' } } });
  const id = started.body.data.id;
  const state = await until(id, value => value.status === 'completed');
  expect(state.result).toEqual({ model: 'complete', markdown: '# 隔离进程完成' });
  expect(state.manifest.mcpServices).toEqual([{ id: 'enabled', adapter: 'yashandb', knowledgeBases: ['active'] }, { id: 'no-bases', adapter: 'yashandb', knowledgeBases: [] }]);
  expect(state.events).toHaveLength(3);
  expect(state.events.map(e => e.seq)).toEqual([4, 5, 6]);
  expect(state.events[0].message).toBe('step-3 [已隐藏]');
  expect(JSON.stringify(state)).not.toContain('isolated-secret');
  const events = await fetch(`${base}/agent-runs/${id}/events?after=4`);
  expect(events.status).toBe(200);
  const text = await events.text(); expect(text).toContain('id: 5'); expect(text).toContain('id: 6'); expect(text).not.toContain('id: 4');
});

test('真实Worker合作取消：HTTP取消后进入cancelled且没有结果', async () => {
  mode = 'cooperative';
  const { body } = await request('/agents/isolated/run-test', 'POST'); const id = body.data.id;
  await until(id, value => value.events.some(e => e.kind === 'ready'));
  expect(await request(`/agent-runs/${id}/cancel`, 'POST')).toMatchObject({ status: 200, body: { data: { status: 'cancelling' } } });
  const state = await until(id, value => value.status === 'cancelled');
  expect(state).not.toHaveProperty('result'); expect(state.events.at(-1).kind).toBe('cancelled');
});

test('真实Worker不合作取消：强杀隔离进程组后进入cancelled', async () => {
  mode = 'stubborn';
  const { body } = await request('/agents/isolated/run-test', 'POST'); const id = body.data.id;
  const ready = await until(id, value => value.events.some(e => e.kind === 'ready'));
  const childPid = ready.events.find(e => e.kind === 'ready').childPid;
  try {
    expect((await request(`/agent-runs/${id}/cancel`, 'POST')).status).toBe(200);
    const state = await until(id, value => value.status === 'cancelled');
    expect(state).not.toHaveProperty('result'); expect(state.events.at(-1).kind).toBe('cancelled');
    // Linux may retain a terminated orphan as a zombie until init reaps it.
    const statusPath = `/proc/${childPid}/status`;
    const status = fs.existsSync(statusPath) ? fs.readFileSync(statusPath, 'utf8') : '';
    expect(!status || /^State:\s+Z/m.test(status)).toBe(true);
  } finally { try { process.kill(-childPid, 'SIGKILL'); } catch (_) {} }
}, 15000);
