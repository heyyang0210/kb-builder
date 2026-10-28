#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const rules = require('../../config/knowledge-center/production-reference-audit.json');
const hash = value => createHash('sha256').update(String(value)).digest('hex');

function collectReferences(value, config = rules, field = '', ids = new Set()) {
  if (Array.isArray(value)) for (const item of value) collectReferences(item, config, field, ids);
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) collectReferences(item, config, key, ids);
  else if (value !== null && value !== undefined) {
    const text = String(value);
    if (config.valuePrefixes.some(prefix => text.startsWith(prefix)) || (config.referenceFields.includes(field) && text.trim())) ids.add(text);
    if (field === config.structureField && text.startsWith(config.structurePrefix)) ids.add(text.slice(config.structureStripPrefix.length));
  }
  return ids;
}

async function audit(base, config = rules) {
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw Error('请提供不含凭据和参数的Storage地址');
  async function get(route) {
    const response = await fetch(new URL(route, url), { signal: AbortSignal.timeout(config.timeoutMs), redirect: 'error' });
    let body;
    try { body = await response.json(); } catch { throw Error('Storage返回无效JSON'); }
    return { status: response.status, body };
  }
  const exported = await get('/v1/export');
  if (exported.status !== 200 || exported.body.exportSchemaVersion !== 1 || !Array.isArray(exported.body.records)) throw Error('Storage导出失败或协议不受支持');
  const records = exported.body.records;
  const report = { schemaVersion: 1, observedAt: new Date().toISOString(), observationOnly: true,
    records: records.length, scannedRecords: 0, excludedRecords: 0, uniqueReferences: 0,
    counts: { active: 0, deleted: 0, missing: 0, unknown: 0 }, namespaces: Object.create(null), manifestDigest: null, inventory: [], issues: [], passed: false };
  const references = new Map();
  const manifest = [];
  for (const record of records) {
    if (typeof record.namespace !== 'string' || typeof record.key !== 'string' || !Number.isSafeInteger(record.revision)
      || !/^[a-f0-9]{64}$/i.test(record.sha256) || !Object.hasOwn(record, 'payload')) throw Error('Storage记录协议不完整');
    const keyHash = hash(record.key);
    manifest.push(JSON.stringify([record.namespace, keyHash, record.revision, record.deleted, record.sha256]));
    const stats = report.namespaces[record.namespace] ||= { records: 0, deletedRecords: 0, referencingRecords: 0 };
    stats.records++; if (record.deleted) stats.deletedRecords++;
    if (config.excludedNamespaces.includes(record.namespace)) { report.excludedRecords++; continue; }
    report.scannedRecords++;
    const collectionNames = config.inventoryCollections?.[record.namespace];
    if (collectionNames && record.payload && typeof record.payload === 'object') {
      const collections = Object.fromEntries(collectionNames.map(name => {
        const value = record.payload[name];
        return [name, value && typeof value === 'object' ? Object.keys(value).length : 0];
      }));
      report.inventory.push({ namespace: record.namespace, keyHash, revision: record.revision, collections });
    }
    const ids = collectReferences(record.payload, config);
    if (ids.size) stats.referencingRecords++;
    for (const id of ids) {
      if (!references.has(id)) references.set(id, []);
      references.get(id).push({ namespace: record.namespace, keyHash, revision: record.revision, recordDeleted: record.deleted === true });
    }
  }
  report.manifestDigest = hash(manifest.sort().join('\n'));
  report.uniqueReferences = references.size;
  const entries = [...references.entries()];
  let cursor = 0;
  async function worker() {
    while (cursor < entries.length) {
      const [id, owners] = entries[cursor++];
      let state = 'unknown';
      try {
        const result = await get(`/v1/domain/outlines/${encodeURIComponent(id)}/governance`);
        if (result.status === 404 && result.body.error?.code === 'OUTLINE_NOT_FOUND') state = 'missing';
        else if (result.status === 409 && result.body.error?.code === 'OUTLINE_DELETED') state = 'deleted';
        else if (result.status === 200 && result.body.success === true && String(result.body.data?.outlineId) === id
          && Object.hasOwn(result.body.data, 'deletedAt')) state = result.body.data.deletedAt ? 'deleted' : 'active';
      } catch { /* 未知保留为阻断；不输出响应正文或内部地址。 */ }
      report.counts[state]++;
      if (state !== 'active') report.issues.push({ referenceHash: hash(id), state, owners });
    }
  }
  if (!Number.isInteger(config.concurrency) || config.concurrency < 1) throw Error('盘点并发配置无效');
  await Promise.all(Array.from({ length: Math.min(config.concurrency, entries.length) }, worker));
  report.issues.sort((a, b) => a.referenceHash.localeCompare(b.referenceHash));
  report.passed = report.counts.deleted === 0 && report.counts.missing === 0 && report.counts.unknown === 0;
  return report;
}

if (require.main === module) (async () => {
  const base = process.env.YASDB_STORAGE_URL;
  const output = process.env.KC_REFERENCE_AUDIT_OUTPUT;
  if (!base || !output) throw Error('请显式设置YASDB_STORAGE_URL和KC_REFERENCE_AUDIT_OUTPUT');
  const report = await audit(base);
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(`引用盘点：${report.uniqueReferences}项，缺失${report.counts.missing}，已删除${report.counts.deleted}，未知${report.counts.unknown}`);
  if (!report.passed) process.exitCode = 1;
})().catch(() => {
  const output = process.env.KC_REFERENCE_AUDIT_OUTPUT;
  if (output) {
    try {
      fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
      fs.writeFileSync(output, JSON.stringify({ schemaVersion: 1, observedAt: new Date().toISOString(),
        passed: false, errorCode: 'AUDIT_INCOMPLETE' }, null, 2) + '\n', { mode: 0o600 });
    } catch { /* 原有失败状态保持非零。 */ }
  }
  console.error('引用盘点未完成；请核对Storage连通性、只读接口与协议'); process.exitCode = 1;
});
module.exports = { collectReferences, audit };
