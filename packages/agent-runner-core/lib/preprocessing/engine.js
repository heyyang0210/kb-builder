const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { PreprocessingLogger } = require('./preprocessing-logger');
const { SnapshotTracker } = require('./snapshot-tracker');

/**
 * 预处理执行引擎
 * 
 * 职责：
 * 1. 注册和管理 Pipeline
 * 2. 调度 Pipeline 执行
 * 3. 管理执行快照（支持增量和回溯）
 * 4. 记录结构化日志
 * 5. 生成执行报告
 */
class PreprocessingEngine {
  /**
   * @param {Object} config - 引擎配置
   * @param {string} config.baseDir - 项目根目录
   * @param {string} [config.logDir] - 日志目录
   * @param {string} [config.snapshotDir] - 快照目录
   * @param {string} [config.reportDir] - 报告目录
   * @param {Object} [config.pipelines] - 各 Pipeline 配置
   * @param {Object} [config.snapshots] - 快照策略配置
   */
  constructor(config) {
    this.config = config;
    this.baseDir = config.baseDir;
    this.pipelines = new Map();

    // 初始化日志
    const logDir = config.logDir || path.join(this.baseDir, 'logs', 'preprocessing');
    this.logger = new PreprocessingLogger(logDir);

    // 初始化快照管理
    const snapshotDir = config.snapshotDir || path.join(this.baseDir, 'preprocessing-output', '_snapshots');
    this.snapshotTracker = new SnapshotTracker(snapshotDir, {
      maxRetained: config.snapshots?.maxRetained || 10
    });

    // 报告目录
    this.reportDir = config.reportDir || path.join(this.baseDir, 'preprocessing-output', '_reports');
  }

  /**
   * 注册 Pipeline
   * @param {import('./pipeline').Pipeline} pipeline
   */
  register(pipeline) {
    if (!pipeline.name) {
      throw new Error('Pipeline must have a name');
    }
    this.pipelines.set(pipeline.name, pipeline);
    this.logger.info(`Pipeline 已注册: ${pipeline.name}`);
  }

