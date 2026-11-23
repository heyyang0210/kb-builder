import { markDynamicSelects, cleanupSearchableSelects } from '../../common/searchable-combobox.js';
import { renderPageJump, readPageJump } from '../../common/page-jump.js';

const TYPES = {
  assign: { name: '任务分派', short: '任务分派' },
  document: { name: '文档编写', short: '文档编写' },
  review: { name: '文档审核', short: '文档审核' },
  merge: { name: 'MR交付', short: 'MR交付' },
};
export const MY_TASK_SOURCE_COUNT = 1;
let selectedResponsibleId = '';
let responsibleHandler = null;
let syncHandler = null;
let actionFeedback = '';
const syncErrors = new Map();
export function getSelectedResponsibleId() { return selectedResponsibleId; }
export function resetResponsibleSelection() { selectedResponsibleId = ''; }
export function setResponsibleHandler(callback) { responsibleHandler = callback; }
export function setSyncHandler(callback) { syncHandler = callback; }
const ROOT = '/knowledge-center/';
function safe(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
export async function loadMyTasks() {
  const started = performance.now();
  const body = { ...queryState(), ...(selectedResponsibleId ? { responsibleId: selectedResponsibleId } : {}) };
  const response = await fetch(`${ROOT}api/workbench/my-tasks/query`, {
    method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || payload.success === false) throw new Error(payload.error?.message || `HTTP ${response.status}`);
  return { status: 'ok', ...payload.data, queryKey: JSON.stringify(body), timings: { totalMs: +(performance.now() - started).toFixed(1) } };
}
const state = { kind: 'all', queue: 'actionable', query: '', scopeVersion: '', page: 1, pageSize: 20, filter: null, filterOpen: false, selectedId: null, expanded: new Set() };
function restoreUrl() {
  if (typeof window === 'undefined' || !/^\/knowledge-center\/?$/.test(window.location.pathname)) return;
  const raw = new URL(window.location.href).searchParams.get('wb');
  if (!raw) { state.kind = 'all'; state.queue = 'actionable'; state.query = ''; state.scopeVersion = ''; state.page = 1; state.filter = null; selectedResponsibleId = ''; return; }
  try {
    const value = JSON.parse(raw);
    state.kind = 'all'; state.queue = 'actionable'; state.query = ''; state.scopeVersion = ''; state.page = 1; state.filter = null; selectedResponsibleId = '';
    if (['all', ...Object.keys(TYPES)].includes(value.kind)) state.kind = value.kind;
    if (['actionable', 'waiting'].includes(value.queue)) state.queue = value.queue;
    if (Number.isSafeInteger(value.page) && value.page > 0) state.page = value.page;
    if (typeof value.query === 'string') state.query = value.query.slice(0, 200);
    if (typeof value.scopeVersion === 'string') state.scopeVersion = value.scopeVersion.slice(0, 100);
    if (value.filter && typeof value.filter === 'object') state.filter = value.filter;
    if (typeof value.responsibleId === 'string') selectedResponsibleId = value.responsibleId.slice(0, 128);
  } catch (_) { /* Invalid shared URL falls back to default view. */ }
}
function saveUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('wb', JSON.stringify({ kind: state.kind, queue: state.queue, page: state.page, query: state.query, scopeVersion: state.scopeVersion, filter: state.filter, responsibleId: selectedResponsibleId || null }));
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
}
function queryState() { return { queue: state.queue, type: state.kind, search: state.query, scopeVersion: state.scopeVersion, page: state.page, pageSize: state.pageSize, filter: state.filter }; }
export function getMyTaskQueryKey() { return JSON.stringify({ ...queryState(), ...(selectedResponsibleId ? { responsibleId: selectedResponsibleId } : {}) }); }
restoreUrl();
let refreshHandler = null;
export function setRefreshHandler(callback) { refreshHandler = callback; }
function displayTitle(item) {
  const title = String(item.title || '');
  const match = title.match(/^(审核|编写或修订|创建|修订|编写)?\s*(.*[/\\])([^/\\]+\.md)$/i);
  return (match ? `${match[1] ? `${match[1]} ` : ''}${match[3]}` : title).replace(/\.md$/i, '') || '未命名文档';
}
function displayDocumentPath(item) {
  const lineagePath = String(item.lineage?.documentPath || item.lineage?.path || item.lineage?.documentName || '');
  if (/[/\\]/.test(lineagePath)) return lineagePath;
  const title = String(item.title || '');
  return title.match(/^(?:审核|编写或修订|创建|修订|编写)?\s*(.+[/\\][^/\\]+\.md)$/i)?.[1] || '';
}
function versionLabel(item) { return /^(document|handbook):/.test(String(item.id || '')) ? '目标分支' : '业务版本'; }
function primaryAction(item) {
  if (item.primaryAction) return item.primaryAction;
  return { code: item.queue === 'waiting' ? 'view_progress' : 'open', label: item.queue === 'waiting' ? '查看进度' : item.actionLabel || (item.kind === 'document' ? '进入编写' : item.kind === 'review' ? '查看审核' : '查看任务'), url: item.url, external: item.external };
}
const COLUMNS = ['编号', '工作项', '关联范围', '当前状态', '计划截止', '下一步', '详情'];
function dateText(value) { return value ? new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'; }
function taskCell(label, value, extra = '') { return `<div class="my-task-cell ${extra}" role="cell"><span class="my-task-cell-label">${label}</span><span>${value}</span></div>`; }
function scopeText(item) {
  const names = [item.lineage?.handbookName || item.lineage?.handbookId, item.version].filter(Boolean);
  return names.length ? names.map(safe).join(' · ') : safe(item.context || item.taskType || TYPES[item.kind]?.name || '—');
}
function nextStep(item, preview) {
  if (preview?.readOnly) return '<button type="button" class="my-task-go" disabled>只读预览</button>';
  const action = primaryAction(item);
  if (action.enabled === false) return `<button type="button" class="my-task-go" disabled title="当前账号无权执行">${safe(action.label)}</button>`;
  if (action.code === 'sync_delivery') return `<button type="button" class="my-task-go" data-my-task-sync="${safe(item.id)}">状态刷新</button>`;
  return action.url ? `<a class="my-task-go" href="${safe(action.url)}" ${action.external ? 'target="_blank" rel="noopener noreferrer"' : ''}>${safe(action.label)}</a>` : '<span class="my-task-action-unavailable" role="status">操作入口暂不可用</span><button class="my-task-open" type="button" data-my-task-retry>重新读取</button>';
}
function taskRow(item, preview, index) {
  const id = item.id;
  const title = displayTitle(item);
  const documentPath = displayDocumentPath(item);
  const number = item.number || (item.numberingStatus === 'needs_review' ? '待核对' : '待登记');
  const titleContent = `${safe(title)}${documentPath ? `<small class="my-task-document-path">${safe(documentPath)}</small>` : ''}`;
  return `<article class="my-task-table-row" role="row" aria-rowindex="${index + 2}">${taskCell('编号', `<strong>${safe(number)}</strong>${item.subtaskNumber == null ? '' : `<small>${safe(item.subtaskNumber)}</small>`}`, 'number')}${taskCell('工作项', titleContent, 'description')}${taskCell('关联范围', scopeText(item), 'scope')}${taskCell('当前状态', safe(item.status || '状态待确认'), 'status')}${taskCell('计划截止', dateText(item.plannedEndTime))}${taskCell('下一步', nextStep(item, preview), 'next')}${taskCell('详情', `<button type="button" class="my-task-open" data-my-task-open="${safe(id)}" aria-label="查看${safe(title)}详情">详情</button>`)}</article>`;
}
function tableHeader() { return `<div class="my-task-table-head" role="row" aria-rowindex="1">${COLUMNS.map((name, index) => `<span role="columnheader" aria-colindex="${index + 1}">${name}</span>`).join('')}</div>`; }
function lineageRows(item) {
  const lineage = item.lineage || {};
  const documentName = lineage.documentName || displayDocumentPath(item);
  const documentPath = lineage.documentPath || lineage.path || displayDocumentPath(item);
  return [['工单', lineage.ticketNumber], ['手册', lineage.handbookName || lineage.handbookId], ['文档', documentName],
    ...(documentPath && documentPath !== documentName ? [['文档路径', documentPath]] : [])].filter(([, value]) => value)
    .map(([label, value]) => `<div class="my-task-detail-field"><dt>${label}</dt><dd>${safe(value)}</dd></div>`).join('');
}
function taskDetails(item, preview) {
  const action = primaryAction(item);
  const number = item.number && item.numberingStatus !== 'needs_review' ? item.number : '';
  const status = String(item.status || '');
  const mrState = item.delivery?.mergeState;
  const showMrState = mrState && !((mrState === 'closed' && /MR.*关闭/.test(status)) || (mrState === 'merged' && /MR.*合并|已合入/.test(status)));
  const deliveryFacts = item.delivery && mrState === 'merged'
    ? `<div class="my-task-delivery-facts"><span>正文回读：${item.delivery.markdownReadback ? '一致' : '待核验'}</span><span>图片回读：${item.delivery.resourceReadback ? '一致' : '待核验'}</span></div>` : '';
  const result = `<section class="my-task-detail-section" aria-label="当前进展"><h3>当前进展</h3><p class="my-task-detail-status">${safe(status || '待处理')}</p>${showMrState ? `<p class="my-task-detail-substatus">MR：${safe(({ opened: '待合入', merged: '已合入', closed: '已关闭' })[mrState] || '未同步')}</p>` : ''}${deliveryFacts}${syncErrors.has(item.id) ? `<p class="my-task-detail-error" role="alert"><strong>同步失败：</strong>${safe(syncErrors.get(item.id))}</p>` : ''}</section>`;
  const scope = `${lineageRows(item)}${item.version ? `<div class="my-task-detail-field"><dt>${versionLabel(item)}</dt><dd>${safe(item.version)}</dd></div>` : ''}`;
  const context = scope || (item.context ? `<div class="my-task-detail-field"><dt>关联范围</dt><dd>${safe(item.context)}</dd></div>` : '');
  const trace = [['来源', item.source], ['内部任务', item.id], ['原始关联', item.context], ['计划开始', item.plannedStartTime ? dateText(item.plannedStartTime) : null]]
    .filter(([, value]) => value).map(([label, value]) => `<div class="my-task-detail-field"><dt>${label}</dt><dd>${safe(value)}</dd></div>`).join('');
  const available = !preview?.readOnly && action.enabled !== false;
  const command = available && action.code === 'sync_delivery' ? `<button type="button" class="primary" data-my-task-sync="${safe(item.id)}">状态刷新</button>`
    : available && action.url ? `<a href="${safe(action.url)}" class="primary" ${action.external ? 'target="_blank" rel="noopener noreferrer"' : ''}>${safe(action.label)}</a>` : '';
  return `<dialog class="my-task-dialog" data-my-task-dialog aria-label="工作详情"><header><div><h2>${safe(displayTitle(item))}</h2>${number ? `<p class="my-task-detail-number">${safe(number)}</p>` : ''}</div><button type="button" data-my-task-close aria-label="关闭详情"><i data-lucide="x" aria-hidden="true"></i></button></header><div class="my-task-detail-body">${result}${context ? `<section class="my-task-detail-section" aria-label="关联范围"><h3>关联范围</h3><dl class="my-task-detail-fields">${context}</dl></section>` : ''}<details class="my-task-detail-trace"><summary>追溯信息</summary><dl class="my-task-detail-fields">${trace}</dl></details></div><footer><button type="button" data-my-task-close>关闭</button>${command}</footer></dialog>`;
}
const FILTER_FIELDS = [
  ['number', '编号'], ['subtaskNumber', '子任务编号'], ['description', '描述'], ['taskType', '任务类型'],
  ['source', '来源'], ['handbook', '手册'], ['document', '文档'], ['version', '版本'],
  ['plannedStartTime', '开始时间'], ['plannedEndTime', '结束时间'],
];
let draftFilter = null;
function conditionTemplate() { return { field: 'number', operator: 'contains', value: '' }; }
function filterGroup(node, path = '') {
  const group = node?.op ? node : { op: 'and', children: [node || conditionTemplate()] };
  return `<fieldset class="my-task-filter-group" data-filter-path="${path}"><legend>条件组</legend><label>满足<select data-filter-op="${path}"><option value="and" ${group.op === 'and' ? 'selected' : ''}>全部（且）</option><option value="or" ${group.op === 'or' ? 'selected' : ''}>任一（或）</option></select></label>${group.children.map((child, index) => {
    const childPath = path ? `${path}.${index}` : String(index);
    if (child.op) return filterGroup(child, childPath);
    const date = child.field === 'plannedStartTime' || child.field === 'plannedEndTime';
    const fields = FILTER_FIELDS.map(([value, label]) => `<option value="${value}" ${child.field === value ? 'selected' : ''}>${label}</option>`).join('');
    const exact = ['taskType', 'status', 'source'].includes(child.field);
    const value = date ? `<input type="date" data-filter-date-start="${childPath}" value="${safe(child.value?.[0] || '')}" aria-label="开始日期"><span>至</span><input type="date" data-filter-date-end="${childPath}" value="${safe(child.value?.[1] || '')}" aria-label="结束日期">`
      : `<input type="text" data-filter-value="${childPath}" value="${safe(child.value || '')}" placeholder="输入查询值" aria-label="查询值">`;
    return `<div class="my-task-filter-condition"><select data-filter-field="${childPath}" aria-label="字段">${fields}</select><select data-filter-operator="${childPath}" aria-label="比较方式">${date ? '<option value="between">区间</option>' : exact ? '<option value="eq">等于</option>' : `<option value="contains" ${child.operator === 'contains' ? 'selected' : ''}>包含</option><option value="eq" ${child.operator === 'eq' ? 'selected' : ''}>等于</option>`}</select>${value}<button type="button" data-filter-remove="${childPath}" aria-label="删除条件">删除</button></div>`;
  }).join('')}<div class="my-task-filter-add"><button type="button" data-filter-add-condition="${path}">+ 条件</button><button type="button" data-filter-add-group="${path}">+ 条件组</button>${path ? `<button type="button" data-filter-remove="${path}">删除组</button>` : ''}</div></fieldset>`;
}
export function renderMyTasks(projection) {
  const items = projection?.items || [];
  const unavailable = projection?.unavailable || [];
  const partial = unavailable.length > 0;
  const loading = projection?.status === 'loading';
  const facets = projection?.facets || { all: 0, actionable: 0, waiting: 0, types: {} };
  const selected = items.find(item => item.id === state.selectedId);
  const tabCount = kind => facets.types?.[kind] || 0;
  const hasFilters = Boolean(state.query || state.scopeVersion || state.filter);
  const preview = projection?.preview;
  const empty = loading
    ? '<div class="my-task-empty" role="status"><strong>正在读取工作…</strong></div>'
    : projection?.status === 'unavailable'
      ? '<div class="my-task-empty" role="status"><strong>工作暂时无法读取</strong><p>请检查连接后重试。</p><button type="button" data-my-task-retry>重新读取</button></div>'
      : `<div class="my-task-empty" role="status"><strong>${hasFilters ? '没有符合查询条件的工作' : state.queue === 'waiting' ? '当前没有跟进中的工作' : '当前没有需要你处理的工作'}</strong>${hasFilters ? '<button type="button" data-my-task-clear>清除查询</button>' : ''}</div>`;
  const tabs = [['all', '全部'], ...Object.entries(TYPES).map(([key, value]) => [key, value.short])]
    .map(([key, name]) => `<button type="button" data-my-task-kind="${key}" class="${state.kind === key ? 'active' : ''}" aria-current="${state.kind === key ? 'true' : 'false'}">${name} <small>${key === 'all' ? facets.all || 0 : tabCount(key)}</small></button>`).join('');
  const notice = partial ? `<p class="my-task-notice" role="status">部分数据：${unavailable.map(safe).join('、')}暂不可用。当前只显示已读取来源的事项。</p>` : '';
  const people = projection?.responsibles || [];
  const selector = preview?.enabled ? `<label class="my-task-responsible">当前责任人<select data-my-task-responsible>${people.map(person => `<option value="${safe(person.id)}" ${String(person.id) === String(preview.selectedId) ? 'selected' : ''}>${safe(person.displayName)}</option>`).join('')}</select></label>` : '';
  const noticePreview = preview?.delegated ? `<p class="my-task-preview" role="status"><strong>管理员代办</strong><span>${safe(preview.displayName)}的工作 · 实际操作者：${safe(preview.operatorName)}</span><button type="button" data-my-task-self>切回我的工作</button></p>` : '';
  const details = selected ? taskDetails(selected, preview) : '';
  const filterPanel = state.filterOpen ? `<div class="my-task-filter-panel" role="group" aria-label="联合查询条件"><div class="my-task-filter-head"><strong>查询条件</strong><button type="button" data-filter-clear>清空</button></div>${filterGroup(draftFilter || { op: 'and', children: [conditionTemplate()] })}<div class="my-task-filter-footer"><span data-filter-error role="alert"></span><button type="button" data-filter-apply>应用查询</button></div></div>` : '';
  const pageCount = Math.max(1, Math.ceil((projection?.total || 0) / (projection?.pageSize || state.pageSize)));
  const versionOptions = [...new Set([...(projection?.versionOptions || []), state.scopeVersion].filter(Boolean))];
  const controls = noticePreview || selector ? `<div class="workspace-action-row my-tasks-title my-task-page-heading">${noticePreview}<div class="my-task-title-actions">${selector}</div></div>` : '';
  const visibleRowCount = items.length;
  const versions = `<label>关联范围<select data-my-task-version aria-label="按业务版本筛选关联范围"><option value="">全部版本</option>${versionOptions.map(version => `<option value="${safe(version)}" ${version === state.scopeVersion ? 'selected' : ''}>${safe(version)}</option>`).join('')}</select></label>`;
  const pagination = `<footer class="my-task-pagination"><button type="button" data-my-task-page="${state.page - 1}" ${state.page <= 1 || loading ? 'disabled' : ''}>上一页</button><span>第 ${state.page}/${pageCount} 页</span><button type="button" data-my-task-page="${state.page + 1}" ${state.page >= pageCount || loading ? 'disabled' : ''}>下一页</button>${loading ? '' : renderPageJump(state.page, pageCount, 'dashboard')}</footer>`;
  return `<section class="my-tasks">${controls}${notice}<p class="my-task-action-feedback" role="status" ${actionFeedback ? '' : 'hidden'}>${safe(actionFeedback)}</p><section class="my-task-board" aria-label="个人工作"><header class="my-task-board-head"><nav aria-label="工作类别">${tabs}</nav></header><div class="my-task-toolbar"><div class="my-task-queues" role="group" aria-label="处理状态"><button type="button" data-my-task-queue="actionable" class="${state.queue === 'actionable' ? 'active' : ''}">待我处理 ${facets.actionable || 0}</button><button type="button" data-my-task-queue="waiting" class="${state.queue === 'waiting' ? 'active' : ''}">跟进中 ${facets.waiting || 0}</button></div><label>搜索<input type="search" data-my-task-query placeholder="编号或标题" value="${safe(state.query)}"></label>${versions}<button type="button" class="my-task-filter-trigger" data-filter-toggle aria-expanded="${state.filterOpen}">查询条件${state.filter ? ' · 已应用' : ''}</button><span role="status">${loading ? '读取中' : `${projection?.total || 0} 项 · 第 ${state.page}/${pageCount} 页`}</span></div>${filterPanel}<div class="my-task-list my-task-table" role="table" aria-label="个人工作列表" aria-colcount="${COLUMNS.length}" aria-rowcount="${visibleRowCount + 1}">${tableHeader()}${items.map((item, index) => taskRow(item, preview, index)).join('')}</div>${items.length ? '' : empty}${pagination}</section>${details}</section>`;
}
export function updateMyTasksProjection(projection) {
  const root = document.querySelector('#view-root .my-tasks');
  if (!root) return false;
  const active = root.contains(document.activeElement) ? document.activeElement : null;
  const focus = active?.matches('[data-my-task-query]') ? '[data-my-task-query]'
    : active?.matches('[data-filter-value]') ? `[data-filter-value="${CSS.escape(active.dataset.filterValue)}"]` : null;
  const selection = focus && active?.type === 'search' ? [active.selectionStart, active.selectionEnd] : null;
  const template = document.createElement('template');
  template.innerHTML = renderMyTasks(projection);
  const replacement = template.content.firstElementChild;
  root.replaceWith(replacement);
  cleanupSearchableSelects();
  markDynamicSelects(document.querySelector('#view-root .my-tasks'));
  if (focus) {
    const next = document.querySelector(`#view-root .my-tasks ${focus}`);
    next?.focus();
    if (selection) next?.setSelectionRange(...selection);
  }
  window.lucide?.createIcons({ nodes: [replacement] });
  return true;
}
function updateLocal() {
  const root = document.querySelector('#view-root');
  if (!root?.querySelector('.my-tasks')) return;
  const projection = window.__knowledgeMyTasksProjection;
  root.innerHTML = renderMyTasks(projection);
  cleanupSearchableSelects();
  markDynamicSelects(root);
  window.lucide?.createIcons({ nodes: [root] });
}
function openDialog() { const dialog = document.querySelector('[data-my-task-dialog]'); if (dialog && !dialog.open) dialog.showModal(); }
function filterAt(path) { return path === '' ? draftFilter : String(path).split('.').reduce((node, index) => node.children[Number(index)], draftFilter); }
function filterParent(path) {
  const parts = String(path).split('.');
  const index = Number(parts.pop());
  return { parent: parts.length ? filterAt(parts.join('.')) : draftFilter, index };
}
function applyQuery() { state.page = 1; saveUrl(); refreshHandler?.(); }
function filterComplete(node) {
  if (node.op) return node.children.length > 0 && node.children.every(filterComplete);
  return Array.isArray(node.value) ? node.value.length === 2 && node.value.every(Boolean) && node.value[0] <= node.value[1]
    : typeof node.value === 'string' && Boolean(node.value.trim()) && node.value.length <= 100;
}
function filterSize(node) { return node.op ? 1 + node.children.reduce((sum, child) => sum + filterSize(child), 0) : 1; }
let searchTimer;
document.addEventListener('click', event => {
  const root = event.target.closest('.my-tasks');
  if (!root) return;
  const sync = event.target.closest('[data-my-task-sync]');
  if (sync) {
    const item = window.__knowledgeMyTasksProjection?.items?.find(entry => entry.id === sync.dataset.myTaskSync);
    if (!item || item.primaryAction?.code !== 'sync_delivery' || !syncHandler || sync.disabled) return;
    sync.disabled = true;
    sync.textContent = '同步中…';
    actionFeedback = '';
    Promise.resolve(syncHandler(item.primaryAction)).then(() => {
      syncErrors.delete(item.id);
      actionFeedback = '交付状态已同步';
      refreshHandler?.();
    }).catch(error => {
      actionFeedback = error.message || '同步失败，请重试';
      syncErrors.set(item.id, actionFeedback);
      const status = root.querySelector('.my-task-action-feedback');
      if (status) { status.hidden = false; status.textContent = actionFeedback; }
      sync.disabled = false;
      sync.textContent = '状态刷新';
    });
    return;
  }
  const kind = event.target.closest('[data-my-task-kind]');
  if (kind) { state.kind = kind.dataset.myTaskKind; applyQuery(); return; }
  const queue = event.target.closest('[data-my-task-queue]');
  if (queue) { state.queue = queue.dataset.myTaskQueue; applyQuery(); return; }
  const page = event.target.closest('[data-my-task-page]');
  if (page) { state.page = Number(page.dataset.myTaskPage); saveUrl(); refreshHandler?.(); return; }
  if (event.target.closest('[data-my-task-self]')) { selectedResponsibleId = ''; state.selectedId = null; responsibleHandler?.(); return; }
  if (event.target.closest('[data-my-task-clear]')) { state.query = ''; state.scopeVersion = ''; state.filter = null; applyQuery(); return; }
  if (event.target.closest('[data-my-task-retry]')) { refreshHandler?.(); return; }
  if (event.target.closest('[data-filter-toggle]')) { state.filterOpen = !state.filterOpen; draftFilter = structuredClone(state.filter || { op: 'and', children: [conditionTemplate()] }); updateLocal(); return; }
  if (event.target.closest('[data-filter-clear]')) { state.filter = null; state.filterOpen = false; draftFilter = null; applyQuery(); return; }
  if (event.target.closest('[data-filter-apply]')) {
    if (!filterComplete(draftFilter)) { root.querySelector('[data-filter-error]').textContent = '请填写完整的查询条件'; return; }
    if (filterSize(draftFilter) > 20 || JSON.stringify(draftFilter).length > 3000) {
      root.querySelector('[data-filter-error]').textContent = '查询条件过多，请缩减后再应用'; return;
    }
    state.filter = structuredClone(draftFilter); state.filterOpen = false; applyQuery(); return;
  }
  const addCondition = event.target.closest('[data-filter-add-condition]');
  if (addCondition) { filterAt(addCondition.dataset.filterAddCondition).children.push(conditionTemplate()); updateLocal(); return; }
  const addGroup = event.target.closest('[data-filter-add-group]');
  if (addGroup) { filterAt(addGroup.dataset.filterAddGroup).children.push({ op: 'and', children: [conditionTemplate()] }); updateLocal(); return; }
  const remove = event.target.closest('[data-filter-remove]');
  if (remove) { const { parent, index } = filterParent(remove.dataset.filterRemove); parent.children.splice(index, 1); updateLocal(); return; }
  const item = event.target.closest('[data-my-task-open]');
  if (item) { state.selectedId = item.dataset.myTaskOpen; updateLocal(); openDialog(); return; }
  if (event.target.closest('[data-my-task-close]')) { document.querySelector('[data-my-task-dialog]')?.close(); state.selectedId = null; updateLocal(); }
});
document.addEventListener('input', event => {
  if (event.target.matches('[data-my-task-query]')) {
    state.query = event.target.value;
    state.page = 1;
    saveUrl();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => refreshHandler?.(), 300);
  }
  if (event.target.matches('[data-filter-value]')) filterAt(event.target.dataset.filterValue).value = event.target.value;
});
document.addEventListener('change', event => {
  if (event.target.matches('[data-my-task-version]')) { state.scopeVersion = event.target.value; applyQuery(); return; }
  if (event.target.matches('[data-my-task-responsible]')) {
    selectedResponsibleId = event.target.value;
    state.kind = 'all'; state.query = ''; state.scopeVersion = ''; state.filter = null; state.page = 1; state.selectedId = null; state.expanded.clear(); saveUrl();
    responsibleHandler?.(); return;
  }
  if (event.target.matches('[data-filter-op]')) { filterAt(event.target.dataset.filterOp).op = event.target.value; return; }
  if (event.target.matches('[data-filter-field]')) {
    const item = filterAt(event.target.dataset.filterField); item.field = event.target.value;
    item.operator = item.field.startsWith('planned') ? 'between' : ['taskType', 'status', 'source'].includes(item.field) ? 'eq' : 'contains';
    item.value = item.operator === 'between' ? ['', ''] : '';
    updateLocal(); return;
  }
  if (event.target.matches('[data-filter-operator]')) { filterAt(event.target.dataset.filterOperator).operator = event.target.value; return; }
  if (event.target.matches('[data-filter-value]')) { filterAt(event.target.dataset.filterValue).value = event.target.value; return; }
  if (event.target.matches('[data-filter-date-start], [data-filter-date-end]')) {
    const start = event.target.dataset.filterDateStart;
    const item = filterAt(start === undefined ? event.target.dataset.filterDateEnd : start);
    item.value[start === undefined ? 1 : 0] = event.target.value;
  }
});
document.addEventListener('submit', event => {
  const form = event.target.closest('[data-kc-page-jump="dashboard"]');
  if (!form) return;
  event.preventDefault();
  const page = readPageJump(form, Number(form.elements.page.max));
  if (!page) return;
  state.page = page;
  saveUrl();
  refreshHandler?.();
});
document.addEventListener('close', event => { if (event.target.matches('[data-my-task-dialog]')) { state.selectedId = null; updateLocal(); } }, true);
window.addEventListener('popstate', () => { if (/^\/knowledge-center\/?$/.test(location.pathname)) { restoreUrl(); refreshHandler?.(); } });
