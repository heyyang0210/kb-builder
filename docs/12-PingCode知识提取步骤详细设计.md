# PingCode 知识提取步骤详细设计

> 版本：v1.0
> 上位设计：`docs/08-pingcode-processing-six-step-pipeline-design.md`

## 一、范围与职责

知识提取是第三个前端步骤。默认质量分析任务执行 `keyword_analysis`，由代码调用独立 `keyword-extraction` Skill 只生成关键词候选；正式知识构建任务执行 `formal_knowledge`，由代码调用专用 `KnowledgeExtractionAgent` 生成第一版知识点候选。实体和关系属于后续独立任务。该 Agent 面向知识库提取，参考 Dify 等开源工作流的结构化输出、技能编排、上下文边界和调用可观测设计，但不控制流水线。

代码负责输入范围、锚点预识别、任务拆分、Skill/Agent 调用、超时重试、输出 Schema 校验和落盘。`keyword_analysis` 只允许输出关键词候选，不写 `knowledge-candidates.jsonl`；`formal_knowledge` 第一版只在受控处理单元中提取知识点候选。Agent 不读取完整批次、不直接写文件或图谱。

## 二、关键词默认档与正式知识构建分层

`POST /api/training/tasks` 默认 `mode=keyword_analysis`。该模式输入由清洗后的文档名称、原始标题、摘要、章节标题、正文处理单元和已命中的数据库领域术语组成；输出只包含 `keywordCandidates`。模型不得在该模式输出 `KnowledgePoint`、实体或关系，也不得生成最终知识文件。

正式知识构建作为后置显式动作执行，`mode=formal_knowledge`。它必须以质量分析页应用后的关键词过滤决策为输入边界，默认只读取 `admissionStatus=admitted` 的关键词及其关联文档块；`admissionStatus=excluded` 的关键词不进入正式知识构建。正式知识输出需要保留关键词上下文，便于回查“哪个关键词触发了哪些知识点、实体和关系”。

正式知识构建的任务生命周期由训练服务控制，Workflow Agent 只负责在受控上下文中执行提取，不负责决定任务终态。Agent 内部模型调用必须接入训练任务的超时、取消、事件和审计契约：每次调用开始前写入 `model_call.started`，并携带 `taskId/stageRunId/agentTaskId/modelCallId/resourceId/chunkId 或 batchIndex/timeoutMs`；成功写入 `model_call.completed`，失败或超时写入 `model_call.failed` 和 `quality/extraction-issues.json`。用户取消后，Agent 必须在 batch 提交前、模型调用前后和结果聚合前检查取消状态，保证取消请求可以在 30 秒内进入 `cancelled` 或可解释的 `failed` 终态。后端启动、训练任务查询和创建任务前必须执行中断恢复，清理不属于当前进程活跃任务的僵尸 `activeTaskIds`。

### 2.1 默认规则任务的模型边界

主页“开始知识加工”默认创建 `mode=keyword_analysis`。该模式是纯确定性规则任务：界面展示、预检、启动和运行均不得读取模型配置、模型测试结果、模型状态或模型网关，亦不得发起模型调用。规则只基于已准备的资料、标题和章节结构、正文逐字证据、明确锚点及领域词典命中生成 `keywordCandidates`；证据不足时写中文质量提示，不以模型补救。

`keyword_analysis` 的预检响应必须固定为 `totalModelCalls=0`、`modelTestPassed=null`；`canStart` 仅取决于批次状态与可处理资料是否存在。`start()` 不得执行 `require_model_test()`。因此模型服务 HTTP 502、未配置或连接异常不得阻断规则任务的创建、运行或终态，运行报告的模型成功、失败和跳过统计均为零。

`formal_knowledge` 是独立的模型任务，保持既有模型配置读取、有效模型测试门禁、模型调用事件和失败分类；不得因默认规则任务免模型而放宽该模式的模型测试要求。

### 2.2 TASK-P0-02 最小正式知识抽取契约

`formal_knowledge` 的第一版只生成 `knowledge_point` 候选。Workflow Agent 的一个工作项固定对应一个 `chunk`，不得将多个 chunk 合并到同一次模型请求；不执行跨 chunk 关系识别、实体抽取、关系抽取、关键词候选生成或 `needs_enrichment` 路由。实体和关系属于后续独立任务，不得作为本版本输出的隐式副作用。

单元成功时，训练服务将已校验的知识点写入 `extraction-results/knowledge-candidates.jsonl`；每项至少包含 `candidateId`、`taskId`、`stageRunId`、`state=agent_resolved`、`kind=knowledge_point`、`keywordIds`、`keywordContext`、`chunkId`、`resourceId`、`sourceResourceId`、`sourcePath`、`evidenceText`、`evidenceOffsets` 和 `confidence`。`keywordIds/keywordContext` 必须按 `keywordId` 去重并稳定排序。模型工作项无论成功或失败均写入 `model-results/knowledge-extraction-batches.jsonl`。单元失败只写中文 `quality/extraction-issues.json` 问题并继续其他 chunk，不得终止同一正式知识任务。失败分类固定为 `KNOWLEDGE_EXTRACTION_TIMEOUT`、`KNOWLEDGE_EXTRACTION_SCHEMA_INVALID`、`KNOWLEDGE_EXTRACTION_EMPTY_RESULT`、`KNOWLEDGE_EXTRACTION_FAILED`。

