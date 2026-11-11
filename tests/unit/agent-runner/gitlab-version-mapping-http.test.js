const http = require('node:http');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');

describe('GitLab 版本映射管理 HTTP', () => {
  let server, upstream, base, oldMode;
  const rows = [];
  let nextId = 1;
  const connection = { id: 'repo-1', name: '文档仓库', host: '', project: 'test/docs', mode: 'sandbox', authMode: 'service_account', credentialRef: 'version_mapping_test', status: 'active' };
  beforeAll(async () => {
    oldMode = process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE;
    process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE = 'database';
    process.env.GITLAB_TOKEN_version_mapping_test = 'isolated-token';
    upstream = http.createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify([{ name: 'main' }, { name: 'dev' }])); });
    await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
    connection.host = `http://127.0.0.1:${upstream.address().port}`;
    const domainStore = {
      readPlatformGitLabConnection: () => ({ ...connection }),
      readPlatformGitLabConnections: () => ({ items: [{ ...connection }] }),
      readGitLabVersionMappings: async () => ({ items: rows.filter(row => row.state !== 'deleted' && row.state !== 'archived').map(row => ({ ...row })), archivedItems: rows.filter(row => row.state === 'archived').map(row => ({ ...row })), total: rows.filter(row => row.state !== 'deleted' && row.state !== 'archived').length }),
      resolveGitLabVersionMapping: async (id, product, version) => rows.find(row => row.state === 'active' && row.connectionId === id && row.productCode === product && row.matchKind === 'EXACT' && row.version === version)
        || rows.find(row => row.state === 'active' && row.connectionId === id && row.productCode === product && row.matchKind === 'ALL') || null,
      saveGitLabVersionMapping: async (id, body, rowVersion) => {
        const old = rows.find(row => String(row.id) === String(id));
        if (old && old.rowVersion !== rowVersion) throw Object.assign(new Error('版本冲突'), { status: 409, code: 'ROW_VERSION_CONFLICT' });
        const row = { ...body, id: old?.state === 'draft' ? old.id : nextId++, state: 'draft', rowVersion: 1,
          revisionOfId: old?.state === 'active' ? old.id : old?.revisionOfId || null };
        if (old?.state === 'draft') rows.splice(rows.indexOf(old), 1, row); else rows.push(row);
        return row;
      },
      setGitLabVersionMappingState: async (id, action, rowVersion) => {
        const row = rows.find(item => String(item.id) === String(id));
        if (!row || row.rowVersion !== rowVersion) throw Object.assign(new Error('版本冲突'), { status: 409, code: 'ROW_VERSION_CONFLICT' });
        if (action === 'delete') {
          if (row.state !== 'draft' || rows.some(item => item.revisionOfId === row.id && item.state !== 'deleted'))
            throw Object.assign(new Error('只能删除未引用草案'), { status: 409, code: 'VERSION_MAPPING_CONFLICT' });
          row.state = 'deleted'; row.rowVersion++;
          return { id: row.id, state: row.state };
        }
        if (action === 'archive' || action === 'restore') {
          if (row.state !== (action === 'archive' ? 'disabled' : 'archived'))
            throw Object.assign(new Error('状态不允许归档或恢复'), { status: 409, code: 'VERSION_MAPPING_CONFLICT' });
          row.state = action === 'archive' ? 'archived' : 'disabled'; row.rowVersion++;
          return { id: row.id, state: row.state };
        }
        const old = rows.find(item => item.id === row.revisionOfId);
        if (action === 'activate' && old?.state === 'active') old.state = 'superseded';
        row.state = action === 'activate' ? 'active' : 'disabled'; row.rowVersion++;
        return { ...row };
      },
    };
    const handler = createKnowledgeCenterHandler({ config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', OUTLINE_TEMPLATE_PATH: path.resolve('knowledge/outlines/大纲模板.xlsx'), OUTLINE_SAMPLE_PATH: path.resolve('knowledge/outlines/基本数据库管理手册大纲示例.xlsx') },
      stores: { domainStore }, modules: { auth: { authorize: async req => ({ user: { id: 'admin', roles: req.headers['x-deny'] ? [] : ['PLATFORM_ADMIN'] }, roles: req.headers['x-deny'] ? [] : ['PLATFORM_ADMIN'] }) } }, handbookProductionService: {} });
    server = http.createServer((req, res) => handler(req, res));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/knowledge-center/api/gitlab/version-mappings`;
  });
  afterAll(async () => {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); });
    await new Promise(resolve => { upstream.close(resolve); upstream.closeAllConnections?.(); });
    if (oldMode === undefined) delete process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE; else process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE = oldMode;
    delete process.env.GITLAB_TOKEN_version_mapping_test;
  });
  const request = async (path = '', method = 'GET', body, version, deny = false) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'test-version-mapping', ...(version ? { 'If-Match': String(version) } : {}), ...(deny ? { 'x-deny': '1' } : {}) }, body: body == null ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  test('管理员可创建、修订、核验、预览和停用；非管理员拒绝', async () => {
    expect((await request('', 'GET', null, null, true)).status).toBe(403);
    const created = (await request('', 'POST', { connectionId: 'repo-1', productCode: 'DB', matchKind: 'EXACT', version: '23.4.7', branch: 'main' })).body.data;
    expect(created.state).toBe('draft');
    expect((await request(`/${created.id}/activate`, 'POST', {}, created.rowVersion)).body.data.state).toBe('active');
    const revised = (await request(`/${created.id}`, 'PUT', { connectionId: 'repo-1', productCode: 'DB', matchKind: 'EXACT', version: '23.4.7', branch: 'dev' }, 2)).body.data;
    expect(revised.revisionOfId).toBe(created.id);
    expect((await request('/resolve-preview?connectionId=repo-1&productCode=DB&version=23.4.7')).body.data).toMatchObject({ branch: 'main', branchAvailable: true });
    expect((await request(`/${revised.id}/activate`, 'POST', {}, revised.rowVersion)).body.data.branch).toBe('dev');
    expect((await request('/resolve-preview?connectionId=repo-1&productCode=DB&version=23.4.7')).body.data.branch).toBe('dev');
    expect((await request(`/${revised.id}/disable`, 'POST', {}, 2)).body.data.state).toBe('disabled');
    expect((await request('/resolve-preview?connectionId=repo-1&productCode=DB&version=23.4.7')).body.data).toBeNull();
    const invalid = (await request('', 'POST', { connectionId: 'repo-1', productCode: 'YCM', matchKind: 'ALL', branch: 'missing' })).body.data;
    const blocked = await request(`/${invalid.id}/activate`, 'POST', {}, invalid.rowVersion);
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe('GITLAB_BRANCH_NOT_FOUND');
  });
  test('只能删除草案，拒绝无权与过期版本，删除后不再出现在列表中', async () => {
    const draft = (await request('', 'POST', { connectionId: 'repo-1', productCode: 'DB', matchKind: 'EXACT', version: '25.1', branch: 'main' })).body.data;
    expect((await request(`/${draft.id}/delete`, 'POST', {}, draft.rowVersion, true)).status).toBe(403);
    expect((await request(`/${draft.id}/delete`, 'POST', {}, draft.rowVersion + 1)).status).toBe(409);
    expect((await request(`/${draft.id}/delete`, 'POST', {}, draft.rowVersion)).body.data.state).toBe('deleted');
    expect((await request('', 'GET')).body.data.items.find(row => row.id === draft.id)).toBeUndefined();
    const active = (await request('', 'POST', { connectionId: 'repo-1', productCode: 'DB', matchKind: 'EXACT', version: '25.2', branch: 'main' })).body.data;
    await request(`/${active.id}/activate`, 'POST', {}, active.rowVersion);
    expect((await request(`/${active.id}/delete`, 'POST', {}, active.rowVersion + 1)).status).toBe(409);
  });
  test('已停用规则可归档并缩略展示，恢复后仍为已停用', async () => {
    const draft = (await request('', 'POST', { connectionId: 'repo-1', productCode: 'YDC', matchKind: 'ALL', branch: 'main' })).body.data;
    expect((await request(`/${draft.id}/archive`, 'POST', {}, draft.rowVersion)).status).toBe(409);
    const active = (await request(`/${draft.id}/activate`, 'POST', {}, 1)).body.data;
    expect((await request(`/${draft.id}/archive`, 'POST', {}, active.rowVersion)).status).toBe(409);
    const disabled = (await request(`/${draft.id}/disable`, 'POST', {}, active.rowVersion)).body.data;
    expect((await request(`/${draft.id}/archive`, 'POST', {}, disabled.rowVersion, true)).status).toBe(403);
    expect((await request(`/${draft.id}/archive`, 'POST', {}, disabled.rowVersion + 1)).status).toBe(409);
    expect((await request(`/${draft.id}/archive`, 'POST', {}, disabled.rowVersion)).body.data.state).toBe('archived');
    const listing = (await request('')).body.data;
    expect(listing.items.some(row => row.id === draft.id)).toBe(false);
    expect(listing.archivedItems.some(row => row.id === draft.id)).toBe(true);
    expect((await request(`/${draft.id}/restore`, 'POST', {}, disabled.rowVersion)).status).toBe(409);
    expect((await request(`/${draft.id}/restore`, 'POST', {}, disabled.rowVersion + 1)).body.data.state).toBe('disabled');
  });
});
