const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { createDatabaseConnectionGovernance } = require('../../../packages/agent-runner-core/lib/platform-management/database-connection-governance');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');

function fixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'database-governance-'));
  const calls = [];
  const probe = options.probe || (async connection => {
    calls.push(connection);
    return { status: 'success', message: '数据库连接可用', verifiedAt: new Date().toISOString(), latencyMs: 1 };
  });
  const governance = createDatabaseConnectionGovernance({
    filePath: path.join(root, 'database.json'),
    keySource: 'unit-test-key',
    env: options.env || {},
    probe,
  });
  return { root, calls, governance, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

describe('数据库连接治理', () => {
  test('未保存配置时不把示例地址当作有效连接', () => {
    const item = fixture();
    try {
      expect(item.governance.projection()).toMatchObject({ status: 'unconfigured', configured: false, connection: null });
    } finally { item.cleanup(); }
  });

  test('平台管理 API 返回待重启状态并传递管理员审计上下文', async () => {
    const item = fixture();
    const templatePath = path.join(item.root, 'template.xlsx');
    const samplePath = path.join(item.root, 'sample.xlsx');
    fs.writeFileSync(templatePath, 'template'); fs.writeFileSync(samplePath, 'sample');
    const handler = createKnowledgeCenterHandler({
      config: {
        KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: item.root, KNOWLEDGE_CENTER_ENTRY: 'index.html',
        OUTLINE_TEMPLATE_PATH: templatePath, OUTLINE_SAMPLE_PATH: samplePath,
        PINGCODE_PREFIX: '/pingcode', PINGCODE_ROOT: item.root,
      },
      stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [] }), write() {} }, brandIconStore: {}, domainStore: {} },
      moduleRegistry: { get: name => name === 'auth' ? { authorize: async () => ({ roles: ['PLATFORM_ADMIN'], user: { id: 'admin-1' } }) } : null },
      databaseConnectionGovernance: item.governance,
      sendFile() {}, proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
    });
    const server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const endpoint = `http://127.0.0.1:${server.address().port}/knowledge-center/api/platform/database-connection`;
      const saved = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'If-Match': '0' },
        body: JSON.stringify({ jdbcUrl: 'jdbc:yasdb://db.local:1688/yasdb', username: 'u', password: 'secret' }),
      });
      expect(saved.status).toBe(200);
      await expect(saved.json()).resolves.toMatchObject({ success: true, data: { status: 'pending_restart', restartRequired: true } });
      const stored = JSON.parse(fs.readFileSync(path.join(item.root, 'database.json'), 'utf8'));
      expect(stored.audits.at(-1)).toMatchObject({ actorId: 'admin-1', action: 'DATABASE_CONFIG_SAVED' });
      expect(JSON.stringify(stored)).not.toContain('secret');
    } finally {
      await new Promise(resolve => server.close(resolve));
      item.cleanup();
    }
  });

  test('使用完整凭据执行可注入的真实探测，新建配置不允许空密码', async () => {
    const item = fixture();
    try {
      await expect(item.governance.test({ jdbcUrl: 'jdbc:yasdb://db.local:1688/yasdb', username: 'u' })).rejects.toMatchObject({ code: 'DATABASE_PASSWORD_REQUIRED', status: 422 });
      await item.governance.test({ jdbcUrl: 'jdbc:yasdb://db.local:1688/yasdb', username: 'u', password: 'secret' });
      expect(item.calls[0]).toMatchObject({ jdbcUrl: 'jdbc:yasdb://db.local:1688/yasdb', username: 'u', password: 'secret' });
    } finally { item.cleanup(); }
  });

  test('JDBC 连接串是地址、端口和数据库名的唯一输入来源', async () => {
    const item = fixture();
    try {
      const saved = await item.governance.save({
        jdbcUrl: 'jdbc:yasdb://old.local:1688/old', host: 'new.local', port: '2688', database: 'newdb', username: 'u', password: 'secret',
      }, 0, { actorId: 'admin' });
      expect(item.calls[0]).toMatchObject({ jdbcUrl: 'jdbc:yasdb://old.local:1688/old', host: 'old.local', port: 1688, database: 'old' });
      expect(saved).toMatchObject({ status: 'pending_restart', restartRequired: true, connection: { jdbcUrl: 'jdbc:yasdb://old.local:1688/old', host: 'old.local', port: 1688, database: 'old' } });
    } finally { item.cleanup(); }
  });

  test('保存后保持待重启，只有启动健康后才标记已连接', async () => {
    const item = fixture();
    try {
      const saved = await item.governance.save({ jdbcUrl: 'jdbc:yasdb://db.local:1688/yasdb', username: 'u', password: 'secret' }, 0);
      expect(saved.status).toBe('pending_restart');
      const startup = item.governance.startupConfig();
      expect(startup).toMatchObject({ version: 1, password: 'secret' });
      const promoted = item.governance.promoteStartupConfig(startup);
      expect(promoted).toMatchObject({ status: 'connected', restartRequired: false, effectiveVersion: 1, pendingVersion: null });
    } finally { item.cleanup(); }
  });

  test('统一环境加载器在无部署覆盖时读取并解密待生效配置', async () => {
    const item = fixture();
    try {
      await item.governance.save({ jdbcUrl: 'jdbc:yasdb://platform.local:2688/platformdb', username: 'platform-user', password: 'platform-secret' }, 0);
      const configRoot = path.join(item.root, 'fallback');
      fs.mkdirSync(configRoot);
      fs.writeFileSync(path.join(configRoot, 'service.env'), 'YASDB_JDBC_URL=jdbc:yasdb://fallback.local:1688/fallback\nYASDB_USERNAME=fallback-user\n');
      const repositoryRoot = path.resolve(__dirname, '../../..');
      const output = execFileSync('bash', ['-c', 'set -euo pipefail; source "$REPO_ROOT/tools/repository/load-yashandb-env.sh"; printf "%s|%s|%s|%s|%s" "$KNOWLEDGE_CENTER_DATABASE_CONFIG_SOURCE" "$YASDB_JDBC_URL" "$YASDB_USERNAME" "$YASDB_PASSWORD" "$KNOWLEDGE_CENTER_DATABASE_STARTUP_VERSION"'], {
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH,
          REPO_ROOT: repositoryRoot,
          YASDB_CONFIG_DIR: configRoot,
          KNOWLEDGE_CENTER_DATABASE_CONNECTION_CONFIG: path.join(item.root, 'database.json'),
          KNOWLEDGE_CENTER_DATABASE_CONFIG_KEY: 'unit-test-key',
        },
      });
      expect(output).toBe('platform|jdbc:yasdb://platform.local:2688/platformdb|platform-user|platform-secret|1');
    } finally { item.cleanup(); }
  });

  test('service.env 中的完整连接优先于无法解密的平台待生效记录', () => {
    const item = fixture();
    try {
      const configRoot = path.join(item.root, 'deployment');
      fs.mkdirSync(configRoot);
      fs.writeFileSync(path.join(configRoot, 'service.env'), 'YASDB_JDBC_URL=jdbc:yasdb://deployment.local:1688/yasdb\nYASDB_USERNAME=deployment-user\nYASDB_PASSWORD=deployment-secret\n');
      fs.writeFileSync(path.join(item.root, 'database.json'), JSON.stringify({
        version: 1,
        pending: { version: 1, jdbcUrl: 'jdbc:yasdb://platform.local:2688/platformdb', username: 'platform-user' },
      }));
      const repositoryRoot = path.resolve(__dirname, '../../..');
      const output = execFileSync('bash', ['-c', 'set -euo pipefail; source "$REPO_ROOT/tools/repository/load-yashandb-env.sh"; printf "%s|%s|%s|%s" "$KNOWLEDGE_CENTER_DATABASE_CONFIG_SOURCE" "$YASDB_JDBC_URL" "$YASDB_USERNAME" "$YASDB_PASSWORD"'], {
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH,
          REPO_ROOT: repositoryRoot,
          YASDB_CONFIG_DIR: configRoot,
          KNOWLEDGE_CENTER_DATABASE_CONNECTION_CONFIG: path.join(item.root, 'database.json'),
          KNOWLEDGE_CENTER_DATABASE_CONFIG_KEY: 'unit-test-key',
        },
      });
      expect(output).toBe('deployment|jdbc:yasdb://deployment.local:1688/yasdb|deployment-user|deployment-secret');
    } finally { item.cleanup(); }
  });

  test('外部部署配置优先并明确标记平台配置被覆盖', async () => {
    const item = fixture({ env: {
      YASDB_JDBC_URL: 'jdbc:yasdb://deployment.local:1688/yasdb',
      YASDB_USERNAME: 'deployment-user',
      YASDB_PASSWORD: 'deployment-secret',
      KNOWLEDGE_CENTER_DATABASE_CONFIG_SOURCE: 'environment',
    } });
    try {
      const saved = await item.governance.save({ jdbcUrl: 'jdbc:yasdb://platform.local:2688/platformdb', username: 'platform-user', password: 'platform-secret' }, 0);
      expect(saved).toMatchObject({ status: 'overridden', environmentOverride: true, effectiveSource: 'environment', restartRequired: true });
      expect(saved.effectiveConnection).toMatchObject({ jdbcUrl: 'jdbc:yasdb://deployment.local:1688/yasdb', username: 'deployment-user' });
      expect(saved.connection).toMatchObject({ jdbcUrl: 'jdbc:yasdb://platform.local:2688/platformdb', username: 'platform-user' });
    } finally { item.cleanup(); }
  });

  test('相同版本的并发保存只有一个成功', async () => {
    let release;
    const barrier = new Promise(resolve => { release = resolve; });
    let probes = 0;
    const item = fixture({ probe: async () => {
      probes += 1;
      if (probes === 2) release();
      await barrier;
      return { status: 'success', verifiedAt: new Date().toISOString(), latencyMs: 1 };
    } });
    try {
      const payload = name => ({ name, jdbcUrl: 'jdbc:yasdb://db.local:1688/yasdb', username: 'u', password: 'secret' });
      const results = await Promise.allSettled([item.governance.save(payload('first'), 0), item.governance.save(payload('second'), 0)]);
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find(result => result.status === 'rejected');
      expect(rejected.reason).toMatchObject({ code: 'DATABASE_CONFIG_CONFLICT', status: 409 });
    } finally { item.cleanup(); }
  });
});
