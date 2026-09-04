/**
 * Knowledge-center authentication contract tests.
 *
 * These tests intentionally exercise a real HTTP handler.  They do not mock
 * the platform authentication service; only the external CAS service is a
 * deterministic, one-shot protocol stub.  Until the implementation is
 * provided, the suite fails with a clear missing-module/factory error.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const childProcess = require('child_process');

const AUTH_MODULE = '../lib/knowledge-center-auth';
const AUTH_PREFIX = process.env.KC_AUTH_PREFIX || '/knowledge-center/auth';
const AUTH_PATH = suffix => `${AUTH_PREFIX}/${suffix}`;
const BUSINESS_PROBE = process.env.KC_BUSINESS_PROBE || '/knowledge-center/api/business/probe';
const ADMIN_PROBE = process.env.KC_ADMIN_PROBE || '/knowledge-center/api/admin/probe';

function jsonRequest(base, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : JSON.stringify(body);
    const url = new URL(path, base);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
      timeout: 5000,
    }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        let data = text;
        try { data = JSON.parse(text); } catch (_) { /* non-JSON response is asserted by tests */ }
        resolve({ status: res.statusCode, headers: res.headers, data, text });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    if (payload) req.write(payload);
    req.end();
  });
}

function startCasStub() {
  const consumed = new Set();
  const tickets = new Map([
    ['ST-business-1', { username: 'alice', uid: 'uid-alice', cn: 'Alice', mail: 'alice@example.test', employeeNumber: 'E001' }],
    ['ST-business-2', { username: 'alice', uid: 'uid-alice', cn: 'Alice Updated', mail: 'alice2@example.test', employeeNumber: 'E001' }],
    ['ST-admin', { username: 'root-cas', uid: 'uid-root', cn: 'Root' }],
  ]);
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, 'http://cas.test');
    if (requestUrl.pathname === '/login') {
      res.writeHead(302, { location: `${requestUrl.searchParams.get('service')}?ticket=ST-business-1` });
      return res.end();
    }
    if (requestUrl.pathname !== '/serviceValidate') {
      res.writeHead(404); return res.end();
    }
    const ticket = requestUrl.searchParams.get('ticket');
    const service = requestUrl.searchParams.get('service');
    const expectedService = process.env.KC_AUTH_SERVICE_URL || 'http://127.0.0.1:1/knowledge-center/auth/callback';
    if (service !== expectedService || consumed.has(ticket) || !tickets.has(ticket)) {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ serviceResponse: { authenticationFailure: { code: 'INVALID_TICKET', description: '票据无效或已使用' } } }));
      return;
    }
    consumed.add(ticket);
    const user = tickets.get(ticket);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ serviceResponse: {
      authenticationSuccess: {
        user: user.username,
        attributes: {
          uid: [user.uid], mail: user.mail ? [user.mail] : [], cn: user.cn ? [user.cn] : [],
          employeeNumber: user.employeeNumber ? [user.employeeNumber] : [],
        },
      },
    } }));
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    resolve({ server, baseUrl: `http://127.0.0.1:${address.port}`, consumed });
  }));
}

function handlerFromModule(mod, options) {
  const factory = mod.createKnowledgeCenterAuthService || mod.createAuthService || mod.createServer;
  if (typeof factory !== 'function') throw new Error(`${AUTH_MODULE} must export createKnowledgeCenterAuthService(options)`);
  const service = factory(options);
  return typeof service === 'function' ? service : service.handler || service.requestHandler;
}

