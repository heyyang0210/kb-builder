# PingCode 知识加工六步骤流水线详细设计

> 版本：v1.0  
> 日期：2026-07-27  
> 状态：实施设计基线，功能代码待按步骤实现  
> 上位设计：`docs/04-pingcode-processing-e2e-framework-design.md`

专项设计：

- `docs/01-PingCode资料预处理步骤详细设计.md`
- `docs/11-PingCode元数据构建步骤详细设计.md`
- `docs/12-PingCode知识提取步骤详细设计.md`
- `docs/13-PingCode按需语义补充步骤详细设计.md`
- `docs/14-PingCode知识校验与合并步骤详细设计.md`
- `docs/15-PingCode图谱与数据集生成步骤详细设计.md`

## 一、设计目标

本设计固定知识加工流水线的六个前端可见步骤，明确每一步的输入、输出、主要功能、执行方、失败处理和落盘产物。

```text
1. 资料预处理
2. 元数据构建
3. 知识提取
4. 按需语义补充
5. 知识校验与合并
6. 图谱与数据集生成
```

核心原则：

1. 六步骤及步骤内的固定流程由代码执行；需要 Skill 和大模型参与时，由代码调用专用 Agent，由 Agent 组装提示词、Skill 和受控上下文后执行；
2. 每一步只读取上一步已经落盘并通过 Schema 校验的产物；
3. 原始资料永久保留，步骤之间传递结构化元数据、候选结果和必要证据片段；处理单元是原文的处理视图，不代表删除或覆盖原文；
4. “不确定项识别”属于第 3 步内部代码路由，不作为独立前端步骤；
5. 模型输出不能直接进入图谱，必须经过第 5 步代码校验；
6. 第 6 步只读取 `final-results/knowledge.jsonl` 构建图谱；
7. 任何失败、跳过和降级都必须生成中文说明和可追溯事件。

## 二、总体数据流

```text
MaterialBatch
  │
  ▼
资料预处理
  ├─ metadata/source-documents.jsonl
  ├─ metadata/chunks.jsonl
  └─ quality/preparation-issues.json
  │
  ▼
元数据构建
  ├─ metadata/documents.jsonl
  └─ metadata/chunk-contexts.jsonl
  │
  ▼
知识提取
  ├─ extraction-results/knowledge-candidates.jsonl
  ├─ uncertain-items/pending.jsonl
  └─ quality/extraction-issues.json
  │
  ▼
按需语义补充
  ├─ model-results/semantic-resolution.jsonl
  ├─ uncertain-items/resolved.jsonl
  └─ quality/semantic-issues.json
  │
  ▼
知识校验与合并
  ├─ final-results/knowledge.jsonl
  ├─ final-results/rejected.jsonl
  └─ quality/issues.json
  │
  ▼
图谱与数据集生成
  ├─ graph/nodes.json
  ├─ graph/edges.json
  ├─ dataset/manifest.json
  └─ run-report.json
```

## 三、公共运行契约

### 3.1 运行上下文 `PipelineRunContext`

每一步接收同一个只读运行上下文，不通过全局变量隐式传递状态。

```json
{
  "taskId": "training_xxx",
  "batchId": "batch_xxx",
  "datasetId": "dataset_xxx",
  "pipelineVersion": "2.0",
  "config": {
    "preset": "training_standard",
    "segmentationStrategy": "structure_first",
    "maxUnitCharacters": 6000,
    "boundaryContextMode": "metadata",
    "fallbackOverlapCharacters": 0
  },
  "runRoot": "training-runs/training_xxx",
  "createdAt": "2026-07-27T10:00:00+08:00"
}
```

约束：

- `runRoot` 对外只返回相对路径；
- 模型密钥、Cookie、认证头不得进入运行上下文；
- `pipelineVersion` 用于识别产物契约，禁止用同一版本静默改变字段含义；
- 每个输入文件和产物记录必须包含稳定标识和内容哈希。

### 3.2 公共步骤结果 `StageResult`

```json
{
  "stage": "metadata_construction",
  "state": "completed",
  "inputCount": 42,
  "outputCount": 42,
  "failedCount": 0,
  "skippedCount": 0,
  "startedAt": "2026-07-27T10:01:00+08:00",
  "completedAt": "2026-07-27T10:01:12+08:00",
  "durationMs": 12000,
  "message": "元数据构建完成：42 篇文档",
  "artifacts": ["metadata/documents.jsonl"],
  "metrics": {}
}
```

步骤状态只使用：

```text
pending / running / completed / skipped / failed / cancelled
```

`skipped` 和 `failed` 必须包含中文 `message`，不得只返回状态码。

