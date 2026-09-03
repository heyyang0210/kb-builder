const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class AggregateStoreError extends Error {
  constructor(code, message, status = 500, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
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
    this.baseUrl = new URL(options.baseUrl || process.env.YASDB_STORAGE_URL || 'http://127.0.0.1:14210');
    this.timeoutSeconds = Math.max(1, Math.ceil(Number(options.timeoutMs || process.env.YASDB_STORAGE_TIMEOUT_MS || 15000) / 1000));
    this.curl = options.curl || process.env.KNOWLEDGE_STORAGE_CURL || '/usr/bin/curl';
  }

  recordUrl() {
    return new URL(`/v1/records/${encodeURIComponent(this.namespace)}/${encodeURIComponent(this.key)}`, this.baseUrl).toString();
  }

  execute(args, payload) {
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
        throw new AggregateStoreError(parsed.error?.code || 'STORAGE_REQUEST_FAILED', parsed.error?.message || '存储服务请求失败', parsed.error?.code === 'REVISION_CONFLICT' ? 409 : 503, parsed.error?.details);
      }
      return parsed;
    } catch (error) {
      if (error instanceof AggregateStoreError) throw error;
      const stdout = String(error.stdout || '').trim();
      let response;
      try { response = JSON.parse(stdout); } catch (_) { response = null; }
      throw new AggregateStoreError(
        response?.error?.code || 'STORAGE_UNAVAILABLE',
        response?.error?.message || 'YashanDB 存储服务不可用',
        response?.error?.code === 'REVISION_CONFLICT' ? 409 : 503,
        response?.error?.details,
      );
    }
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
    return this.execute([
      '-sS', '--max-time', String(this.timeoutSeconds), '-X', 'PUT',
      '-H', 'Content-Type: application/json; charset=utf-8',
      '-H', `If-Match: ${revision}`,
      '--data-binary', '@-', this.recordUrl(),
    ], JSON.stringify(payload));
  }

  write(payload) {
    const current = this.readRecord();
    this.writeAtRevision(payload, current.revision);
    return payload;
  }

  transaction(mutator, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt += 1) {
      const current = this.readRecord();
      const state = structuredClone(current.payload);
      const result = mutator(state);
      try {
        this.writeAtRevision(state, current.revision);
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
