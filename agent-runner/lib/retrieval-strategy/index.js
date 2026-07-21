const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');

/**
 * 资料引用策略执行器
 * 
 * 严格按照提示词中的资料引用策略优先级执行检索：
 * 1. YashanDB 知识库 MCP（实时查询）        ← 最高优先级
 * 2. 特性设计文档（references/design-docs/）
 * 3. Oracle 知识库（references/oracle-kb/）
 *    - 先阅读 references/oracle-kb/README.md 获取完整文档索引
 *    - 根据索引找到与当前知识点相关的 Oracle 文档进行引用
 * 4. 测试用例（references/test-cases/）
 * 5. 源码（references/source/）              ← 最低优先级
 * 
 * 每个优先级都要尝试检索，不因上一级失败而跳过。
 * 检索结果按优先级顺序整合到参考资料中。
 */
class RetrievalStrategy {
  constructor(basePath, toolManager = null) {
    this.basePath = basePath;
    this.toolManager = toolManager;
    this.references = {
      designDocs: path.join(basePath, 'references', 'design-docs'),
      oracleKb: path.join(basePath, 'references', 'oracle-kb'),
      testCases: path.join(basePath, 'references', 'test-cases'),
      sourceCode: path.join(basePath, 'references', 'source')
    };
  }

  /**
   * 执行全部优先级的检索
   * @param {Object} context - 检索上下文
   * @param {string[]} context.mcpQueries - MCP 查询词列表
   * @param {Object} context.knowledgePoint - 知识点信息
   * @param {string[]} context.keywords - 关键词列表
   * @returns {Promise<Object>} 各优先级的检索结果
   */
  async executeAll(context) {
    const results = {
      mcp: null,
      designDocs: null,
      oracleKb: null,
      testCases: null,
      sourceCode: null
    };

    // 优先级 1：MCP 查询
    results.mcp = await this.executeMcpQueries(context.mcpQueries || []);

    // 优先级 2：特性设计文档
    results.designDocs = await this.executeDesignDocsRetrieval(context);

    // 优先级 3：Oracle 知识库
    results.oracleKb = await this.executeOracleKbRetrieval(context);

    // 优先级 4：测试用例
    results.testCases = await this.executeTestCasesRetrieval(context);

    // 优先级 5：源码
    results.sourceCode = await this.executeSourceCodeRetrieval(context);

    return results;
  }

  /**
   * 优先级 1：MCP 查询执行
   */
  async executeMcpQueries(queries) {
    if (!queries || queries.length === 0) {
      return { queries: [], results: [], success: 0, failed: 0 };
    }

    if (!this.toolManager) {
      logger.warn('[retrieval-strategy] No tool manager, skipping MCP queries');
      return { queries, results: [], success: 0, failed: queries.length };
    }

    try {
      const mcpClient = this.toolManager.getTool('mcp');
      const results = await mcpClient.batchQuery(queries);
      
      const success = results.filter(r => r.success).length;
      const failed = results.length - success;

      logger.info('[retrieval-strategy] MCP queries completed', {
        total: queries.length,
        success,
        failed
      });

      return { queries, results, success, failed };
    } catch (err) {
      logger.error(`[retrieval-strategy] MCP queries failed: ${err.message}`);
      return { queries, results: [], success: 0, failed: queries.length, error: err.message };
    }
  }

  /**
   * 优先级 2：特性设计文档检索
   */
  async executeDesignDocsRetrieval(context) {
    const dir = this.references.designDocs;
    const matchedFiles = await this._scanDirectory(dir, context.keywords || []);
    const results = [];

    for (const file of matchedFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        results.push({
          source: path.relative(this.basePath, file),
          content,
          matchedKeywords: this._findMatchingKeywords(content, context.keywords || [])
        });
      } catch (err) {
        logger.warn(`[retrieval-strategy] Failed to read design doc: ${file}`);
      }
    }

