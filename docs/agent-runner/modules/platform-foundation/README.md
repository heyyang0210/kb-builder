# 平台基础模块文档

本模块保存跨业务模块复用的服务基础、配置、持久化和治理能力设计。周期性文档对账能力作为平台治理能力归档于此。

| 类型 | 文档 |
|---|---|
| 总体架构 | [知识中心建设平台通用化总体架构设计](./overview/知识中心建设平台通用化总体架构设计.md) |
| 重构执行 | [知识中心管理平台目标模式重构执行提示词](./overview/知识中心管理平台目标模式重构执行提示词.md)（含 14 维架构头脑风暴清单） |
| P0 基线 | [知识中心管理平台 P0 事实基线](./baseline/p0-capability-baseline.md) · [机器可读基线](./baseline/p0-capability-baseline.json) |
| 迁移预演 | [文件源迁移预演摘要](./baseline/p0-migration-dry-run.json) |
| P1 契约 | [知识中心统一接口契约 v1](../../../../packages/platform-contracts/knowledge-center/v1/README.md) · [资料加工端点映射](../../../../packages/platform-contracts/knowledge-center/v1/endpoint-mapping.json) · [FastAPI 字段契约](../../../../packages/platform-contracts/knowledge-center/v1/openapi.json) |
| 运行时契约 | `packages/agent-runner-core/lib/knowledge-center-runtime-contract.js` · `tools/knowledge-processing/generate-knowledge-center-endpoint-mapping.js` · SSE/文件透传关联头与处置契约（SSE 支持 `lastEventId` 与 `Last-Event-ID` 续接） |
| 配置设计 | [enterprise-profile/v1 配置与运行上下文设计](./development/enterprise-profile-v1配置与运行上下文设计.md) |
| 数据存储 | [YashanDB 数据存储与迁移开发设计](./development/yashandb-storage-and-migration-design.md) |
| 迁移报告 | [知识中心平台 YashanDB 存储迁移全景与验证测试报告](../../../../.codex/知识中心建设平台/05-测试报告/知识中心-平台-YashanDB存储迁移全景与验证-测试报告文档.md) |
| 机器契约 | [enterprise-profile/v1 Schema 与 fixture](../../../../packages/platform-contracts/enterprise-profile/v1/README.md) |
| 概要设计 | [文档治理与周期对账概要设计](./overview/document-governance-overview-design.md) |
| 开发设计 | [reconcile-docs Skill 开发设计](./development/reconcile-docs-skill-design.md) |
| 模块需求 | [REQ-DOC-RECONCILIATION](../../../../.codex/requirements/modules/platform-foundation/REQ-DOC-RECONCILIATION.md) |
| 计划与进度 | [实施计划](../../../../.codex/workflow/modules/platform-foundation/PLAN.md) · [开发进度](../../../../.codex/workflow/modules/platform-foundation/PROGRESS.md)（验证收口中） |
| 任务卡 | [reconcile-docs 任务](../../../../.codex/workflow/tasks/reconcile-docs/) |

YashanDB 存储服务代码位于 `apps/yashandb-storage/`。数据库连接配置唯一入口为 `config/database/yashandb.env`，优先级为显式参数、环境变量、配置文件和安全默认值；密码仅通过外部环境或密钥系统注入。配置结构与安全约束由配置测试门禁维护。现有 JSON 文件是迁移源，不再作为数据库目标设计；迁移源元数据不得清空，终态任务不得继续占用活动任务列表，生产 MCP 地址不得被本地默认值覆盖。
### 管理页面布局统一

知识中心各模块共享接近全宽的主内容容器（与“审核与发布”一致），统一页面边距、标题层级和状态视觉；审核页保留任务列表、步骤导航及审核依据等业务专属结构。全局左侧导航的收缩状态只由用户操作决定，不因切换模块自动改变。桌面端保留导航，窄屏使用统一抽屉行为。
