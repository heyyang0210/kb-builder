#!/usr/bin/env node
// Read-only performance gate against an explicitly selected running instance.
const fs = require('node:fs');
const path = require('node:path');
const { sampleReads } = require('./sample-read-performance.cjs');
const { chromium } = require('playwright');
const budget = require('../../config/knowledge-center/handbook-performance.json');
const p95 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1];
const diagnosticsEnabled = process.env.KC_PERF_DIAGNOSTICS === '1';

function phaseTime(sample, collection, name, predicate = () => true) {
  return (sample[collection] || []).find(item => item.name === name && predicate(item))?.startMs ?? null;
}

function directoryDiagnosticChain(sample) {
  if (!diagnosticsEnabled) return null;
  const directoryResponseEndMs = Math.max(0, ...(sample.requests || [])
    .filter(request => request.kind === 'directory' && Number.isFinite(request.endMs))
    .map(request => request.endMs));
  if (!directoryResponseEndMs) return { complete: false, reason: 'directory-response-not-observed' };
  const stateUpdateStartMs = phaseTime(sample, 'marks', 'workspace.directoryStateUpdateStart');
  const stateUpdateEndMs = phaseTime(sample, 'marks', 'workspace.directoryStateUpdateEnd');
  const renderStartMs = phaseTime(sample, 'marks', 'render.start', item => item.activeView === 'production' && item.startMs >= (stateUpdateEndMs ?? 0));
  const domReplaceStartMs = phaseTime(sample, 'measures', 'render.viewRootReplace', item => item.startMs >= (stateUpdateEndMs ?? 0));
  const domReplacedMs = phaseTime(sample, 'marks', 'render.domReplaced', item => item.startMs >= (stateUpdateEndMs ?? 0));
  const syncCompleteMs = phaseTime(sample, 'marks', 'render.syncComplete', item => item.startMs >= (stateUpdateEndMs ?? 0));
  const firstDomMs = sample.firstDirectoryDomMs ?? phaseTime(sample, 'marks', 'browser.directoryDomDetected');
  const firstFrameMs = sample.firstDirectoryFrameMs ?? phaseTime(sample, 'marks', 'browser.directoryFirstFrame');
  const visibleMs = sample.directory ?? phaseTime(sample, 'marks', 'browser.directoryVisible');
  const chain = {
    complete: [stateUpdateStartMs, stateUpdateEndMs, domReplaceStartMs, domReplacedMs, firstFrameMs, visibleMs].every(Number.isFinite),
    directoryResponseEndMs,
    stateUpdateStartMs,
    stateUpdateEndMs,
    renderStartMs,
    domReplaceStartMs,
    domReplacedMs,
    syncCompleteMs,
    firstDirectoryDomMs: firstDomMs,
    firstDirectoryFrameMs: firstFrameMs,
    directoryVisibleMs: visibleMs,
  };
  if (Number.isFinite(stateUpdateStartMs)) chain.responseToStateStartMs = stateUpdateStartMs - directoryResponseEndMs;
  if (Number.isFinite(stateUpdateEndMs) && Number.isFinite(stateUpdateStartMs)) chain.stateUpdateDurationMs = stateUpdateEndMs - stateUpdateStartMs;
  if (Number.isFinite(domReplaceStartMs) && Number.isFinite(stateUpdateEndMs)) chain.stateToDomReplaceStartMs = domReplaceStartMs - stateUpdateEndMs;
  if (Number.isFinite(domReplacedMs) && Number.isFinite(domReplaceStartMs)) chain.domReplaceDurationMs = domReplacedMs - domReplaceStartMs;
  if (Number.isFinite(firstFrameMs) && Number.isFinite(domReplacedMs)) chain.domToFirstFrameMs = firstFrameMs - domReplacedMs;
  if (Number.isFinite(visibleMs) && Number.isFinite(directoryResponseEndMs)) chain.responseToVisibleMs = visibleMs - directoryResponseEndMs;
  return chain;
}

