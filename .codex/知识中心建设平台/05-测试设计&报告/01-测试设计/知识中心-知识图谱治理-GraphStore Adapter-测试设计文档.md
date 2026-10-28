# GraphStore Adapter 测试设计

```yaml
documentType: test-design
moduleId: knowledge-graph-governance
status: design-ready
version: 1.0.0
createdAt: 2026-08-19
relatedTasks: [TASK-RAG-KG-M8-GS-DES-01]
```

## 1. 测试目标与门禁

先以 `LocalGraphStore` 运行厂商无关契约套件；后续任何外部 Adapter 必须原样通过同一套件，再增加真实基础设施的重启、限流和容量测试。组件测试不替代真实 FastAPI、可信身份、隔离 dataset 和生产快照回放。

硬门禁：越权成功数为 0；未发布、keyword、partial/failed/invalidated 版本可查询数为 0；跨 dataset/版本结果数为 0；重试重复对象数为 0；事实源在投影失败后变更数为 0；敏感正文日志命中数为 0。

## 2. 测试层次

| 层次 | 目标 |
|---|---|
| Schema/contract | canonical 校验、接口返回、稳定错误分类 |
| Adapter contract | Local 和未来外部实现的一致语义 |
| Repository/worker integration | outbox、租约、游标、重试、死信、恢复 |
| Real API/security | 身份、ACL、发布门禁、中文错误和审计 |
| Fault/performance | 原子失败、崩溃接管、限流、内存和 P95 |

## 3. 可执行矩阵

| ID | 场景与输入 | 预期断言 | 层次 |
|---|---|---|---|
| GS-01 | 合法 formal/published 版本 | canonical 节点边全部通过，版本非空 | contract |
| GS-02 | 节点缺 `sourceSnapshotId` | 单记录隔离，`GRAPH_NODE_SCHEMA_INVALID` | contract |
| GS-03 | 节点缺 evidence 或 ACL | 不得 formal 投影，逐项 issue 可定位 | contract |
| GS-04 | 关系端点不存在 | 关系拒绝，版本不得 succeeded | contract |
| GS-05 | 关系端点跨 graph version | `GRAPH_CROSS_VERSION_EDGE`，无写入 | contract |
| GS-06 | 关系 ACL 宽于端点/dataset | deny 优先并拒绝，不自动收窄后静默接纳 | security |
| GS-07 | confidence 为 NaN、越界或字符串 | schema 拒绝且不导致整批未分类异常 | contract |
| GS-08 | 相同版本和对象重放相同内容 | 幂等成功，节点/边计数不增加 | adapter |
| GS-09 | 相同幂等键重放不同摘要 | 冲突并死信，不覆盖原对象 | adapter |
| GS-10 | 两 worker 并抢同一版本 lease | 恰好一个获得；另一个无副作用 | concurrency |
| GS-11 | 两个不同版本并行投影 | 可并行且计数、游标互不污染 | concurrency |
| GS-12 | 节点批次成功、关系批次部分失败 | 状态 partial，查询门禁拒绝 | integration |
| GS-13 | 可重试超时后恢复 | 退避后从已持久化游标继续，无重复 | recovery |
| GS-14 | 不可重试 schema/指纹错误 | 直接 dead-letter，错误已脱敏 | recovery |
| GS-15 | worker 在 upsert 成功、游标落盘前崩溃 | 接管后幂等重放，最终计数正确 | fault |
| GS-16 | lease 到期且原 worker 恢复 | 旧 lease 不能推进状态或覆盖新游标 | concurrency |
| GS-17 | outbox ack 前崩溃 | 事件重新消费但 write run 仍幂等 | fault |
| GS-18 | 已发布版本缺 outbox | reconciler 以确定性 key 补齐一次 | recovery |
| GS-19 | manifest/hash/count 任一篡改 | 整体终止，不调用 Adapter 写入 | integrity |
| GS-20 | validate 实际计数不匹配 | 不得 succeeded，记录验证 issue | integrity |
| GS-21 | validate 出现悬空端点/跨版本对象 | 不得 succeeded，禁止激活 binding | integrity |
| GS-22 | 查询缺 dataset/version/ACL 任一项 | fail-closed，`GRAPH_QUERY_CONTEXT_INVALID` | API/security |
| GS-23 | context dataset 与 manifest 不一致 | 拒绝且不泄露目标版本内容 | API/security |
| GS-24 | 匿名、过期、伪造或撤权主体 | 返回统一拒绝，越权结果为 0 | real API/security |
| GS-25 | allow 与 deny 同时命中 | deny 优先；节点、边、证据均不可见 | real API/security |
| GS-26 | ACL 依赖不可用 | fail-closed，不从缓存放行未知身份 | real API/security |
| GS-27 | keyword_analysis 图请求 GraphRAG | `GRAPH_VERSION_NOT_QUERYABLE`，不 fallback | API |
| GS-28 | formal 但未 published | 不查询、不自动选择最新版本 | API |
| GS-29 | published 但 write partial/failed | 不查询，返回可恢复状态和 writeRunId | API |
| GS-30 | succeeded 后被 invalidated | 后续查询拒绝；事实目录仍完整可验 | lifecycle |
| GS-31 | 请求不存在版本且存在旧成功版本 | 明确 not found，不静默回退 | API |
| GS-32 | Local store 不可用 | `GRAPH_STORE_UNAVAILABLE`，事实和 binding 不变 | fault |
| GS-33 | 深度大于 2、数量/超时超过上限 | 服务端收紧或拒绝，资源有界 | performance/security |
| GS-34 | evidence 反查 | 每项同 dataset/version/ACL 且能回放稳定引用 | API |
| GS-35 | legacy 缺版本/ACL/evidence | 仅 `legacy_unverified` 诊断，不投影 formal | migration |
| GS-36 | 版本删除请求 | 产生失效事件，不物理删除已提交事实 | lifecycle |
| GS-37 | CAS 切换 binding 冲突 | 当前指针不变，返回稳定冲突错误 | concurrency |
| GS-38 | 日志与 issue 扫描 | 不含 JWT、凭据、原文、完整 evidence、厂商正文 | security |
| GS-39 | 1k/8k 流式投影 | 峰值内存随 batch 上界，不随全图线性保留 | performance |
| GS-40 | 1/2 跳高连接度节点查询 | 节点、边、时间均受配置上限，truncated 正确 | performance |
| GS-41 | Adapter 契约替身与 Local 对照 | 相同 fixture 返回相同稳定 ID、状态和错误码 | adapter |
| GS-42 | 图数据库重启/限流/连接耗尽 | 重试或死信符合分类，无假成功 | future infra |

