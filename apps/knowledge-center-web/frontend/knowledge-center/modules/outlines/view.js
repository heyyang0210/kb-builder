import { dataNote, pendingState } from '../../common/components/ui.js';
import { escapeHtml } from '../../common/utils/dom.js';
import { renderDirectoryTree } from '../../common/directory-tree.js';

const firstDefined = (...values) => values.find(value => value !== undefined && value !== null);
const businessStatusLabels = { incomplete: '待完善', review: '待评审', published: '已发布' };

function identity(item = {}) {
  const state = String(firstDefined(item.status, item.state, '')).toLowerCase();
  const statusKey = ['published', 'superseded', 'archived'].includes(state)
    ? 'published'
    : ['pending_confirmation', 'confirmed'].includes(state) ? 'review' : 'incomplete';
  return {
    name: firstDefined(item.name, item.title, item.manualName, '未命名大纲'),
    product: firstDefined(item.productDisplayName, item.productName, item.product?.name, item.product?.displayName, item.productId, '未指定产品'),
    versions: firstDefined(item.businessVersionTags, item.applicableVersionTags, item.businessVersions, []),
    outlineVersion: firstDefined(item.outlineVersion, item.outlineStructureVersion, item.structureVersion, item.version),
    state, statusKey, status: businessStatusLabels[statusKey],
    updated: firstDefined(item.updatedAt, item.modifiedAt, item.updated_at),
  };
}

function owner(item, role) {
  return (role === 'primary' ? (item.primaryOwnerId || item.primaryOwner?.userId) : (item.assistantOwnerId || item.assistantOwner?.userId)) || '待绑定';
}

function labels(values) {
  const items = (Array.isArray(values) ? values : values ? [values] : []).filter(value => value !== null && value !== undefined && value !== '');
  if (!items.length) return '<span class="muted">未设置</span>';
  return `<span class="outline-tags">${items.map(value => `<span class="status">${escapeHtml(value && typeof value === 'object' ? firstDefined(value.displayName, value.name, value.id) : value)}</span>`).join('')}</span>`;
}

function canDelete(item) {
  return !item.readOnly && !item.deletedAt;
}

