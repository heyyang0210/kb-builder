# TASK-KGO-29-FE-01: 收敛共享局部图谱渲染器

## 元信息
- 状态: completed
- 分配: frontend-worker
- 创建: 2026-08-17
- 预计完成: 开始后 4 小时内
- 依赖: TASK-KGO-MOD-01 设计冻结
- 父任务: TASK-KGO-REQ-29
- 需人类确认: 否
- 可并行: 是（可与 TASK-KGO-29-BE-01 并行）

## 需求描述
将 `KnowledgeGraph.vue` 收敛为纯局部图谱渲染组件，节点形状表达类型、颜色表达质量状态，默认只显示焦点、选中和异常标签，并提供稳定的空、加载、错误与截断展示入口。

## SMART 验收标准
- [x] 4 小时内完成组件改造和组件级手工/自动验收。
- [x] 组件不计算 admission 投影、健康指标或服务端筛选。
- [x] 输入超过配置上限时拒绝静默渲染并发出截断提示事件。
- [x] 工具事件覆盖节点、关系、适配、重置和视口变化，按钮使用现有图标库并提供中文提示。
- [x] 80 节点/160 边基线下标签无大面积重叠，resize 和反复切换不泄漏图表实例。
- [x] 不新增 npm 依赖，前端生产构建通过。

## 完成记录

- 变更文件：`scripts/pingcode/web/frontend/src/components/KnowledgeGraph.vue`
- 验证：`npm run build` 通过，目标文件 `git diff --check` 通过。

## 文件归属
- 独占：`scripts/pingcode/web/frontend/src/components/KnowledgeGraph.vue`
- 可独占新增局部渲染辅助文件；不得修改 `QualityPage.vue` 和后端。

## 参考文档
- `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-29.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/01-quality-overview-local-graph-design.md`
