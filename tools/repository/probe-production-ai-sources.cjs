#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const port = Number(process.env.KNOWLEDGE_CENTER_PINGCODE_API_PORT || process.env.PINGCODE_API_PORT || 18010);
const apiBase = String(process.env.KNOWLEDGE_CENTER_PINGCODE_API_BASE || `http://127.0.0.1:${port}`).replace(/\/$/, '');
const defaultOutput = path.join(root, 'runtime/test-results/production-ai-integration', new Date().toISOString().slice(0, 10).replaceAll('-', ''), 'source-connectors-probe.json');
const outputPath = path.resolve(process.env.PRODUCTION_AI_SOURCE_PROBE_OUTPUT || defaultOutput);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

async function probeMCP(report) {
  const configManager = require('../../packages/agent-runner-core/lib/config-manager');
  const { MCPClient } = require('../../packages/agent-runner-core/lib/tools/mcp-client');
  const config = await configManager.getMCPConfig();
  if (!config?.server_url) throw new Error('MCP_CONFIG_MISSING');
  const client = new MCPClient({ ...config, cache: { enabled: false } });
  const search = await client.query('YashanDB SQL 事务 提交 回滚', { limit: 3 });
  const blocks = (search?.content || []).filter(item => item.type === 'text').map(item => item.text);
  const result = blocks.map(block => {
    try { return JSON.parse(block); } catch (_) { return null; }
  }).find(value => value && Array.isArray(value.results));
  if (search?.isError || !result?.results?.length) throw new Error('MCP_SEARCH_FAILED');
  const first = result.results[0];
  const title = first.ku_name || first.title;
  if (!title) throw new Error('MCP_RESULT_LOCATOR_MISSING');
  const detail = await client.getDocument(title);
  const content = (detail?.content || []).filter(item => item.type === 'text').map(item => item.text).join('\n');
  if (detail?.isError || !content.trim()) throw new Error('MCP_DETAIL_FAILED');
  report.knowledgeMCP = {
    status: 'passed',
    searchResultCount: result.results.length,
    detailLocator: title,
    detailChars: content.length,
    detailDigest: digest(content),
    contentOutput: false,
  };
}

async function probePingCode(report) {
  const configPath = path.resolve(process.env.PINGCODE_CONFIG || path.join(root, 'config/pingcode/credentials.json'));
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const configuredTarget = Array.isArray(config.targets) ? config.targets[0]?.url : null;
  const targetUrl = new URL(process.env.PRODUCTION_AI_PINGCODE_REFERENCE_URL || configuredTarget || '');
  if (targetUrl.username || targetUrl.password) throw new Error('PINGCODE_TARGET_INVALID');
  const match = targetUrl.pathname.match(/\/wiki\/spaces\/([A-Za-z0-9_-]+)\/pages\/([A-Za-z0-9_-]+)/);
  if (!match) throw new Error('PINGCODE_TARGET_INVALID');
  const [, spaceKey, pageId] = match;
  const response = await fetch(`${apiBase}/api/pingcode/spaces/${encodeURIComponent(spaceKey)}/pages/${encodeURIComponent(pageId)}/reference`, {
    signal: AbortSignal.timeout(30000),
    headers: { Accept: 'application/json' },
  });
  const document = await response.json().catch(() => ({}));
  const content = typeof document.content === 'string' ? document.content : '';
  report.pingcode = {
    status: response.ok && content.trim() ? 'passed' : 'failed',
    httpStatus: response.status,
    errorCode: typeof document.error?.code === 'string' ? document.error.code : null,
    spaceKey,
    pageId,
    title: typeof document.title === 'string' ? document.title : null,
    contentChars: content.length,
    contentDigest: content ? digest(content) : null,
    contentOutput: false,
  };
  if (!response.ok || !content.trim()) throw new Error('PINGCODE_REFERENCE_FAILED');
}

async function main() {
  const report = { testedAt: new Date().toISOString(), credentialValuesOutput: false, contentOutput: false };
  const failures = [];
  try { await probeMCP(report); } catch (error) { report.knowledgeMCP = { status: 'failed', errorCode: error.message || 'MCP_PROBE_FAILED' }; failures.push('knowledgeMCP'); }
  try { await probePingCode(report); } catch (error) {
    if (!report.pingcode) report.pingcode = { status: 'failed', errorCode: error.message || 'PINGCODE_PROBE_FAILED' };
    failures.push('pingcode');
  }
  report.overall = failures.length ? 'failed' : 'passed';
  report.failedConnectors = failures;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ ...report, evidencePath: path.relative(root, outputPath) }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
}

main();
