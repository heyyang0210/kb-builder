# TASK-BUG-JSON-RACE-P0-03: 将资料准备改为不可变两阶段快照

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-07
- 预计完成: 2026-08-07
- 预计工时: 4 小时
- 依赖: TASK-BUG-JSON-RACE-P0-02
- 需人类确认: 否
- 可并行: 否

## SMART 目标
在 4 小时内让 `MaterialPreparationService.prepare()` 按 executionHash single-flight，在唯一 staging 目录生成并校验全部产物，最后原子发布不可变运行并返回 `ArtifactSnapshotRef`。

## 接口与伪代码
```python
execution_hash = hash(stage_version, resource_snapshot_hash, config_hash)
with coordinator.single_flight(batch_id, "preparation", execution_hash) as flight:
    if flight.reusable: return flight.snapshot_ref
    staging = artifacts.begin_snapshot(...)
    manifest = build_and_hash_artifacts(staging)
    snapshot_ref = artifacts.commit_snapshot(staging, manifest)
    coordinator.commit_latest(snapshot_ref, expected_generation)
    return report(snapshot_ref=snapshot_ref)
```

## 实施范围
- 生成 `.staging/{runId}-{random}`，正式 `runs/{runId}` 在 commit 前不可见。
- 写入期间累计 SHA-256、字节数和记录数；`commit.json` 最后写入并校验引用完整性。
- 目录级原子发布后禁止原地修改；CAS 失败仅不更新 latest，不删除快照。
- preflight 与训练调用可复用相同 executionHash 的已提交快照。

## 验收标准
- [x] 相同 executionHash 的并发准备只产生一个正式运行目录和一个实际计算所有者。
- [x] staging 中途失败或进程终止不暴露 `runs/{runId}` 半成品。
- [x] `PreparationReport` 同时返回兼容路径和完整 `snapshotRef`。
- [x] `commit.json` 覆盖必需产物 hash/count/schema/input，提交后产物只读。
- [x] CAS 失败保留可审计快照，旧输入不能覆盖新 latest。

## 预计变更文件
- `scripts/pingcode/web/backend/app/preparation_service.py`
- `scripts/pingcode/web/backend/app/models.py`
- `scripts/pingcode/web/backend/tests/test_material_preparation.py`
- `scripts/pingcode/web/backend/tests/test_preparation_integration.py`
