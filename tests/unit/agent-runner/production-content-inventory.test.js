const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { inventory } = require('../../../tools/repository/inventory-production-content.cjs');
const hash = value => createHash('sha256').update(value).digest('hex');
const context = { handbookId: 'private-handbook', outlineVersionId: 'private-outline', branch: 'main', documentId: 'private-doc' };
const draftKey = Object.values(context).map(encodeURIComponent).join('|');
const secret = 'private-markdown-正文';
const artifact = { artifactId: 'secret-artifact', stageId: 'evidence', contractVersion: 1, value: { text: secret }, digest: hash(JSON.stringify({ text: secret })) };
function baseline() {
  const revision = { revisionId: 'private-revision', markdown: secret, contentDigest: hash(secret), attachmentIds: ['private-attachment'] };
  return [
    { namespace: 'handbook-production', key: 'state', revision: 2, deleted: false, sha256: hash('aggregate'), payload: {
      drafts: { [draftKey]: { context, draftId: 'private-draft', currentRevisionId: revision.revisionId, reviewRevisionIds: [revision.revisionId], revisions: [revision] } },
      attachments: { 'private-attachment': { storageName: 'private-file.md', size: Buffer.byteLength(secret), digest: hash(secret) } },
      reviewBatches: [{ documents: [{ draftId: 'private-draft', draftRevisionId: revision.revisionId }] }],
      aiSources: { 'private-source': { content: secret, contentDigest: hash(secret) } },
      aiJobs: { 'private-job': { originalMarkdown: secret, originalDigest: hash(secret), sourceSnapshots: [{ sourceId: 'dynamic-mcp' }], artifacts: { records: { evidence: { ...artifact, value: undefined } } } } },
    } },
    { namespace: 'production-ai-artifacts', key: 'state', revision: 1, deleted: false, sha256: hash('artifacts'), payload: { artifacts: { [artifact.artifactId]: artifact } } },
    { namespace: 'incremental', key: 'state', revision: 1, deleted: false, sha256: hash('incremental'), payload: { tasks: [] } },
  ];
}
async function setup(t, records = baseline()) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-inventory-'));
  const requests = [];
  let body = { exportSchemaVersion: 1, records };
  const server = http.createServer((req, res) => {
    requests.push([req.method, req.url]);
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); fs.rmSync(dir, { recursive: true, force: true }); });
  return { base: `http://127.0.0.1:${server.address().port}`, dir, requests, setBody: value => { body = value; } };
}
test('真实GET盘点正文、历史和审核冻结版本，动态MCP不误判；报告脱敏且文件核验缺省不通过', async t => {
  const rows = baseline();
  const draft = rows[0].payload.drafts[draftKey];
  draft.revisions.push({ ...draft.revisions[0], revisionId: 'new-revision' }); draft.currentRevisionId = 'new-revision';
  const ctx = await setup(t, rows);
  const report = await inventory(ctx.base);
  assert.equal(report.logicalPassed, true); assert.equal(report.passed, false); assert.equal(report.complete, false);
  assert.equal(report.counts.currentRevisions, 1); assert.equal(report.counts.historicalRevisions, 1);
  assert.equal(report.content.revisionMarkdown.bytes, Buffer.byteLength(secret) * 2);
  assert.equal(report.content.revisionMarkdown.duplicateItems, 1);
  assert.equal(report.counts.unreferencedArtifacts, 0);
  assert.deepEqual(ctx.requests, [['GET', '/v1/export']]);
  const serialized = JSON.stringify(report);
  for (const value of [secret, 'private-', 'secret-artifact', ctx.dir, 'dynamic-mcp']) assert.ok(!serialized.includes(value));
});
test('显式本机附件逐字节核验、重复产物只登记未引用，不自动删除', async t => {
  const rows = baseline();
  rows[1].payload.artifacts.unused = { ...artifact, artifactId: 'unused' };
  const ctx = await setup(t, rows); fs.writeFileSync(path.join(ctx.dir, 'private-file.md'), secret);
  const report = await inventory(ctx.base, { attachmentRoot: ctx.dir });
  assert.equal(report.passed, false); assert.equal(report.sourceImages.physical.status, 'not_checked'); assert.equal(report.physical.files, 1);
  assert.equal(report.physical.bytes, Buffer.byteLength(secret)); assert.equal(report.counts.unreferencedArtifacts, 1);
  assert.equal(report.content.artifactValue.duplicateGroups, 1);
  assert.equal(fs.readFileSync(path.join(ctx.dir, 'private-file.md'), 'utf8'), secret);
});
test('缺失修订/附件/任务产物、摘要损坏、审核引用异常均定位哈希', async t => {
  const rows = baseline(); const state = rows[0].payload;
  state.drafts[draftKey].currentRevisionId = 'absent';
  state.drafts[draftKey].revisions[0].contentDigest = hash('wrong');
  state.drafts[draftKey].revisions[0].attachmentIds.push('absent');
  state.reviewBatches[0].documents[0].draftRevisionId = 'absent';
  rows[1].payload.artifacts = {};
  const ctx = await setup(t, rows); const report = await inventory(ctx.base, { attachmentRoot: ctx.dir });
  const codes = report.issues.map(x => x.code);
  for (const code of ['CONTENT_DIGEST_MISMATCH', 'MISSING_CURRENT_REVISION', 'MISSING_REVISION_ATTACHMENT', 'MISSING_BATCH_REVISION', 'MISSING_JOB_ARTIFACT', 'MISSING_ATTACHMENT_FILE']) assert.ok(codes.includes(code), code);
  assert.equal(report.passed, false); assert.equal(report.logicalPassed, false);
  assert.ok(report.issues.every(x => /^[a-f0-9]{64}$/.test(x.idHash)));
});
test('文件篡改、孤立文件、路径穿越和符号链接不被当作有效附件', async t => {
  const rows = baseline(); const ctx = await setup(t, rows);
  rows[0].payload.attachments.traversal = { storageName: '../escape', size: 1, digest: hash('x') };
  rows[0].payload.attachments.link = { storageName: 'link', size: 1, digest: hash('x') };
  fs.writeFileSync(path.join(ctx.dir, 'private-file.md'), 'wrong');
  fs.writeFileSync(path.join(ctx.dir, 'orphan-secret'), secret);
  fs.symlinkSync('/etc/passwd', path.join(ctx.dir, 'link'));
  const report = await inventory(ctx.base, { attachmentRoot: ctx.dir });
  const codes = report.issues.map(x => x.code);
  for (const code of ['UNSAFE_ATTACHMENT_NAME', 'UNREADABLE_ATTACHMENT_FILE', 'ATTACHMENT_DIGEST_MISMATCH', 'ATTACHMENT_SIZE_MISMATCH', 'UNREFERENCED_ATTACHMENT_FILE', 'UNSCANNED_ATTACHMENT_ENTRY']) assert.ok(codes.includes(code), code);
  assert.equal(report.physical.files, 1); assert.equal(report.physical.unreferenced, 1);
  assert.ok(!JSON.stringify(report).includes('orphan-secret'));
});
test('旧内嵌产物保留兼容，引用身份不一致被识别', async t => {
  const rows = baseline(); rows[1].payload.artifacts = {};
  rows[0].payload.aiJobs['private-job'].artifacts.records.evidence = { ...artifact };
  const ctx = await setup(t, rows);
  const report = await inventory(ctx.base); assert.equal(report.logicalPassed, true); assert.equal(report.counts.embeddedArtifacts, 1);
  rows[0].payload.aiJobs['private-job'].artifacts.records.evidence.stageId = 'wrong';
  assert.ok((await inventory(ctx.base)).issues.some(x => x.code === 'ARTIFACT_REFERENCE_MISMATCH'));
});
test('协议失败、重复聚合及不安全根目录不能产生盘点通过报告', async t => {
  const rows = baseline(); const ctx = await setup(t, rows);
  ctx.setBody({ exportSchemaVersion: 2, records: rows }); await assert.rejects(inventory(ctx.base), /INVALID_EXPORT/);
  ctx.setBody({ exportSchemaVersion: 1, records: [...rows, rows[0]] }); await assert.rejects(inventory(ctx.base), /INVALID_AGGREGATE/);
  ctx.setBody({ exportSchemaVersion: 1, records: rows });
  fs.mkdirSync(path.join(ctx.dir, 'real')); fs.symlinkSync(path.join(ctx.dir, 'real'), path.join(ctx.dir, 'alias'));
  await assert.rejects(inventory(ctx.base, { attachmentRoot: path.join(ctx.dir, 'alias') }), /UNSAFE_ATTACHMENT_ROOT/);
  rows[0].payload.drafts = []; await assert.rejects(inventory(ctx.base), /INVALID_COLLECTION/);
});

