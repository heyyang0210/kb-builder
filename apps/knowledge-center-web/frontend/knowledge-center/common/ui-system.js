// Semantic icon names are the public API for new knowledge-center UI code.
export const UI_ICONS = Object.freeze({
  'action.add': 'plus',
  'action.back': 'arrow-left',
  'action.close': 'x',
  'action.copy': 'copy',
  'action.delete': 'trash-2',
  'action.download': 'download',
  'action.edit': 'pencil',
  'action.more': 'ellipsis',
  'action.open': 'arrow-up-right',
  'action.logout': 'power',
  'action.references': 'link',
  'action.refresh': 'refresh-cw',
  'action.search': 'search',
  'action.upload': 'upload',
  'action.view': 'eye',
  'action.toggle': 'power',
  'disclosure.expand': 'chevron-right',
  'feedback.error': 'circle-alert',
  'feedback.info': 'info',
  'feedback.negative': 'thumbs-down',
  'feedback.positive': 'thumbs-up',
  'feedback.success': 'circle-check',
  'feedback.warning': 'triangle-alert',
  'navigation.assets': 'library',
  'navigation.account': 'user-round',
  'navigation.cleaning': 'filter',
  'navigation.collapse': 'panel-left',
  'navigation.dashboard': 'layout-dashboard',
  'navigation.hide': 'panel-left-close',
  'navigation.menu': 'menu',
  'navigation.mobileclose': 'x',
  'navigation.notifications': 'bell',
  'navigation.outlines': 'list-tree',
  'navigation.platform': 'settings',
  'navigation.production': 'workflow',
  'navigation.review': 'badge-check',
  'navigation.tasks': 'list-checks',
  'navigation.templates': 'files',
  'navigation.restore': 'panel-left-open',
  'brand.knowledge-center': 'book-open-check',
  'state.capability': 'blocks',
  'source.revision': 'history',
  'source.state': 'power',
  'source.sync': 'refresh-cw',
  'source.type': 'layers',
  'calendar.previous': 'chevron-left',
  'calendar.next': 'chevron-right',
});

const escapeAttribute = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

const dataAttributes = data => Object.entries(data).map(([key, value]) => {
  if (!/^[a-z][a-z0-9-]*$/.test(key)) throw new Error(`无效的 data 属性：${key}`);
  return ` data-${key}="${escapeAttribute(value)}"`;
}).join('');

export function uiIcon(usage, className = 'icon') {
  const name = UI_ICONS[usage];
  if (!name) throw new Error(`未登记的知识中心图标用途：${usage}`);
  return `<i class="${escapeAttribute(className || 'icon')}" data-lucide="${name}" aria-hidden="true"></i>`;
}

export function hydrateSemanticIcons(root) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll('[data-ui-icon-usage]').forEach(node => {
    node.outerHTML = uiIcon(node.dataset.uiIconUsage, node.className);
  });
}

export function uiIconButton({ usage, label, disabled = false, data = {} }) {
  if (!label?.trim()) throw new Error('纯图标按钮必须提供中文可访问名称');
  if (!usage?.startsWith('action.')) throw new Error('纯图标按钮必须使用 action 图标用途');
  return `<button class="icon-button" type="button" aria-label="${escapeAttribute(label)}" title="${escapeAttribute(label)}"${disabled ? ' disabled' : ''}${dataAttributes(data)}>${uiIcon(usage)}</button>`;
}

export function uiButton({ label, variant = 'primary', disabled = false, data = {} }) {
  if (!['primary', 'secondary', 'tertiary'].includes(variant)) throw new Error(`未登记的按钮变体：${variant}`);
  if (!label?.trim()) throw new Error('按钮必须提供可见名称');
  return `<button class="button ${variant}" type="button"${disabled ? ' disabled' : ''}${dataAttributes(data)}>${escapeAttribute(label)}</button>`;
}
