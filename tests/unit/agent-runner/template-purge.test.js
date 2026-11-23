const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const { parseArgs, planPurge, run } = require('../../../tools/repository/purge-deleted-templates.cjs');

test('清理规划只选择截止前且无当前映射引用的已删除模板', () => {
  const state = { templates: [
    { id: 'old', status: 'deleted', updatedAt: '2026-10-01T00:00:00Z' },
    { id: 'linked', status: 'deleted', updatedAt: '2026-10-01T00:00:00Z' },
    { id: 'recent', status: 'deleted', updatedAt: '2026-11-01T00:00:00Z' },
    { id: 'bad-date', status: 'deleted' },
    { id: 'active', status: 'active' },
  ], audits: [{ action: 'TEMPLATE_DELETED', templateId: 'old' }] };
  const plan = planPurge(state, { rules: [{ templateId: 'linked' }] }, '2026-11-01');
  expect(plan.eligible).toEqual(['old']);
  expect(plan.blocked).toEqual(['linked']);
  expect(plan.invalidDate).toEqual(['bad-date']);
  expect(plan.next.templates.map(item => item.id)).toEqual(['linked', 'recent', 'bad-date', 'active']);
  expect(plan.next.audits).toEqual(state.audits);
});

test('执行参数要求显式截止日期、修订号和批准引用', () => {
  expect(() => parseArgs(['--apply'])).toThrow(/必须同时提供/);
  expect(() => parseArgs(['--before', '2026-02-30'])).toThrow(/有效/);
  expect(() => parseArgs(['--storage-url', 'https://example.com'])).toThrow(/本机/);
});

test('重复模板 ID 时拒绝生成删除计划', () => {
  expect(() => planPurge({ templates: [
    { id: 'same', status: 'deleted', updatedAt: '2026-10-01T00:00:00Z' },
    { id: 'same', status: 'active' },
  ], audits: [] }, {}, '2026-11-01')).toThrow(/重复/);
});

test('隔离 HTTP 清理先备份、按修订写入并回读；版本冲突不覆盖', async () => {
  let revision = 7;
  let payload = { schemaVersion: 1, templates: [
    { id: 'old', status: 'deleted', updatedAt: '2026-10-01T00:00:00Z', versions: [{ content: '# old' }] },
    { id: 'live', status: 'active', updatedAt: '2026-10-01T00:00:00Z' },
  ], audits: [{ action: 'TEMPLATE_DELETED', templateId: 'old' }] };
  const writes = [];
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    let status = 200; let result;
    if (req.url === '/v1/records/template-mappings/state') result = { success: true, revision: 2, payload: { rules: [], effective: {} } };
    else if (req.url === '/v1/records/templates/state' && req.method === 'GET') result = { success: true, revision, payload };
    else if (req.url === '/v1/records/templates/state' && req.method === 'PUT') {
      writes.push({ expected: req.headers['if-match'], body });
      if (req.headers['if-match'] !== String(revision)) { status = 409; result = { success: false, error: { code: 'REVISION_CONFLICT' } }; }
      else { payload = body; revision++; result = { success: true, revision }; }
    } else { status = 404; result = { success: false, error: { code: 'NOT_FOUND' } }; }
    res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const backupDirectory = require('node:path').resolve(__dirname, '../../../runtime/maintenance/template-purge');
  const previousBackups = new Set(fs.existsSync(backupDirectory) ? fs.readdirSync(backupDirectory) : []);
  try {
    expect((await run({ storageUrl: url, before: '2026-11-01', apply: false })).eligible).toEqual(['old']);
    await expect(run({ storageUrl: url, before: '2026-11-01', apply: true,
      expectedRevision: '6', approvalRef: 'isolated-test' })).rejects.toThrow(/修订号已变化/);
    expect(writes).toHaveLength(0);
    const result = await run({ storageUrl: url, before: '2026-11-01', apply: true,
      expectedRevision: '7', approvalRef: 'isolated-test' });
    const backup = result.backup;
    expect(writes).toHaveLength(1);
    expect(writes[0].expected).toBe('7');
    expect(payload.templates.map(item => item.id)).toEqual(['live']);
    expect(payload.audits).toHaveLength(1);
    expect(fs.statSync(backup).mode & 0o777).toBe(0o600);
    const content = fs.readFileSync(backup);
    expect(crypto.createHash('sha256').update(content).digest('hex')).toBe(result.backupSha256);
    expect(JSON.parse(content).source.payload.templates).toHaveLength(2);
  } finally {
    for (const name of fs.existsSync(backupDirectory) ? fs.readdirSync(backupDirectory) : []) {
      if (!previousBackups.has(name)) fs.unlinkSync(require('node:path').join(backupDirectory, name));
    }
    await new Promise(resolve => server.close(resolve));
  }
});
