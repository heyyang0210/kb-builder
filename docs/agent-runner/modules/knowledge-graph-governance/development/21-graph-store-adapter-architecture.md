# GraphStore Adapter 架构设计

```yaml
documentType: architecture-design
moduleId: knowledge-graph-governance
status: design-frozen
version: 1.0.0
createdAt: 2026-08-19
relatedRequirements: [REQ-KGO-34]
relatedDesigns: [05-graph-vector-store-selection-adr, 19-m2-production-readiness-review]
relatedTasks: [TASK-RAG-KG-M8-GS-DES-01]
```

## 1. 用户问题与阶段目标

知识库运营人员需要在不改变加工、治理和发布语义的前提下，将当前单机 JSON/内存图逐步演进为可扩展的生产查询存储。平台维护者需要能替换存储实现，而不让业务层依赖厂商查询语言、驱动类型或内部 ID。

当前事实是：`GraphVersionRepository` 已保存不可变版本目录并校验哈希、计数、稳定 ID 和端点；`GraphVersionService` 能从正式图生成快照；但 `GraphObservabilityService` 和 `GraphExplorationService` 仍可直接读取 dataset/run 下的整份 `nodes.json`、`edges.json`，部分响应的 `graphVersionId` 为空。由文件时间推断“当前版本”、进程内缓存及状态与产物分离也不能满足多实例生产一致性。

本阶段目标是冻结存储无关边界，并用 `LocalGraphStore` 先验证同一契约。它不接入外部数据库、不修改公共 API，也不宣称 M2 或 GraphRAG 已生产可用。

## 2. 已确认决策

1. JSON/JSONL 治理包和不可变图版本是审计事实源；图数据库只是可重建的消费投影。
2. `graphVersionId` 是独立一等标识，不复用 `datasetId`、training run ID 或可变 `latest` 指针。
3. 业务层只依赖厂商无关 `GraphStore` 端口；首个实现为 `LocalGraphStore`。
4. 外部图数据库通过持久化 outbox 异步投影，不与本地事实同步双写。
5. 只有 `formal + published + qualityGate=passed + graph_write_succeeded` 的同一不可变版本可供 GraphRAG 查询。
6. 查询上下文强制包含 `datasetId + graphVersionId + ACLContext`，默认拒绝；禁止静默切换版本或 dataset。
7. 修改和删除产生新版本；历史版本只读，通过失效状态停止服务，不物理删除事实。
8. Adapter 不包含 Neo4j、NebulaGraph、Cypher、nGQL 或厂商驱动类型。厂商和部署仍由 G1/G4 审批。

## 3. 方案比较

| 方案 | 价值 | 风险 | 结论 |
|---|---|---|---|
| 继续由业务服务直接读 JSON | 改动小 | 整图加载、版本为空、ACL 分散、多实例缓存不一致 | 仅作为待迁移现状 |
| 同步双写 JSON 与外部图数据库 | 写后立即查询 | 无跨存储事务，部分成功难恢复，发布语义不可信 | 不采用 |
| 不可变事实源 + GraphStore + 异步投影 | 可回放、可替换、故障隔离、可审计 | 需要 outbox、状态和最终一致性治理 | 采用 |
| 图数据库作为唯一事实源 | 查询路径短 | 丢失离线审计和可重建能力，数据库故障阻断加工 | 不采用 |

## 4. 逻辑架构与责任

```text
加工流水线 -> CanonicalGraphValidator -> GraphVersionRepository
                                      |      JSON/JSONL immutable truth
                                      v
                                ProjectionOutbox
                                      v
                             GraphProjectionWorker
                                      v
                 +---------------- GraphStore ----------------+
                 |                                             |
          LocalGraphStore                               External Adapter
       immutable version files                      approved graph database
                 +-------------------+-------------------------+
                                     v
                         GraphQueryApplicationService
                  dataset + graphVersion + ACLContext
```

| 组件 | 负责 | 不负责 |
|---|---|---|
| `GraphVersionRepository` | 原子提交、哈希/计数验证、不可变事实读取 | 外部投影、ACL 决策、厂商查询 |
| `CanonicalGraphValidator` | canonical node/edge/evidence/schema 校验和规范映射 | 猜测 legacy 缺失语义 |
| `ProjectionOutbox` | 持久化投影意图、租约、重试、死信和恢复游标 | 保存图业务事实 |
| `GraphProjectionWorker` | 按批写节点/边、校验结果、推进状态 | 提升发布状态、静默忽略失败 |
| `GraphStore` | 幂等写、完整性检查、有界且版本化查询、失效 | 身份认证、业务发布审批、生成答案 |
| `LocalGraphStore` | 用不可变版本文件实现相同端口，作为兼容基线 | 继续读取可变 run/dataset 图作为正式图 |
| `GraphQueryApplicationService` | 验证查询上下文、发布/投影门禁、ACL、审计 | 绕过 Adapter 直接读文件或厂商驱动 |

## 5. 事实、投影与发布状态

`GraphVersion`、`GraphWriteRun` 和“当前可查询指针”是不同对象：

