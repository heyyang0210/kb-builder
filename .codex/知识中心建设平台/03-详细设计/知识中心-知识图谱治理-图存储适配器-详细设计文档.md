# GraphStore Adapter 详细设计

```yaml
documentType: detailed-design
moduleId: knowledge-graph-governance
status: design-frozen
version: 1.0.0
createdAt: 2026-08-19
relatedRequirements: [REQ-KGO-34]
relatedTasks: [TASK-RAG-KG-M8-GS-DES-01]
```

## 1. 接口原则

- 端口使用领域 DTO，不出现厂商驱动、查询语言、连接对象或内部数据库 ID。
- 所有写操作带 `writeRunId` 和不可变 `graphVersionId`；对象幂等键分别为 `(graphVersionId,nodeId)`、`(graphVersionId,edgeId)`。
- 所有查询带完整 `GraphQueryContext`，且先过应用层发布、投影、版本归属和 ACL 门禁。
- 列表返回逐项结果；单条损坏可以隔离，整体 manifest/版本不可验证时终止该 write run。
- 时间使用 UTC ISO-8601，哈希使用带算法前缀的规范摘要，schema 和状态使用受控枚举。

## 2. 领域 DTO 与 Schema

### 2.1 CanonicalGraphNode

| 字段 | 类型/约束 |
|---|---|
| `nodeId` | 非空稳定业务 ID；不得使用数据库自增 ID |
| `nodeType` | 版本化 ontology 中的已知类型 |
| `canonicalName` | 非空展示名；不得包含技术路径或敏感原文 |
| `schemaVersion` | 非空、受支持版本 |
| `graphVersionId` / `datasetId` / `sourceSnapshotId` | 非空且与写入上下文完全一致 |
| `admissionStatus` | 正式投影只能为 `admitted` |
| `lifecycleStatus` | `active` 或 `invalidated` |
| `validFrom` / `validTo` | UTC；`validTo` 可空且不得早于 `validFrom` |
| `aclScope` | 非空规范集合；deny 优先、不可放宽 dataset ACL |
| `evidenceRefs` | 非空、去重、排序的稳定 evidence ID 集合 |
| `createdAt` | UTC；从事实快照读取，不在 Adapter 临时生成 |
| `properties` | 经 schema allow-list 的结构化扩展，不允许凭据/原始全文 |

### 2.2 CanonicalGraphEdge

| 字段 | 类型/约束 |
|---|---|
| `edgeId` / `edgeType` | 稳定 ID、已知关系类型 |
| `fromNodeId` / `toNodeId` | 同 dataset、同 graph version 的已存在端点 |
| `direction` | `directed` 或 `undirected`，由 ontology 定义 |
| `graphVersionId` / `datasetId` | 与写入上下文完全一致 |
| `schemaVersion` | 受支持版本且与图版本兼容 |
| `evidenceRefs` | 非空、可回放，不能只存 evidence 文本 |
| `confidence` | `[0,1]` 的有限数值，规则确定项可为 1 |
| `validFrom` / `validTo` | 与节点相同的有效期规则 |
| `aclScope` | 不得宽于任一端点与 dataset 范围 |
| `properties` | allow-list 扩展；禁止存储敏感原文 |

### 2.3 EvidenceRef 与上下文

```text
EvidenceRef {
  evidenceId, sourceId, chunkId, sourceSnapshotId,
  normalizedHash, offsetUnit, start, end, evidenceHash,
  aclScope, availability
}

ACLContext {
  principalId, tenantId, securityDomains,
  allowScopes, denyScopes, authnSource, decisionCorrelationId
}

GraphQueryContext {
  datasetId, graphVersionId, aclContext,
  purpose, validAt, maxNodes, maxEdges, timeoutMs
}
```

`principalId`、`authnSource` 或 `decisionCorrelationId` 缺失即拒绝。`maxNodes/maxEdges/timeoutMs` 由服务端配置收紧，客户端只能请求更小值。

### 2.4 GraphWriteRun、批次和问题

```text
GraphWriteRun {
  writeRunId, storeId, datasetId, graphVersionId, sourceSnapshotId,
  sourceFingerprint, schemaVersion, projectionMode,
  status, attempt, leaseOwner, leaseExpiresAt, nextRetryAt,
  nodeCursor, edgeCursor, expectedNodeCount, expectedEdgeCount,
  succeededNodeCount, succeededEdgeCount, failedCount,
  createdAt, updatedAt, completedAt, lastErrorCode
}

GraphWriteIssue {
  issueId, writeRunId, graphVersionId, batchKind, batchId,
  objectType, objectId, errorCode, retryable,
  sanitizedMessage, firstSeenAt, lastSeenAt, attempt
}

OutboxRecord {
  eventId, aggregateType, aggregateId, eventType,
  payloadVersion, payloadRef, payloadHash, status,
  availableAt, leaseOwner, leaseExpiresAt, attempt, createdAt
}
```

