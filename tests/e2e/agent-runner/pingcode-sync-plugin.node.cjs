const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const path = require('node:path');
const { chromium } = require('playwright');

const frontend = path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center');
const source = { id: 'source-1', name: '版本需求', type: 'REQUIREMENT',
  url: 'https://pingcode.yasdb.com/ship/products/YASHAN/baselines/demo/ideas',
  state: 'ACTIVE', revision: 1, productType: 'DB', syncedTaskCount: 0 };
const sources = [source, { ...source, id: 'source-2', name: '历史工单', type: 'TICKET',
  url: 'https://pingcode.yasdb.com/pjm/projects/YDBRD/defect', state: 'INACTIVE', productType: 'YCM' }];
const touchTargetSelector = [
  '.pingcode-source-toolbar select', '.pingcode-search input', '.pingcode-detail-button',
  '.pingcode-preview-tabs button', '.pingcode-preview footer .icon-button',
  '.pingcode-preview td select', '.pingcode-dialog-header .icon-button',
  '.pingcode-history button', '.pingcode-sync-page dialog form input',
  '.pingcode-sync-page dialog form select', '.pingcode-sync-page dialog form button',
  '.pingcode-sync-page .button', '.pingcode-row-actions .icon-button',
].join(',');

async function assertTouchTargets(page) {
  const targets = await page.locator(`${touchTargetSelector}:visible`).evaluateAll(nodes => nodes.map(node => ({
    label: node.innerText.trim() || node.getAttribute('aria-label') || node.name,
    height: node.getBoundingClientRect().height,
  })).filter(target => target.height > 0));
  assert.ok(targets.length > 0, '页面应存在可用操作');
  assert.ok(targets.every(target => target.height >= 44), `操作点击区应至少为 44px: ${JSON.stringify(targets)}`);
}

