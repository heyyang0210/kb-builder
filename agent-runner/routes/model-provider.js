const express = require('express');
const configManager = require('../lib/config-manager');
const ConfigValidator = require('../lib/config-validator');
const LLMClient = require('../lib/llm-client');
const logger = require('../lib/logger');

const router = express.Router();

function isLoopback(address = '') {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
}

function authorizeInternalRequest(req, res, next) {
  const configuredToken = process.env.MODEL_GATEWAY_INTERNAL_TOKEN;
  const suppliedToken = req.get('X-Internal-Token');
  if (configuredToken) {
    if (suppliedToken === configuredToken) return next();
  } else if (isLoopback(req.ip || req.socket?.remoteAddress)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: { code: 'MODEL_GATEWAY_FORBIDDEN', message: '模型网关仅允许内部服务访问' }
  });
}

async function loadConfiguredProvider() {
  const config = await configManager.getModelConfig();
  if (!config || !config.model || !configManager.isApiKeyConfigured(config)) {
    const error = new Error('模型 Provider 尚未完整配置');
    error.code = 'MODEL_PROVIDER_NOT_CONFIGURED';
    throw error;
  }
  return { config, client: new LLMClient(config) };
}

function providerError(res, error) {
  const code = error.code === 'MODEL_PROVIDER_NOT_CONFIGURED'
    ? error.code
    : 'MODEL_PROVIDER_CALL_FAILED';
  const status = code === 'MODEL_PROVIDER_NOT_CONFIGURED' ? 503 : 502;
  logger.error('Model gateway request failed', { code, error: error.message });
  return res.status(status).json({
    success: false,
    error: {
      code,
      message: error.message,
      retryable: status === 502,
      responseMetadata: error.responseMetadata || null
    }
  });
}

function errorSummary(error) {
  const message = String(error?.message || error || '未知错误');
  const normalized = message.toLowerCase();
  if (normalized.includes('country, region, or territory not supported')) return '模型服务拒绝访问（HTTP 403，当前网络所在国家或地区不受支持）';
  if (/\b(http\s*)?401\b/.test(normalized)) return '模型服务身份认证失败（HTTP 401）';
  if (/\b(http\s*)?403\b/.test(normalized)) return '模型服务拒绝访问（HTTP 403）';
  if (/\b(http\s*)?429\b/.test(normalized)) return '模型服务请求过于频繁（HTTP 429）';
  if (normalized.includes('connection refused') || normalized.includes('econnrefused')) return '模型服务连接失败';
  if (normalized.includes('timeout') || normalized.includes('timed out')) return '模型调用超时';
  if (normalized.includes('json')) return '模型返回格式不正确';
  const serverError = normalized.match(/\b(?:http\s*)?(5\d{2})\b/);
  if (serverError) return `模型服务暂时不可用（HTTP ${serverError[1]}）`;
  return '模型服务返回错误';
}

function safeStatus(config) {
  const configured = Boolean(config?.model && configManager.isApiKeyConfigured(config));
  return {
    success: true,
    provider: config?.provider || null,
    model: config?.model || null,
    baseUrl: config?.base_url || null,
    temperature: config?.temperature ?? 0.7,
    maxTokens: config?.max_tokens || 4000,
    timeoutMs: config?.timeout || 180000,
    apiKeyConfigured: configManager.isApiKeyConfigured(config),
    configured,
    capabilities: { chat: configured, vision: configured, embedding: false }
  };
}

router.use(authorizeInternalRequest);

router.get('/status', async (_req, res) => {
  const config = await configManager.getModelConfig();
  res.json(safeStatus(config));
});

router.post('/config', async (req, res) => {
  const existing = await configManager.getModelConfig() || {};
  const update = { ...(req.body || {}) };
  if (!update.api_key) delete update.api_key;
  const merged = { ...existing, ...update };
  const validation = ConfigValidator.validateModelConfig(merged);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: { code: 'MODEL_CONFIG_INVALID', message: validation.errors.join('；') }
    });
  }
  await configManager.save('model-config', merged);
  return res.json({ ...safeStatus(merged), message: '模型配置已保存，继续加工前请重新测试连接' });
});

router.post('/test', async (_req, res) => {
  const startedAt = Date.now();
  try {
    const { config, client } = await loadConfiguredProvider();
    const result = await client.chatJSON([
      {
        role: 'system',
        content: '你是连接测试器。只返回 JSON 对象，字段必须为 status 和 message。'
      },
      {
        role: 'user',
        content: '请返回 {"status":"ok","message":"模型连接正常"}'
      }
    ], { temperature: 0, max_tokens: 80, timeout_ms: 45000, max_retries: 0 });
    const schemaPassed = result.parsed?.status === 'ok' && typeof result.parsed?.message === 'string';
    if (!schemaPassed) throw new Error('模型返回结果不符合连接测试输出结构');
    return res.json({
      success: true,
      provider: config.provider,
      model: result.model || config.model,
      baseUrl: config.base_url || null,
      latencyMs: Date.now() - startedAt,
      tokens: result.usage?.total_tokens || 0,
      schemaPassed,
      testedAt: new Date().toISOString(),
      message: '模型连接和结构化输出测试成功'
    });
  } catch (error) {
    logger.error('Model gateway structured test failed', { error: error.message });
    return res.status(502).json({
      success: false,
      latencyMs: Date.now() - startedAt,
      schemaPassed: false,
      testedAt: new Date().toISOString(),
      error: {
        code: 'MODEL_PROVIDER_TEST_FAILED',
        message: errorSummary(error),
        technicalMessage: error.message,
        retryable: true
      }
    });
  }
});

router.post('/chat', async (req, res) => {
  const { messages, responseFormat = 'text', options = {} } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'MODEL_GATEWAY_INVALID_REQUEST', message: 'messages 必须是非空数组' }
    });
  }
  try {
    const { config, client } = await loadConfiguredProvider();
    const result = responseFormat === 'json'
      ? await client.chatJSON(messages, options)
      : await client.chat(messages, options);
    return res.json({
      success: true,
      provider: config.provider,
      model: result.model || config.model,
      content: result.content,
      data: result.parsed,
      usage: result.usage,
      finishReason: result.finish_reason,
      attempts: result.attempts || 1
    });
  } catch (error) {
    return providerError(res, error);
  }
});

router.post('/vision', async (req, res) => {
  const { messages, options = {} } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'MODEL_GATEWAY_INVALID_REQUEST', message: 'messages 必须是非空数组' }
    });
  }
  try {
    const { config, client } = await loadConfiguredProvider();
    const result = await client.chat(messages, options);
    return res.json({
      success: true,
      provider: config.provider,
      model: result.model || config.model,
      content: result.content,
      usage: result.usage,
      finishReason: result.finish_reason
    });
  } catch (error) {
    return providerError(res, error);
  }
});

router.post('/embedding', (_req, res) => res.status(501).json({
  success: false,
  error: {
    code: 'CAPABILITY_UNAVAILABLE',
    message: '当前模型配置未提供独立 Embedding 能力',
    retryable: false
  }
}));

module.exports = router;
module.exports.isLoopback = isLoopback;
module.exports.authorizeInternalRequest = authorizeInternalRequest;
module.exports.errorSummary = errorSummary;
module.exports.safeStatus = safeStatus;
