import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pipeline } from 'node:stream';
import YAML from 'yaml';
import { DeepSeekHarness } from '@deepseek-ai/dsh-sdk-client';

const taskRoot = process.cwd();
const socketPath = path.join(taskRoot, 'model.sock');
const workspace = path.join(taskRoot, 'workspace');
const dshHome = path.join(taskRoot, 'home');
const model = JSON.parse(fs.readFileSync(path.join(taskRoot, 'model.json'), 'utf8'));
const emit = event => process.stdout.write(`${JSON.stringify(event)}\n`);

const bridge = http.createServer((request, response) => {
  const upstream = http.request({ socketPath, path: request.url, method: request.method,
    headers: { ...request.headers, host: 'localhost' }, timeout: 120000 }, result => {
    response.writeHead(result.statusCode || 502, result.headers);
    pipeline(result, response, () => {});
  });
  upstream.on('timeout', () => upstream.destroy(new Error('model proxy timeout')));
  upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); });
  pipeline(request, upstream, () => {});
});

let harness;
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await harness?.close().catch(() => {});
  await new Promise(resolve => bridge.close(resolve));
};
process.on('SIGTERM', () => { close().finally(() => process.exit(0)); });

try {
  await new Promise((resolve, reject) => bridge.listen(0, '127.0.0.1', error => error ? reject(error) : resolve()));
  const port = bridge.address().port;
  const patch = [
    { id: 'llm-pi-ai', config: { providers: { 'kc-trial': {
      api: 'openai-completions', apiKeyEnv: 'KC_DSH_PLACEHOLDER_KEY',
      baseURL: `http://127.0.0.1:${port}/v1`,
      models: [{ id: model.name, contextWindow: model.contextWindow }],
    } } } },
    { id: 'sandbox-policy', config: { mode: 'danger-full-access', workspaceRoot: workspace } },
    { id: 'approval', config: { policy: 'never' } },
    { id: 'tool-plugin-manager', disabled: true },
    { id: 'tool-schedule', disabled: true },
    { id: 'tool-web', disabled: true },
    { id: 'tool-skill', disabled: true },
    { id: 'tool-jobs', disabled: true },
    { id: 'tool-subagent', disabled: true },
    { id: 'tool-subagent-control', disabled: true },
    { id: 'tool-subagent-fork', disabled: true },
    { id: 'tool-workflow', disabled: true },
    { id: 'web-search-deepseek', disabled: true },
  ];
  const patchPath = path.join(taskRoot, 'trial.cordis.patch.yml');
  fs.writeFileSync(patchPath, YAML.stringify(patch), { mode: 0o600 });
  harness = new DeepSeekHarness({ profile: 'sdk', dshHome, processCwd: workspace, cwd: workspace,
    patches: [patchPath], provider: 'kc-trial', model: model.name,
    maxTokens: model.maxTokens, approvalRequests: true, initializeTimeoutMs: 30000,
    env: { PATH: '/usr/bin:/bin', HOME: dshHome, DSH_HOME: dshHome,
      KC_DSH_PLACEHOLDER_KEY: 'dsh-no-secret', DSH_PERMISSION_MODE: 'danger-full-access', DO_NOT_TRACK: '1' } });
  harness.client.start();
  harness.client.onRequest(async method => {
    if (method === 'approval/request') return { outcome: 'rejected' };
    throw new Error('unsupported request');
  });
  emit({ kind: 'started' });
  const result = await harness.run(model.prompt, { onNotification(notification) {
    emit({ kind: 'progress', phase: String(notification.method || notification.type || 'activity').slice(0, 80) });
  } });
  emit({ kind: 'completed', content: String(result.finalResponse || '').slice(0, 16000), finishReason: result.finishReason });
} catch (error) {
  emit({ kind: 'failed', message: String(error?.message || error).slice(0, 300) });
  process.exitCode = 1;
} finally {
  await close();
}
