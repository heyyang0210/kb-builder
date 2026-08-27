# 知识图谱质量概览与局部可视化设计

> 需求：REQ-KGO-29
>
> 所属模块：knowledge-graph-governance
>
> 设计版本：1.0.0
>
> 状态：设计待评审
>
> 创建日期：2026-08-17
>
> 目标时限：设计确认后 2 个工作日内完成开发与真实 API 验收
>
> 约束：只读增量改造；不引入新依赖；保留既有公共 API

## 1. 设计目标

REQ-KGO-29 将现有“默认铺开较大图谱”的展示方式改为“范围与质量优先、焦点局部图按需加载”。实现后，用户先确认当前观察对象和质量状态，再选择关键词查看有界邻域。

本阶段建立三个可复用基础：

1. 使用统一观察上下文约束页面各区域的数据范围。
2. 使用只读概览契约区分事实规模、投影规模和渲染规模。
3. 将图谱组件收敛为受控局部图渲染器，不再承担业务投影和质量计算。

## 2. 元数据与可追溯性

所有概览和局部图响应必须携带或可关联以下上下文。字段缺失时显式返回 `null` 或可用性状态，不允许前端从其他批次或内存快照猜测。

```json
{
  "datasetId": "dataset_xxx",
  "filterRunId": "filter_run_xxx",
  "graphVersionId": null,
  "view": "after",
  "filters": {},
  "focusNodeId": "keyword_xxx",
  "depth": 1
}
```

| 字段 | REQ-KGO-29 语义 | 后续演进 |
|---|---|---|
| `datasetId` | 必填，所有查询的事实边界 | 保持不变 |
| `filterRunId` | 可选，用于说明当前过滤运行；不改变现有图谱事实 | REQ-KGO-30 绑定稳定运行快照 |
| `graphVersionId` | 本阶段固定为 `null` | REQ-KGO-31 绑定不可变发布版本 |
| `view` | `after` 可用；`before/changed` 可返回待支持状态 | REQ-KGO-30 完整实现 |
| `filters` | 本阶段仅接受可验证的节点类型或质量状态筛选；默认为空 | REQ-KGO-30 扩展全局筛选 |
| `focusNodeId` | 局部图必填，概览可为空 | 保持不变 |
| `depth` | 接受 1 或 2；首期可对 2 返回明确的能力不可用状态 | REQ-KGO-30 补全两跳查询 |

可追溯元数据还应包含 `graphSource`、`graphSchemaVersion`、`sourceFingerprint`、`rulesVersion` 和 `updatedAt`。若当前产物没有可靠更新时间或指纹，应返回 `availability=unknown`，不得使用页面加载时间冒充产物更新时间。

## 3. 现状依据

### 3.1 后端现状

- `GET /api/datasets/{datasetId}/graph/summary` 调用 `TrainingService.graph(datasetId, "summary")`，读取图谱产物后按当前 `admissionStatus` 投影，并返回 `nodeCount`、`edgeCount`、节点/关系类型、过滤统计及健康比例。
- `summary` 已提供 `relationCoverage`、`isolatedKnowledgeRatio`、`whyMissingRate`、`evidenceCompleteness` 和 `crossDocumentRelationCount`，但比例指标没有分子、分母和可用性，空集合当前表现为 `0`，前端无法区分“不适用”和“真实为 0”。
- `GET /api/datasets/{datasetId}/graph/neighborhood` 仅返回焦点节点的 `CONTEXT_MATCHES_CHUNK` 一跳关系；`limit` 限制关系数，范围为 1 至 200，响应已有 `totalEdges`、`limit`、`truncated` 和 `displayMode`。
- `TrainingService.ensure_dataset_graph()` 可能在读取时触发旧图谱回填。新增概览路径必须避免修复、模型调用或其他隐式写入；若无可用产物，应明确返回不可用状态。

### 3.2 前端现状

