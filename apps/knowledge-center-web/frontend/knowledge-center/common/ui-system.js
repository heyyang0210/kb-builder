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
  'action.references': 'link',
  'action.refresh': 'refresh-cw',
  'action.search': 'search',
  'action.upload': 'upload',
  'disclosure.expand': 'chevron-right',
  'feedback.error': 'circle-alert',
  'feedback.info': 'info',
  'feedback.negative': 'thumbs-down',
  'feedback.positive': 'thumbs-up',
  'feedback.success': 'circle-check',
  'feedback.warning': 'triangle-alert',
  'navigation.assets': 'library',
  'navigation.cleaning': 'filter',
  'navigation.dashboard': 'layout-dashboard',
  'navigation.notifications': 'bell',
  'navigation.outlines': 'list-tree',
  'navigation.platform': 'settings',
  'navigation.production': 'workflow',
  'navigation.review': 'badge-check',
  'navigation.tasks': 'list-checks',
  'navigation.templates': 'files',
  'state.capability': 'blocks',
});

const escapeAttribute = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

const dataAttributes = data => Object.entries(data).map(([key, value]) => {
  if (!/^[a-z][a-z0-9-]*$/.test(key)) throw new Error(`无效的 data 属性：${key}`);
  return ` data-${key}="${escapeAttribute(value)}"`;
}).join('');

export function uiIcon(usage) {
  const name = UI_ICONS[usage];
  if (!name) throw new Error(`未登记的知识中心图标用途：${usage}`);
  return `<i class="icon" data-lucide="${name}" aria-hidden="true"></i>`;
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