### 3.3 证据契约

所有进入最终知识的知识点、实体和关系必须包含：

```json
{
  "sourceResourceId": "resource_xxx",
  "chunkId": "resource_xxx:0",
  "sourcePath": "docs/error-code.md",
  "evidenceText": "YAS-00001 表示参数 p_size 无效。",
  "evidenceOffsets": {
    "start": 120,
    "end": 145
  }
}
```

证据文本必须能在对应处理单元原文中精确回查。无法回查的结果不能进入 `final-results/knowledge.jsonl`。

### 3.4 原文保留与处理单元

资料处理不得以“分块”作为删除原文的理由。运行产物至少区分三层内容：

```text
originalContent       原始文件内容，永久保留，只读
normalizedContent     编码、换行和 Unicode 规范化后的内容
processingUnits       面向提取的结构化处理单元
```

处理单元采用“结构优先、必要时再切分”的策略：

- 短文档可以整篇作为一个处理单元；
- 标题、段落、表格、列表和保留的非 C/C++ 代码块优先保持完整；C/C++ 代码块仅从加工视图排除，原始层永久保留；
- 超过 `maxUnitCharacters` 的结构块才按边界二次切分；
- 默认不强制重叠，跨单元上下文通过标题路径、相邻单元摘要和引用关系传递；
- 只有在结构无法安全切分时才使用 `fallbackOverlapCharacters`，且必须记录重叠来源和偏移；
- 被判定为导航、重复页脚等非正文内容时，不得静默删除，必须记录排除原因和原文偏移。

### 3.5 代码、Agent、Skill 与模型的职责边界

流水线不是 Skill 驱动，而是代码驱动：

```text
PipelineScheduler（代码）
  -> PipelineStage（代码）
     -> 必要时创建 AgentTask（代码）
        -> 专用 Agent 加载 Prompt + Skill + ContextEnvelope
           -> 调用大模型
        <- AgentResult
     -> 代码校验、落盘、事件和状态迁移
```

职责固定如下：

- 代码：决定步骤顺序、输入范围、是否调用 Agent、超时重试、Schema 校验、证据校验、落盘和恢复；
- 专用 Agent：针对一个明确任务组织提示词、Skill 和上下文，并把模型结果转换为约定结构；
- Skill：提供 Agent 执行任务所需的方法、领域说明、工具使用方式和输出约束，不承担步骤调度；
- 大模型：完成需要语义理解的提取、类型候选发现、指代消解和关系判断；
- 前端：只展示一个知识加工任务及其六个稳定步骤，不展示独立资料预处理任务，也不展示 Agent 或 Skill 为额外流水线步骤；源文件检查和加工预览属于启动前检查，不生成第二条正式产物链。

## 四、步骤一：资料预处理

### 4.1 步骤标识

```text
material_preparation
```

### 4.2 执行方

资源预处理阶段包含清洗、低成本初筛、embedding 生成和聚类报告四类确定性或可降级工作。embedding/cluster 在 `preselection-report.json` 完成后执行，写入 `metadata/embedding-index.jsonl` 与 `metadata/cluster-report.json`；失败只写 `quality/embedding-issues.json` 或 `quality/cluster-issues.json`，后续关键词默认档继续执行。

仅代码执行，不调用大模型。

### 4.3 输入

| 输入 | 来源 | 必填 | 说明 |
|---|---|---|---|
| `MaterialBatch` | 素材批次服务 | 是 | 批次、来源类型、资源清单和逻辑路径 |
| 原始资源文件 | 下载目录或上传目录 | 是 | 已下载的 Markdown、文本、Office 和 PDF；图片/附件仅作为已下载关联资源校验 |
| `PreprocessConfig` | 任务请求 | 是 | 清洗预设、结构化处理单元上限和边界策略 |
| 文件格式策略 | 服务配置 | 是 | 可处理、待转换、隔离和忽略规则 |

### 4.4 主要功能

1. 扫描批次资源，校验文件存在性、大小、编码、来源路径和上游登记哈希；
2. 识别空文件、重复文件、乱码、不可支持格式和危险文件；
3. 将 Office 和可提取文本 PDF 转换为统一 Markdown，扫描型 PDF 标记为 `ocr_required`，不自动 OCR；
4. 执行编码、换行和 Unicode 规范化，从加工视图排除 C/C++ 围栏代码块，并保留原始文件、排除偏移和来源映射；
5. 保留并校验图片、附件的批次内相对引用，不在本步骤重新下载或识别类型；
6. 解析 Markdown 标题层级和结构块；
7. 按结构优先策略生成处理单元，默认上限 6000 字符，超长结构块才执行二次切分；
8. 记录处理单元在规范化正文中的字符偏移、内容哈希，以及 PDF 页码、Office 段落/表格/单元格等原始位置；
9. 生成准备阶段质量问题，不做知识判断。

