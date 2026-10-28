const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createHash } = require('node:crypto');
const { backup, restore } = require('../../../tools/repository/backup-production-content.cjs');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1EAAAAASUVORK5CYII=', 'base64');
async function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'production-backup-'));
  const attachments = path.join(root, 'live-attachments'); const images = path.join(root, 'live-images');
  fs.mkdirSync(attachments); fs.mkdirSync(images); fs.mkdirSync(path.join(attachments, 'delivery-images'));
  const digest = hash(png); fs.writeFileSync(path.join(attachments, 'delivery-images', digest), png);
  const content = '# 私有正文'; const file = '私有附件';
  fs.writeFileSync(path.join(attachments, 'file.txt'), file);
  const context = { handbookId: 'handbook', outlineVersionId: 'outline', branch: 'main', documentId: 'doc' };
  const key = Object.values(context).map(encodeURIComponent).join('|');
  const records = [
    { namespace: 'handbook-production', payload: {
      drafts: { [key]: { context, draftId: 'draft', currentRevisionId: 'revision', revisions: [{ revisionId: 'revision', markdown: content, contentDigest: hash(content), attachmentIds: ['file'] }] } },
      attachments: { file: { storageName: 'file.txt', size: Buffer.byteLength(file), digest: hash(file) } }, aiSources: {}, aiJobs: {}, reviewBatches: [],
    } },
    { namespace: 'production-ai-artifacts', payload: { artifacts: {} } },
    { namespace: 'incremental', payload: { tasks: [{ id: 'task', candidate: { digest: hash(content), content, operations: [] },
      handbookSource: { content, operations: [], documents: [{ resources: [{ delivery: 'create', path: `docs/assets/${digest}.png`, contentDigest: digest, size: png.length }] }] } }] } },
  ].map(r => ({ ...r, key: 'state', revision: 1, deleted: false, sha256: hash(JSON.stringify(r.payload)) }));
  const requests = []; let hook = () => {};
  const server = http.createServer((req, res) => {
    requests.push([req.method, req.url]); hook(requests.length);
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ exportSchemaVersion: 1, records }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); fs.rmSync(root, { recursive: true, force: true }); });
  const options = { base: `http://127.0.0.1:${server.address().port}`, output: path.join(root, 'backup'), attachmentRoot: attachments, sourceImageRoot: images };
  return { root, attachments, images, records, requests, digest, options, setHook: fn => { hook = fn; } };
}
test('真实HTTP只读备份并恢复正文、附件和历史任务冻结图，源删除后仍可离线核验', async t => {
  const ctx = await setup(t); const result = await backup(ctx.options);
  assert.equal(result.passed, true); assert.equal(fs.statSync(ctx.options.output).mode & 0o777, 0o700);
  assert.equal(fs.statSync(path.join(ctx.options.output, 'records.json')).mode & 0o777, 0o600);
  fs.unlinkSync(path.join(ctx.attachments, 'delivery-images', ctx.digest));
  const restored = path.join(ctx.root, 'restore');
  assert.deepEqual(await restore({ backupRoot: ctx.options.output, output: restored }), {
    schemaVersion: 1, scope: 'offline_production_content_restore', passed: true, databaseRestored: false,
  });
  assert.deepEqual(fs.readFileSync(path.join(restored, 'attachments/delivery-images', ctx.digest)), png);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(restored, 'records.json'))).records, ctx.records);
  assert.deepEqual(ctx.requests, Array(4).fill(['GET', '/v1/export']));
  assert.ok(!JSON.stringify(result).includes('私有'));
  await assert.rejects(restore({ backupRoot: ctx.options.output, output: restored }), /EEXIST/);
  await assert.rejects(backup(ctx.options), /EEXIST/);
});
test('聚合revision并发变化停止封存，保存失败阶段报告且不生成可恢复清单', async t => {
  const ctx = await setup(t); ctx.setHook(count => { if (count === 3) ctx.records[2].revision++; });
  await assert.rejects(backup(ctx.options), /AGGREGATE_CHANGED/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(ctx.options.output, 'report.json'))).stable, false);
  assert.equal(fs.existsSync(path.join(ctx.options.output, 'manifest.json')), false);
});
test('文件字节并发变化停止封存，不能仅凭聚合revision相同放行', async t => {
  const ctx = await setup(t); ctx.setHook(count => { if (count === 3) fs.writeFileSync(path.join(ctx.attachments, 'file.txt'), 'changed'); });
  await assert.rejects(backup(ctx.options), /FILES_CHANGED/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(ctx.options.output, 'report.json'))).passed, false);
});
test('缺失目录保留不完整备份，不伪造源目录，恢复拒绝且不创建目标', async t => {
  const ctx = await setup(t); const missing = path.join(ctx.root, 'missing');
  const result = await backup({ ...ctx.options, sourceImageRoot: missing });
  assert.equal(result.copied, true); assert.equal(result.stable, true); assert.equal(result.inventoryPassed, false); assert.equal(result.passed, false);
  assert.equal(fs.existsSync(missing), false);
  const output = path.join(ctx.root, 'restore');
  await assert.rejects(restore({ backupRoot: ctx.options.output, output }), /INCOMPLETE_BACKUP/);
  assert.equal(fs.existsSync(output), false);
});
test('封存后图片或正文篡改均在创建恢复目录前阻断', async t => {
  const ctx = await setup(t); await backup(ctx.options);
  const image = path.join(ctx.options.output, 'attachments/delivery-images', ctx.digest);
  fs.writeFileSync(image, 'corrupted');
  const output = path.join(ctx.root, 'restore');
  await assert.rejects(restore({ backupRoot: ctx.options.output, output }), /BACKUP_CHANGED/);
  assert.equal(fs.existsSync(output), false); fs.writeFileSync(image, png);
  fs.appendFileSync(path.join(ctx.options.output, 'records.json'), ' ');
  await assert.rejects(restore({ backupRoot: ctx.options.output, output })); assert.equal(fs.existsSync(output), false);
});
test('符号链接和输出重叠拒绝，保留源文件且无数据库写入', async t => {
  const ctx = await setup(t);
  await assert.rejects(backup({ ...ctx.options, output: path.join(ctx.attachments, 'backup') }), /OVERLAPPING_PATHS/);
  fs.symlinkSync(path.join(ctx.attachments, 'file.txt'), path.join(ctx.images, 'linked'));
  await assert.rejects(backup(ctx.options), /UNSAFE_ENTRY/);
  assert.equal(fs.readFileSync(path.join(ctx.attachments, 'file.txt'), 'utf8'), '私有附件');
  assert.ok(ctx.requests.every(([method]) => method === 'GET'));
});
test('孤立资源不删除且不能作为业务完整备份通过', async t => {
  const ctx = await setup(t); fs.writeFileSync(path.join(ctx.images, 'orphan'), png);
  const result = await backup(ctx.options); assert.equal(result.passed, false);
  assert.deepEqual(fs.readFileSync(path.join(ctx.options.output, 'source-images/orphan')), png);
  assert.equal(fs.existsSync(path.join(ctx.images, 'orphan')), true);
});

test('最终聚合复核发现文件复核期间的变更，同样不封存', async t => {
  const ctx = await setup(t); ctx.setHook(count => { if (count === 4) ctx.records[0].revision++; });
  await assert.rejects(backup(ctx.options), /AGGREGATE_CHANGED/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(ctx.options.output, 'report.json'))).passed, false);
  assert.equal(fs.existsSync(path.join(ctx.options.output, 'manifest.json')), false);
});
