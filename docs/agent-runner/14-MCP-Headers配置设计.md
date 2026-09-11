# MCP Headers 配置设计文档

## 1. 概述

MCP (Model Context Protocol) 服务器通常需要自定义 HTTP 标头进行认证和传递元数据。本设计为 MCP 配置添加 headers 支持，允许用户配置自定义的 HTTP 请求标头。

## 2. 设计简图

### 2.1 配置数据结构

```
┌─────────────────────────────────────────┐
│         MCP Configuration               │
├─────────────────────────────────────────┤
│  server_url: "http://localhost:8080"    │
│  timeout: 30000                         │
│  retry_count: 3                         │
│  cache: { enabled: true, ttl: 3600 }    │
│                                         │
│  headers: [                             │
│    ┌─────────────────────────────────┐ │
│    │ { name: "Authorization",        │ │
│    │   value: "Bearer xxx",          │ │
│    │   encrypted: true }             │ │
│    ├─────────────────────────────────┤ │
│    │ { name: "X-Custom-Header",      │ │
│    │   value: "custom-value",        │ │
│    │   encrypted: false }            │ │
│    └─────────────────────────────────┘ │
│  ]                                    │
└─────────────────────────────────────────┘
```

### 2.2 前端配置界面

```
┌──────────────────────────────────────────────────────┐
│  🔌 MCP 配置                                          │
├──────────────────────────────────────────────────────┤
│                                                      │
│  MCP Server URL                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ http://localhost:8080                          │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  MCP API Key（可选）                                 │
│  ┌────────────────────────────────────────────────┐ │
│  │ ••••••••                                     │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ─── HTTP 标头配置 ───                               │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ 标头名称          │ 标头值        │ 加密 │ 操作 │ │
│  ├────────────────────────────────────────────────┤ │
│  │ Authorization     │ Bearer xxx... │ 🔒   │  ✕  │ │
│  │ X-Request-ID      │ req-12345     │      │  ✕  │ │
│  │ X-Custom-Header   │ custom-value  │      │  ✕  │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  [+ 添加标头]                                        │
│                                                      │
│  超时时间 (ms)                                       │
│  ┌────────────────────────────────────────────────┐ │
│  │ 30000                                        │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  缓存 TTL (秒)                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ 3600                                         │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  [🔗 测试连接]  [💾 保存配置]                        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 2.3 数据流

```
前端配置界面
    │
    │ 1. 用户添加/编辑/删除 headers
    │
    ▼
saveConfig() / saveConfigSilent()
    │
    │ 2. 收集 headers 数组
    │    [{ name, value, encrypted }]
    │
    ▼
POST /api/config/mcp
    │
    │ 3. 后端接收配置
    │
    ▼
configManager.save('mcp-config', merged)
    │
    │ 4. 加密敏感 headers
    │    encrypted: true → value_encrypted
    │
    ▼
mcp-config.json
    │
    │ 5. 持久化存储
    │
    ▼
MCP Client 使用时
    │
    │ 6. 加载配置并解密
    │
    ▼
HTTP 请求标头
    {
      "Authorization": "Bearer xxx",
      "X-Custom-Header": "custom-value"
    }
