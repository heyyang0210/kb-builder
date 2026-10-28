#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { cleanup } = require('./cleanup.cjs');
const root = path.resolve(__dirname, '../../..');
const option = key => { const index = process.argv.indexOf(key); return index < 0 ? undefined : process.argv[index + 1]; };
const source = option('--results');
if (!source) throw Error('请通过 --results 指定本次专项原始 results.json');
const report = JSON.parse(fs.readFileSync(source, 'utf8'));
const output = path.resolve(option('--output') || path.join(path.dirname(source), 'cleanup'));
if (!output.startsWith(path.join(root, 'runtime') + path.sep)) throw Error('证据必须位于runtime');
fs.mkdirSync(output, { recursive: true });
const { request } = createRequire(path.join(root, 'runtime/agent-runner/package.json'))('playwright');
(async () => {
  const local = Object.fromEntries(fs.readFileSync(path.join(root, 'config/knowledge-center/.env'), 'utf8').split(/\r?\n/).filter(x => x.includes('=') && !x.startsWith('#')).map(x => [x.slice(0,x.indexOf('=')), x.slice(x.indexOf('=')+1).replace(/^(['"])(.*)\1$/, '$2')]));
  const base = report.base;
  const context = await request.newContext();
  try {
    const login = await context.post(base + '/knowledge-center/api/auth/admin/login', { data: { username: process.env.PERF_USERNAME || local.KNOWLEDGE_CENTER_ADMIN_USERNAME, password: process.env.PERF_PASSWORD || local.KNOWLEDGE_CENTER_ADMIN_PASSWORD } });
    if (!login.ok() || (await login.json()).success === false) throw Error('清理登录失败');
    const api = async (method, endpoint, data) => {
      const r = await context.fetch(base + '/knowledge-center/api/' + endpoint, { method, data, timeout: 30000 });
      const body = await r.json();
      if (!r.ok() || body.success === false) throw Error(`${method} ${endpoint} HTTP ${r.status()} ${body.error?.code || ''}`);
      return body.data === undefined ? body : body.data;
    };
    const evidence = await cleanup({ report, api, output, root, localDataRoot: option('--local-data-root') || (new URL(base).hostname === '127.0.0.1' ? path.join(root, 'runtime/pingcode/web') : undefined) });
    console.log(report.runId, JSON.stringify(evidence));
    if (!evidence.completed) process.exitCode = 1;
  } finally { await context.dispose(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
