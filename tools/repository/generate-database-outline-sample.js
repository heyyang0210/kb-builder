const fs = require('fs');
const path = require('path');
const repositoryRoot = path.resolve(__dirname, '..', '..');
const XLSX = require(require.resolve('xlsx', { paths: [path.join(repositoryRoot, 'apps', 'knowledge-center-api')] }));

const root = repositoryRoot;
const sourcePath = process.env.OUTLINE_SAMPLE_SOURCE
  ? path.resolve(process.env.OUTLINE_SAMPLE_SOURCE)
  : path.join(root, 'YashanDB_23.5.4_数据库管理手册目录结构.xlsx');
const outputPath = process.env.OUTLINE_SAMPLE_OUTPUT
  ? path.resolve(process.env.OUTLINE_SAMPLE_OUTPUT)
  : path.join(root, 'knowledge/outlines/基本数据库管理手册大纲示例.xlsx');
const headers = ['一级目录', '二级目录', '三级目录', '页面', '内容说明', '技术领域分工'];

function asText(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function generate() {
  if (!fs.existsSync(sourcePath)) throw new Error(`找不到数据库管理手册原始文件：${sourcePath}`);
  const workbook = XLSX.readFile(sourcePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('原始工作簿没有可读取的 Sheet');
  const sourceRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
  const sourceHeader = sourceRows.shift()?.map(asText) || [];
  const positions = new Map(sourceHeader.map((header, index) => [header, index]));
  const required = ['一级目录', '二级目录', '三级目录', '页面', '内容说明', '技术领域分工'];
  const missing = required.filter(header => !positions.has(header));
  if (missing.length) throw new Error(`原始工作簿缺少字段：${missing.join('、')}`);

  const rows = [headers];
  for (const sourceRow of sourceRows) {
    const row = [
      asText(sourceRow[positions.get('一级目录')]),
      asText(sourceRow[positions.get('二级目录')]),
      asText(sourceRow[positions.get('三级目录')]),
      asText(sourceRow[positions.get('页面')]),
      asText(sourceRow[positions.get('内容说明')]),
      asText(sourceRow[positions.get('技术领域分工')]),
    ];
    if (row.some(Boolean)) rows.push(row);
  }

  const outputWorkbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [
    { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 32 }, { wch: 68 }, { wch: 22 },
  ];
  sheet['!autofilter'] = { ref: `A1:F${rows.length}` };
  XLSX.utils.book_append_sheet(outputWorkbook, sheet, '基本数据库管理手册');
  XLSX.writeFile(outputWorkbook, outputPath);
  console.log(`已生成：${outputPath}`);
  console.log(`页面行数：${rows.length - 1}`);
  console.log('技术领域分工：沿用原始文件值，未擅自补写线下评审结论。');
}

generate();
