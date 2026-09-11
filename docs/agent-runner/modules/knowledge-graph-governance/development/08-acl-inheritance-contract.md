# ACL 继承、默认拒绝与审计事件契约

```yaml
documentType: security-design-contract
moduleId: knowledge-graph-governance
relatedRequirement: REQ-KGO-33
relatedTask: RG-10
status: review
decisionGate: G2
```

## 1. 安全基线

默认拒绝；主体必须已认证且具有数据集权限。所有下游对象继承 `datasetId` 的 ACL，并可进一步收紧，不能放宽。默认禁止跨数据集、跨租户和共享链接访问。ACL 过滤必须先于图遍历、向量召回、证据拼装和导出。

## 2. 继承矩阵

| 资源 | 继承来源 | read | write | publish/delete | 跨数据集 |
|---|---|---|---|---|---|
| dataset | 租户/显式绑定 | 显式 allow | owner/editor | owner/admin | deny |
| resource/source | dataset | inherited | editor | owner/admin | deny |
| chunk/evidence | source | inherited | pipeline service | owner/admin | deny |
| graph node/edge | dataset + graphVersion | inherited | projector service | owner/admin | deny |
| index item | dataset + indexVersion | inherited | indexer service | owner/admin | deny |
| query/answer/export | 查询主体 + 所有召回数据集 | 交集 allow | n/a | export policy | deny by default |

服务账号仅可访问任务声明的 dataset；无声明或身份解析失败一律拒绝。

## 3. 主体与特殊场景

- 匿名、未知主体、过期 token：`ACL_DENIED`，响应不得确认资源是否存在。
- 直接 ID、历史版本、已发布版本：均重新执行 dataset ACL，不使用缓存绕过。
- 共享链接：首版禁用；启用前必须有显式短期 token、dataset 范围和审计。
- 删除：必须同时具备 dataset owner/admin 和版本管理权限；逻辑删除先于物理清理。
- 跨数据集检索：只有显式授权的统一查询范围才可启用，结果按 dataset 分区并取权限交集。

## 4. 查询过滤伪代码

```text
authorized_query(principal, request):
  identity = identity_provider.resolve(principal)
  require identity.authenticated
  allowed = acl.allowed_datasets(identity, request.datasetIds)
  require allowed is not empty
  filters = {datasetId in allowed, versionId in request.versionIds}
  candidates = vector.search(request.query, filters)  # ACL filter at source
  graph = graph.query_neighborhood(request.nodeId, request.depth, filters)
  evidence = facts.get_evidence(graph.evidenceIds, filters)
  result = intersect_acl(candidates, graph, evidence, allowed)
  audit("query", identity.id, allowed, request.requestId, result.count)
  return result
```

任何底层存储不支持服务端过滤时，适配器必须拒绝请求，不得先全量读取再在应用层补过滤。

## 5. 审计事件

最小字段：`eventId`、`eventType`、`occurredAt`、`requestId`、`principalId`、`tenantId`、`datasetId(s)`、`resourceId`、`versionId`、`action`、`decision`、`reasonCode`、`policyVersion`、`sourceIp`（按脱敏策略）、`resultCount`。拒绝事件记录原因类别，不记录原文、token 或完整查询内容。

统一错误：`ACL_UNAUTHENTICATED`、`ACL_DENIED`、`ACL_CROSS_DATASET`、`ACL_POLICY_UNAVAILABLE`、`ACL_SCOPE_INVALID`。策略服务不可用时 fail-closed。

## 6. 测试矩阵

| 类别 | 用例 | 预期 |
|---|---|---|
| 默认拒绝 | 匿名/未知主体读取 | 403/`ACL_UNAUTHENTICATED`，不泄露存在性 |
| 继承 | dataset allow，读取 source/chunk/evidence/graph/index | 全部允许并带审计 |
| 收紧 | 子资源 deny | deny 覆盖父级 allow |
| 越权 | 无 dataset 权限直接读 node/evidence | `ACL_DENIED` |
| 跨集 | 请求 dataset A+B 但仅有 A 权限 | `ACL_CROSS_DATASET` 或仅返回 A（策略固定后） |
| 历史 | 已撤销权限访问旧 version | deny |
| 服务账号 | 未声明 dataset 的 pipeline 请求 | deny |
| 故障 | ACL 服务超时 | fail-closed，`ACL_POLICY_UNAVAILABLE` |
| 缓存 | 权限变更后使用旧 query cache | 缓存失效或重新鉴权 |
| 发布/删除 | editor 发布或普通用户删除 | deny，写审计 |

## 7. 未决项

- 可信身份来源（网关 JWT、现有会话或平台 RBAC）需部署负责人确认。
- dataset ACL 是否细化到 resource 级，以及 deny/allow 冲突优先级需安全评审；本稿默认 deny 优先。
- 审计存储位置、保留期、访问控制和脱敏标准需安全/合规确认。