- `QualityPage.vue` 并行读取 `summary`、最多 1000 个节点和最多 1000 条关系，在前端内存中计算过滤前、过滤后和变化视图；接口 `total` 和当前 `items` 数量未呈现在图谱区域。
- `KnowledgeGraph.vue` 对传入节点直接初始化 ECharts 力导向布局；节点尺寸采用 `30 + occurrences * 5`，没有上限，关键词和上下文标签默认大量显示。
- 组件内同时维护节点类型颜色、中文标签、节点尺寸和图表交互，业务状态与渲染职责尚未分离。
- 当前技术栈已经包含 Vue 和 ECharts，本设计不新增图谱引擎或 npm 包。

## 4. 总体架构

```text
QualityPage（统一观察上下文与请求编排）
  ├── GraphObservabilitySummary（范围、规模、健康与告警）
  ├── GraphToolbar（焦点、深度、标签密度、画布命令）
  └── KnowledgeGraph（只渲染受控子图并上报交互事件）
         ↑
GET graph/observability + GET graph/neighborhood
         ↑
TrainingService 只读图谱事实、当前投影和集中配置
```

### 4.1 单一事实源

- 服务端负责图谱范围、统计、健康指标、截断和可用性判定。
- 页面容器负责统一上下文、请求竞态控制、加载状态和组件联动。
- 图谱组件只负责渲染，不读取 API，不计算过滤投影，不修改关键词决策。
- 所有展示上限、节点尺寸区间、默认深度和健康告警阈值来自版本化配置。

### 4.2 三种规模

| 规模 | 定义 | 数据来源 |
|---|---|---|
| 事实规模 `fact` | 原始图谱产物中的完整节点与关系数 | `nodes.json`、`edges.json` |
| 投影规模 `projected` | 当前 `view` 和过滤状态下可参与查询的节点与关系数 | 服务端投影函数 |
| 渲染规模 `visible` | 当前局部请求实际返回给画布的节点与关系数 | 局部图响应 |

前端显示格式统一为“当前展示 X/Y 个节点、A/B 条关系”。其中 X/A 为 `visible`，Y/B 为当前查询范围的 `total`。截断由服务端布尔值决定，不允许仅通过 `visible < total` 在多个组件中重复推断。

## 5. 接口契约

### 5.1 新增质量概览接口

```http
GET /api/datasets/{datasetId}/graph/observability
  ?filterRunId={filterRunId}
  &view=after
```

请求约束：

- `datasetId` 必填。
- `filterRunId` 可选；存在时只做归属和指纹校验，不应用或修改运行。
- `view` 允许 `before|after|changed`，本阶段 `after` 必须可用；其他视图尚未具备稳定快照时返回 HTTP 200 和 `scope.availability=pending`。
- 接口严格只读，不触发图谱回填、修复、模型调用或缓存写入。

响应示例：

```json
{
  "datasetId": "dataset_xxx",
  "filterRunId": "filter_run_xxx",
  "graphVersionId": null,
  "scope": {
    "view": "after",
    "availability": "available",
    "graphSource": "metadata_keyword",
    "graphSchemaVersion": 2,
    "projectionBasis": "current_admission_status",
    "sourceFingerprint": "sha256:...",
    "sourceAvailability": "available",
    "updatedAt": "2026-08-17T10:00:00+08:00"
  },
  "counts": {
    "fact": {"nodes": 1277, "edges": 3000},
    "projected": {"nodes": 277, "edges": 1000},
    "keywords": {"before": 643, "kept": 34, "excluded": 609}
  },
  "health": {
    "relationCoverage": {
      "value": 0.92,
      "numerator": 313,
      "denominator": 340,
      "availability": "available"
    },
    "evidenceCompleteness": {
      "value": 0.96,
      "numerator": 326,
      "denominator": 340,
      "availability": "available"
    },
    "isolatedKnowledgeRatio": {
      "value": 0.08,
      "numerator": 27,
      "denominator": 340,
      "availability": "available"
    },
    "whyMissingRate": {
      "value": 0.35,
      "numerator": 119,
      "denominator": 340,
      "availability": "available"
    },
    "crossDocumentRelationCount": {
      "value": 42,
      "numerator": 42,
      "denominator": null,
      "availability": "available"
    }
  },
  "warnings": [],
  "rulesVersion": "graph-observability-v1"
}
```

