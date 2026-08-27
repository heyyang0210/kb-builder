# REQ-KGO-30：知识图谱问题诊断与证据联动

```yaml
documentType: requirement
moduleId: knowledge-graph-governance
owner: Project Manager
status: approved
version: 1.0.0
updatedAt: 2026-08-17
relatedRequirements: [REQ-KGO-29]
relatedDesigns:
  - agent-runner/docs/modules/knowledge-graph-governance/development/02-problem-diagnosis-evidence-linkage-design.md
relatedTasks: [TASK-KGO-REQ-30]
```

## 1. 为什么做

用户已能看到问题总览、图谱和证据，但三者尚未共享稳定选择状态，搜索也不能保证作用于完整服务端集合。本需求建立“问题、局部图谱、原文证据”联动闭环，让质量审核能够快速定位且可恢复。

## 2. 必须提供

- 问题列表、局部图谱和证据详情三区联动。
- 搜索与筛选先作用于完整运行投影，再分页和裁剪。
- 基于过滤运行冻结事实定义过滤前、过滤后和发生变化视图。
- 节点、关系、文档和证据只通过稳定 ID 关联。
- URL 可恢复运行、视图、筛选、焦点和探索深度。
- 历史事实不可用时显式标记 stale，不按同名节点猜测关联。

## 3. 不包含

- 正式图谱版本、趋势、发布检查和回滚。
- 无限深度路径、模型补写证据或整篇原文返回。
- 修改人工复核 CAS、自动保存和 apply 契约。

## 4. 业务验收

| 编号 | 验收条件 |
|---|---|
| AC-30-01 | 从问题类别到任意可用原文证据不超过 3 次操作 |
| AC-30-02 | 任意页搜索都在完整集合中命中目标，不局限当前画布或分页 |
| AC-30-03 | 过滤前/后/变化分别与候选、最终保留和最终变化决策一致 |
| AC-30-04 | 刷新、前进后退和分享 URL 能恢复同一诊断状态 |
| AC-30-05 | available 证据的 node/resource/chunk/evidence 映射完整率 100% |
| AC-30-06 | missing/stale 均有中文事实状态，不输出错误关联 |
