# PingCode 资料预处理步骤详细设计

> 版本：v1.0  
> 日期：2026-07-27  
> 状态：v2 接口与基础实现已落地，Office/PDF 转换器细粒度来源映射仍需增强  
> 上位设计：`docs/08-pingcode-processing-six-step-pipeline-design.md`

## 一、设计范围

资料预处理是六步骤流水线的第一个前端可见步骤，负责把批次中的原始资源转换为后续步骤可消费的统一 Markdown、来源元数据和结构化处理单元。

本步骤只由代码驱动，不调用 Skill 或大模型。图片和附件已经在资料下载阶段完成下载及类型识别，本步骤只校验其引用关系和来源关联，不重复下载、不执行 OCR、不生成图片说明。

本步骤不做知识提取、摘要、分类、关键词生成、实体识别或关系识别。

## 二、目标与原则

### 2.1 目标

1. 保留每个资源的原始文件和完整来源信息；
2. 将 Office 和可提取文本的 PDF 转换为统一 Markdown；
3. 对 Markdown、纯文本和转换结果执行统一规范化；
4. 识别标题、段落、表格、列表、代码块和引用等结构，并从加工视图排除 C/C++ 代码块；
5. 按结构优先策略生成处理单元，默认单元上限为 6000 字符；
6. 建立 Markdown、规范化内容、处理单元与原始 Office/PDF 页码或结构位置之间的映射；
7. 单资源失败时隔离并允许后续单独重试，其他资源继续处理；
8. 生成通过 Schema 校验的步骤一产物，供步骤二读取。

### 2.2 不可违反的原则

- 原始文件只读保存，不被转换结果覆盖；
- 转换失败不影响其他资源，但该资源不能进入步骤二；
- 不支持格式进入隔离状态，不伪装为已处理；
- PDF 暂不自动 OCR，扫描型 PDF 标记为 `ocr_required`；
- 任何内容排除、转换失败和来源映射缺失都必须记录中文质量问题；
- 处理单元是原文的处理视图，不代表删除原文；
- 输出路径对外只返回相对 `runRoot` 的路径。

## 三、输入与资源前提

### 3.1 输入

| 输入 | 来源 | 必填 | 说明 |
|---|---|---:|---|
| `MaterialBatch` | 批次服务 | 是 | 批次、资源清单、来源类型和逻辑路径 |
| 原始资源 | 下载目录或上传目录 | 是 | 已下载的页面、Office、PDF、文本和附件 |
| 资源元数据 | 下载/上传阶段 | 是 | `resourceId`、文件名、媒体类型、来源定位和内容哈希 |
| `PreprocessConfig` | 任务请求 | 是 | 转换、规范化、结构解析和处理单元配置 |
| 格式转换器注册表 | 服务配置 | 是 | Office/PDF/文本转换器及版本 |

### 3.2 上游已完成的工作

以下工作属于资料下载或批次准备阶段，不在本步骤重新执行：

- PingCode 页面下载；
- 页面内图片下载；
- 附件下载；
- 图片和附件的初步媒体类型识别；
- 资源与页面、空间、逻辑路径的关联。

本步骤仍需检查引用目标是否存在、引用路径是否安全、引用资源是否属于当前批次；检查失败时记录问题，但不重新下载资源。

### 3.3 支持格式

| 类型 | 处理策略 | 结果 |
|---|---|---|
| Markdown | 直接读取并规范化 | 统一 Markdown |
| 纯文本 | 按编码检测读取，转换为 Markdown 正文 | 统一 Markdown |
| DOC/DOCX | DOCX 优先使用 OOXML 解析保留正文与嵌入图片，其他 Office 格式使用版本化 Office 转换器 | 统一 Markdown、图片资产及来源映射 |
| XLS/XLSX | 按工作表、行列转换为 Markdown 表格 | 统一 Markdown及单元格映射 |
| PPT/PPTX | 按幻灯片和文本块转换为 Markdown | 统一 Markdown及来源映射 |
| 可提取文本 PDF | 按页、段落和表格转换为 Markdown | 统一 Markdown及页码映射 |
| 扫描型 PDF | 不自动 OCR | `ocr_required` 隔离 |
| 图片、已下载附件 | 不转换为正文 | 作为关联资源保留 |
| 不支持格式或危险文件 | 不进入处理 | 单资源隔离 |

