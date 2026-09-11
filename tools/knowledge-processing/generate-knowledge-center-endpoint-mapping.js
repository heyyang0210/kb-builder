#!/usr/bin/env node

/**
 * 从 Python 资料加工服务的 FastAPI 装饰器生成知识中心端点登记。
 * 只生成契约文件，不修改旧 API；删除类端点默认登记但不暴露到统一入口。
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const pythonFile = path.join(root, 'apps/pingcode-api/app/main.py');
const mappingFile = path.join(root, 'packages/platform-contracts/knowledge-center/v1/endpoint-mapping.json');

function snakeToCamel(value) {
  return value.replace(/_([a-zA-Z0-9])/g, (_, letter) => letter.toUpperCase());
}

function normalizePath(value) {
  return value.replace(/:([A-Za-z0-9_]+)/g, (_, name) => `:${snakeToCamel(name)}`);
}

function classify(method, routePath) {
  if (method !== 'GET') return 'command';
  if (/(events|stream)/.test(routePath)) return 'event-stream';
  if (/\/(preview|content|download)(?:$|\/)/.test(routePath)) return 'download';
  return 'query';
}

function shouldBeIdempotent(routePath) {
  return /(create|complete|publish|pipeline|task|batch|session|filter|formal|scan|build|repair|apply|upload|prepare|preview|cancel|resume|retry|pause|decision|mapping|model|rule)/i.test(routePath);
}

function parseRoutes(source) {
  const result = [];
  const pattern = /@app\.(get|post|put|patch|delete)\("([^"].*?)"/g;
  let match;
  while ((match = pattern.exec(source))) {
    if (!match[2].startsWith('/api/')) continue;
    const method = match[1].toUpperCase();
    const routePath = normalizePath(match[2].replace(/^\/api/, '').replace(/\{([^}]+)\}/g, ':$1'));
    const operation = classify(method, routePath);
    const id = `${method.toLowerCase()}-${routePath.replace(/^\//, '').replace(/[:]+/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/, '')}`.toLowerCase();
    const endpoint = {
      id,
      method,
      path: routePath,
      operation,
      action: operation === 'command' ? 'knowledge:write' : 'knowledge:read'
    };
    if (operation === 'command' && shouldBeIdempotent(routePath)) endpoint.idempotency = true;
    if (method === 'DELETE') endpoint.expose = false;
    result.push(endpoint);
  }
  return result;
}

const existing = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
const routes = parseRoutes(fs.readFileSync(pythonFile, 'utf8'));
const byKey = new Map(existing.endpoints.map(endpoint => [`${endpoint.method} ${endpoint.path}`, endpoint]));
for (const endpoint of routes) {
  if (!byKey.has(`${endpoint.method} ${endpoint.path}`)) byKey.set(`${endpoint.method} ${endpoint.path}`, endpoint);
}
existing.endpoints = [...byKey.values()];
fs.writeFileSync(mappingFile, `${JSON.stringify(existing, null, 2)}\n`);
process.stdout.write(`已登记 ${existing.endpoints.length} 个 Python API 端点，运行时暴露 ${existing.endpoints.filter(endpoint => endpoint.expose !== false).length} 个。\n`);
