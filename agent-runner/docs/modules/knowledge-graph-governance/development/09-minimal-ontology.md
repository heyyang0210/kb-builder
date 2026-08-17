# 最小可发布 Ontology、canonical ID 与失败隔离设计

```yaml
documentType: design
moduleId: knowledge-graph-governance
designVersion: 1.0.0
status: review
relatedRequirements: [REQ-KGO-33, REQ-KGO-34]
relatedTasks: [RG-03, RG-11, RG-26, RG-27]
createdAt: 2026-08-17
```

## 1. 设计结论

正式发布必须同时存在合法的 `Entity` 和 `Relation`。`KnowledgePoint` 只能作为候选产物；每个实体和关系必须可回溯到一个或多个 evidence，并继承 dataset、graphVersion 和 ACL。首版采用小而稳定的领域无关核心类型，扩展类型必须通过 ontology 版本升级，不在运行时自由创建。

推荐首版类型（待领域负责人确认）：

| 类型 | 必填属性 | 唯一性/说明 |
|---|---|---|
| `Document` | `title`, `resourceId` | `(datasetId, resourceId, version)` 唯一 |
| `Product` | `name` | `(datasetId, normalizedName, productVersion)` 唯一 |
| `Concept` | `name` | `(datasetId, namespace, normalizedName)` 唯一 |
| `Api` | `name`, `method` | `(datasetId, normalizedName, method)` 唯一 |
| `Parameter` | `name` | 需挂接到 `Api`，不能独立发布 |
| `Version` | `value` | `(datasetId, productId, normalizedValue)` 唯一 |

推荐关系集合：`CONTAINS(Document→Concept|Api|Parameter)`、`DEFINES(Document→Concept|Api)`、`HAS_PARAMETER(Api→Parameter)`、`HAS_VERSION(Product→Version)`、`DEPENDS_ON(Concept|Api→Concept|Api)`、`COMPATIBLE_WITH(Product|Version→Product|Version)`。关系方向固定，反向展示由查询层派生，不重复写边。

## 2. 规范化和 canonical ID

```text
normalize(value): Unicode NFKC -> trim -> collapse whitespace -> casefold
                     -> preserve CJK and API punctuation -> reject empty/control chars
canonical_id = sha256("kg:v1|" + dataset_id + "|" + type + "|" + namespace + "|" + key)
```

`namespace` 默认取产品/文档声明的命名空间；缺失时使用 `dataset:{datasetId}`，禁止跨数据集碰撞。别名写入 `aliases[]`，每个别名保留 `normalized`, `sourceEvidenceId`, `confidence` 和 `validity`。同名实体只有在 namespace、产品版本或证据上下文不同且无法确定为同一对象时才拆分；不确定时写入质量问题，不自动合并。实体和关系均带 `ontologyVersion`, `validFrom`, `validTo`（未知为 null），并要求 `validFrom <= validTo`。

## 3. 质量分类和发布约束

| code | 判定 | 单记录动作 | 发布影响 |
|---|---|---|---|
| `ONTOLOGY_SCHEMA_INVALID` | 类型、属性或端点不合法 | 隔离记录 | P0，阻断版本 |
| `CANONICAL_ID_COLLISION` | 同 ID 的关键属性冲突 | 隔离冲突记录 | P0，阻断版本 |
| `ORPHAN_RELATION` | 关系端点实体不存在 | 隔离关系 | P0，阻断版本 |
| `EVIDENCE_MISSING` | 实体/关系没有可回放 evidence | 隔离记录 | P0，阻断版本 |
| `SEMANTIC_ENRICHMENT_NOT_IMPLEMENTED` | 规则不能确定的语义项 | 保留候选，不发布 | P1，告警 |
| `ALIAS_AMBIGUOUS` | 别名无法确定唯一实体 | 保留别名候选 | P1，告警 |
| `TEMPORAL_RANGE_INVALID` | 版本/有效期范围非法 | 隔离记录 | P0，阻断版本 |

## 4. 接口和伪代码

```text
validate_entity(entity, ctx) -> ValidatedEntity | QualityIssue
validate_relation(relation, entity_index, ctx) -> ValidatedRelation | QualityIssue
validate_batch(records, manifest):
  if manifest missing or checksum invalid: abort_batch(MANIFEST_UNVERIFIABLE)
  for record in records:
    try:
      validate schema, ACL, version and evidence
      buffer valid record
    except QualityIssue as issue:
      quarantine(record, issue)       # 单记录隔离，继续处理
  if any P0 issue: mark_version_blocked()
  return {valid, quarantined, qualitySummary}
```

事实写入 JSON/JSONL 先成功，再异步投影 GraphStore；投影使用 `(graphVersionId, canonicalId)` 和 `(graphVersionId, relationId)` 幂等键。模型候选必须经过相同校验器，不能直接改变发布状态。

## 5. 测试矩阵

| 场景 | 预期 |
|---|---|
| 重复实体、属性完全相同 | 合并到同 canonical ID，保留全部 evidence/aliases |
| 同名但 namespace/版本不同 | 生成不同 ID，不跨数据集合并 |
| 同 ID 关键属性冲突 | `CANONICAL_ID_COLLISION`，隔离并阻断版本 |
| 悬空边 | `ORPHAN_RELATION`，仅隔离该边并阻断版本 |
| 无证据实体或关系 | `EVIDENCE_MISSING`，隔离并阻断版本 |
| 语义不确定模型候选 | `SEMANTIC_ENRICHMENT_NOT_IMPLEMENTED`，不发布但批次继续 |
| 单条坏 JSON/Schema | 写入质量问题，其他记录继续 |
| 清单缺失/校验失败 | `MANIFEST_UNVERIFIABLE`，终止批次 |
| 版本范围反转 | `TEMPORAL_RANGE_INVALID`，隔离并阻断版本 |

## 6. 待确认项

领域负责人需确认：实体类型是否限制为上述 6 类、关系集合及方向、是否允许 `Parameter` 独立发布、产品版本格式和时间语义。未确认前，实施只能使用本设计的接口和内存校验器，不落正式图谱。
