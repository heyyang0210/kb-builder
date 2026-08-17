# REQ-KGO-34：图数据库知识库存储与 GraphRAG 扩展

```yaml
documentType: requirement
moduleId: knowledge-graph-governance
requirementType: original-gap-requirement
owner: Product Manager
status: approved-g0-constrained
version: 1.0.0
createdAt: 2026-08-17
relatedRequirements: [REQ-KGO-33, REQ-KGO-29, REQ-KGO-30, REQ-KGO-31, REQ-KGO-32]
relatedDesigns:
  - docs/00-概要设计.md
  - docs/15-PingCode图谱与数据集生成步骤详细设计.md
  - docs/19-YashanDB资料加工平台工程化任务拆分.md
  - docs/09-pingcode-processing-unfinished-items.md
relatedTasks: [TASK-P2-05, TASK-P2-06, TASK-P2-07, TASK-P2-08]
```

## 1. 背景

当前图谱以 JSON/JSONL 文件作为审计和查询产物，`TASK-P2-05` 仅定义了 Neo4j/NebulaGraph 的适配预留。成熟 RAG/GraphRAG 场景还需要图数据库提供稳定的实体关系存储、邻域查询、路径查询、版本隔离和增量更新能力。

图数据库不能替代原始资料、JSON 审计产物、向量索引或质量报告。它是正式知识图谱的消费存储层，必须在本地候选数据集和 JSON 审计产物成功后再异步写入；写入失败不得导致候选数据集丢失，也不得把未完成写入标记为正式发布。

## 2. 目标与非目标

### 2.1 目标

- 定义厂商无关的 Graph Store Adapter，支持 Neo4j、NebulaGraph 或经批准的兼容实现。
- 以 `graphVersionId`、`datasetId` 和 `sourceSnapshotId` 隔离版本，保证历史图不可变。
- 将节点、关系、证据、有效期、权限范围和 Schema 版本写入图数据库。
- 支持幂等 upsert、批量写入、失败重试、死信记录、回填、校验和回滚/失效。
- 提供有界邻域、关系路径、实体查询和证据反查 API，统一复用现有 ACL 和证据契约。
- 为后续 GraphRAG 提供图检索候选，不直接让图数据库生成答案。

### 2.2 非目标

- 本需求不默认决定 Neo4j 还是 NebulaGraph；选型必须经过 ADR 和人类审批。
- 不删除 JSON/JSONL 审计产物，不把图数据库作为唯一事实源。
- 不在本阶段实现无限深度路径、自动实体合并或跨租户联邦查询。
- 不把图数据库写入失败降级为“无知识”，必须记录结构化质量问题和存储状态。

## 3. 图数据库数据契约

### 3.1 节点

所有节点必须包含：

`nodeId`、`nodeType`、`canonicalName`、`schemaVersion`、`graphVersionId`、`datasetId`、`sourceSnapshotId`、`admissionStatus`、`validFrom`、`validTo`、`aclScope`、`evidenceRefs`、`createdAt`。

节点 ID 必须由稳定业务字段生成，禁止使用数据库内部自增 ID 作为外部引用。技术 ID、文件路径和敏感原文不能作为公开展示名称。

### 3.2 关系

所有关系必须包含：

`edgeId`、`edgeType`、`fromNodeId`、`toNodeId`、`direction`、`graphVersionId`、`evidenceRefs`、`confidence`、`validFrom`、`validTo`、`aclScope`、`schemaVersion`。

任何悬空端点、无证据关系、跨版本关系或 ACL 范围冲突都不得写入正式图数据库。

### 3.3 写入状态

```text
json_ready
  -> graph_write_pending
  -> graph_write_succeeded
  -> graph_write_partial
  -> graph_write_failed
  -> graph_invalidated
```

只有 `graph_write_succeeded` 且通过质量门禁的版本才允许成为 GraphRAG 查询版本。`graph_write_partial` 和 `graph_write_failed` 只能用于诊断和重试。

## 4. 写入和一致性方案

推荐采用“本地事实先提交、图数据库异步投影”的两阶段流程：

