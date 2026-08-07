# TASK-BUG-JSON-RACE-01: 知识加工产物并发竞争与错误隔离修复

## 元信息

- 类型: Bug 修复记录 / 并发设计
- 状态: completed（核心真实 API 已验证；大规模性能与租约回收列为残余风险）
- 分配: backend-worker / test-engineer / doc-writer
- 执行方式: Planner / Backend Worker / Test Engineer / Doc Writer / Reporter 多角色协作
- 创建: 2026-08-07
- 预计实现: 2026-08-08
- 依赖: TASK-SAP-01、TASK-RKE-02；实施链见 TASK-BUG-JSON-RACE-P0-01 至 P1-01
- 需人类确认: 否（方案 C 已由人类批准；范围扩张仍需另行确认）
- 可并行: 部分可并行，详见实施拆分

## Bug 摘要

批次 `batch_dc23fc9141ba4d6f` 的知识加工任务
`training_e35cdb0bbb4d4a46` 在资料预处理产物已经完成后失败。任务底层异常为：

```text
Unterminated string starting at: line 1 column 247 (char 246)
```

该任务运行模式为 `keyword_analysis`，模型调用数为 0。当前训练任务总异常处理却将普通异常统一交给模型网关错误摘要函数，最终错误地展示为“模型服务返回错误”。

现有日志未记录 JSON 文件路径、行号、字节偏移和读取快照，无法从历史产物反推出当时读取到的具体坏记录。现存 `source-documents.jsonl` 和 `chunks.jsonl` 已使用 Python JSON 解析器逐行复核，当前均有效。因此，本任务需要同时解决：

1. 运行产物的瞬时读写竞争；
2. 共享 `latest.json` 的逻辑指针竞争；
3. 同批次任务准入的检查后执行竞争；
4. 单条 JSONL 损坏的隔离与可追踪性；
5. 普通文件异常被误分类为模型异常。

## 当前竞争窗口

### 1. 同批次任务准入不是原子操作

当前启动逻辑先检查批次状态和 `activeTaskIds`，再创建任务并更新批次。两个并发请求可能同时通过检查，随后各自创建任务。

```text
请求 A: 检查无活动任务 -----------------> 创建任务 A
请求 B:      检查无活动任务 ------------> 创建任务 B
```

### 2. 下游通过共享 `preparation/latest.json` 重新定位输入

资料准备已经向调用方返回本次运行的 `manifestPath`，但元数据构建没有使用这个确定引用，而是重新读取批次级 `preparation/latest.json`。如果同批次其他准备任务更新指针，下游可能读取到另一运行的产物。

### 3. 固定 `.tmp` 文件名不能抵御多进程并发写

当前多个写入帮助函数使用 `target.json.tmp`。单进程单实例锁只能保护实例内线程；多个服务进程或多个服务实例写同一目标时会共享临时文件名，存在相互截断、替换或清理对方临时文件的风险。

### 4. `latest.json` 同时承担发现与正确性依赖

`latest.json` 适合给页面查询“最近结果”，不应成为正在运行的下游阶段选择输入的依据。较旧任务晚完成时还可能覆盖较新输入对应的 latest 指针。

### 5. JSONL 读取缺少结构化损坏上下文

元数据构建直接执行 `json.loads(line)`。解析失败时没有补充 `artifactPath`、`lineNumber`、`byteOffset`、文件哈希和快照 ID，也没有按记录隔离。

## 设计目标

1. 同一输入只计算一次，避免重复执行昂贵的扫描、转换和分块。
2. 长耗时计算不持锁；锁只覆盖任务准入和指针提交，目标持锁时间为毫秒级。
3. 下游只读取已经提交的不可变快照，不读取正在生成的目录。
4. 流水线内部不依赖共享 latest 指针传递输入。
5. 同一批次允许不同已提交快照被并行只读消费。
6. 单条可界定的 JSONL 损坏写入质量问题并隔离；整体产物无法验证时才终止阶段。
7. 线程、多进程部署下均正确；不新增外部依赖。
8. 错误分类必须区分模型网关、产物损坏、文件 I/O、转换和 Schema 错误。

## 推荐方案 C

