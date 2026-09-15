const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { DatabaseAggregateStore } = require('./aggregate-store');
let logger;
try { logger = require('./logger'); } catch (_) { logger = { info() {} }; }

function perfTrace(message, meta) {
  if (process.env.PERF_TRACE === '1') logger.info(`[perf] ${message}`, meta);
}

const COOKIE_NAME = 'kc_session';
const BUSINESS_MODULES = ['dashboard', 'assets', 'cleaning', 'outlines', 'templates', 'production'];
const BUSINESS_ACTIONS = ['knowledge:read', 'knowledge:write', 'outline:read'];
const ADMIN_MODULES = [...BUSINESS_MODULES, 'review', 'platform'];
const ADMIN_ACTIONS = [...BUSINESS_ACTIONS, 'outline:create', 'outline:delete', 'review:manage', 'publish:manage', 'platform:manage', 'template:read', 'template:edit', 'template:manage'];
const ASSIGNABLE_ROLES = ['KNOWLEDGE_EDITOR', 'OUTLINE_MANAGER', 'REVIEWER', 'TEMPLATE_EDITOR', 'PLATFORM_ADMIN'];
const ROLE_DEFINITIONS = {
  KNOWLEDGE_EDITOR: { actions: ['knowledge:read', 'knowledge:write', 'outline:read'], modules: [...BUSINESS_MODULES, 'review'] },
  OUTLINE_MANAGER: { actions: ['knowledge:read', 'knowledge:write', 'outline:read', 'outline:create', 'outline:delete'], modules: BUSINESS_MODULES },
  REVIEWER: { actions: ['knowledge:read', 'review:manage'], modules: [...BUSINESS_MODULES, 'review'] },
  TEMPLATE_EDITOR: { actions: ['knowledge:read', 'template:read', 'template:edit'], modules: ['templates'] },
  PLATFORM_ADMIN: { actions: ADMIN_ACTIONS, modules: ADMIN_MODULES },
};

class AuthError extends Error {
  constructor(code, message, status = 400, retryable = false) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function ok(res, content, headers) {
  json(res, 200, { success: true, content }, headers);
}

function fail(res, error) {
  const known = error instanceof AuthError;
  json(res, known ? error.status : 500, {
    success: false,
    error: {
      code: known ? error.code : 'INTERNAL_ERROR',
      message: known ? error.message : '认证服务处理失败',
      retryable: known ? error.retryable : false,
    },
  });
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(item => item.trim()).filter(Boolean).map(item => {
    const index = item.indexOf('=');
    return index === -1 ? [item, ''] : [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
  }));
}

function readBody(req, limit = 32 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new AuthError('REQUEST_TOO_LARGE', '请求内容过大', 413));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new AuthError('INVALID_JSON', '请求参数格式错误', 400));
      }
    });
    req.on('error', reject);
  });
}

function randomId(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || '').split(':');
  if (!salt || !expected) return false;
  return safeEqual(passwordHash(password, salt), stored);
}

