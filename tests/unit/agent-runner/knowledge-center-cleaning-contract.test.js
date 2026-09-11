const { CLEANING_ENDPOINTS, matchCleaningEndpoint } = require('../../../packages/agent-runner-core/lib/knowledge-center-cleaning-contract');
const { validateCleaningResponse, ensureSuccessEnvelope } = require('../../../packages/agent-runner-core/lib/knowledge-center-runtime-contract');
const endpointMapping = require('../../../packages/platform-contracts/knowledge-center/v1/endpoint-mapping.json');
const openapi = require('../../../packages/platform-contracts/knowledge-center/v1/openapi.json');
const fs = require('fs');
const path = require('path');

function snakeToCamel(value) {
  return value.replace(/_([a-zA-Z0-9])/g, (_, letter) => letter.toUpperCase());
}

function normalizePythonPath(value) {
  return value.replace(/:([A-Za-z0-9_]+)/g, (_, name) => `:${snakeToCamel(name)}`);
}

function toOpenApiPath(value) {
  return value.replace(/:([A-Za-z0-9]+)/g, (_, name) => `{${name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}}`);
}

describe('知识中心资料加工契约适配层', () => {
  test('运行时白名单直接加载版本化端点契约', () => {
    expect(CLEANING_ENDPOINTS).toEqual(endpointMapping.endpoints.filter(endpoint => endpoint.expose !== false));
    expect(CLEANING_ENDPOINTS.length).toBeGreaterThan(100);
  });

  test('Python FastAPI 路由全部登记到版本化契约', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../../apps/pingcode-api/app/main.py'), 'utf8');
    const declared = new Set(endpointMapping.endpoints.map(endpoint => `${endpoint.method} ${endpoint.path}`));
    const pattern = /@app\.(get|post|put|patch|delete)\("([^"].*?)"/g;
    let match;
    let routeCount = 0;
    while ((match = pattern.exec(source))) {
      if (!match[2].startsWith('/api/')) continue;
      const method = match[1].toUpperCase();
      const routePath = normalizePythonPath(match[2].replace(/^\/api/, '').replace(/\{([^}]+)\}/g, ':$1'));
      routeCount += 1;
      expect(declared.has(`${method} ${routePath}`)).toBe(true);
    }
    expect(routeCount).toBeGreaterThan(100);
  });

  test('端点映射全部具备 FastAPI 字段级 OpenAPI 来源', () => {
    for (const endpoint of endpointMapping.endpoints) {
      const openapiPath = `/api${toOpenApiPath(endpoint.path)}`;
      expect(openapi.paths[openapiPath]).toBeTruthy();
      expect(openapi.paths[openapiPath][endpoint.method.toLowerCase()]).toBeTruthy();
    }
  });

  test('统一响应运行时校验保留成功与错误外壳', () => {
    expect(validateCleaningResponse({ success: true, requestId: 'r1', correlationId: 'c1', data: {} }, 200)).toEqual(expect.objectContaining({ success: true }));
    expect(validateCleaningResponse({ success: false, error: { code: 'VALIDATION_ERROR', message: '参数错误', retryable: false, requestId: 'r1' } }, 422)).toEqual(expect.objectContaining({ success: false }));
    expect(() => validateCleaningResponse({ success: true, requestId: 'r1', correlationId: 'c1' }, 200)).toThrow('必须包含 data 或 items');
  });

  test('兼容旧成功命令的顶层结果并补齐 data 外壳', () => {
    const normalized = ensureSuccessEnvelope({ success: true, requestId: 'r1', correlationId: 'c1', schemaPassed: true, message: '连接成功' });
    expect(normalized).toMatchObject({ success: true, data: { schemaPassed: true, message: '连接成功' } });
    expect(normalized.data).not.toHaveProperty('requestId');
  });

  test('覆盖上传、批次、加工、任务、文件和数据集发布核心路径', () => {
    const ids = new Set(CLEANING_ENDPOINTS.map(item => item.id));
    for (const id of [
      'upload-session-create', 'upload-chunk', 'upload-create-batch',
      'batch-create', 'preprocess-scan-task-create', 'preprocess-pipeline-start',
      'metadata-build', 'training-task-create', 'task-events', 'file-download',
      'keyword-filter-by-skill', 'graph-repair', 'dataset-publish'
    ]) expect(ids.has(id)).toBe(true);
  });

  test('写路径要求 knowledge:write 且幂等命令显式登记', () => {
    const writes = CLEANING_ENDPOINTS.filter(item => item.operation === 'command');
    expect(writes.length).toBeGreaterThan(5);
    expect(writes.every(item => item.action === 'knowledge:write')).toBe(true);
    expect(writes.filter(item => item.idempotency).length).toBeGreaterThan(3);
  });

  test('只匹配显式白名单，拒绝未知内部路径和方法', () => {
    expect(matchCleaningEndpoint('POST', '/knowledge-center/api/cleaning/upload-sessions')).toMatchObject({ id: 'upload-session-create' });
    expect(matchCleaningEndpoint('GET', '/knowledge-center/api/cleaning/tasks/task-1/events')).toMatchObject({ id: 'task-events' });
    expect(matchCleaningEndpoint('DELETE', '/knowledge-center/api/cleaning/datasets/ds-1')).toBeNull();
    expect(matchCleaningEndpoint('GET', '/knowledge-center/api/cleaning/internal/debug')).toBeNull();
  });
});