### 5.2 复用并兼容扩展局部图接口

请求保持兼容：

```http
GET /api/datasets/{datasetId}/graph/neighborhood
  ?nodeId={focusNodeId}
  &limit=80
```

现有响应字段 `focusNode`、`nodes`、`edges`、`truncated`、`limit`、`totalEdges`、`displayMode` 全部保留。新增字段采用可选增量方式：

```json
{
  "context": {
    "datasetId": "dataset_xxx",
    "filterRunId": null,
    "graphVersionId": null,
    "view": "after",
    "filters": {},
    "focusNodeId": "keyword_xxx",
    "depth": 1
  },
  "focusNode": {"id": "keyword_xxx", "type": "Keyword", "displayName": "索引"},
  "nodes": [],
  "edges": [],
  "counts": {
    "nodes": {"total": 81, "visible": 80, "truncated": true},
    "edges": {"total": 160, "visible": 158, "truncated": true}
  },
  "totalEdges": 160,
  "limit": 80,
  "truncated": true,
  "displayMode": "neighborhood",
  "rulesVersion": "graph-observability-v1"
}
```

实现必须同时执行节点和关系上限：默认不超过 80 个节点、160 条关系。旧 `limit` 的“最大关系数”语义保持不变；新上限从配置读取并对响应做二次有界处理。若仅能在首期按现有一跳接口返回，则 `depth=2` 不得静默退化为一跳。

### 5.3 错误契约

统一错误载荷沿用现有 API 错误格式，并稳定使用以下错误码：

| HTTP | 错误码 | 场景 | 前端行为 |
|---:|---|---|---|
| 404 | `DATASET_NOT_FOUND` | 数据集不存在或已删除 | 展示“数据集不存在”，清空旧图 |
| 404 | `GRAPH_NOT_AVAILABLE` | 图谱产物不存在 | 展示未生成状态，不自动修复 |
| 404 | `FILTER_RUN_NOT_FOUND` | 过滤运行不存在或不属于数据集 | 清除运行上下文并提示重新选择 |
| 404 | `GRAPH_NODE_NOT_FOUND` | 焦点节点不存在 | 保留概览，清空局部图 |
| 409 | `GRAPH_SOURCE_STALE` | 仅在无法安全返回时使用；优先 HTTP 200 + stale | 展示过期告警，禁止混合旧局部图 |
| 422 | `GRAPH_QUERY_INVALID` | `view/depth/filter` 不合法 | 指向具体参数并恢复默认值 |

指纹不一致但仍可展示概览时返回 HTTP 200，并设置 `sourceAvailability=stale` 和中文 `warnings`；不得把 stale 当作健康数据。

## 6. Schema 定义

以下为逻辑 Schema，实施时可使用当前项目已有 Pydantic/字典风格表达，不新增 Schema 依赖。

```text
GraphObservationContext:
  datasetId: string, required
  filterRunId: string | null
  graphVersionId: string | null
  view: enum(before, after, changed)
  filters: object
  focusNodeId: string | null
  depth: integer, enum(1, 2)

Availability:
  enum(available, not_applicable, pending, stale, unknown)

MetricValue:
  value: number | null
  numerator: integer | number | null
  denominator: integer | number | null
  availability: Availability

CountSlice:
  total: integer >= 0
  visible: integer >= 0
  truncated: boolean
  invariant: visible <= total

GraphObservabilityResponse:
  datasetId: string
  filterRunId: string | null
  graphVersionId: null
  scope: ScopeMetadata
  counts.fact: GraphCount
  counts.projected: GraphCount
  counts.keywords: KeywordCount
  health: map<string, MetricValue>
  warnings: string[]
  rulesVersion: string

LocalGraphResponse:
  context: GraphObservationContext
  focusNode: GraphNode
  nodes: GraphNode[]
  edges: GraphEdge[]
  counts.nodes: CountSlice
  counts.edges: CountSlice
  truncated: boolean
  rulesVersion: string
```

