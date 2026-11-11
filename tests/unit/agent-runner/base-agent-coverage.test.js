const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const BaseAgent = require('../../../packages/agent-runner-core/lib/agents/base-agent');

let server, origin, failure, requests;
const contextKeys = ['__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__', '__KNOWLEDGE_PLATFORM_CONTEXT__'];
let previous;
beforeEach(() => {
  previous = contextKeys.map(key => Object.getOwnPropertyDescriptor(global, key));
  contextKeys.forEach(key => delete global[key]);
  failure = false; requests = [];
});
afterEach(() => contextKeys.forEach((key, index) => {
  delete global[key];
  if (previous[index]) Object.defineProperty(global, key, previous[index]);
}));
beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw); requests.push({ url: req.url, body });
    res.setHeader('content-type', 'application/json');
    if (failure) { res.statusCode = 401; res.end(JSON.stringify({ error: { message: '测试认证失败', type: 'authentication_error' } })); return; }
    res.end(JSON.stringify({ model: body.model, choices: [{ message: { content: body.response_format ? '{"answer":"完成"}' : '# 完成' }, finish_reason: 'stop' }], usage: { total_tokens: 3 } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}/v1`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
function agent(config = {}) {
  const instance = new BaseAgent('fixture', '测试内容', { provider: 'custom', base_url: origin, api_key: 'fixture', ...config });
  instance.buildPrompt = () => [{ role: 'system', content: '规则' }, { role: 'user', content: '请求' }];
  instance.parseResponse = response => ({ answer: response.parsed?.answer || response.content });
  return instance;
}

test('Markdown真实HTTP执行使用步骤参数，发出完整事件和可追溯输出', async () => {
  const instance = agent({ model: 'configured', temperature: 0.8, max_tokens: 300 });
  const events = []; instance.setOnDetail(detail => events.push(detail));
  const result = await instance.execute({}, { model: 'step-model', temperature: 0, max_tokens: 12 });
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ url: '/v1/chat/completions', body: { model: 'step-model', temperature: 0, max_tokens: 12 } });
  expect(result).toMatchObject({ answer: '# 完成', _meta: { agent: 'fixture', model: 'step-model', profile: null, tokens: { total_tokens: 3 } } });
  expect(events.map(event => event.status)).toEqual(['running', 'success']);
  expect(events[0].input_summary).toEqual({ message_count: 2, system_prompt_length: 2, user_prompt_length: 2 });
});

test('JSON真实HTTP执行使用配置回退，且没有订阅者也可返回结构化结果', async () => {
  const instance = agent({ model: 'json-model', temperature: 0.2, max_tokens: 24 });
  instance.getOutputFormat = () => 'json';
  expect(await instance.execute({})).toMatchObject({ answer: '完成' });
  expect(requests[0].body).toMatchObject({ model: 'json-model', temperature: 0.2, max_tokens: 24, response_format: { type: 'json_object' } });
});

test('认证HTTP失败保留失败事件，恢复后同一Agent可再次执行', async () => {
  const instance = agent(); const events = []; instance.setOnDetail(event => events.push(event));
  failure = true;
  await expect(instance.execute({})).rejects.toMatchObject({ message: 'LLM 调用失败', providerCode: 'AI_PROVIDER_AUTH_FAILED', status: 401 });
  expect(events.map(event => event.status)).toEqual(['running', 'failed']);
  expect(events[1].error).toBe('LLM 调用失败');
  expect(JSON.stringify(events)).not.toContain('测试认证失败');
  failure = false;
  await expect(instance.execute({})).resolves.toMatchObject({ answer: '# 完成' });
  expect(events.map(event => event.status)).toEqual(['running', 'failed', 'running', 'success']);
});

test('抽象契约明确拒绝缺失实现，空提示摘要与品牌回退稳定', () => {
  const instance = new BaseAgent('abstract', '抽象', { api_key: 'fixture' });
  expect(() => instance.buildPrompt({})).toThrow('buildPrompt() must be implemented');
  expect(() => instance.parseResponse({})).toThrow('parseResponse() must be implemented');
  expect(instance._summarizeMessages([])).toEqual({ message_count: 0, system_prompt_length: 0, user_prompt_length: 0 });
  expect(instance._summarizeMessages([{}, {}])).toEqual({ message_count: 2, system_prompt_length: 0, user_prompt_length: 0 });
  expect(instance.getEnterpriseName()).toBe('YashanDB');
  global.__KNOWLEDGE_PLATFORM_CONTEXT__ = { brand: { enterpriseName: '测试企业' } };
  expect(instance.getEnterpriseName()).toBe('测试企业');
  expect(instance.loadPromptTemplate('unused')).toBeNull();
  expect(instance.getAgentResource()).toBeNull();
});

test('注册资源成功可读取版本，资源缺失必须报错并能恢复', () => {
  const root = path.resolve(__dirname, '../../../runtime/test-results'); fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, 'base-agent-resource-'));
  try {
    const resourcePath = path.join(dir, 'prompt.txt'); fs.writeFileSync(resourcePath, '已注册提示');
    const instance = agent();
    global.__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__ = {
      context: { brand: { enterpriseName: '资源企业' } },
      profile: { prompts: [{ id: 'fixture', version: 'v1', resourceRef: 'prompt' }], agents: [{ id: 'fixture', version: 'v2', manifestRef: 'agent' }] },
      resources: [{ reference: 'prompt', path: resourcePath }, { reference: 'agent', path: resourcePath }],
    };
    expect(instance.loadPromptTemplate()).toBe('已注册提示');
    expect(instance.getAgentResource()).toMatchObject({ id: 'fixture', version: 'v2', reference: 'agent', path: resourcePath });
    fs.unlinkSync(resourcePath);
    expect(() => instance.loadPromptTemplate()).toThrow('ENOENT');
    fs.writeFileSync(resourcePath, '恢复提示');
    expect(instance.loadPromptTemplate()).toBe('恢复提示');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
