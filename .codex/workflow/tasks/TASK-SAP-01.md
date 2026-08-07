# TASK-SAP-01: 大批次扫描与知识加工启动可观察性修复

## 元信息
- 状态: completed（全链路验证完成）
- 执行方式: 单 Agent（用户明确要求不使用多智能体）
- 创建: 2026-08-06
- 预计完成: 2026-08-06
- 依赖: TASK-DIR-01
- 需人类确认: 已确认（用户已批准方案 A）

## SMART 目标

在本次任务内将加工页扫描改为可恢复的后台任务，将加工预检收敛为不执行资料准备的轻量检查，并使大批次首屏、扫描结果和加工启动具有明确进度、错误与恢复状态。

## 接口与伪代码

- `POST /api/preprocess/scan-tasks`：创建或返回同批次活动扫描任务，HTTP 202。
- `GET /api/preprocess/scan-tasks?batchId=`：返回扫描任务快照。
- `GET /api/preprocess/scan-reports/{batchId}`：返回最新扫描报告。
- `POST /api/training/preflight`：保持响应兼容，只读取报告或资源统计，不调用 `preparation.prepare()`。
- 旧 `POST /api/preprocess/scan` 保留兼容，不作为加工页主路径。

```text
页面加载 -> 并行读取文件/扫描任务/扫描报告/加工任务
点击扫描 -> 202 scan task -> SSE/轮询 -> 持久化报告 -> 页面恢复报告
点击开始 -> 轻量 preflight -> 确认 -> 202 training task -> 后台资料准备与加工
```

## 验收标准

- [x] 扫描任务创建后立即返回，重复点击不创建并发扫描。
- [x] 扫描进度与失败信息可轮询，刷新后可恢复最新报告。
- [x] 预检不创建 `preparation/runs/preflight`，存在可加工资料时可快速返回。
- [x] 首屏文件接口不再为返回 20 条而重复执行逐资源查找。
- [x] 后端聚焦测试、前端构建与隔离真实 API 验证通过。
- [x] 不启动真实 YASDOC 大批次知识加工任务，不修改下载账本。

## 预计变更

- `docs/03-pingcode-frontend-interaction-detail.md`
- `scripts/pingcode/web/backend/app/services.py`
- `scripts/pingcode/web/backend/app/main.py`
- `scripts/pingcode/web/backend/app/training_service.py`
- `scripts/pingcode/web/backend/tests/`
- `scripts/pingcode/web/frontend/src/views/PreprocessPage.vue`

## 验证记录

- 受影响后端测试：`TrainingPreflightTests` 21 项、`DeterministicPipelineTests` 12 项、`SourceInspectionTests` 12 项通过。
- 前端 `npm run build` 通过。
- 隔离上传批次真实 API：扫描任务完成、报告可恢复、轻量预检 `canStart=true`、规则加工任务完成。
- 真实 YASDOC 批次只读验证：轻量预检 HTTP 200，约 0.65 秒，10179 个可加工来源，`totalModelCalls=0`；未创建真实加工任务。
- 全量后端测试仍有 1 条既有 `test_structure_split_preserves_heading_offsets_and_neighbors_after_exclusion` 失败，与本次资源索引/异步扫描改动无关。
