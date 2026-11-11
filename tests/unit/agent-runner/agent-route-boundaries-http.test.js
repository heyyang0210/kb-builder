const express = require('express');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');

const mockRuntimeRoot = fs.mkdtempSync(path.resolve(__dirname, '../../../runtime/test-results/agent-route-http-'));
let mockEngine;
const mockModelConfig = jest.fn();
const mockMcpConfig = jest.fn();
const mockFreeze = jest.fn();
const mockPersist = jest.fn();
const mockExecute = jest.fn();
const mockWriter = { write: jest.fn() };
const mockToolLookup = jest.fn();
const mockLogger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../../../packages/agent-runner-core/lib/repo-paths', () => ({ ...jest.requireActual('../../../packages/agent-runner-core/lib/repo-paths'), AGENT_RUNNER_RUNTIME_ROOT: mockRuntimeRoot }));
jest.mock('../../../packages/agent-runner-core/lib/logger', () => mockLogger);
jest.mock('../../../packages/agent-runner-core/lib/config-manager', () => ({ getModelConfig: (...args) => mockModelConfig(...args), getMCPConfig: (...args) => mockMcpConfig(...args) }));
jest.mock('../../../packages/agent-runner-core/lib/workflow-engine', () => jest.fn().mockImplementation(() => mockEngine));
jest.mock('../../../packages/agent-runner-core/lib/tools/tool-manager', () => jest.fn().mockImplementation(() => ({ getTool: (...args) => mockToolLookup(...args), updateConfig: jest.fn() })));
jest.mock('../../../packages/agent-runner-core/lib/template-generation', () => ({
  ...jest.requireActual('../../../packages/agent-runner-core/lib/template-generation'),
  freezeTemplateForRequest: (...args) => mockFreeze(...args),
  persistTemplateSnapshot: (...args) => mockPersist(...args),
}));
jest.mock('../../../packages/agent-runner-core/lib/direct-generate/direct-task-runner', () => ({ executeDirectGenerate: (...args) => mockExecute(...args) }));
const router = require('../../../packages/agent-runner-core/routes/agent');
const ProcessStore = require('../../../packages/agent-runner-core/lib/process-store');
const { getDirectTask } = require('../../../packages/agent-runner-core/lib/direct-generate/task-store');
const WorkflowEngine = require('../../../packages/agent-runner-core/lib/workflow-engine');
let server;
let base;
let emit;
let io;
async function request(route, body) {
  const response = await fetch(base + route, { ...(body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
const execute = extra => request('/execute', { knowledge_point: { name: '部署' }, ...extra });

beforeAll(async () => {
  mockEngine = Object.assign(new EventEmitter(), {
    workflows: new Map(),
    agentManager: { updateAllConfigs: jest.fn(), listAgents: jest.fn(() => ['planner', 'generator']) },
    setToolManager: jest.fn(tm => { mockEngine.toolManager = tm; }),
    createWorkflow: jest.fn(async () => 'workflow-isolated'),
    startWorkflow: jest.fn(async () => {}),
    getWorkflow: jest.fn(), cancelWorkflow: jest.fn(), forceContinue: jest.fn(),
  });
  const app = express();
  app.use(express.json()); app.use('/api/agent', router);
  app.use((err, _req, res, _next) => res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } }));
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/agent`;
});
beforeEach(() => {
  jest.clearAllMocks();
  mockModelConfig.mockReset().mockResolvedValue(null);
  mockMcpConfig.mockReset().mockResolvedValue(null);
  mockFreeze.mockReset().mockResolvedValue({});
  mockPersist.mockReset().mockResolvedValue(undefined);
  mockExecute.mockReset().mockResolvedValue(undefined);
  mockToolLookup.mockReset().mockReturnValue(mockWriter);
  mockWriter.write.mockReset().mockResolvedValue({ success: true });
  mockEngine.workflows.clear();
  mockEngine.getWorkflow.mockReset().mockReturnValue(null);
  mockEngine.cancelWorkflow.mockReset(); mockEngine.forceContinue.mockReset();
  mockEngine.startWorkflow.mockReset().mockResolvedValue(undefined);
  mockEngine.createWorkflow.mockReset().mockResolvedValue('workflow-isolated');
  emit = jest.fn(); io = { to: jest.fn(() => ({ emit })) }; router.setIO(io);
});
afterAll(async () => {
  router.setIO(null);
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(mockRuntimeRoot, { recursive: true, force: true });
});

test('首次执行构造引擎并读取缺省配置，默认步骤与目录传递', async () => {
  const result = await execute();
  expect(result).toMatchObject({ status: 200, body: { success: true, task_id: 'workflow-isolated' } });
  expect(WorkflowEngine).toHaveBeenCalledWith({ retryCount: 3, maxConcurrent: 3 });
  expect(mockEngine.createWorkflow.mock.calls[0][0]).toMatchObject({ inputData: { output_path: '../output/' }, steps: [{ name: 'planner' }, { name: 'retriever' }, { name: 'generator' }, { name: 'validator' }] });
  expect(mockEngine.agentManager.updateAllConfigs).toHaveBeenCalledWith({});
});

test('后续执行刷新模型和MCP配置，保留自定义步骤与模板快照', async () => {
  mockModelConfig.mockResolvedValue({ provider: 'fixture', model: '隔离模型', api_key: 'fixture' });
  mockMcpConfig.mockResolvedValue({ server_url: 'http://127.0.0.1' });
  mockFreeze.mockResolvedValue({ templateId: 'isolated-template', templateVersion: 2, templateContent: '不可公开的模板正文' });
  const steps = [{ name: 'generator', agent: 'generator' }];
  const result = await execute({ prompt: '生成部署', workflow_config: { steps }, output_path: '隔离输出', filename: '部署.md' });
  expect(result.body).toMatchObject({ templateId: 'isolated-template', templateVersion: 2 });
  expect(result.body).not.toHaveProperty('templateContent');
  expect(mockEngine.createWorkflow).toHaveBeenCalledWith(expect.objectContaining({ steps, inputData: expect.objectContaining({ templateContent: '不可公开的模板正文', output_path: '隔离输出', filename: '部署.md' }) }));
  expect(mockEngine.toolManager.updateConfig).toHaveBeenCalledWith(expect.objectContaining({ mcp: { server_url: 'http://127.0.0.1' } }));
  expect(mockEngine.agentManager.updateAllConfigs).toHaveBeenCalledWith({ provider: 'fixture', model: '隔离模型', api_key: 'fixture' });
});

test('已移除工具管理器仍可启动；后台工作流异常记录日志', async () => {
  const prior = mockEngine.toolManager; mockEngine.toolManager = null;
  mockEngine.startWorkflow.mockRejectedValue(new Error('后台引擎失败'));
  try {
    expect((await execute()).status).toBe(200);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('后台引擎失败'));
  } finally { mockEngine.toolManager = prior; }
});

test.each([
  [Object.assign(new Error('模板权限不足'), { status: 403, code: 'TEMPLATE_PERMISSION_DENIED' }), 403, 'TEMPLATE_PERMISSION_DENIED'],
  [new Error('快照服务故障'), 500, 'INTERNAL_ERROR'],
])('模板冻结错误返回明确HTTP状态：%s', async (error, status, code) => {
  mockFreeze.mockRejectedValue(error);
  expect(await execute()).toMatchObject({ status, body: { error: { code, message: error.message } } });
  expect(mockEngine.createWorkflow).not.toHaveBeenCalled();
});

test('缺少知识点时校验失败且不冻结模板', async () => {
  expect(await request('/execute', {})).toMatchObject({ status: 400, body: { error: { code: 'VALIDATION_ERROR' } } });
  expect(mockFreeze).not.toHaveBeenCalled();
});

test('创建工作流失败交给统一错误处理', async () => {
  mockEngine.createWorkflow.mockRejectedValue(new Error('工作流存储失败'));
  expect(await execute()).toMatchObject({ status: 500, body: { error: { message: '工作流存储失败' } } });
  expect(mockEngine.startWorkflow).not.toHaveBeenCalled();
});

test.each(['progress', 'step_failed', 'step_detail'])('引擎事件%s只广播至对应任务房间，无Socket仍可处理', async event => {
  await request('/health');
  const data = { task_id: 'isolated', taskId: 'isolated', status: 'running', step: 'planner', detail_type: 'tool' };
  mockEngine.emit(event, data);
  expect(io.to).toHaveBeenCalledWith('task:isolated');
  expect(emit).toHaveBeenCalledWith(event, data);
  router.setIO(null); emit.mockClear();
  expect(() => mockEngine.emit(event, data)).not.toThrow();
  expect(emit).not.toHaveBeenCalled();
});

test.each([
  [{ final_document: '最终正文', document: '初稿' }, { output_path: 'reports', filename: '部署.md' }, path.join('reports', '部署.md'), '最终正文'],
  [{ document: '生成正文' }, {}, path.join('output', 'document.md'), '生成正文'],
])('完成事件自动保存优先终稿并回退默认目录：%j', async (output, inputData, target, content) => {
  await request('/health');
  mockEngine.workflows.set('done', { steps: [{ output }], inputData });
  mockEngine.emit('progress', { task_id: 'done', status: 'completed' });
  expect(mockToolLookup).toHaveBeenCalledWith('file_writer');
  expect(mockWriter.write).toHaveBeenCalledWith(target, content, { overwrite: true });
});

test.each([null, { steps: [], inputData: {} }, { steps: [{}], inputData: {} }, { steps: [{ output: {} }], inputData: {} }])('完成时没有可用文档不写文件：%j', async workflow => {
  await request('/health');
  if (workflow) mockEngine.workflows.set('empty', workflow);
  mockEngine.emit('progress', { task_id: 'empty', status: 'completed' });
  expect(mockWriter.write).not.toHaveBeenCalled();
});

test('完成自动保存的工具查找失败记录错误且不打断事件', async () => {
  await request('/health');
  mockEngine.workflows.set('done', { steps: [{ output: { document: '正文' } }], inputData: {} });
  mockToolLookup.mockImplementation(() => { throw new Error('写入工具不可用'); });
  expect(() => mockEngine.emit('progress', { task_id: 'done', status: 'completed' })).not.toThrow();
  expect(mockLogger.error).toHaveBeenCalledWith('Failed to save document: 写入工具不可用');
});

test('状态接口区分找到、不存在和引擎读取异常', async () => {
  mockEngine.getWorkflow.mockReturnValueOnce({ task_id: 'known', status: 'running' }).mockReturnValueOnce(null).mockImplementationOnce(() => { throw new Error('读取失败'); });
  expect(await request('/status/known')).toMatchObject({ status: 200, body: { status: 'running' } });
  expect(await request('/status/missing')).toMatchObject({ status: 404, body: { error: { code: 'TASK_NOT_FOUND' } } });
  expect(await request('/status/failed')).toMatchObject({ status: 500, body: { error: { code: 'INTERNAL_ERROR', message: '读取失败' } } });
});

test.each([['cancel', 'cancelWorkflow'], ['force-continue', 'forceContinue']])('%s成功与失败通过HTTP回传', async (route, method) => {
  expect((await request(`/${route}/task-a`, { step: 'generator' })).status).toBe(200);
  expect(mockEngine[method]).toHaveBeenCalledWith(...method === 'forceContinue' ? ['task-a', 'generator'] : ['task-a']);
  mockEngine[method].mockImplementation(() => { throw new Error('任务状态不允许'); });
  expect(await request(`/${route}/task-a`, {})).toMatchObject({ status: 400, body: { error: { code: 'ERROR', message: '任务状态不允许' } } });
});

test('健康接口统计全部和运行中任务', async () => {
  mockEngine.workflows.set('a', { status: 'running' }); mockEngine.workflows.set('b', { status: 'completed' });
  expect(await request('/health')).toMatchObject({ status: 200, body: { tasks_total: 2, tasks_running: 1, agents: ['planner', 'generator'] } });
});

test('直写快照持久化失败将任务标为失败且不执行模型', async () => {
  mockPersist.mockRejectedValue(new Error('快照落盘失败'));
  expect(await execute({ mode: 'direct_generate' })).toMatchObject({ status: 500, body: { error: { message: '快照落盘失败' } } });
  const taskId = mockPersist.mock.calls[0][0];
  expect(getDirectTask(taskId)).toMatchObject({ status: 'failed', error: '快照落盘失败' });
  expect(mockExecute).not.toHaveBeenCalled();
});

test('直写后台拒绝更新任务状态并广播失败，不公开模板正文', async () => {
  mockFreeze.mockResolvedValue({ templateId: 'fixed', templateVersion: 3, templateContent: '保密正文' });
  mockExecute.mockRejectedValue(new Error('外部执行拒绝'));
  const started = await execute({ mode: 'direct_generate', debug: true });
  expect(started.status).toBe(200);
  const taskId = started.body.task_id;
  const status = await request(`/status/${taskId}`);
  expect(status.body).toMatchObject({ task_id: taskId, status: 'failed', error: '外部执行拒绝', templateId: 'fixed', templateVersion: 3 });
  expect(JSON.stringify(status.body)).not.toContain('保密正文');
  expect(io.to).toHaveBeenCalledWith(`task:${taskId}`);
  expect(emit).toHaveBeenCalledWith('progress', expect.objectContaining({ status: 'failed' }));
});

test('真实ProcessStore中间JSON与Markdown经HTTP回读，缺失文件返回404', async () => {
  const store = new ProcessStore('logs-isolated', 'debug');
  await store.save('planner', 'plan.json', { sections: ['部署'] });
  await store.save('generator', 'document.md', '# 部署');
  const listed = await request('/task/logs-isolated/logs');
  expect(listed).toMatchObject({ status: 200, body: { taskId: 'logs-isolated' } });
  expect(JSON.stringify(listed.body.files)).toContain('plan.json');
  expect(await request('/task/logs-isolated/logs/planner/plan.json')).toMatchObject({ status: 200, body: { content: { sections: ['部署'] } } });
  expect(await request('/task/logs-isolated/logs/generator/document.md')).toMatchObject({ status: 200, body: { content: '# 部署' } });
  expect(await request('/task/logs-isolated/logs/generator/missing.md')).toMatchObject({ status: 404, body: { error: 'File not found' } });
});

test('日志存储接口拒绝时路由返回404，不泄露内部堆栈', async () => {
  // ProcessStore absorbs filesystem errors itself; inject a storage API rejection
  // to verify the HTTP error contract without changing its implementation.
  const rejected = jest.spyOn(ProcessStore.prototype, 'listFiles').mockRejectedValueOnce(new Error('日志索引服务不可用'));
  try {
    expect(await request('/task/logs-unavailable/logs')).toEqual({ status: 404, body: { error: 'Task logs not found', message: '日志索引服务不可用' } });
  } finally { rejected.mockRestore(); }
});
