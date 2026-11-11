const assert = require('node:assert/strict');
const { createServer } = require('node:http');

async function exerciseTeamGroupHttp(page) {
  const requests = [];
  let saves = 0, creates = 0, loads = 0;
  const backend = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requests.push({ method: request.method, url: request.url, headers: request.headers, body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null });
    response.setHeader('Content-Type', 'application/json');
    if (request.method === 'GET') {
      loads++;
      response.writeHead(loads === 1 ? 503 : 200).end(JSON.stringify(loads === 1
        ? { success: false, error: { message: '隔离列表不可用' } }
        : { success: true, data: { items: [{ teamGroupId: 72, groupName: '新隔离团队', rowVersion: 1 }] } }));
      return;
    }
    if (request.method === 'POST') {
      creates++;
      response.writeHead(creates === 1 ? 503 : 200).end(JSON.stringify(creates === 1
        ? { success: false, error: { message: '隔离创建服务不可用' } }
        : { success: true, data: { teamGroupId: 72, rowVersion: 1 } }));
      return;
    }
    saves++;
    const status = saves === 1 ? 409 : saves === 2 ? 503 : 200;
    response.writeHead(status).end(JSON.stringify(status === 200
      ? { success: true, data: { teamGroupId: 71, rowVersion: 5, leader: { principalId: 11 }, members: [{ principalId: 12 }] } }
      : { success: false, error: { message: '隔离名册服务不可用' } }));
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const pattern = '**/knowledge-center/api/platform/team-groups**';
  const handler = async route => {
    const url = new URL(route.request().url());
    url.hostname = '127.0.0.1'; url.port = String(backend.address().port);
    await route.fulfill({ response: await route.fetch({ url: url.href }) });
  };
  await page.route(pattern, handler);
  try {
    await page.evaluate(async () => {
      const { appState } = await import('/knowledge-center/common/state/app-state.js');
      const { renderPrincipalsTab } = await import('/knowledge-center/modules/platform-admin/view.js');
      const keys = ['principalProjection', 'teamGroupProjection', 'teamGroupUi', 'activeView', 'platformTab'];
      const previous = Object.fromEntries(keys.map(key => [key, appState[key]]));
      const previousUrl = location.href, previousHistory = history.state;
      const host = document.createElement('section');
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      const until = async predicate => {
        for (let i = 0; i < 400 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 10));
        check(predicate(), '团队名册请求未达到预期状态');
      };
      try {
        appState.activeView = 'dashboard';
        const people = [11, 12].map(principalId => ({ principalId, displayName: String(principalId), state: 'ACTIVE' }));
        appState.principalProjection = { status: 'ok', items: people };
        appState.teamGroupProjection = { status: 'ok', items: [{ teamGroupId: 71, groupName: '隔离团队', rowVersion: 4, leader: people[0], members: [people[1]] }] };
        appState.teamGroupUi = {};
        host.innerHTML = renderPrincipalsTab(appState.principalProjection, {}, appState.teamGroupProjection, 'groups');
        document.body.prepend(host);
        const form = host.querySelector('[data-team-group-form]');
        const save = form.querySelector('[data-team-group-save]');
        for (const expected of ['团队名册已被其他操作更新，请重新加载后再试。', '隔离名册服务不可用']) {
          save.click();
          check(save.disabled, '保存请求期间按钮应禁用');
          await until(() => !save.disabled && form.querySelector('[data-team-group-status]').textContent === expected);
          check(appState.teamGroupProjection.items[0].rowVersion === 4 && form.querySelector('[name=memberPrincipalIds]').value === '12', '失败应保留版本和成员选择');
        }
        save.click();
        await until(() => appState.teamGroupUi.saveStatus?.kind === 'success');
        check(appState.teamGroupProjection.items[0].rowVersion === 5, '成功未更新版本：' + JSON.stringify(appState.teamGroupProjection));
        host.querySelector('[data-team-group-cancel]').click();
        check(appState.teamGroupUi.saveStatus.message === '未保存修改已取消。', '取消状态错误');
        host.querySelector('[data-team-group-view]').click();
        check(new URL(location.href).searchParams.get('groupId') === '71' && appState.platformTab === 'principals', '导航未保留小组');
        const retry = document.createElement('button');
        retry.type = 'button'; retry.dataset.teamGroupRetry = ''; host.append(retry);
        retry.click();
        await until(() => appState.teamGroupProjection.status === 'unavailable');
        check(appState.teamGroupProjection.error === '隔离列表不可用', '列表错误丢失');
        retry.click();
        await until(() => appState.teamGroupProjection.status === 'ok');
        host.querySelector('[data-team-group-create]').click();
        const dialog = host.querySelector('dialog');
        const create = host.querySelector('[data-team-group-create-form]');
        const submit = create.querySelector('[type=submit]');
        const send = () => create.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        create.elements.groupName.value = '  '; send();
        check(host.querySelector('[data-team-group-create-status]').textContent === '请输入小组名称。', '空名未拒绝');
        create.elements.groupName.value = ' 新隔离团队 '; send();
        await until(() => !submit.disabled && host.querySelector('[data-team-group-create-status]').textContent === '隔离创建服务不可用');
        check(dialog.open && create.elements.groupName.value === ' 新隔离团队 ', '失败应保留输入');
        send();
        await until(() => !submit.disabled && new URL(location.href).searchParams.get('groupId') === '72');
        check(!dialog.open && appState.teamGroupProjection.items[0].teamGroupId === 72, '成功未关闭并重载');
      } finally {
        host.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
        host.remove(); Object.assign(appState, previous); history.replaceState(previousHistory, '', previousUrl);
      }
    });
    assert.equal(requests.length, 8);
    for (const request of requests.filter(item => item.method === 'PUT')) {
      assert.equal(request.method, 'PUT');
      assert.equal(request.headers['if-match'], '4');
      assert.ok(request.headers['idempotency-key']);
      assert.equal(request.body.leaderPrincipalId, 11);
      assert.deepEqual(request.body.memberPrincipalIds, [12]);
      assert.ok(request.body.actor);
    }
    for (const request of requests.filter(item => item.method === 'POST')) {
      assert.equal(request.body.groupName, '新隔离团队');
      assert.ok(request.headers['idempotency-key']);
    }
    assert.equal(creates, 2); assert.equal(loads, 3); assert.equal(saves, 3);
    for (const request of requests.filter(item => item.method === 'GET'))
      assert.equal(new URL(request.url, 'http://localhost').searchParams.get('groupType'), 'TECH_DOMAIN');
    return 10;
  } finally {
    await page.unroute(pattern, handler);
    await new Promise(resolve => backend.close(resolve));
  }
}
module.exports = { exerciseTeamGroupHttp };