核心不变量：

```text
fact.nodes >= projected.nodes >= 0
fact.edges >= projected.edges >= 0
keywords.before = keywords.kept + keywords.excluded
counts.nodes.visible = length(nodes)
counts.edges.visible = length(edges)
truncated = counts.nodes.truncated OR counts.edges.truncated
MetricValue.availability != available => value may be null and UI must not judge good/bad
```

## 7. 后端设计与伪代码

### 7.1 只读概览

新增只读服务方法，直接验证数据集和现有图谱产物，不调用可能回填数据的 `ensure_dataset_graph()`。健康指标提取为共享纯计算函数，使旧 `summary` 和新概览使用同一统计口径。

```text
function getGraphObservability(datasetId, filterRunId, view):
  dataset = requireDataset(datasetId)
  graphFiles = requireExistingGraphArtifacts(dataset)
  rawNodes = readJson(graphFiles.nodes)
  rawEdges = readJson(graphFiles.edges)
  run = filterRunId ? requireRunOwnedByDataset(filterRunId, datasetId) : null

  if view != "after":
    return pendingScopeWithoutInventedSnapshot(dataset, run, view)

  projectedNodes, projectedEdges = projectCurrentAdmission(rawNodes, rawEdges)
  metricFacts = calculateGraphHealthFacts(projectedNodes, projectedEdges)
  source = resolveSourceMetadata(dataset, graphFiles)
  availability = compareFingerprint(run, source.fingerprint)

  return buildObservabilityResponse(
    context={datasetId, filterRunId, graphVersionId:null, view},
    factCounts=count(rawNodes, rawEdges),
    projectedCounts=count(projectedNodes, projectedEdges),
    keywordCounts=countKeywordAdmission(rawNodes),
    health=toMetricValues(metricFacts),
    source=source,
    availability=availability,
    rules=loadObservabilityRules()
  )
```

### 7.2 有界局部图

```text
function getBoundedNeighborhood(datasetId, focusNodeId, requestedLimit, depth=1):
  rules = loadObservabilityRules()
  nodeLimit = min(requestedLimit, rules.maxRenderNodes)
  edgeLimit = min(rules.defaultRenderEdges, rules.maxRenderEdges)
  nodes, edges = readCurrentProjectedGraph(datasetId)
  focus = requireNode(nodes, focusNodeId)

  candidates = stableAdjacentEdges(edges, focus.id, depth)
  selectedEdges = []
  selectedNodeIds = orderedSet(focus.id)

  for edge in candidates:
    nextIds = endpointsNotIn(edge, selectedNodeIds)
    if length(selectedEdges) >= edgeLimit:
      break
    if length(selectedNodeIds) + length(nextIds) > nodeLimit:
      continue
    selectedEdges.append(edge)
    selectedNodeIds.addAll(nextIds)

  selectedNodes = resolveInStableOrder(nodes, selectedNodeIds)
  return response(
    nodes=selectedNodes,
    edges=selectedEdges,
    totalNodes=countUniqueCandidateNodes(candidates, focus),
    totalEdges=length(candidates),
    nodeTruncated=totalNodes > length(selectedNodes),
    edgeTruncated=totalEdges > length(selectedEdges)
  )
```

排序必须稳定，建议按“异常优先、关系权重降序、显示名、ID”排列，以保证同一事实和规则版本重复查询得到一致结果。排序权重来自配置；若现有数据没有异常标记，则降级为权重、名称和 ID，不调用模型补齐。

### 7.3 指标计算

