import { dataNote, pendingState } from '../../common/components/ui.js';
import { escapeHtml } from '../../common/utils/dom.js';

const firstDefined = (...values) => values.find(value => value !== undefined && value !== null);
const businessStatusLabels = { incomplete: '待完善', review: '待评审', published: '已发布' };
const stages = [
  { key: 'tree', label: '目录' }, { key: 'responsibility', label: '责任' }, { key: 'templates', label: '模板' },
  { key: 'changes', label: '检查' }, { key: 'publish', label: '发布' },
];

function identity(item = {}) {
  const state = firstDefined(item.status, item.state);
  const statusKey = ['published', 'superseded', 'archived'].includes(state)
    ? 'published'
    : ['pending_confirmation', 'confirmed'].includes(state) ? 'review' : 'incomplete';
  return {
    name: firstDefined(item.name, item.title, item.manualName, '未命名大纲'),
    product: firstDefined(item.productDisplayName, item.productName, item.product?.displayName, item.productId),
    versions: firstDefined(item.businessVersionTags, item.applicableVersionTags, item.businessVersions, []),
    outlineVersion: firstDefined(item.outlineVersion, item.outlineStructureVersion, item.structureVersion, item.version),
    state, statusKey, status: businessStatusLabels[statusKey],
    updated: firstDefined(item.updatedAt, item.modifiedAt, item.updated_at),
    issues: Number(firstDefined(item.pendingIssueCount, item.issueCount, item.impact?.issues?.length, item.preflight?.blockingCount, 0)),
  };
}

function owner(item, role) {
  return (role === 'primary' ? (item.primaryOwnerId || item.primaryOwner?.userId) : (item.assistantOwnerId || item.assistantOwner?.userId)) || '待绑定';
}

function labels(values) {
  const items = Array.isArray(values) ? values : values ? [values] : [];
  if (!items.length) return '<span class="muted">未设置</span>';
  return `<span class="outline-tags">${items.map(value => `<span class="status">${escapeHtml(typeof value === 'object' ? firstDefined(value.displayName, value.name, value.id) : value)}</span>`).join('')}</span>`;
}

function nextAction(state) {
  return ({ parsing: '查看解析进度', preflight_failed: '修复问题', pending_confirmation: '查看目录差异', confirmed: '查看发布准备', published: '查看已发布目录', draft: '继续完善' }[state] || '查看目录');
}

const actionStage = state => ({ preflight_failed: 'changes', confirmed: 'publish' }[state] || 'tree');

function canDelete(item) {
  return !item.readOnly && !['published', 'superseded'].includes(item.state || item.status);
}

