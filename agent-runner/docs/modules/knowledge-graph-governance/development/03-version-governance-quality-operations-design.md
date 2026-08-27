---
requirement: REQ-KGO-31
moduleId: knowledge-graph-governance
designVersion: 1.1.0
status: confirmed
createdAt: 2026-08-17
updatedAt: 2026-08-17
backendImplementationStatus: completed
dependsOn: REQ-KGO-30
executionOrder: REQ-29 -> REQ-30 -> REQ-31
---

# 知识图谱版本治理与质量运营设计

> 版本：v1.1
> 日期：2026-08-17
> 状态：设计已确认，依赖 REQ-30
> 实施顺序：REQ-29 → REQ-30 → REQ-31

## 一、背景

REQ-29 和 REQ-30 建立运行级质量观察与诊断闭环，但运行级过滤快照不等于正式知识资产版本。企业知识库需要回答：当前正式图谱来自哪个数据集和任务、相比上一版发生了什么变化、质量是否改善、发布时有哪些风险以及历史版本是否可审计。

本需求在不引入新依赖的前提下，将正式发布的图谱沉淀为不可变版本，并把质量指标快照、差异和告警展示在全局知识图谱页。

## 二、已确认决策

| 决策 | 结论 |
|---|---|
| 页面定位 | 全局 `KnowledgeGraphPage.vue` 负责发布级运营，质量分析页继续负责运行级诊断 |
| 版本创建 | 仅正式知识数据集成功发布时创建不可变图谱版本 |
| 非正式发布 | `graphSource != final_knowledge` 时不创建图谱版本 |
| 接口策略 | 新增版本和运营接口，保持现有图谱与发布接口兼容 |
| 依赖 | 暂不引入图数据库、时序数据库或新包 |
| 发布检查 | 第一阶段只告警，不阻断发布；强制门禁需后续单独审批 |

过滤运行创建、SSE 完成、人工自动保存、apply 和正式知识构建任务创建均不产生 `graphVersionId`。

## 三、目标与非目标

### 3.1 目标

1. 每次正式知识数据集发布成功后生成一个不可变、可校验、可追溯的图谱版本。
2. 保存节点、关系、摘要、质量指标、规则版本和来源 lineage，支持历史查看和版本差异。
3. 在全局图谱页展示当前版本、历史趋势、版本变化和发布检查结果。
4. 质量规则全部配置化并记录规则版本，避免历史指标因规则变化失去解释。
5. 发布检查首期只生成 warning，不改变现有发布成功语义。

### 3.2 非目标

- 不提供版本删除、在线回滚或自动恢复；
- 不把过滤运行 revision 当作正式图谱版本；
- 不自动修改图谱或调用模型修复异常；
- 不建立跨数据集的图谱合并版本；
- 不启用阻断式质量门禁；
- 不新增外部存储和消息服务。

## 四、版本模型

### 4.1 GraphVersion

```json
{
  "graphVersionId": "graph_version_xxx",
  "datasetId": "dataset_xxx",
  "batchId": "batch_xxx",
  "sourceTrainingTaskId": "training_xxx",
  "sourceFilterRunId": "filter_run_xxx",
  "graphSource": "final_knowledge",
  "schemaVersion": "graph-version-v1",
  "rulesVersion": "graph-observability-v1",
  "createdAt": "2026-08-17T10:00:00+08:00",
  "createdBy": "system",
  "sourceFingerprint": "sha256:...",
  "artifacts": {
    "nodes": {"path": "nodes.json", "sha256": "...", "count": 340},
    "edges": {"path": "edges.json", "sha256": "...", "count": 920},
    "summary": {"path": "summary.json", "sha256": "..."},
    "checks": {"path": "checks.json", "sha256": "..."}
  },
  "health": {},
  "rulesSnapshot": {},
  "publishChecks": {"status": "warning", "warningCount": 2, "errorCount": 0}
}
```

### 4.2 存储边界

建议目录：

```text
runtime/web/graph-versions/{graphVersionId}/
├── manifest.json
├── nodes.json
├── edges.json
├── summary.json
└── checks.json
```

- 使用 staging 目录写入全部文件、计算哈希、校验后再原子发布；
- 发布后的目录只读，任何修正必须生成新版本；
- 版本只复制图谱节点、边、摘要和受控证据引用，不复制完整文档正文；
- 状态索引只保存版本 ID 和 manifest 摘要，事实以不可变目录为准；
- 保留周期和清理策略不在本需求内自动启用，后续需人类确认。

## 五、发布检查

### 5.1 首期规则

| 检查 | 结果 |
|---|---|
| 节点 ID 唯一 | error/warning 记录，首期不阻断 |
| 关系两端节点存在 | error/warning 记录，首期不阻断 |
| 图谱产物哈希可读 | error/warning 记录，无法形成快照时发布维持原语义但返回版本创建失败告警 |
| 关键词过滤统计一致 | warning |
| 证据完整率低于阈值 | warning |
| 孤立知识比例高于阈值 | warning |
| Why 知识缺失率高于阈值 | warning |
| 与上一版本节点或关系变化异常 | warning |

