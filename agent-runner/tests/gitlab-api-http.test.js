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
      const admin = String(req.headers.cookie || '').includes('admin');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ content: { user: { id: admin ? 'admin' : 'reader' }, roles: admin ? ['PLATFORM_ADMIN'] : ['AUTHOR'], allowedActions: admin ? ['platform:manage'] : [] } }));
    });
    await new Promise(resolve => authServer.listen(0, '127.0.0.1', resolve));
    process.env.KNOWLEDGE_CENTER_AUTH_PORT = String(authServer.address().port);
    process.env.KNOWLEDGE_ASSETS_CONFIG = assets;
    process.env.KNOWLEDGE_CENTER_GITLAB_CONFIG = path.join(tempRoot, 'gitlab.json');
    process.env.KNOWLEDGE_CENTER_GITLAB_ALLOWED_HOSTS = 'git-tools.yasdb.com,127.0.0.1';
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
    delete process.env.GITLAB_TOKEN_local_read;
  });

  test('ordinary users cannot enumerate or freely browse connections', async () => {
    const response = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections`, { headers: { cookie: 'reader=1' } });
    expect(response.status).toBe(403);
    const direct = await fetch(`${baseUrl}/knowledge-center/api/gitlab/connections/unknown/tree`, { headers: { cookie: 'reader=1' } });
    expect(direct.status).toBe(403);
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
});
