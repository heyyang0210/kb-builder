const { HybridRetriever } = require('../../lib/preprocessing/retrievers/hybrid-retriever');

describe('HybridRetriever', () => {
  test('应使用 RRF 融合关键词和向量结果', async () => {
    const retriever = new HybridRetriever({
      vectorIndexer: { search: async () => [
        { id: 'chunk-a', score: 0.9, source: 'vector' },
        { id: 'chunk-b', score: 0.8, source: 'vector' }
      ] },
      keywordSearch: async () => [
        { id: 'chunk-b', score: 10, source: 'keyword' },
        { id: 'chunk-c', score: 8, source: 'keyword' }
      ]
    });
    const results = await retriever.search('事务', { topK: 3 });
    expect(results).toHaveLength(3);
    expect(results.map(result => result.id)).toEqual(['chunk-b', 'chunk-a', 'chunk-c']);
    expect(results[0].sources).toEqual(expect.arrayContaining(['keyword', 'vector']));
  });

  test('开启图扩展时应返回局部子图', async () => {
    const retriever = new HybridRetriever({
      vectorIndexer: { search: async () => [{ id: 'chunk-a', score: 0.9 }] },
      keywordSearch: async () => [],
      graphStore: { getSubgraph: async () => ({ nodes: [{ id: 'feature:a' }], edges: [] }) }
    });
    const results = await retriever.search('事务', { enableGraphExpansion: true });
    expect(results[0].subgraph.nodes).toHaveLength(1);
  });
});
