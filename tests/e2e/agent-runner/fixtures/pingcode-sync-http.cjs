const assert = require('node:assert/strict');
const { createServer } = require('node:http');

async function exercisePingcodeSyncHttp(page) {
  const base = '/knowledge-center/api/platform/plugins/pingcode';
  const sourceUrl = 'https://pingcode.example.test/ship/products/YASHAN/baselines/fixture/ideas';
  const requests = [];
  const sources = [];
  let run = null, reads = 0, retried = false, stateChangeFailure = true;
  let sourceReadFailure = true, sourceCreateFailure = true;
  const backend = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const url = new URL(request.url, 'http://localhost');
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    requests.push({ method: request.method, path: url.pathname, query: Object.fromEntries(url.searchParams), headers: request.headers, body });
    let status = 200, data = null;
    if (request.method === 'GET' && url.pathname === `${base}/sources`) {
      if (sourceReadFailure) { sourceReadFailure = false; status = 503; }
      else data = sources;
    }
    else if (request.method === 'POST' && url.pathname === `${base}/sources`) {
      if (sourceCreateFailure) { sourceCreateFailure = false; status = 503; }
      else {
        data = { ...body, id: 'fixture-source', state: 'ACTIVE', revision: 1 };
        sources.push(data);
        sources.push({ id: 'fixture-secondary', name: '停用工单', type: 'TICKET', productType: 'YCM',
          url: 'https://pingcode.example.test/pjm/projects/YCM/defect', state: 'INACTIVE', revision: 4, deletable: true });
        status = 201;
      }
    } else if (request.method === 'PATCH' && url.pathname === `${base}/sources/fixture-source/state`) {
      if (stateChangeFailure) { stateChangeFailure = false; status = 503; }
      else {
        const index = sources.findIndex(item => item.id === 'fixture-source');
        data = { ...sources[index], state: body.state, revision: sources[index].revision + 1 };
        sources[index] = data;
      }
    } else if (url.pathname === `${base}/sources/fixture-source`) data = sources[0];
    else if (url.pathname === `${base}/sources/fixture-source/items`) data = { total: 0, items: [] };
    else if (url.pathname === `${base}/sources/fixture-source/runs` && request.method === 'GET') data = run ? [run] : [];
    else if (url.pathname === `${base}/sources/fixture-source/runs` && request.method === 'POST') {
      run = { id: 'fixture-run', status: 'COLLECTING', sourceId: 'fixture-source', rowsRead: 0, createdAt: '2026-01-01T00:00:00Z' };
      data = run;
    } else if (url.pathname === `${base}/runs/fixture-run` && request.method === 'GET') {
      if (++reads >= 2 && run.status === 'COLLECTING') run = { ...run, status: 'AWAITING_CONFIRM', rowsRead: 2, newCount: 1, digest: 'a'.repeat(64) };
      data = run;
    } else if (url.pathname === `${base}/runs/fixture-run/items`) data = { total: 1, items: [{ number: 'YDBRD-1', title: '隔离任务', ir: ['IR-1'] }] };
    else if (url.pathname === `${base}/runs/fixture-run/preview`) data = {
      run, total: url.searchParams.get('view') === 'removed' ? 0 : 1,
      items: url.searchParams.get('view') === 'removed' ? [] : [{ number: 'YDBRD-1', title: '隔离任务', action: 'created', ir: ['IR-1'],
        sources: [{ id: 'fixture-source', name: '隔离需求' }, { id: 'other-source', name: '另一来源' }] }],
    };
    else if (url.pathname === `${base}/runs/fixture-run/confirm`) {
      run = { ...run, status: 'CONFIRMED_MISSING_IMAGES' };
      data = run;
    } else if (url.pathname === `${base}/runs/fixture-run/resources`) data = {
      total: retried ? 0 : 1, items: retried ? [] : [{ number: 'YDBRD-1', errorCode: 'PINGCODE_IMAGE_UNAVAILABLE' }],
      retry: retried ? { state: 'completed', attempted: 1, repaired: 1, failed: 0 } : null,
    };
    else if (url.pathname === `${base}/runs/fixture-run/resources/retry`) {
      retried = true;
      run = { ...run, status: 'CONFIRMED' };
      data = { state: 'running', attempted: 0, repaired: 0, failed: 0 };
    } else status = 404;
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(status < 400 ? { success: true, data } : { success: false, error: { message: '隔离来源服务不可用' } }));
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const pattern = '**/knowledge-center/api/platform/plugins/pingcode/**';
  const handler = async route => {
    const url = new URL(route.request().url());
    url.hostname = '127.0.0.1';
    url.port = String(backend.address().port);
    await route.fulfill({ response: await route.fetch({ url: url.href }) });
  };
  await page.route(pattern, handler);
  try {
    await page.locator('[data-view="platform"]').first().click();
    await page.locator('[data-platform-tab="plugins"]').click();
    await page.locator('[data-pingcode-sync][data-mounted]').waitFor({ state: 'visible' });
    await page.getByText('暂时无法读取来源').waitFor();
    await page.locator('.pingcode-source-error [data-pc-refresh]').click();
    await page.getByText('尚未添加 Pingcode 来源').waitFor();
    await page.locator('[data-pc-add]').click();
    const form = page.locator('[data-pc-form]');
    await form.locator('[name=name]').fill('隔离需求');
    await form.locator('[name=url]').fill(sourceUrl);
    await form.locator('[type=submit]').click();
    await form.getByText('隔离来源服务不可用').waitFor();
    assert.equal(await form.locator('[name=name]').inputValue(), '隔离需求');
    assert.equal(await form.locator('[type=submit]').isEnabled(), true);
    assert.equal(sources.length, 0);
    await form.locator('[type=submit]').click();
    await page.locator('.pingcode-sync-feedback').getByText('来源已添加', { exact: true }).waitFor();
    await page.locator('[data-pc-refresh]').click();
    await page.locator('[data-pc-source="fixture-secondary"]').waitFor();
    await page.locator('[data-pc-search]').fill('停用工单');
    assert.equal(await page.locator('[data-pc-source]').count(), 1);
    await page.locator('[data-pc-search]').fill('not-found');
    await page.getByText('没有符合条件的来源', { exact: true }).waitFor();
    await page.locator('[data-pc-search]').fill('');
    await page.locator('[data-pc-type]').selectOption('TICKET');
    assert.equal(await page.locator('[data-pc-source]').count(), 1);
    await page.locator('[data-pc-product-type]').selectOption('DB');
    await page.getByText('没有符合条件的来源', { exact: true }).waitFor();
    await page.locator('[data-pc-product-type]').selectOption('YCM');
    assert.equal(await page.locator('[data-pc-source]').count(), 1);
    await page.locator('[data-pc-enabled]').selectOption('ACTIVE');
    await page.getByText('没有符合条件的来源', { exact: true }).waitFor();
    await page.locator('[data-pc-enabled]').selectOption('INACTIVE');
    assert.equal(await page.locator('[data-pc-source]').count(), 1);
    await page.locator('[data-pc-type]').selectOption('all');
    await page.locator('[data-pc-product-type]').selectOption('all');
    await page.locator('[data-pc-enabled]').selectOption('all');
    const toggle = page.locator('[data-pc-toggle-state="fixture-source"]');
    await toggle.focus();
    await page.keyboard.press('Space');
    await page.getByText('隔离来源服务不可用', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-pc-toggle-state="fixture-source"]').getAttribute('aria-checked'), 'true');
    await page.locator('[data-pc-toggle-state="fixture-source"]').focus();
    await page.keyboard.press('Space');
    await page.getByText('来源已停用', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-pc-toggle-state="fixture-source"]').getAttribute('aria-checked'), 'false');
    await page.locator('[data-pc-toggle-state="fixture-source"]').focus();
    await page.keyboard.press('Space');
    await page.getByText('来源已恢复', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-pc-toggle-state="fixture-source"]').getAttribute('aria-checked'), 'true');
    await page.locator('[data-pc-source="fixture-source"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-pc-workspace-sync]').waitFor({ state: 'visible' });
    await page.locator('[data-pc-workspace-sync]').click();
    await page.getByRole('button', { name: '查看任务变化' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: '查看任务变化' }).click();
    await page.getByRole('heading', { name: '同步任务变化' }).waitFor();
    assert.equal(await page.locator('.pingcode-diff-summary').count(), 0);
    await page.locator('[data-pc-confirm]').waitFor({ state: 'visible' });
    await page.locator('[data-pc-view="conflicts"]').click();
    await page.locator('[data-pc-primary="YDBRD-1"]').selectOption('other-source');
    await page.locator('[data-pc-confirm]').click();
    await page.getByText('已同步到任务管理', { exact: true }).waitFor();
    await page.locator('[data-pc-retry]').click();
    await page.getByText('重试完成').waitFor();
    const writes = requests.filter(item => item.method === 'POST');
    assert.equal(writes.length, 5);
    assert.ok(writes.every(item => /^[0-9a-f-]{36}$/.test(item.headers['idempotency-key'] || '')));
    assert.deepEqual(writes.find(item => item.path.endsWith('/confirm')).body, {
      digest: 'a'.repeat(64), expectedRevision: 3, primarySources: { 'YDBRD-1': 'other-source' },
    });
    assert.deepEqual(writes.find(item => item.path.endsWith('/sources')).body,
      { name: '隔离需求', type: 'REQUIREMENT', productType: 'DB', url: sourceUrl });
    assert.ok(writes.some(item => item.path.endsWith('/sources/fixture-source/runs') && item.body.revision === 3));
    assert.ok(writes.some(item => item.path.endsWith('/runs/fixture-run/resources/retry')));
    const toggles = requests.filter(item => item.method === 'PATCH' && item.path.endsWith('/state'));
    assert.equal(toggles.length, 3);
    assert.deepEqual(toggles.map(item => item.body), [
      { state: 'DISABLED', revision: 1 }, { state: 'DISABLED', revision: 1 }, { state: 'ACTIVE', revision: 2 },
    ]);
    assert.ok(requests.some(item => item.path.endsWith('/preview') && item.query.view === 'conflicts'));
    return 20;
  } finally {
    await page.unroute(pattern, handler);
    await new Promise(resolve => backend.close(resolve));
  }
}

module.exports = { exercisePingcodeSyncHttp };