function first(value) {
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

class FileAuthRepository {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = { users: [], sessions: [], consumedTickets: [], audits: [] };
    this.load();
  }

  load() {
    try {
      this.state = { ...this.state, ...JSON.parse(fs.readFileSync(this.filePath, 'utf8')) };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, this.filePath);
  }

  ensureAdmin(username, password) {
    let user = this.state.users.find(item => item.identitySource === 'local' && item.loginName === username);
    if (!user) {
      const now = new Date().toISOString();
      user = {
        id: `usr_${randomId(12)}`,
        identitySource: 'local',
        enterpriseSubject: `local:${username}`,
        loginName: username,
        displayName: '平台管理员',
        passwordHash: passwordHash(password),
        enabled: true,
        roles: ['PLATFORM_ADMIN'],
        createdAt: now,
        updatedAt: now,
      };
      this.state.users.push(user);
      this.audit('ADMIN_INITIALIZED', user.id, 'success');
      this.save();
    }
    return user;
  }

  ensureBuiltinUser(username, password, role = 'KNOWLEDGE_EDITOR') {
    if (!ASSIGNABLE_ROLES.includes(role)) throw new AuthError('ROLE_INVALID', `不支持的内置角色：${role}`, 400);
    let user = this.state.users.find(item => item.identitySource === 'local' && item.loginName === username);
    if (!user) {
      const now = new Date().toISOString();
      user = {
        id: `usr_${randomId(12)}`,
        identitySource: 'local',
        enterpriseSubject: `local:${username}`,
        loginName: username,
        displayName: '知识编辑测试用户',
        passwordHash: passwordHash(password),
        enabled: true,
        roles: [role],
        builtin: true,
        createdAt: now,
        updatedAt: now,
      };
      this.state.users.push(user);
      this.audit('BUILTIN_USER_INITIALIZED', user.id, 'success', { role });
      this.save();
    } else if (user.builtin && (!Array.isArray(user.roles) || user.roles.length === 0)) {
      // Keep the built-in account role-driven. Existing installations with an
      // incomplete record are repaired from the configured role, never from a
      // login-name permission branch.
      user.roles = [role];
      user.updatedAt = new Date().toISOString();
      this.save();
    }
    return user;
  }

  findLocal(username) {
    return this.state.users.find(item => item.identitySource === 'local' && item.loginName === username);
  }

  upsertCas(info) {
    const subject = first(info.uid) || first(info.user);
    if (!subject) throw new AuthError('CAS_SUBJECT_MISSING', '统一认证未返回稳定用户标识', 401);
    let user = this.state.users.find(item => item.identitySource === 'cas' && item.enterpriseSubject === subject);
    const now = new Date().toISOString();
    if (!user) {
      user = {
        id: `usr_${randomId(12)}`,
        identitySource: 'cas',
        enterpriseSubject: subject,
        loginName: first(info.user) || subject,
        displayName: first(info.cn) || first(info.user) || subject,
        email: first(info.mail),
        employeeNo: first(info.employeeNumber),
        enabled: true,
        roles: ['KNOWLEDGE_EDITOR'],
        createdAt: now,
        updatedAt: now,
      };
      this.state.users.push(user);
      this.audit('CAS_USER_CREATED', user.id, 'success');
    } else {
      user.displayName = first(info.cn) || user.displayName;
      user.email = first(info.mail) || user.email;
      user.employeeNo = first(info.employeeNumber) || user.employeeNo;
      user.updatedAt = now;
    }
    this.save();
    return user;
  }

  consumeTicket(ticket) {
    const digest = hash(ticket);
    if (this.state.consumedTickets.some(item => item.hash === digest)) {
      throw new AuthError('CAS_TICKET_REPLAYED', '统一认证信息已使用，请重新登录', 401);
    }
    this.state.consumedTickets.push({ hash: digest, consumedAt: new Date().toISOString() });
    this.save();
  }

  createSession(user, ttlMs) {
    const token = randomId();
    const now = Date.now();
    this.state.sessions.push({
      idHash: hash(token),
      userId: user.id,
      authMethod: user.identitySource,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
      revokedAt: null,
    });
    this.audit('SESSION_CREATED', user.id, 'success', { authMethod: user.identitySource });
    this.save();
    return token;
  }

  session(token) {
    if (!token) return null;
    const record = this.state.sessions.find(item => item.idHash === hash(token));
    if (!record || record.revokedAt || Date.parse(record.expiresAt) <= Date.now()) return null;
    const user = this.state.users.find(item => item.id === record.userId);
    return user?.enabled ? { record, user } : null;
  }

  revoke(token) {
    if (!token) return;
    const record = this.state.sessions.find(item => item.idHash === hash(token));
    if (record && !record.revokedAt) {
      record.revokedAt = new Date().toISOString();
      this.audit('SESSION_REVOKED', record.userId, 'success');
      this.save();
    }
  }

  audit(action, userId, result, details = {}) {
    this.state.audits.push({ id: `aud_${randomId(10)}`, action, userId, result, details, at: new Date().toISOString() });
    if (this.state.audits.length > 5000) this.state.audits.splice(0, this.state.audits.length - 5000);
  }

  listUsers() {
    return this.state.users.map(user => ({ ...user, passwordHash: undefined }));
  }

  findUserById(id) {
    return this.state.users.find(item => item.id === id);
  }

  updateUserRoles(id, roles, operatorId) {
    const user = this.findUserById(id);
    if (!user) throw new AuthError('USER_NOT_FOUND', '用户不存在', 404);
    const normalized = [...new Set((Array.isArray(roles) ? roles : []).map(role => String(role).trim()).filter(Boolean))];
    if (!normalized.length) throw new AuthError('ROLE_REQUIRED', '至少需要保留一个角色', 400);
    const invalid = normalized.filter(role => !ASSIGNABLE_ROLES.includes(role));
    if (invalid.length) throw new AuthError('ROLE_INVALID', `不支持的角色：${invalid.join('、')}`, 400);
    const before = [...(user.roles || [])];
    user.roles = normalized;
    user.updatedAt = new Date().toISOString();
    this.audit('USER_ROLES_UPDATED', operatorId || null, 'success', { targetUserId: id, before, after: normalized });
    this.save();
    return user;
  }
}

