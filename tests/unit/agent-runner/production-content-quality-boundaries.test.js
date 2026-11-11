const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createProductionContentQuality } = require('../../../packages/agent-runner-core/lib/production-content-quality');
const { createTemplateStore } = require('../../../packages/agent-runner-core/lib/template-store');
const configManager = require('../../../packages/agent-runner-core/lib/config-manager');

const digest = text => crypto.createHash('sha256').update(text).digest('hex');
const markdown = '# 固定修订\n正文。\n';
const content = '# 固定模板\n';
const template = { templateId: 'manual', templateVersion: 2, templateContent: content, templateHash: `sha256:${digest(content)}` };
const source = { sourceId: 'source-1', content: '已确认的来源' };
const input = () => ({ markdown, revision: { revisionId: 'revision-1' }, metadata: { template, sourceSnapshots: [source] }, requirements: '保留固定模板' });

describe('生产内容检查：固定模板恢复与失败边界（真实 Provider HTTP）', () => {
  let server, modelConfig, requests, status, responseBody, directory, previous;
  beforeAll(async () => {
    const root = path.resolve(__dirname, '../../../runtime/test-results');
    fs.mkdirSync(root, { recursive: true });
    directory = fs.mkdtempSync(path.join(root, 'content-quality-'));
    server = http.createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      requests.push({ path: req.url, body: JSON.parse(body) });
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status === 200 ? {
        id: 'local-quality', object: 'chat.completion', model: 'local-quality-model',
        choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(responseBody) }, finish_reason: 'stop' }],
        usage: { total_tokens: 8 },
      } : { error: { message: 'private local diagnostic', type: 'invalid_request_error' } }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    modelConfig = { provider: 'custom', model: 'local-quality-model', api_key: 'local-fixture-only', base_url: `http://127.0.0.1:${server.address().port}/v1`, max_retries: 0 };
  });
  beforeEach(() => {
    requests = []; status = 200;
    responseBody = { checks: ['structure', 'template', 'expression', 'sources'].map(check => ({ check, status: 'passed', details: '检查通过' })), issues: [] };
    previous = Object.fromEntries(['TEMPLATE_STORE_FILE', 'KNOWLEDGE_STORAGE_MODE'].map(key => [key, process.env[key]]));
    process.env.TEMPLATE_STORE_FILE = path.join(directory, 'templates.json');
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
  });
  afterEach(() => {
    jest.restoreAllMocks();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    fs.rmSync(path.join(directory, 'templates.json'), { force: true });
  });
  afterAll(async () => {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const check = (value, options = {}) => createProductionContentQuality({ modelConfig, ...options })(value);
  const context = () => JSON.parse(requests[0].body.messages[1].content);

  test('通过默认模板存储恢复已保存版本，摘要绑定正文与规则', async () => {
    const store = createTemplateStore();
    store.create({ id: 'manual', content: '# 旧模板\n' });
    store.save('manual', { baseVersion: 1, content });
    const value = input();
    delete value.metadata.template;
    value.revision.templateVersionId = 'manual@2';
    const result = await check(value);
    expect(result).toMatchObject({ status: 'completed', gate: 'passed', revisionId: 'revision-1', documentDigest: digest(markdown),
      context: { template: { templateId: 'manual', templateVersion: 2, templateHash: template.templateHash }, sourceDigests: [{ sourceId: source.sourceId, contentDigest: digest(source.content) }] },
      model: { model: 'local-quality-model', provider: 'custom', tokens: { total_tokens: 8 } } });
    expect(context()).toMatchObject({ document: markdown, template, requirements: value.requirements, verification: 'unverified', provenance: [] });
    expect(requests[0].path).toBe('/v1/chat/completions');
    expect(result.ruleDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.implementationDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.limitations).toHaveLength(1);
  });

  test('元数据已有固定模板时不读取历史版本，保留来源摘要和核验信息', async () => {
    const getTemplateVersion = jest.fn(() => { throw new Error('must not load'); });
    const value = input();
    value.revision.templateVersionId = 'missing@1';
    value.metadata.sourceSnapshots = [{ sourceId: 'fixed', contentDigest: 'sha256:frozen' }];
    value.metadata.provenance = ['evidence']; value.metadata.verification = 'verified';
    const result = await check(value, { getTemplateVersion });
    expect(result.gate).toBe('passed');
    expect(getTemplateVersion).not.toHaveBeenCalled();
    expect(result.context.sourceDigests).toEqual([{ sourceId: 'fixed', contentDigest: 'sha256:frozen' }]);
    expect(context()).toMatchObject({ template, provenance: ['evidence'], verification: 'verified' });
  });

  test.each([
    ['版本标识缺少序号', 'manual', null],
    ['版本未验证', 'manual@2', { validationStatus: 'failed', content, contentHash: template.templateHash }],
    ['版本摘要不匹配', 'manual@2', { validationStatus: 'passed', content, contentHash: 'sha256:corrupt' }],
    ['版本不存在', 'missing@2', null],
  ])('%s：不得宣称模板检查通过', async (_label, versionId, saved) => {
    const getTemplateVersion = jest.fn(() => saved);
    const value = input(); delete value.metadata.template; value.revision.templateVersionId = versionId;
    const result = await check(value, { getTemplateVersion });
    expect(result).toMatchObject({ status: 'completed', gate: 'not_passed', context: { template: null } });
    expect(result.checks.find(item => item.check === 'template').status).toBe('not_executed');
    expect(result.limitations).toContain('已保存的模板版本不可用，本次不能确认模板符合性');
    expect(context().template).toBeNull();
    if (versionId.includes('@')) expect(getTemplateVersion).toHaveBeenCalledWith(versionId.split('@')[0], 2);
    else expect(getTemplateVersion).not.toHaveBeenCalled();
  });

  test('元数据仅有模板标识时恢复正文；显式解析器收到数字版本', async () => {
    const value = input(); value.metadata.template = { templateId: 'manual' }; value.revision.templateVersionId = 'manual@2';
    const getTemplateVersion = jest.fn(() => ({ validationStatus: 'passed', content, contentHash: template.templateHash }));
    const result = await check(value, { getTemplateVersion });
    expect(result.gate).toBe('passed'); expect(context().template).toEqual(template);
    expect(getTemplateVersion).toHaveBeenCalledWith('manual', 2);
  });

  test('缺少元数据和来源正文时标注局限，默认需求为空', async () => {
    const value = input(); delete value.metadata; delete value.requirements;
    const result = await check(value);
    expect(result.gate).toBe('not_passed');
    expect(result.checks.map(item => item.status)).toEqual(['passed', 'not_executed', 'passed', 'not_executed']);
    expect(result.context).toEqual({ template: null, sourceDigests: [] });
    expect(context()).toMatchObject({ requirements: '', sources: [] });
    const emptySource = input(); emptySource.metadata.sourceSnapshots = [{ sourceId: 'empty' }];
    expect((await check(emptySource)).context.sourceDigests[0].contentDigest).toBe(digest(''));
  });

  test.each([{ reviewPrompt: '测试规则' }, { version: 'local-rule' }])('规则缺失时拒绝调用模型：%j', async rules => {
    const result = await check(input(), { rules });
    expect(result.error.code).toBe('QUALITY_CONTENT_RULES_UNAVAILABLE');
    expect(result.status).toBe('not_executed'); expect(result.gate).toBe('not_passed');
    expect(result.checks).toHaveLength(4); expect(requests).toHaveLength(0);
  });

  test.each([{ model: 'local' }, { api_key: 'fixture' }])('模型配置不完整时不发请求：%j', async incomplete => {
    const result = await check(input(), { modelConfig: incomplete });
    expect(result.error.code).toBe('QUALITY_CONTENT_MODEL_UNAVAILABLE'); expect(requests).toHaveLength(0);
  });

  test('未传选项时通过公开配置接口取得本地模型配置', async () => {
    const load = jest.spyOn(configManager, 'getModelConfig').mockResolvedValue(modelConfig);
    const result = await createProductionContentQuality()(input());
    expect(result.gate).toBe('passed'); expect(load).toHaveBeenCalledTimes(1);
  });

  test('Provider HTTP鉴权错误仅返回公开错误码', async () => {
    status = 401;
    const result = await check(input());
    expect(result).toMatchObject({ status: 'not_executed', gate: 'not_passed', error: { code: 'AI_PROVIDER_AUTH_FAILED' } });
    expect(result.checks.every(item => item.status === 'not_executed')).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private local diagnostic');
    expect(requests).toHaveLength(1);
  });

  test('非法模型报告不能降级通过；普通异常隐藏私有诊断', async () => {
    responseBody = { checks: [], issues: [] };
    expect((await check(input())).error.code).toBe('QUALITY_CONTENT_RESPONSE_INVALID');
    const result = await check(input(), { generate: async () => { throw new Error('private local diagnostic'); } });
    expect(result.error.code).toBe('QUALITY_CONTENT_MODEL_FAILED');
    expect(JSON.stringify(result)).not.toContain('private local diagnostic');
    expect(requests).toHaveLength(1);
  });

  test.each(['warning', 'blocking'])('逐项结论和%s问题共同决定门禁', async severity => {
    responseBody.issues = [{ check: 'expression', severity, start: 0, end: 1, message: '请核对正文', requirement: '按来源修订' }];
    if (severity === 'blocking') responseBody.checks.find(item => item.check === 'expression').status = 'failed';
    const result = await check(input());
    expect(result.status).toBe('completed');
    expect(result.gate).toBe(severity === 'blocking' ? 'not_passed' : 'passed');
    expect(result.issues).toEqual(responseBody.issues);
  });
});
