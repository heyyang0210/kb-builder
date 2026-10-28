const { resolveMcpService } = require('../mcp-services');
const logger = require('../logger');
const { readJson } = require('../json-config');
const { CONFIG_PATHS } = require('../config-registry');

function configuredSearchHeader(config) {
  if (config.search_knowledge_base_header) return config.search_knowledge_base_header;
  try {
    return readJson(CONFIG_PATHS.contentRules).platformMcp.multiSearchHeaderName || '';
  } catch (_) {
    return '';
  }
}

class MCPCache {
  constructor(config = {}) {
    this.ttl = (config.ttl ?? 3600) * 1000;
    this.maxSize = config.max_size || 1000;
    this.cache = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp >= this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  set(key, data) {
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

class MCPClient {
  constructor(config = {}) {
    if (Array.isArray(config.services)) config = resolveMcpService(config);
    if (config.enabled === false) throw new Error('MCP 服务已停用');
    this.baseUrl = config.server_url || 'http://localhost:8080';
    this.apiKey = config.api_key || '';
    this.timeout = config.timeout || 30000;
    this.searchKnowledgeBaseHeader = configuredSearchHeader(config);
    this.cache = config.cache?.enabled !== false ? new MCPCache(config.cache || {}) : null;
    const configuredTargets = Array.isArray(config.search_knowledge_bases)
      ? config.search_knowledge_bases
      : (config.headers || []).filter(header => String(header.name || '').toLowerCase() === this.searchKnowledgeBaseHeader.toLowerCase()).map(header => header.value);
    this.searchKnowledgeBases = [...new Set(configuredTargets.map(String).filter(Boolean))];
    
    // 构建自定义 headers
    this.customHeaders = {};
    if (config.headers && Array.isArray(config.headers)) {
      config.headers.forEach(header => {
        if (header.name && header.value) {
          this.customHeaders[header.name] = header.value;
        }
      });
    }
    if (this.searchKnowledgeBases.length && this.searchKnowledgeBaseHeader && !Object.keys(this.customHeaders).some(name => name.toLowerCase() === this.searchKnowledgeBaseHeader.toLowerCase())) {
      this.customHeaders[this.searchKnowledgeBaseHeader] = this.searchKnowledgeBases[0];
    }
    
    // MCP 协议状态
    this.initialized = false;
    this.requestId = 0;
    this.serverInfo = null;
    this.capabilities = null;
    this.sessionId = null;  // MCP session ID
    
    logger.debug(`MCPClient initialized: ${this.baseUrl}, headers: ${Object.keys(this.customHeaders).length}`);
  }

  _nextId() {
    return ++this.requestId;
  }

  _buildHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
      ...this.customHeaders
    };
    
    // 添加 session ID（如果已初始化）
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }
    
    return headers;
  }

  async _request(method, params = {}, isNotification = false) {
    const url = this.baseUrl;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const message = {
      jsonrpc: '2.0',
      method,
      params
    };
    
    // Notification 不需要 id
    if (!isNotification) {
      message.id = this._nextId();
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this._buildHeaders(),
        body: JSON.stringify(message),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`MCP request failed: ${response.status} ${response.statusText} - ${text}`);
      }

      // 保存 session ID（从 initialize 响应中获取）
      const newSessionId = response.headers.get('mcp-session-id');
      if (newSessionId) {
        this.sessionId = newSessionId;
        logger.debug(`MCP session ID: ${this.sessionId}`);
      }

      // Notification 返回响应体（202 Accepted）
      if (isNotification) {
        return null;
      }

