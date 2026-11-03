#!/usr/bin/env node
// Explicit preflight/apply. Never edits the source or overwrites an existing target.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { emptyState } = require('../../packages/agent-runner-core/routes/document-tasks');
function migrate(input, defaultOwnerId) {
  const state = emptyState(defaultOwnerId), issues = [], seen = new Set();
  const rows = Array.isArray(input) ? input : input.tasks;
  if (!Array.isArray(rows)) throw Error('来源必须是任务数组或含 tasks 数组的对象');
  for (const [index, old] of rows.entries()) {
    const number = String(old.number || '').trim();
    if (!number || seen.has(number)) { issues.push({ row: index + 1, blocking: true, message: !number ? '缺少编号' : '编号重复' }); continue; }
    seen.add(number);
    const at = new Date().toISOString();
    const source = { number, description: old.description || old.title || '', product: old.product || null, version: old.version || old.versionNumber || null, sourceStatus: old.sourceStatus || null, sourceOwner: null, sourceCreatedAt: old.sourceCreatedAt || null, output: old.output || old.outputNote || null };
    // Legacy decisions/identities need verification against the live directory/catalog.
    state.tasks.push({ ...source, source, ownerId: old.ownerId || defaultOwnerId || null, revision: 1, decomposition: { ticketImpact: null, ticketReason: null, confirmed: false, handbooks: [] }, startTime: old.startTime || old.startedAt || null, createdAt: old.createdAt || at, updatedAt: at, endTime: null, legacy: structuredClone(old), migrationPending: ['核对责任人员与两级范围', '重新关联真实审核交付证据'], assignmentHistory: [{ type: 'migration', at, operatorId: 'migration-tool', previous: old, next: { status: 'pending_scope' }, reason: '历史状态不作为交付证据' }] });
    if (old.status === 'completed') issues.push({ row: index + 1, blocking: false, message: '旧已完成记录已降为待补证据' });
  }
  state.revision = state.tasks.length;
  return { state, issues };
}
function main(args) {
  const [source, target, ...flags] = args;
  if (!source || !target) throw Error('用法: node tools/repository/migrate-document-tasks.cjs SOURCE TARGET [--apply] [--default-owner=ID]');
  const bytes = fs.readFileSync(source), result = migrate(JSON.parse(bytes), flags.find(f => f.startsWith('--default-owner='))?.split('=')[1]);
  const report = { source: path.resolve(source), target: path.resolve(target), sourceSha256: crypto.createHash('sha256').update(bytes).digest('hex'), tasks: result.state.tasks.length, issues: result.issues, applied: false };
  if (flags.includes('--apply')) {
    if (result.issues.some(i => i.blocking)) throw Error('预检有阻塞错误，拒绝写入');
    if (fs.existsSync(target)) throw Error('目标已存在，拒绝覆盖');
    const backup = `${source}.backup-${Date.now()}`; fs.copyFileSync(source, backup, fs.constants.COPYFILE_EXCL);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, JSON.stringify(result.state, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    Object.assign(report, { applied: true, backup });
  }
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
if (require.main === module) { try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { migrate, main };
