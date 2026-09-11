const winston = require('winston');
const path = require('path');
const { AGENT_RUNNER_RUNTIME_ROOT } = require('./repo-paths');

const LOG_DIR = path.join(AGENT_RUNNER_RUNTIME_ROOT, 'logs');
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'agent-runner' },
  transports: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: MAX_SIZE,
      maxFiles: MAX_FILES
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'execution.log'),
      maxsize: MAX_SIZE,
      maxFiles: MAX_FILES
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  const consoleTransport = new winston.transports.Console({
    format: consoleFormat,
    handleExceptions: false
  });
  
  // 防止 EPIPE 错误
  consoleTransport.on('error', (err) => {
    // 忽略控制台写入错误
  });
  
  logger.add(consoleTransport);
}

// 全局 EPIPE 错误处理
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') {
    // 忽略 EPIPE 错误
  }
});

process.stderr.on('error', (err) => {
  if (err.code === 'EPIPE') {
    // 忽略 EPIPE 错误
  }
});

module.exports = logger;
