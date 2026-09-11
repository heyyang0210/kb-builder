const path = require('path');

/**
 * 流水线执行报告
 * 
 * 记录每个阶段的执行状态和统计信息。
 */
class PipelineReport {
  constructor(pipelineName) {
    this.pipelineName = pipelineName;
    this.startedAt = new Date().toISOString();
    this.finishedAt = null;
    this.status = 'running'; // running | success | failed
    this.phases = {};
    this.warnings = [];
    this.errors = [];
  }

  /**
   * 记录阶段开始
   */
  phaseStart(phase) {
    this.phases[phase] = {
      status: 'running',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      data: {}
    };
  }

  /**
   * 记录阶段完成
   */
  phaseEnd(phase, data = {}) {
    if (this.phases[phase]) {
      this.phases[phase].status = 'completed';
      this.phases[phase].finishedAt = new Date().toISOString();
      this.phases[phase].data = data;
    }
  }

  /**
   * 记录阶段失败
   */
  phaseError(phase, error) {
    if (this.phases[phase]) {
      this.phases[phase].status = 'failed';
      this.phases[phase].finishedAt = new Date().toISOString();
      this.phases[phase].error = error.message || String(error);
    }
    this.errors.push({ phase, message: error.message || String(error) });
  }

  /**
   * 添加警告
   */
  addWarning(phase, message) {
    this.warnings.push({ phase, message });
  }

  /**
   * 标记完成
   */
  complete() {
    this.status = 'success';
    this.finishedAt = new Date().toISOString();
  }

  /**
   * 标记失败
   */
  fail() {
    this.status = 'failed';
    this.finishedAt = new Date().toISOString();
  }

  /**
   * 计算总耗时（毫秒）
   */
  get durationMs() {
    if (!this.finishedAt) return Date.now() - new Date(this.startedAt).getTime();
    return new Date(this.finishedAt).getTime() - new Date(this.startedAt).getTime();
  }

  /**
   * 转为 JSON
   */
  toJSON() {
    return {
      pipelineName: this.pipelineName,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      status: this.status,
      durationMs: this.durationMs,
      phases: this.phases,
      warnings: this.warnings,
      errors: this.errors
    };
  }
}

/**
 * 增量变更集
 */
class DeltaResult {
  constructor() {
    this.added = [];      // 新增文件 { filePath, hash }
    this.modified = [];   // 修改文件 { filePath, hash, previousHash }
    this.deleted = [];    // 删除文件 { filePath, previousHash }
    this.unchanged = [];  // 未变更文件 { filePath, hash }
    this.full = false;
  }

  get totalChanged() {
    return this.added.length + this.modified.length + this.deleted.length;
  }

  get hasChanges() {
    return this.totalChanged > 0;
  }

  toJSON() {
    return {
      added: this.added.length,
      modified: this.modified.length,
      deleted: this.deleted.length,
      unchanged: this.unchanged.length,
      full: this.full,
      totalChanged: this.totalChanged
    };
  }
}

/**
 * 资料预处理流水线基类
 * 
 * 每种资料类型（设计文档/代码/工单...）继承此基类，
 * 实现具体的清洗、分块、索引构建逻辑。
 * 
 * 子类必须实现：
 * - name (getter)
 * - adapter (getter)
 * - clean(files, config)
 * - index(data, config)
 * 
 * 子类可选覆写：
 * - chunk(cleaned, config) — 默认不启用分块
 * - validate(report, config) — 默认通过
 */
class Pipeline {
  /**
   * 流水线名称（唯一标识）
   * @returns {string} 如 'design-docs', 'code', 'tickets'
   */
  get name() {
    throw new Error('Pipeline.name must be implemented');
  }

  /**
   * 源数据适配器
   * @returns {import('./source-adapter').SourceAdapter}
   */
  get adapter() {
    throw new Error('Pipeline.adapter must be implemented');
  }

