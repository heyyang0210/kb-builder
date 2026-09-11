const { isLoopback, authorizeInternalRequest, errorSummary, safeStatus } = require('../../../packages/agent-runner-core/routes/model-provider');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

describe('Model Provider internal access', () => {
  const originalToken = process.env.MODEL_GATEWAY_INTERNAL_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) delete process.env.MODEL_GATEWAY_INTERNAL_TOKEN;
    else process.env.MODEL_GATEWAY_INTERNAL_TOKEN = originalToken;
  });

  test('recognizes IPv4 and IPv6 loopback addresses', () => {
    expect(isLoopback('127.0.0.1')).toBe(true);
    expect(isLoopback('::1')).toBe(true);
    expect(isLoopback('::ffff:127.0.0.1')).toBe(true);
    expect(isLoopback('192.168.1.2')).toBe(false);
  });

  test('allows loopback when token is not configured', () => {
    delete process.env.MODEL_GATEWAY_INTERNAL_TOKEN;
    const next = jest.fn();
    authorizeInternalRequest({ ip: '127.0.0.1', get: () => undefined }, responseRecorder(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('requires matching token when configured', () => {
    process.env.MODEL_GATEWAY_INTERNAL_TOKEN = 'internal-test-token';
    const next = jest.fn();
    const response = responseRecorder();
    authorizeInternalRequest({ ip: '127.0.0.1', get: () => 'wrong' }, response, next);
    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(403);
    expect(response.body.error.code).toBe('MODEL_GATEWAY_FORBIDDEN');
  });

  test('returns safe model status without credentials', () => {
    const status = safeStatus({
      provider: 'alibaba', model: 'qwen3.7-plus', base_url: 'https://example.test/v1',
      max_tokens: 60000, timeout: 180000, api_key: 'secret'
    });
    expect(status.apiKeyConfigured).toBe(true);
    expect(status.maxTokens).toBe(60000);
    expect(JSON.stringify(status)).not.toContain('secret');
  });

  test('summarizes common provider errors in Chinese', () => {
    expect(errorSummary(new Error('connect ECONNREFUSED 127.0.0.1'))).toBe('模型服务连接失败');
    expect(errorSummary(new Error('HTTP 429'))).toBe('模型服务请求过于频繁（HTTP 429）');
  });
});
