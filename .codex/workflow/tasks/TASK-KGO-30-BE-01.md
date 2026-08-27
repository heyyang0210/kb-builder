# TASK-KGO-30-BE-01: 实现运行图谱投影、全局搜索与有界探索

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-17
- 预计完成: 开始后 4 小时内
- 依赖: TASK-KGO-REQ-29 completed
- 父任务: TASK-KGO-REQ-30
- 需人类确认: 否
- 可并行: 否（先冻结 REQ-30 后端核心契约）

## 需求描述
以过滤运行候选快照、有效最终决策和图谱指纹为事实源，稳定生成 before/after/changed 投影，并新增服务端完整集合搜索和深度 1/2 的有界局部图谱接口。

## SMART 验收标准
- [x] 4 小时内完成投影服务、search/explore 路由和定向测试。
- [x] before、after、changed 分别精确对应候选、最终保留和最终变化集合。
- [x] 搜索先组合 query/type/category/resource 筛选完整集合再分页，pageSize <= 100。
- [x] explore 深度只允许 1/2，稳定排序，无悬空边，返回 matched/returned 数量和 truncated。
- [x] 运行源不可用返回 stale，不使用当前同名节点拼接历史关系。
- [x] 643 条搜索 P95 < 500ms，探索 P95 < 800ms，不调用模型、不修改运行 revision。

## 完成记录

- 新增 `graph_exploration_service.py` 和 `graph/search`、`graph/explore` 只读接口。
- 隔离 HTTP 契约测试通过，覆盖三视图、组合筛选、分页、stale、稳定排序与无悬空边。

## 文件归属
- 独占新增：`scripts/pingcode/web/backend/app/graph_exploration_service.py`
- 独占接线：`scripts/pingcode/web/backend/app/training_service.py`、`app/main.py`
- 可读取但不修改过滤运行仓储和问题证据服务。
- 不修改前端和运行数据。

## 参考文档
- `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-30.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/02-problem-diagnosis-evidence-linkage-design.md`
