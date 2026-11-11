const assert = require('node:assert/strict');
const { createServer } = require('node:http');

async function exerciseAssetManagementHttp(page) {
  const requests = [];
  let fail = 'create';
  const people = [{ principalId: 101, displayName: '资产负责人甲', state: 'ACTIVE' }, { principalId: 102, displayName: '资产负责人乙', state: 'ACTIVE' }];
  const items = [];
  const base = '/knowledge-center/api/assets/handbooks';
  const mappingBase = '/knowledge-center/api/gitlab';
  const mapping = { connectionId: 'asset-connection', defaultBranch: 'main', enabledBranches: ['main'], zhPaths: ['docs/zh'], enPaths: ['docs/en'] };
  const backend = createServer(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const url = new URL(request.url, 'http://localhost');
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    requests.push({ method: request.method, path: url.pathname, body });
    let status = 200, data = { items: [] };
    if (request.method === 'POST' && url.pathname === base) {
      if (fail === 'create') status = 503;
      else {
        data = { ...body, handbookId: 'ASSET-HTTP', status: 'asset_created', assetVersion: 1, repositoryMapped: false, chapterCount: 0, documentCount: 0 };
        items.push(data);
      }
    } else if (request.method === 'PATCH') {
      if (fail === 'edit') status = 503;
      else { data = items[0]; Object.assign(data, body, { assetVersion: data.assetVersion + 1 }); }
    } else if (url.pathname === `${base}/ASSET-HTTP/status`) {
      data = items[0]; Object.assign(data, { status: body.targetStatus, assetVersion: data.assetVersion + 1 });
    } else if (url.pathname === `${base}/ASSET-HTTP/archive`) {
      if (fail === 'archive') status = 503;
      else { data = items[0]; Object.assign(data, { archived: true, assetVersion: data.assetVersion + 1 }); }
    } else if (url.pathname === `${mappingBase}/mappings/ASSET-HTTP`) {
      data = mapping;
    } else if (url.pathname === `${mappingBase}/connections/asset-connection/branches`) {
      data = [{ name: 'main', protected: false }, { name: 'release', protected: false }];
    } else if (url.pathname === `${mappingBase}/connections/asset-connection/tree`) {
      data = [{ path: 'docs/zh', type: 'tree', name: 'zh' }, { path: 'docs/en', type: 'tree', name: 'en' }];
    } else if (url.pathname === `${mappingBase}/connections`) {
      data = { items: [{ id: 'asset-connection', name: '隔离资产仓库', state: 'active' }] };
    } else if (url.pathname === base) {
      data = { items: items.filter(item => Boolean(item.archived) === (url.searchParams.get('lifecycle') === 'inactive')), products: [{ id: 'YDB', name: '崖山数据库' }], total: items.length, page: 1, pageSize: 20, statistics: {} };
    } else if (url.pathname.endsWith('/platform/principals')) data = { items: people };
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(status === 200 ? { success: true, data } : { success: false, error: { message: '隔离资产服务不可用' } }));
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const pattern = '**/knowledge-center/api/**';
  const handler = async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith(base) && !url.pathname.endsWith('/platform/principals') && !url.pathname.startsWith(mappingBase)) return route.fallback();
    url.hostname = '127.0.0.1'; url.port = String(backend.address().port);
    await route.fulfill({ response: await route.fetch({ url: url.href }) });
  };
  await page.route(pattern, handler);
  const waitText = (selector, text) => page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent.includes(text), { selector, text });
  try {
    await page.locator('[data-view="assets"]').first().click();
    await page.locator('.asset-workspace[data-asset-loaded="true"]').waitFor({ state: 'visible' });
    await page.locator('[data-asset-create-open]').click();
    let form = page.locator('[data-asset-create-form]');
    await form.locator('[name=name]').fill(' HTTP手册 ');
    await form.locator('[name=productId]').selectOption('YDB');
    await form.locator('[name=ownerA]').selectOption('101');
    await form.locator('[name=ownerB]').selectOption('102');
    await form.locator('[name=externalVisible]').check();
    await form.locator('.asset-summary-disclosure summary').click();
    await form.locator('[name=summary]').fill(' 隔离HTTP资产验收 ');
    await form.locator('[type=submit]').click();
    await waitText('[data-asset-create-form] [data-asset-form-status]', '隔离资产服务不可用');
    assert.equal(await form.locator('[name=name]').inputValue(), ' HTTP手册 ');
    assert.equal(await form.locator('[type=submit]').isEnabled(), true);
    fail = ''; await form.locator('[type=submit]').click();
    await page.locator('[data-asset-create-dialog]').waitFor({ state: 'hidden' });
    await page.locator('[data-repository-mapping-open="ASSET-HTTP"]').click();
    const mappingForm = page.locator('[data-repository-mapping-form]');
    await page.waitForFunction(() => document.querySelector('[data-repository-mapping-form] [name="defaultBranch"]')?.value === 'main');
    assert.equal(await mappingForm.locator('[name=connectionId]').inputValue(), mapping.connectionId);
    assert.equal(await mappingForm.locator('[name=defaultBranch]').inputValue(), mapping.defaultBranch);
    assert.match(await mappingForm.locator('[data-mapping-zh-tags]').textContent(), /docs\/zh/);
    assert.match(await mappingForm.locator('[data-mapping-en-tags]').textContent(), /docs\/en/);
    await page.waitForFunction(() => document.querySelector('[data-mapping-path-browser]')?.textContent.includes('zh'));
    assert.deepEqual(requests.filter(item => item.method === 'GET' && item.path.startsWith(mappingBase)).slice(-3).map(item => item.path), [
      `${mappingBase}/mappings/ASSET-HTTP`,
      `${mappingBase}/connections/asset-connection/branches`,
      `${mappingBase}/connections/asset-connection/tree`,
    ]);
    await page.locator('[data-repository-mapping-dialog] [data-asset-dialog-close]').first().click();
    await page.locator('[data-asset-edit-open="ASSET-HTTP"]').click();
    form = page.locator('[data-asset-edit-form]');
    await form.locator('[name=name]').fill(' 已修改手册 ');
    fail = 'edit'; await form.locator('[type=submit]').click();
    await waitText('[data-asset-edit-form] [data-asset-form-status]', '隔离资产服务不可用');
    assert.equal(await form.locator('[type=submit]').isEnabled(), true);
    assert.equal(await form.locator('[name=name]').inputValue(), ' 已修改手册 ');
    fail = ''; await form.locator('[type=submit]').click();
    await page.locator('[data-asset-edit-dialog]').waitFor({ state: 'hidden' });
    await page.locator('[data-asset-edit-open="ASSET-HTTP"]').click();
    form = page.locator('[data-asset-edit-form]');
    await form.locator('[name=status]').selectOption('outline_editing');
    const writeCount = requests.filter(item => item.method !== 'GET').length;
    await form.locator('[type=submit]').click();
    await waitText('[data-asset-edit-form] [data-asset-form-status]', '修改手册状态时必须填写变更原因');
    assert.equal(requests.filter(item => item.method !== 'GET').length, writeCount);
    await form.locator('[name=statusReason]').fill(' 开始完善大纲 ');
    await form.locator('[type=submit]').click();
    await page.locator('[data-asset-edit-dialog]').waitFor({ state: 'hidden' });
    await page.locator('[data-asset-edit-open="ASSET-HTTP"]').click();
    form = page.locator('[data-asset-edit-form]');
    await form.locator('[data-asset-advanced-actions] summary').click();
    await form.locator('[data-asset-archive-open]').click();
    const archive = page.locator('[data-asset-archive-confirm-form]');
    fail = 'archive'; await archive.locator('[type=submit]').click();
    await waitText('[data-asset-archive-status]', '隔离资产服务不可用');
    assert.equal(await archive.locator('[type=submit]').isEnabled(), true);
    for (const cancel of await archive.locator('[data-asset-archive-cancel]').all()) assert.equal(await cancel.isEnabled(), true);
    assert.equal(await archive.getAttribute('data-busy'), null);
    assert.equal(await archive.locator('[type=submit]').evaluate(el => el === document.activeElement), true);
    fail = ''; await archive.locator('[type=submit]').click();
    await page.locator('[data-asset-archive-dialog]').waitFor({ state: 'hidden' });
    await page.getByText('手册已从在用资产和阶段统计中隐藏，历史关系继续保留。', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await page.locator('#notice-action').getAttribute('href'), '/knowledge-center/assets?lifecycle=inactive');
    await page.locator('[data-asset-more-menu] summary').click();
    await page.locator('[data-asset-lifecycle=inactive]').click();
    await page.locator('[data-asset-id="ASSET-HTTP"]').waitFor({ state: 'visible' });
    const writes = requests.filter(item => item.method !== 'GET');
    assert.deepEqual(writes.map(item => item.method), ['POST', 'POST', 'PATCH', 'PATCH', 'PATCH', 'POST', 'POST', 'POST']);
    assert.deepEqual(writes[0].body, { name: 'HTTP手册', productId: 'YDB', ownerA: { principalId: 101, userId: 101, displayName: '资产负责人甲' }, ownerB: { principalId: 102, userId: 102, displayName: '资产负责人乙' }, externalVisible: true, summary: '隔离HTTP资产验收' });
    assert.deepEqual(writes[1].body, writes[0].body);
    assert.equal(writes[2].body.expectedVersion, 1);
    assert.equal(writes[3].body.expectedVersion, 1);
    assert.equal(writes[4].body.expectedVersion, 2);
    assert.deepEqual(writes[5], { method: 'POST', path: `${base}/ASSET-HTTP/status`, body: { targetStatus: 'outline_editing', reason: '开始完善大纲', expectedVersion: 3 } });
    assert.equal(writes[6].path, `${base}/ASSET-HTTP/archive`);
    assert.equal(writes[7].path, writes[6].path);
    return 9;
  } finally {
    await page.unroute(pattern, handler);
    await new Promise(resolve => backend.close(resolve));
  }
}
module.exports = { exerciseAssetManagementHttp };
