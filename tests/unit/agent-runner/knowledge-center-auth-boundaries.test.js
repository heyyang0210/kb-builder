const http = require('http');
const fs = require('fs');
const path = require('path');
const auth = require('../../../packages/agent-runner-core/lib/knowledge-center-auth');
const { MemoryAuthRepository, FileAuthRepository, HybridAuthRepository, AuthError } = auth;
const scratch = path.resolve(__dirname, '../../../runtime/test-results/auth-boundary-fixtures');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
function request(base, method, endpoint, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
    const req = http.request(new URL(endpoint, base), { method, headers: { 'content-length': Buffer.byteLength(data), ...headers } }, res => {
      let text = '';
      res.on('data', b => { text += b; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(text) }));
    });
    req.on('error', reject); req.end(data);
  });
}
const errorCode = code => ({ code });
beforeAll(() => fs.mkdirSync(scratch, { recursive: true }));
afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));

describe('认证仓储公开边界', () => {
  test('文件仓储原子持久化、重载与损坏文件错误', () => {
    const file = path.join(scratch, 'state.json');
    const repo = new FileAuthRepository(file);
    const user = repo.ensureBuiltinUser('reader', 'secret');
    expect(new FileAuthRepository(file).findUserById(user.id).roles).toEqual(['KNOWLEDGE_EDITOR']);
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    fs.writeFileSync(file, '{');
    expect(() => new FileAuthRepository(file)).toThrow(SyntaxError);
  });
  test('内置账号修复只处理缺失角色，保留有效角色和非内置账号', () => {
    const repo = new MemoryAuthRepository();
    expect(() => repo.ensureBuiltinUser('r', 'p', 'invalid')).toThrow(expect.objectContaining(errorCode('ROLE_INVALID')));
    const u = repo.ensureBuiltinUser('r', 'p');
    for (const roles of [undefined, []]) {
      u.roles = roles;
      expect(repo.ensureBuiltinUser('r', 'ignored').roles).toEqual(['KNOWLEDGE_EDITOR']);
    }
    u.roles = ['REVIEWER']; expect(repo.ensureBuiltinUser('r', 'p').roles).toEqual(['REVIEWER']);
    u.builtin = false; u.roles = []; expect(repo.ensureBuiltinUser('r', 'p').roles).toEqual([]);
    const admin = repo.ensureAdmin('root', 'p'); admin.roles = ['PLATFORM_ADMIN'];
    expect(repo.ensureAdmin('root', 'ignored').roles).toEqual(['PLATFORM_ADMIN', 'SUPER_ADMIN']);
    expect(repo.ensureAdmin('root', 'ignored').id).toBe(admin.id);
  });
  test('CAS 主体、属性数组回退与更新不丢失历史字段', () => {
    const r = new MemoryAuthRepository();
    expect(() => r.upsertCas({ uid: [], user: [] })).toThrow(expect.objectContaining(errorCode('CAS_SUBJECT_MISSING')));
    const u = r.upsertCas({ uid: ['subject'], cn: ['name'], mail: ['a@b'], employeeNumber: [12] }, 4);
    expect(u).toMatchObject({ loginName: 'subject', displayName: 'name', employeeNo: '12', principalId: 4 });
    expect(r.upsertCas({ uid: 'subject' })).toMatchObject({ id: u.id, email: 'a@b', principalId: 4 });
    expect(r.upsertCas({ uid: 'subject', cn: 'new', mail: 'new@b', employeeNumber: 13 }, 5)).toMatchObject({ displayName: 'new', email: 'new@b', employeeNo: '13', principalId: 5 });
    expect(r.upsertCas({ user: 'fallback' }).displayName).toBe('fallback');
    r.consumeTicket('ticket'); expect(() => r.consumeTicket('ticket')).toThrow(expect.objectContaining(errorCode('CAS_TICKET_REPLAYED')));
    expect(JSON.stringify(r.state.consumedTickets)).not.toContain('ticket');
  });
  test('会话缺失、过期、禁用、删除用户和幂等撤销', () => {
    const r = new MemoryAuthRepository(); const u = r.upsertCas({ user: 'user' });
    expect(r.sessionRecord()).toBeNull(); expect(r.session('missing')).toBeNull();
    const expired = r.createSession(u, -1); expect(r.session(expired)).toBeNull();
    const t = r.createSession(u, 60000); expect(r.session(t).user.id).toBe(u.id);
    u.enabled = false; expect(r.session(t)).toBeNull(); u.enabled = true;
    r.revoke(); r.revoke('missing'); r.revoke(t); r.revoke(t); expect(r.session(t)).toBeNull();
    const t2 = r.createSession(u, 60000); r.state.users = []; expect(r.session(t2)).toBeNull();
  });
  test('角色规范化、错误和审计容量', () => {
    const r = new MemoryAuthRepository(); const u = r.upsertCas({ user: 'u' });
    expect(() => r.updateUserRoles('missing', [])).toThrow(expect.objectContaining(errorCode('USER_NOT_FOUND')));
    for (const roles of [null, [], [' ', '']]) expect(() => r.updateUserRoles(u.id, roles)).toThrow(expect.objectContaining(errorCode('ROLE_REQUIRED')));
    expect(() => r.updateUserRoles(u.id, ['BAD'])).toThrow(expect.objectContaining(errorCode('ROLE_INVALID')));
    u.roles = undefined;
    expect(r.updateUserRoles(u.id, [' REVIEWER ', 'REVIEWER']).roles).toEqual(['REVIEWER']);
    expect(r.state.audits.at(-1)).toMatchObject({ userId: null, details: { before: [] } });
    for (let i = 0; i < 5002; i++) r.audit('event', String(i), 'ok');
    expect(r.state.audits).toHaveLength(5000); expect(r.state.audits[0].userId).toBe('2');
    expect(auth.userProjection({ roles: ['UNKNOWN'] }).allowedActions).toEqual([]);
    expect(auth.userProjection({}).roles).toEqual([]);
  });
  test('混合仓储人员绑定、传递和失败分类', async () => {
    const local = new MemoryAuthRepository();
    const domain = { syncCasPrincipal: jest.fn(async () => ({ principalId: 8 })), upsertPlatformCasUserAsync: jest.fn(async input => input) };
    const r = new HybridAuthRepository(local, domain);
    expect(await r.upsertCas({ uid: ['u'] })).toMatchObject({ principalId: 8, loginName: 'u', actor: 'system:cas' });
    expect(domain.syncCasPrincipal).toHaveBeenCalledWith({ casLoginName: 'u', displayName: 'u', actor: 'system:cas' });
    expect(await r.upsertCas({ user: 'u', cn: 'Name' }, 9, 'operator')).toMatchObject({ principalId: 9, actor: 'operator' });
    expect(domain.syncCasPrincipal).toHaveBeenCalledTimes(1);
    domain.syncCasPrincipal.mockResolvedValueOnce(null);
    await expect(r.upsertCas({ user: 'u' })).rejects.toMatchObject(errorCode('CAS_PRINCIPAL_NOT_FOUND'));
    domain.syncCasPrincipal.mockRejectedValueOnce(new Error('private storage error'));
    await expect(r.upsertCas({ user: 'u' })).rejects.toMatchObject({ code: 'CAS_PRINCIPAL_SYNC_FAILED', status: 503, retryable: true });
    domain.upsertPlatformCasUserAsync.mockRejectedValueOnce(new AuthError('KNOWN', 'known', 409));
    await expect(r.upsertCas({ user: 'u' }, 9)).rejects.toMatchObject(errorCode('KNOWN'));
    r.consumeTicket('x'); expect(() => r.consumeTicket('x')).toThrow(); r.audit('test', null, 'ok'); r.save();
    const u = r.ensureBuiltinUser('local', 'p'); expect(r.findLocal('local').id).toBe(u.id);
    r.ensureAdmin('admin', 'p'); const token = r.createSession(u, 60000);
    expect((await r.session(token)).user.id).toBe(u.id); r.revoke(token); expect(await r.session(token)).toBeNull();
  });
  test('混合仓储会话回读、列表回退和修改前置条件', async () => {
    const local = new MemoryAuthRepository(); const u = local.ensureBuiltinUser('local', 'p');
    const domain = { readPlatformAuthUserAsync: jest.fn(), readPlatformAuthUsersAsync: async () => ({}), replacePlatformUserRolesAsync: jest.fn(async () => ({ roles: ['REVIEWER'] })) };
    const r = new HybridAuthRepository(local, domain); const t = r.createSession({ id: 'cas', identitySource: 'cas' }, 60000);
    domain.readPlatformAuthUserAsync.mockRejectedValueOnce(new Error('offline'));
    await expect(r.session(t)).rejects.toMatchObject(errorCode('AUTH_SERVICE_UNAVAILABLE'));
    domain.readPlatformAuthUserAsync.mockResolvedValueOnce(null); expect(await r.session(t)).toBeNull();
    domain.readPlatformAuthUserAsync.mockResolvedValueOnce({ enabled: false }); expect(await r.session(t)).toBeNull();
    domain.readPlatformAuthUserAsync.mockResolvedValueOnce({ enabled: true }); expect((await r.session(t)).user.id).toBe('cas');
    expect(await r.listUsers()).toEqual([expect.objectContaining({ id: u.id, rolesEditable: false, managementSource: 'local' })]);
    await expect(r.updateUserRoles(u.id, [], 'op', 1, 'key')).rejects.toMatchObject(errorCode('LOCAL_ACCOUNT_NOT_DATABASE_MANAGED'));
    for (const version of [null, 1.5, NaN]) await expect(r.updateUserRoles('cas', [], 'op', version, 'k')).rejects.toMatchObject(errorCode('ROW_VERSION_REQUIRED'));
    await expect(r.updateUserRoles('cas', [], 'op', 1, '')).rejects.toMatchObject(errorCode('IDEMPOTENCY_KEY_REQUIRED'));
    await expect(r.updateUserRoles('cas', ['REVIEWER'], 'op', 1, 'k')).resolves.toEqual({ roles: ['REVIEWER'] });
    expect(domain.replacePlatformUserRolesAsync).toHaveBeenCalledWith('cas', ['REVIEWER'], 1, 'k', 'op');
  });
  test('数据库聚合加载、保存、缺记录和异常传播', () => {
    const read = jest.fn(() => ({ users: [{ id: 'persisted' }] })); const write = jest.fn();
    jest.isolateModules(() => {
      jest.doMock('../../../packages/agent-runner-core/lib/aggregate-store', () => ({ DatabaseAggregateStore: jest.fn(function(namespace, key) { expect([namespace, key]).toEqual(['auth', 'state']); this.read = read; this.write = write; }) }));
      const { DatabaseAuthRepository, createKnowledgeCenterAuthService } = require('../../../packages/agent-runner-core/lib/knowledge-center-auth');
      const r = new DatabaseAuthRepository(); expect(r.state.users).toEqual([{ id: 'persisted' }]); r.save(); expect(write).toHaveBeenCalledWith(r.state);
      read.mockImplementationOnce(() => { throw Object.assign(new Error('absent'), { code: 'RECORD_NOT_FOUND' }); });
      expect(new DatabaseAuthRepository().state.users).toEqual([]);
      read.mockImplementationOnce(() => { throw new Error('database unavailable'); }); expect(() => new DatabaseAuthRepository()).toThrow('database unavailable');
      read.mockReturnValue({ users: [] });
      expect(createKnowledgeCenterAuthService({ casBaseUrl: 'http://cas', serviceUrl: 'http://app', repository: 'database' }).repository).toBeInstanceOf(DatabaseAuthRepository);
    });
    jest.dontMock('../../../packages/agent-runner-core/lib/aggregate-store');
  });
});

