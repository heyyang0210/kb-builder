const http = require('http');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');

describe('GitLab 连接保存 HTTP 契约', () => {
  let server, endpoint;
  let saved;
  const originalMode = process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE;
  const auth = { authorize: async () => ({ user: { id: 'admin', roles: ['PLATFORM_ADMIN'] }, roles: ['PLATFORM_ADMIN'] }) };
  beforeAll(async () => {
    process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE = 'database';
    const domainStore = {
      upsertPlatformGitLabConnection: (payload, version) => {
        saved = { payload, version };
        return { ...payload, id: 'test-repo', rowVersion: (version || 0) + 1 };
      },
      readPlatformGitLabConnection: () => ({ ...saved.payload, id: 'test-repo', rowVersion: 1, credentialRef: 'configured_token' }),
    };
    const handler = createKnowledgeCenterHandler({
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', OUTLINE_TEMPLATE_PATH: require('path').resolve('大纲模板.xlsx'), OUTLINE_SAMPLE_PATH: require('path').resolve('基本数据库管理手册大纲示例.xlsx') },
      stores: { domainStore }, modules: { auth },
    });
    server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    endpoint = `http://127.0.0.1:${server.address().port}/knowledge-center/api/gitlab/connections`;
  });
  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (originalMode === undefined) delete process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE;
    else process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE = originalMode;
  });
  const send = (url, method, payload, headers = {}) => fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `test-${Date.now()}-${Math.random()}`, ...headers }, body: JSON.stringify(payload) });
  const basic = { name: 'ydcDoc', baseUrl: 'https://git-tools.yasdb.com/cod-doc/ydcdoc', projectPath: 'cod-doc/ydcdoc', purpose: 'read_write', authMode: 'service_account', credentialRef: 'configured_token' };

  test('缺少默认分支时返回中文字段错误，不产生保存', async () => {
    const response = await send(endpoint, 'POST', basic);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'GITLAB_DEFAULT_BRANCH_REQUIRED', message: '请填写仓库实际使用的默认分支' } });
    expect(saved).toBeUndefined();
  });
  test('完整项目 URL 规范化为站点地址，内部字段补齐', async () => {
    const response = await send(endpoint, 'POST', { ...basic, defaultBranch: 'main' });
    expect(response.status).toBe(200);
    expect(saved).toMatchObject({ payload: { baseUrl: 'https://git-tools.yasdb.com', projectPath: 'cod-doc/ydcdoc', defaultBranch: 'main', mode: 'production', status: 'active' }, version: null });
  });
  test('编辑保留凭证与内部状态，并传递版本号', async () => {
    saved.payload.status = 'inactive';
    const response = await send(`${endpoint}/test-repo`, 'PATCH', { name: 'updated', defaultBranch: 'release' }, { 'If-Match': '1' });
    expect(response.status).toBe(200);
    expect(saved).toMatchObject({ payload: { status: 'inactive', credentialRef: 'configured_token', defaultBranch: 'release' }, version: 1 });
  });
  test('项目路径不匹配时拒绝保存', async () => {
    const response = await send(endpoint, 'POST', { ...basic, projectPath: 'other/docs', defaultBranch: 'main' });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'GITLAB_CONFIG_INVALID', message: expect.stringContaining('项目路径') } });
  });
});
