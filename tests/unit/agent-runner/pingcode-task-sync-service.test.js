const { createPingcodeTaskSyncService } = require('../../../packages/agent-runner-core/lib/pingcode-task-sync-service');
const { sourceDocument } = require('../../../packages/agent-runner-core/lib/pingcode-task-export');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const configured = { id: 'source-1', name: '测试视图', type: 'TICKET',
  url: 'https://pingcode.yasdb.com/pjm/projects/YDBRD/defect/test-view', revision: 1 };
const previewDigest = 'a'.repeat(64);

function fixture(pages, readImage, options = {}) {
  const source = options.source || configured;
  const calls = [];
  let pageReads = 0;
  const runs = [];
  const run = { id: 'run-1', sourceId: source.id, status: 'COLLECTING', rowCount: 2, pageCount: 2,
    sourceVersion: 'v1', criteriaSha256: require('node:crypto').createHash('sha256')
      .update(JSON.stringify({ status: 'open' })).digest('hex') };
  const storage = { requestAsync: async (method, pathname, body, headers) => {
    calls.push({ method, pathname, body, headers });
    if (method === 'POST' && pathname === '/v1/pingcode-task-sync/sources')
      return { data: { ...source, name: body.name, type: body.type, url: body.url } };
    if (pathname === '/v1/pingcode-task-sync/sources/source-1') return { data: source };
    if (pathname.endsWith('/sources/source-1/runs') && method === 'GET') return { data: runs.map(item => ({ ...item })) };
    if (pathname.endsWith('/sources/source-1/runs') && method === 'POST') {
      runs.push({ ...run }); return { data: { ...run } };
    }
    if (pathname.endsWith('/runs/run-1/finish')) run.status = 'AWAITING_CONFIRM';
    if (pathname.startsWith('/v1/pingcode-task-sync/runs/run-1/preview?'))
      return { data: { run: { ...run, digest: previewDigest }, items: [] } };
    if (pathname.endsWith('/runs/run-1/confirm')) { run.status = 'CONFIRMED'; return { data: { ...run } }; }
    if (pathname.endsWith('/runs/run-1/cancel') || pathname.endsWith('/runs/stale-run/cancel')) {
      const target = pathname.endsWith('/runs/stale-run/cancel') ? runs.find(item => item.id === 'stale-run') : run;
      if (target) target.status = 'CANCELLED';
    }
    if (pathname.endsWith('/runs/run-1/fail')) run.status = 'FAILED';
    if (pathname.endsWith('/runs/run-1')) return { data: { ...run } };
    return { data: { ...run } };
  } };
  const defaultReadPage = async (_source, index, signal) => {
    pageReads++;
    if (signal?.aborted) throw Object.assign(new Error('cancelled'), { code: 'COLLECTION_CANCELLED' });
    return pages[index];
  };
  const readPage = options.readPage || defaultReadPage;
  return { service: createPingcodeTaskSyncService({ storage, readPage, readPages: options.readPages, readImage, logger: options.logger,
    pingcodeUrl: 'http://127.0.0.1:18010' }), calls, run, runs, get pageReads() { return pageReads; } };
}

const page = (index, item, count = 2) => ({ sourceType: 'ticket', sourceId: 'view-1',
  sourceVersion: 'v1', criteria: { status: 'open' }, count, pageCount: 2, pageIndex: index, items: [item] });
const item = number => ({ number: `YDBRD-${number}`, id: `work-${number}`, shortId: `short-${number}`, description: '正文' });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('登记来源只做本地格式校验，不在保存请求中读取远端基线', async () => {
  const setup = fixture([]);
  const saved = await setup.service.createSource({ name: '27.1.1 版本需求', type: 'REQUIREMENT',
    productType: 'DB', businessVersion: '27.1.1',
    url: 'https://pingcode.yasdb.com/ship/products/YASHAN/baselines/Yq_yJCzT/ideas?category=all' }, 'heyang');
  expect(saved).toMatchObject({ name: '27.1.1 版本需求', type: 'REQUIREMENT' });
  expect(setup.pageReads).toBe(0);
  expect(setup.calls.filter(call => call.method === 'POST' && call.pathname === '/v1/pingcode-task-sync/sources')).toHaveLength(1);
  expect(setup.calls.find(call => call.method === 'POST' && call.pathname === '/v1/pingcode-task-sync/sources').body)
    .toMatchObject({ productType: 'DB', businessVersion: '27.1.1' });
});

