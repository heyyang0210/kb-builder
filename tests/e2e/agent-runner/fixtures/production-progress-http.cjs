const assert = require('node:assert/strict');
const { createServer } = require('node:http');

async function exerciseProductionProgressHttp(page) {
  const requests = [];
  const tasks = [
    { id: 'draft', name: '待生成任务', state: 'draft', handbookId: 'H1', handbookName: '手册一', businessVersion: '23.4', createdAt: '2026-11-16T09:00:00Z' },
    { id: 'editing', name: '生成中任务', state: 'editing', handbookId: 'H1', handbookName: '手册一', businessVersion: '23.4', updatedAt: '2026-11-16T10:00:00Z' },
    { id: 'review', name: '审核任务', state: 'under_review', handbookId: 'H2', handbookName: '手册二', businessVersion: '24.1', activityAt: '2026-11-16T11:00:00Z' },
    { id: 'rejected', name: '退回任务', state: 'rejected', handbookId: 'H2', handbookName: '手册二', businessVersion: '24.1', updated_at: '2026-11-16T12:00:00Z' },
    { id: 'publish', name: '待发布任务', state: 'approved', handbookId: 'H3', handbookName: '手册三', businessVersion: '25.0', created_at: '2026-11-16T13:00:00Z' },
    { id: 'complete', name: '已完成任务', state: 'published', completion: { status: 'completed', label: '已完成' }, handbookId: 'H3', handbookName: '手册三', businessVersion: '25.0', startedAt: '2026-11-16T14:00:00Z' },
    { id: 'unknown', name: '未知状态任务', state: 'legacy_state', handbookId: 'H4', handbookName: '手册四', businessVersion: '26.0' },
  ];
  const backend = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams) });
    let data;
    if (url.pathname === '/knowledge-center/api/incremental-tasks' && req.method === 'GET') data = { items: tasks };
    else if (url.pathname === '/knowledge-center/api/production/work-calendar' && req.method === 'GET') {
      const year = Number(url.searchParams.get('year'));
      data = { configured: year === 2026, year, days: year === 2026 ? { '2026-11-16': 'holiday', '2026-11-15': 'workday' } : {} };
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: { message: '隔离进展服务未找到资源' } }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data }));
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const patterns = ['**/knowledge-center/api/incremental-tasks**', '**/knowledge-center/api/production/work-calendar**'];
  const handler = async route => {
    const url = new URL(route.request().url());
    url.hostname = '127.0.0.1';
    url.port = String(backend.address().port);
    await route.fulfill({ response: await route.fetch({ url: url.href }) });
  };
  for (const pattern of patterns) await page.route(pattern, handler);
  const progressTab = page.locator('[data-production-overview-tab="progress"]');
  const form = () => page.locator('[data-production-progress-filter]');
  const submit = () => form().locator('button[type="submit"]');
  const taskRows = () => page.locator('.production-progress-row');
  const setFilter = async (name, value) => {
    const field = form().locator(`[name="${name}"]`);
    if (await field.evaluate(el => el.tagName === 'SELECT')) await field.selectOption(value);
    else await field.fill(value);
    await submit().click();
  };
  try {
    await page.locator('[data-view="production"]').first().click();
    await progressTab.click();
    await page.locator('.production-calendar').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.production-progress-toolbar').count(), 1);
    await page.locator('[data-calendar-legend]').getByText('法定节假日', { exact: true }).waitFor();
    assert.equal(await page.locator('.production-calendar-legend').innerText(), '工作日\n周末\n法定节假日\n调休工作日');
    assert.match(await page.locator('[data-progress-day="2026-11-16"]').getAttribute('class'), /is-holiday/);
    assert.equal(requests.some(item => item.path.endsWith('/incremental-tasks')), true);
    assert.equal(requests.some(item => item.path.endsWith('/work-calendar') && item.query.year === '2026'), true);

    await page.locator('[data-progress-calendar-view="week"]').click();
    assert.equal(await page.locator('.production-calendar').getAttribute('data-calendar-view'), 'week');
    await page.locator('[data-progress-calendar-view="month"]').click();
    await page.locator('[data-progress-mode="list"]').click();
    assert.equal(await taskRows().count(), 7);
    assert.equal(await page.locator('.production-progress-stages [data-progress-stage]').count(), 8);
    assert.equal(await page.locator('.production-progress-stages').innerText().then(text => text.includes('状态待确认')), true);

    await page.locator('[data-progress-stage="待审核"]').click();
    assert.equal(await taskRows().count(), 1);
    assert.equal(await taskRows().first().getAttribute('data-progress-task-summary'), 'review');
    await page.locator('[data-progress-stage=""]').click();
    await setFilter('q', '不存在');
    assert.equal(await taskRows().count(), 0);
    assert.equal(await page.locator('.production-overview-empty').count(), 1);
    await page.locator('[data-production-progress-clear]').click();
    await setFilter('status', '已退回');
    assert.equal(await taskRows().count(), 1);
    await setFilter('handbook', '手册二');
    assert.equal(await taskRows().count(), 1);
    await setFilter('version', '24.1');
    assert.equal(await taskRows().count(), 1);
    await setFilter('from', '2026-11-16');
    await setFilter('to', '2026-11-16');
    assert.equal(await taskRows().count(), 1);
    await page.locator('[data-progress-mode="charts"]').click();
    assert.equal(await page.locator('.production-chart-row').count(), 7);
    assert.equal(await page.locator('.production-date-chart').count(), 1);
    return 13;
  } finally {
    for (const pattern of patterns) await page.unroute(pattern, handler);
    await new Promise(resolve => backend.close(resolve));
  }
}

module.exports = { exerciseProductionProgressHttp };
