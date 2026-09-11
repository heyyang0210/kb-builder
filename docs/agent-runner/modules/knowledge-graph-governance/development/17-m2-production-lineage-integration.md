# M2 生产 Lineage 与版本指纹接线设计

```yaml
documentType: detailed-integration-design
moduleId: knowledge-graph-governance
relatedTasks: [RG-17, RG-18, RG-19, RG-24, RG-25]
status: architecture-approved-implementation-gated
decisionGate: G2.5
scope: production-fact-source-wiring
approvedDecisions: [G-LIN-01-1A, G-LIN-02-2A-2C, G-LIN-02-API-A, G-LIN-03-3A, G-LIN-04-4A, G2-03-TRUSTED-GATEWAY]
pendingDecisions: [JWT-RUNTIME-PARAMETERS]
```

## 1. 目的与当前缺口

RG-17 的 `LineageManifest` 和 RG-19 的 `VersionFingerprint` 已经完成确定性组件测试，但当前知识加工生产路径没有调用它们。现有流水线在 `TrainingService._prepare_materials_from_stage_outputs()` 中读取已提交的 preparation/metadata 快照，在 `_generate_dataset()` 或 `_generate_keyword_dataset()` 中写出数据集目录；这两个出口目前只写业务 `manifest.json`，没有生成 source/chunk/evidence lineage 清单，也没有把 graph/index/rule/model/embedding 的指纹绑定到候选版本和发布门禁。

本设计只补“事实源到候选数据集/发布门禁”的接线，不改变 ACL 身份、权限继承、跨数据集边界或审计策略。ACL 仍由 RG-20 单独完成，接线期间 `acl=false` 必须保持 fail-closed。

### 1.1 API-A 上线前 P0 偏差

现有 2C 的 9/9 小夹具只证明局部内核，不能直接接公共 API：历史 dataset 未形成可信冻结 manifest；candidate 引用外部 rule run；`rebuildOf` 缺 `datasetId/taskId/inputDigest`；executor 缺稳定 rebuild context；异步失败字段和 artifact 可见性未定义；正文/records 全量入内存；rename 后与 stale reservation 缺可靠接管。必须按“内核红灯与修复 -> 请求时冻结 -> 有界性能 -> 真实 API”关闭这些 P0 偏差。

## 2. 事实源与字段映射

JSON/JSONL 快照是唯一事实源。训练运行目录是中间不可变副本，数据集目录是候选版本的只读重建入口。

| Lineage 对象 | 生产事实源 | 映射规则 | 缺失/异常处置 |
|---|---|---|---|
| `source` | preparation 快照 `metadata/source-documents.jsonl`，补充 `source-resources.jsonl`；回放事实为候选数据集内已验证的 UTF-8 normalized 快照 | 按已确认 `G-LIN-01=1A` 生成 Schema `2.0` Source occurrence：逻辑身份为 `datasetId + resourceId + contentHash`，`sourceId=source:v2:sha256(canonical-json(logicalKey))`；`uri=sourcePath` 仅用于展示；`snapshotId` 保持指向已提交快照的安全相对路径；`contentHash` 按冻结 bytes 现场计算并与 `normalizedHash` 一致；`originalContentHash=originalHash` 仅作审计；`aclRef=dataset:{datasetId}` 仅表示继承边界 | 相同内容不同 resource 必须保留独立 occurrence；快照缺失、字节哈希不一致、来源路径缺失或安全路径解析失败时整体终止候选提交 |
| `chunk` | preparation 快照 `metadata/chunks.jsonl`，训练副本 `metadata/chunks.jsonl` | `sourceId` 由 source 映射；`ordinal=chunkIndex`；`offset=normalizedOffsets`；规范 chunk 文本严格取 `normalizedArtifact[offset.start:offset.end]`，`textHash/chunkHash` 对该 UTF-8 切片现场计算；`pageRef` 使用 `sourceLocations` 的精确页码，无可靠页码时为 `null` | 父 source 不存在、ordinal/offset 非法或规范切片不可验证：父链整体不完整，终止候选提交；不得用 overlap 拼接文本冒充规范切片 |
| `evidence` | formal 使用 `final-results/knowledge.jsonl`；keyword 使用 `extraction-results/keyword-candidates.jsonl` | `chunkId` 来自记录；`start/end` 一律是规范 chunk 切片内的本地 `[start,end)`；`quotedHash=sha256(canonicalChunk[start:end])`；`extractorVersion` 为实际规则/Agent 版本；`evidenceId` 由组件按 chunk+span 生成 | 单条 evidence 缺证据、偏移越界或无法映射时隔离到 `governance/lineage-issues.jsonl` 并写质量问题；不污染其余记录。若清单父链、快照或总指纹整体不可验证则终止候选提交 |

