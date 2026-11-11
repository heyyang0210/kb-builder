const oauth = require('../../../packages/agent-runner-core/lib/gitlab-oauth');
const { GitLabOAuthCredentialStore } = require('../../../packages/agent-runner-core/lib/gitlab-oauth-store');
const nativeFetch = global.fetch;

function memoryAggregate(seed = { version: 1, accounts: [] }) {
  let state = structuredClone(seed);
  return {
    read: () => structuredClone(state),
    transaction(mutator) { const result = mutator(state); return result; },
    snapshot: () => structuredClone(state),
  };
}

describe('GitLab OAuth flow', () => {
  beforeEach(() => {
    process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID = 'client';
    process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET = 'secret';
    process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI = 'http://192.168.130.180:13510/knowledge-center/api/gitlab/oauth/callback';
    process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP = 'true';
    process.env.KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY = 'unit-test-encryption-key';
    oauth.setCredentialStore(new GitLabOAuthCredentialStore({ aggregate: memoryAggregate(), env: process.env }));
  });
  afterEach(() => {
    ['KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID','KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET','KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI','KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP','KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY'].forEach(key => delete process.env[key]);
  });

  test('generates PKCE authorization URL and exchanges callback token', async () => {
    const url = oauth.start({ userId: 'u1', connectionId: 'c1', host: 'https://git-tools.yasdb.com', returnTo: '/knowledge-center/platform' });
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/oauth/authorize');
    expect(parsed.searchParams.get('scope')).toBe('read_api read_repository');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    const state = parsed.searchParams.get('state');
    global.fetch = jest.fn(async (_url, options) => {
      const body = new URLSearchParams(options.body);
      expect(body.get('code_verifier')).toBeTruthy();
      return { ok: true, status: 200, json: async () => ({ access_token: 'token-1', expires_in: 3600 }) };
    });
    await expect(oauth.callback({ userId: 'u1', code: 'code', state })).resolves.toMatchObject({ returnTo: '/knowledge-center/platform', connectionId: 'c1' });
    await expect(oauth.tokenForUser('u1', { id: 'c1', host: 'https://git-tools.yasdb.com' })).resolves.toBe('token-1');
    oauth.disconnect('u1', 'c1');
    await expect(oauth.tokenForUser('u1', { id: 'c1', host: 'https://git-tools.yasdb.com' })).resolves.toBeNull();
  });

  test('HTTP opt-in accepts private networks but preserves protocol and public-host restrictions', () => {
    const start = () => oauth.start({ userId: 'u1', connectionId: 'c1', host: 'https://git-tools.yasdb.com' });
    try {
      delete process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP;
      process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_ALLOW_HTTP = 'true';
      for (const host of ['172.16.0.1', '172.31.255.254', '10.1.2.3', '192.168.0.1', '127.0.0.1', 'localhost']) {
        process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI = `http://${host}/knowledge-center/api/gitlab/oauth/callback`;
        expect(start()).toContain('/oauth/authorize');
      }
      for (const uri of ['http://172.15.1.1/callback', 'http://172.32.1.1/callback', 'http://example.com/callback', 'ftp://172.16.91.10/callback']) {
        process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI = uri;
        expect(start).toThrow('正式回调必须使用 HTTPS');
      }
      process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI = 'http://172.16.91.10/callback';
      process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_ALLOW_HTTP = 'false';
      process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP = 'true';
      expect(start).toThrow('正式回调必须使用 HTTPS');
      delete process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_ALLOW_HTTP;
      expect(start()).toContain('/oauth/authorize');
      delete process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP;
      expect(start).toThrow('正式回调必须使用 HTTPS');
      process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI = 'https://example.com/callback';
      expect(start()).toContain('/oauth/authorize');
    } finally {
      delete process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_ALLOW_HTTP;
    }
  });

  test('persists encrypted credentials across store instances and isolates connections', async () => {
    const aggregate = memoryAggregate();
    oauth.setCredentialStore(new GitLabOAuthCredentialStore({ aggregate, env: process.env }));
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'plain-access', refresh_token: 'plain-refresh', expires_in: 3600 }) }));
    const state = new URL(oauth.start({ userId: 'u1', connectionId: 'c1', host: 'https://git-tools.yasdb.com' })).searchParams.get('state');
    await oauth.callback({ userId: 'u1', code: 'code', state });
    expect(JSON.stringify(aggregate.snapshot())).not.toContain('plain-access');
    expect(JSON.stringify(aggregate.snapshot())).not.toContain('plain-refresh');
    oauth.setCredentialStore(new GitLabOAuthCredentialStore({ aggregate, env: process.env }));
    await expect(oauth.tokenForUser('u1', { id: 'c1', host: 'https://git-tools.yasdb.com' })).resolves.toBe('plain-access');
    await expect(oauth.tokenForUser('u1', { id: 'c2', host: 'https://git-tools.yasdb.com' })).resolves.toBeNull();
  });

  test('refreshes once for concurrent requests and preserves authorization on network failure', async () => {
    const aggregate = memoryAggregate();
    const credentials = new GitLabOAuthCredentialStore({ aggregate, env: process.env });
    credentials.save({ userId: 'u1', connectionId: 'c1', host: 'https://git-tools.yasdb.com', accessToken: 'old', refreshToken: 'refresh', expiresAt: new Date(Date.now() - 1000).toISOString(), state: 'connected' });
    oauth.setCredentialStore(credentials);
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'new', refresh_token: 'new-refresh', expires_in: 3600 }) }));
    await expect(Promise.all([oauth.tokenForUser('u1', { id: 'c1', host: 'https://git-tools.yasdb.com' }), oauth.tokenForUser('u1', { id: 'c1', host: 'https://git-tools.yasdb.com' })])).resolves.toEqual(['new', 'new']);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    credentials.save({ userId: 'u1', connectionId: 'c1', host: 'https://git-tools.yasdb.com', accessToken: 'new', refreshToken: 'new-refresh', expiresAt: new Date(Date.now() - 1000).toISOString(), state: 'connected' });
    global.fetch = jest.fn(async () => { throw new Error('offline'); });
    await expect(oauth.tokenForUser('u1', { id: 'c1', host: 'https://git-tools.yasdb.com' })).resolves.toBeNull();
    await expect(oauth.status('u1', { id: 'c1', host: 'https://git-tools.yasdb.com' })).resolves.toMatchObject({ connected: true, status: 'temporarily_unavailable' });
  });

  test('rejects unsafe return target and invalid state', () => {
    const url = oauth.start({ userId: 'u2', connectionId: 'c1', host: 'https://git-tools.yasdb.com', returnTo: 'https://evil.example/' });
    expect(new URL(url).searchParams.get('state')).toBeTruthy();
    return expect(oauth.callback({ userId: 'other', code: 'x', state: 'missing' })).rejects.toMatchObject({ code: 'GITLAB_OAUTH_STATE_INVALID' });
  });
});

