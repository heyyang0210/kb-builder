# TASK-TRAINING-8053-BE-FIX: 资料预处理重复扫描与取消传播修复设计

## 元信息

- 角色: Backend Worker
- 状态: 代码完成待真实 API 验证
- 日期: 2026-08-07
- 关联任务: `TASK-TASKRUN-B1A74-01`、`TASK-TRAINING-8053-test-design`
- 关联风险: `RISK-TRAIN-8053-001`、`RISK-TRAIN-8053-002`
- 目标批次: `batch_dc23fc9141ba4d6f`
- 现场任务: `training_f1d9f8e63a184098`
- 文件归属（实施阶段）: Backend Worker 独占 `training_service.py`、`services.py`、`test_training_service.py`；Test Engineer 在补丁完成后串行执行真实 API 验收
- 实施确认: 2026-08-07 已确认采用方案 A

## 根因

`TrainingService._prepare_materials_from_stage_outputs` 在 `PreparationService.prepare` 前同步调用 `self.preprocess.scan(request.batch_id)`。该调用未传 `lightweight=True`，会对 1,694 个可转换文档逐个执行预览转换并反复启动 LibreOffice。其返回值只用于后续汇总 `unsupportedFiles`，不参与 preparation 和 metadata 快照正确性，因此属于重复的非轻量扫描。

父训练任务只在完整 `scan()` 返回后检查取消。`cancel` API 虽将状态写为 `cancelling`，扫描内部没有取消回调，仍会继续启动新 LibreOffice 子进程，造成任务和批次长期不能进入终态。阶段又没有扫描进度回调，因此用户看到 `current=0,total=null`，无法区分慢处理与卡死。

## 方案比较

| 方案 | 内容 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- | --- |
| A | 训练编排优先读取已有扫描报告；缺失或无效时只做可取消轻量扫描；继续调用现有 `prepare` 复用 single-flight 快照 | 改动最小；不改公共 API；移除重复预览转换；保留统计和冷缓存进度 | 冷缓存仍需文件哈希；preparation 自身进度需后续单独增强 | 推荐实施 |
| B | 预检响应新增 preparation `snapshotRef`，启动请求显式携带并固定该引用 | 热路径最快，预检和正式运行输入最明确 | 改公共契约；当前轻量预检不总生成 preparation；部分下载恢复会引入快照失效语义 | 本任务不实施 |
| C | 完全删除扫描，全部统计从 preparation 快照推导 | 代码最少，不再扫描 | 冷缓存生成前无源文件检查进度；无法复用现有扫描报告 | 不采用 |

选择方案 A。它不改变 `formal_knowledge` 的 Workflow Agent/模型网关边界，不恢复 `semantic_enrichment`，不新增依赖，不改变 HTTP 路径、请求或响应字段。

## 内部接口契约

```python
def TrainingService._scan_for_material_preparation(
    self,
    task_id: str,
    batch_id: str,
) -> ScanReport: ...

def PreprocessService.scan(
    self,
    batch_id: str,
    *,
    lightweight: bool = False,
    progress: Callable[[int, int, int, int], None] | None = None,
    cancel_check: Callable[[], None] | None = None,
) -> ScanReport: ...
```

- `cancel_check` 是可选的内部关键字参数，默认行为与现有调用方一致。
- 训练回退扫描固定传 `lightweight=True`，禁止预览转换和 LibreOffice。
- 每个资源开始前、完成后以及任何外部转换启动前调用 `cancel_check`；进度日志可节流，取消检查不可节流。
- 进度回调更新父训练任务 `material_preparation` 的 `current/total/unit`，并写结构化 `material_preparation.scan.progress` 事件。
- 既有 HTTP API 和四阶段 ID/响应字段不变。

## 缓存与快照复用

1. `scan-report/latest.json` 只作为统计缓存。可解析、Schema 有效且 `batchId` 一致时复用；缺失或无效时记录原因并回退轻量扫描。它不作为 preparation 正确性输入。
2. `PreparationService.prepare` 继续以 `pipelineVersion + inputManifestHash + config` 计算 `executionHash`。仅当 single-flight 状态为 `completed` 且 `snapshotRef` 通过 commit、manifest、哈希和必需产物校验时复用。
3. 输入资源、配置或流水线版本任一变化，必须得到不同 `executionHash` 并生成新快照。
4. `prepare` 返回后固定使用其 `snapshotRef` 构建 metadata；运行中不得回退到共享 `preparation/latest.json`。
5. 本任务不新增预检 snapshot 字段。显式把预检快照传入启动请求属于公共契约优化，另立任务评审。