`payloadRef` 只指向已提交的不可变版本目录，worker 每次处理前重新验证 manifest 和 `payloadHash`。错误正文不进入 `sanitizedMessage`。

## 3. GraphStore 端口

```text
interface GraphStore:
  health() -> StoreHealth
  begin_write(run: GraphWriteRun) -> BeginWriteResult
  upsert_nodes(context: GraphWriteContext, batch: NodeBatch) -> WriteBatchResult
  upsert_edges(context: GraphWriteContext, batch: EdgeBatch) -> WriteBatchResult
  validate(context: GraphValidationContext) -> GraphIntegrityReport
  get_entity(context: GraphQueryContext, node_id: str) -> GraphEntity | None
  query_neighborhood(context: GraphQueryContext, request: NeighborhoodQuery) -> GraphProjection
  query_evidence(context: GraphQueryContext, target: GraphTarget) -> EvidencePage
  invalidate(context: GraphInvalidationContext) -> InvalidationResult
```

`rollback(pointer, targetVersion)` 不属于存储内数据回滚：由应用服务校验目标版本仍为 `published + succeeded` 后，以 CAS 修改 queryable binding。Adapter 只负责读指定版本和显式失效，避免厂商实现擅自改变业务指针。

返回结构：

```text
WriteBatchResult { batchId, accepted, rejected, items[], retryAfterMs? }
WriteItemResult { objectId, status: succeeded|rejected|conflict, errorCode?, retryable }
GraphIntegrityReport {
  graphVersionId, status: passed|failed,
  expected/actual nodeCount and edgeCount,
  danglingEdgeCount, crossVersionCount, fingerprintMatched,
  evidenceSamplePassed, aclSamplePassed, issues[]
}
GraphProjection { context, focusNode, nodes, edges, truncated, nextCursor? }
```

## 4. 校验顺序

整体校验失败立即终止，单记录校验失败写 issue 并使 run 进入 `partial`：

1. 验证 graph version 目录、manifest、artifact path/hash/count 和 source fingerprint。
2. 验证 `datasetId/sourceSnapshotId/schemaVersion/graphSource=formal/publishStatus=published`。
3. 验证版本未失效，质量和 ACL 门禁通过。
4. 规范映射节点并校验必填、稳定 ID、evidence、有效期、ACL 和 allow-list 属性。
5. 建立本版本合法节点 ID 集合；去重后写节点。
6. 规范映射关系，校验端点、版本、证据、confidence、有效期和 ACL 交集；再写关系。
7. 全量计数/端点/跨版本/指纹校验，加受 ACL 约束的 evidence 抽样回查。
8. 仅报告完全通过才把 `GraphWriteRun` CAS 为 `succeeded`。

## 5. 状态转移规则

| 当前 | 允许后继 | 条件 |
|---|---|---|
| `pending` | `leased` | lease CAS 成功 |
| `leased` | `writing` | manifest 现场重验通过 |
| `writing` | `validating` | 所有批次均有终态且失败数为 0 |
| `writing` | `partial` / `failed` | 逐项失败 / 整体不可验证 |
| `validating` | `succeeded` | 完整性报告全通过 |
| `validating` | `partial` / `failed` | 数据差异 / 存储或整体失败 |
| `partial` / `failed` | `retry_wait` | 可重试且未超预算 |
| `retry_wait` | `leased` | 到期且获得新 lease |
| `partial` / `failed` | `dead_letter` | 不可重试或超预算 |
| `succeeded` | `invalidated` | 经审计的显式失效命令 |

终态禁止反向修改；重试复用同一 `writeRunId`、幂等键和 source fingerprint。若同一幂等键已有不同内容摘要，返回冲突并死信，不覆盖。

## 6. 核心伪代码

### 6.1 提交事实与 outbox

```text
publish_formal_graph(candidate, expected_publish_pointer):
  validate_lineage_quality_acl(candidate)
  version = graph_version_repository.create_immutable(candidate)
  verify(version)
  CAS publish_pointer(expected_publish_pointer, version.id)
  append_outbox_once(
    key=(store_id, version.id),
    payload_ref=version.manifest_path,
    payload_hash=version.manifest_hash)
  return version.id
```

若当前文件存储无法让 pointer 与 outbox 处于同一事务，采用可恢复顺序：先提交不可变版本，再 CAS 发布指针，再以确定性 key 补写 outbox；reconciler 周期扫描“已发布但无 outbox”的版本补齐。任何中断都不得删除事实或推断投影成功。

### 6.2 Worker、重试与死信

