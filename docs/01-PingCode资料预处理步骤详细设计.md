# PingCode 资料预处理步骤详细设计

> 版本：v1.1
> 日期：2026-08-07
> 状态：v2 基础实现已落地；方案 C 快照发布与 single-flight 已实现并通过核心真实 API 验证；Office/PDF 转换器细粒度来源映射仍需增强
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
│   ├── source-resources.jsonl
│   ├── source-assets.jsonl
│   ├── ingestion-report.json
│   ├── source-documents.jsonl
│   ├── chunks.jsonl
│   └── structure-blocks.jsonl
├── quality/
│   └── preparation-issues.json
└── stage-result.json
```

### 7.2 源文档记录

资料预处理先输出资源级追溯产物，再输出可进入元数据构建的源文档和处理单元：

- `metadata/source-resources.jsonl`：每个原始、解包或转换登记资源一条记录，包含 `resourceId/sourceResourceId/parentResourceId/sourcePath/displayName/mediaType/formatFamily/contentHash/processingState/originalArtifact/normalizedArtifact/assetPaths/issueCodes`。
- `metadata/source-assets.jsonl`：图片资源和 Office 转换保留的内嵌素材清单，包含 `assetId/resourceId/sourceResourceId/sourcePath/mediaType/artifactPath/assetKind/processingState`。
- `metadata/ingestion-report.json`：资源接入汇总，包含资源数、文档数、处理单元数、素材数、状态分布、格式分布和本次输入哈希。

上述三个产物是资源预处理增强的追溯根，不替代既有 `source-documents.jsonl/chunks.jsonl/structure-blocks.jsonl`，后续阶段必须继续兼容旧产物。

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

重试成功后，原资源的相关规范化文件、映射、处理单元和质量问题采用新的版本标识发布；其他资源产物不变，步骤二及后续步骤按输入哈希重新判断是否失效。方案 C 下“发布”必须创建新的不可变 `runId`，不得原地替换已经提交的运行目录；本段的原子替换仅适用于新 staging 内尚未提交的文件。

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
    "metadata/source-resources.jsonl",
    "metadata/source-assets.jsonl",
    "metadata/ingestion-report.json",
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

### 13.1 embedding 与聚类增强产物

资源预处理阶段在元数据、标题清洗和低成本初筛完成后，可以生成 embedding 与聚类报告，作为后续质量分析和调度优化依据。

- 配置来源：`tools/knowledge-processing/pingcode-processing/metadata-rules/embedding-rules.yaml`。
- embedding 产物：`metadata/embedding-index.jsonl` 和 `quality/embedding-issues.json`。
- 聚类产物：`metadata/cluster-report.json` 和 `quality/cluster-issues.json`。
- 默认 provider：`deterministic_hash`，不依赖外部 API Key，用于本地和 CI 稳定验证。
- 失败策略：provider 不可用、超时、维度不一致和缓存损坏均降级为 warning，不阻断 `keyword_analysis`。
- 边界：cluster 不进入关键词图谱，不直接生成关键词，也不接入正式知识构建调度。

### 13.2 大规模 embedding 聚类性能设计

现场任务 `training_ca4bde5bb7ae453e` 已生成 13,015 条 embedding。当前 `cosine_threshold_connected_components` 对全部向量执行两两余弦，需要比较 `13,015 * 13,014 / 2 = 84,688,605` 对，时间复杂度为 `O(N^2 * D)`；单线程计算期间没有取消检查和公开进度。

#### 方案比较

| 方案 | 准确性 | 时间复杂度 | 额外内存 | 兼容性与业务语义 | 结论 |
| --- | --- | --- | --- | --- | --- |
| A. 超过阈值跳过聚类 | 不产生错误簇，但大样本没有任何聚类结果 | `O(N * D)` 读取 | `O(N * D)` 向量 | 无依赖、改动最小；大批次 `clusterCount=0`，明显改变“生成聚类报告”的业务语义 | 只可作为显式降级开关，不推荐作为默认修复 |
| B. 小样本精确 + 标准库确定性 LSH 候选 + 候选内精确余弦 | 小样本与现实现完全一致；大样本候选内无假阳性，但 LSH 未召回的真实近邻会形成假阴性，可能拆分簇 | `O(N*T*B*D + N*T*log N + N*k*D)`，固定参数下近似 `O(N log N + N*k)` | 向量外增加 `O(N*T + k)`；不保存全局候选对 | 无新依赖、公共 API 不变；大样本从精确连通分量变为确定性近似连通分量，报告必须声明策略和候选统计 | 推荐，等待人工确认语义变化 |
| C. 引入成熟近邻/聚类依赖 | 取决于库与索引；可获得成熟 ANN、调参和性能实现 | 通常近似 `O(N log N)` 构建与查询 | 取决于索引，通常高于 B | 需要新增 Python/原生依赖、镜像和安全审查；`sklearn` 当前未安装，且其通用余弦近邻不保证避免高维退化 | 本轮不采用，必须单独审批 |

推荐方案 B。小样本阈值 `exactMaxEmbeddings` 以下继续执行全量精确比较，保证既有测试和小批次成员结果完全一致；大样本使用确定性随机超平面 LSH 只生成有界候选，再用现有 `_cosine` 做阈值判定。候选阶段只决定“比较谁”，不能直接建立聚类边，因此不会产生低于阈值的错误连边。

建议规则全部进入 `embedding-rules.yaml`，不在代码硬编码：

```yaml
cluster:
  exactMaxEmbeddings: 2000
  candidateStrategy: deterministic_lsh
  lshTables: 8
  lshBits: 12
  maxCandidatesPerEmbedding: 64
  lshSeed: yashandb-cluster-v1
