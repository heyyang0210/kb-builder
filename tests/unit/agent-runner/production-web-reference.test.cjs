const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');
const { isPublicAddress, resolveTarget, readWebReference } = require('../../../packages/agent-runner-core/lib/production-web-reference');

test('public URL address policy rejects private, mixed DNS and IPv6 tunnels', async () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '100.64.0.1', '192.168.1.1',
    '0.0.0.0', '224.0.0.1', '::1', '::', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2002:7f00:1::', '2001:db8::1']) assert.equal(isPublicAddress(address), false, address);
  for (const address of ['93.184.215.14', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isPublicAddress(address), true, address);
  const config = { allowPublicWeb: true, urlOrigins: [] };
  await assert.rejects(resolveTarget(new URL('http://public.example'), config, async () => [
    { address: '1.1.1.1', family: 4 }, { address: '127.0.0.1', family: 4 },
  ]), { code: 'AI_SOURCE_URL_DENIED' });
  await assert.rejects(resolveTarget(new URL('http://user:pass@public.example'), config), { code: 'AI_SOURCE_URL_DENIED' });
  const pinned = await resolveTarget(new URL('https://public.example'), config, async () => [{ address: '1.1.1.1', family: 4 }]);
  assert.deepEqual(pinned, { address: '1.1.1.1', family: 4 });
});