test('缺少本机附件目录保留未执行状态，失效上下文不能通过逻辑盘点', async t => {
  const rows = baseline(); const ctx = await setup(t, rows);
  const report = await inventory(ctx.base, { attachmentRoot: path.join(ctx.dir, 'not-present') });
  assert.equal(report.physical.status, 'root_unavailable'); assert.equal(report.complete, false);
  assert.equal(report.physical.files, 0); assert.equal(report.passed, false);
  assert.ok(report.issues.some(x => x.code === 'ATTACHMENT_ROOT_UNAVAILABLE'));
  delete rows[0].payload.drafts[draftKey].context;
  assert.ok((await inventory(ctx.base)).issues.some(x => x.code === 'INVALID_DRAFT_CONTEXT'));
});

test('CLI报告0600独占落盘，重复运行不覆盖证据或跟随输出链接', async t => {
  const ctx = await setup(t);
  const run = require('node:util').promisify(require('node:child_process').execFile);
  const output = path.join(ctx.dir, 'report.json');
  const options = { env: { ...process.env, YASDB_STORAGE_URL: ctx.base, KC_CONTENT_INVENTORY_OUTPUT: output, KC_ATTACHMENT_ROOT: '' } };
  const script = path.resolve(__dirname, '../../../tools/repository/inventory-production-content.cjs');
  await assert.rejects(run(process.execPath, [script], options), error => error.code === 1);
  const original = fs.readFileSync(output, 'utf8');
  assert.equal(fs.statSync(output).mode & 0o777, 0o600);
  assert.equal(JSON.parse(original).physical.status, 'not_checked');
  await assert.rejects(run(process.execPath, [script], options), error => error.code === 1);
  assert.equal(fs.readFileSync(output, 'utf8'), original);
  const link = path.join(ctx.dir, 'output-link'); fs.symlinkSync(output, link);
  await assert.rejects(run(process.execPath, [script], { env: { ...options.env, KC_CONTENT_INVENTORY_OUTPUT: link } }), error => error.code === 1);
  assert.equal(fs.readFileSync(output, 'utf8'), original);
});

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const hostedImage = () => ({ status: 'ready', assetId: hash(png), contentDigest: hash(png), contentType: 'image/png', bytes: png.length, url: 'https://private-host/image?signed=secret' });
async function imageSetup(t, rows = baseline()) {
  const ctx = await setup(t, rows);
  const attachmentRoot = path.join(ctx.dir, 'attachments'); const sourceImageRoot = path.join(ctx.dir, 'images');
  fs.mkdirSync(attachmentRoot); fs.mkdirSync(sourceImageRoot);
  fs.mkdirSync(path.join(attachmentRoot, 'delivery-images'));
  fs.writeFileSync(path.join(attachmentRoot, 'private-file.md'), secret);
  fs.writeFileSync(path.join(sourceImageRoot, hash(png)), png);
  return { ...ctx, attachmentRoot, sourceImageRoot };
}
test('来源/任务/所有历史修订图片并集按摘要去重，文件签名核验且报告脱敏', async t => {
  const rows = baseline(); const state = rows[0].payload;
  const source = { imageResources: [hostedImage()] };
  state.aiSources['private-source'].imageResources = [hostedImage(), { status: 'failed', errorCode: 'unavailable' }];
  state.aiJobs['private-job'].sourceSnapshots.push(source);
  const draft = state.drafts[draftKey];
  draft.revisions[0].generationMetadata = { sourceSnapshots: [source] };
  draft.revisions.push({ ...draft.revisions[0], revisionId: 'new-current', generationMetadata: {} });
  draft.currentRevisionId = 'new-current';
  const ctx = await imageSetup(t, rows); const before = JSON.stringify(rows);
  const report = await inventory(ctx.base, ctx);
  assert.equal(report.schemaVersion, 4); assert.equal(report.passed, true); assert.equal(report.complete, true);
  assert.equal(report.sourceImages.readyReferences, 3); assert.equal(report.sourceImages.failedReferences, 1);
  assert.deepEqual(report.sourceImages.referencesByLocation, { sources: 2, jobs: 1, revisions: 1 });
  assert.equal(report.sourceImages.uniqueAssets, 1); assert.equal(report.sourceImages.declaredBytes, png.length);
  assert.equal(report.sourceImages.physical.files, 1); assert.equal(report.sourceImages.physical.bytes, png.length);
  for (const value of [secret, ctx.dir, 'private-', 'private-host', 'signed=secret']) assert.ok(!JSON.stringify(report).includes(value));
  assert.equal(JSON.stringify(rows), before); assert.deepEqual(ctx.requests, [['GET', '/v1/export']]);
});
test('仅在任务和历史版本保存的图片同样核验，缺失/篡改/错误类型和孤立图片阻断', async t => {
  const rows = baseline(); const state = rows[0].payload;
  state.aiJobs['private-job'].sourceSnapshots = [{ imageResources: [hostedImage()] }];
  const missing = { ...hostedImage(), assetId: hash('missing'), contentDigest: hash('missing') };
  state.drafts[draftKey].revisions[0].generationMetadata = { sourceSnapshots: [{ imageResources: [missing] }] };
  const ctx = await imageSetup(t, rows);
  fs.writeFileSync(path.join(ctx.sourceImageRoot, hash(png)), 'wrong');
  fs.writeFileSync(path.join(ctx.sourceImageRoot, hash('orphan')), 'private-orphan');
  const report = await inventory(ctx.base, ctx); const codes = report.issues.map(x => x.code);
  for (const code of ['SOURCE_IMAGE_SIZE_MISMATCH', 'SOURCE_IMAGE_DIGEST_MISMATCH', 'SOURCE_IMAGE_TYPE_MISMATCH', 'MISSING_SOURCE_IMAGE_FILE', 'UNREFERENCED_SOURCE_IMAGE_FILE']) assert.ok(codes.includes(code), code);
  assert.equal(report.passed, false); assert.equal(report.sourceImages.physical.missing, 1);
  assert.equal(fs.readFileSync(path.join(ctx.sourceImageRoot, hash('orphan')), 'utf8'), 'private-orphan');
});
test('图片元数据冲突、非法摘要/集合不放行，来源失败与未检查实物分别呈现', async t => {
  const rows = baseline(); const state = rows[0].payload;
  state.aiSources['private-source'].imageResources = [hostedImage(), { ...hostedImage(), bytes: 50 }, { ...hostedImage(), assetId: '../escape' }, { status: 'failed' }];
  state.aiJobs['private-job'].sourceSnapshots = {};
  const ctx = await imageSetup(t, rows);
  let report = await inventory(ctx.base, { attachmentRoot: ctx.attachmentRoot });
  for (const code of ['SOURCE_IMAGE_METADATA_CONFLICT', 'INVALID_SOURCE_IMAGE_METADATA', 'INVALID_IMAGE_SOURCE_SNAPSHOTS']) assert.ok(report.issues.some(x => x.code === code));
  assert.equal(report.logicalPassed, false); assert.equal(report.sourceImages.failedReferences, 1);
  assert.equal(report.sourceImages.physical.status, 'not_checked'); assert.equal(report.complete, false);
  report = await inventory(ctx.base, { ...ctx, sourceImageRoot: path.join(ctx.dir, 'absent') });
  assert.equal(report.sourceImages.physical.status, 'root_unavailable'); assert.equal(report.passed, false);
  assert.ok(report.issues.some(x => x.code === 'SOURCE_IMAGE_ROOT_UNAVAILABLE'));
  assert.equal(fs.existsSync(path.join(ctx.dir, 'absent')), false);
});
test('图片目录祖先链接被拒绝，图片文件链接不能读取目标', async t => {
  const rows = baseline(); rows[0].payload.aiSources['private-source'].imageResources = [hostedImage()];
  const ctx = await imageSetup(t, rows);
  const alias = path.join(ctx.dir, 'alias'); fs.symlinkSync(ctx.sourceImageRoot, alias);
  await assert.rejects(inventory(ctx.base, { ...ctx, sourceImageRoot: alias }), /UNSAFE_ATTACHMENT_ROOT/);
  fs.unlinkSync(path.join(ctx.sourceImageRoot, hash(png)));
  fs.symlinkSync(path.join(ctx.attachmentRoot, 'private-file.md'), path.join(ctx.sourceImageRoot, hash(png)));
  const report = await inventory(ctx.base, ctx);
  assert.equal(report.sourceImages.physical.files, 0); assert.equal(report.passed, false);
  assert.ok(report.issues.some(x => x.code === 'UNREADABLE_SOURCE_IMAGE_FILE'));
});
test('无图片元数据仍须枚举权威图片目录才可通过，不能把未检查当作无资源', async t => {
  const ctx = await imageSetup(t); fs.unlinkSync(path.join(ctx.sourceImageRoot, hash(png)));
  const report = await inventory(ctx.base, ctx);
  assert.equal(report.sourceImages.uniqueAssets, 0); assert.equal(report.sourceImages.physical.status, 'checked');
  assert.equal(report.passed, true);
});

