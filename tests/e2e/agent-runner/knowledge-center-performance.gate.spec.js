const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// 这是性能门禁，不使用 mock 数据；默认指向当前实际知识中心环境。
const baseUrl = process.env.KPG_BASE_URL || 'http://192.168.130.180:13510';
const localEnv = (() => {
  const file = path.resolve(__dirname, '../../../config/knowledge-center/.env');
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#') && line.includes('=')).map(line => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
})();
const username = process.env.KNOWLEDGE_CENTER_ADMIN_USERNAME || localEnv.KNOWLEDGE_CENTER_ADMIN_USERNAME;
const password = process.env.KNOWLEDGE_CENTER_ADMIN_PASSWORD || localEnv.KNOWLEDGE_CENTER_ADMIN_PASSWORD;
const budgetMs = Number(process.env.KC_PERF_BUDGET_MS || 1200);
const storageUrl = process.env.KC_STORAGE_URL || 'http://127.0.0.1:14210';
const storageBudgetMs = Number(process.env.KC_STORAGE_PERF_BUDGET_MS || 150);
const reviewInteractiveBudgetMs = Number(process.env.KC_REVIEW_INTERACTIVE_BUDGET_MS || 150);
const reviewRepositoryBudgetMs = Number(process.env.KC_REVIEW_REPOSITORY_BUDGET_MS || 800);
const requireReadableReviewRepository = process.env.KC_REVIEW_REQUIRE_READABLE === '1';
const routes = [
  ['/knowledge-center/assets', '知识资产', '[data-asset-loaded="true"]'],
  ['/knowledge-center/outlines', '大纲管理', '.outline-list'],
  ['/knowledge-center/templates', '模板管理', '[data-template-id]'],
  ['/knowledge-center/review', '审核与发布', '.review-workspace, .review-zero-state'],
];
const percentile = (values, value) => values.slice().sort((a, b) => a - b)[Math.ceil(values.length * value) - 1];
const parseServerTiming = header => Object.fromEntries(String(header || '').split(',').map(item => {
  const [name, duration] = item.trim().split(';dur=');
  return [name, Number(duration)];
}).filter(([name, duration]) => name && Number.isFinite(duration)));

