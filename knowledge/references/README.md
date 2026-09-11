# 参考资料目录说明

本目录存放生成文档时引用的参考资料，按优先级组织。

## 目录结构

```
references/
├── README.md                  # 本文件
├── mcp-yashandb-kb/           # YashanDB 知识库 MCP（最高优先级，实时查询）
│   └── README.md              #   MCP 配置说明
├── design-docs/               # 特性设计文档（优先级②）
│   └── README.md              #   使用说明
├── oracle-kb/                 # Oracle 知识库（优先级③，改写参考）
│   ├── 01-Oracle集群基础概念与架构.md
│   ├── 02-集群核心组件与内部机制.md
│   ├── 03-集群资源管理与日常运维.md
│   ├── 04-集群性能监控与诊断.md
│   ├── 05-集群性能调优实战.md
│   ├── 06-高可用与容灾架构.md
│   └── 07-集群内核机制深度解析.md
├── test-cases/                # 测试用例（优先级④）
│   └── README.md              #   使用说明
└── source/                    # 源码分析（优先级⑤，兜底）
    └── README.md              #   使用说明
```

## 引用优先级

| 优先级 | 资料类型 | 存放位置/来源 | 用途 |
|--------|---------|-------------|------|
| ① | YashanDB 知识库 MCP | MCP Server（实时查询） | 最新功能规格、官方文档 |
| ② | 特性设计文档 | `design-docs/` | 最权威的功能规格 |
| ③ | Oracle知识库 | `oracle-kb/` | 高质量参考内容，改写为YashanDB版本 |
| ④ | 测试用例 | `test-cases/` | 可执行验证SQL |
| ⑤ | 源码 | `source/` | 实现细节兜底 |

## YashanDB 知识库 MCP

YashanDB 知识库 MCP 是实时知识查询服务，作为**最高优先级**资料来源。

- **配置状态**：⚠️ 尚未配置
- **配置方法**：参见 `mcp-yashandb-kb/README.md`
- **降级策略**：MCP 不可用时自动降级到本地静态资料（②→③→④→⑤）
- **验证方法**：运行 `bash scripts/pre-check-references.sh`

## Oracle 知识库映射

| YashanDB知识点 | 对应Oracle文档 | 映射说明 |
|---------------|---------------|---------|
| 集群基础概念 | `oracle-kb/01-Oracle集群基础概念与架构.md` | 改写为YashanDB版本 |
| 集群核心组件 | `oracle-kb/02-集群核心组件与内部机制.md` | 改写为YashanDB版本 |
| 资源管理运维 | `oracle-kb/03-集群资源管理与日常运维.md` | 改写为YashanDB版本 |
| 性能监控诊断 | `oracle-kb/04-集群性能监控与诊断.md` | 改写为YashanDB版本 |
| 性能调优 | `oracle-kb/05-集群性能调优实战.md` | 改写为YashanDB版本 |
| 高可用容灾 | `oracle-kb/06-高可用与容灾架构.md` | 改写为YashanDB版本 |
| 内核机制 | `oracle-kb/07-集群内核机制深度解析.md` | 改写为YashanDB版本 |

## 使用规则

- **优先使用 MCP**：生成文档前先确认 YashanDB 知识库 MCP 是否可用
- **禁止直接复制** Oracle 知识库内容，必须改写为 YashanDB 版本
- 保留结构和方法论，替换具体产品特性
- 标注与 Oracle 的差异点（如有）
- 引用格式参见 `config/资料引用策略.md`

## 前置检查

每次生成文档前，**必须运行前置检查脚本**：

```bash
bash scripts/pre-check-references.sh
```

脚本会检查 MCP 配置、目录结构、文档完整性，并给出修复建议。

> 目录精简说明：当前目录位于 knowledge/ 下，资源引用以仓库根为基准。历史示例路径以 knowledge/README.md 与企业 manifest 为准。
