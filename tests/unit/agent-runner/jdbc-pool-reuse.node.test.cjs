const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
test('连接池复用、并行建连、容量限制与失败释放', () => {
  const root = path.resolve(__dirname, '../../..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jdbc-pool-reuse-'));
  try {
    const source = path.join(root, 'apps/yashandb-storage/src');
    const files = [source, path.join(source, 'migration')].flatMap(dir => fs.readdirSync(dir).filter(name => name.endsWith('.java')).map(name => path.join(dir, name)));
    files.push(path.join(__dirname, 'fixtures/JdbcPoolReuseCheck.java'));
    const compile = spawnSync('java', ['-m', 'jdk.compiler/com.sun.tools.javac.Main', '-encoding', 'UTF-8', '-d', temp, ...files], { encoding: 'utf8', timeout: 60000 });
    assert.equal(compile.status, 0, compile.stderr);
    const run = spawnSync('java', ['-cp', temp, 'JdbcPoolReuseCheck'], { encoding: 'utf8', timeout: 15000 });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /PASS: reuse connection/);
    assert.match(run.stdout, /PASS: parallel creation and bounded capacity/);
    assert.match(run.stdout, /PASS: failed creation releases capacity/);
    assert.match(run.stdout, /PASS: initialization failure closes raw connection and releases capacity/);
    assert.match(run.stdout, /PASS: disconnected idle and rollback failure recover capacity without restart/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
