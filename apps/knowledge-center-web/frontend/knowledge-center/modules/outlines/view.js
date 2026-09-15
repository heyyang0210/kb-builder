import { dataNote, pendingState } from '../../common/components/ui.js';
import { escapeHtml } from '../../common/utils/dom.js';

const firstDefined = (...values) => values.find(value => value !== undefined && value !== null);
const businessStatusLabels = { incomplete: '待完善', review: '待评审', published: '已发布' };
const stages = [
  { key: 'directory', label: '目录与分工' }, { key: 'publish', label: '预览与发布' },
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

const actionStage = state => ({ preflight_failed: 'directory', confirmed: 'publish' }[state] || 'directory');

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

function templateDownloadLink() {
  return '<span class="outline-template-actions"><a class="button secondary" href="/knowledge-center/api/outline/template" download="大纲模板.xlsx" data-outline-template-download><i data-lucide="download" aria-hidden="true"></i>下载大纲模板</a><a class="button secondary" href="/knowledge-center/api/outline/sample" download="基本数据库管理手册大纲示例.xlsx" data-outline-sample-download><i data-lucide="file-spreadsheet" aria-hidden="true"></i>下载数据库管理手册示例</a><button class="icon-button outline-template-help" type="button" aria-label="查看大纲模板字段填写说明" title="查看大纲模板字段填写说明" data-outline-template-help><i data-lucide="help-circle" aria-hidden="true"></i></button></span>';
}

function templateHelpPanel() {
  return `<aside class="outline-template-help-panel" data-outline-template-help-panel hidden aria-labelledby="outline-template-help-title"><div class="outline-template-help-heading"><h3 id="outline-template-help-title">大纲模板填写说明</h3><button class="icon-button" type="button" data-outline-template-help-close aria-label="关闭大纲模板填写说明" title="关闭"><i data-lucide="x" aria-hidden="true"></i></button></div><dl class="outline-template-help-list"><div><dt>一级目录</dt><dd>填写大纲的第一级目录名称，必填；后续目录列必须建立在已有上级目录下。</dd></div><div><dt>二级目录</dt><dd>填写一级目录下的第二级目录；没有二级目录时可以留空，但不能直接填写三级目录。</dd></div><div><dt>三级目录</dt><dd>填写二级目录下的第三级目录；没有三级目录时可以留空。</dd></div><div><dt>页面</dt><dd>填写当前目录路径下的页面名称；页面是大纲的第 4 级，也是最小内容单元，必填。</dd></div><div><dt>内容说明</dt><dd>填写该页面覆盖范围、建设目标、主要内容和可验证重点。</dd></div><div><dt>技术领域分工</dt><dd>填写负责该页面的技术领域名称、编码或 ID；多个领域可用“、”、逗号、分号或换行分隔。</dd></div></dl><p class="muted">每一行描述一个页面的完整目录路径。手册名称来自当前手册，不受 Excel 文件名或 Sheet 名称影响。</p></aside>`;
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

function containsDocument(items, selectedId) {
  return collectDocuments(items).some(item => item.id === selectedId);
}

function navigationNode(item, selectedId, depth = 0, index = 0, missingIds = new Set(), filterUnassigned = false) {
  const children = nodeChildren(item);
  const title = String(nodeTitle(item));
  if (isDocumentNode(item)) {
    const id = documentId(item, index);
    if (filterUnassigned && !missingIds.has(id)) return '';
    const selected = id === selectedId;
    const sourceId = firstDefined(item.sourceId, item.documentId);
    const status = missingIds.has(id) ? '<small class="outline-navigation-document-status">待分工</small>' : '';
    return `<li class="outline-navigation-document${missingIds.has(id) ? ' is-unassigned' : ''}"><button class="outline-navigation-document-button${selected ? ' is-selected' : ''}${missingIds.has(id) ? ' is-unassigned' : ''}" type="button" data-outline-document="${escapeHtml(id)}" data-outline-document-unassigned="${missingIds.has(id)}"${selected ? ' aria-current="page"' : ''} title="${escapeHtml(title)}"><i data-lucide="file-text" aria-hidden="true"></i><span class="outline-navigation-document-copy"><strong>${escapeHtml(title)}</strong>${sourceId ? `<small>${escapeHtml(sourceId)}</small>` : ''}</span>${status}</button></li>`;
  }
  const visibleChildren = [...children]
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .map((child, childIndex) => navigationNode(child, selectedId, depth + 1, childIndex, missingIds, filterUnassigned))
    .filter(Boolean);
  const hasSelected = containsDocument(children, selectedId);
  const content = `<i data-lucide="folder" aria-hidden="true"></i><span>${escapeHtml(title)}</span>`;
  if (!visibleChildren.length) return filterUnassigned ? '' : `<li class="outline-navigation-group outline-navigation-empty"><div class="outline-navigation-group-label">${content}</div></li>`;
  return `<li class="outline-navigation-group"><details${depth === 0 || hasSelected ? ' open' : ''}><summary>${content}</summary><ul>${visibleChildren.join('')}</ul></details></li>`;
}

function documentPanel(document, selected, governance = {}) {
  const item = document.item;
  const title = nodeTitle(item);
  const description = firstDefined(item.description, item.desc, item.body, '');
  const sourceId = firstDefined(item.sourceId, item.documentId);
  const path = document.path.length ? document.path.join(' / ') : '未设置层级路径';
  const panelId = `outline-document-panel-${document.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const published = governance.state === 'published';
  const assignments = Array.isArray(governance.assignments) ? governance.assignments : [];
  const explicit = assignments.find(assignment => String(assignment.nodeId) === String(document.id));
  const effective = (governance.effectiveDocumentAssignments || []).find(assignment => String(assignment.nodeId) === String(document.id));
  const explicitDomainIds = explicit?.techDomainIds || [];
  const selectedDomains = new Set((Array.isArray(explicitDomainIds) ? explicitDomainIds : [explicitDomainIds]).map(String));
  const domains = Array.isArray(governance.techDomains) ? governance.techDomains : [];
  const domainOptions = domains.map(domain => `<label class="outline-domain-option"><input type="checkbox" data-outline-domain-node="${escapeHtml(document.id)}" value="${escapeHtml(domain.id)}"${selectedDomains.has(String(domain.id)) ? ' checked' : ''}><span>${escapeHtml(domain.name || domain.code || domain.id)}</span></label>`).join('');
  const effectiveIds = Array.isArray(effective?.techDomainIds) ? effective.techDomainIds.map(String) : [];
  const effectiveNames = effectiveIds.map(id => domains.find(domain => String(domain.id) === id)?.name || id);
  const effectiveText = effectiveNames.length ? effectiveNames.join('、') : '尚未设置';
  const ownerships = Array.isArray(effective?.ownerships) ? effective.ownerships : [];
  const ownershipText = ownerships.length
    ? ownerships.map(ownership => `${ownership.techDomainName || ownership.techDomainId}：${ownership.assigneeName || (ownership.status === 'not_published' ? '发布后由领域负责人负责' : '待分派')}`).join('；')
    : '未形成发布后的页面归属';
  const descriptionHint = published
    ? '已发布大纲的内容说明不可修改；如需修改，请创建新的候选版本。'
    : '内容说明用于指导后续页面建设，可在发布前修改。';
  const assignmentHint = published
    ? '已发布大纲只能调整技术领域，不能取消该页面的全部分工。调整后会同步当前领域建设任务。'
    : '这里维护页面级分工；可选择多个领域，清空后表示取消该页面的显式分工。';
  return `<article class="outline-document-panel" data-outline-document-panel="${escapeHtml(document.id)}"${selected ? '' : ' hidden'} aria-labelledby="${escapeHtml(panelId)}-title"><header><p class="eyebrow">当前文档</p><h3 id="${escapeHtml(panelId)}-title">${escapeHtml(title)}</h3><p class="outline-document-meta">${sourceId ? `文档编号：${escapeHtml(sourceId)}` : '文档编号：未提供'}</p></header><dl class="outline-document-facts"><div><dt>层级路径</dt><dd>${escapeHtml(path)}</dd></div><div><dt>内容说明</dt><dd><textarea class="outline-description-editor" data-outline-description="${escapeHtml(document.id)}" rows="8"${published ? ' readonly' : ''}>${escapeHtml(description)}</textarea><small>${descriptionHint}</small></dd></div><div><dt>技术领域分工</dt><dd><fieldset class="outline-domain-fieldset" data-outline-domain-group="${escapeHtml(document.id)}"><legend class="sr-only">为 ${escapeHtml(title)} 选择技术领域</legend><div class="outline-domain-options">${domainOptions || '<span class="muted">暂无技术领域配置</span>'}</div><small>当前有效分工：${escapeHtml(effectiveText)}。${assignmentHint}</small></fieldset></dd></div><div><dt>页面归属</dt><dd class="outline-document-ownership">${escapeHtml(ownershipText)}<small>${published ? '归属来自当前领域建设任务，领域负责人改派后刷新本页即可更新。' : '发布后默认归属对应技术领域负责人。'}</small></dd></div></dl><p class="outline-document-body-pending" role="status"><i data-lucide="file-text" aria-hidden="true"></i><span>正文内容尚未接入，本阶段维护的是大纲中的内容说明。</span></p></article>`;
}

function outlineNavigation(items, selectedId, governance, filterUnassigned = false) {
  const allDocuments = collectDocuments(items);
  const missingIds = new Set((governance.effectiveDocumentAssignments || [])
    .filter(item => !(item.techDomainIds || []).length)
    .map(item => String(item.nodeId)));
  const documents = filterUnassigned
    ? allDocuments.filter(document => missingIds.has(document.id))
    : allDocuments;
  if (!allDocuments.length) return pendingState('目录暂不可用', '当前大纲未返回 document 叶子节点。');
  const selected = documents.some(item => item.id === selectedId) ? selectedId : (documents[0]?.id || null);
  const navigation = `<ul class="outline-navigation-root">${items.map((item, index) => navigationNode(item, selected, 0, index, missingIds, filterUnassigned)).filter(Boolean).join('')}</ul>`;
  const missingCount = allDocuments.filter(item => missingIds.has(item.id)).length;
  const filterLabel = filterUnassigned ? '显示全部页面' : `只看未分工 (${missingCount})`;
  const filterIcon = filterUnassigned ? 'list' : 'filter';
  const emptyFiltered = filterUnassigned && !documents.length;
  const navigationBody = emptyFiltered
    ? '<div class="outline-navigation-empty-state"><i data-lucide="check-circle-2" aria-hidden="true"></i><span>所有页面均已完成分工</span></div>'
    : navigation;
  const saveLabel = governance.state === 'published' ? '保存责任分工调整' : '保存目录与分工';
  return `<div class="outline-directory-workspace"><nav class="outline-navigation" aria-label="手册目录导航"><header class="outline-navigation-header"><div><h3>手册目录</h3><span>${filterUnassigned ? `${documents.length} 个待分工页面` : `${documents.length} 篇文档`}</span></div><div class="outline-navigation-toolbar" aria-label="目录视图控制"><button class="button tertiary compact" type="button" data-outline-unassigned-filter="${filterUnassigned ? 'true' : 'false'}" aria-pressed="${filterUnassigned}"><i data-lucide="${filterIcon}" aria-hidden="true"></i>${filterLabel}</button><button class="icon-button outline-tree-toggle" type="button" data-outline-tree-toggle aria-label="展开全部目录" title="展开全部目录" data-outline-tree-expanded="false"><i data-lucide="chevrons-down" aria-hidden="true"></i></button></div></header><div class="outline-navigation-scroll">${navigationBody}</div></nav><section class="outline-document-content" aria-live="polite">${documents.map(item => documentPanel(item, item.id === selected, governance)).join('')}<div class="outline-stage-actions"><button class="button secondary" type="button" data-outline-governance-save>${saveLabel}</button><span class="outline-governance-status" role="status"></span></div></section></div>`;
}

function hierarchy(items) {
  if (!Array.isArray(items) || !items.some(item => item.parentId)) return items;
  const byId = new Map(items.map(item => [item.id, { ...item, children: [] }])); const roots = [];
  for (const item of byId.values()) { const parent = byId.get(item.parentId); parent ? parent.children.push(item) : roots.push(item); }
  return roots;
}

function publish(value) {
  const summary = value?.summary || {};
  const missing = Array.isArray(value?.effectiveDocumentAssignments) ? value.effectiveDocumentAssignments.filter(item => !(item.techDomainIds || []).length) : [];
  const tasks = Array.isArray(value?.tasks) ? value.tasks : [];
  const domains = Array.isArray(value?.techDomains) ? value.techDomains : [];
  const domainNames = new Map(domains.map(domain => [String(domain.id), domain.name || domain.code || domain.id]));
  const preview = new Map();
  for (const item of Array.isArray(value?.effectiveDocumentAssignments) ? value.effectiveDocumentAssignments : []) {
    for (const domainId of item.techDomainIds || []) preview.set(String(domainId), (preview.get(String(domainId)) || 0) + 1);
  }
  const previewRows = [...preview.entries()].map(([domainId, count]) => `<li><span>${escapeHtml(domainNames.get(domainId) || domainId)}</span><strong>${count} 个页面</strong></li>`).join('');
  return `<section class="outline-publish-panel"><header><div><h3>预览与发布</h3><p>确认目录说明和技术领域分工后发布。发布后将按领域生成建设任务，领域负责人可继续把页面分派给组员。</p></div><span class="status">${missing.length ? '待完成责任分工' : '发布门禁可通过'}</span></header><dl class="outline-context"><div><dt>页面分工</dt><dd>${escapeHtml(`${summary.assignedDocuments || 0} / ${summary.totalDocuments || 0}`)}</dd></div><div><dt>未分工页面</dt><dd>${missing.length ? missing.map(item => escapeHtml(item.title)).join('、') : '无'}</dd></div><div><dt>领域任务预览</dt><dd>${previewRows ? `<ul class="outline-publish-domain-preview">${previewRows}</ul>` : '保存分工后生成预览'}</dd></div><div><dt>已生成领域任务</dt><dd>${escapeHtml(tasks.length)} 个</dd></div></dl><button class="button" type="button" data-outline-publish ${missing.length ? 'disabled' : ''}>发布并生成建设任务</button><span class="outline-governance-status" role="status"></span></section>`;
}

function detail(item, projection, activeStage, permissions = {}, selectedDocumentId = null, filterUnassigned = false) {
  const value = identity(item);
  const handbookName = firstDefined(projection?.handbook?.name, projection?.handbook?.title, item.handbookName, item.manualName, value.name, '未命名手册');
  const nodes = hierarchy(firstDefined(item.nodes, item.tree, item.chapters, item.content?.parts, []));
  const governance = item.governance || item.responsibility || {};
  const directory = outlineNavigation(nodes, selectedDocumentId, governance, filterUnassigned);
  const bodies = { directory, publish: publish(governance) };
  return `<div class="outline-detail-shell"><a class="outline-back" href="/knowledge-center/outlines" data-outline-back><i data-lucide="arrow-left" aria-hidden="true"></i>返回大纲列表</a>
    <header class="outline-detail-header"><div class="outline-detail-title"><p class="eyebrow">当前手册</p><h2>${escapeHtml(handbookName)}</h2><p>大纲版本：${escapeHtml(value.outlineVersion || value.name || '尚未建立')}</p></div><div class="outline-detail-actions"><span class="status">${escapeHtml(value.status || '状态未提供')}</span>${templateDownloadLink()}<button class="button secondary" type="button" data-outline-info-toggle aria-controls="outline-handbook-info" aria-expanded="false"><i data-lucide="info" aria-hidden="true"></i>手册信息</button>${permissions.delete && canDelete(item) ? `<button class="button danger" type="button" data-outline-delete="${escapeHtml(item.id || '')}" data-outline-delete-name="${escapeHtml(value.name)}"><i data-lucide="trash-2" aria-hidden="true"></i>删除候选</button>` : ''}<button class="button" type="button" data-outline-stage-target="${actionStage(value.state)}">${nextAction(value.state)}</button></div></header>
    ${value.issues ? `<p class="outline-issue-summary" role="status">还有 <strong>${value.issues}</strong> 项待处理问题</p>` : ''}
    <div class="outline-stagebar" role="tablist" aria-label="大纲处理阶段">${stages.map((stage, index) => { const active = stage.key === activeStage; return `<button id="outline-tab-${stage.key}" class="tab${active ? ' active' : ''}" type="button" role="tab" aria-selected="${active}" aria-controls="outline-panel-${stage.key}" tabindex="${active ? 0 : -1}" data-outline-tab="${stage.key}"><span>${index + 1}</span>${stage.label}</button>`; }).join('')}</div>
    <section class="outline-stage-canvas">${stages.map(stage => `<div id="outline-panel-${stage.key}" role="tabpanel" aria-labelledby="outline-tab-${stage.key}" data-outline-panel="${stage.key}"${stage.key === activeStage ? '' : ' hidden'}>${bodies[stage.key]}</div>`).join('')}</section>${dataNote(projection)}${templateHelpPanel()}
    <div class="outline-info-overlay" data-outline-info-close hidden></div><aside id="outline-handbook-info" class="outline-info-drawer" aria-labelledby="outline-info-title" hidden><div class="outline-info-heading"><h3 id="outline-info-title">手册信息</h3><button class="icon-button" type="button" data-outline-info-close aria-label="关闭手册信息" title="关闭手册信息"><i data-lucide="x" aria-hidden="true"></i></button></div><dl class="outline-context"><div><dt>适用产品</dt><dd>${escapeHtml(value.product || '未设置')}</dd></div><div><dt>业务版本</dt><dd>${labels(value.versions)}</dd></div><div><dt>A 角</dt><dd>${escapeHtml(owner(item, 'primary'))}</dd></div><div><dt>B 角</dt><dd>${escapeHtml(owner(item, 'assistant'))}</dd></div></dl></aside></div>`;
}

function importArea(handbookId) {
  if (!handbookId) return '';
  return `<details class="outline-import"><summary class="button secondary"><i data-lucide="upload" aria-hidden="true"></i>导入大纲</summary><form class="outline-actions" data-outline-import data-handbook-id="${escapeHtml(handbookId)}"><label for="outline-import-file"><strong>选择 XLSX 大纲模板</strong><input id="outline-import-file" name="file" type="file" accept=".xlsx" required></label><button class="button secondary" type="submit">导入候选</button><span class="muted" data-outline-import-status aria-live="polite"></span><ol class="outline-import-results" data-outline-import-results aria-live="polite"></ol></form></details>`;
}

function renderOutlinesLegacy({ outlineProjection: source, outlineView = {}, outlinePermissions = {} }) {
  const items = Array.isArray(source?.items) ? source.items : [];
  if (outlineView.isDetail) {
    const back = '<a class="outline-back" href="/knowledge-center/outlines" data-outline-back><i data-lucide="arrow-left" aria-hidden="true"></i>返回大纲列表</a>';
    if (!source) return pendingState('正在读取大纲', '正在请求大纲治理服务。');
    if (source.status === 'not_found') return `${back}${pendingState('手册不存在', '该手册可能已删除，或链接已失效。')}`;
    if (source.status === 'empty') return `${back}<header class="outline-empty-header"><p class="eyebrow">当前手册</p><h2>${escapeHtml(source.handbook?.name || source.handbook?.title || outlineView.handbookId)}</h2><p class="muted">该手册尚未建立大纲。</p><div class="outline-empty-actions">${templateDownloadLink()}${outlinePermissions.create ? importArea(outlineView.handbookId) : ''}</div></header>${pendingState('尚未建立大纲', outlinePermissions.create ? '请在当前手册上下文导入 XLSX 模板，创建第一个候选版本。' : '当前账号只能查看大纲，无法创建候选版本。')}`;
    if (source.status !== 'ok') return `${back}${pendingState(source.status === 'forbidden' ? '无权查看大纲' : '大纲服务不可用', source.error?.message || '请稍后重试。')}`;
    return detail(source.detail, { asOf: source.asOf, handbook: source.handbook }, outlineView.activeStage, outlinePermissions, outlineView.documentId, outlineView.filterUnassigned);
  }
  let body;
  if (!source) body = pendingState('正在读取大纲', '正在请求大纲治理服务。');
  else if (source.status !== 'ok') body = pendingState(source.status === 'forbidden' ? '无权查看大纲' : '大纲服务不可用', source.error?.message || '请稍后重试。');
  else if (!items.length) body = pendingState('尚无大纲', '当前没有可展示的大纲，请导入文件创建候选版本。');
  else body = list(items, outlineView.listState, outlinePermissions);
  const accessNote = outlinePermissions.create || outlinePermissions.delete ? '' : '<p class="outline-readonly-note" role="note"><i data-lucide="lock" aria-hidden="true"></i>当前为只读模式，只有具备大纲管理权限的账号可新增或删除大纲。</p>';
  return `<div class="page-intro outline-list-intro"><div><p class="eyebrow">手册结构治理</p><h2>大纲管理</h2><p class="muted">查找手册并继续处理大纲。</p></div><div class="outline-list-intro-actions">${templateDownloadLink()}</div></div>${accessNote}${body}${source?.asOf ? dataNote({ asOf: source.asOf }) : ''}${templateHelpPanel()}`;
}

export function renderOutlines(args) {
  return renderOutlinesLegacy(args).replace('<p class="eyebrow">手册结构治理</p>', '').replace('<p class="muted">查找手册并继续处理大纲。</p>', '');
}