Office/PDF 转换器不能输出无来源的自由文本。转换后的每个 Markdown 结构块必须能够关联原始页码、段落、工作表、幻灯片、表格或单元格位置。

## 四、配置契约 `PreprocessConfig`

```json
{
  "preset": "training_standard",
  "conversionProfile": "office_pdf_markdown_v1",
  "encodingPolicy": "detect_then_utf8",
  "unicodeNormalization": "NFC",
  "segmentationStrategy": "structure_first",
  "maxUnitCharacters": 6000,
  "boundaryContextMode": "metadata",
  "fallbackOverlapCharacters": 0,
  "preserveTables": true,
  "preserveCodeBlocks": true,
  "excludeCCodeBlocks": true,
  "preserveImagesAsReferences": true,
  "enableOcr": false
}
```

约束：

- `maxUnitCharacters` 默认是 6000，必须大于 0；
- `enableOcr` 当前固定为 `false`，请求传入 `true` 时拒绝配置，不静默启用；
- `fallbackOverlapCharacters` 默认是 0；
- 转换器和规范化策略必须记录版本；
- `excludeCCodeBlocks` 默认固定为 `true`；只排除 C/C++ 代码块，SQL、Shell、Java、JSON 等代码块继续保留；
- 配置变化会使步骤一及后续产物失效并重新执行。

前端不提供任务级加工参数编辑入口，预览和知识加工均省略 `config`，由后端使用上述设计基线。公开 API 使用 `maxUnitCharacters` 和 `fallbackOverlapCharacters`；为读取历史任务和兼容旧调用，后端继续接受 `chunkSize/chunkOverlap`，但新旧字段同时出现且值不一致时必须拒绝请求，新运行产物不得继续输出旧字段。

前端执行边界统一为一个知识加工任务：源文件检查只负责扫描、类型识别、问题展示和单文件加工预览，不再创建独立的资料预处理任务；用户启动知识加工后，由六步骤流水线第一步执行正式资料预处理并生成唯一的正式产物。`/api/preprocess/pipeline` 保留为后端兼容和专项调试接口，但不作为普通知识加工页面的第二个任务入口，避免同一批次出现两套预处理任务、两套状态和两套产物归属。

单文件预览、训练预检和正式资料预处理必须调用同一个结构优先处理单元构建器，使用完全相同的清洗结果、结构块识别、C/C++ 代码块排除和 `maxUnitCharacters/fallbackOverlapCharacters` 配置。预检可以只在内存中构建处理单元，但不得使用另一套字符窗口切分逻辑估算数量。三处返回的处理单元数量必须一致；如输入在预检后发生变化，应通过输入哈希变化明确提示重新预检。

每次训练预检生成唯一 `preflightId`，并持久化批次、输入哈希、配置、文档数、处理单元数、最大单元字符数和创建时间。正式任务的 `run-manifest.json` 引用最近且输入哈希一致的预检快照；最终运行报告对比预检与正式产物数量、配置和哈希，不一致时必须记录质量问题。

源文件检查阶段必须提供批次级预处理汇总，不能只展示“文本文件”和“待转换”。汇总至少包含总文件数、可直接处理数、可转换处理数、需要 OCR 数、不支持或隔离数、转换失败数、重复文件组、空文件数、总大小、预计处理单元数、工具就绪状态和问题严重度分布。`docx/pdf/html/其他 Office/markdown/text` 只要具备本地转换器或直接解析能力，就应计入可处理资源；扫描型 PDF 因当前不启用 OCR，计入 `ocr_required` 而不计入可启动加工资源。

单文件加工预览必须展示源文件元信息与转换 Markdown 的差异。Office/PDF 等二进制源文件不做逐字 diff，而是把源文件元信息和结构特征（文件名、格式族、大小、页数、段落数、表格数、图片数、工作表数、幻灯片数、标题线索、媒体类型、哈希、转换器识别结果）与转换 Markdown 结构特征（标题数、段落数、表格数、列表数、代码块数、图片引用数、字符数、处理单元数、来源映射覆盖率）进行结构化对照。文本 diff 聚焦 `convertedMarkdown` 与 `cleanedMarkdown`，用于观察规范化、代码块排除和引用重写带来的变化。预览产物标记为 `preview_only`，不得作为正式知识事实来源。

