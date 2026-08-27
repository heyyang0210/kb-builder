# TASK-RAG-KG-RG21：治理状态与发布阻断前端

## 元信息

- 状态: completed
- 分配: frontend-worker
- 创建: 2026-08-18
- 预计完成: 2026-08-26（4h）
- 依赖: RG-08、RG-16
- 需人类确认: 否
- 可并行: 是，可与 RG-17—19 并行
- 文件归属: `frontend/src/api.js`、`views/PreprocessPage.vue`、`views/QualityPage.vue`

## 交付与验收

- [x] 治理数据展示中文状态、六项门禁、阻断原因和下一步动作。
- [x] 发布传入 `expectedStatusVersion`，P0 时禁用且不展示强制发布。
- [x] `STATE_VERSION_CONFLICT` 自动重载；`PUBLISH_GATE_BLOCKED` 展示具体中文未通过项。
- [x] 历史 `governance == null` 数据保持现有交互，关键词分析不显示为已发布。
- [x] 前端构建与相关自动化测试通过。

## 完成证据

- Node helper 契约测试覆盖治理状态、中文阻断原因和下一步动作，Vite 生产构建通过。
- 真实 ACL 授权交互仍以 RG-20/RG-23 为准，不属于本任务的完成声明。

## 参考

- `agent-runner/docs/modules/knowledge-graph-governance/development/16-m2-safe-publish-detailed-design.md`
