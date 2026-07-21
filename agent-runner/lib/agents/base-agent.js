const LLMClient = require('../llm-client');
const logger = require('../logger');

class BaseAgent {
  constructor(name, description, config = {}) {
    this.name = name;
    this.description = description;
    this.config = config;
    this.llmClient = new LLMClient(config);
    this.onDetail = null;
  }

  setOnDetail(callback) {
    this.onDetail = callback;
  }

  _emitDetail(detail) {
    if (this.onDetail) {
      this.onDetail(detail);
    }
  }

  _summarizeMessages(messages) {
    const system = messages[0]?.content || '';
    const user = messages[1]?.content || '';
    return {
      message_count: messages.length,
      system_prompt_length: system.length,
      user_prompt_length: user.length
    };
  }

  async execute(input, stepConfig = {}) {
    const startTime = Date.now();

    logger.info(`[${this.name}] Starting execution`, { inputKeys: Object.keys(input) });

    // 1. 验证输入
    this.validateInput(input);

    // 2. 构建提示词
    const messages = this.buildPrompt(input, stepConfig);
    
    logger.info(`[${this.name}] Prompt built`, { 
      messageCount: messages.length,
      systemLength: messages[0]?.content?.length || 0,
      userLength: messages[1]?.content?.length || 0
    });

    // 3. 调用大模型
    const llmStartTime = Date.now();
    const inputSummary = this._summarizeMessages(messages);

    this._emitDetail({
      type: 'llm_call',
      name: '调用大模型',
      agent: this.name,
      status: 'running',
      message: `正在调用 ${this.config.model || stepConfig.model || 'LLM'} 生成 ${this.description}`,
      model: stepConfig.model || this.config.model,
      provider: this.config.provider,
      input_summary: inputSummary,
      timestamp: Date.now()
    });

    let response;
    try {
      response = await this.callLLM(messages, stepConfig);
    } catch (err) {
      this._emitDetail({
        type: 'llm_call',
        name: '调用大模型失败',
        agent: this.name,
        status: 'failed',
        message: `大模型调用失败：${err.message}`,
        model: stepConfig.model || this.config.model,
        provider: this.config.provider,
        input_summary: inputSummary,
        error: err.message,
        duration: Date.now() - llmStartTime,
        timestamp: Date.now()
      });
      throw err;
    }

    const llmDuration = Date.now() - llmStartTime;

    // 发送 LLM 调用详情
    this._emitDetail({
      type: 'llm_call',
      name: '大模型调用完成',
      agent: this.name,
      model: response.model || this.config.model,
      provider: response.provider || this.config.provider,
      message: `大模型调用完成，输出 ${response.content?.length || 0} 字符`,
      input_summary: inputSummary,
      output_summary: {
        content_length: response.content?.length || 0,
        tokens: response.usage
      },
      status: 'success',
      duration: llmDuration,
      tokens: response.usage?.total_tokens || 0,
      timestamp: Date.now()
    });

    logger.info(`[${this.name}] LLM call completed`, { 
      duration: `${llmDuration}ms`,
      tokens: response.usage?.total_tokens || 0
    });

    // 4. 解析响应
    const output = await this.parseResponse(response, input);

    // 5. 验证输出
    this.validateOutput(output);

    const duration = Date.now() - startTime;
    logger.info(`[${this.name}] Execution completed`, { duration: `${duration}ms` });

    return {
      ...output,
      _meta: {
        agent: this.name,
        duration,
        tokens: response.usage,
        model: response.model,
        provider: response.provider
      }
    };
  }

  async callLLM(messages, stepConfig = {}) {
    const wantsJSON = this.getOutputFormat() === 'json';

    if (wantsJSON) {
      return this.llmClient.chatJSON(messages, {
        model: stepConfig.model,
        temperature: stepConfig.temperature ?? this.config.temperature,
        max_tokens: stepConfig.max_tokens || this.config.max_tokens
      });
    }

    return this.llmClient.chat(messages, {
      model: stepConfig.model,
      temperature: stepConfig.temperature ?? this.config.temperature,
      max_tokens: stepConfig.max_tokens || this.config.max_tokens
    });
  }

  validateInput(input) {
    // 子类实现具体验证
    return true;
  }

  validateOutput(output) {
    // 子类实现具体验证
    return true;
  }

  buildPrompt(input, stepConfig) {
    throw new Error(`${this.name}: buildPrompt() must be implemented by subclass`);
  }

  parseResponse(response, input) {
    throw new Error(`${this.name}: parseResponse() must be implemented by subclass`);
  }

  getOutputFormat() {
    return 'markdown'; // 默认 markdown，子类可覆盖
  }

  loadPromptTemplate(templateName) {
    const fs = require('fs');
    const path = require('path');
    const templatePath = path.join(__dirname, '..', '..', '..', 'prompts', templateName);

    try {
      const content = fs.readFileSync(templatePath, 'utf-8');
      logger.info(`[${this.name}] Loaded prompt template: ${templateName}`);
      return content;
    } catch (err) {
      logger.warn(`[${this.name}] Prompt template not found: ${templateName}, using inline prompt`);
      return null;
    }
  }
}

module.exports = BaseAgent;
