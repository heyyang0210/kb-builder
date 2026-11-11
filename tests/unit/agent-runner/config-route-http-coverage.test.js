const http = require('node:http');
const express = require('express');

const state = { model: null, mcp: null, presets: null, saved: [] };

jest.mock('../../../packages/agent-runner-core/lib/config-manager', () => ({
  getModelConfig: jest.fn(async () => state.model),
  getMCPConfig: jest.fn(async () => state.mcp),
  getAgentPresets: jest.fn(async () => state.presets),
  isApiKeyConfigured: jest.fn(config => Boolean(config && (config.api_key || config.api_key_encrypted))),
  save: jest.fn(async (name, value) => { state.saved.push([name, value]); }),
  saveAgentPreset: jest.fn(async preset => { state.presets = { presets: [preset], default_preset: preset.id }; }),
}));

jest.mock('../../../packages/agent-runner-core/lib/llm-client', () => class LLMClient {
  constructor() {}
  async chat() {
    if (state.llmError) throw new Error('测试连接失败');
    return { model: 'coverage-model', usage: { total_tokens: 3 } };
  }
});

jest.mock('../../../packages/agent-runner-core/lib/tools/mcp-client', () => ({
  MCPClient: class MCPClient {
    constructor() {}
    async testConnection() {
      if (state.mcpError) throw new Error('MCP 测试失败');
      return { success: true, message: 'MCP 连接成功' };
    }
  },
}));

const router = require('../../../packages/agent-runner-core/routes/config');

function request(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port: server.address().port, method, path,
      headers: { 'content-type': 'application/json' } }, res => {
      let text = '';
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => { let data; try { data = JSON.parse(text); } catch { data = text; } resolve({ status: res.statusCode, data }); });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('配置路由真实 HTTP 覆盖', () => {
  let server;
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/config', router);
    app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  });
  beforeEach(() => {
    state.model = null; state.mcp = null; state.presets = null; state.saved = [];
    state.llmError = false; state.mcpError = false;
  });
  afterAll(async () => new Promise(resolve => server.close(resolve)));

  test.each([
    ['GET', '/model', 'getModelConfig', undefined],
    ['GET', '/mcp', 'getMCPConfig', undefined],
    ['GET', '/agents', 'getAgentPresets', undefined],
    ['POST', '/model', 'getModelConfig', { provider: 'custom', model: 'm' }],
    ['POST', '/model', 'save', { provider: 'custom', model: 'm' }],
    ['POST', '/mcp', 'getMCPConfig', { server_url: 'http://mcp' }],
    ['POST', '/mcp', 'save', { server_url: 'http://mcp' }],
    ['POST', '/agent', 'saveAgentPreset', { id: 'p', name: '预设', steps: [{ name: '规划', agent: 'planner' }] }],
  ])('配置存储异常经统一处理且下一请求恢复 %s %s %s', async (method, endpoint, operation, body) => {
    const manager = require('../../../packages/agent-runner-core/lib/config-manager');
    manager[operation].mockRejectedValueOnce(new Error('隔离存储暂不可用'));
    const before = JSON.stringify(state.saved);
    expect(await request(server, method, '/api/config' + endpoint, body)).toEqual({ status: 500, data: { error: '隔离存储暂不可用' } });
    expect(JSON.stringify(state.saved)).toBe(before);
    expect((await request(server, method, '/api/config' + endpoint, body)).status).toBe(200);
  });

  test('模型和 MCP 缺省响应提供安全默认值', async () => {
    expect((await request(server, 'GET', '/api/config/model')).data).toMatchObject({ provider: null, temperature: 0.7, api_key_configured: false });
    expect((await request(server, 'GET', '/api/config/mcp')).data).toMatchObject({ server_url: null, timeout: 30000, cache: { enabled: true, ttl: 3600 } });
  });

  test('模型和 MCP 配置成功响应覆盖默认值与请求头映射', async () => {
    state.model = { provider: 'custom', model: 'm', base_url: 'http://m', temperature: 0, max_tokens: 1, api_key_encrypted: 'x' };
    state.mcp = { server_url: 'http://mcp', timeout: 0, headers: [
      { name: 'Secret', encrypted: true, value: 'hidden', description: 's' },
      { name: 'Plain', value: 'visible' },
    ] };
    expect((await request(server, 'GET', '/api/config/model')).data).toMatchObject({ provider: 'custom', temperature: 0.7, max_tokens: 1, api_key_configured: true });
    expect((await request(server, 'GET', '/api/config/mcp')).data.headers).toEqual([
      { name: 'Secret', value: '', encrypted: true, description: 's' },
      { name: 'Plain', value: 'visible', encrypted: false, description: '' },
    ]);
  });

  test('已存在但字段不完整的配置使用默认值并隐藏空请求头', async () => {
    state.model = { provider: 'custom', model: 'm' };
    expect((await request(server, 'GET', '/api/config/model')).data).toMatchObject({ max_tokens: 4000 });
    state.mcp = { server_url: 'http://mcp', timeout: 5000, cache: { enabled: false, ttl: 0 } };
    expect((await request(server, 'GET', '/api/config/mcp')).data).toMatchObject({ timeout: 5000, cache: { enabled: false, ttl: 0 }, headers: [] });
    state.mcp.headers = [{ name: 'Empty' }];
    expect((await request(server, 'GET', '/api/config/mcp')).data.headers).toEqual([{ name: 'Empty', value: '', encrypted: false, description: '' }]);
    state.presets = { default_preset: 'configured' };
    expect((await request(server, 'GET', '/api/config/agents')).data).toEqual({ presets: [], default_preset: 'configured' });
  });

  test('写入接口覆盖校验失败和成功路径', async () => {
    expect((await request(server, 'POST', '/api/config/model', { provider: 'bad' })).status).toBe(400);
    expect((await request(server, 'POST', '/api/config/model', { provider: 'custom', model: 'm' })).status).toBe(200);
    expect((await request(server, 'POST', '/api/config/mcp', { server_url: 'bad' })).status).toBe(400);
    expect((await request(server, 'POST', '/api/config/mcp', { server_url: 'http://mcp' })).status).toBe(200);
    expect((await request(server, 'POST', '/api/config/agent', { id: 'bad' })).status).toBe(400);
    const saved = await request(server, 'POST', '/api/config/agent', { id: 'p', name: '预设', steps: [{ name: '规划', agent: 'planner' }] });
    expect(saved.status).toBe(200);
  });

  test('Agent 预设列表映射和测试端点覆盖成功、缺失与异常', async () => {
    expect((await request(server, 'GET', '/api/config/agents')).data).toEqual({ presets: [], default_preset: 'default' });
    state.presets = { presets: [{ id: 'p', name: '预设', description: 'd', steps: [] }], default_preset: '' };
    expect((await request(server, 'GET', '/api/config/agents')).data.default_preset).toBe('default');
    expect((await request(server, 'POST', '/api/config/test-llm')).status).toBe(400);
    state.model = { provider: 'custom', model: 'm' };
    expect((await request(server, 'POST', '/api/config/test-llm')).data.success).toBe(true);
    state.llmError = true;
    expect((await request(server, 'POST', '/api/config/test-llm')).data.success).toBe(false);
    expect((await request(server, 'POST', '/api/config/test-mcp')).data.success).toBe(false);
    state.mcp = { server_url: 'http://mcp' };
    expect((await request(server, 'POST', '/api/config/test-mcp')).data.success).toBe(true);
    state.mcpError = true;
    expect((await request(server, 'POST', '/api/config/test-mcp')).status).toBe(500);
  });
});
