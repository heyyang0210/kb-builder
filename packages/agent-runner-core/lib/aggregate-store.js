const { execFileSync, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadDatabaseConfig } = require('./database-config');
let logger;
try { logger = require('./logger'); } catch (_) { logger = { info() {} }; }

function perfTrace(message, meta) {
  if (process.env.PERF_TRACE === '1') logger.info(`[perf] ${message}`, meta);
}

class AggregateStoreError extends Error {
  constructor(code, message, status = 500, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function storageErrorStatus(code) {
  return ['REVISION_CONFLICT', 'OUTLINE_DELETED', 'OUTLINE_NOT_FOUND'].includes(code) ? 409 : 503;
}

function storageMode() {
  const mode = String(process.env.KNOWLEDGE_STORAGE_MODE || 'file').trim().toLowerCase();
  if (!['file', 'database'].includes(mode)) throw new AggregateStoreError('STORAGE_MODE_INVALID', `不支持的存储模式：${mode}`);
  return mode;
}

class FileAggregateStore {
  constructor(filePath, emptyValue) {
    this.filePath = filePath;
    this.emptyValue = emptyValue;
  }

  read() {
    if (!fs.existsSync(this.filePath)) return structuredClone(this.emptyValue);
    return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
  }

  async readAsync() { return this.read(); }

  write(payload) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
      fs.renameSync(temporary, this.filePath);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
    return payload;
  }

  transaction(mutator) {
    const state = this.read();
    const result = mutator(state);
    this.write(state);
    return result;
  }
}

class DatabaseAggregateStore {
  constructor(namespace, key, emptyValue, options = {}) {
    this.namespace = namespace;
    this.key = key;
    this.emptyValue = emptyValue;
    const config = loadDatabaseConfig();
    this.baseUrl = new URL(options.baseUrl || config.storage?.url || 'http://127.0.0.1:14210');
    this.timeoutSeconds = Math.max(1, Math.ceil(Number(options.timeoutMs || config.storage?.timeoutMs || 15000) / 1000));
    this.curl = options.curl || process.env.KNOWLEDGE_STORAGE_CURL || (process.platform === 'win32' ? 'curl.exe' : '/usr/bin/curl');
  }

  recordUrl() {
    return new URL(`/v1/records/${encodeURIComponent(this.namespace)}/${encodeURIComponent(this.key)}`, this.baseUrl).toString();
  }