进度以处理单元终态为准：每个 chunk 只在成功或不可恢复失败后递增一次，失败同样计入已处理。每个模型调用事件和批次审计必须携带 `taskId`、`stageRunId`、`agentTaskId`、`chunkId`、`modelCallId`；`timeoutMs` 和重试次数只读取 `knowledge-point-extraction/skill.yaml` 的 defaults。

`knowledge-point-extraction` Skill 的 `timeoutMs/maxTokens/maxRetries/concurrency/batchSize` 是正式知识构建的运行时契约。Python 模型网关的 HTTP 等待上限必须由 `timeoutMs` 推导，不能再使用全局默认超时时间覆盖 Skill timeout；否则即使 Skill 声明 60 秒超时，任务仍可能被全局 180 秒连接等待拖住。

关键词抽取语义边界：

- 文档名称是候选来源，但必须先使用元数据阶段的 `semanticTitle` 去除 `YashanDB`、`DSI`、副本编号、文件后缀和命名噪声，再抽取实际主题子串；
- 正文关键词必须来自处理单元正文、摘要或章节标题中的主要描述内容，并提供逐字证据；
- 数据库领域词典用于 canonical 名称、稳定 `termId` 和别名归并，不再作为唯一准入白名单；
- 技术 ID、图片路径、完整文件名和普通下划线标识不得进入关键词候选。

### 2.2 关键词默认档性能策略

质量分析的主要职责是建立“已证实的主题关键词 -> 文档块证据”基础层，而不是对每个文档提前生成完整知识。因此关键词默认档采用以下分级策略：

1. 确定性优先：先使用 `semanticTitle`、章节路径、正文命中和领域词典生成候选。只有标题主题清晰、标题命中词典术语且同一术语在章节或正文中有证据时，才直接写入候选并跳过该文档的模型调用。完整标题仍只作为来源信息，不能直接成为关键词。
2. 模型补充：标题不明确、存在多个独立主题、标题与正文主题不一致，或需要发现词典外专业术语时，才调用 `keyword-extraction`。调用时传入已确认的确定性主题，模型只补充缺失主题，不重复输出已有候选。
3. 降级保留：超时、格式错误或局部结果缺失时，不丢弃已确认的确定性候选；受影响处理单元记录为待确认质量提示，不重跑已经成功的处理单元。

该策略不把词典作为关键词准入白名单。词典提供稳定 `termId`、canonical 名和别名归并；有原文证据的模型主题词即使未收录，也可以进入候选。

### 2.3 动态组批与局部修复

关键词模型请求按输入字符预算动态组批，而不是按单一 `resourceId` 固定分组。短文档可与其他短文档同批；每个 chunk 在请求中都必须携带自己的文档上下文（语义标题、摘要、章节路径、领域术语、来源 ID），输出仍以 `chunkId` 对应。

Skill 的受控默认参数定义在 `keyword-extraction/skill.yaml`，包括最大输入字符数、单批最大 chunk 数、每个 chunk 最大关键词数、修复次数、慢响应阈值和并发数。关键词默认档只传递主题判定所需字段，避免重复传入完整元数据。调度器根据已观测的慢响应降低后续波次的并发，防止多个接近超时的请求相互拥塞。

模型响应按 chunk 独立校验。批次中已通过的 chunk 立即保存；只有缺少 `chunkId`、候选字段不完整或证据不合规的 chunk 才会以单 chunk 上下文进行一次定向修复。不得因为一个 chunk 的 Schema 问题重新调用整批请求，也不得把格式错误静默计为成功。

### 2.4 增量候选缓存与正式知识输入边界

关键词候选缓存是可复用的中间产物，缓存键由以下字段组成：

```text
contentHash + semanticTitle + metadataRuleSetHash + skillVersion + promptHash
```

其中 `contentHash` 是当前处理单元正文哈希，`promptHash` 包含已发布的 system/user prompt 哈希。正文、语义标题、元数据规则、Skill 版本或 Prompt 任一变化时缓存失效；命中时直接复用已校验的原始模型候选、别名、证据和置信度，并重新写入本次任务的候选 ID 与来源记录。运行报告必须记录命中、未命中和失效原因。

图谱生成阶段同时写入 `keyword-chunk-index.json`，物化 `keywordId -> chunkIds` 和 `chunkId -> keywordIds`。关键词过滤决策、别名归并和图谱修复都复用既有候选与证据，不重新调用模型。`formal_knowledge` 先读取该索引，仅调度 `admissionStatus=admitted` 关键词关联的最小 chunk 集合；一个 chunk 命中多个保留关键词时只提取一次，并向正式知识结果回写全部 `keywordIds`。正式任务启动后必须写入 `extraction-results/formal-knowledge-input.json`，记录来源数据集、保留与排除关键词、实际调度 chunk、`chunkKeywordMap` 和去重统计，用于审计关键词过滤决策如何影响正式构建输入。历史 `approvalStatus`、`businessStatus` 仅允许在旧产物迁移时兼容读取，不参与新任务准入计算，也不由新流程写入。

### 2.5 正式构建前关键词智能过滤

快速加工得到的关键词在进入正式知识构建前，通过关键词智能过滤 Skill 生成保留或排除建议。预览和 SSE 分析均为只读操作；用户执行“应用决策”后，后端只把最终结果写入关键词节点的 `admissionStatus`。