### 4.5 输出

#### `metadata/source-documents.jsonl`

```json
{
  "resourceId": "resource_xxx",
  "sourcePath": "docs/error-code.md",
  "fileName": "error-code.md",
  "mediaType": "text/markdown",
  "sourceType": "pingcode",
  "contentHash": "sha256:...",
  "originalContentArtifact": "originals/resource_xxx.md",
  "normalizedContentArtifact": "normalized/resource_xxx.md",
  "originalCharacters": 8230,
  "normalizedCharacters": 8230,
  "parseState": "completed",
  "excludedRanges": [],
  "warnings": []
}
```

#### `metadata/chunks.jsonl`

文件名沿用 `chunks.jsonl` 以兼容现有产物契约，但其中每条记录表示“结构化处理单元”，不是固定字符长度的机械切片。

```json
{
  "chunkId": "resource_xxx:0",
  "resourceId": "resource_xxx",
  "sourcePath": "docs/error-code.md",
  "chunkIndex": 0,
  "headingPath": ["错误码", "参数错误"],
  "content": "YAS-00001 表示参数 p_size 无效。",
  "contentHash": "sha256:...",
  "documentOffsets": {"start": 0, "end": 25},
  "previousChunkId": null,
  "nextChunkId": "resource_xxx:1",
  "overlap": {"enabled": false, "sourceChunkId": null}
}
```

#### `quality/preparation-issues.json`

保存格式不支持、内容为空、来源缺失、解析失败、转换失败、OCR 待处理、引用缺失和内容排除等问题。单资源问题必须包含中文原因及 `retryable` 标记；资源隔离不阻止批次其他资源继续处理。

### 4.6 完成条件

- 每个可处理文档至少生成一条文档记录；
- 每个处理单元具有来源、标题路径、内容哈希、偏移和原文映射；
- 不可处理文件有明确中文原因；
- 输出 Schema 校验通过后才能进入步骤二。

### 4.7 失败处理

- 单文件失败：保留原始文件，隔离资源，记录可重试信息，继续处理其他文件；
- 存在部分成功和部分隔离资源：步骤状态为 `completed_with_warnings`，允许后续单资源重试；
- 批次没有任何可处理文档：步骤失败，停止流水线；
- 用户取消：完成当前原子写入后标记取消，不生成后续步骤产物。

## 五、步骤二：元数据构建

### 5.1 步骤标识

```text
metadata_construction
```

### 5.2 执行方

仅代码执行，不调用大模型。

### 5.3 输入

| 输入 | 来源 |
|---|---|
| `metadata/source-documents.jsonl` | 步骤一 |
| `metadata/chunks.jsonl` | 步骤一 |
| 分类和关键词规则 | 代码配置 |
| YashanDB 产品、版本、错误码和对象词典 | 领域规则库 |

### 5.4 主要功能

1. 聚合文档级标题、路径、章节和长度信息；
2. 使用代码生成抽取式摘要，不生成模型自由摘要；
3. 根据目录、标题、扩展名和领域词典生成分类；
4. 使用词频、领域词典和格式规则生成关键词；
5. 提取文档中明确出现的版本、产品模块和来源描述；
6. 为每个分块生成轻量摘要；
7. 建立当前分块与前后分块的上下文索引；
8. 标记缺少标题、分类冲突和版本不明确等元数据问题。

### 5.5 输出

#### `metadata/documents.jsonl`

```json
{
  "resourceId": "resource_xxx",
  "sourcePath": "docs/error-code.md",
  "title": "YashanDB 错误码说明",
  "summary": "本文说明 YAS 错误码及相关参数。",
  "summaryMethod": "extractive_rule",
  "category": "故障诊断",
  "keywords": ["YAS-00001", "p_size", "错误码"],
  "applicableVersions": ["23.2.1"],
  "headingCount": 8,
  "chunkCount": 6,
  "metadataIssues": []
}
```

#### `metadata/chunk-contexts.jsonl`

```json
{
  "chunkId": "resource_xxx:0",
  "resourceId": "resource_xxx",
  "headingPath": ["错误码", "参数错误"],
  "chunkSummary": "YAS-00001 与参数 p_size 无效有关。",
  "previousChunkSummary": null,
  "nextChunkSummary": "下一节给出处理方法。",
  "documentCategory": "故障诊断",
  "documentKeywords": ["YAS-00001", "p_size"]
}
```

### 5.6 完成条件