function list(items, filters = {}, permissions = {}) {
  const stats = items.reduce((summary, item) => {
    const value = identity(item);
    summary[value.statusKey] += 1;
    return summary;
  }, { incomplete: 0, review: 0, published: 0 });
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
      <td data-table-column="name"><a class="outline-list-link asset-name" href="/knowledge-center/outlines/${encodeURIComponent(id || '')}" data-outline-id="${escapeHtml(id || '')}"><strong title="${escapeHtml(value.name)}">${escapeHtml(value.name)}</strong></a></td>
      <td data-table-column="product">${escapeHtml(value.product)}</td><td data-table-column="status"><span class="status">${escapeHtml(value.status || '未提供')}</span></td>
      <td data-table-column="updated">${escapeHtml(value.updated ? new Date(value.updated).toLocaleDateString('zh-CN') : '未提供')}</td></tr>`;
  }).join('');
  return `<section class="outline-list" aria-labelledby="outline-list-title"><h2 id="outline-list-title" class="sr-only">手册大纲列表</h2>
    <div class="outline-list-summary" aria-label="大纲概况"><div><strong>${items.length}</strong><span>份大纲</span></div><div><strong>${stats.incomplete || '暂无'}</strong><span>待完善</span></div><div><strong>${stats.review || '暂无'}</strong><span>待评审</span></div><div><strong>${stats.published || '暂无'}</strong><span>已发布</span></div></div>
    <div class="outline-list-toolbar"><label for="outline-search">搜索手册</label><input id="outline-search" type="search" value="${escapeHtml(query)}" placeholder="手册名称或编号" data-outline-search><label for="outline-status-filter">状态</label><select id="outline-status-filter" data-outline-status-filter><option value="">全部</option>${Object.entries(businessStatusLabels).map(([key, label]) => `<option value="${key}"${status === key ? ' selected' : ''}>${label}</option>`).join('')}</select></div>
    <div class="outline-table-wrap"><table class="outline-table" data-table-view-id="outline-catalog" data-table-view-schema="1" data-table-view-label="手册大纲"><caption class="sr-only">手册大纲及状态</caption><thead><tr><th data-table-column="name" data-table-column-required="true" data-table-column-label="手册">手册</th><th data-table-column="product" data-table-column-label="产品">产品</th><th data-table-column="status" data-table-column-label="状态">状态</th><th data-table-column="updated" data-table-column-label="更新时间">更新时间</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="outline-filter-empty" data-outline-filter-empty${visibleRows ? ' hidden' : ''}>没有符合当前条件的大纲。</div></section>`;
}

function templateDownloadLink() {
  return '<span class="outline-template-actions"><a class="button secondary" href="/knowledge-center/api/outline/template" download="大纲模板.xlsx" data-outline-template-download><i data-lucide="download" aria-hidden="true"></i>下载大纲模板</a><a class="button secondary" href="/knowledge-center/api/outline/sample" download="SQL参考手册大纲示例.xlsx" data-outline-sample-download><i data-lucide="file-spreadsheet" aria-hidden="true"></i>下载SQL参考手册示例</a><button class="icon-button outline-template-help" type="button" aria-label="查看大纲模板字段填写说明" title="查看大纲模板字段填写说明" aria-expanded="false" data-outline-template-help><i data-lucide="help-circle" aria-hidden="true"></i></button></span>';
}

function templateHelpPanel() {
  return `<aside class="outline-template-help-panel" data-outline-template-help-panel hidden aria-labelledby="outline-template-help-title"><div class="outline-template-help-heading"><h3 id="outline-template-help-title">大纲模板填写说明</h3><button class="icon-button" type="button" data-outline-template-help-close aria-label="关闭大纲模板填写说明" title="关闭"><i data-lucide="x" aria-hidden="true"></i></button></div><dl class="outline-template-help-list"><div><dt>路径层级1</dt><dd>填写手册根目录下的文件夹或文件名称，必填。手册根目录本身不占层级。</dd></div><div><dt>路径层级2</dt><dd>填写上一层文件夹下的名称；若第1层已是文件，本列及后续列留空。</dd></div><div><dt>路径层级3</dt><dd>继续填写下一层文件夹或文件；每行完整填写祖先路径，不继承上一行空白。</dd></div><div><dt>路径层级4</dt><dd>最多四层，最后一个非空层级必须是 .md 文件；文件可以出现在任意层级。尾部可空，中间不能跳空。</dd></div><div><dt>内容说明</dt><dd>填写当前行文件的覆盖范围、建设目标和可验证重点，不是文档正文；文件名直接作为标题，保留00和.md。</dd></div><div><dt>技术领域分工</dt><dd>填写平台已有领域名称、编码或ID；多个领域可用“、”、逗号、分号或换行分隔。可以暂时留空，发布前必须完成分工。</dd></div></dl><p class="muted">每行一篇文件，Excel从上至下就是文档呈现顺序；同一目录子树放在连续行。同一父目录下名称唯一，不使用合并单元格。</p><p class="muted">根目录必须有且只有一篇00手册名.md，例如00SQL参考手册.md；每个目录下显式填写00目录名.md，且排在该目录其他页面和子目录内容之前。普通页面不额外创建介绍文件。导航按文件夹→文件原样显示。</p><p class="muted">手册名称来自当前手册，不受Excel文件名或Sheet名称影响。可先点击“校验大纲”，按行、列和修改建议修正；校验不创建候选，导入只新增候选，不修改已有大纲。</p></aside>`;
}

function outlineListBack() {
  return '<a class="outline-back" href="/knowledge-center/outlines" data-outline-back><i data-lucide="arrow-left" aria-hidden="true"></i>返回大纲管理</a>';
}

function outlineResources() {
  const help = templateHelpPanel().replace(' hidden aria-labelledby', ' aria-labelledby').replace('data-outline-template-help-panel', 'data-outline-resource-help').replace(/<button class="icon-button" type="button" data-outline-template-help-close.*?<\/button>/, '');
  return `<div class="outline-subpage outline-resources">${outlineListBack()}<header class="outline-subpage-header"><p class="eyebrow">开始之前</p><h2>准备大纲</h2><p>按顺序准备文件，再回到对应手册导入大纲。</p></header><div class="outline-resource-steps"><section class="outline-resource-step"><span class="outline-resource-number">01</span><div><h3>下载正式模板</h3><p>使用六列 XLSX 模板填写目录、页面和技术领域分工。</p><a class="button" href="/knowledge-center/api/outline/template" download="大纲模板.xlsx" data-outline-template-download>下载大纲模板</a></div></section><section class="outline-resource-step"><span class="outline-resource-number">02</span><div><h3>参考填写示例</h3><p>对照同格式的数据库管理手册大纲示例，确认每行如何填写。</p><a class="button secondary" href="/knowledge-center/api/outline/sample" download="基本数据库管理手册大纲示例.xlsx" data-outline-sample-download>下载数据库管理手册示例</a></div></section><section class="outline-resource-step"><span class="outline-resource-number">03</span><div><h3>查看字段说明</h3><p>填写前核对必填列、目录层级与内容说明。</p><div class="outline-resource-help">${help}</div></div></section></div><p class="outline-resource-next">准备完成后，返回大纲管理，进入对应手册导入候选大纲。</p></div>`;
}

function nodeChildren(item = {}) {
  const structural = [item.children, item.nodes, item.chapters].flatMap(value => Array.isArray(value) ? value : []);
  const documents = [item.documents, item.knowledgePoints].flatMap(value => Array.isArray(value) ? value : []);
  return [...new Set([...structural, ...documents])];
}

function nodeTitle(item = {}) {
  return firstDefined(item.title, item.name, item.displayName, item.part, item.code, '未命名目录条目');
}

function isDocumentNode(item = {}) {
  return item.kind === 'document' || item.legacyKind === 'knowledge_point' || item.type === 'document' || Boolean(item.documentId);
}

function documentId(item = {}, index = 0) {
  return String(firstDefined(item.id, item.documentId, item.sourceId, `document-${index + 1}`));
}

function collectDocuments(items, parentPath = [], documents = []) {
  const ordered = Array.isArray(items)
    ? [...items].sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    : [];
  ordered.forEach((item, index) => {
    const title = String(nodeTitle(item));
    if (isDocumentNode(item)) {
      documents.push({
        id: documentId(item, documents.length),
        item,
        path: parentPath.filter(Boolean),
        order: index,
      });
      return;
    }
    collectDocuments(nodeChildren(item), [...parentPath, title], documents);
  });
  return documents;
}

function collectOutlineNodes(items, parentId = null, path = [], nodes = []) {
  (Array.isArray(items) ? items : []).forEach((item, index) => {
    const id = String(firstDefined(item.id, item.documentId, item.sourceId, `outline-node-${nodes.length + 1}`));
    const title = String(nodeTitle(item));
    const document = isDocumentNode(item);
    const entry = { id, item, parentId: parentId ? String(parentId) : null, path, index, document };
    nodes.push(entry);
    if (!document) collectOutlineNodes(nodeChildren(item), id, [...path, title], nodes);
  });
  return nodes;
}

function directChildren(items, selectedId) {
  const nodes = collectOutlineNodes(items);
  const selected = nodes.find(node => node.id === String(selectedId));
  const parentId = selected && !selected.document ? selected.id : (selected?.parentId || null);
  return nodes.filter(node => String(node.parentId || '') === String(parentId || ''));
}

function nodeCompleteness(node, governance) {
  if (node.document) {
    const description = firstDefined(node.item.description, node.item.desc, node.item.body, '');
    const assignment = (governance.effectiveDocumentAssignments || []).find(item => String(item.nodeId || item.documentId) === node.id);
    if (!(assignment?.techDomainIds || []).length) return { label: '待分领域', tone: 'warning' };
    if (!String(description).trim()) return { label: '待完善', tone: 'warning' };
    return { label: '已完善', tone: 'success' };
  }
  const descendants = collectOutlineNodes(nodeChildren(node.item)).filter(item => item.document);
  const incomplete = descendants.filter(item => nodeCompleteness(item, governance).tone !== 'success').length;
  return incomplete ? { label: `待完善 ${incomplete}`, tone: 'warning' } : { label: '已完善', tone: 'success' };
}

function nodeGovernanceFacts(node, governance) {
  const nodes = node.document ? [node] : collectOutlineNodes(nodeChildren(node.item)).filter(child => child.document);
  const domains = Array.isArray(governance.techDomains) ? governance.techDomains : [];
  const assignments = Array.isArray(governance.effectiveDocumentAssignments) ? governance.effectiveDocumentAssignments : [];
  const domainNames = new Set();
  const ownerNames = new Set();
  nodes.forEach(entry => {
    const assignment = assignments.find(item => String(item.nodeId || item.documentId) === String(entry.id) || String(item.documentId) === String(entry.item.sourceId || ''));
    (assignment?.techDomainIds || []).forEach(id => domainNames.add(domains.find(domain => String(domain.id) === String(id))?.name || id));
    const primaryDomainId = String(assignment?.techDomainIds?.[0] || '');
    const primaryOwner = (assignment?.ownerships || []).find(owner => String(owner.techDomainId) === primaryDomainId);
    if (primaryOwner?.assigneeName) ownerNames.add(primaryOwner.assigneeName);
  });
  const status = nodeCompleteness(node, governance);
  return { domains: [...domainNames], owners: [...ownerNames], status, count: nodes.length };
}

function readonlyDocumentPanel(document, governance = {}) {
  const item = document.item;
  const title = nodeTitle(item);
  const description = firstDefined(item.description, item.desc, item.body, '');
  const effective = (governance.effectiveDocumentAssignments || []).find(assignment => String(assignment.nodeId || assignment.documentId) === String(document.id));
  const domains = Array.isArray(governance.techDomains) ? governance.techDomains : [];
  const effectiveText = (effective?.techDomainIds || []).map(id => domains.find(domain => String(domain.id) === String(id))?.name || id).join('、') || '尚未设置';
  const assignments = Array.isArray(governance.assignments) ? governance.assignments : [];
  const explicit = assignments.find(assignment => String(assignment.nodeId) === String(document.id));
  const explicitDomainIds = (explicit?.techDomainIds || []).map(String);
  const primaryDomainId = explicitDomainIds[0] || '';
  const collaboratorIds = new Set(explicitDomainIds.slice(1));
  const primaryOptions = domains.map(domain => `<option value="${escapeHtml(domain.id)}"${String(domain.id) === primaryDomainId ? ' selected' : ''}>${escapeHtml(domain.name || domain.code || domain.id)}</option>`).join('');
  const collaboratorOptions = domains.map(domain => { const id = String(domain.id); return `<label class="outline-domain-option"${id === primaryDomainId ? ' hidden' : ''}><input type="checkbox" data-outline-collaborator-domain value="${escapeHtml(id)}"${collaboratorIds.has(id) ? ' checked' : ''}><span>${escapeHtml(domain.name || domain.code || domain.id)}</span></label>`; }).join('');
  return `<article class="outline-document-panel outline-document-readonly" data-outline-document-panel="${escapeHtml(document.id)}" aria-label="${escapeHtml(title)}"><dl class="outline-document-facts"><div><dt>内容说明</dt><dd><p class="outline-description-readonly" data-outline-description-readonly>${escapeHtml(description || '暂无内容说明')}</p><small>内容说明只读查看；需要修改时使用中栏操作列的铅笔图标。</small></dd></div><div><dt>技术领域分工</dt><dd><fieldset class="outline-domain-fieldset" data-outline-domain-group="${escapeHtml(document.id)}"><legend class="sr-only">为 ${escapeHtml(title)} 设置技术领域</legend><label class="outline-primary-domain"><span>主责技术领域</span><select data-outline-primary-domain><option value="">请选择主责技术领域</option>${primaryOptions}</select></label><div class="outline-collaborator-domains"><span>协作技术领域</span><div class="outline-domain-options">${collaboratorOptions || '<span class="muted">暂无技术领域配置</span>'}</div></div><small>当前有效分工：${escapeHtml(effectiveText)}。</small></fieldset></dd></div></dl></article>`;
}

function descriptionEditDialog(governance) {
  const published = String(governance.state || '').toLowerCase() === 'published';
  return `<dialog class="outline-description-dialog" data-outline-description-dialog data-outline-published="${published}" aria-labelledby="outline-description-dialog-title" data-scroll-region="dialog"><form><header><div><span class="eyebrow">更新内容说明</span><h3 id="outline-description-dialog-title" data-outline-description-title>内容说明</h3></div><button class="icon-button" type="button" data-outline-description-close aria-label="关闭内容说明编辑" title="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header><label for="outline-description-dialog-input">内容说明<textarea id="outline-description-dialog-input" rows="10" data-outline-description-draft${published ? ' readonly' : ''}></textarea></label><p class="muted">${published ? '已发布大纲的内容说明不可修改，请创建新的候选版本。' : '保存后只更新大纲页面说明，不修改正文。'}</p><footer><span class="outline-dialog-status" data-outline-description-status role="status"></span><button class="button secondary" type="button" data-outline-description-close>取消</button><button class="button" type="button" data-outline-description-save${published ? ' disabled' : ''}>保存说明</button></footer></form></dialog>`;
}