class MemoryAuthRepository extends FileAuthRepository {
  constructor() {
    super(path.join(process.cwd(), 'tmp', `unused-auth-${process.pid}.json`));
    this.state = { users: [], sessions: [], consumedTickets: [], audits: [] };
  }

  load() {}
  save() {}
}

class DatabaseAuthRepository extends FileAuthRepository {
  constructor() {
    super(null);
    this.filePath = null;
    this.state = { users: [], sessions: [], consumedTickets: [], audits: [] };
    this.store = new DatabaseAggregateStore('auth', 'state', this.state);
    try { this.load(); } catch (error) {
      if (error.code !== 'RECORD_NOT_FOUND') throw error;
    }
  }

  load() {
    if (!this.store) return;
    this.state = { ...this.state, ...this.store.read() };
  }

  save() {
    this.store.write(this.state);
  }
}

function userProjection(user) {
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const definitions = roles.map(role => ROLE_DEFINITIONS[role]).filter(Boolean);
  const visibleModules = [...new Set(definitions.flatMap(item => item.modules))];
  const allowedActions = [...new Set(definitions.flatMap(item => item.actions))];
  return {
    id: user.id,
    loginName: user.loginName,
    displayName: user.displayName,
    identitySource: user.identitySource,
    roles,
    visibleModules,
    allowedActions,
  };
}

function validateCasResponse(payload) {
  const serviceResponse = payload?.serviceResponse || payload?.['cas:serviceResponse'];
  const success = serviceResponse?.authenticationSuccess || serviceResponse?.['cas:authenticationSuccess'];
  if (!success) {
    const failure = serviceResponse?.authenticationFailure || serviceResponse?.['cas:authenticationFailure'];
    throw new AuthError('CAS_TICKET_INVALID', first(failure?.description) || '统一认证信息无效或已过期', 401);
  }
  const attributes = success.attributes || {};
  return { user: success.user, ...attributes };
}

function requestJson(target, timeoutMs, maxBytes) {
  return new Promise((resolve, reject) => {
    const transport = target.protocol === 'https:' ? https : http;
    const request = transport.get(target, { headers: { Accept: 'application/json' } }, response => {
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > maxBytes) {
          request.destroy(new AuthError('CAS_RESPONSE_TOO_LARGE', '统一认证响应超过限制', 502));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new AuthError('CAS_UNAVAILABLE', `统一认证返回 HTTP ${response.statusCode}`, 502, true));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(new AuthError('CAS_INVALID_RESPONSE', '统一认证响应格式错误', 502, true));
        }
      });
    });
    request.setTimeout(timeoutMs, () => request.destroy(new AuthError('CAS_TIMEOUT', '统一认证响应超时', 504, true)));
    request.on('error', error => reject(error instanceof AuthError ? error : new AuthError('CAS_UNAVAILABLE', '统一认证暂时不可用', 502, true)));
  });
}

