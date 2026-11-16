const assert = require('node:assert/strict');
const { createServer } = require('node:http');

// Caller supplies and closes a dedicated authenticated browser page.
async function exercisePermissionRolesHttp(page) {
  const requests = [];
  let failSave = true;
  const users = [
    { id: 'cas-editor', displayName: '编辑甲', loginName: 'editor-a', identitySource: 'cas', rolesEditable: true, roles: ['KNOWLEDGE_EDITOR'], rowVersion: 4, enabled: true, status: 'active' },
    { id: 'local-reader', displayName: '本地乙', loginName: 'reader-b', identitySource: 'local', rolesEditable: false, roles: ['REVIEWER'], rowVersion: 1, enabled: false, status: 'inactive' },
    { id: 'stale-editor', displayName: '旧版丙', loginName: 'editor-c', identitySource: 'cas', rolesEditable: true, roles: [], rowVersion: null, enabled: true, status: 'active' },
  ];
  const backend = createServer(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const url = new URL(request.url, 'http://localhost');
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    requests.push({ method: request.method, path: url.pathname, query: Object.fromEntries(url.searchParams), headers: request.headers, body });
    let status = 200, data = { items: [], users: [] };
    if (request.method === 'PATCH' && url.pathname.endsWith('/roles')) {
      if (failSave) status = 503;
      else {
        const user = users.find(item => item.id === decodeURIComponent(url.pathname.split('/').at(-2)));
        Object.assign(user, { roles: body.roles, rowVersion: user.rowVersion + 1 });
        data = user;
      }
    } else if (url.pathname.endsWith('/auth/users')) {
      const term = (url.searchParams.get('q') || '').toLowerCase();
      const role = url.searchParams.get('role'), state = url.searchParams.get('status');
      const filtered = users.filter(user => (!term || `${user.id} ${user.loginName} ${user.displayName}`.toLowerCase().includes(term))
        && (!role || user.roles.includes(role)) && (!state || (state === 'inactive' ? !user.enabled : user.enabled)));
      data = { users: filtered, roles: ['KNOWLEDGE_EDITOR', 'REVIEWER'] };
    } else if (url.pathname.endsWith('/oauth/status')) data = { connected: false };
    else if (url.pathname.endsWith('/oauth/config')) data = { configured: false };
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(status === 200 ? { success: true, data }
      : { success: false, error: { code: 'ISOLATED_PERMISSION_FAILURE', message: '隔离权限服务不可用' } }));
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const pattern = '**/knowledge-center/api/**';
  const handler = async route => {
    const url = new URL(route.request().url()); url.hostname = '127.0.0.1'; url.port = String(backend.address().port);
    await route.fulfill({ response: await route.fetch({ url: url.href }) });
  };
  await page.route(pattern, handler);
  const statusText = text => page.waitForFunction(text => document.querySelector('.permission-save-status')?.textContent === text, text);
  const selectUser = async id => {
    await page.locator(`[data-permission-user="${id}"]`).click();
    await page.locator(`[data-permission-role-form][data-permission-user-id="${id}"]`).waitFor({ state: 'visible' });
  };
  try {
    await page.locator('[data-view="platform"]').first().click();
    await page.locator('[data-platform-tab="permissions"]').click();
    await page.locator('[data-permission-user="cas-editor"]').waitFor({ state: 'visible' });
    await selectUser('cas-editor');
    const form = () => page.locator('[data-permission-role-form]');
    await form().locator('[name=roles][value=REVIEWER]').check();
    await form().locator('[type=submit]').click();
    await statusText('隔离权限服务不可用');
    assert.equal(await form().locator('[name=roles][value=REVIEWER]').isChecked(), true);
    assert.equal(await form().locator('[name=roles][value=KNOWLEDGE_EDITOR]').isChecked(), true);
    assert.equal(await form().locator('[type=submit]').isEnabled(), true);
    failSave = false;
    await form().locator('[type=submit]').click();
    await statusText('权限已保存');
    assert.equal(await form().locator('[name=roles][value=REVIEWER]').isChecked(), true);
    await selectUser('local-reader');
    await statusText('');
    assert.equal(await form().locator('[type=submit]').isDisabled(), true);
    for (const checkbox of await form().locator('[name=roles]').all()) assert.equal(await checkbox.isDisabled(), true);
    await selectUser('stale-editor');
    const writesBeforeStale = requests.filter(item => item.method === 'PATCH').length;
    await form().locator('[type=submit]').click();
    await statusText('用户权限数据已过期，请刷新后重试');
    assert.equal(requests.filter(item => item.method === 'PATCH').length, writesBeforeStale);
    await page.locator('[data-permission-status]').selectOption('inactive');
    await page.waitForFunction(() => document.querySelectorAll('[data-permission-user]').length === 1 && document.querySelector('[data-permission-user="local-reader"]'));
    await page.locator('[data-permission-status]').selectOption('');
    await page.locator('[data-permission-user="cas-editor"]').waitFor({ state: 'visible' });
    await page.locator('[data-permission-role]').selectOption('REVIEWER');
    await page.waitForFunction(() => document.querySelectorAll('[data-permission-user]').length === 2);
    await page.locator('[data-permission-role]').selectOption('');
    await page.locator('[data-permission-user="stale-editor"]').waitFor({ state: 'visible' });
    await page.locator('[data-permission-search]').fill('编辑甲');
    await page.waitForFunction(() => document.querySelectorAll('[data-permission-user]').length === 1 && document.querySelector('[data-permission-user="cas-editor"]'));
    await page.locator('[data-permission-search]').fill('不存在的账号');
    await page.waitForFunction(() => document.querySelector('#platform-panel-permissions')?.textContent.includes('暂无可配置用户'));
    const writes = requests.filter(item => item.method === 'PATCH');
    assert.equal(writes.length, 2);
    for (const request of writes) {
      assert.equal(request.path, '/knowledge-center/api/auth/users/cas-editor/roles');
      assert.equal(request.headers['if-match'], '4');
      assert.match(request.headers['idempotency-key'], /^permission-cas-editor-/);
      assert.deepEqual(request.body, { roles: ['KNOWLEDGE_EDITOR', 'REVIEWER'] });
    }
    const reads = requests.filter(item => item.path.endsWith('/auth/users'));
    assert.ok(reads.some(item => item.query.status === 'inactive'));
    assert.ok(reads.some(item => item.query.role === 'REVIEWER'));
    assert.ok(reads.some(item => item.query.q === '编辑甲'));
    assert.ok(reads.some(item => item.query.q === '不存在的账号'));
    return 8;
  } finally {
    await page.unroute(pattern, handler);
    await new Promise(resolve => backend.close(resolve));
  }
}
module.exports = { exercisePermissionRolesHttp };
