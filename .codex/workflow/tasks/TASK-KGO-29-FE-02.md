# TASK-KGO-29-FE-02: 接入质量概览与局部图谱工具栏

## 元信息
- 状态: completed
- 分配: frontend-worker
- 创建: 2026-08-17
- 预计完成: 开始后 4 小时内
- 依赖: TASK-KGO-29-BE-01、TASK-KGO-29-FE-01
- 父任务: TASK-KGO-REQ-29
- 需人类确认: 否
- 可并行: 否（独占 QualityPage）

## 需求描述
在质量分析页展示图谱范围条、三种规模、健康指标和局部图谱工具栏；未选择焦点时显示中文问题入口或空状态，不向 ECharts 传入全量图谱。

## SMART 验收标准
- [x] 4 小时内完成中文桌面/移动界面接入。
- [x] 页面明确显示数据集、过滤运行、视图、来源、指纹状态和更新时间。
- [x] 完整/投影/渲染规模口径分离，任何截断均显示当前值和总值。
- [x] 未选焦点时渲染节点为 0；选择关键词后使用 neighborhood 加载局部图谱。
- [x] 五项健康指标显示值、统计依据和 available/not_applicable/stale 状态。
- [x] 保留原关键词过滤、人工复核和证据抽屉行为，生产构建通过。

## 完成记录

- 新增 `GraphObservabilitySummary.vue` 和 `GraphToolbar.vue`，在 `QualityPage.vue` 接入只读概览与有界局部图。
- 未选焦点时不挂载 `KnowledgeGraph`，不请求 `graph/nodes` 或 `graph/edges`；搜索在当前完整过滤运行决策中全局匹配。
- 选择焦点后请求 `graph/neighborhood?limit=80&depth=1|2`，并用请求序号防止旧上下文覆盖新结果。
- 验证：`npm run build` 通过；目标文件 `git diff --check` 通过；静态检查确认质量页无全量节点/关系请求。

## 文件归属
- 独占新增：`scripts/pingcode/web/frontend/src/components/GraphObservabilitySummary.vue`
- 独占新增：`scripts/pingcode/web/frontend/src/components/GraphToolbar.vue`
- 独占：`scripts/pingcode/web/frontend/src/views/QualityPage.vue`
- 不修改 `KnowledgeGraph.vue`、后端和运行数据。

## 参考文档
- `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-29.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/01-quality-overview-local-graph-design.md`
