const fs = require('fs');
const path = require('path');

function readWorkCalendar(year, root) {
  const normalizedYear = Number(year);
  if (!Number.isInteger(normalizedYear) || normalizedYear < 2000 || normalizedYear > 2100) {
    throw Object.assign(new Error('年份格式无效'), { status: 400, code: 'WORK_CALENDAR_YEAR_INVALID' });
  }
  const file = path.join(root, `${normalizedYear}.json`);
  if (!fs.existsSync(file)) return { year: normalizedYear, configured: false, days: {}, source: null };
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (value.year !== normalizedYear || !value.source?.url || !value.source?.publishedAt || !value.days || typeof value.days !== 'object') {
    throw Object.assign(new Error('工作日历配置缺少有效来源或日期数据'), { status: 503, code: 'WORK_CALENDAR_CONFIG_INVALID' });
  }
  return { year: normalizedYear, configured: true, days: value.days, source: value.source };
}

module.exports = { readWorkCalendar };
