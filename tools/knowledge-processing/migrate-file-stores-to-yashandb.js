#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DatabaseRecordStore } = require('../../packages/agent-runner-core/lib/database-record-store');

const root = path.join(__dirname, '..', '..');
const apply = process.argv.includes('--apply');
const store = new DatabaseRecordStore({ timeoutMs: Number(process.env.YASDB_STORAGE_MIGRATION_TIMEOUT_MS || 30000) });

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function clone(value) {
  return structuredClone(value);
}

function loadPayload(file, fallback) {
  if (!fs.existsSync(file)) return clone(fallback);
  const text = fs.readFileSync(file, 'utf8').trim();
  if (!text) return clone(fallback);
  try {
    return JSON.parse(text);
  } catch (_error) {
    return clone(fallback);
  }
}

const fallbackByKey = new Map([
  ['auth/state', { users: [], sessions: [], consumedTickets: [], audits: [] }],
  ['assets/catalog', { version: 1, handbooks: [], audits: [] }],
  ['gitlab/connections', { connections: [], mappings: [], idempotency: [], audit: [] }],
  ['outlines/metadata', { outlines: [] }],
  ['documents/index', { documents: [], versions: {} }],
  ['documents/metadata', { documents: [] }],
  ['documents/comments', { version: 1, comments: [] }],
  ['incremental/state', { schemaVersion: 1, tasks: [], publishedVersions: [], idempotency: {}, audits: [] }],
]);

function workflowSeeds() {
  const now = new Date().toISOString();
  return [
    {
      id: 'default',
      name: '默认4步流程',
      description: '标准的文档生成流程，包括规划、检索、生成和验证',
      steps: [
        { name: 'planner', agent: 'planner', config: {} },
        { name: 'retriever', agent: 'retriever', config: {} },
        { name: 'generator', agent: 'generator', config: {} },
        { name: 'validator', agent: 'validator', config: {} },
      ],
      is_default: true,
      created_at: now,
      updated_at: now,
      deleted: false,
    },
    {
      id: 'fast',
      name: '快速生成',
      description: '跳过验证步骤，快速生成文档',
      steps: [
        { name: 'planner', agent: 'planner', config: {} },
        { name: 'retriever', agent: 'retriever', config: {} },
        { name: 'generator', agent: 'generator', config: {} },
      ],
      is_default: false,
      created_at: now,
      updated_at: now,
      deleted: false,
    },
    {
      id: 'high_quality',
      name: '高质量模式',
      description: '增加审核步骤，确保文档质量',
      steps: [
        { name: 'planner', agent: 'planner', config: {} },
        { name: 'retriever', agent: 'retriever', config: {} },
        { name: 'generator', agent: 'generator', config: {} },
        { name: 'reviewer', agent: 'validator', config: { strict_mode: true } },
        { name: 'validator', agent: 'validator', config: {} },
      ],
      is_default: false,
      created_at: now,
      updated_at: now,
      deleted: false,
    },
  ];
}

function workflowFallback(id) {
  const seed = workflowSeeds().find(item => item.id === id);
  if (seed) return seed;
  const now = new Date().toISOString();
  return {
    id,
    name: id,
    description: '',
    steps: [],
    is_default: false,
    created_at: now,
    updated_at: now,
    deleted: false,
  };
}

function sources() {
  const fixed = [
    { namespace: 'auth', key: 'state', file: path.join(root, 'tmp', 'knowledge-center-auth.json') },
    { namespace: 'assets', key: 'catalog', file: path.join(root, 'config', 'knowledge-assets.json') },
    { namespace: 'gitlab', key: 'connections', file: path.join(root, 'config', 'gitlab-connections.json') },
    { namespace: 'outlines', key: 'metadata', file: path.join(root, 'outlines', 'metadata.json') },
    { namespace: 'documents', key: 'index', file: path.join(root, 'output', 'metadata.json') },
    { namespace: 'documents', key: 'metadata', file: path.join(root, 'tmp', 'doc-processed', 'metadata.json') },
    { namespace: 'documents', key: 'comments', file: path.join(root, 'data', 'document-comments.json') },
    { namespace: 'incremental', key: 'state', file: path.join(root, 'tmp', 'incremental-build-state.json') },
  ];

  const workflowDir = path.join(root, 'workflows');
  const workflowKeys = new Set();
  if (fs.existsSync(workflowDir)) {
    for (const file of fs.readdirSync(workflowDir).filter(name => name.endsWith('.json')).sort()) {
      const key = path.basename(file, '.json');
      workflowKeys.add(key);
      fixed.push({
        namespace: 'workflows',
        key,
        file: path.join(workflowDir, file),
      });
    }
  }

  for (const seed of workflowSeeds()) {
    if (!workflowKeys.has(seed.id)) {
      fixed.push({ namespace: 'workflows', key: seed.id, file: null });
    }
  }

  return fixed;
}

