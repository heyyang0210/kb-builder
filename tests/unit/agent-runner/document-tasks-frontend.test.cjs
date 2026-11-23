const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { chromium } = require('playwright');
const { createDocumentTaskRouter } = require('../../../packages/agent-runner-core/routes/document-tasks');
const { migrate } = require('../../../tools/repository/migrate-document-tasks.cjs');
const root = path.resolve(__dirname, '../../..');
const output = path.join(root, 'runtime/diagnostics/task-split-20261102/browser');
const coverageCases = process.env.KC_FRONTEND_ISTANBUL_CASE_DIR;
const coverageKey = '__kc_istanbul_coverage__';
const frontendRoot = path.join(root, 'apps/knowledge-center-web/frontend/knowledge-center');
fs.mkdirSync(output, { recursive: true });

test('迁移预检保留原始记录，旧完成不能直接认定完成', () => {
  const original = { tasks: [{ number: 'OLD-1', status: 'completed', ownerId: 'person', decomposition: { ticketImpact: 'not_involved' } }] };
  const copy = JSON.stringify(original), result = migrate(original, 'person');
  assert.equal(JSON.stringify(original), copy);
  assert.equal(result.state.tasks[0].decomposition.confirmed, false);
  assert.deepEqual(result.state.tasks[0].legacy, original.tasks[0]);
  assert.equal(result.state.tasks[0].endTime, null);
  assert.ok(result.issues.some(i => i.message.includes('待补证据')));
  assert.ok(migrate([{ number: 'A' }, { number: 'A' }]).issues.some(i => i.blocking));
});

