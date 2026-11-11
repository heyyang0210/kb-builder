const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { FileAggregateStore } = require('../../../packages/agent-runner-core/lib/aggregate-store');
const { createHandbookProductionService } = require('../../../packages/agent-runner-core/lib/handbook-production-service');
const { createKnowledgeCenterHandler } = require('../../../packages/agent-runner-core/routes/knowledge-center');
const { createProductionAIArtifactStore } = require('../../../packages/agent-runner-core/lib/production-ai-artifact-store');
const { CONFIG_PATHS } = require('../../../packages/agent-runner-core/lib/config-registry');

const editor = { authenticated: true, user: { id: 'author' }, allowedActions: ['knowledge:read', 'knowledge:write'] };
const ctx = { handbookId: 'HB-1', documentId: 'doc-1', outlineVersionId: 'outline-v1', branch: 'main' };
const input = { ...ctx, operation: 'polish', markdown: '前文旧句后文', range: { start: 2, end: 4 }, editVersion: 0,
  referenceOrder: [], originSnapshot: { originType: 'blank', contentDigest: crypto.createHash('sha256').update('').digest('hex') } };
const tick = () => new Promise(resolve => setImmediate(resolve));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

describe('AI执行反馈、恢复与产物的公开边界', () => {
  let root; let previousMode; let servers; let services;
  beforeEach(() => {
    previousMode = process.env.KNOWLEDGE_STORAGE_MODE;
    process.env.KNOWLEDGE_STORAGE_MODE = 'file';
    const runtime = path.resolve(__dirname, '../../../runtime/test-results');
    fs.mkdirSync(runtime, { recursive: true });
    root = fs.mkdtempSync(path.join(runtime, 'ai-execution-'));
    servers = []; services = [];
  });
  afterEach(async () => {
    services.forEach(service => service.stopRecoveryScheduler());
    await Promise.all(servers.map(server => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); })));
    fs.rmSync(root, { recursive: true, force: true });
    if (previousMode === undefined) delete process.env.KNOWLEDGE_STORAGE_MODE;
    else process.env.KNOWLEDGE_STORAGE_MODE = previousMode;
  });
  async function listen(handler) {
    const server = http.createServer(handler); servers.push(server);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${server.address().port}`;
  }
  async function setup(ai = {}, extras = {}) {
    const store = extras.store || new FileAggregateStore(path.join(root, 'state.json'), { drafts: {}, idempotency: {}, audits: [] });
    const rules = JSON.parse(fs.readFileSync(CONFIG_PATHS.contentRules, 'utf8')).productionAI;
    Object.assign(rules.executionFeedback, { previewIntervalMs: 20, maxPreviewChars: 5, maxAgentEvents: 3, maxAgentMessageChars: 8 });
    const modelGovernance = ai.modelGovernance || require('../../../packages/agent-runner-core/lib/platform-management/model-governance').createModelGovernance({
      configManager: { getModelConfigSync: () => ({ model: 'isolated-model', api_key: 'fixture', base_url: 'http://127.0.0.1:1' }) },
    });
    const service = createHandbookProductionService({ store, attachmentRoot: path.join(root, 'attachments'),
      ai: { rules, loadMCPConfig: async () => ({}), generate: async () => ({ content: '新句' }), ...ai, modelGovernance }, ...extras });
    services.push(service);
    const handler = createKnowledgeCenterHandler({
      config: { KNOWLEDGE_CENTER_PREFIX: '/knowledge-center', KNOWLEDGE_CENTER_ROOT: root, KNOWLEDGE_CENTER_ENTRY: 'index.html',
        OUTLINE_TEMPLATE_PATH: path.resolve('knowledge/outlines/大纲模板.xlsx'), OUTLINE_SAMPLE_PATH: path.resolve('knowledge/outlines/基本数据库管理手册大纲示例.xlsx'),
        GITLAB_CONFIG_PATH: path.join(root, 'gitlab.json'), GITLAB_DOCUMENT_TYPES_PATH: path.join(root, 'types.json'), DATABASE_CONNECTION_CONFIG_PATH: path.join(root, 'db.json') },
      stores: { knowledgeAssetsStore: { read: () => ({ handbooks: [{ handbookId: 'HB-1', name: '隔离手册' }] }) }, manualStatusStore: {}, brandIconStore: {}, domainStore: {} },
      moduleRegistry: { get: name => name === 'auth' ? { authorize: async () => editor } : null },
      handbookProductionService: service, modelGovernance, databaseConnectionGovernance: {},
    });
    const origin = await listen(handler);
    async function request(method, suffix = '', body) {
      const response = await fetch(`${origin}/knowledge-center/api/production/handbooks/HB-1/documents/doc-1/ai-jobs${suffix}`, {
        method, headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const result = await response.json();
      expect(response.status).toBe(method === 'POST' && !suffix ? 202 : 200);
      return result.data;
    }
    const get = id => request('GET', `/${id}?outlineVersionId=outline-v1&branch=main`);
    return { service, store, origin, request, get, start: () => request('POST', '', input) };
  }
  async function until(read, predicate) {
    for (let attempt = 0; attempt < 150; attempt++) {
      const value = await read();
      if (predicate(value)) return value;
      await pause(10);
    }
    throw new Error('隔离任务未在期限内到达预期状态');
  }

  test('本地参考上传通过真实HTTP保留文件名、正文摘要和上下文，失败不产生来源', async () => {
    const rules = JSON.parse(fs.readFileSync(CONFIG_PATHS.contentRules, 'utf8')).productionAI;
    rules.sources.upload.maxBytes = 128;
    const f = await setup({ rules });
    const endpoint = `${f.origin}/knowledge-center/api/production/handbooks/HB-1/documents/doc-1/ai-sources/uploads?outlineVersionId=outline-v1&branch=main`;
    const upload = async (method, body, fileName) => {
      const response = await fetch(endpoint, { method, ...(body === undefined ? {} : { body }),
        headers: { 'content-type': 'text/markdown', ...(fileName === undefined ? {} : { 'x-file-name': fileName }) } });
      return { status: response.status, allow: response.headers.get('allow'), body: response.status === 405 ? null : await response.json() };
    };
    const content = '# 参考资料\n\n数据库连接说明。';
    for (const [header, name] of [[encodeURIComponent('中文参考.md'), '中文参考.md'], ['bad%ZZ.md', 'bad%ZZ.md']]) {
      const result = await upload('POST', content, header);
      expect(result.status).toBe(201);
      expect(result.body.data).toMatchObject({ fileName: name, content, sourceType: 'local-document',
        contentDigest: crypto.createHash('sha256').update(content).digest('hex'), context: ctx, mimeType: 'text/markdown' });
      expect(f.store.read().aiSources[result.body.data.sourceId]).toMatchObject({ fileName: name, content, context: ctx });
    }
    const before = f.store.read();
    for (const [body, name, status, code] of [
      ['', 'empty.md', 422, 'AI_SOURCE_EMPTY'],
      ['内容', 'unsupported.exe', 400, 'AI_SOURCE_TYPE_INVALID'],
      ['内容', undefined, 400, 'AI_SOURCE_TYPE_INVALID'],
      ['x'.repeat(129), 'oversized.md', 413, 'ATTACHMENT_TOO_LARGE'],
    ]) {
      const result = await upload('POST', body, name);
      expect(result.status).toBe(status);
      expect(result.body.error.code).toBe(code);
      expect(f.store.read()).toEqual(before);
    }
    expect(await upload('GET')).toMatchObject({ status: 405, allow: 'POST' });
  });

  test('默认模型经真实SSE生成并保留模型和usage，不写入草稿', async () => {
    let sent;
    const endpoint = await listen(async (req, res) => {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      sent = { url: req.url, body: JSON.parse(Buffer.concat(chunks)) };
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const delta of [{ content: '新' }, {}, { content: '句' }]) {
        res.write(`data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', model: 'fixture-stream', choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ id: 'fixture', model: 'fixture-stream', choices: [], usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } })}\n\n`);
      res.write(`data: ${JSON.stringify({ id: 'fixture', model: 'fixture-stream', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
      res.end('data: [DONE]\n\n');
    });
    const api = await setup({ generate: undefined, modelGovernance: { resolve: () => ({ selection: { model: 'fixture-stream' }, config: {
      provider: 'custom', model: 'fixture-stream', api_key: 'fixture', base_url: `${endpoint}/v1`,
    } }) } });
    const created = await api.start();
    const completed = await until(() => api.get(created.jobId), job => job.status === 'completed' || job.status === 'failed');
    expect(completed).toMatchObject({ status: 'completed', candidateMarkdown: '前文新句后文', writerMetadata: {
      model: 'fixture-stream', usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    } });
    expect(sent).toMatchObject({ url: '/v1/chat/completions', body: { model: 'fixture-stream', stream: true } });
    expect(api.service.getDraft(ctx, editor).exists).toBe(false);
  });

  test('预览节流保留最后内容且截断时不拆Unicode字符，取消丢弃迟到回调', async () => {
    let callbacks; let finish;
    const api = await setup({ generate: (_messages, _config, execution) => { callbacks = execution; return new Promise(resolve => { finish = resolve; }); } });
    const created = await api.start();
    await until(async () => callbacks, Boolean);
    callbacks.onProgress(null); callbacks.onProgress('');
    expect((await api.get(created.jobId)).executionPreview).toBeUndefined();
    callbacks.onProgress('甲乙丙丁😀尾');
    expect((await api.get(created.jobId)).executionPreview).toMatchObject({ text: '甲乙丙丁', truncated: true });
    callbacks.onProgress('待替换'); callbacks.onProgress('最新预览内容');
    const preview = await until(() => api.get(created.jobId), job => job.executionPreview.text === '最新预览内');
    expect(preview.executionPreview.truncated).toBe(true);
    await api.request('POST', `/${created.jobId}/cancel`, ctx);
    callbacks.onProgress('取消后正文'); callbacks.onEvent({ kind: 'tool-started', tool: 'late' });
    finish({ content: '迟到结果' }); await tick();
    const cancelled = await api.get(created.jobId);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.candidateMarkdown).toBeUndefined();
    expect(cancelled.agentEvents || []).toEqual([]);
  });

  test('Agent进度合并、定时刷新、事件保留上限与消息截断', async () => {
    let callbacks; let finish;
    const api = await setup({ generate: (_messages, _config, execution) => { callbacks = execution; return new Promise(resolve => { finish = resolve; }); } });
    const created = await api.start(); await until(async () => callbacks, Boolean);
    const emit = (kind, extra = {}) => callbacks.onEvent({ kind, seq: 1, at: '2026-11-10T00:00:00Z', ...extra });
    emit('progress', { text: '1234' }); emit('progress', { text: '567890' });
    const merged = await until(() => api.get(created.jobId), job => job.agentEvents?.[0]?.text === '34567890');
    expect(merged.agentEvents).toHaveLength(1);
    emit('ignored');
    emit('tool-started', { tool: 'search', itemId: 'tool-1', status: 'running' });
    emit('progress', { text: 'abcdefghijk' });
    emit('tool-completed', { tool: 'search', itemId: 'tool-1', status: 'completed' });
    emit('error', { message: '错误信息需要截断测试' });
    let job = await api.get(created.jobId);
    expect(job.agentEvents).toEqual([
      expect.objectContaining({ kind: 'progress', text: 'defghijk' }),
      expect.objectContaining({ kind: 'tool-completed', tool: 'search', status: 'completed', itemId: 'tool-1' }),
      expect.objectContaining({ kind: 'error', text: '错误信息需要截断' }),
    ]);
    finish({ content: '新句' }); await tick();
    job = await api.get(created.jobId); expect(job.status).toBe('completed');
    expect(job.agentEvents).toHaveLength(3);
  });

  test.each(['planner', 'evidence'])('%s冻结输入摘要冲突阻止模型执行', async stage => {
    const generate = jest.fn(async () => ({ content: '不应生成' }));
    const api = await setup({ generate });
    // Interleave a second aggregate writer after the queued job commits and before start dispatches it.
    const transaction = api.store.transaction.bind(api.store);
    let corrupted = false;
    api.store.transaction = mutator => {
      const result = transaction(mutator);
      if (!corrupted && result?.status === 'queued') {
        corrupted = true;
        transaction(state => { state.aiJobs[result.jobId].stageRuns.find(run => run.stageId === stage).inputDigest = 'changed'; });
      }
      return result;
    };
    const created = await api.start();
    await tick();
    const failed = await api.get(created.jobId);
    expect(failed).toMatchObject({ status: 'failed', error: { code: 'AI_STAGE_INPUT_CONFLICT' } });
    expect(failed.stageRuns.find(run => run.stageId === stage)).toMatchObject({ status: 'failed', errorCode: 'AI_STAGE_INPUT_CONFLICT' });
    expect(generate).not.toHaveBeenCalled();
  });

  test('恢复时冻结模型消失保留中断状态并释放认领', async () => {
    let time = Date.now(); let finish;
    const store = new FileAggregateStore(path.join(root, 'state.json'), { drafts: {}, idempotency: {}, audits: [] });
    const first = await setup({ now: () => time, generate: undefined, stageAdapters: { writer: { run: () => new Promise(resolve => { finish = resolve; }) } } }, { store });
    const created = await first.start(); await until(async () => finish, Boolean);
    time += 24 * 60 * 60 * 1000;
    expect((await first.get(created.jobId)).status).toBe('interrupted');
    const generate = jest.fn();
    const second = await setup({ now: () => time, generate, modelGovernance: { resolve: () => { throw new Error('配置已移除'); } } }, { store });
    expect(second.service.ai.recoverOnStartup()).toEqual({ recovered: 1 });
    const job = await second.get(created.jobId);
    expect(job).toMatchObject({ status: 'interrupted', error: { code: 'AI_MODEL_SELECTION_UNAVAILABLE' }, recoveryAttempts: 1 });
    expect(job.recoveryClaim).toBeUndefined(); expect(generate).not.toHaveBeenCalled();
    finish({ content: '旧进程迟到' }); await tick();
    expect((await second.get(created.jobId)).status).toBe('interrupted');
  });

  test('真实产物清理仅删除无引用旧产物，任务产物仍可读取', async () => {
    const artifacts = createProductionAIArtifactStore({ filePath: path.join(root, 'artifacts.json') });
    const api = await setup({}, { aiArtifactStore: artifacts });
    const created = await api.start();
    const completed = await until(() => api.get(created.jobId), job => job.status === 'completed');
    const before = artifacts.list(); expect(before.map(record => record.stageId).sort()).toEqual(['evidence', 'planner', 'writer']);
    artifacts.put({ ...before[0], artifactId: 'orphan', storedAt: '2000-01-01T00:00:00Z', createdAt: '2000-01-01T00:00:00Z' });
    expect(api.service.ai.cleanupArtifacts({ olderThan: Date.now() + 1000 })).toEqual({ removed: 1, referenced: before.length });
    expect(artifacts.get('orphan')).toBeNull();
    expect(artifacts.list().map(record => record.artifactId).sort()).toEqual(before.map(record => record.artifactId).sort());
    expect((await api.get(created.jobId)).candidateMarkdown).toBe(completed.candidateMarkdown);
    const withoutSweep = await setup({}, { aiArtifactStore: { put: artifacts.put, get: artifacts.get } });
    expect(withoutSweep.service.ai.cleanupArtifacts()).toEqual({ removed: 0, referenced: 0 });
  });

  test.each([true, false])('外部产物缺失时仅恢复含value的旧内联产物（value=%s）', async inline => {
    const artifactAggregate = new FileAggregateStore(path.join(root, 'inline-artifacts.json'), { artifacts: {} });
    const artifacts = createProductionAIArtifactStore({ store: artifactAggregate });
    const api = await setup({}, { aiArtifactStore: artifacts });
    const created = await api.start();
    const completed = await until(() => api.get(created.jobId), job => job.status === 'completed');
    const record = completed.artifacts.records.planner;
    expect(record.value).toBeTruthy();
    artifactAggregate.transaction(state => { state.artifacts = {}; });
    api.store.transaction(state => {
      const job = state.aiJobs[created.jobId];
      delete job.artifacts.planner;
      job.artifacts.records.planner = structuredClone(record);
      if (!inline) delete job.artifacts.records.planner.value;
    });
    const restored = await api.get(created.jobId);
    expect(restored.status).toBe('completed');
    if (inline) expect(restored.artifacts.planner).toEqual(record.value);
    else expect(restored.artifacts).not.toHaveProperty('planner');
    // Hydration is a read projection: the stored legacy job remains unchanged.
    expect(api.store.read().aiJobs[created.jobId].artifacts).not.toHaveProperty('planner');
    expect(artifacts.list()).toEqual([]);
  });

  test.each(['artifactId', 'stageId', 'contractVersion', 'digest'])('HTTP回读拒绝%s与任务引用不一致的外部产物', async field => {
    const artifactAggregate = new FileAggregateStore(path.join(root, 'mismatch-artifacts.json'), { artifacts: {} });
    const artifacts = createProductionAIArtifactStore({ store: artifactAggregate });
    const api = await setup({}, { aiArtifactStore: artifacts });
    const created = await api.start();
    const completed = await until(() => api.get(created.jobId), job => job.status === 'completed');
    const record = completed.artifacts.records.planner;
    artifactAggregate.transaction(state => {
      state.artifacts[record.artifactId][field] = `mismatch-${record[field]}`;
      state.artifacts[record.artifactId].value = { untrusted: true };
    });
    api.store.transaction(state => { delete state.aiJobs[created.jobId].artifacts.planner; });
    const restored = await api.get(created.jobId);
    expect(restored.status).toBe('completed');
    expect(restored.artifacts).not.toHaveProperty('planner');
    expect(restored.artifacts.records.planner).not.toHaveProperty('value');
    expect(restored.candidateMarkdown).toBe(completed.candidateMarkdown);
  });
});
