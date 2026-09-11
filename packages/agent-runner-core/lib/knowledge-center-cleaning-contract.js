/**
 * 知识中心资料加工工作区的薄适配契约。
 *
 * 这里仅描述允许从统一入口转发的旧资料加工 API，不承载业务状态或数据写入。
 * 新增路径必须同时更新 packages/platform-contracts/knowledge-center/v1/endpoint-mapping.json，
 * 通过显式白名单避免网关意外暴露 Python 服务内部接口。
 */

const CLEANING_ROUTE_PREFIX = '/knowledge-center/api/cleaning';

const fs = require('fs');
const path = require('path');

const ENDPOINT_MAPPING_FILE = path.resolve(__dirname, '../../../packages/platform-contracts/knowledge-center/v1/endpoint-mapping.json');

function loadEndpointMapping() {
  const mapping = JSON.parse(fs.readFileSync(ENDPOINT_MAPPING_FILE, 'utf8'));
  if (!Array.isArray(mapping.endpoints) || mapping.endpoints.length === 0) {
    throw new Error('knowledge-center endpoint mapping must declare endpoints');
  }
  const ids = new Set();
  for (const endpoint of mapping.endpoints) {
    if (!endpoint || typeof endpoint.id !== 'string' || !/^[a-z0-9-]+$/.test(endpoint.id)) {
      throw new Error('knowledge-center endpoint mapping contains an invalid id');
    }
    if (ids.has(endpoint.id)) throw new Error(`knowledge-center endpoint mapping contains duplicate id: ${endpoint.id}`);
    ids.add(endpoint.id);
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(endpoint.method)) {
      throw new Error(`knowledge-center endpoint mapping contains an invalid method: ${endpoint.id}`);
    }
    if (typeof endpoint.path !== 'string' || !endpoint.path.startsWith('/')) {
      throw new Error(`knowledge-center endpoint mapping contains an invalid path: ${endpoint.id}`);
    }
    if (!['query', 'command', 'event-stream', 'download'].includes(endpoint.operation)) {
      throw new Error(`knowledge-center endpoint mapping contains an invalid operation: ${endpoint.id}`);
    }
    const expectedAction = endpoint.operation === 'command' ? 'knowledge:write' : 'knowledge:read';
    if (endpoint.action !== expectedAction) {
      throw new Error(`knowledge-center endpoint mapping contains an invalid action: ${endpoint.id}`);
    }
  }
  return Object.freeze(mapping.endpoints.filter(endpoint => endpoint.expose !== false).map(endpoint => Object.freeze({ ...endpoint })));
}

const CLEANING_ENDPOINTS = loadEndpointMapping();

function compilePath(template) {
  const escaped = template.split('/').map(part => part.startsWith(':') ? '[^/]+' : part.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('/');
  return new RegExp(`^${escaped}$`);
}

const COMPILED = CLEANING_ENDPOINTS.map(endpoint => ({ ...endpoint, regex: compilePath(endpoint.path) }));

function matchCleaningEndpoint(method, pathname) {
  const normalizedMethod = String(method || '').toUpperCase();
  const suffix = String(pathname || '').startsWith(CLEANING_ROUTE_PREFIX)
    ? String(pathname).slice(CLEANING_ROUTE_PREFIX.length) || '/workbench/summary'
    : String(pathname || '');
  return COMPILED.find(endpoint => endpoint.method === normalizedMethod && endpoint.regex.test(suffix)) || null;
}

module.exports = { CLEANING_ROUTE_PREFIX, CLEANING_ENDPOINTS, matchCleaningEndpoint };
