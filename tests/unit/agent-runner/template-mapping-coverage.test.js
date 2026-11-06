const { createTemplateStore } = require('../../../packages/agent-runner-core/lib/template-store');
const { createTemplateMappingService, evaluateRules } = require('../../../packages/agent-runner-core/lib/template-mapping-service');

function memory(initial) {
  let state = structuredClone(initial);
  return {
    read: () => structuredClone(state),
    transaction(callback) {
      const next = structuredClone(state);
      const result = callback(next);
      state = next;
      return structuredClone(result);
    },
  };
}

const actor = { user: { id: 'mapping-coverage' } };
const catalog = (names, version = 'outline-v1') => ({
  outlineVersionId: version,
  documents: names.map((name, index) => ({ id: `doc-${index}`, name, parentId: 'group' })),
  directory: { nodes: [{ id: 'group', title: 'SQL 参考手册', kind: 'chapter' }] },
});
const rule = (id, templateId, priority, when) => ({ id, templateId, priority, when });

function fixture(analyzeAI = async () => ({ templateId: '', reason: '未匹配' })) {
  const templateStore = createTemplateStore({ store: memory({ schemaVersion: 1, templates: [], audits: [] }) });
  const sql = templateStore.create({ name: 'SQL 模板', type: 'SQL', description: '语法', content: '# SQL' }, actor);
  const perf = templateStore.create({ name: '性能模板', type: '性能', description: '调优', content: '# 性能' }, actor);
  const service = createTemplateMappingService({
    store: memory({ version: 1, rules: [], batches: [], effective: {}, audits: [] }), templateStore, analyzeAI,
    config: { ai: { enabled: true, prompt: '按目录和标题分析模板', maxEvidenceChars: 80, maxConcurrency: 2 } },
  });
  return { service, templateStore, sql, perf };
}

async function completed(service, id) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const item = service.batch(id);
    if (item.status !== 'running') return item;
    await new Promise(resolve => setImmediate(resolve));
  }
  throw new Error('模板分析未结束');
}

test('规则校验、冲突预览和版本摘要绑定目录内容', () => {
  const { service, templateStore, sql, perf } = fixture();
  const sqlRule = rule('sql', sql.id, 20, { pathPrefix: 'SQL 参考手册' });
  const perfRule = rule('perf', perf.id, 20, { titleContains: '性能' });
  expect(evaluateRules([sqlRule, perfRule], { handbookId: 'HB', path: 'SQL 参考手册', title: '性能说明', type: '' }).status).toBe('conflict');
  const preview = service.previewRules({ baseVersion: 1, rules: [sqlRule, perfRule] }, catalog(['性能说明']), 'HB');
  expect(preview).toMatchObject({ changed: 1, conflicts: 1, total: 1 });
  expect(preview.changes[0].after.candidates).toEqual([perf.id, sql.id]);
  expect(service.previewRules({ baseVersion: 1, rules: [sqlRule, perfRule] }, catalog(['性能说明', '新增文档']), 'HB').candidateDigest).not.toBe(preview.candidateDigest);
  expect(service.saveRules({ baseVersion: 1, rules: [sqlRule] }, 'tester').version).toBe(2);
  expect(() => service.saveRules({ baseVersion: 1, rules: [sqlRule] }, 'tester')).toThrow(expect.objectContaining({ code: 'MAPPING_VERSION_CONFLICT' }));
  expect(() => service.previewRules({ baseVersion: 1, rules: [] }, catalog(['文档']), 'HB')).toThrow(expect.objectContaining({ code: 'MAPPING_VERSION_CONFLICT' }));
  for (const invalid of [null, [{}], [sqlRule, sqlRule], [rule('bad', sql.id, -1, { titleContains: '文档' })], [rule('bad', sql.id, 1, { unsupported: 'x' })]]) {
    expect(() => service.saveRules({ baseVersion: 2, rules: invalid }, 'tester')).toThrow(expect.objectContaining({ code: 'MAPPING_RULES_INVALID' }));
  }
  templateStore.disable(sql.id, actor, false);
  expect(() => service.saveRules({ baseVersion: 2, rules: [sqlRule] }, 'tester')).toThrow(expect.objectContaining({ code: 'MAPPING_TEMPLATE_INACTIVE' }));
  expect(service.previewRules({ baseVersion: 2, rules: [] }, catalog(['文档']), 'HB').changed).toBe(0);
});

