const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createCodexRunner } = require('../../../packages/agent-runner-core/lib/agent-runtime/codex-runner');
const { readJson } = require('../../../packages/agent-runner-core/lib/json-config');
const { CONFIG_PATHS } = require('../../../packages/agent-runner-core/lib/config-registry');

jest.setTimeout(15000);

const runtimeRoot = path.resolve(__dirname, '../../../runtime/test-results');
const model = { protocol: 'responses', base_url: 'https://example.invalid/v1', model: 'fixture-model', api_key: 'fixture-secret' };

function fixture() {
  fs.mkdirSync(runtimeRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(runtimeRoot, 'codex-runner-coverage-'));
  const workerPath = path.join(directory, 'protocol-worker.cjs');
  fs.writeFileSync(workerPath, `
process.on('message', message => {
  if (message.type === 'cancel') { process.send({ type: 'error', message: '已取消' }, () => process.exit(0)); return; }
  if (message.type !== 'run') return;
  const mode = message.task.messages[0]?.content;
  process.send({ type: 'event', event: { kind: 'progress', text: 'fixture-secret' } });
  if (mode === 'wait') return;
  if (mode === 'timeout') { process.send({ type: 'error', message: 'Codex 运行超时', code: 'AGENT_RUN_TIMEOUT' }, () => process.exit(0)); return; }
  if (mode === 'error') process.send({ type: 'error', message: '受控 Worker 失败' }, () => process.exit(0));
  else process.send({ type: 'result', value: { model: 'fixture-model', content: JSON.stringify({ markdown: '# 已生成', provenance: [] }) } }, () => process.exit(0));
});
`);
  const runner = createCodexRunner({ runtimeRoot: directory, workerPath, rules: readJson(CONFIG_PATHS.contentRules).agentRuntime });
  return { directory, runner, close: () => fs.rmSync(directory, { recursive: true, force: true }) };
}

async function until(read, predicate) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const value = read();
    if (predicate(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error('等待 Codex 运行记录超时');
}

test('受控子进程成功时保存运行清单和脱敏事件，失败时不泄露错误结果', async () => {
  const f = fixture();
  try {
    const events = [];
    const id = crypto.randomUUID();
    const value = await f.runner.run([{ role: 'user', content: 'success' }], model, { runId: id, onEvent: event => events.push(event) });
    expect(value).toEqual({ model: 'fixture-model', content: JSON.stringify({ markdown: '# 已生成', provenance: [] }) });
    const recorded = f.runner.get(id);
    expect(recorded).toMatchObject({ id, status: 'completed', manifest: { protocol: 'responses', approvalPolicy: 'never', sandbox: 'workspace-write' }, result: { markdown: '# 已生成', provenance: [] } });
    expect(recorded.manifest.inputDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(events.map(event => event.seq)).toEqual([1, 2]);
    expect(JSON.stringify(recorded.events)).not.toContain(model.api_key);
    expect(recorded.events[0].text).toBe('[已隐藏]');
    expect(fs.existsSync(path.join(f.directory, id, 'codex-home', 'auth.json'))).toBe(false);

    const failedId = crypto.randomUUID();
    await expect(f.runner.run([{ role: 'user', content: 'error' }], model, { runId: failedId })).rejects.toThrow('受控 Worker 失败');
    expect(f.runner.get(failedId)).toMatchObject({ status: 'failed', error: { message: 'Codex 运行未完成，请检查连接或运行事件' } });
    expect(f.runner.get(failedId).result).toBeUndefined();

    const timeoutId = crypto.randomUUID();
    await expect(f.runner.run([{ role: 'user', content: 'timeout' }], model, { runId: timeoutId })).rejects.toMatchObject({ code: 'AGENT_RUN_TIMEOUT' });
    expect(f.runner.get(timeoutId)).toMatchObject({ status: 'failed', error: { code: 'AGENT_RUN_TIMEOUT', message: 'Codex 运行超时，未收到完成事件' } });
  } finally { f.close(); }
});

test('取消运行与孤儿状态回读，以及预检错误', async () => {
  const f = fixture();
  try {
    expect(() => f.runner.preflight({ ...model, protocol: 'chat_completions' })).toThrow(expect.objectContaining({ code: 'AGENT_PROTOCOL_UNSUPPORTED', status: 422 }));
    expect(() => f.runner.preflight({ ...model, api_key: '' })).toThrow(expect.objectContaining({ code: 'AGENT_MODEL_UNAVAILABLE', status: 422 }));
    expect(() => f.runner.get('invalid')).toThrow(expect.objectContaining({ code: 'AGENT_RUN_UNAVAILABLE', status: 404 }));
    expect(() => f.runner.cancel(crypto.randomUUID())).toThrow(expect.objectContaining({ code: 'AGENT_RUN_UNAVAILABLE', status: 404 }));

    const orphanId = crypto.randomUUID();
    const orphanPath = path.join(f.directory, orphanId);
    fs.mkdirSync(orphanPath);
    fs.writeFileSync(path.join(orphanPath, 'run.json'), JSON.stringify({ id: orphanId, status: 'running', ownerPid: 99999999 }));
    expect(f.runner.get(orphanId).status).toBe('interrupted');
    expect(JSON.parse(fs.readFileSync(path.join(orphanPath, 'run.json'), 'utf8')).status).toBe('interrupted');

    const id = crypto.randomUUID();
    const controller = new AbortController();
    const running = f.runner.run([{ role: 'user', content: 'wait' }], model, { runId: id, signal: controller.signal });
    await until(() => f.runner.get(id), value => value.events?.length > 0);
    expect(f.runner.cancel(id).status).toBe('cancelling');
    await expect(running).rejects.toMatchObject({ code: 'AGENT_RUN_CANCELLED' });
    expect(f.runner.get(id).status).toBe('cancelled');
    expect(f.runner.get(id).events.at(-1).kind).toBe('cancelled');
  } finally { f.close(); }
});
