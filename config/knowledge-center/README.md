# 知识中心配置

`config/knowledge-center/` 是面向运维的知识中心控制面，只保留三份英文命名的业务配置：

- `product.json`（产品配置）：产品身份、模块、工作台、能力清单和资源引用。
- `service.json`（服务配置）：服务、路径、日志、安全、模型、MCP 和 Agent 预设。默认模型为 `gpt-5.5`，并支持 DeepSeek。
- `content-rules.json`（内容规则）：资料加工、质量、同义词、特性和 GitLab 文档类型。
- `branding/default-icon.png`：登录页、favicon 和侧栏共用的默认品牌图标。

`service.json` 中 `documentPaths[].path` 的相对路径统一以仓库根目录解析，不以 `config/knowledge-center/` 或服务进程的启动目录解析。例如仓库位于 `/data/docs/AI高效应用示例/06-YashanDB知识库Skill仓库`时，`../../ai 体系认知` 指向 `/data/docs/ai 体系认知`。配置中保留相对路径，避免将开发机的绝对路径固化到仓库。

底层逻辑是依次回答“产品是什么、服务怎样运行、内容怎样处理”。根目录不得继续增加无法归入这三类的 JSON；持续变化的知识资产、GitLab 连接和模板库位于 `runtime/knowledge-center/`，不随配置发布包覆盖。

`.env.example` 只描述环境注入契约；本地 `.env` 可保存本机凭据但不得提交，生产密钥应由环境变量或密钥系统注入。

认证配置由平台内核读取，生产平台不需要独立认证端口；`KNOWLEDGE_CENTER_AUTH_PORT/HOST` 仅为隔离运行 `apps/knowledge-center-auth/auth-server.js` 的兼容测试变量保留。
