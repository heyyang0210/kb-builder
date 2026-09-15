# PingCode 素材端到端加工框架设计

> 版本：v1.0  
> 日期：2026-07-27  
> 状态：六步骤设计基线，现有试验代码待按本设计重构

## 一、目标与边界

本期先打通一条可运行、可观察、可追溯的最小闭环：

```text
上传文件 -> MaterialBatch -> 资料预处理 -> 元数据构建
         -> 知识提取 -> 按需语义补充 -> 知识校验与合并
         -> 图谱与数据集生成
```

本期采用 FastAPI 进程内后台线程和现有 `JsonStore`，不引入 SQLite、独立 Worker、消息队列、容器、向量数据库或图数据库。该选择只用于尽快验证端到端框架，不代表生产可靠性设计已经完成。

模型配置统一复用 YashanDB 知识库文档生成器 `config/knowledge-center/ai-services.json 的 model 分区`。密钥仅由 `agent-runner` 的 `ConfigManager` 解密并调用模型，Python 服务不读取、不复制、不记录模型密钥。

## 二、模块与接口

### 2.1 agent-runner 内部 Model Gateway

```text
GET  /api/model-provider/status
POST /api/model-provider/test
POST /api/model-provider/chat
POST /api/model-provider/vision
POST /api/model-provider/embedding
```

- `status` 返回 Provider、模型、接口地址、全局 Token 上限、请求超时、密钥配置状态和能力状态，不返回密钥；
- `test` 使用小型结构化 JSON 请求真实验证当前模型的连接、认证、超时和 JSON 输出能力，返回耗时、Token、Schema 校验结果和中文错误摘要；
- `chat` 执行普通或 JSON Chat 调用；
- `vision` 与 `embedding` 保留契约，能力未配置时返回 `CAPABILITY_UNAVAILABLE`；
- 默认只允许回环地址访问；配置 `MODEL_GATEWAY_INTERNAL_TOKEN` 后还须携带 `X-Internal-Token`；
- 跨机器部署通过 `AGENT_RUNNER_MODEL_GATEWAY_URL` 配置服务地址，不写死 IP。

网关伪代码：

```text
verify loopback address or internal token
load model config through ConfigManager
reject when key or model is absent
validate messages and options
invoke LLMClient.chat or LLMClient.chatJSON
return provider, model, usage and result without credentials
```

### 2.2 加工前模型预检

```text
GET  /api/training/model-config
POST /api/training/model-test
POST /api/training/preflight
```

- 加工服务只继承 YashanDB 知识库文档生成器的模型配置，不在素材平台维护第二套配置，也不读取和回显密钥；
- 模型真实测试结果按配置指纹缓存 10 分钟，至少包含提供商、模型、接口地址、耗时、Token、Schema 是否通过和测试时间；
- `preflight` 读取批次源文件并按当前分块参数计算文档数、预计分块数、预计不确定项数和按需模型调用上限；
- 预计耗时以最近真实测试耗时为基线，并结合各 Skill 并发度返回区间和风险说明；
- `POST /api/training/tasks` 必须在后端再次校验测试未过期且配置指纹一致，否则返回 `MODEL_TEST_REQUIRED`，不能仅依赖前端禁用按钮。

预检伪代码：

```text
load safe model status and current configuration fingerprint
require a successful structured model test within 10 minutes
for every processable source document
  clean text with current preset
  calculate semantic chunks
  build rule metadata and detect uncertain candidates
sum uncertain-item calls only
estimate duration from measured latency and bounded concurrency
return canStart, estimates and Chinese risk messages
```

### 2.3 FastAPI TrainingService

六步骤的输入、输出、主要功能、步骤接口和实施顺序详见：`docs/08-pingcode-processing-six-step-pipeline-design.md`。

```text
POST /api/training/tasks
GET  /api/training/tasks?batchId={batchId}
GET  /api/training/tasks/{taskId}
GET  /api/training/tasks/{taskId}/events
GET  /api/training/tasks/{taskId}/logs?offset=0&limit=200
GET  /api/training/tasks/{taskId}/review-items
POST /api/training/tasks/{taskId}/review-items/{itemId}/decision
GET  /api/datasets/{datasetId}/graph/summary
GET  /api/datasets/{datasetId}/graph/nodes
GET  /api/datasets/{datasetId}/graph/edges
```

前端和任务状态采用六个稳定步骤，细粒度动作作为步骤内部事件记录，不再继续细分：

| 顺序 | 阶段 | 执行方 | 行为 |
|---|---|---|---|
| 1 | material_preparation | 代码 | 扫描、Office/PDF 转 Markdown、规范化、清洗、结构解析、结构化处理单元和原始来源映射 |
| 2 | metadata_construction | 代码 | 构建文档和分块元数据，生成规则摘要、分类、关键词、标题路径和相邻分块摘要 |
| 3 | knowledge_extraction | 代码调用专用 Agent | 代码识别明确锚点并调用知识提取 Agent 提取实体、关系和原文证据；内部识别候选冲突、指代不明、隐含关系和上下文不足项 |
| 4 | semantic_enrichment | 代码调用专用 Agent | 只处理第 3 步产生的 `needs_enrichment` 项；无不确定项时明确跳过 |
| 5 | knowledge_validation | 代码 | 校验 Schema、原文证据、偏移和关系端点，合并代码锚点、Agent 与模型结果并生成质量问题 |
| 6 | graph_dataset_generation | 代码 | 从最终知识构建图谱，保存运行报告和候选数据集，不自动正式发布 |

