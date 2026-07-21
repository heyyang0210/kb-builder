const logger = require('../logger');

class MCPCache {
  constructor(config = {}) {
    this.ttl = (config.ttl || 3600) * 1000;
    this.maxSize = config.max_size || 1000;
    this.cache = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > this.ttl) {
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
    this.baseUrl = config.server_url || 'http://localhost:8080';
    this.apiKey = config.api_key || '';
    this.timeout = config.timeout || 30000;
    this.cache = config.cache?.enabled !== false ? new MCPCache(config.cache || {}) : null;
    
    // 构建自定义 headers
    this.customHeaders = {};
    if (config.headers && Array.isArray(config.headers)) {
      config.headers.forEach(header => {
        if (header.name && header.value) {
          this.customHeaders[header.name] = header.value;
        }
      });
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
      return this._parseSSEResponse(text);
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
    return response.result?.tools || [];
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
