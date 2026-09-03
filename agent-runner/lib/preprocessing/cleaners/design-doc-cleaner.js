const path = require('path');

/**
 * 设计文档清洗器
 * 
 * 实现 6 条清洗规则，将 Confluence 导出的 Markdown 文件
 * 转化为干净、结构化的文档，便于后续分块和检索。
 * 
 * 清洗规则：
 * 1. 去除 Confluence 元数据（Created by ... on ...）
 * 2. 清理内部链接（conf.yasdb.com / jira.yasdb.com / pingcode.yasdb.com）
 * 3. 保留图片引用并补齐可读 alt
 * 4. 清理锚点链接（[text](#anchor) → text）
 * 5. 统一标题层级（确保有且仅有一个 # 一级标题）
 * 6. 标注文档元信息（添加 YAML 前置元数据）
 */
class DesignDocCleaner {
  /**
   * @param {Object} [config]
   * @param {boolean} [config.removeConfluenceMeta=true]
   * @param {boolean} [config.cleanInternalLinks=true]
   * @param {boolean} [config.handleImageRefs=true]
   * @param {boolean} [config.cleanAnchorLinks=true]
   * @param {boolean} [config.normalizeHeadings=true]
   * @param {boolean} [config.addYamlFront=true]
   * @param {string[]} [config.internalDomains]
   */
  constructor(config = {}) {
    this.config = {
      removeConfluenceMeta: config.removeConfluenceMeta !== false,
      cleanInternalLinks: config.cleanInternalLinks !== false,
      handleImageRefs: config.handleImageRefs !== false,
      cleanAnchorLinks: config.cleanAnchorLinks !== false,
      normalizeHeadings: config.normalizeHeadings !== false,
      addYamlFront: config.addYamlFront !== false,
      internalDomains: config.internalDomains || [
        'conf.yasdb.com',
        'jira.yasdb.com',
        'pingcode.yasdb.com'
      ]
    };
  }

  /**
   * 清洗单个文档
   * 
   * @param {import('../source-adapter').NormalizedDocument} doc - 标准化文档
   * @returns {Object} { content, metadata, changes }
   */
  cleanFile(doc) {
    const changes = [];
    let content = doc.content;
    const originalContent = content;

    // 提取元数据（在删除前先提取）
    const metadata = this.extractMetadata(doc);

    // 规则 1：去除 Confluence 元数据
    if (this.config.removeConfluenceMeta) {
      const before = content;
      content = this.removeConfluenceMeta(content);
      if (content !== before) changes.push('meta_removed');
    }

    // 规则 2：处理图片引用（必须在内部链接清理之前，避免图片 URL 被误清理）
    if (this.config.handleImageRefs) {
      content = this.handleImageRefs(content);
      changes.push('images_handled');
    }

    // 规则 3：清理内部链接
    if (this.config.cleanInternalLinks) {
      content = this.cleanInternalLinks(content);
      changes.push('links_cleaned');
    }

    // 规则 4：清理锚点链接
    if (this.config.cleanAnchorLinks) {
      content = this.cleanAnchorLinks(content);
      changes.push('anchors_cleaned');
    }

    // 规则 5：统一标题层级
    if (this.config.normalizeHeadings) {
      content = this.normalizeHeadings(content);
      changes.push('headings_normalized');
    }

    // 清理多余空行（连续 3 个以上空行合并为 2 个）
    content = content.replace(/\n{3,}/g, '\n\n');

    // 规则 6：添加 YAML 前置元数据
    if (this.config.addYamlFront) {
      const yamlFront = this.generateYamlFront(metadata);
      content = yamlFront + '\n' + content;
      changes.push('yaml_front_added');
    }

    return {
      content,
      metadata,
      changes,
      originalContent,
      doc: doc // 保留原始文档引用
    };
  }

  /**
   * 规则 1：去除 Confluence 元数据
   * 匹配文件开头的 "Created by ... on ..." 行
   */
  removeConfluenceMeta(content) {
    return content.replace(
      /^Created by .+?(?:, last modified on .+?)?\s*\n+/m,
      ''
    );
  }

