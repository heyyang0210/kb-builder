const express = require('express');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

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

});