```text
relationCoverage = connectedKnowledgeNodes / knowledgeNodes
isolatedKnowledgeRatio = isolatedKnowledgeNodes / knowledgeNodes
evidenceCompleteness = evidenceEdgesWithResourceChunkText / evidenceEdges
whyMissingRate = (knowledgeNodes - whyKnowledgeNodes) / knowledgeNodes
crossDocumentRelationCount = count(nonEvidenceEdgesAcrossDifferentResources)

when denominator == 0:
  return {value:null, numerator:0, denominator:0, availability:"not_applicable"}
```

## 8. 配置设计

建议新增版本化配置 `scripts/pingcode/config/graph-observability-rules.json`，由后续代码任务创建。本设计不直接创建配置文件。

```json
{
  "rulesVersion": "graph-observability-v1",
  "renderLimits": {
    "defaultNodes": 80,
    "maxNodes": 80,
    "defaultEdges": 160,
    "maxEdges": 160,
    "defaultDepth": 1,
    "allowedDepths": [1, 2]
  },
  "nodeSizing": {
    "min": 18,
    "max": 52,
    "scale": "log1p"
  },
  "labels": {
    "defaultDensity": "focus",
    "allowedDensities": ["focus", "important", "all"]
  },
  "healthThresholds": {
    "relationCoverageWarningBelow": 0.8,
    "evidenceCompletenessWarningBelow": 0.9,
    "isolatedKnowledgeWarningAbove": 0.2,
    "whyMissingWarningAbove": 0.5
  }
}
```

规则：

- Vue 模板、路由和业务服务不得各自复制阈值。
- 配置加载失败时使用集中定义的保守默认值，并在概览 `warnings` 中说明；临时硬编码默认值须登记到项目待办。
- 配置版本进入 API 响应和性能测试记录，保证结果可复现。
- 超过服务端最大值的请求应被裁剪并返回实际限制，或按项目既有参数策略返回 422；行为必须有契约测试。

## 9. 前端设计

### 9.1 页面结构

```text
图谱范围条
  数据集 / 过滤运行 / 当前视图 / 来源 / 更新时间 / 可用性

质量概览
  关系覆盖率 | 证据完整率 | 孤立知识 | Why 缺失 | 跨文档关系

局部图工具栏
  搜索焦点 | 1跳/2跳 | 标签密度 | 缩放 | 适配 | 重置

局部图画布
  未选焦点：中文引导或重点问题摘要
  已选焦点：有界图 + “当前展示 X/Y” + 截断提示
```

### 9.2 状态与请求编排

`QualityPage.vue` 维护一个不可分割的上下文对象：

```text
graphContext = {
  datasetId,
  filterRunId,
  graphVersionId,
  view,
  filters,
  focusNodeId,
  depth
}
```

- 数据集、运行或视图变化时，取消或忽略旧上下文请求，立即清空旧局部图，避免跨范围闪现。
- 概览请求只依赖 `datasetId/filterRunId/view`；局部图请求额外依赖 `focusNodeId/depth/filters`。
- 使用请求序号或 `AbortController` 防止慢响应覆盖新上下文。
- REQ-KGO-29 不要求完整 URL 恢复；但上下文字段命名必须与 REQ-KGO-30 兼容。
- 初始状态 `focusNodeId=null`，不请求节点和关系全量列表，也不初始化 ECharts。

### 9.3 组件职责

| 组件 | 输入 | 输出 | 禁止事项 |
|---|---|---|---|
| `GraphObservabilitySummary.vue` | `scope/counts/health/warnings` | 指标选择事件 | 不重新计算后端指标 |
| `GraphToolbar.vue` | 焦点、深度、密度、能力状态 | 搜索、深度和画布命令 | 不直接请求 API |
| `KnowledgeGraph.vue` | `nodes/edges/focus/config` | 节点、关系和视口事件 | 不计算业务投影、不修改决策 |
| `QualityPage.vue` | 路由与数据集状态 | 组合页面 | 不维护第二套健康公式 |

### 9.4 渲染规则

