const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { setup } = require('./fixtures/production-writing.cjs');
const { createDshRunner } = require('../../../packages/agent-runner-core/lib/agent-runtime/dsh-runner');
const { createDshAdapter } = require('../../../packages/agent-runner-core/lib/agent-runtime/dsh-adapter');

const waitFor = async (condition, timeout = 60000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = await condition();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('DSH 测试等待超时');
};

test('DSH SDK 管理员试运行经真实 HTTP 完成、SSE 回读和取消', { timeout: 90000 }, async t => {
  const socketRoot = process.env.XDG_RUNTIME_DIR || `/run/user/${process.getuid()}`;
  try {
    execFileSync('systemctl', ['--user', 'show-environment'], { stdio: 'ignore', timeout: 2000 });
  } catch (_) {
    t.skip('需要可用的 systemd --user 会话');
    return;
  }

  const modelKey = 'dsh-isolated-fixture-key';
  let requests = 0;
  let holdResponse = null;
  let offeredTools = [];
  const modelServer = http.createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests += 1;
    assert.equal(request.url, '/v1/chat/completions');
    assert.equal(request.headers.authorization, `Bearer ${modelKey}`);
    const payload = JSON.parse(body);
    assert.equal(payload.model, 'fixture-model');
    offeredTools = payload.tools?.map(tool => tool.function?.name || tool.name) || [];
    if (requests === 2) { holdResponse = response; return; }
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.write(`data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content: '测试成功' }, finish_reason: null }] })}\n\n`);
    response.write(`data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
    response.end('data: [DONE]\n\n');
  });
  await new Promise(resolve => modelServer.listen(0, '127.0.0.1', resolve));
  t.after(() => { holdResponse?.destroy(); modelServer.closeAllConnections(); modelServer.close(); });

  const adapter = createDshAdapter({ autoProbe: false, maxRunMs: 60000 });
  assert.deepEqual(await adapter.probe(), { sandbox: true, credential: true });
  const runner = createDshRunner({ runAdapter: adapter });
  assert.equal(runner.readiness().ready, true);
  const modelConfig = { model: 'fixture-model', protocol: 'chat_completions',
    base_url: `http://127.0.0.1:${modelServer.address().port}/v1`, api_key: modelKey, max_tokens: 100 };
  let trialConfig = modelConfig;
  const sharedModel = { available: () => ({ defaultSelection: { serviceId: 'fixture', model: 'fixture-model' }, configVersion: 'v1' }),
    resolve: () => ({ config: trialConfig }) };
  const agent = {
    get: async () => ({ agents: [{ id: 'dsh-admin-trial', name: 'DeepSeek Harness', executor: 'deepseek' }], defaultAgentId: 'builtin-default' }),
    agent: async id => ({ id, executor: 'deepseek' }),
    models: () => ({ available: () => ({ defaultSelection: null }) }),
  };
  const api = await setup(t, { session: { authenticated: true, user: { id: 'admin', roles: ['PLATFORM_ADMIN'] } },
    agentGovernance: agent, dshRunner: runner, ai: { modelGovernance: sharedModel } });
  const agentsUrl = `${api.origin}/knowledge-center/api/platform/agents`;
  const listed = await fetch(agentsUrl).then(response => response.json());
  assert.equal(listed.data.agents[0].readiness.ready, true);
  assert(!JSON.stringify(listed).includes(modelKey));

  for (const [config, message] of [
    [{ ...modelConfig, api_key: '' }, '请配置可用的 Chat Completions 模型'],
    [{ ...modelConfig, base_url: `${modelConfig.base_url}?token=invalid` }, '模型地址无效'],
  ]) {
    trialConfig = config;
    const rejected = await fetch(`${agentsUrl}/dsh-admin-trial/run-test`, { method: 'POST' });
    assert.equal(rejected.status, 422);
    const body = await rejected.json();
    assert.equal(body.error.code, 'DSH_MODEL_UNAVAILABLE');
    assert.equal(body.error.message, message);
    assert.equal(requests, 0);
  }
  trialConfig = modelConfig;

  const start = async () => {
    const response = await fetch(`${agentsUrl}/dsh-admin-trial/run-test`, { method: 'POST' });
    assert.equal(response.status, 202);
    return (await response.json()).data.id;
  };
  const read = async id => (await fetch(`${api.origin}/knowledge-center/api/platform/agent-runs/${id}`).then(response => response.json())).data;
  const id = await start();
  const done = await waitFor(async () => { const state = await read(id); return state.status === 'completed' ? state : null; });
  assert.equal(done.events.at(-1).content, '测试成功');
  assert(!offeredTools.some(name => /web|search|skill|subagent|job|schedule|workflow|mcp/i.test(name)), `试运行暴露了额外工具: ${offeredTools.join(', ')}`);
  const eventResponse = await fetch(`${api.origin}/knowledge-center/api/platform/agent-runs/${id}/events?after=0`);
  assert.equal(eventResponse.status, 200);
  assert.match(await eventResponse.text(), /"kind":"completed"/);
  const runDir = path.resolve('runtime/agent-runner/dsh-runs', id);
  for (const file of ['run.json', 'guest/model.json', 'guest/trial.cordis.patch.yml']) {
    assert(!fs.readFileSync(path.join(runDir, file), 'utf8').includes(modelKey), `${file} 不能保存模型凭据`);
  }

  const staleId = crypto.randomUUID();
  const staleDir = path.resolve('runtime/agent-runner/dsh-runs', staleId);
  fs.mkdirSync(staleDir, { recursive: true });
  fs.writeFileSync(path.join(staleDir, 'run.json'), JSON.stringify({ ...done, id: staleId, taskId: staleId, status: 'running', ownerPid: -1 }));
  t.after(() => fs.rmSync(staleDir, { recursive: true, force: true }));
  const interrupted = await read(staleId);
  assert.equal(interrupted.status, 'interrupted');
  assert.equal(JSON.parse(fs.readFileSync(path.join(staleDir, 'run.json'), 'utf8')).status, 'interrupted');

  const cancelledId = await start();
  await waitFor(() => requests >= 2);
  const socketPath = path.join(socketRoot, `kc-dsh-model-${cancelledId}.sock`);
  const proxyStatus = await new Promise((resolve, reject) => {
    const request = http.request({ socketPath, path: '/v1/chat/completions', method: 'GET' }, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject);
    request.end();
  });
  assert.equal(proxyStatus, 403);
  assert.equal(requests, 2);
  const cancelled = await fetch(`${api.origin}/knowledge-center/api/platform/agent-runs/${cancelledId}/cancel`, { method: 'POST' });
  assert.equal(cancelled.status, 200);
  const stopped = await waitFor(async () => { const state = await read(cancelledId); return state.status === 'cancelled' ? state : null; });
  assert.equal(stopped.status, 'cancelled');
});
