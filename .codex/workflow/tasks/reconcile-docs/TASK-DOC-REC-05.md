# TASK-DOC-REC-05：实现 CLI、报告、验证和检查点

- 状态：completed
- 分配：Backend Worker
- 时限：4 小时
- 依赖：TASK-DOC-REC-03、TASK-DOC-REC-04
- 文件归属：`scripts/reconcile_docs.py`、`contracts.py`

验收：所有子命令可用，检查点仅在确认且验证通过时原子推进，失败不改变基线。证据：真实全量审计生成报告；未决问题使 `validate` 返回失败，`checkpoint --confirmed` 被拒绝且未生成检查点。