```

13,015 条向量在 `k=64` 时最多执行 `832,960` 次候选余弦；即使允许双向重复，也受 `N*k` 上界约束，相比 84,688,605 次全量比较减少约 99%。随机超平面由 `lshSeed/table/bit/dimensionIndex` 的 SHA-256 确定性生成，输入先按 `embeddingId` 排序，因此不依赖进程随机种子或输入顺序。

#### 内部接口

```python
def EmbeddingClusterService.build(
    self,
    run_root: Path,
    embedding_index: list[dict[str, Any]],
    documents: list[dict[str, Any]],
    *,
    cancel_check: Callable[[], None] | None = None,
    progress: Callable[[str, int, int, dict[str, Any]], None] | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]: ...

def MetadataConstructionService.build(
    ...,
    cancel_check: Callable[[], None] | None = None,
    progress: Callable[[str, int, int, dict[str, Any]], None] | None = None,
) -> MetadataConstructionReport: ...
```

两个参数均为可选内部关键字参数，不改变 HTTP API。进度阶段固定为 `load_vectors/candidate_generation/candidate_comparison/finalize`；每个向量、每个 LSH 表桶和每批候选余弦比较之间检查取消。TrainingService 后续把它映射为 `metadata_construction.cluster.progress`，并按 1 秒或固定工作量节流。

#### 伪代码

```text
build(vectors):
  ids = sort(embeddingIds)
  normalize vectors once
  if N <= exactMaxEmbeddings:
    for each exact pair:
      check_cancel(); exact_cosine_and_union()
    strategy = exact_all_pairs
  else:
    hyperplanes = deterministic_hyperplanes(seed, tables, bits, dimension)
    buckets = build signatures for every table and vector
    for each id in stable order:
      check_cancel()
      candidates = bounded neighbors from its buckets
      rank by sharedBucketCount desc, candidateId asc
      for candidate in first k:
        check_cancel_per_batch()
        if exact_cosine >= threshold: union()
    strategy = deterministic_lsh_bounded
  build connected components and persist atomically
```

桶内不得枚举所有组合。每个桶成员按 `sha256(table, embeddingId)` 排序，每个向量只查看固定环形窗口；跨表按共同命中次数合并并截断到 `k`。候选在当前向量处理完后即可释放，不保留最多 80 万个 Python tuple，从而将候选额外内存保持在 `O(N*T + k)`。

报告兼容保留现有 `algorithm/threshold/clusters` 字段，新增 `candidateStrategy/exactMode/candidateComparisonCount/candidateLimit/lshParameters` 作为审计信息。相同输入、配置和规则版本必须得到相同成员与 `clusterId`；大样本配置变化必须进入规则哈希并生成新 metadata 快照。

#### 人工确认点

- [ ] 确认采用方案 B，并接受大样本可能因候选漏召回而拆分簇的语义变化。
- [ ] 确认建议默认值 `exactMaxEmbeddings=2000`、`k=64`、8 表、每表 12 bit；参数需用基准测试校准后才能标记完成。
- [ ] 若不能接受近似结果，应选择方案 A 显式跳过，或单独批准方案 C 的新依赖评审；不得继续无界 `O(N^2)`。

- Office/PDF 转换器的细粒度段落、表格、页码来源映射；
- PDF 文本块到页码的具体解析库和映射算法；
- Office 段落、表格单元格到 Markdown 范围的映射算法；
- 超长表格和代码块的安全切分实现；
- 单资源重试 API 的权限和前端交互；
- 真实批次 API 的完整验收样例。

当前实现说明：后端已提供统一配置、原始/规范化/结构化三层产物、JSONL 元数据、结构优先处理单元、原子写入和 PDF 无文本隔离；Office/PDF 当前使用系统 `libreoffice`/`pdftotext`，部署环境必须提供这两个命令。单资源重试 API、完整 Office/PDF 精确 source map 和真实转换器回归样例仍未完成，不能宣称已满足对应验收项。

## 十四、不可变资料准备快照（方案 C）

> 适用版本：方案 C v1，更新日期：2026-08-07。公共快照、commit、latest 和 single-flight Schema 以 [六步骤流水线 16 节](./08-pingcode-processing-six-step-pipeline-design.md#十六方案-c不可变快照与并发协调契约) 为准，本节只定义步骤一的生产者职责。

### 14.1 接口与报告契约

```python
def prepare(
    batch_id: str,
    resource_snapshot: ArtifactSnapshotRef,
    parent_task_id: str | None = None,
    stage_run_id: str | None = None,
) -> PreparationReport: ...