有效状态固定为：

- `admitted`：保留并进入正式知识构建；
- `excluded`：排除，不进入正式知识构建，但完整产物仍保留该节点及证据用于内部审计。

质量分析页只展示“过滤前关键词、过滤后关键词、保留关键词、排除关键词”四项统计，且必须满足 `过滤前关键词 = 保留关键词 + 排除关键词`、`过滤后关键词 = 保留关键词`。应用决策不重跑关键词抽取，也不重建 `keyword-chunk-index.json`；展示图谱仅投影 `admitted` 关键词及两端均可见的边，完整图谱产物继续用于内部审计。

非流式预览和 SSE 分析必须从同一模型配置来源读取模型、温度、超时和 Skill 参数，禁止任一路径硬编码模型名称。两条路径对同一输入和同一模型响应必须产生一致的关键词集合、决策统计和状态语义。

## 三、Knowledge Extraction Skill 设计

### 3.1 设计结论

采用“一个通用知识提取 Skill + 多个文档类型 Profile”的方案，不为每种文档复制一套完整 Skill。通用 Skill 负责统一的证据、输出、边界和安全约束；Profile 负责不同文档类型的提取重点、术语提示和关系优先级。

这样可以避免四套 Skill 重复维护、输出 Schema 不一致和同一实体定义漂移。只有当某类文档需要完全不同的工具链或输出结构时，才拆分为独立 Skill。

### 2.2 Skill 目录与版本

目标目录：

```text
scripts/pingcode/processing/skills/knowledge-extraction/
├── SKILL.md
├── skill.yaml
├── prompts/
│   ├── system.md
│   ├── user.md
│   └── profiles/
│       ├── feature-design.md
│       ├── test-design.md
│       ├── principle-introduction.md
│       └── problem-analysis.md
├── profiles/
│   ├── feature-design.yaml
│   ├── test-design.yaml
│   ├── principle-introduction.yaml
│   └── problem-analysis.yaml
└── schemas/
    ├── input.schema.json
    └── output.schema.json
```

`skill.yaml` 必须声明 Skill 版本、输入/输出 Schema、支持的文档类型、默认模型参数、失败回退策略和兼容的 Schema 版本。Profile 不能绕过通用输出 Schema，也不能改变证据必填规则。

### 2.3 通用 Skill 职责

通用 `knowledge-extraction` Skill 向 Agent 提供：

- 处理单元边界和上下文使用规则；
- 知识点、实体、关系和证据的统一输出格式；
- 文档类型 Profile 选择规则；
- 原文证据优先、禁止常识补全和禁止幻觉的约束；
- 不确定项标记规则；
- JSON Schema 输出要求；
- YashanDB 领域上下文的注入位置和长度边界；
- 无法判断时输出 `needs_enrichment` 或 `human_required` 的规则。

Skill 不负责流水线调度、文件写入、重试、证据偏移校正和图谱构建，这些由代码完成。

### 2.4 文档类型 Profile

代码先根据来源元数据、标题、目录和结构特征选择 Profile；无法确定时使用 `general-technical`，不调用额外模型进行分类。

| Profile | 重点提取内容 | 重点关系 |
|---|---|---|
| `feature-design` | 背景、目标、功能、配置、限制、兼容性、变更影响 | 包含、依赖、影响、兼容、替代 |
| `test-design` | 测试对象、前置条件、步骤、预期结果、异常场景 | 验证、覆盖、依赖、触发、预期 |
| `principle-introduction` | 概念、组件、流程、机制、依赖、边界 | 组成、属于、依赖、调用、影响 |
| `problem-analysis` | 现象、原因、影响、定位方法、解决方案、规避措施 | 导致、表现为、解决、影响、规避 |
| `general-technical` | 文档明确表达的知识点、实体、关系和限制 | 使用已发布 Schema 的通用关系 |

Profile 只改变提取重点，不允许模型根据文档类型推断原文没有表达的事实。

### 2.5 Skill 输入输出契约

代码传给 Skill 的输入至少包含：`documentType`、`extractionProfile`、`domain`、`domainContextVersion`、当前处理单元、标题路径、代码锚点、相邻摘要、已发布 Schema 版本和输出约束。

Skill 输出必须包含：知识点、实体、关系、证据文本、证据偏移、候选状态、Profile、Skill/Prompt/Agent/Schema 版本和不确定项原因。Skill 返回的内容仍必须经过代码 Schema 和证据校验。

### 2.6 Skill 与 Agent 的关系

```text
代码选择 documentType
  -> ExtractionProfileSelector 选择 Profile
  -> Agent 装载通用 Skill + Profile Prompt + YashanDB 领域上下文
  -> 大模型生成结构化结果
  -> 代码校验、路由和落盘
```

现有 `knowledge-extraction` Skill 若仍只描述语义补充，应迁移为 `semantic-enrichment` Skill；不能让同一个 Skill ID 同时表示“全量知识提取”和“单项语义补充”。

### 2.7 Skill 幂等与发布

Skill、Profile、Prompt、领域上下文和 Schema 版本写入候选记录。相同输入哈希和版本集合不得重复调用；任一版本变化都必须产生新的调用和产物。Registry 只允许使用已发布版本，草稿不能进入正式流水线。

## 三、YashanDB 数据库领域 Agent 设计

### 3.1 专用特性定位

