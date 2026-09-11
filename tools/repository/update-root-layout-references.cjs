const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const extensions = new Set(['.js', '.cjs', '.mjs', '.py', '.sh', '.json', '.yaml', '.yml', '.md', '.html', '.toml']);
const assets = ['enterprise-profiles', 'references', 'templates', 'outlines', 'profiles', 'prompts', 'skills', 'domain', 'refs', 'examples'];
const changed = [];
function rewrite(file) {
  if (file.includes('/vendor/') || file.includes('/node_modules/') || file.includes('/fixtures/') || file.endsWith('migrate-root-layout.cjs') || file.endsWith('update-root-layout-references.cjs')) return;
  let old;
  try { old = fs.readFileSync(file, 'utf8'); } catch { return; }
  let next = old.replace(/\bvar\/(agent-runner|pingcode)/g, 'runtime/$1')
    .replace(/(['"])var\1(?=\s*[,/])/g, '$1runtime$1')
    .replace(/src\/FastGPT/g, 'external/FastGPT')
    .replace(/(?<!external\/)yas-ai-helper\//g, 'external/yas-ai-helper/');
  // Root-relative resource literals; do not rewrite module-local skills/prompts.
  for (const name of assets) {
    next = next.replace(new RegExp(`(["'\x60])${name}/`, 'g'), `$1knowledge/${name}/`);
    next = next.replace(new RegExp(`((?:REPO_ROOT|REPOSITORY_ROOT|repo_root|repository_root|skill_root|basePath)\\}?[^\\n]{0,12}[/'", ]+)${name}(['"/])`, 'g'), (match, prefix, suffix) => prefix + `knowledge/${name}` + suffix);
  }
  next = next.replace(/\$\{REPO_ROOT\}\/references\//g, '${REPO_ROOT}/knowledge/references/');
  if (next !== old) { fs.writeFileSync(file, next); changed.push(path.relative(root, file)); }
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.venv', '__pycache__', 'dist', 'vendor', '.git', 'logs'].includes(entry.name)) continue;
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.isFile() && extensions.has(path.extname(target))) rewrite(target);
  }
}
for (const name of ['apps', 'packages', 'tools', 'tests', 'config']) walk(path.join(root, name));
// Enterprise profile references are repository-relative, not relative to its manifest.
walk(path.join(root, 'knowledge/enterprise-profiles'));
console.log(`Updated ${changed.length} files; values are not printed.`);
fs.writeFileSync(path.join(root, 'runtime/repository-migration/reference-updates.json'), JSON.stringify(changed, null, 2));
