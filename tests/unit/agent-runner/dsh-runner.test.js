const { createDshRunner, versionAtLeast, requiredVersion } = require('../../../packages/agent-runner-core/lib/agent-runtime/dsh-runner');
const { sandboxFactsValid } = require('../../../packages/agent-runner-core/lib/agent-runtime/dsh-adapter');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createDshAdapter } = require('../../../packages/agent-runner-core/lib/agent-runtime/dsh-adapter');

test('DSH 探针 socket 不可用时不产生未处理错误或阻断主服务启动', () => {
  const missingRuntimeDir = path.join(os.tmpdir(), `kc-dsh-missing-${process.pid}-${Date.now()}`);
  const script = [
    "const { createDshAdapter } = require('./packages/agent-runner-core/lib/agent-runtime/dsh-adapter');",
    'createDshAdapter({ autoProbe: false }).probe().then(result => {',
    "  console.log(JSON.stringify(result));",
    '  process.exitCode = result.sandbox || result.credential ? 1 : 0;',
    '});',
  ].join('\n');
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '../../..'), encoding: 'utf8',
    env: { ...process.env, XDG_RUNTIME_DIR: missingRuntimeDir },
  });
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout.trim())).toEqual({ sandbox: false, credential: false });
  expect(result.stderr).not.toMatch(/Unhandled 'error' event/);
});

test.each(['v24.9.0', 'v24.10.0', 'v25.0.0'])('DSH 探针接受符合最低版本的独立运行时 %s', node => {
  expect(sandboxFactsValid({ node, repo: false, home: false, bus: false, pid: 1, network: false })).toBe(true);
});
test.each([undefined, 'v24.8.9', 'invalid'])('DSH 探针拒绝缺失、低于最低版本或无效版本 %s', node => {
  expect(sandboxFactsValid({ node, repo: false, home: false, bus: false, pid: 1, network: false })).toBe(false);
});
test.each([
  { repo: true, home: false, bus: false, pid: 1, network: false },
  { repo: false, home: true, bus: false, pid: 1, network: false },
  { repo: false, home: false, bus: true, pid: 1, network: false },
  { repo: false, home: false, bus: false, pid: 2, network: false },
  { repo: false, home: false, bus: false, pid: 1, network: true },
])('DSH 探针拒绝隔离事实不满足要求的环境 %#', facts => {
  expect(sandboxFactsValid({ node: 'v24.9.0', ...facts })).toBe(false);
});

test('DSH 试运行在 SDK、隔离和任务凭据通道未就绪时 fail closed', () => {
  const runner = createDshRunner({
    runtimeRoot: '/not-installed',
    nodeAvailable: () => true,
    nodeVersion: 'v24.9.0',
    sdkResolve: () => { throw new Error('missing'); },
  });
  const readiness = runner.readiness();
  expect(readiness.ready).toBe(false);
  expect(readiness.blockers).toEqual(expect.arrayContaining([
    '未安装锁定版本的 DSH SDK Client',
    '未找到锁定版本 0.2.2-rc.1 的 DSH 运行时',
    '缺少任务级进程与文件系统隔离，无法限制 Agent 工具访问',
    '缺少 Agent 工具不可读取的任务级模型凭据通道',
    '平台 DSH SDK 运行适配器尚未完成，尚未启用运行入口',
  ]));
  expect(() => runner.start({})).toThrow(expect.objectContaining({ code: 'DSH_NOT_READY', status: 409 }));
});

test('DSH 预检认可独立运行时版本，不读取平台 Node 进程版本', () => {
  expect(versionAtLeast('v24.9.0', [24, 9, 0])).toBe(true);
  expect(versionAtLeast('v24.8.9', [24, 9, 0])).toBe(false);
  const runAdapter = {
    start: jest.fn(() => ({ id: 'run-1', status: 'running' })),
    get: jest.fn(id => ({ id, status: 'running', events: [] })),
    cancel: jest.fn(id => ({ id, status: 'cancelled', events: [] })),
    owns: jest.fn(id => id === 'run-1'),
  };
  const runner = createDshRunner({
    runtimeRoot: '/unused', runtimeAvailable: () => true, runtimeVersion: requiredVersion, nodeVersion: 'v24.9.0', sdkResolve: () => '/sdk/index.js', sdkVersion: requiredVersion, runAdapter,
    nodeAvailable: () => true,
    sandboxIsolation: { verify: () => true }, credentialIsolation: { verify: () => true },
  });
  expect(runner.readiness().ready).toBe(true);
  expect(runner.start({ agentId: 'dsh-1' })).toEqual({ id: 'run-1', status: 'running' });
  expect(runAdapter.start).toHaveBeenCalledWith({ agentId: 'dsh-1' });
  expect(runner.owns('run-1')).toBe(true);
  expect(runner.get('run-1').status).toBe('running');
  expect(runner.cancel('run-1').status).toBe('cancelled');
});

test('DSH 适配器隔离处理运行记录、归属、取消回读和模型配置拒绝', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-dsh-adapter-'));
  const adapter = createDshAdapter({ root, autoProbe: false });
  const id = crypto.randomUUID();
  const directory = path.join(root, id);
  fs.mkdirSync(directory);
  const recordPath = path.join(directory, 'run.json');
  const record = { id, status: 'running', sequence: 0, events: [] };
  fs.writeFileSync(recordPath, JSON.stringify(record));
  try {
    expect(() => adapter.get('bad-id')).toThrow(expect.objectContaining({ code: 'DSH_RUN_UNAVAILABLE', status: 404 }));
    expect(() => adapter.get(crypto.randomUUID())).toThrow(expect.objectContaining({ code: 'DSH_RUN_UNAVAILABLE', status: 404 }));
    expect(adapter.owns(id)).toBe(true);
    expect(adapter.owns('bad-id')).toBe(false);
    expect(adapter.get(id).status).toBe('interrupted');
    expect(JSON.parse(fs.readFileSync(recordPath, 'utf8')).status).toBe('interrupted');
    expect(adapter.cancel(id).status).toBe('interrupted');
    expect(adapter.get(id).status).toBe('interrupted');

    const terminalId = crypto.randomUUID();
    const terminalDirectory = path.join(root, terminalId);
    fs.mkdirSync(terminalDirectory);
    const terminalPath = path.join(terminalDirectory, 'run.json');
    fs.writeFileSync(terminalPath, JSON.stringify({ id: terminalId, status: 'completed', sequence: 0, events: [] }));
    expect(adapter.get(terminalId).status).toBe('completed');
    expect(JSON.parse(fs.readFileSync(terminalPath, 'utf8')).status).toBe('completed');
    expect(adapter.cancel(terminalId).status).toBe('completed');

    const valid = { protocol: 'chat_completions', api_key: 'secret', model: 'fixture', base_url: 'https://model.example/v1' };
    const invalidConfigs = [
      {}, { ...valid, protocol: 'other' }, { ...valid, api_key: '' }, { ...valid, model: '' },
      { ...valid, base_url: 'ftp://model.example' }, { ...valid, base_url: 'https://user:model.example' },
      { ...valid, base_url: 'https://model.example/v1?token=x' }, { ...valid, base_url: 'https://model.example/v1#fragment' },
    ];
    for (const config of invalidConfigs) {
      expect(() => adapter.start({ agentId: 'dsh-admin-trial', modelConfig: config, prompt: 'test' })).toThrow();
      expect(fs.readdirSync(root).sort()).toEqual([id, terminalId].sort());
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
