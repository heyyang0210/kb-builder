const OpenAI = require('openai');
const logger = require('./logger');

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
      const response = await this.client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(typeof options.enable_thinking === 'boolean' ? { enable_thinking: options.enable_thinking } : {}),
        ...(options.chat_template_kwargs ? { chat_template_kwargs: options.chat_template_kwargs } : {}),
        ...(options.response_format || {})
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
      logger.error(`LLM call failed: ${error.message}`, { model, provider: this.config.provider });
      throw new Error(`LLM 调用失败: ${error.message}`);
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
