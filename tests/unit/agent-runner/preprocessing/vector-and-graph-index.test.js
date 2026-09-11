const fs = require('fs').promises;
const path = require('path');
const { HashEmbeddingProvider } = require('../../../../packages/agent-runner-core/lib/preprocessing/embeddings/hash-embedding-provider');
const { JsonVectorStore } = require('../../../../packages/agent-runner-core/lib/preprocessing/stores/json-vector-store');
const { JsonGraphStore } = require('../../../../packages/agent-runner-core/lib/preprocessing/stores/json-graph-store');
const { VectorIndexer } = require('../../../../packages/agent-runner-core/lib/preprocessing/indexers/vector-indexer');
const { KnowledgeGraphIndexer } = require('../../../../packages/agent-runner-core/lib/preprocessing/indexers/knowledge-graph-indexer');
const { IndexQualityEvaluator } = require('../../../../packages/agent-runner-core/lib/preprocessing/index-quality-evaluator');

const TEST_DIR = path.join(__dirname, '..', '..', 'tmp', `test-indexes-${Date.now()}`);

describe('本地向量和知识图谱索引', () => {
  let vectorStore;
  let graphStore;
  let chunks;

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    vectorStore = new JsonVectorStore({ filePath: path.join(TEST_DIR, 'vector', 'records.json') });
    graphStore = new JsonGraphStore({ directory: path.join(TEST_DIR, 'graph') });
    chunks = [
      {
        chunkId: 'doc-001-chunk-000',
        content: '事务提交依赖日志刷盘。',
        bodyContent: '事务提交依赖日志刷盘。',
        sectionPath: '事务管理 > 提交',
        tokens: 20,
        metadata: {
          title: '事务设计',
          sourcePath: '/docs/事务设计.md',
          originalFile: '/docs/事务设计.md',
          feature: '事务管理',
          featureConfidence: 0.9,
          featureReason: '路径分类',
          keywords: ['事务', '提交']
        }
      },
      {
        chunkId: 'doc-001-chunk-001',
        content: '事务失败时执行回滚。',
        bodyContent: '事务失败时执行回滚。',
        sectionPath: '事务管理 > 回滚',
        tokens: 20,
        metadata: {
          title: '事务设计',
          sourcePath: '/docs/事务设计.md',
          originalFile: '/docs/事务设计.md',
          feature: '事务管理',
          featureConfidence: 0.9,
          featureReason: '路径分类',
          keywords: ['事务', '回滚']
        }
      }
    ];
  });

  afterAll(async () => fs.rm(TEST_DIR, { recursive: true, force: true }));

  test('HashEmbeddingProvider 应生成固定维度且可复现的向量', async () => {
    const provider = new HashEmbeddingProvider({ dimension: 16 });
    const first = await provider.embed('事务提交');
    const second = await provider.embed('事务提交');
    expect(first).toHaveLength(16);
    expect(first).toEqual(second);
  });

  test('VectorIndexer 应构建、查询和统计向量', async () => {
    const indexer = new VectorIndexer({
      embeddingProvider: new HashEmbeddingProvider({ dimension: 16 }),
      store: vectorStore
    });
    const result = await indexer.build(chunks, { outputDir: TEST_DIR });
    expect(result.statistics.recordCount).toBe(2);
    const search = await indexer.search('事务提交', { topK: 1 });
    expect(search).toHaveLength(1);
    expect(search[0].id).toBe('doc-001-chunk-000');
  });

  test('KnowledgeGraphIndexer 应构建节点、边和统计信息', async () => {
    const indexer = new KnowledgeGraphIndexer({ store: graphStore });
    const result = await indexer.build(chunks, { outputDir: TEST_DIR });
    expect(result.statistics.nodeCount).toBeGreaterThan(0);
    expect(result.statistics.edgeCount).toBeGreaterThan(0);
    expect(result.statistics.evidenceCoverage).toBe(1);
    const subgraph = await graphStore.getSubgraph('chunk:doc-001-chunk-000', { depth: 1 });
    expect(subgraph.nodes.some(node => node.type === 'Feature')).toBe(true);
  });

  test('IndexQualityEvaluator 应识别向量和图谱覆盖率', async () => {
    const evaluator = new IndexQualityEvaluator();
    const report = await evaluator.evaluate({ chunks, vectorStore, graphStore, outputDir: TEST_DIR });
    expect(report.passed).toBe(true);
    expect(report.vector.vectorCoverage).toBe(1);
    expect(report.graph.graphCoverage).toBe(1);
    expect(await fs.stat(path.join(TEST_DIR, 'reports', 'index-quality.json'))).toBeTruthy();
  });

  test('GraphStore 应拒绝不存在节点的边', async () => {
    await expect(graphStore.upsertEdges([{
      from: 'missing', to: 'also-missing', type: 'RELATED', weight: 0.5
    }])).rejects.toThrow('missing node');
  });
});
