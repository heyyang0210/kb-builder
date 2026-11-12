const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

test('任务编号在数据库边界拆分为前缀和 BIGINT', () => {
  const root = path.resolve(__dirname, '../../..');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'task-number-java-'));
  try {
    const source = path.join(root, 'apps/yashandb-storage/src/TaskNumber.java');
    const fixture = path.join(__dirname, 'fixtures/TaskNumberCheck.java');
    const compiled = spawnSync('java', ['-m', 'jdk.compiler/com.sun.tools.javac.Main',
      '-encoding', 'UTF-8', '-d', temporary, source, fixture], { encoding: 'utf8', timeout: 30000 });
    expect(compiled.status).toBe(0);
    const result = spawnSync('java', ['-cp', temporary, 'TaskNumberCheck'],
      { encoding: 'utf8', timeout: 30000 });
    expect({ status: result.status, stdout: result.stdout, stderr: result.stderr })
      .toEqual({ status: 0, stdout: 'PASS: numeric task numbers\n', stderr: '' });
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
