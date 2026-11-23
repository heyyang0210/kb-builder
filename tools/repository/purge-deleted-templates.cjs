#!/usr/bin/env node
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const backupDir = path.join(root, 'runtime/maintenance/template-purge');

function parseArgs(argv) {
  const options = { storageUrl: 'http://127.0.0.1:14210', apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') { options.apply = true; continue; }
    const key = { '--storage-url': 'storageUrl', '--before': 'before',
      '--expected-revision': 'expectedRevision', '--approval-ref': 'approvalRef' }[arg];
    if (!key || !argv[index + 1]) throw new Error(`未知参数或缺少值：${arg}`);
    options[key] = argv[++index];
  }
  const url = new URL(options.storageUrl);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.pathname !== '/') throw new Error('存储地址必须是本机 HTTP 根地址');
  options.storageUrl = url.origin;
  if (options.before && (!/^\d{4}-\d{2}-\d{2}$/.test(options.before)
    || new Date(`${options.before}T00:00:00Z`).toISOString().slice(0, 10) !== options.before))
    throw new Error('--before 必须是有效的 YYYY-MM-DD 日期');
  if (options.apply && (!options.before || !/^[1-9]\d*$/.test(options.expectedRevision || '')
    || !String(options.approvalRef || '').trim()))
    throw new Error('执行清理必须同时提供 --before、--expected-revision 和 --approval-ref');
  return options;
}

async function record(base, namespace) {
  const response = await fetch(`${base}/v1/records/${namespace}/state`, { signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (response.status === 404 && namespace === 'template-mappings') return { revision: 0, payload: {} };
  if (!response.ok || result.success === false) throw new Error(`${namespace} 读取失败：${result.error?.code || response.status}`);
  if (result.deleted || !result.payload || typeof result.payload !== 'object') throw new Error(`${namespace} 聚合记录无效`);
  return result;
}

function currentReferences(mapping) {
  const found = new Set();
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.templateId === 'string') found.add(value.templateId);
    for (const child of Object.values(value)) if (child && typeof child === 'object') visit(child);
  };
  visit(mapping.rules || []);
  visit(mapping.effective || {});
  return found;
}

function planPurge(state, mapping, before) {
  if (!state || !Array.isArray(state.templates) || !Array.isArray(state.audits))
    throw new Error('模板聚合缺少 templates 或 audits 数组');
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping))
    throw new Error('映射聚合格式无效');
  const idsInState = state.templates.map(item => item?.id);
  if (idsInState.some(id => typeof id !== 'string' || !id) || new Set(idsInState).size !== idsInState.length)
    throw new Error('模板聚合包含缺失或重复的模板 ID');
  const cutoff = Date.parse(`${before || new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const references = currentReferences(mapping);
  const eligible = []; const blocked = []; const invalidDate = [];
  for (const template of state.templates) {
    if (template.status !== 'deleted') continue;
    const date = template.updatedAt;
    if (!date || !Number.isFinite(Date.parse(date))) { invalidDate.push(template.id); continue; }
    if (Date.parse(date) >= cutoff) continue;
    if (references.has(template.id)) blocked.push(template.id);
    else eligible.push(template.id);
  }
  const ids = new Set(eligible);
  const next = { ...state, templates: state.templates.filter(template => !ids.has(template.id)) };
  return { eligible, blocked, invalidDate, next };
}

async function run(options) {
  const source = await record(options.storageUrl, 'templates');
  const mapping = await record(options.storageUrl, 'template-mappings');
  const { eligible, blocked, invalidDate, next } = planPurge(source.payload, mapping.payload, options.before);
  const summary = { mode: options.apply ? 'apply' : 'dry-run', revision: source.revision,
    before: options.before || new Date().toISOString().slice(0, 10),
    total: source.payload.templates.length, deleted: source.payload.templates.filter(item => item.status === 'deleted').length,
    eligible, blockedByCurrentMapping: blocked, invalidDate,
    bytesBefore: Buffer.byteLength(JSON.stringify(source.payload)), bytesAfter: Buffer.byteLength(JSON.stringify(next)) };
  if (!options.apply || !eligible.length) return summary;
  if (Number(options.expectedRevision) !== source.revision) throw new Error('模板聚合修订号已变化，请重新预检');

  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backup = path.join(backupDir, `templates-${Date.now()}-${crypto.randomUUID()}.json`);
  const backupContent = JSON.stringify({ source, mappingRevision: mapping.revision,
    approvalRef: options.approvalRef, cutoff: summary.before, eligible }, null, 2);
  fs.writeFileSync(backup, backupContent, { flag: 'wx', mode: 0o600 });
  const digest = crypto.createHash('sha256').update(backupContent).digest('hex');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(backup)).digest('hex'), digest);

  const response = await fetch(`${options.storageUrl}/v1/records/templates/state`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': String(source.revision) },
    body: JSON.stringify(next), signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok || result.success === false)
    throw new Error(`清理未提交：${result.error?.code || response.status}；备份 ${backup}`);
  const after = await record(options.storageUrl, 'templates');
  assert.equal(JSON.stringify(after.payload), JSON.stringify(next), `写后回读不一致；备份 ${backup}`);
  return { ...summary, newRevision: after.revision, backup, backupSha256: digest };
}

if (require.main === module) {
  Promise.resolve().then(() => run(parseArgs(process.argv.slice(2))))
    .then(result => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}

module.exports = { parseArgs, planPurge, run };
