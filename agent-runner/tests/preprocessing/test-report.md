# 资料预处理框架 — 测试报告

> 生成时间：2026-07-24T06:54:55.716Z
> 测试框架：Jest

## 总览

| 指标 | 结果 |
|------|------|
| 测试套件 | 20/21 通过 |
| 测试用例 | 212/213 通过 |
| 跳过 | 1 个套件 / 1 个用例 |
| 执行耗时 | ~15s |
| 状态 | ✅ 全部通过 |

## 测试套件详情

### ✅ snapshot-tracker

- 耗时：702ms
- 用例：11/11 通过，0 跳过

| 用例 | 状态 |
|------|------|
| SnapshotTracker > save 和 loadLatest > 应保存并加载最新快照 | ✅ |
| SnapshotTracker > save 和 loadLatest > 不存在的 pipeline 应返回 null | ✅ |
| SnapshotTracker > load 指定快照 > 应加载指定 ID 的快照 | ✅ |
| SnapshotTracker > load 指定快照 > 不存在的快照 ID 应返回 null | ✅ |
| SnapshotTracker > list > 应列出所有快照（按时间倒序） | ✅ |
| SnapshotTracker > list > 空 pipeline 应返回空数组 | ✅ |
| SnapshotTracker > 快照保留策略 > 应只保留最近 maxRetained 个快照 | ✅ |
| SnapshotTracker > generateSnapshotId > 应生成符合格式的 ID | ✅ |
| SnapshotTracker > computeConfigHash > 相同配置应生成相同 hash | ✅ |
| SnapshotTracker > computeConfigHash > 不同配置应生成不同 hash | ✅ |
| SnapshotTracker > computeConfigHash > 键顺序不应影响 hash | ✅ |

### ✅ markdown-adapter

- 耗时：656ms
- 用例：12/12 通过，0 跳过

| 用例 | 状态 |
|------|------|
| MarkdownAdapter > scan > 应递归扫描目录中的 .md 文件 | ✅ |
| MarkdownAdapter > scan > 空目录应返回空数组 | ✅ |
| MarkdownAdapter > parse > 应提取标题 | ✅ |
| MarkdownAdapter > parse > 无标题时应使用文件名 | ✅ |
| MarkdownAdapter > parse > 应从路径提取版本 | ✅ |
| MarkdownAdapter > parse > 应从路径提取文档类型 | ✅ |
| MarkdownAdapter > parse > 应提取作者信息 | ✅ |
| MarkdownAdapter > parse > 应提取关键词 | ✅ |
| MarkdownAdapter > parse > 应计算文件 hash | ✅ |
| MarkdownAdapter > canHandle > 应接受 .md 文件 | ✅ |
| MarkdownAdapter > canHandle > 应接受 .markdown 文件 | ✅ |
| MarkdownAdapter > canHandle > 应拒绝 .txt 文件 | ✅ |

### ✅ archive-adapter

- 耗时：782ms
- 用例：11/11 通过，0 跳过

| 用例 | 状态 |
|------|------|
| ArchiveAdapter > basic properties > name 应为 archive | ✅ |
| ArchiveAdapter > basic properties > supportedExtensions 应包含压缩包格式 | ✅ |
| ArchiveAdapter > basic properties > canHandle 应正确识别压缩包文件 | ✅ |
| ArchiveAdapter > scan > 应递归扫描目录中的压缩包文件 | ✅ |
| ArchiveAdapter > detectArchiveType > 应正确检测压缩包类型 | ✅ |
| ArchiveAdapter > parse ZIP > 应能解析包含 Markdown 文件的 ZIP | ✅ |
| ArchiveAdapter > parse ZIP > 应处理空 ZIP | ✅ |
| ArchiveAdapter > parse ZIP > 应跳过非 Markdown 文件 | ✅ |
| ArchiveAdapter > parse tar > 应能解析包含 Markdown 文件的 tar | ✅ |
| ArchiveAdapter > parse tar.gz > 应能解析包含 Markdown 文件的 tar.gz | ✅ |
| ArchiveAdapter > buildAggregateContent > 应构建聚合内容 | ✅ |