describe('知识中心认证 HTTP 契约（真实服务 + CAS 协议桩）', () => {
  test('入口依赖完整且初始化超时提供恢复入口', () => {
    const root = path.resolve(__dirname, '..');
    const html = fs.readFileSync(path.join(root, 'frontend/knowledge-center/knowledge-center-management.html'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'frontend/knowledge-center/app.js'), 'utf8');
    const appDirectory = path.dirname(path.join(root, 'frontend/knowledge-center/app.js'));
    const imports = [...app.matchAll(/from\s+['"](\.\/[^'"]+\.js)['"]/g)].map(match => match[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const importPath of imports) {
      expect(fs.existsSync(path.resolve(appDirectory, importPath))).toBe(true);
    }
    expect(() => childProcess.execFileSync(process.execPath, ['--check', path.join(appDirectory, 'app.js')], { stdio: 'pipe' })).not.toThrow();
    expect(html).toContain('auth-bootstrap-fallback');
    expect(html).toContain('data-bootstrap-timeout');
  });

  test('入口模块未完成初始化时会退出无限加载并显示重新加载按钮', () => {
    const root = path.resolve(__dirname, '..');
    const html = fs.readFileSync(path.join(root, 'frontend/knowledge-center/knowledge-center-management.html'), 'utf8');
    const script = html.match(/<script id="auth-bootstrap-watchdog">([\s\S]*?)<\/script>/)?.[1];
    const loading = { hidden: false, setAttribute: jest.fn() };
    const fallback = { hidden: true };
    let watchdog;

    vm.runInNewContext(script, {
      window: { setTimeout: callback => { watchdog = callback; } },
      document: {
        getElementById: id => ({
          'auth-loading': loading,
          'auth-bootstrap-fallback': fallback,
        })[id] || null,
      },
    });
    watchdog();

    expect(fallback.hidden).toBe(false);
    expect(loading.setAttribute).toHaveBeenCalledWith('data-bootstrap-timeout', 'true');
  });

  let cas;
  let app;
  let server;
  let base;
  let businessCookie;

  beforeAll(async () => {
    cas = await startCasStub();
    process.env.KC_AUTH_SERVICE_URL = process.env.KC_AUTH_SERVICE_URL || 'http://127.0.0.1:1/knowledge-center/auth/callback';
    // The implementation may use an injected repository; this in-memory
    // repository contract keeps tests deterministic and transaction-friendly.
    const mod = require(AUTH_MODULE);
    app = handlerFromModule(mod, {
      casBaseUrl: cas.baseUrl,
      serviceUrl: process.env.KC_AUTH_SERVICE_URL,
      sessionSecret: 'contract-test-secret',
      adminUsername: 'admin',
      adminPassword: 'admin',
      repository: 'memory',
    });
    if (typeof app !== 'function') throw new Error('auth service must expose a Node (req,res) handler');
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await Promise.all([
      server && new Promise(resolve => server.close(resolve)),
      cas && new Promise(resolve => cas.server.close(resolve)),
    ]);
  });

  test('公开配置和未登录会话返回 JSON；受保护探针返回 401', async () => {
    const config = await jsonRequest(base, 'GET', AUTH_PATH('config'));
    expect(config.status).toBe(200);
    expect(config.headers['content-type']).toMatch(/application\/json/);
    expect(config.data).toEqual(expect.objectContaining({ enabled: expect.any(Boolean) }));
    const session = await jsonRequest(base, 'GET', AUTH_PATH('session'));
    expect([200, 401]).toContain(session.status);
    expect(session.headers['content-type']).toMatch(/application\/json/);
    const protectedProbe = await jsonRequest(base, 'GET', BUSINESS_PROBE);
    expect(protectedProbe.status).toBe(401);
  });

  test('CAS 首次登录建档、默认业务角色；会话 Cookie 不可脚本读取', async () => {
    const result = await jsonRequest(base, 'POST', AUTH_PATH('cas/callback'), { ticket: 'ST-business-1' });
    expect(result.status).toBe(200);
    expect(result.data).toEqual(expect.objectContaining({ firstLogin: true }));
    expect(result.headers['set-cookie']?.join(';')).toMatch(/HttpOnly/i);
    expect(result.headers['set-cookie']?.join(';')).toMatch(/SameSite/i);
    businessCookie = result.headers['set-cookie']?.map(value => value.split(';')[0]).join('; ');
    const probe = await jsonRequest(base, 'GET', BUSINESS_PROBE, null, { cookie: businessCookie });
    expect(probe.status).toBe(200);
    const session = await jsonRequest(base, 'GET', AUTH_PATH('session'), null, { cookie: businessCookie });
    expect(session.data.content.allowedActions).toEqual(expect.arrayContaining(['outline:read']));
    expect(session.data.content.allowedActions).not.toEqual(expect.arrayContaining(['outline:create', 'outline:delete']));
    const adminProbe = await jsonRequest(base, 'GET', ADMIN_PROBE, null, { cookie: businessCookie });
    expect(adminProbe.status).toBe(403);
  });

  test('ticket 一次性消费、service 不匹配和越界深链均被拒绝', async () => {
    const replay = await jsonRequest(base, 'POST', AUTH_PATH('cas/callback'), { ticket: 'ST-business-1' });
    expect(replay.status).toBeGreaterThanOrEqual(400);
    const mismatch = await jsonRequest(base, 'POST', AUTH_PATH('cas/callback'), { ticket: 'ST-business-2', service: 'https://evil.test/callback' });
    expect(mismatch.status).toBeGreaterThanOrEqual(400);
    const openRedirect = await jsonRequest(base, 'POST', AUTH_PATH('cas/callback'), { ticket: 'ST-business-2', redirectTo: 'https://evil.test/' });
    expect(openRedirect.status).toBeLessThan(500);
    if (openRedirect.data && typeof openRedirect.data === 'object') expect(JSON.stringify(openRedirect.data)).not.toContain('evil.test');
  });

  test('管理员登录可建立管理会话；登出后会话失效且接口幂等', async () => {
    const login = await jsonRequest(base, 'POST', AUTH_PATH('admin/login'), { username: process.env.KC_ADMIN_USERNAME || 'admin', password: process.env.KC_ADMIN_PASSWORD || 'admin' });
    expect(login.status).toBe(200);
    const cookie = login.headers['set-cookie']?.map(value => value.split(';')[0]).join('; ');
    const session = await jsonRequest(base, 'GET', AUTH_PATH('session'), null, { cookie });
    expect(session.data.content.allowedActions).toEqual(expect.arrayContaining(['outline:read', 'outline:create', 'outline:delete']));
    const adminProbe = await jsonRequest(base, 'GET', ADMIN_PROBE, null, { cookie });
    expect(adminProbe.status).toBe(200);
    const logout = await jsonRequest(base, 'POST', AUTH_PATH('logout'), null, { cookie });
    expect([200, 204]).toContain(logout.status);
    const after = await jsonRequest(base, 'GET', ADMIN_PROBE, null, { cookie });
    expect(after.status).toBe(401);
    const repeat = await jsonRequest(base, 'POST', AUTH_PATH('logout'), null, { cookie });
    expect([200, 204, 401]).toContain(repeat.status);
  });

  test('平台管理员可为 CAS 用户配置角色，普通用户被拒绝', async () => {
    const login = await jsonRequest(base, 'POST', AUTH_PATH('admin/login'), { username: process.env.KC_ADMIN_USERNAME || 'admin', password: process.env.KC_ADMIN_PASSWORD || 'admin' });
    const adminCookie = login.headers['set-cookie']?.map(value => value.split(';')[0]).join('; ');
    const users = await jsonRequest(base, 'GET', AUTH_PATH('users'), null, { cookie: adminCookie });
    expect(users.status).toBe(200);
    expect(users.data.content.assignableRoles).toEqual(expect.arrayContaining(['PLATFORM_ADMIN', 'KNOWLEDGE_EDITOR']));
    const target = users.data.content.users.find(item => item.loginName === 'alice');
    expect(target).toBeTruthy();
    const updated = await jsonRequest(base, 'PATCH', AUTH_PATH(`users/${encodeURIComponent(target.id)}/roles`), { roles: ['PLATFORM_ADMIN'] }, { cookie: adminCookie });
    expect(updated.status).toBe(200);
    expect(updated.data.content.user.roles).toContain('PLATFORM_ADMIN');
    const promotedSession = await jsonRequest(base, 'GET', AUTH_PATH('session'), null, { cookie: businessCookie });
    expect(promotedSession.data.content.roles).toContain('PLATFORM_ADMIN');
    const forbidden = await jsonRequest(base, 'GET', AUTH_PATH('users'), null, { cookie: 'kc_session=invalid' });
    expect(forbidden.status).toBe(401);
  });
});
