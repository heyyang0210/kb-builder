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
