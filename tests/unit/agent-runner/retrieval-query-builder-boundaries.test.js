const fs = require('fs');
const path = require('path');
jest.mock('../../../packages/agent-runner-core/lib/config-registry', () => ({
  CONFIG_PATHS: { contentRules: require('path').resolve(__dirname, '../../../runtime/test-results/query-builder-fixtures/content-rules.json') },
}));
jest.mock('../../../packages/agent-runner-core/lib/synonym-expander', () => jest.fn());
const builder = require('../../../packages/agent-runner-core/lib/retrieval-query-builder');
const Expander = require('../../../packages/agent-runner-core/lib/synonym-expander');
const root = path.resolve(__dirname, '../../../runtime/test-results/query-builder-fixtures');
const file = path.join(root, 'content-rules.json');
beforeEach(() => { fs.mkdirSync(root, { recursive: true }); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); Expander.mockReset(); });

describe('查询构建公开配置与解析边界', () => {
  test.each([null, '{', '{}', '{"synonyms":{}}', '{"synonyms":{"categories":{}}}'])('配置缺失或损坏使用默认组 %#', text => {
    if (text !== null) fs.writeFileSync(file, text);
    expect(builder.loadSynonymGroups()).toEqual(builder.DEFAULT_SYNONYM_GROUPS);
    expect(builder.reloadSynonymGroups()).toEqual(builder.DEFAULT_SYNONYM_GROUPS);
    expect(builder.getSynonymGroups()).toEqual(builder.DEFAULT_SYNONYM_GROUPS);
  });
  test('只采纳至少两个同义词的数组并允许配置显式清空', () => {
    fs.writeFileSync(file, JSON.stringify({ synonyms: { categories: [{}, { synonyms: 'x' }, { synonyms: [] }, { synonyms: ['单项'] }, { synonyms: ['备份', '还原'] }] } }));
    expect(builder.reloadSynonymGroups()).toEqual([['备份', '还原']]);
    expect(builder.getSynonymGroups()).toEqual([['备份', '还原']]);
    fs.writeFileSync(file, JSON.stringify({ synonyms: { categories: [] } }));
    expect(builder.reloadSynonymGroups()).toEqual([]);
  });
  test('去重、产品名称与空参数规范化', () => {
    expect(builder.unique()).toEqual([]);
    expect(builder.unique([' x ', 'x', '', ' ', 1])).toEqual(['x', '1']);
    expect(builder.stripProductTerms()).toBe('');
    expect(builder.normalizeQuery(null)).toBe('');
    expect(builder.normalizeQuery('Yashan 数据库 崖山 DB 崖山数据库 YashanDB `事务`，')).toBe('事务');
    expect(builder.extractPromptQueries()).toEqual([]);
    expect(builder.extractPromptQueries(null)).toEqual([]);
    expect(builder.extractKnowledgePointQueries()).toEqual([]);
    expect(builder.extractKnowledgePointQueries({ name: 'YashanDB 事务', type: '事务', description: '', chapter: '锁' })).toEqual(['事务', '锁']);
  });
  test.each([
    [null, []], ['', []], ['、，;\n', []],
    ['"Alpha,Beta"、Gamma', ['Alpha,Beta', 'Gamma']],
    ["'Alpha,Beta'、Gamma", ['Alpha,Beta', 'Gamma']],
    ['`Alpha,Beta`、Gamma', ['Alpha,Beta', 'Gamma']],
    ['"Alpha\'Beta"、Gamma', ['AlphaBeta', 'Gamma']],
    ['Alpha\\"Beta、Gamma', ['Alpha\\Beta', 'Gamma']],
    ['Func([a,b],{x,y})、尾部）', ['Func([a,b],{x,y})', '尾部）']],
    ['A，B;C；D\nE', ['A', 'B', 'C', 'D', 'E']],
    ['"Alpha,Beta', ['Alpha,Beta']],
  ])('拆分保留引号和括号内分隔符 %#', (input, expected) => {
    expect(builder.splitQueryList(input)).toEqual(expected);
  });
  test('提示词去重并在控制词前停止关键词提取', () => {
    expect(builder.extractPromptQueries('关键词：事务、锁必须输出正文\nmcp 查询:备份、事务\n{"mcp_query":"锁、恢复"}')).toEqual(['事务', '锁', '备份', '恢复']);
  });
  test('空查询不调用LLM，扩展失败回退到规范化唯一词', async () => {
    expect(await builder.expandSynonyms()).toEqual([]);
    expect(await builder.expandSynonyms([])).toEqual([]);
    expect(Expander).not.toHaveBeenCalled();
    Expander.mockImplementation(() => ({ expand: async () => { throw new Error('fixture unavailable'); } }));
    expect(await builder.expandSynonyms([' 事务 ', '事务', '锁'])).toEqual(['事务', '锁']);
    expect(await builder.buildMcpQueries()).toEqual([]);
  });
  test('扩展成功按上限截断且提示词优先于知识点', async () => {
    const expand = jest.fn(async input => [...input, '额外词']);
    Expander.mockImplementation(() => ({ expand }));
    expect(await builder.buildMcpQueries({ prompt: '关键词：事务、锁', knowledgePoint: { name: '忽略' }, maxQueries: 1 })).toEqual(['事务']);
    expect(expand).toHaveBeenLastCalledWith(['事务', '锁']);
    expect(await builder.buildMcpQueries({ knowledgePoint: { chapter: '备份' } })).toEqual(['备份', '额外词']);
  });
});
