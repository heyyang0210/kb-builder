# TASK-RAG-KG-M8-GS-LOCAL-BE-01：LocalGraphStore 兼容 Adapter

## 元信息

- 状态: completed
- 分配: backend-worker B
- 创建: 2026-08-19
- 预计完成: 开始后 4h
- 依赖: GS-CONTRACT-BE-01
- 需人类确认: 否
- 可并行: 是；与 WRITE-BE 文件不重叠
- 文件归属: `scripts/pingcode/web/backend/app/repositories/local_graph_store.py`

## SMART 目标

在 4 小时内使用 `GraphVersionRepository` 的不可变快照实现 LocalGraphStore，不读取 training run 的可变图文件，并通过全部本地 Adapter 契约测试。

## 验收标准

- [x] 仅从已验证 graph version manifest/nodes/edges 读取。
- [x] begin/upsert 重试不重复写入，版本间不覆盖。
- [x] validate 校验计数、端点、指纹、证据与版本字段。
- [x] 一至二跳有界查询返回明确版本与截断信息。
- [x] invalidate 只追加失效事实，不物理删除历史版本。
- [x] 不缓存未绑定指纹的数据，不依赖 mtime/size 作为唯一一致性依据。
- [x] 聚焦测试、`py_compile`、`git diff --check` 通过。

## 实现与验证记录

- 实现文件: `scripts/pingcode/web/backend/app/repositories/local_graph_store.py`
- 契约对齐: 查询强制 `GraphQueryContext`，写入强制 `GraphWriteContext` 和 canonical DTO；未隐式构造 ACL 或版本上下文。
- 事实边界: 所有查询/写入前均调用 `GraphVersionRepository.read_verified()`，产物只通过 `read_artifact()` 读取；未读取 training run、dataset 图或 `latest.json`。
- 投影语义: `(graphVersionId, objectId)` 内容摘要幂等，同键异内容返回 `GRAPH_WRITE_CONFLICT`，不同版本使用独立投影状态文件。
- 生命周期: invalidation 追加到独立 JSONL 日志并立即阻断查询，不修改或删除 `graph-versions/{graphVersionId}`。
- 验证命令: `python3 -m py_compile app/repositories/local_graph_store.py tests/test_local_graph_store.py`
- 聚焦测试: `uv run --with pytest --with pyyaml --with pydantic python -m pytest -q tests/test_graph_store_contract.py tests/test_local_graph_store.py`，结果 `12 passed in 0.46s`。
- 质量检查: scoped `git diff --check` 通过。

## 独立验收返工（2026-08-19）

- 红灯文件: `scripts/pingcode/web/backend/tests/test_graph_store_integration.py`。
- 真实 `GraphProjectionWorker + LocalGraphStore` 组合进入 `dead_letter`，当前 `begin_write` DTO 不兼容。
- 已发布事实尚未投影即可查询；查询门禁必须依赖同 store/version 的持久化 `succeeded` 状态。
- `validate` 当前读取事实计数而非实际投影，且缺完整 evidence/ACL 抽样结果；不得报告假通过。
- edge ACL 宽于端点范围仍被接纳；必须以 deny 优先和端点 ACL 交集拒绝。
- invalidation 接口未接收和持久化 `reason/actorRef`，审计契约不完整。
- 返工完成条件: 上述组合红灯转绿，旧 28 项保持通过，事实目录摘要保持不变。

### 返工结果

- canonical 节点/关系及内容摘要现持久化到独立 Local projection；查询与 `validate` 不再把 immutable facts 冒充投影结果。
- 查询构造支持显式注入 `write_repository`，且只有同 `local + graphVersionId` 为 `succeeded` 才可读；未注入时 fail-closed。
- `validate` 返回实际/预期计数、悬空端点、跨版本、fingerprint、evidence 和 ACL 完整报告。
- 关系写入基于已投影端点校验版本和 ACL 交集，宽权限关系返回 `GRAPH_ACL_CONFLICT`。
- invalidation 强制非空 `reason/actor_ref` 并追加审计事件，immutable graph version 保持不变。
- 组合红灯: `tests/test_graph_store_integration.py` 为 `9 passed`；隔离端到端验证为 `runStatus=succeeded, queryable=true, entityId=node-0`。
- 旧 `test_local_graph_store.py` 有 3 项需由测试所有者按冻结安全契约更新：禁止无 queryability provider 查询、关系写入前必须投影全部端点、invalidation 必须提供 reason/actor。实现未为旧测试放宽安全边界。
- `py_compile` 与 scoped `git diff --check` 通过。

### 测试契约同步

- `test_local_graph_store.py` 已改为完整 canonical fixture；可查询场景通过真实 Worker、lease、checkpoint、validation 和 succeeded 状态，不再手工伪造 queryable。
- Local reader 显式注入对应 `GraphWriteRepository`；keyword/未发布及无 succeeded run 的场景保持 `GRAPH_VERSION_NOT_QUERYABLE`。
- 幂等关系写入前先投影全部端点；invalidation 传入并断言持久化 `reason/actorRef`。
- 聚焦回归: contract + local + integration 共 `21 passed in 1.19s`。
- 测试 `py_compile` 与 scoped `git diff --check` 通过。
