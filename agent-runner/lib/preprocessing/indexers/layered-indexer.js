const fs = require('fs').promises;
const path = require('path');
const { buildDocumentId } = require('../document-identity');

/**
 * 分层索引构建器
 * 
 * 构建三层索引结构：
 * - L1 全局索引：轻量记录（~50 tokens/条），一次性加载到内存
 * - L2 文档摘要：每篇 ~300 tokens，按需加载
 * - L3 chunk 索引：每个文档的 chunk 清单，按需加载
 * 
 * 支持增量更新：只更新变更文件的索引条目。
 */
class LayeredIndexer {
  /**
   * @param {Object} [config]
   * @param {number} [config.maxKeywords=15]
   * @param {number} [config.summaryMaxLength=300]
   * @param {boolean} [config.useLlmForSummary=true]
   * @param {string} [config.llmModel='qwen-plus']
   * @param {boolean} [config.ruleBasedSummaryFirst=true]
   * @param {number} [config.ruleBasedMinLength=100]
   */
  constructor(config = {}) {
    this.config = {
      maxKeywords: config.maxKeywords || 15,
      summaryMaxLength: config.summaryMaxLength || 300,
      useLlmForSummary: config.useLlmForSummary !== false,
      llmModel: config.llmModel || 'qwen-plus',
      ruleBasedSummaryFirst: config.ruleBasedSummaryFirst !== false,
      ruleBasedMinLength: config.ruleBasedMinLength || 100
    };
  }

  /**
   * 构建索引
   * 
   * @param {Array} data - 清洗后文档或分块数据
   * @param {Object} config - Pipeline 配置
   * @param {import('../pipeline').DeltaResult} delta - 增量变更集
   * @returns {Promise<Object>} 索引构建结果
   */
  async build(data, config, delta) {
    const outputDir = config.output?.baseDir || '';
    const indexDir = path.join(outputDir, 'index');
    if (delta?.full) {
      await fs.rm(indexDir, { recursive: true, force: true });
      await fs.rm(path.join(outputDir, 'chunks'), { recursive: true, force: true });
    }
    await fs.mkdir(indexDir, { recursive: true });

    // 加载现有 L1 索引（如果存在）
    let l1Index = await this.loadL1Index(indexDir);

    // 处理每个文档
    const entries = [];
    const summaries = [];
    const chunkIndexes = [];

    for (const item of data) {
      // 判断是分块结果还是清洗文档
      if (item.chunkId) {
        // 分块结果 — 按文档聚合
        const docId = this.extractDocId(item);
        let docEntry = entries.find(e => e.id === docId);
        if (!docEntry) {
          docEntry = this.buildL1Entry(item, data);
          entries.push(docEntry);
        }
        docEntry.chunk_count = (docEntry.chunk_count || 0) + 1;
        chunkIndexes.push(item);
      } else if (item.content || item.doc) {
        // 清洗文档
        const doc = item.doc || item;
        const entry = this.buildL1EntryFromDoc(doc);
        entries.push(entry);

        // 生成摘要
        const summary = await this.generateSummary(doc, entry);
        summaries.push(summary);
      }
    }

    // 合并到 L1 索引（增量更新）
    for (const entry of entries) {
      const existingIndex = l1Index.entries.findIndex(e => e.id === entry.id);
      if (existingIndex >= 0) {
        l1Index.entries[existingIndex] = entry;
      } else {
        l1Index.entries.push(entry);
      }
    }

    // 删除已删除文件的索引条目
    if (delta && delta.deleted) {
      for (const deleted of delta.deleted) {
        l1Index.entries = l1Index.entries.filter(e =>
          e.content_path !== deleted.filePath &&
          !e.original_file?.includes(path.basename(deleted.filePath))
        );
      }
    }

    // 写入 L1 索引
    l1Index.generated_at = new Date().toISOString();
    l1Index.total_entries = l1Index.entries.length;
    await fs.writeFile(
      path.join(indexDir, 'l1-global-index.json'),
      JSON.stringify(l1Index, null, 2),
      'utf-8'
    );

    // 写入 L2 摘要
    const l2Dir = path.join(indexDir, 'l2-summaries');
    await fs.mkdir(l2Dir, { recursive: true });
    for (const summary of summaries) {
      const versionDir = path.join(l2Dir, summary.version || 'unknown');
      await fs.mkdir(versionDir, { recursive: true });
      await fs.writeFile(
        path.join(versionDir, `${summary.id}.json`),
        JSON.stringify(summary, null, 2),
        'utf-8'
      );
    }

    // 写入 chunk 索引（如果有分块）
    if (chunkIndexes.length > 0) {
      await this.writeChunkIndexes(chunkIndexes, config);
    }

    // 写入统计信息
    const stats = {
      generated_at: l1Index.generated_at,
      l1_entries: l1Index.entries.length,
      l2_summaries: summaries.length,
      total_chunks: chunkIndexes.length
    };
    await fs.writeFile(
      path.join(indexDir, '_stats.json'),
      JSON.stringify(stats, null, 2),
      'utf-8'
    );

    return {
      l1Entries: l1Index.entries.length,
      l2Summaries: summaries.length,
      totalChunks: chunkIndexes.length,
      stats
    };
  }