### ✅ vector-and-graph-index

- 耗时：735ms
- 用例：5/5 通过，0 跳过

| 用例 | 状态 |
|------|------|
| 本地向量和知识图谱索引 > HashEmbeddingProvider 应生成固定维度且可复现的向量 | ✅ |
| 本地向量和知识图谱索引 > VectorIndexer 应构建、查询和统计向量 | ✅ |
| 本地向量和知识图谱索引 > KnowledgeGraphIndexer 应构建节点、边和统计信息 | ✅ |
| 本地向量和知识图谱索引 > IndexQualityEvaluator 应识别向量和图谱覆盖率 | ✅ |
| 本地向量和知识图谱索引 > GraphStore 应拒绝不存在节点的边 | ✅ |

### ⏭️ vision-api.integration

- 耗时：0ms
- 用例：0/1 通过，1 跳过

| 用例 | 状态 |
|------|------|
| Vision API real integration > 真实接口返回一句图片说明 | ⏭️ |

### ✅ feature-classifier

- 耗时：173ms
- 用例：4/4 通过，0 跳过

| 用例 | 状态 |
|------|------|
| FeatureClassifier > 应从特性设计路径分类 | ✅ |
| FeatureClassifier > 应从关键词分类 | ✅ |
| FeatureClassifier > 规则无法分类时应支持 LLM 兜底 | ✅ |
| FeatureClassifier > 应从 JSON 文件加载特性列表 | ✅ |

### ✅ design-doc-cleaner

- 耗时：165ms
- 用例：21/21 通过，0 跳过

