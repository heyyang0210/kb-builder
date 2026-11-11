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

  test('MCP 空查询、无工具及部分失败均返回可解释的结果', async () => {
    const strategy = new RetrievalStrategy(root);
    expect(await strategy.executeMcpQueries([])).toEqual({ queries: [], results: [], success: 0, failed: 0 });
    expect(await strategy.executeMcpQueries(['存储', 'SQL'])).toMatchObject({ success: 0, failed: 2 });

    const batchQuery = jest.fn().mockResolvedValue([
      { success: true, data: { structuredContent: { total: 2, results: [{ title: '存储参数', score: 0.8, excerpt: '参数范围', ku_name: '内核' }] } } },
      { success: false, error: '上游超时' },
    ]);
    const active = new RetrievalStrategy(root, { getTool: name => name === 'mcp' && { batchQuery } });
    const result = await active.executeMcpQueries(['存储', 'SQL']);
    expect(batchQuery).toHaveBeenCalledWith(['存储', 'SQL']);
    expect(result).toMatchObject({ success: 1, failed: 1 });
    const integrated = active.integrateResults({ mcp: result });
    expect(integrated).toContain('存储参数');
    expect(integrated).toContain('相关度: 80%');
    expect(integrated).toContain('查询失败：上游超时');
  });

  test('索引无候选、摘要及正文损坏时只返回可读的设计文档', async () => {
    const base = 'preprocessing-output/design-docs';
    const index = `${base}/index/l1-global-index.json`;
    put(index, JSON.stringify({ entries: [{ id: 'sql', title: 'SQL 语法', summary_path: 'sql.json' }] }));
    const strategy = new RetrievalStrategy(root);
    expect(await strategy.executeDesignDocsRetrieval({ keywords: ['存储'], knowledgePoint: {} }))
      .toMatchObject({ matchType: 'indexed', results: [] });

    put(index, JSON.stringify({ entries: [
      { id: 'missing-summary', title: '存储摘要', summary_path: 'missing.json' },
      { id: 'irrelevant', title: '存储无关', summary_path: 'irrelevant.json' },
      { id: 'missing-content', title: '存储正文', summary_path: 'content.json', content_path: 'clean/missing.md' },
      { id: 'valid', title: '存储有效', summary_path: 'valid.json', content_path: 'clean/valid.md' },
    ] }));
    put(`${base}/index/irrelevant.json`, JSON.stringify({ summary: '无关内容' }));
    put(`${base}/index/content.json`, JSON.stringify({ summary: '存储内容' }));
    put(`${base}/index/valid.json`, JSON.stringify({ key_points: ['存储'] }));
    put(`${base}/clean/valid.md`, '存储有效正文');
    const result = await strategy.executeDesignDocsRetrieval({ keywords: ['存储'], knowledgePoint: {} });
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ source: 'clean/valid.md', content: '存储有效正文' });

    put('knowledge/references/design-docs/fallback.md', '存储回退文档');
    put(index, '{ invalid json');
    expect(await strategy.executeDesignDocsRetrieval({ keywords: ['存储'] }))
      .toMatchObject({ matchType: 'legacy', results: [{ content: '存储回退文档' }] });
  });

  test('索引候选按特性编号、关键词及版本加分排序', async () => {
    const base = 'preprocessing-output/design-docs';
    put(`${base}/index/l1-global-index.json`, JSON.stringify({ entries: [
      { id: 'ordinary', title: '存储参考', summary_path: 'ordinary.json', content_path: 'clean/ordinary.md' },
      { id: 'feature', title: '其他设计', feature_id: 'P1-01', keywords: ['存储'], version: 'v2', summary_path: 'feature.json', content_path: 'clean/feature.md' },
    ] }));
    for (const name of ['ordinary', 'feature']) {
      put(`${base}/index/${name}.json`, JSON.stringify({ summary: '存储 P1-01' }));
      put(`${base}/clean/${name}.md`, `存储 P1-01 ${name}`);
    }
    const result = await new RetrievalStrategy(root).executeDesignDocsRetrieval({
      keywords: ['存储', 'P1-01'], knowledgePoint: { version: 'v2' },
    });
    expect(result.results.map(item => item.source)).toEqual(['clean/feature.md', 'clean/ordinary.md']);
  });

  test('分块索引缺失和正文缺失不会阻断其他设计文档', async () => {
    const base = 'preprocessing-output/design-docs';
    put(`${base}/index/l1-global-index.json`, JSON.stringify({ entries: [
      { id: 'broken', title: '存储分块', summary_path: 'broken.json', chunk_count: 1, chunks_index: 'index/broken-chunks.json' },
      { id: 'partial', title: '存储段落', summary_path: 'partial.json', chunk_count: 1, chunks_index: 'index/partial-chunks.json' },
    ] }));
    put(`${base}/index/broken.json`, JSON.stringify({ summary: '存储' }));
    put(`${base}/index/partial.json`, JSON.stringify({ summary: '存储' }));
    put(`${base}/index/partial-chunks.json`, JSON.stringify({ chunks: [
      { chunk_id: 'missing', keywords: ['存储'] },
      { chunk_id: 'present', section_path: '存储', keywords: [] },
      { chunk_id: 'unrelated', section_path: '语法' },
    ] }));
    put(`${base}/index/present.md`, '存储分块正文');
    const result = await new RetrievalStrategy(root).executeDesignDocsRetrieval({ keywords: ['存储'], knowledgePoint: {} });
    expect(result.results).toHaveLength(2);
    expect(result.results.map(item => item.content)).toEqual(['', '存储分块正文']);
  });

  test('Oracle 标题、编号和内容命中可并存，缺失文件不影响其他结果', async () => {
    put('knowledge/references/oracle-kb/README.md', [
      '| P1-01 | `title.md` | 存储架构 |',
      '| P1-02 | `content.md` | 其他主题 |',
      '| P1-03 | `missing.md` | 存储缺失 |',
      '| 04 | `number.md` | 编号主题 |',
      '| 非索引 | 文件 | 标题 |',
    ].join('\n'));
    put('knowledge/references/oracle-kb/title.md', '标题命中正文');
    put('knowledge/references/oracle-kb/content.md', '正文包含存储关键字');
    put('knowledge/references/oracle-kb/number.md', '无关正文');
    const strategy = new RetrievalStrategy(root);
    const result = await strategy.executeOracleKbRetrieval({ keywords: ['存储'] });
    expect(result.indexEntries).toHaveLength(4);
    expect(result.matchedEntries.map(item => [item.id, item.matchType])).toEqual([
      ['P1-01', 'title'], ['P1-02', 'content'],
    ]);
    expect((await strategy.executeOracleKbRetrieval({ keywords: ['04'] })).matchedEntries[0])
      .toMatchObject({ id: '04', matchType: 'title' });
    const empty = new RetrievalStrategy(root);
    empty.references.oracleKb = path.join(root, 'missing-oracle-index');
    expect((await empty.executeOracleKbRetrieval({ keywords: ['存储'] })).matchedEntries).toEqual([]);
  });

  test('目录扫描仅收集 Markdown 命中，源码限制数量和正文长度', async () => {
    put('knowledge/references/test-cases/one.md', 'STORAGE 用例');
    put('knowledge/references/test-cases/ignored.txt', 'storage 用例');
    put('knowledge/references/test-cases/other.md', '无关用例');
    const strategy = new RetrievalStrategy(root);
    expect((await strategy.executeTestCasesRetrieval({ keywords: ['storage'] })).results)
      .toMatchObject([{ matchedKeywords: ['storage'] }]);
    for (let i = 0; i < 7; i++) put(`knowledge/references/source/${i}.md`, `storage ${'x'.repeat(2100)}`);
    const source = await strategy.executeSourceCodeRetrieval({ keywords: ['storage'] });
    expect(source.files).toHaveLength(7);
    expect(source.results).toHaveLength(5);
    expect(source.results[0].content).toHaveLength(2016);
    expect(source.results[0].content).toContain('... (truncated)');
  });

  test('扫描后文件消失时设计文档、测试用例和源码均忽略该文件', async () => {
    const strategy = new RetrievalStrategy(root);
    jest.spyOn(strategy, '_scanDirectory').mockResolvedValue([path.join(root, 'removed.md')]);
    expect((await strategy.executeDesignDocsRetrieval({ keywords: ['存储'] })).results).toEqual([]);
    expect((await strategy.executeTestCasesRetrieval({ keywords: ['存储'] })).results).toEqual([]);
    expect((await strategy.executeSourceCodeRetrieval({ keywords: ['存储'] })).results).toEqual([]);
  });

  test('MCP 文本结果、无效 JSON 和长文截断保持稳定输出', () => {
    const strategy = new RetrievalStrategy(root);
    expect(strategy._formatMcpResult(null)).toBe('无结果');
    expect(strategy._formatMcpResult({ content: [{ type: 'text', text: JSON.stringify({ total: 3, results: [
      { title: '甲' }, { title: '乙' }, { title: '丙' },
    ] }) }] }, 2)).toContain('共 3 条结果，展示前 2 条');
    expect(strategy._formatMcpResult({ content: [{ type: 'text', text: '{bad' }], requestId: 'abc' }))
      .toContain('"requestId": "abc"');
    expect(strategy._truncateContent('a'.repeat(9000))).toContain('[省略 1000 字符]');
    expect(strategy._truncateContent('short')).toBe('short');
  });

  test('覆盖度评估区分无资料、部分命中和充分命中', () => {
    const strategy = new RetrievalStrategy(root);
    const empty = strategy.assessCoverage({}, []);
    expect(empty).toMatchObject({ keywordCoverage: 0, sourceCount: 0, recommendation: 'insufficient' });
    const partial = strategy.assessCoverage({
      testCases: { results: [{ source: 'case.md', content: `存储${'x'.repeat(400)}` }] },
    }, ['存储', 'SQL']);
    expect(partial).toMatchObject({ keywordCoverage: 0.5, sourceCount: 1, missingTopics: ['SQL'], recommendation: 'low_quality' });
    const sufficient = strategy.assessCoverage({
      mcp: { queries: ['存储'], results: [{ success: true, data: { structuredContent: { results: [{ title: '存储 SQL' }] } } }], success: 1 },
      designDocs: { results: [{ source: 'design.md', content: `存储 SQL ${'x'.repeat(1100)}` }] },
    }, ['存储', 'SQL']);
    expect(sufficient).toMatchObject({ keywordCoverage: 1, lengthScore: 1, sourceCount: 2, recommendation: 'proceed' });
  });

  test('设计索引最多确认五篇且空关键词不确认摘要', async () => {
    const base = 'preprocessing-output/design-docs';
    const entries = Array.from({ length: 7 }, (_, index) => ({
      id: `doc-${index}`, title: `存储 ${index}`, summary_path: `doc-${index}.json`, content_path: `clean/doc-${index}.md`,
    }));
    put(`${base}/index/l1-global-index.json`, JSON.stringify({ entries }));
    for (let index = 0; index < 7; index++) {
      put(`${base}/index/doc-${index}.json`, JSON.stringify({ summary: '存储' }));
      put(`${base}/clean/doc-${index}.md`, `存储 ${index}`);
    }
    const strategy = new RetrievalStrategy(root);
    expect((await strategy.executeDesignDocsRetrieval({ keywords: ['存储'] })).results).toHaveLength(5);
    expect((await strategy.executeDesignDocsRetrieval({ keywords: [], knowledgePoint: {} })).results).toEqual([]);
    expect(strategy._computeDesignDocRelevance({ summary: '存储' }, [], {})).toBe(0);
  });

  test('Oracle 三个标题匹配时不扫描其他正文', async () => {
    put('knowledge/references/oracle-kb/README.md', [
      '| P1-01 | `one.md` | 存储一 |',
      '| P1-02 | `two.md` | 存储二 |',
      '| P1-03 | `three.md` | 存储三 |',
      '| P1-04 | `four.md` | 其他主题 |',
    ].join('\n'));
    for (const name of ['one', 'two', 'three', 'four']) {
      put(`knowledge/references/oracle-kb/${name}.md`, '正文包含存储');
    }
    const result = await new RetrievalStrategy(root).executeOracleKbRetrieval({ keywords: ['存储'] });
    expect(result.matchedEntries.map(item => item.id)).toEqual(['P1-01', 'P1-02', 'P1-03']);
  });

  test('缺省 MCP 错误、无分数文本和多来源摘要仍可读', () => {
    const strategy = new RetrievalStrategy(root);
    const results = {
      mcp: { queries: ['存储'], results: [{ success: false }], success: 1 },
      designDocs: { results: [{ source: 'design.md', content: '存储' }] },
      oracleKb: { matchedEntries: [{ id: 'P1', title: '存储', content: 'Oracle 存储' }] },
      testCases: { results: [{ source: 'case.md', content: '存储测试' }] },
      sourceCode: { results: [{ source: 'source.md', content: '存储源码' }] },
    };
    expect(strategy.integrateResults(results)).toContain('查询失败：未知错误');
    expect(strategy._formatMcpResult({ structuredContent: { results: [{ excerpt: '存储说明' }] } }))
      .toContain('**未知**');
    expect(strategy._formatMcpResult({ content: 'unexpected', requestId: 'id-1' }))
      .toContain('"requestId": "id-1"');
    const coverage = strategy.assessCoverage(results, ['存储']);
    expect(coverage).toMatchObject({ sourceCount: 5, keywordCoverage: 1 });
    expect(coverage.sourceSummary).toMatchObject({
      mcp: { queries: 1, success: 1 }, designDocs: { files: 1 }, oracleKb: { files: 1 },
      testCases: { files: 1 }, sourceCode: { files: 1 },
    });
  });

  test('索引缺少摘要路径及正文路径时保持可解释的空结果', async () => {
    const base = 'preprocessing-output/design-docs';
    put(`${base}/index/l1-global-index.json`, JSON.stringify({ entries: [
      { id: 'missing-summary', version: 'v2' },
      { id: 'no-content', version: 'v2', summary_path: 'no-content.json' },
      { id: 'chunks', version: 'v2', summary_path: 'chunks.json', chunk_count: 1, chunks_index: 'index/chunks-index.json' },
    ] }));
    put(`${base}/index/no-content.json`, JSON.stringify({ summary: '存储' }));
    put(`${base}/index/chunks.json`, JSON.stringify({ summary: '存储' }));
    put(`${base}/index/chunks-index.json`, JSON.stringify({ chunks: [{ chunk_id: 'unrelated', keywords: ['SQL'] }] }));
    const strategy = new RetrievalStrategy(root);
    const result = await strategy.executeDesignDocsRetrieval({ keywords: ['存储'], knowledgePoint: { version: 'v2' } });
    expect(result.results).toMatchObject([{ source: 'no-content', content: '' }, { source: 'chunks', content: '' }]);
    expect(strategy._computeDesignDocMatchScore({ version: 'v2' }, undefined, { version: 'v2' })).toBe(2);
    expect(strategy._computeDesignDocRelevance({ summary: '存储' }, undefined, {})).toBe(0);
    expect(strategy._formatMcpResult({ structuredContent: {} })).toContain('共 0 条结果');
  });

  test('无关键词的完整检索不会产生误命中', async () => {
    put('knowledge/references/design-docs/storage.md', '存储');
    put('knowledge/references/test-cases/storage.md', '存储');
    put('knowledge/references/source/storage.md', '存储');
    const strategy = new RetrievalStrategy(root);
    const result = await strategy.executeAll({ keywords: [], knowledgePoint: {} });
    expect(result.mcp.results).toEqual([]);
    expect(result.designDocs.results).toEqual([]);
    expect(result.testCases.results).toEqual([]);
    expect(result.sourceCode.results).toEqual([]);
    expect(await strategy._loadRelevantChunks({ chunks_index: 'index/missing.json' }, undefined, root)).toBe('');
  });

  test('省略可选关键词时目录和分块检索返回空命中', async () => {
    const strategy = new RetrievalStrategy(root);
    put('knowledge/references/design-docs/storage.md', '存储');
    put('knowledge/references/test-cases/storage.md', '存储');
    put('knowledge/references/source/storage.md', '存储');
    expect((await strategy.executeDesignDocsRetrieval({})).results).toEqual([]);
    expect((await strategy.executeTestCasesRetrieval({})).results).toEqual([]);
    expect((await strategy.executeSourceCodeRetrieval({})).results).toEqual([]);
    put('preprocessing-output/design-docs/index/chunks.json', JSON.stringify({ chunks: [
      { chunk_id: 'storage', keywords: ['存储'], section_path: '存储' },
    ] }));
    put('preprocessing-output/design-docs/index/storage.md', '存储正文');
    expect(await strategy._loadRelevantChunks(
      { chunks_index: 'index/chunks.json' }, undefined, path.join(root, 'preprocessing-output/design-docs'),
    )).toBe('');
  });
});
