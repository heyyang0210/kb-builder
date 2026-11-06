const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

describe('知识中心网关数据库模式资产一致性启动校验', () => {
  let directory;
  let original;
  let warn;
  let info;
  let file;
  let databaseState;
  let gatewayOptions;
  let casPrincipal;
  let writtenSnapshot;
  let authOptions;

  beforeAll(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-gateway-database-'));
    file = path.join(directory, 'assets.json');
    original = Object.fromEntries(['KNOWLEDGE_STORAGE_MODE', 'KNOWLEDGE_ASSETS_CONFIG', 'KNOWLEDGE_CENTER_ADMIN_USERNAME', 'KNOWLEDGE_CENTER_ADMIN_PASSWORD', 'KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_USERNAME', 'KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_PASSWORD'].map(key => [key, process.env[key]]));
    Object.assign(process.env, {
      KNOWLEDGE_STORAGE_MODE: 'database', KNOWLEDGE_ASSETS_CONFIG: file,
      KNOWLEDGE_CENTER_ADMIN_USERNAME: 'isolated-admin', KNOWLEDGE_CENTER_ADMIN_PASSWORD: 'isolated-pass',
      KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_USERNAME: 'isolated-editor', KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_PASSWORD: 'isolated-pass',
    });
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    info = jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.doMock('../../../packages/agent-runner-core/lib/domain-store', () => ({
      createDomainStore: () => ({
        readHandbooks: () => databaseState,
        readHandbooksAsync: async () => databaseState,
        writeHandbooksSnapshot: payload => { writtenSnapshot = payload; },
        syncCasPrincipal: info => { casPrincipal = info; return info; },
      }),
    }));
    jest.doMock('../../../packages/agent-runner-core/lib/aggregate-store', () => ({
      createAggregateStore: () => ({ read: () => ({}), write: () => {} }),
      DatabaseIncrementalStore: class DatabaseIncrementalStore {},
    }));
    jest.doMock('../../../packages/agent-runner-core/lib/platform-management/database-connection-governance', () => ({
      createDatabaseConnectionGovernance: () => ({ stopHealthMonitor() {} }),
    }));
    jest.doMock('../../../packages/agent-runner-core/lib/knowledge-center-auth', () => ({
      createKnowledgeCenterAuthService: options => { authOptions = options; return {}; },
    }));
    jest.doMock('../../../packages/agent-runner-core/routes/knowledge-center', () => ({ createKnowledgeCenterHandler: options => { gatewayOptions = options; return () => {}; } }));
  });

  afterAll(() => {
    warn.mockRestore(); info.mockRestore();
    for (const modulePath of [
      '../../../packages/agent-runner-core/lib/domain-store',
      '../../../packages/agent-runner-core/lib/aggregate-store',
      '../../../packages/agent-runner-core/lib/platform-management/database-connection-governance',
      '../../../packages/agent-runner-core/lib/knowledge-center-auth',
      '../../../packages/agent-runner-core/routes/knowledge-center',
    ]) jest.dontMock(modulePath);
    jest.resetModules();
    for (const [key, value] of Object.entries(original || {})) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  });

  function load() {
    jest.resetModules();
    const module = require('../../../apps/knowledge-center-web/frontend-server');
    module.server.close();
  }

  test('源文件与数据库聚合一致时确认资产数', () => {
    databaseState = { version: 1, handbooks: [{ handbookId: 'HB-1' }] };
    fs.writeFileSync(file, JSON.stringify(databaseState));
    load();
    expect(info).toHaveBeenCalledWith(expect.stringContaining('手册资产校验通过：1 条'));
  });

  test('数据库模式的资产读写与 CAS 人员同步委托给领域仓储', async () => {
    databaseState = { version: 1, handbooks: [{ handbookId: 'HB-CAS' }] };
    fs.writeFileSync(file, JSON.stringify(databaseState));
    load();
    expect(await gatewayOptions.stores.knowledgeAssetsStore.readAsync()).toEqual(databaseState);
    const snapshot = { version: 2, handbooks: [] };
    gatewayOptions.stores.knowledgeAssetsStore.write(snapshot);
    expect(writtenSnapshot).toBe(snapshot);
    expect(authOptions.principalDirectory.upsertCas({ user: ' cas-user ', cn: ' CAS 用户 ' })).toEqual({ casLoginName: 'cas-user', displayName: 'CAS 用户', actor: 'system:cas' });
    expect(casPrincipal.casLoginName).toBe('cas-user');
  });

  test('没有显式凭据时发出默认凭据警告', () => {
    const keys = ['KNOWLEDGE_CENTER_ADMIN_USERNAME', 'KNOWLEDGE_CENTER_ADMIN_PASSWORD', 'KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_USERNAME', 'KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_PASSWORD'];
    const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    try {
      for (const key of keys) delete process.env[key];
      load();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('正在使用内置默认凭据'));
    } finally {
      Object.assign(process.env, saved);
    }
  });

  test('聚合不一致时提醒受控迁移，不读取共享数据库', () => {
    databaseState = { version: 1, handbooks: [] };
    fs.writeFileSync(file, JSON.stringify({ version: 1, handbooks: [{ handbookId: 'HB-2' }] }));
    load();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('文件源与数据库聚合不一致'));
  });

  test('源文件损坏时只记录启动校验失败，文件不存在时跳过校验', () => {
    fs.writeFileSync(file, '{invalid-json');
    load();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('启动校验失败'));
    warn.mockClear();
    fs.rmSync(file);
    load();
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('[assets-consistency]'));
  });
});
