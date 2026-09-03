const crypto = require('crypto');

class GitLabOAuthError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

const pending = new Map();
const tokens = new Map();

function config() {
  return {
    clientId: String(process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET || '').trim(),
    redirectUri: String(process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI || '').trim(),
    scopes: String(process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_SCOPES || 'read_api read_repository').trim(),
    devHttp: process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP === 'true',
  };
}

function ensureConfigured() {
  const value = config();
  if (!value.clientId || !value.clientSecret || !value.redirectUri) throw new GitLabOAuthError('GITLAB_OAUTH_NOT_CONFIGURED', 'GitLab OAuth 尚未配置，请联系平台管理员', 503);
  let parsed; try { parsed = new URL(value.redirectUri); } catch (_error) { throw new GitLabOAuthError('GITLAB_OAUTH_CONFIG_INVALID', 'GitLab OAuth 回调地址格式不正确', 500); }
  if (parsed.protocol !== 'https:' && !(value.devHttp && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || /^192\.168\./.test(parsed.hostname)))) throw new GitLabOAuthError('GITLAB_OAUTH_HTTPS_REQUIRED', 'GitLab OAuth 正式回调必须使用 HTTPS', 500);
  return value;
}

function start({ userId, connectionId, host, returnTo = '/knowledge-center/assets' }) {
  const value = ensureConfigured();
  if (!userId || !host) throw new GitLabOAuthError('GITLAB_OAUTH_SESSION_REQUIRED', '需要有效的知识中心登录会话', 401);
  const state = crypto.randomBytes(24).toString('base64url');
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  pending.set(state, { userId, connectionId, host: host.replace(/\/$/, ''), verifier, returnTo: returnTo.startsWith('/knowledge-center/') ? returnTo : '/knowledge-center/assets', expiresAt: Date.now() + 10 * 60 * 1000 });
  const url = new URL(`${host.replace(/\/$/, '')}/oauth/authorize`);
  url.searchParams.set('client_id', value.clientId); url.searchParams.set('redirect_uri', value.redirectUri); url.searchParams.set('response_type', 'code'); url.searchParams.set('scope', value.scopes); url.searchParams.set('state', state); url.searchParams.set('code_challenge', challenge); url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

async function callback({ userId, code, state }) {
  const value = ensureConfigured();
  const record = pending.get(state);
  pending.delete(state);
  if (!record || record.expiresAt < Date.now() || record.userId !== userId) throw new GitLabOAuthError('GITLAB_OAUTH_STATE_INVALID', 'GitLab OAuth 授权已失效，请重新连接', 401);
  if (!code) throw new GitLabOAuthError('GITLAB_OAUTH_CODE_MISSING', 'GitLab OAuth 未返回授权码', 400);
  let response;
  try {
    const tokenBody = new URLSearchParams({ client_id: value.clientId, client_secret: value.clientSecret, code, grant_type: 'authorization_code', redirect_uri: value.redirectUri, code_verifier: record.verifier });
    response = await fetch(`${record.host}/oauth/token`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: tokenBody.toString() });
  } catch (_error) { throw new GitLabOAuthError('GITLAB_OAUTH_UNAVAILABLE', 'GitLab OAuth 服务暂时不可用', 502); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new GitLabOAuthError('GITLAB_OAUTH_TOKEN_FAILED', 'GitLab OAuth Token 交换失败', response.status || 502);
  tokens.set(userId, { accessToken: body.access_token, refreshToken: body.refresh_token || null, host: record.host, connectionId: record.connectionId, expiresAt: body.expires_in ? Date.now() + Number(body.expires_in) * 1000 : null, updatedAt: new Date().toISOString() });
  return { returnTo: record.returnTo, connectionId: record.connectionId };
}

function tokenForUser(userId, host) {
  const record = tokens.get(userId);
  if (!record || (host && record.host !== String(host).replace(/\/$/, ''))) return null;
  if (record.expiresAt && record.expiresAt <= Date.now()) { tokens.delete(userId); return null; }
  return record.accessToken;
}

function status(userId, host) {
  const token = tokenForUser(userId, host);
  return { connected: Boolean(token), mode: config().devHttp ? 'development-only' : 'production' };
}

function disconnect(userId, host) {
  const record = tokens.get(userId);
  if (!record) return;
  if (!host || record.host === String(host).replace(/\/$/, '')) tokens.delete(userId);
}

module.exports = { GitLabOAuthError, config, start, callback, tokenForUser, status, disconnect };
