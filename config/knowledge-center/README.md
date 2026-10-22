# 知识中心配置

`content-rules.json#/outlineTemplate` 定义自然路径大纲模板的版本、六列表头、最大深度、Markdown 扩展名、介绍文件前缀和 SQL 示例源。每行完整路径、不继承空白；Excel 行序是文档顺序。根介绍和目录介绍均须在各自文档范围内排首位。正式模板和下载样例统一存放在 `knowledge/outlines/`，不得生成到仓库根目录；`templatePath` 与 `sampleDownloadPath` 是仓库内资源路径，`sampleDownloadName` 仅是用户下载文件名。示例下载副本通过 `tools/repository/generate-sql-outline-sample.js` 生成，原始 Excel 不修改。

生成 SQL 大纲下载样例前必须存在 `sampleSource` 指定的原始 Excel；缺失时脚本会返回包含实际路径和补救动作的明确错误，不会创建空样例或覆盖现有下载文件。

`config/knowledge-center/` 是面向运维的知识中心控制面，只保留三份英文命名的业务配置：

- `product.json`（产品配置）：产品身份、模块、工作台、能力清单和资源引用。
- `service.json`（服务配置）：服务、路径、日志、安全、模型、MCP 和 Agent 预设。默认模型为 `gpt-5.5`，并支持 DeepSeek。
- `content-rules.json`（内容规则）：资料加工、质量、同义词、特性和 GitLab 文档类型。
  其中 `gitlabVerificationErrors` 按稳定错误码维护 GitLab 验证失败的中文修复建议。数据库模式验证结果保存在 `runtime/knowledge-center/gitlab-verifications.json`；隔离运行可用 `KNOWLEDGE_CENTER_GITLAB_VERIFICATION_STORE` 指定独立运行时文件。
- `branding/default-icon.png`：登录页、favicon 和侧栏共用的默认品牌图标。

`service.json` 中 `documentPaths[].path` 的相对路径统一以仓库根目录解析，不以 `config/knowledge-center/` 或服务进程的启动目录解析。例如仓库位于 `/data/docs/AI高效应用示例/06-YashanDB知识库Skill仓库`时，`../../ai 体系认知` 指向 `/data/docs/ai 体系认知`。配置中保留相对路径，避免将开发机的绝对路径固化到仓库。

底层逻辑是依次回答“产品是什么、服务怎样运行、内容怎样处理”。根目录不得继续增加无法归入这三类的 JSON；持续变化的知识资产、GitLab 连接和模板库位于 `runtime/knowledge-center/`，不随配置发布包覆盖。

`.env.example` 只描述环境注入契约；本地 `.env` 可保存本机凭据但不得提交，生产密钥应由环境变量或密钥系统注入。对外访问地址通过 `KNOWLEDGE_CENTER_PUBLIC_BASE_URL` 统一配置，可使用完整的 IP URL（例如 `http://192.0.2.10:13510`）或域名 URL；平台地址、CAS service 和默认 GitLab OAuth 回调由它派生。

GitLab 审核发布使用 REST API 写入任务分支、提交和 MR，OAuth 应用及 `KNOWLEDGE_CENTER_GITLAB_OAUTH_SCOPES` 需包含 `api`；修改配置后，已有用户须重新连接 GitLab 账号才能取得新范围。`write_repository` 不能替代 REST API 写权限。

环境和内部端口使用统一前缀：`KNOWLEDGE_CENTER_ENV`、`KNOWLEDGE_CENTER_FRONTEND_PORT`、`KNOWLEDGE_CENTER_DOCUMENT_API_PORT`、`KNOWLEDGE_CENTER_PINGCODE_API_PORT`、`KNOWLEDGE_CENTER_INTERNAL_HOST` 和 `KNOWLEDGE_CENTER_PINGCODE_HOST`。旧 `KNOWLEDGE_CENTER_PUBLIC_HOST` 仅作一个兼容周期的输入，不应写入新配置。

`KNOWLEDGE_CENTER_ENV` 是环境名称的唯一外部配置项；运维入口会将其规范化为进程内的 `KNOWLEDGE_CENTER_ENVIRONMENT` 并显式传递给前端网关。项目安装器将 Playwright 浏览器制品放在 `runtime/browsers/playwright/`，已有环境也可保持 Playwright 默认缓存或用 `PLAYWRIGHT_BROWSERS_PATH` 显式覆盖。

认证配置由平台内核读取，生产平台不需要独立认证端口；`KNOWLEDGE_CENTER_AUTH_PORT/HOST` 仅为隔离运行 `apps/knowledge-center-auth/auth-server.js` 的兼容测试变量保留。
