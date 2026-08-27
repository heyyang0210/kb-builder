# TASK-RAG-KG-RG24：Lineage 重建与证据回放回归

## 元信息

- 状态: completed
- 分配: test-engineer
- 创建: 2026-08-18
- 预计完成: 2026-08-27（4h）
- 依赖: RG-17、RG-19
- 需人类确认: 否（使用隔离快照，不执行删除）
- 可并行: 是，可与 RG-22 并行
- 文件归属: 新建 lineage 重建/回放自动化测试

## 交付与验收

- [x] 同一 graphVersionId/citationId 重建前后文本、偏移和哈希一致。
- [x] 覆盖快照缺失、哈希不匹配、偏移越界和父记录缺失。
- [x] 损坏引用标记 stale/隔离，不静默修正或返回猜测文本。
- [x] 测试生成可追溯证据报告。

## 完成边界

- 本任务通过注入式 snapshot loader 完成模块级重建与回放验证，并复用真实图版本 API 幂等用例验证 `graphVersionId`。
- 尚未接入 ACL、citation 生产事实查询或安全审计；不得解释为生产链路端到端回放已经完成。
- 验收证据见 `agent-runner/docs/modules/knowledge-graph-governance/testing/01-m2-contract-lineage-test-report.md`。
