const OpenAI = require('openai');
const logger = require('./logger');

function classifyProviderError(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  const text = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  if (status === 401 || status === 403 && /(api.?key|auth|unauthori[sz]ed|forbidden)/.test(text)) return 'AI_PROVIDER_AUTH_FAILED';
  if (status === 403 && /(country|region|territory|unsupported)/.test(text)) return 'AI_PROVIDER_REGION_UNSUPPORTED';
  if (status === 429 || /(rate.?limit|too many requests)/.test(text)) return 'AI_PROVIDER_RATE_LIMITED';
  if (status === 408 || error?.name === 'APITimeoutError' || /timeout|timed out/.test(text)) return 'AI_PROVIDER_TIMEOUT';
  return 'AI_PROVIDER_UNAVAILABLE';
}

const PROVIDER_CONFIGS = {
  openai: {
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
  },
  alibaba: {
    name: '阿里云百炼',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo']
  },
  zhipu: {
    name: '智谱 AI',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4', 'glm-3-turbo']
  },
  custom: {
    name: '自定义',
    defaultBaseUrl: '',
    models: []
  }
};

class LLMClient {
  constructor(config = {}) {
    this.config = config;
    this.client = null;
    this._initClient();
  }

  _initClient() {
    const provider = this.config.provider || 'openai';
    const providerConfig = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.custom;

    const baseURL = this.config.base_url || providerConfig.defaultBaseUrl;
    const apiKey = this.config.api_key || 'not-set';

    if (!this.config.api_key) {
      logger.warn('LLMClient: No API key configured');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
      timeout: this.config.timeout || 180000,
      fetchOptions: { redirect: 'error' },
      maxRetries: 2
    });