test('历史正文和HTML图片按结构解析，内部缺失元数据阻断且报告不泄露URL', async t => {
  const rows = baseline(); const state = rows[0].payload;
  const revision = state.drafts[draftKey].revisions[0];
  revision.markdown = [
    '![附件](/knowledge-center/api/production/attachments/private-attachment)',
    '![缺失](/knowledge-center/api/production/attachments/missing-secret)',
    '```md',
    '![代码示例](/knowledge-center/api/production/attachments/code-only)',
    '```',
    '![外部](https://private-host.example/image.png?token=secret)',
  ].join('\n');
  revision.contentDigest = hash(revision.markdown);
  revision.htmlSnapshot = '<img data-src="/knowledge-center/api/production/handbooks/h/documents/d/ai-sources/images/missing-asset" /><img srcset="relative-a.png 1x, relative-b.png 2x" />';
  const ctx = await setup(t, rows);
  const report = await inventory(ctx.base);
  assert.deepEqual(report.imageLinks.byLocation, { revisions: 3, htmlSnapshots: 2, sources: 0, jobs: 0 });
  assert.equal(report.imageLinks.attachment, 2);
  assert.equal(report.imageLinks.sourceImage, 1);
  assert.equal(report.imageLinks.external, 1);
  assert.equal(report.imageLinks.relative, 1);
  assert.equal(report.imageLinks.uncheckedSrcsetCandidates, 1);
  assert.ok(report.unchecked.includes('external_image_bytes_and_availability'));
  assert.equal(report.logicalPassed, false);
  assert.ok(report.issues.some(item => item.code === 'MISSING_IMAGE_ATTACHMENT_METADATA'));
  assert.ok(report.issues.some(item => item.code === 'MISSING_IMAGE_SOURCE_METADATA'));
  for (const value of ['private-host.example', 'missing-secret', 'missing-asset', 'relative-a.png']) assert.ok(!JSON.stringify(report).includes(value));
});

