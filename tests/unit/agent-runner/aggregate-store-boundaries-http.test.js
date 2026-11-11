const http = require('node:http');
const { Worker } = require('node:worker_threads');
const { DatabaseAggregateStore } = require('../../../packages/agent-runner-core/lib/aggregate-store');

let server, baseUrl, respond, requests;
beforeEach(async () => {
  requests = [];
  respond = (_req, res) => res.end('{}');
  server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ method: req.method, url: req.url, headers: req.headers, body });
    respond(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});
const store = () => new DatabaseAggregateStore('隔离空间', 'state', { items: [] }, { baseUrl });

const curlArgs = (s, method = 'GET') => ['-sS', '--max-time', '2', '-X', method, ...(method === 'PUT' ? ['--data-binary', '@-'] : []), s.recordUrl()];

test('异步curl真实发送PUT正文、解析空响应并保留业务失败', async () => {
  const s = store();
  respond = (_req, res) => res.end('{"success":true,"revision":2}');
  await expect(s.executeAsync(curlArgs(s, 'PUT'), '{"items":[1]}')).resolves.toEqual({ success: true, revision: 2 });
  expect(requests[0]).toMatchObject({ method: 'PUT', body: '{"items":[1]}', url: '/v1/records/%E9%9A%94%E7%A6%BB%E7%A9%BA%E9%97%B4/state' });
  respond = (_req, res) => res.end('');
  await expect(s.executeAsync(curlArgs(s))).resolves.toEqual({});
  respond = (_req, res) => res.end('{broken');
  await expect(s.executeAsync(curlArgs(s))).rejects.toBeInstanceOf(SyntaxError);
  respond = (_req, res) => res.end('{"success":false}');
  await expect(s.executeAsync(curlArgs(s))).rejects.toMatchObject({ code: 'STORAGE_REQUEST_FAILED', status: 503 });
  respond = (_req, res) => res.destroy();
  await expect(s.executeAsync(curlArgs(s))).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE', status: 503 });
});

test('共享草稿畸形JSON与连接中断返回受控不可用错误', async () => {
  const s = store();
  respond = (_req, res) => res.end('{broken');
  await expect(s.readDraftAsync('HB|文档')).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE', status: 503 });
  expect(new URL(requests[0].url, baseUrl).searchParams.get('draftKey')).toBe('HB|文档');
  respond = (_req, res) => res.destroy();
  await expect(s.readDraftAsync('HB|文档')).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
});

test('聚合读取与写入网络失败丢弃快照，恢复后重新读取', async () => {
  const s = store();
  respond = (_req, res) => { res.setHeader('etag', '"3"'); res.end('{"payload":{"items":[3]},"revision":3}'); };
  await expect(s.readAsync()).resolves.toEqual({ items: [3] });
  respond = (_req, res) => res.end('{broken');
  await expect(s.readAsync()).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
  await expect(s.writeAtRevisionAsync({ items: [4] }, 3)).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
  expect(requests[2]).toMatchObject({ method: 'PUT', headers: { 'if-match': '3' }, body: '{"items":[4]}' });
  respond = (_req, res) => res.end('{"payload":{"items":[5]},"revision":5}');
  await expect(s.readAsync()).resolves.toEqual({ items: [5] });
  expect(requests[3].headers['if-none-match']).toBeUndefined();
});

test.each(['REVISION_CONFLICT', 'DATABASE_UNAVAILABLE'])('异步事务失败%s按冲突策略限制重试且不提交', async code => {
  const s = store();
  respond = (req, res) => res.end(JSON.stringify(req.method === 'GET'
    ? { payload: { items: [] }, revision: 1 }
    : { success: false, error: { code } }));
  const mutate = jest.fn(state => state.items.push('new'));
  await expect(s.transactionAsync(mutate, 2)).rejects.toMatchObject({ code, status: code === 'REVISION_CONFLICT' ? 409 : 503 });
  expect(mutate).toHaveBeenCalledTimes(code === 'REVISION_CONFLICT' ? 2 : 1);
  expect(requests.filter(r => r.method === 'PUT')).toHaveLength(code === 'REVISION_CONFLICT' ? 2 : 1);
  await expect(s.transactionAsync(mutate, 0)).rejects.toMatchObject({ code: 'REVISION_CONFLICT', status: 409 });
});