采用“不可变快照 + 两阶段发布 + 短提交锁/CAS + single-flight”。

```text
任务准入短锁
  -> 固定 resourceSnapshotId / inputHash / configHash
  -> single-flight 查询或登记执行所有者
  -> 释放锁
  -> 在唯一 staging 目录执行长耗时计算
  -> 流式生成产物并同时计算 hash/count
  -> 校验完整性
  -> 写 commit.json（最后一个文件）
  -> 原子 rename 为不可变 runs/{runId}
  -> latest 提交短锁 + CAS
  -> 返回 ArtifactSnapshotRef
  -> 下游按 ArtifactSnapshotRef 无锁读取
```

### 核心接口

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

class ArtifactRepository:
    def begin_snapshot(self, batch_id, stage, run_id): ...
    def commit_snapshot(self, staging_root, manifest): ...
    def read_committed_jsonl(self, snapshot_ref, artifact_name): ...
```

`MetadataConstructionService.build()` 调整为接收确定的准备产物引用：

```python
def build(
    batch_id: str,
    preparation_snapshot: ArtifactSnapshotRef,
    parent_task_id: str | None = None,
    stage_run_id: str | None = None,
) -> MetadataBuildReport:
    ...
```

### 1. 不可变运行快照

- 每次执行写入唯一目录 `.staging/{runId}-{randomSuffix}`。
- 写入期间目录不对读取方可见，不更新 `latest.json`。
- 所有产物写完后校验必需文件、记录数、内容哈希和引用完整性。
- `commit.json` 最后生成，包含各产物的 `sha256`、字节数、记录数、Schema 版本和输入快照。
- staging 与正式目录必须位于同一文件系统；通过目录级 `os.replace()` 原子发布到 `runs/{runId}`。
- `runs/{runId}` 发布后只读，不再原地修改。

读取方只接受同时满足以下条件的运行：

```text
runs/{runId}/commit.json 存在
AND manifestHash 匹配
AND 所需产物均在 commit.json 中
AND 输入 snapshotRef 与调用方固定引用一致
```

### 2. 流水线显式传递快照，不读取 latest

```text
preparation.prepare()
  -> PreparationReport(snapshotRef=prepRef)
metadata.build(preparation_snapshot=prepRef)
  -> MetadataBuildReport(snapshotRef=metaRef)