async function main() {
  const base = process.env.KPG_BASE_URL;
  const handbookId = process.env.KC_PERF_HANDBOOK_ID;
  const username = process.env.KNOWLEDGE_CENTER_ADMIN_USERNAME;
  const password = process.env.KNOWLEDGE_CENTER_ADMIN_PASSWORD;
  if (!base || !handbookId || !username || !password) throw Error('请显式配置 KPG_BASE_URL、KC_PERF_HANDBOOK_ID 和性能账号环境变量');
  const output = path.resolve(process.env.KC_PERF_OUTPUT || 'runtime/performance/handbook-gate.json');
  const browser = await chromium.launch({ headless: true });
  const results = { measurementMode: diagnosticsEnabled ? 'diagnostic' : 'formal', base, handbookId, budget, api: {}, browser: [], browserLevels: [] };
  const failures = [];
  try {
    const context = await browser.newContext();
    const login = await context.request.post(new URL('/knowledge-center/api/auth/admin/login', base).href, { data: { username, password } });
    if (!login.ok()) throw Error(`登录失败 HTTP ${login.status()}`);
    const cookies = (await context.cookies()).map(item => `${item.name}=${item.value}`).join('; ');
    const paths = {};
    const storageState = await context.storageState();
    await context.close();
    for (const concurrency of budget.browserConcurrencyLevels) {
      const level = { concurrency, samples: [] };
      results.browserLevels.push(level);
      for (let offset = 0; offset < budget.browserRounds; offset += concurrency) {
        const workers = [];
        try {
          for (let index = offset; index < Math.min(offset + concurrency, budget.browserRounds); index++) {
            const isolated = await browser.newContext({ storageState });
            const page = await isolated.newPage();
            const worker = { isolated, page, reads: [], sample: { round: index + 1, passed: false } };
            workers.push(worker);
            await page.addInitScript(({ diagnosticsEnabled }) => {
              window.__handbookPerf = { start: 0, loading: false, directory: null, body: null,
                firstDirectoryDomMs: null, firstDirectoryFrameMs: null, directoryFrameAttempts: 0,
                directoryDetachedFrames: 0, directoryHiddenFrames: 0 };
              window.__knowledgeCenterPerformance = { enabled: diagnosticsEnabled, start: 0, measures: [], marks: [] };
              const recordMark = (name, detail = undefined) => {
                const diagnostics = window.__knowledgeCenterPerformance;
                if (!diagnostics?.enabled) return;
                diagnostics.marks ||= [];
                diagnostics.marks.push({ name, startMs: performance.now(), ...(detail || {}) });
              };
              const tasks = [];
              window.__handbookPerfTasks = tasks;
              if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
                new PerformanceObserver(list => tasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration }))))
                  .observe({ type: 'longtask', buffered: true });
              }
              document.addEventListener('click', event => {
                if (event.target.closest('[data-handbook-href]')) window.__handbookPerf.start = performance.now();
              }, true);
              new MutationObserver(() => {
                const state = window.__handbookPerf;
                if (!state.start) return;
                if (document.querySelector('.handbook-production-loading')) state.loading = true;
                const directory = document.querySelector('.handbook-production-directory[aria-hidden="false"]');
                if (state.loading && state.directory === null && directory) {
                  if (state.firstDirectoryDomMs === null) {
                    state.firstDirectoryDomMs = performance.now() - state.start;
                    recordMark('browser.directoryDomDetected');
                  }
                  requestAnimationFrame(() => {
                    state.directoryFrameAttempts += 1;
                    if (state.firstDirectoryFrameMs === null) {
                      state.firstDirectoryFrameMs = performance.now() - state.start;
                      recordMark('browser.directoryFirstFrame');
                    }
                    if (!directory.isConnected) { state.directoryDetachedFrames += 1; return; }
                    const rect = directory.getBoundingClientRect();
                    if (state.directory === null && directory.isConnected && directory.getAttribute('aria-hidden') === 'false'
                      && rect.width > 0 && rect.left >= 0 && getComputedStyle(directory).pointerEvents !== 'none') {
                      state.directory = performance.now() - state.start;
                      recordMark('browser.directoryVisible');
                    } else state.directoryHiddenFrames += 1;
                  });
                }
                if (state.body === null && document.querySelector('[data-handbook-save-status]')) state.body = performance.now() - state.start;
              }).observe(document, { childList: true, subtree: true });
            }, { diagnosticsEnabled });

            page.on('response', response => {
              const url = new URL(response.url());
              if (response.request().method() !== 'GET') return;
              const name = url.searchParams.get('view') === 'directory' ? 'directory'
                : /\/documents\/[^/]+\/draft$/.test(url.pathname) ? 'draft' : null;
              if (!name) return;
              paths[name] = url.pathname + url.search;
              worker.reads.push((async () => {
                const payload = await response.json().catch(() => null);
                return { name, status: response.status(), passed: response.ok() && payload?.success === true && payload.data !== undefined };
              })());
            });
          }
          // All pages reach the same starting point before concurrent clicks.
          await Promise.all(workers.map(async worker => {
            try {
              await worker.page.goto(new URL('/knowledge-center/production', base).href, { waitUntil: 'networkidle', timeout: budget.timeoutMs });
              const target = worker.page.locator('[data-handbook-href]');
              const index = await target.evaluateAll((nodes, id) => nodes.findIndex(node => decodeURIComponent(node.dataset.handbookHref || '').includes(`/handbook/${id}`)), handbookId);
              if (index < 0) throw Error('生成文档首页没有目标手册入口');
              worker.target = target.nth(index);
            } catch (error) { worker.sample.error = error.message; }
          }));
          await Promise.all(workers.map(async worker => {
            if (worker.sample.error) return;
            const { page, sample } = worker;
            try {
              await page.evaluate(() => Object.assign(window.__knowledgeCenterPerformance, { start: performance.now(), measures: [], marks: [] }));
              await worker.target.click({ timeout: budget.timeoutMs });
              await page.waitForFunction(() => window.__handbookPerf.directory !== null && window.__handbookPerf.body !== null, null, { timeout: budget.timeoutMs });
              await page.waitForLoadState('networkidle', { timeout: budget.timeoutMs });
              Object.assign(sample, await page.evaluate(() => {
                const { start, directory, body, firstDirectoryDomMs, firstDirectoryFrameMs,
                  directoryFrameAttempts, directoryDetachedFrames, directoryHiddenFrames } = window.__handbookPerf;
                const requests = performance.getEntriesByType('resource').filter(entry => entry.startTime >= start && entry.name.includes('/knowledge-center/api/')).map(entry => ({
                  kind: entry.name.includes('view=directory') ? 'directory' : /\/documents\/[^/]+\/draft(?:\?|$)/.test(entry.name) ? 'draft' : entry.name.includes('/gitlab/mappings/') ? 'mapping' : 'supporting',
                  startMs: entry.startTime - start, endMs: entry.responseEnd - start, durationMs: entry.duration,
                  serverTiming: (entry.serverTiming || []).map(timing => ({ name: timing.name, duration: timing.duration })),
                }));
                const longTasks = (window.__handbookPerfTasks || []).filter(entry => entry.start >= start)
                  .map(entry => ({ startMs: entry.start - start, durationMs: entry.duration }));
                return { directory, body, firstDirectoryDomMs, firstDirectoryFrameMs,
                  directoryFrameAttempts, directoryDetachedFrames, directoryHiddenFrames, requests, longTasks,
                  measures: (window.__knowledgeCenterPerformance?.measures || [])
                    .filter(measure => measure.startMs >= start)
                    .map(measure => ({ ...measure, startMs: measure.startMs - start })),
                  marks: (window.__knowledgeCenterPerformance?.marks || [])
                    .filter(mark => mark.startMs >= start)
                    .map(mark => ({ ...mark, startMs: mark.startMs - start })),
                };
              }));
              sample.diagnosticChain = directoryDiagnosticChain(sample);
              sample.reads = await Promise.all(worker.reads);
              sample.passed = ['directory', 'draft'].every(name => sample.reads.some(read => read.name === name)) && sample.reads.every(read => read.passed);
              if (!sample.passed) sample.error = '目录/草稿未成功读取';
            } catch (error) { sample.error = error.message; sample.reads = await Promise.all(worker.reads); }
          }));
        } finally {
          level.samples.push(...workers.map(worker => worker.sample));
          await Promise.all(workers.map(worker => worker.isolated.close()));
        }
      }
      const successful = level.samples.filter(sample => sample.passed);
      level.successes = successful.length;
      level.failures = level.samples.length - successful.length;
      level.directoryVisibleP95Ms = successful.length ? p95(successful.map(sample => sample.directory)) : null;
      level.bodyReadyP95Ms = successful.length ? p95(successful.map(sample => sample.body)) : null;
      if (level.failures || level.samples.length !== budget.browserRounds) failures.push(`浏览器${concurrency}路存在失败或缺失样本`);
      if (level.directoryVisibleP95Ms > budget.directoryVisibleP95Ms) failures.push(`浏览器${concurrency}路目录可见 P95 超预算`);
      if (level.bodyReadyP95Ms > budget.bodyReadyP95Ms) failures.push(`浏览器${concurrency}路正文就绪 P95 超预算`);
      if (concurrency === 1) {
        results.browser = level.samples;
        results.directoryVisibleP95Ms = level.directoryVisibleP95Ms;
        results.bodyReadyP95Ms = level.bodyReadyP95Ms;
      }
    }
    for (const name of ['directory', 'draft']) {
      if (!paths[name]) throw Error(`没有观测到 ${name} 请求`);
      results.api[name] = { levels: [] };
      for (const concurrency of budget.apiConcurrencyLevels) {
        const measured = await sampleReads(new URL(paths[name], base), {
          rounds: budget.apiRounds, concurrency, timeoutMs: budget.timeoutMs, headers: { cookie: cookies }, requireJsonSuccess: true,
        });
        results.api[name].levels.push(measured);
        if (measured.failures) failures.push(`${name} ${concurrency}路出现${measured.failures}个失败样本`);
        if (measured.p95Ms > budget[`${name}P95Ms`]) failures.push(`${name} ${concurrency}路 API P95 超预算`);
        if (measured.maxBytes > budget[`${name}MaxBytes`]) failures.push(`${name} ${concurrency}路响应字节超预算`);
      }
    }
  } catch (error) {
    failures.push(`采样未完整执行：${error.message}`);
  } finally {
    await browser.close();
    results.passed = failures.length === 0;
    results.failures = failures;
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(results, null, 2));
  }
  console.log(JSON.stringify({ directoryVisibleP95Ms: results.directoryVisibleP95Ms, bodyReadyP95Ms: results.bodyReadyP95Ms, failures, output }));
  if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
