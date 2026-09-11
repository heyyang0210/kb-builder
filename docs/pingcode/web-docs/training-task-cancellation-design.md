# 知识加工任务取消设计

## 目标

- 加工任务页面不再展示模型运行预检、模型配置和耗时估算。
- 启动知识加工不再依赖前端预检结果或最近一次模型连接测试。
- 排队中、执行中和正在取消的知识加工任务显示取消入口。
- 取消请求能够停止后续流水线步骤，并将任务稳定收敛为 `cancelled`。

## 接口

```http
POST /api/training/tasks/{task_id}/cancel
```

成功时返回最新 `TaskSnapshot`。仅 `queued`、`running`、`cancelling` 状态允许取消；终态任务返回 `409 TASK_CANCEL_UNAVAILABLE`。

## 状态流转

```text
queued/running -> cancelling -> cancelled
```

取消请求先同步写入 `cancelling`，避免用户重复操作。后台线程在流水线阶段边界、预处理等待循环、文档增强结果循环、知识提取循环和语义复核循环检查取消状态。检测到取消后：

1. 当前步骤标记为 `cancelled`。
2. 任务标记为 `cancelled`，清除 `canCancel`。
3. 写入 `task.cancelled` 结构化日志并发布任务事件。
4. 清除批次的活动任务标识。

单次已经发出的模型 HTTP 请求无法由 Python `urllib` 强制终止；取消会等待该请求返回或达到配置超时，然后不再启动后续请求。文档增强线程池会取消尚未开始的 future。

## 前端伪代码

```text
canStart = 有可处理文件 AND 当前没有排队/执行/取消中的任务
canCancel = 当前任务状态属于 queued/running/cancelling

点击取消:
  禁用取消按钮
  POST /api/training/tasks/{id}/cancel
  用响应刷新任务状态
  保持事件流或轮询，直到状态进入 cancelled
```

## 后端伪代码

```text
cancel(taskId):
  校验任务类型和状态
  state = cancelling
  通知关联的规则预处理子任务停止
  return task

pipeline checkpoint:
  if task.state in {cancelling, cancelled}:
    raise TrainingCancelledError

catch TrainingCancelledError:
  当前步骤 = cancelled
  task.state = cancelled
  batch.activeTaskIds = []
```

## 验证范围

- 后端单元测试：取消状态流转、终态拒绝取消、取消检查抛出专用异常。
- 前端构建：确认移除预检引用且 Vue 模板可编译。
- 后端测试：运行训练服务相关测试。
