const crypto = require('crypto');
const { createModelGovernance } = require('./model-governance');
const { createMcpGovernance } = require('./mcp-governance');

const stable = value => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !(key === 'api_key_encrypted' && value.api_key !== undefined) && !(key === 'value_encrypted' && value.value !== undefined)).map(([key, item]) => [key, stable(item)]));
};
const digest = value => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const fail = (code, message, status = 422) => { throw Object.assign(new Error(message), { code, status }); };
let commitTail = Promise.resolve();

function createAgentGovernance(options = {}) {
  const manager = options.configManager || require('../config-manager');
  const legacyModels = options.legacyModels || createModelGovernance({ configManager: manager });
  const limits = () => require('../json-config').readJson(require('../config-registry').CONFIG_PATHS.contentRules).agentRuntime;

  async function current() {
    manager.clearCache('agent-services');
    const saved = await manager.load('agent-services');
    if (saved?.agents) return stable(saved);
    return { agents: [{ id: 'builtin-default', name: '内置文档工作流', executor: 'workflow', enabled: true,
      reasoningEffort: 'medium', model: manager.getModelConfigSync() || {}, mcp: await manager.getMCPConfig() || {} }],
    defaultAgentId: 'builtin-default' };
  }
  function newDshAgent() {
    return { id: 'dsh-admin-trial', name: 'DeepSeek Harness', executor: 'deepseek', enabled: false,
      reasoningEffort: 'medium', model: { services: [], defaultSelection: null }, mcp: { services: [] } };
  }
  async function ensureDshAgent() {
    return serialized(async () => {
      const config = await current();
      if (config.agents.some(agent => agent.executor === 'deepseek')) return config;
      if (config.agents.length >= limits().maxAgents) fail('AGENT_CONFIG_CAPACITY', 'Agent 数量已达上限，无法自动加入 DSH 试运行项', 409);
      const migrated = { ...config, agents: [...config.agents, newDshAgent()] };
      await manager.save('agent-services', migrated);
      return stable(migrated);
    });
  }
  function metadata(agent) {
    return { id: agent.id, name: agent.name, executor: agent.executor, enabled: agent.enabled !== false,
      reasoningEffort: agent.reasoningEffort || 'medium', modelCount: (agent.model?.services || []).reduce((n, service) => n + (service.models?.length || 0), 0),
      mcpCount: agent.mcp?.services?.length || (agent.mcp?.server_url ? 1 : 0) };
  }
  async function get() {
    const config = await ensureDshAgent();
    return { agents: config.agents.map(metadata), defaultAgentId: config.defaultAgentId, rowVersion: digest(config) };
  }
  function validate(input, old) {
    if (!Array.isArray(input?.agents) || !input.agents.length || input.agents.length > limits().maxAgents) fail('AGENT_CONFIG_INVALID', `Agent 数量应为 1 到 ${limits().maxAgents} 个`);
    const ids = new Set(); const names = new Set();
    const agents = input.agents.map(item => {
      if (!item || typeof item !== 'object') fail('AGENT_CONFIG_INVALID', 'Agent 配置无效');
      const previous = old.agents.find(agent => agent.id === item.id);
      if (item.id && !previous) fail('AGENT_CONFIG_INVALID', 'Agent 不存在，请重新读取');
      const inherited = old.agents.find(agent => agent.id === old.defaultAgentId);
      if (!item || typeof item.name !== 'string' || !item.name.trim() || item.name.length > limits().maxNameChars || /[\r\n\x00]/.test(item.name)) fail('AGENT_CONFIG_INVALID', '请填写有效的 Agent 名称');
      if (!['codex', 'deepseek', 'workflow'].includes(item.executor)) fail('AGENT_CONFIG_INVALID', 'Agent 类型无效');
      if (previous && previous.executor !== item.executor) fail('AGENT_CONFIG_INVALID', '已有 Agent 的类型不可修改');
      if (!['low', 'medium', 'high', 'xhigh'].includes(item.reasoningEffort || 'medium')) fail('AGENT_CONFIG_INVALID', '推理强度无效');
      const id = previous?.id || `agent-${crypto.randomUUID()}`;
      if (ids.has(id) || names.has(item.name.trim())) fail('AGENT_CONFIG_INVALID', 'Agent 名称或标识不能重复');
      ids.add(id); names.add(item.name.trim());
      const emptyDshModel = { services: [], defaultSelection: null };
      const emptyDshMcp = { services: [] };
      return { ...previous, id, name: item.name.trim(), executor: item.executor, enabled: item.executor === 'deepseek' ? false : item.enabled !== false,
        reasoningEffort: item.reasoningEffort || 'medium', model: structuredClone(previous?.model || (item.executor === 'deepseek' ? emptyDshModel : inherited?.model || emptyDshModel)),
        mcp: structuredClone(previous?.mcp || (item.executor === 'deepseek' ? emptyDshMcp : inherited?.mcp || emptyDshMcp)) };
    });
    const existingDsh = old.agents.find(agent => agent.executor === 'deepseek');
    if (existingDsh && !agents.some(agent => agent.executor === 'deepseek')) agents.push(structuredClone(existingDsh));
    if (agents.filter(agent => agent.executor === 'deepseek').length > 1) fail('AGENT_DSH_DUPLICATE', '管理员试运行列表中只能保留一套 DSH Agent');
    const defaultAgentId = input.defaultAgentId && agents.find(a => a.id === input.defaultAgentId && a.enabled && a.executor !== 'deepseek')?.id;
    if (!defaultAgentId) fail('AGENT_DEFAULT_INVALID', '请选择已启用的默认 Agent');
    return { agents, defaultAgentId };
  }
  function serialized(operation) {
    const task = commitTail.then(operation);
    commitTail = task.catch(() => {});
    return task;
  }
  async function save(input, expected, actorId) {
    await ensureDshAgent();
    await serialized(async () => {
      const config = await current();
      if (String(expected || '').replace(/^"|"$/g, '') !== digest(config)) fail('AGENT_CONFIG_CONFLICT', 'Agent 配置已变化，请重新加载', 409);
      const next = validate(input, config);
      await manager.save('agent-services', { ...config, ...next, updatedAt: new Date().toISOString(), updatedBy: actorId });
    });
    return get();
  }
  async function agent(id) {
    await ensureDshAgent();
    const config = await current();
    const selected = config.agents.find(item => item.id === id);
    if (!selected) fail('AGENT_NOT_FOUND', 'Agent 不存在', 404);
    return selected;
  }
  function scopedManager(id) {
    return {
      getModelConfigSync() {
        const config = manager.getAgentServicesSync();
        const saved = config?.agents?.find(agent => agent.id === id);
        if (saved) return stable(manager._decryptSensitiveFields(saved.model || {}));
        if (id === 'builtin-default' && !config) return manager.getModelConfigSync() || {};
        fail('AGENT_NOT_FOUND', 'Agent 不存在', 404);
      },
      async getMCPConfig() { return (await agent(id)).mcp || {}; },
      clearCache() {},
      async save(kind, value) {
        await serialized(async () => {
          const config = await current();
          const selected = config.agents.find(item => item.id === id);
          if (!selected) fail('AGENT_NOT_FOUND', 'Agent 不存在', 404);
          selected[kind === 'model-config' ? 'model' : 'mcp'] = value;
          await manager.save('agent-services', config);
        });
      },
    };
  }
  const modelCache = new Map(); const mcpCache = new Map();
  function models(id) {
    if (!modelCache.has(id)) modelCache.set(id, createModelGovernance({ configManager: scopedManager(id) }));
    return modelCache.get(id);
  }
  function mcp(id) {
    if (!mcpCache.has(id)) mcpCache.set(id, createMcpGovernance({ configManager: scopedManager(id) }));
    return mcpCache.get(id);
  }
  async function available() {
    const config = await ensureDshAgent();
    const options = config.agents.filter(a => a.enabled && a.executor !== 'deepseek').flatMap(a => models(a.id).available().options.map(option => ({ ...option, agentId: a.id, executor: a.executor, agentName: a.name, agentConfigVersion: digest(a) })));
    const defaultAgent = config.agents.find(a => a.id === config.defaultAgentId);
    const preferred = defaultAgent && models(defaultAgent.id).available().defaultSelection;
    const defaultSelection = preferred ? options.find(option => option.agentId === defaultAgent.id && option.serviceId === preferred.serviceId && option.model === preferred.model) || null : null;
    return { options, defaultSelection };
  }
  function resolve(selection) {
    // The production pipeline resolves synchronously, so use the fresh on-disk snapshot.
    const saved = manager.getAgentServicesSync();
    const selectedId = selection?.agentId || (selection?.serviceId ? 'builtin-default' : saved?.defaultAgentId) || 'builtin-default';
    const selected = saved?.agents?.find(a => a.id === selectedId)
      || (!saved && selectedId === 'builtin-default' ? { id: selectedId, name: '内置文档工作流', executor: 'workflow', enabled: true, reasoningEffort: 'medium', model: manager.getModelConfigSync() || {}, mcp: manager.getMCPConfigSync() || {} } : null);
    if (!selected?.enabled) fail('AGENT_NOT_AVAILABLE', 'Agent 已停用或不存在', 409);
    if (selected.executor === 'deepseek') fail('AGENT_EXECUTOR_UNAVAILABLE', 'DeepSeek Harness 尚未部署', 409);
    if (selection?.agentConfigVersion && selection.agentConfigVersion !== digest(selected)) fail('AGENT_SELECTION_STALE', 'Agent 配置已变化，请重新读取后再生成', 409);
    const resolved = (saved ? models(selectedId) : legacyModels).resolve(selection);
    return { config: { ...resolved.config, executor: selected.executor, agentId: selected.id, agentConfigVersion: digest(selected), modelConfigVersion: resolved.selection.configVersion, reasoningEffort: selected.reasoningEffort, mcp: manager._decryptSensitiveFields(selected.mcp || {}) },
      selection: { ...resolved.selection, agentId: selected.id, executor: selected.executor, agentConfigVersion: digest(selected) } };
  }
  return { get, save, agent, models, mcp, available, resolve, current };
}

module.exports = { createAgentGovernance };
