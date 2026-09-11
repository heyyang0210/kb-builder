const http = require('http');
const { createProxy } = require('../../../packages/agent-runner-core/lib/proxy-utils');

describe('知识中心非 JSON 响应透传契约', () => {
  let upstream;
  let gateway;
  let upstreamPort;
  let gatewayPort;

  beforeAll(async () => {
    upstream = http.createServer((req, res) => {
      if (req.url === '/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        });
        res.end('event: contract.test\\ndata: {"status":"ok"}\\n\\n');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="preview.pdf"',
      });
      res.end('%PDF-contract');
    });
    await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
    upstreamPort = upstream.address().port;
    const proxy = createProxy({
      targetHost: '127.0.0.1', targetPort: upstreamPort,
      pathTransform: req => req.url,
    });
    gateway = http.createServer((req, res) => proxy(req, res));
    await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
    gatewayPort = gateway.address().port;
  });

  afterAll(async () => {
    await Promise.all([upstream, gateway].map(server => new Promise(resolve => server.close(resolve))));
  });

  test('SSE 透传媒体/缓存/缓冲头并追加请求关联头', async () => {
    const response = await fetch(`http://127.0.0.1:${gatewayPort}/events`, {
      headers: { 'x-request-id': 'stream-contract-1', 'x-correlation-id': 'corr-contract-1' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^text\/event-stream/);
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    expect(response.headers.get('x-request-id')).toBe('stream-contract-1');
    expect(response.headers.get('x-correlation-id')).toBe('corr-contract-1');
    expect(await response.text()).toContain('event: contract.test');
  });

  test('文件透传保留 inline 处置和二进制内容', async () => {
    const response = await fetch(`http://127.0.0.1:${gatewayPort}/preview`, {
      headers: { 'x-request-id': 'file-contract-1' },
    });
    expect(response.headers.get('content-disposition')).toContain('inline');
    expect(response.headers.get('x-request-id')).toBe('file-contract-1');
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('%PDF-contract');
  });
});
