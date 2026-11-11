const controllers = new WeakMap();
const activeControllers = new Set();
let sequence = 0;

function text(value) {
  return String(value || '').trim();
}

function searchableText(option) {
  return `${text(option.textContent)} ${text(option.dataset.search)}`.toLocaleLowerCase('zh-CN');
}

function visibleOptions(select, query = '') {
  const normalized = text(query).toLocaleLowerCase('zh-CN');
  return [...select.options].filter(option => option.value && (!normalized || searchableText(option).includes(normalized)));
}

function selectedLabel(select) {
  return select.selectedOptions[0]?.value ? text(select.selectedOptions[0].textContent) : '';
}

function accessibleName(select) {
  if (select.getAttribute('aria-label')) return select.getAttribute('aria-label');
  const explicit = select.id ? document.querySelector(`label[for="${CSS.escape(select.id)}"]`) : null;
  const container = explicit || select.closest('label');
  if (!container) return select.name || '选择选项';
  const clone = container.cloneNode(true);
  clone.querySelectorAll('select, input, button, [role="listbox"]').forEach(node => node.remove());
  return text(clone.textContent) || select.name || '选择选项';
}

function requestedSize(select) {
  const value = text(select.dataset.comboboxSize);
  return ['compact', 'standard', 'full'].includes(value) ? value : 'auto';
}

