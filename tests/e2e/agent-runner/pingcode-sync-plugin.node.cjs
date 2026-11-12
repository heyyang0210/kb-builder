const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const path = require('node:path');
const { chromium } = require('playwright');

const frontend = path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center');
const source = { id: 'source-1', name: '版本需求', type: 'REQUIREMENT',
  url: 'https://pingcode.yasdb.com/ship/products/YASHAN/baselines/demo/ideas',
  state: 'ACTIVE', revision: 1 };
const sources = [source, { ...source, id: 'source-2', name: '历史工单', type: 'TICKET',
  url: 'https://pingcode.yasdb.com/pjm/projects/YDBRD/defect', state: 'INACTIVE' }];

test('插件来源表格支持筛选、详情弹窗与同步全流程；窄屏不溢出', async () => {
  const app = express();
  app.use(express.json());
  app.use('/frontend', express.static(frontend));
  let run = null, reads = 0, confirmed = null, retried = false, runListRequests = 0;
  const route = '/knowledge-center/api/platform/plugins/pingcode';
  app.get(route + '/sources', (req, res) => res.json({ success: true, data: sources }));
  app.get(route + '/sources/source-1', (req, res) => res.json({ success: true, data: source }));
  app.get(route + '/sources/source-1/runs', (req, res) => {
    runListRequests++;
    res.json({ success: true, data: run ? [run] : [] });
  });
  app.post(route + '/sources/source-1/runs', (req, res) => {
    run = { id: 'run-1', sourceId: source.id, status: 'COLLECTING', rowsRead: 0, createdAt: new Date().toISOString() };
    res.json({ success: true, data: run });
  });
  app.get(route + '/runs/run-1', (req, res) => {
    if (++reads >= 2 && run.status === 'COLLECTING') Object.assign(run, { status: 'AWAITING_CONFIRM',
      rowsRead: 2, srCount: 1, newCount: 1, changedCount: 0, removedCount: 0, digest: 'a'.repeat(64) });
    res.json({ success: true, data: run });
  });
  app.get(route + '/runs/run-1/preview', (req, res) => res.json({ success: true, data: {
    run, total: req.query.view === 'removed' ? 0 : 1, items: req.query.view === 'removed' ? [] : [{
      number: 'YDBRD-12', title: '测试任务', action: 'created', ir: ['YASHAN-1'],
      sources: [{ id: 'source-1', name: '版本需求', primary: false }, { id: 'source-2', name: '工单视图', primary: false }],
    }],
  } }));
  app.post(route + '/runs/run-1/confirm', (req, res) => {
    confirmed = req.body;
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
    assert.equal(runListRequests, 0, '首屏只加载来源列表，不应逐来源请求运行记录');
    await page.getByRole('button', { name: '添加来源' }).click();
    const addDialog = page.locator('[data-pc-add-dialog]');
    await addDialog.waitFor();
    assert.ok((await addDialog.boundingBox()).height < 520, '添加来源弹窗应按表单内容收缩');
    await page.locator('[data-pc-add-close]').first().click();
    await page.locator('[data-pc-search]').fill('工单');
    await page.getByText('历史工单', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-pc-source]').count(), 1);
    await page.locator('[data-pc-search]').fill('');
    await page.locator('[data-pc-type]').selectOption('REQUIREMENT');
    assert.equal(await page.locator('[data-pc-source]').count(), 1);
    await page.locator('[data-pc-type]').selectOption('all');
    await page.locator('[data-pc-enabled]').selectOption('INACTIVE');
    assert.equal(await page.locator('[data-pc-source]').count(), 1);
    await page.locator('[data-pc-enabled]').selectOption('all');
    await page.getByRole('button', { name: '详情' }).first().click();
    await page.locator('[data-pc-detail-dialog]').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('[data-pc-detail-dialog]').waitFor({ state: 'hidden' });
    await page.locator('[data-pc-source="source-1"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-pc-detail-dialog]').waitFor();
    await page.getByRole('button', { name: '测试连接' }).waitFor();
    await page.locator('[data-pc-detail-close]').click();
    await page.getByRole('button', { name: '详情' }).first().click();
    await page.getByRole('button', { name: '预览同步' }).click();
    await page.getByRole('button', { name: '确认同步' }).waitFor();
    await page.getByRole('tab', { name: '来源冲突' }).click();
    await page.getByRole('combobox', { name: 'YDBRD-12 的主来源' }).selectOption('source-2');
    await page.getByRole('button', { name: '确认同步' }).click();
    await page.getByText('同步已确认').waitFor();
    await page.getByRole('button', { name: '重试缺图' }).click();
    await page.getByText('重试完成').waitFor();
    assert.equal(retried, true);
    await page.locator('[data-pc-detail-close]').click();
    await page.getByRole('button', { name: '刷新' }).click();
    await page.getByText('已开始重试缺失图片', { exact: true }).waitFor();
    await page.getByRole('button', { name: '详情' }).first().click();
    await page.locator('.pingcode-run-status[data-status="CONFIRMED"]').waitFor();
    assert.equal(confirmed.primarySources['YDBRD-12'], 'source-2');
    assert.equal(confirmed.digest, 'a'.repeat(64));
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('添加来源提交表单并在详情中显示登记成功', async () => {
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
    await page.locator('[data-pc-detail-dialog]').waitFor({ state: 'visible' });
    await page.locator('[data-pc-detail-dialog]').getByText('来源已添加', { exact: true }).waitFor();
    assert.equal(createRequests, 1);
    assert.equal(await page.locator('[data-pc-source="source-added"]').count(), 1);
    assert.equal(await page.locator('[data-pc-detail-dialog] a').getAttribute('href'), created.url);
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
    await page.getByRole('button', { name: '详情' }).waitFor();
    await page.getByRole('button', { name: '详情' }).click();
    await page.getByRole('button', { name: '预览同步' }).click();
    await page.getByText('关联工作项不完整，本次未生成预览').waitFor();
    assert.equal(await page.locator('.pingcode-preview').count(), 0);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
