const logger = require('../../../packages/agent-runner-core/lib/logger');
const { runWithContext } = require('../../../packages/agent-runner-core/lib/log-context');
const { errorHandler, notFoundHandler } = require('../../../packages/agent-runner-core/middleware/error-handler');

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe('error-handler middleware coverage', () => {
  let errorLog;
  let warningLog;
  let originalNodeEnv;

  beforeEach(() => {
    errorLog = jest.spyOn(logger, 'error').mockImplementation(() => {});
    warningLog = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    errorLog.mockRestore();
    warningLog.mockRestore();
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  function invoke(handler, err, req) {
    const res = response();
    runWithContext({ requestId: 'req-test', correlationId: 'corr-test' }, () => handler(err, req, res, () => {}));
    return res;
  }

  test('returns a stable 400 response for malformed JSON', () => {
    const res = invoke(errorHandler, { type: 'entity.parse.failed', message: 'bad json' }, {
      method: 'POST', path: '/items', body: { content: 'private' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toEqual({ code: 'INVALID_JSON', message: '请求 JSON 格式错误', requestId: 'req-test' });
    expect(res.headers).toEqual({ 'x-request-id': 'req-test', 'x-correlation-id': 'corr-test' });
    expect(errorLog.mock.calls[0][1].body).toEqual({ content: '[已隐藏]' });
  });

  test.each([
    [{ status: 400, message: '字段无效' }, '字段无效'],
    [{ code: 'VALIDATION_ERROR', message: '缺少名称' }, '缺少名称'],
  ])('maps validation errors to 400', (err, message) => {
    const res = invoke(errorHandler, err, { method: 'PATCH', path: '/items/1', route: { path: '/items/:id' } });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toEqual({ code: 'VALIDATION_ERROR', message, requestId: 'req-test' });
    expect(errorLog.mock.calls[0][1].route).toBe('/items/:id');
  });

  test('uses development details and sanitizes request body values', () => {
    process.env.NODE_ENV = 'test';
    const res = invoke(errorHandler, { statusCode: 418, code: 'TEAPOT', message: 'unexpected' }, {
      method: 'GET', path: '/debug', body: { name: 'Alice', password: 'hidden', count: 2 },
    });

    expect(res.statusCode).toBe(418);
    expect(res.body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'unexpected', requestId: 'req-test' });
    expect(errorLog.mock.calls[0][1].body).toEqual({ name: '[字符串:5字]', password: '[已隐藏]', count: 2 });
    expect(errorLog.mock.calls[0][1].route).toBe('/debug');
  });

  test('hides internal details in production and falls back to status 500', () => {
    process.env.NODE_ENV = 'production';
    const res = invoke(errorHandler, { message: 'database secret' }, {
      method: 'GET', path: '/private', body: null,
    });

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toEqual({ code: 'INTERNAL_ERROR', message: '服务器内部错误', requestId: 'req-test' });
    expect(errorLog.mock.calls[0][1].body).toBeUndefined();
    expect(errorLog.mock.calls[0][1].errorCode).toBe('INTERNAL_ERROR');
  });

  test('returns a request-scoped not-found response', () => {
    const res = response();
    runWithContext({ requestId: 'req-missing', correlationId: 'corr-missing' }, () => {
      notFoundHandler({ method: 'GET', path: '/missing' }, res);
    });

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toEqual({
      code: 'NOT_FOUND', message: '路径 GET /missing 不存在', requestId: 'req-missing',
    });
    expect(res.headers).toEqual({ 'x-request-id': 'req-missing', 'x-correlation-id': 'corr-missing' });
    expect(warningLog).toHaveBeenCalledWith('request.not_found', expect.objectContaining({ route: '/missing', method: 'GET' }));
  });
});