  /**
   * 获取已注册的 Pipeline
   * @param {string} name
   * @returns {import('./pipeline').Pipeline}
   */
  getPipeline(name) {
    const pipeline = this.pipelines.get(name);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${name}. Available: ${Array.from(this.pipelines.keys()).join(', ')}`);
    }
    return pipeline;
  }

  /**
   * 列出所有已注册的 Pipeline
   * @returns {string[]}
   */
  listPipelines() {
    return Array.from(this.pipelines.keys());
  }

  /**
   * 执行指定 Pipeline
   * 
   * @param {string} pipelineName - 流水线名称
   * @param {Object} [options] - 执行选项
   * @param {boolean} [options.full=false] - 强制全量（忽略增量）
   * @param {boolean} [options.dryRun=false] - 预览模式
   * @returns {Promise<Object>} 执行报告
   */
  async run(pipelineName, options = {}) {
    const pipeline = this.getPipeline(pipelineName);
    const executionId = this.generateExecutionId();

    this.logger.startExecution(executionId, pipelineName, options);

    try {
      // 加载上次执行快照（除非强制全量）
      const snapshot = options.full
        ? null
        : await this.snapshotTracker.loadLatest(pipelineName);

      // 检查配置是否变更
      if (snapshot && !options.full) {
        const currentConfigHash = this.computeConfigHash(pipelineName);
        if (snapshot.config_hash && snapshot.config_hash !== currentConfigHash) {
          this.logger.warn('配置已变更，建议执行全量处理', {
            execution_id: executionId,
            previous_config_hash: snapshot.config_hash,
            current_config_hash: currentConfigHash
          });
        }
      }

      // 构建执行上下文
      const context = this.buildContext(pipelineName, snapshot, executionId, options);

      // 执行流水线
      const startTime = Date.now();
      const result = await pipeline.execute(context);
      const durationMs = Date.now() - startTime;

      // 构建新快照
      const newSnapshot = this.buildSnapshotFromResult(
        pipelineName, executionId, durationMs, result, context, snapshot
      );

      // 保存快照（非 dry-run 模式）
      if (!options.dryRun) {
        await this.snapshotTracker.save(pipelineName, newSnapshot);
      }

      // 记录日志
      this.logger.endExecution(executionId, result, durationMs);

      // 保存执行报告
      const report = this.buildExecutionReport(executionId, pipelineName, result, durationMs, newSnapshot, options);
      await this.saveReport(pipelineName, report);

      return report;

    } catch (error) {
      this.logger.error(executionId, error);
      throw error;
    }
  }

  /**
   * 执行所有已注册的 Pipeline
   * @param {Object} [options]
   * @returns {Promise<Array>}
   */
  async runAll(options = {}) {
    const results = [];
    for (const [name] of this.pipelines) {
      const result = await this.run(name, options);
      results.push(result);
    }
    return results;
  }

  /**
   * 回滚到指定快照
   * @param {string} pipelineName
   * @param {string} snapshotId
   */
  async rollback(pipelineName, snapshotId) {
    const snapshot = await this.snapshotTracker.load(pipelineName, snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    this.logger.info(`回滚 ${pipelineName} 到快照 ${snapshotId}`);
    // TODO: 实现具体的回滚逻辑（恢复产出目录到快照状态）
    // 当前仅记录回滚意图，实际回滚需要 Pipeline 配合
  }

  /**
   * 列出所有执行快照
   * @param {string} pipelineName
   * @returns {Promise<Array>}
   */
  async listSnapshots(pipelineName) {
    return this.snapshotTracker.list(pipelineName);
  }

  /**
   * 读取最近的执行日志
   * @param {string} [pipelineName] - 过滤流水线
   * @param {number} [count=10]
   * @returns {Promise<Array>}
   */
  async readRecentLogs(pipelineName, count = 10) {
    const logs = await this.logger.readRecentLogs(count * 2); // 多读一些
    if (pipelineName) {
      return logs.filter(log => log.pipeline === pipelineName).slice(-count);
    }
    return logs.slice(-count);
  }

  // === 内部方法 ===

  /**
   * 生成执行 ID
   */
  generateExecutionId() {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 15);
    const randomSuffix = crypto.randomBytes(3).toString('hex');
    return `exec-${dateStr}-${randomSuffix}`;
  }

  /**
   * 计算配置 hash
   */
  computeConfigHash(pipelineName) {
    const pipelineConfig = this.config.pipelines?.[pipelineName] || {};
    return SnapshotTracker.computeConfigHash(pipelineConfig);
  }

  /**
   * 构建执行上下文
   */
  buildContext(pipelineName, snapshot, executionId, options) {
    const pipelineConfig = this.config.pipelines?.[pipelineName] || {};
    const outputBaseDir = pipelineConfig.output?.baseDir ||
      path.join(this.baseDir, 'preprocessing-output', pipelineName);

    return {
      sourceDir: pipelineConfig.source?.inputDir || '',
      outputDir: outputBaseDir,
      config: pipelineConfig,
      snapshot,
      executionId,
      dryRun: options.dryRun || false
    };
  }

  /**
   * 从执行结果构建快照
   */
  buildSnapshotFromResult(pipelineName, executionId, durationMs, result, context, previousSnapshot) {
    // 从 Pipeline 获取文件 hash 清单
    const fileHashes = this.extractFileHashes(result);

    return this.snapshotTracker.buildSnapshot({
      pipeline: pipelineName,
      executionId,
      durationMs,
      configHash: this.computeConfigHash(pipelineName),
      input: {
        totalFiles: result.phases?.scan?.data?.filesFound || 0,
        delta: result.phases?.delta?.data || {}
      },
      output: {
        cleanedFiles: result.phases?.clean?.data?.processed || 0,
        chunkCount: result.phases?.chunk?.data?.chunksGenerated || 0,
        l1Entries: result.phases?.index?.data?.l1Entries || 0,
        l2Summaries: result.phases?.index?.data?.l2Summaries || 0
      },
      quality: result.phases?.validate?.data || { passed: true, checks: {} },
      fileHashes,
      previousSnapshotId: previousSnapshot?.snapshot_id || null
    });
  }

  /**
   * 从结果中提取文件 hash（子类可覆写以提供更精确的 hash）
   */
  extractFileHashes(result) {
    // 默认实现：从 clean 阶段结果中提取
    // 具体 Pipeline 可以覆写此方法
    return {};
  }

  /**
   * 构建执行报告
   */
  buildExecutionReport(executionId, pipelineName, result, durationMs, snapshot, options) {
    return {
      execution_id: executionId,
      pipeline: pipelineName,
      started_at: result.startedAt,
      finished_at: result.finishedAt,
      duration_ms: durationMs,
      status: result.status,
      options: {
        full: options.full || false,
        dryRun: options.dryRun || false
      },
      snapshot_id: snapshot.snapshot_id,
      phases: result.phases,
      warnings: result.warnings,
      errors: result.errors
    };
  }

  /**
   * 保存执行报告
   */
  async saveReport(pipelineName, report) {
    const reportDir = path.join(this.reportDir, pipelineName);
    await fs.mkdir(reportDir, { recursive: true });

    const filePath = path.join(reportDir, `${report.execution_id}.json`);
    await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');

    // 更新 latest 链接
    const latestPath = path.join(reportDir, 'latest.json');
    try {
      await fs.unlink(latestPath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    await fs.writeFile(latestPath, JSON.stringify(report, null, 2), 'utf-8');
  }
}

module.exports = { PreprocessingEngine };