training stage reads prepRef + metaRef
```

`latest.json` 仅用于页面发现、缓存命中和人工查询。它不再参与一次正在执行的流水线的正确性判断。

### 3. latest 指针使用短锁和 CAS

latest 指针结构增加：

```json
{
  "runId": "prep_xxx",
  "inputHash": "sha256:...",
  "manifestPath": "...",
  "manifestHash": "sha256:...",
  "generation": 42,
  "committedAt": "..."
}
```

提交规则：

1. 获取 `{batchId}:{stage}:latest` 提交锁；
2. 读取当前 generation；
3. 仅当 `expectedGeneration` 匹配且当前批次资源版本未前进时更新；
4. 使用唯一临时文件写入、`flush + fsync`、`os.replace`；
5. 释放锁；
6. CAS 失败不删除本次不可变运行，只是不将其设为 latest。

较旧输入的任务即使晚完成，也不能覆盖较新输入的 latest 指针。

### 4. 锁粒度与实现

锁分为两层，但业务代码通过统一协调器使用：

- 单进程线程层：按键创建 `threading.Lock/Condition`，减少文件锁系统调用。
- 多进程层：Linux 环境使用标准库 `fcntl.flock` 锁定 `.locks/{hashedKey}.lock`，进程退出时由内核释放。

不引入 Redis、数据库或第三方锁依赖。未来多主机部署时，将协调器实现替换为数据库 advisory lock 或带 fencing token 的租约锁，业务接口保持不变。

锁键和持锁范围：

| 锁键 | 保护内容 | 持锁范围 | 长耗时计算是否持锁 |
|---|---|---|---|
| `{batch}:admission` | 检查状态、创建任务、登记 activeTask | 一个短事务 | 否 |
| `{batch}:{stage}:{executionHash}` | single-flight 所有者登记/结果复用 | 登记或读取结果 | 否 |
| `{batch}:{stage}:latest` | latest generation CAS | 指针读取与替换 | 否 |
| `state-store` | `state.json` 跨进程读改写 | 一次读改写 | 否 |

禁止嵌套持有上述锁。操作顺序固定为“准入 -> 释放 -> 计算 -> single-flight 完成登记 -> 释放 -> latest CAS”，从设计上消除死锁环。

### 5. single-flight 去重

执行键：

```text
executionHash = hash(stageVersion + resourceSnapshotHash + configHash + ruleSetHash)
```

- 同键已有已提交产物：直接复用，零重复计算。
- 同键正在运行：后续任务订阅所有者进度，完成后复用同一 snapshotRef。
- 同批次但输入哈希不同：写不同不可变目录，可以并行；是否并行由 Worker 容量限制决定。
- 所有者失败：等待者收到失败结果，可重新竞争成为新所有者。

这比给整个批次加长锁性能更好，也避免两个相同任务重复消耗 20～60 分钟。

### 6. JSONL 单记录损坏隔离

读取器以流式方式逐行处理，并维护：

```text
artifactPath, snapshotId, lineNumber, byteOffset,
fileSize, fileMtimeNs, expectedHash, actualHash, errorClass
```

可隔离条件：

- 行边界明确，只有当前行解析失败；
- 其他记录仍可解析；
- 当前记录不是 manifest、commit 或 Schema；
- 隔离后可重新执行 ID 唯一性和跨文件引用校验；
- 损坏比例没有超过配置项 `artifactCorruption.maxRecordRatio/maxRecordCount`。

满足条件时：

- 不静默跳过；
- 写入 `quality/artifact-read-issues.jsonl`；
- 保存脱敏后的行首尾摘要和原始行哈希，不保存完整敏感正文；
- 当前资源标记 `isolated`，其余记录继续；
- 阶段结果为 `completed_with_warnings`。

以下情况判定整体产物不可验证并终止：

- `commit.json`、manifest 或 Schema 无法解析；
- 文件哈希与已提交快照不一致；
- 文件缺失、没有明确行边界或出现中间截断；
- 隔离后 ID 唯一性、来源关联或必需计数无法成立；
- 损坏记录超过配置阈值。

阈值进入版本化配置，不在代码中硬编码。

### 7. 唯一临时文件与持久化顺序

所有原子文件写入统一改为：

```python
fd, tmp = tempfile.mkstemp(prefix=f".{target.name}.", dir=target.parent)
try:
    write_all(fd, content)
    flush(fd)
    os.fsync(fd)
    os.replace(tmp, target)
    fsync(target.parent)
finally:
    unlink_if_exists(tmp)
