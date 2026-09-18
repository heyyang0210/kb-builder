const XLSX = require('../../../runtime/agent-runner/node_modules/xlsx');
const { parseWorkbook, previewPersonnelImport, templateWorkbook } = require('../../../packages/agent-runner-core/lib/personnel-import');

function workbook(rows, headers = ['姓名', 'CAS登录名', '状态']) {
  const value = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(value, XLSX.utils.aoa_to_sheet([headers, ...rows]), '人员名单');
  return XLSX.write(value, { type: 'buffer', bookType: 'xlsx' });
}

describe('人员 Excel 导入契约', () => {
  test('模板可解析且允许 CAS 登录名留空', () => {
    expect(parseWorkbook(templateWorkbook(XLSX), XLSX)).toEqual([
      { displayName: '张三', casLoginName: 'zhangsan', state: 'ACTIVE' },
      { displayName: '李四', casLoginName: null, state: 'ACTIVE' },
    ]);
  });

  test('拒绝重复 CAS 登录名和错误表头', () => {
    expect(() => parseWorkbook(workbook([['张三', 'same', 'ACTIVE'], ['李四', 'same', 'ACTIVE']]), XLSX)).toThrow('CAS 登录名重复');
    expect(() => parseWorkbook(workbook([['张三', '', 'ACTIVE']], ['name', 'login', 'state']), XLSX)).toThrow('Excel 表头必须为');
  });

  test('预检区分新增、绑定、无变化和 CAS 冲突', () => {
    const preview = previewPersonnelImport([
      { displayName: '新人', casLoginName: null, state: 'ACTIVE' },
      { displayName: '待绑定', casLoginName: 'pending', state: 'ACTIVE' },
      { displayName: '已绑定', casLoginName: 'bound', state: 'ACTIVE' },
      { displayName: '错误姓名', casLoginName: 'used', state: 'ACTIVE' },
    ], [
      { principalId: 1, displayName: '待绑定', casLoginName: null, state: 'ACTIVE' },
      { principalId: 2, displayName: '已绑定', casLoginName: 'bound', state: 'ACTIVE' },
      { principalId: 3, displayName: '正确姓名', casLoginName: 'used', state: 'ACTIVE' },
    ]);
    expect(preview.summary).toEqual({ total: 4, add: 1, update: 1, unchanged: 1, conflict: 1 });
    expect(preview.rows.map(row => row.action)).toEqual(['ADD', 'UPDATE', 'UNCHANGED', 'CONFLICT']);
  });
});
