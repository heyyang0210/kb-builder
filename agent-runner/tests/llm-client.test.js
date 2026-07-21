const LLMClient = require('../lib/llm-client');

// Mock openai
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '{"result": "mock response"}' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
          model: 'gpt-4'
        })
      }
    }
  }));
});

describe('LLMClient', () => {
  let client;

  beforeEach(() => {
    client = new LLMClient({
      provider: 'openai',
      api_key: 'sk-test',
      model: 'gpt-4',
      base_url: 'https://api.openai.com/v1'
    });
  });

  test('初始化正确', () => {
    expect(client.model).toBe('gpt-4');
    expect(client.client).toBeDefined();
  });

  test('chat 调用返回内容', async () => {
    const result = await client.chat([
      { role: 'user', content: 'test' }
    ]);
    expect(result.content).toBeDefined();
    expect(result.usage.total_tokens).toBe(30);
    expect(result.model).toBe('gpt-4');
  });

  test('chatJSON 解析 JSON 响应', async () => {
    const result = await client.chatJSON([
      { role: 'user', content: 'test' }
    ]);
    expect(result.parsed).toBeDefined();
    expect(result.parsed.result).toBe('mock response');
  });

  test('updateConfig 更新配置', () => {
    client.updateConfig({ model: 'gpt-3.5-turbo' });
    expect(client.model).toBe('gpt-3.5-turbo');
  });

  test('getProviderConfigs 返回所有提供商', () => {
    const configs = LLMClient.getProviderConfigs();
    expect(configs.openai).toBeDefined();
    expect(configs.alibaba).toBeDefined();
    expect(configs.zhipu).toBeDefined();
    expect(configs.custom).toBeDefined();
  });

  test('getModelsForProvider 返回模型列表', () => {
    const models = LLMClient.getModelsForProvider('openai');
    expect(models).toContain('gpt-4');
    expect(models).toContain('gpt-3.5-turbo');
  });

  test('无 API Key 时不崩溃', () => {
    expect(() => new LLMClient({})).not.toThrow();
  });
});