async function readCurrentRecord(namespace, key) {
  try {
    return await store.read(namespace, key);
  } catch (error) {
    if (error.code === 'RECORD_NOT_FOUND') return null;
    throw error;
  }
}

async function syncEntry(entry) {
  const sourceExists = entry.file ? fs.existsSync(entry.file) : false;
  const payload = sourceExists
    ? loadPayload(entry.file, fallbackByKey.get(`${entry.namespace}/${entry.key}`) || workflowFallback(entry.key))
    : clone(fallbackByKey.get(`${entry.namespace}/${entry.key}`) || workflowFallback(entry.key));
  const sourceSha256 = digest(payload);
  const current = apply ? await readCurrentRecord(entry.namespace, entry.key) : null;

  if (!apply) {
    if (sourceExists) {
      return {
        namespace: entry.namespace,
        key: entry.key,
        source: path.relative(root, entry.file),
        sha256: sourceSha256,
        action: current && !current.deleted && digest(current.payload) === sourceSha256 ? 'already_synced' : 'would_import',
      };
    }
    return {
      namespace: entry.namespace,
      key: entry.key,
      source: 'synthetic-default',
      sha256: sourceSha256,
      action: current ? 'existing_record_preserved' : 'would_seed_empty_record',
    };
  }

  if (sourceExists) {
    if (current && !current.deleted && digest(current.payload) === sourceSha256) {
      return {
        namespace: entry.namespace,
        key: entry.key,
        source: path.relative(root, entry.file),
        sha256: sourceSha256,
        revision: current.revision,
        action: 'already_synced',
      };
    }

    const written = await store.write(entry.namespace, entry.key, payload);
    const stored = await store.read(entry.namespace, entry.key);
    const targetSha256 = digest(stored.payload);
    if (sourceSha256 !== targetSha256 || sourceSha256 !== written.sha256 || sourceSha256 !== stored.sha256) {
      throw new Error(`${entry.namespace}/${entry.key} 摘要对账失败`);
    }
    return {
      namespace: entry.namespace,
      key: entry.key,
      source: path.relative(root, entry.file),
      sha256: sourceSha256,
      revision: stored.revision,
      action: 'imported_and_verified',
    };
  }

  if (current) {
    return {
      namespace: entry.namespace,
      key: entry.key,
      source: 'synthetic-default',
      sha256: sourceSha256,
      revision: current.revision,
      action: 'existing_record_preserved',
    };
  }

  const written = await store.write(entry.namespace, entry.key, payload);
  const stored = await store.read(entry.namespace, entry.key);
  const targetSha256 = digest(stored.payload);
  if (sourceSha256 !== targetSha256 || sourceSha256 !== written.sha256 || sourceSha256 !== stored.sha256) {
    throw new Error(`${entry.namespace}/${entry.key} 摘要对账失败`);
  }
  return {
    namespace: entry.namespace,
    key: entry.key,
    source: 'synthetic-default',
    sha256: sourceSha256,
    revision: stored.revision,
    action: 'seeded_and_verified',
  };
}

async function main() {
  const entries = sources();
  const report = [];
  for (let index = 0; index < entries.length; index += 4) {
    const batch = entries.slice(index, index + 4);
    const results = await Promise.all(batch.map(syncEntry));
    report.push(...results);
  }
  process.stdout.write(`${JSON.stringify({ success: true, mode: apply ? 'apply' : 'dry-run', count: report.length, records: report }, null, 2)}\n`);
  if (!apply) process.stderr.write('当前为预演；确认后使用 --apply 执行数据库写入。\n');
}

main().catch(error => {
  process.stderr.write(`迁移失败：${error.message}\n`);
  process.exitCode = 1;
});
