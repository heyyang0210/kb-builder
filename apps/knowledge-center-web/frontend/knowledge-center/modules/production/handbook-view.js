import { emptyState } from '../../common/components/ui.js';
import { escapeHtml } from '../../common/utils/dom.js';
import { safeMarkdown } from '../repository/view.js';
import { renderDatabaseMarkdown } from '../../common/markdown/markdown-renderer.js';

const first = (...values) => values.find(value => value !== undefined && value !== null && value !== '');
const list = value => Array.isArray(value) ? value : [];

function nodeChildren(item = {}) {
  return [...list(item.children), ...list(item.nodes), ...list(item.chapters), ...list(item.documents), ...list(item.knowledgePoints)];
}

function nodeTitle(item = {}) {
  return String(first(item.title, item.name, item.displayName, item.part, item.code, '未命名目录条目'));
}

function isDocument(item = {}) {
  return item.kind === 'document' || item.legacyKind === 'knowledge_point' || item.type === 'document' || Boolean(item.documentId);
}

function collectDocuments(items, path = [], output = []) {
  [...list(items)].sort((a, b) => Number(a.order || 0) - Number(b.order || 0)).forEach((item, index) => {
    const title = nodeTitle(item);
    if (isDocument(item)) {
      const rawPath = first(item.path, item.outlinePath, item.directoryPath, item.parentPath, '');
      const documentPath = rawPath && typeof rawPath === 'string'
        ? rawPath.split('/').map(value => value.trim()).filter(Boolean).slice(0, -1)
        : path;
      output.push({
        id: String(first(item.id, item.documentId, item.sourceId, `document-${index + 1}`)),
        sourceId: String(first(item.sourceId, item.documentId, '')),
        title,
        path: documentPath,
        item,
      });
      return;
    }
    collectDocuments(nodeChildren(item), [...path, title], output);
  });
  return output;
}

function directoryProjection(documents) {
  const root = { children: [] };
  const groups = new Map();
  const ensureGroup = (parent, title) => {
    const key = `${parent.__key || ''}/${title}`;
    let group = groups.get(key);
    if (!group) {
      group = { title, children: [], __key: key };
      groups.set(key, group);
      parent.children.push(group);
    }
    return group;
  };
  documents.forEach(document => {
    let parent = root;
    document.path.forEach(title => { parent = ensureGroup(parent, title); });
    parent.children.push({ kind: 'document', id: document.id, documentId: document.id, title: document.title });
  });
  return root.children;
}

function outlineNodes(outline = {}) {
  const raw = list(first(outline.nodes, outline.tree, outline.chapters, outline.content?.parts, outline.content?.chapters, outline.parts, []));
  if (!raw.length || raw.some(item => nodeChildren(item).length)) return raw;
  if (!raw.some(item => item.parentId)) return raw;
  const byId = new Map(raw.map(item => [String(first(item.id, item.documentId, item.sourceId, '')), { ...item, children: [] }]));
  const roots = [];
  byId.forEach(item => {
    const parent = item.parentId ? byId.get(String(item.parentId)) : null;
    if (parent) parent.children.push(item);
    else roots.push(item);
  });
  return roots;
}

function assignmentFor(outline, documentId) {
  return list(outline?.governance?.effectiveDocumentAssignments || outline?.effectiveDocumentAssignments)
    .find(item => String(item.nodeId || item.documentId) === String(documentId));
}

function ownersFor(outline, documentId) {
  const assignment = assignmentFor(outline, documentId);
  const ownerships = list(assignment?.ownerships);
  return ownerships.map(item => ({
    id: String(first(item.assigneeId, item.userId, '')),
    name: String(first(item.assigneeName, item.displayName, item.name, '待分派')),
  }));
}

function ownedByCurrentUser(outline, documentId, currentUser = {}) {
  const ids = new Set([currentUser.id, currentUser.userId, currentUser.principalId]
    .map(value => String(value || '').trim()).filter(Boolean));
  const names = new Set([currentUser.displayName, currentUser.name, currentUser.username, currentUser.loginName]
    .map(value => String(value || '').trim()).filter(Boolean));
  return ownersFor(outline, documentId).some(owner => (
    (owner.id && ids.has(owner.id)) || (owner.name && names.has(owner.name))
  ));
}