function createKnowledgeCenterAuthService(options = {}) {
  const config = {
    casBaseUrl: String(options.casBaseUrl || '').replace(/\/$/, ''),
    serviceUrl: String(options.serviceUrl || ''),
    adminUsername: String(options.adminUsername || 'admin'),
    adminPassword: String(options.adminPassword || 'admin'),
    knowledgeEditorUsername: String(options.knowledgeEditorUsername || 'test'),
    knowledgeEditorPassword: String(options.knowledgeEditorPassword || 'test'),
    sessionTtlMs: Number(options.sessionTtlMs || 8 * 60 * 60 * 1000),
    secureCookie: options.secureCookie !== false,
    requestTimeoutMs: Number(options.requestTimeoutMs || 5000),
    maxCasResponseBytes: Number(options.maxCasResponseBytes || 256 * 1024),
  };
  if (!config.casBaseUrl || !config.serviceUrl) throw new Error('CAS base URL and service URL are required');
  const repository = options.repository === 'memory'
    ? new MemoryAuthRepository()
    : options.repository === 'database'
      ? new DatabaseAuthRepository()
    : options.repository || new FileAuthRepository(options.repositoryPath || path.join(process.cwd(), 'tmp', 'knowledge-center-auth.json'));
  repository.ensureAdmin(config.adminUsername, config.adminPassword);
  repository.ensureBuiltinUser(config.knowledgeEditorUsername, config.knowledgeEditorPassword, 'KNOWLEDGE_EDITOR');
  const failedAdminAttempts = new Map();

  const cookie = token => [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    config.secureCookie ? 'Secure' : '',
    `Max-Age=${Math.floor(config.sessionTtlMs / 1000)}`,
  ].filter(Boolean).join('; ');
  const clearCookie = () => `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${config.secureCookie ? '; Secure' : ''}`;
  const current = req => repository.session(parseCookies(req.headers.cookie)[COOKIE_NAME]);

  async function validateTicket(ticket) {
    if (!ticket || typeof ticket !== 'string' || ticket.length > 2048) throw new AuthError('CAS_TICKET_INVALID', '统一认证信息无效', 401);
    if (repository.state?.consumedTickets?.some(item => item.hash === hash(ticket))) {
      throw new AuthError('CAS_TICKET_REPLAYED', '统一认证信息已使用，请重新登录', 401);
    }
    const endpoint = new URL(`${config.casBaseUrl}/serviceValidate`);
    endpoint.searchParams.set('service', config.serviceUrl);
    endpoint.searchParams.set('ticket', ticket);
    endpoint.searchParams.set('format', 'json');
    const info = validateCasResponse(await requestJson(endpoint, config.requestTimeoutMs, config.maxCasResponseBytes));
    repository.consumeTicket(ticket);
    return info;
  }

  async function handler(req, res) {
    try {
      const url = new URL(req.url, 'http://auth.local');
      const pathname = url.pathname.replace(/^\/knowledge-center\/(?:api\/)?auth/, '/auth');
      if (req.method === 'GET' && pathname === '/auth/config') {
        const login = new URL(`${config.casBaseUrl}/login`);
        login.searchParams.set('service', config.serviceUrl);
        const content = { enabled: true, casEnabled: true, loginUrl: login.toString(), adminLoginEnabled: true, productName: '知识中心管理' };
        return json(res, 200, { success: true, content, ...content });
      }
      if (req.method === 'GET' && pathname === '/auth/session') {
        const session = current(req);
        if (!session) throw new AuthError('AUTH_REQUIRED', '请登录后继续', 401);
        const projection = userProjection(session.user);
        return ok(res, { authenticated: true, authMethod: session.record.authMethod, user: projection, roles: projection.roles, visibleModules: projection.visibleModules, allowedActions: projection.allowedActions, expiresAt: session.record.expiresAt });
      }
      if (req.method === 'POST' && pathname === '/auth/cas/callback') {
        const body = await readBody(req);
        if (body.service || body.serviceUrl) throw new AuthError('CAS_SERVICE_MISMATCH', 'CAS service 由服务端固定配置', 400);
        const info = await validateTicket(body.ticket);
        const user = repository.upsertCas(info);
        if (!user.enabled) throw new AuthError('USER_DISABLED', '当前账号无法访问平台', 403);
        const token = repository.createSession(user, config.sessionTtlMs);
        const content = { firstLogin: user.createdAt === user.updatedAt, user: userProjection(user) };
        return json(res, 200, { success: true, content, ...content }, { 'Set-Cookie': cookie(token) });
      }
      if (req.method === 'POST' && pathname === '/auth/admin/login') {
        const startedAt = process.hrtime.bigint();
        const remote = req.socket.remoteAddress || 'unknown';
        const attempts = failedAdminAttempts.get(remote) || [];
        const recent = attempts.filter(at => Date.now() - at < 60_000);
        if (recent.length >= 5) throw new AuthError('ADMIN_LOGIN_RATE_LIMITED', '登录失败次数过多，请稍后再试', 429, true);
        const body = await readBody(req);
        perfTrace('auth login body parsed', { durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6 });
        const user = repository.findLocal(String(body.username || ''));
        perfTrace('auth local user lookup', { durationMs: Number(process.hrtime.bigint() - startedAt), found: Boolean(user) });
        if (!user || !user.enabled || !verifyPassword(String(body.password || ''), user.passwordHash)) {
          recent.push(Date.now());
          failedAdminAttempts.set(remote, recent);
          repository.audit('ADMIN_LOGIN', user?.id || null, 'failed');
          repository.save();
          throw new AuthError('ADMIN_CREDENTIALS_INVALID', '管理员账号或密码错误', 401);
        }
        failedAdminAttempts.delete(remote);
        repository.audit('ADMIN_LOGIN', user.id, 'success');
        const token = repository.createSession(user, config.sessionTtlMs);
        const projection = userProjection(user);
        perfTrace('auth login completed', { durationMs: Number(process.hrtime.bigint() - startedAt), userId: user.id });
        // 登录响应直接携带完整会话投影，前端无需再立即 GET /session。
        return ok(res, {
          authenticated: true,
          authMethod: 'admin',
          user: projection,
          roles: projection.roles,
          visibleModules: projection.visibleModules,
          allowedActions: projection.allowedActions,
          expiresAt: new Date(Date.now() + config.sessionTtlMs).toISOString(),
        }, { 'Set-Cookie': cookie(token) });
      }
      if (req.method === 'POST' && pathname === '/auth/logout') {
        const session = current(req);
        repository.revoke(parseCookies(req.headers.cookie)[COOKIE_NAME]);
        const content = { logoutMode: session?.record.authMethod === 'cas' ? 'cas' : 'local', logoutUrl: null };
        if (content.logoutMode === 'cas') {
          const logout = new URL(`${config.casBaseUrl}/logout`);
          logout.searchParams.set('service', config.serviceUrl);
          content.logoutUrl = logout.toString();
        }
        return ok(res, content, { 'Set-Cookie': clearCookie() });
      }
      if (req.method === 'GET' && pathname === '/auth/health') {
        const session = current(req);
        if (!session || !session.user.roles.includes('PLATFORM_ADMIN')) throw new AuthError('PERMISSION_DENIED', '无权查看认证服务状态', 403);
        return ok(res, { status: 'ok', casConfigured: true, repository: repository.constructor.name });
      }
      if (req.method === 'GET' && pathname === '/auth/users') {
        const session = current(req);
        if (!session) throw new AuthError('AUTH_REQUIRED', '请登录后继续', 401);
        if (!session.user.roles.includes('PLATFORM_ADMIN')) throw new AuthError('PERMISSION_DENIED', '无平台管理权限', 403);
        const query = String(url.searchParams.get('q') || '').trim().toLowerCase();
        const status = String(url.searchParams.get('status') || '');
        const role = String(url.searchParams.get('role') || '');
        const paged = ['q', 'status', 'role', 'page', 'pageSize'].some(key => url.searchParams.has(key));
        const allUsers = repository.listUsers().filter(user => {
          const matchesQuery = !query || [user.displayName, user.loginName, user.id].some(value => String(value || '').toLowerCase().includes(query));
          const matchesStatus = !status || (status === 'active' ? user.enabled !== false : user.enabled === false);
          const matchesRole = !role || (Array.isArray(user.roles) && user.roles.includes(role));
          return matchesQuery && matchesStatus && matchesRole;
        });
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 50));
        const totalPages = Math.max(1, Math.ceil(allUsers.length / pageSize));
        const page = Math.min(totalPages, Math.max(1, Number(url.searchParams.get('page')) || 1));
        const selectedUsers = paged ? allUsers.slice((page - 1) * pageSize, page * pageSize) : allUsers;
        const users = selectedUsers.map(user => ({
          id: user.id,
          loginName: user.loginName,
          displayName: user.displayName,
          identitySource: user.identitySource,
          enabled: user.enabled,
          roles: Array.isArray(user.roles) ? user.roles : [],
          updatedAt: user.updatedAt,
        }));
        return ok(res, { users, assignableRoles: ASSIGNABLE_ROLES, ...(paged ? { pagination: { page, pageSize, total: allUsers.length, totalPages } } : {}) });
      }
      const roleMatch = pathname.match(/^\/auth\/users\/([^/]+)\/roles$/);
      if (req.method === 'PATCH' && roleMatch) {
        const session = current(req);
        if (!session) throw new AuthError('AUTH_REQUIRED', '请登录后继续', 401);
        if (!session.user.roles.includes('PLATFORM_ADMIN')) throw new AuthError('PERMISSION_DENIED', '无平台管理权限', 403);
        const body = await readBody(req);
        const user = repository.updateUserRoles(decodeURIComponent(roleMatch[1]), body.roles, session.user.id);
        return ok(res, { user: userProjection(user) });
      }
      if (req.method === 'GET' && ['/api/business/probe', '/business/probe', '/knowledge-center/api/business/probe'].includes(pathname)) {
        const session = current(req);
        if (!session) throw new AuthError('AUTH_REQUIRED', '请登录后继续', 401);
        return ok(res, { allowed: true, principal: userProjection(session.user) });
      }
      if (req.method === 'GET' && ['/api/admin/probe', '/admin/probe', '/knowledge-center/api/admin/probe'].includes(pathname)) {
        const session = current(req);
        if (!session) throw new AuthError('AUTH_REQUIRED', '请登录后继续', 401);
        if (!session.user.roles.includes('PLATFORM_ADMIN')) throw new AuthError('PERMISSION_DENIED', '无平台管理权限', 403);
        return ok(res, { allowed: true, principal: userProjection(session.user) });
      }
      throw new AuthError('NOT_FOUND', '认证接口不存在', 404);
    } catch (error) {
      fail(res, error);
    }
  }

  return { handler, repository, config };
}

module.exports = {
  AuthError,
  BUSINESS_ACTIONS,
  BUSINESS_MODULES,
  ASSIGNABLE_ROLES,
  ROLE_DEFINITIONS,
  FileAuthRepository,
  MemoryAuthRepository,
  DatabaseAuthRepository,
  createKnowledgeCenterAuthService,
  userProjection,
};
