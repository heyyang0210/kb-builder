const BaseAgent = require('./base-agent');
const logger = require('../logger');

class RetrieverAgent extends BaseAgent {
  constructor(config = {}) {
    super('retriever', '检索参考资料', config);
    this.toolManager = null;
  }

  setToolManager(toolManager) {
    this.toolManager = toolManager;
    logger.info('[retriever] ToolManager set', { hasToolManager: !!toolManager });
  }

  validateInput(input) {
    if (!input.executionPlan) {
      throw new Error('executionPlan is required');
    }
    return true;
  }

  buildPrompt(input, stepConfig) {
    const template = this.loadPromptTemplate('retriever.md');
    const plan = input.executionPlan;

    const planInfo = `
## 执行计划

### 知识点
- 名称: ${plan.knowledge_point?.name || 'N/A'}
- 类型: ${plan.knowledge_point?.type || 'N/A'}

### 检索策略
- MCP 查询: ${(plan.retrieval_plan?.mcp_queries || []).join(', ') || '无'}
- 参考文件: ${(plan.retrieval_plan?.reference_files || []).join(', ') || '无'}
`;

    const retrievedContent = input.retrieved_content
      ? `\n## 已检索到的内容\n\n${input.retrieved_content}`
      : '\n## 注意\nMCP 和文件检索结果将在工具调用后提供。请基于以下信息整理参考资料。';

    const systemPrompt = template || '请根据执行计划整理参考资料文档。';

    return [
      { role: 'system', content: '你是 YashanDB 知识库资料检索专家，负责整理和汇总参考资料。' },
      { role: 'user', content: `${systemPrompt}\n\n${planInfo}${retrievedContent}` }
    ];
  }

  async execute(input, stepConfig = {}) {
    logger.info('[retriever] Starting execution');

    // 先执行工具检索
    const retrievedContent = await this._retrieveContent(input.executionPlan);
    input.retrieved_content = retrievedContent;

    logger.info('[retriever] Content retrieved', { length: retrievedContent.length });

    // 再调用 LLM 整理
    return super.execute(input, stepConfig);
  }

  async _retrieveContent(plan) {
    const parts = [];

    if (!this.toolManager) {
      logger.warn('[retriever] No tool manager, skipping tool retrieval');
      return parts.join('\n\n');
    }

    // MCP 查询
    const mcpQueries = plan.retrieval_plan?.mcp_queries || [];
    logger.info('[retriever] MCP queries', { count: mcpQueries.length, queries: mcpQueries });

    if (mcpQueries.length > 0) {
      try {
        const mcpClient = this.toolManager.getTool('mcp');
        
        this._emitDetail({
          type: 'tool_call',
          name: 'MCP 批量查询',
          tool: 'mcp',
          status: 'running',
          message: `正在查询 MCP 知识库：${mcpQueries.length} 条关键词`,
          input_summary: { queries: mcpQueries },
          timestamp: Date.now()
        });

        const startTime = Date.now();
        const results = await mcpClient.batchQuery(mcpQueries);
        const duration = Date.now() - startTime;

        let successCount = 0;
        let totalTokens = 0;

        results.forEach((r, i) => {
          if (r.success && r.data) {
            successCount++;
            const content = typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2);
            parts.push(`### MCP 查询: ${mcpQueries[i]}\n\n${content}`);
            totalTokens += content.length / 4; // 粗略估计

            this._emitDetail({
              type: 'tool_call',
              name: `MCP 查询: ${mcpQueries[i]}`,
              tool: 'mcp',
              status: 'success',
              message: `MCP 查询成功：${mcpQueries[i]}`,
              input_summary: { query: mcpQueries[i] },
              output_summary: { content_length: content.length },
              duration: duration / results.length,
              tokens: Math.round(content.length / 4),
              timestamp: Date.now()
            });
          } else {
            parts.push(`### MCP 查询: ${mcpQueries[i]}\n\n查询失败: ${r.error || '未知错误'}`);

            this._emitDetail({
              type: 'tool_call',
              name: `MCP 查询: ${mcpQueries[i]}`,
              tool: 'mcp',
              status: 'failed',
              message: `MCP 查询失败：${mcpQueries[i]}`,
              input_summary: { query: mcpQueries[i] },
              output_summary: { error: r.error },
              error: r.error,
              duration: duration / results.length,
              timestamp: Date.now()
            });
          }
        });

        logger.info('[retriever] MCP queries completed', { 
          total: mcpQueries.length, 
          success: successCount,
          duration: `${duration}ms`
        });

      } catch (err) {
        logger.error(`[retriever] MCP query failed: ${err.message}`);
        parts.push(`### MCP 查询\n\nMCP 服务不可用: ${err.message}`);

        this._emitDetail({
          type: 'tool_call',
          name: 'MCP 批量查询',
          tool: 'mcp',
          status: 'failed',
          message: `MCP 服务不可用：${err.message}`,
          input_summary: { queries: mcpQueries },
          output_summary: { error: err.message },
          error: err.message,
          timestamp: Date.now()
        });
      }
    }

    // 文件读取
    const refFiles = plan.retrieval_plan?.reference_files || [];
    logger.info('[retriever] Reference files', { count: refFiles.length, files: refFiles });

    if (refFiles.length > 0) {
      try {
        const fileReader = this.toolManager.getTool('file_reader');
        
        for (const filePath of refFiles) {
          const startTime = Date.now();
          
          this._emitDetail({
            type: 'tool_call',
            name: `文件读取: ${filePath}`,
            tool: 'file_reader',
            status: 'running',
            message: `正在读取参考文件：${filePath}`,
            input_summary: { path: filePath },
            timestamp: Date.now()
          });

          try {
            const content = await fileReader.read(filePath);
            const duration = Date.now() - startTime;
            
            parts.push(`### 文件: ${filePath}\n\n${content.content}`);

            this._emitDetail({
              type: 'tool_call',
              name: `文件读取: ${filePath}`,
              tool: 'file_reader',
              status: 'success',
              message: `参考文件读取成功：${filePath}`,
              input_summary: { path: filePath },
              output_summary: { content_length: content.content.length },
              duration: duration,
              tokens: Math.round(content.content.length / 4),
              timestamp: Date.now()
            });

            logger.info(`[retriever] File read success: ${filePath}`, { 
              length: content.content.length,
              duration: `${duration}ms`
            });

          } catch (err) {
            const duration = Date.now() - startTime;
            parts.push(`### 文件: ${filePath}\n\n读取失败: ${err.message}`);

            this._emitDetail({
              type: 'tool_call',
              name: `文件读取: ${filePath}`,
              tool: 'file_reader',
              status: 'failed',
              message: `参考文件读取失败：${filePath}`,
              input_summary: { path: filePath },
              output_summary: { error: err.message },
              error: err.message,
              duration: duration,
              timestamp: Date.now()
            });

            logger.error(`[retriever] File read failed: ${filePath}`, { error: err.message });
          }
        }
      } catch (err) {
        logger.warn(`[retriever] File reading failed: ${err.message}`);
      }
    }

    return parts.join('\n\n---\n\n');
  }

  parseResponse(response) {
    return {
      references: response.content,
      usage: response.usage
    };
  }
}

module.exports = RetrieverAgent;
