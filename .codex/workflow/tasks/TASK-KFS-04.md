# TASK-KFS-04: 建立状态一致性与删除契约自动化测试

## 元信息
- 状态: completed
- 分配: test-engineer
- 创建: 2026-08-05
- 预计完成: 2026-08-06
- 预计工时: 4 小时
- 依赖: TASK-KFS-01, TASK-KFS-02, TASK-KFS-03
- 需人类确认: 否
- 可并行: 否

## SMART 目标
在 4 小时内补齐关键词应用决策、统计一致性、图谱投影、正式知识边界和公共 API 删除的自动化回归，使用临时数据验证，不写入指定批次运行数据。

## 测试矩阵
- 应用 keep/exclude 后，节点状态和摘要满足 `beforeTotal = kept + excluded`、`afterTotal = kept`。
- 应用前后 `keyword-chunk-index.json` 字节不变，网关调用次数为 0。
- 排除关键词后，展示节点、展示边和摘要同步减少；重新 admitted 后恢复。
- ProcessingUnit 仅在仍有 admitted 关键词关联时保留，禁止产生悬空边。
- 历史节点仅含 `approvalStatus/businessStatus` 时迁移结果确定、幂等并持久化。
- 正式知识上下文只读取 admitted，忽略遗留 businessStatus。
- OpenAPI 和真实 TestClient 对已删除业务三态、L2、质量评价路由返回 404。
- 关键词过滤预览、SSE 事件顺序、应用决策和正式知识启动保护测试继续通过。
- 前端构建通过；静态搜索确认被删除文案、函数和请求路径无残留。

## 真实场景策略
- 对 `batch_47c5cdb5dec744a1` 及其数据集只执行只读统计核对。
- 写入型验收使用临时目录或克隆 fixture，不调用实际 apply，不改动运行数据。
- 若后续要求在真实批次执行 apply，必须作为新的人工确认节点单独授权。

## 参考文档
- `scripts/pingcode/web/backend/tests/test_training_service.py`
- `scripts/pingcode/web/backend/tests/test_model_gateway.py`
- `scripts/pingcode/web/backend/tests/test_artifact_repository.py`
- `scripts/pingcode/web/frontend/src/views/QualityPage.vue`
- `docs/20-质量分析页面三层重构设计.md`

## 验收标准
- [x] 自动化测试覆盖统计不变量、节点/边投影、迁移幂等和正式知识边界。
- [x] 已删除 API 的 404 路由契约及保留 API 契约测试通过。
- [x] 聚焦后端测试 90/90 通过，前端构建通过。
- [x] 自动化测试使用隔离数据；未修改指定批次运行数据。
- [x] 全量 221 项中 198 通过、21 跳过、2 个既有失败，结果已记录。

## 预计变更文件
- `scripts/pingcode/web/backend/tests/test_training_service.py` (modified)
- `scripts/pingcode/web/backend/tests/test_keyword_filter_state.py` (added，可选)
- `scripts/pingcode/web/backend/tests/test-report-keyword-filter-state.md` (added)

## 执行日志
- 2026-08-05 Planner：完成状态一致性、API 删除和数据保护测试矩阵。
- 2026-08-05 Test Engineer：聚焦回归 90/90 通过；全量回归 221 项中 198 通过、21 跳过、2 个既有范围外失败；未对真实数据执行 `filter-apply`。
