#!/usr/bin/env node
/* Collect Chromium V8 JavaScript coverage for the ESM knowledge-center pages. */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('@playwright/test');

const root = path.resolve(__dirname, '../..');
const port = Number(process.env.FRONTEND_COVERAGE_PORT || 3599);
const output = path.resolve(process.env.FRONTEND_COVERAGE_OUTPUT || path.join(root, 'runtime', 'coverage-20261019', 'frontend-v8-coverage.json'));
const pages = [
  '/knowledge-center/',
  '/knowledge-center/production',
  '/knowledge-center/outlines',
  '/knowledge-center/platform',
];

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('前端覆盖率服务启动超时')), 15000);
    const onData = chunk => {
      if (String(chunk).includes('Frontend server listening')) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('exit', code => {
      clearTimeout(timer);
      reject(new Error(`前端覆盖率服务异常退出：${code}`));
    });
  });
}

function summarize(entries) {
  let totalBytes = 0;
  let usedBytes = 0;
  let functions = 0;
  let executedFunctions = 0;
  for (const entry of entries) {
    if (!entry.url.includes('/knowledge-center/')) continue;
    const ranges = [];
    for (const functionEntry of entry.functions || []) {
      functions += 1;
      const executed = (functionEntry.ranges || []).some(range => range.count > 0);
      if (executed) executedFunctions += 1;
      for (const range of functionEntry.ranges || []) {
        const start = Number(range.startOffset ?? range.start ?? 0);
        const end = Number(range.endOffset ?? range.end ?? start);
        if (end > start) ranges.push({ start, end, count: range.count });
      }
    }
    // V8 ranges form a containment tree, including nested function ranges.
    // Sweep boundaries once and let the innermost range determine execution.
    ranges.sort((a, b) => a.start - b.start || b.end - a.end);
    const boundaries = [...new Set(ranges.flatMap(range => [range.start, range.end]))].sort((a, b) => a - b);
    const active = [];
    let next = 0;
    let previous = boundaries[0];
    for (const offset of boundaries) {
      const current = active[active.length - 1];
      if (current) {
        const length = offset - previous;
        totalBytes += length;
        if (current.count > 0) usedBytes += length;
      }
      while (active.length && active[active.length - 1].end <= offset) active.pop();
      while (next < ranges.length && ranges[next].start === offset) active.push(ranges[next++]);
      previous = offset;
    }
  }
  return {
    sourceFiles: entries.filter(entry => entry.url.includes('/knowledge-center/')).length,
    totalBytes,
    usedBytes,
    rangeCoverage: totalBytes ? Number((usedBytes / totalBytes * 100).toFixed(2)) : 0,
    functions,
    executedFunctions,
    functionCoverage: functions ? Number((executedFunctions / functions * 100).toFixed(2)) : 0,
  };
}

async function main() {
  const server = spawn(process.execPath, ['apps/knowledge-center-web/frontend-server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), KNOWLEDGE_CENTER_ENVIRONMENT: 'test', KNOWLEDGE_CENTER_TEST_RUN_ID: `frontend-coverage-${process.pid}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await waitForServer(server);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const cdp = await contextlessSession(browser, page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    for (const route of pages) {
      await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    }
    const coverage = await cdp.send('Profiler.takePreciseCoverage');
    await cdp.send('Profiler.stopPreciseCoverage');
    await cdp.send('Profiler.disable');
    const entries = coverage.result.map(entry => ({ ...entry, functions: entry.functions || [] }));
    await browser.close();
    const report = { generatedAt: new Date().toISOString(), pages, summary: summarize(entries), entries };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ output, summary: report.summary }, null, 2));
  } finally {
    server.kill('SIGTERM');
  }
}

async function contextlessSession(browser, page) {
  return page.context().newCDPSession(page);
}

if (require.main === module) {
  main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
}

module.exports = { summarize };