class PreparationReport:
    snapshot_ref: ArtifactSnapshotRef | None
    manifest_path: str | None  # 历史兼容
    output_root: str | None    # 历史兼容
    stage_result: StageResult
```

新执行成功或部分成功时 `snapshot_ref` 必填，并指向 `stage=material_preparation` 的已提交快照。`manifest_path/output_root` 在兼容期继续回填，但步骤二必须优先读取 `snapshot_ref`，不能用它们或 `preparation/latest.json` 替代本次固定输入。

### 14.2 两阶段发布伪代码

```text
prepare(batchId, resourceSnapshot):
  executionHash = hash(stageVersion, resourceSnapshot.manifestHash,
                       preprocessConfigHash, ruleSetHash)
  flight = single_flight(batchId, "material_preparation", executionHash)
  if flight.completed: return report(flight.snapshotRef)
  if flight.follower: return report(await flight.ownerResult)

  staging = begin_snapshot(batchId, stage, uniqueRunId)
  try:
    # 不持 admission、single-flight、latest 或 state-store 锁
    convert_normalize_segment_into(staging)
    stream_write_jsonl_with_hash_count(staging)
    validate_required_artifacts_and_cross_references(staging)
    write manifest.json
    write commit.json last
    prepRef = atomic_publish_directory(staging, runs/runId)
    mark_single_flight_completed(executionHash, prepRef)
    commit_latest_cas(prepRef, expectedGeneration)
    return PreparationReport(snapshot_ref=prepRef, legacy_paths=...)
  except:
    mark_single_flight_failed(executionHash, classified_error)
    retain_or_clean_staging_by_recovery_policy
    raise
```

原 7.1 节的 `training-runs/<taskId>/` 是兼容视图；方案 C 的规范存储为 `artifacts/<batchId>/material_preparation/runs/<runId>/`。兼容视图只能引用已提交运行，不允许在原位置继续原地改写同一份正式产物。

### 14.3 步骤一 manifest 扩展

除公共字段外，步骤一 `manifest.json` 必须包含：

```json
{
  "resourceSnapshotRef": {
    "batchId": "batch_xxx",
    "stage": "resource_download",
    "runId": "download_xxx",
    "inputHash": "sha256:...",
    "manifestPath": "runs/download_xxx/manifest.json",
    "manifestHash": "sha256:...",
    "generation": 8053
  },
  "preprocessConfigVersion": "preprocess-config/v1",
  "converterRegistryVersion": "converter-registry/v1",
  "processableResourceCount": 8050,
  "isolatedResourceCount": 3
}
```

开始执行时固定 `resourceSnapshotRef`；下载状态或 latest 在运行期间发生变化，不改变本次输入。下载存在少量失败但仍有可加工资源时，资料下载告警可以保留，步骤一按固定清单继续并把失败资源计入质量问题。

### 14.4 状态与失败语义

```text
staging -> validating -> committed -> latest | superseded
   |           |
   +---------> failed
