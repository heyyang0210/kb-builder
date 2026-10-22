const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const { createTemplateStore } = require('../../../packages/agent-runner-core/lib/template-store');

describe('模板库文件持久化 HTTP 契约', () => {
  let root;
  let server;
  let auth;
  let base;
  let priorMode;
  let priorFile;

  async function request(route, method = 'GET', body, role = 'editor') {
    const response = await fetch(`${base}/knowledge-center/api/templates${route}`, {
      method,
      headers: { cookie: role, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'template-persistence-'));
    priorMode = process.env.KNOWLEDGE_STORAGE_MODE;
    priorFile = process.env.TEMPLATE_STORE_FILE;
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    process.env.TEMPLATE_STORE_FILE = path.join(root, 'templates.json');
    auth = http.createServer((req, res) => {
      const allowedActions = req.headers.cookie === 'editor' ? ['template:read', 'template:edit'] : ['template:read'];
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ content: { allowedActions, user: { id: 'tester' } } }));
    });
    await new Promise(resolve => auth.listen(0, '127.0.0.1', resolve));
    const repositoryRoot = path.resolve(__dirname, '../../..');
    const handler = createKnowledgeCenterHandler({
      config: {
        KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, KNOWLEDGE_CENTER_ENTRY: 'index.html',
        OUTLINE_TEMPLATE_PATH: path.join(repositoryRoot, 'knowledge/outlines/大纲模板.xlsx'),
        OUTLINE_SAMPLE_PATH: path.join(repositoryRoot, 'knowledge/outlines/基本数据库管理手册大纲示例.xlsx'),
        PINGCODE_PREFIX: '/pingcode', PINGCODE_ROOT: root,
        DOCUMENT_API_HOST: '127.0.0.1', DOCUMENT_API_PORT: 1,
        PINGCODE_API_HOST: '127.0.0.1', PINGCODE_API_PORT: 1,
        AUTH_API_HOST: '127.0.0.1', AUTH_API_PORT: auth.address().port,
        PLATFORM_CONTEXT_TIMEOUT_MS: 1000,
        GITLAB_CONFIG_PATH: path.join(root, 'gitlab.json'), GITLAB_DOCUMENT_TYPES_PATH: path.join(root, 'types.json'),
        DATABASE_CONNECTION_CONFIG_PATH: path.join(root, 'database.json'),
      },
      stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [] }) } },
      databaseConnectionGovernance: {}, handbookProductionService: {},
      sendFile(_file, res) { res.writeHead(404); res.end(); },
      proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
    });
    server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    for (const service of [server, auth]) {
      if (service) await new Promise(resolve => { service.closeAllConnections(); service.close(resolve); });
    }
    if (priorMode === undefined) delete process.env.KNOWLEDGE_STORAGE_MODE;
    else process.env.KNOWLEDGE_STORAGE_MODE = priorMode;
    if (priorFile === undefined) delete process.env.TEMPLATE_STORE_FILE;
    else process.env.TEMPLATE_STORE_FILE = priorFile;
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  test('创建和更新后重新构造存储仍可读取正文与历史版本', async () => {
    const created = await request('', 'POST', { id: 'storage-guide', name: '存储指南', content: '# 存储指南' });
    expect(created.status).toBe(201);
    const saved = await request('/storage-guide/save', 'POST', { baseVersion: 1, content: '# 存储指南\n第二版' });
    expect(saved.status).toBe(200);
    const reloaded = createTemplateStore();
    expect(reloaded.get('storage-guide').current.content).toContain('第二版');
    expect(reloaded.getVersion('storage-guide', 1).content).toBe('# 存储指南');
    expect(reloaded.resolveForGeneration('storage-guide')).toMatchObject({
      templateId: 'storage-guide', templateVersion: 2, templateContent: '# 存储指南\n第二版',
    });
    expect(fs.existsSync(process.env.TEMPLATE_STORE_FILE)).toBe(true);
  });

  test('过期版本与无权限修改不能写入文件，停用后不能用于生成', async () => {
    expect((await request('', 'POST', { id: 'conflict-guide', content: '# 初稿' })).status).toBe(201);
    const before = fs.readFileSync(process.env.TEMPLATE_STORE_FILE, 'utf8');
    const forbidden = await request('/conflict-guide/save', 'POST', { baseVersion: 1, content: '# 越权' }, 'reader');
    expect(forbidden.status).toBe(403);
    const conflict = await request('/conflict-guide/save', 'POST', { baseVersion: 2, content: '# 过期' });
    expect(conflict.body.error.code).toBe('TEMPLATE_VERSION_CONFLICT');
    expect(fs.readFileSync(process.env.TEMPLATE_STORE_FILE, 'utf8')).toBe(before);
    const disabled = createTemplateStore().disable('conflict-guide', { user: { id: 'tester' } }, false);
    expect(disabled.status).toBe('disabled');
    expect(() => createTemplateStore().resolveForGeneration('conflict-guide')).toThrow('模板已停用');
    expect(createTemplateStore().disable('conflict-guide', null, true).status).toBe('active');
  });
});
