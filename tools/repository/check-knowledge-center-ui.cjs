#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const platform = 'apps/knowledge-center-web/frontend/knowledge-center';
const baselinePath = path.join(root, 'config/knowledge-center/ui-legacy-baseline.json');
const patterns = {
  rawLucide: /data-lucide\s*=/g,
  legacyIcon: /\bicon\s*\(\s*['"`]/g,
  inlineSvg: /<svg\b/g,
  globalIconScan: /\bcreateIcons\s*\(\s*\)/g,
  rawCssColor: /#[\da-fA-F]{3,8}\b/g,
};

function filesIn(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'vendor') return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesIn(full) : [full];
  });
}

function inventory() {
  const results = {};
  for (const file of filesIn(path.join(root, platform)).sort()) {
    if (!/\.(?:html|js|css)$/.test(file) || file.endsWith('/common/ui-system.js')) continue;
    const source = fs.readFileSync(file, 'utf8');
    const counts = {};
    for (const [rule, pattern] of Object.entries(patterns)) {
      if (rule === 'rawCssColor' && (!file.endsWith('.css') || /\/common\/(?:tokens|appearance)\.css$/.test(file))) continue;
      if (rule !== 'rawCssColor' && file.endsWith('.css')) continue;
      const count = [...source.matchAll(pattern)].length;
      if (count) counts[rule] = count;
    }
    if (Object.keys(counts).length) results[path.relative(root, file).replaceAll(path.sep, '/')] = counts;
  }
  return results;
}

function compareWithBaseline(current, baseline) {
  const violations = [];
  for (const file of new Set([...Object.keys(current), ...Object.keys(baseline.files)])) {
    for (const rule of Object.keys(patterns)) {
      const count = current[file]?.[rule] || 0;
      const allowed = baseline.files[file]?.[rule] || 0;
      if (count > allowed) violations.push(`${file}: ${rule} ${count} > 存量 ${allowed}`);
      if (count < allowed) violations.push(`${file}: ${rule} 已降至 ${count}，请同步下调基线 ${allowed}`);
    }
  }
  return violations;
}

async function main() {
  const catalogPath = path.join(root, platform, 'common/ui-system.js');
  const catalogSource = fs.readFileSync(catalogPath, 'utf8');
  const catalog = await import(`data:text/javascript,${encodeURIComponent(catalogSource)}`);
  const usages = [...catalogSource.matchAll(/^\s*'([a-z][a-z0-9.]+)':\s*'([a-z][a-z0-9-]*)',?$/gm)].map(match => match[1]);
  if (usages.length !== new Set(usages).size || usages.length !== Object.keys(catalog.UI_ICONS).length) throw new Error('图标用途重复或格式不正确');
  const current = inventory();
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  if (baseline.version !== 1 || Object.keys(patterns).some(rule => !baseline.rules.includes(rule))) throw new Error('UI 存量基线版本或规则不匹配');
  const violations = compareWithBaseline(current, baseline);
  const semanticUsage = /\buiIcon(?:Button)?\s*\(\s*(?:\{\s*usage\s*:\s*)?['"]([^'"]+)['"]/g;
  for (const file of filesIn(path.join(root, platform))) {
    if (!file.endsWith('.js') || file.endsWith('/common/ui-system.js') || file.includes('/vendor/')) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(semanticUsage)) {
      if (!Object.hasOwn(catalog.UI_ICONS, match[1])) violations.push(`${path.relative(root, file)}: 未登记用途 ${match[1]}`);
    }
  }
  if (violations.length) {
    console.error(violations.join('\n'));
    process.exitCode = 1;
  } else console.log('知识中心 UI 契约检查通过；存量用法未增长。');
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { compareWithBaseline };