```

唯一临时文件消除多进程共享 `.tmp` 冲突；目录 `fsync` 保证异常断电后重命名结果可恢复。大 JSONL 在写入时同步计算 hash/count，避免发布前重新完整读取一次。

### 8. 错误分类

```text
ModelGatewayError            -> 模型服务错误摘要
ArtifactRecordDecodeError    -> 产物记录损坏，可隔离
ArtifactIntegrityError       -> 产物整体完整性失败，阻断
FileNotFoundError/OSError    -> 文件系统错误
ConversionError              -> 文档转换错误
SchemaValidationError        -> Schema 校验错误
其他异常                     -> 知识加工内部错误 + traceId
```

只有 `ModelGatewayError` 允许产生“模型服务返回错误”文案。

## 冲突矩阵

| 操作组合 | 策略 | 原因 |
|---|---|---|
| 同批次两个加工启动请求 | admission 短锁，原子检查并登记 | 消除检查后执行竞争 |
| 相同输入的两个资料准备 | single-flight 合并 | 避免重复昂贵计算 |
| 不同输入版本的资料准备 | 独立快照，可并行计算，CAS 发布 | 不共享写目录 |
| 下载更新与资料准备 | 准备阶段固定 resourceSnapshotId | 加工期间不追随变化中的清单 |
| 资料准备与元数据构建 | 显式传递 prepRef，无锁读取已提交快照 | 不依赖 latest |
| 多个任务更新 latest | latest 短锁 + generation CAS | 防止旧任务覆盖新任务 |
| 多个任务更新 state.json | 跨进程 state-store 锁 | 当前 JsonStore 锁只覆盖单实例 |
| 多个下游读取同一快照 | 完全无锁 | 快照已经不可变 |

## 备选方案与优缺点

### 方案 A：整个批次全流程加互斥锁

优点：

- 实现最简单；
- 容易证明不会出现同批次写竞争；
- 适合作为短期止血开关。

缺点：

- 扫描、转换和分块期间长时间持锁，大批次可能锁定数小时；
- 相同快照的只读任务也被阻塞；
- 进程崩溃需要处理锁租约；
- 吞吐量最差，不满足性能最优目标。

结论：不作为正式方案，仅允许作为紧急 feature flag。

### 方案 B：仅使用唯一临时文件和原子替换

优点：

- 修改范围小；
- 文件级写入不会暴露半文件；
- 读取基本无额外开销。

缺点：

- 不能解决两个任务同时通过准入检查；
- 不能解决旧任务覆盖新 latest 的逻辑竞争；
- 不能避免相同输入重复计算；
- 不能保证下游读取的是本次上游产物。

结论：是必要基础能力，但单独使用不足以修复本 Bug。

### 方案 C：不可变快照 + 短锁/CAS + single-flight（推荐）

优点：

- 长耗时计算完全在锁外，读路径无锁；
- 同输入只计算一次；
- 下游输入确定，不受 latest 更新影响；
- 较旧任务不能覆盖较新任务；
- 支持线程和多进程，且不新增依赖；
- 运行产物天然可审计、可重试、可复用。

缺点：

- 需要调整阶段接口和产物发布协议；
- 需要处理 staging 清理、崩溃恢复和 CAS 未命中；
- 需要新增并发、故障注入和多进程测试；
- 未来多主机部署仍需替换锁实现。

结论：综合正确性、吞吐量和后续演进成本最优。

### 方案 D：数据库事务/分布式锁统一管理

优点：

- 多进程、多主机一致性最好；
- 状态查询、租约、fencing token 和审计能力完善。

缺点：

- 引入数据库或 Redis 依赖及运维成本；
- 当前本地 JSON 架构需要较大迁移；
- 对现阶段单机服务属于过度建设。

结论：作为多主机部署演进方案，本次不采用。

## 性能设计与验收指标

- 无竞争读取已提交快照时不获取文件锁。
- admission 和 latest CAS 的 P95 持锁时间目标小于 20ms。
- 相同 executionHash 的并发请求只产生一个实际运行目录。
- single-flight 等待者不轮询大文件，只订阅任务状态或条件变量。
- JSONL 写入一次完成 hash/count，不在提交前额外全量扫描。
- 不同批次可完全并行；同批次不同只读阶段可并行。
- 大批次并发修复后，单任务耗时相对无并发基线回退不超过 5%。

性能阈值应放入测试配置或性能基线文件，不写入业务判断代码。

## 实施拆分（SMART）

> 2026-08-07 Planner 已根据当前代码所有权边界将实施细化为独立任务卡。下列原始编号保留为设计追踪，执行以 `.codex/workflow/tasks/TASK-BUG-JSON-RACE-P0-01.md` 至 `TASK-BUG-JSON-RACE-P1-01.md` 为准。

### 实施依赖图

```text
P0-01 契约与设计
  -> P0-02 原子仓储/协调器/store
      -> P0-03 preparation 两阶段快照
          -> P0-04 committed reader/损坏隔离
              -> P0-05 metadata 显式快照
                  -> P0-06 training 原子准入/错误分类
                      -> P1-01 并发、故障注入、性能与真实 API 验收
