#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const defaults = require('../../config/knowledge-center/e2e-production-fixtures.json');
const { audit } = require('./audit-production-references.cjs');
const digest = text => createHash('sha256').update(text).digest('hex');

function guard(env) {
  assert.equal(env.KNOWLEDGE_CENTER_ENVIRONMENT, 'test');
  assert.equal(env.KNOWLEDGE_CENTER_E2E_INITIALIZE_PRODUCTION, '1');
  assert.ok(env.KNOWLEDGE_CENTER_TEST_RUN_ID);
  assert.ok(env.KNOWLEDGE_CENTER_RUN_OWNER?.startsWith(`test-run:${env.KNOWLEDGE_CENTER_TEST_RUN_ID}:`));
  assert.equal(env.KNOWLEDGE_CENTER_NO_TAKEOVER, '1');
  const base = new URL(env.YASDB_STORAGE_URL);
  assert.equal(base.hostname, '127.0.0.1');
  assert.equal(base.protocol, 'http:');
  assert.equal(base.port, env.YASDB_STORAGE_PORT);
  assert.ok(!base.username && !base.password && base.pathname === '/' && !base.search && !base.hash);
  const state = path.resolve(env.KNOWLEDGE_CENTER_STATE_DIR);
  const runtime = path.resolve(__dirname, '../../runtime') + path.sep;
  assert.ok(state.startsWith(runtime));
  const output = path.resolve(env.KNOWLEDGE_CENTER_E2E_INITIALIZATION_DIR);
  assert.equal(output, path.join(path.dirname(state), 'production-initialization'));
  const pid = fs.readFileSync(path.join(state, 'storage.pid'), 'utf8').trim();
  assert.match(pid, /^[1-9][0-9]*$/);
  const processEnv = Object.fromEntries(fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean).map(line => {
    const pos = line.indexOf('='); return [line.slice(0, pos), line.slice(pos + 1)];
  }));
  assert.equal(processEnv.YASDB_USERNAME?.toLowerCase(), 'test_hy');
  for (const key of ['YASDB_STORAGE_PORT', 'KNOWLEDGE_CENTER_RUN_OWNER', 'KNOWLEDGE_CENTER_TEST_RUN_ID']) assert.equal(processEnv[key], env[key]);
  return { base: base.href, output };
}
function privateWrite(file, value) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
async function initialize({ base, output }, fixtures = defaults) {
  fs.mkdirSync(output, { mode: 0o700 }); // Existing directory means a previous attempt: never overwrite its backup.
  fs.chmodSync(output, 0o700);
  const report = { schemaVersion: 1, targetSchema: 'test_hy', startedAt: new Date().toISOString(), passed: false, records: [] };
  async function request(route, options = {}) {
    const response = await fetch(new URL(route, base), { ...options, redirect: 'error', signal: AbortSignal.timeout(30000) });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    return body;
  }
  try {
    const originals = [];
    for (const fixture of fixtures) {
      const route = `/v1/records/${encodeURIComponent(fixture.namespace)}/${encodeURIComponent(fixture.key)}`;
      const record = await request(route);
      assert.equal(record.namespace, fixture.namespace); assert.equal(record.key, fixture.key);
      assert.ok(Number.isSafeInteger(record.revision) && record.revision > 0);
      assert.equal(record.deleted, false); assert.ok(record.payload && typeof record.payload === 'object');
      assert.match(record.sha256, /^[a-f0-9]{64}$/i);
      const filename = `${fixture.namespace}.backup.json`;
      privateWrite(path.join(output, filename), record);
      originals.push({ fixture, record, route });
      report.records.push({ namespace: fixture.namespace, key: fixture.key, originalRevision: record.revision, databaseDigest: record.sha256,
        backupFile: filename, backupDigest: digest(fs.readFileSync(path.join(output, filename))), reset: false });
    }
    const directory = fs.openSync(output, 'r'); try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
    privateWrite(path.join(output, 'backup-manifest.json'), report);
    const before = await audit(base);
    privateWrite(path.join(output, 'references-before.json'), before);
    // The approved exception covers copied deleted references in these two
    // records. Unknown/missing references or other owners must stop before PUT.
    assert.equal(before.counts.unknown, 0);
    assert.equal(before.counts.missing, 0);
    const allowedOwners = new Set(fixtures.map(f => `${f.namespace}:${digest(f.key)}`));
    assert.ok(before.issues.every(issue => issue.state === 'deleted'
      && issue.owners.every(owner => allowedOwners.has(`${owner.namespace}:${owner.keyHash}`))));
    for (const [index, { fixture, record, route }] of originals.entries()) {
      const body = JSON.stringify(fixture.payload);
      const written = await request(route, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': String(record.revision) }, body });
      const actual = await request(route);
      assert.equal(actual.revision, written.revision);
      assert.equal(actual.sha256, digest(body)); assert.deepEqual(actual.payload, fixture.payload);
      report.records[index].reset = true; report.records[index].newRevision = actual.revision;
    }
    const references = await audit(base);
    privateWrite(path.join(output, 'references-after.json'), references);
    assert.equal(references.passed, true);
    report.passed = true;
  } finally {
    report.finishedAt = new Date().toISOString();
    privateWrite(path.join(output, 'report.json'), report);
  }
  return report;
}
if (require.main === module) Promise.resolve().then(() => initialize(guard(process.env))).then(() => {
  console.log('test_hy生产聚合已备份、CAS初始化并回读一致');
}).catch(() => { console.error('测试生产初始化失败；停止启动并保留备份/阶段报告，不输出业务正文'); process.exitCode = 1; });
module.exports = { guard, initialize };
