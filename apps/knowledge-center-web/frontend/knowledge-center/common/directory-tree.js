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
    return `<li class="${directoryClass}" data-directory-key="${nodeKey(node, index)}"><details${openDirectory(node, depth) ? ' open' : ''}><summary>${renderDirectoryLabel(node, depth)}</summary><ul>${children}</ul></details></li>`;
  });
  return `<ul class="${listClass}">${render(nodes).filter(Boolean).join('')}</ul>`;
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
  search?.addEventListener('input', () => {
    const query = String(search.value || '').trim().toLocaleLowerCase();
    if (query && !filtering) {
      originalOpen.clear();
      tree.querySelectorAll('details').forEach(details => originalOpen.set(details, details.open));
      filtering = true;
    }
    const topList = [...tree.querySelectorAll('ul')].find(list => !list.parentElement.closest('ul'));
    filterList(topList || tree, query, originalOpen);
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
  });
}

export function enhanceDirectoryTrees(root = document) {
  const trees = root.matches?.('[data-directory-tree]')
    ? [root]
    : [...root.querySelectorAll?.('[data-directory-tree]') || []];
  trees.forEach(bindDirectoryTree);
}