test('已结束增量任务的托管图片保留引用并逐字节盘点，缺失和篡改不放行', async t => {
  const rows = baseline();
  const resource = { path: `docs/assets/${hash(png)}.png`, size: png.length, contentDigest: hash(png), delivery: 'create', snapshotVersion: 'v1' };
  rows[2].payload.tasks = [
    { id: 'private-old-task', state: 'mr_submitted', candidate: { digest: hash('candidate') }, handbookSource: { documents: [{ resources: [resource] }] } },
    { id: 'private-closed-task', state: 'published', candidate: { digest: hash('other') }, handbookSource: { documents: [{ resources: [resource] }] } },
  ];
  const ctx = await imageSetup(t, rows);
  fs.unlinkSync(path.join(ctx.sourceImageRoot, hash(png)));
  const frozen = path.join(ctx.attachmentRoot, 'delivery-images', hash(png));
  fs.writeFileSync(frozen, png);
  let report = await inventory(ctx.base, ctx);
  assert.equal(report.passed, true); assert.equal(report.deliveryImages.references, 2);
  assert.equal(report.deliveryImages.uniqueAssets, 1); assert.equal(report.deliveryImages.physical.files, 1);
  assert.deepEqual(ctx.requests, [['GET', '/v1/export']]);
  assert.ok(!JSON.stringify(report).includes('private-old-task'));
  fs.writeFileSync(frozen, 'changed');
  report = await inventory(ctx.base, ctx);
  assert.equal(report.passed, false);
  for (const code of ['DELIVERY_IMAGE_SIZE_MISMATCH', 'DELIVERY_IMAGE_DIGEST_MISMATCH', 'DELIVERY_IMAGE_TYPE_MISMATCH']) assert.ok(report.issues.some(item => item.code === code), code);
  fs.unlinkSync(frozen);
  report = await inventory(ctx.base, ctx);
  assert.ok(report.issues.some(item => item.code === 'MISSING_DELIVERY_IMAGE_FILE'));
  assert.equal(report.passed, false);
});

