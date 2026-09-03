const fs = require('fs').promises;
const path = require('path');
const { Pipeline } = require('../pipeline');
const { MarkdownAdapter } = require('../cleaners/markdown-adapter');
const { HtmlAdapter } = require('../cleaners/html-adapter');
const { PdfAdapter } = require('../cleaners/pdf-adapter');
const { DocxAdapter } = require('../cleaners/docx-adapter');
const { ExcelAdapter } = require('../cleaners/excel-adapter');
const { PptxAdapter } = require('../cleaners/pptx-adapter');
const { ArchiveAdapter } = require('../cleaners/archive-adapter');
const { AdapterChain } = require('../cleaners/adapter-chain');
const { DesignDocCleaner } = require('../cleaners/design-doc-cleaner');
const { QualityFilter } = require('../filters/quality-filter');
const { FeatureClassifier } = require('../classifiers/feature-classifier');
const { SemanticChunker } = require('../chunkers/semantic-chunker');
const { HybridIndexer } = require('../indexers/hybrid-indexer');
const { QualityValidator } = require('../quality-validator');
const { serializableAsset } = require('../asset-utils');
const { buildDocumentId, decodeFileName, sourceNames } = require('../document-identity');
const { evaluateFidelity } = require('../fidelity-evaluator');
const { AssetCaptioner } = require('../captioning/asset-captioner');
const { OpenAICompatibleImageCaptionProvider } = require('../captioning/openai-compatible-image-caption-provider');
const { LibreOfficeRenderer } = require('../renderers/libreoffice-renderer');

/**
 * 设计文档预处理流水线
 * 
 * 处理流程：
 * 1. AdapterChain 扫描并解析多格式文档
 * 2. QualityFilter 过滤低质量文档
 * 3. DesignDocCleaner 统一格式并清洗
 * 4. SemanticChunker 分块 + FeatureClassifier 分类
 * 5. HybridIndexer 构建结构化、向量和图索引
 * 6. QualityValidator 质量验证
 */
class DesignDocPipeline extends Pipeline {
  get name() {
    return 'design-docs';
  }

  get adapter() {
    return this._adapter;
  }

  /**
   * @param {Object} [config]
   */
  constructor(config = {}) {
    super();
    const officeRenderer = this.createOfficeRenderer(config.officeRendering || {});
    // 使用适配器链支持多格式文档
    this._adapter = new AdapterChain([
      new MarkdownAdapter(),
      new HtmlAdapter(),
      new PdfAdapter(),
      new DocxAdapter({ officeRenderer }),
      new ExcelAdapter(),
      new PptxAdapter({ officeRenderer }),
      new ArchiveAdapter({ chain: null }) // ArchiveAdapter 在最后，避免循环
    ], {
      excludePatterns: config.source?.excludePatterns || []
    });
    // 设置 ArchiveAdapter 的 chain 引用（延迟初始化避免循环）
    const archiveAdapter = this._adapter.adapters.find(a => a.name === 'archive');
    if (archiveAdapter) {
      archiveAdapter.chain = this._adapter;
    }
    this.qualityFilter = new QualityFilter(config.qualityFilter || {});
    this.cleaner = new DesignDocCleaner(config.cleaning || {});
    this.classifier = new FeatureClassifier(config.classification || {});
    this.chunker = new SemanticChunker(config.chunking || {});
    this.indexer = new HybridIndexer(config.indexing || {});
    this.validator = new QualityValidator(config.quality || {});
    this.captioner = new AssetCaptioner({
      enabled: config.captioning?.enabled === true,
      provider: this.createCaptionProvider(config.captioning || {})
    });

    // 存储清洗结果供后续阶段使用
    this._cleanedDocs = [];
    this._chunks = [];
    this._fileHashes = {};
    this._filterResults = [];
    this._classificationResults = [];
    this._quarantinedDocs = [];
    this._officeRenderingResults = [];
  }

