# TASK-RAG-KG-RG18：发布前置检查与结构化阻断

## 元信息

- 状态: completed
- 分配: backend-worker A
- 创建: 2026-08-18
- 预计完成: 2026-08-25（4h）
- 依赖: RG-16；对 manifest 的完整验证依赖 RG-17
- 需人类确认: 否（ACL 未判定必须保持 false）
- 可并行: 是，可与 RG-17/RG-21 并行；与 RG-20 串行
- 文件归属: `governance_state.py`、`services.py`、`main.py` 发布异常透传、`tests/test_governance_state.py`、`tests/test_governance_publish_api.py`

## 交付与验收

- [x] 发布前统一检查 Entity/Relation、evidence、ACL、quality、evaluation 和 manifest。
- [x] P0 返回稳定 `PUBLISH_GATE_BLOCKED` 及脱敏的 checks，`force=true` 不可绕过。
- [x] 版本冲突时指针不变，返回 `STATE_VERSION_CONFLICT`。
- [x] 历史兼容、新治理数据默认拒绝和真实 API 回归通过。

## 完成证据

- 真实 FastAPI 契约覆盖合法发布、越级、P0 阻断、CAS 冲突、幂等和历史兼容。
- ACL 在 RG-20 完成前持续为默认拒绝；本任务未伪造真实授权通过结果。
- 验收证据见 `agent-runner/docs/modules/knowledge-graph-governance/testing/01-m2-contract-lineage-test-report.md`。

## 参考

- `agent-runner/docs/modules/knowledge-graph-governance/development/06-state-api-error-contract.md`
- `agent-runner/docs/modules/knowledge-graph-governance/development/16-m2-safe-publish-detailed-design.md`