- 每个文档有一条文档元数据；
- 每个分块有一条上下文元数据；
- 元数据记录与步骤一的 `resourceId/chunkId` 一一对应；
- 摘要必须标记生成方法，不能伪装为模型摘要。

### 5.7 失败处理

- 单项分类无法确定：分类设为“未分类”，记录元数据问题，不调用模型；
- 标题或来源缺失：记录 `human_required` 质量问题；
- 输入记录数量不一致：步骤失败，禁止进入步骤三。

## 六、步骤三：知识提取

### 6.1 步骤标识

```text
knowledge_extraction
```

### 6.2 执行方

步骤由代码驱动。代码先完成输入校验、明确锚点识别和上下文装配，再调用专用 `KnowledgeExtractionAgent`；Agent 根据代码给定的提示词、Skill 清单、知识 Schema 和处理单元调用大模型完成主要知识提取。此步骤内部包含“不确定项识别”，但前端仍只显示一个步骤。

这里的 Skill 是 Agent 执行语义任务时使用的能力，不是流水线调度单元。Stage 的开始、结束、重试、落盘和失败处理仍由代码控制。

### 6.3 输入

| 输入 | 来源 |
|---|---|
| `metadata/chunks.jsonl` | 步骤一 |
| `metadata/documents.jsonl` | 步骤二 |
| `metadata/chunk-contexts.jsonl` | 步骤二 |
| 明确锚点识别器 | 代码配置 |
| 已发布的实体和关系类型 | 版本化知识 Schema |
| Agent 提示词和 Skill 清单 | Prompt Registry、Skill Registry |
| 模型配置和最近连接测试 | 文档生成器 Model Gateway |

### 6.4 知识 Schema 的发现与发布

实体和关系类型不能只靠代码从零构建。代码只负责 Schema 的存储、版本、校验和运行时约束；领域类型候选由独立的 `KnowledgeSchemaDiscoveryAgent` 在设计期或 Schema 升级时生成：

```text
代表性文档
  -> 代码选择样本并创建发现任务
  -> KnowledgeSchemaDiscoveryAgent 加载提示词和 schema-discovery Skill
  -> 大模型输出实体类型、关系类型、定义、正反例和证据
  -> 代码执行格式校验、重复合并和冲突检测
  -> 人工审核确认
  -> 发布版本化 Knowledge Schema
  -> 步骤三按已发布版本执行提取
```

约束：

- 模型可以提出新类型，但不能直接写入正式 Schema；
- 每个类型必须包含中文定义、允许属性、适用边界、正例和反例；
- 运行中发现 Schema 外候选时，记录为 `schema_candidate` 或 `human_required`，不得自动扩展正式类型；
- Schema 版本变化后，步骤三及后续产物必须失效并重新生成。

### 6.5 主要功能

1. 代码识别 `YAS-xxxxx`、`ORA-xxxxx`、版本号、参数名、配置项和 SQL 对象等明确锚点；
2. 代码按单个处理单元装配标题路径、相邻摘要、明确锚点和已发布知识 Schema；
3. 代码调用 `KnowledgeExtractionAgent`，由 Agent 加载专用提示词和实体提取、关系提取等 Skill；
4. 大模型提取知识点、实体、关系、类型和对应原文证据；
5. 代码校验 Agent 返回 JSON Schema、证据文本、偏移范围和候选类型；
6. 代码去除同一处理单元内完全重复的候选；
7. 代码识别需要进一步语义补充或人工处理的不确定项；
8. 将候选路由到 `code_resolved`、`agent_resolved`、`needs_enrichment`、`schema_candidate` 或 `human_required`。

### 6.6 不确定项识别规则

以下情况进入 `needs_enrichment`：

- 同一名称对应多个候选实体类型；
- 存在“该参数”“上述对象”“其配置”等指代；
- 原文暗示关系，但关系类型不能通过固定句式确定；
- 当前分块证据需要相邻分块摘要才能判断；
- 代码锚点与 Agent 候选之间存在冲突；
- 首次提取结果缺少解决问题所需的局部语义，但存在可补充的相邻上下文。

以下情况直接进入 `human_required`：

- 缺少来源资源或分块标识；
- 没有可回查的证据片段；
- 输入内容损坏或上下文元数据缺失；
- 候选超出当前知识 Schema 且无法安全映射或登记为 Schema 候选。

不允许仅以“置信度低于阈值”作为进入步骤四的唯一依据。步骤三已经通过专用 Agent 调用模型，步骤四只处理首次提取后仍然明确存在的局部语义问题。

### 6.7 输出

#### `extraction-results/knowledge-candidates.jsonl`

