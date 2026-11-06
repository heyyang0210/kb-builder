// Opt-in isolated model quality sample; does not write platform mappings.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { createAgentGovernance } = require('../../../packages/agent-runner-core/lib/platform-management/agent-governance');
const { createCodexRunner } = require('../../../packages/agent-runner-core/lib/agent-runtime/codex-runner');
const { parseTemplateMappingModelOutput } = require('../../../packages/agent-runner-core/lib/template-mapping-model-output');
const policy = require('../../../config/knowledge-center/template-mapping.json').ai;
const templates = [
  { id: 'sql', name: 'SQL 语法模板', description: 'SQL 语句语法、参数和示例' },
  { id: 'perf', name: '性能调优模板', description: '查询性能诊断、优化步骤和指标' },
];
const samples = [
  { document: { title: 'SQL 查询性能调优', path: '性能 / 查询优化', type: '性能' }, expected: 'perf' },
  { document: { title: 'SELECT 语句语法', path: 'SQL 参考 / 查询语句', type: 'SQL' }, expected: 'sql' },
  { document: { title: '发布说明', path: '版本 / 发布', type: '公告' }, expected: '' },
];
(async () => {
  const governance = createAgentGovernance();
  const selection = (await governance.available()).defaultSelection;
  assert.ok(selection, '必须配置可解析的默认模型');
  const config = governance.resolve(selection).config;
  const runner = createCodexRunner();
  const results = [];
  for (const sample of samples) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 70000);
    const started = performance.now();
    try {
      const messages = [{ role: 'system', content: policy.prompt }, { role: 'user', content: JSON.stringify({ document: sample.document, templates }) }];
      const result = await runner.run(messages, { ...config, mcp: { services: [] } }, { signal: controller.signal });
      const answer = parseTemplateMappingModelOutput(result.content);
      results.push({ title: sample.document.title, expected: sample.expected, actual: answer.templateId, reason: answer.reason, correct: answer.templateId === sample.expected, elapsedMs: Math.round(performance.now() - started) });
    } catch (error) {
      results.push({ title: sample.document.title, expected: sample.expected, correct: false, elapsedMs: Math.round(performance.now() - started), error: { code: error.code || 'UNKNOWN', message: String(error.message).slice(0, 200) } });
    } finally { clearTimeout(timer); }
  }
  const file = path.resolve(__dirname, '../../../runtime/test-results/template-management/model-samples.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), model: selection.model, samples: results, correct: results.filter(item => item.correct).length, total: results.length }, null, 2) + '\n');
  console.log(JSON.stringify({ file, correct: results.filter(item => item.correct).length, total: results.length, results }));
  if (results.some(item => !item.correct)) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
