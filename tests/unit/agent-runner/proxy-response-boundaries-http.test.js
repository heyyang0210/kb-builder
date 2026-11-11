const http = require('node:http');
const { createProxy } = require('../../../packages/agent-runner-core/lib/proxy-utils');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });

describe('代理响应转换真实HTTP边界', () => {
  let upstream, gateway, base, seen;
  beforeEach(async () => {
    seen = [];
    upstream = http.createServer((req, res) => {
      seen.push({ url: req.url, headers: req.headers });
      if (req.url === '/disconnect') return req.socket.destroy();
      res.writeHead(req.url.startsWith('/failure') ? 422 : 200, { 'content-type': 'application/json', 'x-upstream': 'retained' });
      res.write('{"value":'); res.end('1}');
    });
    await listen(upstream);
  });
  afterEach(async () => { if (gateway) { await close(gateway); gateway = null; } await close(upstream); });
  async function start(options, context = {}) {
    const proxy = createProxy({ targetHost: '127.0.0.1', targetPort: upstream.address().port, ...options });
    gateway = http.createServer((req, res) => proxy(req, res, context));
    await listen(gateway); base = `http://127.0.0.1:${gateway.address().port}`;
  }
  test.each([false, true])('转换结果未定义时保留原始正文及状态，错误响应=%s', async failure => {
    const transform = jest.fn(() => undefined);
    const validate = jest.fn();
    await start({ transformResponse: transform, normalizeErrorResponse: transform, validateResponse: validate });
    const response = await fetch(base + (failure ? '/failure' : '/success'));
    expect(response.status).toBe(failure ? 422 : 200);
    expect(response.headers.get('x-upstream')).toBe('retained');
    expect(await response.text()).toBe('{"value":1}');
    expect(transform).toHaveBeenCalledWith('{"value":1}', failure ? 422 : 200, expect.any(String), expect.any(String), {});
    expect(validate).not.toHaveBeenCalled();
  });
  test.each([{}, { endpoint: { id: 'asset-list' } }])('契约校验失败返回502和可定位原因 %#', async context => {
    const validate = jest.fn(() => { throw new TypeError('缺少data字段'); });
    await start({ transformResponse: raw => JSON.parse(raw), validateResponse: validate }, context);
    const response = await fetch(base + '/success', { headers: { 'x-request-id': 'proxy-request', 'x-correlation-id': 'proxy-correlation' } });
    expect(response.status).toBe(502);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe('proxy-request');
    expect(response.headers.get('x-correlation-id')).toBe('proxy-correlation');
    expect(await response.json()).toEqual({ success: false, error: {
      code: 'KNOWLEDGE_CONTRACT_INVALID', message: '下游响应不符合知识中心接口契约', retryable: false,
      requestId: 'proxy-request', correlationId: 'proxy-correlation', details: { reason: '缺少data字段', endpoint: context.endpoint?.id || null }
    } });
    expect(validate).toHaveBeenCalledWith({ value: 1 }, 200, context);
  });
  test.each(['function', 'object', 'null'])('断连按%s错误载荷输出502和关联ID', async kind => {
    const body = kind === 'null' ? null : { success: false, error: { code: 'TEST_UPSTREAM_FAILED', ...(kind === 'object' ? { requestId: 'preserved-request', correlationId: 'preserved-correlation' } : {}) } };
    const factory = jest.fn(() => body);
    await start({ errorPayload: kind === 'function' ? factory : body });
    const response = await fetch(base + '/disconnect', { headers: { 'x-request-id': 'disconnect-request', 'x-correlation-id': 'disconnect-correlation' } });
    expect(response.status).toBe(502);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe('disconnect-request');
    const result = await response.json();
    if (kind === 'null') expect(result).toBeNull();
    else expect(result.error).toEqual({ code: 'TEST_UPSTREAM_FAILED', requestId: kind === 'object' ? 'preserved-request' : 'disconnect-request', correlationId: kind === 'object' ? 'preserved-correlation' : 'disconnect-correlation' });
    if (kind === 'function') expect(factory).toHaveBeenCalledWith(expect.objectContaining({ code: 'ECONNRESET', message: 'socket hang up' }), 'disconnect-request', 'disconnect-correlation');
  });

  test('成功转换保留上游头并重算正文长度，路径和上下文头传递', async () => {
    const context = { tenant: 'isolated' };
    const transform = jest.fn(raw => ({ data: JSON.parse(raw), message: '成功' }));
    await start({ pathTransform: req => '/mapped' + req.url, requestHeaders: (_req, ctx) => ({ 'x-tenant': ctx.tenant }), transformResponse: transform }, context);
    const response = await fetch(base + '/input?q=1');
    const raw = await response.text();
    expect(response.status).toBe(200);
    expect(JSON.parse(raw)).toEqual({ data: { value: 1 }, message: '成功' });
    expect(Number(response.headers.get('content-length'))).toBe(Buffer.byteLength(raw));
    expect(response.headers.get('transfer-encoding')).toBeNull();
    expect(seen[0]).toMatchObject({ url: '/mapped/input?q=1', headers: { 'x-tenant': 'isolated' } });
    expect(seen[0].headers['x-correlation-id']).toBe(seen[0].headers['x-request-id']);
    expect(transform).toHaveBeenCalledWith('{"value":1}', 200, seen[0].headers['x-request-id'], seen[0].headers['x-request-id'], context);
  });
});
