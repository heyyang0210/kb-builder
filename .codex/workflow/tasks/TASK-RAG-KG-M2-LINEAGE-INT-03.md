# TASK-RAG-KG-M2-LINEAGE-INT-03：发布入口重验生产治理包

## 元信息

- 状态: completed（发布重验 5/5；治理发布组合回归通过）
- 分配: backend-worker A
- 创建: 2026-08-18
- 预计完成: 2026-08-19（3h）
- 依赖: TASK-RAG-KG-M2-LINEAGE-INT-02、RG-18
- 需人类确认: 否（不放宽门禁、不改变公共 API）
- 可并行: 否；与其他 `services.py` 修改串行
- 文件归属: `scripts/pingcode/web/backend/app/services.py`、新建 `scripts/pingcode/web/backend/tests/test_governance_publish_lineage.py`

## SMART 目标

在 3 小时内使数据集发布入口重新读取和校验 lineage manifest 与 version fingerprint，禁止仅依赖 store 中缓存的 `gateChecks.manifest` 发布。

## 实现要求

- 验证 dataset 根目录范围、治理包路径、manifest 总指纹、父链和 composite version fingerprint。
- 验证成功后把实时 `manifest=true` 合并进本次 gate evaluation；失败返回结构化 P0 阻断。
- `force=true`、历史缓存 true 或客户端参数均不得绕过重验。
- 重验与发布 CAS 使用同一份 expected governance snapshot；冲突或验证失败时发布指针、batch latest dataset 和业务 manifest 不变。
- ACL 仍取 RG-20 的结果；本任务不创建身份或授权捷径。

## 实施方案（默认推荐方案）

| 方案 | 选择 | 说明 |
|---|---|---|
| A：发布时对声明 `datasetPath` 的新生产候选现场重验 | **采用** | 新写候选必须验证治理包、normalized bytes 和业务 manifest 引用；验证在状态转换/CAS 前完成。 |
| B：只信任 store 中 `gateChecks.manifest` | 不采用 | 缓存可能陈旧或被错误写入，无法检测磁盘篡改。 |
| C：每次发布重建治理包 | 不采用 | 会改变候选事实，破坏不可变性和审计语义。 |

迁移边界：没有 `datasetPath` 的旧记录维持既有兼容路径；所有由当前训练出口新写的候选均声明 `datasetPath`，必须严格重验。若发现新候选缺治理包则 fail-closed，不允许 `force=true` 绕过。选择依据为用户常设推荐方案授权。

## 验收标准

- [x] 篡改/删除 lineage、version fingerprint、normalized snapshot 任一文件均阻断发布。
- [x] store 中 manifest=true 但磁盘损坏时仍阻断；业务 manifest 引用必须与现场结果一致。
- [x] CAS 冲突和 P0 阻断均不改变数据集/batch 发布指针。
- [x] 真实发布 API 覆盖成功重验、损坏、缺失、冲突和 force 场景。
- [x] 既有治理发布契约回归、语法检查和目标文件 scoped `git diff --check` 通过。

## 验收证据（2026-08-18）

- 新增 `GovernancePackageRepository.verify_committed()`：重验四文件、规范字节、Lineage/VersionFingerprint、自引用和 normalized 实际 bytes。
- `PreprocessService.publish()` 对声明 `datasetPath` 的新候选在状态转换/CAS 前重验；失败将实时 `manifest=false` 送入原 P0 gate，`force=true` 无法绕过。
- `tests.test_governance_publish_lineage`：5/5 passed。
- 与 `test_governance_publish_api`、`test_m2_publish_contract`、`test_production_lineage` 联合：54 项中 52 passed、2 skipped。
- 旧无 `datasetPath` 记录保持历史兼容；当前训练出口新候选必须声明路径并走严格重验。