describe('认证真实 HTTP 与 CAS 边界', () => {
  let cas, casBase, server, base, service, repo;
  beforeAll(async () => {
    cas = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://cas'); const ticket = url.searchParams.get('ticket');
      expect(url.pathname).toBe('/serviceValidate'); expect(url.searchParams.get('service')).toBe('http://app/callback'); expect(url.searchParams.get('format')).toBe('json');
      if (ticket === 'timeout') return;
      if (ticket === 'disconnect') return req.socket.destroy();
      if (ticket === 'bad-json') return res.end('{');
      if (ticket === 'large') return res.end('x'.repeat(2048));
      if (ticket === 'status') { res.statusCode = 503; return res.end('{}'); }
      if (ticket === 'redirect') { res.statusCode = 302; return res.end('{}'); }
      if (ticket === 'failure') return res.end(JSON.stringify({ serviceResponse: { authenticationFailure: { description: ['expired'] } } }));
      if (ticket === 'empty') return res.end('null');
      if (ticket === 'prefixed-failure') return res.end(JSON.stringify({ 'cas:serviceResponse': { 'cas:authenticationFailure': {} } }));
      if (ticket === 'missing-subject') return res.end(JSON.stringify({ serviceResponse: { authenticationSuccess: {} } }));
      const success = { user: ticket, ...(ticket === 'prefixed' ? {} : { attributes: { cn: ['Name'] } }) };
      res.end(JSON.stringify(ticket === 'prefixed' ? { 'cas:serviceResponse': { 'cas:authenticationSuccess': success } } : { serviceResponse: { authenticationSuccess: success } }));
    });
    casBase = await listen(cas);
  });
  afterAll(async () => close(cas));
  beforeEach(async () => {
    repo = new MemoryAuthRepository(); service = auth.createKnowledgeCenterAuthService({ casBaseUrl: casBase, serviceUrl: 'http://app/callback', repository: repo, requestTimeoutMs: 30, maxCasResponseBytes: 1024 });
    server = http.createServer(service.handler); base = await listen(server);
  });
  afterEach(async () => close(server));
  const cookieOf = response => response.headers['set-cookie'][0].split(';')[0];
  async function adminCookie() { return cookieOf(await request(base, 'POST', '/auth/admin/login', { username: 'admin', password: 'admin' })); }
  test.each([
    ['bad-json', 'CAS_INVALID_RESPONSE', 502], ['large', 'CAS_RESPONSE_TOO_LARGE', 502], ['status', 'CAS_UNAVAILABLE', 502], ['redirect', 'CAS_UNAVAILABLE', 502],
    ['timeout', 'CAS_TIMEOUT', 504], ['disconnect', 'CAS_UNAVAILABLE', 502], ['failure', 'CAS_TICKET_INVALID', 401], ['empty', 'CAS_TICKET_INVALID', 401], ['prefixed-failure', 'CAS_TICKET_INVALID', 401], ['missing-subject', 'CAS_SUBJECT_MISSING', 401],
  ])('CAS %s 按稳定错误分类', async (ticket, code, status) => {
    const r = await request(base, 'POST', '/auth/cas/callback', { ticket });
    expect(r.status).toBe(status); expect(r.body.error.code).toBe(code);
    if (ticket === 'failure') expect(r.body.error.message).toBe('expired');
  });
  test.each([undefined, 23, '', 'x'.repeat(2049)])('拒绝非法 ticket %#', async ticket => {
    expect((await request(base, 'POST', '/auth/cas/callback', { ticket })).body.error.code).toBe('CAS_TICKET_INVALID');
  });
  test('前缀成功、票据不可重放、CAS退出回收和安全Cookie', async () => {
    const login = await request(base, 'POST', '/knowledge-center/api/auth/cas/callback', { ticket: 'prefixed' });
    expect(login.status).toBe(200); expect(login.body.content.user.loginName).toBe('prefixed');
    expect(login.headers['set-cookie'][0]).toMatch(/HttpOnly; SameSite=Lax; Secure;/);
    expect((await request(base, 'POST', '/auth/cas/callback', { ticket: 'prefixed' })).body.error.code).toBe('CAS_TICKET_REPLAYED');
    const cookie = cookieOf(login); const logout = await request(base, 'POST', '/auth/logout', {}, { cookie });
    expect(logout.body.content).toMatchObject({ logoutMode: 'cas', logoutUrl: `${casBase}/logout?service=http%3A%2F%2Fapp%2Fcallback` });
    expect(logout.headers['set-cookie'][0]).toContain('Max-Age=0; Secure');
    expect((await request(base, 'GET', '/auth/session', undefined, { cookie })).status).toBe(401);
  });
  test('失败登录审计、成功清计数、五次失败限流', async () => {
    for (let i = 0; i < 4; i++) expect((await request(base, 'POST', '/auth/admin/login', { username: 'missing', password: 'wrong' })).status).toBe(401);
    expect((await request(base, 'POST', '/auth/admin/login', { username: 'admin', password: 'admin' })).status).toBe(200);
    for (let i = 0; i < 5; i++) expect((await request(base, 'POST', '/auth/admin/login', { username: 'admin', password: 'wrong' })).status).toBe(401);
    expect((await request(base, 'POST', '/auth/admin/login', { username: 'admin', password: 'admin' })).status).toBe(429);
    expect(repo.state.audits.filter(a => a.action === 'ADMIN_LOGIN' && a.result === 'failed')).toHaveLength(9);
  });
  test('缺失凭据、禁用用户和损坏密码摘要', async () => {
    expect((await request(base, 'POST', '/auth/admin/login')).status).toBe(401);
    const u = repo.findLocal('admin'); u.enabled = false;
    expect((await request(base, 'POST', '/auth/admin/login', { username: 'admin', password: 'admin' })).status).toBe(401);
    u.enabled = true; u.passwordHash = null;
    expect((await request(base, 'POST', '/auth/admin/login', { username: 'admin' })).status).toBe(401);
    u.passwordHash = 'only-salt'; expect((await request(base, 'POST', '/auth/admin/login', { username: 'admin', password: 'admin' })).status).toBe(401);
  });
  test('非法JSON、超大输入断连接、未知路径和错误净化', async () => {
    expect((await request(base, 'POST', '/auth/admin/login', '{')).body.error.code).toBe('INVALID_JSON');
    await expect(request(base, 'POST', '/auth/admin/login', 'x'.repeat(32769))).rejects.toMatchObject({ code: 'ECONNRESET' });
    expect((await request(base, 'GET', '/auth/missing')).status).toBe(404);
    repo.session = async () => { throw new Error('secret database location'); };
    const r = await request(base, 'GET', '/auth/session', undefined, { 'x-request-id': 'auth-boundary-request', 'x-correlation-id': 'auth-boundary-correlation' });
    expect(r.status).toBe(503); expect(r.body.error).toMatchObject({ code: 'AUTH_SERVICE_UNAVAILABLE', retryable: true, requestId: 'auth-boundary-request' });
    expect(r.headers['x-correlation-id']).toBe('auth-boundary-correlation'); expect(JSON.stringify(r.body)).not.toContain('secret');
  });
  test('健康检查权限与本地退出幂等', async () => {
    expect((await request(base, 'GET', '/auth/health')).status).toBe(403);
    const editor = cookieOf(await request(base, 'POST', '/auth/admin/login', { username: 'test', password: 'test' }));
    expect((await request(base, 'GET', '/auth/health', undefined, { cookie: editor })).status).toBe(403);
    const cookie = await adminCookie();
    expect((await request(base, 'GET', '/auth/health', undefined, { cookie })).body.content).toMatchObject({ status: 'ok', repository: 'MemoryAuthRepository' });
    expect((await request(base, 'POST', '/auth/logout', {}, { cookie })).body.content).toEqual({ logoutMode: 'local', logoutUrl: null });
    expect((await request(base, 'POST', '/auth/logout', {}, { cookie })).status).toBe(200);
  });
  test('用户筛选、分页限界与缺角色投影', async () => {
    const cookie = await adminCookie(); const headers = { cookie };
    const u = repo.upsertCas({ user: 'alice' }); u.enabled = false; u.roles = undefined;
    const v = repo.upsertCas({ user: 'bob' }); v.roles = ['REVIEWER'];
    repo.upsertCas({ user: 'root' }).roles = ['SUPER_ADMIN'];
    expect((await request(base, 'GET', '/auth/users?q=alice&status=disabled', undefined, headers)).body.content.users).toEqual([expect.objectContaining({ id: u.id, roles: [] })]);
    const r = await request(base, 'GET', '/auth/users?status=active&role=REVIEWER&page=99&pageSize=1', undefined, headers);
    expect(r.body.content.pagination).toEqual({ page: 1, pageSize: 1, total: 1, totalPages: 1 }); expect(r.body.content.users[0].id).toBe(v.id);
    expect((await request(base, 'GET', '/auth/users?q=not-found&page=-3&pageSize=999', undefined, headers)).body.content.pagination).toEqual({ page: 1, pageSize: 100, total: 0, totalPages: 1 });
    expect((await request(base, 'GET', '/auth/users?pageSize=-4', undefined, headers)).body.content.pagination.pageSize).toBe(1);
  });
  test('CAS已禁用用户拒绝建立会话', async () => {
    repo.upsertCas({ user: 'disabled' }).enabled = false;
    expect((await request(base, 'POST', '/auth/cas/callback', { ticket: 'disabled' })).body.error.code).toBe('USER_DISABLED');
    expect(repo.state.sessions).toHaveLength(0);
  });
});