test('实际模块与真实HTTP：导入、独立两级范围、新增提案、刷新和390px', async () => {
  const scratch = path.join(root, 'runtime/test-results');
  fs.mkdirSync(scratch, { recursive: true });
  const directory = fs.mkdtempSync(path.join(scratch, 'task-browser-'));
  const app = express(); let user = 'owner';
  let delayDetail = false, delayList = false, detailReads = 0, outlinePublished = true, linkedReview = null;
  app.use((req, res, next) => {
    if (delayList && req.method === 'GET' && req.path === '/knowledge-center/api/document-tasks') {
      setTimeout(next, 300); return;
    }
    if (delayDetail && req.method === 'GET' && req.path === '/knowledge-center/api/document-tasks/PC-1') {
      detailReads++; setTimeout(next, 300); return;
    }
    next();
  });
  const people = ['owner', 'book', 'writer', 'next'].map(id => ({ id, displayName: { owner: '总负责人', book: '手册负责人', writer: '文档负责人', next: '新负责人' }[id] }));
  app.use('/knowledge-center/api/document-tasks', createDocumentTaskRouter({ filePath: path.join(directory, 'tasks.json'), defaultOwnerId: 'owner', context: () => ({ session: { user: { id: user, allowedActions: ['knowledge:read', 'knowledge:write', 'outline:create', ...(user === 'owner' ? ['platform:manage'] : [])] } }, people, handbooks: [{ id: 'H1', name: '第一本手册', ownerId: 'book' }, { id: 'H2', name: '第二本手册' }], catalog: async () => ({ versions: ['23.4'], outlineId: 'outline-test', outlineVersionId: outlinePublished ? 'published-v1' : null, directory: { nodes: [{ id: 'P1', kind: 'part', title: '第一部分' }, { id: 'C1', parentId: 'P1', kind: 'chapter', title: '第一章' }] }, documents: outlinePublished ? [{ id: 'D1', name: '安装说明', parentId: 'C1', ownerId: 'writer', ownerMatch: 'primary' }, { id: 'D2', name: '新增说明', parentId: 'C1' }] : [], chapters: [{ id: 'C1', name: '第一章', parentId: 'P1' }] }), createDocument: async () => ({ outlineId: 'proposal-outline', documentId: 'D2', state: 'draft' }), reviewService: { list: () => linkedReview ? [{ id: linkedReview.id }] : [], get: () => linkedReview } }) }));
  app.use('/frontend', express.static(path.join(root, 'apps/knowledge-center-web/frontend')));
  app.get('/', (req, res) => res.type('html').send(`<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/frontend/knowledge-center/common/components.css"><link rel="stylesheet" href="/frontend/knowledge-center/modules/document-tasks/document-tasks.css"><style>*{box-sizing:border-box}body{margin:20px;font:14px Arial}.button{padding:8px;border:1px solid #ccc;background:white;border-radius:5px}</style></head><body><main id="view-root"></main><script src="/frontend/knowledge-center/common/vendor/lucide.min.js"></script><script type="module">import {loadDocumentTaskWorkspace,renderDocumentTasks} from '/frontend/knowledge-center/modules/document-tasks/view.js';renderDocumentTasks({documentTaskProjection:await loadDocumentTaskWorkspace()});</script></body></html>`));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); const errors = []; page.on('pageerror', error => errors.push(error.message));
  const coverageSnapshots = [];
  if (coverageCases) {
    const { createInstrumenter } = require('istanbul-lib-instrument');
    const instrumenter = createInstrumenter({ esModules: true, coverageVariable: coverageKey, compact: false });
    await page.addInitScript(key => { globalThis[key] = {}; }, coverageKey);
    await page.route('**/frontend/knowledge-center/**/*.js', async route => {
      const pathname = new URL(route.request().url()).pathname;
      const relative = pathname.replace(/^\/frontend\/knowledge-center\//, '');
      const file = path.resolve(frontendRoot, relative);
      if (!pathname.startsWith('/frontend/knowledge-center/') || !file.startsWith(frontendRoot + path.sep) ||
          relative.split('/').includes('vendor') || !fs.existsSync(file)) return route.continue();
      const response = await route.fetch();
      if (!response.ok()) return route.fulfill({ response });
      return route.fulfill({ response, body: instrumenter.instrumentSync(await response.text(), file) });
    });
  }
  await page.addInitScript(() => { Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true }); });
  await page.addInitScript(() => {
    window.__taskOpenMeasurements = [];
    document.addEventListener('click', event => {
      const button = event.target.closest?.('[data-task-open]');
      if (!button) return;
      const started = performance.now();
      const number = button.dataset.taskOpen;
      const observer = new MutationObserver(() => {
        if (!document.querySelector('.task-workspace')) return;
        observer.disconnect();
        const domReady = performance.now();
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const api = performance.getEntriesByType('resource').filter(entry => entry.name.includes(`/document-tasks/${encodeURIComponent(number)}`)).at(-1);
          window.__taskOpenMeasurements.push({ number, domMs: +(domReady - started).toFixed(1), paintedMs: +(performance.now() - started).toFixed(1), apiMs: api ? +(api.responseEnd - started).toFixed(1) : null });
        }));
      });
      observer.observe(document.querySelector('#view-root'), { childList: true, subtree: true });
    }, true);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const captureCoverage = async () => {
    if (!coverageCases || page.isClosed() || !page.url().startsWith(base)) return;
    const snapshot = await page.evaluate(key => globalThis[key] || {}, coverageKey);
    if (Object.keys(snapshot).length) coverageSnapshots.push(snapshot);
  };
  const navigate = async url => { await captureCoverage(); await page.goto(url); };
  const timings = [];
  const timed = async (name, fn) => { const started = performance.now(); await fn(); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); timings.push({ name, ms: +(performance.now() - started).toFixed(1) }); };
  const reload = async () => { await navigate(base); await page.locator('.document-task-page').waitFor(); };
  const open = async number => timed('打开任务详情', async () => { await page.getByRole('button', { name: number, exact: true }).click(); await page.getByLabel('任务详情').waitFor(); });
  const assertWorkspaceTouchTargets = async () => {
    const heights = await page.locator('.task-workspace :is([data-task-action=close], .task-next-action .button, .task-ticket-scope>.button, .task-book .task-section-heading button, .task-secondary-actions>summary):visible, .task-scope-dialog footer button:visible, .task-inline-dialog footer button:visible').evaluateAll(nodes => nodes.map(node => ({ label: node.innerText.trim() || node.getAttribute('aria-label'), height: node.getBoundingClientRect().height })));
    assert.ok(heights.length > 0, 'workspace should expose an actionable control');
    assert.ok(heights.every(item => item.height >= 44), `workspace touch targets must be at least 44px: ${JSON.stringify(heights)}`);
  };
  const confirm = async () => {
    const dialog = page.locator('.document-task-dialog[open]');
    const label = await dialog.getAttribute('aria-label');
    await timed('保存：' + label, async () => {
      await dialog.locator('button[value=confirm]').click();
      await dialog.waitFor({ state: 'detached' });
      await page.waitForFunction(() => !document.querySelector('#view-root[aria-busy=true]'));
    });
  };
  try {
    await reload();
    assert.equal(await page.locator('.document-task-page-header h1').count(), 0);
    assert.equal(await page.locator('.document-task-more>summary[aria-label="更多操作"]').count(), 1);
    const filterHeights = await page.locator('.document-task-toolbar input:not([type=hidden]),.document-task-toolbar select:not(.searchable-combobox-native),.document-task-toolbar>button').evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().height)));
    assert.ok(filterHeights.length && filterHeights.every(height => height === 44), `filter control height should match platform token: ${filterHeights}`);
    const desktopFilterRows = await page.locator('.document-task-toolbar>*:not(select.searchable-combobox-native)').evaluateAll(nodes => new Set(nodes.map(node => Math.round(node.getBoundingClientRect().top))).size);
    assert.equal(desktopFilterRows, 1, 'desktop filters should stay on one compact row');
    await page.screenshot({ path: path.join(output, '00-task-list-layout.png') });
    assert.equal(await page.locator('.document-task-tabs, [data-task-tab], .document-task-config').count(), 0);
    assert.equal(await page.getByText('正在读取任务…', { exact: true }).count(), 0);
    delayList = true;
    await page.locator('[data-task-action=refresh]').click();
    await page.waitForFunction(() => document.querySelector('#view-root[aria-busy=true]'));
    assert.equal(await page.getByText('正在读取任务…', { exact: true }).count(), 0);
    assert.equal(await page.locator('[data-task-message]:visible').count(), 0);
    delayList = false;
    await page.waitForFunction(() => !document.querySelector('#view-root[aria-busy=true]'));
    const sourceMarkdown = await page.evaluate(async () => {
      const { renderSourceMarkdown, renderSourceRecord } = await import('/frontend/knowledge-center/common/safe-source-markdown.js');
      return {
        empty: renderSourceMarkdown(null),
        unsafeHtml: renderSourceMarkdown('<img src=x onerror=alert(1)>'),
        safeLink: renderSourceMarkdown('[参考](https://example.test/source)'),
        unsafeLink: renderSourceMarkdown('[危险](javascript:alert(1))'),
        image: renderSourceMarkdown('![图<&](https://example.test/image.png)'),
        emptyRecord: renderSourceRecord(null, null),
        unsafeTitleRecord: renderSourceRecord('<img src=x onerror=alert(1)>', '正文'),
      };
    });
    assert.match(sourceMarkdown.empty, /暂无详情内容/);
    assert.match(sourceMarkdown.unsafeHtml, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(sourceMarkdown.unsafeHtml, /<img/);
    assert.match(sourceMarkdown.safeLink, /href="https:\/\/example\.test\/source"/);
    assert.match(sourceMarkdown.safeLink, /rel="noopener noreferrer"/);
    assert.doesNotMatch(sourceMarkdown.unsafeLink, /<a\b/);
    assert.match(sourceMarkdown.unsafeLink, /危险/);
    assert.match(sourceMarkdown.image, /pingcode-image-note/);
    assert.match(sourceMarkdown.image, /图&lt;&amp;/);
    assert.match(sourceMarkdown.emptyRecord, /PingCode 未填写/);
    assert.match(sourceMarkdown.emptyRecord, /暂无详情内容/);
    assert.match(sourceMarkdown.unsafeTitleRecord, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(sourceMarkdown.unsafeTitleRecord, /<p><img/);
    await page.locator('[data-task-file]').setInputFiles({ name: 'tasks.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ number: 'PC-1', title: '跨两本手册更新', sourceUrl: 'https://pingcode.yasdb.com/pjm/workitems/opaque' }, { number: 'PC-2', title: '无文档变更' }])) });
    await page.getByRole('dialog', { name: '导入预览' }).waitFor();
    assert.equal(JSON.parse(fs.existsSync(path.join(directory, 'tasks.json')) ? fs.readFileSync(path.join(directory, 'tasks.json')) : '{"tasks":[]}').tasks.length, 0);
    await page.screenshot({ path: path.join(output, '01-import-preview.png') }); await confirm();
    await page.locator('.document-task-more>summary').click();
    assert.equal(await page.locator('.document-task-more-menu [data-task-action=export]').count(), 1);
    assert.equal(await page.locator('.document-task-more-menu [data-task-action=import]').count(), 1);
    const csvDownloadPromise = page.waitForEvent('download');
    await page.locator('[data-task-action=export]').click();
    const csvDownload = await csvDownloadPromise;
    assert.match(csvDownload.suggestedFilename(), /^document-tasks-\d{14}\.csv$/);
    const csvPath = path.join(directory, csvDownload.suggestedFilename());
    await csvDownload.saveAs(csvPath);
    assert.match(fs.readFileSync(csvPath, 'utf8'), /PC-1/);
    await page.route('**/knowledge-center/api/document-tasks/export.csv**', route => route.fulfill({
      status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: '导出服务暂不可用' } }),
    }), { times: 1 });
    await page.locator('[data-task-action=export]').click();
    await page.getByRole('alert').filter({ hasText: '导出服务暂不可用' }).waitFor();
    await page.unroute('**/knowledge-center/api/document-tasks/export.csv**');
    await page.route('**/knowledge-center/api/document-tasks/export.csv**', route => route.fulfill({
      status: 502, contentType: 'application/json', body: 'invalid response body',
    }), { times: 1 });
    await page.locator('[data-task-action=export]').click();
    await page.locator('[data-task-message]').filter({ hasText: '下载失败（HTTP 502）' }).waitFor();
    await page.unroute('**/knowledge-center/api/document-tasks/export.csv**');
    await page.route('**/knowledge-center/api/document-tasks/export.csv**', route => route.fulfill({
      status: 200, contentType: 'text/csv; charset=utf-8', body: '编号,描述\nPC-1,导出回退',
    }), { times: 1 });
    const fallbackDownloadPromise = page.waitForEvent('download');
    await page.locator('[data-task-action=export]').click();
    const fallbackDownload = await fallbackDownloadPromise;
    assert.equal(fallbackDownload.suggestedFilename(), 'download.csv');
    await page.unroute('**/knowledge-center/api/document-tasks/export.csv**');
    const browserOpenSamples = await page.evaluate(async () => {
      const waitFor = count => new Promise((resolve, reject) => {
        const deadline = performance.now() + 3000;
        const tick = () => window.__taskOpenMeasurements.length >= count ? resolve() : performance.now() > deadline ? reject(new Error('任务详情打开超过3秒')) : setTimeout(tick, 5);
        tick();
      });
      for (let index = 0; index < 30; index++) {
        const count = window.__taskOpenMeasurements.length;
        const apiCount = performance.getEntriesByType('resource').filter(entry => entry.name.includes('/document-tasks/PC-1')).length;
        document.querySelector('[data-task-open="PC-1"]').click();
        await waitFor(count + 1);
        const deadline = performance.now() + 3000;
        while (performance.getEntriesByType('resource').filter(entry => entry.name.includes('/document-tasks/PC-1')).length <= apiCount) {
          if (performance.now() > deadline) throw new Error('后台详情核对超过3秒');
          await new Promise(resolve => setTimeout(resolve, 5));
        }
        while (document.querySelector('#view-root[aria-busy=true]') || !document.querySelector('.task-detail-dialog[open] [data-task-action="close"]')) {
          if (performance.now() > deadline) throw new Error('任务详情交互就绪超过3秒');
          await new Promise(resolve => setTimeout(resolve, 5));
        }
        document.querySelector('.task-detail-dialog[open] [data-task-action="close"]').click();
        while (document.querySelector('.task-detail-dialog')) {
          if (performance.now() > deadline) throw new Error('任务详情关闭超过3秒');
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      }
      return window.__taskOpenMeasurements.slice();
    });
    fs.writeFileSync(path.join(output, 'open-performance.json'), JSON.stringify({ metric: 'browser click to second animation frame after complete detail DOM', samples: browserOpenSamples }, null, 2));
    assert.ok((await page.locator('thead').innerText()).includes('开始时间'));
    assert.ok((await page.locator('thead').innerText()).includes('责任人'));
    assert.equal(await page.getByRole('link', { name: 'PingCode' }).first().getAttribute('href'), 'https://pingcode.yasdb.com/pjm/workitems/opaque');
    const plan = page.getByRole('button', { name: 'PC-1开始时间', exact: true });
    await plan.click(); await page.locator('[name=clock]').fill('10:30');
    await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click(); assert.ok((await plan.innerText()).includes('选择时间'));
    await plan.click(); await page.locator('[name=clock]').fill('10:30');
    await page.screenshot({ path: path.join(output, '07-plan-calendar.png') });
    await page.getByRole('dialog').getByRole('button', { name: '确定', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('dialog[open]') && !document.querySelector('#view-root[aria-busy=true]'));
    assert.ok((await plan.innerText()).includes('10:30'));
    await reload(); assert.ok((await plan.innerText()).includes('10:30'));
    const advanceRevision = async () => {
      const current = (await (await page.request.get(base + '/knowledge-center/api/document-tasks/PC-1')).json()).data;
      const response = await page.request.put(base + '/knowledge-center/api/document-tasks/PC-1/owner', { headers: { 'Idempotency-Key': require('node:crypto').randomUUID() }, data: { expectedRevision: current.revision, ownerId: 'owner' } });
      assert.equal(response.status(), 200);
    };
    // 列表保持旧版本：打开日历必须重新读取，不能直接拿旧版本提交。
    await advanceRevision();
    await page.getByRole('button', { name: 'PC-1结束时间', exact: true }).click();
    await page.locator('[name=clock]').fill('18:30');
    await page.getByRole('dialog').getByRole('button', { name: '确定', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('dialog[open]') && !document.querySelector('#view-root[aria-busy=true]'));
    // 编辑器已打开之后的真实并发更新：409后保留输入，显式读取并确认后才保存。
    await page.getByRole('button', { name: 'PC-1结束时间', exact: true }).click();
    await page.locator('[name=clock]').fill('19:45'); await advanceRevision();
    await page.getByRole('dialog').getByRole('button', { name: '确定', exact: true }).click();
    await page.getByRole('button', { name: '重新读取', exact: true }).waitFor();
    assert.equal(await page.locator('[name=clock]').inputValue(), '19:45');
    let conflicted = (await (await page.request.get(base + '/knowledge-center/api/document-tasks/PC-1')).json()).data;
    assert.ok(conflicted.plannedEndTime.endsWith('10:30:00.000Z'));
    await page.getByRole('button', { name: '重新读取', exact: true }).click();
    await page.getByText(/已读取最新时间/).waitFor();
    assert.equal(await page.locator('[name=clock]').inputValue(), '19:45');
    await page.getByRole('dialog').getByRole('button', { name: '确定', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('dialog[open]') && !document.querySelector('#view-root[aria-busy=true]'));
    await reload(); assert.ok((await page.getByRole('button', { name: 'PC-1结束时间', exact: true }).innerText()).includes('19:45'));

    delayDetail = true;
    await page.getByRole('button', { name: 'PC-1', exact: true }).evaluate(el => { el.click(); el.click(); });
    assert.equal(await page.getByText('正在读取，请稍候…', { exact: true }).count(), 0);
    assert.equal(await page.locator('#view-root').getAttribute('aria-busy'), 'true');
    await page.getByLabel('任务详情').waitFor();
    assert.equal(detailReads, 1, 'pending detail click must not issue duplicate requests');
    delayDetail = false;
    await timed('打开工单范围', async () => { await page.locator('[data-task-action=ticket-scope]').last().click(); await page.getByRole('dialog').waitFor(); });
    await page.locator('.document-task-dialog [data-modal-close]').last().click();
    await page.locator('.task-detail-dialog[open]').waitFor();
    await page.locator('[data-task-action=ticket-scope]').last().click();
    await page.locator('.document-task-dialog[open]').waitFor();
    await page.getByRole('radio', { name: '涉及', exact: true }).check();
    assert.equal(await page.locator('[name="owner:H1"]').inputValue(), 'book');
    assert.equal(await page.getByText('知识资产 A 角').count(), 0);
    await page.screenshot({ path: path.join(output, '11-handbook-owner-auto.png') });
    await timed('搜索手册', async () => { await page.locator('[data-scope-search]').fill('第一本'); assert.equal(await page.locator('[data-choice]:visible').count(), 1); });
    await page.locator('[data-scope-search]').fill('');
    await page.locator('[name=selected][value=H1]').check(); await page.locator('[name="owner:H1"]').selectOption('book');
    await page.locator('[name=selected][value=H2]').check(); await page.locator('[name="owner:H2"]').selectOption('book');
    assert.equal(await page.locator('dialog button[value=draft]').count(), 0);
    await page.screenshot({ path: path.join(output, '02-handbook-scope.png') }); await confirm();
    assert.equal(await page.locator('.task-secondary-scope, .task-ticket-scope').count(), 0);
    assert.equal(await page.locator('.task-handbook-table [data-task-action=book-scope]').count(), 2);
    assert.equal(await page.locator('.task-handbook-table [data-task-action=remove-book]').count(), 2);
    assert.equal(await page.locator('.task-assignment-basic-info').getAttribute('open'), null);
    assert.equal(await page.locator('.task-workspace-history').getAttribute('open'), null);
    assert.equal(await page.locator('.task-drawer-body').evaluate(el => getComputedStyle(el).overflowY), 'visible');
    await assertWorkspaceTouchTargets();
    assert.match(await page.locator('.task-assignment-timeline').innerText(), /文档处理\s+暂无文档任务/);
    assert.equal(await page.locator('.task-workspace-pending').count(), 0);
    assert.equal(await page.locator('[data-task-action=book-owner]').count(), 0);
    assert.match(await page.locator('.task-next-action').innerText(), /负责人已分配 · 文档范围待确认/);
    assert.deepEqual(await page.locator('.task-handbook-table th').allTextContents(), ['手册名称', '产品类型', '目标分支', '文档名称', '状态', '操作']);
    assert.equal(await page.locator('.task-workspace h2').innerText(), '跨两本手册更新');
    assert.equal(await page.locator('.task-assignment-timeline').count(), 1, 'task detail should use the approval-detail stage timeline');
    assert.equal(await page.locator('.task-assignment-basic-info').count(), 1, 'task detail should group core facts in a basic information section');
    assert.equal(await page.locator('.task-assignment-content').count(), 1, 'task detail should group handbook assignments in an assignment content section');
    assert.equal(await page.locator('.task-assignment-history-table').count(), 1, 'task detail should present assignment history as a table');
    assert.equal(await page.locator('.task-assignment-footer').count(), 1, 'task detail should keep available actions in a footer');
    assert.equal(await page.locator('.task-workspace .task-drawer-body').evaluate(element => getComputedStyle(element).display), 'block', 'desktop task assignment details should follow the approval page single-column reading order');
    assert.equal(await page.getByRole('button', { name: '返回任务列表' }).count(), 1, 'task detail should show one return-to-list entry');
    assert.equal(await page.locator('.task-workspace-history pre').count(), 0);
    assert.equal(await page.locator('[data-task-action=add-book]').count(), 0);
    assert.equal(await page.getByRole('button', { name: '新增手册', exact: true }).count(), 0);
    assert.equal(await page.locator('.task-handbook-table tbody tr').count(), 2);
    assert.ok((await (await page.request.get(base + '/knowledge-center/api/document-tasks/PC-1')).json()).data.decomposition.handbooks.some(book => book.id === 'H2'));
    assert.equal(await page.locator('.task-workspace-history pre').count(), 0);
    await reload();
    const detailWithoutHistory = async route => {
      const response = await route.fetch();
      const payload = await response.json();
      delete payload.data.assignmentHistory;
      await route.fulfill({ response, body: JSON.stringify(payload) });
      await page.unroute('**/knowledge-center/api/document-tasks/PC-1', detailWithoutHistory);
    };
    await page.route('**/knowledge-center/api/document-tasks/PC-1', detailWithoutHistory);
    await open('PC-1');
    assert.ok((await page.getByLabel('任务详情').innerText()).includes('负责人已分配'));
    assert.equal(await page.getByLabel('任务详情').count(), 1);
    await page.locator('.task-workspace-history summary').click();
    assert.match(await page.locator('.task-workspace-history').innerText(), /处理记录\s+暂无操作记录/);
    assert.equal(await page.locator('.task-handbook-table [data-task-action=book-scope]').count(), 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, 'task detail must not overflow horizontally');
    assert.ok((await page.getByLabel('任务详情').innerText()).includes('文档范围待确认'));
    user = 'book'; await reload(); assert.equal(await page.locator('[data-task-action=plan]').count(), 0);
    const nextActionSecondBook = async route => {
      const response = await route.fetch();
      const payload = await response.json();
      payload.data.nextAction = { ...payload.data.nextAction, action: 'book-scope', handbookId: 'H2', label: '确认文档范围' };
      await route.fulfill({ response, body: JSON.stringify(payload) });
      await page.unroute('**/knowledge-center/api/document-tasks/PC-1', nextActionSecondBook);
    };
    await page.route('**/knowledge-center/api/document-tasks/PC-1', nextActionSecondBook);
    await open('PC-1');
    assert.equal(await page.locator('.task-workspace').count(), 1);
    assert.equal(await page.locator('[data-task-book-select=H2]').getAttribute('aria-pressed'), 'true', '服务端下一步指向第二本手册时，首屏焦点应与其一致');
    assert.equal(await page.locator('[data-task-book-select=H1]').getAttribute('aria-pressed'), 'false');
    await page.locator('[data-task-book-select=H1]').click();
    await page.locator('[data-task-book-select=H1][aria-pressed=true]').waitFor();
    assert.equal(await page.locator('.task-ticket-scope').count(), 0);
    assert.equal(await page.locator('[data-task-book-select]').count(), 2);
    assert.equal(await page.locator('.task-handbook-table [data-task-action=book-scope]').count(), 2);
    assert.equal(await page.locator('.task-handbook-table').isVisible(), true);
    await page.screenshot({ path: path.join(output, '16-handbook-owner-workspace.png') });
    await assertWorkspaceTouchTargets();
    outlinePublished = false;
    await page.locator('[data-task-action=book-scope][data-book=H1]').click();
    const scopeDialog = page.locator('.task-scope-dialog[open]');
    await scopeDialog.waitFor({ state: 'visible' });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await assertWorkspaceTouchTargets();
    await page.getByRole('radio', { name: '涉及', exact: true }).check();
    const outlineAlert = page.locator('.task-outline-alert');
    await outlineAlert.waitFor();
    assert.equal(await outlineAlert.innerText(), '未找到已发布大纲，无法选择存量文档');
    assert.equal(await outlineAlert.evaluate(node => getComputedStyle(node).color), 'rgb(180, 35, 24)');
    assert.equal(await page.locator('[name=selected][value=D1]').count(), 0);
    assert.equal(await page.locator('[data-folder=C1] > [data-folder-menu]').count(), 1);
    await page.locator('[data-folder=C1] > [data-folder-menu]').click();
    assert.equal(await page.locator('[data-folder=C1] > .task-folder-menu').evaluate(menu => menu.getBoundingClientRect().bottom <= menu.closest('.task-choices').getBoundingClientRect().bottom), true);
    await page.keyboard.press('Escape');
    await page.screenshot({ path: path.join(output, '12-no-published-outline.png') });
    await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
    outlinePublished = true;
    await timed('打开文档范围（目录API）', async () => { await page.locator('[data-task-action=book-scope][data-book=H1]').click(); await page.getByRole('dialog').waitFor(); }); await page.getByRole('radio', { name: '涉及', exact: true }).check();
    assert.equal(await page.locator('dialog button[value=confirm]').getAttribute('aria-label'), '确认文档范围');
    assert.equal(await page.locator('dialog footer [aria-label="取消"] svg.lucide-undo-2').count(), 1);
    assert.equal(await page.locator('dialog footer button[value=confirm] svg.lucide-check').count(), 1);
    assert.equal(await page.locator('[name="owner:D1"]').inputValue(), 'writer');
    assert.equal(await page.getByText('按大纲主责匹配').count(), 0);
    assert.equal(await page.getByText('每篇文档由一名责任人处理').count(), 0);
    await page.locator('[name=targetVersion]').selectOption('23.4'); await page.locator('[name=selected][value=D1]').check();
    assert.equal(await page.locator('dialog button[value=draft]').count(), 0);
    assert.equal(await page.locator('[data-scope-tree] [data-folder]').count(), 2);
    assert.equal(await page.locator('[data-folder=C1] [name=selected]').count(), 2);
    await page.locator('[data-folder=C1] summary').click();
    assert.match(await page.locator('[data-selected-count]').innerText(), /已选 1 项/);
    await page.locator('[data-scope-search]').fill('安装说明');
    assert.equal(await page.locator('[data-folder=C1] details').getAttribute('open'), '');
    assert.equal(await page.locator('[data-choice]:visible').count(), 1);
    await page.locator('[data-scope-search]').fill('');
    assert.equal(await page.locator('.task-new-document, [name=parentId], [data-choice] [data-folder-menu]').count(), 0);
    assert.equal(await page.locator('[data-folder=P1] > [data-folder-menu]').count(), 0);
    const chapterMenu = page.locator('[data-folder=C1] > [data-folder-menu]');
    await timed('打开章节操作菜单', async () => { await chapterMenu.click(); await page.getByRole('button', { name: '新增文档', exact: true }).waitFor(); });
    await page.screenshot({ path: path.join(output, '13-chapter-menu.png') });
    await page.keyboard.press('Escape');
    assert.equal(await chapterMenu.getAttribute('aria-expanded'), 'false');
    assert.equal(await chapterMenu.evaluate(node => node === document.activeElement), true);
    await chapterMenu.click(); await page.getByRole('button', { name: '新增文档', exact: true }).click();
    assert.equal(await page.locator('[data-new-editor]').count(), 1);
    assert.equal(await page.locator('[data-commit-new]').innerText(), '加入选择');
    assert.equal(await page.locator('[data-commit-new]').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(3, 105, 161)');
    await page.screenshot({ path: path.join(output, '14-inline-new-document.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await assertWorkspaceTouchTargets();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, '14-inline-new-document-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('[data-new-editor] [data-cancel-new]').click();
    assert.equal(await page.locator('[data-new-editor]').count(), 0);
    await chapterMenu.click(); await page.getByRole('button', { name: '新增文档', exact: true }).click();
    await page.locator('[data-commit-new]').click();
    assert.equal(await page.locator('[data-new-error]').innerText(), '请输入文档名称');
    await page.locator('[data-new-editor] [name=newName]').fill('新增说明');
    await page.locator('[data-commit-new]').click();
    assert.equal(await page.locator('[data-new-error]').innerText(), '请选择文档负责人');
    await page.locator('[data-new-editor] [name=newOwner]').selectOption('writer');
    const addedRow = page.locator('[data-folder=C1] > details > ul > li[data-choice]').first();
    await timed('新增文档加入选择', async () => { await page.locator('[data-commit-new]').click(); await addedRow.waitFor(); });
    assert.equal(await addedRow.locator('[name=selected]').isChecked(), true);
    assert.equal(await addedRow.locator('select').inputValue(), 'writer');
    await page.screenshot({ path: path.join(output, '03-document-scope.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, '03-document-scope-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    await confirm();
    await page.locator('[data-task-action=book-scope][data-book=H2]').click(); await page.getByRole('radio', { name: '不涉及', exact: true }).check(); await page.locator('[name=reasonId]').selectOption('covered'); await confirm();
    await page.locator('[data-task-action=book-scope][data-book=H1]').click();
    await page.locator('dialog [name=scopeChangeReason]').fill('核实范围');
    await page.route('**/scope-changes/*/preview', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: '预览暂不可用' } }) }), { times: 1 });
    await page.locator('dialog button[value=confirm]').click();
    await page.locator('dialog [data-modal-error]:visible').waitFor();
    assert.match(await page.locator('dialog [data-modal-error]').innerText(), /预览暂不可用/);
    assert.ok((await (await page.request.get(base + '/knowledge-center/api/document-tasks/PC-1')).json()).data.scopeChanges.some(change => change.status === 'reported'));
    await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    await page.waitForFunction(async () => {
      const response = await fetch('/knowledge-center/api/document-tasks/PC-1');
      return (await response.json()).data.scopeChanges.every(change => change.status !== 'reported');
    });
    await page.locator('[data-task-action=book-scope][data-book=H1]').click();
    await page.locator('dialog [name=scopeChangeReason]').fill('再次核实范围');
    await page.locator('dialog button[value=confirm]').click();
    await page.locator('.task-scope-impact-preview').waitFor();
    const firstDigest = await page.locator('.document-task-dialog[open]').getAttribute('data-impact-digest');
    await page.getByRole('dialog').getByRole('radio', { name: '不涉及', exact: true }).check();
    await page.locator('dialog [name=reasonId]').selectOption('covered');
    await page.locator('dialog button[value=confirm]').click();
    await page.waitForFunction(previous => document.querySelector('.document-task-dialog[open]')?.dataset.impactDigest !== previous, firstDigest);
    assert.equal(await page.locator('.task-scope-impact-preview tbody tr').first().locator('td').nth(1).innerText(), '撤出');
    for (const heading of ['草稿', '审核', '回读']) assert.equal(await page.locator('.task-scope-impact-preview th', { hasText: heading }).count(), 1);
    assert.equal(await page.locator('.task-scope-impact-preview tbody tr').first().locator('td').nth(2).innerText(), '未保存');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('.task-scope-impact-preview tbody tr').first().locator('td').nth(5).getAttribute('data-label'), '回读');
    await page.screenshot({ path: path.join(output, 'scope-impact-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    assert.notEqual(await page.locator('.document-task-dialog[open]').getAttribute('data-impact-digest'), firstDigest);
    await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    await timed('打开文档快捷改派', async () => { await page.locator('[data-task-action=document-owner][data-doc=D1]').click(); await page.getByRole('dialog').waitFor(); });
    await page.locator('dialog [name=ownerId]').selectOption('next'); await confirm();
    await reload(); await open('PC-1'); assert.ok((await page.getByLabel('任务详情').innerText()).includes('新负责人'));
    await page.locator('[data-task-action=document-owner][data-doc=D1]').click(); await page.locator('dialog [name=ownerId]').selectOption('writer'); await confirm();
    assert.equal(await page.locator('.task-workspace').count(), 1);
    assert.equal(await page.locator('.task-assignment-basic-info').count(), 1);
    assert.equal(await page.locator('.task-workspace-history details').count(), 0);
    assert.equal(await page.locator('.task-workspace-history').isVisible(), true);
    await timed('切换手册任务', async () => { await page.locator('[data-task-book-select=H2]').click(); await page.locator('[data-task-book-select=H2][aria-pressed=true]').waitFor(); });
    assert.equal(await page.locator('.task-book').nth(0).isVisible(), false);
    assert.equal(await page.locator('.task-book').nth(1).isVisible(), true);
    await page.screenshot({ path: path.join(output, '15-focused-other-handbook.png') });
    await page.locator('[data-task-book-select=H1]').click();
    await page.screenshot({ path: path.join(output, '08-assigned-detail.png') });
    await page.getByRole('button', { name: '返回任务列表' }).click();
    assert.equal(await page.locator('.document-task-tabs, [data-task-tab], .document-task-config').count(), 0);
    user = 'writer';
    const writerItems = (await (await page.request.get(base + '/knowledge-center/api/document-tasks/mine')).json()).data.items;
    const newDocument = writerItems.find(item => item.url.includes('action=new-document'));
    assert.ok(newDocument);
    await navigate(`${base}/?${new URL(newDocument.url, base).searchParams}`);
    await page.getByRole('dialog', { name: '新增文档' }).waitFor();
    await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
    await reload(); await open('PC-1');
    assert.match(await page.getByRole('link', { name: '进入编写' }).getAttribute('href'), /branch=23.4/);
    assert.equal(await page.locator('[data-task-action=new-document]').count(), 1);
    await timed('打开新增文档关联', async () => { await page.locator('[data-task-action=new-document]').click(); await page.getByRole('dialog').waitFor(); }); await timed('创建大纲候选并刷新', async () => { await page.getByRole('button', { name: '创建大纲候选', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('.document-task-dialog[open]') && !document.querySelector('#view-root[aria-busy=true]')); });
    await timed('打开新增文档关联', async () => { await page.locator('[data-task-action=new-document]').click(); await page.getByRole('dialog').waitFor(); }); await page.getByRole('link', { name: '打开候选大纲' }).waitFor();
    await page.locator('[name=createdDocumentId]').selectOption('D2'); await confirm();
    await page.screenshot({ path: path.join(output, '04-detail.png') });
    linkedReview = { id: 'closed-review', handbookId: 'H1', state: 'mr_submitted',
      handbookSource: { branch: '23.4', documents: [{ documentId: 'D1', branch: '23.4' }] },
      deliveryObservation: { state: 'closed' }, completion: { status: 'pending', label: 'MR已关闭' },
      mergeRequest: { iid: 71, webUrl: 'https://gitlab.example.test/group/docs/-/merge_requests/71' } };
    const currentTask = (await (await page.request.get(base + '/knowledge-center/api/document-tasks/PC-1')).json()).data;
    const linked = await page.request.post(base + '/knowledge-center/api/document-tasks/PC-1/documents/D1/link', {
      headers: { 'Idempotency-Key': require('node:crypto').randomUUID() },
      data: { expectedRevision: currentTask.revision, handbookId: 'H1', reviewTaskId: linkedReview.id },
    });
    assert.equal(linked.status(), 200);
    await reload(); await open('PC-1');
    assert.ok((await page.getByLabel('任务详情').innerText()).includes('下一步：重新编写并提交审核 · 处理人：文档负责人'));
    assert.ok((await page.getByLabel('任务详情').innerText()).includes('MR已关闭'));
    await page.screenshot({ path: path.join(output, '11-closed-mr-recovery.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, '12-closed-mr-recovery-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: '返回任务列表' }).click();
    assert.equal(await page.locator('.document-task-tabs, [data-task-tab], .document-task-config').count(), 0);
    user = 'owner'; await reload(); await open('PC-2'); await timed('打开工单范围', async () => { await page.locator('[data-task-action=ticket-scope]').last().click(); await page.getByRole('dialog').waitFor(); }); await page.getByRole('radio', { name: '不涉及', exact: true }).check(); await page.locator('[name=reasonId]').selectOption('other'); await page.locator('[name=reasonDetail]').fill('仅调整监控阈值'); await confirm();
    await navigate(`${base}/?task=PC-2&action=complete`);
    await page.getByRole('dialog', { name: '确认不涉及并完成' }).waitFor();
    await confirm(); assert.ok((await page.getByLabel('任务详情').innerText()).includes('已完成'));
    await reload(); await open('PC-2'); assert.ok((await page.getByLabel('任务详情').innerText()).includes('已完成'));
    await page.getByRole('button', { name: '返回任务列表' }).click(); await open('PC-2');
    await page.locator('.task-workspace-header-actions summary').click();
    await page.getByRole('button', { name: '变更责任人', exact: true }).click();
    await page.getByRole('dialog').getByRole('heading', { name: '变更责任人' }).waitFor();
    assert.equal(await page.locator('dialog [name=reason]').count(), 0);
    await page.locator('dialog [name=ownerId]').selectOption('next'); await confirm();
    await reload(); await open('PC-2');
    const reassignedTask = (await (await page.request.get(base + '/knowledge-center/api/document-tasks/PC-2')).json()).data;
    assert.equal(reassignedTask.ownerId, 'next');
    assert.ok((await page.getByLabel('任务详情').innerText()).includes('新负责人'), JSON.stringify({ ownerId: reassignedTask.ownerId, details: await page.getByLabel('任务详情').innerText() }));
    await page.getByRole('button', { name: '返回任务列表' }).click();
    await page.getByRole('button', { name: 'PC-2结束时间', exact: true }).click();
    await page.locator('[name=clock]').fill('18:30');
    await page.getByRole('dialog').getByRole('button', { name: '确定', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('dialog[open]') && !document.querySelector('#view-root[aria-busy=true]'));
    await reload();
    assert.ok((await page.getByRole('button', { name: 'PC-2结束时间', exact: true }).innerText()).includes('18:30'));
    await open('PC-2');


    user = 'next'; await reload(); await open('PC-2');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.task-workspace-header-actions summary').click();
    await page.locator('[data-task-action=ticket-scope]').last().click(); await page.getByRole('dialog').waitFor();
    await assertWorkspaceTouchTargets();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, '10-mobile-scope.png') });
    await timed('取消范围选择', async () => { await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); });
    await page.screenshot({ path: path.join(output, '05-mobile-detail.png') });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByRole('button', { name: '返回任务列表' }).click(); await page.screenshot({ path: path.join(output, '06-mobile-list.png') }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('[data-lucide]:not(svg)').count(), 0);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ backend: 'real HTTP; isolated file store', identities: 'fixture', catalogAndGitLab: 'fixture', desktop: '1440x900', mobile: '390x844', errors, enterpriseMergeVerified: false }, null, 2));
  } finally {
    fs.writeFileSync(path.join(output, 'timings.json'), JSON.stringify({ environment: '实际前端模块 + 真实HTTP后端；隔离文件存储；人员、目录与GitLab夹具；无节流', samples: timings }, null, 2));
    try {
      await captureCoverage();
      if (coverageCases) {
        fs.mkdirSync(coverageCases, { recursive: true });
        fs.writeFileSync(path.join(coverageCases, `document-tasks-${process.pid}.json`), JSON.stringify(coverageSnapshots));
      }
    } finally {
      await browser.close();
      await new Promise(resolve => server.close(resolve));
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});
