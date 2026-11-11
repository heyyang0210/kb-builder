const express = require('express');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

describe('文档路由真实 HTTP 契约', () => {
  let root;
  let server;
  let base;
  let originalCommentsPath;
  let originalStorageMode;
  let modelConfig;
  let modelResponse;
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
    const resultsRoot = path.resolve(__dirname, '../../../runtime/test-results');
    fs.mkdirSync(resultsRoot, { recursive: true });
    root = fs.mkdtempSync(path.join(resultsRoot, 'document-route-coverage-'));
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
    jest.doMock('../../../packages/agent-runner-core/lib/repo-paths', () => ({
      ...jest.requireActual('../../../packages/agent-runner-core/lib/repo-paths'),
      AGENT_RUNNER_RUNTIME_ROOT: path.join(root, 'agent-runner'),
    }));
    jest.doMock('../../../packages/agent-runner-core/lib/config-manager', () => ({ getModelConfig: async () => modelConfig }));
    jest.doMock('../../../packages/agent-runner-core/lib/llm-client', () => jest.fn().mockImplementation(() => ({ chat: async () => modelResponse })));
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
    jest.dontMock('../../../packages/agent-runner-core/lib/repo-paths');
    jest.dontMock('../../../packages/agent-runner-core/lib/config-manager');
    jest.dontMock('../../../packages/agent-runner-core/lib/llm-client');
    jest.resetModules();
    if (originalCommentsPath === undefined) delete process.env.DOCUMENT_COMMENTS_PATH;
    else process.env.DOCUMENT_COMMENTS_PATH = originalCommentsPath;
    if (originalStorageMode === undefined) delete process.env.KNOWLEDGE_STORAGE_MODE;
    else process.env.KNOWLEDGE_STORAGE_MODE = originalStorageMode;
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });

  test('预处理拒绝不支持的文件类型后仍可处理合法文档', async () => {
    const before = (await request('GET', '/api/document/preprocess')).body.data;
    const rejected = new FormData();
    rejected.append('file', new Blob(['unsupported']), 'unsupported.pdf');
    const response = await fetch(`${base}/api/document/preprocess`, { method: 'POST', body: rejected });
    expect(response.status).toBe(500);
    expect(await response.text()).toContain('当前仅支持 Markdown');
    expect((await request('GET', '/api/document/preprocess')).body.data).toEqual(before);

    const accepted = new FormData();
    accepted.append('file', new Blob(['# 可处理文档\n正文']), 'valid.md');
    const success = await fetch(`${base}/api/document/preprocess`, { method: 'POST', body: accepted });
    expect(success.status).toBe(200);
    const document = (await success.json()).data;
    expect(document).toMatchObject({ original_name: 'valid.md', status: 'processed' });
    expect((await request('DELETE', `/api/document/preprocess/${document.id}`)).status).toBe(200);
    expect((await request('GET', '/api/document/preprocess')).body.data).toEqual(before);
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

  test('路径管理经 HTTP 验证相对目录、只读默认值和配置故障恢复', async () => {
    const configFile = path.join(root, 'service.json');
    const original = fs.readFileSync(configFile, 'utf8');
    const extra = path.join(root, 'extra');
    fs.mkdirSync(extra);
    const relative = path.relative(path.resolve(__dirname, '../../..'), extra);
    try {
      expect((await request('POST', '/api/document/paths', { name: '临时目录' })).status).toBe(400);
      expect((await request('POST', '/api/document/paths', { name: '不存在', path: path.join(root, 'missing') })).status).toBe(400);
      expect((await request('POST', '/api/document/paths', { name: '文件', path: path.join(root, 'service.json') })).status).toBe(400);
      expect((await request('DELETE', '/api/document/paths/output')).status).toBe(400);
      expect((await request('DELETE', '/api/document/paths/missing')).status).toBe(404);

      const added = await request('POST', '/api/document/paths', { name: '临时目录', path: relative });
      expect(added.status).toBe(200);
      expect(added.body.data).toMatchObject({ path: relative, absPath: extra, writable: false, exists: true });
      const id = added.body.data.id;
      expect((await request('GET', '/api/document/paths')).body.data)
        .toEqual(expect.arrayContaining([expect.objectContaining({ id, absPath: extra, writable: false })]));
      expect((await request('DELETE', `/api/document/paths/${id}`)).status).toBe(200);
      expect((await request('DELETE', `/api/document/paths/${id}`)).status).toBe(404);

      fs.writeFileSync(configFile, JSON.stringify({ documentPaths: null }));
      const fromEmpty = await request('POST', '/api/document/paths', { name: '中文', path: extra, writable: true, description: '临时测试' });
      expect(fromEmpty.status).toBe(200);
      expect(fromEmpty.body.data).toMatchObject({ writable: true, description: '临时测试' });
      expect(fromEmpty.body.data.id).toMatch(/^path-/);
      expect((await request('DELETE', `/api/document/paths/${fromEmpty.body.data.id}`)).status).toBe(200);

      fs.rmSync(configFile);
      const fromMissing = await request('POST', '/api/document/paths', { name: '重建', path: extra });
      expect(fromMissing.status).toBe(200);
      expect((await request('DELETE', `/api/document/paths/${fromMissing.body.data.id}`)).status).toBe(200);

      fs.writeFileSync(configFile, '{broken');
      expect((await request('POST', '/api/document/paths', { name: '故障', path: extra })).status).toBe(500);
      expect((await request('DELETE', '/api/document/paths/reference')).status).toBe(500);
    } finally {
      fs.writeFileSync(configFile, original);
    }
    expect((await request('GET', '/api/document/paths')).body.data.map(item => item.id))
      .toEqual(['output', 'reference']);
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

  test('生成入口经真实 HTTP 校验配置、保存正文与元数据并拒绝越界路径', async () => {
    expect((await request('POST', '/api/document/generate', { title: '缺少提示' })).status).toBe(400);
    modelConfig = null;
    expect((await request('POST', '/api/document/generate', { prompt: '生成技术文档' })).body.message).toContain('API Key');

    modelConfig = { model: 'isolated-model', api_key: 'fixture-key', max_tokens: 512 };
    modelResponse = { content: '# 生成文档\n\n隔离正文', usage: { total_tokens: 12 } };
    const generated = await request('POST', '/api/document/generate', {
      prompt: '生成技术文档', title: '生成/文档', metadata: { tags: ['技术'] },
    });
    expect(generated.status).toBe(200);
    expect(generated.body.data).toMatchObject({ title: '生成/文档', content: modelResponse.content, tokens_used: 12 });
    const savedFile = path.join(root, 'output', '生成_文档.md');
    expect(fs.readFileSync(savedFile, 'utf8')).toBe(modelResponse.content);
    const metadata = JSON.parse(fs.readFileSync(path.join(root, 'output', 'metadata.json'), 'utf8'));
    expect(metadata.documents).toEqual(expect.arrayContaining([expect.objectContaining({
      id: generated.body.data.id, model: 'isolated-model', tags: ['技术'], version: 1,
    })]));
    expect(metadata.versions[generated.body.data.id][0].change).toBe('initial generation');
    const generatedId = encodeURIComponent(docId('生成_文档.md'));
    expect((await request('GET', `/api/document/${generatedId}/content`)).body.data.content).toBe(modelResponse.content);

    modelResponse = { content: '# 子目录文档\n\n明确文件名' };
    const nested = await request('POST', '/api/document/generate', {
      prompt: '生成另一个文档', title: '子目录文档', output_path: 'docs/generated', filename: 'named.md',
    });
    expect(nested.status).toBe(200);
    expect(nested.body.data).toMatchObject({ path: 'output:docs/generated/named.md', tokens_used: 0 });
    expect(fs.readFileSync(path.join(root, 'output', 'docs', 'generated', 'named.md'), 'utf8')).toBe(modelResponse.content);
    expect((await request('GET', `/api/document/${encodeURIComponent(docId('docs/generated/named.md'))}/content`)).body.data.content)
      .toBe(modelResponse.content);

    const denied = await request('POST', '/api/document/generate', {
      prompt: '越界尝试', title: 'outside', output_path: '..', filename: 'outside.md',
    });
    expect(denied.status).toBe(400);
    expect(denied.body.message).toBe('非法路径');
    expect(fs.existsSync(path.join(root, 'outside.md'))).toBe(false);
  });

  test('Markdown 上传预处理经真实 HTTP 完成列表、详情和删除闭环', async () => {
    expect((await request('POST', '/api/document/preprocess')).status).toBe(400);
    expect((await request('GET', '/api/document/preprocess/missing')).status).toBe(404);
    const form = new FormData();
    form.append('file', new Blob(['# 参数手册\n\n## 第一章\n正文\n### 小节\n说明\n'], { type: 'text/markdown' }), 'parameters.md');
    const uploadedResponse = await fetch(`${base}/api/document/preprocess`, { method: 'POST', body: form });
    const uploaded = await uploadedResponse.json();
    expect(uploadedResponse.status).toBe(200);
    expect(uploaded.data).toMatchObject({ title: '参数手册', original_name: 'parameters.md', status: 'processed' });
    expect(uploaded.data.sections[0]).toMatchObject({ title: '第一章', children: [expect.objectContaining({ title: '小节' })] });
    const listed = await request('GET', '/api/document/preprocess');
    expect(listed.body.data).toEqual(expect.arrayContaining([expect.objectContaining({
      id: uploaded.data.id, stored_file: uploaded.data.stored_file, section_count: 2,
    })]));
    expect(fs.existsSync(path.join(root, 'agent-runner', 'tmp', 'doc-processed', uploaded.data.stored_file))).toBe(true);
    expect((await request('GET', `/api/document/preprocess/${uploaded.data.id}`)).body.data).toMatchObject({ id: uploaded.data.id, title: '参数手册' });
    expect((await request('DELETE', `/api/document/preprocess/${uploaded.data.id}`)).status).toBe(200);
    expect((await request('GET', `/api/document/preprocess/${uploaded.data.id}`)).status).toBe(404);
    expect((await request('GET', '/api/document/preprocess')).body.data).toEqual([]);
    expect((await request('DELETE', `/api/document/preprocess/${uploaded.data.id}`)).status).toBe(404);
    expect(fs.existsSync(path.join(root, 'agent-runner', 'tmp', 'doc-processed', uploaded.data.stored_file))).toBe(false);

    const legacyForm = new FormData();
    legacyForm.append('file', new Blob(['# 旧版文档\n\n## 章节\n正文\n'], { type: 'text/markdown' }), 'legacy.md');
    const legacyResponse = await fetch(`${base}/api/document/preprocess`, { method: 'POST', body: legacyForm });
    expect(legacyResponse.status).toBe(200);
    const legacy = (await legacyResponse.json()).data;
    const metadataFile = path.join(root, 'agent-runner', 'tmp', 'doc-processed', 'metadata.json');
    const legacyMetadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    delete legacyMetadata.documents.find(item => item.id === legacy.id).stored_file;
    fs.writeFileSync(metadataFile, JSON.stringify(legacyMetadata));
    expect((await request('DELETE', `/api/document/preprocess/${legacy.id}`)).status).toBe(200);
    expect(fs.existsSync(path.join(root, 'agent-runner', 'tmp', 'doc-processed', `${legacy.id}.json`))).toBe(false);
  });

  test('搜索与统计只包含可见文件，标题模式和正文命中上限保持一致', async () => {
    const output = path.join(root, 'output');
    fs.mkdirSync(path.join(output, '.private'), { recursive: true });
    fs.mkdirSync(path.join(output, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(output, '.private', 'hidden.md'), 'needle');
    fs.writeFileSync(path.join(output, 'node_modules', 'dependency.md'), 'needle');
    fs.writeFileSync(path.join(output, 'docs', 'needle.md'), 'needle\nneedle\nneedle\nneedle\n');
    fs.writeFileSync(path.join(output, 'docs', 'binary.bin'), Buffer.from([0, 1, 2, 3]));

    const all = await request('POST', '/api/document/search', { keyword: 'needle', scope: 'all' });
    expect(all.status).toBe(200);
    expect(all.body.data.map(item => item.path)).toEqual(['output:docs/needle.md']);
    expect(all.body.data[0].matches.map(item => item.type)).toEqual(['title', 'content', 'content', 'content']);
    const titleOnly = await request('POST', '/api/document/search', { keyword: 'needle', scope: 'title' });
    expect(titleOnly.body.data[0].matches.map(item => item.type)).toEqual(['title']);
    expect((await request('POST', '/api/document/search', { keyword: 'binary', scope: 'all' })).body.data[0].matches)
      .toEqual([expect.objectContaining({ type: 'title' })]);

    const listed = await request('GET', '/api/document/list?sort_by=unknown&sort_order=invalid');
    expect(listed.status).toBe(200);
    expect(listed.body.data.some(item => item.file_path.includes('.private') || item.file_path.includes('node_modules'))).toBe(false);
    expect(listed.body.data.some(item => item.file_path === 'output:docs/binary.bin')).toBe(true);
    const stats = await request('GET', '/api/document/stats');
    expect(stats.status).toBe(200);
    expect(stats.body.data.total_documents).toBe(listed.body.data.length);
    expect(stats.body.data.total_size).toBe(listed.body.data.reduce((sum, item) => sum + item.file_size, 0));
    expect(stats.body.data.total_tokens).toBe(12);
  });

  test('原样预览拒绝编码与符号链接逃逸并保留合法文件响应头', async () => {
    const output = path.join(root, 'output');
    fs.writeFileSync(path.join(root, 'outside.md'), '# 根外资料\n');
    fs.symlinkSync(path.join(root, 'outside.md'), path.join(output, 'docs', 'outside-link.md'));
    fs.writeFileSync(path.join(output, '.visible.md'), '# 点文件\n');
    fs.writeFileSync(path.join(output, 'docs', 'preview.html'), '<h1>预览</h1>');

    for (const route of [
      '/api/document/raw/unknown/docs/other.md',
      '/api/document/raw/output/docs',
      '/api/document/raw/output/docs/missing.md',
      '/api/document/raw/output/%252e%252e%252foutside.md',
      '/api/document/raw/output/docs/%25ZZ',
      '/api/document/raw/output/docs/%2500invalid.md',
      '/api/document/raw/output/docs/outside-link.md',
    ]) {
      expect((await request('GET', route)).status).toBe(404);
    }
    const html = await request('GET', '/api/document/raw/output/docs/preview.html');
    expect(html.status).toBe(200);
    expect(html.headers.get('content-type')).toMatch(/^text\/html/);
    expect(html.headers.get('content-disposition')).toBe('inline');
    expect(html.headers.get('x-content-type-options')).toBe('nosniff');
    expect(html.body).toBe('<h1>预览</h1>');
    const dotfile = await request('GET', '/api/document/raw/output/.visible.md');
    expect(dotfile.status).toBe(200);
    expect(dotfile.body).toBe('# 点文件\n');
  });

  test('评论存储损坏时读写报错，恢复后可继续使用', async () => {
    const id = encodeURIComponent(docId('docs/other.md'));
    const commentsPath = path.join(root, 'comments.json');
    expect((await request('POST', `/api/document/${id}/comments`, { content: '说明', quote: 42 })).status).toBe(400);
    expect((await request('GET', `/api/document/${encodeURIComponent(docId('docs/missing.md'))}/comments`)).status).toBe(404);
    const original = fs.existsSync(commentsPath) ? fs.readFileSync(commentsPath, 'utf8') : null;
    try {
      fs.writeFileSync(commentsPath, '{broken');
      const listing = await request('GET', `/api/document/${id}/comments`);
      expect(listing).toMatchObject({ status: 500, body: { message: '评论读取失败' } });
      const creation = await request('POST', `/api/document/${id}/comments`, { content: '新评论' });
      expect(creation).toMatchObject({ status: 500, body: { message: '评论保存失败' } });
      const deletion = await request('DELETE', `/api/document/${id}/comments/missing`);
      expect(deletion).toMatchObject({ status: 500, body: { message: '评论删除失败' } });
    } finally {
      if (original === null) fs.rmSync(commentsPath, { force: true });
      else fs.writeFileSync(commentsPath, original);
    }
    const created = await request('POST', `/api/document/${id}/comments`, { content: '恢复后的评论' });
    expect(created.status).toBe(201);
    expect((await request('GET', `/api/document/${id}/comments`)).body.data)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: created.body.data.id, content: '恢复后的评论' })]));
  });

  test('详情、正文、下载、删除分别拒绝无效 ID 与缺失文件', async () => {
    const escaped = encodeURIComponent(docId('../outside.md'));
    const missing = encodeURIComponent(docId('docs/missing.md'));
    for (const suffix of ['', '/content', '/download']) {
      expect((await request('GET', `/api/document/${escaped}${suffix}`)).status).toBe(404);
      expect((await request('GET', `/api/document/${missing}${suffix}`)).status).toBe(404);
    }
    expect((await request('DELETE', `/api/document/${escaped}`)).status).toBe(404);
    expect((await request('DELETE', `/api/document/${missing}`)).status).toBe(404);
    expect((await request('DELETE', `/api/document/${encodeURIComponent(readonlyId('reference.md'))}`)).status).toBe(403);
    expect((await request('GET', `/api/document/${missing}/versions`)).body.data).toEqual([]);
  });

  test('隔离配置与元数据损坏时降级，恢复后原投影重新可用', async () => {
    const configFile = path.join(root, 'service.json');
    const metadataFile = path.join(root, 'output', 'metadata.json');
    const generatedId = encodeURIComponent(docId('生成_文档.md'));
    const before = await request('GET', `/api/document/${generatedId}`);
    expect(before.body.data.title).toBe('生成/文档');
    expect((await request('GET', '/api/document/stats')).body.data.total_tokens).toBe(12);

    const originalConfig = fs.readFileSync(configFile, 'utf8');
    try {
      fs.writeFileSync(configFile, '{broken');
      const paths = await request('GET', '/api/document/paths');
      expect(paths.status).toBe(200);
      expect(paths.body.data.map(item => item.id)).toEqual(['output']);
      fs.rmSync(configFile);
      expect((await request('GET', '/api/document/paths')).body.data.map(item => item.id)).toEqual(['output']);
    } finally {
      fs.writeFileSync(configFile, originalConfig);
    }

    const originalMetadata = fs.readFileSync(metadataFile, 'utf8');
    try {
      fs.writeFileSync(metadataFile, '{broken');
      const detail = await request('GET', `/api/document/${generatedId}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.title).toBe('生成_文档');
      expect((await request('GET', `/api/document/${generatedId}/content`)).body.data.content).toContain('隔离正文');
      expect((await request('GET', '/api/document/stats')).body.data.total_tokens).toBe(0);
    } finally {
      fs.writeFileSync(metadataFile, originalMetadata);
    }
    expect((await request('GET', `/api/document/${generatedId}`)).body.data.title).toBe('生成/文档');
    expect((await request('GET', '/api/document/stats')).body.data.total_tokens).toBe(12);

    const processedMetadataFile = path.join(root, 'agent-runner', 'tmp', 'doc-processed', 'metadata.json');
    const originalProcessedMetadata = fs.readFileSync(processedMetadataFile, 'utf8');
    try {
      fs.writeFileSync(processedMetadataFile, '{broken');
      expect((await request('GET', '/api/document/preprocess')).body.data).toEqual([]);
    } finally {
      fs.writeFileSync(processedMetadataFile, originalProcessedMetadata);
    }
    expect((await request('GET', '/api/document/preprocess')).status).toBe(200);
  });

  test('预处理索引为合法 JSON 空值时返回错误，恢复后可继续列出文档', async () => {
    const metadataFile = path.join(root, 'agent-runner', 'tmp', 'doc-processed', 'metadata.json');
    const original = fs.readFileSync(metadataFile, 'utf8');
    try {
      fs.writeFileSync(metadataFile, 'null');
      const failed = await request('GET', '/api/document/preprocess');
      expect(failed.status).toBe(500);
      expect(failed.body.success).toBe(false);
    } finally {
      fs.writeFileSync(metadataFile, original);
    }
    const recovered = await request('GET', '/api/document/preprocess');
    expect(recovered.status).toBe(200);
    expect(recovered.body.data).toEqual(JSON.parse(original).documents);
  });

  test('旧版无前缀和未知前缀标识通过配置首根目录解析', async () => {
    const output = path.join(root, 'output');
    fs.writeFileSync(path.join(output, 'legacy.md'), '# 旧文档');
    fs.writeFileSync(path.join(output, 'unknown:legacy.md'), '# 冒号文档');
    for (const name of ['legacy.md', 'unknown:legacy.md']) {
      const id = encodeURIComponent(Buffer.from(name).toString('base64'));
      expect((await request('GET', `/api/document/${id}/content`)).status).toBe(200);
    }
    const saved = await request('POST', '/api/document/save', { path: 'output:legacy.md', content: '# 更新旧文档' });
    expect(saved.status).toBe(200);
    expect(fs.readFileSync(path.join(output, 'legacy.md'), 'utf8')).toBe('# 更新旧文档');
  });

  test('根目录缺失返回空树，错误配置返回可诊断500且可恢复', async () => {
    const configFile = path.join(root, 'service.json');
    const original = fs.readFileSync(configFile, 'utf8');
    try {
      fs.writeFileSync(configFile, JSON.stringify({ documentPaths: [
        { id: 'missing', name: '缺失目录', path: path.join(root, 'missing-root') }
      ] }));
      const tree = await request('GET', '/api/document/tree');
      expect(tree.status).toBe(200);
      expect(tree.body.data).toEqual([expect.objectContaining({ root_id: 'missing', children: [], exists: false })]);
      fs.writeFileSync(configFile, '{"documentPaths":{}}');
      for (const [method, route, body] of [
        ['GET', '/paths'], ['GET', '/tree'], ['GET', '/list'], ['GET', '/stats'],
        ['POST', '/search', { keyword: '文档' }]
      ]) {
        const response = await request(method, `/api/document${route}`, body);
        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
      }
    } finally { fs.writeFileSync(configFile, original); }
    expect((await request('GET', '/api/document/paths')).status).toBe(200);
  });

  test('磁盘元数据写失败释放保存锁，下一次真实HTTP保存成功', async () => {
    const metadata = path.join(root, 'output', 'metadata.json');
    const doc = path.join(root, 'output', 'write-failure.md');
    fs.writeFileSync(doc, '# 初始内容');
    const originalWrite = fs.writeFileSync;
    const spy = jest.spyOn(fs, 'writeFileSync').mockImplementation((filename, ...args) => {
      if (String(filename) === metadata) throw new Error('隔离元数据写入失败');
      return originalWrite(filename, ...args);
    });
    try {
      const response = await request('POST', '/api/document/save', { id: docId('write-failure.md'), content: '# 更新' });
      expect(response.status).toBe(500);
      expect(response.body.message).toContain('隔离元数据写入失败');
    } finally { spy.mockRestore(); }
    const retry = await request('POST', '/api/document/save', { id: docId('write-failure.md'), content: '# 重试成功' });
    expect(retry.status).toBe(200);
    expect(fs.readFileSync(doc, 'utf8')).toBe('# 重试成功');
  });

  test.each(['detail', 'content', 'download', 'delete'])('文档%s文件访问错误通过HTTP返回500', async operation => {
    const filename = path.join(root, 'output', 'io-failure.md');
    fs.writeFileSync(filename, '# 文件访问故障');
    const id = encodeURIComponent(docId('io-failure.md'));
    // Fail only this document's existence probe, leaving config and logging IO real.
    const originalExists = fs.existsSync;
    const spy = jest.spyOn(fs, 'existsSync').mockImplementation(target => {
      if (String(target) === filename) throw new Error('隔离文件访问失败');
      return originalExists(target);
    });
    try {
      const route = `/api/document/${id}${['content', 'download'].includes(operation) ? `/${operation}` : ''}`;
      const response = await request(operation === 'delete' ? 'DELETE' : 'GET', route);
      expect(response.status).toBe(500);
      expect(response.body.message).toContain('隔离文件访问失败');
    } finally { spy.mockRestore(); }
  });

  test('预处理JSON损坏与写入失败返回错误，恢复后上传可继续', async () => {
    const processed = path.join(root, 'agent-runner', 'tmp', 'doc-processed');
    fs.mkdirSync(processed, { recursive: true });
    const malformed = path.join(processed, 'malformed.json');
    fs.writeFileSync(malformed, '{');
    expect((await request('GET', '/api/document/preprocess/malformed')).status).toBe(500);
    const originalWrite = fs.writeFileSync;
    const spy = jest.spyOn(fs, 'writeFileSync').mockImplementation((filename, ...args) => {
      if (String(filename) === path.join(processed, 'metadata.json')) throw new Error('隔离预处理写入失败');
      return originalWrite(filename, ...args);
    });
    const upload = async () => {
      const form = new FormData();
      form.append('file', new Blob(['# 隔离上传\n正文'], { type: 'text/markdown' }), 'recovery.md');
      return fetch(`${base}/api/document/preprocess`, { method: 'POST', body: form });
    };
    try {
      const response = await upload();
      expect(response.status).toBe(500);
      expect((await response.json()).message).toContain('隔离预处理写入失败');
    } finally { spy.mockRestore(); }
    const retry = await upload();
    expect(retry.status).toBe(200);
    const payload = await retry.json();
    expect(payload.success).toBe(true);
    expect((await request('DELETE', `/api/document/preprocess/${payload.data.id}`)).status).toBe(200);
  });

  test('不存在文档拒绝评论新增和删除；多条评论按创建时间排序', async () => {
    const missing = encodeURIComponent(docId('no-comment-target.md'));
    expect((await request('POST', `/api/document/${missing}/comments`, { content: '评论' })).status).toBe(404);
    expect((await request('DELETE', `/api/document/${missing}/comments/any`)).status).toBe(404);
    const filename = 'comment-sort.md';
    fs.writeFileSync(path.join(root, 'output', filename), '# 评论排序');
    const id = encodeURIComponent(docId(filename));
    for (const content of ['第一条', '第二条']) {
      expect((await request('POST', `/api/document/${id}/comments`, { content })).status).toBe(201);
    }
    expect((await request('GET', `/api/document/${id}/comments`)).body.data.map(item => item.content)).toEqual(['第一条', '第二条']);
  });

  test.each([null, { version: 2, comments: [] }, { version: 1, comments: {} }])('评论结构非法时拒绝读写且保留原始数据：%j', async invalid => {
    const comments = path.join(root, 'comments.json');
    const original = fs.readFileSync(comments, 'utf8');
    const id = encodeURIComponent(docId('docs/other.md'));
    const payload = JSON.stringify(invalid);
    try {
      fs.writeFileSync(comments, payload);
      expect(await request('GET', `/api/document/${id}/comments`)).toMatchObject({ status: 500, body: { success: false, message: '评论读取失败' } });
      expect(await request('POST', `/api/document/${id}/comments`, { content: '无效存储不写入' })).toMatchObject({ status: 500, body: { message: '评论保存失败' } });
      expect(fs.readFileSync(comments, 'utf8')).toBe(payload);
    } finally { fs.writeFileSync(comments, original); }
    expect((await request('GET', `/api/document/${id}/comments`)).status).toBe(200);
  });

  test('模型返回异常时生成失败不创建文件，恢复后可重试', async () => {
    const original = modelResponse;
    modelConfig = { model: 'isolated-model', api_key: 'fixture-key' };
    modelResponse = null;
    try {
      const failed = await request('POST', '/api/document/generate', { prompt: '测试失败恢复', filename: 'model-recovery.md' });
      expect(failed.status).toBe(500);
      expect(failed.body.message).toContain('文档生成失败');
      expect(fs.existsSync(path.join(root, 'output', 'model-recovery.md'))).toBe(false);
    } finally { modelResponse = original; }
    modelResponse = { content: '# 恢复成功' };
    expect((await request('POST', '/api/document/generate', { prompt: '重试', filename: 'model-recovery.md' })).status).toBe(200);
    expect(fs.readFileSync(path.join(root, 'output', 'model-recovery.md'), 'utf8')).toBe('# 恢复成功');
  });

  test('版本索引结构损坏返回500，恢复后版本读取成功', async () => {
    const metadata = path.join(root, 'output', 'metadata.json');
    const original = fs.readFileSync(metadata, 'utf8');
    const route = `/api/document/${encodeURIComponent(docId('docs/other.md'))}/versions`;
    try {
      fs.writeFileSync(metadata, JSON.stringify({ documents: [], versions: null }));
      expect(await request('GET', route)).toMatchObject({ status: 500, body: { success: false } });
    } finally { fs.writeFileSync(metadata, original); }
    expect((await request('GET', route)).status).toBe(200);
  });

  test('预处理文件删除故障保留元数据，恢复后可再次删除', async () => {
    const form = new FormData();
    form.append('file', new Blob(['# 删除恢复\n正文'], { type: 'text/markdown' }), 'delete-recovery.md');
    const upload = await fetch(`${base}/api/document/preprocess`, { method: 'POST', body: form });
    expect(upload.status).toBe(200);
    const doc = (await upload.json()).data;
    const directory = path.join(root, 'agent-runner', 'tmp', 'doc-processed');
    const metadata = path.join(directory, 'metadata.json');
    const before = fs.readFileSync(metadata, 'utf8');
    const target = path.join(directory, doc.stored_file);
    const unlink = fs.unlinkSync;
    const spy = jest.spyOn(fs, 'unlinkSync').mockImplementation(filename => {
      if (String(filename) === target) throw new Error('隔离删除故障');
      return unlink(filename);
    });
    try {
      expect(await request('DELETE', `/api/document/preprocess/${doc.id}`)).toMatchObject({
        status: 500, body: { success: false, message: '隔离删除故障' }
      });
      expect(fs.readFileSync(metadata, 'utf8')).toBe(before);
      expect(fs.existsSync(target)).toBe(true);
    } finally { spy.mockRestore(); }
    expect((await request('DELETE', `/api/document/preprocess/${doc.id}`)).status).toBe(200);
    expect(fs.existsSync(target)).toBe(false);
  });

});
