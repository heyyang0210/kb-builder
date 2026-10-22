const express = require('express');
const http = require('node:http');

describe('模型网关真实 HTTP 契约', () => {
  let server;
  let base;
  let configuration;
  let mode;
  let priorToken;

  async function request(method, route, body, token = 'test-internal-token') {
    const response = await fetch(`${base}/api/model${route}`, {
      method,
      headers: { ...(token ? { 'x-internal-token': token } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
  }

  beforeAll(async () => {
    priorToken = process.env.MODEL_GATEWAY_INTERNAL_TOKEN;
    process.env.MODEL_GATEWAY_INTERNAL_TOKEN = 'test-internal-token';
    configuration = null;
    mode = 'ok';
    jest.resetModules();
    jest.doMock('../../../packages/agent-runner-core/lib/config-manager', () => ({
      getModelConfig: async () => configuration,
      isApiKeyConfigured: config => Boolean(config?.api_key),
      save: async (_key, value) => { configuration = value; },
    }));
    jest.doMock('../../../packages/agent-runner-core/lib/config-validator', () => ({
      validateModelConfig: value => value.model ? { valid: true } : { valid: false, errors: ['缺少模型'] },
    }));
    jest.doMock('../../../packages/agent-runner-core/lib/llm-client', () => class LLMClientDouble {
      async chat() {
        if (mode === 'failure') throw new Error('HTTP 503');
        return { content: '响应正文', usage: { total_tokens: 12 }, finish_reason: 'stop', model: 'mock-model' };
      }
      async chatJSON() {
        if (mode === 'bad-schema') return { parsed: { status: 'unexpected' } };
        return { parsed: { status: 'ok', message: '正常' }, content: '{}', usage: { total_tokens: 5 } };
      }
      async *chatStream() {
        yield { content: '第一段' };
        if (mode === 'stream-failure') throw new Error('流中断');
        yield { content: '第二段', finish: 'stop' };
      }
    });
    const router = require('../../../packages/agent-runner-core/routes/model-provider');
    const app = express();
    app.use(express.json());
    app.use('/api/model', router);
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
    for (const modulePath of ['config-manager', 'config-validator', 'llm-client']) {
      jest.dontMock(`../../../packages/agent-runner-core/lib/${modulePath}`);
    }
    jest.resetModules();
    if (priorToken === undefined) delete process.env.MODEL_GATEWAY_INTERNAL_TOKEN;
    else process.env.MODEL_GATEWAY_INTERNAL_TOKEN = priorToken;
  });

  beforeEach(() => {
    configuration = { provider: 'test', model: 'mock-model', api_key: 'private-key' };
    mode = 'ok';
  });

  test('内部令牌保护状态与配置接口，状态不泄漏密钥', async () => {
    expect((await request('GET', '/status', undefined, 'wrong')).status).toBe(403);
    configuration = null;
    expect((await request('GET', '/status')).body.configured).toBe(false);
    expect((await request('POST', '/config', { provider: 'test' })).status).toBe(400);
    const saved = await request('POST', '/config', { provider: 'test', model: 'mock-model', api_key: 'private-key' });
    expect(saved.status).toBe(200);
    expect(saved.body.apiKeyConfigured).toBe(true);
    expect(JSON.stringify(saved.body)).not.toContain('private-key');
    expect((await request('GET', '/status')).body.model).toBe('mock-model');
  });

  test('无效请求被拒绝，文本、JSON 和视觉响应保留用量与模型信息', async () => {
    for (const route of ['/chat', '/chat/stream', '/vision']) {
      expect((await request('POST', route, { messages: [] })).status).toBe(400);
    }
    const messages = [{ role: 'user', content: '测试' }];
    expect((await request('POST', '/chat', { messages })).body).toMatchObject({ success: true, content: '响应正文', model: 'mock-model' });
    expect((await request('POST', '/chat', { messages, responseFormat: 'json' })).body.data).toEqual({ status: 'ok', message: '正常' });
    expect((await request('POST', '/vision', { messages })).body.usage.total_tokens).toBe(12);
    expect((await request('POST', '/embedding', {})).body.error.code).toBe('CAPABILITY_UNAVAILABLE');
  });

  test('连接测试检查结构，流式输出终止标记并传递中途错误', async () => {
    expect((await request('POST', '/test', {})).body.schemaPassed).toBe(true);
    mode = 'bad-schema';
    expect((await request('POST', '/test', {})).body.error.code).toBe('MODEL_PROVIDER_TEST_FAILED');
    mode = 'ok';
    const stream = await request('POST', '/chat/stream', { messages: [{ role: 'user', content: '测试' }] });
    expect(stream.body).toContain('第一段');
    expect(stream.body).toContain('"finish":"stop"');
    mode = 'stream-failure';
    const interrupted = await request('POST', '/chat/stream', { messages: [{ role: 'user', content: '测试' }] });
    expect(interrupted.body).toContain('流中断');
    mode = 'ok';
  });

  test('缺少配置与上游失败映射为稳定错误码', async () => {
    configuration = null;
    const missing = await request('POST', '/chat', { messages: [{ role: 'user', content: '测试' }] });
    expect(missing.status).toBe(503);
    expect(missing.body.error.code).toBe('MODEL_PROVIDER_NOT_CONFIGURED');
    configuration = { model: 'mock-model', api_key: 'private-key' };
    mode = 'failure';
    const failed = await request('POST', '/chat', { messages: [{ role: 'user', content: '测试' }] });
    expect(failed.status).toBe(502);
    expect(failed.body.error.code).toBe('MODEL_PROVIDER_CALL_FAILED');
    mode = 'ok';
  });
});
