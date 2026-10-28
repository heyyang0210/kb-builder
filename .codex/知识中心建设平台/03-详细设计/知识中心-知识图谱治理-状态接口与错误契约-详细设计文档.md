# 状态机、API 字段与错误契约

```yaml
documentType: design-contract
moduleId: knowledge-graph-governance
relatedRequirement: REQ-KGO-33
relatedTask: RG-08
status: implemented-rg16
decisionGate: G2
```

## 1. 设计边界

本契约描述知识加工产物的治理状态，不替换现有训练任务的运行状态。旧接口继续可读；新字段通过响应扩展提供。正式发布要求 `Entity`、`Relation`、证据、ACL 校验和 P0 门禁全部通过。图数据库是异步投影，图投影失败不回写或破坏 JSON/JSONL 事实源。

## 2. 状态与不变量

| 状态 | 含义 | 可发布 |
|---|---|---|
| `keyword` | 规则/关键词候选产物 | 否 |
| `formal` | 通过 Schema、Entity/Relation、证据和质量校验的正式候选 | 否 |
| `index` | 检索索引已构建并校验 | 否 |
| `evaluated` | 评测集达到门槛且无 P0 | 否 |
| `published` | 指针原子切换至已评测版本 | 是 |
| `failed` | 当前版本不可继续，原因可审计 | 否 |
| `cancelled` | 主动取消，保留已写入事实 | 否 |

不变量：状态只能前进或进入 `failed/cancelled`；不得从 `keyword` 越级到 `published`；每次迁移产生单调递增 `statusVersion`、`updatedAt`、操作者和 `reasonCode`；`publishable=true` 仅允许出现在 `published`。

## 3. 转移表

| 当前 | 目标 | 条件 | 失败处理 |
|---|---|---|---|
| `keyword` | `formal` | Schema、证据、Entity/Relation 检查通过 | `QUALITY_*` 或 `SCHEMA_*` |
| `formal` | `index` | 索引输入快照完整、版本匹配 | `INDEX_*` |
| `index` | `evaluated` | 评测阈值通过且无 P0 | `EVALUATION_*` |
| `evaluated` | `published` | ACL、完整性、门禁通过，原子更新指针 | `PUBLISH_*` |
| 任意运行态 | `failed` | 不可恢复错误或批次清单不可验证 | 保留原错误分类 |
| 任意未发布态 | `cancelled` | 取消令牌已确认 | 记录取消原因 |
| `failed/cancelled` | 原运行态 | 显式重试且创建新 `versionId` | 禁止复用旧版本 |
| `published` | `published` | 重复幂等请求且请求指纹相同 | 返回原结果 |
| `published` | `failed` | 禁止；撤销需新版本/指针操作 | `STATE_INVALID_TRANSITION` |

## 4. API 响应契约

RG-16 采用方案 A：保留既有 `DatasetVersion.state`，通过可选嵌套字段增量返回治理状态。历史记录没有 `governance` 时继续使用旧发布逻辑；新加工记录必须带该字段。

```json
{
  "id": "dataset-id",
  "state": "candidate",
  "governance": {
    "status": "index",
    "statusVersion": 2,
    "publishable": false,
    "reasonCode": "ACL_EVALUATION_PENDING",
    "gateChecks": {
      "entity_relation": true,
      "evidence": true,
      "acl": false,
      "quality": true,
      "evaluation": false
    }
  }
}
```

旧客户端仅读取既有状态字段。发布接口可带 `expectedStatusVersion` 做乐观并发控制；治理模式下 `force=true` 不能绕过任何 P0 门禁，历史模式继续兼容原有 force 语义。

## 5. 稳定错误分类

| 错误码前缀 | 适用范围 | 示例 |
|---|---|---|
| `MODEL_*` | 仅模型网关调用 | `MODEL_GATEWAY_UNAVAILABLE` |
| `JSON_*` | JSON/JSONL 解析和清单 | `JSON_RECORD_INVALID` |
| `FILE_*` | 文件缺失、权限、快照 | `FILE_SNAPSHOT_MISSING` |
| `CONVERT_*` | 文档转换 | `CONVERT_UNSUPPORTED` |
| `SCHEMA_*` | 字段、类型、必填项 | `SCHEMA_ENTITY_MISSING` |
| `ACL_*` | 授权和数据集边界 | `ACL_DENIED` |
| `QUALITY_*` | 质量问题和门禁 | `QUALITY_NO_RELATION` |
| `INDEX_*` | 索引构建/校验 | `INDEX_VERSION_MISMATCH` |
| `STATE_*` | 非法迁移/并发冲突 | `STATE_VERSION_CONFLICT` |
| `PUBLISH_*` | 发布指针和回滚 | `PUBLISH_GATE_BLOCKED` |

错误响应返回 `code`、用户可读 `message`、`retryable`、`details`（脱敏）、`requestId`；底层异常类型不得直接透传。

## 6. 迁移伪代码

```text
transition(resource, target, expectedVersion, request):
  current = store.read(resource)
  require current.statusVersion == expectedVersion
  require transition_allowed(current.status, target)
  checks = gate_checks(resource, target)  # ACL/schema/quality/index/evaluation
  if checks.has_p0: return error(PUBLISH_GATE_BLOCKED, checks)
  next = copy(current)
  next.status = target
  next.statusVersion += 1
  next.publishable = (target == "published")
  next.reasonCode = checks.reasonCode or request.reasonCode
  store.compare_and_set(resource, expectedVersion, next)
  audit.append(status_transition_event(current, next, request.requestId))
  return next
```

## 7. 测试矩阵

| 类别 | 用例 | 预期 |
|---|---|---|
| 正向 | keyword→formal→index→evaluated→published | 每步门禁通过，版本递增 |
| 越级 | keyword→published | `STATE_INVALID_TRANSITION`，无指针变化 |
| P0 | evaluated 存在 ACL/证据阻断 | `PUBLISH_GATE_BLOCKED` |
| 并发 | 相同 expectedVersion 两次提交 | 一次成功，一次 `STATE_VERSION_CONFLICT` |
| 幂等 | 相同 idempotencyKey 重试 | 返回相同结果，不重复迁移 |
| 部分失败 | 单记录质量问题 | 隔离记录，批次继续 |
| 批次失败 | 清单整体不可验证 | 批次进入 `failed` |
| 取消/重试 | 取消后重新处理 | 新 versionId，旧事实不变 |
| 兼容 | 旧响应读取新产物 | 旧字段可读，新字段可忽略 |

## 8. 未决项

- G2-01 已于 2026-08-18 确认方案 A：旧字段继续可读，新增可选 `governance` 嵌套字段，不新增 v2 路由。
- `published` 指针是否允许在异步图投影未完成时发布：按当前基线允许，但需 G2 固化图投影延迟告警阈值。