## 伪代码

```text
prepare_from_stage_outputs(task):
  set_stage(material_preparation, running)
  log scan.started
  try:
    scan = latest_scan_report(batchId)
    assert scan.batchId == batchId
    source = latest_scan_report
  catch missing_or_invalid_report:
    log scan.cache_invalid when invalid
    scan = preprocess.scan(
      batchId,
      lightweight=true,
      cancel_check=lambda: raise_if_cancelled(taskId),
      progress=lambda current,total,failed,warnings:
        update_parent_stage_and_emit_progress(...)
    )
    source = lightweight_scan
  raise_if_cancelled(taskId)
  log scan.completed(source, counts, duration)

  log prepare.started
  report = preparation.prepare(batchId, config, parentTaskId, stageRunId)
  # prepare 内部按 executionHash 复用已提交快照
  raise_if_cancelled(taskId)
  log prepare.completed(report.snapshotRef.runId, counts, duration)

  metadata = metadata.build(preparation_snapshot=report.snapshotRef, ...)
  load_and_validate_artifacts(report.snapshotRef, metadata.snapshotRef)
```

## 取消语义

- `cancel` API 仍先返回 `cancelling`，后台执行线程捕获 `TrainingCancelledError` 后写阶段取消事件、任务终态并恢复批次 admission。
- 从 API 返回 `cancelling` 起 3 秒内：不再启动新资源处理，不再创建新 LibreOffice 子进程，任务进入 `cancelled`。
- 轻量扫描按资源边界检查取消；若单文件哈希可能超过 3 秒，实施时将文件哈希改为分块读取并在分块间检查取消，不引入新依赖。
- 取消不是 `failed`，不得写模型错误摘要或把任务设为可重试失败。

## 错误分类

| 场景 | 分类/行为 | 用户摘要 |
| --- | --- | --- |
| 扫描报告不存在 | 正常回退 | 无错误；提示正在执行轻量扫描 |
| 扫描报告 JSON/Schema 无效 | `scan_cache_invalid`，警告后回退 | 扫描缓存不可用，已重新检查源文件 |
| 父任务取消 | `TrainingCancelledError`，进入取消终态 | 用户已取消任务 |
| 文件读取失败 | `file_io` | 文件读取或写入失败 |
| 已提交快照不可验证 | `artifact_integrity` | 产物完整性校验失败 |
| 产物 Schema 无效 | `schema_validation` | 产物格式校验失败 |
| 未知异常 | `internal` | 知识加工内部错误 |

只有 `ModelGatewayError` 使用模型错误摘要。资料预处理的扫描、文件、转换、JSON、Schema 和快照错误不得显示为“模型服务返回错误”。

## 实施步骤（人工确认后）

1. 30 分钟内在 `training_service.py` 增加扫描选择与父阶段进度编排，替换默认完整扫描调用。
2. 30 分钟内在 `services.py` 增加可选取消检查，确保轻量扫描按资源/哈希分块响应取消。
3. 45 分钟内在 `test_training_service.py` 增加缓存命中、缓存缺失、无效缓存、进度、取消和错误分类测试。
4. 30 分钟内运行语法、定向单测和 `git diff --check`；通过后交 Test Engineer 执行真实后端 API。

## 自动化测试方案

| 用例 | 断言 |
| --- | --- |
| 已有扫描报告 | 不调用 `preprocess.scan`；事件 source 为 `latest_scan_report` |
| 扫描报告缺失 | `scan(lightweight=True, cancel_check=...)` 恰好调用一次 |
| 扫描报告损坏 | 记录 `scan_cache_invalid`，回退轻量扫描，不归类模型错误 |
| 轻量扫描进度 | 父任务 `current/total` 单调增长，日志包含 source/current/total |
| preparation 缓存命中 | 不执行 Office/PDF 转换；沿用已提交 `snapshotRef` |
| 取消传播 | 取消后抛 `TrainingCancelledError`，3 秒内 `cancelled`，不再处理下一资源 |
| 错误摘要 | JSON/I/O/Schema/Artifact 异常分别分类；仅 `ModelGatewayError` 使用模型摘要 |
| 模型边界回归 | `formal_knowledge` 仍要求模型测试并调用既有 Workflow Agent；`keyword_analysis` 不增加模型调用 |

