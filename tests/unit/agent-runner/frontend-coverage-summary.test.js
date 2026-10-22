const { summarize } = require('../../../tools/repository/collect-frontend-coverage.cjs');

const range = (startOffset, endOffset, count) => ({ startOffset, endOffset, count });
const script = functions => ({ url: 'http://localhost/knowledge-center/example.js', functions });

describe('V8 范围覆盖率汇总', () => {
  test.each([
    ['未执行分支', [[range(0, 100, 1), range(20, 40, 0)]], 100, 80],
    ['块内再次执行', [[range(0, 100, 1), range(20, 60, 0), range(30, 40, 2)]], 100, 70],
    ['嵌套函数', [[range(0, 100, 1)], [range(20, 40, 0)]], 100, 80],
    ['相同边界', [[range(0, 100, 1)], [range(0, 100, 0)]], 100, 0],
    ['相邻范围和间隙', [[range(0, 20, 1), range(20, 40, 0)], [range(60, 80, 1)]], 60, 40],
    ['空函数列表', [], 0, 0],
  ])('%s 使用最内层范围且不重复累计', (_label, functions, totalBytes, usedBytes) => {
    const result = summarize([script(functions.map(ranges => ({ ranges })))]);
    expect(result.totalBytes).toBe(totalBytes);
    expect(result.usedBytes).toBe(usedBytes);
    expect(result.rangeCoverage).toBe(totalBytes ? Number((usedBytes / totalBytes * 100).toFixed(2)) : 0);
  });

  test('空输入和无关脚本不影响统计', () => {
    const empty = summarize([]);
    expect(empty).toMatchObject({ sourceFiles: 0, totalBytes: 0, usedBytes: 0, rangeCoverage: 0, functionCoverage: 0 });
    expect(summarize([{ url: 'http://localhost/other.js', functions: [{ ranges: [range(0, 100, 1)] }] }])).toEqual(empty);
  });

  test('多个脚本实例分别计数，函数调用统计保持独立', () => {
    expect(summarize([
      script([{ ranges: [range(0, 100, 1), range(20, 40, 0)] }]),
      script([{ ranges: [range(0, 100, 0)] }]),
    ])).toMatchObject({ sourceFiles: 2, totalBytes: 200, usedBytes: 80, rangeCoverage: 40, functions: 2, executedFunctions: 1, functionCoverage: 50 });
  });
});
