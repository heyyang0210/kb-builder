const crypto = require('crypto');
const path = require('path');
const { createAggregateStore } = require('./aggregate-store');
const { AGENT_RUNNER_RUNTIME_ROOT } = require('./repo-paths');

const EMPTY_VALUE = { version: 1, accounts: [] };
const KEY_VERSION = 'v1';

class GitLabOAuthStoreError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function encryptionKey(env = process.env) {
  const developmentFallback = env.NODE_ENV !== 'production' ? env.KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET : '';
  const secret = String(env.KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY || env.AGENT_RUNNER_KEY || developmentFallback || '').trim();
  if (!secret) throw new GitLabOAuthStoreError('GITLAB_OAUTH_ENCRYPTION_KEY_REQUIRED', '个人 GitLab 账号安全存储尚未配置，请联系平台管理员', 503);
  return crypto.scryptSync(secret, 'knowledge-center-gitlab-oauth-v1', 32);
}

function encrypt(value, key) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [KEY_VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

function decrypt(value, key) {
  if (!value) return null;
  const [version, iv, tag, encrypted] = String(value).split('.');
  if (version !== KEY_VERSION || !iv || !tag || !encrypted) throw new GitLabOAuthStoreError('GITLAB_OAUTH_CREDENTIAL_INVALID', '个人 GitLab 账号授权数据无法读取，请重新连接', 409);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
  } catch (_error) {
    throw new GitLabOAuthStoreError('GITLAB_OAUTH_CREDENTIAL_INVALID', '个人 GitLab 账号授权数据无法读取，请重新连接', 409);
  }
}

function identity(userId, connectionId) {
  return `${String(userId)}\u0000${String(connectionId)}`;
}

class GitLabOAuthCredentialStore {
  constructor(options = {}) {
    this.aggregate = options.aggregate || createAggregateStore({
      namespace: 'gitlab-oauth',
      key: 'credentials',
      filePath: options.filePath || path.join(AGENT_RUNNER_RUNTIME_ROOT, '..', 'knowledge-center', 'gitlab-oauth-credentials.json'),
      emptyValue: EMPTY_VALUE,
      mode: options.mode,
    });
    this.env = options.env || process.env;
    this.cache = null;
  }

  load() {
    if (!this.cache) {
      const payload = this.aggregate.read();
      this.cache = new Map((payload.accounts || []).map(record => [identity(record.userId, record.connectionId), record]));
    }
    return this.cache;
  }

  get(userId, connectionId) {
    const stored = this.load().get(identity(userId, connectionId));
    if (!stored) return null;
    const key = encryptionKey(this.env);
    return {
      ...stored,
      accessToken: decrypt(stored.accessTokenEncrypted, key),
      refreshToken: decrypt(stored.refreshTokenEncrypted, key),
      accessTokenEncrypted: undefined,
      refreshTokenEncrypted: undefined,
    };
  }

  listForUser(userId) {
    return [...this.load().values()].filter(record => record.userId === String(userId)).map(record => ({
      userId: record.userId,
      connectionId: record.connectionId,
      host: record.host,
      accountName: record.accountName || null,
      expiresAt: record.expiresAt || null,
      updatedAt: record.updatedAt || null,
      lastUsedAt: record.lastUsedAt || null,
      state: record.state || 'connected',
    }));
  }

  save(record) {
    const key = encryptionKey(this.env);
    const stored = {
      version: 1,
      userId: String(record.userId),
      connectionId: String(record.connectionId),
      host: String(record.host).replace(/\/$/, ''),
      accountName: record.accountName || null,
      accessTokenEncrypted: encrypt(record.accessToken, key),
      refreshTokenEncrypted: encrypt(record.refreshToken, key),
      expiresAt: record.expiresAt || null,
      updatedAt: record.updatedAt || new Date().toISOString(),
      lastUsedAt: record.lastUsedAt || null,
      state: record.state || 'connected',
    };
    this.aggregate.transaction(payload => {
      if (!Array.isArray(payload.accounts)) payload.accounts = [];
      const index = payload.accounts.findIndex(item => identity(item.userId, item.connectionId) === identity(stored.userId, stored.connectionId));
      if (index >= 0) payload.accounts[index] = stored;
      else payload.accounts.push(stored);
    });
    this.load().set(identity(stored.userId, stored.connectionId), stored);
    return record;
  }

  markState(userId, connectionId, state) {
    const current = this.get(userId, connectionId);
    if (!current) return null;
    return this.save({ ...current, state, updatedAt: new Date().toISOString() });
  }

  remove(userId, connectionId) {
    this.aggregate.transaction(payload => {
      payload.accounts = (payload.accounts || []).filter(item => identity(item.userId, item.connectionId) !== identity(userId, connectionId));
    });
    this.load().delete(identity(userId, connectionId));
  }
}

module.exports = { GitLabOAuthCredentialStore, GitLabOAuthStoreError, encryptionKey };
