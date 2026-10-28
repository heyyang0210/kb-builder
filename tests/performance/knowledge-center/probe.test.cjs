const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { chromium } = require('playwright');
const { installProbe, resumeProbe, aggregate, finalizeEvidence } = require('./probe.cjs');

test('真实浏览器探针保留交互起点、拒绝旧终态并支持完整页面跳转', async () => {
  const server = http.createServer((req, res) => {
    const body = req.url === '/next' ? '<main>新页面业务正文</main>'
      : '<button id="start" onclick="document.querySelector(\'#feedback\').hidden=false;setTimeout(()=>document.querySelector(\'#ready\').hidden=false,160)">开始</button><p id="feedback" hidden>处理中</p><main id="ready" hidden>正文</main><a href="/next">下一页</a><details><summary>详情</summary><input id="closed"></details>';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.addInitScript({ content: `const installProbe = ${installProbe.toString()}; (${resumeProbe.toString()})();` });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await assert.rejects(page.evaluate(installProbe, { target: '#start', event: 'click', feedback: { selector: '#start' }, ready: { selector: '#start' } }), /终态在交互前已成立/);
    assert.equal(await page.evaluate(() => window.__journeyProbe), null);
    await page.evaluate(installProbe, { target: '#start', event: 'click', feedback: { selector: '#feedback' }, ready: { selector: '#ready' } });
    await page.locator('#start').click();
    await page.waitForFunction(() => Number.isFinite(window.__journeyProbe?.readyMs));
    const result = await page.evaluate(() => ({ feedback: window.__journeyProbe.feedbackMs, ready: window.__journeyProbe.readyMs }));
    assert.ok(result.ready >= 160, JSON.stringify(result));
    assert.ok(result.feedback < result.ready, JSON.stringify(result));
    await page.evaluate(() => { document.querySelector('#feedback').hidden = true; document.querySelector('#ready').hidden = true; document.querySelector('#start').onclick = () => { document.querySelector('#feedback').hidden = false; }; });
    await page.evaluate(installProbe, { target: '#start', event: 'click', feedback: { selector: '#feedback' }, ready: { selector: '#closed' }, failure: { selector: '#feedback' } });
    await page.locator('#start').click();
    await page.waitForFunction(() => Number.isFinite(window.__journeyProbe?.failureMs));
    assert.equal(await page.evaluate(() => window.__journeyProbe.readyMs), null, '关闭details内部元素不能误算可见成功终态');
    await page.evaluate(installProbe, { target: 'a', event: 'click', feedback: { selector: 'main', text: '新页面业务正文' }, ready: { selector: 'main', text: '新页面业务正文' } });
    await page.locator('a').click();
    await page.waitForFunction(() => Number.isFinite(window.__journeyProbe?.readyMs));
    assert.ok(await page.evaluate(() => window.__journeyProbe.readyMs > 0));
    await page.evaluate(() => window.__journeyProbe.stop());
    assert.equal(await page.evaluate(() => sessionStorage.getItem('__knowledgeCenterJourneyProbe')), null);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});

test('超时和缺失时间不会从分位值及门禁中静默消失', () => {
  const rows = aggregate([{ module: '模块', step: '点击', status: '完成', feedbackMs: 20, readyMs: 100 },
    { module: '模块', step: '点击', status: '失败', readyMs: null }], { feedbackP95Ms: 200, readyP95Ms: 500 });
  assert.equal(rows[0].samples, 2); assert.equal(rows[0].failures, 1); assert.equal(rows[0].passed, false);
});

test('最终证据复核捕获晚到接口错误并清除未交互步骤的前序时间', () => {
  const report = { fixtures: { handbook: { handbookId: 'OWN' } }, journeys: [{ name: '审核', round: 1, status: '完成' }], samples: [
    { module: '审核', round: 1, status: '完成', actionAt: 1, readyMs: 90, requests: [{ status: 409, path: '/knowledge-center/api/review/repository-context' }] },
    { status: '失败', feedbackMs: 40, readyMs: 40, requests: [] },
    { status: '完成', actionAt: 2, requests: [{ status: 404, path: '/knowledge-center/api/gitlab/mappings/OWN' }] },
    { status: '完成', actionAt: 3, requests: [{ status: 404, path: '/knowledge-center/api/gitlab/mappings/OTHER' }] },
  ] };
  finalizeEvidence(report);
  assert.equal(report.samples[0].status, '失败');
  assert.equal(report.journeys[0].status, '失败');
  assert.equal(report.samples[1].readyMs, null);
  assert.equal(report.samples[2].status, '完成');
  assert.equal(report.samples[3].status, '失败');
});
