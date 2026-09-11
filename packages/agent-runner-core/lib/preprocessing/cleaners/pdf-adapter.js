const fs = require('fs').promises;
const path = require('path');
const { SourceAdapter, NormalizedDocument } = require('../source-adapter');

/**
 * PDF 源数据适配器
 * 
 * 处理 PDF 文件，使用 pdf-parse 提取文本内容。
 */
class PdfAdapter extends SourceAdapter {
  get name() {
    return 'pdf';
  }

  get supportedExtensions() {
    return ['.pdf'];
  }

  /**
   * 解析单个 PDF 文件为标准化文档
   * @param {string} filePath - 文件绝对路径
   * @returns {Promise<NormalizedDocument>}
   */
  async parse(filePath) {
    const pdfParse = require('pdf-parse');
    const dataBuffer = await fs.readFile(filePath);
    const hash = await this.computeHash(filePath);

    const data = await pdfParse(dataBuffer);

    // 提取标题
    const title = this.extractTitle(data, filePath);

    // 从路径提取版本和文档类型
    const version = this.extractVersion(filePath);
    const docType = this.extractDocType(filePath);

    // 清理文本内容
    const content = this.cleanPdfText(data.text);

    // 提取关键词
    const keywords = this.extractKeywords(title, filePath, data);

    return new NormalizedDocument({
      title,
      content,
      metadata: {
        sourcePath: filePath,
        sourceFormat: 'pdf',
        version,
        docType,
        author: data.info?.Author || '',
        createdDate: data.info?.CreationDate ? this.parsePdfDate(data.info.CreationDate) : '',
        keywords,
        hash,
        extra: {
          lineCount: content.split('\n').length,
          pageCount: data.numpages,
          pdfInfo: {
            producer: data.info?.Producer || '',
            creator: data.info?.Creator || ''
          }
        }
      }
    });
  }

  /**
   * 扫描目录，返回所有 PDF 文件
   */
  async scan(dir) {
    const files = [];
    await this.scanRecursive(dir, files);
    return files.sort();
  }

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
      if (err.code !== 'ENOENT' && err.code !== 'EACCES') throw err;
    }
  }

  /**
   * 提取标题
   */
  extractTitle(data, filePath) {
    // 优先从 PDF 元数据
    if (data.info?.Title && data.info.Title.trim()) {
      return data.info.Title.trim();
    }
    // 从文本第一行
    const firstLine = data.text.split('\n').find(l => l.trim().length > 0);
    if (firstLine && firstLine.trim().length < 100) {
      return firstLine.trim();
    }
    return path.basename(filePath, '.pdf');
  }

  /**
   * 清理 PDF 提取的文本
   */
  cleanPdfText(text) {
    return text
      // 修复断行（行尾连字符）
      .replace(/(\w)-\n(\w)/g, '$1$2')
      // 合并被断开的段落（前一行不以句号等结尾，且下一行以小写字母开头）
      .replace(/([^.!?\n])\n([a-z])/g, '$1 $2')
      // 清理多余空行
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  extractVersion(filePath) {
    const match = filePath.match(/YashanDB\s*(v[\d.]+)/i);
    return match ? match[1] : '';
  }

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
      if (pattern.test(filePath)) return type;
    }
    return '其他';
  }

  /**
   * 解析 PDF 日期格式 (D:YYYYMMDDHHmmSS)
   */
  parsePdfDate(dateStr) {
    if (!dateStr) return '';
    const match = dateStr.match(/D:(\d{4})(\d{2})?(\d{2})?/);
    if (!match) return dateStr;
    const year = match[1];
    const month = match[2] || '01';
    const day = match[3] || '01';
    return `${year}-${month}-${day}`;
  }

  extractKeywords(title, filePath, data) {
    const keywords = new Set();
    const titleTerms = title.split(/[\s\-_/\\()[\]{}]+/)
      .filter(t => t.length >= 2 && !/^[\d.]+$/.test(t));
    titleTerms.forEach(t => keywords.add(t));

    const featureMatch = filePath.match(/YDBRD-(\d+)/) || data.text.match(/YDBRD-(\d+)/);
    if (featureMatch) keywords.add(`YDBRD-${featureMatch[1]}`);

    return Array.from(keywords).slice(0, 15);
  }
}

module.exports = { PdfAdapter };