“不确定项识别”属于 `knowledge_extraction` 内部代码路由，不作为独立前端步骤、页面或业务确认区。每个候选只进入以下一种状态：

```text
code_resolved   代码锚点和证据明确，直接进入最终候选
agent_resolved  知识提取 Agent 已返回并通过代码校验
needs_enrichment 存在候选冲突、指代不明、隐含关系或上下文不足，进入语义补充
human_required  输入缺失或模型仍无法可靠判断，不进入候选图谱，作为质量问题留存
```

不能只依赖单一置信度阈值决定是否进入按需语义补充。代码必须先检查候选数量、证据完整性、指代词、跨单元依赖和候选冲突；置信度仅作为辅助信号。知识提取阶段由代码调用专用 Agent，语义补充阶段只处理仍未解决的问题。

### 2.4 实时进度、日志与质量问题

训练任务同时维护任务快照和结构化事件。任务快照用于页面刷新后恢复，至少包含当前阶段、阶段内 `current/total/unit/message`、模型调用统计、图谱摘要和各阶段起止时间。结构化事件用于解释“刚刚发生了什么”，按顺序写入：

```text
{dataRoot}/training-runs/{taskId}/events.jsonl
```

事件字段为 `sequence/timestamp/level/stage/event/message/current/total/details`。日志不得记录 Prompt 全文、源文件全文、密码、Cookie、Token 或完整认证头。公开 API 仅返回仓库内相对日志路径。

面向前端的 `message` 必须是可直接展示的中文摘要。模型超时、连接拒绝、返回格式错误以及 HTTP 认证、限流和服务端错误由后端统一归类为中文原因；原始异常仅写入 `details.technicalError`，前端放在失败详情抽屉的“技术信息”折叠区，不得把英文异常、事件代码或字段代码作为主提示。`skipped` 阶段必须在 `message` 中给出明确中文原因，例如“当前未启用图片说明能力，因此跳过此步骤”。

SSE 保持 `task.progress` 快照，并新增 `training.log` 事件。前端首次打开和重连时通过日志分页接口补齐历史事件；SSE 断开时降级为任务与日志轮询。

进程内线程不支持重启恢复。FastAPI 启动时必须扫描持久化状态，将上次进程遗留的 `queued/running` 训练任务标记为失败，记录 `task.interrupted` 事件和原阶段，不得继续向前端显示为实时运行。

输入缺失、证据不足或模型仍无法可靠判断的项目进入质量问题，状态为 `human_required`，不自动进入候选图谱。每项必须包含中文原因、来源、分块、候选结果、证据片段和处理历史；本期不新增独立“不确定项确认”页面，后续人工复核交互另行设计。

统计口径：

- 模型调用成功：模型网关返回且结果通过 JSON 解析的调用次数；
- 模型调用失败：超时、网关拒绝、网络错误或结果无法解析的调用次数；
- 图谱节点：文档、文本分块和抽取实体的去重对象总数；
- 证据关系：文档包含分块、分块提及实体以及具有原文证据的实体关系总数。

流水线伪代码：

```text
create task snapshot and training-runs directory
prepare source files, convert Office/PDF to Markdown, and persist source mappings
build document metadata and chunk metadata in code
run metadata construction in code
call KnowledgeExtractionAgent for knowledge extraction
for each candidate result
  if code evidence is explicit, mark code_resolved
  if Agent result is valid, mark agent_resolved
  if candidate conflict, ambiguous reference, implicit relation or missing context, create needs_enrichment item
  if required source or evidence is absent, mark human_required
for each needs_enrichment item
  assemble ContextEnvelope from document metadata, heading path, adjacent summaries, evidence excerpt and candidates
  call SemanticEnrichmentAgent with the type-specific prompt, Skill and bounded context
  validate JSON Schema and verify evidence against source offsets
merge validated extraction and enrichment results in code
build graph only from final-results/knowledge.jsonl
write quality issues and candidate dataset artifacts
```

大模型不执行扫描、清洗、格式转换、处理单元切分、证据校验、去重、图谱构建和数据集登记。知识提取和语义补充由不同专用 Agent 负责；语义补充按不确定项类型拆分 Prompt，每次只解决一个明确问题；推荐最大输出 `800～1200 tokens`、单次超时 `30～45 秒`、网络重试最多 `1` 次、并发最多 `3`。禁止 Agent 继承全局 `60000` 作为输出上限。

Agent 输入使用固定 `ContextEnvelope`，只包含任务问题、文档摘要/分类/关键词、当前标题路径、相邻处理单元摘要、直接证据片段、候选和冲突，不重复传入无关完整文档。正文证据视为不可信数据并使用边界标签隔离。模型结果必须经过代码执行 Schema、原文证据、偏移、候选实体和关系端点校验后才能进入最终知识；模型不能直接写入图谱。