`KnowledgeExtractionAgent` 不是把通用文档抽取 Agent 改名，而是“通用知识提取 Skill + YashanDB 领域上下文 + 代码领域校验”的组合。大模型负责语言语义理解，代码负责数据库格式、类型和证据约束。

### 3.2 领域实体类型

初始 Schema 至少覆盖：产品、产品版本、数据库实例、集群、节点、模块、存储引擎、参数、配置项、错误码、SQL 对象、表、索引、视图、分区、函数、存储过程、权限、用户、角色、事务、锁、执行计划、命令和工具。

类型必须允许属性约束，例如参数的默认值、单位、取值范围、生效方式和适用版本；错误码的错误号、产品域和处理建议；SQL 对象的对象类型和所属模块。

### 3.3 领域关系类型

初始关系至少覆盖：属于、包含、依赖、配置、影响、适用于、兼容、替代、导致、解决、限制、引用、调用、继承、部署于和运行于。每个关系必须定义方向、源类型、目标类型和允许证据句式。

例如：

```text
参数 --影响--> 执行计划
错误码 --解决--> 处理方案
索引 --属于--> 数据表
功能 --适用于--> 产品版本
```

### 3.4 领域识别约束

- `YAS-xxxxx` 与 `ORA-xxxxx` 必须分属不同错误码域，不能默认合并；
- 参数名、错误码和数据库对象名优先保留原始大小写；
- 版本号必须绑定产品、模块或来源文档，不能单独生成适用版本事实；
- 配置值必须保留数值、单位、默认值和原始表示；
- SQL 关键字不能无条件识别为实体；
- 同名对象必须结合模块、版本和来源处理；
- 不得根据数据库常识补全文档未表达的事实；
- 关系必须符合 Schema 的源类型、目标类型和方向约束。

### 3.5 领域词典和上下文裁剪

领域上下文来自版本化资源：

```text
YashanDB 产品词典
错误码词典
参数和配置项词典
SQL 对象词典
版本词典
模块词典
别名和兼容名称词典
Knowledge Schema
```

代码只选择当前处理单元命中的词典项、相关别名和相邻版本信息，不把完整词典发送给模型。上下文必须记录 `domainContextVersion` 和命中项 ID，便于重现和失效判断。

### 3.6 代码领域校验

步骤三代码至少执行：

```text
YAS/ORA 错误码格式校验
参数命名和配置值校验
版本格式及绑定关系校验
SQL 对象类型校验
实体类型兼容校验
关系源/目标类型校验
证据文本和偏移回查
PDF/Office 来源映射回查
```

模型只能提出候选，不能绕过这些校验直接形成正式知识。

## 四、Agent 与 Schema 自动发布

```text
KnowledgeExtractionStage（代码）
  -> ExtractionTaskFactory（代码）
  -> KnowledgeExtractionAgent(Prompt + Skill + ContextEnvelope)
  -> Model Gateway
  <- AgentResult
  -> 代码 Schema/证据校验
```

`KnowledgeSchemaDiscoveryAgent` 从代表性文档样本发现实体和关系类型，代码自动完成 JSON Schema 校验、命名规范化、去重、冲突检测和版本发布，不进行人工逐篇审核：

```text
选择样本 -> SchemaDiscoveryAgent -> 自动校验/合并/过滤 -> 自动发布新版本
```

类型必须包含唯一 ID、中文名称、定义、属性、适用范围、正例和反例；关系必须包含源类型、目标类型和方向。冲突候选不覆盖已发布版本，记录 `schema_unresolved`；运行固定使用一个 Schema 版本。

## 五、输入与输出

输入为步骤一、二的处理单元和元数据、明确锚点识别器、已发布 Schema、Prompt/Skill Registry 和模型测试结果。每个 Agent 任务只处理一个处理单元，禁止传入无关完整文档、认证信息和完整 Prompt。明确锚点包括 `YAS-xxxxx`、`ORA-xxxxx`、版本号、参数、配置项、SQL 对象和显式关系触发词。

### 5.1 `KnowledgeExtractionContextEnvelope`

```json
{
  "taskId": "training_xxx",
  "resourceId": "resource_xxx",
  "chunkId": "resource_xxx:0",
  "documentType": "feature_design",
  "extractionProfile": "feature-design",
  "domain": "yashandb",
  "domainContextVersion": "yashandb-domain:1.0.0",
  "domainContextHits": ["parameter:max_connections", "module:optimizer"],
  "document": {
    "title": "优化器参数特性设计",
    "category": "特性设计",
    "applicableVersions": ["23.2.4"]
  },
  "currentChunk": {
    "headingPath": ["方案设计", "参数影响"],
    "content": "max_connections 会影响优化器资源估算。",
    "normalizedOffsets": {"start": 120, "end": 158}
  },
  "explicitAnchors": [
    {"value": "max_connections", "candidateType": "Parameter"}
  ],
  "schemaVersion": "2.0.0",
  "constraints": {
    "evidenceRequired": true,
    "allowSchemaCandidate": true,
    "allowNeedsEnrichment": true
  }
}
```

### 5.2 知识候选

`extraction-results/knowledge-candidates.jsonl`：

