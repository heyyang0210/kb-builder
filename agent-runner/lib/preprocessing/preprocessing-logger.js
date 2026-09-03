const winston = require('winston');
const path = require('path');
const fs = require('fs').promises;

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

/**
 * 预处理专用日志系统
 * 
 * 与主 logger.js 分离但风格一致（基于 winston）。
 * 支持：
 * - JSONL 结构化日志（程序化分析）
 * - 人类可读日志（人工排查）
 * - 执行级别日志（按 executionId 追踪）
 * - 控制台输出
 */
class PreprocessingLogger {
  /**
   * @param {string} logDir - 日志目录
   * @param {string} [level='info'] - 日志级别
   */
  constructor(logDir, level = 'info') {
    this.logDir = logDir;
    this.currentExecutionId = null;

    const jsonlFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    );

    const textFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, executionId, pipeline, phase, ...meta }) => {
        const prefix = [executionId, pipeline, phase].filter(Boolean).join('/');
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}]${prefix ? ' [' + prefix + ']' : ''} ${message}${metaStr}`;
      })
    );

    this.logger = winston.createLogger({
      level,
      defaultMeta: { service: 'preprocessing' },
      transports: [
        // JSONL 结构化日志
        new winston.transports.File({
          filename: path.join(logDir, 'preprocessing.jsonl'),
          format: jsonlFormat,
          maxsize: MAX_SIZE,
          maxFiles: MAX_FILES
        }),
        // 人类可读日志
        new winston.transports.File({
          filename: path.join(logDir, 'preprocessing.log'),
          format: textFormat,
          maxsize: MAX_SIZE,
          maxFiles: MAX_FILES
        })
      ]
    });

    // 开发环境添加控制台输出
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: textFormat,
        handleExceptions: false
      }));
    }
  }

  /**
   * 设置当前执行上下文
   * @param {string} executionId
   * @param {string} pipeline
   */
  setExecution(executionId, pipeline) {
    this.currentExecutionId = executionId;
    this.currentPipeline = pipeline;
  }

  /**
   * 记录执行开始
   */
  startExecution(executionId, pipeline, options = {}) {
    this.setExecution(executionId, pipeline);
    this.logger.info('预处理执行开始', {
      execution_id: executionId,
      pipeline,
      options: {
        full: options.full || false,
        dryRun: options.dryRun || false
      }
    });
  }

  /**
   * 记录执行结束
   */
  endExecution(executionId, result, durationMs) {
    this.logger.info('预处理执行完成', {
      execution_id: executionId,
      pipeline: result?.pipelineName,
      status: result?.status,
      duration_ms: durationMs
    });
    this.currentExecutionId = null;
    this.currentPipeline = null;
  }

  /**
   * 记录阶段开始
   */
  phaseStart(phase, data = {}) {
    this.logger.info(`阶段开始: ${phase}`, {
      execution_id: this.currentExecutionId,
      pipeline: this.currentPipeline,
      phase,
      ...data
    });
  }

  /**
   * 记录阶段完成
   */
  phaseEnd(phase, data = {}) {
    this.logger.info(`阶段完成: ${phase}`, {
      execution_id: this.currentExecutionId,
      pipeline: this.currentPipeline,
      phase,
      ...data
    });
  }

  /**
   * 记录错误
   */
  error(executionId, error, context = {}) {
    this.logger.error(error.message || String(error), {
      execution_id: executionId || this.currentExecutionId,
      pipeline: this.currentPipeline,
      error: error.message,
      stack: error.stack,
      ...context
    });
  }

  /**
   * 记录警告
   */
  warn(message, data = {}) {
    this.logger.warn(message, {
      execution_id: this.currentExecutionId,
      pipeline: this.currentPipeline,
      ...data
    });
  }

  /**
   * 记录信息
   */
  info(message, data = {}) {
    this.logger.info(message, {
      execution_id: this.currentExecutionId,
      pipeline: this.currentPipeline,
      ...data
    });
  }

  /**
   * 记录调试信息
   */
  debug(message, data = {}) {
    this.logger.debug(message, {
      execution_id: this.currentExecutionId,
      pipeline: this.currentPipeline,
      ...data
    });
  }

  /**
   * 读取最近的执行日志
   * @param {number} [count=10] - 返回条数
   * @returns {Promise<Array>}
   */
  async readRecentLogs(count = 10) {
    const logFile = path.join(this.logDir, 'preprocessing.jsonl');
    try {
      const content = await fs.readFile(logFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      const entries = lines.map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
      return entries.slice(-count);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }
}

module.exports = { PreprocessingLogger };