```

### BUG-P0-01：错误类型与诊断上下文

- 工期: 2 小时
- 依赖: 无
- 可并行: 是
- 完成标准: 仅 `ModelGatewayError` 使用模型摘要；JSONL 错误包含路径、行号、偏移、快照和 traceId。

### BUG-P0-02：快照引用与两阶段发布

- 工期: 4 小时
- 依赖: 无
- 可并行: 否
- 完成标准: 准备报告返回 `ArtifactSnapshotRef`；元数据构建不读取 preparation latest；未提交目录不可读。

### BUG-P0-03：准入锁、single-flight 与 latest CAS

- 工期: 4 小时
- 依赖: BUG-P0-02
- 可并行: 否
- 完成标准: 并发启动只登记一个所有者；旧 generation 不能覆盖新 latest；锁外执行长任务。

### BUG-P1-01：单记录隔离与质量问题

- 工期: 3 小时
- 依赖: BUG-P0-01、BUG-P0-02
- 可并行: 是
- 完成标准: 可界定坏行被隔离并继续；整体完整性失败明确阻断；不静默丢记录。

### BUG-P1-02：并发与故障注入验证

- 工期: 4 小时
- 依赖: BUG-P0-03、BUG-P1-01
- 可并行: 否
- 完成标准: 覆盖线程、多进程、同键/异键、旧任务晚完成、截断 JSONL、进程中断和重启恢复。

## 测试方案

1. 两个线程同时调用同批次 `start()`，断言只创建一个有效加工所有者。
2. 两个进程同时写同一 latest，断言 JSON 始终完整且 generation 单调。
3. 旧输入任务晚于新输入完成，断言旧任务不能覆盖新 latest。
4. 元数据构建开始后更新 preparation latest，断言仍读取固定 prepRef。
5. 在 JSONL 中注入一个独立坏行，断言生成质量问题且其他记录继续。
6. 截断文件尾部或破坏 commit hash，断言整体产物被阻断。
7. 在 staging 写入中终止进程，断言正式 runs 目录不可见半成品。
8. 100 个并发读取者读取同一已提交快照，断言无锁等待和解析失败。
9. 使用真实后端 API 创建隔离批次，验证任务、事件、质量报告和重试链路。
10. 对大批次 fixture 对比修复前后吞吐、CPU、I/O 和锁等待时间。

## 验收标准

- [x] 同批次并发启动不存在检查后执行竞争。
- [x] 流水线内部不通过共享 latest 选择本次输入。
- [x] 所有共享指针写入使用唯一临时文件、fsync 和原子替换。
- [x] latest 提交使用 generation CAS，旧任务不能覆盖新任务。
- [x] 相同 executionHash 只执行一次昂贵计算。
- [x] 已提交不可变快照支持无锁并发读取。
- [x] 单记录损坏生成中文质量问题并隔离，不静默跳过。
- [x] 整体产物无法验证时明确阻断并保留诊断信息。
- [x] 普通文件异常不再展示为模型服务错误。
- [x] 聚焦单元测试、并发测试、故障注入测试和真实后端 API 验证通过。
- [x] 同步更新资料预处理、元数据构建、知识加工和错误处理设计文档。

## 实施结果

- 真实 API 并发启动返回 `202/409`，规则加工任务完成且模型调用为零。
- preparation/metadata 均发布不可变快照，训练清单记录完整 lineage。
- 聚焦回归的唯一失败已在修复前基线复现，不属于本次回归。
- admission/latest 锁 P95 为 0.0401ms；大规模单任务 5% 回退与遗留 flight 租约回收继续列入风险。

## 预计变更文件

- `scripts/pingcode/web/backend/app/training_service.py`
- `scripts/pingcode/web/backend/app/preparation_service.py`
- `scripts/pingcode/web/backend/app/metadata_service.py`
- `scripts/pingcode/web/backend/app/repositories/artifact_repository.py`
- `scripts/pingcode/web/backend/app/store.py`
- `scripts/pingcode/web/backend/tests/test_material_preparation.py`
- `scripts/pingcode/web/backend/tests/test_training_service.py`
- `docs/01-PingCode资料预处理步骤详细设计.md`
- `docs/08-pingcode-processing-six-step-pipeline-design.md`
- `.codex/workflow/tasks/TASK-BUG-JSON-RACE-01.md`

## 执行日志

- 2026-08-07：完成历史任务产物、错误事件、资料准备产物和当前读写路径的只读分析。
- 2026-08-07：确认本次任务模型调用数为 0，普通 JSON 异常被错误映射为模型服务错误。
- 2026-08-07：完成并发竞争修复设计；尚未修改功能代码，等待人类确认。
- 2026-08-07：人类批准方案 C；Planner 完成 7 张 SMART 实施任务卡及串行依赖拆分，尚未修改功能代码。
