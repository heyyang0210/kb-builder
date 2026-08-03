# PingCode 元数据构建步骤详细设计

> 版本：v1.0
> 上位设计：`docs/08-pingcode-processing-six-step-pipeline-design.md`
> 实现状态：代码版 v1 已实现，当前规则由 `scripts/pingcode/processing/metadata-rules/` 维护

## 一、范围与职责

元数据构建是第二个前端步骤，完全由代码执行，不调用 Skill、Agent 或大模型。它读取步骤一通过 Schema 校验的文档和处理单元，生成知识提取所需的轻量上下文。本步骤不生成模型自由摘要，不判断实体关系，不修改原文。

## 二、输入与处理

输入为 `metadata/source-documents.jsonl`、`metadata/chunks.jsonl`、`metadata/structure-blocks.jsonl`、版本化分类/关键词规则、YashanDB 领域词典和运行配置。隔离、转换失败、`ocr_required` 资源只进入质量统计，不进入元数据正文输入。

代码依次执行：校验输入哈希和一一对应关系；聚合标题、路径、结构和来源；按领域词典和受控关键词规则生成抽取式摘要、分类、语义关键词、可识别的明确版本；生成单元前后摘要和引用索引；校验并原子写入产物。完整标题只写入 `title/titleSource/sourcePath`，不直接加入 `keywords`。

摘要必须标注 `summaryMethod=extractive_rule`。标题缺失和分类冲突只记录质量问题；适用版本不是必检项，文档未明确出现版本时 `applicableVersions=[]`，不生成阻断或告警质量问题。分类无法确定时使用“未分类”，仅记录 `info` 级提示，不作为警告或阻断质量问题。相邻摘要只能提供上下文，不替代原文证据。

## 三、产物 Schema

`metadata/documents.jsonl`：

```json
{"resourceId":"resource_xxx","sourcePath":"docs/error-code.pdf","title":"YashanDB 错误码说明","summary":"本文说明 YAS 错误码及相关参数。","summaryMethod":"extractive_rule","category":"故障诊断","keywords":["YAS-00001","p_size"],"applicableVersions":["23.2.1"],"chunkCount":6,"metadataIssues":[],"inputHash":"sha256:..."}
```

`metadata/chunk-contexts.jsonl`：

```json
{"chunkId":"resource_xxx:0","resourceId":"resource_xxx","headingPath":["错误码","参数错误"],"chunkSummary":"本单元介绍 YAS-00001 与参数 p_size 的关系。","summaryMethod":"extractive_rule","previousChunkId":null,"nextChunkId":"resource_xxx:1","previousChunkSummary":null,"nextChunkSummary":"下一单元介绍处理方法。","documentCategory":"故障诊断","documentKeywords":["YAS-00001","p_size"]}
```

## 四、接口、伪代码与事件

```text
interface MetadataConstructionStage:
  validate_inputs(context) -> ValidationResult
  execute(context) -> StageResult
  validate_outputs(context, result) -> ValidationResult

execute(context):
  load and hash-check preparation artifacts
  build one document record per processable resource
  build one context record per processing unit
  validate resourceId/chunkId mapping
  atomically persist documents, contexts and issues
```

事件：`stage.started`、`work_item.completed`、`work_item.failed`、`stage.completed`、`stage.failed`。主消息使用中文，不记录正文全文。

## 五、失败、幂等与验收

单文档异常时记录问题并继续；输入缺失、重复、哈希不一致或产物 Schema 无法加载时步骤失败。输入哈希、规则版本和步骤版本不变时复用产物；上一步变化时本步骤及后续产物失效。验收覆盖正常文档、无标题、分类冲突、记录不一致和重复执行，并通过真实后端 API 验证。

## 六、当前实现说明

已实现：

- `MetadataConstructionService` 纯代码执行，不调用 Skill、Agent 或大模型；
- `/api/metadata/build` 接口；
- 读取步骤一最近成功运行的 `source-documents.jsonl`、`chunks.jsonl`；
- 校验 `resourceId/chunkId` 一一对应、规范化文件哈希和处理单元内容哈希；
- 生成 `metadata/documents.jsonl`、`metadata/chunk-contexts.jsonl` 和 `quality/metadata-issues.json`；
- 生成抽取式摘要、分类、关键词、可识别版本、前后单元摘要和标题路径；
- 单文档异常继续处理、中文事件记录、原子写入和执行哈希幂等复用。

