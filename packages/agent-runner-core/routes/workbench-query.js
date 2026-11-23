const TYPES = new Set(['assign', 'document', 'outline', 'template', 'review', 'merge']);
const QUEUES = new Set(['actionable', 'waiting']);
const ENUM_FIELDS = new Set(['taskType', 'status', 'source']);
const TEXT_FIELDS = {
  number: item => item.number,
  subtaskNumber: item => item.subtaskNumber,
  description: item => item.title,
  taskType: item => item.taskType || { assign: '任务管理', document: '文档生产', review: '文档审核', merge: '文档发布', outline: '大纲管理', template: '模板管理' }[item.kind],
  status: item => item.status,
  source: item => item.source,
  handbook: item => item.lineage?.handbookName || item.handbookName || item.handbookId,
  document: item => item.lineage?.documentName || item.documentName || item.documentId,
  version: item => item.version,
};
const DATE_FIELDS = {
  plannedStartTime: item => item.plannedStartTime,
  plannedEndTime: item => item.plannedEndTime,
};
function invalid(message) { throw Object.assign(new Error(message), { code: 'WORKBENCH_QUERY_INVALID', status: 422 }); }
function parseFilter(node, depth = 0, budget = { count: 0 }) {
  if (node == null) return () => true;
  if (!node || typeof node !== 'object' || Array.isArray(node) || ++budget.count > 20 || depth > 8) invalid('查询条件过多或嵌套过深');
  if (node.op) {
    if (!['and', 'or'].includes(node.op) || !Array.isArray(node.children) || !node.children.length) invalid('请选择有效的且/或条件组');
    const children = node.children.map(child => parseFilter(child, depth + 1, budget));
    return node.op === 'and' ? item => children.every(test => test(item)) : item => children.some(test => test(item));
  }
  if (typeof node.field !== 'string' || typeof node.operator !== 'string') invalid('查询字段或比较方式无效');
  const textField = TEXT_FIELDS[node.field];
  const dateField = DATE_FIELDS[node.field];
  if (textField) {
    if (!(ENUM_FIELDS.has(node.field) ? node.operator === 'eq' : ['contains', 'eq'].includes(node.operator))
      || typeof node.value !== 'string' || node.value.length > 100) invalid('文本查询条件无效');
    const value = node.value.trim().toLocaleLowerCase();
    if (!value) invalid('查询值不能为空');
    return item => {
      const actual = String(textField(item) ?? '').toLocaleLowerCase();
      return node.operator === 'eq' ? actual === value : actual.includes(value);
    };
  }
  if (dateField) {
    if (node.operator !== 'between' || !Array.isArray(node.value) || node.value.length !== 2
      || node.value.some(value => typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
        || Number.isNaN(Date.parse(value)) || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value)) invalid('日期区间无效');
    const [start, end] = node.value;
    if (start > end) invalid('日期区间的结束时间不能早于开始时间');
    return item => {
      const actual = String(dateField(item) || '').slice(0, 10);
      return Boolean(actual && actual >= start && actual <= end);
    };
  }
  invalid('不支持的查询字段');
}
function queryWorkbench(items, input = {}, meta = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('查询参数无效');
  const queue = input.queue || 'actionable';
  const type = input.type || 'all';
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  const search = input.search ?? '';
  const scopeVersion = input.scopeVersion ?? '';
  if (!QUEUES.has(queue) || type !== 'all' && !TYPES.has(type)) invalid('队列或任务类型无效');
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) invalid('分页参数无效');
  if (typeof search !== 'string' || search.length > 200) invalid('搜索词无效');
  if (typeof scopeVersion !== 'string' || scopeVersion.length > 100) invalid('版本筛选无效');
  const test = parseFilter(input.filter);
  const needle = search.trim().toLocaleLowerCase();
  const byId = [...new Map(items.map(item => [item.id, item])).values()];
  const actionableKeys = new Set(byId.filter(item => item.queue !== 'waiting' && item.number && item.subtaskNumber != null)
    .map(item => `${item.number}:${item.subtaskNumber}:${item.kind}`));
  const unique = byId.filter(item => item.queue !== 'waiting' || item.subtaskNumber == null
    || !actionableKeys.has(`${item.number}:${item.subtaskNumber}:${item.kind}`));
  const versionOptions = [...new Set(unique.map(item => String(item.version || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const matched = unique.filter(item => (!scopeVersion || String(item.version || '') === scopeVersion)
    && test(item) && (!needle || `${item.number || ''} ${item.title || ''}`.toLocaleLowerCase().includes(needle)));
  const facets = { all: matched.length, actionable: 0, waiting: 0, types: {} };
  for (const item of matched) {
    facets[item.queue === 'waiting' ? 'waiting' : 'actionable']++;
    facets.types[item.kind] = (facets.types[item.kind] || 0) + 1;
  }
  const filtered = matched.filter(item => (item.queue === 'waiting' ? 'waiting' : 'actionable') === queue && (type === 'all' || item.kind === type));
  filtered.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || String(a.id).localeCompare(String(b.id)));
  return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize, facets, versionOptions,
    completeness: meta.unavailable?.length ? 'partial' : 'complete', unavailable: meta.unavailable || [], asOf: meta.asOf || new Date().toISOString() };
}
module.exports = { queryWorkbench, parseFilter };
