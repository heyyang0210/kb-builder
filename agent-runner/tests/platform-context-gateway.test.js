const http = require('http');
const { aggregateContexts, fetchJson, isContext, loadPlatformContext, loadPlatformProjection } = require('../lib/platform-context-gateway');

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

  test('平台只读投影聚合事实摘要并标记降级分区', async () => {
    const values = {
      documents: { ok: true, value: { success: true, data: { total_documents: 12, root_count: 2 } } },
      workbench: { ok: true, value: { counts: { all: 9, running: 2, failed: 1 } } },
      materialBatches: { ok: false, error: { code: 'MODULE_TIMEOUT', message: '超时', retryable: true } },
      datasets: { ok: true, value: { items: [{ id: 'dataset-1' }], total: 1 } },
      knowledgeIndex: { ok: true, value: { knowledgePoints: 33, indexed: 30 } },
      outlines: { ok: true, value: { success: true, data: [{ id: 'outline-1', name: '数据库手册', productId: 'yashandb', businessVersionTags: ['23.4.5.100'], outlineStructureVersion: 'outline-v12', state: 'published', nodeCount: 9, knowledgePointCount: 4 }] } }
    };
    const result = await loadPlatformProjection({
      fetcher: async target => values[target.name],
      targets: Object.fromEntries(Object.keys(values).map(name => [name, { name }]))
    });
    expect(result.statusCode).toBe(200);
    expect(result.body.status).toBe('degraded');
    expect(result.body.source).toBe('read-only-projection');
    expect(result.body.sections.documents.data.total).toBe(12);
    expect(result.body.sections.outlines.data.items[0]).toMatchObject({ id: 'outline-1', productId: 'yashandb', outlineStructureVersion: 'outline-v12' });
    expect(result.body.sections.materialBatches.error.code).toBe('MODULE_TIMEOUT');
    expect(result.body.asOf).toEqual(expect.any(String));
  });

  test('全部事实投影不可用时返回 503', async () => {
    const result = await loadPlatformProjection({
      fetcher: async () => ({ ok: false, error: { code: 'MODULE_UNAVAILABLE', message: '不可用' } }),
      targets: { documents: {}, workbench: {} }
    });
    expect(result.statusCode).toBe(503);
    expect(result.body.status).toBe('unavailable');
  });

  test('上游未提供统计字段时不将缺失值改写为零', async () => {
    const result = await loadPlatformProjection({
      fetcher: async target => ({ ok: true, value: target.name === 'documents' ? { data: {} } : {} }),
      targets: { documents: { name: 'documents' }, workbench: { name: 'workbench' }, knowledgeIndex: { name: 'knowledgeIndex' } }
    });
    expect(result.body.sections.documents.data).toEqual({});
    expect(result.body.sections.workbench.data.counts).toEqual({});
    expect(result.body.sections.knowledgeIndex.data).toEqual({});
  });
});
