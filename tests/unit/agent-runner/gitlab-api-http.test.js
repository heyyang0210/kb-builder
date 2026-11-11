const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('GitLab same-origin HTTP API', () => {
  let frontend;
  let gitlabServer;
  let baseUrl;
  let gitlabUrl;
  let tempRoot;
  let adminCookie;
  let readerCookie;
  let insufficientScope = false;
  let oauthBranchFailure = false;
  let oauthTokenExchanges = 0;
  const upstreamRequests = [];

  beforeAll(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlab-http-'));
    const assets = path.join(tempRoot, 'assets.json');
    fs.writeFileSync(assets, JSON.stringify({ handbooks: [{ handbookId: 'DB-001', name: '数据库手册' }] }));
    process.env.KNOWLEDGE_ASSETS_CONFIG = assets;
    process.env.KNOWLEDGE_CENTER_AUTH_STORE = path.join(tempRoot, 'auth.json');
    process.env.KNOWLEDGE_CENTER_ADMIN_USERNAME = 'http-admin';
    process.env.KNOWLEDGE_CENTER_ADMIN_PASSWORD = 'http-admin-password';
    process.env.KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_USERNAME = 'http-reader';
    process.env.KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_PASSWORD = 'http-reader-password';
    process.env.KNOWLEDGE_CENTER_COOKIE_SECURE = 'false';
    process.env.KNOWLEDGE_CENTER_GITLAB_CONFIG = path.join(tempRoot, 'gitlab.json');
    process.env.KNOWLEDGE_CENTER_GITLAB_ALLOWED_HOSTS = 'git-tools.yasdb.com,127.0.0.1';
    process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID = 'http-client';
    process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET = 'http-secret';
    process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI = 'http://127.0.0.1:13510/knowledge-center/api/gitlab/oauth/callback';
    process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP = 'true';
    process.env.KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY = 'http-test-encryption-key';
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    process.env.GITLAB_TOKEN_local_read = 'test-only-token';
    gitlabServer = http.createServer((req, res) => {
      upstreamRequests.push(req.url);
      if (req.url === '/oauth/token' && req.method === 'POST') { oauthTokenExchanges++; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ access_token: 'oauth-local-token', expires_in: 3600 })); return; }
      if (req.headers['private-token'] !== 'test-only-token' && req.headers.authorization !== 'Bearer oauth-local-token') { res.writeHead(401); res.end(JSON.stringify({ message: 'unauthorized' })); return; }
      if (insufficientScope) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'insufficient_scope', error_description: 'Higher privileges required' })); return; }
      if (oauthBranchFailure && req.url.includes('/repository/branches')) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: 'branch verification unavailable' })); return; }
      if (req.url.includes('/repository/files/') && req.url.includes('missing.md')) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: 'File Not Found' })); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (req.url.includes('/repository/branches')) { res.end(JSON.stringify([{ name: 'master', protected: true, commit: { id: 'abcdef123456' } }])); return; }
      if (req.url.includes('/repository/commits')) { res.end(JSON.stringify([{ id: 'commit-full-sha', short_id: 'commit1', title: '修订文档', message: '修订正文与目录', author_name: '测试作者', authored_date: '2026-01-01T00:00:00Z', web_url: 'https://example.test/commit/1' }])); return; }
      if (req.url.includes('/repository/tree')) { res.end(JSON.stringify([{ name: '基础概念', path: 'doc/产品文档/基础概念', type: 'tree' }, { name: '_index.md', path: 'doc/产品文档/_index.md', type: 'blob' }, { name: 'intro.md', path: 'doc/产品文档/基础概念/intro.md', type: 'blob' }, { name: 'guide.pdf', path: 'doc/产品文档/guide.pdf', type: 'blob' }, { name: 'cover.png', path: 'doc/产品文档/cover.png', type: 'blob' }])); return; }
      if (req.url.includes('/repository/files/') && req.url.includes('cover.png')) { res.end(JSON.stringify({ file_path: 'doc/产品文档/cover.png', encoding: 'base64', content: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]).toString('base64'), commit_id: 'abcdef123456' })); return; }
      res.end(JSON.stringify({ file_path: 'doc/产品文档/_index.md', encoding: 'base64', content: Buffer.from('# 产品文档').toString('base64'), commit_id: 'abcdef123456' }));
    });
    await new Promise(resolve => gitlabServer.listen(0, '127.0.0.1', resolve));
    gitlabUrl = `http://127.0.0.1:${gitlabServer.address().port}`;
    jest.resetModules();
    frontend = require('../../../apps/knowledge-center-web/frontend-server').server;
    await new Promise(resolve => frontend.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${frontend.address().port}`;
    adminCookie = await login('http-admin', 'http-admin-password');
    readerCookie = await login('http-reader', 'http-reader-password');
  });

  afterAll(async () => {
    await new Promise(resolve => frontend.close(resolve));
    await new Promise(resolve => gitlabServer.close(resolve));
    fs.rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.KNOWLEDGE_CENTER_AUTH_STORE;
    delete process.env.KNOWLEDGE_CENTER_ADMIN_USERNAME;
    delete process.env.KNOWLEDGE_CENTER_ADMIN_PASSWORD;
    delete process.env.KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_USERNAME;
    delete process.env.KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_PASSWORD;
    delete process.env.KNOWLEDGE_CENTER_COOKIE_SECURE;
    delete process.env.KNOWLEDGE_ASSETS_CONFIG;
    delete process.env.KNOWLEDGE_CENTER_GITLAB_CONFIG;
    delete process.env.KNOWLEDGE_CENTER_GITLAB_ALLOWED_HOSTS;
    delete process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID;
    delete process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET;
    delete process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI;
    delete process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP;
    delete process.env.KNOWLEDGE_CENTER_OAUTH_ENCRYPTION_KEY;
    delete process.env.KNOWLEDGE_STORAGE_MODE;
    delete process.env.GITLAB_TOKEN_local_read;
  });

  test('ordinary users cannot enumerate or freely browse connections', async () => {
    const response = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, { headers: { cookie: readerCookie } });
    expect(response.status).toBe(403);
    const direct = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections/unknown/tree`, { headers: { cookie: readerCookie } });
    expect(direct.status).toBe(403);
  });

  test('真实 HTTP：授权范围不足应提示重新授权，保留403且不泄漏凭据', async () => {
    const configured = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'POST', headers: { cookie: adminCookie, 'content-type': 'application/json', 'idempotency-key': 'http-insufficient-scope' },
      body: JSON.stringify({ name: 'scope-check', host: gitlabUrl, project: 'cod-doc/scope-check', mode: 'sandbox', authMode: 'service_account', credentialRef: 'local_read', purpose: 'read' }),
    });
    expect(configured.status).toBe(200);
    const connection = (await configured.json()).data;
    insufficientScope = true;
    try {
      const response = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections/${encodeURIComponent(connection.id)}/branches`, { headers: { cookie: adminCookie } });
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toMatchObject({ code: 'GITLAB_INSUFFICIENT_SCOPE', message: expect.stringContaining('重新授权') });
      expect(JSON.stringify(body)).not.toContain('test-only-token');
    } finally { insufficientScope = false; }
  });

  test('ordinary users can list safe personal-account projections and start only configured OAuth connections', async () => {
    const configured = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'POST', headers: { cookie: adminCookie, 'content-type': 'application/json', 'idempotency-key': 'http-personal-account' },
      body: JSON.stringify({ name: '公司研发 GitLab', host: gitlabUrl, project: 'cod-doc/personal', mode: 'sandbox', authMode: 'user_oauth', purpose: 'read' })
    });
    const connection = (await configured.json()).data;
    const accounts = await fetch(`${baseUrl}/knowledge-center/api/gitlab/oauth/accounts`, { headers: { cookie: readerCookie } });
    expect(accounts.status).toBe(200);
    await expect(accounts.json()).resolves.toMatchObject({ data: { items: expect.arrayContaining([expect.objectContaining({ connectionId: connection.id, name: '公司研发 GitLab', status: 'disconnected' })]) } });
    const start = await fetch(`${baseUrl}/knowledge-center/api/gitlab/oauth/start?connectionId=${encodeURIComponent(connection.id)}`, { headers: { cookie: readerCookie }, redirect: 'manual' });
    expect(start.status).toBe(302);
    expect(new URL(start.headers.get('location')).pathname).toBe('/oauth/authorize');
  });

  test('OAuth configuration is projected safely and only personal connections can be disconnected', async () => {
    const config = await fetch(`${baseUrl}/knowledge-center/api/gitlab/oauth/config`, { headers: { cookie: readerCookie } });
    expect(config.status).toBe(200);
    await expect(config.json()).resolves.toMatchObject({ data: { configured: true, devHttp: true } });

    const missing = await fetch(`${baseUrl}/knowledge-center/api/gitlab/oauth/disconnect`, {
      method: 'POST', headers: { cookie: readerCookie },
    });
    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toMatchObject({ error: { code: 'GITLAB_CONNECTION_REQUIRED' } });

    const personalResponse = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'POST', headers: { cookie: adminCookie, 'content-type': 'application/json', 'idempotency-key': 'http-oauth-disconnect' },
      body: JSON.stringify({ name: 'oauth-disconnect', host: gitlabUrl, project: 'cod-doc/disconnect', mode: 'sandbox', authMode: 'user_oauth', purpose: 'read' }),
    });
    expect(personalResponse.status).toBe(200);
    const personal = (await personalResponse.json()).data;
    const start = await fetch(`${baseUrl}/knowledge-center/api/gitlab/oauth/start?connectionId=${personal.id}`, {
      headers: { cookie: readerCookie }, redirect: 'manual',
    });
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const callback = await fetch(`${baseUrl}/knowledge-center/api/gitlab/oauth/callback?code=local-code&state=${state}`, {
      headers: { cookie: readerCookie }, redirect: 'manual',
    });
    expect(callback.status).toBe(302);
    const endpoint = `${baseUrl}/knowledge-center/api/gitlab/oauth/status?connectionId=${personal.id}`;
    const connected = await fetch(endpoint, { headers: { cookie: readerCookie } });
    await expect(connected.json()).resolves.toMatchObject({ data: { connected: true } });

    const disconnected = await fetch(`${baseUrl}/knowledge-center/api/gitlab/oauth/disconnect?connectionId=${personal.id}`, {
      method: 'POST', headers: { cookie: readerCookie },
    });
    expect(disconnected.status).toBe(200);
    await expect(disconnected.json()).resolves.toMatchObject({ data: { connectionId: personal.id, connected: false, status: 'disconnected' } });
    const after = await fetch(endpoint, { headers: { cookie: readerCookie } });
    await expect(after.json()).resolves.toMatchObject({ data: { connected: false } });

    const serviceResponse = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'POST', headers: { cookie: adminCookie, 'content-type': 'application/json', 'idempotency-key': 'http-oauth-service-disconnect' },
      body: JSON.stringify({ name: 'service-disconnect', host: gitlabUrl, project: 'cod-doc/service', mode: 'sandbox', authMode: 'service_account', credentialRef: 'local_read', purpose: 'read' }),
    });
    expect(serviceResponse.status).toBe(200);
    const service = (await serviceResponse.json()).data;
    const rejected = await fetch(`${baseUrl}/knowledge-center/api/gitlab/oauth/disconnect?connectionId=${service.id}`, {
      method: 'POST', headers: { cookie: readerCookie },
    });
    expect(rejected.status).toBe(409);
    await expect(rejected.json()).resolves.toMatchObject({ error: { code: 'GITLAB_OAUTH_NOT_REQUIRED' } });
  });

  test('OAuth callback exchanges a local token, verifies branches and preserves the return target', async () => {
    const configured = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'POST', headers: { cookie: adminCookie, 'content-type': 'application/json', 'idempotency-key': 'http-oauth-callback' },
      body: JSON.stringify({ name: 'oauth-callback', host: gitlabUrl, project: 'cod-doc/oauth-callback', mode: 'sandbox', authMode: 'user_oauth', purpose: 'read' }),
    });
    expect(configured.status).toBe(200);
    const connection = (await configured.json()).data;
    const returnTo = '/knowledge-center/platform?tab=gitlab#accounts';
    const start = await fetch(`${baseUrl}/knowledge-center/api/gitlab/oauth/start?connectionId=${encodeURIComponent(connection.id)}&returnTo=${encodeURIComponent(returnTo)}`, { headers: { cookie: readerCookie }, redirect: 'manual' });
    expect(start.status).toBe(302);
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    expect(state).toBeTruthy();
    const before = oauthTokenExchanges;
    const callback = await fetch(`${baseUrl}/knowledge-center/api/gitlab/oauth/callback?code=local-code&state=${encodeURIComponent(state)}`, { headers: { cookie: readerCookie }, redirect: 'manual' });
    expect(callback.status).toBe(302);
    const location = new URL(callback.headers.get('location'), baseUrl);
    expect(location.pathname).toBe('/knowledge-center/platform');
    expect(location.searchParams.get('tab')).toBe('gitlab');
    expect(location.searchParams.get('gitlabConnection')).toBe(connection.id);
    expect(location.searchParams.get('gitlabConnectionStatus')).toBe('verified');
    expect(location.hash).toBe('#accounts');
    expect(oauthTokenExchanges).toBe(before + 1);
    const status = await fetch(`${baseUrl}/knowledge-center/api/gitlab/oauth/status?connectionId=${encodeURIComponent(connection.id)}`, { headers: { cookie: readerCookie } });
    expect(status.status).toBe(200);
    await expect(status.json()).resolves.toMatchObject({ data: { connected: true } });
  });

  test('OAuth callback reports branch verification failure while retaining the local authorization', async () => {
    const configured = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'POST', headers: { cookie: adminCookie, 'content-type': 'application/json', 'idempotency-key': 'http-oauth-failed-check' },
      body: JSON.stringify({ name: 'oauth-failed-check', host: gitlabUrl, project: 'cod-doc/oauth-failed-check', mode: 'sandbox', authMode: 'user_oauth', purpose: 'read' }),
    });
    expect(configured.status).toBe(200);
    const connection = (await configured.json()).data;
    const start = await fetch(`${baseUrl}/knowledge-center/api/gitlab/oauth/start?connectionId=${encodeURIComponent(connection.id)}`, { headers: { cookie: readerCookie }, redirect: 'manual' });
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    oauthBranchFailure = true;
    try {
      const callback = await fetch(`${baseUrl}/knowledge-center/api/gitlab/oauth/callback?code=local-code&state=${encodeURIComponent(state)}`, { headers: { cookie: readerCookie }, redirect: 'manual' });
      expect(callback.status).toBe(302);
      const location = new URL(callback.headers.get('location'), baseUrl);
      expect(location.pathname).toBe('/knowledge-center/');
      expect(location.searchParams.get('externalAccount')).toBe('1');
      expect(location.searchParams.get('gitlabConnection')).toBe(connection.id);
      expect(location.searchParams.get('gitlabConnectionStatus')).toBe('failed');
    } finally { oauthBranchFailure = false; }
    const status = await fetch(`${baseUrl}/knowledge-center/api/gitlab/oauth/status?connectionId=${encodeURIComponent(connection.id)}`, { headers: { cookie: readerCookie } });
    expect(status.status).toBe(200);
    await expect(status.json()).resolves.toMatchObject({ data: { connected: true } });
  });

  test('knowledge readers can inspect handbook access status without enumerating connections', async () => {
    const configured = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'POST', headers: { cookie: adminCookie, 'content-type': 'application/json', 'idempotency-key': 'http-access-status' },
      body: JSON.stringify({ name: 'oauth-access', host: gitlabUrl, project: 'cod-doc/access', mode: 'sandbox', authMode: 'user_oauth', purpose: 'read' })
    });
    const connection = (await configured.json()).data;
    const readAccount = async () => {
      const response = await fetch(`${baseUrl}/knowledge-center/api/gitlab/oauth/accounts`, { headers: { cookie: readerCookie } });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(JSON.stringify(body)).not.toContain('http-secret');
      return body.data.items.find(item => item.connectionId === connection.id);
    };
    expect(await readAccount()).toMatchObject({ linkedHandbookCount: 0, status: 'disconnected', connected: false });
    const mapped = await fetch(`${baseUrl}/knowledge-center/api/gitlab/mappings/DB-001`, {
      method: 'PUT', headers: { cookie: adminCookie, 'content-type': 'application/json', 'idempotency-key': 'http-access-mapping' },
      body: JSON.stringify({ connectionId: connection.id, defaultBranch: 'master', enabledBranches: ['master'], zhPaths: ['doc/产品文档'], enPaths: [] })
    });
    expect(mapped.status).toBe(200);
    expect(await readAccount()).toMatchObject({ linkedHandbookCount: 1, status: 'disconnected', connected: false });
    const management = await fetch(`${baseUrl}/knowledge-center/api/gitlab/mappings/DB-001`, { headers: { cookie: readerCookie } });
    expect(management.status).toBe(403);
    const production = await fetch(`${baseUrl}/knowledge-center/api/gitlab/mappings/DB-001?view=production`, { headers: { cookie: readerCookie } });
    expect(production.status).toBe(200);
    const projection = (await production.json()).data;
    expect(projection).toMatchObject({ connectionId: connection.id, defaultBranch: 'master', enabledBranches: ['master'] });
    expect(Object.keys(projection).sort()).toEqual(['handbookId', 'connectionId', 'defaultBranch', 'enabledBranches', 'zhPaths', 'enPaths'].sort());
    const unknown = await fetch(`${baseUrl}/knowledge-center/api/gitlab/mappings/missing?view=production`, { headers: { cookie: readerCookie } });
    expect(unknown.status).toBe(404);
    const access = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/access-status`, { headers: { cookie: readerCookie } });
    expect(access.status).toBe(200);
    await expect(access.json()).resolves.toMatchObject({ data: { authMode: 'user_oauth', connected: false, canRead: false, nextAction: 'connect_gitlab' } });
    const connections = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, { headers: { cookie: readerCookie } });
    expect(connections.status).toBe(403);
    const disabled = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections/${encodeURIComponent(connection.id)}/disable`, {
      method: 'POST', headers: { cookie: adminCookie, 'idempotency-key': 'http-access-disable' },
    });
    expect(disabled.status).toBe(200);
    expect(await readAccount()).toMatchObject({ linkedHandbookCount: 1, status: 'platform_disabled', connected: false });
  });

  test('handbook GitLab APIs require an authenticated session', async () => {
    const access = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/access-status`);
    expect(access.status).toBe(401);
    await expect(access.json()).resolves.toMatchObject({ error: { code: 'AUTH_REQUIRED' } });
  });

  test('review repository context preserves a missing handbook as HTTP 404', async () => {
    const response = await fetch(`${baseUrl}/knowledge-center/api/review/repository-context?handbookId=DB-NOT-FOUND`, { headers: { cookie: readerCookie } });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'ASSET_NOT_FOUND' } });
  });

  test('administrator changes handbook status through controlled commands', async () => {
    const changed = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks/DB-001/status`, {
      method: 'POST', headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ targetStatus: 'content_building', reason: '进入内容建设', expectedVersion: 1 }),
    });
    expect(changed.status).toBe(200);
    await expect(changed.json()).resolves.toMatchObject({ data: { status: 'content_building', manualStatus: 'content_building', assetVersion: 2 } });
    const published = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks/DB-001/status`, {
      method: 'POST', headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ targetStatus: 'handbook_published', reason: '尝试直接发布', expectedVersion: 2 }),
    });
    expect(published.status).toBe(409);
    await expect(published.json()).resolves.toMatchObject({ error: { code: 'HANDBOOK_PUBLISH_REQUIRED' } });
  });

  test('administrator configures a connection and handbook mapping with idempotency', async () => {
    const connectionResponse = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'PUT', headers: { cookie: adminCookie, 'content-type': 'application/json', 'idempotency-key': 'http-connection-1' },
      body: JSON.stringify({ name: 'yasdoc', host: 'https://git-tools.yasdb.com', project: 'cod-doc/yasdoc', mode: 'disabled', credentialRef: 'production-read' })
    });
    expect(connectionResponse.status).toBe(200);
    const connection = (await connectionResponse.json()).data;
    expect(connection.credentialConfigured).toBe(true);
    expect(connection.credentialRef).toBeUndefined();

    const mappingResponse = await fetch(`${baseUrl}/knowledge-center/api/gitlab/mappings/DB-001`, {
      method: 'PUT', headers: { cookie: adminCookie, 'content-type': 'application/json', 'idempotency-key': 'http-mapping-1' },
      body: JSON.stringify({ connectionId: connection.id, defaultBranch: 'master', enabledBranches: ['master'], zhPaths: ['doc/产品文档'], enPaths: ['doc/Manuals'] })
    });
    expect(mappingResponse.status).toBe(200);
    const body = await mappingResponse.json();
    expect(body.data).toMatchObject({ handbookId: 'DB-001', defaultBranch: 'master' });

    const assetsResponse = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks`, { headers: { cookie: readerCookie } });
    expect(assetsResponse.status).toBe(200);
    await expect(assetsResponse.json()).resolves.toMatchObject({ data: { items: [{ handbookId: 'DB-001', repositoryMapped: true, repository: { status: 'confirmed' } }] } });

    const contentResponse = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/branches`, { headers: { cookie: readerCookie } });
    expect(contentResponse.status).toBe(409);
    await expect(contentResponse.json()).resolves.toMatchObject({ error: { code: 'GITLAB_CONNECTOR_DISABLED' } });
  });

  test('mapped reader traverses the real HTTP connector to an authorized GitLab endpoint', async () => {
    const configured = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'PUT', headers: { cookie: adminCookie, 'content-type': 'application/json', 'idempotency-key': 'http-local-connection' },
      body: JSON.stringify({ name: 'local-yasdoc', host: gitlabUrl, project: 'cod-doc/yasdoc', mode: 'sandbox', credentialRef: 'local_read' })
    });
    expect(configured.status).toBe(200);
    const connection = (await configured.json()).data;
    const mapped = await fetch(`${baseUrl}/knowledge-center/api/gitlab/mappings/DB-001`, {
      method: 'PUT', headers: { cookie: adminCookie, 'content-type': 'application/json', 'idempotency-key': 'http-local-mapping' },
      body: JSON.stringify({ connectionId: connection.id, defaultBranch: 'master', enabledBranches: ['master'], zhPaths: ['doc/产品文档'], enPaths: [] })
    });
    expect(mapped.status).toBe(200);

    const branches = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/branches`, { headers: { cookie: readerCookie } });
    await expect(branches.json()).resolves.toMatchObject({ data: { handbookName: '数据库手册', items: [{ name: 'master', commitSha: 'abcdef123456' }] } });
    const tree = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/tree?ref=master&language=zh`, { headers: { cookie: readerCookie } });
    expect((await tree.json()).data).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'doc/产品文档/_index.md' })]));
    const file = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/file?ref=master&language=zh&path=${encodeURIComponent('doc/产品文档/_index.md')}`, { headers: { cookie: readerCookie } });
    await expect(file.json()).resolves.toMatchObject({ data: { content: '# 产品文档', commitId: 'abcdef123456' } });
    const imageEndpoint = `${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/file?ref=master&language=zh&path=${encodeURIComponent('doc/产品文档/cover.png')}`;
    const imageJson = await fetch(imageEndpoint, { headers: { cookie: readerCookie } });
    expect(imageJson.status).toBe(200);
    await expect(imageJson.json()).resolves.toMatchObject({ data: { encoding: 'base64', size: 8 } });
    const image = await fetch(`${imageEndpoint}&raw=1`, { headers: { cookie: readerCookie } });
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toBe('image/png');
    expect(image.headers.get('cache-control')).toBe('private, max-age=60');
    expect(Buffer.from(await image.arrayBuffer())).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]));
    const beforeDenied = upstreamRequests.length;
    const anonymous = await fetch(`${imageEndpoint}&raw=1`);
    expect(anonymous.status).toBe(401);
    const outside = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/file?ref=master&language=zh&path=${encodeURIComponent('outside/cover.png')}&raw=1`, { headers: { cookie: readerCookie } });
    expect(outside.status).toBe(403);
    expect(upstreamRequests).toHaveLength(beforeDenied);
    const statistics = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/statistics?ref=master&language=zh`, { headers: { cookie: readerCookie } });
    await expect(statistics.json()).resolves.toMatchObject({ data: { branch: 'master', chapterCount: 1, documentCount: 2, headSha: 'abcdef123456' } });
  });

  test.each([
    ['tree', '', 'master', ''],
    ['tree', '?ref=release&path=doc%2Fmanual', 'release', 'doc/manual'],
    ['file', '?ref=master&path=doc%2F%E4%BA%A7%E5%93%81%E6%96%87%E6%A1%A3%2F_index.md', 'master', 'doc/产品文档/_index.md'],
  ])('真实 HTTP：管理员直读%s使用正确分支和路径 %s', async (kind, query, ref, requestedPath) => {
    const list = await (await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, { headers: { cookie: adminCookie } })).json();
    const connection = list.data.items.find(item => item.name === 'local-yasdoc');
    expect(connection).toBeTruthy();
    const endpoint = `${baseUrl}/knowledge-center/api/gitlab/connections/${connection.id}/${kind}${query}`;
    const before = upstreamRequests.length;
    const denied = await fetch(endpoint, { headers: { cookie: readerCookie } });
    expect(denied.status).toBe(403);
    expect(upstreamRequests).toHaveLength(before);
    const response = await fetch(endpoint, { headers: { cookie: adminCookie } });
    expect(response.status).toBe(200);
    const body = await response.json();
    if (kind === 'tree') expect(body.data).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'doc/产品文档/_index.md' })]));
    else expect(body.data).toMatchObject({ content: '# 产品文档', commitId: 'abcdef123456' });
    expect(JSON.stringify(body)).not.toContain('test-only-token');
    const upstream = new URL(upstreamRequests.at(-1), gitlabUrl);
    expect(upstream.searchParams.get('ref')).toBe(ref);
    if (kind === 'tree') expect(upstream.searchParams.get('path')).toBe(requestedPath || null);
    else expect(decodeURIComponent(upstream.pathname)).toContain(requestedPath);
  });

  test('真实 HTTP：手册提交历史与服务账号访问投影不暴露凭据，个人授权入口明确拒绝', async () => {
    const response = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/commits?ref=master`, { headers: { cookie: readerCookie } });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([{ sha: 'commit-full-sha', shortSha: 'commit1', title: '修订文档', message: '修订正文与目录', authorName: '测试作者', authoredDate: '2026-01-01T00:00:00Z', webUrl: 'https://example.test/commit/1' }]);
    const upstream = new URL(upstreamRequests.at(-1), gitlabUrl);
    expect(upstream.searchParams.get('ref_name')).toBe('master');
    expect(upstream.searchParams.get('page')).toBe('1');
    const status = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/access-status`, { headers: { cookie: readerCookie } });
    expect(status.status).toBe(200);
    const projection = await status.json();
    expect(projection.data).toMatchObject({ authMode: 'service_account', connected: true, canRead: true, nextAction: null });
    expect(JSON.stringify(projection)).not.toMatch(/test-only-token|local_read|credentialRef/);
    const start = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/oauth/start`, { headers: { cookie: readerCookie }, redirect: 'manual' });
    expect(start.status).toBe(409);
    expect((await start.json()).error.code).toBe('GITLAB_OAUTH_NOT_REQUIRED');
  });

  test('真实 HTTP：未知GitLab读取路由返回明确404且不访问上游', async () => {
    const before = upstreamRequests.length;
    const response = await fetch(`${baseUrl}/knowledge-center/api/gitlab/unknown-read`, { headers: { cookie: readerCookie } });
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('GITLAB_ROUTE_NOT_FOUND');
    expect(upstreamRequests).toHaveLength(before);
  });

  test('真实 HTTP：手册个人OAuth入口支持默认与指定返回路径，停用后访问投影不可读', async () => {
    const mappingUrl = `${baseUrl}/knowledge-center/api/gitlab/mappings/DB-001`;
    const original = (await (await fetch(mappingUrl, { headers: { cookie: adminCookie } })).json()).data;
    const configured = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'POST', headers: { cookie: adminCookie, 'content-type': 'application/json', 'idempotency-key': 'handbook-oauth-route' },
      body: JSON.stringify({ name: 'handbook-personal-route', host: gitlabUrl, project: 'cod-doc/personal-route', mode: 'sandbox', authMode: 'user_oauth', purpose: 'read' }),
    });
    expect(configured.status).toBe(200);
    const connection = (await configured.json()).data;
    const saveMapping = async (mapping, key) => {
      const response = await fetch(mappingUrl, { method: 'PUT', headers: { cookie: adminCookie, 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify(mapping) });
      expect(response.status).toBe(200);
    };
    try {
      await saveMapping({ ...original, connectionId: connection.id }, 'handbook-oauth-map');
      for (const query of ['', '?returnTo=%2Fknowledge-center%2Fplatform%3Ftab%3Dgitlab']) {
        const start = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/oauth/start${query}`, { headers: { cookie: readerCookie }, redirect: 'manual' });
        expect(start.status).toBe(302);
        const target = new URL(start.headers.get('location'));
        expect(target.origin).toBe(gitlabUrl);
        expect(target.pathname).toBe('/oauth/authorize');
        expect(target.searchParams.get('state')).toBeTruthy();
        expect(target.searchParams.get('client_id')).toBe('http-client');
        expect(target.searchParams.get('response_type')).toBe('code');
        expect(target.toString()).not.toContain('http-secret');
      }
      const disabled = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections/${connection.id}/disable`, {
        method: 'POST', headers: { cookie: adminCookie, 'idempotency-key': 'handbook-oauth-disable' },
      });
      expect(disabled.status).toBe(200);
      const response = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/access-status`, { headers: { cookie: readerCookie } });
      expect(response.status).toBe(200);
      expect((await response.json()).data).toMatchObject({ connected: false, canRead: false, nextAction: 'contact_admin' });
    } finally {
      await saveMapping(original, 'handbook-oauth-restore');
    }
  });

  test('review repository context returns mapped tree, Markdown and staged timing through HTTP', async () => {
    const endpoint = `${baseUrl}/knowledge-center/api/review/repository-context?handbookId=DB-001`;
    const response = await fetch(endpoint, { headers: { cookie: readerCookie } });
    expect(response.status).toBe(200);
    expect(response.headers.get('server-timing')).toMatch(/metadata;dur=.*branches;dur=.*tree;dur=.*file;dur=.*repository-context;dur=/);
    const result = (await response.json()).data;
    expect(result).toMatchObject({ status: 'ok', handbookId: 'DB-001', handbookName: '数据库手册',
      branch: 'master', language: 'zh', languages: { zh: true, en: false }, commitSha: 'abcdef123456',
      file: { content: '# 产品文档', commitId: 'abcdef123456' } });
    expect(result.tree).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'doc/产品文档/_index.md' })]));
    expect(result.requestedPath).toBe('doc/产品文档/_index.md');
    const english = await fetch(`${endpoint}&language=en`, { headers: { cookie: readerCookie } });
    expect(english.status).toBe(404);
    await expect(english.json()).resolves.toMatchObject({ error: { code: 'GITLAB_LANGUAGE_NOT_MAPPED' } });
    const branch = await fetch(`${endpoint}&branch=unapproved`, { headers: { cookie: readerCookie } });
    expect(branch.status).toBe(403);
    await expect(branch.json()).resolves.toMatchObject({ error: { code: 'GITLAB_BRANCH_NOT_ALLOWED' } });
    const absentFile = await fetch(`${endpoint}&preferredPath=${encodeURIComponent('doc/产品文档/missing.md')}`, { headers: { cookie: readerCookie } });
    expect(absentFile.status).toBe(200);
    const absentContext = (await absentFile.json()).data;
    expect(absentContext).toMatchObject({ status: 'ok', file: null, error: { code: 'GITLAB_NOT_FOUND' }, requestedPath: 'doc/产品文档/missing.md' });
    expect(absentContext.tree).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'doc/产品文档/_index.md' })]));
  });

  test('connection verification persists its latest result in the admin projection', async () => {
    const configured = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'POST', headers: { cookie: adminCookie, 'content-type': 'application/json', 'idempotency-key': 'http-verify-connection' },
      body: JSON.stringify({ name: 'verify-yasdoc', baseUrl: gitlabUrl, projectPath: 'cod-doc/yasdoc', mode: 'sandbox', credentialRef: 'local_read', authMode: 'service_account', purpose: 'read' })
    });
    expect(configured.status).toBe(200);
    const connection = (await configured.json()).data;

    const verified = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections/${encodeURIComponent(connection.id)}/verify`, { method: 'POST', headers: { cookie: adminCookie } });
    expect(verified.status).toBe(200);
    await expect(verified.json()).resolves.toMatchObject({ data: { connectionId: connection.id, status: 'verified', branchCount: 1 } });

    const listed = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, { headers: { cookie: adminCookie } });
    const item = (await listed.json()).data.items.find(candidate => candidate.id === connection.id);
    expect(item).toMatchObject({ authMode: 'service_account', purpose: 'read', status: 'verified', managementStatus: 'active', verificationStatus: 'verified', lastVerification: { status: 'verified', branchCount: 1 } });
    expect(item.lastVerification.verifiedAt).toBeTruthy();
  });

  test('administrator edits, disables and enables an isolated connection', async () => {
    const createdResponse = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'POST', headers: { cookie: adminCookie, 'content-type': 'application/json', 'idempotency-key': 'http-lifecycle-create' },
      body: JSON.stringify({ name: 'lifecycle-docs', baseUrl: gitlabUrl, projectPath: 'cod-doc/original', mode: 'sandbox', credentialRef: 'local_read', authMode: 'service_account', purpose: 'read' })
    });
    const created = (await createdResponse.json()).data;

    const editedResponse = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections/${encodeURIComponent(created.id)}`, {
      method: 'PATCH', headers: { cookie: adminCookie, 'content-type': 'application/json', 'idempotency-key': 'http-lifecycle-edit' },
      body: JSON.stringify({ projectPath: 'cod-doc/edited', purpose: 'read_write' })
    });
    expect(editedResponse.status).toBe(200);
    await expect(editedResponse.json()).resolves.toMatchObject({ data: { id: created.id, projectPath: 'cod-doc/edited', purpose: 'read_write', authMode: 'service_account' } });

    const disabled = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections/${encodeURIComponent(created.id)}/disable`, { method: 'POST', headers: { cookie: adminCookie } });
    await expect(disabled.json()).resolves.toMatchObject({ data: { status: 'disabled' } });
    const rejected = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections/${encodeURIComponent(created.id)}/verify`, { method: 'POST', headers: { cookie: adminCookie } });
    expect(rejected.status).toBe(409);
    await expect(rejected.json()).resolves.toMatchObject({ error: { code: 'GITLAB_CONNECTION_INACTIVE' } });

    const enabled = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections/${encodeURIComponent(created.id)}/enable`, { method: 'POST', headers: { cookie: adminCookie } });
    await expect(enabled.json()).resolves.toMatchObject({ data: { id: created.id } });
  });

  test('connection verification persists structured upstream failures', async () => {
    const configured = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'POST', headers: { cookie: adminCookie, 'content-type': 'application/json', 'idempotency-key': 'http-failed-connection' },
      body: JSON.stringify({ name: 'failed-yasdoc', baseUrl: gitlabUrl, projectPath: 'cod-doc/yasdoc', mode: 'sandbox', authMode: 'user_oauth', purpose: 'read' })
    });
    const connection = (await configured.json()).data;
    const failed = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections/${encodeURIComponent(connection.id)}/verify`, { method: 'POST', headers: { cookie: adminCookie } });
    expect(failed.status).toBe(401);
    await expect(failed.json()).resolves.toMatchObject({ error: { code: 'GITLAB_OAUTH_REQUIRED', message: '请先连接 GitLab 账号' } });

    const listed = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, { headers: { cookie: adminCookie } });
    const item = (await listed.json()).data.items.find(candidate => candidate.id === connection.id);
    expect(item).toMatchObject({ status: 'failed', lastVerification: { status: 'failed', error: { code: 'GITLAB_OAUTH_REQUIRED', message: '请先连接 GitLab 账号' } } });
  });

  async function login(username, password) {
    const response = await fetch(`${baseUrl}/knowledge-center/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    expect(response.status).toBe(200);
    const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
    expect(cookie).toMatch(/^kc_session=/);
    return cookie;
  }
});