function nodeInspector(node, governance) {
  if (!node) return '<aside class="outline-node-inspector" data-outline-node-inspector><div class="outline-inspector-empty"><i data-lucide="mouse-pointer-2" aria-hidden="true"></i><h3>选择一个节点</h3><p>从左侧目录或中间清单选择节点，查看治理属性。</p></div></aside>';
  const item = node.item;
  const title = nodeTitle(item);
  const status = nodeCompleteness(node, governance);
  if (!node.document) {
    const children = nodeChildren(item);
    const documents = collectOutlineNodes(children).filter(child => child.document).length;
    return `<aside class="outline-node-inspector" data-outline-node-inspector><header><span class="eyebrow">目录节点</span><h3>${escapeHtml(title)}</h3><span class="outline-node-status ${status.tone}">${escapeHtml(status.label)}</span></header><dl class="outline-inspector-facts"><div><dt>所属路径</dt><dd>${escapeHtml(node.path.join(' / ') || '手册根目录')}</dd></div><div><dt>直接子节点</dt><dd>${children.length} 个</dd></div><div><dt>文档页面</dt><dd>${documents} 篇</dd></div><div><dt>说明</dt><dd>${escapeHtml(firstDefined(item.description, item.desc, '暂无目录说明'))}</dd></div></dl><p class="muted">目录只负责组织层级；内容生产配置由下游文档生产流程管理。</p></aside>`;
  }
  const document = { id: node.id, item };
  return `<aside class="outline-node-inspector" data-outline-node-inspector>${readonlyDocumentPanel(document, governance)}</aside>`;
}

function nodeList(items, selectedId, governance, filterUnassigned) {
  const children = directChildren(items, selectedId).filter(node => !filterUnassigned || (node.document && nodeCompleteness(node, governance).label === '待分领域'));
  const columns = ['chapter', 'kind', 'status', 'domain', 'owner', 'actions'];
  const columnLabels = { chapter: '章节名称', kind: '类型', status: '状态', domain: '技术领域', owner: '主责负责人', actions: '操作' };
  return `<section class="outline-node-list" aria-label="大纲结构"><header><div><span class="eyebrow">当前目录</span><h2>大纲结构</h2><p class="muted">按章节名称、领域和主责负责人定位内容。</p></div><div class="outline-node-list-tools"><label class="outline-filter-field"><span class="sr-only">查询章节名称</span><input type="search" placeholder="查询章节名称" aria-label="查询章节名称" data-outline-node-search></label><label class="outline-filter-field"><span class="sr-only">按技术领域筛选</span><select aria-label="按技术领域筛选" data-outline-node-domain-filter><option value="">全部领域</option>${[...new Set(children.flatMap(node => nodeGovernanceFacts(node, governance).domains))].map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}</select></label><label class="outline-filter-field"><span class="sr-only">按主责负责人筛选</span><select aria-label="按主责负责人筛选" data-outline-node-owner-filter><option value="">全部主责负责人</option>${[...new Set(children.flatMap(node => nodeGovernanceFacts(node, governance).owners))].map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}</select></label></div></header><div class="outline-node-table-wrap"><table class="outline-node-table" data-table-view-id="outline-structure" data-table-view-schema="2" data-table-view-label="大纲结构"><thead><tr>${columns.map(key => `<th data-outline-column="${key}" data-table-column="${key}" data-table-column-required="${key === 'chapter' || key === 'actions'}" data-table-column-label="${columnLabels[key]}">${columnLabels[key]}</th>`).join('')}</tr></thead><tbody>${children.map(node => { const facts = nodeGovernanceFacts(node, governance); const domainText = facts.domains.length ? facts.domains.join('、') : '未分配'; const ownerText = facts.owners.length ? facts.owners.join('、') : '待分派'; return `<tr data-outline-node-row data-outline-node-id="${escapeHtml(node.id)}" data-outline-node-kind="${node.document ? 'document' : 'directory'}" data-outline-node-search="${escapeHtml(nodeTitle(node.item).toLowerCase())}" data-outline-node-domain="${escapeHtml(domainText)}" data-outline-node-owner="${escapeHtml(ownerText)}"><td data-outline-column="chapter" data-table-column="chapter"><button type="button" class="outline-node-row-button${node.id === String(selectedId) ? ' is-selected' : ''}" data-outline-node="${escapeHtml(node.id)}" data-outline-node-kind="${node.document ? 'document' : 'directory'}"><i data-lucide="${node.document ? 'file-text' : 'folder'}" aria-hidden="true"></i><span>${escapeHtml(nodeTitle(node.item))}</span></button></td><td data-outline-column="kind" data-table-column="kind">${node.document ? '文档' : '目录'}</td><td data-outline-column="status" data-table-column="status"><span class="outline-node-status ${facts.status.tone}">${escapeHtml(facts.status.label)}</span></td><td data-outline-column="domain" data-table-column="domain">${escapeHtml(domainText)}</td><td data-outline-column="owner" data-table-column="owner">${escapeHtml(ownerText)}</td><td data-outline-column="actions" data-table-column="actions">${node.document ? `<button class="icon-button outline-description-edit" type="button" data-outline-description-edit="${escapeHtml(node.id)}" aria-label="编辑 ${escapeHtml(nodeTitle(node.item))} 的内容说明" title="编辑内容说明"><i data-lucide="pencil" aria-hidden="true"></i></button>` : '<span class="muted">—</span>'}</td></tr>`; }).join('')}</tbody></table><div class="outline-node-filter-empty" data-outline-node-filter-empty hidden>没有符合筛选条件的章节。</div></div></section>`;
}

