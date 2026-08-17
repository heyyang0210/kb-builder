# TASK-RAG-KG-RG15：G2 契约设计评审与实施准入

## 元信息
- 状态: review
- 分配: architect + product-owner + test-engineer
- 计划窗口: 2026-08-21（不超过 2h）
- 依赖: RG-08—RG-14 全部交付
- 文件归属: `agent-runner/docs/modules/knowledge-graph-governance/development/13-g2-design-review.md`、本任务卡
- 并行: 串行收口；通过后才可进入 RG-16—RG-25 实现
- 需人类确认: 必须由 Product Owner/Architect/Test 共同确认；涉及公共 API、ACL、外部依赖和性能资源

## 目标与范围
逐项审查前六张设计卡的一致性、可实现性和风险，记录 `accepted`/`rework`/`deferred`，冻结文件归属和实施边界。未批准的图数据库、向量库、reranker、Provider 保持 disabled，不得进入代码。

## 交付与验收
- [x] 形成审查记录：决策、证据链接、责任人、截止日期和阻塞项。
- [x] 检查状态、lineage、ACL、ontology、检索和评测 Schema 无字段/语义冲突。
- [x] 确认公共 API 是否保持兼容，所有破坏性变更列出审批项。
- [x] 确认 G2 通过条件：设计文档、接口、伪代码、测试矩阵齐全且 P0 风险有处置。
- [x] 更新项目经理清单、PROGRESS.md、NEXT.md；未通过则标记 rework，不启动实现。

评审证据：`agent-runner/docs/modules/knowledge-graph-governance/development/13-g2-design-review.md`

## 未决项
最终 GraphStore 厂商、部署/容量、身份系统、指标阈值和性能资源仍属于 G1/G3/G4 决策；本评审只能冻结“接口优先、外部依赖 disabled”的实施边界。