实际字段逐项映射如下，Worker 不得用相似字段名猜测：

| 目标字段 | 当前生产字段/计算来源 |
|---|---|
| `source.resourceKey` | `source-documents.resourceId`，保留原始精确字符串，作为 Source occurrence v2 逻辑身份组件和本次映射索引 |
| `source.sourceId` | `source:v2:` + `sha256(canonical-json({datasetId, resourceId, contentHash}))` 小写十六进制摘要；不直接拼接任何原始 ID |
| `source.uri` | `source-documents.sourcePath` |
| `source.snapshotId` | `_generate_*_dataset()` 已安全复制并提交的 normalized 快照相对路径；`G-LIN-01` 不改变现有物理布局，读取时继续执行 containment、普通文件、非 symlink 和单文件命中验证 |
| `source.contentHash` | 对 `snapshotId` 文件 `read_bytes()` 后计算 `sha256:`；必须等于 `sha256:` + `source-documents.normalizedHash` |
| `source.originalContentHash` | `sha256:` + `source-documents.originalHash`，仅审计 |
| `chunk.ordinal` | `chunks.chunkIndex` |
| `chunk.offset` | `chunks.normalizedOffsets.start/end` |
| `chunk.textHash` | 从冻结 normalized bytes 解码 UTF-8 后按 `offset` 取切片，再计算 `sha256:`；不得直接信任 `chunks.contentHash` |
| `chunk.pageRef` | `chunks.sourceLocations` 中可验证的页码/段落定位；没有则 `null` |
| formal `evidence.chunkId` | `knowledge.chunkId`；原记录 ID 为 `knowledge.knowledgeId` |
| formal `evidence.start/end` | 先读取 `knowledge.evidenceOffsets` 和 `knowledge.evidenceText`，再按 2.2 转为规范 chunk 本地偏移 |
| formal `extractorVersion` | `run-manifest.pipelineVersion` + 实际 formal skill/version 审计字段 |
| keyword `evidence.chunkId` | `keyword-candidates.chunkId`；原记录 ID 为 `candidateId` |
| keyword `evidence.start/end` | 在规范 chunk 切片中定位 `keyword-candidates.evidenceText` |
| keyword `extractorVersion` | 新 producer 直接写 `keyword-rule:v1:<ruleDescriptorHash>` 并引用同 run 已提交规则快照；legacy 仅可由该可信快照恢复，禁止用 `sourceMethod`、当前配置或源码常量拼接 |
| keyword `extractorSnapshotRef` | 新 candidate 引用同 run 的 `manifestPath/manifestHash/artifactPath/artifactHash`；legacy 恢复时作为解析上下文，不原地补写旧记录 |

### 2.1 Source occurrence v2 身份与路径

```text
logicalKey = canonical-json({
  "datasetId": exactDatasetId,
  "resourceId": exactResourceId,
  "contentHash": "sha256:" + normalizedByteDigest
})
sourceId = "source:v2:" + sha256(UTF-8(logicalKey))
```

- `canonical-json` 必须与 `sha256-v1` 指纹契约一致：字段字典序、无多余空白、UTF-8、禁止非有限 JSON 数值。`datasetId/resourceId` 必须非空，且不做 trim、大小写折叠或 Unicode 归一化。
- Source 记录显式保留 `resourceKey=resourceId`；验证器使用 manifest `datasetId`、`resourceKey`、`contentHash` 重算 `sourceId`。同一三元组必须稳定，任一组件变化必须得到不同 ID。
- `sourceId` 不作文件名。`G-LIN-01` 不授权迁移 dataset/normalized 物理目录；现有路径必须继续执行 realpath containment、普通文件、非 symlink 和单文件命中校验，任何新路径布局需另行评审。

### 2.2 Schema 兼容和歧义旧包