    this.model = this.config.model || providerConfig.models[0] || 'gpt-4';
    logger.debug(`LLMClient initialized: provider=${provider}, model=${this.model}`);
  }

  updateConfig(config) {
    Object.assign(this.config, config);
    this._initClient();
  }

  async chat(messages, options = {}) {
    const model = options.model || this.model;
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;
    const maxTokens = options.max_tokens || this.config.max_tokens || 4000;

    logger.info(`LLM call: model=${model}, messages=${messages.length}, temperature=${temperature}`);

    try {
      const requestOptions = {};
      if (Number.isFinite(options.timeout_ms)) requestOptions.timeout = options.timeout_ms;
      if (Number.isInteger(options.max_retries)) requestOptions.maxRetries = options.max_retries;
      if (this.config.protocol === 'responses') {
        const response = await this.client.responses.create({
          model, input: messages, temperature, max_output_tokens: maxTokens,
        }, requestOptions);
        if (response.status && response.status !== 'completed') throw new Error('模型响应未完成');
        return {
          content: response.output_text || (response.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join(''),
          model: response.model,
          usage: { prompt_tokens: response.usage?.input_tokens || 0, completion_tokens: response.usage?.output_tokens || 0, total_tokens: response.usage?.total_tokens || 0 },
          finish_reason: 'stop',
        };
      }
      const response = await this.client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(typeof options.enable_thinking === 'boolean' ? { enable_thinking: options.enable_thinking } : {}),
        ...(options.chat_template_kwargs ? { chat_template_kwargs: options.chat_template_kwargs } : {}),
        ...(options.response_format ? { response_format: options.response_format } : {})
      }, requestOptions);

      const content = response.choices[0]?.message?.content || '';
      const usage = response.usage || {};

      logger.info(`LLM response: tokens=${usage.total_tokens || '?'}`);

      return {
        content,
        usage: {
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0,
          total_tokens: usage.total_tokens || 0
        },
        model: response.model,
        finish_reason: response.choices[0]?.finish_reason
      };
    } catch (error) {
      const failure = new Error('LLM 调用失败');
      failure.code = 'LLM_PROVIDER_ERROR';
      failure.providerCode = classifyProviderError(error);
      failure.status = Number(error?.status || error?.statusCode || 0) || undefined;
      logger.error('LLM call failed', { model, provider: this.config.provider, status: failure.status, providerCode: failure.providerCode });
      throw failure;
    }
  }

  // Connection tests only need the first useful token. Stop the stream once it
  // arrives so a slow or verbose model does not hold the admin screen open.
  async probe(messages, options = {}) {
    const model = options.model || this.model;
    const started = Date.now();
    const controller = new AbortController();
    let timedOut = false; let stream;
    const deadline = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeout_ms ?? this.config.timeout);
    try {
      const requestOptions = { timeout: options.timeout_ms, maxRetries: 0, signal: controller.signal };
      const responses = this.config.protocol === 'responses';
      stream = responses
        ? await this.client.responses.create({ model, input: messages, max_output_tokens: options.max_tokens, stream: true }, requestOptions)
        : await this.client.chat.completions.create({ model, messages, max_tokens: options.max_tokens, stream: true }, requestOptions);
      let actualModel = null;
      for await (const chunk of stream) {
        actualModel ||= responses ? chunk.response?.model : chunk.model;
        if (chunk.type === 'error' || chunk.type === 'response.failed') throw new Error('Provider stream failed');
        const content = responses
          ? (chunk.type === 'response.output_text.delta' ? chunk.delta : '')
          : chunk.choices?.[0]?.delta?.content;
        if (typeof content === 'string' && content.trim()) {
          const firstByteMs = Date.now() - started;
          return { content, model: actualModel, firstByteMs, totalMs: Date.now() - started };
        }
      }
      throw new Error('Empty provider stream');
    } catch (error) {
      const failure = new Error('模型测试失败');
      failure.providerCode = timedOut ? 'AI_PROVIDER_TIMEOUT' : classifyProviderError(error);
      throw failure;
    } finally {
      clearTimeout(deadline);
      controller.abort();
      stream?.controller?.abort();
    }
  }

  async chatJSON(messages, options = {}) {
    const result = await this.chat(messages, {
      ...options,
      response_format: { type: 'json_object' }
    });

    try {
      return { ...result, parsed: this._parseJSONContent(result.content), attempts: 1 };
    } catch (error) {
      if (options.json_repair === false) {
        error.responseMetadata = {
          contentCharacters: result.content.length,
          usage: result.usage,
          finishReason: result.finish_reason,
          attempts: 1
        };
        throw error;
      }
      logger.warn('Failed to parse JSON from LLM response, attempting one repair');
      const repairResult = await this.chat([
        {
          role: 'system',
          content: '你是 JSON 修复器。只修复输入中的 JSON 语法，保留原有字段和值，只返回一个 JSON 对象，不得解释。'
        },
        { role: 'user', content: result.content.slice(0, 30000) }
      ], {
        ...options,
        max_tokens: Math.min(options.max_tokens || 2000, 2000),
        response_format: { type: 'json_object' }
      });
      return { ...repairResult, parsed: this._parseJSONContent(repairResult.content), attempts: 2 };
    }
  }

  async *chatStream(messages, options = {}) {
    const model = options.model || this.model;
    const temperature = options.temperature ?? this.config.temperature ?? 0.7;
    const maxTokens = options.max_tokens || this.config.max_tokens || 4000;
    const requestOptions = { maxRetries: 0, signal: options.signal };
    if (Number.isFinite(options.timeout_ms)) requestOptions.timeout = options.timeout_ms;
    const responses = this.config.protocol === 'responses';
    let stream; let completed = false;
    try {
      stream = responses
        ? await this.client.responses.create({ model, input: messages, temperature, max_output_tokens: maxTokens, stream: true }, requestOptions)
        : await this.client.chat.completions.create({ model, messages, temperature, max_tokens: maxTokens, stream: true,
          ...(typeof options.enable_thinking === 'boolean' ? { enable_thinking: options.enable_thinking } : {}) }, requestOptions);
      for await (const chunk of stream) {
        if (['error', 'response.failed', 'response.incomplete'].includes(chunk.type)) throw new Error('模型响应未完成');
        const response = chunk.response;
        if (responses && chunk.type === 'response.completed') {
          if (response?.status && response.status !== 'completed') throw new Error('模型响应未完成');
          completed = true;
        }
        if (!responses && chunk.choices?.[0]?.finish_reason) {
          if (chunk.choices[0].finish_reason !== 'stop') throw new Error('模型响应未完成');
          completed = true;
        }
        const usage = responses && response?.usage
          ? { prompt_tokens: response.usage.input_tokens, completion_tokens: response.usage.output_tokens, total_tokens: response.usage.total_tokens }
          : chunk.usage;
        const content = responses ? (chunk.type === 'response.output_text.delta' ? chunk.delta : '') : chunk.choices?.[0]?.delta?.content || '';
        yield { content, model: responses ? response?.model : chunk.model, usage, finish: responses ? (chunk.type === 'response.completed' ? 'stop' : null) : chunk.choices?.[0]?.finish_reason };
      }
      if (!completed) throw new Error('模型响应流意外结束');
    } catch (error) {
      const failure = new Error('LLM 流式调用失败');
      failure.providerCode = classifyProviderError(error);
      throw failure;
    } finally { stream?.controller?.abort(); }
  }

  _parseJSONContent(content) {
    try {
      return JSON.parse(content);
    } catch (error) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      throw new Error('LLM 返回内容无法解析为 JSON');
    }
  }

  static getProviderConfigs() {
    return PROVIDER_CONFIGS;
  }

  static getModelsForProvider(provider) {
    return PROVIDER_CONFIGS[provider]?.models || [];
  }
}

module.exports = LLMClient;
module.exports.classifyProviderError = classifyProviderError;