## 三、产物和图谱契约

```text
{dataRoot}/training-runs/{taskId}/
├── run-manifest.json
├── events.jsonl
├── metadata/documents.jsonl
├── metadata/chunks.jsonl
├── rule-results/document-summary.jsonl
├── rule-results/knowledge-extraction.jsonl
├── uncertain-items/pending.jsonl
├── uncertain-items/resolved.jsonl
├── model-results/semantic-resolution.jsonl
├── final-results/knowledge.jsonl
├── graph/nodes.json
├── graph/edges.json
├── quality/issues.json
└── run-report.json
```

节点至少包含 `id/type/name/properties/sourceResourceId/chunkId`。边至少包含 `id/type/source/target/sourceResourceId/chunkId/evidenceText/evidenceOffsets/confidence`。

无 `sourceResourceId/chunkId/evidenceText` 的模型关系不能进入图谱，只进入质量问题。YashanDB 错误码实体必须匹配 `YAS-`；`ORA-` 只能标记为 Oracle 错误码或外部实体。公开 API 不返回服务器绝对路径。

## 四、前端加工工作台

加工任务页不显示模型配置，也不新增独立“模型运行”页面。用户点击开始时，后端自动继承 YashanDB 知识库文档生成器配置；相同配置可复用最近 10 分钟内的结构化连接测试结果，随后返回文档数、分块数、预计语义补充项、预计调用量、耗时区间和风险，由用户确认后启动。

加工任务页采用紧凑三栏布局：左侧显示源文件及每个文件的处理状态，中间显示六步骤流水线，右侧显示实时活动。步骤行默认折叠，运行中和失败步骤自动展开，展示处理量、规则确定项、语义补充项、质量问题、耗时和当前对象；失败详情按需展开。状态统一显示为中文，英文状态仅作为接口值。

页面刷新后恢复当前批次最近一次训练任务及历史日志。运行中通过 SSE 更新，断线时显示连接状态并自动轮询。质量页在真实图谱存在后展示摘要、节点样例和带证据的关系样例，不伪造覆盖率或检索命中率。

## 五、验收标准

1. 通过上传 API 建立至少一个包含 Markdown 的 MaterialBatch；
2. 通过真实 FastAPI `POST /api/training/tasks` 启动任务；
3. 模型调用经过 `agent-runner` 当前保存的模型配置；
4. 任务 API 和 SSE 可观察阶段进度及失败信息；
5. 生成 `nodes.json`、`edges.json` 和 `run-report.json`；
6. 模型关系具有来源资源、块和证据文本；
7. 前端显示真实节点数、关系数和关系样例；
8. 自动化测试覆盖网关鉴权、任务状态、图谱接口和失败降级；
9. 使用真实后端 API 完成一次系统测试并形成报告。
10. 未通过最近一次结构化模型测试时，前端和后端都不能启动加工任务；
11. 知识提取和语义补充的每次 Agent 调用必须关联唯一任务或不确定项 ID；
12. Agent 输入不包含无关完整文档，短文档作为单一处理单元时除外；
13. 图谱只读取 `final-results/knowledge.jsonl`，不读取未经代码校验的模型原始输出；
14. 缺少置信度不能按 `1.0` 处理，语义补充结果必须真实影响最终知识和图谱。

## 六、现有试验实现状态

现有代码曾按五阶段进行试验性实现，与本六步骤基线不完全一致，不能作为最终验收结果：

- 元数据构建仍与资料预处理、知识提取混在同一服务函数中；
- 知识校验、图谱构建和数据集登记尚未按步骤边界拆开；
- 旧流水线兼容代码仍存在，Skill 命名和职责尚未完成版本化迁移；
- 真实不确定项模型测试出现约 60 秒等待后失败，超时边界尚未验收；
- 前端仍需按照六步骤重新设计状态和确认弹窗。

后续必须按六步骤逐步实施：先固定接口和产物契约，再逐步骤开发和真实 API 验收，不能继续在现有试验函数上叠加功能。

## 七、明确的后续质量任务

- `JsonStore + Thread` 不支持可靠重启恢复、租约和多实例并发；
- PDF、Office 转 Markdown 的转换保真度、来源映射和乱码、文件名错乱仍需增强；
- 重复文件、来源路径缺失、标题、表格、代码块和相邻上下文可能丢失；
- 文档摘要、面包屑和适用版本上下文传递仍需优化；
- 实体/关系类型、别名、同义词、大小写和版本去重规则不完整；
- 证据偏移需增加本地原文回查校正；
- 参数、错误码、对象、版本等 YashanDB 领域规则需扩充；
- 幻觉、无效 JSON、低置信度结果需修复重试和人工复核；
- 节点数和边数不代表正确性，需要标注集和固定检索问题集；
- Hash Embedding 不是语义向量，本期不作为语义质量成果；
- 增量更新、删除传播、孤儿清理和正式数据集发布尚未实现；
- Provider 超时、限流、重试、熔断、成本审计和权限仍需完善。
