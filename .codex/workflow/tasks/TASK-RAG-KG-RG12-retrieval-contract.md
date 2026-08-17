# TASK-RAG-KG-RG12：混合检索与引用接口契约

## 元信息
- 状态: review
- 分配: architect + backend-worker
- 计划窗口: 2026-08-20（不超过 4h）
- 依赖: RG-04；G1；REQ-KGO-33
- 文件归属: `agent-runner/docs/modules/knowledge-graph-governance/development/10-hybrid-retrieval-contract.md`、本任务卡
- 并行: 可与 RG-08—RG-11/13 并行；RG-14 依赖本卡
- 需人类确认: G1/G2 确认 dense/reranker 外部依赖；未批准保持 disabled 和确定性基线

## 目标与范围
定义 sparse、dense、rerank、context budget、citation、abstain 的厂商无关接口和适配器边界。查询必须先做 dataset/version/ACL 过滤，结果携带证据和版本指纹，证据不足结构化拒答。

## 交付与验收
- [x] 定义 Query、Filter、Candidate、RankedContext、Citation、AbstainReason Schema。
- [x] 规定候选合并、去重、top-k、超时、禁用适配器和稳定排序规则。
- [x] 明确 GraphStore/VectorStore/倒排适配器不改变事实源和发布语义。
- [x] 提供查询流程伪代码：授权→过滤→召回→重排→上下文→引用/拒答。
- [x] 测试矩阵覆盖无结果、ACL 过滤、适配器超时、重复候选、证据阈值。

## 未决项
dense 模型、reranker、向量库和 top-k/阈值的具体配置需 G1/G2 审批；未批准时只定义接口和本地 sparse 基线。

## 设计证据

- [混合检索与引用接口契约](../../../../agent-runner/docs/modules/knowledge-graph-governance/development/10-hybrid-retrieval-contract.md)
- 评审结论：厂商无关契约和 sparse-only 基线已完成；dense/reranker/向量库配置等待 G1/G2 批准，当前不得引入依赖。
