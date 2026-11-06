const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const XLSX = require('../../../runtime/agent-runner/node_modules/xlsx');

const runtimeRoot = path.resolve(__dirname, '../../../runtime/test-results');

describe('平台团队和人员目录真实 HTTP 覆盖', () => {
  let root, server, base, domainStore;
  beforeAll(async () => {
    fs.mkdirSync(runtimeRoot, { recursive: true });
    root = fs.mkdtempSync(path.join(runtimeRoot, 'platform-directory-http-'));
    for (const name of ['template.xlsx', 'sample.xlsx']) fs.writeFileSync(path.join(root, name), 'fixture');
    domainStore = {
      readTeamGroups: jest.fn(async input => ({ items: [{ id: 'team-a', groupType: input.groupType }] })),
      createTeamGroup: jest.fn(async (body, key) => ({ id: 'team-new', name: body.name, key })),
      readTeamGroup: jest.fn(async id => ({ id, name: '技术小组' })),
      replaceTeamRoster: jest.fn(async (id, body, version, key) => ({ id, members: body.members, rowVersion: version, key })),
      readPrincipalsAsync: jest.fn(async input => ({ items: [{ id: 'person-a', q: input?.q || '' }] })),
      createPrincipal: jest.fn(async body => ({ id: 'person-new', ...body })),
      updatePrincipal: jest.fn(async (id, body) => ({ id, ...body })),
      importPrincipals: jest.fn(async upload => ({ imported: upload.items.length })),
    };
    const handler = createKnowledgeCenterHandler({
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, KNOWLEDGE_CENTER_ENTRY: 'index.html',
        OUTLINE_TEMPLATE_PATH: path.join(root, 'template.xlsx'), OUTLINE_SAMPLE_PATH: path.join(root, 'sample.xlsx'),
        PINGCODE_PREFIX: '/pingcode', PINGCODE_ROOT: root, GITLAB_CONFIG_PATH: path.join(root, 'gitlab.json'),
        GITLAB_DOCUMENT_TYPES_PATH: path.join(root, 'rules.json') },
      stores: { knowledgeAssetsStore: { readAsync: async () => ({ handbooks: [] }), read: () => ({ handbooks: [] }) },
        manualStatusStore: { read: () => ({ statuses: {} }) }, brandIconStore: {}, domainStore },
      moduleRegistry: { get: name => name === 'auth' ? { authorize: async req => ({ user: { id: 'admin' },
        roles: [req.headers['x-test-role'] || 'PLATFORM_ADMIN'] }) } : null },
      sendFile(_file, res) { res.writeHead(404); res.end(); },
      proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
    });
    server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/knowledge-center/api/platform`;
  });
  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  const call = (route, method = 'GET', body, headers = {}) => fetch(`${base}${route}`, { method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined });
  const workbook = rows => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['姓名', 'CAS登录名', '状态'], ...rows]), '人员名单');
    return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
  };
  const upload = (mode, rows, filename = 'personnel.xlsx') => {
    const form = new FormData();
    form.append('file', new Blob([workbook(rows)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
    return fetch(`${base}/principals/import?mode=${encodeURIComponent(mode)}`, { method: 'POST', body: form });
  };

  test('非管理员无法读取团队和人员目录', async () => {
    expect((await call('/team-groups', 'GET', null, { 'x-test-role': 'KNOWLEDGE_EDITOR' })).status).toBe(403);
    expect((await call('/principals', 'GET', null, { 'x-test-role': 'KNOWLEDGE_EDITOR' })).status).toBe(403);
    expect(domainStore.readTeamGroups).not.toHaveBeenCalled();
    expect(domainStore.readPrincipalsAsync).not.toHaveBeenCalled();
  });

  test('团队列表、创建、详情和名册预览保留路由契约', async () => {
    const list = await call('/team-groups?groupType=BUSINESS');
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ data: { items: [{ groupType: 'BUSINESS' }] } });
    expect(domainStore.readTeamGroups).toHaveBeenCalledWith({ groupType: 'BUSINESS' });
    const noKey = await call('/team-groups', 'POST', { name: '新小组' });
    expect(noKey.status).toBe(400);
    expect(await noKey.json()).toMatchObject({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED' } });
    const created = await call('/team-groups', 'POST', { name: '新小组' }, { 'idempotency-key': 'key-a' });
    expect(created.status).toBe(201);
    expect(domainStore.createTeamGroup).toHaveBeenCalledWith({ name: '新小组', actor: 'admin' }, 'key-a');
    const detail = await call('/team-groups/team-a');
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ data: { id: 'team-a' } });
    const preview = await call('/team-groups/team-a/roster/preview', 'POST', { members: ['person-a'] });
    expect(preview.status).toBe(200);
    expect(preview.headers.get('deprecation')).toBe('true');
    expect(await preview.json()).toMatchObject({ data: { deprecated: true, unfinishedTaskCount: 0 } });
  });

  test('团队名册需要幂等键并转发版本头与操作者', async () => {
    const missing = await call('/team-groups/team-a/roster', 'PUT', { members: ['person-a'] });
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED' } });
    const saved = await call('/team-groups/team-a/roster', 'PUT', { members: ['person-a'], rowVersion: 'body-v1' },
      { 'idempotency-key': 'key-b', 'if-match': 'header-v2' });
    expect(saved.status).toBe(200);
    expect(domainStore.replaceTeamRoster).toHaveBeenCalledWith('team-a',
      { members: ['person-a'], rowVersion: 'body-v1', actor: 'admin' }, 'header-v2', 'key-b');
    expect((await call('/team-groups/team-a/roster', 'GET')).status).toBe(405);
  });

  test('人员列表、创建、更新和方法门禁均经过真实 HTTP', async () => {
    const list = await call('/principals?q=张&state=active&bindingStatus=bound');
    expect(list.status).toBe(200);
    expect(domainStore.readPrincipalsAsync).toHaveBeenCalledWith({ q: '张', state: 'active', bindingStatus: 'bound' });
    const created = await call('/principals', 'POST', { displayName: '张三' });
    expect(created.status).toBe(201);
    expect(domainStore.createPrincipal).toHaveBeenCalledWith({ displayName: '张三', actor: 'admin' });
    const changed = await call('/principals/person-a', 'PATCH', { displayName: '张四' });
    expect(changed.status).toBe(200);
    expect(domainStore.updatePrincipal).toHaveBeenCalledWith('person-a', { displayName: '张四', actor: 'admin' });
    expect((await call('/principals/person-a')).status).toBe(405);
    expect((await call('/principals', 'DELETE')).status).toBe(405);
  });

  test('团队和人员服务已知错误映射为公开状态和错误码', async () => {
    domainStore.readTeamGroup.mockRejectedValueOnce(Object.assign(new Error('团队不存在'), { status: 404, code: 'TEAM_NOT_FOUND' }));
    const team = await call('/team-groups/missing');
    expect(team.status).toBe(404);
    expect(await team.json()).toMatchObject({ error: { code: 'TEAM_NOT_FOUND' } });
    domainStore.updatePrincipal.mockRejectedValueOnce(Object.assign(new Error('版本冲突'), { status: 409, code: 'PRINCIPAL_CONFLICT' }));
    const principal = await call('/principals/person-a', 'PATCH', { displayName: '冲突' });
    expect(principal.status).toBe(409);
    expect(await principal.json()).toMatchObject({ error: { code: 'PRINCIPAL_CONFLICT' } });
  });

  test('人员模板和真实 Excel multipart 预检、应用保留摘要和操作者', async () => {
    const template = await call('/principals/template');
    expect(template.status).toBe(200);
    expect(template.headers.get('content-type')).toContain('spreadsheetml.sheet');
    expect((await template.arrayBuffer()).byteLength).toBeGreaterThan(100);
    const rows = [['新人员', 'new-login', 'ACTIVE']];
    const preview = await upload('preview', rows);
    expect(preview.status).toBe(200);
    expect(await preview.json()).toMatchObject({ data: { filename: 'personnel.xlsx', summary: { total: 1, add: 1, conflict: 0 } } });
    const applied = await upload('apply', rows);
    expect(applied.status).toBe(200);
    expect(await applied.json()).toMatchObject({ data: { directory: { imported: 1 }, importSummary: { add: 1 } } });
    expect(domainStore.importPrincipals).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'personnel.xlsx', sourceSha256: expect.stringMatching(/^[a-f0-9]{64}$/), actor: 'admin',
      items: [{ displayName: '新人员', casLoginName: 'new-login', state: 'ACTIVE' }],
    }));
  });

  test('人员导入冲突、错误模式和非法上传在 HTTP 边界拒绝', async () => {
    const writesBefore = domainStore.importPrincipals.mock.calls.length;
    domainStore.readPrincipalsAsync.mockResolvedValueOnce({ items: [{ principalId: 'person-a', displayName: '原姓名', casLoginName: 'used', state: 'ACTIVE' }] });
    const conflict = await upload('apply', [['错误姓名', 'used', 'ACTIVE']]);
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ error: { code: 'PERSONNEL_IMPORT_CONFLICT' } });
    const mode = await upload('unknown', [['新人员', 'new-login', 'ACTIVE']]);
    expect(mode.status).toBe(422);
    expect(await mode.json()).toMatchObject({ error: { code: 'PERSONNEL_IMPORT_MODE_INVALID' } });
    const invalid = await call('/principals/import', 'POST', { items: [] });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: { code: 'PERSONNEL_INVALID_UPLOAD' } });
    const wrongFormat = await upload('preview', [['新人员', 'new-login', 'ACTIVE']], 'people.csv');
    expect(wrongFormat.status).toBe(415);
    expect(await wrongFormat.json()).toMatchObject({ error: { code: 'PERSONNEL_FORMAT_UNSUPPORTED' } });
    const brokenForm = new FormData();
    brokenForm.append('file', new Blob(['not-an-excel']), 'broken.xlsx');
    const broken = await fetch(`${base}/principals/import`, { method: 'POST', body: brokenForm });
    expect(broken.status).toBe(422);
    expect((await broken.json()).error.code).toMatch(/^PERSONNEL_(FILE|HEADERS)_INVALID$/);
    const wrongFieldForm = new FormData();
    wrongFieldForm.append('upload', new Blob([workbook([['新人员', 'new-login', 'ACTIVE']])]), 'personnel.xlsx');
    const wrongField = await fetch(`${base}/principals/import`, { method: 'POST', body: wrongFieldForm });
    expect(wrongField.status).toBe(415);
    expect(await wrongField.json()).toMatchObject({ error: { code: 'PERSONNEL_FORMAT_UNSUPPORTED' } });
    const emptyForm = new FormData();
    const noFile = await fetch(`${base}/principals/import`, { method: 'POST', body: emptyForm });
    expect(noFile.status).toBe(400);
    expect(await noFile.json()).toMatchObject({ error: { code: 'PERSONNEL_FILE_REQUIRED' } });
    expect(domainStore.importPrincipals).toHaveBeenCalledTimes(writesBefore);
  });
});
