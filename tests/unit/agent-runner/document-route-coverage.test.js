const express = require('express');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

describe('文档路由真实 HTTP 契约', () => {
  let root;
  let server;
  let base;
  let originalCommentsPath;
  let originalStorageMode;
  const docId = relative => Buffer.from(`output:${relative}`).toString('base64');
  const readonlyId = relative => Buffer.from(`reference:${relative}`).toString('base64');
  const request = async (method, route, body) => {
    const response = await fetch(`${base}${route}`, {
      method,
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    const contentType = response.headers.get('content-type') || '';
    return { status: response.status, headers: response.headers, body: contentType.includes('application/json') ? await response.json() : await response.text() };
  };

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'document-route-coverage-'));
    const output = path.join(root, 'output');
    const reference = path.join(root, 'reference');
    fs.mkdirSync(path.join(output, 'docs'), { recursive: true });
    fs.mkdirSync(reference, { recursive: true });
    fs.writeFileSync(path.join(output, 'docs', 'storage.md'), '# 存储指南\n\n存储参数说明\n');
    fs.writeFileSync(path.join(output, 'docs', 'other.md'), '# 其他指南\n');
    fs.writeFileSync(path.join(reference, 'reference.md'), '# 只读资料\n');
    const configPath = path.join(root, 'service.json');
    fs.writeFileSync(configPath, JSON.stringify({ documentPaths: [
      { id: 'output', name: '生成文档', path: output, writable: true },
      { id: 'reference', name: '参考资料', path: reference, writable: false },
    ] }));
    originalCommentsPath = process.env.DOCUMENT_COMMENTS_PATH;
    originalStorageMode = process.env.KNOWLEDGE_STORAGE_MODE;
    process.env.DOCUMENT_COMMENTS_PATH = path.join(root, 'comments.json');
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    jest.resetModules();
    jest.doMock('../../../packages/agent-runner-core/lib/config-registry', () => ({ CONFIG_PATHS: { service: configPath } }));
    const router = require('../../../packages/agent-runner-core/routes/document');
    const app = express();
    app.use(express.json());
    app.use('/api/document', router);
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
    jest.dontMock('../../../packages/agent-runner-core/lib/config-registry');
    jest.resetModules();
    if (originalCommentsPath === undefined) delete process.env.DOCUMENT_COMMENTS_PATH;
    else process.env.DOCUMENT_COMMENTS_PATH = originalCommentsPath;
    if (originalStorageMode === undefined) delete process.env.KNOWLEDGE_STORAGE_MODE;
    else process.env.KNOWLEDGE_STORAGE_MODE = originalStorageMode;
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  test('文档树、列表、统计和搜索基于配置根目录，并排除未命中项', async () => {
    const paths = await request('GET', '/api/document/paths');
    expect(paths.status).toBe(200);
    expect(paths.body.data.map(item => [item.id, item.writable])).toEqual([['output', true], ['reference', false]]);
    const tree = await request('GET', '/api/document/tree');
    expect(tree.body.data[0].children[0].children.map(item => item.name)).toEqual(['other.md', 'storage.md']);
    const listing = await request('GET', '/api/document/list?sort_by=title&sort_order=asc');
    expect(listing.body.data.map(item => item.title)).toEqual(['other', 'reference', 'storage']);
    const stats = await request('GET', '/api/document/stats');
    expect(stats.body.data).toMatchObject({ total_documents: 3, root_count: 2 });
    const search = await request('POST', '/api/document/search', { keyword: '存储', scope: 'all' });
    expect(search.body.data).toHaveLength(1);
    expect(search.body.data[0].matches.map(item => item.type)).toEqual(['content', 'content']);
    expect((await request('POST', '/api/document/search', { keyword: ' ' })).body.data).toEqual([]);
  });

  test('详情、正文、下载与原样预览只读取根目录内文件', async () => {
    const id = encodeURIComponent(docId('docs/storage.md'));
    const detail = await request('GET', `/api/document/${id}`);
    expect(detail.body.data).toMatchObject({ title: 'storage', file_path: 'output:docs/storage.md', writable: true });
    expect((await request('GET', `/api/document/${id}/content`)).body.data.content).toContain('存储参数说明');
    expect((await request('GET', `/api/document/${id}/download`)).status).toBe(200);
    const raw = await request('GET', '/api/document/raw/output/docs/storage.md');
    expect(raw.status).toBe(200);
    expect(raw.headers.get('x-content-type-options')).toBe('nosniff');
    expect(raw.body).toContain('存储指南');
    expect((await request('GET', '/api/document/raw/output/%252e%252e%252freference%252freference.md')).status).toBe(404);
    expect((await request('GET', `/api/document/${encodeURIComponent(docId('../reference/reference.md'))}/content`)).status).toBe(404);
  });

  test('只读目录拒绝修改；可写文档保留版本与评论生命周期', async () => {
    const readOnlyId = readonlyId('reference.md');
    const readOnly = encodeURIComponent(readOnlyId);
    const rawId = docId('docs/storage.md');
    const id = encodeURIComponent(rawId);
    expect((await request('POST', '/api/document/save', { id: readOnlyId, content: '改写' })).status).toBe(403);
    expect((await request('DELETE', `/api/document/${readOnly}`)).status).toBe(403);
    expect((await request('POST', '/api/document/save', { id })).status).toBe(400);
    const saved = await request('POST', '/api/document/save', { id: rawId, title: '新存储指南', content: '# 新存储指南\n内容' });
    expect(saved.status).toBe(200);
    expect(saved.body.data.version).toBe(1);
    const revised = await request('POST', '/api/document/save', { id: rawId, content: '# 新存储指南\n第二版' });
    expect(revised.body.data.version).toBe(2);
    expect((await request('GET', `/api/document/${id}/versions`)).body.data).toHaveLength(1);
    expect((await request('POST', `/api/document/${id}/comments`, { content: '   ' })).status).toBe(400);
    const comment = await request('POST', `/api/document/${id}/comments`, { content: ' 检查参数 ', quote: '第二版' });
    expect(comment.status).toBe(201);
    expect(comment.body.data).toMatchObject({ content: '检查参数', quote: '第二版' });
    expect((await request('GET', `/api/document/${id}/comments`)).body.count).toBe(1);
    expect((await request('DELETE', `/api/document/${id}/comments/missing`)).status).toBe(404);
    expect((await request('DELETE', `/api/document/${id}/comments/${comment.body.data.id}`)).status).toBe(200);
    expect((await request('GET', `/api/document/${id}/comments`)).body.count).toBe(0);
    expect((await request('DELETE', `/api/document/${id}`)).status).toBe(200);
    expect((await request('GET', `/api/document/${id}/content`)).status).toBe(404);
  });

  test('路径管理拒绝缺失目录与默认路径删除，新增配置仍局限于临时环境', async () => {
    expect((await request('POST', '/api/document/paths', { name: '空目录' })).status).toBe(400);
    expect((await request('POST', '/api/document/paths', { name: '不存在', path: path.join(root, 'missing') })).status).toBe(400);
    expect((await request('DELETE', '/api/document/paths/output')).status).toBe(400);
    expect((await request('DELETE', '/api/document/paths/missing')).status).toBe(404);
    const added = await request('POST', '/api/document/paths', { name: 'Extra', path: path.join(root, 'reference') });
    expect(added.status).toBe(200);
    expect(added.body.data).toMatchObject({ name: 'Extra', writable: false });
    expect((await request('DELETE', `/api/document/paths/${added.body.data.id}`)).status).toBe(200);
  });
});