```json
{
  "candidateId": "candidate_xxx",
  "state": "agent_resolved",
  "taskId": "training_xxx",
  "stageRunId": "stage-run_xxx",
  "agentTaskId": "knowledge_point_xxx",
  "modelCallId": "model_call_xxx",
  "kind": "knowledge_point",
  "resourceId": "resource_xxx",
  "sourceResourceId": "resource_xxx",
  "chunkId": "resource_xxx:0",
  "sourcePath": "事务.md",
  "keywordIds": ["keyword:transaction"],
  "keywordContext": [
    {"keywordId": "keyword:transaction", "canonicalName": "事务", "aliases": []}
  ],
  "value": {
    "title": "事务提交",
    "statement": "事务提交需要写入 REDO 日志。",
    "knowledgeType": "technical_fact"
  },
  "evidenceText": "事务提交需要写入 REDO 日志。",
  "evidenceOffsets": {"start": 120, "end": 158},
  "sourceMethod": "knowledge_extraction_workflow_agent",
  "schemaVersion": "2.0.0",
  "inputHash": "sha256:xxx",
  "confidence": 0.86
}
```

`formal_knowledge` 任务还必须写入 `extraction-results/formal-knowledge-input.json`，用于审计本次正式构建的输入边界：

```json
{
  "sourceDatasetId": "dataset_xxx",
  "acceptedKeywordIds": ["keyword:transaction", "keyword:redo"],
  "rejectedKeywordIds": ["keyword:rejected"],
  "scheduledChunkIds": ["resource_xxx:0"],
  "chunkKeywordMap": {
    "resource_xxx:0": ["keyword:redo", "keyword:transaction"]
  },
  "filteredKeywordCount": 1,
  "deduplicatedChunkCount": 1
}
```

同一处理单元关联多个已确认关键词时，只创建一个 Agent 工作项；候选中的 `keywordIds` 和 `keywordContext` 按 `keywordId` 去重并稳定排序。`rejected` 关键词不得出现在输入计划、Prompt envelope、候选或最终知识结果中。

### 5.3 不确定项

`uncertain-items/pending.jsonl` 使用 `state=needs_enrichment`，每条只描述一个问题，并关联候选、证据、处理单元和输入哈希。

### 5.4 文档类型选择结果

代码将文档类型选择结果写入 `extraction-results/document-profiles.jsonl`，至少包含 `resourceId`、`documentType`、`extractionProfile`、匹配规则、规则版本和输入哈希。无法确定时记录 `general_technical_fallback` 质量提示，不阻塞提取。

### 5.5 语义关键词候选

每个处理单元输出 `keywordCandidates`，字段固定为 `name`、`aliases`、`category`、`evidenceSource`、`evidenceText`、`confidence`。`evidenceSource` 仅允许 `title`、`heading`、`content`、`domain_glossary`：标题证据必须逐字存在于 `semanticTitle`，章节和正文证据必须存在于对应输入文本，词典证据必须关联稳定 `termId`。模型结合语义标题、摘要、章节结构、正文主要描述和数据库领域术语判断主题相关度；词典未收录不能成为拒绝理由。校验通过的候选写入 `extraction-results/keyword-candidates.jsonl`，原始批次响应和 Schema 校验结果写入模型结果目录供审计。

## 六、接口、伪代码与事件

```text
interface KnowledgeExtractionStage:
  validate_inputs(context) -> ValidationResult
  execute(context) -> StageResult
  validate_outputs(context, result) -> ValidationResult

execute(context):
  load published schema, prompts, skills and model test result
  verify knowledge-extraction Skill is extraction-capable, not semantic-resolution-only
  classify each document with deterministic DocumentTypeClassifier
  for chunk in processable chunks:
    select extraction Profile from document type
    detect explicit anchors in code
    select bounded YashanDB domain context hits
    build KnowledgeExtractionContextEnvelope with title, semanticTitle, summary, headings, chunks and domainTerms
    call KnowledgeExtractionAgent
    validate JSON, keyword candidates, database constraints, evidence and offsets in code
    route to agent_resolved, needs_enrichment, schema_candidate or human_required
  atomically persist profiles, candidates, pending items and issues
```

事件：`stage.started`、`agent_task.started`、`model_call.started`、`model_call.completed`、`agent_task.completed`、`work_item.failed`、`stage.completed`。记录 Agent、模型、Prompt、Skill、Schema 版本和耗时，不记录密钥、Cookie 或正文全文。

## 七、失败、幂等与验收

### 7.1 失败处理

- 文档类型无法确定：使用 `general-technical` Profile，记录提示，继续处理；
- Profile 缺失或未发布：当前文档转质量问题，不静默使用其他专用 Profile；
- 通用 Skill 未发布、Schema 不兼容或仍是“单项语义补充”旧契约：步骤失败；
- 领域词典单项缺失：减少领域上下文，记录告警，不能伪造命中；
- 单处理单元 Agent 失败：记录问题，继续其他单元；
- 无效 JSON、无证据或违反数据库类型约束：保留审计，转 `human_required` 或拒绝候选；
- 模型返回空对象、缺少 `results`、回显未渲染模板变量或所有候选均无效：记录明确提取问题，不能记为成功；
- Prompt、Skill、Schema 或模型测试整体不可用：步骤失败，不生成伪候选。

### 7.2 幂等与失效

幂等键至少包含：处理单元内容哈希、文档类型、Profile 版本、Skill 版本、Prompt 版本、Agent 版本、模型标识、领域上下文版本和 Schema 版本。完全相同时禁止重复调用；任一版本变化时当前步骤及后续步骤失效。Registry 草稿不能参与幂等键或正式执行。

