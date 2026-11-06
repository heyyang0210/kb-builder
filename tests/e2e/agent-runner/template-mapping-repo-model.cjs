// Opt-in quality sample from repository template descriptions and outline titles; read-only to platform.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { createAgentGovernance } = require('../../../packages/agent-runner-core/lib/platform-management/agent-governance');
const { createCodexRunner } = require('../../../packages/agent-runner-core/lib/agent-runtime/codex-runner');
const { parseTemplateMappingModelOutput } = require('../../../packages/agent-runner-core/lib/template-mapping-model-output');
const root = path.resolve(__dirname, '../../..');
const policy = require('../../../config/knowledge-center/template-mapping.json').ai;
const templates = Array.from({ length: 7 }, (_, index) => {
  const file = fs.readdirSync(path.join(root, 'knowledge/templates')).find(name => name.startsWith(String(index + 1).padStart(2, '0') + '-'));
  const content = fs.readFileSync(path.join(root, 'knowledge/templates', file), 'utf8');
  return { id: String(index + 1), name: content.match(/^# (.+)$/m)?.[1], description: content.match(/^> \*\*适用场景\*\*：(.+)$/m)?.[1] };
});
const cases = [
  { title: '数据库与数据库管理系统', path: '数据库基础入门', type: '基础概念', expected: '1' },
  { title: '索引原理与实现', path: '数据库核心原理', type: '内部机制', expected: '2' },
  { title: 'SQL 调优', path: '性能优化 / SQL调优', type: '性能', expected: '3' },
  { title: '高可用架构模式', path: '高可用架构设计', type: '架构', expected: '4' },
  { title: '备份恢复流程', path: '数据库管理 / 日常运维', type: '操作流程', expected: '5' },
  { title: 'SELECT 语句语法', path: 'SQL 编程与开发', type: 'SQL参考', expected: '6' },
  { title: 'Oracle 与 YashanDB 数据类型映射', path: '兼容性 / DDL兼容性', type: '兼容性', expected: '7' },
  { title: '数据库选型对比', path: '数据库架构设计与实践', type: '方案比较', expected: '4' },
  { title: '巡检规范', path: '运维体系与自动化', type: '运维', expected: '5' },
  { title: '字符串函数', path: 'SQL 编程与开发 / 内置函数', type: '函数参考', expected: '6' },
];
(async () => {
  const governance = createAgentGovernance();
  const selection = (await governance.available()).defaultSelection;
  assert.ok(selection, '缺少默认模型');
  const config = governance.resolve(selection).config;
  const runner = createCodexRunner();
  let cursor = 0;
  const results = new Array(cases.length);
  const worker = async () => {
    while (cursor < cases.length) {
      const index = cursor++;
      const item = cases[index];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 70000);
      const started = performance.now();
      try {
        const messages = [{ role: 'system', content: policy.prompt }, { role: 'user', content: JSON.stringify({ document: { title: item.title, path: item.path, type: item.type }, templates }) }];
        const output = await runner.run(messages, { ...config, mcp: { services: [] } }, { signal: controller.signal });
        const answer = parseTemplateMappingModelOutput(output.content);
        results[index] = { title: item.title, path: item.path, expected: item.expected, actual: answer.templateId, reason: answer.reason, correct: answer.templateId === item.expected, elapsedMs: Math.round(performance.now() - started) };
      } catch (error) {
        results[index] = { title: item.title, path: item.path, expected: item.expected, correct: false, elapsedMs: Math.round(performance.now() - started), error: { code: error.code || 'UNKNOWN', message: String(error.message).slice(0, 200) } };
      } finally { clearTimeout(timer); }
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker));
  const report = { generatedAt: new Date().toISOString(), model: selection.model, templateFiles: templates.map(item => item.name), correct: results.filter(item => item.correct).length, total: results.length, samples: results };
  const file = path.join(root, 'runtime/test-results/template-management/repo-model-samples.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ file, correct: report.correct, total: report.total, samples: results }));
  if (report.correct !== report.total) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
