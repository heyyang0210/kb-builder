#!/usr/bin/env node
// Explicit, journaled same-filesystem moves. Never overwrite an existing target.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const journalDir = path.join(root, 'runtime/repository-migration');
const assets = ['outlines', 'templates', 'prompts', 'profiles', 'skills', 'references', 'enterprise-profiles', 'examples', 'domain', 'refs'];
const groups = {
  knowledge: assets.map(name => [name, `knowledge/${name}`]),
  runtime: [['var/agent-runner', 'runtime/agent-runner'], ['var/pingcode', 'runtime/pingcode'], ['logs', 'runtime/logs'], ['output', 'runtime/output'], ['.browser-data', 'runtime/browser-data'], ['dump.rdb', 'runtime/dumps/unclassified/dump.rdb']],
  external: [['src/FastGPT', 'external/FastGPT'], ['yas-ai-helper', 'external/yas-ai-helper'], ['src/README.md', 'external/README.md']],
  residual: [['code', 'runtime/migration-residuals/code'], ['scripts', 'runtime/migration-residuals/scripts'], ['tests/agent-runner', 'runtime/migration-residuals/tests-agent-runner'], ['tools/repository/logs', 'runtime/migration-residuals/tools-repository-logs']],
  documents: ['HTML_GENERATION_SUMMARY.md', 'REFACTORING_SUMMARY.md', 'YashanDB 知识加工平台构建方案.html', 'YashanDB 知识库建设方案.html', 'gitlab-multi-repo-designs.html', 'kb-builder方案和使用介绍.html', 'oracle-kb-generation-plan.md', 'prompt-generator-design.md', 'test_svg.html', '子agent.md', '批量生成方案.md', 'prompt-generator.html', 'docker-compose.yml'].map(name => [name, `docs/archive/root-layout/${name}`]).concat([['diagrams', 'docs/diagrams']]),
};

function inventory(target) {
  const entries = [];
  function walk(file, relative) {
    const s = fs.lstatSync(file);
    entries.push([relative, s.dev, s.ino, s.isDirectory() ? 'dir' : s.isSymbolicLink() ? fs.readlinkSync(file) : s.size]);
    if (s.isDirectory()) for (const name of fs.readdirSync(file).sort()) walk(path.join(file, name), path.join(relative, name));
  }
  walk(target, '.');
  return entries;
}

const command = process.argv[2];
fs.mkdirSync(journalDir, { recursive: true });
if (command === 'baseline') {
  const target = path.join(journalDir, 'baseline.json');
  if (fs.existsSync(target)) throw new Error('Baseline already exists');
  const gitStatus = cp.execFileSync('git', ['status', '--porcelain=v1', '-uall'], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const externalStatus = cp.execFileSync('git', ['status', '--porcelain=v1', '-uall'], { cwd: path.join(root, 'yas-ai-helper'), encoding: 'utf8' });
  fs.writeFileSync(target, JSON.stringify({ at: new Date().toISOString(), groups, gitStatus, externalStatus }, null, 2), { mode: 0o600 });
  console.log('Baseline recorded (paths/status only, no configuration values).');
} else if (groups[command]) {
  for (const [from, to] of groups[command]) {
    const source = path.join(root, from), target = path.join(root, to);
    if (!fs.existsSync(source)) { console.log(`Absent: ${from}`); continue; }
    if (fs.existsSync(target)) throw new Error(`Destination exists: ${to}`);
    const before = inventory(source);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(source, target);
    const after = inventory(target);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`Inventory mismatch: ${to}`);
    fs.appendFileSync(path.join(journalDir, 'moves.jsonl'), JSON.stringify({ at: new Date().toISOString(), from, to, entries: before.length, verified: true }) + '\n', { mode: 0o600 });
    console.log(`Verified ${from} -> ${to}: ${before.length} entries`);
  }
  for (const name of ['var', 'src']) {
    const dir = path.join(root, name);
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  }
} else throw new Error('Use baseline, knowledge, runtime, external, residual, or documents');
