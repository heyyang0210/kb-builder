const path = require('path');
const repositoryRoot = path.resolve(__dirname, '..', '..');
const XLSX = require(require.resolve('xlsx', { paths: [path.join(repositoryRoot, 'apps', 'knowledge-center-api')] }));

const rows = [
  ['一级目录', '二级目录', '三级目录', '页面', '内容说明', '技术领域分工'],
];

const workbook = XLSX.utils.book_new();
const sheet = XLSX.utils.aoa_to_sheet(rows);
sheet['!cols'] = [
  { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 32 }, { wch: 68 }, { wch: 22 },
];
XLSX.utils.book_append_sheet(workbook, sheet, '大纲模板');
XLSX.writeFile(workbook, path.join(repositoryRoot, '大纲模板.xlsx'));
