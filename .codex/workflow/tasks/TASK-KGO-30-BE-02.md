# TASK-KGO-30-BE-02: 实现节点和关系统一证据查询

## 元信息
- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-17
- 预计完成: 开始后 4 小时内
- 依赖: TASK-KGO-30-BE-01
- 父任务: TASK-KGO-REQ-30
- 需人类确认: 否
- 可并行: 否（继续独占共享后端文件）

## 需求描述
新增 `graph/evidence` 只读接口，使任意图谱节点或关系按稳定 ID 下钻到 resource、chunk 和受控原文证据，并与现有 issue-evidence 复用索引和去重函数。

## SMART 验收标准
- [x] 4 小时内完成节点/关系证据接口和定向测试。
- [x] nodeId、edgeId 至少一个必填，错误参数返回稳定中文错误码。
- [x] 证据按稳定 ID、resourceId、chunkId 关联，不按名称模糊匹配。
- [x] 单条 evidenceText <= 500 字符，筛选完整集合后分页，pageSize <= 100。
- [x] available/missing/stale 均保留可见，源缺失不静默丢项。
- [x] 643 条/百级文档 P95 < 800ms；现有 issue-overview/issue-evidence 回归通过。

## 完成记录

- 新增 `graph/evidence` 只读接口，支持节点/关系稳定 ID、资源筛选、分页和 missing/stale。
- 隔离 HTTP 测试验证 500 字证据上限、参数校验和旧问题证据接口兼容。

## 文件归属
- 独占：`scripts/pingcode/web/backend/app/keyword_issue_insight_service.py`
- 独占：`scripts/pingcode/web/backend/app/graph_exploration_service.py`
- 独占接线：`scripts/pingcode/web/backend/app/training_service.py`、`app/main.py`
- 不修改前端和运行数据。

## 参考文档
- `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-30.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/02-problem-diagnosis-evidence-linkage-design.md`
- `docs/28-文档共性问题总览与证据下钻需求.md`
