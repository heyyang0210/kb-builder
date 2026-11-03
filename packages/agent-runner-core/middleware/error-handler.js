const logger = require('../lib/logger');
const { attachResponseIds, getContext } = require('../lib/log-context');

function safeBody(body) {
  if (!body || typeof body !== 'object') return undefined;
  const sensitive = /password|token|secret|cookie|authorization|api[_-]?key|prompt|content|body/i;
  return Object.fromEntries(Object.entries(body).map(([key, value]) => [
    key,
    sensitive.test(key) ? '[已隐藏]' : (typeof value === 'string' ? `[字符串:${value.length}字]` : value),
  ]));
}

function errorHandler(err, req, res, _next) {
  const context = getContext();
  attachResponseIds(res, context);
  logger.error(`${req.method} ${req.path} - ${err.message}`, {
    event: 'request.failed',
    errorCode: err.code || err.statusCode || 'INTERNAL_ERROR',
    route: req.route?.path || req.path,
    stack: err.stack,
    body: safeBody(req.body),
  });

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: '请求 JSON 格式错误', requestId: context.requestId }
    });
  }

  if (err.status === 400 || err.code === 'VALIDATION_ERROR') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.message, requestId: context.requestId }
    });
  }

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? '服务器内部错误'
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
      requestId: context.requestId,
    }
  });
}

function notFoundHandler(req, res) {
  const context = getContext();
  attachResponseIds(res, context);
  logger.warn('request.not_found', { event: 'request.not_found', route: req.path, method: req.method });
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `路径 ${req.method} ${req.path} 不存在`, requestId: context.requestId }
  });
}

module.exports = { errorHandler, notFoundHandler };
