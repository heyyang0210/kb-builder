const http = require('node:http');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const messages = require('../../../config/knowledge-center/content-rules.json').handbookValidation;
const outlineRules = require('../../../config/knowledge-center/content-rules.json').outlineTemplate;

const owner = { principalId: 1, userId: 1, id: 1, displayName: '负责人' };
const handbook = (overrides = {}) => ({
  handbookId: 'DB-001', name: '原手册', productId: 1, productName: 'DB',
  ownerA: owner, ownerB: null, assetVersion: 1, ...overrides,
});

describe('手册重名提示：真实 HTTP、隔离内存存储', () => {
  let server, baseUrl, payload, store, manualStatusStore, admin, originalMode;
  beforeEach(async () => {
    originalMode = process.env.KNOWLEDGE_STORAGE_MODE;
    process.env.KNOWLEDGE_STORAGE_MODE = 'database';
    admin = true;
    payload = { handbooks: [handbook()], audits: [] };
    store = {
      read: jest.fn(() => structuredClone(payload)),
      readAsync: jest.fn(async () => store.read()),
      write: jest.fn(next => { payload = structuredClone(next); }),
    };
    manualStatusStore = {
      read: jest.fn(() => ({ statuses: {}, audits: [] })),
      write: jest.fn(),
    };
    const handler = createKnowledgeCenterHandler({
      documentTasksOptions: {
        store: {
          readAsync: async () => { throw new Error('本测试不应读取文档任务'); },
          write: () => { throw new Error('本测试不应写入文档任务'); },
        },
      },
      config: {
        KNOWLEDGE_CENTER_PREFIX: '/knowledge-center',
        KNOWLEDGE_CENTER_ROOT: __dirname,
        KNOWLEDGE_CENTER_ENTRY: 'index.html',
        OUTLINE_TEMPLATE_PATH: path.resolve(outlineRules.templatePath),
        OUTLINE_SAMPLE_PATH: path.resolve(outlineRules.sampleDownloadPath),
        GITLAB_CONFIG_PATH: __filename,
        GITLAB_DOCUMENT_TYPES_PATH: __filename,
      },
      stores: {
        knowledgeAssetsStore: store, manualStatusStore, brandIconStore: {}, templateStore: {},
        domainStore: { readTechDomains: () => ({ techDomains: [] }) },
      },
      moduleRegistry: { get: () => ({ authorize: async () => ({
        user: { id: 'test-admin' }, roles: admin ? ['PLATFORM_ADMIN'] : ['AUTHOR'],
        allowedActions: admin ? ['platform:manage', 'knowledge:read'] : ['knowledge:read'],
      }) }) },
      sendFile(_file, res) { res.writeHead(404); res.end(); },
      proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {},
      handleIncrementalBuild() {},
      databaseConnectionGovernance: {}, modelGovernance: {}, mcpGovernance: {}, handbookProductionService: {},
      templateMappingService: {}, agentGovernance: {}, codexRunner: {},
    });
    server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  afterEach(async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
      server = null;
    }
    if (originalMode === undefined) delete process.env.KNOWLEDGE_STORAGE_MODE;
    else process.env.KNOWLEDGE_STORAGE_MODE = originalMode;
  });

  async function request(method, changes = {}, suffix = '') {
    const body = method === 'POST'
      ? { name: '目标手册', productId: '1', ownerA: owner, ...changes }
      : { name: '目标手册', expectedVersion: 1, ...changes };
    const response = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks${method === 'PATCH' ? '/DB-001' : ''}${suffix}`, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: response.status, ...(await response.json()) };
  }

  function expectUntouched(before) {
    expect(payload).toEqual(before);
    expect(store.write).not.toHaveBeenCalled();
    expect(manualStatusStore.write).not.toHaveBeenCalled();
  }

  test.each(['POST', 'PATCH'].flatMap(method => [false, true].map(inactive => [method, inactive])))(
    '%s 拒绝在用/停用重名 %s，无任何保存或对象修改', async (method, inactive) => {
      payload.handbooks.push(handbook({ handbookId: 'DB-041', name: '目标手册',
        archivedAt: inactive ? '2026-09-22T08:44:06.254Z' : null }));
      // Return the original object too: a failing precheck must not mutate it.
      store.read.mockImplementation(() => payload);
      const before = structuredClone(payload);
      expect(await request(method, { name: '  目标手册  ' })).toEqual({
        status: 400, success: false,
        error: { code: method === 'POST' ? 'ASSET_CREATE_FAILED' : 'ASSET_UPDATE_FAILED',
          message: inactive ? messages.duplicateInactiveName : messages.duplicateName },
      });
      expectUntouched(before);
    });

  test('新建检查完整集合中的后排停用记录', async () => {
    payload.handbooks.push(...Array.from({ length: 105 }, (_, i) => handbook({
      handbookId: `DB-X${i}`, name: `手册${i}`,
    })), handbook({ handbookId: 'DB-999', name: '目标手册', archivedAt: '2026-09-22' }));
    expect((await request('POST')).error.message).toBe(messages.duplicateInactiveName);
    expect(store.write).not.toHaveBeenCalled();
  });

  test.each(['POST', 'PATCH'])('%s 跨产品同名允许，正常保存 trim 后的名称', async method => {
    payload.handbooks.push(handbook({ handbookId: 'YMP-001', name: '目标手册', productId: 2, productName: 'YMP' }));
    const result = await request(method, { name: '  目标手册  ' });
    expect(result.status).toBe(method === 'POST' ? 201 : 200);
    expect(result.data.name).toBe('目标手册');
    expect(store.write).toHaveBeenCalledTimes(1);
  });

  test.each(['POST', 'PATCH'])('%s 不引入忽略大小写或模糊匹配', async method => {
    payload.handbooks.push(handbook({ handbookId: 'DB-002', name: 'SQL参考手册' }));
    expect((await request(method, { name: 'sql参考手册' })).success).toBe(true);
  });

  test('编辑排除自身；名称未改变，即使存在历史重名也不新增阻断', async () => {
    payload.handbooks.push(handbook({ handbookId: 'DB-002' }));
    expect((await request('PATCH', { name: ' 原手册 ', ownerB: { ...owner, principalId: 2, userId: 2, id: 2 } })).status).toBe(200);
    expect(store.write).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['POST', { name: '' }, 400, '手册名称和产品为必填项'],
    ['POST', { ownerA: null }, 400, 'A 角为必填项'],
    ['POST', { ownerB: owner }, 400, 'A 角和 B 角不能是同一人'],
    ['PATCH', { expectedVersion: 0 }, 409, '手册信息已变化，请刷新后重试'],
    ['PATCH', { name: '' }, 400, '手册名称不能为空'],
    ['PATCH', { ownerA: null }, 400, 'A 角为必填项'],
    ['PATCH', { ownerB: owner }, 400, 'A 角和 B 角不能是同一人'],
  ])('%s 原校验优先且无副作用 %j', async (method, changes, status, message) => {
    payload.handbooks.push(handbook({ handbookId: 'DB-002', name: '目标手册' }));
    store.read.mockImplementation(() => payload);
    const before = structuredClone(payload);
    const result = await request(method, changes);
    expect(result.status).toBe(status);
    expect(result.error.message).toBe(message);
    expectUntouched(before);
  });

  test.each(['POST', 'PATCH'])('%s 权限拒绝不进入重名检查', async method => {
    admin = false;
    expect(await request(method)).toMatchObject({
      status: 403, error: { code: 'PLATFORM_ADMIN_REQUIRED', message: '仅平台管理员可维护手册资产' },
    });
    expect(store.read).not.toHaveBeenCalled();
    expect(store.write).not.toHaveBeenCalled();
  });

  test.each(['POST', 'PATCH'].flatMap(method => [false, true].map(inactive => [method, inactive])))(
    '%s 并发后确认重名 %s：只替换 message，不重试写入', async (method, inactive) => {
      store.write.mockImplementation(() => {
        payload.handbooks.push(handbook({ handbookId: 'DB-099', name: '目标手册',
          archivedAt: inactive ? '2026-09-22' : null }));
        throw Object.assign(new Error('手册领域读写失败'), { code: 'DATABASE_UNAVAILABLE', status: 503 });
      });
      expect(await request(method)).toEqual({
        status: method === 'POST' ? 400 : 503, success: false,
        error: { code: method === 'POST' ? 'ASSET_CREATE_FAILED' : 'DATABASE_UNAVAILABLE',
          message: inactive ? messages.duplicateInactiveName : messages.duplicateName },
      });
      expect(store.read).toHaveBeenCalledTimes(2);
      expect(store.write).toHaveBeenCalledTimes(1);
    });

  test.each(['POST', 'PATCH'].flatMap(method =>
    ['no-conflict', 'read-failure', 'other-error', 'same-id'].map(scenario => [method, scenario])))(
    '%s 保存失败保留原异常：%s', async (method, scenario) => {
      const code = scenario === 'other-error' ? 'DOMAIN_UNAVAILABLE' : 'DATABASE_UNAVAILABLE';
      store.write.mockImplementation(next => {
        if (scenario === 'read-failure') store.read.mockImplementation(() => { throw new Error('读取失败'); });
        if (scenario === 'same-id') payload = structuredClone(next);
        if (scenario === 'other-error') payload.handbooks.push(handbook({ handbookId: 'DB-099', name: '目标手册' }));
        throw Object.assign(new Error('原始存储错误'), { code, status: 503 });
      });
      expect(await request(method)).toEqual({
        status: method === 'POST' ? 400 : 503, success: false,
        error: { code: method === 'POST' ? 'ASSET_CREATE_FAILED' : code, message: '原始存储错误' },
      });
      expect(store.read).toHaveBeenCalledTimes(scenario === 'other-error' ? 1 : 2);
      expect(store.write).toHaveBeenCalledTimes(1);
    });

  test('编辑名称未改变，存储失败不额外查询或替换提示', async () => {
    store.write.mockImplementation(() => {
      throw Object.assign(new Error('原始错误'), { code: 'DATABASE_UNAVAILABLE', status: 503 });
    });
    expect((await request('PATCH', { name: '原手册' })).error.message).toBe('原始错误');
    expect(store.read).toHaveBeenCalledTimes(1);
  });

  test('停用和恢复继续使用原有生命周期保存', async () => {
    expect((await request('POST', {}, '/DB-001/archive')).status).toBe(200);
    expect(payload.handbooks[0].status).toBe('archived');
    expect(payload.handbooks[0].archivedAt).toBeTruthy();
    expect((await request('POST', {}, '/DB-001/restore')).status).toBe(200);
    expect(payload.handbooks[0].status).toBe('active');
    expect(payload.handbooks[0].archivedAt).toBeNull();
    expect(store.write).toHaveBeenCalledTimes(2);
  });

  test('停用保存失败不套用重名错误补查', async () => {
    store.write.mockImplementation(() => {
      throw Object.assign(new Error('停用存储错误'), { code: 'DATABASE_UNAVAILABLE', status: 503 });
    });
    expect(await request('POST', {}, '/DB-001/archive')).toMatchObject({
      status: 503, error: { code: 'DATABASE_UNAVAILABLE', message: '停用存储错误' },
    });
    expect(store.read).toHaveBeenCalledTimes(1);
  });

  test('阶段维护仍仅保存状态覆盖，不进入手册重名检查或快照写入', async () => {
    payload.handbooks.push(handbook({ handbookId: 'DB-002' }));
    expect((await request('POST', {
      targetStatus: 'outline_editing', reason: '测试阶段维护', expectedVersion: 1,
    }, '/DB-001/status')).status).toBe(200);
    expect(store.write).not.toHaveBeenCalled();
    expect(manualStatusStore.write).toHaveBeenCalledTimes(1);
  });
});
