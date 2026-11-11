const Validator = require('../../../packages/agent-runner-core/lib/config-validator');

describe('配置校验数值及加密头边界', () => {
  test.each([
    ['temperature', '1', 'temperature must be a number between 0 and 2'],
    ['temperature', -0.01, 'temperature must be a number between 0 and 2'],
    ['max_tokens', '1', 'max_tokens must be a positive number'],
    ['max_tokens', 0, 'max_tokens must be a positive number'],
  ])('模型字段%s拒绝非法值%j', (key, value, error) => {
    expect(Validator.validateModelConfig({ provider: 'custom', model: 'test', [key]: value }))
      .toEqual({ valid: false, errors: [error] });
  });
  test.each([0, 2])('温度边界%s与最小token通过', temperature => {
    expect(Validator.validateModelConfig({ provider: 'custom', model: 'test', temperature, max_tokens: 1 }))
      .toEqual({ valid: true, errors: [] });
  });
  test.each([
    [{ timeout: '1000' }, 'timeout must be a number >= 1000ms'],
    [{ cache: { ttl: '0' } }, 'cache.ttl must be a non-negative number'],
    [{ cache: { max_size: '1' } }, 'cache.max_size must be a positive number'],
    [{ cache: { max_size: 0 } }, 'cache.max_size must be a positive number'],
    [{ headers: [{ encrypted: false }] }, 'header[0].name is required and must be a string'],
    [{ headers: [{ name: 1, encrypted: false }] }, 'header[0].name is required and must be a string'],
    [{ headers: [{ name: 'Token' }] }, 'header[0].encrypted is required'],
    [{ headers: [{ name: 'Token', encrypted: true }] }, 'header[0].value is required when encrypted=true'],
  ])('MCP异常配置%j返回明确错误', (config, error) => {
    expect(Validator.validateMCPConfig({ server_url: 'http://localhost', ...config }))
      .toEqual({ valid: false, errors: [error] });
  });
  test.each([
    {}, { ttl: 0 }, { max_size: 1 }, { ttl: 0, max_size: 1 },
  ])('缓存合法边界%j通过', cache => {
    expect(Validator.validateMCPConfig({ server_url: 'http://localhost', timeout: 1000, cache }))
      .toEqual({ valid: true, errors: [] });
  });
  test.each([
    { name: 'Token', encrypted: false },
    { name: 'Token', encrypted: true, value: 'plaintext-fixture' },
    { name: 'Token', encrypted: true, value_encrypted: 'ciphertext-fixture' },
  ])('加密头合法输入%j通过', header => {
    expect(Validator.validateMCPConfig({ server_url: 'http://localhost', headers: [header] }))
      .toEqual({ valid: true, errors: [] });
  });
  test('预设收集缺失名称、步骤及agent错误', () => {
    expect(Validator.validateAgentPreset({ id: 'preset' }))
      .toEqual({ valid: false, errors: ['name is required', 'at least one step is required'] });
    expect(Validator.validateAgentPreset({ id: 'preset', name: '测试', steps: [{ name: 'step' }] }))
      .toEqual({ valid: false, errors: ['step[0].agent is required'] });
  });
});
