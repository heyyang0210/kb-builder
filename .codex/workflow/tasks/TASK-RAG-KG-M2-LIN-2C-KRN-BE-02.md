# TASK-RAG-KG-M2-LIN-2C-KRN-BE-02：2C 内核同 run 与恢复契约修复

## 元信息

- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-18
- 预计完成: KRN-TST-02 红灯后 4h
- 父任务: TASK-RAG-KG-M2-LIN-2C-API-01
- 依赖: TASK-RAG-KG-M2-LIN-2C-KRN-TST-02
- 需人类确认: 已完成（常设授权选择同 run 原子方案）
- 可并行: 否；独占 `production_lineage.py`
- 文件归属: `scripts/pingcode/web/backend/app/production_lineage.py`

## SMART 目标

在 4 小时内将内核接口改为可信规则 descriptor + 完整 source lineage，先确定 key/run，再在同一 staging run 提交规则快照和 candidates，并实现 rename 后及 stale reservation 恢复。

## 验收标准

- [x] 不接受外部 rule run 快照作为新 candidate 的最终证据。
- [x] executor 使用不可变 rebuild 上下文，输出稳定且模型调用为 0。
- [x] 同 run、`rebuildOf` 和崩溃恢复红灯全部转绿。
- [x] 原 2C-T01—T09 按新接口等价迁移，断言未降低。
- [x] 旧产物 bytes/SHA-256/mtime 不变，无新依赖、不读 `latest`。
- [x] 聚焦回归、`py_compile` 和 scoped `git diff --check` 通过。

## 验证证据

- 2026-08-18：`test_keyword_rule_rebuild_contract`、`test_keyword_rule_rebuild`、`test_keyword_extractor_version` 共 23 项，`23 passed`。
- `production_lineage.py` 通过 `py_compile`、无尾随空白、scoped `git diff --check`。
- 规则快照与 candidates 在同一个 staging run 提交后整体 rename；最终 candidate 的 `extractorSnapshotRef.runId == rebuildRunId`。
- `rebuildOf` 强制包含 `datasetId/taskId/inputDigest`；同 key 使用 reservation 单飞，rename 后可重验接管，过期 lease 仅单 worker 接管。
- `RebuildExecutionContext` 为 frozen value object，`modelAllowed=false`；非零模型调用在候选提交前以 `RULE_ONLY_CONTRACT_VIOLATION` 终止。
- 旧 2C fixture 已迁移到 descriptor/context 入口；旧输入 candidate 的 bytes、SHA-256 和 mtime 未被修改。
- 2026-08-18 追加并发修复：rename 后等待 Worker 先完成 reservation 接管时，原 Worker 对相同 `resultFingerprint` 视为幂等成功；结果不一致仍以 `ARTIFACT_INTEGRITY_ERROR` 拒绝。T03 独立重复 10/10 通过。
