const crypto = require('crypto');
const { GitLabOAuthCredentialStore, GitLabOAuthStoreError } = require('./gitlab-oauth-store');

class GitLabOAuthError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

const pending = new Map();
const PENDING_TTL_MS = 8 * 60 * 60 * 1000;
const PENDING_LIMIT = 1000;
const refreshes = new Map();
const runtimeStates = new Map();
let credentialStore;

function store() {
  if (!credentialStore) credentialStore = new GitLabOAuthCredentialStore();
  return credentialStore;
}

function setCredentialStore(value) {
  credentialStore = value;
  refreshes.clear();
  runtimeStates.clear();
}

function config() {
  return {
    clientId: String(process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET || '').trim(),
    redirectUri: String(process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI || '').trim(),
    scopes: String(process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_SCOPES || 'read_api read_repository').trim(),
    devHttp: process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP === 'true',
    refreshWindowMs: Math.max(30_000, Number(process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_REFRESH_WINDOW_MS || 300_000)),
  };
}

function ensureConfigured() {
  const value = config();
  if (!value.clientId || !value.clientSecret || !value.redirectUri) throw new GitLabOAuthError('GITLAB_OAUTH_NOT_CONFIGURED', 'GitLab 账号连接尚未配置，请联系平台管理员', 503);
  let parsed; try { parsed = new URL(value.redirectUri); } catch (_error) { throw new GitLabOAuthError('GITLAB_OAUTH_CONFIG_INVALID', 'GitLab 账号连接回调地址格式不正确', 500); }
  if (parsed.protocol !== 'https:' && !(value.devHttp && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || /^192\.168\./.test(parsed.hostname)))) throw new GitLabOAuthError('GITLAB_OAUTH_HTTPS_REQUIRED', 'GitLab 账号连接正式回调必须使用 HTTPS', 500);
  return value;
}

function safeReturnTo(value, fallback = '/knowledge-center/?externalAccount=1') {
  const candidate = String(value || '');
  return candidate.startsWith('/knowledge-center/') && !candidate.startsWith('//') ? candidate : fallback;
}

function recordKey(userId, connectionId) { return `${String(userId)}\u0000${String(connectionId)}`; }

function prunePending(now = Date.now()) {
  for (const [key, value] of pending) if (value.expiresAt <= now) pending.delete(key);
  while (pending.size >= PENDING_LIMIT) pending.delete(pending.keys().next().value);
}

