# 平台基础模块文档

本模块保存跨业务模块复用的服务基础、配置、持久化和治理能力设计。周期性文档对账能力作为平台治理能力归档于此。

| 类型 | 文档 |
|---|---|
| 总体架构 | [知识中心建设平台通用化总体架构设计](./overview/知识中心建设平台通用化总体架构设计.md) |
| 配置设计 | [enterprise-profile/v1 配置与运行上下文设计](./development/enterprise-profile-v1配置与运行上下文设计.md) |
| 数据存储 | [YashanDB 数据存储与迁移开发设计](./development/yashandb-storage-and-migration-design.md) |
| 迁移报告 | [知识中心平台 YashanDB 存储迁移全景与验证测试报告](../../../../.codex/知识中心建设平台/05-测试报告/知识中心-平台-YashanDB存储迁移全景与验证-测试报告文档.md) |
| 机器契约 | [enterprise-profile/v1 Schema 与 fixture](../../../../contracts/enterprise-profile/v1/README.md) |
| 概要设计 | [文档治理与周期对账概要设计](./overview/document-governance-overview-design.md) |
| 开发设计 | [reconcile-docs Skill 开发设计](./development/reconcile-docs-skill-design.md) |
| 模块需求 | [REQ-DOC-RECONCILIATION](../../../../.codex/requirements/modules/platform-foundation/REQ-DOC-RECONCILIATION.md) |
| 计划与进度 | [实施计划](../../../../.codex/workflow/modules/platform-foundation/PLAN.md) · [开发进度](../../../../.codex/workflow/modules/platform-foundation/PROGRESS.md)（验证收口中） |
| 任务卡 | [reconcile-docs 任务](../../../../.codex/workflow/tasks/reconcile-docs/) |

YashanDB 存储服务代码位于 `agent-runner/services/yashandb-storage/`。现有 JSON 文件是迁移源，不再作为数据库目标设计；切换必须经过数量、内容摘要、事务与完整导出验证。
