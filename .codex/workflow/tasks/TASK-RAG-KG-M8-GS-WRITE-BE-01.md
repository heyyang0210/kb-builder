# TASK-RAG-KG-M8-GS-WRITE-BE-01：GraphWriteRun 仓储与投影执行器

## 元信息

- 状态: completed
- 分配: backend-worker A
- 创建: 2026-08-19
- 预计完成: 开始后 4h
- 依赖: GS-CONTRACT-BE-01、GS-WRITE-TST-01 红灯证据
- 需人类确认: 否；只实现本地执行器，不连接外部服务
- 可并行: 是；与 LOCAL-BE 文件不重叠
- 文件归属: `scripts/pingcode/web/backend/app/repositories/graph_write_repository.py`、`app/graph_projection_service.py`

## SMART 目标

在 4 小时内实现持久化 GraphWriteRun/Issue 和可注入 GraphStore 的批处理投影执行器，通过状态与故障测试。

## 验收标准

- [x] 写入状态按 revision CAS 迁移，`(storeId, graphVersionId)` 确定性 single-flight。
- [x] 批大小有界，checkpoint 仅在 Adapter 返回 durable item result 后推进并续租。
- [x] 失败按 retryable 分类并记录脱敏 issue，不保存底层异常或逐项错误正文。
- [x] 重启从已提交 checkpoint 恢复；过期 lease 可接管，旧 owner 受 fencing 阻断。
- [x] 全量计数、端点、指纹、evidence 和 ACL 抽样校验通过后才进入 `succeeded`。
- [x] invalidate 保存 reason/actor 审计字段；实现不修改或删除 JSON/JSONL 事实源。
- [x] 聚焦测试、并发测试、既有 GraphVersion 回归、`py_compile`、scoped `git diff --check` 通过。

## 实现记录（2026-08-19）

### GraphWriteRepository

- 新增 `app/repositories/graph_write_repository.py`，在隔离的 `graph-projections/runs` 保存 GraphWriteRun、outbox 状态和逐项 issue；不在 graph version 事实目录写任何文件。
- `writeRunId/eventId` 由 `storeId + graphVersionId` 确定性生成；重复 admission 返回同一记录，不同不可变事实返回 `GRAPH_WRITE_CONFLICT`。
- admission、lease、状态、checkpoint 和 issue 各自使用 `fcntl` 短锁，状态文件使用临时文件、fsync、`os.replace` 原子提交。
- revision CAS、lease owner、expiry 和 TTL 续租共同构成 fencing；同版本最多一个有效 worker，不同版本可独立调度。
- 支持 pending/retry_wait/过期执行接管、partial/failed 重试、预算耗尽 dead-letter、succeeded 后可审计 invalidation。
- queryable 判定只接受 `succeeded`；partial、failed、retry_wait、dead-letter、invalidated 均返回 false。

### GraphProjectionWorker

- 新增 `app/graph_projection_service.py`，复用 `graph_store_contract.py` 的 `GraphWriteContext`、规范映射函数与 `GraphStoreContractError`，没有复制 DTO/异常。
- 每次处理前调用 `GraphVersionRepository.read_verified/read_artifact`，现场核对 dataset、source snapshot、source fingerprint、formal/published、publish checks、payload ref/hash。
- 节点先于关系按配置 batch 写入；成功 batch 落盘后推进 cursor，`before_cursor_commit` 崩溃由幂等重放恢复。
- retryable timeout/unavailable 进入有界 retry_wait；逐项 partial 按 item retryable 分类；非重试或预算耗尽进入 dead-letter。
- issue 只保存稳定错误码和固定脱敏摘要，不保存 Adapter 异常正文、token、evidence 或厂商错误内容。
- Adapter validate 必须同时满足状态、节点边计数、悬空/跨版本为零、指纹、evidence 与 ACL 抽样通过才 CAS succeeded。

## 验证证据

```bash
cd scripts/pingcode/web/backend
python3 -m unittest \
  tests.test_graph_projection_write \
  tests.test_graph_version_routes -v
python3 -m py_compile \
  app/graph_store_contract.py \
  app/repositories/graph_write_repository.py \
  app/graph_projection_service.py \
  tests/test_graph_projection_write.py
git diff --check -- \
  app/repositories/graph_write_repository.py \
  app/graph_projection_service.py \
  ../../../../.codex/workflow/tasks/TASK-RAG-KG-M8-GS-WRITE-BE-01.md
```

