'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createProductionAIHttpStageAdapters, MAX_RESPONSE_BYTES } = require('../../../packages/agent-runner-core/lib/production-ai-http-stage-adapters');

async function withServer(t, handler, configure = {}) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  const env = {
    KNOWLEDGE_PRODUCTION_PLANNER_URL: `http://127.0.0.1:${server.address().port}/planner`,
    ...configure.env,
  };
  return createProductionAIHttpStageAdapters({ env })
    .planner.run({ contractVersion: '1.0' }, { payload: { text: '隔离请求' } });
}

test('HTTP stage adapter maps non-2xx responses to a controlled error', async t => {
  await assert.rejects(
    withServer(t, (_req, res) => { res.writeHead(503); res.end('unavailable'); }),
    error => error.code === 'AI_STAGE_REMOTE_FAILED',
  );
});

test('HTTP stage adapter rejects invalid JSON responses', async t => {
  await assert.rejects(
    withServer(t, (_req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{'); }),
    error => error.code === 'AI_STAGE_RESPONSE_INVALID',
  );
});

test('HTTP stage adapter rejects oversized response bodies', async t => {
  await assert.rejects(
    withServer(t, (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': MAX_RESPONSE_BYTES + 1 });
      res.end();
    }),
    error => error.code === 'AI_STAGE_RESPONSE_TOO_LARGE',
  );
});

test('HTTP stage adapter maps request timeout to a controlled error', async t => {
  await assert.rejects(
    withServer(t, (_req, res) => { setTimeout(() => res.end('{}'), 100); }, {
      env: { KNOWLEDGE_PRODUCTION_PLANNER_TIMEOUT_MS: '100' },
    }),
    error => error.code === 'AI_STAGE_TIMEOUT',
  );
});

test('HTTP stage adapter rejects unsafe or invalid deployment configuration', () => {
  for (const endpoint of ['file:///tmp/agent', 'http://user:pass@127.0.0.1/run', 'http://127.0.0.1/run#fragment', 'not-a-url']) {
    assert.throws(() => createProductionAIHttpStageAdapters({ env: {
      KNOWLEDGE_PRODUCTION_PLANNER_URL: endpoint,
    } }), error => error.code === 'AI_STAGE_CONFIG_INVALID');
  }
  assert.throws(() => createProductionAIHttpStageAdapters({ env: {
    KNOWLEDGE_PRODUCTION_PLANNER_URL: 'http://127.0.0.1/run',
    KNOWLEDGE_PRODUCTION_PLANNER_TIMEOUT_MS: '50',
  } }), error => error.code === 'AI_STAGE_CONFIG_INVALID');
});
