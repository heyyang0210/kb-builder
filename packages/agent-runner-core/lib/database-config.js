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

function readJson(file, required = false) {
  if (!fs.existsSync(file)) {
    if (required) throw new Error(`数据库配置文件不存在：${file}`);
    return {};
  }
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  assertNoSecrets(value);
  return value;
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
  const configRoot = options.configRoot || path.join(repositoryRoot, 'config', 'database');
  const example = readJson(path.join(configRoot, 'yashandb.example.json'), true);
  const local = readJson(path.join(configRoot, 'yashandb.local.json'));
  return merge(merge(example, local), envOverrides(options.env || process.env));
}

module.exports = { loadDatabaseConfig, assertNoSecrets };
