const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { setTimeout: pause } = require('node:timers/promises');
const { createCodexRunner } = require('../../../packages/agent-runner-core/lib/agent-runtime/codex-runner');
const { createMcpBridge } = require('../../../packages/agent-runner-core/lib/agent-runtime/mcp-bridge');
const { setup } = require('./fixtures/production-writing.cjs');
const root = path.resolve('runtime/test-results/codex-runtime');
fs.mkdirSync(root, { recursive: true });
const config = { protocol: 'responses', base_url: 'https://example.test/v1', model: 'fixture', api_key: 'fixture-secret' };
async function until(read, predicate, attempts = 100) {
  for (let i = 0; i < attempts; i++) { const result = await read(); if (predicate(result)) return result; await pause(100); }
  throw new Error('等待运行状态超时');
}

test('真实 HTTP 运行记录、事件补读、取消和访问权限（受控 Worker）', async t => {
  const dir = fs.mkdtempSync(path.join(root, 'controlled-'));
  const workerPath = path.join(dir, 'worker.cjs');
  fs.writeFileSync(workerPath, `process.on('message', m => { if(m.type==='cancel') process.exit(0); if(m.type==='run') { process.send({type:'event',event:{kind:'progress',text:'fixture-secret'}}); setTimeout(()=>{},30000); } });`);
  const runner = createCodexRunner({ runtimeRoot: dir, workerPath });
  const session = { authenticated: true, user: { id: 'runtime-admin', roles: ['PLATFORM_ADMIN'] }, allowedActions: ['knowledge:read', 'knowledge:write'] };
  const api = await setup(t, { session, codexRunner: runner });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const run = runner.start([], config);
  const url = api.origin + '/knowledge-center/api/platform/agent-runs/' + run.id;
  await until(() => runner.get(run.id), r => r.events.length > 0);
  assert(!JSON.stringify(runner.get(run.id)).includes('fixture-secret'));
  const manifest = runner.get(run.id).manifest;
  assert.equal(manifest.protocol, 'responses');
  assert.equal(manifest.approvalPolicy, 'never');
  assert.match(manifest.inputDigest, /^[a-f0-9]{64}$/);
  assert.match(manifest.rulesDigest, /^[a-f0-9]{64}$/);
  const cancelled = await fetch(url + '/cancel', { method: 'POST' });
  assert.equal(cancelled.status, 200);
  await until(() => runner.get(run.id), r => r.status === 'cancelled');
  const events = await fetch(url + '/events?after=1');
  const text = await events.text();
  assert.match(text, /cancelled/); assert(!text.includes('progress'));
  assert.equal((await fetch(url)).status, 200);
  assert.equal((await fetch(api.origin + '/knowledge-center/api/platform/agent-runs/invalid')).status, 404);
  session.user.roles = ['KNOWLEDGE_EDITOR'];
  assert.equal((await fetch(url)).status, 403);
  assert.throws(() => runner.preflight({ ...config, protocol: 'chat_completions' }), { code: 'AGENT_PROTOCOL_UNSUPPORTED' });
});

async function mcpFixture(t) {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const m = JSON.parse(raw);
    calls.push({ method: m.method, name: m.params?.name, target: req.headers['x-kb'], auth: req.headers.authorization });
    if (m.id == null) { res.writeHead(202); res.end(); return; }
    const result = m.method === 'initialize' ? { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'isolated', version: '1' } }
      : m.method === 'tools/list' ? { tools: [] }
      : m.params?.name === 'search_ku' ? { structuredContent: { results: [{ id: 'doc-1', ku_name: 'doc-1', title: '接入检查', content: '校验码：KB-READY-729。' }] }, content: [{ type: 'text', text: '请读取 doc-1 确认校验码。' }] }
      : { structuredContent: { title: '接入检查', content: '校验码：KB-READY-729。此资料只用于隔离测试。' }, content: [{ type: 'text', text: '校验码：KB-READY-729。此资料只用于隔离测试。' }] };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: m.id, result }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  return { calls, config: { services: [{ id: 'docs', name: '隔离资料', adapter: 'yashandb', enabled: true, server_url: `http://127.0.0.1:${server.address().port}/mcp`, api_key: 'mcp-fixture-key', search_knowledge_base_header: 'X-KB', headers: [], knowledgeBases: [{ id: 'test', name: '测试库', locator: 'test-locator', enabled: true }, { id: 'disabled', name: '停用库', locator: 'forbidden', enabled: false }] }] } };
}

