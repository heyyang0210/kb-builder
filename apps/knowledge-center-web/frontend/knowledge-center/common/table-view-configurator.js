const STORAGE_PREFIX = 'knowledge-center:table-view:';
const REQUIRED_ATTR = 'data-table-column-required';
const TABLE_DECLARATIONS = [
  { selector: '.outline-responsibility-table', id: 'outline-assignment', label: '页面分工' },
];

function keyFor(table) { return `${STORAGE_PREFIX}${table.dataset.tableViewScope || 'local'}:${table.dataset.tableViewId || 'table'}:${table.dataset.tableViewSchema || '1'}`; }
function readPreference(table) {
  try { return JSON.parse(localStorage.getItem(keyFor(table)) || 'null'); } catch { return null; }
}
function writePreference(table, value) {
  try { localStorage.setItem(keyFor(table), JSON.stringify(value)); } catch { /* storage may be disabled */ }
}
function columnsFor(table) {
  const heads = [...table.querySelectorAll(':scope > thead > tr:first-child > th')];
  heads.forEach((head, index) => {
    if (!head.dataset.tableColumn) head.dataset.tableColumn = `column-${index + 1}`;
    head.dataset.tableColumnLabel ||= head.textContent.trim() || `字段 ${index + 1}`;
    table.querySelectorAll(`:scope > tbody > tr`).forEach(row => {
      if (row.children.length !== heads.length) return;
      const cell = row.children[index];
      if (cell && !cell.dataset.tableColumn) cell.dataset.tableColumn = head.dataset.tableColumn;
    });
  });
  return heads.map((head, index) => ({
    key: head.dataset.tableColumn,
    label: head.dataset.tableColumnLabel,
    required: head.getAttribute(REQUIRED_ATTR) === 'true',
    width: head.dataset.tableColumnWidth || 'standard',
    index,
  }));
}
function defaultState(columns) {
  return { visible: Object.fromEntries(columns.map(column => [column.key, true])), order: columns.map(column => column.key), pinned: {}, widths: {} };
}
function normalizeState(table, columns, value) {
  const base = defaultState(columns);
  const current = value && typeof value === 'object' ? value : {};
  const known = new Set(columns.map(column => column.key));
  const order = [...(Array.isArray(current.order) ? current.order : [])].filter(key => known.has(key));
  columns.forEach(column => { if (!order.includes(column.key)) order.push(column.key); });
  const visible = { ...base.visible, ...(current.visible || {}) };
  columns.filter(column => column.required).forEach(column => { visible[column.key] = true; });
  if (!Object.values(visible).some(Boolean)) visible[columns[0]?.key] = true;
  return { visible, order, pinned: { ...(current.pinned || {}) }, widths: { ...(current.widths || {}) } };
}
function applyState(table, columns, state) {
  const rank = new Map(state.order.map((key, index) => [key, index]));
  const rows = [...table.querySelectorAll(':scope > thead > tr:first-child, :scope > tbody > tr')];
  rows.forEach(row => {
    const cells = [...row.children].filter(cell => cell.dataset.tableColumn);
    cells.sort((a, b) => (rank.get(a.dataset.tableColumn) ?? 999) - (rank.get(b.dataset.tableColumn) ?? 999));
    cells.forEach(cell => row.appendChild(cell));
  });
  table.querySelectorAll('[data-table-column]').forEach(cell => {
    const key = cell.dataset.tableColumn;
    cell.hidden = state.visible[key] === false;
    cell.dataset.tableColumnPinned = state.pinned[key] || '';
    const width = state.widths[key] || '';
    cell.style.width = width; cell.style.minWidth = width; cell.style.maxWidth = width;
    cell.style.left = ''; cell.style.right = '';
  });
  window.requestAnimationFrame(() => {
    let left = 0;
    state.order.filter(key => state.visible[key] && state.pinned[key] === 'left').forEach(key => {
      const cells = [...table.querySelectorAll(`[data-table-column="${CSS.escape(key)}"]`)];
      cells.forEach(cell => { cell.style.left = `${left}px`; });
      left += cells[0]?.getBoundingClientRect().width || 0;
    });
    let right = 0;
    [...state.order].reverse().filter(key => state.visible[key] && state.pinned[key] === 'right').forEach(key => {
      const cells = [...table.querySelectorAll(`[data-table-column="${CSS.escape(key)}"]`)];
      cells.forEach(cell => { cell.style.right = `${right}px`; });
      right += cells[0]?.getBoundingClientRect().width || 0;
    });
  });
}
function labelForState(state, columns) {
  const visible = columns.filter(column => state.visible[column.key]).length;
  return `显示字段 ${visible}/${columns.length}`;
}
function createTrigger(table, label) {
  const host = table.closest('[data-table-view-host]') || table.parentElement;
  if (!host || host.querySelector(`[data-table-view-trigger="${CSS.escape(table.dataset.tableViewId)}"]`)) return;
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.className = 'table-view-trigger button tertiary compact';
  trigger.dataset.tableViewTrigger = table.dataset.tableViewId;
  trigger.setAttribute('aria-label', `配置${label}`); trigger.innerHTML = '<i data-lucide="columns-3" aria-hidden="true"></i><span>显示字段</span>';
  host.classList.add('table-view-host');
  host.insertBefore(trigger, table);
}
function drawerItemsHtml(columns, state) {
  return state.order.map((key, index) => columns.find(column => column.key === key)).filter(Boolean).map((column, index, ordered) => `<li data-table-drawer-item="${column.key}"><div class="table-view-order"><button type="button" data-table-view-move="up" data-table-view-column="${column.key}" aria-label="上移${column.label}"${index === 0 ? ' disabled' : ''}><i data-lucide="chevron-up" aria-hidden="true"></i></button><button type="button" data-table-view-move="down" data-table-view-column="${column.key}" aria-label="下移${column.label}"${index === ordered.length - 1 ? ' disabled' : ''}><i data-lucide="chevron-down" aria-hidden="true"></i></button></div><label><input type="checkbox" data-table-drawer-visible="${column.key}"${state.visible[column.key] ? ' checked' : ''}${column.required ? ' disabled' : ''}><span>${column.label}</span>${column.required ? '<small>必选</small>' : ''}</label><select data-table-drawer-width="${column.key}" aria-label="${column.label}宽度"><option value=""${!state.widths[column.key] ? ' selected' : ''}>自动宽度</option><option value="120px"${state.widths[column.key] === '120px' ? ' selected' : ''}>窄</option><option value="180px"${state.widths[column.key] === '180px' ? ' selected' : ''}>标准</option><option value="260px"${state.widths[column.key] === '260px' ? ' selected' : ''}>宽</option></select><select data-table-drawer-pin="${column.key}" aria-label="${column.label}固定位置"><option value=""${!state.pinned[column.key] ? ' selected' : ''}>不固定</option><option value="left"${state.pinned[column.key] === 'left' ? ' selected' : ''}>固定左侧</option><option value="right"${state.pinned[column.key] === 'right' ? ' selected' : ''}>固定右侧</option></select></li>`).join('');
}
function drawerHtml(table, columns, state) {
  const id = table.dataset.tableViewId;
  return `<div class="table-view-backdrop" data-table-view-backdrop hidden></div><aside class="table-view-drawer" data-table-view-drawer="${id}" aria-labelledby="table-view-title-${id}" hidden><header><div><span class="eyebrow">表格视图</span><h2 id="table-view-title-${id}">配置显示字段</h2><p>调整显示、顺序、固定和宽度，仅影响你的当前视图。</p></div><button type="button" class="icon-button" data-table-view-close aria-label="关闭字段配置"><i data-lucide="x" aria-hidden="true"></i></button></header><div class="table-view-drawer-body"><div class="table-view-drawer-actions"><button type="button" class="button tertiary compact" data-table-view-reset>恢复默认</button><span data-table-view-count>${labelForState(state, columns)}</span></div><ol data-table-drawer-list>${drawerItemsHtml(columns, state)}</ol><p class="table-view-hint">使用上下按钮调整顺序；必选列不可隐藏。</p></div><footer><button type="button" class="button tertiary" data-table-view-cancel>取消</button><button type="button" class="button primary" data-table-view-apply>应用</button></footer></aside>`;
}
function currentTable(id) { return [...document.querySelectorAll('[data-table-view-id]')].find(table => table.dataset.tableViewId === id); }
let activeTrigger = null;
function closeDrawer() {
  document.querySelectorAll('[data-table-view-drawer]').forEach(drawer => { drawer.hidden = true; });
  document.querySelectorAll('[data-table-view-backdrop]').forEach(backdrop => { backdrop.hidden = true; });
  activeTrigger?.focus(); activeTrigger = null;
}
function openDrawer(table) {
  const columns = columnsFor(table); const state = normalizeState(table, columns, readPreference(table));
  applyState(table, columns, state); createTrigger(table, table.dataset.tableViewLabel || '表格');
  const trigger = document.querySelector(`[data-table-view-trigger="${CSS.escape(table.dataset.tableViewId)}"]`); activeTrigger = trigger;
  document.querySelector('[data-table-view-drawer]')?.remove(); document.querySelector('[data-table-view-backdrop]')?.remove();
  document.body.insertAdjacentHTML('beforeend', drawerHtml(table, columns, state));
  const drawer = document.querySelector(`[data-table-view-drawer="${CSS.escape(table.dataset.tableViewId)}"]`);
  drawer._table = table; drawer._columns = columns; drawer._state = state; drawer._draft = structuredClone(state); drawer.hidden = false;
  document.querySelector('[data-table-view-backdrop]').hidden = false;
  drawer.querySelector('[data-table-drawer-visible]')?.focus(); window.lucide?.createIcons({ nodes: [drawer] });
}
function refreshDrawer(drawer) {
  const count = drawer.querySelector('[data-table-view-count]'); if (count) count.textContent = labelForState(drawer._draft, drawer._columns);
}
function renderDrawerItems(drawer) {
  drawer.querySelector('[data-table-drawer-list]').innerHTML = drawerItemsHtml(drawer._columns, drawer._draft);
  refreshDrawer(drawer); window.lucide?.createIcons({ nodes: [drawer] });
}
document.addEventListener('change', event => {
  const drawer = event.target.closest('[data-table-view-drawer]'); if (!drawer) return;
  const toggle = event.target.closest('[data-table-drawer-visible]');
  if (toggle) { drawer._draft.visible[toggle.dataset.tableDrawerVisible] = toggle.checked; refreshDrawer(drawer); return; }
  const width = event.target.closest('[data-table-drawer-width]');
  if (width) { drawer._draft.widths[width.dataset.tableDrawerWidth] = width.value; return; }
  const pin = event.target.closest('[data-table-drawer-pin]');
  if (pin) drawer._draft.pinned[pin.dataset.tableDrawerPin] = pin.value;
});
document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-table-view-trigger]');
  if (trigger) { const table = currentTable(trigger.dataset.tableViewTrigger); if (table) openDrawer(table); return; }
  const drawer = event.target.closest('[data-table-view-drawer]');
  if (event.target.closest('[data-table-view-close], [data-table-view-cancel], [data-table-view-backdrop]')) { closeDrawer(); return; }
  if (!drawer) return;
  const move = event.target.closest('[data-table-view-move]');
  if (move) { const index = drawer._draft.order.indexOf(move.dataset.tableViewColumn); const next = move.dataset.tableViewMove === 'up' ? index - 1 : index + 1; if (index >= 0 && next >= 0 && next < drawer._draft.order.length) { [drawer._draft.order[index], drawer._draft.order[next]] = [drawer._draft.order[next], drawer._draft.order[index]]; renderDrawerItems(drawer); drawer.querySelector(`[data-table-view-column="${CSS.escape(move.dataset.tableViewColumn)}"]`)?.focus(); } return; }
  if (event.target.closest('[data-table-view-reset]')) { drawer._draft = defaultState(drawer._columns); renderDrawerItems(drawer); return; }
  if (event.target.closest('[data-table-view-apply]')) { applyState(drawer._table, drawer._columns, drawer._draft); writePreference(drawer._table, drawer._draft); closeDrawer(); }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.querySelector('[data-table-view-drawer]:not([hidden])')) { event.preventDefault(); closeDrawer(); }
});
export function enhanceTableViews(root = document, preferenceScope = 'local') {
  TABLE_DECLARATIONS.forEach(({ selector, id, label }) => {
    root.querySelectorAll(`${selector}:not([data-table-view-id])`).forEach(table => {
      table.dataset.tableViewId = id; table.dataset.tableViewSchema = '1'; table.dataset.tableViewLabel = label;
    });
  });
  root.querySelectorAll('[data-table-view-id]').forEach(table => {
    table.dataset.tableViewScope = preferenceScope || 'local';
    const columns = columnsFor(table); const state = normalizeState(table, columns, readPreference(table));
    applyState(table, columns, state); createTrigger(table, table.dataset.tableViewLabel || '表格');
  });
  window.lucide?.createIcons();
}
