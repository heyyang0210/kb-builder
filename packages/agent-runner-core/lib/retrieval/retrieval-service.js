/**
 * 统一检索服务 - 串联所有检索阶段
 */

const queryPlanner = require('./query-planner');
const resultFilter = require('./result-filter');
const contextAssembler = require('./context-assembler');
const logger = require('../logger');

class RetrievalService {
  constructor({ mcpClient, fileReader }) {
    this.mcpClient = mcpClient;
    this.fileReader = fileReader;
  }
  
  /**
   * 执行完整检索流程
   */
  async retrieve({ knowledgePoint, prompt, options = {} }) {
    const { maxQueries = 6, enableLocalSearch = true } = options;
    
    // 阶段1：查询规划
    const plan = queryPlanner.generateQueries(knowledgePoint, { maxQueries });
    const reviewed = queryPlanner.reviewQueries(plan.queries, knowledgePoint);
    
    logger.info('[retrieval] Query plan', {
      generated: plan.queries.length,
      after_review: reviewed.queries.length,
      dropped: reviewed.dropped.length,
      dimensions: plan.dimensions
    });
    
    // 阶段2：MCP 检索
    const mcpResults = await this._queryMCP(reviewed.queries, plan.dimensionMap);
    
    // 阶段3：结果整理
    const processedResults = mcpResults.map(r => 
      resultFilter.processMcpResult(r.query, r.dimension, r.rawResult)
    );
    
    const filtered = resultFilter.deduplicate(processedResults);
    const grouped = resultFilter.groupByDimension(filtered);
    
    logger.info('[retrieval] After processing', {
      mcp_results_total: processedResults.reduce((sum, r) => sum + r.results.length, 0),
      after_dedup: filtered.length,
      dimensions_covered: Object.keys(grouped).length
    });
    
    // 阶段4：本地文件检索
    let localFiles = [];
    if (enableLocalSearch && this.fileReader) {
      localFiles = await this._searchLocalFiles(knowledgePoint);
    }
    
    // 阶段5：上下文组装
    const context = contextAssembler.assemble(grouped, localFiles, knowledgePoint, {
      required: plan.dimensions.slice(0, 3),
      optional: plan.dimensions.slice(3)
    });
    
    return {
      context,
      plan: { queries: reviewed.queries, dropped: reviewed.dropped, dimensions: plan.dimensions },
      stats: {
        queries_sent: reviewed.queries.length,
        results_before_filter: processedResults.reduce((sum, r) => sum + r.results.length, 0),
        results_after_filter: filtered.length,
        local_files_found: localFiles.length,
        dimensions_covered: Object.keys(grouped)
      }
    };
  }
  
  /**
   * MCP 批量查询
   */
  async _queryMCP(queries, dimensionMap) {
    if (!this.mcpClient) {
      logger.warn('[retrieval] No MCP client available');
      return [];
    }
    
    const results = [];
    
    for (const query of queries) {
      try {
        const dimension = dimensionMap[query] || 'other';
        const rawResult = await this.mcpClient.query(query);
        results.push({ query, dimension, rawResult });
      } catch (err) {
        logger.error(`[retrieval] MCP query failed: ${query}`, { error: err.message });
        results.push({ query, dimension: dimensionMap[query] || 'other', rawResult: { success: false, error: err.message } });
      }
    }
    
    return results;
  }
  
  /**
   * 本地文件检索
   */
  async _searchLocalFiles(knowledgePoint) {
    // TODO: 实现本地文件检索逻辑
    // 根据知识点核心术语，在 references/ 目录中搜索相关文件
    return [];
  }
}

module.exports = RetrievalService;
