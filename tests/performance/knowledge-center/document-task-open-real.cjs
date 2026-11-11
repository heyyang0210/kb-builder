const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../../..');
const envFile = path.join(root, 'config/knowledge-center/.env');
const localEnv = fs.existsSync(envFile) ? Object.fromEntries(fs.readFileSync(envFile, 'utf8').split(/\r?\n/)
  .filter(line => line && !line.startsWith('#') && line.includes('='))
  .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])) : {};
const username = process.env.KNOWLEDGE_CENTER_ADMIN_USERNAME || localEnv.KNOWLEDGE_CENTER_ADMIN_USERNAME;
const password = process.env.KNOWLEDGE_CENTER_ADMIN_PASSWORD || localEnv.KNOWLEDGE_CENTER_ADMIN_PASSWORD;
const base = process.env.KC_TASK_PERF_BASE_URL || 'http://127.0.0.1:13510';
const compareBase = process.env.KC_TASK_PERF_COMPARE_BASE_URL;
const output = path.join(root, 'runtime/test-results/task-focus-performance-20261110');
const reportName = process.env.KC_TASK_PERF_REPORT_NAME || 'real-page-open';
assert(/^[a-z0-9-]+$/.test(reportName), '报告名称只能包含小写字母、数字和连字符');
const percentile = (values, fraction) => values.slice().sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];

async function main() {
  assert(username && password, '缺少管理员性能测试凭据');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__taskOpenMeasurements = [];
      document.addEventListener('click', event => {
        const button = event.target.closest?.('[data-task-open]');
        if (!button) return;
        const number = button.dataset.taskOpen;
        const started = performance.now();
        const observer = new MutationObserver(() => {
          if (!document.querySelector('.task-workspace')) return;
          observer.disconnect();
          const domMs = performance.now() - started;
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const api = performance.getEntriesByType('resource').filter(entry => entry.name.includes(`/document-tasks/${encodeURIComponent(number)}`)).at(-1);
            window.__taskOpenMeasurements.push({ number, domMs: +domMs.toFixed(1), paintedMs: +(performance.now() - started).toFixed(1), apiMs: api ? +(api.responseEnd - started).toFixed(1) : null,
              serverTiming: Object.fromEntries((api?.serverTiming || []).map(item => [item.name, +item.duration.toFixed(1)])) });
          }));
        });
        observer.observe(document.querySelector('#view-root'), { childList: true, subtree: true });
      }, true);
    });
    await page.goto(`${base}/knowledge-center/document-tasks`, { waitUntil: 'domcontentloaded' });
    const login = await page.evaluate(async ({ username: loginName, password: secret }) => {
      const response = await fetch('/knowledge-center/api/auth/admin/login', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginName, password: secret }),
      });
      return response.status;
    }, { username, password });
    assert.equal(login, 200, `管理员登录失败：HTTP ${login}`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-task-open]').first().waitFor({ timeout: 30000 });
    const candidates = await page.locator('[data-task-open]').evaluateAll(buttons => buttons.slice(0, 5).map(button => button.dataset.taskOpen));
    assert(candidates.length >= 1, '真实任务列表为空');
    if (compareBase) {
      const comparisonContext = await browser.newContext();
      const comparisonLogin = await comparisonContext.request.post(`${compareBase}/knowledge-center/api/auth/admin/login`, { data: { username, password } });
      assert.equal(comparisonLogin.status(), 200, `对照网关登录失败：HTTP ${comparisonLogin.status()}`);
      for (const number of candidates) {
        const suffix = `/knowledge-center/api/document-tasks/${encodeURIComponent(number)}`;
        const [current, comparison] = await Promise.all([context.request.get(`${base}${suffix}`), comparisonContext.request.get(`${compareBase}${suffix}`)]);
        assert.equal(current.status(), 200, `当前网关任务读取失败：${number}`);
        assert.equal(comparison.status(), 200, `对照网关任务读取失败：${number}`);
        assert.deepEqual((await current.json()).data, (await comparison.json()).data, `任务投影不一致：${number}`);
      }
      await comparisonContext.close();
    }
    const samples = await page.evaluate(async numbers => {
      const waitFor = count => new Promise((resolve, reject) => {
        const deadline = performance.now() + 5000;
        const poll = () => window.__taskOpenMeasurements.length >= count ? resolve() : performance.now() > deadline ? reject(new Error('任务详情打开超过5秒')) : setTimeout(poll, 5);
        poll();
      });
      for (let index = 0; index < 30; index++) {
        const number = numbers[index % numbers.length];
        const button = [...document.querySelectorAll('[data-task-open]')].find(item => item.dataset.taskOpen === number);
        const count = window.__taskOpenMeasurements.length;
        const apiCount = performance.getEntriesByType('resource').filter(entry => entry.name.includes(`/document-tasks/${encodeURIComponent(number)}`)).length;
        button.click();
        await waitFor(count + 1);
        const deadline = performance.now() + 5000;
        while (performance.getEntriesByType('resource').filter(entry => entry.name.includes(`/document-tasks/${encodeURIComponent(number)}`)).length <= apiCount) {
          if (performance.now() > deadline) throw new Error('后台详情核对超过5秒');
          await new Promise(resolve => setTimeout(resolve, 5));
        }
        document.querySelector('[data-task-action="close"]').click();
      }
      return window.__taskOpenMeasurements;
    }, candidates);
    const painted = samples.map(sample => sample.paintedMs);
    const summary = { base, sampleCount: samples.length, candidateCount: candidates.length, payloadParity: compareBase ? 'passed' : 'not-requested', minMs: Math.min(...painted), medianMs: percentile(painted, 0.5), p95Ms: percentile(painted, 0.95), maxMs: Math.max(...painted), over100: painted.filter(value => value > 100).length };
    fs.writeFileSync(path.join(output, `${reportName}.json`), JSON.stringify({ metric: 'browser click to second animation frame after complete detail DOM', summary, samples }, null, 2));
    console.log(JSON.stringify(summary));
    assert.equal(summary.over100, 0, `详情打开存在 ${summary.over100} 次超过 100ms`);
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