test('插件来源表格支持筛选、同步工作区全流程；窄屏不溢出', async () => {
  const app = express();
  app.use(express.json());
  app.use('/frontend', express.static(frontend));
  let run = null, reads = 0, confirmed = null, retried = false, runListRequests = 0, runCreateRequests = 0, failNextRun = false;
  const route = '/knowledge-center/api/platform/plugins/pingcode';
  app.get(route + '/sources', (req, res) => res.json({ success: true, data: sources }));
  app.get(route + '/sources/source-1', (req, res) => res.json({ success: true, data: source }));
  let confirmedSourceItems = [];
  app.get(route + '/sources/source-1/items', (_req, res) => res.json({ success: true, data: {
    items: confirmedSourceItems, total: confirmedSourceItems.length, page: 1, pageSize: 50,
  } }));
  app.get(route + '/sources/source-1/runs', (req, res) => {
    runListRequests++;
    res.json({ success: true, data: run ? [run] : [] });
  });
  app.post(route + '/sources/source-1/runs', (req, res) => {
    runCreateRequests++;
    run = { id: 'run-1', sourceId: source.id, status: failNextRun ? 'FAILED' : 'COLLECTING',
      errorCode: failNextRun ? 'PINGCODE_RELATION_INCOMPLETE' : null, rowsRead: 0, createdAt: new Date().toISOString() };
    failNextRun = false;
    res.json({ success: true, data: run });
  });
  app.get(route + '/runs/run-1', (req, res) => {
    if (++reads >= 2 && run.status === 'COLLECTING') Object.assign(run, { status: 'AWAITING_CONFIRM',
      rowsRead: 2, srCount: 1, unlinkedIrCount: 1, newCount: 1, changedCount: 0, removedCount: 0, digest: 'a'.repeat(64) });
    res.json({ success: true, data: run });
  });
  app.get(route + '/runs/run-1/preview', (req, res) => res.json({ success: true, data: {
    run, total: req.query.view === 'conflicts' || req.query.view === 'created' ? 1 : 0,
    items: ['conflicts', 'created'].includes(req.query.view) ? [{
      number: 'YDBRD-12', title: '测试任务', action: 'created', ir: ['YASHAN-1'],
      sources: [{ id: 'source-1', name: '版本需求', primary: false }, { id: 'source-2', name: '工单视图', primary: false }],
    }] : [],
  } }));
  app.get(route + '/runs/run-1/items', (_req, res) => res.json({ success: true, data: {
    items: [{ number: 'YDBRD-12', title: '测试任务', ir: ['YASHAN-1'] }], total: 1, page: 1, pageSize: 50,
  } }));
  app.get(route + '/runs/run-1/unlinked-irs', (_req, res) => res.json({ success: true, data: {
    items: ['YASHAN-1'], total: 1, page: 1, pageSize: 100,
  } }));
  app.get(route + '/runs/run-1/items/YDBRD-12', (_req, res) => res.json({ success: true, data: {
    number: 'YDBRD-12', title: '测试任务', markdown: '# 采集正文\n\n## 测试建议\n测试建议正文\n\n## 概要设计方案\n概要设计正文\n\n## 开发设计方案\n开发设计正文\n\n## 会议纪要\n会议纪要正文', ir: ['YASHAN-1'], resources: [],
  } }));
  app.post(route + '/runs/run-1/confirm', (req, res) => {
    confirmed = req.body;
    source.syncedTaskCount = 1;
    confirmedSourceItems = [{ number: 'YDBRD-12', title: '测试任务', ir: ['YASHAN-1'], confirmedAt: new Date().toISOString() }];
    run = { ...run, status: 'CONFIRMED_MISSING_IMAGES' };
    res.json({ success: true, data: run });
  });
  app.get(route + '/runs/run-1/resources', (req, res) => res.json({ success: true, data: {
    total: retried ? 0 : 1, items: retried ? [] : [{ number: 'YDBRD-12', errorCode: 'PINGCODE_IMAGE_UNAVAILABLE' }],
    retry: retried ? { state: 'completed', attempted: 1, repaired: 1, failed: 0 } : null,
  } }));
  app.post(route + '/runs/run-1/resources/retry', (req, res) => {
    retried = true; run.status = 'CONFIRMED';
    res.json({ success: true, data: { state: 'running', attempted: 0, repaired: 0, failed: 0 } });
  });
  app.get('/', (req, res) => res.type('html').send(`<!doctype html><html lang="zh-CN"><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="/frontend/common/tokens.css">
    <link rel="stylesheet" href="/frontend/common/base.css">
    <link rel="stylesheet" href="/frontend/common/components.css">
    <link rel="stylesheet" href="/frontend/modules/platform-admin/pingcode-sync.css">
    </head><body><main data-pingcode-sync></main>
    <script type="module">import { mountPingcodeSync } from '/frontend/modules/platform-admin/pingcode-sync.js';
      mountPingcodeSync(document.querySelector('[data-pingcode-sync]'));</script></body></html>`));
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByText('版本需求', { exact: true }).waitFor();
    assert.equal(await page.getByRole('columnheader', { name: '已同步内容' }).count(), 1);
    assert.equal(await page.locator('[data-pc-source="source-1"] td[data-label="已同步数量"]').innerText(), '0');
    assert.equal(await page.locator('[data-pc-source="source-1"] td[data-label="已同步内容"] [data-pc-open]').count(), 1);
    await assertTouchTargets(page);
    assert.equal(runListRequests, 0, '首屏只加载来源列表，不应逐来源请求运行记录');
    await page.getByRole('button', { name: '添加来源' }).click();
    const addDialog = page.locator('[data-pc-add-dialog]');
    await addDialog.waitFor();
    await assertTouchTargets(page);
    assert.ok((await addDialog.boundingBox()).height < 600, '添加来源弹窗应按表单内容收缩');
    await page.locator('[data-pc-add-close]').first().click();
    await page.locator('[data-pc-search]').fill('工单');
    await page.getByText('历史工单', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-pc-source]').count(), 1);
    await page.locator('[data-pc-search]').fill('');
    await page.locator('[data-pc-type]').selectOption('REQUIREMENT');
    assert.equal(await page.locator('[data-pc-source]').count(), 1);
    await page.locator('[data-pc-type]').selectOption('all');
    await page.locator('[data-pc-product-type]').selectOption('YCM');
    assert.equal(await page.locator('[data-pc-source]').count(), 1);
    await page.locator('[data-pc-product-type]').selectOption('DB');
    assert.equal(await page.locator('[data-pc-source]').count(), 1);
    await page.locator('[data-pc-product-type]').selectOption('all');
    await page.locator('[data-pc-enabled]').selectOption('INACTIVE');
    assert.equal(await page.locator('[data-pc-source]').count(), 1);
    await page.locator('[data-pc-enabled]').selectOption('all');
    assert.equal(await page.locator('[data-pc-detail-dialog]').count(), 0, '来源详情弹窗已移除');
    await page.locator('[data-pc-source="source-1"] [data-pc-edit-source]').click();
    await page.locator('[data-pc-edit-dialog]').waitFor();
    await page.locator('[data-pc-edit-close]').click();
    await assertTouchTargets(page);
    await page.locator('[data-pc-source="source-1"]').click();
    await page.getByRole('heading', { name: 'Pingcode 来源 / 版本需求' }).waitFor();
    assert.equal(await page.getByRole('button', { name: '测试连接' }).count(), 0);
    const runCreated = page.waitForResponse(response => response.request().method() === 'POST'
      && response.url().endsWith('/sources/source-1/runs'));
    await page.locator('[data-pc-workspace-sync]').click();
    assert.equal(await page.locator('[data-pc-workspace-sync]').innerText(), '同步中…');
    await page.getByText('正在同步 PingCode 并比较任务快照，完成后显示差异。').waitFor();
    assert.equal((await runCreated).status(), 200);
    assert.equal(runCreateRequests, 1, '点击刷新必须创建一次运行请求');
    const unlinkedWarning = page.getByRole('status').getByText('1 条需求暂未关联工单，已跳过，不影响本次同步。');
    await unlinkedWarning.waitFor();
    await page.getByText('未关联 IR（1）').click();
    await page.getByText('采集时 PingCode 的结构化关系接口返回空列表', { exact: false }).waitFor();
    await page.locator('.pingcode-unlinked-irs code').getByText('YASHAN-1', { exact: true }).waitFor();
    await unlinkedWarning.waitFor({ state: 'detached', timeout: 4500 });
    assert.equal(await page.locator('.pingcode-preview').count(), 0, '差异不应追加在同步工作区末尾');
    await page.getByRole('button', { name: '查看任务变化' }).click();
    await page.getByRole('heading', { name: '同步任务变化' }).waitFor();
    assert.equal(await page.locator('.pingcode-diff-summary').count(), 0, '分类标签已呈现数量，不再重复显示汇总卡片');
    assert.equal(await page.getByText('新增 1 项 · 更新 0 项 · 移除 0 项', { exact: true }).count(), 0,
      '差异数量不应在分类标签外重复汇总');
    assert.equal(await page.locator('.pingcode-workspace-grid').count(), 0, '变化列表应独立占据页面');
    assert.equal(await page.getByRole('button', { name: '同步任务列表' }).count(), 1);
    await page.locator('[data-pc-run-item="YDBRD-12"]').first().click();
    await page.getByRole('heading', { name: 'YDBRD-12' }).waitFor();
    await page.locator('.pingcode-workitem-markdown .source-record-title').getByText('测试任务', { exact: true }).waitFor();
    for (const heading of ['测试建议', '概要设计方案', '开发设计方案', '会议纪要']) {
      await page.locator('.pingcode-workitem-markdown').getByRole('heading', { name: heading }).waitFor();
    }
    assert.equal(await page.locator('[data-workspace-panel="detail"]').evaluate(node => getComputedStyle(node).position), 'sticky');
    assert.ok((await page.locator('[data-workspace-panel="list"]').boundingBox()).height > 300);
    await page.getByRole('button', { name: '返回任务变化' }).click();
    await page.getByRole('heading', { name: '同步任务变化' }).waitFor();
    assert.equal(await page.getByText('本次采集', { exact: false }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '采集内容' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '任务变化' }).count(), 0);
    assert.equal(await page.getByRole('columnheader', { name: '运行状态' }).count(), 0);
    assert.match(await page.locator('[data-pc-view="created"]').innerText(), /新增\s+1/);
    assert.match(await page.locator('[data-pc-view="updated"]').innerText(), /更新\s+0/);
    assert.match(await page.locator('[data-pc-view="removed"]').innerText(), /移除\s+0/);
    await page.locator('[data-pc-diff-search]').fill('YDBRD-12');
    assert.equal(await page.locator('.pingcode-preview tbody tr:visible').count(), 1);
    await page.locator('[data-pc-diff-search]').fill('');
    await page.locator('[data-pc-diff-ir]').selectOption('YASHAN-1');
    assert.equal(await page.locator('.pingcode-preview tbody tr:visible').count(), 1);
    await page.locator('[data-pc-diff-ir]').selectOption('');
    await assertTouchTargets(page);
    await page.locator('[data-pc-confirm]').waitFor();
    await page.getByRole('tab', { name: '来源冲突' }).click();
    await page.getByRole('combobox', { name: 'YDBRD-12 的主来源' }).selectOption('source-2');
    await page.locator('[data-pc-confirm]').click();
    await page.getByText('已同步到任务管理').waitFor();
    assert.equal(await page.getByRole('button', { name: '同步任务列表' }).count(), 0,
      '确认成功后不可再次同步同一运行');
    await page.getByRole('button', { name: '重试缺图' }).click();
    await page.getByText('重试完成').waitFor();
    assert.equal(retried, true);
    await page.getByRole('button', { name: '返回同步工作区' }).click();
    await page.getByText('当前已关联 1 项').waitFor();
    await page.locator('[data-workspace-panel="list"] tbody').getByText('YDBRD-12', { exact: true }).waitFor();
    await page.getByRole('button', { name: '返回来源' }).click();
    assert.equal(confirmed.primarySources['YDBRD-12'], 'source-2');
    assert.equal(confirmed.digest, 'a'.repeat(64));
    await page.locator('[data-pc-source="source-1"]').click();
    await page.getByRole('heading', { name: 'Pingcode 来源 / 版本需求' }).waitFor();
    failNextRun = true;
    await page.locator('[data-pc-workspace-sync]').click();
    await page.getByRole('alert').getByText(/本次同步未完成：关联工作项不完整/).waitFor();
    assert.equal(await page.locator('[data-pc-workspace-sync]').isEnabled(), true);
    assert.equal(runCreateRequests, 2);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.pingcode-workspace-tabs [data-pc-workspace-pane="detail"]').click();
    assert.equal(await page.locator('[data-workspace-panel="detail"]').isVisible(), true);
    assert.equal(await page.locator('[data-workspace-panel="list"]').isVisible(), false);
    await page.locator('.pingcode-detail-back').click();
    assert.equal(await page.locator('[data-workspace-panel="list"]').isVisible(), true);
    await assertTouchTargets(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('添加来源提交表单后回到来源列表并显示登记成功', async () => {
  const app = express();
  app.use(express.json());
  app.use('/frontend', express.static(frontend));
  const route = '/knowledge-center/api/platform/plugins/pingcode';
  let created = null;
  let createRequests = 0;
  app.get(route + '/sources', (req, res) => res.json({ success: true, data: created ? [created] : [] }));
  app.post(route + '/sources', (req, res) => {
    createRequests++;
    created = { id: 'source-added', ...req.body, state: 'ACTIVE', revision: 1 };
    res.status(201).json({ success: true, data: created });
  });
  app.get(route + '/sources/source-added/runs', (req, res) => res.json({ success: true, data: [] }));
  app.get('/', (req, res) => res.type('html').send(`<!doctype html><html lang="zh-CN"><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="/frontend/common/tokens.css"><link rel="stylesheet" href="/frontend/common/base.css">
    <link rel="stylesheet" href="/frontend/common/components.css"><link rel="stylesheet" href="/frontend/modules/platform-admin/pingcode-sync.css">
    </head><body><main data-pingcode-sync></main><script type="module">import { mountPingcodeSync } from '/frontend/modules/platform-admin/pingcode-sync.js';
      mountPingcodeSync(document.querySelector('[data-pingcode-sync]'));</script></body></html>`));
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(() => {
      Object.defineProperty(Crypto.prototype, 'randomUUID', { configurable: true, value: undefined });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    assert.equal(await page.evaluate(() => typeof crypto.randomUUID), 'undefined');
    await page.getByRole('button', { name: '添加来源' }).waitFor();
    await page.getByRole('button', { name: '添加来源' }).click();
    const form = page.locator('[data-pc-form]');
    await form.locator('[name="name"]').fill('YASHAN Yq_yJCzT 需求基线');
    await form.locator('[name="type"]').selectOption('REQUIREMENT');
    await form.locator('[name="url"]').fill('https://pingcode.yasdb.com/ship/products/YASHAN/baselines/Yq_yJCzT/ideas?category=all');
    const response = page.waitForResponse(item => item.request().method() === 'POST'
      && item.url().endsWith('/platform/plugins/pingcode/sources'), { timeout: 5000 });
    await form.getByRole('button', { name: '保存来源' }).click();
    assert.equal((await response).status(), 201);
    await page.getByText('来源已添加', { exact: true }).waitFor();
    assert.equal(createRequests, 1);
    assert.equal(await page.locator('[data-pc-source="source-added"]').count(), 1);
    assert.equal(await page.locator('[data-pc-detail-dialog]').count(), 0);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('尚无来源与来源接口故障显示不同状态', async () => {
  const app = express();
  app.use('/frontend', express.static(frontend));
  let sourceReads = 0;
  app.get('/knowledge-center/api/platform/plugins/pingcode/sources', (req, res) => {
    if (++sourceReads > 1) return res.status(503).json({ success: false, error: { message: '来源服务不可用' } });
    res.json({ success: true, data: [] });
  });
  app.get('/', (req, res) => res.type('html').send(`<!doctype html><html lang="zh-CN"><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="/frontend/common/tokens.css"><link rel="stylesheet" href="/frontend/common/base.css">
    <link rel="stylesheet" href="/frontend/common/components.css"><link rel="stylesheet" href="/frontend/modules/platform-admin/pingcode-sync.css">
    </head><body><main data-pingcode-sync></main><script type="module">import { mountPingcodeSync } from '/frontend/modules/platform-admin/pingcode-sync.js';
      mountPingcodeSync(document.querySelector('[data-pingcode-sync]'));</script></body></html>`));
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    await page.goto(baseUrl);
    await page.getByText('尚未添加 Pingcode 来源').waitFor();
    await page.getByRole('button', { name: '刷新' }).click();
    await page.getByText('暂时无法读取来源').waitFor();
    await page.getByText('来源服务不可用').waitFor();
    assert.equal(await page.getByText('尚未添加 Pingcode 来源').count(), 0);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('来源列表提供直达编辑、启停和受保护删除入口', async () => {
  const app = express();
  app.use(express.json());
  app.use('/frontend', express.static(frontend));
  const route = '/knowledge-center/api/platform/plugins/pingcode';
  let current = { ...source, revision: 1, deletable: true };
  let patchCount = 0, deleteCount = 0, failNextState = false;
  app.get(route + '/sources', (req, res) => res.json({ success: true, data: current ? [current] : [] }));
  app.get(route + '/sources/source-1', (req, res) => res.json({ success: true, data: current }));
  app.get(route + '/sources/source-1/runs', (req, res) => res.json({ success: true, data: [] }));
  app.patch(route + '/sources/source-1', (req, res) => {
    patchCount++; current = { ...current, ...req.body, revision: current.revision + 1 };
    res.json({ success: true, data: current });
  });
  app.patch(route + '/sources/source-1/state', (req, res) => {
    patchCount++;
    if (failNextState) { failNextState = false; return res.status(503).json({ success: false, error: { message: '状态更新失败' } }); }
    assert.equal(req.body.revision, current.revision);
    current = { ...current, state: req.body.state, revision: current.revision + 1 };
    res.json({ success: true, data: current });
  });
  app.delete(route + '/sources/source-1', (req, res) => {
    assert.equal(req.headers['if-match'], String(current.revision));
    deleteCount++; current = null; res.json({ success: true, data: { deleted: true } });
  });
  app.get('/', (req, res) => res.type('html').send(`<!doctype html><html lang="zh-CN"><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="/frontend/common/tokens.css"><link rel="stylesheet" href="/frontend/common/base.css">
    <link rel="stylesheet" href="/frontend/common/components.css"><link rel="stylesheet" href="/frontend/modules/platform-admin/pingcode-sync.css">
    </head><body><main data-pingcode-sync></main><script type="module">import { mountPingcodeSync } from '/frontend/modules/platform-admin/pingcode-sync.js';
      mountPingcodeSync(document.querySelector('[data-pingcode-sync]'));</script></body></html>`));
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('[data-pc-open="source-1"]').waitFor();
    assert.equal(await page.locator('[data-pc-source="source-1"] .pingcode-row-actions [data-pc-edit-source]').count(), 1);
    const sourceRow = page.locator('[data-pc-source="source-1"]');
    const sourceSwitch = sourceRow.getByRole('switch', { name: '停用版本需求' });
    assert.equal(await sourceSwitch.getAttribute('aria-checked'), 'true');
    assert.match(await sourceSwitch.evaluate(element => getComputedStyle(element).fontFamily), /^"?Microsoft YaHei/i);
    await page.locator('[data-pc-source="source-1"] [data-pc-edit-source]').click();
    assert.equal(await page.locator('[data-pc-detail-dialog]').count(), 0);
    const edit = page.locator('[data-pc-edit-form]');
    assert.deepEqual(await edit.locator('[name="productType"] option').allTextContents(), ['DB', 'YCM', 'YMP', 'YDC']);
    await edit.locator('[name="name"]').fill('变更后的需求来源');
    const edited = page.waitForResponse(item => item.request().method() === 'PATCH'
      && item.url().endsWith('/sources/source-1'));
    await edit.getByRole('button', { name: '保存修改' }).click();
    assert.equal((await edited).status(), 200);
    await page.getByText('来源已更新', { exact: true }).waitFor();
    const disabled = page.waitForResponse(item => item.request().method() === 'PATCH'
      && item.url().endsWith('/sources/source-1/state'));
    await sourceRow.getByRole('switch').click();
    assert.equal((await disabled).status(), 200);
    await page.waitForFunction(() => document.querySelector('[data-pc-source="source-1"] [role="switch"]')?.getAttribute('aria-checked') === 'false');
    const restored = page.waitForResponse(item => item.request().method() === 'PATCH'
      && item.url().endsWith('/sources/source-1/state'));
    await sourceRow.getByRole('switch').press('Space');
    assert.equal((await restored).status(), 200);
    await page.waitForFunction(() => document.querySelector('[data-pc-source="source-1"] [role="switch"]')?.getAttribute('aria-checked') === 'true');
    failNextState = true;
    const failed = page.waitForResponse(item => item.request().method() === 'PATCH'
      && item.url().endsWith('/sources/source-1/state'));
    await sourceRow.getByRole('switch').click();
    assert.equal((await failed).status(), 503);
    await page.getByText('状态更新失败', { exact: true }).waitFor();
    assert.equal(await sourceRow.getByRole('switch').getAttribute('aria-checked'), 'true');
    await page.setViewportSize({ width: 390, height: 844 });
    const layout = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.pingcode-row-actions button, .pingcode-row-actions summary')]
        .filter(button => button.getClientRects().length).map(button => button.getBoundingClientRect().height);
      return { viewportWidth: document.documentElement.clientWidth, pageWidth: document.documentElement.scrollWidth,
        buttons };
    });
    assert.ok(layout.pageWidth <= layout.viewportWidth, '窄屏管理操作不应造成页面横向溢出');
    assert.ok(layout.buttons.every(height => height >= 44), '窄屏来源操作点击区至少 44px');
    assert.equal(await page.locator('[data-pc-source="source-1"] [data-pc-delete-source]').count(), 1);
    const more = sourceRow.locator('.pingcode-more');
    await more.locator('summary').click();
    await more.getByRole('button', { name: '删除' }).click();
    const deleted = page.waitForResponse(item => item.request().method() === 'DELETE'
      && item.url().endsWith('/sources/source-1'));
    await page.locator('[data-pc-delete-form]').getByRole('button', { name: '确认删除' }).click();
    assert.equal((await deleted).status(), 200);
    assert.equal(patchCount, 4);
    assert.equal(deleteCount, 1);
    await page.locator('[data-pc-source="source-1"]').waitFor({ state: 'detached' });
  } finally {
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
});

test('关系数据不完整时显示明确失败结果，不显示空白预览', async () => {
  const app = express();
  app.use('/frontend', express.static(frontend));
  const failed = { id: 'run-failed', sourceId: source.id, status: 'FAILED', rowsRead: 200,
    errorCode: 'PINGCODE_RELATION_INCOMPLETE', createdAt: new Date().toISOString() };
  const route = '/knowledge-center/api/platform/plugins/pingcode';
  app.get(route + '/sources', (req, res) => res.json({ success: true, data: [source] }));
  app.get(route + '/sources/source-1', (req, res) => res.json({ success: true, data: source }));
  app.get(route + '/sources/source-1/runs', (req, res) => res.json({ success: true, data: [failed] }));
  app.post(route + '/sources/source-1/runs', (req, res) => res.json({ success: true, data: { ...failed, status: 'COLLECTING' } }));
  app.get(route + '/runs/run-failed', (req, res) => res.json({ success: true, data: failed }));
  app.get('/', (req, res) => res.type('html').send(`<!doctype html><html lang="zh-CN"><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="/frontend/common/tokens.css"><link rel="stylesheet" href="/frontend/common/base.css">
    <link rel="stylesheet" href="/frontend/common/components.css"><link rel="stylesheet" href="/frontend/modules/platform-admin/pingcode-sync.css">
    </head><body><main data-pingcode-sync></main><script type="module">import { mountPingcodeSync } from '/frontend/modules/platform-admin/pingcode-sync.js';
      mountPingcodeSync(document.querySelector('[data-pingcode-sync]'));</script></body></html>`));
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('[data-pc-source="source-1"]').waitFor();
    await page.locator('[data-pc-source="source-1"]').click();
    await page.locator('[data-pc-workspace-sync]').click();
    await page.getByRole('alert').getByText('本次同步未完成：关联工作项不完整，本次未生成预览。请修复来源问题后重试。').waitFor();
    assert.equal(await page.locator('.pingcode-preview').count(), 0);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('切换来源后，较慢的旧详情响应不能覆盖当前来源', async () => {
  const app = express();
  app.use('/frontend', express.static(frontend));
  const route = '/knowledge-center/api/platform/plugins/pingcode';
  const sourceA = { ...source, id: 'source-a', name: '慢响应来源 A' };
  const sourceB = { ...source, id: 'source-b', name: '快响应来源 B' };
  app.get(route + '/sources', (req, res) => res.json({ success: true, data: [sourceA, sourceB] }));
  app.get(route + '/sources/source-a', (_req, res) => res.json({ success: true, data: sourceA }));
  app.get(route + '/sources/source-b', (_req, res) => res.json({ success: true, data: sourceB }));
  app.get(route + '/sources/source-a/items', (_req, res) => setTimeout(() => res.json({ success: true,
    data: { items: [], total: 0, page: 1, pageSize: 50 } }), 250));
  app.get(route + '/sources/source-b/items', (_req, res) => res.json({ success: true,
    data: { items: [], total: 0, page: 1, pageSize: 50 } }));
  app.get(route + '/sources/:id/runs', (_req, res) => res.json({ success: true, data: [] }));
  app.get('/', (req, res) => res.type('html').send(`<!doctype html><html lang="zh-CN"><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="/frontend/common/tokens.css"><link rel="stylesheet" href="/frontend/common/base.css">
    <link rel="stylesheet" href="/frontend/common/components.css"><link rel="stylesheet" href="/frontend/modules/platform-admin/pingcode-sync.css">
    </head><body><main data-pingcode-sync></main><script type="module">import { mountPingcodeSync } from '/frontend/modules/platform-admin/pingcode-sync.js';
      mountPingcodeSync(document.querySelector('[data-pingcode-sync]'));</script></body></html>`));
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('[data-pc-source="source-a"]').waitFor();
    await page.locator('[data-pc-source="source-a"]').click();
    await page.getByRole('button', { name: '返回来源' }).waitFor();
    await page.getByRole('button', { name: '返回来源' }).click();
    await page.locator('[data-pc-source="source-b"]').click();
    await page.getByRole('heading', { name: 'Pingcode 来源 / 快响应来源 B' }).waitFor();
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.pingcode-sync-header h2').innerText(), 'Pingcode 来源 / 快响应来源 B',
      'A 的迟到任务列表不得替换当前选中的 B');
  } finally {
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
});

test('同步内容入口显示来源任务分页、产品类型和确认快照正文', async () => {
  const app = express();
  app.use('/frontend', express.static(frontend));
  const route = '/knowledge-center/api/platform/plugins/pingcode';
  const configured = { ...source, productType: 'YCM', syncedTaskCount: 1 };
  app.get(route + '/sources', (_req, res) => res.json({ success: true, data: [configured] }));
  app.get(route + '/sources/source-1', (_req, res) => res.json({ success: true, data: configured }));
  app.get(route + '/sources/source-1/items', (_req, res) => res.json({ success: true, data: {
    items: [{ number: 'YDBRD-21', title: '存量需求', ir: ['YASHAN-5'], confirmedAt: '2026-11-13T03:00:00Z' }],
    total: 1, page: 1, pageSize: 50,
  } }));
  app.get(route + '/sources/source-1/items/YDBRD-21', (_req, res) => res.json({ success: true, data: {
    number: 'YDBRD-21', title: '存量需求', markdown: '# 已确认正文\n正文内容', ir: ['YASHAN-5'], resources: [],
  } }));
  let runReads = 0, activeRun = { id: 'run-preview', sourceId: 'source-1', status: 'COLLECTING',
    rowsRead: 0, createdAt: '2026-11-13T03:00:00Z' };
  app.get(route + '/sources/source-1/runs', (_req, res) => res.json({ success: true, data: [activeRun] }));
  app.post(route + '/sources/source-1/runs', (_req, res) => res.json({ success: true, data: activeRun }));
  app.get(route + '/runs/run-preview', (_req, res) => {
    if (++runReads > 0) activeRun = { ...activeRun, status: 'AWAITING_CONFIRM', rowsRead: 1,
      srCount: 1, newCount: 1, changedCount: 0, removedCount: 0, digest: 'c'.repeat(64) };
    res.json({ success: true, data: activeRun });
  });
  app.get(route + '/runs/run-preview/items', (_req, res) => res.json({ success: true, data: {
    items: [{ number: 'YDBRD-22', title: '待确认需求', ir: ['YASHAN-6'] }], total: 1, page: 1, pageSize: 50,
  } }));
  app.get(route + '/runs/run-preview/items/YDBRD-22', (_req, res) => res.json({ success: true, data: {
    number: 'YDBRD-22', title: '待确认需求', markdown: '# 本次采集正文', ir: ['YASHAN-6'], resources: [],
  } }));
  app.get(route + '/runs/run-preview/preview', (_req, res) => res.json({ success: true, data: {
    run: activeRun, total: 1, items: [{ number: 'YDBRD-22', title: '待确认需求', action: 'created', ir: ['YASHAN-6'],
      sources: [{ id: 'source-1', name: '版本需求', primary: true }] }],
  } }));
  app.post(route + '/runs/run-preview/confirm', (_req, res) => {
    activeRun = { ...activeRun, status: 'CONFIRMED' }; res.json({ success: true, data: activeRun });
  });
  app.get(route + '/runs/run-preview/resources', (_req, res) => res.json({ success: true, data: { total: 0, items: [] } }));
  app.get('/', (req, res) => res.type('html').send(`<!doctype html><html lang="zh-CN"><head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="/frontend/common/tokens.css"><link rel="stylesheet" href="/frontend/common/base.css">
    <link rel="stylesheet" href="/frontend/common/components.css"><link rel="stylesheet" href="/frontend/modules/platform-admin/pingcode-sync.css">
    </head><body><main data-pingcode-sync></main><script type="module">import { mountPingcodeSync } from '/frontend/modules/platform-admin/pingcode-sync.js';
      mountPingcodeSync(document.querySelector('[data-pingcode-sync]'));</script></body></html>`));
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('[data-pc-source="source-1"]').waitFor();
    assert.equal(await page.getByRole('button', { name: '查看已同步内容：版本需求' }).count(), 1);
    await page.getByRole('button', { name: '查看已同步内容：版本需求' }).click();
    await page.getByText('当前已关联 1 项').waitFor();
    await page.getByRole('button', { name: 'YDBRD-21' }).click();
    await page.locator('.pingcode-workitem-markdown').getByRole('heading', { name: '已确认正文' }).waitFor();
    assert.match(await page.locator('.pingcode-sync-header').innerText(), /YCM/);
    await page.locator('[data-pc-workspace-sync]').click();
    await page.locator('[data-pc-run-item="YDBRD-22"]').first().waitFor();
    await page.locator('[data-pc-run-item="YDBRD-22"]').first().click();
    await page.getByText('本次采集正文', { exact: false }).waitFor();
    await page.getByRole('button', { name: '查看任务变化' }).click();
    await page.locator('.pingcode-preview').waitFor();
    const confirmed = page.waitForResponse(response => response.request().method() === 'POST'
      && response.url().endsWith('/runs/run-preview/confirm'));
    await page.locator('[data-pc-confirm]').click();
    assert.equal((await confirmed).status(), 200);
    await page.getByText('已同步到任务管理', { exact: true }).waitFor();
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
