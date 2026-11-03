const winston = require('winston');
const path = require('path');
const { AGENT_RUNNER_RUNTIME_ROOT } = require('./repo-paths');
const { getContext } = require('./log-context');

const LOG_DIR = path.join(AGENT_RUNNER_RUNTIME_ROOT, 'logs');
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;
const SECRET_KEY = /password|passwd|token|secret|cookie|authorization|api[_-]?key/i;
const SECRET_KEY_VERBOSE = /password|passwd|token|secret|cookie|authorization|api[_-]?key|prompt|content|body/i;
const SECRET_TEXT = /((?:password|passwd|token|secret|cookie|authorization|api[_-]?key)\s*[=:]\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s,}\]]+)/ig;
const SECRET_TEXT_VERBOSE = /((?:password|passwd|token|secret|cookie|authorization|api[_-]?key|prompt|content|body)\s*[=:]\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s,}\]]+)/ig;

function redactText(value, verbose = false) {
  if (typeof value !== 'string') return value;
  const pattern = verbose ? SECRET_TEXT_VERBOSE : SECRET_TEXT;
  return value.replace(pattern, '$1[REDACTED]').replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/ig, '$1[REDACTED]');
}

function redact(value, verbose = false) {
  if (typeof value === 'string') return redactText(value, verbose);
  if (Array.isArray(value)) return value.map(item => redact(item, verbose));
  if (!value || typeof value !== 'object') return value;
  const keyPattern = verbose ? SECRET_KEY_VERBOSE : SECRET_KEY;
  const safe = Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    keyPattern.test(key) ? '[REDACTED]' : redact(item, verbose),
  ]));
  for (const symbol of Object.getOwnPropertySymbols(value)) safe[symbol] = redact(value[symbol], verbose);
  return safe;
}

const VERBOSE_LEVELS = new Set(['debug', 'silly']);
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format(info => { const verbose = VERBOSE_LEVELS.has(info.level); return redact(info, verbose); })(),
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
  defaultMeta: { service: process.env.LOG_SERVICE || 'agent-runner', version: process.env.BUILD_VERSION || process.env.SOURCE_REVISION || 'unknown' },
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

const baseLog = logger.log.bind(logger);
logger.log = (level, message, meta = {}) => baseLog(level, message, { ...getContext(), ...meta });
for (const level of ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']) {
  const original = logger[level].bind(logger);
  logger[level] = (message, meta = {}) => original(message, { ...getContext(), ...meta });
}

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
module.exports.redact = redact;
module.exports.redactText = redactText;