describe('GitLab OAuth 隔离 HTTP 刷新边界', () => {
  const http = require('node:http');
  const { GitLabOAuthStoreError } = require('../../../packages/agent-runner-core/lib/gitlab-oauth-store');
  let server;
  let host;
  let credentials;
  let previous;
  let reply;
  let requests;
  const env = {
    KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID: 'boundary-client',
    KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET: 'boundary-secret',
    KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI: 'https://platform.example/callback',
    KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY: 'isolated-http-boundary-key',
  };
  const connection = () => ({ id: 'boundary-connection', host });
  function seed(overrides = {}) {
    credentials.save({ userId: 'boundary-user', connectionId: 'boundary-connection', host,
      accessToken: 'previous-access', refreshToken: 'previous-refresh', state: 'connected',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      updatedAt: '2026-01-01T00:00:00.000Z', lastUsedAt: '2026-01-01T00:00:00.000Z', ...overrides });
  }
  beforeEach(async () => {
    previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
    Object.assign(process.env, env);
    global.fetch = nativeFetch;
    requests = [];
    reply = { status: 200, body: { access_token: 'renewed-access' } };
    server = http.createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      requests.push({ method: req.method, path: req.url, type: req.headers['content-type'], body: Object.fromEntries(new URLSearchParams(body)) });
      if (reply.disconnect) { req.socket.destroy(); return; }
      res.writeHead(reply.status, { 'Content-Type': 'application/json' });
      res.end(reply.raw ?? JSON.stringify(reply.body));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    host = `http://127.0.0.1:${server.address().port}`;
    credentials = new GitLabOAuthCredentialStore({ aggregate: memoryAggregate(), env: process.env });
    oauth.setCredentialStore(credentials);
  });
  afterEach(async () => {
    await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
    global.fetch = nativeFetch;
    oauth.setCredentialStore(undefined);
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  test('缺少刷新令牌进入重新授权状态且不发请求', async () => {
    seed({ refreshToken: null });
    await expect(oauth.status('boundary-user', connection())).resolves.toMatchObject({ connected: false, status: 'reauthorization_required' });
    expect(requests).toEqual([]);
    expect(credentials.get('boundary-user', connection().id).accessToken).toBe('previous-access');
    await expect(oauth.tokenForUser('boundary-user', connection())).resolves.toBeNull();
  });

  test.each([400, 401])('HTTP %i 刷新拒绝保留凭据并要求重新授权', async status => {
    seed();
    reply = { status, body: { error: 'invalid_grant' } };
    await expect(oauth.tokenForUser('boundary-user', connection(), { forceRefresh: true })).resolves.toBeNull();
    await expect(oauth.status('boundary-user', connection())).resolves.toMatchObject({ connected: false, status: 'reauthorization_required' });
    expect(credentials.get('boundary-user', connection().id).refreshToken).toBe('previous-refresh');
    expect(requests).toEqual([{ method: 'POST', path: '/oauth/token', type: 'application/x-www-form-urlencoded', body: {
      client_id: 'boundary-client', client_secret: 'boundary-secret', refresh_token: 'previous-refresh', grant_type: 'refresh_token',
    } }]);
  });

  test.each([
    ['服务错误', { status: 502, body: { error: 'unavailable' } }],
    ['无令牌响应', { status: 200, body: {} }],
    ['非法 JSON', { status: 200, raw: '{invalid' }],
    ['连接中断', { disconnect: true }],
  ])('%s：静默刷新保留连接，强制刷新返回可恢复错误', async (_name, response) => {
    seed();
    reply = response;
    await expect(oauth.status('boundary-user', connection())).resolves.toMatchObject({ connected: true, status: 'temporarily_unavailable' });
    await expect(oauth.tokenForUser('boundary-user', connection(), { forceRefresh: true })).rejects.toMatchObject({ code: 'GITLAB_OAUTH_UNAVAILABLE', status: 502 });
    expect(credentials.get('boundary-user', connection().id)).toMatchObject({ state: 'connected', accessToken: 'previous-access', refreshToken: 'previous-refresh' });
    reply = { status: 200, body: { access_token: 'recovered-access' } };
    await expect(oauth.tokenForUser('boundary-user', connection(), { forceRefresh: true })).resolves.toBe('recovered-access');
    expect(credentials.get('boundary-user', connection().id)).toMatchObject({ accessToken: 'recovered-access', refreshToken: 'previous-refresh', expiresAt: null });
    await expect(oauth.status('boundary-user', connection())).resolves.toMatchObject({ connected: true, status: 'connected' });
  });

  test('凭据存储错误转为公开授权状态，未知错误继续抛出', async () => {
    const error = new GitLabOAuthStoreError('OAUTH_KEY_UNAVAILABLE', '隔离密钥不可用', 503);
    oauth.setCredentialStore({ get() { throw error; } });
    await expect(oauth.tokenForUser('boundary-user', connection())).rejects.toMatchObject({ code: error.code, message: error.message, status: 503 });
    await expect(oauth.status('boundary-user', connection())).resolves.toEqual({ connected: false, status: 'reauthorization_required', updatedAt: null, lastUsedAt: null });
    const unknown = new Error('unexpected isolated failure');
    oauth.setCredentialStore({ get() { throw unknown; } });
    await expect(oauth.tokenForUser('boundary-user', connection())).rejects.toBe(unknown);
    await expect(oauth.status('boundary-user', connection())).rejects.toBe(unknown);
  });

  test('空会话和不同主机不会读取其它连接令牌', async () => {
    seed({ expiresAt: null });
    await expect(oauth.tokenForUser(null, connection())).resolves.toBeNull();
    await expect(oauth.tokenForUser('boundary-user', null)).resolves.toBeNull();
    await expect(oauth.tokenForUser('boundary-user', { ...connection(), host: 'https://different.example' })).resolves.toBeNull();
    await expect(oauth.status('boundary-user', null)).resolves.toMatchObject({ status: 'disconnected' });
    await expect(oauth.status('missing-user', connection())).resolves.toMatchObject({ status: 'disconnected' });
    oauth.disconnect(null, connection().id);
    expect(credentials.get('boundary-user', connection().id).accessToken).toBe('previous-access');
    expect(requests).toEqual([]);
  });

  function authorize(extra = {}) {
    return new URL(oauth.start({ userId: 'boundary-user', connectionId: connection().id, host, ...extra })).searchParams.get('state');
  }

  test('配置和会话校验先于授权请求', () => {
    for (const key of ['KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID', 'KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET', 'KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI']) {
      delete process.env[key];
      expect(() => authorize()).toThrow(expect.objectContaining({ code: 'GITLAB_OAUTH_NOT_CONFIGURED', status: 503 }));
      process.env[key] = env[key];
    }
    process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI = 'invalid callback';
    expect(() => authorize()).toThrow('格式不正确');
    process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI = env.KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI;
    for (const value of [{ userId: null }, { connectionId: null }, { host: null }]) {
      expect(() => authorize(value)).toThrow('需要有效的知识中心登录会话');
    }
    expect(requests).toEqual([]);
  });

  test.each([null, '2099-01-01T00:00:00.000Z'])('有效凭据过期时间 %s 可直接使用且状态查询不刷新', async expiresAt => {
    seed({ expiresAt });
    await expect(oauth.tokenForUser('boundary-user', connection())).resolves.toBe('previous-access');
    await expect(oauth.status('boundary-user', connection())).resolves.toEqual({
      connected: true, status: 'connected', updatedAt: '2026-01-01T00:00:00.000Z', lastUsedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(credentials.get('boundary-user', connection().id)).toMatchObject({ accessToken: 'previous-access', expiresAt });
    expect(requests).toEqual([]);
  });

  test('缺少授权码会消费 state，重复回调被拒绝', async () => {
    const state = authorize();
    await expect(oauth.callback({ userId: 'boundary-user', state })).rejects.toMatchObject({ code: 'GITLAB_OAUTH_CODE_MISSING' });
    await expect(oauth.callback({ userId: 'boundary-user', state, code: 'retry' })).rejects.toMatchObject({ code: 'GITLAB_OAUTH_STATE_INVALID' });
    expect(requests).toEqual([]);
  });

  test('state 超时拒绝，后续授权清理过期项且可正常回调', async () => {
    const expired = authorize();
    const pruned = authorize();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 8 * 60 * 60 * 1000 + 1);
    try {
      await expect(oauth.callback({ userId: 'boundary-user', state: expired, code: 'expired' })).rejects.toMatchObject({ code: 'GITLAB_OAUTH_STATE_INVALID' });
      const fresh = authorize({ returnTo: '//evil.example/' });
      await expect(oauth.callback({ userId: 'boundary-user', state: pruned, code: 'pruned' })).rejects.toMatchObject({ code: 'GITLAB_OAUTH_STATE_INVALID' });
      reply = { status: 200, body: { access_token: 'callback-access', refresh_token: 'callback-refresh', expires_in: 3600 } };
      await expect(oauth.callback({ userId: 'boundary-user', state: fresh, code: 'fresh' })).resolves.toEqual({ connectionId: connection().id, returnTo: '/knowledge-center/?externalAccount=1' });
      expect(credentials.get('boundary-user', connection().id)).toMatchObject({ accessToken: 'callback-access', refreshToken: 'callback-refresh', expiresAt: new Date(Date.now() + 3600000).toISOString() });
      expect(requests).toHaveLength(1);
      expect(requests[0].body).toMatchObject({ code: 'fresh', grant_type: 'authorization_code', redirect_uri: env.KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI });
      expect(requests[0].body.code_verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    } finally { clock.mockRestore(); }
  });

  test('待授权容量淘汰最早状态，最后状态仍可用', async () => {
    const earliest = authorize();
    let latest;
    for (let index = 0; index < 1000; index += 1) latest = authorize();
    await expect(oauth.callback({ userId: 'boundary-user', state: earliest, code: 'evicted' })).rejects.toMatchObject({ code: 'GITLAB_OAUTH_STATE_INVALID' });
    await expect(oauth.callback({ userId: 'boundary-user', state: latest, code: 'last' })).resolves.toMatchObject({ connectionId: connection().id });
    expect(requests).toHaveLength(1);
  });

  test.each([
    [403, { error: 'access_denied' }, undefined],
    [200, {}, undefined],
    [200, undefined, '{malformed'],
  ])('授权码交换 HTTP %i 无有效令牌时不保存凭据', async (status, body, raw) => {
    const state = authorize();
    reply = { status, body, raw };
    await expect(oauth.callback({ userId: 'boundary-user', state, code: 'rejected' })).rejects.toMatchObject({ code: 'GITLAB_OAUTH_TOKEN_FAILED', status });
    expect(credentials.get('boundary-user', connection().id)).toBeNull();
    expect(requests).toHaveLength(1);
  });
});