function containsDocument(items, selectedId) {
  return collectDocuments(items).some(item => item.id === selectedId);
}

function filteredOutlineTree(items, missingIds, filterUnassigned) {
  return (Array.isArray(items) ? items : []).map(item => {
    if (isDocumentNode(item)) return !filterUnassigned || missingIds.has(documentId(item)) ? item : null;
    const children = filteredOutlineTree(nodeChildren(item), missingIds, filterUnassigned);
    return children.length ? { ...item, children } : null;
  }).filter(Boolean);
}

function directoryChoiceTree(items) {
  const buildDirectories = values => (Array.isArray(values) ? values : [])
    .filter(item => !isDocumentNode(item))
    .map(item => ({ ...item, children: buildDirectories(nodeChildren(item)) }));
  const directories = buildDirectories(items);
  return renderDirectoryTree(directories, {
    listClass: 'outline-move-directory-list', directoryClass: 'outline-move-directory',
    childrenOf: node => node.children || [], isLeaf: () => false,
    nodeKey: node => String(node.id || nodeTitle(node)),
    renderDirectoryLabel: node => `<label><input type="radio" name="outline-target-directory" value="${escapeHtml(String(node.id || ''))}"><span>${escapeHtml(nodeTitle(node))}</span></label>`,
  });
}

function outlineNavigation(items, selectedId, governance) {
  const allDocuments = collectDocuments(items);
  const documents = allDocuments;
  if (!allDocuments.length) return pendingState('目录暂不可用', '当前大纲未返回 document 叶子节点。');
  const allNodes = collectOutlineNodes(items);
  const selected = allNodes.some(item => item.id === String(selectedId)) ? String(selectedId) : (allDocuments[0]?.id || allNodes[0]?.id || null);
  const selectedNode = allNodes.find(item => item.id === selected);
  const tree = filteredOutlineTree(items, new Set(), false);
  const navigation = renderDirectoryTree(tree, {
    listClass: 'review-document-tree-list outline-navigation-root', directoryClass: 'outline-navigation-group',
    childrenOf: node => nodeChildren(node), isLeaf: node => isDocumentNode(node),
    nodeKey: node => String(node.id || nodeTitle(node)),
    openDirectory: node => containsDocument(nodeChildren(node), selected),
    renderDirectoryLabel: node => `<button type="button" class="outline-navigation-group-button${String(node.id) === selected ? ' is-selected' : ''}" data-outline-directory="${escapeHtml(String(node.id || nodeTitle(node)))}" data-outline-node="${escapeHtml(String(node.id || nodeTitle(node)))}"><i data-lucide="folder" aria-hidden="true"></i><span>${escapeHtml(nodeTitle(node))}</span></button>`,
    renderLeaf: node => {
      const id = documentId(node); const isSelected = id === selected;
      return `<li class="${isSelected ? 'selected' : ''}" data-outline-tree-item data-outline-node-id="${escapeHtml(id)}"><button class="outline-navigation-document-button" type="button" data-outline-document="${escapeHtml(id)}" data-outline-node="${escapeHtml(id)}" data-outline-node-kind="document" aria-current="${isSelected ? 'page' : 'false'}" aria-haspopup="menu"><span>${escapeHtml(nodeTitle(node))}</span></button></li>`;
    }
  });
  return `<div class="outline-governance-workbench" data-navigation-layout data-navigation-layout-id="outline-overview" data-navigation-pane-label="手册目录" data-navigation-min="240" data-navigation-max="380" data-navigation-default="280" data-navigation-width-variable="--outline-directory-width" style="--outline-directory-width:280px"><nav class="outline-navigation review-document-tree" data-navigation-pane data-directory-tree aria-label="手册目录导航" data-scroll-region="panel"><header class="outline-navigation-header"><div><h3>手册目录</h3><span>${documents.length} 篇文档</span></div><div class="outline-navigation-toolbar" aria-label="目录视图控制"><label class="outline-navigation-search"><span class="sr-only">搜索目录</span><input type="search" placeholder="搜索目录或文档" data-directory-search data-outline-directory-search></label><button class="icon-button outline-tree-toggle" type="button" data-outline-tree-toggle aria-label="展开全部目录" title="展开全部目录" data-outline-tree-expanded="false"><i data-lucide="chevrons-down" aria-hidden="true"></i></button><button class="icon-button outline-directory-collapse" type="button" data-navigation-pane-toggle aria-label="收起手册目录" title="收起手册目录"><i data-lucide="panel-left-close" aria-hidden="true"></i></button></div></header><div class="outline-navigation-scroll" data-scroll-region="panel">${navigation}</div><div class="outline-navigation-resizer" data-navigation-pane-resizer role="separator" aria-orientation="vertical" aria-label="调整手册目录宽度" aria-valuemin="240" aria-valuemax="380" aria-valuenow="280" tabindex="0"></div></nav>${nodeList(items, selected, governance, false)}${nodeInspector(selectedNode, governance)}<div class="outline-stage-actions"><button type="button" hidden data-outline-governance-save>保存</button><span class="outline-governance-status" role="status">已保存</span></div><div class="outline-document-context-menu" data-outline-context-menu role="menu" hidden><button type="button" role="menuitem" data-outline-context-edit>编辑内容说明</button><button type="button" role="menuitem" data-outline-move-open>移动到目录</button><button type="button" role="menuitem" data-outline-context-assignment>查看分工</button></div>${descriptionEditDialog(governance)}<dialog class="outline-move-dialog" data-outline-move-dialog aria-labelledby="outline-move-title" data-scroll-region="dialog"><form method="dialog" data-directory-tree><header><h3 id="outline-move-title">移动到目录</h3><button class="icon-button" type="button" data-outline-move-close aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header><label class="outline-move-search">搜索目标目录<input type="search" data-directory-search data-outline-move-search placeholder="按目录名称搜索"></label><p>请选择目标目录：</p>${directoryChoiceTree(items)}<p class="outline-move-status" data-outline-move-status role="alert"></p><footer><button class="button secondary" type="button" data-outline-move-close>取消</button><button class="button" type="button" data-outline-move-confirm disabled>确认移动</button></footer></form></dialog></div>`;
}