## 七、规则文件与数据库词典

规则只维护一套当前版本，目录为 `scripts/pingcode/processing/metadata-rules/`，历史由 Git 人工管理，不建立 `versions/` 目录。`manifest.yaml` 声明规则文件、`ruleSetVersion` 和成熟度；运行时只计算并记录规则集内容哈希，不读取或记录 Git commit。

数据库词典分为 `database-glossary.yaml` 通用数据库术语和 `yashandb-glossary.yaml` YashanDB 专有术语。元数据步骤不据此生成实体或关系，而是对处理单元正文执行别名匹配，输出稳定 `termId`、标准术语、命中别名、出现次数、所属处理单元、领域分类和词典来源。标题同时保留原始值和按规则清洗后的 `semanticTitle`：完整标题不能原样进入关键词集合，但 `semanticTitle`、摘要、章节标题、正文和领域术语会作为知识提取模型的联合输入。YashanDB 专有词典优先于通用词典；无法消解的同名术语记录质量问题，不强行映射。YAS/ORA 错误码还通过规则模式生成错误码领域术语，方便后续知识提取定位。图谱构建优先使用 `termId` 作为术语身份，别名只作为规范化和后续查询入口，不单独作为关键词节点写入图谱。`dataset_*`、`file_*`、`chunk_*` 等追溯标识以及 `YashanDB`、`DSI`、`内幕文档`、副本编号等命名噪声由规则文件过滤，不得进入别名和图谱关键词集合。

确定性元数据重建接口接收已保存的源文档和处理单元，重新计算 `domainTerms`、`keywords` 和处理单元上下文，不调用大模型。规则集内容哈希写入文档和图谱摘要；规则哈希变化时，历史元数据关键词图谱必须先刷新确定性元数据，再重建图谱，确保词典和停用词变更能作用于已落盘数据。

`yashandb-glossary.yaml` 是当前运行时实际加载的生效词典，不是示例；当前成熟度为 `initial`，表示已具备基础规则但不是完整的最终术语全集。词典匹配结果用于：关键词规范化、领域分类辅助、抽取式摘要候选排序、处理单元上下文和后续检索扩展。词典条目通过 YashanDB 官方文档 MCP 离线校对和补充，运行时不实时调用 MCP；每条专有术语保留 `officialSources` 文档和章节信息。

标题清洗规则维护在元数据规则目录，输出必须可审计：`title` 保留原始语义标题，`semanticTitle` 仅移除配置声明的产品范围词、文档命名后缀、文件扩展名、连接符和副本编号。清洗结果为空时保留空值，不把原始文件名回退为关键词。文档和处理单元上下文必须同步输出 `titleNoiseRemoved` 与 `topicCandidates`：前者记录命中的清洗规则类型和值，后者记录从标题、词典或正文证据确定的主题候选、证据来源、命中处理单元和置信度。当前实现覆盖：分类加权、版本正则、停用词、标题清洗、YAS/ORA 错误码、通用数据库术语、YashanDB 专有术语、规则集哈希和词典命中输出。规则文件缺失、非法正则或重复 `termId` 时步骤失败，不回退到 Python 内置规则。

元数据阶段同时生成 `metadata/preselection-report.json`，作为关键词质量分析默认档的低成本初筛输入。状态枚举固定为：

```text
deterministic_ready / model_required / human_review / skip
```

每条记录包含 `resourceId/chunkIds/semanticTitle/preselectionState/reasons/evidence/sourceMethods`。`deterministic_ready` 表示 `topicCandidates` 已有可追溯证据，可由确定性候选进入关键词图谱；`model_required` 表示标题存在但缺少稳定主题证据，需要关键词模型补充；`human_review` 表示标题疑似多主题或冲突，默认不直接调用模型；`skip` 表示没有可用处理单元或语义标题为空。初筛报告只决定模型调度和人工确认入口，不直接把资源、文件名或完整标题写入关键词图谱。
