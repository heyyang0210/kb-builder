const fs = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip');
const cheerio = require('cheerio');
const { SourceAdapter, NormalizedDocument } = require('../source-adapter');
const { buildAsset } = require('../asset-utils');
const { buildDocumentId, sourceNames } = require('../document-identity');
const { renderOfficeAssets } = require('../renderers/render-office-assets');

/**
 * PowerPoint 源数据适配器
 * 
 * 处理 .pptx 文件，直接解析 ZIP 内的 XML 提取幻灯片文本。
 * PPTX 本质是 ZIP 包，幻灯片内容在 ppt/slides/slide*.xml 中。
 */
class PptxAdapter extends SourceAdapter {
  constructor(options = {}) {
    super();
    this.officeRenderer = options.officeRenderer || null;
  }

  get name() {
    return 'pptx';
  }

  get supportedExtensions() {
    return ['.pptx'];
  }

  /**
   * 解析单个 PPTX 文件为标准化文档
   * @param {string} filePath - 文件绝对路径
   * @returns {Promise<NormalizedDocument>}
   */
  async parse(filePath) {
    const hash = await this.computeHash(filePath);
    const { rawSourceName, sourceName } = sourceNames(filePath);
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    // 提取幻灯片文件（按编号排序）
    const slideEntries = entries
      .filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
      .sort((a, b) => {
        const numA = parseInt(a.entryName.match(/slide(\d+)/)[1]);
        const numB = parseInt(b.entryName.match(/slide(\d+)/)[1]);
        return numA - numB;
      });

    // 提取备注文件
    const notesEntries = entries
      .filter(e => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(e.entryName));

    const slides = [];
    for (let i = 0; i < slideEntries.length; i++) {
      const slideXml = slideEntries[i].getData().toString('utf-8');
      const slideData = this.parseSlideXml(slideXml, i + 1);
      const relationshipsEntry = zip.getEntry(`ppt/slides/_rels/slide${i + 1}.xml.rels`);
      slideData.relationships = relationshipsEntry
        ? this.parseRelationships(relationshipsEntry.getData().toString('utf-8'))
        : {};

      // 尝试匹配对应的备注
      const notesEntry = notesEntries.find(e => 
        e.entryName === `ppt/notesSlides/notesSlide${i + 1}.xml`
      );
      if (notesEntry) {
        const notesXml = notesEntry.getData().toString('utf-8');
        slideData.notes = this.extractNotesText(notesXml);
      }

      slides.push(slideData);
    }

    const title = slides.length > 0 && slides[0].title 
      ? slides[0].title 
      : path.basename(sourceName, '.pptx');
    const assets = this.extractAssets(entries, slides, title);
    const rendered = await renderOfficeAssets(this.officeRenderer, filePath, title, '张幻灯片');
    for (const asset of rendered.assets) {
      asset.placements = [{ slide: asset.renderedPage }];
    }
    assets.push(...rendered.assets);
    const assetsByPart = new Map(assets.map(asset => [asset.sourcePart, asset]));

    // 构建 Markdown 内容
    const content = this.buildMarkdown(slides, assetsByPart);

    const version = this.extractVersion(filePath);
    const docType = this.extractDocType(filePath);
    const keywords = this.extractKeywords(title, filePath, slides);

    return new NormalizedDocument({
      title,
      content,
      metadata: {
        sourcePath: filePath,
        sourceFormat: 'pptx',
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
        sourceMetrics: {
          sourceText: slides.flatMap(slide => slide.texts).join('\n'),
          sourceTextChars: slides.flatMap(slide => slide.texts).join('\n').length,
          mediaCount: entries.filter(entry => /^ppt\/media\//.test(entry.entryName)).length,
          exportedMediaCount: assets.length,
          renderedPageCount: rendered.assets.length,
          slideCount: slideEntries.length,
          convertedSlideCount: slides.length
        },
        extra: {
          lineCount: content.split('\n').length,
          slideCount: slides.length,
          slides: slides.map(s => ({
            number: s.number,
            title: s.title,
            textLength: s.texts.join(' ').length,
            hasNotes: !!s.notes
          }))
        },
        officeRendering: rendered.status
      }
    });
  }

  /**
   * 扫描目录，返回所有 PPTX 文件
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
   * 解析单个幻灯片 XML，提取文本内容
   */
  parseSlideXml(xml, slideNumber) {
    const $ = cheerio.load(xml, { xmlMode: true });
    const texts = [];
    const images = [];
    let title = '';

    // 提取所有文本元素 (a:t)
    $('a\\:t, t').each((_, el) => {
      const text = $(el).text().trim();
      if (text) texts.push(text);
    });

    // 尝试提取标题（通常在标题占位符中）
    // 标题占位符类型 ph type="title" 或 "ctrTitle"
    $('p\\:sp, sp').each((_, sp) => {
      const $sp = $(sp);
      const ph = $sp.find('p\\:nvSpPr\\>p\\:nvPr\\>p\\:ph, nvSpPr nvPr ph');
      const phType = ph.attr('type') || '';
      
      if (phType === 'title' || phType === 'ctrTitle') {
        const titleTexts = [];
        $sp.find('a\\:t, t').each((_, el) => {
          const t = $(el).text().trim();
          if (t) titleTexts.push(t);
        });
        if (titleTexts.length > 0) {
          title = titleTexts.join('');
        }
      }
    });

    // 如果没有找到标题占位符，用第一段文本
    if (!title && texts.length > 0) {
      title = texts[0];
    }

    $('p\\:pic, pic').each((_, picture) => {
      const $picture = $(picture);
      const properties = $picture.find('p\\:cNvPr, cNvPr').first();
      const blip = $picture.find('a\\:blip, blip').first();
      const transform = $picture.find('a\\:xfrm, xfrm').first();
      const offset = transform.find('a\\:off, off').first();
      images.push({
        relationshipId: blip.attr('r:embed') || blip.attr('embed') || '',
        alt: properties.attr('descr') || properties.attr('title') || properties.attr('name') || '',
        x: Number(offset.attr('x') || 0),
        y: Number(offset.attr('y') || 0)
      });
    });

    return {
      number: slideNumber,
      title: title || `幻灯片 ${slideNumber}`,
      texts,
      images,
      notes: ''
    };
  }

  /**
   * 从备注 XML 提取文本
   */
  extractNotesText(xml) {
    const $ = cheerio.load(xml, { xmlMode: true });
    const texts = [];
    
    // 备注中的文本也在 a:t 元素中，但要排除幻灯片编号等占位符
    $('p\\:sp, sp').each((_, sp) => {
      const $sp = $(sp);
      const ph = $sp.find('p\\:nvSpPr\\>p\\:nvPr\\>p\\:ph, nvSpPr nvPr ph');
      const phType = ph.attr('type') || '';
      const phIdx = ph.attr('idx') || '';
      
      // 排除幻灯片编号占位符 (idx=12) 和日期占位符
      if (phIdx === '12' || phType === 'dt' || phType === 'sldNum') return;
      
      $sp.find('a\\:t, t').each((_, el) => {
        const text = $(el).text().trim();
        if (text) texts.push(text);
      });
    });

    return texts.join(' ');
  }

  /**
   * 将幻灯片数据构建为 Markdown
   */
  buildMarkdown(slides, assetsByPart = new Map()) {
    const referencedParts = new Set();
    const parts = slides.map(slide => {
      const lines = [`## ${slide.title}`];
      
      // 正文内容（跳过标题文本）
      const titleIndex = slide.texts.indexOf(slide.title);
      const bodyTexts = slide.texts.filter((_, index) => index !== titleIndex);
      if (bodyTexts.length > 0) {
        lines.push('');
        lines.push(bodyTexts.join('\n'));
      }

      // 备注
      if (slide.notes) {
        lines.push('');
        lines.push('**备注：**');
        lines.push(slide.notes);
      }

      const imageAssets = (slide.images || [])
        .map(image => {
          const sourcePart = slide.relationships?.[image.relationshipId];
          if (sourcePart) referencedParts.add(sourcePart);
          return assetsByPart.get(sourcePart);
        })
        .filter(Boolean);
      imageAssets.push(...Array.from(assetsByPart.values()).filter(asset =>
        asset.assetKind === 'page-render' && asset.renderedPage === slide.number
      ));
      for (const asset of imageAssets) {
        lines.push('');
        lines.push(`![${asset.alt || '原始图片'}](${asset.relativePath})`);
        lines.push('');
        lines.push(`> 图片说明：${asset.caption}`);
      }

      return lines.join('\n');
    });

    const unplacedAssets = Array.from(assetsByPart.values())
      .filter(asset => !referencedParts.has(asset.sourcePart));
    if (unplacedAssets.length > 0) {
      const appendix = ['## 未定位媒体资产'];
      for (const asset of unplacedAssets) {
        appendix.push('', `![${asset.alt || '原始图片'}](${asset.relativePath})`, '', `> 图片说明：${asset.caption}`);
      }
      parts.push(appendix.join('\n'));
    }
    return parts.join('\n\n---\n\n');
  }

  parseRelationships(xml) {
    const $ = cheerio.load(xml, { xmlMode: true });
    const relationships = {};
    $('Relationship').each((_, relationship) => {
      const id = $(relationship).attr('Id');
      const target = $(relationship).attr('Target');
      if (!id || !target || /^https?:/i.test(target)) return;
      relationships[id] = path.posix.normalize(path.posix.join('ppt/slides', target));
    });
    return relationships;
  }

  extractAssets(entries, slides, title) {
    const mediaEntries = new Map(
      entries.filter(entry => /^ppt\/media\//.test(entry.entryName))
        .map(entry => [entry.entryName, entry])
    );
    const references = new Map();

    for (const slide of slides) {
      for (const image of slide.images) {
        const sourcePart = slide.relationships?.[image.relationshipId];
        if (!sourcePart || !mediaEntries.has(sourcePart)) continue;
        const reference = references.get(sourcePart) || { alt: '', placements: [] };
        if (!reference.alt && image.alt) reference.alt = image.alt;
        reference.placements.push({ slide: slide.number, x: image.x, y: image.y });
        references.set(sourcePart, reference);
      }
    }

    return Array.from(mediaEntries.entries()).map(([sourcePart, entry], index) => {
      const reference = references.get(sourcePart) || { alt: '', placements: [] };
      const firstSlide = reference.placements[0]?.slide;
      return buildAsset({
        data: entry.getData(),
        originalName: path.posix.basename(sourcePart),
        index: index + 1,
        alt: reference.alt,
        title,
        location: firstSlide ? `第 ${firstSlide} 张幻灯片` : '媒体资产中',
        sourcePart,
        placements: reference.placements
      });
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

  extractKeywords(title, filePath, slides) {
    const keywords = new Set();
    title.split(/[\s\-_/\\()[\]{}]+/)
      .filter(t => t.length >= 2 && !/^[\d.]+$/.test(t))
      .forEach(t => keywords.add(t));

    const featureMatch = filePath.match(/YDBRD-(\d+)/);
    if (featureMatch) keywords.add(`YDBRD-${featureMatch[1]}`);

    return Array.from(keywords).slice(0, 15);
  }
}

module.exports = { PptxAdapter };
