---
requirement: REQ-KGO-30
moduleId: knowledge-graph-governance
designVersion: 1.0.0
status: confirmed
createdAt: 2026-08-17
dependsOn: REQ-KGO-29
executionOrder: REQ-29 -> REQ-30 -> REQ-31
---

# 知识图谱问题诊断与证据联动设计

> 版本：v1.0
> 日期：2026-08-17
> 状态：设计已确认，依赖 REQ-29
> 实施顺序：REQ-29 → REQ-30 → REQ-31

## 一、背景

REQ-29 解决“看得懂当前图谱”的问题，但要完成质量治理，用户还需要从问题类别或全局关键词定位到局部关系，再追溯来源文档、处理单元和原文证据。现有质量分析页已经分别具备问题总览、过滤建议、图谱和证据抽屉，但它们没有共享完整的图谱查询上下文：

- 搜索主要作用于过滤运行决策，不能作为全图节点入口；
- 当前“过滤前”依赖页面内存快照，刷新或恢复历史运行后不能稳定还原；
- `graph/neighborhood` 只查询当前 admitted 投影和 `CONTEXT_MATCHES_CHUNK` 关系，无法表达过滤前、变化视图和两跳路径；
- 节点详情只展示第一条 occurrence，不能从任意节点或边统一进入证据下钻；
- 图谱选择状态未完整进入 URL，无法稳定分享和恢复诊断位置。

## 二、目标与非目标

### 2.1 目标

1. 建立“问题列表 → 局部图谱 → 证据详情”三栏联动，用户最多 3 次操作从问题类别到达原文证据。
2. 搜索作用于符合当前运行和视图条件的完整服务端集合，而不是只搜索当前页或当前已加载的 1000 条数据。
3. 使用过滤运行冻结的候选、最终决策和图谱指纹稳定生成 `before|after|changed` 投影。
4. 节点、关系、文档和证据通过稳定 ID 关联，不按同名文本猜测。
5. 将诊断上下文写入 URL，刷新、前进后退和分享链接均能恢复。

### 2.2 非目标

- 不创建正式图谱版本、趋势和发布告警，归 REQ-31；
- 不改变人工复核的保存、CAS 和 apply 契约；
- 不调用模型补全缺失关系或证据；
- 不提供无限深度路径搜索；首期深度仅允许 1 或 2；
- 不在响应中返回整篇原文，单条证据文本继续受长度限制。

## 三、统一诊断上下文

```json
{
  "datasetId": "dataset_xxx",
  "filterRunId": "filter_run_xxx",
  "view": "changed",
  "query": "索引",
  "issueCategory": "too_broad",
  "resourceId": "resource_xxx",
  "focusNodeId": "keyword_xxx",
  "focusEdgeId": null,
  "depth": 1,
  "nodeTypes": ["Keyword", "ProcessingUnit"],
  "missingEvidence": false
}
```

URL 参数使用同名字段。组件不得各自维护互相冲突的副本；`QualityPage.vue` 只维护一个规范化状态对象，并向问题列表、图谱和证据抽屉单向下发。

## 四、运行投影口径

### 4.1 事实源

- 图谱节点和边来自过滤运行记录的 `graphFingerprint` 所指向事实产物；
- 候选范围来自过滤运行候选快照；
- 动作和问题类别来自运行当前有效最终决策；
- 证据来自相同指纹下的 occurrence/resource/chunk 引用。

### 4.2 三种视图

| 视图 | 关键词集合 | 关系集合 |
|---|---|---|
| `before` | 运行候选快照中的全部关键词 | 与候选关键词两端均可见的证据和业务关系 |
| `after` | 最终动作是 `keep` 的关键词 | 与保留关键词两端均可见的证据和业务关系 |
| `changed` | 最终动作是 `exclude` 或与模型动作不同的关键词 | 与变化关键词相关的受影响关系 |

若运行图谱指纹对应的事实产物不可用，不允许使用当前同名关键词拼装历史图谱。接口返回 `projectionAvailability=stale` 和缺失原因，前端保留问题决策与证据索引中的可用内容，但不展示伪造关系。

