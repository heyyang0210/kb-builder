const { createAgentGovernance } = require('../../../packages/agent-runner-core/lib/platform-management/agent-governance');

function fixture(initial) {
  let saved = structuredClone(initial);
  const manager = {
    clearCache: jest.fn(),
    load: jest.fn(async () => structuredClone(saved)),
    save: jest.fn(async (_kind, value) => { saved = structuredClone(value); }),
    getModelConfigSync: jest.fn(() => ({ services: [] })),
    getMCPConfig: jest.fn(async () => ({ services: [] })),
    getMCPConfigSync: jest.fn(() => ({ services: [] })),
    getAgentServicesSync: jest.fn(() => structuredClone(saved)),
    _decryptSensitiveFields: jest.fn(value => value),
  };
  return { governance: createAgentGovernance({ configManager: manager }), manager };
}

const initial = () => ({
  agents: [{ id: 'builtin-default', name: '默认', executor: 'workflow', enabled: true,
    reasoningEffort: 'medium', model: { services: [] }, mcp: { services: [] } }],
  defaultAgentId: 'builtin-default',
});

test('Agent 列表、默认回退和详情使用当前配置', async () => {
  const { governance, manager } = fixture(initial());
  const listed = await governance.get();
  expect(listed.agents).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'builtin-default', enabled: true, modelCount: 0, mcpCount: 0 }),
    expect.objectContaining({ id: 'dsh-admin-trial', executor: 'deepseek', enabled: false, modelCount: 0, mcpCount: 0 }),
  ]));
  expect(listed.rowVersion).toMatch(/^[a-f0-9]{64}$/);
  expect((await governance.agent('builtin-default')).name).toBe('默认');
  await expect(governance.agent('missing')).rejects.toMatchObject({ code: 'AGENT_NOT_FOUND', status: 404 });
  expect(manager.clearCache).toHaveBeenCalledWith('agent-services');

  const fallback = fixture(null);
  expect((await fallback.governance.get()).agents[0].id).toBe('builtin-default');
  expect(fallback.manager.getModelConfigSync).toHaveBeenCalled();
  expect(fallback.manager.getMCPConfig).toHaveBeenCalled();
  expect(fallback.governance.models('builtin-default').get().services).toEqual([]);
});

test('Agent 保存校验版本、默认项和字段，成功时保留已有模型配置', async () => {
  const { governance, manager } = fixture(initial());
  const version = (await governance.get()).rowVersion;
  manager.save.mockClear();
  const valid = initial();
  await expect(governance.save(valid, 'stale', 'tester')).rejects.toMatchObject({ code: 'AGENT_CONFIG_CONFLICT', status: 409 });
  const invalid = [
    { agents: [] },
    { agents: [null], defaultAgentId: 'builtin-default' },
    { ...valid, agents: [{ ...valid.agents[0], id: 'missing' }] },
    { ...valid, agents: [{ ...valid.agents[0], name: '' }] },
    { ...valid, agents: [{ ...valid.agents[0], name: 'bad\nname' }] },
    { ...valid, agents: [{ ...valid.agents[0], executor: 'other' }] },
    { ...valid, agents: [{ ...valid.agents[0], executor: 'codex' }] },
    { ...valid, agents: [{ ...valid.agents[0], reasoningEffort: 'invalid' }] },
    { ...valid, agents: [valid.agents[0], valid.agents[0]] },
    { ...valid, agents: [valid.agents[0], { name: '默认', executor: 'workflow' }] },
    { ...valid, defaultAgentId: 'missing' },
    { ...valid, agents: [{ ...valid.agents[0], enabled: false }] },
  ];
  for (const input of invalid) {
    await expect(governance.save(input, version, 'tester')).rejects.toMatchObject({ code: expect.stringMatching(/^AGENT_/) });
  }
  expect(manager.save).not.toHaveBeenCalled();
  const result = await governance.save({ ...valid, agents: [{ ...valid.agents[0], name: ' 更新后 ' }] }, `"${version}"`, 'tester');
  expect(result.agents[0].name).toBe('更新后');
  expect(manager.save).toHaveBeenCalledWith('agent-services', expect.objectContaining({ updatedBy: 'tester', defaultAgentId: 'builtin-default' }));
  expect((await governance.get()).agents.filter(agent => agent.executor === 'deepseek')).toHaveLength(1);
  expect((await governance.agent('builtin-default')).model).toEqual({ services: [] });
});

