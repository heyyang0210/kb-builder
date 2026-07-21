# YashanDB 知识库 MCP 配置说明

本目录用于存放 YashanDB 知识库 MCP（Model Context Protocol）的相关配置和缓存资料。

## 概述

YashanDB 知识库 MCP 是实时知识查询服务，提供对 YashanDB 官方文档的直接访问能力。MCP 作为**最高优先级**的资料来源，在文档生成时优先查询。

## 配置文件位置

**实际配置位置**：
```
agent-runner/config/mcp-config.json
```

该配置文件包含：
- MCP Server URL
- 请求超时设置
- 认证头信息（X-Ksacraft-Kb-Id）
- 缓存配置

## 配置内容示例

```json
{
  "server_url": "https://knowledgebase.yashandb.com/api/mcp",
  "timeout": 30000,
  "retry_count": 3,
  "cache": {
    "enabled": true,
    "ttl": 3600
  },
  "headers": [
    {
      "name": "X-Ksacraft-Kb-Id",
      "value": "24",
      "encrypted": false,
      "description": "YashanDB运维知识库"
    },
    {
      "name": "X-Ksacraft-Kb-Id",
      "value": "1",
      "encrypted": false,
      "description": "YashanDB官方文档知识库"
    }
  ]
}
```

## 验证配置

运行前置检查脚本验证 MCP 配置是否正确：

```bash
bash scripts/pre-check-references.sh
```

成功配置后，检查1将显示：
```
✓ 发现 YashanDB MCP 配置：agent-runner/config/mcp-config.json
```

## 降级策略

当 MCP 不可用时，系统自动降级到本地静态资料：

```
MCP 查询 → 特性设计文档 → Oracle知识库 → 测试用例 → 源码
```

降级后生成的文档会标注警告信息，建议人工复核。

## 缓存文件

本目录可存放 MCP 查询结果的缓存文件（可选），用于离线场景：

```
mcp-yashandb-kb/
├── README.md              # 本文件
├── cache/                 # MCP 查询缓存（可选）
│   └── [知识点]-cache.md  # 缓存的查询结果
└── config.json            # MCP 连接配置备份（可选）
```

## 前置检查脚本支持的配置路径

前置检查脚本会在以下位置查找 MCP 配置（按优先级）：

1. `~/.codex/mcp.json`
2. `~/.codex/config/mcp.json`
3. `仓库根目录/.codex/mcp.json`
4. `仓库根目录/mcp.json`
5. **`仓库根目录/agent-runner/config/mcp-config.json`** ← 当前使用

## 故障排查

### 问题：前置检查显示 MCP 未配置

**原因**：配置文件不在脚本检查的路径列表中

**解决方案**：
1. 确认配置文件位于 `agent-runner/config/mcp-config.json`
2. 确认前置检查脚本已更新（包含上述路径）
3. 重新运行 `bash scripts/pre-check-references.sh`

### 问题：MCP 配置存在但查询失败

**可能原因**：
1. MCP Server URL 不正确
2. 认证头信息（X-Ksacraft-Kb-Id）错误
3. 网络连接问题
4. MCP Server 服务不可用

**排查步骤**：
1. 检查 `agent-runner/config/mcp-config.json` 中的 `server_url`
2. 验证 `headers` 中的认证信息
3. 使用 curl 测试连接：
   ```bash
   curl -H "X-Ksacraft-Kb-Id: 24" https://knowledgebase.yashandb.com/api/mcp
   ```
4. 检查网络连通性

## 当前状态

> ✅ YashanDB 知识库 MCP 已配置。
> 配置位置：`agent-runner/config/mcp-config.json`
> 配置完成后可运行前置检查脚本验证：`bash scripts/pre-check-references.sh`
