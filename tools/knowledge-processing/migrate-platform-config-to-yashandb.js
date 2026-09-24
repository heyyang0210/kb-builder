#!/usr/bin/env node
/* 一次性平台配置迁移：默认 plan；import 必须显式 --apply、--approval-ref 和维护窗口。 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { ROLE_DEFINITIONS } = require('../../packages/agent-runner-core/lib/knowledge-center-auth');

const root = path.resolve(__dirname, '../..');
const args = new Set(process.argv.slice(2));
const command = process.argv.slice(2).find(v => !v.startsWith('--')) || 'plan';
const apply = args.has('--apply');
const approvalRef = process.env.MIGRATION_APPROVAL_REF || process.argv.find(v => v.startsWith('--approval-ref='))?.slice(16);
const baseUrl = process.env.KNOWLEDGE_CENTER_MIGRATION_URL || 'http://127.0.0.1:14210';
const authFile = process.env.KC_AUTH_SOURCE || path.join(root, 'runtime/agent-runner/tmp/knowledge-center-auth.json');
const gitlabFile = process.env.KC_GITLAB_SOURCE || path.join(root, 'runtime/knowledge-center/gitlab-connections.json');

function sha(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function sort(value) {
  if (Array.isArray(value)) return value.map(sort).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, sort(value[k])]));
  return value;
}
function canonical(value) { return JSON.stringify(sort(value)); }
function normalizeAuth(source) {
  const users = (source.users || []).filter(u => u.identitySource === 'cas').map(u => ({
    userKey: String(u.id || '').trim(), principalId: Number(u.principalId), loginName: String(u.loginName || '').trim(),
    displayName: String(u.displayName || '').trim(), state: u.enabled === false ? 'INACTIVE' : 'ACTIVE',
    roles: [...new Set(Array.isArray(u.roles) ? u.roles.map(String) : [])].sort(),
  }));
  const rejected = (source.users || []).filter(u => u.identitySource !== 'cas').map(u => ({ sourceId: u.id, reason: 'LOCAL_ACCOUNT_NOT_DATABASE_MANAGED' }));
  const invalid = users.filter(u => !u.userKey || !Number.isInteger(u.principalId) || !u.loginName || !u.displayName || !u.roles.every(r => ROLE_DEFINITIONS[r]));
  return { users: users.filter(u => !invalid.includes(u)), rejected: rejected.concat(invalid.map(u => ({ sourceId: u.userKey, reason: 'INVALID_CAS_ACCOUNT' }))), roles: ROLE_DEFINITIONS };
}
function normalizeGitlab(source) {
  const connections = (source.connections || []).map(c => ({ connectionKey: String(c.id).trim(), connectionName: String(c.name).trim(), baseUrl: String(c.host).trim().replace(/\/$/, ''), projectPath: String(c.project).trim(), pathPrefix: String(c.pathPrefix || '').trim(), defaultBranch: String(c.defaultBranch || '').trim(), runMode: String(c.mode || 'disabled').toUpperCase(), authMode: String(c.authMode || 'user_oauth').toUpperCase(), credentialRef: c.credentialRef || null, purpose: String(c.purpose || 'read').toUpperCase(), state: String(c.status || 'active').toUpperCase() }));
  const mappings = (source.mappings || []).map(m => ({ manualId: String(m.handbookId).trim(), connectionKey: String(m.connectionId).trim(), defaultBranch: String(m.defaultBranch).trim(), enabledBranches: [...new Set((m.enabledBranches || []).map(String).map(s => s.trim()).filter(Boolean))].sort(), zhPaths: [...new Set((m.zhPaths || []).map(String).map(s => s.trim()).filter(Boolean))].sort(), enPaths: [...new Set((m.enPaths || []).map(String).map(s => s.trim()).filter(Boolean))].sort() }));
  const rejected = mappings.filter(m => !m.enabledBranches.includes(m.defaultBranch) || (!m.zhPaths.length && !m.enPaths.length)).map(m => ({ sourceId: m.manualId, reason: 'MAPPING_VALIDATION_FAILED' }));
  return { connections, mappings: mappings.filter(m => !rejected.some(r => r.sourceId === m.manualId)), rejected };
}
function build() {
  const auth = normalizeAuth(read(authFile)); const gitlab = normalizeGitlab(read(gitlabFile));
  return { auth, gitlab, sourceSha256: { auth: sha(auth), gitlab: sha(gitlab) } };
}
function request(method, pathname, body) {
  const target = new URL(pathname, baseUrl); const transport = target.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => { const req = transport.request(target, { method, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 30000 }, res => { const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => { let data; try { data = JSON.parse(Buffer.concat(chunks)); } catch (_) { return reject(new Error('迁移 API 返回非 JSON')); } if (res.statusCode >= 200 && res.statusCode < 300) resolve(data); else reject(new Error(data.error?.message || `迁移 API HTTP ${res.statusCode}`)); }); }); req.on('error', reject); req.write(JSON.stringify(body)); req.end(); });
}
async function main() {
  const plan = build();
  if (command === 'plan' || !apply) { console.log(JSON.stringify({ command: 'plan', sourceSha256: plan.sourceSha256, auth: { migrated: plan.auth.users.length, rejected: plan.auth.rejected.length, ignored: (read(authFile).users || []).filter(u => u.identitySource !== 'cas').length }, gitlab: { connections: plan.gitlab.connections.length, mappings: plan.gitlab.mappings.length, rejected: plan.gitlab.rejected.length }, approvalRequired: true }, null, 2)); if (command !== 'plan') process.exitCode = 2; return; }
  if (command !== 'import') throw new Error('仅支持 plan/import；verify 和 export-rollback 需在迁移 API 完成后实现');
  if (!approvalRef) throw new Error('import 必须提供 --approval-ref=... 或 MIGRATION_APPROVAL_REF');
  if (process.env.MIGRATION_MAINTENANCE_WINDOW !== 'true') throw new Error('import 必须设置 MIGRATION_MAINTENANCE_WINDOW=true');
  for (const [domain, payload] of [['auth', plan.auth], ['gitlab', plan.gitlab]]) {
    const body = { batchId: `PFC1-${domain.toUpperCase()}-${plan.sourceSha256[domain].slice(0, domain === 'auth' ? 54 : 52)}`, sourceSha256: plan.sourceSha256[domain], approvalRef, items: payload };
    console.log(JSON.stringify(await request('POST', `/v1/migrations/platform-config/${domain}/import`, body)));
  }
}
main().catch(error => { console.error(`迁移失败：${error.message}`); process.exitCode = 1; });
