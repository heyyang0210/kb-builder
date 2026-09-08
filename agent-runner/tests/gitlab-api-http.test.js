const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('GitLab same-origin HTTP API', () => {
  let authServer;
  let frontend;
  let gitlabServer;
  let baseUrl;
  let gitlabUrl;
  let tempRoot;

  beforeAll(async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlab-http-'));
    const assets = path.join(tempRoot, 'assets.json');
    fs.writeFileSync(assets, JSON.stringify({ handbooks: [{ handbookId: 'DB-001', name: '数据库手册' }] }));
    authServer = http.createServer((req, res) => {
      const cookie = String(req.headers.cookie || '');
      const admin = cookie.includes('admin');
      const noRead = cookie.includes('no-read');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ content: { user: { id: admin ? 'admin' : noRead ? 'no-read' : 'reader' }, roles: admin ? ['PLATFORM_ADMIN'] : ['AUTHOR'], allowedActions: admin ? ['platform:manage', 'knowledge:read'] : noRead ? [] : ['knowledge:read'] } }));
    });
    await new Promise(resolve => authServer.listen(0, '127.0.0.1', resolve));
    process.env.KNOWLEDGE_CENTER_AUTH_PORT = String(authServer.address().port);
    process.env.KNOWLEDGE_ASSETS_CONFIG = assets;
    process.env.KNOWLEDGE_CENTER_GITLAB_CONFIG = path.join(tempRoot, 'gitlab.json');
    process.env.KNOWLEDGE_CENTER_GITLAB_ALLOWED_HOSTS = 'git-tools.yasdb.com,127.0.0.1';
    process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID = 'http-client';
    process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET = 'http-secret';
    process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI = 'http://127.0.0.1:13510/knowledge-center/api/gitlab/oauth/callback';
    process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP = 'true';
    process.env.GITLAB_TOKEN_local_read = 'test-only-token';
    gitlabServer = http.createServer((req, res) => {
      if (req.headers['private-token'] !== 'test-only-token') { res.writeHead(401); res.end(JSON.stringify({ message: 'unauthorized' })); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (req.url.includes('/repository/branches')) { res.end(JSON.stringify([{ name: 'master', protected: true, commit: { id: 'abcdef123456' } }])); return; }
      if (req.url.includes('/repository/tree')) { res.end(JSON.stringify([{ name: '基础概念', path: 'doc/产品文档/基础概念', type: 'tree' }, { name: '_index.md', path: 'doc/产品文档/_index.md', type: 'blob' }, { name: 'intro.md', path: 'doc/产品文档/基础概念/intro.md', type: 'blob' }, { name: 'guide.pdf', path: 'doc/产品文档/guide.pdf', type: 'blob' }, { name: 'cover.png', path: 'doc/产品文档/cover.png', type: 'blob' }])); return; }
      res.end(JSON.stringify({ file_path: 'doc/产品文档/_index.md', encoding: 'base64', content: Buffer.from('# 产品文档').toString('base64'), commit_id: 'abcdef123456' }));
    });
    await new Promise(resolve => gitlabServer.listen(0, '127.0.0.1', resolve));
    gitlabUrl = `http://127.0.0.1:${gitlabServer.address().port}`;
    jest.resetModules();
    frontend = require('../frontend-server').server;
    await new Promise(resolve => frontend.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${frontend.address().port}`;
  });

  afterAll(async () => {
    await new Promise(resolve => frontend.close(resolve));
    await new Promise(resolve => authServer.close(resolve));
    await new Promise(resolve => gitlabServer.close(resolve));
    fs.rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.KNOWLEDGE_CENTER_AUTH_PORT;
    delete process.env.KNOWLEDGE_ASSETS_CONFIG;
    delete process.env.KNOWLEDGE_CENTER_GITLAB_CONFIG;
    delete process.env.KNOWLEDGE_CENTER_GITLAB_ALLOWED_HOSTS;
    delete process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID;
    delete process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET;
    delete process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI;
    delete process.env.KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP;
    delete process.env.GITLAB_TOKEN_local_read;
  });

  test('ordinary users cannot enumerate or freely browse connections', async () => {
    const response = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, { headers: { cookie: 'reader=1' } });
    expect(response.status).toBe(403);
    const direct = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections/unknown/tree`, { headers: { cookie: 'reader=1' } });
    expect(direct.status).toBe(403);
  });

  test('knowledge readers can inspect handbook access status without enumerating connections', async () => {
    const configured = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'POST', headers: { cookie: 'admin=1', 'content-type': 'application/json', 'idempotency-key': 'http-access-status' },
      body: JSON.stringify({ name: 'oauth-access', host: gitlabUrl, project: 'cod-doc/access', mode: 'sandbox', authMode: 'user_oauth', purpose: 'read' })
    });
    const connection = (await configured.json()).data;
    const mapped = await fetch(`${baseUrl}/knowledge-center/api/gitlab/mappings/DB-001`, {
      method: 'PUT', headers: { cookie: 'admin=1', 'content-type': 'application/json', 'idempotency-key': 'http-access-mapping' },
      body: JSON.stringify({ connectionId: connection.id, defaultBranch: 'master', enabledBranches: ['master'], zhPaths: ['doc/产品文档'], enPaths: [] })
    });
    expect(mapped.status).toBe(200);
    const access = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/access-status`, { headers: { cookie: 'reader=1' } });
    expect(access.status).toBe(200);
    await expect(access.json()).resolves.toMatchObject({ data: { authMode: 'user_oauth', connected: false, canRead: false, nextAction: 'connect_gitlab' } });
    const connections = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, { headers: { cookie: 'reader=1' } });
    expect(connections.status).toBe(403);
  });

  test('handbook GitLab APIs require knowledge read permission', async () => {
    const access = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/access-status`, { headers: { cookie: 'no-read=1' } });
    expect(access.status).toBe(403);
    await expect(access.json()).resolves.toMatchObject({ error: { code: 'HANDBOOK_READ_FORBIDDEN' } });
  });

  test('administrator changes handbook status through controlled commands', async () => {
    const changed = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks/DB-001/status`, {
      method: 'POST', headers: { cookie: 'admin=1', 'content-type': 'application/json' },
      body: JSON.stringify({ targetStatus: 'content_building', reason: '进入内容建设', expectedVersion: 1 }),
    });
    expect(changed.status).toBe(200);
    await expect(changed.json()).resolves.toMatchObject({ data: { status: 'content_building', manualStatus: 'content_building', assetVersion: 2 } });
    const published = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks/DB-001/status`, {
      method: 'POST', headers: { cookie: 'admin=1', 'content-type': 'application/json' },
      body: JSON.stringify({ targetStatus: 'handbook_published', reason: '尝试直接发布', expectedVersion: 2 }),
    });
    expect(published.status).toBe(409);
    await expect(published.json()).resolves.toMatchObject({ error: { code: 'HANDBOOK_PUBLISH_REQUIRED' } });
  });

  test('administrator configures a connection and handbook mapping with idempotency', async () => {
    const connectionResponse = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'PUT', headers: { cookie: 'admin=1', 'content-type': 'application/json', 'idempotency-key': 'http-connection-1' },
      body: JSON.stringify({ name: 'yasdoc', host: 'https://git-tools.yasdb.com', project: 'cod-doc/yasdoc', mode: 'disabled', credentialRef: 'production-read' })
    });
    expect(connectionResponse.status).toBe(200);
    const connection = (await connectionResponse.json()).data;
    expect(connection.credentialConfigured).toBe(true);
    expect(connection.credentialRef).toBeUndefined();

    const mappingResponse = await fetch(`${baseUrl}/knowledge-center/api/gitlab/mappings/DB-001`, {
      method: 'PUT', headers: { cookie: 'admin=1', 'content-type': 'application/json', 'idempotency-key': 'http-mapping-1' },
      body: JSON.stringify({ connectionId: connection.id, defaultBranch: 'master', enabledBranches: ['master'], zhPaths: ['doc/产品文档'], enPaths: ['doc/Manuals'] })
    });
    expect(mappingResponse.status).toBe(200);
    const body = await mappingResponse.json();
    expect(body.data).toMatchObject({ handbookId: 'DB-001', defaultBranch: 'master' });

    const assetsResponse = await fetch(`${baseUrl}/knowledge-center/api/assets/handbooks`, { headers: { cookie: 'reader=1' } });
    expect(assetsResponse.status).toBe(200);
    await expect(assetsResponse.json()).resolves.toMatchObject({ data: { items: [{ handbookId: 'DB-001', repositoryMapped: true, repository: { status: 'confirmed' } }] } });

    const contentResponse = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/branches`, { headers: { cookie: 'reader=1' } });
    expect(contentResponse.status).toBe(409);
    await expect(contentResponse.json()).resolves.toMatchObject({ error: { code: 'GITLAB_CONNECTOR_DISABLED' } });
  });

  test('mapped reader traverses the real HTTP connector to an authorized GitLab endpoint', async () => {
    const configured = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'PUT', headers: { cookie: 'admin=1', 'content-type': 'application/json', 'idempotency-key': 'http-local-connection' },
      body: JSON.stringify({ name: 'local-yasdoc', host: gitlabUrl, project: 'cod-doc/yasdoc', mode: 'sandbox', credentialRef: 'local_read' })
    });
    expect(configured.status).toBe(200);
    const connection = (await configured.json()).data;
    const mapped = await fetch(`${baseUrl}/knowledge-center/api/gitlab/mappings/DB-001`, {
      method: 'PUT', headers: { cookie: 'admin=1', 'content-type': 'application/json', 'idempotency-key': 'http-local-mapping' },
      body: JSON.stringify({ connectionId: connection.id, defaultBranch: 'master', enabledBranches: ['master'], zhPaths: ['doc/产品文档'], enPaths: [] })
    });
    expect(mapped.status).toBe(200);

    const branches = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/branches`, { headers: { cookie: 'reader=1' } });
    await expect(branches.json()).resolves.toMatchObject({ data: { handbookName: '数据库手册', items: [{ name: 'master', commitSha: 'abcdef123456' }] } });
    const tree = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/tree?ref=master&language=zh`, { headers: { cookie: 'reader=1' } });
    expect((await tree.json()).data).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'doc/产品文档/_index.md' })]));
    const file = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/file?ref=master&language=zh&path=${encodeURIComponent('doc/产品文档/_index.md')}`, { headers: { cookie: 'reader=1' } });
    await expect(file.json()).resolves.toMatchObject({ data: { content: '# 产品文档', commitId: 'abcdef123456' } });
    const statistics = await fetch(`${baseUrl}/knowledge-center/api/gitlab/handbooks/DB-001/statistics?ref=master&language=zh`, { headers: { cookie: 'reader=1' } });
    await expect(statistics.json()).resolves.toMatchObject({ data: { branch: 'master', chapterCount: 1, documentCount: 2, headSha: 'abcdef123456' } });
  });

  test('connection verification persists its latest result in the admin projection', async () => {
    const configured = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'POST', headers: { cookie: 'admin=1', 'content-type': 'application/json', 'idempotency-key': 'http-verify-connection' },
      body: JSON.stringify({ name: 'verify-yasdoc', baseUrl: gitlabUrl, projectPath: 'cod-doc/yasdoc', mode: 'sandbox', credentialRef: 'local_read', authMode: 'service_account', purpose: 'read' })
    });
    expect(configured.status).toBe(200);
    const connection = (await configured.json()).data;

    const verified = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections/${encodeURIComponent(connection.id)}/verify`, { method: 'POST', headers: { cookie: 'admin=1' } });
    expect(verified.status).toBe(200);
    await expect(verified.json()).resolves.toMatchObject({ data: { connectionId: connection.id, status: 'verified', branchCount: 1 } });

    const listed = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, { headers: { cookie: 'admin=1' } });
    const item = (await listed.json()).data.items.find(candidate => candidate.id === connection.id);
    expect(item).toMatchObject({ authMode: 'service_account', purpose: 'read', status: 'verified', managementStatus: 'active', verificationStatus: 'verified', lastVerification: { status: 'verified', branchCount: 1 } });
    expect(item.lastVerification.verifiedAt).toBeTruthy();
  });

  test('administrator edits, disables and enables an isolated connection', async () => {
    const createdResponse = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'POST', headers: { cookie: 'admin=1', 'content-type': 'application/json', 'idempotency-key': 'http-lifecycle-create' },
      body: JSON.stringify({ name: 'lifecycle-docs', baseUrl: gitlabUrl, projectPath: 'cod-doc/original', mode: 'sandbox', credentialRef: 'local_read', authMode: 'service_account', purpose: 'read' })
    });
    const created = (await createdResponse.json()).data;

    const editedResponse = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections/${encodeURIComponent(created.id)}`, {
      method: 'PATCH', headers: { cookie: 'admin=1', 'content-type': 'application/json', 'idempotency-key': 'http-lifecycle-edit' },
      body: JSON.stringify({ projectPath: 'cod-doc/edited', purpose: 'read_write' })
    });
    expect(editedResponse.status).toBe(200);
    await expect(editedResponse.json()).resolves.toMatchObject({ data: { id: created.id, projectPath: 'cod-doc/edited', purpose: 'read_write', authMode: 'service_account' } });

    const disabled = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections/${encodeURIComponent(created.id)}/disable`, { method: 'POST', headers: { cookie: 'admin=1' } });
    await expect(disabled.json()).resolves.toMatchObject({ data: { status: 'disabled' } });
    const rejected = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections/${encodeURIComponent(created.id)}/verify`, { method: 'POST', headers: { cookie: 'admin=1' } });
    expect(rejected.status).toBe(409);
    await expect(rejected.json()).resolves.toMatchObject({ error: { code: 'GITLAB_CONNECTION_INACTIVE' } });

    const enabled = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections/${encodeURIComponent(created.id)}/enable`, { method: 'POST', headers: { cookie: 'admin=1' } });
    await expect(enabled.json()).resolves.toMatchObject({ data: { id: created.id } });
  });

  test('connection verification persists structured upstream failures', async () => {
    const configured = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, {
      method: 'POST', headers: { cookie: 'admin=1', 'content-type': 'application/json', 'idempotency-key': 'http-failed-connection' },
      body: JSON.stringify({ name: 'failed-yasdoc', baseUrl: gitlabUrl, projectPath: 'cod-doc/yasdoc', mode: 'sandbox', authMode: 'user_oauth', purpose: 'read' })
    });
    const connection = (await configured.json()).data;
    const failed = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections/${encodeURIComponent(connection.id)}/verify`, { method: 'POST', headers: { cookie: 'admin=1' } });
    expect(failed.status).toBe(401);
    await expect(failed.json()).resolves.toMatchObject({ error: { code: 'GITLAB_OAUTH_REQUIRED', message: '请先连接 GitLab 账号' } });

    const listed = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, { headers: { cookie: 'admin=1' } });
    const item = (await listed.json()).data.items.find(candidate => candidate.id === connection.id);
    expect(item).toMatchObject({ status: 'failed', lastVerification: { status: 'failed', error: { code: 'GITLAB_OAUTH_REQUIRED', message: '请先连接 GitLab 账号' } } });
  });
});
