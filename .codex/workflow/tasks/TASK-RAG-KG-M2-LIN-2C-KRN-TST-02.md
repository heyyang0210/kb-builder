# TASK-RAG-KG-M2-LIN-2C-KRN-TST-02：2C 内核契约修复红灯测试

## 元信息

- 状态: completed
- 分配: test-engineer
- 创建: 2026-08-18
- 预计完成: API-DES-01 完成后 2h
- 父任务: TASK-RAG-KG-M2-LIN-2C-API-01
- 依赖: TASK-RAG-KG-M2-LIN-2C-API-DES-01
- 需人类确认: 否（固化已选架构）
- 可并行: 可与 FRZ-TST-01 并行；仅新增独立测试文件
- 文件归属: `scripts/pingcode/web/backend/tests/test_keyword_rule_rebuild_contract.py`

## SMART 目标

在 2 小时内建立可重复红灯测试，证明同 run 规则证据、完整 `rebuildOf`、稳定候选身份、执行上下文、崩溃接管和零模型原子边界尚未满足。

## 验收标准

- [x] candidate 的 `extractorSnapshotRef.runId` 等于 `rebuildRunId`（当前实现红灯）。
- [x] `rebuildOf` 包含 `datasetId/taskId/inputDigest`，候选 ID 不依赖外层 task ID（当前实现红灯）。
- [x] executor 获得只读 `rebuildRunId/ruleSnapshotRef` 上下文（当前实现红灯）。
- [x] rename 后崩溃、stale running reservation 均可有界恢复（当前实现红灯）。
- [x] 模型调用非零时没有可引用结果；该断言通过。
- [x] `py_compile` 与目标文件 `git diff --check` 通过。

## 验收记录

- 原有 `tests.test_keyword_rule_rebuild`：9/9 通过。
- 新契约测试：7 项中 6 项按预期红灯、1 项通过；红灯均对应已记录的内核缺口，非 fixture/环境错误。
- 未修改业务代码、旧测试或文档；未调用公共 API。
