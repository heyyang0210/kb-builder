const test = require('node:test');
const assert = require('node:assert/strict');
const { createAgentGovernance } = require('../../../packages/agent-runner-core/lib/platform-management/agent-governance');

test('默认 Agent 模型选择带当前版本，可直接用于执行解析', async () => {
  const model = { services: [{ id: 'test-service', name: '测试模型', provider: 'custom', protocol: 'chat_completions', base_url: 'http://127.0.0.1:1', api_key: 'local-test-key', models: ['test-model'], enabled: true }], defaultSelection: { serviceId: 'test-service', model: 'test-model' } };
  const agent = { id: 'test-agent', name: '测试 Agent', executor: 'workflow', enabled: true, reasoningEffort: 'medium', model, mcp: { services: [] } };
  const config = { agents: [agent], defaultAgentId: agent.id };
  const manager = { clearCache() {}, async load() { return structuredClone(config); }, getAgentServicesSync() { return structuredClone(config); }, _decryptSensitiveFields(value) { return value; } };
  const governance = createAgentGovernance({ configManager: manager });
  const available = await governance.available();
  assert.ok(available.defaultSelection?.configVersion);
  assert.ok(available.defaultSelection?.agentConfigVersion);
  assert.deepEqual(available.defaultSelection, available.options[0]);
  assert.equal(governance.resolve(available.defaultSelection).config.model, 'test-model');
});