function hierarchy(items) {
  if (!Array.isArray(items) || !items.some(item => item.parentId)) return items;
  const byId = new Map(items.map(item => [item.id, { ...item, children: [] }])); const roots = [];
  for (const item of byId.values()) { const parent = byId.get(item.parentId); parent ? parent.children.push(item) : roots.push(item); }
  return roots;
}

function taskPeople(task = {}) {
  const people = [
    { id: task.domainLeaderId, name: task.domainLeaderName, role: '领域负责人' },
    ...(Array.isArray(task.domainMembers) ? task.domainMembers.map(person => ({ ...person, role: person.role || '领域成员' })) : []),
  ].filter(person => person?.id);
  return [...new Map(people.map(person => [String(person.id), { ...person, id: String(person.id) }])).values()];
}

function taskAssigneeOptions(task, item = {}) {
  const people = taskPeople(task);
  const assigneeId = String(item.assigneeId || '');
  const known = people.some(person => person.id === assigneeId);
  const historical = assigneeId && !known
    ? `<option value="${escapeHtml(assigneeId)}" data-assignee-name="${escapeHtml(item.assigneeName || assigneeId)}" selected>历史责任人 ${escapeHtml(item.assigneeName || assigneeId)}（不在当前团队）</option>`
    : '';
  return ['<option value="">未指定责任人</option>', historical, ...people.map(person => `<option value="${escapeHtml(person.id)}" data-assignee-name="${escapeHtml(person.name || person.id)}"${assigneeId === person.id ? ' selected' : ''}>${escapeHtml(person.name || person.id)}</option>`)].join('');
}

