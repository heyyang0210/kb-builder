# M2 安全可发布基础详细设计

```yaml
documentType: detailed-design
moduleId: knowledge-graph-governance
relatedTasks: [RG-17, RG-18, RG-19, RG-20, RG-21, RG-22, RG-23, RG-24, RG-25]
status: architecture-approved-implementation-gated
approvedDecisions: [G-LIN-01-1A, G-LIN-02-2A-2C, G-LIN-02-API-A, G-LIN-03-3A, G-LIN-04-4A, G2-03-TRUSTED-GATEWAY]
pendingDecisions: [JWT-RUNTIME-PARAMETERS]
```

## 1. 内部接口

```text
FingerprintService.hash_bytes(data, algorithm="sha256-v1") -> Fingerprint
SourceOccurrenceIdentity.v2(dataset_id, resource_id, content_hash) -> SourceId
LineageManifest.build_v2(dataset_id, version_id, sources, chunks, evidence) -> Manifest
LineageManifest.verify(manifest) -> VerificationResult
KeywordRuleSnapshot.commit(run_id, descriptor, input_snapshot_refs) -> CommittedRuleSnapshotRef
KeywordExtractorVersion.resolve(candidate, candidate_run_id, committed_snapshot_ref?) -> VersionResolution
KeywordRebuildInputFreezer.freeze(dataset_ref, request_context) -> CommittedRebuildInputRef
KeywordRuleRebuild.execute(rebuild_input_ref, rule_descriptor, rebuild_of, executor) -> RebuildResult
KeywordRuleExecutor.execute(records, RebuildExecutionContext) -> CandidateStream
VersionFingerprint.build(graph, index, rule, model?, embedding?) -> VersionFingerprint
PublishGate.evaluate(dataset, principal, expected_status_version) -> GateResult
AclPolicy.authorize(principal, dataset_id, resource_id?, action) -> Decision
AuditSink.append(SecurityEvent) -> None
EvidenceReplay.replay(citation_id, principal) -> ReplayResult
```

`model`/`embedding` 未启用时必须为 `null` 且携带 `not_applicable`，禁止使用空字符串或虚构版本。

## 2. 核心 Schema

| 对象 | 必填字段 |
|---|---|
| `Fingerprint` | algorithm=`sha256-v1`、digest、byteLength |
| `Manifest v2` | schemaVersion=`2.0`、datasetId、versionId、source/chunk/evidence 记录、manifestFingerprint |
| `Source v2` | sourceId、resourceKey、uri、snapshotId、contentHash、aclRef、recordFingerprint |
| `KeywordRuleSnapshot v1` | schemaVersion、runId、mode=`keyword_analysis`、producerName、implementationVersion、pipelineVersion、candidateSchemaVersion、ruleArtifacts、configurationHash、inputSnapshotFingerprints、descriptorHash |
| `CommittedRuleSnapshotRef` | runId、manifestPath、manifestHash、artifactPath、artifactHash、extractorVersion |
| 新 keyword candidate | schemaVersion、candidateId、sourceMethod、extractorVersion、extractorSnapshotRef、chunkId、evidenceText |
| `VersionResolution` | status=`verified|isolated`、extractorVersion?、snapshotRef?、reasonCode? |
| `RebuildResult` | rebuildRunId、candidateVersionId、rebuildKey、sourceSnapshotFingerprints、ruleSnapshotRef、candidateCount、isolatedCount、state |
| `VersionFingerprint` | graphVersion、indexVersion、ruleVersion、modelVersion?、embeddingVersion?、status |
| `GateResult` | allowed、reasonCode、checks、statusVersion、requestId |
| `Decision` | allowed、reasonCode、policyVersion、principalRef(脱敏) |
| `SecurityEvent` | eventId、requestId、action、decision、datasetId、resourceId?、reasonCode、occurredAt |

### 2.1 Source occurrence v2 精确契约

```text
logicalKey = {
  "datasetId": datasetId,
  "resourceId": resourceId,
  "contentHash": "sha256:" + 64位小写十六进制摘要
}
identityBytes = UTF-8(canonical-json(logicalKey))
sourceId = "source:v2:" + hex(sha256(identityBytes))
```

