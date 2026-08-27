# TASK-RAG-KG-M2-LIN-2C-TST-02：目标批次规则重建与真实 API 验收

## 元信息

- 状态: blocked
- 分配: test-engineer / doc-writer
- 创建: 2026-08-18
- 预计完成: 2C API 接线后 4h
- 父任务: TASK-RAG-KG-M2-LINEAGE-REWORK-01 / RG-24 / RG-25
- 依赖: TASK-RAG-KG-M2-LIN-2C-API-01；隔离写入验收许可；不使用目标生产批次做写入验收
- 需人类确认: 是（真实 API 创建新 run/候选版本，但不发布）
- 可并行: 是，可与 Reporter 汇总并行；不修改业务代码
- 文件归属: 新建隔离 API 验收 fixture/测试文件和 `agent-runner/docs/modules/knowledge-graph-governance/testing/` 下的 2C 验收报告

## SMART 目标

在 API 接线通过后 4 小时内，先对脱敏隔离副本执行真实 FastAPI 规则重建，再对目标 legacy 运行执行只读摘要对比；证明新 run/候选版本可完整回放、旧 55,324 条 candidate 不变、模型调用为 0，并形成可用于 RG-24/25 的审计报告。

## 执行顺序

```text
capture read-only legacy bytes/hash/mtime baseline
  -> create an isolated dataset copy through supported repository/API paths
  -> invoke real POST /api/training/tasks
  -> follow task events to a terminal state
  -> verify new run/candidate/rule snapshot/rebuildOf/rebuildKey
  -> repeat same request and concurrent request
  -> recapture legacy baseline
  -> compare and write acceptance report
```

## 验收矩阵

| 组 | 证据 | 通过标准 |
|---|---|---|
| 隔离小样本 | 成功/失败事件、新 run/version、候选记录 | 终态清晰，记录版本证据 100% |
| 完整性 | normalized/processing-units/rule snapshot 现场摘要 | 与提交清单一致 |
| 幂等/并发 | 同 key 顺序重试和并发请求 | 只有一个完整新结果 |
| 不可变 | legacy candidate 的 bytes/SHA-256/mtime | 前后完全一致 |
| 模型边界 | gateway spy/调用事件与 candidate 状态 | 调用 0，`not_applicable` 覆盖 100% |
| 回放 | source→chunk→evidence 父链、引用文本和指纹 | 全部可验证或结构化隔离 |
| 安全发布边界 | 重建结果状态 | G-LIN-03/04、ACL 和 publish 门禁未通过前不可发布 |

## 验收标准

- [ ] 真实 FastAPI 请求、taskId/datasetId（脱敏）、事件数、断言数、运行时长和峰值资源记录齐全。
- [ ] 目标 legacy 基线仍为 `RECOVERABLE=0` / `ISOLATE=55,324`；2C 只以新候选恢复业务结果，不改写审计结论。
- [ ] 旧 candidate 完整 SHA-256 前后一致，新结果的 `rebuildOf`、`rebuildKey`、规则快照和输入摘要可回放。
- [ ] 任一完整性、幂等或零模型断言失败时，2C 保持 `in_progress/blocked-by-verification`，不降低标准。
- [ ] 报告、项目经理清单、`PROGRESS.md`、`NEXT.md`、`RISKS.md` 同步，`git diff --check` 通过。

## 范围边界

本任务不允许发布新候选、不删除旧 run/dataset、不清理共享目录、不代替 RG-20/23 ACL 越权回归，也不因 2C 通过将 M2 或 G2.5 标为完成。
