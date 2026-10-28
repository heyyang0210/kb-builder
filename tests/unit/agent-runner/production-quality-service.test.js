const { FileAggregateStore } = require('../../../packages/agent-runner-core/lib/aggregate-store');
const { createProductionQualityService } = require('../../../packages/agent-runner-core/lib/production-quality-service');
const fs = require('fs'); const os = require('os'); const path = require('path');

const editor = { user: { id: 'author' }, allowedActions: ['knowledge:read', 'knowledge:write'] };
const ctx = { handbookId: 'HB', documentId: 'D', outlineVersionId: 'V', branch: 'main' };
const doc = '# 用例\n```sql\nselect 1 from dual;\n```\n```sql\nselect 2 from dual;\n```';

test('文档预期结果按类型和值比对，重复 SQL 保留独立位置，非法声明不执行', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-expected-'));
  try {
    const store = new FileAggregateStore(path.join(root, 'state.json'), { qualityReports: {} });
    const execute = jest.fn(async () => ({ columns: ['C1'], rows: [{ C1: 1, C2: null }], truncated: false }));
    const service = createProductionQualityService({ store, yashanDB: { execute } });
    const sql = '```sql\nSELECT 1 AS C1 FROM DUAL;\n```\n';
    const expected = value => '```json quality-expected\n' + JSON.stringify(value) + '\n```\n';
    const markdown = sql + expected({ rows: [{ C2: null, C1: 1 }] }) + sql + expected({ rows: [{ C1: '1', C2: null }] }) + sql + expected({ invalid: 1 });
    const report = await service.run({ ...ctx, markdown }, editor);
    expect(report.coverage).toEqual({ total: 3, executed: 2, passed: 1, failed: 1, notExecuted: 1 });
    expect(report.cases.map(row => row.comparison)).toEqual(['matched', 'mismatched', 'not_provided']);
    expect(report.cases[1].error).toBe('QUALITY_EXPECTATION_MISMATCH');
    expect(report.cases[2].error).toBe('QUALITY_EXPECTATION_INVALID');
    expect(new Set(report.cases.map(row => row.caseId)).size).toBe(3);
    for (const row of report.cases) expect(markdown.slice(row.expectationLocation.start, row.expectationLocation.end)).toMatch(/^```json quality-expected/);
    expect(execute).toHaveBeenCalledTimes(2);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('截断结果不得通过；数据库不可用、超时和只读范围拒绝均记未执行', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-preconditions-'));
  try {
    const store = new FileAggregateStore(path.join(root, 'state.json'), { qualityReports: {} });
    for (const code of ['STORAGE_UNAVAILABLE', 'STORAGE_TIMEOUT', 'QUALITY_SQL_READ_ONLY', 'QUALITY_DATABASE_NOT_CONFIGURED']) {
      const service = createProductionQualityService({ store, yashanDB: { execute: async () => { throw Object.assign(new Error('unavailable'), { code }); } } });
      const report = await service.run({ ...ctx, markdown: doc }, editor);
      expect(report.coverage).toEqual({ total: 2, executed: 0, passed: 0, failed: 0, notExecuted: 2 });
      expect(report.gate).toBe('not_passed');
    }
    const service = createProductionQualityService({ store, yashanDB: { execute: async () => ({ rows: [], truncated: true }) } });
    const report = await service.run({ ...ctx, markdown: doc }, editor);
    expect(report.coverage.failed).toBe(2);
    expect(report.cases[0].error).toBe('QUALITY_RESULT_TRUNCATED');
    expect(report.limitations.join()).toMatch(/未声明预期/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('报告不能跨修订或跨分支绑定，即使正文相同；拒绝后关联保持不变', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-binding-'));
  try {
    const store = new FileAggregateStore(path.join(root, 'state.json'), { drafts: { current: { revisions: [
      { revisionId: 'r1', markdown: doc }, { revisionId: 'r2', markdown: doc },
    ] } }, qualityReports: {} });
    const service = createProductionQualityService({ store, contextKey: () => 'current' });
    const report = await service.run({ ...ctx, markdown: doc, revisionId: 'r1' }, editor);
    const input = { ...ctx, revisionId: 'r1', reportId: report.reportId };
    service.linkToRevision(input, editor);
    const before = store.read();
    expect(() => service.linkToRevision({ ...input, revisionId: 'r2' }, editor)).toThrow(/上下文不一致/);
    expect(() => service.linkToRevision({ ...input, branch: 'other' }, editor)).toThrow(/上下文不一致/);
    expect(store.read()).toEqual(before);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('独立质量 Agent 协同提取、执行、比对和报告 Skill，区分通过失败未执行', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-'));
  const store = new FileAggregateStore(path.join(root, 'state.json'), { drafts: {}, qualityReports: {} });
  const service = createProductionQualityService({ store, yashanDB: { version: 'YashanDB-test', environment: 'isolated', execute: async sql => sql.includes('select 1') ? { value: 1 } : (() => { throw Object.assign(new Error('failure'), { code: 'SQL_FAILED' }); })() } });
  const report = await service.run({ ...ctx, markdown: doc }, editor);
  expect(report.skills).toHaveLength(4); expect(report.coverage).toMatchObject({ total: 2, executed: 2, passed: 1, failed: 1, notExecuted: 0 });
  expect(report.skillInvocations.map(item => item.skillId)).toEqual(['extract-document-cases', 'execute-yashandb-cases', 'compare-case-results', 'render-test-report']);
  expect(report.skillInvocations.every(item => item.status === 'succeeded' && item.contentDigest)).toBe(true);
  expect(report.skillInvocations.every(item => /^[a-f0-9]{64}$/.test(item.implementationDigest))).toBe(true);
  expect(report.gate).toBe('not_passed'); expect(report.cases.map(item => item.status)).toEqual(['passed', 'failed']);
  expect(service.get({ ...ctx, reportId: report.reportId }, editor).document.contentDigest).toBe(report.document.contentDigest);
  fs.rmSync(root, { recursive: true, force: true });
});

test('Skill 中途异常保留失败轨迹并停止后续阶段，不能伪造完成', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-stage-failure-'));
  try {
    const store = new FileAggregateStore(path.join(root, 'state.json'), { qualityReports: {} });
    const compare = jest.fn(); const render = jest.fn();
    let clock = 0;
    const service = createProductionQualityService({ store, now: () => clock++, yashanDB: { execute: jest.fn() }, skillHandlers: {
      'execute-yashandb-cases': async () => { throw Object.assign(new Error('private diagnostic'), { code: 'TEST_STAGE_FAILED' }); },
      'compare-case-results': compare, 'render-test-report': render,
    } });
    const report = await service.run({ ...ctx, markdown: doc }, editor);
    expect(report.status).toBe('failed'); expect(report.gate).toBe('not_passed');
    expect(report.skillInvocations.map(item => item.status)).toEqual(['succeeded', 'failed']);
    expect(report.skillInvocations[1].startedAt < report.skillInvocations[1].finishedAt).toBe(true);
    expect(report.skillInvocations[1].output).toBeNull();
    expect(report.error).toEqual({ code: 'TEST_STAGE_FAILED', skillId: 'execute-yashandb-cases' });
    expect(compare).not.toHaveBeenCalled(); expect(render).not.toHaveBeenCalled();
    expect(service.get({ ...ctx, reportId: report.reportId }, editor)).toEqual(report);
    expect(JSON.stringify(report)).not.toContain('private diagnostic');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('质量 Skill 未登记或版本不一致时拒绝创建伪造报告', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-skill-config-'));
  try {
    const store = new FileAggregateStore(path.join(root, 'state.json'), { qualityReports: {} });
    const service = createProductionQualityService({ store, skills: [{ skillId: 'unknown', version: '1.0.0' }] });
    await expect(service.run({ ...ctx, markdown: doc }, editor)).rejects.toMatchObject({ code: 'QUALITY_SKILL_CONFIG_INVALID' });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('没有测试库时全部如实标记未执行，不能记为通过', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-'));
  const store = new FileAggregateStore(path.join(root, 'state.json'), { drafts: {}, qualityReports: {} });
  const service = createProductionQualityService({ store });
  const report = await service.run({ ...ctx, markdown: doc }, editor);
  expect(report.coverage.notExecuted).toBe(2); expect(report.gate).toBe('not_passed'); expect(report.limitations[0]).toMatch(/YashanDB/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('用例只关联匹配修订中的可信来源，引用精确定位、归纳待核验，人工及失效声明不继承来源', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-case-source-'));
  try {
    const hash = text => require('crypto').createHash('sha256').update(text).digest('hex');
    const block = '```sql\nselect 1 from dual;\n```';
    const markdown = '# 用例😀\n' + Array(5).fill(block).join('\n');
    const start = markdown.indexOf(block);
    const source = { sourceId: 'library-1', sourceType: 'test-case-library', locator: 'smoke.sql', title: '冒烟用例',
      content: '资料\n' + block, contentDigest: hash('资料\n' + block), sourceVersion: 'v1', fetchedAt: '2026-10-22T00:00:00Z' };
    const bad = { ...source, sourceId: 'bad', contentDigest: 'invalid' };
    const provenance = Array.from({ length: 5 }, (_, index) => ({ start: start + index * (block.length + 1),
      end: start + index * (block.length + 1) + block.length,
      kind: ['direct_quote', 'source_summary', 'human_edit', 'direct_quote', 'model_inference'][index],
      evidence: [{ sourceId: index === 3 ? 'bad' : 'library-1', start: 3, end: source.content.length }] }));
    const store = new FileAggregateStore(path.join(root, 'state.json'), { drafts: { current: { revisions: [{ revisionId: 'r1', markdown,
      generationMetadata: { provenance, sourceSnapshots: [source, bad] } }] } }, qualityReports: {} });
    const execute = jest.fn(async () => ({ rows: [] }));
    const service = createProductionQualityService({ store, contextKey: () => 'current', yashanDB: { execute } });
    const report = await service.run({ ...ctx, markdown, revisionId: 'r1', generationMetadata: { sourceSnapshots: [{ sourceId: 'forged' }] } }, editor);
    expect(report.cases.map(item => item.sourceTrace)).toEqual(['linked', 'linked', 'no_verified_reference', 'no_verified_reference', 'no_verified_reference']);
    expect(report.cases[0].references[0]).toMatchObject({ sourceType: 'test-case-library', locator: 'smoke.sql',
      verification: 'text_matched', sourceRange: { start: 3, end: source.content.length }, documentRange: { start, end: start + block.length } });
    expect(report.cases[1].references[0].verification).toBe('unverified');
    expect(report.cases[1].references[0].documentRange.start).toBe(start + block.length + 1);
    expect(JSON.stringify(report)).not.toContain('forged');
    expect(service.get({ ...ctx, reportId: report.reportId }, editor).cases).toEqual(report.cases);
    await expect(service.run({ ...ctx, markdown: markdown + '\n改动', revisionId: 'r1' }, editor)).rejects.toMatchObject({ code: 'QUALITY_CONTENT_MISMATCH' });
    expect(execute).toHaveBeenCalledTimes(5);
    const candidate = await service.run({ ...ctx, markdown }, editor);
    expect(candidate.cases.every(item => item.sourceTrace === 'unavailable_revision' && item.references.length === 0)).toBe(true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('复测创建新报告并保留上一份报告关联', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-rerun-'));
  const store = new FileAggregateStore(path.join(root, 'state.json'), { drafts: {}, qualityReports: {} });
  const service = createProductionQualityService({ store, yashanDB: { version: 'YashanDB-test', environment: 'isolated', execute: async () => ({ value: 1 }) } });
  const first = await service.run({ ...ctx, markdown: '```sql\nselect 1 from dual;\n```' }, editor);
  const second = await service.run({ ...ctx, markdown: '```sql\nselect 1 from dual;\n```', rerunOfReportId: first.reportId }, editor);
  expect(second.reportId).not.toBe(first.reportId);
  expect(second.rerunOf).toEqual({ reportId: first.reportId, contentDigest: first.document.contentDigest, gate: first.gate });
  expect(service.get({ ...ctx, reportId: first.reportId }, editor).reportId).toBe(first.reportId);
  fs.rmSync(root, { recursive: true, force: true });
});