describe('认证配置与授权回归', () => {
  test('必填配置、显式文件路径与默认路径均隔离到runtime', () => {
    expect(() => auth.createKnowledgeCenterAuthService()).toThrow('CAS base URL');
    expect(() => auth.createKnowledgeCenterAuthService({ casBaseUrl: 'http://cas' })).toThrow('CAS base URL');
    const options = { casBaseUrl: 'http://cas/', serviceUrl: 'http://app', secureCookie: false };
    const file = path.join(scratch, 'explicit.json');
    expect(auth.createKnowledgeCenterAuthService({ ...options, repositoryPath: file }).repository).toBeInstanceOf(FileAuthRepository);
    const cwd = jest.spyOn(process, 'cwd').mockReturnValue(scratch);
    try { expect(auth.createKnowledgeCenterAuthService(options).repository.filePath).toBe(path.join(scratch, 'tmp/knowledge-center-auth.json')); }
    finally { cwd.mockRestore(); }
    expect(new AuthError('DEFAULT', 'default').status).toBe(400);
  });
  test('文件仓储搭配业务存储时自动包装，内存仓储保持独立', () => {
    const options = { casBaseUrl: 'http://cas', serviceUrl: 'http://app', domainStore: {} };
    expect(auth.createKnowledgeCenterAuthService({ ...options, repositoryPath: path.join(scratch, 'hybrid.json') }).repository).toBeInstanceOf(HybridAuthRepository);
    expect(auth.createKnowledgeCenterAuthService({ ...options, repository: 'memory' }).repository).toBeInstanceOf(MemoryAuthRepository);
  });
  test('普通管理员不能操作超级管理员；匿名及编辑用户不能修改角色', async () => {
    const repository = new MemoryAuthRepository();
    const admin = repository.ensureBuiltinUser('manager', 'p', 'PLATFORM_ADMIN');
    const superUser = repository.upsertCas({ user: 'super' }); superUser.roles = ['SUPER_ADMIN'];
    const target = repository.upsertCas({ user: 'target' });
    const service = auth.createKnowledgeCenterAuthService({ repository, casBaseUrl: 'http://cas', serviceUrl: 'http://app', secureCookie: false, environment: 'test', testRunId: 'boundary' });
    const server = http.createServer(service.handler); const base = await listen(server);
    try {
      expect((await request(base, 'GET', '/auth/config')).body.testRunId).toBe('boundary');
      const login = await request(base, 'POST', '/auth/admin/login', { username: 'manager', password: 'p' });
      expect(login.headers['set-cookie'][0]).not.toContain('Secure');
      const cookie = login.headers['set-cookie'][0].split(';')[0];
      const endpoint = `/auth/users/${target.id}/roles`;
      expect((await request(base, 'PATCH', endpoint, { roles: ['REVIEWER'] })).status).toBe(401);
      const editorToken = repository.createSession(repository.findLocal('test'), 60000);
      const editorCookie = `kc_session=${editorToken}`;
      expect((await request(base, 'PATCH', endpoint, { roles: ['REVIEWER'] }, { cookie: editorCookie })).status).toBe(403);
      expect((await request(base, 'GET', '/auth/users', undefined, { cookie: editorCookie })).status).toBe(403);
      expect((await request(base, 'PATCH', endpoint, { roles: ['SUPER_ADMIN'] }, { cookie })).body.error.code).toBe('SUPER_ADMIN_REQUIRED');
      expect((await request(base, 'PATCH', `/auth/users/${superUser.id}/roles`, { roles: ['REVIEWER'] }, { cookie })).body.error.code).toBe('SUPER_ADMIN_REQUIRED');
      expect((await request(base, 'PATCH', '/auth/users/missing/roles', {}, { cookie })).status).toBe(404);
      expect((await request(base, 'PATCH', endpoint, { roles: ['REVIEWER'] }, { cookie, 'if-match': '"2"', 'idempotency-key': 'change' })).status).toBe(200);
      target.displayName = undefined; target.loginName = undefined;
      const listed = await request(base, 'GET', `/auth/users?q=${target.id}`, undefined, { cookie: `flag; ${cookie}` });
      expect(listed.body.content.users[0].id).toBe(target.id);
      const list = await request(base, 'GET', '/auth/users', undefined, { cookie });
      expect(list.body.content.users.find(u => u.id === superUser.id).rolesEditable).toBe(false);
      expect(list.body.content.assignableRoles).not.toContain('SUPER_ADMIN');
      expect((await request(base, 'POST', '/auth/logout', {}, { cookie })).headers['set-cookie'][0]).not.toContain('Secure');
      expect(admin.roles).toEqual(['PLATFORM_ADMIN']);
    } finally { await close(server); }
  });
  test('性能跟踪开关仍可通过真实HTTP登录', async () => {
    const previous = process.env.PERF_TRACE; process.env.PERF_TRACE = '1';
    const service = auth.createKnowledgeCenterAuthService({ repository: 'memory', casBaseUrl: 'http://cas', serviceUrl: 'http://app' });
    const server = http.createServer(service.handler); const base = await listen(server);
    try { expect((await request(base, 'POST', '/auth/admin/login', { username: 'admin', password: 'admin' })).status).toBe(200); }
    finally { if (previous === undefined) delete process.env.PERF_TRACE; else process.env.PERF_TRACE = previous; await close(server); }
  });
});
