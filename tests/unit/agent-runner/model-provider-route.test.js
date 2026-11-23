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

  test('uses safe defaults for missing configuration and zero limits', () => {
    expect(safeStatus(undefined)).toMatchObject({
      provider: null, model: null, baseUrl: null, temperature: 0.7,
      maxTokens: 4000, timeoutMs: 180000, apiKeyConfigured: false, configured: false,
    });
    expect(safeStatus({ model: 'qwen', api_key: 'secret', temperature: 0, max_tokens: 0, timeout: 0 }))
      .toMatchObject({ temperature: 0, maxTokens: 4000, timeoutMs: 180000, configured: true });
  });

  test('summarizes common provider errors in Chinese', () => {
    expect(errorSummary(new Error('connect ECONNREFUSED 127.0.0.1'))).toBe('模型服务连接失败');
    expect(errorSummary(new Error('HTTP 429'))).toBe('模型服务请求过于频繁（HTTP 429）');
  });

  test.each([
    ['country, region, or territory not supported', '模型服务拒绝访问（HTTP 403，当前网络所在国家或地区不受支持）'],
    ['HTTP 401', '模型服务身份认证失败（HTTP 401）'],
    ['403', '模型服务拒绝访问（HTTP 403）'],
    ['HTTP 429', '模型服务请求过于频繁（HTTP 429）'],
    ['connection refused', '模型服务连接失败'],
    ['ECONNREFUSED', '模型服务连接失败'],
    ['timeout', '模型调用超时'],
    ['timed out', '模型调用超时'],
    ['invalid JSON payload', '模型返回格式不正确'],
    ['HTTP 503', '模型服务暂时不可用（HTTP 503）'],
    ['502', '模型服务暂时不可用（HTTP 502）'],
    ['upstream unavailable', '模型服务返回错误'],
    ['', '模型服务返回错误'],
    [null, '模型服务返回错误'],
  ])('归类模型服务错误输入 %p', (input, expected) => {
    expect(errorSummary(input)).toBe(expected);
  });
});
