# TASK-RAG-KG-M8-GS-DES-01：GraphStore Adapter 架构与详细设计

## 元信息

- 状态: completed
- 分配: architect / doc-writer
- 创建: 2026-08-19
- 预计完成: 开始后 4h
- 依赖: REQ-KGO-34、ADR 05、默认方案确认
- 需人类确认: 否；不引入外部依赖、不修改公共 API
- 可并行: 否；所有实现的前置任务
- 文件归属: `agent-runner/docs/modules/knowledge-graph-governance/development/21-graph-store-adapter-architecture.md`、`22-graph-store-adapter-detailed-design.md`、`testing/04-graph-store-adapter-test-design.md`、模块 `README.md`

## SMART 目标

在 4 小时内冻结 GraphStore 分层、canonical node/edge、查询上下文、GraphWriteRun/Issue 状态、异常分类、接口、伪代码、迁移兼容和不少于 20 项的测试矩阵。

## 验收标准

- [x] 明确 JSON/JSONL 事实源、LocalGraphStore 和外部投影的责任边界。
- [x] 接口不包含 Neo4j/Cypher/Nebula 类型，`graphVersionId` 独立建模。
- [x] 节点、边、证据、ACL、有效期、版本和发布状态字段及校验顺序明确。
- [x] 给出 begin/upsert/validate/query/invalidate 的接口与伪代码。
- [x] 给出 outbox、重试、部分失败、死信、恢复和禁止静默回退伪代码。
- [x] 明确 legacy 图只读兼容，不得无证据补齐正式语义。
- [x] 测试矩阵覆盖幂等、跨版本、跨 dataset、keyword、未发布、ACL、损坏和原子失败。
- [x] 模块 README 同步新增文档索引；`git diff --check` 通过。

## 范围保护

不修改业务代码、测试代码、公共 API、运行数据或 ADR 选型结论。

## 完成记录

- 完成时间: 2026-08-19
- 架构设计: `agent-runner/docs/modules/knowledge-graph-governance/development/21-graph-store-adapter-architecture.md`
- 详细设计: `agent-runner/docs/modules/knowledge-graph-governance/development/22-graph-store-adapter-detailed-design.md`
- 测试设计: `agent-runner/docs/modules/knowledge-graph-governance/testing/04-graph-store-adapter-test-design.md`
- 验收证据: 厂商无关接口、canonical DTO、三组状态、outbox/租约/重试/死信/恢复伪代码和 42 项测试矩阵已冻结；模块 README 索引已同步。
- 边界声明: 未修改业务代码、测试代码、公共 API、运行数据，未引入依赖或厂商类型；M2、外部投影与 GraphRAG 生产门禁仍待后续任务验证。
