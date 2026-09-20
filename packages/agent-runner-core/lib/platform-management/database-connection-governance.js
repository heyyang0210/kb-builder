const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const EXAMPLE_URL = 'jdbc:yasdb://db.example.internal:1688/yashandb';
const MASK = '••••••••';

function governanceError(code, message, status = 500) {
  return Object.assign(new Error(message), { code, status });
}

function emptyState() {
  return { schemaVersion: 1, version: 0, effectiveVersion: 0, effective: null, pending: null };
}

function parseJdbcUrl(url) {
  const value = String(url || '').trim();
  if (/[?&](?:password|passwd|pwd)=/i.test(value)) {
    throw governanceError('DATABASE_JDBC_PASSWORD_FORBIDDEN', '请在密码字段单独填写数据库密码', 422);
  }
  const match = value.match(/^jdbc:yasdb:\/\/([^/:?#]+):(\d+)\/([^/?#]+)(?:\?.*)?$/i);
  if (!match) throw governanceError('DATABASE_JDBC_URL_INVALID', '数据库连接串格式无效，应为 jdbc:yasdb://地址:端口/数据库名', 422);
  const port = Number(match[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw governanceError('DATABASE_PORT_INVALID', '数据库端口必须为 1-65535', 422);
  return { jdbcUrl: value, host: match[1], port, database: match[3] };
}

function normalizeConnection(input = {}, fallback = {}) {
  const jdbcUrl = String(input.jdbcUrl || fallback.jdbcUrl || '').trim();
  if (!jdbcUrl) throw governanceError('DATABASE_JDBC_URL_REQUIRED', 'JDBC 连接串不能为空', 422);
  const parsed = parseJdbcUrl(jdbcUrl);
  const username = String(input.username ?? fallback.username ?? '').trim();
  if (!username) throw governanceError('DATABASE_USERNAME_REQUIRED', '数据库用户名不能为空', 422);
  const timeoutMs = Math.min(30000, Math.max(1000, Number(input.timeoutMs ?? fallback.timeoutMs) || 5000));
  return {
    name: String(input.name ?? fallback.name ?? '知识中心主数据库').trim() || '知识中心主数据库',
    ...parsed,
    username, timeoutMs,
  };
}

function redact(value) {
  if (!value?.jdbcUrl) return null;
  const parsed = parseJdbcUrl(value.jdbcUrl);
  return {
    ...parsed,
    name: value.name || '知识中心主数据库',
    username: value.username || '',
    timeoutMs: Number(value.timeoutMs) || 5000,
    passwordConfigured: Boolean(value.passwordConfigured),
    passwordMasked: value.passwordConfigured ? MASK : '',
  };
}

function encryptSecret(secret, keySource) {
  if (!secret) return null;
  if (!keySource) throw governanceError('DATABASE_SECRET_KEY_REQUIRED', '数据库密码加密密钥未配置，暂不能保存密码', 503);
  const key = crypto.createHash('sha256').update(String(keySource)).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  return { algorithm: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
}

function decryptSecret(record, keySource) {
  if (!record?.ciphertext) return '';
  if (!keySource) throw governanceError('DATABASE_SECRET_KEY_REQUIRED', '数据库密码加密密钥未配置', 503);
  try {
    const key = crypto.createHash('sha256').update(String(keySource)).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(record.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  } catch (_) {
    throw governanceError('DATABASE_SECRET_DECRYPT_FAILED', '数据库密码无法解密，请重新输入密码', 503);
  }
}

function createJavaProbe(options = {}) {
  const repositoryRoot = options.repositoryRoot || path.resolve(__dirname, '../../../..');
  const buildRoot = path.resolve(repositoryRoot, process.env.KNOWLEDGE_CENTER_BUILD_ROOT || 'runtime/build/knowledge-center');
  const resolveFromRepository = (value, fallback) => {
    const selected = value || fallback;
    return path.isAbsolute(selected) ? selected : path.resolve(repositoryRoot, selected);
  };
  const jdbcJar = resolveFromRepository(options.jdbcJar || process.env.YASDB_JDBC_JAR, path.join(buildRoot, 'current/java/lib/yashandb-jdbc.jar'));
  const classesDir = resolveFromRepository(options.classesDir || process.env.YASDB_STORAGE_CLASSES_DIR, path.join(buildRoot, 'current/java/classes'));
  const javaBin = options.javaBin || process.env.JAVA_BIN || 'java';
  return connection => new Promise((resolve, reject) => {
    if (!fs.existsSync(jdbcJar) || !fs.existsSync(path.join(classesDir, 'Main.class'))) {
      reject(governanceError('DATABASE_PROBE_UNAVAILABLE', '数据库连接验证组件尚未构建', 503));
      return;
    }
    const started = Date.now();
    execFile(javaBin, ['-cp', `${jdbcJar}${path.delimiter}${classesDir}`, 'Main', 'probe'], {
      env: {
        ...process.env,
        YASDB_JDBC_URL: connection.jdbcUrl,
        YASDB_USERNAME: connection.username,
        YASDB_PASSWORD: connection.password,
        YASDB_PROBE_QUERY_TIMEOUT_SECONDS: String(Math.max(1, Math.ceil(connection.timeoutMs / 1000))),
      },
      timeout: connection.timeoutMs + 2000,
      maxBuffer: 64 * 1024,
    }, (error) => {
      if (!error) {
        resolve({ status: 'success', message: '数据库连接可用', verifiedAt: new Date().toISOString(), latencyMs: Date.now() - started });
        return;
      }
      const detail = `${error.message || ''}\n${error.stderr || ''}`.toLowerCase();
      if (error.killed || error.signal || /timeout|超时/.test(detail)) reject(governanceError('DATABASE_CONNECTION_TIMEOUT', '数据库连接超时', 503));
      else if (/password|credential|authentication|login|认证|密码/.test(detail)) reject(governanceError('DATABASE_AUTHENTICATION_FAILED', '数据库认证失败，请检查用户名和密码', 422));
      else reject(governanceError('DATABASE_CONNECTION_UNAVAILABLE', '无法建立并验证数据库连接', 503));
    });
  });
}

function createDatabaseConnectionGovernance(options = {}) {
  const filePath = options.filePath || path.join(process.cwd(), 'runtime', 'knowledge-center', 'database-connection-config.json');
  const env = options.env || process.env;
  const keySource = options.keySource || env.KNOWLEDGE_CENTER_DATABASE_CONFIG_KEY || env.KNOWLEDGE_CENTER_SESSION_SECRET;
  const probe = options.probe || createJavaProbe(options);
  let commitTail = Promise.resolve();

  function read() {
    try {
      return { ...emptyState(), ...JSON.parse(fs.readFileSync(filePath, 'utf8')) };
    } catch (error) {
      if (error.code === 'ENOENT') return emptyState();
      throw governanceError('DATABASE_CONFIG_READ_FAILED', '数据库配置无法读取，请检查文件内容和权限', 503);
    }
  }

  function write(data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    try {
      fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
      fs.renameSync(temporary, filePath);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }

  function withCommitLock(action) {
    const current = commitTail.then(action, action);
    commitTail = current.catch(() => {});
    return current;
  }

  function storedPassword(record) {
    return record?.passwordSecret ? decryptSecret(record.passwordSecret, keySource) : '';
  }

  function runtimeConnection(data) {
    const hasRuntimeEnvironment = Boolean(env.YASDB_JDBC_URL || env.YASDB_USERNAME || env.YASDB_PASSWORD);
    const declaredSource = env.KNOWLEDGE_CENTER_DATABASE_CONFIG_SOURCE;
    if (hasRuntimeEnvironment) {
      const fallback = data.effective || {};
      const normalized = normalizeConnection({
        ...fallback,
        jdbcUrl: env.YASDB_JDBC_URL || fallback.jdbcUrl,
        username: env.YASDB_USERNAME || fallback.username,
      }, fallback);
      return {
        ...normalized,
        password: env.YASDB_PASSWORD || storedPassword(data.effective),
        source: declaredSource === 'platform' ? 'platform' : 'environment',
      };
    }
    if (!data.effective?.jdbcUrl) return null;
    return { ...normalizeConnection(data.effective, data.effective), password: storedPassword(data.effective), source: 'platform' };
  }

  function candidateRecord(data) {
    return data.pending?.jdbcUrl ? data.pending : (runtimeConnection(data) || data.effective);
  }

  function projection() {
    const data = read();
    const runtime = runtimeConnection(data);
    const candidate = candidateRecord(data);
    const restartRequired = Boolean(data.pending && Number(data.pending.version) > Number(data.effectiveVersion || 0));
    const passwordConfigured = Boolean(candidate?.passwordSecret || runtime?.password);
    const connection = candidate ? redact({ ...candidate, passwordConfigured }) : null;
    const effectiveConnection = runtime ? redact({ ...runtime, passwordConfigured: Boolean(runtime.password) }) : null;
    const status = restartRequired && runtime?.source === 'environment'
      ? 'overridden'
      : restartRequired
        ? 'pending_restart'
      : runtime && data.effectiveVerification?.status === 'success'
        ? 'connected'
        : candidate ? 'configured' : 'unconfigured';
    return {
      status,
      configured: Boolean(candidate),
      effectiveSource: runtime?.source || (candidate ? 'platform' : 'unconfigured'),
      environmentOverride: runtime?.source === 'environment',
      connection,
      effectiveConnection,
      lastVerification: restartRequired ? data.pendingVerification || null : data.effectiveVerification || data.lastVerification || null,
      restartRequired,
      rowVersion: Number(data.version || 0),
      effectiveVersion: Number(data.effectiveVersion || 0),
      pendingVersion: data.pending?.version || null,
    };
  }

  function passwordFor(input, data) {
    const supplied = String(input.password || '');
    if (supplied) return supplied;
    const secret = data.pending?.passwordSecret || data.effective?.passwordSecret;
    if (secret) return decryptSecret(secret, keySource);
    if (env.YASDB_PASSWORD) return env.YASDB_PASSWORD;
    throw governanceError('DATABASE_PASSWORD_REQUIRED', '新建数据库配置时密码不能为空', 422);
  }

  async function test(input = {}) {
    const data = read();
    const fallback = candidateRecord(data) || {};
    const normalized = normalizeConnection(input, fallback);
    const password = passwordFor(input, data);
    return probe({ ...normalized, password });
  }

  async function save(input = {}, expectedVersion, context = {}) {
    const beforeProbe = read();
    const fallback = candidateRecord(beforeProbe) || {};
    const normalized = normalizeConnection(input, fallback);
    const retainedSecret = beforeProbe.pending?.passwordSecret || beforeProbe.effective?.passwordSecret;
    if (!String(input.password || '') && !retainedSecret) {
      throw governanceError('DATABASE_PASSWORD_REQUIRED', '新建数据库配置时密码不能为空', 422);
    }
    const password = String(input.password || '') || decryptSecret(retainedSecret, keySource);
    const verification = await probe({ ...normalized, password });
    return withCommitLock(() => {
      const data = read();
      if (expectedVersion == null || Number(expectedVersion) !== Number(data.version || 0)) {
        throw governanceError('DATABASE_CONFIG_CONFLICT', '数据库配置已被其他管理员更新，请刷新后重试', 409);
      }
      const nextVersion = Number(data.version || 0) + 1;
      const existingSecret = data.pending?.passwordSecret || data.effective?.passwordSecret || null;
      const passwordSecret = String(input.password || '') ? encryptSecret(password, keySource) : existingSecret;
      if (!passwordSecret) throw governanceError('DATABASE_PASSWORD_REQUIRED', '新建数据库配置时密码不能为空', 422);
      const pending = { version: nextVersion, ...normalized, passwordSecret, updatedAt: new Date().toISOString() };
      const audits = Array.isArray(data.audits) ? data.audits.slice(-99) : [];
      audits.push({ action: 'DATABASE_CONFIG_SAVED', actorId: String(context.actorId || 'unknown'), version: nextVersion, verifiedAt: verification.verifiedAt, updatedAt: pending.updatedAt });
      write({ ...data, version: nextVersion, pending, pendingVerification: verification, lastVerification: verification, audits });
      return projection();
    });
  }

  function startupConfig() {
    const data = read();
    const record = data.pending?.jdbcUrl ? data.pending : data.effective;
    if (!record?.jdbcUrl) return null;
    const normalized = normalizeConnection(record, record);
    const password = storedPassword(record);
    if (!password) throw governanceError('DATABASE_PASSWORD_REQUIRED', '数据库启动配置缺少密码', 503);
    return { ...normalized, password, version: Number(record.version || data.effectiveVersion || 0) };
  }

  function promoteStartupConfig(input = {}) {
    const version = Number(input.version);
    if (!Number.isInteger(version) || version <= 0) return projection();
    const data = read();
    const matchingPending = Number(data.pending?.version) === version ? data.pending : null;
    const normalized = normalizeConnection(input, matchingPending || data.effective || {});
    const password = String(input.password || '');
    if (!password) throw governanceError('DATABASE_PASSWORD_REQUIRED', '数据库启动配置缺少密码', 503);
    const effective = { version, ...normalized, passwordSecret: matchingPending?.passwordSecret || encryptSecret(password, keySource), activatedAt: new Date().toISOString() };
    const effectiveVerification = { status: 'success', message: '数据库连接已在当前运行实例生效', verifiedAt: new Date().toISOString() };
    write({
      ...data,
      effectiveVersion: version,
      effective,
      effectiveVerification,
      pending: matchingPending ? null : data.pending,
      pendingVerification: matchingPending ? null : data.pendingVerification,
    });
    return projection();
  }

  return { projection, test, save, startupConfig, promoteStartupConfig };
}

module.exports = { EXAMPLE_URL, createDatabaseConnectionGovernance, createJavaProbe, normalizeConnection, parseJdbcUrl };
