# TASK-DOC-REC-04：实现三方对账和确认门禁

- 状态：completed
- 分配：Backend Worker
- 时限：4 小时
- 依赖：TASK-DOC-REC-02
- 文件归属：`scripts/reconcile_core/reconciliation.py`

验收：五类对账状态稳定，缺少原因、契约冲突、模块变化和未验证实现能够进入 `NEEDS_CONFIRMATION`。证据：`reconciliation.py` 和 selftest 覆盖 aligned、missing-intent、target-not-implemented、unverified、未映射变化和脏工作区重叠。
