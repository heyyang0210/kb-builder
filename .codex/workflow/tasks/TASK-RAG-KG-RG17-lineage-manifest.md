# TASK-RAG-KG-RG17：Lineage Manifest 指纹与稳定引用

## 元信息

- 状态: completed
- 分配: backend-worker B
- 创建: 2026-08-18
- 预计完成: 2026-08-24（4h）
- 依赖: RG-09、G2 实施准入
- 需人类确认: 否（按 `sha256-v1` 和不删除快照的安全默认实施）
- 可并行: 是，可与 RG-18/RG-21 并行
- 文件归属: 新建 `scripts/pingcode/web/backend/app/lineage_manifest.py`、`scripts/pingcode/web/backend/tests/test_lineage_manifest.py`

## 交付与验收

- [x] 实现 source/chunk/evidence manifest Schema、稳定 ID 和 `sha256-v1` 指纹。
- [x] 单记录损坏可分类隔离，manifest 整体不可验证时失败。
- [x] 相同输入重建的 ID/哈希一致，单字节变化可检测。
- [x] 单元测试、Python 语法检查和 `git diff --check` 通过。

## 完成边界

- Manifest 构建、校验和注入式快照回放组件已完成并通过自动化测试。
- 当前尚未接入知识加工生产事实源；接线前不得将组件级通过解释为生产批次已生成 manifest。
- 验收证据见 `agent-runner/docs/modules/knowledge-graph-governance/testing/01-m2-contract-lineage-test-report.md`。

## 参考

- `agent-runner/docs/modules/knowledge-graph-governance/development/07-lineage-replay-contract.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/16-m2-safe-publish-detailed-design.md`
