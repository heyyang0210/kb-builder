const fs = require('fs');
const path = require('path');

const SECRET_KEYS = new Set(['password', 'token', 'secret', 'apiKey', 'api_key']);

function assertNoSecrets(value, location = 'config') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEYS.has(key) || /password|token|secret|api[_-]?key/i.test(key)) {
      throw new Error(`数据库配置禁止包含敏感字段：${location}.${key}`);
    }
    assertNoSecrets(child, `${location}.${key}`);
  }
}

function readDotenv(file, required = false) {
  if (!fs.existsSync(file)) {
    if (required) throw new Error(`数据库配置文件不存在：${file}`);
    return {};
  }
  const values = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) throw new Error(`数据库配置格式错误：${file}`);
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

function merge(base, override) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object') {
      result[key] = merge(result[key], value);
    } else if (value !== undefined && value !== '') {
      result[key] = value;
    }
  }
  return result;
}

function envOverrides(env) {
  const storage = {};
  const jdbc = {};
  const expImp = {};
  const assign = (target, key, envKey, transform = value => value) => {
    if (env[envKey] !== undefined && env[envKey] !== '') target[key] = transform(env[envKey]);
  };
  assign(jdbc, 'url', 'YASDB_JDBC_URL');
  assign(jdbc, 'username', 'YASDB_USERNAME');
  assign(jdbc, 'driverJar', 'YASDB_JDBC_JAR');
  assign(storage, 'url', 'YASDB_STORAGE_URL');
  assign(storage, 'host', 'YASDB_STORAGE_HOST');
  assign(storage, 'port', 'YASDB_STORAGE_PORT', Number);
  assign(storage, 'timeoutMs', 'YASDB_STORAGE_TIMEOUT_MS', Number);
  assign(storage, 'threads', 'YASDB_STORAGE_THREADS', Number);
  assign(storage, 'maxBodyBytes', 'YASDB_STORAGE_MAX_BODY_BYTES', Number);
  assign(storage, 'sqlDir', 'YASDB_STORAGE_SQL_DIR');
  assign(expImp, 'serverHost', 'YASDB_EXP_SERVER_HOST');
  assign(expImp, 'owner', 'YASDB_EXP_OWNER');
  assign(expImp, 'fromUser', 'YASDB_IMP_FROMUSER');
  assign(expImp, 'toUser', 'YASDB_IMP_TOUSER');
  assign(expImp, 'outputDir', 'YASDB_EXP_OUTPUT_DIR');
  assign(expImp, 'logDir', 'YASDB_EXP_LOG_DIR');
  assign(expImp, 'rows', 'YASDB_EXP_ROWS');
  assign(expImp, 'logLevel', 'YASDB_EXP_LOG_LEVEL');
  return { jdbc, storage, expImp };
}

function loadDatabaseConfig(options = {}) {
  const repositoryRoot = options.repositoryRoot || path.resolve(__dirname, '../../../');
  const configRoot = options.configRoot || path.join(repositoryRoot, 'config', 'yashandb');
  const fileEnv = readDotenv(path.join(configRoot, 'service.env'), true);
  const loaded = envOverrides({ ...fileEnv, ...(options.env || process.env) });
  return { version: 1, jdbc: loaded.jdbc, storage: loaded.storage, expImp: loaded.expImp };
}

module.exports = { loadDatabaseConfig, assertNoSecrets };
