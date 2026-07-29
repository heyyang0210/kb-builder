# PingCode 图谱与数据集生成步骤详细设计

> 版本：v1.0
> 上位设计：`docs/08-pingcode-processing-six-step-pipeline-design.md`

## 一、范围与通俗说明

图谱与数据集生成是第六个前端步骤，完全由代码执行。知识事实优先读取通过步骤五校验的 `final-results/knowledge.jsonl`；当最终知识为空时，允许使用训练元数据中的文档关键词、领域术语和文档块上下文生成“元数据关键词图谱”，用于质量分析和检索辅助展示。

通俗来说：数据集是“整理好的知识资料包”，既保留文档和处理单元，也保留从文档中整理出的知识、实体、关系和质量说明；最终知识库是“已经接入检索、问答或图谱服务的可用版本”。数据集是生产资料和候选结果，知识库是经过发布流程后对用户提供查询服务的运行内容。数据集可以重新校验、删除或重新发布，知识库则提供稳定查询入口和版本状态。

## 二、数据集形态

```text
datasets/<datasetId>/
├── originals/                 原始资料，只读永久保留
├── normalized/                统一 Markdown
├── mappings/                  PDF/Office 来源映射
├── documents.jsonl            文档索引和元数据
├── processing-units.jsonl     处理单元及来源
├── knowledge.jsonl            通过校验的知识记录
├── entities.jsonl             去重后的实体
├── relations.jsonl            去重后的关系
├── graph/
│   ├── nodes.json
│   └── edges.json
├── quality-issues.json        质量问题和特殊标注
└── manifest.json              数据集状态和统计
```

`final-results/knowledge.jsonl` 是知识事实输入；数据集中的 `knowledge.jsonl` 是面向消费的复制结果，必须保留相同知识 ID 和证据。元数据关键词图谱不回写 `knowledge.jsonl`、`entities.jsonl` 或 `relations.jsonl`，避免把预处理关键词误标为最终知识抽取结果。

DOCX 或 PingCode 页面中的图片资产属于来源证据层：数据集可保留图片路径、哈希和预览引用，但在未启用图片说明、OCR 或图解理解能力前，不把图片本身写入 `knowledge.jsonl`、`entities.jsonl` 或 `relations.jsonl`，也不直接生成语义知识图谱节点。

## 三、图谱模型

质量分析和左侧导航中的“知识图谱”使用同一套语义模型：节点主体是关键词、知识点和文档块，边主体是带证据上下文的匹配关系。区别只在数据范围：质量分析读取当前数据集图谱，左侧导航读取全局索引图谱。展示层统一使用 `displayName`，原始值保留在 `rawName`，仅用于追溯和审计。领域词典命中时，关键词节点优先按 `termId` 全局归并；无 `termId` 时才按规范化后的 canonicalName 归并。`aliases` 和 `matchedAliases` 仅作为查询入口与展示属性，不单独生成用户可见关键词节点。

文档与处理单元的包含关系属于结构追溯图，只用于来源回查和数据集审计，不作为质量分析知识图谱的主体关系展示。数据集仍保留文档、处理单元和来源映射文件，图谱节点通过 `sourceResourceId`、`chunkId` 和 `sourceLocations` 回查结构追溯信息。

知识图谱节点包括 `KnowledgePoint`、`Keyword`、`ProcessingUnit`/`Chunk` 以及通过 Schema 校验的实体类型。主边为 `CONTEXT_MATCHES_CHUNK`，表示关键词或知识点通过证据上下文匹配到对应文档块；实体之间已校验的 Schema 关系可以继续作为知识边展示。每条边必须带资源、处理单元、证据文本、规范化偏移、上下文摘要和 PDF/Office 原始位置。前端默认仅渲染 canonical 关键词总览，点击关键词后再按需展开一层上下文边，避免一次性加载全部关系；别名命中后必须回落到同一 canonical 节点。

数据集图谱来源使用 `graphSource` 标记：`final_knowledge` 表示包含最终知识，`model_keyword` 表示最终知识为空但存在已验证模型关键词，`metadata_keyword` 表示仅使用确定性元数据回退，`empty` 表示没有可用图谱输入。图谱关键词按领域术语、模型主题关键词、受控规则候选的顺序归并；完整文档标题和文件名主体不直接作为节点，但模型可从清洗后的 `semanticTitle` 提取有逐字证据的主题子串。`dataset_*`、`file_*`、`chunk_*` 等技术标识，以及规则配置中的产品范围词和文件命名词，只保留在来源追溯字段中，不进入关键词候选集合、别名列表或关键词统计。