test('规则确认写入有效映射并拒绝过期、越权和无理由改选', () => {
  const { service, sql, perf } = fixture();
  service.saveRules({ baseVersion: 1, rules: [rule('sql', sql.id, 10, { pathPrefix: 'SQL 参考手册' })] }, 'tester');
  const input = catalog(['文档一', '文档二']);
  const started = service.start('HB', input, 'tester');
  expect(started).toMatchObject({ status: 'completed', documentCount: 2, ruleVersion: 2 });
  expect(service.batch(started.id).documents[0].status).toBe('rule');
  expect(() => service.decide({ batchId: 'missing', documentId: 'doc-0', templateId: sql.id }, 'tester', input.documents, 'outline-v1')).toThrow(expect.objectContaining({ code: 'MAPPING_BATCH_NOT_FOUND' }));
  expect(() => service.decide({ batchId: started.id, documentId: 'doc-0', templateId: sql.id }, 'tester', input.documents, 'outline-v2')).toThrow(expect.objectContaining({ code: 'MAPPING_OUTLINE_CHANGED' }));
  expect(() => service.decide({ batchId: started.id, documentId: 'doc-0', templateId: sql.id }, 'tester', [], 'outline-v1')).toThrow(expect.objectContaining({ code: 'MAPPING_DOCUMENT_UNAVAILABLE' }));
  expect(() => service.decide({ batchId: started.id, documentId: 'doc-0', templateId: perf.id }, 'tester', input.documents, 'outline-v1')).toThrow(expect.objectContaining({ code: 'MAPPING_CHOICE_INVALID' }));
  const mapped = service.decide({ batchId: started.id, documentId: 'doc-0', templateId: sql.id, baseVersion: 0 }, 'tester', input.documents, 'outline-v1');
  expect(mapped).toMatchObject({ source: 'rule', version: 1, status: 'active' });
  expect(service.resolve('HB', 'doc-0').decisionId).toBe(mapped.decisionId);
  expect(service.list('HB', 'active', 0, 1)).toMatchObject({ total: 1, nextCursor: null, items: [{ documentId: 'doc-0' }] });
  expect(() => service.decide({ batchId: started.id, documentId: 'doc-0', templateId: sql.id, baseVersion: 0 }, 'tester', input.documents, 'outline-v1')).toThrow(expect.objectContaining({ code: 'MAPPING_VERSION_CONFLICT' }));
  const manual = service.decide({ batchId: started.id, documentId: 'doc-1', templateId: perf.id, baseVersion: 0, reason: '性能专用章节' }, 'tester', input.documents, 'outline-v1');
  expect(manual).toMatchObject({ source: 'manual', reason: '性能专用章节' });
  expect(service.list('HB', 'active', 0, 1)).toMatchObject({ total: 2, nextCursor: 1 });
  service.saveRules({ baseVersion: 2, rules: [] }, 'tester');
  expect(() => service.decide({ batchId: started.id, documentId: 'doc-1', templateId: perf.id, baseVersion: 1 }, 'tester', input.documents, 'outline-v1')).toThrow(expect.objectContaining({ code: 'MAPPING_VERSION_CONFLICT' }));
});

test('未匹配文档并发分析记录建议与失败，取消阻止确认', async () => {
  let calls = 0;
  const { service, sql, perf } = fixture(async ({ document, signal }) => {
    calls += 1;
    if (document.title === '失败') throw new Error('模型不可用');
    if (document.title === '等待') {
      await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
      throw new Error('已取消');
    }
    return { templateId: perf.id, reason: '性能目录匹配', modelRunId: 'analysis-run' };
  });
  const input = catalog(['性能说明', '失败']);
  const started = service.start('HB', input, 'tester');
  expect(started.status).toBe('running');
  const batch = await completed(service, started.id);
  expect(calls).toBe(2);
  expect(batch.documents).toEqual([
    expect.objectContaining({ ai: expect.objectContaining({ templateId: perf.id, modelRunId: 'analysis-run' }) }),
    expect.objectContaining({ ai: expect.objectContaining({ templateId: '', reason: expect.stringContaining('模型不可用') }) }),
  ]);
  const aiChoice = service.decide({ batchId: started.id, documentId: 'doc-0', templateId: perf.id, baseVersion: 0 }, 'tester', input.documents, input.outlineVersionId);
  expect(aiChoice).toMatchObject({ source: 'ai', modelRunId: 'analysis-run' });
  expect(() => service.decide({ batchId: started.id, documentId: 'doc-1', templateId: sql.id, baseVersion: 0 }, 'tester', input.documents, input.outlineVersionId)).toThrow(expect.objectContaining({ code: 'MAPPING_CHOICE_INVALID' }));
  const waiting = service.start('HB', catalog(['等待']), 'tester');
  await new Promise(resolve => setImmediate(resolve));
  expect(service.cancel(waiting.id).status).toBe('cancelled');
  expect(() => service.decide({ batchId: waiting.id, documentId: 'doc-0', templateId: sql.id }, 'tester', catalog(['等待']).documents, 'outline-v1')).toThrow(expect.objectContaining({ code: 'MAPPING_ANALYSIS_RUNNING' }));
  expect(() => service.cancel('missing')).toThrow(expect.objectContaining({ code: 'MAPPING_BATCH_NOT_FOUND' }));
});
