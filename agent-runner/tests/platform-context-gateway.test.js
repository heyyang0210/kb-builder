const http = require('http');
const { aggregateContexts, fetchJson, isContext, loadPlatformContext } = require('../lib/platform-context-gateway');

const fingerprint = suffix => `sha256:${suffix.repeat(64).slice(0, 64)}`;
const context = value => ({
  schemaVersion: 'enterprise-profile/v1',
  profileId: 'yashandb',
  enterpriseId: 'yashandb',
  displayName: 'YashanDB',
  brand: { platformName: '知识中心建设平台' },
  capabilities: ['document-generation'],
  workspaces: [],
  connectors: [],
  configFingerprint: value
});
const ok = fingerprint => ({ ok: true, context: context(fingerprint) });
const failed = code => ({ ok: false, error: { code, message: '模块不可用', retryable: true } });

describe('平台运行上下文网关', () => {
  test('双模块指纹一致时返回正常状态', () => {
    const result = aggregateContexts(ok(fingerprint('a')), ok(fingerprint('a')));
    expect(result.statusCode).toBe(200);
    expect(result.body.status).toBe('ok');
    expect(result.body.errors).toEqual([]);
  });

  test('单模块失败时保留可用投影并降级', () => {
    const result = aggregateContexts(ok(fingerprint('a')), failed('MODULE_UNAVAILABLE'));
    expect(result.statusCode).toBe(200);
    expect(result.body.status).toBe('degraded');
    expect(result.body.context.configFingerprint).toBe(fingerprint('a'));
    expect(result.body.modules.materialProcessing.error.code).toBe('MODULE_UNAVAILABLE');
  });

  test('双模块失败时返回 503', () => {
    const result = aggregateContexts(failed('MODULE_UNAVAILABLE'), failed('MODULE_TIMEOUT'));
    expect(result.statusCode).toBe(503);
    expect(result.body.status).toBe('unavailable');
    expect(result.body.errors.map(item => item.code)).toEqual(['MODULE_UNAVAILABLE', 'MODULE_TIMEOUT']);
  });

  test('指纹不一致时不改写模块原始指纹', () => {
    const result = aggregateContexts(ok(fingerprint('a')), ok(fingerprint('b')));
    expect(result.body.status).toBe('degraded');
    expect(result.body.errors[0].code).toBe('PROFILE_FINGERPRINT_MISMATCH');
    expect(result.body.modules.documentGeneration.context.configFingerprint).toBe(fingerprint('a'));
    expect(result.body.modules.materialProcessing.context.configFingerprint).toBe(fingerprint('b'));
  });

  test('并行请求使用受控超时并传递模块地址', async () => {
    const calls = [];
    const result = await loadPlatformContext({
      timeoutMs: 321,
      documentGeneration: { port: 4100 },
      materialProcessing: { port: 8001 },
      fetcher: async (target, timeoutMs) => {
        calls.push([target.port, timeoutMs]);
        return ok(fingerprint('a'));
      }
    });
    expect(result.body.status).toBe('ok');
    expect(calls).toEqual(expect.arrayContaining([[4100, 321], [8001, 321]]));
  });

  test('公开响应不含敏感字段或绝对路径', () => {
    const serialized = JSON.stringify(aggregateContexts(ok(fingerprint('a')), ok(fingerprint('a'))).body);
    expect(serialized).not.toMatch(/password|token|secret:|\/data\/|\/home\//i);
  });

  test('缺少基本指纹的投影不视为可用上下文', () => {
    expect(isContext({ profileId: 'yashandb' })).toBe(false);
    expect(isContext(context(fingerprint('a')))).toBe(true);
  });

  test('HTTP 500 和无效 JSON 统一转为模块不可用', async () => {
    const server = http.createServer((request, response) => {
      response.writeHead(request.url === '/invalid' ? 200 : 500);
      response.end(request.url === '/invalid' ? '{' : '{}');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const [failedStatus, invalidJson] = await Promise.all([
      fetchJson({ hostname: '127.0.0.1', port, path: '/failed' }),
      fetchJson({ hostname: '127.0.0.1', port, path: '/invalid' })
    ]);
    server.close();
    expect(failedStatus.error.code).toBe('MODULE_UNAVAILABLE');
    expect(invalidJson.error.code).toBe('MODULE_UNAVAILABLE');
  });

  test('超时请求返回 MODULE_TIMEOUT 并关闭连接', async () => {
    const server = http.createServer(() => {});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const result = await fetchJson({ hostname: '127.0.0.1', port: server.address().port, path: '/' }, 20);
    server.close();
    expect(result.error.code).toBe('MODULE_TIMEOUT');
  });
});
