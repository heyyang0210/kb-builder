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

  test('Excel 输入错误返回稳定的人员导入错误码', () => {
    const cases = [
      [workbook([['', 'empty', 'ACTIVE']]), 'PERSONNEL_NAME_REQUIRED'],
      [workbook([['张三', 'zhang', 'UNKNOWN']]), 'PERSONNEL_STATE_INVALID'],
      [workbook([]), 'PERSONNEL_IMPORT_EMPTY'],
      [workbook(Array.from({ length: 1001 }, (_, index) => [`人员${index}`, '', 'ACTIVE'])), 'PERSONNEL_IMPORT_TOO_LARGE'],
    ];
    for (const [buffer, code] of cases) {
      expect(() => parseWorkbook(buffer, XLSX)).toThrow(expect.objectContaining({ code }));
    }
    const multi = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(multi, XLSX.utils.aoa_to_sheet([['姓名', 'CAS登录名', '状态'], ['张三', '', 'ACTIVE']]), '一');
    XLSX.utils.book_append_sheet(multi, XLSX.utils.aoa_to_sheet([['姓名', 'CAS登录名', '状态'], ['李四', '', 'ACTIVE']]), '二');
    expect(() => parseWorkbook(XLSX.write(multi, { type: 'buffer', bookType: 'xlsx' }), XLSX))
      .toThrow(expect.objectContaining({ code: 'PERSONNEL_SHEET_INVALID' }));
    const emptySheet = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(emptySheet, XLSX.utils.aoa_to_sheet([]), '空表');
    expect(() => parseWorkbook(XLSX.write(emptySheet, { type: 'buffer', bookType: 'xlsx' }), XLSX))
      .toThrow(expect.objectContaining({ code: 'PERSONNEL_SHEET_INVALID' }));
    const headerlessReader = { read: () => ({ SheetNames: ['人员名单'], Sheets: { 人员名单: { '!ref': 'A1' } } }),
      utils: { sheet_to_json: () => [] } };
    expect(() => parseWorkbook(Buffer.from('headerless'), headerlessReader))
      .toThrow(expect.objectContaining({ code: 'PERSONNEL_HEADERS_INVALID' }));
    expect(() => parseWorkbook(Buffer.from('bad'), { read() { throw new Error('broken'); } }))
      .toThrow(expect.objectContaining({ code: 'PERSONNEL_FILE_INVALID' }));
  });

  test('空行、默认状态及大小写规范化保留有效人员', () => {
    expect(parseWorkbook(workbook([['张三', '', ''], ['', '', ''], ['李四', 'lisi', 'inactive']]), XLSX)).toEqual([
      { displayName: '张三', casLoginName: null, state: 'ACTIVE' },
      { displayName: '李四', casLoginName: 'lisi', state: 'INACTIVE' },
    ]);
  });

  test('预检覆盖绑定状态变更、同名歧义和未绑定人员状态', () => {
    const existing = [
      { principalId: 'bound', displayName: '已绑定', casLoginName: 'bound', state: 'INACTIVE' },
      { principalId: 'pending', displayName: '待绑定', casLoginName: null, state: 'ACTIVE' },
      { principalId: 'name-a', displayName: '重名', casLoginName: null, state: 'ACTIVE' },
      { principalId: 'name-b', displayName: '重名', casLoginName: null, state: 'ACTIVE' },
      { principalId: 'unbound', displayName: '无账号', casLoginName: null, state: 'INACTIVE' },
      { principalId: 'same', displayName: '不变', casLoginName: null, state: 'ACTIVE' },
    ];
    const items = [
      { displayName: '已绑定', casLoginName: 'bound', state: 'ACTIVE' },
      { displayName: '待绑定', casLoginName: 'new-login', state: 'ACTIVE' },
      { displayName: '重名', casLoginName: 'ambiguous', state: 'ACTIVE' },
      { displayName: '无账号', casLoginName: null, state: 'ACTIVE' },
      { displayName: '不变', casLoginName: null, state: 'ACTIVE' },
      { displayName: '新增', casLoginName: null, state: 'ACTIVE' },
    ];
    const preview = previewPersonnelImport(items, existing);
    expect(preview.rows.map(row => row.action)).toEqual(['UPDATE', 'UPDATE', 'CONFLICT', 'UPDATE', 'UNCHANGED', 'ADD']);
    expect(preview.summary).toEqual({ total: 6, add: 1, update: 3, unchanged: 1, conflict: 1 });
    expect(preview.rows[1]).toMatchObject({ principalId: 'pending', message: '绑定 CAS 登录名' });
    expect(preview.rows[2].message).toBe('存在多个同名待绑定人员');
  });

  test('预检默认缺省状态并对空集合返回零摘要', () => {
    expect(previewPersonnelImport([], []).summary).toEqual({ total: 0, add: 0, update: 0, unchanged: 0, conflict: 0 });
    expect(previewPersonnelImport([{ displayName: '新人员', casLoginName: null, state: 'ACTIVE' }]).summary)
      .toEqual({ total: 1, add: 1, update: 0, unchanged: 0, conflict: 0 });
    expect(previewPersonnelImport([{ displayName: '旧记录', casLoginName: 'login', state: 'ACTIVE' }], [
      { principalId: 'p1', displayName: ' 旧记录 ', casLoginName: 'login', state: '' },
    ]).rows[0]).toMatchObject({ action: 'UNCHANGED', message: '无变化' });
    expect(previewPersonnelImport([{ displayName: '待绑定', casLoginName: null, state: 'ACTIVE' }], [
      { principalId: 'p2', displayName: '待绑定', state: '' },
    ]).rows[0]).toMatchObject({ action: 'UNCHANGED', principalId: 'p2' });
  });
});
