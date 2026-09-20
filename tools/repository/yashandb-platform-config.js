#!/usr/bin/env node
const path = require('path');
const { createDatabaseConnectionGovernance } = require('../../packages/agent-runner-core/lib/platform-management/database-connection-governance');
const { AGENT_RUNNER_RUNTIME_ROOT } = require('../../packages/agent-runner-core/lib/repo-paths');

const filePath = process.env.KNOWLEDGE_CENTER_DATABASE_CONNECTION_CONFIG
  ? path.resolve(process.env.KNOWLEDGE_CENTER_DATABASE_CONNECTION_CONFIG)
  : path.join(AGENT_RUNNER_RUNTIME_ROOT, 'knowledge-center', 'database-connection-config.json');
const governance = createDatabaseConnectionGovernance({ filePath });

function encoded(name, value) {
  return `${name}=${Buffer.from(String(value ?? ''), 'utf8').toString('base64')}`;
}

function resolve() {
  const config = governance.startupConfig();
  if (!config) return;
  process.stdout.write([
    encoded('YASDB_JDBC_URL', config.jdbcUrl),
    encoded('YASDB_USERNAME', config.username),
    encoded('YASDB_PASSWORD', config.password),
    encoded('KNOWLEDGE_CENTER_DATABASE_STARTUP_VERSION', config.version),
  ].join('\n'));
  process.stdout.write('\n');
}

function promote() {
  governance.promoteStartupConfig({
    version: process.env.KNOWLEDGE_CENTER_DATABASE_STARTUP_VERSION,
    jdbcUrl: process.env.YASDB_JDBC_URL,
    username: process.env.YASDB_USERNAME,
    password: process.env.YASDB_PASSWORD,
  });
}

try {
  const command = process.argv[2] || 'resolve';
  if (command === 'resolve') resolve();
  else if (command === 'promote') promote();
  else throw new Error(`不支持的命令：${command}`);
} catch (error) {
  process.stderr.write(`${error.message || '平台数据库配置处理失败'}\n`);
  process.exitCode = 1;
}