### 7.3 验收标准

1. 通用 Skill 能使用统一输出 Schema 处理五种 Profile；
2. 特性设计文档可提取功能、配置、限制、兼容性和影响关系；
3. 测试设计文档可提取测试对象、前置条件、步骤和预期结果；
4. 原理介绍可提取组件、流程、机制和依赖；
5. 问题分析可提取现象、原因、定位和解决关系；
6. 无法分类的文档使用 `general-technical`，不调用额外分类模型；
7. `YAS-` 与 `ORA-` 错误码不会被合并；
8. 参数值、单位、默认值和版本绑定能被保留并通过代码校验；
9. SQL 关键字不会无条件成为实体；
10. Agent 结果包含 Skill、Profile、领域上下文和 Schema 版本；
11. 现有语义补充型 Skill 不能冒充全量知识提取 Skill；
12. 真实后端 API 覆盖五种 Profile、Schema 外类型、无证据输出、模型失败、重复执行和审计记录。
13. 即使领域词典缺少条目，也能从标题和主要正文发现 `Replication`、`事务`、`持久化`、`LOB`、`列式存储`；完整文件名和偶然普通词不能成为关键词。

## 八、实施迁移要求

当前仓库中的 `scripts/pingcode/processing/skills/knowledge-extraction/` 若仍以 `uncertainItemId` 为必填输入并只解决单个语义不确定项，则与本设计不兼容。实施时必须：

1. 将旧能力迁移或重命名为 `semantic-enrichment`；
2. 按本设计重建通用 `knowledge-extraction` Skill、Profile 和输入输出 Schema；
3. 保留旧版本只用于历史运行回放，不允许新任务继续引用；
4. 通过 Registry 发布新版本后，再接入 `KnowledgeExtractionStage`；
5. 使用真实模型 API 分别验证五种文档类型，不以 `render_only` 代替真实执行。

## 九、当前实现约束

- 公共阶段 ID 暂时保持 `deterministic_extraction`，兼容现有前端和历史任务；阶段中文名称与内部行为按“知识提取”执行；
- 固定规则只负责文档类型选择、明确锚点识别、领域上下文裁剪和结果校验，不再代替 Agent 完成主要知识抽取；
- 每个可处理单元调用一次 `knowledge-extraction@2.0.0`，失败只隔离当前单元并继续；
- 产物目录统一使用 `extraction-results/`，旧的 `rule-results/knowledge-extraction.jsonl` 不再作为新任务输出；
- `knowledgePoints`、`entities`、`relations` 分别转换为独立候选记录，并补齐来源、偏移、版本和输入哈希；
- 只有 Agent 明确返回的 `needs_enrichment` 进入步骤四；`schema_candidate` 和 `human_required` 只写审计与质量产物；
- 代码校验不通过的知识候选不能进入步骤五，不能因模型置信度较高而绕过证据和数据库领域约束。
- Prompt 统一使用单一 `context_envelope` JSON 变量；运行时发现任何未渲染模板标记即终止当前批次并记录质量问题。
- 模型关键词先校验证据与置信度，再按 `termId -> 词典别名 -> 规范化名称` 归并；词典负责规范化，不作为准入白名单。
- 清洗后的 `semanticTitle` 若与当前文档已命中的领域词条 canonical 名或别名存在逐字匹配，代码补充一条 `domain_glossary` 标题主题候选；该规则只覆盖标题主题，不把正文中偶然命中的全部词典项提升为主关键词，置信度由 `title-cleaning.yaml` 配置。
- 关键词默认档优先读取元数据阶段的 `metadata/preselection-report.json`：`deterministic_ready` 使用确定性候选并跳过模型，`model_required` 才进入 `keyword-extraction` 模型批处理，`human_review/skip` 不调用模型并等待人工确认或后续规则补充；历史运行缺少该报告时回退旧的确定性判断逻辑。
- Agent 批量结果转换为知识候选时，代码必须为知识点、实体和关系统一补齐 `candidateId`、`evidenceOffsets`、`schemaVersion`、来源和置信度；关系集合不得漏写。偏移只能根据原处理单元中的逐字证据计算，无法回查的候选继续拒绝。
- Agent 调用缓存位于运行数据目录的 `processing/agent-cache/knowledge-extraction/`；缓存键包含去除 `taskId` 后的输入、Skill/Prompt/Schema 版本与内容哈希和模型配置指纹，命中时不重复调用模型。
- Schema 校验前由代码规范化无歧义的结构别名，例如 `relationships -> relations`、`sourceEntity -> source`，并删除模型回显的 `taskId/resourceId/chunkId`；Skill、Prompt、Agent 和 Schema 版本由代码权威填写，不能依赖模型生成。
- 对模型常见的 `description` 知识点表示，代码只做结构等价转换：`description -> statement`，从同一陈述截取 `title`，并设置结构类型 `technical_fact`；各集合只保留产物 Schema 声明字段。该处理不补充数据库事实，证据仍须逐字回查，无法满足必填语义的结果继续拒绝。

## 十、单处理单元超时分层诊断设计

### 10.1 目标与边界

知识提取真实调用超时时，必须使用已经落盘的单个处理单元逐层缩小范围，禁止直接通过扩大超时时间掩盖问题。诊断工具是内部命令行工具，不新增公开 API，不修改模型持久化配置，不写入正式候选产物，也不绕过正式 Prompt、Skill 和 Schema。

