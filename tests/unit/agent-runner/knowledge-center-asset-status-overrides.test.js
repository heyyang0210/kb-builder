const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');

jest.setTimeout(30000);

function jsonStore(initial) {
  let value = structuredClone(initial);
  return {
    read: jest.fn(() => structuredClone(value)),
    readAsync: jest.fn(async () => structuredClone(value)),
    write: jest.fn(next => {
      value = structuredClone(next);
      return next;
    }),
    writeAsync: jest.fn(async next => {
      value = structuredClone(next);
      return next;
    }),
    value: () => value,
    replace: next => { value = structuredClone(next); },
  };
}

describe('数据库模式知识资产状态覆盖', () => {
  let previousMode;
  let fixtureRoot;
  let server;
  let baseUrl;

  beforeEach(async () => {
    previousMode = process.env.KNOWLEDGE_STORAGE_MODE;
    process.env.KNOWLEDGE_STORAGE_MODE = 'database';
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-status-overrides-'));
  });

  afterEach(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    server = null;
    if (previousMode === undefined) delete process.env.KNOWLEDGE_STORAGE_MODE;
    else process.env.KNOWLEDGE_STORAGE_MODE = previousMode;
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  async function startHandler(stores, session = { user: { id: 'admin' }, roles: ['PLATFORM_ADMIN'], allowedActions: ['platform:manage', 'knowledge:read'] }, authUsers = []) {
    const templatePath = path.join(fixtureRoot, 'template.xlsx');
    const samplePath = path.join(fixtureRoot, 'sample.xlsx');
    fs.writeFileSync(templatePath, 'template');
    fs.writeFileSync(samplePath, 'sample');
    const handler = createKnowledgeCenterHandler({
      config: {
        KNOWLEDGE_CENTER_PREFIX: '/knowledge-center',
        KNOWLEDGE_CENTER_ROOT: fixtureRoot,
        KNOWLEDGE_CENTER_ENTRY: 'index.html',
        OUTLINE_TEMPLATE_PATH: templatePath,
        OUTLINE_SAMPLE_PATH: samplePath,
        PINGCODE_PREFIX: '/pingcode',
        PINGCODE_ROOT: fixtureRoot,
        GITLAB_CONFIG_PATH: path.join(fixtureRoot, 'gitlab.json'),
        GITLAB_DOCUMENT_TYPES_PATH: path.join(fixtureRoot, 'rules.json'),
      },
      stores: {
        ...stores,
        brandIconStore: {},
        domainStore: { readTechDomains: () => ({ techDomains: [] }), readPlatformGitLabMappingAsync: async () => null, ...stores.domainStore },
      },
      moduleRegistry: { get: () => ({ authorize: async () => session, repository: { listUsers: async () => authUsers } }) },
      sendFile(_file, res) { res.writeHead(404); res.end(); },
      proxyAuth() {},
      proxyCleaning() {},
      proxyOutline() {},
      proxyPermission() {},
      handleIncrementalBuild() {},
    });
    server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  }

  test('数据库列表仅加载当前页映射并保留中文单语言仓库版本', async () => {
    const readMapping = jest.fn(async id => ({ handbookId: id, defaultBranch: 'master', enabledBranches: ['master'], zhPaths: ['doc/中文'], enPaths: [] }));
    const manualStatusStore = jsonStore({ version: 1, statuses: {}, audits: [] });
    manualStatusStore.read.mockImplementation(() => { throw new Error('数据库模式不得同步读取人工状态覆盖'); });
    await startHandler({
      knowledgeAssetsStore: jsonStore({ handbooks: ['DB-004', 'DB-005'].map(handbookId => ({ handbookId, name: handbookId })) }),
      manualStatusStore,
      domainStore: { readPlatformGitLabMappingAsync: readMapping },
    });
    const response = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks?pageSize=1`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { total: 2, items: [{ handbookId: 'DB-004', repositoryMapped: true, repository: { defaultBranch: 'master', enabledBranches: ['master'] } }] } });
    expect(readMapping.mock.calls).toEqual([['DB-004']]);
  });

  test.each([
    [404, 'GITLAB_MAPPING_NOT_FOUND', 200],
    [503, 'DOMAIN_STORE_UNAVAILABLE', 503],
  ])('映射读取 %s %s 返回 %s，不把服务故障伪装成未映射', async (status, code, expectedStatus) => {
    await startHandler({
      knowledgeAssetsStore: jsonStore({ handbooks: [{ handbookId: 'DB-004', name: 'SQL参考手册' }] }),
      domainStore: { readPlatformGitLabMappingAsync: async () => { throw Object.assign(new Error(code), { status, code }); } },
    });
    const response = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks`);
    expect(response.status).toBe(expectedStatus);
    const result = await response.json();
    if (expectedStatus === 200) expect(result.data.items[0].repositoryMapped).toBe(false);
    else expect(result.error.code).toBe('ASSET_CONFIG_UNAVAILABLE');
  });

  test('修改手册人工状态不回写关系化手册快照且列表可见', async () => {
    const knowledgeAssetsStore = jsonStore({
      handbooks: [{
        handbookId: 'DB-041',
        name: 'mysql模式运维手册',
        productId: 1,
        productName: 'DB',
        outline: { outlineId: null, bindingStatus: 'not_created' },
        documentSummary: { total: 0, published: 0, inProgress: 0 },
        assetVersion: 13,
      }],
      audits: [],
    });
    const manualStatusStore = jsonStore({ version: 1, statuses: {}, audits: [] });
    manualStatusStore.read.mockImplementation(() => { throw new Error('数据库模式不得同步读取人工状态覆盖'); });
    await startHandler({ knowledgeAssetsStore, manualStatusStore });

    const changed = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks/DB-041/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetStatus: 'content_building', reason: '进入内容建设', expectedVersion: 13 }),
    });
    expect(changed.status).toBe(200);
    await expect(changed.json()).resolves.toMatchObject({
      data: { status: 'content_building', manualStatus: 'content_building', systemStatus: 'asset_created', assetVersion: 14 },
    });
    expect(knowledgeAssetsStore.write).not.toHaveBeenCalled();
    expect(manualStatusStore.write).toHaveBeenCalledWith(expect.objectContaining({
      statuses: expect.objectContaining({
        'DB-041': expect.objectContaining({ manualStatus: expect.objectContaining({ value: 'content_building' }), assetVersion: 14 }),
      }),
    }));
    expect(manualStatusStore.readAsync).toHaveBeenCalled();

    const listed = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks?page=1&pageSize=20`);
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toMatchObject({
      data: { items: [expect.objectContaining({ handbookId: 'DB-041', status: 'content_building', manualStatus: 'content_building', assetVersion: 14 })] },
    });

    const resolved = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks/DB-041/status/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'accept_system', expectedVersion: 14 }),
    });
    expect(resolved.status).toBe(200);
    await expect(resolved.json()).resolves.toMatchObject({
      data: { status: 'asset_created', manualStatus: null, assetVersion: 15 },
    });
    expect(knowledgeAssetsStore.write).not.toHaveBeenCalled();
    expect(manualStatusStore.write).toHaveBeenLastCalledWith(expect.objectContaining({
      statuses: expect.objectContaining({
        'DB-041': expect.objectContaining({ manualStatus: null, assetVersion: 15 }),
      }),
    }));

    const resolvedList = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks?page=1&pageSize=20`);
    expect(resolvedList.status).toBe(200);
    await expect(resolvedList.json()).resolves.toMatchObject({
      data: { items: [expect.objectContaining({ handbookId: 'DB-041', status: 'asset_created', manualStatus: null, assetVersion: 15 })] },
    });
  });

  test('存储写入失败返回 503 且前端请求进程继续存活', async () => {
    const knowledgeAssetsStore = jsonStore({
      handbooks: [{ handbookId: 'DB-503', name: '不可用存储手册', assetVersion: 1, documentSummary: { runningTasks: 0 } }],
      audits: [],
    });
    knowledgeAssetsStore.write.mockImplementation(() => { throw Object.assign(new Error('数据库暂不可用'), { code: 'DOMAIN_STORE_UNAVAILABLE', status: 503 }); });
    await startHandler({ knowledgeAssetsStore, manualStatusStore: jsonStore({ version: 1, statuses: {}, audits: [] }) });

    const response = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks/DB-503/archive`, { method: 'POST' });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: { code: 'DOMAIN_STORE_UNAVAILABLE' } });

    const health = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks?page=1&pageSize=20`);
    expect(health.status).toBe(200);
  });

  test('文件模式创建手册校验产品与责任人，并写入审计记录', async () => {
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    const knowledgeAssetsStore = jsonStore({ version: 1, handbooks: [{ handbookId: 'DB-001', productId: 'db', productName: 'DB', name: '已有手册' }], audits: [] });
    await startHandler({ knowledgeAssetsStore });
    const url = `${baseUrl}/knowledge-center/api/assets/handbooks`;
    const post = body => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    for (const body of [
      { name: '', productId: 'db' },
      { name: '新手册', productId: 'missing' },
      { name: '新手册', productId: 'db', ownerA: { principalId: 0, displayName: '无效人员' } },
      { name: '新手册', productId: 'db', ownerA: { principalId: 2, displayName: '甲' }, ownerB: { principalId: 2, displayName: '乙' } },
    ]) {
      const response = await post(body);
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('ASSET_CREATE_FAILED');
    }
    const created = await post({ name: ' 新手册 ', productId: 'db', ownerA: { principalId: 2, displayName: '甲' }, ownerB: { principalId: 3, displayName: '乙' }, externalVisible: true });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ data: { handbookId: 'DB-002', name: '新手册', ownerA: { principalId: 2 } } });
    expect(knowledgeAssetsStore.value().handbooks[1].externalVisible).toBe(true);
    expect(knowledgeAssetsStore.value()).toMatchObject({ audits: [{ action: 'ASSET_CREATED', handbookId: 'DB-002', operatorId: 'admin' }] });
    expect(knowledgeAssetsStore.value().handbooks).toHaveLength(2);
  });

  test('文件模式编辑校验版本和责任人，归档受运行任务保护', async () => {
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    const knowledgeAssetsStore = jsonStore({ version: 1, handbooks: [{ handbookId: 'DB-001', productId: 'db', productName: 'DB', name: '已有手册', assetVersion: 1, ownerA: { principalId: 2, displayName: '甲' }, documentSummary: { runningTasks: 1 } }], audits: [] });
    await startHandler({ knowledgeAssetsStore });
    const url = `${baseUrl}/knowledge-center/api/assets/handbooks/DB-001`;
    const patch = body => fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const stale = await patch({ expectedVersion: 0, name: '过期更新' });
    expect(stale.status).toBe(409);
    expect((await stale.json()).error.code).toBe('ASSET_VERSION_CONFLICT');
    const invalid = await patch({ expectedVersion: 1, ownerB: { principalId: 2, displayName: '同一人' } });
    expect(invalid.status).toBe(400);
    const missing = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks/missing`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedVersion: 1 }) });
    expect(missing.status).toBe(404);
    const changed = await patch({ expectedVersion: 1, name: ' 更新后 ', ownerB: { principalId: 3, displayName: '乙' } });
    expect(changed.status).toBe(200);
    expect(await changed.json()).toMatchObject({ data: { name: '更新后', assetVersion: 2, ownerB: { principalId: 3 } } });
    const blocked = await fetch(`${url}/archive`, { method: 'POST' });
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({ error: { code: 'ASSET_HAS_RUNNING_TASKS', details: { runningTasks: 1 } } });
    const payload = knowledgeAssetsStore.value();
    payload.handbooks[0].documentSummary.runningTasks = 0;
    knowledgeAssetsStore.replace(payload);
    const archived = await fetch(`${url}/archive`, { method: 'POST' });
    expect(archived.status).toBe(200);
    expect(knowledgeAssetsStore.value().handbooks[0].archivedAt).toEqual(expect.any(String));
    const restored = await fetch(`${url}/restore`, { method: 'POST' });
    expect(restored.status).toBe(200);
    expect(knowledgeAssetsStore.value().handbooks[0].archivedAt).toBeNull();
    expect(knowledgeAssetsStore.value().audits.map(entry => entry.action)).toEqual(['ASSET_UPDATED', 'ASSET_ARCHIVED', 'ASSET_RESTORED']);
  });
  function editableAssets() {
    return jsonStore({ version: 1, handbooks: [{
      handbookId: 'DB-001', productId: 'db', productName: 'DB', name: '公开接口手册',
      assetVersion: 4, ownerA: { principalId: 2, displayName: '甲' },
      ownerB: { principalId: 3, displayName: '乙' },
      manualStatus: { value: 'content_building', reason: '原人工判断' },
      outline: { bindingStatus: 'not_created' }, documentSummary: { runningTasks: 0 },
    }], audits: [] });
  }

  async function sendAsset(pathname, method, body) {
    return fetch(`${baseUrl}/knowledge-center/api/assets/${pathname}`, {
      method, headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  test.each([
    ['handbooks', 'DELETE'],
    ['handbooks/DB-001', 'POST'],
    ['handbooks/DB-001', 'DELETE'],
    ['handbooks/DB-001/archive', 'PATCH'],
    ['handbooks/DB-001/restore', 'GET'],
    ['handbooks/DB-001/status', 'GET'],
    ['handbooks/DB-001/status/resolve', 'PUT'],
  ])('%s 拒绝未支持的 %s 且不写入', async (pathname, method) => {
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    const store = editableAssets();
    await startHandler({ knowledgeAssetsStore: store });
    const before = structuredClone(store.value());
    const response = await sendAsset(pathname, method);
    expect(response.status).toBe(405);
    expect(await response.text()).toBe('');
    expect(store.value()).toEqual(before);
    expect(store.write).not.toHaveBeenCalled();
  });

  test.each([
    ['handbooks', 'POST'],
    ['handbooks/DB-001', 'PATCH'],
    ['handbooks/DB-001/status', 'POST'],
    ['handbooks/DB-001/status/resolve', 'POST'],
    ['catalog/DB-001', 'PATCH'],
  ])('普通阅读用户不能通过 %s %s 修改资产', async (pathname, method) => {
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    const store = editableAssets();
    await startHandler({ knowledgeAssetsStore: store }, {
      user: { id: 'reader' }, roles: ['KNOWLEDGE_READER'], allowedActions: ['knowledge:read'],
    });
    const response = await sendAsset(pathname, method, { expectedVersion: 4 });
    expect(response.status).toBe(403);
    expect((await response.json()).success).toBe(false);
    expect(store.write).not.toHaveBeenCalled();
    expect(store.value().handbooks[0].assetVersion).toBe(4);
  });

  test.each([
    [null, 'A 角为必填项'],
    ['', 'A 角为必填项'],
    ['手工输入的责任人', '责任人必须从人员列表中选择'],
    [{ id: 2, displayName: ' ' }, '责任人信息不完整，请重新选择'],
    [{ id: 1.5, displayName: '甲' }, '责任人信息不完整，请重新选择'],
  ])('创建拒绝无效 A 角 %j，保留原资产与审计', async (ownerA, message) => {
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    const store = editableAssets();
    await startHandler({ knowledgeAssetsStore: store });
    const response = await sendAsset('handbooks', 'POST', { productId: 'db', name: '新建', ownerA });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'ASSET_CREATE_FAILED', message } });
    expect(store.write).not.toHaveBeenCalled();
    expect(store.value().handbooks).toHaveLength(1);
    expect(store.value().audits).toEqual([]);
  });

  test('旧 catalog PATCH 兼容 userId 责任人并允许清空可选 B 角', async () => {
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    const store = editableAssets();
    await startHandler({ knowledgeAssetsStore: store });
    const response = await sendAsset('catalog/DB-001', 'PATCH', {
      expectedVersion: 4, name: ' 兼容更新 ', ownerA: { userId: 8, displayName: ' 新甲 ' }, ownerB: '',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: {
      name: '兼容更新', assetVersion: 5, ownerA: { principalId: 8, displayName: '新甲' }, ownerB: null,
    } });
    expect(store.value().audits).toEqual([expect.objectContaining({
      action: 'ASSET_UPDATED', handbookId: 'DB-001', operatorId: 'admin',
      details: expect.objectContaining({ after: expect.objectContaining({ ownerB: null }) }),
    })]);
    const listed = await sendAsset('handbooks', 'GET');
    expect((await listed.json()).data.items[0]).toMatchObject({ name: '兼容更新', assetVersion: 5, ownerB: null });
  });

  test.each([
    [{ expectedVersion: 3, action: 'keep_manual', reason: '仍采用人工判断' }, 409, 'ASSET_VERSION_CONFLICT'],
    [{ expectedVersion: 4, action: 'unknown' }, 400, 'ASSET_STATUS_RESOLUTION_INVALID'],
    [{ expectedVersion: 4 }, 400, 'ASSET_STATUS_RESOLUTION_INVALID'],
    [{ expectedVersion: 4, action: 'keep_manual', reason: '  ' }, 400, 'STATUS_REASON_REQUIRED'],
  ])('冲突处理拒绝 %j 后允许使用当前版本重试', async (body, status, code) => {
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    const store = editableAssets();
    await startHandler({ knowledgeAssetsStore: store });
    const response = await sendAsset('handbooks/DB-001/status/resolve', 'POST', body);
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error: { code } });
    expect(store.write).not.toHaveBeenCalled();
    const retry = await sendAsset('handbooks/DB-001/status/resolve', 'POST', {
      expectedVersion: 4, action: 'keep_manual', reason: '  经核实保留人工状态  ',
    });
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ data: { status: 'content_building', manualStatus: 'content_building', assetVersion: 5 } });
    expect(store.value().handbooks[0].manualStatus).toMatchObject({
      value: 'content_building', reason: '经核实保留人工状态', updatedBy: 'admin', acknowledgedSystemStatus: 'asset_created',
    });
    expect(store.value().audits).toEqual([expect.objectContaining({
      action: 'ASSET_STATUS_CONFLICT_RESOLVED', details: expect.objectContaining({ action: 'keep_manual', before: 'content_building', after: 'content_building' }),
    })]);
    const listed = await sendAsset('handbooks', 'GET');
    expect((await listed.json()).data.items[0]).toMatchObject({ status: 'content_building', assetVersion: 5 });
  });

  test('不存在的手册不能执行状态冲突处理或归档', async () => {
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    const store = editableAssets();
    await startHandler({ knowledgeAssetsStore: store });
    for (const pathname of ['handbooks/missing/status/resolve', 'handbooks/missing/archive']) {
      const response = await sendAsset(pathname, 'POST', { expectedVersion: 4, action: 'accept_system' });
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ error: { code: 'ASSET_NOT_FOUND' } });
    }
    expect(store.write).not.toHaveBeenCalled();
  });

  test.each([
    ['documents/doc/quality', 'PUT', 'GET, POST'],
    ['documents/doc/quality/report-1', 'POST', 'GET, POST'],
    [`documents/doc/ai-sources/images/${'a'.repeat(64)}`, 'DELETE', 'GET'],
    ['documents/doc/ai-sources', 'PATCH', 'GET, POST'],
    ['documents/doc/ai-sources/uploads', 'GET', 'POST'],
    ['documents/doc/ai-jobs', 'PUT', 'GET, POST, DELETE'],
    ['documents/doc/ai-jobs/job-1/cancel', 'GET', 'GET, POST, DELETE'],
    ['documents/doc/draft', 'DELETE', 'GET, PUT, POST'],
    ['documents/doc/draft/revisions', 'POST', 'GET, PUT, POST'],
    ['documents/doc/draft/restore', 'GET', 'GET, PUT, POST'],
    ['documents/doc/draft-attachments', 'GET', 'GET, PUT, POST'],
    ['reviewers', 'DELETE', 'GET, PUT, POST'],
    ['incremental-reviews', 'GET', 'GET, PUT, POST'],
    ['review-drafts', 'POST', 'GET, PUT, POST'],
  ])('文档生产 %s 拒绝 %s 并声明允许方法', async (suffix, method, allow) => {
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    const store = editableAssets();
    await startHandler({ knowledgeAssetsStore: store });
    const response = await fetch(`${baseUrl}/knowledge-center/api/production/handbooks/DB-001/${suffix}`, { method });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe(allow);
    expect(await response.text()).toBe('');
    expect(store.write).not.toHaveBeenCalled();
  });

  test('审核人投影按权限与可见手册筛选并兼容人员标识和名称', async () => {
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    const users = [
      { principalId: 11, displayName: '具名审核人', roles: ['REVIEWER'], visibleHandbookIds: ['DB-001'] },
      { id: 'admin-2', name: '平台管理员', roles: ['PLATFORM_ADMIN'] },
      { userId: 'review-manager', loginName: 'manager', allowedActions: ['review:manage'] },
      { id: 'unnamed', roles: ['REVIEWER'] },
      { id: 'hidden', roles: ['REVIEWER'], visibleHandbookIds: ['DB-002'] },
      { id: 'reader', roles: ['KNOWLEDGE_READER'], visibleHandbookIds: ['DB-001'] },
      { id: 'no-access' },
    ];
    await startHandler({ knowledgeAssetsStore: editableAssets() }, undefined, users);
    const response = await fetch(`${baseUrl}/knowledge-center/api/production/handbooks/DB-001/reviewers`);
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.items).toEqual([
      { id: '11', displayName: '具名审核人', roles: ['REVIEWER'], handbookId: 'DB-001', disabled: false, disabledReason: null },
      { id: 'admin-2', displayName: '平台管理员', roles: ['PLATFORM_ADMIN'], handbookId: 'DB-001', disabled: false, disabledReason: null },
      { id: 'review-manager', displayName: 'manager', roles: [], handbookId: 'DB-001', disabled: false, disabledReason: null },
      { id: 'unnamed', displayName: '未命名审核人', roles: ['REVIEWER'], handbookId: 'DB-001', disabled: false, disabledReason: null },
    ]);
  });

});
