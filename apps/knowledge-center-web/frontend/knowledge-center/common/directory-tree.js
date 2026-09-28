const directoryBindings = new WeakMap();

export function renderDirectoryTree(nodes, options = {}) {
  const childrenOf = options.childrenOf || (node => node?.children || []);
  const isLeaf = options.isLeaf || (node => !childrenOf(node).length);
  const nodeKey = options.nodeKey || ((node, index) => String(node?.id || node?.path || index));
  const renderLeaf = options.renderLeaf || (() => '');
  const renderDirectoryLabel = options.renderDirectoryLabel || (node => String(node?.name || node?.title || '未命名目录'));
  const directoryClass = options.directoryClass || '';
  const listClass = options.listClass || '';
  const openDirectory = options.openDirectory || (() => true);
  const render = (items, depth = 0) => (Array.isArray(items) ? items : []).map((node, index) => {
    if (isLeaf(node)) return renderLeaf(node, index, depth);
    const children = render(childrenOf(node), depth + 1).filter(Boolean).join('');
    if (!children && options.hideEmptyDirectories) return '';
    const label = renderDirectoryLabel(node, depth);
    const hasInteractiveLabel = /<button\b/i.test(label);
    return `<li class="${directoryClass}" data-directory-key="${nodeKey(node, index)}"><details${openDirectory(node, depth) ? ' open' : ''}><summary${hasInteractiveLabel ? '' : ' role="treeitem" tabindex="-1"'}>${label}</summary><ul>${children}</ul></details></li>`;
  });
  const role = options.treeRole === false ? '' : ' role="tree"';
  return `<ul class="${listClass}"${role}>${render(nodes).filter(Boolean).join('')}</ul>`;
}

function directChildren(list) {
  return [...(list?.children || [])].filter(node => node.matches?.('li'));
}

function directLabel(node) {
  const summary = [...(node?.children || [])].find(child => child.matches?.('details'))?.querySelector(':scope > summary');
  if (summary) return summary.textContent || '';
  return [...(node?.children || [])].find(child => child.matches?.('button, label'))?.textContent || '';
}

function filterList(list, query, originalOpen, forceVisible = false) {
  let hasVisible = false;
  for (const item of directChildren(list)) {
    const details = [...item.children].find(child => child.matches?.('details'));
    const nestedList = details?.querySelector(':scope > ul') || [...item.children].find(child => child.matches?.('ul'));
    const ownMatch = forceVisible || !query || directLabel(item).toLocaleLowerCase().includes(query);
    const descendantsMatch = nestedList ? filterList(nestedList, query, originalOpen, ownMatch) : false;
    const visible = ownMatch || descendantsMatch;
    item.hidden = !visible;
    if (details && query) details.open = ownMatch || descendantsMatch;
    if (details && !query && originalOpen.has(details)) details.open = originalOpen.get(details);
    hasVisible ||= visible;
  }
  return hasVisible;
}

function bindDirectoryTree(tree) {
  if (directoryBindings.has(tree)) return;
  const search = tree.querySelector('[data-directory-search]');
  const originalOpen = new Map();
  let filtering = false;
  const topList = () => [...tree.querySelectorAll('ul')].find(list => !list.parentElement.closest('ul')) || tree;
  const isVisible = item => {
    if (!item || item.hidden || item.closest('[hidden]')) return false;
    const parentDetails = item.parentElement?.closest('details');
    return !parentDetails || parentDetails.open;
  };
  const treeItems = () => [...tree.querySelectorAll('[role="treeitem"]')].filter(isVisible);
  const updateTreeItemState = () => {
    tree.querySelectorAll('li > button, li > [data-tree-item]').forEach(item => {
      if (!item.hasAttribute('role')) item.setAttribute('role', 'treeitem');
    });
    const items = [...tree.querySelectorAll('[role="treeitem"]')];
    items.forEach(item => {
      const parent = item.closest('li')?.parentElement?.closest('[role="treeitem"]');
      const level = parent ? Number(parent.getAttribute('aria-level') || 1) + 1 : 1;
      item.setAttribute('aria-level', String(level));
      const details = item.matches('summary') ? item.parentElement : item.closest('details');
      if (details?.querySelector(':scope > ul')) item.setAttribute('aria-expanded', String(Boolean(details.open)));
      item.tabIndex = -1;
    });
    const current = tree.querySelector('[aria-current="page"], [aria-current="true"], .selected > [role="treeitem"]');
    (current || treeItems()[0])?.setAttribute('tabindex', '0');
  };
  const focusItem = (item, { select = false } = {}) => {
    if (!item) return;
    updateTreeItemState();
    item.tabIndex = 0;
    item.focus({ preventScroll: true });
    item.scrollIntoView?.({ block: 'nearest' });
    if (select) item.click();
  };
  tree.addEventListener('click', event => {
    const summary = event.target.closest('summary[role="treeitem"]');
    if (!summary) return;
    requestAnimationFrame(updateTreeItemState);
  });
  tree.addEventListener('keydown', event => {
    const item = event.target.closest('[role="treeitem"]');
    if (!item || !tree.contains(item)) return;
    const items = treeItems();
    const index = items.indexOf(item);
    if (index < 0) return;
    const details = item.closest('details');
    const parentItem = item.closest('li')?.parentElement?.closest('[role="treeitem"]');
    const firstChild = details?.querySelector(':scope > ul > li:not([hidden]) [role="treeitem"]');
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault(); focusItem(items[index + 1] || item); break;
      case 'ArrowUp':
        event.preventDefault(); focusItem(items[index - 1] || item); break;
      case 'ArrowRight':
        event.preventDefault();
        if (details && !details.open) { details.open = true; updateTreeItemState(); }
        else if (firstChild) focusItem(firstChild);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (details?.open) { details.open = false; updateTreeItemState(); }
        else if (parentItem) focusItem(parentItem);
        break;
      case 'Home':
        event.preventDefault(); focusItem(items[0] || item); break;
      case 'End':
        event.preventDefault(); focusItem(items[items.length - 1] || item); break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (item.matches('summary')) { if (details) details.open = !details.open; updateTreeItemState(); }
        else item.click();
        break;
      default: return;
    }
  });
  search?.addEventListener('input', () => {
    const query = String(search.value || '').trim().toLocaleLowerCase();
    if (query && !filtering) {
      originalOpen.clear();
      tree.querySelectorAll('details').forEach(details => originalOpen.set(details, details.open));
      filtering = true;
    }
    filterList(topList(), query, originalOpen);
    updateTreeItemState();
    if (!query && filtering) {
      filtering = false;
      originalOpen.clear();
    }
  });
  directoryBindings.set(tree, { search });
  requestAnimationFrame(() => {
    const current = tree.querySelector('[aria-current="page"], [aria-current="true"], .selected > button, .is-selected');
    let parent = current?.closest('details');
    while (parent) {
      parent.open = true;
      parent = parent.parentElement?.closest('details');
    }
    current?.scrollIntoView?.({ block: 'nearest' });
    updateTreeItemState();
  });
}

export function enhanceDirectoryTrees(root = document) {
  const trees = root.matches?.('[data-directory-tree]')
    ? [root]
    : [...root.querySelectorAll?.('[data-directory-tree]') || []];
  trees.forEach(bindDirectoryTree);
}
