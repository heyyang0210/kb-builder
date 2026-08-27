# TASK-KGO-30-FE-02: 接通图谱、问题和证据双向联动

## 元信息
- 状态: completed
- 分配: frontend-worker
- 创建: 2026-08-17
- 预计完成: 开始后 4 小时内
- 依赖: TASK-KGO-30-BE-02、TASK-KGO-30-FE-01
- 父任务: TASK-KGO-REQ-30
- 需人类确认: 否
- 可并行: 否（继续独占 QualityPage）

## 需求描述
接入节点和关系证据接口，使问题列表、局部图谱和证据详情双向定位；补齐 resource 筛选、缺失证据筛选、stale 展示和完整 URL 恢复。

## SMART 验收标准
- [x] 4 小时内完成 node/edge/resource 证据联动和中文状态展示。
- [x] 类别到任意可用证据不超过 3 次点击；节点与关系均可下钻。
- [x] 点击节点定位列表并加载证据；点击关系高亮两端并加载关系证据。
- [x] resource 筛选同时作用于问题、图谱和证据；missing/stale 明确可见。
- [x] URL 恢复 focusNodeId/focusEdgeId/resourceId，移动标签切换不丢状态。
- [x] 不自动调用 apply、模型或修改复核结果，生产构建通过。

## 完成证据
- 新增 GraphEvidencePanel.vue，完成问题、局部图和证据三栏联动及移动端三个标签页。
- 目标批次只读页面验证证据面板返回 661 条来源，URL 上下文恢复正常，无 4xx 和控制台错误。
- 前端生产构建通过。

## 文件归属
- 独占新增：`scripts/pingcode/web/frontend/src/components/GraphEvidencePanel.vue`
- 独占：`scripts/pingcode/web/frontend/src/components/GraphDiagnosisWorkbench.vue`
- 独占：`scripts/pingcode/web/frontend/src/views/QualityPage.vue`
- 按需独占修改：`scripts/pingcode/web/frontend/src/components/KeywordEvidenceDrawer.vue`
- 不修改后端和运行数据。

## 参考文档
- `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-30.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/02-problem-diagnosis-evidence-linkage-design.md`
