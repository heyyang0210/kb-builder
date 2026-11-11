const http = require('http');
const { createProductionAIHttpStageAdapters, MAX_RESPONSE_BYTES } = require('../../../packages/agent-runner-core/lib/production-ai-http-stage-adapters');

describe('AI stage HTTP adapter boundary contracts', () => {
  let server;
  let endpoint;
  async function serve(handler) {
    server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    endpoint = `http://127.0.0.1:${server.address().port}/run`;
  }
  function adapter(extra = {}, stage = 'planner') {
    return createProductionAIHttpStageAdapters({ env: { [`KNOWLEDGE_PRODUCTION_${stage.toUpperCase()}_URL`]: endpoint, ...extra } })[stage];
  }
  afterEach(async () => {
    if (server) {
      await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
      server = undefined;
    }
  });
  test.each(['planner', 'evidence', 'writer', 'reviewer'])('%s sends JSON, optional token and excludes callback/signal fields', async stage => {
    let request;
    await serve(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      request = { method: req.method, headers: req.headers, body: JSON.parse(Buffer.concat(chunks)) };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ artifact: { text: 'generated' } }));
    });
    const token = stage === 'planner' ? { KNOWLEDGE_PRODUCTION_PLANNER_TOKEN: ' token ' } : {};
    const control = new AbortController();
    expect(await adapter(token, stage).run({ version: 1 }, { payload: 'input', signal: control.signal, onProgress() {} })).toEqual({ text: 'generated' });
    expect(request).toMatchObject({ method: 'POST', body: { envelope: { version: 1 }, input: { payload: 'input' } }, headers: { 'content-type': 'application/json', accept: 'application/json' } });
    expect(request.headers.authorization).toBe(stage === 'planner' ? 'Bearer token' : undefined);
  });
  test.each([{ text: 'raw' }, null, { artifact: null }])('returns unwrapped JSON when artifact is absent or null: %s', async result => {
    await serve((_req, res) => res.end(JSON.stringify(result)));
    expect(await adapter().run({})).toEqual(result);
  });
  test.each([[503, 'unavailable', 'AI_STAGE_REMOTE_FAILED'], [200, '{', 'AI_STAGE_RESPONSE_INVALID']])('maps HTTP %s and body %s', async (status, body, code) => {
    await serve((_req, res) => { res.writeHead(status); res.end(body); });
    await expect(adapter().run({})).rejects.toMatchObject({ code });
  });
  test('rejects excessive declared response size', async () => {
    await serve((_req, res) => { res.writeHead(200, { 'content-length': MAX_RESPONSE_BYTES + 1 }); res.end(); });
    await expect(adapter().run({})).rejects.toMatchObject({ code: 'AI_STAGE_RESPONSE_TOO_LARGE' });
  });
  test('cancels oversized streamed body with no content-length', async () => {
    await serve((_req, res) => { res.writeHead(200); res.write(Buffer.alloc(MAX_RESPONSE_BYTES)); res.end(Buffer.alloc(10)); });
    await expect(adapter().run({})).rejects.toMatchObject({ code: 'AI_STAGE_RESPONSE_TOO_LARGE' });
  });
  test('times out a real request whose response never arrives', async () => {
    await serve(() => {});
    await expect(adapter({ KNOWLEDGE_PRODUCTION_PLANNER_TIMEOUT_MS: '100' }).run({})).rejects.toMatchObject({ code: 'AI_STAGE_TIMEOUT' });
  });
  test('already aborted caller cancels before dispatch', async () => {
    await serve((_req, res) => res.end('{}'));
    const controller = new AbortController();
    controller.abort();
    await expect(adapter().run({}, { signal: controller.signal })).rejects.toMatchObject({ code: 'AI_STAGE_TIMEOUT' });
  });
  test('caller cancellation during a real HTTP request removes its listener', async () => {
    let received;
    const requestReceived = new Promise(resolve => { received = resolve; });
    await serve(() => received());
    const controller = new AbortController();
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    const result = adapter().run({}, { signal: controller.signal });
    const assertion = expect(result).rejects.toMatchObject({ code: 'AI_STAGE_TIMEOUT' });
    await requestReceived;
    controller.abort();
    await assertion;
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });
  test('disconnected upstream maps to unavailable', async () => {
    await serve(req => req.socket.destroy());
    await expect(adapter().run({})).rejects.toMatchObject({ code: 'AI_STAGE_UNAVAILABLE' });
  });
  test.each(['invalid', 'file:///tmp/run', 'http://user@localhost/run', 'http://:secret@localhost/run', 'http://localhost/run#hash'])('rejects invalid endpoint %s', url => {
    expect(() => createProductionAIHttpStageAdapters({ env: { KNOWLEDGE_PRODUCTION_PLANNER_URL: url } })).toThrow(expect.objectContaining({ code: 'AI_STAGE_CONFIG_INVALID' }));
  });
  test.each(['99', '300001', '100.5', 'not-a-number'])('rejects invalid timeout %s', timeout => {
    expect(() => createProductionAIHttpStageAdapters({ env: { KNOWLEDGE_PRODUCTION_PLANNER_URL: 'http://localhost/run', KNOWLEDGE_PRODUCTION_PLANNER_TIMEOUT_MS: timeout } })).toThrow(expect.objectContaining({ code: 'AI_STAGE_CONFIG_INVALID' }));
  });
  test('no endpoints or no fetch capability produces no adapters', () => {
    expect(createProductionAIHttpStageAdapters({ env: {} })).toEqual({});
    expect(createProductionAIHttpStageAdapters({ env: {}, fetch: {} })).toEqual({});
  });
  test.each([['small', '{}'], ['oversized', 'x'.repeat(MAX_RESPONSE_BYTES + 1)]])('supports response.text compatibility with byte length bounds (%s)', async (_label, body) => {
    const a = createProductionAIHttpStageAdapters({ env: { KNOWLEDGE_PRODUCTION_PLANNER_URL: 'http://fixture.invalid' }, fetch: async () => ({ ok: true, text: async () => body }) }).planner;
    if (body.length > MAX_RESPONSE_BYTES) await expect(a.run({})).rejects.toMatchObject({ code: 'AI_STAGE_RESPONSE_TOO_LARGE' });
    else expect(await a.run({})).toEqual({});
  });
});
