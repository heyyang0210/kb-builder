const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const { HybridAuthRepository, MemoryAuthRepository, createKnowledgeCenterAuthService } = require('../../../packages/agent-runner-core/lib/knowledge-center-auth');

const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

function loadApi(fetch) {
  const context = { fetch, URLSearchParams };
  vm.runInNewContext(read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js').replace(/export /g, ''), context);
  return context;
}

describe('知识中心用户权限赋权契约', () => {
  test('原 admin 保留身份密码并补齐超级权限，普通平台管理员不能授予或撤销超级权限', async () => {
    const repository = new MemoryAuthRepository();
    const admin = repository.ensureAdmin('admin', 'original-password');
    const identity = { id: admin.id, passwordHash: admin.passwordHash };
    admin.roles = ['PLATFORM_ADMIN', 'REVIEWER'];
    repository.ensureAdmin('admin', 'different-password');
    expect(admin).toMatchObject(identity);
    expect(admin.roles).toEqual(['PLATFORM_ADMIN', 'REVIEWER', 'SUPER_ADMIN']);
    expect(repository.listUsers().filter(user => user.loginName === 'admin')).toHaveLength(1);
    const ordinary = { id: 'ordinary', identitySource: 'cas', loginName: 'ordinary', enabled: true, roles: ['PLATFORM_ADMIN'] };
    const target = { id: 'target', identitySource: 'cas', loginName: 'target', enabled: true, roles: ['KNOWLEDGE_EDITOR'] };
    repository.state.users.push(ordinary, target);
    const ordinaryToken = repository.createSession(ordinary, 60000);
    const adminToken = repository.createSession(admin, 60000);
    const service = createKnowledgeCenterAuthService({ repository, adminPassword: 'original-password', casBaseUrl: 'http://cas.test', serviceUrl: 'http://app.test/callback', secureCookie: false });
    const server = http.createServer(service.handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}/knowledge-center/api/auth`;
    const headers = token => ({ cookie: `kc_session=${token}`, 'Content-Type': 'application/json' });
    try {
      const session = await (await fetch(`${base}/session`, { headers: headers(adminToken) })).json();
      expect(session.content.allowedActions).toContain('outline:purge');
      const users = await (await fetch(`${base}/users`, { headers: headers(ordinaryToken) })).json();
      expect(users.content.assignableRoles).not.toContain('SUPER_ADMIN');
      const grant = await fetch(`${base}/users/target/roles`, { method: 'PATCH', headers: headers(ordinaryToken), body: JSON.stringify({ roles: ['SUPER_ADMIN'] }) });
      expect(grant.status).toBe(403);
      const promote = await fetch(`${base}/users/target/roles`, { method: 'PATCH', headers: headers(adminToken), body: JSON.stringify({ roles: ['SUPER_ADMIN'] }) });
      expect(promote.status).toBe(200);
      const revoke = await fetch(`${base}/users/target/roles`, { method: 'PATCH', headers: headers(ordinaryToken), body: JSON.stringify({ roles: ['KNOWLEDGE_EDITOR'] }) });
      expect(revoke.status).toBe(403);
      expect(target.roles).toEqual(['SUPER_ADMIN']);
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });
  test('角色保存使用行版本和幂等键，避免接口返回 428/400', () => {
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js');
    expect(api).toContain("'If-Match': String(rowVersion)");
    expect(api).toContain("'Idempotency-Key': idempotencyKey");
    expect(api).toContain('body: JSON.stringify({ roles: changes.roles })');
  });

  test('权限保存从当前用户投影读取 rowVersion，并使用可访问错误反馈', () => {
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    const view = read('apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js');
    expect(app).toContain('selectedUser.rowVersion');
    expect(app).toContain('idempotencyKey: `permission-${userId}-${Date.now()}`');
    expect(view).toContain("role=\"${saveError ? 'alert' : 'status'}\"");
  });

  test('发送行版本和幂等请求头，正文只包含角色', async () => {
    const fetch = jest.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));
    const api = loadApi(fetch);
    await api.updatePlatformUserPermissions('cas/user', { roles: ['REVIEWER'], rowVersion: 3, idempotencyKey: 'permissions-1' });
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe('/knowledge-center/api/auth/users/cas%2Fuser/roles');
    expect(request.headers).toMatchObject({ 'If-Match': '3', 'Idempotency-Key': 'permissions-1' });
    expect(JSON.parse(request.body)).toEqual({ roles: ['REVIEWER'] });
  });

  test('缺少版本或幂等键时不发请求，保留接口错误原因', async () => {
    const fetch = jest.fn(async () => ({ ok: false, status: 409, json: async () => ({ error: { message: '行版本冲突' } }) }));
    const api = loadApi(fetch);
    await expect(api.updatePlatformUserPermissions('cas', { roles: [], rowVersion: null, idempotencyKey: 'key' })).rejects.toThrow('刷新');
    await expect(api.updatePlatformUserPermissions('cas', { roles: [], rowVersion: 1 })).rejects.toThrow('幂等');
    expect(fetch).not.toHaveBeenCalled();
    await expect(api.updatePlatformUserPermissions('cas', { roles: [], rowVersion: 1, idempotencyKey: 'key' })).rejects.toThrow('行版本冲突');
  });

  test('历史 CAS 文件记录不阻断数据库赋权，真实 HTTP 校验版本和幂等头', async () => {
    const local = new MemoryAuthRepository();
    local.ensureAdmin('admin', 'admin');
    const databaseUser = { id: 'cas-legacy', identitySource: 'cas', enabled: true, loginName: 'cas-user', rowVersion: 3, roles: ['KNOWLEDGE_EDITOR'] };
    local.state.users.push({ ...databaseUser });
    const domainStore = {
      readPlatformAuthUsersAsync: jest.fn(async () => ({ items: [databaseUser] })),
      replacePlatformUserRolesAsync: jest.fn(async (id, roles) => ({ ...databaseUser, roles })),
    };
    const repository = new HybridAuthRepository(local, domainStore);
    const admin = local.listUsers().find(user => user.loginName === 'admin');
    const token = local.createSession(admin, 60000);
    const service = createKnowledgeCenterAuthService({ repository, casBaseUrl: 'http://cas.test', serviceUrl: 'http://app.test/callback', secureCookie: false });
    const server = http.createServer(service.handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const api = loadApi((url, options) => fetch(base + url, { ...options, headers: { ...options.headers, cookie: `kc_session=${token}` } }));
      const endpoint = base + '/knowledge-center/api/auth/users/cas-legacy/roles';
      const headers = { cookie: `kc_session=${token}`, 'Content-Type': 'application/json' };
      const body = JSON.stringify({ roles: ['REVIEWER'] });
      const missingVersion = await fetch(endpoint, { method: 'PATCH', headers, body });
      expect(missingVersion.status).toBe(428);
      const missingKey = await fetch(endpoint, { method: 'PATCH', headers: { ...headers, 'If-Match': '3' }, body });
      expect(missingKey.status).toBe(400);
      await api.updatePlatformUserPermissions(databaseUser.id, { roles: ['REVIEWER'], rowVersion: 3, idempotencyKey: 'role-write-1' });
      expect(domainStore.replacePlatformUserRolesAsync).toHaveBeenCalledWith(databaseUser.id, ['REVIEWER'], 3, 'role-write-1', admin.id);
      await expect(repository.updateUserRoles(admin.id, ['REVIEWER'], admin.id, 1, 'local-write')).rejects.toMatchObject({ code: 'LOCAL_ACCOUNT_NOT_DATABASE_MANAGED' });
      expect(domainStore.replacePlatformUserRolesAsync).toHaveBeenCalledTimes(1);
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });
});
