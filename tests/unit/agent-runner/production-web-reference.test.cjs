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
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<html><head><title>参数说明</title><script>secretScript()</script></head><body><nav>导航噪声</nav><main><h1>参数定义</h1><p>默认值为 42。</p><img src="/diagram.png" alt="结构图"><pre><code>SELECT 1;</code></pre></main><footer>页脚噪声</footer></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const config = { allowPublicWeb: true, urlOrigins: [origin], maxRedirects: 3, maxBytes: 1024, timeoutMs: 1000 };
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
});
