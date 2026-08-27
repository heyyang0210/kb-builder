# TASK-RAG-KG-M2-LIN-2C-API-DES-01：API-A 架构与详细设计修订

## 元信息

- 状态: completed
- 分配: doc-writer / architect
- 创建: 2026-08-18
- 预计完成: 开始后 2h
- 父任务: TASK-RAG-KG-M2-LIN-2C-API-01
- 依赖: API-A、3A、4A 和推荐安全架构已按常设授权选定
- 需人类确认: 已完成（2026-08-18 常设推荐方案授权）
- 可并行: 否；所有实现任务的前置任务
- 文件归属: `agent-runner/docs/modules/knowledge-graph-governance/development/16-m2-safe-publish-detailed-design.md`、`17-m2-production-lineage-integration.md`、`testing/03-m2-production-lineage-integration-test-design.md`、`TASK-RAG-KG-M2-LIN-2C-API-01.md`

## SMART 目标

在 2 小时内修正现有 2C 内核与 API-A 契约脱节，冻结请求时输入包、同 run 规则证据、`rebuildOf`、执行上下文、同步/异步错误、结果可见性、崩溃恢复和性能边界，形成接口、Schema、伪代码和测试矩阵。

## 验收标准

- [x] 明确旧 dataset 只能生成“请求时快照”，不能冒充原训练时快照。
- [x] 明确规则快照与 candidate 在同一 rebuild run 原子提交。
- [x] `rebuildOf` 固定包含 `datasetId/taskId/inputDigest`。
- [x] 公共请求轻校验同步执行，重校验和规则执行异步执行。
- [x] 第一阶段仅返回可追溯 candidate artifact，不冒充可发布 DatasetVersion。
- [x] 设计、任务卡和测试设计决策状态一致；未跟踪文件完成文本级尾随空白检查。

## 执行日志

- 2026-08-18：Planner 复核发现现有内核不可直接接入公共 API，任务启动。
- 2026-08-18：四份设计/任务文档完成修订；主代理统一 1k/8k 性能口径并完成文本级空白检查。
