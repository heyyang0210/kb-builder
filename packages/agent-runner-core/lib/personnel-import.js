const crypto = require('crypto');
const path = require('path');

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const HEADERS = ['姓名', 'CAS登录名', '状态'];

function personnelError(code, message, status = 422) {
  return Object.assign(new Error(message), { code, status });
}

function templateWorkbook(XLSX = require('xlsx')) {
  const rows = [HEADERS, ['张三', 'zhangsan', 'ACTIVE'], ['李四', '', 'ACTIVE']];
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 18 }, { wch: 24 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(workbook, sheet, '人员名单');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function parseWorkbook(buffer, XLSX = require('xlsx')) {
  let workbook;
  try { workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false }); }
  catch (_) { throw personnelError('PERSONNEL_FILE_INVALID', '无法解析 Excel 文件'); }
  const nonEmpty = workbook.SheetNames.filter(name => String(workbook.Sheets[name]?.['!ref'] || '').trim());
  if (nonEmpty.length !== 1) throw personnelError('PERSONNEL_SHEET_INVALID', `Excel 必须包含一个非空 Sheet，当前为 ${nonEmpty.length} 个`);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[nonEmpty[0]], { header: 1, defval: '', raw: false });
  const headers = (rows.shift() || []).map(value => String(value || '').trim());
  if (headers.length !== HEADERS.length || !HEADERS.every((header, index) => headers[index] === header)) {
    throw personnelError('PERSONNEL_HEADERS_INVALID', `Excel 表头必须为：${HEADERS.join('、')}`);
  }
  const items = [];
  const loginNames = new Set();
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const values = HEADERS.map((_, column) => String(row[column] || '').trim());
    if (!values.some(Boolean)) return;
    const [displayName, casLoginName, rawState] = values;
    if (!displayName) throw personnelError('PERSONNEL_NAME_REQUIRED', `第 ${rowNumber} 行缺少姓名`);
    const state = (rawState || 'ACTIVE').toUpperCase();
    if (!['ACTIVE', 'INACTIVE'].includes(state)) throw personnelError('PERSONNEL_STATE_INVALID', `第 ${rowNumber} 行状态只允许 ACTIVE 或 INACTIVE`);
    if (casLoginName) {
      if (loginNames.has(casLoginName)) throw personnelError('PERSONNEL_LOGIN_DUPLICATE', `第 ${rowNumber} 行 CAS 登录名重复：${casLoginName}`);
      loginNames.add(casLoginName);
    }
    items.push({ displayName, casLoginName: casLoginName || null, state });
  });
  if (!items.length) throw personnelError('PERSONNEL_IMPORT_EMPTY', 'Excel 中没有有效人员数据');
  if (items.length > 1000) throw personnelError('PERSONNEL_IMPORT_TOO_LARGE', '单次最多导入 1000 人', 413);
  return items;
}

function normalizeName(value) {
  return String(value || '').trim();
}

function previewPersonnelImport(items, existingItems = []) {
  const byLogin = new Map(existingItems.filter(item => item.casLoginName).map(item => [String(item.casLoginName), item]));
  const pendingByName = new Map();
  for (const item of existingItems.filter(item => !item.casLoginName)) {
    const name = normalizeName(item.displayName);
    if (!pendingByName.has(name)) pendingByName.set(name, []);
    pendingByName.get(name).push(item);
  }
  const rows = items.map((item, index) => {
    const row = { rowNumber: index + 2, ...item, action: 'ADD', message: '新增人员' };
    if (item.casLoginName) {
      const bound = byLogin.get(item.casLoginName);
      if (bound) {
        if (normalizeName(bound.displayName) !== normalizeName(item.displayName)) {
          return { ...row, action: 'CONFLICT', message: `CAS 登录名已绑定给${bound.displayName}` };
        }
        const stateChanged = String(bound.state || 'ACTIVE') !== item.state;
        return { ...row, principalId: bound.principalId, action: stateChanged ? 'UPDATE' : 'UNCHANGED', message: stateChanged ? '更新使用状态' : '无变化' };
      }
      const pending = pendingByName.get(normalizeName(item.displayName)) || [];
      if (pending.length > 1) return { ...row, action: 'CONFLICT', message: '存在多个同名待绑定人员' };
      if (pending.length === 1) return { ...row, principalId: pending[0].principalId, action: 'UPDATE', message: '绑定 CAS 登录名' };
      return row;
    }
    const pending = pendingByName.get(normalizeName(item.displayName)) || [];
    if (pending.length === 1) {
      const stateChanged = String(pending[0].state || 'ACTIVE') !== item.state;
      return { ...row, principalId: pending[0].principalId, action: stateChanged ? 'UPDATE' : 'UNCHANGED', message: stateChanged ? '更新使用状态' : '无变化' };
    }
    return row;
  });
  const summary = { total: rows.length, add: 0, update: 0, unchanged: 0, conflict: 0 };
  for (const row of rows) summary[row.action.toLowerCase()] += 1;
  return { summary, rows };
}

async function readPersonnelUpload(req) {
  const Busboy = require('busboy');
  return new Promise((resolve, reject) => {
    let parser;
    try { parser = Busboy({ headers: req.headers, limits: { files: 1, fields: 0, fileSize: MAX_FILE_BYTES, parts: 1 } }); }
    catch (_) { reject(personnelError('PERSONNEL_INVALID_UPLOAD', '请使用 multipart/form-data 上传 Excel', 400)); return; }
    let file = null; let failure = null;
    parser.on('file', (field, stream, info) => {
      const filename = path.basename(String(info.filename || '').replace(/\\/g, '/'));
      if (field !== 'file' || path.extname(filename).toLowerCase() !== '.xlsx') failure = personnelError('PERSONNEL_FORMAT_UNSUPPORTED', '仅支持 .xlsx 文件', 415);
      const chunks = [];
      stream.on('limit', () => { failure = personnelError('PERSONNEL_FILE_TOO_LARGE', 'Excel 文件不能超过 2MB', 413); });
      stream.on('data', chunk => { if (!failure) chunks.push(chunk); });
      stream.on('end', () => { if (!failure) file = { filename, buffer: Buffer.concat(chunks) }; });
    });
    parser.on('error', () => reject(failure || personnelError('PERSONNEL_INVALID_UPLOAD', '上传请求不完整', 400)));
    parser.on('close', () => {
      if (failure) return reject(failure);
      if (!file) return reject(personnelError('PERSONNEL_FILE_REQUIRED', '请上传人员 Excel 文件', 400));
      try {
        resolve({ filename: file.filename, sourceSha256: crypto.createHash('sha256').update(file.buffer).digest('hex'), items: parseWorkbook(file.buffer) });
      } catch (error) { reject(error); }
    });
    req.pipe(parser);
  });
}

module.exports = { HEADERS, parseWorkbook, previewPersonnelImport, readPersonnelUpload, templateWorkbook };
