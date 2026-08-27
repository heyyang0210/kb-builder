# 管理员手册大纲兼容阶段三：安全上传与真实 API 验收设计

> documentType: development-design
> moduleId: outline-management
> owner: Architect / Backend Worker / Test Engineer
> 阶段：P3
> 状态：设计待评审，安全与公共行为实施需人类确认
> 前置：P2 统一 AST 和诊断契约完成
> 目标时限：P2 完成后 1 个工作日内完成上传接入与回归证据

## 1. 背景与用户故事

当前 Multer 使用磁盘存储，文件可能在业务校验前已写入；随后即使解析失败，路由也可能创建 `kp_count=0` 的 metadata。作为上传者，我希望失败请求不留下文件或元数据，成功响应中的计数与随后读取到的树完全一致，并能通过真实后端 API 证明这一点。

## 2. 范围与非范围

范围：把 P2 解析服务接入上传路由；定义校验先于正式落库、原子提交、幂等和清理；建立真实 API 回归矩阵。

非范围：不建设预检 UI；不引入评分；不改变知识点生成流程；不自动修复领域内容；不做与上传安全无关的重构。

## 3. 安全上传架构

```text
HTTP multipart
 → 临时隔离区/内存接收
 → 文件契约校验
 → P2 解析与阻断校验
 → 生成服务端 ID 和最终文件名
 → 写临时 metadata 快照
 → 原子移动文件
 → 原子替换 metadata
 → 返回成功
```

任一步失败都进入补偿清理。临时目录、原子写策略和锁策略必须在实施设计中结合当前单进程/多进程部署方式确认。不得用客户端文件名拼接最终路径。

## 4. API 契约

保持 `POST /api/outline/upload` 和 `multipart/form-data`，字段 `file`、`name`、`type`。过渡期可接收 `content`，但不得将其作为事实来源。

成功建议返回：

```json
{
  "success": true,
  "data": {
    "id": "outline_<server-id>",
    "name": "管理员手册大纲",
    "kp_count": 42,
    "dialect": "standard-markdown-v1",
    "specVersion": "1.0.0",
    "ruleVersion": "outline-parser-v1",
    "contentHash": "sha256:<hex>",
    "message": "大纲上传成功"
  }
}
```

失败建议返回：

```json
{
  "success": false,
  "error": {
    "code": "OUTLINE_ZERO_KNOWLEDGE_POINTS",
    "message": "未识别到知识点，文件未保存",
    "requestId": "<id>",
    "diagnostics": []
  }
}
```

格式/内容错误使用 400 或 422 的最终选择需在 API 评审中冻结；大小超限建议 413；冲突建议 409；服务端故障 500。不得只依赖 `statusText` 作为前端中文错误。

## 5. 持久化契约

新记录至少保存 `id/name/type/file/content/kp_count/created_at/updated_at`，并新增或旁路保存 `dialect/specVersion/ruleVersion/contentHash`。提交不变量：

- `kp_count == count(content)` 且大于 0。
- `file` 必须存在且摘要等于 `contentHash`。
- ID 唯一；同一幂等键不能产生两条记录。
- metadata 写入失败时不得留下正式文件，文件移动失败时不得发布 metadata。

## 6. 配置策略

文件上限、允许格式、临时目录、清理时限、幂等窗口、锁超时、诊断响应上限和 API 状态映射进入版本化配置。安全默认值由配置提供；缺失关键配置时拒绝启动或拒绝上传。不得将测试目录或清理范围硬编码到业务路由。

## 7. 伪代码

```text
function uploadOutline(request):
  staged = stageMultipartFile(request.file)
  try:
    parsed = parseOutline(staged.bytes, request.originalName)
    if not parsed.success: return failureWithoutCommit(parsed)

    record = buildRecord(parsed, sanitizedUserFields(request))
    assert record.kp_count > 0
    with metadataLock:
      assert idempotencyNotCommitted(request.key, parsed.contentHash)
      atomicallyCommitFileAndMetadata(staged, record)
    return success(record)
  catch error:
    compensateOnlyOwnedArtifacts(staged, record?.id)
    throw mappedError(error)
```

## 8. 异常、安全与并发

- 路径穿越、双扩展名、超限、非 UTF-8、重复 ID、0 知识点、敏感信息命中均在提交前失败。
- metadata 更新需要并发控制，避免两个上传互相覆盖 JSON 文件。
- 清理只能针对本请求创建且可验证归属的临时对象。
- 日志记录 requestId、摘要、规则版本、耗时和错误码，不记录完整文件正文。
- 客户端断连、进程中止和磁盘不足必须有可恢复策略和孤儿临时文件巡检。
- 性能目标沿用后端角色基线 P95 < 500ms；大文件解析若不能满足，需基准证据和单独性能决策。

## 9. 迁移兼容

- 已有合法记录继续读取；缺少版本字段时标为 `legacy`，不在读取时改写。
- 旧客户端仍可提交 `content`，服务端忽略或校验一致性并返回弃用提示。
- 旧的 0 知识点记录不自动删除；提供只读审计清单，后续处置属于破坏性变更，必须人工确认。
- 可通过配置化特性开关灰度启用严格提交，但不得让同一请求因回退而落入不安全旧路径。

## 10. 验收标准

- 标准规范副本通过真实 API 成功上传，响应计数等于详情接口和持久化内容计数。
- 原始管理员手册在未解决叶子映射时返回结构化失败或需确认状态，不产生正式记录。
- 空文件、0 知识点、重复 ID、超限、非法格式、客户端伪造 `content` 全部失败且无残留。
- 模拟 metadata 写失败、文件移动失败和重复请求时，原子性与幂等断言成立。
- 两个并发上传都保留各自记录，不发生 metadata 丢失更新。
- 所有响应使用中文用户消息，并含稳定错误码和 requestId。

## 11. 测试策略

- 单元测试：提交器、补偿器、幂等和错误映射。
- 集成测试：真实启动后端，用 HTTP multipart 调用上传、列表、详情和删除。
- 故障注入：磁盘写失败、metadata 格式损坏、移动失败、客户端断连。
- 并发测试：并行提交不同文件和相同幂等键。
- 回归矩阵：标准 Markdown、标题树、JSON、CSV、英文冒号、BOM、CRLF、混合层级。
- 每个失败场景同时断言 HTTP、响应体、最终文件集合和 metadata 集合。

## 12. 依赖、风险与完成定义

依赖 P2 契约、测试隔离目录和可启动的真实后端。风险包括 JSON metadata 的并发写能力、磁盘原子移动跨文件系统限制和严格行为对旧客户端的影响。安全策略、状态码变化、旧数据处置和公共 API 行为均需人类确认。

完成定义：安全提交流程评审获批；真实 API 矩阵全部通过并留存命令、响应和清理证据；成功与失败不变量满足；相关设计和 README 同步；无外部依赖；`git diff --check` 及语法检查通过。