## 真实 API 验收（自动化通过后）

1. 重启真实后端，调用健康、admission、preflight 和创建任务 API。
2. 热缓存启动新任务：5 秒内离开资料预处理，不创建 LibreOffice 子进程。
3. 隔离批次移除扫描报告后启动：任务日志持续显示扫描进度，`current/total` 非空且单调增长。
4. 回退扫描中调用取消：3 秒内任务为 `cancelled`，无新 LibreOffice，批次 admission 恢复 `ready`。
5. 纯后端验收全部通过后，才允许从前端启动 8,000+ 文档加工并按 30 秒采样跟踪。

## 人工确认点

- [x] 已确认采用方案 A，并允许增加内部可选 `cancel_check` 参数和结构化阶段事件。
- [x] 业务代码、定向测试和设计文档已同步更新。
- [ ] Test Engineer 通过真实后端 API 验证热缓存 5 秒和取消 3 秒指标。

## 实施与验证记录

- `TrainingService` 已优先读取 `latest_scan_report`；缺失或损坏时固定调用 `scan(lightweight=True)`。
- 回退扫描已向父训练任务输出单调进度，并记录 `scan.started/progress/completed/cache_invalid` 结构化事件。
- `PreprocessService.scan` 已增加默认兼容的 `cancel_check`，在资源边界、预览转换前后及每个 1 MiB 哈希块检查取消。
- `formal_knowledge` 的模型预检和 `KnowledgeExtractionWorkflowAgent.execute` 调用保持不变；公共 HTTP API 和四阶段契约未修改。
- `python3 -m py_compile`：通过。
- `test_training_service`：75/75 通过，其中新增扫描与取消用例 4/4 通过。
- `test_material_preparation`：32/33 通过；唯一失败为既有 `test_structure_split_preserves_heading_offsets_and_neighbors_after_exclusion` 切块长度问题，已记录在 `RISK-TSR-003`，与本任务扫描改动无关。
- 目标路径 `git diff --check`：通过。

## P1 冷 Preparation 进度与取消传播

风险 `RISK-TRAIN-8053-005`：冷 preparation 内部持续生成产物，但父训练任务和日志停在 `scan 10873/10873`，用户无法判断任务是否仍运行，也无法在耗时转换边界可靠取消。

```text
preparation.prepare(progress=None, cancel_check=None):
  normalize top-level inputs
  for each input:
    cancel_check()
    process resource; check before/after PDF or Office conversion
    classify cumulative succeeded/failed/skipped
    progress(current, total, succeeded, failed, skipped)
    cancel_check()

training callback:
  if elapsed >= 1 second or current-lastCurrent >= 50 or current == total:
    update parent progress with substage=prepare
    emit material_preparation.prepare.progress
```

- 两个参数均为可选关键字参数，既有调用默认兼容。
- `total` 固定为归一化后的顶层输入数；归档展开不改变总数。
- scan 事件继续使用 `material_preparation.scan.*`，prepare 使用 `material_preparation.prepare.*`。
- 不改变公共 API、四阶段状态、模型边界或运行时数据。

验收：

- [x] Preparation 单测覆盖累计计数、资源边界取消和耗时转换前后取消。
- [x] TrainingService 单测覆盖 1 秒/50 资源节流、终点强制发布及 scan/prepare 事件区分。
- [x] 完整后端回归通过；既有无关失败单独报告。
- [ ] 真实 API 冷启动由根任务在当前运行结束并完成精确备份后执行。

实施结果：

- Preparation 在开始正式处理时先发布 `0/total`，父任务立即从 scan 切换到 prepare 子阶段。
- 输入快照和资源内容哈希按 1 MiB 分块检查取消；归档解压、递归资源及 PDF/Office 转换前后均传播取消。
- 累计失败判断只检查当前资源新增 issue，避免 8,000+ 资源下退化为 O(N²)。
- `test_training_service`：78/78 通过；`test_core`：44/44 通过；新增 P1 定向用例 5/5 通过。
- `test_material_preparation`：37/38 通过；唯一失败仍为既有 `RISK-TSR-003` 切块长度问题。
- `py_compile` 与目标文件 `git diff --check`：通过。

