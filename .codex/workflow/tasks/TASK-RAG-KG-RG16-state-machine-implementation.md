# TASK-RAG-KG-RG16：治理状态机内部实现

## 元信息

- 状态: completed
- 分配: backend-worker/test-engineer
- 依赖: RG-08、RG-15 G2
- 文件归属: `scripts/pingcode/web/backend/app/governance_state.py`、`scripts/pingcode/web/backend/tests/test_governance_state.py`
- 需人类确认: G2-01 已于 2026-08-18 确认方案 A并完成接入。

## 交付

- 独立实现 `keyword → formal → index → evaluated → published` 单向状态迁移。
- 发布必须同时满足 Entity/Relation、证据、ACL、质量和评测五项门禁。
- 统一返回 `STATE_VERSION_CONFLICT`、`STATE_INVALID_TRANSITION`、`PUBLISH_GATE_BLOCKED`。
- 通过不可变快照和 `expected_status_version` 提供 CAS 语义。
- 5 项单元测试覆盖正常路径、越级发布、门禁失败、版本冲突和不可变性。
- `DatasetVersion` 增加可选 `governance` 嵌套字段，历史记录保持兼容。
- `/api/datasets/{datasetId}/publish` 支持 `expectedStatusVersion`，治理模式执行 P0 门禁和原子 CAS。
- 新加工数据初始化治理状态；正式知识结果更新 Entity/Relation、证据、质量、ACL 和评测门禁状态。

## 验收结果

验证结果：

- 治理状态与发布 API：9/9 通过。
- 图版本组合回归：14/14 通过。
- 训练服务回归：86/86 通过。
- 合并执行：100/100 通过；相关 Python 文件语法检查通过。

## 后续边界

RG-16 已完成公共 API 接入。真实身份和 ACL 判定属于 RG-20；在 RG-20 完成前，新治理数据的 `acl` 默认保持 `false`，因此不能发布。