```json
{
  "candidateId": "candidate_xxx",
  "state": "agent_resolved",
  "kind": "entity",
  "resourceId": "resource_xxx",
  "chunkId": "resource_xxx:0",
  "value": {
    "name": "YAS-00001",
    "type": "YashanDBErrorCode"
  },
  "evidenceText": "YAS-00001 表示参数 p_size 无效。",
  "evidenceOffsets": {"start": 0, "end": 25},
  "sourceMethod": "knowledge_extraction_agent",
  "promptVersion": "knowledge-extraction:1.0.0",
  "skillVersions": ["entity-extraction:1.0.0"],
  "confidence": 0.96
}
```

#### `uncertain-items/pending.jsonl`

```json
{
  "uncertainItemId": "uncertain_xxx",
  "state": "needs_enrichment",
  "type": "ambiguous_reference",
  "reason": "“该参数”存在多个可能指代对象",
  "resourceId": "resource_xxx",
  "chunkId": "resource_xxx:1",
  "evidenceText": "该参数需要配合线程池设置。",
  "candidateResults": ["max_connections", "thread_pool_size"]
}
```

#### `quality/extraction-issues.json`

保存输入缺失、Agent 调用失败、证据缺失、Schema 外候选和无法安全处理的问题。

### 6.8 完成条件

- 每个候选具有来源方法、Agent/Prompt/Skill 版本和原文证据；
- 每个不确定项只对应一个明确问题；
- 不确定项不得携带完整文档；
- 相同 `uncertainItemId` 不得在无输入变化时重复调用模型；
- Agent 输出必须经过代码校验后才能落盘为知识候选。

### 6.9 失败处理

- 单处理单元 Agent 调用或校验失败：记录质量问题，继续处理其他单元；
- Prompt、Skill、模型配置或知识 Schema 无法加载：步骤失败；
- 模型服务整体不可用：步骤失败，不把未执行的语义提取伪装成成功；
- 无不确定项：步骤四允许跳过。

## 七、步骤四：按需语义补充

### 7.1 步骤标识

```text
semantic_enrichment
```

### 7.2 执行方

步骤由代码驱动。代码读取步骤三产生的 `needs_enrichment` 项并调用专用 `SemanticEnrichmentAgent`；Agent 根据不确定项类型选择提示词和 Skill，通过大模型只解决指定的局部语义问题。

### 7.3 输入

| 输入 | 来源 |
|---|---|
| `uncertain-items/pending.jsonl` | 步骤三 |
| `metadata/documents.jsonl` | 步骤二 |
| `metadata/chunk-contexts.jsonl` | 步骤二 |
| 当前证据片段 | 步骤一分块 |
| 代码锚点、Agent 候选和冲突 | 步骤三 |
| 最近 10 分钟模型测试结果 | 文档生成器 Model Gateway |

### 7.4 模型输入 `ContextEnvelope`

```json
{
  "uncertainItemId": "uncertain_xxx",
  "question": {
    "type": "ambiguous_reference",
    "reason": "需要判断“该参数”的指代对象"
  },
  "document": {
    "title": "连接参数说明",
    "summary": "本文说明连接数和线程池参数。",
    "category": "配置参数",
    "keywords": ["max_connections", "thread_pool_size"]
  },
  "currentChunk": {
    "chunkId": "resource_xxx:1",
    "headingPath": ["连接配置"],
    "evidenceText": "该参数需要配合线程池设置。"
  },
  "adjacentChunkSummaries": [
    {"chunkId": "resource_xxx:0", "summary": "上一块介绍 max_connections。"}
  ],
  "extractionCandidates": ["max_connections", "thread_pool_size"],
  "constraints": {
    "evidenceMustComeFromCurrentExcerpt": true,
    "allowHumanRequired": true
  }
}
```

禁止字段：完整文档正文、完整 Prompt、认证信息和无关分块正文。

### 7.5 主要功能

1. 检查模型配置和最近真实连接测试；
2. 代码按不确定项类型创建 `AgentTask`，指定 Agent、Prompt、Skill 和输入范围；
3. `SemanticEnrichmentAgent` 每次只解决一个 `uncertainItemId`；
4. Agent 只加载完成该问题所需的 Skill，不得自行扩大任务范围；
5. 使用最大输出 800～1200 Token、30～45 秒超时和最多 1 次网络重试；
6. 限制并发最多 3；
7. 代码校验 Agent 返回 JSON Schema；
8. 无法可靠判断时返回 `human_required`，不得猜测；
9. 记录 Agent、模型、Prompt、Skill 版本、Token、耗时和脱敏错误摘要。

### 7.6 输出

