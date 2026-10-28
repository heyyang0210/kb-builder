#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const configPath = path.resolve(process.env.PINGCODE_CONFIG || path.join(root, 'config/pingcode/credentials.json'));
const port = Number(process.env.KNOWLEDGE_CENTER_PINGCODE_API_PORT || process.env.PINGCODE_API_PORT || 18010);
const apiBase = String(process.env.KNOWLEDGE_CENTER_PINGCODE_API_BASE || `http://127.0.0.1:${port}`).replace(/\/$/, '');
const now = new Date();
const date = now.toISOString().slice(0, 10).replaceAll('-', '');
const outputPath = path.join(root, 'runtime/test-results/production-ai-integration', date, 'pingcode-reference-probe.json');

async function main() {
  const report = { testedAt: now.toISOString(), integration: 'pingcode-page-reference', apiPort: port, credentialsOutput: false };
  let exitCode = 0;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const target = Array.isArray(config.targets) ? config.targets[0] : null;
    if (!target?.url) throw Object.assign(new Error(), { code: 'PINGCODE_TARGET_NOT_CONFIGURED' });

    const targetUrl = new URL(target.url);
    const match = targetUrl.pathname.match(/\/wiki\/spaces\/([A-Za-z0-9_-]+)\/pages\/([A-Za-z0-9_-]+)/);
    if (!match || targetUrl.username || targetUrl.password) throw Object.assign(new Error(), { code: 'PINGCODE_TARGET_INVALID' });
    const [, spaceKey, pageId] = match;
    report.configuredTargetPresent = true;
    report.spaceKey = spaceKey;

    const base = `${apiBase}/api/pingcode/spaces/${encodeURIComponent(spaceKey)}`;
    const [treeResponse, pageResponse] = await Promise.all([
      fetch(`${base}/tree`, { signal: AbortSignal.timeout(30000) }),
      fetch(`${base}/pages/${encodeURIComponent(pageId)}/reference`, { signal: AbortSignal.timeout(30000) }),
    ]);
    const tree = await treeResponse.json().catch(() => ({}));
    const page = await pageResponse.json().catch(() => ({}));
    const items = Array.isArray(tree.items) ? tree.items : [];
    const content = typeof page.content === 'string' ? page.content : '';
    report.tree = {
      status: treeResponse.status,
      itemCount: items.length,
      total: Number.isSafeInteger(tree.total) ? tree.total : null,
      reportedTotal: Number.isSafeInteger(tree.reportedTotal) ? tree.reportedTotal : null,
      configuredPageListed: items.some(item => String(item.id || item.pageId || item._id) === pageId),
    };
    report.reference = {
      status: pageResponse.status,
      errorCode: typeof page.error?.code === 'string' ? page.error.code : null,
      contentChars: content.length,
      contentDigest: content ? crypto.createHash('sha256').update(content).digest('hex') : null,
    };
    if (!treeResponse.ok || !pageResponse.ok || !content.trim()) exitCode = 1;
  } catch (error) {
    report.errorCode = ['ENOENT', 'PINGCODE_TARGET_NOT_CONFIGURED', 'PINGCODE_TARGET_INVALID'].includes(error.code)
      ? error.code
      : 'PINGCODE_PROBE_FAILED';
    exitCode = 1;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ ...report, evidencePath: path.relative(root, outputPath) }, null, 2)}\n`);
  process.exitCode = exitCode;
}

main();
