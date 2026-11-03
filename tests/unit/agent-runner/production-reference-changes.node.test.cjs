const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
test('生产聚合按变化实体检查引用，历史保留与新增修改保护同时成立', () => {
  const root = path.resolve(__dirname, '../../..');
  const temp = fs.mkdtempSync(path.join(root, 'runtime/test-results/production-writing/reference-contract-'));
  try {
    const source = path.join(root, 'apps/yashandb-storage/src');
    const files = [source, path.join(source, 'migration')].flatMap(dir => fs.readdirSync(dir).filter(name => name.endsWith('.java')).map(name => path.join(dir, name)));
    files.push(path.join(__dirname, 'fixtures/ProductionReferenceChangesCheck.java'));
    const compile = spawnSync('java', ['-m', 'jdk.compiler/com.sun.tools.javac.Main', '-encoding', 'UTF-8', '-d', temp, ...files], { encoding: 'utf8', timeout: 60000 });
    assert.equal(compile.status, 0, compile.stderr);
    const run = spawnSync('java', ['-cp', temp, 'ProductionReferenceChangesCheck'], { encoding: 'utf8', timeout: 15000 });
    assert.equal(run.status, 0, run.stderr); assert.match(run.stdout, /PASS:/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