- Lineage 新构建仅写 `schemaVersion=2.0`；验证器显式分派 v2 与 v1，禁止将不识别的 Schema 当成任一兼容版本。
- `schemaVersion=1.0` 仅作不可变历史包验证和回放，不原地改写，不允许新建或重新发布。升级必须从同一已提交 preparation `source-documents` 事实重建新候选版本。
- v1 若只能证明 contentHash，不能唯一证明 `resourceId` occurrence，读取结果必须携带 `LEGACY_SOURCE_IDENTITY_AMBIGUOUS`；仅允许原父链范围内历史回放，门禁为 false。不得从 URI、文件名或数组顺序猜测 resource occurrence。

### 2.3 稳定引用和快照来源

- `datasetId` 在 `DatasetVersion` 创建时确定；`versionId` 首版使用候选数据集 ID，重建必须创建新候选数据集而不覆盖旧目录。
- preparation/metadata 的 `snapshot_ref`、`manifest_hash` 和 `commit.json` 由 `ArtifactRepository.read_committed_jsonl()` 验证。接线层不得读取 `latest.json` 作为事实内容，也不得绕过快照校验。
- preparation 的已提交快照是输入可信链；训练出口先把其 `normalizedArtifact` 原子复制到数据集内冻结路径，再以这个具体相对路径作为 source `snapshotId`。回放不依赖 preparation 的可变定位，也不加载原始 PDF/Office 字节；`originalHash` 仅用于追溯原件。
- Office/PDF 首版保证字符偏移；无法提供精确页码时 `pageRef=null`，不得推算页码。

### 2.4 evidence 本地偏移归一化

- formal 记录先校验 `evidenceOffsets` 能在运行时 chunk 内容中取到 `evidenceText`，再按 2.4 契约映射到 `normalizedOffsets` 对应的规范 chunk 切片。若运行时 chunk 含 overlap：在规范切片中唯一匹配则改写为规范 chunk 本地偏移；只在 `overlap.sourceChunkId` 的父 chunk 中匹配则重绑父 chunk；无匹配或多义且无法由来源位置消歧则隔离。
- keyword candidate 当前没有 offsets。适配器在候选指定 chunk 的规范切片中查找 `evidenceText`；相同文本多次出现时使用固定的最小本地 offset，并记录 `occurrenceIndex=0`，保证重建确定性；找不到时按单 evidence 隔离。
- evidence 的 `start/end` 不得写 source 全局偏移。source 全局位置由 `chunk.offset.start + evidence.start/end` 推导。

### 2.5 已确认 2A：规则快照与 legacy 解析

可信规则快照是独立的已提交运行产物，不是当前 `manifest.json` 中孤立的 `pipelineVersion` 或 `metadataRuleSetHash`。其描述符必须完整覆盖：producer 名称和实现版本、候选 Schema、pipeline 版本、实际规则/词典/模式配置的逐项版本与内容摘要、影响语义的配置摘要、输入契约版本。快照还记录 `runId` 和输入 snapshot 指纹，但后两项不参与规则语义版本摘要。

```text
extractorVersion = "keyword-rule:v1:" +
  sha256-v1(canonical-json(ruleSemanticFacts)).digest
```

解析优先级不是“显式字段优先、缺失时猜测”，而是按契约时代区分：

1. 新 candidate 必须同时有 `extractorVersion` 和 `extractorSnapshotRef`，两者均须与同 run 已提交快照重验一致；任一不一致即该记录无效。
2. legacy candidate 无论是否只有 `sourceMethod/schemaVersion`，仅在调用方提供同一 candidate run 的已提交规则快照，且 commit、manifest、artifact 和完整事实均验证成功时，才在内存映射为该快照的 `extractorVersion`。
3. 无快照、跨 run、哈希不一致或快照只含粗粒度版本名时，逐条隔离为 `LEGACY_EXTRACTOR_VERSION_UNPROVEN`；旧 JSONL 保持原字节，不生成迁移后副本冒充原产物。

目标 run 的双角色只读审计已经把该分支判定为第 3 类：55,324 条中 `RECOVERABLE=0`、`ISOLATE=55,324`，没有可信同 run 规则快照；run `training_c56bf44e9e6f4fc4` 与 dataset `dataset_1d7438983dc34062` candidate 各为 46,458,586 bytes，`cmp=0`，完整 SHA-256 为 `b23f0a8b73b9e72648a848c9b4ac4423c033adbc248725d1c6826ef1e79f3e92`，且记录结构合法、ID 唯一。实现时仍须现场重算摘要。该结论意味着“格式正确”和“同一阶段运行”都不足以恢复版本，不能为了提高接纳率放宽可信条件。

