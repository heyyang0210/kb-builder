/**
 * 适配器链 - 支持多格式文档处理
 * 
 * 根据文件扩展名自动选择合适的适配器进行解析
 */

const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { NormalizedDocument } = require('../source-adapter');

class AdapterChain {
  /**
   * @param {Array<SourceAdapter>} adapters - 适配器列表
   */
  constructor(adapters = [], options = {}) {
    this.adapters = adapters;
    this.excludePatterns = options.excludePatterns || [];
  }

  /**
   * 添加适配器
   */
  addAdapter(adapter) {
    this.adapters.push(adapter);
  }

  /**
   * 检查是否能处理该文件
   */
  canHandle(filePath) {
    return this.adapters.some(adapter => adapter.canHandle(filePath));
  }

  /**
   * 解析文件为标准化文档
   */
  async parse(filePath) {
    const adapter = this.selectAdapter(filePath);
    if (!adapter) {
      throw new Error(`No adapter found for file: ${filePath}`);
    }
    return await adapter.parse(filePath);
  }

  /**
   * 扫描目录中的所有支持文件
   */
  async scan(dir) {
    const allFiles = [];
    for (const adapter of this.adapters) {
      const files = await adapter.scan(dir);
      allFiles.push(...files);
    }
    return Array.from(new Set(allFiles)).filter(filePath => !this.isExcluded(filePath));
  }

  /**
   * 根据文件路径选择合适的适配器
   */
  selectAdapter(filePath) {
    return this.adapters.find(adapter => adapter.canHandle(filePath)) || null;
  }

  /**
   * 获取所有支持的扩展名
   */
  getSupportedExtensions() {
    const extensions = new Set();
    for (const adapter of this.adapters) {
      if (adapter.supportedExtensions) {
        adapter.supportedExtensions.forEach(ext => extensions.add(ext));
      }
    }
    return Array.from(extensions);
  }

  isExcluded(filePath) {
    return this.excludePatterns.some(pattern => {
      if (pattern instanceof RegExp) return pattern.test(filePath);
      return filePath.includes(String(pattern));
    });
  }

  /**
   * 计算文件内容 hash（SHA-256）
   * Pipeline 基类需要此方法
   */
  async computeHash(filePath) {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

module.exports = { AdapterChain };
