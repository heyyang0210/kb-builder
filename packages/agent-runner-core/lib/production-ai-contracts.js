const crypto = require('crypto');
const schemaRegistry = require('./production-ai-schema-registry');

const CONTRACT_VERSION = '1.0';
const STAGES = Object.freeze(['planner', 'evidence', 'writer', 'reviewer']);
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function contractError(message) {
  const error = new Error(message);
  error.code = 'AI_STAGE_CONTRACT_INVALID';
  return error;
}

function assertText(value, name, maxLength) {
  if (typeof value !== 'string' || value.length > maxLength) throw contractError(`${name} 字段无效`);
}

function validateArtifact(stageId, artifact, job) {
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) throw contractError(`${stageId} 产物必须为对象`);
  try {
    schemaRegistry.validateStage(stageId, artifact);
  } catch (error) {
    if (error.code === 'AI_STAGE_SCHEMA_INVALID') throw contractError(`${stageId} 产物不符合阶段 Schema：${error.message}`);
    throw error;
  }
  if (stageId === 'planner') {
    if (artifact.operation !== job.operation || artifact.range?.start !== job.range.start || artifact.range?.end !== job.range.end) {
      throw contractError('规划产物不能修改操作或处理范围');
    }
    assertText(artifact.requirements, 'requirements', 12000);
    assertText(artifact.outline, 'outline', 20000);
  } else if (stageId === 'evidence') {
    if (!Array.isArray(artifact.sources) || artifact.sources.length > 100) throw contractError('证据来源数量无效');
    const expected = (job.sourceSnapshots || []).map(source => [source.sourceId, source.contentDigest]).sort();
    const actual = artifact.sources.map(source => [source?.sourceId, source?.contentDigest]).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw contractError('证据阶段不能增加或替换已确认来源');
  } else if (stageId === 'writer') {
    assertText(artifact.fragment, 'fragment', 200000);
    if (!artifact.fragment.trim() || !Array.isArray(artifact.provenance) || artifact.provenance.length > 512) {
      throw contractError('候选片段或来源标注无效');
    }
  } else if (stageId === 'reviewer') {
    if (artifact.status !== 'contract_valid' || artifact.candidateDigest !== job.candidateDigest
      || !Number.isSafeInteger(artifact.provenanceSegments) || artifact.provenanceSegments < 0 || artifact.provenanceSegments > 512) {
      throw contractError('审阅产物与候选不匹配');
    }
  } else throw contractError('未知阶段');
  return artifact;
}

function artifactRecord(stageId, value, contractVersion = CONTRACT_VERSION) {
  return { artifactId: `artifact-${stageId}-${digest(value).slice(0, 24)}`, stageId, contractVersion, digest: digest(value), value };
}

function verifyArtifactRecord(record, stageId, expectedDigest, job) {
  if (!record || record.stageId !== stageId || record.contractVersion !== CONTRACT_VERSION
    || record.digest !== expectedDigest || digest(record.value) !== record.digest) return false;
  try { validateArtifact(stageId, record.value, job); return true; } catch (_) { return false; }
}

function envelope(job, stageId, attempt, now = new Date().toISOString()) {
  if (!STAGES.includes(stageId)) throw contractError('未知阶段');
  return {
    contractVersion: CONTRACT_VERSION,
    task: { jobId: job.jobId, contextKey: job.contextKey, operation: job.operation },
    document: { ...job.document, range: job.range, originalDigest: job.originalDigest },
    frozen: { ruleVersion: job.ruleVersion, template: job.templateSnapshot || null, modelSelection: job.modelSelection || null },
    sources: (job.sourceSnapshots || []).map(({ sourceId, locator, contentDigest, fetchedAt }) => ({ sourceId, locator, contentDigest, fetchedAt })),
    skills: (job.skillSnapshots || []).map(({ skillId, version, contentDigest }) => ({ skillId, version, contentDigest })),
    trace: { stageId, attempt, at: now },
  };
}

module.exports = { CONTRACT_VERSION, STAGES, artifactRecord, digest, envelope, validateArtifact, verifyArtifactRecord };