test('real HTTP extracts HTML, follows checked redirects and enforces transport limits', async t => {
  const server = http.createServer((req, res) => {
    if (req.url === '/redirect') { res.writeHead(302, { location: '/html' }); res.end(); return; }
    if (req.url === '/loop') { res.writeHead(302, { location: '/loop' }); res.end(); return; }
    if (req.url === '/private') { res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data' }); res.end(); return; }
    if (req.url === '/big') { res.setHeader('content-type', 'text/plain'); res.end('x'.repeat(4096)); return; }
    if (req.url === '/zip') { res.writeHead(200, { 'content-type': 'text/plain', 'content-encoding': 'gzip' }); res.end(zlib.gzipSync('x'.repeat(4096))); return; }
    if (req.url === '/binary') { res.setHeader('content-type', 'application/pdf'); res.end('pdf'); return; }
    if (req.url === '/slow') return;
    if (req.url === '/large-html') { res.setHeader('content-type', 'text/html'); res.end(`<html><body><main><h1>Large document</h1><p>Useful content.</p></main><script>${'x'.repeat(1500)}</script></body></html>`); return; }
    if (req.url === '/ordinary-div') { res.setHeader('content-type', 'text/html'); res.end('<html><body><nav>menu</nav><div class="content"><h1>Guide</h1><p>First point.</p><p>Second point.</p><p>Third point.</p></div></body></html>'); return; }
    if (req.url === '/login') { res.setHeader('content-type', 'text/html'); res.end('<title>Sign in</title><body>Please sign in to continue</body>'); return; }
    if (req.url === '/captcha') { res.setHeader('content-type', 'text/html'); res.end('<title>安全验证</title><body>请完成人机验证</body>'); return; }
    if (req.url === '/wechat') { res.writeHead(302, { location: '/mp/wappoc_appmsgcaptcha' }); res.end(); return; }
    if (req.url === '/mp/wappoc_appmsgcaptcha') { res.setHeader('content-type', 'text/html'); res.end('<body>环境异常，完成验证后即可继续访问</body>'); return; }
    if (req.url === '/spa') { res.setHeader('content-type', 'text/html'); res.end('<html><body><div id="app"></div><script src="/app.js"></script></body></html>'); return; }
    if (req.url === '/spa-loading') { res.setHeader('content-type', 'text/html'); res.end('<html><body><div id="app">加载中…</div><script src="/app.js"></script></body></html>'); return; }
    if (req.url === '/app.js') { res.setHeader('content-type', 'application/javascript'); res.end('document.querySelector("#app").innerHTML="<main><h1>Rendered guide</h1><p>Dynamic body.</p></main>"'); return; }
    if (req.url === '/spa-private') { res.setHeader('content-type', 'text/html'); res.end('<html><body><div id="app"></div><script src="http://169.254.169.254/private.js"></script></body></html>'); return; }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<html><head><title>参数说明</title><script>secretScript()</script></head><body><nav>导航噪声</nav><main><h1>参数定义</h1><p>默认值为 42。</p><img src="/diagram.png" alt="结构图"><pre><code>SELECT 1;</code></pre></main><footer>页脚噪声</footer></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = 'http://public.example';
  const config = { allowPublicWeb: true, urlOrigins: [], maxRedirects: 3, maxBytes: 1024, webMaxResponseBytes: 1024, timeoutMs: 1000,
    lookup: async () => [{ address: '1.1.1.1', family: 4 }],
    receive: (url, _address, signal) => new Promise((resolve, reject) => {
      const request = http.get({ hostname: '127.0.0.1', port: server.address().port, path: url.pathname, signal }, resolve);
      request.on('error', reject);
    }),
  };
  const doc = await readWebReference(origin + '/redirect', config);
  assert.equal(doc.title, '参数说明');
  assert.match(doc.content, /参数定义.*默认值为 42。.*SELECT 1;/s);
  assert.match(doc.content, new RegExp(`!\\[结构图\\]\\(${origin.replaceAll('.', '\\.')}/diagram\\.png\\)`));
  assert.doesNotMatch(doc.content, /导航噪声|页脚噪声|secretScript/);
  assert.equal(doc.locator, origin + '/html');
  for (const [route, code] of [['/loop', 'AI_SOURCE_REDIRECT_LIMIT'], ['/private', 'AI_SOURCE_URL_DENIED'],
    ['/big', 'AI_SOURCE_TOO_LARGE'], ['/zip', 'AI_SOURCE_TOO_LARGE'], ['/binary', 'AI_SOURCE_FORMAT_UNSUPPORTED']]) {
    await assert.rejects(readWebReference(origin + route, config), { code });
  }
  await assert.rejects(readWebReference(origin + '/slow', { ...config, timeoutMs: 40 }));
  const plain = await readWebReference(origin + '/ordinary-div', config);
  assert.match(plain.content, /First point/);
  assert.doesNotMatch(plain.content, /menu/);
  const large = await readWebReference(origin + '/large-html', { ...config, webMaxResponseBytes: 2048 });
  assert.match(large.content, /Useful content/);
  for (const route of ['/login', '/captcha', '/wechat']) {
    await assert.rejects(readWebReference(origin + route, config), { code: 'AI_SOURCE_ACCESS_RESTRICTED' });
  }
  assert.equal((await readWebReference(origin + '/html', config)).originalUrl, origin + '/html');
  const rendered = await readWebReference(origin + '/spa', { ...config, timeoutMs: 5000 });
  assert.match(rendered.content, /Dynamic body/);
  const loading = await readWebReference(origin + '/spa-loading', { ...config, timeoutMs: 5000 });
  assert.match(loading.content, /Dynamic body/);
  assert.doesNotMatch(loading.content, /加载中/);
  await assert.rejects(readWebReference(origin + '/spa-private', { ...config, timeoutMs: 5000 }), { code: 'AI_SOURCE_EMPTY' });
});

test('historical verification snapshots remain stored but cannot be confirmed for generation', () => {
  const { createProductionAISources } = require('../../../packages/agent-runner-core/lib/production-ai-sources');
  class SourceError extends Error { constructor(code, message, status) { super(message); this.code = code; this.status = status; } }
  const source = { sourceId: 'old-captcha', sourceType: 'url', locator: 'https://mp.weixin.qq.com/mp/wappoc_appmsgcaptcha',
    content: '环境异常，完成验证后即可继续访问', contentDigest: 'old', contextKey: 'fixture', createdBy: { id: 'author' } };
  const state = { aiSources: { [source.sourceId]: source } };
  const sources = createProductionAISources({ store: { read: () => state }, context: () => ({}), contextKey: () => 'fixture',
    actor: () => ({ id: 'author' }), requireCapability() {}, ErrorType: SourceError,
    rules: () => ({ sources: { maxConfirmed: 8 } }), now: Date.now });
  assert.throws(() => sources.confirmed(state, { confirmedSourceIds: ['old-captcha'] }, {}), { code: 'AI_SOURCE_ACCESS_RESTRICTED' });
  assert.equal(state.aiSources['old-captcha'], source);
});
