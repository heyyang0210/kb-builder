const { parseGenerated, humanChanges, outsideRange } = require('../../../packages/agent-runner-core/lib/production-ai-provenance');

const sources = [{ sourceId: 'confirmed', content: '原句。参数为42。' }];
const encode = (markdown, provenance) => JSON.stringify({ markdown, provenance });
const quote = { start: 0, end: 3, kind: 'direct_quote', evidence: [{ sourceId: 'confirmed', start: 0, end: 3 }] };

test('混合内容保留逐字证据、归纳依据及未覆盖推理，匹配不等于事实验证', () => {
  const result = parseGenerated(encode('原句。归纳。推理。', [quote,
    { start: 3, end: 6, kind: 'source_summary', evidence: [{ sourceId: 'confirmed', start: 3, end: 9 }] },
  ]), sources);
  expect(result.provenance.map(item => item.kind)).toEqual(['direct_quote', 'source_summary', 'model_inference']);
  expect(result.provenance.map(item => item.verification)).toEqual(['text_matched', 'unverified', 'unverified']);
});

test.each([
  { ...quote, evidence: [{ sourceId: 'invented', start: 0, end: 3 }] },
  { ...quote, evidence: [{ sourceId: 'confirmed', start: 3, end: 6 }] },
  { ...quote, kind: 'human_edit' },
  { ...quote, kind: 'source_summary', evidence: [{ sourceId: 'confirmed', start: -1, end: 2 }] },
])('伪造来源、错误引用、越界及模型自称人工确认均降为推理：%j', claim => {
  const result = parseGenerated(encode('原句。', [claim]), sources);
  expect(result.provenance[0]).toMatchObject({ kind: 'model_inference', sourceIds: [], issue: 'SOURCE_CLAIM_UNVERIFIED' });
});

test('拒绝重叠、Unicode截断、损坏协议及过量区间；普通正文保守兼容', () => {
  for (const content of [encode('原句。', [quote, quote]),
    encode('😀原句。', [{ ...quote, start: 1 }]), '{"markdown":',
    encode('原句。', [quote, quote, quote])]) {
    expect(() => parseGenerated(content, sources, 2)).toThrow('INVALID_GENERATION_ENVELOPE');
  }
  expect(parseGenerated('普通正文', sources).provenance[0]).toMatchObject({ kind: 'model_inference', evidence: [] });
});

test('人工编辑保留未变引用，平移后文并调整逐字证据位置', () => {
  const provenance = parseGenerated(encode('原句。', [quote]), sources).provenance;
  const result = humanChanges('原句。', '原新句。', provenance);
  expect(result.map(item => item.kind)).toEqual(['direct_quote', 'human_edit', 'direct_quote']);
  expect(result[2]).toMatchObject({ start: 2, end: 4, evidence: [{ sourceId: 'confirmed', start: 1, end: 3 }] });
  const removed = humanChanges('原句。', '原。', provenance);
  expect(removed[1]).toMatchObject({ start: 1, end: 2, evidence: [{ sourceId: 'confirmed', start: 2, end: 3 }] });
  expect(outsideRange(provenance, 1, 2, 3)[1]).toMatchObject({ start: 4, end: 5 });
});

test('协议围栏被解析而非保存为正文；残缺协议与过量证据拒绝', () => {
  const content = encode('原句。', [quote]);
  expect(parseGenerated('```json\n' + content + '\n```', sources).markdown).toBe('原句。');
  for (const invalid of [JSON.stringify({ provenance: [] }), '```json\n{"markdown":\n```',
    encode('原句。', [{ ...quote, evidence: [quote.evidence[0], quote.evidence[0], quote.evidence[0]] }])]) {
    expect(() => parseGenerated(invalid, sources, 2)).toThrow('INVALID_GENERATION_ENVELOPE');
  }
});

test('Unicode编辑边界不拆分代理对，多个改动保守合并而不错误认证中间内容', () => {
  const result = humanChanges('😀abc😀', '😁axc😀', [{ start: 0, end: 7, kind: 'model_inference' }]);
  expect(result[0]).toMatchObject({ start: 0, end: 4, kind: 'human_edit' });
  expect(result[1]).toMatchObject({ start: 4, end: 7, kind: 'model_inference' });
});
