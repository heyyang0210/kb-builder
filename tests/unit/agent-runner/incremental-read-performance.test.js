const http = require('http');
const { DatabaseIncrementalStore } = require('../../../packages/agent-runner-core/lib/aggregate-store');
const { IncrementalBuildService, MemoryIncrementalBuildRepository, createIncrementalBuildHandler } = require('../../../packages/agent-runner-core/lib/incremental-build-service');

const session = { user: { id: 'reader' }, allowedActions: ['knowledge:read'] };
const empty = () => ({ schemaVersion: 1, tasks: [], publishedVersions: [], idempotency: {}, audits: [] });
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });

test('真实 HTTP：等待 Storage 不阻塞网关，后续请求重新读取快照', async () => {
  let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  let reads = 0;
  const storage = http.createServer((req, res) => {
    reads++;
    const respond = () => {
      if (res.writableEnded) return;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ payload: empty(), revision: reads }));
    };
    if (reads === 1) { release = respond; entered(); } else respond();
  });
  const storageBase = await listen(storage);
  const repository = new DatabaseIncrementalStore('state', { baseUrl: storageBase, timeoutMs: 2000 });
  // Fail immediately if a route regresses to the blocking adapter.
  repository.read = () => { throw new Error('首屏不得调用同步存储读取'); };
  const handler = createIncrementalBuildHandler({ repository });
  const gateway = http.createServer((req, res) => {
    if (req.url === '/health') { res.end('ok'); return; }
    handler(req, res, session);
  });
  const base = await listen(gateway);
  try {
    const pending = fetch(`${base}/knowledge-center/api/incremental-tasks`);
    await Promise.race([waiting, pending.then(() => { throw new Error('请求在异步 Storage 读取前返回'); })]);
    expect(await (await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) })).text()).toBe('ok');
    release();
    const first = await pending;
    expect(first.status).toBe(200);
    expect((await first.json()).data).toEqual([]);
    expect((await fetch(`${base}/knowledge-center/api/incremental-tasks`)).status).toBe(200);
    expect(reads).toBe(2);
  } finally {
    release?.();
    await close(gateway);
    await close(storage);
  }
});

test.each(['', '/diff'])('任务详情%s 通过真实 HTTP 异步读取并保留权限校验', async suffix => {
  const author = { user: { id: 'reader' }, allowedActions: ['knowledge:read', 'knowledge:write'] };
  const initial = empty();
  initial.publishedVersions.push({ id: 'baseline-perf', handbookId: 'HB-PERF', businessVersion: '1.0', current: true });
  const repository = new MemoryIncrementalBuildRepository(initial);
  const service = new IncrementalBuildService(repository);
  const task = service.create(author, 'perf-create', { name: '性能回归', handbookId: 'HB-PERF', businessVersion: '1.0', baselineVersionId: 'baseline-perf' });
  const state = repository.read();
  repository.readAsync = jest.fn(async () => state);
  repository.read = () => { throw new Error('不得同步读取'); };
  const handler = createIncrementalBuildHandler({ service });
  const gateway = http.createServer((req, res) => handler(req, res, author));
  const base = await listen(gateway);
  try {
    const response = await fetch(`${base}/knowledge-center/api/incremental-tasks/${task.id}${suffix}`);
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(suffix ? data.taskId : data.id).toBe(task.id);
    expect(repository.readAsync).toHaveBeenCalledTimes(1);
    expect(() => service.get({ user: { id: 'other' }, allowedActions: ['knowledge:read'] }, task.id, state)).toThrow();
  } finally {
    await close(gateway);
  }
});

test('审核与个人生成投影复用请求快照，权限校验在读取之前', async () => {
  const repository = { read: jest.fn(() => { throw new Error('重复读取'); }), readAsync: jest.fn(async () => empty()) };
  const service = new IncrementalBuildService(repository);
  await expect(service.readState({ allowedActions: [] })).rejects.toMatchObject({ status: 403 });
  expect(repository.readAsync).not.toHaveBeenCalled();
  const snapshot = await service.readState(session);
  expect(service.reviewBootstrap(session, { view: 'handbooks' }, snapshot).documents).toEqual([]);
  expect(service.reviewOverview(session, [], snapshot)).toEqual([]);
  expect(service.listMyGenerations(session, { scope: 'mine' }, snapshot).items).toEqual([]);
  expect(() => service.listMyGenerations(session, { userId: 'other' }, snapshot)).toThrow();
  expect(repository.readAsync).toHaveBeenCalledTimes(1);
  expect(repository.read).not.toHaveBeenCalled();
});

