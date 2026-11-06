# 平台管理后端模块

本目录承载平台管理页面对应的后端治理能力。模块内代码只能被平台管理路由或平台管理服务调用，不作为通用数据库基础设施。

## 当前能力

- `database-connection-governance.js`：YashanDB 连接配置的脱敏投影、JDBC 身份验证与固定 SQL 探测，以及对 `config/yashandb/service.env` 的原子读写和版本冲突控制。该文件是数据库连接的唯一事实源；密码不再复制到 JSON 或运行时配置文件。

数据库连接配置属于平台管理员维护的共享业务配置；数据库驱动、连接池、Schema 迁移和存储基础设施仍由 `database-config.js`、YashanDB Storage 服务及部署配置负责。平台管理模块不执行 SQL 迁移、不启动或停止数据库实例，也不承担通用数据库客户端职责。

页面验证成功后直接原子更新 `service.env`，启动脚本和 Storage 读取同一文件。已经运行的进程仍使用启动时环境变量，保存后必须重启；页面通过运行连接与文件连接的差异展示待重启状态。`configured` 只表示文件配置存在，不代表数据库真实可连；保存请求的真实 JDBC 探测成功时返回 `verified`，运行健康最终以 Storage 服务健康状态为准。


## MCP 服务治理

`mcp-governance.js` 为平台管理员提供共享 MCP 配置的脱敏读取、版本保护保存和未保存草稿的握手/工具发现。复用 `ConfigManager` 的 `config/knowledge-center/service.json#mcp` 与 AES-GCM，复用 `MCPClient`，不维护第二份连接。接口为 `/knowledge-center/api/platform/mcp`（GET/PUT）及 `/test`（POST）。规则限值来自 `content-rules.json#/platformMcp`。

API Key 和普通自定义请求头值不回显；搜索路由标头中的知识库 ID 会显示并可编辑，因为它是非敏感路由配置。普通标头留空保留，显式清除 Key、移除标头行才删除。修改服务地址时禁止隐式转移原凭据。`content-rules.json#/platformMcp/multiSearchHeaderName` 指定可重复的搜索路由标头，其多行值保存为 `search_knowledge_bases`，查询分别访问每个目标并合并去重；其他历史重复标头仍需移除重复行并重填保留值。测试不保存、不调用业务工具；保存不代表连接或业务调用已验证。新客户端读取新配置，既有实例不保证立即替换。同进程排队加乐观版本不能代替跨进程事务。

## AI 写作模型治理

`model-governance.js` 维护 `service.json#/model.services` 与默认选择，复用 ConfigManager 加密和 LLMClient。管理员 GET/PUT `/knowledge-center/api/platform/models`、POST `/test`；作者 GET `/knowledge-center/api/production/models` 仅返回启用且密钥可读的模型。保存需要 If-Match；新行提供 clientId、旧行提供 id；版本冲突409。地址/服务商/协议变化需重填或清除密钥。写作任务启动时解析并固定配置，任务和草稿仅记录脱敏选择、配置版本与上游实际模型。支持 Chat Completions 与 Responses 的非流式生成；保存后新任务生效。旧无 services 配置投影为单个默认服务。
`agent-governance.js` 的默认模型选择取自同次可用目录，包含模型与 Agent 配置版本，可直接用于执行解析；默认项不可用时返回空值，由调用方明确提示配置缺失。模板映射的普通 JSON 和 Codex markdown 信封由统一解析器转换为相同建议结构。