阈值读取 `scripts/pingcode/config/graph-observability-rules.json`，版本 manifest 保存实际规则版本和阈值快照。

### 5.2 发布语义

```text
正式数据集发布成功
  -> 图谱来源是否 final_knowledge
     -> 否：返回原发布结果，不创建版本
     -> 是：创建不可变版本
        -> 检查通过：返回 graphVersion.status=passed
        -> 有问题：返回 graphVersion.status=warning，发布仍成功
        -> 版本快照失败：发布仍保持既有结果，记录结构化告警和审计事件
```

版本快照失败是否在未来阻断发布属于新的破坏性决策，不在本需求中提前启用。

## 六、接口设计

### 6.1 发布响应增量字段

现有发布接口保持路径和原字段不变，成功响应可增加：

```json
{
  "graphVersion": {
    "created": true,
    "graphVersionId": "graph_version_xxx",
    "status": "warning",
    "warningCount": 2
  }
}
```

非正式知识图谱返回 `graphVersion.created=false` 和 `reason=not_final_knowledge`。旧客户端忽略新增字段即可继续工作。

### 6.2 版本列表与详情

```http
GET /api/graph/versions?datasetId={id}&page=1&pageSize=20
GET /api/graph/versions/{graphVersionId}
```

列表响应返回总数、分页、当前正式版本标记、来源、节点/关系数量、健康摘要和 warning 数量。详情返回 manifest，不默认返回全部节点和边。

### 6.3 版本局部探索

```http
GET /api/graph/versions/{graphVersionId}/explore?focusNodeId={id}&depth=1
```

复用 REQ-30 的有界探索和稳定排序逻辑，但事实源固定为版本目录。

### 6.4 版本差异

```http
GET /api/graph/versions/{leftVersionId}/diff/{rightVersionId}
  ?changeType=all
  &query=
  &page=1
  &pageSize=50
```

差异包括：

- 新增、删除、属性变化节点；
- 新增、删除、属性变化关系；
- 健康指标变化；
- 规则版本变化；
- 来源 lineage 变化。

节点和关系按稳定 ID 对比；显示名相同但 ID 不同不能合并为同一对象。

### 6.5 趋势与检查

```http
GET /api/graph/versions/trends?datasetId={id}&limit=20
GET /api/graph/versions/{graphVersionId}/checks
```

趋势只读取版本 manifest 中的指标快照，不重新按当前规则计算历史值。若规则版本变化，响应返回分段标记，前端不得画成无说明的连续同口径趋势。

## 七、服务边界

| 服务 | 职责 |
|---|---|
| `GraphVersionRepository` | 原子创建、读取和列出不可变版本 |
| `GraphQualityCheckService` | 按配置生成检查项和健康指标快照 |
| `GraphVersionDiffService` | 按稳定 ID 计算有界差异和指标变化 |
| `GraphVersionService` | 在既有发布成功后编排版本创建、审计和版本只读查询 |
| `PreprocessService` | 保持既有发布状态变更语义，不包含版本存储细节 |

## 八、后端伪代码

```text
function publish_dataset(dataset_id, force):
    published = existing_publish(dataset_id, force)
    if published.graph_source != final_knowledge:
        return published + graph_version_not_created

    try:
        version = create_graph_version(published)
        return published + version_summary(version)
    catch version_error:
        append_audit_warning(dataset_id, version_error)
        return published + graph_version_warning
```

```text
function create_graph_version(dataset):
    source = read_committed_graph_artifacts(dataset)
    rules = load_graph_observability_rules()
    checks = quality_check(source, rules)
    health = calculate_observability_snapshot(source, rules)

    staging = repository.reserve()
    write nodes, edges, summary, checks into staging
    hashes = hash_every_artifact(staging)
    manifest = build_manifest(dataset.lineage, rules.snapshot, hashes, health, checks)
    verify_counts_hashes_and_references(staging, manifest)
    return repository.atomic_commit(staging)
```

```text
function diff_versions(left_id, right_id):
    left = repository.read_verified(left_id)
    right = repository.read_verified(right_id)
    node_changes = compare_by_stable_id(left.nodes, right.nodes)
    edge_changes = compare_by_stable_id(left.edges, right.edges)
    metric_changes = compare_snapshots(left.health, right.health)
    return paginate(node_changes, edge_changes) + metric_changes + rules_change
```

## 九、全局图谱页设计

```text
当前正式版本
├── 版本 ID、发布时间、来源任务和规则版本
├── 节点、关系、健康状态和 warning 数量
└── 局部图谱入口

质量趋势
├── 关系覆盖率
├── 证据完整率
├── 孤立知识比例
└── 规则版本分段

版本历史
├── 版本列表和检查状态
├── 选择两个版本比较
└── 查看新增、删除和变化明细

发布检查
└── warning 列表、证据和建议，不提供自动修复按钮
```

质量分析页可显示当前运行对应的最近正式版本链接，但不得在运行级页面创建、删除或回滚版本。

## 十、性能与安全

