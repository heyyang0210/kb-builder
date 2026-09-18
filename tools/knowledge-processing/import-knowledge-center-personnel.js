#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const sourcePath = path.resolve(root, process.env.KC_PERSONNEL_SEED || 'config/knowledge-center/personnel.seed.csv');
const storageUrl = new URL(process.env.YASDB_STORAGE_URL || 'http://127.0.0.1:14210');
const apply = process.argv.includes('--apply');

function parse(source) {
  const rows = source.replace(/^\uFEFF/, '').trim().split(/\r?\n/).map(line => line.split(',').map(value => value.trim()));
  const headers = rows.shift();
  const expected = ['DISPLAY_NAME', 'CAS_LOGIN_NAME', 'STATE'];
  if (headers.length !== expected.length || !expected.every((value, index) => headers[index] === value)) throw new Error(`表头必须为 ${expected.join(',')}`);
  const items = rows.filter(row => row.some(Boolean)).map((row, index) => {
    const [displayName, casLoginName, rawState] = row;
    const state = (rawState || 'ACTIVE').toUpperCase();
    if (!displayName) throw new Error(`第 ${index + 2} 行姓名为空`);
    if (!['ACTIVE', 'INACTIVE'].includes(state)) throw new Error(`第 ${index + 2} 行状态不合法`);
    return { displayName, casLoginName: casLoginName || null, state };
  });
  if (items.length !== 22) throw new Error(`初始人员数必须为 22，当前为 ${items.length}`);
  if (new Set(items.map(item => item.displayName)).size !== items.length) throw new Error('初始人员姓名重复');
  const logins = items.map(item => item.casLoginName).filter(Boolean);
  if (new Set(logins).size !== logins.length) throw new Error('CAS 登录名重复');
  return items;
}

(async () => {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const items = parse(source);
  const sourceSha256 = crypto.createHash('sha256').update(source).digest('hex');
  const summary = { mode: apply ? 'apply' : 'dry-run', source: path.relative(root, sourcePath), sourceSha256, count: items.length, bound: items.filter(item => item.casLoginName).length, pending: items.filter(item => !item.casLoginName).length };
  if (apply) {
    const response = await fetch(new URL('/v1/domain/principals/import', storageUrl), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceSha256, items, actor: 'system:personnel-import' }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) throw new Error(body.error?.message || `HTTP ${response.status}`);
    summary.resultCount = body.data?.total;
    summary.idempotent = body.idempotent === true;
  }
  const outputDir = path.join(root, 'runtime/imports/personnel'); fs.mkdirSync(outputDir, { recursive: true });
  const output = path.join(outputDir, `personnel-import-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}.json`);
  fs.writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ ...summary, report: path.relative(root, output) }, null, 2)}\n`);
})().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
