const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { ownership, cleanup } = require('./cleanup.cjs');
const root = path.resolve(__dirname, '../../..');
const report = () => ({ runId: '2026-10-28T07-13-22-721Z-1258316', config: { testPrefix: '性能专项' }, rounds: 3, fixtures: { source: { id: 'source', handbookId: 'DB-004' }, handbook: { name: '性能专项-2026-10-28T07-13-22-721Z-1258316', handbookId: 'own' }, outline: { id: 'outline', handbookId: 'own' } } });
test('拒绝来源手册、来源大纲及伪造归属', () => {
  for (const mutate of [r => r.fixtures.handbook.handbookId = 'DB-004', r => r.fixtures.outline.id = 'source', r => r.fixtures.handbook.name += 'other', r => r.runId = '']) {
    const r = report(); mutate(r); assert.throws(() => ownership(r));
  }
  assert.equal(ownership(report()).names.size, 3);
});
test('清理幂等，精确名称保护其他资源；失败留证并拒绝完成', async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-cleanup-'));
  try {
    const r = report(); let archived = false, deleted = false, recycled = false; const writes = [];
    const api = async (method, endpoint) => {
      if (method !== 'GET') writes.push(endpoint);
      if (endpoint === 'outline/governance/recycle') return recycled ? [{ ...r.fixtures.outline, name: r.fixtures.handbook.name }] : [];
      if (endpoint === 'outline/governance/list') return recycled ? [] : [{ ...r.fixtures.outline, name: r.fixtures.handbook.name }];
      if (endpoint.startsWith('outline/governance/')) { recycled = true; return {}; }
      if (endpoint.startsWith('assets/handbooks?')) return { items: [{ ...r.fixtures.handbook, archived }] };
      if (endpoint.endsWith('/archive')) { archived = true; return {}; }
      if (endpoint === 'templates') return [{ id: 'business', name: '性能专项-业务', status: 'active' }, { id: 'mine', name: [...ownership(r).names][0], status: deleted ? 'deleted' : 'active' }];
      if (endpoint === 'templates/mine') { deleted = true; return {}; }
      if (endpoint.startsWith('cleaning/')) return { items: [], total: 0 };
      throw Error(endpoint);
    };
    assert.equal((await cleanup({ report: r, api, output, root })).completed, true);
    const count = writes.length;
    assert.equal((await cleanup({ report: r, api, output, root })).completed, true);
    assert.equal(writes.length, count);
    assert.ok(!writes.some(x => x.includes('business')));
    const failed = await cleanup({ report: r, api: async () => { throw Error('后端不可用'); }, output, root });
    assert.equal(failed.completed, false); assert.ok(failed.errors.length);
  } finally { fs.rmSync(output, { recursive: true, force: true }); }
});
test('本地上传清理保护任务引用及无关数据，删除本次文件', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-upload-'));
  const state = path.join(temp, 'state.json'), manifest = path.join(temp, 'plan.json');
  const data = { uploadSessions: { upload_abc: { name: 'own', batchId: 'batch_abc' }, upload_def: { name: 'business' } }, batches: { batch_abc: { name: 'own', source: { sourceId: 'upload_abc' } }, batch_def: { name: 'business' } }, tasks: { task: { batchId: 'batch_abc' } } };
  const invoke = () => execFileSync('python3', [path.join(__dirname, 'cleanup-local.py'), root, temp, manifest], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    fs.writeFileSync(manifest, JSON.stringify([{ sessionId: 'upload_abc', batchId: 'batch_abc', name: 'own' }])); fs.writeFileSync(state, JSON.stringify(data));
    assert.throws(invoke); assert.deepEqual(JSON.parse(fs.readFileSync(state)), data);
    delete data.tasks.task; fs.writeFileSync(state, JSON.stringify(data));
    fs.mkdirSync(path.join(temp, 'batches/batch_abc'), { recursive: true });
    invoke(); const after = JSON.parse(fs.readFileSync(state));
    assert.equal(after.batches.batch_def.name, 'business'); assert.equal(after.uploadSessions.upload_def.name, 'business'); assert.equal(after.batches.batch_abc, undefined); assert.equal(fs.existsSync(path.join(temp, 'batches/batch_abc')), false);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
