const filter = require('../../../packages/agent-runner-core/lib/retrieval/result-filter');

describe('检索结果公开数据边界', () => {
  const rows = [{ ku_name: '存储指南', score: 0.8 }];
  test.each([
    null, { success: false, structuredContent: { results: rows } }, {},
    { content: {} }, { content: [{ type: 'image' }] }, { content: [{ type: 'text' }] },
    { content: [{ type: 'text', text: '{' }] },
    { response: {} }, { response: { data: { content: {} } } },
    { response: { data: { content: [{ type: 'image' }] } } },
    { response: { data: { content: [{ type: 'text', text: '' }] } } },
    { response: { data: { content: [{ type: 'text', text: '{' }] } } },
    { structuredContent: {} },
  ])('空值和非法信封安全返回空列表 %#', value => {
    expect(filter.processMcpResult('存储', 'syntax', value)).toEqual({ query: '存储', dimension: 'syntax', results: [] });
  });
  test.each([
    { structuredContent: { results: rows } },
    { data: { structuredContent: { results: rows } } },
    { content: [{ type: 'image' }, { type: 'text', text: JSON.stringify({ results: rows }) }] },
    { data: { content: [{ type: 'text', text: JSON.stringify({ results: rows }) }] } },
    { response: { data: { structuredContent: { results: rows } } } },
    { response: { data: { content: [{ type: 'image' }, { type: 'text', text: JSON.stringify({ results: rows }) }] } } },
    { content: [{ type: 'text', text: '{' }], response: { data: { structuredContent: { results: rows } } } },
  ])('兼容结构和文本响应并保留查询维度 %#', value => {
    expect(filter.processMcpResult('存储', 'boundary', value)).toEqual({ query: '存储', dimension: 'boundary', results: rows });
  });
  test('已有结构优先于文本与兼容信封', () => {
    expect(filter.processMcpResult('q', 'd', {
      structuredContent: { results: rows }, content: [{ type: 'text', text: '{' }],
      response: { data: { structuredContent: { results: [] } } },
    }).results).toEqual(rows);
  });
  test('去重替换最高分、保留唯一查询并丢弃无名称条目', () => {
    const data = [
      { query: '甲', dimension: 'old', results: [{ ku_name: 'A', score: 0.2, title: '旧' }, {}, { ku_name: 'B' }, { ku_name: 'C', score: 0 }] },
      { query: '乙', dimension: 'new', results: [{ ku_name: 'A', score: 0.9, title: '新' }, { ku_name: 'B', score: 0.1 }] },
      { query: '乙', dimension: 'ignored', results: [{ ku_name: 'A', score: 0.8 }] },
      { query: '空' },
    ];
    expect(filter.deduplicate(data)).toEqual([
      { ku_name: 'A', score: 0.9, title: '新', dimension: 'new', best_score: 0.9, matched_queries: ['甲', '乙'] },
      { ku_name: 'B', score: 0.1, dimension: 'new', best_score: 0.1, matched_queries: ['甲', '乙'] },
      { ku_name: 'C', score: 0, dimension: 'old', best_score: 0, matched_queries: ['甲'] },
    ]);
    expect(filter.deduplicate([])).toEqual([]);
    expect(filter.deduplicate([{ query: 'q' }])).toEqual([]);
  });
  test('正常动态阈值排除低分且不修改输入顺序', () => {
    const input = [{ ku_name: 'low', score: 0.1 }, { ku_name: 'b', score: 0.9 }, { ku_name: 'a', score: 1 }, { ku_name: 'c', best_score: 0.8 }, { ku_name: 'none' }];
    expect(filter.filterByScore(input).map(r => r.ku_name)).toEqual(['a', 'b', 'c']);
    expect(input.map(r => r.ku_name)).toEqual(['low', 'b', 'a', 'c', 'none']);
    expect(filter.filterByScore(input, { topK: 3 }).map(r => r.ku_name)).toEqual(['a', 'b', 'c']);
  });
  test('不足三项时回退到topK、零分值与空列表', () => {
    const input = [{ ku_name: 'empty' }, { ku_name: 'best', best_score: 0.2 }, { ku_name: 'scored', score: 0.1 }];
    expect(filter.filterByScore(input, { topK: 2 }).map(r => r.ku_name)).toEqual(['best', 'scored']);
    expect(filter.filterByScore(input, { topK: 0 })).toEqual([]);
    expect(filter.filterByScore(null)).toEqual([]);
    expect(filter.filterByScore([])).toEqual([]);
  });
  test('关键词大小写去重、分值回退和缺失文本字段', () => {
    const input = [{ ku_name: 'A', title: 'SQL指南', best_score: 0.5 }, { ku_name: 'B', excerpt: 'sql', score: 0.8 }, {}];
    expect(filter.rerankByKeywordHit(input, null)).toBe(input);
    expect(filter.rerankByKeywordHit(input, [])).toBe(input);
    const ranked = filter.rerankByKeywordHit(input, ['SQL', 'sql']);
    expect(ranked.map(r => r.ku_name)).toEqual(['B', 'A', undefined]);
    expect(ranked[0]).toMatchObject({ keywordHitCount: 1, keywordScore: 0.5 });
    expect(ranked[0].combinedScore).toBeCloseTo(0.71);
    expect(ranked[1].combinedScore).toBeCloseTo(0.5);
    expect(ranked[2]).toMatchObject({ keywordHitCount: 0, keywordScore: 0, combinedScore: 0 });
    expect(input[0].combinedScore).toBeUndefined();
  });
  test('维度归类默认与追加', () => {
    const input = [{ dimension: 'syntax' }, { dimension: 'syntax' }, {}, { dimension: '' }];
    expect(filter.groupByDimension(input)).toEqual({ syntax: input.slice(0, 2), other: input.slice(2) });
    expect(filter.groupByDimension([])).toEqual({});
  });
  test('完整流水线维度优先级、统计及空输入', () => {
    const input = [
      { query: 'mapped', dimension: 'ignored', structuredContent: { results: [{ ku_name: 'A', score: 0.8 }] } },
      { query: 'explicit', dimension: 'parameter', structuredContent: { results: [{ ku_name: 'B', score: 0.7 }] } },
      { query: 'default', structuredContent: { results: [{ ku_name: 'C', score: 0.6 }] } },
      { query: 'empty', success: false },
    ];
    const result = filter.pipeline(input, { mapped: 'syntax' });
    expect(result.stats).toEqual({ before_dedup: 3, after_dedup: 3, after_filter: 3, dimensions: ['syntax', 'parameter', 'other'] });
    expect(result.grouped.other[0].ku_name).toBe('C');
    expect(filter.pipeline([], {})).toEqual({ filtered: [], grouped: {}, stats: { before_dedup: 0, after_dedup: 0, after_filter: 0, dimensions: [] } });
    const ranked = filter.pipeline(input, {}, { keywords: ['A'], topK: 1 });
    expect(ranked.filtered[0]).toMatchObject({ ku_name: 'A', keywordHitCount: 1 });
    expect(ranked.stats.after_filter).toBe(1);
  });
});
