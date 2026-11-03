const express = require('express');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
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
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'outline-route-boundaries-'));
    previous = Object.fromEntries(['OUTLINE_REPOSITORY_DIR', 'KNOWLEDGE_ASSETS_CONFIG', 'KNOWLEDGE_STORAGE_MODE'].map(key => [key, process.env[key]]));
    process.env.OUTLINE_REPOSITORY_DIR = path.join(root, 'outlines');
    process.env.KNOWLEDGE_ASSETS_CONFIG = path.join(root, 'assets.json');
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
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

});
