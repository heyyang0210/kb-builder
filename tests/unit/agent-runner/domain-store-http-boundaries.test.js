const http = require('node:http');
const { DomainStore, DomainStoreError } = require('../../../packages/agent-runner-core/lib/domain-store');

describe('领域存储异步 HTTP 状态边界', () => {
  let server;
  let store;
  const calls = [];

  beforeAll(async () => {
    server = http.createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      calls.push({ method: req.method, url: req.url, body, headers: req.headers });
      res.setHeader('content-type', 'application/json');
      if (req.url.startsWith('/success')) {
        res.setHeader('server-timing', 'storage-total;dur=3.2');
        return res.end(JSON.stringify({ success: true, data: { accepted: true } }));
      }
      if (req.url.startsWith('/conflict')) return res.end(JSON.stringify({ success: false, error: { code: 'REVISION_CONFLICT', message: '版本冲突' } }));
      if (req.url.startsWith('/invalid')) {
        res.statusCode = 422;
        return res.end(JSON.stringify({ success: false, error: { code: 'INVALID_DOMAIN_PAYLOAD' } }));
      }
      res.statusCode = 503;
      return res.end(JSON.stringify({ success: false, error: { code: 'DOMAIN_UNAVAILABLE', status: 503 } }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    store = new DomainStore({ baseUrl: `http://127.0.0.1:${server.address().port}`, timeoutMs: 1500 });
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
  });

  test('方法 × 正文 × 自定义请求头：写入参数通过真实 HTTP 传递', async () => {
    expect(await store.requestAsync('PATCH', '/success?type=outline', { revision: 2 }, { 'If-Match': '1' })).toMatchObject({ data: { accepted: true } });
    expect(calls.at(-1)).toMatchObject({ method: 'PATCH', url: '/success?type=outline', body: '{"revision":2}' });
    expect(calls.at(-1).headers['if-match']).toBe('1');
  });

  test('带元数据请求保留业务正文和 Server-Timing', async () => {
    const result = await store.requestAsyncWithMeta('GET', '/success');
    expect(result.body).toMatchObject({ data: { accepted: true } });
    expect(result.headers).toEqual({ serverTiming: 'storage-total;dur=3.2' });
  });

  test.each([
    ['/conflict', 'REVISION_CONFLICT', 409],
    ['/invalid', 'INVALID_DOMAIN_PAYLOAD', 422],
    ['/unavailable', 'DOMAIN_UNAVAILABLE', 503],
  ])('HTTP/业务错误组合 %s 映射为 %s 与 %i', async (route, code, status) => {
    await expect(store.requestAsync('GET', route)).rejects.toMatchObject({ code, status });
  });

  test('连接失败给出可供调用方处理的 503 错误', async () => {
    const unreachable = new DomainStore({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 1000 });
    await expect(unreachable.requestAsync('GET', '/v1/domain/outlines')).rejects.toMatchObject({
      code: 'DOMAIN_UNAVAILABLE', status: 503,
    });
    expect(DomainStoreError).toBeInstanceOf(Function);
  });
});