### 2.6 已确认 2C：当前批次规则重跑

当前批次采用“请求时冻结、新运行、新候选版本”恢复。API 对现有 dataset manifest、source facts、normalized 和 processing-units 现场校验并提交 `captureSemantics=request_time_snapshot` 的新冻结包，不能冒充原训练快照。新产物强制写 `rebuildOf={datasetId,taskId,inputDigest}`；旧产物均不修改。

`rebuildKey=sha256-v1(canonical-json({mode, ruleDescriptorHash, sortedInputSnapshotFingerprints}))`。同 key 的并发请求用短时 reservation/CAS 合并，规则计算在锁外按 resource 分片执行，最终按 resource/chunk/candidate 稳定排序后原子提交。已提交同 key 结果必须重验后幂等返回；不同摘要不得覆盖。2C 不解除 G-LIN-03，因而新候选在唯一发布权威目录未确认和接线前仍保持不可发布。

实现状态（2026-08-18）：请求时冻结、同 run 规则证据、完整 `rebuildOf`、执行上下文、崩溃接管、冻结包桥接和 API-A 基础触发已完成；生产训练出口已接入共用治理包 helper，完整事实 fixture 通过。性能内存门禁、API 扩展错误矩阵、真实训练出口端到端验收、G-LIN-03/04 和发布重验仍未完成。

`G-LIN-02-API=API-A` 已选定：保持请求字段不变，`keyword_analysis + sourceDatasetId` 表示请求时冻结重建。身份/状态轻校验同步执行；全量摘要、冻结和规则执行异步完成。第一阶段只在 `TaskSnapshot.progressDetail.rebuildResult` 暴露 artifact，不创建或冒充 DatasetVersion；禁止读取 `latest`。

## 3. 产物布局与写入顺序

候选数据集目录（`settings.data_root/datasets/{datasetId}/`）增加一个原子提交的只读治理包：

```text
governance/lineage-manifest.json       # LineageManifest.build() 输出
governance/lineage-verification.json   # 构建后立即 verify 的结果
governance/lineage-issues.jsonl        # 单 evidence 隔离问题
governance/version-fingerprint.json    # VersionFingerprint.build() 输出
```

训练运行目录（`training-runs/{taskId}/`）保留同构副本，用于审计和失败诊断：

```text
governance/lineage-manifest.json
governance/lineage-verification.json
governance/lineage-issues.jsonl
governance/version-fingerprint.json
rule-snapshots/keyword-rule.json          # 由同 run commit/manifest 哈希绑定
```

数据集业务 `manifest.json` 只保存引用和摘要，不复制大数组：

```json
{
  "lineage": {
    "manifestPath": "governance/lineage-manifest.json",
    "manifestFingerprint": {"algorithm": "sha256-v1", "digest": "...", "byteLength": 1234},
    "verificationPath": "governance/lineage-verification.json",
    "status": "verified"
  },
  "versionFingerprint": {
    "path": "governance/version-fingerprint.json",
    "fingerprint": {"algorithm": "sha256-v1", "digest": "...", "byteLength": 456},
    "status": "verified"
  }
}
```

`ArtifactRepository` 已提供 `write_json/write_jsonl` 的单文件原子写能力；治理包仍需先写入同一父目录下的 `.governance-staging-{uuid}`，完成哈希和自校验后用 `os.replace` 发布为 `governance/` 并 fsync 父目录。业务 `manifest.json` 引用随后原子写入，store 的 `manifest` gate 最后更新；中途崩溃最多留下未被 store 引用的治理包，不能产生“门禁已通过但文件未落盘”。不得使用 `latest.json` 指针作为提交标志。

## 4. 版本指纹组成与模式边界

`VersionFingerprint.build(graph, index, rule, model?, embedding?)` 的输入必须是可序列化且排序稳定的摘要：

