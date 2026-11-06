jest.mock('../../../packages/agent-runner-core/lib/config-manager', () => ({ getModelConfig: jest.fn(async () => ({ model: 'test-model' })) }));
jest.mock('../../../packages/agent-runner-core/lib/llm-client', () => jest.fn());
jest.mock('../../../packages/agent-runner-core/lib/retrieval-query-builder', () => ({ getSynonymGroups: jest.fn(() => [['CHAR', 'VARCHAR2']]) }));
jest.mock('../../../packages/agent-runner-core/lib/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const LLMClient = require('../../../packages/agent-runner-core/lib/llm-client');
const configManager = require('../../../packages/agent-runner-core/lib/config-manager');
const SynonymExpander = require('../../../packages/agent-runner-core/lib/synonym-expander');

test('空查询不初始化模型，成功结果按字符串去重', async () => {
  const expander = new SynonymExpander();
  expect(await expander.expand([])).toEqual([]);
  expect(LLMClient).not.toHaveBeenCalled();
  LLMClient.mockImplementation(() => ({ chatJSON: jest.fn(async messages => {
    expect(messages[0].content).toContain('[CHAR, VARCHAR2]');
    expect(messages[1].content).toContain('["CHAR"]');
    return { parsed: [{ expanded: [' CHAR ', 'VARCHAR2'] }, { expanded: ['CHAR', 12] }, {}] };
  }) }));
  expect(await expander.expand(['CHAR'])).toEqual(['CHAR', 'VARCHAR2', '12']);
});

test('非数组与模型异常均退回原词并去除空值', async () => {
  LLMClient.mockImplementationOnce(() => ({ chatJSON: jest.fn(async () => ({ parsed: null })) }));
  const nonArray = new SynonymExpander();
  expect(await nonArray.expand([' CHAR ', ''])).toEqual(['CHAR']);
  LLMClient.mockImplementationOnce(() => ({ chatJSON: jest.fn(async () => { throw new Error('offline'); }) }));
  const failing = new SynonymExpander();
  expect(await failing.expand(['NUMBER', ' '])).toEqual(['NUMBER']);
});

test('模型返回缺少 expanded 的记录时忽略并保持空扩展结果', async () => {
  LLMClient.mockImplementationOnce(() => ({ chatJSON: jest.fn(async () => ({ parsed: [{}, { expanded: 'not-array' }] })) }));
  const expander = new SynonymExpander();
  expect(await expander.expand(['CHAR'])).toEqual([]);
});

test('模型配置缺失时初始化为空配置，重复初始化复用同一客户端', async () => {
  configManager.getModelConfig.mockResolvedValueOnce(null);
  LLMClient.mockImplementationOnce(() => ({ chatJSON: jest.fn() }));
  const expander = new SynonymExpander();
  await expander.init();
  const client = expander.llmClient;
  await expander.init();
  expect(expander.llmClient).toBe(client);
  expect(LLMClient).toHaveBeenLastCalledWith({});
});
