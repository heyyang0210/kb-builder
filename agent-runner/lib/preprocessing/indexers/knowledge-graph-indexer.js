const fs = require('fs').promises;
const path = require('path');
const { SearchIndex } = require('../contracts/search-index');
const { JsonGraphStore } = require('../stores/json-graph-store');

class KnowledgeGraphIndexer extends SearchIndex {
  constructor(config = {}) {
    super();
    this.config = { enabled: config.enabled !== false, ...config };
    this.store = config.store || null;
  }

  async build(items, context = {}) {
    if (!this.config.enabled) return { skipped: true };
    const store = this.resolveStore(context);
    await store.initialize();
    if (context.delta?.full) {
      const existing = await store.listNodes();
      if (existing.length > 0) await store.deleteNodes(existing.map(node => node.id));
    }
    await this.deleteChangedNodes(store, context.delta);
    const { nodes, edges } = this.buildGraph(items);
    await store.upsertNodes(nodes);
    await store.upsertEdges(edges);
    const statistics = await store.statistics();
    await this.writeStatistics(context.outputDir, statistics);
    return { nodesUpserted: nodes.length, edgesUpserted: edges.length, statistics };
  }

  async search(query, options = {}) {
    const store = options.store || this.store;
    if (!store) throw new Error('KnowledgeGraphIndexer search requires a graph store');
    return store.getSubgraph(query, options);
  }

  resolveStore(context) {
    if (this.store) return this.store;
    const outputDir = context.outputDir || process.cwd();
    this.store = new JsonGraphStore({ directory: path.join(outputDir, 'graph') });
    return this.store;
  }

  buildGraph(items) {
    const nodes = new Map();
    const edges = new Map();
    for (const item of items) {
      if (!item.chunkId) continue;
      const metadata = item.metadata || {};
      const docId = this.extractDocId(item.chunkId);
      const documentNodeId = `document:${docId}`;
      const chunkNodeId = `chunk:${item.chunkId}`;

      this.addNode(nodes, {
        id: documentNodeId,
        type: 'Document',
        label: metadata.title || docId,
        properties: this.commonProperties(metadata)
      });
      this.addNode(nodes, {
        id: chunkNodeId,
        type: 'Chunk',
        label: item.sectionPath || metadata.title || item.chunkId,
        properties: { ...this.commonProperties(metadata), chunkId: item.chunkId, tokens: item.tokens || 0 }
      });
      this.addEdge(edges, this.edge(documentNodeId, chunkNodeId, 'HAS_CHUNK', 1, item.chunkId, '分块归属'));

      if (metadata.feature) {
        const featureNodeId = `feature:${this.slug(metadata.feature)}`;
        this.addNode(nodes, { id: featureNodeId, type: 'Feature', label: metadata.feature, properties: {} });
        this.addEdge(edges, this.edge(chunkNodeId, featureNodeId, 'BELONGS_TO', metadata.featureConfidence || 0.8, item.chunkId, metadata.featureReason || '特性分类'));
      }

      for (const keyword of metadata.keywords || []) {
        const termNodeId = `term:${this.slug(keyword)}`;
        this.addNode(nodes, { id: termNodeId, type: 'Term', label: keyword, properties: {} });
        this.addEdge(edges, this.edge(chunkNodeId, termNodeId, 'MENTIONS', 0.8, item.chunkId, '文档关键词'));
      }
    }
    return { nodes: Array.from(nodes.values()), edges: Array.from(edges.values()) };
  }

  commonProperties(metadata) {
    return {
      title: metadata.title || '',
      version: metadata.version || '',
      docType: metadata.docType || '',
      sourcePath: metadata.sourcePath || metadata.originalFile || '',
      feature: metadata.feature || ''
    };
  }

  edge(from, to, type, weight, sourceChunkId, reason) {
    return {
      from,
      to,
      type,
      weight: Math.max(0, Math.min(1, weight)),
      evidence: { source: 'preprocessing', sourceChunkId, reason }
    };
  }

  addNode(nodes, node) {
    nodes.set(node.id, node);
  }

  addEdge(edges, edge) {
    edges.set(`${edge.from}|${edge.type}|${edge.to}`, edge);
  }

  extractDocId(chunkId) {
    return String(chunkId).replace(/-chunk-\d+$/, '');
  }

  slug(value) {
    return String(value).trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-');
  }

  async deleteChangedNodes(store, delta) {
    if (!delta) return;
    const changedPaths = new Set([
      ...(delta.modified || []).map(item => item.filePath),
      ...(delta.deleted || []).map(item => item.filePath)
    ]);
    if (changedPaths.size === 0) return;
    const nodes = await store.listNodes();
    const ids = nodes.filter(node => changedPaths.has(node.properties?.sourcePath)).map(node => node.id);
    if (ids.length > 0) await store.deleteNodes(ids);
  }

  async writeStatistics(outputDir, statistics) {
    if (!outputDir) return;
    const graphDir = path.join(outputDir, 'graph');
    await fs.mkdir(graphDir, { recursive: true });
    await fs.writeFile(path.join(graphDir, 'statistics.json'), JSON.stringify(statistics, null, 2), 'utf-8');
  }
}

module.exports = { KnowledgeGraphIndexer };