## 五、页面交互设计

### 5.1 桌面端

```text
┌────────────────┬──────────────────────────┬──────────────────┐
│ 问题与搜索       │ 局部图谱                   │ 节点/关系证据      │
│ 类别、动作、文档  │ 当前范围和截断提示          │ 来源文档           │
│ 全局搜索结果      │ 1/2 跳、聚焦、重置          │ 处理单元和原文证据  │
│ 缺失证据筛选      │ 路径高亮                   │ stale/missing 状态  │
└────────────────┴──────────────────────────┴──────────────────┘
```

### 5.2 移动端

按“问题列表 → 图谱 → 证据”三个标签页切换，证据详情占满可用宽度。选择状态不因标签切换丢失，返回时恢复滚动位置和焦点。

### 5.3 联动规则

1. 点击问题类别：设置 `issueCategory`，动作自动收敛为排除，清空不兼容的焦点；
2. 点击关键词：设置 `focusNodeId` 并加载局部图谱；
3. 点击图谱节点：图谱聚焦、问题列表定位并加载节点证据；
4. 点击关系：高亮两端节点并加载关系证据；
5. 点击文档：设置 `resourceId`，列表、图谱和证据同步过滤；
6. 切换 `before|after|changed`：重新向后端请求投影，不复用旧视图的节点数组；
7. 浏览器前进、后退和刷新：从 URL 规范化恢复相同状态。

## 六、接口设计

全部为新增只读接口；旧接口保持不变。

### 6.1 全局节点搜索

```http
GET /api/datasets/{datasetId}/graph/search
  ?filterRunId={id}
  &view=after
  &query=索引
  &nodeType=Keyword
  &issueCategory=too_broad
  &resourceId={id}
  &page=1
  &pageSize=20
```

约束：

- 先在完整投影集合中执行全部筛选，再分页；
- `pageSize` 最大 100，默认值来自配置；
- 搜索字段包括节点显示名、标准名、原名、别名和稳定 ID；
- 响应返回 `total/page/pageSize/items/sourceAvailability`。

### 6.2 局部图谱探索

```http
GET /api/datasets/{datasetId}/graph/explore
  ?filterRunId={id}
  &view=after
  &focusNodeId={id}
  &depth=1
  &issueCategory=too_broad
  &resourceId={id}
  &nodeType=Keyword
```

响应示例：

```json
{
  "scope": {
    "datasetId": "dataset_xxx",
    "filterRunId": "filter_run_xxx",
    "view": "after",
    "focusNodeId": "keyword_xxx",
    "depth": 1,
    "projectionAvailability": "available",
    "sourceFingerprint": "sha256:..."
  },
  "focusNode": {},
  "nodes": [],
  "edges": [],
  "counts": {
    "matchedNodes": 164,
    "matchedEdges": 420,
    "returnedNodes": 80,
    "returnedEdges": 160
  },
  "truncated": true,
  "warnings": []
}
```

接口限制：

- `depth` 仅允许 1 或 2；
- 返回节点、关系上限来自配置；
- 遍历顺序稳定：焦点、异常优先、证据关系优先、置信度、稳定 ID；
- 所有边的两端节点必须存在于响应中，不返回悬空边；
- 不因返回上限而随机改变同一请求的结果。

### 6.3 节点和关系证据

```http
GET /api/datasets/{datasetId}/graph/evidence
  ?filterRunId={id}
  &view=changed
  &nodeId={id}
  &edgeId={id}
  &resourceId={id}
  &missingEvidence=false
  &page=1
  &pageSize=50
```

`nodeId`、`edgeId` 至少提供一个。响应按稳定 ID 返回：

- 节点或关系摘要；
- `resourceId`、文档标题和受控路径；
- `chunkId`、标题路径；
- `evidenceText`，单条不超过 500 字符；
- `documentOffsets`；
- `evidenceAvailability=available|missing|stale`；
- `total/page/pageSize/items`。

