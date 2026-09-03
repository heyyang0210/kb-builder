const { LayeredIndexer } = require('./layered-indexer');
const { VectorIndexer } = require('./vector-indexer');
const { KnowledgeGraphIndexer } = require('./knowledge-graph-indexer');
const { IndexQualityEvaluator } = require('../index-quality-evaluator');

class HybridIndexer {
  constructor(config = {}) {
    this.layeredIndexer = config.layeredIndexer || new LayeredIndexer(config.layered || config);
    this.vectorIndexer = config.vectorIndexer || new VectorIndexer(config.vector || {});
    this.graphIndexer = config.graphIndexer || new KnowledgeGraphIndexer(config.graph || {});
    this.evaluator = config.evaluator || new IndexQualityEvaluator(config.evaluation || {});
  }

  async build(items, config, delta) {
    const outputDir = config.output?.baseDir || '';
    const context = { outputDir, delta, config };
    const layered = await this.layeredIndexer.build(items, config, delta);
    const vector = await this.vectorIndexer.build(items, context);
    const graph = await this.graphIndexer.build(items, context);
    let evaluation = { skipped: true };

    if (!vector.skipped && !graph.skipped) {
      evaluation = await this.evaluator.evaluate({
        chunks: items.filter(item => item.chunkId),
        vectorStore: this.vectorIndexer.store,
        graphStore: this.graphIndexer.store,
        outputDir
      });
    }

    return { layered, vector, graph, evaluation };
  }
}

module.exports = { HybridIndexer };
