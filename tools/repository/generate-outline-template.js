const path = require('path');
const repositoryRoot = path.resolve(__dirname, '..', '..');
const XLSX = require(require.resolve('xlsx', { paths: [path.join(repositoryRoot, 'apps', 'knowledge-center-api')] }));

const { rules } = require('../../packages/agent-runner-core/lib/outline-path-template');
const rows = [rules.headers];

const workbook = XLSX.utils.book_new();
const sheet = XLSX.utils.aoa_to_sheet(rows);
sheet['!cols'] = [
  { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 32 }, { wch: 68 }, { wch: 22 },
];
XLSX.utils.book_append_sheet(workbook, sheet, '大纲模板');
const output = path.join(repositoryRoot, rules.templatePath);
require('fs').mkdirSync(path.dirname(output), { recursive: true });
XLSX.writeFile(workbook, output);
