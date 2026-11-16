const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const XLSX = require('xlsx');

async function exercisePrincipalImportHttp(page) {
  const special = '<img src=x onerror="window.__unsafeImport=true">';
  const spreadsheet = extraRows => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['姓名', 'CAS登录名', '状态'], ['张三', 'zhangsan', 'ACTIVE'], ['李四', 'lisi', 'ACTIVE'], ['王五', '', 'ACTIVE'], ...extraRows,
    ]), '人员');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  };
  const bytes = spreadsheet([[special, 'duplicate', 'ACTIVE']]);
  const correctedBytes = spreadsheet([]);
  const requests = [];
  let mode = 'preview-failure';
  const backend = createServer(async (request, response) => {
    const chunks = []; for await (const part of request) chunks.push(part);
    const url = new URL(request.url, 'http://localhost');
    const body = Buffer.concat(chunks);
    requests.push({ path: url.pathname, query: url.searchParams.get('mode'), method: request.method, headers: request.headers, body });
    let status = 200;
    let data = { items: [], users: [], connected: false, configured: false };
    if (url.pathname.endsWith('/principals/import')) {
      if (mode === 'preview-failure' || mode === 'apply-failure') status = 503;
      else if (url.searchParams.get('mode') === 'apply') data = { importSummary: { add: 1, update: 1 } };
      else data = {
        summary: { add: 1, update: 1, unchanged: 1, conflict: mode === 'conflict' ? 1 : 0 },
        rows: [
          { rowNumber: 2, displayName: '张三', casLoginName: 'zhangsan', action: 'ADD', message: '新增人员' },
          { rowNumber: 3, displayName: '李四', casLoginName: 'lisi', action: 'UPDATE', message: '更新绑定' },
          { rowNumber: 4, displayName: '王五', casLoginName: null, action: 'UNCHANGED', message: '无变化' },
          ...(mode === 'conflict' ? [{ rowNumber: 5, displayName: special, casLoginName: 'duplicate', action: 'CONFLICT', message: '重复 <账号> & 姓名' }] : []),
        ],
      };
    }
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(status === 200 ? { success: true, data }
      : { success: false, error: { code: 'ISOLATED_IMPORT_FAILURE', message: '隔离人员导入服务不可用' } }));
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const pattern = '**/knowledge-center/api/**';
  const handler = async route => {
    const url = new URL(route.request().url()); url.hostname = '127.0.0.1'; url.port = String(backend.address().port);
    await route.fulfill({ response: await route.fetch({ url: url.href }) });
  };
  await page.route(pattern, handler);
  try {
    await page.evaluate(async () => {
      const { appState } = await import('/knowledge-center/common/state/app-state.js');
      const { renderPrincipalsTab } = await import('/knowledge-center/modules/platform-admin/view.js');
      const keys = ['activeView', 'principalProjection', 'teamGroupProjection', 'gitlabProjection', 'permissionProjection', 'selectedPermissionUserId', 'platformGovernance'];
      const previous = Object.fromEntries(keys.map(key => [key, appState[key]]));
      const host = document.createElement('section'); host.dataset.coveragePrincipalImport = '';
      host.innerHTML = renderPrincipalsTab({ status: 'ok', items: [] }, {}, { status: 'ok', items: [] });
      document.body.prepend(host); appState.activeView = 'dashboard';
      window.__principalImportCleanup = () => {
        host.querySelector('dialog[open]')?.close(); host.remove(); Object.assign(appState, previous);
        delete window.__principalImportCleanup; delete window.__unsafeImport;
      };
    });
    const host = page.locator('[data-coverage-principal-import]');
    const dialog = host.locator('[data-principal-import-dialog]');
    const status = dialog.locator('[data-principal-import-status]');
    const preview = dialog.locator('[data-principal-import-preview]');
    const apply = dialog.locator('[data-principal-import-apply]');
    const file = dialog.locator('[name=file]');
    const submit = dialog.locator('[type=submit]');
    await host.locator('[data-principal-open-import]').click();
    assert.equal(await dialog.evaluate(node => node.open), true);
    await dialog.locator('[data-principal-dialog-close]').last().click();
    assert.equal(await dialog.evaluate(node => node.open), false);
    await host.locator('[data-principal-open-import]').click();
    await file.setInputFiles({ name: '人员.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: bytes });
    const waitStatus = expected => page.waitForFunction(expected => document.querySelector('[data-coverage-principal-import] [data-principal-import-status]').textContent === expected, expected);
    await submit.click(); await waitStatus('隔离人员导入服务不可用');
    assert.equal(await submit.isEnabled(), true);
    assert.equal(await file.evaluate(node => node.files[0].name), '人员.xlsx');
    mode = 'conflict';
    await submit.click(); await waitStatus('发现 1 条冲突，请修正后重新预检。');
    assert.equal(await apply.isVisible(), false);
    assert.equal(await preview.locator('tbody tr').count(), 4);
    assert.equal(await preview.locator('.principal-import-conflict td').nth(1).textContent(), special);
    assert.equal(await preview.locator('img').count(), 0);
    assert.equal(await preview.locator('.principal-import-conflict td').nth(4).textContent(), '重复 <账号> & 姓名');
    assert.equal(await page.evaluate(() => window.__unsafeImport), undefined);
    mode = 'valid';
    await file.setInputFiles({ name: '人员.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: correctedBytes });
    await submit.click(); await waitStatus('预检通过，请确认导入。');
    assert.equal(await apply.isVisible(), true);
    assert.equal(await preview.locator('tbody tr').count(), 3);
    assert.equal(await preview.locator('tbody tr').nth(2).locator('td').nth(2).textContent(), '—');
    mode = 'apply-failure';
    await apply.click(); await waitStatus('隔离人员导入服务不可用');
    assert.equal(await apply.isEnabled(), true);
    assert.equal(await preview.isVisible(), true);
    mode = 'success';
    await apply.click(); await waitStatus('导入完成：新增 1 人，更新 1 人。');
    await page.waitForFunction(() => !document.querySelector('[data-coverage-principal-import] dialog[data-principal-import-dialog]').open);
    const imports = requests.filter(request => request.path.endsWith('/principals/import'));
    assert.deepEqual(imports.map(request => request.query), ['preview', 'preview', 'preview', 'apply', 'apply']);
    for (const [index, request] of imports.entries()) {
      assert.equal(request.method, 'POST');
      assert.match(request.headers['content-type'], /^multipart\/form-data; boundary=/);
      assert.equal(request.body.includes(index < 2 ? bytes : correctedBytes), true);
      assert.equal(request.body.includes(Buffer.from('filename="人员.xlsx"')), true);
      assert.equal(request.body.includes(Buffer.from('name="file"')), true);
      assert.equal(request.body.includes(Buffer.from('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')), true);
    }
    const reads = requests.filter(request => request.method === 'GET').map(request => request.path).sort();
    const optionalTemplateRead = '/knowledge-center/api/templates/mappings';
    assert.ok(reads.filter(path => path === optionalTemplateRead).length <= 1);
    assert.deepEqual(reads.filter(path => path !== optionalTemplateRead), [
      '/knowledge-center/api/auth/users', '/knowledge-center/api/gitlab/connections',
      '/knowledge-center/api/gitlab/oauth/config', '/knowledge-center/api/gitlab/oauth/status',
      '/knowledge-center/api/gitlab/version-mappings', '/knowledge-center/api/platform/principals',
      '/knowledge-center/api/platform/team-groups',
    ].sort());
    // Opening a fresh import discards the previous preview and its pending file.
    await host.locator('[data-principal-open-import]').click();
    assert.equal(await file.evaluate(node => node.files.length), 0);
    assert.equal(await preview.isVisible(), false);
    assert.equal(await apply.isVisible(), false);
    return 6;
  } finally {
    await page.evaluate(() => window.__principalImportCleanup?.());
    await page.unroute(pattern, handler);
    await new Promise(resolve => backend.close(resolve));
  }
}
module.exports = { exercisePrincipalImportHttp };
