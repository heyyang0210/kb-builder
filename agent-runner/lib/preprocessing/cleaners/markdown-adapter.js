const fs = require('fs').promises;
const path = require('path');
const { SourceAdapter, NormalizedDocument } = require('../source-adapter');

/**
 * Markdown 源数据适配器
 * 
 * 处理 Confluence 导出的 Markdown 文件，将其转化为 NormalizedDocument。
 * 支持递归扫描目录结构。
 */
class MarkdownAdapter extends SourceAdapter {
  get name() {
    return 'markdown';
  }

  get supportedExtensions() {
    return ['.md', '.markdown'];
  }

  /**
   * 解析单个 Markdown 文件为标准化文档
   * @param {string} filePath - 文件绝对路径
   * @returns {Promise<NormalizedDocument>}
   */
  async parse(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const hash = await this.computeHash(filePath);

    // 提取标题（第一个 # 开头的行）
    const titleMatch = content.match(/^#{1,6}\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : path.basename(filePath, '.md');

    // 从路径提取版本
    const versionMatch = filePath.match(/YashanDB\s*(v[\d.]+)/i);
    const version = versionMatch ? versionMatch[1] : '';

    // 从路径提取文档类型
    const docType = this.extractDocType(filePath);

    // 提取作者和日期（Created by 行）
    const { author, createdDate } = this.extractAuthorInfo(content);

    // 提取关键词
    const keywords = this.extractKeywords(title, filePath, content);

    return new NormalizedDocument({
      title,
      content,
      metadata: {
        sourcePath: filePath,
        sourceFormat: 'markdown',
        version,
        docType,
        author,
        createdDate,
        keywords,
        hash,
        extra: {
          lineCount: content.split('\n').length
        }
      }
    });
  }

  /**
   * 扫描目录，返回所有 Markdown 文件
   * @param {string} dir - 目录路径
   * @returns {Promise<string[]>}
   */
  async scan(dir) {
    const files = [];
    await this.scanRecursive(dir, files);
    return files.sort();
  }

  /**
   * 递归扫描目录
   */
  async scanRecursive(dir, files) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await this.scanRecursive(fullPath, files);
        } else if (entry.isFile() && this.canHandle(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'EACCES') {
        throw err;
      }
      // 忽略不可访问的目录
    }
  }

  /**
   * 从路径提取文档类型
   */
  extractDocType(filePath) {
    const typePatterns = {
      '特性设计': /特性设计/,
      '测试设计': /测试设计/,
      '需求分析': /需求分析/,
      '概要设计': /概要设计/,
      '开发概要': /开发概要/,
      '架构设计': /架构设计/
    };

    for (const [type, pattern] of Object.entries(typePatterns)) {
      if (pattern.test(filePath)) {
        return type;
      }
    }
    return '其他';
  }

  /**
   * 提取作者信息
   */
  extractAuthorInfo(content) {
    const match = content.match(
      /Created by ([^\n]+?)(?:\s+on\s+([\d-]+))?(?:,\s*last\s+modified\s+on\s+(.+?))?\s*$/m
    );

    return {
      author: match ? match[1].trim() : '',
      createdDate: match && match[2] ? match[2].trim() : (match && match[3] ? match[3].trim() : '')
    };
  }

  /**
   * 提取关键词
   */
  extractKeywords(title, filePath, content) {
    const keywords = new Set();

    // 从标题提取技术术语
    const titleTerms = this.extractTechnicalTerms(title);
    titleTerms.forEach(t => keywords.add(t));

    // 从文件名提取
    const fileName = path.basename(filePath, '.md');
    const fileNameTerms = this.extractTechnicalTerms(fileName);
    fileNameTerms.forEach(t => keywords.add(t));

    // 提取 YDBRD 编号
    const featureMatch = filePath.match(/YDBRD-(\d+)/) || content.match(/YDBRD-(\d+)/);
    if (featureMatch) {
      keywords.add(`YDBRD-${featureMatch[1]}`);
    }

    return Array.from(keywords).slice(0, 15);
  }

  /**
   * 从文本中提取技术术语
   * 简单实现：按空格和标点分割，过滤短词
   */
  extractTechnicalTerms(text) {
    const terms = text
      .split(/[\s\-_/\\()[\]{}]+/)
      .filter(t => t.length >= 2 && !/^[\d.]+$/.test(t))
      .map(t => t.trim());

    return [...new Set(terms)].slice(0, 10);
  }
}

module.exports = { MarkdownAdapter };
