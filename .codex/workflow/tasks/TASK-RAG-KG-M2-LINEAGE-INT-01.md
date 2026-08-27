# TASK-RAG-KG-M2-LINEAGE-INT-01：生产 Lineage 事实适配与原子治理包

## 元信息

- 状态: ready
- 分配: backend-worker B
- 创建: 2026-08-18
- 预计完成: 2026-08-18（4h）
- 依赖: RG-17、RG-19、`development/17-m2-production-lineage-integration.md`
- 需人类确认: 否（不修改公共 API、ACL 或模型边界）
- 可并行: 是，可与 RG-20 安全设计并行
- 文件归属: 新建 `scripts/pingcode/web/backend/app/production_lineage.py`、`scripts/pingcode/web/backend/tests/test_production_lineage.py`

## SMART 目标

在 4 小时内实现生产事实适配器和治理包仓储，将已提交 preparation/metadata 快照、formal final results 或 keyword candidates 确定性映射为可验证的 lineage manifest 和 version fingerprint；不接入训练出口。

## 实现要求

- 对数据集内冻结的 `normalized/{resourceId}.md` 实际 bytes 计算 source hash，禁止使用 `originalHash` 代替。
- chunk 使用 `normalizedOffsets` 对规范化正文切片，现场计算 `textHash`；不得把 overlap 拼接内容直接作为回放文本。
- formal evidence 归一化现有本地 offset；keyword evidence 由 `evidenceText` 确定性产生本地 offset。
- 单 evidence 损坏隔离并返回结构化质量问题；source/chunk 父链、快照或总指纹不可验证时整体失败。
- `.governance-staging-{uuid}` 完成校验后目录级原子发布，提供 commit 结果；不更新 dataset store 或治理 gate。

## 验收标准

- [ ] 相同输入重复构建的 source/chunk/evidence ID、manifest 和 version fingerprint 完全一致。
- [ ] normalized snapshot 单字节变化、offset 越界、父链缺失均被检测且不发布治理包。
- [ ] 单 evidence 损坏只隔离该条，其他有效记录保持可验证。
- [ ] keyword/formal 本地 offset、overlap 重绑和多义证据场景均有测试。
- [ ] 治理包故障注入后没有半提交的 `governance/` 目录。
- [ ] Python 语法检查、聚焦测试和目标文件 `git diff --check` 通过。

## 参考文档

- `agent-runner/docs/modules/knowledge-graph-governance/development/17-m2-production-lineage-integration.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/07-lineage-replay-contract.md`
