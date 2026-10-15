const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { rules, parseNaturalPathRows } = require('../../packages/agent-runner-core/lib/outline-path-template');
const root = path.resolve(__dirname, '../..');

function generate() {
  const source = XLSX.readFile(path.join(root, rules.sampleSource));
  const rows = XLSX.utils.sheet_to_json(source.Sheets[source.SheetNames[0]], { header: 1, defval: '' });
  if (JSON.stringify(rows[0]) !== JSON.stringify(rules.headers)) throw new Error('SQL示例源表头与新模板不一致');
  const sourceRows = rows.slice(1);
  const introduction = sourceRows.find(row => String(row[0]).startsWith(rules.introPrefix) && String(row[0]).endsWith(rules.extension));
  if (!introduction) throw new Error('SQL示例缺少手册介绍');
  const title = String(introduction[0]).slice(rules.introPrefix.length, -rules.extension.length);
  const parsed = parseNaturalPathRows(sourceRows, title);
  const output = path.join(root, rules.sampleDownloadPath);
  // 通过校验才发布下载副本，文件字节与用户提供的源文件完全一致。
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.copyFileSync(path.join(root, rules.sampleSource), output);
  return { output, documents: parsed.nodes.filter(n => n.kind === 'document').length };
}

if (require.main === module) console.log(JSON.stringify(generate()));
module.exports = { generate };
