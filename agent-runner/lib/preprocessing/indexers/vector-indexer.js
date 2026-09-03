const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { SearchIndex } = require('../contracts/search-index');
const { HashEmbeddingProvider } = require('../embeddings/hash-embedding-provider');
const { JsonVectorStore } = require('../stores/json-vector-store');

class VectorIndexer extends SearchIndex {
  constructor(config = {}) {
    super();
    this.config = { enabled: config.enabled !== false, ...config };
    this.embeddingProvider = config.embeddingProvider || new HashEmbeddingProvider(config.embedding || {});
    this.store = config.store || null;
  }

  async build(items, context = {}) {
    if (!this.config.enabled) return { skipped: true };
    const store = this.resolveStore(context);
    await store.initialize();
    if (context.delta?.full) {
      const existing = await store.list();
      if (existing.length > 0) await store.delete(existing.map(record => record.id));
    }
    await this.deleteChangedRecords(store, context.delta);

    const records = [];
    for (const item of items) {
      const content = item.bodyContent || item.content || '';
      if (!item.chunkId || !content.trim()) continue;
      const vector = await this.embeddingProvider.embed(content);
      records.push({
        id: item.chunkId,
        document: content,
        vector,
        metadata: this.buildMetadata(item, content)
      });
    }

    const result = await store.upsert(records);
    const statistics = await store.statistics();
    await this.writeManifest(context.outputDir, records, statistics);
    return { ...result, statistics, model: this.embeddingProvider.name };
  }

  async search(query, options = {}) {
    const store = options.store || this.store;
    if (!store) throw new Error('VectorIndexer search requires a vector store');
    const vector = await this.embeddingProvider.embed(query);
    return store.query(vector, options);
  }

  resolveStore(context) {
    if (this.store) return this.store;
    const outputDir = context.outputDir || process.cwd();
    this.store = new JsonVectorStore({ filePath: path.join(outputDir, 'vector', 'records.json') });
    return this.store;
  }

  buildMetadata(item, content) {
    const metadata = item.metadata || {};
    return {
      chunkId: item.chunkId,
      docId: this.extractDocId(item.chunkId),
      title: metadata.title || '',
      feature: metadata.feature || '',
      subFeature: metadata.subFeature || '',
      version: metadata.version || '',
      docType: metadata.docType || '',
      sourcePath: metadata.sourcePath || metadata.originalFile || '',
      contentHash: crypto.createHash('sha256').update(content).digest('hex'),
      embeddingModel: this.embeddingProvider.name
    };
  }

  extractDocId(chunkId) {
    return String(chunkId).replace(/-chunk-\d+$/, '');
  }

  async deleteChangedRecords(store, delta) {
    if (!delta) return;
    const changedPaths = new Set([
      ...(delta.modified || []).map(item => item.filePath),
      ...(delta.deleted || []).map(item => item.filePath)
    ]);
    if (changedPaths.size === 0) return;
    const records = await store.list();
    const ids = records
      .filter(record => changedPaths.has(record.metadata?.sourcePath))
      .map(record => record.id);
    if (ids.length > 0) await store.delete(ids);
  }

  async writeManifest(outputDir, records, statistics) {
    if (!outputDir) return;
    const vectorDir = path.join(outputDir, 'vector');
    await fs.mkdir(vectorDir, { recursive: true });
    const manifest = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      model: this.embeddingProvider.name,
      dimension: this.embeddingProvider.dimension,
      records: records.map(record => ({ id: record.id, metadata: record.metadata }))
    };
    await Promise.all([
      fs.writeFile(path.join(vectorDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8'),
      fs.writeFile(path.join(vectorDir, 'statistics.json'), JSON.stringify(statistics, null, 2), 'utf-8')
    ]);
  }
}

module.exports = { VectorIndexer };