| 组件 | `keyword_analysis` | `formal_knowledge` |
|---|---|---|
| graph | `nodes.json`、`edges.json`、`GRAPH_SCHEMA_VERSION`、`graphSource` | 同左，且必须标记 `graphSource=final_knowledge` 才允许进入正式图语义 |
| index | `processing-units.jsonl` 的 chunk ID/hash 排序摘要、`keyword-chunk-index.json` 或实际索引产物摘要 | 同左；没有实际向量索引时不得伪造 embedding |
| rule | metadata rule set hash、关键词规则版本、pipeline/schema 版本 | metadata rule set hash + formal 校验/合并规则版本 + pipeline/schema 版本 |
| model | 只有确实执行并持久化了模型调用快照时才填；纯规则关键词路径必须为 `null + not_applicable` | 当前 Agent 模型调用的 provider/model/skill 版本和调用摘要；模型配置不可读取时为失败，不得填空字符串 |
| embedding | 只有 metadata 快照存在已提交 embedding index 且能取得 provider/model/规则指纹时才填 | 同左 |

`keyword_analysis` 只生成可追溯的关键词图和 lineage，不满足 Entity/Relation 正式发布要求；`formal_knowledge` 是否可发布仍由 Entity/Relation、evidence、quality、evaluation、ACL 和 manifest 六项门禁共同决定。本设计不把“指纹已生成”解释为“已发布”。

## 5. 接线伪代码

```text
build_production_lineage(dataset, task, run_dir, chunks, final_results, mode):
  preparation = load_and_verify_committed_snapshot(run_dir.lineage.preparation)
  metadata = load_and_verify_committed_snapshot(run_dir.lineage.metadata)
  sources = map_sources(preparation.source_documents, preparation.source_resources)
  chunks = map_chunks(chunks, sources)
  evidence_input = final_results if mode == "formal_knowledge" else keyword_candidates
  rule_snapshot = verify_same_run_committed_rule_snapshot(run_dir) if mode == "keyword_analysis" else null
  evidence, isolated_issues = map_local_evidence(
      evidence_input, canonical_chunks, mode,
      extractor_resolver=KeywordExtractorVersion(rule_snapshot))
  manifest = LineageManifest.build(dataset.id, dataset.id, sources, chunks, evidence)
  verification = LineageManifest.verify(manifest)
  if not verification.valid:
      write_isolated_issues(verification.issues)
      fail_candidate("MANIFEST_VERIFICATION_PENDING")

  graph = {nodes: read(run_dir/"graph/nodes.json"), edges: read(run_dir/"graph/edges.json"),
           schemaVersion: GRAPH_SCHEMA_VERSION, graphSource: graph_source}
  index = stable_index_summary(run_dir, chunks)
  rule = rule_fingerprint(mode, metadata_manifest, pipeline_version)
  model = model_snapshot_if_used(run_dir, mode)
  embedding = embedding_snapshot_if_committed(run_dir)
  versions = VersionFingerprint.build(graph, index, rule, model, embedding)
  assert VersionFingerprint.verify(versions)

  atomic_commit_to_run_and_dataset(lineage=manifest, verification=verification,
                                   issues=isolated_issues, versions=versions,
                                   business_manifest_refs=refs)
  return {manifestStatus: "verified", versionStatus: "verified", refs}
```

```text
rebuild_legacy_keyword(legacy_run_ref, frozen_snapshot_refs, requested_rule_ref):
  inputs = verify_committed_normalized_inputs(frozen_snapshot_refs)
  rule = verify_committed_rule_snapshot(requested_rule_ref)
  require rule.mode == "keyword_analysis"
  key = stable_rebuild_key(inputs.fingerprints, rule.descriptorHash)
  reservation = reserve_by_dataset_and_key(key)
  if reservation.completed: return verify_and_return(reservation.result)

  target = create_new_run_and_candidate_version(rebuildOf=legacy_run_ref)
  candidates = bounded_parallel_rule_extract(inputs, rule, model_enabled=false)
  require model_call_count == 0
  require_all_candidates_reference(candidates, rule.extractorVersion, requested_rule_ref)
  stable_sort(candidates)
  commit_new_outputs_atomically(target, candidates, rule, inputs, key)
  complete_reservation_cas(key, target.fingerprints)
  return target
```

### 5.1 治理门禁更新时间点

