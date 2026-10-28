const { artifactRecord, CONTRACT_VERSION, verifyArtifactRecord, validateArtifact } = require('../../../packages/agent-runner-core/lib/production-ai-contracts');
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