```

- `committed`：正式目录存在且 `commit.json`、manifest、必需产物、哈希、记录数和引用完整性均成立；
- `latest`：committed 后 latest CAS 成功；
- `superseded`：CAS 未命中，快照仍可按 `ArtifactSnapshotRef` 使用；
- `completed_with_warnings`：资源级隔离后仍有有效输入，且整个快照完整；
- `failed`：控制文件不可解析、哈希/引用不成立、没有可加工资源、I/O 或 Schema 阻断；
- 进程在 staging 阶段终止：不得出现可读的 `runs/<runId>`，恢复器按保留期清理；
- 所有者失败：single-flight 等待者收到同一结构化失败，可重新竞争下一 attempt。

步骤一的转换异常归类为 `ConversionError`，文件异常归类为 `file_io`，快照校验异常归类为 `ArtifactIntegrityError` 或 `SchemaValidationError`。步骤一不调用模型，任何这些异常都不得显示为“模型服务返回错误”。

### 14.5 锁与性能边界

步骤一只在 single-flight 登记/完成以及 latest CAS 时持对应短锁；扫描、Office/PDF 转换、规范化、分块、JSONL 写入、hash/count 和完整性校验全部锁外执行。相同 `executionHash` 只有一个 owner；不同输入使用不同 staging 和运行目录，可在 Worker 容量范围内并行。

## 十五、正式加工运行可观测性与扫描复用

### 15.1 问题与目标

`training_f1d9f8e63a184098` 的现场证据确认，`TrainingService._prepare_materials_from_stage_outputs` 在调用 `PreparationService.prepare` 前同步执行了默认参数的 `preprocess.scan(batchId)`。默认扫描不是轻量扫描，会对可转换文档执行预览转换；目标批次包含 1,694 个可转换文档，因此任务长时间停留在资料预处理且 `current=0,total=null`，并重复启动 LibreOffice 子进程。扫描结果在该方法中只用于汇总 `unsupportedFiles`，不是后续产物的正确性输入，因此这次完整扫描属于重复的非轻量工作。

该调用还没有父任务取消检查。任务进入 `cancelling` 后，扫描仍会继续启动新的转换子进程，直到完整扫描返回后才有机会进入 `cancelled`。修复必须同时解决重复扫描和取消传播，不能只增加前端进度文案。

正式知识加工进入 `material_preparation` 后，不能只记录阶段开始和阶段完成。对于万级资源批次，必须能区分以下状态：

- 正在读取已有扫描报告；
- 正在执行回退扫描；
- 正在生成资料预处理快照；
- 正在构建元数据；
- 正在装载并校验已提交产物。

正式加工优先复用已持久化的 `scan-report/latest.json`。只有扫描报告不存在或不可解析时，才执行轻量扫描。回退扫描不做 Office/PDF 预览转换，只负责格式、文件哈希和可加工性统计；正式转换由 `PreparationService.prepare` 负责。

扫描报告是进度和统计缓存，不是正式产物输入。资料预处理产物是否可复用，继续由 `PreparationService.prepare` 使用 `pipelineVersion + inputManifestHash + config` 计算的 `executionHash` 和 single-flight 已提交结果决定。训练编排不得把共享 `preparation/latest.json` 直接当作运行中输入；拿到 `PreparationReport.snapshotRef` 后，后续步骤固定使用该不可变引用。

### 15.2 接口

```python
def _scan_for_material_preparation(
    task_id: str,
    batch_id: str,
) -> ScanReport:
    """优先读取扫描快照，必要时执行可取消的轻量扫描。"""

def scan(
    batch_id: str,
    *,
    lightweight: bool = False,
    progress: Callable[[int, int, int, int], None] | None = None,
    cancel_check: Callable[[], None] | None = None,
) -> ScanReport:
    """内部可选取消回调；不改变 HTTP API。"""

def prepare(
    batch_id: str,
    config: PreprocessConfig | None = None,
    parent_task_id: str | None = None,
    stage_run_id: str | None = None,
    *,
    progress: Callable[[int, int, int, int, int], None] | None = None,
    cancel_check: Callable[[], None] | None = None,
) -> PreparationReport:
    """按顶层资源报告 current/total/succeeded/failed/skipped。"""
```

`cancel_check` 是内部兼容扩展，默认 `None`，现有调用方行为不变。训练回退扫描必须传入父任务取消检查；扫描在每个资源开始前、完成后和任何外部转换启动前检查取消。轻量扫描禁止进入预览转换，因此正常情况下不会创建 LibreOffice 子进程。

Preparation 的两个新增参数同样默认兼容。它在每个顶层资源开始前、完成后以及 PDF/Office 耗时转换前后检查取消；进度总数固定为归一化后的顶层输入数，归档展开不改变 `total`。TrainingService 按“至少间隔 1 秒、或新增 50 个资源、或到达终点”发布父任务进度，取消检查不参与节流。

缓存与快照复用条件：

| 对象 | 可复用条件 | 不满足时行为 |
| --- | --- | --- |
| `scan-report/latest.json` | 文件存在、JSON/Schema 可验证、`batchId` 一致；报告只用于阶段统计 | 记录 `scan_cache_invalid` 警告并执行可取消的轻量扫描 |
| preparation single-flight 结果 | `executionHash` 完全一致，已提交 `snapshotRef` 通过 commit、manifest、哈希和必需产物校验 | 成为新 owner，在独立 staging 中重新生成 |
| `PreparationReport.snapshotRef` | 本次 `prepare` 明确返回，且 batch/stage/run/hash 引用一致 | 阶段失败，不允许运行中回退读取 `latest.json` |

扫描报告即使较旧也不能影响正式处理结果；当前资源、配置或流水线版本变化时，`PreparationService.prepare` 的 `executionHash` 必须变化并阻止旧 preparation 快照复用。后续若要让预检显式固定 preparation `snapshotRef`，需单独设计预检契约；本修复不新增请求或响应字段。

任务事件使用以下事件名：

| 事件 | 说明 | 关键 details |
| --- | --- | --- |
| `material_preparation.scan.started` | 开始获取源文件扫描结果 | `operation` |
| `material_preparation.scan.progress` | 回退扫描进度 | `source=lightweight_scan`、`current`、`total` |
| `material_preparation.scan.completed` | 扫描结果可用 | `source`、`durationMs`、`totalFiles`、`processableCount` |
| `material_preparation.prepare.started` | 开始生成资料预处理快照 | `operation` |
| `material_preparation.prepare.progress` | 冷 preparation 资源进度 | `current`、`total`、`succeeded`、`failed`、`skipped` |
| `material_preparation.prepare.completed` | 资料预处理快照已提交 | `durationMs`、`runId`、`processableResources` |
| `metadata_construction.started` | 开始构建元数据 | `operation` |
| `metadata_construction.completed` | 元数据快照已提交 | `durationMs`、`runId`、`documentsCount`、`chunksCount` |
| `material_preparation.artifacts.started` | 开始装载和校验已提交产物 | `operation` |
| `material_preparation.artifacts.completed` | 产物装载完成 | `durationMs`、各类记录数 |

### 15.3 伪代码

```text
run_material_preparation(task):
  log scan.started
  try:
    scanReport = latest_scan_report(batchId)
    scanSource = latest_scan_report
  except report_missing_or_invalid:
    scanReport = scan(
      batchId,
      lightweight=true,
      cancel_check=check_cancelled,
      progress=throttled_progress(
        check_cancelled()
        update task progress
        log scan.progress
      )
    )
    scanSource = lightweight_scan
  log scan.completed(scanSource, duration, counts)

  check_cancelled()
  log prepare.started
  preparationReport = preparation.prepare(
    ...,
    cancel_check=check_cancelled,
    progress=lambda current,total,succeeded,failed,skipped:
      if elapsed >= 1s or current-lastCurrent >= 50 or current == total:
        update task progress(substage=prepare, current, total, succeeded, failed, skipped)
        log prepare.progress(current, total, succeeded, failed, skipped)
  )
  log prepare.completed(duration, runId, counts)

  check_cancelled()
  log metadata.started
  metadataReport = metadata.build(preparationReport.snapshotRef, ...)
  log metadata.completed(duration, runId, counts)

  check_cancelled()
  log artifacts.started
  load_and_validate_committed_artifacts()
  log artifacts.completed(duration, recordCounts)
