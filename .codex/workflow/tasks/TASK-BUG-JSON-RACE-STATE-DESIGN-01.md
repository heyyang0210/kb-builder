# TASK-BUG-JSON-RACE-STATE-DESIGN-01: 固化快照状态机与接口伪代码契约

## 元信息
- 状态: pending
- 分配: doc-writer / test-engineer
- 创建: 2026-08-07
- 预计完成: 2026-08-07
- 预计工时: 2 小时
- 依赖: TASK-BUG-JSON-RACE-P0-01（已完成）
- 需人类确认: 否（仅校准已批准方案 C 的文档与测试契约，不改变公共 API 或实现）
- 可并行: 否

## SMART 目标

在 2 小时内补齐一份与当前实现一致的快照/协调状态机和接口伪代码契约，使 `TASK-BUG-JSON-RACE-test-design.md` 不再依赖“待 P0-01 冻结”的未完成前置，并让后续测试按唯一状态与字段断言。

## 状态机设计

```text
Snapshot:
  absent -> staging -> validating -> committed
                 |          |             |
                 v          v             v
              failed     failed       superseded (仅 latest 指针，不删除快照)

Latest CAS:
  read generation N
    -> compare expectedGeneration
      -> committed generation N+1
      -> cas_conflict（快照保留，latest 不变）

Single-flight:
  absent -> owner_registered -> running -> succeeded(snapshotRef)
                                      -> failed(retryable)
  waiter -> waiting -> succeeded(snapshotRef) | failed(error)

Admission:
  idle -> checking -> owner_registered -> active
  checking -> conflict（已有 active owner）
```

规则：`staging` 和 `validating` 不可被下游发现；只有存在合法 `commit.json` 的 `committed` 运行可被读取；CAS 冲突不等于计算失败；owner 失败后等待者不得复用未提交结果。

## 接口与伪代码

```python
@dataclass(frozen=True)
class ArtifactSnapshotRef:
    batch_id: str
    stage: str
    run_id: str
    input_hash: str
    manifest_path: str
    manifest_hash: str
    generation: int

class ArtifactRepository(Protocol):
    def begin_snapshot(self, batch_id: str, stage: str, run_id: str) -> Path: ...
    def commit_snapshot(self, staging_root: Path, manifest: dict) -> ArtifactSnapshotRef: ...
    def read_committed_jsonl(self, ref: ArtifactSnapshotRef, artifact_name: str, policy: dict): ...

class BatchOperationCoordinator(Protocol):
    def admit(self, batch_id: str, operation: str, idempotency_key: str): ...
    def single_flight(self, batch_id: str, stage: str, execution_hash: str): ...
    def commit_latest(self, ref: ArtifactSnapshotRef, expected_generation: int) -> bool: ...
```

```python
def run_stage(batch_id, stage, execution_hash):
    flight = coordinator.single_flight(batch_id, stage, execution_hash)
    if not flight.owner:
        return flight.wait()
    try:
        staging = artifacts.begin_snapshot(batch_id, stage, new_run_id())
        result = compute_and_validate(staging)  # 锁外执行
        ref = artifacts.commit_snapshot(staging, result.manifest)
        coordinator.commit_latest(ref, expected_generation=result.expected_generation)
        flight.succeed(ref)
        return ref
    except Exception as exc:
        flight.fail(classify_artifact_error(exc))
        raise
```

## 任务范围

- 将状态机、转换条件、终态、CAS 冲突和 owner/waiter 失败语义写入 `TASK-BUG-JSON-RACE-test-design.md` 的契约章节。
- 对照 P0-01 及 `docs/08` 第 16 节，统一 `ArtifactSnapshotRef`、commit/latest、generation、single-flight 和错误类型字段名。
- 为 AR/CO/CAS/SS/JL/API 测试矩阵逐项标注状态机前置、成功终态和失败终态；不新增未批准的测试行为。
- 记录 staging 重启恢复、坏行隔离和整体完整性失败的最终状态断言；不修改业务代码、接口实现或生产配置。

## 验收标准

- [ ] 状态机覆盖 staging、validating、committed、failed、cas_conflict、superseded、owner 和 waiter 状态，且转换无歧义。
- [ ] 所有接口/伪代码中的字段与 P0-01、`docs/08` 唯一基线一致，无同名异义字段。
- [ ] 每个并发/故障测试场景均能映射到明确的状态、事件或错误类型；不得以固定 sleep 推断状态。
- [ ] `TASK-BUG-JSON-RACE-test-design.md` 不再声明等待 P0-01 契约冻结，改为引用本任务和已完成 P0-01。
- [ ] 只新增或修改 `.codex/workflow/tasks/` 文档，未修改业务代码、设计文档或测试实现。

## 参考文档

- `.codex/workflow/tasks/TASK-BUG-JSON-RACE-P0-01.md`
- `.codex/workflow/tasks/TASK-BUG-JSON-RACE-test-design.md`
- `docs/08-pingcode-processing-six-step-pipeline-design.md`
- `docs/21-TrainingService分层重构详细设计.md`

## 预计变更文件

- `.codex/workflow/tasks/TASK-BUG-JSON-RACE-STATE-DESIGN-01.md`（新增）
- `.codex/workflow/tasks/TASK-BUG-JSON-RACE-test-design.md`（后续执行时修改；本 Planner 任务不修改）

## 执行日志

- 2026-08-07 Planner：发现 P0-01 已完成而测试设计仍标记“等待契约冻结”；创建状态机与接口/伪代码一致性校准任务卡，限定为工作流文档范围。
