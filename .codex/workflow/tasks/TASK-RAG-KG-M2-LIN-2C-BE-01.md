# TASK-RAG-KG-M2-LIN-2C-BE-01：冻结输入规则重建内核实现

## 元信息

- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-18
- 预计完成: 2026-08-19（4h）
- 父任务: TASK-RAG-KG-M2-LINEAGE-REWORK-01 / G-LIN-02 / 2C
- 依赖: TASK-RAG-KG-M2-LIN-2C-TST-01 红灯证据符合预期
- 需人类确认: 否（已批准 2C 的内核能力；不改公共 API、技术栈、ACL 或发布语义）
- 可并行: 否；与任何 `production_lineage.py` Worker 串行
- 文件归属: `scripts/pingcode/web/backend/app/production_lineage.py`；不修改 `training_service.py`、`models.py`、`main.py`、`services.py` 和公共 API 测试

## SMART 目标

在 4 小时内实现 `KeywordRuleRebuild` 内核，使已验证的冻结输入与同 run 规则快照能产生稳定 `rebuildKey`，以短临界区 reservation/CAS 合并同 key 并发执行，并原子提交独立的新 run/候选结果；全部 2C 内核测试通过，旧产物保持字节不变。

## 实现契约

```text
KeywordRuleRebuild.execute(
  frozen_source_refs,
  committed_rule_snapshot_ref,
  legacy_ref,
  extraction_executor
) -> RebuildResult

RebuildResult = {
  rebuildRunId,
  candidateVersionId,
  rebuildKey,
  rebuildOf,
  sourceSnapshotFingerprints,
  ruleSnapshotRef,
  candidateCount,
  isolatedCount,
  state,
  resultFingerprint
}
```

- `rebuildKey=sha256-v1(canonical-json({mode,ruleDescriptorHash,sortedInputSnapshotFingerprints}))`。
- key 只使用已验证快照和规则语义事实，不使用 mtime、当前配置、Git 时间或 `latest.json`。
- 预留与最终 CAS 使用 `rebuildKey` 粒度短锁；规则计算和稳定排序在锁外执行。
- 已提交同 key 结果必须重验指纹后幂等返回；损坏结果不得被当作成功。
- candidate 提交前按 resource/chunk/candidate 稳定排序，每条记录必须引用本次已提交规则快照。
- `legacy_ref` 只写入 `rebuildOf`，旧 run、candidate、graph、index、manifest 不得写入、touch 或作为 staging 目录。
- 任何模型调用或模型状态非 `not_applicable` 均以 `RULE_ONLY_CONTRACT_VIOLATION` 终止。

## 实现伪代码

```text
execute(inputs, rule_ref, legacy_ref, rule_executor):
  verified_inputs = verify_committed_frozen_inputs(inputs)
  verified_rule = KeywordRuleSnapshot.verify(rule_ref, same_run=true)
  key = stable_rebuild_key(verified_inputs, verified_rule)

  reservation = reserve(key)
  if reservation.completed:
    return verify_committed_result(reservation.result)

  try:
    result = rule_executor(verified_inputs, model_enabled=false)
    require result.modelCallCount == 0
    validate_versions_and_stable_sort(result.candidates, verified_rule)
    staged = write_new_run_and_candidate_staging(result, rebuildOf=legacy_ref)
    committed = atomic_commit_and_fsync(staged)
    return complete_reservation_cas(key, committed.fingerprint)
  except:
    abandon_reservation_without_touching_legacy(key)
    raise
```

## 验收标准

- [x] TASK-RAG-KG-M2-LIN-2C-TST-01 的 2C-T01—2C-T09 全部通过。
- [x] 相同 key 并发最多一个完整结果；不同 key 不被全局锁串行。
- [x] 旧产物 bytes/SHA-256/mtime 前后不变，中途失败无可引用的半成品。
- [x] 输入、规则、路径或已提交结果的完整性异常均 fail-closed。
- [x] 没有新外部依赖，没有读取共享 `latest.json`，没有公共路由或 Schema 改动。
- [x] 聚焦测试、现有 lineage/producer 回归、`py_compile` 和目标文件 `git diff --check` 通过。

## 实施记录

- 实现文件：`scripts/pingcode/web/backend/app/production_lineage.py`。
- 实现 `KeywordRuleRebuild`/`KeywordRebuildResult`：冻结 manifest/artifact 摘要和路径校验、稳定 `rebuildKey`、按 key reservation、锁外规则计算、原子新 run 提交、结果重验和失败重试。
- 规则执行器返回的 candidate 必须带同一 `extractorVersion/extractorSnapshotRef`，模型调用计数为 0，状态为 `not_applicable`；legacy 仅写入 `rebuildOf`，不触碰旧产物。
- 验收：2C 专项 9/9 通过；与既有 2A、lineage、回放、指纹和 training service 组合回归 175 项，173 passed、2 skipped、0 failed。

## 不构成完成的证据

本任务绿灯只证明 2C 内核可用，不证明 `sourceDatasetId` 已能触发重建、不证明目标 55,324 条 legacy 已恢复，不解除 G-LIN-03/04、ACL、publish 或 G2.5 门禁。