    logger.info('[retrieval-strategy] Design docs retrieval', { matched: results.length });
    return { files: matchedFiles, results };
  }

  /**
   * 优先级 3：Oracle 知识库检索
   * 
   * 先阅读 references/oracle-kb/README.md 获取完整文档索引，
   * 再根据索引找到与当前知识点相关的 Oracle 文档。
   */
  async executeOracleKbRetrieval(context) {
    const dir = this.references.oracleKb;
    const indexFile = path.join(dir, 'README.md');
    let indexContent = '';
    let indexEntries = [];

    // 读取索引文件
    try {
      indexContent = await fs.readFile(indexFile, 'utf-8');
      indexEntries = this._parseOracleIndex(indexContent);
    } catch (err) {
      logger.warn(`[retrieval-strategy] Oracle KB index not found: ${indexFile}`);
    }

    // 第一步：根据标题和 ID 匹配
    let matchedEntries = indexEntries.filter(entry =>
      context.keywords.some(kw => 
        entry.title.toLowerCase().includes(kw.toLowerCase()) ||
        entry.id.toLowerCase().includes(kw.toLowerCase())
      )
    );

    // 第二步：如果标题匹配结果太少，扫描文档内容
    if (matchedEntries.length < 3) {
      logger.info('[retrieval-strategy] Title match insufficient, scanning document content');
      const contentMatched = [];
      for (const entry of indexEntries) {
        if (matchedEntries.some(m => m.id === entry.id)) continue; // 已匹配
        const filePath = path.join(dir, entry.file || `${entry.id}.md`);
        try {
          const docContent = await fs.readFile(filePath, 'utf-8');
          const hasKeyword = context.keywords.some(kw => 
            docContent.toLowerCase().includes(kw.toLowerCase())
          );
          if (hasKeyword) {
            contentMatched.push({
              id: entry.id,
              title: entry.title,
              source: path.relative(this.basePath, filePath),
              content: docContent,
              matchType: 'content'
            });
          }
        } catch (err) {
          // 忽略读取失败
        }
      }
      matchedEntries = [...matchedEntries, ...contentMatched];
    }

    // 读取匹配的文档内容（标题匹配的）
    const results = [];
    for (const entry of matchedEntries) {
      if (entry.content) {
        // 内容匹配的直接使用
        results.push(entry);
      } else {
        const filePath = path.join(dir, entry.file || `${entry.id}.md`);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          results.push({
            id: entry.id,
            title: entry.title,
            source: path.relative(this.basePath, filePath),
            content,
            matchType: 'title'
          });
        } catch (err) {
          logger.warn(`[retrieval-strategy] Failed to read Oracle KB doc: ${filePath}`);
        }
      }
    }

    logger.info('[retrieval-strategy] Oracle KB retrieval', {
      totalEntries: indexEntries.length,
      matched: results.length,
      titleMatched: results.filter(r => r.matchType === 'title').length,
      contentMatched: results.filter(r => r.matchType === 'content').length
    });

    return { indexFile, indexEntries, matchedEntries: results };
  }

  /**
   * 优先级 4：测试用例检索
   */
  async executeTestCasesRetrieval(context) {
    const dir = this.references.testCases;
    const matchedFiles = await this._scanDirectory(dir, context.keywords || []);
    const results = [];

    for (const file of matchedFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        results.push({
          source: path.relative(this.basePath, file),
          content,
          matchedKeywords: this._findMatchingKeywords(content, context.keywords || [])
        });
      } catch (err) {
        logger.warn(`[retrieval-strategy] Failed to read test case: ${file}`);
      }
    }

    logger.info('[retrieval-strategy] Test cases retrieval', { matched: results.length });
    return { files: matchedFiles, results };
  }

  /**
   * 优先级 5：源码检索
   */
  async executeSourceCodeRetrieval(context) {
    const dir = this.references.sourceCode;
    const matchedFiles = await this._scanDirectory(dir, context.keywords || []);
    const results = [];

    for (const file of matchedFiles.slice(0, 5)) { // 限制最多 5 个文件，避免上下文溢出
      try {
        let content = await fs.readFile(file, 'utf-8');
        // 限制每个文件最多 2000 字符
        if (content.length > 2000) {
          content = content.slice(0, 2000) + '\n... (truncated)';
        }
        results.push({
          source: path.relative(this.basePath, file),
          content,
          matchedKeywords: this._findMatchingKeywords(content, context.keywords || [])
        });
      } catch (err) {
        logger.warn(`[retrieval-strategy] Failed to read source file: ${file}`);
      }
    }

    logger.info('[retrieval-strategy] Source code retrieval', { matched: results.length });
    return { files: matchedFiles, results };
  }

  /**
   * 整合所有检索结果为上下文提示词
   * 严格按照优先级顺序组织
   */
  integrateResults(results) {
    const parts = [];

    // 优先级 1：MCP
    if (results.mcp && results.mcp.results.length > 0) {
      parts.push('## 优先级 1：YashanDB 知识库 MCP\n');
      results.mcp.results.forEach((result, index) => {
        const query = results.mcp.queries[index];
        if (result.success && result.data) {
          const content = this._formatMcpResult(result.data);
          parts.push(`### MCP 查询：${query}\n${content}\n`);
        } else {
          parts.push(`### MCP 查询：${query}\n查询失败：${result.error || '未知错误'}\n`);
        }
      });
    }

    // 优先级 2：设计文档
    if (results.designDocs && results.designDocs.results.length > 0) {
      parts.push('## 优先级 2：特性设计文档\n');
      results.designDocs.results.forEach(doc => {
        parts.push(`### ${path.basename(doc.source)}\n${this._truncateContent(doc.content)}\n`);
      });
    }

    // 优先级 3：Oracle 知识库
    if (results.oracleKb && results.oracleKb.matchedEntries.length > 0) {
      parts.push('## 优先级 3：Oracle 知识库\n');
      results.oracleKb.matchedEntries.forEach(doc => {
        parts.push(`### ${doc.id} - ${doc.title}\n${this._truncateContent(doc.content)}\n`);
      });
    }

    // 优先级 4：测试用例
    if (results.testCases && results.testCases.results.length > 0) {
      parts.push('## 优先级 4：测试用例\n');
      results.testCases.results.forEach(doc => {
        parts.push(`### ${path.basename(doc.source)}\n${doc.content}\n`);
      });
    }

    // 优先级 5：源码
    if (results.sourceCode && results.sourceCode.results.length > 0) {
      parts.push('## 优先级 5：源码\n');
      results.sourceCode.results.forEach(doc => {
        parts.push(`### ${path.basename(doc.source)}\n${doc.content}\n`);
      });
    }

    return parts.join('\n');
  }


  /**
   * 精简 MCP 查询结果：去除重复的 content/structuredContent，只保留关键信息
   */
  _formatMcpResult(data, maxResults = 8) {
    if (!data) return '无结果';
    
    let structured = data.structuredContent || null;
    if (!structured && data.content) {
      try {
        const textItem = Array.isArray(data.content) 
          ? data.content.find(item => item.type === 'text')
          : null;
        if (textItem && textItem.text) {
          structured = JSON.parse(textItem.text);
        }
      } catch (e) {
        // fallback
      }
    }
    
    if (!structured) {
      const slim = { ...data };
      delete slim.content;
      return JSON.stringify(slim, null, 2);
    }
    
    const results = (structured.results || []).slice(0, maxResults);
    const lines = results.map((r, i) => {
      const score = r.score ? `（相关度: ${(r.score * 100).toFixed(0)}%）` : '';
      return `${i + 1}. **${r.title || '未知'}**${score}\n   ${r.excerpt || ''}\n   ku_name: ${r.ku_name || ''}`;
    });
    
    const total = structured.total || results.length;
    const header = total > maxResults 
      ? `共 ${total} 条结果，展示前 ${maxResults} 条：`
      : `共 ${total} 条结果：`;
    
    return header + '\n\n' + lines.join('\n\n');
  }

  /**
   * 截断过长的文件内容，保留头部和尾部，中间用省略标记
   * 最大保留 MAX_CONTENT_LENGTH 字符
   */
  _truncateContent(text, maxLength = 8000) {
    if (!text || text.length <= maxLength) return text;
    
    const headSize = Math.floor(maxLength * 0.7);
    const tailSize = Math.floor(maxLength * 0.3);
    const omitted = text.length - headSize - tailSize;
    
    return text.substring(0, headSize) 
      + `\n\n... [省略 ${omitted} 字符] ...\n\n` 
      + text.substring(text.length - tailSize);
  }

  /**
   * 评估检索结果覆盖度
   */
  assessCoverage(results, keywords) {
    const allContent = this.integrateResults(results);
    const matchedKeywords = keywords.filter(kw => 
      allContent.toLowerCase().includes(kw.toLowerCase())
    );
    
    // 关键词覆盖率
    const keywordCoverage = keywords.length > 0 ? matchedKeywords.length / keywords.length : 0;
    
    // 内容长度评分（至少 1000 字符才算有足够资料）
    const lengthScore = Math.min(allContent.length / 1000, 1.0);
    
    // 资料来源多样性评分（至少 2 个不同来源）
    const sourceCount = [
      results.mcp?.success > 0 ? 1 : 0,
      results.designDocs?.results.length > 0 ? 1 : 0,
      results.oracleKb?.matchedEntries.length > 0 ? 1 : 0,
      results.testCases?.results.length > 0 ? 1 : 0,
      results.sourceCode?.results.length > 0 ? 1 : 0
    ].reduce((a, b) => a + b, 0);
    const diversityScore = sourceCount / 5;
    
    // 综合评分：关键词覆盖 50% + 内容长度 30% + 来源多样性 20%
    const comprehensiveScore = keywordCoverage * 0.5 + lengthScore * 0.3 + diversityScore * 0.2;

    const missingTopics = keywords.filter(kw => 
      !allContent.toLowerCase().includes(kw.toLowerCase())
    );

    // 调试模式下，综合评分 < 0.4 建议暂停
    const recommendation = comprehensiveScore >= 0.6 ? 'proceed' : 
                          comprehensiveScore >= 0.4 ? 'low_quality' : 'insufficient';

    return {
      score: comprehensiveScore,
      keywordCoverage,
      lengthScore,
      diversityScore,
      sourceCount,
      matchedKeywords,
      missingTopics,
      recommendation,
      sourceSummary: {
        mcp: results.mcp ? { queries: results.mcp.queries.length, success: results.mcp.success } : null,
        designDocs: results.designDocs ? { files: results.designDocs.results.length } : null,
        oracleKb: results.oracleKb ? { files: results.oracleKb.matchedEntries.length } : null,
        testCases: results.testCases ? { files: results.testCases.results.length } : null,
        sourceCode: results.sourceCode ? { files: results.sourceCode.results.length } : null
      },
      totalLength: allContent.length
    };
  }

  // --- 内部工具方法 ---

  async _scanDirectory(dir, keywords) {
    const matchedFiles = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const filePath = path.join(dir, entry.name);
          const content = await fs.readFile(filePath, 'utf-8');
          if (keywords.some(kw => content.toLowerCase().includes(kw.toLowerCase()))) {
            matchedFiles.push(filePath);
          }
        }
      }
    } catch (err) {
      // 目录不存在
    }
    return matchedFiles;
  }

  _parseOracleIndex(content) {
    const entries = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      // 匹配 Markdown 表格行：| P1-01-01 | \`P1-01-01-基本概念.md\` | 数据库基本概念 |
      const tableMatch = line.match(/\|\s*([A-Z0-9-]+)\s*\|\s*\`([^`]+)\`\s*\|\s*(.+?)\s*\|/);
      if (tableMatch) {
        entries.push({
          id: tableMatch[1],
          file: tableMatch[2],
          title: tableMatch[3].trim()
        });
        continue;
      }
      
      // 匹配简单表格行：| 01 | \`01-Oracle集群基础概念与架构.md\` | 主题 |
      const simpleTableMatch = line.match(/\|\s*([0-9]+)\s*\|\s*\`([^`]+)\`\s*\|\s*(.+?)\s*\|/);
      if (simpleTableMatch) {
        entries.push({
          id: simpleTableMatch[1],
          file: simpleTableMatch[2],
          title: simpleTableMatch[3].trim()
        });
      }
    }
    
    return entries;
  }

  _findMatchingKeywords(content, keywords) {
    return keywords.filter(kw => content.toLowerCase().includes(kw.toLowerCase()));
  }
}

module.exports = RetrievalStrategy;
