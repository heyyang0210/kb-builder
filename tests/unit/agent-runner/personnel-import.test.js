const XLSX = require('../../../runtime/agent-runner/node_modules/xlsx');
const { parseWorkbook, templateWorkbook } = require('../../../packages/agent-runner-core/lib/personnel-import');

function workbook(rows, headers = ['姓名', 'CAS登录名', '状态']) {
  const value = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(value, XLSX.utils.aoa_to_sheet([headers, ...rows]), '人员名单');
  return XLSX.write(value, { type: 'buffer', bookType: 'xlsx' });
}

describe('人员 Excel 导入契约', () => {
  test('模板可解析且允许 CAS 登录名留空', () => {
    expect(parseWorkbook(templateWorkbook())).toEqual([
      { displayName: '张三', casLoginName: 'zhangsan', state: 'ACTIVE' },
      { displayName: '李四', casLoginName: null, state: 'ACTIVE' },
    ]);
  });

  test('拒绝重复 CAS 登录名和错误表头', () => {
    expect(() => parseWorkbook(workbook([['张三', 'same', 'ACTIVE'], ['李四', 'same', 'ACTIVE']]))).toThrow('CAS 登录名重复');
    expect(() => parseWorkbook(workbook([['张三', '', 'ACTIVE']], ['name', 'login', 'state']))).toThrow('Excel 表头必须为');
  });
});
