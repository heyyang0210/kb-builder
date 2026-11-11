const express = require('express');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

describe('大纲导入和候选编辑边界 HTTP 契约', () => {
  let root;
  let server;
  let base;
  let previous;
  const content = {
    title: '安装大纲',
    parts: [{ part: '基础', chapters: [{ name: '部署', kps: [{ id: '1.1', name: '环境要求', desc: '检查环境' }] }] }],
  };

  async function request(method, route, body, headers = {}) {
    const response = await fetch(`${base}/api/outline${route}`, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }

  beforeAll(async () => {
    const resultsRoot = path.resolve(__dirname, '../../../runtime/test-results');
    fs.mkdirSync(resultsRoot, { recursive: true });
    root = fs.mkdtempSync(path.join(resultsRoot, 'outline-route-boundaries-'));
    previous = Object.fromEntries(['OUTLINE_REPOSITORY_DIR', 'KNOWLEDGE_ASSETS_CONFIG', 'KNOWLEDGE_STORAGE_MODE', 'TECH_DOMAINS_CONFIG'].map(key => [key, process.env[key]]));
    process.env.OUTLINE_REPOSITORY_DIR = path.join(root, 'outlines');
    process.env.KNOWLEDGE_ASSETS_CONFIG = path.join(root, 'assets.json');
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    process.env.TECH_DOMAINS_CONFIG = path.join(root, 'tech-domains.json');
    fs.writeFileSync(process.env.TECH_DOMAINS_CONFIG, JSON.stringify({ techDomains: [{ id: 'TD-1', name: '部署领域' }] }));
    fs.writeFileSync(process.env.KNOWLEDGE_ASSETS_CONFIG, JSON.stringify({ handbooks: [
      { handbookId: 'HB-A', name: '甲手册' }, { handbookId: 'HB-B', name: '乙手册' },
    ] }));
    jest.resetModules();
    const router = require('../../../packages/agent-runner-core/routes/outline');
    const app = express();
    app.use(express.json());
    app.use('/api/outline', router);
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
    jest.resetModules();
    for (const [key, value] of Object.entries(previous || {})) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  test('导入组合：相同内容跨手册独立，同手册重复需要确认', async () => {
    const first = await request('POST', '/import', { handbookId: 'HB-A', content });
    expect(first.status).toBe(201);
    const second = await request('POST', '/import', { handbookId: 'HB-B', content });
    expect(second.status).toBe(201);
    expect(second.body.data.handbookId).toBe('HB-B');
    const duplicate = await request('POST', '/import', { handbookId: 'HB-A', content });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.data.items[0].duplicateOf.handbookId).toBe('HB-A');
    const confirmed = await request('POST', '/import', { handbookId: 'HB-A', content, confirmDuplicate: true });
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.data.id).not.toBe(first.body.data.id);
  });

  test('导入边界：手册缺失和未知手册不写入候选', async () => {
    const before = (await request('GET', '/governance/list')).body.data.length;
    expect((await request('POST', '/import', { content })).body.error.code).toBe('OUTLINE_HANDBOOK_REQUIRED');
    expect((await request('POST', '/import', { handbookId: 'missing', content })).body.error.code).toBe('OUTLINE_HANDBOOK_NOT_FOUND');
    expect((await request('GET', '/governance/list')).body.data).toHaveLength(before);
  });

  test('编辑边界：过期版本拒绝，非法 JSON 返回明确 422 且内容不变', async () => {
    const created = await request('POST', '/handbooks', { handbookId: 'HB-A', productId: 'yashandb', businessVersionTags: ['23.4'], content: { ...content, title: '编辑对象' } });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const stale = await request('PATCH', `/candidates/${id}/nodes`, { editVersion: 0, content });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('OUTLINE_EDIT_CONFLICT');
    const invalid = await request('PATCH', `/candidates/${id}/nodes`, { editVersion: 1, content: '{broken' });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe('OUTLINE_CONTENT_INVALID');
    expect((await request('GET', `/versions/${id}`)).body.data.content.title).toBe('编辑对象');
  });

  test('生命周期组合：无权限拒绝，软删除隐藏列表，恢复后重新可见，文件模式禁止彻底删除', async () => {
    const created = await request('POST', '/handbooks', {
      handbookId: 'HB-B', productId: 'yashandb', businessVersionTags: ['23.4'],
      content: { ...content, title: '生命周期对象' },
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const route = `/governance/${id}`;
    const denied = await request('DELETE', route);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('OUTLINE_PERMISSION_DENIED');
    const allowed = { 'x-outline-actions': 'outline:delete', 'x-actor-id': 'tester' };
    expect((await request('DELETE', route, undefined, allowed)).status).toBe(200);
    expect((await request('GET', '/governance/list')).body.data.map(item => item.id)).not.toContain(id);
    expect((await request('GET', '/governance/recycle')).body.data.map(item => item.id)).toContain(id);
    expect((await request('PATCH', `/candidates/${id}/nodes`, { editVersion: 1, content })).body.error.code).toBe('OUTLINE_DELETED');
    const restored = await request('POST', `${route}/restore`, {}, allowed);
    expect(restored.status).toBe(200);
    expect((await request('GET', '/governance/list')).body.data.map(item => item.id)).toContain(id);
    const purge = await request('GET', `${route}/purge-preflight`, undefined, { 'x-outline-actions': 'outline:purge' });
    expect(purge.status).toBe(409);
    expect(purge.body.error.code).toBe('OUTLINE_PURGE_UNAVAILABLE');
    expect((await request('GET', '/governance/missing')).status).toBe(404);
  });
  test('任务新增文档复用候选：稳定ID、保留已有节点、幂等及权限拒绝', async () => {
    const created = await request('POST', '/handbooks', { handbookId: 'HB-A', productId: 'yashandb', businessVersionTags: ['23.4'], content });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const original = (await request('GET', `/versions/${id}`)).body.data.nodes;
    const parent = original.find(n => n.kind !== 'document');
    const body = { handbookId: 'HB-A', parentId: parent.id, name: '新增说明', targetVersion: '23.4', proposalKey: 'a'.repeat(64) };
    expect((await request('POST', `/governance/${id}/document-proposals`, body)).status).toBe(403);
    const headers = { 'x-outline-actions': 'outline:create', 'x-actor-id': 'tester' };
    const prepared = await request('POST', `/governance/${id}/document-proposals`, body, headers);
    expect(prepared.status).toBe(201);
    const replay = await request('POST', `/governance/${id}/document-proposals`, body, headers);
    expect(replay.status).toBe(200); expect(replay.body.data).toEqual(prepared.body.data);
    const next = (await request('GET', `/versions/${prepared.body.data.outlineId}`)).body.data;
    expect(next.nodes).toHaveLength(original.length + 1);
    expect(next.nodes.slice(0, original.length)).toEqual(original);
    expect(next.state).toBe('draft');
    expect(next.nodes.at(-1)).toMatchObject({ id: prepared.body.data.documentId, parentId: parent.id, title: '新增说明' });
    expect((await request('GET', `/versions/${id}`)).body.data.nodes).toEqual(original);
  });

  test('文件模式领域任务经真实 HTTP 指派、清空并回读', async () => {
    const created = await request('POST', '/handbooks', { handbookId: 'HB-A', productId: 'yashandb', businessVersionTags: ['23.4'], content });
    expect(created.status).toBe(201);
    const outlineId = created.body.data.id;
    const metadataPath = path.join(process.env.OUTLINE_REPOSITORY_DIR, 'metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const outline = metadata.outlines.find(item => item.id === outlineId);
    outline.governance = { tasks: [{ id: 'build-task-1', title: '部署任务', items: [{ id: 'page-1', title: '安装页', status: 'unassigned' }] }] };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata));

    expect((await request('GET', '/tech-domains')).body.data.techDomains).toEqual([{ id: 'TD-1', name: '部署领域' }]);
    expect((await request('GET', '/build-tasks')).body.data.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'build-task-1' }),
    ]));
    expect((await request('GET', '/build-tasks/missing')).status).toBe(404);
    expect((await request('PATCH', '/build-tasks/build-task-1/items/missing', { assigneeId: '178' })).status).toBe(404);
    const assigned = await request('PATCH', '/build-tasks/build-task-1/items/page-1', { assignee: { id: '178', name: '何阳' } });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.items[0]).toMatchObject({ assigneeId: '178', assigneeName: '何阳', status: 'assigned' });
    expect((await request('GET', '/build-tasks/build-task-1')).body.data.items[0].assigneeId).toBe('178');
    const cleared = await request('PATCH', '/build-tasks/build-task-1/items/page-1', { assigneeId: '', assigneeName: '' });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.items[0]).toMatchObject({ assigneeId: null, assigneeName: null, status: 'unassigned' });
  });

  test('提示词生成 HTTP 同时定位旧版知识点与新版路径节点', async () => {
    expect((await request('POST', '/generate-prompts', {})).status).toBe(400);
    expect((await request('POST', '/generate-prompts', { outline_id: 'missing', knowledge_points: [{ kp_id: '1.1' }] })).status).toBe(404);
    const created = await request('POST', '/handbooks', { handbookId: 'HB-B', productId: 'yashandb', businessVersionTags: ['23.4'], content: { ...content, title: '提示词来源' } });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect((await request('POST', '/generate-prompts', { outline_id: id, knowledge_points: [{ part: '缺失', chapter: '部署', kp_id: '1.1' }] })).status).toBe(400);
    const generated = await request('POST', '/generate-prompts', {
      outline_id: id,
      knowledge_points: [{ part: '基础', chapter: '部署', kp_id: '1.1' }],
      options: { target_db: 'YashanDB', merge_output: true },
    });
    expect(generated.status).toBe(200);
    expect(generated.body.data).toMatchObject({ outline_id: id, total: 1, saved_files: [] });
    expect(generated.body.data.prompts[0]).toMatchObject({ kp_id: '1.1', kp_name: '环境要求' });
    expect(generated.body.data.merged_prompt).toContain('1.1 环境要求');

    const metadataPath = path.join(process.env.OUTLINE_REPOSITORY_DIR, 'metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    metadata.outlines.push({
      id: 'path-outline', handbookId: 'HB-B', name: '路径大纲', state: 'draft',
      content: { schemaVersion: require('../../../packages/agent-runner-core/lib/outline-path-template').rules.version, title: '路径大纲', nodes: [
        { id: 'dir', kind: 'directory', title: '部署', path: '部署' },
        { id: 'doc', parentId: 'dir', kind: 'document', title: '安装页', path: '部署/安装页.md', description: '安装步骤' },
      ] },
    });
    fs.writeFileSync(metadataPath, JSON.stringify(metadata));
    const fromPath = await request('POST', '/generate-prompts', { outline_id: 'path-outline', knowledge_points: [{ documentId: 'doc' }] });
    expect(fromPath.status).toBe(200);
    expect(fromPath.body.data.prompts[0]).toMatchObject({ kp_id: 'doc', kp_name: '安装页' });
    expect(fromPath.body.data.merged_prompt).toBeNull();
  });

  test('治理读模型、目录、责任影响和预检边界通过真实 HTTP 回读', async () => {
    const created = await request('POST', '/handbooks', { handbookId: 'HB-A', productId: 'yashandb', businessVersionTags: ['23.4'], content: { ...content, title: '治理读模型' } });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect((await request('GET', '/catalog/products')).status).toBe(200);
    expect((await request('GET', '/catalog')).body.data.items).toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
    const detail = await request('GET', `/governance/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({ id, handbookId: 'HB-A', responsibility: expect.any(Object), impact: expect.any(Object) });
    const compact = await request('GET', `/governance/${id}?view=compact`);
    expect(compact.status).toBe(200);
    expect(compact.body.data.responsibility).toBeUndefined();
    expect((await request('GET', `/governance/${id}/responsibility`)).status).toBe(200);
    expect((await request('GET', `/governance/${id}/impact`)).status).toBe(200);
    expect((await request('GET', '/governance/missing/responsibility')).status).toBe(404);
    expect((await request('GET', '/governance/missing/impact')).status).toBe(404);
    expect((await request('POST', '/preflight', { title: '空', parts: [] })).status).toBe(422);
    expect((await request('POST', '/preflight', { content, productId: 'yashandb', businessVersionTags: ['23.4'] })).status).toBe(200);
    expect((await request('GET', `/list`)).status).toBe(200);
    expect((await request('GET', `/versions/${id}`)).status).toBe(200);
  });

  test('候选编辑、预检与版本发布通过真实 HTTP 持久化', async () => {
    expect((await request('PATCH', '/candidates/missing/nodes', { content })).status).toBe(404);
    expect((await request('GET', '/candidates/missing/preflight')).status).toBe(404);
    expect((await request('POST', '/versions/missing/publish', {})).status).toBe(404);
    const created = await request('POST', '/handbooks', {
      handbookId: 'HB-A', productId: 'yashandb', businessVersionTags: ['23.4'],
      content: { ...content, title: '版本发布候选' },
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect((await request('POST', `/versions/${id}/publish`, { baseVersionId: 'stale' })).body.error.code).toBe('OUTLINE_BASELINE_CONFLICT');
    expect((await request('POST', `/versions/${id}/publish`, { editVersion: 0 })).body.error.code).toBe('OUTLINE_EDIT_CONFLICT');
    const edited = await request('PATCH', `/candidates/${id}/nodes`, {
      editVersion: 1, content: { ...content, title: '编辑后的发布候选' },
    });
    expect(edited.status).toBe(200);
    expect(edited.body.data.editVersion).toBe(2);
    expect((await request('GET', `/versions/${id}`)).body.data.content.title).toBe('编辑后的发布候选');
    const checked = await request('GET', `/candidates/${id}/preflight`);
    expect(checked.status).toBe(200);
    expect(checked.body.data.passed).toBe(true);
    const published = await request('POST', `/versions/${id}/publish`, { editVersion: 2 });
    expect(published.status).toBe(200);
    expect(published.body.data.state).toBe('published');
    expect((await request('GET', `/versions/${id}`)).body.data.state).toBe('published');
    expect((await request('PATCH', `/candidates/${id}/nodes`, { content })).body.error.code).toBe('OUTLINE_IMMUTABLE');
  });

  test('治理分工写入与发布在真实 HTTP 中拒绝缺失分工并持久化任务', async () => {
    expect((await request('GET', '/governance/missing/governance')).status).toBe(404);
    expect((await request('PUT', '/governance/missing/governance', {})).status).toBe(404);
    expect((await request('POST', '/governance/missing/publish', {})).status).toBe(404);
    const created = await request('POST', '/handbooks', {
      handbookId: 'HB-B', productId: 'yashandb', businessVersionTags: ['23.4'],
      content: { ...content, title: '治理发布候选' },
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const route = `/governance/${id}`;
    expect((await request('GET', `${route}/governance`)).status).toBe(200);
    expect((await request('POST', `${route}/publish`, {})).body.error.code).toBe('OUTLINE_RESPONSIBILITY_REQUIRED');
    expect((await request('PUT', `${route}/governance`, { editVersion: 0, assignments: [] })).body.error.code).toBe('OUTLINE_EDIT_CONFLICT');
    const node = created.body.data.nodes.find(item => item.kind === 'document');
    expect(node).toBeDefined();
    const saved = await request('PUT', `${route}/governance`, {
      editVersion: 1, assignments: [{ nodeId: node.id, techDomainIds: ['TD-1'] }],
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data.assignments).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: node.id, techDomainIds: ['TD-1'] }),
    ]));
    expect((await request('POST', `${route}/publish`, { editVersion: 0 })).body.error.code).toBe('OUTLINE_EDIT_CONFLICT');
    const published = await request('POST', `${route}/publish`, { editVersion: 1 });
    expect(published.status).toBe(200);
    expect(published.body.data.state).toBe('published');
    expect((await request('POST', `${route}/publish`, {})).status).toBe(200);
    const reread = await request('GET', `${route}/governance`);
    expect(reread.status).toBe(200);
    expect(reread.body.data.assignments).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: node.id, techDomainIds: ['TD-1'] }),
    ]));
  });

  async function withOutlines(outlines, run) {
    const metadataPath = path.join(process.env.OUTLINE_REPOSITORY_DIR, 'metadata.json');
    const original = fs.readFileSync(metadataPath);
    try {
      fs.writeFileSync(metadataPath, JSON.stringify({ outlines }));
      await run();
    } finally { fs.writeFileSync(metadataPath, original); }
  }

  // Keep legacy hard-coded resource locations isolated without replacing parsers or HTTP.
  async function withLegacyPaths(run) {
    const productRoot = path.resolve(__dirname, '../../../packages/agent-runner-core');
    const mappings = [
      [path.join(productRoot, '../outlines'), path.join(root, 'legacy-source')],
      [path.join(productRoot, 'outlines'), path.join(root, 'legacy-content')],
      [path.join(productRoot, 'prompts/from-outline'), path.join(root, 'exported-prompts')],
    ];
    for (const [, target] of mappings) fs.mkdirSync(target, { recursive: true });
    const relocate = value => {
      if (typeof value !== 'string') return value;
      const match = mappings.find(([source]) => value === source || value.startsWith(`${source}${path.sep}`));
      return match ? `${match[1]}${value.slice(match[0].length)}` : value;
    };
    const spies = ['existsSync', 'readdirSync', 'readFileSync', 'writeFileSync', 'mkdirSync'].map(method => {
      const original = fs[method];
      return jest.spyOn(fs, method).mockImplementation((file, ...args) => original.call(fs, relocate(file), ...args));
    });
    try { await run(mappings.map(([, target]) => target)); }
    finally { spies.forEach(spy => spy.mockRestore()); }
  }

  test('只读来源拒绝编辑、发布和删除；不存在的大纲返回404', async () => {
    await withOutlines([{ id: 'readonly', handbookId: 'HB-A', readOnly: true, content }], async () => {
      for (const [method, route, body] of [
        ['PATCH', '/candidates/readonly/nodes', { content }],
        ['POST', '/versions/readonly/publish', {}],
        ['DELETE', '/governance/readonly'],
      ]) {
        const result = await request(method, route, body, { 'x-outline-actions': 'outline:delete' });
        expect(result.status).toBe(409);
        expect(result.body.error.code).toBe('OUTLINE_SOURCE_READ_ONLY');
      }
      expect((await request('GET', '/readonly')).body.data.readOnly).toBe(true);
      expect((await request('GET', '/missing')).status).toBe(404);
      expect((await request('DELETE', '/governance/missing')).body.error.code).toBe('OUTLINE_NOT_FOUND');
    });
  });

  test('已删除发布版与新当前版本冲突时禁止恢复，重复软删除保持原删除时间', async () => {
    const deletedAt = '2026-01-01T00:00:00.000Z';
    await withOutlines([
      { id: 'old', handbookId: 'HB-A', state: 'published', deletedAt, content },
      { id: 'current', handbookId: 'HB-A', state: 'published', content },
    ], async () => {
      const headers = { 'x-outline-actions': 'outline:delete', 'x-actor-id': 'tester' };
      const restore = await request('POST', '/governance/old/restore', {}, headers);
      expect(restore.status).toBe(409);
      expect(restore.body.error.code).toBe('OUTLINE_RESTORE_CONFLICT');
      expect((await request('DELETE', '/governance/old', undefined, headers)).status).toBe(200);
      expect((await request('GET', '/old')).body.data.deletedAt).toBe(deletedAt);
      expect((await request('POST', '/governance/old/purge', {}, { 'x-outline-actions': 'outline:purge' })).body.error.code).toBe('OUTLINE_PURGE_UNAVAILABLE');
      expect((await request('GET', '/governance/old/purge-preflight')).status).toBe(403);
    });
  });

  test('文档提案拒绝不稳定键、未知手册、无效章节版本和已有同名文档', async () => {
    const created = await request('POST', '/handbooks', { handbookId: 'HB-A', productId: 'yashandb', businessVersionTags: ['23.4'], content });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const nodes = created.body.data.nodes;
    const document = nodes.find(node => node.kind === 'document');
    const headers = { 'x-outline-actions': 'outline:create' };
    const payload = { proposalKey: 'c'.repeat(64), handbookId: 'HB-A', parentId: document.parentId, name: '另一个文档', targetVersion: '23.4' };
    for (const [change, status, code] of [
      [{ proposalKey: 'unstable' }, 422, 'PROPOSAL_KEY_REQUIRED'],
      [{ handbookId: 'missing' }, 404, 'OUTLINE_NOT_FOUND'],
      [{ parentId: document.id }, 422, 'PROPOSAL_INVALID'],
      [{ name: '  ' }, 422, 'PROPOSAL_INVALID'],
      [{ targetVersion: '99' }, 422, 'PROPOSAL_INVALID'],
      [{ targetVersion: '' }, 422, 'PROPOSAL_INVALID'],
      [{ name: document.title }, 409, 'DOCUMENT_EXISTS'],
    ]) {
      const result = await request('POST', `/governance/${id}/document-proposals`, { ...payload, ...change }, headers);
      expect({ status: result.status, code: result.body.error.code }).toEqual({ status, code });
    }
    expect((await request('GET', `/versions/${id}`)).body.data.nodes).toEqual(nodes);
  });

  test('旧来源目录只投影允许资源，解析错误降级且来源保持只读', async () => {
    await withLegacyPaths(async ([source]) => {
      fs.writeFileSync(path.join(source, 'guide.md'), '# 1. 基础\n## 1.1 部署\n### 1.1.1 安装\n');
      fs.writeFileSync(path.join(source, 'metadata.json'), '{}');
      fs.writeFileSync(path.join(source, 'table.csv'), '目录,名称\n');
      fs.writeFileSync(path.join(source, 'README.md'), '# 不属于大纲');
      fs.writeFileSync(path.join(source, '设计思路.md'), '# 不属于大纲');
      fs.writeFileSync(path.join(source, 'ignored.txt'), 'ignored');
      fs.mkdirSync(path.join(source, 'broken.md'));
      await withOutlines([], async () => {
        const result = await request('GET', '/list');
        expect(result.status).toBe(200);
        expect(result.body.data.map(item => item.file).sort()).toEqual(['broken.md', 'guide.md', 'metadata.json', 'table.csv']);
        expect(result.body.data.every(item => item.readOnly && item.sourceType === 'legacy_file')).toBe(true);
        expect(result.body.data.find(item => item.file === 'broken.md').content).toEqual({ parts: [] });
        const id = result.body.data.find(item => item.file === 'guide.md').id;
        expect((await request('POST', `/versions/${id}/publish`, {})).body.error.code).toBe('OUTLINE_SOURCE_READ_ONLY');
      });
    });
  });

  test('旧版文件按真实JSON解析，缺失和损坏内容返回明确错误且列表容忍坏文件', async () => {
    await withLegacyPaths(async ([, resources]) => {
      fs.writeFileSync(path.join(resources, 'valid.json'), JSON.stringify(content));
      fs.writeFileSync(path.join(resources, 'invalid.json'), '{broken');
      await withOutlines([
        { id: 'valid-file', file: 'valid.json' },
        { id: 'invalid-file', file: 'invalid.json' },
        { id: 'missing-file', file: 'absent.json' },
      ], async () => {
        const list = await request('GET', '/list');
        expect(list.status).toBe(200);
        expect(list.body.data.find(item => item.id === 'valid-file')).toMatchObject({ content, kp_count: 1 });
        expect(list.body.data.find(item => item.id === 'invalid-file').content).toBeUndefined();
        const selected = [{ part: '基础', chapter: '部署', kp_id: '1.1' }];
        const valid = await request('POST', '/generate-prompts', { outline_id: 'valid-file', knowledge_points: selected });
        expect(valid.status).toBe(200);
        expect(valid.body.data.total).toBe(1);
        for (const [id, message] of [['invalid-file', '大纲内容无法解析'], ['missing-file', '大纲文件不存在']]) {
          const result = await request('POST', '/generate-prompts', { outline_id: id, knowledge_points: selected });
          expect(result.status).toBe(400);
          expect(result.body.message).toBe(message);
        }
      });
    });
  });

  test('提示词导出可重复回读真实文件，文件名清洗且缺失节点不生成提示词', async () => {
    await withLegacyPaths(async ([,, exported]) => {
      const pathRules = require('../../../packages/agent-runner-core/lib/outline-path-template').rules;
      await withOutlines([{
        id: 'export', name: '导出大纲',
        content: { schemaVersion: pathRules.version, title: '导出大纲', nodes: [
          { id: '1.2', kind: 'document', title: '安装/部署:检查?', path: '部署.md' },
        ] },
      }], async () => {
        const payload = { outline_id: 'export', knowledge_points: [{ path: '部署.md' }, { documentId: 'missing' }], options: { save_to_file: true, merge_output: true } };
        for (let i = 0; i < 2; i++) {
          const result = await request('POST', '/generate-prompts', payload);
          expect(result.status).toBe(200);
          expect(result.body.data.saved_files).toEqual([{ kp_id: '1.2', file: '1-2-安装_部署_检查_.md' }]);
          expect(fs.readFileSync(path.join(exported, 'export', result.body.data.saved_files[0].file), 'utf8')).toBe(result.body.data.prompts[0].prompt);
          expect(result.body.data.merged_prompt).toContain('安装/部署:检查?');
        }
        const none = await request('POST', '/generate-prompts', { ...payload, knowledge_points: [{ kp_id: 'missing' }] });
        expect(none.status).toBe(400);
        expect(none.body.message).toBe('未找到匹配的知识点');
      });
    });
  });

  test('旧版知识点选择兼容documents和knowledgePoints，并忽略缺失章节与叶子', async () => {
    const legacy = { parts: [{ part: '基础', chapters: [
      { name: '文档', documents: [{ documentId: 'doc', id: 'doc', name: '安装' }] },
      { name: '知识', knowledgePoints: [{ id: 'kp', name: '备份' }] },
    ] }] };
    await withOutlines([{ id: 'selectors', content: legacy }], async () => {
      const result = await request('POST', '/generate-prompts', { outline_id: 'selectors', knowledge_points: [
        { part: '基础', chapter: '文档', kp_id: 'doc' },
        { part: '基础', chapter: '知识', kp_id: 'kp' },
        { part: '基础', chapter: '不存在', kp_id: 'kp' },
        { part: '基础', chapter: '文档', kp_id: 'missing' },
      ] });
      expect(result.status).toBe(200);
      expect(result.body.data.prompts.map(item => item.kp_name)).toEqual(['安装', '备份']);
      expect((await request('POST', '/generate-prompts', { outline_id: 'selectors', knowledge_points: [] })).status).toBe(400);
    });
  });

  test.each(['documents', 'kps', 'knowledgePoints'])('历史顶层%s计数在无正文编辑时保留，并持久化编辑版本', async leaf => {
    const chapter = { [leaf]: [{ id: 'a', name: '安装' }, { id: 'b', name: '备份' }] };
    await withOutlines([
      { id: 'historical', parts: [{}, { chapters: [chapter, {}] }], chapters: [chapter, {}] },
    ], async () => {
      const result = await request('PATCH', '/candidates/historical/nodes', {});
      expect(result.status).toBe(200);
      expect(result.body.data.editVersion).toBe(2);
      expect((await request('GET', '/historical')).body.data.kp_count).toBe(4);
    });
  });

  test('创建幂等键回放同一候选，字符串JSON编辑可回读且非法预检不会发布', async () => {
    const payload = { handbookId: 'HB-A', productId: 'yashandb', businessVersionTags: ['23.4'], content: JSON.stringify(content) };
    const headers = { 'Idempotency-Key': 'file-create-idempotent' };
    const first = await request('POST', '/handbooks', payload, headers);
    expect(first.status).toBe(201);
    expect((await request('POST', '/handbooks', payload, headers)).body).toEqual(first.body);
    const id = first.body.data.id;
    const edited = await request('PATCH', `/candidates/${id}/nodes`, { content: JSON.stringify({ title: '空大纲', parts: [] }) });
    expect(edited.status).toBe(200);
    expect((await request('GET', `/versions/${id}`)).body.data.content).toEqual({ title: '空大纲', parts: [] });
    const checked = await request('GET', `/candidates/${id}/preflight`);
    expect(checked.status).toBe(422);
    expect((await request('GET', `/${id}`)).body.data.state).toBe('preflight_failed');
    expect((await request('POST', `/versions/${id}/publish`, {})).body.error.code).toBe('OUTLINE_PREFLIGHT_FAILED');
  });

  test('发布候选替代同手册旧版，保留其他手册和已删除版本状态', async () => {
    const fields = { productId: 'yashandb', businessVersionTags: ['23.4'], content };
    await withOutlines([
      { ...fields, id: 'next', handbookId: 'HB-A', state: 'draft' },
      { ...fields, id: 'old', handbookId: 'HB-A', state: 'published' },
      { ...fields, id: 'deleted', handbookId: 'HB-A', state: 'published', deletedAt: '2026-01-01' },
      { ...fields, id: 'other', handbookId: 'HB-B', state: 'published' },
    ], async () => {
      expect((await request('POST', '/versions/next/publish', {})).status).toBe(200);
      expect((await request('GET', '/old')).body.data.state).toBe('superseded');
      expect((await request('GET', '/other')).body.data.state).toBe('published');
      expect((await request('GET', '/deleted')).body.data.state).toBe('published');
      expect((await request('PATCH', '/candidates/old/nodes', {})).body.error.code).toBe('OUTLINE_IMMUTABLE');
    });
  });

  test('手册配置缺失或无列表时拒绝未知手册，恢复配置后正常创建', async () => {
    const config = process.env.KNOWLEDGE_ASSETS_CONFIG;
    const original = fs.readFileSync(config);
    try {
      for (const configValue of [null, {}, { handbooks: null }]) {
        if (configValue === null) fs.unlinkSync(config); else fs.writeFileSync(config, JSON.stringify(configValue));
        const result = await request('POST', '/handbooks', { handbookId: 'HB-A', content });
        expect(result.status).toBe(404);
        expect(result.body.error.code).toBe('OUTLINE_HANDBOOK_NOT_FOUND');
      }
    } finally { fs.writeFileSync(config, original); }
    expect((await request('POST', '/handbooks', { handbookId: 'HB-A', content, productId: 'yashandb', businessVersionTags: ['23.4'] })).status).toBe(201);
  });

  test('提示词导出目录无法创建时返回失败，解除故障后可重新导出', async () => {
    await withLegacyPaths(async ([,, exported]) => {
      fs.writeFileSync(path.join(exported, 'blocked'), '文件占用导出目录');
      await withOutlines([{ id: 'blocked', content }], async () => {
        const payload = { outline_id: 'blocked', knowledge_points: [{ part: '基础', chapter: '部署', kp_id: '1.1' }], options: { save_to_file: true } };
        const failure = await request('POST', '/generate-prompts', payload);
        expect(failure.status).toBe(500);
        expect(failure.body.success).toBe(false);
        expect(failure.body.message).toMatch(/ENOTDIR|EEXIST/);
        fs.unlinkSync(path.join(exported, 'blocked'));
        const recovered = await request('POST', '/generate-prompts', payload);
        expect(recovered.status).toBe(200);
        expect(recovered.body.data.saved_files).toHaveLength(1);
      });
    });
  });

  test('首次校验创建隔离上传目录，损坏XLSX清理临时文件；旧上传入口明确下线', async () => {
    const repositoryDir = process.env.OUTLINE_REPOSITORY_DIR;
    const saved = path.join(root, 'saved-outlines');
    fs.renameSync(repositoryDir, saved);
    try {
      const form = new FormData();
      form.append('handbookId', 'HB-A');
      form.append('file', new Blob(['not-an-xlsx-file']), 'broken.xlsx');
      const response = await fetch(`${base}/api/outline/validate`, { method: 'POST', body: form });
      expect(response.status).toBe(422);
      expect((await response.json()).success).toBe(false);
      expect(fs.existsSync(repositoryDir)).toBe(true);
      expect(fs.readdirSync(repositoryDir)).toEqual([]);
    } finally {
      fs.rmSync(repositoryDir, { recursive: true, force: true });
      fs.renameSync(saved, repositoryDir);
    }
    const deprecated = await request('POST', '/upload', {});
    expect(deprecated.status).toBe(410);
    expect(deprecated.body.error.code).toBe('OUTLINE_UPLOAD_DEPRECATED');
  });

  test('存储锁冲突时提案和导入不写入候选，解除锁后可以重试', async () => {
    const created = await request('POST', '/handbooks', { handbookId: 'HB-A', productId: 'yashandb', businessVersionTags: ['23.4'], content });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const document = created.body.data.nodes.find(node => node.kind === 'document');
    const proposal = { proposalKey: 'd'.repeat(64), handbookId: 'HB-A', parentId: document.parentId, name: '锁冲突后新增', targetVersion: '23.4' };
    const headers = { 'x-outline-actions': 'outline:create' };
    const metadataPath = path.join(process.env.OUTLINE_REPOSITORY_DIR, 'metadata.json');
    const original = fs.readFileSync(metadataPath, 'utf8');
    const lock = `${metadataPath}.lock`;
    fs.writeFileSync(lock, 'another-writer');
    try {
      const failedProposal = await request('POST', `/governance/${id}/document-proposals`, proposal, headers);
      expect(failedProposal.status).toBe(500);
      expect(failedProposal.body.error.code).toBe('EEXIST');
      const failedImport = await request('POST', '/import', { handbookId: 'HB-B', content: { ...content, title: '被锁拒绝的大纲' } });
      expect(failedImport.status).toBe(400);
      expect(failedImport.body.error.code).toBe('EEXIST');
      expect(fs.readFileSync(metadataPath, 'utf8')).toBe(original);
      expect(fs.readFileSync(lock, 'utf8')).toBe('another-writer');
    } finally { fs.rmSync(lock, { force: true }); }
    expect((await request('POST', `/governance/${id}/document-proposals`, proposal, headers)).status).toBe(201);
  });

  test('元数据和备份损坏时各HTTP读写返回失败，恢复文件后正常回读', async () => {
    const created = await request('POST', '/handbooks', {
      handbookId: 'HB-A', productId: 'yashandb', businessVersionTags: ['23.4'], content,
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const metadataPath = path.join(process.env.OUTLINE_REPOSITORY_DIR, 'metadata.json');
    const backupPath = `${metadataPath}.bak`;
    const original = fs.readFileSync(metadataPath);
    const backup = fs.existsSync(backupPath) ? fs.readFileSync(backupPath) : null;
    try {
      fs.writeFileSync(metadataPath, '{broken');
      fs.writeFileSync(backupPath, '{broken');
      for (const [method, route, body, status, code] of [
        ['GET', '/catalog/products', undefined, 500, 'OUTLINE_CATALOG_FAILED'],
        ['GET', '/governance/recycle', undefined, 500, 'OUTLINE_RECYCLE_FAILED'],
        ['GET', '/governance/list', undefined, 500, 'OUTLINE_LIST_FAILED'],
        ['GET', `/governance/${id}/responsibility`, undefined, 500, 'RESPONSIBILITY_FAILED'],
        ['GET', `/governance/${id}/impact`, undefined, 500, 'IMPACT_FAILED'],
        ['GET', `/governance/${id}/governance`, undefined, 503, 'OUTLINE_GOVERNANCE_FAILED'],
        ['PUT', `/governance/${id}/governance`, {}, 500, 'OUTLINE_UNAVAILABLE'],
        ['POST', `/governance/${id}/publish`, {}, 500, 'OUTLINE_UNAVAILABLE'],
        ['GET', '/build-tasks', undefined, 503, 'BUILD_TASK_FAILED'],
        ['GET', '/build-tasks/task', undefined, 503, 'BUILD_TASK_FAILED'],
        ['PATCH', '/build-tasks/task/items/item', {}, 422, 'BUILD_TASK_ITEM_FAILED'],
        ['POST', '/generate-prompts', { outline_id: id, knowledge_points: [{ part: '基础', chapter: '部署', kp_id: '1.1' }] }, 500, 'OUTLINE_UNAVAILABLE'],
      ]) {
        const result = await request(method, route, body);
        expect({ route, status: result.status, code: result.body.error?.code }).toEqual({ route, status, code });
        expect(result.body.success).toBe(false);
      }
      for (const [method, route, body] of [
        ['GET', '/list'], ['GET', `/${id}`],
      ]) {
        const result = await request(method, route, body);
        expect(result.status).toBe(500);
        expect(result.body.success).toBe(false);
        expect(result.body.message).toBeTruthy();
      }
    } finally {
      fs.writeFileSync(metadataPath, original);
      if (backup) fs.writeFileSync(backupPath, backup); else fs.rmSync(backupPath, { force: true });
    }
    expect((await request('GET', '/list')).body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
    expect((await request('GET', `/versions/${id}`)).body.data.content).toEqual(content);
  });

});

describe('数据库大纲治理网关双层 HTTP 契约', () => {
  let upstream;
  let gateway;
  let origin;
  let previous;
  const cases = [
    ['GET', '/governance/outline-1/governance', undefined, '/v1/domain/outlines/outline-1/governance'],
    ['PUT', '/governance/outline-1/governance', { editVersion: 3, governanceVersion: 2, assignments: [{ nodeId: 'doc', techDomainIds: ['TD-1'] }] }, '/v1/domain/outlines/outline-1/governance', '目录说明和责任分工已保存'],
    ['POST', '/governance/outline-1/publish', { editVersion: 3 }, '/v1/domain/outlines/outline-1/publish', '大纲已发布，领域建设任务已生成'],
    ['GET', '/tech-domains', undefined, '/v1/domain/tech-domains'],
    ['GET', '/build-tasks?owner=user%201&status=assigned', undefined, '/v1/domain/build-tasks?owner=user+1&status=assigned'],
    ['GET', '/build-tasks/task-1', undefined, '/v1/domain/build-tasks/task-1'],
    ['PATCH', '/build-tasks/task-1/items/doc-1', { assigneeId: 'user-1', assigneeName: '测试人员' }, '/v1/domain/build-tasks/task-1/items/doc-1', '页面建设责任人已更新'],
  ];

  async function request(method, route, body) {
    const response = await fetch(`${origin}/api/outline${route}`, {
      method, headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }

  beforeAll(async () => {
    previous = Object.fromEntries(['KNOWLEDGE_STORAGE_MODE', 'YASDB_STORAGE_URL'].map(key => [key, process.env[key]]));
    upstream = new Worker(path.join(__dirname, 'fixtures/domain-store-http-worker.js'), {
      workerData: { responses: { 'GET /v1/domain/outlines': { outlines: [{ id: 'outline-1', state: 'draft' }] } } },
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
    gateway = http.createServer(app);
    await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${gateway.address().port}`;
  });

  afterAll(async () => {
    if (gateway) await new Promise(resolve => { gateway.closeAllConnections(); gateway.close(resolve); });
    if (upstream) await upstream.terminate();
    jest.resetModules();
    for (const [key, value] of Object.entries(previous || {})) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  test.each(cases)('%s %s 保留上游请求与成功信封', async (...entry) => {
    const [method, route, body, upstreamPath, message] = entry;
    const result = await request(method, route, body);
    expect(result).toMatchObject({ status: 200, body: { success: true } });
    expect(result.body).toMatchObject({ success: true, data: { method, url: upstreamPath, body: body ?? null } });
    expect(Number.isNaN(Date.parse(result.body.generatedAt))).toBe(false);
    if (message) expect(result.body.message).toBe(message);
    if (body !== undefined) expect(result.body.data.headers['content-type']).toMatch(/^application\/json/);
  });

  test('上游关闭后全部治理入口返回 503，不误报成功', async () => {
    await upstream.terminate();
    upstream = null;
    for (const [method, route, body] of cases) {
      const result = await request(method, route, body);
      expect({ route, status: result.status, success: result.body.success, code: result.body.error?.code })
        .toEqual({ route, status: 503, success: false, code: 'DOMAIN_UNAVAILABLE' });
      expect(result.body.error.message).toBe('YashanDB 领域存储服务不可用');
    }
  });
});