模型关键词节点固定记录 `sourceMethods`、`evidenceSources`、`sourceResourceIds`、`chunkIds`、`modelConfidence`、`occurrences`。标题证据关联当前文档的主要处理单元，边同时保留标题、正文上下文和来源路径。最终知识图谱也合并已验证关键词节点，避免知识点存在时反而丢失主题关键词；摘要增加 `keywordSourceCounts` 区分词典、模型和规则来源。

图谱摘要必须记录 `graphSchemaVersion` 和 `metadataRuleSetHash`。质量报告或图谱接口读取数据集时，若图谱版本缺失/过低，或元数据关键词图谱的规则哈希与当前规则集不一致，则使用已保存的源文档和处理单元先刷新确定性元数据，再懒回填图谱，不重新调用大模型。别名查询先解析为 canonical 节点 ID，再使用该 ID 筛选上下文边，以保证 canonicalName 和任一别名返回同一组关联。

图谱展示层采用 `What / How / Why` 知识域组织方式：`What` 用于概念、对象、参数、规则和错误码；`How` 用于步骤、配置、流程、实现方式和操作方案；`Why` 用于原因、约束、设计取舍、风险和故障根因。该分类服务于阅读和质量分析，不替代 `resourceId`、`chunkId`、`sourcePath`、证据文本和最终知识文件。

v1 的知识域与本体类型采用可解释规则推断，不重新调用大模型：`Concept` 表示对象和概念，`Procedure` 表示操作和实现过程，`Principle` 表示机制和原理，`Decision` 表示设计取舍，`Constraint` 表示限制和边界，`Symptom` 表示现象或报错，`Solution` 表示修复或处理方案。后续如需更高准确率，可将该规则下沉为可配置词表或由知识抽取 Skill 输出结构化字段。

## 四、质量标注与发布状态

高严重度质量问题仍生成候选数据集，但必须特殊标注：

```json
{"state":"candidate","qualityState":"blocked","publishable":false,"qualityLabels":["source_mapping_incomplete","evidence_coverage_low"],"qualityNotice":"部分文档存在来源映射或证据质量问题，当前数据集禁止发布。"}
```

没有高严重度问题时可为 `qualityState=passed`，但仍须经过正式发布动作。生成步骤不自动发布知识库。

## 五、删除知识集设计

重复或质量过低的数据集由人判断后删除，代码不自动判断重复知识集。候选数据集和已发布正式知识集都允许删除。删除知识集不会删除 `originals/` 原始资料，永久保留原始文件、来源元数据、来源映射、运行报告、质量问题和删除审计记录。

删除的数据集知识、实体、关系、图谱和知识库索引不再对外提供；建议采用软删除状态 `deleted`，再异步清理派生产物，但对用户语义上等同于删除。删除必须记录操作者、时间、原因、数据集版本和确认信息。

## 六、接口、产物 Schema 与伪代码

```text
interface GraphDatasetGenerationStage:
  validate_inputs(context) -> ValidationResult
  execute(context) -> StageResult
  validate_outputs(context, result) -> ValidationResult
  delete_dataset(datasetId, operator, reason) -> DeletionResult

execute(context):
  load final-results/knowledge.jsonl as preferred knowledge facts
  load documents, chunk contexts, chunks and quality issues for context nodes and notices
  if final knowledge exists:
    create knowledge-point, keyword/entity and processing-unit nodes
    set graphSource=final_knowledge
  else:
    create canonical keyword and processing-unit nodes from metadata keyword context
    merge aliases, matchedAliases and display aliases onto the canonical keyword node
    set graphSource=metadata_keyword or empty
  create context-matches-chunk edges and validated entity-relation edges
  write dataset files and manifest atomically
  set state=candidate and publishable according to quality gate

delete_dataset(datasetId, operator, reason):
  require explicit confirmation and permission
  mark dataset deleted
  remove or hide derived knowledge, graph and index artifacts
  retain originals, mappings, metadata, issues, report and audit record
```

