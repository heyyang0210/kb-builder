# TASK-RAG-KG-RG19：图与索引版本指纹

## 元信息

- 状态: completed
- 分配: backend-worker B
- 创建: 2026-08-18
- 预计完成: 2026-08-25（4h）
- 依赖: RG-17
- 需人类确认: 否
- 可并行: 是，RG-17 完成后可与 RG-18/RG-21 并行
- 文件归属: 新建 `version_fingerprint.py`、`tests/test_version_fingerprint.py`

## 交付与验收

- [x] 实现 graph/index/rule/model/embedding 版本指纹。
- [x] 未启用的 model/embedding 返回 `null + not_applicable`，不生成虚假版本。
- [x] 指纹序列化顺序确定，重建结果可重现。
- [x] 单元测试覆盖启用/未启用、输入漂移和幂等场景。

## 完成边界

- 版本指纹的确定性构建与漂移检测组件已完成。
- 当前尚未接入知识加工生产事实源及正式发布指针；生产接线完成前仅作为可复用组件验收。
- 验收证据见 `agent-runner/docs/modules/knowledge-graph-governance/testing/01-m2-contract-lineage-test-report.md`。

## 参考

- `agent-runner/docs/modules/knowledge-graph-governance/development/07-lineage-replay-contract.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/16-m2-safe-publish-detailed-design.md`
