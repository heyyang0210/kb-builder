# 知识图谱可观测性与治理模块文档

本模块负责将质量分析页的图谱展示升级为可观察、可诊断、可取证、可追溯的知识质量治理能力。

## 开发设计

| 文档 | 范围 |
|---|---|
| [REQ-29 质量概览与局部可视化](./development/01-quality-overview-local-graph-design.md) | 概览契约、局部图渲染、配置与测试 |
| [REQ-30 问题诊断与证据联动](./development/02-problem-diagnosis-evidence-linkage-design.md) | 稳定投影、全局搜索、三栏联动和 URL 恢复 |
| [REQ-31 版本治理与质量运营](./development/03-version-governance-quality-operations-design.md) | 不可变版本、diff、趋势和发布检查 |
| [REQ-32 证据原文下钻](./development/04-evidence-source-drilldown-design.md) | 来源解析、原文定位、缺失诊断和人工核验 |

## RAG 治理与 M2 安全发布

| 文档 | 范围 |
|---|---|
| [状态、API 与错误契约](./development/06-state-api-error-contract.md) | 治理状态机、历史兼容和发布错误 |
| [Lineage 与证据回放契约](./development/07-lineage-replay-contract.md) | 稳定 ID、快照、哈希和证据回放 |
| [ACL 与审计契约](./development/08-acl-inheritance-contract.md) | 默认拒绝、权限继承和安全审计 |
| [M2 设计决策](./development/14-m2-safe-publish-decisions.md) | 已选方案、执行边界和待确认项 |
| [M2 架构设计](./development/15-m2-safe-publish-architecture.md) | 组件、信任边界、发布时序和降级规则 |
| [M2 详细设计](./development/16-m2-safe-publish-detailed-design.md) | 接口、Schema、伪代码、文件归属和验收矩阵 |
| [M2 生产 Lineage 接线设计](./development/17-m2-production-lineage-integration.md) | 生产字段映射、规范化快照、原子治理包、门禁时点和接线测试矩阵 |
| [M2 身份与 ACL 决策提案](./development/18-m2-identity-acl-decision-proposal.md) | 身份来源、ACL 粒度、审计策略候选方案和 G2-03 人工确认项 |
| [M2 生产可发布就绪审查](./development/19-m2-production-readiness-review.md) | 生产样本证据、P0/P1/P2 风险、1A..6A 决策门、实施/回滚顺序和完成声明边界 |
| [M2 供应商错误信封输入边界设计](./development/20-m2-provider-error-envelope-boundary-design.md) | preparation 前置检测器、版本化配置、质量问题、性能边界、伪代码和回滚策略 |
| [GraphStore Adapter 架构设计](./development/21-graph-store-adapter-architecture.md) | 不可变事实源、厂商无关端口、异步投影、查询与安全边界和迁移路线 |
| [GraphStore Adapter 详细设计](./development/22-graph-store-adapter-detailed-design.md) | canonical Schema、接口 DTO、状态机、outbox、恢复伪代码和 legacy 兼容 |

## 测试与验收

| 文档 | 范围 |
|---|---|
| [M2 发布契约与 Lineage 回放测试报告](./testing/01-m2-contract-lineage-test-report.md) | 51/51 合并回归、真实图版本 API、前端 helper 和注入式回放 |
| [M2 安全可发布基础部分验收记录](./testing/02-m2-partial-acceptance.md) | RG-17—25 状态、完成边界、G2.5 阻断和安全确认点 |
| [M2 生产 Lineage 接线测试设计](./testing/03-m2-production-lineage-integration-test-design.md) | 生产重复来源、历史 evidence、路径完整性、权威目录、恢复与真实 API 验收矩阵 |
| [GraphStore Adapter 测试设计](./testing/04-graph-store-adapter-test-design.md) | Adapter 契约、幂等并发、ACL、迁移、故障恢复和性能测试矩阵 |

## 代码边界

- 后端：`scripts/pingcode/web/backend/app/` 的图谱投影、可观测读模型、版本仓储和 API 接线。
- 前端：`scripts/pingcode/web/frontend/src/` 的 `QualityPage.vue`、`KnowledgeGraphPage.vue` 和共享局部图组件。
- 事实源：已提交图谱节点、关系和证据引用；诊断查询不修改事实产物。

产品需求见 `.codex/requirements/modules/knowledge-graph-governance/`，动态进展见 `.codex/workflow/modules/知识图谱可观测性与治理模块优化进展.md`。
