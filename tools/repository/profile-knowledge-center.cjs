#!/usr/bin/env node
// Read-only browser audit. Only session login writes local authentication state.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function main() {
  const base = process.env.KPG_BASE_URL;
  if (!base) throw new Error('必须指定 KPG_BASE_URL，禁止隐式选择测试目标');
  const envFile = path.resolve('config/knowledge-center/.env');
  const local = fs.existsSync(envFile) ? Object.fromEntries(fs.readFileSync(envFile, 'utf8').split(/\r?\n/)
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])) : {};
  const username = process.env.KNOWLEDGE_CENTER_ADMIN_USERNAME || local.KNOWLEDGE_CENTER_ADMIN_USERNAME;
  const password = process.env.KNOWLEDGE_CENTER_ADMIN_PASSWORD || local.KNOWLEDGE_CENTER_ADMIN_PASSWORD;
  if (!username || !password) throw new Error('请配置性能测试登录账号');
  const rounds = Number(process.env.KC_PERF_ROUNDS || 5);
  const cpuRate = Number(process.env.KC_PERF_CPU_RATE || 1);
  if (!Number.isInteger(rounds) || rounds < 1 || !Number.isFinite(cpuRate) || cpuRate < 1) throw new Error('轮数和 CPU 倍率无效');
  const output = path.resolve(process.env.KC_PERF_OUTPUT || 'runtime/performance/audit.json');
  const browser = await chromium.launch({ headless: true });
  const samples = [];
  const checks = [];
  try {
    const context = await browser.newContext();
    const login = await context.request.post(new URL('/knowledge-center/api/auth/admin/login', base).href, { data: { username, password } });
    if (!login.ok()) throw new Error(`登录失败：HTTP ${login.status()}`);
    const projection = await context.request.get(new URL('/knowledge-center/api/review/bootstrap?view=handbooks', base).href);
    if (!projection.ok()) throw new Error(`审核基线读取失败：HTTP ${projection.status()}`);
    const handbook = (await projection.json()).data.workbench.handbooks[0]?.handbookId;
    const cases = [
      { name: '生产首页', route: '/knowledge-center/production', ready: '.production-handbook-table', nav: 'production' },
      { name: '审核首页', route: '/knowledge-center/review', ready: '.review-hub', nav: 'review' },
      { name: '我的生成', route: '/knowledge-center/production?view=generations', ready: '.production-generations, .production-overview-empty:not([role])' },
      ...(handbook ? [{ name: '审核正文', route: `/knowledge-center/review?view=reader&handbookId=${encodeURIComponent(handbook)}&showAll=1`, ready: '[data-review-repository-region]:not([data-repository-status="loading"])' }] : []),
      { name: '独立生成工作台', route: '/document-generation-workbench.html', ready: '#mainContent' },
    ];
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    await page.addInitScript(() => {
      window.__perf = { start: 0, readyAt: null, selector: '', longTasks: [] };
      new PerformanceObserver(list => window.__perf.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
      new MutationObserver(() => {
        const p = window.__perf;
        if (p.selector && p.readyAt === null && document.querySelector(p.selector)) p.readyAt = performance.now();
      }).observe(document, { subtree: true, childList: true, attributes: true });
    });
    let responses = [], errors = [];
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/knowledge-center/api/') || url.pathname.startsWith('/api/')) responses.push({ path: url.pathname + url.search, status: response.status(), timing: response.headers()['server-timing'] || null });
    });
    page.on('pageerror', error => errors.push(error.message));
    async function capture(item, mode, round) {
      responses = []; errors = [];
      if (mode === 'click') {
        // Navigate from the opposite page after all background work settles.
        await page.goto(new URL(`/knowledge-center/${item.nav === 'review' ? 'production' : 'review'}`, base).href, { waitUntil: 'networkidle' });
        responses = []; errors = [];
        await page.evaluate(selector => {
          performance.clearResourceTimings();
          Object.assign(window.__perf, { start: performance.now(), readyAt: null, selector, longTasks: [] });
        }, item.ready);
        await page.locator(`.nav-item[data-view="${item.nav}"]`).click();
      } else {
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: mode === 'cold' });
        await page.goto(new URL(item.route, base).href, { waitUntil: 'domcontentloaded' });
        await page.evaluate(selector => {
          window.__perf.selector = selector;
          if (document.querySelector(selector)) window.__perf.readyAt = performance.now();
        }, item.ready);
      }
      await page.locator(item.ready).first().waitFor({ state: 'visible', timeout: 30000 });
      await page.waitForLoadState('networkidle');
      const measurement = await page.evaluate(() => {
        const p = window.__perf;
        return {
          readyMs: (p.readyAt ?? performance.now()) - p.start,
          domNodes: document.querySelectorAll('*').length,
          repositoryStatus: document.querySelector('[data-review-repository-region]')?.dataset.repositoryStatus || null,
          longTasks: p.longTasks.filter(e => e.start >= p.start),
          resources: performance.getEntriesByType('resource').filter(e => e.startTime >= p.start).map(e => ({
            path: new URL(e.name).pathname + new URL(e.name).search, startMs: e.startTime - p.start,
            durationMs: e.duration, bytes: e.decodedBodySize, transferBytes: e.transferSize,
          })),
        };
      });
      const sample = { name: item.name, readiness: item.name === '独立生成工作台' ? 'shell-only' : 'data-view', mode, round, ...measurement, responses, errors };
      samples.push(sample);
      console.log(`${item.name} ${mode} #${round}: ${Math.round(sample.readyMs)}ms, 长任务 ${sample.longTasks.length}, 错误 ${errors.length}`);
    }
    for (const item of cases) {
      for (const mode of ['cold', 'warm', ...(item.nav ? ['click'] : [])]) {
        for (let round = 1; round <= rounds; round++) await capture(item, mode, round);
      }
    }
    if (process.env.KC_PERF_CHECK_BEHAVIOR === '1') {
      const assert = require('node:assert/strict');
      responses = []; errors = [];
      await page.goto(new URL('/knowledge-center/production', base).href, { waitUntil: 'networkidle' });
      await page.locator('.production-handbook-table').waitFor();
      assert(!responses.some(r => r.path.includes('/production/generations')), '手册首页不应提前读取个人生成');
      const productionHandbook = await page.locator('[data-handbook-href]').first().getAttribute('data-handbook-href');
      const generationRequest = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/production/generations'));
      await page.locator('[data-production-overview-tab="generations"]').click();
      assert.equal((await generationRequest).status(), 200);
      await page.locator('.production-generations, .production-overview-empty:not([role])').first().waitFor();
      checks.push('手册首页延迟读取个人生成；点击我的生成后真实请求成功并展示');
      await page.reload({ waitUntil: 'networkidle' });
      await page.locator('.production-generations, .production-overview-empty:not([role])').first().waitFor();
      checks.push('我的生成刷新可恢复');
      for (const item of [
        { route: productionHandbook, ready: '.handbook-production-editor', label: '手册写作正文' },
        { route: cases.find(item => item.name === '审核正文')?.route, ready: '[data-review-repository-region][data-repository-status="ok"]', label: '审核仓库正文' },
      ]) {
        if (!item.route) continue;
        const start = Date.now();
        await page.goto(new URL(item.route, base).href, { waitUntil: 'networkidle' });
        await page.locator(item.ready).waitFor();
        const readyMs = Date.now() - start;
        await page.evaluate(selector => { window.__retainedNode = document.querySelector(selector); }, item.ready);
        const refreshed = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/platform/context'));
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('knowledge-data-changed', { detail: { scopes: ['context'], source: 'performance-regression' } })));
        await refreshed;
        await page.waitForLoadState('networkidle');
        await page.waitForFunction(() => !document.querySelector('#main').hasAttribute('aria-busy'));
        assert(await page.evaluate(selector => window.__retainedNode?.isConnected && window.__retainedNode === document.querySelector(selector), item.ready), `${item.label}不应被平台上下文刷新替换`);
        checks.push(`${item.label}真实读取及上下文刷新保留 DOM，通过（含 networkidle 等待 ${readyMs}ms，不作就绪指标）`);
      }
      if (errors.length) throw new Error(errors.join('; '));
    }
  } finally {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ measuredAt: new Date().toISOString(), cpuRate, rounds, samples, checks }, null, 2));
    await browser.close();
  }
  const budget = Number(process.env.KC_PERF_READY_BUDGET_MS || 0);
  if (samples.some(s => s.errors.length || s.responses.some(r => r.status >= 400) || (s.repositoryStatus && s.repositoryStatus !== 'ok') || (budget > 0 && s.readyMs > budget))) throw new Error('性能审计发现页面错误、接口失败、仓库未就绪或超出指定预算，详见报告');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