  execute(args, payload) {
    const startedAt = process.hrtime.bigint();
    const method = args.includes('-X') ? args[args.indexOf('-X') + 1] : 'GET';
    try {
      const output = execFileSync(this.curl, args, {
        input: payload,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        timeout: this.timeoutSeconds * 1000 + 1000,
        env: { ...process.env, LD_LIBRARY_PATH: '' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const parsed = JSON.parse(output || '{}');
      if (parsed && parsed.success === false) {
        throw new AggregateStoreError(parsed.error?.code || 'STORAGE_REQUEST_FAILED', parsed.error?.message || '存储服务请求失败', storageErrorStatus(parsed.error?.code), parsed.error?.details);
      }
      perfTrace('storage request', { namespace: this.namespace, key: this.key, method, durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6 });
      return parsed;
    } catch (error) {
      perfTrace('storage request failed', { namespace: this.namespace, key: this.key, method, durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6, code: error.code || 'unknown' });
      if (error instanceof AggregateStoreError) throw error;
      const stdout = String(error.stdout || '').trim();
      let response;
      try { response = JSON.parse(stdout); } catch (_) { response = null; }
      throw new AggregateStoreError(
        response?.error?.code || 'STORAGE_UNAVAILABLE',
        response?.error?.message || 'YashanDB 存储服务不可用',
        storageErrorStatus(response?.error?.code),
        response?.error?.details,
      );
    }
  }

  executeAsync(args, payload) {
    const startedAt = process.hrtime.bigint();
    return new Promise((resolve, reject) => {
      const child = execFile(this.curl, args, {
      input: payload, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
      timeout: this.timeoutSeconds * 1000 + 1000,
      env: { ...process.env, LD_LIBRARY_PATH: '' },
      }, (error, stdout) => {
      if (error) {
        perfTrace('storage async request failed', { namespace: this.namespace, key: this.key, durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6, code: error.code || 'unknown' });
        return reject(new AggregateStoreError('STORAGE_UNAVAILABLE', 'YashanDB 存储服务不可用', 503));
      }
      try {
        const parsed = JSON.parse(stdout || '{}');
        if (parsed?.success === false) throw new AggregateStoreError(parsed.error?.code || 'STORAGE_REQUEST_FAILED', parsed.error?.message || '存储服务请求失败', storageErrorStatus(parsed.error?.code), parsed.error?.details);
        perfTrace('storage async request', { namespace: this.namespace, key: this.key, durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6 });
        resolve(parsed);
      } catch (parseError) { reject(parseError); }
      });
      // Node's execFile does not consume an `input` option; write explicitly for PUT requests.
      if (payload && child.stdin) { child.stdin.write(payload); child.stdin.end(); }
    });
  }

  async readDraftAsync(contextKey) {
    const url = new URL(this.recordUrl());
    url.searchParams.set('draftKey', contextKey);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(this.timeoutSeconds * 1000) });
      const record = await response.json();
      if (!response.ok || record?.success === false) {
        throw new AggregateStoreError(record?.error?.code || 'STORAGE_REQUEST_FAILED', record?.error?.message || '读取共享草稿失败', 503);
      }
      // Older storage services ignore draftKey and return the aggregate envelope.
      // Select the requested draft until those services support the projection.
      if (record.payload && Object.hasOwn(record.payload, 'drafts')) {
        return record.payload.drafts?.[contextKey] || null;
      }
      return record.payload;
    } catch (error) {
      if (error instanceof AggregateStoreError) throw error;
      throw new AggregateStoreError('STORAGE_UNAVAILABLE', 'YashanDB 存储服务不可用', 503);
    }
  }

  async readAsync() {
    return (await this.readRecordAsync()).payload;
  }

  async readRecordAsync() {
    if (!this.readInFlight) {
      const pending = this.fetchSnapshot();
      this.readInFlight = pending;
      pending.finally(() => { if (this.readInFlight === pending) this.readInFlight = null; }).catch(() => {});
    }
    return structuredClone(await this.readInFlight);
  }

  async fetchSnapshot() {
    const epoch = this.writeEpoch || 0;
    const cached = this.readSnapshot;
    try {
      const response = await fetch(this.recordUrl(), {
        headers: cached?.etag ? { 'If-None-Match': cached.etag } : {},
        signal: AbortSignal.timeout(this.timeoutSeconds * 1000),
      });
      if (response.status === 304 && cached) return { payload: cached.payload, revision: cached.revision };
      const record = await response.json();
      if (!response.ok || record?.success === false) {
        if (epoch === (this.writeEpoch || 0)) this.readSnapshot = null;
        if (record?.error?.code === 'RECORD_NOT_FOUND') return { payload: structuredClone(this.emptyValue), revision: 0 };
        throw new AggregateStoreError(record?.error?.code || 'STORAGE_REQUEST_FAILED', record?.error?.message || '存储服务请求失败', storageErrorStatus(record?.error?.code), record?.error?.details);
      }
      const payload = record.deleted ? structuredClone(this.emptyValue) : record.payload;
      const revision = Number(record.revision || 0);
      if (epoch === (this.writeEpoch || 0)) this.readSnapshot = { etag: response.headers.get('etag'), revision, payload: structuredClone(payload) };
      return { payload, revision };
    } catch (error) {
      if (epoch === (this.writeEpoch || 0)) this.readSnapshot = null;
      if (error instanceof AggregateStoreError) throw error;
      throw new AggregateStoreError('STORAGE_UNAVAILABLE', 'YashanDB 存储服务不可用', 503);
    }
  }