  /**
   * 执行完整流水线
   * 
   * @param {Object} context - 执行上下文
   * @param {string} context.sourceDir - 原始素材目录
   * @param {string} context.outputDir - 产出目录
   * @param {Object} context.config - 配置
   * @param {Object|null} context.snapshot - 上次执行快照（null 表示全量）
   * @param {string} context.executionId - 执行 ID
   * @param {boolean} context.dryRun - 预览模式
   * @returns {Promise<PipelineReport>}
   */
  async execute(context) {
    const { sourceDir, outputDir, config, snapshot, dryRun } = context;
    const report = new PipelineReport(this.name);

    try {
      // === 阶段 1：扫描源文件 ===
      report.phaseStart('scan');
      const allFiles = await this.adapter.scan(sourceDir);
      report.phaseEnd('scan', { filesFound: allFiles.length });

      // === 阶段 2：增量检测 ===
      report.phaseStart('delta');
      const delta = await this.computeDelta(allFiles, snapshot);
      report.phaseEnd('delta', delta.toJSON());

      if (!delta.hasChanges && snapshot) {
        report.addWarning('delta', '无变更，跳过处理');
        report.complete();
        return report;
      }

      // === 阶段 3：解析 + 清洗 ===
      report.phaseStart('clean');
      const filesToProcess = [...delta.added, ...delta.modified];
      const cleaned = await this.clean(filesToProcess, config);
      report.phaseEnd('clean', {
        processed: cleaned.length,
        stats: this.aggregateCleanStats(cleaned)
      });

      // === 阶段 4：分块（可选）===
      let chunked = null;
      if (config.chunking?.enabled !== false) {
        report.phaseStart('chunk');
        chunked = await this.chunk(cleaned, config);
        if (chunked) {
          report.phaseEnd('chunk', { chunksGenerated: chunked.length });
        } else {
          report.phaseEnd('chunk', { skipped: true });
        }
      }

      // === 阶段 5：索引构建 ===
      report.phaseStart('index');
      const indexData = chunked || cleaned;
      const indexResult = await this.index(indexData, config, delta);
      report.phaseEnd('index', indexResult);

      // === 阶段 6：质量验证 ===
      report.phaseStart('validate');
      const qualityResult = await this.validate(report, config);
      report.phaseEnd('validate', qualityResult);

      // === 阶段 7：清理已删除文件的产出 ===
      if (delta.deleted.length > 0) {
        report.phaseStart('cleanup');
        await this.cleanupDeleted(delta.deleted, outputDir);
        report.phaseEnd('cleanup', { cleaned: delta.deleted.length });
      }

      // === 写入产出（非 dry-run 模式）===
      if (!dryRun) {
        await this.writeOutput(cleaned, chunked, indexResult, outputDir);
      }

      report.complete();
    } catch (error) {
      report.fail();
      report.errors.push({
        phase: 'pipeline',
        message: error.message,
        stack: error.stack
      });
      throw error;
    }

    return report;
  }

  /**
   * 计算增量变更集
   * 
   * 对比当前文件列表与上次快照中的 hash，识别新增/修改/删除/未变更。
   * 
   * @param {string[]} currentFiles - 当前扫描到的文件路径列表
   * @param {Object|null} snapshot - 上次执行快照
   * @returns {Promise<DeltaResult>}
   */
  async computeDelta(currentFiles, snapshot) {
    const delta = new DeltaResult();

    // 无快照 = 全量处理
    if (!snapshot || !snapshot.fileHashes) {
      delta.full = true;
      for (const filePath of currentFiles) {
        const hash = await this.adapter.computeHash(filePath);
        delta.added.push({ filePath, hash });
      }
      return delta;
    }

    const previousHashes = snapshot.fileHashes;
    const currentPaths = new Set(currentFiles);

    // 检测新增和修改
    for (const filePath of currentFiles) {
      const hash = await this.adapter.computeHash(filePath);
      const prev = previousHashes[filePath];

      if (!prev) {
        delta.added.push({ filePath, hash });
      } else if (prev.hash !== hash) {
        delta.modified.push({ filePath, hash, previousHash: prev.hash });
      } else {
        delta.unchanged.push({ filePath, hash });
      }
    }

    // 检测删除
    for (const [filePath, prev] of Object.entries(previousHashes)) {
      if (!currentPaths.has(filePath)) {
        delta.deleted.push({ filePath, previousHash: prev.hash });
      }
    }

    return delta;
  }

  // === 子类必须实现的阶段 ===

  /**
   * 清洗阶段
   * @param {Array<{filePath: string, hash: string}>} files - 待处理文件
   * @param {Object} config - 配置
   * @returns {Promise<Array<NormalizedDocument>>}
   */
  async clean(files, config) {
    throw new Error('Pipeline.clean must be implemented');
  }

  /**
   * 索引构建阶段
   * @param {Array} data - 清洗后数据（或分块后数据）
   * @param {Object} config - 配置
   * @param {DeltaResult} delta - 增量变更集
   * @returns {Promise<Object>} 索引构建结果
   */
  async index(data, config, delta) {
    throw new Error('Pipeline.index must be implemented');
  }

  // === 子类可选覆写的阶段 ===

  /**
   * 分块阶段（默认不启用）
   * @param {Array<NormalizedDocument>} cleaned - 清洗后文档
   * @param {Object} config - 配置
   * @returns {Promise<Array|null>} 分块结果，null 表示跳过分块
   */
  async chunk(cleaned, config) {
    return null;
  }

  /**
   * 质量验证阶段（默认通过）
   * @param {PipelineReport} report - 当前报告
   * @param {Object} config - 配置
   * @returns {Promise<Object>} 验证结果
   */
  async validate(report, config) {
    return { passed: true, checks: {} };
  }

  /**
   * 清理已删除文件的产出
   * @param {Array<{filePath: string}>} deletedFiles
   * @param {string} outputDir
   */
  async cleanupDeleted(deletedFiles, outputDir) {
    // 默认空实现，子类覆写
  }

  /**
   * 写入产出文件
   * @param {Array} cleaned
   * @param {Array|null} chunked
   * @param {Object} indexResult
   * @param {string} outputDir
   */
  async writeOutput(cleaned, chunked, indexResult, outputDir) {
    // 默认空实现，子类覆写
  }

  /**
   * 聚合清洗统计
   */
  aggregateCleanStats(cleanedDocs) {
    return { total: cleanedDocs.length };
  }
}

module.exports = { Pipeline, PipelineReport, DeltaResult };
