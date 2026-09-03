const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');
const { SourceAdapter, NormalizedDocument } = require('../source-adapter');

/**
 * HTML 源数据适配器
 * 
 * 处理 PingCode 等导出的 HTML 文件，将其转化为 NormalizedDocument。
 * 使用 cheerio 解析 HTML，提取结构化内容并转为 Markdown 格式。
 */
class HtmlAdapter extends SourceAdapter {
  get name() {
    return 'html';
  }

  get supportedExtensions() {
    return ['.html', '.htm'];
  }

  /**
   * 解析单个 HTML 文件为标准化文档
   * @param {string} filePath - 文件绝对路径
   * @returns {Promise<NormalizedDocument>}
   */
  async parse(filePath) {
    const rawHtml = await fs.readFile(filePath, 'utf-8');
    const hash = await this.computeHash(filePath);
    const $ = cheerio.load(rawHtml);

    const title = this.extractTitle($, filePath);
    const metadata = this.extractMetadata($, filePath, hash);

    // 检测内容类型（在转换前）
    const hasImages = $('img').length > 0;
    const hasTables = $('table').length > 0;
    const hasCodeBlocks = $('pre, code').length > 0;

    const content = this.htmlToMarkdown($);
    const keywords = this.extractKeywords(title, filePath, $);

    return new NormalizedDocument({
      title,
      content,
      metadata: {
        ...metadata,
        keywords,
        extra: {
          lineCount: content.split('\n').length,
          hasImages,
          hasTables,
          hasCodeBlocks
        }
      }
    });
  }

  /**
   * 扫描目录，返回所有 HTML 文件
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

  extractTitle($, filePath) {
    const titleTag = $('title').text().trim();
    if (titleTag) return titleTag;
    const h1 = $('h1').first().text().trim();
    if (h1) return h1;
    return path.basename(filePath, path.extname(filePath));
  }

  extractMetadata($, filePath, hash) {
    const author = $('meta[name="author"]').attr('content') || '';
    const description = $('meta[name="description"]').attr('content') || '';
    const createdDate = $('meta[name="created"]').attr('content') || 
                        $('meta[property="article:published_time"]').attr('content') || '';
    const versionMatch = filePath.match(/YashanDB\s*(v[\d.]+)/i);
    const version = versionMatch ? versionMatch[1] : '';
    const docType = this.extractDocType(filePath);

    return {
      sourcePath: filePath,
      sourceFormat: 'html',
      version,
      docType,
      author,
      createdDate,
      description,
      hash
    };
  }

  /**
   * 将 HTML body 内容转为 Markdown 格式
   * 处理顺序很重要：先处理内联元素（粗体/斜体），再处理块级元素（段落）
   */
  htmlToMarkdown($) {
    const body = $('body').length ? $('body') : $;
    
    // 1. 代码块
    body.find('pre').each((_, el) => {
      const $el = $(el);
      const code = $el.find('code').text() || $el.text();
      const lang = ($el.find('code').attr('class') || '').match(/language-(\w+)/);
      const langStr = lang ? lang[1] : '';
      $el.replaceWith('\n```' + langStr + '\n' + code.trim() + '\n```\n');
    });

    // 2. 行内代码
    body.find('code').each((_, el) => {
      const $el = $(el);
      if ($el.parent('pre').length === 0) {
        $el.replaceWith('`' + $el.text() + '`');
      }
    });

    // 3. 表格
    body.find('table').each((_, el) => {
      const $el = $(el);
      const md = this.tableToMarkdown($, $el);
      $el.replaceWith('\n' + md + '\n');
    });

    // 4. 图片
    body.find('img').each((_, el) => {
      const $el = $(el);
      const alt = $el.attr('alt') || '图片';
      $el.replaceWith('[图片: ' + alt + ']');
    });

    // 5. 链接
    body.find('a').each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      const href = $el.attr('href') || '';
      if (href.startsWith('#')) {
        $el.replaceWith(text);
      } else {
        $el.replaceWith('[' + text + '](' + href + ')');
      }
    });

    // 6. 粗体和斜体（在段落之前处理）
    body.find('strong, b').each((_, el) => {
      const $el = $(el);
      $el.replaceWith('**' + $el.text() + '**');
    });

    body.find('em, i').each((_, el) => {
      const $el = $(el);
      $el.replaceWith('*' + $el.text() + '*');
    });

    // 7. 标题
    for (let i = 6; i >= 1; i--) {
      const prefix = '#'.repeat(i);
      body.find('h' + i).each((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        $el.replaceWith('\n' + prefix + ' ' + text + '\n');
      });
    }

    // 8. 列表
    body.find('ul > li').each((_, el) => {
      const $el = $(el);
      $el.replaceWith('- ' + $el.text().trim());
    });

    body.find('ol > li').each((_, el) => {
      const $el = $(el);
      const index = $el.index() + 1;
      $el.replaceWith(index + '. ' + $el.text().trim());
    });

    // 9. 段落
    body.find('p').each((_, el) => {
      const $el = $(el);
      $el.replaceWith('\n' + $el.text().trim() + '\n');
    });

    // 10. 换行
    body.find('br').each((_, el) => {
      $(el).replaceWith('\n');
    });

    // 获取文本并清理多余空行
    let text = body.text();
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
  }

  /**
   * 将 HTML 表格转为 Markdown 表格
   */
  tableToMarkdown($, $table) {
    const rows = [];
    
    $table.find('tr').each((_, tr) => {
      const cells = [];
      $(tr).find('th, td').each((_, cell) => {
        cells.push($(cell).text().trim().replace(/\|/g, '\\|'));
      });
      if (cells.length > 0) rows.push(cells);
    });

    if (rows.length === 0) return '';

    const colCount = Math.max(...rows.map(r => r.length));
    const normalized = rows.map(r => {
      while (r.length < colCount) r.push('');
      return r;
    });

    const header = normalized[0];
    const separator = header.map(() => '---');
    const lines = [
      '| ' + header.join(' | ') + ' |',
      '| ' + separator.join(' | ') + ' |',
      ...normalized.slice(1).map(r => '| ' + r.join(' | ') + ' |')
    ];

    return lines.join('\n');
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

  extractKeywords(title, filePath, $) {
    const keywords = new Set();
    title.split(/[\s\-_/\\()[\]{}]+/)
      .filter(t => t.length >= 2 && !/^[\d.]+$/.test(t))
      .forEach(t => keywords.add(t));

    const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
    if (metaKeywords) {
      metaKeywords.split(',').map(k => k.trim()).filter(Boolean).forEach(k => keywords.add(k));
    }

    const bodyText = $('body').text();
    const featureMatch = filePath.match(/YDBRD-(\d+)/) || bodyText.match(/YDBRD-(\d+)/);
    if (featureMatch) keywords.add('YDBRD-' + featureMatch[1]);

    return Array.from(keywords).slice(0, 15);
  }
}

module.exports = { HtmlAdapter };
