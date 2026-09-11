const path = require('path');
const { loadRuntimeEnv } = require('../../../packages/agent-runner-core/lib/runtime-env');
loadRuntimeEnv({ rootDir: path.resolve(__dirname, '../../..') });
const LLMClient = require('../../../packages/agent-runner-core/lib/llm-client');
const configManager = require('../../../packages/agent-runner-core/lib/config-manager');

async function testLLMConnection() {
  console.log('=== LLM 连接测试 ===\n');
  
  // 1. 读取配置
  const config = await configManager.getModelConfig();
  if (!config) {
    console.error('❌ 配置不存在');
    return;
  }
  
  console.log('当前配置:');
  console.log('  Provider:', config.provider);
  console.log('  Base URL:', config.base_url);
  console.log('  Model:', config.model);
  console.log('  API Key:', config.api_key ? '已配置 (' + config.api_key.substring(0, 10) + '...)' : '❌ 未配置');
  console.log();
  
  // 2. 创建 LLM Client
  console.log('创建 LLM Client...');
  const client = new LLMClient(config);
  console.log('✅ LLM Client 创建成功\n');
  
  // 3. 测试连接
  console.log('发送测试请求...');
  try {
    const response = await client.chat([
      { role: 'user', content: 'Hi' }
    ], { max_tokens: 10 });
    
    console.log('✅ LLM 连接成功!');
    console.log('  Model:', response.model);
    console.log('  Response:', response.content);
    console.log('  Tokens:', response.usage?.total_tokens);
  } catch (error) {
    console.error('❌ LLM 连接失败!');
    console.error('  错误:', error.message);
    
    // 尝试诊断问题
    console.log('\n=== 问题诊断 ===');
    if (error.message.includes('401')) {
      console.log('问题: API Key 认证失败 (401)');
      console.log('可能原因:');
      console.log('  1. API Key 无效或已过期');
      console.log('  2. API Key 格式不正确');
      console.log('  3. Base URL 不正确');
      console.log('  4. 中转站配置问题');
    } else if (error.message.includes('404')) {
      console.log('问题: 接口不存在 (404)');
      console.log('可能原因:');
      console.log('  1. Base URL 不正确');
      console.log('  2. Model 名称不正确');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('问题: 无法连接到服务器');
      console.log('可能原因:');
      console.log('  1. Base URL 不正确');
      console.log('  2. 网络连接问题');
    }
  }
}

testLLMConnection().catch(console.error);
