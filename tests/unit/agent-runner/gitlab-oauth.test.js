const oauth = require('../../../packages/agent-runner-core/lib/gitlab-oauth');
const { GitLabOAuthCredentialStore } = require('../../../packages/agent-runner-core/lib/gitlab-oauth-store');

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