function list(items, filters = {}, permissions = {}) {
  const stats = items.reduce((summary, item) => {
    const value = identity(item); summary.pending += value.issues;
    summary[value.statusKey] += 1;
    return summary;
  }, { pending: 0, incomplete: 0, review: 0, published: 0 });
  const query = String(filters.search || '');
  const status = String(filters.status || '');
  let visibleRows = 0;
  const rows = items.map(item => {
    const value = identity(item);
    const id = item.handbookId || item.id || item.outlineId;
    const searchText = `${value.name} ${id || ''} ${value.product || ''}`.toLowerCase();
    const hidden = Boolean((query && !searchText.includes(query.toLowerCase())) || (status && value.statusKey !== status));
    if (!hidden) visibleRows += 1;
    return `<tr data-outline-row data-outline-state="${escapeHtml(value.statusKey)}" data-outline-search-text="${escapeHtml(searchText)}"${hidden ? ' hidden' : ''}>
      <td><a class="outline-list-link" href="/knowledge-center/outlines/${encodeURIComponent(id || '')}" data-outline-id="${escapeHtml(id || '')}"><strong title="${escapeHtml(value.name)}">${escapeHtml(value.name)}</strong><small>${escapeHtml(id || '未编号')}</small></a></td>
      <td>${escapeHtml(value.product || '未设置')}<small>${labels(value.versions)}</small></td><td><span class="status">${escapeHtml(value.status || '未提供')}</span></td>
      <td>${value.issues ? `<strong>${value.issues} 项</strong>` : '<span class="muted">待检查</span>'}</td><td>${escapeHtml(value.updated ? new Date(value.updated).toLocaleDateString('zh-CN') : '未提供')}</td>
      <td><div class="outline-row-actions"><a class="button compact" href="/knowledge-center/outlines/${encodeURIComponent(id || '')}" data-outline-id="${escapeHtml(id || '')}">${nextAction(value.state)}</a>${permissions.delete && canDelete(item) ? `<button class="button compact danger" type="button" data-outline-delete="${escapeHtml(item.id || '')}" data-outline-delete-name="${escapeHtml(value.name)}"><i data-lucide="trash-2" aria-hidden="true"></i>删除</button>` : ''}</div></td></tr>`;
  }).join('');
  return `<section class="outline-list" aria-labelledby="outline-list-title"><h2 id="outline-list-title" class="sr-only">手册大纲列表</h2>
    <div class="outline-list-summary" aria-label="大纲概况"><div><strong>${items.length}</strong><span>份大纲</span></div><div><strong>${stats.pending || '暂无'}</strong><span>待处理问题</span></div><div><strong>${stats.incomplete || '暂无'}</strong><span>待完善</span></div><div><strong>${stats.review || '暂无'}</strong><span>待评审</span></div><div><strong>${stats.published || '暂无'}</strong><span>已发布</span></div></div>
    <div class="outline-list-toolbar"><label for="outline-search">搜索手册</label><input id="outline-search" type="search" value="${escapeHtml(query)}" placeholder="手册名称或编号" data-outline-search><label for="outline-status-filter">状态</label><select id="outline-status-filter" data-outline-status-filter><option value="">全部</option>${Object.entries(businessStatusLabels).map(([key, label]) => `<option value="${key}"${status === key ? ' selected' : ''}>${label}</option>`).join('')}</select></div>
    <div class="outline-table-wrap"><table class="outline-table"><caption class="sr-only">手册大纲及状态</caption><thead><tr><th>手册</th><th>产品 / 业务版本</th><th>状态</th><th>待处理</th><th>更新时间</th><th>下一步</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="outline-filter-empty" data-outline-filter-empty${visibleRows ? ' hidden' : ''}>没有符合当前条件的大纲。</div></section>`;
}

function tree(items, depth = 0) {
  if (!Array.isArray(items) || !items.length) return '';
  const ordered = [...items].sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
  return `<ul class="outline-tree-level depth-${Math.min(depth, 3)}">${ordered.map(item => {
    const children = firstDefined(item.children, item.nodes, item.chapters, item.knowledgePoints, []);
    const number = escapeHtml(firstDefined(item.sourceId, item.number, item.code, ''));
    const title = escapeHtml(firstDefined(item.title, item.name, item.displayName, item.code, '未命名目录条目'));
    const description = item.description ? `<small class="outline-tree-description">${escapeHtml(item.description)}</small>` : '';
    const kind = ({ part: '部分', chapter: '章节', knowledge_point: '知识点', section: '章节' })[item.kind] || '';
    const content = `<span class="outline-tree-code">${number}</span><strong>${title}</strong>${kind ? `<small class="outline-tree-kind">${kind}</small>` : ''}${item.status ? `<small>${escapeHtml(item.statusDisplayName || item.status)}</small>` : ''}${description}`;
    return children.length ? `<li><details${depth === 0 ? ' open' : ''}><summary class="outline-tree-node">${content}</summary>${tree(children, depth + 1)}</details></li>` : `<li><div class="outline-tree-node outline-tree-leaf">${content}</div></li>`;
  }).join('')}</ul>`;
}

function hierarchy(items) {
  if (!Array.isArray(items) || !items.some(item => item.parentId)) return items;
  const byId = new Map(items.map(item => [item.id, { ...item, children: [] }])); const roots = [];
  for (const item of byId.values()) { const parent = byId.get(item.parentId); parent ? parent.children.push(item) : roots.push(item); }
  return roots;
}

