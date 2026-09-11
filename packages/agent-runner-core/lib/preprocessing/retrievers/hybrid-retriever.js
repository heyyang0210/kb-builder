class HybridRetriever {
  constructor(config = {}) {
    this.vectorIndexer = config.vectorIndexer;
    this.graphStore = config.graphStore;
    this.keywordSearch = config.keywordSearch || (async () => []);
    this.rrfConstant = config.rrfConstant || 60;
  }

  async search(query, options = {}) {
    const topK = options.topK || 10;
    const [keywordResults, vectorResults] = await Promise.all([
      this.keywordSearch(query, { ...options, topK: topK * 2 }),
      this.vectorIndexer.search(query, { ...options, topK: topK * 2 })
    ]);
    const fused = this.reciprocalRankFusion([keywordResults, vectorResults]);
    const results = fused.slice(0, topK);

    if (options.enableGraphExpansion && this.graphStore) {
      for (const result of results.slice(0, options.graphSeedCount || 3)) {
        result.subgraph = await this.graphStore.getSubgraph(`chunk:${result.id}`, {
          depth: options.graphDepth || 1
        });
      }
    }
    return results;
  }

  reciprocalRankFusion(resultLists) {
    const scores = new Map();
    for (const results of resultLists) {
      results.forEach((result, index) => {
        const id = result.id || result.chunkId;
        if (!id) return;
        const current = scores.get(id) || { ...result, id, score: 0, sources: [] };
        current.score += 1 / (this.rrfConstant + index + 1);
        current.sources.push(result.source || 'search');
        scores.set(id, current);
      });
    }
    return Array.from(scores.values()).sort((left, right) => right.score - left.score);
  }
}

module.exports = { HybridRetriever };
