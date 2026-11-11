const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { DomainStore, DomainStoreError, createDomainStore } = require('../../../packages/agent-runner-core/lib/domain-store');

describe('领域存储同步 HTTP 适配器', () => {
  let worker;
  let store;

  beforeAll(async () => {
    worker = new Worker(path.join(__dirname, 'fixtures/domain-store-http-worker.js'));
    const port = await new Promise((resolve, reject) => {
      worker.once('message', resolve);
      worker.once('error', reject);
    });
    store = createDomainStore({ baseUrl: `http://127.0.0.1:${port}`, timeoutMs: 1500 });
  });

  afterAll(async () => {
    if (worker) await worker.terminate();
  });

  const cases = [
    ['readHandbooks', [], 'GET', '/v1/domain/handbooks'],
    ['writeHandbooksSnapshot', [{ handbooks: [] }], 'PUT', '/v1/domain/handbooks/snapshot', { handbooks: [] }],
    ['readOutlines', [], 'GET', '/v1/domain/outlines'],
    ['writeOutlinesSnapshot', [{ outlines: [] }], 'PUT', '/v1/domain/outlines/snapshot', { outlines: [] }],
    ['deleteOutline', ['o /1', { reason: 'expired' }], 'DELETE', '/v1/domain/outlines/o%20%2F1', { reason: 'expired' }],
    ['outlineLifecycle', ['o /1', 'restore', { reason: 'retry' }], 'POST', '/v1/domain/outlines/o%20%2F1/restore', { reason: 'retry' }],
    ['outlineLifecycle', ['o /1', 'purge-preflight'], 'GET', '/v1/domain/outlines/o%20%2F1/purge-preflight'],
    ['readTechDomains', [], 'GET', '/v1/domain/tech-domains'],
    ['readTeamGroups', [{ status: 'active', empty: '', absent: null }], 'GET', '/v1/platform/team-groups?status=active'],
    ['readTeamGroup', ['g /1'], 'GET', '/v1/platform/team-groups/g%20%2F1'],
    ['createTeamGroup', [{ name: '研发' }, 'group-key'], 'POST', '/v1/platform/team-groups', { name: '研发' }, { 'idempotency-key': 'group-key' }],
    ['replaceTeamRoster', ['g /1', { members: [] }, 3, 'roster-key'], 'PUT', '/v1/platform/team-groups/g%20%2F1/roster', { members: [] }, { 'if-match': '3', 'idempotency-key': 'roster-key' }],
    ['readOutlineGovernance', ['o /1'], 'GET', '/v1/domain/outlines/o%20%2F1/governance'],
    ['writeOutlineGovernance', ['o /1', { owner: 'u1' }], 'PUT', '/v1/domain/outlines/o%20%2F1/governance', { owner: 'u1' }],
    ['publishOutline', ['o /1', { version: 2 }], 'POST', '/v1/domain/outlines/o%20%2F1/publish', { version: 2 }],
    ['readBuildTasks', [{ owner: 'u 1', omitted: undefined }], 'GET', '/v1/domain/build-tasks?owner=u+1'],
    ['readBuildTask', ['t /1'], 'GET', '/v1/domain/build-tasks/t%20%2F1'],
    ['updateBuildTaskItem', ['t /1', 'i /1', { status: 'done' }], 'PATCH', '/v1/domain/build-tasks/t%20%2F1/items/i%20%2F1', { status: 'done' }],
    ['readPlatformAuthUsers', [], 'GET', '/v1/platform/auth/users'],
    ['readPlatformAuthUser', ['u /1'], 'GET', '/v1/platform/auth/users/u%20%2F1'],
    ['upsertPlatformCasUser', [{ userKey: 'u1' }], 'POST', '/v1/platform/auth/users/cas', { userKey: 'u1' }],
    ['replacePlatformUserRoles', ['u /1', ['ADMIN'], 4, 'role-key', 'operator'], 'PATCH', '/v1/platform/auth/users/u%20%2F1/roles', { roles: ['ADMIN'], actor: 'operator' }, { 'if-match': '4', 'idempotency-key': 'role-key' }],
    ['readPlatformGitLabConnections', [], 'GET', '/v1/platform/gitlab/connections'],
    ['readPlatformGitLabConnection', ['conn /1'], 'GET', '/v1/platform/gitlab/connections/conn%20%2F1'],
    ['upsertPlatformGitLabConnection', [{ key: 'conn' }, null, 'connection-key', 'operator'], 'PUT', '/v1/platform/gitlab/connections', { key: 'conn', actor: 'operator' }, { 'idempotency-key': 'connection-key' }],
    ['upsertPlatformGitLabConnection', [{ key: 'conn' }, 2, 'connection-key', 'operator'], 'PUT', '/v1/platform/gitlab/connections', { key: 'conn', actor: 'operator' }, { 'if-match': '2' }],
    ['setPlatformGitLabConnectionState', ['conn /1', 'disabled', 2, 'state-key', 'operator'], 'PATCH', '/v1/platform/gitlab/connections/conn%20%2F1/state', { status: 'disabled', actor: 'operator' }, { 'if-match': '2', 'idempotency-key': 'state-key' }],
    ['readPlatformGitLabMapping', ['manual /1'], 'GET', '/v1/platform/gitlab/mappings/manual%20%2F1'],
    ['replacePlatformGitLabMapping', ['manual /1', { branch: 'main' }, null, 'mapping-key', 'operator'], 'PUT', '/v1/platform/gitlab/mappings/manual%20%2F1', { branch: 'main', actor: 'operator' }, { 'idempotency-key': 'mapping-key' }],
    ['replacePlatformGitLabMapping', ['manual /1', { branch: 'main' }, 5, 'mapping-key', 'operator'], 'PUT', '/v1/platform/gitlab/mappings/manual%20%2F1', { branch: 'main', actor: 'operator' }, { 'if-match': '5' }],
  ];

  test.each(cases)('%s 经真实 HTTP 传递请求契约 %#', (...entry) => {
    const [name, args, method, url, body, headers = {}] = entry;
    const result = store[name](...args);
    expect(result).toMatchObject({ method, url, body: body === undefined ? null : body });
    for (const [key, value] of Object.entries(headers)) expect(result.headers[key]).toBe(value);
    if (body !== undefined) expect(result.headers['content-type']).toMatch(/^application\/json/);
  });

  test('成功信封可返回 data 或原始对象，空请求头不发送', () => {
    expect(store.request('GET', '/raw', undefined, { 'If-Match': '', 'Idempotency-Key': null }).observed)
      .toMatchObject({ method: 'GET', url: '/raw' });
    const response = store.request('GET', '/raw', undefined, { 'If-Match': '', 'Idempotency-Key': null });
    expect(response.observed.headers['if-match']).toBeUndefined();
    expect(response.observed.headers['idempotency-key']).toBeUndefined();
  });

  test('默认参数和无筛选路径经真实 HTTP 保持约定', async () => {
    expect(store.readTeamGroups()).toMatchObject({ method: 'GET', url: '/v1/platform/team-groups' });
    expect(store.readBuildTasks()).toMatchObject({ method: 'GET', url: '/v1/domain/build-tasks' });
    expect(await store.readPrincipalsAsync()).toMatchObject({ method: 'GET', url: '/v1/domain/principals' });
    expect(store.deleteOutline('default-outline')).toMatchObject({ method: 'DELETE', body: {} });
    expect(store.outlineLifecycle('default-outline', 'restore')).toMatchObject({ method: 'POST', body: {} });
    expect(store.publishOutline('default-outline')).toMatchObject({ method: 'POST', body: {} });
  });

  test('后端错误信封与不可达服务保留错误边界', () => {
    expect(() => store.request('GET', '/error')).toThrow(DomainStoreError);
    try { store.request('GET', '/error'); } catch (error) {
      expect(error).toMatchObject({ code: 'OUTLINE_DELETED', status: 409, details: { id: 'outline-1' } });
    }
    expect(() => store.request('GET', '/malformed')).toThrow(expect.objectContaining({ code: 'DOMAIN_UNAVAILABLE', status: 503 }));
    const unavailable = new DomainStore({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 1000 });
    expect(() => unavailable.request('GET', '/v1/domain/handbooks')).toThrow(expect.objectContaining({ code: 'DOMAIN_UNAVAILABLE', status: 503 }));
  });

  test('异步 HTTP 返回非法 JSON 时报告存储服务不可用', async () => {
    await expect(store.requestAsync('GET', '/malformed')).rejects.toMatchObject({
      code: 'DOMAIN_UNAVAILABLE', status: 503,
      details: { cause: expect.any(String) },
    });
  });

  test('空正文、缺少错误字段和缺少计时头使用稳定默认值', async () => {
    expect(store.request('GET', '/empty')).toEqual({});
    expect(await store.requestAsync('GET', '/empty')).toEqual({});
    expect(await store.requestAsyncWithMeta('GET', '/no-timing')).toMatchObject({
      headers: { serverTiming: '' }, body: { success: true },
    });
    await expect(store.requestAsync('GET', '/generic-error')).rejects.toMatchObject({
      code: 'DOMAIN_REQUEST_FAILED', message: '领域存储请求失败', status: 422,
    });
    expect(() => store.request('GET', '/generic-error')).toThrow(expect.objectContaining({
      code: 'DOMAIN_REQUEST_FAILED', message: '领域存储请求失败', status: 503,
    }));
  });

  const asyncCases = [
    ['readHandbooksAsync', [], 'GET', '/v1/domain/handbooks'],
    ['readPrincipalsAsync', [{ status: 'active', empty: '' }], 'GET', '/v1/domain/principals?status=active'],
    ['createPrincipal', [{ displayName: '测试人员' }], 'POST', '/v1/domain/principals', { displayName: '测试人员' }],
    ['updatePrincipal', ['u /1', { displayName: '更新人员' }], 'PATCH', '/v1/domain/principals/u%20%2F1', { displayName: '更新人员' }],
    ['importPrincipals', [{ items: [] }], 'POST', '/v1/domain/principals/import', { items: [] }],
    ['syncCasPrincipal', [{ ticket: 'cas-ticket' }], 'POST', '/v1/domain/principals/cas-login', { ticket: 'cas-ticket' }],
    ['readOutlinesAsync', [], 'GET', '/v1/domain/outlines'],
    ['readOutlineCatalogAsync', [], 'GET', '/v1/domain/outlines/catalog'],
    ['readOutlineDirectoryAsync', ['o /1'], 'GET', '/v1/domain/outlines/o%20%2F1/directory'],
    ['readOutlineGovernanceAsync', ['o /1'], 'GET', '/v1/domain/outlines/o%20%2F1/governance'],
    ['readPlatformAuthUsersAsync', [], 'GET', '/v1/platform/auth/users'],
    ['readPlatformAuthUserAsync', ['u /1'], 'GET', '/v1/platform/auth/users/u%20%2F1'],
    ['upsertPlatformCasUserAsync', [{ userKey: 'u1' }], 'POST', '/v1/platform/auth/users/cas', { userKey: 'u1' }],
    ['replacePlatformUserRolesAsync', ['u /1', ['ADMIN'], 4, 'role-key', 'operator'], 'PATCH', '/v1/platform/auth/users/u%20%2F1/roles', { roles: ['ADMIN'], actor: 'operator' }, { 'if-match': '4', 'idempotency-key': 'role-key' }],
    ['readPlatformGitLabConnectionAsync', ['conn /1'], 'GET', '/v1/platform/gitlab/connections/conn%20%2F1'],
    ['readPlatformGitLabMappingAsync', ['manual /1'], 'GET', '/v1/platform/gitlab/mappings/manual%20%2F1'],
    ['readGitLabVersionMappings', [], 'GET', '/v1/platform/gitlab/version-mappings'],
    ['saveGitLabVersionMapping', [null, { version: '23.1', actor: 'forged' }, 99, 'create-version', 'operator'], 'POST', '/v1/platform/gitlab/version-mappings', { version: '23.1', actor: 'operator' }, { 'idempotency-key': 'create-version' }],
    ['saveGitLabVersionMapping', ['map /1', { version: '23.2' }, 7, 'update-version', 'operator'], 'PUT', '/v1/platform/gitlab/version-mappings/map%20%2F1', { version: '23.2', actor: 'operator' }, { 'if-match': '7', 'idempotency-key': 'update-version' }],
    ['setGitLabVersionMappingState', ['map /1', 'disable', 8, 'disable-version', 'operator'], 'POST', '/v1/platform/gitlab/version-mappings/map%20%2F1/disable', { actor: 'operator' }, { 'if-match': '8', 'idempotency-key': 'disable-version' }],
    ['setGitLabVersionMappingState', ['map /1', 'enable', 9, 'enable-version', 'operator'], 'POST', '/v1/platform/gitlab/version-mappings/map%20%2F1/enable', { actor: 'operator' }, { 'if-match': '9', 'idempotency-key': 'enable-version' }],
  ];

  test.each(asyncCases)('%s 经异步 HTTP 传递请求契约 %#', async (...entry) => {
    const [name, args, method, url, body, headers = {}] = entry;
    const result = await store[name](...args);
    expect(result).toMatchObject({ method, url, body: body === undefined ? null : body });
    for (const [key, value] of Object.entries(headers)) expect(result.headers[key]).toBe(value);
    if (body !== undefined) expect(result.headers['content-type']).toMatch(/^application\/json/);
    if (name === 'saveGitLabVersionMapping' && args[0] == null) {
      expect(result.headers['if-match']).toBeUndefined();
    }
  });

  test('版本映射解析保留查询值，缺失 data 返回 null', async () => {
    const values = { connectionId: 'conn /1&x', productCode: '崖山 DB+', version: '23.1/#?' };
    const result = await store.resolveGitLabVersionMapping(...Object.values(values));
    expect(result.method).toBe('GET');
    const url = new URL(result.url, 'http://127.0.0.1');
    expect(url.pathname).toBe('/v1/platform/gitlab/version-mappings/resolve');
    expect(Object.fromEntries(url.searchParams)).toEqual(values);
    await setRawResponses(true);
    try {
      await expect(store.resolveGitLabVersionMapping(...Object.values(values))).resolves.toBeNull();
    } finally {
      await setRawResponses(false);
    }
  });

  async function setRawResponses(enabled) {
    const changed = new Promise(resolve => worker.once('message', resolve));
    worker.postMessage({ type: 'raw-responses', enabled });
    expect(await changed).toEqual({ type: 'raw-responses', enabled });
  }

  test('同步和异步适配方法保留无 data 的成功信封', async () => {
    await setRawResponses(true);
    try {
      for (const [name, args, method, url] of cases) {
        expect(store[name](...args)).toMatchObject({ success: true, observed: { method, url } });
      }
      for (const [name, args, method, url] of asyncCases) {
        expect(await store[name](...args)).toMatchObject({ success: true, observed: { method, url } });
      }
      for (const [name, args, url] of [
        ['readOutlineCatalogWithMetaAsync', [], '/v1/domain/outlines/catalog'],
        ['readOutlineDirectoryWithMetaAsync', ['o /1'], '/v1/domain/outlines/o%20%2F1/directory'],
      ]) {
        expect(await store[name](...args)).toMatchObject({
          data: { success: true, observed: { method: 'GET', url } },
          headers: { serverTiming: 'storage-total;dur=2.5' },
        });
      }
    } finally {
      await setRawResponses(false);
    }
  });

  test.each([
    ['readOutlineCatalogWithMetaAsync', [], '/v1/domain/outlines/catalog'],
    ['readOutlineDirectoryWithMetaAsync', ['o /1'], '/v1/domain/outlines/o%20%2F1/directory'],
  ])('%s 返回真实 HTTP 正文与 Server-Timing', async (name, args, url) => {
    const result = await store[name](...args);
    expect(result.data).toMatchObject({ method: 'GET', url });
    expect(result.headers.serverTiming).toBe('storage-total;dur=2.5');
  });

  test.each([
    ['OUTLINE_PURGE_CONFIRM_REQUIRED', 422], ['OUTLINE_NOT_FOUND', 404],
    ['BUILD_TASK_NOT_FOUND', 404], ['OUTLINE_VERSION_CONFLICT', 409],
    ['CAS_LOGIN_BIND_CONFLICT', 409], ['OUTLINE_DOCUMENT_REQUIRED', 422],
    ['OUTLINE_RESTORE_CONFLICT', 409], ['OUTLINE_PURGE_REFERENCED', 409],
    ['OUTLINE_PURGE_UNAVAILABLE', 409], ['ASSET_NOT_FOUND', 404],
    ['BUILD_TASK_ITEM_NOT_FOUND', 404], ['OUTLINE_EDIT_CONFLICT', 409],
    ['OUTLINE_GOVERNANCE_CONFLICT', 409], ['OUTLINE_IMMUTABLE', 409],
    ['PUBLISHED_CONTENT_LOCKED', 409], ['CAS_LOGIN_NAME_CONFLICT', 409],
    ['CAS_PRINCIPAL_NOT_FOUND', 409], ['CAS_PRINCIPAL_AMBIGUOUS', 409],
    ['OUTLINE_RESPONSIBILITY_REQUIRED', 422], ['PUBLISHED_ASSIGNMENT_REQUIRED', 422],
    ['BUILD_TASK_ASSIGNEE_INVALID', 422], ['DOMAIN_UPSTREAM_FAILED', 503],
    ['VERSION_MAPPING_NOT_FOUND', 404], ['VERSION_MAPPING_CONFLICT', 409],
    ['VERSION_MAPPING_INVALID', 422],
  ])('后端 %s 错误经 HTTP 映射为 %i', async (code, status) => {
    const route = `/mapped-error?code=${encodeURIComponent(code)}`;
    await expect(store.requestAsync('GET', route)).rejects.toMatchObject({ code, status, message: `后端拒绝 ${code}` });
    expect(() => store.request('GET', route)).toThrow(expect.objectContaining({ code, status }));
  });
});
