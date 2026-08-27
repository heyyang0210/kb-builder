# TASK-RAG-KG-M2-LINEAGE-INT-04：生产快照回放与 G2.5 接线验收

## 元信息

- 状态: pending
- 分配: test-engineer / doc-writer
- 创建: 2026-08-18
- 预计完成: 2026-08-20（4h）
- 依赖: TASK-RAG-KG-M2-LINEAGE-INT-01—03、RG-24
- 需人类确认: 否（只使用隔离数据，不删除生产快照）
- 可并行: 是，可与 Reporter 状态汇总并行
- 文件归属: 新建 `scripts/pingcode/web/backend/tests/test_lineage_production_replay.py`、新建 M2 生产接线测试报告；不修改业务代码

## SMART 目标

在 4 小时内通过真实后端 API 生成隔离 keyword/formal 候选数据集，验证生产 normalized snapshot 的 source→chunk→evidence 回放和重建一致性，并形成可供 RG-25 使用的可追溯验收证据。

## 验收标准

- [ ] keyword/formal 两模式均从真实 preparation/metadata 快照生成 lineage，不使用手工注入 manifest。
- [ ] 重建前后 source/chunk/evidence ID、引用文本、本地/全局偏移和 quotedHash 一致。
- [ ] 覆盖单 evidence 隔离、normalized 字节漂移、父 chunk 缺失、总指纹篡改和原子写失败。
- [ ] 发布 API 在治理包损坏时的越过成功数为 0。
- [ ] 记录测试命令、fixture、taskId/datasetId（脱敏）、断言数和失败证据到 testing 文档。
- [ ] 将 RG-17/19/24 的“仅组件/注入式”边界更新为生产接线实际结论；RG-20/23 未完成前不得通过 G2.5。
- [ ] 合并回归、Python 语法检查和目标文件 `git diff --check` 通过。

## 范围边界

本任务不验证 ACL 允许路径，不修改生产批次，不将 lineage 接线通过解释为 M2 全量完成。
