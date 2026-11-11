const { artifactRecord, CONTRACT_VERSION, envelope, verifyArtifactRecord, validateArtifact } = require('../../../packages/agent-runner-core/lib/production-ai-contracts');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FileAggregateStore } = require('../../../packages/agent-runner-core/lib/aggregate-store');
const { createProductionAIArtifactStore } = require('../../../packages/agent-runner-core/lib/production-ai-artifact-store');

describe('文档生产阶段契约', () => {
  const job = {
    jobId: 'job-1', operation: 'polish', range: { start: 1, end: 3 },
    requirements: '要求', outline: '大纲', sourceSnapshots: [{ sourceId: 's1', contentDigest: 'a'.repeat(64) }],
    candidateDigest: 'c'.repeat(64),
  };

  test('拒绝 Planner 修改范围和 Evidence 增加未确认来源', () => {
    expect(() => validateArtifact('planner', { operation: 'rewrite', range: job.range, requirements: '要求', outline: '大纲' }, job)).toThrow(/范围/);
    expect(() => validateArtifact('evidence', { sources: [{ sourceId: 's2', contentDigest: 'b'.repeat(64) }] }, job)).toThrow(/来源/);
  });

  test('产物摘要可重算，契约版本或内容变化即不可恢复', () => {
    const value = { operation: 'polish', range: job.range, requirements: job.requirements, outline: job.outline };
    const record = artifactRecord('planner', value);
    expect(record.contractVersion).toBe(CONTRACT_VERSION);
    expect(verifyArtifactRecord(record, 'planner', record.digest, job)).toBe(true);
    expect(verifyArtifactRecord({ ...record, contractVersion: '0.9' }, 'planner', record.digest, job)).toBe(false);
    expect(verifyArtifactRecord({ ...record, value: { ...value, range: { start: 0, end: 0 } } }, 'planner', record.digest, job)).toBe(false);
  });

  test('阶段产物先通过配置 Schema，再执行业务语义校验', () => {
    expect(() => validateArtifact('planner', { operation: 'polish', range: job.range, requirements: 42, outline: '' }, job))
      .toThrow(expect.objectContaining({ code: 'AI_STAGE_CONTRACT_INVALID' }));
    expect(() => validateArtifact('reviewer', { status: 'contract_valid', candidateDigest: 'bad', provenanceSegments: 0 }, job))
      .toThrow(expect.objectContaining({ code: 'AI_STAGE_CONTRACT_INVALID' }));
  });

  test('空白候选片段不能写入或恢复', () => {
    const invalid = { fragment: ' \n\t ', provenance: [] };
    expect(() => validateArtifact('writer', invalid, job)).toThrow(/候选片段或来源标注无效/);
    const record = artifactRecord('writer', invalid);
    expect(verifyArtifactRecord(record, 'writer', record.digest, job)).toBe(false);

    const valid = artifactRecord('writer', { fragment: '正文', provenance: [] });
    expect(verifyArtifactRecord(valid, 'writer', valid.digest, job)).toBe(true);
  });

  test('格式正确但不属于当前候选的审阅摘要不能恢复', () => {
    const invalid = { status: 'contract_valid', candidateDigest: 'd'.repeat(64), provenanceSegments: 0 };
    expect(() => validateArtifact('reviewer', invalid, job)).toThrow(/审阅产物与候选不匹配/);
    const record = artifactRecord('reviewer', invalid);
    expect(verifyArtifactRecord(record, 'reviewer', record.digest, job)).toBe(false);

    const valid = artifactRecord('reviewer', { ...invalid, candidateDigest: job.candidateDigest });
    expect(verifyArtifactRecord(valid, 'reviewer', valid.digest, job)).toBe(true);
  });

  test('阶段信封冻结任务、来源和技能快照，并保留缺省值', () => {
    const source = { sourceId: 's1', locator: 'doc/1', contentDigest: 'a'.repeat(64), fetchedAt: '2026-01-01T00:00:00.000Z', ignored: 'private' };
    const skill = { skillId: 'rewrite', version: '1', contentDigest: 'b'.repeat(64), ignored: 'private' };
    const full = envelope({
      ...job, contextKey: 'ctx-1', document: { documentId: 'doc-1' }, originalDigest: 'o'.repeat(64),
      ruleVersion: 'rules-1', templateSnapshot: { templateId: 't1' }, modelSelection: { modelId: 'm1' },
      sourceSnapshots: [source], skillSnapshots: [skill],
    }, 'writer', 2, '2026-01-02T00:00:00.000Z');
    expect(full).toEqual({
      contractVersion: CONTRACT_VERSION,
      task: { jobId: 'job-1', contextKey: 'ctx-1', operation: 'polish' },
      document: { documentId: 'doc-1', range: job.range, originalDigest: 'o'.repeat(64) },
      frozen: { ruleVersion: 'rules-1', template: { templateId: 't1' }, modelSelection: { modelId: 'm1' } },
      sources: [{ sourceId: source.sourceId, locator: source.locator, contentDigest: source.contentDigest, fetchedAt: source.fetchedAt }],
      skills: [{ skillId: skill.skillId, version: skill.version, contentDigest: skill.contentDigest }],
      trace: { stageId: 'writer', attempt: 2, at: '2026-01-02T00:00:00.000Z' },
    });
    expect(envelope({ ...job, document: {} }, 'planner', 1, '2026-01-02T00:00:00.000Z')).toEqual(expect.objectContaining({
      frozen: { ruleVersion: undefined, template: null, modelSelection: null },
      sources: [{ sourceId: 's1', locator: undefined, contentDigest: 'a'.repeat(64), fetchedAt: undefined }],
      skills: [],
    }));
    expect(() => envelope(job, 'unknown', 1)).toThrow(/未知阶段/);
  });

  test('产物清理保留 Job 引用并删除无引用旧产物', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'production-artifact-'));
    try {
      const store = createProductionAIArtifactStore({ store: new FileAggregateStore(path.join(root, 'artifacts.json'), { artifacts: {} }) });
      const referenced = artifactRecord('planner', { operation: 'polish', range: job.range, requirements: job.requirements, outline: job.outline });
      const orphan = artifactRecord('planner', { operation: 'polish', range: { start: 0, end: 0 }, requirements: '', outline: '' });
      store.put(referenced); store.put({ ...orphan, storedAt: '2020-01-01T00:00:00.000Z' });
      expect(store.sweep(new Set([referenced.artifactId]), { olderThan: Date.parse('2021-01-01T00:00:00.000Z') })).toEqual({ removed: 1, referenced: 1 });
      expect(store.get(referenced.artifactId)).toBeTruthy();
      expect(store.get(orphan.artifactId)).toBeNull();
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