  /**
   * 清洗阶段
   * 解析原始文件 → 执行 6 条清洗规则 → 输出标准化文档
   */
  async clean(files, config) {
    const cleanedDocs = [];
    this._filterResults = [];
    this._classificationResults = [];
    this._quarantinedDocs = [];
    this._officeRenderingResults = [];

    for (const file of files) {
      try {
        // 解析文件
        const doc = await this.adapter.parse(file.filePath);
        const names = sourceNames(file.filePath);
        Object.assign(doc.metadata, {
          hash: doc.hash || file.hash,
          docId: doc.metadata.docId || buildDocumentId({ hash: doc.hash || file.hash }),
          sourceName: doc.metadata.sourceName || names.sourceName,
          rawSourceName: doc.metadata.rawSourceName || names.rawSourceName
        });
        this._officeRenderingResults.push({
          filePath: file.filePath,
          sourceFormat: doc.metadata.sourceFormat,
          ...(doc.metadata.officeRendering || { enabled: false, status: 'not-applicable', pageCount: 0 })
        });
        const previousCaptions = new Map((doc.metadata.assets || []).map(asset => [asset.assetId, asset.caption]));
        await this.captioner.enrich(doc.metadata.assets, { title: doc.title, sourcePath: file.filePath });
        for (const asset of doc.metadata.assets || []) {
          const previousCaption = previousCaptions.get(asset.assetId);
          if (previousCaption && previousCaption !== asset.caption) {
            doc.content = doc.content.replace(`> 图片说明：${previousCaption}`, `> 图片说明：${asset.caption}`);
          }
        }

        const filterResult = await this.qualityFilter.evaluate(doc);
        this._filterResults.push({
          filePath: file.filePath,
          passed: filterResult.passed,
          status: filterResult.status,
          source: filterResult.source,
          reasons: filterResult.reasons,
          metrics: filterResult.metrics
        });

        this._fileHashes[file.filePath] = {
          hash: file.hash,
          processed_at: new Date().toISOString(),
          line_count: doc.lineCount,
          quality_status: filterResult.status
        };

        if (!filterResult.passed) continue;

        // 清洗
        const result = this.cleaner.cleanFile(doc);
        const cleanedItem = {
          doc,
          content: result.content,
          metadata: result.metadata,
          changes: result.changes,
          filePath: file.filePath,
          hash: file.hash
        };
        const fidelity = evaluateFidelity(cleanedItem, config.quality || {});
        cleanedItem.fidelity = fidelity;
        if (!fidelity.passed && config.quality?.failOnCritical !== false) {
          this._quarantinedDocs.push(cleanedItem);
          continue;
        }
        cleanedDocs.push(cleanedItem);
      } catch (err) {
        // 单文件失败不阻塞整体流程
        console.warn(`[design-doc-pipeline] 清洗失败: ${file.filePath}`, err.message);
      }
    }

    this._cleanedDocs = cleanedDocs;
    return cleanedDocs;
  }

  /**
   * 分块阶段
   * 对清洗后文档进行语义分块
   */
  async chunk(cleaned, config) {
    if (config.chunking?.enabled === false) {
      return null;
    }

    const allChunks = [];

    for (const item of cleaned) {
      try {
        const metadata = item.metadata || item.doc.metadata;
        const classification = await this.classifier.classify({
          title: metadata.title,
          content: item.content,
          metadata
        });
        Object.assign(metadata, {
          feature: classification.feature,
          subFeature: classification.subFeature,
          featureConfidence: classification.confidence,
          featureSource: classification.source,
          featureReason: classification.reason
        });
        this._classificationResults.push({ filePath: item.filePath, ...classification });
        const chunks = this.chunker.chunkFile(item.content, metadata);
        allChunks.push(...chunks);
      } catch (err) {
        console.warn(`[design-doc-pipeline] 分块失败: ${item.filePath}`, err.message);
      }
    }

    this._chunks = allChunks;
    return allChunks;
  }

  /**
   * 索引构建阶段
   */
  async index(data, config, delta) {
    return this.indexer.build(data, config, delta);
  }

  /**
   * 质量验证阶段
   */
  async validate(report, config) {
    return this.validator.validateAll(report, config, this._cleanedDocs);
  }

