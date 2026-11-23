const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { FileAggregateStore } = require('../../../packages/agent-runner-core/lib/aggregate-store');
const { createProductionAISources } = require('../../../packages/agent-runner-core/lib/production-ai-sources');
const { CONFIG_PATHS } = require('../../../packages/agent-runner-core/lib/config-registry');
const defaults = JSON.parse(fs.readFileSync(CONFIG_PATHS.contentRules, 'utf8')).productionAI.sources;
const ctx = { handbookId: 'HB', documentId: 'doc', outlineVersionId: 'v1', branch: 'main' };
const session = { user: { id: 'writer' } };
const key = value => JSON.stringify([value.handbookId, value.documentId, value.outlineVersionId, value.branch]);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSFEAAAAASUVORK5CYII=', 'base64');
class SourceError extends Error {
  constructor(code, message, status) { super(message); Object.assign(this, { code, status }); }
}
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

describe('AI 来源公开边界及真实上游 HTTP', () => {
  let root, store, config, mcpConfig, sources, server, base, reply, requests;
  function setup(extra = {}) {
    sources = createProductionAISources({
      store, context: input => Object.fromEntries(Object.keys(ctx).map(name => [name, input[name]])), contextKey: key,
      actor: current => ({ id: current.user.id }), requireCapability: (current, capability) => {
        if (!current?.user || current.denied) throw new SourceError('FORBIDDEN', capability, 403);
      }, ErrorType: SourceError, rules: () => ({ sources: config }), now: () => Date.parse('2026-11-10T00:00:00Z'),
      loadMCPConfig: async () => mcpConfig, pingcodeBaseURL: base, repositoryRoot: root, sourceImageRoot: path.join(root, 'images'), ...extra
    });
    return sources;
  }
  const preview = (sourceType, locator, extra = {}, diagnostic) => sources.preview({ ...ctx, sourceType, locator, ...extra }, session, diagnostic);
  const upload = (buffer, fileName = 'file.md', mimeType) => sources.previewUpload(ctx, buffer, fileName, mimeType, session);
  const writeCase = (name, content) => {
    const file = path.join(root, 'cases', name);
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content);
  };
  beforeEach(async () => {
    const parent = path.resolve(__dirname, '../../../runtime/test-tmp');
    fs.mkdirSync(parent, { recursive: true }); root = fs.mkdtempSync(path.join(parent, 'sources-boundaries-'));
    store = new FileAggregateStore(path.join(root, 'state.json'), {});
    config = { ...structuredClone(defaults), testCaseRoot: 'cases', pingcodeSpaces: ['SPACE'], pingcodeOrigins: ['https://ping.example.test'] };
    mcpConfig = {}; requests = [];
    reply = { status: 200, document: { spaceKey: 'SPACE', pageId: 'PAGE', title: '设计说明', content: '数据库设计正文' } };
    server = http.createServer(async (req, res) => {
      let body = ''; for await (const chunk of req) body += chunk;
      requests.push({ url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null });
      if (req.url === '/mcp') {
        const message = JSON.parse(body);
        if (message.method === 'notifications/initialized') { res.writeHead(202); res.end(); return; }
        const result = message.method === 'initialize' ? { serverInfo: { name: 'isolated-source', version: '1' }, capabilities: {} } : reply.mcp;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result })); return;
      }
      res.writeHead(reply.status, { 'content-type': 'application/json', ...reply.headers });
      res.end(reply.raw === undefined ? JSON.stringify(reply.document) : reply.raw);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    setup();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('列表过滤停用服务与知识库，保留策略回退并检查用例目录', async () => {
    mcpConfig = { services: [
      { id: 'disabled', enabled: false },
      { id: 'active', name: '可用服务', knowledgeBases: [{ id: 'kb', name: '可用库' }, { id: 'off', enabled: false }] },
      { id: 'unsupported', adapter: 'other' }
    ] };
    config.upload = undefined; config.referenceListCollapsedCount = 0;
    let result = await sources.list(ctx, session);
    expect(result.mcpServices).toEqual([{ id: 'active', name: '可用服务', adapter: 'yashandb', knowledgeBases: [{ id: 'kb', name: '可用库' }] }, { id: 'unsupported', adapter: 'other', knowledgeBases: [] }]);
    expect(result.upload).toEqual({ extensions: defaults.upload.extensions, maxBytes: defaults.upload.maxBytes });
    expect(result.referenceListCollapsedCount).toBe(defaults.referenceListCollapsedCount);
    expect(result.items.find(item => item.sourceType === 'test-case-library').available).toBe(false);
    writeCase('case.md', '用例');
    result = await sources.list(ctx, session);
    expect(result.items.find(item => item.sourceType === 'test-case-library').available).toBe(true);
    expect(result.items.find(item => item.sourceType === 'knowledge-mcp').available).toBe(true);
    config.testCaseRoot = '../outside';
    expect((await sources.list(ctx, session)).items.find(item => item.sourceType === 'test-case-library').available).toBe(false);
    config.testCaseRoot = 'file'; fs.writeFileSync(path.join(root, 'file'), 'not directory');
    expect((await sources.list(ctx, session)).items.find(item => item.sourceType === 'test-case-library').available).toBe(false);
  });

  test('旧版 MCP 配置和缺省来源开关保持可用性语义', async () => {
    mcpConfig = { server_url: `${base}/mcp`, search_knowledge_base_header: 'X-KB' };
    config.pingcodeSpaces = undefined; config.mcpRetrieval = undefined; config.testCaseRoot = undefined;
    config.allowPublicWeb = false; config.urlOrigins = [];
    const result = await sources.list(ctx, session);
    expect(result.items.find(item => item.sourceType === 'knowledge-mcp').available).toBe(true);
    expect(result.items.find(item => item.sourceType === 'url').available).toBe(false);
    expect(result.items.find(item => item.sourceType === 'pingcode-design').available).toBe(true);
    expect(result).toMatchObject({ pingcodeSpaces: [], mcpRetrieval: { version: null } });
  });

  test('未指定仓库路径时使用产品默认路径', async () => {
    setup({ repositoryRoot: undefined });
    const result = await sources.list(ctx, session);
    const directory = path.resolve(__dirname, '../../../cases');
    expect(result.items.find(item => item.sourceType === 'test-case-library').available).toBe(fs.existsSync(directory) && fs.statSync(directory).isDirectory());
  });

  test('用例库真实读取、快照摘要和深复制', async () => {
    writeCase('sub/case.sql', 'SELECT 1;');
    const result = await preview('test-case-library', 'sub/case.sql');
    expect(result).toMatchObject({ title: 'case.sql', locator: 'sub/case.sql', content: 'SELECT 1;', contentDigest: digest('SELECT 1;'), fetchedAt: '2026-11-10T00:00:00.000Z', context: ctx, createdBy: { id: 'writer' } });
    result.content = '客户端改动';
    expect(store.read().aiSources[result.sourceId].content).toBe('SELECT 1;');
  });

  test.each(['../outside.md', 'bad.exe', '/etc/passwd', 'a/../file.txt'])('拒绝非法用例定位 %s', async locator => {
    writeCase('valid.md', '正文');
    await expect(preview('test-case-library', locator)).rejects.toMatchObject({ code: 'AI_SOURCE_LOCATOR_INVALID' });
  });

  test('缺失库、缺失条目和目录冒充文件分别拒绝', async () => {
    await expect(preview('test-case-library', 'missing.md')).rejects.toMatchObject({ code: 'AI_SOURCE_NOT_CONFIGURED', status: 503 });
    writeCase('valid.md', '正文');
    await expect(preview('test-case-library', 'missing.md')).rejects.toMatchObject({ code: 'AI_SOURCE_NOT_FOUND', status: 404 });
    fs.mkdirSync(path.join(root, 'cases', 'directory.md'));
    await expect(preview('test-case-library', 'directory.md')).rejects.toMatchObject({ code: 'AI_SOURCE_NOT_FOUND' });
  });

  test.each([undefined, '', '   ', 'x'.repeat(defaults.maxLocatorChars + 1)])('定位缺失或超长拒绝 %#', async locator => {
    await expect(preview('test-case-library', locator)).rejects.toMatchObject({ code: 'AI_SOURCE_LOCATOR_REQUIRED' });
  });

  test('授权在列表、预览、上传和图片读取前执行，未知类型拒绝', async () => {
    const denied = { denied: true };
    await expect(sources.list(ctx, denied)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(sources.preview({ ...ctx, locator: 'anything' }, denied)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(sources.previewUpload(ctx, Buffer.from('正文'), 'a.md', '', denied)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(() => sources.readImage(ctx, denied)).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
    await expect(preview('unknown', 'anything')).rejects.toMatchObject({ code: 'AI_SOURCE_TYPE_INVALID' });
  });

  test.each(['SPACE/PAGE', 'SPACE/pages/PAGE', 'https://ping.example.test/wiki/spaces/SPACE/pages/PAGE#heading'])('真实 PingCode HTTP 读取并规范化 %s', async locator => {
    reply.document = { ...reply.document, sourceVersion: 3, sourceUpdatedAt: '2026-11-09', originalUrl: 'https://ping.example.test/original' };
    const diagnostic = {};
    const result = await preview('pingcode-design', locator, {}, diagnostic);
    expect(result).toMatchObject({ locator: 'SPACE/PAGE', title: '设计说明', sourceVersion: 3, sourceUpdatedAt: '2026-11-09', content: '数据库设计正文' });
    expect(result).not.toHaveProperty('authenticatedImages');
    expect(result.originalUrl).not.toContain('#');
    expect(requests[0].url).toBe('/api/pingcode/spaces/SPACE/pages/PAGE/reference?include_images=true');
    expect(diagnostic).toMatchObject({ stage: 'snapshot_persistence', upstreamStatus: 200, imageReady: 0, imageFailed: 0 });
  });

  test('PingCode 快照优先使用异步存储事务，避免同步阻塞请求线程', async () => {
    const original = store;
    let asyncWrites = 0;
    store = {
      read: () => original.read(),
      transaction: () => { throw new Error('禁止在请求线程执行同步存储事务'); },
      transactionAsync: async mutator => {
        asyncWrites += 1;
        await new Promise(resolve => setTimeout(resolve, 20));
        return original.transaction(mutator);
      },
    };
    setup();
    const result = await preview('pingcode-design', 'https://ping.example.test/wiki/spaces/SPACE/pages/PAGE');
    expect(result).toMatchObject({ title: '设计说明', content: '数据库设计正文' });
    expect(asyncWrites).toBe(1);
    expect(store.read().aiSources[result.sourceId].content).toBe('数据库设计正文');
  });

  test.each(['https://[', 'https://other.test/wiki/spaces/SPACE/pages/PAGE', 'https://u:p@ping.example.test/wiki/spaces/SPACE/pages/PAGE', 'https://ping.example.test/wiki/spaces/SPACE/pages/PAGE?q=1', 'SPACE/PAGE/extra', 'SPACE/!'])('PingCode 定位拒绝 %s', async locator => {
    await expect(preview('pingcode-test', locator)).rejects.toMatchObject({ code: 'AI_SOURCE_LOCATOR_INVALID' });
    expect(requests).toHaveLength(0);
  });

  test('其他合法空间交给 PingCode 权限核验，未配置服务拒绝，网址入口转交 PingCode', async () => {
    reply.document.spaceKey = 'OTHER';
    const other = await preview('pingcode-test', 'OTHER/PAGE');
    expect(other.locator).toBe('OTHER/PAGE');
    expect(requests[0].url).toBe('/api/pingcode/spaces/OTHER/pages/PAGE/reference?include_images=true');
    reply.document.spaceKey = 'SPACE';
    setup({ pingcodeBaseURL: null });
    await expect(preview('pingcode-test', 'SPACE/PAGE')).rejects.toMatchObject({ code: 'AI_SOURCE_NOT_CONFIGURED', status: 503 });
    setup();
    const result = await preview('url', 'https://ping.example.test/wiki/spaces/SPACE/pages/PAGE#part');
    expect(result.locator).toBe('https://ping.example.test/wiki/spaces/SPACE/pages/PAGE');
    await expect(preview('url', 'https://ping.example.test/wiki/spaces/SPACE')).rejects.toMatchObject({ code: 'AI_SOURCE_URL_DENIED' });
    await expect(preview('url', 'https://ping.example.test/wiki/spaces/SPACE/pages/PAGE?q=1')).rejects.toMatchObject({ code: 'AI_SOURCE_URL_DENIED' });
  });

  test('PingCode 基线想法列表从认证资料服务读取，保留筛选网址并拒绝未知参数', async () => {
    const locator = 'https://ping.example.test/ship/products/YASHAN/baselines/y28FbpmM/ideas?category=all';
    reply.document = { productCode: 'YASHAN', baselineId: 'y28FbpmM', category: 'all', title: 'YASHAN 基线想法', content: '想法列表正文' };
    const result = await preview('url', locator);
    expect(result).toMatchObject({ locator, originalUrl: locator, content: '想法列表正文' });
    expect(requests[0].url).toBe('/api/pingcode/products/YASHAN/baselines/y28FbpmM/ideas/reference?category=all');
    const categoryLocator = 'https://ping.example.test/ship/products/YASHAN/baselines/y28FbpmM/ideas?category=4iXjKHRH';
    reply.document = { ...reply.document, category: '4iXjKHRH' };
    const categoryResult = await preview('url', categoryLocator);
    expect(categoryResult).toMatchObject({ locator: categoryLocator, content: '想法列表正文' });
    expect(requests[1].url).toBe('/api/pingcode/products/YASHAN/baselines/y28FbpmM/ideas/reference?category=4iXjKHRH');
    await expect(preview('url', `${locator}&token=secret`)).rejects.toMatchObject({ code: 'AI_SOURCE_URL_DENIED' });
  });

  test.each([
    { document: { spaceKey: 'OTHER', pageId: 'PAGE', content: '正文' }, code: 'AI_SOURCE_UNAVAILABLE' },
    { document: { spaceKey: 'SPACE', pageId: 'OTHER', content: '正文' }, code: 'AI_SOURCE_UNAVAILABLE' },
    { document: { spaceKey: 'SPACE', pageId: 'PAGE', content: null }, code: 'AI_SOURCE_UNAVAILABLE' },
    { status: 403, code: 'AI_SOURCE_UNAVAILABLE' },
    { raw: '{broken', code: 'AI_SOURCE_UNAVAILABLE' },
    { document: { spaceKey: 'SPACE', pageId: 'PAGE', content: '   ' }, code: 'AI_SOURCE_EMPTY' }
  ])('PingCode 响应异常映射 %#', async scenario => {
    Object.assign(reply, scenario);
    const diagnostic = {};
    await expect(preview('pingcode-test', 'SPACE/PAGE', {}, diagnostic)).rejects.toMatchObject({ code: scenario.code });
    expect(diagnostic.causeCode).toEqual(expect.any(String));
    expect(store.read().aiSources).toBeUndefined();
  });

  test('正文大小和传输大小分别限制，非字符串标题和附加元数据不被猜测', async () => {
    config.maxBytes = 6;
    await expect(preview('pingcode-test', 'SPACE/PAGE')).rejects.toMatchObject({ code: 'AI_SOURCE_TOO_LARGE' });
    config.images.maxTotalBytes = 1; config.images.maxCount = 0;
    reply.raw = 'x'.repeat(100);
    await expect(preview('pingcode-test', 'SPACE/PAGE')).rejects.toMatchObject({ code: 'AI_SOURCE_TOO_LARGE' });
    config.maxBytes = defaults.maxBytes;
    delete reply.raw; reply.document = { spaceKey: 'SPACE', pageId: 'PAGE', content: 'ok', title: 7, sourceVersion: {}, sourceUpdatedAt: 0, imageResources: {}, originalUrl: 1 };
    const result = await preview('pingcode-test', 'SPACE/PAGE');
    expect(result.title).toBe('PAGE');
    expect(result).not.toHaveProperty('sourceVersion');
    expect(result).not.toHaveProperty('sourceUpdatedAt');
    expect(result).not.toHaveProperty('originalUrl');
    reply.headers = { 'content-length': String(defaults.maxBytes * 6 + 100) };
    await expect(preview('pingcode-test', 'SPACE/PAGE')).rejects.toMatchObject({ code: 'AI_SOURCE_TOO_LARGE' });
  });

  test('网址验证、网页边界错误和通用错误映射保留诊断', async () => {
    for (const locator of ['not a URL', 'file:///tmp/file', 'https://u:p@example.test/a']) {
      await expect(preview('url', locator)).rejects.toMatchObject({ code: locator === 'not a URL' ? 'AI_SOURCE_URL_INVALID' : 'AI_SOURCE_URL_DENIED' });
    }
    const web = require('../../../packages/agent-runner-core/lib/production-web-reference');
    const read = jest.spyOn(web, 'readWebReference');
    read.mockRejectedValueOnce(Object.assign(new Error('限制来源'), { code: 'AI_SOURCE_URL_DENIED', status: 403 }));
    await expect(preview('url', 'https://public.example.test/a')).rejects.toMatchObject({ code: 'AI_SOURCE_URL_DENIED', status: 403 });
    read.mockRejectedValueOnce(Object.assign(new Error('provider error'), { cause: { code: 'ERR<SECRET>' } }));
    const diagnostic = {};
    await expect(preview('url', 'https://public.example.test/a', {}, diagnostic)).rejects.toMatchObject({ code: 'AI_SOURCE_UNAVAILABLE' });
    expect(diagnostic.causeCode).toBe('ERRSECRET');
    read.mockResolvedValueOnce({ content: '公开正文', title: '公开页面', locator: 'https://public.example.test/a' });
    expect(await preview('url', 'https://public.example.test/a#part')).toMatchObject({ content: '公开正文' });
    expect(read).toHaveBeenLastCalledWith('https://public.example.test/a', config);
  });

  function useMcp(overrides = {}) {
    mcpConfig = { services: [{ id: 'service', name: '知识库服务', adapter: 'yashandb', server_url: `${base}/mcp`, search_knowledge_base_header: 'X-KB', knowledgeBases: [{ id: 'kb', name: '数据库', locator: 'database' }], ...overrides }] };
  }
  test('MCP 配置、服务与知识库选择和适配器约束', async () => {
    await expect(preview('knowledge-mcp', 'doc')).rejects.toMatchObject({ code: 'AI_SOURCE_NOT_CONFIGURED', status: 503 });
    useMcp();
    for (const selection of [{}, { mcpServiceId: 'missing' }, { mcpServiceId: 'service' }, { mcpServiceId: 'service', mcpKnowledgeBaseId: 'missing' }]) {
      await expect(preview('knowledge-mcp', 'doc', selection)).rejects.toMatchObject({ code: 'AI_SOURCE_NOT_CONFIGURED', status: 422 });
    }
    useMcp({ adapter: 'other' });
    await expect(preview('knowledge-mcp', 'doc', { mcpServiceId: 'service', mcpKnowledgeBaseId: 'kb' })).rejects.toMatchObject({ code: 'AI_SOURCE_NOT_CONFIGURED', status: 422 });
  });

  test.each([
    ['纯文本正文', { content: '纯文本正文' }],
    [JSON.stringify({ content: 'JSON正文', title: 'JSON标题', version: 3 }), { content: 'JSON正文', title: 'JSON标题', sourceVersion: 3 }],
    [JSON.stringify({ content: 'JSON正文', title: 5, version: {} }), { content: 'JSON正文' }],
    [JSON.stringify({ other: '不猜测schema' }), { content: JSON.stringify({ other: '不猜测schema' }) }]
  ])('真实 MCP 初始化与文档工具读取 %#', async (content, expected) => {
    useMcp(); reply.mcp = { content: [{ type: 'image', text: '忽略' }, { type: 'text', text: content }] };
    const result = await preview('knowledge-mcp', 'doc-id', { mcpServiceId: 'service', mcpKnowledgeBaseId: 'kb' });
    expect(result).toMatchObject({ ...expected, mcpServiceId: 'service', mcpServiceName: '知识库服务', mcpKnowledgeBaseId: 'kb', mcpKnowledgeBaseName: '数据库' });
    expect(requests.map(request => request.body.method)).toEqual(['initialize', 'notifications/initialized', 'tools/call']);
    expect(requests[2].body.params).toEqual({ name: 'get_ku_detail', arguments: { ku_name: 'doc-id' } });
    expect(requests[2].headers['x-kb']).toBe('database');
  });

  test('MCP 错误或缺失正文拒绝，旧版单服务无知识库仍可读取', async () => {
    useMcp();
    const selection = { mcpServiceId: 'service', mcpKnowledgeBaseId: 'kb' };
    for (const result of [null, { isError: true }, {}]) {
      reply.mcp = result;
      await expect(preview('knowledge-mcp', 'doc', selection)).rejects.toMatchObject({ code: result && !result.isError ? 'AI_SOURCE_EMPTY' : 'AI_SOURCE_UNAVAILABLE' });
    }
    mcpConfig = { server_url: `${base}/mcp`, search_knowledge_base_header: 'X-KB' };
    reply.mcp = { content: [{ type: 'text', text: '旧版正文' }] };
    expect(await preview('knowledge-mcp', 'doc')).toMatchObject({ content: '旧版正文', mcpServiceId: 'legacy-default' });
  });

  test('真实 Worker 上传净化文件名、MIME 回退和快照持久化', async () => {
    const result = await upload(Buffer.from('  SELECT 1;  '), '..\\source\\bad\u0001.sql');
    expect(result).toMatchObject({ sourceType: 'local-document', fileName: 'bad.sql', locator: 'bad.sql', content: 'SELECT 1;', mimeType: 'application/octet-stream', contentDigest: digest('SELECT 1;') });
    expect(store.read().aiSources[result.sourceId]).toEqual(result);
    expect((await upload(Buffer.from('正文'), 'doc.MD', 'text/markdown')).mimeType).toBe('text/markdown');
  });

  test('上传空、超限、扩展错误、解析失败和解析后空/超限分别拒绝', async () => {
    for (const buffer of [null, Buffer.alloc(0)]) await expect(upload(buffer)).rejects.toMatchObject({ code: 'AI_SOURCE_EMPTY' });
    config.upload.maxBytes = 4;
    await expect(upload(Buffer.from('12345'))).rejects.toMatchObject({ code: 'AI_SOURCE_TOO_LARGE' });
    config.upload.maxBytes = defaults.upload.maxBytes;
    await expect(upload(Buffer.from('ok'), undefined)).resolves.toMatchObject({ fileName: 'file.md' });
    await expect(upload(Buffer.from('ok'), '')).rejects.toMatchObject({ code: 'AI_SOURCE_TYPE_INVALID' });
    await expect(upload(Buffer.from('ok'), 'file.exe')).rejects.toMatchObject({ code: 'AI_SOURCE_TYPE_INVALID' });
    await expect(upload(Buffer.from([0xff]), 'bad.txt')).rejects.toMatchObject({ code: 'AI_SOURCE_PARSE_FAILED' });
    await expect(upload(Buffer.from('   '))).rejects.toMatchObject({ code: 'AI_SOURCE_EMPTY' });
    config.maxBytes = 2;
    await expect(upload(Buffer.from('long content'))).rejects.toMatchObject({ code: 'AI_SOURCE_TOO_LARGE' });
  });

  test('图片托管后增大正文时再次执行大小限制，快照不落盘', async () => {
    const content = '![图](source-image:test)';
    config.maxBytes = Buffer.byteLength(content) + 1;
    reply.document.content = content;
    reply.document.imageResources = [{ reference: 'source-image:test', status: 'ready', dataBase64: PNG.toString('base64') }];
    await expect(preview('pingcode-test', 'SPACE/PAGE')).rejects.toMatchObject({ code: 'AI_SOURCE_TOO_LARGE' });
    expect(store.read().aiSources).toBeUndefined();
  });

  test('确认快照验证归属、限制、去重、版本、访问限制页面和优先级', async () => {
    writeCase('case.md', '用例正文');
    const first = await preview('test-case-library', 'case.md');
    const second = await preview('test-case-library', 'case.md');
    const select = ids => sources.confirmed(store.read(), { ...ctx, confirmedSourceIds: ids }, session);
    expect(sources.confirmed({}, ctx, session)).toEqual([]);
    for (const ids of ['invalid', [first.sourceId, first.sourceId], [1], Array(config.maxConfirmed + 1).fill('id')]) expect(() => select(ids)).toThrow(expect.objectContaining({ code: 'AI_SOURCES_INVALID' }));
    expect(() => select(['missing'])).toThrow(expect.objectContaining({ code: 'AI_SOURCE_NOT_FOUND' }));
    expect(() => sources.confirmed(store.read(), { ...ctx, branch: 'other', confirmedSourceIds: [first.sourceId] }, session)).toThrow(expect.objectContaining({ code: 'AI_SOURCE_NOT_FOUND' }));
    expect(() => sources.confirmed(store.read(), { ...ctx, confirmedSourceIds: [first.sourceId] }, { user: { id: 'other' } })).toThrow(expect.objectContaining({ code: 'AI_SOURCE_NOT_FOUND' }));
    const selected = select([second.sourceId, first.sourceId]);
    expect(selected.map(source => source.priority)).toEqual([1, 2]);
    selected[0].content = '改动'; expect(store.read().aiSources[second.sourceId].content).toBe('用例正文');
    store.transaction(state => { state.aiSources[second.sourceId].contentDigest = 'different'; });
    expect(() => select([first.sourceId, second.sourceId])).toThrow(expect.objectContaining({ code: 'AI_SOURCE_VERSION_CONFLICT', status: 409 }));
    for (const restriction of [{ locator: 'https://public.test/login', content: '内容' }, { locator: 'https://public.test/article', content: '环境异常，需要完成验证后继续访问' }]) {
      store.transaction(state => { Object.assign(state.aiSources[first.sourceId], restriction, { sourceType: 'url' }); });
      expect(() => select([first.sourceId])).toThrow(expect.objectContaining({ code: 'AI_SOURCE_ACCESS_RESTRICTED', status: 422 }));
    }
  });

  test('图片按本人、自动检索和共享修订授权，跨上下文、缺失与损坏拒绝', async () => {
    reply.document.content = '![示意](source-image:test)';
    reply.document.imageResources = [{ reference: 'source-image:test', status: 'ready', dataBase64: PNG.toString('base64') }];
    const source = await preview('pingcode-design', 'SPACE/PAGE');
    const assetId = source.imageResources[0].assetId;
    const input = { ...ctx, assetId };
    expect(sources.readImage(input, session)).toEqual({ data: PNG, contentType: 'image/png' });
    expect(() => sources.readImage({ ...input, branch: 'other' }, session)).toThrow(expect.objectContaining({ code: 'AI_SOURCE_IMAGE_NOT_FOUND' }));
    expect(() => sources.readImage(input, { user: { id: 'other' } })).toThrow(expect.objectContaining({ code: 'AI_SOURCE_IMAGE_NOT_FOUND' }));
    store.transaction(state => { delete state.aiSources; state.aiJobs = { job: { contextKey: key(ctx), createdBy: { id: 'writer' }, sourceSnapshots: [source] }, unrelated: { contextKey: key(ctx) }, empty: { contextKey: key(ctx), createdBy: { id: 'writer' } } }; });
    expect(sources.readImage(input, session).data).toEqual(PNG);
    store.transaction(state => { delete state.aiJobs; state.drafts = { [key(ctx)]: { revisions: [{}, { generationMetadata: { sourceSnapshots: [{ contextKey: key(ctx) }, source] } }] } }; });
    expect(sources.readImage(input, { user: { id: 'other' } }).data).toEqual(PNG);
    expect(() => sources.readImage({ ...input, assetId: 'missing' }, session)).toThrow(expect.objectContaining({ code: 'AI_SOURCE_IMAGE_NOT_FOUND' }));
    fs.writeFileSync(path.join(root, 'images', assetId), 'tampered');
    expect(() => sources.readImage(input, session)).toThrow(expect.objectContaining({ code: 'AI_SOURCE_IMAGE_NOT_FOUND' }));
  });

  test('自动检索未配置返回明确状态，已有策略将快照托管并更新摘要', async () => {
    expect(await sources.retrieveAutomatic({}, {})).toEqual({ snapshots: [], retrieval: { status: 'not_configured', attempts: [] } });
    const retrieval = require('../../../packages/agent-runner-core/lib/production-ai-mcp-retrieval');
    const snapshot = { context: ctx, content: '自动读取正文', locator: 'mcp-document' };
    const retrieve = jest.spyOn(retrieval, 'retrieve').mockResolvedValue({ snapshots: [snapshot], retrieval: { status: 'completed' } });
    const job = { mcpRetrievalPolicy: { version: 1 } };
    expect(await sources.retrieveAutomatic(job)).toMatchObject({ snapshots: [{ contentDigest: digest(snapshot.content), imageResources: [] }] });
    expect(retrieve).toHaveBeenCalledWith(job, job.mcpRetrievalPolicy, mcpConfig, config.maxBytes, expect.any(Function));
    await sources.retrieveAutomatic(job, { services: [] });
    expect(retrieve.mock.calls[1][2]).toEqual({ services: [] });
  });
});
