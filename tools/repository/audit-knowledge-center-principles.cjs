#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const scope = [
  'apps/knowledge-center-web/frontend/knowledge-center',
  'apps/knowledge-center-web/frontend-server.js',
  'apps/knowledge-center-web/README.md',
  'apps/knowledge-center-api',
  'apps/knowledge-center-auth',
  'packages/agent-runner-core',
  'config/knowledge-center',
  'tests/unit/agent-runner',
  'tests/e2e/agent-runner',
  '.codex/知识中心建设平台/12-开发原则 & 术语',
];
const terminology = '.codex/知识中心建设平台/12-开发原则 & 术语/知识中心管理平台术语规范.md';
const output = path.join(root, 'runtime/audits/knowledge-center-principles/file-inventory.json');
const graphPath = path.join(root, '.ua/intermediate/assembled-graph.json');
const textFile = /\.(?:cjs|css|html|java|js|json|md|mjs|py|sh|sql|txt|yaml|yml)$/i;
const interactiveText = /<button\b|<a\b|\b(?:actionLabel|primaryAction|nextAction|label|title|aria-label)\s*[:=]|\btextContent\s*=/;

function filesIn(relativeDir) {
  const absolute = path.join(root, relativeDir);
  if (!fs.existsSync(absolute)) throw new Error(`核查路径不存在：${relativeDir}`);
  if (fs.statSync(absolute).isFile()) return [relativeDir.replaceAll(path.sep, '/')];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    const relative = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : filesIn(relative);
    return entry.isFile() ? [relative.replaceAll(path.sep, '/')] : [];
  });
}

function termAliases(markdown, lexer) {
  const table = lexer(markdown).find(token => token.type === 'table' && token.header[0]?.text === '禁止或不推荐');
  if (!table) throw new Error('术语规范缺少“禁止或不推荐”表格');
  const aliases = new Map();
  for (const row of table.rows) {
    const preferred = row[1].text.trim();
    for (const part of row[0].text.split('、')) {
      const alias = part.replace(/（[^）]*）/g, '').trim();
      if (alias.length >= 2 && alias !== preferred) aliases.set(alias, preferred);
    }
  }
  return [...aliases].map(([alias, preferred]) => ({ alias, preferred }));
}

function graphFiles() {
  if (!fs.existsSync(graphPath)) return new Set();
  const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  return new Set((graph.nodes || []).filter(node => node.filePath).map(node => node.filePath));
}

async function main() {
  const { lexer } = await import('marked');
  const aliases = termAliases(fs.readFileSync(path.join(root, terminology), 'utf8'), lexer);
  const inGraph = graphFiles();
  const files = [...new Set(scope.flatMap(filesIn))].sort();
  const records = files.map(relative => {
    const content = fs.readFileSync(path.join(root, relative));
    const source = textFile.test(relative) ? content.toString('utf8') : '';
    const lines = source.split(/\r?\n/);
    const candidates = [];
    lines.forEach((line, index) => {
      const found = aliases.filter(({ alias }) => line.includes(alias));
      if (found.length) candidates.push({ line: index + 1, aliases: found.map(({ alias, preferred }) => ({ alias, preferred })), excerpt: line.trim().slice(0, 180) });
    });
    return {
      path: relative,
      sha256: crypto.createHash('sha256').update(content).digest('hex'),
      bytes: content.length,
      category: relative.includes('/vendor/') ? 'vendor' : relative.startsWith('tests/') ? 'test' : relative.startsWith('.codex/') ? 'principle' : relative.startsWith('config/') ? 'config' : /\.(?:css|html)$/.test(relative) ? 'interface' : 'source',
      graphHint: inGraph.has(relative),
      hasChinese: /[\u3400-\u9fff]/.test(source),
      hasInteractiveText: interactiveText.test(source),
      candidates,
      reviewStatus: 'mechanically_read_pending_judgment',
    };
  });
  const report = {
    scope,
    terminology,
    graphNote: '历史未发布图谱仅作关系线索；graphHint=false 不代表文件未核查。',
    aliasCount: aliases.length,
    files: records,
    summary: {
      total: records.length,
      byCategory: Object.fromEntries([...new Set(records.map(item => item.category))].map(category => [category, records.filter(item => item.category === category).length])),
      graphHints: records.filter(item => item.graphHint).length,
      interactive: records.filter(item => item.hasInteractiveText).length,
      candidateFiles: records.filter(item => item.candidates.length).length,
      candidateLines: records.reduce((sum, item) => sum + item.candidates.length, 0),
    },
  };
  if (process.argv.includes('--verify')) {
    const saved = JSON.parse(fs.readFileSync(output, 'utf8'));
    const original = new Map(saved.files.map(item => [item.path, item.sha256]));
    const changed = records.filter(item => original.get(item.path) !== item.sha256).map(item => item.path);
    const removed = [...original.keys()].filter(file => !records.some(item => item.path === file));
    if (changed.length || removed.length) throw new Error(`核查清单已过期：变化 ${changed.length} 个，移除 ${removed.length} 个\n${[...changed, ...removed].join('\n')}`);
    console.log(`核查清单有效：${records.length} 个文件，SHA-256 均与当前工作区一致。`);
    return;
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output: path.relative(root, output), ...report.summary }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