- `canonical-json` 使用 UTF-8、字段名字典序、无多余空白、禁止 NaN/Infinity；`datasetId/resourceId` 必须是非空原始字符串，不执行 trim、大小写折叠或 Unicode 归一化。
- `sourceId` 不包含原始 `datasetId/resourceId`，记录内的 `datasetId` 与 `resourceKey` 是重算逻辑身份的权威组件。验证器必须重算并以常量时间比较摘要。
- `G-LIN-01` 不改变现有 normalized 快照物理布局。`snapshotId` 保持指向已提交且验证过的安全相对路径；读取时仍必须做 normalized root `realpath` containment、普通文件、非 symlink 和严格单文件命中校验。
- 原始 `resourceId` 不进入 `sourceId` 文本或新文件路径。现有适配器若使用 `resourceId` 定位快照，仍必须拒绝分隔符、绝对路径、glob 和路径混淆；物理存储迁移需另立架构决策。

### 2.2 Schema 兼容和歧义处理

| 输入 | 读取 | 新写/升级 | 发布 |
|---|---|---|---|
| v2 `schemaVersion=2.0` | 按 v2 全量验证 | 只能生成新的不可变候选包 | 通过其他门禁后可发布 |
| v1 `schemaVersion=1.0`，父链可验证 | 只读原样验证和历史回放 | 禁止原地改写；只能从已提交 source facts 重建 v2 | 不得作为新发布或重发布的权威包 |
| v1 中同一 contentHash 的 resource occurrence 不可证明 | 仅在原包父链内回放，返回 `LEGACY_SOURCE_IDENTITY_AMBIGUOUS` 诊断 | 禁止猜测/mapper URI 或合并；必须用已提交 source-documents 事实重建 | 门禁 false |

兼容读不得把 v1 记录在内存中静默改造成 v2，也不得用 `uri/sourcePath` 推导缺失的 `resourceId`。

### 2.3 Keyword extractor 版本与可信快照契约

`G-LIN-02=2A+2C` 将“版本标签”与“版本证据”分开：`extractorVersion` 是候选记录携带的稳定标签，`CommittedRuleSnapshotRef` 是该标签可验证的事实来源。稳定标签格式固定为：

```text
ruleFacts = canonical-json({
  schemaVersion, mode, producerName, implementationVersion,
  pipelineVersion, candidateSchemaVersion,
  ruleArtifacts: sort_by(name, version, contentHash),
  configurationHash, inputContractVersion
})
descriptorHash = sha256-v1(UTF-8(ruleFacts))
extractorVersion = "keyword-rule:v1:" + descriptorHash.digest
```

- `ruleArtifacts` 必须枚举本次实际执行的规则表、词典、模式配置及其内容摘要；只有版本名而没有内容摘要不构成完整规则事实。
- `configurationHash` 只覆盖影响抽取结果的冻结配置；并发度、日志级别等非语义配置不得改变 `extractorVersion`。
- `inputSnapshotFingerprints`、`runId` 和时间字段用于运行追溯，不进入规则语义摘要；它们必须写入已提交快照，防止把另一次运行的规则证据移接到当前运行。
- `manifestHash` 必须绑定 `artifactPath/artifactHash`，并由 `commit.json` 再绑定；解析时禁止读取 `latest.json`、当前配置、源码常量、Git 时间或文件 mtime。
- 新 producer 必须先提交规则快照，再写候选；候选中的 `extractorVersion/extractorSnapshotRef` 必须与同一 run 的已提交快照完全一致。
- 旧记录不因 `sourceMethod` 相同而共享版本。无法验证同 run、commit、manifest、artifact hash 或完整规则事实时，逐条写 `LEGACY_EXTRACTOR_VERSION_UNPROVEN` 并隔离。

### 2.4 2C 重跑与不可变边界

