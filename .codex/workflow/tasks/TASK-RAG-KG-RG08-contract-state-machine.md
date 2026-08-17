# TASK-RAG-KG-RG08：状态机、API 字段与错误契约

## 元信息
- 状态: review
- 分配: backend-worker + doc-writer
- 计划窗口: 2026-08-19（不超过 4h）
- 依赖: G1 已确认；REQ-KGO-33；RG-03/RG-06
- 文件归属: `agent-runner/docs/modules/knowledge-graph-governance/development/06-state-api-error-contract.md`、本任务卡
- 并行: 可与 RG-09—RG-13 并行；RG-14 依赖本卡
- 需人类确认: G2 前确认状态名是否兼容现有训练状态；不得直接修改公共 API

## 目标与范围
定义 keyword/formal/index/evaluated/published 的显式状态机、不变量、迁移原因、API 响应字段、稳定错误码和伪代码。正式图谱发布必须满足 Entity/Relation、证据、ACL 和门禁条件；warning 不得伪装成成功。

## 交付与验收
- [x] 状态转移表覆盖成功、失败、取消、重试、回滚和重复请求。
- [x] 每个状态具备 `statusVersion`、`updatedAt`、`reasonCode`、`publishable` 语义和兼容映射。
- [x] 错误码区分 `ModelGatewayError`、JSON/文件/转换/Schema/ACL/质量错误。
- [x] 提供接口字段表、迁移伪代码和非法迁移处理。
- [x] 设计测试矩阵至少覆盖越级发布、重复提交、部分失败、取消和旧记录读取。
- [x] `git diff --check` 通过；未修改业务代码。

## 未决项
现有 API 是否允许新增字段、旧状态是否需要兼容别名、`published` 是否要求图投影完成（当前基线为异步投影）均提交 G2 决策；详见 [06-state-api-error-contract.md](../../../agent-runner/docs/modules/knowledge-graph-governance/development/06-state-api-error-contract.md)。