```text
project_next(worker_id):
  event = outbox.lease_next(worker_id, now, lease_ttl)
  if none: return
  run = write_runs.begin_or_resume(event.aggregate_id)
  try:
    manifest = repository.read_verified(event.payload_ref)
    assert hash(manifest) == event.payload_hash
    assert manifest is formal, published, not invalidated
    store.begin_write(run)
    for node_batch in stream_valid_nodes(manifest, run.node_cursor, batch_size):
      result = store.upsert_nodes(context(run), node_batch)
      persist_items_and_cursor(result)       # cursor advances only after durable result
      if result.rejected: mark_partial(result)
    for edge_batch in stream_valid_edges(manifest, run.edge_cursor, batch_size):
      result = store.upsert_edges(context(run), edge_batch)
      persist_items_and_cursor(result)
      if result.rejected: mark_partial(result)
    report = store.validate(validation_context(run))
    CAS run.status to succeeded only if report.passed and failed_count == 0
    outbox.ack(event) only after succeeded is durable
  except RetryableGraphStoreError as error:
    persist_sanitized_issue(error)
    schedule_with_exponential_backoff_and_jitter(run, bounded_attempts)
  except (IntegrityError, ContractError, ConflictError) as error:
    persist_sanitized_issue(error)
    move_to_dead_letter(run, event)
```

租约超时后其他 worker 可以接管；已确认批次依幂等键重放。退避基数、上限、抖动和最大尝试次数全部来自版本化配置，不在代码硬编码。

### 6.3 查询门禁

```text
query_neighborhood(context, request):
  require_complete_trusted_acl_context(context)
  version = repository.read_verified(context.graphVersionId)
  require version.datasetId == context.datasetId
  require version.graphSource == formal
  require version.publishStatus == published and not invalidated
  require projection_status(store_id, version.id) == succeeded
  authorization.require_read(context.aclContext, dataset, version)
  bounded = server_limits.intersect(request)
  result = graph_store.query_neighborhood(context, bounded)
  assert every result item belongs to dataset/version and allowed ACL scope
  append_sanitized_audit(context, counts_only)
  return result
```

### 6.4 失效和恢复

```text
invalidate(version_id, expected_binding, reason, actor):
  authorize_governance(actor)
  append_invalidation_event(version_id, reason)
  graph_store.invalidate(version_id)       # idempotent projection marker
  CAS binding(expected_binding, absent_or_approved_replacement)
  never delete immutable facts

recover():
  release_expired_leases()
  reconcile_published_versions_without_outbox()
  resume retry_wait events whose availableAt <= now
  never auto-activate an older or different version
```

## 7. LocalGraphStore 设计

- 数据来源只允许 `graph-versions/{graphVersionId}` 的已验证目录，不读取 training run、dataset 可变图或 `latest.json`。
- `begin/upsert` 在首阶段可生成独立的投影索引目录，但不得改写事实版本；原子目录替换、哈希和只读权限沿用 repository 模式。
- 查询按明确 graph version 加载；缓存键至少含 `graphVersionId + sourceFingerprint + ACL scope digest`，不得只用 mtime/size。
- 单进程缓存只是优化，不是正确性来源；每次 cache miss/重载先验证 manifest，失效事件立即淘汰相应版本。
- Local 与外部 Adapter 运行相同的契约测试，不保留绕过查询上下文的正式入口。

## 8. 兼容和迁移映射

| 现有字段/行为 | canonical 目标 | 处理 |
|---|---|---|
| node `id/type` | `nodeId/nodeType` | 仅在 manifest 可验证且映射规则版本明确时转换 |
| edge `id/source/target/type` | `edgeId/fromNodeId/toNodeId/edgeType` | 校验同版本端点后转换 |
| 响应 `graphVersionId=null` | 强制非空 | legacy API 可返回诊断警告，但不得进入 GraphRAG |
| 按创建时间取 current | 显式 CAS binding | 迁移时建立一次经审核的 binding，不持续推断 |
| `keyword_analysis` 图 | candidate/legacy | 不转换为 formal，不投影为可查询版本 |
| 缺 ACL/evidence/source snapshot | `legacy_unverified` | 只读隔离；重新加工，不猜测补齐 |
| 物理删除图文件 | invalidation event | 禁止用于已提交版本 |

旧公共 API 的兼容装配属于后续实现任务：应用层必须从已认证会话和显式版本路由生成 `GraphQueryContext`。无法确定版本时返回结构化不可查询错误，不能选择“最新”。

## 9. 配置与可观测性

配置项至少包括 schema/ontology 版本、batch 大小、lease TTL、重试策略、查询深度/节点/边/超时上限、evidence 抽样规则和脱敏规则；均放入版本化配置，禁止散落硬编码。

指标包括 `outbox_lag`、各状态 write run 数、batch latency、成功/拒绝/重试数、lease steal、dead-letter、validation mismatch、query latency/timeout/denied、按版本的节点边计数。日志关联 `correlationId/writeRunId/datasetId/graphVersionId/storeId`，不记录敏感 payload。

## 10. 实现文件建议与顺序

建议后续任务按顺序创建领域 contract/validator、outbox/write-run repository、`LocalGraphStore`、projection worker、query application service，再迁移现有读服务。每一步先更新设计和接口测试；不得在选型审批前增加外部驱动或厂商 Adapter。