```

### 15.4 取消与性能要求

- 回退扫描每个资源开始前和完成后检查取消状态；进度事件可按 50 个资源或不超过 1 秒的时间窗口节流，但取消检查不得随日志一起节流；
- preparation 每个顶层资源开始前和完成后检查取消，PDF/Office 转换启动前及返回后再次检查；冷 preparation 最长 1 秒或 50 个资源必须发布一次父任务进度；
- `cancel` 返回 `cancelling` 后 3 秒内停止启动新资源处理和新外部转换，并进入 `cancelled`；轻量扫描本身不得启动 LibreOffice；
- 读取已有扫描报告时不得重新遍历全部文件；
- preparation 缓存命中时不得重新执行 Office/PDF 转换；目标 8,053 文档批次在热缓存条件下 5 秒内离开资料预处理；
- `material_preparation` 不调用模型，新增日志不得使用模型错误分类；
- 日志只记录路径类别、runId、记录数和耗时，不写入文档正文或密钥；
- 任一同步子步骤超过预期时，最后一条 `*.started` 日志必须能够标明阻塞边界。

错误分类固定如下：扫描缓存缺失属于正常回退；缓存 JSON/Schema 无效归类为 `scan_cache_invalid` 并降级到轻量扫描；取消归类为 `TrainingCancelledError` 并进入取消终态；文件读取失败归类为 `file_io`；快照完整性失败归类为 `artifact_integrity`；Schema 失败归类为 `schema_validation`；未知错误归类为 `internal`。只有 `ModelGatewayError` 可以使用模型错误摘要，本阶段不得生成“模型服务返回错误”。

本修复不改变 `formal_knowledge` 的模型参与边界。正式知识提取仍沿用既有 Workflow Agent/模型网关路径；这里只修复其上游资料预处理编排。

### 15.5 验收标准

1. 存在扫描报告时，正式加工不调用 `preprocess.scan`；
2. 扫描报告缺失时，执行 `lightweight=True` 的回退扫描并输出进度事件；
3. 资料预处理、元数据构建和产物装载均输出 started/completed 成对事件；
4. 回退扫描期间发起取消，3 秒内进入 `cancelled`，取消后不再处理新资源且不创建新 LibreOffice 子进程；
5. preparation 缓存命中时不发生 Office/PDF 转换，目标批次热缓存下 5 秒内离开资料预处理；
6. 单元测试验证事件顺序、扫描报告复用、回退扫描参数、取消传播和错误分类；
7. 重启真实后端后，通过训练任务 API 和日志 API 验证新增事件可见，再进入前端启动验证。
8. 冷 preparation 事件包含 `current/total/succeeded/failed/skipped`，与 scan 子阶段明确区分，且计数单调不超过顶层输入总数。

### 15.6 Preparation 预哈希观测与快速身份缓存设计

#### 现场证据与精确边界

真实 API 任务 `training_aecc6fae273a42ab` 在新进程中于 11:51:21 写出 `material_preparation.prepare.started`。超过 30 秒后公开状态仍为上一子阶段 `scan 10873/10873`，日志没有 `prepare.progress`，工作线程单核约 94%。现有日志只能证明该同步区间超过 30 秒，不能给出各子步骤精确毫秒数。

代码调用顺序已经把耗时边界收敛为：

```text
files.records
  -> _normalize_source_records
       -> 对重复 ID 文件执行 SHA-256
  -> _input_snapshot
       -> 对所有规范化记录执行完整文件 SHA-256
  -> calculate inputManifestHash/executionHash
  -> reserve_flight
  -> begin_snapshot/run_started
  -> progress(0, total)
