# TASK-KGO-29-BE-01: 实现图谱质量概览只读契约

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-17
- 预计完成: 开始后 4 小时内
- 依赖: TASK-KGO-MOD-01 设计冻结
- 父任务: TASK-KGO-REQ-29
- 需人类确认: 否
- 可并行: 是（可与 TASK-KGO-29-FE-01 并行）

## 需求描述
新增配置驱动的图谱可观测读模型和 `graph/observability` 接口，复用现有健康指标，补齐事实、投影规模、分子分母、可用性、指纹和 stale 告警，不改变现有图谱接口。

## SMART 验收标准
- [x] 4 小时内完成接口、配置加载和定向契约测试。
- [x] 响应包含 scope、三种规模中的事实/投影规模、五项健康指标和规则版本。
- [x] 指标提供分子、分母或计数依据；不适用时返回 `not_applicable`。
- [x] 指纹不一致返回 HTTP 200 + stale 告警，不惰性写缓存、不调用模型。
- [x] 643 关键词、千级关系 P95 < 500ms；原 `summary/nodes/edges/neighborhood` 测试继续通过。

## 文件归属
- 独占新增：`scripts/pingcode/web/backend/app/graph_observability_service.py`
- 独占新增：`scripts/pingcode/config/graph-observability-rules.json`
- 独占接线：`scripts/pingcode/web/backend/app/training_service.py`、`app/main.py`
- 不修改前端和运行数据。

## 参考文档
- `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-29.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/01-quality-overview-local-graph-design.md`

## 变更记录
- 新增配置驱动的只读 `GraphObservabilityService`，直接读取既有图谱产物，不调用 `ensure_dataset_graph()`、模型或写入方法。
- 新增 `GET /api/datasets/{dataset_id}/graph/observability`，返回范围、事实/投影规模、五项带分子分母的健康指标、指纹、可用性、告警和规则版本。
- 兼容扩展 `GET /api/datasets/{dataset_id}/graph/neighborhood`，保留 `limit/totalEdges/truncated/displayMode`，增加统一上下文、节点/关系计数、双上限和规则版本。
- 新增 `graph-observability-rules.json`，集中管理局部图规模、深度、节点尺寸、标签密度和健康阈值。

## 验证记录
- `python3 -m py_compile app/graph_observability_service.py app/training_service.py app/main.py`：通过。
- `python3 -m unittest tests.test_training_service tests.test_keyword_filter_routes`：89 项通过。
- 隔离临时数据真实 FastAPI GET 烟测：概览、局部图和 `GRAPH_NODE_NOT_FOUND` 契约通过，断言未调用 `ensure_dataset_graph()`。
- 隔离 643 关键词、1000 关系、各 30 次真实 HTTP 调用：概览 P95 31.39ms，局部图 P95 9.43ms。
- 目标文件 `git diff --check`：通过。
- 未读取或修改 `batch_dc23fc9141ba4d6f`。
