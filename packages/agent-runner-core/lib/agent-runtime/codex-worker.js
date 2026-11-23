const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const readline = require('readline');

const reply = message => process.send?.(message);
const toml = value => JSON.stringify(String(value));
let child;
let threadId;
let turnId;
let sequence = 0;
let bridge;
let cancelled = false;
function stopChild(signal = 'SIGTERM') {
  if (!child?.pid) return;
  try { process.kill(-child.pid, signal); } catch (_) { child.kill(signal); }
}
process.on('disconnect', () => { stopChild('SIGKILL'); bridge?.close(); process.exit(1); });
const pending = new Map();

function request(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} 超时`)); }, 30000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
}
function notification(method, params) {
  child.stdin.write(JSON.stringify({ method, params }) + '\n');
}
function waitForTurn() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error('Codex 运行超时'), { code: 'AGENT_RUN_TIMEOUT' })), process.env.KC_CODEX_TIMEOUT_MS || 180000);
    const done = status => { clearTimeout(timer); status === 'completed' ? resolve() : reject(new Error(`Codex 任务${status === 'interrupted' ? '已中断' : '失败'}`)); };
    process.once('codex-turn-completed', done);
  });
}
function handle(message) {
  if (message.id != null && !message.method) {
    const item = pending.get(message.id); if (!item) return;
    pending.delete(message.id); clearTimeout(item.timer);
    message.error ? item.reject(new Error(message.error.message || 'Codex 请求失败')) : item.resolve(message.result);
    return;
  }
  if (message.id != null && message.method) {
    // No external approval is silently granted by the worker.
    const decision = message.method.includes('requestApproval') ? { decision: 'decline' } : {};
    child.stdin.write(JSON.stringify({ id: message.id, result: decision }) + '\n');
    reply({ type: 'event', event: { kind: 'approval-denied', method: message.method } });
    return;
  }
  if (message.method === 'turn/completed') process.emit('codex-turn-completed', message.params?.turn?.status);
  if (message.method === 'item/agentMessage/delta') reply({ type: 'event', event: { kind: 'progress', text: String(message.params?.delta || '').slice(0, 300) } });
  if (message.method === 'item/started' || message.method === 'item/completed') {
    const item = message.params?.item || {};
    const type = String(item.type || '');
    if (['mcpToolCall', 'commandExecution', 'fileChange', 'webSearch'].includes(type)) {
      const tool = type === 'mcpToolCall' ? String(item.tool || '').slice(0, 80) : type;
      reply({ type: 'event', event: {
        kind: message.method === 'item/started' ? 'tool-started' : 'tool-completed',
        itemId: String(item.id || '').slice(0, 80), tool,
        status: message.method === 'item/completed' ? (item.status === 'failed' ? 'failed' : 'completed') : 'running',
        ...(type === 'commandExecution' && message.method === 'item/completed' && Number.isSafeInteger(item.exitCode) ? { exitCode: item.exitCode } : {}),
      } });
    }
  }
  if (message.method === 'error') reply({ type: 'event', event: { kind: 'error', message: String(message.params?.error?.message || 'Codex 运行错误').slice(0, 300) } });
}
function collect(workspace, maxBytes) {
  const output = path.join(workspace, 'output.json');
  const fd = fs.openSync(output, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let value;
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > maxBytes) throw new Error('Codex 未提交有效的 output.json');
    value = JSON.parse(fs.readFileSync(fd, 'utf8'));
  } finally { fs.closeSync(fd); }
  if (!value || typeof value.markdown !== 'string' || !value.markdown.trim() || !Array.isArray(value.provenance)) throw new Error('Codex 产物不符合正文契约');
  return JSON.stringify({ markdown: value.markdown, provenance: value.provenance });
}
async function run(task) {
  const { workspace, home, config, rules } = task;
  if (cancelled) throw new Error('任务已取消');
  fs.mkdirSync(workspace, { recursive: true, mode: 0o700 });
  fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  const installed = execFileSync('codex', ['--version'], { encoding: 'utf8' }).trim();
  if (installed !== `codex-cli ${rules.codexVersion}`) throw new Error(`Codex 版本不匹配：需要 ${rules.codexVersion}`);
  const settings = [
    `model = ${toml(config.model)}`,
    'model_provider = "knowledge_center"',
    `model_reasoning_effort = ${toml(config.reasoningEffort || 'medium')}`,
    '[model_providers.knowledge_center]',
    `name = ${toml(config.provider || 'Knowledge Center')}`,
    `base_url = ${toml(config.base_url)}`,
    'wire_api = "responses"',
    'requires_openai_auth = true',
  ];
  bridge = await require('./mcp-bridge').createMcpBridge(config.mcp || {});
  if (bridge) settings.push('[mcp_servers.knowledge_center]', `url = ${toml(bridge.url)}`, 'bearer_token_env_var = "KC_MCP_BRIDGE_TOKEN"', 'default_tools_approval_mode = "approve"');
  fs.writeFileSync(path.join(home, 'config.toml'), settings.join('\n') + '\n', { mode: 0o600 });
  fs.writeFileSync(path.join(home, 'auth.json'), JSON.stringify({ OPENAI_API_KEY: config.api_key }), { mode: 0o600 });
  const env = { PATH: process.env.PATH, LANG: 'C.UTF-8', CODEX_HOME: home, HOME: home, KC_MCP_BRIDGE_TOKEN: bridge?.token || '' };
  child = spawn('codex', ['app-server', '--listen', 'stdio://', '--strict-config'], { cwd: workspace, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  reply({ type: 'child', pid: child.pid });
  child.on('error', () => process.emit('codex-turn-completed', 'failed'));
  let stderrTail = '';
  child.stderr.on('data', chunk => {
    stderrTail = (stderrTail + chunk.toString('utf8')).slice(-4096);
    const safeTail = stderrTail
      .replace(new RegExp(config.api_key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[已隐藏]')
      .replace(/(bearer\s+)[^\s"']+/ig, '$1[已隐藏]')
      .replace(/(api[_-]?key|token|password|secret)(\s*[=:]\s*)[^,\s}]+/ig, '$1$2[已隐藏]');
    reply({ type: 'event', event: { kind: 'stderr-tail', text: safeTail.slice(-2048) } });
  });
  readline.createInterface({ input: child.stdout }).on('line', line => {
    try { handle(JSON.parse(line)); } catch (_) { reply({ type: 'event', event: { kind: 'protocol-error' } }); }
  });
  child.on('exit', () => { for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Codex 进程退出')); } pending.clear(); process.emit('codex-turn-completed', 'failed'); });
  await request('initialize', { clientInfo: { name: 'knowledge_center_worker', version: '1.0.0' }, capabilities: { experimentalApi: false } });
  notification('initialized', {});
  const thread = await request('thread/start', { cwd: workspace, model: config.model, modelProvider: 'knowledge_center', approvalPolicy: 'never', sandbox: 'workspace-write', ephemeral: true });
  threadId = thread.thread.id;
  if (cancelled) throw new Error('任务已取消');
  const completion = waitForTurn();
  completion.catch(() => {});
  const turn = await request('turn/start', { threadId, input: [{ type: 'text', text: `${rules.outputInstruction}\n\n${JSON.stringify(task.messages)}` }], effort: config.reasoningEffort || 'medium' });
  turnId = turn.turn.id;
  await completion;
  return { content: collect(workspace, rules.maxArtifactBytes), model: config.model };
}

process.on('message', async message => {
  if (message.type === 'cancel') {
    cancelled = true;
    if (threadId && turnId) request('turn/interrupt', { threadId, turnId }).catch(() => {});
    setTimeout(() => { stopChild('SIGKILL'); process.emit('codex-turn-completed', 'interrupted'); }, 5000).unref();
    return;
  }
  if (message.type !== 'run') return;
  try { reply({ type: 'result', value: await run(message.task) }); }
  catch (error) { reply({ type: 'error', message: error.message, ...(error.code === 'AGENT_RUN_TIMEOUT' ? { code: error.code } : {}) }); }
  finally {
    stopChild(); bridge?.close();
    if (message.task?.home) fs.rmSync(path.join(message.task.home, 'auth.json'), { force: true });
    process.exit(0);
  }
});