1. 图谱构建生成并校验 JSON/JSONL、Manifest 和 `graphVersionId`。
2. 写入任务读取不可变快照，按节点/关系批量 upsert。
3. 每个批次记录 `writeRunId`、批次范围、成功数、失败数、重试次数和数据库响应摘要。
4. 失败项写入 `graph-write-issues.jsonl` 或等价质量问题，不回滚本地 JSON 审计产物。
5. 全量校验节点数、关系数、端点完整性、版本指纹和抽样证据后，才提交 `graph_write_succeeded`。
6. 文档修改或删除创建新的 `graphVersionId`；旧版本只读，删除通过新版本的失效标记传播。

图数据库写入必须支持幂等键：`graphVersionId + nodeId` 和 `graphVersionId + edgeId`。重试不得重复创建节点或关系，也不得覆盖其他版本。

## 5. 查询契约

首期只提供有界查询：

- 按 canonical ID 查询实体和证据；
- 一至二跳邻域查询；
- 按关系类型、产品版本、有效期、datasetId 和 ACL 过滤；
- 返回 `graphVersionId`、节点/边 ID 和证据引用；
- 图数据库不可用时返回明确的 `GRAPH_STORE_UNAVAILABLE`，不静默回退到不同版本。

GraphRAG 查询必须先获得图候选，再与 sparse/dense 检索结果合并；图数据库不能绕过权限、证据和发布门禁。

## 6. 任务拆分

| 任务 | 内容 | 优先级 | 依赖 | 出口 |
|---|---|---|---|---|
| TASK-P2-05 | Graph Store Adapter、节点/边映射、厂商 ADR | P1 | TASK-P2-04、REQ-KGO-33 G1 | 设计评审通过，未引入依赖 |
| TASK-P2-06 | 图数据库连接、批量 upsert、幂等、写入状态和失败记录 | P1 | TASK-P2-05、REQ-KGO-33 G2 | 隔离数据集写入和重试通过 |
| TASK-P2-07 | JSON 审计图谱到图数据库的版本化回填、校验和失效传播 | P1 | TASK-P2-06、P2-03/P2-04 | 回填、重建、删除和回滚通过 |
| TASK-P2-08 | 有界图查询和 GraphRAG 检索适配器 | P2 | TASK-P2-07、REQ-KGO-33 P0 检索闭环 | ACL、版本过滤、证据反查和降级通过 |
| TASK-P2-09 | 图数据库 S/M/L 性能、故障和容量验证 | P1 | TASK-P2-06 | P95、并发、重启、限流和恢复报告 |

`docs/09` 中的统一 Model Provider、Embedding/向量库、真实权限、独立 Worker、人工质量门禁和全流程真实模型验收作为关联前置任务；它们未完成时不得宣称 GraphRAG 生产可用。

## 7. 验收标准

- JSON/JSONL 审计产物在图数据库不可用时仍完整生成。
- 同一 `graphVersionId` 重试写入不产生重复节点和关系。
- 图数据库写入部分失败有逐条问题、状态和重试入口，不被统计为无知识。
- 节点、关系和证据均可按稳定 ID 回查到 source/chunk/evidence。
- 查询强制带 `graphVersionId`、datasetId 和 ACL 过滤；禁止跨版本或越权读取。
- 旧版本不可变，新版本删除/失效传播可审计并可回滚。
- 图数据库重启、连接超时、限流和不可用场景均有真实 API 验收记录。
- GraphRAG 只消费通过质量门禁的图版本，不直接消费 `keyword_analysis` 回退图谱。

## 8. 已确认决策与剩余审批

1. 采用厂商无关 `GraphStore`；Neo4j 为候选、NebulaGraph 为备选，最终选型留待 G1。
2. JSON/JSONL 是不可变事实源，图数据库采用异步投影，不是正式发布的同步强依赖。
3. 默认严格数据集隔离，ACL 默认拒绝并继承数据集权限。
4. GraphRAG 查询必须在 P0 检索、证据和发布门禁闭环之后作为独立阶段实施。
5. 部署模式、持久化、备份、监控、容量预算和专用向量库接入仍需 G1/G4 审批。