## P1 关键词默认档进度与取消

风险 `RISK-TRAIN-8053-007`：`keyword_analysis` 对约 10,100 个资源、13,244 个处理单元逐资源执行确定性提取，但循环没有资源边界取消检查或公开进度，父任务长期显示 `0/13244`。

```text
for each resource:
  cancel_check()
  process with unchanged deterministic rules
  current += resource chunk count
  succeeded/failed/skipped += resource chunk count by outcome
  if elapsed >= 1s or processed resources >= 50 or current == total:
    emit knowledge_extraction.keyword_analysis.progress
  cancel_check()
```

- `_extract_keyword_analysis` 输入输出签名、提取规则、候选结果和产物 Schema 不变。
- `current` 使用处理单元口径；节流阈值使用资源口径。
- 单资源异常在重新抛出前计入 failed 并强制发布，不改变整阶段失败语义。
- 不新增依赖，不修改公共 API，不操作当前运行任务。

验收：

- [x] 50 资源和 1 秒节流、终点强制发布单测。
- [x] 资源完成后取消阻止下一资源单测。
- [x] `current=succeeded+failed+skipped` 且终点等于总 chunk 数。
- [x] 固定输入候选与落盘产物回归不变。
- [x] `test_training_service`、语法和目标 diff-check 通过。

实施结果：

- 新增 `knowledge_extraction.keyword_analysis.progress`，父任务 `progressDetail` 包含 `substage/processedResources/succeeded/failed/skipped`。
- 文档摘要和确定性提取均在资源开始前、完成后检查取消；取消后不进入下一资源。
- 进度按 1 秒或 50 个资源节流，`current` 按处理单元累计，失败和终点强制发布。
- 提取规则、候选顺序、缓存摘要、产物 Schema、模型调用计数和公共 API 保持不变。
- 新增定向用例 4/4 通过；`test_training_service` 82/82 通过；`py_compile` 和目标文件 `git diff --check` 通过。

## P1 Preparation 预哈希观测与快速身份缓存设计

关联既有风险 `RISK-TRAIN-8053-004/005`。真实 API 任务 `training_aecc6fae273a42ab` 在新进程启动后，已有 preparation 缓存但超过 30 秒仍公开 `scan 10873/10873`；日志只有 `prepare.started`，工作线程单核约 94%。

精确代码边界：`prepare.started` 之后，服务在 `reserve_flight`、run event log 和现有 progress 之前执行 `_normalize_source_records` 重复组内容哈希及 `_input_snapshot` 全量文件 SHA-256。当前日志只能给出该区间 `>30s`，无法分解精确耗时。

推荐方案：

1. 先用资源清单、pipeline 和 config 计算不读取正文的 `inputIdentityHash`；
2. 读取并验证 committed latest 的控制文件；identity/config/pipeline 全匹配时直接返回不可变 snapshotRef；
3. 历史快照或 miss 时进入现有深哈希，按 1 MiB 块取消，并新增 `identity/cache_lookup/content_fingerprint/reserve/process` 分阶段耗时和进度；
4. 新 snapshot 同时保存快速身份、配置哈希和既有深内容哈希；快速身份不替代 exact execution hash。

该方案依赖资源不可原地变更：内容变化必须发布新资源身份或原子更新资源清单。若不能确认该约束，应先升级下载/上传资源 Schema 持久化内容哈希，不能仅凭路径和大小复用。

验收：

- [ ] 人工确认快速身份缓存的正确性前提和方案。
- [ ] 历史/miss 深哈希阶段进度、取消和子阶段计时单测。
- [ ] 热命中不调用 `_hash_file` 和转换器，10,873 记录至少 20 次 P95 小于 5 秒。
- [ ] identity/config/pipeline 任一变化不复用；损坏 latest 安全回退。
- [ ] 不改变公共 API、四阶段、模型边界或 runtime 数据。

状态：设计完成，等待性能架构人工确认；本轮未修改功能代码。
