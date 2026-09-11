const fs = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip');
const { SourceAdapter, NormalizedDocument } = require('../source-adapter');
const { buildAsset } = require('../asset-utils');
const { buildDocumentId, sourceNames } = require('../document-identity');
const { renderOfficeAssets } = require('../renderers/render-office-assets');

/**
 * Word 文档源数据适配器
 * 
 * 处理 .docx 文件，使用 mammoth 提取内容并转为 Markdown。
 */
class DocxAdapter extends SourceAdapter {
  constructor(options = {}) {
    super();
    this.officeRenderer = options.officeRenderer || null;
  }

  get name() {
    return 'docx';
  }

  get supportedExtensions() {
    return ['.docx'];
  }

  /**
   * 解析单个 DOCX 文件为标准化文档
   * @param {string} filePath - 文件绝对路径
   * @returns {Promise<NormalizedDocument>}
   */
  async parse(filePath) {
    const mammoth = require('mammoth');
    const hash = await this.computeHash(filePath);
    const { rawSourceName, sourceName } = sourceNames(filePath);
    const sourceTitle = path.basename(sourceName, path.extname(sourceName));
    const assets = [];

    const result = await mammoth.convertToHtml({ path: filePath }, {
      convertImage: mammoth.images.imgElement(async image => {
        const data = Buffer.from(await image.read('base64'), 'base64');
        const asset = buildAsset({
          data,
          mimeType: image.contentType,
          index: assets.length + 1,
          title: sourceTitle,
          location: `第 ${assets.length + 1} 个图片`,
          sourcePart: `word/media/${assets.length + 1}`
        });
        assets.push(asset);
        return { src: asset.relativePath, alt: asset.alt || '原始图片' };
      })
    });
    const html = result.value;
    const messages = result.messages;

    // 从 HTML 提取标题
    const title = this.extractTitle(html, filePath);

    // 将 HTML 转为 Markdown
    this.appendPackageMedia(filePath, assets, sourceTitle);
    const rendered = await renderOfficeAssets(this.officeRenderer, filePath, title);
    assets.push(...rendered.assets);
    const content = this.appendUnplacedAssets(this.htmlToMarkdown(html, assets), assets);
    const sourceMetrics = this.extractSourceMetrics(filePath, assets.length);

    // 从路径提取版本和文档类型
    const version = this.extractVersion(filePath);
    const docType = this.extractDocType(filePath);

    // 提取关键词
    const keywords = this.extractKeywords(title, filePath);

    return new NormalizedDocument({
      title,
      content,
      metadata: {
        sourcePath: filePath,
        sourceFormat: 'docx',
        version,
        docType,
        author: '',
        createdDate: '',
        keywords,
        hash,
        docId: buildDocumentId({ hash }),
        sourceName,
        rawSourceName,
        assets,
        officeRendering: rendered.status,
        sourceMetrics,
        extra: {
          lineCount: content.split('\n').length,
          warnings: messages.filter(m => m.type === 'warning').map(m => m.message).slice(0, 10)
        }
      }
    });
  }

  /**
   * 扫描目录，返回所有 DOCX 文件
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
   * 从 HTML 中提取标题
   */
  extractTitle(html, filePath) {
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (h1Match) return h1Match[1].replace(/<[^>]+>/g, '').trim();

    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) return titleMatch[1].replace(/<[^>]+>/g, '').trim();