```

因此已有快照即使可以复用，也必须先完成全部文件正文哈希才能得到 `executionHash`；当前 progress、run event log 和 single-flight 判断都位于该耗时之后。这正是“缓存已有但仍长时间满核且只看到 prepare.started”的原因。

后续实现必须增加以下结构化计时，才能得到精确耗时而不是继续推测：

| 事件 | 指标 |
| --- | --- |
| `material_preparation.prepare.identity.started/completed` | 记录数、`durationMs`、`inputIdentityHash` 前缀 |
| `material_preparation.prepare.cache_lookup.completed` | `hit/miss/reason/durationMs`、候选 runId |
| `material_preparation.prepare.fingerprint.started/progress/completed` | `current/total/durationMs/bytesHashed` |
| `material_preparation.prepare.reserve.completed` | owner/follower/completed、`durationMs` |
| `material_preparation.prepare.process.progress` | 既有 succeeded/failed/skipped |

日志不得记录文件正文、完整路径或完整哈希。预哈希每个资源和每个 1 MiB 块继续检查取消；公开日志按 1 秒或 50 个资源节流。

#### 方案比较

| 方案 | 热命中性能 | 正确性 | 改动范围 | 结论 |
| --- | --- | --- | --- | --- |
| A. 只给预哈希增加进度/取消 | 仍需读取所有文件正文，无法保证 P95 小于 5 秒 | 与当前深哈希完全一致 | 最小 | 只能解决“看不见”，不能解决热缓存失效 |
| B. 快速输入身份匹配已提交 latest；miss 后再深哈希 | 命中只读取资源清单和快照控制文件，目标 P95 小于 5 秒 | 依赖“同一资源身份下正文不可原地变更”约束；miss 路径仍由深哈希保证 | Preparation 内部最小改动，不改公共 API | 推荐，等待性能/正确性确认 |
| C. 下载/上传入口持久化每资源内容哈希，Preparation 直接复用 | 热命中和冷执行都可避免重复正文哈希 | 最强；内容哈希成为正式资源契约 | 涉及下载、上传、历史回填和资源 Schema | 长期方案，超出本次最小修复 |

推荐 B，同时把 C 作为后续资源契约升级。A 必须作为 B 的一部分实施，用于历史快照首次运行、身份 miss 和快照损坏回退时的可观测性。

#### 快速输入身份

`inputIdentityHash` 只使用已经读取的资源清单，不打开文件正文：

```text
hash(
  pipelineVersion,
  preprocessConfigHash,
  ordered normalized records[
    id, batchId, kind, pageId, logicalPath, size,
    sourceType, processingStage
  ],
  normalization issue fingerprints
)
```

实现不得把 `inputIdentityHash` 当成现有深内容 `inputManifestHash` 或最终 `executionHash`。它只用于查找候选快照；候选快照必须是过去通过深内容哈希、完整处理和原子提交得到的不可变快照。

快速命中条件全部成立才可返回：

1. `preparation/latest.json` 可解析并指向 committed snapshot；
2. snapshot manifest/commit 与 ref 的 batch、stage、runId、manifestHash 一致；
3. manifest 的 `pipelineVersion/configHash/inputIdentityHash` 与当前一致；
4. manifest 包含全部必需产物描述符；后续消费者仍按现有 ArtifactRepository 校验具体产物哈希；
5. 当前资源发布契约保证同一身份记录不会原地替换正文；内容变化必须生成新的资源记录、大小、版本或原子资源清单。

历史 snapshot 没有 `inputIdentityHash/configHash` 时视为 cache miss，进入一次深哈希并把新字段写入新 snapshot；不能猜测命中。latest 在读取后被并发更新不影响已取得的不可变 snapshot ref，Preparation 不直接读取 latest 目录中的业务产物。

#### 内部接口与伪代码

```python
def prepare(
    ...,
    progress: Callable[[int, int, int, int, int], None] | None = None,
    phase_progress: Callable[[str, int, int, dict[str, Any]], None] | None = None,
    cancel_check: Callable[[], None] | None = None,
) -> PreparationReport: ...
```

保留现有 `progress` 的正式处理五计数接口；新增可选 `phase_progress`，避免预哈希计数与正式处理计数共用 `current` 后发生倒退。两个回调均为内部接口，默认 `None`，不改变 HTTP API。

```text
prepare(batchId):
  records = files.records(batchId)
  phase_progress(identity, 0, total)
  normalized, issues = normalize_identity_without_file_body(records)
  inputIdentityHash = hash(identity, config, pipeline)
  phase_progress(identity, total, total)

  candidate = read_and_validate_committed_latest_control_files()
  if candidate matches inputIdentityHash/configHash/pipelineVersion:
    phase_progress(cache_hit, 1, 1, runId)
    return report(candidate.snapshotRef)

  phase_progress(content_fingerprint, 0, normalizedTotal)
  deepSnapshot = hash_files_by_1MiB_blocks(
    cancel_check_every_block,
    phase_progress_every_1s_or_50_resources
  )
  executionHash = hash(deepSnapshot, config, pipeline)
  flight = reserve_flight(executionHash)
  if completed/follower: return validated report
  process resources with existing progress callback
  commit manifest including inputIdentityHash/configHash/deep inputManifestHash