      // 解析 SSE 响应
      const text = await response.text();
      const parsed = this._parseSSEResponse(text);
      if (!parsed || parsed.error || parsed.jsonrpc !== '2.0' || parsed.id !== message.id) {
        throw new Error('Invalid MCP JSON-RPC response');
      }
      return parsed;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`MCP request timeout after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  _parseSSEResponse(text) {
    // 解析 SSE 格式: "event: message\ndata: {...}\n\n"
    const lines = text.split('\n');
    let dataLine = null;
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        dataLine = line.substring(6);
        break;
      }
    }
    
    if (!dataLine) {
      // 尝试直接解析 JSON
      try {
        return JSON.parse(text);
      } catch {
        throw new Error('Invalid SSE response format');
      }
    }
    
    try {
      return JSON.parse(dataLine);
    } catch (e) {
      throw new Error(`Failed to parse SSE data: ${dataLine}`);
    }
  }

  async initialize() {
    if (this.initialized) {
      return { serverInfo: this.serverInfo, capabilities: this.capabilities };
    }

    const response = await this._request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'agent-runner',
        version: '1.0.0'
      }
    });

    if (!response.result?.serverInfo?.name || !response.result?.capabilities) {
      throw new Error('Invalid MCP initialize response');
    }
    if (response.result) {
      this.serverInfo = response.result.serverInfo;
      this.capabilities = response.result.capabilities;
      this.initialized = true;
      
      // 发送 initialized 通知（notification 不需要 id）
      await this._request('notifications/initialized', {}, true);
      
      logger.info(`MCP initialized: ${this.serverInfo?.name} v${this.serverInfo?.version}`);
    }

    return { serverInfo: this.serverInfo, capabilities: this.capabilities };
  }

  async listTools() {
    await this.initialize();
    const response = await this._request('tools/list', {});
    if (!Array.isArray(response.result?.tools) || response.result.tools.some(tool => typeof tool?.name !== 'string' || !tool.name)) {
      throw new Error('Invalid MCP tools/list response');
    }
    return response.result.tools;
  }

  async callTool(toolName, args = {}) {
    await this.initialize();
    const response = await this._request('tools/call', {
      name: toolName,
      arguments: args
    });
    return response.result;
  }

  async query(queryText, options = {}) {
    if (this.searchKnowledgeBases.length > 1) {
      const cacheKey = JSON.stringify({ queryText, options, searchKnowledgeBases: this.searchKnowledgeBases });
      if (this.cache) {
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;
      }
      const settled = await Promise.allSettled(this.searchKnowledgeBases.map(async knowledgeBaseId => {
        const client = new MCPClient({
          server_url: this.baseUrl,
          api_key: this.apiKey,
          timeout: this.timeout,
          cache: { enabled: false },
          headers: [...Object.entries(this.customHeaders).filter(([name]) => name.toLowerCase() !== this.multiSearchHeaderName.toLowerCase()).map(([name, value]) => ({ name, value })), { name: this.multiSearchHeaderName, value: knowledgeBaseId }]
        });
        return { knowledgeBaseId, data: await client.query(queryText, options) };
      }));
      const successes = settled.filter(result => result.status === 'fulfilled').map(result => result.value);
      if (!successes.length) throw new Error('MCP search failed for all configured knowledge bases');
      const merged = this._mergeSearchResults(successes);
      const failures = settled.filter(result => result.status === 'rejected');
      if (failures.length && merged.structuredContent) merged.structuredContent.search_warnings = failures.length;
      if (this.cache) this.cache.set(cacheKey, merged);
      return merged;
    }
    if (this.cache) {
      const cached = this.cache.get(queryText);
      if (cached) {
        logger.debug(`MCP cache hit: ${queryText}`);
        return cached;
      }
    }

    // 使用 search_ku 工具进行查询
    const result = await this.callTool('search_ku', { 
      query: queryText,
      ...options 
    });

    if (this.cache && result) {
      this.cache.set(queryText, result);
    }

    return result;
  }

  get multiSearchHeaderName() {
    return this.searchKnowledgeBaseHeader;
  }

  _mergeSearchResults(successes) {
    const first = successes[0].data || {};
    const allResults = [];
    let structuredBase = null;
    for (const { knowledgeBaseId, data } of successes) {
      const structured = data?.structuredContent;
      if (structured && typeof structured === 'object' && !Array.isArray(structured)) {
        structuredBase ||= structured;
        for (const result of Array.isArray(structured.results) ? structured.results : []) allResults.push({ ...result, kb_id: result.kb_id ?? knowledgeBaseId });
        continue;
      }
      for (const item of data?.content || []) {
        if (item.type !== 'text') continue;
        try {
          const parsed = JSON.parse(item.text);
          structuredBase ||= parsed;
          for (const result of Array.isArray(parsed.results) ? parsed.results : []) allResults.push({ ...result, kb_id: result.kb_id ?? knowledgeBaseId });
        } catch (_) {}
      }
    }
    const best = new Map();
    for (const result of allResults) {
      const key = result.ku_name || `${result.kb_id}:${result.title || ''}:${result.excerpt || ''}`;
      const previous = best.get(key);
      if (!previous || Number(result.score || 0) > Number(previous.score || 0)) best.set(key, result);
    }
    const results = [...best.values()].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    const structuredContent = structuredBase ? { ...structuredBase, results, total: results.length, kb_ids: successes.map(item => item.knowledgeBaseId) } : undefined;
    return { ...first, ...(structuredContent ? { structuredContent } : {}), searchKnowledgeBases: successes.map(item => item.knowledgeBaseId) };
  }

  async batchQuery(queries, options = {}) {
    const results = await Promise.allSettled(
      queries.map(q => this.query(q, options))
    );

    return results.map((r, i) => ({
      query: queries[i],
      success: r.status === 'fulfilled',
      data: r.status === 'fulfilled' ? r.value : null,
      error: r.status === 'rejected' ? r.reason.message : null
    }));
  }

  async getDocument(docId) {
    return this.callTool('get_ku_detail', { ku_name: docId });
  }

  getCacheStats() {
    return {
      enabled: this.cache !== null,
      size: this.cache ? this.cache.size : 0,
      ttl: this.cache ? this.cache.ttl / 1000 : 0
    };
  }

  async testConnection() {
    try {
      const result = await this.initialize();
      const tools = await this.listTools();
      return { 
        success: true, 
        message: `MCP 连接成功: ${result.serverInfo?.name} v${result.serverInfo?.version}`,
        tools: tools.map(t => t.name),
        serverInfo: result.serverInfo
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = { MCPClient, MCPCache };
