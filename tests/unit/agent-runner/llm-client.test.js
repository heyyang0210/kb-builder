const mockCreate = jest.fn();

jest.mock('openai', () => jest.fn().mockImplementation(() => ({
  chat: { completions: { create: mockCreate } }
})));

jest.mock('../../../packages/agent-runner-core/lib/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const LLMClient = require('../../../packages/agent-runner-core/lib/llm-client');

describe('LLMClient step options and JSON repair', () => {
  beforeEach(() => mockCreate.mockReset());

  test('passes per-request token timeout and retry options', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '完成' }, finish_reason: 'stop' }],
      usage: { total_tokens: 10 },
      model: 'qwen3.7-plus'
    });
    const client = new LLMClient({ api_key: 'test', model: 'qwen3.7-plus', max_tokens: 60000 });
    await client.chat([{ role: 'user', content: '测试' }], { max_tokens: 1200, timeout_ms: 90000, max_retries: 0, enable_thinking: false, chat_template_kwargs: { enable_thinking: false } });
    expect(mockCreate.mock.calls[0][0].max_tokens).toBe(1200);
    expect(mockCreate.mock.calls[0][0].enable_thinking).toBe(false);
    expect(mockCreate.mock.calls[0][0].chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(mockCreate.mock.calls[0][1]).toEqual({ timeout: 90000, maxRetries: 0 });
  });

  test('repairs invalid JSON once', async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [{ message: { content: '{"summary":"缺少结尾"' }, finish_reason: 'stop' }],
        usage: { total_tokens: 20 },
        model: 'qwen3.7-plus'
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: '{"summary":"已修复","keywords":[],"confidence":0.5}' }, finish_reason: 'stop' }],
        usage: { total_tokens: 15 },
        model: 'qwen3.7-plus'
      });
    const client = new LLMClient({ api_key: 'test', model: 'qwen3.7-plus' });
    const result = await client.chatJSON([{ role: 'user', content: '测试' }], { max_tokens: 1200 });
    expect(result.parsed.summary).toBe('已修复');
    expect(result.attempts).toBe(2);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  test('does not hide a second model call when JSON repair is disabled', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"summary":"缺少结尾"' }, finish_reason: 'stop' }],
      usage: { total_tokens: 20 },
      model: 'qwen3.7-plus'
    });
    const client = new LLMClient({ api_key: 'test', model: 'qwen3.7-plus' });
    let failure;
    try {
      await client.chatJSON([{ role: 'user', content: '测试' }], {
        max_tokens: 1200,
        json_repair: false
      });
    } catch (error) {
      failure = error;
    }
    expect(failure.message).toBe('LLM 返回内容无法解析为 JSON');
    expect(failure.responseMetadata).toEqual({
      contentCharacters: 17,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 20 },
      finishReason: 'stop',
      attempts: 1
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