test('来源配置修改沿用 revision 并通过 Storage HTTP 契约执行', async () => {
  const setup = fixture([]);
  await setup.service.updateSource('source-1', { name: '新名称', type: 'TICKET', productType: 'YCM',
    businessVersion: '28.1', url: configured.url, revision: 7 });
  await setup.service.setSourceState('source-1', { state: 'DISABLED', revision: 8 });
  await setup.service.deleteSource('source-1', 9);
  expect(setup.calls.slice(0, 4).map(call => [call.method, call.pathname, call.body])).toEqual([
    ['PATCH', '/v1/pingcode-task-sync/sources/source-1',
      { name: '新名称', type: 'TICKET', productType: 'YCM', businessVersion: '28.1', url: configured.url, revision: 7 }],
    ['GET', '/v1/pingcode-task-sync/sources/source-1/runs', undefined],
    ['PATCH', '/v1/pingcode-task-sync/sources/source-1/state', { state: 'DISABLED', revision: 8 }],
    ['DELETE', '/v1/pingcode-task-sync/sources/source-1', undefined],
  ]);
  expect(setup.calls[3].headers).toMatchObject({ 'If-Match': '9', 'Idempotency-Key': expect.any(String) });
  await expect(setup.service.setSourceState('source-1', { state: 'INVALID', revision: 10 }))
    .rejects.toMatchObject({ code: 'PINGCODE_SOURCE_INVALID', status: 422 });
});

test('预览转发接受插件差异分类并拒绝未知分类', async () => {
  const setup = fixture([]);
  for (const view of ['created', 'updated', 'removed', 'conflicts']) {
    await setup.service.previewRun('run-1', { page: 1, pageSize: 50, view });
    expect(setup.calls.at(-1).pathname).toContain(`/preview?page=1&pageSize=50&view=${view}`);
  }
  await expect(setup.service.previewRun('run-1', { view: 'unexpected' }))
    .rejects.toMatchObject({ code: 'PINGCODE_PREVIEW_VIEW_INVALID' });
});

test('停用来源前取消活动运行，包含服务重启后残留的 COLLECTING 运行', async () => {
  const setup = fixture([]);
  setup.runs.push({ id: 'stale-run', sourceId: configured.id, status: 'COLLECTING' });

  await setup.service.setSourceState(configured.id, { state: 'DISABLED', revision: 1 });

  expect(setup.calls.map(call => [call.method, call.pathname])).toEqual([
    ['GET', '/v1/pingcode-task-sync/sources/source-1/runs'],
    ['POST', '/v1/pingcode-task-sync/runs/stale-run/cancel'],
    ['PATCH', '/v1/pingcode-task-sync/sources/source-1/state'],
  ]);
  expect(setup.runs[0].status).toBe('CANCELLED');
});

test('停用来源会中断当前单次采集并继续完成状态更新', async () => {
  const setup = fixture([], undefined, { readPage: (_source, _index, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { code: 'COLLECTION_CANCELLED' })), { once: true });
  }) });
  await setup.service.startRun(configured.id, 'heyang', configured.revision);
  await tick();

  await setup.service.setSourceState(configured.id, { state: 'DISABLED', revision: 1 });

  expect(setup.run.status).toBe('CANCELLED');
  expect(setup.calls.some(call => call.pathname.endsWith('/sources/source-1/state'))).toBe(true);
});

test('采集工作区通过 Storage HTTP 读取运行快照列表与正文', async () => {
  const setup = fixture([]);
  await setup.service.runItems('run-1', 2, 25);
  await setup.service.runItem('run-1', 'YDBRD-42');
  expect(setup.calls.map(call => call.pathname)).toEqual([
    '/v1/pingcode-task-sync/runs/run-1/items?page=2&pageSize=25',
    '/v1/pingcode-task-sync/runs/run-1/items/YDBRD-42',
  ]);
});

test('未关联 IR 编号从运行快照分页读取', async () => {
  const setup = fixture([]);
  await setup.service.unlinkedIrs('run-1', 1, 100);
  expect(setup.calls.at(-1).pathname).toBe('/v1/pingcode-task-sync/runs/run-1/unlinked-irs?page=1&pageSize=100');
});

