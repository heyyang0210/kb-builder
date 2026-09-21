const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { createDatabaseConnectionGovernance } = require('../../../packages/agent-runner-core/lib/platform-management/database-connection-governance');

function fixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'database-governance-'));
  const filePath = path.join(root, 'service.env');
  const calls = [];
  const probe = options.probe || (async connection => { calls.push(connection); return { status: 'success', message: '数据库连接可用', verifiedAt: new Date().toISOString(), latencyMs: 1 }; });
  const governance = createDatabaseConnectionGovernance({ filePath, env: options.env || {}, probe });
  return { root, filePath, calls, governance, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
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
});