- 节点尺寸使用 `min + log1p(weight) * factor`，最终夹在配置的 `min/max` 之间，避免出现超大节点。
- 节点形状或图标表达类型；主色表达 `admitted/excluded/insufficient_evidence/stale` 等质量状态。
- 默认只显示焦点、一级相邻节点和异常节点标签；悬停、选中时显示完整标签。
- 关系宽度设置上下限，不直接使用无界 `weight`。
- 图例分开说明“节点类型”和“质量状态”，不以单一颜色同时表达两者。
- 画布使用稳定高度和响应式最小尺寸；空、加载、错误及截断提示不改变工具栏尺寸。
- 图标按钮使用现有图标库并提供中文 tooltip 和可访问名称；不手绘重复图标。

### 9.5 状态矩阵

| 状态 | 画布 | 页面反馈 |
|---|---|---|
| 未选焦点 | 不初始化图表 | “请选择关键词查看局部关系” |
| 加载中 | 保留固定画布区域 | 中文加载状态，禁用重复请求控件 |
| 无邻域 | 展示焦点单节点或空态 | “该关键词暂无可见关系” |
| 截断 | 展示有限子图 | “当前仅展示 X/Y 个节点、A/B 条关系” |
| stale | 不混入上次结果 | 显示来源过期告警和刷新建议 |
| 请求失败 | 清空对应旧结果 | 显示错误码映射后的中文说明和重试命令 |

## 10. 后端实现边界

- 新增概览路由和服务方法，不改变现有 `graph/summary` 响应字段。
- 可为 `graph/neighborhood` 增加可选字段，但不能删除或重命名已有字段。
- 共享健康指标纯函数后，旧摘要与新概览必须通过相同数据集回归验证结果一致。
- 文件读取异常只返回错误，不在 GET 请求中修复图谱。
- 所有列表和集合使用稳定排序，避免同一请求重复返回不同局部子图。
- 本阶段不新增持久化表、图谱版本记录或后台任务。

## 11. 兼容与迁移

采用增量迁移：

1. 先上线后端概览和邻域兼容字段，旧前端不受影响。
2. 再上线新概览组件和按焦点加载逻辑，保留旧全量查询代码的短期回退开关。
3. 真实 API 和页面验收稳定后移除质量页的默认全量加载入口；全局图谱页面不在本需求中迁移。

兼容约束：

- `graph/summary`、`graph/nodes`、`graph/edges` 和 `graph/neighborhood` 原有客户端继续工作。
- `graph/neighborhood.limit` 既有参数范围和 `totalEdges` 语义不变。
- `before/changed` 若无稳定服务端事实，明确标为 pending，不继续依赖易失的前端内存快照生成正式结果。
- 旧图谱产物缺少指纹或更新时间时可读，但显示 `unknown`，不得阻断基本浏览。
- 回退只需关闭新 UI 入口，后端新增 GET 接口不会修改数据。

## 12. 异常、安全与性能

### 12.1 异常处理

- JSON 文件缺失、损坏或 Schema 不支持时返回稳定错误码，不吞掉异常后展示旧数据。
- 指标分母为 0 时返回 `not_applicable`，禁止显示 0% 或 100% 健康结论。
- 焦点不在当前投影时返回节点不可见说明，不从事实全集偷偷拼入当前视图。
- 请求上下文变化后到达的旧响应必须被丢弃。

### 12.2 安全

- 所有 `datasetId/filterRunId/focusNodeId` 使用仓库现有 ID 查找方式，不拼接未校验文件路径。
- 错误和 tooltip 不展示服务器绝对路径、凭据或完整敏感原文。
- GET 接口无副作用，不写缓存、状态、运行记录或图谱事实。

### 12.3 性能

- 643 个关键词、千级关系基线下，概览接口 P95 不超过 500ms，局部图接口 P95 不超过 800ms。
- 后端单次请求只读取必要的图谱产物；若复用读取结果，缓存必须是可失效的只读进程缓存，且不属于首期必要条件。
- 前端未选焦点时节点和关系渲染数为 0。
- 局部图默认最多 80 个节点、160 条关系，任何放宽上限均需性能评审和配置变更。

