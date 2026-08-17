# RAG 知识库治理项目经理任务清单

> 管理角色：Project Manager
>
> 需求基线：`REQ-KGO-33`
>
> 计划基线：`TASK-RAG-KG-ROADMAP-01`
>
> 当前状态：`in_progress_g1`（G0 决策已确认；ACL 缺口仍是实现前 P0，等待 G1/G2 设计与修复）
>
> 更新规则：只有有验收证据时才可将任务标记为 `completed`；设计任务必须有设计文档、接口、伪代码和测试矩阵；实现任务必须有真实后端 API 或对应的自动化验收。

## 1. 状态定义

| 状态 | 含义 |
|---|---|
| `pending` | 尚未开始，依赖或进入条件未满足 |
| `ready` | DoR 已满足，可以分配给 Worker |
| `in_progress` | 已分配并正在执行 |
| `blocked` | 被确认、依赖、环境或缺陷阻塞 |
| `review` | 实现已完成，等待架构、产品或测试验收 |
| `completed` | DoD 和验收证据齐全 |
| `deferred` | 经变更评审后移出当前范围 |

## 2. 项目总览

| 阶段 | 任务范围 | 目标日期 | 当前状态 | 项目经理出口条件 |
|---|---|---:|---|---|
| M0 事实与决策 | RG-00—RG-07 | 2026-08-18 | `completed` | 七项 G0 决策有书面记录，厂商/部署等实施项保留到 G1/G4 |
| M1 契约与测试设计 | RG-08—RG-15 | 2026-08-21 | `review` | 设计、接口、伪代码、验收矩阵已齐，等待 Product/Architect/Test G2 签核 |
| M2 安全可发布基础 | RG-16—RG-25 | 2026-08-28 | `pending` | 状态不可越级、ACL 默认拒绝、证据可回放 |
| M3 语义与检索闭环 | RG-26—RG-36 | 2026-09-08 | `pending` | 20 条垂直样例全部可追溯或结构化拒答 |
| M4/M5 评测与发布 | RG-37A—RG-44 | 2026-09-18 | `pending` | 100 条评测集、发布门禁、隔离发布和回滚完成 |
| M6 P1 硬化 | RG-45—RG-54 | 2026-10-02 | `pending` | 消歧、时效、增量、完整性和 S/M/L 性能验收完成 |
| M7 P2 验证 | RG-55—RG-60 | 2026-10-16 | `deferred` | 仅在 G5 后决定立项、延期或放弃 |
| M8 图数据库与平台基础设施 | RG-61—RG-72 | G1 后顺延 10 个工作日 | `deferred` | 选型、部署、权限、性能和回滚门禁通过 |

## 3. M0：事实与决策

| ID | 任务 | 负责人 | 状态 | 依赖 | 交付/验收证据 |
|---|---|---|---|---|---|
| RG-00 | 将本次 RAG 缺口固定为 REQ-KGO-33，保留 REQ-KGO-32 原语义 | Planner/Doc | `completed` | 无 | 编号映射已同步 |
| RG-01 | 核验目标批次和正式知识样本产物统计 | Test Engineer | `completed` | 无 | [RG01 事实核验](../../tasks/TASK-RAG-KG-RG01-fact-check.md)；发现小批次 knowledge=0 仍 publishable=true |
| RG-02 | 执行数据集、证据和图查询 ACL 只读矩阵 | Security/Test | `blocked` | 无 | [RG02 ACL 核验](../../tasks/TASK-RAG-KG-RG02-acl-audit.md)；图谱/文件入口缺少统一鉴权，P0 风险 |
| RG-03 | 冻结正式图谱最小形态、状态和模型策略 | Product/Architect | `completed` | RG-01；G0 | Entity/Relation 才可发布；规则优先、模型仅候选 |
| RG-04 | 完成存储和检索基础设施 ADR 对比 | Architect | `completed` | RG-01 | [Graph/Vector Store ADR](../../../../agent-runner/docs/modules/knowledge-graph-governance/development/05-graph-vector-store-selection-adr.md)；仅完成选型，不引入依赖 |
| RG-05 | 冻结 ACL、跨数据集边界和越权处置 | Product/Security | `completed` | RG-02；G0 | 默认拒绝、继承数据集权限、默认禁止跨数据集 |
| RG-06 | 冻结门禁语义、评测规模和 S/M/L 基线 | Product/Test | `completed` | RG-01；G0 | P0 阻断/P1-P2 告警；1k/10k/100k 文档、5k/50k/500k chunks |
| RG-07 | 汇总 RG-03—06 审批结果，进入 G1 | Architect/Product | `completed` | RG-03—06 | G0 已完成；G1 保留厂商、部署和外部依赖审批 |

## 4. M1：契约与测试设计

