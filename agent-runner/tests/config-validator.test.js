const ConfigValidator = require('../lib/config-validator');

describe('ConfigValidator', () => {
  describe('validateModelConfig', () => {
    test('有效配置通过验证', () => {
      const result = ConfigValidator.validateModelConfig({
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 4000
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('缺少 provider 报错', () => {
      const result = ConfigValidator.validateModelConfig({ model: 'gpt-4' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('provider is required');
    });

    test('无效 provider 报错', () => {
      const result = ConfigValidator.validateModelConfig({
        provider: 'invalid',
        model: 'gpt-4'
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('provider must be one of'))).toBe(true);
    });

    test('缺少 model 报错', () => {
      const result = ConfigValidator.validateModelConfig({ provider: 'openai' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('model is required');
    });

    test('temperature 超出范围报错', () => {
      const result = ConfigValidator.validateModelConfig({
        provider: 'openai',
        model: 'gpt-4',
        temperature: 3
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('temperature'))).toBe(true);
    });

    test('max_tokens 为负数报错', () => {
      const result = ConfigValidator.validateModelConfig({
        provider: 'openai',
        model: 'gpt-4',
        max_tokens: -1
      });
      expect(result.valid).toBe(false);
    });

    test('所有 provider 类型都有效', () => {
      ['openai', 'alibaba', 'zhipu', 'custom'].forEach(provider => {
        const result = ConfigValidator.validateModelConfig({ provider, model: 'test' });
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('validateMCPConfig', () => {
    test('有效配置通过验证', () => {
      const result = ConfigValidator.validateMCPConfig({
        server_url: 'http://localhost:8080',
        timeout: 30000
      });
      expect(result.valid).toBe(true);
    });

    test('缺少 server_url 报错', () => {
      const result = ConfigValidator.validateMCPConfig({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('server_url is required');
    });

    test('无效 URL 报错', () => {
      const result = ConfigValidator.validateMCPConfig({
        server_url: 'not-a-url'
      });
      expect(result.valid).toBe(false);
    });

    test('timeout 过小报错', () => {
      const result = ConfigValidator.validateMCPConfig({
        server_url: 'http://localhost:8080',
        timeout: 100
      });
      expect(result.valid).toBe(false);
    });

    test('cache 配置验证', () => {
      const result = ConfigValidator.validateMCPConfig({
        server_url: 'http://localhost:8080',
        cache: { ttl: -1 }
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('validateAgentPreset', () => {
    test('有效预设通过验证', () => {
      const result = ConfigValidator.validateAgentPreset({
        id: 'test',
        name: '测试预设',
        steps: [{ name: 'plan', agent: 'planner', config: {} }]
      });
      expect(result.valid).toBe(true);
    });

    test('缺少 id 报错', () => {
      const result = ConfigValidator.validateAgentPreset({
        name: '测试',
        steps: [{ name: 'plan', agent: 'planner' }]
      });
      expect(result.valid).toBe(false);
    });

    test('空 steps 报错', () => {
      const result = ConfigValidator.validateAgentPreset({
        id: 'test',
        name: '测试',
        steps: []
      });
      expect(result.valid).toBe(false);
    });

    test('无效 agent 类型报错', () => {
      const result = ConfigValidator.validateAgentPreset({
        id: 'test',
        name: '测试',
        steps: [{ name: 'plan', agent: 'invalid_agent' }]
      });
      expect(result.valid).toBe(false);
    });

    test('step 缺少 name 报错', () => {
      const result = ConfigValidator.validateAgentPreset({
        id: 'test',
        name: '测试',
        steps: [{ agent: 'planner' }]
      });
      expect(result.valid).toBe(false);
    });
  });
});
