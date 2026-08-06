# TASK-KFS-02: 删除业务三态、质量评价与 L2 后端接口

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-05
- 预计完成: 2026-08-06
- 预计工时: 4 小时
- 依赖: TASK-KFS-01
- 需人类确认: 是（删除公共 API 和请求模型）
- 可并行: 否

## SMART 目标
在 4 小时内删除质量分析页不再使用的业务三态、质量评价和 L2 公共后端实现，同时保留关键词过滤、简单 admitted/excluded 边界、图谱查询和正式知识构建能力。

## 删除清单
- 删除 `POST /api/datasets/{dataset_id}/keywords/business-review`。
- 删除 `POST /api/datasets/{dataset_id}/keywords/{keyword_id}/business-status`。
- 删除业务准入报告、业务手工覆盖、`needsReview` 聚合和相关 TrainingService 方法。
- 保留 `POST /api/datasets/{dataset_id}/keywords/{keyword_id}/admission`，仅作为 admitted/excluded 的单关键词兼容入口；若前端不再调用，标记为保留但不展示。
- 删除 `POST /api/datasets/{dataset_id}/keywords/l2-terms`。
- 删除 `GET /api/datasets/{dataset_id}/graph/term-expansion`。
- 删除仅为 L2 服务的请求模型、服务方法、`MAPS_TO_TERM` 写入与摘要字段。
- 评估并删除 `POST /api/datasets/{dataset_id}/keywords/{keyword_id}/links`：若仅服务 L2 则删除；若存在非 L2 调用，先在任务日志记录并等待确认。
- 删除质量分析页专用的 `GET /api/quality/reports/{dataset_id}` 和 `GET /api/training/tasks/{task_id}/quality-issues` 公共入口及其无剩余调用的服务方法。
- 保留训练内部 `quality-issues.json`、模型错误审计、知识验证门禁和 Dataset 兼容字段，避免扩大到训练 Pipeline 行为删除。

## 数据兼容策略
- 读取历史节点时忽略 `businessStatus/businessReasonCodes/businessManualOverride`，不要求批量改写历史运行数据。
- 新写入节点不再生成业务三态和 L2 字段。
- `DatasetVersion.quality_*` 字段本轮先保留用于旧记录反序列化；仅从质量分析公共响应中移除。
- 删除 API 后必须返回标准 404，文档中列出破坏性变更，不提供静默兼容别名。

## 参考文档
- `docs/12-PingCode知识提取步骤详细设计.md`
- `docs/15-PingCode图谱与数据集生成步骤详细设计.md`
- `docs/20-质量分析页面三层重构设计.md`
- `docs/21-TrainingService分层重构详细设计.md`
- `scripts/pingcode/web/backend/app/main.py`
- `scripts/pingcode/web/backend/app/models.py`
- `scripts/pingcode/web/backend/app/training_service.py`

## 验收标准
- [x] 删除清单中的业务三态、L2 和质量评价路由不再注册，并通过 404 契约验证。
- [x] 无剩余生产代码调用已删除的请求模型和 TrainingService 方法。
- [x] 关键词过滤预览、SSE、应用决策、图谱查询和正式知识构建接口保持可用。
- [x] 历史数据兼容字段仍可读取，不触发批量运行数据迁移。
- [x] 内部质量审计和知识验证门禁保留，未随页面能力删除。
- [x] 公共 API 删除矩阵已由测试和设计文档记录。

## 预计变更文件
- `scripts/pingcode/web/backend/app/main.py` (modified)
- `scripts/pingcode/web/backend/app/models.py` (modified)
- `scripts/pingcode/web/backend/app/training_service.py` (modified)

## 风险
- 删除公共 API 会使旧版前端或外部调用方立即收到 404，实施前必须确认部署不需要滚动兼容期。
- 直接删除 Dataset 质量字段会导致历史状态反序列化失败，因此本任务明确保留兼容字段。
- “质量评价”与训练内部质量门禁命名相近，禁止误删模型错误、证据校验和发布安全检查。

## 执行日志
- 2026-08-05 Planner：完成公共 API 删除矩阵与历史数据兼容边界设计。
- 2026-08-05 Backend Worker / Test Engineer：完成公共 API 删除及兼容边界验证；聚焦测试 90/90 通过，删除路由返回 404。