| ID | 任务 | 负责人 | 状态 | 依赖 | 交付/验收证据 |
|---|---|---|---|---|---|
| RG-08 | 状态机、API 字段、错误码和伪代码 | Backend/Doc | `review` | G1 | [状态/API/错误契约](../../../../agent-runner/docs/modules/knowledge-graph-governance/development/06-state-api-error-contract.md)；待 G2 确认兼容映射和投影门禁 |
| RG-09 | source→chunk→evidence→graph→index→answer lineage | Backend/Doc | `review` | G1 | [Lineage/回放契约](../../../../agent-runner/docs/modules/knowledge-graph-governance/development/07-lineage-replay-contract.md)；待 G2 确认哈希、保留期和格式定位 |
| RG-10 | ACL 继承矩阵、默认拒绝规则和审计事件 | Security/Backend | `review` | RG-05 | [ACL/审计契约](../../../../agent-runner/docs/modules/knowledge-graph-governance/development/08-acl-inheritance-contract.md)；待安全确认身份、粒度和审计存储 |
| RG-11 | 最小 Ontology、canonical ID、关系和失败隔离 | Architect/Domain | `review` | RG-03 | [Ontology Schema](../../../../agent-runner/docs/modules/knowledge-graph-governance/development/09-minimal-ontology.md)；待领域确认类型和关系 |
| RG-12 | sparse/dense/rerank/context/citation 检索接口 | Architect/Backend | `review` | RG-04/G1 | [混合检索契约](../../../../agent-runner/docs/modules/knowledge-graph-governance/development/10-hybrid-retrieval-contract.md)；dense/reranker 保持 disabled |
| RG-13 | 100 条评测集、标注规范和指标公式 | Test/Domain | `review` | RG-06 | [评测设计](../../../../agent-runner/docs/modules/knowledge-graph-governance/development/11-evaluation-matrix.md)；阈值待 G3 |
| RG-14 | 六类验收矩阵 | Test Engineer | `review` | RG-08—13 | [M1 验收矩阵](../../../../agent-runner/docs/modules/knowledge-graph-governance/development/12-m1-acceptance-matrix.md) |
| RG-15 | G2 设计评审 | Architect/Product/Test | `review` | RG-08—14 | [G2 评审记录](../../../../agent-runner/docs/modules/knowledge-graph-governance/development/13-g2-design-review.md)；待联合签核 |

## 5. M2—M7 执行清单

完整原子任务的范围、日期和依赖以 `TASK-RAG-KG-ROADMAP-01` 为准。项目经理每次周报至少更新以下状态组：

| 状态组 | 任务 | 负责人 | 当前出口 |
|---|---|---|---|
| M2 安全基础 | RG-16—RG-25 | Backend A/B、Frontend、Test、Reporter | G2.5：错误发布、越权、证据不可回放均为 0 |
| M3 语义检索 | RG-26—RG-36 | Backend A/B、Test | 20/20 垂直样例通过 |
| M4/M5 发布 | RG-37A—RG-44 | Domain、Test、Backend、Frontend、Reporter | 100 条评测、隔离发布、回滚完成 |
| M6 P1 硬化 | RG-45—RG-54 | Backend、Test、Architect | P1 回归和 S/M/L 报告完成 |
| M7 P2 验证 | RG-55—RG-60 | Product、Architect、Test | G5 决定是否建立新需求 |
| M8 图数据库与平台基础 | RG-61—RG-72 | Architect、Backend、Test、Project Manager | 图数据库适配、回填、查询、故障和 docs/09 前置能力通过 G4；未批准保持 disabled |

## 6. 门禁与项目经理动作

| 门禁 | 进入条件 | 项目经理动作 | 未通过处置 |
|---|---|---|---|
| G0 | 用户目标、事实样本、范围和成功指标明确 | 组织产品/安全确认 | 只做只读核验，不进入实现 |
| G1 | 设计、接口、伪代码和测试方案齐备 | 组织架构评审并冻结文件归属 | 退回设计，不改代码 |
| G2 | 任务 DoR 满足且无未批准架构变更 | 分配 Worker 并记录文件范围 | 任务保持 `blocked` |
| G3 | 实现、设计和说明同步，测试环境可用 | 组织真实 API 和回归验收 | 修复后重验，不降低标准 |
| G4 | P0 证据、风险和回滚齐全 | 提交 Product Owner go/no-go | 不发布，保留候选版本 |
| G5 | P2 价值验证报告完成 | 新建或关闭后续需求 | 不将实验代码接入生产 |

## 7. RACI

| 工作 | Product Owner | Project Manager | Architect | Backend/Frontend | Test | Doc/Reporter |
|---|---|---|---|---|---|---|
| 范围和优先级 | A | R | C | I | I | I |
| 架构和公共契约 | A（受限决策） | C | R | C | C | I |
| 任务实施 | I | A | C | R | C | C |
| 真实 API 验收 | I | A | C | C | R | I |
| 文档与状态同步 | I | A | C | C | C | R |

## 8. 风险和变更登记入口

每个风险必须记录：`riskId`、概率、影响、触发条件、责任人、缓解动作、应急动作、状态和下次检查日期。

以下事项自动触发变更评审：新增外部依赖、修改公共 API、改变模型调用策略、放宽 ACL、改变发布门禁、扩大多模态范围、突破性能预算。

变更未经 Product Owner 和 Architect 审批，不得进入当前里程碑；项目经理需同步更新本清单、路线图、REQ-KGO-33、RISKS.md 和 NEXT.md。

## 9. 周期更新模板

```markdown
### 周期：YYYY-MM-DD
- 本周期完成：RG-xxx（证据链接）
- 进行中：RG-xxx，预计完成：YYYY-MM-DD
- 阻塞：RG-xxx，阻塞原因：，责任人：，解决日期：
- 关键路径偏差：无/说明
- 新增风险：RISK-xxx
- 待审批：Gx，决策人：，最晚日期：
- 下周期计划：RG-xxx、RG-xxx
```
