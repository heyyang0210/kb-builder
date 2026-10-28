const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { audit, collectReferences } = require('../../../tools/repository/audit-production-references.cjs');
const digest = 'a'.repeat(64);

test('引用扫描覆盖嵌套历史、字段引用、结构版本，并去重', () => {
  assert.deepEqual([...collectReferences({ history: [{ outlineVersionId: 42 }, { x: 'outline_old' }],
    baseOutlineVersionId: '', outlineStructureVersion: 'outline-v1-outline_old', other: null })].sort(), ['42', 'outline_old']);
});

test('只读HTTP盘点区分有效、缺失、已删除和未知，保留软删除历史且不泄漏正文', async t => {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push([req.method, req.url]);
    res.setHeader('content-type', 'application/json');
    if (req.url === '/v1/export') return res.end(JSON.stringify({ exportSchemaVersion: 1, records: [
      { namespace: 'handbook-production', key: 'private-key', revision: 2, deleted: false, sha256: digest,
        payload: { markdown: 'sensitive-body', outlineVersionId: 'active', history: [{ outlineVersionId: 'deleted' }, { outlineVersionId: 'missing' }, { outlineVersionId: 'unknown' }] } },
      { namespace: 'jobs', key: 'history-key', revision: 1, deleted: true, sha256: digest, payload: { outlineVersionId: 'deleted' } },
      { namespace: 'auth', key: 'secret', revision: 1, deleted: false, sha256: digest, payload: { outlineVersionId: 'never-query' } },
    ] }));
    const id = req.url.split('/')[4];
    if (id === 'missing') { res.statusCode = 404; return res.end(JSON.stringify({ error: { code: 'OUTLINE_NOT_FOUND' } })); }
    if (id === 'unknown') { res.statusCode = 503; return res.end(JSON.stringify({ error: { code: 'DATABASE_UNAVAILABLE' } })); }
    res.end(JSON.stringify({ success: true, data: { outlineId: id, deletedAt: id === 'deleted' ? '2026-10-01' : null } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const result = await audit(`http://127.0.0.1:${server.address().port}`);
  assert.equal(result.passed, false);
  assert.deepEqual(result.counts, { active: 1, deleted: 1, missing: 1, unknown: 1 });
  assert.equal(result.issues.find(x => x.state === 'deleted').owners.length, 2);
  assert.equal(result.excludedRecords, 1);
  assert.ok(requests.every(([method]) => method === 'GET'));
  assert.ok(requests.every(([, url]) => !url.includes('never-query')));
  const json = JSON.stringify(result);
  for (const secret of ['sensitive-body', 'private-key', 'history-key', 'never-query']) assert.ok(!json.includes(secret));
});

test('导出失败不产生通过结论', async t => {
  const server = http.createServer((req, res) => { res.statusCode = 503; res.end('{}'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  await assert.rejects(audit(`http://127.0.0.1:${server.address().port}`), /导出失败/);
});

test('仅在全部引用有效时通过，200错配身份仍记未知', async t => {
  let mismatch = false;
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/v1/export') return res.end(JSON.stringify({ exportSchemaVersion: 1, records: [
      { namespace: 'handbook-production', key: 'state', revision: 3, deleted: false, sha256: digest,
        payload: { drafts: { one: { outlineVersionId: 'valid' } }, aiJobs: { first: {} } } },
    ] }));
    res.end(JSON.stringify({ success: true, data: { outlineId: mismatch ? 'other' : 'valid', deletedAt: null } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const passed = await audit(base);
  assert.equal(passed.passed, true);
  assert.equal(passed.inventory[0].collections.drafts, 1);
  assert.equal(passed.inventory[0].collections.aiJobs, 1);
  mismatch = true;
  const failed = await audit(base);
  assert.equal(failed.passed, false);
  assert.equal(failed.counts.unknown, 1);
  assert.equal(failed.manifestDigest, passed.manifestDigest);
});
