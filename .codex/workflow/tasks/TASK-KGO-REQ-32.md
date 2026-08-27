# TASK-KGO-REQ-32：证据原文下钻与人工核验

## 元信息

- 状态: completed
- 分配: 多角色
- 创建: 2026-08-17
- 预计完成: 2026-08-17
- 依赖: TASK-KGO-REQ-30
- 需人类确认: 否（兼容扩展、无新依赖，用户已明确要求实施）

## SMART 子任务

| 子任务 | 角色 | 文件归属 | 验收 | 状态 |
|---|---|---|---|---|
| `TASK-KGO-32-BE-01` | Backend Worker | `graph_exploration_service.py`、`training_service.py`、`main.py` | 五状态、四级定位和受控 URL 真实 API 可用 | completed |
| `TASK-KGO-32-FE-01` | Frontend Worker | `GraphEvidencePanel.vue` | 中文诊断、预览、高亮、打开和下载可用 | completed |
| `TASK-KGO-32-TST-01` | Test Engineer | 图谱探索测试及前端验收产物 | 后端真实 HTTP、构建、桌面/移动通过 | completed |
| `TASK-KGO-32-RPT-01` | Reporter | 模块进展、PROGRESS、NEXT、RISKS | 状态与实际测试证据一致 | completed |

## 依赖与并发

后端与前端可在接口设计冻结后并行；测试在两者完成后执行；Reporter 最后串行汇总。各 Worker 独占上表文件，修改共享看板仅由 Reporter 执行。

## 参考

- `.codex/requirements/modules/knowledge-graph-governance/REQ-KGO-32.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/04-evidence-source-drilldown-design.md`
