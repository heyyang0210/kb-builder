const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * 快照管理器
 * 
 * 每次预处理执行生成一个快照，记录：
 * - 执行元信息（时间、耗时、配置 hash）
 * - 输入统计（文件数、增量变更）
 * - 输出统计（清洗文件数、分块数、索引条目数）
 * - 质量验证结果
 * - 文件 hash 清单（用于增量检测和回溯）
 * 
 * 支持：
 * - 加载最新快照（增量检测）
 * - 加载指定快照（回溯）
 * - 列出所有快照
 * - 快照保留策略（默认保留最近 10 个）
 */
class SnapshotTracker {
  /**
   * @param {string} snapshotDir - 快照存储目录
   * @param {Object} [options]
   * @param {number} [options.maxRetained=10] - 最大保留快照数
   */
  constructor(snapshotDir, options = {}) {
    this.snapshotDir = snapshotDir;
    this.maxRetained = options.maxRetained || 10;
  }

  /**
   * 生成快照 ID
   * 格式：snap-{YYYYMMDD-HHmmss}-{randomSuffix}
   * @param {string} pipeline
   * @returns {string}
   */
  generateSnapshotId(pipeline) {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    return `snap-${dateStr}-${randomSuffix}`;
  }

  /**
   * 构建新快照
   * 
   * @param {Object} params
   * @param {string} params.pipeline - 流水线名称
   * @param {string} params.executionId - 执行 ID
   * @param {number} params.durationMs - 执行耗时
   * @param {string} params.configHash - 配置 hash
   * @param {Object} params.input - 输入统计
   * @param {Object} params.output - 输出统计
   * @param {Object} params.quality - 质量验证结果
   * @param {Object} params.fileHashes - 文件 hash 清单
   * @param {string|null} params.previousSnapshotId - 上一个快照 ID
   * @returns {Object} 快照对象
   */
  buildSnapshot({ pipeline, executionId, durationMs, configHash, input, output, quality, fileHashes, previousSnapshotId }) {
    return {
      snapshot_id: this.generateSnapshotId(pipeline),
      pipeline,
      execution_id: executionId,
      executed_at: new Date().toISOString(),
      duration_ms: durationMs,
      config_hash: configHash,
      previous_snapshot_id: previousSnapshotId || null,

      input: {
        total_files: input.totalFiles || 0,
        delta: input.delta || { added: 0, modified: 0, deleted: 0, unchanged: 0 }
      },

      output: {
        cleaned_files: output.cleanedFiles || 0,
        chunk_count: output.chunkCount || 0,
        l1_entries: output.l1Entries || 0,
        l2_summaries: output.l2Summaries || 0
      },

      quality: quality || { passed: true, checks: {} },

      file_hashes: fileHashes || {}
    };
  }

  /**
   * 保存快照
   * @param {string} pipeline - 流水线名称
   * @param {Object} snapshot - 快照对象
   */
  async save(pipeline, snapshot) {
    const pipelineDir = path.join(this.snapshotDir, pipeline);
    await fs.mkdir(pipelineDir, { recursive: true });

    const filePath = path.join(pipelineDir, `${snapshot.snapshot_id}.json`);
    await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');

    // 更新 latest 软链接
    const latestPath = path.join(pipelineDir, 'latest.json');
    try {
      await fs.unlink(latestPath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    await fs.writeFile(latestPath, JSON.stringify(snapshot, null, 2), 'utf-8');

    // 清理旧快照
    await this.pruneOldSnapshots(pipeline);

    return snapshot.snapshot_id;
  }

  /**
   * 加载最新快照
   * @param {string} pipeline
   * @returns {Promise<Object|null>}
   */
  async loadLatest(pipeline) {
    const latestPath = path.join(this.snapshotDir, pipeline, 'latest.json');
    try {
      const content = await fs.readFile(latestPath, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  /**
   * 加载指定快照
   * @param {string} pipeline
   * @param {string} snapshotId
   * @returns {Promise<Object|null>}
   */
  async load(pipeline, snapshotId) {
    const filePath = path.join(this.snapshotDir, pipeline, `${snapshotId}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  /**
   * 列出所有快照（按时间倒序）
   * @param {string} pipeline
   * @returns {Promise<Array>}
   */
  async list(pipeline) {
    const pipelineDir = path.join(this.snapshotDir, pipeline);
    try {
      const files = await fs.readdir(pipelineDir);
      const snapshotFiles = files.filter(f => f.startsWith('snap-') && f.endsWith('.json'));

      const snapshots = [];
      for (const file of snapshotFiles) {
        try {
          const content = await fs.readFile(path.join(pipelineDir, file), 'utf-8');
          const snapshot = JSON.parse(content);
          snapshots.push({
            snapshot_id: snapshot.snapshot_id,
            executed_at: snapshot.executed_at,
            duration_ms: snapshot.duration_ms,
            input_files: snapshot.input?.total_files,
            delta: snapshot.input?.delta
          });
        } catch {
          // 跳过损坏的快照文件
        }
      }

      // 按时间倒序
      snapshots.sort((a, b) => new Date(b.executed_at) - new Date(a.executed_at));
      return snapshots;
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  /**
   * 清理旧快照，保留最近 maxRetained 个
   * @param {string} pipeline
   */
  async pruneOldSnapshots(pipeline) {
    const pipelineDir = path.join(this.snapshotDir, pipeline);
    try {
      const files = await fs.readdir(pipelineDir);
      const snapshotFiles = files
        .filter(f => f.startsWith('snap-') && f.endsWith('.json'))
        .sort(); // 按文件名排序（时间戳在文件名中）

      if (snapshotFiles.length <= this.maxRetained) return;

      const toDelete = snapshotFiles.slice(0, snapshotFiles.length - this.maxRetained);
      for (const file of toDelete) {
        await fs.unlink(path.join(pipelineDir, file));
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  /**
   * 计算配置 hash（用于检测配置变更）
   * @param {Object} config
   * @returns {string}
   */
  static computeConfigHash(config) {
    const normalized = JSON.stringify(config, Object.keys(config).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }
}

module.exports = { SnapshotTracker };
