const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { createTemplateStore } = require('../../../packages/agent-runner-core/lib/template-store');
const { createTemplateMappingService, evaluateRules } = require('../../../packages/agent-runner-core/lib/template-mapping-service');

function memory(initial) {
  let value = structuredClone(initial);
  return { read: () => structuredClone(value), transaction(fn) { const next = structuredClone(value); const result = fn(next); value = next; return structuredClone(result); } };
}
const catalog = documents => ({ outlineVersionId: 'outline-v1', documents: documents.map((name, index) => ({ id: `doc-${index}`, name, parentId: 'group' })), directory: { nodes: [{ id: 'group', title: 'SQL 参考手册', kind: 'chapter' }] } });
const actor = { user: { id: 'tester' } };
function fixture(analyzeAI = async () => ({ templateId: '', reason: '证据不足' })) {
  const templateStore = createTemplateStore({ store: memory({ schemaVersion: 1, templates: [], audits: [] }) });
  const sql = templateStore.create({ name: 'SQL 模板', type: 'SQL', description: '语法', content: '# SQL' }, actor);
  const perf = templateStore.create({ name: '性能模板', type: '性能', description: '调优', content: '# 性能' }, actor);
  const service = createTemplateMappingService({ store: memory({ version: 1, rules: [], batches: [], effective: {}, audits: [] }), templateStore, analyzeAI, config: { ai: { enabled: true, prompt: 'test', maxEvidenceChars: 100 } } });
  return { service, templateStore, sql, perf };
}

test('规则命中确定、同优先级冲突，规则版本按 CAS 保存', () => {
  const { service, sql, perf } = fixture();
  assert.deepEqual(evaluateRules([], { handbookId: 'HB', path: 'SQL', type: '', title: 'A' }).status, 'unmatched');
  const rules = [
    { id: 'sql', priority: 20, templateId: sql.id, when: { pathPrefix: 'SQL' } },
    { id: 'perf', priority: 10, templateId: perf.id, when: { titleContains: '性能' } },
  ];
  const saved = service.saveRules({ baseVersion: 1, rules }, 'tester');
  assert.equal(saved.version, 2);
  assert.equal(evaluateRules(rules, { handbookId: 'HB', path: 'SQL / 函数', type: '', title: '性能' }).templateId, sql.id);
  assert.throws(() => service.saveRules({ baseVersion: 1, rules }, 'tester'), { code: 'MAPPING_VERSION_CONFLICT' });
  rules[1].priority = 20;
  assert.equal(evaluateRules(rules, { handbookId: 'HB', path: 'SQL', type: '', title: '性能' }).status, 'conflict');
});

test('AI 只分析未命中和冲突，失败不改变有效映射；人工确认做版本校验', async () => {
  let called = 0;
  const { service, sql, perf, templateStore } = fixture(async ({ document }) => {
    called++;
    if (document.title === '失败') throw new Error('模型不可用');
    return { templateId: perf.id, reason: '标题包含性能', modelRunId: 'run-1' };
  });
  service.saveRules({ baseVersion: 1, rules: [{ id: 'sql', priority: 10, templateId: sql.id, when: { pathPrefix: 'SQL 参考手册' } }] }, 'tester');
  const first = service.start('HB', catalog(['规则命中', '性能说明', '失败']), 'tester');
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  const batch = service.batch(first.id);
  assert.equal(batch.status, 'completed');
  assert.equal(called, 0, '本目录全部命中规则，不应调用模型');
  const row = batch.documents[0];
  const mapped = service.decide({ batchId: first.id, documentId: row.documentId, templateId: sql.id, baseVersion: 0 }, 'tester', catalog(['规则命中']).documents, 'outline-v1');
  assert.equal(service.resolve('HB', row.documentId).templateId, sql.id);
  assert.equal(mapped.version, 1); assert.match(mapped.decisionId, /^[0-9a-f-]{36}$/);
  assert.throws(() => service.decide({ batchId: first.id, documentId: row.documentId, templateId: sql.id, baseVersion: 0 }, 'tester', catalog(['规则命中']).documents, 'outline-v1'), { code: 'MAPPING_VERSION_CONFLICT' });
  assert.throws(() => service.decide({ batchId: first.id, documentId: 'doc-1', templateId: perf.id, baseVersion: 0 }, 'tester', catalog(['规则命中', '性能说明']).documents, 'outline-v2'), { code: 'MAPPING_OUTLINE_CHANGED' });
  templateStore.disable(sql.id, actor, false);
  assert.throws(() => service.decide({ batchId: first.id, documentId: 'doc-1', templateId: sql.id, baseVersion: 0 }, 'tester', catalog(['性能说明']).documents, 'outline-v1'), { code: 'MAPPING_DOCUMENT_UNAVAILABLE' });
});

