# TASK-RAG-KG-M2-LIN-2C-FRZ-BE-01：dataset 请求时冻结输入适配

## 元信息

- 状态: completed
- 分配: backend-worker
- 创建: 2026-08-18
- 预计完成: FRZ-TST-01 红灯后 4h
- 父任务: TASK-RAG-KG-M2-LIN-2C-API-01
- 依赖: TASK-RAG-KG-M2-LIN-2C-FRZ-TST-01
- 需人类确认: 已完成（常设授权选择请求时冻结方案）
- 可并行: 否；与 KRN-BE-02 串行
- 文件归属: `scripts/pingcode/web/backend/app/production_lineage.py`

## SMART 目标

在 4 小时内把通过轻校验的 legacy dataset 当前字节转换为新的不可变 `rebuild-input` 包，以 commit/manifest/artifact 摘要链记录 normalized、processing units、documents 和源 manifest，并输出稳定 `inputDigest`。

## 验收标准

- [x] 逐 resource 关联 normalized 与 processing units，完整校验 dataset/batch/task/mode/state。
- [x] 所有输入文件通过 containment、普通文件、非 symlink 和摘要校验。
- [x] 输出明确标记 `captureSemantics=request_time_snapshot`。
- [x] 不读取 `latest`、不修改 source dataset、不声称恢复原训练时快照。
- [x] FRZ-TST-01 全绿，聚焦回归、`py_compile`、scoped `git diff --check` 通过。

## 实施记录（2026-08-18）

- 在 `production_lineage.py` 新增 `KeywordRebuildInputFreezer` 和不可变 `CommittedRebuildInputRef`。
- 冻结包写入独立 `rebuild-inputs/<inputDigest>/`，以 `manifest.json + commit.json` 记录源 manifest、normalized、documents、processing-units 和 source facts 的摘要；不修改旧 dataset。
- 通过 JsonStore 校验 dataset、batch、task 的身份、状态和 keyword 模式；拒绝路径穿越、symlink、摘要漂移、跨 resource chunk/overlap 及关联不一致。
- 验证：`test_keyword_rebuild_input_snapshot` 14/14；`test_keyword_rule_rebuild` 与契约测试 16/16；`py_compile` 和 scoped `git diff --check` 通过。