#### `model-results/semantic-resolution.jsonl`

```json
{
  "uncertainItemId": "uncertain_xxx",
  "resourceId": "resource_xxx",
  "chunkId": "resource_xxx:1",
  "status": "resolved",
  "agentId": "semantic-enrichment-agent",
  "promptVersion": "reference-resolution:1.0.0",
  "skillVersions": ["reference-resolution:1.0.0"],
  "reason": "上一分块只介绍 max_connections",
  "confidence": 0.86,
  "knowledgePoints": [],
  "entities": [],
  "relations": [
    {
      "source": "max_connections",
      "target": "thread_pool_size",
      "type": "COORDINATES_WITH",
      "evidenceText": "该参数需要配合线程池设置。",
      "confidence": 0.86
    }
  ],
  "usage": {
    "promptTokens": 520,
    "completionTokens": 120,
    "durationMs": 2800
  }
}
```

#### `uncertain-items/resolved.jsonl`

记录不确定项从 `needs_enrichment` 到 `resolved` 或 `human_required` 的状态变化。

#### `quality/semantic-issues.json`

保存超时、连接失败、Schema 错误和模型无法判断等问题。

### 7.7 完成条件

- 每次 Agent 调用关联唯一不确定项；
- 模型输出通过 JSON Schema；
- 调用失败不会阻止步骤三中已通过代码校验的结果继续进入步骤五；
- 无不确定项时步骤状态为 `skipped`，中文原因明确。

### 7.8 失败处理

- 单项超时或返回错误：该项转为 `human_required`；
- 模型服务整体不可用：所有待处理项转为质量问题，已完成的步骤三候选继续进入步骤五；
- 模型测试未通过：不得发起正式调用；
- 模型结果没有证据：保留原始审计记录，但不能进入最终知识。

## 八、步骤五：知识校验与合并

### 8.1 步骤标识

```text
knowledge_validation
```

### 8.2 执行方

仅代码执行，不调用大模型。

### 8.3 输入

| 输入 | 来源 |
|---|---|
| `extraction-results/knowledge-candidates.jsonl` | 步骤三 |
| `model-results/semantic-resolution.jsonl` | 步骤四 |
| `metadata/chunks.jsonl` | 步骤一 |
| `metadata/documents.jsonl` | 步骤二 |
| 知识输出 Schema | 版本化 Schema |

### 8.4 主要功能

1. 校验步骤三候选和步骤四补充结果的字段 Schema；
2. 校验证据文本确实存在于对应原文分块；
3. 校正和校验证据偏移；
4. 校验关系源实体和目标实体存在；
5. 区分 `YAS-` 与 `ORA-` 错误码领域；
6. 按类型、标准化名称和来源进行实体去重；
7. 合并代码明确锚点、步骤三 Agent 候选和步骤四补充结果；
8. 处理冲突：原文明示且由代码精确识别的事实优先，模型不能覆盖强证据事实；
9. 将不通过结果写入拒绝记录和质量问题；
10. 生成唯一的最终知识输入文件。

### 8.5 输出

#### `final-results/knowledge.jsonl`

```json
{
  "knowledgeId": "knowledge_xxx",
  "kind": "relation",
  "sourceResourceId": "resource_xxx",
  "chunkId": "resource_xxx:1",
  "sourcePath": "docs/connection.md",
  "value": {
    "source": "max_connections",
    "target": "thread_pool_size",
    "type": "COORDINATES_WITH"
  },
  "evidenceText": "该参数需要配合线程池设置。",
  "evidenceOffsets": {"start": 30, "end": 45},
  "confidence": 0.86,
  "sourceMethod": "model_resolved",
  "validationState": "passed"
}
```

#### `final-results/rejected.jsonl`

记录被拒绝的候选、拒绝原因和原始候选标识，不保存完整 Prompt。

#### `quality/issues.json`

合并前五步产生的所有质量问题，并去重。

### 8.6 完成条件

- 最终知识全部通过 Schema 和证据校验；
- 所有关系端点可解析；
- 缺少置信度时不得默认为 `1.0`；
- `final-results/knowledge.jsonl` 是步骤六唯一知识输入。

### 8.7 失败处理

- 单候选不通过：写入拒绝文件和质量问题；
- 最终知识为空但存在可处理文档：步骤完成但标记高严重度质量问题；
- 最终产物写入失败或 Schema 无法加载：步骤失败，禁止构图。

## 九、步骤六：图谱与数据集生成

### 9.1 步骤标识

```text
graph_dataset_generation
```

### 9.2 执行方

仅代码执行，不调用大模型。

### 9.3 输入

