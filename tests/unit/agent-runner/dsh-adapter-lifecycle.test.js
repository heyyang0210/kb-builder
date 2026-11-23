const { EventEmitter } = require('node:events');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { PassThrough } = require('node:stream');

jest.mock('node:child_process', () => ({ spawn: jest.fn() }));

const { spawn } = require('node:child_process');
const { createDshAdapter, sandboxFactsValid } = require('../../../packages/agent-runner-core/lib/agent-runtime/dsh-adapter');

function childProcess() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  return child;
}

function waitFor(predicate) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      if (predicate()) return resolve();
      if (Date.now() - started > 3000) return reject(new Error('等待隔离 DSH 进程超时'));
      setTimeout(poll, 10);
    };
    poll();
  });
}

function requestSocket(socketPath, { method = 'POST', route = '/v1/chat/completions', body } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({ socketPath, path: route, method, agent: false }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers,
        body: Buffer.concat(chunks).toString() }));
    });
    request.on('error', reject);
    request.end(body);
  });
}

describe('DSH 适配器本地生命周期与模型代理契约', () => {
  let root;
  let socketRoot;
  let oldRuntimeDir;
  let originalFetch;
  let adapter;

  beforeEach(() => {
    spawn.mockReset();
    oldRuntimeDir = process.env.XDG_RUNTIME_DIR;
    originalFetch = global.fetch;
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'kcd-'));
    socketRoot = path.join(root, 'sock');
    const modules = path.join(root, 'modules');
    fs.mkdirSync(socketRoot);
    fs.mkdirSync(modules);
    fs.writeFileSync(path.join(root, 'node'), 'fixture-node');
    fs.writeFileSync(path.join(root, 'worker.mjs'), 'fixture-worker');
    process.env.XDG_RUNTIME_DIR = socketRoot;
    adapter = createDshAdapter({ root: path.join(root, 'runs'), modules,
      node: path.join(root, 'node'), worker: path.join(root, 'worker.mjs'),
      maxRunMs: 60000, autoProbe: false });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (oldRuntimeDir === undefined) delete process.env.XDG_RUNTIME_DIR;
    else process.env.XDG_RUNTIME_DIR = oldRuntimeDir;
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('沙箱事实校验拒绝版本与隔离属性不满足的运行环境', () => {
    const valid = { node: 'v24.9.0', repo: false, home: false, bus: false, pid: 1, network: false };
    expect(sandboxFactsValid(valid)).toBe(true);
    for (const invalid of [
      { ...valid, node: 'unknown' }, { ...valid, node: 'v20.0.0' }, { ...valid, repo: true },
      { ...valid, home: true }, { ...valid, bus: true }, { ...valid, pid: 2 }, { ...valid, network: true },
    ]) expect(sandboxFactsValid(invalid)).toBe(false);
  });

  test('模型代理拒绝越权请求并透传上游响应、错误与请求大小边界', async () => {
    const child = childProcess();
    spawn.mockReturnValue(child);
    global.fetch = jest.fn()
      .mockResolvedValueOnce(new Response('upstream body', { status: 201,
        headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockRejectedValueOnce(new Error('upstream unavailable'))
      .mockResolvedValue(new Response(null, { status: 204 }));
    const state = adapter.start({ agentId: 'agent-1', prompt: 'fixture prompt', modelConfig: {
      protocol: 'chat_completions', api_key: 'api-secret', model: 'fixture-model',
      max_tokens: 9000, base_url: 'https://model.example/v1/',
    } });
    await waitFor(() => spawn.mock.calls.some(([command]) => command === 'systemd-run'));
    const socketPath = path.join(socketRoot, `kc-dsh-model-${state.id}.sock`);
    const payload = model => JSON.stringify({ model });

    expect((await requestSocket(socketPath, { method: 'GET' })).status).toBe(403);
    expect((await requestSocket(socketPath, { route: '/v1/other', body: payload('fixture-model') })).status).toBe(403);
    expect((await requestSocket(socketPath, { body: '{' })).status).toBe(502);
    expect((await requestSocket(socketPath, { body: payload('other-model') })).status).toBe(502);

    const forwarded = await requestSocket(socketPath, { body: payload('fixture-model') });
    expect(forwarded).toMatchObject({ status: 201, body: 'upstream body',
      headers: { 'content-type': 'application/json' } });
    expect(global.fetch).toHaveBeenCalledWith('https://model.example/v1/chat/completions', expect.objectContaining({
      method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json', authorization: 'Bearer api-secret' },
    }));
    expect((await requestSocket(socketPath, { body: payload('fixture-model') })).status).toBe(204);
    expect((await requestSocket(socketPath, { body: Buffer.alloc(1024 * 1024 + 1) })).status).toBe(502);
    expect((await requestSocket(socketPath, { body: payload('fixture-model') })).status).toBe(502);

    for (let index = 0; index < 14; index++)
      expect((await requestSocket(socketPath, { body: payload('fixture-model') })).status).toBe(204);
    expect((await requestSocket(socketPath, { body: payload('fixture-model') })).status).toBe(403);
    expect(global.fetch).toHaveBeenCalledTimes(17);

    child.stdout.end();
    child.stderr.end();
    child.emit('error', new Error('fixture spawn failure'));
    expect(adapter.get(state.id).status).toBe('failed');
  });

  test('运行事件只接受白名单类型并脱敏，终态后退出清理代理与记录', async () => {
    const child = childProcess();
    spawn.mockReturnValue(child);
    const state = adapter.start({ agentId: 'agent-2', prompt: 'fixture prompt', modelConfig: {
      protocol: 'chat_completions', api_key: 'api-secret', model: 'fixture-model', base_url: 'https://model.example',
    } });
    await waitFor(() => spawn.mock.calls.some(([command]) => command === 'systemd-run'));
    const socketPath = path.join(socketRoot, `kc-dsh-model-${state.id}.sock`);
    const event = value => `${JSON.stringify(value)}\n`;
    child.stderr.write('api-secret diagnostics');
    child.stdout.write([
      'not-json', event({ kind: 'unknown' }), event({ kind: 'progress', phase: 'using api-secret', content: 'api-secret output' }),
      event({ kind: 'completed', message: 'done' }), event({ kind: 'failed', message: 'after terminal' }),
    ].join(''));
    expect(adapter.get(state.id)).toMatchObject({ status: 'completed', sequence: 3, events: [
      { seq: 1, kind: 'started' },
      { seq: 2, kind: 'progress', phase: 'using [已隐藏]', content: '[已隐藏] output' },
      { seq: 3, kind: 'completed', message: 'done' },
    ] });
    child.stdout.end();
    child.stderr.end();
    child.emit('close', 0);
    await waitFor(() => !fs.existsSync(socketPath));
    expect(adapter.owns(state.id)).toBe(true);
    expect(fs.readFileSync(path.join(root, 'runs', state.id, 'diagnostics.log'), 'utf8')).toBe('[已隐藏] diagnostics');
  });

  test('运行事件超过保留上限时仅保留最新事件并持续递增序号', async () => {
    const child = childProcess();
    spawn.mockReturnValue(child);
    const state = adapter.start({ agentId: 'agent-event-limit', prompt: 'fixture', modelConfig: {
      protocol: 'chat_completions', api_key: 'secret', model: 'fixture-model', base_url: 'https://model.example',
    } });
    await waitFor(() => spawn.mock.calls.some(([command]) => command === 'systemd-run'));
    child.stdout.write(Array.from({ length: 205 }, (_, index) => JSON.stringify({
      kind: 'progress', phase: `phase-${index}`,
    })).join('\n') + '\n');
    const current = adapter.get(state.id);
    expect(current.sequence).toBe(206);
    expect(current.events).toHaveLength(200);
    expect(current.events[0]).toMatchObject({ seq: 7, phase: 'phase-5' });
    expect(current.events.at(-1)).toMatchObject({ seq: 206, phase: 'phase-204' });
    child.stdout.end();
    child.stderr.end();
    child.emit('error', new Error('fixture cleanup'));
  });

  test('取消进程成功或失败时均结束运行并停止本地代理', async () => {
    for (const stopOutcome of ['close', 'error']) {
      const worker = childProcess();
      const stopper = childProcess();
      spawn.mockImplementation(command => command === 'systemd-run' ? worker : stopper);
      const state = adapter.start({ agentId: `agent-${stopOutcome}`, prompt: 'fixture', modelConfig: {
        protocol: 'chat_completions', api_key: 'secret', model: 'fixture-model', base_url: 'https://model.example',
      } });
      await waitFor(() => spawn.mock.calls.some(([command]) => command === 'systemd-run'));
      const socketPath = path.join(socketRoot, `kc-dsh-model-${state.id}.sock`);
      expect(adapter.cancel(state.id).status).toBe('cancelling');
      if (stopOutcome === 'close') stopper.emit('close', 0);
      else stopper.emit('error', new Error('stop failed'));
      expect(adapter.get(state.id).status).toBe(stopOutcome === 'close' ? 'cancelled' : 'failed');
      await waitFor(() => !fs.existsSync(socketPath));
      worker.stdout.end();
      worker.stderr.end();
      worker.emit('close', 1);
      spawn.mockReset();
    }
  });

  test('探针解析受控本地 Socket 回应并在启动错误时保持未验证', async () => {
    spawn.mockImplementation((_command, args) => {
      const child = childProcess();
      const binding = args.find(value => value.startsWith('BindPaths=') && value.endsWith('/model.sock'));
      const socketPath = binding.slice('BindPaths='.length).split(':')[0];
      setImmediate(() => {
        const client = net.createConnection(socketPath);
        client.on('data', data => {
          client.destroy();
          const facts = { node: 'v24.9.0', repo: false, home: false, bus: false, pid: 1,
            network: false, socket: data.toString() === 'proxy-only', env: [] };
          child.stdout.end(`${JSON.stringify(facts)}\n`, () => child.emit('close', 0));
        });
      });
      return child;
    });
    expect(await adapter.probe()).toEqual({ sandbox: true, credential: true });
    expect(adapter.sandboxIsolation.verify()).toBe(true);
    expect(adapter.credentialIsolation.verify()).toBe(true);
    expect(fs.readdirSync(path.join(root, 'runs', 'probe'))).toEqual([]);

    spawn.mockImplementation(() => {
      const child = childProcess();
      process.nextTick(() => child.emit('error', new Error('systemd unavailable')));
      return child;
    });
    expect(await adapter.probe()).toEqual({ sandbox: false, credential: false });
    expect(adapter.sandboxIsolation.verify()).toBe(false);
    expect(adapter.credentialIsolation.verify()).toBe(false);
  });

  test('模型代理 Socket 被占用时持久化失败状态且不启动沙箱', async () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const socketPath = path.join(socketRoot, `kc-dsh-model-${id}.sock`);
    const occupied = net.createServer();
    await new Promise((resolve, reject) => {
      occupied.once('error', reject);
      occupied.listen(socketPath, resolve);
    });
    const randomUUID = jest.spyOn(crypto, 'randomUUID').mockReturnValue(id);
    try {
      const state = adapter.start({ agentId: 'agent-socket-conflict', prompt: 'fixture', modelConfig: {
        protocol: 'chat_completions', api_key: 'secret', model: 'fixture-model', base_url: 'https://model.example',
      } });
      await waitFor(() => adapter.get(state.id).status === 'failed');
      expect(adapter.get(id)).toMatchObject({ status: 'failed', events: [
        { kind: 'started' }, { kind: 'failed', message: 'DSH 模型代理启动失败' },
      ] });
      expect(spawn).not.toHaveBeenCalled();
    } finally {
      randomUUID.mockRestore();
      await new Promise(resolve => occupied.close(resolve));
    }
  });
});