```

## 3. 配置文件格式

### 3.1 mcp-config.json 新结构

```json
{
  "server_url": "http://localhost:8080",
  "api_key_encrypted": "U2FsdGVkU1...",
  "timeout": 30000,
  "retry_count": 3,
  "cache": {
    "enabled": true,
    "ttl": 3600,
    "max_size": 1000
  },
  "headers": [
    {
      "name": "Authorization",
      "value_encrypted": "U2FsdGVkU1...",
      "encrypted": true,
      "description": "Bearer token 认证"
    },
    {
      "name": "X-Request-ID",
      "value": "req-12345",
      "encrypted": false,
      "description": "请求追踪 ID"
    },
    {
      "name": "X-Custom-Header",
      "value": "custom-value",
      "encrypted": false,
      "description": "自定义标头"
    }
  ]
}
```

### 3.2 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | HTTP 标头名称 |
| value | string | 否 | 标头值（明文，encrypted=false 时使用） |
| value_encrypted | string | 否 | 加密后的标头值（encrypted=true 时使用） |
| encrypted | boolean | 是 | 是否加密存储 |
| description | string | 否 | 标头描述（用于 UI 显示） |

## 4. 前端实现

### 4.1 配置界面 HTML

```html
<!-- MCP 配置 Tab -->
<div id="mcp-tab" class="config-tab-content">
  <!-- 现有字段 -->
  
  <!-- HTTP 标头配置 -->
  <div class="config-section">
    <label>HTTP 标头配置</label>
    <div id="headersContainer" class="headers-container">
      <!-- 动态生成的 header 行 -->
    </div>
    <button type="button" class="btn btn-secondary" onclick="addHeaderRow()">
      + 添加标头
    </button>
  </div>
</div>
```

### 4.2 核心 JavaScript 函数

```javascript
// 添加标头行
function addHeaderRow(name = '', value = '', encrypted = false, description = '') {
  const container = document.getElementById('headersContainer');
  const row = document.createElement('div');
  row.className = 'header-row';
  row.innerHTML = `
    <input type="text" class="header-name" placeholder="标头名称" value="${name}">
    <input type="text" class="header-value" placeholder="标头值" value="${value}">
    <label class="header-encrypted">
      <input type="checkbox" ${encrypted ? 'checked' : ''} onchange="toggleHeaderValueType(this)">
      🔒 加密
    </label>
    <input type="text" class="header-desc" placeholder="描述（可选）" value="${description}">
    <button type="button" class="btn-icon" onclick="removeHeaderRow(this)">✕</button>
  `;
  container.appendChild(row);
}

// 收集所有标头
function collectHeaders() {
  const rows = document.querySelectorAll('.header-row');
  const headers = [];
  rows.forEach(row => {
    const name = row.querySelector('.header-name').value.trim();
    const value = row.querySelector('.header-value').value;
    const encrypted = row.querySelector('.header-encrypted input').checked;
    const description = row.querySelector('.header-desc').value.trim();
    
    if (name) {
      headers.push({ name, value, encrypted, description });
    }
  });
  return headers;
}

// 加载标头配置
function loadHeaders(headers) {
  const container = document.getElementById('headersContainer');
  container.innerHTML = '';
  if (headers && Array.isArray(headers)) {
    headers.forEach(h => {
      addHeaderRow(h.name, h.value || '', h.encrypted, h.description);
    });
  }
}
```

## 5. 后端实现

### 5.1 配置验证

```javascript
// lib/config-validator.js
static validateMCPConfig(config) {
  const errors = [];
  
  if (!config.server_url) {
    errors.push('server_url is required');
  }
  
  // 验证 headers
  if (config.headers && Array.isArray(config.headers)) {
    config.headers.forEach((header, index) => {
      if (!header.name) {
        errors.push(`header[${index}].name is required`);
      }
      if (header.encrypted && !header.value && !header.value_encrypted) {
        errors.push(`header[${index}].value is required when encrypted=true`);
      }
    });
  }
  
  return { valid: errors.length === 0, errors };
}
```

### 5.2 配置加密/解密

```javascript
// lib/config-manager.js
_encryptSensitiveFields(config) {
  const result = { ...config };
  
  // 加密 api_key
  if (result.api_key) {
    result.api_key_encrypted = this._encrypt(result.api_key);
    delete result.api_key;
  }
  
  // 加密 headers
  if (result.headers && Array.isArray(result.headers)) {
    result.headers = result.headers.map(header => {
      if (header.encrypted && header.value) {
        return {
          ...header,
          value_encrypted: this._encrypt(header.value),
          value: undefined
        };
      }
      return header;
    });
  }
  
  return result;
}