## 4. Fixture 与证据要求

- 最小合法 formal/published 图：至少 3 节点、2 关系、2 source、完整 evidence/ACL/有效期。
- 隔离安全图：同名节点分属两个 dataset、两个 ACL scope 和两个 graph version，用于证明不按名称拼接。
- 损坏 fixture：哈希、计数、JSON 类型、悬空端点、跨版本、缺 evidence、ACL 冲突分别独立生成。
- legacy fixture：保留真实旧字段形状，不手工补入目标字段。
- 性能 fixture 由确定性生成器产生，记录 schema/rules/generator version 和摘要，不提交超大运行产物。
- 真实 API 证据必须包含请求关联 ID、脱敏身份、HTTP 状态、稳定错误码、投影前后计数、审计事件和事实目录摘要。

## 5. 故障注入点

至少提供 `after_fact_commit`、`after_publish_pointer_cas`、`after_outbox_append`、`after_lease`、`after_node_upsert`、`before_cursor_commit`、`after_edge_upsert`、`before_validation`、`before_run_succeeded_cas`、`before_outbox_ack`。每个点验证重启后只有“可重试未完成”或“完整成功”，不得出现可查询的 partial 版本。

## 6. 性能方案

S/M/L 的绝对规模和 P95 预算等待基础设施审批。实现阶段先记录而不伪造门限：输入节点/边/evidence 数、batch、worker 数、墙钟时间、吞吐、P50/P95/P99、RSS、Python 分配峰值、磁盘读写、lease 等待、重试和查询展开量。通过条件是资源受配置上限控制、无全图常驻和无随重试增加的重复对象；最终数值门禁由 G4 冻结。

## 7. 执行顺序与完成声明

1. Schema/validator 单测。
2. `LocalGraphStore` 厂商无关契约套件。
3. outbox/worker 并发和故障恢复。
4. 应用服务与真实 FastAPI 身份/ACL 测试。
5. 1k/8k 基线和长稳测试。
6. 选型批准后，对外部 Adapter 重跑同一契约，再执行 GS-42 和 G4 容量验收。

只有上述对应阶段证据全部通过，才可分别声明“Adapter 契约完成”“LocalGraphStore 完成”或“外部投影可发布”；不能以设计文档或组件绿色宣称 GraphRAG 生产可用。
