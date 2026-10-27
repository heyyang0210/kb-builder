const { createYashanDBQualityAdapter, isolatedQualityDatabaseConfigured } = require('../../../packages/agent-runner-core/lib/yashandb-quality-adapter');
const http = require('http');

test('质量库必须显式配置且与业务 JDBC 地址不同；版本取自质量执行响应', async () => {
  const base = { YASDB_JDBC_URL: 'jdbc:yasdb://business:1688/main', YASDB_QUALITY_USERNAME: 'quality_reader', YASDB_QUALITY_PASSWORD: 'secret' };
  expect(isolatedQualityDatabaseConfigured(base)).toBe(false);
  expect(isolatedQualityDatabaseConfigured({ ...base, YASDB_QUALITY_JDBC_URL: base.YASDB_JDBC_URL })).toBe(false);
  expect(isolatedQualityDatabaseConfigured({ ...base, YASDB_QUALITY_JDBC_URL: 'jdbc:yasdb://test:1688/cases' })).toBe(true);
  const request = jest.fn(async () => ({ columns: ['C1'], rows: [{ C1: 1 }], truncated: false, databaseVersion: 'isolated-test-version' }));
  const adapter = createYashanDBQualityAdapter({ store: { request, health: () => { throw new Error('business health must not be read'); } }, environment: '隔离测试库' });
  expect(await adapter.execute('SELECT 1 FROM DUAL')).toEqual({ columns: ['C1'], rows: [{ C1: 1 }], truncated: false });
  expect(adapter.version).toBe('isolated-test-version');
  expect(adapter.environment).toBe('隔离测试库');
  expect(request).toHaveBeenCalledWith('POST', '/v1/quality/execute', { sql: 'SELECT 1 FROM DUAL', testRunId: undefined });
});

test('隔离配置拒绝缺少凭据和空白地址，允许独立库且不要求业务库地址', () => {
  const quality = { YASDB_QUALITY_JDBC_URL: ' jdbc:fixture:quality ', YASDB_QUALITY_USERNAME: ' reader ', YASDB_QUALITY_PASSWORD: ' secret ' };
  expect(isolatedQualityDatabaseConfigured(quality)).toBe(true);
  expect(isolatedQualityDatabaseConfigured({ ...quality, YASDB_JDBC_URL: ' jdbc:fixture:quality ' })).toBe(false);
  for (const key of ['YASDB_QUALITY_JDBC_URL', 'YASDB_QUALITY_USERNAME', 'YASDB_QUALITY_PASSWORD']) {
    expect(isolatedQualityDatabaseConfigured({ ...quality, [key]: '   ' })).toBe(false);
    expect(isolatedQualityDatabaseConfigured({ ...quality, [key]: undefined })).toBe(false);
  }
});

test('质量适配器使用真实本地 HTTP 请求，处理空结果并保留最近数据库版本', async () => {
  const requests = [];
  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      requests.push({ method: request.method, url: request.url, body: JSON.parse(body) });
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(requests.length === 1
        ? { columns: ['C1'], rows: [{ C1: 1 }], databaseVersion: 'quality-v1' }
        : {}));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const adapter = createYashanDBQualityAdapter({ baseUrl: `http://127.0.0.1:${server.address().port}` });
    expect(adapter.version).toBeNull();
    expect(adapter.environment).toBe('独立 YashanDB 测试库');
    expect(await adapter.execute('SELECT 1', { testRunId: 'run-1' })).toEqual({ columns: ['C1'], rows: [{ C1: 1 }], truncated: false });
    expect(await adapter.execute('SELECT 2')).toEqual({ columns: [], rows: [], truncated: false });
    expect(adapter.version).toBe('quality-v1');
    expect(requests).toEqual([
      { method: 'POST', url: '/v1/quality/execute', body: { sql: 'SELECT 1', testRunId: 'run-1' } },
      { method: 'POST', url: '/v1/quality/execute', body: { sql: 'SELECT 2' } },
    ]);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
