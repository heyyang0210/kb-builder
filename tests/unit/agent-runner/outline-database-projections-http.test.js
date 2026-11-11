const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

describe('数据库大纲目录与治理投影真实双层 HTTP 契约', () => {
  let upstream;
  let server;
  let origin;
  let previous;
  const nodes = [{ id: 'page-1', kind: 'document', title: '安装', path: '安装.md' }];
  const outline = {
    id: 'outline-1', handbookId: 'manual-1', name: '安装手册', state: 'draft',
    outlineStructureVersion: 'version-1', productId: 'yashandb', nodes,
  };
  const catalog = {
    items: [
      { id: 'outline-1', handbookId: 'manual-1' },
      { outlineId: 'outline-2', manualId: 'manual-2' },
    ], total: 42, snapshotVersion: 'catalog-revision-7', generatedAt: '2026-01-01T00:00:00.000Z',
  };

  async function start(responses = {}) {
    upstream = new Worker(path.join(__dirname, 'fixtures/domain-store-http-worker.js'), {
      workerData: { responses: {
        'GET /v1/domain/outlines': { outlines: [outline] },
        'GET /v1/domain/outlines/catalog': catalog,
        'GET /v1/domain/outlines/outline-1/directory': { outlineId: 'outline-1', state: ' PENDING_CONFIRMATION ', nodes },
        'GET /v1/domain/outlines/outline-2/directory': { outlineId: 'outline-2', state: 'unsupported', nodes: [] },
        'GET /v1/domain/outlines/outline-1/governance': { manualId: 'canonical-manual', state: 'CONFIRMED', editVersion: 7, nodes, assignments: [] },
        'GET /v1/domain/handbooks': { handbooks: [{ id: 'manual-1', title: '安装手册' }] },
        ...responses,
      } },
    });
    const port = await new Promise((resolve, reject) => {
      upstream.once('message', resolve);
      upstream.once('error', reject);
    });
    process.env.KNOWLEDGE_STORAGE_MODE = 'database';
    process.env.YASDB_STORAGE_URL = `http://127.0.0.1:${port}`;
    jest.resetModules();
    const app = express();
    app.use(express.json());
    app.use('/api/outline', require('../../../packages/agent-runner-core/routes/outline'));
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  }

  async function request(method, route, body, headers = {}) {
    const response = await fetch(`${origin}/api/outline${route}`, {
      method, headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }

  beforeEach(() => {
    previous = Object.fromEntries(['KNOWLEDGE_STORAGE_MODE', 'YASDB_STORAGE_URL'].map(key => [key, process.env[key]]));
  });
  afterEach(async () => {
    if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
    if (upstream) await upstream.terminate();
    server = upstream = null;
    jest.resetModules();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  test('普通目录保留上游分页总量和快照标识，不误用当前页条数', async () => {
    await start();
    const result = await request('GET', '/catalog');
    expect(result.status).toBe(200);
    expect(result.body.data).toEqual(catalog);
    expect(result.headers.has('server-timing')).toBe(false);
  });

  test.each([
    ['manual-1', 'outline-1', 'pending_confirmation'],
    ['manual-2', 'outline-2', 'published'],
  ])('手册 %s 目录选择正确候选并归一状态', async (manualId, id, state) => {
    await start();
    const result = await request('GET', `/catalog?view=directory&handbookId=${manualId}`);
    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({ total: 1, selectedId: id, directory: { outlineId: id, state } });
    expect(result.body.data.items).toHaveLength(1);
    const timing = result.headers.get('server-timing');
    expect(timing).toContain('catalog_storage-total;dur=2.5');
    expect(timing).toMatch(/catalog_read;dur=\d+\.\d+/);
    expect(timing).toContain('storage-total;dur=2.5');
    expect(timing).toMatch(/directory_read;dur=\d+\.\d+/);
  });

  test.each([
    ['未找到手册', catalog, 'missing'],
    ['未提供候选ID', { items: [{ handbookId: 'manual-1' }] }, 'manual-1'],
    ['非法列表形态', { items: null }, 'manual-1'],
  ])('%s 返回空目录选择，不虚构候选或目录', async (_, upstreamCatalog, manualId) => {
    await start({ 'GET /v1/domain/outlines/catalog': upstreamCatalog });
    const result = await request('GET', `/catalog?view=directory&handbookId=${manualId}`);
    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({ selectedId: null, directory: null });
    expect(result.body.data.total).toBe(manualId === 'missing' || !Array.isArray(upstreamCatalog.items) ? 0 : 1);
    expect(result.headers.get('server-timing')).not.toContain('directory_read');
  });

  test('缺少目录时间和快照时生成有效时间，缺少总数时使用条数', async () => {
    await start({ 'GET /v1/domain/outlines/catalog': { items: [catalog.items[0]] } });
    const { body } = await request('GET', '/catalog');
    expect(body.data.total).toBe(1);
    expect(Number.isNaN(Date.parse(body.data.generatedAt))).toBe(false);
    expect(body.data.snapshotVersion).toBe(body.data.generatedAt);
  });

  test('独立目录详情使用轻量读取，公开状态为小写并保留后端计时', async () => {
    await start();
    const result = await request('GET', '/governance/outline-1?view=directory');
    expect(result.status).toBe(200);
    expect(result.body.data).toEqual({ outlineId: 'outline-1', state: 'pending_confirmation', nodes });
    expect(result.headers.get('server-timing')).toMatch(/storage-total;dur=2.5, directory_read;dur=/);
  });

  test('完整治理使用治理节点、手册和编辑版本，紧凑治理保留顶层节点', async () => {
    await start();
    const full = await request('GET', '/governance/outline-1');
    expect(full.status).toBe(200);
    expect(full.body.data).toMatchObject({ handbookId: 'canonical-manual', state: 'confirmed', editVersion: 7, nodes });
    expect(full.body.data.responsibility).toEqual(full.body.data.governance);
    expect(full.body.data.impact).toBeDefined();
    const compact = await request('GET', '/governance/outline-1?view=compact');
    expect(compact.body.data.nodes).toEqual(nodes);
    expect(compact.body.data.governance.nodes).toBeUndefined();
    expect(compact.body.data.responsibility).toBeUndefined();
    expect(compact.body.data.impact).toBeUndefined();
  });

  test('历史治理缺少节点和状态时回退已有大纲，不将未知状态公开', async () => {
    await start({ 'GET /v1/domain/outlines/outline-1/governance': { state: 'unknown-state' } });
    const result = await request('GET', '/governance/outline-1');
    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({ handbookId: 'manual-1', state: 'draft', editVersion: 1, nodes });
    const responsibility = await request('GET', '/governance/outline-1/responsibility');
    expect(responsibility.body.data).toEqual({ state: 'unknown-state' });
    expect((await request('GET', '/governance/missing')).status).toBe(404);
  });

  test('治理列表过滤无版本、已删除以及其他产品的记录', async () => {
    await start({ 'GET /v1/domain/outlines': { outlines: [
      outline,
      { ...outline, id: 'deleted', deletedAt: '2026-01-01' },
      { ...outline, id: 'other-product', productId: 'other' },
      { id: 'manual-without-version' },
    ] } });
    const result = await request('GET', '/governance/list?productId=yashandb');
    expect(result.body.data.map(item => item.id)).toEqual(['outline-1']);
  });

  test.each(['header', 'body'])('重复创建按 %s 幂等键回放已持久化结果', async source => {
    const stored = { success: true, data: { id: 'already-created' } };
    await start({ 'GET /v1/domain/outlines': {
      outlines: [outline], idempotency: { 'create-request-1': { status: 201, body: stored } },
    } });
    const result = await request('POST', '/handbooks', source === 'body' ? { idempotencyKey: 'create-request-1' } : {},
      source === 'header' ? { 'Idempotency-Key': 'create-request-1' } : {});
    expect(result.status).toBe(201);
    expect(result.body).toEqual(stored);
  });

  test('非法正文字符串和未知手册不能创建大纲', async () => {
    await start();
    const invalid = await request('POST', '/handbooks', { handbookId: 'manual-1', content: '{invalid' });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe('OUTLINE_PREFLIGHT_FAILED');
    const unknown = await request('POST', '/import', { handbookId: 'missing' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('OUTLINE_HANDBOOK_NOT_FOUND');
  });

  test('软删除大纲的候选预检与修改均被拒绝', async () => {
    await start({ 'GET /v1/domain/outlines': { outlines: [{ ...outline, deletedAt: '2026-01-01' }] } });
    const checked = await request('GET', '/candidates/outline-1/preflight');
    expect(checked.status).toBe(409);
    expect(checked.body.error.code).toBe('OUTLINE_DELETED');
    const edited = await request('PATCH', '/candidates/outline-1/nodes', { content: {} });
    expect(edited.status).toBe(409);
    expect(edited.body.error.code).toBe('OUTLINE_DELETED');
    // 恢复属于允许操作，必须到达数据库生命周期入口。
    const restored = await request('POST', '/governance/outline-1/restore', {}, { 'x-outline-actions': 'outline:delete' });
    expect(restored.status).toBe(200);
    expect(restored.body.data.url).toBe('/v1/domain/outlines/outline-1/restore');
  });

  test.each([
    ['DELETE', '', 'outline:delete', 'DELETE', '/v1/domain/outlines/outline-1', '大纲已移入回收站'],
    ['POST', '/restore', 'outline:delete', 'POST', '/v1/domain/outlines/outline-1/restore', '大纲已恢复'],
    ['GET', '/purge-preflight', 'outline:purge', 'GET', '/v1/domain/outlines/outline-1/purge-preflight', undefined],
    ['POST', '/purge', 'outline:purge', 'POST', '/v1/domain/outlines/outline-1/purge', '大纲已彻底删除'],
  ])('%s 生命周期 %s 将授权请求准确转交存储', async (method, suffix, action, upstreamMethod, url, message) => {
    await start();
    const payload = method === 'POST' ? { confirmation: '确认清理', snapshotVersion: 's-7' } : undefined;
    const result = await request(method, `/governance/outline-1${suffix}`, payload, { 'x-outline-actions': action, 'x-actor-id': 'actor-1' });
    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({ method: upstreamMethod, url,
      body: suffix === '/purge-preflight' ? null : { ...payload, actor: 'actor-1' },
    });
    expect(result.body.message).toBe(message);
  });

  test('只读来源、不存在以及权限不足不允许生命周期操作', async () => {
    await start({ 'GET /v1/domain/outlines': { outlines: [outline, { ...outline, id: 'read-only', readOnly: true }] } });
    for (const [id, suffix, status, code] of [
      ['missing', '', 404, 'OUTLINE_NOT_FOUND'],
      ['read-only', '', 409, 'OUTLINE_SOURCE_READ_ONLY'],
      ['outline-1', '', 403, 'OUTLINE_PERMISSION_DENIED'],
      ['outline-1', '/purge-preflight', 403, 'OUTLINE_PERMISSION_DENIED'],
    ]) {
      const result = await request(suffix ? 'GET' : 'DELETE', `/governance/${id}${suffix}`);
      expect(result.status).toBe(status);
      expect(result.body.error.code).toBe(code);
    }
  });

  test.each([
    ['techDomains', { techDomains: [{ id: 'TD-1', name: '部署领域' }] }],
    ['items', { items: [{ id: 'TD-1', name: '部署领域' }] }],
    ['原始数组', [{ id: 'TD-1', name: '部署领域' }]],
    ['缺少列表', {}],
  ])('数据库 %s 领域形态可安全完成导入或拒绝未知领域', async (_, techDomains) => {
    await start({ 'GET /v1/domain/tech-domains': techDomains });
    const content = { title: '导入内容', parts: [{ part: '基础', chapters: [
      { name: '部署', documents: [{ id: 'doc', name: '安装', techDomainIds: ['部署领域'] }] },
    ] }] };
    const result = await request('POST', '/import', { handbookId: 'manual-1', content });
    if (Object.keys(techDomains).length === 0) {
      expect(result.status).toBe(422);
      expect(result.body.data.items[0].error.details).toBeDefined();
    } else {
      expect(result.status).toBe(201);
      expect(result.body.data.content.parts[0].chapters[0].documents[0].techDomainIds).toEqual(['TD-1']);
    }
  });

  test('上游不可用时各读取投影拒绝成功响应', async () => {
    await start();
    await upstream.terminate();
    upstream = null;
    for (const route of ['/catalog', '/catalog?view=directory&handbookId=manual-1',
      '/governance/outline-1', '/governance/outline-1?view=directory', '/governance/outline-1/responsibility']) {
      const result = await request('GET', route);
      expect({ route, status: result.status, error: result.body.error.code }).toEqual({ route, status: 503, error: 'DOMAIN_UNAVAILABLE' });
      expect(result.body.success).toBe(false);
    }
  });
});
