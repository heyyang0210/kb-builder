# 图数据库与向量存储选型 ADR

```yaml
documentType: architecture-decision-record
moduleId: knowledge-graph-governance
status: accepted-with-constraints
decisionGate: G1
relatedRequirements: [REQ-KGO-33, REQ-KGO-34]
relatedTasks: [RG-04, RG-61, TASK-P2-05]
createdAt: 2026-08-17
```

## 1. 决策背景

当前平台以 JSON/JSONL 作为知识图谱和数据集审计产物，Embedding 采用本地确定性缓存，尚未把图数据库或向量数据库接入生产主链路。REQ-KGO-34 要求为正式知识图谱提供消费存储，但不允许图数据库替代原始资料和 JSON 审计事实源。

本 ADR 只完成选型和边界设计，不安装依赖、不修改公共 API、不连接外部数据库。

## 2. 约束

- 大批次数据默认只读，写入型验证必须使用隔离数据集。
- 图数据库写入失败不能破坏本地候选数据集和 JSON 审计产物。
- 节点、边、证据和索引必须带 `graphVersionId`、`datasetId`、lineage 和 ACL 范围。
- 现有后端是 FastAPI + JsonStore + 本地运行目录；需要逐步演进，不能一次性替换主链路。
- 新增图数据库、向量库、驱动或部署服务必须经过人类架构和安全审批。

## 3. 方案比较

| 方案 | 优点 | 缺点/风险 | 当前结论 |
|---|---|---|---|
| JSON/内存图 + 本地向量缓存 | 零外部依赖、易回放、适合当前隔离测试 | 多跳查询、并发、增量和容量有限 | 当前默认事实源和开发基线 |
| Neo4j + Chroma/Milvus 适配器 | Cypher 生态成熟，实体关系和路径查询清晰；向量能力可分阶段接入 | 部署、备份、权限、驱动和运维成本较高；需处理双写一致性 | 首选候选，需 G1/G4 审批 |
| NebulaGraph + Milvus | 分布式图和向量扩展空间大，适合更大规模 | 部署复杂，Schema/查询运维门槛高，当前团队验证成本较高 | 规模确认后再评估 |
| 直接将图数据库作为唯一事实源 | 查询简单，减少本地文件 | 破坏可回放和离线重建；数据库故障会阻断加工 | 不采用 |

## 4. 暂定决策

1. 当前阶段继续使用 JSON/JSONL 作为不可变审计事实源。
2. 先定义厂商无关的 `GraphStore` 和 `VectorStore` 接口，业务层不依赖 Neo4j、NebulaGraph、Chroma 或 Milvus 类型。
3. 图数据库采用异步投影：本地事实提交成功后创建 `writeRunId`，再执行批量 upsert。
4. 首选候选为 Neo4j，但只有在人类确认部署、权限、备份和容量预算后才允许实现驱动适配器。
5. 向量存储与图存储分离；图候选和 sparse/dense 检索在统一检索层合并，不能由图数据库直接生成答案。
6. 未批准外部依赖时，Adapter 保持 `disabled`，仍可运行 JSON/内存实现完成契约和故障测试。

## 5. 适配器最小接口

```text
interface GraphStore:
  health() -> StoreHealth
  begin_write(run: GraphWriteRun) -> None
  upsert_nodes(version_id, nodes) -> WriteBatchResult
  upsert_edges(version_id, edges) -> WriteBatchResult
  validate(version_id) -> GraphIntegrityReport
  query_neighborhood(version_id, node_id, depth, filters) -> GraphProjection
  invalidate(version_id, reason) -> None
  rollback(pointer, target_version_id) -> None

interface VectorStore:
  health() -> StoreHealth
  upsert_embeddings(index_version, items) -> WriteBatchResult
  search(index_version, query_vector, filters, top_k) -> RetrievalCandidates
  delete(index_version, item_ids) -> None
```

所有实现必须返回稳定 ID、版本、成功/失败明细和可审计错误分类，不得把底层异常直接暴露给用户。

## 6. 进入实现的前置条件

- G0：确认正式图谱最低形态、模型策略、ACL/跨数据集边界和发布门禁。
- G1：确认 GraphStore/VectorStore 接口、厂商候选、部署和退出条件。
- G2：完成 Schema、lineage、幂等键、失败隔离和真实 API 测试设计。
- G4：隔离环境通过写入、回填、重启、限流、性能和回滚验收。

## 7. 已确认边界与未决实施项

已确认：采用厂商无关 `GraphStore`，Neo4j 为候选、NebulaGraph 为备选；JSON/JSONL 保持事实源，图数据库异步投影；默认严格数据集隔离并继承 ACL；GraphRAG 在 P0 检索和发布门禁之后实施。

- Neo4j 与 NebulaGraph 的最终选择；
- 最终图数据库厂商及其驱动适配；
- S/M/L 节点数、边数、并发、P95、存储和备份预算；
- 是否接入 ChromaDB、Milvus 或继续使用现有本地向量实现；
- 多租户 ACL 和跨数据集查询边界。
