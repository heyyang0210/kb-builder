const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const zlib = require('node:zlib');
const { once } = require('node:events');

module.exports = function serverBoundaries({ configured, host, existing }) {
  describe(`API服务入口 ${configured ? '已配置' : '未配置'}内部鉴权`, () => {
    let root, server, io, base, logger, handlers, env, onSpy, exitSpy;
    const clients = [];
    const payload = { content: '真实HTTP压缩正文'.repeat(200) };
    const token = 'isolated-outline-token';
    const core = '../../../../packages/agent-runner-core';
    function request(url, { method = 'GET', headers = {}, body } = {}) {
      return new Promise((resolve, reject) => {
        const req = http.request(`${base}${url}`, { method, headers }, res => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk)); res.on('error', reject);
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
        });
        req.on('error', reject); req.setTimeout(3000, () => req.destroy(new Error('测试HTTP超时')));
        req.end(body);
      });
    }
    const json = response => JSON.parse(response.body.toString());
    beforeAll(async () => {
      const parent = path.resolve(__dirname, '../../../../runtime/test-tmp');
      fs.mkdirSync(parent, { recursive: true }); root = fs.mkdtempSync(path.join(parent, 'api-entry-'));
      if (existing) {
        for (const dir of ['logs', 'tmp', 'output']) fs.mkdirSync(path.join(root, dir));
        fs.writeFileSync(path.join(root, 'output', 'preview.txt'), '隔离预览文件');
      }
      env = { ...process.env }; process.env.PORT = '0'; process.env.HOST = host;
      if (configured) process.env.KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN = token;
      else delete process.env.KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN;
      logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
      handlers = {};
      const originalOn = process.on;
      onSpy = jest.spyOn(process, 'on').mockImplementation(function (event, callback) {
        if (['uncaughtException', 'unhandledRejection', 'SIGTERM', 'SIGINT'].includes(event)) { handlers[event] = callback; return this; }
        return originalOn.call(this, event, callback);
      });
      exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      jest.doMock(`${core}/lib/logger`, () => logger);
      jest.doMock(`${core}/lib/runtime-env`, () => ({ loadRuntimeEnv: jest.fn() }));
      jest.doMock(`${core}/lib/repo-paths`, () => ({ REPOSITORY_ROOT: root, AGENT_RUNNER_RUNTIME_ROOT: root }));
      jest.doMock(`${core}/lib/tools/tool-manager`, () => jest.fn());
      jest.doMock(`${core}/lib/platform-profile/profile-loader`, () => ({
        ...jest.requireActual(`${core}/lib/platform-profile/profile-loader`),
        loadProfile: () => ({ context: { platform: '隔离测试' }, profile: {}, resources: {} })
      }));
      jest.doMock(`${core}/routes/config`, () => {
        const router = require('express').Router();
        router.get('/response/:kind', (req, res) => {
          const kind = req.params.kind;
          if (kind === 'empty') return res.status(204).end();
          if (kind === 'small') return res.json({ ok: true });
          if (kind === 'plain') return res.type('text/plain').send('text'.repeat(400));
          if (kind === 'untyped') return res.end('raw');
          if (kind === 'encoded') { res.set('Content-Encoding', 'identity'); return res.json(payload); }
          if (kind === 'string') { res.set('Content-Type', 'application/json'); return res.end(JSON.stringify(payload), 'utf8'); }
          return res.json(payload);
        });
        return router;
      });
      jest.doMock(`${core}/routes/outline`, () => {
        const router = require('express').Router();
        router.use((req, res) => res.json({ accepted: true, method: req.method, path: req.path })); return router;
      });
      jest.doMock(`${core}/routes/agent`, () => Object.assign(require('express').Router(), { setIO: jest.fn() }));
      for (const name of ['workflow', 'document', 'model-provider']) jest.doMock(`${core}/routes/${name}`, () => require('express').Router());
      jest.doMock(`${core}/routes/document-tasks`, () => () => require('express').Router());
      ({ httpServer: server, io } = require('../../../../apps/knowledge-center-api/server'));
      if (!server.listening) await once(server, 'listening');
      base = `http://127.0.0.1:${server.address().port}`;
    });
    afterAll(async () => {
      for (const client of clients) client.disconnect();
      if (io) await new Promise(resolve => io.close(resolve));
      if (server?.listening) await new Promise(resolve => server.close(resolve));
      onSpy?.mockRestore(); exitSpy?.mockRestore(); jest.restoreAllMocks();
      process.env = env; fs.rmSync(root, { recursive: true, force: true });
    });

    test('真实健康、冻结上下文、请求ID、404和预览目录', async () => {
      expect(fs.statSync(path.join(root, 'logs')).isDirectory()).toBe(true);
      expect(fs.statSync(path.join(root, 'tmp')).isDirectory()).toBe(true);
      const response = await request('/api/health', { headers: { 'x-request-id': 'test-request', 'x-correlation-id': 'test-correlation' } });
      expect(response.status).toBe(200); expect(json(response)).toMatchObject({ status: 'ok', version: '1.0.0' });
      expect(response.headers).toMatchObject({ 'x-request-id': 'test-request', 'x-correlation-id': 'test-correlation' });
      expect(json(await request('/api/platform/context'))).toEqual({ platform: '隔离测试' });
      expect(Object.getOwnPropertyDescriptor(global, '__KNOWLEDGE_PLATFORM_CONTEXT__').writable).toBe(false);
      expect(Object.isFrozen(global.__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__)).toBe(true);
      expect((await request('/missing')).status).toBe(404);
      const preview = await request('/preview/preview.txt');
      expect(preview.status).toBe(existing ? 200 : 404);
      if (existing) expect(preview.body.toString()).toBe('隔离预览文件');
      expect(logger.info).toHaveBeenCalledWith('request.completed', expect.objectContaining({ method: 'GET', status: 200 }));
    });

    test.each([
      ['POST', '/import'], ['POST', '/handbooks'], ['POST', '/governance/H/publish'],
      ['POST', '/governance/H/restore'], ['POST', '/governance/H/purge'], ['POST', '/governance/H/document-proposals'],
      ['PUT', '/governance/H/governance'], ['PATCH', '/build-tasks/T/items/I'], ['DELETE', '/any'], ['GET', '/governance/H/purge-preflight']
    ])('真实网关约束 %s %s', async (method, route) => {
      const response = await request(`/api/outline${route}`, { method });
      expect(response.status).toBe(configured ? 403 : 503);
      expect(json(response).error.code).toBe(configured ? 'OUTLINE_GATEWAY_REQUIRED' : 'OUTLINE_AUTH_NOT_CONFIGURED');
      if (configured) {
        for (const value of ['wrong', 'x'.repeat(token.length), token]) {
          const result = await request(`/api/outline${route}`, { method, headers: { 'x-knowledge-center-internal-token': value } });
          expect(result.status).toBe(value === token ? 200 : 403);
          if (value === token) expect(json(result)).toEqual({ accepted: true, method, path: route });
        }
      }
    });
    test.each([['GET', '/handbooks'], ['POST', '/read-only-query'], ['PUT', '/read-only-query'], ['PATCH', '/read-only-query']])('普通路由不误判为受保护命令 %s %s', async (method, route) => {
      expect((await request(`/api/outline${route}`, { method })).status).toBe(200);
    });

    if (configured) {
      test('真实响应压缩协商、字符串、空正文和非JSON', async () => {
        for (const kind of ['large', 'string']) {
          const response = await request(`/api/config/response/${kind}`, { headers: { 'accept-encoding': 'gzip' } });
          expect(response.headers['content-encoding']).toBe('gzip');
          expect(response.headers.vary).toContain('Accept-Encoding');
          expect(JSON.parse(zlib.gunzipSync(response.body))).toEqual(payload);
        }
        const identity = await request('/api/config/response/large', { headers: { 'accept-encoding': 'identity' } });
        expect(identity.headers['content-encoding']).toBeUndefined(); expect(json(identity)).toEqual(payload);
        expect(identity.headers.vary).toContain('Accept-Encoding');
        for (const kind of ['small', 'empty', 'plain', 'untyped', 'encoded']) {
          const response = await request(`/api/config/response/${kind}`, { headers: { 'accept-encoding': 'gzip' } });
          expect(response.headers['content-encoding']).toBe(kind === 'encoded' ? 'identity' : undefined);
          expect(response.status).toBe(kind === 'empty' ? 204 : 200);
        }
      });
      test('压缩器故障回退真实HTTP原文并记录告警', async () => {
        const gzip = jest.spyOn(zlib, 'gzipSync').mockImplementationOnce(() => { throw new Error('隔离压缩故障'); });
        const response = await request('/api/config/response/large', { headers: { 'accept-encoding': 'gzip' } });
        gzip.mockRestore();
        expect(json(response)).toEqual(payload); expect(response.headers['content-encoding']).toBeUndefined();
        expect(logger.warn).toHaveBeenCalledWith('JSON response gzip failed; sending uncompressed response', { error: '隔离压缩故障' });
      });
      test('真实Socket.IO订阅退订ack、无task_id及无ack事件', async () => {
        const client = require('socket.io-client').io(base, { transports: ['websocket'], reconnection: false, timeout: 3000 }); clients.push(client);
        await once(client, 'connect');
        const socket = io.sockets.sockets.get(client.id);
        expect(await client.timeout(2000).emitWithAck('subscribe', { task_id: 'task-1' })).toEqual({ status: 'subscribed', task_id: 'task-1' });
        expect(socket.rooms.has('task:task-1')).toBe(true);
        expect(await client.timeout(2000).emitWithAck('unsubscribe', { task_id: 'task-1' })).toEqual({ status: 'unsubscribed', task_id: 'task-1' });
        expect(socket.rooms.has('task:task-1')).toBe(false);
        for (const [event, data] of [['subscribe', {}], ['unsubscribe', {}], ['subscribe', { task_id: 'no-ack' }], ['unsubscribe', { task_id: 'no-ack' }]]) {
          const received = once(socket, event); client.emit(event, data); await received;
        }
        const disconnected = once(socket, 'disconnect'); client.disconnect(); await disconnected;
        expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('disconnected'));
      });
      test('异常与拒绝处理器记录原始诊断，服务错误记录退出', () => {
        const error = new Error('隔离异常');
        handlers.uncaughtException(error);
        expect(logger.error).toHaveBeenCalledWith('Uncaught Exception:', { error: error.message, stack: error.stack });
        for (const reason of [error, 'plain reason', undefined]) handlers.unhandledRejection(reason, Promise.resolve());
        expect(logger.error).toHaveBeenCalledWith('Unhandled Rejection:', { reason: 'plain reason', stack: undefined });
        for (const code of ['EADDRINUSE', 'EIO']) server.emit('error', Object.assign(new Error('隔离监听故障'), { code }));
        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('already in use'));
      });
      test('SIGTERM超时强制退出，SIGINT真实关闭服务', async () => {
        let timeout;
        const originalTimeout = global.setTimeout;
        const timer = jest.spyOn(global, 'setTimeout').mockImplementation((callback, delay, ...args) => {
          const handle = originalTimeout(callback, delay, ...args);
          if (delay === 10000) { timeout = { callback, handle }; handle.unref(); }
          return handle;
        });
        const close = jest.spyOn(server, 'close').mockImplementation(() => server);
        const ioClose = jest.spyOn(io, 'close').mockImplementation(() => {});
        handlers.SIGTERM(); timeout.callback(); clearTimeout(timeout.handle);
        expect(logger.error).toHaveBeenCalledWith('Forced shutdown after timeout'); expect(exitSpy).toHaveBeenCalledWith(1);
        close.mockRestore(); ioClose.mockRestore(); timer.mockRestore();
        const stopped = new Promise(resolve => exitSpy.mockImplementation(code => { if (code === 0) resolve(); }));
        handlers.SIGINT(); await stopped;
        expect(server.listening).toBe(false); expect(logger.info).toHaveBeenCalledWith('Server closed');
      });
    }
  });
};
