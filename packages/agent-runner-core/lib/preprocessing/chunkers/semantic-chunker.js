const { buildDocumentId } = require('../document-identity');

/**
 * 语义分块器
 * 
 * 按语义边界切分文档，每个 chunk 保持完整语义单元。
 * 
 * 核心特性：
 * - 规则驱动的语义边界检测（不依赖 embedding 模型）
 * - 表格和代码块原子性保护（绝不在内部切分）
 * - 上下文前缀（文档标题、版本、类型、章节路径）
 * - 相邻 chunk 重叠（overlap），避免上下文丢失
 * - Token 估算（中文按字符，英文按单词）
 */
class SemanticChunker {
  /**
   * @param {Object} [config]
   * @param {number} [config.minTokens=500] - chunk 最小 token 数
   * @param {number} [config.maxTokens=1500] - chunk 最大 token 数
   * @param {number} [config.overlapSentences=2] - 重叠句子数
   * @param {boolean} [config.protectTables=true] - 保护表格不被切分
   * @param {boolean} [config.protectCodeBlocks=true] - 保护代码块不被切分
   */
  constructor(config = {}) {
    this.config = {
      minTokens: config.minTokens || 500,
      maxTokens: config.maxTokens || 1500,
      overlapSentences: config.overlapSentences ?? 2,
      protectTables: config.protectTables !== false,
      protectCodeBlocks: config.protectCodeBlocks !== false
    };
  }

  /**
   * 对单个清洗后文档进行语义分块
   * 
   * @param {string} content - 清洗后的文档内容（含 YAML 前置）
   * @param {Object} metadata - 文档元数据
   * @returns {Array<Object>} chunk 数组
   */
  chunkFile(content, metadata) {
    // 剥离 YAML 前置（分块后每个 chunk 自带前缀）
    const { body, yamlFront } = this.stripYamlFront(content);

    // 解析文档结构：识别保护块和语义边界
    const blocks = this.parseBlocks(body);

    // 按语义边界分块
    const rawChunks = this.splitIntoChunks(blocks, metadata);

    // 为每个 chunk 添加上下文前缀
    const chunks = rawChunks.map((chunk, index) => {
      return this.finalizeChunk(chunk, index, rawChunks.length, metadata);
    });

    // 应用 overlap
    if (this.config.overlapSentences > 0 && chunks.length > 1) {
      this.applyOverlap(chunks);
    }

    return chunks;
  }

  /**
   * 剥离 YAML 前置元数据
   */
  stripYamlFront(content) {
    const match = content.match(/^---\n[\s\S]*?\n---\n?/);
    if (match) {
      return {
        yamlFront: match[0],
        body: content.slice(match[0].length)
      };
    }
    return { yamlFront: '', body: content };
  }

  /**
   * 解析文档为结构化块
   * 
   * 每个块有类型：heading / table / code / paragraph
   * 保护块（table/code）标记为不可切分。
   */
  parseBlocks(content) {
    const lines = content.split('\n');
    const blocks = [];
    let currentBlock = null;
    let inCodeBlock = false;
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 代码块检测
      if (line.trimStart().startsWith('```')) {
        if (inCodeBlock) {
          // 代码块结束
          currentBlock.content += line + '\n';
          currentBlock.endLine = i;
          blocks.push(currentBlock);
          currentBlock = null;
          inCodeBlock = false;
        } else {
          // 保存之前的块
          if (currentBlock) {
            currentBlock.endLine = i - 1;
            blocks.push(currentBlock);
            currentBlock = null;
          }
          // 开始代码块
          inCodeBlock = true;
          currentBlock = {
            type: 'code',
            content: line + '\n',
            startLine: i,
            endLine: i,
            protected: this.config.protectCodeBlocks
          };
        }
        continue;
      }

      if (inCodeBlock) {
        currentBlock.content += line + '\n';
        continue;
      }

      // 表格检测（含 | 的行）
      const isTableRow = /^\s*\|/.test(line) && line.includes('|');

      if (isTableRow) {
        if (!inTable) {
          // 保存之前的块
          if (currentBlock) {
            currentBlock.endLine = i - 1;
            blocks.push(currentBlock);
            currentBlock = null;
          }
          inTable = true;
          currentBlock = {
            type: 'table',
            content: line + '\n',
            startLine: i,
            endLine: i,
            protected: this.config.protectTables
          };
        } else {
          currentBlock.content += line + '\n';
          currentBlock.endLine = i;
        }
        continue;
      } else if (inTable) {
        // 表格结束
        blocks.push(currentBlock);
        currentBlock = null;
        inTable = false;
      }

      // 标题检测
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        // 保存之前的块
        if (currentBlock) {
          currentBlock.endLine = i - 1;
          blocks.push(currentBlock);
          currentBlock = null;
        }
        blocks.push({
          type: 'heading',
          level: headingMatch[1].length,
          text: headingMatch[2].trim(),
          content: line + '\n',
          startLine: i,
          endLine: i,
          protected: false
        });
        continue;
      }