test('停用与未部署执行器不能用于生成', () => {
  const disabled = fixture({ ...initial(), agents: [{ ...initial().agents[0], enabled: false }] });
  expect(() => disabled.governance.resolve()).toThrow(expect.objectContaining({ code: 'AGENT_NOT_AVAILABLE' }));
  const deepseek = fixture({ ...initial(), agents: [{ ...initial().agents[0], executor: 'deepseek' }] });
  expect(() => deepseek.governance.resolve()).toThrow(expect.objectContaining({ code: 'AGENT_EXECUTOR_UNAVAILABLE' }));
  const missing = fixture(initial());
  expect(() => missing.governance.resolve({ agentId: 'missing' })).toThrow(expect.objectContaining({ code: 'AGENT_NOT_AVAILABLE' }));
  expect(() => missing.governance.resolve({ agentConfigVersion: 'stale' })).toThrow(expect.objectContaining({ code: 'AGENT_SELECTION_STALE' }));
});

test('模型可用项绑定 Agent 版本，生成解析只使用该 Agent 的配置', async () => {
  const model = { services: [{ id: 'service-a', name: '测试模型服务', provider: 'custom', protocol: 'chat_completions',
    base_url: 'https://example.invalid', api_key: 'test-secret', models: ['model-a'], enabled: true }],
  defaultSelection: { serviceId: 'service-a', model: 'model-a' } };
  const config = initial();
  config.agents[0].model = model;
  const { governance, manager } = fixture(config);
  expect((await governance.get()).agents[0].modelCount).toBe(1);
  const available = await governance.available();
  expect(available.options).toEqual([expect.objectContaining({ agentId: 'builtin-default', model: 'model-a', agentName: '默认' })]);
  expect(available.defaultSelection).toEqual(available.options[0]);
  const resolved = governance.resolve(available.defaultSelection);
  expect(resolved.config).toEqual(expect.objectContaining({ agentId: 'builtin-default', model: 'model-a', api_key: 'test-secret' }));
  expect(resolved.selection.agentConfigVersion).toBe(available.options[0].agentConfigVersion);
  expect(manager._decryptSensitiveFields).toHaveBeenCalled();
  expect(governance.models('builtin-default')).toBe(governance.models('builtin-default'));
  expect(governance.mcp('builtin-default')).toBe(governance.mcp('builtin-default'));
  expect((await governance.mcp('builtin-default').get()).services).toEqual([]);
  expect(() => governance.models('missing').get()).toThrow(expect.objectContaining({ code: 'AGENT_NOT_FOUND' }));
  const modelGovernance = governance.models('builtin-default');
  const modelVersion = modelGovernance.get().rowVersion;
  await modelGovernance.save({ services: [], defaultSelection: null }, modelVersion, 'tester');
  expect(manager.save).toHaveBeenCalledWith('agent-services', expect.objectContaining({
    agents: expect.arrayContaining([expect.objectContaining({ id: 'builtin-default', model: expect.objectContaining({ services: [] }) })]),
  }));
  const currentVersion = modelGovernance.get().rowVersion;
  manager.load.mockResolvedValue({ agents: [], defaultAgentId: 'missing' });
  await expect(modelGovernance.save({ services: [], defaultSelection: null }, currentVersion, 'tester'))
    .rejects.toMatchObject({ code: 'AGENT_NOT_FOUND' });
});