1. `_prepare_materials_from_stage_outputs()` 完成后只写 source/chunk 的训练副本，不更新治理门禁。
2. `_generate_keyword_dataset()` / `_generate_dataset()` 完成 graph、index 和 evidence 候选后，构建并验证 lineage/version 产物。
3. 单 evidence 隔离后可用其余有效记录构建清单，同时把对应 `evidence`/`quality` gate 保持为 false；只有清单父链、快照和总指纹整体可验证时才具备 `manifest=true` 的资格。整体不可验证直接终止候选提交。
4. lineage、verification、issues、version fingerprint 和业务 manifest 引用全部原子提交成功后，才在同一 store 更新中把 `governance.gateChecks.manifest=true`；不得先置门禁再写文件。
5. 发布入口必须重新读取并验证 dataset 目录中的两个产物，再结合当前 ACL/quality/evaluation 检查；不能只信任 store 中历史 `gateChecks.manifest`。
6. CAS 成功后才更新 `state=published`、`governance.status=published` 和业务 manifest 的发布时间。验证失败或 CAS 冲突不改变发布指针。

实现记录（2026-08-18）：发布入口已对声明 `datasetPath` 的新生产候选重验治理包四文件、规范字节、Lineage/VersionFingerprint、normalized 快照和业务 manifest 引用；重验在状态转换/CAS 前执行，失败通过原 P0 gate 结构化阻断，`force=true` 不可绕过。旧无路径记录维持迁移兼容。

## 6. 失败隔离与错误分类

| 失败范围 | 结果 | 错误分类 |
|---|---|---|
| 单 evidence 记录损坏 | 写 `lineage/issues.jsonl` 和质量问题，跳过该 evidence；其余有效清单可提交，但 evidence/quality 门禁按问题等级保持 false | `LINEAGE_RECORD_INVALID` |
| legacy keyword 无可信同 run 规则快照 | 旧记录不修改；逐条隔离并保留可定位 producer ID/摘要；可由 2C 新运行恢复业务结果 | `LEGACY_EXTRACTOR_VERSION_UNPROVEN` |
| 新 candidate 版本与已提交规则快照不一致 | 违反 producer 契约，终止该新候选提交 | `EXTRACTOR_SNAPSHOT_MISMATCH` |
| 2C 输入 snapshot/规则 snapshot 不可验证 | 不启动或终止新运行，不创建可引用候选版本 | `ARTIFACT_INTEGRITY_ERROR` |
| 2C 规则路径发生模型调用 | 终止新候选提交，不把结果降级接纳 | `RULE_ONLY_CONTRACT_VIOLATION` |
| source/chunk 父链或 normalized snapshot 损坏 | 事实集合整体不可验证，终止候选提交，不更新 store 和 manifest gate | `ARTIFACT_INTEGRITY_ERROR` |
| 清单父链不完整、总指纹不一致、快照 manifest/commit/hash 不一致 | 当前候选版本不可发布；训练任务失败或进入可重试状态 | `MANIFEST_VERIFICATION_PENDING` / `ARTIFACT_INTEGRITY_ERROR` |
| graph/index/rule 必需输入缺失 | 不生成 version fingerprint，索引阶段失败 | `VERSION_FINGERPRINT_INVALID` |
| model/embedding 未启用 | 写 `null` + `not_applicable`，不算错误 | 无 |
| ACL、身份、审计不可用 | 由 RG-20 门禁拒绝；本接线不吞掉或伪造授权结果 | `ACL_EVALUATION_PENDING` / `ACL_DENIED` |

## 7. 测试矩阵

| 层次 | 用例 | 证据 |
|---|---|---|
| 适配器单测 | source/chunk/evidence 字段映射、稳定 ID、偏移和 quotedHash | 纯函数测试，覆盖缺父记录和单记录隔离 |
| 产线集成 | 使用真实 preparation/metadata 快照完成 keyword/formal 两种模式，检查运行目录和 dataset 目录双份产物 | FastAPI/TestClient 隔离批次，断言 manifest/version refs 和治理 gate |
| 原子性 | 在 lineage 写入任一步注入异常，确认业务 manifest、store 和发布指针均不变 | 故障注入测试 |
| 发布重验 | 篡改 lineage/version 文件后调用发布，必须 P0 阻断；恢复文件后才允许继续评估其他门禁 | 真实发布 API |
| 重建回放 | 删除/重建 graph 投影后，citation 的 chunk、偏移、quotedHash 保持一致 | RG-24 生产快照回放 |
| 模式边界 | keyword 模式 model=null/not_applicable 且 Entity/Relation=false；formal 模式按实际 Agent 调用记录 model | 两种隔离训练任务 |
| 2A legacy 版本 | 同 run 完整快照可恢复；缺失/跨 run/被篡改快照逐条隔离；当前配置和 `sourceMethod` 推断数为 0 | PL-A02 及 legacy 快照契约测试 |
| 2C 规则重跑 | 冻结输入创建新 run/version；旧产物摘要不变；同 key 并发只提交一次；模型调用数为 0 | 隔离 FastAPI 训练入口和文件摘要证据 |
| 大批次 | S/M/L（1k/10k/100k docs）仅测吞吐、磁盘和清单大小，不改变门禁语义 | 性能报告，不能以单元测试替代 |

