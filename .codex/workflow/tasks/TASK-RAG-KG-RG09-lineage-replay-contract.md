# TASK-RAG-KG-RG09：全链路 lineage 与证据回放契约

## 元信息
- 状态: review
- 分配: backend-worker + doc-writer
- 计划窗口: 2026-08-19（不超过 4h）
- 依赖: G1；REQ-KGO-33；RG-03
- 文件归属: `agent-runner/docs/modules/knowledge-graph-governance/development/07-lineage-replay-contract.md`、本任务卡
- 并行: 可与 RG-08、RG-10—RG-13 并行；RG-14 依赖本卡
- 需人类确认: G2 前确认事实源目录、哈希算法和保留周期

## 目标与范围
冻结 `source → chunk → evidence → graph → index → answer` 的不可变 Schema、稳定 ID、父子引用、内容哈希和版本边界，给出从 citation 回放原文的伪代码。JSON/JSONL 是事实源，图数据库仅异步投影。

## 交付与验收
- [x] 定义 source/chunk/evidence/node/edge/index/citation 的字段、主键和哈希输入。
- [x] 同一内容重跑产生稳定 ID；内容变化产生新版本且旧版本不可变。
- [x] 设计缺失、损坏、偏移越界和文件删除时的可审计失败分类。
- [x] 提供 citation → evidence → source 的回放伪代码和快照校验。
- [x] 测试矩阵覆盖重建前后文本、偏移和哈希一致，以及失效引用不静默漂移。

## 未决项
哈希算法（SHA-256 等）、原文快照保留期、Office/PDF 页码映射是否纳入首版由 G2 确认；未确认时采用现有文件快照能力并标注限制。详见 [07-lineage-replay-contract.md](../../../agent-runner/docs/modules/knowledge-graph-governance/development/07-lineage-replay-contract.md)。