// A separate event loop must serve synchronous curl requests while Jest is blocked.
async function synchronousFixture(mode) {
  const worker = new Worker(`
    const http = require('node:http');
    const { parentPort, workerData } = require('node:worker_threads');
    let revision=1, writes=0, payload={count:1};
    const server=http.createServer(async(req,res)=>{
      let body=''; for await(const chunk of req) body+=chunk;
      if(workerData==='invalid') return res.end('{broken');
      if(req.method==='GET') return res.end(JSON.stringify({payload,revision}));
      writes++;
      if(workerData==='failure') return res.end(JSON.stringify({success:false,error:{code:'DATABASE_UNAVAILABLE'}}));
      if(workerData==='exhausted'||writes===1) {
        revision++; return res.end(JSON.stringify({success:false,error:{code:'REVISION_CONFLICT'}}));
      }
      if(Number(req.headers['if-match'])!==revision) {res.statusCode=400;return res.end('{}');}
      payload=JSON.parse(body); revision++;
      res.end(JSON.stringify({success:true,revision}));
    });
    server.listen(0,'127.0.0.1',()=>parentPort.postMessage(server.address().port));
  `, { eval: true, workerData: mode });
  try {
    const port = await new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); });
    return { worker, s: new DatabaseAggregateStore('test', mode, { count: 0 }, { baseUrl: `http://127.0.0.1:${port}` }) };
  } catch (error) { await worker.terminate(); throw error; }
}

test('同步curl解析失败包装为受控错误', async () => {
  const { worker, s } = await synchronousFixture('invalid');
  try { expect(() => s.read()).toThrow(expect.objectContaining({ code: 'STORAGE_UNAVAILABLE', status: 503 })); }
  finally { await worker.terminate(); }
});

test('同步事务冲突后重新读取版本再提交并保留变更', async () => {
  const { worker, s } = await synchronousFixture('retry');
  try {
    const mutate = jest.fn(state => ++state.count);
    expect(s.transaction(mutate, 2)).toBe(2);
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(s.read()).toEqual({ count: 2 });
    const replacement = { count: 3, title: '覆盖写入' };
    expect(s.write(replacement)).toBe(replacement);
    expect(s.read()).toEqual(replacement);
  } finally { await worker.terminate(); }
});

test.each(['exhausted', 'failure'])('同步事务%s返回最终错误', async mode => {
  const { worker, s } = await synchronousFixture(mode);
  try {
    const mutate = jest.fn(state => ++state.count);
    expect(() => s.transaction(mutate, 2)).toThrow(expect.objectContaining({ code: mode === 'exhausted' ? 'REVISION_CONFLICT' : 'DATABASE_UNAVAILABLE' }));
    expect(mutate).toHaveBeenCalledTimes(mode === 'exhausted' ? 2 : 1);
    expect(s.read()).toEqual({ count: 1 });
    expect(() => s.transaction(mutate, 0)).toThrow(expect.objectContaining({ code: 'REVISION_CONFLICT', status: 409 }));
  } finally { await worker.terminate(); }
});

test('草稿兼容旧聚合与新版投影，缺失草稿返回null', async () => {
  const s = store();
  respond = (_req, res) => res.end(JSON.stringify({ payload: { drafts: { guide: { markdown: '# 正文' } } } }));
  await expect(s.readDraftAsync('guide')).resolves.toEqual({ markdown: '# 正文' });
  await expect(s.readDraftAsync('missing')).resolves.toBeNull();
  respond = (_req, res) => res.end(JSON.stringify({ payload: { markdown: '# 新版' } }));
  await expect(s.readDraftAsync('guide')).resolves.toEqual({ markdown: '# 新版' });
  respond = (_req, res) => res.end(JSON.stringify({ success: false }));
  await expect(s.readDraftAsync('guide')).rejects.toMatchObject({ code: 'STORAGE_REQUEST_FAILED', message: '读取共享草稿失败', status: 503 });
});

