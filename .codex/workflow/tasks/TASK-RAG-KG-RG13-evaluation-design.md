# TASK-RAG-KG-RG13：100 条评测集、标注规范与指标

## 元信息
- 状态: review
- 分配: test-engineer + domain-reviewer
- 计划窗口: 2026-08-20（不超过 4h）
- 依赖: RG-06；REQ-KGO-33
- 文件归属: `agent-runner/docs/modules/knowledge-graph-governance/development/11-evaluation-matrix.md`、本任务卡
- 并行: 可与 RG-08—RG-12 并行；RG-14 依赖本卡
- 需人类确认: 领域标注人、问题分层比例和 G3 指标阈值需确认

## 目标与范围
设计可复现的 100 条问题评测集：事实查找、关系、多跳、版本/时效、不可回答和权限边界分层；定义标准证据、可答/拒答、版本范围和指标公式。

## 交付与验收
- [x] 给出分层抽样、数据集版本、匿名化和四路标注流程。
- [x] 定义 Recall@K、MRR/NDCG、context precision/recall、citation correctness、faithfulness、abstention 公式。
- [x] 明确标注一致性、仲裁、难例和泄露防护规则。
- [x] 给出机器可读记录 Schema 与可复现报告模板。
- [x] 测试矩阵包含指标边界、空集合、拒答和 ACL 样例。

设计证据：`agent-runner/docs/modules/knowledge-graph-governance/development/11-evaluation-matrix.md`

## 未决项
100 条问题的领域覆盖比例、标注者数量、指标阈值和 P0/P1 门禁映射交由 G2/G3 确认；未确认只输出设计基线。