源文件元信息中的空值必须区分为 `不适用`、`未统计` 和 `解析失败`：例如 DOCX 的页数属于不适用，字符数属于应统计但未统计/统计失败的情况，缺少 OOXML 包或正文 XML 时属于解析失败。前端不再用单一 `-` 混淆这些语义。

## 五、处理流程

```text
读取批次资源清单
  -> 校验资源路径、存在性、哈希和安全性
  -> 保存/确认原始资源索引
  -> 判断资源处理策略
      -> Markdown/文本：读取和规范化
      -> Office/PDF：转换为 Markdown，并建立来源映射
      -> 图片/附件：校验引用关系后登记
      -> 不支持/危险/扫描 PDF：单资源隔离
  -> 生成结构块
  -> 结构优先生成处理单元
  -> 写入三层内容和 JSONL 产物
  -> Schema 校验
  -> 原子提交步骤结果
```

### 5.5 超长文章处理

超长文章的处理逻辑位于代码侧的结构块解析器和处理单元构建器，不依赖大模型。处理过程如下：

1. 先按空行、标题和 Markdown 结构块识别文章边界，并维护标题路径；
2. 从前到后累积结构块，累计字符数不超过 `maxUnitCharacters`（默认 6000）时放入同一个处理单元；
3. 当前结构块加入后会超过上限时，在前一个完整结构块边界结束当前单元，再创建下一个单元；
4. 单个结构块本身超过上限时，按字符上限进行保底切分，并保留原处理单元的规范化偏移和内容哈希；
5. 每个单元记录 `previousChunkId`、`nextChunkId`、标题路径、规范化偏移和来源位置，后续步骤通过相邻单元关系获取上下文；
6. 默认 `fallbackOverlapCharacters=0`，因此不会复制正文内容；只有未来启用安全后备重叠时，才在单元记录中标记重叠来源和偏移。

这意味着“超长文章”不会被整体送入后续 Agent，也不会丢弃原文：原文保存在 `originals/`，规范化全文保存在 `normalized/`，后续知识提取只消费有边界、有哈希、可回查的处理单元。

### 5.1 资源安全检查

代码检查：

1. 资源路径是否位于允许的批次根目录；
2. 规范化路径是否包含目录穿越或绝对路径；
3. 文件是否存在且可读；
4. 文件大小是否超过配置上限；
5. 实际文件类型是否与声明扩展名冲突；
6. 是否为可执行文件、特殊文件或危险归档；
7. 内容哈希是否与上游登记值一致。

安全检查失败的资源进入 `quarantined`，不会写入处理单元。

### 5.2 Office/PDF 转 Markdown

转换器按资源类型选择，并返回统一的 `ConversionResult`：

```json
{
  "state": "completed",
  "converterId": "pdf-markdown-converter",
  "converterVersion": "1.0.0",
  "markdownArtifact": "normalized/resource_xxx.md",
  "sourceMapArtifact": "mappings/resource_xxx.json",
  "sourceBlocks": 18,
  "warnings": []
}
```

转换要求：

- 保留标题层级、段落顺序、表格、列表、代码样式和必要的分页信息；
- PDF 页面使用 `<!-- source: page=3 -->` 等机器可解析标记或等价元数据，不把页码伪装成正文；
- Office 文档记录段落、表格、工作表、幻灯片和单元格位置；
- DOCX 嵌入图片从 `word/media/*` 提取为批次资产，并在 Markdown 中保留相对引用，例如 `../assets/resource_xxx/image_01.png`；
- 图片只作为关联资源和证据层资产保留，不直接生成最终知识节点或关系；
- 转换失败保留原始文件，写入 `conversion_failed` 和可重试参数；
- 扫描型 PDF 写入 `ocr_required`，不生成没有可靠来源映射的 Markdown。

### 5.3 内容规范化

规范化只处理表示层，不改变语义内容：

- 检测原始编码并转换为 UTF-8；
- 统一换行符；
- 按配置执行 Unicode NFC 规范化；
- 清理不可见控制字符；
- 统一 Markdown 图片和附件引用为批次内相对路径；
- 保留表格、标题、列表和非 C/C++ 代码块；
- 显式标记为 `c/cpp/c++/h/hpp` 等语言的围栏代码块从规范化加工视图排除；
- 无语言标记的围栏只有命中 `#include`、`int main(...)` 等强 C 语法特征时才排除，避免误删 SQL 和伪代码；
- 被排除代码以不含源码的机器可识别占位注释替代，原始源码只保留在 `originals/`；
- 任何删除或替换必须产生 `normalizationEvent`，包含原文偏移和原因。

