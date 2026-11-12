const { collectPingcodeTaskSource } = require('../../../packages/agent-runner-core/lib/pingcode-task-collection');

const source = { type: 'requirement', url: 'https://pingcode.yasdb.com/ship/products/YASHAN/baselines/test/ideas' };
const work = { number: 'YDBRD-12', id: 'work-12', shortId: 'short-12', title: '正文' };
const page = (index, rows, count = 2) => ({ sourceType: 'requirement', sourceId: 'baseline-1',
  sourceVersion: 'v1', count, pageCount: 2, pageIndex: index, items: rows });

test('完整分页后按 SR 去重并保留所有 IR 关联', async () => {
  const pages = [page(0, [{ ir: 'YASHAN-1', irId: 'idea-1', workItems: [work] }]),
    page(1, [{ ir: 'YASHAN-2', irId: 'idea-2', workItems: [work] }])];
  const progress = [];
  const result = await collectPingcodeTaskSource({ source, readPage: (_, index) => pages[index],
    onProgress: value => progress.push(value) });
  expect(result.items).toHaveLength(1);
  expect(result.items[0].ir).toEqual(['YASHAN-1', 'YASHAN-2']);
  expect(progress).toHaveLength(2);
});

test('筛选条件、版本或总数漂移不能生成预览', async () => {
  const pages = [page(0, [{ ir: 'YASHAN-1', irId: 'idea-1', workItems: [work] }]),
    { ...page(1, [{ ir: 'YASHAN-2', irId: 'idea-2', workItems: [] }]), sourceVersion: 'v2' }];
  await expect(collectPingcodeTaskSource({ source, readPage: (_, index) => pages[index] }))
    .rejects.toMatchObject({ code: 'SOURCE_CHANGED' });
});

test('重复分页、漏页和 SR 身份冲突均拒绝', async () => {
  const row = { ir: 'YASHAN-1', irId: 'idea-1', workItems: [work] };
  const cases = [
    { pages: [page(0, [row]), page(1, [row])], code: 'SOURCE_DUPLICATE' },
    { pages: [page(0, [row]), page(1, [])], code: 'SOURCE_PAGE_COUNT_MISMATCH' },
    { pages: [page(0, [row]), page(1, [{ ir: 'YASHAN-2', irId: 'idea-2', workItems: [{ ...work, id: 'other' }] }])], code: 'SOURCE_IDENTITY_CONFLICT' },
  ];
  for (const { pages, code } of cases) {
    await expect(collectPingcodeTaskSource({ source, readPage: (_, index) => pages[index] }))
      .rejects.toMatchObject({ code });
  }
});

test('取消后停止读取后续页', async () => {
  const controller = new AbortController();
  let calls = 0;
  await expect(collectPingcodeTaskSource({ source, signal: controller.signal,
    readPage: (_, index) => { calls++; if (index === 0) controller.abort(); return page(index, [{ ir: 'YASHAN-1', irId: 'idea-1', workItems: [work] }]); } }))
    .rejects.toMatchObject({ code: 'COLLECTION_CANCELLED' });
  expect(calls).toBe(1);
});

test('空视图仍可形成完整预览，用于确认来源移除', async () => {
  const empty = { sourceType: 'ticket', sourceId: 'view-1', sourceVersion: 'v1',
    count: 0, pageCount: 0, pageIndex: 0, items: [] };
  const result = await collectPingcodeTaskSource({ source: { type: 'ticket', url: 'https://pingcode.yasdb.com/pjm/projects/YDBRD/defect/view-1' },
    readPage: async () => empty });
  expect(result).toMatchObject({ rowCount: 0, pageCount: 0, items: [] });
});

test('大视图逐页交付时只保留身份摘要，仍能检测跨页冲突', async () => {
  const pages = [page(0, [{ ir: 'YASHAN-1', irId: 'idea-1', workItems: [work] }]),
    page(1, [{ ir: 'YASHAN-2', irId: 'idea-2', workItems: [work] }])];
  const staged = [];
  const result = await collectPingcodeTaskSource({ source, readPage: (_, index) => pages[index],
    retainItems: false, onPage: async (value, metadata) => staged.push([value.pageIndex, metadata.criteriaSha256]) });
  expect(staged).toHaveLength(2);
  expect(result).toMatchObject({ srCount: 1, items: [] });
  expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
  pages[1].items[0].workItems = [{ ...work, description: '另一个正文' }];
  await expect(collectPingcodeTaskSource({ source, readPage: (_, index) => pages[index], retainItems: false }))
    .rejects.toMatchObject({ code: 'SOURCE_CONTENT_CONFLICT' });
});