test('审核 HTTP 读取状态覆盖和仓库映射时不阻塞，权限失败不读取映射', async () => {
  const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
  const { DomainStore } = require('../../../packages/agent-runner-core/lib/domain-store');
  const path = require('path');
  let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const mappingReads = [];
  const storage = http.createServer((req, res) => {
    mappingReads.push(req.url);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ data: req.url.includes('/mappings/')
      ? { connectionId: 'connection', zhPaths: [], enPaths: [] }
      : { id: 'connection', host: 'https://gitlab.example.com' } }));
  });
  const storageBase = await listen(storage);
  const domainStore = new DomainStore({ baseUrl: storageBase });
  domainStore.request = () => { throw new Error('不得同步读取仓库映射'); };
  const previous = process.env.KNOWLEDGE_STORAGE_MODE;
  const previousPlatform = process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE;
  process.env.KNOWLEDGE_STORAGE_MODE = 'database';
  process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE = 'database';
  let handler;
  let overrideReads = 0;
  const listUsers = jest.fn(async () => []);
  const overrides = { statuses: { HB: { manualStatus: { value: 'handbook_published' }, assetVersion: 7 } } };
  try {
    handler = createKnowledgeCenterHandler({
      config: {
        KNOWLEDGE_CENTER_PREFIX: '/knowledge-center',
        GITLAB_CONFIG_PATH: '/tmp/no-performance-gitlab-config.json',
        OUTLINE_TEMPLATE_PATH: path.resolve(__dirname, '../../../knowledge/outlines/大纲模板.xlsx'),
        OUTLINE_SAMPLE_PATH: path.resolve(__dirname, '../../../knowledge/outlines/基本数据库管理手册大纲示例.xlsx'),
      },
      stores: {
        knowledgeAssetsStore: { readAsync: async () => ({ generatedAt: 'fixture', handbooks: [{ handbookId: 'HB' }] }), read() { throw new Error('不得同步读取资产'); } },
        manualStatusStore: { read() { throw new Error('不得同步读取覆盖'); }, async readAsync() { if (++overrideReads > 1) return overrides; entered(); return new Promise(resolve => { release = () => resolve(overrides); }); } },
        domainStore,
      },
      modules: { auth: { authorize: async req => req.headers['x-denied'] ? { ...session, allowedActions: [] } : session, repository: { listUsers } } },
      handleIncrementalBuild: createIncrementalBuildHandler({ repository: new MemoryIncrementalBuildRepository(empty()) }),
      handbookProductionService: {}, databaseConnectionGovernance: {},
    });
  } finally {
    if (previous === undefined) delete process.env.KNOWLEDGE_STORAGE_MODE; else process.env.KNOWLEDGE_STORAGE_MODE = previous;
    if (previousPlatform === undefined) delete process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE; else process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE = previousPlatform;
  }
  const gateway = http.createServer((req, res) => {
    if (req.url === '/health') { res.end('ok'); return; }
    handler(req, res);
  });
  const base = await listen(gateway);
  try {
    const pending = fetch(`${base}/knowledge-center/api/review/bootstrap`);
    await waiting;
    expect(await (await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) })).text()).toBe('ok');
    release();
    const bootstrap = await pending;
    expect(bootstrap.status).toBe(200);
    const data = (await bootstrap.json()).data;
    expect(listUsers).not.toHaveBeenCalled();
    expect(data.workbench.handbooks[0]).toMatchObject({ handbookId: 'HB', status: 'handbook_published', assetVersion: 7 });
    // The next read resolves immediately; it still uses the asynchronous adapter.
    overrides.statuses.HB.assetVersion = 8;
    mappingReads.length = 0; // 只核对本次请求；首屏也可读取映射。
    const repositoryRead = fetch(`${base}/knowledge-center/api/review/repository-context?handbookId=HB`);
    expect((await repositoryRead).status).toBe(404);
    expect(mappingReads).toEqual(['/v1/platform/gitlab/mappings/HB', '/v1/platform/gitlab/connections/connection']);
    expect((await fetch(`${base}/knowledge-center/api/review/repository-context?handbookId=HB`, { headers: { 'x-denied': '1' } })).status).toBe(403);
    expect(mappingReads).toHaveLength(2);
  } finally {
    release?.();
    await close(gateway);
    await close(storage);
  }
});

