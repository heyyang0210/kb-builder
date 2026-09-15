const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { freezeTemplateForRequest, frozenTemplateContent, persistTemplateSnapshot, templateMetadata } = require('../../../packages/agent-runner-core/lib/template-generation');
const { hash } = require('../../../packages/agent-runner-core/lib/template-store');

function snapshot(content = '# 固定正文', version = 1) {
  return { templateId: 'template.test', templateVersion: version, templateContent: content, templateHash: hash(content), templateSource: 'database' };
}

test('generation authorizes the server session and ignores client snapshots', async t => {
  const auth = http.createServer((req, res) => {
    assert.equal(req.url, '/knowledge-center/api/auth/session');
    const role = req.headers.cookie;
    if (!role) { res.writeHead(401).end('{}'); return; }
    res.end(JSON.stringify({ content: { allowedActions: role === 'read' ? ['template:read'] : ['knowledge:write'], roles: role === 'admin' ? ['PLATFORM_ADMIN'] : [] } }));
  });
  await new Promise(resolve => auth.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => auth.close(resolve)));
  let reads = 0;
  const options = { auth: { port: auth.address().port }, store: { resolveForGeneration(reference) { reads++; assert.equal(reference, 'knowledge/templates/test.md'); return snapshot(); } } };
  const request = cookie => ({ headers: { cookie }, body: { template: 'knowledge/templates/test.md', ...snapshot('伪造正文', 99), templateId: undefined } });
  await assert.rejects(freezeTemplateForRequest(request(''), options), { status: 401, code: 'AUTH_REQUIRED' });
  await assert.rejects(freezeTemplateForRequest(request('knowledge'), options), { status: 403, code: 'TEMPLATE_PERMISSION_DENIED' });
  assert.equal(reads, 0);
  for (const cookie of ['read', 'admin']) assert.deepEqual(await freezeTemplateForRequest(request(cookie), options), snapshot());
  assert.equal(reads, 2);
  assert.deepEqual(await freezeTemplateForRequest({ headers: {}, body: { templateContent: '不能偷偷写入' } }, options), {});
});

test('failed authentication service is explicit and fail-closed', async () => {
  await assert.rejects(freezeTemplateForRequest({ headers: { cookie: 'expired-test-session' }, body: { templateId: 'test' } }, { auth: { host: '127.0.0.1', port: 1 } }), { status: 503, code: 'AUTH_UNAVAILABLE' });
});

test('fixed template hash is verified; legacy tasks are not fabricated', () => {
  assert.equal(frozenTemplateContent(snapshot()), '# 固定正文');
  assert.throws(() => frozenTemplateContent({ ...snapshot(), templateContent: 'changed' }), { code: 'TEMPLATE_SNAPSHOT_INVALID' });
  assert.equal(frozenTemplateContent({ template: 'knowledge/templates/test.md' }), null);
  assert.deepEqual(templateMetadata({ template: 'old.md' }), {});
  assert.equal(Object.hasOwn(templateMetadata(snapshot()), 'templateContent'), false);
});

test('task snapshot is persisted and reread independently of current template', async t => {
  // Only isolated /tmp files are created; no shared task data or model is touched.
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'template-generation-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const ProcessStore = require('../../../packages/agent-runner-core/lib/process-store');
  const store = new ProcessStore('isolated-template-test'); store.basePath = directory;
  const fixed = snapshot();
  await persistTemplateSnapshot('isolated-template-test', fixed, store);
  const loaded = await store.load('01-input-preparation', 'template-snapshot.json');
  fixed.templateContent = '# 新版本';
  assert.deepEqual(loaded, snapshot());
  assert.equal(frozenTemplateContent(loaded), '# 固定正文');
});

test('planner and generator consume frozen body, while task status omits it', async () => {
  const Planner = require('../../../packages/agent-runner-core/lib/agents/planner-agent');
  const Generator = require('../../../packages/agent-runner-core/lib/agents/generator-agent');
  const planner = new Planner(); const generator = new Generator();
  planner.loadPromptTemplate = generator.loadPromptTemplate = () => '';
  const frozen = snapshot('# 独立数据库版本正文');
  const planning = planner.buildPrompt({ knowledgePoint: { name: '测试知识点' }, template: 'missing.md', templateSnapshot: frozen }, {});
  const generating = generator.buildPrompt({ executionPlan: {}, templateSnapshot: frozen }, {});
  assert.ok(JSON.stringify(planning).includes('独立数据库版本正文'));
  assert.ok(JSON.stringify(generating).includes('独立数据库版本正文'));
  const plan = await planner.parseResponse({ parsed: { retrieval_plan: { mcp_queries: ['测试'], reference_files: ['knowledge/templates/changed.md', 'knowledge/references/valid.md'] } } }, { knowledgePoint: { name: '测试知识点' }, templateSnapshot: frozen });
  assert.deepEqual(plan.retrieval_plan.reference_files, ['knowledge/references/valid.md']);
  const { createDirectTask, serializeDirectTask } = require('../../../packages/agent-runner-core/lib/direct-generate/task-store');
  const task = createDirectTask(frozen);
  assert.equal(serializeDirectTask(task).templateVersion, 1);
  assert.equal(Object.hasOwn(serializeDirectTask(task), 'templateContent'), false);
});

