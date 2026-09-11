# PingCode 按需语义补充步骤详细设计

> 版本：v1.0
> 上位设计：`docs/08-pingcode-processing-six-step-pipeline-design.md`

## 一、范围与职责

按需语义补充是第四个前端步骤，由代码读取步骤三的 `needs_enrichment`，逐项调用专用 `SemanticEnrichmentAgent`。没有待处理项时状态为 `skipped`，并显示中文原因。本步骤不重新提取全部文档，不处理步骤三已解决候选，Agent 不得扩大任务范围。

> TASK-P0-02 边界：`formal_knowledge` 的最小知识点抽取不产生 `needs_enrichment`，也不进入本步骤。仅后续显式启用、且拥有独立不确定项契约的能力可以写入该队列；知识点模型失败直接记录为 `quality/extraction-issues.json` 中文质量问题。

## 二、输入与任务边界

输入为 `uncertain-items/pending.jsonl`、步骤二元数据和处理单元上下文、步骤三候选及冲突、Prompt/Skill Registry 和模型测试结果。每次调用只关联一个 `uncertainItemId`，上下文只包括问题、当前证据、标题路径、相邻摘要、候选和约束。禁止传入完整文档、认证信息、完整 Prompt 或无关处理单元正文。

支持指代消解、关系类型判断、跨处理单元局部关系、候选冲突和类型边界判断。

## 三、执行策略

```text
读取 pending.jsonl
  -> 校验不确定项唯一性和输入哈希
  -> 检查模型测试是否通过
  -> 创建 AgentTask
  -> 并发最多 3、单项最多 1 次重试
  -> 代码校验 Agent JSON、证据和候选端点
  -> 写入 resolved、semantic-resolution 和 issues
```

推荐单次超时 30～45 秒，最大输出 800～1200 Token。无法可靠判断时返回 `human_required`，不得用低置信度结果强行通过。

## 四、产物 Schema

### 4.1 Semantic Enrichment Skill

本步骤使用独立的 `semantic-enrichment@1.0.0`，不能复用 `knowledge-extraction`。前者一次只解决一个局部语义问题，后者一次处理一个完整处理单元，两者的任务边界、输入字段和输出 Schema 均不同。

```text
tools/knowledge-processing/pingcode-processing/skills/semantic-enrichment/
├── SKILL.md
├── skill.yaml
├── prompts/system.md
├── prompts/user.md
└── schemas/input.schema.json
    schemas/output.schema.json
```

输入 `ContextEnvelope` 至少包含 `uncertainItemId`、问题类型和原因、当前证据、标题路径、相邻处理单元摘要、候选值、知识 Schema 版本和证据约束。输出状态只允许 `resolved` 或 `human_required`。

### 4.2 语义结果

`model-results/semantic-resolution.jsonl`：

```json
{
  "uncertainItemId": "uncertain_xxx",
  "resourceId": "resource_xxx",
  "chunkId": "resource_xxx:1",
  "status": "resolved",
  "reason": "相邻单元明确介绍 max_connections。",
  "confidence": 0.86,
  "knowledgePoints": [],
  "entities": [],
  "relations": [],
  "metadata": {
    "agentId": "semantic-enrichment-agent",
    "skillId": "semantic-enrichment",
    "skillVersion": "1.0.1",
    "promptVersion": "semantic-enrichment:1.0.1",
    "schemaVersion": "2.0.0"
  },
  "usage": {"promptTokens": 520, "completionTokens": 120, "durationMs": 2800}
}
```

`uncertain-items/resolved.jsonl` 记录原状态、终态、调用次数、输入哈希、处理时间、失败原因和是否进入步骤五。

### 4.3 质量问题

`quality/semantic-issues.json` 保存模型服务不可用、单项超时、输出 Schema 错误、证据无法回查、关系端点无法解析等问题。失败项必须同时写入 `resolved.jsonl` 并以 `human_required` 结束，不能从审计链中消失。

## 五、接口、事件与伪代码

```text
interface SemanticEnrichmentStage:
  validate_inputs(context) -> ValidationResult
  execute(context) -> StageResult
  validate_outputs(context, result) -> ValidationResult

execute(context):
  filter state == needs_enrichment
  if filtered pending is empty:
    return skipped("没有需要语义补充的不确定项")
  verify model test and registry versions
  for item in pending with concurrency <= 3:
    build bounded ContextEnvelope
    call SemanticEnrichmentAgent(item)
    validate result, evidence and endpoints in code
    persist resolved state and audit event
  atomically write semantic results and issues
```

事件：`stage.started`、`agent_task.started`、`model_call.started`、`model_call.completed`、`model_call.failed`、`agent_task.completed`、`stage.skipped`、`stage.completed`。

## 六、失败、幂等与验收

单项超时、连接失败或 Schema 错误时转 `human_required`，不阻塞其他项；模型服务整体不可用时，未处理项写入质量问题，步骤可降级完成。相同不确定项、输入哈希和版本记录可复用结果；输入或 Prompt/Skill 版本变化时重新调用。真实 API 验证零待处理项跳过、单项成功、超时、服务不可用、无证据结果、并发上限、重复执行和中文失败消息。

## 七、当前实现约束

- 公共阶段 ID 保持 `semantic_enrichment`，兼容现有前端任务状态；
- 代码使用最多 3 个工作线程调度，Skill 和 Agent 不控制并发；
- 每个工作线程只接收一个不确定项的有界上下文；
- 模型返回后由代码校验证据文本、偏移和关系端点；
- 仅 `needs_enrichment` 会触发模型调用，`schema_candidate` 和 `human_required` 原样保留给后续质量汇总；
- 全部待处理项失败时步骤仍降级完成，确定知识继续进入步骤五。
- 单项结果缓存位于运行数据目录的 `processing/agent-cache/semantic-enrichment/`；只有输入、Skill/Prompt/Schema 和模型指纹完全一致时复用，缓存损坏或 Schema 校验失败时重新调用。
- Schema 校验前由代码规范化无歧义的结构别名，例如 `relationships -> relations`、`sourceEntity -> source`，并删除模型回显的任务、资源和处理单元标识；`uncertainItemId` 及 Skill、Prompt、Agent、Schema 版本均以代码构造的上下文和 Registry 为准。
- 知识点、实体、关系集合仅保留 Schema 声明字段；`description` 仅等价映射为知识点陈述，不得借归一化补充输入证据之外的数据库事实。
- 首次调用和 Schema 纠正调用必须执行同一条归一化链：删除顶层 `taskId/resourceId/chunkId`、转换字段别名、使用上下文覆盖 `uncertainItemId` 和版本元数据、过滤集合项额外字段，最后执行严格 Schema 校验。`chunkId` 只能由代码写入外层语义结果和审计记录，不能作为 Agent 输出字段放宽 Schema。
- 每个语义工作项记录 `taskId/stageRunId/agentTaskId`；每次模型请求记录独立 `modelCallId`，重试通过 `retryOf` 关联。失败转 `human_required` 时必须保留最后一次 `modelCallId` 和结构错误摘要。
