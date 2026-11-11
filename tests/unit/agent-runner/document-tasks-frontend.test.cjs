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
  let delayDetail = false, detailReads = 0, outlinePublished = true, linkedReview = null;
  app.use((req, res, next) => {
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
  const reload = async () => { await navigate(base); await page.getByRole('heading', { name: '任务管理', exact: true }).waitFor(); };
  const open = async number => timed('打开任务详情', async () => { await page.getByRole('button', { name: number, exact: true }).click(); await page.getByLabel('任务详情').waitFor(); });
  const confirm = async () => timed('保存：' + await page.getByRole('dialog').getAttribute('aria-label'), async () => { await page.locator('dialog button[value=confirm]').click(); await page.waitForFunction(() => !document.querySelector('dialog[open]') && !document.querySelector('#view-root[aria-busy=true]')); });
  try {
    await reload();
    await page.locator('[data-task-file]').setInputFiles({ name: 'tasks.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ number: 'PC-1', title: '跨两本手册更新', sourceUrl: 'https://pingcode.yasdb.com/pjm/workitems/opaque' }, { number: 'PC-2', title: '无文档变更' }])) });
    await page.getByRole('dialog', { name: '导入预览' }).waitFor();
    assert.equal(JSON.parse(fs.existsSync(path.join(directory, 'tasks.json')) ? fs.readFileSync(path.join(directory, 'tasks.json')) : '{"tasks":[]}').tasks.length, 0);
    await page.screenshot({ path: path.join(output, '01-import-preview.png') }); await confirm();
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
        document.querySelector('[data-task-action="close"]').click();
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
    await page.getByText('正在读取，请稍候…', { exact: true }).waitFor();
    assert.equal(await page.locator('#view-root').getAttribute('aria-busy'), 'true');
    await page.getByLabel('任务详情').waitFor();
    assert.equal(detailReads, 1, 'pending detail click must not issue duplicate requests');
    delayDetail = false;
    await timed('打开工单范围', async () => { await page.locator('[data-task-action=ticket-scope]').click(); await page.getByRole('dialog').waitFor(); });
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
    await timed('打开手册快捷改派', async () => { await page.locator('[data-task-action=book-owner][data-book=H1]').click(); await page.getByRole('dialog').waitFor(); });
    assert.equal(await page.locator('dialog [name=reason]').count(), 0);
    await page.locator('dialog [name=ownerId]').selectOption('next'); await confirm();
    await reload(); await open('PC-1'); assert.ok((await page.getByLabel('任务详情').innerText()).includes('新负责人'));
    await page.locator('[data-task-action=book-owner][data-book=H1]').click(); await page.locator('dialog [name=ownerId]').selectOption('book'); await confirm();
    assert.ok((await page.getByLabel('任务详情').innerText()).includes('待手册负责人确认'));
    user = 'book'; await reload(); assert.equal(await page.locator('[data-task-action=plan]').count(), 0); await open('PC-1');
    assert.equal(await page.locator('.task-workspace').count(), 1);
    assert.equal(await page.locator('.task-ticket-scope').isVisible(), false);
    assert.equal(await page.locator('[data-task-book-select]').count(), 2);
    assert.equal(await page.locator('.task-next-action .button.primary').innerText(), '确认文档范围');
    assert.notEqual(await page.locator('.task-next-action .button.primary').evaluate(node => getComputedStyle(node).color), await page.locator('.task-next-action .button.primary').evaluate(node => getComputedStyle(node).backgroundColor));
    await page.screenshot({ path: path.join(output, '16-handbook-owner-workspace.png') });
    outlinePublished = false;
    await page.locator('[data-task-action=book-scope][data-book=H1]').click(); await page.getByRole('dialog').waitFor();
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
    assert.equal(await page.locator('dialog button[value=confirm]').innerText(), '确认文档范围');
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
    await timed('打开文档快捷改派', async () => { await page.locator('[data-task-action=document-owner][data-doc=D1]').click(); await page.getByRole('dialog').waitFor(); });
    await page.locator('dialog [name=ownerId]').selectOption('next'); await confirm();
    await reload(); await open('PC-1'); assert.ok((await page.getByLabel('任务详情').innerText()).includes('新负责人'));
    await page.locator('[data-task-action=document-owner][data-doc=D1]').click(); await page.locator('dialog [name=ownerId]').selectOption('writer'); await confirm();
    assert.equal(await page.locator('.task-workspace').count(), 1);
    assert.equal(await page.locator('.task-workspace-more').getAttribute('open'), null);
    assert.equal(await page.locator('.task-workspace-history').getAttribute('open'), null);
    await timed('切换手册任务', async () => { await page.locator('[data-task-book-select=H2]').click(); await page.locator('[data-task-book-select=H2][aria-pressed=true]').waitFor(); });
    assert.equal(await page.locator('.task-book').nth(0).isVisible(), false);
    assert.equal(await page.locator('.task-book').nth(1).isVisible(), true);
    await page.screenshot({ path: path.join(output, '15-focused-other-handbook.png') });
    await page.locator('[data-task-book-select=H1]').click();
    await page.screenshot({ path: path.join(output, '08-assigned-detail.png') });
    await timed('查看真实流程', async () => { await page.locator('[data-task-tab=flow]').click(); await page.locator('.task-role-flow').waitFor(); });
    assert.ok((await page.locator('.task-role-flow').innerText()).includes('文档负责人'));
    await page.screenshot({ path: path.join(output, '09-flow.png') });
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
    await timed('打开新增文档关联', async () => { await page.locator('[data-task-action=new-document]').click(); await page.getByRole('dialog').waitFor(); }); await timed('创建大纲候选并刷新', async () => { await page.getByRole('button', { name: '创建大纲候选', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('dialog[open]') && !document.querySelector('#view-root[aria-busy=true]')); });
    await timed('打开新增文档关联', async () => { await page.locator('[data-task-action=new-document]').click(); await page.getByRole('dialog').waitFor(); }); await page.getByRole('link', { name: '打开候选大纲' }).waitFor();
    await page.locator('[name=createdDocumentId]').selectOption('D2'); await confirm();
    await page.screenshot({ path: path.join(output, '04-detail.png') });
    linkedReview = { id: 'closed-review', handbookId: 'H1', state: 'mr_submitted',
      handbookSource: { branch: '23.4', documents: [{ documentId: 'D1', branch: '23.4' }] },
      deliveryObservation: { state: 'closed' }, completion: { status: 'pending', label: 'MR已关闭，需修订并重新审核' },
      mergeRequest: { iid: 71, webUrl: 'https://gitlab.example.test/group/docs/-/merge_requests/71' } };
    const currentTask = (await (await page.request.get(base + '/knowledge-center/api/document-tasks/PC-1')).json()).data;
    const linked = await page.request.post(base + '/knowledge-center/api/document-tasks/PC-1/documents/D1/link', {
      headers: { 'Idempotency-Key': require('node:crypto').randomUUID() },
      data: { expectedRevision: currentTask.revision, handbookId: 'H1', reviewTaskId: linkedReview.id },
    });
    assert.equal(linked.status(), 200);
    await reload(); await open('PC-1');
    assert.ok((await page.getByLabel('任务详情').innerText()).includes('下一步：修订并重新送审 · 处理人：文档负责人'));
    assert.ok((await page.getByLabel('任务详情').innerText()).includes('MR已关闭'));
    await page.screenshot({ path: path.join(output, '11-closed-mr-recovery.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, '12-closed-mr-recovery-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: '返回任务列表' }).click(); await page.getByRole('button', { name: '流程流转', exact: true }).click(); assert.ok((await page.locator('#view-root').innerText()).includes('请选择一项任务'));
    user = 'owner'; await reload(); await open('PC-2'); await timed('打开工单范围', async () => { await page.locator('[data-task-action=ticket-scope]').click(); await page.getByRole('dialog').waitFor(); }); await page.getByRole('radio', { name: '不涉及', exact: true }).check(); await page.locator('[name=reasonId]').selectOption('other'); await page.locator('[name=reasonDetail]').fill('仅调整监控阈值'); await confirm();
    await navigate(`${base}/?task=PC-2&action=complete`);
    await page.getByRole('dialog', { name: '确认不涉及并完成' }).waitFor();
    await confirm(); assert.ok((await page.getByLabel('任务详情').innerText()).includes('已完成'));
    await reload(); await open('PC-2'); assert.ok((await page.getByLabel('任务详情').innerText()).includes('已完成'));
    await page.getByRole('button', { name: '返回任务列表' }).click();
    await page.getByRole('button', { name: '任务配置', exact: true }).click();
    await page.locator('[name=defaultOwnerId]').selectOption('next');
    await page.locator('[name="reasonLabel:covered"]').fill('已有文档覆盖');
    await page.getByRole('button', { name: '保存配置', exact: true }).click();
    await page.getByText('配置已保存', { exact: true }).waitFor();
    await reload(); await page.getByRole('button', { name: '任务配置', exact: true }).click();
    assert.equal(await page.locator('[name=defaultOwnerId]').inputValue(), 'next');
    assert.equal(await page.locator('[name="reasonLabel:covered"]').inputValue(), '已有文档覆盖');
    await page.getByRole('button', { name: '任务列表', exact: true }).click(); await open('PC-2');
    await page.getByRole('button', { name: '改派', exact: true }).click();
    assert.equal(await page.locator('dialog [name=reason]').count(), 0);
    await page.locator('dialog [name=ownerId]').selectOption('next'); await confirm();
    await reload(); await open('PC-2');
    assert.ok((await page.getByLabel('任务详情').innerText()).includes('新负责人'));
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
    await page.locator('[data-task-action=ticket-scope]').click(); await page.getByRole('dialog').waitFor();
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