  /**
   * 规则 2：清理内部链接
   * - [text](https://domain/...) → text
   * - 裸 URL → [内部链接: domain]
   */
  cleanInternalLinks(content) {
    const protectedImages = [];
    let result = content.replace(/!\[[^\]]*\]\([^)]+\)/g, image => {
      const token = `@@PRESERVED_IMAGE_${protectedImages.length}@@`;
      protectedImages.push(image);
      return token;
    });

    for (const domain of this.config.internalDomains) {
      const escapedDomain = domain.replace(/\./g, '\\.');

      // 处理 Markdown 链接 [text](https://domain/...)
      const mdLinkPattern = new RegExp(
        `\\[([^\\]]*)\\]\\(https?://${escapedDomain}[^\\)]*\\)`,
        'g'
      );
      result = result.replace(mdLinkPattern, '$1');

      // 处理裸 URL
      const bareUrlPattern = new RegExp(
        `https?://${escapedDomain}[^\\s\\)]+`,
        'g'
      );
      result = result.replace(bareUrlPattern, `[内部链接: ${domain}]`);
    }

    return result.replace(/@@PRESERVED_IMAGE_(\d+)@@/g, (_, index) => protectedImages[Number(index)]);
  }

  /**
   * 规则 3：处理图片引用
   * - ![alt](url) → [图片: alt]
   * - ![](url) → [图片]
   */
  handleImageRefs(content) {
    return content.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (match, alt, source) => `![${alt.trim() || '原始图片'}](${source})`
    );
  }

  /**
   * 规则 4：清理锚点链接
   * - [text](#anchor) → text
   */
  cleanAnchorLinks(content) {
    return content.replace(/\[([^\]]*)\]\(#[^)]+\)/g, '$1');
  }

  /**
   * 规则 5：统一标题层级
   * 确保每个文件有且仅有一个 # 一级标题
   */
  normalizeHeadings(content) {
    const lines = content.split('\n');
    const headings = lines.filter(l => /^#{1,6}\s/.test(l));

    if (headings.length === 0) return content;

    // 找到最小层级
    const minLevel = Math.min(
      ...headings.map(h => h.match(/^(#+)/)[1].length)
    );

    // 如果最小层级不是 1，整体提升
    if (minLevel > 1) {
      const shift = minLevel - 1;
      return content.replace(/^(#{1,6})\s/gm, (match, hashes) => {
        const newLevel = Math.max(1, hashes.length - shift);
        return '#'.repeat(newLevel) + ' ';
      });
    }

    return content;
  }

  /**
   * 提取文档元信息
   */
  extractMetadata(doc) {
    const metadata = {
      title: doc.title || '',
      version: doc.metadata.version || '',
      docType: doc.metadata.docType || '',
      originalFile: doc.metadata.sourcePath || '',
      author: doc.metadata.author || '',
      createdDate: doc.metadata.createdDate || '',
      featureId: '',
      keywords: doc.metadata.keywords || [],
      hash: doc.hash || doc.metadata.hash || '',
      docId: doc.metadata.docId || '',
      sourceFormat: doc.metadata.sourceFormat || '',
      sourceName: doc.metadata.sourceName || '',
      rawSourceName: doc.metadata.rawSourceName || '',
      assets: doc.metadata.assets || [],
      sourceMetrics: doc.metadata.sourceMetrics || {},
      cleanedAt: new Date().toISOString()
    };

    // 如果 author 为空，尝试从内容中提取
    if (!metadata.author) {
      const authorMatch = doc.content.match(
        /Created by ([^\n]+?)(?:\s+on\s+([\d-]+))?(?:,\s*last\s+modified\s+on\s+(.+?))?\s*$/m
      );
      if (authorMatch) {
        metadata.author = authorMatch[1].trim();
        metadata.createdDate = authorMatch[2] ? authorMatch[2].trim() : (authorMatch[3] ? authorMatch[3].trim() : '');
      }
    }

    // 提取特性编号
    const content = doc.content;
    const filePath = doc.metadata.sourcePath;
    const featureMatch = filePath.match(/YDBRD-(\d+)/) || content.match(/YDBRD-(\d+)/);
    if (featureMatch) {
      metadata.featureId = `YDBRD-${featureMatch[1]}`;
    }

    return metadata;
  }

  /**
   * 规则 6：生成 YAML 前置元数据
   */
  generateYamlFront(metadata) {
    const lines = ['---'];

    const fields = [
      ['title', metadata.title],
      ['version', metadata.version],
      ['doc_type', metadata.docType],
      ['original_file', metadata.originalFile],
      ['author', metadata.author],
      ['created_date', metadata.createdDate],
      ['feature_id', metadata.featureId],
      ['cleaned_at', metadata.cleanedAt]
    ];

    for (const [key, value] of fields) {
      if (value) {
        // 如果值包含特殊字符，用引号包裹
        const needsQuote = /[:#\[\]{}&*!|>'"%@`]/.test(value) || value.includes('\n');
        const formattedValue = needsQuote ? `"${value.replace(/"/g, '\\"')}"` : value;
        lines.push(`${key}: ${formattedValue}`);
      }
    }

    // 关键词数组
    if (metadata.keywords && metadata.keywords.length > 0) {
      lines.push('keywords:');
      for (const kw of metadata.keywords) {
        lines.push(`  - "${kw}"`);
      }
    }

    lines.push('---');
    return lines.join('\n');
  }
}

module.exports = { DesignDocCleaner };
