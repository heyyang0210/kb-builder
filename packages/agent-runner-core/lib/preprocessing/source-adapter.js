const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * 标准化文档 — 所有适配器的统一输出
 * 
 * 将不同格式的原始文件转化为统一的文档结构，
 * 后续清洗/分块/索引模块无需关心原始格式差异。
 */
class NormalizedDocument {
  /**
   * @param {Object} params
   * @param {string} params.title - 文档标题
   * @param {string} params.content - Markdown 格式的正文内容
   * @param {Object} params.metadata - 元数据
   */
  constructor({ title, content, metadata = {} }) {
    this.title = title || '';
    this.content = content || '';
    this.metadata = {
      sourcePath: metadata.sourcePath || '',
      sourceFormat: metadata.sourceFormat || '',
      version: metadata.version || '',
      docType: metadata.docType || '',
      author: metadata.author || '',
      createdDate: metadata.createdDate || '',
      keywords: metadata.keywords || [],
      hash: metadata.hash || '',
      docId: metadata.docId || '',
      sourceName: metadata.sourceName || '',
      rawSourceName: metadata.rawSourceName || '',
      assets: metadata.assets || [],
      sourceMetrics: metadata.sourceMetrics || {},
      officeRendering: metadata.officeRendering || null,
      extra: metadata.extra || {}
    };
    this.hash = metadata.hash || '';
  }

  /**
   * 文档行数
   */
  get lineCount() {
    return this.content.split('\n').length;
  }

  /**
   * 转为纯 JSON 对象（用于序列化）
   */
  toJSON() {
    return {
      title: this.title,
      content: this.content,
      metadata: { ...this.metadata },
      hash: this.hash,
      lineCount: this.lineCount
    };
  }
}

/**
 * 源数据适配器基类
 * 
 * 将不同格式的原始文件转化为统一的 NormalizedDocument。
 * Pipeline 通过 adapter 与原始数据交互，不直接处理格式差异。
 * 
 * 子类必须实现：
 * - name (getter)
 * - supportedExtensions (getter)
 * - parse(filePath)
 * - scan(dir)
 */
class SourceAdapter {
  /**
   * 适配器名称
   * @returns {string}
   */
  get name() {
    throw new Error('SourceAdapter.name must be implemented');
  }

  /**
   * 支持的文件扩展名列表
   * @returns {string[]} 如 ['.md', '.markdown']
   */
  get supportedExtensions() {
    throw new Error('SourceAdapter.supportedExtensions must be implemented');
  }

  /**
   * 检测文件是否由此适配器处理
   * @param {string} filePath
   * @returns {boolean}
   */
  canHandle(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  /**
   * 解析单个文件为标准化文档
   * @param {string} filePath - 文件绝对路径
   * @returns {Promise<NormalizedDocument>}
   */
  async parse(filePath) {
    throw new Error('SourceAdapter.parse must be implemented');
  }

  /**
   * 扫描目录，返回匹配的文件路径列表
   * @param {string} dir - 目录路径
   * @param {string} [filePattern] - glob 模式
   * @returns {Promise<string[]>} 匹配的文件路径列表
   */
  async scan(dir, filePattern = '**/*') {
    throw new Error('SourceAdapter.scan must be implemented');
  }

  /**
   * 计算文件内容 hash（SHA-256）
   * @param {string} filePath
   * @returns {Promise<string>} hex hash
   */
  async computeHash(filePath) {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

module.exports = { SourceAdapter, NormalizedDocument };
