const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { assertNoSecrets, loadDatabaseConfig } = require('../../../packages/agent-runner-core/lib/database-config');

describe('数据库配置公开契约', () => {
  let root;

  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'database-config-public-')); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('要求 service.env 存在且拒绝非赋值行', () => {
    expect(() => loadDatabaseConfig({ configRoot: root, env: {} })).toThrow(/配置文件不存在/);
    fs.writeFileSync(path.join(root, 'service.env'), 'YASDB_USERNAME=reader\ninvalid line');
    expect(() => loadDatabaseConfig({ configRoot: root, env: {} })).toThrow(/配置格式错误/);
  });

  test('默认仓库根目录读取仓库配置', () => {
    const config = loadDatabaseConfig();
    expect(config.version).toBe(1);
    expect(config.jdbc.url).toMatch(/^jdbc:yasdb:/);
  });

  test('解析注释、export、单引号、双引号和未引号值', () => {
    fs.writeFileSync(path.join(root, 'service.env'), [
      ' # comment', '', 'export YASDB_JDBC_URL="jdbc:yasdb://file/db"',
      "YASDB_USERNAME='file-user'", 'YASDB_JDBC_JAR=/driver.jar',
    ].join('\r\n'));
    expect(loadDatabaseConfig({ configRoot: root, env: {} })).toEqual({
      version: 1,
      jdbc: { url: 'jdbc:yasdb://file/db', username: 'file-user', driverJar: '/driver.jar' },
      storage: {}, expImp: {},
    });
  });

  test('显式环境覆盖配置并转换数值，空值忽略而0保留', () => {
    fs.writeFileSync(path.join(root, 'service.env'), 'YASDB_USERNAME=file-user\nYASDB_STORAGE_PORT=19001\n');
    expect(loadDatabaseConfig({ configRoot: root, env: {
      YASDB_USERNAME: '', YASDB_STORAGE_PORT: '0', YASDB_STORAGE_TIMEOUT_MS: '2500',
      YASDB_STORAGE_SQL_DIR: '/fixture/sql', YASDB_JDBC_URL: 'jdbc:yasdb://env/db', YASDB_EXP_ROWS: 'N',
    } })).toEqual({
      version: 1, jdbc: { url: 'jdbc:yasdb://env/db' },
      storage: { port: 0, timeoutMs: 2500, sqlDir: '/fixture/sql' }, expImp: { rows: 'N' },
    });
  });

  test('敏感字段拒绝递归生效，普通结构可用', () => {
    expect(() => assertNoSecrets({ connectors: [{ apiKey: 'hidden' }] })).toThrow(/connectors\.0\.apiKey/);
    expect(() => assertNoSecrets({ jdbc: { username: 'reader', options: [null, { port: 1688 }] } })).not.toThrow();
    expect(() => assertNoSecrets(null)).not.toThrow();
  });
});
