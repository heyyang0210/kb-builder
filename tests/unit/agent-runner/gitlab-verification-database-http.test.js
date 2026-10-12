const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');

describe('数据库配置模式 GitLab 验证运行时事实 HTTP 回归', () => {
  let root, upstream, server, baseUrl, connection;
  let upstreamStatus = 200;
  const previousEnv = {};
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'gitlab-verification-'));
    for (const [key, value] of Object.entries({ KNOWLEDGE_PLATFORM_CONFIG_MODE: 'database', KNOWLEDGE_CENTER_GITLAB_VERIFICATION_STORE: path.join(root, 'results.json'), GITLAB_TOKEN_verify_test: 'isolated-token' })) {
      previousEnv[key] = process.env[key]; process.env[key] = value;
    }
    upstream = http.createServer((req, res) => {
      expect(req.headers['private-token']).toBe('isolated-token');
      res.writeHead(upstreamStatus, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(upstreamStatus === 200 ? [{ name: 'main' }] : { message: '没有仓库读取权限' }));
    });
    await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
    connection = { id: 'db-repo', host: `http://127.0.0.1:${upstream.address().port}`, project: 'group/docs', mode: 'sandbox', authMode: 'service_account', credentialRef: 'verify_test', status: 'active' };
    await startServer();
  });
  async function startServer() {
    const handler = createKnowledgeCenterHandler({
      config: {
        KNOWLEDGE_CENTER_PREFIX: '/knowledge-center',
        OUTLINE_TEMPLATE_PATH: path.resolve('大纲模板.xlsx'),
        OUTLINE_SAMPLE_PATH: path.resolve('基本数据库管理手册大纲示例.xlsx'),
      },
      stores: { domainStore: { readPlatformGitLabConnections: () => ({ items: [{ ...connection }] }), readPlatformGitLabConnection: () => ({ ...connection }) } },
      modules: { auth: { authorize: async () => ({ user: { id: 'test-admin', roles: ['PLATFORM_ADMIN'] }, roles: ['PLATFORM_ADMIN'] }) } },
    });
    server = http.createServer((req, res) => handler(req, res));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/knowledge-center/api/gitlab/connections`;
  }
  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (upstream) await new Promise(resolve => upstream.close(resolve));
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });
  test('验证成功在列表与服务重建后保留且不暴露凭证', async () => {
    const response = await fetch(`${baseUrl}/db-repo/verify`, { method: 'POST' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { status: 'verified', branchCount: 1 } });
    await new Promise(resolve => server.close(resolve));
    await startServer();
    const responseBody = await (await fetch(baseUrl)).json();
    expect(responseBody).toMatchObject({ data: { items: [{ status: 'verified', lastVerification: { status: 'verified', branchCount: 1 } }] } });
    expect(JSON.stringify(responseBody)).not.toContain('verify_test');
  });
  test('失败返回原因与修复建议，刷新后保留失败', async () => {
    upstreamStatus = 403;
    const response = await fetch(`${baseUrl}/db-repo/verify`, { method: 'POST' });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'GITLAB_FORBIDDEN', details: { recovery: expect.stringContaining('授予仓库读取权限') } } });
    expect(await (await fetch(baseUrl)).json()).toMatchObject({ data: { items: [{ status: 'failed', lastVerification: { error: { message: '没有仓库读取权限', recovery: expect.stringContaining('授予仓库读取权限') } } }] } });
  });
  test('配置变化后旧结果不再有效', async () => {
    connection.project = 'group/changed';
    expect(await (await fetch(baseUrl)).json()).toMatchObject({ data: { items: [{ status: 'pending', lastVerification: null }] } });
  });
  test('运行时结果无法写入时返回失败及修复建议', async () => {
    fs.renameSync(path.join(root, 'results.json'), path.join(root, 'results-backup.json'));
    fs.mkdirSync(path.join(root, 'results.json'));
    upstreamStatus = 200;
    const response = await fetch(`${baseUrl}/db-repo/verify`, { method: 'POST' });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: 'GITLAB_VERIFICATION_STORE_UNAVAILABLE', details: { recovery: expect.stringContaining('runtime') } } });
  });
});
