const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const base = process.env.KC_TEST_STORAGE_URL;
const enabled = Boolean(base && process.env.KC_TEST_ISOLATED_SCHEMA === '1');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

async function request(method, path, body, key = crypto.randomUUID()) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

async function ok(method, path, body, key) {
  const response = await request(method, path, body, key);
  assert.ok(response.status >= 200 && response.status < 300, JSON.stringify(response));
  return response.body.data;
}

test('隔离库：来源同步、次要事项、幂等重放与版本冲突', { skip: !enabled }, async () => {
  const config = await ok('GET', '/v1/document-tasks/config');
  assert.ok(config.defaultOwnerId, '隔离库需要先配置默认责任人');
  const suffix = Date.now();
  const number = `YDBRD-${suffix}`;
  const source = await ok('POST', '/v1/pingcode-task-sync/sources', {
    name: `隔离自动验收-${suffix}`, type: 'TICKET',
    url: `https://pingcode.yasdb.com/pjm/projects/YDBRD/defect/test-${suffix}`,
    connectionId: 'isolated-test', actor: config.defaultOwnerId,
  });
  const run = await ok('POST', `/v1/pingcode-task-sync/sources/${source.id}/runs`,
    { revision: source.revision, actor: config.defaultOwnerId });
  await ok('POST', `/v1/pingcode-task-sync/runs/${run.id}/pages`, {
    pageIndex: 0, pageCount: 1, count: 1, sourceVersion: 'isolated-test-v1',
    criteriaSha256: hash('isolated-criteria'), sourceType: 'ticket',
    items: [{ number, id: `upstream-${suffix}`, shortId: `short-${suffix}`,
      title: '隔离验收工单', description: '## 正文\n\n测试内容。' }],
  });
  const ready = await ok('POST', `/v1/pingcode-task-sync/runs/${run.id}/finish`, { digest: hash('isolated-run') });
  const preview = await ok('GET', `/v1/pingcode-task-sync/runs/${run.id}/preview`);
  assert.equal(preview.items[0].action, 'created');
  await ok('POST', `/v1/pingcode-task-sync/runs/${run.id}/confirm`,
    { digest: ready.digest, expectedRevision: source.revision, primarySources: {} });
  const imported = await ok('GET', `/v1/document-tasks/${number}`);
  assert.equal(imported.sourceType, 'TICKET');
  assert.equal(imported.ownerId, config.defaultOwnerId);
  const taskList = await ok('GET', `/v1/document-tasks?q=${number}`);
  assert.equal(taskList.total, 1, '确认的 PingCode SR 应进入任务管理列表');
  assert.ok(taskList.items.some(item => item.number === number), '任务管理列表应回读确认后的 SR 编号');
  const firstSnapshot = await ok('GET', `/v1/pingcode-task-sync/tasks/${number}/source`);
  assert.equal(firstSnapshot.markdown, '## 正文\n\n测试内容。');
  assert.equal(firstSnapshot.sourceId, source.id);

  const key = `isolated-write-${crypto.randomUUID()}`;
  const initialTask = { ...imported, description: '首次写入' };
  const firstBody = { task: initialTask, expectedRowVersion: imported.rowVersion,
    idempotencyKey: key, requestSha256: hash(JSON.stringify(initialTask)), response: { message: '首次响应' } };
  const first = await request('PUT', `/v1/document-tasks/${number}`, firstBody, key);
  assert.equal(first.status, 200);
  const secondTask = { ...first.body.data, description: '后续写入' };
  await ok('PUT', `/v1/document-tasks/${number}`, { task: secondTask,
    expectedRowVersion: first.body.data.rowVersion, idempotencyKey: `${key}-later`,
    requestSha256: hash(JSON.stringify(secondTask)) }, `${key}-later`);
  const replay = await request('PUT', `/v1/document-tasks/${number}`, firstBody, key);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.data.rowVersion, first.body.data.rowVersion);
  assert.equal(replay.body.data.description, '首次写入');
  const replayRecord = await ok('GET', `/v1/document-tasks/writes/${key}`);
  assert.deepEqual(replayRecord.result, { message: '首次响应' });
  const staleKey = `${key}-stale`;
  const stale = await request('PUT', `/v1/document-tasks/${number}`,
    { task: initialTask, expectedRowVersion: imported.rowVersion,
      idempotencyKey: staleKey, requestSha256: hash('stale') }, staleKey);
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, 'DOCUMENT_TASK_VERSION_CONFLICT');

  const currentSource = await ok('GET', `/v1/pingcode-task-sync/sources/${source.id}`);
  const removal = await ok('POST', `/v1/pingcode-task-sync/sources/${source.id}/runs`,
    { revision: currentSource.revision, actor: config.defaultOwnerId });
  await ok('POST', `/v1/pingcode-task-sync/runs/${removal.id}/pages`, {
    pageIndex: 0, pageCount: 0, count: 0, sourceVersion: 'isolated-test-v1',
    criteriaSha256: hash('isolated-criteria'), sourceType: 'ticket', items: [],
  });
  const removalReady = await ok('POST', `/v1/pingcode-task-sync/runs/${removal.id}/finish`, { digest: hash('isolated-empty') });
  await ok('POST', `/v1/pingcode-task-sync/runs/${removal.id}/confirm`,
    { digest: removalReady.digest, expectedRevision: currentSource.revision, primarySources: {} });
  const secondary = await ok('GET', `/v1/document-tasks?q=${number}&attention=secondary`);
  const normal = await ok('GET', `/v1/document-tasks?q=${number}`);
  assert.equal(secondary.total, 1);
  assert.equal(normal.total, 0);

  const restoredSource = await ok('GET', `/v1/pingcode-task-sync/sources/${source.id}`);
  const restoration = await ok('POST', `/v1/pingcode-task-sync/sources/${source.id}/runs`,
    { revision: restoredSource.revision, actor: config.defaultOwnerId });
  await ok('POST', `/v1/pingcode-task-sync/runs/${restoration.id}/pages`, {
    pageIndex: 0, pageCount: 1, count: 1, sourceVersion: 'isolated-test-v1',
    criteriaSha256: hash('isolated-criteria'), sourceType: 'ticket',
    items: [{ number, id: `upstream-${suffix}`, shortId: `short-${suffix}`,
      title: '隔离验收工单', description: '## 正文\n\n测试内容。' }],
  });
  const restoredReady = await ok('POST', `/v1/pingcode-task-sync/runs/${restoration.id}/finish`,
    { digest: hash('isolated-restore') });
  await ok('POST', `/v1/pingcode-task-sync/runs/${restoration.id}/confirm`,
    { digest: restoredReady.digest, expectedRevision: restoredSource.revision, primarySources: {} });
  assert.equal((await ok('GET', `/v1/document-tasks/${number}`)).attention, 'NORMAL');

  const requirement = await ok('POST', '/v1/pingcode-task-sync/sources', {
    name: `隔离需求-${suffix}`, type: 'REQUIREMENT',
    url: `https://pingcode.yasdb.com/ship/products/YASHAN/baselines/test-${suffix}/ideas?category=all`,
    connectionId: 'isolated-test', actor: config.defaultOwnerId,
  });
  const relation = await ok('POST', `/v1/pingcode-task-sync/sources/${requirement.id}/runs`,
    { revision: requirement.revision, actor: config.defaultOwnerId });
  const ir = `YASHAN-${suffix}`;
  const secondIr = `YASHAN-${suffix + 1}`;
  const unlinkedIr = `YASHAN-${suffix + 2}`;
  await ok('POST', `/v1/pingcode-task-sync/runs/${relation.id}/pages`, {
    pageIndex: 0, pageCount: 1, count: 3, sourceVersion: 'isolated-idea-v1',
    criteriaSha256: hash('isolated-idea-criteria'), sourceType: 'requirement',
    items: [ir, secondIr].map((identifier, index) => ({ ir: identifier,
      irId: `idea-${suffix}-${index}`, workItems: [{ number,
      id: `upstream-${suffix}`, shortId: `short-${suffix}`,
      title: '隔离需求中的 SR', description: '## 正文\n\n需求关联内容。' }] }))
      .concat([{ ir: unlinkedIr, irId: `idea-${suffix}-unlinked`, workItems: [] }]),
  });
  const relationReady = await ok('POST', `/v1/pingcode-task-sync/runs/${relation.id}/finish`,
    { digest: hash('isolated-idea-run') });
  const unlinked = await ok('GET', `/v1/pingcode-task-sync/runs/${relation.id}/unlinked-irs?page=1&pageSize=100`);
  assert.deepEqual(unlinked.items, [unlinkedIr]);
  const conflictKey = crypto.randomUUID();
  const undecided = await request('POST', `/v1/pingcode-task-sync/runs/${relation.id}/confirm`,
    { digest: relationReady.digest, expectedRevision: requirement.revision, primarySources: {} }, conflictKey);
  assert.equal(undecided.status, 409);
  assert.equal(undecided.body.error.code, 'PRIMARY_SOURCE_DECISION_REQUIRED');
  await ok('POST', `/v1/pingcode-task-sync/runs/${relation.id}/confirm`, {
    digest: relationReady.digest, expectedRevision: requirement.revision,
    primarySources: { [number]: requirement.id },
  });
  const related = await ok('GET', `/v1/document-tasks/${number}`);
  assert.equal(related.sourceType, 'REQUIREMENT');
  assert.deepEqual(related.ir, [ir, secondIr]);
  assert.equal((await ok('GET', `/v1/document-tasks?ir=${ir}`)).total, 1);
  const latestSnapshot = await ok('GET', `/v1/pingcode-task-sync/tasks/${number}/source`);
  assert.equal(latestSnapshot.sourceId, requirement.id);
  assert.deepEqual(latestSnapshot.ir, [ir, secondIr]);
  const latestRequirement = await ok('GET', `/v1/pingcode-task-sync/sources/${requirement.id}`);
  const changedRun = await ok('POST', `/v1/pingcode-task-sync/sources/${requirement.id}/runs`,
    { revision: latestRequirement.revision, actor: config.defaultOwnerId });
  await ok('POST', `/v1/pingcode-task-sync/runs/${changedRun.id}/pages`, {
    pageIndex: 0, pageCount: 1, count: 2, sourceVersion: 'isolated-idea-v2',
    criteriaSha256: hash('isolated-idea-criteria'), sourceType: 'requirement',
    items: [ir, secondIr].map((identifier, index) => ({ ir: identifier,
      irId: `idea-${suffix}-${index}`, workItems: [{ number,
      id: `upstream-${suffix}`, shortId: `short-${suffix}`,
      title: '更新后的 SR 标题', description: '## 正文\n\n需求关联内容已更新。' }] })),
  });
  const changedReady = await ok('POST', `/v1/pingcode-task-sync/runs/${changedRun.id}/finish`,
    { digest: hash('isolated-idea-change') });
  await ok('POST', `/v1/pingcode-task-sync/runs/${changedRun.id}/confirm`, {
    digest: changedReady.digest, expectedRevision: latestRequirement.revision, primarySources: {},
  });
  const changes = await ok('GET', `/v1/pingcode-task-sync/tasks/${number}/changes?page=1&pageSize=20`);
  assert.ok(changes.total > 0);
  assert.ok(changes.items.every(item => item.confirmedAt && item.sourceName));
});

