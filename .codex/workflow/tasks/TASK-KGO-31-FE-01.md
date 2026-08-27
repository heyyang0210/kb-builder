# TASK-KGO-31-FE-01: 实现发布级图谱质量运营页面

## 元信息
- 状态: completed
- 分配: frontend-worker
- 创建: 2026-08-17
- 预计完成: 开始后 4 小时内
- 依赖: TASK-KGO-31-BE-03
- 父任务: TASK-KGO-REQ-31
- 需人类确认: 否
- 可并行: 否（独占全局图谱页）

## 需求描述
改造全局知识图谱页，展示当前正式版本、质量趋势、版本历史、双版本差异和发布检查 warning，并复用共享局部图谱渲染器查看版本局部关系。

## SMART 验收标准
- [x] 4 小时内完成中文桌面/移动发布级运营界面。
- [x] 当前版本显示版本 ID、发布时间、来源、规则版本、规模、健康状态和 warning。
- [x] 用户可选择两个版本查看新增/删除/变化及分页明细。
- [x] 趋势在规则版本变化处明确分段，不产生误导性连续线。
- [x] warning 不显示为通过，不提供自动修复、删除或回滚按钮。
- [x] 局部图谱使用版本 explore 接口，不加载全量版本节点和边；生产构建通过。

## 放行证据
- 依赖证据：BE-03 全部只读接口已在隔离版本上可用，响应字段和分页上限冻结。
- 输出证据：桌面与移动页面截图或 Playwright 记录，覆盖版本选择、diff 分页、趋势规则分段、warning 和局部探索。
- 范围证据：静态网络检查确认页面不请求全量版本节点/边；npm run build 和目标文件 git diff --check 通过。

## 完成记录

- 完成时间：2026-08-17
- 当前正式版本：展示版本 ID、发布时间、来源任务/过滤运行、规则版本、来源指纹、节点/关系规模、健康指标和发布 warning。
- 版本历史：支持完整版本元数据选择、分页历史、当前正式版标识、损坏状态隔离和双版本选择。
- 版本差异：服务端全局查询、变化类型筛选、分页明细、节点/关系汇总、健康指标变化、lineage/规则变化提示；节点差异可直接进入目标版本局部图。
- 质量趋势：按 `rulesSegment + rulesVersion` 拆分 ECharts 折线，规则变更处断线并显示口径警告。
- 发布检查：warning 独立高亮，非 warning 折叠展示；未提供自动修复、删除、回滚或阻断发布操作。
- 版本局部图：仅调用 `/api/graph/versions/{id}/explore`，支持稳定节点 ID、1/2 跳、节点/关系摘要和 URL 上下文恢复。
- 响应式：桌面双栏运营区在窄屏转单栏，历史表格横向可达，局部图详情在移动端下移。

## 变更文件

- `scripts/pingcode/web/frontend/src/views/KnowledgeGraphPage.vue`
- `scripts/pingcode/web/frontend/src/components/GraphVersionHistory.vue`
- `scripts/pingcode/web/frontend/src/components/GraphVersionDiff.vue`
- `scripts/pingcode/web/frontend/src/components/GraphQualityTrend.vue`

## 验证证据

- `npm run build`：通过，Vite 生产构建完成（5007 modules transformed）。
- `git diff --check -- scripts/pingcode/web/frontend/src/views/KnowledgeGraphPage.vue scripts/pingcode/web/frontend/src/components/GraphVersionHistory.vue scripts/pingcode/web/frontend/src/components/GraphVersionDiff.vue scripts/pingcode/web/frontend/src/components/GraphQualityTrend.vue`：通过。
- 静态请求审计：目标文件未出现 `/api/index/graph`、`/graph/nodes` 或 `/graph/edges`；版本事实仅通过有界 `explore` 接口进入画布。
- 真实 API：当前代码后端 `http://127.0.0.1:8005` 与前端代理 `http://127.0.0.1:3505/pingcode-api` 的数据集、版本列表请求均返回 HTTP 200。
- 当前运行目录版本列表为 `total=0`，未对业务批次执行重新发布或写入；带版本数据的桌面/移动截图和完整交互记录由 `TASK-KGO-31-TST-01` 使用隔离正式发布夹具验收。

## 文件归属
- 独占新增：`scripts/pingcode/web/frontend/src/components/GraphVersionHistory.vue`
- 独占新增：`scripts/pingcode/web/frontend/src/components/GraphVersionDiff.vue`
- 独占新增：`scripts/pingcode/web/frontend/src/components/GraphQualityTrend.vue`
- 独占：`scripts/pingcode/web/frontend/src/views/KnowledgeGraphPage.vue`
- 不修改 `QualityPage.vue`、后端和运行数据。

## 参考文档
- `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-31.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/03-version-governance-quality-operations-design.md`
