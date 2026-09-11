const fs = require('fs').promises;
const path = require('path');
const { SourceAdapter, NormalizedDocument } = require('../source-adapter');

/**
 * Excel 源数据适配器
 * 
 * 处理 .xlsx/.xls 文件，使用 xlsx 库提取表格数据。
 * 每个 Sheet 作为一个章节，表格数据保留为 Markdown 表格。
 */
class ExcelAdapter extends SourceAdapter {
  get name() {
    return 'excel';
  }

  get supportedExtensions() {
    return ['.xlsx', '.xls'];
  }

  /**
   * 解析单个 Excel 文件为标准化文档
   * @param {string} filePath - 文件绝对路径
   * @returns {Promise<NormalizedDocument>}
   */
  async parse(filePath) {
    const XLSX = require('xlsx');
    const hash = await this.computeHash(filePath);

    const workbook = XLSX.readFile(filePath);
    const title = path.basename(filePath, path.extname(filePath));

    // 每个 Sheet 转为 Markdown 章节
    const sections = workbook.SheetNames.map(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const markdownTable = this.convertToMarkdownTable(data);
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      const rowCount = range.e.r - range.s.r + 1;
      const colCount = range.e.c - range.s.c + 1;

      return {
        sheetName,
        content: `## ${sheetName}\n\n${markdownTable}`,
        rowCount,
        colCount
      };
    });

    const content = sections.map(s => s.content).join('\n\n---\n\n');

    // 从路径提取版本和文档类型
    const version = this.extractVersion(filePath);
    const docType = this.extractDocType(filePath);

    // 提取关键词
    const keywords = this.extractKeywords(title, filePath, sections);

    return new NormalizedDocument({
      title,
      content,
      metadata: {
        sourcePath: filePath,
        sourceFormat: 'excel',
        version,
        docType,
        author: '',
        createdDate: '',
        keywords,
        hash,
        extra: {
          lineCount: content.split('\n').length,
          sheetCount: workbook.SheetNames.length,
          sheets: sections.map(s => ({
            name: s.sheetName,
            rows: s.rowCount,
            cols: s.colCount
          }))
        }
      }
    });
  }

  /**
   * 扫描目录，返回所有 Excel 文件
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
   * 将二维数组转为 Markdown 表格
   */
  convertToMarkdownTable(data) {
    if (!data || data.length === 0) return '_（空表）_';

    // 过滤全空行
    const nonEmptyRows = data.filter(row => row.some(cell => String(cell).trim() !== ''));
    if (nonEmptyRows.length === 0) return '_（空表）_';

    // 限制行数（避免超大表格）
    const maxRows = 500;
    const truncated = nonEmptyRows.length > maxRows;
    const rows = truncated ? nonEmptyRows.slice(0, maxRows) : nonEmptyRows;

    // 确保所有行列数一致
    const colCount = Math.max(...rows.map(r => r.length));
    const normalized = rows.map(r => {
      const cells = r.map(cell => String(cell || '').replace(/\|/g, '\\|').replace(/\n/g, ' '));
      while (cells.length < colCount) cells.push('');
      return cells;
    });

    // 第一行作为表头
    const lines = [
      '| ' + normalized[0].join(' | ') + ' |',
      '| ' + normalized[0].map(() => '---').join(' | ') + ' |',
      ...normalized.slice(1).map(r => '| ' + r.join(' | ') + ' |')
    ];

    if (truncated) {
      lines.push(`\n_（表格已截断，共 ${nonEmptyRows.length} 行，显示前 ${maxRows} 行）_`);
    }

    return lines.join('\n');
  }

  extractVersion(filePath) {
    const match = filePath.match(/YashanDB\s*(v[\d.]+)/i);
    return match ? match[1] : '';
  }

  extractDocType(filePath) {
    const typePatterns = {
      '特性设计': /特性设计/, '测试设计': /测试设计/, '需求分析': /需求分析/,
      '概要设计': /概要设计/, '开发概要': /开发概要/, '架构设计': /架构设计/
    };
    for (const [type, pattern] of Object.entries(typePatterns)) {
      if (pattern.test(filePath)) return type;
    }
    return '其他';
  }

  extractKeywords(title, filePath, sections) {
    const keywords = new Set();
    title.split(/[\s\-_/\\()[\]{}]+/)
      .filter(t => t.length >= 2 && !/^[\d.]+$/.test(t))
      .forEach(t => keywords.add(t));

    // Sheet 名称作为关键词
    sections.forEach(s => {
      if (s.sheetName.length >= 2 && s.sheetName.length <= 30) {
        keywords.add(s.sheetName);
      }
    });

    const featureMatch = filePath.match(/YDBRD-(\d+)/);
    if (featureMatch) keywords.add(`YDBRD-${featureMatch[1]}`);

    return Array.from(keywords).slice(0, 15);
  }
}

module.exports = { ExcelAdapter };
