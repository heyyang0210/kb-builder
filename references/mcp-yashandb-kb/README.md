# YashanDB 知识库 MCP 配置说明

本目录用于存放 YashanDB 知识库 MCP（Model Context Protocol）的相关配置和缓存资料。

## 概述

YashanDB 知识库 MCP 是实时知识查询服务，提供对 YashanDB 官方文档的直接访问能力。MCP 作为**最高优先级**的资料来源，在文档生成时优先查询。

## MCP 配置

MCP Server 需要在 Codex 的 MCP 配置中注册，配置示例：

```json
{
  "mcpServers": {
    "yashandb-kb": {
      "command": "<mcp-server-command>",
      "args": ["<args>"],
      "env": {
        "YASHANDB_KB_ENDPOINT": "<endpoint_url>"
      }
    }
  }
}
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

## 当前状态

> ⚠️ YashanDB 知识库 MCP 尚未配置。请按照上述配置说明完成 MCP Server 注册。
> 配置完成后可运行前置检查脚本验证：`bash scripts/pre-check-references.sh`
