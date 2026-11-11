const assert = require('node:assert/strict');
const { createServer } = require('node:http');

async function exerciseIncrementalCreateHttp(page) {
  const requests = [];
  let baselineMode = 'failure', createFails = true;
  const task = { id: 'isolated-incremental-create', name: '隔离增量任务', handbookId: 'isolated-h1', state: 'draft', businessVersion: '23.4', baselineVersionId: 'base-display', sources: [], operations: [] };
  const backend = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const url = new URL(req.url, 'http://localhost');
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body, key: req.headers['idempotency-key'] });
    let status = 200, data;
    if (url.pathname.endsWith('/baselines')) {
      if (baselineMode === 'failure') status = 503;
      else if (baselineMode === 'empty') data = { items: [] };
      else if (baselineMode === 'missing-items') data = {};
      else {
        const items = [{ id: 'base-display', displayName: '基线 <正式> & 稳定' }, { id: 'base-version', versionName: '业务版本基线' }, { id: 'base-id' }];
        data = baselineMode === 'array' ? items : { items };
      }
    } else if (url.pathname === '/knowledge-center/api/incremental-tasks') {
      if (req.method === 'POST') { if (createFails) status = 503; else data = task; }
      else data = { items: createFails ? [] : [task] };
    } else if (url.pathname.endsWith('/isolated-incremental-create')) data = { task };
    else if (url.pathname.includes('/handbooks')) data = { items: [{ id: 'isolated-h1', name: '隔离手册一' }, { id: 'isolated-h2', name: '隔离手册二' }] };
    else if (url.pathname === '/knowledge-center/api/outline/catalog') data = { items: [] };
    else { status = 404; }
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status === 200 ? { success: true, data } : { success: false, error: { code: 'ISOLATED_INCREMENTAL_FAILURE', message: '隔离增量服务不可用' } }));
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const patterns = ['**/knowledge-center/api/incremental-tasks**', '**/knowledge-center/api/assets/handbooks**', '**/knowledge-center/api/outline/catalog**'];
  const handler = async route => {
    const url = new URL(route.request().url()); url.hostname = '127.0.0.1'; url.port = String(backend.address().port);
    await route.fulfill({ response: await route.fetch({ url: url.href }) });
  };
  for (const pattern of patterns) await page.route(pattern, handler);
  const dialog = () => page.locator('[data-incremental-create-dialog]');
  const form = () => dialog().locator('form');
  const field = name => form().locator(`[name="${name}"]`);
  const load = () => form().locator('[data-incremental-load-baselines]');
  const submit = () => form().locator('button[type="submit"]');
  const status = text => page.waitForFunction(text => document.querySelector('.incremental-baseline-status')?.textContent.includes(text), text);
  try {
    await page.locator('[data-view="production"]').first().click();
    await page.locator('[data-incremental-create-open]').click();
    await dialog().waitFor({ state: 'visible' });
    await load().click(); await status('请先选择手册并填写业务版本');
    assert.equal(requests.some(r => r.path.endsWith('/baselines')), false);
    await field('handbookId').selectOption('isolated-h1');
    await load().click(); await status('请先选择手册并填写业务版本');
    await field('businessVersion').fill(' 23.4 '); await field('businessVersion').blur();
    await load().click(); await status('隔离增量服务不可用');
    assert.equal(await load().isEnabled(), true);
    baselineMode = 'empty'; await load().click(); await status('无真实已发布基线');
    assert.equal(await field('baselineVersionId').isDisabled(), true);
    assert.equal(await submit().isDisabled(), true);
    baselineMode = 'missing-items'; await load().click(); await status('无真实已发布基线');
    baselineMode = 'array'; await load().click(); await status('已读取 3 个可用基线');
    assert.deepEqual(await field('baselineVersionId').locator('option').allTextContents(), ['请选择已发布基线', '基线 <正式> & 稳定', '业务版本基线', 'base-id']);
    assert.equal(await field('baselineVersionId').locator('正式').count(), 0);
    await field('baselineVersionId').selectOption('base-display'); assert.equal(await submit().isEnabled(), true);
    await field('baselineVersionId').selectOption(''); assert.equal(await submit().isDisabled(), true);
    await field('baselineVersionId').selectOption('base-display');
    await field('handbookId').selectOption('isolated-h2'); await status('手册或业务版本已变更');
    assert.equal(await field('baselineVersionId').inputValue(), '');
    assert.equal(await field('baselineVersionId').isDisabled(), true);
    assert.equal(await submit().isDisabled(), true);
    baselineMode = 'items'; await load().click(); await status('已读取 3 个可用基线');
    await field('baselineVersionId').selectOption('base-display');
    await field('businessVersion').fill('23.5'); await field('businessVersion').blur();
    await status('手册或业务版本已变更'); assert.equal(await submit().isDisabled(), true);
    await dialog().locator('[data-incremental-dialog-close]').last().click();
    await dialog().waitFor({ state: 'hidden' });
    await page.locator('[data-incremental-create-open]').click();
    await field('handbookId').selectOption('isolated-h1');
    await field('businessVersion').fill(' 23.4 '); await field('businessVersion').blur();
    await load().click(); await status('已读取 3 个可用基线');
    await field('baselineVersionId').selectOption('base-display');
    await submit().click();
    assert.equal(await field('name').evaluate(el => el.validity.valueMissing), true);
    assert.equal(requests.filter(r => r.method === 'POST').length, 0);
    await field('name').fill(' 隔离增量任务 '); await submit().click();
    await page.waitForFunction(() => document.querySelector('.incremental-form-status')?.textContent.includes('隔离增量服务不可用'));
    assert.equal(await submit().isEnabled(), true);
    assert.equal(await field('name').inputValue(), ' 隔离增量任务 ');
    assert.equal(await field('baselineVersionId').inputValue(), 'base-display');
    createFails = false; await submit().click();
    await page.waitForURL(url => url.searchParams.get('taskId') === task.id && url.searchParams.get('stage') === 'setup');
    await page.waitForFunction(() => !document.querySelector('[data-incremental-create-dialog]')?.open);
    await page.waitForFunction(() => document.querySelector('.incremental-main')?.textContent.includes('隔离增量任务'));
    const writes = requests.filter(r => r.method === 'POST');
    assert.equal(writes.length, 2);
    for (const r of writes) assert.deepEqual(r.body, { name: '隔离增量任务', handbookId: 'isolated-h1', businessVersion: '23.4', baselineVersionId: 'base-display' });
    assert.ok(writes[0].key); assert.equal(writes[0].key, writes[1].key);
    assert.ok(requests.some(r => r.path.endsWith('/isolated-incremental-create') && r.method === 'GET'));
    assert.ok(requests.filter(r => r.path.endsWith('/baselines')).every(r => r.query.handbookId && ['23.4', '23.5'].includes(r.query.businessVersion)));
    return 13;
  } finally {
    for (const pattern of patterns) await page.unroute(pattern, handler);
    await new Promise(resolve => backend.close(resolve));
  }
}
module.exports = { exerciseIncrementalCreateHttp };