      // 普通段落行
      if (!currentBlock) {
        currentBlock = {
          type: 'paragraph',
          content: line + '\n',
          startLine: i,
          endLine: i,
          protected: false
        };
      } else {
        currentBlock.content += line + '\n';
        currentBlock.endLine = i;
      }
    }

    // 处理最后一个块
    if (currentBlock) {
      blocks.push(currentBlock);
    }

    return blocks;
  }

  /**
   * 按语义边界将块切分为 chunks
   */
  splitIntoChunks(blocks, metadata) {
    const chunks = [];
    let currentChunk = { blocks: [], tokens: 0, sectionPath: [] };

    for (const block of blocks) {
      const blockTokens = this.estimateTokens(block.content);

      // 判断是否是强边界（一级/二级标题）
      const isStrongBoundary = block.type === 'heading' && block.level <= 2;
      // 判断是否是中边界（三级标题）
      const isMediumBoundary = block.type === 'heading' && block.level === 3;

      // 更新章节路径
      if (block.type === 'heading') {
        this.updateSectionPath(currentChunk.sectionPath, block.level, block.text);
      }

      // 保护块（表格/代码）直接加入当前 chunk
      if (block.protected) {
        currentChunk.blocks.push(block);
        currentChunk.tokens += blockTokens;
        continue;
      }

      // 强边界 + 当前 chunk 已有内容 → 切分
      if (isStrongBoundary && currentChunk.tokens >= this.config.minTokens) {
        chunks.push({ ...currentChunk });
        currentChunk = { blocks: [block], tokens: blockTokens, sectionPath: [...currentChunk.sectionPath] };
        continue;
      }

      // 中边界 + token 超限 → 切分
      if (isMediumBoundary && currentChunk.tokens >= this.config.maxTokens * 0.7) {
        chunks.push({ ...currentChunk });
        currentChunk = { blocks: [block], tokens: blockTokens, sectionPath: [...currentChunk.sectionPath] };
        continue;
      }

      // 加入当前 chunk
      currentChunk.blocks.push(block);
      currentChunk.tokens += blockTokens;

      // 超过 maxTokens 且不在保护块中 → 强制切分
      if (currentChunk.tokens >= this.config.maxTokens) {
        // 尝试在最近的弱边界切分
        const splitIndex = this.findLastWeakBoundary(currentChunk.blocks);
        if (splitIndex > 0) {
          const before = currentChunk.blocks.slice(0, splitIndex);
          const after = currentChunk.blocks.slice(splitIndex);

          chunks.push({
            blocks: before,
            tokens: before.reduce((sum, b) => sum + this.estimateTokens(b.content), 0),
            sectionPath: [...currentChunk.sectionPath]
          });

          currentChunk = {
            blocks: after,
            tokens: after.reduce((sum, b) => sum + this.estimateTokens(b.content), 0),
            sectionPath: [...currentChunk.sectionPath]
          };
        } else {
          // 找不到弱边界，直接切分
          chunks.push({ ...currentChunk });
          currentChunk = { blocks: [], tokens: 0, sectionPath: [...currentChunk.sectionPath] };
        }
      }
    }

    // 处理最后一个 chunk
    if (currentChunk.blocks.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * 更新章节路径栈
   */
  updateSectionPath(sectionPath, level, text) {
    // 截断到当前层级
    while (sectionPath.length >= level) {
      sectionPath.pop();
    }
    sectionPath.push(text);
  }

  /**
   * 查找最后一个弱边界（段落间空行）
   */
  findLastWeakBoundary(blocks) {
    for (let i = blocks.length - 1; i >= 1; i--) {
      if (blocks[i].type === 'paragraph' && blocks[i - 1].type === 'paragraph') {
        return i;
      }
    }
    return -1;
  }

  /**
   * 为 chunk 生成上下文前缀
   */
  generateContextPrefix(metadata, sectionPath, chunkIndex, totalChunks) {
    const sectionPathStr = sectionPath.length > 0
      ? sectionPath.join(' > ')
      : metadata.title || '未知章节';

    const lines = [
      '<!--',
      `chunk_id: "${this.buildChunkId(metadata, chunkIndex)}"`,
      `legacy_chunk_id: "${this.buildLegacyChunkId(metadata, chunkIndex)}"`,
      `doc_id: "${this.documentId(metadata)}"`,
      `source_doc: "${metadata.title || ''}"`,
      `version: "${metadata.version || ''}"`,
      `doc_type: "${metadata.docType || ''}"`,
      `section_path: "${sectionPathStr}"`,
      `chunk_index: ${chunkIndex}`,
      `total_chunks: ${totalChunks}`,
      `tokens: ${0}`, // 占位，实际值在 finalize 时填入
      '-->',
      '',
      `> 📄 ${metadata.title || ''} | ${metadata.version || ''} | ${metadata.docType || ''}`,
      `> 📑 ${sectionPathStr}`,
      '',
      '---',
      ''
    ];

    return lines.join('\n');
  }

  /**
   * 构建 chunk ID
   */
  buildChunkId(metadata, index) {
    return `${this.documentId(metadata)}-chunk-${String(index).padStart(3, '0')}`;
  }

  documentId(metadata) {
    return metadata.docId || buildDocumentId(metadata);
  }

  buildLegacyChunkId(metadata, index) {
    const parts = [
      metadata.version || 'unknown',
      metadata.docType || 'other',
      (metadata.title || 'untitled').replace(/\s+/g, '-'),
      this.sourceIdentity(metadata)
    ];
    return `${parts.join('-')}-chunk-${String(index).padStart(3, '0')}`;
  }

  sourceIdentity(metadata) {
    const source = metadata.originalFile || metadata.sourcePath || '';
    if (!source) return 'source-unknown';
    let hash = 0;
    for (let index = 0; index < source.length; index++) {
      hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
    }
    return `source-${Math.abs(hash).toString(36)}`;
  }

  /**
   * 完成 chunk：拼接前缀 + 内容，计算 token 数
   */
  finalizeChunk(rawChunk, index, totalChunks, metadata) {
    const content = rawChunk.blocks.map(b => b.content).join('');
    const sectionPathStr = rawChunk.sectionPath.join(' > ') || metadata.title || '';

    const prefix = this.generateContextPrefix(metadata, rawChunk.sectionPath, index, totalChunks);
    const fullContent = prefix + content;
    const tokens = this.estimateTokens(fullContent);

    return {
      chunkId: this.buildChunkId(metadata, index),
      content: fullContent,
      bodyContent: content,
      sectionPath: sectionPathStr,
      chunkIndex: index,
      totalChunks,
      tokens,
      metadata: {
        docId: this.documentId(metadata),
        legacyChunkId: this.buildLegacyChunkId(metadata, index),
        title: metadata.title,
        version: metadata.version,
        docType: metadata.docType,
        originalFile: metadata.originalFile,
        sourcePath: metadata.sourcePath || metadata.originalFile,
        keywords: metadata.keywords || [],
        feature: metadata.feature || '',
        subFeature: metadata.subFeature || '',
        featureConfidence: metadata.featureConfidence || 0,
        featureSource: metadata.featureSource || '',
        featureReason: metadata.featureReason || ''
      }
    };
  }

  /**
   * 应用 overlap：相邻 chunk 之间共享句子
   */
  applyOverlap(chunks) {
    for (let i = 1; i < chunks.length; i++) {
      const prevBody = chunks[i - 1].bodyContent;
      const sentences = this.extractSentences(prevBody);
      const overlapSentences = sentences.slice(-this.config.overlapSentences);

      if (overlapSentences.length > 0) {
        const overlapText = overlapSentences.join('\n');
        // 在 chunk 正文前插入 overlap（前缀之后）
        const prefixEnd = chunks[i].content.indexOf('---\n') + 4;
        if (prefixEnd > 3) {
          chunks[i].content =
            chunks[i].content.slice(0, prefixEnd) +
            '\n> **（接上文）**\n' + overlapText + '\n\n---\n\n' +
            chunks[i].content.slice(prefixEnd);
          chunks[i].tokens = this.estimateTokens(chunks[i].content);
        }
      }
    }
  }

  /**
   * 从文本中提取句子（按换行和句号分割）
   */
  extractSentences(text) {
    return text
      .split(/(?<=[。！？.!?\n])\s*/)
      .map(s => s.trim())
      .filter(s => s.length > 5);
  }

  /**
   * 估算 token 数
   * 中文按字符（约 1.5 token/字），英文按单词（约 1.3 token/词）
   */
  estimateTokens(text) {
    if (!text) return 0;

    // 中文字符数
    const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    // 英文单词数
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    // 数字和符号
    const otherChars = text.length - chineseChars - englishWords;

    // 粗略估算：中文 1.5 token/字，英文 1.3 token/词
    return Math.ceil(chineseChars * 1.5 + englishWords * 1.3 + otherChars * 0.3);
  }
}

module.exports = { SemanticChunker };
