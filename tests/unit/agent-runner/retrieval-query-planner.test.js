const { extractCoreTerm, generateQueries, reviewQueries } = require('../../../packages/agent-runner-core/lib/retrieval/query-planner');

test.each([
  ['SQL/开发参考', ['syntax', 'boundary', 'compatibility', 'error_code', 'parameter', 'example']],
  ['理论机制', ['concept', 'mechanism', 'parameter', 'error_code', 'performance']],
  ['实战调优', ['parameter', 'best_practice', 'error_code', 'monitoring']],
  ['架构对比', ['architecture', 'compatibility', 'parameter', 'migration']],
  ['运维SOP', ['procedure', 'parameter', 'error_code', 'monitoring']],
  ['兼容性差异', ['compatibility', 'difference', 'migration', 'error_code', 'parameter']],
  ['通用基础', ['concept', 'syntax', 'example', 'parameter']],
  ['未知类型', ['concept', 'syntax', 'example', 'parameter']],
])('%s生成有序且可追溯的检索维度', (type, dimensions) => {
  const input = { name: '1.2.3 VARCHAR2 → 字符串/类型', type, target_db: 'PostgreSQL' };
  const before = structuredClone(input);
  const result = generateQueries(input);
  expect(result.dimensions).toEqual(dimensions);
  expect(result.queries).toHaveLength(dimensions.length);
  expect(result.queries.every(q => q.startsWith('VARCHAR2 字符串 类型 '))).toBe(true);
  expect(result.queries.map(q => result.dimensionMap[q])).toEqual(dimensions);
  if (dimensions.includes('compatibility')) expect(result.queries[dimensions.indexOf('compatibility')]).toContain('PostgreSQL');
  if (dimensions.includes('difference')) expect(result.queries[dimensions.indexOf('difference')]).toContain('与 PostgreSQL 差异');
  expect(input).toEqual(before);
});

test('默认类型、默认数据库和数量限制保持稳定', () => {
  expect(generateQueries({ name: '连接' }).dimensions).toEqual(['concept', 'syntax', 'example', 'parameter']);
  expect(generateQueries({ name: '连接', type: '架构对比' }).queries[1]).toContain('Oracle');
  expect(generateQueries({ name: '连接' }, { maxQueries: 1 }).dimensions).toEqual(['concept']);
  expect(generateQueries({ name: '连接' }, { maxQueries: 0 })).toEqual({ queries: [], dimensions: [], dimensionMap: {} });
});

test.each([
  [{}, ''],
  [{ name: '2.4 CHAR：`字符`/"类型" → 说明' }, 'CHAR 字符 类型 说明'],
  [{ name: '无章节编号' }, '无章节编号'],
])('核心术语归一化 %#', (point, expected) => expect(extractCoreTerm(point)).toBe(expected));

test('括号碎片修复、短查询补全和有效查询顺序保留', () => {
  const queries = ['完整查询语法定义及使用规则', '连接规则(未闭合内容', '残片)连接池参数配置说明', '正常(完整)语法定义说明', '参数'];
  const result = reviewQueries(queries, { name: '数据库连接池' });
  expect(result).toEqual({ queries: ['完整查询语法定义及使用规则', '数据库连接池 连接规则', '数据库连接池 连接池参数配置说明', '正常(完整)语法定义说明', '数据库连接池 参数'], dropped: [] });
  expect(queries[1]).toBe('连接规则(未闭合内容');
});

test('无核心术语的过短查询明确丢弃，空输入无虚构结果', () => {
  expect(reviewQueries(['', 'a', '参数', '有效查询词'], {})).toEqual({ queries: ['有效查询词'], dropped: [
    { query: '', reason: 'too_short' }, { query: 'a', reason: 'too_short' }, { query: '参数', reason: 'too_short' }
  ] });
  expect(reviewQueries([], {})).toEqual({ queries: [], dropped: [] });
});
