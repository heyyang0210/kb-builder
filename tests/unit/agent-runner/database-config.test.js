const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { loadDatabaseConfig, assertNoSecrets } = require('../../../packages/agent-runner-core/lib/database-config');

test('默认配置来自 config/yashandb', () => {
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
    try {
    fs.writeFileSync(path.join(root, 'service.env'), 'YASDB_JDBC_URL=jdbc:yasdb://configured/db\nYASDB_USERNAME=u\n');
    const config = loadDatabaseConfig({ configRoot: root, env: {} });
    assert.equal(config.jdbc.url, 'jdbc:yasdb://configured/db');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

function withConfig(content, verify) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yasdb-config-boundaries-'));
    try {
        if (content !== null) fs.writeFileSync(path.join(root, 'service.env'), content);
        return verify(root);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

test('必须存在配置文件且拒绝非赋值行', () => {
    withConfig(null, configRoot => {
        assert.throws(() => loadDatabaseConfig({ configRoot, env: {} }), /数据库配置文件不存在/);
    });
    withConfig('YASDB_USERNAME=reader\ninvalid config line', configRoot => {
        assert.throws(() => loadDatabaseConfig({ configRoot, env: {} }), /数据库配置格式错误/);
    });
});

test('支持CRLF、注释、export与引号，完整映射数值及导入导出参数', () => {
    const values = {
        YASDB_JDBC_URL: 'jdbc:yasdb://fixture/db', YASDB_USERNAME: 'reader', YASDB_JDBC_JAR: '/fixture/driver.jar',
        YASDB_STORAGE_URL: 'http://fixture:19001', YASDB_STORAGE_HOST: '127.0.0.1', YASDB_STORAGE_PORT: '19001',
        YASDB_STORAGE_TIMEOUT_MS: '2500', YASDB_STORAGE_THREADS: '8', YASDB_STORAGE_MAX_BODY_BYTES: '4096',
        YASDB_STORAGE_SQL_DIR: '/fixture/sql', YASDB_EXP_SERVER_HOST: 'fixture', YASDB_EXP_OWNER: 'OWNER',
        YASDB_IMP_FROMUSER: 'SOURCE', YASDB_IMP_TOUSER: 'TARGET', YASDB_EXP_OUTPUT_DIR: '/fixture/output',
        YASDB_EXP_LOG_DIR: '/fixture/logs', YASDB_EXP_ROWS: 'N', YASDB_EXP_LOG_LEVEL: 'INFO'
    };
    const lines = Object.entries(values).map(([key, value], i) => i % 3 === 0
        ? `export ${key}="${value}"` : i % 3 === 1 ? `${key}='${value}'` : `${key}=${value}`);
    withConfig(['  # ignored comment', '', ...lines, ''].join('\r\n'), configRoot => {
        assert.deepEqual(loadDatabaseConfig({ configRoot, env: {} }), {
            version: 1,
            jdbc: { url: values.YASDB_JDBC_URL, username: 'reader', driverJar: '/fixture/driver.jar' },
            storage: { url: 'http://fixture:19001', host: '127.0.0.1', port: 19001, timeoutMs: 2500,
                threads: 8, maxBodyBytes: 4096, sqlDir: '/fixture/sql' },
            expImp: { serverHost: 'fixture', owner: 'OWNER', fromUser: 'SOURCE', toUser: 'TARGET',
                outputDir: '/fixture/output', logDir: '/fixture/logs', rows: 'N', logLevel: 'INFO' }
        });
    });
});

test('显式环境值优先且空值不生成配置键', () => {
    withConfig('YASDB_USERNAME=file-user\nYASDB_STORAGE_PORT=19001\n', configRoot => {
        const config = loadDatabaseConfig({ configRoot, env: {
            YASDB_USERNAME: '', YASDB_STORAGE_PORT: '0', YASDB_JDBC_URL: 'jdbc:yasdb://override/db'
        }});
        assert.deepEqual(config, { version: 1, jdbc: { url: 'jdbc:yasdb://override/db' }, storage: { port: 0 }, expImp: {} });
    });
});

test('递归检测数组和非标准大小写敏感键并接受普通叶子', () => {
    for (const key of ['password', 'token', 'secret', 'apiKey', 'api_key', 'ACCESS_TOKEN', 'clientSecret', 'api-key']) {
        assert.throws(() => assertNoSecrets({ connections: [{ [key]: 'fixture' }] }),
            error => error.message === `数据库配置禁止包含敏感字段：config.connections.0.${key}`);
    }
    for (const value of [null, undefined, false, 0, 'config', { jdbc: { username: 'reader', options: [null, 'plain', { port: 19001 }] } }]) {
        assert.doesNotThrow(() => assertNoSecrets(value));
    }
});
