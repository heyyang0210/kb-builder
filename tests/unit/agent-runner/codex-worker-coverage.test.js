const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');

const workerModule = '../../../packages/agent-runner-core/lib/agent-runtime/codex-worker';
const runtimeRoot = path.resolve(__dirname, '../../../runtime/test-results');

function harness({ complete = true } = {}) {
  fs.mkdirSync(runtimeRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(runtimeRoot, 'codex-worker-coverage-'));
  const messages = [];
  const handlers = {};
  const child = new EventEmitter();
  child.pid = 987654;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = jest.fn();
  const calls = [];
  child.stdin = new Writable({ write(chunk, _encoding, callback) {
    for (const line of String(chunk).trim().split('\n')) {
      const request = JSON.parse(line);
      calls.push(request);
      if (request.id && request.method) {
        const result = request.method === 'thread/start' ? { thread: { id: 'thread-1' } }
          : request.method === 'turn/start' ? { turn: { id: 'turn-1' } } : {};
        setImmediate(() => {
          child.stdout.write(JSON.stringify({ id: request.id, result }) + '\n');
          if (request.method === 'turn/start') {
            child.stdout.write(JSON.stringify({ method: 'item/agentMessage/delta', params: { delta: '正文生成中' } }) + '\n');
            if (complete) child.stdout.write(JSON.stringify({ method: 'turn/completed', params: { turn: { status: 'completed' } } }) + '\n');
          }
        });
      }
    }
    callback();
  } });
  const on = jest.spyOn(process, 'on').mockImplementation((event, callback) => {
    if (event === 'message' || event === 'disconnect') { handlers[event] = callback; return process; }
    return EventEmitter.prototype.on.call(process, event, callback);
  });
  const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
  const kill = jest.spyOn(process, 'kill').mockImplementation(() => true);
  const originalSend = process.send;
  process.send = message => messages.push(message);
  jest.doMock('child_process', () => ({ spawn: jest.fn(() => child), execFileSync: jest.fn(() => 'codex-cli fixture-version\n') }));
  jest.doMock(workerModule.replace('codex-worker', 'mcp-bridge'), () => ({ createMcpBridge: jest.fn(async () => null) }));
  jest.isolateModules(() => require(workerModule));
  const task = { workspace: path.join(root, 'workspace'), home: path.join(root, 'home'),
    config: { model: 'fixture', provider: '测试', base_url: 'https://example.invalid', api_key: 'fixture-secret' },
    rules: { codexVersion: 'fixture-version', outputInstruction: '写入 output.json', maxArtifactBytes: 4096 },
    messages: [{ role: 'user', content: '测试' }] };
  return { child, calls, messages, handlers, task, root, restore() {
    on.mockRestore(); exit.mockRestore(); kill.mockRestore(); process.send = originalSend;
    jest.dontMock('child_process'); jest.dontMock(workerModule.replace('codex-worker', 'mcp-bridge'));
    fs.rmSync(root, { recursive: true, force: true });
  } };
}

async function until(predicate) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  throw new Error('等待受控 Worker 消息超时');
}

test('Worker 通过 app-server 协议收集产物并只向父进程发送安全事件', async () => {
  const f = harness();
  try {
    fs.mkdirSync(f.task.workspace, { recursive: true });
    fs.writeFileSync(path.join(f.task.workspace, 'output.json'), JSON.stringify({ markdown: '# 已生成', provenance: [] }));
    await f.handlers.message({ type: 'run', task: f.task });
    expect(f.calls.map(call => call.method)).toEqual(['initialize', 'initialized', 'thread/start', 'turn/start']);
    expect(f.messages).toEqual(expect.arrayContaining([
      { type: 'child', pid: f.child.pid },
      { type: 'event', event: { kind: 'progress', text: '正文生成中' } },
      { type: 'result', value: { content: JSON.stringify({ markdown: '# 已生成', provenance: [] }), model: 'fixture' } },
    ]));
    expect(fs.readFileSync(path.join(f.task.home, 'config.toml'), 'utf8')).toContain('model = "fixture"');
    expect(fs.existsSync(path.join(f.task.home, 'auth.json'))).toBe(false);
  } finally { f.restore(); }
});

