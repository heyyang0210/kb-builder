const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { rules } = require('../../../packages/agent-runner-core/lib/outline-path-template');
const { parseXlsxOutlineFile } = require('../../../packages/agent-runner-core/routes/outline-management');

test('Java存储转换与只追加保护（JDBC替身，不连接数据库）', () => {
  const root = path.resolve(__dirname, '../../..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'outline-storage-java-'));
  try {
    const content = parseXlsxOutlineFile(path.join(root, rules.sampleDownloadPath), 'SQL参考手册');
    const fixture = path.join(temp, 'content.json');
    fs.writeFileSync(fixture, JSON.stringify(content));
    const source = path.join(root, 'apps/yashandb-storage/src');
    const javaFiles = fs.readdirSync(source).filter(name => name.endsWith('.java')).map(name => path.join(source, name));
    javaFiles.push(...fs.readdirSync(path.join(source, 'migration')).filter(name => name.endsWith('.java')).map(name => path.join(source, 'migration', name)));
    javaFiles.push(path.join(__dirname, 'fixtures/OutlineStorageContractCheck.java'));
    const compiled = spawnSync('java', ['-m', 'jdk.compiler/com.sun.tools.javac.Main', '-encoding', 'UTF-8', '-d', temp, ...javaFiles], { encoding: 'utf8', timeout: 60000 });
    expect({ status: compiled.status, error: compiled.error?.message, stderr: compiled.stderr }).toEqual({ status: 0, error: undefined, stderr: '' });
    const executed = spawnSync('java', ['-cp', temp, 'OutlineStorageContractCheck', fixture], { encoding: 'utf8', timeout: 30000,
      env: { ...process.env, YASDB_JDBC_URL: 'jdbc:fixture:never-connect', YASDB_USERNAME: 'fixture', YASDB_PASSWORD: 'fixture', YASDB_STORAGE_SQL_DIR: path.join(temp, 'no-schema') } });
    expect({ status: executed.status, error: executed.error?.message, stderr: executed.stderr }).toEqual({ status: 0, error: undefined, stderr: '' });
    expect(executed.stdout).toContain('PASS: 501 documents');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}, 120000);

test('治理投影批量读取领域名称，不按文档执行领域名称查询', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../apps/yashandb-storage/src/Main.java'), 'utf8');
  const governance = source.slice(source.indexOf('private Map<String, Object> projectOutlineGovernance'), source.indexOf('private List<Map<String, Object>> effectiveAssignments'));
  expect(governance).toContain('Map<String, String> domainNames = techDomainNames(connection);');
  expect(governance).toContain('domainNames.getOrDefault(domainId, domainId)');
  expect(governance).not.toContain('techDomainName(connection, domainId)');
});
