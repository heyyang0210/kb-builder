/**
 * 资料预处理框架
 * 
 * 独立于检索和生成流程的预处理模块，负责将各类原始素材
 * 转化为高质量、可检索的知识资产。
 * 
 * 核心组件：
 * - PreprocessingEngine: 执行引擎，调度 Pipeline
 * - Pipeline: 流水线基类
 * - SourceAdapter: 源数据适配器基类
 * - PreprocessingLogger: 结构化日志
 * - SnapshotTracker: 快照管理（增量 + 回溯）
 * 
 * 使用示例：
 * ```javascript
 * const { PreprocessingEngine } = require('./lib/preprocessing');
 * const { DesignDocPipeline } = require('./lib/preprocessing/pipelines/design-doc-pipeline');
 * 
 * const engine = new PreprocessingEngine(config);
 * engine.register(new DesignDocPipeline());
 * await engine.run('design-docs');
 * ```
 */

const { PreprocessingEngine } = require('./engine');
const { Pipeline, PipelineReport, DeltaResult } = require('./pipeline');
const { SourceAdapter, NormalizedDocument } = require('./source-adapter');
const { PreprocessingLogger } = require('./preprocessing-logger');
const { SnapshotTracker } = require('./snapshot-tracker');


const { MarkdownAdapter } = require('./cleaners/markdown-adapter');
const { HtmlAdapter } = require('./cleaners/html-adapter');
const { PdfAdapter } = require('./cleaners/pdf-adapter');
const { DocxAdapter } = require('./cleaners/docx-adapter');
const { ExcelAdapter } = require('./cleaners/excel-adapter');
const { PptxAdapter } = require('./cleaners/pptx-adapter');
const { ArchiveAdapter } = require('./cleaners/archive-adapter');
const { AdapterChain } = require('./cleaners/adapter-chain');
const { DocumentFilter } = require('./contracts/document-filter');
const { DocumentClassifier } = require('./contracts/document-classifier');
const { EmbeddingProvider } = require('./contracts/embedding-provider');
const { VectorStore } = require('./contracts/vector-store');
const { GraphStore } = require('./contracts/graph-store');
const { SearchIndex } = require('./contracts/search-index');
const { ImageCaptionProvider } = require('./contracts/image-caption-provider');
const { OfficeRenderer } = require('./contracts/office-renderer');
const { QualityFilter } = require('./filters/quality-filter');
const { FeatureClassifier } = require('./classifiers/feature-classifier');
const { HashEmbeddingProvider } = require('./embeddings/hash-embedding-provider');
const { JsonVectorStore } = require('./stores/json-vector-store');
const { JsonGraphStore } = require('./stores/json-graph-store');
const { VectorIndexer } = require('./indexers/vector-indexer');
const { KnowledgeGraphIndexer } = require('./indexers/knowledge-graph-indexer');
const { HybridIndexer } = require('./indexers/hybrid-indexer');
const { IndexQualityEvaluator } = require('./index-quality-evaluator');
const { HybridRetriever } = require('./retrievers/hybrid-retriever');
const { AssetCaptioner } = require('./captioning/asset-captioner');
const { OpenAICompatibleImageCaptionProvider } = require('./captioning/openai-compatible-image-caption-provider');
const { LibreOfficeRenderer } = require('./renderers/libreoffice-renderer');

module.exports = {
  PreprocessingEngine,
  Pipeline,
  PipelineReport,
  DeltaResult,
  SourceAdapter,
  NormalizedDocument,
  PreprocessingLogger,
  SnapshotTracker,
  MarkdownAdapter,
  HtmlAdapter,
  PdfAdapter,
  DocxAdapter,
  ExcelAdapter,
  PptxAdapter,
  ArchiveAdapter,
  AdapterChain,
  DocumentFilter,
  DocumentClassifier,
  EmbeddingProvider,
  VectorStore,
  GraphStore,
  SearchIndex,
  ImageCaptionProvider,
  OfficeRenderer,
  QualityFilter,
  FeatureClassifier,
  HashEmbeddingProvider,
  JsonVectorStore,
  JsonGraphStore,
  VectorIndexer,
  KnowledgeGraphIndexer,
  HybridIndexer,
  IndexQualityEvaluator,
  HybridRetriever,
  AssetCaptioner,
  OpenAICompatibleImageCaptionProvider,
  LibreOfficeRenderer
};