| 输入 | 来源 |
|---|---|
| `final-results/knowledge.jsonl` | 步骤五 |
| `metadata/documents.jsonl` | 步骤二 |
| `metadata/chunks.jsonl` | 步骤一 |
| `quality/issues.json` | 步骤五 |
| 数据集版本信息 | 运行上下文 |

禁止读取：

- 未校验的模型原始输出；
- `uncertain-items/pending.jsonl`；
- `extraction-results/knowledge-candidates.jsonl` 中未通过步骤五的结果。

### 9.4 主要功能

1. 创建文档、分块和实体节点；
2. 创建文档包含分块、分块提及实体和实体关系边；
3. 每条知识关系保留来源、分块、证据和偏移；
4. 使用稳定 ID 去重节点和边；
5. 统计节点类型、关系类型和质量问题；
6. 生成候选数据集 Manifest；
7. 生成运行报告和阶段耗时；
8. 更新数据集为“候选”状态，不自动正式发布。

### 9.5 输出

#### `graph/nodes.json`

节点至少包含：

```json
{
  "id": "entity_xxx",
  "type": "Parameter",
  "name": "max_connections",
  "properties": {},
  "sourceResourceId": "resource_xxx",
  "chunkId": "resource_xxx:0"
}
```

#### `graph/edges.json`

边至少包含：

```json
{
  "id": "edge_xxx",
  "type": "COORDINATES_WITH",
  "source": "entity_source",
  "target": "entity_target",
  "sourceResourceId": "resource_xxx",
  "chunkId": "resource_xxx:1",
  "evidenceText": "该参数需要配合线程池设置。",
  "evidenceOffsets": {"start": 30, "end": 45},
  "confidence": 0.86
}
```

#### `dataset/manifest.json`

```json
{
  "datasetId": "dataset_xxx",
  "taskId": "training_xxx",
  "state": "candidate",
  "pipelineVersion": "2.0",
  "documentCount": 42,
  "chunkCount": 186,
  "knowledgeCount": 326,
  "nodeCount": 410,
  "edgeCount": 680,
  "qualityIssueCount": 3,
  "createdAt": "2026-07-27T10:10:00+08:00"
}
```

#### `run-report.json`

记录六步骤耗时、输入输出数量、模型调用统计、质量问题和产物相对路径。

### 9.6 完成条件

- 图谱只来自最终知识；
- 每条实体关系具有来源和证据；
- 数据集状态为 `candidate`；
- 运行报告包含六步骤结果；
- 前端图谱统计与文件产物一致。

### 9.7 失败处理

- 单条知识无法构图：记录质量问题，不阻止其他知识构图；
- 图谱文件或数据集 Manifest 写入失败：步骤失败；
- 高严重度质量问题存在：候选数据集可以生成，但不得正式发布。

## 十、六步骤输入输出总表

| 步骤 | 主要输入 | 主要输出 | 是否调用模型 |
|---|---|---|---|
| 1. 资料预处理 | MaterialBatch、原始文件、结构化单元配置 | 原文映射、源文档记录、处理单元、准备问题 | 否 |
| 2. 元数据构建 | 源文档记录、处理单元、领域词典 | 文档元数据、处理单元上下文 | 否 |
| 3. 知识提取 | 处理单元、元数据、知识 Schema、Prompt、Skill | 知识候选、不确定项、提取问题 | 由代码调用知识提取 Agent |
| 4. 按需语义补充 | 不确定项、ContextEnvelope、Prompt、Skill | 模型语义结果、已处理项、语义问题 | 由代码按不确定项调用语义 Agent |
| 5. 知识校验与合并 | 提取候选、语义补充结果、原文处理单元、Schema | 最终知识、拒绝记录、统一质量问题 | 否 |
| 6. 图谱与数据集生成 | 最终知识、元数据、质量问题 | 节点、边、候选数据集、运行报告 | 否 |

## 十一、步骤接口设计

每个步骤实现统一接口，禁止在一个超长函数中完成全部流程。

```text
interface PipelineStage:
  id: string
  name: string

  validate_inputs(context) -> ValidationResult
  execute(context) -> StageResult
  validate_outputs(context, result) -> ValidationResult
```

建议实现边界：

```text
MaterialPreparationStage
MetadataConstructionStage
KnowledgeExtractionStage
SemanticEnrichmentStage
KnowledgeValidationStage
GraphDatasetGenerationStage
```

调度器只负责：

```text
for stage in configured_stages:
  verify previous stage completed
  validate stage inputs
  mark stage running
  execute stage
  validate stage outputs
  persist StageResult and events
  stop on fatal failure or cancellation
```