现有 `keyword-filter-runs/{runId}/issue-evidence` 继续服务问题类别下钻；新接口服务任意图谱节点和关系，两者共享证据索引和去重函数。

## 七、后端伪代码

```text
function resolve_run_projection(dataset_id, filter_run_id, view):
    run = require_filter_run(dataset_id, filter_run_id)
    source = resolve_graph_by_fingerprint(run.graph_fingerprint)
    if source is missing:
        return stale_projection_without_guessed_relations(run)

    candidates = ids(run.candidate_snapshot)
    final_by_id = map(run.effective_final_decisions)

    if view == before:
        visible_keywords = candidates
    if view == after:
        visible_keywords = ids where final.action == keep
    if view == changed:
        visible_keywords = ids where final.action == exclude
                           or final.action/category differs from model

    return project_graph(source.nodes, source.edges, visible_keywords)
```

```text
function explore(projection, focus_node_id, depth, filters, limits):
    filtered = apply_filters_to_complete_projection(projection, filters)
    assert focus_node_id exists in filtered
    visited = breadth_first_search(filtered, focus_node_id, depth)
    ordered_nodes = stable_priority_order(visited.nodes)
    ordered_edges = stable_priority_order(visited.edges)
    capped_nodes, capped_edges = cap_without_dangling_edges(ordered_nodes, ordered_edges, limits)
    return graph + matched_counts + returned_counts + truncated
```

```text
function graph_evidence(node_id, edge_id, resource_id, page):
    references = evidence_index.lookup_by_stable_id(node_id, edge_id)
    references = filter_resource(references, resource_id)
    references = deduplicate(keyword_or_node_id, resource_id, chunk_id, evidence_text)
    return paginate(references, page)
```

## 八、前端状态伪代码

```text
route query changed
  -> normalize ScopeContext
  -> cancel obsolete requests
  -> load issue/search list
  -> load local graph when focusNodeId exists
  -> load evidence when nodeId or edgeId exists

user selects item
  -> update one ScopeContext
  -> router.replace(new query)
  -> child panels receive same context
```

所有请求使用最新上下文序号或 `AbortController` 防止慢响应覆盖新选择。

## 九、性能、安全与兼容

- 643 个关键词场景的搜索 P95 小于 500ms，局部图谱和证据查询 P95 小于 800ms；
- 不返回完整原文，不扩大现有数据集访问边界；
- 历史源缺失时显示 stale，不将当前同名节点当作历史证据；
- 只读诊断接口不得生成模型调用或修改过滤运行 revision；
- 旧 `graph/neighborhood`、问题总览和 issue-evidence 接口继续工作；
- 不引入新依赖。

## 十、SMART 验收标准

1. REQ-29 验收后 2 个工作日内完成 REQ-30 后端、前端和真实 API 验收，或记录可复现阻塞。
2. 搜索对完整服务端集合生效；构造目标只出现在第二页的数据时，第一页发起搜索仍能命中。
3. `before/after/changed` 的关键词集合分别与候选快照、最终保留、最终变化决策精确一致。
4. 每个局部图谱响应无悬空边、顺序稳定、深度不超过 2、节点和边不超过配置上限。
5. 用户从类别总览到任意可用原文证据不超过 3 次点击；节点和边均可下钻。
6. URL 能恢复 `filterRunId/view/query/category/resourceId/focusNodeId/focusEdgeId/depth`，刷新前后状态一致。
7. 源图谱不可用时 100% 返回并展示 stale，不发生同名错误关联。
8. 使用隔离数据集真实调用 search、explore 和 evidence；目标业务批次保持只读。
9. 后端契约、投影、分页、竞态测试及中文前端桌面/移动验收通过，生产构建和目标 `git diff --check` 通过。

## 十一、依赖与后续

- 前置：REQ-29 全部验收通过；
- 复用：`docs/26` 的运行快照和指纹、`docs/27` 的最终决策、`docs/28` 的证据索引；
- 后续：REQ-30 验收后进入 REQ-31，正式版本不复用运行级临时 revision 作为版本号。
