#!/usr/bin/env node
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const roots = ['apps', 'packages', 'tools', 'tests'];
const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'coverage', 'runtime', 'external', '.venv'].includes(entry.name)) continue;
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.isFile() && target.endsWith('.js')) files.push(target);
  }
}
roots.forEach((name) => walk(path.join(root, name)));
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
console.log(`node --check passed: ${files.length} files`);
