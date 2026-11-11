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

describe('索引增量生命周期与持久化回读', () => {
  let directory;
  beforeEach(async () => {
    const base = path.resolve(__dirname, '../../../../runtime/test-results');
    await fs.mkdir(base, { recursive: true });
    directory = await fs.mkdtemp(path.join(base, 'index-lifecycle-'));
  });
  afterEach(async () => fs.rm(directory, { recursive: true, force: true }));
  const chunk = (id, sourcePath, content = '事务提交') => ({
    chunkId: `${id}-chunk-0`, content, metadata: { sourcePath }
  });

  test('向量增量替换修改文件、删除旧文件并保留未变更记录，重建清空旧记录', async () => {
    const indexer = new VectorIndexer();
    await indexer.build([chunk('changed', 'a.md'), chunk('deleted', 'b.md'), chunk('kept', 'c.md')], { outputDir: directory });
    const updated = await indexer.build([chunk('replacement', 'a.md', '新事务流程')], {
      outputDir: directory, delta: { modified: [{ filePath: 'a.md' }], deleted: [{ filePath: 'b.md' }] }
    });
    expect(updated.statistics.recordCount).toBe(2);
    const recordsPath = path.join(directory, 'vector/records.json');
    const persisted = new JsonVectorStore({ filePath: recordsPath });
    expect((await persisted.list()).map(item => item.id).sort()).toEqual(['kept-chunk-0', 'replacement-chunk-0']);
    expect((await new VectorIndexer().search('新事务流程', { store: persisted, topK: 1 }))[0]).toMatchObject({ id: 'replacement-chunk-0', document: '新事务流程' });
    for (const delta of [{}, { modified: [{ filePath: 'absent.md' }] }, { deleted: [{ filePath: 'absent.md' }] }]) {
      expect((await indexer.build([], { delta })).statistics.recordCount).toBe(2);
    }
    await indexer.build([chunk('fresh', 'new.md')], { outputDir: directory, delta: { full: true } });
    expect((await new JsonVectorStore({ filePath: recordsPath }).list()).map(item => item.id)).toEqual(['fresh-chunk-0']);
    const manifest = JSON.parse(await fs.readFile(path.join(directory, 'vector/manifest.json'), 'utf8'));
    expect(manifest.records.map(item => item.id)).toEqual(['fresh-chunk-0']);
    expect(JSON.parse(await fs.readFile(path.join(directory, 'vector/statistics.json'), 'utf8')).recordCount).toBe(1);
    await indexer.build([], { delta: { full: true } });
    expect((await indexer.build([], { delta: { full: true } })).statistics.recordCount).toBe(0);
  });

  test('图谱增量清理修改和删除文件的节点与边，重建结果可由新实例查询', async () => {
    const indexer = new KnowledgeGraphIndexer();
    await indexer.build([chunk('changed', 'a.md'), chunk('deleted', 'b.md'), chunk('kept', 'c.md')], { outputDir: directory });
    const updated = await indexer.build([chunk('replacement', 'a.md')], {
      outputDir: directory, delta: { modified: [{ filePath: 'a.md' }], deleted: [{ filePath: 'b.md' }] }
    });
    expect(updated.statistics).toMatchObject({ nodeCount: 4, edgeCount: 2 });
    const persisted = new JsonGraphStore({ directory: path.join(directory, 'graph') });
    expect((await persisted.listNodes()).map(item => item.id).sort()).toEqual([
      'chunk:kept-chunk-0', 'chunk:replacement-chunk-0', 'document:kept', 'document:replacement'
    ]);
    const subgraph = await new KnowledgeGraphIndexer().search('document:replacement', { store: persisted });
    expect(subgraph.nodes.map(item => item.id).sort()).toEqual(['chunk:replacement-chunk-0', 'document:replacement']);
    expect(subgraph.edges).toHaveLength(1);
    for (const delta of [{}, { modified: [{ filePath: 'absent.md' }] }, { deleted: [{ filePath: 'absent.md' }] }]) {
      expect((await indexer.build([], { delta })).statistics).toMatchObject({ nodeCount: 4, edgeCount: 2 });
    }
    await indexer.build([chunk('fresh', 'new.md')], { outputDir: directory, delta: { full: true } });
    const reloaded = new JsonGraphStore({ directory: path.join(directory, 'graph') });
    expect((await reloaded.listNodes()).map(item => item.id).sort()).toEqual(['chunk:fresh-chunk-0', 'document:fresh']);
    expect(JSON.parse(await fs.readFile(path.join(directory, 'graph/statistics.json'), 'utf8'))).toMatchObject({ nodeCount: 2, edgeCount: 1 });
    await indexer.build([], { delta: { full: true } });
    expect((await indexer.build([], { delta: { full: true } })).statistics).toMatchObject({ nodeCount: 0, edgeCount: 0 });
  });

  test('禁用构建不初始化存储，无存储搜索明确拒绝', async () => {
    for (const Indexer of [VectorIndexer, KnowledgeGraphIndexer]) {
      expect(await new Indexer({ enabled: false }).build([chunk('ignored', 'a.md')])).toEqual({ skipped: true });
      await expect(new Indexer().search('事务')).rejects.toThrow('requires a');
    }
    expect(await fs.readdir(directory)).toEqual([]);
  });

  test('向量忽略缺少标识或正文的输入，最小输入使用兼容元数据', async () => {
    const indexer = new VectorIndexer();
    const result = await indexer.build([
      { content: '无标识' }, { chunkId: 'empty' }, { chunkId: 'blank', content: '  ' },
      { chunkId: 'minimal-chunk-0', content: '数据库事务' },
      { chunkId: 'original-chunk-0', bodyContent: '优先正文', content: '旧正文', metadata: { originalFile: 'original.md' } }
    ], { outputDir: directory, delta: { full: true } });
    expect(result.statistics.recordCount).toBe(2);
    const records = await indexer.store.list();
    expect(records[0].metadata).toMatchObject({ docId: 'minimal', title: '', feature: '', subFeature: '', version: '', docType: '', sourcePath: '' });
    expect(records[1]).toMatchObject({ document: '优先正文', metadata: { sourcePath: 'original.md' } });
  });

  test('向量存储拒绝非有限数值且保留已写入记录', async () => {
    const filePath = path.join(directory, 'vector', 'records.json');
    const store = new JsonVectorStore({ filePath });
    await store.upsert([{ id: 'valid', vector: [1, 0], document: '有效正文' }]);
    for (const value of [NaN, Infinity, -Infinity]) {
      await expect(store.upsert([{ id: 'valid', vector: [value, 0], document: '污染正文' }]))
        .rejects.toThrow('Vector record valid contains invalid values');
    }
    const reloaded = new JsonVectorStore({ filePath });
    expect(await reloaded.list()).toEqual([{ id: 'valid', vector: [1, 0], document: '有效正文' }]);
    const results = await reloaded.query([1, 0]);
    expect(results).toMatchObject([{ id: 'valid', score: 1, document: '有效正文' }]);
  });

  test('图谱忽略缺少标识的输入并保留最小分块、关键词和特性证据', async () => {
    const indexer = new KnowledgeGraphIndexer();
    const result = await indexer.build([
      {}, { chunkId: 'minimal-chunk-0' },
      { chunkId: 'feature-chunk-0', metadata: { title: '事务', originalFile: 'original.md', feature: '日志', keywords: ['事务'] } }
    ], { outputDir: directory, delta: { full: true } });
    expect(result.statistics).toMatchObject({ nodeCount: 6, edgeCount: 4 });
    const subgraph = await indexer.search('chunk:feature-chunk-0');
    expect(subgraph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'feature:日志', label: '日志' }),
      expect.objectContaining({ id: 'term:事务', label: '事务' }),
      expect.objectContaining({ id: 'chunk:feature-chunk-0', properties: expect.objectContaining({ sourcePath: 'original.md', tokens: 0 }) })
    ]));
    expect(subgraph.edges.find(edge => edge.type === 'BELONGS_TO')).toMatchObject({ weight: 0.8, evidence: { reason: '特性分类' } });
    expect((await indexer.search('document:minimal')).nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'chunk:minimal-chunk-0', label: 'minimal-chunk-0' })
    ]));
  });

  test('图谱拒绝越界边权重且不会持久化非法边', async () => {
    const graphDirectory = path.join(directory, 'graph');
    const store = new JsonGraphStore({ directory: graphDirectory });
    await store.upsertNodes([{ id: 'a', type: 'Document' }, { id: 'b', type: 'Document' }]);
    for (const weight of [-0.01, 1.01]) {
      await expect(store.upsertEdges([{ from: 'a', to: 'b', type: 'RELATED', weight }]))
        .rejects.toThrow('Graph edge weight must be between 0 and 1');
    }
    expect(await new JsonGraphStore({ directory: graphDirectory }).listEdges()).toEqual([]);
    await store.upsertEdges([{ from: 'a', to: 'b', type: 'RELATED', weight: 0 }]);
    expect(await new JsonGraphStore({ directory: graphDirectory }).listEdges()).toMatchObject([
      { from: 'a', to: 'b', type: 'RELATED', weight: 0 }
    ]);
  });

  test('损坏的图谱 JSON 必须报错，修复后可正常回读', async () => {
    const graphDirectory = path.join(directory, 'graph');
    await fs.mkdir(graphDirectory, { recursive: true });
    const nodesPath = path.join(graphDirectory, 'nodes.json');
    await fs.writeFile(nodesPath, '{');
    await expect(new JsonGraphStore({ directory: graphDirectory }).listNodes()).rejects.toThrow(SyntaxError);
    await fs.writeFile(nodesPath, '[{"id":"recovered","type":"Document"}]');
    expect(await new JsonGraphStore({ directory: graphDirectory }).listNodes()).toEqual([
      { id: 'recovered', type: 'Document' }
    ]);
  });
});

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