诊断顺序固定为：

```text
处理单元读取
  -> ContextEnvelope 构造
  -> Prompt 渲染
  -> Python 到 Agent Runner HTTP 调用
  -> Agent Runner 到模型 Provider 调用
  -> 模型返回
  -> JSON 解析
  -> 输出归一化
  -> JSON Schema 校验
  -> 证据回查
```

模型没有返回前发生的超时不能归因为 JSON 解析或 Schema 校验；只有已经记录模型响应后，才允许分析这些后处理阶段。

### 10.2 内部诊断接口

```text
interface KnowledgeExtractionDiagnosticRunner:
  load_case_config(path) -> DiagnosticCaseSet
  load_processing_unit(task_id, chunk_id) -> ProcessingUnit
  build_context_envelope(task_id, processing_unit) -> ContextEnvelope
  render_messages(case, context_envelope) -> ModelMessages
  invoke_gateway(case, messages) -> GatewayResult
  validate_result(case, gateway_result, processing_unit) -> ValidationTrace
  persist_report(report_root, result) -> DiagnosticReport
```

命令行输入至少包含：`taskId`、`chunkId`、诊断用例配置、Agent Runner 地址和输出目录。模型对照通过单次请求的 `options.model` 传递，不能调用模型配置保存接口。

每条诊断记录必须包含：

```json
{
  "diagnosticId": "diagnostic_xxx",
  "modelCallId": "model_call_xxx",
  "caseId": "full-prompt-json-500",
  "taskId": "training_xxx",
  "chunkId": "resource_xxx:0",
  "model": "qwen3.7-plus",
  "responseFormat": "json",
  "maxTokens": 500,
  "timeoutMs": 45000,
  "maxRetries": 0,
  "chunkCharacters": 1085,
  "promptCharacters": 5200,
  "estimatedPromptTokens": 2100,
  "durationMs": 32000,
  "httpStatus": 200,
  "finishReason": "stop",
  "reached": {
    "modelResponse": true,
    "jsonParsing": true,
    "normalization": true,
    "schemaValidation": true,
    "evidenceValidation": true
  }
}
```

模型已经返回但 JSON 解析失败时，网关错误响应必须携带脱敏 `responseMetadata`，只包含响应字符数、Token 用量、`finishReason` 和实际调用次数。诊断器据此将 `modelResponse` 标记为已到达，不能把格式错误继续统计为模型网络超时。

诊断报告不得保存 API Key、Cookie、认证头、完整 Prompt 或完整处理单元正文。只保存内容哈希、字符数、估算 Token、阶段状态、Token 用量和脱敏错误摘要。

### 10.3 用例矩阵

诊断用例由外置 JSON 配置维护，脚本不硬编码 Prompt 和测试参数。标准矩阵包含：

1. 连接测试、短文本响应和最小 JSON 响应；
2. 当前处理单元配合最小提取 Prompt，分别使用文本和 JSON 模式；
3. 当前 System Prompt 配合简化输出契约；
4. 完整 Prompt 配合精简 ContextEnvelope；
5. 完整 Prompt 配合正式 ContextEnvelope；
6. 完整请求分别使用 `200/500/1000/2000` 最大输出 Token；
7. 对首个稳定超时用例使用临时对照模型重复两次。

所有模型调用必须设置 `maxRetries=0`。网络重试由正式 Python 调度器显式执行并生成新的 `modelCallId`；诊断脚本本身不自动重试，避免把两次 45 秒调用误记为一次 90 秒调用。

### 10.4 判定规则

| 结果 | 根因范围 | 应对措施 |
|---|---|---|
| 最小文本和最小 JSON 均超时 | Provider、兼容网关或网络 | 不修改 Skill，输出外部服务诊断结论 |
| 仅 JSON 模式超时 | Provider 原生 `response_format` 兼容性 | 对该模型禁用原生 JSON 模式，保留 JSON 指令、解析和 Schema 校验 |
| 最小 Prompt 成功、完整 Prompt 超时 | Prompt 或 ContextEnvelope 负载 | 删除重复约束并压缩无命中领域上下文，不降低证据和 Schema 要求 |
| 低输出上限成功、高输出上限超时 | 输出预算或生成时延 | 将 Skill 最大输出调整到实测稳定区间，优先采用 `800～1200` Token |
| 当前模型超时、临时对照模型稳定 | 模型特异性问题 | 记录结论和建议，不自动修改生产模型配置 |
| 多模型均间歇超时 | 上游服务波动 | 保持 45 秒单次边界和显式重试追踪，不扩大为不可观测的长等待 |
| 模型已返回但校验失败 | JSON、归一化、Schema 或证据阶段 | 按最后一个成功阶段定位，不归类为网络超时 |

### 10.5 伪代码

```text
load diagnostic cases from JSON
load one persisted processing unit and document metadata
build the same ContextEnvelope used by KnowledgeExtractionStage
for case in selected cases:
  create diagnosticId and modelCallId
  render messages without logging message content
  call /api/model-provider/chat with max_retries = 0
  record HTTP duration and response metadata
  if response exists:
    parse JSON when required
    normalize known aliases and tracing fields
    validate output Schema
    verify evidenceText exists in the processing unit
  persist one sanitized result immediately
aggregate results into JSON and Markdown reports
```

