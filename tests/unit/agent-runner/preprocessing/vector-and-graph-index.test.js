const fs = require('fs').promises;
const path = require('path');
const { HashEmbeddingProvider } = require('../../../../packages/agent-runner-core/lib/preprocessing/embeddings/hash-embedding-provider');
const { JsonVectorStore } = require('../../../../packages/agent-runner-core/lib/preprocessing/stores/json-vector-store');
const { JsonGraphStore } = require('../../../../packages/agent-runner-core/lib/preprocessing/stores/json-graph-store');
const { VectorIndexer } = require('../../../../packages/agent-runner-core/lib/preprocessing/indexers/vector-indexer');
const { KnowledgeGraphIndexer } = require('../../../../packages/agent-runner-core/lib/preprocessing/indexers/knowledge-graph-indexer');
const { IndexQualityEvaluator } = require('../../../../packages/agent-runner-core/lib/preprocessing/index-quality-evaluator');
const { EmbeddingProvider } = require('../../../../packages/agent-runner-core/lib/preprocessing/contracts/embedding-provider');
const { GraphStore } = require('../../../../packages/agent-runner-core/lib/preprocessing/contracts/graph-store');
const { VectorStore } = require('../../../../packages/agent-runner-core/lib/preprocessing/contracts/vector-store');
const { DocumentClassifier } = require('../../../../packages/agent-runner-core/lib/preprocessing/contracts/document-classifier');
const { DocumentFilter } = require('../../../../packages/agent-runner-core/lib/preprocessing/contracts/document-filter');
const { OfficeRenderer } = require('../../../../packages/agent-runner-core/lib/preprocessing/contracts/office-renderer');
const { SearchIndex } = require('../../../../packages/agent-runner-core/lib/preprocessing/contracts/search-index');
const { parseTemplateMappingModelOutput } = require('../../../../packages/agent-runner-core/lib/template-mapping-model-output');

const TEST_DIR = path.join(process.env.YASDB_TEST_TMP_DIR || require('os').tmpdir(), `test-indexes-${Date.now()}`);

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

  test('基础存储与向量接口对未实现方法明确失败', async () => {
    const graph = new GraphStore();
    for (const [name, args] of [
      ['initialize', []], ['upsertNodes', [[]]], ['upsertEdges', [[]]], ['deleteNodes', [[]]],
      ['getSubgraph', ['node']], ['listNodes', []], ['listEdges', []], ['statistics', []]
    ]) {
      await expect(graph[name](...args)).rejects.toThrow(`GraphStore.${name} must be implemented`);
    }

    const vector = new VectorStore();
    for (const [name, args] of [
      ['initialize', []], ['upsert', [[]]], ['delete', [[]]], ['query', [[]]], ['list', []], ['statistics', []]
    ]) {
      await expect(vector[name](...args)).rejects.toThrow(`VectorStore.${name} must be implemented`);
    }
  });

  test('EmbeddingProvider 校验未实现接口并支持批量委托', async () => {
    const abstractProvider = new EmbeddingProvider();
    expect(() => abstractProvider.name).toThrow('EmbeddingProvider.name must be implemented');
    expect(() => abstractProvider.dimension).toThrow('EmbeddingProvider.dimension must be implemented');
    await expect(abstractProvider.embed('text')).rejects.toThrow('EmbeddingProvider.embed must be implemented');
    await expect(abstractProvider.embedBatch(['text'])).rejects.toThrow('EmbeddingProvider.embed must be implemented');

    class TestProvider extends EmbeddingProvider {
      get name() { return 'test'; }
      get dimension() { return 2; }
      async embed(text) { return [text.length, text.charCodeAt(0)]; }
    }
    const provider = new TestProvider();
    expect(provider.name).toBe('test');
    expect(provider.dimension).toBe(2);
    expect(await provider.embedBatch(['a', 'bc'])).toEqual([[1, 97], [2, 98]]);
    expect(await provider.embedBatch([])).toEqual([]);
  });

  test('DocumentClassifier 与 DocumentFilter 校验抽象方法并逐项委托批量输入', async () => {
    const classifier = new DocumentClassifier();
    await expect(classifier.classify({ id: 'one' })).rejects.toThrow('DocumentClassifier.classify must be implemented');

    const filter = new DocumentFilter();
    await expect(filter.evaluate({ id: 'one' })).rejects.toThrow('DocumentFilter.evaluate must be implemented');

    const seenClassifications = [];
    class TestClassifier extends DocumentClassifier {
      async classify(document) {
        seenClassifications.push(document.id);
        return { feature: document.id };
      }
    }
    const seenEvaluations = [];
    class TestFilter extends DocumentFilter {
      async evaluate(document) {
        seenEvaluations.push(document.id);
        return { passed: document.keep };
      }
    }

    const documents = [{ id: 'first', keep: true }, { id: 'second', keep: false }];
    expect(await new TestClassifier().classifyAll(documents)).toEqual([
      { feature: 'first' }, { feature: 'second' }
    ]);
    expect(seenClassifications).toEqual(['first', 'second']);
    expect(await new TestClassifier().classifyAll([])).toEqual([]);
    expect(await new TestFilter().evaluateAll(documents)).toEqual([
      { passed: true }, { passed: false }
    ]);
    expect(seenEvaluations).toEqual(['first', 'second']);
    expect(await new TestFilter().evaluateAll([])).toEqual([]);
  });

  test('OfficeRenderer 与 SearchIndex 抽象契约拒绝未实现操作', async () => {
    const renderer = new OfficeRenderer();
    await expect(renderer.isAvailable()).resolves.toBe(false);
    await expect(renderer.render('/tmp/input.docx')).rejects.toThrow('OfficeRenderer.render must be implemented');

    const searchIndex = new SearchIndex();
    await expect(searchIndex.build([])).rejects.toThrow('SearchIndex.build must be implemented');
    await expect(searchIndex.search('事务')).rejects.toThrow('SearchIndex.search must be implemented');
  });

  test('模板匹配模型输出支持 JSON、信封与围栏并拒绝无效结构', () => {
    const answer = { templateId: 'performance', reason: '性能章节' };
    expect(parseTemplateMappingModelOutput(JSON.stringify(answer))).toEqual(answer);
    expect(parseTemplateMappingModelOutput(JSON.stringify({ markdown: JSON.stringify(answer) }))).toEqual(answer);
    expect(parseTemplateMappingModelOutput(JSON.stringify({ markdown: `\n\`\`\`json\n${JSON.stringify(answer)}\n\`\`\`\n` }))).toEqual(answer);
    expect(() => parseTemplateMappingModelOutput('not json')).toThrow(SyntaxError);
    expect(() => parseTemplateMappingModelOutput(JSON.stringify({ markdown: 'not json' }))).toThrow(SyntaxError);
    for (const value of [null, [], {}, { templateId: 1, reason: 'bad' }, { templateId: 'id', reason: null }]) {
      expect(() => parseTemplateMappingModelOutput(JSON.stringify(value))).toThrow('模型返回格式无效');
    }
  });
});