  /**
   * 清理已删除文件的产出
   */
  async cleanupDeleted(deletedFiles, outputDir) {
    for (const file of deletedFiles) {
      const basename = path.basename(file.filePath, '.md');

      // 清理清洗后的文件
      const cleanedPath = path.join(outputDir, 'cleaned', file.filePath);
      try { await fs.unlink(cleanedPath); } catch { /* ignore */ }

      // 清理 chunk 目录
      const chunksDir = path.join(outputDir, 'chunks');
      try {
        const versions = await fs.readdir(chunksDir);
        for (const version of versions) {
          const docDir = path.join(chunksDir, version, `*${basename}*`);
          // 简单匹配，实际应使用 glob
        }
      } catch { /* ignore */ }
    }
  }

  /**
   * 写入产出文件
   */
  async writeOutput(cleaned, chunked, indexResult, outputDir) {
    // 写入清洗后文件
    const cleanedDir = path.join(outputDir, 'cleaned');
    await fs.mkdir(cleanedDir, { recursive: true });

    const quarantineDir = path.join(outputDir, 'quarantine');
    await fs.rm(quarantineDir, { recursive: true, force: true });
    for (const item of this._quarantinedDocs) {
      const docId = item.metadata.docId || buildDocumentId(item.metadata);
      const packageDir = path.join(quarantineDir, docId);
      const assetsDir = path.join(packageDir, 'assets');
      await fs.mkdir(assetsDir, { recursive: true });
      for (const asset of item.metadata.assets || []) {
        await fs.writeFile(path.join(assetsDir, asset.fileName), asset.data);
      }
      await fs.writeFile(path.join(packageDir, 'source.md'), item.doc.content, 'utf-8');
      await fs.writeFile(path.join(packageDir, 'document.md'), item.content, 'utf-8');
      await fs.writeFile(
        path.join(packageDir, 'quarantine.json'),
        JSON.stringify({ docId, fidelity: item.fidelity, sourcePath: item.filePath }, null, 2),
        'utf-8'
      );
    }

    // 文档从有效变为低质量时，清理旧的清洗产出，避免检索命中过期内容
    for (const result of this._filterResults.filter(item => !item.passed)) {
      try {
        await fs.unlink(path.join(cleanedDir, path.basename(result.filePath)));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }

    for (const item of cleaned) {
      const relativePath = item.filePath;
      const rawSourceName = path.basename(relativePath);
      const sourceName = this.decodeFileName(rawSourceName);
      const metadata = item.metadata || {};
      const docId = metadata.docId || buildDocumentId({ ...metadata, sourcePath: item.filePath });
      const packageDir = path.join(cleanedDir, docId);
      const assetsDir = path.join(packageDir, 'assets');
      const assets = metadata.assets || [];
      await fs.mkdir(assetsDir, { recursive: true });

      for (const asset of assets) {
        await fs.writeFile(path.join(assetsDir, asset.fileName), asset.data);
      }

      await fs.writeFile(path.join(packageDir, 'source.md'), item.doc?.content || item.content, 'utf-8');
      await fs.writeFile(path.join(packageDir, 'document.md'), item.content, 'utf-8');
      await fs.writeFile(
        path.join(packageDir, 'manifest.json'),
        JSON.stringify(this.buildDocumentManifest({ ...item, metadata }, docId, sourceName), null, 2),
        'utf-8'
      );
      await fs.writeFile(
        path.join(packageDir, 'diff.json'),
        JSON.stringify(this.buildCleaningDiff(item.doc?.content || item.content, item.content), null, 2),
        'utf-8'
      );

      const sourceExtension = path.extname(sourceName).toLowerCase();
      const outputName = sourceExtension === '.md'
        ? sourceName
        : `${sourceName}.md`;
      const outputPath = path.join(cleanedDir, outputName);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      const compatibilityContent = item.content.replace(/\]\(assets\//g, `](${docId}/assets/`);
      await fs.writeFile(outputPath, compatibilityContent, 'utf-8');

      // 清理旧版本以原始扩展名写出的文本产出
      if (outputPath !== path.join(cleanedDir, sourceName)) {
        for (const staleName of [sourceName, rawSourceName, `${rawSourceName}.md`]) {
          const stalePath = path.join(cleanedDir, staleName);
          if (stalePath === outputPath) continue;
          try {
            await fs.unlink(stalePath);
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
          }
        }
      }
    }

    // 写入清洗统计
    const stats = {
      generated_at: new Date().toISOString(),
      total_files: cleaned.length,
      changes_summary: this.aggregateCleanStats(cleaned)
    };
    await fs.writeFile(
      path.join(cleanedDir, '_index.json'),
      JSON.stringify(stats, null, 2),
      'utf-8'
    );

    await fs.writeFile(
      path.join(cleanedDir, '_quality-filter.json'),
      JSON.stringify({
        generated_at: new Date().toISOString(),
        kept: this._filterResults.filter(result => result.passed).length,
        discarded: this._filterResults.filter(result => !result.passed).length,
        results: this._filterResults
      }, null, 2),
      'utf-8'
    );

    await fs.writeFile(
      path.join(cleanedDir, '_classification.json'),
      JSON.stringify({
        generated_at: new Date().toISOString(),
        classified: this._classificationResults.filter(result => result.feature).length,
        unclassified: this._classificationResults.filter(result => !result.feature).length,
        results: this._classificationResults
      }, null, 2),
      'utf-8'
    );

    await fs.writeFile(
      path.join(cleanedDir, '_office-rendering.json'),
      JSON.stringify({
        generated_at: new Date().toISOString(),
        results: this._officeRenderingResults
      }, null, 2),
      'utf-8'
    );
  }

  decodeFileName(fileName) {
    return decodeFileName(fileName);
  }

  buildDocumentManifest(item, docId, sourceName) {
    const sourceMetrics = { ...(item.metadata.sourceMetrics || {}) };
    delete sourceMetrics.sourceText;
    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      docId,
      title: item.metadata.title,
      sourcePath: item.metadata.originalFile,
      sourceName,
      rawSourceName: item.metadata.rawSourceName || path.basename(item.filePath),
      sourceFormat: item.metadata.sourceFormat,
      sourceHash: item.metadata.hash || item.hash,
      sourceMetrics,
      officeRendering: item.metadata.officeRendering || { enabled: false, status: 'disabled', pageCount: 0 },
      assets: (item.metadata.assets || []).map(serializableAsset)
    };
  }

  buildCleaningDiff(originalContent, cleanedContent) {
    const cleanedBody = cleanedContent.replace(/^---\n[\s\S]*?\n---\n?/, '');
    const cleanedLines = new Set(cleanedBody.split('\n').map(line => line.trim()).filter(Boolean));
    const removedLines = originalContent.split('\n')
      .map(line => line.trim())
      .filter(line => line && !cleanedLines.has(line));
    return {
      originalChars: originalContent.length,
      cleanedBodyChars: cleanedBody.length,
      removedLineCount: removedLines.length,
      removedLines: removedLines.slice(0, 100)
    };
  }

  createCaptionProvider(config) {
    if (config.providerInstance) return config.providerInstance;
    if (!config.enabled || config.provider !== 'openai-compatible') return null;
    return new OpenAICompatibleImageCaptionProvider(config);
  }

  createOfficeRenderer(config) {
    if (config.rendererInstance) return config.rendererInstance;
    if (config.enabled !== true || config.provider !== 'libreoffice') return null;
    return new LibreOfficeRenderer(config);
  }

  /**
   * 聚合清洗统计
   */
  aggregateCleanStats(cleanedDocs) {
    const stats = {
      total: cleanedDocs.length,
      quarantined: this._quarantinedDocs.length,
      media_assets: cleanedDocs.reduce((sum, item) => sum + (item.metadata?.assets || []).length, 0),
      meta_removed: 0,
      links_cleaned: 0,
      images_handled: 0,
      anchors_cleaned: 0,
      headings_normalized: 0,
      yaml_front_added: 0
    };

    for (const doc of cleanedDocs) {
      for (const change of (doc.changes || [])) {
        if (stats[change] !== undefined) {
          stats[change]++;
        }
      }
    }

    return stats;
  }

  /**
   * 获取文件 hash 清单（供快照使用）
   */
  getFileHashes() {
    return this._fileHashes;
  }
}

module.exports = { DesignDocPipeline };
