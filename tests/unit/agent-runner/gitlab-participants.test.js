const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { resolveMRParticipants } = require('../../../packages/agent-runner-core/lib/gitlab-participants');

test('真实 HTTP 人员解析：分页、principal别名、审核人去重和失败提示', async t => {
  const calls = [];
  const server = http.createServer((req, res) => {
    calls.push(req.url);
    assert.equal(req.method, 'GET');
    assert.match(req.url, /^\/api\/v4\/projects\/group%2Fdocs\/users\?/);
    const page = new URL(req.url, 'http://localhost').searchParams.get('page');
    const members = page === '1' ? Array.from({ length: 100 }, (_, i) => ({ id: 1000 + i, username: `unrelated-${i}`, state: 'active', access_level: 30 }))
      : [{ id: 12, username: 'heyang', state: 'active' }, { id: 15, username: 'blocked', state: 'blocked', access_level: 40 }];
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(members));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const connection = { host: `http://127.0.0.1:${server.address().port}`, project: 'group/docs', status: 'active' };
  const task = { handbookId: 'HB-1', candidate: { digest: 'frozen' }, reviews: [{ reviewerIds: ['178'] }, { reviewerIds: ['u1', '178'] }] };
  const users = [{ id: 'u1', principalId: 178, loginName: 'heyang', displayName: '何阳' }];
  const options = { accessToken: 'fixture' };
  const result = await resolveMRParticipants(connection, task, users, options);
  assert.equal(calls.length, 2); assert.equal(result.canSubmit, true);
  assert.deepEqual(result.reviewers.map(item => item.gitlabId), [12]);
  assert.equal(result.assignees[0].platformId, '178');
  for (const user of [
    { id: 'u1', principalId: 178 },
    { id: 'u1', principalId: 178, loginName: 'no-project-access' },
    { id: 'u1', principalId: 178, loginName: 'blocked' },
    { id: 'u1', principalId: 178, loginName: 'missing', displayName: 'heyang' },
    { id: 'u1', principalId: 178, loginName: 'heyang', enabled: false },
    { id: 'u1', principalId: 178, loginName: 'heyang', visibleHandbookIds: ['other'] },
  ]) {
    const invalid = await resolveMRParticipants(connection, task, [user], options);
    assert.equal(invalid.canSubmit, false); assert.ok(invalid.reviewers.every(item => item.error));
  }
  const ambiguous = await resolveMRParticipants(connection, task, [...users, { id: 'u2', loginName: 'heyang' }], options);
  assert.equal(ambiguous.canSubmit, false); assert.match(ambiguous.reviewers[0].error, /多个人员/);
});

test('真实 HTTP 人员解析：无效响应、身份和项目成员边界保持不可提交', async t => {
  let mode = 'invalid-response';
  const server = http.createServer((req, res) => {
    assert.equal(req.method, 'GET');
    const page = Number(new URL(req.url, 'http://localhost').searchParams.get('page'));
    let body;
    if (mode === 'invalid-response') body = { users: [] };
    else if (mode === 'too-many') body = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, username: `u-${i}`, state: 'active' }));
    else if (mode === 'duplicate-members') body = [{ id: 1, username: 'same', state: 'active' }, { id: 2, username: 'same', state: 'active' }];
    else if (mode === 'single-member') body = [{ id: 3, username: 'fallback', state: 'active' }];
    else body = [];
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const connection = { host: `http://127.0.0.1:${server.address().port}`, project: 'group/docs', status: 'active' };
  const task = { handbookId: 'HB-1', candidate: { digest: 'edge' } };
  const call = (users, reviews = undefined) => resolveMRParticipants(connection, { ...task, ...(reviews === undefined ? {} : { reviews }) }, users, { accessToken: 'fixture' });

  await assert.rejects(() => call([{ id: 'u1', loginName: 'u1' }], [{ reviewerIds: ['u1'] }]), error => error.code === 'GITLAB_MEMBERS_INVALID' && error.status === 502);

  mode = 'too-many';
  await assert.rejects(() => call([{ id: 'u1', loginName: 'u1' }], [{ reviewerIds: ['u1'] }]), error => error.code === 'GITLAB_MEMBERS_LIMIT' && error.status === 422);

  mode = 'empty';
  const unmatched = await call([{ id: 'missing', loginName: 'missing' }], [{ reviewerIds: ['unknown'] }]);
  assert.equal(unmatched.reviewers[0].error, '平台人员不存在或不可用');
  assert.equal(unmatched.canSubmit, false);

  const duplicateIdentity = await call([{ id: 'same', loginName: 'first' }, { userId: 'same', loginName: 'second' }], [{ reviewerIds: ['same'] }]);
  assert.equal(duplicateIdentity.reviewers[0].error, '平台人员身份不唯一');

  const missingLogin = await call([{ id: 'nol', displayName: '没有账号' }], [{ reviewerIds: ['nol'] }]);
  assert.equal(missingLogin.reviewers[0].error, '缺少统一登录账号');

  const duplicateLogin = await call([{ id: 'one', loginName: 'same' }, { id: 'two', loginName: 'same' }], [{ reviewerIds: ['one'] }]);
  assert.equal(duplicateLogin.reviewers[0].error, '统一登录账号对应多个人员');

  mode = 'empty';
  const noProjectAccess = await call([{ id: 'ghost', loginName: 'ghost' }], [{ reviewerIds: ['ghost'] }]);
  assert.equal(noProjectAccess.reviewers[0].error, '未找到唯一的活跃项目可访问用户');

  mode = 'duplicate-members';
  const duplicateMembers = await call([{ id: 'same', loginName: 'same' }], [{ reviewerIds: ['same'] }]);
  assert.equal(duplicateMembers.reviewers[0].error, '未找到唯一的活跃项目可访问用户');

  mode = 'empty';
  const noReviews = await call([{ id: 'u1', loginName: 'u1' }]);
  assert.deepEqual(noReviews.reviewers, []);
  assert.equal(noReviews.canSubmit, false);

  mode = 'single-member';
  const fallback = await resolveMRParticipants(connection, { ...task, reviews: [{}] }, [{ userId: 'only-id', loginName: 'fallback' }], { accessToken: 'fixture' });
  assert.deepEqual(fallback.reviewers, []);
  assert.equal(fallback.assignees[0].platformId, 'only-id');
  assert.equal(fallback.assignees[0].gitlabId, 3);
});