```

不使用 `inputIdentityHash` 提前登记现有 exact single-flight，避免身份相同但正文契约被破坏时把两个不同内容错误合并。身份 miss 的并发调用仍可能重复深哈希，后续可单独增加 identity-flight 优化。

#### 验收与人工确认

- [ ] 用户确认采用 B，并接受快速命中依赖资源不可原地变更的正确性前提；若该前提不能保证，应先实施 C。
- [ ] 热命中测试断言 `_hash_file`、Office/PDF 转换均为 0 次，10,873 记录连续至少 20 次运行 P95 小于 5 秒。
- [ ] 历史快照、identity miss、配置变化、pipeline 变化和损坏 latest 均回退深哈希，不错误复用。
- [ ] 深哈希阶段在 1 秒或 50 个资源内持续输出 `content_fingerprint` 进度，取消后 3 秒内停止读取新块。
- [ ] 快照 manifest 新增字段进入 manifest hash；后续 Metadata 固定使用返回的 snapshotRef。
- [ ] 本节是性能与缓存语义变更，未获人工确认前不得修改功能代码。

## 十六、下载资源主键幂等与历史重复清单修复

### 16.1 现场证据与根因

真实任务 `training_ae4e8832ee134652` 复用 `prep_bf1cd53923434667` 后，在 metadata 输入校验阶段因重复 `resourceId` 失败。输入和输出统计如下：

| 位置 | 总记录 | 唯一 ID | 重复 ID | 多余记录 |
| --- | ---: | ---: | ---: | ---: |
| `resources.json` | 23,262 | 22,345 | 759 | 917 |
| `source-documents.jsonl` | 10,533 | 10,100 | 363 | 433 |

所有 363 个 preparation 输出重复 ID 都继承自输入，输出侧没有新增重复。进一步核对下载状态：

- 同一下载任务的 `pages.jsonl` 有 8,494 条完成记录、8,053 个唯一页面，357 个页面 ID 重复、共 441 条额外记录；
- 选择快照的 `selectedPageIds` 为 8,053 条且全部唯一；
- `pages_for_batch` 当前只使用集合过滤原始页面列表，没有对返回列表按页面 ID 归一化，因此缓存/API 页面列表中的重复项会被同一任务重复处理；
- 资源重复中，556 个 ID 来自重复页面；另有 203 个 `page_asset` ID 所属页面只执行一次，说明同页重复图片引用也被 `_download_page` 重复追加；
- `_rewrite_resources_from_state` 将 append-only `items.jsonl` 的所有完成记录原样写入 `resources.json`；`FileService.records` 和 `PreparationService.prepare` 都没有唯一性防御，最终由 metadata 的严格校验暴露。

因此根因不是 metadata 过严，而是下载入口缺少页面/资源幂等归一化，加上 preparation 对历史重复清单缺少防御。

### 16.2 方案比较

| 层级 | 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- | --- |
| 下载入口 | 页面按 `pageId`、页面资源按稳定 `resourceId` 幂等归一化 | 从源头阻止重复下载和清单膨胀 | 不能自动修复已经存在的 `resources.json` | 必须实施 |
| Preparation | 正式处理前按 ID 分类完全相同重复与冲突重复 | 可修复历史批次；保证下游快照主键唯一 | 仍需读取历史清单；必须严谨判断冲突 | 必须实施 |
| Metadata | 读取时直接去重 | 改动局部 | 会掩盖非法 preparation 快照，且无法把质量问题写回上游快照 | 不采用；继续严格失败 |

最小且完整的方案是“入口幂等 + preparation 防御”两层组合。只改入口无法修复现有批次；只改 preparation 会让后续下载继续生成膨胀清单。metadata 继续验证 `resourceId/chunkId` 唯一和引用完整性，不承担静默修复。

### 16.3 内部接口

```python
@dataclass(frozen=True)
class UniqueRecordResult:
    records: list[dict]
    duplicate_issues: list[dict]
    conflict_issues: list[dict]

