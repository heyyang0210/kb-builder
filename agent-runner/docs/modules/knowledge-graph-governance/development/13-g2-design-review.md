# G2 契约设计评审记录

```yaml
documentType: design-review
moduleId: knowledge-graph-governance
relatedTasks: [RG-08, RG-09, RG-10, RG-11, RG-12, RG-13, RG-14]
status: pending-product-architect-test-signoff
decisionGate: G2
```

## 1. 评审结论

| 任务 | 结论 | 依据 | 后续动作 |
|---|---|---|---|
| RG-08 状态/API/错误 | accepted-with-open-decisions | 06-state-api-error-contract.md | G2 确认兼容映射、字段扩展和图投影告警 |
| RG-09 lineage/回放 | accepted-with-open-decisions | 07-lineage-replay-contract.md | G2 确认哈希、保留期和格式定位 |
| RG-10 ACL | accepted-with-open-security-decisions | 08-acl-inheritance-contract.md | G2/Security 确认身份来源、ACL 粒度、审计留存 |
| RG-11 Ontology | accepted-with-open-domain-decisions | 09-minimal-ontology.md | 领域负责人确认实体/关系集合和版本格式 |
| RG-12 检索 | accepted-with-disabled-adapters | 10-hybrid-retrieval-contract.md | dense/reranker/向量库保持 disabled，先实现 sparse 契约 |
| RG-13 评测 | accepted-with-g3-thresholds-open | 11-evaluation-matrix.md | G3 确认指标阈值和门禁映射 |
| RG-14 验收矩阵 | accepted | 12-m1-acceptance-matrix.md | 按矩阵进入实现前测试准备 |

## 2. 一致性检查

- 状态机的 `published` 仅由质量、ACL、证据和评测门禁驱动；图数据库异步投影失败不破坏事实源。
- Lineage 中所有 citation 必须携带 dataset/version/ACL 过滤所需字段；检索和图查询不得绕过回放契约。
- Ontology 的单记录隔离与状态机的批次失败边界一致：清单不可验证才终止批次。
- 检索契约采用 sparse-only 确定性基线；dense、reranker、专用向量库未批准时不进入主链路。
- 评测报告引用稳定版本和证据 ID，不把 `keyword_analysis` 回退图谱当作正式知识。

## 3. 实施准入

允许进入 RG-16—RG-25 的范围：状态不变量、事实源/lineage、ACL 过滤与审计、Schema 校验、sparse 检索接口、评测记录和隔离测试框架。

暂不允许：新增图数据库/向量库/模型 Provider，放宽跨数据集 ACL，改变现有公共 API 的破坏性语义，把模型设为默认抽取路径，或在未确认阈值前标记生产发布。

## 4. 必须确认的事项

| 编号 | 决策 | 默认建议 | 确认门禁 |
|---|---|---|---|
| G2-01 | 旧训练状态与治理状态兼容及 API 字段扩展 | 只增字段、旧字段继续可读 | Product/Architect |
| G2-02 | 哈希、快照保留和 Office/PDF 定位 | SHA-256、保留期配置化、定位能力分阶段 | Architect/Domain |
| G2-03 | 身份来源、ACL 粒度和审计保留 | 复用现有身份；dataset→resource 继承；审计脱敏 | Security |
| G2-04 | 首版 Ontology 领域类型和版本格式 | 采用设计文档基线，领域确认后冻结 | Domain |
| G3-01 | 评测指标阈值与 P0/P1 映射 | 先报告后门禁，G3 再冻结 | Product/Test |
| G4-01 | 真实 API 环境、隔离数据集和性能配额 | 生产只读，隔离写入，S/M/L 专用环境 | Product/Operations |

## 5. 评审状态

在上述签字完成前，本记录保持 `pending-product-architect-test-signoff`，RG-16 可以继续做不改变公共契约的实现设计，但不得宣称 G2 已通过或执行生产写入。
