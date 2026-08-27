# TASK-RAG-KG-M2-LINEAGE-INT-02：训练生产出口接入 Lineage 与版本指纹

## 元信息

- 状态: in_progress
- 分配: backend-worker A
- 创建: 2026-08-18
- 预计完成: 2026-08-19（4h）
- 依赖: TASK-RAG-KG-M2-LINEAGE-INT-01
- 需人类确认: 否（沿用 `dataset.id` 作为首版候选 `versionId`）
- 可并行: 否；`training_service.py` 独占编辑
- 文件归属: `scripts/pingcode/web/backend/app/training_service.py`、新建 `scripts/pingcode/web/backend/tests/test_training_lineage_integration.py`

## SMART 目标

在 4 小时内把生产适配器接入 `_generate_dataset()` 和 `_generate_keyword_dataset()`，使两种模式的真实候选数据集都落盘可回溯治理包，并且仅在原子提交完成后更新业务 manifest 和 `governance.gateChecks.manifest`。

## 实现要求

- 复用 `run-manifest.json.lineage` 中已验证的 preparation/metadata snapshot refs，不读取 `latest.json`。
- 在 graph、index、quality 产物完成后构建治理包，在 dataset store 最终更新前完成原子提交。
- keyword 模式写 model/embedding 的实际状态，纯规则模型为 `null + not_applicable`；始终保持 Entity/Relation 正式门禁为 false。
- formal 模式从实际 Agent 审计构造 model 指纹；缺少已执行模型的可信快照时失败，不填虚假版本。
- 单 evidence 隔离问题并入质量问题；整体 manifest/version 无效则索引阶段失败，store 中 gate 保持 false。
- 不修改 `_extract_deterministic()` 的 Workflow Agent 行为，不修改 ACL。

## 本轮实施方案（默认推荐方案）

| 方案 | 选择 | 理由与边界 |
|---|---|---|
| A：在两个 dataset 生成出口共用一个内部治理包 helper | **采用** | 保持 `training_service.py` 文件归属不变，保证治理包提交成功后才更新 `governance.manifest` 门禁；不新增公共 API。 |
| B：由发布接口首次访问时懒生成治理包 | 不采用 | 发布前才发现事实不完整，无法满足候选产物可回放和失败隔离要求。 |
| C：复制一套 lineage 逻辑到训练服务 | 不采用 | 会产生双实现和指纹漂移，破坏单一事实源。 |

默认推荐授权来源：用户已明确后续待确认方案默认采用推荐方案并记录。回滚条件：任一真实训练回归出现旧候选字节变化、治理包半提交或 gate 错误放行，则关闭 helper 接线，保留旧业务产物并恢复仅候选写入。

## 验收标准

- [ ] keyword/formal 隔离任务均生成 run 和 dataset 两处可验证治理包。
- [ ] dataset `manifest.json` 只保存治理包路径、摘要和验证状态。
- [ ] 故障注入证明文件未提交时 store 中 `manifest` 不会变为 true。
- [ ] keyword 模式不因 manifest 通过而变得可发布；formal 模式仍受全部六项 P0 门禁约束。
- [ ] 真实 FastAPI/TestClient 启动训练并验证产物，不以直接调用私有方法作为唯一证据。
- [ ] 训练服务聚焦回归、语法检查和目标文件 `git diff --check` 通过。

## 实施记录（2026-08-18）

- `_generate_dataset()` 与 `_generate_keyword_dataset()` 已共用 `_commit_production_governance()`；治理包提交成功后才补写业务 manifest 的 `governance` 引用并将 `gateChecks.manifest` 置为 true。
- 纯规则 keyword 指纹使用 `model=null`、`embedding=null`，不会虚构模型版本；正式模式暂不填充模型审计快照，缺失时保持后续门禁未通过。
- `tests.test_training_lineage_integration`：1/1 通过；`tests.test_training_service` + `tests.test_production_lineage`：125 项中 123 passed、2 skipped。
- 历史最小 fixture 缺少 `sourcePath/normalizedHash` 时不生成已验证治理包，保留 `manifest=false`；该兼容路径不能作为生产出口验收证据。
- 尚未满足的验收：真实 FastAPI 启动完整 training pipeline、formal Agent 审计模型指纹、故障注入后的 store 不变性和 dataset 双目录端到端证据。

## 文件冲突声明

执行期间其他 Worker 不得编辑 `training_service.py`。若已有并发修改，先停止并重新读取，不得覆盖或回退他人改动。
