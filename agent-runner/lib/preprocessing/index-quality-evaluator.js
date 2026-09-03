const fs = require('fs').promises;
const path = require('path');

class IndexQualityEvaluator {
  constructor(config = {}) {
    this.config = {
      vectorCoverageThreshold: config.vectorCoverageThreshold ?? 0.99,
      graphEvidenceThreshold: config.graphEvidenceThreshold ?? 1,
      maxIsolatedChunkRate: config.maxIsolatedChunkRate ?? 0.05
    };
  }

  async evaluate({ chunks, vectorStore, graphStore, outputDir }) {
    const [records, vectorStatistics, nodes, graphStatistics] = await Promise.all([
      vectorStore.list(),
      vectorStore.statistics(),
      graphStore.listNodes(),
      graphStore.statistics()
    ]);
    const chunkIds = new Set(chunks.map(chunk => chunk.chunkId));
    const vectorIds = new Set(records.map(record => record.id));
    const graphChunkIds = new Set(nodes.filter(node => node.type === 'Chunk').map(node => node.properties?.chunkId));
    const missingVectors = Array.from(chunkIds).filter(id => !vectorIds.has(id));
    const orphanVectors = Array.from(vectorIds).filter(id => !chunkIds.has(id));
    const missingGraphNodes = Array.from(chunkIds).filter(id => !graphChunkIds.has(id));
    const vectorCoverage = chunkIds.size === 0 ? 1 : (chunkIds.size - missingVectors.length) / chunkIds.size;
    const graphCoverage = chunkIds.size === 0 ? 1 : (chunkIds.size - missingGraphNodes.length) / chunkIds.size;

    const report = {
      generatedAt: new Date().toISOString(),
      passed: vectorCoverage >= this.config.vectorCoverageThreshold &&
        graphStatistics.evidenceCoverage >= this.config.graphEvidenceThreshold,
      vector: { ...vectorStatistics, vectorCoverage, missingVectors, orphanVectors },
      graph: { ...graphStatistics, graphCoverage, missingGraphNodes }
    };
    if (outputDir) await this.writeReport(outputDir, report);
    return report;
  }

  async writeReport(outputDir, report) {
    const reportsDir = path.join(outputDir, 'reports');
    await fs.mkdir(reportsDir, { recursive: true });
    await fs.writeFile(path.join(reportsDir, 'index-quality.json'), JSON.stringify(report, null, 2), 'utf-8');
  }
}

module.exports = { IndexQualityEvaluator };
