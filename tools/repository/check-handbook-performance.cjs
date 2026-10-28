#!/usr/bin/env node
// Read-only performance gate against an explicitly selected running instance.
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { chromium } = require('playwright');
const budget = require('../../config/knowledge-center/handbook-performance.json');
const p95 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1];

async function main() {
  const base = process.env.KPG_BASE_URL;
  const handbookId = process.env.KC_PERF_HANDBOOK_ID;
  const username = process.env.KNOWLEDGE_CENTER_ADMIN_USERNAME;
  const password = process.env.KNOWLEDGE_CENTER_ADMIN_PASSWORD;
  if (!base || !handbookId || !username || !password) throw Error('请显式配置 KPG_BASE_URL、KC_PERF_HANDBOOK_ID 和性能账号环境变量');
  const output = path.resolve(process.env.KC_PERF_OUTPUT || 'runtime/performance/handbook-gate.json');
  const browser = await chromium.launch({ headless: true });
  const results = { base, handbookId, budget, api: {}, browser: [] };
  const failures = [];
  try {
    const context = await browser.newContext();
    const login = await context.request.post(new URL('/knowledge-center/api/auth/admin/login', base).href, { data: { username, password } });
    if (!login.ok()) throw Error(`登录失败 HTTP ${login.status()}`);
    const cookies = (await context.cookies()).map(item => `${item.name}=${item.value}`).join('; ');
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__handbookPerf = { start: 0, loading: false, directory: null, body: null };
      document.addEventListener('click', event => {
        if (event.target.closest('[data-handbook-href]')) window.__handbookPerf.start = performance.now();
      }, true);
      new MutationObserver(() => {
        const state = window.__handbookPerf;
        if (!state.start) return;
        if (document.querySelector('.handbook-production-loading')) state.loading = true;
        const directory = document.querySelector('.handbook-production-directory[aria-hidden="false"]');
        if (state.loading && state.directory === null && directory) {
          requestAnimationFrame(() => {
            const rect = directory.getBoundingClientRect();
            if (state.directory === null && directory.isConnected && directory.getAttribute('aria-hidden') === 'false'
              && rect.width > 0 && rect.left >= 0 && getComputedStyle(directory).pointerEvents !== 'none') {
              state.directory = performance.now() - state.start;
            }
          });
        }
        if (state.body === null && document.querySelector('[data-handbook-save-status]')) state.body = performance.now() - state.start;
      }).observe(document, { childList: true, subtree: true });
    });
    const paths = {};
    page.on('request', req => {
      const url = new URL(req.url());
      if (url.searchParams.get('view') === 'directory') paths.directory = url.pathname + url.search;
      if (url.pathname.includes('/draft') && url.pathname.includes('/documents/')) paths.draft = url.pathname + url.search;
    });
    for (let round = 0; round < budget.browserRounds; round++) {
      await page.goto(new URL('/knowledge-center/production', base).href, { waitUntil: 'networkidle' });
      // Resolve by href instead of a Chinese title that administrators may rename.
      const target = page.locator('[data-handbook-href]');
      const handle = await target.evaluateAll((nodes, id) => nodes.findIndex(node => decodeURIComponent(node.dataset.handbookHref || '').includes(`/handbook/${id}`)), handbookId);
      if (handle < 0) throw Error('生成文档首页没有目标手册入口');
      await page.evaluate(() => Object.assign(window.__handbookPerf, { start: 0, loading: false, directory: null, body: null }));
      await target.nth(handle).click();
      await page.waitForFunction(() => window.__handbookPerf.directory !== null && window.__handbookPerf.body !== null, null, { timeout: budget.timeoutMs });
      results.browser.push(await page.evaluate(() => ({ directory: window.__handbookPerf.directory, body: window.__handbookPerf.body })));
      await page.waitForLoadState('networkidle');
    }
    for (const name of ['directory', 'draft']) {
      if (!paths[name]) throw Error(`没有观测到 ${name} 请求`);
      const samples = [];
      for (let i = 0; i < budget.apiRounds; i++) {
        const started = performance.now();
        const response = await fetch(new URL(paths[name], base), { headers: { cookie: cookies }, signal: AbortSignal.timeout(budget.timeoutMs) });
        const body = await response.text();
        if (!response.ok) throw Error(`${name} HTTP ${response.status}`);
        samples.push({ ms: performance.now() - started, bytes: Buffer.byteLength(body), timing: response.headers.get('server-timing') });
      }
      results.api[name] = { p95Ms: p95(samples.map(item => item.ms)), maxBytes: Math.max(...samples.map(item => item.bytes)), samples };
      if (results.api[name].p95Ms > budget[`${name}P95Ms`]) failures.push(`${name} API P95 超预算`);
      if (results.api[name].maxBytes > budget[`${name}MaxBytes`]) failures.push(`${name} 响应字节超预算`);
    }
    results.directoryVisibleP95Ms = p95(results.browser.map(item => item.directory));
    results.bodyReadyP95Ms = p95(results.browser.map(item => item.body));
    if (results.directoryVisibleP95Ms > budget.directoryVisibleP95Ms) failures.push('目录可见 P95 超预算');
    if (results.bodyReadyP95Ms > budget.bodyReadyP95Ms) failures.push('正文就绪 P95 超预算');
  } finally {
    await browser.close();
    results.failures = failures;
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(results, null, 2));
  }
  console.log(JSON.stringify({ directoryVisibleP95Ms: results.directoryVisibleP95Ms, bodyReadyP95Ms: results.bodyReadyP95Ms, failures, output }));
  if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