test('删除与缺失记录返回独立空快照，默认错误与详细错误可诊断', async () => {
  const s = store();
  respond = (_req, res) => res.end(JSON.stringify({ deleted: true, revision: 7, payload: { items: ['deleted'] } }));
  const deleted = await s.readRecordAsync();
  expect(deleted).toEqual({ payload: { items: [] }, revision: 7 });
  deleted.payload.items.push('污染');
  expect(s.emptyValue).toEqual({ items: [] });
  respond = (_req, res) => { res.statusCode = 404; res.end(JSON.stringify({ success: false, error: { code: 'RECORD_NOT_FOUND' } })); };
  await expect(s.readRecordAsync()).resolves.toEqual({ payload: { items: [] }, revision: 0 });
  respond = (_req, res) => { res.statusCode = 503; res.end('{}'); };
  await expect(s.readRecordAsync()).rejects.toMatchObject({ code: 'STORAGE_REQUEST_FAILED', status: 503 });
  respond = (_req, res) => res.end(JSON.stringify({ success: false, error: { code: 'OUTLINE_DELETED', message: '已删除', details: { id: 'guide' } } }));
  await expect(s.readRecordAsync()).rejects.toMatchObject({ code: 'OUTLINE_DELETED', message: '已删除', status: 409, details: { id: 'guide' } });
  await expect(s.writeAtRevisionAsync({}, 7)).rejects.toMatchObject({ code: 'OUTLINE_DELETED', status: 409 });
});

test('异步事务成功提交克隆快照并发送版本条件', async () => {
  const s = store();
  respond = (req, res) => res.end(JSON.stringify(req.method === 'GET' ? { payload: { items: ['old'] }, revision: 4 } : { success: true, revision: 5 }));
  const result = await s.transactionAsync(async state => { state.items.push('new'); return 'saved'; });
  expect(result).toBe('saved');
  expect(requests[1]).toMatchObject({ method: 'PUT', headers: { 'if-match': '4' }, body: '{"items":["old","new"]}' });
  expect(s.readSnapshot).toMatchObject({ revision: 5, payload: { items: ['old', 'new'] } });
});

test('文件原子写失败清理临时文件并保留旧数据，恢复后可写', async () => {
  const fs = require('node:fs'); const path = require('node:path');
  const { FileAggregateStore } = require('../../../packages/agent-runner-core/lib/aggregate-store');
  const parent = path.resolve(__dirname, '../../../runtime/test-results'); fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'aggregate-file-'));
  const target = path.join(root, 'state.json');
  const s = new FileAggregateStore(target, { items: [] });
  let spy;
  try {
    const empty = await s.readAsync(); empty.items.push('污染'); expect(s.read()).toEqual({ items: [] });
    s.write({ items: ['old'] });
    const original = fs.renameSync;
    spy = jest.spyOn(fs, 'renameSync').mockImplementation((from, to) => { if (to === target) throw new Error('隔离写入失败'); return original(from, to); });
    expect(() => s.transaction(state => state.items.push('new'))).toThrow('隔离写入失败');
    expect(s.read()).toEqual({ items: ['old'] });
    expect(fs.readdirSync(root)).toEqual(['state.json']);
    spy.mockRestore(); spy = null;
    expect(s.transaction(state => state.items.push('new'))).toBe(2);
    expect(await s.readAsync()).toEqual({ items: ['old', 'new'] });
  } finally { spy?.mockRestore(); fs.rmSync(root, { recursive: true, force: true }); }
});