test('隔离库：缺图确认后只修复资源，不修改已确认正文', { skip: !enabled }, async () => {
  const config = await ok('GET', '/v1/document-tasks/config');
  const suffix = Date.now() + 1;
  const number = `YDBRD-${suffix}`;
  const imageUrl = 'https://pingcode.yasdb.com/atlas/files/public/test-image.png';
  const imageId = hash(imageUrl);
  const source = await ok('POST', '/v1/pingcode-task-sync/sources', {
    name: `隔离缺图-${suffix}`, type: 'TICKET',
    url: `https://pingcode.yasdb.com/pjm/projects/YDBRD/defect/test-image-${suffix}`,
    connectionId: 'isolated-test', actor: config.defaultOwnerId,
  });
  const run = await ok('POST', `/v1/pingcode-task-sync/sources/${source.id}/runs`,
    { revision: source.revision, actor: config.defaultOwnerId });
  await ok('POST', `/v1/pingcode-task-sync/runs/${run.id}/pages`, {
    pageIndex: 0, pageCount: 1, count: 1, sourceVersion: 'image-test-v1',
    criteriaSha256: hash('image-criteria'), sourceType: 'ticket',
    items: [{ number, id: `upstream-${suffix}`, shortId: `short-${suffix}`,
      title: '缺图验收工单', description: `![图](${imageUrl})`,
      imageResources: [{ id: imageId, state: 'FAILED', path: imageUrl,
        errorCode: 'PINGCODE_IMAGE_UNAVAILABLE' }] }],
  });
  const ready = await ok('POST', `/v1/pingcode-task-sync/runs/${run.id}/finish`, { digest: hash('image-run') });
  const confirmed = await ok('POST', `/v1/pingcode-task-sync/runs/${run.id}/confirm`,
    { digest: ready.digest, expectedRevision: source.revision, primarySources: {} });
  assert.equal(confirmed.status, 'CONFIRMED_MISSING_IMAGES');
  const before = await ok('GET', `/v1/pingcode-task-sync/tasks/${number}/source`);
  const failures = await ok('GET', `/v1/pingcode-task-sync/runs/${run.id}/resources`);
  assert.equal(failures.total, 1);
  assert.equal(failures.items[0].id, imageId);
  const pngHash = hash('isolated-image-bytes');
  await ok('POST', `/v1/pingcode-task-sync/runs/${run.id}/resources/retry`, {
    number, id: imageId, expectedVersion: failures.items[0].version,
    sourceUrl: imageUrl, state: 'READY', path: `assets/${pngHash}.png`,
    contentType: 'image/png', byteCount: 20,
  });
  const after = await ok('GET', `/v1/pingcode-task-sync/tasks/${number}/source`);
  assert.equal(after.markdown, before.markdown);
  assert.equal(after.bodySha256, before.bodySha256);
  assert.equal(after.resourceVersion, before.resourceVersion + 1);
  assert.equal(after.resources[0].state, 'READY');
  assert.equal((await ok('GET', `/v1/pingcode-task-sync/runs/${run.id}/resources`)).total, 0);
  assert.equal((await ok('GET', `/v1/pingcode-task-sync/runs/${run.id}`)).status, 'CONFIRMED');
});
