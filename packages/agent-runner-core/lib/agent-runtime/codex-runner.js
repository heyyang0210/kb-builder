const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { fork } = require('child_process');
const { getContext } = require('../log-context');
const { REPOSITORY_ROOT } = require('../repo-paths');
const { readJson } = require('../json-config');
const { CONFIG_PATHS } = require('../config-registry');
const { writeJsonAtomic } = require('../json-config');

function createCodexRunner(options = {}) {
  const runtimeRoot = options.runtimeRoot || path.join(REPOSITORY_ROOT, 'runtime', 'agent-runner', 'codex-runs');
  const workerPath = options.workerPath || path.join(__dirname, 'codex-worker.js');
  const rules = options.rules || readJson(CONFIG_PATHS.contentRules).agentRuntime;
  const active = new Map();
  const fail = (message, status = 404) => Object.assign(new Error(message), { code: 'AGENT_RUN_UNAVAILABLE', status });
  function isOwnerAlive(pid) {
    if (!pid || pid === process.pid) return false;
    try { process.kill(pid, 0); return true; } catch (_) { return false; }
  }
  function record(id) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw fail('运行记录不存在');
    const file = path.join(runtimeRoot, id, 'run.json');
    if (!fs.existsSync(file)) throw fail('运行记录不存在');
    const value = readJson(file);
    if (['queued', 'running', 'cancelling'].includes(value.status) && !active.has(id) && !isOwnerAlive(value.ownerPid)) { value.status = 'interrupted'; writeJsonAtomic(file, value); }
    return value;
  }
  function cancel(id) {
    const value = record(id); const item = active.get(id);
    if (item) { item.controller.abort(); value.status = 'cancelling'; writeJsonAtomic(path.join(runtimeRoot, id, 'run.json'), value); }
    return value;
  }
  function preflight(modelConfig) {
    if (modelConfig?.protocol !== 'responses') throw Object.assign(new Error('Codex 需要 Responses 协议；当前模型连接使用 Chat Completions，请配置兼容的 Responses 地址'), { code: 'AGENT_PROTOCOL_UNSUPPORTED', status: 422 });
    if (require('../mcp-services').mcpServices(modelConfig.mcp || {}).some(s => s.enabled !== false && s.adapter === 'generic')) throw Object.assign(new Error('当前 Codex 桥接支持知识库服务；通用 MCP 适配器尚未接入，请先停用该服务'), { code: 'AGENT_MCP_UNSUPPORTED', status: 422 });
    if (!modelConfig.api_key || !modelConfig.base_url || !modelConfig.model) throw Object.assign(new Error('请先保存可用的模型连接'), { code: 'AGENT_MODEL_UNAVAILABLE', status: 422 });
  }
  async function run(messages, modelConfig, execution = {}) {
    preflight(modelConfig);
    const id = execution.runId || crypto.randomUUID();
    if (!active.has(id)) {
      const controller = new AbortController();
      const parentSignal = execution.signal;
      parentSignal?.addEventListener('abort', () => controller.abort(), { once: true });
      if (parentSignal?.aborted) controller.abort();
      execution = { ...execution, signal: controller.signal };
      active.set(id, { controller });
    }
    const directory = path.join(runtimeRoot, id);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const file = path.join(directory, 'run.json');
    const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
    const manifest = {
      codexVersion: rules.codexVersion, agentConfigVersion: modelConfig.agentConfigVersion || null,
      modelConfigVersion: modelConfig.modelConfigVersion || null, model: modelConfig.model,
      baseUrl: modelConfig.base_url, protocol: modelConfig.protocol, reasoningEffort: modelConfig.reasoningEffort,
      inputDigest: hash(messages), rulesDigest: hash(rules), timeoutMs: rules.timeoutMs,
      approvalPolicy: 'never', sandbox: 'workspace-write',
      mcpServices: require('../mcp-services').mcpServices(modelConfig.mcp || {}).filter(s => s.enabled !== false).map(s => ({
        id: s.id, adapter: s.adapter, knowledgeBases: (s.knowledgeBases || []).filter(k => k.enabled !== false).map(k => k.id),
      })),
    };
    const context = getContext();
    const state = { ownerPid: process.pid, id, taskId: id, requestId: context.requestId || null, correlationId: context.correlationId || null, agentId: modelConfig.agentId || null, model: modelConfig.model, manifest, status: 'running', events: [], createdAt: new Date().toISOString() };
    const save = () => writeJsonAtomic(file, state);
    const secrets = [modelConfig.api_key, ...(modelConfig.mcp?.services || []).flatMap(s => [s.api_key, ...(s.headers || []).map(h => h.value)])].filter(Boolean);
    const append = event => {
      let raw = JSON.stringify(event); for (const secret of secrets) raw = raw.split(secret).join('[已隐藏]');
      state.sequence = (state.sequence || 0) + 1;
      const safeEvent = { seq: state.sequence, at: new Date().toISOString(), ...JSON.parse(raw) };
      state.events.push(safeEvent);
      if (state.events.length > rules.maxEvents) state.events.splice(0, state.events.length - rules.maxEvents);
      save();
      try { execution.onEvent?.(safeEvent); } catch (_) { /* Telemetry cannot change the Codex result. */ }
    };
    save();
    const worker = fork(workerPath, { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: { ...process.env, KC_CODEX_TIMEOUT_MS: String(rules.timeoutMs) } });
    let killTimer; let childPid;
    const kill = () => {
      if (childPid) { try { process.kill(-childPid, 'SIGKILL'); } catch (_) {} }
      worker.kill('SIGKILL');
    };
    const abort = () => { if (worker.connected) worker.send({ type: 'cancel' }); killTimer ||= setTimeout(kill, 6000); };
    execution.signal?.addEventListener('abort', abort, { once: true });
    if (execution.signal?.aborted) abort();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true; clearTimeout(timer); clearTimeout(killTimer); execution.signal?.removeEventListener('abort', abort);
        state.status = execution.signal?.aborted ? 'cancelled' : error ? 'failed' : 'completed';
        fs.rmSync(path.join(directory, 'codex-home', 'auth.json'), { force: true });
        if (error) state.error = { message: 'Codex 运行未完成，请检查连接或运行事件' };
        if (!error && !execution.signal?.aborted) state.result = { model: value.model, ...JSON.parse(value.content) };
        append({ kind: state.status }); active.delete(id);
        if (execution.signal?.aborted) reject(Object.assign(new Error('任务已取消'), { code: 'AGENT_RUN_CANCELLED' }));
        else error ? reject(error) : resolve(value);
      };
      const timer = setTimeout(() => { abort(); kill(); finish(new Error('Codex 任务超时')); }, rules.timeoutMs + 10000);
      worker.on('error', () => finish(new Error('无法启动 Codex Worker')));
      worker.on('message', message => {
        if (settled) return;
        if (message.type === 'child') childPid = message.pid;
        if (message.type === 'event') { append(message.event); }
        if (message.type === 'result') finish(null, message.value);
        if (message.type === 'error') finish(new Error(message.message));
      });
      worker.on('exit', code => finish(new Error(`Codex Worker 中断（${code}）`)));
      worker.send({ type: 'run', task: { messages, workspace: path.join(directory, 'workspace'), home: path.join(directory, 'codex-home'),
        config: { ...modelConfig, api_key: modelConfig.api_key }, rules } });
    });
  }
  function start(messages, config) {
    preflight(config);
    const id = crypto.randomUUID(); const controller = new AbortController();
    active.set(id, { controller });
    run(messages, config, { runId: id, signal: controller.signal }).catch(() => {});
    return { id, status: 'running' };
  }
  return { run, preflight, start, get: record, cancel };
}

module.exports = { createCodexRunner };
