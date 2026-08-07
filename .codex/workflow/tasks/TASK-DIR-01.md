# TASK-DIR-01: 允许已部分完成的中断下载进入知识加工

## 元信息
- 状态: completed（真实 API 部分完成）
- 分配: backend-worker / frontend-worker / test-engineer / doc-writer
- 创建: 2026-08-06
- 预计完成: 2026-08-06
- 预计工时: 3 小时
- 依赖: 无
- 需人类确认: 否（用户已明确限定准入条件；不删除下载数据、不改变公共 API 或引入依赖）
- 可并行: 是（设计/测试可先行；前后端可围绕同一准入谓词并行）

## SMART 目标

在 3 小时内使知识加工仅在下载任务满足 `state=interrupted && canResume=true && completed>0` 时允许启动，并在主页持续以中文告警说明“按已完成资料加工、未完成项仍可续传”；下载中、未开始/完成数为零、失败、暂停或其他非完成下载任务必须继续阻断知识加工。

## 已确认影响与最小范围

- `TrainingService._require_batch_ready()` 当前要求批次状态属于 `uploaded/downloaded/ready`，且将任一非 `completed` 下载任务作为阻断条件。
- 下载恢复后，批次可保持 `downloading` 并携带中断下载任务 ID；因此后端必须仅为合格的“部分完成且可续传”任务放宽批次状态和 `activeTaskIds` 判断，不能放宽普通下载中的活跃任务。
- `PreprocessPage.vue` 当前把 `downloadTask.state !== completed` 一律视为阻断，并把 `canResume` 提示为“请先继续下载”；需改为“允许启动但持续警告”。
- 下载任务的 `canResume`、账本和下载页续传按钮保持原样；知识加工不得把下载任务标为完成、清除其续传标识或删除未完成项。

## 接口与伪代码

```python
def is_partial_download_allowed(task):
    return (
        task.type == "download"
        and task.state == "interrupted"
        and task.can_resume is True
        and int(task.completed or 0) > 0
    )

def require_batch_ready(batch_id):
    batch = batches.get(batch_id)
    downloads = [task for task in tasks.list(batch_id) if task.type == "download"]
    partial = [task for task in downloads if is_partial_download_allowed(task)]
    blocking = [task for task in downloads if task.state != "completed" and task not in partial]
    allowed_active_ids = {task.id for task in partial}
    if blocking or any(task_id not in allowed_active_ids for task_id in batch.active_task_ids):
        raise ValueError("资料下载尚未完成，不能启动知识加工")
    if batch.state not in {"uploaded", "downloaded", "ready"} and not partial:
        raise ValueError("资料下载尚未完成，不能启动知识加工")
    return {"batch": batch, "partialDownloads": partial}
```

```javascript
const partialDownloadAllowed = computed(() => (
  downloadTask.value?.state === 'interrupted'
  && downloadTask.value?.canResume
  && Number(downloadTask.value?.completed || 0) > 0
))
const batchReadyForTraining = computed(() => normalBatchReady.value || partialDownloadAllowed.value)
```

## 执行步骤

1. Doc Writer：先更新 `docs/03-pingcode-frontend-interaction-detail.md` 的下载/加工衔接契约，明确严格准入谓词、持续告警内容和续传数据保护；同步相关测试设计说明。
2. Backend Worker：将 `TrainingService._require_batch_ready()` 收敛为命名的部分下载准入谓词；只忽略满足谓词的中断下载任务及其活动 ID，启动日志写入“使用部分下载资料加工”的可审计中文告警。
3. Frontend Worker：在 `PreprocessPage.vue` 使用相同条件启用“开始知识加工”，显示持续告警和完成数；下载仍在执行、已中断但无完成项、不可续传和失败任务继续禁用按钮并显示阻断原因。
4. Test Engineer：覆盖后端准入、任务启动和前端状态。使用隔离 fixture 验证合格中断下载可启动、下载任务的 `canResume/completed` 未变化，及所有负向状态仍得到原有阻断错误。

## 验收标准

- [x] 设计文档和测试设计已明确 `interrupted && canResume && completed>0` 是唯一可带告警继续的下载状态。
- [x] 合格中断下载即使批次仍标记 `downloading` 或 `activeTaskIds` 含该下载任务，也能创建知识加工任务；启动事件含可审计中文部分下载告警。
- [x] 主页按钮在合格中断下载时可点击，显示“按已完成资料加工、未完成项仍可续传”的持续告警及完成数量。
- [x] `queued/running/downloading`、`interrupted` 但 `completed=0`、`canResume=false`、`failed`、`paused` 和任何额外活动任务均继续阻断。
- [x] 知识加工启动与完成不修改下载任务的 `state`、`canResume`、`completed`、下载账本或未完成页面；用户仍可在下载页续传。
- [ ] 后端聚焦测试、前端构建和隔离真实 API 验收通过；未修改真实批次、下载文件或模型配置。真实批次仅验证 `_require_batch_ready` 放行；全量 HTTP `preflight` 因大批次请求未获得可用响应，未创建真实加工任务。

## 参考文档

- `docs/03-pingcode-frontend-interaction-detail.md`
- `scripts/pingcode/web/backend/app/training_service.py`
- `scripts/pingcode/web/backend/app/services.py`
- `scripts/pingcode/web/backend/tests/test_training_service.py`
- `scripts/pingcode/web/frontend/src/views/PreprocessPage.vue`

## 预计变更文件

- `docs/03-pingcode-frontend-interaction-detail.md` (modified)
- `scripts/pingcode/web/backend/app/training_service.py` (modified)
- `scripts/pingcode/web/backend/tests/test_training_service.py` (modified)
- `scripts/pingcode/web/frontend/src/views/PreprocessPage.vue` (modified)
- 前端相关测试文件 (modified/added，如当前测试设施覆盖该页面状态)

## 风险

- 不可只按 `canResume` 或 `completed>0` 放行，否则失败、暂停或仍执行的下载会错误进入加工。
- 不可在知识加工启动时清理下载 `activeTaskIds` 以外的任务，否则会绕过真实并发下载保护。
- 加工产物必须在来源与任务日志中标识部分下载，避免被解释为全量资料结论。

## 执行日志

- 2026-08-06 Planner：确认现有前后端将所有非完成下载统一阻断；创建严格限定的部分下载放行任务卡。
- 2026-08-06 Doc Writer / Backend Worker / Frontend Worker：完成下载-加工准入契约、服务端限定放行和主页持续中文告警；不修改下载续传状态或账本。
- 2026-08-06 Test Engineer：`DeterministicPipelineTests` 12 项通过；覆盖合格中断下载放行、零已完成资源阻断和额外活动任务阻断。前端 `npm run build` 通过。
- 2026-08-06 Reporter：真实批次 `_require_batch_ready` 验证通过。全量 HTTP `preflight` 因大批次请求未获得可用响应，未创建真实加工任务；按“真实 API 部分完成”标记任务，保留端到端隔离 API 验收作为后续项。
