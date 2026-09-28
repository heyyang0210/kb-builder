const STORAGE_PREFIX = 'knowledge-center:table-view:';
const REQUIRED_ATTR = 'data-table-column-required';
const TABLE_DECLARATIONS = [
  { selector: '.outline-responsibility-table', id: 'outline-assignment', label: '页面分工' },
];

let activeTrigger = null;
let enhancementOptions = { preferenceScope: 'local', onChange: null };
let pendingRestore = null;

function keyFor(table) { return `${STORAGE_PREFIX}${table.dataset.tableViewScope || 'local'}:${table.dataset.tableViewId || 'table'}:${table.dataset.tableViewSchema || '1'}`; }
function readPreference(table) {
  try { return JSON.parse(localStorage.getItem(keyFor(table)) || 'null'); } catch { return null; }
}
function writePreference(table, value) {
  try { localStorage.setItem(keyFor(table), JSON.stringify(value)); } catch { /* storage may be disabled */ }
}
function removePreference(table) {
  try { localStorage.removeItem(keyFor(table)); } catch { /* storage may be disabled */ }
}
function columnsFor(table) {
  const heads = [...table.querySelectorAll(':scope > thead > tr:first-child > th')];
  heads.forEach((head, index) => {
    if (!head.dataset.tableColumn) head.dataset.tableColumn = `column-${index + 1}`;
    head.dataset.tableColumnLabel ||= head.textContent.trim() || `字段 ${index + 1}`;
    table.querySelectorAll(':scope > tbody > tr').forEach(row => {
      if (row.children.length !== heads.length) return;
      const cell = row.children[index];
      if (cell && !cell.dataset.tableColumn) cell.dataset.tableColumn = head.dataset.tableColumn;
    });
  });
  return heads.map((head, index) => ({
    key: head.dataset.tableColumn,
    label: head.dataset.tableColumnLabel,
    required: head.getAttribute(REQUIRED_ATTR) === 'true',
    index,
  }));
}
function defaultState(columns) {
  return { visible: Object.fromEntries(columns.map(column => [column.key, true])), order: columns.map(column => column.key) };
}
function normalizeState(columns, value) {
  const current = value && typeof value === 'object' ? value : {};
  const known = new Set(columns.map(column => column.key));
  const order = [...(Array.isArray(current.order) ? current.order : [])].filter(key => known.has(key));
  columns.forEach(column => { if (!order.includes(column.key)) order.push(column.key); });
  const visible = Object.fromEntries(columns.map(column => [column.key, current.visible?.[column.key] !== false]));
  columns.filter(column => column.required).forEach(column => { visible[column.key] = true; });
  if (!Object.values(visible).some(Boolean) && columns[0]) visible[columns[0].key] = true;
  return { visible, order };
}
function migrateLegacyPreference(table, columns) {
  const legacyKey = table.dataset.tableViewLegacyKey;
  if (!legacyKey) return null;
  try {
    const legacyColumns = JSON.parse(localStorage.getItem(legacyKey) || 'null');
    if (!Array.isArray(legacyColumns)) return null;
    const known = new Set(columns.map(column => column.key));
    const order = legacyColumns.filter(key => known.has(key));
    columns.forEach(column => { if (!order.includes(column.key)) order.push(column.key); });
    const migrated = normalizeState(columns, {
      visible: Object.fromEntries(columns.map(column => [column.key, legacyColumns.includes(column.key)])),
      order,
    });
    writePreference(table, migrated);
    localStorage.removeItem(legacyKey);
    return migrated;
  } catch { return null; }
}
function stateFor(table, columns) {
  return normalizeState(columns, readPreference(table) || migrateLegacyPreference(table, columns));
}
function applyState(table, state) {
  const rank = new Map(state.order.map((key, index) => [key, index]));
  const rows = [...table.querySelectorAll(':scope > thead > tr:first-child, :scope > tbody > tr')];
  rows.forEach(row => {
    const cells = [...row.children].filter(cell => cell.dataset.tableColumn);
    cells.sort((a, b) => (rank.get(a.dataset.tableColumn) ?? 999) - (rank.get(b.dataset.tableColumn) ?? 999));
    cells.forEach(cell => row.appendChild(cell));
  });
  table.querySelectorAll('[data-table-column]').forEach(cell => { cell.hidden = state.visible[cell.dataset.tableColumn] === false; });
}
function labelForState(state, columns) {
  const visible = columns.filter(column => state.visible[column.key]).length;
  return `显示字段 ${visible}/${columns.length}`;
}
function createTrigger(table, state, columns) {
  const host = table.closest('[data-table-view-host]') || table.parentElement;
  if (!host || host.querySelector(`[data-table-view-trigger="${CSS.escape(table.dataset.tableViewId)}"]`)) return;
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.className = 'table-view-trigger button tertiary compact';
  trigger.dataset.tableViewTrigger = table.dataset.tableViewId;
  trigger.setAttribute('aria-label', `配置${table.dataset.tableViewLabel || '表格'}显示字段`);
  trigger.innerHTML = `<i data-lucide="columns-3" aria-hidden="true"></i><span>${labelForState(state, columns)}</span>`;
  host.classList.add('table-view-host');
  host.insertBefore(trigger, table);
}
function drawerItemsHtml(columns, state) {
  return state.order.map(key => columns.find(column => column.key === key)).filter(Boolean).map((column, index, ordered) => `<li data-table-drawer-item="${column.key}"><div class="table-view-order"><button type="button" data-table-view-move="up" data-table-view-column="${column.key}" aria-label="上移${column.label}"${index === 0 ? ' disabled' : ''}><i data-lucide="chevron-up" aria-hidden="true"></i></button><button type="button" data-table-view-move="down" data-table-view-column="${column.key}" aria-label="下移${column.label}"${index === ordered.length - 1 ? ' disabled' : ''}><i data-lucide="chevron-down" aria-hidden="true"></i></button></div><label><input type="checkbox" data-table-drawer-visible="${column.key}"${state.visible[column.key] ? ' checked' : ''}${column.required ? ' disabled' : ''}><span>${column.label}</span>${column.required ? '<small>必选</small>' : ''}</label></li>`).join('');
}
function drawerHtml(table, columns, state) {
  const id = table.dataset.tableViewId;
  return `<div class="table-view-backdrop" data-table-view-backdrop hidden></div><aside class="table-view-drawer" data-table-view-drawer="${id}" aria-labelledby="table-view-title-${id}" hidden><header><div><span class="eyebrow">表格视图</span><h2 id="table-view-title-${id}">配置显示字段</h2><p>调整显示和顺序，修改后立即生效。</p></div><button type="button" class="icon-button" data-table-view-close aria-label="关闭字段配置"><i data-lucide="x" aria-hidden="true"></i></button></header><div class="table-view-drawer-body"><div class="table-view-drawer-actions"><button type="button" class="button tertiary compact" data-table-view-reset>恢复默认</button><span data-table-view-count>${labelForState(state, columns)}</span></div><ol data-table-drawer-list>${drawerItemsHtml(columns, state)}</ol><p class="table-view-hint">使用上下按钮调整顺序；必选列不可隐藏。</p></div></aside>`;
}
function currentTable(id) { return [...document.querySelectorAll('[data-table-view-id]')].find(table => table.dataset.tableViewId === id); }
function closeDrawer() {
  document.querySelectorAll('[data-table-view-drawer]').forEach(drawer => { drawer.hidden = true; });
  document.querySelectorAll('[data-table-view-backdrop]').forEach(backdrop => { backdrop.hidden = true; });
  activeTrigger?.focus(); activeTrigger = null;
}
function focusSelector(focus) {
  if (!focus) return '[data-table-drawer-visible]';
  if (focus.kind === 'visible') return `[data-table-drawer-visible="${CSS.escape(focus.key)}"]`;
  if (focus.kind === 'move') return `[data-table-view-column="${CSS.escape(focus.key)}"][data-table-view-move="${focus.direction}"]`;
  return '[data-table-view-reset]';
}
function openDrawer(table, restore = null) {
  const columns = columnsFor(table); const state = stateFor(table, columns);
  applyState(table, state); createTrigger(table, state, columns);
  const trigger = document.querySelector(`[data-table-view-trigger="${CSS.escape(table.dataset.tableViewId)}"]`); activeTrigger = trigger;
  document.querySelector('[data-table-view-drawer]')?.remove(); document.querySelector('[data-table-view-backdrop]')?.remove();
  document.body.insertAdjacentHTML('beforeend', drawerHtml(table, columns, state));
  const drawer = document.querySelector(`[data-table-view-drawer="${CSS.escape(table.dataset.tableViewId)}"]`);
  drawer._table = table; drawer._columns = columns; drawer._state = state; drawer.hidden = false;
  document.querySelector('[data-table-view-backdrop]').hidden = false;
  const drawerBody = drawer.querySelector('.table-view-drawer-body');
  if (restore?.drawerScrollTop) drawerBody.scrollTop = restore.drawerScrollTop;
  drawer.querySelector(focusSelector(restore?.focus))?.focus();
  window.lucide?.createIcons({ nodes: [drawer] });
}
function refreshDrawer(drawer) {
  drawer.querySelector('[data-table-drawer-list]').innerHTML = drawerItemsHtml(drawer._columns, drawer._state);
  drawer.querySelector('[data-table-view-count]').textContent = labelForState(drawer._state, drawer._columns);
  window.lucide?.createIcons({ nodes: [drawer] });
}
function commitState(drawer, focus, reset = false) {
  const state = normalizeState(drawer._columns, drawer._state);
  if (reset) removePreference(drawer._table); else writePreference(drawer._table, state);
  if (typeof enhancementOptions.onChange === 'function') {
    pendingRestore = {
      tableId: drawer._table.dataset.tableViewId,
      focus,
      drawerScrollTop: drawer.querySelector('.table-view-drawer-body')?.scrollTop || 0,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
    enhancementOptions.onChange({ tableId: pendingRestore.tableId, state, reset });
    return;
  }
  drawer._state = state;
  applyState(drawer._table, state);
  refreshDrawer(drawer);
  drawer.querySelector(focusSelector(focus))?.focus();
}

document.addEventListener('change', event => {
  const drawer = event.target.closest('[data-table-view-drawer]'); if (!drawer) return;
  const toggle = event.target.closest('[data-table-drawer-visible]'); if (!toggle) return;
  const key = toggle.dataset.tableDrawerVisible;
  drawer._state.visible[key] = toggle.checked;
  commitState(drawer, { kind: 'visible', key });
});
document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-table-view-trigger]');
  if (trigger) { const table = currentTable(trigger.dataset.tableViewTrigger); if (table) openDrawer(table); return; }
  const drawer = event.target.closest('[data-table-view-drawer]');
  if (event.target.closest('[data-table-view-close], [data-table-view-backdrop]')) { closeDrawer(); return; }
  if (!drawer) return;
  const move = event.target.closest('[data-table-view-move]');
  if (move) {
    const key = move.dataset.tableViewColumn; const direction = move.dataset.tableViewMove;
    const index = drawer._state.order.indexOf(key); const next = direction === 'up' ? index - 1 : index + 1;
    if (index >= 0 && next >= 0 && next < drawer._state.order.length) {
      [drawer._state.order[index], drawer._state.order[next]] = [drawer._state.order[next], drawer._state.order[index]];
      commitState(drawer, { kind: 'move', key, direction });
    }
    return;
  }
  if (event.target.closest('[data-table-view-reset]')) {
    drawer._state = defaultState(drawer._columns);
    commitState(drawer, { kind: 'reset' }, true);
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.querySelector('[data-table-view-drawer]:not([hidden])')) { event.preventDefault(); closeDrawer(); }
});

export function enhanceTableViews(root = document, options = {}) {
  enhancementOptions = typeof options === 'string' ? { preferenceScope: options, onChange: null } : { preferenceScope: 'local', onChange: null, ...options };
  TABLE_DECLARATIONS.forEach(({ selector, id, label }) => {
    root.querySelectorAll(`${selector}:not([data-table-view-id])`).forEach(table => {
      table.dataset.tableViewId = id; table.dataset.tableViewSchema = '1'; table.dataset.tableViewLabel = label;
    });
  });
  root.querySelectorAll('[data-table-view-id]').forEach(table => {
    table.dataset.tableViewScope = enhancementOptions.preferenceScope || 'local';
    const columns = columnsFor(table); const state = stateFor(table, columns);
    applyState(table, state); createTrigger(table, state, columns);
  });
  if (pendingRestore) {
    const restore = pendingRestore; const table = [...root.querySelectorAll('[data-table-view-id]')].find(item => item.dataset.tableViewId === restore.tableId);
    if (table) {
      pendingRestore = null;
      openDrawer(table, restore);
      window.requestAnimationFrame(() => window.scrollTo(restore.scrollX, restore.scrollY));
    }
  }
  window.lucide?.createIcons();
}
