const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const EXAMPLE_URL = 'jdbc:yasdb://db.example.internal:1688/yashandb';
const MASK = '••••••••';

function governanceError(code, message, status = 500) {
  return Object.assign(new Error(message), { code, status });
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
  const filePath = options.filePath || path.join(process.cwd(), 'config', 'yashandb', 'service.env');
  const env = options.env || process.env;
  const probe = options.probe || createJavaProbe(options);
  let commitTail = Promise.resolve();

  function readText() {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return '';
      throw governanceError('DATABASE_CONFIG_READ_FAILED', '数据库配置无法读取，请检查文件内容和权限', 503);
    }
  }

  function parseEnv(text) {
    const values = {};
    for (const rawLine of String(text || '').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const match = line.match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        try {
          value = JSON.parse(value);
        } catch (_) {
          throw governanceError('DATABASE_CONFIG_READ_FAILED', '数据库配置无法读取，请检查文件内容和权限', 503);
        }
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      values[match[1]] = value;
    }
    return values;
  }

  function quoteEnv(value) {
    return JSON.stringify(String(value));
  }

  function updateEnv(text, updates) {
    const lines = String(text || '').split(/\r?\n/);
    const seen = new Set();
    const output = lines.map(line => {
      const match = line.match(/^(\s*(?:export\s+)?)(YASDB_JDBC_URL|YASDB_USERNAME|YASDB_PASSWORD)(\s*=).*/);
      if (!match) return line;
      seen.add(match[2]);
      return `${match[1]}${match[2]}${match[3]}${quoteEnv(updates[match[2]])}`;
    });
    for (const key of ['YASDB_JDBC_URL', 'YASDB_USERNAME', 'YASDB_PASSWORD']) {
      if (!seen.has(key)) output.push(`${key}=${quoteEnv(updates[key])}`);
    }
    return `${output.join('\n').replace(/\n+$/, '')}\n`;
  }

  function write(text) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    try {
      fs.writeFileSync(temporary, text, { mode: 0o600 });
      fs.chmodSync(temporary, 0o600);
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

  function fileConnection() {
    const values = parseEnv(readText());
    if (!values.YASDB_JDBC_URL || !values.YASDB_USERNAME) return null;
    return {
      ...normalizeConnection({ jdbcUrl: values.YASDB_JDBC_URL, username: values.YASDB_USERNAME }),
      password: values.YASDB_PASSWORD || '',
    };
  }

  function runtimeConnection() {
    if (env.YASDB_JDBC_URL && env.YASDB_USERNAME) {
      return {
        ...normalizeConnection({ jdbcUrl: env.YASDB_JDBC_URL, username: env.YASDB_USERNAME }),
        password: env.YASDB_PASSWORD || '',
        source: 'environment',
      };
    }
    const configured = fileConnection();
    return configured ? { ...configured, source: 'deployment' } : null;
  }

  function projection() {
    const configured = fileConnection();
    const runtime = runtimeConnection();
    const restartRequired = Boolean(configured && runtime?.source === 'environment'
      && (configured.jdbcUrl !== runtime.jdbcUrl || configured.username !== runtime.username || configured.password !== runtime.password));
    const connection = configured ? redact({ ...configured, passwordConfigured: Boolean(configured.password) }) : null;
    const effectiveConnection = runtime ? redact({ ...runtime, passwordConfigured: Boolean(runtime.password) }) : null;
    const status = restartRequired ? 'pending_restart' : configured ? 'configured' : 'unconfigured';
    const rowVersion = Number.parseInt(crypto.createHash('sha256').update(readText()).digest('hex').slice(0, 12), 16);
    return {
      status,
      configured: Boolean(configured),
      effectiveSource: runtime?.source || 'unconfigured',
      environmentOverride: restartRequired,
      connection,
      effectiveConnection,
      lastVerification: null,
      restartRequired,
      rowVersion,
      effectiveVersion: rowVersion,
      pendingVersion: null,
    };
  }

  function passwordFor(input) {
    const supplied = String(input.password || '');
    if (supplied) return supplied;
    const configured = fileConnection();
    if (configured?.password) return configured.password;
    if (env.YASDB_PASSWORD) return env.YASDB_PASSWORD;
    throw governanceError('DATABASE_PASSWORD_REQUIRED', '新建数据库配置时密码不能为空', 422);
  }

  async function test(input = {}) {
    const fallback = fileConnection() || {};
    const normalized = normalizeConnection(input, fallback);
    const password = passwordFor(input);
    return probe({ ...normalized, password });
  }

  async function save(input = {}, expectedVersion) {
    const fallback = fileConnection() || {};
    const normalized = normalizeConnection(input, fallback);
    if (!String(input.password || '') && !fallback.password && !env.YASDB_PASSWORD) {
      throw governanceError('DATABASE_PASSWORD_REQUIRED', '新建数据库配置时密码不能为空', 422);
    }
    const password = String(input.password || '') || fallback.password || env.YASDB_PASSWORD;
    const verification = await probe({ ...normalized, password });
    return withCommitLock(() => {
      if (expectedVersion == null || Number(expectedVersion) !== projection().rowVersion) {
        throw governanceError('DATABASE_CONFIG_CONFLICT', '数据库配置已被其他管理员更新，请刷新后重试', 409);
      }
      write(updateEnv(readText(), {
        YASDB_JDBC_URL: normalized.jdbcUrl,
        YASDB_USERNAME: normalized.username,
        YASDB_PASSWORD: password,
      }));
      const saved = projection();
      return {
        ...saved,
        status: saved.restartRequired ? saved.status : 'verified',
        lastVerification: verification,
      };
    });
  }

  function startupConfig() {
    const record = fileConnection();
    if (!record?.jdbcUrl) return null;
    if (!record.password) throw governanceError('DATABASE_PASSWORD_REQUIRED', '数据库启动配置缺少密码', 503);
    return { ...record, version: projection().rowVersion };
  }

  return { projection, test, save, startupConfig };
}

module.exports = { EXAMPLE_URL, createDatabaseConnectionGovernance, createJavaProbe, normalizeConnection, parseJdbcUrl };
