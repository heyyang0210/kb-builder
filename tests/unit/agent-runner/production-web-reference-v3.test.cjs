const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

delete require.cache[require.resolve('../../../packages/agent-runner-core/lib/production-web-reference')];
const { readWebReference, contentCache } = require('../../../packages/agent-runner-core/lib/production-web-reference');

test('P0: Readability.js 提取质量', async t => {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<html><head><title>Readability 测试</title><meta charset="utf-8"></head><body><nav>导航</nav><aside>侧边栏</aside><article><h1>核心标题</h1><p>第一段正文内容足够长到通过 Readability 筛选。</p><p>第二段正文内容也足够长。</p><p>第三段正文内容也足够长。</p><p>第四段正文内容确保足够的文本密度。</p></article><footer>页脚</footer></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const config = { allowPublicWeb: true, urlOrigins: [origin], maxBytes: 10240, timeoutMs: 5000 };

  const result = await readWebReference(origin + '/test', config);
  assert.match(result.title, /Readability 测试/);
  assert.match(result.content, /核心标题/);
  assert.doesNotMatch(result.content, /短。/);
  assert.doesNotMatch(result.content, /脚。/);
});

test('P0: 验证码检测', async t => {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<html><body><div class="captcha">请完成安全验证</div></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const config = { allowPublicWeb: true, urlOrigins: [origin], maxBytes: 10240, timeoutMs: 5000 };

  await assert.rejects(readWebReference(origin + '/captcha', config), { code: 'AI_SOURCE_CAPTCHA' });
});

test('P0: 请求头随机化', async t => {
  let receivedUA = '';
  const server = http.createServer((req, res) => {
    receivedUA = req.headers['user-agent'];
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<html><head><title>UA</title></head><body><article><p>内容</p></article></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const config = { allowPublicWeb: true, urlOrigins: [origin], maxBytes: 10240, timeoutMs: 5000 };

  await readWebReference(origin + '/ua', config);
  assert.match(receivedUA, /Mozilla|Chrome|Safari|Firefox/);
});

test('回归：重定向和提取', async t => {
  const server = http.createServer((req, res) => {
    if (req.url === '/redirect') { res.writeHead(302, { location: '/html' }); res.end(); return; }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<html><head><title>回归</title></head><body><article><h1>回归测试</h1><p>OK</p></article></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const config = { allowPublicWeb: true, urlOrigins: [origin], maxRedirects: 3, maxBytes: 1024, timeoutMs: 1000 };

  const doc = await readWebReference(origin + '/redirect', config);
  assert.equal(doc.title, '回归');
  assert.match(doc.content, /回归测试/);
});
