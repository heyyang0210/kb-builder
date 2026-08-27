# TASK-KGO-30-FE-01: 实现统一诊断状态与三栏框架

## 元信息
- 状态: completed
- 分配: frontend-worker
- 创建: 2026-08-17
- 预计完成: 开始后 4 小时内
- 依赖: TASK-KGO-30-BE-01
- 父任务: TASK-KGO-REQ-30
- 需人类确认: 否
- 可并行: 是（契约冻结后可与 TASK-KGO-30-BE-02 并行）

## 需求描述
在质量分析页建立唯一 ScopeContext 和“问题与搜索、局部图谱、证据详情”三栏框架，接入服务端全局搜索和探索，移动端切换为三个标签页。

## SMART 验收标准
- [x] 4 小时内完成统一状态、三栏/移动标签布局和 search/explore 接入。
- [x] 状态覆盖 run/view/query/category/resource/focus/depth 并同步 URL。
- [x] 搜索输入使用防抖和请求序号，慢响应不能覆盖最新选择。
- [x] 点击问题或搜索结果加载局部图谱，切换视图重新请求服务端投影。
- [x] 刷新、前进和后退恢复同一上下文；布局无嵌套卡片和文字溢出。
- [x] 保留人工复核流程，生产构建通过。

## 完成证据
- 新增 GraphIssueNavigator.vue、GraphDiagnosisWorkbench.vue，并完成 QualityPage.vue 接入。
- 目标批次只读页面验证可恢复 focusNodeId，局部图 canvas 正常挂载，无 4xx 和控制台错误。
- 前端生产构建通过。

## 文件归属
- 独占新增：`scripts/pingcode/web/frontend/src/components/GraphIssueNavigator.vue`
- 独占新增：`scripts/pingcode/web/frontend/src/components/GraphDiagnosisWorkbench.vue`
- 独占：`scripts/pingcode/web/frontend/src/views/QualityPage.vue`
- 不修改 `KeywordEvidenceDrawer.vue`、后端和运行数据。

## 参考文档
- `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-30.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/02-problem-diagnosis-evidence-linkage-design.md`
