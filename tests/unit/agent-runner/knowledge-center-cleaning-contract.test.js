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
      // PingCode reference is a separate service contract, covered by its dedicated tests.
      if (match[2].startsWith('/api/pingcode/')) continue;
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

  const validEndpoint = { id: 'fixture-read', method: 'GET', path: '/fixture/:id', operation: 'query', action: 'knowledge:read' };

  function loadMapping(mapping) {
    const readFile = fs.readFileSync;
    const mappingPath = path.resolve(__dirname, '../../../packages/platform-contracts/knowledge-center/v1/endpoint-mapping.json');
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) =>
      String(file) === mappingPath ? JSON.stringify(mapping) : readFile.call(fs, file, ...args));
    let contract;
    try {
      jest.isolateModules(() => {
        contract = require('../../../packages/agent-runner-core/lib/knowledge-center-cleaning-contract');
      });
      return contract;
    } finally {
      spy.mockRestore();
    }
  }

  test.each([
    ['缺失端点', {}, 'must declare endpoints'],
    ['非数组端点', { endpoints: {} }, 'must declare endpoints'],
    ['空端点', { endpoints: [] }, 'must declare endpoints'],
    ['空声明', { endpoints: [null] }, 'invalid id'],
    ['非字符串标识', { endpoints: [{ ...validEndpoint, id: 1 }] }, 'invalid id'],
    ['非法标识', { endpoints: [{ ...validEndpoint, id: 'Bad_ID' }] }, 'invalid id'],
    ['重复标识', { endpoints: [validEndpoint, validEndpoint] }, 'duplicate id: fixture-read'],
    ['非法方法', { endpoints: [{ ...validEndpoint, method: 'TRACE' }] }, 'invalid method'],
    ['非字符串路径', { endpoints: [{ ...validEndpoint, path: null }] }, 'invalid path'],
    ['相对路径', { endpoints: [{ ...validEndpoint, path: 'fixture' }] }, 'invalid path'],
    ['非法操作', { endpoints: [{ ...validEndpoint, operation: 'internal' }] }, 'invalid operation'],
    ['读取误配写权限', { endpoints: [{ ...validEndpoint, action: 'knowledge:write' }] }, 'invalid action'],
    ['命令误配读权限', { endpoints: [{ ...validEndpoint, operation: 'command' }] }, 'invalid action']
  ])('拒绝无效契约：%s', (_name, mapping, message) => {
    expect(() => loadMapping(mapping)).toThrow(message);
  });

  test('隐藏端点不暴露，公开声明冻结且参数只匹配单个路径片段', () => {
    const contract = loadMapping({ endpoints: [validEndpoint, { ...validEndpoint, id: 'fixture-hidden', path: '/private', expose: false }] });
    expect(contract.CLEANING_ENDPOINTS).toEqual([validEndpoint]);
    expect(Object.isFrozen(contract.CLEANING_ENDPOINTS)).toBe(true);
    expect(Object.isFrozen(contract.CLEANING_ENDPOINTS[0])).toBe(true);
    expect(contract.matchCleaningEndpoint('get', '/fixture/doc-1')).toMatchObject(validEndpoint);
    expect(contract.matchCleaningEndpoint('GET', '/fixture/doc-1/child')).toBeNull();
    expect(contract.matchCleaningEndpoint('GET', '/private')).toBeNull();
    expect(contract.matchCleaningEndpoint(null, null)).toBeNull();
    expect(contract.matchCleaningEndpoint('GET', '/knowledge-center/api/cleaning/fixture/doc-1')).toMatchObject(validEndpoint);
  });

  test('网关根路径默认指向工作台总览，空路径不匹配', () => {
    expect(matchCleaningEndpoint('get', '/knowledge-center/api/cleaning')).toMatchObject({ path: '/workbench/summary' });
    expect(matchCleaningEndpoint('GET')).toBeNull();
  });
});