test('Worker 拒绝不符合产物契约的 output.json 并清理授权文件', async () => {
  const f = harness();
  try {
    fs.mkdirSync(f.task.workspace, { recursive: true });
    fs.writeFileSync(path.join(f.task.workspace, 'output.json'), JSON.stringify({ markdown: '', provenance: [] }));
    await f.handlers.message({ type: 'run', task: f.task });
    expect(f.messages.at(-1)).toEqual({ type: 'error', message: 'Codex 产物不符合正文契约' });
    expect(fs.existsSync(path.join(f.task.home, 'auth.json'))).toBe(false);
  } finally { f.restore(); }
});

test('Worker 拒绝服务端审批并将工具、错误和 stderr 事件安全转发', async () => {
  const f = harness();
  try {
    fs.mkdirSync(f.task.workspace, { recursive: true });
    fs.writeFileSync(path.join(f.task.workspace, 'output.json'), JSON.stringify({ markdown: '# 正文', provenance: [] }));
    await f.handlers.message({ type: 'run', task: f.task });
    const events = [
      { id: 42, method: 'item/requestApproval', params: {} },
      { method: 'item/started', params: { item: { type: 'mcpToolCall', id: 'tool-1', tool: 'search' } } },
      { method: 'item/completed', params: { item: { type: 'commandExecution', id: 'tool-2', status: 'failed', exitCode: 7 } } },
      { method: 'error', params: { error: { message: '受控失败' } } },
    ];
    for (const event of events) f.child.stdout.write(JSON.stringify(event) + '\n');
    f.child.stderr.write('bearer abc api_key=fixture-secret\n');
    await until(() => f.messages.some(message => message.event?.kind === 'stderr-tail'));
    expect(f.calls.at(-1)).toEqual({ id: 42, result: { decision: 'decline' } });
    expect(f.messages).toEqual(expect.arrayContaining([
      { type: 'event', event: { kind: 'approval-denied', method: 'item/requestApproval' } },
      { type: 'event', event: { kind: 'tool-started', itemId: 'tool-1', tool: 'search', status: 'running' } },
      { type: 'event', event: { kind: 'tool-completed', itemId: 'tool-2', tool: 'commandExecution', status: 'failed', exitCode: 7 } },
      { type: 'event', event: { kind: 'error', message: '受控失败' } },
    ]));
    const stderr = f.messages.find(message => message.event?.kind === 'stderr-tail').event.text;
    expect(stderr).not.toContain('abc');
    expect(stderr).not.toContain('fixture-secret');
    expect(stderr).toContain('[已隐藏]');
    await f.handlers.message({ type: 'cancel' });
    expect(f.calls.at(-1).method).toBe('turn/interrupt');
  } finally { f.restore(); }
});

test('已有产物但未收到完成事件时返回超时，不将产物视为成功', async () => {
  const previous = process.env.KC_CODEX_TIMEOUT_MS;
  process.env.KC_CODEX_TIMEOUT_MS = '30';
  const f = harness({ complete: false });
  try {
    fs.mkdirSync(f.task.workspace, { recursive: true });
    fs.writeFileSync(path.join(f.task.workspace, 'output.json'), JSON.stringify({ markdown: '# 未完成', provenance: [] }));
    await f.handlers.message({ type: 'run', task: f.task });
    expect(f.messages.at(-1)).toEqual({ type: 'error', message: 'Codex 运行超时', code: 'AGENT_RUN_TIMEOUT' });
    expect(f.messages.some(message => message.type === 'result')).toBe(false);
  } finally {
    if (previous === undefined) delete process.env.KC_CODEX_TIMEOUT_MS; else process.env.KC_CODEX_TIMEOUT_MS = previous;
    f.restore();
  }
});