def normalize_unique_records(
    records: list[dict],
    *,
    key_field: str,
    identity_fields: tuple[str, ...],
    content_fingerprint: Callable[[dict], str | None],
) -> UniqueRecordResult: ...

def normalize_pages_for_download(pages: list[dict]) -> UniqueRecordResult: ...

def normalize_preparation_inputs(raw_records: list[dict]) -> UniqueRecordResult: ...
```

这些接口只在服务内部使用，不改变 HTTP API。归一化必须保持首次出现顺序，保证 execution hash 和产物顺序稳定。

判定规则：

1. 主键为空：隔离并记录 `SOURCE_RESOURCE_ID_MISSING`；
2. 主键首次出现：保留；
3. 同 ID 的身份字段、逻辑路径、大小和实际内容哈希完全一致：只保留一条，记录 `DUPLICATE_SOURCE_RESOURCE_COLLAPSED`、出现次数和输入位置；
4. 同 ID 但任一身份字段或内容指纹不同：该 ID 的所有记录都不进入正式处理，记录 `SOURCE_RESOURCE_ID_CONFLICT`，保留冲突摘要供人工处理；
5. append-only `download-state/items.jsonl` 保留全部历史审计记录；只有派生的当前视图 `resources.json` 和正式 preparation 输入要求唯一。

身份字段至少包括 `id/batchId/kind/pageId/logicalPath/size`。内容指纹优先使用已持久化 hash；没有 hash 时只对重复 ID 对应的文件计算 SHA-256，避免对全部资源增加一次额外 I/O。

### 16.4 伪代码

```text
pages_for_batch(spaceKey, selectedIds):
  rawPages = load_cached_or_remote_pages(spaceKey)
  selected = filter(rawPages, page.id in selectedIds)
  normalized = normalize_unique_records(selected, key=page._id, identity=page_identity)
  if normalized.conflicts:
    fail download admission with PAGE_ID_CONFLICT
  return normalized.records

download_page(page):
  resources = fetch_page_body_images_and_attachments(page)
  normalized = normalize_unique_records(
    resources, key=id, identity=resource_identity,
    content_fingerprint=hash_only_duplicate_paths
  )
  append normalized.records to items.jsonl
  append duplicate/conflict audit to download-state/resource-issues.jsonl
  if conflict exists: mark page failed, do not publish ambiguous resources

rewrite_resources_from_state():
  completed = read append-only items.jsonl
  normalized = normalize_unique_records(completed, key=id, ...)
  if conflicts: keep conflicts out of resources.json and persist issues
  atomically write normalized.records to resources.json

prepare(batchId):
  raw = files.records(batchId)
  normalized = normalize_preparation_inputs(raw)
  add normalized issues to preparation quality issues
  inputSnapshot = hash(normalized.records + conflict_issue_fingerprints)
  for record in normalized.records:
    process record once
  assert source-resources/resourceIds unique
  assert source-documents/resourceIds unique
  assert chunks/chunkIds unique
  commit immutable snapshot

metadata(snapshotRef):
  validate uniqueness and references
  # 不在此处静默去重；非法 preparation 快照仍然失败
```

### 16.5 数据保留与兼容边界

- 完全相同的重复记录指向同一稳定 ID、同一路径和同一内容，只折叠重复引用，不删除任何唯一文件或正文；
- 冲突记录不选择“第一条”或“最后一条”，避免因顺序造成数据丢失；冲突组整体隔离，其他资源继续处理；
- 历史 `items.jsonl` 和旧 preparation 快照保持只读，不原地修改；修复后生成新的 `resources.json` 当前视图和新的 preparation 快照；
- `inputManifestHash/executionHash` 必须包含归一化结果及冲突问题指纹，防止错误复用旧的重复快照；
- 不改变四阶段、`formal_knowledge` 模型边界、公共请求/响应或外部依赖。

### 16.6 测试与验收

1. 页面列表含完全相同的重复 `pageId` 时只下载一次，并记录折叠计数；
2. 同 `pageId` 元数据冲突时停止该下载输入，不静默覆盖；
3. 同页重复图片引用只生成一个 resource 记录，正文中的多处图片引用仍指向同一资产；
4. `items.jsonl` 可保留重试历史，但 `resources.json` 中 `id` 唯一；
5. preparation 对完全相同重复保留一条并写 warning，对冲突组隔离并写 error，其他资源继续；
6. preparation 的 `source-resources/source-documents/chunks` 主键全部唯一，引用完整；
7. metadata 对人工构造的非法重复快照继续失败，对归一化后的新快照通过；
8. 使用目标批次生成新 preparation 快照，363 个输出重复 ID 清零且唯一文档数不低于 10,100，随后真实任务通过 metadata；
9. `git diff --check`、定向单测、资料预处理回归和真实后端 API 验收通过。
