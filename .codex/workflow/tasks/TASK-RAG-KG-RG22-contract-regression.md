# TASK-RAG-KG-RG22：状态、发布与前后端契约回归

## 元信息

- 状态: completed
- 分配: test-engineer
- 创建: 2026-08-18
- 预计完成: 2026-08-27（4h）
- 依赖: RG-18、RG-21
- 需人类确认: 否；真实 ACL 路径等 RG-20
- 可并行: 是，可与 RG-23/RG-24 并行
- 文件归属: 新建发布 API 契约测试和前端交互测试，不修改生产代码

## 交付与验收

- [x] 覆盖合法迁移、越级、P0、CAS 冲突、幂等和历史兼容。
- [x] 校验前后端对 `governance`、`code`、`message`、`gateChecks` 的契约一致。
- [x] 校验全部用户可见文案为中文。
- [x] 使用真实后端 API 和隔离数据集执行回归。

## 完成证据

- 发布契约使用 FastAPI `TestClient` 调用真实路由；前端 helper 使用 Node 执行可重复契约回归。
- M2 合并回归 51/51 通过，详见 `agent-runner/docs/modules/knowledge-graph-governance/testing/01-m2-contract-lineage-test-report.md`。
