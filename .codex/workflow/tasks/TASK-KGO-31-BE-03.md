# TASK-KGO-31-BE-03: 实现版本查询、差异与趋势 API

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-17
- 预计完成: 开始后 4 小时内
- 依赖: TASK-KGO-31-BE-02
- 父任务: TASK-KGO-REQ-31
- 需人类确认: 否
- 可并行: 否（继续独占版本服务接线）

## 需求描述
新增版本列表、详情、有界探索、diff、trends 和 checks 只读接口，差异按稳定 ID 计算，趋势读取历史指标快照并按规则版本分段。

## SMART 验收标准
- [x] 4 小时内完成全部只读版本接口和定向测试。
- [x] 列表/详情不默认返回全量节点和边，分页和上限配置化。
- [x] diff 覆盖节点/关系新增、删除、属性变化及指标、规则变化，汇总等于明细总数。
- [x] 版本探索复用 REQ-30 的有界、稳定、无悬空边逻辑。
- [x] 趋势只读 manifest 快照，规则变化返回分段标记。
- [x] 列表/趋势 P95 < 500ms，千级 diff P95 < 1s。

## 放行证据
- 依赖证据：BE-02 的发布接线和 warning 语义测试通过，版本索引中存在至少两个可比较版本。
- 输出证据：保存列表、详情、explore、diff、trends、checks 的响应样例；用稳定 ID 复算 diff 汇总并核对明细。
- 性能证据：记录列表/趋势及千级 diff 的 P95、样本规模、分页参数和执行命令。

## 文件归属
- 独占新增：`scripts/pingcode/web/backend/app/graph_version_diff_service.py`
- 独占：版本仓储和质量检查服务相关读取方法。
- 独占接线：`scripts/pingcode/web/backend/app/main.py`
- 不修改发布写入流程、前端和运行历史。

## 参考文档
- `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-31.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/03-version-governance-quality-operations-design.md`

## 完成记录

- 变更：`app/graph_version_diff_service.py`、`app/graph_version_service.py`、`app/main.py`、`tests/test_graph_version_routes.py`。
- 接口：列表、详情、有界探索、checks、稳定 ID diff 和规则分段 trends 均通过真实 FastAPI HTTP 验收。
- diff：节点与关系分别统计 added/removed/changed，`summary.total` 与两类明细总数一致，并返回健康、规则和 lineage 变化。
- 探索：使用版本冻结事实，深度和节点/边上限读取版本规则快照，返回结果无悬空边。
- 性能：1000 个知识节点、1000 个文档块、1000 条关系基线下，列表 P95 `4.03ms`、趋势 P95 `4.06ms`、diff P95 `194.39ms`。
