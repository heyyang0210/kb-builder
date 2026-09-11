#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DatabaseRecordStore } = require('../../packages/agent-runner-core/lib/database-record-store');

const root = path.resolve(__dirname, '..', '..');
const apply = process.argv.includes('--apply');
const store = new DatabaseRecordStore({ timeoutMs: Number(process.env.YASDB_STORAGE_MIGRATION_TIMEOUT_MS || 30000) });

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sources() {
  const fixed = [
    ['auth', 'state', path.join(root, 'tmp', 'knowledge-center-auth.json')],
    ['assets', 'catalog', path.join(root, 'config', 'agent-runner', 'knowledge-assets.json')],
    ['outlines', 'metadata', path.join(root, 'outlines', 'metadata.json')],
    ['documents', 'metadata', path.join(root, 'tmp', 'doc-processed', 'metadata.json')],
    ['documents', 'comments', path.join(root, 'data', 'document-comments.json')],
    ['incremental', 'state', path.join(root, 'tmp', 'incremental-build-state.json')],
  ];
  const workflowDir = path.join(root, 'workflows');
  if (fs.existsSync(workflowDir)) {
    for (const file of fs.readdirSync(workflowDir).filter(name => name.endsWith('.json')).sort()) {
      fixed.push(['workflows', path.basename(file, '.json'), path.join(workflowDir, file)]);
    }
  }
  return fixed;
}

async function main() {
  const available = sources().filter(([, , file]) => fs.existsSync(file));
  const report = [];
  for (let index = 0; index < available.length; index += 4) {
    const batch = available.slice(index, index + 4);
    const results = await Promise.all(batch.map(async ([namespace, key, file]) => {
      const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
      const sourceSha256 = digest(payload);
      if (!apply) return { namespace, key, source: path.relative(root, file), sha256: sourceSha256, action: 'would_import' };
      const written = await store.write(namespace, key, payload);
      const stored = await store.read(namespace, key);
      const targetSha256 = digest(stored.payload);
      if (sourceSha256 !== targetSha256 || sourceSha256 !== written.sha256 || sourceSha256 !== stored.sha256) {
        throw new Error(`${namespace}/${key} 摘要对账失败`);
      }
      return { namespace, key, source: path.relative(root, file), sha256: sourceSha256, revision: stored.revision, action: 'imported_and_verified' };
    }));
    report.push(...results);
  }
  process.stdout.write(`${JSON.stringify({ success: true, mode: apply ? 'apply' : 'dry-run', count: report.length, records: report }, null, 2)}\n`);
  if (!apply) process.stderr.write('当前为预演；确认后使用 --apply 执行数据库写入。\n');
}

main().catch(error => {
  process.stderr.write(`迁移失败：${error.message}\n`);
  process.exitCode = 1;
});
