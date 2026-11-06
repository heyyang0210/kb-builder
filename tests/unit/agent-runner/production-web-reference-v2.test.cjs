const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');

// 清除模块缓存以确保加载最新版本
delete require.cache[require.resolve('../../../packages/agent-runner-core/lib/production-web-reference')];
const { readWebReference, contentCache, browserPool } = require('../../../packages/agent-runner-core/lib/production-web-reference');

// ─── P1-1: LRU 缓存测试 ───
test('P1-1: LRU 缓存命中第二次请求不经过网络', async t => {
  let requestCount = 0;
  const server = http.createServer((req, res) => {
    requestCount++;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<html><head><title>缓存测试</title></head><body><main><h1>缓存内容</h1><p>这是缓存测试正文。</p></main></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const config = { allowPublicWeb: true, urlOrigins: [origin], maxBytes: 10240, timeoutMs: 5000 };

  // 首次请求
  const r1 = await readWebReference(origin + '/cache-test', config);
  assert.equal(requestCount, 1);
  assert.match(r1.content, /缓存内容/);

  // 第二次请求应命中缓存
  const r2 = await readWebReference(origin + '/cache-test', config);
  assert.equal(requestCount, 1, '第二次请求应命中缓存，不应增加网络请求');
  assert.equal(r2.content, r1.content);

  // 不同 URL 不命中缓存
  await readWebReference(origin + '/cache-test-2', config);
  assert.equal(requestCount, 2);
});

test('P1-1: 缓存键区分 Token/Cookie', async t => {
  let requestCount = 0;
  const server = http.createServer((req, res) => {
    requestCount++;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<html><head><title>T</title></head><body><main><p>内容</p></main></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;

  const config1 = { allowPublicWeb: true, urlOrigins: [origin], maxBytes: 10240, timeoutMs: 5000, supportApiToken: 'token-A' };
  const config2 = { allowPublicWeb: true, urlOrigins: [origin], maxBytes: 10240, timeoutMs: 5000, supportApiToken: 'token-B' };

  // tryApiFetch 先尝试 API（1次），然后 readRemoteResource（1次），共 2 次
  await readWebReference(origin + '/auth-test', config1);
  assert.equal(requestCount, 2, '首次请求：API尝试 + 网页读取');
  // 相同 Token 应命中缓存，不再请求
  await readWebReference(origin + '/auth-test', config1);
  assert.equal(requestCount, 2, '相同 Token 应命中缓存');
  // 不同 Token 应使用不同缓存键，重新请求
  await readWebReference(origin + '/auth-test', config2);
  assert.equal(requestCount, 4, '不同 Token 应使用不同缓存键');
});

// ─── P1-2: 指数退避重试测试 ───
test('P1-2: 503 错误自动重试并最终成功', async t => {
  let attempt = 0;
  const server = http.createServer((req, res) => {
    attempt++;
    if (attempt <= 2) {
      res.writeHead(503); res.end('Service Unavailable'); return;
    }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<html><head><title>重试成功</title></head><body><main><p>重试后内容。</p></main></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const config = { allowPublicWeb: true, urlOrigins: [origin], maxBytes: 10240, timeoutMs: 5000 };

  const result = await readWebReference(origin + '/retry-test', config);
  assert.equal(attempt, 3, '应重试 2 次后第 3 次成功');
  assert.match(result.content, /重试后内容/);
});

test('P1-2: 404 错误不重试直接失败', async t => {
  let attempt = 0;
  const server = http.createServer((req, res) => {
    attempt++;
    res.writeHead(404); res.end('Not Found');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const config = { allowPublicWeb: true, urlOrigins: [origin], maxBytes: 10240, timeoutMs: 5000 };

  await assert.rejects(readWebReference(origin + '/not-found', config), { code: 'AI_SOURCE_UNAVAILABLE' });
  assert.equal(attempt, 1, '404 不应重试');
});

// ─── P0-2: 增强内容提取测试 ───
test('P0-2: 无 main 标签时通过内容评分提取最佳容器', async t => {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    // 无 main/article 标签，内容分散在多个 div 中
    res.end(`<html><head><title>评分测试</title></head><body>
      <div class="sidebar"><p>侧边栏短文本。</p></div>
      <div class="content-area">
        <h2>核心标题</h2>
        <p>这是第一段正文内容，包含足够的文本长度来通过评分筛选。</p>
        <p>这是第二段正文内容，进一步增加文本密度和段落数量。</p>
        <p>这是第三段，确保内容评分足够高。</p>
        <ul><li>列表项1</li><li>列表项2</li><li>列表项3</li></ul>
      </div>
      <div class="footer"><p>页脚。</p></div>
    </body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const config = { allowPublicWeb: true, urlOrigins: [origin], maxBytes: 10240, timeoutMs: 5000 };

  const result = await readWebReference(origin + '/scoring-test', config);
  assert.match(result.content, /核心标题/);
  assert.match(result.content, /第一段正文/);
  assert.doesNotMatch(result.content, /侧边栏短文本/);
  assert.doesNotMatch(result.content, /页脚/);
});

test('P0-2: 空 body SPA 页面在无 Puppeteer 时报错', async t => {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<html><head><title>SPA</title></head><body><div id="app"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const config = { allowPublicWeb: true, urlOrigins: [origin], maxBytes: 10240, timeoutMs: 5000 };

  await assert.rejects(readWebReference(origin + '/spa-empty', config), { code: 'AI_SOURCE_EMPTY' });
});

test('P0-2: 检测多种 SPA 挂载点', async t => {
  const { readWebReference: rwr } = require('../../../packages/agent-runner-core/lib/production-web-reference');
  // 通过检测函数间接验证 — 构造不同挂载点的 HTML
  const mountPoints = [
    '<div id="app"></div>',
    '<div id="root"></div>',
    '<div id="__nuxt"></div>',
    '<div id="__next"></div>',
  ];
  for (const mp of mountPoints) {
    const html = `<html><body>${mp}<script src="/app.js"></script></body></html>`;
    // 验证 detectSPA 逻辑（通过 readWebReference 的错误码间接验证）
    const server = http.createServer((req, res) => {
      res.setHeader('content-type', 'text/html');
      res.end(html);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const config = { allowPublicWeb: true, urlOrigins: [origin], maxBytes: 10240, timeoutMs: 2000 };
    try {
      await rwr(origin + '/spa', config);
    } catch (e) {
      assert.equal(e.code, 'AI_SOURCE_EMPTY', `挂载点 ${mp} 应被识别为 SPA`);
    }
    server.closeAllConnections(); server.close();
  }
});

// ─── 综合: 缓存 + 重试协同 ───
test('综合: 首次失败后重试成功，结果被缓存', async t => {
  // 先清除相关缓存
  contentCache.reset();

  let attempt = 0;
  const server = http.createServer((req, res) => {
    attempt++;
    if (attempt === 1) { res.writeHead(502); res.end(); return; }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<html><head><title>综合测试</title></head><body><main><p>综合测试正文。</p></main></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const config = { allowPublicWeb: true, urlOrigins: [origin], maxBytes: 10240, timeoutMs: 5000 };

  const r1 = await readWebReference(origin + '/combo', config);
  assert.equal(attempt, 2);
  assert.match(r1.content, /综合测试正文/);

  // 第二次应命中缓存
  const r2 = await readWebReference(origin + '/combo', config);
  assert.equal(attempt, 2, '缓存命中，不应再次请求');
  assert.equal(r2.content, r1.content);
});

// ─── 原有功能回归 ───
test('回归: 标准 HTML 提取、重定向、限制检查仍正常', async t => {
  const server = http.createServer((req, res) => {
    if (req.url === '/redirect') { res.writeHead(302, { location: '/html' }); res.end(); return; }
    if (req.url === '/loop') { res.writeHead(302, { location: '/loop' }); res.end(); return; }
    if (req.url === '/big') { res.setHeader('content-type', 'text/plain'); res.end('x'.repeat(4096)); return; }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<html><head><title>回归测试</title></head><body><main><h1>回归</h1><p>OK</p></main></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const config = { allowPublicWeb: true, urlOrigins: [origin], maxRedirects: 3, maxBytes: 1024, timeoutMs: 1000 };

  const doc = await readWebReference(origin + '/redirect', config);
  assert.equal(doc.title, '回归测试');
  assert.match(doc.content, /回归/);
  await assert.rejects(readWebReference(origin + '/loop', config), { code: 'AI_SOURCE_REDIRECT_LIMIT' });
  await assert.rejects(readWebReference(origin + '/big', config), { code: 'AI_SOURCE_TOO_LARGE' });
});
