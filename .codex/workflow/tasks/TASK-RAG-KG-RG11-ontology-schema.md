# TASK-RAG-KG-RG11：最小 Ontology、canonical ID 与失败隔离

## 元信息
- 状态: review
- 分配: architect + domain-reviewer
- 计划窗口: 2026-08-20（不超过 4h）
- 依赖: RG-03；REQ-KGO-33
- 文件归属: `agent-runner/docs/modules/knowledge-graph-governance/development/09-minimal-ontology.md`、本任务卡
- 并行: 可与 RG-08—RG-10、RG-12/13 并行；RG-14 依赖本卡
- 需人类确认: 领域实体类型、关系方向和 canonical ID 规范需领域负责人确认

## 目标与范围
定义首版可发布的 Entity/Relation ontology、属性、证据要求、canonical ID、别名和版本有效期。规则优先；模型候选不能绕过 Schema、证据、ACL 和质量门禁。单记录失败隔离，清单整体不可验证才终止批次。

## 交付与验收
- [x] 给出实体/关系类型表、必填属性、唯一性和关系端点约束。
- [x] 定义 canonical ID、alias、同名实体和版本范围的确定性规则。
- [x] 定义无证据边、悬空边、Schema 不合法、语义不确定的质量问题分类。
- [x] 提供实体/关系校验与单记录隔离伪代码。
- [x] 测试矩阵覆盖重复实体、悬空边、无证据边、坏记录和批次继续条件。

## 未决项
首版实体类型上限、关系集合、时间/产品版本属性及模型候选字段需领域确认；未确认时只允许设计，不实现落库。

## 设计证据

- [最小 Ontology、canonical ID 与失败隔离设计](../../../../agent-runner/docs/modules/knowledge-graph-governance/development/09-minimal-ontology.md)
- 评审结论：设计交付完成，等待领域负责人确认类型、关系和版本语义后才能进入 G2 实现。