function initialContent(document = {}) {
  return String(first(document.item?.body, document.item?.content, document.item?.description, document.item?.desc, ''));
}

function repositoryFor(ui) {
  return ui?.repository || {};
}

function repositoryDocument(repository, documentId) {
  return repository?.filesByDocument?.[documentId] || null;
}

function safeDraftHtml(value) {
  return String(value || '')
    .replace(/<(script|style|iframe|object|embed|form)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:href|src)\s*=\s*["']\s*(?:javascript|vbscript|data):[^"']*["']/gi, '')
    .replace(/<(?!\/?(?:article|h[1-6]|p|ul|ol|li|blockquote|pre|code|table|thead|tbody|tr|th|td|a|img|strong|em|del|br|hr)(?:\s|>|\/))/gi, '&lt;');
}

function selectedTemplate(document, ui, templateProjection) {
  const templates = list(templateProjection?.items).filter(item => item.status !== 'disabled');
  const templateId = ui?.templateByDocument?.[document.id] || first(templates.find(item => item.status === 'active')?.id, templates[0]?.id, '');
  const summary = templates.find(item => String(item.id) === String(templateId));
  const detail = ui?.templateDetails?.[templateId];
  return { id: String(templateId || ''), summary, detail, content: String(first(detail?.current?.content, detail?.content, '')) };
}

function documentMarkdown(document, ui, templateProjection) {
  const repo = repositoryFor(ui);
  const branch = repo.branch || '';
  const branchMatches = !branch || !ui?.draftBranchByDocument?.[document.id] || ui.draftBranchByDocument[document.id] === branch;
  if (branchMatches && ui?.drafts?.[document.id] !== undefined) return String(ui.drafts[document.id]);
  const serverRevision = ui?.serverDrafts?.[document.id]?.draft?.revision;
  if (serverRevision) return String(serverRevision.markdown || '');
  const file = repositoryDocument(repo, document.id);
  const repositoryContent = file?.matched ? String(repo.contentByDocument?.[document.id] ?? '') : '';
  if (repositoryContent.trim()) return repositoryContent;
  const template = selectedTemplate(document, ui, templateProjection);
  if (template.content) return template.content;
  return repo?.mapped ? '' : initialContent(document);
}

function renderedDocument(document, ui, templateProjection) {
  const repo = repositoryFor(ui);
  const file = repositoryDocument(repo, document.id);
  const markdown = documentMarkdown(document, ui, templateProjection);
  if (!markdown) return '<div class="handbook-production-content-empty"><strong>请选择当前文档的模板</strong><span>选择模板后，这里会直接展示可编辑的文档结构。</span></div>';
  return renderDatabaseMarkdown(safeMarkdown, markdown, file?.path || '', { handbookId: repo.handbookId, branch: repo.branch, language: repo.language || 'zh' }).html;
}

function documentStatus(document, ui, branch = '') {
  const branchMatches = !branch || !ui?.draftBranchByDocument?.[document.id] || ui.draftBranchByDocument[document.id] === branch;
  if (!branchMatches) return '未编辑';
  if (ui?.dirtyDocuments?.includes(document.id)) return '未保存';
  if (ui?.serverDrafts?.[document.id]?.exists) return `草稿 v${ui.serverDrafts[document.id].draft?.editVersion || 0}`;
  return '未编辑';
}

function displayTitle(title) {
  return String(title || '').replace(/^\d+[-_\s]*/, '').replace(/\.(md|markdown)$/i, '').trim() || '未命名文档';
}

function statusClass(status) {
  return status.startsWith('草稿') || status === '未保存' ? 'is-draft' : 'is-idle';
}

function option(value, label, selected) {
  return `<option value="${escapeHtml(String(value))}" ${String(value) === String(selected) ? 'selected' : ''}>${escapeHtml(String(label))}</option>`;
}