- 历史 dataset 当前只有普通业务 manifest、`normalized/` 和 `processing-units.jsonl`，不能描述为“原训练时已冻结”。API-A 必须校验请求时可读字节并提交新的 `rebuild-input` 包，显式记录 `captureSemantics=request_time_snapshot`；不得改旧 dataset 或冒充原训练快照。
- 冻结包至少绑定 dataset manifest、source facts、全部 normalized 文件和 processing-units 的安全相对路径、长度与 SHA-256，并通过 `commit.json + manifestHash + artifactHash` 提交。`inputDigest` 覆盖规范排序后的全部事实。
- `rebuildKey=sha256-v1(canonical-json({inputDigest, ruleDescriptorHash, mode}))`。新结果强制写 `rebuildOf={datasetId,taskId,inputDigest}`；相同 key 幂等重验，不同 key 永不覆盖。
- 内核确定 `rebuildRunId` 后，必须在同一 staging run 内提交规则快照、执行规则、写 candidates 和结果 manifest，再整体 rename。candidate 的规则引用必须属于该 `rebuildRunId`，禁止引用外部 rule run。
- executor 接收只读 `RebuildExecutionContext={rebuildRunId,candidateVersionId,rebuildKey,ruleSnapshotRef,modelAllowed:false}`；candidate ID 不得依赖外层 training task ID。
- 重跑只执行确定性规则提取；`model=null`、`modelStatus=not_applicable`、模型调用数为 0。若执行路径发生模型调用，立即以 `RULE_ONLY_CONTRACT_VIOLATION` 终止新候选提交。
- normalized 和 records 必须流式或有界分批处理。rename 后 reservation 未完成时，重试应重验 final run 后接管；stale running reservation 使用租约到期后的有界接管。

实现门禁（2026-08-18）：`CommittedRebuildInputRef` 是 API-A 唯一生产输入契约。内核必须直接重验 `rebuild-input/v1` 的 `commit.json -> manifest.json -> artifacts` 摘要链；不得在 API 层把它伪装成旧 per-resource snapshot，也不得回退读取 `latest.json`。旧 `frozen_source_refs` 仅保留给内部兼容回归，不能作为公共入口的事实来源。该偏差由 `TASK-RAG-KG-M2-LIN-2C-FRZ-KRN-INT-01` 跟踪，未转绿前 API-A 不得接线。

### 2.5 当前内核不可直接上线的 P0 偏差

| 偏差 | 当前事实 | 上线前要求 |
|---|---|---|
| 输入证据 | dataset 文件未进入可信 artifact manifest | 生成请求时冻结包并标注语义 |
| 规则证据 | 外部 rule run 引用写入新 candidates | 同 run 原子提交规则和 candidates |
| 追溯 | `rebuildOf` 缺 dataset/task/digest | 三字段强制必填并重验 |
| 执行上下文 | callback 仅收到 records | 引入不可变 rebuild context |
| 公共错误 | dataset 异常可误报 batch；异步失败字段不稳 | 固定同步/异步错误契约 |
| 结果可见性 | artifact 不是 DatasetVersion | 第一阶段只在任务详情暴露 artifact |
| 性能 | 全量正文与 records 驻留内存 | 有界执行并测量 1k/8k |
| 恢复 | rename 后/stale reservation 不能可靠接管 | final 重验和租约接管 |

## 3. 实现伪代码

```text
build_source_v2(dataset_id, source_fact, frozen_snapshot):
  require_valid_identifier(dataset_id)
  resource_id = require_non_empty_exact_string(source_fact.resourceId)
  content_hash = sha256_v1(read_verified_regular_file(frozen_snapshot))
  source_id = SourceOccurrenceIdentity.v2(dataset_id, resource_id, content_hash)
  return Source(sourceId=source_id, resourceKey=resource_id,
                snapshotId=verified_relative_path(frozen_snapshot),
                contentHash=content_hash)

read_manifest(manifest):
  if manifest.schemaVersion == "2.0": return verify_v2(manifest)
  if manifest.schemaVersion == "1.0": return verify_v1_read_only(manifest)
  return error("LINEAGE_SCHEMA_UNSUPPORTED")
```