function responsibility(value) {
  if (!value || value.status === 'not_created') return pendingState('责任映射待创建', '当前大纲还没有持久化的责任映射版本。');
  const summary = value.summary || {};
  return `<dl class="outline-context"><div><dt>已映射知识点</dt><dd>${escapeHtml(firstDefined(summary.mappedKnowledgePoints, 0))} / ${escapeHtml(firstDefined(summary.totalKnowledgePoints, 0))}</dd></div></dl>`;
}

function templates(value) {
  const items = Array.isArray(value?.items) ? value.items : Array.isArray(value) ? value : [];
  if (!items.length) return pendingState('模板绑定待创建', '选择知识点后配置模板。');
  return `<div class="outline-mapping-list">${items.map(item => `<div class="outline-mapping-row"><strong>${escapeHtml(item.knowledgePointTitle || item.nodeTitle || '知识点')}</strong><span>${escapeHtml(item.templateType || '模板类型待设置')}</span><span>${escapeHtml(item.templateVersionId || '模板版本待设置')}</span></div>`).join('')}</div>`;
}

function detail(item, projection, activeStage, permissions = {}) {
  const value = identity(item);
  const nodes = hierarchy(firstDefined(item.nodes, item.tree, item.chapters, item.content?.parts, []));
  const directory = tree(nodes) ? `<div class="outline-tree-toolbar" aria-label="目录展开控制"><button class="button tertiary compact" type="button" data-outline-tree-expand="true">全部展开</button><button class="button tertiary compact" type="button" data-outline-tree-expand="false">全部收起</button></div>${tree(nodes)}` : pendingState('目录暂不可用', '当前大纲未返回目录数据。');
  const bodies = { tree: directory, responsibility: responsibility(item.responsibility), templates: templates(item.templates || item.templateBindings), changes: pendingState('发布门禁', '请先补充产品与业务版本，再查看系统检查结果。'), publish: pendingState('发布准备', '检查通过后才能发布大纲版本。') };
  return `<div class="outline-detail-shell"><a class="outline-back" href="/knowledge-center/outlines" data-outline-back><i data-lucide="arrow-left" aria-hidden="true"></i>返回大纲列表</a>
    <header class="outline-detail-header"><div class="outline-detail-title"><p class="eyebrow">当前处理</p><h2>${escapeHtml(value.name)}</h2><p>大纲版本：${escapeHtml(value.outlineVersion || '尚未建立')}</p></div><div class="outline-detail-actions"><span class="status">${escapeHtml(value.status || '状态未提供')}</span><button class="button secondary" type="button" data-outline-info-toggle aria-controls="outline-handbook-info" aria-expanded="false"><i data-lucide="info" aria-hidden="true"></i>手册信息</button>${permissions.delete && canDelete(item) ? `<button class="button danger" type="button" data-outline-delete="${escapeHtml(item.id || '')}" data-outline-delete-name="${escapeHtml(value.name)}"><i data-lucide="trash-2" aria-hidden="true"></i>删除候选</button>` : ''}<button class="button" type="button" data-outline-stage-target="${actionStage(value.state)}">${nextAction(value.state)}</button></div></header>
    ${value.issues ? `<p class="outline-issue-summary" role="status">还有 <strong>${value.issues}</strong> 项待处理问题</p>` : ''}
    <div class="outline-stagebar" role="tablist" aria-label="大纲处理阶段">${stages.map((stage, index) => { const active = stage.key === activeStage; return `<button id="outline-tab-${stage.key}" class="tab${active ? ' active' : ''}" type="button" role="tab" aria-selected="${active}" aria-controls="outline-panel-${stage.key}" tabindex="${active ? 0 : -1}" data-outline-tab="${stage.key}"><span>${index + 1}</span>${stage.label}</button>`; }).join('')}</div>
    <section class="outline-stage-canvas">${stages.map(stage => `<div id="outline-panel-${stage.key}" role="tabpanel" aria-labelledby="outline-tab-${stage.key}" data-outline-panel="${stage.key}"${stage.key === activeStage ? '' : ' hidden'}>${bodies[stage.key]}</div>`).join('')}</section>${dataNote(projection)}
    <div class="outline-info-overlay" data-outline-info-close hidden></div><aside id="outline-handbook-info" class="outline-info-drawer" aria-labelledby="outline-info-title" hidden><div class="outline-info-heading"><h3 id="outline-info-title">手册信息</h3><button class="icon-button" type="button" data-outline-info-close aria-label="关闭手册信息" title="关闭手册信息"><i data-lucide="x" aria-hidden="true"></i></button></div><dl class="outline-context"><div><dt>适用产品</dt><dd>${escapeHtml(value.product || '未设置')}</dd></div><div><dt>业务版本</dt><dd>${labels(value.versions)}</dd></div><div><dt>A 角</dt><dd>${escapeHtml(owner(item, 'primary'))}</dd></div><div><dt>B 角</dt><dd>${escapeHtml(owner(item, 'assistant'))}</dd></div></dl></aside></div>`;
}

