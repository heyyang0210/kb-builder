# 知识中心统一接口契约 v1

本目录冻结知识中心跨网关、Node 文档生产服务和 Python 资料加工服务共用的最小传输语义。它不要求两个服务合并，也不改变旧接口；旧接口通过适配层映射到本契约，新增字段只能追加。

## 必须字段

- 写请求：`requestId`、`actor`、`idempotencyKey`、资源稳定 ID、`expectedRevision`（适用时）。
- 成功响应：`success=true`、`requestId`、`data` 或 `items`、分页时的 `page/pageSize/total`。
- 错误响应：`success=false`、`error.code`、中文 `error.message`、`error.retryable`、`error.requestId`。
- 长任务：`queued/running/succeeded/failed/cancelled`，并包含步骤、输入快照、输出引用、错误和重试记录。
- 事件：`eventId`、`eventType`、`occurredAt`、`requestId`、`correlationId`、资源 ID、状态版本和脱敏 payload。

统一入口资料加工适配层已对上述成功/错误外壳执行运行时校验；下游业务字段和历史任务状态保持兼容，任务状态枚举的完整收敛另行治理。

机器可读定义：`contract.json`、`error.schema.json`、`task.schema.json`、`event.schema.json`。工单驱动文档任务资源结构见 `document-task.schema.json`：`number` 是 PingCode 全局唯一编号，也是平台任务的幂等键；工单级和手册级 `scopeDecision` 涉及时必须有范围与责任人，不涉及时必须有原因。

资料加工端点的字段级请求/响应来源为 `openapi.json`，由 `scripts/generate-knowledge-center-openapi.py` 从当前 FastAPI 应用重复生成；端点映射防漂移测试要求每条登记路径都能在该快照中找到对应操作。该快照描述旧服务字段，不等于统一外壳已完成所有字段映射。

SSE、下载和预览响应约束见 `stream-download-contract.json`；该文件与旧接口兼容基线一起作为深链和事件协议快照，不代表已完成所有登录态流式业务验证。

资料加工旧 API 的逐端点映射见 `endpoint-mapping.json`，运行时白名单直接加载该文件，
由 `packages/agent-runner-core/lib/knowledge-center-cleaning-contract.js` 执行结构校验和匹配。
端点登记可通过 `tools/knowledge-processing/generate-knowledge-center-endpoint-mapping.js`
从 Python FastAPI 路由重复生成；删除类端点默认登记但不暴露到统一入口。适配层仅转发已登记的
方法和路径；写请求由统一入口会话校验并透传 `Idempotency-Key`、`X-Request-Id`、
`X-Correlation-Id` 及脱敏操作者标识，未登记路径不会被网关暴露。

## 兼容规则

1. 网关聚合接口只能生成只读投影，不重算或写入下游状态。
2. 旧 `/api/*`、`/pingcode-api/*`、Socket.IO、SSE、下载和预览路径在迁移期保留；适配层不得删除旧字段。
3. 幂等键作用域为 `actor + operation + resource`，重复请求返回同一业务结果或明确冲突。
4. 数据库、文件和配置仍按对象归属矩阵管理；契约中的 `artifactRef` 只登记不可变对象引用，不把大文件塞进业务 JSON。


## 任务管理 V2（2026-10-30）

document-task.schema.json：任务管理V2，以number为工单键，decomposition为两层范围，status/endTime为只读投影。写入需expectedRevision与Idempotency-Key，完成仅由既有交付证据汇总。

2026-10-30：任务Schema补plannedStartTime/plannedEndTime、canEditPlan及source.sourceUrl；计划字段可空UTC日期时间，与只读startTime/endTime分离。来源为XLSX编号单元格HTTPS链接。


## AI写作引用选择（2026-11-02）

创建AI任务的referenceOrder为已确认资料ID和可选knowledge-mcp标识组成的完整有序数组。所有confirmedSourceIds必须出现且仅出现一次，不能包含未知或重复项；knowledge-mcp可省略。显式[]且confirmedSourceIds为空表示不引用资料，也不开放知识库MCP检索/工具。省略referenceOrder兼容旧客户端，默认已确认资料后加knowledge-mcp；null等非数组拒绝。任务历史保留该字段，恢复不得强制补入知识库。屏蔽仅针对本次任务执行配置，不修改全局服务。


2026-11-02：任务管理投影补手册/文档只读 canAssign、手册 canEdit、文档 ownerName。PUT /:number/handbooks/:id/owner、/:number/documents/:key/owner 使用 trusted session、expectedRevision 与 Idempotency-Key；文档另需 handbookId。父级责任人或管理员分派，无理由必填；草稿不转交。详见工单驱动文档任务详细设计实施契约。
