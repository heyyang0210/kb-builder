const mockCreate = jest.fn();
const mockResponsesCreate = jest.fn();
const mockOpenAI = jest.fn();

jest.mock('openai', () => mockOpenAI);

jest.mock('../../../packages/agent-runner-core/lib/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const LLMClient = require('../../../packages/agent-runner-core/lib/llm-client');

describe('LLMClient step options and JSON repair', () => {
  beforeEach(() => {
    mockCreate.mockReset(); mockResponsesCreate.mockReset(); mockOpenAI.mockReset();
    mockOpenAI.mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
      responses: { create: mockResponsesCreate },
    }));
  });

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
    expect(mockCreate.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('type');
    expect(mockCreate.mock.calls[1][0].response_format).toEqual({ type: 'json_object' });
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

  test('classifies provider failures without exposing the upstream response', async () => {
    mockCreate.mockRejectedValueOnce(Object.assign(new Error('Country, region, or territory not supported'), { status: 403 }));
    const client = new LLMClient({ api_key: 'test', model: 'gpt-5.5' });
    await expect(client.chat([{ role: 'user', content: '测试' }])).rejects.toMatchObject({
      code: 'LLM_PROVIDER_ERROR', providerCode: 'AI_PROVIDER_REGION_UNSUPPORTED', status: 403, message: 'LLM 调用失败'
    });
  });

  test.each([
    [Object.assign(new Error('invalid api key'), { status: 401 }), 'AI_PROVIDER_AUTH_FAILED'],
    [Object.assign(new Error('forbidden'), { status: 403 }), 'AI_PROVIDER_AUTH_FAILED'],
    [Object.assign(new Error('too many requests'), { status: 400 }), 'AI_PROVIDER_RATE_LIMITED'],
    [Object.assign(new Error('request timed out'), { status: 500 }), 'AI_PROVIDER_TIMEOUT'],
    [Object.assign(new Error('network reset'), { statusCode: 502 }), 'AI_PROVIDER_UNAVAILABLE'],
  ])('maps provider error to a stable code', async (providerError, providerCode) => {
    mockCreate.mockRejectedValueOnce(providerError);
    const client = new LLMClient({ api_key: 'test' });
    await expect(client.chat([{ role: 'user', content: 'test' }])).rejects.toMatchObject({ providerCode });
  });

  test('uses Responses output text fallback and maps token usage', async () => {
    mockResponsesCreate.mockResolvedValueOnce({
      status: 'completed', model: 'responses-model',
      output: [{ content: [{ type: 'reasoning', text: 'hidden' }, { type: 'output_text', text: 'answer' }] }],
      usage: { input_tokens: 7, output_tokens: 3, total_tokens: 10 },
    });
    const client = new LLMClient({ api_key: 'test', protocol: 'responses' });
    await expect(client.chat([{ role: 'user', content: 'test' }])).resolves.toEqual({
      content: 'answer', model: 'responses-model', finish_reason: 'stop',
      usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 },
    });
  });

  test('rejects incomplete Responses output safely', async () => {
    mockResponsesCreate.mockResolvedValueOnce({ status: 'incomplete', output_text: 'partial' });
    const client = new LLMClient({ api_key: 'test', protocol: 'responses' });
    await expect(client.chat([{ role: 'user', content: 'test' }])).rejects.toMatchObject({
      code: 'LLM_PROVIDER_ERROR', message: 'LLM 调用失败', providerCode: 'AI_PROVIDER_UNAVAILABLE',
    });
  });

  test('streams chat chunks through stop and reports incomplete termination', async () => {
    const stream = async function* () {
      yield { model: 'chat-model', choices: [{ delta: { content: 'hello' } }] };
      yield { model: 'chat-model', choices: [{ delta: {}, finish_reason: 'stop' }], usage: { total_tokens: 2 } };
    };
    mockCreate.mockResolvedValueOnce(stream());
    const client = new LLMClient({ api_key: 'test' });
    const chunks = [];
    for await (const chunk of client.chatStream([{ role: 'user', content: 'test' }])) chunks.push(chunk);
    expect(chunks.map(chunk => chunk.content)).toEqual(['hello', '']);
    expect(chunks[1].finish).toBe('stop');

    mockCreate.mockResolvedValueOnce((async function* () { yield { choices: [{ delta: { content: 'partial' } }] }; })());
    await expect(async () => {
      for await (const _chunk of client.chatStream([{ role: 'user', content: 'test' }])) { /* consume protocol stream */ }
    }).rejects.toMatchObject({ message: 'LLM 流式调用失败', providerCode: 'AI_PROVIDER_UNAVAILABLE' });
  });

  test('probes until the first useful token and aborts the remaining stream', async () => {
    const abort = jest.fn();
    const stream = (async function* () {
      yield { model: 'probe-model', choices: [{ delta: {} }] };
      yield { model: 'probe-model', choices: [{ delta: { content: ' first ' } }] };
      throw new Error('must stop after first token');
    })();
    stream.controller = { abort };
    mockCreate.mockResolvedValueOnce(stream);
    const client = new LLMClient({ api_key: 'test', timeout: 1000 });
    await expect(client.probe([{ role: 'user', content: 'test' }], { timeout_ms: 500 })).resolves.toMatchObject({
      content: ' first ', model: 'probe-model',
    });
    expect(mockCreate.mock.calls[0][1]).toMatchObject({ maxRetries: 0, timeout: 500 });
    expect(abort).toHaveBeenCalledTimes(1);
  });

  test('parses JSON inside an envelope and lists configured provider models', () => {
    const client = new LLMClient({ api_key: 'test' });
    expect(client._parseJSONContent('prefix {"ok":true} suffix')).toEqual({ ok: true });
    expect(LLMClient.getModelsForProvider('unknown-provider')).toEqual([]);
    expect(LLMClient.getProviderConfigs().openai.name).toBe('OpenAI');
  });

  test('initializes provider defaults and rebuilds the SDK when configuration changes', () => {
    const client = new LLMClient({ provider: 'alibaba', api_key: 'first', timeout: 0 });
    expect(mockOpenAI).toHaveBeenLastCalledWith(expect.objectContaining({
      apiKey: 'first', baseURL: 'https://dashscope.aliyuncs.com/api/v1', timeout: 180000, maxRetries: 2,
    }));
    expect(client.model).toBe('qwen-max');
    client.updateConfig({ provider: 'custom', base_url: 'https://custom.test/v1', api_key: 'second', model: 'local' });
    expect(mockOpenAI).toHaveBeenLastCalledWith(expect.objectContaining({ apiKey: 'second', baseURL: 'https://custom.test/v1' }));
    expect(client.model).toBe('local');
    const fallback = new LLMClient({ provider: 'unknown', api_key: 'test' });
    expect(fallback.model).toBe('gpt-4');
    expect(LLMClient.getModelsForProvider('custom')).toEqual([]);
  });

  test('uses safe constructor defaults and keeps explicit configuration', () => {
    const client = new LLMClient({ provider: 'custom', base_url: 'https://custom.test', model: 'm', api_key: 'key', timeout: 5000 });
    expect(client.model).toBe('m');
    expect(mockOpenAI).toHaveBeenLastCalledWith(expect.objectContaining({ apiKey: 'key', baseURL: 'https://custom.test', timeout: 5000 }));
    client.updateConfig({ temperature: 0.2 });
    expect(client.config.temperature).toBe(0.2);
  });

  test('warns when no API key is configured and falls back for unknown providers', () => {
    const logger = require('../../../packages/agent-runner-core/lib/logger');
    const client = new LLMClient({ provider: 'unknown-provider' });
    expect(client.model).toBe('gpt-4');
    expect(logger.warn).toHaveBeenCalledWith('LLMClient: No API key configured');
    expect(mockOpenAI).toHaveBeenLastCalledWith(expect.objectContaining({ apiKey: 'not-set', baseURL: '' }));
  });

  test('uses Responses token and retry options with empty content fallback', async () => {
    mockResponsesCreate.mockResolvedValueOnce({ status: 'completed', output: [], model: 'r2', usage: {} });
    const client = new LLMClient({ api_key: 'test', protocol: 'responses' });
    await expect(client.chat([{ role: 'user', content: 'test' }], { timeout_ms: 800, max_retries: 1, max_tokens: 10 }))
      .resolves.toMatchObject({ content: '', usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } });
    expect(mockResponsesCreate.mock.calls[0][1]).toEqual({ timeout: 800, maxRetries: 1 });
  });

  test('does not repair malformed JSON without an object envelope', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'not json' } }], model: 'm' });
    const client = new LLMClient({ api_key: 'test' });
    await expect(client.chatJSON([{ role: 'user', content: 'test' }], { json_repair: false })).rejects.toMatchObject({
      message: 'LLM 返回内容无法解析为 JSON', responseMetadata: { contentCharacters: 8, attempts: 1 },
    });
  });

  test('uses response_text directly and normalizes absent response usage', async () => {
    mockResponsesCreate.mockResolvedValueOnce({ status: 'completed', output_text: 'direct', model: 'r1' });
    const client = new LLMClient({ api_key: 'test', protocol: 'responses' });
    await expect(client.chat([{ role: 'user', content: 'test' }])).resolves.toMatchObject({
      content: 'direct', usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
    expect(mockResponsesCreate.mock.calls[0][0]).toMatchObject({ max_output_tokens: 4000, temperature: 0.7 });
  });

  test('forwards response-format options and defaults empty chat results safely', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{}], model: 'chat-model' });
    const client = new LLMClient({ api_key: 'test', temperature: 0, max_tokens: 0 });
    await expect(client.chat([{ role: 'user', content: 'test' }], {
      response_format: { type: 'json_object' }, temperature: 0, model: 'override',
    })).resolves.toMatchObject({ content: '', model: 'chat-model', usage: { total_tokens: 0 } });
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ model: 'override', temperature: 0, max_tokens: 4000, response_format: { type: 'json_object' } });
  });

  test('probe supports Responses streams and maps provider failures', async () => {
    const abort = jest.fn();
    const stream = (async function* () {
      yield { response: { model: 'response-probe' }, type: 'response.output_text.delta', delta: ' ready ' };
    })();
    stream.controller = { abort };
    mockResponsesCreate.mockResolvedValueOnce(stream);
    const client = new LLMClient({ api_key: 'test', protocol: 'responses', timeout: 1000 });
    await expect(client.probe([{ role: 'user', content: 'test' }])).resolves.toMatchObject({ content: ' ready ', model: 'response-probe' });
    expect(abort).toHaveBeenCalledTimes(1);

    mockResponsesCreate.mockRejectedValueOnce(Object.assign(new Error('slow'), { status: 429 }));
    await expect(client.probe([{ role: 'user', content: 'test' }], { timeout_ms: 1000 })).rejects.toMatchObject({
      message: '模型测试失败', providerCode: 'AI_PROVIDER_RATE_LIMITED',
    });
  });

  test('probe reports an empty stream as unavailable', async () => {
    mockCreate.mockResolvedValueOnce((async function* () {})());
    const client = new LLMClient({ api_key: 'test', timeout: 1000 });
    await expect(client.probe([{ role: 'user', content: 'test' }])).rejects.toMatchObject({
      message: '模型测试失败', providerCode: 'AI_PROVIDER_UNAVAILABLE',
    });
  });

  test('streams Responses deltas and requires a completed response', async () => {
    mockResponsesCreate.mockResolvedValueOnce((async function* () {
      yield { type: 'response.output_text.delta', delta: 'hello', response: { model: 'r1' } };
      yield { type: 'response.completed', response: { status: 'completed', model: 'r1', usage: { input_tokens: 2, output_tokens: 1, total_tokens: 3 } } };
    })());
    const client = new LLMClient({ api_key: 'test', protocol: 'responses' });
    const chunks = [];
    for await (const chunk of client.chatStream([{ role: 'user', content: 'test' }], { enable_thinking: false })) chunks.push(chunk);
    expect(chunks.map(chunk => chunk.content)).toEqual(['hello', '']);
    expect(chunks[1]).toMatchObject({ model: 'r1', finish: 'stop', usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } });
    expect(mockResponsesCreate.mock.calls[0][1]).toMatchObject({ maxRetries: 0 });

    mockResponsesCreate.mockResolvedValueOnce((async function* () {
      yield { type: 'response.failed' };
    })());
    await expect(async () => {
      for await (const _chunk of client.chatStream([{ role: 'user', content: 'test' }])) { /* consume protocol stream */ }
    }).rejects.toMatchObject({ message: 'LLM 流式调用失败', providerCode: 'AI_PROVIDER_UNAVAILABLE' });
  });

  test('rejects a non-stop chat finish reason and an incomplete Responses completion', async () => {
    const client = new LLMClient({ api_key: 'test' });
    mockCreate.mockResolvedValueOnce((async function* () {
      yield { choices: [{ finish_reason: 'length' }] };
    })());
    await expect(async () => {
      for await (const _chunk of client.chatStream([{ role: 'user', content: 'test' }])) { /* consume protocol stream */ }
    }).rejects.toMatchObject({ message: 'LLM 流式调用失败', providerCode: 'AI_PROVIDER_UNAVAILABLE' });

    const responsesClient = new LLMClient({ api_key: 'test', protocol: 'responses' });
    mockResponsesCreate.mockResolvedValueOnce((async function* () {
      yield { type: 'response.completed', response: { status: 'incomplete', model: 'r1' } };
    })());
    await expect(async () => {
      for await (const _chunk of responsesClient.chatStream([{ role: 'user', content: 'test' }])) { /* consume protocol stream */ }
    }).rejects.toMatchObject({ message: 'LLM 流式调用失败', providerCode: 'AI_PROVIDER_UNAVAILABLE' });
  });
});
