const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const { createTemplateStore } = require('../../../packages/agent-runner-core/lib/template-store');

function memory(initial) {
  let state = structuredClone(initial);
  return {
    read: () => structuredClone(state),
    transaction(fn) { const next = structuredClone(state); const result = fn(next); state = next; return structuredClone(result); },
  };
}

describe('默认模板模型适配的真实 HTTP 链路', () => {
  let rootDir; let savedEnv; let auth; let model; let server; let base;
  let mode; let output; let calls; let modelRequests; let modelFailure;
  const root = path.resolve(__dirname, '../../..');
  const listen = instance => new Promise(resolve => instance.listen(0, '127.0.0.1', resolve));
  async function request(route, body) {
    const response = await fetch(`${base}/knowledge-center/api/templates/mappings${route}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { cookie: 'manager', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }
  async function analyze() {
    const started = await request('/analyze', { handbookId: 'HB' });
    expect(started.status).toBe(202);
    let batch;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const read = await request(`/${started.body.data.id}`);
      expect(read.status).toBe(200);
      batch = read.body.data;
      if (batch.status === 'completed') return batch.documents[0].ai;
      await new Promise(resolve => setImmediate(resolve));
    }
    throw new Error(`分析未完成：${JSON.stringify(batch)}`);
  }
  beforeAll(async () => {
    fs.mkdirSync(path.join(root, 'runtime/test-results'), { recursive: true });
    rootDir = fs.mkdtempSync(path.join(root, 'runtime/test-results/template-model-http-'));
    savedEnv = process.env.TEMPLATE_MAPPING_STORE_FILE;
    process.env.TEMPLATE_MAPPING_STORE_FILE = path.join(rootDir, 'mappings.json');
    calls = []; modelRequests = []; modelFailure = false;
    auth = http.createServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ content: { allowedActions: ['template:read', 'template:manage'], user: { id: 'manager', visibleHandbookIds: ['HB'] } } }));
    });
    await listen(auth);
    model = http.createServer(async (req, res) => {
      let body = ''; for await (const chunk of req) body += chunk;
      modelRequests.push({ url: req.url, body: JSON.parse(body) });
      if (modelFailure) { res.writeHead(503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { message: '本地模型不可用' } })); return; }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const pieces = ['', '{"templateId":"tpl",', '"reason":"流式匹配"}'];
      for (const content of pieces) res.write(`data: ${JSON.stringify({ model: 'local-test', choices: [{ delta: { content }, finish_reason: null }] })}\n\n`);
      res.end(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`);
    });
    await listen(model);
    const templateStore = createTemplateStore({ store: memory({ schemaVersion: 1, templates: [], audits: [] }) });
    templateStore.create({ id: 'tpl', name: '模板', type: 'SQL', content: '# 模板' }, { user: { id: 'seed' } });
    const handler = createKnowledgeCenterHandler({
      config: {
        KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, KNOWLEDGE_CENTER_ENTRY: 'index.html',
        OUTLINE_TEMPLATE_PATH: path.join(root, 'knowledge/outlines/大纲模板.xlsx'), OUTLINE_SAMPLE_PATH: path.join(root, 'knowledge/outlines/基本数据库管理手册大纲示例.xlsx'),
        PINGCODE_PREFIX: '/pingcode', PINGCODE_ROOT: root, DOCUMENT_API_HOST: '127.0.0.1', DOCUMENT_API_PORT: 1,
        PINGCODE_API_HOST: '127.0.0.1', PINGCODE_API_PORT: 1, AUTH_API_HOST: '127.0.0.1', AUTH_API_PORT: auth.address().port,
        PLATFORM_CONTEXT_TIMEOUT_MS: 1000, GITLAB_CONFIG_PATH: path.join(rootDir, 'gitlab.json'), GITLAB_DOCUMENT_TYPES_PATH: path.join(rootDir, 'types.json'),
      },
      stores: { templateStore, knowledgeAssetsStore: { read: () => ({ handbooks: [{ handbookId: 'HB' }] }) } },
      handbookProductionService: {},
      agentGovernance: {
        available: async () => ({ defaultSelection: mode === 'missing' ? null : 'local' }),
        resolve: selection => { expect(selection).toBe('local'); return { config: mode === 'codex' ? { executor: 'codex', model: 'test' } : { provider: 'custom', model: 'local-test', api_key: 'local-only', base_url: `http://127.0.0.1:${model.address().port}/v1` } }; },
      },
      codexRunner: { async run(messages, config, options) { calls.push({ messages, config, options }); return { content: output }; } },
      documentTaskCatalog: async () => ({ outlineVersionId: 'v1', documents: [{ id: 'doc', name: 'SQL说明', parentId: 'chapter' }], directory: { nodes: [{ id: 'chapter', title: '管理' }, { id: 'doc', documentType: 'SQL' }] } }),
      sendFile(_file, res) { res.writeHead(404); res.end(); }, proxyAuth() {}, proxyCleaning() {}, proxyOutline() {}, proxyPermission() {}, handleIncrementalBuild() {},
    });
    server = http.createServer(handler); await listen(server);
    base = `http://127.0.0.1:${server.address().port}`;
  });
  afterAll(async () => {
    for (const instance of [server, model, auth]) if (instance) await new Promise(resolve => instance.close(resolve));
    if (savedEnv === undefined) delete process.env.TEMPLATE_MAPPING_STORE_FILE; else process.env.TEMPLATE_MAPPING_STORE_FILE = savedEnv;
    if (rootDir) fs.rmSync(rootDir, { recursive: true, force: true });
  });
  test('未配置默认模型时保留失败依据，后续请求可恢复', async () => {
    mode = 'missing';
    expect(await analyze()).toEqual({ templateId: '', reason: '模型分析未完成：尚未配置默认模型', modelRunId: null });
    expect(calls).toHaveLength(0); expect(modelRequests).toHaveLength(0);
  });
  test('Codex请求包含文档、候选模板、提示词和可取消信号', async () => {
    mode = 'codex'; output = JSON.stringify({ templateId: 'tpl', reason: '标题匹配' });
    expect(await analyze()).toEqual({ templateId: 'tpl', reason: '标题匹配', modelRunId: expect.stringMatching(/^[a-f0-9-]{36}$/) });
    const call = calls.at(-1);
    expect(call.messages[0]).toEqual({ role: 'system', content: require('../../../config/knowledge-center/template-mapping.json').ai.prompt });
    expect(JSON.parse(call.messages[1].content)).toEqual({ document: { title: 'SQL说明', path: '管理', type: 'SQL' }, templates: [expect.objectContaining({ id: 'tpl', name: '模板' })] });
    expect(call.config).toEqual({ executor: 'codex', model: 'test', mcp: { services: [] } });
    expect(call.options.signal.aborted).toBe(false);
    expect(typeof call.options.signal.addEventListener).toBe('function');
  });
  test('无效模型输出不会形成模板建议，后续合法输出可恢复', async () => {
    mode = 'codex'; output = '{}';
    expect(await analyze()).toEqual({ templateId: '', reason: '模型分析未完成：模型返回格式无效', modelRunId: null });
    output = JSON.stringify({ markdown: JSON.stringify({ templateId: 'tpl', reason: '包装结果' }) });
    expect(await analyze()).toEqual(expect.objectContaining({ templateId: 'tpl', reason: '包装结果', modelRunId: expect.any(String) }));
  });
  test('本地SSE模型合并分片并忽略空分片，真实上游失败后仍完成批次', async () => {
    mode = 'stream';
    expect(await analyze()).toEqual(expect.objectContaining({ templateId: 'tpl', reason: '流式匹配', modelRunId: expect.any(String) }));
    expect(modelRequests.at(-1)).toEqual({ url: '/v1/chat/completions', body: expect.objectContaining({ model: 'local-test', stream: true, messages: expect.arrayContaining([expect.objectContaining({ role: 'system' })]) }) });
    modelFailure = true;
    expect(await analyze()).toEqual({ templateId: '', reason: '模型分析未完成：LLM 流式调用失败', modelRunId: null });
    modelFailure = false;
    expect((await analyze()).templateId).toBe('tpl');
  });
});
