import { canSaveHandbookDraft, handbookReviewAction } from './handbook-actions.js';
export { canSaveHandbookDraft, handbookReviewAction } from './handbook-actions.js';
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
  return '';
}

function renderedDocument(document, ui, templateProjection) {
  const repo = repositoryFor(ui);
  const file = repositoryDocument(repo, document.id);
  const markdown = documentMarkdown(document, ui, templateProjection);
  if (!markdown.trim()) return `<section class="handbook-empty-intro"><div class="handbook-empty-symbol"><i data-lucide="file-pen-line" aria-hidden="true"></i></div><h2>从这里开始，完善这篇文档</h2><p>当前还没有正文。你可以直接编写，也可以让 AI 根据写作要求生成初稿。</p><div class="handbook-empty-actions"><button type="button" class="button" data-handbook-ai-action="generate"><i data-lucide="sparkles" aria-hidden="true"></i>AI 生成初稿</button><button type="button" class="button secondary" data-handbook-mode="edit" data-document-id="${escapeHtml(document.id)}" ${ui?.serverDrafts?.[document.id]?.capabilities?.canEdit === false ? 'disabled' : ''}><i data-lucide="square-pen" aria-hidden="true"></i>开始编写</button></div><p class="handbook-empty-hint">AI 生成内容先预览，由你确认采用。</p></section>`;
  return renderDatabaseMarkdown(safeMarkdown, markdown, file?.path || '', { handbookId: repo.handbookId, branch: repo.branch, language: repo.language || 'zh' }).html;
}

function markdownPreview(document, markdown, ui) {
  const repo = repositoryFor(ui);
  const file = repositoryDocument(repo, document.id);
  return renderDatabaseMarkdown(safeMarkdown, markdown, file?.path || '', { handbookId: repo.handbookId, branch: repo.branch, language: repo.language || 'zh' }).html;
}

export function documentStatus(document, ui, branch = '') {
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
    const selected = context.selectedId === id;
    const checked = context.selectedForReview.has(id);
    const status = documentStatus(document, context.ui, context.ui?.repository?.branch || '');
    return `<li class="handbook-production-document${selected ? ' selected' : ''}"><button type="button" data-handbook-document="${escapeHtml(id)}"${selected ? ' aria-current="page"' : ''}><span class="handbook-document-icon" aria-hidden="true"></span><span><strong>${escapeHtml(displayTitle(title))}</strong><small${status === '未编辑' ? ' hidden' : ''}>${escapeHtml(status)}</small></span>${checked ? '<em>待评审</em>' : ''}</button></li>`;
  }
  const groupKey = [...(context.parentPath || []), title].join('/');
  // Reuse the traversal context for large directories; copying the full context
  // and path for every child creates avoidable allocation and GC pressure.
  const parentPath = context.parentPath || (context.parentPath = []);
  parentPath.push(title);
  const visibleChildren = [];
  children.forEach((child, childIndex) => {
    const rendered = directoryNode(child, context, depth + 1, childIndex);
    if (rendered) visibleChildren.push(rendered);
  });
  parentPath.pop();
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
  return `<button class="handbook-directory-backdrop${ui.directoryDrawerOpen ? ' is-open' : ''}" type="button" data-handbook-directory-close aria-label="关闭文档目录"></button><aside class="handbook-production-directory${ui.directoryDrawerOpen ? ' is-open' : ''}" id="handbook-directory-drawer" data-directory-tree data-scroll-region="drawer" aria-label="当前手册目录" aria-hidden="${!ui.directoryDrawerOpen}"><header><div><h2>手册目录</h2><span>${mode === 'mine' ? `只看我负责 · ${visible.length} 篇` : `${visible.length} 篇文档`}</span></div><button class="icon-button handbook-directory-collapse" type="button" data-handbook-directory-close aria-label="关闭文档目录"><i data-lucide="list-tree" aria-hidden="true"></i></button><div class="handbook-production-directory-mode" role="group" aria-label="目录显示范围"><button type="button" data-handbook-directory-mode="all" aria-pressed="${mode === 'all'}">全部文档</button><button type="button" data-handbook-directory-mode="mine" aria-pressed="${mode === 'mine'}">只看我负责</button></div><label class="handbook-directory-search"><span class="sr-only">搜索文档目录</span><input type="search" placeholder="搜索目录" data-directory-search data-handbook-directory-search></label></header><div class="handbook-production-directory-scroll" data-scroll-region="panel">${tree ? `<ul>${tree}</ul>` : `<div class="handbook-production-empty"><i data-lucide="inbox" aria-hidden="true"></i><strong>${mode === 'mine' ? '当前没有由你负责的文档' : '当前手册没有可编辑文档'}</strong><span>${mode === 'mine' ? '可以切换到“全部文档”查看完整目录。' : '请先在大纲管理中建立并发布目录。'}</span>${mode === 'mine' ? '<button class="button tertiary compact" type="button" data-handbook-directory-mode="all">查看全部文档</button>' : ''}</div>`}</div></aside>`;
}


