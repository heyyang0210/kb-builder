const { createDshRunner, versionAtLeast, requiredVersion } = require('../../../packages/agent-runner-core/lib/agent-runtime/dsh-runner');

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
