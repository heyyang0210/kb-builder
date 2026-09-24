const bindings = new WeakMap();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || min));
}

function storageKey(root) {
  return `knowledge-center-navigation-pane:${root.dataset.navigationLayoutId || 'default'}`;
}

function readPreference(root) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(root)) || 'null');
    return value && typeof value === 'object' ? value : {};
  } catch (_) {
    return {};
  }
}

function savePreference(root, state) {
  try { localStorage.setItem(storageKey(root), JSON.stringify(state)); } catch (_) { /* 本地存储不可用时仅保留当前页面状态 */ }
}

function config(root) {
  const min = Number(root.dataset.navigationMin || 200);
  const max = Number(root.dataset.navigationMax || 420);
  const defaultWidth = clamp(root.dataset.navigationDefault || 280, min, max);
  return { min, max, defaultWidth, variable: root.dataset.navigationWidthVariable || '--navigation-pane-width' };
}

function dispatchChange(root, state, committed = false) {
  root.dispatchEvent(new CustomEvent('knowledge-center:navigation-pane-change', {
    bubbles: true,
    detail: {
      id: root.dataset.navigationLayoutId || '',
      width: state.width,
      collapsed: state.collapsed,
      committed,
    },
  }));
}

function apply(root, state, { persist = false, dispatch = true } = {}) {
  const limits = config(root);
  state.width = clamp(state.width || limits.defaultWidth, limits.min, limits.max);
  state.collapsed = Boolean(state.collapsed);
  root.style.setProperty(limits.variable, `${state.width}px`);
  root.classList.toggle('navigation-pane-collapsed', state.collapsed);
  root.classList.toggle('navigation-pane-resizing', Boolean(state.resizing));
  const toggle = root.querySelector('[data-navigation-pane-toggle]');
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(!state.collapsed));
    toggle.setAttribute('aria-label', `${state.collapsed ? '展开' : '收起'}${root.dataset.navigationPaneLabel || '目录'}`);
    toggle.title = toggle.getAttribute('aria-label');
  }
  const handle = root.querySelector('[data-navigation-pane-resizer]');
  if (handle) {
    handle.setAttribute('aria-valuemin', String(limits.min));
    handle.setAttribute('aria-valuemax', String(limits.max));
    handle.setAttribute('aria-valuenow', String(Math.round(state.width)));
    handle.tabIndex = state.collapsed ? -1 : 0;
  }
  if (persist) savePreference(root, { width: state.width, collapsed: state.collapsed });
  if (dispatch) dispatchChange(root, state, persist);
}

function bind(root) {
  if (bindings.has(root)) return;
  const limits = config(root);
  const stored = readPreference(root);
  const mobileCollapsed = root.dataset.navigationLayoutId === 'outline-assignment'
    && window.matchMedia?.('(max-width: 700px)').matches;
  const state = {
    width: clamp(stored.width || root.dataset.navigationWidth || limits.defaultWidth, limits.min, limits.max),
    collapsed: stored.collapsed === undefined ? (root.classList.contains('navigation-pane-collapsed') || mobileCollapsed) : Boolean(stored.collapsed),
    resizing: false,
    startWidth: null,
  };
  const handle = root.querySelector('[data-navigation-pane-resizer]');
  const toggle = root.querySelector('[data-navigation-pane-toggle]');
  if (!handle && !toggle) return;
  const onPointerMove = event => {
    if (!state.resizing) return;
    const rect = root.getBoundingClientRect();
    state.width = clamp(event.clientX - rect.left, limits.min, limits.max);
    apply(root, state, { dispatch: true });
  };
  const stopResize = commit => {
    if (!state.resizing) return;
    state.resizing = false;
    if (!commit && state.startWidth !== null) state.width = state.startWidth;
    state.startWidth = null;
    apply(root, state, { persist: commit, dispatch: true });
  };
  const onPointerUp = () => stopResize(true);
  handle?.addEventListener('pointerdown', event => {
    if (state.collapsed || event.button !== 0) return;
    state.resizing = true;
    state.startWidth = state.width;
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    apply(root, state, { dispatch: false });
  });
  handle?.addEventListener('pointermove', onPointerMove);
  handle?.addEventListener('pointerup', onPointerUp);
  handle?.addEventListener('pointercancel', () => stopResize(false));
  handle?.addEventListener('dblclick', () => {
    state.width = limits.defaultWidth;
    apply(root, state, { persist: true });
    handle.focus();
  });
  handle?.addEventListener('keydown', event => {
    if (state.collapsed) return;
    const step = event.shiftKey ? 48 : 16;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      state.width = clamp(state.width + (event.key === 'ArrowRight' ? step : -step), limits.min, limits.max);
      apply(root, state, { persist: true });
      handle.focus();
    } else if (event.key === 'Home' || event.key === 'End' || event.key === 'Enter') {
      event.preventDefault();
      state.width = event.key === 'Home' ? limits.min : event.key === 'End' ? limits.max : limits.defaultWidth;
      apply(root, state, { persist: true });
      handle.focus();
    } else if (event.key === 'Escape' && state.resizing) {
      event.preventDefault();
      stopResize(false);
      handle.focus();
    }
  });
  toggle?.addEventListener('click', () => {
    state.collapsed = !state.collapsed;
    apply(root, state, { persist: true });
    if (!state.collapsed) handle?.focus();
  });
  bindings.set(root, { state, stopResize });
  apply(root, state, { dispatch: false });
}

export function enhanceResizableNavigation(root = document) {
  const nodes = root.matches?.('[data-navigation-layout]') ? [root] : [...root.querySelectorAll?.('[data-navigation-layout]') || []];
  nodes.forEach(bind);
}

export function getNavigationPaneState(root) {
  return bindings.get(root)?.state || null;
}
