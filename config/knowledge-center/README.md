# 知识中心配置

`config/knowledge-center/` 是知识中心的统一配置入口，避免以功能拆分的散落 JSON 作为运行时依赖。

- `platform.json`：企业平台能力、模块、资源引用与静态品牌图标。图标由后端读取 `brand.icon.resourceRef`，不在管理页在线修改。
- `runtime.json`：服务、路径、日志和安全运行参数。
- `ai-services.json`：模型、MCP 和 Agent 预设；密钥仅保留加密存储。
- `processing.json`：资料加工、质量、同义词、特性和 GitLab 文档类型。
- `branding/default.png`：平台默认品牌图标，供 favicon、登录页和侧栏展示。
- `state/`：持续变化的业务事实，包括知识资产与 GitLab 连接，与静态配置分离。

`.env` 与 `.env.example` 保持独立，不写入 JSON。
