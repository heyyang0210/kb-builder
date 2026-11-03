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

test('质量结果达到上限但没有更多行时不标记截断（JDBC替身）', () => {
  const root = path.resolve(__dirname, '../../..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-limit-java-'));
  try {
    const source = path.join(root, 'apps/yashandb-storage/src');
    const javaFiles = fs.readdirSync(source).filter(name => name.endsWith('.java')).map(name => path.join(source, name));
    javaFiles.push(...fs.readdirSync(path.join(source, 'migration')).filter(name => name.endsWith('.java')).map(name => path.join(source, 'migration', name)));
    javaFiles.push(path.join(__dirname, 'fixtures/QualityResultLimitCheck.java'));
    javaFiles.push(path.join(__dirname, 'fixtures/QualityExecuteHttpCheck.java'));
    const compiled = spawnSync('java', ['-m', 'jdk.compiler/com.sun.tools.javac.Main', '-encoding', 'UTF-8', '-d', temp, ...javaFiles], { encoding: 'utf8', timeout: 60000 });
    expect({ status: compiled.status, error: compiled.error?.message, stderr: compiled.stderr }).toEqual({ status: 0, error: undefined, stderr: '' });
    const executed = spawnSync('java', ['-cp', temp, 'QualityResultLimitCheck'], { encoding: 'utf8', timeout: 30000 });
    expect({ status: executed.status, error: executed.error?.message, stderr: executed.stderr }).toEqual({ status: 0, error: undefined, stderr: '' });
    expect(executed.stdout).toContain('PASS: exact limit and overflow');
    const coverageDir = process.env.QUALITY_JACOCO_DIR && path.resolve(process.env.QUALITY_JACOCO_DIR);
    if (coverageDir) fs.rmSync(path.join(coverageDir, 'quality.exec'), { force: true });
    const qualityEnv = { ...process.env, YASDB_JDBC_URL: 'jdbc:fixture:business', YASDB_USERNAME: 'fixture', YASDB_PASSWORD: 'fixture',
      YASDB_QUALITY_JDBC_URL: 'jdbc:fixture:quality', YASDB_QUALITY_USERNAME: 'reader', YASDB_QUALITY_PASSWORD: 'secret', YASDB_QUALITY_MAX_ROWS: '2' };
    const scenarios = [
      ['missing-url', { YASDB_QUALITY_JDBC_URL: '' }],
      ['missing-user', { YASDB_QUALITY_USERNAME: '' }],
      ['missing-password', { YASDB_QUALITY_PASSWORD: '' }],
      ['business-url', { YASDB_QUALITY_JDBC_URL: 'jdbc:fixture:business' }],
      ['configured', {}],
    ];
    for (const [scenario, overrides] of scenarios) {
      const agent = coverageDir ? [`-javaagent:${coverageDir}/tools/agent.jar=destfile=${coverageDir}/quality.exec,append=true`] : [];
      const result = spawnSync('java', [...agent, '-cp', temp, 'QualityExecuteHttpCheck', scenario], {
        encoding: 'utf8', timeout: 30000, env: { ...qualityEnv, ...overrides },
      });
      expect(result.status).toBe(0);
      // 失败请求现在按统一日志契约写入结构化 stderr；只验证日志可解析且不改变 fixture 断言。
      expect(result.stderr).toMatch(/event\":\"request\.failed\"/);
      expect(result.stderr).not.toMatch(/fixture|secret|password|token/i);
      expect(result.stdout).toContain(`PASS: quality HTTP ${scenario}`);
    }
    if (coverageDir) {
      const report = spawnSync('java', ['-jar', `${coverageDir}/tools/cli.jar`, 'report', `${coverageDir}/quality.exec`,
        '--classfiles', path.join(temp, 'Main.class'), '--sourcefiles', source,
        '--xml', `${coverageDir}/java.xml`, '--html', `${coverageDir}/java-html`], { encoding: 'utf8', timeout: 30000 });
      expect({ status: report.status, stderr: report.stderr }).toEqual({ status: 0, stderr: '' });
      const xml = fs.readFileSync(`${coverageDir}/java.xml`, 'utf8');
      const metrics = {};
      for (const name of ['qualityExecute', 'qualityResult']) {
        const method = xml.match(new RegExp(`<method name="${name}"[\\s\\S]*?</method>`))?.[0];
        expect(method).toBeDefined();
        metrics[name] = {};
        for (const type of ['INSTRUCTION', 'LINE', 'BRANCH']) {
          const counter = method.match(new RegExp(`<counter type="${type}" missed="(\\d+)" covered="(\\d+)"`));
          expect(counter).not.toBeNull();
          const percent = 100 * Number(counter[2]) / (Number(counter[1]) + Number(counter[2]));
          metrics[name][type] = percent;
          expect(percent).toBeGreaterThanOrEqual(90);
        }
      }
      fs.writeFileSync(`${coverageDir}/java-summary.json`, JSON.stringify(metrics, null, 2));
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}, 120000);