test('真实 HTTP：条件快照读取校验版本，更新、删除和失败不返回旧数据', async () => {
  let revision = 1;
  let unavailable = false;
  let missing = false;
  let deleted = false;
  const conditions = [];
  const storage = http.createServer((req, res) => {
    conditions.push(req.headers['if-none-match']);
    res.setHeader('content-type', 'application/json');
    if (unavailable || missing) {
      res.statusCode = unavailable ? 503 : 404;
      res.end(JSON.stringify({ success: false, error: { code: unavailable ? 'DATABASE_UNAVAILABLE' : 'RECORD_NOT_FOUND' } }));
      return;
    }
    const etag = `"${revision}"`;
    res.setHeader('etag', etag);
    if (req.headers['if-none-match'] === etag) { res.writeHead(304); res.end(); return; }
    res.end(JSON.stringify({ success: true, revision, deleted, payload: { tasks: [{ name: `version-${revision}` }] } }));
  });
  const baseUrl = await listen(storage);
  const repository = new DatabaseIncrementalStore('state', { baseUrl, timeoutMs: 2000 });
  try {
    const first = await repository.readAsync();
    first.tasks[0].name = 'caller mutation';
    expect((await repository.readAsync()).tasks[0].name).toBe('version-1');
    expect(conditions.slice(0, 2)).toEqual([undefined, '"1"']);
    revision++;
    expect((await repository.readAsync()).tasks[0].name).toBe('version-2');
    unavailable = true;
    await expect(repository.readAsync()).rejects.toMatchObject({ code: 'DATABASE_UNAVAILABLE' });
    unavailable = false;
    await repository.readAsync();
    expect(conditions.at(-1)).toBeUndefined();
    revision++; deleted = true;
    expect((await repository.readAsync()).tasks).toEqual([]);
    expect((await repository.readAsync()).tasks).toEqual([]);
    missing = true;
    expect((await repository.readAsync()).tasks).toEqual([]);
    missing = false; deleted = false; revision++;
    expect((await repository.readAsync()).tasks[0].name).toBe('version-4');
  } finally { await close(storage); }
});


test('并发审核读取只等待同一次存储请求，结束即清除并隔离返回对象', async () => {
  let release;
  const repository = { readAsync: jest.fn(() => new Promise(resolve => { release = resolve; })) };
  const service = new IncrementalBuildService(repository);
  const pending = Array.from({ length: 10 }, () => service.readState(session));
  expect(repository.readAsync).toHaveBeenCalledTimes(1);
  await expect(service.readState({ allowedActions: [] })).rejects.toMatchObject({ status: 403 });
  release(empty());
  const snapshots = await Promise.all(pending);
  snapshots[0].tasks.push({ id: 'caller-only' });
  expect(snapshots[1].tasks).toEqual([]);
  repository.readAsync.mockResolvedValueOnce({ ...empty(), tasks: [{ id: 'new-read' }] });
  expect((await service.readState(session)).tasks).toEqual([{ id: 'new-read' }]);
  expect(repository.readAsync).toHaveBeenCalledTimes(2);
});

test('审核读取等待期间完成本进程写入时，所有等待者改读新状态', async () => {
  let release;
  const repository = {
    writeEpoch: 0,
    readAsync: jest.fn().mockImplementationOnce(() => new Promise(resolve => { release = resolve; }))
      .mockResolvedValueOnce({ ...empty(), tasks: [{ id: 'after-write' }] }),
  };
  const service = new IncrementalBuildService(repository);
  const first = service.readState(session);
  repository.writeEpoch++;
  const afterWrite = service.readState(session);
  release({ ...empty(), tasks: [{ id: 'before-write' }] });
  for (const snapshot of await Promise.all([first, afterWrite])) {
    expect(snapshot.tasks).toEqual([{ id: 'after-write' }]);
  }
  expect(repository.readAsync).toHaveBeenCalledTimes(2);
});

test('审核读取失败清除正在等待的请求，后续读取重新访问存储', async () => {
  let reject;
  const repository = { readAsync: jest.fn().mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }))
    .mockResolvedValueOnce(empty()) };
  const service = new IncrementalBuildService(repository);
  const pending = [service.readState(session), service.readState(session)];
  reject(new Error('storage unavailable'));
  expect((await Promise.allSettled(pending)).map(item => item.status)).toEqual(['rejected', 'rejected']);
  expect(await service.readState(session)).toEqual(empty());
  expect(repository.readAsync).toHaveBeenCalledTimes(2);
});

test('数据库写入成功才推进本进程序号并清除条件快照', () => {
  const repository = new DatabaseIncrementalStore('state', { baseUrl: 'http://127.0.0.1:1' });
  repository.execute = jest.fn(() => ({ revision: 2 }));
  repository.readSnapshot = { etag: 'old', payload: empty() };
  repository.writeAtRevision(empty(), 1);
  expect(repository.writeEpoch).toBe(1);
  expect(repository.readSnapshot).toBeNull();
  repository.execute.mockImplementationOnce(() => { throw new Error('conflict'); });
  expect(() => repository.writeAtRevision(empty(), 1)).toThrow('conflict');
  expect(repository.writeEpoch).toBe(1);
});
