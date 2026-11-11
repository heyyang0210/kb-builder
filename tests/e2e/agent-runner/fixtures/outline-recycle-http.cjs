const assert = require('node:assert/strict');
const { createServer } = require('node:http');

// Exercise existing visible controls against an isolated HTTP backend.
async function exerciseOutlineRecycleHttp(page) {
  const requests = [];
  let failList = true, failRestore = true, failPreflight = true, failPurge = true;
  let impact = { references: 2, canPurge: false };
  let items = [
    { id: 'outline_restore_case', name: '待恢复测试大纲', deletedAt: '2026-11-10T00:00:00Z', status: 'draft' },
    { id: 'outline_purge_case', name: '待删除测试大纲', deletedAt: '2026-11-10T00:00:00Z', status: 'draft' },
  ];
  const backend = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const url = new URL(req.url, 'http://localhost');
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    requests.push({ method: req.method, path: url.pathname, body });
    let status = 200, data;
    if (url.pathname.endsWith('/recycle')) { if (failList) status = 503; else data = items; }
    else if (url.pathname.endsWith('/restore')) {
      if (failRestore) status = 503;
      else { items = items.filter(item => item.id !== 'outline_restore_case'); data = { restored: true }; }
    } else if (url.pathname.endsWith('/purge-preflight')) {
      if (failPreflight) status = 503; else data = impact;
    } else if (url.pathname.endsWith('/purge')) {
      if (failPurge) status = 503;
      else { items = items.filter(item => item.id !== 'outline_purge_case'); data = { purged: true }; }
    } else { status = 404; }
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status === 200 ? { success: true, data }
      : { success: false, error: { code: 'ISOLATED_OUTLINE_FAILURE', message: '隔离大纲服务不可用' } }));
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const pattern = '**/knowledge-center/api/outline/governance/**';
  const handler = async route => {
    const url = new URL(route.request().url()); url.hostname = '127.0.0.1'; url.port = String(backend.address().port);
    await route.fulfill({ response: await route.fetch({ url: url.href }) });
  };
  await page.route(pattern, handler);
  const dialog = () => page.locator('[data-outline-purge-dialog]');
  const purge = () => page.locator('[data-outline-purge="outline_purge_case"]');
  const errorText = text => page.waitForFunction(text => document.querySelector('[data-outline-purge-error]')?.textContent.includes(text), text);
  const notice = text => page.waitForFunction(text => document.querySelector('#error-message')?.textContent.includes(text), text);
  try {
    await page.locator('[data-view="outlines"]').first().click();
    await page.locator('[data-outline-subpage="recycle"]').click();
    await page.locator('[data-outline-recycle-retry]').waitFor({ state: 'visible' });
    failList = false;
    await page.locator('[data-outline-recycle-retry]').click();
    await purge().waitFor({ state: 'visible' });

    const restore = () => page.locator('[data-outline-restore="outline_restore_case"]');
    await restore().click();
    await notice('大纲服务暂时不可用');
    assert.equal(await restore().isEnabled(), true);
    failRestore = false;
    await restore().click();
    await restore().waitFor({ state: 'detached' });
    await notice('大纲已恢复');

    await purge().click();
    await notice('隔离大纲服务不可用');
    assert.equal(await purge().isEnabled(), true);
    assert.equal(await dialog().isVisible(), false);
    failPreflight = false;
    await purge().click();
    await dialog().waitFor({ state: 'visible' });
    await errorText('2 项历史或下游引用');
    assert.equal(await dialog().locator('[data-outline-purge-confirm]').isDisabled(), true);
    await dialog().locator('[data-outline-purge-cancel]').click();
    await dialog().waitFor({ state: 'hidden' });

    impact = { references: 0, canPurge: false };
    await purge().click();
    await dialog().waitFor({ state: 'visible' });
    await errorText('不满足彻底删除条件');
    assert.equal(await dialog().locator('[data-outline-purge-confirm]').isDisabled(), true);
    await dialog().locator('[data-outline-purge-cancel]').click();
    impact = { references: 0, canPurge: true };
    await purge().click();
    await dialog().waitFor({ state: 'visible' });
    const confirm = () => dialog().locator('[data-outline-purge-confirm]');
    const writesBefore = requests.filter(r => r.path.endsWith('/purge')).length;
    await confirm().click();
    assert.equal(await dialog().locator('[name=confirmId]').evaluate(el => el.validity.valueMissing), true);
    await dialog().locator('[name=confirmId]').fill('错误的大纲ID');
    await dialog().locator('[name=reason]').fill('删除测试夹具');
    await confirm().click();
    await errorText('请准确输入目标 ID');
    await dialog().locator('[data-outline-purge-fill-id]').click();
    assert.equal(await dialog().locator('[name=confirmId]').inputValue(), 'outline_purge_case');
    assert.equal(await dialog().locator('[name=confirmId]').evaluate(el => el === document.activeElement), true);
    await dialog().locator('[name=reason]').fill('   ');
    await confirm().click();
    await errorText('请准确输入目标 ID 并填写删除原因');
    assert.equal(requests.filter(r => r.path.endsWith('/purge')).length, writesBefore);
    await dialog().locator('[name=reason]').fill('删除隔离测试夹具');
    await confirm().click();
    await errorText('大纲服务暂时不可用');
    assert.equal(await confirm().isEnabled(), true);
    assert.equal(await dialog().locator('[name=reason]').inputValue(), '删除隔离测试夹具');
    failPurge = false;
    await confirm().click();
    await purge().waitFor({ state: 'detached' });
    await notice('大纲已彻底删除');
    assert.ok((await page.locator('.outline-recycle').innerText()).includes('回收站为空'));
    const writes = requests.filter(r => r.path.endsWith('/purge'));
    assert.equal(writes.length, 2);
    for (const r of writes) assert.deepEqual(r, { method: 'POST', path: '/knowledge-center/api/outline/governance/outline_purge_case/purge', body: { confirmId: 'outline_purge_case', reason: '删除隔离测试夹具' } });
    assert.equal(requests.filter(r => r.path.endsWith('/restore')).length, 2);
    return 12;
  } finally {
    await page.unroute(pattern, handler);
    await new Promise(resolve => backend.close(resolve));
  }
}
module.exports = { exerciseOutlineRecycleHttp };
