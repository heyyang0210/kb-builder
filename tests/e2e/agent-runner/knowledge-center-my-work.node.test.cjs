const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../../..');
const frontend = path.join(root, 'apps/knowledge-center-web/frontend/knowledge-center');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const send = (res, status, value) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
};

async function fixture({ outlineFails = false, outlineDelayMs = 280, mrState = 'opened', responsiblePreview = false, handbookEntry = false } = {}) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    requests.push(req.url);
    if (req.url === '/knowledge-center/api/auth/config') return send(res, 200, { data: { casEnabled: false } });
    if (req.url === '/knowledge-center/api/auth/session') return send(res, 200, { data: { authenticated: true, user: { id: '178', principalId: '178', displayName: '测试用户' }, allowedActions: ['knowledge:read', 'knowledge:write', 'outline:create', 'template:read', ...(responsiblePreview ? ['platform:manage'] : [])], visibleModules: ['*'], roles: [] } });
    if (responsiblePreview && req.url === '/knowledge-center/api/workbench/responsibles') return send(res, 200, { success: true, data: [{ id: '178', displayName: '测试用户' }, { id: '200', displayName: '其他责任人' }] });
    if (req.url === '/knowledge-center/api/workbench/my-tasks/query' && req.method === 'POST') {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const query = JSON.parse(raw);
      const delegated = query.responsibleId === '200';
      const all = delegated ? [{ id: 'other:1', queue: 'actionable', kind: 'document', title: '其他责任人的文档', context: '手册', source: '任务管理', status: '待处理', url: '/knowledge-center/production' }] : [
        { id: 'doc:1', queue: 'actionable', kind: 'document', title: '编写数值型.md', context: 'SQL参考手册', source: '任务管理', version: 'master', status: '待处理', url: handbookEntry ? '/knowledge-center/production/handbook/HB-RETURN?documentId=doc-return' : '/knowledge-center/production' },
        { id: 'doc:2', queue: 'actionable', kind: 'document', title: '编写字面量.md', context: 'SQL参考手册', source: '任务管理', version: 'master', status: '待处理', url: '/knowledge-center/production' },
        { id: 'merge:1', queue: 'actionable', kind: 'merge', title: '用户手册改版', source: 'GitLab 交付', status: mrState === 'closed' ? 'MR 已关闭' : '待在 GitLab 合入', actionLabel: mrState === 'closed' ? '查看 GitLab MR' : '前往 GitLab 合入', url: 'https://git.example.test/project/-/merge_requests/73', external: true },
        { id: 'wait:1', queue: 'waiting', kind: 'review', title: '工作台验收工单', number: 'WB-1', source: '任务管理', status: '等待他人审核', url: '/knowledge-center/document-tasks' },
      ];
      const matched = all.filter(item => item.queue === query.queue && (query.type === 'all' || item.kind === query.type)
        && (!query.search || `${item.number || ''} ${item.title}`.includes(query.search)));
      await wait(35);
      return send(res, 200, { success: true, data: { items: matched.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: matched.length,
        page: query.page, pageSize: query.pageSize, facets: { all: all.length, actionable: all.filter(item => item.queue === 'actionable').length,
          waiting: all.filter(item => item.queue === 'waiting').length, types: Object.fromEntries(['document', 'merge', 'review'].map(kind => [kind, all.filter(item => item.kind === kind).length])) },
        unavailable: delegated ? ['大纲管理'] : [], completeness: delegated ? 'partial' : 'complete' } });
    }
    if (req.url === '/knowledge-center/api/platform/context') return send(res, 200, { status: 'ok', context: { brand: { enterpriseName: '测试平台' } } });
    if (req.url === '/knowledge-center/api/platform/overview') return send(res, 200, { status: 'ok' });
    if (req.url.startsWith('/knowledge-center/api/assets/handbooks')) return send(res, 200, { data: { items: handbookEntry ? [{ id: 'HB-RETURN', handbookId: 'HB-RETURN', name: '返回验证手册', status: 'active' }] : [], total: handbookEntry ? 1 : 0 } });
    if (handbookEntry && req.url === '/knowledge-center/api/outline/catalog?handbookId=HB-RETURN&view=directory') {
      return send(res, 200, { data: { items: [{ id: 'outline-return', handbookId: 'HB-RETURN', name: '返回验证手册' }],
        selectedId: 'outline-return', directory: { id: 'outline-return', handbookId: 'HB-RETURN', name: '返回验证手册', nodes: [{ id: 'doc-return', kind: 'document', title: '返回验证文档.md' }] } } });
    }
    if (handbookEntry && req.url === '/knowledge-center/api/gitlab/mappings/HB-RETURN?view=production') return send(res, 200, { data: null });
    if (handbookEntry && req.url.startsWith('/knowledge-center/api/production/handbooks/HB-RETURN/documents/doc-return/draft?')) return send(res, 200, { data: { exists: false } });
    if (handbookEntry && req.url === '/knowledge-center/api/document-tasks/context') return send(res, 200, { data: { people: [], filterOptions: { product: [], version: [] }, config: { reasonOptions: [] } } });
    if (handbookEntry && req.url.startsWith('/knowledge-center/api/document-tasks?')) return send(res, 200, { data: { items: [{ number: 'TEST-RETURN', description: '返回位置验证工单', ownerName: '测试用户', status: 'in_progress', decomposition: { handbooks: [{ documents: [{ id: 'doc-return', name: '返回验证文档.md', writingUrl: '/knowledge-center/production/handbook/HB-RETURN?documentId=doc-return' }] }] } }], total: 1 } });
    if (handbookEntry && req.url === '/knowledge-center/api/document-tasks') return send(res, 200, { data: { items: [{ number: 'TEST-RETURN', description: '返回位置验证工单', ownerName: '测试用户', status: 'in_progress', decomposition: { handbooks: [{ documents: [{ id: 'doc-return', name: '返回验证文档.md', writingUrl: '/knowledge-center/production/handbook/HB-RETURN?documentId=doc-return' }] }] } }], total: 1 } });
    if (req.url === '/fixture') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/knowledge-center/common/tokens.css"><link rel="stylesheet" href="/knowledge-center/common/base.css"><link rel="stylesheet" href="/knowledge-center/styles.css"><link rel="stylesheet" href="/knowledge-center/modules/dashboard/dashboard.css"></head><body><div id="view-root"></div></body></html>');
      return;
    }
    if (req.url === '/knowledge-center/' || req.url.startsWith('/knowledge-center/?') || req.url === '/knowledge-center/assets'
      || (handbookEntry && req.url.startsWith('/knowledge-center/production/handbook/'))) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      fs.createReadStream(path.join(frontend, 'knowledge-center-management.html')).pipe(res);
      return;
    }
    if (req.url === '/knowledge-center/api/document-tasks/mine') {
      await wait(35);
      send(res, 200, { data: { items: [
        { id: 'doc:1', kind: 'document', title: '编写数值型.md', context: 'SQL参考手册', source: '任务管理', version: 'master', state: 'pending', status: '待处理', url: handbookEntry ? '/knowledge-center/production/handbook/HB-RETURN?documentId=doc-return' : '/knowledge-center/production' },
        { id: 'doc:2', kind: 'document', title: '编写字面量.md', context: 'SQL参考手册', source: '任务管理', version: 'master', state: 'pending', status: '待处理', url: '/knowledge-center/production' },
      ], following: [{ number: 'WB-1', title: '工作台验收工单', status: 'in_progress', url: '/knowledge-center/document-tasks', handbooks: [] }] } });
      return;
    }
    if (req.url === '/knowledge-center/api/review/bootstrap?view=mine') {
      await wait(160);
      send(res, 200, { data: { workbench: { mine: [], myMergeRequests: [{ taskId: 'merge-1', handbookId: 'HB-1', title: '用户手册改版', businessVersion: '23.4', documentNames: ['SQL参考手册'], mergeRequest: { iid: 73, webUrl: 'https://git.example.test/project/-/merge_requests/73', state: mrState }, deliveryObservation: { state: mrState }, updatedAt: '2026-11-05T05:00:00Z' }] } } });
      return;
    }
    if (req.url === '/knowledge-center/api/outline/build-tasks') {
      await wait(outlineDelayMs);
      send(res, outlineFails ? 503 : 200, outlineFails ? { error: { message: '大纲服务暂不可用' } } : { data: { tasks: [] } });
      return;
    }
    const relative = req.url.replace(/^\/knowledge-center\//, '');
    const file = path.resolve(frontend, relative);
    if (file.startsWith(frontend + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
      res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
      return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, requests, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}

test('工作台统一列表、等待队列、桌面与窄屏布局', async t => {
  const service = await fixture({ outlineDelayMs: 700 });
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${service.url}/knowledge-center/`);
  await page.getByText('编写数值型', { exact: true }).waitFor();
  assert.equal(await page.locator('.my-task-summary, .my-task-following').count(), 0);
  assert.deepEqual(await page.locator('.my-task-board .my-task-table-head span').allInnerTexts(), ['编号', '子任务编号', '描述', '状态', '任务类型', '开始时间', '结束时间', '详情', '操作']);
  assert.equal(await page.locator('[data-my-task-kind]').count(), 7);
  assert.equal(await page.locator('[data-my-task-kind="all"] small').innerText(), '4');
  await page.locator('[data-my-task-queue="waiting"]').click();
  await page.getByText('工作台验收工单').waitFor();
  assert.equal(await page.locator('.my-task-list .my-task-table-row').count(), 1);
  await page.locator('.my-task-list [data-my-task-open]').click();
  await page.locator('[data-my-task-dialog][open]').waitFor();
  await page.locator('[data-my-task-dialog] [data-my-task-close]').first().click();
  await page.locator('[data-my-task-queue="actionable"]').click();
  await page.getByText('编写数值型', { exact: true }).waitFor();
  assert.equal(await page.locator('.my-task-list a[target="_blank"]').getAttribute('href'), 'https://git.example.test/project/-/merge_requests/73');
  assert.match(await page.locator('.my-task-list a[target="_blank"]').innerText(), /前往 GitLab 合入/);
  assert.equal(await page.locator('[data-view="dashboard"] .nav-copy small').innerText(), '我的工作');
  assert.equal(service.requests.some(url => url.startsWith('/knowledge-center/api/templates')), false);
  assert.deepEqual(errors, []);
  const output = path.join(root, 'runtime/test-results/workbench-optimization-20261105');
  fs.mkdirSync(output, { recursive: true });
  await page.screenshot({ path: path.join(output, 'desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.locator('#sidebar').evaluate(node => node.classList.contains('open'))) await page.locator('#mobile-close').click();
  await page.waitForFunction(() => document.querySelector('#sidebar').getBoundingClientRect().right <= 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '窄屏不得横向溢出');
  await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
});

test('联合查询面板支持嵌套组并将条件保存在 URL', async t => {
  const service = await fixture();
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${service.url}/knowledge-center/`);
  await page.getByText('编写数值型', { exact: true }).waitFor();
  await page.locator('[data-filter-toggle]').click();
  await page.locator('[data-filter-value="0"]').fill('WB-1');
  await page.locator('[data-filter-add-group=""]').click();
  assert.equal(await page.locator('.my-task-filter-group').count(), 2);
  await page.locator('[data-filter-value="1.0"]').fill('YDB-1');
  await page.locator('[data-filter-apply]').click();
  await page.waitForFunction(() => new URL(location.href).searchParams.has('wb'));
  const saved = JSON.parse(new URL(page.url()).searchParams.get('wb'));
  assert.equal(saved.filter.children[1].op, 'and');
  await page.reload();
  await page.locator('[data-filter-toggle]').waitFor();
  assert.equal(JSON.parse(new URL(page.url()).searchParams.get('wb')).filter.children[1].op, 'and');
  await page.locator('[data-filter-toggle]').click();
  assert.equal(await page.locator('.my-task-filter-group').count(), 2);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

test('已关闭的 MR 显示查看动作，窄屏仍可直接打开', async t => {
  const service = await fixture({ mrState: 'closed' });
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${service.url}/knowledge-center/`);
  const action = page.getByRole('link', { name: /查看 GitLab MR/ });
  await action.waitFor();
  assert.equal(await action.getAttribute('href'), 'https://git.example.test/project/-/merge_requests/73');
  assert.equal(await page.getByText('MR 已关闭').count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

test('管理员切换他人工作、进入处理并切回本人', async t => {
  const service = await fixture({ responsiblePreview: true });
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${service.url}/knowledge-center/`);
    const selector = page.locator('[data-my-task-responsible]');
    await selector.waitFor();
    assert.equal(await selector.inputValue(), '178');
    await selector.selectOption('200');
    await page.getByText('其他责任人的文档').waitFor();
    assert.match(await page.locator('.my-task-preview').innerText(), /管理员代办[\s\S]*实际操作者：测试用户/);
    assert.equal(await page.locator('.my-task-list a').count(), 1);
    assert.equal(await page.locator('.my-task-list a').first().getAttribute('href'), '/knowledge-center/production');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('[data-my-task-self]').click();
    await page.getByText('编写数值型', { exact: true }).waitFor();
    assert.equal(await page.locator('.my-task-preview').count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  }
});

test('工作台进入手册后返回原筛选位置，且首帧在 100ms 内', async t => {
  const service = await fixture({ handbookEntry: true, outlineDelayMs: 5 });
  const browser = await chromium.launch({ headless: true });
  t.after(async () => { await browser.close(); await service.close(); });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${service.url}/knowledge-center/`);
  await page.getByText('编写数值型', { exact: true }).waitFor();
  await page.locator('[data-my-task-query]').fill('数值型');
  const sourceUrl = page.url();
  const pageLoads = service.requests.filter(url => url === '/knowledge-center/').length;
  const timings = [];
  for (let index = 0; index < 6; index++) {
    await page.locator('.my-task-list a[href*="HB-RETURN"]').click();
    await page.locator('[data-handbook-return]').waitFor({ timeout: 5000 }).catch(async error => {
      throw new Error(`${error.message}; url=${page.url()}; text=${(await page.locator('#view-root').innerText()).slice(0, 500)}; requests=${JSON.stringify(service.requests.slice(-15))}; errors=${JSON.stringify(errors)}`);
    });
    await page.evaluate(() => {
      window.__returnStart = 0;
      window.__returnPaint = 0;
      document.addEventListener('click', event => {
        if (event.target.closest('[data-handbook-return]')) window.__returnStart = performance.now();
      }, { capture: true, once: true });
      const observer = new MutationObserver(() => {
        if (!document.querySelector('.my-tasks') || window.__returnPaint) return;
        requestAnimationFrame(() => requestAnimationFrame(() => { window.__returnPaint = performance.now() - window.__returnStart; }));
        observer.disconnect();
      });
      observer.observe(document.querySelector('#view-root'), { childList: true });
    });
    await page.locator('[data-handbook-return]').click();
    await page.locator('.my-tasks').waitFor();
    await page.waitForFunction(() => window.__returnPaint > 0);
    await page.getByText('编写数值型', { exact: true }).waitFor();
    timings.push(await page.evaluate(() => window.__returnPaint));
    assert.equal(new URL(page.url()).pathname, new URL(sourceUrl).pathname);
    assert.equal(JSON.parse(new URL(page.url()).searchParams.get('wb')).query, '数值型');
    assert.equal(await page.locator('[data-my-task-query]').inputValue(), '数值型');
    assert.equal(await page.locator('.my-task-list .my-task-table-row').count(), 1);
  }
  const sorted = [...timings].sort((a, b) => a - b);
  const p95 = sorted[Math.ceil(sorted.length * .95) - 1];
  assert.equal(service.requests.filter(url => url === '/knowledge-center/').length, pageLoads, '返回不重载应用 HTML');
  assert.deepEqual(errors, []);
  assert.ok(p95 < 100, JSON.stringify({ timings, p95 }));
  console.log(JSON.stringify({ handbookReturn: { timings, p50: sorted[2], p95 } }));
  await page.locator('[data-view="documentTasks"]').click();
  await page.locator('.task-output-document').waitFor();
  const taskSource = page.url();
  await page.locator('.task-output-document').click();
  await page.locator('[data-handbook-return]').waitFor();
  await page.locator('[data-handbook-return]').click();
  await page.locator('.document-task-page').waitFor();
  assert.equal(page.url(), taskSource);
  assert.equal(await page.locator('.task-output-document').count(), 1);
  await page.goForward();
  await page.locator('[data-handbook-return]').waitFor();
  await page.goBack();
  await page.locator('.document-task-page').waitFor();
  assert.equal(page.url(), taskSource);
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${service.url}/knowledge-center/`);
  await mobile.locator('.my-task-list a[href*="HB-RETURN"]').waitFor();
  await mobile.locator('[data-my-task-query]').fill('数值型');
  await mobile.locator('.my-task-list a[href*="HB-RETURN"]').click();
  await mobile.locator('[data-handbook-return]').waitFor();
  await mobile.locator('[data-handbook-return]').click();
  await mobile.locator('.my-tasks').waitFor();
  assert.equal(await mobile.locator('[data-my-task-query]').inputValue(), '数值型');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('[data-view="assets"]').click();
  await page.locator('[data-asset-id="HB-RETURN"]').waitFor();
  await page.locator('[data-asset-id="HB-RETURN"]').click();
  await page.locator('.asset-action-row[href*="/production/handbook/HB-RETURN"]').click();
  await page.locator('[data-handbook-return]').waitFor();
  await page.locator('[data-handbook-return]').click();
  await page.locator('.asset-workspace-detail').waitFor();
  assert.match(page.url(), /\/knowledge-center\/assets\?handbookId=HB-RETURN/);
  const direct = await browser.newPage();
  await direct.goto(`${service.url}/knowledge-center/production/handbook/HB-RETURN?documentId=doc-return`);
  await direct.locator('[data-handbook-return]').waitFor();
  await direct.locator('[data-handbook-return]').click();
  await direct.waitForURL('**/knowledge-center/assets?handbookId=HB-RETURN');
  await direct.locator('.asset-workspace').waitFor();
});
