const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { DatabaseAggregateStore } = require('./aggregate-store');
let logger;
try { logger = require('./logger'); } catch (_) { logger = { info() {}, error() {} }; }

function perfTrace(message, meta) {
  if (process.env.PERF_TRACE === '1') logger.info(`[perf] ${message}`, meta);
}

const COOKIE_NAME = 'kc_session';
const BUSINESS_MODULES = ['dashboard', 'assets', 'outlines', 'production'];
const CLEANING_MODULES = ['cleaning'];
const TEMPLATE_MODULES = ['templates'];
const BUSINESS_ACTIONS = ['knowledge:read', 'knowledge:write', 'outline:read'];
const ADMIN_ACTIONS = [...BUSINESS_ACTIONS, 'outline:create', 'outline:delete', 'review:manage', 'publish:manage', 'platform:manage', 'template:read', 'template:edit', 'template:manage'];
const ASSIGNABLE_ROLES = ['KNOWLEDGE_EDITOR', 'OUTLINE_MANAGER', 'REVIEWER', 'TEMPLATE_EDITOR', 'PLATFORM_ADMIN', 'SUPER_ADMIN'];
const ROLE_DEFINITIONS = {
  KNOWLEDGE_EDITOR: { actions: ['knowledge:read', 'knowledge:write', 'outline:read'], modules: [...BUSINESS_MODULES, 'review'] },
  OUTLINE_MANAGER: { actions: ['knowledge:read', 'outline:read', 'outline:create', 'outline:delete'], modules: ['dashboard', 'assets', 'outlines'] },
  REVIEWER: { actions: ['knowledge:read', 'review:manage'], modules: ['dashboard', 'assets', 'outlines', 'review'] },
  TEMPLATE_EDITOR: { actions: ['knowledge:read', 'outline:read', 'template:read', 'template:edit', 'template:manage'], modules: ['dashboard', 'outlines', ...TEMPLATE_MODULES] },
  PLATFORM_ADMIN: { actions: ADMIN_ACTIONS, modules: [...BUSINESS_MODULES, ...CLEANING_MODULES, ...TEMPLATE_MODULES, 'review', 'platform'] },
  SUPER_ADMIN: { actions: [...ADMIN_ACTIONS, 'outline:purge', 'platform:super-admin'], modules: [...BUSINESS_MODULES, ...CLEANING_MODULES, ...TEMPLATE_MODULES, 'review', 'platform'] },
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

function fail(res, error, requestId) {
  const known = error instanceof AuthError;
  const status = known ? error.status : 503;
  const code = known ? error.code : 'AUTH_SERVICE_UNAVAILABLE';
  const message = known ? error.message : '认证服务暂时不可用，请稍后重试';
  if (!known) {
    logger.error('[认证模块] 请求处理异常', {
      requestId,
      errorCode: error?.code || 'UNKNOWN_ERROR',
      errorMessage: error?.message || String(error),
      stack: error?.stack,
    });
  }
  json(res, status, {
    success: false,
    error: {
      code,
      message,
      retryable: known ? error.retryable : true,
      ...(requestId ? { requestId } : {}),
    },
  }, requestId ? { 'X-Request-Id': requestId } : undefined);
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
        roles: ['PLATFORM_ADMIN', 'SUPER_ADMIN'],
        createdAt: now,
        updatedAt: now,
      };
      this.state.users.push(user);
      this.audit('ADMIN_INITIALIZED', user.id, 'success');
      this.save();
    } else if (!user.roles.includes('SUPER_ADMIN')) {
      user.roles = [...new Set([...user.roles, 'SUPER_ADMIN'])];
      user.updatedAt = new Date().toISOString();
      this.audit('SUPER_ADMIN_INITIALIZED', user.id, 'success');
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

  upsertCas(info, principalId = null) {
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
        principalId,
        createdAt: now,
        updatedAt: now,
      };
      this.state.users.push(user);
      this.audit('CAS_USER_CREATED', user.id, 'success');
    } else {
      user.displayName = first(info.cn) || user.displayName;
      user.email = first(info.mail) || user.email;
      user.employeeNo = first(info.employeeNumber) || user.employeeNo;
      if (principalId != null) user.principalId = principalId;
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

  sessionRecord(token) {
    if (!token) return null;
    const record = this.state.sessions.find(item => item.idHash === hash(token));
    if (!record || record.revokedAt || Date.parse(record.expiresAt) <= Date.now()) return null;
    return record;
  }

  session(token) {
    const record = this.sessionRecord(token);
    if (!record) return null;
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

class HybridAuthRepository {
  constructor(local, domainStore) { this.local = local; this.domainStore = domainStore; this.state = local.state; }
  ensureAdmin(...args) { return this.local.ensureAdmin(...args); }
  ensureBuiltinUser(...args) { return this.local.ensureBuiltinUser(...args); }
  findLocal(...args) { return this.local.findLocal(...args); }
  consumeTicket(...args) { return this.local.consumeTicket(...args); }
  createSession(...args) { return this.local.createSession(...args); }
  revoke(...args) { return this.local.revoke(...args); }
  audit(...args) { return this.local.audit(...args); }
  save(...args) { return this.local.save(...args); }
  async upsertCas(info, principalId, actor = 'system:cas') {
    const loginName = first(info.user) || first(info.uid);
    try {
      const principal = principalId != null ? { principalId } : await this.domainStore.syncCasPrincipal({ casLoginName: loginName, displayName: first(info.cn) || loginName, actor });
      if (!principal?.principalId) throw new AuthError('CAS_PRINCIPAL_NOT_FOUND', '统一认证账号无法绑定平台人员', 409);
      return await this.domainStore.upsertPlatformCasUserAsync({ principalId: principal.principalId, loginName, actor });
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('CAS_PRINCIPAL_SYNC_FAILED', '统一认证成功，但人员信息同步失败，请稍后重试', 503, true);
    }
  }
  async session(token) {
    const record = this.local.sessionRecord(token); if (!record) return null;
    if (record.authMethod !== 'cas') return this.local.session(token);
    let user;
    try { user = await this.domainStore.readPlatformAuthUserAsync(record.userId); }
    catch (_) { throw new AuthError('AUTH_SERVICE_UNAVAILABLE', '认证服务暂时不可用，请稍后重试', 503, true); }
    if (!user?.enabled) return null;
    return { record, user: { ...user, id: user.id || record.userId, identitySource: 'cas' } };
  }
  async listUsers() {
    const databaseUsers = await this.domainStore.readPlatformAuthUsersAsync();
    const localUsers = this.local.listUsers()
      .filter(user => user.identitySource === 'local')
      .map(user => ({ ...user, managementSource: 'local', rolesEditable: false }));
    return [...(databaseUsers.items || []), ...localUsers];
  }
  async updateUserRoles(id, roles, operatorId, rowVersion, idempotencyKey) {
    if (this.local.findUserById(id)?.identitySource === 'local') throw new AuthError('LOCAL_ACCOUNT_NOT_DATABASE_MANAGED', '本地账号角色不可通过数据库角色接口修改', 409);
    if (rowVersion == null || !Number.isInteger(rowVersion)) throw new AuthError('ROW_VERSION_REQUIRED', '角色修改必须携带 If-Match rowVersion', 428);
    if (!idempotencyKey) throw new AuthError('IDEMPOTENCY_KEY_REQUIRED', '角色修改必须携带 Idempotency-Key', 400);
    return this.domainStore.replacePlatformUserRolesAsync(id, roles, rowVersion, idempotencyKey, operatorId);
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
    principalId: user.principalId || null,
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
    environment: String(options.environment || 'development'),
    testRunId: options.testRunId ? String(options.testRunId) : null,
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
  const effectiveRepository = options.domainStore && !(repository instanceof MemoryAuthRepository) && !(repository instanceof DatabaseAuthRepository)
    ? new HybridAuthRepository(repository, options.domainStore) : repository;
  const principalDirectory = options.principalDirectory;
  effectiveRepository.ensureAdmin(config.adminUsername, config.adminPassword);
  effectiveRepository.ensureBuiltinUser(config.knowledgeEditorUsername, config.knowledgeEditorPassword, 'KNOWLEDGE_EDITOR');
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
  const current = async req => effectiveRepository.session(parseCookies(req.headers.cookie)[COOKIE_NAME]);
  const sessionProjection = async req => {
    const session = await current(req);
    if (!session) return null;
    const projection = userProjection(session.user);
    return {
      authenticated: true,
      authMethod: session.record.authMethod,
      user: projection,
      roles: projection.roles,
      visibleModules: projection.visibleModules,
      allowedActions: projection.allowedActions,
      principalId: projection.principalId,
      expiresAt: session.record.expiresAt,
    };
  };

  async function validateTicket(ticket) {
    if (!ticket || typeof ticket !== 'string' || ticket.length > 2048) throw new AuthError('CAS_TICKET_INVALID', '统一认证信息无效', 401);
    if (effectiveRepository.state?.consumedTickets?.some(item => item.hash === hash(ticket))) {
      throw new AuthError('CAS_TICKET_REPLAYED', '统一认证信息已使用，请重新登录', 401);
    }
    const endpoint = new URL(`${config.casBaseUrl}/serviceValidate`);
    endpoint.searchParams.set('service', config.serviceUrl);
    endpoint.searchParams.set('ticket', ticket);
    endpoint.searchParams.set('format', 'json');
    const info = validateCasResponse(await requestJson(endpoint, config.requestTimeoutMs, config.maxCasResponseBytes));
    effectiveRepository.consumeTicket(ticket);
    return info;
  }

  async function handler(req, res) {
    const requestId = String(req.headers['x-request-id'] || randomId(12));
    try {
      const url = new URL(req.url, 'http://auth.local');
      const pathname = url.pathname.replace(/^\/knowledge-center\/(?:api\/)?auth/, '/auth');
      if (req.method === 'GET' && pathname === '/auth/config') {
        const login = new URL(`${config.casBaseUrl}/login`);
        login.searchParams.set('service', config.serviceUrl);
        const content = {
          enabled: true, casEnabled: true, loginUrl: login.toString(), adminLoginEnabled: true,
          productName: '知识中心管理', environment: config.environment,
          ...(config.environment === 'test' && config.testRunId ? { testRunId: config.testRunId } : {}),
        };
        return json(res, 200, { success: true, content, ...content });
      }
      if (req.method === 'GET' && pathname === '/auth/session') {
        const projection = await sessionProjection(req);
        if (!projection) throw new AuthError('AUTH_REQUIRED', '请登录后继续', 401);
        return ok(res, projection);
      }
      if (req.method === 'POST' && pathname === '/auth/cas/callback') {
        const body = await readBody(req);
        if (body.service || body.serviceUrl) throw new AuthError('CAS_SERVICE_MISMATCH', 'CAS service 由服务端固定配置', 400);
        const info = await validateTicket(body.ticket);
        let principal = null;
        try {
          principal = principalDirectory?.upsertCas ? await principalDirectory.upsertCas(info) : null;
        } catch (error) {
          const bindingCodes = new Set([
            'CAS_LOGIN_NAME_CONFLICT', 'CAS_LOGIN_BIND_CONFLICT',
            'CAS_PRINCIPAL_NOT_FOUND', 'CAS_PRINCIPAL_AMBIGUOUS',
          ]);
          if (bindingCodes.has(error?.code)) {
            throw new AuthError(error.code, error.message || 'CAS 账号无法唯一绑定现有人员，请联系平台管理员', 409);
          }
          throw new AuthError('CAS_PRINCIPAL_SYNC_FAILED', '统一认证成功，但人员信息同步失败，请稍后重试', 503, true);
        }
        const user = await effectiveRepository.upsertCas(info, principal?.principalId || principal?.id || null);
        if (!user.enabled) throw new AuthError('USER_DISABLED', '当前账号无法访问平台', 403);
        const token = effectiveRepository.createSession({ ...user, id: user.id || user.userKey }, config.sessionTtlMs);
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
        const user = effectiveRepository.findLocal(String(body.username || ''));
        perfTrace('auth local user lookup', { durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6, found: Boolean(user) });
        if (!user || !user.enabled || !verifyPassword(String(body.password || ''), user.passwordHash)) {
          recent.push(Date.now());
          failedAdminAttempts.set(remote, recent);
          effectiveRepository.audit('ADMIN_LOGIN', user?.id || null, 'failed');
          effectiveRepository.save();
          throw new AuthError('ADMIN_CREDENTIALS_INVALID', '管理员账号或密码错误', 401);
        }
        failedAdminAttempts.delete(remote);
        effectiveRepository.audit('ADMIN_LOGIN', user.id, 'success');
        const token = effectiveRepository.createSession(user, config.sessionTtlMs);
        const projection = userProjection(user);
        perfTrace('auth login completed', { durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6, userId: user.id });
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
        const session = await current(req);
        effectiveRepository.revoke(parseCookies(req.headers.cookie)[COOKIE_NAME]);
        const content = { logoutMode: session?.record.authMethod === 'cas' ? 'cas' : 'local', logoutUrl: null };
        if (content.logoutMode === 'cas') {
          const logout = new URL(`${config.casBaseUrl}/logout`);
          logout.searchParams.set('service', config.serviceUrl);
          content.logoutUrl = logout.toString();
        }
        return ok(res, content, { 'Set-Cookie': clearCookie() });
      }
      if (req.method === 'GET' && pathname === '/auth/health') {
        const session = await current(req);
        if (!session || !session.user.roles.some(role => ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(role))) throw new AuthError('PERMISSION_DENIED', '无权查看认证服务状态', 403);
        return ok(res, { status: 'ok', casConfigured: true, repository: effectiveRepository.constructor.name });
      }
      if (req.method === 'GET' && pathname === '/auth/users') {
        const session = await current(req);
        if (!session) throw new AuthError('AUTH_REQUIRED', '请登录后继续', 401);
        if (!session.user.roles.some(role => ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(role))) throw new AuthError('PERMISSION_DENIED', '无平台管理权限', 403);
        const query = String(url.searchParams.get('q') || '').trim().toLowerCase();
        const status = String(url.searchParams.get('status') || '');
        const role = String(url.searchParams.get('role') || '');
        const paged = ['q', 'status', 'role', 'page', 'pageSize'].some(key => url.searchParams.has(key));
        const allUsers = (await effectiveRepository.listUsers()).filter(user => {
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
          rowVersion: user.rowVersion || null,
          managementSource: user.managementSource || (user.identitySource === 'cas' ? 'database' : 'local'),
          rolesEditable: user.rolesEditable !== false && user.identitySource === 'cas' && (!user.roles?.includes('SUPER_ADMIN') || session.user.roles.includes('SUPER_ADMIN')),
          updatedAt: user.updatedAt,
          principalId: user.principalId || null,
        }));
        return ok(res, { users, assignableRoles: ASSIGNABLE_ROLES.filter(role => role !== 'SUPER_ADMIN' || session.user.roles.includes('SUPER_ADMIN')), ...(paged ? { pagination: { page, pageSize, total: allUsers.length, totalPages } } : {}) });
      }
      const roleMatch = pathname.match(/^\/auth\/users\/([^/]+)\/roles$/);
      if (req.method === 'PATCH' && roleMatch) {
        const session = await current(req);
        if (!session) throw new AuthError('AUTH_REQUIRED', '请登录后继续', 401);
        if (!session.user.roles.some(role => ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(role))) throw new AuthError('PERMISSION_DENIED', '无平台管理权限', 403);
        const body = await readBody(req);
        const target = (await effectiveRepository.listUsers()).find(user => user.id === decodeURIComponent(roleMatch[1]));
        if (!session.user.roles.includes('SUPER_ADMIN') && (body.roles?.includes('SUPER_ADMIN') || target?.roles?.includes('SUPER_ADMIN'))) {
          throw new AuthError('SUPER_ADMIN_REQUIRED', '只有超级管理员可以授予、撤销或修改超级管理员角色', 403);
        }
        const user = await effectiveRepository.updateUserRoles(decodeURIComponent(roleMatch[1]), body.roles, session.user.id,
          req.headers['if-match'] == null ? null : Number(String(req.headers['if-match']).replace(/\"/g, '')),
          String(req.headers['idempotency-key'] || '').trim());
        return ok(res, { user: userProjection(user) });
      }
      if (req.method === 'GET' && ['/api/business/probe', '/business/probe', '/knowledge-center/api/business/probe'].includes(pathname)) {
        const session = await current(req);
        if (!session) throw new AuthError('AUTH_REQUIRED', '请登录后继续', 401);
        return ok(res, { allowed: true, principal: userProjection(session.user) });
      }
      if (req.method === 'GET' && ['/api/admin/probe', '/admin/probe', '/knowledge-center/api/admin/probe'].includes(pathname)) {
        const session = await current(req);
        if (!session) throw new AuthError('AUTH_REQUIRED', '请登录后继续', 401);
        if (!session.user.roles.some(role => ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(role))) throw new AuthError('PERMISSION_DENIED', '无平台管理权限', 403);
        return ok(res, { allowed: true, principal: userProjection(session.user) });
      }
      throw new AuthError('NOT_FOUND', '认证接口不存在', 404);
    } catch (error) {
      fail(res, error, requestId);
    }
  }

  return { handler, authorize: sessionProjection, repository: effectiveRepository, config };
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
  HybridAuthRepository,
  createKnowledgeCenterAuthService,
  userProjection,
};
