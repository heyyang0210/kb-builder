#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { inventory } = require('./inventory-production-content.cjs');
const { timeoutMs } = require('../../config/knowledge-center/production-reference-audit.json');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const namespaces = ['handbook-production', 'production-ai-artifacts', 'incremental'];
function safeDirectory(dir) {
  const resolved = path.resolve(dir); let current = path.parse(resolved).root;
  for (const part of resolved.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), 'UNSAFE_DIRECTORY');
  }
  return resolved;
}
function createPrivate(dir) {
  safeDirectory(path.dirname(path.resolve(dir)));
  fs.mkdirSync(dir, { mode: 0o700 }); fs.chmodSync(dir, 0o700); syncDir(path.dirname(path.resolve(dir)));
}
function write(file, bytes) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function syncDir(dir) { const fd = fs.openSync(dir, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function readRegular(file) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const before = fs.fstatSync(fd); assert.ok(before.isFile(), 'UNSAFE_FILE');
    const bytes = fs.readFileSync(fd); const after = fs.fstatSync(fd);
    assert.ok(before.size === bytes.length && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs, 'FILE_CHANGED');
    return bytes;
  } finally { fs.closeSync(fd); }
}
function scan(root, copyTo, prefix = '') {
  safeDirectory(root);
  const files = []; const directories = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    assert.ok(!entry.isSymbolicLink(), 'UNSAFE_ENTRY');
    const name = prefix + entry.name;
    if (entry.isDirectory()) {
      directories.push(name);
      if (copyTo) createPrivate(path.join(copyTo, entry.name));
      const child = scan(path.join(root, entry.name), copyTo && path.join(copyTo, entry.name), name + '/');
      files.push(...child.files); directories.push(...child.directories);
    } else {
      assert.ok(entry.isFile(), 'UNSAFE_ENTRY');
      const bytes = readRegular(path.join(root, entry.name));
      files.push({ name, size: bytes.length, sha256: hash(bytes) });
      if (copyTo) write(path.join(copyTo, entry.name), bytes);
    }
  }
  if (copyTo) syncDir(copyTo);
  return { files, directories };
}
async function exportRecords(base) {
  const url = new URL(base);
  assert.ok(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash, 'INVALID_URL');
  const response = await fetch(new URL('/v1/export', url), { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.exportSchemaVersion, 1);
  assert.ok(Array.isArray(body.records));
  const records = namespaces.map(namespace => {
    const rows = body.records.filter(r => r.namespace === namespace && r.key === 'state' && !r.deleted);
    assert.equal(rows.length, 1); const r = rows[0];
    assert.ok(r.payload && typeof r.payload === 'object' && !Array.isArray(r.payload));
    assert.ok(Number.isSafeInteger(r.revision) && r.revision > 0 && /^[a-f0-9]{64}$/.test(r.sha256));
    return r;
  });
  return { exportSchemaVersion: 1, records };
}
function disjoint(paths) {
  const resolved = paths.map(p => path.resolve(p));
  for (let i = 0; i < resolved.length; i++) for (let j = i + 1; j < resolved.length; j++) {
    assert.ok(resolved[i] !== resolved[j] && !resolved[i].startsWith(resolved[j] + path.sep) && !resolved[j].startsWith(resolved[i] + path.sep), 'OVERLAPPING_PATHS');
  }
}
async function backup({ base, output, attachmentRoot, sourceImageRoot }) {
  assert.ok(attachmentRoot && sourceImageRoot && output, 'MISSING_OPTIONS');
  disjoint([output, attachmentRoot, sourceImageRoot]);
  // Validate ancestors even when the resource root itself is missing.
  for (const root of [attachmentRoot, sourceImageRoot]) {
    let ancestor = path.resolve(root);
    while (!fs.existsSync(ancestor)) { const parent = path.dirname(ancestor); assert.notEqual(parent, ancestor); ancestor = parent; }
    safeDirectory(ancestor);
  }
  createPrivate(output);
  const report = { schemaVersion: 1, scope: 'offline_production_content_backup', stable: false, copied: false, inventoryPassed: false, passed: false };
  try {
    const original = await exportRecords(base);
    const recordBytes = Buffer.from(JSON.stringify(original)); write(path.join(output, 'records.json'), recordBytes);
    const manifest = { schemaVersion: 1, records: { size: recordBytes.length, sha256: hash(recordBytes) }, roots: {} };
    const baseline = await inventory(base, { attachmentRoot, sourceImageRoot });
    for (const [kind, root] of Object.entries({ attachments: attachmentRoot, 'source-images': sourceImageRoot })) {
      try { fs.lstatSync(root); } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        manifest.roots[kind] = { missing: true }; continue;
      }
      createPrivate(path.join(output, kind));
      manifest.roots[kind] = scan(root, path.join(output, kind));
    }
    report.copied = true;
    assert.deepEqual(await exportRecords(base), original, 'AGGREGATE_CHANGED');
    for (const [kind, root] of Object.entries({ attachments: attachmentRoot, 'source-images': sourceImageRoot })) {
      if (manifest.roots[kind].missing) { assert.equal(fs.existsSync(root), false, 'ROOT_CHANGED'); continue; }
      assert.deepEqual(scan(root), manifest.roots[kind], 'FILES_CHANGED');
      assert.deepEqual(scan(path.join(output, kind)), manifest.roots[kind], 'COPY_CHANGED');
    }
    assert.deepEqual(await exportRecords(base), original, 'AGGREGATE_CHANGED');
    report.stable = true; report.inventoryPassed = baseline.passed;
    report.passed = report.copied && report.stable && report.inventoryPassed;
    write(path.join(output, 'inventory.json'), JSON.stringify(baseline));
    write(path.join(output, 'manifest.json'), JSON.stringify(manifest));
    syncDir(output);
  } finally {
    write(path.join(output, 'report.json'), JSON.stringify(report)); syncDir(output);
  }
  return report;
}
async function restore({ backupRoot, output }) {
  disjoint([backupRoot, output]); safeDirectory(backupRoot);
  const readJSON = name => JSON.parse(readRegular(path.join(backupRoot, name)));
  const report = readJSON('report.json'); const manifest = readJSON('manifest.json');
  assert.equal(report.schemaVersion, 1); assert.equal(report.passed, true, 'INCOMPLETE_BACKUP');
  assert.equal(manifest.schemaVersion, 1);
  const bytes = readRegular(path.join(backupRoot, 'records.json'));
  assert.equal(bytes.length, manifest.records.size); assert.equal(hash(bytes), manifest.records.sha256);
  assert.deepEqual(Object.keys(manifest.roots).sort(), ['attachments', 'source-images']);
  for (const kind of ['attachments', 'source-images']) {
    assert.ok(!manifest.roots[kind].missing, 'INCOMPLETE_BACKUP');
    assert.deepEqual(scan(path.join(backupRoot, kind)), manifest.roots[kind], 'BACKUP_CHANGED');
  }
  const records = JSON.parse(bytes);
  createPrivate(output);
  const result = { schemaVersion: 1, scope: 'offline_production_content_restore', passed: false, databaseRestored: false };
  let server;
  try {
    write(path.join(output, 'records.json'), bytes);
    for (const kind of ['attachments', 'source-images']) {
      createPrivate(path.join(output, kind));
      assert.deepEqual(scan(path.join(backupRoot, kind), path.join(output, kind)), manifest.roots[kind]);
      assert.deepEqual(scan(path.join(output, kind)), manifest.roots[kind]);
    }
    server = http.createServer((req, res) => {
      if (req.method !== 'GET' || req.url !== '/v1/export') { res.writeHead(405); res.end(); return; }
      res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(records));
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const checked = await inventory(`http://127.0.0.1:${server.address().port}`, {
      attachmentRoot: path.join(output, 'attachments'), sourceImageRoot: path.join(output, 'source-images'),
    });
    write(path.join(output, 'inventory.json'), JSON.stringify(checked));
    result.passed = checked.passed;
  } finally {
    if (server?.listening) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    write(path.join(output, 'report.json'), JSON.stringify(result)); syncDir(output);
  }
  return result;
}
if (require.main === module) (async () => {
  const env = process.env; const output = path.resolve(env.KC_CONTENT_BACKUP_OUTPUT || '');
  const runtime = safeDirectory(path.resolve(__dirname, '../../runtime'));
  assert.ok(env.KC_CONTENT_BACKUP_OUTPUT && output.startsWith(runtime + path.sep), 'OUTPUT_MUST_BE_RUNTIME');
  const result = env.KC_CONTENT_BACKUP_MODE === 'restore'
    ? await restore({ backupRoot: env.KC_CONTENT_BACKUP_ROOT, output })
    : (assert.ok(!env.KC_CONTENT_BACKUP_MODE || env.KC_CONTENT_BACKUP_MODE === 'backup'), await backup({
      base: env.YASDB_STORAGE_URL, output, attachmentRoot: env.KC_ATTACHMENT_ROOT, sourceImageRoot: env.KC_SOURCE_IMAGE_ROOT,
    }));
  console.log(JSON.stringify(result)); if (!result.passed) process.exitCode = 1;
})().catch(() => { console.error('离线备份/恢复未通过；保留私有现场，未写数据库或覆盖现有目录'); process.exitCode = 1; });
module.exports = { backup, restore };
