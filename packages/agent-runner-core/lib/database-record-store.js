const http = require('http');
const https = require('https');
const { loadDatabaseConfig } = require('./database-config');

class DatabaseRecordStoreError extends Error {
  constructor(code, message, status, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

class DatabaseRecordStore {
  constructor(options = {}) {
    const config = loadDatabaseConfig();
    this.baseUrl = new URL(options.baseUrl || config.storage?.url || 'http://127.0.0.1:14210');
    this.timeoutMs = Number(options.timeoutMs || config.storage?.timeoutMs || 15000);
  }

  async health() {
    return this.request('GET', '/health');
  }

  async read(namespace, key) {
    const result = await this.request('GET', this.recordPath(namespace, key));
    return { payload: result.payload, revision: result.revision, sha256: result.sha256, deleted: result.deleted, updatedAt: result.updatedAt };
  }

  async write(namespace, key, payload, revision) {
    const headers = {};
    if (revision !== undefined && revision !== null) headers['If-Match'] = String(revision);
    return this.request('PUT', this.recordPath(namespace, key), payload, headers);
  }

  async delete(namespace, key, revision) {
    return this.request('DELETE', this.recordPath(namespace, key), undefined, { 'If-Match': String(revision) });
  }

  async exportAll() {
    return this.request('GET', '/v1/export', undefined, {}, 0);
  }

  recordPath(namespace, key) {
    return `/v1/records/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`;
  }

  request(method, pathname, body, extraHeaders = {}, timeoutMs = this.timeoutMs) {
    const target = new URL(pathname, this.baseUrl);
    const transport = target.protocol === 'https:' ? https : http;
    const serialized = body === undefined ? null : JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const request = transport.request(target, {
        method,
        timeout: timeoutMs || undefined,
        headers: {
          Accept: 'application/json',
          ...(serialized === null ? {} : { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(serialized) }),
          ...extraHeaders,
        },
      }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
          catch (error) { reject(new DatabaseRecordStoreError('INVALID_STORAGE_RESPONSE', '存储服务返回了无效 JSON', response.statusCode)); return; }
          if (response.statusCode >= 200 && response.statusCode < 300) { resolve(parsed); return; }
          reject(new DatabaseRecordStoreError(parsed.error?.code || 'STORAGE_REQUEST_FAILED', parsed.error?.message || '存储服务请求失败', response.statusCode, parsed.error?.details));
        });
      });
      request.on('timeout', () => request.destroy(new DatabaseRecordStoreError('STORAGE_TIMEOUT', '存储服务请求超时', 503)));
      request.on('error', error => reject(error instanceof DatabaseRecordStoreError ? error : new DatabaseRecordStoreError('STORAGE_UNAVAILABLE', '存储服务不可用', 503, { cause: error.message })));
      if (serialized !== null) request.write(serialized);
      request.end();
    });
  }
}

module.exports = { DatabaseRecordStore, DatabaseRecordStoreError };