    const { sourceName } = sourceNames(filePath);
    return path.basename(sourceName, path.extname(sourceName));
  }

  /**
   * 简易 HTML 转 Markdown
   */
  htmlToMarkdown(html, assets = []) {
    let md = html;

    // 标题
    for (let i = 6; i >= 1; i--) {
      md = md.replace(new RegExp(`<h${i}[^>]*>(.*?)</h${i}>`, 'gi'), 
        (_, text) => `\n${'#'.repeat(i)} ${text.replace(/<[^>]+>/g, '').trim()}\n`);
    }

    // 段落
    md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, (_, text) => `\n${text}\n`);

    // 粗体
    md = md.replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '**$2**');

    // 斜体
    md = md.replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '*$2*');

    // 列表
    md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
    md = md.replace(/<\/?[uo]l[^>]*>/gi, '\n');

    // 图片：保留原始资产引用和一句说明
    md = md.replace(/<img([^>]*)>/gi, (_, attributes) => {
      const source = attributes.match(/src="([^"]+)"/i)?.[1] || '';
      const alt = attributes.match(/alt="([^"]*)"/i)?.[1] || '原始图片';
      const asset = assets.find(item => item.relativePath === source);
      const caption = asset ? `\n\n> 图片说明：${asset.caption}` : '';
      return source ? `![${alt}](${source})${caption}` : `[图片: ${alt}]`;
    });

    // 链接
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

    // 表格处理
    md = this.convertTables(md);

    // 换行
    md = md.replace(/<br\s*\/?>/gi, '\n');

    // 清除剩余 HTML 标签
    md = md.replace(/<[^>]+>/g, '');

    // 解码 HTML 实体
    md = md.replace(/&amp;/g, '&')
           .replace(/&lt;/g, '<')
           .replace(/&gt;/g, '>')
           .replace(/&nbsp;/g, ' ')
           .replace(/&quot;/g, '"');

    // 清理多余空行
    md = md.replace(/\n{3,}/g, '\n\n').trim();

    return md;
  }

  /**
   * 转换 HTML 表格为 Markdown 表格
   */
  convertTables(html) {
    return html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent) => {
      const rows = [];
      const rowMatches = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
      
      for (const rowHtml of rowMatches) {
        const cells = [];
        const cellMatches = rowHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
        for (const cellHtml of cellMatches) {
          const text = cellHtml.replace(/<[^>]+>/g, '').trim();
          cells.push(text.replace(/\|/g, '\\|'));
        }
        if (cells.length > 0) rows.push(cells);
      }

      if (rows.length === 0) return '';

      const colCount = Math.max(...rows.map(r => r.length));
      const normalized = rows.map(r => {
        while (r.length < colCount) r.push('');
        return r;
      });

      const lines = [
        '| ' + normalized[0].join(' | ') + ' |',
        '| ' + normalized[0].map(() => '---').join(' | ') + ' |',
        ...normalized.slice(1).map(r => '| ' + r.join(' | ') + ' |')
      ];

      return '\n' + lines.join('\n') + '\n';
    });
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

  extractKeywords(title, filePath) {
    const keywords = new Set();
    title.split(/[\s\-_/\\()[\]{}]+/)
      .filter(t => t.length >= 2 && !/^[\d.]+$/.test(t))
      .forEach(t => keywords.add(t));

    const featureMatch = filePath.match(/YDBRD-(\d+)/);
    if (featureMatch) keywords.add(`YDBRD-${featureMatch[1]}`);

    return Array.from(keywords).slice(0, 15);
  }

  extractSourceMetrics(filePath, exportedMediaCount) {
    const zip = new AdmZip(filePath);
    const documentXml = zip.getEntry('word/document.xml')?.getData().toString('utf-8') || '';
    const sourceText = Array.from(documentXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
      .map(match => match[1].replace(/<[^>]+>/g, ''))
      .join('');
    const mediaCount = zip.getEntries().filter(entry => /^word\/media\//.test(entry.entryName)).length;
    return {
      sourceText,
      sourceTextChars: sourceText.length,
      mediaCount,
      exportedMediaCount
    };
  }

  appendPackageMedia(filePath, assets, title) {
    const zip = new AdmZip(filePath);
    const existingHashes = new Set(assets.map(asset => asset.hash));
    const mediaEntries = zip.getEntries().filter(entry => /^word\/media\//.test(entry.entryName));
    for (const entry of mediaEntries) {
      const candidate = buildAsset({
        data: entry.getData(),
        originalName: path.posix.basename(entry.entryName),
        index: assets.length + 1,
        title,
        location: '媒体资产中',
        sourcePart: entry.entryName
      });
      const existing = assets.find(asset => asset.hash === candidate.hash);
      if (existing) {
        existing.sourcePart = entry.entryName;
        existing.originalName = candidate.originalName;
        existingHashes.add(candidate.hash);
      } else {
        assets.push(candidate);
        existingHashes.add(candidate.hash);
      }
    }
  }

  appendUnplacedAssets(content, assets) {
    const unplaced = assets.filter(asset => !content.includes(`](${asset.relativePath})`));
    if (unplaced.length === 0) return content;
    const lines = [content, '', '## 未定位媒体资产'];
    for (const asset of unplaced) {
      lines.push('', `![${asset.alt || '原始图片'}](${asset.relativePath})`, '', `> 图片说明：${asset.caption}`);
    }
    return lines.join('\n');
  }
}

module.exports = { DocxAdapter };
