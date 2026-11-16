const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readWorkCalendar } = require('../../../packages/agent-runner-core/lib/work-calendar');

describe('年度工作日历读取', () => {
  let root;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-center-work-calendar-')); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('读取年度数据及官方来源信息', () => {
    fs.writeFileSync(path.join(root, '2026.json'), JSON.stringify({ year: 2026,
      source: { title: '国务院通知', url: 'https://example.gov.cn/calendar', publishedAt: '2025-11-04' },
      days: { '2026-10-01': 'holiday', '2026-10-10': 'workday' } }));
    expect(readWorkCalendar('2026', root)).toMatchObject({ year: 2026, configured: true,
      days: { '2026-10-01': 'holiday', '2026-10-10': 'workday' }, source: { publishedAt: '2025-11-04' } });
  });

  test('未维护年份明确返回未配置', () => {
    expect(readWorkCalendar('2025', root)).toEqual({ year: 2025, configured: false, days: {}, source: null });
  });

  test('拒绝无效年份及缺少来源的错误配置', () => {
    expect(() => readWorkCalendar('20x6', root)).toThrow(expect.objectContaining({ code: 'WORK_CALENDAR_YEAR_INVALID' }));
    fs.writeFileSync(path.join(root, '2026.json'), JSON.stringify({ year: 2026, days: {} }));
    expect(() => readWorkCalendar('2026', root)).toThrow(expect.objectContaining({ code: 'WORK_CALENDAR_CONFIG_INVALID' }));
  });
});