function editor(document, outline, ui, templateProjection) {
  if (!document) return `<main class="handbook-production-editor"><div class="handbook-production-empty-actions"><button class="button secondary" type="button" data-handbook-directory-open aria-controls="handbook-directory-drawer" aria-expanded="${Boolean(ui.directoryDrawerOpen)}"><i data-lucide="panel-left-open" aria-hidden="true"></i>打开文档目录</button></div>${emptyState('选择一个文档', '从文档目录选择需要编写的文档。')}</main>`;
  const repo = repositoryFor(ui);
  const loadState = ui.draftLoadState?.[document.id];
  const pendingHeader = `<header class="handbook-production-toolbar"><div class="handbook-command-document"><button class="button tertiary compact handbook-directory-entry" type="button" data-handbook-directory-open aria-controls="handbook-directory-drawer" aria-expanded="${Boolean(ui.directoryDrawerOpen)}"><i data-lucide="panel-left-open" aria-hidden="true"></i>目录</button><div><h2 data-handbook-document-title>${escapeHtml(displayTitle(document.title))}</h2><p>${escapeHtml(document.path.join(' / ') || '手册根目录')}</p></div></div></header>`;
  if (loadState === 'loading' || (repo.status === 'loading' && !ui.serverDrafts?.[document.id]?.exists && loadState === 'ready')) {
    return `<main class="handbook-production-editor is-reading" data-handbook-current-document="${escapeHtml(document.id)}" aria-busy="true">${pendingHeader}<section class="handbook-production-writing"><div class="handbook-production-content is-reading"><span class="sr-only" role="status">正在加载文档</span><div class="handbook-document-skeleton" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div></div></section></main>`;
  }
  if (loadState === 'forbidden' || (loadState === 'failed' && !ui.draftContextResolved)) {
    return `<main class="handbook-production-editor" data-handbook-current-document="${escapeHtml(document.id)}">${pendingHeader}<section class="handbook-production-writing"><p role="alert">${loadState === 'forbidden' ? '当前账号无共享草稿访问权限。' : '当前文档读取失败，请刷新后重试。'}</p></section></main>`;
  }
  const branch = repo.branch || '';
  const mode = ui.modeByDocument?.[document.id] === 'edit' ? 'edit' : 'read';
  const editorFormat = ui.editorFormatByDocument?.[document.id] === 'markdown' ? 'markdown' : 'rich';
  const server = ui.serverDrafts?.[document.id];
  const status = documentStatus(document, ui);
  const dirty = ui.dirtyDocuments?.includes(document.id);
  // Markdown 是草稿与审核快照的正文事实源；预览统一走审核页的共享渲染器。
  const content = renderedDocument(document, ui, templateProjection);
  const shownTitle = displayTitle(document.title);
  const templates = list(templateProjection?.items).filter(item => item.status !== 'disabled');
  const template = selectedTemplate(document, ui, templateProjection);
  const reviewState = server?.draft?.reviewState;
  // 单篇结论优先，其他篇退回不能覆盖本篇已通过或待审状态。
  const effectiveReviewStatus = reviewState?.reviewStatus || reviewState?.taskState;
  const reviewStatusLabel = effectiveReviewStatus === 'rejected'
    ? '已退回，请修改后重新提交'
    : effectiveReviewStatus === 'approved'
      ? '该篇已通过审核'
      : reviewState?.revisionId ? '审核中' : '';
  const deliveryStatus = reviewState?.taskState === 'mr_submitted' ? ` · ${reviewState.completion?.label || '交付状态待确认'}` : '';
  const reviewStatus = reviewState?.revisionId
    ? `${reviewStatusLabel}${deliveryStatus} · 审核版本 v${reviewState.editVersion || Math.max(1, Number(server.draft.editVersion || 1) - 1)} · 工作草稿 v${server.draft.editVersion}` : '';
  const saveState = ui.draftSaveState?.[document.id];
  const draftLoadState = ui.draftLoadState?.[document.id];
  const draftServiceAvailable = draftLoadState === 'ready';
  const savedTime = server?.draft?.updatedAt ? new Date(server.draft.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
  const saveStatus = saveState?.status === 'saving' ? '保存中'
    : saveState?.status === 'failed' ? '保存失败'
      : saveState?.status === 'conflict' ? '版本冲突'
        : dirty ? '有未保存修改'
          : server?.exists ? `已保存 v${server.draft.editVersion} · ${savedTime}` : '尚未保存为共享草稿';
  const canEdit = server?.capabilities?.canEdit !== false;
  const outlineId = first(outline.id, outline.outlineId, outline.versionId, '');
  const saveError = ['failed', 'conflict'].includes(saveState?.status);
  const draftAvailability = draftLoadState === 'failed'
    ? '<span class="handbook-draft-availability" role="status">共享草稿服务暂不可用，当前正文仍可编辑，恢复后可保存。</span>'
    : draftLoadState === 'forbidden'
      ? '<span class="handbook-draft-availability" role="status">当前账号无共享草稿访问权限。</span>'
      : '';
  const historyAction = server?.exists
    ? `<button class="handbook-menu-item" type="button" data-handbook-history="${escapeHtml(document.id)}" aria-label="历史版本"><i data-lucide="history" aria-hidden="true"></i><span>历史版本</span></button>`
    : '';
  const documentContext = `<div class="handbook-command-document"><a class="icon-button" href="/knowledge-center/assets?handbookId=${encodeURIComponent(ui.handbookId || '')}" aria-label="返回知识资产" title="返回知识资产"><i data-lucide="arrow-left" aria-hidden="true"></i></a><button class="button tertiary compact handbook-directory-entry" type="button" data-handbook-directory-open aria-controls="handbook-directory-drawer" aria-expanded="${Boolean(ui.directoryDrawerOpen)}" aria-label="切换文档目录"><i data-lucide="panel-left" aria-hidden="true"></i><span class="sr-only">目录</span></button><span class="handbook-command-breadcrumb">知识资产 <span>/</span> <strong>${escapeHtml(ui.handbookName || '当前手册')}</strong></span></div>`;
  const reviewAction = handbookReviewAction(document.id, ui);
  const reviewActionMarkup = server?.draft?.reviewState?.taskId && server.draft.reviewState.revisionId === server.draft.currentRevisionId && !dirty ? `<a class="handbook-menu-item" href="${escapeHtml(server.draft.reviewState.reviewHref)}"><i data-lucide="clipboard-check" aria-hidden="true"></i><span>查看审核任务</span></a>` : '';
  const submitReviewAction = `<button class="handbook-menu-item" type="button" data-handbook-review-current="${escapeHtml(document.id)}" ${reviewAction.disabled ? 'disabled' : ''} aria-describedby="handbook-review-hint" title="${escapeHtml(reviewAction.hint)}"><i data-lucide="send" aria-hidden="true"></i><span data-handbook-review-label>${escapeHtml(reviewAction.label)}</span></button>`;
  const discardAction = `<button class="handbook-menu-item" type="button" data-handbook-discard="${escapeHtml(document.id)}" ${dirty ? '' : 'disabled'}><i data-lucide="undo-2" aria-hidden="true"></i><span>取消修改</span></button>`;
  const secondaryActions = `<details class="handbook-more-menu" data-dismissible-menu><summary class="button tertiary compact" aria-label="更多操作"><i data-lucide="ellipsis" aria-hidden="true"></i></summary><div class="handbook-more-menu-panel"><button class="handbook-menu-item" type="button" data-handbook-ai-action="check"><i data-lucide="list-checks" aria-hidden="true"></i><span>校验</span></button>${historyAction}<button class="handbook-menu-item" type="button" data-handbook-focus-toggle aria-pressed="${Boolean(ui.focusMode)}"><i data-lucide="scan" aria-hidden="true"></i><span>${ui.focusMode ? '退出全局预览' : '全局预览'}</span></button>${submitReviewAction}${reviewActionMarkup}${discardAction}<p class="handbook-review-hint" id="handbook-review-hint" data-handbook-review-hint role="status" ${reviewAction.reason ? '' : 'hidden'}>${escapeHtml(reviewAction.reason)}</p><label class="handbook-menu-item handbook-attachment-button" ${canEdit && draftServiceAvailable ? '' : 'aria-disabled="true"'}><i data-lucide="paperclip" aria-hidden="true"></i><span>添加附件</span><input type="file" data-handbook-attachment multiple accept=".png,.jpg,.jpeg,.webp,.gif,.md,.markdown,.pdf,.docx,.xlsx" ${canEdit && draftServiceAvailable ? '' : 'disabled'}></label></div></details>`;
  const formatControls = mode === 'edit' ? `<details class="handbook-editor-format" data-dismissible-menu><summary aria-label="正文编写格式">${editorFormat === 'rich' ? '可视化编辑' : 'Markdown'} <i data-lucide="chevron-down" aria-hidden="true"></i></summary><div><button type="button" data-handbook-editor-format="rich" data-document-id="${escapeHtml(document.id)}" aria-pressed="${editorFormat === 'rich'}">可视化编辑</button><button type="button" data-handbook-editor-format="markdown" data-document-id="${escapeHtml(document.id)}" aria-pressed="${editorFormat === 'markdown'}">Markdown</button></div></details>` : '';
  const toolbarActions = `<div class="handbook-toolbar-actions"><span class="handbook-save-status${saveError ? ' is-error' : ''}" data-handbook-save-status role="${saveError ? 'alert' : 'status'}" title="${escapeHtml(saveStatus)}">${escapeHtml(saveStatus)}</span><button class="button secondary handbook-ai-primary" type="button" data-handbook-ai-action="generate"><i data-lucide="sparkles" aria-hidden="true"></i><span>AI 辅助写作</span></button><button class="button ${mode === 'edit' ? '' : 'secondary'} handbook-save-primary compact" type="button" data-handbook-draft-save="${escapeHtml(document.id)}" title="保存共享草稿" ${canSaveHandbookDraft(document.id, ui) ? '' : 'disabled'}>保存</button><button class="button ${mode === 'read' ? '' : 'secondary'}" type="button" data-handbook-mode="${mode === 'read' ? 'edit' : 'read'}" data-document-id="${escapeHtml(document.id)}" ${mode === 'read' && !canEdit ? 'disabled' : ''}>${mode === 'read' ? '编辑' : '预览'}</button>${secondaryActions}</div>`;
  const templateContext = `<input type="hidden" name="outlineId" value="${escapeHtml(outlineId)}"><input type="hidden" name="templateId" data-handbook-template data-document-id="${escapeHtml(document.id)}" value="${escapeHtml(template.id)}" ${templates.length ? '' : 'disabled'}>`;
  const currentMarkdown = documentMarkdown(document, ui, templateProjection);
  const markdownPreviewOpen = Boolean(ui.markdownPreviewByDocument?.[document.id]);
  const markdownEditor = `<div class="handbook-markdown-workspace${markdownPreviewOpen ? ' is-previewing' : ''}"><textarea class="handbook-markdown-editor" data-handbook-markdown-editor data-document-id="${escapeHtml(document.id)}" spellcheck="false" aria-label="Markdown 正文">${escapeHtml(currentMarkdown)}</textarea>${markdownPreviewOpen ? `<div class="handbook-markdown-preview repository-markdown">${markdownPreview(document, currentMarkdown, ui)}</div>` : ''}</div>`;
  const editorSurface = mode !== 'edit' ? content : editorFormat === 'markdown' ? markdownEditor : '<div class="handbook-editor-loading" role="status">正在加载编辑器…</div>';
  return `<main class="handbook-production-editor ${mode === 'edit' ? 'is-editing' : 'is-reading'}" data-handbook-current-document="${escapeHtml(document.id)}" data-outline-version-id="${escapeHtml(outlineId)}">${templateContext}<header class="handbook-production-toolbar" data-scroll-obstacle>${documentContext}${toolbarActions}</header>${draftAvailability}${reviewStatus ? `<p class="handbook-review-submission-status" role="status">${escapeHtml(reviewStatus)}</p>` : ''}<section class="handbook-production-writing">${mode === 'edit' && editorFormat === 'markdown' ? `<button class="handbook-markdown-preview-action" type="button" data-handbook-markdown-preview-toggle="${escapeHtml(document.id)}" aria-pressed="${markdownPreviewOpen}">${markdownPreviewOpen ? '返回编辑' : '显示预览'}</button>` : ''}${formatControls}<header class="handbook-document-heading"><p>${escapeHtml(document.path.join(' / ') || '手册根目录')}</p><h1 data-handbook-document-title>${escapeHtml(shownTitle)}</h1></header><div class="handbook-production-content ${mode === 'edit' ? 'is-editing' : 'is-reading'}" ${mode === 'edit' && editorFormat === 'rich' ? `data-handbook-vditor data-document-id="${escapeHtml(document.id)}"` : ''}>${editorSurface}</div><nav class="handbook-article-outline" aria-label="本篇内容" hidden></nav><div class="handbook-attachment-progress" data-handbook-attachment-progress role="status"></div>${mode === 'edit' ? '<footer class="handbook-editing-note">编辑完成后，点击右上角“保存”写入共享草稿</footer>' : ''}</section></main>`;
}

function reviewSelectionDialog(documents, ui) {
  const branch = ui?.repository?.branch || '';
  const changedIds = new Set([...Object.keys(ui.reviewDraftSummaries || {}), ...(ui.dirtyDocuments || [])]);
  const changed = documents.filter(document => changedIds.has(document.id) && (!ui.draftBranchByDocument?.[document.id] || ui.draftBranchByDocument[document.id] === branch));

  const selected = new Set(ui.selectedForReview || []);
  const items = changed.length ? changed.map(document => {
    const server = ui.serverDrafts?.[document.id];
    const summary = ui.reviewDraftSummaries?.[document.id];
    const saved = !ui.dirtyDocuments?.includes(document.id) && (server ? server.exists && !handbookReviewAction(document.id, ui).disabled : Boolean(summary));
    const version = server?.draft?.editVersion ?? summary?.editVersion;
    return `<label class="${saved ? '' : 'blocked'}"><input type="checkbox" data-handbook-review-document value="${escapeHtml(document.id)}" ${selected.has(document.id) ? 'checked' : ''} ${saved ? '' : 'disabled'}><span><strong>${escapeHtml(displayTitle(document.title))}</strong><small>${saved ? `草稿 v${version} · 可提交` : '请先保存当前修改'}</small></span></label>`;
  }).join('') : '<span class="handbook-review-empty">编辑并保存后，这里会显示可提交的文档。</span>';
  return `<dialog class="asset-dialog handbook-review-dialog" data-handbook-review-selection-dialog aria-labelledby="handbook-review-selection-title"><header class="asset-dialog-heading"><div><h2 id="handbook-review-selection-title">提交审核</h2><p>选择当前分支中已保存的草稿，再确认审核人和提交信息。</p></div><button class="icon-button asset-dialog-close" type="button" data-handbook-review-close aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header><div class="handbook-review-documents">${items}</div><p role="status" data-handbook-review-selection-status>${escapeHtml(ui.reviewSelectionStatus || '')}</p><footer><button class="button tertiary" type="button" data-handbook-review-close>取消</button><button class="button" type="button" data-handbook-review-submit ${selected.size && !ui.reviewSelectionStatus ? '' : 'disabled'}>下一步</button></footer></dialog>`;
}


function reviewDialog() {
  return `<dialog class="asset-dialog handbook-review-dialog" data-handbook-review-dialog aria-labelledby="handbook-review-dialog-title" data-scroll-region="dialog"><form data-handbook-review-form><header class="asset-dialog-heading"><div><h2 id="handbook-review-dialog-title">提交审核</h2><p>提交已保存版本到审核任务；继续编辑不会改变审核内容。审核通过后发布为 GitLab MR。</p></div><button class="icon-button asset-dialog-close" type="button" data-handbook-review-close aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header><div class="handbook-review-confirmation"><strong data-handbook-review-count>已选择 0 篇文档</strong><label>默认审核人<select name="reviewerId" data-handbook-reviewer required><option value="">请选择审核人（可以是本人）</option></select></label><div class="handbook-review-overrides" data-handbook-review-overrides aria-label="逐篇审核人设置"></div><label>提交说明<textarea name="note" rows="3" maxlength="500"></textarea></label><p role="status" data-handbook-review-dialog-status></p></div><footer><button class="button tertiary" type="button" data-handbook-review-close>取消</button><button class="button" type="submit">确认提交</button></footer></form></dialog>`;
}

function draftDialogs(ui) {
  const history = ui.history;
  const conflict = ui.conflict;
  const current = history?.documentId ? ui.serverDrafts?.[history.documentId]?.draft?.revision?.markdown || '' : '';
  const selected = list(history?.items).find(item => item.revisionId === history?.compareRevisionId);
  const comparison = selected ? `<section class="handbook-history-comparison"><div><h3>当前草稿</h3><pre>${escapeHtml(current)}</pre></div><div><h3>历史 v${selected.version}</h3><pre>${escapeHtml(selected.markdown || '')}</pre></div></section>` : '';
  return `<dialog class="asset-dialog handbook-history-dialog" data-handbook-history-dialog data-scroll-region="dialog"><div><header class="asset-dialog-heading"><div><h2>历史版本</h2><p>恢复历史版本会创建新的草稿 revision。</p></div><button class="icon-button asset-dialog-close" type="button" data-handbook-history-close aria-label="关闭"><i data-lucide="x"></i></button></header><div class="handbook-history-list" data-scroll-region="panel">${history?.loading ? '<p role="status">正在读取历史…</p>' : list(history?.items).map(item => `<article><div><strong>v${item.version}</strong><span>${escapeHtml(item.createdBy?.displayName || '未知用户')} · ${escapeHtml(new Date(item.createdAt).toLocaleString('zh-CN'))}</span></div><code>${escapeHtml(String(item.contentDigest || '').slice(0, 12))}</code><button class="button tertiary compact" type="button" data-handbook-history-compare="${escapeHtml(item.revisionId)}">查看差异</button><button class="button tertiary compact" type="button" data-handbook-history-restore="${escapeHtml(item.revisionId)}">恢复为新版本</button></article>`).join('') || '<p>暂无历史版本。</p>'}</div>${comparison}</div></dialog><dialog class="asset-dialog handbook-conflict-dialog" data-handbook-conflict-dialog data-scroll-region="dialog"><div><header class="asset-dialog-heading"><div><h2>草稿版本冲突</h2><p>服务器草稿已变化，本地内容已保留。</p></div><button class="icon-button asset-dialog-close" type="button" data-handbook-conflict-close aria-label="关闭"><i data-lucide="x"></i></button></header><div class="handbook-conflict-columns"><label>本地内容<textarea readonly>${escapeHtml(conflict?.localMarkdown || '')}</textarea></label><label>服务器内容<textarea readonly>${escapeHtml(conflict?.serverDraft?.revision?.markdown || '')}</textarea></div><footer><button class="button tertiary" type="button" data-handbook-conflict-copy>复制本地内容</button><button class="button secondary" type="button" data-handbook-conflict-reload>重新载入服务器版本</button><button class="button" type="button" data-handbook-conflict-merge>保留本地并人工合并</button></footer></div></dialog>`;
}

export function renderHandbookProduction({ projection, currentUser, ui = {}, templateProjection = {}, region = 'page' }) {
  const handbookWorkspace = projection?.handbookOutline;
  const handbookId = projection?.requestedHandbookId || '';
  if (projection?.status === 'loading') return '<section class="handbook-production-loading" role="status"><span></span><p>正在读取手册目录…</p></section>';
  if (!handbookWorkspace) return `<section class="handbook-production-error"><a href="/knowledge-center/assets">返回知识资产</a>${emptyState('手册工作区暂时不可用', projection?.error?.message || '请稍后重新读取。')}</section>`;
  if (handbookWorkspace.status !== 'ok') return `<section class="handbook-production-error"><a href="/knowledge-center/assets">返回知识资产</a>${emptyState(handbookWorkspace.status === 'forbidden' ? '无权访问当前手册' : handbookWorkspace.status === 'not_found' ? '当前手册不存在' : handbookWorkspace.status === 'empty' ? '当前手册尚未建立大纲' : '手册目录暂时不可用', handbookWorkspace.error?.message || '请先完成大纲建设，或稍后重新读取。')}</section>`;
  const outline = handbookWorkspace.detail || {};
  const documents = collectDocuments(outlineNodes(outline));
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('view') === 'mine' ? 'mine' : 'all';
  const visible = mode === 'mine' ? documents.filter(document => ownedByCurrentUser(outline, document.id, currentUser)) : documents;
  const requestedId = params.get('documentId');
  const handbookName = first(handbookWorkspace.handbook?.name, outline.handbookName, outline.name, handbookId, '当前手册');
  if (requestedId && !documents.some(document => document.id === requestedId)) {
    const reason = '当前文档不在这本手册的已发布大纲中，可能已被移除。请从目录选择现有文档。';
    return `<div class="handbook-production-page"><header class="handbook-production-header"><div><a href="/knowledge-center/assets?handbookId=${encodeURIComponent(handbookId)}"><i data-lucide="arrow-left" aria-hidden="true"></i>返回知识资产</a><h1>${escapeHtml(handbookName)}</h1></div></header><section class="handbook-production-error" role="alert"><h2>无法打开当前文档</h2><p>${escapeHtml(reason)}</p><a class="button secondary" href="/knowledge-center/production/handbook/${encodeURIComponent(handbookId)}">打开可访问目录</a></section></div>`;
  }
  if (requestedId && mode === 'mine' && !visible.some(document => document.id === requestedId)) {
    return `<div class="handbook-production-page"><header class="handbook-production-header"><div><a href="/knowledge-center/assets?handbookId=${encodeURIComponent(handbookId)}"><i data-lucide="arrow-left" aria-hidden="true"></i>返回知识资产</a><h1>${escapeHtml(handbookName)}</h1></div></header><section class="handbook-production-error" role="status"><h2>当前文档不在“只看我负责”范围</h2><p>这是一项目录过滤条件，不代表文档访问权限。切换到全部文档后可继续查看。</p><a class="button secondary" href="/knowledge-center/production/handbook/${encodeURIComponent(handbookId)}?documentId=${encodeURIComponent(requestedId)}">查看全部文档</a></section></div>`;
  }
  const selected = visible.find(document => document.id === requestedId) || visible[0] || null;
  if (!ui.directoryInitialized) { ui.directoryDrawerOpen = window.matchMedia('(min-width: 1001px)').matches; ui.directoryInitialized = true; }
  const editorHtml = editor(selected, outline, { ...ui, handbookName, handbookId }, templateProjection);
  const dialogsHtml = `${reviewSelectionDialog(documents, ui)}${reviewDialog()}${draftDialogs(ui)}`;
  if (region === 'editor') return editorHtml + dialogsHtml;
  const editorWorkspace = `<div class="handbook-production-layout" id="handbook-production-directory">${directory(outline, documents, selected?.id || '', mode, ui, currentUser)}${editorHtml}</div>`;
  return `<div class="handbook-production-page${ui.focusMode ? ' is-focus-mode' : ''}">${editorWorkspace}${dialogsHtml}</div>`;
}

export { collectDocuments, ownedByCurrentUser, outlineNodes };