function directoryNode(item, context, depth = 0, index = 0) {
  const children = nodeChildren(item);
  const title = nodeTitle(item);
  if (isDocument(item)) {
    const id = String(first(item.id, item.documentId, item.sourceId, `document-${index + 1}`));
    const document = context.byId.get(id);
    if (!document || !context.visibleIds.has(id)) return '';
    const owners = ownersFor(context.outline, id);
    const selected = context.selectedId === id;
    const checked = context.selectedForReview.has(id);
    const status = documentStatus(document, context.ui, context.ui?.repository?.branch || '');
    return `<li class="handbook-production-document${selected ? ' selected' : ''}"><button type="button" data-handbook-document="${escapeHtml(id)}"${selected ? ' aria-current="page"' : ''}><i data-lucide="file-text" aria-hidden="true"></i><span><strong>${escapeHtml(displayTitle(title))}</strong><small>${escapeHtml(status)}</small></span>${checked ? '<em>待评审</em>' : ''}</button></li>`;
  }
  const groupKey = [...(context.parentPath || []), title].join('/');
  const visibleChildren = children.map((child, childIndex) => directoryNode(child, { ...context, parentPath: [...(context.parentPath || []), title] }, depth + 1, childIndex)).filter(Boolean);
  if (!visibleChildren.length) return '';
  const open = context.ui.directoryOpen?.[groupKey] ?? (depth === 0 || visibleChildren.some(child => child.includes('aria-current="page"')));
  return `<li class="handbook-production-group"><details data-handbook-directory-group="${escapeHtml(groupKey)}"${open ? ' open' : ''}><summary><i data-lucide="folder" aria-hidden="true"></i><span>${escapeHtml(title)}</span></summary><ul>${visibleChildren.join('')}</ul></details></li>`;
}

function directory(outline, documents, selectedId, mode, ui, currentUser) {
  const visible = mode === 'mine' ? documents.filter(document => ownedByCurrentUser(outline, document.id, currentUser)) : documents;
  const visibleIds = new Set(visible.map(document => document.id));
  const context = {
    outline,
    byId: new Map(documents.map(document => [document.id, document])),
    visibleIds,
    selectedId,
    selectedForReview: new Set(ui.selectedForReview || []),
    ui,
    parentPath: [],
  };
  const sourceNodes = documents.some(document => document.path.length)
    ? directoryProjection(documents)
    : outlineNodes(outline);
  const tree = sourceNodes.map((item, index) => directoryNode(item, context, 0, index)).filter(Boolean).join('');
  return `<aside class="handbook-production-directory" data-navigation-pane data-directory-tree aria-label="当前手册目录"><header><div><h2>文档目录</h2><span>${mode === 'mine' ? `只看我负责 · ${visible.length} 篇` : `${visible.length} 篇文档`}</span></div><div class="handbook-production-directory-mode" role="group" aria-label="目录显示范围"><button type="button" data-handbook-directory-mode="all" aria-pressed="${mode === 'all'}">全部文档</button><button type="button" data-handbook-directory-mode="mine" aria-pressed="${mode === 'mine'}">只看我负责</button></div><label class="handbook-directory-search"><span class="sr-only">搜索文档目录</span><input type="search" placeholder="搜索文档目录" data-directory-search data-handbook-directory-search></label><button class="icon-button handbook-directory-collapse" type="button" data-navigation-pane-toggle aria-label="收起文档目录" title="收起文档目录"><i data-lucide="panel-left-close" aria-hidden="true"></i></button></header><div class="handbook-production-directory-scroll">${tree ? `<ul>${tree}</ul>` : `<div class="handbook-production-empty"><i data-lucide="inbox" aria-hidden="true"></i><strong>${mode === 'mine' ? '当前没有由你负责的文档' : '当前手册没有可编辑文档'}</strong><span>${mode === 'mine' ? '可以切换到“全部文档”查看完整目录。' : '请先在大纲管理中建立并发布目录。'}</span>${mode === 'mine' ? '<button class="button tertiary compact" type="button" data-handbook-directory-mode="all">查看全部文档</button>' : ''}</div>`}</div><div class="handbook-directory-resizer" data-navigation-pane-resizer role="separator" aria-orientation="vertical" aria-label="调整手册文档目录宽度" aria-valuemin="220" aria-valuemax="360" aria-valuenow="260" tabindex="0"></div><footer><button class="button tertiary compact" type="button" data-handbook-add-chapter><i data-lucide="plus" aria-hidden="true"></i>新增章节</button><span>需先更新发布大纲</span></footer></aside>`;
}

