const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { createDatabaseConnectionGovernance } = require('../../../packages/agent-runner-core/lib/platform-management/database-connection-governance');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');

function fixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'database-governance-'));
  const filePath = path.join(root, 'service.env');
  const calls = [];
  const probe = options.probe || (async connection => { calls.push(connection); return { status: 'success', message: '数据库连接可用', verifiedAt: new Date().toISOString(), latencyMs: 1 }; });
  const governance = createDatabaseConnectionGovernance({ filePath, env: options.env || {}, probe, autoStartHealthMonitor: options.autoStartHealthMonitor ?? false, healthCheckIntervalMs: options.healthCheckIntervalMs });
  return { root, filePath, calls, governance, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}

describe('数据库连接治理', () => {
  test('未配置 service.env 时返回未配置', () => {
    const item = fixture();
    try { expect(item.governance.projection()).toMatchObject({ status: 'unconfigured', configured: false, connection: null }); } finally { item.cleanup(); }
  });

  test('验证成功后原子更新唯一 service.env，保留其他配置且不泄露密码', async () => {
    const item = fixture();
    try {
      fs.writeFileSync(item.filePath, '# managed\nYASDB_STORAGE_URL=http://127.0.0.1:14210\nYASDB_JDBC_URL=jdbc:yasdb://old.local:1688/old\nYASDB_USERNAME=old-user\nYASDB_PASSWORD=old-secret\n');
      const saved = await item.governance.save({ jdbcUrl: 'jdbc:yasdb://new.local:1688/newdb', username: 'new-user', password: 'new-secret' }, item.governance.projection().rowVersion);
      const text = fs.readFileSync(item.filePath, 'utf8');
      expect(text).toContain('YASDB_STORAGE_URL=http://127.0.0.1:14210');
      expect(text).toContain('YASDB_JDBC_URL="jdbc:yasdb://new.local:1688/newdb"');
      expect(text).toContain('YASDB_USERNAME="new-user"');
      expect(text).toContain('YASDB_PASSWORD="new-secret"');
      expect(saved).toMatchObject({ status: 'verified', configured: true, lastVerification: { status: 'success' } });
      expect(JSON.stringify(saved)).not.toContain('new-secret');
    } finally { item.cleanup(); }
  });

  test('留空密码时沿用 service.env 中的密码', async () => {
    const item = fixture();
    try {
      fs.writeFileSync(item.filePath, 'YASDB_JDBC_URL=jdbc:yasdb://old.local:1688/old\nYASDB_USERNAME=old-user\nYASDB_PASSWORD=old-secret\n');
      await item.governance.save({ jdbcUrl: 'jdbc:yasdb://new.local:1688/newdb', username: 'new-user' }, item.governance.projection().rowVersion);
      expect(item.calls.at(-1)).toMatchObject({ password: 'old-secret' });
    } finally { item.cleanup(); }
  });

  test('包含引号和反斜杠的密码可被 Node 与 Shell 往返读取', async () => {
    const item = fixture();
    const password = 'pa\'ss\\word';
    try {
      fs.writeFileSync(item.filePath, 'YASDB_JDBC_URL=jdbc:yasdb://old.local:1688/old\nYASDB_USERNAME=old-user\nYASDB_PASSWORD=old-secret\n');
      await item.governance.save({ jdbcUrl: 'jdbc:yasdb://new.local:1688/newdb', username: 'new-user', password }, item.governance.projection().rowVersion);
      expect(item.governance.startupConfig().password).toBe(password);
      const repositoryRoot = path.resolve(__dirname, '../../..');
      const shellPassword = execFileSync('bash', ['-c', 'set -euo pipefail; source "$REPO_ROOT/tools/repository/load-yashandb-env.sh"; printf %s "$YASDB_PASSWORD"'], {
        encoding: 'utf8',
        env: { PATH: process.env.PATH, REPO_ROOT: repositoryRoot, YASDB_CONFIG_DIR: item.root },
      });
      expect(shellPassword).toBe(password);
    } finally { item.cleanup(); }
  });

  test('未经运行健康验证的已配置连接不标记为已连接', () => {
    const item = fixture({ env: { YASDB_JDBC_URL: 'jdbc:yasdb://db.local:1688/yasdb', YASDB_USERNAME: 'u', YASDB_PASSWORD: 'wrong' } });
    try {
      fs.writeFileSync(item.filePath, 'YASDB_JDBC_URL=jdbc:yasdb://db.local:1688/yasdb\nYASDB_USERNAME=u\nYASDB_PASSWORD=wrong\n');
      expect(item.governance.projection()).toMatchObject({ status: 'configured', configured: true, lastVerification: null });
    } finally { item.cleanup(); }
  });

  test('健康状态接口独立探测运行连接并返回健康状态', async () => {
    const item = fixture({ env: { YASDB_JDBC_URL: 'jdbc:yasdb://db.local:1688/yasdb', YASDB_USERNAME: 'u', YASDB_PASSWORD: 'secret' } });
    try {
      fs.writeFileSync(item.filePath, 'YASDB_JDBC_URL=jdbc:yasdb://db.local:1688/yasdb\nYASDB_USERNAME=u\nYASDB_PASSWORD=secret\n');
      const result = await item.governance.health();
      expect(result).toMatchObject({ healthStatus: 'healthy', healthError: null });
      expect(item.calls.at(-1)).toMatchObject({ jdbcUrl: 'jdbc:yasdb://db.local:1688/yasdb', username: 'u', password: 'secret' });
    } finally { item.cleanup(); }
  });

  test('健康探测失败时返回不可用状态而不泄露连接凭据', async () => {
    const item = fixture({
      env: { YASDB_JDBC_URL: 'jdbc:yasdb://db.local:1688/yasdb', YASDB_USERNAME: 'u', YASDB_PASSWORD: 'secret' },
      probe: async () => { throw Object.assign(new Error('数据库连接超时'), { code: 'DATABASE_CONNECTION_TIMEOUT' }); },
    });
    try {
      fs.writeFileSync(item.filePath, 'YASDB_JDBC_URL=jdbc:yasdb://db.local:1688/yasdb\nYASDB_USERNAME=u\nYASDB_PASSWORD=secret\n');
      const result = await item.governance.health();
      expect(result).toMatchObject({ healthStatus: 'unavailable', healthError: { code: 'DATABASE_CONNECTION_TIMEOUT', message: '数据库连接超时' } });
      expect(JSON.stringify(result)).not.toContain('secret');
    } finally { item.cleanup(); }
  });

  test('状态读取只返回保活快照，不因页面访问重复启动探测组件', async () => {
    let probes = 0;
    const item = fixture({
      env: { YASDB_JDBC_URL: 'jdbc:yasdb://db.local:1688/yasdb', YASDB_USERNAME: 'u', YASDB_PASSWORD: 'secret' },
      probe: async () => { probes += 1; return { status: 'success', verifiedAt: new Date().toISOString(), latencyMs: 2 }; },
    });
    try {
      fs.writeFileSync(item.filePath, 'YASDB_JDBC_URL=jdbc:yasdb://db.local:1688/yasdb\nYASDB_USERNAME=u\nYASDB_PASSWORD=secret\n');
      await item.governance.health();
      const first = item.governance.currentHealth();
      const second = item.governance.currentHealth();
      expect(probes).toBe(1);
      expect(first).toMatchObject({ healthStatus: 'healthy' });
      expect(second).toMatchObject({ healthStatus: 'healthy' });
    } finally { item.cleanup(); }
  });

  test('保活监视器启动时立即探测并按周期刷新健康快照', async () => {
    jest.useFakeTimers();
    let probes = 0;
    const item = fixture({
      env: { YASDB_JDBC_URL: 'jdbc:yasdb://db.local:1688/yasdb', YASDB_USERNAME: 'u', YASDB_PASSWORD: 'secret' },
      probe: async () => { probes += 1; return { status: 'success', verifiedAt: new Date().toISOString(), latencyMs: 2 }; },
      healthCheckIntervalMs: 1000,
    });
    try {
      fs.writeFileSync(item.filePath, 'YASDB_JDBC_URL=jdbc:yasdb://db.local:1688/yasdb\nYASDB_USERNAME=u\nYASDB_PASSWORD=secret\n');
      item.governance.startHealthMonitor();
      await Promise.resolve();
      await Promise.resolve();
      expect(probes).toBe(1);
      expect(item.governance.currentHealth()).toMatchObject({ healthStatus: 'healthy' });
      await jest.advanceTimersByTimeAsync(1000);
      expect(probes).toBe(2);
    } finally {
      item.governance.stopHealthMonitor();
      jest.useRealTimers();
      item.cleanup();
    }
  });

  test('旧连接探测完成后不会覆盖新连接的健康快照', async () => {
    const oldProbe = deferred();
    let calls = 0;
    const item = fixture({
      probe: async connection => {
        calls += 1;
        if (calls === 1) return oldProbe.promise;
        return { status: 'success', verifiedAt: '2026-09-22T10:00:00.000Z', latencyMs: 3, connection };
      },
    });
    try {
      fs.writeFileSync(item.filePath, 'YASDB_JDBC_URL="jdbc:yasdb://old.local:1688/yasdb"\nYASDB_USERNAME="old-user"\nYASDB_PASSWORD="old-secret"\n');
      const oldRefresh = item.governance.refreshHealth({ force: true });
      const version = item.governance.projection().rowVersion;
      await item.governance.save({
        jdbcUrl: 'jdbc:yasdb://new.local:1688/yasdb',
        username: 'new-user',
        password: 'new-secret',
      }, version);
      expect(item.governance.currentHealth()).toMatchObject({
        healthStatus: 'healthy',
        effectiveConnection: { jdbcUrl: 'jdbc:yasdb://new.local:1688/yasdb', username: 'new-user' },
      });

      oldProbe.resolve({ status: 'success', verifiedAt: '2026-09-22T09:59:00.000Z', latencyMs: 100 });
      await oldRefresh;

      expect(item.governance.currentHealth()).toMatchObject({
        healthStatus: 'healthy',
        healthCheckedAt: '2026-09-22T10:00:00.000Z',
        effectiveConnection: { jdbcUrl: 'jdbc:yasdb://new.local:1688/yasdb', username: 'new-user' },
      });
    } finally { item.cleanup(); }
  });

  test('启动环境变量与 service.env 不一致时显示待重启', () => {
    const item = fixture({ env: { YASDB_JDBC_URL: 'jdbc:yasdb://runtime.local:1688/yasdb', YASDB_USERNAME: 'runtime-user', YASDB_PASSWORD: 'runtime-secret' } });
    try {
      fs.writeFileSync(item.filePath, 'YASDB_JDBC_URL=jdbc:yasdb://file.local:1688/yasdb\nYASDB_USERNAME=file-user\nYASDB_PASSWORD=file-secret\n');
      expect(item.governance.projection()).toMatchObject({ status: 'pending_restart', restartRequired: true, environmentOverride: true });
    } finally { item.cleanup(); }
  });

  test('并发保存使用文件修改时间版本避免静默覆盖', async () => {
    const item = fixture();
    try {
      const payload = name => ({ name, jdbcUrl: 'jdbc:yasdb://db.local:1688/yasdb', username: 'u', password: 'secret' });
      const version = item.governance.projection().rowVersion;
      await item.governance.save(payload('first'), version);
      await expect(item.governance.save(payload('second'), version)).rejects.toMatchObject({ code: 'DATABASE_CONFIG_CONFLICT', status: 409 });
    } finally { item.cleanup(); }
  });

  test('真实 HTTP 状态接口只读保活快照，主动刷新才执行探测', async () => {
    const repositoryRoot = path.resolve(__dirname, '../../..');
    let refreshCalls = 0;
    const snapshot = { status: 'configured', configured: true, healthStatus: 'healthy', healthCheckedAt: new Date().toISOString(), effectiveConnection: { jdbcUrl: 'jdbc:yasdb://db.local:1688/yasdb', username: 'u' } };
    const databaseConnectionGovernance = {
      currentHealth: () => snapshot,
      refreshHealth: async () => { refreshCalls += 1; return snapshot; },
      projection: () => snapshot,
      test: async () => ({ status: 'success' }),
      save: async () => snapshot,
    };
    const handler = createKnowledgeCenterHandler({
      config: {
        KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: repositoryRoot, KNOWLEDGE_CENTER_ENTRY: 'index.html',
        OUTLINE_TEMPLATE_PATH: path.join(repositoryRoot, '大纲模板.xlsx'), OUTLINE_SAMPLE_PATH: path.join(repositoryRoot, '基本数据库管理手册大纲示例.xlsx'),
        PINGCODE_PREFIX: '/pingcode', PINGCODE_ROOT: repositoryRoot, DOCUMENT_API_HOST: '127.0.0.1', DOCUMENT_API_PORT: 1,
        PINGCODE_API_HOST: '127.0.0.1', PINGCODE_API_PORT: 1, PLATFORM_CONTEXT_TIMEOUT_MS: 1000,
        AUTH_API_HOST: '127.0.0.1', AUTH_API_PORT: 1, GITLAB_CONFIG_PATH: '/tmp/not-used', GITLAB_DOCUMENT_TYPES_PATH: '/tmp/not-used',
        DATABASE_CONNECTION_CONFIG_PATH: '/tmp/not-used',
      },
      stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [] }), write() {} } },
      moduleRegistry: { get: key => key === 'auth' ? { authorize: async () => ({ roles: ['PLATFORM_ADMIN'], user: { id: 'database-admin' } }) } : null },
      databaseConnectionGovernance,
      sendFile(_path, res) { res.writeHead(404); res.end(); }, proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
    });
    const server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const endpoint = `http://127.0.0.1:${server.address().port}/knowledge-center/api/platform/database-connection/status`;
      const readResponse = await fetch(endpoint);
      expect(readResponse.status).toBe(200);
      expect((await readResponse.json()).data).toMatchObject({ healthStatus: 'healthy' });
      expect(refreshCalls).toBe(0);
      const refreshResponse = await fetch(endpoint, { method: 'POST' });
      expect(refreshResponse.status).toBe(200);
      expect(refreshCalls).toBe(1);
      const unsupportedResponse = await fetch(endpoint, { method: 'PUT' });
      expect(unsupportedResponse.status).toBe(405);
      expect(unsupportedResponse.headers.get('allow')).toBe('GET, POST');
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
});
