const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const RetrievalStrategy = require('../../../packages/agent-runner-core/lib/retrieval-strategy');
const resultFilter = require('../../../packages/agent-runner-core/lib/retrieval/result-filter');
const contextAssembler = require('../../../packages/agent-runner-core/lib/retrieval/context-assembler');

describe('多来源检索与上下文组装', () => {
  let root;
  const put = (relative, content) => {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };

  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'retrieval-strategy-')); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('索引缺失时扫描设计文档，五种来源按优先级保留且 MCP 失败不阻断后续来源', async () => {
    put('knowledge/references/design-docs/storage.md', '# 存储参数\n兼容性说明');
    put('knowledge/references/oracle-kb/README.md', '| P1-01 | `oracle.md` | 存储架构 |');
    put('knowledge/references/oracle-kb/oracle.md', '# Oracle 存储架构');
    put('knowledge/references/test-cases/case.md', '# 存储边界测试');
    put('knowledge/references/source/engine.md', '# 存储引擎源码');
    const toolManager = { getTool: () => ({ batchQuery: async () => { throw new Error('MCP 暂不可用'); } }) };
    const strategy = new RetrievalStrategy(root, toolManager);
    const results = await strategy.executeAll({ mcpQueries: ['存储'], keywords: ['存储'], knowledgePoint: {} });

    expect(results.mcp).toMatchObject({ success: 0, failed: 1, error: 'MCP 暂不可用' });
    expect(results.designDocs.results[0]).toMatchObject({ matchType: 'design_doc_legacy', matchedKeywords: ['存储'] });
    expect(results.oracleKb.matchedEntries[0]).toMatchObject({ id: 'P1-01', matchType: 'title' });
    expect(results.testCases.results[0].matchedKeywords).toEqual(['存储']);
    expect(results.sourceCode.results[0].matchedKeywords).toEqual(['存储']);
    const assembled = strategy.integrateResults(results);
    expect(assembled.indexOf('特性设计文档')).toBeLessThan(assembled.indexOf('Oracle 知识库'));
    expect(assembled.indexOf('Oracle 知识库')).toBeLessThan(assembled.indexOf('测试用例'));
    expect(assembled.indexOf('测试用例')).toBeLessThan(assembled.indexOf('源码'));
  });

  test('索引检索只加载已确认的匹配文档和相关 chunk，限制过长正文', async () => {
    const base = 'preprocessing-output/design-docs';
    put(`${base}/index/l1-global-index.json`, JSON.stringify({ entries: [
      { id: 'storage', title: '存储参数', version: 'v1', summary_path: 'storage.json', chunk_count: 1, chunks_index: 'index/storage-chunks.json' },
      { id: 'unrelated', title: 'SQL 语法', summary_path: 'unrelated.json', content_path: 'clean/unrelated.md' },
    ] }));
    put(`${base}/index/storage.json`, JSON.stringify({ summary: '存储参数设计', key_points: ['存储边界'] }));
    put(`${base}/index/storage-chunks.json`, JSON.stringify({ chunks: [
      { chunk_id: 'relevant', keywords: ['存储'], section_path: '存储参数' },
      { chunk_id: 'unrelated', keywords: ['SQL'], section_path: '语法' },
    ] }));
    put(`${base}/index/relevant.md`, '存储相关正文'.repeat(800));
    put(`${base}/index/unrelated.md`, '不应加载');
    const strategy = new RetrievalStrategy(root);
    const result = await strategy.executeDesignDocsRetrieval({ keywords: ['存储'], knowledgePoint: { version: 'v1' } });

    expect(result.matchType).toBe('indexed');
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ source: 'storage', matchedKeywords: ['存储'] });
    expect(result.results[0].content).toHaveLength(4000);
    expect(result.results[0].content).not.toContain('不应加载');
  });

  test('跨查询去重保留最高分及命中来源，排序和动态阈值作用于完整流水线', () => {
    const raw = [
      { query: '语法', structuredContent: { results: [{ ku_name: '库甲', title: '存储语法', score: 0.9 }, { ku_name: '库乙', title: '兼容性', score: 0.4 }] } },
      { query: '参数', structuredContent: { results: [{ ku_name: '库甲', title: '存储参数', score: 0.8 }, { ku_name: '库丙', title: '存储边界', score: 0.7 }] } },
    ];
    const output = resultFilter.pipeline(raw, { 语法: 'syntax', 参数: 'parameter' }, { keywords: ['存储'], topK: 3 });
    expect(output.stats).toMatchObject({ before_dedup: 4, after_dedup: 3, after_filter: 3 });
    expect(output.filtered.find(item => item.ku_name === '库甲')).toMatchObject({ best_score: 0.9, matched_queries: ['语法', '参数'] });
    expect(output.grouped.syntax.map(item => item.ku_name)).toContain('库甲');
    expect(resultFilter.filterByScore([], { topK: 2 })).toEqual([]);
  });

  test('组装上下文时只输出有结果的维度与来源，并保留来源路径', () => {
    const grouped = { syntax: [{ title: '存储语法', ku_name: '知识库', excerpt: '语法示例', best_score: 0.8 }], boundary: [] };
    const sources = contextAssembler.convertRetrievalResults({
      designDocs: { files: [{ title: '设计稿', path: 'design/storage.md', summary: '设计依据' }] },
      testCases: { files: [{ name: '边界测试', file: 'cases/storage.md', content: '错误路径' }] },
    });
    const context = contextAssembler.assemble(grouped, sources, {}, { required: ['syntax'], optional: ['boundary'] });
    expect(context).toContain('### 语法定义');
    expect(context).toContain('设计依据');
    expect(context).toContain('路径: design/storage.md');
    expect(context).toContain('路径: cases/storage.md');
    expect(context).not.toContain('### 取值范围');
  });
});