function enhance(select) {
  if (controllers.has(select) || select.dataset.searchableSelect === 'false') return;
  const id = `searchable-combobox-${++sequence}`;
  const required = select.required;
  const wrapper = document.createElement('span');
  wrapper.className = 'searchable-combobox';
  wrapper.dataset.searchableCombobox = '';
  wrapper.dataset.comboboxSize = requestedSize(select);

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'searchable-combobox-input';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.required = required;
  input.disabled = select.disabled;
  input.value = selectedLabel(select);
  input.placeholder = select.dataset.searchablePlaceholder || text(select.options[0]?.textContent) || '输入关键字筛选';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', `${id}-listbox`);
  input.setAttribute('aria-label', `${accessibleName(select)}，可输入筛选`);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'searchable-combobox-toggle';
  toggle.setAttribute('aria-label', `展开${accessibleName(select)}`);
  toggle.innerHTML = '<span aria-hidden="true">⌄</span>';

  const listbox = document.createElement('div');
  listbox.id = `${id}-listbox`;
  listbox.className = 'searchable-combobox-listbox';
  listbox.dataset.scrollRegion = 'panel';
  listbox.dataset.searchableComboboxListbox = '';
  listbox.setAttribute('role', 'listbox');
  listbox.hidden = true;

  select.classList.add('searchable-combobox-native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  select.required = false;
  select.before(wrapper);
  wrapper.append(input, toggle, select);
  // 原生 dialog 位于浏览器 top layer。候选列表若统一挂在 body，视觉可见但会被
  // 模态层拦截指针事件；弹框内的列表必须跟随最近的 dialog 挂载。
  const overlayHost = select.closest('dialog') || document.body;
  overlayHost.append(listbox);

  let activeIndex = -1;
  let filtered = [];

  const position = () => {
    const rect = input.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = Math.min(280, Math.max(72, filtered.length * 42 + 12));
    listbox.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 220) - 8))}px`;
    listbox.style.width = `${Math.min(Math.max(rect.width, 220), window.innerWidth - 16)}px`;
    listbox.style.maxHeight = `${Math.max(96, Math.min(280, spaceBelow > 160 ? spaceBelow - 8 : rect.top - 8))}px`;
    listbox.style.top = spaceBelow > 160 ? `${rect.bottom + 4}px` : 'auto';
    listbox.style.bottom = spaceBelow > 160 ? 'auto' : `${window.innerHeight - rect.top + 4}px`;
  };

  const setActive = index => {
    const options = [...listbox.querySelectorAll('[role="option"]')];
    if (!options.length) { activeIndex = -1; input.removeAttribute('aria-activedescendant'); return; }
    activeIndex = Math.max(0, Math.min(index, options.length - 1));
    options.forEach((option, optionIndex) => option.classList.toggle('is-active', optionIndex === activeIndex));
    const active = options[activeIndex];
    input.setAttribute('aria-activedescendant', active.id);
    const activeTop = active.offsetTop;
    const activeBottom = activeTop + active.offsetHeight;
    if (activeTop < listbox.scrollTop) listbox.scrollTop = activeTop;
    else if (activeBottom > listbox.scrollTop + listbox.clientHeight) listbox.scrollTop = activeBottom - listbox.clientHeight;
  };

  const choose = option => {
    select.value = option.value;
    input.value = text(option.textContent);
    input.setCustomValidity('');
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    close(false);
  };

  const rebuild = (query = input.value, preserveActive = false) => {
    filtered = visibleOptions(select, query);
    listbox.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'searchable-combobox-empty';
      empty.setAttribute('role', 'status');
      empty.textContent = '没有匹配选项';
      listbox.append(empty);
      activeIndex = -1;
      input.removeAttribute('aria-activedescendant');
      position();
      return;
    }
    filtered.forEach((option, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.id = `${id}-option-${index}`;
      item.className = 'searchable-combobox-option';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(option.selected));
      item.dataset.value = option.value;
      item.textContent = text(option.textContent);
      item.addEventListener('pointerdown', event => event.preventDefault());
      item.addEventListener('click', () => choose(option));
      listbox.append(item);
    });
    const selectedIndex = filtered.findIndex(option => option.selected);
    setActive(preserveActive && activeIndex >= 0 ? activeIndex : Math.max(selectedIndex, 0));
    position();
  };

  function open(query = input.value) {
    if (input.disabled) return;
    document.querySelectorAll('[data-searchable-combobox-listbox]:not([hidden])').forEach(node => { if (node !== listbox) node.dispatchEvent(new CustomEvent('combobox-close')); });
    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    rebuild(query);
  }

  function close(restore = true) {
    listbox.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activeIndex = -1;
    if (restore) input.value = selectedLabel(select);
  }

  listbox.addEventListener('combobox-close', () => close());
  input.addEventListener('focus', () => open(input.value === selectedLabel(select) ? '' : input.value));
  input.addEventListener('click', () => open(input.value === selectedLabel(select) ? '' : input.value));
  input.addEventListener('input', () => {
    if (input.value !== selectedLabel(select)) select.value = '';
    input.setCustomValidity(required && !select.value ? '请从候选列表中选择一项' : '');
    open(input.value);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); if (listbox.hidden) open(''); else setActive(activeIndex + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); if (listbox.hidden) open(''); else setActive(activeIndex - 1); }
    else if (event.key === 'Home' && !listbox.hidden) { event.preventDefault(); setActive(0); }
    else if (event.key === 'End' && !listbox.hidden) { event.preventDefault(); setActive(filtered.length - 1); }
    else if (event.key === 'Enter' && !listbox.hidden && activeIndex >= 0) { event.preventDefault(); choose(filtered[activeIndex]); }
    else if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'Tab') close(false);
  });
  toggle.addEventListener('click', () => { if (listbox.hidden) { input.focus(); open(''); } else { close(); input.focus(); } });
  select.addEventListener('change', () => { input.value = selectedLabel(select); input.setCustomValidity(''); close(false); });
  select.form?.addEventListener('reset', () => window.setTimeout(() => { input.value = selectedLabel(select); close(false); }));

  const observer = new MutationObserver(() => {
    input.disabled = select.disabled;
    input.value = selectedLabel(select);
    wrapper.dataset.comboboxSize = requestedSize(select);
    if (!listbox.hidden) rebuild(input.value === selectedLabel(select) ? '' : input.value);
  });
  observer.observe(select, { childList: true, subtree: true, attributes: true });
  const sync = () => {
    input.value = selectedLabel(select);
    input.setCustomValidity('');
    if (!listbox.hidden) rebuild(input.value === selectedLabel(select) ? '' : input.value);
  };
  const controller = { select, close, listbox, observer, position, sync };
  controllers.set(select, controller);
  activeControllers.add(controller);
}

export function enhanceSearchableSelects(root = document) {
  root.querySelectorAll('select[data-searchable-select]').forEach(enhance);
}

export function cleanupSearchableSelects() {
  activeControllers.forEach(controller => {
    if (controller.select.isConnected) return;
    controller.observer.disconnect();
    controller.listbox.remove();
    activeControllers.delete(controller);
  });
}

// 动态表单回填原生 select.value 后调用，保证公共 Combobox 的可见输入框、
// 原生值和候选项状态保持一致。
export function syncSearchableSelect(select) {
  controllers.get(select)?.sync();
}

export function markDynamicSelects(root = document) {
  const selectors = [
    '[data-asset-branch]', '[data-mapping-connection-select]', '[data-mapping-default-branch]',
    'select[name="productId"]', 'select[name="ownerA"]', 'select[name="ownerB"]',
    '[data-domain-task-assignee]', '[data-outline-primary-domain]', '[data-outline-node-domain-filter]',
    '[data-outline-node-owner-filter]', '[data-outline-assignment-domain-filter]', '[data-outline-assignment-member-filter]',
    '[data-outline-batch-assignee]', '[data-team-member-candidate]', '[data-permission-role]',
    '[data-repository-branch]', 'select[name="handbookId"]', 'select[name="templateId"]',
    'select[name="version"]', 'select[name="nodeId"]', 'select[name="operationDocumentId"]',
    '.document-task-page select[name="ownerId"]', '.document-task-page select[name="product"]',
    '.document-task-page select[name="targetVersion"]',
    '.document-task-page select[name="parentId"]', '.document-task-page select[name="reviewTaskId"]',
    '.document-task-page select[name="createdDocumentId"]',
    '[data-map-handbook]', '[data-map-manual-template]', '[data-map-rule-field="templateId"]',
    '[data-map-rule-condition="handbookId"]', '[data-my-task-responsible]',
    '[data-review-online-reviewer]', '[data-review-assignment-dialog] select[name="reviewerIds"]',
    '[data-agent-model-choice]', '[data-agent-model] select[name="testModel"]',
    '[data-model-default]',
    'select[name="baselineVersionId"]', '[data-review-task-select]', '[data-review-handbook-select]',
    '[data-review-branch]', '[data-review-online-baseline]', '[data-team-group-form] select[name="leaderPrincipalId"]',
  ];
  root.querySelectorAll(selectors.join(',')).forEach(select => { select.dataset.searchableSelect = 'true'; });
  enhanceSearchableSelects(root);
}

document.addEventListener('pointerdown', event => {
  document.querySelectorAll('[data-searchable-combobox-listbox]:not([hidden])').forEach(listbox => {
    const controller = [...document.querySelectorAll('[data-searchable-combobox]')].find(wrapper => wrapper.contains(event.target));
    if (!controller && !listbox.contains(event.target)) listbox.dispatchEvent(new CustomEvent('combobox-close'));
  });
});

document.addEventListener('scroll', event => {
  if (event.target?.closest?.('[data-searchable-combobox-listbox]')) return;
  activeControllers.forEach(controller => {
    if (!controller.listbox.hidden && controller.select.isConnected) controller.position();
  });
}, true);

let positionFrame = 0;
function scheduleOpenListboxPosition() {
  if (positionFrame) return;
  positionFrame = window.requestAnimationFrame(() => {
    positionFrame = 0;
    activeControllers.forEach(controller => {
      if (!controller.listbox.hidden && controller.select.isConnected) controller.position();
    });
  });
}

// Mobile browsers resize or shift the visual viewport while scrolling a focused
// input into view and while opening the software keyboard. Keep the listbox
// attached to its input instead of treating those viewport changes as dismissal.
window.addEventListener('resize', scheduleOpenListboxPosition);
window.visualViewport?.addEventListener('resize', scheduleOpenListboxPosition);
window.visualViewport?.addEventListener('scroll', scheduleOpenListboxPosition);
