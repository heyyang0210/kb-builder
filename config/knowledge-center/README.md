# 知识中心配置

`config/knowledge-center/` 是面向运维的知识中心控制面，只保留三份英文命名的业务配置：

- `product.json`（产品配置）：产品身份、模块、工作台、能力清单和资源引用。
- `service.json`（服务配置）：服务、路径、日志、安全、模型、MCP 和 Agent 预设。默认模型为 `gpt-5.5`，并支持 DeepSeek。
- `content-rules.json`（内容规则）：资料加工、质量、同义词、特性和 GitLab 文档类型。
- `branding/default-icon.png`：登录页、favicon 和侧栏共用的默认品牌图标。

底层逻辑是依次回答“产品是什么、服务怎样运行、内容怎样处理”。根目录不得继续增加无法归入这三类的 JSON；持续变化的知识资产、GitLab 连接和模板库位于 `runtime/knowledge-center/`，不随配置发布包覆盖。

`.env.example` 只描述环境注入契约；本地 `.env` 可保存本机凭据但不得提交，生产密钥应由环境变量或密钥系统注入。