- 组合回归：13/13 passed，其中投影状态/故障 8/8，既有 GraphVersion API/并发/性能 5/5。
- `py_compile`：通过。
- scoped `git diff --check`：通过。
- `tests.test_graph_store_contract` 使用 pytest 风格且当前环境未安装 pytest；本任务没有引入新依赖，以 contract 模块编译和 WRITE 组合回归验证集成。
- 没有外部服务、网络请求或生产数据写入。

## 文件与后续边界

- 新增：`scripts/pingcode/web/backend/app/repositories/graph_write_repository.py`。
- 新增：`scripts/pingcode/web/backend/app/graph_projection_service.py`。
- 更新：本任务卡。
- `app/repositories/README.md` 已存在且当前工作区已有他人修改；本任务文件所有权不含该共享文档，因此未编辑。已通知主任务由拥有者同步新增仓储说明。
- 本任务只证明本地 repository/worker integration；未接公共 API、可信身份/ACL、外部图数据库，也不代表 GraphRAG 生产可用。

## 独立验收返工（2026-08-19）

- 红灯文件: `scripts/pingcode/web/backend/tests/test_graph_store_integration.py`。
- `transition` 可在无 owner/TTL 时手工建立 lease 并推进，违反 single-flight fencing；过期 lease 拒绝已通过。
- `updates` 未限制 immutable identity 字段，当前可修改 `datasetId` 等投影身份。
- worker 向真实 Local Adapter 传持久化 dict，而非冻结的 `GraphWriteRun` DTO。
- canonical mapper 会推断 legacy 缺失的 name/admission/lifecycle/direction/confidence，违反 `legacy_unverified` 隔离边界。
- 返工完成条件: ownerless lease、identity mutation、legacy inference 均 fail-closed；真实 Worker+Local 完成一次成功投影。

### 方案选择记录

- 待确认项：安全契约与旧测试夹具冲突时，是否保留手工建立无主租约和 legacy 语义默认值。
- 默认采用推荐方案：fail-closed；租约只能由 `lease_next` 建立，缺失语义不推断，旧夹具后续按正式 canonical contract 迁移。
- 选择理由：兼容旧夹具需要恢复已证实的 fencing 绕过通道，或伪造不存在的正式图语义，会直接降低并发安全性和数据可信度。

### 返工实现结果

- `transition` 拒绝直接进入 `leased`；`leased/writing/validating` 的状态推进必须同时满足 owner 匹配且 TTL 未过期。
- `transition(updates=...)` 改为显式白名单，阻断 `datasetId`、`graphVersionId`、`payloadHash`、`writeRunId` 等身份或存储状态覆盖。
- Worker 显式构造冻结 `GraphWriteRun` DTO 传给 Adapter，不再传递可变持久化字典。
- canonical mapper 仅允许字段别名映射，不再从 ID/manifest/默认值推断缺失语义；写 Adapter 前统一执行 `validate_graph_batch`。

### 返工验证结果

- 直接安全断言 4/4 通过：禁止手工建租约、禁止不可变身份更新、过期租约拒绝推进、legacy 缺失语义拒绝推断。
- `py_compile` 和 scoped `git diff --check` 通过。
- 当前系统 Python 未安装 pytest；未为测试引入新依赖。
- 完整 9 项跨层验收 9/9 通过，其中真实 `GraphProjectionWorker + LocalGraphStore` 完成一次从 admission 到 `succeeded` 的投影。由于系统未安装 pytest，使用仅提供 `pytest.raises/parametrize` 语义的内存驱动直接执行原测试函数，未修改测试源码。
- Test Engineer 已迁移 `test_graph_projection_write` 夹具：状态测试统一通过 `admit_projection -> lease_next` 建立有 owner/TTL 的租约，不可变事实显式补齐 canonical 字段；原 8 项状态/故障/恢复覆盖 8/8 通过。
- 旧 `test_local_graph_store` 首项仍假设“正式版本发布后可在未成功投影时直接查询”，与新 `projection succeeded` 门禁冲突；同样交由 Test Engineer 迁移，不放宽生产查询边界。
- 既有 GraphVersion API/并发/性能回归 5/5 通过。
- 最终本任务组合验收：投影状态/故障 8/8 + 真实 GraphStore 跨层 9/9 + GraphVersion 回归 5/5，合计 22/22 通过。