每条 C/C++ 代码块排除记录至少包含：`blockId`、`language`、`detectionMethod`、`originalOffsets`、`normalizedOffsets`、`contentHash`、`reason` 和 `closedFence`。加工单元构建器忽略占位注释，保证源码不会进入元数据、知识提取 Agent 或最终知识。

### 5.4 结构解析

解析器识别以下结构块：

```text
heading / paragraph / table / list / code_block / quote / image / attachment / page_break
```

每个结构块包含：

- `blockId`；
- `blockType`；
- `headingPath`；
- Markdown 起止偏移；
- 原始来源映射；
- 内容哈希；
- 解析警告。

### 5.5 处理单元切分

采用结构优先的单元切分策略：

1. 短文档可以整篇生成一个处理单元；
2. 在不超过 6000 字符时，优先保持完整标题、段落、表格、列表和保留的非 C/C++ 代码块；
3. 超过上限时，优先在标题和结构块边界切分；
4. 单个结构块本身超过上限时，按句子、行或表格行二次切分；
5. 表格不在单元中间截断，必要时按完整行切分并保留表头；
6. 非 C/C++ 代码块不在语句中间截断，无法安全切分时作为超长单元并记录告警；C/C++ 代码块在切分前已经排除；
7. 默认不重叠，跨单元上下文由相邻单元 ID、标题路径和来源映射提供；
8. 只有安全边界不足时才启用后备重叠，并记录重叠来源和偏移。

## 六、来源映射设计

### 6.1 映射目标

来源映射必须支持从最终证据回查到：

```text
knowledge evidence
  -> processing unit
  -> normalized Markdown offset
  -> source map
  -> original file + page/paragraph/table/cell location
```

### 6.2 Office/PDF 来源位置

```json
{
  "sourceResourceId": "resource_xxx",
  "sourceFormat": "pdf",
  "originalArtifact": "originals/resource_xxx.pdf",
  "markdownRange": {"start": 120, "end": 180},
  "locations": [
    {
      "kind": "page",
      "pageNumber": 3,
      "blockIndex": 2,
      "sourceText": "YAS-00001 表示参数无效。"
    }
  ]
}
```

Office 位置根据类型扩展：

```json
{
  "kind": "office_table_cell",
  "sheetName": "错误码",
  "tableIndex": 0,
  "rowIndex": 4,
  "columnIndex": 2,
  "paragraphIndex": 0
}
```

映射要求：

- 允许一个 Markdown 范围对应多个原始位置；
- 不允许没有来源位置的转换文本标记为 `mappingState=complete`；
- 映射不完整时资源可保留为 `completed_with_warnings`，但相关内容不能作为最终证据；
- 映射文件与 Markdown 文件分别计算哈希并写入产物索引。

## 七、产物设计

### 7.1 运行目录

```text
training-runs/<taskId>/
├── originals/
├── normalized/
├── mappings/
├── metadata/
│   ├── source-documents.jsonl
│   ├── chunks.jsonl
│   └── structure-blocks.jsonl
├── quality/
│   └── preparation-issues.json
└── stage-result.json
```

### 7.2 源文档记录

```json
{
  "resourceId": "resource_xxx",
  "sourcePath": "docs/error-code.pdf",
  "sourceType": "pingcode",
  "mediaType": "application/pdf",
  "processingState": "completed",
  "originalArtifact": "originals/resource_xxx.pdf",
  "normalizedArtifact": "normalized/resource_xxx.md",
  "sourceMapArtifact": "mappings/resource_xxx.json",
  "originalHash": "sha256:...",
  "normalizedHash": "sha256:...",
  "converterId": "pdf-markdown-converter",
  "converterVersion": "1.0.0",
  "originalCharacters": null,
  "normalizedCharacters": 7950,
  "mappingState": "complete",
  "excludedRanges": [],
  "normalizationEvents": [],
  "warnings": []
}
```

资源状态：

```text
completed / completed_with_warnings / conversion_failed /
ocr_required / unsupported / quarantined / cancelled
```