```text
commit_keyword_rule_snapshot(run_id, rule_inputs, source_snapshot_refs):
  descriptor = canonical_rule_descriptor(rule_inputs)
  require_all_semantic_artifacts_hashed(descriptor)
  extractor_version = "keyword-rule:v1:" + sha256_v1(descriptor).digest
  snapshot = {runId: run_id, descriptor, extractorVersion: extractor_version,
              inputSnapshotFingerprints: verified_fingerprints(source_snapshot_refs)}
  return artifact_repository.commit_snapshot(run_id, "keyword-rule", snapshot)

resolve_keyword_extractor(candidate, candidate_run_id, snapshot_ref):
  if is_new_candidate_contract(candidate):
    snapshot = verify_committed_rule_snapshot(snapshot_ref, expected_run_id=candidate_run_id)
    require candidate.extractorVersion == snapshot.extractorVersion
    require candidate.extractorSnapshotRef == snapshot_ref
    return verified(snapshot.extractorVersion, snapshot_ref)

  # legacy candidate: no mutation and no current-state inference
  snapshot = try_verify_committed_rule_snapshot(snapshot_ref, expected_run_id=candidate_run_id)
  if snapshot is absent or incomplete:
    return isolated("LEGACY_EXTRACTOR_VERSION_UNPROVEN")
  return verified(snapshot.extractorVersion, snapshot_ref)

freeze_rebuild_input(dataset_ref, request_context):
  dataset = resolve_without_latest(dataset_ref)
  require_sync_identity_and_state(dataset, request_context)
  artifacts = stream_verify_and_hash_manifest_sources_normalized_processing(dataset)
  return commit_rebuild_input(captureSemantics="request_time_snapshot", artifacts=artifacts)

rebuild_keyword_candidates(input_ref, rule_descriptor, rebuild_of, executor):
  inputs = verify_committed_rebuild_input(input_ref)
  require rebuild_of == {datasetId: inputs.sourceDatasetId,
                         taskId: inputs.sourceTaskId,
                         inputDigest: inputs.inputDigest}
  rebuild_key = stable_hash(inputs.inputDigest, hash(rule_descriptor), "keyword_analysis")
  reservation = reserve_rebuild(rebuild_key)  # 短临界区/CAS
  if reservation.completed: return verify_and_return(reservation.result)
  if final_run_exists(rebuild_key): return verify_adopt_and_complete(reservation)
  reservation = acquire_or_take_over_expired_lease(reservation)
  staging, context = create_staging_and_readonly_context(rebuild_key)
  rule_ref = commit_rule_snapshot(staging, context.rebuildRunId, rule_descriptor, inputs)
  candidates = executor.execute(inputs.stream_bounded(), context.with(ruleSnapshotRef=rule_ref))
  require model_call_count == 0 and all_candidates_reference_same_run(candidates, context)
  final = atomic_commit_whole_run(staging, rebuild_of, candidates)
  complete_rebuild_cas(reservation, verify_result_fingerprint(final))
  return final
```

### 3.1 数据不变性、并发和性能

| 范围 | 不变性/策略 |
|---|---|
| 历史产物 | legacy 文件只读；验证、隔离和重跑均不得修改其字节、mtime 或引用 |
| 版本证据 | 同一 `extractorVersion` 必须对应同一规范规则事实摘要；同 run snapshot 不匹配即 fail-closed |
| 重跑结果 | 新 run/候选版本不可变；`rebuildOf` 只作追溯，不建立可覆盖关系 |
| 幂等性 | 同 `rebuildKey` 最多提交一个结果；重试读取并重验已提交结果，不重复执行或覆盖 |
| 并发 | 只在 reservation 和最终 CAS/rename 使用 `datasetId + rebuildKey` 锁；文档规则计算在锁外按 resource 分片，worker 数由配置限制在 CPU/IO 容量内 |
| 确定性 | 输入按 snapshot/resource/chunk 稳定排序；worker 输出在提交前规范排序，调度顺序不得影响 candidate ID、内容和指纹 |
| 资源上限 | JSONL 流式/分批读取和写 staging；内存随批大小而非总文档数增长；队列有界并实施背压 |
| 性能证据 | 在固定硬件记录 1k/8k 文档吞吐、P50/P95、峰值 RSS、读写字节、锁等待和重试数；实现不得引入模型调用，8k 回归不得因全局锁串行化 |

