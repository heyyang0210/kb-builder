const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');

describe('知识中心静态入口与未知API真实HTTP边界', () => {
  let root, server, port, previous;
  beforeAll(async () => {
    previous = [process.env.KNOWLEDGE_STORAGE_MODE, process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE];
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    process.env.KNOWLEDGE_PLATFORM_CONFIG_MODE = 'file';
    const runtime = path.resolve(__dirname, '../../../runtime/test-results');
    fs.mkdirSync(runtime, { recursive: true });
    root = fs.mkdtempSync(path.join(runtime, 'gateway-static-'));
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>知识中心隔离首页</h1>');
    fs.writeFileSync(path.join(root, 'style.css'), 'body { color: green; }');
    fs.writeFileSync(path.join(root, 'template.xlsx'), 'fixture');
    const handler = createKnowledgeCenterHandler({
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, KNOWLEDGE_CENTER_ENTRY: 'index.html',
        OUTLINE_TEMPLATE_PATH: path.join(root, 'template.xlsx'), OUTLINE_SAMPLE_PATH: path.join(root, 'template.xlsx') },
      stores: { domainStore: {}, knowledgeAssetsStore: {}, manualStatusStore: {}, brandIconStore: {} },
      handbookProductionService: {}, documentTasksOptions: { filePath: path.join(root, 'tasks.json') },
      sendFile: (file, res) => {
        fs.readFile(file, (error, bytes) => {
          res.writeHead(error ? 404 : 200, { 'Content-Type': file.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8' });
          res.end(error ? '未找到文件' : bytes);
        });
      },
    });
    server = http.createServer((req, res) => { if (handler(req, res) === false) { res.writeHead(418); res.end('父路由响应'); } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });
  afterAll(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (root) fs.rmSync(root, { recursive: true, force: true });
    ['KNOWLEDGE_STORAGE_MODE', 'KNOWLEDGE_PLATFORM_CONFIG_MODE'].forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index];
    });
  });
  const request = target => new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path: target }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    }).on('error', reject);
  });
  test.each(['/knowledge-center', '/knowledge-center/', '/knowledge-center/index.html', '/knowledge-center/production/handbook/fixture?tab=writing'])('入口%s可直接打开或刷新', async target => {
    expect(await request(target)).toMatchObject({ status: 200, body: '<h1>知识中心隔离首页</h1>' });
  });
  test('带扩展名资源读取实际内容，缺失资源不返回SPA首页', async () => {
    expect(await request('/knowledge-center/style.css?version=1')).toMatchObject({ status: 200, headers: { 'content-type': 'text/css' }, body: 'body { color: green; }' });
    expect(await request('/knowledge-center/missing.js')).toMatchObject({ status: 404, body: '未找到文件' });
  });
  test('编码路径穿越被拒绝', async () => {
    expect(await request('/knowledge-center/%2e%2e%2fsecret.txt')).toMatchObject({ status: 400, body: 'Bad Request' });
  });
  test.each(['/knowledge-center/api', '/knowledge-center/api/not-an-api'])('未知接口%s返回稳定JSON且禁止缓存', async target => {
    const response = await request(target);
    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(JSON.parse(response.body)).toEqual({ success: false, error: { code: 'API_NOT_FOUND', message: '请求的接口不存在，请刷新页面后重试' } });
  });
  test.each(['/other-app/', '/knowledge-center-other'])('其他前缀%s交由父路由处理', async target => {
    expect(await request(target)).toMatchObject({ status: 418, body: '父路由响应' });
  });
});