_decryptSensitiveFields(config) {
  if (!config) return config;
  const result = { ...config };
  
  // 解密 api_key
  if (result.api_key_encrypted) {
    try {
      result.api_key = this._decrypt(result.api_key_encrypted);
    } catch (err) {
      logger.warn('Failed to decrypt api_key');
    }
  }
  
  // 解密 headers
  if (result.headers && Array.isArray(result.headers)) {
    result.headers = result.headers.map(header => {
      if (header.encrypted && header.value_encrypted) {
        try {
          return {
            ...header,
            value: this._decrypt(header.value_encrypted)
          };
        } catch (err) {
          logger.warn(`Failed to decrypt header: ${header.name}`);
          return header;
        }
      }
      return header;
    });
  }
  
  return result;
}
```

### 5.3 MCP 客户端使用

```javascript
// lib/tools/mcp-client.js
class MCPClient {
  constructor(config) {
    this.serverUrl = config.server_url;
    this.timeout = config.timeout || 30000;
    this.headers = this._buildHeaders(config);
  }
  
  _buildHeaders(config) {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // 添加 API Key（如果有）
    if (config.api_key) {
      headers['Authorization'] = `Bearer ${config.api_key}`;
    }
    
    // 添加自定义 headers
    if (config.headers && Array.isArray(config.headers)) {
      config.headers.forEach(header => {
        if (header.name && header.value) {
          headers[header.name] = header.value;
        }
      });
    }
    
    return headers;
  }
  
  async request(method, path, data) {
    const response = await fetch(`${this.serverUrl}${path}`, {
      method,
      headers: this.headers,
      body: data ? JSON.stringify(data) : undefined,
      timeout: this.timeout
    });
    
    return response.json();
  }
}
```

## 6. 测试用例

### 6.1 单元测试

```javascript
// tests/config-manager.test.js
describe('ConfigManager - MCP Headers', () => {
  test('should encrypt sensitive headers', () => {
    const config = {
      server_url: 'http://localhost:8080',
      headers: [
        { name: 'Authorization', value: 'Bearer secret', encrypted: true },
        { name: 'X-Custom', value: 'public', encrypted: false }
      ]
    };
    
    const encrypted = configManager._encryptSensitiveFields(config);
    
    expect(encrypted.headers[0].value_encrypted).toBeDefined();
    expect(encrypted.headers[0].value).toBeUndefined();
    expect(encrypted.headers[1].value).toBe('public');
  });
  
  test('should decrypt sensitive headers', () => {
    const config = {
      server_url: 'http://localhost:8080',
      headers: [
        { name: 'Authorization', value_encrypted: '...', encrypted: true },
        { name: 'X-Custom', value: 'public', encrypted: false }
      ]
    };
    
    const decrypted = configManager._decryptSensitiveFields(config);
    
    expect(decrypted.headers[0].value).toBe('Bearer secret');
    expect(decrypted.headers[1].value).toBe('public');
  });
});
```

## 7. 迁移策略

对于现有的 mcp-config.json，需要向后兼容：

```javascript
// 如果没有 headers 字段，初始化为空数组
if (!config.headers) {
  config.headers = [];
}
```

## 8. 安全考虑

1. **敏感标头加密**：Authorization、Cookie 等敏感标头必须加密存储
2. **日志脱敏**：日志中不输出敏感的 header 值
3. **前端显示**：加密的 header 值在 UI 中显示为 `••••••••`

## 9. 后续优化

1. **预设模板**：提供常用的 header 模板（如 Bearer Token、Basic Auth）
2. **批量导入**：支持从 JSON 文件批量导入 headers
3. **标头验证**：验证 header 名称是否符合 HTTP 规范
4. **标头测试**：在测试连接时显示实际发送的 headers

## 10. 参考资料

- [HTTP Headers 规范](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