test('增量聚合、资源清单和交付目录缺失不能形成完整盘点', async t => {
  const rows = baseline(); const ctx = await imageSetup(t, rows);
  const missingAggregate = rows.pop();
  await assert.rejects(inventory(ctx.base, ctx), /INVALID_AGGREGATE/);
  rows.push(missingAggregate);
  rows[2].payload.tasks.push({ id: 'private-task', candidate: { digest: hash('candidate') }, handbookSource: { documents: [{}] } });
  let report = await inventory(ctx.base, ctx);
  assert.ok(report.issues.some(item => item.code === 'MISSING_DELIVERY_RESOURCE_MANIFEST'));
  assert.equal(report.logicalPassed, false);
  rows[2].payload.tasks[0].candidate.content = 'candidate';
  rows[2].payload.tasks[0].handbookSource.content = 'different';
  report = await inventory(ctx.base, ctx);
  assert.ok(report.issues.some(item => item.code === 'HANDBOOK_CANDIDATE_SOURCE_MISMATCH'));
  rows[2].payload.tasks = [];
  fs.rmdirSync(path.join(ctx.attachmentRoot, 'delivery-images'));
  report = await inventory(ctx.base, ctx);
  assert.equal(report.deliveryImages.physical.status, 'root_unavailable');
  assert.equal(report.complete, false); assert.equal(report.passed, false);
});
