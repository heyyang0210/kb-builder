const http = require('node:http');
const https = require('node:https');
const zlib = require('node:zlib');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const { readWebReference, resolveTarget } = require('../../../packages/agent-runner-core/lib/production-web-reference');
let server, config;
beforeAll(async () => {
  server = http.createServer((req, res) => {
    const type = 'text/plain';
    if (req.url === '/deflate' || req.url === '/br') {
      const encoding = req.url.slice(1);
      res.writeHead(200, { 'content-type': type, 'content-encoding': encoding });
      return res.end(encoding === 'br' ? zlib.brotliCompressSync('压缩正文') : zlib.deflateSync('压缩正文'));
    }
    if (req.url === '/status') { res.writeHead(503); return res.end(); }
    if (req.url === '/redirect') { res.writeHead(302, { location: '/ok' }); return res.end(); }
    if (req.url === '/no-location') { res.writeHead(302); return res.end(); }
    if (req.url === '/encoding') { res.writeHead(200, { 'content-type': type, 'content-encoding': 'unsupported' }); return res.end('data'); }
    if (req.url === '/charset') { res.writeHead(200, { 'content-type': 'text/plain; charset=invalid-charset' }); return res.end('data'); }
    if (req.url === '/chunked') { res.writeHead(200, { 'content-type': type }); res.write('12345'); return res.end('67890'); }
    if (req.url === '/empty') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<html><body></body></html>'); }
    if (req.url === '/html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<h1>标题</h1><p>足够长的正文</p>'); }
    if (req.url === '/candidates') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<html><head><title>候选正文</title></head><body><section><p>短一</p><p>短二</p><p>短三</p></section><section><p>这是需要保留的第一段较长正文。</p><p>这是需要保留的第二段较长正文。</p><p>这是需要保留的第三段较长正文。</p><img alt="有效图片" src="/images/example.png"><img alt="无效图片" src="http://[invalid"></section></body></html>'); }
    if (req.url === '/missing-type') return res.end('data');
    res.writeHead(200, { 'content-type': type, 'content-encoding': 'identity' }); res.end('正常正文');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  config = { allowPublicWeb: true, maxBytes: 1024, timeoutMs: 1000,
    lookup: async () => [{ address: '1.1.1.1', family: 4 }],
    receive: (url, address, signal) => new Promise((resolve, reject) => {
      const request = http.get({ hostname: '127.0.0.1', port: server.address().port, path: url.pathname, signal }, resolve);
      request.on('error', reject);
    }),
  };
});
afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
const read = (route, overrides = {}) => readWebReference(`http://public.example${route}`, { ...config, ...overrides });
test.each([['http', http], ['https', https]])('生产%s接收器固定已校验DNS地址并监听请求错误', async (protocol, client) => {
  const get = jest.spyOn(client, 'get').mockImplementation((url, options, callback) => {
    const all = jest.fn();
    const single = jest.fn();
    options.lookup(url.hostname, { all: true }, all);
    options.lookup(url.hostname, { all: false }, single);
    expect(all).toHaveBeenCalledWith(null, [{ address: '1.1.1.1', family: 4 }]);
    expect(single).toHaveBeenCalledWith(null, '1.1.1.1', 4);
    expect(options.headers).toMatchObject({ Accept: expect.stringContaining('text/plain'), 'Accept-Encoding': 'gzip, deflate, br' });
    const response = Readable.from([Buffer.from('受控HTTP正文')]);
    response.statusCode = 200;
    response.headers = { 'content-type': 'text/plain; charset=utf-8', 'content-encoding': 'identity' };
    queueMicrotask(() => callback(response));
    return new EventEmitter();
  });
  try {
    const locator = `${protocol}://public.example/fixture`;
    await expect(readWebReference(locator, { ...config, receive: undefined }))
      .resolves.toMatchObject({ content: '受控HTTP正文', locator });
    expect(get).toHaveBeenCalledTimes(1);
  } finally {
    get.mockRestore();
  }
});
test.each([['http', http], ['https', https]])('生产%s接收器传播套接字错误且后续请求可恢复', async (protocol, client) => {
  const failure = new Error('isolated socket failure');
  const get = jest.spyOn(client, 'get').mockImplementation(() => {
    const request = new EventEmitter();
    queueMicrotask(() => request.emit('error', failure));
    return request;
  });
  try {
    await expect(readWebReference(`${protocol}://public.example/failure`, { ...config, receive: undefined }))
      .rejects.toBe(failure);
  } finally {
    get.mockRestore();
  }
  await expect(read('/ok')).resolves.toMatchObject({ content: '正常正文' });
});
test.each(['/deflate', '/br', '/ok'])('真实HTTP解码并保留正文 %s', async route => {
  expect(await read(route)).toMatchObject({ content: route === '/ok' ? '正常正文' : '压缩正文', locator: `http://public.example${route}` });
});
test.each([
  ['/status', 'AI_SOURCE_UNAVAILABLE', 502],
  ['/encoding', 'AI_SOURCE_FORMAT_UNSUPPORTED', 415],
  ['/charset', 'AI_SOURCE_FORMAT_UNSUPPORTED', 415],
  ['/empty', 'AI_SOURCE_EMPTY', 422],
  ['/missing-type', 'AI_SOURCE_FORMAT_UNSUPPORTED', 415],
  ['/no-location', 'AI_SOURCE_REDIRECT_LIMIT', 422],
])('真实HTTP明确拒绝异常并可恢复 %s', async (route, code, status) => {
  await expect(read(route)).rejects.toMatchObject({ code, status });
  await expect(read('/ok')).resolves.toMatchObject({ content: '正常正文' });
});
test('重定向限额、流式大小和提取正文大小分别受限', async () => {
  await expect(read('/redirect', { maxRedirects: 0 })).rejects.toMatchObject({ code: 'AI_SOURCE_REDIRECT_LIMIT' });
  await expect(read('/redirect')).resolves.toMatchObject({ locator: 'http://public.example/ok' });
  await expect(read('/chunked', { webMaxResponseBytes: 6 })).rejects.toMatchObject({ code: 'AI_SOURCE_TOO_LARGE' });
  await expect(read('/ok', { maxBytes: 2 })).rejects.toMatchObject({ code: 'AI_SOURCE_TOO_LARGE' });
  await expect(read('/html', { maxBytes: 2 })).rejects.toMatchObject({ code: 'AI_SOURCE_TOO_LARGE' });
});
test('非法地址、空DNS和解析超时返回可诊断错误', async () => {
  await expect(readWebReference('invalid', config)).rejects.toMatchObject({ code: 'AI_SOURCE_URL_INVALID' });
  await expect(resolveTarget(new URL('http://public.example'), {})).rejects.toMatchObject({ code: 'AI_SOURCE_URL_DENIED' });
  await expect(read('/ok', { lookup: async () => [] })).rejects.toMatchObject({ code: 'AI_SOURCE_URL_DENIED' });
  await expect(read('/ok', { timeoutMs: 10, lookup: () => new Promise(resolve => setTimeout(() => resolve([]), 30)) })).rejects.toMatchObject({ code: 'AI_SOURCE_UNAVAILABLE', status: 504 });
});
test('没有主内容标签时选择最长的正文候选并处理图片地址', async () => {
  const result = await read('/candidates');
  expect(result.title).toBe('候选正文');
  expect(result.content).toContain('这是需要保留的第一段较长正文');
  expect(result.content).not.toContain('短一');
  expect(result.content).toContain('http://public.example/images/example.png');
  expect(result.content).not.toContain('http://[invalid');
});
