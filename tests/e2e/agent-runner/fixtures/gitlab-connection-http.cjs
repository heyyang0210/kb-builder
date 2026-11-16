const assert = require('node:assert/strict');
const { createServer } = require('node:http');

// The caller owns this dedicated authenticated page and closes it after capture.
async function exerciseGitlabConnectionHttp(page) {
  const requests = [];
  let failure = 'create', verificationFailure = false;
  const connections = [{ id: 'existing-connection', name: '原连接', baseUrl: 'https://gitlab.example.test', projectPath: 'team/docs', defaultBranch: 'main', authMode: 'service_account', purpose: 'read', rowVersion: 4, managementStatus: 'active', mode: 'production', credentialConfigured: true }];
  const backend = createServer(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const url = new URL(request.url, 'http://localhost');
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    requests.push({ method: request.method, path: url.pathname, headers: request.headers, body });
    let status = 200, data = { items: [], users: [] };
    const id = decodeURIComponent(url.pathname.split('/').at(-2));
    const connection = connections.find(item => item.id === id);
    if (request.method === 'POST' && url.pathname.endsWith('/connections')) {
      if (failure === 'create') status = 503;
      else {
        data = { ...body, id: body.authMode === 'user_oauth' ? 'oauth-connection' : 'created-connection', rowVersion: 1, managementStatus: 'active', mode: 'production', credentialConfigured: Boolean(body.credentialRef) };
        connections.push(data);
      }
    } else if (url.pathname.endsWith('/verify')) {
      if (verificationFailure) status = 503;
      else data = { connectionId: id, status: 'verified', branchCount: 3, verifiedAt: '2026-11-11T00:00:00Z' };
    } else if (request.method === 'PATCH') {
      if (failure === 'edit') status = 503;
      else {
        data = connections.find(item => item.id === decodeURIComponent(url.pathname.split('/').at(-1)));
        Object.assign(data, body, { rowVersion: data.rowVersion + 1 });
      }
    } else if (url.pathname.endsWith('/disable') || url.pathname.endsWith('/enable')) {
      const action = url.pathname.split('/').at(-1);
      if (failure === action) status = 503;
      else { connection.managementStatus = action === 'disable' ? 'disabled' : 'active'; data = connection; }
    } else if (url.pathname.endsWith('/connections')) data = { items: connections };
    else if (url.pathname.endsWith('/oauth/config')) data = { configured: false };
    else if (url.pathname.endsWith('/oauth/status')) data = { connected: false };
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(status === 200 ? { success: true, data }
      : { success: false, error: { code: 'ISOLATED_CONNECTION_FAILURE', message: '隔离仓库连接服务不可用' } }));
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const pattern = '**/knowledge-center/api/**';
  const handler = async route => {
    const url = new URL(route.request().url()); url.hostname = '127.0.0.1'; url.port = String(backend.address().port);
    await route.fulfill({ response: await route.fetch({ url: url.href }) });
  };
  await page.route(pattern, handler);
  const waitText = (selector, text) => page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent.includes(text), { selector, text });
  try {
    await page.locator('[data-view="platform"]').first().click();
    await page.locator('[data-platform-tab="gitlab"]').click();
    await page.locator('[data-gitlab-connection="existing-connection"]').waitFor({ state: 'visible' });
    await page.locator('[data-gitlab-add-connection]').click();
    await page.locator('[data-gitlab-cancel-add]').click();
    assert.equal(await page.locator('[data-gitlab-add-form]').count(), 0);
    await page.locator('[data-gitlab-add-connection]').click();
    const fillAdd = async (name, authMode) => {
      const form = page.locator('[data-gitlab-add-form]');
      await form.locator('[name=name]').fill(name);
      await form.locator('[name=baseUrl]').fill('https://gitlab.example.test');
      await form.locator('[name=projectPath]').fill(' team/new-docs ');
      await form.locator('[name=defaultBranch]').fill(' main ');
      await form.locator('[name=authMode]').selectOption(authMode);
      if (authMode === 'service_account') await form.locator('[name=credentialRef]').fill(' fixture_reference ');
      return form;
    };
    let form = await fillAdd(' 新连接 ', 'service_account');
    await form.locator('[type=submit]').click();
    await waitText('[data-gitlab-add-form] .form-status', '隔离仓库连接服务不可用');
    assert.equal(await form.locator('[type=submit]').isEnabled(), true);
    assert.equal(await form.locator('[name=name]').inputValue(), ' 新连接 ');
    failure = '';
    await form.locator('[type=submit]').click();
    await waitText('.gitlab-verification', '读取验证成功');
    assert.equal(await page.locator('[data-gitlab-add-form]').count(), 0);
    await page.locator('[data-gitlab-edit="created-connection"]').click();
    await page.locator('[data-gitlab-cancel-edit]').click();
    assert.equal(await page.locator('[data-gitlab-edit-form]').count(), 0);
    await page.locator('[data-gitlab-edit="created-connection"]').click();
    form = page.locator('[data-gitlab-edit-form]');
    await form.locator('[name=name]').fill(' 修改连接 ');
    await form.locator('[name=purpose]').selectOption('read_write');
    failure = 'edit'; await form.locator('[type=submit]').click();
    await waitText('[data-gitlab-edit-form] .form-status', '隔离仓库连接服务不可用');
    assert.equal(await form.locator('[type=submit]').isEnabled(), true);
    assert.equal(await form.locator('[name=name]').inputValue(), ' 修改连接 ');
    failure = ''; await form.locator('[type=submit]').click();
    await waitText('.gitlab-detail-header h3', '修改连接');
    const verify = page.locator('[data-gitlab-verify="created-connection"]');
    verificationFailure = true; await verify.click();
    await waitText('.gitlab-verification.failure', '隔离仓库连接服务不可用');
    assert.equal(await verify.isEnabled(), true);
    verificationFailure = false; await verify.click();
    await waitText('.gitlab-verification.success', '读取验证成功');
    const disable = page.locator('[data-gitlab-disable="created-connection"]');
    const writesBeforeCancel = requests.filter(item => item.method !== 'GET').length;
    page.once('dialog', dialog => dialog.dismiss()); await disable.click();
    assert.equal(requests.filter(item => item.method !== 'GET').length, writesBeforeCancel);
    failure = 'disable'; page.once('dialog', dialog => dialog.accept()); await disable.click();
    await page.waitForFunction(() => !document.querySelector('[data-gitlab-disable="created-connection"]').disabled);
    assert.equal(await page.locator('[data-gitlab-enable]').count(), 0);
    failure = ''; page.once('dialog', dialog => dialog.accept()); await disable.click();
    const enable = page.locator('[data-gitlab-enable="created-connection"]');
    await enable.waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-gitlab-edit="created-connection"]').isDisabled(), true);
    failure = 'enable'; await enable.click();
    await page.waitForFunction(() => !document.querySelector('[data-gitlab-enable="created-connection"]').disabled);
    failure = ''; await enable.click(); await disable.waitFor({ state: 'visible' });
    await page.locator('.gitlab-drawer-close').click();
    await page.locator('.gitlab-connection-drawer').waitFor({ state: 'detached' });
    await page.locator('[data-gitlab-add-connection]').click();
    form = await fillAdd('OAuth待授权连接', 'user_oauth');
    await form.locator('[type=submit]').click();
    await waitText('.gitlab-verification.pending', '平台尚未配置 GitLab OAuth');
    assert.equal(await page.locator('[data-gitlab-verify="oauth-connection"]').isDisabled(), true);
    const writes = requests.filter(item => item.method !== 'GET');
    const creates = writes.filter(item => item.path.endsWith('/connections'));
    assert.equal(creates.length, 3);
    assert.deepEqual(creates[0].body, { name: '新连接', baseUrl: 'https://gitlab.example.test', projectPath: 'team/new-docs', defaultBranch: 'main', purpose: 'read', authMode: 'service_account', credentialRef: 'fixture_reference' });
    assert.deepEqual(creates[1].body, creates[0].body);
    assert.equal(Object.hasOwn(creates[2].body, 'credentialRef'), false);
    const edits = writes.filter(item => item.method === 'PATCH');
    assert.equal(edits.length, 2);
    for (const item of edits) {
      assert.equal(item.headers['if-match'], '1');
      assert.equal(item.body.name, '修改连接');
      assert.equal(item.body.purpose, 'read_write');
      assert.equal(Object.hasOwn(item.body, 'credentialRef'), false);
    }
    for (const item of writes) assert.ok(item.headers['idempotency-key']);
    assert.equal(writes.filter(item => item.path.endsWith('/verify')).length, 3);
    assert.equal(writes.filter(item => item.path.endsWith('/disable')).length, 2);
    assert.equal(writes.filter(item => item.path.endsWith('/enable')).length, 2);
    return 14;
  } finally {
    await page.unroute(pattern, handler);
    await new Promise(resolve => backend.close(resolve));
  }
}
module.exports = { exerciseGitlabConnectionHttp };
