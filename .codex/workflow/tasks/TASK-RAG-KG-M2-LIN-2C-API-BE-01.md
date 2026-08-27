# TASK-RAG-KG-M2-LIN-2C-API-BE-01：API-A 公共接线实现

## 元信息

- 状态: completed（初版接线；完整错误矩阵由 API-TST-01 继续补齐）
- 分配: backend-worker
- 创建: 2026-08-18
- 预计完成: API-TST-01 红灯后 4h
- 父任务: TASK-RAG-KG-M2-LIN-2C-API-01
- 依赖: TASK-RAG-KG-M2-LIN-2C-API-TST-01
- 需人类确认: 已完成（API-A 已按常设授权选定）
- 可并行: 否；独占公共接线文件
- 文件归属: `scripts/pingcode/web/backend/app/training_service.py`、`scripts/pingcode/web/backend/app/main.py`

## SMART 目标

在 4 小时内保持请求字段集合不变，将 `keyword_analysis + sourceDatasetId` 接入同步轻校验、异步冻结/重建编排和结构化 TaskSnapshot 结果。

## 验收标准

- [x] 同步错误不再把 source dataset 问题误报为 `BATCH_NOT_FOUND`。
- [x] 异步状态和 `progressDetail.rebuildResult` 可追溯。
- [x] 第一阶段不发布、不写 source dataset、不伪造可发布 DatasetVersion。
- [x] 不新增 repair endpoint、不改变 formal 和普通 keyword 行为。
- [x] 已通过 API-A 隔离验收及 124 项组合回归；完整错误矩阵仍由 API-TST-01 补齐。
