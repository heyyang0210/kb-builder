const fs = require('fs');
const path = require('path');

const MODULE = '../../../packages/agent-runner-core/lib/config-manager';
const REGISTRY = '../../../packages/agent-runner-core/lib/config-registry';
const ENV = '../../../packages/agent-runner-core/lib/runtime-env';
const LOGGER = '../../../packages/agent-runner-core/lib/logger';
const ROOT = path.resolve(__dirname, '../../../runtime/test-tmp');

describe('生产 ConfigManager 存储与缓存边界', () => {
  let dir;
  let service;
  let manager;
  let onChange;
  let watch;
  let logger;
  let oldKey;

  function load({ missing = false, watchError = false, envError = false } = {}) {
    jest.resetModules();
    service = path.join(dir, 'config', 'service.json');
    if (!missing) fs.mkdirSync(path.dirname(service), { recursive: true });
    logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    watch = jest.spyOn(fs, 'watch').mockImplementation((directory, listener) => {
      if (watchError) throw new Error('监听不可用');
      onChange = listener;
      return { unref: jest.fn(), close: jest.fn() };
    });
    jest.doMock(REGISTRY, () => ({ CONFIG_PATHS: { service } }));
    jest.doMock(ENV, () => ({ loadRuntimeEnv: () => { if (envError) throw new Error('环境配置不可用'); } }));
    jest.doMock(LOGGER, () => logger);
    manager = require(MODULE);
    return manager;
  }
  function write(value, name = 'service.json') {
    fs.mkdirSync(path.dirname(service), { recursive: true });
    fs.writeFileSync(path.join(path.dirname(service), name), JSON.stringify(value));
  }
  beforeEach(() => {
    fs.mkdirSync(ROOT, { recursive: true });
    dir = fs.mkdtempSync(path.join(ROOT, 'config-manager-'));
    oldKey = process.env.AGENT_RUNNER_KEY;
    process.env.AGENT_RUNNER_KEY = 'isolated-config-test-key';
  });
  afterEach(() => {
    jest.restoreAllMocks();
    for (const module of [REGISTRY, ENV, LOGGER]) jest.dontMock(module);
    jest.resetModules();
    if (oldKey === undefined) delete process.env.AGENT_RUNNER_KEY;
    else process.env.AGENT_RUNNER_KEY = oldKey;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('真实递归加密存储，清缓存后解密且保留相邻分区', async () => {
    load();
    write({ untouched: { keep: true } });
    const config = {
      api_key: 'test-top-secret',
      services: [{ api_key: 'service-secret' }], agents: [{ model: { api_key: 'agent-secret' } }],
      model: { api_key: 'nested-secret' }, mcp: { api_key: 'mcp-secret' },
      headers: [{ name: 'Authorization', encrypted: true, value: 'header-secret' }, { name: 'Public', value: 'visible' }, { name: 'Empty', encrypted: true, value: '' }]
    };
    expect(await manager.save('model-config', config)).toBe(true);
    const raw = fs.readFileSync(service, 'utf8');
    for (const secret of ['test-top-secret', 'service-secret', 'agent-secret', 'nested-secret', 'mcp-secret', 'header-secret']) expect(raw).not.toContain(secret);
    expect(JSON.parse(raw).untouched).toEqual({ keep: true });
    manager.clearCache();
    const result = await manager.getModelConfig();
    expect(result).toMatchObject(config);
    expect(result.api_key_encrypted.split(':')).toHaveLength(3);
    expect(result.headers[0]).toMatchObject({ value: 'header-secret', value_encrypted: expect.any(String) });
    expect(manager.getModelConfigSync()).toMatchObject(config);
  });

  test('独立配置文件、缓存命中与定向和全量清理', async () => {
    load();
    expect(await manager.load('missing')).toBeNull();
    await manager.save('custom', { value: 'original' });
    write({ value: 'updated' }, 'custom.json');
    expect(await manager.load('custom')).toEqual({ value: 'original' });
    manager.clearCache('custom');
    expect(await manager.load('custom')).toEqual({ value: 'updated' });
    manager.clearCache();
    expect(await manager.load('custom')).toEqual({ value: 'updated' });
  });

  test('缺失目录和分区的同步异步读取返回 null', async () => {
    delete process.env.AGENT_RUNNER_KEY;
    load({ missing: true, envError: true });
    expect(watch).not.toHaveBeenCalled();
    expect(await manager.getModelConfig()).toBeNull();
    expect(manager.getModelConfigSync()).toBeNull();
    expect(manager.getMCPConfigSync()).toBeNull();
    expect(manager.getAgentServicesSync()).toBeNull();
    write({});
    expect(await manager.getMCPConfig()).toBeNull();
    expect(manager.getModelConfigSync()).toBeNull();
    expect(manager.getMCPConfigSync()).toBeNull();
    expect(manager.getAgentServicesSync()).toBeNull();
    write({ mcp: { headers: [] }, agentServices: { services: [] } });
    expect(await manager.getMCPConfig()).toMatchObject({ headers: [] });
    expect(manager.getMCPConfigSync()).toMatchObject({ headers: [] });
    expect(manager.getAgentServicesSync()).toMatchObject({ services: [] });
  });

  test('损坏密文降级保留原配置，普通 header 不受影响', async () => {
    load();
    write({ mcp: { api_key_encrypted: 'invalid', headers: [
      { name: 'Invalid', encrypted: true, value_encrypted: 'invalid' },
      { name: 'InvalidTag', encrypted: true, value_encrypted: '00:00:00' },
      { name: 'Missing', encrypted: true },
      { name: 'Plain', value: 'visible' }
    ] } });
    const value = await manager.getMCPConfig();
    expect(value).not.toHaveProperty('api_key');
    expect(value.headers[0].value_encrypted).toBe('invalid');
    expect(value.headers[3].value).toBe('visible');
    expect(logger.warn).toHaveBeenCalledTimes(3);
    expect(manager.isApiKeyConfigured(value)).toBe(true);
    expect(manager.isApiKeyConfigured({ api_key: 'present' })).toBe(true);
    expect(manager.isApiKeyConfigured({})).toBe(false);
    expect(manager.isApiKeyConfigured(null)).toBe(false);
  });

  test('预设缺失、查找、创建与更新均真实落盘', async () => {
    load();
    write({});
    expect(await manager.getAgentPreset('absent')).toBeNull();
    write({ agentPresets: {} });
    expect(await manager.getAgentPreset('absent')).toBeNull();
    manager.clearCache();
    write({});
    expect(await manager.saveAgentPreset({ id: 'first', name: '初始' })).toBe(true);
    expect(await manager.saveAgentPreset({ id: 'second', name: '第二个' })).toBe(true);
    expect(await manager.saveAgentPreset({ id: 'first', name: '更新' })).toBe(true);
    manager.clearCache();
    expect(await manager.getAgentPreset('first')).toMatchObject({ name: '更新' });
    expect(await manager.getAgentPreset('absent')).toBeNull();
    expect((await manager.getAgentPresets()).presets).toHaveLength(2);
  });

  test('监听事件忽略空和非 JSON 名称，普通文件定向失效，service 全量失效', async () => {
    load();
    write({ model: { name: 'old' } });
    await manager.getModelConfig();
    await manager.save('custom', { name: 'old' });
    write({ name: 'new' }, 'custom.json');
    onChange('change', null);
    onChange('rename', 'custom.txt');
    expect(await manager.load('custom')).toMatchObject({ name: 'old' });
    onChange('change', 'custom.json');
    expect(await manager.load('custom')).toMatchObject({ name: 'new' });
    write({ model: { name: 'new' } });
    expect(await manager.getModelConfig()).toMatchObject({ name: 'old' });
    onChange('change', 'service.json');
    expect(await manager.getModelConfig()).toMatchObject({ name: 'new' });
    expect(manager.watcher.unref).toHaveBeenCalledTimes(1);
  });

  test('监听失败不阻止配置读取，损坏 JSON 与落盘错误传播', async () => {
    load({ watchError: true });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('监听不可用'));
    write({ model: { name: 'valid' } });
    expect(await manager.getModelConfig()).toMatchObject({ name: 'valid' });
    manager.clearCache();
    fs.writeFileSync(service, '{broken');
    await expect(manager.getModelConfig()).rejects.toThrow(SyntaxError);
    await expect(manager.save('model-config', {})).rejects.toThrow(SyntaxError);
    fs.rmSync(service);
    fs.mkdirSync(service);
    await expect(manager.save('model-config', {})).rejects.toMatchObject({ code: 'EISDIR' });
    const blocker = path.join(dir, 'blocker');
    fs.writeFileSync(blocker, 'file');
    manager.configDir = blocker;
    await expect(manager.save('custom', {})).rejects.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });
});