test('未命中调用 AI，模型失败不产生映射，取消后不能确认', async () => {
  let called = 0;
  const { service, sql, perf } = fixture(async ({ document, signal }) => {
    called++;
    if (document.title === '失败') throw Error('模型不可用');
    if (document.title === '等待') { await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); throw Error('已取消'); }
    return { templateId: perf.id, reason: '性能主题', modelRunId: 'run-2' };
  });
  const first = service.start('HB', { ...catalog(['性能说明', '失败']), directory: { nodes: [] } }, 'tester');
  for (let i=0;i<10 && service.batch(first.id).status !== 'completed';i++) await new Promise(resolve => setImmediate(resolve));
  const batch = service.batch(first.id);
  assert.equal(batch.status, 'completed'); assert.equal(called, 2);
  assert.equal(batch.documents[0].ai.templateId, perf.id);
  assert.equal(batch.documents[1].ai.templateId, '');
  assert.equal(service.resolve('HB', 'doc-1'), null);
  assert.throws(() => service.decide({ batchId: first.id, documentId: 'doc-1', templateId: sql.id }, 'tester', catalog(['性能说明', '失败']).documents, 'outline-v1'), { code: 'MAPPING_CHOICE_INVALID' });
  const second = service.start('HB', { ...catalog(['等待']), directory: { nodes: [] } }, 'tester');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(service.cancel(second.id).status, 'cancelled');
  assert.throws(() => service.decide({ batchId: second.id, documentId: 'doc-0', templateId: sql.id }, 'tester', catalog(['等待']).documents, 'outline-v1'), { code: 'MAPPING_ANALYSIS_RUNNING' });
});

test('停用模板后旧规则不再提出该模板，重新发布须先修复引用', () => {
  const { service, templateStore, sql } = fixture();
  const rules = [{ id: 'sql', priority: 10, templateId: sql.id, when: { pathPrefix: 'SQL 参考手册' } }];
  service.saveRules({ baseVersion: 1, rules }, 'tester');
  assert.equal(service.start('HB', catalog(['文档']), 'tester').status, 'completed');
  templateStore.disable(sql.id, actor, false);
  const batch = service.start('HB', catalog(['文档']), 'tester');
  assert.equal(service.batch(batch.id).documents[0].status, 'unmatched');
  assert.throws(() => service.previewRules({ baseVersion: 2, rules }, catalog(['文档']), 'HB'), { code: 'MAPPING_TEMPLATE_INACTIVE' });
  const repaired = service.previewRules({ baseVersion: 2, rules: [] }, catalog(['文档']), 'HB');
  assert.equal(repaired.changed, 0, '已停用模板不再算作当前有效规则');
});

test('发布预览摘要绑定当前文档集合，即使大纲版本标识未变化', () => {
  const { service, sql } = fixture();
  const rules = [{ id: 'sql', priority: 10, templateId: sql.id, when: { pathPrefix: 'SQL 参考手册' } }];
  const first = service.previewRules({ baseVersion: 1, rules }, catalog(['文档一']), 'HB');
  const changed = service.previewRules({ baseVersion: 1, rules }, catalog(['文档一', '文档二']), 'HB');
  assert.notEqual(first.candidateDigest, changed.candidateDigest);
});

test('全手册规则预览包含其他手册且摘要绑定其目录', () => {
  const { service, sql } = fixture();
  const rules = [{ id: 'global', priority: 10, templateId: sql.id, when: { titleContains: '文档' } }];
  const first = service.previewRules({ baseVersion: 1, rules }, [
    { handbookId: 'HB-A', catalog: catalog(['文档一']) },
    { handbookId: 'HB-B', catalog: catalog(['文档二']) },
  ], 'HB-A');
  assert.equal(first.total, 2);
  assert.deepEqual(first.changes.map(row => row.handbookId), ['HB-A', 'HB-B']);
  assert.deepEqual(first.handbookChanges.map(row => row.changed), [1, 1]);
  const changed = service.previewRules({ baseVersion: 1, rules }, [
    { handbookId: 'HB-A', catalog: catalog(['文档一']) },
    { handbookId: 'HB-B', catalog: catalog(['文档三']) },
  ], 'HB-A');
  assert.notEqual(first.candidateDigest, changed.candidateDigest);
});

test('500 篇目录、20 条规则的确定性分析满足本机性能预算', () => {
  const { service, sql, templateStore } = fixture();
  for (let i = 0; i < 48; i++) templateStore.create({ name: `备选模板${i}`, type: '测试', description: '性能样本', content: '# 样本' }, actor);
  const rules = Array.from({ length: 20 }, (_, index) => ({ id: `r${index}`, priority: 20-index, templateId: sql.id, when: { pathPrefix: index ? `其他${index}` : 'SQL 参考手册' } }));
  service.saveRules({ baseVersion: 1, rules }, 'tester');
  const data = catalog(Array.from({ length: 500 }, (_, index) => `文档${index}`));
  const measurements = [];
  for (let i = 0; i < 5; i++) { const start = performance.now(); const result = service.start('HB', data, 'tester'); measurements.push(performance.now() - start); assert.equal(result.status, 'completed'); }
  measurements.sort((a,b)=>a-b);
  assert.ok(measurements[4] < 2000, `规则分析最慢 ${measurements[4].toFixed(1)}ms`);
  const batch = service.start('HB', data, 'tester');
  for (const document of service.batch(batch.id).documents) service.decide({ batchId: batch.id, documentId: document.documentId, templateId: sql.id, baseVersion: 0 }, 'tester', data.documents, data.outlineVersionId);
  const listTimes = [];
  for (let i = 0; i < 20; i++) {
    const start = performance.now(); const page = service.list('HB', '', (i % 5) * 100, 100);
    listTimes.push(performance.now() - start); assert.equal(page.total, 500); assert.equal(page.items.length, 100);
  }
  listTimes.sort((a,b)=>a-b);
  const p95 = listTimes[Math.ceil(listTimes.length * .95) - 1];
  assert.ok(p95 < 500, `映射列表 P95 ${p95.toFixed(1)}ms`);
  console.log(`性能样本：规则最慢 ${measurements[4].toFixed(1)}ms；映射列表 P95 ${p95.toFixed(1)}ms`);
});