需要语义能力的 Stage 通过统一代码接口调用专用 Agent：

```text
AgentGateway.execute(
  agent_id,
  task_id,
  prompt_version,
  skill_versions,
  context_envelope,
  output_schema
) -> AgentResult
```

`AgentGateway` 不能反向控制流水线步骤，也不能绕过 Stage 直接写最终产物。

## 十二、事件与前端进度

### 12.1 全链路追踪标识

一次知识加工执行使用 `taskId` 作为根标识；每个步骤执行生成唯一 `stageRunId`，每个 Agent 工作项生成唯一 `agentTaskId`，每次实际模型请求生成唯一 `modelCallId`，每条事件生成唯一 `eventId`。模型重试必须生成新的 `modelCallId`，并通过 `retryOf` 指向上一次调用。缓存命中保留新的 `agentTaskId`，但 `modelCallId` 为 `null` 且调用状态为 `reused`。

所有事件必须包含 `eventId/taskId/stageRunId`；Agent 和模型事件按实际情况增加 `agentTaskId/modelCallId`。运行清单保存六个 `stageRunId`，中间产物保存产生该记录的追踪标识，使日志、处理单元、不确定项、模型结果、最终知识和质量问题可以相互反查。

启动前预检使用独立 `preflightId`，快照保存输入哈希、处理单元数和标准配置。正式 `taskId` 在 `run-manifest.json` 中引用与当前输入匹配的 `preflightId`，以支持预检与正式产物的数量和哈希对账。

### 12.2 事件类型

每一步至少产生：

```text
stage.started
work_item.completed
work_item.failed
stage.completed / stage.skipped / stage.failed
```

步骤三和步骤四在调用专用 Agent 时额外产生：

```text
agent_task.started
agent_task.completed
agent_task.failed
model_call.started
model_call.completed
model_call.failed
```

事件主信息必须为中文。事件 `details` 可包含：

```text
resourceId / chunkId / uncertainItemId / artifact / durationMs
```

不得包含：完整文档、完整 Prompt、Token、Cookie、密码或完整认证头。

## 十三、幂等与恢复

1. 每一步产物写入临时文件后原子替换；
2. 每一步保存输入文件哈希和输出文件哈希；
3. 输入哈希和步骤版本不变时允许复用已完成产物；
4. 上一步产物变化后，后续所有步骤必须失效并重新执行；
5. 当前进程内线程实现不支持自动恢复运行中的模型调用；
6. 服务重启后遗留的运行中任务必须标记为失败，允许用户重新启动。

## 十四、实施顺序

必须按以下顺序逐步实现和验证，禁止一次性改写整个流水线：

1. 定义公共数据模型、Schema、目录和 `PipelineStage` 接口；
2. 实现步骤一，并通过真实批次 API 验证原文保留、结构化处理单元和偏移；
3. 实现步骤二，并验证文档/处理单元元数据一一对应；
4. 实现知识 Schema 发现 Agent、人工审核和版本发布流程；
5. 实现步骤三的代码锚点识别、AgentGateway 调用和候选校验；
6. 实现步骤四，先验证超时和失败降级，再验证真实模型成功路径；
7. 实现步骤五，验证无证据模型结果不能进入最终知识；
8. 实现步骤六，验证图谱只读取最终知识；
9. 最后接入前端实时进度和六步骤状态。

每完成一步，必须同步：

- 该步骤设计状态；
- 单元测试；
- 真实后端 API 测试；
- 产物样例和失败样例；
- 未完成项记录。

## 十五、验收标准

1. 前端只显示六个稳定步骤；
2. 不确定项识别不单独显示；
3. 每一步输入输出文件均通过 Schema 校验；
4. 原始文档完整保留，处理单元不会静默删除或覆盖原文；
5. 默认采用结构优先切分且不强制重叠，只有超长结构块或安全边界不足时才启用后备切分策略；
6. 步骤三由代码调用知识提取 Agent，Agent 明确记录 Prompt、Skill、模型和 Schema 版本；
7. 步骤四每次 Agent 调用只处理一个不确定项；
8. Agent 输入不包含无关完整文档；短文档整篇作为一个处理单元时除外，但仍受任务范围约束；
9. 步骤四模型超时不会阻止步骤三已通过校验的结果生成候选数据集；
10. 缺少证据的结果不能进入最终知识；
11. 图谱只读取 `final-results/knowledge.jsonl`；
12. 六步骤均展示处理数量、耗时、成功、失败或跳过中文说明；
13. 所有公开路径为相对路径；
14. 使用真实后端 API 完成至少一条知识提取 Agent 成功任务和一条语义补充 Agent 调用或跳过任务。
