const logger = require('../lib/logger');

function errorHandler(err, req, res, _next) {
  logger.error(`${req.method} ${req.path} - ${err.message}`, {
    stack: err.stack,
    body: req.body
  });

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: '请求 JSON 格式错误' }
    });
  }

  if (err.status === 400 || err.code === 'VALIDATION_ERROR') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.message }
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
      message
    }
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `路径 ${req.method} ${req.path} 不存在` }
  });
}

module.exports = { errorHandler, notFoundHandler };