function assignmentDirectoryData(nodes, items) {
  const flat = collectOutlineNodes(nodes);
  const byId = new Map(flat.map(node => [node.id, node]));
  const itemNodeId = item => String(item.outlineNodeId || item.documentId || '');
  const directoryIds = item => {
    const ids = [];
    let current = byId.get(itemNodeId(item));
    while (current?.parentId) {
      ids.push(String(current.parentId));
      current = byId.get(String(current.parentId));
    }
    return ids;
  };
  const directories = flat.filter(node => !node.document).map(node => ({
    ...node,
    children: [],
    count: items.filter(item => directoryIds(item).includes(node.id)).length,
  }));
  const directoryById = new Map(directories.map(node => [node.id, node]));
  const roots = [];
  directories.forEach(node => {
    const parent = directoryById.get(String(node.parentId || ''));
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  const tree = renderDirectoryTree(roots, {
    listClass: 'outline-navigation-root outline-assignment-tree', directoryClass: 'outline-navigation-group outline-assignment-tree-node',
    childrenOf: node => node.children || [], isLeaf: () => false, hideEmptyDirectories: false,
    nodeKey: node => node.id,
    renderDirectoryLabel: node => `<button type="button" class="outline-navigation-group-button" data-outline-assignment-directory="${escapeHtml(node.id)}"><i data-lucide="folder" aria-hidden="true"></i><span>${escapeHtml(nodeTitle(node.item))}</span><small>${node.count}</small></button>`,
  });
  return {
    idsFor: item => directoryIds(item).join(' '),
    html: `<nav class="outline-navigation review-document-tree outline-assignment-directory" data-navigation-pane data-directory-tree aria-label="手册目录过滤" data-scroll-region="panel"><header class="outline-navigation-header"><div><h3>手册目录</h3><span>${items.length} 篇文档</span></div><div class="outline-navigation-toolbar" aria-label="目录视图控制"><label class="outline-navigation-search"><span class="sr-only">搜索目录或文档</span><input type="search" data-directory-search placeholder="搜索目录或文档"></label><button class="icon-button outline-tree-toggle" type="button" data-outline-tree-toggle aria-label="展开全部目录" title="展开全部目录" data-outline-tree-expanded="false"><i data-lucide="chevrons-down" aria-hidden="true"></i></button><button class="icon-button outline-directory-collapse" type="button" data-navigation-pane-toggle aria-label="收起手册目录" title="收起手册目录"><i data-lucide="panel-left-close" aria-hidden="true"></i></button></div></header><div class="outline-navigation-scroll" data-scroll-region="panel"><button class="outline-assignment-all outline-navigation-group-label is-active" type="button" data-outline-assignment-directory=""><i data-lucide="files" aria-hidden="true"></i><span>全部文档</span><small>${items.length}</small></button>${tree}</div><div class="outline-navigation-resizer outline-assignment-resizer" data-navigation-pane-resizer role="separator" aria-orientation="vertical" aria-label="调整分工目录宽度" aria-valuemin="240" aria-valuemax="380" aria-valuenow="280" tabindex="0"></div></nav>`,
  };
}

function assignmentStatsDialog(activeTask, items, people, domainRole) {
  const primary = items.filter(item => domainRole(item) === '主责').length;
  const collaborator = Math.max(items.length - primary, 0);
  const assigned = items.filter(item => item.assigneeId).length;
  const pending = Math.max(items.length - assigned, 0);
  const workload = new Map(people.map(person => [person.id, 0]));
  items.forEach(item => {
    if (item.assigneeId) workload.set(String(item.assigneeId), (workload.get(String(item.assigneeId)) || 0) + 1);
  });
  const members = people.length
    ? people.map(person => `<li${String(person.id) === String(activeTask.domainLeaderId || '') ? ' class="is-leader"' : ''}><span>${escapeHtml(person.name || person.id)}${String(person.id) === String(activeTask.domainLeaderId || '') ? '<small>领域负责人</small>' : ''}</span><strong>${workload.get(person.id) || 0}</strong></li>`).join('')
    : '<li class="is-empty">当前领域尚未配置团队成员</li>';
  return `<dialog class="outline-assignment-stats-dialog" data-outline-assignment-stats-dialog aria-labelledby="outline-assignment-stats-title" data-scroll-region="dialog"><div class="outline-assignment-stats-card"><header><div><span class="eyebrow">当前领域</span><h3 id="outline-assignment-stats-title">分工统计</h3></div><button class="icon-button" type="button" data-outline-assignment-stats-close aria-label="关闭分工统计"><i data-lucide="x" aria-hidden="true"></i></button></header><dl class="outline-assignment-stats-context"><div><dt>技术领域</dt><dd>${escapeHtml(activeTask.techDomainName || activeTask.domainName || activeTask.techDomainId || '未命名领域')}</dd></div><div><dt>领域负责人</dt><dd>${escapeHtml(activeTask.domainLeaderName || '未配置')}</dd></div></dl><dl class="outline-assignment-stats-summary"><div><dt>主责文档</dt><dd>${primary}</dd></div><div><dt>协作文档</dt><dd>${collaborator}</dd></div><div><dt>已分派</dt><dd>${assigned}</dd></div><div><dt>待分派</dt><dd>${pending}</dd></div></dl><section><h4>成员负载</h4><ul>${members}</ul></section><footer><button class="button secondary" type="button" data-outline-assignment-stats-close>关闭</button></footer></div></dialog>`;
}

function assignmentManagement(governance, taskProjection, handbookId, outlineId, selectedDomainId = '', selectedDocumentId = '', permissions = {}, nodes = []) {
  if (String(governance.state || '').toLowerCase() !== 'published') {
    return `<section class="outline-assignment-empty"><i data-lucide="users" aria-hidden="true"></i><h3>发布后才能进行人员分工</h3><p>手册管理员需要先在“文档总览”完成技术领域分工并发布大纲，系统随后按技术领域生成正式建设任务。</p><button class="button secondary" type="button" data-outline-tab="overview">前往文档总览</button></section>`;
  }
  if (taskProjection?.status === 'unavailable') return pendingState('分工任务暂不可用', taskProjection.error?.message || '请稍后重新读取领域建设任务。');
  const projected = Array.isArray(taskProjection?.tasks) ? taskProjection.tasks : [];
  const embedded = Array.isArray(governance.tasks) ? governance.tasks : [];
  const source = projected.length ? projected : embedded;
  const tasks = source.filter(task => {
    const sameHandbook = !handbookId || !task.manualId || String(task.manualId) === String(handbookId);
    const sameOutline = !outlineId || !task.outlineVersionId || String(task.outlineVersionId) === String(outlineId);
    return sameHandbook && sameOutline;
  });
  if (!tasks.length) return pendingState('尚未生成领域建设任务', '当前发布版本没有可分派的领域任务，请重新检查发布结果。');
  const activeTask = tasks.find(task => String(task.techDomainId) === String(selectedDomainId)) || tasks[0];
  const activeDomainId = String(activeTask.techDomainId || '');
  const people = taskPeople(activeTask);
  const items = Array.isArray(activeTask.items) ? activeTask.items : [];
  const domainOptions = tasks.map(task => `<option value="${escapeHtml(task.techDomainId)}"${String(task.techDomainId) === activeDomainId ? ' selected' : ''}>${escapeHtml(task.techDomainName || task.domainName || task.techDomainId)}</option>`).join('');
  const assignments = Array.isArray(governance.effectiveDocumentAssignments) ? governance.effectiveDocumentAssignments : [];
  const domainRole = item => {
    const assignment = assignments.find(entry => String(entry.documentId || entry.nodeId) === String(item.documentId || item.outlineNodeId));
    const domains = Array.isArray(assignment?.techDomainIds) ? assignment.techDomainIds.map(String) : [];
    return domains[0] === activeDomainId ? '主责' : '协作';
  };
  const statsDialog = assignmentStatsDialog(activeTask, items, people, domainRole);
  const leaderSummary = selectedDomainId && activeTask.domainLeaderName ? `<div class="outline-assignment-leader"><span>领域负责人</span><strong>${escapeHtml(activeTask.domainLeaderName)}</strong></div>` : '';
  const assignmentHeader = `<header class="outline-assignment-heading"><label><span>当前领域</span><select data-outline-assignment-domain-filter>${domainOptions}</select></label>${leaderSummary}<button class="button secondary compact" type="button" data-outline-assignment-stats-open><i data-lucide="chart-no-axes-column" aria-hidden="true"></i>查看分工统计</button></header>`;
  if (!activeTask.domainLeaderId) {
    const returnTo = `/knowledge-center/outlines/${encodeURIComponent(handbookId || '')}?tab=assignments&domain=${encodeURIComponent(activeDomainId)}`;
    const configHref = `/knowledge-center/platform?tab=principals&view=groups&returnTo=${encodeURIComponent(returnTo)}&domain=${encodeURIComponent(activeDomainId)}`;
    const recovery = permissions.platformAdmin
      ? `<a class="button" href="${escapeHtml(configHref)}" data-outline-team-config-link>前往团队小组配置</a>`
      : '<p class="muted">请联系平台管理员配置负责人和成员。</p>';
    return `<section class="outline-assignment-workspace" data-domain-task>${assignmentHeader}<div class="outline-assignment-blocked"><i data-lucide="users" aria-hidden="true"></i><h3>${escapeHtml(activeTask.techDomainName || activeTask.domainName || activeDomainId)}团队尚未配置</h3><p>分工管理需要先设置领域负责人和团队成员。</p><p>现有 ${items.length} 篇文档及历史责任记录不会被修改。</p>${recovery}</div>${statsDialog}</section>`;
  }
  const assigned = items.filter(item => item.assigneeId).length;
  const pending = Math.max(items.length - assigned, 0);
  const defaultStatus = pending > 0 ? 'pending' : 'assigned';
  const directory = assignmentDirectoryData(nodes, items);
  const rows = items.map(item => {
    const focused = selectedDocumentId && [item.documentId, item.outlineNodeId].map(String).includes(String(selectedDocumentId));
    const assigneeId = String(item.assigneeId || '');
    const knownAssignee = !assigneeId || people.some(person => person.id === assigneeId);
    const assignmentLabel = !assigneeId ? '待分派' : knownAssignee ? '已分派' : '历史责任人待确认';
    const initiallyHidden = defaultStatus === 'pending' ? Boolean(assigneeId) : !assigneeId;
    const title = item.documentTitle || item.title || item.documentId || '未命名文档';
    const role = domainRole(item);
    return `<tr data-outline-assignment-row data-assigned="${assigneeId ? 'true' : 'false'}" data-assignee-id="${escapeHtml(assigneeId)}" data-directory-ids="${escapeHtml(directory.idsFor(item))}" data-search-text="${escapeHtml(String(title).toLowerCase())}"${focused ? ' class="is-focused"' : ''}${initiallyHidden ? ' hidden' : ''}><td data-label="选择"><input type="checkbox" data-outline-task-select aria-label="选择 ${escapeHtml(title)}"></td><td data-label="文档"><strong>${escapeHtml(title)}</strong></td><td data-label="本领域职责"><span class="outline-domain-role ${role === '主责' ? 'primary' : ''}">本领域${role}</span></td><td data-label="责任人"><div class="outline-assignee-control"><label class="sr-only" for="outline-assignee-${escapeHtml(item.id)}">为《${escapeHtml(title)}》选择责任人</label><select id="outline-assignee-${escapeHtml(item.id)}" data-domain-task-assignee data-task-id="${escapeHtml(activeTask.id)}" data-item-id="${escapeHtml(item.id)}">${taskAssigneeOptions(activeTask, item)}</select><small class="outline-assignee-state${knownAssignee ? '' : ' needs-review'}">${assignmentLabel}</small></div></td></tr>`;
  }).join('');
  const teamNote = people.length === 1 ? '<p class="outline-team-note">暂无其他团队成员，当前可分派给领域负责人。</p>' : '';
  return `<section class="outline-assignment-workspace" data-domain-task data-assignment-status="${defaultStatus}" data-assignment-directory="">${assignmentHeader}${teamNote}<div class="outline-assignment-layout" data-navigation-layout data-navigation-layout-id="outline-assignment" data-navigation-pane-label="手册目录" data-navigation-min="240" data-navigation-max="380" data-navigation-default="280" data-navigation-width-variable="--outline-assignment-directory-width" style="--outline-assignment-directory-width:280px">${directory.html}<div class="outline-assignment-content"><div class="outline-assignment-content-heading"><div><span class="eyebrow">当前领域</span><h3>分工任务</h3></div><div class="outline-assignment-summary"><button type="button"${defaultStatus === 'pending' ? ' class="active"' : ''} data-outline-assignment-status="pending">待分派 ${pending}</button><button type="button"${defaultStatus === 'assigned' ? ' class="active"' : ''} data-outline-assignment-status="assigned">已分派 ${assigned}</button><button type="button" data-outline-assignment-status="all">全部 ${items.length}</button></div></div><div class="outline-assignment-filters"><label><span class="sr-only">搜索文档</span><input type="search" placeholder="搜索文档" data-outline-assignment-search></label><label><span class="sr-only">按责任人筛选</span><select data-outline-assignment-member-filter aria-label="按责任人筛选"><option value="">全部责任人</option><option value="unassigned">待分派</option>${people.map(person => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.name || person.id)}</option>`).join('')}</select></label></div><div class="outline-responsibility-table-wrap" data-scroll-region="panel"><table class="outline-responsibility-table" data-table-view-id="outline-assignment" data-table-view-schema="2" data-table-view-label="分工任务"><thead><tr><th data-table-column="selection" data-table-column-required="true" data-table-column-label="选择"><span class="sr-only">选择</span></th><th data-table-column="document" data-table-column-required="true" data-table-column-label="文档">文档</th><th data-table-column="role" data-table-column-label="本领域职责">本领域职责</th><th data-table-column="assignee" data-table-column-required="true" data-table-column-label="责任人">责任人</th></tr></thead><tbody>${rows}</tbody></table></div><div class="outline-assignment-batch" hidden data-scroll-obstacle><span data-outline-selected-count>已选择 0 篇</span><select data-outline-batch-assignee aria-label="批量选择责任人"><option value="">选择责任人</option>${people.map(person => `<option value="${escapeHtml(person.id)}" data-assignee-name="${escapeHtml(person.name || person.id)}">${escapeHtml(person.name || person.id)}</option>`).join('')}</select><button class="button" type="button" data-outline-batch-assign disabled>确认分派</button></div><span class="domain-task-status" role="status"></span></div></div>${statsDialog}</section>`;
}

function detail(item, projection, permissions = {}, selectedDocumentId = null, filterUnassigned = false, activeTab = 'overview', taskProjection = null, selectedDomainId = '') {
  const value = identity(item);
  const handbookName = firstDefined(projection?.handbook?.name, projection?.handbook?.title, item.handbookName, item.manualName, value.name, '未命名手册');
  const nodes = hierarchy(firstDefined(item.nodes, item.tree, item.chapters, item.content?.parts, []));
  const governance = item.governance || item.responsibility || {};
  const directory = outlineNavigation(nodes, selectedDocumentId, governance);
  const published = value.state === 'published';
  const missingDomains = (governance.effectiveDocumentAssignments || []).filter(entry => !(entry.techDomainIds || []).length).length;
  const assignments = assignmentManagement(governance, taskProjection, item.handbookId || projection?.handbook?.id, item.id, selectedDomainId, selectedDocumentId, permissions, nodes);
  return `<div class="outline-detail-shell"><a class="outline-back" href="/knowledge-center/outlines" data-outline-back><i data-lucide="arrow-left" aria-hidden="true"></i>返回大纲列表</a>
    <header class="outline-detail-header"><div class="outline-detail-title"><h2>${escapeHtml(handbookName)}</h2><p>大纲版本：${escapeHtml(value.outlineVersion || value.name || '尚未建立')}</p></div><div class="outline-detail-actions"><span class="status">${escapeHtml(value.status || '状态未提供')}</span><details class="outline-more-actions" data-dismissible-menu data-outline-more-id="${escapeHtml(item.id || '')}"><summary class="button secondary">更多操作</summary><div class="outline-more-menu">${templateDownloadLink()}<button class="button secondary" type="button" data-outline-info-toggle aria-controls="outline-handbook-info" aria-expanded="false"><i data-lucide="info" aria-hidden="true"></i>手册信息</button>${permissions.delete && canDelete(item) ? `<button class="button danger" type="button" data-outline-delete="${escapeHtml(item.id || '')}" data-outline-delete-name="${escapeHtml(value.name)}"><i data-lucide="trash-2" aria-hidden="true"></i>移入回收站</button>` : ''}</div></details><button class="button" type="button" data-outline-publish data-outline-overview-action${activeTab === 'overview' ? '' : ' hidden'}${published || missingDomains ? ' disabled' : ''}>${published ? '已发布' : '发布大纲'}</button></div></header>
    <div class="outline-work-tabs" role="tablist" aria-label="大纲管理工作区"><button id="outline-tab-overview" class="tab${activeTab === 'overview' ? ' active' : ''}" type="button" role="tab" aria-selected="${activeTab === 'overview'}" aria-controls="outline-panel-overview" tabindex="${activeTab === 'overview' ? 0 : -1}" data-outline-tab="overview">文档总览</button><button id="outline-tab-assignments" class="tab${activeTab === 'assignments' ? ' active' : ''}" type="button" role="tab" aria-selected="${activeTab === 'assignments'}" aria-controls="outline-panel-assignments" tabindex="${activeTab === 'assignments' ? 0 : -1}" data-outline-tab="assignments">分工管理</button></div>
    <section class="outline-stage-canvas"><div id="outline-panel-overview" role="tabpanel" aria-labelledby="outline-tab-overview" data-outline-panel="overview"${activeTab === 'overview' ? '' : ' hidden'}>${directory}</div><div id="outline-panel-assignments" role="tabpanel" aria-labelledby="outline-tab-assignments" data-outline-panel="assignments"${activeTab === 'assignments' ? '' : ' hidden'}>${assignments}</div></section>${dataNote(projection)}${templateHelpPanel()}
    <div class="outline-info-overlay" data-outline-info-close hidden></div><aside id="outline-handbook-info" class="outline-info-drawer" aria-labelledby="outline-info-title" hidden data-scroll-region="drawer"><div class="outline-info-heading"><h3 id="outline-info-title">手册信息</h3><button class="icon-button" type="button" data-outline-info-close aria-label="关闭手册信息" title="关闭手册信息"><i data-lucide="x" aria-hidden="true"></i></button></div><dl class="outline-context"><div><dt>适用产品</dt><dd>${escapeHtml(value.product || '未设置')}</dd></div><div><dt>业务版本</dt><dd>${labels(value.versions)}</dd></div><div><dt>A 角</dt><dd>${escapeHtml(owner(item, 'primary'))}</dd></div><div><dt>B 角</dt><dd>${escapeHtml(owner(item, 'assistant'))}</dd></div></dl></aside></div>`;
}

function importArea(handbookId) {
  if (!handbookId) return '';
  return `<details class="outline-import" data-dismissible-menu><summary class="button secondary"><i data-lucide="upload" aria-hidden="true"></i>导入大纲</summary><form class="outline-actions" data-outline-import data-handbook-id="${escapeHtml(handbookId)}"><label for="outline-import-file"><strong>选择 XLSX 大纲模板</strong><input id="outline-import-file" name="file" type="file" accept=".xlsx" required></label><button class="button secondary" type="submit" data-outline-validate>校验大纲</button><button class="button secondary" type="submit" data-outline-import-submit>导入候选</button><span class="muted" data-outline-import-status aria-live="polite"></span><ol class="outline-import-results" data-outline-import-results aria-live="polite"></ol></form></details>`;
}

function renderOutlinesLegacy({ outlineProjection: source, outlineView = {}, outlinePermissions = {}, domainBuildTaskProjection = null }) {
  const items = Array.isArray(source?.items) ? source.items : [];
  if (outlineView.page === 'resources') return outlineResources();
  if (outlineView.isDetail) {
    const back = '<a class="outline-back" href="/knowledge-center/outlines" data-outline-back><i data-lucide="arrow-left" aria-hidden="true"></i>返回大纲列表</a>';
    if (!source || source.status === 'loading') return `${back}${pendingState('正在读取大纲', '正在请求大纲治理服务。')}`;
    if (source.status === 'not_found') return `${back}${pendingState('手册不存在', '该手册可能已删除，或链接已失效。')}`;
    if (source.status === 'empty') return `${back}<header class="outline-empty-header"><p class="eyebrow">当前手册</p><h2>${escapeHtml(source.handbook?.name || source.handbook?.title || outlineView.handbookId)}</h2><p class="muted">该手册尚未建立大纲。</p><div class="outline-empty-actions">${templateDownloadLink()}${outlinePermissions.create ? importArea(outlineView.handbookId) : ''}</div></header>${pendingState('尚未建立大纲', outlinePermissions.create ? '请在当前手册上下文导入 XLSX 模板，创建第一个候选版本。' : '当前账号只能查看大纲，无法创建候选版本。')}${templateHelpPanel()}`;
    if (source.status === 'forbidden') return `${back}${pendingState('无权查看大纲', source.error?.message || '当前账号没有查看该大纲的权限。')}`;
    if (source.status === 'unavailable') return `${back}${pendingState('大纲服务不可用', source.error?.message || '请稍后重试。')}`;
    if (source.status !== 'ok') return `${back}${pendingState('暂时无法读取大纲', source.error?.message || '请刷新页面后重试。')}`;
    return detail(source.detail, { asOf: source.asOf, handbook: source.handbook }, outlinePermissions, outlineView.nodeId || outlineView.documentId, outlineView.filterUnassigned, outlineView.activeTab, domainBuildTaskProjection, outlineView.domainId);
  }
  let body;
  if (!source || source.status === 'loading') body = pendingState('正在读取大纲', '正在请求大纲目录。');
  else if (source.status !== 'ok') body = pendingState(source.status === 'forbidden' ? '无权查看大纲' : '大纲服务不可用', source.error?.message || '请稍后重试。');
  else if (!items.length) body = pendingState('尚无大纲', '当前没有可展示的大纲，请导入文件创建候选版本。');
  else body = list(items, outlineView.listState, outlinePermissions);
  const accessNote = outlinePermissions.create || outlinePermissions.delete ? '' : '<p class="outline-readonly-note" role="note"><i data-lucide="lock" aria-hidden="true"></i>当前为只读模式，只有具备大纲管理权限的账号可新增或删除大纲。</p>';
  const recycle = Array.isArray(source?.recycleItems) ? `<section class="outline-recycle" aria-label="大纲回收站"><div class="outline-recycle-heading"><h3>大纲回收站</h3><p>发布历史保留，恢复不会覆盖新的当前大纲。</p></div>${source.recycleItems.length ? `<div class="outline-table-wrap"><table class="outline-table outline-recycle-table"><thead><tr><th scope="col">手册与大纲</th><th scope="col">原状态</th><th scope="col">删除时间</th><th scope="col">操作</th></tr></thead><tbody>${source.recycleItems.map(item => `<tr><td><strong>${escapeHtml(item.name || '未命名大纲')}</strong><small>大纲 ID：${escapeHtml(item.id)}</small></td><td>${escapeHtml(identity(item).status)}</td><td>${escapeHtml(item.deletedAt || '—')}</td><td><div class="outline-row-actions">${outlinePermissions.delete ? `<button type="button" class="button secondary compact" data-outline-restore="${escapeHtml(item.id)}">恢复</button>` : ''}${outlinePermissions.purge ? `<button type="button" class="button danger compact" data-outline-purge="${escapeHtml(item.id)}">彻底删除</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">回收站为空</p>'}</section>` : '';
  const purgeDialog = outlinePermissions.purge ? `<dialog data-outline-purge-dialog aria-labelledby="outline-purge-title"><h3 id="outline-purge-title">彻底删除大纲</h3><p>此操作不可恢复。发布历史引用会阻止清理，审计记录继续保留。</p><p data-outline-purge-impact></p><button type="button" class="button secondary compact" data-outline-purge-fill-id>填入目标 ID</button><form data-outline-purge-form><label>确认目标 ID<input name="confirmId" required autocomplete="off"></label><label>删除原因<textarea name="reason" required maxlength="1000"></textarea></label><p data-outline-purge-error role="alert"></p><button type="button" class="button secondary" data-outline-purge-cancel>取消</button><button type="button" class="button danger" data-outline-purge-confirm>确认彻底删除</button></form></dialog>` : '';
  if (outlineView.page === 'recycle') {
    const content = !source || source.status === 'loading' ? pendingState('正在读取回收站', '正在请求已删除大纲。') : source.status !== 'ok' ? pendingState(source.status === 'forbidden' ? '无权查看回收站' : '回收站读取失败', source.error?.message || '请稍后重试。') + (source.status === 'forbidden' ? '' : '<button class="button secondary" type="button" data-outline-recycle-retry>重新加载</button>') : outlineView.recycleId && !source.recycleItems?.some(item => item.id === outlineView.recycleId) ? pendingState('回收站中未找到该大纲', '该版本可能已恢复或已彻底删除。请返回大纲管理查看当前手册。') : recycle;
    return `<div class="outline-subpage outline-recycle-page">${outlineListBack()}<header class="outline-subpage-header"><p class="eyebrow">已删除的大纲</p><h2>大纲回收站</h2><p>发布历史保留，恢复不会覆盖新的当前大纲。</p></header>${content}${purgeDialog}</div>`;
  }
  return `<div class="workspace-action-row outline-list-intro"><div class="outline-list-intro-actions"><a class="button secondary" href="/knowledge-center/outlines/resources" data-outline-subpage="resources">准备大纲</a><a class="button secondary" href="/knowledge-center/outlines/recycle" data-outline-subpage="recycle">回收站</a></div></div>${accessNote}${body}${source?.asOf ? dataNote({ asOf: source.asOf }) : ''}`;
}

export function renderOutlineAssignments({ outlineProjection, outlineView, outlinePermissions, domainBuildTaskProjection }) {
  const item = outlineProjection.detail;
  const nodes = hierarchy(firstDefined(item.nodes, item.tree, item.chapters, item.content?.parts, []));
  return assignmentManagement(item.governance || item.responsibility || {}, domainBuildTaskProjection,
    item.handbookId || outlineProjection.handbook?.id, item.id, outlineView.domainId,
    outlineView.nodeId || outlineView.documentId, outlinePermissions, nodes);
}

export function renderOutlines(args) {
  return renderOutlinesLegacy(args).replace('<p class="eyebrow">手册结构治理</p>', '').replace('<p class="muted">查找手册并继续处理大纲。</p>', '');
}
