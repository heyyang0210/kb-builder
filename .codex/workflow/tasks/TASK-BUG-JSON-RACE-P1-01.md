# TASK-BUG-JSON-RACE-P1-01: 并发故障注入与真实 API 验收

## 元信息
- 状态: completed（核心验收完成；规模性能列为残余风险）
- 分配: test-engineer / doc-writer / reporter
- 创建: 2026-08-07
- 预计完成: 2026-08-08
- 预计工时: 4 小时
- 依赖: TASK-BUG-JSON-RACE-P0-03、TASK-BUG-JSON-RACE-P0-04、TASK-BUG-JSON-RACE-P0-05、TASK-BUG-JSON-RACE-P0-06
- 需人类确认: 否
- 可并行: 否（最终集成验收）

## SMART 目标
在 4 小时内完成线程、多进程、故障注入、性能基线和隔离真实后端 API 验收，形成可复核报告并同步设计文档实施状态。

## 验收矩阵
1. 同批次并发启动只登记一个所有者。
2. 同 executionHash 只生成一个快照；不同 hash 可独立提交。
3. 旧任务晚完成不能覆盖新 latest generation。
4. 元数据固定 prepRef，不受 latest 更新影响。
5. staging 中断不暴露半成品，重启可清理或诊断。
6. 单坏行隔离；截断/hash/commit 损坏整体阻断。
7. 多进程 state/latest 写入无坏 JSON、无丢失更新。
8. 100 并发只读无写锁等待；单任务耗时回退不超过 5%。
9. 真实 API 创建隔离批次并轮询任务、事件、质量问题和 lineage。

## 验收标准
- [x] 聚焦单元、并发和故障注入测试全绿；既有相关回归无新增失败。
- [x] admission/latest CAS P95 持锁时间小于 20ms，性能数据来自测试报告而非业务硬编码。
- [x] 真实 API 证据包含状态码、任务终态、snapshot refs、generation、模型调用数和脱敏日志。
- [x] `docs/01/08/11/18/21` 与 repositories README 标记实际实现状态，无设计漂移。
- [x] `TASK-BUG-JSON-RACE-01` 验收项逐条回填，Reporter 更新 PROGRESS/NEXT/RISKS。

## 预计变更文件
- `scripts/pingcode/web/backend/tests/test_artifact_snapshot_concurrency.py`（新增）
- `scripts/pingcode/web/backend/tests/test_training_service.py`
- `scripts/pingcode/web/backend/tests/test-report-artifact-snapshot-race.md`（新增）
- `docs/01-PingCode资料预处理步骤详细设计.md`
- `docs/08-pingcode-processing-six-step-pipeline-design.md`
- `docs/11-PingCode元数据构建步骤详细设计.md`
- `docs/18-PingCode知识提取与构建测试设计.md`
- `docs/21-TrainingService分层重构详细设计.md`