```text
GraphVersion: json_ready -> published -> invalidated
GraphWriteRun: pending -> leased -> writing -> validating
                         -> succeeded
                         -> partial -> retry_wait -> ... -> dead_letter
                         -> failed  -> retry_wait -> ... -> dead_letter
Queryable binding: absent -> active(graphVersionId) -> replaced/invalidated
```

- `GraphVersion` 提交成功不代表外部投影成功。
- `partial` 表示至少一个批次或对象未得到可验证成功，绝不能查询。
- `succeeded` 只有在节点数、边数、端点、版本指纹和抽样证据校验全部通过后产生。
- `invalidate` 是显式状态事件；不得删除历史图来模拟失效。
- current binding 只能通过带期望旧值的 CAS 更新，不能按目录时间自动推断。

## 6. 信任与安全边界

1. 身份验证在应用层完成，Adapter 只接收已验证的 `ACLContext`，但仍必须将授权过滤下推并返回所用范围摘要。
2. `ACLContext` 至少包含可信主体、租户/安全域、允许与拒绝范围、认证来源和决策关联 ID；缺失或解析失败一律拒绝。
3. dataset、graph version、节点、边和 evidence 的 ACL 取交集，deny 优先；不得先取回越权数据再在响应层过滤。
4. 日志只记录稳定 ID、计数、错误码、耗时和脱敏摘要，不记录凭据、原文、完整证据或厂商错误正文。
5. 任一版本、dataset、发布状态或投影状态不匹配返回明确错误，不回退到 local、旧版本或 keyword 图。
6. 外部 Adapter 连接参数、凭据、网络、备份和容量由后续审批决定，本设计不定义默认值。

## 7. 性能与资源边界

- 写入以配置化 batch 为单位，worker 内存上限与 batch 大小相关，不得同时载入全图；canonical 事实读取应支持流式/分页演进。
- 节点完成并验证后才写关系；关系批次不得包含未知或跨版本端点。
- 查询只允许 1 至 2 跳、明确 `maxNodes/maxEdges/timeout`，所有上限由版本化配置提供。
- 并发控制单位为 `(storeId, graphVersionId)`；同一版本仅一个有效 lease，不同版本可并行。
- Adapter 需要暴露耗时、批次计数、重试、限流、连接池和校验差异指标，但不能把供应商标签扩散到业务契约。
- S/M/L 数据规模、P95、并发和容量预算尚未由外部基础设施确认，不能写成硬编码验收值。

## 8. 迁移路线与兼容边界

1. 先补齐 M2 的 ACL、生产回放、发布和性能门禁。
2. 增加 canonical schema/validator，现有不可变 `graph-versions/{graphVersionId}` 保持事实源。
3. 实现 `LocalGraphStore`，将版本查询服务迁到强制上下文；现有公共 API 暂由应用层组装上下文。
4. 将可变 dataset/run 图接口标记为 legacy 诊断路径，禁止供 GraphRAG 使用。
5. 增加 outbox 和 worker，以 `LocalGraphStore` 验证幂等、恢复和失效。
6. 经 G1/G4 审批后增加一个外部 Adapter，用隔离 dataset 回填不可变版本。
7. 一致性与安全验收通过后，CAS 切换同一 `graphVersionId` 的查询 binding；保留 Local 实现作审计/恢复，不作静默运行时降级。

legacy 图缺少 `graphVersionId/sourceSnapshotId/aclScope/evidenceRefs` 时只能只读诊断并显示 `legacy_unverified`。不得按当前 dataset、文件路径或时间推断并补齐为 formal/published；需要重新加工或显式隔离迁移。

## 9. 异常和用户可恢复结果

| 类别 | 稳定错误码 | 行为 |
|---|---|---|
| 上下文缺失/不匹配 | `GRAPH_QUERY_CONTEXT_INVALID` | 拒绝查询，提示重新选择数据集和版本 |
| 无权限 | `GRAPH_ACCESS_DENIED` | 不泄露对象是否存在，写脱敏审计 |
| 版本不存在/损坏 | `GRAPH_VERSION_NOT_FOUND` / `GRAPH_VERSION_CORRUPTED` | 不回退，提供重新回放动作 |
| 未发布/投影未完成 | `GRAPH_VERSION_NOT_QUERYABLE` | 返回当前阶段和可重试状态 |
| 存储不可用/超时 | `GRAPH_STORE_UNAVAILABLE` / `GRAPH_STORE_TIMEOUT` | 不换版本，保留事实和 outbox |
| 批次部分失败 | `GRAPH_WRITE_PARTIAL` | 逐项 issue、重试或死信，不提升状态 |
| 冲突 | `GRAPH_WRITE_CONFLICT` | 依幂等键复核；内容不同则隔离 |

## 10. 完成定义与后续审批

本设计完成只表示接口和边界可进入实现评审。生产完成仍需：真实 API 的 ACL 与越权测试、生产快照回放、outbox 掉电恢复、隔离图数据库回填、S/M/L 性能和 G1/G4 审批。厂商、部署地址、凭据、容量、备份和生产写权限不得推测。
