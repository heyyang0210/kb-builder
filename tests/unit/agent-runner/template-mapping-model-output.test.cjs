const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTemplateMappingModelOutput } = require('../../../packages/agent-runner-core/lib/template-mapping-model-output');
test('普通模型 JSON 和 Codex markdown 信封解析为同一映射建议', () => {
  const answer = { templateId: 'perf', reason: '性能目录' };
  assert.deepEqual(parseTemplateMappingModelOutput(JSON.stringify(answer)), answer);
  assert.deepEqual(parseTemplateMappingModelOutput(JSON.stringify({ markdown: JSON.stringify(answer), provenance: [] })), answer);
  assert.deepEqual(parseTemplateMappingModelOutput(JSON.stringify({ markdown: '```json\n'+JSON.stringify(answer)+'\n```', provenance: [] })), answer);
  assert.throws(() => parseTemplateMappingModelOutput(JSON.stringify({ markdown: 'invalid', provenance: [] })));
});
