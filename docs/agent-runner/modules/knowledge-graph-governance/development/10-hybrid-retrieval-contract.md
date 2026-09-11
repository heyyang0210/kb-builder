# 混合检索与引用接口契约

```yaml
documentType: design
moduleId: knowledge-graph-governance
designVersion: 1.0.0
status: review
relatedRequirements: [REQ-KGO-33, REQ-KGO-34]
relatedTasks: [RG-04, RG-12, RG-29, RG-30]
createdAt: 2026-08-17
```

## 1. 边界和推荐基线

JSON/JSONL 仍是事实源；检索层只消费已发布版本的 sparse、dense 和图投影。每个适配器厂商无关、可禁用，失败时回退到确定性的 sparse 检索。推荐默认值（G1/G2 未批准前不启用）：`sparseTopK=50`、`denseTopK=50`、`rerankTopK=20`、`contextTopK=8`、单查询 1500 tokens；P95 目标 800ms（未含模型生成）。

## 2. Schema

```text
Query { queryId, text, datasetIds[], graphVersionId, user, filters, options }
Filter { datasetIds, ontologyTypes[], productVersions[], validAt, aclSnapshot }
Candidate { itemId, source: sparse|dense|graph, score, datasetId, chunkId, evidenceIds[], versionFingerprint }
RankedContext { itemId, rank, score, text, evidenceIds[], lineage, versionFingerprint }
Citation { citationId, itemId, evidenceId, resourceId, headingPath, offsets, quote, fingerprint }
AbstainReason = NO_AUTHORIZED_RESULT | EVIDENCE_INSUFFICIENT | VERSION_MISMATCH |
                ADAPTER_TIMEOUT | ADAPTER_DISABLED | QUALITY_BLOCKED
```

响应包含 `answerContext[]`, `citations[]`, `abstain`（布尔和 reason），以及 `trace`（queryId、各适配器耗时和候选计数）。任何返回的 context 必须通过 dataset、graphVersion、ACL、产品版本和有效期过滤。

## 3. 稳定合并和适配器策略

候选按 `itemId` 去重；同一 item 保留最高归一化分数并合并 evidence。默认加权 RRF：`score = Σ 1/(60 + rank_source)`，权重由 options 显式传入且白名单校验。排序 tie-break 为 `score desc, datasetId asc, itemId asc`，保证重试稳定。适配器超时或健康检查失败只标记 trace 并回退；dense/reranker disabled 时不得伪造分数。

GraphStore 仅提供已授权邻域候选，VectorStore 仅提供向量候选，倒排适配器提供 sparse 候选；三者不得修改事实源、发布状态或引用内容。

## 4. 查询伪代码

```text
search(query):
  authorize(query.user, query.datasetIds, query.aclSnapshot) or abstain(NO_AUTHORIZED_RESULT)
  filters = resolve_version_acl_time_filters(query)
  parallel:
    sparse = sparse_adapter.search(query.text, filters, 50)
    dense  = dense_adapter.search(query.text, filters, 50) if enabled else []
    graph  = graph_adapter.neighborhood(query.text, filters) if enabled else []
  candidates = stable_rrf(dedupe(sparse + dense + graph))
  ranked = reranker.rank(candidates, query.text, 20) if enabled else candidates[0:20]
  context = pack_with_budget(ranked, 8, 1500)
  citations = resolve_and_verify_evidence(context)
  if context empty or citation coverage < 1.0:
    return abstain(EVIDENCE_INSUFFICIENT, trace)
  return {context, citations, trace}
```

## 5. 超时、预算和降级

总 deadline 由调用方传入，适配器 deadline 不超过总 deadline 的 70%；单适配器超时不重试超过一次。上下文按 evidence 完整性优先、分数其次截断；禁止跨 dataset 拼接。引用解析失败会剔除对应 context，若无可引用上下文则结构化拒答。

## 6. 测试矩阵

| 场景 | 预期 |
|---|---|
| 无授权 dataset | `NO_AUTHORIZED_RESULT`，不调用存储适配器 |
| ACL 过滤后无结果 | 空结果/结构化拒答，不泄露候选计数 |
| sparse/dense 重复候选 | 只保留一个 item，evidence 合并且排序稳定 |
| dense 或 reranker disabled | 仅 sparse 基线，trace 标记 disabled |
| 适配器超时 | 其余结果照常返回，trace 为 timeout |
| graphVersion 不匹配 | 丢弃候选，`VERSION_MISMATCH` |
| 证据缺失/无法回放 | 剔除 context；无剩余则 `EVIDENCE_INSUFFICIENT` |
| top-k/context budget 超限 | 严格截断，输出不超预算 |
| 同分重试 | 结果按稳定 tie-break 完全一致 |

## 7. 待确认项与推荐

需 G1/G2 批准 dense 模型、reranker 模型、向量库（当前 ADR 推荐先保持本地实现，Neo4j/NebulaGraph/Milvus 均不接入主链路）、embedding 维度、top-k、阈值和 P95 预算。推荐先验收 sparse-only 确定性基线，再以隔离适配器做 dense/reranker A/B；未批准配置统一为 `disabled`，不得引入依赖或改变公共 API。
