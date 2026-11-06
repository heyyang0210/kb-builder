const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');

describe('平台 Agent 管理 HTTP 契约', () => {
  let root;
  let server;
  let base;
  let agent;
  let model;
  let mcp;
  let runner;
  let executor;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-agent-http-'));
    const template = path.join(root, 'template.xlsx');
    const sample = path.join(root, 'sample.xlsx');
    fs.writeFileSync(template, 'template');
    fs.writeFileSync(sample, 'sample');
    model = {
      get: jest.fn(async () => ({ rowVersion: 'model-v1' })),
      available: jest.fn(() => ({ defaultSelection: { model: 'model-a' }, configVersion: 'model-v1' })),
      save: jest.fn(async () => ({ rowVersion: 'model-v2' })),
      test: jest.fn(async () => ({ ok: true })),
    };
    mcp = {
      get: jest.fn(async () => ({ rowVersion: 'mcp-v1' })),
      save: jest.fn(async () => ({ rowVersion: 'mcp-v2' })),
      test: jest.fn(async () => ({ ok: true })),
      saveService: jest.fn(async () => ({ id: 'service-a' })),
      deleteService: jest.fn(async () => ({ deleted: true })),
      testService: jest.fn(async () => ({ ok: true })),
      verifyKnowledgeBase: jest.fn(async () => ({ verified: true })),
    };
    executor = 'workflow';
    agent = {
      get: jest.fn(async () => ({ rowVersion: 'agent-v1', agents: [] })),
      save: jest.fn(async () => ({ rowVersion: 'agent-v2' })),
      agent: jest.fn(async id => ({ id, executor })),
      resolve: jest.fn(() => ({ config: { model: 'model-a' } })),
      models: jest.fn(() => model),
      mcp: jest.fn(() => mcp),
      available: jest.fn(async () => ({ options: [] })),
    };
    runner = {
      start: jest.fn(() => ({ id: 'run-a', status: 'queued' })),
      get: jest.fn(() => ({ id: 'run-a', status: 'completed', events: [{ seq: 1, kind: 'completed' }] })),
      cancel: jest.fn(() => ({ id: 'run-a', status: 'cancelling' })),
    };
    const handler = createKnowledgeCenterHandler({
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, KNOWLEDGE_CENTER_ENTRY: 'index.html', OUTLINE_TEMPLATE_PATH: template, OUTLINE_SAMPLE_PATH: sample, GITLAB_CONFIG_PATH: path.join(root, 'gitlab.json'), GITLAB_DOCUMENT_TYPES_PATH: path.join(root, 'rules.json') },
      stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [] }), write() {} } },
      moduleRegistry: { get: key => key === 'auth' ? { authorize: async req => req.headers['x-test-role'] === 'anonymous' ? null : { user: { id: 'agent-admin' }, roles: [req.headers['x-test-role'] || 'PLATFORM_ADMIN'] } } : null },
      agentGovernance: agent, codexRunner: runner, handbookProductionService: {},
      sendFile(_file, res) { res.writeHead(404); res.end(); }, proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
    });
    server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/knowledge-center/api/platform/agents`;
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  const call = (suffix = '', method = 'GET', body, headers = {}) => fetch(`${base}${suffix}`, {
    method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined,
  });

  test('未登录与非管理员无权读取或保存 Agent 配置', async () => {
    expect((await call('', 'GET', null, { 'x-test-role': 'anonymous' })).status).toBe(401);
    expect((await call('', 'GET', null, { 'x-test-role': 'KNOWLEDGE_EDITOR' })).status).toBe(403);
    expect(agent.get).not.toHaveBeenCalled();
  });

  test('列表读写和方法限制保留版本与操作者', async () => {
    const read = await call();
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({ data: { rowVersion: 'agent-v1' } });
    const saved = await call('', 'PUT', { agents: [] }, { 'if-match': 'agent-v1' });
    expect(saved.status).toBe(200);
    expect(agent.save).toHaveBeenCalledWith({ agents: [] }, 'agent-v1', 'agent-admin');
    expect((await call('', 'DELETE')).status).toBe(405);
    expect((await call('/unknown')).status).toBe(404);
  });

  test('子模块读取、保存、测试和服务动作按路径分发', async () => {
    expect((await call('/builtin-default/models')).status).toBe(200);
    expect((await call('/builtin-default/mcp')).status).toBe(200);
    const save = await call('/builtin-default/models', 'PUT', { rowVersion: 'model-v1' });
    expect(save.status).toBe(200);
    expect(model.save).toHaveBeenCalledWith({ rowVersion: 'model-v1' }, 'model-v1', 'agent-admin');
    expect((await call('/builtin-default/models/test', 'POST', { rowVersion: 'model-v1' })).status).toBe(200);
    for (const [suffix, method] of [['save', 'saveService'], ['delete', 'deleteService'], ['test', 'testService'], ['verify', 'verifyKnowledgeBase']]) {
      const response = await call(`/builtin-default/mcp/services/${suffix}`, 'POST', { rowVersion: 'mcp-v1' });
      expect(response.status).toBe(200);
      expect(mcp[method]).toHaveBeenCalledWith({ rowVersion: 'mcp-v1' }, 'mcp-v1', 'agent-admin');
    }
    expect((await call('/builtin-default/models/services/save', 'POST', {})).status).toBe(405);
    expect((await call('/builtin-default/mcp/test', 'GET')).status).toBe(405);
  });

  test('运行测试区分工作流、未部署执行器和 Codex', async () => {
    expect((await call('/builtin-default/run-test', 'GET')).status).toBe(405);
    const workflow = await call('/builtin-default/run-test', 'POST');
    expect(workflow.status).toBe(422);
    expect(await workflow.json()).toMatchObject({ error: { code: 'AGENT_TEST_UNSUPPORTED' } });
    executor = 'deepseek';
    const deepseek = await call('/builtin-default/run-test', 'POST');
    expect(deepseek.status).toBe(422);
    expect((await deepseek.json()).error.message).toContain('DeepSeek');
    executor = 'codex';
    const codex = await call('/builtin-default/run-test', 'POST');
    expect(codex.status).toBe(202);
    expect(await codex.json()).toMatchObject({ data: { id: 'run-a' } });
    expect(runner.start).toHaveBeenCalledWith(expect.any(Array), { model: 'model-a' });
  });

  test('已知治理错误与未知运行错误分别映射安全状态和错误码', async () => {
    agent.save.mockRejectedValueOnce(Object.assign(new Error('版本过期'), { code: 'AGENT_CONFIG_CONFLICT', status: 409 }));
    const known = await call('', 'PUT', { agents: [] });
    expect(known.status).toBe(409);
    expect(await known.json()).toMatchObject({ error: { code: 'AGENT_CONFIG_CONFLICT', message: '版本过期' } });
    agent.save.mockRejectedValueOnce(new Error('内部敏感错误'));
    const unknown = await call('', 'PUT', { agents: [] });
    expect(unknown.status).toBe(503);
    const body = await unknown.text();
    expect(body).toContain('AGENT_RUN_FAILED');
    expect(body).not.toContain('内部敏感错误');
  });

  test('运行状态、取消和完成事件通过 HTTP 回读', async () => {
    const url = `${base.replace(/\/agents$/, '/agent-runs')}/run-a`;
    expect((await fetch(url, { headers: { 'x-test-role': 'KNOWLEDGE_EDITOR' } })).status).toBe(403);
    const status = await fetch(url);
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({ data: { id: 'run-a', status: 'completed' } });
    const events = await fetch(`${url}/events`, { headers: { 'last-event-id': '0' } });
    expect(events.status).toBe(200);
    expect(events.headers.get('content-type')).toContain('text/event-stream');
    expect(await events.text()).toContain('id: 1');
    const cancelled = await fetch(`${url}/cancel`, { method: 'POST' });
    expect(cancelled.status).toBe(200);
    expect(await cancelled.json()).toMatchObject({ data: { status: 'cancelling' } });
    expect(runner.cancel).toHaveBeenCalledWith('run-a');
    expect((await fetch(`${url}/cancel`)).status).toBe(405);
    runner.get.mockImplementationOnce(() => { throw Object.assign(new Error('运行不存在'), { status: 404 }); });
    const missing = await fetch(url);
    expect(missing.status).toBe(404);
  });
});
