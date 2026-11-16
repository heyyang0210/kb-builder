const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');

describe('生产进展年度工作日历真实 HTTP 路由', () => {
  let root, server, base, authorized;
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'production-work-calendar-http-'));
    const book = path.join(root, 'fixture.xlsx'); fs.writeFileSync(book, 'fixture');
    authorized = true;
    const handler = createKnowledgeCenterHandler({
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, KNOWLEDGE_CENTER_ENTRY: 'index.html',
        OUTLINE_TEMPLATE_PATH: book, OUTLINE_SAMPLE_PATH: book, GITLAB_CONFIG_PATH: path.join(root, 'gitlab.json'),
        GITLAB_DOCUMENT_TYPES_PATH: path.join(root, 'rules.json') },
      stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [] }), readAsync: async () => ({ handbooks: [] }) },
        manualStatusStore: { read: () => ({ statuses: {} }) }, brandIconStore: {}, domainStore: {} },
      moduleRegistry: { get: name => name === 'auth' ? { authorize: async () => authorized ? { user: { id: 'reader' } } : null } : null },
      sendFile(_file, res) { res.writeHead(404); res.end(); }, proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
    });
    server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/knowledge-center/api/production/work-calendar`;
  });
  afterAll(async () => {
    if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  test('登录会话读取年度真实配置和来源', async () => {
    const response = await fetch(`${base}?year=2026`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { year: 2026, configured: true,
      source: { documentNumber: '国办发明电〔2025〕7号' }, days: { '2026-02-14': 'workday', '2026-02-15': 'holiday' } } });
  });

  test('未登录拒绝读取，未配置年份返回显式状态', async () => {
    authorized = false;
    const denied = await fetch(`${base}?year=2026`);
    expect(denied.status).toBe(401);
    authorized = true;
    expect(await (await fetch(`${base}?year=2025`)).json()).toMatchObject({ success: true, data: { year: 2025, configured: false } });
  });

  test('拒绝无效年份', async () => {
    const response = await fetch(`${base}?year=not-a-year`);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'WORK_CALENDAR_YEAR_INVALID' } });
  });
});
