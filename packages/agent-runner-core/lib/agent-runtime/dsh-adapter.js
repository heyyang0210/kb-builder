const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { Readable } = require('node:stream');
const { REPOSITORY_ROOT } = require('../repo-paths');
const { writeJsonAtomic, readJson } = require('../json-config');
const { versionAtLeast, requiredNode } = require('./dsh-runner');

const terminal = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
const idPattern = /^[a-f0-9-]{36}$/;
const fail = (message, status = 404) => Object.assign(new Error(message), { code: 'DSH_RUN_UNAVAILABLE', status });
function sandboxFactsValid(facts) {
  return /^v\d+\.\d+\.\d+$/.test(facts.node) && versionAtLeast(facts.node, requiredNode)
    && !facts.repo && !facts.home && !facts.bus
    && facts.pid === 1 && !facts.network;
}

function createDshAdapter(options = {}) {
  const root = options.root || path.join(REPOSITORY_ROOT, 'runtime', 'agent-runner', 'dsh-runs');
  const modules = options.modules || path.join(REPOSITORY_ROOT, 'node_modules');
  const node = options.node || path.join(REPOSITORY_ROOT, 'runtime', 'deepseek-harness', 'node_modules', 'node', 'bin', 'node');
  const worker = options.worker || path.join(__dirname, 'dsh-worker.mjs');
  const active = new Map();
  const socketRoot = process.env.XDG_RUNTIME_DIR || `/run/user/${process.getuid()}`;
  const maxRunMs = options.maxRunMs || 180000;
  let sandboxProven = false;
  let credentialProven = false;

  function read(id) {
    if (!idPattern.test(id)) throw fail('DSH 运行记录不存在');
    const file = path.join(root, id, 'run.json');
    if (!fs.existsSync(file)) throw fail('DSH 运行记录不存在');
    const state = readJson(file);
    if (!terminal.has(state.status) && !active.has(id)) {
      state.status = 'interrupted';
      writeJsonAtomic(file, state);
    }
    return state;
  }
  function append(state, event) {
    state.sequence += 1;
    state.events.push({ seq: state.sequence, at: new Date().toISOString(), ...event });
    if (state.events.length > 200) state.events.splice(0, state.events.length - 200);
    writeJsonAtomic(path.join(root, state.id, 'run.json'), state);
  }
  function clean(value, secret) {
    return String(value || '').split(secret).join('[已隐藏]').slice(0, 16000);
  }
  function unitArgs(id, guest, socket) {
    const target = path.join(socketRoot, `kc-dsh-task-${id}`);
    const props = [
      'PrivateUsers=yes', 'PrivateNetwork=yes', 'PrivateTmp=yes', 'ProtectSystem=strict', 'ProtectHome=tmpfs',
      'ProtectProc=invisible', 'ProcSubset=pid', 'NoNewPrivileges=yes',
      'InaccessiblePaths=/data', 'InaccessiblePaths=/mnt', 'InaccessiblePaths=/media',
      'InaccessiblePaths=/etc', 'InaccessiblePaths=/var',
      `TemporaryFileSystem=${socketRoot}:mode=0700`,
      `BindPaths=${guest}:${target}`,
      `BindPaths=${socket}:${target}/model.sock`,
      `BindReadOnlyPaths=${modules}:${target}/node_modules`,
      `BindReadOnlyPaths=${node}:${target}/dsh-node`,
      `WorkingDirectory=${target}`,
      `RuntimeMaxSec=${Math.ceil(maxRunMs / 1000) + 10}`,
      'MemoryMax=2G', 'TasksMax=80',
    ];
    return ['--user', '--pipe', '--collect', '--unit', `kc-dsh-${id}`,
      ...props.flatMap(prop => ['-p', prop]), '/usr/bin/unshare', '--user', '--map-root-user',
      '--pid', '--fork', '--mount-proc', '/usr/bin/env', '-i',
      'PATH=/usr/bin:/bin', `HOME=${target}/home`, 'LANG=C.UTF-8',
      `${target}/dsh-node`, `${target}/worker.mjs`];
  }
  function validateModel(config) {
    if (config?.protocol !== 'chat_completions' || !config.api_key || !config.model || !config.base_url) {
      throw Object.assign(new Error('请配置可用的 Chat Completions 模型'), { code: 'DSH_MODEL_UNAVAILABLE', status: 422 });
    }
    const base = new URL(config.base_url);
    if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
      throw Object.assign(new Error('模型地址无效'), { code: 'DSH_MODEL_UNAVAILABLE', status: 422 });
    }
    return base.href.replace(/\/+$/, '');
  }
  function proxy(socket, modelConfig, upstreamBase) {
    let requestCount = 0;
    const requests = new Set();
    let stopped = false;
    const server = http.createServer(async (req, res) => {
      if (req.method !== 'POST' || req.url !== '/v1/chat/completions' || ++requestCount > 20) {
        res.writeHead(403); res.end(); return;
      }
      const chunks = []; let bytes = 0;
      const controller = new AbortController();
      requests.add(controller);
      try {
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 1024 * 1024) throw new Error('model request too large');
          chunks.push(chunk);
        }
        const body = Buffer.concat(chunks);
        if (JSON.parse(body.toString()).model !== modelConfig.model) throw new Error('model mismatch');
        const timeout = AbortSignal.timeout(120000);
        const response = await fetch(`${upstreamBase}/chat/completions`, {
          method: 'POST', redirect: 'error', signal: AbortSignal.any([timeout, controller.signal]),
          headers: { 'content-type': 'application/json', authorization: `Bearer ${modelConfig.api_key}` }, body,
        });
        res.writeHead(response.status, { 'content-type': response.headers.get('content-type') || 'application/json' });
        if (response.body) Readable.fromWeb(response.body).pipe(res); else res.end();
      } catch (_) { if (!res.headersSent) res.writeHead(502); res.end(); }
      finally { requests.delete(controller); }
    });
    server.stopRequests = () => {
      if (stopped) return;
      stopped = true;
      for (const controller of requests) controller.abort();
      server.closeAllConnections();
      server.close();
    };
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(socket, () => { server.off('error', reject); resolve(server); });
    });
  }
  function start({ agentId, modelConfig, prompt }) {
    const upstreamBase = validateModel(modelConfig);
    const id = crypto.randomUUID();
    const directory = path.join(root, id);
    const guest = path.join(directory, 'guest');
    fs.mkdirSync(path.join(guest, 'workspace'), { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.join(guest, 'home'), { mode: 0o700 });
    fs.mkdirSync(path.join(guest, 'node_modules'));
    fs.copyFileSync(worker, path.join(guest, 'worker.mjs'));
    fs.writeFileSync(path.join(guest, 'dsh-node'), '');
    fs.writeFileSync(path.join(guest, 'model.sock'), '');
    fs.writeFileSync(path.join(guest, 'model.json'), JSON.stringify({ name: modelConfig.model,
      maxTokens: Math.min(modelConfig.max_tokens || 4096, 4096), contextWindow: 128000, prompt }), { mode: 0o600 });
    const state = { id, taskId: id, agentId, ownerPid: process.pid, status: 'running', sequence: 0,
      events: [], createdAt: new Date().toISOString(), model: modelConfig.model };
    append(state, { kind: 'started' });
    const socket = path.join(socketRoot, `kc-dsh-model-${id}.sock`);
    const item = { state, socket, child: null, server: null, stopped: false };
    active.set(id, item);
    proxy(socket, modelConfig, upstreamBase).then(server => {
      item.server = server;
      if (item.stopped) { finish('cancelled', '已取消'); return; }
      const child = spawn('systemd-run', unitArgs(id, guest, socket), { stdio: ['ignore', 'pipe', 'pipe'],
        env: { PATH: '/usr/bin:/bin', LC_ALL: 'C', XDG_RUNTIME_DIR: socketRoot } });
      item.child = child;
      let diagnostics = '';
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-4000); });
      let buffered = '';
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => {
        buffered += chunk;
        for (let index; (index = buffered.indexOf('\n')) !== -1;) {
          const line = buffered.slice(0, index); buffered = buffered.slice(index + 1);
          let event; try { event = JSON.parse(line); } catch (_) { continue; }
          if (!['started', 'progress', 'completed', 'failed'].includes(event.kind)) continue;
          if (terminal.has(state.status)) continue;
          if (item.stopped) continue;
          if (event.kind === 'completed') state.status = 'completed';
          if (event.kind === 'failed') state.status = 'failed';
          append(state, { kind: event.kind, ...(event.phase ? { phase: clean(event.phase, modelConfig.api_key).slice(0, 80) } : {}),
            ...(event.content ? { content: clean(event.content, modelConfig.api_key) } : {}),
            ...(event.message ? { message: clean(event.message, modelConfig.api_key).slice(0, 300) } : {}) });
        }
      });
      child.on('error', () => finish('failed', 'DSH 沙箱启动失败'));
      child.on('close', () => {
        if (diagnostics) fs.writeFileSync(path.join(directory, 'diagnostics.log'), clean(diagnostics, modelConfig.api_key), { mode: 0o600 });
        finish(item.stopped ? 'cancelled' : 'failed', 'DSH 运行进程已退出');
      });
    }).catch(() => finish('failed', 'DSH 模型代理启动失败'));
    function finish(status, message) {
      if (!terminal.has(state.status)) { state.status = status; append(state, { kind: status, message }); }
      item.server?.stopRequests();
      active.delete(id);
      try { fs.unlinkSync(socket); } catch (_) {}
    }
    item.finish = finish;
    setTimeout(() => { if (!terminal.has(state.status)) cancel(id); }, maxRunMs).unref();
    return read(id);
  }
  function cancel(id) {
    const state = read(id); const item = active.get(id);
    if (!item || terminal.has(state.status)) return state;
    item.stopped = true;
    state.status = 'cancelling';
    append(state, { kind: 'progress', phase: 'cancelling' });
    const stop = spawn('systemctl', ['--user', 'stop', `kc-dsh-${id}.service`], { stdio: 'ignore' });
    stop.on('close', () => { if (active.has(id)) item.finish('cancelled', '已取消'); });
    stop.on('error', () => { if (active.has(id)) item.finish('failed', 'DSH 取消失败'); });
    return state;
  }
  async function probe() {
    const id = crypto.randomUUID();
    const directory = path.join(root, 'probe', id);
    const guest = path.join(directory, 'guest');
    fs.mkdirSync(path.join(guest, 'workspace'), { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.join(guest, 'home'), { mode: 0o700 });
    fs.mkdirSync(path.join(guest, 'node_modules'));
    fs.writeFileSync(path.join(guest, 'dsh-node'), '');
    fs.writeFileSync(path.join(guest, 'model.sock'), '');
    const socket = path.join(socketRoot, `kc-dsh-model-${id}.sock`);
    const server = require('node:net').createServer(client => client.end('proxy-only'));
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(socket, () => { server.off('error', reject); resolve(); });
      });
      const script = `const fs=require('fs'),net=require('net');const r={node:process.version,pid:process.pid,repo:fs.existsSync(${JSON.stringify(path.join(REPOSITORY_ROOT, 'README.md'))}),home:fs.existsSync('/home/hey/.bashrc'),bus:fs.existsSync(${JSON.stringify(path.join(socketRoot, 'bus'))}),env:Object.keys(process.env).sort(),socket:false,network:false};const s=net.createConnection(${JSON.stringify(path.join(socketRoot, `kc-dsh-task-${id}`, 'model.sock'))});s.on('data',b=>{r.socket=b.toString()==='proxy-only';s.end();const n=net.createConnection({host:'1.1.1.1',port:443,timeout:800});n.on('connect',()=>{r.network=true;n.destroy();console.log(JSON.stringify(r))});n.on('error',()=>console.log(JSON.stringify(r)));n.on('timeout',()=>{n.destroy();console.log(JSON.stringify(r))})});s.on('error',()=>{console.log(JSON.stringify(r));process.exitCode=1})`;
      const args = unitArgs(id, guest, socket);
      args.splice(-1, 1, '-e', script);
      const output = await new Promise((resolve, reject) => {
        const child = spawn('systemd-run', args, { env: { PATH: '/usr/bin:/bin', XDG_RUNTIME_DIR: socketRoot }, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = ''; let stderr = '';
        child.stdout.on('data', chunk => { stdout = (stdout + chunk).slice(-4000); });
        child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
        child.on('error', reject);
        child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr.slice(-300))));
      });
      const facts = JSON.parse(output.split('\n').find(line => line.startsWith('{')) || '{}');
      sandboxProven = sandboxFactsValid(facts);
      credentialProven = facts.socket === true && !facts.env.some(name => /KEY|TOKEN|SECRET|AUTH|DBUS|SSH/i.test(name));
    } catch (_) { sandboxProven = false; credentialProven = false; }
    finally {
      if (server.listening) server.close();
      try { fs.unlinkSync(socket); } catch (_) {}
      fs.rmSync(directory, { recursive: true, force: true });
    }
    return { sandbox: sandboxProven, credential: credentialProven };
  }
  if (options.autoProbe !== false) probe().catch(() => {});
  return { start, get: read, cancel, owns: id => idPattern.test(id) && (active.has(id) || fs.existsSync(path.join(root, id, 'run.json'))),
    sandboxIsolation: { verify: () => sandboxProven }, credentialIsolation: { verify: () => credentialProven },
    probe };
}

module.exports = { createDshAdapter, sandboxFactsValid };
