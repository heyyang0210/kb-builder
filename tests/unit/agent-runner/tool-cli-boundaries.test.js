const childProcess = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '../../..');

describe('工具 CLI 边界', () => {
  test('SQL 大纲样例缺少源文件时返回可执行的错误信息', () => {
    const result = childProcess.spawnSync(process.execPath, [
      path.join(root, 'tools/repository/generate-sql-outline-sample.js'),
    ], { cwd: root, encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toMatch(/SQL 示例源文件不存在：.*请先准备原始 Excel/);
  });

  test('生产同步脚本未知参数拒绝执行并输出用法', () => {
    expect(() => childProcess.execFileSync('bash', [
      path.join(root, 'tools/deployment/sync-production.sh'), '--unknown',
    ], { cwd: root, encoding: 'utf8', stdio: 'pipe' })).toThrow();
  });
});