function references(documentId, ui) {
  const items = list(ui.references?.[documentId]);
  if (!items.length) return '<p class="handbook-reference-empty">尚未接入参考资料。</p>';
  return `<ul class="handbook-reference-list">${items.map((item, index) => `<li><i data-lucide="${item.type === 'pingcode' ? 'link' : 'file-text'}" aria-hidden="true"></i><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.type === 'pingcode' ? 'PingCode 页面 · 前端暂存' : 'Markdown 文件 · 前端暂存')}</small></span><button class="icon-button" type="button" data-handbook-reference-remove="${index}" data-document-id="${escapeHtml(documentId)}" aria-label="移除参考资料 ${escapeHtml(item.name)}"><i data-lucide="x" aria-hidden="true"></i></button></li>`).join('')}</ul>`;
}

function editor(document, outline, ui, templateProjection) {
  if (!document) return `<main class="handbook-production-editor">${emptyState('选择一个文档', '从左侧目录选择需要编写的文档。')}</main>`;
  const repo = repositoryFor(ui);
  const branch = repo.branch || '';
  const mode = ui.modeByDocument?.[document.id] === 'edit' ? 'edit' : 'read';
  const branchDraft = ui.draftBranchByDocument?.[document.id] === branch;
  const server = ui.serverDrafts?.[document.id];
  const revision = server?.draft?.revision;
  const draftHtml = branchDraft ? (ui.draftHtml?.[document.id] || revision?.htmlSnapshot || '') : (revision?.htmlSnapshot || '');
  const status = documentStatus(document, ui);
  const dirty = ui.dirtyDocuments?.includes(document.id);
  const content = draftHtml ? safeDraftHtml(draftHtml) : renderedDocument(document, ui, templateProjection);
  const shownTitle = displayTitle(document.title);
  const templates = list(templateProjection?.items).filter(item => item.status !== 'disabled');
  const template = selectedTemplate(document, ui, templateProjection);
  const templateOptions = templates.length
    ? templates.map(item => option(item.id, `${item.name || item.title || '未命名模板'}${item.version ? ` · ${item.version}` : ''}`, template.id)).join('')
    : '<option value="">暂无可用模板</option>';
  const templateStatusBase = ui.templateStatus || (template.id && !template.detail ? '正在读取模板…' : '');
  const reviewStatus = server?.draft?.reviewState?.revisionId
    ? `评审中 v${Math.max(1, Number(server.draft.editVersion || 1) - 1)} · 工作草稿 v${server.draft.editVersion}` : '';
  const templateStatus = [templateStatusBase, reviewStatus].filter(Boolean).join('；');
  const saveState = ui.draftSaveState?.[document.id];
  const draftLoadState = ui.draftLoadState?.[document.id];
  const draftServiceAvailable = draftLoadState === 'ready';
  const savedTime = server?.draft?.updatedAt ? new Date(server.draft.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
  const saveStatus = saveState?.status === 'saving' ? '保存中'
    : saveState?.status === 'failed' ? '保存失败'
      : saveState?.status === 'conflict' ? '版本冲突'
        : dirty ? '有未保存修改'
          : server?.exists ? `已保存 v${server.draft.editVersion} · ${savedTime}` : '未修改';
  const canEdit = server?.capabilities?.canEdit !== false;
  const outlineId = first(outline.id, outline.outlineId, outline.versionId, '');
  const saveError = ['failed', 'conflict'].includes(saveState?.status);
  const draftAvailability = draftLoadState === 'failed'
    ? '<span class="handbook-draft-availability" role="status">共享草稿服务暂不可用，当前正文仍可编辑，恢复后可保存。</span>'
    : draftLoadState === 'forbidden'
      ? '<span class="handbook-draft-availability" role="status">当前账号无共享草稿访问权限。</span>'
      : '';
  const historyAction = server?.exists
    ? `<button class="icon-button" type="button" data-handbook-history="${escapeHtml(document.id)}" aria-label="查看草稿历史" title="查看草稿历史"><i data-lucide="history" aria-hidden="true"></i></button>`
    : '';
  const documentContext = `<div class="handbook-command-document"><a href="#handbook-production-directory" class="handbook-production-mobile-back" data-handbook-mobile-directory><i data-lucide="arrow-left" aria-hidden="true"></i>返回目录</a><div><h2>${escapeHtml(shownTitle)}</h2><p>${escapeHtml(document.path.join(' / ') || '手册根目录')}</p></div><span class="handbook-production-document-state ${statusClass(status)}">${escapeHtml(status)}</span></div>`;
  const toolbarActions = `<div class="handbook-toolbar-actions"><div class="handbook-production-mode" role="group" aria-label="正文显示模式"><button type="button" data-handbook-mode="read" data-document-id="${escapeHtml(document.id)}" aria-pressed="${mode === 'read'}">预览</button><button type="button" data-handbook-mode="edit" data-document-id="${escapeHtml(document.id)}" aria-pressed="${mode === 'edit'}" ${canEdit ? '' : 'disabled'}>编辑</button></div><span class="handbook-save-status${saveError ? ' is-error' : ''}" data-handbook-save-status role="${saveError ? 'alert' : 'status'}">${escapeHtml(saveStatus)}</span><button class="button compact" type="button" data-handbook-draft-save="${escapeHtml(document.id)}" title="${draftServiceAvailable ? '保存共享草稿' : '共享草稿服务恢复后可保存'}" ${dirty && draftServiceAvailable && saveState?.status !== 'saving' ? '' : 'disabled'}>保存</button><button class="icon-button handbook-assistant-mobile-open" type="button" data-handbook-assistant-open aria-label="打开辅助工具" title="打开辅助工具"><i data-lucide="panel-right-open" aria-hidden="true"></i></button></div>`;
  const secondaryActions = `<div class="handbook-document-options-actions">${historyAction}<label class="icon-button handbook-attachment-button" aria-label="上传图片或附件" title="上传图片或附件"><i data-lucide="paperclip" aria-hidden="true"></i><input type="file" data-handbook-attachment multiple accept=".png,.jpg,.jpeg,.webp,.gif,.md,.markdown,.pdf,.docx,.xlsx" ${canEdit && draftServiceAvailable ? '' : 'disabled'}></label><button class="button tertiary compact" type="button" data-handbook-discard="${escapeHtml(document.id)}" ${dirty ? '' : 'disabled'}>取消</button><button class="icon-button handbook-global-preview" type="button" data-handbook-focus-toggle aria-label="${ui.focusMode ? '退出全局预览' : '全局预览'}" title="${ui.focusMode ? '退出全局预览' : '全局预览'}" aria-pressed="${Boolean(ui.focusMode)}"><i data-lucide="${ui.focusMode ? 'minimize-2' : 'maximize-2'}" aria-hidden="true"></i></button></div>`;
  const templateContext = `<div class="handbook-document-options"><input type="hidden" name="outlineId" value="${escapeHtml(outlineId)}"><label class="handbook-document-template"><span>文档模板</span><select name="templateId" data-handbook-template data-document-id="${escapeHtml(document.id)}" ${templates.length ? '' : 'disabled'}>${templateOptions}</select></label><span class="handbook-template-status" role="status">${escapeHtml(templateStatus)}</span>${draftAvailability}${secondaryActions}</div>`;
  return `<main class="handbook-production-editor ${mode === 'edit' ? 'is-editing' : 'is-reading'}" data-handbook-current-document="${escapeHtml(document.id)}" data-outline-version-id="${escapeHtml(outlineId)}"><header class="handbook-production-toolbar">${documentContext}${toolbarActions}</header>${templateContext}<section class="handbook-production-writing"><div class="handbook-production-content ${mode === 'edit' ? 'is-editing' : 'is-reading'}" ${mode === 'edit' ? `data-handbook-vditor data-document-id="${escapeHtml(document.id)}"` : ''}>${mode === 'edit' ? '<div class="handbook-editor-loading" role="status">正在加载编辑器…</div>' : content}</div><div class="handbook-attachment-progress" data-handbook-attachment-progress role="status"></div></section></main>`;
}

function assistantPanel(document, outline, ui) {
  if (!document) return '<aside class="handbook-assistant-panel"></aside>';
  const active = ui.assistantTab || 'ai';
  const owners = ownersFor(outline, document.id);
  const tabs = [['ai', 'AI助手'], ['properties', '属性'], ['references', '引用资料']];
  const ai = `<section class="handbook-assistant-section"><header><i data-lucide="sparkles" aria-hidden="true"></i><div><h3>AI助手</h3><p>仅作用于当前文档草稿</p></div></header><div class="handbook-ai-actions"><button type="button" data-handbook-ai-action="generate"><i data-lucide="wand-sparkles" aria-hidden="true"></i><span><strong>生成本节</strong><small>基于大纲、模板和引用资料</small></span></button><button type="button" data-handbook-ai-action="polish"><i data-lucide="pen-line" aria-hidden="true"></i><span><strong>润色</strong><small>优化当前正文表达</small></span></button><button type="button" data-handbook-ai-action="check"><i data-lucide="badge-check" aria-hidden="true"></i><span><strong>检查</strong><small>检查结构、占位符和规范</small></span></button></div><p class="handbook-assistant-status" role="status">${escapeHtml(ui.assistantStatus || 'AI 生成接口待接入，人工编辑可正常使用。')}</p></section>`;
  const properties = `<section class="handbook-assistant-section"><header><i data-lucide="sliders-horizontal" aria-hidden="true"></i><div><h3>文档属性</h3><p>当前文档的业务信息</p></div></header><dl class="handbook-property-list"><div><dt>路径</dt><dd>${escapeHtml(document.path.join(' / ') || '手册根目录')}</dd></div><div><dt>责任人</dt><dd>${escapeHtml(owners.map(item => item.name).join('、') || '未分配')}</dd></div><div><dt>草稿状态</dt><dd>${escapeHtml(documentStatus(document, ui))}</dd></div></dl></section>`;
  const refs = `<section class="handbook-assistant-section"><header><i data-lucide="paperclip" aria-hidden="true"></i><div><h3>引用资料</h3><p>PingCode 页面或 Markdown 文件</p></div></header>${references(document.id, ui)}<button class="button secondary handbook-reference-add" type="button" data-handbook-reference-open="${escapeHtml(document.id)}"><i data-lucide="plus" aria-hidden="true"></i>引用资料</button><div class="handbook-related-knowledge"><h4><i data-lucide="network" aria-hidden="true"></i>关联知识</h4><p>关联知识检索能力待接入。</p></div></section>`;
  return `<button class="handbook-assistant-backdrop${ui.assistantOpen ? ' is-open' : ''}" type="button" data-handbook-assistant-close aria-label="关闭辅助工具"></button><aside class="handbook-assistant-panel${ui.assistantOpen ? ' is-open' : ''}" aria-label="AI、属性和引用资料"><header class="handbook-assistant-mobile-header"><strong>辅助工具</strong><button class="icon-button" type="button" data-handbook-assistant-close aria-label="关闭辅助工具"><i data-lucide="x" aria-hidden="true"></i></button></header><nav role="tablist" aria-label="文档辅助面板">${tabs.map(([key, label]) => `<button type="button" role="tab" data-handbook-assistant-tab="${key}" aria-selected="${active === key}">${label}</button>`).join('')}</nav>${active === 'properties' ? properties : active === 'references' ? refs : ai}</aside>`;
}

function reviewTray(documents, ui) {
  const branch = ui?.repository?.branch || '';
  const changedIds = new Set([...Object.entries(ui.serverDrafts || {}).filter(([, value]) => value?.exists).map(([id]) => id), ...(ui.dirtyDocuments || [])]);
  const changed = documents.filter(document => changedIds.has(document.id) && (!ui.draftBranchByDocument?.[document.id] || ui.draftBranchByDocument[document.id] === branch));
  const selected = new Set(ui.selectedForReview || []);
  const title = changed.length ? `共享草稿 · ${changed.length} 篇` : '尚未形成共享草稿';
  const hint = changed.length ? '选择可提交的草稿，进入审核与发布。' : '保存共享草稿后可在这里提交评审。';
  const items = changed.length ? changed.map(document => {
    const saved = ui.serverDrafts?.[document.id]?.exists && !ui.dirtyDocuments?.includes(document.id);
    const version = ui.serverDrafts?.[document.id]?.draft?.editVersion;
    return `<label class="${saved ? '' : 'blocked'}"><input type="checkbox" data-handbook-review-document value="${escapeHtml(document.id)}" ${selected.has(document.id) ? 'checked' : ''} ${saved ? '' : 'disabled'}><span><strong>${escapeHtml(displayTitle(document.title))}</strong><small>${saved ? `草稿 v${version} · 可提交` : '请先保存当前修改'}</small></span></label>`;
  }).join('') : '<span class="handbook-review-empty">编辑并保存后，这里会显示可提交的文档。</span>';
  return `<details class="handbook-review-tray${changed.length ? ' has-drafts' : ''}"><summary><span><strong id="handbook-review-tray-title">${escapeHtml(title)}</strong><small>${escapeHtml(hint)}</small></span><span class="handbook-review-toggle"><span>展开评审区</span><i data-lucide="chevron-down" aria-hidden="true"></i></span></summary><div class="handbook-review-panel" aria-labelledby="handbook-review-tray-title"><div class="handbook-review-documents">${items}</div><button class="button" type="button" data-handbook-review-submit ${selected.size ? '' : 'disabled'}>提交评审</button><span class="handbook-review-status" role="status">${escapeHtml(ui.reviewState?.message || '')}</span></div></details>`;
}

function referenceDialog() {
  return `<dialog class="asset-dialog handbook-reference-dialog" data-handbook-reference-dialog aria-labelledby="handbook-reference-title"><form method="dialog" data-handbook-reference-form><header class="asset-dialog-heading"><div><h2 id="handbook-reference-title">引用资料</h2><p>资料只关联当前文档；当前为前端流程，正式来源快照接口待接入。</p></div><button class="icon-button asset-dialog-close" type="button" data-handbook-reference-close aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header><input type="hidden" name="documentId"><fieldset class="handbook-reference-types"><legend>来源类型</legend><label><input type="radio" name="type" value="pingcode" checked>PingCode 页面</label><label><input type="radio" name="type" value="markdown">上传 Markdown</label></fieldset><div data-handbook-reference-pingcode><label>PingCode 页面链接<input name="url" type="url" placeholder="https://.../wiki/..." required></label><p class="muted">当前只检查链接格式；正文读取和不可变快照等待连接器接口。</p></div><div data-handbook-reference-markdown hidden><label>Markdown 文件<input name="file" type="file" accept=".md,text/markdown"></label></div><label>资料名称<input name="name" maxlength="120" placeholder="例如：参数设计说明" required></label><label>内容预览<textarea name="preview" rows="9" readonly placeholder="选择文件或填写链接后显示预览状态"></textarea></label><footer><span role="status" data-handbook-reference-status></span><button class="button tertiary" type="button" data-handbook-reference-close>取消</button><button class="button secondary" type="submit">确认引用</button></footer></form></dialog>`;
}

function reviewDialog() {
  return `<dialog class="asset-dialog handbook-review-dialog" data-handbook-review-dialog aria-labelledby="handbook-review-dialog-title"><form data-handbook-review-form><header class="asset-dialog-heading"><div><h2 id="handbook-review-dialog-title">提交评审</h2><p>提交后冻结所选草稿版本，并创建下一工作草稿。</p></div><button class="icon-button asset-dialog-close" type="button" data-handbook-review-close aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header><div class="handbook-review-confirmation"><strong data-handbook-review-count>已选择 0 篇文档</strong><label>默认审核人<select name="reviewerId" data-handbook-reviewer required><option value="">请选择非提交者审核人</option></select></label><div class="handbook-review-overrides" data-handbook-review-overrides aria-label="逐篇审核人设置"></div><label>提交说明<textarea name="note" rows="3" maxlength="500"></textarea></label><p role="status" data-handbook-review-dialog-status></p></div><footer><button class="button tertiary" type="button" data-handbook-review-close>取消</button><button class="button" type="submit">确认提交</button></footer></form></dialog>`;
}

function draftDialogs(ui) {
  const history = ui.history;
  const conflict = ui.conflict;
  return `<dialog class="asset-dialog handbook-history-dialog" data-handbook-history-dialog><div><header class="asset-dialog-heading"><div><h2>草稿版本历史</h2><p>恢复历史版本会创建新的草稿 revision。</p></div><button class="icon-button asset-dialog-close" type="button" data-handbook-history-close aria-label="关闭"><i data-lucide="x"></i></button></header><div class="handbook-history-list">${history?.loading ? '<p role="status">正在读取历史…</p>' : list(history?.items).map(item => `<article><div><strong>v${item.version}</strong><span>${escapeHtml(item.createdBy?.displayName || '未知用户')} · ${escapeHtml(new Date(item.createdAt).toLocaleString('zh-CN'))}</span></div><code>${escapeHtml(String(item.contentDigest || '').slice(0, 12))}</code><button class="button tertiary compact" type="button" data-handbook-history-restore="${escapeHtml(item.revisionId)}">恢复为新版本</button></article>`).join('') || '<p>暂无历史版本。</p>'}</div></div></dialog><dialog class="asset-dialog handbook-conflict-dialog" data-handbook-conflict-dialog><div><header class="asset-dialog-heading"><div><h2>草稿版本冲突</h2><p>服务器草稿已变化，本地内容已保留。</p></div><button class="icon-button asset-dialog-close" type="button" data-handbook-conflict-close aria-label="关闭"><i data-lucide="x"></i></button></header><div class="handbook-conflict-columns"><label>本地内容<textarea readonly>${escapeHtml(conflict?.localMarkdown || '')}</textarea></label><label>服务器内容<textarea readonly>${escapeHtml(conflict?.serverDraft?.revision?.markdown || '')}</textarea></label></div><footer><button class="button tertiary" type="button" data-handbook-conflict-copy>复制本地内容</button><button class="button secondary" type="button" data-handbook-conflict-reload>重新载入服务器版本</button><button class="button" type="button" data-handbook-conflict-merge>保留本地并人工合并</button></footer></div></dialog>`;
}

export function renderHandbookProduction({ projection, currentUser, ui = {}, templateProjection = {} }) {
  const handbookWorkspace = projection?.handbookOutline;
  const handbookId = projection?.requestedHandbookId || '';
  if (projection?.status === 'loading') return '<section class="handbook-production-loading" role="status"><span></span><p>正在读取手册目录…</p></section>';
  if (!handbookWorkspace) return `<section class="handbook-production-error"><a href="/knowledge-center/assets">返回知识资产</a>${emptyState('手册工作区暂时不可用', projection?.error?.message || '请稍后重新读取。')}</section>`;
  if (handbookWorkspace.status !== 'ok') return `<section class="handbook-production-error"><a href="/knowledge-center/assets">返回知识资产</a>${emptyState(handbookWorkspace.status === 'forbidden' ? '无权访问当前手册' : handbookWorkspace.status === 'empty' ? '当前手册尚未建立大纲' : '手册目录暂时不可用', handbookWorkspace.error?.message || '请先完成大纲建设，或稍后重新读取。')}</section>`;
  const outline = handbookWorkspace.detail || {};
  const documents = collectDocuments(outlineNodes(outline));
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('view') === 'mine' ? 'mine' : 'all';
  const visible = mode === 'mine' ? documents.filter(document => ownedByCurrentUser(outline, document.id, currentUser)) : documents;
  const requestedId = params.get('documentId');
  const selected = visible.find(document => document.id === requestedId) || visible[0] || null;
  const handbookName = first(handbookWorkspace.handbook?.name, outline.handbookName, outline.name, handbookId, '当前手册');
  const editorWorkspace = `<div class="handbook-production-layout${ui.directoryCollapsed ? ' navigation-pane-collapsed' : ''}" id="handbook-production-directory" data-navigation-layout data-navigation-layout-id="production-handbook" data-navigation-pane-label="手册文档目录" data-navigation-min="220" data-navigation-max="360" data-navigation-default="260" data-navigation-width-variable="--handbook-directory-width" style="--handbook-directory-width:${Number(ui.directoryWidth) || 260}px">${directory(outline, documents, selected?.id || '', mode, ui, currentUser)}${editor(selected, outline, ui, templateProjection)}${assistantPanel(selected, outline, ui)}</div>${reviewTray(documents, ui)}`;
  return `<div class="handbook-production-page${ui.focusMode ? ' is-focus-mode' : ''}"><header class="handbook-production-header"><div><a href="/knowledge-center/assets?handbookId=${encodeURIComponent(handbookId)}"><i data-lucide="arrow-left" aria-hidden="true"></i>返回知识资产</a><h1>${escapeHtml(handbookName)}</h1></div></header>${editorWorkspace}${referenceDialog()}${reviewDialog()}${draftDialogs(ui)}</div>`;
}

export { collectDocuments, ownedByCurrentUser };