### 3.2 迁移、回滚和安全边界

1. 先部署可信快照验证器和只读 legacy 分类，再部署新 producer 快照与显式版本写入，最后启用 2C 重跑入口；任一步失败均不修改旧产物。
2. 回滚只关闭新写和重跑调度，保留快照验证与 legacy 只读；已提交的新候选不得降级、覆盖或复制回 legacy 目录。
3. 重跑仅接受服务端解析的已提交 snapshot ref，拒绝调用方提供任意绝对路径、规则内容或自报 `extractorVersion`；所有路径继续执行 containment、普通文件和 symlink 校验。
4. issue/audit 只记录脱敏 run/version ID、摘要和原因码，不写文档正文、规则密钥、模型凭证或根外绝对路径。
5. 规则快照内容摘要不等于代码执行安全。producer 名称和实现版本必须在受信任 allowlist/部署版本内；不执行快照中携带的脚本。

```text
publish(request, principal):
  identity = identity_provider.resolve(principal)
  decision = acl.authorize(identity, request.datasetId, null, "publish")
  if not decision.allowed:
    audit.append(denied_event(decision, request))
    return error(decision.reasonCode)

  manifest = facts.read_manifest(request.datasetId, request.versionId)
  verification = lineage.verify(manifest)
  checks = gates.evaluate_all(dataset, verification, request.expectedStatusVersion)
  if checks.has_p0:
    return error("PUBLISH_GATE_BLOCKED", checks.redacted_reasons)

  return state_store.compare_and_set_publish(
    request.datasetId, request.expectedStatusVersion, checks.fingerprint)
```

```text
authorized_read(request, principal):
  identity = identity_provider.resolve(principal)
  decision = acl.authorize(identity, request.datasetId, request.resourceId, "read")
  if not decision.allowed: return indistinguishable_denial(decision)
  return repository.read_with_scope(request.datasetId, request.versionId, request.resourceId)
```

## 4. API 与前端契约

- 保留现有发布路由，治理模式传 `expectedStatusVersion`。
- `G-LIN-02-API=API-A` 已按常设推荐方案授权选定，保持 `POST /api/training/tasks` 和 `TrainingTaskCreate` 字段集合不变：

```json
{
  "batchId": "batch_xxx",
  "mode": "keyword_analysis",
  "sourceDatasetId": "dataset_1d7438983dc34062",
  "config": {}
}
```

  该组合表示“创建指定 dataset 的请求时冻结包后重建”。dataset 存在、batch 一致、keyword candidate 状态和 manifest 身份同步校验；全量摘要、关联、冻结和规则执行异步完成。同步失败返回结构化 `404 REBUILD_SOURCE_NOT_FOUND` 或 `409 REBUILD_SOURCE_MISMATCH/REBUILD_SOURCE_STATE_INVALID`，不创建任务。通过后继续返回 `202 TaskSnapshot`。
- 异步失败写 `progressDetail.reasonCode/requestId/retryable`；摘要或关联损坏为 `ARTIFACT_INTEGRITY_ERROR`，模型调用为 `RULE_ONLY_CONTRACT_VIOLATION`，短暂租约冲突可为 `REBUILD_BUSY/retryable=true`。禁止误报 `BATCH_NOT_FOUND`，也不得读取 `latest`。
- 第一阶段成功只在 `progressDetail.rebuildResult` 和事件日志暴露 `rebuildRunId/candidateVersionId/rebuildOf/resultFingerprint`。它是 candidate artifact，不创建或冒充 `/api/datasets` 可查、可发布的 DatasetVersion。
- `governance == null` 表示历史兼容模式；非空时以 `status/statusVersion/gateChecks/reasonCode` 为准。
- `PUBLISH_GATE_BLOCKED` 展示中文未通过项，禁用发布；不显示“强制发布”。
- `STATE_VERSION_CONFLICT` 提示状态已变化并自动重载；`ACL_*` 不展示资源存在性。

### 4.1 方案选择记录