`dataset/manifest.json` 至少包含 `datasetId`、`taskId`、`state`、`qualityState`、`publishable`、统计数量、Schema 版本、来源范围、创建时间和本次运行的 `config`。其中预处理配置只使用 `maxUnitCharacters`、`fallbackOverlapCharacters` 等当前设计字段，不输出历史 `chunkSize/chunkOverlap` 字段。`run-report.json` 使用相同的 `config` 契约，确保数据集产物可以独立回查其处理基线。

## 七、事件、失败与幂等

事件：`stage.started`、`graph.node_created`、`graph.edge_created`、`dataset.candidate_created`、`dataset.quality_blocked`、`dataset.deleted`、`stage.completed`、`stage.failed`。主消息均为中文。

单条知识构图失败时记录问题并继续其他知识；最终知识文件、元数据或 Manifest 写入失败时步骤失败；输入知识、Schema 和步骤版本不变时复用数据集；任何上游知识变化使图谱和数据集失效；删除操作必须幂等，同一数据集重复删除返回已删除状态，不重复清理审计记录。

## 八、验收标准

1. 图谱优先读取 `final-results/knowledge.jsonl` 作为知识事实来源，最终知识为空时可回退为元数据关键词图谱；
2. 主图节点包含关键词、知识点和文档块；
3. 主图边包含 `CONTEXT_MATCHES_CHUNK` 和已校验实体关系，不把 `DOCUMENT_CONTAINS_UNIT` 作为质量分析主体关系；
4. 每条上下文或实体关系保留完整证据、上下文摘要和来源映射；
5. 高严重度问题生成候选数据集但标记 `blocked`、禁止发布；
6. 数据集与最终知识库在内容层和运行层的差异可解释、可追溯；
7. 人工确认后可删除候选或已发布知识集；
8. 删除后 `originals/` 永久保留；
9. 真实 API 验证候选生成、质量阻断、发布、删除和重复删除场景。

## 九、当前实现说明

- 步骤六开始时重新读取 `final-results/knowledge.jsonl`，该文件是实体和关系图谱的唯一知识来源；
- 步骤六开始时重新读取 `final-results/knowledge.jsonl`；若最终知识为空，则读取 `metadata/documents.jsonl`、`metadata/chunk-contexts.jsonl` 和处理单元生成 `metadata_keyword` 图谱；
- 图谱摘要写入 `graphSchemaVersion` 和 `metadataRuleSetHash`；历史数据集若缺少该版本、版本过低、缺少 `graphSource`、规则哈希变化或仍停留在空图谱/旧结构图，质量报告和图谱读取会基于现有源文档和处理单元刷新确定性元数据并懒回填，不重新调用大模型；
- 图谱节点使用 `KnowledgePoint`、`Keyword`、`ProcessingUnit` 和知识 Schema 实体类型，主边使用 `CONTEXT_MATCHES_CHUNK`，结构追溯通过节点属性和来源文件保留；展示层清洗短十六进制技术前缀，但 `rawName` 原样保留；canonical 关键词节点会聚合别名列表、命中来源和多处理单元上下文，不再按资源切片重复建点；
- `graphSummary` 记录 `keywordCount`、`chunkCount`、`contextEdgeCount`、`graphSource`、知识域分布、关系覆盖率、孤立知识比例、Why 缺失率、证据完整率和跨文档关联数，质量分析据此区分最终知识图谱与元数据关键词回退图谱；
- `metadata_keyword` 仅用于质量分析和检索辅助，不写入 `knowledge.jsonl`、`entities.jsonl`、`relations.jsonl`，避免把回退图谱伪装为最终知识；
- 数据集目录实际生成 `originals/`、`normalized/`、`mappings/`、文档、处理单元、知识、实体、关系、图谱、质量问题、运行报告和 `manifest.json`；
- `manifest.json` 记录 `candidate` 状态、质量状态、发布许可、质量标签、来源范围、处理配置及各类数量；
- 高严重度问题设置 `qualityState=blocked`、`publishable=false`，`force` 参数不能绕过阻断；
- 发布接口为 `POST /api/datasets/{datasetId}/publish`，发布同步更新 Manifest 和批次最新版本；
- 删除接口为 `DELETE /api/datasets/{datasetId}`，请求必须包含 `operator`、`reason` 和 `confirmed=true`；
- 删除候选或正式数据集时清理规范化副本、知识、实体、关系和图谱，永久保留 `originals/`、`mappings/`、元数据、质量问题、运行报告和唯一删除审计；
- 重复删除直接返回已删除状态，不追加第二条审计记录；已删除数据集不能发布或读取图谱。
