const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');

const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const runtimeRoot = path.resolve(__dirname, '../../../runtime/test-results');

describe('审核冻结图片的真实 HTTP 读取', () => {
  let root, server, gitlab, base, configPath, task, frozenBytes, gitlabBytes;
  let previousToken, previousStorageMode, previousPlatformMode;

  beforeEach(async () => {
    fs.mkdirSync(runtimeRoot, { recursive: true });
    root = fs.mkdtempSync(path.join(runtimeRoot, 'review-resource-http-'));
    configPath = path.join(root, 'gitlab.json');
    fs.writeFileSync(path.join(root, 'template.xlsx'), 'fixture');
    fs.writeFileSync(path.join(root, 'sample.xlsx'), 'fixture');
    previousStorageMode = process.env.KNOWLEDGE_STORAGE_MODE;
    previousPlatformMode = process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE;
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE = 'file';
    previousToken = process.env.GITLAB_TOKEN_review_resource_test;
    process.env.GITLAB_TOKEN_review_resource_test = 'fixture-token';
    frozenBytes = image;
    gitlabBytes = image;
    gitlab = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      if (req.headers['private-token'] !== 'fixture-token') { res.writeHead(401); res.end(); return; }
      if (!url.pathname.includes('/repository/files/') || url.searchParams.get('ref') !== 'frozen-sha') { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ encoding: 'base64', content: gitlabBytes.toString('base64'), commit_id: 'frozen-sha' }));
    });
    await new Promise(resolve => gitlab.listen(0, '127.0.0.1', resolve));
    const connection = {
      id: 'review-fixture', host: `http://127.0.0.1:${gitlab.address().port}`,
      project: 'group/docs', purpose: 'read_write', status: 'active', credentialRef: 'review_resource_test',
    };
    fs.writeFileSync(configPath, JSON.stringify({
      connections: [connection],
      mappings: [{ handbookId: 'HB-1', connectionId: connection.id, defaultBranch: 'main', enabledBranches: ['main'], zhPaths: ['docs'], enPaths: [] }],
    }));
    const resource = { path: 'docs/images/new.png', delivery: 'create', size: image.length, contentDigest: digest(image) };
    task = {
      id: 'review-1', handbookId: 'HB-1', candidate: { digest: 'candidate-1' },
      handbookSource: {
        branch: 'main', commitSha: 'frozen-sha',
        repositoryIdentity: { connectionId: connection.id, host: connection.host, project: connection.project },
        documents: [{ documentId: 'doc-1', filePath: 'docs/a.md', resources: [resource] }],
      },
    };
    const session = { authenticated: true, user: { id: 'reader' }, allowedActions: ['knowledge:read'] };
    const handler = createKnowledgeCenterHandler({
      config: {
        KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root,
        KNOWLEDGE_CENTER_ENTRY: 'index.html', GITLAB_CONFIG_PATH: configPath,
        OUTLINE_TEMPLATE_PATH: path.join(root, 'template.xlsx'), OUTLINE_SAMPLE_PATH: path.join(root, 'sample.xlsx'),
      },
      stores: {
        knowledgeAssetsStore: { read: () => ({ handbooks: [{ handbookId: 'HB-1', status: 'content_building' }] }) },
        manualStatusStore: {}, brandIconStore: {}, domainStore: {},
      },
      moduleRegistry: { get: name => name === 'auth' ? { authorize: async req => req.headers['x-test-user'] === 'hidden'
        ? { ...session, visibleHandbookIds: ['other'] } : session } : null },
      handleIncrementalBuild: { service: {
        readState: async () => ({ tasks: [task] }), get: (_session, id) => id === task.id ? task : null,
      } },
      handbookProductionService: { delivery: { readFrozen: () => frozenBytes } },
      sendFile(_file, response) { response.writeHead(404); response.end(); },
    });
    server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/knowledge-center/api/incremental-tasks`;
  });

  afterEach(async () => {
    if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
    if (gitlab) await new Promise(resolve => { gitlab.closeAllConnections(); gitlab.close(resolve); });
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (previousToken === undefined) delete process.env.GITLAB_TOKEN_review_resource_test;
    else process.env.GITLAB_TOKEN_review_resource_test = previousToken;
    if (previousStorageMode === undefined) delete process.env.KNOWLEDGE_STORAGE_MODE;
    else process.env.KNOWLEDGE_STORAGE_MODE = previousStorageMode;
    if (previousPlatformMode === undefined) delete process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE;
    else process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE = previousPlatformMode;
  });

  const request = (id = 'review-1', changes = {}, headers = {}) => {
    const params = new URLSearchParams({ candidateDigest: 'candidate-1', documentId: 'doc-1', path: 'docs/images/new.png', ...changes });
    return fetch(`${base}/${id}/resources?${params}`, { headers });
  };
  const errorCode = async response => (await response.json()).error?.code;

  test('returns frozen bytes with private image headers and enforces visibility', async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(image);
    const hidden = await request('review-1', {}, { 'x-test-user': 'hidden' });
    expect(hidden.status).toBe(403);
    expect(await errorCode(hidden)).toBe('HANDBOOK_READ_FORBIDDEN');
  });

  test('rejects missing tasks, stale candidates and images outside the frozen document', async () => {
    const missing = await request('missing');
    expect(missing.status).toBe(404);
    expect(await errorCode(missing)).toBe('REVIEW_RESOURCE_NOT_FOUND');
    const stale = await request('review-1', { candidateDigest: 'old' });
    expect(stale.status).toBe(409);
    expect(await errorCode(stale)).toBe('CANDIDATE_CHANGED');
    const alien = await request('review-1', { path: 'docs/images/other.png' });
    expect(alien.status).toBe(404);
    expect(await errorCode(alien)).toBe('REVIEW_RESOURCE_NOT_FOUND');
  });

  test('requires the same mapped repository and a matching frozen image', async () => {
    task.handbookSource.repositoryIdentity.project = 'other/project';
    const changed = await request();
    expect(changed.status).toBe(409);
    expect(await errorCode(changed)).toBe('REVIEW_MAPPING_CHANGED');
    task.handbookSource.repositoryIdentity.project = 'group/docs';
    frozenBytes = Buffer.from('changed');
    const drift = await request();
    expect(drift.status).toBe(409);
    expect(await errorCode(drift)).toBe('GITLAB_RESOURCE_SNAPSHOT_CHANGED');
    frozenBytes = image;
    task.handbookSource.documents[0].resources[0].contentDigest = digest(Buffer.from('not-image'));
    task.handbookSource.documents[0].resources[0].size = 9;
    frozenBytes = Buffer.from('not-image');
    const invalid = await request();
    expect(invalid.status).toBe(415);
    expect(await errorCode(invalid)).toBe('GITLAB_RESOURCE_TYPE_NOT_ALLOWED');
  });

  test('reads existing images from the pinned GitLab commit', async () => {
    const resource = task.handbookSource.documents[0].resources[0];
    resource.path = 'docs/images/existing.png';
    resource.delivery = 'existing';
    let response = await request('review-1', { path: resource.path });
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(image);
    task.handbookSource.commitSha = '';
    response = await request('review-1', { path: resource.path });
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe('GITLAB_RESOURCE_SNAPSHOT_CHANGED');
  });
});
