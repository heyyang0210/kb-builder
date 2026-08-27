# RAG 知识库治理项目经理任务清单

> 管理角色：Project Manager
>
> 需求基线：`REQ-KGO-33`
>
> 计划基线：`TASK-RAG-KG-ROADMAP-01`
>
> 当前状态：`blocked_m2`（G-LIN-01、G-LIN-02/2A+2C、请求时冻结、API-A、生产出口治理包 helper 和发布重验已完成；API-A 7/7、发布重验 5/5；1k/8k 有界批执行已实现但内存门禁仍有元数据增长证据；真实训练出口/回放、G-LIN-04 和 ACL 接入尚未完成；RG-20/23 等待可信网关外部参数与隔离身份，G2.5 未通过）
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
| M2 安全可发布基础 | RG-16—RG-25 | 2026-08-28 | `blocked` | 状态不可越级、ACL 默认拒绝、证据可回放 |
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

### M2 当前执行状态

| ID | 任务 | 状态 | 证据 | 阻塞 |
|---|---|---|---|---|
| RG-16 | 治理状态机与公共 API 接入 | `completed` | [TASK-RAG-KG-RG16](../../tasks/TASK-RAG-KG-RG16-state-machine-implementation.md)；合并回归 100/100 | RG-20 前治理 ACL 默认拒绝 |
| RG-17 | Lineage Manifest 指纹与稳定引用 | `completed` | [RG-17 任务卡](../../tasks/TASK-RAG-KG-RG17-lineage-manifest.md)；manifest/回放自动化及生产出口 helper 通过 | 真实训练批次回放仍待 INT-04 |
| RG-18 | 发布前置检查与结构化阻断 | `completed` | [RG-18 任务卡](../../tasks/TASK-RAG-KG-RG18-publish-gate.md)；P0/CAS/越级真实 API 契约通过 | 真实授权结果依赖 RG-20 |
| RG-19 | 图与索引版本指纹 | `completed` | [RG-19 任务卡](../../tasks/TASK-RAG-KG-RG19-version-fingerprint.md)；确定性、漂移和发布重验通过 | 真实训练批次回放仍待 INT-04 |
| RG-20 | ACL 过滤与安全审计接入 | `blocked` | [RG-20 任务卡](../../tasks/TASK-RAG-KG-RG20-acl-enforcement.md) | 待确认可信身份源、ACL 粒度/冲突规则、审计留存与脱敏 |
| RG-21 | 治理状态与发布阻断前端 | `completed` | [RG-21 任务卡](../../tasks/TASK-RAG-KG-RG21-governance-ui.md)；Node helper 契约和 Vite build 通过 | 无；真实授权交互归 RG-20/23 |
| RG-22 | 状态、发布与前后端契约回归 | `completed` | [RG-22 任务卡](../../tasks/TASK-RAG-KG-RG22-contract-regression.md)；M2 合并回归 51/51 | 真实 ACL 路径不在本任务完成范围 |
| RG-23 | ACL 越权回归 | `blocked` | [RG-23 任务卡](../../tasks/TASK-RAG-KG-RG23-security-regression.md) | 依赖 RG-20 及隔离测试身份/数据集 |
| RG-24 | Lineage 重建与证据回放回归 | `completed` | [RG-24 任务卡](../../tasks/TASK-RAG-KG-RG24-lineage-replay-regression.md)；注入式回放及图版本 API 1/1 | 未完成生产 citation/ACL 端到端接线 |
| RG-25 | M2 G2.5 验收与证据汇总 | `blocked` | [M2 部分验收记录](../../../../agent-runner/docs/modules/knowledge-graph-governance/testing/02-m2-partial-acceptance.md) | RG-20/23 未完成，G2.5 未通过 |
| M2-LIN-REWORK | 生产 Lineage 接线修订 | `in_progress` | [修订任务卡](../../tasks/TASK-RAG-KG-M2-LINEAGE-REWORK-01.md)；[生产出口接线](../../tasks/TASK-RAG-KG-M2-LINEAGE-INT-02.md)；[发布重验](../../tasks/TASK-RAG-KG-M2-LINEAGE-INT-03.md)；[API-A 验收](../../tasks/TASK-RAG-KG-M2-LIN-2C-API-ACC-01.md)；API 7/7、治理包 fixture 1/1、发布重验 5/5 通过 | 性能内存门禁、真实训练出口/回放、G-LIN-04、错误信封隔离和 C/D 组仍阻塞；ACL 外部参数未提供，未迁移物理路径 |

### M8 GraphStore 本地前置阶段

M8 整体仍为 `deferred/blocked`，以下状态仅表示本地兼容层与异步投影内核的阶段性进展，不表示 GraphRAG、公共 API 或外部图数据库已完成。