## 13. 真实 API 测试方案

测试必须启动真实 FastAPI 后端并通过 HTTP 调用接口；服务层单测只能补充边界覆盖，不能替代 API 验收。目标批次若包含用户业务数据，仅执行 GET；需要构造异常或边界数据时使用隔离数据集。

### 13.1 环境与基线

1. 使用项目现有方式启动后端，记录端口、配置版本和测试数据集 ID。
2. 选取包含约 643 个关键词和千级关系的数据集作为只读性能基线。
3. 建立隔离测试数据集覆盖 0 节点、单节点、81 节点、161 关系、无证据和分母为 0 等边界。
4. 测试结束仅清理本次隔离数据，禁止使用通配删除。

### 13.2 API 用例

| 编号 | 调用 | 验证点 |
|---|---|---|
| API-01 | `GET /api/datasets/{id}/graph/observability?view=after` | 200；上下文、事实/投影数量、健康指标和规则版本完整 |
| API-02 | 同上，带合法 `filterRunId` | 运行属于数据集；指纹状态明确；无状态写入 |
| API-03 | 同上，`view=before/changed` | 可用则返回稳定数据；未实现则 HTTP 200 + pending，不伪造结果 |
| API-04 | `GET .../graph/neighborhood?nodeId={id}&limit=80` | 焦点存在；节点 <=80、关系 <=160；visible 与数组长度一致 |
| API-05 | 查询超过上限的高连接节点 | `total/visible/truncated` 一致，中文界面能识别截断 |
| API-06 | 数据集、过滤运行、节点不存在 | 404 和稳定错误码，无旧数据残留 |
| API-07 | 空图谱或无证据图谱 | 指标为 not_applicable，局部空态正确 |
| API-08 | 重复请求同一上下文 | 节点和关系顺序稳定，响应事实一致 |
| API-09 | 调用旧 `summary/nodes/edges/neighborhood` | 原契约继续通过，旧字段未删除 |

### 13.3 不变量验证

每个响应自动断言：

```text
fact >= projected >= visible
beforeKeywords = keptKeywords + excludedKeywords
visibleNodes = length(nodes)
visibleEdges = length(edges)
truncated = nodeTruncated OR edgeTruncated
available metric with denominator > 0 => value = numerator / denominator within rounding tolerance
```

### 13.4 性能验证

- 预热后分别执行概览和邻域请求至少 30 次，记录每次耗时并按同一环境计算 P95。
- 概览 P95 必须不超过 500ms；邻域 P95 必须不超过 800ms。
- 同时记录数据规模、机器环境、规则版本、成功率和最大响应体积，避免脱离基线比较单一耗时。
- 性能用例只读，不调用 `repair`、`apply`、`publish` 或其他写入接口。

### 13.5 前端验收

- 使用真实 API 验证未选焦点时不请求全量节点/关系且不初始化 ECharts。
- 桌面与移动视口分别检查范围条、指标、工具栏、局部图、截断和错误状态无重叠。
- 验证键盘可到达搜索、深度、缩放、适配和重置控件，tooltip 与中文可访问名称存在。
- 使用浏览器请求记录确认页面没有重复全量查询、竞态覆盖或 GET 写入。
- 执行前端生产构建、后端目标测试和目标文件 `git diff --check`。

## 14. 完成定义

- 需求与设计评审通过，接口 Schema 和统一上下文冻结。
- 新概览及兼容扩展的局部图通过真实 API、契约、性能和异常测试。
- 643 个关键词场景初始不渲染全量图，局部图满足 80 节点/160 关系上限。
- 事实、投影、可见规模和截断状态均在中文界面明确展示。
- 原有图谱接口、关键词过滤和人工复核回归通过。
- 未引入外部依赖，配置项集中且带版本，目标 `git diff --check` 通过。
