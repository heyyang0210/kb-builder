const express = require('express');
const router = express.Router();
const configManager = require('../lib/config-manager');
const ConfigValidator = require('../lib/config-validator');
const logger = require('../lib/logger');

// GET /api/config/model - 获取模型配置
router.get('/model', async (req, res, next) => {
  try {
    const config = await configManager.getModelConfig();
    if (!config) {
      return res.json({
        provider: null,
        model: null,
        base_url: null,
        temperature: 0.7,
        max_tokens: 4000,
        api_key_configured: false
      });
    }

    res.json({
      provider: config.provider,
      model: config.model,
      base_url: config.base_url,
      temperature: config.temperature || 0.7,
      max_tokens: config.max_tokens || 4000,
      api_key_configured: configManager.isApiKeyConfigured(config)
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/config/model - 更新模型配置
router.post('/model', async (req, res, next) => {
  try {
    const config = req.body;
    const validation = ConfigValidator.validateModelConfig(config);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: validation.errors.join('; ') }
      });
    }

    const existing = await configManager.getModelConfig() || {};
    const merged = { ...existing, ...config };
    await configManager.save('model-config', merged);

    logger.info('Model config updated', { provider: config.provider, model: config.model });
    res.json({ success: true, message: '模型配置已保存' });
  } catch (err) {
    next(err);
  }
});

// GET /api/config/mcp - 获取 MCP 配置
router.get('/mcp', async (req, res, next) => {
  try {
    const config = await configManager.getMCPConfig();
    if (!config) {
      return res.json({
        server_url: null,
        timeout: 30000,
        api_key_configured: false,
        cache: { enabled: true, ttl: 3600 }
      });
    }

    // 处理 headers：加密的标头不返回值，只返回名称和描述
    const headers = (config.headers || []).map(h => ({
      name: h.name,
      value: h.encrypted ? '' : (h.value || ''),
      encrypted: h.encrypted || false,
      description: h.description || ''
    }));

    res.json({
      server_url: config.server_url,
      timeout: config.timeout || 30000,
      api_key_configured: configManager.isApiKeyConfigured(config),
      cache: config.cache || { enabled: true, ttl: 3600 },
      headers: headers
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/config/mcp - 更新 MCP 配置
router.post('/mcp', async (req, res, next) => {
  try {
    const config = req.body;
    const validation = ConfigValidator.validateMCPConfig(config);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: validation.errors.join('; ') }
      });
    }

    const existing = await configManager.getMCPConfig() || {};
    const merged = { ...existing, ...config };
    await configManager.save('mcp-config', merged);

    logger.info('MCP config updated', { server_url: config.server_url });
    res.json({ success: true, message: 'MCP 配置已保存' });
  } catch (err) {
    next(err);
  }
});

// GET /api/config/agents - 获取 Agent 预设列表
router.get('/agents', async (req, res, next) => {
  try {
    const presets = await configManager.getAgentPresets();
    if (!presets) {
      return res.json({ presets: [], default_preset: 'default' });
    }

    const safePresets = (presets.presets || []).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      steps: p.steps
    }));

    res.json({ presets: safePresets, default_preset: presets.default_preset || 'default' });
  } catch (err) {
    next(err);
  }
});

// POST /api/config/agent - 保存 Agent 预设
router.post('/agent', async (req, res, next) => {
  try {
    const preset = req.body;
    const validation = ConfigValidator.validateAgentPreset(preset);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: validation.errors.join('; ') }
      });
    }

    await configManager.saveAgentPreset(preset);
    logger.info('Agent preset saved', { id: preset.id, name: preset.name });
    res.json({ success: true, message: 'Agent 预设已保存' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

// POST /api/config/test-llm - 测试 LLM 连接
router.post('/test-llm', async (req, res, next) => {
  try {
    const config = await configManager.getModelConfig();
    if (!config) {
      return res.status(400).json({
        success: false,
        error: { code: 'CONFIG_MISSING', message: '模型配置不存在' }
      });
    }

    const LLMClient = require('../lib/llm-client');
    const client = new LLMClient(config);

    // 发送一个简单的测试请求
    const response = await client.chat([
      { role: 'user', content: 'Hi' }
    ], { max_tokens: 10 });

    logger.info('LLM 连接测试成功', { 
      provider: config.provider, 
      model: config.model,
      tokens: response.usage?.total_tokens 
    });

    res.json({ 
      success: true, 
      message: 'LLM 连接成功',
      model: response.model,
      tokens: response.usage?.total_tokens
    });
  } catch (err) {
    logger.error('LLM 连接测试失败', { error: err.message });
    res.json({ 
      success: false, 
      message: 'LLM 连接失败: ' + err.message 
    });
  }
});

// POST /api/config/test-mcp - 测试 MCP 连接
router.post('/test-mcp', async (req, res, next) => {
  try {
    const config = await configManager.getMCPConfig();
    if (!config || !config.server_url) {
      return res.json({ success: false, message: 'MCP 未配置' });
    }

    const MCPClient = require('../lib/tools/mcp-client').MCPClient;
    const client = new MCPClient(config);
    const result = await client.testConnection();
    
    res.json(result);
  } catch (err) {
    next(err);
  }
});
