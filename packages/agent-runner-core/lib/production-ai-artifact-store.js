const { createAggregateStore } = require('./aggregate-store');
const { AGENT_RUNNER_RUNTIME_ROOT } = require('./repo-paths');
const path = require('path');

function createProductionAIArtifactStore(options = {}) {
  const store = options.store || createAggregateStore({
    namespace: 'production-ai-artifacts',
    key: 'state',
    filePath: options.filePath || path.join(AGENT_RUNNER_RUNTIME_ROOT, 'handbook-production', 'ai-artifacts.json'),
    emptyValue: { schemaVersion: 1, artifacts: {} },
  });

  function put(record) {
    if (!record?.artifactId || !record.digest || !record.value) throw new Error('AI_ARTIFACT_INVALID');
    return store.transaction(state => {
      state.artifacts ||= {};
      const current = state.artifacts[record.artifactId];
      if (current && current.digest !== record.digest) throw new Error('AI_ARTIFACT_ID_CONFLICT');
      state.artifacts[record.artifactId] ||= { ...structuredClone(record), storedAt: record.storedAt || new Date().toISOString() };
      return structuredClone(state.artifacts[record.artifactId]);
    });
  }

  function get(artifactId) {
    return store.read().artifacts?.[String(artifactId)] || null;
  }

  function list() {
    return Object.values(store.read().artifacts || {}).map(item => structuredClone(item));
  }

  function sweep(referencedIds = new Set(), options = {}) {
    const keep = referencedIds instanceof Set ? referencedIds : new Set(referencedIds || []);
    const cutoff = options.olderThan ? Number(options.olderThan) : 0;
    let removed = 0;
    store.transaction(state => {
      for (const [artifactId, record] of Object.entries(state.artifacts || {})) {
        const createdAt = Date.parse(record.createdAt || record.storedAt || '') || 0;
        if (!keep.has(artifactId) && createdAt <= cutoff) {
          delete state.artifacts[artifactId];
          removed += 1;
        }
      }
      return state;
    });
    return { removed, referenced: keep.size };
  }

  return { put, get, list, sweep };
}

module.exports = { createProductionAIArtifactStore };
