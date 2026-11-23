const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const { projectCatalog } = require('../../../packages/agent-runner-core/lib/document-task-catalog');

describe('统一入口清洗与任务上下文真实HTTP边界', () => {
  let root, server, base, session, directory, assets, principalRead, catalog, configPath, proxies, createDocument;
  let previousStorage, previousPlatform;
  let assetRead, assetWrite, techDomainRead;
  const runtimeRoot = path.resolve(__dirname, '../../../runtime/test-results');
  beforeEach(() => {
    previousStorage = process.env.KNOWLEDGE_STORAGE_MODE;
    previousPlatform = process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE;
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE = 'file';
    fs.mkdirSync(runtimeRoot, { recursive: true });
    root = fs.mkdtempSync(path.join(runtimeRoot, 'gateway-context-'));
    configPath = path.join(root, 'gitlab.json');
    fs.writeFileSync(path.join(root, 'template.xlsx'), 'fixture');
    fs.writeFileSync(path.join(root, 'sample.xlsx'), 'fixture');
    fs.writeFileSync(configPath, JSON.stringify({ connections: [{ id: 'repo', host: 'https://gitlab.example.test', project: 'team/docs' }], mappings: [] }));
    session = { authenticated: true, user: { id: 'reader' }, allowedActions: ['knowledge:read', 'knowledge:write'] };
    directory = { items: [
      { id: 'display', displayName: '显示名' }, { principalId: 'name', name: '姓名', state: 'ACTIVE' },
      { id: 'login', loginName: '登录名' }, { id: 'fallback' }, { id: 'disabled', state: 'disabled' },
      { id: 'disabled-flag', displayName: '禁用人员', state: 'ACTIVE', enabled: false },
    ] };
    assets = { generatedAt: '2026-11-10', handbooks: [
      { handbookId: 'h1', name: '可见手册', assetVersion: 1, ownerA: { principalId: 'display' } },
      { handbookId: 'h2', name: '无责任人' },
      { handbookId: 'h3', name: '失效责任人', ownerA: { principalId: 'disabled' } },
      { handbookId: 'archived', archivedAt: '2026-11-01' },
    ] };
    assetRead = jest.fn(() => assets);
    assetWrite = jest.fn(payload => { assets = payload; });
    techDomainRead = jest.fn(() => ({ techDomains: [{ name: '内核' }] }));
    principalRead = jest.fn(async () => directory);
    catalog = jest.fn(async () => ({ versions: ['23.4', 'main'], documents: [], chapters: [] }));
    createDocument = jest.fn(async () => ({ outlineId: 'outline-new', documentId: 'doc-new' }));
    proxies = [];
  });
  afterEach(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); server = null; }
    fs.rmSync(root, { recursive: true, force: true });
    for (const [key, value] of [['KNOWLEDGE_STORAGE_MODE', previousStorage], ['KNOWLEDGE_PLATFORM_CONFIG_MODE', previousPlatform]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  async function start({ proxy = true, databaseConnectionGovernance } = {}) {
    const handler = createKnowledgeCenterHandler({
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, KNOWLEDGE_CENTER_ENTRY: 'index.html', GITLAB_CONFIG_PATH: configPath,
        OUTLINE_TEMPLATE_PATH: path.join(root, 'template.xlsx'), OUTLINE_SAMPLE_PATH: path.join(root, 'sample.xlsx') },
      stores: { knowledgeAssetsStore: { read: () => assetRead(), write: payload => assetWrite(payload) }, manualStatusStore: {}, brandIconStore: {}, domainStore: { readPrincipalsAsync: () => principalRead(), readTechDomains: () => techDomainRead() } },
      moduleRegistry: { get: name => name === 'auth' ? { authorize: req => ({ ...session,
        ...(req.headers['x-visible'] ? { visibleHandbookIds: [req.headers['x-visible']] } : {}) }) } : null },
      handbookProductionService: {},
      ...(databaseConnectionGovernance ? { databaseConnectionGovernance } : {}),
      documentTasksOptions: { filePath: path.join(root, 'tasks.json'), defaultOwnerId: 'reader' },
      documentTaskCatalog: (id, actor) => catalog(id, actor),
      documentTaskCreateDocument: (id, proposal, actor) => createDocument(id, proposal, actor),
      ...(proxy ? { proxyCleaning: (req, res, context) => {
        proxies.push({ url: req.url, ...context });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { endpoint: context.endpoint.id } }));
      } } : {}),
      sendFile(_file, res) { res.writeHead(404); res.end(); },
    });
    server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/knowledge-center/api`;
  }
  async function request(suffix, options) {
    const response = await fetch(base + suffix, options);
    return { status: response.status, cache: response.headers.get('cache-control'), ...await response.json() };
  }
  test('资产目录读取返回原始配置，失败隐藏内部错误且后续请求恢复', async () => {
    await start();
    expect(await request('/assets/catalog')).toMatchObject({ status: 200, cache: 'no-store', success: true, data: assets });
    assetRead.mockImplementationOnce(() => { throw new Error('isolated private storage path'); });
    const failed = await request('/assets/catalog');
    expect(failed).toEqual({ status: 503, cache: 'no-store', success: false, error: { code: 'ASSET_CONFIG_UNAVAILABLE', message: '手册资产配置暂不可用' } });
    expect(JSON.stringify(failed)).not.toContain('private');
    expect(await request('/assets/catalog')).toMatchObject({ status: 200, data: assets });
  });
  test('资产目录PATCH要求管理员并执行乐观版本更新', async () => {
    await start();
    const patch = expectedVersion => request('/assets/catalog/h1', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '更新后的手册', expectedVersion }),
    });
    expect(await patch(1)).toMatchObject({ status: 403, success: false });
    expect(assetWrite).not.toHaveBeenCalled();

    session.roles = ['PLATFORM_ADMIN'];
    const updated = await patch(1);
    expect(updated).toMatchObject({ status: 200, success: true, data: { handbookId: 'h1', name: '更新后的手册', assetVersion: 2 } });
    expect(assetWrite).toHaveBeenCalledTimes(1);
    expect(assets.handbooks[0]).toMatchObject({ name: '更新后的手册', assetVersion: 2 });

    const stale = await patch(1);
    expect(stale.status).toBe(409);
    expect(assetWrite).toHaveBeenCalledTimes(1);
    expect(assets.handbooks[0]).toMatchObject({ name: '更新后的手册', assetVersion: 2 });
  });
  test('样例下载在文件消失和文件变为目录时返回稳定错误，恢复后可下载', async () => {
    session.allowedActions.push('outline:read');
    await start();
    const file = path.join(root, 'sample.xlsx');
    fs.unlinkSync(file);
    expect(await request('/outline/sample')).toMatchObject({ status: 404, cache: 'no-store', error: { code: 'OUTLINE_SAMPLE_UNAVAILABLE', message: '大纲工作簿暂不可用' } });
    fs.mkdirSync(file);
    expect(await request('/outline/sample')).toMatchObject({ status: 503, cache: 'no-store', error: { code: 'OUTLINE_SAMPLE_UNAVAILABLE' } });
    fs.rmdirSync(file); fs.writeFileSync(file, 'restored sample');
    const response = await fetch(base + '/outline/sample');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('spreadsheetml.sheet');
    expect(response.headers.get('content-disposition')).toContain("filename*=UTF-8''");
    expect(await response.text()).toBe('restored sample');
  });
  test.each([
    ['缺失', null, 'TECH_DOMAINS_UNAVAILABLE'],
    ['未声明错误码', new Error('private domain failure'), 'TECH_DOMAINS_UNAVAILABLE'],
    ['已声明错误码', Object.assign(new Error('private domain failure'), { code: 'DOMAIN_READ_FAILED' }), 'DOMAIN_READ_FAILED'],
  ])('数据库技术领域%s时模板拒绝生成，配置恢复后正常下载', async (_label, result, code) => {
    process.env.KNOWLEDGE_STORAGE_MODE = 'database';
    session.allowedActions.push('outline:read');
    techDomainRead.mockImplementationOnce(() => { if (result instanceof Error) throw result; return result; });
    await start();
    const failed = await request('/outline/template');
    expect(failed).toMatchObject({ status: 503, cache: 'no-store', error: { code, message: '大纲模板暂不可用' } });
    expect(JSON.stringify(failed)).not.toContain('private');
    const response = await fetch(base + '/outline/template');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('spreadsheetml.sheet');
    const bytes = Buffer.from(await response.arrayBuffer());
    const XLSX = require('xlsx');
    const workbook = XLSX.read(bytes, { type: 'buffer' });
    expect(XLSX.utils.sheet_to_json(workbook.Sheets['技术领域'], { header: 1 })).toEqual([['技术领域名称'], ['内核']]);
  });
  test('数据库配置与健康治理经HTTP传递版本、操作者及强制刷新参数', async () => {
    const governance = Object.fromEntries(['projection', 'save', 'test', 'currentHealth', 'refreshHealth']
      .map(method => [method, jest.fn(async () => ({ method }))]));
    governance.projection.mockImplementation(() => ({ method: 'projection' }));
    governance.currentHealth.mockImplementation(() => ({ method: 'currentHealth' }));
    await start({ databaseConnectionGovernance: governance });
    const route = '/platform/database-connection';
    expect(await request(route)).toMatchObject({ status: 403, error: { code: 'PLATFORM_ADMIN_REQUIRED' } });
    expect(governance.projection).not.toHaveBeenCalled();
    session.allowedActions.push('platform:manage');
    const write = (method, body, headers = {}) => ({ method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    expect(await request(route)).toMatchObject({ status: 200, cache: 'no-store', data: { method: 'projection' } });
    expect(await request(route, write('PUT', { rowVersion: 3, host: 'fixture' }, { 'If-Match': '7' }))).toMatchObject({ status: 200, data: { method: 'save' } });
    expect(governance.save).toHaveBeenLastCalledWith({ rowVersion: 3, host: 'fixture' }, '7', { actorId: 'reader' });
    expect(await request(route, write('PUT', { rowVersion: 4 }))).toMatchObject({ status: 200 });
    expect(governance.save).toHaveBeenLastCalledWith({ rowVersion: 4 }, 4, { actorId: 'reader' });
    expect(await request(route + '/test', write('POST', { host: 'fixture' }))).toMatchObject({ status: 200, cache: 'no-store', data: { method: 'test' } });
    expect(governance.test).toHaveBeenCalledWith({ host: 'fixture' });
    expect(await request(route + '/status')).toMatchObject({ status: 200, data: { method: 'currentHealth' } });
    expect(await request(route + '/status', { method: 'POST' })).toMatchObject({ status: 200, data: { method: 'refreshHealth' } });
    expect(governance.refreshHealth).toHaveBeenCalledWith({ force: true });
    for (const [suffix, method, allow] of [['', 'DELETE', 'GET, PUT'], ['/test', 'GET', 'POST'], ['/status', 'DELETE', 'GET, POST']]) {
      const response = await fetch(base + route + suffix, { method });
      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe(allow);
      expect(await response.text()).toBe('');
    }
    for (const [error, status, code, message, retryable] of [
      [Object.assign(new Error('隔离连接不可用'), { status: 503, code: 'DATABASE_DOWN' }), 503, 'DATABASE_DOWN', '隔离连接不可用', true],
      [Object.assign(new Error('版本冲突'), { status: 409, code: 'VERSION_CONFLICT' }), 409, 'VERSION_CONFLICT', '版本冲突', false],
      [new Error(), 503, 'DATABASE_CONNECTION_ERROR', '数据库连接操作失败', false],
    ]) {
      governance.test.mockRejectedValueOnce(error);
      const response = await request(route + '/test', write('POST', {}));
      expect(response).toMatchObject({ status, cache: 'no-store', success: false, error: { code, message, retryable } });
      expect(Number.isNaN(Date.parse(response.error.serverTime))).toBe(false);
    }
  });
  test('清洗路径白名单、管理员权限及代理端点元数据', async () => {
    await start();
    expect(await request('/cleaning/private')).toMatchObject({ status: 405, error: { code: 'CLEANING_ROUTE_NOT_ALLOWED', retryable: false } });
    expect(await request('/cleaning/workbench/summary')).toMatchObject({ status: 403, error: { code: 'PLATFORM_ADMIN_REQUIRED', retryable: false } });
    expect(proxies).toHaveLength(0);
    session.allowedActions.push('platform:manage');
    expect(await request('/cleaning/workbench/summary?refresh=true')).toMatchObject({ status: 200, data: { endpoint: 'workbench-summary' } });
    expect(proxies).toEqual([expect.objectContaining({ url: '/knowledge-center/api/cleaning/workbench/summary?refresh=true', session, endpoint: expect.objectContaining({ operation: 'query', action: 'knowledge:read' }) })]);
  });
  test('未配置清洗代理时返回可重试不可用', async () => {
    await start({ proxy: false });
    expect(await request('/cleaning/workbench/summary')).toMatchObject({ status: 503, cache: 'no-store', error: { code: 'MATERIAL_PROCESSING_UNAVAILABLE', retryable: true } });
  });
  test('人员名称回退、停用人员与归档过滤、无效责任人置空', async () => {
    await start();
    expect(await request('/document-tasks/context')).toMatchObject({ status: 200, data: {
      people: [{ id: 'display', displayName: '显示名' }, { id: 'name', displayName: '姓名' }, { id: 'login', displayName: '登录名' }, { id: 'fallback', displayName: 'fallback' }],
      handbooks: [{ id: 'h1', ownerId: 'display', productType: null }, { id: 'h2', ownerId: null, productType: null }, { id: 'h3', ownerId: null, productType: null }],
      actorId: 'reader', canWrite: true,
    } });
    session.allowedActions.push('platform:manage');
    const config = (await request('/document-tasks/config')).data;
    const invalid = await request('/document-tasks/config', { method: 'PUT', headers: { 'content-type': 'application/json', 'idempotency-key': 'disabled-person' },
      body: JSON.stringify({ expectedRevision: config.revision, defaultOwnerId: 'disabled-flag' }) });
    expect(invalid).toMatchObject({ status: 422, error: { code: 'PERSON_INVALID' } });
    session.user.visibleHandbookIds = ['h2'];
    const scoped = await request('/document-tasks/context');
    expect(scoped.data.handbooks).toEqual([{ id: 'h2', name: '无责任人', ownerId: null, productType: null }]);
    directory = {};
    assets = { generatedAt: '2026-11-10' };
    expect(await request('/document-tasks/context')).toMatchObject({ status: 200, data: { people: [], handbooks: [] } });
  });
  test('目录映射合并去重、无映射回退及损坏连接错误', async () => {
    await start();
    const absent = await request('/document-tasks/catalog?handbookId=h1');
    expect(absent).toMatchObject({ status: 200, data: { versions: ['23.4', 'main'] } });
    const config = JSON.parse(fs.readFileSync(configPath));
    config.mappings.push({ handbookId: 'h1', connectionId: 'repo', defaultBranch: 'main', enabledBranches: ['next', 'main', ''] });
    fs.writeFileSync(configPath, JSON.stringify(config));
    expect(await request('/document-tasks/catalog?handbookId=h1')).toMatchObject({ status: 200, data: { versions: ['23.4', 'main', 'next'] } });
    delete config.mappings[0].enabledBranches;
    fs.writeFileSync(configPath, JSON.stringify(config));
    expect(await request('/document-tasks/catalog?handbookId=h1')).toMatchObject({ status: 200, data: { versions: ['23.4', 'main'] } });
    config.connections = [];
    fs.writeFileSync(configPath, JSON.stringify(config));
    expect(await request('/document-tasks/catalog?handbookId=h1')).toMatchObject({ status: 404, error: { code: 'GITLAB_CONNECTION_NOT_FOUND' } });
    expect(catalog).toHaveBeenCalledWith('h1', expect.objectContaining({ user: { id: 'reader' } }));
  });
  test('目录保留一致主责及旧领域唯一负责人，冲突时不推测', async () => {
    const bound = (assigneeId, extra = {}) => ({ assigneeId, status: 'bound', ...extra });
    const assignments = [
      { nodeId: 'same', ownerships: [bound('a', { domainRole: 'PRIMARY' }), bound('a', { domainRole: 'PRIMARY' })] },
      { nodeId: 'legacy', techDomainIds: ['db'], ownerships: [bound('b', { techDomainId: 'db' }), bound('c', { techDomainId: 'other' })] },
      { nodeId: 'ambiguous', techDomainIds: ['db'], ownerships: [bound('b', { techDomainId: 'db' }), bound('c', { techDomainId: 'db' })] },
      { nodeId: 'conflict', ownerships: [bound('a', { domainRole: 'PRIMARY' }), bound('b', { domainRole: 'PRIMARY' })] },
    ];
    catalog.mockImplementation(async () => projectCatalog({ directory: {
      id: 'outline', state: 'published', nodes: assignments.map(({ nodeId }) => ({ id: nodeId, kind: 'document' })),
      governance: { effectiveDocumentAssignments: assignments },
    } }));
    await start();
    const result = await request('/document-tasks/catalog?handbookId=h1');
    expect(result.status).toBe(200);
    expect(result.data.documents.map(({ id, ownerId, ownerMatch }) => ({ id, ownerId, ownerMatch }))).toEqual([
      { id: 'same', ownerId: 'a', ownerMatch: 'primary' },
      { id: 'legacy', ownerId: 'b', ownerMatch: 'primary' },
      { id: 'ambiguous', ownerId: null, ownerMatch: 'unassigned' },
      { id: 'conflict', ownerId: null, ownerMatch: 'unassigned' },
    ]);
  });
  test.each([
    [Object.assign(new Error('目录暂不可用'), { status: 502, code: 'DIRECTORY_DOWN' }), 502, 'DIRECTORY_DOWN', '目录暂不可用'],
    [{}, 503, 'TASK_CONTEXT_UNAVAILABLE', '任务目录暂不可用'],
  ])('目录读取失败返回错误并允许下次恢复：%j', async (error, status, code, message) => {
    principalRead.mockRejectedValueOnce(error);
    await start();
    expect(await request('/document-tasks/context')).toMatchObject({ status, error: { code, message } });
    expect(await request('/document-tasks/context')).toMatchObject({ status: 200, data: { actorId: 'reader' } });
    expect(principalRead).toHaveBeenCalledTimes(2);
  });
  test('任务新增文档通过统一入口转交真实会话与提案范围', async () => {
    session.allowedActions.push('platform:manage', 'outline:create');
    directory.items.push({ id: 'reader', displayName: '编写人' });
    catalog.mockResolvedValue({ versions: ['main'], chapters: [{ id: 'chapter', name: '第一章' }], documents: [] });
    await start();
    let serial = 0;
    const write = (method, suffix, body) => request('/document-tasks' + suffix, { method,
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `context-${++serial}` }, body: JSON.stringify(body) });
    const tasks = [{ number: 'T-context', title: '隔离新文档任务' }];
    const preview = await write('POST', '/import?preview=true', { tasks });
    expect(await write('POST', '/import', { tasks, digest: preview.data.digest })).toMatchObject({ status: 200 });
    let task = (await request('/document-tasks/T-context')).data;
    let result = await write('PUT', '/T-context/decomposition', { expectedRevision: task.revision, confirm: true,
      ticketImpact: 'involved', handbooks: [{ id: 'h1', ownerId: 'reader' }] });
    expect(result.status).toBe(200);
    task = result.data;
    result = await write('PUT', '/T-context/handbooks/h1', { expectedRevision: task.revision, confirm: true,
      impact: 'involved', targetVersion: 'main', documents: [{ id: 'proposal', kind: 'new', name: '新增说明', parentId: 'chapter', ownerId: 'reader' }] });
    expect(result.status).toBe(200);
    task = result.data;
    result = await write('POST', '/T-context/documents/proposal/prepare-new', { expectedRevision: task.revision, handbookId: 'h1' });
    expect(result).toMatchObject({ status: 200 });
    expect(result.data.decomposition.handbooks[0].documents[0].outlineProposal).toEqual({ outlineId: 'outline-new', documentId: 'doc-new' });
    expect(createDocument).toHaveBeenCalledWith('h1', expect.objectContaining({ name: '新增说明', parentId: 'chapter' }), expect.objectContaining({ user: { id: 'reader' } }));
  });
  test('并发目录查询共享读取并分别应用会话可见范围', async () => {
    let release, readStarted;
    const started = new Promise(resolve => { readStarted = resolve; });
    principalRead.mockImplementationOnce(() => { readStarted(); return new Promise(resolve => { release = () => resolve(directory); }); });
    await start();
    const first = request('/document-tasks/context', { headers: { 'x-visible': 'h1' } });
    await started;
    const second = request('/document-tasks/context', { headers: { 'x-visible': 'h2' } });
    // Wait for the second real HTTP request to enter the handler, without a timing sleep.
    await new Promise(resolve => server.once('request', () => setImmediate(resolve)));
    expect(principalRead).toHaveBeenCalledTimes(1);
    release();
    const [a, b] = await Promise.all([first, second]);
    expect(a.data.handbooks.map(book => book.id)).toEqual(['h1']);
    expect(b.data.handbooks.map(book => book.id)).toEqual(['h2']);
    expect(principalRead).toHaveBeenCalledTimes(1);
  });
});
