const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const frontend = path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center');
const artifacts = path.resolve(__dirname, '../../../runtime/test-results/gitlab-connection-live');

test('GitLab 仓库连接表格和详情抽屉读取真实平台数据', async t => {
  const baseUrl = process.env.KPG_BASE_URL;
  assert.ok(baseUrl, '设置 KPG_BASE_URL 指向只读验收实例');
  const upstream = new URL(baseUrl);
  const server = http.createServer((request, response) => {
    if (request.url.startsWith('/knowledge-center/api/')) {
      const target = new URL(request.url, upstream);
      const proxy = http.request(target, { method: request.method, headers: { ...request.headers, host: upstream.host } }, result => {
        response.writeHead(result.statusCode, result.headers);
        result.pipe(response);
      });
      proxy.on('error', error => { response.writeHead(502); response.end(error.message); });
      request.pipe(proxy);
      return;
    }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname.slice('/knowledge-center'.length);
    const file = path.extname(relative) ? path.resolve(frontend, `.${relative}`) : path.join(frontend, 'knowledge-center-management.html');
    if (!file.startsWith(`${frontend}${path.sep}`) || !fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }[path.extname(file)] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const anonymous = await browser.newPage();
    const anonymousResponse = anonymous.waitForResponse(response => response.url().endsWith('/knowledge-center/api/gitlab/connections'));
    await anonymous.goto(`${origin}/knowledge-center/platform?tab=gitlab`);
    assert.equal((await anonymousResponse).status(), 401);
    assert.equal(await anonymous.locator('[data-gitlab-early-rows] .gitlab-early-row span').count(), 0, '未登录用户看到连接数据');
    await anonymous.close();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(15000);
    await page.addInitScript(() => {
      window.__gitlabOpenTiming = { rowAt: null, skeletonAt: null, earlyShellAt: null };
      new MutationObserver(() => {
        if (window.__gitlabOpenTiming.earlyShellAt == null && document.querySelector('[data-gitlab-static-shell]')) window.__gitlabOpenTiming.earlyShellAt = performance.now();
        if (window.__gitlabOpenTiming.skeletonAt == null && document.querySelector('.gitlab-connection-table')) window.__gitlabOpenTiming.skeletonAt = performance.now();
        if (window.__gitlabOpenTiming.rowAt == null && document.querySelector('[data-gitlab-row]')) window.__gitlabOpenTiming.rowAt = performance.now();
      }).observe(document, { childList: true, subtree: true });
    });
    const apiRequests = [];
    page.on('requestfinished', request => {
      if (!request.url().includes('/knowledge-center/api/')) return;
      const timing = request.timing();
      apiRequests.push({ path: new URL(request.url()).pathname, start: timing.startTime, duration: timing.responseEnd - timing.requestStart });
    });
    const login = await page.request.post(`${origin}/knowledge-center/api/auth/admin/login`, { data: { username: 'admin', password: 'admin' } });
    assert.equal(login.status(), 200);
    const response = await page.request.get(`${origin}/knowledge-center/api/gitlab/connections`);
    assert.equal(response.status(), 200);
    const connections = (await response.json()).data.items;
    assert.ok(connections.length > 0);

    await page.goto(`${origin}/knowledge-center/platform?tab=gitlab`);
    await page.locator('.gitlab-connection-table').waitFor({ state: 'visible' });
    await page.waitForFunction(count => document.querySelectorAll('[data-gitlab-row]').length === count, connections.length);
    assert.equal(await page.locator('[data-gitlab-row]').count(), connections.length);
    assert.equal(await page.locator('.gitlab-connection-drawer').count(), 0);
    const timing = await page.evaluate(() => ({ firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime, domContentLoaded: performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd, earlyShellAt: performance.getEntriesByName('gitlab-static-shell-painted')[0]?.startTime, earlyDataAt: performance.getEntriesByName('gitlab-early-data-ready')[0]?.startTime, skeletonAt: window.__gitlabOpenTiming.skeletonAt, dataReady: window.__gitlabOpenTiming.rowAt }));
    console.log(`真实 API 页面耗时: FCP ${timing.firstContentfulPaint?.toFixed(1)}ms, 首帧骨架 ${timing.earlyShellAt?.toFixed(1)}ms, 早期真实数据 ${timing.earlyDataAt?.toFixed(1)}ms, 应用骨架 ${timing.skeletonAt.toFixed(1)}ms, DOMContentLoaded ${timing.domContentLoaded.toFixed(1)}ms, 完整表格 ${timing.dataReady.toFixed(1)}ms`);
    console.log('API 请求耗时:', apiRequests.map(item => `${item.path} ${item.duration.toFixed(1)}ms`).join(', '));
    const startupResources = await page.evaluate(() => performance.getEntriesByType('resource').filter(item => !item.name.includes('/api/')).sort((a, b) => b.responseEnd - a.responseEnd).slice(0, 8).map(item => `${new URL(item.name).pathname} ${item.responseEnd.toFixed(1)}ms`));
    console.log('最晚静态资源:', startupResources.join(', '));
    assert.ok(timing.earlyShellAt < 100, `仓库连接首帧骨架超过 100ms: ${timing.earlyShellAt?.toFixed(1)}ms`);
    assert.ok(timing.firstContentfulPaint < 100, `仓库连接首次内容绘制超过 100ms: ${timing.firstContentfulPaint?.toFixed(1)}ms`);
    assert.ok(timing.earlyDataAt < timing.dataReady, '入口预取未提前显示真实连接数据');
    assert.equal(apiRequests.filter(item => item.path.endsWith('/gitlab/connections')).length, 1, '连接页重复请求仓库连接');
    const renderMs = await page.evaluate(async items => {
      const { renderPlatformAdmin } = await import('/knowledge-center/modules/platform-admin/view.js');
      const start = performance.now();
      const node = document.createElement('div');
      node.innerHTML = renderPlatformAdmin({ projection: {}, gitlabProjection: { connections: items }, platformAdmin: true, platformTab: 'gitlab', gitlabListState: {} });
      return performance.now() - start;
    }, connections);
    assert.ok(renderMs < 100, `仓库连接视图渲染超过 100ms: ${renderMs.toFixed(1)}ms`);
    console.log(`仓库连接视图渲染 ${renderMs.toFixed(1)}ms`);
    await page.waitForFunction(() => document.getElementById('knowledge-center-main-style').media === 'all' && document.querySelector('.gitlab-row-action svg'));
    await page.screenshot({ path: path.join(artifacts, 'desktop-table.png') });

    const first = connections[0];
    const details = page.locator('[data-gitlab-connection]').first();
    await details.click();
    const drawer = page.locator('.gitlab-connection-drawer');
    await drawer.waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(artifacts, 'desktop-drawer.png') });
    assert.match(await drawer.locator('h3').innerText(), new RegExp(first.name || first.projectPath));
    assert.match(await drawer.innerText(), /平台最近读取验证/);
    assert.equal(await page.locator('.gitlab-drawer-close').evaluate(button => button === document.activeElement), true);
    await page.keyboard.press('Escape');
    await drawer.waitFor({ state: 'detached' });
    assert.equal(await details.evaluate(button => button === document.activeElement), true);

    await page.locator('[data-gitlab-status-filter]').selectOption('disabled');
    const disabled = connections.filter(item => item.status === 'inactive' || item.managementStatus === 'disabled');
    assert.equal(await page.locator('[data-gitlab-row]').count(), disabled.length);
    await page.locator('[data-gitlab-status-filter]').selectOption('');
    assert.equal(await page.locator('[data-gitlab-row]').count(), connections.length);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.waitForFunction(count => document.querySelectorAll('[data-gitlab-row]').length === count, connections.length);
    await page.screenshot({ path: path.join(artifacts, 'mobile-table.png') });
    await page.locator('[data-gitlab-connection]').first().click();
    await drawer.waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(artifacts, 'mobile-drawer.png') });
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth, drawer: document.querySelector('.gitlab-connection-drawer').getBoundingClientRect().width }));
    assert.ok(dimensions.page <= dimensions.viewport);
    assert.ok(dimensions.drawer <= dimensions.viewport);
  } finally { await browser.close(); }
});