### 7.3 处理单元记录

```json
{
  "chunkId": "resource_xxx:0",
  "resourceId": "resource_xxx",
  "sourcePath": "docs/error-code.pdf",
  "chunkIndex": 0,
  "headingPath": ["错误码", "参数错误"],
  "content": "YAS-00001 表示参数 p_size 无效。",
  "contentHash": "sha256:...",
  "normalizedOffsets": {"start": 120, "end": 145},
  "sourceLocations": [
    {"kind": "page", "pageNumber": 3, "blockIndex": 2}
  ],
  "previousChunkId": null,
  "nextChunkId": "resource_xxx:1",
  "overlap": {"enabled": false, "sourceChunkId": null}
}
```

### 7.4 质量问题

每条问题至少包含：

```json
{
  "issueId": "issue_xxx",
  "resourceId": "resource_xxx",
  "severity": "warning",
  "code": "PDF_MAPPING_INCOMPLETE",
  "state": "conversion_failed",
  "message": "PDF 第 3 页文本转换成功，但部分文本无法建立原始位置映射，资源已隔离，支持单独重试。",
  "retryable": true,
  "artifact": "originals/resource_xxx.pdf"
}
```

## 八、失败、隔离与重试

### 8.1 单资源隔离

以下情况只隔离当前资源，不阻止批次其他资源：

- 不支持格式；
- 危险文件或路径不安全；
- Office/PDF 转换失败；
- PDF 需要 OCR；
- 来源映射缺失或不完整；
- 文件损坏、乱码且无法恢复；
- 引用的附件不存在。

隔离资源必须保留原文件、处理状态、中文原因、失败阶段、转换器版本和重试信息。

### 8.2 单资源重试

代码提供单资源重试，不重新处理已经成功的资源：

```text
retry_material(resourceId, options) -> MaterialRetryResult
```

重试前重新校验：

1. 原始文件仍存在且哈希未变；
2. 转换器版本或配置是否已变化；
3. 原因是否可重试；
4. 是否存在正在运行的同资源任务。

重试成功后，原资源的相关规范化文件、映射、处理单元和质量问题采用新的版本标识原子替换；其他资源产物不变，步骤二及后续步骤按输入哈希重新判断是否失效。

### 8.3 批次级失败

仅在以下情况将步骤一标记为 `failed`：

- 批次资源清单无法读取；
- 运行目录无法写入；
- 关键 Schema 或转换器注册表无法加载；
- 批次没有任何可进入步骤二的 Markdown 文档；
- 用户取消导致步骤无法完成原子提交。

存在部分成功资源和部分隔离资源时，步骤一为 `completed_with_warnings`，并生成可继续处理的后续产物。

## 九、步骤结果与事件

### 9.1 `StageResult`

```json
{
  "stage": "material_preparation",
  "state": "completed_with_warnings",
  "inputCount": 42,
  "outputCount": 38,
  "failedCount": 0,
  "skippedCount": 4,
  "startedAt": "2026-07-27T10:00:00+08:00",
  "completedAt": "2026-07-27T10:02:10+08:00",
  "durationMs": 130000,
  "message": "资料预处理完成：38 个资源可进入下一步，4 个资源已隔离，可单独重试。",
  "artifacts": [
    "metadata/source-documents.jsonl",
    "metadata/chunks.jsonl",
    "metadata/structure-blocks.jsonl",
    "quality/preparation-issues.json"
  ],
  "metrics": {
    "processableResources": 38,
    "isolatedResources": 4,
    "convertedOfficePdf": 12,
    "ocrRequired": 1,
    "processingUnits": 186
  }
}
```

### 9.2 事件

至少产生：

```text
stage.started
resource.started
resource.converted
resource.isolated
resource.failed
resource.retryable
stage.completed / stage.failed / stage.cancelled
```

事件中文消息必须说明资源、处理结果和下一步操作。事件不得包含密码、Cookie、完整文件内容或绝对服务器路径。

## 十、校验与完成条件

### 10.1 输入校验

- 批次存在且资源清单可读；
- 所有资源路径位于批次根目录；
- 上游声明的下载文件存在；
- 图片和附件引用目标可解析或产生质量问题；
- 转换器、Schema 和配置版本可用。

### 10.2 输出校验