test.describe('知识中心刷新性能门禁', () => {
  test.describe.configure({ mode: 'serial', timeout: 30000 });

  test.beforeEach(async ({ page }) => {
    expect(username && password, '请通过环境变量或 config/knowledge-center/.env 配置性能门禁管理员账号').toBeTruthy();
    // 先建立同源页面，about:blank 无法向真实服务发起跨源登录请求。
    await page.goto(`${baseUrl}/knowledge-center/`, { waitUntil: 'domcontentloaded' });
    // 通过浏览器 fetch 登录，确保 Set-Cookie 写入页面 cookie jar。
    const result = await page.evaluate(async ({ url, login, secret }) => {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: login, password: secret }),
      });
      return { ok: response.ok, status: response.status };
    }, { url: `${baseUrl}/knowledge-center/api/auth/admin/login`, login: username, secret: password });
    expect(result.ok, `管理员登录失败：HTTP ${result.status}`).toBeTruthy();
  });

  test(`YashanDB 手册投影分段耗时不超过${storageBudgetMs}ms`, async ({ request }, testInfo) => {
    const samples = [];
    for (let round = 1; round <= 5; round += 1) {
      const startedAt = Date.now();
      const response = await request.get(`${storageUrl}/v1/domain/handbooks`);
      const elapsedMs = Date.now() - startedAt;
      expect(response.ok(), `Storage 手册投影失败：HTTP ${response.status()}`).toBeTruthy();
      const payload = await response.json();
      samples.push({ round, elapsedMs, handbooks: payload.handbooks?.length || 0, ...parseServerTiming(response.headers()['server-timing']) });
    }
    const p95Ms = percentile(samples.map(item => item.elapsedMs), 0.95);
    console.log(`[knowledge-center-performance] storage handbooks p95=${p95Ms}ms samples=${samples.map(item => item.elapsedMs).join(',')}`);
    await testInfo.attach('YashanDB手册投影-performance.json', {
      body: JSON.stringify({ storageUrl, budgetMs: storageBudgetMs, p95Ms, samples }, null, 2),
      contentType: 'application/json',
    });
    expect(samples.every(item => item.handbooks > 0)).toBe(true);
    expect(samples.every(item => item['db-query'] <= storageBudgetMs)).toBe(true);
    expect(p95Ms).toBeLessThanOrEqual(storageBudgetMs);
  });

  test(`审核主体与仓库正文分层性能门禁`, async ({ page }, testInfo) => {
    const samples = [];
    // 刷新体验使用已加载过一次的静态资源缓存；冷启动另由资源体积和请求数门禁看护。
    await page.goto(`${baseUrl}/knowledge-center/review`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-review-repository-region]:not([data-repository-status="loading"])')).toBeVisible();
    await page.waitForLoadState('networkidle');
    for (let round = 1; round <= 5; round += 1) {
      await page.goto(`${baseUrl}/knowledge-center/review`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.review-workspace, .review-zero-state').first()).toBeVisible();
      await expect(page.locator('[data-review-repository-region]:not([data-repository-status="loading"])')).toBeVisible();
      const sample = await page.evaluate(roundNumber => {
        const marks = Object.fromEntries(performance.getEntriesByType('mark').map(item => [item.name, item.startTime]));
        const repositoryStatus = document.querySelector('[data-review-repository-region]')?.dataset.repositoryStatus;
        return { round: roundNumber, repositoryStatus, forbiddenLoadingMessage: document.body?.textContent?.includes('仓库正文尚未加载') === true, staticShellAt: marks['review-static-shell-painted'], interactiveAt: marks['review-workspace-ready'], repositoryAt: repositoryStatus === 'ok' ? marks['review-repository-ready'] : undefined };
      }, round);
      samples.push(sample);
      await page.waitForLoadState('networkidle');
    }
    const staticShellP95 = percentile(samples.map(item => item.staticShellAt), 0.95);
    const interactiveP95 = percentile(samples.map(item => item.interactiveAt), 0.95);
    const readableSamples = samples.filter(item => Number.isFinite(item.repositoryAt));
    const repositoryP95 = readableSamples.length === samples.length ? percentile(readableSamples.map(item => item.repositoryAt), 0.95) : null;
    console.log(`[knowledge-center-performance] review static=${staticShellP95}ms interactive=${interactiveP95}ms repository=${repositoryP95 ?? 'not-readable'} statuses=${samples.map(item => item.repositoryStatus).join(',')}`);
    await testInfo.attach('审核与发布分层-performance.json', {
      body: JSON.stringify({ staticShellP95, interactiveP95, repositoryP95, samples }, null, 2),
      contentType: 'application/json',
    });
    expect(samples.every(item => item.forbiddenLoadingMessage === false)).toBe(true);
    expect(staticShellP95).toBeLessThanOrEqual(80);
    expect(interactiveP95).toBeLessThanOrEqual(reviewInteractiveBudgetMs);
    if (requireReadableReviewRepository) expect(readableSamples).toHaveLength(samples.length);
    if (repositoryP95 !== null) expect(repositoryP95).toBeLessThanOrEqual(reviewRepositoryBudgetMs);
  });

  for (const [route, title, readySelector] of routes) {
    test(`${title}首屏可用时间不超过${budgetMs}ms`, async ({ page }, testInfo) => {
      const apiRequests = [];
      await page.addInitScript(selector => {
        window.__knowledgeCenterPerformance = {};
        const capture = () => {
          const state = window.__knowledgeCenterPerformance;
          if (!state.shellAt && document.querySelector('#app-shell:not([hidden])')) state.shellAt = performance.now();
          if (!state.readyAt && document.querySelector(selector)) state.readyAt = performance.now();
        };
        new MutationObserver(capture).observe(document, { subtree: true, childList: true, attributes: true });
        document.addEventListener('DOMContentLoaded', () => {
          window.__knowledgeCenterPerformance.domContentLoadedAt = performance.now();
          capture();
        });
      }, readySelector);
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.pathname.startsWith('/knowledge-center/api/')) apiRequests.push(`${url.pathname}${url.search}`);
      });
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#page-title')).toHaveText(title);
      await expect(page.locator(readySelector).first()).toBeVisible();
      if (route === '/knowledge-center/templates') {
        await expect(page.locator('.template-preview')).not.toContainText('暂无正文，请进入 Markdown 编辑或上传文档。');
      }
      await page.waitForFunction(() => Number.isFinite(window.__knowledgeCenterPerformance?.readyAt));
      const segments = await page.evaluate(() => {
        const state = window.__knowledgeCenterPerformance;
        const resources = performance.getEntriesByType('resource');
        const api = resources.filter(item => item.name.includes('/knowledge-center/api/')).map(item => ({
          path: `${new URL(item.name).pathname}${new URL(item.name).search}`,
          startMs: Math.round(item.startTime), durationMs: Math.round(item.duration), endMs: Math.round(item.startTime + item.duration),
        }));
        return {
          navigationResponseMs: Math.round(performance.getEntriesByType('navigation')[0]?.responseEnd || 0),
          domContentLoadedMs: Math.round(state.domContentLoadedAt || 0),
          authAndShellMs: Math.round((state.shellAt || 0) - (state.domContentLoadedAt || 0)),
          shellVisibleMs: Math.round(state.shellAt || 0),
          pageDataAndRenderMs: Math.round((state.readyAt || 0) - (state.shellAt || 0)),
          readyMs: Math.round(state.readyAt || 0),
          api,
        };
      });
      const elapsedMs = segments.readyMs;
      // 记录实际耗时，便于门禁失败时判断是环境抖动还是回归。
      console.log(`[knowledge-center-performance] ${route} ready=${elapsedMs}ms dcl=${segments.domContentLoadedMs}ms page=${segments.pageDataAndRenderMs}ms requests=${apiRequests.length}`);
      await testInfo.attach(`${title}-performance.json`, {
        body: JSON.stringify({ route, title, elapsedMs, segments, apiRequests }, null, 2),
        contentType: 'application/json',
      });
      expect(elapsedMs).toBeLessThanOrEqual(budgetMs);
      expect(apiRequests.some(path => path.startsWith('/knowledge-center/api/platform/overview'))).toBe(false);
      expect(apiRequests.some(path => path.startsWith('/knowledge-center/api/outline/build-tasks'))).toBe(false);
      if (route === '/knowledge-center/assets') {
        expect(apiRequests.some(path => /\/gitlab\/handbooks\/[^/]+\/statistics(?:\?|$)/.test(path))).toBe(false);
      }
      if (route === '/knowledge-center/templates') {
        expect(apiRequests.filter(path => path === '/knowledge-center/api/templates?summary=1')).toHaveLength(1);
        expect(apiRequests.filter(path => /^\/knowledge-center\/api\/templates\/[^/?]+$/.test(path))).toHaveLength(1);
      }
    });
  }
});