## 8. 文件所有权与并发边界

| 任务 | 独占文件 | 依赖 | 可并行 |
|---|---|---|---|
| 事实适配器 | 新建 `production_lineage.py`、对应单测 | 无 | 可与发布设计并行 |
| 训练产线接线 | `training_service.py` 中两个 dataset 生成出口、对应集成测试 | 事实适配器 | 不与其他 `training_service.py` worker 并行 |
| 发布重验 | `services.py` 发布路径、对应发布测试 | 训练产线接线 | 与前端/ACL 设计并行；实现需串行 |
| 生产回放验收 | 新建真实 API/重建测试与验收报告 | 上述三项 | 不修改业务代码，可与文档汇总并行 |

本接线不拥有或修改 `acl_policy.py`、身份解析、中间件、图/证据查询授权和审计存储。RG-20/23 必须在安全方案确认后独立接入。

## 9. 已选方案与剩余参数

1. `G-LIN-02-API=API-A`：复用现有字段，请求时冻结后规则重建；第一阶段仅产出 task artifact。
2. `G-LIN-03=3A`：dataset governance 唯一发布权威，run 仅为审计镜像。
3. `G-LIN-04=4A`：`offsetUnit=unicode_code_point`，JavaScript 边界显式换算。
4. `G2-03`：可信网关 JWT、本地验签、dataset ACL、deny 优先、脱敏审计。`issuer/audience/JWKS URI/claims` 待部署提供，缺失时 fail-closed。

其余保留边界：
2. 生产版本是否把 `dataset.id` 同时作为 `versionId`：建议首版采用，若需要同一数据集多次重建，必须在实现前引入独立 `versionId` 字段并更新 API 契约。
3. embedding provider/version 的可信来源：未能从已提交快照取得时使用 `not_applicable`，不读取当前运行配置冒充历史事实。
4. Office/PDF 页码精确映射：首版保留字符偏移，`pageRef=null`；精确页码另立需求。
5. 快照保留期：本任务只记录引用，不删除任何快照，保留策略由安全/产品另行确认。

上述架构选择来自 2026-08-18 常设推荐方案授权；候选、理由、风险、回滚和边界见详细设计第 4.1 节。它不等于 JWT 参数已配置，也不授权写入、发布或删除目标生产 dataset。

## 10. 迁移、回滚与验收

- 上线：先上线 v1/v2 双读验证器和 v2 失败测试，再启用 v2-only writer；不扫描或改写已有清单。
- 回滚：如 v2 writer 失败，停止新候选构建并回退到“v1/v2 只读、新写关闭”；禁止重新启用 contentHash-only writer。已生成 v2 包保持不可变，不降级为 v1。
- 验收：PL-B01—B06 全部通过；两个同内容不同 resource 必须产生两个 source；恶意 ID 不能影响物理路径；v1 歧义包必须可诊断但不可升级/重发布。这些只验收 G-LIN-01，不解除其他 M2 门禁。
- G-LIN-02 上线：先部署可信规则快照读写与新 producer 契约，再启用 legacy 只读解析，最后对隔离数据执行 2C；回滚时停止新写和重跑，已提交新候选保持只读，绝不覆盖回 legacy。
- G-LIN-02 验收：新 candidate 版本证据覆盖率 100%；可信 legacy 恢复率 100%；不可信 legacy 定位隔离率 100%；当前状态推断为 0；2C 旧产物摘要前后完全一致、同 key 单一结果、模型调用为 0。它不代表 G-LIN-03/04、ACL 或发布门禁完成。
