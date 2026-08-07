# TASK-BUG-JSON-RACE-P0-06: 接通训练快照链路与原子准入

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-07
- 预计完成: 2026-08-07
- 预计工时: 4 小时
- 依赖: TASK-BUG-JSON-RACE-P0-02、TASK-BUG-JSON-RACE-P0-05
- 需人类确认: 否
- 可并行: 否

## SMART 目标
在 4 小时内让 `TrainingService` 在 admission 短锁内原子完成检查、任务创建和 activeTask 登记，并在资料准备到元数据构建之间显式传递固定快照引用，同时修正非模型异常分类。

## 接口与伪代码
```python
with coordinator.admission(batch_id):
    batch = require_ready()
    task = create_task_and_register_active(batch)

prep_report = preparation.prepare(...)
meta_report = metadata.build(batch_id, preparation_snapshot=prep_report.snapshot_ref, ...)
run_manifest["lineage"] = {"preparation": prep_ref, "metadata": meta_ref}
```

## 实施范围
- 消除 `_require_batch_ready()` 与 task/activeTask 写入之间的检查后执行窗口。
- preflight 与正式任务均显式固定/传递 snapshot ref，不重新读取 shared latest。
- 训练运行清单记录完整 lineage、manifest hash 和 generation。
- 仅 `ModelGatewayError` 进入模型摘要；产物损坏、文件 I/O、转换、Schema 和未知异常分别分类并生成中文信息与 traceId。

## 验收标准
- [x] 两个并发 `start()` 对同一批次最多一个请求成为有效任务所有者。
- [x] preparation latest 在阶段间变化不改变训练任务已固定的输入。
- [x] 普通 JSON/文件异常不再显示“模型服务返回错误”。
- [x] 取消、重启恢复、部分下载准入和 `keyword_analysis` 零模型契约不回归。
- [x] 所有长耗时阶段均在 admission/latest 锁外执行。

## 预计变更文件
- `scripts/pingcode/web/backend/app/training_service.py`
- `scripts/pingcode/web/backend/app/main.py`（仅注入协调器，如需要）
- `scripts/pingcode/web/backend/tests/test_training_service.py`
