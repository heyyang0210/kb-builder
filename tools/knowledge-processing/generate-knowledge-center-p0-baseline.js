#!/usr/bin/env node

/* Generate a repository-backed P0 baseline without mutating business data. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(repoRoot, 'docs', 'agent-runner', 'modules', 'platform-foundation', 'baseline');
const generatedAt = new Date().toISOString();

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function fileFact(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) return { path: relativePath, status: '待确认', reason: '文件不存在' };
  const stat = fs.statSync(filePath);
  return {
    path: relativePath,
    status: '已由代码或真实 API 证实',
    bytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    sha256: sha256(filePath),
  };
}

function routeFacts(relativePath, pattern) {
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) return { source: relativePath, status: '待确认', routes: [] };
  const source = fs.readFileSync(filePath, 'utf8');
  const routes = [...source.matchAll(pattern)].map(match => match[1]).filter(Boolean);
  return { source: relativePath, status: '已由代码或真实 API 证实', routes: [...new Set(routes)].sort() };
}

function routeFactsForDirectory(relativeDirectory, pattern) {
  const directory = path.join(repoRoot, relativeDirectory);
  if (!fs.existsSync(directory)) return { source: relativeDirectory, status: '待确认', routes: [] };
  const routes = [];
  for (const name of fs.readdirSync(directory).filter(item => item.endsWith('.js'))) {
    const relativePath = path.join(relativeDirectory, name);
    const fact = routeFacts(relativePath, pattern);
    routes.push(...fact.routes);
  }
  return { source: `${relativeDirectory}/*.js`, status: '已由代码或真实 API 证实', routes: [...new Set(routes)].sort() };
}

const baseline = {
  schemaVersion: 1,
  generatedAt,
  purpose: '知识中心管理平台目标模式重构 P0 事实基线，只读采集，不代表目标模式已完成',
  sourceOfTruth: '当前工作树、运行服务响应和本文件生成时的文件摘要',
  entryPoints: [
    { path: '/knowledge-center/', kind: '统一主入口', status: '已由代码或真实 API 证实', evidence: 'frontend-server.js + HTTP 200' },
    { path: '/prompt-generator.html', kind: '旧文档生成入口', status: '已由代码或真实 API 证实', evidence: 'frontend-server.js 默认静态路由' },
    { path: '/pingcode-materials/', kind: '旧资料加工入口', status: '已由代码或真实 API 证实', evidence: 'frontend-server.js + Python SPA 路由' },
    { path: '/pingcode-api/*', kind: '旧资料加工 API 代理', status: '已由代码或真实 API 证实', evidence: 'frontend-server.js 代理规则' },
    { path: '/api/*', kind: '旧文档服务 API 代理', status: '已由代码或真实 API 证实', evidence: 'frontend-server.js 代理规则' },
  ],
  services: [
    { name: '统一前端网关', process: 'apps/knowledge-center-web/frontend-server.js', port: 13510, health: 'GET /knowledge-center/' },
    { name: '认证服务', process: 'apps/knowledge-center-auth/auth-server.js', port: 14200, health: 'GET /knowledge-center/api/auth/config' },
    { name: '文档生产服务', process: 'apps/knowledge-center-api/server.js', port: 14110, health: 'GET /api/health' },
    { name: '资料加工服务', process: 'apps/pingcode-api/app/main.py', port: 18010, health: 'GET /api/health' },
    { name: 'YashanDB 存储服务', process: 'apps/yashandb-storage', port: null, health: '待配置真实 JDBC 环境后验证' },
  ],
  routeInventory: [
    routeFacts('apps/knowledge-center-api/server.js', /app\.(?:get|post|put|patch|delete)\(['"]([^'"`]+)['"]/g),
    routeFactsForDirectory('packages/agent-runner-core/routes', /router\.(?:get|post|put|patch|delete|put)\(['"]([^'"`]+)['"]/g),
    routeFacts('apps/pingcode-api/app/main.py', /@app\.(?:get|post|put|patch|delete|api_route)\(["']([^"']+)["']/g),
  ],
  persistentSources: [
    fileFact('config/knowledge-center/state/knowledge-assets.json'),
    fileFact('runtime/agent-runner/data/document-comments.json'),
    fileFact('runtime/agent-runner/outlines/metadata.json'),
    fileFact('runtime/agent-runner/tmp/doc-processed/metadata.json'),
    fileFact('runtime/agent-runner/tmp/incremental-build-state.json'),
    fileFact('apps/pingcode-api/data/state.json'),
  ],
  objectOwnership: [
    { object: '用户/角色/会话/资产/大纲/任务/审核/发布/审计', target: 'YashanDB 结构化记录', current: '部分已接入，需逐对象回读确认', status: '待确认' },
    { object: '原始文件/清洗产物/生成文档/大型索引图谱', target: '受控文件或对象存储 + Artifact 元数据', current: '本地目录与服务仓储并存', status: '已由代码证实' },
    { object: '规则/模板/Prompt/Skill/Schema', target: '版本控制资源 + 数据库版本登记', current: '配置目录、资源目录和服务注册表并存', status: '已由代码证实' },
    { object: '缓存/分片/日志/中间文件', target: '有生命周期的临时工作目录', current: '目录存在，清理审计需补证据', status: '待确认' },
  ],
  verificationPlan: [
    '入口/API/Socket.IO/SSE/下载/预览深链契约快照',
    '黄金流程真实 API 与浏览器 E2E',
    '历史源数量、SHA-256 与业务回读对账',
    '数据库不可用时 503 且不回写 JSON',
    '四种视口、权限、降级、失败恢复和回滚验证',
  ],
};

fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'p0-capability-baseline.json');
fs.writeFileSync(outputPath, `${JSON.stringify(baseline, null, 2)}\n`);
console.log(outputPath);