test('同步服务保留 Pingcode API error envelope 的具体诊断码', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pingcode-sync-error-'));
  const tokenPath = path.join(directory, 'token');
  fs.writeFileSync(tokenPath, 'test-internal-token', { mode: 0o600 });
  const server = http.createServer((req, res) => {
    res.writeHead(422, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: { code: 'PINGCODE_RELATION_INCOMPLETE',
      message: '需求关联工作项数量与详情不一致', sourceNumber: 'YASHAN-1', expectedCount: 1, actualCount: 0 } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const service = createPingcodeTaskSyncService({ pingcodeUrl: `http://127.0.0.1:${port}`, tokenPath,
    storage: { requestAsync: async () => ({ data: configured }) } });
  try {
    await expect(service.testSource(configured.id)).rejects.toMatchObject({
      code: 'PINGCODE_RELATION_INCOMPLETE', status: 422,
      details: { sourceNumber: 'YASHAN-1', expectedCount: 1, actualCount: 0 },
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('启动立即返回运行号，随后逐页暂存并形成待确认预览', async () => {
  const logEvents = [];
  const { service, calls, run } = fixture([page(0, item(1)), page(1, item(2))], undefined, {
    logger: { info: (event, data) => logEvents.push({ event, data }), warn: (event, data) => logEvents.push({ event, data }) },
  });
  const startedAt = performance.now();
  expect(await service.startRun(configured.id, 'heyang', configured.revision)).toMatchObject({ id: 'run-1', status: 'COLLECTING' });
  expect(performance.now() - startedAt).toBeLessThan(1000);
  await tick();
  expect(run.status).toBe('AWAITING_CONFIRM');
  expect(calls.filter(call => call.pathname.endsWith('/pages'))).toHaveLength(2);
  expect(calls.find(call => call.pathname.endsWith('/finish')).body.digest).toMatch(/^[a-f0-9]{64}$/);
  expect(logEvents.map(item => item.event)).toEqual(expect.arrayContaining([
    'pingcode.sync.accepted', 'pingcode.sync.collection_started', 'pingcode.sync.page_staged', 'pingcode.sync.collection_completed',
  ]));
  expect(logEvents.find(item => item.event === 'pingcode.sync.accepted').data.startResponseDurationMs).toBeLessThan(1000);
});

test('需求基线批量读取后仍按页校验并逐页暂存', async () => {
  const pages = [0, 1].map(index => ({ sourceType: 'requirement', sourceId: 'baseline-1', sourceVersion: 'v1',
    count: 2, pageCount: 2, pageIndex: index,
    items: [{ ir: `YASHAN-${index + 1}`, irId: `idea-${index + 1}`, workItems: [item(index + 1)] }] }));
  let batchReads = 0;
  const setup = fixture(pages, undefined, {
    source: { ...configured, type: 'REQUIREMENT', url: 'https://pingcode.yasdb.com/ship/products/YASHAN/baselines/demo/ideas' },
    readPages: async () => { batchReads++; return pages; },
  });
  await setup.service.startRun(configured.id, 'heyang', configured.revision);
  await tick();
  expect(batchReads).toBe(1);
  expect(setup.pageReads).toBe(0);
  expect(setup.run.status).toBe('AWAITING_CONFIRM');
  expect(setup.calls.filter(call => call.method === 'POST' && call.pathname.endsWith('/pages')).map(call => call.body.pageIndex))
    .toEqual([0, 1]);
});

test('来源分页失配只记录失败，不能生成可确认预览', async () => {
  const invalid = [page(0, item(1)), { ...page(1, item(2)), sourceVersion: 'v2' }];
  const { service, calls, run } = fixture(invalid);
  await service.startRun(configured.id, 'heyang', configured.revision);
  await tick();
  expect(run.status).toBe('FAILED');
  expect(calls.some(call => call.pathname.endsWith('/finish'))).toBe(false);
});

test('采集正文转换为 Markdown，并将 Pingcode 图片保存为本地资源', async () => {
  const rich = { ...item(1), description: '<p>说明 <strong>重点</strong></p><table><tr><th>列</th></tr><tr><td>值</td></tr></table><img alt="图" src="/atlas/files/public/a.png">' };
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=';
  const { service, calls } = fixture([page(0, rich), page(1, item(2))], async () => ({
    dataBase64: png, contentType: 'image/png',
  }));
  await service.startRun(configured.id, 'heyang', configured.revision);
  await tick();
  const body = calls.find(call => call.pathname.endsWith('/pages')).body.items[0].description;
  expect(body).toContain('**重点**');
  expect(body).toContain('| 列 |');
  expect(body).toMatch(/!\[图\]\(assets\/[a-f0-9]{64}\.png\)/);
  expect(calls.find(call => call.pathname.endsWith('/pages')).body.items[0].imageResources[0])
    .toMatchObject({ state: 'READY', contentType: 'image/png' });
  expect(body).not.toContain('<table>');
});

test('图片不可用时保留缺图记录，导出正文不保留失效的远程图片链接', async () => {
  const rich = { ...item(1), description: '<p>说明</p><img alt="结构图" src="/atlas/files/public/missing.png">' };
  const { service, calls } = fixture([page(0, rich), page(1, item(2))], async () => {
    throw new Error('image unavailable');
  });
  await service.startRun(configured.id, 'heyang', configured.revision);
  await tick();
  const saved = calls.find(call => call.pathname.endsWith('/pages')).body.items[0];
  expect(saved.description).toContain('[图片未能读取：结构图]');
  expect(saved.description).not.toContain('https://pingcode.yasdb.com/atlas/files/public/missing.png');
  expect(saved.imageResources[0]).toMatchObject({ state: 'FAILED', errorCode: 'PINGCODE_IMAGE_UNAVAILABLE' });
  expect(saved.imageResources[0].path).toBe('https://pingcode.yasdb.com/atlas/files/public/missing.png');
  const exported = sourceDocument({ number: saved.number, title: '测试', markdown: saved.description,
    resources: saved.imageResources, sourceUrl: configured.url });
  expect(exported).toContain('[图片未能读取：结构图]');
  expect(exported).not.toContain('https://pingcode.yasdb.com/atlas/files/public/missing.png');
});

test('管理员可以读取分页预览并按摘要确认，确认内容传至存储门禁', async () => {
  const { service, calls, run } = fixture([page(0, item(1)), page(1, item(2))]);
  run.status = 'AWAITING_CONFIRM';
  expect(await service.previewRun('run-1', { page: 2, pageSize: 20 })).toMatchObject({ run: { digest: previewDigest } });
  expect(await service.confirmRun('run-1', { digest: previewDigest, expectedRevision: 1,
    primarySources: { 'YDBRD-1': 'source-1' } })).toMatchObject({ status: 'CONFIRMED' });
  expect(calls.find(call => call.pathname.endsWith('/confirm')).body).toEqual({
    digest: previewDigest, expectedRevision: 1, primarySources: { 'YDBRD-1': 'source-1' },
  });
});

test('确认时数值来源版本经存储转成字符串仍可匹配同一版本', async () => {
  const current = { ...page(0, item(1)), sourceVersion: 1793070540 };
  const { service, calls, run } = fixture([current]);
  run.status = 'AWAITING_CONFIRM';
  run.sourceVersion = '1793070540';
  await expect(service.confirmRun('run-1', { digest: previewDigest, expectedRevision: 1 }))
    .resolves.toMatchObject({ status: 'CONFIRMED' });
  expect(calls.some(call => call.pathname.endsWith('/confirm'))).toBe(true);
});

test('确认前上游视图已变更时拒绝写入旧预览', async () => {
  const changed = { ...page(0, item(1)), sourceVersion: 'v2' };
  const { service, calls, run } = fixture([changed, page(1, item(2))]);
  run.status = 'AWAITING_CONFIRM';
  await expect(service.confirmRun('run-1', { digest: previewDigest, expectedRevision: 1 }))
    .rejects.toMatchObject({ code: 'PREVIEW_STALE', status: 409 });
  expect(calls.some(call => call.pathname.endsWith('/confirm'))).toBe(false);
});

test('确认前来源版本缺失时拒绝写入旧预览', async () => {
  const current = { ...page(0, item(1)), sourceVersion: undefined };
  const { service, calls, run } = fixture([current]);
  run.status = 'AWAITING_CONFIRM';
  run.sourceVersion = undefined;
  await expect(service.confirmRun('run-1', { digest: previewDigest, expectedRevision: 1 }))
    .rejects.toMatchObject({ code: 'PREVIEW_STALE', status: 409 });
  expect(calls.some(call => call.pathname.endsWith('/confirm'))).toBe(false);
});

test('确认前上游筛选条件已变更时拒绝写入旧预览', async () => {
  const changed = { ...page(0, item(1)), criteria: { status: 'closed' } };
  const { service, calls, run } = fixture([changed, page(1, item(2))]);
  run.status = 'AWAITING_CONFIRM';
  await expect(service.confirmRun('run-1', { digest: previewDigest, expectedRevision: 1 }))
    .rejects.toMatchObject({ code: 'PREVIEW_STALE', status: 409 });
  expect(calls.some(call => call.pathname.endsWith('/confirm'))).toBe(false);
});
