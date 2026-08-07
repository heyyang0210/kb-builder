# TASK-BUG-JSON-RACE-P0-02: 实现原子仓储与批次协调器

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-07
- 预计完成: 2026-08-07
- 预计工时: 4 小时
- 依赖: TASK-BUG-JSON-RACE-P0-01
- 需人类确认: 否
- 可并行: 否

## SMART 目标
在 4 小时内实现线程/多进程安全的原子文件写、`JsonStore` 读改写锁和统一 `BatchOperationCoordinator`，锁内只执行状态登记或指针 CAS，不执行扫描、转换、分块或哈希全量计算。

## 接口与伪代码
```python
with coordinator.lock(f"{batch_id}:admission"):
    owner = coordinator.admit(...)

flight = coordinator.single_flight(batch_id, stage, execution_hash)
if flight.is_owner:
    result = compute_without_lock()
    flight.complete(result)
else:
    result = flight.wait()
```

## 实施范围
- `LocalArtifactRepository` 使用唯一同目录临时文件、`flush/fsync/os.replace` 和目录 `fsync`；移除共享固定 `.tmp`。
- 新增 `BatchOperationCoordinator`，组合按键线程锁与标准库 `fcntl.flock`，禁止嵌套锁。
- `JsonStore` 的读取、写入、put/update 使用跨进程 `state-store` 锁及原子持久化。
- 更新 `repositories/README.md`，记录快照仓储、锁边界和故障恢复语义。

## 验收标准
- [x] 两进程并发写同一 JSON/`state.json` 始终可解析且无丢失更新。
- [x] 唯一临时文件不会互删，替换失败保留旧目标并清理本次临时文件。
- [x] admission、single-flight 登记和 latest CAS 接口可注入测试；无外部依赖。
- [x] 锁顺序固定且没有任何长耗时操作位于锁内。
- [x] 仓储与 store 聚焦测试通过，README 同步。

## 预计变更文件
- `scripts/pingcode/web/backend/app/repositories/artifact_repository.py`
- `scripts/pingcode/web/backend/app/repositories/README.md`
- `scripts/pingcode/web/backend/app/batch_operation_coordinator.py`（新增）
- `scripts/pingcode/web/backend/app/store.py`
- `scripts/pingcode/web/backend/tests/test_artifact_repository.py`
- `scripts/pingcode/web/backend/tests/test_store_concurrency.py`（新增）
- `scripts/pingcode/web/backend/tests/test_batch_operation_coordinator.py`（新增）
