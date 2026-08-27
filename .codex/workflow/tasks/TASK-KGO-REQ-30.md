# TASK-KGO-REQ-30: 知识图谱问题诊断与证据联动

## 元信息
- 状态: completed
- 类型: 独立父任务 / P1
- 分配: backend-worker / frontend-worker / test-engineer
- 创建: 2026-08-17
- 目标完成: REQ-29 验收后 2 个工作日内
- 依赖: TASK-KGO-REQ-29 completed
- 需人类确认: 否（用户已确认运行级诊断定位和增量接口策略）
- 可并行: 父任务之间不可并行；内部仅按文件归属有限并行

## 需求目标
依据 `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-30.md`，建立问题列表、局部图谱、证据详情三栏联动，支持服务端全局搜索、稳定的过滤前/后/变化投影、节点和关系证据下钻及 URL 恢复。

## 子任务与顺序
1. `TASK-KGO-30-BE-01` 实现运行投影、全局搜索和有界探索。
2. `TASK-KGO-30-BE-02` 在前项基础上实现节点/关系证据查询。
3. `TASK-KGO-30-FE-01` 可在搜索和探索契约冻结后实现统一状态与三栏框架。
4. `TASK-KGO-30-FE-02` 在证据契约和三栏框架完成后接通完整联动。
5. `TASK-KGO-30-TST-01` 完成组合验收。

## SMART 验收标准
- [x] REQ-29 验收后完成全部子任务，无阻塞。
- [x] 搜索先作用于完整运行投影再分页，不局限当前页或已加载数据。
- [x] `before/after/changed` 分别与候选、最终保留和最终变化决策一致。
- [x] 问题类别到原文证据最多 3 次点击；节点和边均可下钻。
- [x] URL 完整恢复运行、视图、筛选、焦点和探索深度。
- [x] 历史源不可用时返回并显示 stale，不按同名节点错误关联。
- [x] 真实 API 响应满足 < 800ms 目标，构建和目标检查通过。

## 完成证据
- 后端探索路由测试 5/5，REQ-29/30 与问题洞察组合回归 16/16。
- 前端生产构建通过；目标批次只读页面无 4xx、无控制台错误，URL 和证据联动已验证。
- 已解除 TASK-KGO-REQ-31 依赖。

## 完成条件
`TASK-KGO-30-TST-01` 全部通过后将本任务标记 completed，更新模块进展，并解除 REQ-31 的依赖。

## 参考文档
- `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-30.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/02-problem-diagnosis-evidence-linkage-design.md`
- `docs/26-关键词过滤决策审计与历史记录需求.md`
- `docs/28-文档共性问题总览与证据下钻需求.md`
