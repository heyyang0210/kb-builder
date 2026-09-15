const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { loadDatabaseConfig, assertNoSecrets } = require('../../../packages/agent-runner-core/lib/database-config');

test('默认配置来自 config/database', () => {
    const config = loadDatabaseConfig();
    assert.match(config.jdbc.url, /^jdbc:yasdb:/);
    assert.ok(config.storage.port > 0);
});

test('环境变量覆盖统一配置', () => {
    const config = loadDatabaseConfig({ env: {
      YASDB_JDBC_URL: 'jdbc:yasdb://env/db',
      YASDB_STORAGE_PORT: '19999',
    }});
    assert.equal(config.jdbc.url, 'jdbc:yasdb://env/db');
    assert.equal(config.storage.port, 19999);
});

test('拒绝配置文件中的敏感字段', () => {
    assert.throws(() => assertNoSecrets({ jdbc: { password: 'do-not-store' } }), /敏感字段/);
});

test('可从临时 configRoot 读取统一配置', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yasdb-config-'));
    fs.writeFileSync(path.join(root, 'yashandb.env'), 'YASDB_JDBC_URL=jdbc:yasdb://configured/db\nYASDB_USERNAME=u\n');
    const config = loadDatabaseConfig({ configRoot: root, env: {} });
    assert.equal(config.jdbc.url, 'jdbc:yasdb://configured/db');
});