- 版本列表和趋势 P95 小于 500ms；
- 千级节点和关系的版本差异 P95 小于 1 秒；更大规模必须分页且返回截断说明；
- 版本创建在现有发布成功之后执行并可观测，不静默吞错；
- manifest 和 API 不保存完整文档正文、密钥、提示词和上游错误正文；
- 版本读取必须校验 manifest 与文件哈希，损坏版本返回结构化错误且不影响其他版本；
- 所有阈值、上限和规则版本配置化；
- 不引入新依赖。

## 十一、SMART 验收标准

1. REQ-30 验收后 3 个工作日内完成 REQ-31 后端、前端和真实 API 验收，或记录可复现阻塞。
2. 过滤运行创建、复核、apply 和构建任务创建均不产生版本；只有 `final_knowledge` 数据集发布成功产生一个新 `graphVersionId`。
3. 同一发布请求的并发或重试通过幂等键避免重复版本；每个版本目录发布后不可修改。
4. manifest 中节点数、关系数、哈希、lineage、规则版本、健康指标和检查项与版本文件一致。
5. warning 检查不阻断发布，前端中文显示检查结果和来源；不得显示“已通过”掩盖 warning。
6. 任意相邻版本可按稳定 ID 得出新增、删除、变化明细，汇总数量等于明细总数。
7. 趋势读取历史快照；规则版本变化时显式分段，不使用当前规则覆盖历史结果。
8. 版本列表/趋势 P95 小于 500ms，千级图谱 diff P95 小于 1 秒。
9. 使用隔离正式知识数据集真实调用发布、版本列表、详情、diff、trends 和 checks；业务批次保持只读。
10. 后端原子性、幂等、损坏隔离和接口兼容测试，前端中文桌面/移动验收、生产构建和目标 `git diff --check` 全部通过。

## 十二、风险与后续决策

| 风险 | 缓解 |
|---|---|
| 图谱版本复制增加磁盘占用 | 首期记录版本大小；保留周期和内容寻址复用另行评审 |
| 发布成功但版本创建失败造成理解差异 | 响应、日志和页面显式 warning；不改变已确认的发布语义 |
| 规则变化导致趋势不可比 | manifest 保存规则和阈值快照，前端按规则版本分段 |
| 同名节点误合并 | 差异和证据只使用稳定 ID |
| 版本源证据被清理 | 版本保存受控引用和可用性，不复制全文；显示 stale |

后续如需启用阻断式发布门禁、版本删除、保留策略、在线回滚、图数据库或新图谱引擎，均属于新的架构或破坏性决策，必须再次获得人类确认。

## 十三、后端实施记录

### 13.1 实际文件与接线

| 文件 | 实现内容 |
|---|---|
| `app/repositories/graph_version_repository.py` | 确定性版本 ID、文件锁、staging、原子目录提交、SHA-256/计数/端点校验、损坏隔离 |
| `app/graph_quality_check_service.py` | 读取集中规则配置，生成健康快照和非阻断发布检查 |
| `app/graph_version_service.py` | `final_knowledge` 发布后版本编排、lineage、模型指纹、证据裁剪、审计、列表/详情/探索/趋势 |
| `app/graph_version_diff_service.py` | 按稳定 ID 计算节点、关系、健康、规则和 lineage 差异 |
| `app/main.py` | 发布响应增量字段和版本只读 API |
| `config/graph-observability-rules.json` | Schema、分页、趋势、探索和变化幅度上限 |

版本事实源固定为已发布数据集目录的 `graph/nodes.json` 与 `graph/edges.json`。版本复制时移除完整正文、Prompt 和上下文全文，证据摘录最多保留 500 个字符。相同 `datasetId + sourceFingerprint + schemaVersion + rulesVersion` 生成相同幂等键和版本 ID。

### 13.2 接口错误语义

| 错误码 | HTTP | 含义 |
|---|---:|---|
| `GRAPH_VERSION_NOT_FOUND` | 404 | 版本目录不存在 |
| `GRAPH_VERSION_CORRUPTED` | 409 | manifest、哈希、计数、端点或来源指纹校验失败 |
| `GRAPH_VERSION_NODE_NOT_FOUND` | 404 | 探索焦点不属于该版本 |
| `GRAPH_VERSION_QUERY_INVALID` | 422 | changeType、depth、pageSize 或 limit 不符合版本规则 |

快照失败不抛给既有发布接口，发布响应保持 `state=published`，同时返回 `graphVersion.created=false`、`reason=snapshot_failed` 和 `status=warning`，并写入 `graph-version-audit.jsonl` 与结构化日志。

### 13.3 隔离验收证据

- `tests/test_graph_version_routes.py` 通过 FastAPI HTTP 覆盖正式/非正式发布、重复与并发幂等、过滤运行/复核/apply 不生成版本、全部只读 API、规则分段趋势、稳定 ID diff、损坏隔离和快照失败告警。
- 与 REQ-29、REQ-30、关键词过滤运行和复核组合回归共 25 项通过。
- 1000 个知识节点、1000 个文档块和 1000 条关系的隔离基线：版本列表 P95 `4.03ms`，趋势 P95 `4.06ms`，diff P95 `194.39ms`。
- 全部测试只使用临时数据根目录，未写入 `batch_dc23fc9141ba4d6f` 或其他业务批次。
