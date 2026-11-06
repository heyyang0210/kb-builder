#!/usr/bin/env node
// Run only after explicit approval for the exact live-data backfill.
const fs = require('fs');
const path = require('path');
const { backfillDocumentNumbers, backfillHistoricalNumbers } = require('../../packages/agent-runner-core/lib/workbench-numbering');

const base = process.env.KNOWLEDGE_STORAGE_URL || 'http://127.0.0.1:14210';
const output = process.argv[2];
if (!output || !path.resolve(output).includes(`${path.sep}runtime${path.sep}`)) {
  process.stderr.write('Usage: node apply-workbench-numbering.cjs runtime/.../approved-run\n');
  process.exit(2);
}
const url = name => new URL(`/v1/records/${name}/state`, base);
async function record(name) {
  const response = await fetch(url(name));
  const result = await response.json();
  if (!response.ok || !result.payload) throw new Error(`${name} 读取失败：${response.status}`);
  return result;
}
function privateJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 }); }
async function main() {
  const [tickets, reviews] = await Promise.all([record('document_tasks'), record('incremental')]);
  const state = structuredClone(tickets.payload);
  if (state.schemaVersion !== 2 || !Array.isArray(state.tasks) || !Array.isArray(reviews.payload.tasks)) throw new Error('快照格式不符合迁移契约');
  backfillDocumentNumbers(state);
  backfillHistoricalNumbers(state, reviews.payload);
  const entries = Object.values(state.workbenchNumbers.entries);
  const report = { ticketRevisionBefore: tickets.revision, reviewRevision: reviews.revision, ticketCount: state.tasks.length,
    historicalCount: entries.filter(item => item.status === 'historical').length,
    needsReviewCount: entries.filter(item => item.status === 'needs_review').length };
  if (report.needsReviewCount) throw new Error('存在待核对关联，停止整批回填');
  fs.mkdirSync(output, { recursive: false, mode: 0o700 });
  privateJson(path.join(output, 'ticket-backup.json'), tickets);
  privateJson(path.join(output, 'review-backup.json'), reviews);
  privateJson(path.join(output, 'candidate.json'), state);
  privateJson(path.join(output, 'precheck.json'), report);
  const response = await fetch(url('document_tasks'), { method: 'PUT', headers: { 'Content-Type': 'application/json; charset=utf-8', 'If-Match': String(tickets.revision) }, body: JSON.stringify(state) });
  const result = await response.json();
  if (!response.ok || result.success === false) throw new Error(`回填失败：${response.status} ${result.error?.code || ''}`);
  const after = await record('document_tasks');
  if (after.payload.tasks.length !== state.tasks.length || !after.payload.workbenchNumbers) throw new Error('回读不一致；使用备份和版本检查执行人工回退');
  privateJson(path.join(output, 'result.json'), { ...report, ticketRevisionAfter: after.revision, verified: true });
  process.stdout.write(JSON.stringify({ ...report, ticketRevisionAfter: after.revision, verified: true, backup: output }) + '\n');
}
main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
