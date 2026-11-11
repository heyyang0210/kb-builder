const fs = require('fs');
const path = require('path');
const { createDatabaseConnectionGovernance, createJavaProbe, normalizeConnection, parseJdbcUrl } = require('../../../packages/agent-runner-core/lib/platform-management/database-connection-governance');
const jdbcUrl = 'jdbc:yasdb://localhost:1688/test';

describe('database connection public boundary contracts', () => {
  let root;
  let filePath;
  let instances;
  beforeEach(() => {
    const parent = path.resolve(__dirname, '../../../runtime/test-results/database-boundary-fixtures');
    fs.mkdirSync(parent, { recursive: true });
    root = fs.mkdtempSync(path.join(parent, 'case-'));
    filePath = path.join(root, 'service.env');
    instances = [];
  });
  afterEach(() => {
    instances.forEach(g => g.stopHealthMonitor());
    fs.rmSync(root, { recursive: true, force: true });
  });
  function governance(extra = {}) {
    const g = createDatabaseConnectionGovernance({ filePath, env: {}, autoStartHealthMonitor: false, probe: async () => ({}), ...extra });
    instances.push(g);
    return g;
  }
  function configured(password = 'secret') {
    fs.writeFileSync(filePath, `# isolated\nignored text\nexport YASDB_JDBC_URL='${jdbcUrl}'\nYASDB_USERNAME='user'\nYASDB_PASSWORD='${password}'\n`);
  }
  test.each(['password', 'passwd', 'pwd'])('rejects embedded %s even in a query', key => {
    expect(() => parseJdbcUrl(`${jdbcUrl}?${key}=secret`)).toThrow(expect.objectContaining({ code: 'DATABASE_JDBC_PASSWORD_FORBIDDEN' }));
  });
  test.each([undefined, '', 'https://localhost', 'jdbc:yasdb://localhost/db'])('rejects invalid URL %s', value => {
    expect(() => parseJdbcUrl(value)).toThrow(expect.objectContaining({ code: 'DATABASE_JDBC_URL_INVALID' }));
  });
  test.each([0, 65536])('rejects out of range port %s', port => {
    expect(() => parseJdbcUrl(`jdbc:yasdb://localhost:${port}/test`)).toThrow(expect.objectContaining({ code: 'DATABASE_PORT_INVALID' }));
  });
  test('URL parsing preserves query and trims external whitespace', () => {
    expect(parseJdbcUrl(` ${jdbcUrl}?charset=UTF8 `)).toEqual({ jdbcUrl: `${jdbcUrl}?charset=UTF8`, host: 'localhost', port: 1688, database: 'test' });
  });
  test('normalization requires URL and username and honors fallbacks', () => {
    expect(() => normalizeConnection()).toThrow(expect.objectContaining({ code: 'DATABASE_JDBC_URL_REQUIRED' }));
    expect(() => normalizeConnection({ jdbcUrl })).toThrow(expect.objectContaining({ code: 'DATABASE_USERNAME_REQUIRED' }));
    expect(normalizeConnection({}, { jdbcUrl, username: ' user ', name: ' fallback ', timeoutMs: 100 })).toMatchObject({ username: 'user', name: 'fallback', timeoutMs: 1000 });
    expect(normalizeConnection({ jdbcUrl, username: 'u', name: ' ', timeoutMs: 40000 })).toMatchObject({ name: '知识中心主数据库', timeoutMs: 30000 });
    expect(normalizeConnection({ jdbcUrl, username: 'u', timeoutMs: 'invalid' }).timeoutMs).toBe(5000);
  });
  test('configuration read failures are classified without disclosing file contents', () => {
    const g = governance();
    fs.mkdirSync(filePath);
    expect(() => g.projection()).toThrow(expect.objectContaining({ code: 'DATABASE_CONFIG_READ_FAILED', status: 503 }));
    fs.rmdirSync(filePath);
    fs.writeFileSync(filePath, 'YASDB_PASSWORD="bad\\q"');
    expect(() => g.startupConfig()).toThrow(expect.objectContaining({ code: 'DATABASE_CONFIG_READ_FAILED' }));
  });
  test('startup reads exported and single quoted values and rejects missing password', () => {
    const g = governance();
    expect(g.startupConfig()).toBeNull();
    configured('');
    expect(() => g.startupConfig()).toThrow(expect.objectContaining({ code: 'DATABASE_PASSWORD_REQUIRED', status: 503 }));
    expect(g.projection().connection).toMatchObject({ passwordConfigured: false, passwordMasked: '' });
    configured();
    expect(g.startupConfig()).toMatchObject({ jdbcUrl, username: 'user', password: 'secret', version: expect.any(Number) });
  });
  test('test uses configured fields by default and password priority is explicit > file > environment', async () => {
    const seen = [];
    const g = governance({ env: { YASDB_PASSWORD: 'environment' }, probe: async c => { seen.push(c); return { status: 'success' }; } });
    await g.test({ jdbcUrl, username: 'u' });
    configured();
    await g.test();
    await g.test({ password: 'explicit' });
    expect(seen.map(c => c.password)).toEqual(['environment', 'secret', 'explicit']);
    expect(seen[1].username).toBe('user');
  });
  test('test and save reject missing password and save rejects absent version', async () => {
    const g = governance();
    await expect(g.test({ jdbcUrl, username: 'u' })).rejects.toMatchObject({ code: 'DATABASE_PASSWORD_REQUIRED' });
    await expect(g.save({ jdbcUrl, username: 'u' })).rejects.toMatchObject({ code: 'DATABASE_PASSWORD_REQUIRED' });
    await expect(g.save({ jdbcUrl, username: 'u', password: 'x' })).rejects.toMatchObject({ code: 'DATABASE_CONFIG_CONFLICT' });
    await expect(g.save()).rejects.toMatchObject({ code: 'DATABASE_JDBC_URL_REQUIRED' });
  });
  test('save can reuse environment password and default verification fields', async () => {
    const g = governance({ env: { YASDB_PASSWORD: 'environment' } });
    const result = await g.save({ jdbcUrl, username: 'u' }, g.projection().rowVersion);
    expect(result.status).toBe('verified');
    expect(g.startupConfig().password).toBe('environment');
    expect(g.currentHealth()).toMatchObject({ healthStatus: 'healthy', healthLatencyMs: null, healthCheckedAt: expect.any(String) });
    expect(fs.statSync(filePath).mode & 0o777).toBe(0o600);
  });
  test('health is unconfigured without runtime and uses default errors and TTL cache', async () => {
    let calls = 0;
    const g = governance({ healthCacheTtlMs: 10000, probe: async () => { calls++; throw {}; } });
    expect(await g.health()).toMatchObject({ healthStatus: 'unconfigured', healthCheckedAt: null });
    configured();
    expect(g.currentHealth()).toMatchObject({ healthStatus: null });
    expect(await g.refreshHealth()).toMatchObject({ healthStatus: 'unavailable', healthError: { code: 'DATABASE_CONNECTION_UNAVAILABLE', message: '数据库连接不可用' } });
    await g.refreshHealth();
    expect(calls).toBe(1);
    await g.refreshHealth({ force: true });
    expect(calls).toBe(2);
  });
  test('simultaneous health refreshes share one real promise result', async () => {
    configured();
    let resolve;
    let calls = 0;
    const g = governance({ probe: () => { calls++; return new Promise(r => { resolve = r; }); } });
    const first = g.health();
    const second = g.health();
    expect(calls).toBe(1);
    resolve({});
    expect(await first).toEqual(await second);
    expect(g.currentHealth()).toMatchObject({ healthStatus: 'healthy', healthLatencyMs: null });
  });
  test.each([0, -1, 'invalid'])('disabled monitor interval %s does not start a probe', async interval => {
    let calls = 0;
    configured();
    const g = governance({ autoStartHealthMonitor: true, healthCheckIntervalMs: interval, probe: async () => { calls++; return {}; } });
    g.startHealthMonitor();
    await Promise.resolve();
    expect(calls).toBe(0);
  });

  test('deployment save remains pending when the runtime environment overrides it', async () => {
    const g = governance({ env: { YASDB_JDBC_URL: jdbcUrl, YASDB_USERNAME: 'runtime' } });
    const result = await g.save({ jdbcUrl, username: 'deployment', password: 'secret' }, g.projection().rowVersion);
    expect(result).toMatchObject({ status: 'pending_restart', restartRequired: true });
    expect(g.currentHealth()).toMatchObject({ healthStatus: null, effectiveConnection: { passwordConfigured: false } });
  });
  test('a removed connection invalidates an in-flight health result', async () => {
    configured('');
    let resolve;
    const g = governance({ probe: () => new Promise(r => { resolve = r; }) });
    const pending = g.health();
    fs.unlinkSync(filePath);
    resolve({});
    expect(await pending).toMatchObject({ healthStatus: 'unconfigured' });
  });
  test('default Java probe construction is lazy and environment fallback does not mutate config', () => {
    expect(typeof createJavaProbe()).toBe('function');
    const g = createDatabaseConnectionGovernance({ filePath, autoStartHealthMonitor: false });
    instances.push(g);
    expect(g.startupConfig()).toBeNull();
  });

  function processProbe(mode, relative = false) {
    fs.mkdirSync(path.join(root, 'classes'));
    fs.writeFileSync(path.join(root, 'classes/Main.class'), 'fixture marker');
    fs.writeFileSync(path.join(root, 'driver.jar'), 'fixture marker');
    const executable = path.join(root, 'java-fixture');
    // A real child process substitutes only the external Java boundary.
    fs.writeFileSync(executable, `#!${process.execPath}\nconst fs=require('fs');\nfs.writeFileSync(${JSON.stringify(path.join(root, 'invocation.json'))},JSON.stringify({args:process.argv.slice(2),url:process.env.YASDB_JDBC_URL,username:process.env.YASDB_USERNAME,password:process.env.YASDB_PASSWORD,timeout:process.env.YASDB_PROBE_QUERY_TIMEOUT_SECONDS}));\n${mode}\n`, { mode: 0o700 });
    return createJavaProbe({ repositoryRoot: root, jdbcJar: relative ? 'driver.jar' : path.join(root, 'driver.jar'), classesDir: relative ? 'classes' : path.join(root, 'classes'), javaBin: executable });
  }
  const connection = { jdbcUrl, username: 'u', password: 'fixture-only', timeoutMs: 1200 };
  test('Java probe rejects absent build files before launching', async () => {
    await expect(createJavaProbe({ repositoryRoot: root })(connection)).rejects.toMatchObject({ code: 'DATABASE_PROBE_UNAVAILABLE', status: 503 });
    fs.writeFileSync(path.join(root, 'driver.jar'), 'marker');
    await expect(createJavaProbe({ jdbcJar: path.join(root, 'driver.jar'), classesDir: root })(connection)).rejects.toMatchObject({ code: 'DATABASE_PROBE_UNAVAILABLE' });
  });
  test('Java probe passes JDBC credentials and timeout through environment with correct classpath', async () => {
    const result = await processProbe('process.exit(0)', true)(connection);
    expect(result).toMatchObject({ status: 'success', verifiedAt: expect.any(String), latencyMs: expect.any(Number) });
    const invocation = JSON.parse(fs.readFileSync(path.join(root, 'invocation.json')));
    expect(invocation).toEqual({ args: ['-cp', `${path.join(root, 'driver.jar')}${path.delimiter}${path.join(root, 'classes')}`, 'Main', 'probe'], url: jdbcUrl, username: 'u', password: 'fixture-only', timeout: '2' });
  });
  test.each([
    ['process.stderr.write("authentication failed");process.exit(1)', 'DATABASE_AUTHENTICATION_FAILED', 422],
    ['process.stderr.write("timeout");process.exit(1)', 'DATABASE_CONNECTION_TIMEOUT', 503],
    ['process.kill(process.pid,"SIGTERM")', 'DATABASE_CONNECTION_TIMEOUT', 503],
    ['process.stderr.write("network unavailable");process.exit(1)', 'DATABASE_CONNECTION_UNAVAILABLE', 503],
  ])('Java probe classifies subprocess failure %s', async (mode, code, status) => {
    await expect(processProbe(mode)(connection)).rejects.toMatchObject({ code, status });
  });
});
