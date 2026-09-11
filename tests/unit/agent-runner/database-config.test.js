const path = require('path');
const fs = require('fs');
const os = require('os');
const { loadDatabaseConfig, assertNoSecrets } = require('../../../packages/agent-runner-core/lib/database-config');

describe('统一数据库配置加载器', () => {
  test('默认配置来自 config/database', () => {
    const config = loadDatabaseConfig();
    expect(config.jdbc.url).toMatch(/^jdbc:yasdb:/);
    expect(config.storage.port).toBeGreaterThan(0);
  });

  test('环境变量覆盖本地和示例配置', () => {
    const config = loadDatabaseConfig({ env: {
      YASDB_JDBC_URL: 'jdbc:yasdb://env/db',
      YASDB_STORAGE_PORT: '19999',
    }});
    expect(config.jdbc.url).toBe('jdbc:yasdb://env/db');
    expect(config.storage.port).toBe(19999);
  });

  test('拒绝配置文件中的敏感字段', () => {
    expect(() => assertNoSecrets({ jdbc: { password: 'do-not-store' } })).toThrow(/敏感字段/);
  });

  test('可从临时 configRoot 读取 local 覆盖', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yasdb-config-'));
    fs.writeFileSync(path.join(root, 'yashandb.example.json'), JSON.stringify({ version: 1, jdbc: { url: 'example', username: 'u' } }));
    fs.writeFileSync(path.join(root, 'yashandb.local.json'), JSON.stringify({ jdbc: { url: 'local' } }));
    const config = loadDatabaseConfig({ configRoot: root, env: {} });
    expect(config.jdbc.url).toBe('local');
  });
});