test('generation route HTTP freezes database versions before background execution', async t => {
  const express = require('express');
  // ConfigManager watches files for the running service; tests must not leave a watcher alive.
  t.mock.method(require('node:fs'), 'watch', () => ({ close() {} }));
  const { createTemplateStore } = require('../../../packages/agent-runner-core/lib/template-store');
  let state = { schemaVersion: 1, templates: [], audits: [] };
  const store = createTemplateStore({ store: { read: () => structuredClone(state), transaction(fn) { const draft = structuredClone(state); const result = fn(draft); state = draft; return structuredClone(result); } } });
  store.create({ id: 'template.integration', name: '固定版本测试', content: '# 版本一', legacyPath: 'knowledge/templates/integration.md' }, { user: { id: 'isolated-test' } });
  const auth = http.createServer((req, res) => {
    if (!req.headers.cookie) return res.writeHead(401).end('{}');
    res.end(JSON.stringify({ content: { allowedActions: req.headers.cookie === 'read' ? ['template:read'] : ['knowledge:write'] } }));
  });
  await new Promise(resolve => auth.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => auth.close(resolve)));
  const generation = require('../../../packages/agent-runner-core/lib/template-generation');
  const frozen = generation.freezeTemplateForRequest;
  t.mock.method(generation, 'freezeTemplateForRequest', req => frozen(req, { auth: { host: '127.0.0.1', port: auth.address().port }, store }));
  const executed = [];
  t.mock.method(require('../../../packages/agent-runner-core/lib/direct-generate/direct-task-runner'), 'executeDirectGenerate', async (_req, task) => { executed.push(task); });
  const savedSnapshots = [];
  t.mock.method(require('../../../packages/agent-runner-core/lib/process-store').prototype, 'save', async (_stage, _file, value) => { savedSnapshots.push(structuredClone(value)); });
  const routePath = require.resolve('../../../packages/agent-runner-core/routes/agent');
  delete require.cache[routePath];
  t.after(() => { delete require.cache[routePath]; });
  const app = express(); app.use(express.json()); app.use('/api/agent', require(routePath));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const send = async (cookie, extra = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/agent/execute`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ mode: 'direct_generate', knowledge_point: { name: '隔离验收' }, templateId: 'template.integration', templateContent: '# 客户端伪造', templateVersion: 99, ...extra }) });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await send('')).status, 401);
  assert.equal((await send('knowledge')).status, 403);
  assert.equal(executed.length, 0);
  const first = await send('read'); assert.equal(first.status, 200); assert.equal(first.body.templateVersion, 1);
  assert.equal(executed[0].inputData.templateContent, '# 版本一');
  assert.equal(savedSnapshots[0].templateContent, '# 版本一');
  store.save('template.integration', { baseVersion: 1, content: '# 版本二' }, {});
  const next = await send('read'); assert.equal(next.body.templateVersion, 2);
  assert.equal(frozenTemplateContent(executed[0].inputData), '# 版本一');
  assert.equal(store.getVersion('template.integration', 1).content, '# 版本一');
  store.disable('template.integration', {}, false);
  assert.equal((await send('read')).status, 409);
  assert.equal(executed.length, 2);
  store.disable('template.integration', {}, true);
  const WorkflowEngine = require('../../../packages/agent-runner-core/lib/workflow-engine');
  let workflow;
  t.mock.method(WorkflowEngine.prototype, 'startWorkflow', async function(taskId) { workflow = this.workflows.get(taskId); });
  t.mock.method(require('../../../packages/agent-runner-core/lib/config-manager'), 'getModelConfig', async () => ({}));
  t.mock.method(require('../../../packages/agent-runner-core/lib/config-manager'), 'getMCPConfig', async () => ({}));
  const graphTask = await send('read', { mode: 'workflow' });
  assert.equal(graphTask.status, 200); assert.equal(graphTask.body.templateVersion, 2);
  assert.equal(frozenTemplateContent(workflow.inputData), '# 版本二');
  assert.equal(savedSnapshots.at(-1).templateVersion, 2);
});