| 决策 | 选择 | 理由 | 风险/缓解 | 回滚/边界 |
|---|---|---|---|---|
| API | A：复用现有字段 | 不扩大 Schema | 老客户端语义变化；仅 keyword+sourceDatasetId 生效 | 关闭触发分支；不适用 formal/publish |
| 输入 | 请求时冻结 | 不改旧数据即可形成证据链 | 只能证明请求时事实；显式标注语义 | 停止新冻结；不删除已提交包 |
| 事务 | 同 run staging 原子提交 | 满足规则证据不变量 | 恢复复杂；以 rename/fsync/接管测试缓解 | 关闭入口；不回写 legacy |
| 可见性 | 任务详情 artifact | 不伪装未完成的 DatasetVersion | 用户误解；明确 artifact 状态 | 后续治理包完成后向前扩展 |
| 执行 | 轻校验同步、重工作异步 | HTTP 有界且尽早拒绝 | admission 后漂移；冻结阶段重验 | 失败任务保留 reasonCode |
| G-LIN-03 | 3A：dataset governance 唯一权威 | 发布事实单一 | run 镜像漂移只告警 | 不提升镜像为权威 |
| G-LIN-04 | 4A：`unicode_code_point` | 与 Python 规范切片一致 | JS 需显式换算 | 改单位必须新 Schema |
| G2-03 | 可信网关 JWT、本地验签、dataset ACL、deny 优先、脱敏审计 | 最小权限且可离线验证 | 参数缺失时 fail-closed | 不降级匿名放行 |

JWT `issuer/audience/JWKS URI/claims` 是尚待部署提供的运行参数，不是未选架构方案。

## 5. 文件归属与并发规则

| 任务 | 角色 | 独占文件/范围 | 并发规则 |
|---|---|---|---|
| RG-17 | Backend B | 新建 `lineage_manifest.py`、`test_lineage_manifest.py` | 可与 RG-18 并行 |
| RG-18 | Backend A | `governance_state.py`、`services.py`、发布门禁测试 | 与 RG-20 串行 |
| RG-19 | Backend B | 新建 `version_fingerprint.py`、对应测试 | RG-17 后执行 |
| RG-20 | Backend A/Security | 新建 `acl_policy.py`、`security_audit.py`；`main.py`、图/证据服务 | 与 RG-18 共享接线文件，必须串行 |
| RG-21 | Frontend | `api.js`、`PreprocessPage.vue`、`QualityPage.vue` | 可与后端新模块并行 |
| RG-22 | Test | 新建前后端契约测试 | RG-18/RG-21 后 |
| RG-23 | Test/Security | 新建 ACL 越权真实 API 测试 | RG-20 后 |
| RG-24 | Test | 新建 lineage 重建回放测试 | RG-17/RG-19 后 |
| RG-25 | Reporter/Test | M2 验收证据与项目看板 | RG-22—24 后 |

Worker 开始前必须再次确认实际文件路径；若现有代码结构不同，先更新本文档和任务卡，不强行套用预设模块名。

## 6. 验收矩阵

| 范围 | 最小验收 |
|---|---|
| 指纹 | 同内容同指纹；单字节变化指纹变化；未启用版本为 `not_applicable` |
| Source v2 | 同内容不同 resource 得到不同 ID；三元组相同则 ID 稳定；恶意 `resourceId` 不进入路径；v1 只读且歧义包不可升级/发布 |
| Keyword 版本 | 新 candidate 100% 显式携带可重验的 `extractorVersion/snapshotRef`；可信同 run legacy 100% 恢复；不可信 legacy 100% 逐条隔离且当前配置推断数为 0 |
| Keyword 重跑 | 冻结输入与规则相同的重复请求只生成一个可验证结果；旧产物字节不变；新 run/version 有 `rebuildOf`；模型调用数为 0 |
| 发布 | 越级、P0、旧 statusVersion 均失败且指针不变 |
| ACL | 匿名、直接 ID、历史版本、跨数据集均默认拒绝并写审计 |
| 回放 | 重建前后 citationId、文本、偏移和哈希一致 |
| 前端 | 历史兼容、P0 禁用、冲突刷新和中文错误展示 |
| 真实 API | 使用隔离数据集执行，不对目标生产批次写入 |