test('MCP 桥接鉴权、知识库路由与越权拒绝（真实 HTTP）', async t => {
  const upstream = await mcpFixture(t);
  const bridge = await createMcpBridge(upstream.config); t.after(() => bridge.close());
  const call = (name, args, token = bridge.token) => fetch(bridge.url, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) });
  assert.equal((await call('knowledge_read', {}, 'bad')).status, 403);
  const denied = await (await call('knowledge_read', { knowledgeBase: 'docs/disabled', documentId: 'doc-1' })).json();
  assert(denied.error); assert.equal(upstream.calls.length, 0);
  const result = await (await call('knowledge_read', { knowledgeBase: 'docs/test', documentId: 'doc-1' })).json();
  assert.match(JSON.stringify(result), /KB-READY-729/);
  assert.equal(upstream.calls.at(-1).target, 'test-locator');
  assert.equal(upstream.calls.at(-1).auth, 'Bearer mcp-fixture-key');
});

test('真实 Codex + 公司 Responses + MCP 工具 → 生产候选 → 采用草稿', { skip: process.env.RUN_LIVE_CODEX !== '1', timeout: 240000 }, async t => {
  const manager = require('../../../packages/agent-runner-core/lib/config-manager');
  t.after(() => manager.watcher?.close());
  const legacy = require('../../../packages/agent-runner-core/lib/platform-management/model-governance').createModelGovernance();
  const resolved = legacy.resolve();
  const upstream = await mcpFixture(t);
  const modelConfig = { ...resolved.config, executor: 'codex', agentId: 'live-codex', protocol: 'responses', base_url: 'https://ai-green.yasdb.com/v1', reasoningEffort: 'low', mcp: upstream.config };
  const selection = { ...resolved.selection, agentId: 'live-codex', executor: 'codex' };
  const runner = createCodexRunner({ runtimeRoot: path.join(root, 'live') });
  const api = await setup(t, { ai: { modelGovernance: { resolve: () => ({ config: modelConfig, selection }) }, codexRunner: runner } });
  const ctx = { outlineVersionId: 'outline-v1', branch: 'main' };
  const suffix = '/handbooks/HB-1/documents/codex-live';
  const start = await api.request('POST', suffix + '/ai-jobs', JSON.stringify({ ...ctx, operation: 'polish', markdown: '接入检查。', range: { start: 0, end: 5 }, editVersion: 0, requirements: '必须先调用 knowledge_search，再调用 knowledge_read，知识库 docs/test，文档 doc-1。将工具返回的校验码写入正文。使用空 provenance 数组，正文不超过100字。', modelSelection: selection }), { 'Content-Type': 'application/json', 'Idempotency-Key': 'codex-live' });
  assert.equal(start.status, 202, JSON.stringify(start.body));
  const jobId = start.body.data.jobId;
  const job = await until(async () => (await api.request('GET', suffix + '/ai-jobs/' + jobId + '?' + new URLSearchParams(ctx))).body.data, r => !['queued', 'running'].includes(r.status), 2100);
  assert.equal(job.status, 'completed', JSON.stringify(job.error));
  assert.match(job.fragment, /KB-READY-729/);
  assert(upstream.calls.some(c => c.name === 'search_ku'));
  assert(upstream.calls.some(c => c.name === 'get_ku_detail'));
  const adopt = await api.request('POST', suffix + '/ai-jobs/' + jobId + '/adopt', JSON.stringify({ ...ctx, editVersion: 0, markdown: job.candidateMarkdown, originalMarkdown: job.originalMarkdown, attachmentIds: [], baselineDigest: '' }), { 'Content-Type': 'application/json', 'Idempotency-Key': 'adopt-codex-live' });
  assert.equal(adopt.status, 200, JSON.stringify(adopt.body));
  const draft = await api.request('GET', suffix + '/draft?' + new URLSearchParams(ctx));
  assert.match(draft.body.data.draft.revision.markdown, /KB-READY-729/);
  assert.equal(draft.body.data.draft.revision.generationMetadata.modelSelection.agentId, 'live-codex');
  const evidence = { completed: true, model: modelConfig.model, jobId, markdown: job.fragment, tools: upstream.calls.filter(c => c.name).map(c => c.name), adopted: true, scope: '真实模型/Codex/MCP工具；隔离HTTP业务与草稿存储，未发布' };
  fs.writeFileSync(path.join(root, 'live-result.json'), JSON.stringify(evidence, null, 2));
});
