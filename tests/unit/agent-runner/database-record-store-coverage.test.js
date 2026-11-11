const http = require('http');
const https = require('https');
const { EventEmitter } = require('events');

jest.mock('../../../packages/agent-runner-core/lib/database-config', () => ({
  loadDatabaseConfig: jest.fn(() => ({ storage: { url: 'http://127.0.0.1:14210', timeoutMs: 200 } })),
}));

const { DatabaseRecordStore, DatabaseRecordStoreError } = require('../../../packages/agent-runner-core/lib/database-record-store');
const { loadDatabaseConfig } = require('../../../packages/agent-runner-core/lib/database-config');

let server;
let requests;
let respond;
let baseUrl;

beforeEach(async () => {
  requests = [];
  respond = (_request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end('{}');
  };
  server = http.createServer((request, response) => {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
      const observed = { method: request.method, path: request.url, headers: request.headers, body: Buffer.concat(chunks).toString() };
      requests.push(observed);
      respond(observed, response);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  jest.restoreAllMocks();
});

test('uses configured defaults and sends record operations through the storage HTTP contract', async () => {
  const defaults = new DatabaseRecordStore();
  expect(defaults.baseUrl.href).toBe('http://127.0.0.1:14210/');
  expect(defaults.timeoutMs).toBe(200);
  loadDatabaseConfig.mockReturnValueOnce({ storage: {} });
  const fallback = new DatabaseRecordStore();
  expect(fallback.baseUrl.href).toBe('http://127.0.0.1:14210/');
  expect(fallback.timeoutMs).toBe(15000);

  respond = (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(request.method === 'GET' && request.path.startsWith('/v1/records/')
      ? { payload: { title: '正文' }, revision: 3, sha256: 'digest', deleted: false, updatedAt: 'now', internal: 'hidden' }
      : { success: true }));
  };
  const store = new DatabaseRecordStore({ baseUrl, timeoutMs: 100 });
  expect(store.timeoutMs).toBe(100);
  expect(await store.health()).toEqual({ success: true });
  expect(await store.read('名称 空间', '路径/键')).toEqual({
    payload: { title: '正文' }, revision: 3, sha256: 'digest', deleted: false, updatedAt: 'now',
  });
  expect(await store.write('名称 空间', '路径/键', { title: '新版' }, 3)).toEqual({ success: true });
  expect(await store.write('名称 空间', '路径/键', { title: '初版' })).toEqual({ success: true });
  expect(await store.delete('名称 空间', '路径/键', 4)).toEqual({ success: true });
  expect(await store.exportAll()).toEqual({ success: true });

  expect(requests.map(({ method, path }) => [method, path])).toEqual([
    ['GET', '/health'],
    ['GET', '/v1/records/%E5%90%8D%E7%A7%B0%20%E7%A9%BA%E9%97%B4/%E8%B7%AF%E5%BE%84%2F%E9%94%AE'],
    ['PUT', '/v1/records/%E5%90%8D%E7%A7%B0%20%E7%A9%BA%E9%97%B4/%E8%B7%AF%E5%BE%84%2F%E9%94%AE'],
    ['PUT', '/v1/records/%E5%90%8D%E7%A7%B0%20%E7%A9%BA%E9%97%B4/%E8%B7%AF%E5%BE%84%2F%E9%94%AE'],
    ['DELETE', '/v1/records/%E5%90%8D%E7%A7%B0%20%E7%A9%BA%E9%97%B4/%E8%B7%AF%E5%BE%84%2F%E9%94%AE'],
    ['GET', '/v1/export'],
  ]);
  expect(requests[2]).toMatchObject({ body: JSON.stringify({ title: '新版' }), headers: { 'if-match': '3', 'content-type': 'application/json; charset=utf-8' } });
  expect(requests[2].headers['content-length']).toBe(String(Buffer.byteLength(requests[2].body)));
  expect(requests[3].headers['if-match']).toBeUndefined();
  expect(requests[4].headers['if-match']).toBe('4');
  expect(requests[5].headers.accept).toBe('application/json');
});

test('maps storage error responses and rejects invalid JSON', async () => {
  const store = new DatabaseRecordStore({ baseUrl });
  respond = (_request, response) => {
    response.writeHead(409, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'REVISION_CONFLICT', message: '版本冲突', details: { current: 4 } } }));
  };
  await expect(store.health()).rejects.toMatchObject({ code: 'REVISION_CONFLICT', message: '版本冲突', status: 409, details: { current: 4 } });
  respond = (_request, response) => { response.writeHead(503); response.end('{}'); };
  await expect(store.health()).rejects.toMatchObject({ code: 'STORAGE_REQUEST_FAILED', message: '存储服务请求失败', status: 503 });
  respond = (_request, response) => { response.writeHead(200); response.end(''); };
  await expect(store.health()).resolves.toEqual({});
  respond = (_request, response) => { response.writeHead(200); response.end('{broken'); };
  await expect(store.health()).rejects.toMatchObject({ code: 'INVALID_STORAGE_RESPONSE', status: 200 });
});

test('maps connection refusal and timeout without contacting shared storage', async () => {
  const closedPort = server.address().port;
  await new Promise(resolve => server.close(resolve));
  server = http.createServer();
  await expect(new DatabaseRecordStore({ baseUrl: `http://127.0.0.1:${closedPort}` }).health())
    .rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE', status: 503, details: { cause: expect.any(String) } });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  server.removeAllListeners('request');
  server.on('request', () => {});
  await expect(new DatabaseRecordStore({ baseUrl, timeoutMs: 15 }).health())
    .rejects.toMatchObject({ code: 'STORAGE_TIMEOUT', status: 503 });
});

test('selects HTTPS transport for HTTPS storage URLs', async () => {
  const request = new EventEmitter();
  request.end = jest.fn(() => {
    const response = new EventEmitter();
    response.statusCode = 200;
    callback(response);
    response.emit('end');
  });
  let callback;
  const transport = jest.spyOn(https, 'request').mockImplementation((_target, _options, onResponse) => {
    callback = onResponse;
    return request;
  });
  const store = new DatabaseRecordStore({ baseUrl: 'https://storage.example.test' });
  await expect(store.health()).resolves.toEqual({});
  expect(transport).toHaveBeenCalledWith(new URL('https://storage.example.test/health'), expect.objectContaining({ method: 'GET' }), expect.any(Function));
  expect(request.end).toHaveBeenCalledTimes(1);
  expect(new DatabaseRecordStoreError('TEST', '测试', 400)).toMatchObject({ code: 'TEST', message: '测试', status: 400 });
});
