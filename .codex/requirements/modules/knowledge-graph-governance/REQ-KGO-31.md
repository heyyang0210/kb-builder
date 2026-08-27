# REQ-KGO-31：知识图谱版本治理与质量运营

```yaml
documentType: requirement
moduleId: knowledge-graph-governance
owner: Project Manager
status: approved
version: 1.0.0
updatedAt: 2026-08-17
relatedRequirements: [REQ-KGO-30]
relatedDesigns:
  - agent-runner/docs/modules/knowledge-graph-governance/development/03-version-governance-quality-operations-design.md
relatedTasks: [TASK-KGO-REQ-31]
```

## 1. 为什么做

运行级诊断不等于正式知识资产版本。知识库运营需要追溯每个正式图谱的来源、规则和质量状态，并能够对比版本变化、观察趋势和查看发布风险。

## 2. 必须提供

- 仅 `final_knowledge` 正式发布成功后创建不可变 `graphVersionId`。
- 版本保存数据集、训练任务、过滤运行、规则、模型、产物哈希和健康指标。
- 支持版本列表、详情、有界探索、稳定 ID 差异、质量趋势和发布检查。
- 历史指标保留当时规则快照，规则变化时显式分段。
- 发布检查首版只返回 warning，不改变既有发布成功语义。

## 3. 不包含

- 版本删除、在线回滚、自动恢复、跨数据集合并和阻断式门禁。
- 新增图数据库、时序数据库、消息服务或前端图引擎。
- 过滤运行、人工保存、apply 或任务创建时生成正式版本。

## 4. 业务验收

| 编号 | 验收条件 |
|---|---|
| AC-31-01 | 任意正式版本都能追溯数据集、运行、规则/模型指纹和产物哈希 |
| AC-31-02 | 并发或重试发布不会重复创建同一版本 |
| AC-31-03 | 版本 diff 汇总数等于节点和关系变化明细数 |
| AC-31-04 | 趋势不使用当前规则覆盖历史指标，规则变化可见 |
| AC-31-05 | warning 可审计且不阻断已确认的发布流程 |
| AC-31-06 | 损坏版本隔离失败，不影响其他版本读取 |
