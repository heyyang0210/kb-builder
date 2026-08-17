# TASK-RAG-KG-RG14：六类验收矩阵汇总

## 元信息
- 状态: review
- 分配: test-engineer
- 计划窗口: 2026-08-21（不超过 4h）
- 依赖: RG-08、RG-09、RG-10、RG-11、RG-12、RG-13
- 文件归属: `agent-runner/docs/modules/knowledge-graph-governance/development/12-m1-acceptance-matrix.md`、本任务卡
- 并行: 不可与 RG-15 并行；只在前六项完成后开始
- 需人类确认: G2 前确认真实后端 API 环境、隔离数据集和性能资源

## 目标与范围
将状态、ACL、lineage、ontology、检索、发布六类设计统一为可执行验收矩阵，区分单元、契约、真实 API、故障注入和性能测试；只设计，不执行生产写入。

## 交付与验收
- [x] 每类至少包含正常、边界、失败、安全和回归用例，映射到需求/风险/门禁。
- [x] 每个用例具备前置数据、请求、预期响应、审计证据和清理步骤。
- [x] 标记哪些测试可用本地 fixture，哪些必须真实后端 API。
- [x] 覆盖 P0 阻断、P1/P2 告警、异步图投影和事实源回放。
- [x] 形成 Test/Architect 走查输入，未覆盖项列为 rework。

设计证据：`agent-runner/docs/modules/knowledge-graph-governance/development/12-m1-acceptance-matrix.md`

## 未决项
隔离环境的认证方式、数据规模、图数据库是否 disabled、性能压测配额需在 G2 评审确认。