- 每个可处理资源有源文档记录；
- Office/PDF 资源有统一 Markdown 和来源映射；
- 可进入后续步骤的每个处理单元有稳定 ID、内容哈希、规范化偏移和原始位置；
- 表格、保留的非 C/C++ 代码块、图片引用和附件引用通过结构校验；
- C/C++ 源码不出现在 `normalizedArtifact` 的正文处理块、`chunks.jsonl` 或后续 Agent 输入中，且每次排除均可通过 `excludedRanges` 回查原始文件；
- 所有输出文件哈希已记录；
- 临时文件通过 Schema 校验后才原子替换正式产物。

### 10.3 进入步骤二的条件

只有 `processingState=completed` 或 `completed_with_warnings` 且 `mappingState` 满足当前资源类型要求的资源，才能进入步骤二。

`unsupported`、`quarantined`、`conversion_failed` 和 `ocr_required` 只进入质量汇总，不进入元数据构建的文档和处理单元输入。

## 十一、接口与伪代码

```text
interface MaterialPreparationStage:
  validate_inputs(context) -> ValidationResult
  prepare(context) -> StageResult
  retry_resource(context, resourceId, options) -> RetryResult
  validate_outputs(context, result) -> ValidationResult
```

```text
prepare(context):
  validate batch, resource paths, schemas and converter registry
  for resource in batch.resources:
    persist original resource reference
    inspect security, existence and hash
    if image or attachment:
      validate reference and persist metadata
      continue
    if unsupported or unsafe:
      isolate resource with Chinese reason
      continue
    if office or extractable pdf:
      convert to markdown and build source map
    if scanned pdf:
      isolate as ocr_required
      continue
    normalize content
    parse structure blocks
    build structure-first processing units with max 6000 characters
    validate resource outputs
  atomically persist batch outputs and StageResult
```

## 十二、验收标准

1. Markdown、纯文本、Office 和可提取文本 PDF 均能形成统一 Markdown；
2. 原始 Office/PDF 文件、规范化 Markdown 和处理单元同时保留；
3. 证据可从处理单元精确回查到 Markdown，并进一步定位到 PDF 页码或 Office 段落/表格/单元格；
4. 扫描型 PDF 不自动 OCR，状态为 `ocr_required`；
5. 不支持格式只隔离当前资源，其他资源继续处理；
6. 转换失败资源可以单独重试，成功资源不会被重复处理；
7. 默认处理单元上限为 6000 字符，结构块不被无故截断；
8. 默认无重叠，启用后备重叠时记录来源和偏移；
9. 图片和附件不在本步骤重新下载或调用模型；
10. 任何无法回查的来源映射都不能作为后续最终知识证据；
11. 真实后端 API 验证 Office、PDF、转换失败重试、不支持格式隔离和批次部分成功场景。
12. 真实后端 API 验证显式 C/C++ 围栏和强特征无语言围栏被排除，SQL 围栏保留，原始文件不变。
13. 前端不显示“加工配置”、字符上限或重叠字符输入；省略配置的真实 API 请求使用 `maxUnitCharacters=6000` 和 `fallbackOverlapCharacters=0`。
14. 前端只展示一个知识加工任务；资料预处理状态只出现在六步骤流水线第一步，不再单独展示“资料预处理任务”。
15. 对同一输入哈希和配置，预览、预检与正式预处理生成的处理单元数量、ID 顺序和内容哈希一致。
16. 预检快照具有唯一 `preflightId`，正式任务可从运行清单反查预检数量和输入哈希。

## 十三、待实现项

- Office/PDF 转换器的细粒度段落、表格、页码来源映射；
- PDF 文本块到页码的具体解析库和映射算法；
- Office 段落、表格单元格到 Markdown 范围的映射算法；
- 超长表格和代码块的安全切分实现；
- 单资源重试 API 的权限和前端交互；
- 真实批次 API 的完整验收样例。

当前实现说明：后端已提供统一配置、原始/规范化/结构化三层产物、JSONL 元数据、结构优先处理单元、原子写入和 PDF 无文本隔离；Office/PDF 当前使用系统 `libreoffice`/`pdftotext`，部署环境必须提供这两个命令。单资源重试 API、完整 Office/PDF 精确 source map 和真实转换器回归样例仍未完成，不能宣称已满足对应验收项。
