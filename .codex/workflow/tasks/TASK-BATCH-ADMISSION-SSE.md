# TASK-BATCH-ADMISSION-SSE: 批次准入、训练失败隔离与 SSE 状态机契约

## 元信息
- 状态: pending
- 分配: planner / backend-worker / frontend-worker / test-engineer
- 创建: 2026-08-07
- 预计完成: 2026-08-07
- 预计工时: 3-4 小时
- 依赖: TASK-BUG-JSON-RACE-P0-01（已完成）；当前训练与批次状态实现核对
- 需人类确认: 否（冻结现有业务边界，不新增公共 API 或外部依赖）
- 可并行: 后端状态调和、前端 SSE 文案、测试设计可并行；接口契约先冻结

## SMART 目标

在 4 小时内冻结并实现批次准入、训练任务、批次状态调和、`admissionStatus` 与 SSE 中文文案的统一契约，确保训练失败、取消或重启中断只结束训练任务，不污染批次稳定状态、已有数据集/图谱或关键词准入结果。

## 状态机设计

```text
Batch:
  uploaded/downloaded/ready
    -> processing
    -> ready 或保持 downloaded
    -> failed 仅限下载/准备阶段整体失败且无可用快照

TrainingTask:
  queued -> running -> completed
                    -> failed
                    -> cancelling -> cancelled
                    -> interrupted

TrainingTask failed/cancelled/interrupted:
  只更新训练任务和事件
  -> 调和 activeTaskIds
  -> 批次恢复到失败前的稳定状态
  -> 不写入 admissionStatus
  -> 不发布新的 dataset/graph
```

规则：训练成功后才允许发布新的 dataset/graph；正式知识输入只读取 `admissionStatus=admitted` 的关键词节点；`admissionStatus` 只允许 `admitted` / `excluded`，训练失败、取消和恢复流程不得修改该字段。

## 接口与伪代码

```python
def reconcile_batch(batch_id):
    batch = batches.get(batch_id)
    tasks = tasks_repo.list(batch_id)
    active = [
        task for task in tasks
        if task.state in {"queued", "running", "cancelling"}
    ]
    stable_state = resolve_previous_stable_state(batch, tasks)
    updates = {"activeTaskIds": [task.id for task in active]}
    if not active and batch.state == "processing":
        updates["state"] = stable_state
    return batches.update(batch_id, **updates)
```

```python
def finish_training(task_id, result):
    task = tasks_repo.get(task_id)
    if result.success:
        publish_dataset_and_graph(result)
        tasks_repo.update(task_id, state="completed")
        reconcile_batch(task.batch_id)
        return

    tasks_repo.update(
        task_id,
        state="failed",
        errorCode=classify_training_error(result.error),
        message=chinese_failure_message(result.error),
    )
    reconcile_batch(task.batch_id)
    # 不修改 batch 的 admissionStatus、既有 dataset、graph 或 latest 快照
```

```python
def build_formal_input(nodes):
    return [
        node for node in nodes
        if node.get("type") == "Keyword"
        and read_admission_status(node) == "admitted"
    ]
```

SSE 事件统一返回以下字段：

```json
{
  "event": "task.failed",
  "taskId": "training_xxx",
  "batchId": "batch_xxx",
  "state": "failed",
  "stage": "knowledge_extraction",
  "errorCode": "ARTIFACT_INTEGRITY_FAILED",
  "message": "知识加工失败：输入产物完整性校验失败",
  "traceId": "trace_xxx",
  "activeTaskIds": [],
  "batchState": "downloaded"
}
```

中文文案契约：

- `task.failed`：`知识加工失败：{中文分类}`
- `task.completed`：`知识加工完成`
- `task.cancelled`：`知识加工已取消`
- `task.interrupted`：`知识加工因服务重启中断，可重新启动`
- 产物损坏不得显示为“模型服务错误”；原始异常只进入技术信息字段。
- SSE 断线后轮询按 sequence/event ID 去重，不重复追加同一事件。

## 任务范围

- 后端实现训练失败/取消/中断后的批次状态调和及 `activeTaskIds` 清理。
- 固化关键词节点 `admissionStatus` 的读写边界，正式知识生成只消费 `admitted`。
- 前端统一训练任务 SSE 事件的中文状态、错误分类和轮询降级去重。
- 增加真实后端 API 验证：训练成功、失败、取消、重启中断及 SSE/轮询路径。
- 不在规则提取阶段调用模型服务；模型调用仅属于明确声明需要模型的后续阶段。

## 验收标准

- [ ] 训练失败后批次保持失败前稳定状态；仅下载/准备阶段整体失败且无可用快照时批次才为 `failed`。
- [ ] `activeTaskIds` 只包含真实活动任务，所有终态任务经调和后移除。
- [ ] 训练失败、取消、中断和恢复不修改 `admissionStatus`。
- [ ] 正式知识输入只读取 `admitted` 关键词节点。
- [ ] 训练失败不覆盖既有 dataset、graph、latest 或已提交快照。
- [ ] SSE 事件字段完整、中文文案正确，轮询降级不会重复展示事件。
- [ ] 规则提取阶段真实请求链路不触发模型服务调用，HTTP 502 不再作为该阶段错误。
- [ ] 至少通过真实后端 API 创建隔离批次并验证成功、失败、取消和 SSE/轮询路径。

## 参考文档

- `docs/02-pingcode-frontend-design.md`
- `docs/03-pingcode-frontend-interaction-detail.md`
- `docs/08-pingcode-processing-six-step-pipeline-design.md`
- `docs/15-PingCode图谱与数据集生成步骤详细设计.md`
- `docs/20-质量分析页面三层重构设计.md`
- `scripts/pingcode/web/backend/app/training_service.py`
- `scripts/pingcode/web/backend/app/services.py`
- `scripts/pingcode/web/frontend/src/views/PreprocessPage.vue`

## 预计变更文件

- `scripts/pingcode/web/backend/app/services.py`
- `scripts/pingcode/web/backend/app/training_service.py`
- `scripts/pingcode/web/backend/app/models.py`（如需补充状态字段）
- `scripts/pingcode/web/frontend/src/views/PreprocessPage.vue`
- 对应后端/前端测试文件与本任务引用的设计文档

## 执行日志

- 2026-08-07 Planner：根据当前状态机边界创建任务卡，明确训练失败隔离、批次状态调和、准入状态源和 SSE 中文文案契约。
- 2026-08-07 Frontend Worker：完成 `PreprocessPage.vue` 的后端准入预检展示、SSE 终态中文文案与断线轮询序号去重；任务级失败按 `errorCode/message` 展示，避免将规则阶段产物错误误报为模型 502。待前端构建与真实后端链路验证。
- 2026-08-07 Implementation：`TrainingService` 增加训练失败后的资料状态调和和 `/api/training/admission/{batchId}`；目标批次经真实 API 从 `failed` 恢复为 `downloading`，返回 `canStart=true`、`admissionStatus=partial_download`。规则阶段与模型调用解耦的完整链路仍需后续隔离批次验收。
