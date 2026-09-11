const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const { AGENT_RUNNER_RUNTIME_ROOT } = require('./repo-paths');

/**
 * 中间过程文件存储
 * 
 * 所有中间文件统一存储在 logs/intermediate/ 子目录下，按任务 ID 组织，
 * 便于后续统一处理（清理、分析、导出）。
 * 
 * 支持生产模式（仅存储关键节点）和调试模式（全部存储）。
 */
class ProcessStore {
  constructor(taskId, mode = 'production') {
    this.taskId = taskId;
    this.mode = mode;
    // 所有中间文件统一存储在 logs/intermediate/ 下
    this.basePath = path.join(AGENT_RUNNER_RUNTIME_ROOT, 'logs', 'intermediate', taskId);
  }

  /**
   * 存储中间结果
   * @param {string} stage - 阶段目录（如 '01-input-preparation'）
   * @param {string} filename - 文件名
   * @param {*} data - 数据（对象会自动 JSON 序列化）
   * @param {boolean} forceSave - 是否强制保存（忽略模式限制）
   * @returns {Promise<string>} 文件路径
   */
  async save(stage, filename, data, forceSave = false) {
    // 生产模式只保存关键文件，调试模式全部保存
    if (this.mode === 'production' && !forceSave && !this._isCriticalFile(stage, filename)) {
      return null;
    }

    const dir = path.join(this.basePath, stage);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);

    let content;
    if (typeof data === 'string') {
      content = data;
    } else {
      content = JSON.stringify(data, null, 2);
    }

    await fs.writeFile(filePath, content, 'utf-8');
    logger.debug(`[process-store] Saved: ${filePath}`);
    return filePath;
  }

  /**
   * 读取中间文件
   * @param {string} stage - 阶段目录
   * @param {string} filename - 文件名
   * @returns {Promise<*>} 解析后的数据
   */
  async load(stage, filename) {
    const filePath = path.join(this.basePath, stage, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }

  /**
   * 检查文件是否存在
   */
  async exists(stage, filename) {
    const filePath = path.join(this.basePath, stage, filename);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 存储 MCP 查询的完整请求和响应
   */
  async saveMcpQuery(index, query, result) {
    const filename = `query-${String(index + 1).padStart(2, '0')}.json`;
    return this.save('02-retrieval-plan/03-mcp-queries', filename, {
      query,
      request: {
        method: 'tools/call',
        name: 'search_ku',
        arguments: { query }
      },
      response: result,
      timestamp: new Date().toISOString()
    }, true); // MCP 查询始终保存
  }

  /**
   * 存储 LLM 调用的完整上下文
   */
  async saveLlmCall(stage, messages, response) {
    return this.save(stage, '02-llm-response.json', {
      request: {
        model: response.model,
        messages_count: messages.length,
        messages: messages
      },
      response: {
        content: response.content,
        usage: response.usage,
        model: response.model,
        finish_reason: response.finish_reason
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 存储任务元信息
   */
  async saveMeta(metadata) {
    return this.save('', 'meta.json', {
      taskId: this.taskId,
      mode: this.mode,
      createdAt: new Date().toISOString(),
      ...metadata
    }, true);
  }

  /**
   * 列出所有中间文件
   */
  async listFiles() {
    const files = [];
    await this._listFilesRecursive(this.basePath, '', files);
    return files;
  }

  async _listFilesRecursive(dir, prefix, files) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await this._listFilesRecursive(fullPath, relativePath, files);
        } else {
          files.push(relativePath);
        }
      }
    } catch (err) {
      // 目录不存在
    }
    return files;
  }

  /**
   * 判断是否为关键文件（生产模式下也保存）
   */
  _isCriticalFile(stage, filename) {
    const criticalPatterns = [
      'meta.json',
      'knowledge-point.json',
      'retrieval-plan.json',
      'generated-document.md',
      'final-document.md',
      'llm-response.json'
    ];
    return criticalPatterns.some(pattern => filename.includes(pattern));
  }
}

module.exports = ProcessStore;
