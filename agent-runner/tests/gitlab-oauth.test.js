const oauth = require('../lib/gitlab-oauth');

describe('GitLab OAuth flow', () => {
  beforeEach(() => {
    process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID = 'client';
    process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET = 'secret';
    process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI = 'http://192.168.130.180:13510/knowledge-center/api/gitlab/oauth/callback';
    process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP = 'true';
  });
  afterEach(() => {
    ['KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID','KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET','KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI','KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP'].forEach(key => delete process.env[key]);
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
    expect(oauth.tokenForUser('u1', 'https://git-tools.yasdb.com')).toBe('token-1');
    oauth.disconnect('u1');
    expect(oauth.tokenForUser('u1', 'https://git-tools.yasdb.com')).toBeNull();
  });

  test('rejects unsafe return target and invalid state', () => {
    const url = oauth.start({ userId: 'u2', connectionId: 'c1', host: 'https://git-tools.yasdb.com', returnTo: 'https://evil.example/' });
    expect(new URL(url).searchParams.get('state')).toBeTruthy();
    return expect(oauth.callback({ userId: 'other', code: 'x', state: 'missing' })).rejects.toMatchObject({ code: 'GITLAB_OAUTH_STATE_INVALID' });
  });
});