| ID | 任务 | 状态 | 验收证据/阻塞 |
|---|---|---|---|
| GS-DES-01 | GraphStore 架构、接口、伪代码与测试矩阵 | `completed` | 架构与详细设计文档已完成 |
| GS-TST-01 | GraphStore/Local 契约测试 | `completed` | 契约与 Local 联合验证 12 passed |
| GS-CONTRACT-BE-01 | 存储无关规范模型与接口 | `completed` | 原环境限制已由 `uv` 联合验证覆盖 |
| GS-LOCAL-BE-01 | LocalGraphStore | `completed` | 契约、幂等、版本隔离和失效语义通过 |
| GS-WRITE-TST-01 | 投影状态与故障契约测试 | `completed` | 投影 worker 新增验证 16 passed |
| GS-WRITE-BE-01 | write-run/outbox 与投影执行器 | `completed` | 持久化状态和异步投影内核已完成 |
| GS-API-TST-01 | 真实 API 红灯矩阵 | `blocked` | 依赖 RG-20/23、G2.5、可信身份参数和隔离测试身份 |
| GS-API-BE-01 | 正式版本查询/投影 API 接线 | `blocked` | 依赖 GS-API-TST-01；未修改公共 API |
| GS-ACC-01 | 真实 FastAPI 与隔离 formal 验收 | `blocked` | 缺隔离 formal 数据集及写入许可 |
| GS-RPT-01 | 整体验收证据与下阶段汇总 | `blocked` | 依赖 GS-ACC-01；本次仅做阶段性 Reporter 同步 |

本地前置阶段共 6/10 项完成、4/10 项阻塞。最终联合回归 42/42 通过，覆盖 contract、LocalGraphStore、projection、integration 和 GraphVersion API；独立验收曾发现 5 个 P0，修复后通过 9 项组合测试，`py_compile` 与 scoped diff-check 均通过。外部 Adapter、驱动、部署、凭据、容量、备份和生产写权限仍需 G1/G4 审批。

### M2 当前决策门

| 决策 | 已选方案 | 项目经理动作 |
|---|---|---|
| 默认方案治理 | **已确认常设授权（2026-08-19）**：后续存在待确认候选方案时，默认采用有证据支持的推荐方案 | 每次实施前记录候选、推荐依据、最终选择、日期、风险、回滚条件和适用边界；不得虚构 issuer、地址、凭据、容量等外部事实，也不得把方案选择等同于生产写入、发布或删除授权 |
| G-LIN-01 Source identity | **已确认 1A，组件实现完成**：新写使用规范三元组哈希 Source ID，Schema `2.0` 新写、`1.0` 仅读/回放；歧义 v1 保持发布阻断 | PL-B01—B06 已通过；不得将组件绿色解释为生产接线完成，不得顺带迁移物理存储路径 |
| G-LIN-02 历史 extractor 版本 | **已确认 `2A+2C`；2A 与 2C 内核已实现**：新产物显式持久化已提交规则快照和版本引用；legacy 仅从同 run 可证明快照恢复，无法证明则隔离；2C 内核从冻结 dataset 创建独立新 run，并以 `rebuildKey`/CAS 合并并发 | 目标历史数据基线为 `0` 恢复/`55,324` 隔离；公共 API 和真实批次验收前不宣称业务数据已恢复 |
| G-LIN-02-API 2C 公共触发 | **已按常设授权选择 API-A**：保持字段不变，将 `keyword_analysis + sourceDatasetId` 定义为从指定 dataset 冻结输入重建 | 接入前同步公共契约和兼容测试；不读共享 `latest`，不回写旧产物，兼容异常时关闭该触发语义 |
| G-LIN-03 治理包权威目录 | **已按常设授权选择 3A**：dataset `governance/` 为唯一发布权威，training run 为可重建审计镜像 | 不执行两次 rename 伪装成跨目录事务；按 fingerprint 幂等恢复并补充崩溃恢复测试 |
| G-LIN-04 模式与偏移 | **已按常设授权选择 4A**：强制 keyword/formal 不变量，`offsetUnit=unicode_code_point` | 不接受任意 model/graphSource 或未声明偏移单位的产物；补充非 BMP 字符和跨端回放测试 |
| G2-03 身份与 ACL | **已按常设授权选择推荐架构**：可信网关 JWT、本地验签、dataset ACL、deny 优先和脱敏审计 | issuer、audience、JWKS URI、claims 和隔离身份属于待提供外部事实；参数不齐时 RG-20/23 保持 fail-closed，不安装未批准依赖 |

G-LIN-01、G-LIN-02/2A+2C、请求时冻结、API-A、生产出口 helper 和发布重验已完成；API-A 7/7、治理包 fixture 1/1、发布重验 5/5 通过。性能内存门禁、真实训练出口/回放、G-LIN-04 和错误信封隔离仍未完成，物理路径也未迁移。G2-03 推荐架构已按常设授权落定；JWT 外部事实、依赖安装及真实隔离写入许可仍按各自边界处理。任何组件测试绿色都不能替代生产快照回放和越权成功数为零的证据。

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