### 10.6 验收标准

1. 可以通过 `taskId/chunkId` 精确加载一个现有处理单元；
2. 每次真实模型尝试具有唯一 `diagnosticId/modelCallId`；
3. Agent Runner 内部重试为零，单次超时不会被合并成约 90 秒等待；
4. 报告能够区分模型返回前和模型返回后的失败；
5. 当前模型配置文件在诊断前后内容哈希一致；
6. 最小处理单元修复后连续成功两次，并通过 JSON、Schema 和证据校验；
7. 使用一个接近 6000 字符的处理单元完成回归；
8. 诊断结果同步写入全链路问题修复报告，不将未验证推断写成已确认根因。

### 10.7 首轮真实诊断结论

对 `training_eab455f5e69e40ec` 的 `83dc61836bc209e77056f0ff:0`（1085 字符）执行首轮矩阵后确认：

- 连接测试 2.5 秒成功，短文本 1.4 秒成功，最小 JSON 3.2 秒成功，基础网络、认证和 JSON 能力可用；
- 同一处理单元的最小文本请求 45 秒超时，但最小 JSON 请求 19.7 秒返回，处理单元内容不是必然超时原因；
- 完整知识提取请求在 200～2000 Token 上限下均未稳定完成，模型返回的实际 Token 达到约 2251～3698，且出现不完整 JSON；
- Agent Runner 在 JSON 解析失败后自动发起修复请求，造成一次业务调用内部包含第二次模型调用，单次等待出现约 55～66 秒，旧路径叠加重试后形成约 90 秒；
- `qwen-plus` 对照请求由上游返回“没有可用通道”，不能作为模型性能对照，且没有修改持久化模型配置。

因此知识提取 Skill 固定关闭 Qwen 思考模式（`enableThinking=false`，同时透传 `chatTemplateKwargs.enable_thinking=false`），并关闭网关隐藏 JSON 修复（`jsonRepair=false`）。顶层参数未改变首轮结果，必须以兼容中转实际接受的参数形式验证；若中转仍忽略该参数，报告必须明确记录。JSON 解析失败直接由 Python 调度器记录为当前处理单元质量问题，后续若需要纠正必须显式生成新的 `modelCallId`，不再把隐式修复调用隐藏在一次请求内。

完整请求还必须从 Skill 的 `defaults.outputLimits` 读取单处理单元输出上限，默认最多输出 4 个知识点、8 个实体、4 个关系和 3 个不确定项，最大输出为 1000 Token。限制目的是阻止模型为覆盖全文生成近义重复项，不改变证据准入、实体类型和关系方向要求；模型仍可少于上限或返回空数组。

## 十一、Phase 2 基础设施依赖边界（2026-08-05）

- 模型 HTTP/SSE 调用已由 `app/gateways/model_gateway.py` 提供的 `ModelGateway` Protocol 和 `HttpModelGatewayAdapter` 承载，同时保留 `ModelGatewayClient` 兼容名称、`ModelGatewayError` 与 `error_summary()`；`utcnow()`、`stable_id()` 仍属于 `TrainingService`，未迁入网关模块。
- 产物文件访问已由 `app/repositories/artifact_repository.py` 提供的 `ArtifactRepository` 和 `LocalArtifactRepository` 承载；`TrainingService` 通过关键字参数注入仓储，并以六个私有方法薄委托保持现有知识提取调用方式。
- 本阶段没有迁移关键词提取、知识点提取、Skill 调用、Workflow Agent 或任务编排逻辑；关键词过滤的现行边界以本文件 2.4、2.5 节和 `docs/20` 顶部 2026-08-05 收敛设计为准。
- 当前远端 HTTP/SSE 错误正文仍沿用旧行为，尚未实现长度截断和敏感字段脱敏；这是剩余安全风险。上文相关约束是后续整改目标，不表示当前代码已经满足。
- Phase 2 聚焦自动化回归 `92/92` 通过；后端全量回归共 223 项，其中 200 项通过、2 项失败、21 项跳过，两项失败分别属于知识点 Skill 错误分类和资料预处理切块算法，不属于本阶段网关与仓储重构范围。
- 真实链路已完成只读验收：健康检查 HTTP 200；`POST /api/training/model-test` 返回 HTTP 200，模型为 `qwen3.7-plus`，耗时 `3163ms`，`schemaPassed=true`；非流式关键词过滤预览返回 HTTP 200，耗时 `58.99s` 并生成 43 条建议；SSE 过滤返回 HTTP 200，耗时 `20.86s`，产生 3 个 `stage`、43 个 `decision`、1 个 `complete` 和 0 个 `error` 事件。
- 为避免修改用户数据，本轮未主动执行 apply 决策接口；真实环境中的审批状态持久化仍需使用隔离数据集补充写入型验收。
- 验收时发现 SSE 路径硬编码 `deepseek-v4-flash-0731`，与非流式路径使用的当前模型不一致，并造成同一批关键词的建议统计不同。现行设计要求两条路径统一读取模型配置；硬编码必须删除并纳入关键词过滤一致性回归。远端错误正文未截断、未脱敏仍作为独立后续整改风险。
- 完整验收命令、接口证据、范围外失败和风险见 [TrainingService Phase 0-2 重构验收报告](../scripts/pingcode/web/backend/tests/test-report-training-service-phase2.md)。
