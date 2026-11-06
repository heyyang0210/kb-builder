// Run only with a test_hy isolated service and KC_STORAGE_URL set by tests/run_tests.py.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { DatabaseRecordStore } = require('../../../packages/agent-runner-core/lib/database-record-store');

const config = fs.readFileSync(path.resolve(__dirname, '../../../runtime/test-config/yashandb/service.env'), 'utf8');
assert.match(config, /^YASDB_USERNAME=["']?test_hy["']?$/m, '只允许 test_hy');
assert.ok(process.env.KNOWLEDGE_CENTER_TEST_RUN_ID, '必须由统一测试入口提供运行标识');
assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.KC_STORAGE_URL || ''), '必须使用本机隔离存储地址');

(async () => {
  const record = new DatabaseRecordStore({ baseUrl: process.env.KC_STORAGE_URL });
  const key = process.env.TEMPLATE_MAPPING_STORE_KEY || 'capacity-' + process.env.KNOWLEDGE_CENTER_TEST_RUN_ID + '-' + crypto.randomUUID();
  assert.ok(key.startsWith('capacity-'), '测试键必须独立于正式映射记录');
  const namespace = 'template-mappings';
  const handbookId = 'CAPACITY-' + crypto.randomUUID();
  const effective = Object.fromEntries(Array.from({ length: 500 }, (_, index) => {
    const documentId = 'doc-' + String(index).padStart(4, '0');
    return [encodeURIComponent(handbookId) + '|' + encodeURIComponent(documentId), { handbookId, documentId, templateId: 'template-test', status: 'active', version: 1 }];
  }));
  const initial = { version: 1, rules: [], batches: [], effective, audits: [] };
  let created = false;
  try {
    const written = await record.write(namespace, key, initial, 0);
    created = true;
    assert.equal(written.revision, 1);
    const timings = [];
    for (let sample = 0; sample < 20; sample++) {
      const started = performance.now();
      const snapshot = await record.read(namespace, key);
      const rows = Object.values(snapshot.payload.effective).filter(row => row.handbookId === handbookId).sort((a, b) => a.documentId.localeCompare(b.documentId));
      const page = rows.slice((sample % 5) * 100, (sample % 5 + 1) * 100);
      assert.equal(page.length, 100);
      timings.push(performance.now() - started);
    }
    const updateA = structuredClone(initial); updateA.version = 2;
    const updateB = structuredClone(initial); updateB.version = 3;
    const results = await Promise.allSettled([record.write(namespace, key, updateA, 1), record.write(namespace, key, updateB, 1)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1, '并发 CAS 只能成功一项');
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    const final = await record.read(namespace, key);
    assert.equal(final.revision, 2);
    timings.sort((a, b) => a - b);
    const apiTimings = [];
    if (process.env.KPG_BASE_URL) {
      const login = await fetch(process.env.KPG_BASE_URL + '/knowledge-center/api/auth/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin' }) });
      assert.equal(login.status, 200, '测试管理员登录必须成功');
      const cookie = login.headers.get('set-cookie')?.split(';')[0];
      assert.ok(cookie, '登录必须签发会话 Cookie');
      for (let sample = 0; sample < 20; sample++) {
        const started = performance.now();
        const url = new URL('/knowledge-center/api/templates/mappings', process.env.KPG_BASE_URL);
        url.searchParams.set('handbookId', handbookId);
        url.searchParams.set('cursor', String((sample % 5) * 100));
        url.searchParams.set('limit', '100');
        const response = await fetch(url, { headers: { cookie } });
        assert.equal(response.status, 200, '正式映射分页 API 必须返回 200');
        const body = await response.json();
        assert.equal(body.data.total, 500);
        assert.equal(body.data.items.length, 100);
        apiTimings.push(performance.now() - started);
      }
      apiTimings.sort((a, b) => a - b);
    }
    const report = { schema: 'test_hy', recordKey: key, count: 500, pageSize: 100, samples: timings.length, p95Ms: Number(timings[18].toFixed(1)), maxMs: Number(timings[19].toFixed(1)), apiP95Ms: apiTimings.length ? Number(apiTimings[18].toFixed(1)) : null, apiMaxMs: apiTimings.length ? Number(apiTimings[19].toFixed(1)) : null, cas: { success: 1, conflict: 1 }, generatedAt: new Date().toISOString() };
    const output = path.resolve(__dirname, '../../../runtime/test-results/template-management/database-capacity.json');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally {
    if (created) {
      const latest = await record.read(namespace, key);
      await record.delete(namespace, key, latest.revision);
      const removed = await record.read(namespace, key);
      assert.equal(removed.deleted, true, '测试记录必须清理');
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
