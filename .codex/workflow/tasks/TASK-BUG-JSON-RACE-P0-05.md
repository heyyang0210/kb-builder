# TASK-BUG-JSON-RACE-P0-05: 元数据构建显式消费准备快照

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-07
- 预计完成: 2026-08-07
- 预计工时: 4 小时
- 依赖: TASK-BUG-JSON-RACE-P0-03、TASK-BUG-JSON-RACE-P0-04
- 需人类确认: 否
- 可并行: 否

## SMART 目标
在 4 小时内将 `MetadataConstructionService.build()` 改为显式接收准备快照，使用已提交读取器构建自身不可变快照，并彻底移除运行中流水线对 `preparation/latest.json` 的正确性依赖。

## 接口与伪代码
```python
def build(batch_id, preparation_snapshot, parent_task_id=None, stage_run_id=None):
    source_docs = artifacts.read_committed_jsonl(preparation_snapshot, "metadata/source-documents.jsonl")
    chunks = artifacts.read_committed_jsonl(preparation_snapshot, "metadata/chunks.jsonl")
    execution_hash = hash(version, preparation_snapshot.manifest_hash, rule_set_hash)
    return build_commit_and_report(snapshot_ref=meta_ref, input_snapshot=preparation_snapshot)
```

## 实施范围
- 删除 `_latest_preparation()` 在流水线内部的使用；页面发现/显式兼容入口可单独解析 latest 后立即固定 ref。
- 元数据输出采用 staging、commit、原子目录发布和 latest CAS。
- `MetadataBuildReport` 返回 metadata `snapshotRef` 并记录完整 preparation input ref。
- 传播坏行隔离质量问题；整体完整性失败不进入 `build_records()`。

## 验收标准
- [x] 元数据构建开始后任意更新 preparation latest，结果仍只来自传入快照。
- [x] 相同 executionHash 并发构建只执行一次，缓存复用只接受已提交快照。
- [x] metadata commit 记录 input snapshot、规则 hash、产物 hash/count 和 Schema。
- [x] 无传入快照的内部调用在类型/测试层失败；兼容 HTTP 行为不变。
- [x] 现有元数据规则与 embedding/cluster 降级语义回归通过。

## 预计变更文件
- `scripts/pingcode/web/backend/app/metadata_service.py`
- `scripts/pingcode/web/backend/app/models.py`
- `scripts/pingcode/web/backend/tests/test_material_preparation.py`
- `scripts/pingcode/web/backend/tests/test_preparation_integration.py`
