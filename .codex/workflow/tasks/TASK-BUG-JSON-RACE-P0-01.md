# TASK-BUG-JSON-RACE-P0-01: 冻结快照与协调接口契约

## 元信息
- 状态: completed（设计契约已冻结；功能实现由 P0-02 至 P1-01 执行）
- 分配: doc-writer / backend-worker
- 创建: 2026-08-07
- 预计完成: 2026-08-07
- 预计工时: 3 小时
- 依赖: 无
- 需人类确认: 否（方案 C 已批准）
- 可并行: 否（后续功能任务的设计门禁）

## SMART 目标
在 3 小时内先完成不可变快照、两阶段发布、短锁/CAS、single-flight、损坏隔离和错误分类的接口设计与伪代码，并冻结后续任务共同依赖的数据契约。

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

class BatchOperationCoordinator:
    def admit(self, batch_id, operation, idempotency_key): ...
    def single_flight(self, batch_id, stage, execution_hash): ...
    def commit_latest(self, snapshot_ref, expected_generation): ...
```

## 实施范围
- 更新 `docs/01`、`docs/08`、`docs/11`、`docs/18`、`docs/21`，明确流水线只传递 `ArtifactSnapshotRef`，`latest.json` 仅用于发现。
- 定义 staging、`commit.json`、manifest、latest generation、single-flight 状态和错误类型 Schema。
- 在 `models.py` 设计 `PreparationReport/MetadataBuildReport` 的向后兼容字段；不删除现有路径字段。
- 定义版本化 `artifactCorruption` 配置位置和默认值，禁止业务代码硬编码阈值。

## 验收标准
- [x] 设计文档先于功能代码更新，并含完整接口、伪代码、状态机、锁顺序和失败语义。
- [x] 快照、commit、latest、single-flight、质量问题和异常字段可被 JSON 序列化且命名唯一。
- [x] 明确旧报告字段的兼容期与读取优先级，不修改公共 HTTP API。
- [x] 后续六张任务卡均可引用本契约独立实施，无待定架构问题。

## 预计变更文件
- `docs/01-PingCode资料预处理步骤详细设计.md`
- `docs/08-pingcode-processing-six-step-pipeline-design.md`
- `docs/11-PingCode元数据构建步骤详细设计.md`
- `docs/18-PingCode知识提取与构建测试设计.md`
- `docs/21-TrainingService分层重构详细设计.md`
- `scripts/pingcode/web/backend/app/models.py`
- `scripts/pingcode/processing/artifact-integrity.yaml`（新增）

## 文档交付记录

- 2026-08-07 Doc Writer：更新 `docs/01/08/11/18/21`，冻结 `ArtifactSnapshotRef`、staging/manifest/commit/latest、single-flight、短锁/CAS、损坏隔离、异常分类、兼容优先级和真实 API 验收契约。
- 规范性跨阶段字段以 `docs/08` 第 16 节为唯一基线；`docs/01`、`docs/11` 和 `docs/21` 分别补充生产者、消费者与仓储协调边界，`docs/18` 补充并发和故障注入矩阵。
- 本任务只完成设计门禁，未修改功能代码、`models.py` 或 `artifact-integrity.yaml`，也未执行提交。`artifact-integrity.yaml` 由实现角色落盘后，Doc Writer 已核对其 `/v1` Schema、`0.001/10` 阈值与设计一致，并按目录约束同步 `scripts/pingcode/processing/README.md`；其余实现由后续 P0-02 至 P0-06 任务负责。
