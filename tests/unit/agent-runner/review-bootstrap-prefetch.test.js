const fs = require('fs');
const path = require('path');

function setup(location, request = jest.fn(async () => ({ workbench: {} }))) {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/common/api/review-bootstrap-prefetch.js'), 'utf8')
    .replace(/^import .*;\n/, '').replace(/export /g, '');
  const api = new Function('window', 'loadReviewBootstrap', `${source}\nreturn { startReviewBootstrapPrefetch, takeReviewBootstrapPrefetch };`)({ location }, request);
  return { ...api, request };
}
const route = { pathname: '/knowledge-center/review', search: '?handbookId=DB-004' };
const options = { handbookId: 'DB-004', taskId: '', step: 'read', view: 'reader', documentId: '', path: '' };

test('提前读取按完整路由单次复用，后续刷新不复用', async () => {
  const api = setup(route);
  api.startReviewBootstrapPrefetch(route);
  expect(api.request).toHaveBeenCalledTimes(1);
  expect(api.request).toHaveBeenCalledWith(options, { notifyAuthErrors: false });
  expect(await api.takeReviewBootstrapPrefetch(options)).toEqual({ data: { workbench: {} } });
  expect(await api.takeReviewBootstrapPrefetch(options)).toBeNull();
});

test.each(Object.keys(options))('路由参数 %s 不同不使用旧请求', async key => {
  const api = setup(route);
  expect(await api.takeReviewBootstrapPrefetch({ ...options, [key]: 'different' })).toBeNull();
  expect(await api.takeReviewBootstrapPrefetch(options)).toBeNull();
});

test('认证失败允许正常加载重试，不保留失败缓存', async () => {
  const api = setup(route, jest.fn(async () => { throw Object.assign(new Error('未认证'), { status: 401 }); }));
  expect(await api.takeReviewBootstrapPrefetch(options)).toBeNull();
  expect(await api.takeReviewBootstrapPrefetch(options)).toBeNull();
});

test.each([
  { pathname: '/knowledge-center/assets', search: '' },
  { ...route, search: '?ticket=cas-ticket' },
])('非审核路由和 CAS 回调不预取：%j', async location => {
  const api = setup(location);
  expect(api.request).not.toHaveBeenCalled();
  expect(await api.takeReviewBootstrapPrefetch(options)).toBeNull();
});

test('任务详情默认 reader，列表默认 handbooks', () => {
  expect(setup({ ...route, search: '?taskId=task' }).request.mock.calls[0][0]).toMatchObject({ taskId: 'task', view: 'reader' });
  expect(setup({ ...route, search: '' }).request.mock.calls[0][0]).toMatchObject({ view: 'handbooks' });
});

test.each([401, 403])('预取 HTTP %s 不覆盖认证状态，普通请求仍派发错误事件', async status => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/common/api/incremental-api.js'), 'utf8').replace(/export /g, '');
  const dispatchEvent = jest.fn();
  const fetch = jest.fn(async () => ({ status, ok: false, json: async () => ({ error: { message: '拒绝' } }) }));
  const load = new Function('window', 'fetch', 'CustomEvent', `${source}\nreturn loadReviewBootstrap;`)({ dispatchEvent }, fetch, function CustomEvent(type) { this.type = type; });
  await expect(load(options, { notifyAuthErrors: false })).rejects.toMatchObject({ status });
  expect(dispatchEvent).not.toHaveBeenCalled();
  expect(fetch.mock.calls[0][1]).not.toHaveProperty('notifyAuthErrors');
  await expect(load(options)).rejects.toMatchObject({ status });
  expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: status === 401 ? 'knowledge-center:session-expired' : 'knowledge-center:permission-denied' }));
});