function start({ userId, connectionId, host, returnTo = '/knowledge-center/?externalAccount=1' }) {
  const value = ensureConfigured();
  if (!userId || !connectionId || !host) throw new GitLabOAuthError('GITLAB_OAUTH_SESSION_REQUIRED', '需要有效的知识中心登录会话', 401);
  const state = crypto.randomBytes(24).toString('base64url');
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  prunePending();
  pending.set(state, { userId: String(userId), connectionId: String(connectionId), host: host.replace(/\/$/, ''), verifier, returnTo: safeReturnTo(returnTo), expiresAt: Date.now() + PENDING_TTL_MS });
  const url = new URL(`${host.replace(/\/$/, '')}/oauth/authorize`);
  url.searchParams.set('client_id', value.clientId); url.searchParams.set('redirect_uri', value.redirectUri); url.searchParams.set('response_type', 'code'); url.searchParams.set('scope', value.scopes); url.searchParams.set('state', state); url.searchParams.set('code_challenge', challenge); url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

async function tokenRequest(host, body) {
  let response;
  try {
    response = await fetch(`${host}/oauth/token`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  } catch (_error) {
    throw new GitLabOAuthError('GITLAB_OAUTH_UNAVAILABLE', 'GitLab 暂时不可用，连接信息仍会保留', 502);
  }
  const result = await response.json().catch(() => ({}));
  return { response, body: result };
}

async function callback({ userId, code, state }) {
  const value = ensureConfigured();
  const record = pending.get(state);
  pending.delete(state);
  if (!record || record.expiresAt < Date.now() || record.userId !== String(userId)) throw new GitLabOAuthError('GITLAB_OAUTH_STATE_INVALID', 'GitLab 授权已失效，请重新连接', 401);
  if (!code) throw new GitLabOAuthError('GITLAB_OAUTH_CODE_MISSING', 'GitLab 未返回授权码', 400);
  const tokenBody = new URLSearchParams({ client_id: value.clientId, client_secret: value.clientSecret, code, grant_type: 'authorization_code', redirect_uri: value.redirectUri, code_verifier: record.verifier });
  const result = await tokenRequest(record.host, tokenBody);
  if (!result.response.ok || !result.body.access_token) throw new GitLabOAuthError('GITLAB_OAUTH_TOKEN_FAILED', 'GitLab 账号连接失败，请重试', result.response.status || 502);
  const now = new Date().toISOString();
  store().save({ userId: record.userId, connectionId: record.connectionId, host: record.host, accessToken: result.body.access_token, refreshToken: result.body.refresh_token || null, expiresAt: result.body.expires_in ? new Date(Date.now() + Number(result.body.expires_in) * 1000).toISOString() : null, updatedAt: now, lastUsedAt: now, state: 'connected' });
  runtimeStates.delete(recordKey(record.userId, record.connectionId));
  return { returnTo: record.returnTo, connectionId: record.connectionId };
}

async function refreshRecord(record, force = false) {
  const key = recordKey(record.userId, record.connectionId);
  if (refreshes.has(key)) return refreshes.get(key);
  const operation = (async () => {
    if (!record.refreshToken) {
      store().markState(record.userId, record.connectionId, 'reauthorization_required');
      runtimeStates.delete(key);
      return null;
    }
    const value = ensureConfigured();
    const body = new URLSearchParams({ client_id: value.clientId, client_secret: value.clientSecret, refresh_token: record.refreshToken, grant_type: 'refresh_token' });
    let result;
    try { result = await tokenRequest(record.host, body); }
    catch (error) {
      runtimeStates.set(key, { status: 'temporarily_unavailable', at: new Date().toISOString() });
      if (force) throw error;
      return null;
    }
    if (!result.response.ok || !result.body.access_token) {
      if ([400, 401].includes(result.response.status)) {
        store().markState(record.userId, record.connectionId, 'reauthorization_required');
        runtimeStates.delete(key);
        return null;
      }
      runtimeStates.set(key, { status: 'temporarily_unavailable', at: new Date().toISOString() });
      if (force) throw new GitLabOAuthError('GITLAB_OAUTH_UNAVAILABLE', 'GitLab 暂时不可用，连接信息仍会保留', 502);
      return null;
    }
    const now = new Date().toISOString();
    const updated = { ...record, accessToken: result.body.access_token, refreshToken: result.body.refresh_token || record.refreshToken, expiresAt: result.body.expires_in ? new Date(Date.now() + Number(result.body.expires_in) * 1000).toISOString() : null, updatedAt: now, lastUsedAt: now, state: 'connected' };
    store().save(updated);
    runtimeStates.delete(key);
    return updated.accessToken;
  })().finally(() => refreshes.delete(key));
  refreshes.set(key, operation);
  return operation;
}

async function tokenForUser(userId, connection, options = {}) {
  if (!userId || !connection?.id) return null;
  let record;
  try { record = store().get(userId, connection.id); }
  catch (error) {
    if (error instanceof GitLabOAuthStoreError) throw new GitLabOAuthError(error.code, error.message, error.status);
    throw error;
  }
  if (!record || record.host !== String(connection.host).replace(/\/$/, '') || record.state === 'reauthorization_required') return null;
  const expiresAt = record.expiresAt ? Date.parse(record.expiresAt) : null;
  if (options.forceRefresh || (expiresAt && expiresAt <= Date.now() + config().refreshWindowMs)) return refreshRecord(record, Boolean(options.forceRefresh));
  runtimeStates.delete(recordKey(userId, connection.id));
  return record.accessToken;
}

async function status(userId, connection) {
  if (!connection?.id) return { connected: false, status: 'disconnected', updatedAt: null, lastUsedAt: null };
  let record;
  try { record = store().get(userId, connection.id); }
  catch (error) {
    if (error instanceof GitLabOAuthStoreError) return { connected: false, status: 'reauthorization_required', updatedAt: null, lastUsedAt: null };
    throw error;
  }
  if (!record) return { connected: false, status: 'disconnected', updatedAt: null, lastUsedAt: null };
  if (record.state === 'reauthorization_required') return { connected: false, status: 'reauthorization_required', updatedAt: record.updatedAt, lastUsedAt: record.lastUsedAt };
  const runtime = runtimeStates.get(recordKey(userId, connection.id));
  if (runtime?.status === 'temporarily_unavailable') return { connected: true, status: 'temporarily_unavailable', updatedAt: record.updatedAt, lastUsedAt: record.lastUsedAt };
  const expiresAt = record.expiresAt ? Date.parse(record.expiresAt) : null;
  if (expiresAt && expiresAt <= Date.now() + config().refreshWindowMs) await tokenForUser(userId, connection).catch(() => null);
  const current = store().get(userId, connection.id);
  const currentRuntime = runtimeStates.get(recordKey(userId, connection.id));
  if (currentRuntime?.status === 'temporarily_unavailable') return { connected: true, status: 'temporarily_unavailable', updatedAt: current?.updatedAt, lastUsedAt: current?.lastUsedAt };
  return { connected: current?.state === 'connected', status: current?.state === 'reauthorization_required' ? 'reauthorization_required' : 'connected', updatedAt: current?.updatedAt || null, lastUsedAt: current?.lastUsedAt || null };
}

function disconnect(userId, connectionId) {
  if (!userId || !connectionId) return;
  store().remove(userId, connectionId);
  runtimeStates.delete(recordKey(userId, connectionId));
}

module.exports = { GitLabOAuthError, config, start, callback, tokenForUser, status, disconnect, setCredentialStore };