function importArea() {
  return `<details class="outline-import"><summary class="button secondary"><i data-lucide="upload" aria-hidden="true"></i>导入大纲</summary><form class="outline-actions" data-outline-import><label for="outline-import-file"><strong>选择 Markdown、JSON 或 CSV 文件（可多选）</strong><input id="outline-import-file" name="file" type="file" accept=".md,.markdown,.json,.csv" multiple required></label><button class="button secondary" type="submit">导入候选</button><span class="muted" data-outline-import-status aria-live="polite"></span><ol class="outline-import-results" data-outline-import-results aria-live="polite"></ol></form></details>`;
}

function renderOutlinesLegacy({ outlineProjection: source, outlineView = {}, outlinePermissions = {} }) {
  const items = Array.isArray(source?.items) ? source.items : [];
  if (outlineView.isDetail) {
    const back = '<a class="outline-back" href="/knowledge-center/outlines" data-outline-back><i data-lucide="arrow-left" aria-hidden="true"></i>返回大纲列表</a>';
    if (!source) return pendingState('正在读取大纲', '正在请求大纲治理服务。');
    if (source.status === 'not_found') return `${back}${pendingState('手册不存在', '该手册可能已删除，或链接已失效。')}`;
    if (source.status !== 'ok') return `${back}${pendingState(source.status === 'forbidden' ? '无权查看大纲' : '大纲服务不可用', source.error?.message || '请稍后重试。')}`;
    return detail(source.detail, { asOf: source.asOf }, outlineView.activeStage, outlinePermissions);
  }
  let body;
  if (!source) body = pendingState('正在读取大纲', '正在请求大纲治理服务。');
  else if (source.status !== 'ok') body = pendingState(source.status === 'forbidden' ? '无权查看大纲' : '大纲服务不可用', source.error?.message || '请稍后重试。');
  else if (!items.length) body = pendingState('尚无大纲', '当前没有可展示的大纲，请导入文件创建候选版本。');
  else body = list(items, outlineView.listState, outlinePermissions);
  const accessNote = outlinePermissions.create || outlinePermissions.delete ? '' : '<p class="outline-readonly-note" role="note"><i data-lucide="lock" aria-hidden="true"></i>当前为只读模式，仅平台管理员可新增或删除大纲。</p>';
  return `<div class="page-intro outline-list-intro"><div><p class="eyebrow">手册结构治理</p><h2>大纲管理</h2><p class="muted">查找手册并继续处理大纲。</p></div>${outlinePermissions.create ? importArea() : ''}</div>${accessNote}${body}${source?.asOf ? dataNote({ asOf: source.asOf }) : ''}`;
}

export function renderOutlines(args) {
  return renderOutlinesLegacy(args).replace('<p class="eyebrow">手册结构治理</p>', '').replace('<p class="muted">查找手册并继续处理大纲。</p>', '');
}
