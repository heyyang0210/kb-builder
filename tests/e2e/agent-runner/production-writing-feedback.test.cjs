const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { setTimeout: pause } = require('node:timers/promises');
const { setup } = require('./fixtures/production-writing.cjs');
const { previewMarkdown } = require('../../../packages/agent-runner-core/lib/production-ai-preview');
const ctx = { outlineVersionId: 'outline-v1', branch: 'main' };
const root = '/handbooks/HB-1/documents/doc-1/ai-jobs';
const body = { ...ctx, operation: 'polish', markdown: '原文', editVersion: 0, range: { start: 0, end: 2 } };
async function until(read, predicate) {
  for (let i = 0; i < 100; i++) { const value = await read(); if (predicate(value)) return value; await pause(20); }
  throw new Error('等待执行状态超时');
}

test('增量预览解码跨分块转义、Unicode、JSON字段顺序与普通正文', () => {
  const content = '第一行\n"引号"\\路径😀';
  const raw = JSON.stringify({ provenance: [{ note: 'markdown' }], markdown: content });
  for (let i = 1; i <= raw.length; i++) {
    const partial = previewMarkdown(raw.slice(0, i));
    assert.ok(content.startsWith(partial), JSON.stringify({ i, partial }));
    assert.doesNotMatch(partial, /[\uD800-\uDBFF]$/);
  }
  assert.equal(previewMarkdown(raw), content);
  assert.equal(previewMarkdown('```json\n' + raw), content);
  assert.equal(previewMarkdown('普通正文\n'), '普通正文\n');
  assert.equal(previewMarkdown('{"provenance":[{"markdown":"不能泄漏"}]}'), '');
});

for (const protocol of ['chat-completions', 'responses']) test(`${protocol} 真实 SSE → 生成 API：完成前可见正文、阶段详情，取消拒绝迟到输出`, async t => {
  const pending = []; let requests = 0;
  const provider = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const input = JSON.parse(Buffer.concat(chunks)); requests++;
    assert.equal(input.stream, true);
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const event = data => res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (protocol === 'responses') {
      event({ type: 'response.created', response: { model: 'stream-actual' } });
      event({ type: 'response.output_text.delta', delta: '{"markdown":"正在生成\\n第二行' });
    } else event({ model: 'stream-actual', choices: [{ delta: { content: '{"markdown":"正在生成\\n第二行' } }] });
    pending.push(() => {
      if (protocol === 'responses') {
        event({ type: 'response.output_text.delta', delta: '完成","provenance":[]}' });
        event({ type: 'response.completed', response: { status: 'completed', model: 'stream-actual', usage: { input_tokens: 2, output_tokens: 3, total_tokens: 5 } } });
      } else {
        event({ model: 'stream-actual', choices: [{ delta: { content: '完成","provenance":[]}' }, finish_reason: 'stop' }], usage: { total_tokens: 5 } });
        res.write('data: [DONE]\n\n');
      }
      res.end();
    });
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  t.after(() => { provider.closeAllConnections(); provider.close(); });
  const selection = { serviceId: 'isolated', serviceName: '隔离流式服务', model: 'stream-test', configVersion: 'fixture-v1' };
  const api = await setup(t, { ai: { modelGovernance: { resolve: () => ({ selection, config: { protocol, model: selection.model, api_key: 'fixture-only', base_url: `http://127.0.0.1:${provider.address().port}/v1` } }) } } });
  const start = async key => {
    const response = await api.request('POST', root, JSON.stringify(body), { 'Content-Type': 'application/json', 'Idempotency-Key': key });
    assert.equal(response.status, 202, JSON.stringify(response.body)); return response.body.data.jobId;
  };
  const read = async id => (await api.request('GET', `${root}/${id}?${new URLSearchParams(ctx)}`)).body.data;
  const id = await start('complete');
  const running = await until(() => read(id), job => !!job.executionPreview?.text);
  assert.equal(running.status, 'running'); assert.equal(running.fragment, undefined);
  assert.equal(running.executionPreview.text, '正在生成\n第二行');
  assert.match(running.stageRuns.find(run => run.stageId === 'evidence').toolName, /快照读取/);
  assert.equal(running.stageRuns.find(run => run.stageId === 'writer').status, 'running');
  assert.ok(new Date(running.stageRuns.find(run => run.stageId === 'writer').startedAt) >= new Date(running.stageRuns.find(run => run.stageId === 'evidence').endedAt));
  pending.shift()();
  const completed = await until(() => read(id), job => job.status === 'completed');
  assert.equal(completed.fragment, '正在生成\n第二行完成'); assert.equal(completed.metadata.model, 'stream-actual');
  const cancelledId = await start('cancel');
  const beforeCancel = await until(() => read(cancelledId), job => !!job.executionPreview?.text);
  const response = await api.request('POST', `${root}/${cancelledId}/cancel`, JSON.stringify(ctx), { 'Content-Type': 'application/json' });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  pending.shift()(); await pause(60);
  const cancelled = await read(cancelledId);
  assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.fragment, undefined);
  assert.deepEqual(cancelled.executionPreview, beforeCancel.executionPreview);
  assert.equal(requests, 2);
});

test('Codex 活动随写作任务回读，取消后拒绝迟到事件', async t => {
  const runs = [];
  const selection = { serviceId: 'fixture', model: 'fixture', configVersion: 'v1', agentId: 'codex-fixture', executor: 'codex' };
  const codexRunner = {
    preflight() {},
    run(_messages, _config, execution) {
      return new Promise(resolve => runs.push({ execution, resolve }));
    },
  };
  const api = await setup(t, { ai: {
    modelGovernance: { resolve: () => ({ selection, config: { executor: 'codex', model: 'fixture' } }) }, codexRunner,
  } });
  const start = async key => {
    const response = await api.request('POST', root, JSON.stringify(body), { 'Content-Type': 'application/json', 'Idempotency-Key': key });
    assert.equal(response.status, 202, JSON.stringify(response.body)); return response.body.data.jobId;
  };
  const read = async id => (await api.request('GET', `${root}/${id}?${new URLSearchParams(ctx)}`)).body.data;
  const id = await start('codex-events');
  await until(() => runs.length, length => length === 1);
  const emit = (kind, extra, seq) => runs[0].execution.onEvent({ kind, seq, at: new Date().toISOString(), ...extra });
  emit('tool-started', { tool: 'knowledge_search', itemId: 'call-1', status: 'running' }, 1);
  emit('tool-completed', { tool: 'knowledge_search', itemId: 'call-1', status: 'completed' }, 2);
  emit('progress', { text: '正在整理引用。' }, 3);
  const running = await read(id);
  assert.deepEqual(running.agentEvents.map(event => event.kind), ['tool-started', 'tool-completed', 'progress']);
  assert.equal(running.stageRuns.find(run => run.stageId === 'writer').toolName, 'Codex CLI');
  assert.equal(running.agentEvents[0].tool, 'knowledge_search');
  const cancel = await api.request('POST', `${root}/${id}/cancel`, JSON.stringify(ctx), { 'Content-Type': 'application/json' });
  assert.equal(cancel.status, 200);
  emit('tool-started', { tool: 'late_tool', itemId: 'late', status: 'running' }, 4);
  runs[0].resolve({ content: '{"markdown":"迟到内容","provenance":[]}', model: 'fixture' });
  const cancelled = await read(id);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.agentEvents.length, 3);
  assert.equal(cancelled.fragment, undefined);
});