  /**
   * 加载现有 L1 索引
   */
  async loadL1Index(indexDir) {
    try {
      const content = await fs.readFile(path.join(indexDir, 'l1-global-index.json'), 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return {
          version: '1.0',
          generated_at: null,
          total_entries: 0,
          entries: []
        };
      }
      throw err;
    }
  }

  /**
   * 从清洗文档构建 L1 条目
   */
  buildL1EntryFromDoc(doc) {
    const metadata = doc.metadata || doc;
    const content = doc.content || '';
    const id = this.buildEntryId(metadata);

    return {
      id,
      legacy_id: this.buildLegacyEntryId(metadata),
      title: metadata.title || '',
      version: metadata.version || '',
      doc_type: metadata.docType || '',
      feature_id: metadata.featureId || '',
      keywords: metadata.keywords || [],
      summary_path: `index/l2-summaries/${metadata.version || 'unknown'}/${id}.json`,
      content_path: metadata.originalFile || metadata.sourcePath || '',
      chunk_count: 0,
      chunks_index: '',
      line_count: content.split('\n').length,
      has_code: /```/.test(content),
      has_table: /\|/.test(content) && /---/.test(content)
    };
  }

  /**
   * 从分块结果构建 L1 条目
   */
  buildL1Entry(chunk, allChunks) {
    const docId = this.extractDocId(chunk);
    const metadata = chunk.metadata || {};

    return {
      id: docId,
      legacy_id: String(metadata.legacyChunkId || '').replace(/-chunk-\d+$/, ''),
      title: metadata.title || '',
      version: metadata.version || '',
      doc_type: metadata.docType || '',
      feature_id: '',
      keywords: [],
      summary_path: `index/l2-summaries/${metadata.version || 'unknown'}/${docId}.json`,
      content_path: metadata.originalFile || '',
      chunk_count: 0,
      chunks_index: `chunks/${metadata.version || 'unknown'}/${docId}/_chunks.json`,
      line_count: 0,
      has_code: false,
      has_table: false
    };
  }

  /**
   * 构建条目 ID
   */
  buildEntryId(metadata) {
    return metadata.docId || buildDocumentId(metadata);
  }

  buildLegacyEntryId(metadata) {
    const parts = [
      metadata.version || 'unknown',
      metadata.docType || 'other',
      (metadata.title || 'untitled').replace(/[\s/\\]+/g, '-').slice(0, 50)
    ];
    return parts.join('-');
  }

  /**
   * 从 chunk 提取文档 ID
   */
  extractDocId(chunk) {
    const chunkId = chunk.chunkId || '';
    const match = chunkId.match(/^(.+)-chunk-\d+$/);
    return match ? match[1] : chunkId;
  }

  /**
   * 生成文档摘要
   * 优先使用规则提取，不足时 LLM 兜底
   */
  async generateSummary(doc, entry) {
    const content = doc.content || '';
    const metadata = doc.metadata || doc;

    // 规则提取
    let summary = this.ruleBasedSummary(content, metadata);

    // 如果规则提取不足且启用 LLM，则 LLM 兜底
    if (summary.length < this.config.ruleBasedMinLength && this.config.useLlmForSummary) {
      summary = await this.llmSummary(content, metadata);
    }

    // 提取关键要点
    const keyPoints = this.extractKeyPoints(content);

    return {
      id: entry.id,
      title: entry.title,
      version: entry.version,
      doc_type: entry.doc_type,
      feature_id: entry.feature_id,
      author: metadata.author || '',
      created_date: metadata.createdDate || '',
      summary: summary.slice(0, this.config.summaryMaxLength),
      key_points: keyPoints,
      related_features: [],
      applicable_kp_types: [],
      content_stats: {
        line_count: entry.line_count,
        section_count: (content.match(/^#{1,6}\s/gm) || []).length,
        has_code: entry.has_code,
        has_table: entry.has_table,
        table_count: (content.match(/^\s*\|[-:]+\|/gm) || []).length,
        code_block_count: (content.match(/```/g) || []).length / 2
      }
    };
  }

  /**
   * 规则提取摘要
   */
  ruleBasedSummary(content, metadata) {
    const parts = [];

    // 1. 提取概述/总述章节
    const overviewMatch = content.match(
      /(?:^|\n)#{1,3}\s*(?:概述|总述|Overview|简介|Introduction)\s*\n([\s\S]*?)(?=\n#{1,3}\s|$)/i
    );
    if (overviewMatch) {
      parts.push(overviewMatch[1].trim().slice(0, 200));
    }

    // 2. 提取第一个非标题段落
    if (parts.length === 0) {
      const firstParagraph = content
        .split('\n')
        .filter(l => l.trim() && !/^#{1,6}\s/.test(l) && !/^---$/.test(l) && !/^>/.test(l))
        .slice(0, 3)
        .join(' ');
      if (firstParagraph) {
        parts.push(firstParagraph.slice(0, 200));
      }
    }

    // 3. 提取表格中的关键行
    const tableRows = content.match(/^\s*\|[^-].*\|$/gm);
    if (tableRows && tableRows.length > 0) {
      const keyRows = tableRows.slice(0, 3).map(r => r.trim()).join(' ');
      parts.push(keyRows.slice(0, 100));
    }

    return parts.join(' ').slice(0, this.config.summaryMaxLength);
  }

  /**
   * LLM 摘要生成（占位，需要 LLM client）
   */
  async llmSummary(content, metadata) {
    // TODO: 集成 LLM client
    // 当前返回规则提取的结果
    return this.ruleBasedSummary(content, metadata);
  }

  /**
   * 提取关键要点
   */
  extractKeyPoints(content) {
    const points = [];

    // 从列表中提取
    const listItems = content.match(/^[\s]*[-*]\s+(.+)$/gm);
    if (listItems) {
      for (const item of listItems.slice(0, 8)) {
        const text = item.replace(/^[\s]*[-*]\s+/, '').trim();
        if (text.length > 10 && text.length < 200) {
          points.push(text);
        }
      }
    }

    return points.slice(0, 8);
  }

  /**
   * 写入 chunk 索引
   */
  async writeChunkIndexes(chunks, config) {
    const outputDir = config.output?.baseDir || '';
    const chunksDir = path.join(outputDir, 'chunks');

    // 按文档分组
    const docGroups = new Map();
    for (const chunk of chunks) {
      const docId = this.extractDocId(chunk);
      if (!docGroups.has(docId)) {
        docGroups.set(docId, []);
      }
      docGroups.get(docId).push(chunk);
    }

    // 为每个文档写入 chunk 索引
    for (const [docId, docChunks] of docGroups) {
      const version = docChunks[0]?.metadata?.version || 'unknown';
      const docDir = path.join(chunksDir, version, docId);
      await fs.mkdir(docDir, { recursive: true });

      // 写入单个 chunk 文件
      for (const chunk of docChunks) {
        await fs.writeFile(
          path.join(docDir, `chunk_${String(chunk.chunkIndex).padStart(3, '0')}.md`),
          chunk.content,
          'utf-8'
        );
      }

      // 写入 chunk 索引
      const chunkIndex = {
        doc_id: docId,
        chunks: docChunks.map(c => ({
          chunk_id: `chunk-${String(c.chunkIndex).padStart(3, '0')}`,
          section_path: c.sectionPath,
          tokens: c.tokens,
          keywords: [] // 后续可填充
        }))
      };
      await fs.writeFile(
        path.join(docDir, '_chunks.json'),
        JSON.stringify(chunkIndex, null, 2),
        'utf-8'
      );
    }
  }
}

module.exports = { LayeredIndexer };
