const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const { createModelGovernance } = require('../../../packages/agent-runner-core/lib/platform-management/model-governance');
const rules = require('../../../config/knowledge-center/content-rules.json').platformModels;

const serviceInput = (overrides = {}) => ({ clientId: 'new-primary', name: '隔离模型服务', provider: 'custom', protocol: 'chat_completions',
  base_url: 'https://model.example.test/v1/', models: ['model-a', 'model-b'], enabled: true, api_key: 'local-secret',
  timeout: 30000, temperature: 0.4, max_tokens: 2048, ...overrides });
const errorCode = async response => (await response.json()).error?.code;

describe('平台模型治理真实 HTTP 与内存配置', () => {
  let root; let server; let base; let config = {}; let governance; let probeOutput; let probeError; let probeConfig;
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(process.cwd(), 'runtime/test-results/kc-model-governance-'));
    fs.writeFileSync(path.join(root, 'template.xlsx'), 'template');
    fs.writeFileSync(path.join(root, 'sample.xlsx'), 'sample');
    const manager = { getModelConfigSync: () => structuredClone(config), save: async (_name, next) => { config = structuredClone(next); } };
    class ProbeClient {
      constructor(options) { probeConfig = options; }
      async probe() { if (probeError) throw probeError; return probeOutput; }
    }
    governance = createModelGovernance({ configManager: manager, LLMClient: ProbeClient, rules });
    const handler = createKnowledgeCenterHandler({
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, KNOWLEDGE_CENTER_ENTRY: 'index.html',
        OUTLINE_TEMPLATE_PATH: path.join(root, 'template.xlsx'), OUTLINE_SAMPLE_PATH: path.join(root, 'sample.xlsx'), GITLAB_CONFIG_PATH: path.join(root, 'gitlab.json') },
      stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [] }), write() {} } },
      moduleRegistry: { get: key => key === 'auth' ? { authorize: async req => req.headers['x-test-role'] === 'anonymous' ? null :
        { user: { id: 'model-admin' }, roles: [req.headers['x-test-role'] || 'PLATFORM_ADMIN'], allowedActions: ['knowledge:read'] } } : null },
      modelGovernance: governance,
      sendFile(_file, res) { res.writeHead(404); res.end(); }, proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
    });
    server = http.createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/knowledge-center/api`;
  });
  afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); if (root) fs.rmSync(root, { recursive: true, force: true }); });
  beforeEach(() => { config = {}; probeOutput = { content: 'OK', model: 'model-a', totalMs: 17, firstByteMs: 9 }; probeError = null; probeConfig = null; });
  const call = (endpoint, method = 'GET', body, role = 'PLATFORM_ADMIN') => fetch(base + endpoint, {
    method, headers: { 'x-test-role': role, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined,
  });
  const version = async () => (await (await call('/platform/models')).json()).data.rowVersion;
  const save = async (services, defaultSelection = null, rowVersion) => call('/platform/models', 'PUT', { services, defaultSelection, rowVersion: rowVersion || await version() });

  test('旧配置目录、公开密钥掩码及鉴权', async () => {
    config = { model: 'legacy-a', provider: 'custom', api_key: 'legacy-secret' };
    const response = await call('/platform/models');
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(JSON.parse(text).data).toMatchObject({ services: [{ id: 'legacy-default', models: ['legacy-a'], api_key_configured: true, credentialAvailable: true }], defaultSelection: { serviceId: 'legacy-default', model: 'legacy-a' } });
    expect(text).not.toContain('legacy-secret');
    expect((await (await call('/production/models')).json()).data.options).toMatchObject([{ model: 'legacy-a' }]);
    expect((await call('/platform/models', 'GET', null, 'anonymous')).status).toBe(401);
    expect((await call('/platform/models', 'GET', null, 'KNOWLEDGE_EDITOR')).status).toBe(403);
    expect((await call('/platform/models', 'POST', {})).status).toBe(405);
    expect((await call('/platform/models/test', 'GET')).status).toBe(405);
  });

  test('保存、公开目录、显式选择及版本冲突', async () => {
    const first = await save([serviceInput()], { serviceId: 'new-primary', model: 'model-a' });
    expect(first.status).toBe(200);
    const data = (await first.json()).data;
    const id = data.services[0].id;
    expect(id).toMatch(/^model-/);
    expect(data.services[0]).toMatchObject({ base_url: 'https://model.example.test/v1', api_key_configured: true, credentialAvailable: true });
    expect(JSON.stringify(data)).not.toContain('local-secret');
    expect(config.modelGovernance.updatedBy).toBe('model-admin');
    const available = await call('/production/models');
    expect((await available.json()).data.options).toEqual(expect.arrayContaining([expect.objectContaining({ serviceId: id, model: 'model-a' })]));
    expect(governance.resolve().selection).toMatchObject({ serviceId: id, model: 'model-a' });
    expect(governance.resolve({ serviceId: id, model: 'model-b', configVersion: data.rowVersion }).selection.model).toBe('model-b');
    expect(() => governance.resolve({ serviceId: id, model: 'model-b', configVersion: 'stale' })).toThrow(expect.objectContaining({ code: 'MODEL_SELECTION_STALE' }));
    expect(() => governance.resolve({ serviceId: id, model: 'unknown', configVersion: data.rowVersion })).toThrow(expect.objectContaining({ code: 'MODEL_NOT_AVAILABLE' }));
    expect(await errorCode(await save([], null, 'stale'))).toBe('MODEL_CONFIG_CONFLICT');
  });

  test('字段、服务标识和默认选择拒绝无效配置', async () => {
    const invalid = [
      [null, 'MODEL_CONFIG_INVALID'],
      [[serviceInput({ clientId: 'bad id' })], 'MODEL_CONFIG_INVALID'],
      [[serviceInput(), serviceInput()], 'MODEL_CONFIG_INVALID'],
      [[serviceInput({ provider: 'unknown' })], 'MODEL_CONFIG_INVALID'],
      [[serviceInput({ protocol: 'unknown' })], 'MODEL_CONFIG_INVALID'],
      [[serviceInput({ name: '  ' })], 'MODEL_CONFIG_INVALID'],
      [[serviceInput({ base_url: 'not-a-url' })], 'MODEL_CONFIG_INVALID'],
      [[serviceInput({ base_url: 'https://user:pass@example.test' })], 'MODEL_CONFIG_INVALID'],
      [[serviceInput({ enabled: 'yes' })], 'MODEL_CONFIG_INVALID'],
      [[serviceInput({ models: [] })], 'MODEL_CONFIG_INVALID'],
      [[serviceInput({ models: ['same', 'same'] })], 'MODEL_CONFIG_INVALID'],
      [[serviceInput({ timeout: 20 })], 'MODEL_CONFIG_INVALID'],
      [[serviceInput({ temperature: 3 })], 'MODEL_CONFIG_INVALID'],
      [[serviceInput({ max_tokens: 0 })], 'MODEL_CONFIG_INVALID'],
      [[serviceInput({ api_key: 'x\nsecret' })], 'MODEL_CONFIG_INVALID'],
      [[serviceInput({ api_key: 'x'.repeat(rules.maxSecretChars + 1) })], 'MODEL_CONFIG_INVALID'],
      [[serviceInput({ clearApiKey: 'yes' })], 'MODEL_CONFIG_INVALID'],
      [[serviceInput({ models: ['bad\nmodel'] })], 'MODEL_CONFIG_INVALID'],
      [[serviceInput({ clearApiKey: true })], 'MODEL_CONFIG_INVALID'],
      [[serviceInput({ api_key: '', enabled: true })], 'MODEL_CONFIG_INVALID'],
    ];
    for (const [services, code] of invalid) expect(await errorCode(await save(services))).toBe(code);
    expect(await errorCode(await save([serviceInput()], null))).toBe('MODEL_DEFAULT_REQUIRED');
    expect(await errorCode(await save([serviceInput()], { serviceId: 'missing', model: 'model-a' }))).toBe('MODEL_DEFAULT_INVALID');
    expect(config).toEqual({});
  });

  test('已有凭据复用、更改目标和主动清除', async () => {
    let response = await save([serviceInput()], { serviceId: 'new-primary', model: 'model-a' });
    const id = (await response.json()).data.services[0].id;
    const existing = () => serviceInput({ id, clientId: undefined, api_key: '' });
    response = await save([existing()], { serviceId: id, model: 'model-a' });
    expect(response.status).toBe(200);
    expect(config.services[0].api_key).toBe('local-secret');
    expect(await errorCode(await save([{ ...existing(), base_url: 'https://other.example.test/v1' }], { serviceId: id, model: 'model-a' }))).toBe('MODEL_CONFIG_INVALID');
    response = await save([{ ...existing(), enabled: false, clearApiKey: true }]);
    expect(response.status).toBe(200);
    expect(config.services[0].api_key).toBe('');
    expect((await (await call('/production/models')).json()).data.options).toEqual([]);
    expect(() => governance.resolve()).toThrow(expect.objectContaining({ code: 'MODEL_NOT_AVAILABLE' }));
  });

  test('模型探测成功、空响应与供应商错误转换', async () => {
    const input = { service: serviceInput(), model: 'model-a', rowVersion: await version() };
    let response = await call('/platform/models/test', 'POST', input);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ status: 'verified', actualModel: 'model-a', firstByteMs: 9 });
    expect(probeConfig).toMatchObject({ max_tokens: rules.testMaxTokens, timeout: rules.testTimeoutMs });
    response = await call('/platform/models/test', 'POST', { ...input, model: 'other' });
    expect(await errorCode(response)).toBe('MODEL_CONFIG_INVALID');
    probeOutput = { content: ' ' };
    expect(await errorCode(await call('/platform/models/test', 'POST', input))).toBe('MODEL_CONNECTION_FAILED');
    for (const [cause, text] of [
      [{ providerCode: 'AI_PROVIDER_TIMEOUT' }, '超时'],
      [{ providerCode: 'AI_PROVIDER_AUTH_FAILED' }, '鉴权失败'],
      [{ providerCode: 'AI_PROVIDER_RATE_LIMITED' }, '限流'],
    ]) {
      probeError = cause;
      const failed = await call('/platform/models/test', 'POST', input);
      expect(failed.status).toBe(502);
      expect((await failed.json()).error.message).toContain(text);
    }
  });
});