  async writeAtRevisionAsync(payload, revision) {
    let response;
    try {
      response = await fetch(this.recordUrl(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'If-Match': String(revision) },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutSeconds * 1000),
      });
      const result = await response.json();
      if (!response.ok || result?.success === false) {
        const error = new AggregateStoreError(result?.error?.code || 'STORAGE_REQUEST_FAILED', result?.error?.message || '存储服务请求失败', storageErrorStatus(result?.error?.code), result?.error?.details);
        if (error.code === 'REVISION_CONFLICT') this.readSnapshot = null;
        throw error;
      }
      this.writeEpoch = (this.writeEpoch || 0) + 1;
      this.readSnapshot = { etag: `"${result.revision}"`, revision: Number(result.revision), payload: structuredClone(payload) };
      this.readInFlight = null;
      return result;
    } catch (error) {
      this.readSnapshot = null;
      if (error instanceof AggregateStoreError) throw error;
      throw new AggregateStoreError('STORAGE_UNAVAILABLE', 'YashanDB 存储服务不可用', 503);
    }
  }

  async transactionAsync(mutator, retries = 3) {
    const startedAt = process.hrtime.bigint();
    for (let attempt = 0; attempt < retries; attempt += 1) {
      const current = await this.readRecordAsync();
      const state = structuredClone(current.payload);
      const result = await mutator(state);
      try {
        await this.writeAtRevisionAsync(state, current.revision);
        perfTrace('storage async transaction', { namespace: this.namespace, key: this.key, attempts: attempt + 1, durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6 });
        return result;
      } catch (error) {
        if (error.code !== 'REVISION_CONFLICT' || attempt === retries - 1) throw error;
      }
    }
    throw new AggregateStoreError('REVISION_CONFLICT', '数据库记录并发更新冲突', 409);
  }

  readRecord() {
    try {
      const record = this.execute(['-sS', '--max-time', String(this.timeoutSeconds), this.recordUrl()]);
      if (record.deleted) return { payload: structuredClone(this.emptyValue), revision: record.revision };
      return { payload: record.payload, revision: record.revision };
    } catch (error) {
      if (error.code === 'RECORD_NOT_FOUND') return { payload: structuredClone(this.emptyValue), revision: 0 };
      throw error;
    }
  }

  read() {
    return this.readRecord().payload;
  }

  writeAtRevision(payload, revision) {
    const result = this.execute([
      '-sS', '--max-time', String(this.timeoutSeconds), '-X', 'PUT',
      '-H', 'Content-Type: application/json; charset=utf-8',
      '-H', `If-Match: ${revision}`,
      '--data-binary', '@-', this.recordUrl(),
    ], JSON.stringify(payload));
    this.writeEpoch = (this.writeEpoch || 0) + 1;
    this.readSnapshot = null;
    this.readInFlight = null;
    return result;
  }

  write(payload) {
    const current = this.readRecord();
    this.writeAtRevision(payload, current.revision);
    return payload;
  }

  transaction(mutator, retries = 3) {
    const startedAt = process.hrtime.bigint();
    for (let attempt = 0; attempt < retries; attempt += 1) {
      const current = this.readRecord();
      const state = structuredClone(current.payload);
      const result = mutator(state);
      try {
        this.writeAtRevision(state, current.revision);
        perfTrace('storage transaction', { namespace: this.namespace, key: this.key, attempts: attempt + 1, durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6 });
        return result;
      } catch (error) {
        if (error.code !== 'REVISION_CONFLICT' || attempt === retries - 1) throw error;
      }
    }
    throw new AggregateStoreError('REVISION_CONFLICT', '数据库记录并发更新冲突', 409);
  }
}

class DatabaseIncrementalStore extends DatabaseAggregateStore {
  constructor(key = 'state', options = {}) {
    super('incremental', key, { schemaVersion: 1, tasks: [], publishedVersions: [], idempotency: {}, audits: [] }, options);
  }
}

function createAggregateStore({ namespace, key, filePath, emptyValue, mode = storageMode() }) {
  return mode === 'database'
    ? new DatabaseAggregateStore(namespace, key, emptyValue)
    : new FileAggregateStore(filePath, emptyValue);
}

module.exports = {
  AggregateStoreError,
  DatabaseAggregateStore,
  DatabaseIncrementalStore,
  FileAggregateStore,
  createAggregateStore,
  storageMode,
};
