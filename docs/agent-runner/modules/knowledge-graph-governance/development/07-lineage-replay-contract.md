# 全链路 Lineage 与证据回放契约

```yaml
documentType: design-contract
moduleId: knowledge-graph-governance
relatedRequirement: REQ-KGO-33
relatedTask: RG-09
status: review
decisionGate: G2
```

## 1. 原则

JSON/JSONL 是不可变事实源；图和向量存储只消费带版本的投影。每个下游对象必须引用父对象和 `lineageId`，内容变化创建新版本，不覆盖旧记录。推荐首版采用 SHA-256 内容哈希；若 G2 改变算法，必须版本化哈希前缀。

## 2. 对象 Schema

| 对象 | 稳定 ID | 必填字段 |
|---|---|---|
| `source` | `source:{datasetId}:{contentHash}` | datasetId、uri、snapshotId、contentHash、aclRef |
| `chunk` | `chunk:{sourceId}:{ordinal}:{chunkHash}` | sourceId、ordinal、textHash、offset、pageRef |
| `evidence` | `evidence:{chunkId}:{spanHash}` | chunkId、start/end、quotedHash、extractorVersion |
| `node` | `node:{ontologyType}:{canonicalKey}:{graphVersionId}` | type、canonicalKey、properties、evidenceIds |
| `edge` | `edge:{graphVersionId}:{from}:{predicate}:{to}` | from、predicate、to、evidenceIds |
| `indexItem` | `index:{indexVersionId}:{chunkId}` | chunkId、indexVersionId、embeddingHash、filters |
| `citation` | `citation:{answerId}:{evidenceId}` | answerId、evidenceId、rank、displayText |

所有记录统一带 `datasetId`、`versionId`、`lineageId`、`createdAt`、`schemaVersion`。`source` 记录快照元数据，不直接依赖可变路径。

## 3. 完整性规则

- 父对象缺失、哈希不匹配、偏移越界、快照删除、ACL 失效均产生分类错误，不返回猜测文本。
- `quotedHash` 必须等于快照按 `[start,end)` 截取内容的哈希；重建时校验失败即将 citation 标记 `stale`。
- 旧版本对象只读；重跑只生成新 `versionId` 和新投影。
- 单条 evidence 损坏写入质量问题并隔离；清单或快照整体不可验证时，批次失败。

## 4. 回放伪代码

```text
replay(citationId, principal):
  c = facts.get_citation(citationId)
  require c and authorize(principal, c.datasetId, "read")
  e = facts.get_evidence(c.evidenceId)
  require e and e.status != "stale"
  chunk = facts.get_chunk(e.chunkId)
  source = facts.get_source(chunk.sourceId)
  snapshot = snapshots.open(source.snapshotId)
  require sha256(snapshot.bytes) == source.contentHash
  text = snapshot.read_text(chunk.offset)
  quote = text.slice(e.start, e.end)
  require sha256(quote) == e.quotedHash
  audit("lineage_replay", citationId, c.datasetId, c.versionId)
  return {source, chunk, evidence: e, quote}
```

## 5. 回放错误码

`LINEAGE_NOT_FOUND`、`LINEAGE_PARENT_MISSING`、`FILE_SNAPSHOT_MISSING`、`FILE_SNAPSHOT_HASH_MISMATCH`、`EVIDENCE_OFFSET_INVALID`、`EVIDENCE_QUOTE_HASH_MISMATCH`、`ACL_DENIED`、`LINEAGE_STALE`。错误均带 requestId、对象 ID 和 versionId，路径与原文内容按脱敏策略处理。

## 6. 测试矩阵

| 类别 | 用例 | 预期 |
|---|---|---|
| 稳定 ID | 相同内容重复加工 | source/chunk ID 相同，事实不重复 |
| 版本 | 修改一个字符重跑 | 新 contentHash/versionId，旧记录可回放 |
| 偏移 | 正常/边界/越界区间 | 正常返回；越界为 `EVIDENCE_OFFSET_INVALID` |
| 完整性 | 快照内容被替换 | `FILE_SNAPSHOT_HASH_MISMATCH`，不返回引用 |
| 删除 | 快照不存在 | `FILE_SNAPSHOT_MISSING` |
| 关系 | 缺失父 chunk/source | `LINEAGE_PARENT_MISSING` |
| ACL | 无权主体回放历史版本 | `ACL_DENIED`，不泄露文本 |
| 漂移 | quote hash 不一致 | citation=`stale`，不静默修正 |
| 重建 | 从 JSONL 重建投影后回放 | 结果与原事实一致 |

## 7. 未决项

- SHA-256 是否作为正式哈希算法及哈希输入规范，需 G2 固化。
- 原文快照保留期、归档介质和删除合规策略需安全/产品确认。
- PDF 页码、Office 段落等格式定位是否进入首版；未确认时 `pageRef` 可为空并保留字符偏移。
