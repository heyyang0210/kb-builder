const { createPingcodeTaskSyncService } = require('../../../packages/agent-runner-core/lib/pingcode-task-sync-service');
const { sourceDocument } = require('../../../packages/agent-runner-core/lib/pingcode-task-export');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const configured = { id: 'source-1', name: '测试视图', type: 'TICKET',
  url: 'https://pingcode.yasdb.com/pjm/projects/YDBRD/defect/test-view', revision: 1 };
const previewDigest = 'a'.repeat(64);

function fixture(pages, readImage) {
  const calls = [];
  let pageReads = 0;
  const run = { id: 'run-1', sourceId: configured.id, status: 'COLLECTING', rowCount: 2, pageCount: 2,
    sourceVersion: 'v1', criteriaSha256: require('node:crypto').createHash('sha256')
      .update(JSON.stringify({ status: 'open' })).digest('hex') };
  const storage = { requestAsync: async (method, pathname, body) => {
    calls.push({ method, pathname, body });
    if (method === 'POST' && pathname === '/v1/pingcode-task-sync/sources')
      return { data: { ...configured, name: body.name, type: body.type, url: body.url } };
    if (pathname === '/v1/pingcode-task-sync/sources/source-1') return { data: configured };
    if (pathname.endsWith('/sources/source-1/runs')) return { data: { ...run } };
    if (pathname.endsWith('/runs/run-1/finish')) run.status = 'AWAITING_CONFIRM';
    if (pathname.startsWith('/v1/pingcode-task-sync/runs/run-1/preview?'))
      return { data: { run: { ...run, digest: previewDigest }, items: [] } };
    if (pathname.endsWith('/runs/run-1/confirm')) { run.status = 'CONFIRMED'; return { data: { ...run } }; }
    if (pathname.endsWith('/runs/run-1/cancel')) run.status = 'CANCELLED';
    if (pathname.endsWith('/runs/run-1/fail')) run.status = 'FAILED';
    if (pathname.endsWith('/runs/run-1')) return { data: { ...run } };
    return { data: { ...run } };
  } };
  const readPage = async (_source, index, signal) => {
    pageReads++;
    if (signal?.aborted) throw Object.assign(new Error('cancelled'), { code: 'COLLECTION_CANCELLED' });
    return pages[index];
  };
  return { service: createPingcodeTaskSyncService({ storage, readPage, readImage,
    pingcodeUrl: 'http://127.0.0.1:18010' }), calls, run, get pageReads() { return pageReads; } };
}

const page = (index, item, count = 2) => ({ sourceType: 'ticket', sourceId: 'view-1',
  sourceVersion: 'v1', criteria: { status: 'open' }, count, pageCount: 2, pageIndex: index, items: [item] });
const item = number => ({ number: `YDBRD-${number}`, id: `work-${number}`, shortId: `short-${number}`, description: '正文' });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('登记来源只做本地格式校验，不在保存请求中读取远端基线', async () => {
  const setup = fixture([]);
  const saved = await setup.service.createSource({ name: '27.1.1 版本需求', type: 'REQUIREMENT',
    url: 'https://pingcode.yasdb.com/ship/products/YASHAN/baselines/Yq_yJCzT/ideas?category=all' }, 'heyang');
  expect(saved).toMatchObject({ name: '27.1.1 版本需求', type: 'REQUIREMENT' });
  expect(setup.pageReads).toBe(0);
  expect(setup.calls.filter(call => call.method === 'POST' && call.pathname === '/v1/pingcode-task-sync/sources')).toHaveLength(1);
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
  const { service, calls, run } = fixture([page(0, item(1)), page(1, item(2))]);
  expect(await service.startRun(configured.id, 'heyang')).toMatchObject({ id: 'run-1', status: 'COLLECTING' });
  await tick();
  expect(run.status).toBe('AWAITING_CONFIRM');
  expect(calls.filter(call => call.pathname.endsWith('/pages'))).toHaveLength(2);
  expect(calls.find(call => call.pathname.endsWith('/finish')).body.digest).toMatch(/^[a-f0-9]{64}$/);
});

test('来源分页失配只记录失败，不能生成可确认预览', async () => {
  const invalid = [page(0, item(1)), { ...page(1, item(2)), sourceVersion: 'v2' }];
  const { service, calls, run } = fixture(invalid);
  await service.startRun(configured.id, 'heyang');
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
  await service.startRun(configured.id, 'heyang');
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
  await service.startRun(configured.id, 'heyang');
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

test('确认前上游视图已变更时拒绝写入旧预览', async () => {
  const changed = { ...page(0, item(1)), sourceVersion: 'v2' };
  const { service, calls, run } = fixture([changed, page(1, item(2))]);
  run.status = 'AWAITING_CONFIRM';
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
