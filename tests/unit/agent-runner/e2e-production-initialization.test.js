'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createHash } = require('node:crypto');
const { guard, initialize } = require('../../../tools/repository/initialize-e2e-production.cjs');
const fixtures = require('../../../config/knowledge-center/e2e-production-fixtures.json');
const sha = s => createHash('sha256').update(s).digest('hex');

test('rejects non-test or unowned storage before writes', () => {
  assert.throws(() => guard({ KNOWLEDGE_CENTER_ENVIRONMENT: 'production' }));
  assert.throws(() => guard({ KNOWLEDGE_CENTER_ENVIRONMENT: 'test', KNOWLEDGE_CENTER_E2E_INITIALIZE_PRODUCTION: '1',
    KNOWLEDGE_CENTER_TEST_RUN_ID: 'id', KNOWLEDGE_CENTER_RUN_OWNER: 'shared-instance' }));
});
async function exercise(t, conflict) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'production-init-'));
  const output = path.join(root, 'backup');
  const original = { schemaVersion: 1, drafts: { old: { outlineVersionId: 'outline_deleted', content: 'private-content' } } };
  const records = fixtures.map(f => ({ success: true, namespace: f.namespace, key: f.key, revision: 8, deleted: false,
    sha256: sha(JSON.stringify(original)), payload: original }));
  let puts = 0;
  const server = http.createServer(async (req, res) => {
    if (req.url === '/v1/export') {
      res.end(JSON.stringify({ exportSchemaVersion: 1, records })); return;
    }
    if (req.url.startsWith('/v1/domain/outlines/')) {
      if (conflict === 'unknown') { res.writeHead(503); res.end('{"success":false}'); return; }
      res.writeHead(409); res.end(JSON.stringify({ error: { code: 'OUTLINE_DELETED' } })); return;
    }
    const index = fixtures.findIndex(f => req.url === `/v1/records/${f.namespace}/${f.key}`);
    assert.ok(index >= 0);
    if (req.method === 'PUT') {
      // All originals must have been durably written before the first mutation.
      fixtures.forEach(f => {
        const backup = path.join(output, `${f.namespace}.backup.json`);
        assert.equal(fs.statSync(backup).mode & 0o777, 0o600);
        assert.deepEqual(JSON.parse(fs.readFileSync(backup)).payload, original);
      });
      assert.equal(fs.statSync(output).mode & 0o777, 0o700);
      assert.equal(req.headers['if-match'], '8'); puts++;
      if (conflict === true) { res.writeHead(409); res.end('{"success":false}'); return; }
      let body = ''; for await (const chunk of req) body += chunk;
      records[index] = { ...records[index], payload: JSON.parse(body), sha256: sha(body), revision: 9 };
    }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(records[index]));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); fs.rmSync(root, { recursive: true, force: true }); });
  const config = { base: `http://127.0.0.1:${server.address().port}`, output };
  if (conflict) {
    await assert.rejects(initialize(config));
    assert.equal(puts, conflict === 'unknown' ? 0 : 1); assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'report.json'))).passed, false);
  } else {
    assert.equal((await initialize(config)).passed, true); assert.equal(puts, 2);
    assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'references-before.json'))).counts.deleted, 1);
    assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'references-after.json'))).passed, true);
    assert.deepEqual(records.map(r => r.payload), fixtures.map(f => f.payload));
    await assert.rejects(initialize(config)); // Never overwrite prior backups or repeat resets.
    assert.equal(puts, 2);
  }
}
test('backs up all originals before CAS and verifies real HTTP readback', t => exercise(t, false));
test('CAS conflict stops further mutations and preserves failed stage evidence', t => exercise(t, true));
test('unknown reference state stops before the first mutation and preserves backups', t => exercise(t, 'unknown'));