| 用例 | 状态 |
|------|------|
| DesignDocCleaner > 规则 1：去除 Confluence 元数据 > 应移除 "Created by ... on ..." 行 | ✅ |
| DesignDocCleaner > 规则 1：去除 Confluence 元数据 > 应移除 "Created by ..., last modified on ..." 变体 | ✅ |
| DesignDocCleaner > 规则 1：去除 Confluence 元数据 > 不应移除正文中的 "Created by" 文本 | ✅ |
| DesignDocCleaner > 规则 2：清理内部链接 > 应将 [text](internal_url) 转为 text | ✅ |
| DesignDocCleaner > 规则 2：清理内部链接 > 应提取 Jira 工单编号 | ✅ |
| DesignDocCleaner > 规则 2：清理内部链接 > 应将裸 URL 转为标注 | ✅ |
| DesignDocCleaner > 规则 2：清理内部链接 > 不应影响外部链接 | ✅ |
| DesignDocCleaner > 规则 3：处理图片引用 > 应保留图片引用和 alt | ✅ |
| DesignDocCleaner > 规则 3：处理图片引用 > 无 alt 文本时应补齐可读 alt | ✅ |
| DesignDocCleaner > 规则 3：处理图片引用 > 图片引用应在内部链接清理之前处理 | ✅ |
| DesignDocCleaner > 规则 4：清理锚点链接 > 应将 [text](#anchor) 转为 text | ✅ |
| DesignDocCleaner > 规则 4：清理锚点链接 > 不应影响外部锚点链接 | ✅ |
| DesignDocCleaner > 规则 5：统一标题层级 > 应将最小层级 > 1 的标题整体提升 | ✅ |
| DesignDocCleaner > 规则 5：统一标题层级 > 不应改变已有 # 标题的文档 | ✅ |
| DesignDocCleaner > 规则 6：添加 YAML 前置元数据 > 应在文件头部添加 YAML 块 | ✅ |
| DesignDocCleaner > 规则 6：添加 YAML 前置元数据 > 应包含关键词列表 | ✅ |
| DesignDocCleaner > 表格和代码块保护 > 应保留完整表格 | ✅ |
| DesignDocCleaner > 表格和代码块保护 > 应保留完整代码块 | ✅ |
| DesignDocCleaner > 元数据提取 > 应从 Created by 行提取作者和日期 | ✅ |
| DesignDocCleaner > 元数据提取 > 应从路径提取版本 | ✅ |
| DesignDocCleaner > 元数据提取 > 应提取 YDBRD 编号 | ✅ |

### ✅ docx-adapter

- 耗时：216ms
- 用例：17/17 通过，0 跳过

| 用例 | 状态 |
|------|------|
| DocxAdapter > basic properties > name 应为 docx | ✅ |
| DocxAdapter > basic properties > supportedExtensions 应包含 .docx | ✅ |
| DocxAdapter > basic properties > canHandle 应正确识别 DOCX 文件 | ✅ |
| DocxAdapter > scan > 应递归扫描目录中的 .docx 文件 | ✅ |
| DocxAdapter > htmlToMarkdown > 应转换标题 | ✅ |
| DocxAdapter > htmlToMarkdown > 应转换粗体和斜体 | ✅ |
| DocxAdapter > htmlToMarkdown > 应转换列表 | ✅ |
| DocxAdapter > htmlToMarkdown > 应转换图片 | ✅ |
| DocxAdapter > htmlToMarkdown > 应转换链接 | ✅ |
| DocxAdapter > htmlToMarkdown > 应转换表格 | ✅ |
| DocxAdapter > htmlToMarkdown > 应解码 HTML 实体 | ✅ |
| DocxAdapter > extractTitle > 应从 h1 提取标题 | ✅ |
| DocxAdapter > extractTitle > 无 h1 时应使用文件名 | ✅ |
| DocxAdapter > extractTitle > 无 h1 时应解码 URL 编码文件名 | ✅ |
| DocxAdapter > extractDocType > 应从路径提取文档类型 | ✅ |
| DocxAdapter > parse with real DOCX > 应导出 DOCX 包中未定位的原始媒体 | ✅ |
| DocxAdapter > parse with real DOCX > 应能解析由 mammoth 生成的简单 DOCX | ✅ |

### ✅ semantic-chunker

- 耗时：171ms
- 用例：12/12 通过，0 跳过

| 用例 | 状态 |
|------|------|
| SemanticChunker > 基本分块 > 短文档应生成单个 chunk | ✅ |
| SemanticChunker > 基本分块 > 长文档应按标题切分 | ✅ |
| SemanticChunker > 保护块 > 不应在表格内部切分 | ✅ |
| SemanticChunker > 保护块 > 不应在代码块内部切分 | ✅ |
| SemanticChunker > 上下文前缀 > 每个 chunk 应包含上下文前缀 | ✅ |
| SemanticChunker > 上下文前缀 > chunk_id 应使用稳定 doc_id 和序号 | ✅ |
| SemanticChunker > 上下文前缀 > 相同标题但不同源文件应生成不同 chunk_id | ✅ |
| SemanticChunker > 章节路径追踪 > 应正确追踪章节路径 | ✅ |
| SemanticChunker > Token 估算 > 中文字符应按 1.5 token/字估算 | ✅ |
| SemanticChunker > Token 估算 > 英文单词应按 1.3 token/词估算 | ✅ |
| SemanticChunker > Token 估算 > 混合文本应正确估算 | ✅ |
| SemanticChunker > Overlap 应用 > 多 chunk 文档应应用 overlap | ✅ |

### ✅ excel-adapter

- 耗时：1067ms
- 用例：13/13 通过，0 跳过

| 用例 | 状态 |
|------|------|
| ExcelAdapter > basic properties > name 应为 excel | ✅ |
| ExcelAdapter > basic properties > supportedExtensions 应包含 .xlsx 和 .xls | ✅ |
| ExcelAdapter > basic properties > canHandle 应正确识别 Excel 文件 | ✅ |
| ExcelAdapter > scan > 应递归扫描目录中的 Excel 文件 | ✅ |
| ExcelAdapter > convertToMarkdownTable > 应转换二维数组为 Markdown 表格 | ✅ |
| ExcelAdapter > convertToMarkdownTable > 应处理空数据 | ✅ |
| ExcelAdapter > convertToMarkdownTable > 应过滤全空行 | ✅ |
| ExcelAdapter > convertToMarkdownTable > 应转义管道符 | ✅ |
| ExcelAdapter > convertToMarkdownTable > 应截断超大表格 | ✅ |
| ExcelAdapter > convertToMarkdownTable > 应对齐列数 | ✅ |
| ExcelAdapter > convertToMarkdownTable > 应处理换行符 | ✅ |
| ExcelAdapter > parse with real Excel > 应能解析 xlsx 文件 | ✅ |
| ExcelAdapter > parse with real Excel > 应处理多 Sheet | ✅ |

### ✅ quality-filter

- 耗时：98ms
- 用例：5/5 通过，0 跳过

| 用例 | 状态 |
|------|------|
| QualityFilter > 应过滤空文档和纯标题文档 | ✅ |
| QualityFilter > 应过滤正文过短的文档 | ✅ |
| QualityFilter > 正常技术文档应保留并输出指标 | ✅ |
| QualityFilter > 边界文档应支持 LLM 评估回调 | ✅ |
| QualityFilter > 禁用时不应过滤内容 | ✅ |

### ✅ adapter-chain

- 耗时：1118ms
- 用例：21/21 通过，0 跳过

| 用例 | 状态 |
|------|------|
| AdapterChain > constructor > 应能使用适配器列表初始化 | ✅ |
| AdapterChain > constructor > 应能空初始化 | ✅ |
| AdapterChain > addAdapter > 应能添加适配器 | ✅ |
| AdapterChain > canHandle > 应能识别所有支持的格式 | ✅ |
| AdapterChain > canHandle > 不应识别不支持的格式 | ✅ |
| AdapterChain > canHandle > 空链不应处理任何文件 | ✅ |
| AdapterChain > selectAdapter > 应为 Markdown 文件选择 MarkdownAdapter | ✅ |
| AdapterChain > selectAdapter > 应为 HTML 文件选择 HtmlAdapter | ✅ |
| AdapterChain > selectAdapter > 应为 PDF 文件选择 PdfAdapter | ✅ |
| AdapterChain > selectAdapter > 应为 DOCX 文件选择 DocxAdapter | ✅ |
| AdapterChain > selectAdapter > 应为 Excel 文件选择 ExcelAdapter | ✅ |
| AdapterChain > selectAdapter > 应为 PPTX 文件选择 PptxAdapter | ✅ |
| AdapterChain > selectAdapter > 应为 ZIP 文件选择 ArchiveAdapter | ✅ |
| AdapterChain > selectAdapter > 不支持的文件应返回 null | ✅ |
| AdapterChain > getSupportedExtensions > 应返回所有支持的扩展名 | ✅ |
| AdapterChain > getSupportedExtensions > 应去重 | ✅ |
| AdapterChain > scan > 应聚合所有适配器的扫描结果 | ✅ |
| AdapterChain > scan > 应去重 | ✅ |
| AdapterChain > parse > 应使用正确的适配器解析 Markdown 文件 | ✅ |
| AdapterChain > parse > 应使用正确的适配器解析 HTML 文件 | ✅ |
| AdapterChain > parse > 不支持的文件应抛出错误 | ✅ |

### ✅ quality-validator

- 耗时：138ms
- 用例：11/11 通过，0 跳过

| 用例 | 状态 |
|------|------|
| QualityValidator > validateSingleFile > 表格保留完整应通过 | ✅ |
| QualityValidator > validateSingleFile > 表格丢失应报告 critical 问题 | ✅ |
| QualityValidator > validateSingleFile > 代码块丢失应报告 critical 问题 | ✅ |
| QualityValidator > validateSingleFile > 清洗后仍含内部链接应报告问题 | ✅ |
| QualityValidator > validateSingleFile > 本地图片引用丢失应报告问题 | ✅ |
| QualityValidator > validateAll > enabled=false 时应跳过验证 | ✅ |
| QualityValidator > validateAll > 应运行所有检查点 | ✅ |
| QualityValidator > extractTables > 应正确提取表格 | ✅ |
| QualityValidator > extractTables > 无表格应返回空数组 | ✅ |
| QualityValidator > extractCodeBlocks > 应正确提取代码块 | ✅ |
| QualityValidator > extractCodeBlocks > 无代码块应返回空数组 | ✅ |

### ✅ hybrid-retriever

- 耗时：78ms
- 用例：2/2 通过，0 跳过

| 用例 | 状态 |
|------|------|
| HybridRetriever > 应使用 RRF 融合关键词和向量结果 | ✅ |
| HybridRetriever > 开启图扩展时应返回局部子图 | ✅ |

### ✅ fidelity-evaluator

- 耗时：120ms
- 用例：5/5 通过，0 跳过

| 用例 | 状态 |
|------|------|
| FidelityEvaluator > 应忽略 Markdown 标记并计算源文本召回率 | ✅ |
| FidelityEvaluator > 媒体未导出时应不通过 | ✅ |
| FidelityEvaluator > 文本、资产、引用和说明完整时应通过 | ✅ |
| AssetCaptioner > 应用视觉模型说明替换上下文兜底说明 | ✅ |
| AssetCaptioner > 整页渲染资产使用页码作为视觉上下文 | ✅ |

### ✅ pptx-adapter

- 耗时：1167ms
- 用例：10/10 通过，0 跳过

| 用例 | 状态 |
|------|------|
| PptxAdapter > basic properties > name 应为 pptx | ✅ |
| PptxAdapter > basic properties > supportedExtensions 应包含 .pptx | ✅ |
| PptxAdapter > basic properties > canHandle 应正确识别 PPTX 文件 | ✅ |
| PptxAdapter > scan > 应递归扫描目录中的 .pptx 文件 | ✅ |
| PptxAdapter > parseSlideXml > 应提取幻灯片文本 | ✅ |
| PptxAdapter > parseSlideXml > 无标题占位符时应使用第一段文本 | ✅ |
| PptxAdapter > parseSlideXml > 空幻灯片应使用默认标题 | ✅ |
| PptxAdapter > extractNotesText > 应提取备注文本 | ✅ |
| PptxAdapter > buildMarkdown > 应构建 Markdown 内容 | ✅ |
| PptxAdapter > parse with real PPTX > 应能解析由 adm-zip 创建的简单 PPTX | ✅ |

### ✅ html-adapter

- 耗时：1271ms
- 用例：17/17 通过，0 跳过

| 用例 | 状态 |
|------|------|
| HtmlAdapter > basic properties > name 应为 html | ✅ |
| HtmlAdapter > basic properties > supportedExtensions 应包含 .html 和 .htm | ✅ |
| HtmlAdapter > basic properties > canHandle 应正确识别 HTML 文件 | ✅ |
| HtmlAdapter > scan > 应递归扫描目录中的 .html 文件 | ✅ |
| HtmlAdapter > scan > 空目录应返回空数组 | ✅ |
| HtmlAdapter > parse > 应从 <title> 标签提取标题 | ✅ |
| HtmlAdapter > parse > 无 <title> 时应从 <h1> 提取 | ✅ |
| HtmlAdapter > parse > 无标题时应使用文件名 | ✅ |
| HtmlAdapter > parse > 应转换标题为 Markdown | ✅ |
| HtmlAdapter > parse > 应转换表格为 Markdown 表格 | ✅ |
| HtmlAdapter > parse > 应处理图片引用 | ✅ |
| HtmlAdapter > parse > 应处理代码块 | ✅ |
| HtmlAdapter > parse > 应处理粗体和斜体 | ✅ |
| HtmlAdapter > parse > 应处理锚点链接 | ✅ |
| HtmlAdapter > parse > 应设置正确的 metadata | ✅ |
| HtmlAdapter > parse > 应从路径提取文档类型 | ✅ |
| HtmlAdapter > parse > 应检测图片、表格和代码块 | ✅ |

### ✅ image-caption-provider

- 耗时：306ms
- 用例：3/3 通过，0 跳过

| 用例 | 状态 |
|------|------|
| OpenAICompatibleImageCaptionProvider > 默认构造 GPT-5.6 Terra 的图片说明请求 | ✅ |
| OpenAICompatibleImageCaptionProvider > 第三方端点支持直接 URL 和兼容 token 参数 | ✅ |
| OpenAICompatibleImageCaptionProvider > 第三方端点缺少 URL 时拒绝启动 | ✅ |

### ✅ pdf-adapter

- 耗时：576ms
- 用例：13/13 通过，0 跳过

| 用例 | 状态 |
|------|------|
| PdfAdapter > basic properties > name 应为 pdf | ✅ |
| PdfAdapter > basic properties > supportedExtensions 应包含 .pdf | ✅ |
| PdfAdapter > basic properties > canHandle 应正确识别 PDF 文件 | ✅ |
| PdfAdapter > scan > 应递归扫描目录中的 .pdf 文件 | ✅ |
| PdfAdapter > cleanPdfText > 应修复断行连字符 | ✅ |
| PdfAdapter > cleanPdfText > 应合并断开的段落 | ✅ |
| PdfAdapter > cleanPdfText > 应清理多余空行 | ✅ |
| PdfAdapter > parsePdfDate > 应解析 D:YYYYMMDD 格式 | ✅ |
| PdfAdapter > parsePdfDate > 应解析 D:YYYYMMDDHHmmSS 格式 | ✅ |
| PdfAdapter > parsePdfDate > 空值应返回空字符串 | ✅ |
| PdfAdapter > extractDocType > 应从路径提取文档类型 | ✅ |
| PdfAdapter > extractVersion > 应从路径提取版本号 | ✅ |
| PdfAdapter > parse with real PDF > 应能解析最小 PDF | ✅ |

### ✅ pipeline-integration

- 耗时：2247ms
- 用例：15/15 通过，0 跳过

| 用例 | 状态 |
|------|------|
| DesignDocPipeline 集成测试 > 完整流水线应成功执行 | ✅ |
| DesignDocPipeline 集成测试 > 应生成清洗后文件 | ✅ |
| DesignDocPipeline 集成测试 > 应生成可追溯的文档包和清洗差异 | ✅ |
| DesignDocPipeline 集成测试 > 非 Markdown 文件的统一 Markdown 产出不应被旧文件清理逻辑删除 | ✅ |
| DesignDocPipeline 集成测试 > 应生成分层索引 | ✅ |
| DesignDocPipeline 集成测试 > L1 索引应包含正确的条目 | ✅ |
| DesignDocPipeline 集成测试 > 清洗后文件应不含内部链接 | ✅ |
| DesignDocPipeline 集成测试 > 清洗后文件应不含 Created by 元数据 | ✅ |
| DesignDocPipeline 集成测试 > 清洗后文件应保留表格 | ✅ |
| DesignDocPipeline 集成测试 > 清洗后文件应保留代码块 | ✅ |
| DesignDocPipeline 集成测试 > 增量模式：无变更时应跳过处理 | ✅ |
| DesignDocPipeline 集成测试 > 全量模式：应重新处理所有文件 | ✅ |
| DesignDocPipeline 集成测试 > dry-run 模式：应正常执行但不持久化快照 | ✅ |
| DesignDocPipeline 集成测试 > 应生成执行快照 | ✅ |
| DesignDocPipeline 集成测试 > 应生成执行报告 | ✅ |

### ✅ libreoffice-renderer

- 耗时：3324ms
- 用例：4/4 通过，0 跳过

| 用例 | 状态 |
|------|------|
| LibreOfficeRenderer > 执行 PDF 转换并按页码返回 PNG | ✅ |
| LibreOfficeRenderer > 渲染页转换为可审计 page-render 资产 | ✅ |
| LibreOfficeRenderer > 依赖不可用时保留明确状态 | ✅ |
| LibreOfficeRenderer real integration > 真实 PPTX 至少渲染一张 PNG | ✅ |

## 代码覆盖率摘要

本次未启用 `--coverage`，不输出推测性覆盖率。

## 测试文件清单

| 文件 | 类型 | 通过 | 跳过 |
|------|------|------|------|
| `snapshot-tracker.test.js` | 单元测试 | 11 | 0 |
| `markdown-adapter.test.js` | 单元测试 | 12 | 0 |
| `archive-adapter.test.js` | 单元测试 | 11 | 0 |
| `vector-and-graph-index.test.js` | 单元测试 | 5 | 0 |
| `vision-api.integration.test.js` | 集成测试 | 0 | 1 |
| `feature-classifier.test.js` | 单元测试 | 4 | 0 |
| `design-doc-cleaner.test.js` | 单元测试 | 21 | 0 |
| `docx-adapter.test.js` | 单元测试 | 17 | 0 |
| `semantic-chunker.test.js` | 单元测试 | 12 | 0 |
| `excel-adapter.test.js` | 单元测试 | 13 | 0 |
| `quality-filter.test.js` | 单元测试 | 5 | 0 |
| `adapter-chain.test.js` | 单元测试 | 21 | 0 |
| `quality-validator.test.js` | 单元测试 | 11 | 0 |
| `hybrid-retriever.test.js` | 单元测试 | 2 | 0 |
| `fidelity-evaluator.test.js` | 单元测试 | 5 | 0 |
| `pptx-adapter.test.js` | 单元测试 | 10 | 0 |
| `html-adapter.test.js` | 单元测试 | 17 | 0 |
| `image-caption-provider.test.js` | 单元测试 | 3 | 0 |
| `pdf-adapter.test.js` | 单元测试 | 13 | 0 |
| `pipeline-integration.test.js` | 集成测试 | 15 | 0 |
| `libreoffice-renderer.test.js` | 单元测试 | 4 | 0 |
| **合计** | | **212** | **1** |

## 关键验证项

### 清洗规则验证
- ✅ Confluence 元数据移除
- ✅ 内部链接清理（conf/jira/pingcode.yasdb.com）
- ✅ 图片引用转换（![alt](url) → [图片: alt]）
- ✅ 锚点链接清理
- ✅ 标题层级统一
- ✅ YAML 前置元数据生成

### 数据完整性验证
- ✅ 表格 100% 保留
- ✅ 代码块 100% 保留
- ✅ 图片引用先于内部链接处理（避免误清理）
- ✅ Office 原始媒体和整页渲染资产采用独立类型标识
- ✅ LibreOffice 不可用时输出 `unavailable` 审计状态
- ✅ GPT-5.6 官方/第三方请求配置单元测试通过
- ✅ 真实 LibreOffice PPTX 整页渲染测试通过
- ⏭️ 真实视觉 API 测试因运行开关或密钥未配置而跳过

### 流水线验证
- ✅ 完整流水线执行成功
- ✅ 清洗后文件生成
- ✅ 分层索引（L1/L2/L3）生成
- ✅ 增量模式无变更跳过
- ✅ 全量模式重新处理
- ✅ 执行快照和报告生成
