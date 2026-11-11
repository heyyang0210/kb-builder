import { collectDocuments, documentStatus, ownedByCurrentUser, outlineNodes, renderHandbookProduction } from './modules/production/handbook-view.js';
import { mountModelAdmin, hasModelDraft, confirmLeavingModels } from './modules/platform-admin/model-admin.js';
import { mountMcpAdmin, hasMcpDraft, confirmLeavingMcp } from './modules/platform-admin/mcp-admin.js';
import { retainWritingSelection } from './modules/production/writing-selection.js';
import { observeRepositoryImages } from './common/markdown/repository-images.js';
import { chooseMRParticipants } from './modules/review-publishing/mr-participants.js';
import { canSaveHandbookDraft, handbookReviewAction } from './modules/production/handbook-actions.js';
import { takeReviewBootstrapPrefetch } from './common/api/review-bootstrap-prefetch.js';
import { archiveAsset, createAsset, createPrincipal, createTeamGroup, deleteOutline, importOutline, validateOutline, importPrincipals, loadAssets, loadOutlineData, loadPlatformData, loadPrincipals, loadTeamGroups, loadTeamGroup, saveTeamRoster, publishOutlineGovernance, resolveAssetStatus, restoreAsset, saveOutlineGovernance, updateAsset, updateAssetStatus, updateDomainBuildTaskItem, loadDomainBuildTasks as fetchDomainBuildTasks, loadPlatformPermissions, updatePlatformUserPermissions, updatePrincipal, loadDatabaseConnectionStatus, testDatabaseConnection, saveDatabaseConnection, loadTemplates, loadTemplate, loadTemplateMappings } from './common/api/platform-api.js';
import { disconnectGitLabOAuth, handbookGitLabOAuthHref, gitLabOAuthHref, loadGitLabBranches, loadGitLabConnections, loadGitLabOAuthAccounts, loadGitLabOAuthStatus, loadGitLabOAuthConfig, loadGitLabTree, loadHandbookGitLabAccess, loadHandbookRepository, loadHandbookRepositoryCommits, loadHandbookRepositoryFile, loadHandbookRepositoryMapping, loadHandbookRepositoryStatistics, loadHandbookRepositoryTree, loadReviewRepositoryContext, saveGitLabConnection, saveHandbookRepositoryMapping, createGitLabConnection, updateGitLabConnection, verifyGitLabConnection, disableGitLabConnection, enableGitLabConnection, searchGitLabConnections, loadGitLabVersionMappings, saveGitLabVersionMapping, setGitLabVersionMappingState } from './common/api/gitlab-api.js';
import { addIncrementalSource, bootstrapBaseline, cancelIncrementalReview, commentIncrementalReview, createIncrementalReview, createIncrementalRevision, createIncrementalTask, createOnlineReview, decideIncrementalReview, loadCandidateDiff, loadHandbookReviewSummary, loadIncrementalBaselines, loadIncrementalTask, loadIncrementalTasks, loadMyGenerations, loadReviewBootstrap, loadReviewMentionTargets, publishIncrementalTask, reassignIncrementalReview, recordIncrementalEvidence, reopenIncrementalReviewComment, replyIncrementalReviewComment, resolveIncrementalReviewComment, runIncrementalChecks, saveIncrementalDraft, submitIncrementalCandidate, updateIncrementalTarget } from './common/api/incremental-api.js';
import { createHandbookIncrementalReview, loadHandbookDraft, loadHandbookDraftRevisions, loadHandbookReviewDrafts, loadHandbookReviewers, restoreHandbookDraftRevision, saveHandbookDraft, uploadHandbookDraftAttachment } from './common/api/handbook-production-api.js';
import { sha256Text } from './common/utils/sha256.js';
import { bootstrapAuth, consumeRememberedTarget, performLogout, rememberCurrentTarget, startCasLogin, submitAdminLogin } from './common/auth/auth-controller.js';
import { appState, views } from './common/state/app-state.js';
import { authState, canAccessView, canPerform, clearSession, displayName, firstAccessibleView, isPlatformAdmin } from './common/state/auth-state.js';
import { loadOutlineRecycle, outlineLifecycle } from './common/api/platform-api.js';
import { pathForView, viewFromPath, platformTabFromSearch } from './common/state/navigation.js';
import { onKnowledgeDataChanged } from './common/state/data-change.js';
import { byId, escapeHtml } from './common/utils/dom.js';
import { cleanupSearchableSelects, markDynamicSelects, syncSearchableSelect } from './common/searchable-combobox.js';
import { enhanceTableViews } from './common/table-view-configurator.js';
import { enhanceResizableNavigation } from './common/resizable-navigation-pane.js';
import { enhanceDirectoryTrees } from './common/directory-tree.js';
import { updateReviewWaitingEntry } from './modules/review-publishing/view.js';
import { initViewportRuntime } from './common/viewport-runtime.js';
import { initScrollRuntime } from './common/scroll-runtime.js';
import { initDismissibleMenus } from './common/dismissible-menu.js';
import { loadDocumentTaskWorkspace, renderDocumentTasks } from './modules/document-tasks/view.js';
import { loadDocumentTask, taskWrite } from './common/api/document-tasks-api.js';
import { loadMyTasks, MY_TASK_SOURCE_COUNT, setRefreshHandler, setResponsibleHandler, setSyncHandler, getMyTaskQueryKey, getSelectedResponsibleId, resetResponsibleSelection, updateMyTasksProjection } from './modules/dashboard/my-tasks.js';
// 预加载写作页面模块，点击时只等待实例化，不再等待网络加载模块。
const productionWritingPagePromise = import('./modules/production/production-writing-page.js');
const viewportRuntime = initViewportRuntime();
const scrollRuntime = initScrollRuntime();
const dismissibleMenus = initDismissibleMenus();
window.addEventListener('pagehide', event => {
  if (!event.persisted) { scrollRuntime.destroy(); viewportRuntime.destroy(); dismissibleMenus.destroy(); }
});
import { renderReviewPublishing, renderReviewRepositoryRegion } from './modules/review-publishing/view.js';

const renderers = {
  review: renderReviewPublishing,
  documentTasks: () => '<div data-document-task-mount></div>',
};
let assetSelectionRenderer = null;
let assetStatisticsRenderer = null;
let assetArchiveManageDialog = null;
let assetArchiveTrigger = null;
const rendererLoaders = {
  dashboard: () => import('./modules/dashboard/my-tasks.js').then(module => () => module.renderMyTasks(appState.myTasksProjection)),
  assets: () => import('./modules/assets/view.js').then(module => {
    assetSelectionRenderer = module.renderAssetSelection;
    assetStatisticsRenderer = module.renderAssetStatistics;
    return module.renderAssets;
  }),
  cleaning: () => import('./modules/cleaning/view.js').then(module => module.renderCleaning),
  outlines: () => import('./modules/outlines/view.js').then(module => module.renderOutlines),
  templates: () => Promise.all([import('./modules/templates/view.js'), import('./modules/templates/controller.js')]).then(([viewModule, controllerModule]) => {
    if (!templateController) templateController = controllerModule.createTemplateController({ appState, render, canPerform });
    return args => viewModule.renderTemplates({ ...args, templateUi: appState.templateUi });
  }),
  production: () => import('./modules/production/view.js').then(module => module.renderProduction),
  platform: () => import('./modules/platform-admin/view.js').then(module => module.renderPlatformAdmin),
  stages: () => import('./modules/production/view.js').then(module => module.renderStages),
  documentTasks: () => Promise.resolve(() => '<div data-document-task-mount></div>'),
  repository: () => import('./modules/repository/view.js').then(module => module.renderRepository),
};
const rendererPromises = new Map();

async function ensureRenderer(view) {
  if (renderers[view] || !rendererLoaders[view]) return;
  if (!rendererPromises.has(view)) rendererPromises.set(view, rendererLoaders[view]().then(renderer => { renderers[view] = renderer; }));
  await rendererPromises.get(view);
}

function ensureRouteStyles(view) {
  document.querySelectorAll('[data-route-style]').forEach(link => {
    if (link.dataset.routeStyle.split(/\s+/).includes(view)) {
      if (!link.href) link.href = link.dataset.href;
      link.media = 'all';
    }
  });
}

let iconLibraryScheduled = false;
let pendingPrincipalImportFile = null;
let pendingPrincipalCorrection = null;
let principalSearchTimer = null;
let platformRenderDeferred = false;

// Explicitly enabled by an isolated performance probe; production runs keep this path inactive.
function measureHandbookPerformance(name, callback) {
  const diagnostics = window.__knowledgeCenterPerformance;
  if (!diagnostics?.enabled) return callback();
  const start = performance.now();
  try {
    return callback();
  } finally {
    diagnostics.measures ||= [];
    diagnostics.measures.push({ name, startMs: start, durationMs: performance.now() - start });
  }
}

// Diagnostic-only marks; no document content or credentials enter the report.
function markHandbookPerformance(name, detail = undefined) {
  const diagnostics = window.__knowledgeCenterPerformance;
  if (!diagnostics?.enabled) return;
  diagnostics.marks ||= [];
  const mark = { name, startMs: performance.now() };
  if (detail && typeof detail === 'object') {
    for (const [key, value] of Object.entries(detail)) {
      if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') mark[key] = value;
    }
  }
  diagnostics.marks.push(mark);
}

function scheduleIconLibrary() {
  if (iconLibraryScheduled || window.lucide) return;
  iconLibraryScheduled = true;
  const load = () => {
    const script = document.createElement('script');
    script.src = '/knowledge-center/common/vendor/lucide.min.js';
    script.onload = () => measureHandbookPerformance('icons.libraryLoaded', () => {
      if (appState.activeView === 'production') enhanceHandbookEditorIcons([document]);
      else window.lucide?.createIcons();
    });
    document.head.append(script);
  };
  window.setTimeout(load, 0);
}

let templateController = null;
let cleaningApiPromise = null;
const cleaningApi = () => cleaningApiPromise ||= import('./common/api/cleaning-api.js');
let cleaningWorkspaceInFlight;
const loadCleaningWorkspace = (...args) => {
  if (!cleaningWorkspaceInFlight) {
    const pending = cleaningApi().then(api => api.loadCleaningWorkspace(...args));
    cleaningWorkspaceInFlight = pending;
    pending.finally(() => { if (cleaningWorkspaceInFlight === pending) cleaningWorkspaceInFlight = null; }).catch(() => {});
  }
  return cleaningWorkspaceInFlight;
};
const createUploadSession = (...args) => cleaningApi().then(api => api.createUploadSession(...args));
const addUploadFile = (...args) => cleaningApi().then(api => api.addUploadFile(...args));
const uploadChunk = (...args) => cleaningApi().then(api => api.uploadChunk(...args));
const completeUploadFile = (...args) => cleaningApi().then(api => api.completeUploadFile(...args));
const completeUploadSession = (...args) => cleaningApi().then(api => api.completeUploadSession(...args));
const createUploadBatch = (...args) => cleaningApi().then(api => api.createUploadBatch(...args));

function outlineRouteState() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const parameters = new URLSearchParams(window.location.search);
  const legacyRecycleId = parts[1] === 'outlines' && /^outline_[A-Za-z0-9_-]+$/.test(parts[2] || '') ? parts[2] : null;
  const page = legacyRecycleId ? 'recycle' : parts[1] === 'outlines' && ['resources', 'recycle'].includes(parts[2]) ? parts[2] : 'list';
  const handbookId = parts[1] === 'outlines' && page === 'list' ? (parts[2] || parameters.get('handbookId') || null) : null;
  return {
    page, handbookId, recycleId: legacyRecycleId,
    outlineVersionId: parameters.get('version') || null,
    isDetail: Boolean(handbookId),
    documentId: parameters.get('document') || null,
    nodeId: parameters.get('node') || parameters.get('document') || null,
    activeTab: parameters.get('tab') === 'assignments' ? 'assignments' : 'overview',
    domainId: parameters.get('domain') || null,
    filterUnassigned: parameters.get('unassigned') === 'true',
    listState: { search: parameters.get('q') || appState.outlineListState.search, status: parameters.get('status') || appState.outlineListState.statusFilter },
  };
}

function flattenOutlineNodes(items, parentId = null, result = []) {
  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item.id || item.documentId || item.sourceId || '');
    if (!id) continue;
    result.push({ ...item, id, parentId: item.parentId == null ? parentId : String(item.parentId) });
    const children = item.children || item.nodes || item.chapters || item.documents || item.knowledgePoints || [];
    flattenOutlineNodes(children, id, result);
  }
  return result;
}

function currentOutlineNodes() {
  const detail = appState.outlineProjection?.detail || {};
  return flattenOutlineNodes(detail.nodes || detail.tree || detail.chapters || detail.content?.parts || []);
}

function openOutlineContextMenu(documentId, x, y) {
  const menu = document.querySelector('[data-outline-context-menu]');
  if (!menu) return;
  menu.dataset.documentId = String(documentId || '');
  menu.hidden = false;
  menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - 190))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - 150))}px`;
  menu.querySelector('button')?.focus();
}

function updateOutlineAssignmentWorkspace() {
  const workspace = document.querySelector('.outline-assignment-workspace');
  if (!workspace) return;
  const status = workspace.dataset.assignmentStatus || 'pending';
  const directory = workspace.dataset.assignmentDirectory || '';
  const member = workspace.querySelector('[data-outline-assignment-member-filter]')?.value || '';
  const search = (workspace.querySelector('[data-outline-assignment-search]')?.value || '').trim().toLowerCase();
  workspace.querySelectorAll('[data-outline-assignment-row]').forEach(row => {
    const assigned = row.dataset.assigned === 'true';
    const statusMismatch = status === 'pending' ? assigned : status === 'assigned' ? !assigned : false;
    const directoryMismatch = directory && !String(row.dataset.directoryIds || '').split(' ').includes(directory);
    const memberMismatch = member === 'unassigned' ? assigned : member ? row.dataset.assigneeId !== member : false;
    const searchMismatch = search && !String(row.dataset.searchText || '').includes(search);
    row.hidden = Boolean(statusMismatch || directoryMismatch || memberMismatch || searchMismatch);
  });
  const selected = [...workspace.querySelectorAll('[data-outline-task-select]:checked')];
  const count = workspace.querySelector('[data-outline-selected-count]');
  if (count) count.textContent = `已选择 ${selected.length} 篇`;
  const assignee = workspace.querySelector('[data-outline-batch-assignee]');
  const batch = workspace.querySelector('[data-outline-batch-assign]');
  const batchBar = workspace.querySelector('.outline-assignment-batch');
  if (batchBar) batchBar.hidden = !selected.length;
  if (batch) batch.disabled = !selected.length || !assignee?.value;
}

function updateOutlineNodeRows() {
  const workspace = document.querySelector('.outline-node-list');
  if (!workspace) return;
  const query = (workspace.querySelector('[data-outline-node-search]')?.value || '').trim().toLowerCase();
  const domain = workspace.querySelector('[data-outline-node-domain-filter]')?.value || '';
  const owner = workspace.querySelector('[data-outline-node-owner-filter]')?.value || '';
  const rows = [...workspace.querySelectorAll('[data-outline-node-row]')];
  rows.forEach(row => {
    row.hidden = Boolean((query && !row.dataset.outlineNodeSearch.includes(query))
      || (domain && !row.dataset.outlineNodeDomain.split('、').includes(domain))
      || (owner && !row.dataset.outlineNodeOwner.split('、').includes(owner)));
  });
  const empty = workspace.querySelector('[data-outline-node-filter-empty]');
  if (empty) empty.hidden = rows.some(row => !row.hidden);
}

function productionRouteState() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const parameters = new URLSearchParams(window.location.search);
  return {
    handbookId: parts[1] === 'production' && parts[2] === 'handbook'
      ? decodeURIComponent(parts[3] || '')
      : parameters.get('handbookId') || '',
    documentId: parameters.get('documentId') || '',
    view: parameters.get('view') === 'mine' ? 'mine' : 'all',
    branch: parameters.get('branch') || '',
  };
}

async function openHandbookWriting(operation, aiAction) {
    const context = handbookDraftContext();
    const documentId = context.documentId;
    const getMarkdown = () => activeHandbookVditor(documentId)?.getValue() ?? currentHandbookMarkdown(documentId);
    if (operation === 'check') {
      const saved = handbookUi().serverDrafts?.[documentId]?.draft;
      const markdown = getMarkdown();
      if (handbookUi().draftLoadState?.[documentId] !== 'ready' || !saved?.revision?.revisionId || markdown !== saved.revision.markdown) {
        showAppNotice('请先保存当前正文，再检查已保存版本的用例。', { title: '需要先保存草稿' });
        return;
      }
      const { openProductionQualityDialog } = await import('./modules/production/production-quality-dialog.js');
      openProductionQualityDialog({ context, markdown, revisionId: saved.revision.revisionId, editVersion: saved.editVersion, trigger: aiAction });
      return;
    }
    if (handbookUi().draftLoadState?.[documentId] !== 'ready') {
      showAppNotice('请等待共享草稿读取完成，或恢复草稿服务后重试。', { title: '暂时无法生成' });
      return;
    }
    if (writingPageOpening || document.querySelector('.handbook-writing-page')) return;
    writingPageOpening = true;
    try {
    const prepareOrigin = async () => {
      const documents = collectDocuments(outlineNodes(appState.incrementalProjection?.handbookOutline?.detail || {}));
      const mapping = await loadHandbookRepositoryMapping(context.handbookId, 'production').catch(error => {
        if (['GITLAB_MAPPING_NOT_FOUND', 'GITLAB_LANGUAGE_NOT_MAPPED'].includes(error.code)) return null;
        throw error;
      });
      const repository = await loadHandbookProductionRepository(context.handbookId, documents, context.branch, documentId, { mapping });
      if (!['ok', 'not-mapped'].includes(repository.status)) {
        throw Object.assign(new Error(repository.status === 'unauthorized'
          ? '请先授权 GitLab 账号，完成后重新检查来源。'
          : repository.error?.message || '仓库来源暂不可读，请检查仓库映射、分支及访问权限后重试。'),
        { code: repository.error?.code || 'AI_ORIGIN_UNAVAILABLE' });
      }
      const file = repository.filesByDocument?.[documentId];
      if (repository.mapped && !file?.matched) throw new Error('当前文档未匹配到仓库文件，请检查中文仓库路径与文档映射后重新检查。');
      const content = file?.matched ? repository.contentByDocument?.[documentId] : '';
      if (typeof content !== 'string') throw new Error('仓库正文尚未读取完成，请重新检查来源。');
      const contentDigest = await sha256Text(content);
      return { content, snapshot: file?.matched ? {
        originType: 'gitlab', snapshotId: file.commitId || file.blobId || contentDigest, contentDigest,
        handbookId: context.handbookId, documentId, outlineVersionId: context.outlineVersionId,
        repository: repository.mapping?.repository || repository.mapping?.project || repository.mapping?.projectId || null,
        branch: repository.branch, path: file.path, commitId: file.commitId || null, blobId: file.blobId || null,
      } : { originType: 'blank', snapshotId: null, contentDigest, handbookId: context.handbookId, documentId, branch: context.branch } };
    };
    const { openProductionWritingPage } = await productionWritingPagePromise;
    openProductionWritingPage({
      context, operation, getMarkdown, embedded: true,
      initialMarkdown: currentHandbookMarkdown(documentId),
      repositoryImageContext: { handbookId: context.handbookId, branch: handbookUi().repository?.branch || context.branch,
        language: handbookUi().repository?.language || 'zh', filePath: handbookUi().repository?.filesByDocument?.[documentId]?.path || '' },
      reuseEditor: activeHandbookVditor(documentId),
      reuseEditorElement: activeHandbookVditor(documentId) ? document.querySelector('[data-handbook-vditor]') : null,
      observeEditorInput: listener => {
        handbookAIEditorInputListener = listener;
        return () => { if (handbookAIEditorInputListener === listener) handbookAIEditorInputListener = null; };
      },
      initialEditorFormat: handbookUi().editorFormatByDocument?.[documentId],
      onEditorFormatChange: format => {
        handbookUi().editorFormatByDocument ||= {};
        handbookUi().editorFormatByDocument[documentId] = format;
      },
      loadEditor: loadVditorAssets, initialRange: getWritingSelection(), trigger: aiAction,
      onClose: () => { if (!activeHandbookVditor(documentId) || handbookUi().editorFormatByDocument?.[documentId] === 'markdown') render(); },
      onEdit: markdown => {
        handbookUi().drafts[documentId] = markdown;
        handbookUi().draftHtml[documentId] = '';
        updateHandbookUiList('dirtyDocuments', documentId, true);
        activeHandbookVditor(documentId)?.setValue(markdown);
      },
      editVersion: handbookUi().serverDrafts?.[documentId]?.draft?.editVersion || 0,
      templateId: document.querySelector('[data-handbook-template]')?.value || handbookUi().templateByDocument?.[documentId],
      outline: document.querySelector('[data-handbook-document-title]')?.textContent || documentId,
      prepareOrigin,
      originAuthorizationHref: handbookGitLabOAuthHref(context.handbookId, window.location.pathname + window.location.search),
      originBaselineContent: handbookUi().repository?.contentByDocument?.[documentId] || '',
      loadLatestOrigin: async () => {
        const repository = handbookUi().repository || {};
        const file = repository.filesByDocument?.[documentId];
        if (!file?.matched || !file.path) throw new Error('当前文档没有可读取的 GitLab 映射');
        const latest = await loadHandbookRepositoryFile(context.handbookId, repository.branch, 'zh', file.path);
        if (latest.encoding !== 'utf-8' || typeof latest.content !== 'string') throw new Error('GitLab 最新基线不是有效的 Markdown 文本');
        const contentDigest = await sha256Text(latest.content);
        return {
          content: latest.content,
          snapshot: { originType: 'gitlab', snapshotId: latest.commitId || latest.blobId || contentDigest, contentDigest,
            handbookId: context.handbookId, documentId, outlineVersionId: context.outlineVersionId,
            repository: repository.mapping?.repository || repository.mapping?.project || repository.mapping?.projectId || null,
            branch: repository.branch, path: latest.path || file.path, commitId: latest.commitId || null, blobId: latest.blobId || null },
        };
      },
      attachmentIds: (handbookUi().attachments?.[documentId] || []).map(item => item.attachmentId),
      baselineDigest: () => handbookBaselineDigest(documentId),
      onAdopt: async (result, original) => {
        const latest = getMarkdown();
        const changed = latest !== original;
        handbookUi().serverDrafts[documentId] = result;
        handbookUi().drafts[documentId] = changed ? latest : result.draft.revision.markdown;
        handbookUi().draftHtml[documentId] = changed ? activeHandbookVditor(documentId)?.getHTML() || '' : '';
        handbookUi().draftBranchByDocument[documentId] = result.draft.branch;
        handbookUi().draftSaveState[documentId] = { status: 'saved' };
        updateHandbookUiList('dirtyDocuments', documentId, changed);
        updateHandbookUiList('savedDocuments', documentId, true);
        if (!changed) activeHandbookVditor(documentId)?.setValue(result.draft.revision.markdown);
        render();
        showAppNotice(changed ? '候选已保存；保存期间的后续人工修改仍保留在编辑器，请再次保存。' : '候选已采用并保存。请继续质量检查及送审。', { title: 'AI 候选已保存' });
      },
    });
    } finally { writingPageOpening = false; }
}

let writingPageOpening = false;
let assetRenderDeferred = false;
let openDomainTaskId = null;
let outlineLoadSequence = 0;
let outlineLoadPromise = null;

function outlineProjectionKey(route = outlineRouteState()) {
  return route.isDetail ? `outline:detail:${route.handbookId}:${route.outlineVersionId || ''}` : route.page === 'list' ? 'outline:list' : `outline:${route.page}`;
}

    function render() {
  if (document.querySelector('.handbook-writing-page')) return;
  if (appState.activeView === 'production' && productionRouteState().handbookId) collapseSidebarForProduction();
  else restoreSidebarAfterProduction();
  if (appState.activeView === 'assets' && document.querySelector('.asset-dialog[open]')) {
    assetRenderDeferred = true;
    return;
  }
  if (appState.activeView === 'platform'
    && (appState.gitlabAddingConnection || appState.gitlabEditingConnection)
    && document.querySelector('[data-gitlab-add-form], [data-gitlab-edit-form]')) return;
  if (appState.activeView === 'platform' && document.querySelector('[data-principal-editor-dialog][open], [data-principal-cas-correction-dialog][open], [data-principal-import-dialog][open]')) {
    platformRenderDeferred = true;
    return;
  }
  if (appState.activeView === 'platform' && document.querySelector('.platform-tab-menu details[open]')) {
    platformRenderDeferred = true;
    return;
  }
  if (appState.activeView === 'platform' && appState.platformTab === 'mcp' && document.querySelector('[data-mcp-admin]')) return;
  if (appState.activeView === 'platform' && appState.platformTab === 'models' && document.querySelector('[data-model-admin]')) return;
  platformRenderDeferred = false;
  const renderer = renderers[appState.activeView];
  if (!renderer) {
    byId('view-root').innerHTML = '<section class="review-loading-state" role="status"><span aria-hidden="true"></span><p>正在加载当前页面…</p></section>';
    ensureRenderer(appState.activeView).then(() => { if (renderers[appState.activeView]) render(); }).catch(showApplicationError);
    return;
  }
  markHandbookPerformance('render.start', { activeView: appState.activeView });
  // 全局平台概览错误不应污染审核与发布工作区。审核页有独立的
  // reviewProjection 错误投影，只有该投影明确失败时才展示页面级错误。
  const globalErrorPanel = byId('error-panel');
  if (globalErrorPanel && appState.activeView === 'review' && appState.reviewProjection?.status !== 'unavailable') globalErrorPanel.hidden = true;
  byId('page-title').textContent = appState.activeView === 'outlines' && outlineRouteState().page === 'recycle' ? '大纲回收站' : appState.activeView === 'outlines' && outlineRouteState().page === 'resources' ? '准备大纲' : views[appState.activeView][1];
  document.body.classList.toggle('review-view', appState.activeView === 'review');
  document.body.classList.toggle('review-focus-mode', appState.activeView === 'review' && appState.reviewUi.focusMode === true);
  document.querySelectorAll('.nav-item').forEach(button => {
    const allowed = canAccessView(button.dataset.view);
    button.hidden = !allowed;
    const active = button.dataset.view === appState.activeView;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  document.querySelector('.nav-caption.governance').hidden = !canAccessView('platform');
  const outlineView = appState.activeView === 'outlines' ? outlineRouteState() : {};
  const outlineProjection = appState.activeView === 'outlines' && appState.outlineProjection?.routeKey === outlineProjectionKey(outlineView)
    ? appState.outlineProjection : null;
  // 领域任务等迟到投影不能关闭用户已展开的同一大纲菜单。
  const openOutlineMenuId = appState.activeView === 'outlines'
    ? document.querySelector('.outline-more-actions[open]')?.dataset.outlineMoreId : undefined;
  const databasePasswordDraft = document.querySelector('[data-database-dialog] [data-database-field="password"]')?.value || '';
      if (appState.activeView === 'documentTasks') {
        const taskRoot = byId('view-root');
        if (taskRoot._taskProjection !== appState.documentTaskProjection || !taskRoot.querySelector('.document-task-page')) {
          renderDocumentTasks({ documentTaskProjection: appState.documentTaskProjection || { status: 'loading', items: [] } });
          taskRoot._taskProjection = appState.documentTaskProjection;
        }
        syncMobileNavigationState();
        window.lucide?.createIcons();
        return;
      }
      if (byId('view-root')._taskProjection) { const taskRoot = byId('view-root'); taskRoot.onclick = taskRoot.onchange = taskRoot.onsubmit = taskRoot.onkeydown = null; delete taskRoot._taskProjection; }
      if (appState.activeView === 'review') {
        appState.reviewUi.currentUserId = String(authState.session?.user?.id || '');
        appState.reviewUi.canWrite = canPerform('knowledge:write');
        appState.reviewUi.canManage = canPerform('platform:manage');
      }
      const viewHtml = measureHandbookPerformance('render.viewHtml', () => renderer({ projection: appState.activeView === 'repository' ? appState.gitlabProjection : appState.projection, templateProjection: appState.templateProjection, cleaningProjection: appState.cleaningProjection, cleaningCanWrite: isPlatformAdmin(), reviewProjection: appState.reviewProjection, reviewUi: appState.reviewUi, outlineProjection, assetCatalog: appState.assetCatalog, principalProjection: appState.principalProjection, principalListState: appState.principalListState, teamGroupProjection: appState.teamGroupProjection, teamGroupView: new URLSearchParams(window.location.search).get('view') || 'people', teamGroupUi: appState.teamGroupUi, incrementalProjection: appState.incrementalProjection, handbookProductionUi: appState.handbookProductionUi, currentUser: { ...(authState.session?.user || {}), displayName: displayName() }, domainBuildTaskProjection: appState.domainBuildTaskProjection, openDomainTaskId, gitlabProjection: appState.gitlabProjection, permissionProjection: appState.permissionProjection, governanceProjection: appState.platformGovernance, databaseConnectionProjection: appState.databaseConnectionProjection, databaseConnectionDrawerOpen: appState.databaseConnectionDrawerOpen, databaseConnectionAdvancedOpen: appState.databaseConnectionAdvancedOpen, databaseConnectionForm: appState.databaseConnectionForm, databaseConnectionStatus: appState.databaseConnectionStatus, selectedPermissionUserId: appState.selectedPermissionUserId, permissionSaveStatus: appState.permissionSaveStatus, permissionUserSearch: appState.permissionUserSearch, permissionListState: appState.permissionListState, gitlabVerification: appState.gitlabVerification, platformAdmin: isPlatformAdmin(), platformTab: appState.platformTab, gitlabListState: appState.gitlabListState, gitlabAddingConnection: appState.gitlabAddingConnection, gitlabEditingConnection: appState.gitlabEditingConnection, outlinePermissions: { create: canPerform('outline:create'), delete: canPerform('outline:delete'), purge: canPerform('outline:purge'), platformAdmin: isPlatformAdmin() }, outlineView }));
      markHandbookPerformance('render.htmlReady', { htmlLength: viewHtml.length });
      measureHandbookPerformance('render.viewRootReplace', () => { byId('view-root').innerHTML = viewHtml; });
      markHandbookPerformance('render.domReplaced');
      const platformTabs = byId('view-root').querySelector('.platform-tabs');
      const activePlatformTab = platformTabs?.querySelector('.platform-tab[aria-current="page"]');
      if (platformTabs && activePlatformTab && platformTabs.scrollWidth > platformTabs.clientWidth) {
        platformTabs.scrollLeft = Math.max(0, activePlatformTab.offsetLeft - platformTabs.offsetLeft - 12);
      }
      const mcpRoot = byId('view-root').querySelector('[data-mcp-admin]');
      if (mcpRoot) mountMcpAdmin(mcpRoot);
      const modelRoot = byId('view-root').querySelector('[data-model-admin]');
      if (modelRoot) mountModelAdmin(modelRoot);
      const outlineMenu = byId('view-root').querySelector('.outline-more-actions');
      if (openOutlineMenuId && outlineMenu?.dataset.outlineMoreId === openOutlineMenuId) outlineMenu.open = true;
      const permissionDraft = appState.permissionRoleDraft;
      const permissionEditor = byId('view-root').querySelector('[data-permission-role-form]');
      if (permissionDraft && permissionEditor?.dataset.permissionUserId === permissionDraft.userId) {
        permissionEditor.querySelectorAll('input[name="roles"]:not(:disabled)').forEach(input => {
          input.checked = permissionDraft.roles.includes(input.value);
        });
      }
      measureHandbookPerformance('render.cleanupSearchableSelects', () => cleanupSearchableSelects());
      measureHandbookPerformance('render.markDynamicSelects', () => markDynamicSelects(document));
      measureHandbookPerformance('render.enhanceTableViews', () => enhanceTableViews(byId('view-root'), {
        preferenceScope: String(authState.session?.user?.principalId || authState.session?.user?.userId || authState.session?.user?.username || 'local'),
        onChange: render,
      }));
      measureHandbookPerformance('render.enhanceResizableNavigation', () => enhanceResizableNavigation(byId('view-root')));
      measureHandbookPerformance('render.enhanceDirectoryTrees', () => enhanceDirectoryTrees(byId('view-root')));
      markHandbookPerformance('render.enhancersComplete');
      if (appState.activeView === 'production') requestAnimationFrame(mountHandbookVditor);
      const teamImpact = appState.teamGroupUi?.impact;
      if (teamImpact?.groupId) {
        const form = document.querySelector(`[data-team-group-form][data-team-group-id="${CSS.escape(String(teamImpact.groupId))}"]`);
        if (form && !form.querySelector('[data-team-group-impact]')) {
          const impact = document.createElement('div'); impact.className = 'team-group-impact'; impact.dataset.teamGroupImpact = '';
          impact.setAttribute('role', 'status'); impact.innerHTML = `<strong>保存影响预览</strong><span>未完成任务 ${Number(teamImpact.unfinishedTaskCount || 0)} 项，移除成员任务 ${Number(teamImpact.removedMemberTaskCount || 0)} 项</span>`;
          form.querySelector('[data-team-group-status]')?.before(impact);
        }
      }
  if (appState.activeView === 'production' && !writingPageOpening) {
    const operation = new URLSearchParams(location.search).get('writing');
    const documentId = productionRouteState().documentId;
    if (['generate', 'polish', 'continue', 'rewrite', 'update'].includes(operation)
      && handbookUi().draftLoadState?.[documentId] === 'ready') {
      queueMicrotask(() => {
        if (!writingPageOpening && !document.querySelector('.handbook-writing-page')
          && new URLSearchParams(location.search).get('writing') === operation) {
          openHandbookWriting(operation, document.querySelector('[data-handbook-ai-action="generate"]')).catch(showApplicationError);
        }
      });
    }
  }
  measureHandbookPerformance('render.createIcons', () => {
    if (appState.activeView === 'production') enhanceHandbookEditorIcons([document]);
    else window.lucide?.createIcons();
  });
  if (appState.activeView === 'platform' && appState.gitlabListState.drawerOpen && document.activeElement === document.body) {
    requestAnimationFrame(() => document.querySelector('.gitlab-drawer-close')?.focus());
  }
  markHandbookPerformance('render.syncComplete');
  const databaseDialog = document.querySelector('[data-database-dialog]');
  if (databaseDialog && appState.databaseConnectionDrawerOpen && !databaseDialog.open) {
    databaseDialog.showModal();
    const passwordInput = databaseDialog.querySelector('[data-database-field="password"]');
    if (passwordInput && databasePasswordDraft) passwordInput.value = databasePasswordDraft;
    if (appState.databaseConnectionDrawerShouldFocus) {
      appState.databaseConnectionDrawerShouldFocus = false;
      requestAnimationFrame(() => databaseDialog.querySelector('[data-database-close]')?.focus());
    }

  }
  if (appState.activeView === 'dashboard' && openDomainTaskId) {
    const dialog = [...document.querySelectorAll('[data-domain-task-dialog]')].find(item => item.dataset.domainTaskDialog === String(openDomainTaskId));
    if (dialog && !dialog.open) dialog.showModal();
  }
  if (appState.activeView === 'review') {
    const taskId = appState.reviewProjection?.detail?.task?.id;
    if (taskId && appState.reviewUi.sidebarTask !== taskId) { appState.reviewUi.sidebarTask = taskId; appState.reviewUi.sidebarPanel = ''; }
    document.querySelectorAll('.review-workspace:not(.review-waiting-workspace) .review-evidence-column details').forEach(detail => {
      if (detail.matches('[data-review-comment-drawer], .review-evidence-drawer')) detail.open = appState.reviewUi.sidebarPanel === (detail.hasAttribute('data-review-comment-drawer') ? 'comments' : 'evidence');
    });
    requestAnimationFrame(restoreReviewAnchor);
  }
  if (appState.activeView === 'outlines' && outlineView.page === 'list' && !outlineView.isDetail && appState.outlineListState.scrollPosition) requestAnimationFrame(() => { byId('main-shell').scrollTop = appState.outlineListState.scrollPosition; });
}

function flushDeferredAssetRender() {
  if (!assetRenderDeferred) return;
  assetRenderDeferred = false;
  render();
}

document.addEventListener('close', event => {
  if (!event.target.matches?.('[data-principal-editor-dialog], [data-principal-cas-correction-dialog], [data-principal-import-dialog]')) return;
  if (platformRenderDeferred && appState.activeView === 'platform' && !document.querySelector('[data-principal-editor-dialog][open], [data-principal-cas-correction-dialog][open], [data-principal-import-dialog][open]')) queueMicrotask(render);
}, true);

function updateAssetStatistics(item) {
  if (appState.activeView !== 'assets' || !assetStatisticsRenderer) return;
  const id = String(item.handbookId || item.id || '');
  const current = (appState.assetCatalog?.items || []).find(entry => String(entry.handbookId || entry.id || '') === id);
  if (current !== item) return;
  const cell = [...document.querySelectorAll('[data-asset-statistics]')].find(node => node.dataset.assetStatistics === id);
  if (cell) {
    cell.innerHTML = assetStatisticsRenderer(item);
    if (item.statisticsStatus === 'loading') cell.setAttribute('aria-busy', 'true');
    else cell.removeAttribute('aria-busy');
  }
}

function updateAssetSelection(selectedId) {
  if (appState.activeView !== 'assets' || !assetSelectionRenderer) return false;
  const items = appState.assetCatalog?.items || appState.assetCatalog?.handbooks || [];
  const selected = selectedId ? items.find(item => String(item.handbookId || item.id) === String(selectedId)) : null;
  if (selectedId && !selected) return false;
  const workspace = document.querySelector('.asset-workspace');
  const root = byId('view-root');
  if (!workspace || !root) return false;
  const scrollContainer = byId('main-shell');
  const scrollTop = scrollContainer?.scrollTop || 0;
  document.querySelectorAll('[data-asset-id]').forEach(link => link.closest('tr')?.classList.toggle('selected', Boolean(selected) && link.dataset.assetId === String(selectedId)));
  workspace.querySelector('.asset-workspace-detail')?.remove();
  root.querySelector('[data-asset-edit-dialog]')?.remove();
  root.querySelector('[data-asset-archive-dialog]')?.remove();
  root.querySelector('[data-repository-mapping-dialog]')?.remove();
  workspace.classList.toggle('asset-detail-open', Boolean(selected));
  const selection = assetSelectionRenderer({ selected, principalProjection: appState.principalProjection, gitlabProjection: appState.gitlabProjection, platformAdmin: isPlatformAdmin() });
  if (selection.actionPanel) workspace.insertAdjacentHTML('beforeend', selection.actionPanel);
  if (selection.dialogs) root.insertAdjacentHTML('beforeend', selection.dialogs);
  // 手册操作栏与管理弹框属于局部动态渲染，不会经过全页 render() 的公共组件增强。
  // 清理已移除弹框的控制器后，对新插入区域重新执行幂等增强，确保 A/B 角等
  // data-searchable-select 在真实页面中生成可输入筛选的 Combobox。
  cleanupSearchableSelects();
  markDynamicSelects(root);
  if (scrollContainer) {
    scrollContainer.scrollTop = scrollTop;
    requestAnimationFrame(() => { scrollContainer.scrollTop = scrollTop; });
  }
  window.lucide?.createIcons();
  return true;
}

function assetEditSnapshot(form) {
  return new URLSearchParams(new FormData(form)).toString();
}

function restoreAssetManageDialog() {
  const manageDialog = assetArchiveManageDialog;
  const trigger = assetArchiveTrigger;
  assetArchiveManageDialog = null;
  assetArchiveTrigger = null;
  if (manageDialog?.isConnected && !manageDialog.open) manageDialog.showModal();
  requestAnimationFrame(() => trigger?.isConnected && trigger.focus());
}

function cancelAssetArchiveDialog(dialog) {
  if (dialog?.querySelector('[data-asset-archive-confirm-form]')?.dataset.busy === 'true') return;
  dialog?.close();
  restoreAssetManageDialog();
}

async function navigate(view, updateHistory = true) {
  if (!views[view]) return;
  if (view !== 'platform' && (!confirmLeavingMcp() || !confirmLeavingModels())) return;
  if (appState.activeView === 'templates' && view !== 'templates' && templateController && !templateController.canLeave()) return;
  if (appState.activeView === 'production' && productionRouteState().handbookId && view !== 'production' && !confirmLeavingHandbookDraft()) return;
  if (!canAccessView(view)) {
    const fallback = firstAccessibleView();
    showAppNotice('当前账号没有访问该页面的权限，已返回可访问页面。');
    if (!fallback || fallback === view) return;
    return navigate(fallback, updateHistory);
  }
  const targetPath = view === "platform" ? pathForView(view, { tab: appState.platformTab }) : pathForView(view);
  const wasOutlineDetail = appState.activeView === 'outlines' && outlineRouteState().isDetail;
  if (view === 'outlines' && wasOutlineDetail) appState.outlineProjection = null;
  appState.activeView = view;
  if (view === 'production' && productionRouteState().handbookId) collapseSidebarForProduction();
  else restoreSidebarAfterProduction();
  ensureRouteStyles(view);
  if (updateHistory && (window.location.pathname + window.location.search) !== targetPath) window.history.pushState({ view, tab: appState.platformTab }, '', targetPath);
  await ensureRenderer(view);
  if (view === 'dashboard' && appState.myTasksProjection?.queryKey !== getMyTaskQueryKey()) {
    appState.myTasksProjection = { status: 'loading', items: [], total: 0, facets: { all: 0, actionable: 0, waiting: 0, types: {} }, unavailable: [] };
  }
  render();
  if (view === 'cleaning') {
    appState.cleaningProjection = { status: 'loading' };
    loadCleaningWorkspace().then(data => { appState.cleaningProjection = { status: 'ok', ...data, asOf: new Date().toISOString() }; render(); }).catch(error => { appState.cleaningProjection = { status: 'unavailable', error: { message: error.message, code: error.code } }; render(); });
  }
  if (view === 'outlines' && (!appState.outlineProjection || appState.outlineProjection.routeKey !== outlineProjectionKey())) loadOutlines();
  if (view === 'assets') loadAssetCatalog();
  if (view === 'dashboard') {
    loadMyTasksWorkspace({ retain: Boolean(appState.myTasksProjection?.items?.length) });
  }
  if (view === 'documentTasks') loadTaskManagementWorkspace({ retain: Boolean(appState.documentTaskProjection?.items?.length) });
  if (view === 'production') loadIncrementalWorkspace();
  if (view === 'review') loadReviewWorkspace();
  if (view === 'repository') loadRepositoryWorkspace();
  if (view === 'platform') loadGitLabAdmin();
  if (view === 'templates') loadTemplateWorkspace();
  closeMobileNavigation(false);
  byId('main').focus();
}

const handbookEntry = new Map();
let activeHandbookPath = '';
function handbookEntryKey(pathname = location.pathname) {
  return pathname.startsWith('/knowledge-center/production/handbook/') ? pathname : '';
}
function rememberHandbookEntry(url) {
  const key = handbookEntryKey(new URL(url, location.origin).pathname);
  if (!key) return;
  const entry = { url: location.pathname + location.search, view: appState.activeView,
    scrollTop: byId('main-shell')?.scrollTop || 0,
    projection: appState.activeView === 'production' ? appState.incrementalProjection : null };
  captureHandbookSource(entry);
  handbookEntry.clear();
  handbookEntry.set(key, entry);
  activeHandbookPath = key;
}
function captureHandbookSource(entry) {
  const root = byId('view-root');
  if (!root || !root.firstChild) return;
  const fragment = document.createDocumentFragment();
  while (root.firstChild) fragment.append(root.firstChild);
  entry.snapshot = { fragment, onclick: root.onclick, onchange: root.onchange,
    onsubmit: root.onsubmit, onkeydown: root.onkeydown, taskProjection: root._taskProjection,
    myTaskQueryKey: entry.view === 'dashboard' ? appState.myTasksProjection?.queryKey : null };
  root.onclick = root.onchange = root.onsubmit = root.onkeydown = null;
  delete root._taskProjection;
  entry.scrollTop = byId('main-shell')?.scrollTop || 0;
}
function showCachedReturn(view, entry) {
  if (!views[view] || !canAccessView(view) || !entry?.snapshot?.fragment?.firstChild) return false;
  if (view === 'production' && entry?.projection) appState.incrementalProjection = entry.projection;
  appState.activeView = view;
  if (view === 'production' && productionRouteState().handbookId) collapseSidebarForProduction();
  else restoreSidebarAfterProduction();
  ensureRouteStyles(view);
  const root = byId('view-root');
  if (root) {
    root.replaceChildren(entry.snapshot.fragment);
    root.onclick = entry.snapshot.onclick;
    root.onchange = entry.snapshot.onchange;
    root.onsubmit = entry.snapshot.onsubmit;
    root.onkeydown = entry.snapshot.onkeydown;
    if (entry.snapshot.taskProjection) root._taskProjection = entry.snapshot.taskProjection;
    byId('page-title').textContent = views[view][1];
    document.querySelectorAll('.nav-item').forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    syncMobileNavigationState();
  } else return false;
  const main = byId('main-shell');
  if (main) main.scrollTop = entry?.scrollTop || 0;
  return true;
}
function returnFromHandbook(fallbackHref) {
  if (history.state?.handbookFrom) { history.back(); return; }
  if (!confirmLeavingHandbookDraft()) return;
  const entry = handbookEntry.get(handbookEntryKey()) || handbookEntry.get(activeHandbookPath);
  const fallback = new URL(fallbackHref, location.origin);
  const target = entry && new URL(entry.url, location.origin).pathname !== location.pathname
    ? new URL(entry.url, location.origin) : fallback;
  const view = viewFromPath(target.pathname) || 'assets';
  history.replaceState({ view, handbookReturn: true }, '', target.pathname + target.search);
  if (view === 'dashboard' && (appState.myTasksProjection?.queryKey !== getMyTaskQueryKey() || entry?.snapshot?.myTaskQueryKey !== getMyTaskQueryKey())) {
    navigate(view, false);
    return;
  }
  if (!showCachedReturn(view, entry)) { navigate(view, false); return; }
  // The source DOM is retained so its filters, drawer and scroll position survive.
  // Refreshing it here would immediately replace the restored page with a loading state.
}

async function loadTemplateWorkspace(selectedId) {
  await ensureRenderer('templates');
  return templateController.load(selectedId);
}

function repositoryRouteState() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const params = new URLSearchParams(window.location.search);
  return { handbookId: parts[1] === 'assets' && parts[3] === 'repository' ? parts[2] : '', branch: params.get('branch') || '', language: params.get('lang') === 'en' ? 'en' : 'zh', path: params.get('path') || '' };
}

function repositoryStatusFor(error) {
  const statusByCode = {
    GITLAB_OAUTH_REQUIRED: 'unauthorized', GITLAB_UNAUTHORIZED: 'unauthorized', GITLAB_CREDENTIAL_UNAVAILABLE: 'conflict',
    HANDBOOK_READ_FORBIDDEN: 'forbidden', GITLAB_MAPPING_NOT_FOUND: 'not-mapped', GITLAB_LANGUAGE_NOT_MAPPED: 'not-mapped',
    GITLAB_BRANCH_NOT_FOUND: 'not-found', GITLAB_CONNECTION_NOT_FOUND: 'not-found', GITLAB_BRANCH_NOT_ALLOWED: 'forbidden',
    GITLAB_PATH_FORBIDDEN: 'forbidden', GITLAB_FORBIDDEN: 'forbidden', GITLAB_CONNECTION_INACTIVE: 'conflict', GITLAB_CONNECTOR_DISABLED: 'conflict',
  };
  return statusByCode[error.code] || (error.status === 403 ? 'forbidden' : error.status === 401 ? 'unauthorized' : error.status === 404 ? 'not-found' : error.status === 409 ? 'conflict' : 'unavailable');
}

function requireReadableGitLabAccess(access) {
  if (access?.canRead !== false) return;
  const error = Object.assign(new Error(access.message || '当前仓库连接不可读取'), { code: access.nextAction === 'connect_gitlab' ? 'GITLAB_OAUTH_REQUIRED' : 'GITLAB_CONNECTION_INACTIVE', status: access.nextAction === 'connect_gitlab' ? 401 : 409 });
  error.connectionId = access.connectionId; error.connectionName = access.connectionName; error.project = access.project;
  throw error;
}

async function loadRepositoryWorkspace() {
  const state = repositoryRouteState();
  if (!state.handbookId) return;
  appState.gitlabProjection = { status: 'loading', handbookId: state.handbookId };
  render();
  try {
    requireReadableGitLabAccess(await loadHandbookGitLabAccess(state.handbookId));
    const metadata = await loadHandbookRepository(state.handbookId);
    const branches = Array.isArray(metadata) ? metadata : (metadata.items || metadata.branches || []);
    const branch = state.branch || metadata.defaultBranch || branches[0]?.name || '';
    const treeResult = branch ? await loadHandbookRepositoryTree(state.handbookId, branch, state.language) : [];
    const tree = Array.isArray(treeResult) ? treeResult : (treeResult.items || treeResult.tree || []);
    const firstFile = state.path || tree.find(item => item.type !== 'tree' && /\.md$/i.test(item.path || item.name))?.path || '';
    const file = firstFile ? await loadHandbookRepositoryFile(state.handbookId, branch, state.language, firstFile) : null;
    const resolvedPath = file?.path || firstFile;
    const canonicalUrl = new URL(window.location.href);
    canonicalUrl.searchParams.set('branch', branch);
    canonicalUrl.searchParams.set('lang', state.language);
    if (resolvedPath) canonicalUrl.searchParams.set('path', resolvedPath);
    else canonicalUrl.searchParams.delete('path');
    const canonicalLocation = `${canonicalUrl.pathname}${canonicalUrl.search}${canonicalUrl.hash}`;
    if (canonicalLocation !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState({ ...window.history.state, view: 'repository', branch, language: state.language, path: resolvedPath }, '', canonicalLocation);
    }
    appState.gitlabProjection = { status: 'ok', handbookId: state.handbookId, handbookName: metadata.handbookName, connectionName: metadata.connectionName, project: metadata.project, languages: metadata.languages, branches, branch, language: state.language, path: resolvedPath, tree, file, commitSha: file?.commitId || metadata.commitSha };
  } catch (error) {
    appState.gitlabProjection = { status: repositoryStatusFor(error), handbookId: state.handbookId, branch: state.branch, language: state.language, path: state.path, error: { code: error.code, message: error.message, httpStatus: error.status } };
  }
  render();
}

async function loadOutlines() {
  const route = outlineRouteState();
  const { handbookId, outlineVersionId } = route;
  const routeKey = outlineProjectionKey(route);
  if (outlineLoadPromise?.routeKey === routeKey) return outlineLoadPromise.promise;
  const sequence = ++outlineLoadSequence;
  appState.outlineProjection = { status: 'loading', routeKey, handbookId };
  if (handbookId) appState.domainBuildTaskProjection = { status: 'loading', tasks: [] };
  if (appState.activeView === 'outlines') render();
  if (route.page === 'resources') {
    appState.outlineProjection = { status: 'ok', routeKey };
    if (appState.activeView === 'outlines') render();
    return;
  }
  if (route.page === 'recycle') {
    const promise = loadOutlineRecycle().then(recycleItems => {
      if (sequence !== outlineLoadSequence || outlineProjectionKey() !== routeKey) return;
      appState.outlineProjection = { status: 'ok', routeKey, recycleItems };
      if (appState.activeView === 'outlines') render();
    }).catch(error => {
      if (sequence !== outlineLoadSequence || outlineProjectionKey() !== routeKey) return;
      appState.outlineProjection = { status: error.status === 403 ? 'forbidden' : 'unavailable', routeKey, error: { message: error.message } };
      if (appState.activeView === 'outlines') render();
    }).finally(() => { if (outlineLoadPromise?.promise === promise) outlineLoadPromise = null; });
    outlineLoadPromise = { routeKey, promise };
    return promise;
  }
  const promise = (async () => {
    const projection = await loadOutlineData(handbookId, outlineVersionId);
    const current = outlineRouteState();
    if (sequence !== outlineLoadSequence || outlineProjectionKey(current) !== routeKey) return;
    appState.outlineProjection = { ...projection, routeKey, handbookId };
    if (!handbookId && appState.outlineRecycleOpen) {
      try {
        const recycleItems = await loadOutlineRecycle();
        if (sequence !== outlineLoadSequence || outlineProjectionKey() !== routeKey) return;
        appState.outlineProjection.recycleItems = recycleItems;
      }
      catch (error) { showAppNotice(error.message, { title: '回收站读取失败', tone: 'danger' }); }
    }
    if (appState.activeView === 'outlines') render();
    // 空手册没有大纲文档，也就没有可投影的领域任务。避免无关请求的迟到响应
    // 重建空态页面，打断模板填写说明的焦点与展开状态。
    if (handbookId && projection.status === 'ok' && projection.detail) {
      const domainTasks = await fetchDomainBuildTasks().catch(error => ({ status: 'unavailable', tasks: [], error: { message: error.message } }));
      if (sequence !== outlineLoadSequence || outlineProjectionKey() !== routeKey) return;
      appState.domainBuildTaskProjection = domainTasks.status === 'unavailable' ? domainTasks : { status: 'ok', ...domainTasks };
      if (appState.activeView === 'outlines') await updateOutlineAssignments();
    }
  })().finally(() => { if (outlineLoadPromise?.promise === promise) outlineLoadPromise = null; });
  outlineLoadPromise = { routeKey, promise };
  return promise;
}

async function loadDomainBuildTasksWorkspace() {
  try {
    appState.domainBuildTaskProjection = { status: 'ok', ...(await fetchDomainBuildTasks()) };
  } catch (error) {
    appState.domainBuildTaskProjection = { status: 'unavailable', tasks: [], error: { message: error.message } };
  }
  if (appState.activeView === 'dashboard') render();
  else if (appState.activeView === 'outlines') await updateOutlineAssignments();
}

let myTasksRequestVersion = 0;
let myTasksPaintFrame = 0;
let responsibleDirectory = null;
async function loadMyTasksWorkspace({ retain = false } = {}) {
  if (!canPerform('platform:manage')) { responsibleDirectory = null; resetResponsibleSelection(); }
  if (myTasksPaintFrame) cancelAnimationFrame(myTasksPaintFrame);
  myTasksPaintFrame = 0;
  const requestVersion = ++myTasksRequestVersion;
  const publish = projection => {
    if (requestVersion !== myTasksRequestVersion) return;
    appState.myTasksProjection = projection;
    window.__knowledgeMyTasksProjection = projection;
    if (appState.activeView !== 'dashboard' || myTasksPaintFrame) return;
    myTasksPaintFrame = requestAnimationFrame(() => {
      myTasksPaintFrame = 0;
      if (requestVersion !== myTasksRequestVersion || appState.activeView !== 'dashboard' || document.querySelector('[data-my-task-dialog][open]')) return;
      if (!updateMyTasksProjection(appState.myTasksProjection)) render();
    });
  };
  const ownId = String(authState.session?.user?.principalId || authState.session?.user?.id || '');
  const selectedId = getSelectedResponsibleId() || ownId;
  const preview = { enabled: Boolean(responsibleDirectory), selectedId, delegated: selectedId !== ownId, displayName: responsibleDirectory?.find(person => person.id === selectedId)?.displayName || '', operatorName: authState.session?.user?.displayName || authState.session?.user?.loginName || '管理员' };
  let people = responsibleDirectory || [];
  const publishWithPreview = projection => publish({ ...projection, responsibles: people, preview: { ...preview } });
  publishWithPreview(retain && appState.myTasksProjection?.status === 'ok' && appState.myTasksProjection.queryKey === getMyTaskQueryKey()
    ? { ...appState.myTasksProjection, status: 'loading', pending: MY_TASK_SOURCE_COUNT }
    : { status: 'loading', items: [], total: 0, facets: { all: 0, actionable: 0, waiting: 0, types: {} }, unavailable: [], pending: MY_TASK_SOURCE_COUNT });
  if (!responsibleDirectory && canPerform('platform:manage')) {
    void (async () => { try {
      const response = await fetch('/knowledge-center/api/workbench/responsibles', { credentials: 'same-origin', cache: 'no-store' });
      if (response.ok) {
        responsibleDirectory = (await response.json()).data || null;
        people = responsibleDirectory || [];
        preview.enabled = Boolean(responsibleDirectory);
        if (requestVersion === myTasksRequestVersion) publishWithPreview(appState.myTasksProjection);
      }
    } catch (_) { /* The personal workbench remains available. */ } })();
  }
  try {
    publishWithPreview(await loadMyTasks());
  } catch (error) {
    publishWithPreview({ status: 'unavailable', items: [], total: 0, facets: { all: 0, actionable: 0, waiting: 0, types: {} }, unavailable: ['个人待办'], error: { message: error.message } });
  }
}
setRefreshHandler(loadMyTasksWorkspace);
setResponsibleHandler(loadMyTasksWorkspace);
setSyncHandler(action => publishIncrementalTask(action.taskId, { expectedCandidateDigest: action.candidateDigest }));

async function updateOutlineAssignments() {
  const routeKey = outlineProjectionKey();
  const { renderOutlineAssignments } = await import('./modules/outlines/view.js');
  if (appState.activeView !== 'outlines' || outlineProjectionKey() !== routeKey
      || appState.outlineProjection?.routeKey !== routeKey) return;
  const panel = byId('outline-panel-assignments');
  if (!panel || !appState.outlineProjection?.detail) return;
  panel.innerHTML = renderOutlineAssignments({
    outlineProjection: appState.outlineProjection,
    outlineView: outlineRouteState(),
    outlinePermissions: { create: canPerform('outline:create'), delete: canPerform('outline:delete'), purge: canPerform('outline:purge'), platformAdmin: isPlatformAdmin() },
    domainBuildTaskProjection: appState.domainBuildTaskProjection,
  });
  cleanupSearchableSelects();
  markDynamicSelects(panel);
  enhanceTableViews(panel, {
    preferenceScope: String(authState.session?.user?.principalId || authState.session?.user?.userId || authState.session?.user?.username || 'local'),
    onChange: render,
  });
  enhanceResizableNavigation(panel);
  enhanceDirectoryTrees(panel);
  window.lucide?.createIcons({ nodes: [panel] });
}

const assetBranchPreferenceKey = handbookId => `knowledge-center:asset-branch:${handbookId}`;
const assetStatisticsSequences = new Map();
function preferredAssetBranch(item) {
  const enabled = item.repository?.enabledBranches || [];
  let saved = null;
  try { saved = window.localStorage.getItem(assetBranchPreferenceKey(item.handbookId)); } catch (_error) { saved = null; }
  return enabled.includes(saved) ? saved : (item.repository?.defaultBranch || enabled[0] || '');
}

async function enrichAssetRepositoryStatistics(catalog) {
  const items = Array.isArray(catalog?.items) ? catalog.items : [];
  await Promise.all(items.filter(item => item.repositoryMapped).map(async item => {
    const branch = preferredAssetBranch(item);
    item.selectedBranch = branch;
    if (!branch) return;
    const sequence = (assetStatisticsSequences.get(item.handbookId) || 0) + 1;
    assetStatisticsSequences.set(item.handbookId, sequence);
    try {
      const access = await loadHandbookGitLabAccess(item.handbookId);
      if (access?.canRead === false) {
        item.statisticsStatus = 'forbidden';
        item.statisticsError = access.message || '当前 GitLab 账号不可读取该仓库';
        updateAssetStatistics(item);
        return;
      }
      const statistics = await loadHandbookRepositoryStatistics(item.handbookId, branch, 'zh');
      if (assetStatisticsSequences.get(item.handbookId) !== sequence || item.selectedBranch !== branch) return;
      Object.assign(item, statistics, { statisticsStatus: 'ok' });
      updateAssetStatistics(item);
    }
    catch (error) {
      if (assetStatisticsSequences.get(item.handbookId) !== sequence || item.selectedBranch !== branch) return;
      item.statisticsStatus = 'unavailable';
      item.statisticsError = error.message; updateAssetStatistics(item);
    }
  }));
  return catalog;
}

let assetLoadSequence = 0;
let assetCatalogRouteKey = '';
function assetCatalogQuery(search = window.location.search) {
  const params = new URLSearchParams(search);
  const query = new URLSearchParams();
  for (const key of ['q','owner','status','productId','lifecycle','page','pageSize']) if (params.get(key)) query.set(key, params.get(key));
  if (params.get('archived') === 'true') query.set('includeArchived', 'true');
  return query;
}
function principalFromSelect(select) {
  if (!select?.value) return null;
  const option = select.selectedOptions?.[0];
  const principalId = Number(select.value);
  if (!Number.isSafeInteger(principalId) || principalId <= 0 || !option?.dataset.displayName) throw new Error('请从人员列表中选择责任人');
  return { principalId, userId: principalId, displayName: option.dataset.displayName };
}

async function loadAssetCatalog() {
  const sequence = ++assetLoadSequence;
  const query = assetCatalogQuery();
  const requestQuery = new URLSearchParams(query);
  const requestedHandbookId = new URLSearchParams(window.location.search).get('handbookId');
  if (requestedHandbookId) requestQuery.set('handbookId', requestedHandbookId);
  const [response, connections, principals] = await Promise.all([loadAssets(requestQuery), isPlatformAdmin() ? loadGitLabConnections().catch(() => ({ items: [] })) : Promise.resolve({ items: [] }), isPlatformAdmin() ? loadPrincipals({ state: 'ACTIVE' }).catch(() => ({ items: [] })) : Promise.resolve({ items: [] })]);
  if (sequence !== assetLoadSequence) return;
  assetCatalogRouteKey = query.toString();
  appState.assetCatalog = response?.data || response || null;
  appState.principalProjection = principals?.data || principals || { items: [] };
  appState.gitlabProjection = { ...(appState.gitlabProjection || {}), connections: connections?.items || [] };
  for (const item of appState.assetCatalog?.items || []) if (item.repositoryMapped && preferredAssetBranch(item)) item.statisticsStatus = 'loading';
  if (appState.activeView === 'assets') render();
  await enrichAssetRepositoryStatistics(appState.assetCatalog);
}

async function loadGitLabAdmin({ onConnectionsReady } = {}) {
  if (!isPlatformAdmin()) return;
  const showConnectionsFirst = appState.activeView === 'platform' && appState.platformTab === 'gitlab' && !appState.gitlabListState.mappingView;
  const loadAncillary = () => Promise.all([
    loadGitLabOAuthStatus().catch(() => ({ connected: false, mode: 'unavailable' })),
    loadGitLabOAuthConfig().catch(() => ({ configured: false, devHttp: false })),
    loadPlatformPermissions({ q: appState.permissionUserSearch, ...appState.permissionListState }).catch(error => ({ error })),
    loadPrincipals().catch(error => ({ error })),
    loadTeamGroups().catch(error => ({ error })),
    loadGitLabVersionMappings().catch(error => ({ error })),
  ]);
  const ancillaryPromise = showConnectionsFirst ? null : loadAncillary();
  if (showConnectionsFirst && !appState.gitlabProjection?.connections?.length) {
    appState.gitlabProjection = { ...appState.gitlabProjection, connectionLoadStatus: 'loading', oauthStatus: { loading: true } };
    render();
  }
  const prefetched = window.__gitlabConnectionsPrefetch;
  window.__gitlabConnectionsPrefetch = null;
  const gitlab = await (prefetched ? prefetched.then(result => result.error ? loadGitLabConnections() : result) : loadGitLabConnections()).catch(error => ({ error }));
  appState.gitlabProjection = {
    ...appState.gitlabProjection,
    connections: gitlab.error ? [] : (gitlab?.items || gitlab?.data?.items || []),
    adminError: gitlab.error?.message,
    connectionLoadStatus: gitlab.error ? 'error' : 'ready',
  };
  if (showConnectionsFirst) {
    render();
    onConnectionsReady?.();
  }
  const [oauthStatus, oauthConfig, permissions, principals, teamGroups, versionMappings] = await (ancillaryPromise || loadAncillary());
  appState.gitlabProjection = { ...(appState.gitlabProjection || {}), connections: gitlab.error ? [] : (gitlab?.items || gitlab?.data?.items || []), oauthStatus, oauthConfig, adminError: gitlab.error?.message, versionMappings: versionMappings.items || [], archivedVersionMappings: versionMappings.archivedItems || [], mappingError: versionMappings.error?.message };
  updatePlatformGovernance(appState.contextProjection, appState.projection, appState.gitlabProjection);
  if (permissions.error) appState.permissionProjection = { status: 'unavailable', error: permissions.error.message };
  else {
    const payload = permissions?.data || permissions?.content || permissions;
    appState.permissionProjection = { ...(payload || {}), status: 'ok' };
    if (Array.isArray(payload?.users)) {
      const stillVisible = payload.users.some(user => user.id === appState.selectedPermissionUserId);
      if ((!stillVisible || !appState.selectedPermissionUserId) && payload.users.length) {
        appState.selectedPermissionUserId = payload.users[0].id;
      } else if (!payload.users.length) {
        appState.selectedPermissionUserId = null;
      }
    }
  }
  appState.principalProjection = principals.error ? { status: 'unavailable', error: principals.error.message, items: [] } : { ...(principals?.data || principals || {}), status: 'ok' };
  appState.teamGroupProjection = teamGroups.error ? { status: 'unavailable', error: teamGroups.error.message, errorCode: teamGroups.error.code, statusCode: teamGroups.error.status, items: [] } : { ...(teamGroups?.data || teamGroups || {}), status: 'ok' };
  if (appState.activeView === 'platform') render();
}

async function loadTeamGroupsAdmin() {
  appState.teamGroupProjection = { ...(appState.teamGroupProjection || {}), status: 'loading' };
  appState.teamGroupUi.saveStatus = null;
  if (appState.activeView === 'platform') render();
  try {
    const result = await loadTeamGroups();
    appState.teamGroupProjection = { ...(result?.data || result || {}), status: 'ok' };
  } catch (error) {
    appState.teamGroupProjection = { status: 'unavailable', error: error.message, errorCode: error.code, statusCode: error.status, items: [] };
  }
  if (appState.activeView === 'platform') render();
}

async function loadDatabaseConnectionAdmin() {
  appState.databaseConnectionProjection = { ...(appState.databaseConnectionProjection || {}), status: 'loading', healthStatus: 'loading' };
  if (appState.activeView === 'platform') render();
  try {
    const result = await loadDatabaseConnectionStatus();
    appState.databaseConnectionProjection = result?.data || result;
  }
  catch (error) { appState.databaseConnectionProjection = { status: 'unavailable', healthStatus: 'unavailable', error: error.message, healthError: { message: error.message } }; }
  if (appState.activeView === 'platform') render();
}

function databaseConnectionPayload(container = document.querySelector('[data-database-dialog]')) {
  return Object.fromEntries([...(container?.querySelectorAll('[data-database-field]') || [])].map(input => [input.dataset.databaseField, input.value]));
}

function databaseConnectionDraft(payload) {
  const { password: _password, ...draft } = payload;
  return draft;
}

function closeDatabaseConnectionDrawer({ confirmDirty = true } = {}) {
  if (confirmDirty && appState.databaseConnectionDirty && !window.confirm('当前修改尚未保存，确定关闭吗？')) return false;
  appState.databaseConnectionDrawerOpen = false;
  appState.databaseConnectionDrawerShouldFocus = false;
  appState.databaseConnectionDirty = false;
  appState.databaseConnectionAdvancedOpen = false;
  appState.databaseConnectionForm = null;
  appState.databaseConnectionStatus = null;
  render();
  requestAnimationFrame(() => document.querySelector('[data-database-open]')?.focus());
  return true;
}

function syncDatabaseConnectionDraft(container = document.querySelector('[data-database-dialog]')) {
  appState.databaseConnectionForm = databaseConnectionDraft(databaseConnectionPayload(container));
  appState.databaseConnectionDirty = true;
  if (appState.databaseConnectionStatus?.kind === 'success') appState.databaseConnectionStatus = null;
}

function updateDatabaseConnectionOperationUi(container, status, busy = false) {
  const feedback = container?.querySelector('.database-connection-feedback');
  if (feedback) {
    feedback.textContent = status?.message || '';
    feedback.classList.toggle('success', status?.kind === 'success');
    feedback.classList.toggle('error', status?.kind === 'error');
    feedback.classList.toggle('pending', status?.kind === 'pending');
  }
  container?.querySelectorAll('[data-database-close], [data-database-test], [data-database-save]').forEach(button => { button.disabled = busy; });
  const testButton = container?.querySelector('[data-database-test]');
  if (testButton) testButton.textContent = busy ? '处理中…' : '仅测试连接';
}

document.addEventListener('cancel', event => {
  if (event.target.matches?.('[data-database-dialog]')) {
    event.preventDefault();
    closeDatabaseConnectionDrawer();
    return;
  }
  if (event.target.matches?.('[data-asset-archive-dialog]')) {
    event.preventDefault();
    cancelAssetArchiveDialog(event.target);
    return;
  }
  if (event.target.matches?.('[data-principal-cas-correction-dialog]')) {
    event.preventDefault();
    event.target.close();
    const input = pendingPrincipalCorrection?.form?.elements.casLoginName;
    pendingPrincipalCorrection = null;
    requestAnimationFrame(() => input?.focus());
  }
}, true);

document.addEventListener('toggle', event => {
  if (event.target.matches?.('[data-database-advanced]')) appState.databaseConnectionAdvancedOpen = event.target.open;
  if (event.target.matches?.('[data-handbook-directory-group]')) {
    const key = event.target.dataset.handbookDirectoryGroup;
    if (key) appState.handbookProductionUi.directoryOpen[key] = event.target.open;
  }
}, true);

document.addEventListener('knowledge-center:navigation-pane-change', event => {
  const { id, width, collapsed } = event.detail || {};
  if (id === 'review') {
    appState.reviewUi.directoryWidth = width;
    appState.reviewUi.directoryCollapsed = collapsed;
  }
  if (id === 'production-handbook') {
    appState.handbookProductionUi.directoryWidth = width;
    appState.handbookProductionUi.directoryCollapsed = collapsed;
  }
});

let permissionSearchTimer = null;
function refreshPermissionResults(searchValue) {
  appState.permissionUserSearch = searchValue.trim();
  clearTimeout(permissionSearchTimer);
  permissionSearchTimer = setTimeout(() => loadGitLabAdmin(), 250);
}

let permissionSearchComposing = false;
let productionSearchComposing = false;

let handbookWorkspaceSequence = 0;
const handbookIconTemplates = new WeakMap();

function enhanceHandbookEditorIcons(roots) {
  const lucide = window.lucide;
  if (!lucide?.createElement || !lucide.icons) return;
  for (const root of roots) {
    for (const node of root.querySelectorAll('[data-lucide]:not(svg)')) {
      const name = node.getAttribute('data-lucide');
      const key = name.replace(/(\w)(\w*)(_|-|\s*)/g, (_, first, rest) => first.toUpperCase() + rest.toLowerCase());
      const definition = lucide.icons[key];
      if (!definition) continue;
      const [, defaults] = definition;
      const attrs = { ...defaults, ...Object.fromEntries([...node.attributes].map(attr => [attr.name, attr.value])) };
      attrs.class = [...new Set(['lucide', `lucide-${name}`, ...(attrs.class || '').split(/\s+/)].filter(Boolean))].join(' ');
      let template = handbookIconTemplates.get(definition);
      if (!template) {
        template = lucide.createElement(definition);
        handbookIconTemplates.set(definition, template);
      }
      const icon = template.cloneNode(true);
      for (const [key, value] of Object.entries(attrs)) icon.setAttribute(key, value);
      node.replaceWith(icon);
    }
  }
}

function refreshHandbookEditor(documentId) {
  const page = document.querySelector('.handbook-production-page');
  const current = page?.querySelector('.handbook-production-editor');
  const dialogs = [...(page?.querySelectorAll(':scope > dialog') || [])];
  if (!current || current.dataset.handbookCurrentDocument !== String(documentId) || dialogs.length !== 4) return render();
  const fragment = document.createElement('template');
  fragment.innerHTML = renderHandbookProduction({ projection: appState.incrementalProjection,
    currentUser: { ...(authState.session?.user || {}), displayName: displayName() },
    ui: handbookUi(), templateProjection: appState.templateProjection, region: 'editor' });
  const nextEditor = fragment.content.querySelector('.handbook-production-editor');
  const nextDialogs = [...fragment.content.querySelectorAll('dialog')];
  if (!nextEditor || nextDialogs.length !== dialogs.length) return render();
  current.replaceWith(nextEditor);
  dialogs.forEach((dialog, index) => dialog.replaceWith(nextDialogs[index]));
  const item = [...page.querySelectorAll('[data-handbook-document]')]
    .find(node => node.dataset.handbookDocument === String(documentId));
  const label = item?.querySelector('small');
  if (label) {
    const status = documentStatus({ id: documentId }, handbookUi(), handbookUi().repository?.branch || '');
    label.textContent = status;
    label.hidden = status === '未编辑';
  }
  enhanceHandbookEditorIcons([nextEditor, ...nextDialogs]);
  requestAnimationFrame(mountHandbookVditor);
}

async function loadHandbookWorkspace(productionState, params) {
  const sequence = ++handbookWorkspaceSequence;
  const handbookId = productionState.handbookId;
  // Mapping has no directory dependency. Capture errors immediately while the
  // directory loads; never read a draft until its branch is actually resolved.
  let mappingResult;
  // Start the directory read before the loading render. The loading shell is
  // independent of directory data; keeping the request ahead of it removes
  // avoidable click-to-request main-thread delay under browser concurrency.
  const handbookOutlinePromise = loadOutlineData(handbookId, null, 'directory');
  const isCurrent = () => sequence === handbookWorkspaceSequence
    && appState.activeView === 'production'
    && productionRouteState().handbookId === handbookId
    && productionRouteState().documentId === productionState.documentId
    && productionRouteState().branch === productionState.branch;
  appState.incrementalProjection = { status: 'loading', requestedHandbookId: handbookId };
  render();
  const handbookOutline = await handbookOutlinePromise;
  if (!isCurrent()) return;
  markHandbookPerformance('workspace.directoryDataReady', { status: handbookOutline.status });
  markHandbookPerformance('workspace.directoryStateUpdateStart');
  const documents = collectDocuments(outlineNodes(handbookOutline.detail || {}));
  const visibleDocuments = params.get('view') === 'mine'
    ? documents.filter(item => ownedByCurrentUser(handbookOutline.detail, item.id, { ...(authState.session?.user || {}), displayName: displayName() }))
    : documents;
  let documentId = productionState.documentId
    ? (documents.some(item => item.id === productionState.documentId) ? productionState.documentId : '')
    : visibleDocuments[0]?.id || '';
  const ui = handbookUi();
  // Entering a handbook opens its directory; a document deep link keeps the reading view.
  if (!productionState.documentId) ui.directoryDrawerOpen = true;
  ui.draftContextResolved = false;
  ui.repository = { mapped: false, status: 'loading', filesByDocument: {}, contentByDocument: {} };
  if (documentId) ui.draftLoadState[documentId] = 'loading';
  appState.incrementalProjection = { status: 'ok', items: [], detail: null,
    requestedHandbookId: handbookId, handbookOutline, handbooks: [] };
  markHandbookPerformance('workspace.directoryStateUpdateEnd', { documentCount: documents.length, visibleDocumentCount: visibleDocuments.length });
  // Directory is usable before any mapping, draft, template or remote repository response.
  render();
  if (handbookOutline.status !== 'ok') return;
  // Mapping is auxiliary to the directory. Start it after the directory has
  // been projected so concurrent entries do not make the directory read
  // compete with an unrelated repository lookup.
  mappingResult = loadHandbookRepositoryMapping(handbookId, 'production').then(
    mapping => ({ mapping }),
    error => ['GITLAB_MAPPING_NOT_FOUND', 'GITLAB_LANGUAGE_NOT_MAPPED'].includes(error.code)
      ? { mapping: null } : { error },
  );
  const templateSummaries = loadTemplates({ summary: '1' }).then(result => {
    const items = result?.data || result?.items || [];
    if (isCurrent()) appState.templateProjection = { items };
    return items;
  });
  if (documentId) Promise.all([loadTemplateMappings({ handbookId, documentId, limit: 1 }), templateSummaries]).then(([result, templates]) => {
    const item = result?.data?.items?.[0];
    if (!isCurrent() || item?.status !== 'active') return;
    if (templates.some(template => template.id === item.templateId && template.status === 'active')) {
      if (!ui.templateByDocument?.[documentId]) { ui.templateByDocument[documentId] = item.templateId; render(); }
    } else {
      if (ui.templateByDocument?.[documentId] === item.templateId) delete ui.templateByDocument[documentId];
      showAppNotice('已关联的模板已停用，请重新选择启用模板。');
      render();
    }
  }).catch(() => {});
  else templateSummaries.catch(() => {});
  try {
    const resolvedMapping = await mappingResult;
    if (!isCurrent()) return;
    if (resolvedMapping.error) throw resolvedMapping.error;
    markHandbookPerformance('workspace.mappingReady', { mapped: Boolean(resolvedMapping.mapping) });
    const mapping = resolvedMapping.mapping;
    const enabled = mapping?.enabledBranches || [mapping?.defaultBranch].filter(Boolean);
    const branch = enabled.includes(productionState.branch) ? productionState.branch : mapping?.defaultBranch || enabled[0] || '';
    ui.repository = { mapped: Boolean(mapping?.connectionId || mapping?.project || Array.isArray(mapping?.zhPaths)),
      status: 'loading', branch, mapping, filesByDocument: {}, contentByDocument: {} };
    ui.draftContextResolved = true;
    const reviewPath = params.get('reviewPath');
    const draft = !reviewPath && documentId ? loadSharedHandbookDraft(documentId, isCurrent) : Promise.resolve();
    const repository = loadHandbookProductionRepository(handbookId, documents, productionState.branch, documentId,
      { mapping, shouldReadFile: async () => { await draft; return !ui.serverDrafts[documentId]?.exists; } });
    await draft;
    if (!isCurrent()) return;
    markHandbookPerformance('workspace.draftReady', { exists: Boolean(ui.serverDrafts[documentId]?.exists) });
    if (ui.serverDrafts[documentId]?.exists) refreshHandbookEditor(documentId);
    else if (ui.draftLoadState[documentId] === 'failed' || ui.draftLoadState[documentId] === 'forbidden') render();
    const resolvedRepository = await repository;
    if (!isCurrent()) return;
    markHandbookPerformance('workspace.repositoryReady', { status: resolvedRepository.status });
    ui.repository = resolvedRepository;
    if (reviewPath) {
      const matches = Object.entries(resolvedRepository.filesByDocument || {}).filter(([, file]) => file?.matched && file.path === reviewPath);
      const url = new URL(location.href);
      url.searchParams.delete('reviewPath');
      url.searchParams.set('documentId', matches.length === 1 ? matches[0][0] : '__unmatched_review_path__');
      history.replaceState(history.state, '', `${url.pathname}${url.search}`);
      return loadIncrementalWorkspace();
    }
    // A saved editor can already be active. Auxiliary completion must not replace its DOM/cursor.
    if (!ui.serverDrafts[documentId]?.exists && !ui.dirtyDocuments?.includes(documentId)) refreshHandbookEditor(documentId);
  } catch (error) {
    if (!isCurrent()) return;
    ui.repository = { mapped: false, status: repositoryStatusFor(error), filesByDocument: {}, contentByDocument: {}, error: { message: error.message } };
    // Failure to resolve a branch must never read/save another context under a guessed branch.
    if (documentId) ui.draftLoadState[documentId] = 'failed';
    render();
  }
}

async function loadIncrementalWorkspace(preferredTaskId = null) {
  if (appState.activeView !== 'production' && appState.activeView !== 'stages') return;
  const params = new URLSearchParams(window.location.search);
  const taskId = preferredTaskId || params.get('taskId');
  const productionState = productionRouteState();
  const reviewPath = params.get('reviewPath') || '';
  const requestedHandbookId = productionState.handbookId;
  if (requestedHandbookId) return loadHandbookWorkspace(productionState, params);
  ++handbookWorkspaceSequence;
  if (!requestedHandbookId && params.get('view') === 'todo') {
    const canonicalUrl = new URL(window.location.href);
    canonicalUrl.searchParams.set('view', 'generations');
    window.history.replaceState({ ...window.history.state, view: 'production', productionView: 'generations' }, document.title, `${canonicalUrl.pathname}${canonicalUrl.search}`);
  }
  appState.incrementalProjection = { ...(appState.incrementalProjection || {}), status: 'loading', requestedHandbookId };
  render();
  try {
    const [tasks, assets, handbookOutline, templates, generations, outlineCatalog] = await Promise.all([
      loadIncrementalTasks(requestedHandbookId ? { handbookId: requestedHandbookId } : {})
        .catch(error => requestedHandbookId ? [] : Promise.reject(error)),
      loadAssets(new URLSearchParams({ pageSize: '100' })).catch(() => null),
      requestedHandbookId ? loadOutlineData(requestedHandbookId) : Promise.resolve(null),
      requestedHandbookId ? loadTemplates({ summary: '1' }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      requestedHandbookId || !['generations', 'todo'].includes(params.get('view')) ? Promise.resolve(null) : loadMyGenerations()
        .then(data => ({ status: 'ready', items: data?.items || [], generatedAt: data?.generatedAt || null }))
        .catch(error => ({ status: error.status === 403 ? 'forbidden' : 'unavailable', items: [], error: { code: error.code, message: error.message } })),
      requestedHandbookId ? Promise.resolve(null) : loadOutlineData(),
    ]);
    const items = Array.isArray(tasks) ? tasks : (tasks?.items || []);
    const selectedId = taskId || null;
    const detail = selectedId ? await loadIncrementalTask(selectedId) : null;
    let repository = { mapped: false, status: 'not-mapped', filesByDocument: {}, contentByDocument: {} };
    let handbookDocuments = [];
    if (requestedHandbookId && handbookOutline?.status === 'ok') {
      try {
        const detail = handbookOutline.detail || {};
        const nodes = detail.nodes || detail.tree || detail.chapters || detail.content?.parts || detail.content?.chapters || detail.parts || [];
        const flatten = value => (Array.isArray(value) ? value : []).flatMap(item => {
          const children = item.children || item.nodes || item.chapters || item.documents || item.knowledgePoints || [];
          const isDoc = item.kind === 'document' || item.legacyKind === 'knowledge_point' || item.type === 'document' || item.documentId;
          return isDoc ? [item] : flatten(children);
        });
        handbookDocuments = flatten(nodes).map((item, index) => ({ id: String(item.id || item.documentId || item.sourceId || `document-${index + 1}`), sourceId: String(item.sourceId || item.documentId || ''), title: String(item.title || item.name || item.displayName || item.part || '未命名目录条目'), item }));
        const repositoryDocumentId = handbookDocuments.some(item => item.id === productionState.documentId)
          ? productionState.documentId : (!productionState.documentId ? handbookDocuments[0]?.id : '');
        repository = await loadHandbookProductionRepository(requestedHandbookId, handbookDocuments, productionState.branch, repositoryDocumentId);
      } catch (error) {
        repository = { mapped: error.code !== 'GITLAB_MAPPING_NOT_FOUND' && error.code !== 'GITLAB_LANGUAGE_NOT_MAPPED', status: repositoryStatusFor(error), handbookId: requestedHandbookId, branch: productionState.branch, error: { code: error.code, message: error.message }, filesByDocument: {}, contentByDocument: {} };
      }
    }
    appState.handbookProductionUi.repository = repository;
    // Draft identity includes the published outline version. Project it before
    // the first draft request so read and save resolve the same context key.
    appState.incrementalProjection = {
      ...(appState.incrementalProjection || {}),
      requestedHandbookId,
      handbookOutline,
    };
    const matchingReviewDocuments = reviewPath ? Object.entries(repository.filesByDocument || {}).filter(([, file]) => file?.matched && file.path === reviewPath).map(([id]) => id) : [];
    if (reviewPath) {
      const url = new URL(window.location.href);
      url.searchParams.delete('reviewPath');
      url.searchParams.set('documentId', matchingReviewDocuments.length === 1 ? matchingReviewDocuments[0] : '__unmatched_review_path__');
      window.history.replaceState({ ...window.history.state, documentId: url.searchParams.get('documentId') }, '', `${url.pathname}${url.search}`);
    }
    const requestedDocumentId = reviewPath ? (matchingReviewDocuments.length === 1 ? matchingReviewDocuments[0] : '__unmatched_review_path__') : productionState.documentId;
    const selectedHandbookDocumentId = requestedDocumentId
      ? (handbookDocuments.some(item => item.id === requestedDocumentId) ? requestedDocumentId : '')
      : handbookDocuments[0]?.id || '';
    if (selectedHandbookDocumentId) await loadSharedHandbookDraft(selectedHandbookDocumentId);
    if (requestedHandbookId) {
      const templateItems = templates?.data || templates?.items || [];
      appState.templateProjection = { items: templateItems };
      const defaultTemplate = templateItems.find(item => item.status === 'active') || templateItems[0];
      if (defaultTemplate?.id && !appState.handbookProductionUi.templateDetails[defaultTemplate.id]) {
        const detail = await loadTemplate(defaultTemplate.id).then(result => result?.data).catch(() => null);
        if (detail) appState.handbookProductionUi.templateDetails[defaultTemplate.id] = detail;
      }
    }
    appState.incrementalProjection = {
      status: 'ok', items, detail,
      handbooks: assets?.items || assets?.data?.items || [], requestedHandbookId, handbookOutline, generations, outlineCatalog,
    };
  } catch (error) {
    appState.incrementalProjection = { status: 'unavailable', items: [], detail: null, requestedHandbookId, handbookOutline: null, error: { message: error.message } };
  }
  render();
}

function handbookUi() {
  return appState.handbookProductionUi;
}

// 抽屉只切换自身 DOM 状态，避免重绘写作区导致 Vditor 实例、光标和选区被销毁。
function setHandbookDrawerState(drawer, open) {
  const ui = handbookUi();
  const isDirectory = drawer === 'directory';
  const key = isDirectory ? 'directoryDrawerOpen' : 'assistantOpen';
  const otherKey = isDirectory ? 'assistantOpen' : 'directoryDrawerOpen';
  ui[key] = Boolean(open);
  if (open) ui[otherKey] = false;
  const directory = document.querySelector('.handbook-production-directory');
  const assistant = document.querySelector('.handbook-assistant-panel');
  const directoryBackdrop = document.querySelector('.handbook-directory-backdrop');
  const assistantBackdrop = document.querySelector('.handbook-assistant-backdrop');
  const sync = (element, visible) => {
    if (!element) return;
    element.classList.toggle('is-open', visible);
    element.setAttribute('aria-hidden', String(!visible));
  };
  sync(directory, ui.directoryDrawerOpen);
  sync(directoryBackdrop, ui.directoryDrawerOpen);
  sync(assistant, ui.assistantOpen);
  sync(assistantBackdrop, ui.assistantOpen);
  document.querySelectorAll('[data-handbook-directory-open]').forEach(button => button.setAttribute('aria-expanded', String(ui.directoryDrawerOpen)));
  document.querySelectorAll('[data-handbook-assistant-open]').forEach(button => button.setAttribute('aria-expanded', String(ui.assistantOpen)));
}

let handbookVditor = null;
let handbookVditorDocumentId = '';
let handbookVditorReady = false;
let handbookVditorElement = null;
let releaseHandbookImages = null;
let handbookAIEditorInputListener = null;
let handbookVditorMountId = 0;
const activeHandbookVditor = documentId => handbookVditorReady && handbookVditorDocumentId === documentId ? handbookVditor : null;
let handbookCommandbarResizeObserver = null;
const getWritingSelection = retainWritingSelection(() => ({
  editor: handbookVditorReady ? handbookVditor : null,
  element: handbookVditorReady && handbookVditorElement?.isConnected ? handbookVditorElement : null,
}));
let vditorAssetsPromise = null;

function handbookDraftContext(documentId = document.querySelector('[data-handbook-current-document]')?.dataset.handbookCurrentDocument || '') {
  const route = productionRouteState();
  const outline = appState.incrementalProjection?.handbookOutline?.detail || {};
  return {
    handbookId: route.handbookId,
    documentId,
    outlineVersionId: String(outline.publishedVersion?.id || outline.publishedVersionId || outline.versionId || outline.outlineVersionId || outline.id || outline.outlineId || 'published'),
    branch: String(handbookUi().repository?.branch || route.branch || 'unmapped'),
  };
}

function currentHandbookMarkdown(documentId) {
  if (handbookUi().drafts?.[documentId] !== undefined) return String(handbookUi().drafts[documentId]);
  const revision = handbookUi().serverDrafts?.[documentId]?.draft?.revision;
  if (revision) return String(revision.markdown || '');
  const repository = handbookUi().repository || {};
  const mapped = repository.filesByDocument?.[documentId];
  if (mapped?.matched) return String(repository.contentByDocument?.[documentId] || '');
  return '';
}

function loadVditorAssets() {
  if (window.Vditor) return Promise.resolve(window.Vditor);
  if (vditorAssetsPromise) return vditorAssetsPromise;
  vditorAssetsPromise = new Promise((resolve, reject) => {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = './common/vendor/vditor/dist/index.css';
    stylesheet.dataset.vditorAsset = 'style';
    document.head.append(stylesheet);
    const script = document.createElement('script');
    script.src = './common/vendor/vditor/dist/index.min.js';
    script.dataset.vditorAsset = 'script';
    script.onload = () => resolve(window.Vditor);
    script.onerror = () => reject(new Error('编辑器资源加载失败'));
    document.head.append(script);
  });
  return vditorAssetsPromise;
}

function mountHandbookArticleOutline() {
  const surface = document.querySelector('.handbook-production-writing');
  const nav = surface?.querySelector('.handbook-article-outline');
  if (!nav) return;
  nav.replaceChildren();
  const headings = [...surface.querySelectorAll('.handbook-production-content.is-reading h2, .handbook-production-content.is-reading h3')].filter(heading => !heading.closest('.handbook-empty-intro'));
  nav.hidden = headings.length === 0;
  if (!headings.length) return;
  const title = document.createElement('span'); title.textContent = '本篇内容'; nav.append(title);
  headings.forEach((heading, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = heading.textContent;
    button.dataset.headingLevel = heading.tagName;
    button.onclick = () => {
      heading.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
      nav.querySelectorAll('button').forEach(item => item.removeAttribute('aria-current'));
      button.setAttribute('aria-current', 'location');
    };
    nav.append(button);
  });
}

function resizeHandbookMarkdownInput(input = document.querySelector('[data-handbook-markdown-editor]')) {
  if (!input || CSS.supports('field-sizing', 'content')) return;
  input.style.height = 'auto';
  input.style.height = `${input.scrollHeight}px`;
}
window.addEventListener('resize', () => resizeHandbookMarkdownInput());

async function mountHandbookVditor() {
  mountHandbookArticleOutline();
  resizeHandbookMarkdownInput();
  const target = document.querySelector('[data-handbook-vditor]');
  if (!target) {
    releaseHandbookImages?.(); releaseHandbookImages = null;
    handbookVditorMountId += 1;
    handbookCommandbarResizeObserver?.disconnect();
    handbookCommandbarResizeObserver = null;
    if (handbookVditor) handbookVditor.destroy();
    handbookVditorReady = false;
    handbookVditor = null; handbookVditorElement = null; handbookVditorDocumentId = '';
    return;
  }
  const documentId = target.dataset.documentId;
  if (handbookVditor && handbookVditorDocumentId === documentId && target.querySelector('.vditor')) return;
  const mountId = ++handbookVditorMountId;
  handbookVditorReady = false;
  handbookCommandbarResizeObserver?.disconnect();
  handbookCommandbarResizeObserver = null;
  releaseHandbookImages?.(); releaseHandbookImages = null;
  if (handbookVditor) handbookVditor.destroy();
  handbookVditor = null;
  try {
    const Vditor = await loadVditorAssets();
    if (!target.isConnected || mountId !== handbookVditorMountId) return;
    handbookVditorDocumentId = documentId;
    handbookVditorElement = target;
    handbookVditor = new Vditor(target, {
      cdn: `${window.location.origin}/knowledge-center/common/vendor/vditor`,
      mode: 'wysiwyg', lang: 'zh_CN', value: currentHandbookMarkdown(documentId),
      width: '100%', minHeight: 480, cache: { enable: false }, counter: { enable: true },
      after: () => {
        if (mountId !== handbookVditorMountId || !target.isConnected) return;
        handbookVditorReady = true;
        const repository = handbookUi().repository || {};
        releaseHandbookImages = observeRepositoryImages(target, repository.filesByDocument?.[documentId]?.path || '', {
          handbookId: handbookDraftContext(documentId).handbookId, branch: repository.branch || handbookDraftContext(documentId).branch, language: repository.language || 'zh',
        });
        const toolbar = target.querySelector('.vditor-toolbar');
        toolbar?.setAttribute('data-scroll-obstacle', '');
        const writing = target.closest('.handbook-production-writing');
        // Keep the format menu in the same sticky row as the editor commands.
        // The document heading follows that row inside the full-height editor.
        const format = writing?.querySelector(':scope > .handbook-editor-format');
        const heading = writing?.querySelector(':scope > .handbook-document-heading');
        if (toolbar && format) toolbar.append(format);
        if (toolbar && heading) toolbar.after(heading);
        const editor = target.closest('.handbook-production-editor');
        const commandbar = editor?.querySelector('.handbook-production-toolbar');
        const syncCommandbarHeight = () => {
          if (editor && commandbar) editor.style.setProperty('--handbook-commandbar-height', `${Math.ceil(commandbar.getBoundingClientRect().height)}px`);
        };
        syncCommandbarHeight();
        handbookCommandbarResizeObserver = new ResizeObserver(syncCommandbarHeight);
        if (commandbar) handbookCommandbarResizeObserver.observe(commandbar);
        scrollRuntime.refresh();
      },
      toolbar: ['headings', 'bold', 'italic', '|', 'list', 'ordered-list', 'table', 'code', 'link', 'upload', '|', 'undo', 'redo'],
      upload: {
        accept: '.png,.jpg,.jpeg,.webp,.gif,.md,.markdown,.pdf,.docx,.xlsx',
        handler: files => uploadFilesIntoHandbookDraft(documentId, [...files]),
      },
      input: markdown => {
        handbookUi().draftBranchByDocument[documentId] = handbookDraftContext(documentId).branch;
        handbookUi().drafts[documentId] = markdown;
        handbookUi().draftHtml[documentId] = activeHandbookVditor(documentId)?.getHTML?.() || '';
        updateHandbookUiList('dirtyDocuments', documentId, true);
        updateHandbookUiList('selectedForReview', documentId, false);
        updateHandbookDraftControls(documentId);
        handbookAIEditorInputListener?.(markdown);
      },
    });
  } catch (error) {
    target.innerHTML = `<div class="handbook-production-content-empty" role="alert"><strong>编辑器加载失败</strong><span>${escapeHtml(error.message)}</span></div>`;
  }
}

function syncHandbookMarkdownInput(input) {
  const documentId = input?.dataset.documentId;
  if (!documentId) return;
  handbookUi().draftBranchByDocument[documentId] = handbookDraftContext(documentId).branch;
  handbookUi().drafts[documentId] = input.value;
  handbookUi().draftHtml[documentId] = '';
  updateHandbookUiList('dirtyDocuments', documentId, true);
  updateHandbookUiList('selectedForReview', documentId, false);
  updateHandbookDraftControls(documentId);
}

function updateHandbookDraftControls(documentId) {
  const workspace = document.querySelector(`[data-handbook-current-document="${CSS.escape(documentId)}"]`);
  workspace?.querySelector('[data-handbook-save-status]')?.replaceChildren('有未保存修改');
  const save = workspace?.querySelector('[data-handbook-draft-save]');
  if (save) save.disabled = !canSaveHandbookDraft(documentId, handbookUi());
  const discard = workspace?.querySelector('[data-handbook-discard]'); if (discard) discard.disabled = false;
  const review = workspace?.querySelector('[data-handbook-review-current]');
  const action = handbookReviewAction(documentId, handbookUi());
  if (review) { review.disabled = action.disabled; review.title = action.hint; review.querySelector('[data-handbook-review-label]').textContent = action.label; }
  const hint = workspace?.querySelector('[data-handbook-review-hint]'); if (hint) { hint.textContent = action.reason; hint.hidden = !action.reason; }
}

async function loadSharedHandbookDraft(documentId, isCurrent = () => true) {
  if (!documentId) return;
  const context = handbookDraftContext(documentId);
  const contextId = JSON.stringify(context);
  const ui = handbookUi();
  ui.draftContextByDocument ||= {};
  if (ui.draftContextByDocument[documentId] !== contextId) {
    delete ui.serverDrafts[documentId]; delete ui.drafts[documentId]; delete ui.draftHtml[documentId];
    ui.draftContextByDocument[documentId] = contextId;
  }
  const valid = () => isCurrent() && ui.draftContextByDocument[documentId] === contextId;
  handbookUi().draftLoadState[documentId] = 'loading';
  try {
    const result = await loadHandbookDraft(context);
    if (!valid()) return;
    handbookUi().serverDrafts[documentId] = result;
    handbookUi().draftLoadState[documentId] = 'ready';
    if (handbookUi().draftSaveState?.[documentId]?.status === 'loadFailed') delete handbookUi().draftSaveState[documentId];
    if (ui.dirtyDocuments?.includes(documentId)) return;
    if (result.exists) {
      handbookUi().drafts[documentId] = result.draft.revision.markdown;
      handbookUi().draftHtml[documentId] = result.draft.revision.htmlSnapshot;
      handbookUi().draftBranchByDocument[documentId] = result.draft.branch;
      updateHandbookUiList('savedDocuments', documentId, true);
    } else {
      delete handbookUi().drafts[documentId]; delete handbookUi().draftHtml[documentId];
      updateHandbookUiList('savedDocuments', documentId, false);
    }
  } catch (error) {
    if (!valid()) return;
    handbookUi().draftLoadState[documentId] = error.status === 403 ? 'forbidden' : 'failed';
    if (handbookUi().draftSaveState?.[documentId]?.status === 'loadFailed') delete handbookUi().draftSaveState[documentId];
  }
}

async function uploadFilesIntoHandbookDraft(documentId, files) {
  const progress = document.querySelector('[data-handbook-attachment-progress]');
  for (const file of files) {
    try {
      if (progress) progress.textContent = `正在上传 ${file.name} · 0%`;
      const attachment = await uploadHandbookDraftAttachment(handbookDraftContext(documentId), file, percent => {
        if (progress) progress.textContent = `正在上传 ${file.name} · ${percent}%`;
      });
      handbookUi().attachments[documentId] = [...(handbookUi().attachments[documentId] || []), attachment];
      const label = attachment.kind === 'image'
        ? `![${file.name}](${attachment.stableReference})`
        : `[${file.name}](${attachment.stableReference})`;
      handbookVditor?.insertMD?.(label);
      if (progress) progress.textContent = `${file.name} 已上传，保存草稿后完成绑定。`;
    } catch (error) {
      if (progress) progress.textContent = `${file.name} 上传失败：${error.message}`;
    }
  }
  return null;
}

async function handbookBaselineDigest(documentId) {
  const contents = handbookUi().repository?.contentByDocument || {};
  if (Object.hasOwn(contents, documentId)) return sha256Text(contents[documentId]);
  // A new repository file has an empty baseline. Its digest must match the
  // server's baseline check when the saved draft is submitted for review.
  return handbookUi().serverDrafts?.[documentId]?.draft?.revision?.baselineDigest || sha256Text('');
}

async function saveCurrentHandbookDraft(documentId) {
  if (handbookUi().draftLoadState?.[documentId] !== 'ready') {
    showAppNotice('共享草稿服务暂不可用，当前编辑内容仍保留在页面中，请稍后重试。', { title: '暂时无法保存' });
    return;
  }
  const markdown = activeHandbookVditor(documentId)?.getValue() ?? currentHandbookMarkdown(documentId);
  const htmlSnapshot = activeHandbookVditor(documentId)?.getHTML() ?? handbookUi().draftHtml?.[documentId] ?? '';
  const current = handbookUi().serverDrafts?.[documentId];
  handbookUi().draftSaveState[documentId] = { status: 'saving' };
  updateHandbookDraftControls(documentId);
  const status = document.querySelector('[data-handbook-save-status]'); if (status) status.textContent = '保存中';
  const save = document.querySelector(`[data-handbook-draft-save="${CSS.escape(documentId)}"]`); if (save) save.disabled = true;
  try {
    const result = await saveHandbookDraft(handbookDraftContext(documentId), {
      baselineDigest: await handbookBaselineDigest(documentId),
      editVersion: current?.draft?.editVersion || 0,
      markdown,
      htmlSnapshot,
      templateVersionId: handbookUi().templateByDocument?.[documentId] || null,
      attachmentIds: (handbookUi().attachments?.[documentId] || []).map(item => item.attachmentId),
    });
    const latestMarkdown = activeHandbookVditor(documentId)?.getValue() ?? currentHandbookMarkdown(documentId);
    const changedWhileSaving = latestMarkdown !== markdown;
    const latestHtml = changedWhileSaving ? activeHandbookVditor(documentId)?.getHTML() ?? handbookUi().draftHtml?.[documentId] ?? '' : htmlSnapshot;
    handbookUi().serverDrafts[documentId] = result;
    handbookUi().drafts[documentId] = changedWhileSaving ? latestMarkdown : result.draft.revision.markdown;
    handbookUi().draftHtml[documentId] = changedWhileSaving ? latestHtml : result.draft.revision.htmlSnapshot;
    handbookUi().draftBranchByDocument[documentId] = result.draft.branch;
    handbookUi().draftSaveState[documentId] = { status: 'saved' };
    updateHandbookUiList('dirtyDocuments', documentId, changedWhileSaving);
    updateHandbookUiList('savedDocuments', documentId, true);
    // 保存只改变当前文档和目录中的状态标签；保留目录 DOM，避免长目录重新布局。
    refreshHandbookEditor(documentId);
    showAppNotice(changedWhileSaving ? '已保存提交时的正文；保存期间的后续修改仍未保存，请再次保存后送审。' : `共享草稿 v${result.draft.editVersion} 已保存，可从“更多”选择“提交审核”。`, { title: '保存成功' });
    return !changedWhileSaving;
  } catch (error) {
    if (error.code === 'DRAFT_VERSION_CONFLICT') {
      handbookUi().draftSaveState[documentId] = { status: 'conflict', message: error.message };
      handbookUi().conflict = { documentId, localMarkdown: markdown, localHtml: htmlSnapshot, serverDraft: error.details?.serverDraft };
      render();
      requestAnimationFrame(() => document.querySelector('[data-handbook-conflict-dialog]')?.showModal());
      return;
    }
    handbookUi().draftSaveState[documentId] = { status: 'failed', message: error.message };
    if (status) { status.textContent = `保存失败：${error.message}`; status.setAttribute('role', 'alert'); }
    updateHandbookDraftControls(documentId);
    if (status) status.textContent = `保存失败：${error.message}`;
  }
}

function discardLocalHandbookChanges(documentId) {
  const server = handbookUi().serverDrafts?.[documentId];
  if (server?.exists) {
    handbookUi().drafts[documentId] = server.draft.revision.markdown;
    handbookUi().draftHtml[documentId] = server.draft.revision.htmlSnapshot;
    handbookUi().draftBranchByDocument[documentId] = server.draft.branch;
  } else {
    delete handbookUi().drafts[documentId]; delete handbookUi().draftHtml[documentId]; delete handbookUi().draftBranchByDocument[documentId];
  }
  delete handbookUi().draftSaveState[documentId];
  updateHandbookUiList('dirtyDocuments', documentId, false);
  updateHandbookUiList('selectedForReview', documentId, false);
  refreshHandbookEditor(documentId);
}

async function openHandbookHistory(documentId) {
  handbookUi().history = { documentId, loading: true, items: [] };
  render();
  const dialog = document.querySelector('[data-handbook-history-dialog]'); dialog?.showModal();
  try {
    const result = await loadHandbookDraftRevisions(handbookDraftContext(documentId));
    handbookUi().history = { documentId, loading: false, items: result.items || [] };
    render();
    document.querySelector('[data-handbook-history-dialog]')?.showModal();
  } catch (error) {
    handbookUi().history = { documentId, loading: false, items: [], error: error.message };
    render(); document.querySelector('[data-handbook-history-dialog]')?.showModal();
  }
}

async function openHandbookReviewDialog() {
  const dialog = document.querySelector('[data-handbook-review-dialog]');
  dialog?.showModal();
  const status = dialog?.querySelector('[data-handbook-review-dialog-status]');
  if (status) status.textContent = '正在读取可用审核人…';
  try {
    const result = await loadHandbookReviewers(productionRouteState().handbookId);
    handbookUi().reviewers = result.items || [];
    const select = dialog.querySelector('[data-handbook-reviewer]');
    const reviewerOptions = handbookUi().reviewers.map(item => `<option value="${escapeHtml(item.id)}" ${item.disabled ? 'disabled' : ''}>${escapeHtml(item.displayName)}${item.disabled ? '（当前提交者）' : ''}</option>`).join('');
    select.innerHTML = '<option value="">请选择审核人（可以是本人）</option>' + reviewerOptions;
    const overrides = dialog.querySelector('[data-handbook-review-overrides]');
    overrides.innerHTML = '<strong>逐篇覆盖（可选）</strong>' + (handbookUi().selectedForReview || []).map(documentId => {
      const title = document.querySelector(`[data-handbook-review-document][value="${CSS.escape(documentId)}"]`)?.closest('label')?.querySelector('strong')?.textContent || documentId;
      const path = handbookUi().repository?.filesByDocument?.[documentId]?.path || '';
      return `<fieldset><legend>${escapeHtml(title)} · 已保存 v${handbookUi().serverDrafts?.[documentId]?.draft?.editVersion || ''}</legend><label>仓库文档路径<input data-handbook-review-path="${escapeHtml(documentId)}" value="${escapeHtml(path)}" required placeholder="映射目录中的文档路径，例如 docs/安装说明.md"></label><label><span>审核人</span><select data-handbook-review-override="${escapeHtml(documentId)}"><option value="">使用默认审核人</option>${reviewerOptions}</select></label></fieldset>`;
    }).join('');
    if (status) status.textContent = handbookUi().reviewers.length ? `目标分支：${handbookUi().repository?.branch || '未映射'}；本人审核仍需审核权限。` : '没有可用审核人，请管理员配置审核权限。';
  } catch (error) {
    if (status) status.textContent = `审核人读取失败：${error.message}`;
  }
}

function updateHandbookUiList(key, documentId, included) {
  const values = new Set(handbookUi()[key] || []);
  if (included) values.add(documentId);
  else values.delete(documentId);
  handbookUi()[key] = [...values];
}

function hasUnsavedHandbookChanges() {
  return Boolean(handbookUi()?.dirtyDocuments?.length);
}

function confirmLeavingHandbookDraft() {
  return !hasUnsavedHandbookChanges() || window.confirm('当前有未保存的文档修改，离开后将丢失这些修改。确认继续？');
}

const normalizeRepositoryName = value => String(value || '').replace(/\.(md|markdown)$/i, '').replace(/\\/g, '/').trim().toLowerCase();
const repositoryItems = value => Array.isArray(value) ? value : (value?.items || value?.tree || value?.files || []);

function handbookDocumentPath(document, files) {
  const candidates = [document.sourceId, document.title, document.item?.path, document.item?.filePath].map(normalizeRepositoryName).filter(Boolean);
  const matches = files.filter(file => {
    const path = normalizeRepositoryName(file.path || file.name);
    const base = path.split('/').pop();
    return candidates.some(candidate => candidate === path || candidate === base || candidate.split('/').pop() === base);
  });
  return matches.length === 1 ? (matches[0].path || matches[0].name) : '';
}

async function loadHandbookProductionRepository(handbookId, documents, preferredBranch = '', selectedDocumentId = '', options = {}) {
  const mapping = Object.hasOwn(options, 'mapping') ? options.mapping : await loadHandbookRepositoryMapping(handbookId, 'production');
  if (!mapping || (!mapping.connectionId && !mapping.project && !Array.isArray(mapping.zhPaths))) {
    return { mapped: false, status: 'not-mapped', handbookId, filesByDocument: {}, contentByDocument: {} };
  }
  const enabledBranches = mapping.enabledBranches || [mapping.defaultBranch].filter(Boolean);
  const defaultBranch = mapping.defaultBranch || enabledBranches[0] || '';
  const branch = enabledBranches.includes(preferredBranch) ? preferredBranch : defaultBranch;
  const base = { mapped: true, handbookId, branch, defaultBranch, branches: enabledBranches, enabledBranches, language: 'zh', filesByDocument: {}, contentByDocument: {}, mapping };
  try {
    requireReadableGitLabAccess(await loadHandbookGitLabAccess(handbookId));
    const metadata = await loadHandbookRepository(handbookId);
    const rawBranches = repositoryItems(metadata);
    if (rawBranches.length && !rawBranches.some(item => enabledBranches.includes(typeof item === 'string' ? item : item.name))) {
      return { ...base, status: 'not-found' };
    }
    const roots = Array.isArray(mapping.zhPaths) && mapping.zhPaths.length ? mapping.zhPaths : [''];
    const treeLists = branch ? await Promise.all(roots.map(path => loadHandbookRepositoryTree(handbookId, branch, 'zh', path).then(repositoryItems))) : [];
    const files = treeLists.flat().filter(item => item && (item.type === 'blob' || /\.(md|markdown)$/i.test(item.path || item.name || '')));
    const filesByDocument = {};
    documents.forEach(document => {
      const path = handbookDocumentPath(document, files);
      const treeFile = files.find(file => String(file.path || file.name || '') === path);
      filesByDocument[document.id] = { matched: Boolean(path), path: path || '', status: path ? 'matched' : 'missing', commitId: treeFile?.commitId || treeFile?.commitSha || null, blobId: treeFile?.blobId || treeFile?.blobSha || null };
    });
    const contentByDocument = {};
    const current = filesByDocument[selectedDocumentId];
    if (current?.matched && (!options.shouldReadFile || await options.shouldReadFile())) {
      const file = await loadHandbookRepositoryFile(handbookId, branch, 'zh', current.path);
      if (file?.path === current.path || !file?.path) {
        contentByDocument[selectedDocumentId] = String(file?.content ?? '');
        current.commitId = file?.commitId || file?.commitSha || current.commitId || null;
        current.blobId = file?.blobId || file?.blobSha || current.blobId || null;
      }
    }
    return { ...base, status: branch ? 'ok' : 'not-found', filesByDocument, contentByDocument };
  } catch (error) {
    return { ...base, status: repositoryStatusFor(error), error: { code: error.code, message: error.message } };
  }
}

function updateHandbookRoute(changes = {}, replace = false) {
  const current = productionRouteState();
  const url = new URL(window.location.href);
  const next = { ...current, ...changes };
  if (next.documentId) url.searchParams.set('documentId', next.documentId);
  else url.searchParams.delete('documentId');
  if (next.view === 'mine') url.searchParams.set('view', 'mine');
  else url.searchParams.delete('view');
  if (next.branch) url.searchParams.set('branch', next.branch);
  else url.searchParams.delete('branch');
  window.history[replace ? 'replaceState' : 'pushState']({ view: 'production', handbookId: next.handbookId, documentId: next.documentId }, '', `${url.pathname}${url.search}`);
}

let reviewLoadSequence = 0;
async function loadReviewWorkspace(taskId = null) {
  const sequence = ++reviewLoadSequence;
  const params = new URLSearchParams(window.location.search);
  const handbookId = params.get('handbookId') || '';
  const requestedTaskId = taskId || params.get('taskId') || '';
  const language = params.get('lang') === 'en' ? 'en' : 'zh';
  const branch = params.get('branch') || '';
  const requestedPath = params.get('path') || '';
  const view = params.get('view') || (requestedTaskId || handbookId ? 'reader' : 'handbooks');
  appState.reviewProjection = { status: 'loading', items: [], detail: null, handbookId };
  appState.gitlabProjection = { status: 'loading', handbookId, language, branch, requestedPath };
  performance.mark?.('review-load-start');
  render();
  try {
    const step = params.get('step') || (requestedTaskId ? 'diff' : 'read');
    const repositoryPromise = handbookId && view === 'reader' && !requestedTaskId
      ? loadReviewRepositoryContext(handbookId, { branch, language, path: requestedPath }).catch(error => ({ __error: error }))
      : null;
    const bootstrapOptions = { handbookId, taskId: requestedTaskId, step, view, documentId: params.get('documentId') || '', path: requestedPath };
    const prefetched = await takeReviewBootstrapPrefetch(bootstrapOptions);
    const bootstrap = prefetched ? prefetched.data : await loadReviewBootstrap(bootstrapOptions);
    if (sequence !== reviewLoadSequence) return;
    const selectedTask = bootstrap?.detail?.task || bootstrap?.detail || null;
    const readerHandbookId = selectedTask?.handbookId || bootstrap?.handbookId || handbookId || '';
    const readerBranch = selectedTask?.handbookSource?.branch || branch;
    const readerLanguage = selectedTask?.handbookSource ? 'zh' : language;
    appState.reviewProjection = { status: 'ok', ...bootstrap, handbookId: readerHandbookId, onlineReviewCommits: bootstrap?.onlineReviewCommits || [] };
    appState.gitlabProjection = { status: 'loading', handbookId: readerHandbookId, language: readerLanguage, branch: readerBranch, requestedPath };
    if (appState.activeView === 'review') render();
    performance.mark?.('review-workspace-ready');
    if (readerHandbookId && view === 'reader') {
      const operationPath = selectedTask?.handbookSource?.documents?.find(item => item.documentId === params.get('documentId'))?.filePath || selectedTask?.handbookSource?.documents?.[0]?.filePath || selectedTask?.target?.documentPaths?.[0] || selectedTask?.target?.paths?.[0] || selectedTask?.candidate?.operations?.find(item => item.path)?.path || '';
      let result = await (repositoryPromise || loadReviewRepositoryContext(readerHandbookId, { branch: readerBranch, language: readerLanguage, path: requestedPath, preferredPath: operationPath }).catch(error => ({ __error: error })));
      if (!result?.__error && !requestedPath && operationPath && result?.file?.path !== operationPath) {
        result = await loadReviewRepositoryContext(readerHandbookId, { branch: result.branch || readerBranch, language: readerLanguage, preferredPath: operationPath }).catch(error => ({ __error: error }));
      }
      if (sequence !== reviewLoadSequence) return;
      if (result?.__error) {
        const error = result.__error;
        appState.gitlabProjection = { status: repositoryStatusFor(error), handbookId: readerHandbookId, branch: readerBranch, language: readerLanguage, path: requestedPath, error: { code: error.code, message: error.message, status: error.status } };
      } else {
        appState.gitlabProjection = result;
      }
      if (appState.activeView === 'review') updateReviewRepositoryRegion();
      performance.mark?.('review-repository-ready');
      const hasBaseline = (bootstrap?.onlineReviewBaselines || []).some(item => item?.current === true);
      if (!selectedTask && !hasBaseline && !bootstrap?.onlineReviewBaselineError && appState.gitlabProjection?.branch) {
        loadHandbookRepositoryCommits(readerHandbookId, appState.gitlabProjection.branch).then(commits => {
          if (sequence === reviewLoadSequence) appState.reviewProjection.onlineReviewCommits = commits;
        }).catch(() => {});
      }
    }
  } catch (error) {
    // 保留已成功加载的 gitlabProjection，避免清除仓库正文导致阅读区空白
    if (sequence !== reviewLoadSequence) return;
    appState.reviewProjection = { status: 'unavailable', items: [], detail: null, error: { code: error.code, message: error.message } };
  }
  if (appState.activeView === 'review' && appState.reviewProjection.status === 'unavailable') render();
}

function updateReviewRepositoryRegion() {
  const current = document.querySelector('[data-review-repository-region]');
  if (!current) { render(); return; }
  const template = document.createElement('template');
  template.innerHTML = renderReviewRepositoryRegion({ reviewProjection: appState.reviewProjection, gitlabProjection: appState.gitlabProjection, reviewUi: appState.reviewUi });
  const replacement = template.content.firstElementChild;
  if (!replacement) return;
  const scrollTop = byId('main-shell')?.scrollTop || 0;
  current.replaceWith(replacement);
  if (byId('main-shell')) byId('main-shell').scrollTop = scrollTop;
  window.lucide?.createIcons({ nodes: [replacement] });
  markDynamicSelects(replacement);
  enhanceResizableNavigation(replacement);
  enhanceDirectoryTrees(replacement);
  updateReviewWaitingEntry(byId('view-root'), appState.gitlabProjection);
}

function incrementalStatus(formOrSection, message, error = false) {
  const status = formOrSection?.querySelector?.('.incremental-form-status');
  if (status) { status.textContent = message; status.classList.toggle('error', error); }
}

async function runIncrementalAction(control, taskId, operation, successMessage) {
  control.disabled = true;
  const container = control.closest('form, .incremental-section, .review-action-card');
  incrementalStatus(container, '正在处理…');
  try {
    await operation();
    incrementalStatus(container, successMessage);
    // Keep the active projection in sync. Review actions must reload the
    // review workspace (and its server-computed capabilities); otherwise a
    // successful decision would leave stale buttons visible until navigation.
    if (appState.activeView === 'review') { await loadReviewWorkspace(taskId); showAppNotice(successMessage, { title: '操作完成', tone: 'success' }); }
    else await loadIncrementalWorkspace(taskId);
  } catch (error) {
    const publishing = control.matches('[data-review-publish], [data-incremental-publish]');
    const recovery = !publishing ? '' : error.code === 'GITLAB_INSUFFICIENT_SCOPE'
      ? '请在权限开通后到个人设置重新连接 GitLab。审核任务已保留。'
      : error.code === 'GITLAB_NO_CHANGES' || error.code === 'GITLAB_BASELINE_CHANGED'
      ? '请返回文档生产修改、保存并重新提交审核。原审核任务已保留。'
      : error.code === 'ONLINE_REVIEW_REVISION_REQUIRED'
        ? '请返回文档生产保存修改稿并重新提交审核。原审核记录已保留。'
        : '审核任务已保留，可在确认原因后重试创建 MR。';
    incrementalStatus(container, `${error.message || '操作失败'}${recovery ? ` ${recovery}` : ''}`, true);
    if (appState.activeView === 'review') showAppNotice(error.message || '操作失败，请重试', { title: '操作失败', tone: 'error' });
    control.disabled = false;
  }
}

let noticeDismissTimer;
function showAppNotice(message, options = {}) {
  clearTimeout(noticeDismissTimer);
  noticeDismissTimer = undefined;
  const panel = byId('error-panel');
  const tone = options.tone === 'error' ? 'danger' : options.tone || 'warning';
  const action = byId('notice-action');
  panel.className = `notice notice-${tone}`;
  panel.hidden = false;
  byId('error-title').textContent = options.title || '操作提示';
  byId('error-message').textContent = message;
  byId('retry').hidden = options.retry !== true;
  action.hidden = !options.actionHref;
  if (options.actionHref) {
    action.href = options.actionHref;
    action.textContent = options.actionLabel || '查看详情';
  } else {
    action.removeAttribute('href');
    action.textContent = '';
  }
  const duration = tone === 'success' ? 3000 : ['error', 'danger'].includes(tone) ? 5000 : 0;
  if (duration) {
    noticeDismissTimer = setTimeout(() => {
      if (panel.classList.contains(`notice-${tone}`)) panel.hidden = true;
      noticeDismissTimer = undefined;
    }, duration);
  }
}

function showApplicationError(error) {
  showApplication();
  showAppNotice(`页面加载失败：${error?.message || '请重新加载页面。'}`, { title: '页面加载失败', tone: 'danger', retry: true });
}

function authErrorMessage(error) {
  const messages = {
    AUTH_SERVICE_UNAVAILABLE: '认证服务暂时不可用，请稍后重试。',
    CAS_TICKET_INVALID: '统一认证信息已失效，请重新登录。',
    CAS_TICKET_EXPIRED: '统一认证信息已过期，请重新登录。',
    CAS_SERVICE_MISMATCH: '登录请求无法验证，请联系平台管理员。',
    CAS_PRINCIPAL_NOT_FOUND: '未找到唯一的待绑定人员，请联系平台管理员核对姓名和人员状态。',
    CAS_PRINCIPAL_AMBIGUOUS: '存在多个同名待绑定人员，请联系平台管理员完成身份确认。',
    CAS_LOGIN_NAME_CONFLICT: '该 CAS 账号已绑定其他人员，请联系平台管理员。',
    CAS_LOGIN_BIND_CONFLICT: '该 CAS 账号绑定发生冲突，请重新登录；问题持续时请联系平台管理员。',
    CAS_PRINCIPAL_SYNC_FAILED: '统一认证已通过，但人员信息同步失败，请稍后重试。',
    ADMIN_ACCOUNT_LOCKED: '管理员账号暂时无法登录，请联系平台管理员。',
  };
  const message = messages[error?.code] || error?.message || '登录未完成，请重试。';
  const requestId = error?.details?.requestId;
  return requestId ? `${message}（请求编号：${requestId}）` : message;
}

function setAuthBusy(busy, status = '') {
  byId('auth-shell').setAttribute('aria-busy', String(busy));
  byId('auth-status').textContent = status;
  byId('cas-login').disabled = busy || !authState.config?.casEnabled;
  byId('admin-submit').disabled = busy;
}

function showAuth(error = null, status = '') {
  byId('auth-loading').hidden = true;
  byId('app-shell').hidden = true;
  byId('skip-to-main').hidden = true;
  byId('auth-shell').hidden = false;
  const enabled = Boolean(authState.config?.casEnabled && authState.config?.loginUrl);
  byId('cas-login').hidden = !enabled;
  const showAdmin = Boolean(authState.config?.showAdminLogin ?? authState.config?.adminLoginEnabled);
  byId('admin-login-details').hidden = !showAdmin;
  byId('auth-status').textContent = status || (enabled ? '请选择登录方式' : '统一认证当前不可用');
  byId('auth-error').hidden = !error;
  byId('auth-error').textContent = error ? authErrorMessage(error) : '';
  if (error) byId('auth-error').focus();
  byId('auth-retry').hidden = !error;
  setAuthBusy(false, byId('auth-status').textContent);
  window.lucide?.createIcons();
}

function showApplication() {
  viewportRuntime.update();
  const appShell = byId('app-shell');
  if (appShell.dataset.sidebarReady !== 'true') {
    applySidebar({ restoring: true });
    appShell.dataset.sidebarReady = 'true';
  }
  byId('auth-loading').hidden = true;
  byId('auth-shell').hidden = true;
  appShell.hidden = false;
  scrollRuntime.refresh();
  byId('skip-to-main').hidden = false;
  byId('sidebar-user').textContent = displayName();
}

function renderGitLabAccountDialog() {
  const root = byId('external-account-content');
  const projection = appState.gitlabAccountProjection || { status: 'loading' };
  if (projection.status === 'loading') {
    root.innerHTML = '<div class="external-account-loading" role="status">正在读取 GitLab 账号状态…</div>';
  } else if (projection.status === 'unavailable') {
    root.innerHTML = `<div class="external-account-error" role="alert"><strong>暂时无法读取账号状态</strong><p>${escapeHtml(projection.error || '请稍后重试。')}</p><button class="button secondary" type="button" data-external-account-retry>重试</button></div>`;
  } else {
    const items = projection.items || [];
    if (!items.length) root.innerHTML = '<section class="external-account-empty"><i data-lucide="git-branch" aria-hidden="true"></i><strong>暂无可连接的 GitLab</strong><p>请联系平台管理员配置可用的仓库连接。</p></section>';
    else root.innerHTML = `<div class="external-account-list" data-scroll-region="panel">${items.map(item => {
      const labels = { connected: '已连接', disconnected: '未连接', temporarily_unavailable: '暂时不可用', reauthorization_required: '需要重新连接', platform_disabled: '平台已停用' };
      const lastUsed = item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString('zh-CN', { hour12: false }) : '';
      const connected = item.status === 'connected';
      const unavailable = item.status === 'temporarily_unavailable';
      const reconnect = item.status === 'reauthorization_required';
      const disabled = item.status === 'platform_disabled';
      const message = unavailable ? '连接信息仍保留，请稍后重试。' : reconnect ? '原连接已失效，请重新授权。' : disabled ? '该连接已由平台管理员停用。' : '';
      const actions = disabled ? '' : connected || unavailable
        ? `<a class="button secondary" href="${gitLabOAuthHref(item.connectionId)}">更换</a><button class="button tertiary" type="button" data-external-account-disconnect="${escapeHtml(item.connectionId)}">解除</button>`
        : `<a class="button primary" href="${gitLabOAuthHref(item.connectionId)}">${reconnect ? '重新连接' : '连接'}</a>`;
      return `<section class="external-account-item"><i class="external-account-provider-icon" data-lucide="git-branch" aria-hidden="true"></i><div class="external-account-identity"><h3>${escapeHtml(item.name || 'GitLab')}</h3><p>${escapeHtml(item.host || '')}${lastUsed ? ` · 最近使用 ${escapeHtml(lastUsed)}` : ''}</p>${message ? `<p class="external-account-guidance">${message}</p>` : ''}</div><span class="external-account-status ${connected ? 'connected' : unavailable || reconnect ? 'warning' : ''}">${labels[item.status] || '未连接'}</span><div class="external-account-actions">${actions}</div></section>`;
    }).join('')}</div>`;
  }
  window.lucide?.createIcons();
}

async function loadGitLabAccount() {
  appState.gitlabAccountProjection = { status: 'loading' };
  renderGitLabAccountDialog();
  try {
    appState.gitlabAccountProjection = { status: 'ok', ...await loadGitLabOAuthAccounts() };
  } catch (error) {
    appState.gitlabAccountProjection = { status: 'unavailable', error: error.message };
  }
  renderGitLabAccountDialog();
}

function updatePlatformState(context, overview) {
  const states = [context?.status, overview?.status].filter(Boolean);
  const ok = states.length > 0 && states.every(status => status === 'ok');
  const unavailable = states.length === 0 || states.every(status => status === 'unavailable');
  byId('platform-status').textContent = ok ? '平台运行正常' : unavailable ? '平台数据不可用' : '部分服务降级';
  byId('platform-dot').className = `status-dot ${ok ? 'ok' : 'warning'}`;
  // 审核与发布有独立的审核/仓库数据链路。平台概览服务不可用时，不能
  // 覆盖审核页面并误报“平台数据暂时不可用”；该页面只由 reviewProjection
  // 的真实状态决定是否展示错误。
  const isReviewView = appState.activeView === 'review';
  if (unavailable && !isReviewView) {
    showAppNotice('当前无法读取平台数据，请稍后重新检查。', { title: '平台数据暂时不可用', tone: 'danger', retry: true });
  } else {
    byId('error-panel').hidden = true;
  }
}

function updatePlatformGovernance(context, overview, gitlabProjection = appState.gitlabProjection) {
  const modules = context?.modules || {};
  const moduleLabels = {
    documentGeneration: '文档生成服务',
    materialProcessing: '资料加工服务',
  };
  const services = Object.entries(moduleLabels).map(([key, name]) => ({
    name,
    status: modules[key]?.status === 'ok' ? 'ok' : modules[key]?.status === 'unavailable' ? 'warning' : 'unknown',
  }));
  const sections = overview?.sections || {};
  const failedSections = Object.entries(sections)
    .filter(([, section]) => section?.status && section.status !== 'ok')
    .map(([key, section]) => ({
      title: section?.error?.message || `${key} 模块不可用`,
      description: '请检查对应服务状态后重试。',
      actionUrl: null,
    }));
  const connections = Array.isArray(gitlabProjection?.connections) ? gitlabProjection.connections : [];
  const failedConnections = connections
    .filter(connection => connection.managementStatus !== 'disabled'
      && (connection.verificationStatus === 'failed' || connection.lastVerification?.status === 'failed'))
    .map(connection => ({
      title: `GitLab 连接“${connection.name || connection.projectPath || connection.project || '未命名'}”验证失败`,
      description: connection.lastVerification?.error?.message || '请检查连接凭证和项目权限。',
      actionUrl: '/knowledge-center/platform?tab=gitlab',
    }));
  const pendingItems = [...failedSections, ...failedConnections];
  const activeConnections = connections.filter(connection => connection.managementStatus !== 'disabled');
  const verifiedCount = activeConnections.filter(connection => (connection.verificationStatus || connection.lastVerification?.status) === 'verified').length;
  const connectionsReady = gitlabProjection?.connectionLoadStatus === 'ready';
  const connectionSummary = !connectionsReady
    ? gitlabProjection?.connectionLoadStatus === 'error' ? '连接状态暂不可用' : '连接状态读取中'
    : activeConnections.length ? `${verifiedCount}/${activeConnections.length} 个连接已验证` : '暂无连接';
  const storageStatus = sections.knowledgeIndex?.status === 'ok' && sections.datasets?.status === 'ok' ? '正常' : '需检查';
  appState.platformGovernance = {
    services,
    storageStatus,
    externalConnectionSummary: connectionSummary,
    externalConnectionStatus: !connectionsReady ? 'unknown' : verifiedCount < activeConnections.length ? 'warning' : activeConnections.length ? 'ok' : 'empty',
    pendingItems,
    recentOperations: [],
  };
}

let loadInFlight = null;
const queuedScopes = new Set();

async function load(scopes = ['context', 'overview']) {
  if (loadInFlight) {
    scopes.forEach(scope => queuedScopes.add(scope));
    return loadInFlight;
  }
  const main = byId('main');
  main.setAttribute('aria-busy', 'true');
  loadInFlight = (async () => {
    const { context, overview, requested } = await loadPlatformData(scopes);
    if (appState.activeView === 'cleaning' && !appState.cleaningProjection) {
      appState.cleaningProjection = { status: 'loading' };
      try { appState.cleaningProjection = { status: 'ok', ...(await loadCleaningWorkspace()), asOf: new Date().toISOString() }; }
      catch (error) { appState.cleaningProjection = { status: 'unavailable', error: { message: error.message, code: error.code } }; }
    }
    if (requested.context && context) appState.contextProjection = context;
    if (requested.overview && overview && overview.status !== 'unavailable') appState.projection = overview;
    const currentContext = requested.context ? context : appState.contextProjection;
    const currentOverview = requested.overview && overview ? overview : appState.projection;
    updatePlatformGovernance(currentContext, currentOverview);
    if (currentContext?.context?.brand?.enterpriseName) byId('enterprise-name').textContent = currentContext.context.brand.enterpriseName;
    else if (!appState.projection) byId('enterprise-name').textContent = '企业信息暂不可用';
    applyBrandIcon(currentContext?.context?.brand?.icon);
    updatePlatformState(currentContext, currentOverview);
    try {
      // Context updates refresh the shell; independent workspaces own their DOM lifecycle.
      if (!['dashboard', 'production', 'review', 'outlines', 'templates', 'documentTasks'].includes(appState.activeView) || (requested.overview && !['dashboard', 'documentTasks'].includes(appState.activeView))) render();
    } catch (error) {
      showApplicationError(error);
    }
  })();
  try {
    await loadInFlight;
  } finally {
    loadInFlight = null;
    main.removeAttribute('aria-busy');
    if (queuedScopes.size) {
      const nextScopes = [...queuedScopes];
      queuedScopes.clear();
      return load(nextScopes);
    }
  }
}

function applyBrandIcon(icon = {}) {
  const url = '/knowledge-center/api/platform/brand/icon';
  document.querySelectorAll('[data-brand-icon]').forEach(image => { image.src = url; image.alt = icon.alt || ''; image.hidden = false; image.nextElementSibling?.setAttribute('hidden', 'hidden'); image.onerror = () => { image.hidden = true; image.nextElementSibling?.removeAttribute('hidden'); }; });
  const favicon = byId('knowledge-center-favicon'); if (favicon) favicon.href = url;
}

document.addEventListener('dismissible-menu-close', event => {
  if (event.target.closest('.platform-tab-menu') && platformRenderDeferred
      && !document.querySelector('.platform-tab-menu details[open]')) queueMicrotask(render);
});

document.addEventListener('click', async event => {
  const openOutlineMenu = document.querySelector('[data-outline-context-menu]:not([hidden])');
  if (openOutlineMenu && !openOutlineMenu.contains(event.target)) openOutlineMenu.hidden = true;
  const principalOpenCreate = event.target.closest('[data-principal-open-create]');
  if (principalOpenCreate) {
    const dialog = document.querySelector('[data-principal-editor-dialog]');
    const form = dialog?.querySelector('[data-principal-editor-form]');
    form?.reset();
    if (form) {
      form.elements.principalId.value = '';
      form.elements.rowVersion.value = '';
      form.dataset.originalCasLoginName = '';
      form.elements.casLoginName.disabled = false;
      form.elements.casLoginName.required = false;
      form.elements.casLoginName.removeAttribute('aria-invalid');
      form.querySelector('[data-principal-dialog-title]').textContent = '新增人员';
      form.querySelector('[data-principal-login-help]').textContent = '可留空，首次登录时自动绑定。';
      form.querySelector('[data-principal-login-error]').textContent = '';
      form.querySelector('button[type="submit"]').textContent = '确认新增';
      form.querySelector('[data-principal-form-status]').textContent = '';
    }
    dialog?.showModal();
    form?.elements.displayName.focus();
    return;
  }
  const principalEdit = event.target.closest('[data-principal-edit]');
  if (principalEdit) {
    const item = appState.principalProjection?.items?.find(value => String(value.principalId) === principalEdit.dataset.principalEdit);
    const dialog = document.querySelector('[data-principal-editor-dialog]');
    const form = dialog?.querySelector('[data-principal-editor-form]');
    if (!item || !form) return;
    form.elements.principalId.value = item.principalId;
    form.elements.rowVersion.value = item.rowVersion;
    form.elements.displayName.value = item.displayName || '';
    form.elements.casLoginName.value = item.casLoginName || '';
    form.dataset.originalCasLoginName = item.casLoginName || '';
    const hasLoggedInWithCas = Boolean(item.firstLoginAt || item.lastLoginAt);
    form.elements.casLoginName.disabled = Boolean(item.casLoginName) && hasLoggedInWithCas;
    form.elements.casLoginName.required = Boolean(item.casLoginName);
    form.elements.casLoginName.removeAttribute('aria-invalid');
    form.elements.state.value = item.state || 'ACTIVE';
    form.querySelector('[data-principal-dialog-title]').textContent = '编辑人员';
    form.querySelector('[data-principal-login-help]').textContent = item.casLoginName
      ? (hasLoggedInWithCas ? '该人员已有 CAS 登录记录，不能直接更正，请走身份换绑流程。' : '尚未通过 CAS 登录，可更正错误的预绑定账号；保存前需要再次确认。')
      : '可留空，首次登录时自动绑定。';
    form.querySelector('[data-principal-login-error]').textContent = '';
    form.querySelector('button[type="submit"]').textContent = '保存修改';
    form.querySelector('[data-principal-form-status]').textContent = '';
    dialog.showModal();
    form.elements.displayName.focus();
    return;
  }
  const principalToggle = event.target.closest('[data-principal-toggle]');
  if (principalToggle) {
    const item = appState.principalProjection?.items?.find(value => String(value.principalId) === principalToggle.dataset.principalToggle);
    if (!item) return;
    const nextState = item.state === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    const references = Number(item.manualReferenceCount || 0);
    const message = nextState === 'INACTIVE'
      ? `确认停用${item.displayName}？${references ? `\n该人员当前被 ${references} 条手册责任关系引用，历史关系将保留。` : ''}`
      : `确认重新启用${item.displayName}？`;
    if (!window.confirm(message)) return;
    principalToggle.disabled = true;
    try {
      await updatePrincipal(item.principalId, { displayName: item.displayName, casLoginName: item.casLoginName, state: nextState, rowVersion: item.rowVersion });
      await loadGitLabAdmin();
    } catch (error) { window.alert(error.message || '人员状态更新失败。'); principalToggle.disabled = false; }
    return;
  }
  if (event.target.closest('[data-principal-open-import]')) {
    const dialog = document.querySelector('[data-principal-import-dialog]');
    const form = dialog?.querySelector('[data-principal-import-form]');
    form?.reset(); pendingPrincipalImportFile = null;
    const preview = form?.querySelector('[data-principal-import-preview]'); if (preview) { preview.hidden = true; preview.innerHTML = ''; }
    const apply = form?.querySelector('[data-principal-import-apply]'); if (apply) apply.hidden = true;
    dialog?.showModal(); form?.elements.file.focus(); return;
  }
  const principalImportApply = event.target.closest('[data-principal-import-apply]');
  if (principalImportApply) {
    const form = principalImportApply.closest('[data-principal-import-form]');
    const status = form.querySelector('[data-principal-import-status]');
    if (!pendingPrincipalImportFile) { status.textContent = '请先选择文件并完成预检。'; return; }
    principalImportApply.disabled = true; status.textContent = '正在导入…';
    try {
      const result = await importPrincipals(pendingPrincipalImportFile, 'apply');
      status.textContent = `导入完成：新增 ${result?.importSummary?.add || 0} 人，更新 ${result?.importSummary?.update || 0} 人。`;
      pendingPrincipalImportFile = null; await loadGitLabAdmin();
      setTimeout(() => form.closest('dialog')?.close(), 800);
    } catch (error) { status.textContent = error.message || '人员导入失败。'; principalImportApply.disabled = false; }
    return;
  }
  if (event.target.closest('[data-principal-dialog-close]')) { event.target.closest('dialog')?.close(); return; }
  const correctionCancel = event.target.closest('[data-principal-correction-cancel]');
  if (correctionCancel) {
    const dialog = correctionCancel.closest('[data-principal-cas-correction-dialog]');
    dialog?.close();
    const input = pendingPrincipalCorrection?.form?.elements.casLoginName;
    pendingPrincipalCorrection = null;
    requestAnimationFrame(() => input?.focus());
    return;
  }
  if (event.target.closest('[data-principal-clear-filters]')) {
    appState.principalListState = { search: '', bindingStatus: '', state: '' }; render(); return;
  }
  if (event.target.closest('[data-cleaning-upload-open]')) { document.querySelector('[data-cleaning-upload-dialog]')?.showModal(); return; }
  if (event.target.closest('[data-cleaning-upload-close]')) { event.target.closest('dialog')?.close(); return; }
  // 映射配置：选择当前要配置的内容语言
  const mappingLanguage = event.target.closest('[data-mapping-language]');
  if (mappingLanguage) {
    const form = mappingLanguage.closest('[data-repository-mapping-form]');
    appState.mappingState.activeLang = mappingLanguage.dataset.mappingLanguage === 'en' ? 'en' : 'zh';
    renderMappingLanguageSelector(form);
    renderMappingTree(form, appState.mappingState.treeItems);
    return;
  }
  const treeExpand = event.target.closest('[data-mapping-tree-expand]');
  if (treeExpand) {
    const form = treeExpand.closest('[data-repository-mapping-form]');
    const path = treeExpand.dataset.mappingTreeExpand;
    if (appState.mappingState.expandedPaths.has(path)) appState.mappingState.expandedPaths.delete(path);
    else appState.mappingState.expandedPaths.add(path);
    renderMappingTree(form, appState.mappingState.treeItems);
    return;
  }
  // 映射配置：切换路径选择
  const treeToggle = event.target.closest('[data-mapping-tree-toggle]');
  if (treeToggle) {
    const form = treeToggle.closest('[data-repository-mapping-form]');
    const path = treeToggle.dataset.mappingTreeToggle;
    const lang = appState.mappingState.activeLang || 'zh';
    toggleMappingPath(lang, path);
    expandSelectedMappingAncestors();
    renderMappingPathTags(form);
    renderMappingPreview(form);
    renderMappingTree(form, appState.mappingState.treeItems);
    return;
  }
  // 映射配置：移除已选路径标签
  const pathRemove = event.target.closest('[data-mapping-path-remove]');
  if (pathRemove) {
    const form = pathRemove.closest('[data-repository-mapping-form]');
    const lang = pathRemove.dataset.mappingPathRemove;
    const path = pathRemove.dataset.mappingPathValue;
    removeMappingPath(lang, path);
    renderMappingPathTags(form);
    renderMappingPreview(form);
    renderMappingTree(form, appState.mappingState.treeItems);
    return;
  }
  const gitlabRefreshRepo = event.target.closest('[data-gitlab-refresh-repo]');
  if (gitlabRefreshRepo) {
    gitlabRefreshRepo.disabled = true;
    const originalText = gitlabRefreshRepo.textContent;
    gitlabRefreshRepo.textContent = '刷新中…';
    try {
      await loadGitLabAdmin();
      gitlabRefreshRepo.textContent = '✓ 已刷新';
      setTimeout(() => { gitlabRefreshRepo.textContent = originalText; gitlabRefreshRepo.disabled = false; }, 1500);
    } catch (error) {
      gitlabRefreshRepo.textContent = '刷新失败';
      setTimeout(() => { gitlabRefreshRepo.textContent = originalText; gitlabRefreshRepo.disabled = false; }, 2000);
    }
    return;
  }
  /* ---- 平台管理标签页切换 ---- */
  const platformTab = event.target.closest("[data-platform-tab]");
  if (platformTab) {
    const tab = platformTab.dataset.platformTab;
    if (tab && tab !== appState.platformTab) {
      if ((!confirmLeavingMcp() || !confirmLeavingModels())) return;
      appState.platformTab = tab;
      appState.gitlabAddingConnection = false;
      window.history.pushState({ view: "platform", tab }, "", pathForView("platform", { tab }));
      render();
      if (tab === "gitlab" && !appState.gitlabProjection?.connections?.length) loadGitLabAdmin();
      if (tab === "governance" && !appState.databaseConnectionProjection) loadDatabaseConnectionAdmin();
    }
    return;
  }
  const teamView = event.target.closest('[data-team-group-view]');
  if (teamView) {
    const view = teamView.dataset.teamGroupView;
    const groupId = teamView.dataset.teamGroupId || '';
    teamView.closest('details')?.removeAttribute('open');
    if ((!confirmLeavingMcp() || !confirmLeavingModels())) return;
    appState.platformTab = 'principals';
    appState.teamGroupUi.saveStatus = null;
    const query = new URLSearchParams({ tab: 'principals', view });
    if (view === 'groups' && groupId) query.set('groupId', groupId);
    window.history.pushState({ view: 'platform', tab: 'principals', teamView: view, groupId }, '', `/knowledge-center/platform?${query}`);
    render();
    return;
  }
  const teamRetry = event.target.closest('[data-team-group-retry]');
  if (teamRetry) { await loadTeamGroupsAdmin(); return; }
  const teamCreate = event.target.closest('[data-team-group-create]');
  if (teamCreate) { document.querySelector('[data-team-group-create-dialog]')?.showModal(); return; }
  const teamCreateClose = event.target.closest('[data-team-group-create-close]');
  if (teamCreateClose) { teamCreateClose.closest('dialog')?.close(); return; }
  const teamMemberAdd = event.target.closest('[data-team-member-add]');
  if (teamMemberAdd) {
    const form = teamMemberAdd.closest('[data-team-group-form]');
    const candidate = form?.querySelector('[data-team-member-candidate]');
    const id = candidate?.value;
    const option = candidate?.selectedOptions?.[0];
    const leader = form?.querySelector('[name="leaderPrincipalId"]')?.value;
    const status = form?.querySelector('[data-team-group-status]');
    if (!id) { if (status) status.textContent = '请先选择需要添加的人员。'; return; }
    if (id === leader) { if (status) status.textContent = '负责人不需要重复添加为普通成员。'; return; }
    if (form.querySelector(`[data-team-member-chip="${CSS.escape(id)}"]`)) { if (status) status.textContent = '该人员已经在团队中。'; return; }
    form.querySelector('[data-team-member-empty]')?.remove();
    const chip = document.createElement('span');
    chip.className = 'team-member-chip';
    chip.dataset.teamMemberChip = id;
    const label = document.createElement('span'); label.textContent = option?.dataset.displayName || option?.textContent || id;
    const remove = document.createElement('button'); remove.type = 'button'; remove.dataset.teamMemberRemove = id; remove.setAttribute('aria-label', `移除成员 ${label.textContent}`); remove.textContent = '×';
    const hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.name = 'memberPrincipalIds'; hidden.value = id;
    chip.append(label, remove, hidden);
    form.querySelector('[data-team-member-chips]')?.append(chip);
    option?.remove(); candidate.value = '';
    if (status) status.textContent = '成员列表已修改。';
    return;
  }
  const teamMemberRemove = event.target.closest('[data-team-member-remove]');
  if (teamMemberRemove) {
    const form = teamMemberRemove.closest('[data-team-group-form]');
    const removedId = teamMemberRemove.dataset.teamMemberRemove;
    const removedPerson = (appState.principalProjection?.items || []).find(person => String(person.principalId) === String(removedId));
    teamMemberRemove.closest('[data-team-member-chip]')?.remove();
    const candidate = form?.querySelector('[data-team-member-candidate]');
    if (candidate && removedPerson && ![...candidate.options].some(option => option.value === String(removedId))) {
      const option = document.createElement('option'); option.value = String(removedId); option.dataset.displayName = removedPerson.displayName; option.textContent = removedPerson.displayName; candidate.append(option);
    }
    const chips = form?.querySelector('[data-team-member-chips]');
    if (chips && !chips.querySelector('[data-team-member-chip]')) chips.innerHTML = '<span class="team-member-empty" data-team-member-empty>暂无其他团队成员</span>';
    const status = form?.querySelector('[data-team-group-status]'); if (status) status.textContent = '成员列表已修改。';
    return;
  }
  const teamCancel = event.target.closest('[data-team-group-cancel]');
  if (teamCancel) {
    appState.teamGroupUi.saveStatus = { groupId: String(teamCancel.closest('[data-team-group-form]')?.dataset.teamGroupId || ''), kind: '', message: '未保存修改已取消。' };
    render();
    return;
  }
  const teamSave = event.target.closest('[data-team-group-save]');
  if (teamSave) {
    const form = teamSave.closest('[data-team-group-form]');
    const groupId = form?.dataset.teamGroupId;
    const leader = form?.querySelector('[name="leaderPrincipalId"]')?.value;
    const members = [...(form?.querySelectorAll('[name="memberPrincipalIds"]') || [])].map(input => Number(input.value));
    const status = form?.querySelector('[data-team-group-status]');
    if (!leader) { if (status) status.textContent = '必须选择一名负责人。'; form?.querySelector('[name="leaderPrincipalId"]')?.focus(); return; }
    teamSave.disabled = true;
    teamSave.textContent = '保存中…';
    try {
      const group = appState.teamGroupProjection?.items?.find(item => String(item.teamGroupId) === String(groupId));
      const result = await saveTeamRoster(groupId, { leaderPrincipalId: Number(leader), memberPrincipalIds: members, actor: authState.session?.user?.id || 'platform:admin' }, group?.rowVersion);
      const saved = result?.data || result;
      appState.teamGroupProjection = { ...(appState.teamGroupProjection || {}), items: (appState.teamGroupProjection?.items || []).map(item => String(item.teamGroupId) === String(groupId) ? saved : item) };
      appState.teamGroupUi.saveStatus = { groupId: String(groupId), kind: 'success', message: '团队名册已保存，大纲分工将读取最新团队信息。' };
      render();
    } catch (error) {
      teamSave.disabled = false;
      teamSave.textContent = '保存';
      if (status) status.textContent = error.status === 409 ? '团队名册已被其他操作更新，请重新加载后再试。' : error.message || '团队保存失败，请保留当前选择后重试。';
    }
    return;
  }
  const databaseOpen = event.target.closest('[data-database-open]');
  if (databaseOpen) {
    appState.databaseConnectionDrawerOpen = true;
    appState.databaseConnectionDrawerShouldFocus = true;
    appState.databaseConnectionDirty = false;
    appState.databaseConnectionStatus = null;
    appState.databaseConnectionForm = { ...(appState.databaseConnectionProjection?.connection || {}), password: '' };
    render();
    return;
  }
  const databaseClose = event.target.closest('[data-database-close]');
  if (databaseClose) { closeDatabaseConnectionDrawer(); return; }
  if (event.target.matches?.('[data-database-dialog]')) { closeDatabaseConnectionDrawer(); return; }
  const databaseTest = event.target.closest('[data-database-test]');
  if (databaseTest) {
    const dialog = databaseTest.closest('[data-database-dialog]');
    const payload = databaseConnectionPayload(dialog);
    appState.databaseConnectionForm = databaseConnectionDraft(payload);
    appState.databaseConnectionStatus = { kind: 'pending', message: '正在测试页面连接配置…' };
    updateDatabaseConnectionOperationUi(dialog, appState.databaseConnectionStatus, true);
    try { const result = await testDatabaseConnection(payload); const data = result?.data || result; appState.databaseConnectionStatus = { kind: 'success', message: data.message || '页面连接配置可用' }; }
    catch (error) { appState.databaseConnectionStatus = { kind: 'error', message: error.message || '数据库连接失败' }; }
    updateDatabaseConnectionOperationUi(dialog, appState.databaseConnectionStatus, false);
    return;
  }
  const databaseSave = event.target.closest('[data-database-save]');
  if (databaseSave) {
    const dialog = databaseSave.closest('[data-database-dialog]');
    const payload = databaseConnectionPayload(dialog);
    appState.databaseConnectionForm = databaseConnectionDraft(payload);
    appState.databaseConnectionStatus = { kind: 'pending', message: '正在验证并保存…' };
    updateDatabaseConnectionOperationUi(dialog, appState.databaseConnectionStatus, true);
    try {
      const result = await saveDatabaseConnection(payload, appState.databaseConnectionProjection?.rowVersion);
      appState.databaseConnectionProjection = result?.data || result;
      appState.databaseConnectionForm = { ...(appState.databaseConnectionProjection?.connection || {}), password: '' };
      appState.databaseConnectionDirty = false;
      appState.databaseConnectionStatus = { kind: 'success', message: '页面配置已保存。' };
      const passwordInput = dialog.querySelector('[data-database-field="password"]');
      if (passwordInput) passwordInput.value = '';
      render();
    }
    catch (error) {
      appState.databaseConnectionStatus = { kind: 'error', message: error.message || '数据库配置保存失败' };
      updateDatabaseConnectionOperationUi(dialog, appState.databaseConnectionStatus, false);
    }
    return;
  }
  /* ---- GitLab 连接选择 ---- */
  const gitlabView = event.target.closest('[data-gitlab-view]');
  if (gitlabView) {
    appState.gitlabListState.mappingView = gitlabView.dataset.gitlabView === 'mappings';
    appState.gitlabListState.drawerOpen = false;
    render(); return;
  }
  if (event.target.closest('[data-version-mapping-add]')) {
    appState.gitlabListState.mappingEditing = true;
    appState.gitlabListState.mappingEditId = null;
    appState.gitlabListState.mappingCandidateIndex = null;
    appState.gitlabListState.mappingFeedback = '';
    render(); return;
  }
  const mappingEdit = event.target.closest('[data-version-mapping-edit]');
  if (mappingEdit) {
    appState.gitlabListState.mappingEditing = true;
    appState.gitlabListState.mappingEditId = mappingEdit.dataset.versionMappingEdit;
    appState.gitlabListState.mappingCandidateIndex = null;
    render(); return;
  }
  if (event.target.closest('[data-version-mapping-cancel]')) {
    appState.gitlabListState.mappingEditing = false;
    appState.gitlabListState.mappingCandidateIndex = null;
    render(); return;
  }
  const mappingDeleteOpen = event.target.closest('[data-version-mapping-delete-open]');
  if (mappingDeleteOpen) {
    const item = appState.gitlabProjection.versionMappings.find(rule => String(rule.id) === mappingDeleteOpen.dataset.versionMappingDeleteOpen);
    const dialog = document.querySelector('[data-version-mapping-delete-dialog]');
    if (!item || !dialog) return;
    const connection = appState.gitlabProjection.connections.find(value => value.id === item.connectionId);
    dialog.querySelector('[data-version-mapping-delete-target]').textContent = `${item.productCode} / ${item.matchKind === 'ALL' ? '所有版本' : item.version} · ${connection?.name || item.connectionId} / ${item.branch}`;
    dialog.querySelector('[data-version-mapping-action="delete"]').dataset.versionMappingId = String(item.id);
    dialog.showModal();
    return;
  }
  if (event.target.closest('[data-version-mapping-delete-cancel]')) {
    document.querySelector('[data-version-mapping-delete-dialog]')?.close();
    return;
  }
  const mappingAction = event.target.closest('[data-version-mapping-action]');
  const mappingPage = event.target.closest('[data-version-mapping-page]');
  if (mappingPage) {
    appState.gitlabListState.mappingPage = Number(mappingPage.dataset.versionMappingPage) || 1;
    render(); return;
  }
  if (mappingAction) {
    const item = [...appState.gitlabProjection.versionMappings, ...appState.gitlabProjection.archivedVersionMappings].find(rule => String(rule.id) === mappingAction.dataset.versionMappingId);
    if (!item) return;
    if (mappingAction.dataset.versionMappingAction === 'disable' && !window.confirm('停用后，新任务将不再命中此映射。已确认任务保留原分支。确认停用？')) return;
    if (mappingAction.dataset.versionMappingAction === 'archive' && !window.confirm('归档后，此映射将在本页缩略展示。确认归档？')) return;
    mappingAction.disabled = true;
    try {
      await setGitLabVersionMappingState(item, mappingAction.dataset.versionMappingAction);
      appState.gitlabListState.mappingFeedback = { activate: '映射已验证并启用。', disable: '映射已停用。', delete: '草案已删除。', archive: '映射已归档。', restore: '映射已恢复为停用。' }[mappingAction.dataset.versionMappingAction];
      await loadGitLabAdmin(); render();
    } catch (error) {
      appState.gitlabListState.mappingFeedback = error.message;
      render();
    }
    return;
  }
  const gitlabConn = event.target.closest('[data-gitlab-connection], [data-gitlab-row]');
  if (gitlabConn) {
    appState.gitlabListState.selectedConnectionId = gitlabConn.dataset.gitlabConnection || gitlabConn.dataset.gitlabRow;
    appState.gitlabListState.drawerOpen = true;
    render();
    requestAnimationFrame(() => document.querySelector('.gitlab-drawer-close')?.focus());
    return;
  }
  if (event.target.closest('[data-gitlab-drawer-close]')) {
    const id = appState.gitlabListState.selectedConnectionId;
    appState.gitlabListState.drawerOpen = false;
    render();
    requestAnimationFrame(() => [...document.querySelectorAll('[data-gitlab-connection]')].find(button => button.dataset.gitlabConnection === id)?.focus());
    return;
  }
  /* ---- GitLab 分页 ---- */
  const gitlabPage = event.target.closest("[data-gitlab-page]");
  if (gitlabPage) {
    const dir = gitlabPage.dataset.gitlabPage;
    if (dir === "prev" && appState.gitlabListState.page > 1) appState.gitlabListState.page--;
    else if (dir === "next") appState.gitlabListState.page++;
    render();
    return;
  }
  /* ---- GitLab 添加连接 ---- */
  const gitlabAdd = event.target.closest("[data-gitlab-add-connection]");
  if (gitlabAdd) {
    appState.gitlabAddingConnection = true;
    render();
    return;
  }
  /* ---- GitLab 取消添加 ---- */
  const gitlabCancel = event.target.closest("[data-gitlab-cancel-add]");
  /* ---- GitLab 取消编辑 ---- */
  const gitlabCancelEdit = event.target.closest("[data-gitlab-cancel-edit]");
  if (gitlabCancelEdit) {
    appState.gitlabEditingConnection = null;
    render();
    return;
  }
  if (gitlabCancel) {
    appState.gitlabAddingConnection = false;
    render();
    return;
  }
  /* ---- GitLab 编辑连接 ---- */
  const gitlabEdit = event.target.closest("[data-gitlab-edit]");
  if (gitlabEdit) {
    const connId = gitlabEdit.dataset.gitlabEdit;
    const conn = appState.gitlabProjection?.connections?.find(item => item.id === connId);
    if (!conn) return;
    appState.gitlabEditingConnection = conn;
    appState.gitlabAddingConnection = false;
    render();
    return;
  }
  /* ---- GitLab 验证连接 ---- */
  const gitlabVerify = event.target.closest("[data-gitlab-verify]");
  if (gitlabVerify) {
    const connId = gitlabVerify.dataset.gitlabVerify;
    appState.gitlabVerification = { connectionId: connId, status: 'verifying' };
    render();
    try {
      appState.gitlabVerification = await verifyGitLabConnection(connId);
      await loadGitLabAdmin();
      render();
    } catch (error) {
      appState.gitlabVerification = { connectionId: connId, status: 'failed', verifiedAt: new Date().toISOString(), error: { code: error.code, message: error.message, recovery: error.recovery } };
      await loadGitLabAdmin();
    }
    return;
  }
  /* ---- GitLab 停用连接 ---- */
  const gitlabDisable = event.target.closest("[data-gitlab-disable]");
  if (gitlabDisable) {
    if (!window.confirm("确认停用此连接？停用后不影响已有关联手册。")) return;
    const connId = gitlabDisable.dataset.gitlabDisable;
    gitlabDisable.disabled = true;
    try {
      await disableGitLabConnection(connId);
      await loadGitLabAdmin();
    } catch (error) { gitlabDisable.disabled = false; }
    return;
  }
  /* ---- GitLab 重新启用连接 ---- */
  const gitlabEnable = event.target.closest("[data-gitlab-enable]");
  if (gitlabEnable) {
    const connId = gitlabEnable.dataset.gitlabEnable;
    gitlabEnable.disabled = true;
    try {
      await enableGitLabConnection(connId);
      await loadGitLabAdmin();
    } catch (error) { gitlabEnable.disabled = false; }
    return;
  }
  /* ---- 用户权限 - 选择用户 ---- */
  const permUser = event.target.closest("[data-permission-user]");
  if (permUser) {
    appState.permissionRoleDraft = null;
    appState.selectedPermissionUserId = permUser.dataset.permissionUser;
    appState.permissionSaveStatus = null;
    render();
    return;
  }
  const permPage = event.target.closest('[data-permission-page]');
  if (permPage) {
    appState.permissionListState.page = Math.max(1, Number(permPage.dataset.permissionPage) || 1);
    loadGitLabAdmin();
    return;
  }
  const outlineInfoToggle = event.target.closest('[data-outline-info-toggle]');
  if (outlineInfoToggle) {
    const drawer = byId('outline-handbook-info');
    const overlay = document.querySelector('[data-outline-info-close].outline-info-overlay');
    drawer.hidden = false;
    overlay.hidden = false;
    outlineInfoToggle.setAttribute('aria-expanded', 'true');
    drawer.querySelector('[data-outline-info-close]')?.focus();
    return;
  }
  const outlineInfoClose = event.target.closest('[data-outline-info-close]');
  if (outlineInfoClose) {
    byId('outline-handbook-info').hidden = true;
    document.querySelector('.outline-info-overlay').hidden = true;
    const toggle = document.querySelector('[data-outline-info-toggle]');
    toggle?.setAttribute('aria-expanded', 'false');
    const menu = toggle?.closest('details');
    (menu && !menu.open ? menu.querySelector('summary') : toggle)?.focus();
    return;
  }
  const outlineBack = event.target.closest('[data-outline-back]');
  if (outlineBack) {
    event.preventDefault();
    appState.outlineProjection = null;
    const restoredListState = outlineRouteState().listState;
    appState.outlineListState.search = restoredListState.search;
    appState.outlineListState.statusFilter = restoredListState.status;
    const url = new URL('/knowledge-center/outlines', window.location.origin);
    if (appState.outlineListState.search) url.searchParams.set('q', appState.outlineListState.search);
    if (appState.outlineListState.statusFilter) url.searchParams.set('status', appState.outlineListState.statusFilter);
    window.history.pushState({ view: 'outlines', ...appState.outlineListState }, document.title, `${url.pathname}${url.search}`);
    loadOutlines();
    return;
  }
  const outlineSubpage = event.target.closest('[data-outline-subpage]');
  if (outlineSubpage) {
    event.preventDefault();
    const url = new URL(outlineSubpage.href);
    const current = new URL(window.location.href);
    for (const key of ['q', 'status']) if (current.searchParams.has(key)) url.searchParams.set(key, current.searchParams.get(key));
    appState.outlineListState.scrollPosition = byId('main-shell')?.scrollTop || 0;
    window.history.replaceState({ ...window.history.state, ...appState.outlineListState }, '', current);
    window.history.pushState({ view: 'outlines' }, '', url);
    loadOutlines();
    return;
  }
  if (event.target.closest('[data-outline-recycle-retry]')) { await loadOutlines(); return; }
  const outlineTreeToggle = event.target.closest('[data-outline-tree-toggle]');
  if (outlineTreeToggle) {
    const expanded = outlineTreeToggle.dataset.outlineTreeExpanded !== 'true';
    document.querySelectorAll('.outline-navigation details').forEach(item => { item.open = expanded; });
    outlineTreeToggle.dataset.outlineTreeExpanded = String(expanded);
    outlineTreeToggle.setAttribute('aria-label', expanded ? '收起全部目录' : '展开全部目录');
    outlineTreeToggle.title = expanded ? '收起全部目录' : '展开全部目录';
    outlineTreeToggle.innerHTML = `<i data-lucide="${expanded ? 'chevrons-up' : 'chevrons-down'}" aria-hidden="true"></i>`;
    window.lucide?.createIcons();
    return;
  }
  const assignmentStatsOpen = event.target.closest('[data-outline-assignment-stats-open]');
  if (assignmentStatsOpen) {
    const dialog = assignmentStatsOpen.closest('.outline-assignment-workspace')?.querySelector('[data-outline-assignment-stats-dialog]');
    dialog?.showModal();
    dialog?.querySelector('[data-outline-assignment-stats-close]')?.focus();
    return;
  }
  const assignmentStatsClose = event.target.closest('[data-outline-assignment-stats-close]');
  if (assignmentStatsClose) {
    const workspace = assignmentStatsClose.closest('.outline-assignment-workspace');
    assignmentStatsClose.closest('dialog')?.close();
    workspace?.querySelector('[data-outline-assignment-stats-open]')?.focus();
    return;
  }
  if (event.target.matches?.('[data-outline-assignment-stats-dialog]')) {
    const dialog = event.target;
    const workspace = dialog.closest('.outline-assignment-workspace');
    dialog.close();
    workspace?.querySelector('[data-outline-assignment-stats-open]')?.focus();
    return;
  }
  const outlineContextEdit = event.target.closest('[data-outline-context-edit]');
  const outlineContextAssignment = event.target.closest('[data-outline-context-assignment]');
  if (outlineContextEdit || outlineContextAssignment) {
    const menu = event.target.closest('[data-outline-context-menu]');
    const id = menu?.dataset.documentId;
    menu.hidden = true;
    if (outlineContextAssignment) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'assignments');
      if (id) url.searchParams.set('document', id);
      window.history.replaceState({ ...window.history.state, tab: 'assignments', document: id }, document.title, `${url.pathname}${url.search}`);
      render();
    } else {
      document.querySelector(`[data-outline-description-edit="${CSS.escape(id || '')}"]`)?.click();
    }
    return;
  }
  const outlineMoveOpen = event.target.closest('[data-outline-move-open]');
  if (outlineMoveOpen) {
    const menu = outlineMoveOpen.closest('[data-outline-context-menu]');
    const dialog = document.querySelector('[data-outline-move-dialog]');
    const documentId = menu?.dataset.documentId;
    if (!dialog || !documentId) return;
    menu.hidden = true;
    dialog.dataset.documentId = documentId;
    const node = currentOutlineNodes().find(item => item.id === documentId);
    dialog.querySelectorAll('[name="outline-target-directory"]').forEach(input => {
      input.checked = false;
      input.disabled = String(input.value) === String(node?.parentId || '');
    });
    const confirm = dialog.querySelector('[data-outline-move-confirm]'); if (confirm) confirm.disabled = true;
    const status = dialog.querySelector('[data-outline-move-status]'); if (status) status.textContent = '';
    dialog.showModal();
    dialog.querySelector('[name="outline-target-directory"]:not(:disabled)')?.focus();
    return;
  }
  const outlineMoveClose = event.target.closest('[data-outline-move-close]');
  if (outlineMoveClose) { outlineMoveClose.closest('dialog')?.close(); return; }
  const outlineMoveConfirm = event.target.closest('[data-outline-move-confirm]');
  if (outlineMoveConfirm) {
    const dialog = outlineMoveConfirm.closest('[data-outline-move-dialog]');
    const status = dialog?.querySelector('[data-outline-move-status]');
    const documentId = dialog?.dataset.documentId;
    const targetId = dialog?.querySelector('[name="outline-target-directory"]:checked')?.value;
    if (!documentId || !targetId) { if (status) status.textContent = '请选择目标目录。'; return; }
    const outline = appState.outlineProjection?.detail;
    const nodes = currentOutlineNodes();
    const selected = nodes.find(item => item.id === documentId);
    const target = nodes.find(item => item.id === targetId);
    if (!outline || !selected || !target || target.kind === 'document' || target.type === 'document') { if (status) status.textContent = '目标目录无效，请重新选择。'; return; }
    const directoryOrder = nodes.map((node, index) => ({ nodeId: node.id, parentNodeId: node.id === documentId ? targetId : (node.parentId || null), order: index + 1 }));
    outlineMoveConfirm.disabled = true; if (status) status.textContent = '正在移动…';
    try {
      const governance = outline.governance || outline.responsibility || {};
      await saveOutlineGovernance(outline.id || appState.outlineProjection?.selectedId, { editVersion: outline.editVersion, governanceVersion: governance.governanceVersion, assignments: governance.assignments || [], directoryOrder });
      dialog.close(); appState.outlineProjection = null; await loadOutlines();
      showAppNotice('文档已移动到所选目录。', { title: '目录已更新', tone: 'success' });
    } catch (error) {
      if (status) status.textContent = error.message || '移动失败，请重试。'; outlineMoveConfirm.disabled = false;
    }
    return;
  }
  const assignmentStatus = event.target.closest('[data-outline-assignment-status]');
  if (assignmentStatus) {
    const workspace = assignmentStatus.closest('.outline-assignment-workspace');
    workspace.dataset.assignmentStatus = assignmentStatus.dataset.outlineAssignmentStatus;
    workspace.querySelectorAll('[data-outline-assignment-status]').forEach(control => control.classList.toggle('active', control === assignmentStatus));
    updateOutlineAssignmentWorkspace();
    return;
  }
  const assignmentDirectory = event.target.closest('[data-outline-assignment-directory]');
  if (assignmentDirectory) {
    const workspace = assignmentDirectory.closest('.outline-assignment-workspace');
    workspace.dataset.assignmentDirectory = assignmentDirectory.dataset.outlineAssignmentDirectory || '';
    workspace.querySelectorAll('[data-outline-assignment-directory]').forEach(control => control.classList.toggle('is-active', control === assignmentDirectory));
    updateOutlineAssignmentWorkspace();
    return;
  }
  const batchAssignment = event.target.closest('[data-outline-batch-assign]');
  if (batchAssignment) {
    const workspace = batchAssignment.closest('.outline-assignment-workspace');
    const assignee = workspace?.querySelector('[data-outline-batch-assignee]');
    const selected = [...(workspace?.querySelectorAll('[data-outline-task-select]:checked') || [])];
    const status = workspace?.querySelector('.domain-task-status');
    if (!assignee?.value || !selected.length) return;
    batchAssignment.disabled = true;
    if (status) status.textContent = `正在分派 ${selected.length} 篇文档…`;
    const results = await Promise.allSettled(selected.map(input => {
      const select = input.closest('[data-outline-assignment-row]')?.querySelector('[data-domain-task-assignee]');
      return updateDomainBuildTaskItem(select?.dataset.taskId, select?.dataset.itemId, { assigneeId: assignee.value, assigneeName: assignee.selectedOptions[0]?.dataset.assigneeName || assignee.selectedOptions[0]?.textContent || null });
    }));
    const failed = results.filter(result => result.status === 'rejected');
    if (status) status.textContent = failed.length ? `已完成 ${results.length - failed.length} 篇，${failed.length} 篇分派失败，请重试。` : `已完成 ${results.length} 篇文档分派。`;
    if (appState.activeView === 'outlines') await loadOutlines();
    else await loadDomainBuildTasksWorkspace();
    return;
  }
  const outlineNode = event.target.closest('[data-outline-node]');
  if (outlineNode) {
    const selectedId = outlineNode.dataset.outlineNode;
    const url = new URL(window.location.href);
    url.searchParams.set('node', selectedId);
    if (outlineNode.dataset.outlineNodeKind === 'document') url.searchParams.set('document', selectedId);
    else url.searchParams.delete('document');
    window.history.replaceState({ ...window.history.state, node: selectedId }, document.title, `${url.pathname}${url.search}`);
    render();
    return;
  }
  const outlineTemplateHelp = event.target.closest('[data-outline-template-help]');
  if (outlineTemplateHelp) {
    const panel = document.querySelector('[data-outline-template-help-panel]');
    if (panel) { panel.hidden = false; outlineTemplateHelp.setAttribute('aria-expanded', 'true'); panel.querySelector('[data-outline-template-help-close]')?.focus(); }
    return;
  }
  const outlineTemplateHelpClose = event.target.closest('[data-outline-template-help-close]');
  if (outlineTemplateHelpClose) {
    const panel = outlineTemplateHelpClose.closest('[data-outline-template-help-panel]');
    if (panel) panel.hidden = true;
    const trigger = document.querySelector('[data-outline-template-help]');
    trigger?.setAttribute('aria-expanded', 'false');
    const menu = trigger?.closest('details');
    (menu && !menu.open ? menu.querySelector('summary') : trigger)?.focus();
    return;
  }
  const outlineGovernanceSave = event.target.closest('[data-outline-governance-save]');
  if (outlineGovernanceSave) {
    const outline = appState.outlineProjection?.detail;
    const outlineId = outline?.id || appState.outlineProjection?.selectedId;
    if (!outlineId) return;
    const status = document.querySelector('.outline-governance-status');
    const descriptions = [...document.querySelectorAll('[data-outline-description]')].map(input => ({ nodeId: input.dataset.outlineDescription, description: input.value }));
    const existingAssignments = outline.governance?.assignments || outline.responsibility?.assignments || [];
    const documentAssignments = [...document.querySelectorAll('[data-outline-domain-group]')].map(group => ({
      nodeId: String(group.dataset.outlineDomainGroup || ''),
      techDomainIds: [group.querySelector('[data-outline-primary-domain]')?.value, ...[...group.querySelectorAll('[data-outline-collaborator-domain]:checked')].map(input => input.value)].filter(Boolean).map(String),
    })).filter(item => item.nodeId);
    const documentNodeIds = new Set(documentAssignments.map(item => item.nodeId));
    const assignments = [...existingAssignments.filter(item => !documentNodeIds.has(String(item.nodeId))), ...documentAssignments];
    outlineGovernanceSave.disabled = true;
    if (status) status.textContent = '正在保存…';
    try {
      await saveOutlineGovernance(outlineId, { editVersion: outline.editVersion, governanceVersion: outline.governance?.governanceVersion || outline.responsibility?.governanceVersion, descriptions, assignments });
      if (status) status.textContent = '目录说明和责任分工已保存。';
      appState.outlineProjection = null;
      await loadOutlines();
    } catch (error) {
      if (status) status.textContent = error.message || '保存失败，请稍后重试。';
      outlineGovernanceSave.disabled = false;
    }
    return;
  }
  const outlinePublish = event.target.closest('[data-outline-publish]');
  if (outlinePublish) {
    const outline = appState.outlineProjection?.detail;
    const outlineId = outline?.id || appState.outlineProjection?.selectedId;
    if (!outlineId || outlinePublish.disabled) return;
    const status = document.querySelector('.outline-governance-status');
    outlinePublish.disabled = true;
    if (status) status.textContent = '正在发布并生成建设任务…';
    try {
      await publishOutlineGovernance(outlineId, { editVersion: outline?.editVersion });
      if (status) status.textContent = '大纲已发布，领域建设任务已生成。';
      showAppNotice('大纲已发布，领域建设任务已生成。', { title: '发布完成', tone: 'success' });
      appState.outlineProjection = null;
      await loadOutlines();
    } catch (error) {
      if (status) status.textContent = error.message || '发布失败，请先完成责任分工。';
      outlinePublish.disabled = false;
    }
    return;
  }
  const descriptionEdit = event.target.closest('[data-outline-description-edit]');
  if (descriptionEdit) {
    const id = descriptionEdit.dataset.outlineDescriptionEdit;
    const node = currentOutlineNodes().find(item => String(item.id) === String(id));
    const dialog = document.querySelector('[data-outline-description-dialog]');
    if (!node || !dialog) return;
    dialog.dataset.nodeId = String(id);
    const title = dialog.querySelector('[data-outline-description-title]');
    const input = dialog.querySelector('[data-outline-description-draft]');
    const status = dialog.querySelector('[data-outline-description-status]');
    if (title) title.textContent = node.title || node.name || '内容说明';
    if (input) input.value = node.description || node.desc || node.body || '';
    if (status) status.textContent = '';
    dialog.showModal();
    input?.focus();
    return;
  }
  const descriptionClose = event.target.closest('[data-outline-description-close]');
  if (descriptionClose) { descriptionClose.closest('dialog')?.close(); return; }
  const descriptionSave = event.target.closest('[data-outline-description-save]');
  if (descriptionSave) {
    const dialog = descriptionSave.closest('[data-outline-description-dialog]');
    const outline = appState.outlineProjection?.detail;
    const nodeId = dialog?.dataset.nodeId;
    const status = dialog?.querySelector('[data-outline-description-status]');
    const input = dialog?.querySelector('[data-outline-description-draft]');
    if (!dialog || !outline || !nodeId || !input || descriptionSave.disabled) return;
    descriptionSave.disabled = true;
    if (status) status.textContent = '正在保存…';
    try {
      const governance = outline.governance || outline.responsibility || {};
      await saveOutlineGovernance(outline.id || appState.outlineProjection?.selectedId, {
        editVersion: outline.editVersion,
        governanceVersion: governance.governanceVersion,
        descriptions: [{ nodeId, description: input.value }],
        assignments: governance.assignments || [],
      });
      dialog.close();
      appState.outlineProjection = null;
      await loadOutlines();
      showAppNotice('内容说明已更新。', { title: '保存完成', tone: 'success' });
    } catch (error) {
      if (status) status.textContent = error.message || '保存失败，请重试。';
      descriptionSave.disabled = false;
    }
    return;
  }
  const outlineDocument = event.target.closest('[data-outline-document]');
  if (outlineDocument) {
    const selectedId = outlineDocument.dataset.outlineDocument;
    document.querySelectorAll('[data-outline-document]').forEach(button => {
      const selected = button === outlineDocument;
      button.classList.toggle('is-selected', selected);
      if (selected) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-outline-document-panel]').forEach(panel => { panel.hidden = panel.dataset.outlineDocumentPanel !== selectedId; });
    let group = outlineDocument.closest('details');
    while (group) { group.open = true; group = group.parentElement?.closest('details'); }
    const url = new URL(window.location.href);
    url.searchParams.set('document', selectedId);
    window.history.replaceState({ ...window.history.state, document: selectedId }, document.title, `${url.pathname}${url.search}`);
    return;
  }
  const restoreButton = event.target.closest('[data-outline-restore]');
  if (restoreButton) {
    restoreButton.disabled = true;
    try { await outlineLifecycle(restoreButton.dataset.outlineRestore, 'restore'); await loadOutlines(); showAppNotice('大纲已恢复', { title: '操作已完成', tone: 'success' }); }
    catch (error) { restoreButton.disabled = false; showAppNotice(error.message, { title: '恢复失败', tone: 'danger' }); }
    return;
  }
  const purgeButton = event.target.closest('[data-outline-purge]');
  if (purgeButton) {
    purgeButton.disabled = true;
    try {
      const id = purgeButton.dataset.outlinePurge;
      const impact = await outlineLifecycle(id, 'purge-preflight');
      const dialog = document.querySelector('[data-outline-purge-dialog]');
      dialog.dataset.outlineId = id;
      dialog.querySelector('form').reset();
      dialog.querySelector('[data-outline-purge-impact]').textContent = `目标 ID：${id}；引用阻断：${impact.references} 项。`;
      dialog.querySelector('[data-outline-purge-error]').textContent = impact.canPurge ? '' : impact.references > 0 ? `检测到 ${impact.references} 项历史或下游引用。为保护关联记录，当前大纲不能彻底删除；请保留在回收站。` : '当前大纲不满足彻底删除条件，请刷新回收站后重试。';
      dialog.querySelector('[data-outline-purge-confirm]').disabled = !impact.canPurge;
      dialog.showModal();
    } catch (error) { showAppNotice(error.message, { title: '删除检查失败', tone: 'danger' }); }
    finally { purgeButton.disabled = false; }
    return;
  }
  if (event.target.closest('[data-outline-purge-cancel]')) { document.querySelector('[data-outline-purge-dialog]')?.close(); return; }
  const purgeFillId = event.target.closest('[data-outline-purge-fill-id]');
  if (purgeFillId) {
    const dialog = purgeFillId.closest('dialog');
    const input = dialog?.querySelector('[name="confirmId"]');
    if (!input || !dialog.dataset.outlineId) return;
    input.value = dialog.dataset.outlineId;
    input.focus();
    return;
  }
  const purgeConfirm = event.target.closest('[data-outline-purge-confirm]');
  if (purgeConfirm) {
    const dialog = purgeConfirm.closest('dialog');
    const form = dialog.querySelector('form');
    if (!form.reportValidity()) return;
    const payload = Object.fromEntries(new FormData(form));
    if (payload.confirmId !== dialog.dataset.outlineId || !payload.reason.trim()) { dialog.querySelector('[data-outline-purge-error]').textContent = '请准确输入目标 ID 并填写删除原因。'; return; }
    purgeConfirm.disabled = true;
    try { await outlineLifecycle(dialog.dataset.outlineId, 'purge', payload); dialog.close(); await loadOutlines(); showAppNotice('大纲已彻底删除', { title: '操作已完成', tone: 'success' }); }
    catch (error) { dialog.querySelector('[data-outline-purge-error]').textContent = error.message; purgeConfirm.disabled = false; }
    return;
  }
  const outlineDelete = event.target.closest('[data-outline-delete]');
  if (outlineDelete) {
    const id = outlineDelete.dataset.outlineDelete;
    const name = outlineDelete.dataset.outlineDeleteName || '该大纲';
    if (!id || !window.confirm(`确认将“${name}”移入回收站吗？当前大纲将停止使用，发布历史保留，可在回收站恢复。`)) return;
    outlineDelete.disabled = true;
    const originalText = outlineDelete.textContent;
    outlineDelete.textContent = '删除中…';
    try {
      await deleteOutline(id);
      showAppNotice('大纲已移入回收站', { title: '操作已完成', tone: 'success' });
      appState.outlineProjection = null;
      if (outlineRouteState().isDetail) window.history.replaceState({ view: 'outlines' }, document.title, '/knowledge-center/outlines');
      await loadOutlines();
    } catch (error) {
      showAppNotice(error.message || '删除失败，请稍后重试', {
        title: '删除失败',
        tone: 'danger',
      });
      outlineDelete.disabled = false;
      outlineDelete.textContent = originalText;
      window.lucide?.createIcons();
    }
    return;
  }
  if (event.target.closest('[data-asset-create-open]')) { document.querySelector('[data-asset-create-dialog]')?.showModal(); return; }
  if (event.target.closest('[data-asset-edit-open]')) {
    const dialog = document.querySelector('[data-asset-edit-dialog]');
    const form = dialog?.querySelector('[data-asset-edit-form]');
    if (form) {
      form.dataset.initialSnapshot = assetEditSnapshot(form);
      form.querySelector('[data-asset-form-status]').textContent = '';
    }
    dialog?.showModal();
    return;
  }
  const mappingOpen = event.target.closest('[data-repository-mapping-open]');
  if (mappingOpen) {
    const dialog = document.querySelector('[data-repository-mapping-dialog]');
    const form = dialog?.querySelector('[data-repository-mapping-form]');
    dialog?.showModal();
    appState.mappingState = { connectionId: null, treeItems: [], expandedPaths: new Set(), search: '', searchOriginalExpandedPaths: null, branches: [], enabledBranches: [], zhPaths: [], enPaths: [], activeLang: 'zh' };
    if (form) {
      try {
        const mapping = await loadHandbookRepositoryMapping(mappingOpen.dataset.repositoryMappingOpen);
        form.elements.connectionId.value = mapping.connectionId || '';
        syncSearchableSelect(form.elements.connectionId);
        form.elements.defaultBranch.value = mapping.defaultBranch || 'master';
        appState.mappingState.zhPaths = mapping.zhPaths || [];
        appState.mappingState.enPaths = mapping.enPaths || [];
        appState.mappingState.enabledBranches = mapping.enabledBranches || [mapping.defaultBranch].filter(Boolean);
        appState.mappingState.connectionId = mapping.connectionId || null;
        expandSelectedMappingAncestors();
        renderMappingPathTags(form);
        renderMappingPreview(form);
        if (mapping.connectionId) {
          await loadMappingBranches(form, mapping.connectionId, mapping.defaultBranch);
          await loadMappingTree(form, mapping.connectionId);
        }
      } catch (error) {
        if (error.status !== 404) form.querySelector('[data-asset-form-status]').textContent = error.message;
      }
    }
    return;
  }
  const archiveOpen = event.target.closest('[data-asset-archive-open]');
  if (archiveOpen) {
    const manageDialog = archiveOpen.closest('[data-asset-edit-dialog]');
    const form = archiveOpen.closest('[data-asset-edit-form]');
    const status = form?.querySelector('[data-asset-form-status]');
    if (form && assetEditSnapshot(form) !== form.dataset.initialSnapshot) {
      status.textContent = '请先保存或取消当前修改，再停用手册。';
      status.focus();
      return;
    }
    const archiveDialog = document.querySelector('[data-asset-archive-dialog]');
    if (!archiveDialog) return;
    assetArchiveManageDialog = manageDialog;
    assetArchiveTrigger = archiveOpen;
    status.textContent = '';
    manageDialog?.close();
    archiveDialog.showModal();
    return;
  }
  const archiveCancel = event.target.closest('[data-asset-archive-cancel]');
  if (archiveCancel) {
    cancelAssetArchiveDialog(archiveCancel.closest('[data-asset-archive-dialog]'));
    return;
  }
  const dialogClose = event.target.closest('[data-asset-dialog-close]');
  if (dialogClose) { dialogClose.closest('dialog')?.close(); flushDeferredAssetRender(); return; }
  const assetStage = event.target.closest('[data-asset-stage]');
  if (assetStage) {
    event.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.set('status', assetStage.dataset.assetStage);
    const activeStatus = document.querySelector('[data-asset-filter] input[name="status"]');
    if (activeStatus) activeStatus.value = assetStage.dataset.assetStage;
    url.searchParams.set('page', '1');
    url.searchParams.delete('handbookId');
    window.history.pushState({ view: 'assets' }, document.title, url);
    loadAssetCatalog();
    return;
  }
  const assetLifecycle = event.target.closest('[data-asset-lifecycle]');
  if (assetLifecycle) {
    event.preventDefault();
    const url = new URL('/knowledge-center/assets', window.location.origin);
    if (assetLifecycle.dataset.assetLifecycle === 'inactive') url.searchParams.set('lifecycle', 'inactive');
    window.history.pushState({ view: 'assets' }, document.title, url);
    loadAssetCatalog();
    return;
  }
  const assetDetailBack = event.target.closest('[data-asset-detail-back], [data-asset-detail-close]');
  if (assetDetailBack) {
    event.preventDefault();
    const selectedLink = document.querySelector('.asset-table tr.selected [data-asset-id]');
    const url = new URL(window.location.href);
    url.searchParams.delete('handbookId');
    window.history.pushState({ view: 'assets' }, document.title, url);
    if (!updateAssetSelection(null)) render();
    requestAnimationFrame(() => selectedLink?.focus());
    return;
  }
  const statusResolution = event.target.closest('[data-asset-status-resolve]');
  if (statusResolution) {
    const form = statusResolution.closest('[data-asset-edit-form]');
    const reason = statusResolution.dataset.assetStatusResolve === 'keep_manual' ? form.elements.statusReason.value.trim() : '';
    if (statusResolution.dataset.assetStatusResolve === 'keep_manual' && !reason) { form.querySelector('[data-asset-form-status]').textContent = '保留人工状态时请填写变更原因'; return; }
    try {
      await resolveAssetStatus(form.dataset.assetEdit, { action: statusResolution.dataset.assetStatusResolve, reason, expectedVersion: Number(form.dataset.assetVersion) });
      form.closest('dialog')?.close();
      await loadAssetCatalog();
    } catch (error) { form.querySelector('[data-asset-form-status]').textContent = error.message; }
    return;
  }
  const restore = event.target.closest('[data-asset-restore]');
  if (restore) { restoreAsset(restore.dataset.assetRestore).then(loadAssetCatalog).catch(error => showAppNotice(error.message)); return; }
  const page = event.target.closest('[data-asset-page]');
  if (page) { const url=new URL(window.location.href); url.searchParams.set('page',page.dataset.assetPage); window.history.pushState({view:'assets'},'',url); loadAssetCatalog(); return; }
  const assetLink = event.target.closest('[data-asset-id]');
  if (assetLink && appState.activeView === 'assets') {
    event.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.set('handbookId', assetLink.dataset.assetId);
    window.history.pushState({ view: 'assets', handbookId: assetLink.dataset.assetId }, document.title, url);
    if (!updateAssetSelection(assetLink.dataset.assetId)) render();
    return;
  }
  const handbookReturn = event.target.closest('[data-handbook-return]');
  if (handbookReturn) {
    event.preventDefault();
    returnFromHandbook(handbookReturn.href);
    return;
  }
  const handbookEntryLink = event.target.closest('a[href^="/knowledge-center/production/handbook/"]');
  if (handbookEntryLink && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
    if (!canAccessView('production')) return;
    event.preventDefault();
    rememberHandbookEntry(handbookEntryLink.href);
    history.pushState({ view: 'production', handbookFrom: true }, '', handbookEntryLink.pathname + handbookEntryLink.search);
    appState.activeView = 'production';
    collapseSidebarForProduction();
    ensureRouteStyles('production');
    render();
    loadIncrementalWorkspace();
    return;
  }
  const outlineLink = event.target.closest('[data-outline-id]');
  if (outlineLink) {
    event.preventDefault();
    const id = outlineLink.dataset.outlineId;
    appState.outlineListState.scrollPosition = byId('main-shell').scrollTop;
    const detailUrl = new URL(`/knowledge-center/outlines/${encodeURIComponent(id)}`, window.location.origin);
    if (appState.outlineListState.search) detailUrl.searchParams.set('q', appState.outlineListState.search);
    if (appState.outlineListState.statusFilter) detailUrl.searchParams.set('status', appState.outlineListState.statusFilter);
    window.history.pushState({ view: 'outlines', handbookId: id, ...appState.outlineListState }, document.title, `${detailUrl.pathname}${detailUrl.search}`);
    appState.outlineProjection = null;
    loadOutlines();
    return;
  }
  const navigation = event.target.closest('[data-view]');
  if (navigation) return navigate(navigation.dataset.view);
  const domainTaskOpen = event.target.closest('[data-domain-task-open]');
  if (domainTaskOpen) {
    openDomainTaskId = domainTaskOpen.dataset.domainTaskOpen;
    render();
    return;
  }
  if (event.target.closest('[data-domain-task-close]')) {
    openDomainTaskId = null;
    event.target.closest('dialog')?.close();
    return;
  }
  if (event.target.closest('[data-incremental-create-open]')) { document.querySelector('[data-incremental-create-dialog]')?.showModal(); return; }
  if (event.target.closest('[data-incremental-dialog-close]')) { event.target.closest('dialog')?.close(); return; }
  const baselineLoader = event.target.closest('[data-incremental-load-baselines]');
  if (baselineLoader) {
    const form = baselineLoader.closest('form');
    const handbookId = form.elements.handbookId.value;
    const businessVersion = form.elements.businessVersion.value.trim();
    const status = form.querySelector('.incremental-baseline-status');
    if (!handbookId || !businessVersion) { status.textContent = '请先选择手册并填写业务版本。'; return; }
    baselineLoader.disabled = true; status.textContent = '正在读取已发布基线…';
    try {
      const result = await loadIncrementalBaselines(handbookId, businessVersion);
      const baselines = Array.isArray(result) ? result : (result?.items || []);
      const select = form.elements.baselineVersionId;
      select.replaceChildren(new Option(baselines.length ? '请选择已发布基线' : '当前版本暂无已发布基线', ''));
      baselines.forEach(item => select.add(new Option(item.displayName || item.versionName || item.id, item.id)));
      select.disabled = !baselines.length;
      status.textContent = baselines.length ? `已读取 ${baselines.length} 个可用基线。` : '无真实已发布基线，不能创建增量任务。';
    } catch (error) { status.textContent = error.message || '基线读取失败。'; }
    finally { baselineLoader.disabled = false; }
    return;
  }
  if (event.target.closest('[data-incremental-reload]')) { loadIncrementalWorkspace(); return; }
  const productionOverviewTab = event.target.closest('[data-production-overview-tab]');
  if (productionOverviewTab) {
    const view = productionOverviewTab.dataset.productionOverviewTab;
    const url = new URL(window.location.href);
    view === 'handbooks' ? url.searchParams.delete('view') : url.searchParams.set('view', view);
    if (view !== 'tasks') {
      url.searchParams.delete('taskId');
      url.searchParams.delete('stage');
    }
    window.history.replaceState({ ...window.history.state, view: 'production', productionView: view }, document.title, `${url.pathname}${url.search}`);
    if (view === 'generations' && !appState.incrementalProjection?.generations) {
      loadIncrementalWorkspace();
      return;
    }
    render();
    return;
  }
  const productionHandbookRow = event.target.closest('[data-production-handbook-row]');
  if (productionHandbookRow && !event.target.closest('button, a, input, select, textarea, details, summary')) {
    rememberHandbookEntry(productionHandbookRow.dataset.handbookHref);
    window.history.pushState({ view: 'production', handbookFrom: true }, document.title, productionHandbookRow.dataset.handbookHref);
    loadIncrementalWorkspace();
    return;
  }
  if (event.target.closest('[data-review-reload]')) { loadReviewWorkspace(); return; }
  if (event.target.closest('[data-review-dialog-close]')) { event.target.closest('dialog')?.close(); return; }
  const reassign = event.target.closest('[data-review-reassign]');
  if (reassign) {
    const dialog = document.querySelector('[data-review-assignment-dialog]');
    const form = dialog.querySelector('form');
    Object.assign(form.dataset, { taskId: reassign.dataset.taskId, reviewId: reassign.dataset.reviewId, documentId: reassign.dataset.documentId, digest: reassign.dataset.digest });
    dialog.querySelector('[data-review-assignment-title]').textContent = reassign.dataset.title;
    const error = dialog.querySelector('[data-review-assignment-error]'); error.hidden = true;
    const select = form.elements.reviewerIds; select.replaceChildren(new Option('正在读取审核人…', '')); select.disabled = true;
    form.querySelector('button[type="submit"]').disabled = true;
    const assigned = reassign.dataset.reviewers.split(',').filter(Boolean);
    dialog.querySelector('[data-review-assignment-hint]').hidden = assigned.length <= 1;
    dialog.showModal();
    try {
      const result = await loadHandbookReviewers(reassign.dataset.handbookId);
      if (!dialog.open || form.dataset.taskId !== reassign.dataset.taskId) return;
      if (!(result.items || []).length) throw new Error('当前手册没有可用审核人');
      select.replaceChildren(new Option('请选择审核人', ''), ...(result.items || []).map(user => new Option(user.displayName, user.id)));
      select.value = assigned.length === 1 && [...select.options].some(option => option.value === assigned[0]) ? assigned[0] : '';
      select.disabled = false;
      syncSearchableSelect(select);
      form.querySelector('button[type="submit"]').disabled = false;
    } catch (e) { error.textContent = e.message; error.hidden = false; select.replaceChildren(); select.disabled = true; }
    return;
  }
  const cancel = event.target.closest('[data-review-cancel]');
  if (cancel) {
    const dialog = document.querySelector('[data-review-cancel-dialog]'); const form = dialog.querySelector('form');
    Object.assign(form.dataset, { taskId: cancel.dataset.taskId, reviewId: cancel.dataset.reviewId, digest: cancel.dataset.digest });
    form.elements.reason.value = ''; dialog.querySelector('[data-review-cancel-error]').hidden = true;
    dialog.querySelector('[data-review-cancel-title]').textContent = `此操作将终止整个审核任务（包括同一候选的其他文档）：${cancel.dataset.title}。任务历史会保留。`;
    dialog.showModal(); return;
  }
  if (event.target.closest('[data-review-online-start]')) {
    const dialog = document.querySelector('[data-review-online-dialog]');
    if (dialog?.showModal) {
      dialog.showModal();
      const form = dialog.querySelector('[data-review-online-form]');
      const draftsPanel = dialog.querySelector('[data-review-online-drafts]');
      const reviewerSelect = dialog.querySelector('[data-review-online-reviewer]');
      const errorPanel = dialog.querySelector('[data-review-online-error]');
      if (errorPanel) errorPanel.hidden = true;
      try {
        const [draftResult, reviewerResult] = await Promise.all([
          loadHandbookReviewDrafts(form.dataset.handbookId), loadHandbookReviewers(form.dataset.handbookId),
        ]);
        const branch = form.dataset.branch;
        const drafts = (draftResult.items || []).filter(item => !branch || item.branch === branch);
        draftsPanel.innerHTML = drafts.length ? drafts.map(item => {
          const selected = new URLSearchParams(window.location.search).get('documentId') === item.documentId;
          return `<div class="review-online-draft"><label><input type="checkbox" data-review-online-draft data-document-id="${escapeHtml(item.documentId)}" data-outline-version-id="${escapeHtml(item.outlineVersionId)}" data-branch="${escapeHtml(item.branch)}" data-revision-id="${escapeHtml(item.draftRevisionId)}" ${selected ? 'checked' : ''}><span>${escapeHtml(item.documentId)} · 已保存 v${escapeHtml(item.editVersion)} · ${escapeHtml(item.branch)}</span></label><label>仓库文件路径<input data-review-online-path="${escapeHtml(item.documentId)}" placeholder="完整仓库路径，例如 docs/00SQL参考手册.md" value="${selected ? escapeHtml(form.dataset.documentPath) : ''}"></label></div>`;
        }).join('') : '<p>当前分支没有已保存修改稿。请前往文档生产编辑并保存。</p>';
        reviewerSelect.innerHTML = '<option value="">请选择审核人</option>' + (reviewerResult.items || []).map(item => `<option value="${escapeHtml(item.id)}" ${item.disabled ? 'disabled' : ''}>${escapeHtml(item.displayName)}</option>`).join('');
        syncSearchableSelect(reviewerSelect);
      } catch (error) {
        draftsPanel.textContent = `修改稿读取失败：${error.message}`;
        reviewerSelect.innerHTML = '<option value="">审核人不可用</option>';
        syncSearchableSelect(reviewerSelect);
      }
    }
    return;
  }
  if (event.target.closest('[data-review-online-close], [data-review-online-cancel]')) {
    document.querySelector('[data-review-online-dialog]')?.close();
    return;
  }
  const dbCopy = event.target.closest('[data-db-copy-code]');
  if (dbCopy) {
    const block = dbCopy.closest('.db-code-block');
    const code = block?.querySelector('code')?.textContent || '';
    try { await navigator.clipboard.writeText(code); dbCopy.textContent = '已复制'; setTimeout(() => { dbCopy.textContent = '复制'; }, 1200); } catch (_) { showAppNotice('复制失败，请手动选择代码。'); }
    return;
  }
  const reviewTask = event.target.closest('[data-review-task]');
  const drawerSummary = event.target.closest('.review-comment-drawer summary, .review-evidence-drawer > summary');
  if (event.target.closest('[data-review-panel-close]')) {
    appState.reviewUi.sidebarPanel = '';
    document.querySelectorAll('[data-review-comment-drawer], .review-evidence-drawer').forEach(detail => { detail.open = false; });
    return;
  }
  if (drawerSummary && !drawerSummary.closest('.review-waiting-workspace')) {
    event.preventDefault();
    const panel = drawerSummary.closest('[data-review-comment-drawer]') ? 'comments' : 'evidence';
    appState.reviewUi.sidebarPanel = appState.reviewUi.sidebarPanel === panel ? '' : panel;
    document.querySelectorAll('[data-review-comment-drawer], .review-evidence-drawer').forEach(detail => { detail.open = appState.reviewUi.sidebarPanel === (detail.hasAttribute('data-review-comment-drawer') ? 'comments' : 'evidence'); });
    return;
  }
  if (reviewTask) { const url = new URL(window.location.href); url.searchParams.set('taskId', reviewTask.dataset.reviewTask); window.history.pushState({ view: 'review', taskId: reviewTask.dataset.reviewTask }, document.title, url); loadReviewWorkspace(reviewTask.dataset.reviewTask); return; }
  const reviewStep = event.target.closest('[data-review-step]');
  if (reviewStep) { const url = new URL(window.location.href); url.searchParams.set('step', reviewStep.dataset.reviewStep); window.history.pushState({ view: 'review', step: reviewStep.dataset.reviewStep }, document.title, url); loadReviewWorkspace(new URLSearchParams(url.search).get('taskId')); return; }
  const reviewDocument = event.target.closest('[data-review-document]');
  if (reviewDocument && appState.reviewProjection?.workbench && !reviewDocument.matches('a[href]')) {
    const url = new URL(window.location.href);
    const path = reviewDocument.dataset.reviewDocument;
    const handbookId = appState.reviewProjection.handbookId;
    const matches = appState.reviewProjection.workbench.documents.filter(row => row.handbookId === handbookId && row.path === path);
    const row = matches.find(item => item.taskId === url.searchParams.get('taskId')) || matches[0];
    url.searchParams.set('view', 'reader');
    url.searchParams.set('handbookId', handbookId);
    url.searchParams.set('path', path);
    url.searchParams.delete('step');
    if (row) { url.searchParams.set('taskId', row.taskId); url.searchParams.set('documentId', row.documentId); if (row.branch) url.searchParams.set('branch', row.branch); }
    else { url.searchParams.delete('taskId'); url.searchParams.delete('documentId'); }
    window.history.pushState({ view: 'review' }, '', url);
    await loadReviewWorkspace();
    return;
  }
  if (reviewDocument) {
    const handbookId = new URLSearchParams(window.location.search).get('handbookId') || appState.gitlabProjection?.handbookId;
    const branch = appState.gitlabProjection?.branch || '';
    if (handbookId && branch) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('path', reviewDocument.dataset.reviewDocument);
        window.history.pushState({ view: 'review', path: reviewDocument.dataset.reviewDocument }, '', url);
        const expectedPath = reviewDocument.dataset.reviewDocument;
        const loadedFile = await loadHandbookRepositoryFile(handbookId, branch, appState.gitlabProjection.language || 'zh', expectedPath);
        const actualPath = loadedFile?.path || '';
        const contextConflict = actualPath !== expectedPath ? { expectedPath, actualPath } : null;
        appState.gitlabProjection = { ...appState.gitlabProjection, status: contextConflict ? 'conflict' : 'ok', requestedPath: expectedPath, contextConflict, file: contextConflict ? null : loadedFile };
        render();
      } catch (error) { showAppNotice(`文档读取失败：${error.message}`); }
    }
    return;
  }
  const drawerComment = event.target.closest('[data-review-drawer-comment]');
  if (drawerComment) {
    await navigateReviewComment(drawerComment.dataset.reviewDrawerComment);
    return;
  }
  const focusToggle = event.target.closest('[data-review-focus-toggle]');
  if (focusToggle) { appState.reviewUi.focusMode = !appState.reviewUi.focusMode; document.body.classList.toggle('review-focus-mode', appState.reviewUi.focusMode); render(); return; }
  const densityToggle = event.target.closest('[data-review-density]');
  if (densityToggle) { appState.reviewUi.readingDensity = 'comfortable'; saveReviewUi(); render(); return; }
  if (event.target.closest('[data-review-reader-refresh]')) { loadReviewWorkspace(new URLSearchParams(window.location.search).get('taskId')); return; }
  const reviewLanguage = event.target.closest('[data-review-language]');
  if (reviewLanguage) { const url = new URL(window.location.href); url.searchParams.set('lang', reviewLanguage.dataset.reviewLanguage); url.searchParams.delete('path'); window.history.pushState({ view: 'review', lang: reviewLanguage.dataset.reviewLanguage }, '', url); loadReviewWorkspace(url.searchParams.get('taskId')); return; }
  const reviewLine = event.target.closest('.review-line-button[data-review-line]');
  if (reviewLine) { document.querySelectorAll('[data-review-line]').forEach(line => line.classList.toggle('selected', line === reviewLine)); const form = document.querySelector('[data-review-comment-form]'); if (form) { const documentId = reviewLine.dataset.documentId; const nodeId = reviewLine.dataset.nodeId; const anchor = documentId && nodeId ? { documentId, nodeId, anchorKind: reviewLine.dataset.anchorKind === 'baseline' ? 'baseline' : 'after_operation', lineRange: { startLine: Number(reviewLine.dataset.reviewLine), endLine: Number(reviewLine.dataset.reviewLine) } } : null; form.elements.anchor.value = anchor ? JSON.stringify(anchor) : ''; const label = form.querySelector('[data-review-anchor-status]'); if (label) label.textContent = anchor ? `已定位第 ${reviewLine.dataset.reviewLine} 行` : '未能定位到具体段落，将作为全文意见提交。'; } return; }
  const commentLocate = event.target.closest('[data-review-comment-locate]');
  if (commentLocate) {
    const commentId = commentLocate.dataset.reviewCommentLocate;
    if (commentId) { await navigateReviewComment(commentId); return; }
    return;
  }
  const commentResolve = event.target.closest('[data-review-comment-resolve], [data-review-comment-reopen]');
  if (commentResolve) { const reopen = commentResolve.hasAttribute('data-review-comment-reopen'); runIncrementalAction(commentResolve, commentResolve.dataset.taskId, () => (reopen ? reopenIncrementalReviewComment : resolveIncrementalReviewComment)(commentResolve.dataset.taskId, commentResolve.dataset.reviewId, commentResolve.dataset.reviewCommentResolve || commentResolve.dataset.reviewCommentReopen), reopen ? '意见已重新打开' : '意见已标记为已处理'); return; }
  const replyToggle = event.target.closest('[data-review-reply-toggle], [data-review-reply-cancel]');
  if (replyToggle) {
    const opinion = replyToggle.closest('[data-review-opinion]');
    const form = opinion?.querySelector('[data-review-reply-form]');
    const opening = replyToggle.hasAttribute('data-review-reply-toggle') && form?.hidden;
    if (form) form.hidden = !opening;
    opinion?.querySelector('[data-review-reply-toggle]')?.setAttribute('aria-expanded', String(Boolean(opening)));
    if (opening) form?.querySelector('textarea')?.focus();
    return;
  }
  const reviewRevision = event.target.closest('[data-review-revision]');
  if (reviewRevision) { runIncrementalAction(reviewRevision, reviewRevision.dataset.reviewRevision, async () => { const created = await createIncrementalRevision(reviewRevision.dataset.reviewRevision); const url = new URL(window.location.href); url.searchParams.set('taskId', created.id); url.searchParams.set('step', 'read'); window.history.replaceState({ view: 'review', taskId: created.id }, document.title, url); return created; }, '修订任务已创建'); return; }
  if (event.target.closest('[data-repository-refresh]')) { loadRepositoryWorkspace(); return; }
  const repositoryLanguage = event.target.closest('[data-repository-language]');
  if (repositoryLanguage) { const url=new URL(window.location.href); url.searchParams.set('lang',repositoryLanguage.dataset.repositoryLanguage); url.searchParams.delete('path'); window.history.pushState({view:'repository'},'',url); loadRepositoryWorkspace(); return; }
  const repositoryFile = event.target.closest('[data-repository-file]');
  if (repositoryFile) { const url=new URL(window.location.href); url.searchParams.set('path',repositoryFile.dataset.repositoryFile); window.history.pushState({view:'repository'},'',url); loadRepositoryWorkspace(); return; }
  const incrementalTask = event.target.closest('[data-incremental-task]');
  if (incrementalTask) {
    const url = new URL(window.location.href);
    url.searchParams.set('taskId', incrementalTask.dataset.incrementalTask);
    url.searchParams.delete('stage');
    window.history.pushState({ view: 'production', taskId: incrementalTask.dataset.incrementalTask }, document.title, url);
    loadIncrementalWorkspace(incrementalTask.dataset.incrementalTask);
    return;
  }
  const incrementalStage = event.target.closest('[data-incremental-stage]');
  if (incrementalStage && !incrementalStage.disabled) {
    const url = new URL(window.location.href);
    url.searchParams.set('stage', incrementalStage.dataset.incrementalStage);
    window.history.pushState({ view: 'production', taskId: url.searchParams.get('taskId'), stage: incrementalStage.dataset.incrementalStage }, document.title, url);
    render();
    requestAnimationFrame(() => document.querySelector('[data-incremental-stage-main]')?.focus());
    return;
  }
  const prototypeToggle = event.target.closest('[data-incremental-prototype-toggle]');
  if (prototypeToggle) {
    const panel = prototypeToggle.closest('article')?.querySelector(`[data-incremental-prototype-panel="${prototypeToggle.dataset.incrementalPrototypeToggle}"]`)
      || prototypeToggle.closest('article')?.querySelector('[data-incremental-prototype-form]');
    if (panel) {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) panel.querySelector('input')?.focus();
    }
    return;
  }
  const prototypeGenerate = event.target.closest('[data-incremental-prototype-generate]');
  if (prototypeGenerate) {
    const consolePanel = prototypeGenerate.closest('.incremental-generation-console');
    const status = consolePanel?.querySelector('.incremental-prototype-status');
    prototypeGenerate.disabled = true;
    if (status) status.textContent = '前端已记录启动意图；等待真实 Agent 接口接入。';
    return;
  }
  const prototypePublish = event.target.closest('[data-incremental-prototype-publish]');
  if (prototypePublish) {
    const status = prototypePublish.parentElement?.querySelector('.incremental-prototype-status');
    prototypePublish.disabled = true;
    if (status) status.textContent = '前端已记录发布确认意图；正式发布仍需审核门禁和服务端事务。';
    return;
  }
  const checks = event.target.closest('[data-incremental-checks]');
  if (checks) { runIncrementalAction(checks, checks.dataset.incrementalChecks, () => runIncrementalChecks(checks.dataset.incrementalChecks), '差异检查已完成'); return; }
  const candidate = event.target.closest('[data-incremental-candidate]');
  if (candidate) { runIncrementalAction(candidate, candidate.dataset.incrementalCandidate, () => submitIncrementalCandidate(candidate.dataset.incrementalCandidate), '候选版本已冻结'); return; }
  const reviewCreate = event.target.closest('[data-incremental-review-create]');
  if (reviewCreate) { runIncrementalAction(reviewCreate, reviewCreate.dataset.incrementalReviewCreate, () => createIncrementalReview(reviewCreate.dataset.incrementalReviewCreate), '已创建审核'); return; }
  const reviewDecision = event.target.closest('[data-incremental-review-decision]');
  if (reviewDecision) {
    const decision = reviewDecision.dataset.incrementalReviewDecision;
    const comment = decision === 'reject' ? window.prompt('请填写退回原因') : window.prompt('审核意见（可选）', '');
    if (decision === 'reject' && !comment?.trim()) return;
    runIncrementalAction(reviewDecision, reviewDecision.dataset.taskId, () => decideIncrementalReview(reviewDecision.dataset.taskId, reviewDecision.dataset.reviewId, { decision, ...(comment?.trim() ? { comment: comment.trim() } : {}) }), decision === 'approve' ? '审核已通过' : '候选已退回');
    return;
  }
  const reviewDecisionP0 = event.target.closest('[data-review-decision]');
  if (reviewDecisionP0) { if (reviewDecisionP0.disabled) return; runIncrementalAction(reviewDecisionP0, reviewDecisionP0.dataset.taskId, () => decideIncrementalReview(reviewDecisionP0.dataset.taskId, reviewDecisionP0.dataset.reviewId, { decision: reviewDecisionP0.dataset.reviewDecision, candidateDigest: reviewDecisionP0.dataset.candidateDigest || '' }), '审核已通过'); return; }
  const reviewPublish = event.target.closest('[data-review-publish]');
  const deliveryRefresh = event.target.closest('[data-review-delivery-refresh]');
  if (deliveryRefresh) {
    if (deliveryRefresh.disabled) return;
    const task = appState.reviewProjection?.detail?.task || appState.reviewProjection?.detail;
    runIncrementalAction(deliveryRefresh, deliveryRefresh.dataset.reviewDeliveryRefresh, () => publishIncrementalTask(deliveryRefresh.dataset.reviewDeliveryRefresh, { expectedCandidateDigest: task?.candidate?.digest || task?.candidateDigest }), '交付状态已刷新');
    return;
  }
  if (reviewPublish) {
    if (reviewPublish.disabled) return;
    const task = appState.reviewProjection?.detail?.task || appState.reviewProjection?.detail;
    if (task?.handbookSource) {
      reviewPublish.disabled = true;
      const selection = await chooseMRParticipants(reviewPublish.dataset.reviewPublish, reviewPublish);
      reviewPublish.disabled = false;
      if (selection) runIncrementalAction(reviewPublish, reviewPublish.dataset.reviewPublish, () => publishIncrementalTask(reviewPublish.dataset.reviewPublish, selection), 'GitLab MR 已提交');
      return;
    }
    const confirmed = window.confirm(`请确认发布\n基线：${task?.baselineVersionId || '未知'}\n候选摘要：${task?.candidate?.digest || task?.candidateDigest || '未知'}\n${task?.handbookSource ? '发布将向映射仓库创建 MR，不自动合并。' : '发布后将替代当前正式版本。'}`);
    if (!confirmed) return;
    runIncrementalAction(reviewPublish, reviewPublish.dataset.reviewPublish, () => publishIncrementalTask(reviewPublish.dataset.reviewPublish, { expectedCandidateDigest: task?.candidate?.digest || task?.candidateDigest }), task?.handbookSource ? 'GitLab MR 已提交' : '平台版本已发布'); return;
  }
  const publish = event.target.closest('[data-incremental-publish]');
  if (publish) {
    if (publish.disabled) return;
    const task = appState.incrementalProjection?.detail?.task || appState.incrementalProjection?.detail;
    if (task?.handbookSource && task.state !== 'mr_submitted') {
      publish.disabled = true;
      const selection = await chooseMRParticipants(publish.dataset.incrementalPublish, publish);
      publish.disabled = false;
      if (selection) runIncrementalAction(publish, publish.dataset.incrementalPublish, () => publishIncrementalTask(publish.dataset.incrementalPublish, selection), 'GitLab MR 已提交');
      return;
    }
    runIncrementalAction(publish, publish.dataset.incrementalPublish, () => publishIncrementalTask(publish.dataset.incrementalPublish, { expectedCandidateDigest: task?.candidate?.digest }), task?.handbookSource ? 'GitLab MR 已提交' : '平台版本已发布');
    return;
  }
  const revision = event.target.closest('[data-incremental-revision]');
  if (revision) {
    runIncrementalAction(revision, revision.dataset.incrementalRevision, async () => {
      const created = await createIncrementalRevision(revision.dataset.incrementalRevision);
      const url = new URL(window.location.href);
      url.searchParams.set('taskId', created.id);
      window.history.replaceState({ view: 'production', taskId: created.id }, document.title, url);
      return created;
    }, '修订任务已创建');
    return;
  }
  const productionTab = event.target.closest('[data-production-tab]');
  if (productionTab) {
    document.querySelectorAll('[data-production-tab]').forEach(tab => {
      const active = tab === productionTab;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    ['sources', 'strategy', 'tasks'].forEach(name => {
      byId(`production-${name}`).hidden = name !== productionTab.dataset.productionTab;
    });
    return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  const outlineTab = event.target.closest('[data-outline-tab]');
  if (outlineTab) {
    const url = new URL(window.location.href);
    outlineTab.dataset.outlineTab === 'overview' ? url.searchParams.delete('tab') : url.searchParams.set('tab', outlineTab.dataset.outlineTab);
    window.history.replaceState({ ...window.history.state, tab: outlineTab.dataset.outlineTab }, document.title, `${url.pathname}${url.search}`);
    document.querySelectorAll('[data-outline-tab]').forEach(tab => {
      const active = tab === outlineTab;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll('[data-outline-panel]').forEach(panelElement => {
      panelElement.hidden = panelElement.dataset.outlinePanel !== outlineTab.dataset.outlineTab;
    });
    document.querySelectorAll('[data-outline-overview-action]').forEach(control => { control.hidden = outlineTab.dataset.outlineTab !== 'overview'; });
    return;
  }
  if (views[action]) navigate(action);
});

document.addEventListener('contextmenu', event => {
  const documentButton = event.target.closest?.('[data-outline-document]');
  if (!documentButton) return;
  event.preventDefault();
  documentButton.click();
  openOutlineContextMenu(documentButton.dataset.outlineDocument, event.clientX, event.clientY);
});

const OUTLINE_LONG_PRESS_DELAY_MS = 550;
const OUTLINE_LONG_PRESS_MOVE_TOLERANCE_PX = 10;
let outlineLongPress = null;
document.addEventListener('pointerdown', event => {
  const documentButton = event.target.closest?.('[data-outline-document]');
  if (!documentButton || event.pointerType !== 'touch') return;
  const { clientX, clientY } = event;
  const timer = window.setTimeout(() => {
    documentButton.click();
    openOutlineContextMenu(documentButton.dataset.outlineDocument, clientX, clientY);
    outlineLongPress = null;
  }, OUTLINE_LONG_PRESS_DELAY_MS);
  outlineLongPress = { pointerId: event.pointerId, clientX, clientY, timer };
});
document.addEventListener('pointermove', event => {
  if (!outlineLongPress || outlineLongPress.pointerId !== event.pointerId) return;
  const distance = Math.hypot(event.clientX - outlineLongPress.clientX, event.clientY - outlineLongPress.clientY);
  if (distance <= OUTLINE_LONG_PRESS_MOVE_TOLERANCE_PX) return;
  window.clearTimeout(outlineLongPress.timer);
  outlineLongPress = null;
});
['pointerup', 'pointercancel'].forEach(type => document.addEventListener(type, event => {
  if (!outlineLongPress || outlineLongPress.pointerId !== event.pointerId) return;
  window.clearTimeout(outlineLongPress.timer);
  outlineLongPress = null;
}));

document.addEventListener('close', event => {
  if (event.target.matches?.('.asset-dialog')) flushDeferredAssetRender();
  if (event.target.matches?.('[data-domain-task-dialog]')) openDomainTaskId = null;
}, true);

document.addEventListener('change', async event => {
  if (event.target.matches('[data-review-show-all]')) {
    const url = new URL(window.location.href);
    if (event.target.checked) url.searchParams.set('showAll', '1'); else url.searchParams.delete('showAll');
    window.history.pushState({ view: 'review' }, '', url);
    updateReviewRepositoryRegion();
    return;
  }

  const moveTarget = event.target.closest('[name="outline-target-directory"]');
  if (moveTarget) {
    const confirm = moveTarget.closest('dialog')?.querySelector('[data-outline-move-confirm]');
    if (confirm) confirm.disabled = !moveTarget.checked;
    return;
  }
  const primaryDomain = event.target.closest('[data-outline-primary-domain]');
  if (primaryDomain) {
    const group = primaryDomain.closest('[data-outline-domain-group]');
    group?.querySelectorAll('[data-outline-collaborator-domain]').forEach(input => {
      const same = input.value === primaryDomain.value;
      if (same) input.checked = false;
      input.closest('label').hidden = same;
    });
    scheduleOutlineGovernanceSave();
    return;
  }
  if (event.target.closest('[data-outline-collaborator-domain]')) { scheduleOutlineGovernanceSave(); return; }
  const assignmentDomainFilter = event.target.closest('[data-outline-assignment-domain-filter]');
  if (assignmentDomainFilter) {
    const url = new URL(window.location.href);
    assignmentDomainFilter.value ? url.searchParams.set('domain', assignmentDomainFilter.value) : url.searchParams.delete('domain');
    window.history.replaceState({ ...window.history.state, domain: assignmentDomainFilter.value }, document.title, `${url.pathname}${url.search}`);
    render();
    return;
  }
  if (event.target.closest('[data-outline-assignment-member-filter], [data-outline-task-select], [data-outline-batch-assignee]')) {
    updateOutlineAssignmentWorkspace();
    return;
  }
  const databaseField = event.target.closest('[data-database-field]');
  if (databaseField) { syncDatabaseConnectionDraft(databaseField.closest('[data-database-dialog]')); return; }
  const principalBindingFilter = event.target.closest('[data-principal-binding-filter]');
  if (principalBindingFilter) { appState.principalListState.bindingStatus = principalBindingFilter.value; render(); return; }
  const principalStateFilter = event.target.closest('[data-principal-state-filter]');
  if (principalStateFilter) { appState.principalListState.state = principalStateFilter.value; render(); return; }
  const principalImportFile = event.target.closest('[data-principal-import-form] input[type="file"]');
  if (principalImportFile) {
    pendingPrincipalImportFile = null;
    const form = principalImportFile.closest('form');
    form.querySelector('[data-principal-import-preview]').hidden = true;
    form.querySelector('[data-principal-import-apply]').hidden = true;
    form.querySelector('[data-principal-import-status]').textContent = '';
    return;
  }
  const prototypeFile = event.target.closest('[data-incremental-prototype-file]');
  if (prototypeFile) {
    const status = prototypeFile.closest('.incremental-prototype-form')?.querySelector('[role="status"]');
    if (status) status.textContent = prototypeFile.files?.[0] ? `已选择：${prototypeFile.files[0].name}；等待上传接口接入。` : '尚未选择文件。';
    return;
  }
  const taskAssignee = event.target.closest('[data-domain-task-assignee]');
  if (taskAssignee) {
    const taskId = taskAssignee.dataset.taskId;
    const itemId = taskAssignee.dataset.itemId;
    const status = taskAssignee.closest('[data-domain-task]')?.querySelector('.domain-task-status');
    taskAssignee.disabled = true;
    try {
      await updateDomainBuildTaskItem(taskId, itemId, {
        assigneeId: taskAssignee.value || null,
        assigneeName: taskAssignee.value ? taskAssignee.selectedOptions[0]?.textContent || null : null,
      });
      if (status) status.textContent = '责任人已更新。';
      if (appState.activeView === 'outlines') await loadOutlines();
      else await loadDomainBuildTasksWorkspace();
    } catch (error) {
      if (status) status.textContent = error.message || '责任人更新失败。';
      taskAssignee.disabled = false;
    }
    return;
  }
  const assetBranch = event.target.closest('[data-asset-branch]');
  if (assetBranch) {
    const item = appState.assetCatalog?.items?.find(entry => String(entry.handbookId) === assetBranch.dataset.assetBranch);
    if (!item) return;
    const previousBranch = item.selectedBranch || assetBranch.value;
    const requestedBranch = assetBranch.value;
    const sequence = (assetStatisticsSequences.get(item.handbookId) || 0) + 1;
    assetStatisticsSequences.set(item.handbookId, sequence);
    assetBranch.disabled = true;
    try {
      const statistics = await loadHandbookRepositoryStatistics(item.handbookId, requestedBranch, 'zh');
      if (assetStatisticsSequences.get(item.handbookId) !== sequence) { assetBranch.disabled = false; return; }
      Object.assign(item, statistics, { selectedBranch: requestedBranch, statisticsStatus: 'ok' });
      try { window.localStorage.setItem(assetBranchPreferenceKey(item.handbookId), requestedBranch); } catch (_error) { /* preference is optional */ }
      updateAssetStatistics(item);
      assetBranch.disabled = false;
    } catch (error) {
      if (assetStatisticsSequences.get(item.handbookId) === sequence) {
        item.selectedBranch = previousBranch;
        assetBranch.value = previousBranch;
        item.statisticsStatus = 'unavailable';
        updateAssetStatistics(item);
      }
      showAppNotice(error.message || '仓库统计暂不可用'); assetBranch.disabled = false;
    }
    return;
  }
  const permissionRole = event.target.closest('[data-permission-role-form] input[name="roles"]');
  if (permissionRole && !permissionRole.disabled) {
    const form = permissionRole.closest('[data-permission-role-form]');
    appState.permissionRoleDraft = {
      userId: form.dataset.permissionUserId,
      roles: [...form.querySelectorAll('input[name="roles"]:checked')].map(input => input.value),
    };
    return;
  }
  const userDropdown = event.target.closest('[data-permission-user-select]');
  if (userDropdown) {
    appState.permissionRoleDraft = null;
    appState.selectedPermissionUserId = userDropdown.value;
    appState.permissionSaveStatus = null;
    render();
    return;
  }
  const mappingConnectionSelect = event.target.closest('[data-mapping-connection-select]');
  if (mappingConnectionSelect) {
    const form = mappingConnectionSelect.closest('[data-repository-mapping-form]');
    appState.mappingState.enabledBranches = [];
    appState.mappingState.zhPaths = [];
    appState.mappingState.enPaths = [];
    appState.mappingState.treeItems = [];
    appState.mappingState.expandedPaths = new Set();
    appState.mappingState.search = '';
    appState.mappingState.searchOriginalExpandedPaths = null;
    renderMappingPathTags(form);
    renderMappingPreview(form);
    if (form && mappingConnectionSelect.value) {
      loadMappingBranches(form, mappingConnectionSelect.value).then(() => loadMappingTree(form, mappingConnectionSelect.value)).then(() => {
        renderMappingPathTags(form);
        renderMappingPreview(form);
      });
    } else if (form) {
      form.querySelector('[data-mapping-default-branch]').innerHTML = '<option value="">先选择连接</option>';
      form.querySelector('[data-mapping-path-browser]').innerHTML = '<div class="mapping-path-empty">请先选择 GitLab 连接和分支，然后浏览仓库目录树</div>';
    }
    return;
  }
  const mappingDefaultBranch = event.target.closest('[data-mapping-default-branch]');
  if (mappingDefaultBranch) {
    const form = mappingDefaultBranch.closest('[data-repository-mapping-form]');
    appState.mappingState.zhPaths = [];
    appState.mappingState.enPaths = [];
    appState.mappingState.treeItems = [];
    appState.mappingState.expandedPaths = new Set();
    appState.mappingState.search = '';
    appState.mappingState.searchOriginalExpandedPaths = null;
    if (!appState.mappingState.enabledBranches.includes(mappingDefaultBranch.value)) appState.mappingState.enabledBranches.unshift(mappingDefaultBranch.value);
    form.querySelectorAll('[name="enabledBranches"]').forEach(input => {
      input.checked = appState.mappingState.enabledBranches.includes(input.value);
      input.disabled = input.value === mappingDefaultBranch.value;
    });
    renderMappingPathTags(form);
    if (form && mappingDefaultBranch.value) await loadMappingTree(form, form.elements.connectionId.value);
    renderMappingPreview(form);
    return;
  }
  const mappingEnabledBranch = event.target.closest('[name="enabledBranches"]');
  if (mappingEnabledBranch) {
    const form = mappingEnabledBranch.closest('[data-repository-mapping-form]');
    appState.mappingState.enabledBranches = [...form.querySelectorAll('[name="enabledBranches"]:checked')].map(input => input.value);
    const defaultBranch = form.elements.defaultBranch.value;
    if (defaultBranch && !appState.mappingState.enabledBranches.includes(defaultBranch)) appState.mappingState.enabledBranches.unshift(defaultBranch);
    renderMappingPreview(form);
    return;
  }
});

let outlineGovernanceSaveTimer = null;
function scheduleOutlineGovernanceSave() {
  window.clearTimeout(outlineGovernanceSaveTimer);
  const status = document.querySelector('[data-outline-panel="overview"] .outline-governance-status');
  if (status) status.textContent = '有未保存变更';
  outlineGovernanceSaveTimer = window.setTimeout(() => {
    const button = document.querySelector('[data-outline-governance-save]');
    button?.click();
  }, 700);
}
document.addEventListener('input', event => {
  const versionSearch = event.target.closest('[data-version-mapping-search]');
  if (versionSearch) {
    const cursor = versionSearch.selectionStart;
    appState.gitlabListState.mappingSearch = versionSearch.value;
    appState.gitlabListState.mappingPage = 1;
    render();
    const restored = document.querySelector('[data-version-mapping-search]');
    if (restored) { restored.focus(); restored.setSelectionRange(cursor, cursor); }
    return;
  }
  if (event.target.closest?.('[data-outline-description]')) scheduleOutlineGovernanceSave();
  if (event.target.closest?.('[data-outline-assignment-search]')) updateOutlineAssignmentWorkspace();
  if (event.target.closest?.('[data-outline-node-search]')) updateOutlineNodeRows();
  const productionSearch = event.target.closest?.('[data-production-handbook-search]');
  if (productionSearch) {
    if (productionSearchComposing || event.isComposing) return;
    const query = productionSearch.value.trim().toLocaleLowerCase();
    const rows = [...document.querySelectorAll('[data-production-handbook-row]')];
    let visible = 0;
    rows.forEach(row => {
      row.hidden = !row.dataset.handbookSearchText.includes(query);
      if (!row.hidden) visible += 1;
    });
    const count = document.querySelector('[data-production-handbook-count]');
    if (count) count.textContent = `${visible} / ${rows.length} 本`;
    const table = document.querySelector('[data-table-view-host]');
    if (table) table.hidden = visible === 0;
    const empty = document.querySelector('[data-production-handbook-empty]');
    if (empty) {
      empty.hidden = visible > 0;
      empty.textContent = query ? `没有匹配“${productionSearch.value.trim()}”的手册，请尝试其他名称。` : '';
    }
    const url = new URL(window.location.href);
    query ? url.searchParams.set('q', productionSearch.value.trim()) : url.searchParams.delete('q');
    window.history.replaceState(window.history.state, document.title, `${url.pathname}${url.search}`);
    return;
  }
  const mappingTreeSearch = event.target.closest?.('[data-mapping-tree-search]');
  if (mappingTreeSearch) {
    const query = String(mappingTreeSearch.value || '').trim().toLocaleLowerCase();
    const form = mappingTreeSearch.closest('[data-repository-mapping-form]');
    if (!form) return;
    const state = appState.mappingState;
    if (query && !state.search) state.searchOriginalExpandedPaths = new Set(state.expandedPaths || []);
    state.search = query;
    if (!query) {
      state.expandedPaths = new Set(state.searchOriginalExpandedPaths || []);
      state.searchOriginalExpandedPaths = null;
    }
    renderMappingTree(form, state.treeItems || []);
  }
});
// ===== 仓库映射配置辅助函数 =====
async function loadMappingTree(form, connectionId) {
  appState.mappingState.connectionId = connectionId;
  const browser = form.querySelector('[data-mapping-path-browser]');
  if (!browser) return;
  browser.innerHTML = '<div class="mapping-path-empty">正在加载目录…</div>';
  try {
    const result = await loadGitLabTree(connectionId, form.elements.defaultBranch.value || 'master');
    const items = Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : []);
    appState.mappingState.treeItems = items;
    expandSelectedMappingAncestors();
    renderMappingTree(form, items);
  } catch (error) {
    const connectHref = `/knowledge-center/api/gitlab/oauth/start?connectionId=${encodeURIComponent(connectionId)}&returnTo=${encodeURIComponent(`/knowledge-center/assets?handbookId=${form.dataset.handbookId || ''}`)}`;
    const action = error.status === 401 ? ` <a class="mapping-auth-link" href="${connectHref}">连接 GitLab 账号</a>` : '';
    browser.innerHTML = `<div class="mapping-path-empty mapping-path-error"><strong>目录加载失败</strong><span>${escapeHtml(error.message || '未知错误')}</span>${action}</div>`;
  }
}

async function loadMappingBranches(form, connectionId, selectedBranch = '') {
  const defaultSelect = form.querySelector('[data-mapping-default-branch]');
  const enabledContainer = form.querySelector('[data-mapping-enabled-branches]');
  const hint = form.querySelector('[data-mapping-connection-hint]');
  const savedBranchOption = selectedBranch ? `<option value="${escapeHtml(selectedBranch)}" selected>${escapeHtml(selectedBranch)}</option>` : '';
  if (defaultSelect) defaultSelect.innerHTML = savedBranchOption || '<option value="">正在读取分支…</option>';
  syncSearchableSelect(defaultSelect);
  try {
    const result = await loadGitLabBranches(connectionId);
    const branches = Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : []);
    appState.mappingState.branches = branches;
    const selectedDefault = selectedBranch || branches.find(item => item.name === 'master')?.name || branches[0]?.name || '';
    if (!appState.mappingState.enabledBranches?.length) appState.mappingState.enabledBranches = [selectedDefault].filter(Boolean);
    if (selectedDefault && !appState.mappingState.enabledBranches.includes(selectedDefault)) appState.mappingState.enabledBranches.unshift(selectedDefault);
    if (defaultSelect) defaultSelect.innerHTML = branches.map(item => `<option value="${escapeHtml(item.name)}" ${item.name === selectedDefault ? 'selected' : ''}>${escapeHtml(item.name)}${item.protected ? ' · 受保护' : ''}</option>`).join('') || '<option value="">没有可用分支</option>';
    if (enabledContainer) enabledContainer.innerHTML = branches.map(item => `<label><input type="checkbox" name="enabledBranches" value="${escapeHtml(item.name)}" ${appState.mappingState.enabledBranches.includes(item.name) ? 'checked' : ''} ${item.name === selectedDefault ? 'disabled' : ''}><span>${escapeHtml(item.name)}</span></label>`).join('') || '<span class="muted">没有可用分支</span>';
    if (hint) hint.textContent = `已读取 ${branches.length} 个分支；目录浏览使用选择分支「${selectedDefault || '未选择'}」。`;
    renderMappingPreview(form);
  } catch (error) {
    if (defaultSelect) defaultSelect.innerHTML = savedBranchOption || '<option value="">分支读取失败</option>';
    if (enabledContainer) enabledContainer.innerHTML = selectedBranch
      ? (appState.mappingState.enabledBranches || [selectedBranch]).map(branch => `<label><input type="checkbox" name="enabledBranches" value="${escapeHtml(branch)}" checked disabled><span>${escapeHtml(branch)}</span></label>`).join('')
      : '<span class="muted">分支读取失败</span>';
    syncSearchableSelect(defaultSelect);
    if (hint) hint.innerHTML = `分支加载失败：${escapeHtml(error.message || '未知错误')} <a class="mapping-auth-link" href="/knowledge-center/api/gitlab/oauth/start?connectionId=${encodeURIComponent(connectionId)}&returnTo=${encodeURIComponent(`/knowledge-center/assets?handbookId=${form.dataset.handbookId || ''}`)}">连接 GitLab 账号</a>`;
  }
}

function buildMappingTreeHierarchy(items) {
  const root = { children: [] };
  const nodes = new Map();
  for (const item of items) {
    const cleanPath = String(item.path || '').replace(/^\/+|\/+$/g, '');
    if (!cleanPath) continue;
    const parts = cleanPath.split('/').filter(Boolean);
    let parent = root;
    let accumulated = '';
    parts.forEach((part, index) => {
      accumulated += `${accumulated ? '/' : ''}${part}`;
      let node = nodes.get(accumulated);
      if (!node) {
        node = { name: part, path: accumulated, type: 'tree', children: [] };
        nodes.set(accumulated, node);
        parent.children.push(node);
      }
      if (index === parts.length - 1) {
        node.name = item.name || part;
        node.type = item.type || node.type;
        node.id = item.id;
        node.mode = item.mode;
      }
      parent = node;
    });
  }
  return root.children;
}

function expandSelectedMappingAncestors() {
  const expanded = appState.mappingState.expandedPaths || new Set();
  for (const selectedPath of [...appState.mappingState.zhPaths, ...appState.mappingState.enPaths]) {
    const parts = String(selectedPath || '').split('/').filter(Boolean);
    for (let index = 1; index < parts.length; index += 1) expanded.add(parts.slice(0, index).join('/'));
  }
  appState.mappingState.expandedPaths = expanded;
}

function renderMappingTreeNodes(nodes, depth = 0) {
  const activeLang = appState.mappingState.activeLang || 'zh';
  const activeLabel = activeLang === 'zh' ? '中文' : '英文';
  return nodes.map(node => {
    const isDirectory = node.type === 'tree';
    const hasChildren = isDirectory && node.children.length > 0;
    const expanded = hasChildren && appState.mappingState.expandedPaths.has(node.path);
    const zhSelected = appState.mappingState.zhPaths.includes(node.path);
    const enSelected = appState.mappingState.enPaths.includes(node.path);
    const activeSelected = activeLang === 'zh' ? zhSelected : enSelected;
    const otherSelected = activeLang === 'zh' ? enSelected : zhSelected;
    const expandControl = hasChildren
      ? `<button type="button" class="mapping-tree-expand" data-mapping-tree-expand="${escapeHtml(node.path)}" aria-label="${expanded ? '收起' : '展开'} ${escapeHtml(node.name)}" aria-expanded="${expanded}"><i data-lucide="chevron-right" aria-hidden="true"></i></button>`
      : '<span class="mapping-tree-expand-spacer" aria-hidden="true"></span>';
    const selectControl = isDirectory
      ? `<button type="button" class="mapping-tree-select-btn${activeSelected ? ' is-selected' : ''}" data-mapping-tree-toggle="${escapeHtml(node.path)}">${activeSelected ? `取消${activeLabel}` : `选为${activeLabel}`}</button>`
      : '';
    const children = expanded ? `<ul role="group">${renderMappingTreeNodes(node.children, depth + 1)}</ul>` : '';
    return `<li class="mapping-tree-node${activeSelected ? ' selected' : ''}" role="treeitem" aria-level="${depth + 1}" ${isDirectory ? `aria-expanded="${expanded}"` : ''} data-mapping-tree-item="${escapeHtml(node.path)}" data-mapping-tree-type="${escapeHtml(node.type)}">
      <div class="mapping-tree-row" style="--mapping-tree-depth:${depth}">${expandControl}<span class="mapping-tree-icon" aria-hidden="true"><i data-lucide="${isDirectory ? 'folder' : 'file-text'}"></i></span><span class="mapping-tree-name">${escapeHtml(node.name)}</span>${otherSelected ? `<span class="mapping-tree-language-badge">已选为${activeLang === 'zh' ? '英文' : '中文'}</span>` : ''}${selectControl}</div>${children}
    </li>`;
  }).join('');
}

function filterMappingTreeNodes(nodes, query) {
  const normalized = String(query || '').trim().toLocaleLowerCase();
  if (!normalized) return nodes;
  const visit = items => (Array.isArray(items) ? items : []).reduce((result, node) => {
    const children = visit(node.children || []);
    const ownMatch = `${node.name || ''} ${node.path || ''}`.toLocaleLowerCase().includes(normalized);
    if (ownMatch || children.length) {
      result.push({ ...node, children: ownMatch && node.children?.length ? node.children : children });
    }
    return result;
  }, []);
  return visit(nodes);
}

function collectMappingDirectoryPaths(nodes, result = new Set()) {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (node.type === 'tree' && node.path) result.add(node.path);
    collectMappingDirectoryPaths(node.children || [], result);
  }
  return result;
}

function renderMappingTree(form, items) {
  const browser = form.querySelector('[data-mapping-path-browser]');
  if (!browser) return;
  if (!items.length) {
    browser.innerHTML = '<div class="mapping-path-empty">该目录下没有内容</div>';
    return;
  }
  const hierarchy = buildMappingTreeHierarchy(items);
  const query = appState.mappingState.search || '';
  const visibleHierarchy = filterMappingTreeNodes(hierarchy, query);
  if (query && !visibleHierarchy.length) {
    browser.innerHTML = '<div class="mapping-path-empty">没有匹配的目录或文件。</div>';
    return;
  }
  if (query) {
    appState.mappingState.expandedPaths = new Set([
      ...(appState.mappingState.searchOriginalExpandedPaths || []),
      ...collectMappingDirectoryPaths(visibleHierarchy),
    ]);
  }
  browser.innerHTML = `<ul class="mapping-tree-root" role="tree" aria-label="GitLab 仓库目录">${renderMappingTreeNodes(visibleHierarchy)}</ul>`;
  window.lucide?.createIcons();
}

function renderMappingLanguageSelector(form) {
  const activeLang = appState.mappingState.activeLang || 'zh';
  form?.querySelectorAll('[data-mapping-language]').forEach(button => {
    const active = button.dataset.mappingLanguage === activeLang;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderMappingPathTags(form) {
  const zhTags = form?.querySelector('[data-mapping-zh-tags]');
  const enTags = form?.querySelector('[data-mapping-en-tags]');
  if (zhTags) {
    zhTags.innerHTML = appState.mappingState.zhPaths.length
      ? appState.mappingState.zhPaths.map(p => `<span class="mapping-path-tag">${escapeHtml(p)}<button type="button" aria-label="移除中文路径 ${escapeHtml(p)}" data-mapping-path-remove="zh" data-mapping-path-value="${escapeHtml(p)}">×</button></span>`).join('')
      : '<span class="mapping-path-placeholder">尚未从目录选择中文路径</span>';
  }
  if (enTags) {
    enTags.innerHTML = appState.mappingState.enPaths.length
      ? appState.mappingState.enPaths.map(p => `<span class="mapping-path-tag">${escapeHtml(p)}<button type="button" aria-label="移除英文路径 ${escapeHtml(p)}" data-mapping-path-remove="en" data-mapping-path-value="${escapeHtml(p)}">×</button></span>`).join('')
      : '<span class="mapping-path-placeholder">尚未从目录选择英文路径</span>';
  }
}

function renderMappingPreview(form) {
  const preview = form?.querySelector('[data-mapping-preview]');
  if (!preview) return;
  const connId = form?.elements?.connectionId?.value;
  const defaultBranch = form?.elements?.defaultBranch?.value || 'master';
  const selectedBranch = form?.elements?.defaultBranch?.value || '';
  const zhPaths = appState.mappingState.zhPaths;
  const enPaths = appState.mappingState.enPaths;
  if (!zhPaths.length && !enPaths.length) {
    preview.innerHTML = '<div class="mapping-preview-empty">完成路径选择后，预览将在此显示</div>';
    return;
  }
  let html = '';
  if (connId) html += `<div class="mapping-preview-item"><span class="mapping-preview-label">连接</span><span class="mapping-preview-value">${escapeHtml(connId.slice(0, 12))}…</span></div>`;
  html += `<div class="mapping-preview-item"><span class="mapping-preview-label">默认分支</span><span class="mapping-preview-value">${escapeHtml(selectedBranch || defaultBranch)}</span></div>`;
  if (appState.mappingState.enabledBranches.length) html += `<div class="mapping-preview-item"><span class="mapping-preview-label">可切换分支</span><span class="mapping-preview-value">${appState.mappingState.enabledBranches.map(value => escapeHtml(value)).join('<br>')}</span></div>`;
  if (zhPaths.length) html += `<div class="mapping-preview-item"><span class="mapping-preview-label">中文路径</span><span class="mapping-preview-value">${zhPaths.map(p => escapeHtml(p)).join('<br>')}</span></div>`;
  if (enPaths.length) html += `<div class="mapping-preview-item"><span class="mapping-preview-label">英文路径</span><span class="mapping-preview-value">${enPaths.map(p => escapeHtml(p)).join('<br>')}</span></div>`;
  preview.innerHTML = html;
}

function toggleMappingPath(lang, path) {
  const paths = lang === 'zh' ? appState.mappingState.zhPaths : appState.mappingState.enPaths;
  const idx = paths.indexOf(path);
  if (idx >= 0) paths.splice(idx, 1);
  else paths.push(path);
}

function removeMappingPath(lang, path) {
  const paths = lang === 'zh' ? appState.mappingState.zhPaths : appState.mappingState.enPaths;
  const idx = paths.indexOf(path);
  if (idx >= 0) paths.splice(idx, 1);
}

async function savePrincipalEditor(form, payload, correctionDialog = null) {
  const status = form.querySelector('[data-principal-form-status]');
  const fieldError = form.querySelector('[data-principal-login-error]');
  const input = form.elements.casLoginName;
  const button = form.querySelector('button[type="submit"]');
  const correctionButton = correctionDialog?.querySelector('button[type="submit"]');
  const correctionStatus = correctionDialog?.querySelector('[data-principal-correction-status]');
  button.disabled = true;
  if (correctionButton) correctionButton.disabled = true;
  status.textContent = '';
  fieldError.textContent = '';
  input.removeAttribute('aria-invalid');
  if (correctionStatus) correctionStatus.textContent = '正在更正…';
  try {
    if (form.elements.principalId.value) {
      await updatePrincipal(form.elements.principalId.value, { ...payload, rowVersion: Number(form.elements.rowVersion.value) });
      correctionDialog?.close();
      document.querySelector('[data-principal-editor-dialog][open]')?.close();
      pendingPrincipalCorrection = null;
      await loadGitLabAdmin();
      showAppNotice(correctionDialog ? 'CAS 登录名已更正。' : '人员信息已保存。', { title: '保存成功', tone: 'success' });
    } else {
      await createPrincipal(payload);
      document.querySelector('[data-principal-editor-dialog][open]')?.close();
      await loadGitLabAdmin();
      showAppNotice('人员已新增。', { title: '保存成功', tone: 'success' });
    }
  } catch (error) {
    if (error.code === 'CAS_LOGIN_NAME_CONFLICT') {
      correctionDialog?.close();
      pendingPrincipalCorrection = null;
      fieldError.textContent = '该 CAS 登录名已绑定其他人员，请核对后重新填写。';
      input.setAttribute('aria-invalid', 'true');
      requestAnimationFrame(() => input.focus());
    } else {
      const target = correctionStatus || status;
      target.textContent = error.message || '人员保存失败。';
    }
    return false;
  } finally {
    button.disabled = false;
    if (correctionButton) correctionButton.disabled = false;
  }
  return true;
}

document.addEventListener('focusin', async event => {
  const select = event.target.closest('[data-review-mention-select]');
  if (!select || select.dataset.loaded === 'true' || select.dataset.loading === 'true') return;
  select.dataset.loading = 'true';
  const status = select.closest('label')?.querySelector('[data-review-mention-status]');
  try {
    const targets = await loadReviewMentionTargets(select.dataset.reviewId);
    select.replaceChildren(...targets.map(item => {
      const option = document.createElement('option'); option.value = item.handbookId;
      option.textContent = `${item.handbookName} · ${item.ownerName || item.ownerId || '未指派负责人'} · ${item.ticketNumber}`;
      option.disabled = !item.ownerId; return option;
    }));
    select.dataset.loaded = 'true';
    if (status) status.textContent = targets.length ? '仅显示当前审核关联工单中已确认的手册；接收人由服务端读取' : '当前审核没有可提及的已确认手册';
  } catch (error) {
    if (status) status.textContent = error.message || '手册列表读取失败，请稍后重试';
  } finally { delete select.dataset.loading; }
});

document.addEventListener('submit', async event => {
  if (event.target.matches('[data-outline-purge-form]')) {
    event.preventDefault();
    event.target.querySelector('[data-outline-purge-confirm]')?.click();
    return;
  }
  const teamCreateForm = event.target.closest('[data-team-group-create-form]');
  if (teamCreateForm) {
    event.preventDefault();
    const status = teamCreateForm.querySelector('[data-team-group-create-status]');
    const groupName = teamCreateForm.elements.groupName.value.trim();
    if (!groupName) { status.textContent = '请输入小组名称。'; return; }
    const submit = teamCreateForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      status.textContent = '创建中…';
      const response = await createTeamGroup({ groupName, actor: authState.session?.user?.id || 'platform:admin' });
      const created = response?.data || response;
      teamCreateForm.closest('dialog')?.close();
      await loadTeamGroupsAdmin();
      const query = new URLSearchParams({ tab: 'principals', view: 'groups', groupId: String(created.teamGroupId) });
      history.replaceState({ ...history.state, teamView: 'groups', groupId: created.teamGroupId }, '', `/knowledge-center/platform?${query}`);
      render();
    } catch (error) {
      status.textContent = error.message || '创建失败，请稍后重试。';
    } finally {
      submit.disabled = false;
    }
    return;
  }
  const correctionForm = event.target.closest('[data-principal-cas-correction-form]');
  if (correctionForm) {
    event.preventDefault();
    const pending = pendingPrincipalCorrection;
    if (!pending) { correctionForm.closest('dialog')?.close(); return; }
    await savePrincipalEditor(pending.form, pending.payload, correctionForm.closest('dialog'));
    return;
  }
  const principalEditorForm = event.target.closest('[data-principal-editor-form]');
  if (principalEditorForm) {
    event.preventDefault();
    const payload = { displayName: principalEditorForm.elements.displayName.value.trim(), casLoginName: principalEditorForm.elements.casLoginName.value.trim() || null, state: principalEditorForm.elements.state.value };
    const originalLogin = principalEditorForm.dataset.originalCasLoginName || '';
    if (originalLogin && payload.casLoginName !== originalLogin) {
      const dialog = document.querySelector('[data-principal-cas-correction-dialog]');
      if (!dialog) return;
      pendingPrincipalCorrection = { form: principalEditorForm, payload };
      dialog.querySelector('[data-principal-correction-name]').textContent = payload.displayName;
      dialog.querySelector('[data-principal-correction-before]').textContent = originalLogin;
      dialog.querySelector('[data-principal-correction-after]').textContent = payload.casLoginName || '—';
      dialog.querySelector('[data-principal-correction-status]').textContent = '';
      dialog.showModal();
      dialog.querySelector('button[type="submit"]')?.focus();
      return;
    }
    await savePrincipalEditor(principalEditorForm, payload);
    return;
  }
  const principalImportForm = event.target.closest('[data-principal-import-form]');
  if (principalImportForm) {
    event.preventDefault();
    const file = principalImportForm.elements.file.files?.[0];
    const status = principalImportForm.querySelector('[data-principal-import-status]');
    if (!file) { status.textContent = '请选择 Excel 文件。'; return; }
    const button = principalImportForm.querySelector('button[type="submit"]'); button.disabled = true;
    try {
      status.textContent = '正在预检…';
      const result = await importPrincipals(file, 'preview');
      pendingPrincipalImportFile = file;
      const preview = principalImportForm.querySelector('[data-principal-import-preview]');
      const labels = { ADD: '新增', UPDATE: '更新/绑定', UNCHANGED: '无变化', CONFLICT: '冲突' };
      preview.innerHTML = `<div class="principal-import-summary"><div><span>新增</span><strong>${result.summary.add}</strong></div><div><span>更新/绑定</span><strong>${result.summary.update}</strong></div><div><span>无变化</span><strong>${result.summary.unchanged}</strong></div><div><span>冲突</span><strong>${result.summary.conflict}</strong></div></div><div class="principal-import-rows"><table><thead><tr><th>行</th><th>姓名</th><th>CAS 登录名</th><th>结果</th><th>说明</th></tr></thead><tbody>${result.rows.map(row => `<tr class="${row.action === 'CONFLICT' ? 'principal-import-conflict' : ''}"><td>${row.rowNumber}</td><td>${escapeHtml(row.displayName)}</td><td>${escapeHtml(row.casLoginName || '—')}</td><td>${labels[row.action]}</td><td>${escapeHtml(row.message)}</td></tr>`).join('')}</tbody></table></div>`;
      preview.hidden = false;
      const apply = principalImportForm.querySelector('[data-principal-import-apply]'); apply.hidden = result.summary.conflict > 0; apply.disabled = false;
      status.textContent = result.summary.conflict > 0 ? `发现 ${result.summary.conflict} 条冲突，请修正后重新预检。` : '预检通过，请确认导入。';
    }
    catch (error) { pendingPrincipalImportFile = null; status.textContent = error.message || '人员导入预检失败。'; }
    finally { button.disabled = false; }
    return;
  }
  const uploadForm = event.target.closest('[data-cleaning-upload-form]');
  if (uploadForm) {
    event.preventDefault();
    const file = uploadForm.elements.file.files?.[0];
    const status = uploadForm.querySelector('[data-cleaning-upload-status]');
    if (!file) { status.textContent = '请选择要上传的文件。'; return; }
    const button = uploadForm.querySelector('button[type="submit"]'); button.disabled = true;
    try {
      status.textContent = '正在创建上传会话…';
      const session = await createUploadSession({ name: uploadForm.elements.name.value.trim(), operatorLabel: displayName(), totalFiles: 1, totalBytes: file.size });
      const added = await addUploadFile(session.id, { relativePath: file.name, size: file.size, mediaType: file.type || 'application/octet-stream' });
      const chunkSize = Number(session.chunkSize || file.size || 1);
      const total = Math.max(1, Math.ceil(file.size / chunkSize));
      for (let index = 0; index < total; index += 1) {
        const end = Math.min(file.size, (index + 1) * chunkSize);
        status.textContent = `正在上传第 ${index + 1}/${total} 块…`;
        await uploadChunk(session.id, added.id, index, file.slice(index * chunkSize, end), { 'Content-Range': `bytes ${index * chunkSize}-${end - 1}/${file.size}` });
      }
      await completeUploadFile(session.id, added.id); await completeUploadSession(session.id);
      status.textContent = '正在创建资料批次…';
      const batch = await createUploadBatch(session.id, uploadForm.elements.name.value.trim());
      status.textContent = `上传完成，资料批次 ${batch.id || '已创建'}。`;
      uploadForm.reset();
      await loadCleaningWorkspace().then(data => { appState.cleaningProjection = { status: 'ok', ...data, asOf: new Date().toISOString() }; render(); });
    } catch (error) { status.textContent = error.message || '上传失败，请稍后重试。'; }
    finally { button.disabled = false; }
    return;
  }
  const permissionForm = event.target.closest('[data-permission-role-form]');
  const versionForm = event.target.closest('[data-version-mapping-form]');
  if (versionForm) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(versionForm));
    const existing = appState.gitlabProjection.versionMappings.find(rule => String(rule.id) === String(appState.gitlabListState.mappingEditId));
    const button = versionForm.querySelector('[type=submit]'); button.disabled = true;
    try {
      await saveGitLabVersionMapping(values, existing);
      appState.gitlabListState.mappingEditing = false;
      appState.gitlabListState.mappingCandidateIndex = null;
      appState.gitlabListState.mappingFeedback = existing?.state === 'active' ? '修订草案已保存，原规则仍生效。验证后可启用。' : '映射草案已保存。';
      await loadGitLabAdmin(); render();
    } catch (error) {
      appState.gitlabListState.mappingFeedback = error.message;
      const feedback = document.querySelector('.gitlab-version-feedback'); if (feedback) feedback.textContent = error.message;
      button.disabled = false;
    }
    return;
  }
  if (permissionForm) {
    event.preventDefault();
    const userId = appState.selectedPermissionUserId;
    if (!userId) return;
    const selectedUser = (appState.permissionProjection?.users || []).find(user => user.id === userId);
    if (!selectedUser || selectedUser.rolesEditable === false || selectedUser.identitySource !== 'cas') return;
    const roles = [...permissionForm.querySelectorAll('input[name="roles"]:checked')].map(input => input.value);
    if (selectedUser.rowVersion == null || !Number.isInteger(Number(selectedUser.rowVersion))) {
      appState.permissionSaveStatus = { error: '用户权限数据已过期，请刷新后重试' };
      render();
      return;
    }
    const submittedDraft = { userId, roles };
    appState.permissionRoleDraft = submittedDraft;
    appState.permissionSaveStatus = 'saving';
    render();
    try {
      await updatePlatformUserPermissions(userId, {
        roles,
        rowVersion: Number(selectedUser.rowVersion),
        idempotencyKey: `permission-${userId}-${Date.now()}`,
      });
      if (appState.permissionRoleDraft === submittedDraft) appState.permissionRoleDraft = null;
      appState.permissionSaveStatus = 'saved';
      await loadGitLabAdmin();
      setTimeout(() => { appState.permissionSaveStatus = null; render(); }, 2000);
    } catch (error) { appState.permissionSaveStatus = { error: error.message || '保存失败，请重试' }; render(); }
    return;
  }
  /* ---- GitLab 添加连接表单提交 ---- */
  const gitlabAddForm = event.target.closest("[data-gitlab-add-form]");
  if (gitlabAddForm) {
    event.preventDefault();
    const button = gitlabAddForm.querySelector('button[type="submit"]');
    const statusEl = gitlabAddForm.querySelector(".form-status");
    button.disabled = true;
    statusEl.textContent = "正在保存并验证…";
    try {
      const saved = await createGitLabConnection({
        name: gitlabAddForm.elements.name.value.trim(),
        baseUrl: gitlabAddForm.elements.baseUrl.value.trim(),
        projectPath: gitlabAddForm.elements.projectPath.value.trim(),
        defaultBranch: gitlabAddForm.elements.defaultBranch.value.trim(),
        purpose: gitlabAddForm.elements.purpose.value,
        authMode: gitlabAddForm.elements.authMode.value,
        ...(gitlabAddForm.elements.credentialRef.value.trim() ? { credentialRef: gitlabAddForm.elements.credentialRef.value.trim() } : {}),
      });
      appState.gitlabListState.selectedConnectionId = saved.id;
      appState.gitlabListState.drawerOpen = true;
      appState.gitlabAddingConnection = false;
      if (saved.authMode === 'user_oauth' && !appState.gitlabProjection?.oauthStatus?.connected) {
        if (appState.gitlabProjection?.oauthConfig?.configured) {
          statusEl.textContent = '连接已保存，正在打开 GitLab 授权…';
          const returnTo = '/knowledge-center/platform?tab=gitlab';
          window.location.assign(`/knowledge-center/api/gitlab/oauth/start?connectionId=${encodeURIComponent(saved.id)}&returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }
        appState.gitlabVerification = { connectionId: saved.id, status: 'pending_auth', message: '连接已保存，但平台尚未配置 GitLab OAuth。' };
      } else {
        appState.gitlabVerification = { connectionId: saved.id, status: 'verifying' };
        render();
        try {
          appState.gitlabVerification = await verifyGitLabConnection(saved.id);
        } catch (error) {
          appState.gitlabVerification = { connectionId: saved.id, status: 'failed', verifiedAt: new Date().toISOString(), error: { code: error.code, message: error.message, recovery: error.recovery } };
        }
      }
      await loadGitLabAdmin();
    } catch (error) {
      statusEl.textContent = error.message || "保存失败，请重试";
      statusEl.setAttribute('role', 'alert');
      button.disabled = false;
    }
    return;
  }
  /* ---- GitLab 编辑连接表单提交 ---- */
  const gitlabEditForm = event.target.closest("[data-gitlab-edit-form]");
  if (gitlabEditForm) {
    event.preventDefault();
    const button = gitlabEditForm.querySelector("button[type=\"submit\"]");
    const statusEl = gitlabEditForm.querySelector(".form-status");
    const connId = gitlabEditForm.elements.id.value;
    button.disabled = true;
    statusEl.textContent = "正在保存…";
    try {
      await updateGitLabConnection(connId, {
        name: gitlabEditForm.elements.name.value.trim(),
        baseUrl: gitlabEditForm.elements.baseUrl.value.trim(),
        projectPath: gitlabEditForm.elements.projectPath.value.trim(),
        defaultBranch: gitlabEditForm.elements.defaultBranch.value.trim(),
        rowVersion: appState.gitlabEditingConnection?.rowVersion,
        purpose: gitlabEditForm.elements.purpose.value,
        authMode: gitlabEditForm.elements.authMode.value,
        ...(gitlabEditForm.elements.credentialRef.value.trim() ? { credentialRef: gitlabEditForm.elements.credentialRef.value.trim() } : {}),
      });
      statusEl.textContent = "连接已更新";
      appState.gitlabEditingConnection = null;
      await loadGitLabAdmin();
    } catch (error) {
      statusEl.textContent = error.message || "保存失败，请重试";
      statusEl.setAttribute('role', 'alert');
      button.disabled = false;
    }
    return;
  }
  const gitLabConnectionForm = event.target.closest('[data-gitlab-connection-form]');
  if (gitLabConnectionForm) {
    event.preventDefault();
    const button = gitLabConnectionForm.querySelector('button[type="submit"]');
    const status = gitLabConnectionForm.querySelector('.integration-form-status');
    button.disabled = true;
    status.textContent = '正在保存…';
    try {
      await saveGitLabConnection({
        name: gitLabConnectionForm.elements.name.value.trim(),
        host: gitLabConnectionForm.elements.host.value.trim(),
        project: gitLabConnectionForm.elements.project.value.trim(),
        defaultBranch: gitLabConnectionForm.elements.defaultBranch.value.trim(),
        mode: gitLabConnectionForm.elements.mode.value,
        ...(gitLabConnectionForm.elements.credentialRef?.value.trim() ? { credentialRef: gitLabConnectionForm.elements.credentialRef.value.trim() } : {}),
      });
      status.textContent = '连接配置已保存。';
      await loadGitLabAdmin();
    } catch (error) { status.textContent = error.message || '保存失败'; }
    finally { button.disabled = false; }
    return;
  }
  const incrementalCreate = event.target.closest('[data-incremental-create-form]');
  if (incrementalCreate) {
    event.preventDefault();
    const button = incrementalCreate.querySelector('button[type="submit"]');
    button.disabled = true;
    incrementalStatus(incrementalCreate, '正在创建…');
    try {
      const created = await createIncrementalTask({
        name: incrementalCreate.elements.name.value.trim(),
        handbookId: incrementalCreate.elements.handbookId.value,
        businessVersion: incrementalCreate.elements.businessVersion.value.trim(),
        baselineVersionId: incrementalCreate.elements.baselineVersionId.value.trim(),
      });
      incrementalCreate.closest('dialog').close();
      const url = new URL(window.location.href);
      url.searchParams.set('taskId', created.id);
      url.searchParams.set('stage', 'setup');
      window.history.pushState({ view: 'production', taskId: created.id }, document.title, url);
      await loadIncrementalWorkspace(created.id);
    } catch (error) { incrementalStatus(incrementalCreate, error.message, true); button.disabled = false; }
    return;
  }
  const incrementalSource = event.target.closest('[data-incremental-source-form]');
  if (incrementalSource) {
    event.preventDefault();
    const taskId = incrementalSource.dataset.taskId;
    const button = incrementalSource.querySelector('button[type="submit"]');
    await runIncrementalAction(button, taskId, () => addIncrementalSource(taskId, {
      sourceType: incrementalSource.elements.sourceType.value,
      label: incrementalSource.elements.label.value.trim(),
      reference: incrementalSource.elements.reference.value.trim() || undefined,
      content: incrementalSource.elements.content.value,
    }), '来源已固化');
    return;
  }
  const prototypePingCode = event.target.closest('[data-incremental-prototype-form="pingcode"]');
  if (prototypePingCode) {
    event.preventDefault();
    const status = prototypePingCode.querySelector('[role="status"]');
    if (status) status.textContent = '链接格式已检查；正文读取和快照固化等待 PingCode 连接器接入。';
    return;
  }
  const prototypeContract = event.target.closest('[data-incremental-prototype-form="contract"]');
  if (prototypeContract) {
    event.preventDefault();
    const status = prototypeContract.querySelector('[role="status"]');
    if (status) status.textContent = '前端已暂存大纲和双模板选择；正式版本引用等待服务端契约接入。';
    return;
  }
  const incrementalTarget = event.target.closest('[data-incremental-target-form]');
  if (incrementalTarget) {
    event.preventDefault();
    const taskId = incrementalTarget.dataset.taskId;
    const button = incrementalTarget.querySelector('button[type="submit"]');
    const checked = [...incrementalTarget.querySelectorAll('[name="sectionIds"]:checked, [name="chapterIds"]:checked')].map(input => input.value);
    const documentIds = incrementalTarget.elements.documentIds
      ? incrementalTarget.elements.documentIds.value.split(/[\n,，]/).map(value => value.trim()).filter(Boolean)
      : [...incrementalTarget.querySelectorAll('[name="documentIds"]:checked')].map(input => input.value);
    await runIncrementalAction(button, taskId, () => updateIncrementalTarget(taskId, { documentIds, sectionIds: checked, language: incrementalTarget.elements.language?.value || 'zh-CN' }), '修改范围已确认');
    return;
  }
  const incrementalDraft = event.target.closest('[data-incremental-draft-form]');
  if (incrementalDraft) {
    event.preventDefault();
    const taskId = incrementalDraft.dataset.taskId;
    const button = incrementalDraft.querySelector('button[type="submit"]');
    const task = appState.incrementalProjection?.detail?.task || appState.incrementalProjection?.detail;
    const type = incrementalDraft.elements.operationType.value;
    const operation = {
      type,
      documentId: incrementalDraft.elements.operationDocumentId.value,
      nodeId: incrementalDraft.elements.nodeId.value.trim(),
      ...(['update', 'delete', 'move'].includes(type) ? { beforeDigest: incrementalDraft.elements.beforeDigest.value.trim() } : {}),
      ...(['add', 'update'].includes(type) ? { after: { content: incrementalDraft.elements.afterContent.value } } : {}),
      ...(type === 'move' ? { targetParentId: incrementalDraft.elements.targetParentId.value.trim(), ordinal: Number(incrementalDraft.elements.ordinal.value) } : {}),
    };
    await runIncrementalAction(button, taskId, () => saveIncrementalDraft(taskId, {
      editVersion: Number(task?.draft?.editVersion || 0),
      content: incrementalDraft.elements.content.value,
      operations: [operation],
    }), '草稿已保存');
    return;
  }
  const commentForm = event.target.closest('[data-incremental-comment-form]');
  if (commentForm) {
    event.preventDefault();
    const taskId = commentForm.dataset.taskId;
    const button = commentForm.querySelector('button[type="submit"]');
    await runIncrementalAction(button, taskId, () => commentIncrementalReview(taskId, commentForm.dataset.reviewId, { comment: commentForm.elements.comment.value.trim() }), '评论已添加');
    return;
  }
  const assignmentForm = event.target.closest('[data-review-assignment-form]');
  if (assignmentForm) {
    event.preventDefault();
    const button = assignmentForm.querySelector('button[type="submit"]');
    const error = assignmentForm.querySelector('[data-review-assignment-error]');
    const reviewerId = assignmentForm.elements.reviewerIds.value;
    if (!reviewerId) { error.textContent = '请选择一名审核人'; error.hidden = false; return; }
    button.disabled = true; error.hidden = true;
    try {
      await reassignIncrementalReview(assignmentForm.dataset.taskId, assignmentForm.dataset.reviewId, {
        documentId: assignmentForm.dataset.documentId,
        candidateDigest: assignmentForm.dataset.digest,
        reviewerIds: [reviewerId],
      });
      assignmentForm.closest('dialog').close();
      await loadReviewWorkspace();
      showAppNotice('审核人已更新', { title: '操作完成', tone: 'success' });
    } catch (cause) {
      error.textContent = cause.message || '修改审核人失败'; error.hidden = false;
    } finally { button.disabled = false; }
    return;
  }
  const onlineReviewForm = event.target.closest('[data-review-online-form]');
  if (onlineReviewForm) {
    event.preventDefault();
    const submit = onlineReviewForm.querySelector('button[type="submit"]');
    const errorPanel = onlineReviewForm.querySelector('[data-review-online-error]');
    errorPanel.hidden = true;
    submit.disabled = true;
    try {
      const checked = [...onlineReviewForm.querySelectorAll('[data-review-online-draft]:checked')];
      if (!checked.length) throw new Error('请选择至少一篇已保存修改稿');
      if (onlineReviewForm.elements.scope.value === 'document' && checked.length !== 1) throw new Error('单篇文档评审只能选择一篇修改稿');
      const reviewerId = onlineReviewForm.elements.reviewerId.value;
      if (!reviewerId) throw new Error('请选择审核人');
      const documents = checked.map(input => ({
        documentId: input.dataset.documentId,
        outlineVersionId: input.dataset.outlineVersionId,
        branch: input.dataset.branch,
        draftRevisionId: input.dataset.revisionId,
        filePath: onlineReviewForm.querySelector(`[data-review-online-path="${CSS.escape(input.dataset.documentId)}"]`)?.value.trim(),
      }));
      if (documents.some(item => !item.filePath)) throw new Error('请填写每篇文档的完整仓库文件路径');
      if (new Set(documents.map(item => item.branch)).size !== 1) throw new Error('一次在线评审只能提交同一目标分支');
      const created = await createHandbookIncrementalReview(onlineReviewForm.dataset.handbookId, {
        reviewMode: 'online_review', scope: onlineReviewForm.elements.scope.value,
        businessVersion: String(onlineReviewForm.dataset.businessVersion || '').trim(),
        defaultReviewerIds: [reviewerId], documents,
        note: onlineReviewForm.elements.note.value.trim(),
      });
      const task = created.tasks?.[0];
      if (!task) throw new Error('服务端没有返回审核任务');
      onlineReviewForm.closest('dialog')?.close();
      const url = new URL(created.reviewHref || `/knowledge-center/review?handbookId=${encodeURIComponent(task.handbookId)}&taskId=${encodeURIComponent(task.id)}`, window.location.href);
      url.searchParams.set('view', 'reader');
      window.history.pushState({ view: 'review', taskId: task.id }, document.title, url);
      await loadReviewWorkspace(task.id);
    } catch (error) {
      const message = String(error?.message || '').trim();
      errorPanel.textContent = !message || /^(failed to fetch|networkerror|load failed)$/i.test(message)
        ? '无法连接平台服务，请检查网络后重试。' : message;
      errorPanel.hidden = false;
      errorPanel.focus();
    } finally {
      submit.disabled = false;
    }
    return;
  }
  const reviewCommentForm = event.target.closest('[data-review-comment-form]');
  if (reviewCommentForm) { event.preventDefault(); const button = reviewCommentForm.querySelector('button[type="submit"]'); let anchor = null; try { anchor = reviewCommentForm.elements.anchor.value ? JSON.parse(reviewCommentForm.elements.anchor.value) : null; } catch (_) { anchor = null; } const mentions = [...reviewCommentForm.elements.mentions.selectedOptions].map(option => option.value).filter(Boolean).map(handbookId => ({ handbookId })); await runIncrementalAction(button, reviewCommentForm.dataset.taskId, () => commentIncrementalReview(reviewCommentForm.dataset.taskId, reviewCommentForm.dataset.reviewId, { comment: reviewCommentForm.elements.comment.value.trim(), commentType: reviewCommentForm.elements.commentType?.value || 'suggestion', severity: reviewCommentForm.elements.severity?.value || 'normal', candidateDigest: reviewCommentForm.elements.candidateDigest.value, mentions, ...(anchor ? { anchor } : {}) }), mentions.length ? '意见已保存，通知状态请查看结果' : '意见已添加'); return; }
  const reviewReplyForm = event.target.closest('[data-review-reply-form]');
  if (reviewReplyForm) { event.preventDefault(); const button = reviewReplyForm.querySelector('button[type="submit"]'); await runIncrementalAction(button, reviewReplyForm.dataset.taskId, () => replyIncrementalReviewComment(reviewReplyForm.dataset.taskId, reviewReplyForm.dataset.reviewId, reviewReplyForm.dataset.commentId, { comment: reviewReplyForm.elements.comment.value.trim() }), '回复已发送'); return; }
  const reviewDecisionForm = event.target.closest('[data-review-decision-form]');
  if (reviewDecisionForm) { event.preventDefault(); const button = reviewDecisionForm.querySelector('button[type="submit"]'); await runIncrementalAction(button, reviewDecisionForm.dataset.taskId, () => decideIncrementalReview(reviewDecisionForm.dataset.taskId, reviewDecisionForm.dataset.reviewId, { decision: 'reject', comment: reviewDecisionForm.elements.comment.value.trim(), candidateDigest: reviewDecisionForm.dataset.candidateDigest || '' }), '修改稿已退回'); return; }
  const evidenceForm = event.target.closest('[data-incremental-evidence-form]');
  if (evidenceForm) {
    event.preventDefault();
    const taskId = evidenceForm.dataset.taskId;
    const button = evidenceForm.querySelector('button[type="submit"]');
    await runIncrementalAction(button, taskId, () => recordIncrementalEvidence(taskId, {
      type: evidenceForm.elements.type.value,
      reference: evidenceForm.elements.reference.value.trim(),
      status: evidenceForm.elements.status.value,
      note: evidenceForm.elements.note.value.trim() || undefined,
    }), '外部证据已登记');
    return;
  }
  const filter = event.target.closest('[data-asset-filter]');
  if (filter) {
    event.preventDefault();
    const url = new URL(window.location.href);
    const query = filter.elements.q.value.trim();
    query ? url.searchParams.set('q', query) : url.searchParams.delete('q');
    filter.elements.owner.value ? url.searchParams.set('owner', filter.elements.owner.value.trim()) : url.searchParams.delete('owner');
    filter.elements.productId.value ? url.searchParams.set('productId', filter.elements.productId.value) : url.searchParams.delete('productId');
    filter.elements.status?.value ? url.searchParams.set('status', filter.elements.status.value) : url.searchParams.delete('status');
    url.searchParams.set('page','1');
    window.history.pushState({ view: 'assets' }, document.title, url);
    await loadAssetCatalog();
    return;
  }
  const createForm = event.target.closest('[data-asset-create-form]');
  if (createForm) {
    event.preventDefault();
    const button=createForm.querySelector('button[type="submit"]'), status=createForm.querySelector('[data-asset-form-status]'); button.disabled=true;
    try { const saved=await createAsset({name:createForm.elements.name.value.trim(),productId:createForm.elements.productId.value,ownerA:principalFromSelect(createForm.elements.ownerA),ownerB:principalFromSelect(createForm.elements.ownerB),externalVisible:createForm.elements.externalVisible.checked,summary:createForm.elements.summary.value.trim()}); createForm.closest('dialog').close(); const url=new URL(window.location.href); url.searchParams.set('handbookId',saved.handbookId); window.history.pushState({view:'assets'},'',url); await loadAssetCatalog(); }
    catch(error){status.textContent=error.message;} finally{button.disabled=false;} return;
  }
  const assetArchiveForm = event.target.closest('[data-asset-archive-confirm-form]');
  if (assetArchiveForm) {
    event.preventDefault();
    const dialog = assetArchiveForm.closest('[data-asset-archive-dialog]');
    const submit = assetArchiveForm.querySelector('button[type="submit"]');
    const cancelControls = assetArchiveForm.querySelectorAll('[data-asset-archive-cancel]');
    const status = assetArchiveForm.querySelector('[data-asset-archive-status]');
    const originalText = submit.textContent;
    assetArchiveForm.dataset.busy = 'true';
    submit.disabled = true;
    cancelControls.forEach(control => { control.disabled = true; });
    submit.textContent = '正在停用…';
    status.textContent = '';
    try {
      await archiveAsset(assetArchiveForm.dataset.assetArchive);
      dialog.close();
      assetArchiveManageDialog = null;
      assetArchiveTrigger = null;
      await loadAssetCatalog();
      showAppNotice('手册已从在用资产和阶段统计中隐藏，历史关系继续保留。', {
        title: '停用完成',
        tone: 'success',
        actionLabel: '查看已停用资产',
        actionHref: '/knowledge-center/assets?lifecycle=inactive',
      });
    } catch (error) {
      status.textContent = error.message || '停用失败，请稍后重试。';
      delete assetArchiveForm.dataset.busy;
      submit.disabled = false;
      cancelControls.forEach(control => { control.disabled = false; });
      submit.textContent = originalText;
      submit.focus();
    }
    return;
  }
  const mappingForm = event.target.closest('[data-repository-mapping-form]');
  if (mappingForm) {
    event.preventDefault();
    const button = mappingForm.querySelector('button[type="submit"]');
    const status = mappingForm.querySelector('[data-asset-form-status]');
    button.disabled = true;
    status.textContent = '正在保存…';
    try {
      await saveHandbookRepositoryMapping(mappingForm.dataset.handbookId, {
        connectionId: mappingForm.elements.connectionId.value,
        defaultBranch: mappingForm.elements.defaultBranch.value.trim(),
        enabledBranches: appState.mappingState.enabledBranches,
        zhPaths: appState.mappingState.zhPaths,
        enPaths: appState.mappingState.enPaths,
      });
      status.textContent = '✓ 映射已保存';
      mappingForm.closest('dialog').close();
      await loadAssetCatalog();
    } catch (error) { status.textContent = error.message || '保存失败'; }
    finally { button.disabled = false; }
    return;
  }
  const assetForm = event.target.closest('[data-asset-edit-form]');
  if (assetForm) {
    event.preventDefault(); const id=assetForm.dataset.assetEdit; const button=assetForm.querySelector('button[type="submit"]'); const status=assetForm.querySelector('[data-asset-form-status]');
    button.disabled = true;
    try {
      const current = appState.assetCatalog?.items?.find(item => String(item.handbookId) === String(id));
      const statusChanged = assetForm.elements.status.value !== current?.status;
      const reason = assetForm.elements.statusReason.value.trim();
      if (statusChanged && !reason) throw new Error('修改手册状态时必须填写变更原因');
      let saved = await updateAsset(id, {
        name: assetForm.elements.name.value.trim(),
        ownerA: principalFromSelect(assetForm.elements.ownerA),
        ownerB: principalFromSelect(assetForm.elements.ownerB),
        expectedVersion: Number(assetForm.dataset.assetVersion),
      });
      if (statusChanged) {
        saved = await updateAssetStatus(id, { targetStatus: assetForm.elements.status.value, reason, expectedVersion: saved.assetVersion });
      }
      assetForm.closest('dialog').close(); await loadAssetCatalog();
    } catch (error) { status.textContent = error.message || '保存失败'; }
    finally { button.disabled = false; }
    return;
  }
  const form = event.target.closest('[data-outline-import]');
  if (!form) return;
  event.preventDefault();
  const files = Array.from(form.elements.file?.files || []);
  const handbookId = String(form.dataset.handbookId || '').trim();
  const status = form.querySelector('[data-outline-import-status]');
  const results = form.querySelector('[data-outline-import-results]');
  const validateOnly = Boolean(event.submitter?.matches('[data-outline-validate]'));
  const buttons = form.querySelectorAll('button[type="submit"]');
  if (!files.length) { status.textContent = '请选择要导入的文件'; return; }
  buttons.forEach(button => { button.disabled = true; });
  if (results) results.innerHTML = '';
  const succeeded = [];
  try {
    for (const [index, file] of files.entries()) {
      status.textContent = `正在${validateOnly ? '校验' : '导入'} ${index + 1}/${files.length}：${file.name}`;
      const row = document.createElement('li');
      row.textContent = `${file.name}：解析中`;
      results?.appendChild(row);
      const payload = new FormData();
      payload.append('file', file);
      payload.append('handbookId', handbookId);
      try {
        let response;
        try {
          response = await (validateOnly ? validateOutline(payload) : importOutline(payload));
        } catch (error) {
          const duplicate = error?.payload?.data?.items?.find(item => item.status === 'duplicate_confirmation_required');
          if (!duplicate || !window.confirm(`文件“${file.name}”已有候选版本，是否仍然导入？`)) throw error;
          const retry = new FormData(); retry.append('file', file); retry.append('handbookId', handbookId); retry.append('confirmDuplicate', 'true');
          response = await importOutline(retry);
        }
        const candidate = response?.data || {};
        row.textContent = validateOnly ? `${file.name}：校验通过，${candidate.documentCount}篇文档；尚未创建候选。` : `${file.name}：导入成功，${candidate.name || '候选大纲已创建'}`;
        succeeded.push(candidate);
      } catch (error) {
        row.textContent = `${file.name}：${validateOnly ? '校验' : '导入'}未通过，${error?.message || '请稍后重试'}`;
        const issues = error?.payload?.data?.errors || error?.payload?.error?.details ||
          (error?.payload?.data?.items || []).flatMap(item => item.error?.details || []);
        if (Array.isArray(issues) && issues.length) {
          const list = document.createElement('ul');
          for (const issue of issues) {
            const entry = document.createElement('li');
            entry.textContent = `${issue.row ? `第${issue.row}行 · ` : ''}${issue.column || issue.field || '文件'}：${issue.message || ''}${issue.path ? `（${issue.path}）` : ''}${issue.suggestion ? `；建议：${issue.suggestion}` : ''}`;
            list.appendChild(entry);
          }
          row.appendChild(list);
        }
      }
    }
    status.textContent = `${validateOnly ? '校验' : '导入'}完成：通过 ${succeeded.length} 个，未通过 ${files.length - succeeded.length} 个`;
    if (validateOnly || !succeeded.length) return;
    appState.outlineProjection = null;
    const latest = succeeded[succeeded.length - 1];
    if (latest?.id || latest?.handbookId) {
      const id = latest.handbookId || latest.id;
      const detailUrl = new URL(`/knowledge-center/outlines/${encodeURIComponent(id)}`, window.location.origin);
      if (latest.id) detailUrl.searchParams.set('version', latest.id);
      window.history.pushState({ view: 'outlines' }, '', `${detailUrl.pathname}${detailUrl.search}`);
    }
    await loadOutlines();
  } finally { buttons.forEach(button => { button.disabled = false; }); }
});



// 滚动时隐藏选区气泡（避免位置偏移）
document.addEventListener('scroll', () => {
  const bubble = document.querySelector('[data-review-selection-bubble]');
  if (bubble && !bubble.hidden) bubble.hidden = true;
}, true);

document.addEventListener('change', async event => {
  const reviewHandbookSelect = event.target.closest('[data-review-handbook-select]');
  if (reviewHandbookSelect) {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ handbookId: reviewHandbookSelect.value }).toString();
    window.history.pushState({ view: 'review', handbookId: reviewHandbookSelect.value }, document.title, url);
    loadReviewWorkspace();
    return;
  }
  const reviewTaskSelect = event.target.closest('[data-review-task-select]');
  if (reviewTaskSelect) {
    const url = new URL(window.location.href);
    url.searchParams.set('taskId', reviewTaskSelect.value);
    url.searchParams.delete('path');
    url.searchParams.delete('branch');
    window.history.pushState({ view: 'review', taskId: reviewTaskSelect.value }, document.title, url);
    loadReviewWorkspace(reviewTaskSelect.value);
    return;
  }
  const reviewBranch = event.target.closest('[data-review-branch]');
  if (!reviewBranch) return;
  const url = new URL(window.location.href); url.searchParams.set('branch', reviewBranch.value); url.searchParams.delete('path'); window.history.pushState({ view: 'review', branch: reviewBranch.value }, '', url); loadReviewWorkspace(url.searchParams.get('taskId'));
});


document.addEventListener('click', async event => {
  if (event.target.closest('[data-handbook-directory-open]')) {
    setHandbookDrawerState('directory', !handbookUi().directoryDrawerOpen);
    requestAnimationFrame(() => document.querySelector('.handbook-production-directory.is-open [data-handbook-directory-search]')?.focus());
    return;
  }
  if (event.target.closest('[data-handbook-directory-close]')) {
    setHandbookDrawerState('directory', false);
    requestAnimationFrame(() => document.querySelector('[data-handbook-directory-open]')?.focus());
    return;
  }
  const assistantTab = event.target.closest('[data-handbook-assistant-tab]');
  if (assistantTab) {
    const active = assistantTab.dataset.handbookAssistantTab;
    handbookUi().assistantTab = active;
    const panel = assistantTab.closest('.handbook-assistant-panel');
    panel?.querySelectorAll('[data-handbook-assistant-tab]').forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.handbookAssistantTab === active)));
    panel?.querySelectorAll('[data-handbook-assistant-content]').forEach(content => { content.hidden = content.dataset.handbookAssistantContent !== active; });
    return;
  }

  if (event.target.closest('[data-handbook-assistant-open]')) {
    setHandbookDrawerState('assistant', true);
    requestAnimationFrame(() => document.querySelector('.handbook-assistant-panel.is-open [role="tab"]')?.focus());
    return;
  }

  if (event.target.closest('[data-handbook-assistant-close]')) {
    setHandbookDrawerState('assistant', false);
    requestAnimationFrame(() => document.querySelector('[data-handbook-assistant-open]')?.focus());
    return;
  }

  const aiAction = event.target.closest('[data-handbook-ai-action]');
  if (aiAction) {
    await openHandbookWriting(aiAction.dataset.handbookAiAction, aiAction);
    return;
  }

  const documentButton = event.target.closest('[data-handbook-document]');
  if (documentButton) {
    const currentId = document.querySelector('[data-handbook-current-document]')?.dataset.handbookCurrentDocument || '';
    if (currentId !== documentButton.dataset.handbookDocument && handbookUi().dirtyDocuments?.includes(currentId) && !window.confirm('当前文档有未保存修改，切换后将丢失这些修改。确认继续？')) return;
    if (currentId && currentId !== documentButton.dataset.handbookDocument) {
      delete handbookUi().drafts[currentId];
      delete handbookUi().draftHtml[currentId];
      delete handbookUi().draftBranchByDocument[currentId];
      updateHandbookUiList('dirtyDocuments', currentId, false);
    }
    updateHandbookRoute({ documentId: documentButton.dataset.handbookDocument });
    if (window.matchMedia('(max-width: 1000px)').matches) handbookUi().directoryDrawerOpen = false;
    loadIncrementalWorkspace();
    return;
  }

  const modeButton = event.target.closest('[data-handbook-mode]');
  if (modeButton) {
    const documentId = modeButton.dataset.documentId;
    handbookUi().modeByDocument[documentId] = modeButton.dataset.handbookMode;
    render();
    return;
  }

  const formatButton = event.target.closest('[data-handbook-editor-format]');
  if (formatButton) {
    const documentId = formatButton.dataset.documentId || document.querySelector('[data-handbook-current-document]')?.dataset.handbookCurrentDocument;
    if (!documentId) return;
    if (activeHandbookVditor(documentId)) {
      handbookUi().drafts[documentId] = handbookVditor.getValue();
      try {
        handbookUi().draftHtml[documentId] = handbookVditor.getHTML?.() || '';
      } catch {
        handbookUi().draftHtml[documentId] = handbookUi().draftHtml?.[documentId] || '';
      }
    } else {
      const markdownInput = document.querySelector(`[data-handbook-markdown-editor][data-document-id="${CSS.escape(documentId)}"]`);
      if (markdownInput) syncHandbookMarkdownInput(markdownInput);
    }
    handbookUi().editorFormatByDocument[documentId] = formatButton.dataset.handbookEditorFormat;
    render();
    return;
  }

  const markdownPreviewToggle = event.target.closest('[data-handbook-markdown-preview-toggle]');
  if (markdownPreviewToggle) {
    const documentId = markdownPreviewToggle.dataset.handbookMarkdownPreviewToggle;
    const input = document.querySelector(`[data-handbook-markdown-editor][data-document-id="${CSS.escape(documentId)}"]`);
    if (input) syncHandbookMarkdownInput(input);
    handbookUi().markdownPreviewByDocument[documentId] = !handbookUi().markdownPreviewByDocument?.[documentId];
    render();
    return;
  }

  if (event.target.closest('[data-handbook-focus-toggle]')) {
    handbookUi().assistantOpen = false;
    handbookUi().directoryDrawerOpen = false;
    handbookUi().focusMode = !handbookUi().focusMode;
    render();
    requestAnimationFrame(() => document.querySelector('[data-handbook-focus-toggle]')?.focus());
    return;
  }

  const directoryModeButton = event.target.closest('[data-handbook-directory-mode]');
  if (directoryModeButton) {
    if (!confirmLeavingHandbookDraft()) return;
    const currentId = document.querySelector('[data-handbook-current-document]')?.dataset.handbookCurrentDocument || '';
    if (currentId && handbookUi().dirtyDocuments?.includes(currentId)) {
      delete handbookUi().drafts[currentId];
      updateHandbookUiList('dirtyDocuments', currentId, false);
    }
    updateHandbookRoute({ view: directoryModeButton.dataset.handbookDirectoryMode });
    render();
    return;
  }

  const saveButton = event.target.closest('[data-handbook-draft-save]');
  if (saveButton) {
    saveCurrentHandbookDraft(saveButton.dataset.handbookDraftSave);
    return;
  }

  const discardButton = event.target.closest('[data-handbook-discard]');
  if (discardButton) {
    const documentId = discardButton.dataset.handbookDiscard;
    if (!window.confirm('确认取消当前页面中的修改？')) return;
    discardLocalHandbookChanges(documentId);
    return;
  }

  const historyButton = event.target.closest('[data-handbook-history]');
  if (historyButton) { openHandbookHistory(historyButton.dataset.handbookHistory); return; }
  const historyCompare = event.target.closest('[data-handbook-history-compare]');
  if (historyCompare) {
    const history = handbookUi().history;
    if (history) handbookUi().history = { ...history, compareRevisionId: historyCompare.dataset.handbookHistoryCompare };
    render();
    requestAnimationFrame(() => document.querySelector('[data-handbook-history-dialog]')?.showModal());
    return;
  }
  if (event.target.closest('[data-handbook-history-close]')) { event.target.closest('dialog')?.close(); return; }
  const historyRestore = event.target.closest('[data-handbook-history-restore]');
  if (historyRestore) {
    const documentId = handbookUi().history?.documentId;
    const current = handbookUi().serverDrafts?.[documentId];
    restoreHandbookDraftRevision(handbookDraftContext(documentId), { revisionId: historyRestore.dataset.handbookHistoryRestore, editVersion: current?.draft?.editVersion || 0 })
      .then(result => {
        handbookUi().serverDrafts[documentId] = result;
        handbookUi().drafts[documentId] = result.draft.revision.markdown;
        handbookUi().draftHtml[documentId] = result.draft.revision.htmlSnapshot;
        handbookUi().history = null; render(); showAppNotice(`已创建草稿 v${result.draft.editVersion}。`, { title: '历史版本已恢复' });
      }).catch(error => showAppNotice(error.message, { title: '恢复失败' }));
    return;
  }
  if (event.target.closest('[data-handbook-conflict-close]')) { event.target.closest('dialog')?.close(); return; }
  if (event.target.closest('[data-handbook-conflict-copy]')) {
    navigator.clipboard?.writeText(handbookUi().conflict?.localMarkdown || '');
    showAppNotice('本地 Markdown 已复制。', { title: '复制成功' }); return;
  }
  if (event.target.closest('[data-handbook-conflict-reload]')) {
    const conflict = handbookUi().conflict; const documentId = conflict?.documentId;
    if (conflict?.serverDraft) handbookUi().serverDrafts[documentId] = { exists: true, draft: conflict.serverDraft, capabilities: handbookUi().serverDrafts?.[documentId]?.capabilities || {} };
    handbookUi().conflict = null; discardLocalHandbookChanges(documentId); return;
  }
  if (event.target.closest('[data-handbook-conflict-merge]')) {
    const conflict = handbookUi().conflict; const documentId = conflict?.documentId;
    if (conflict?.serverDraft) handbookUi().serverDrafts[documentId] = { exists: true, draft: conflict.serverDraft, capabilities: handbookUi().serverDrafts?.[documentId]?.capabilities || {} };
    handbookUi().drafts[documentId] = conflict?.localMarkdown || '';
    handbookUi().draftHtml[documentId] = conflict?.localHtml || '';
    handbookUi().conflict = null; handbookUi().modeByDocument[documentId] = 'edit'; updateHandbookUiList('dirtyDocuments', documentId, true); render(); return;
  }

  const reviewCurrent = event.target.closest('[data-handbook-review-current]');
  if (reviewCurrent) {
    const documentId = reviewCurrent.dataset.handbookReviewCurrent;
    if (handbookReviewAction(documentId, handbookUi()).disabled) return;
    if (handbookUi().dirtyDocuments?.includes(documentId) && !await saveCurrentHandbookDraft(documentId)) return;
    const ui = handbookUi();
    const scope = handbookDraftContext(documentId);
    const isCurrent = () => ui === handbookUi() && JSON.stringify(handbookDraftContext(documentId)) === JSON.stringify(scope);
    ui.selectedForReview = [documentId];
    ui.reviewDraftSummaries = {};
    ui.reviewSelectionStatus = '正在读取已保存草稿…';
    render();
    document.querySelector('[data-handbook-review-selection-dialog]')?.showModal();
    try {
      const result = await loadHandbookReviewDrafts(scope.handbookId);
      if (!isCurrent()) return;
      ui.reviewDraftSummaries = Object.fromEntries((result.items || [])
        .filter(item => String(item.handbookId) === String(scope.handbookId) && item.outlineVersionId === scope.outlineVersionId && item.branch === scope.branch)
        .map(item => [item.documentId, item]));
      ui.reviewSelectionStatus = '';
    } catch (error) {
      if (!isCurrent()) return;
      ui.reviewSelectionStatus = `草稿列表读取失败，请关闭后重试：${error.message}`;
    }
    if (!document.querySelector('[data-handbook-review-selection-dialog]')?.open) return;
    render();
    document.querySelector('[data-handbook-review-selection-dialog]')?.showModal();
    return;
  }
  const reviewSubmit = event.target.closest('[data-handbook-review-submit]');
  if (reviewSubmit) {
    const selectedCount = handbookUi().selectedForReview?.length || 0;
    if (!selectedCount) return;
    const ui = handbookUi();
    const selected = [...ui.selectedForReview];
    const scope = JSON.stringify(handbookDraftContext());
    reviewSubmit.disabled = true;
    await Promise.all(selected.map(id => loadSharedHandbookDraft(id, () => ui === handbookUi() && JSON.stringify(handbookDraftContext()) === scope)));
    if (ui !== handbookUi() || JSON.stringify(handbookDraftContext()) !== scope) return;
    if (selected.some(id => !ui.serverDrafts?.[id]?.exists || ui.dirtyDocuments?.includes(id) || handbookReviewAction(id, ui).disabled)) {
      const status = document.querySelector('[data-handbook-review-selection-status]');
      if (status) status.textContent = '部分草稿未保存、读取失败或无送审权限，请检查后重试。';
      reviewSubmit.disabled = false;
      return;
    }
    const dialog = document.querySelector('[data-handbook-review-dialog]');
    const count = dialog?.querySelector('[data-handbook-review-count]');
    if (count) count.textContent = `已选择 ${selectedCount} 篇文档`;
    document.querySelector('[data-handbook-review-selection-dialog]')?.close();
    openHandbookReviewDialog();
    return;
  }

  const reviewClose = event.target.closest('[data-handbook-review-close]');
  if (reviewClose) {
    reviewClose.closest('dialog')?.close();
    requestAnimationFrame(() => document.querySelector('.handbook-more-menu > summary')?.focus());
    return;
  }

});

document.addEventListener('change', async event => {
  const reviewDocument = event.target.closest('[data-handbook-review-document]');
  if (reviewDocument) {
    if (reviewDocument.disabled) return;
    updateHandbookUiList('selectedForReview', reviewDocument.value, reviewDocument.checked);
    const next = document.querySelector('[data-handbook-review-submit]');
    if (next) next.disabled = !handbookUi().selectedForReview.length;
    return;
  }
  const attachmentInput = event.target.closest('[data-handbook-attachment]');
  if (attachmentInput) {
    const documentId = document.querySelector('[data-handbook-current-document]')?.dataset.handbookCurrentDocument || '';
    await uploadFilesIntoHandbookDraft(documentId, [...(attachmentInput.files || [])]);
    attachmentInput.value = '';
    return;
  }
  const templateSelect = event.target.closest('[data-handbook-template]');
  if (templateSelect) {
    const documentId = templateSelect.dataset.documentId;
    const templateId = templateSelect.value;
    handbookUi().templateByDocument[documentId] = templateId;
    handbookUi().templateStatus = handbookUi().draftHtml?.[documentId] !== undefined
      ? '模板已更新，当前草稿保持不变。'
      : '正在读取模板…';
    render();
    if (templateId && !handbookUi().templateDetails[templateId]) {
      try {
        const detail = (await loadTemplate(templateId))?.data;
        if (detail) handbookUi().templateDetails[templateId] = detail;
        handbookUi().templateStatus = handbookUi().draftHtml?.[documentId] !== undefined
          ? '模板已更新，当前草稿保持不变。'
          : '';
      } catch (error) {
        handbookUi().templateStatus = error?.message || '模板读取失败，请稍后重试。';
      }
    } else if (handbookUi().draftHtml?.[documentId] === undefined) {
      handbookUi().templateStatus = '';
    }
    render();
    return;
  }

  const branchSelect = event.target.closest('[data-handbook-branch]');
  if (branchSelect) {
    const currentId = document.querySelector('[data-handbook-current-document]')?.dataset.handbookCurrentDocument || '';
    if (currentId && handbookUi().dirtyDocuments?.includes(currentId) && !window.confirm('当前文档有未保存草稿，切换分支后将放弃未保存修改。确认继续？')) {
      render();
      return;
    }
    if (currentId) {
      delete handbookUi().drafts[currentId];
      delete handbookUi().draftHtml[currentId];
      delete handbookUi().draftBranchByDocument[currentId];
      updateHandbookUiList('dirtyDocuments', currentId, false);
    }
    const url = new URL(window.location.href);
    url.searchParams.set('branch', branchSelect.value);
    url.searchParams.delete('documentId');
    window.history.pushState({ view: 'production', branch: branchSelect.value }, '', url);
    loadIncrementalWorkspace();
    return;
  }

});

document.addEventListener('submit', async event => {
  const reviewForm = event.target.closest('[data-handbook-review-form]');
  if (reviewForm) {
    event.preventDefault();
    if (!reviewForm.reportValidity()) return;
    const handbookId = productionRouteState().handbookId;
    const reviewerId = reviewForm.elements.reviewerId.value;
    const selected = [...(handbookUi().selectedForReview || [])];
    const status = reviewForm.querySelector('[data-handbook-review-dialog-status]');
    const submit = reviewForm.querySelector('[type="submit"]');
    submit.disabled = true; status.textContent = '正在创建增量审核任务…';
    try {
      const documents = selected.map(documentId => {
        const context = handbookDraftContext(documentId);
        const draft = handbookUi().serverDrafts?.[documentId]?.draft;
        const override = reviewForm.querySelector(`[data-handbook-review-override="${CSS.escape(documentId)}"]`)?.value;
        return { documentId, outlineVersionId: context.outlineVersionId, branch: context.branch, draftRevisionId: draft?.currentRevisionId, filePath: reviewForm.querySelector(`[data-handbook-review-path="${CSS.escape(documentId)}"]`)?.value.trim(), reviewerIds: [override || reviewerId] };
      });
      const businessVersion = String(handbookUi().repository?.businessVersion || handbookUi().repository?.databaseVersion || '').trim();
      const revisionTaskIds = [...new Set(selected
        .map(documentId => handbookUi().serverDrafts?.[documentId]?.draft?.reviewState?.taskId)
        .filter(Boolean))];
      const revisionOfTaskId = revisionTaskIds.length === 1 ? revisionTaskIds[0] : undefined;
      const result = await createHandbookIncrementalReview(handbookId, {
        businessVersion, documents, defaultReviewerIds: [reviewerId], note: reviewForm.elements.note.value.trim(),
        ...(revisionOfTaskId ? { revisionOfTaskId } : {}),
      });
      let associationError = null;
      const taskNumber = new URL(window.location.href).searchParams.get('taskNumber');
      const reviewTaskId = result.tasks?.[0]?.id;
      if (taskNumber) {
        try {
          if (!reviewTaskId) throw new Error('审核服务未返回任务编号');
          let ticket = await loadDocumentTask(taskNumber);
          const book = ticket.decomposition?.handbooks?.find(item => item.id === handbookId);
          const assignedDocuments = documents.map(document => book?.documents?.find(item =>
            String(item.createdDocumentId || item.id) === String(document.documentId)));
          if (assignedDocuments.some(item => !item) || new Set(assignedDocuments.map(item => item?.id)).size !== documents.length) {
            throw new Error('送审文档与当前工单范围不一致');
          }
          for (const assigned of assignedDocuments) {
            ticket = await taskWrite(`/${encodeURIComponent(taskNumber)}/documents/${encodeURIComponent(assigned.id)}/link`, {
              expectedRevision: ticket.revision, handbookId, reviewTaskId,
            }, 'POST');
          }
        } catch (error) { associationError = error; }
      }
      handbookUi().selectedForReview = [];
      handbookUi().reviewState = { status: 'submitted', taskId: result.tasks?.[0]?.id, reviewHref: result.reviewHref, message: '审核任务已创建，可查看审核任务。' };
      await Promise.all(selected.map(documentId => loadSharedHandbookDraft(documentId)));
      reviewForm.closest('dialog')?.close();
      render();
      showAppNotice(associationError
        ? `审核任务已创建，但工单关联未完成：${associationError.message}。请在任务管理中核对并关联审核任务 ${reviewTaskId || '（编号待查询）'}。`
        : '审核任务已创建，点击“查看审核任务”进入审核与 MR 发布。', { title: associationError ? '请补充关联' : '提交成功' });
    } catch (error) {
      status.textContent = `提交失败：${error.message}`;
      submit.disabled = false;
    }
    return;
  }

});

const reviewUiStorage = {
  directoryCollapsed: 'knowledge-center-review-directory-collapsed',
  directoryWidth: 'knowledge-center-review-directory-width',
  readingDensity: 'knowledge-center-review-reading-density',
};

function saveReviewUi() {
  try {
    localStorage.setItem(reviewUiStorage.directoryCollapsed, String(appState.reviewUi.directoryCollapsed));
    localStorage.setItem(reviewUiStorage.directoryWidth, String(appState.reviewUi.directoryWidth));
    localStorage.setItem(reviewUiStorage.readingDensity, appState.reviewUi.readingDensity);
  } catch (_) { /* 存储不可用或配额已满，降级到内存状态 */ }
}

function restoreReviewUi() {
  try {
    appState.reviewUi.directoryCollapsed = localStorage.getItem(reviewUiStorage.directoryCollapsed) === 'true';
    appState.reviewUi.directoryWidth = Math.min(420, Math.max(220, Number(localStorage.getItem(reviewUiStorage.directoryWidth)) || 260));
  } catch (_) { /* 存储不可用，使用内存默认值 */ }
  // 审核阅读区统一使用舒适型排版；清理旧版本可能保存的 compact 偏好。
  appState.reviewUi.readingDensity = 'comfortable';
  try { localStorage.setItem(reviewUiStorage.readingDensity, 'comfortable'); } catch (_) { /* 存储不可用 */ }
}

document.addEventListener('keydown', event => {
  const gitlabDrawer = document.querySelector('.gitlab-connection-drawer');
  if (gitlabDrawer && event.key === 'Escape') {
    event.preventDefault();
    const id = appState.gitlabListState.selectedConnectionId;
    appState.gitlabListState.drawerOpen = false;
    render();
    requestAnimationFrame(() => [...document.querySelectorAll('[data-gitlab-connection]')].find(button => button.dataset.gitlabConnection === id)?.focus());
    return;
  }
  if (gitlabDrawer && event.key === 'Tab') {
    const focusable = [...gitlabDrawer.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)')];
    const first = focusable[0], last = focusable.at(-1);
    if (!gitlabDrawer.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && appState.activeView === 'production') {
    event.preventDefault();
    const documentId = handbookVditorDocumentId || document.querySelector('[data-handbook-markdown-editor]')?.dataset.documentId;
    if (documentId && handbookUi().dirtyDocuments?.includes(documentId)) saveCurrentHandbookDraft(documentId);
    return;
  }
  if (event.key === 'Escape' && appState.activeView === 'production' && handbookUi().focusMode && !document.querySelector('dialog[open]')) {
    handbookUi().focusMode = false;
    render();
    return;
  }
  if (event.key === 'Escape' && appState.activeView === 'production' && handbookUi().assistantOpen && !document.querySelector('dialog[open]')) {
    setHandbookDrawerState('assistant', false);
    requestAnimationFrame(() => document.querySelector('[data-handbook-assistant-open]')?.focus());
    return;
  }
  if (event.key === 'Escape' && appState.activeView === 'production' && handbookUi().directoryDrawerOpen && !document.querySelector('dialog[open]')) {
    setHandbookDrawerState('directory', false);
    requestAnimationFrame(() => document.querySelector('[data-handbook-directory-open]')?.focus());
    return;
  }
  if (appState.activeView !== 'review' || event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  if (event.key === 'Escape' && appState.reviewUi.focusMode) { appState.reviewUi.focusMode = false; render(); return; }
  const step = new URLSearchParams(window.location.search).get('step') || 'read';
  const selector = step === 'diff' && ['j', 'k'].includes(event.key.toLowerCase()) ? '[data-review-line]' : step === 'opinions' && ['[', ']'].includes(event.key) ? '.review-opinion' : '';
  if (!selector) return;
  const items = [...document.querySelectorAll(selector)];
  if (!items.length) return;
  event.preventDefault();
  const current = items.findIndex(item => item.classList.contains('keyboard-current'));
  const forward = ['j', ']'].includes(event.key.toLowerCase());
  const index = current < 0 ? (forward ? 0 : items.length - 1) : Math.min(items.length - 1, Math.max(0, current + (forward ? 1 : -1)));
  items.forEach((item, itemIndex) => item.classList.toggle('keyboard-current', itemIndex === index));
  items[index].scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  items[index].focus?.();
});

document.addEventListener('input', event => {
  const handbookMarkdownInput = event.target.closest('[data-handbook-markdown-editor]');
  if (handbookMarkdownInput) {
    resizeHandbookMarkdownInput(handbookMarkdownInput);
    syncHandbookMarkdownInput(handbookMarkdownInput);
    return;
  }
  const databaseField = event.target.closest('[data-database-field]');
  if (databaseField) {
    syncDatabaseConnectionDraft(databaseField.closest('[data-database-dialog]'));
    return;
  }
  const principalSearch = event.target.closest('[data-principal-search]');
  if (principalSearch) {
    appState.principalListState.search = principalSearch.value;
    clearTimeout(principalSearchTimer);
    principalSearchTimer = setTimeout(() => {
      render();
      const next = document.querySelector('[data-principal-search]');
      next?.focus(); next?.setSelectionRange(next.value.length, next.value.length);
    }, 120);
    return;
  }
  return;
});

// 阅读文档中的选区评论：仅在能找到候选文档和稳定节点时生成行级锚点。
// 阅读文档中的选区评论：选中文字 → 浮动气泡 → 内联批注输入框
document.addEventListener('mouseup', event => {
  const content = event.target.closest?.('.review-document-content .repository-markdown');
  const bubble = document.querySelector('[data-review-selection-bubble]');
  // 如果点击的是气泡本身或内联批注输入框，不处理
  if (event.target.closest?.('[data-review-bubble-trigger], .review-inline-input-box')) return;
  if (!bubble) return;
  // 清除选区时也隐藏气泡
  const selection = window.getSelection?.();
  const selectedText = selection?.toString().trim() || '';
  if (!selectedText || !content) { bubble.hidden = true; return; }
  // 计算选区坐标，显示气泡
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (!range) return;
  if (!content.contains(range.startContainer) || !content.contains(range.endContainer)) { bubble.hidden = true; return; }
  const rect = range.getBoundingClientRect();
  bubble.hidden = false;
  const bubbleContainer = content.closest('.review-document-content');
  const contentRect = bubbleContainer.getBoundingClientRect();
  bubble.style.top = `${Math.max(8, rect.top - contentRect.top + content.scrollTop - 44)}px`;
  bubble.style.left = `${Math.max(8, rect.right - contentRect.left + content.scrollLeft + 4)}px`;
  // 存储选区信息到气泡的 dataset
  const documentId = content.closest('[data-review-document-id]')?.dataset.reviewDocumentId || content.dataset.sourcePath || '';
  const container = selection?.anchorNode?.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection?.anchorNode?.parentElement;
  const node = container?.closest?.('p,li,td,th,pre,h1,h2,h3,h4,h5,h6') || content;
  const blocks = [...content.querySelectorAll('p,li,td,th,pre,h1,h2,h3,h4,h5,h6')];
  const nodeId = node.id || `review-block-${Math.max(0, blocks.indexOf(node))}`;
  const textNodes = bodyNodes(content);
  const text = textNodes.map(node => node.textContent).join('');
  const prefix = range ? document.createRange() : null;
  let startChar = 0;
  if (prefix) { prefix.selectNodeContents(content); prefix.setEnd(range.startContainer, range.startOffset); startChar = prefix.toString().length; }
  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    startChar = range.startOffset;
    for (const node of textNodes) { if (node === range.startContainer) break; startChar += node.length; }
  }
  startChar += range.toString().length - range.toString().trimStart().length;
  const endChar = startChar + selectedText.length;
  if (text.slice(startChar, endChar) !== selectedText) { bubble.hidden = true; showAppNotice('选区包含非正文内容，请重新选择。'); return; }
  const startLine = text.slice(0, startChar).split(/\n/).length;
  const endLine = text.slice(0, endChar).split(/\n/).length;
  const anchor = documentId && nodeId ? {
    documentId, nodeId, anchorKind: 'document_span', textScope: 'rendered_body',
    path: content.dataset.sourcePath || appState.gitlabProjection?.file?.path,
    sourceKind: content.closest('.review-reader-snapshot, .review-reader-fallback') ? 'candidate' : 'repository',
    sourceCommit: content.closest('.review-reader-snapshot, .review-reader-fallback') ? null : appState.gitlabProjection?.commitSha || null,
    lineRange: { startLine, endLine }, charRange: { startChar, endChar }, selectedText,
    contextBefore: text.slice(Math.max(0, startChar - 120), startChar),
    contextAfter: text.slice(endChar, endChar + 120),
  } : null;
  bubble.dataset.anchor = anchor ? JSON.stringify(anchor) : '';
  bubble.dataset.selectedText = selectedText.slice(0, 200);
  bubble.dataset.startLine = String(startLine);
  bubble.dataset.endLine = String(endLine);
});

// 气泡按钮点击 → 在选区位置展开内联批注输入框
document.addEventListener('click', event => {
  const trigger = event.target.closest?.('[data-review-bubble-trigger]');
  if (!trigger) return;
  const bubble = trigger.closest('[data-review-selection-bubble]');
  if (!bubble) return;
  event.preventDefault();
  // 移除已有的内联输入框
  document.querySelectorAll('.review-inline-input-box').forEach(el => el.remove());
  const selectedText = bubble.dataset.selectedText || '';
  const anchor = bubble.dataset.anchor || '';
  if (!anchor) { showAppNotice('无法记录选区位置，请重新选择正文文字。'); return; }
  const startLine = bubble.dataset.startLine || '';
  const endLine = bubble.dataset.endLine || '';
  const content = document.querySelector('.review-document-content');
  if (!content) return;
  // 找到侧栏评论表单获取 taskId 和 reviewId
  const sidebarForm = document.querySelector('[data-review-reader-comment-form]');
  const taskId = sidebarForm?.dataset.taskId || '';
  const reviewId = sidebarForm?.dataset.reviewId || '';
  const candidateDigest = sidebarForm?.querySelector('[name="candidateDigest"]')?.value || '';
  // 创建内联输入框
  const inputBox = document.createElement('div');
  inputBox.className = 'review-inline-input-box';
  inputBox.innerHTML = `<div class="review-inline-input-quote">已选中：${escapeHtml(selectedText.length > 80 ? selectedText.slice(0, 80) + '…' : selectedText || '全文')}</div><form class="review-inline-input-form" data-review-inline-form data-task-id="${escapeHtml(taskId)}" data-review-id="${escapeHtml(reviewId)}"><input type="hidden" name="anchor" value="${escapeHtml(anchor)}"><input type="hidden" name="candidateDigest" value="${escapeHtml(candidateDigest)}"><input type="hidden" name="commentType" value="issue"><input type="hidden" name="severity" value="normal"><textarea name="comment" required placeholder="描述你的意见…" rows="3"></textarea><div class="review-inline-input-actions"><button type="submit" class="button primary compact">提交意见</button><button type="button" class="button secondary compact" data-review-inline-cancel>取消</button></div></form>`;
  // 定位输入框在文档内容区右侧
  const mainContent = content.querySelector('main') || content;
  const bubbleRect = bubble.getBoundingClientRect();
  inputBox.style.top = `${bubbleRect.bottom - content.getBoundingClientRect().top + content.scrollTop}px`;
  mainContent.appendChild(inputBox);
  inputBox.querySelector('textarea')?.focus();
  bubble.hidden = true;
  // 取消按钮
  inputBox.querySelector('[data-review-inline-cancel]')?.addEventListener('click', () => inputBox.remove());
  // 表单提交
  inputBox.querySelector('[data-review-inline-form]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    let anchorObj = null;
    try { anchorObj = form.elements.anchor.value ? JSON.parse(form.elements.anchor.value) : null; } catch (_) { anchorObj = null; }
    try {
      const { commentIncrementalReview } = await import('./common/api/incremental-api.js');
      await commentIncrementalReview(taskId, reviewId, {
        comment: form.elements.comment.value.trim(),
        commentType: form.elements.commentType?.value || 'issue',
        severity: form.elements.severity?.value || 'normal',
        candidateDigest: form.elements.candidateDigest?.value || '',
        ...(anchorObj ? { anchor: anchorObj } : {}),
      });
      inputBox.remove();
      await loadReviewWorkspace(taskId);
    } catch (err) {
      submitBtn.disabled = false;
      const errorEl = form.querySelector('.review-inline-error') || (() => {
        const el = document.createElement('p');
        el.className = 'review-inline-error';
        form.appendChild(el);
        return el;
      })();
      errorEl.textContent = err?.message || '提交失败，请重试。';
    }
  });
});



// 滚动时隐藏选区气泡（避免位置偏移）
document.addEventListener('scroll', () => {
  const bubble = document.querySelector('[data-review-selection-bubble]');
  if (bubble && !bubble.hidden) bubble.hidden = true;
}, true);

document.addEventListener('change', async event => {
  const connectionFilter = event.target.closest('[data-gitlab-status-filter], [data-gitlab-verification-filter]');
  if (connectionFilter) {
    if (connectionFilter.matches('[data-gitlab-status-filter]')) appState.gitlabListState.status = connectionFilter.value;
    else appState.gitlabListState.verificationStatus = connectionFilter.value;
    appState.gitlabListState.page = 1;
    render();
    return;
  }
  const opinionFilter = event.target.closest('[data-review-opinion-filter]');
  if (opinionFilter) {
    document.querySelectorAll('[data-review-opinion]').forEach(opinion => {
      const visible = opinionFilter.value === 'all'
        || (opinionFilter.value === 'open' && opinion.dataset.resolved !== 'true')
        || (opinionFilter.value === 'blocker' && opinion.dataset.severity === 'blocker');
      opinion.hidden = !visible;
    });
    return;
  }
  const gitlabAuthMode = event.target.closest('[data-gitlab-auth-mode]');
  const versionKind = event.target.closest('[data-version-kind]');
  const versionPreset = event.target.closest('[data-version-mapping-preset]');
  if (versionPreset) {
    appState.gitlabListState.mappingCandidateIndex = versionPreset.value === '' ? null : Number(versionPreset.value);
    const form = versionPreset.form;
    const preset = versionPreset.selectedOptions[0]?.dataset;
    if (preset?.product) {
      form.elements.productCode.value = preset.product; form.elements.matchKind.value = preset.kind;
      form.elements.version.value = preset.version; form.elements.branch.value = preset.branch;
      form.querySelector('[data-version-field]').hidden = preset.kind === 'ALL';
      form.elements.version.required = preset.kind !== 'ALL';
    }
    return;
  }
  const versionStatus = event.target.closest('[data-version-mapping-status]');
  if (versionStatus) {
    appState.gitlabListState.mappingStatus = versionStatus.value;
    appState.gitlabListState.mappingPage = 1;
    render(); return;
  }
  if (versionKind) {
    const field = versionKind.form.querySelector('[data-version-field]');
    field.hidden = versionKind.value === 'ALL';
    field.querySelector('input').required = !field.hidden;
    return;
  }
  const versionConnection = event.target.closest('[data-version-connection]');
  if (versionConnection) {
    try {
      const branches = await loadGitLabBranches(versionConnection.value);
      appState.gitlabProjection.mappingBranches = Array.isArray(branches) ? branches : branches?.items || [];
      const list = document.querySelector('#version-branch-options');
      if (list) list.replaceChildren(...appState.gitlabProjection.mappingBranches.map(branch => new Option('', branch.name)));
    } catch (error) { appState.gitlabListState.mappingFeedback = error.message; }
    return;
  }
  if (gitlabAuthMode) {
    const credentialField = gitlabAuthMode.form?.querySelector('[data-gitlab-credential-field]');
    if (credentialField) credentialField.hidden = gitlabAuthMode.value !== 'service_account';
    return;
  }
  const operationType = event.target.closest('[data-incremental-operation-type]');
  if (operationType) {
    const form = operationType.form;
    const type = operationType.value;
    form.querySelectorAll('[data-operation-field="before"]').forEach(field => { field.hidden = !['update', 'delete', 'move'].includes(type); field.querySelector('input').required = !field.hidden; });
    form.querySelectorAll('[data-operation-field="after"]').forEach(field => { field.hidden = !['add', 'update'].includes(type); field.querySelector('textarea').required = !field.hidden; });
    form.querySelectorAll('[data-operation-field="move"]').forEach(field => { field.hidden = type !== 'move'; field.querySelector('input').required = !field.hidden; });
    return;
  }
  const baselineDependency = event.target.closest('[data-incremental-create-form] [name="handbookId"], [data-incremental-create-form] [name="businessVersion"]');
  if (baselineDependency) {
    const form = baselineDependency.form;
    const select = form.elements.baselineVersionId;
    select.replaceChildren(new Option('请重新读取基线', ''));
    select.disabled = true;
    form.querySelector('button[type="submit"]').disabled = true;
    form.querySelector('.incremental-baseline-status').textContent = '手册或业务版本已变更，请重新读取基线。';
    return;
  }
  const baseline = event.target.closest('[data-incremental-create-form] [name="baselineVersionId"]');
  if (baseline) { baseline.form.querySelector('button[type="submit"]').disabled = !baseline.value; return; }
  const size=event.target.closest('[data-asset-page-size]'); if(!size)return; const url=new URL(window.location.href); url.searchParams.set('pageSize',size.value); url.searchParams.set('page','1'); window.history.pushState({view:'assets'},'',url); loadAssetCatalog();
});



// 滚动时隐藏选区气泡（避免位置偏移）
document.addEventListener('scroll', () => {
  const bubble = document.querySelector('[data-review-selection-bubble]');
  if (bubble && !bubble.hidden) bubble.hidden = true;
}, true);

document.addEventListener('change', event => {
  const teamLeader = event.target.closest('[data-team-group-form] [name="leaderPrincipalId"]');
  if (teamLeader) {
    const form = teamLeader.closest('[data-team-group-form]');
    const previousLeaderId = form.dataset.currentLeaderId || '';
    const previousLeader = (appState.principalProjection?.items || []).find(person => String(person.principalId) === String(previousLeaderId));
    const chips = form.querySelector('[data-team-member-chips]');
    if (previousLeaderId && previousLeaderId !== teamLeader.value && previousLeader && !form.querySelector(`[data-team-member-chip="${CSS.escape(previousLeaderId)}"]`)) {
      form.querySelector('[data-team-member-empty]')?.remove();
      const chip = document.createElement('span'); chip.className = 'team-member-chip'; chip.dataset.teamMemberChip = previousLeaderId;
      const label = document.createElement('span'); label.textContent = previousLeader.displayName;
      const remove = document.createElement('button'); remove.type = 'button'; remove.dataset.teamMemberRemove = previousLeaderId; remove.setAttribute('aria-label', `移除成员 ${previousLeader.displayName}`); remove.textContent = '×';
      const hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.name = 'memberPrincipalIds'; hidden.value = previousLeaderId;
      chip.append(label, remove, hidden); chips?.append(chip);
    }
    form.querySelector(`[data-team-member-chip="${CSS.escape(teamLeader.value)}"]`)?.remove();
    form.querySelector(`[data-team-member-candidate] option[value="${CSS.escape(teamLeader.value)}"]`)?.remove();
    if (chips && !chips.querySelector('[data-team-member-chip]')) chips.innerHTML = '<span class="team-member-empty" data-team-member-empty>暂无其他团队成员</span>';
    form.dataset.currentLeaderId = teamLeader.value;
    const status = form.querySelector('[data-team-group-status]'); if (status) status.textContent = '负责人已修改。';
    return;
  }
  const permFilter = event.target.closest('[data-permission-status], [data-permission-role]');
  if (permFilter) {
    if (permFilter.matches('[data-permission-status]')) appState.permissionListState.status = permFilter.value;
    else appState.permissionListState.role = permFilter.value;
    appState.permissionListState.page = 1;
    loadGitLabAdmin();
    return;
  }
  const branch = event.target.closest('[data-repository-branch]');
  if (!branch) return;
  const url = new URL(window.location.href); url.searchParams.set('branch', branch.value); url.searchParams.delete('path'); window.history.pushState({ view: 'repository' }, '', url); loadRepositoryWorkspace();
});

document.addEventListener('input', event => {
  /* ---- GitLab 连接搜索 ---- */
  const gitlabSearch = event.target.closest("[data-gitlab-list-search]");
  if (gitlabSearch) {
    const selectionStart = gitlabSearch.selectionStart;
    const selectionEnd = gitlabSearch.selectionEnd;
    appState.gitlabListState.search = gitlabSearch.value.trim();
    appState.gitlabListState.page = 1;
    render();
    const restored = byId("view-root")?.querySelector("[data-gitlab-list-search]");
    if (restored && restored !== event.target) {
      restored.value = gitlabSearch.value;
      restored.focus();
      if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
        const cursorStart = Math.min(selectionStart, restored.value.length);
        const cursorEnd = Math.min(selectionEnd, restored.value.length);
        restored.setSelectionRange(cursorStart, cursorEnd);
      }
    }
    return;
  }
  /* ---- 用户权限搜索 ---- */
  const permSearch = event.target.closest("[data-permission-search]");
  if (permSearch) {
    if (permissionSearchComposing || event.isComposing) return;
    appState.permissionListState.page = 1;
    refreshPermissionResults(permSearch.value);
    return;
  }
  const input = event.target.closest('[data-outline-search]');
  if (!input) return;
  const query = String(input.value || '').trim().toLowerCase();
  appState.outlineListState.search = input.value.trim();
  const url = new URL(window.location.href);
  appState.outlineListState.search ? url.searchParams.set('q', appState.outlineListState.search) : url.searchParams.delete('q');
  window.history.replaceState({ ...window.history.state, ...appState.outlineListState }, document.title, `${url.pathname}${url.search}`);
  document.querySelectorAll('[data-outline-row]').forEach(row => {
    const status = appState.outlineListState.statusFilter;
    row.hidden = (Boolean(query) && !row.dataset.outlineSearchText.includes(query)) || (Boolean(status) && row.dataset.outlineState !== status);
  });
  const rows = [...document.querySelectorAll('[data-outline-row]')];
  const empty = document.querySelector('[data-outline-filter-empty]');
  if (empty) empty.hidden = rows.some(row => !row.hidden);
});

document.addEventListener('compositionstart', event => {
  if (event.target.closest('[data-permission-search]')) permissionSearchComposing = true;
  if (event.target.closest('[data-production-handbook-search]')) productionSearchComposing = true;
});

document.addEventListener('compositionend', event => {
  const permSearch = event.target.closest('[data-permission-search]');
  if (permSearch) {
    permissionSearchComposing = false;
    refreshPermissionResults(permSearch.value);
  }
  const productionSearch = event.target.closest('[data-production-handbook-search]');
  if (productionSearch) {
    productionSearchComposing = false;
    productionSearch.dispatchEvent(new Event('input', { bubbles: true }));
  }
});



// 滚动时隐藏选区气泡（避免位置偏移）
document.addEventListener('scroll', () => {
  const bubble = document.querySelector('[data-review-selection-bubble]');
  if (bubble && !bubble.hidden) bubble.hidden = true;
}, true);

document.addEventListener('change', event => {
  const nodeFilter = event.target.closest('[data-outline-node-domain-filter], [data-outline-node-owner-filter]');
  if (nodeFilter) {
    updateOutlineNodeRows();
    return;
  }
  const filter = event.target.closest('[data-outline-status-filter]');
  if (!filter) return;
  appState.outlineListState.statusFilter = filter.value;
  const url = new URL(window.location.href);
  filter.value ? url.searchParams.set('status', filter.value) : url.searchParams.delete('status');
  window.history.replaceState({ ...window.history.state, ...appState.outlineListState }, document.title, `${url.pathname}${url.search}`);
  const query = appState.outlineListState.search.toLowerCase();
  document.querySelectorAll('[data-outline-row]').forEach(row => {
    row.hidden = (Boolean(filter.value) && row.dataset.outlineState !== filter.value) || (Boolean(query) && !row.dataset.outlineSearchText.includes(query));
  });
  const rows = [...document.querySelectorAll('[data-outline-row]')];
  const empty = document.querySelector('[data-outline-filter-empty]');
  if (empty) empty.hidden = rows.some(row => !row.hidden);
});

byId('skip-to-main').addEventListener('click', () => byId('main').focus());
byId('retry').addEventListener('click', load);
byId('auth-retry').addEventListener('click', () => bootstrap());
byId('cas-login').addEventListener('click', () => {
  try { startCasLogin(); setAuthBusy(true, '正在跳转统一认证'); } catch (error) { showAuth(error); }
});
byId('admin-login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const username = String(form.get('username') || '').trim();
  const password = String(form.get('password') || '');
  if (!username || !password) { showAuth({ message: '请输入管理员账号和密码' }); return; }
  setAuthBusy(true, '正在验证管理员账号');
  try {
    await submitAdminLogin({ username, password });
    appState.permissionRoleDraft = null;
    showApplication();
    const target = '/knowledge-center/platform';
    const destination = canAccessView('platform') ? target : (firstAccessibleView() ? pathForView(firstAccessibleView()) : '/knowledge-center/');
    window.history.replaceState({}, document.title, destination);
    appState.activeView = viewFromPath(destination) || 'dashboard';
    render();
    scheduleIconLibrary();
    byId('main').focus();
    formElement.reset();
  } catch (error) { showAuth(error); }
});
byId('admin-login-details').addEventListener('toggle', event => {
  if (event.currentTarget.open) byId('admin-username').focus();
});
byId('logout').addEventListener('click', async () => {
  appState.permissionRoleDraft = null;
  byId('logout').disabled = true;
  try { await performLogout(); } catch { clearSession(); }
  if (authState.status !== 'authenticated') showAuth(null, '您已退出登录');
  byId('logout').disabled = false;
});
byId('external-account-open').addEventListener('click', () => {
  byId('external-account-dialog').showModal();
  loadGitLabAccount();
});
byId('external-account-close').addEventListener('click', () => byId('external-account-dialog').close());
byId('external-account-dialog').addEventListener('click', async event => {
  if (event.target === event.currentTarget) { event.currentTarget.close(); return; }
  if (event.target.closest('[data-external-account-retry]')) { await loadGitLabAccount(); return; }
  const disconnect = event.target.closest('[data-external-account-disconnect]');
  if (!disconnect) return;
  disconnect.disabled = true;
  disconnect.textContent = '正在解除…';
  try {
    await disconnectGitLabOAuth(disconnect.dataset.externalAccountDisconnect);
    await loadGitLabAccount();
  } catch (error) {
    appState.gitlabAccountProjection = { status: 'unavailable', error: error.message };
    renderGitLabAccountDialog();
  }
});

onKnowledgeDataChanged(({ scopes }) => load(scopes));
async function loadTaskManagementWorkspace({ retain = false } = {}) {
  if (!retain || !appState.documentTaskProjection) { appState.documentTaskProjection = { status: 'loading', items: [] }; render(); }
  appState.documentTaskProjection = await loadDocumentTaskWorkspace();
  if (appState.activeView === 'documentTasks') render();
}
window.addEventListener('knowledge-center:document-tasks-refresh', loadTaskManagementWorkspace);

const mobileNavigation = window.matchMedia('(max-width: 900px)');

function syncMobileNavigationState() {
  const open = byId('sidebar').classList.contains('open');
  byId('sidebar').setAttribute('aria-hidden', String(mobileNavigation.matches && !open));
  byId('sidebar').inert = mobileNavigation.matches && !open;
  byId('mobile-menu').setAttribute('aria-expanded', String(open));
  byId('main-shell').inert = mobileNavigation.matches && open;
}

function closeMobileNavigation(restoreFocus = true) {
  byId('sidebar').classList.remove('open');
  byId('mobile-overlay').hidden = true;
  syncMobileNavigationState();
  if (restoreFocus && mobileNavigation.matches) byId('mobile-menu').focus();
}

byId('mobile-menu').addEventListener('click', () => {
  byId('sidebar').classList.add('open');
  byId('mobile-overlay').hidden = false;
  syncMobileNavigationState();
  byId('mobile-close').focus();
});
byId('mobile-close').addEventListener('click', () => closeMobileNavigation());
byId('mobile-overlay').addEventListener('click', () => closeMobileNavigation());
document.addEventListener('keydown', event => {
  const productionHandbookRow = event.target.closest?.('[data-production-handbook-row]');
  if (productionHandbookRow && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    productionHandbookRow.click();
    return;
  }
  const outlineContextMenu = document.querySelector('[data-outline-context-menu]:not([hidden])');
  if (event.key === 'Escape' && outlineContextMenu) {
    outlineContextMenu.hidden = true;
    document.querySelector(`[data-outline-document="${CSS.escape(outlineContextMenu.dataset.documentId || '')}"]`)?.focus();
    return;
  }
  const infoDrawer = byId('outline-handbook-info');
  if (event.key === 'Escape' && infoDrawer && !infoDrawer.hidden) {
    document.querySelector('[data-outline-info-close]')?.click();
    return;
  }
  const outlineDocument = event.target.closest?.('[data-outline-document]');
  if (outlineDocument && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) {
    event.preventDefault();
    outlineDocument.click();
    const rect = outlineDocument.getBoundingClientRect();
    openOutlineContextMenu(outlineDocument.dataset.outlineDocument, rect.left + 24, rect.top + 24);
    return;
  }
  const outlineTab = event.target.closest?.('[data-outline-tab]');
  if (outlineTab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const tabs = [...document.querySelectorAll('[data-outline-tab]')];
    const current = tabs.indexOf(outlineTab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next]?.focus();
    tabs[next]?.click();
    return;
  }
  const mobileOpen = mobileNavigation.matches && byId('sidebar').classList.contains('open');
  if (event.key === 'Escape' && mobileOpen) closeMobileNavigation();
  if (event.key === 'Tab' && mobileOpen) {
    const controls = [...byId('sidebar').querySelectorAll('button:not([disabled]), [href], [tabindex="0"]')]
      .filter(control => control.offsetParent !== null);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});
mobileNavigation.addEventListener('change', () => {
  if (!mobileNavigation.matches) closeMobileNavigation(false);
  else syncMobileNavigationState();
});
window.addEventListener('beforeunload', event => {
  if (!hasUnsavedHandbookChanges() && !hasMcpDraft() && !hasModelDraft()) return;
  event.preventDefault();
  event.returnValue = '';
});
window.addEventListener('popstate', event => {
  if (event.handbookWritingReturn) return;
  if (appState.activeView === 'production' && new URLSearchParams(location.search).has('writing')
    && document.querySelector('[data-handbook-current-document]')?.dataset.handbookCurrentDocument === productionRouteState().documentId) {
    render(); return;
  }
  if ((!confirmLeavingMcp() || !confirmLeavingModels())) { window.history.forward(); return; }
  const modelDraftRoot = document.querySelector('[data-model-admin]');
  if (modelDraftRoot) modelDraftRoot.dataset.dirty = 'false';
  const mcpDraftRoot = document.querySelector('[data-mcp-admin]');
  if (mcpDraftRoot) mcpDraftRoot.dataset.dirty = 'false';
  if (!event.handbookWritingReturn && appState.activeView === 'production' && hasUnsavedHandbookChanges() && !confirmLeavingHandbookDraft()) {
    window.history.forward();
    return;
  }
  const previousTab = appState.platformTab;
  const view = viewFromPath(window.location.pathname) || 'dashboard';
  if (view === "platform") appState.platformTab = platformTabFromSearch(window.location.search);
  if (authState.status === 'authenticated') {
    if (event.state?.handbookFrom && view === 'production' && productionRouteState().handbookId) {
      const entry = handbookEntry.get(handbookEntryKey());
      if (entry && appState.activeView === entry.view) captureHandbookSource(entry);
      appState.activeView = 'production';
      collapseSidebarForProduction();
      render();
      loadIncrementalWorkspace();
      return;
    }
    const directEntry = handbookEntry.get(activeHandbookPath);
    if (directEntry && directEntry.url === location.pathname + location.search && appState.activeView === 'production') {
      if (showCachedReturn(view, directEntry)) {
        return;
      }
    }
    if (view === 'assets' && appState.activeView === 'assets' && appState.assetCatalog && assetCatalogQuery().toString() === assetCatalogRouteKey) {
      updateAssetSelection(new URLSearchParams(window.location.search).get('handbookId'));
      return;
    }
    if (view !== 'outlines') appState.outlineProjection = null;
    navigate(view, false);
  }
});
window.addEventListener('knowledge-center:session-expired', () => {
  rememberCurrentTarget();
  clearSession();
  showAuth({ code: 'SESSION_EXPIRED', message: '登录状态已过期，请重新登录。' });
});
window.addEventListener('knowledge-center:permission-denied', () => showAppNotice('当前账号没有执行此操作的权限。'));

const shell = byId('app-shell');
const sidebar = byId('sidebar');
const resizer = byId('sidebar-resizer');
const resizeLabel = byId('resize-label');
let sidebarWidth = Number(localStorage.getItem('knowledge-center-sidebar-width') || 248);
let sidebarHidden = localStorage.getItem('knowledge-center-sidebar-hidden') === 'true';
let sidebarCollapsed = localStorage.getItem('knowledge-center-sidebar-collapsed') === 'true';
let productionSidebarSnapshot = null;

function collapseSidebarForProduction() {
  if (productionSidebarSnapshot) return;
  productionSidebarSnapshot = { sidebarWidth, sidebarHidden, sidebarCollapsed };
  sidebarCollapsed = true;
  sidebarHidden = false;
  applySidebar({ restoring: true });
}

function restoreSidebarAfterProduction() {
  if (!productionSidebarSnapshot) return;
  ({ sidebarWidth, sidebarHidden, sidebarCollapsed } = productionSidebarSnapshot);
  productionSidebarSnapshot = null;
  applySidebar({ restoring: true });
}

function syncSidebarToggleIcon(collapsed) {
  const toggle = byId('sidebar-collapse');
  const current = toggle?.querySelector?.('[data-lucide]');
  if (!current) return;
  const iconName = collapsed ? 'panel-left-open' : 'panel-left';
  if (current.getAttribute('data-lucide') === iconName) return;
  const replacement = document.createElement('i');
  replacement.setAttribute('data-lucide', iconName);
  replacement.setAttribute('aria-hidden', 'true');
  current.replaceWith(replacement);
  window.lucide?.createIcons?.({ nodes: [replacement] });
}

function applySidebar({ restoring = false } = {}) {
  if (restoring) shell.classList.add('sidebar-state-restoring');
  shell.classList.toggle('sidebar-collapsed', sidebarCollapsed);
  shell.classList.toggle('sidebar-hidden', sidebarHidden);
  sidebar.style.setProperty('--sidebar-width', `${sidebarCollapsed ? 64 : sidebarWidth}px`);
  resizer?.setAttribute('aria-valuenow', String(sidebarWidth));
  if (resizeLabel) resizeLabel.textContent = `${sidebarWidth}px`;
  const collapse = byId('sidebar-collapse');
  const collapseLabel = sidebarCollapsed ? '展开导航' : '收缩导航';
  collapse.setAttribute('aria-label', collapseLabel);
  collapse.setAttribute('title', collapseLabel);
  syncSidebarToggleIcon(sidebarCollapsed);
  if (restoring) requestAnimationFrame(() => requestAnimationFrame(() => shell.classList.remove('sidebar-state-restoring')));
}

function saveSidebar() {
  if (!productionSidebarSnapshot) {
    localStorage.setItem('knowledge-center-sidebar-width', String(sidebarWidth));
    localStorage.setItem('knowledge-center-sidebar-hidden', String(sidebarHidden));
    localStorage.setItem('knowledge-center-sidebar-collapsed', String(sidebarCollapsed));
  }
  applySidebar();
}

byId('sidebar-collapse').addEventListener('click', () => {
  localStorage.setItem('knowledge-center-sidebar-user-set', 'true');
  sidebarCollapsed = !sidebarCollapsed;
  sidebarHidden = false;
  saveSidebar();
});
byId('sidebar-hide').addEventListener('click', () => {
  localStorage.setItem('knowledge-center-sidebar-user-set', 'true');
  sidebarHidden = true;
  saveSidebar();
});
byId('sidebar-restore').addEventListener('click', () => {
  localStorage.setItem('knowledge-center-sidebar-user-set', 'true');
  sidebarHidden = false;
  sidebarCollapsed = false;
  saveSidebar();
});

let dragging = false;
resizer?.addEventListener('pointerdown', event => {
  localStorage.setItem('knowledge-center-sidebar-user-set', 'true');
  dragging = true;
  resizer.setPointerCapture(event.pointerId);
});
resizer?.addEventListener('pointermove', event => {
  if (!dragging) return;
  sidebarWidth = Math.min(360, Math.max(200, event.clientX));
  sidebarCollapsed = false;
  sidebarHidden = false;
  applySidebar();
});
resizer?.addEventListener('pointerup', () => {
  dragging = false;
  saveSidebar();
});
resizer?.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    sidebarWidth = Math.min(360, Math.max(200, sidebarWidth + (event.key === 'ArrowRight' ? 16 : -16)));
    saveSidebar();
  }
});

const initialView = viewFromPath(window.location.pathname);
if (initialView) {
  appState.activeView = initialView;
  if (initialView === 'production' && productionRouteState().handbookId) collapseSidebarForProduction();
  if (initialView === "platform") {
    appState.platformTab = platformTabFromSearch(window.location.search);
  }
} else {
  window.history.replaceState({ view: 'dashboard' }, '', pathForView('dashboard'));
}

async function bootstrap() {
  applyBrandIcon();
  let session;
  try {
    session = await bootstrapAuth(status => { byId('auth-status').textContent = status; });
  } catch (error) {
    showAuth(error, '认证服务暂时不可用');
    return;
  }
  if (!session) {
    showAuth(authState.error, authState.status === 'callback' ? '统一认证未完成' : '请选择登录方式');
    return;
  }
  showApplication();
  restoreReviewUi();
  const rememberedTarget = consumeRememberedTarget();
  const remembered = rememberedTarget ? viewFromPath(new URL(rememberedTarget, window.location.origin).pathname) : null;
  const requested = remembered || viewFromPath(window.location.pathname) || 'dashboard';
  const targetView = canAccessView(requested) ? requested : (firstAccessibleView() || 'dashboard');
  if (targetView !== requested) {
    showAppNotice('当前账号没有访问原页面的权限，已打开可访问页面。');
    window.history.replaceState({ view: targetView }, document.title, pathForView(targetView));
  }
  appState.activeView = targetView;
  if (targetView === 'production' && productionRouteState().handbookId) collapseSidebarForProduction();
  ensureRouteStyles(targetView);
  await ensureRenderer(targetView);
  applySidebar();
  syncMobileNavigationState();
  window.lucide?.createIcons();
  // The review loader paints its own loading state; avoid painting it twice.
  if (appState.activeView !== 'review') render();
  const connectionsFirst = appState.activeView === 'platform' && appState.platformTab === 'gitlab' && isPlatformAdmin();
  if (appState.activeView !== 'review' && !connectionsFirst) load(appState.activeView === 'platform' ? ['context', 'overview'] : ['context']);
  if (appState.activeView === 'dashboard') loadMyTasksWorkspace();
  if (appState.activeView === 'outlines') loadOutlines();
  if (appState.activeView === 'assets') loadAssetCatalog();
  if (appState.activeView === 'production') loadIncrementalWorkspace();
  if (appState.activeView === 'documentTasks') loadTaskManagementWorkspace();
  if (appState.activeView === 'review') await loadReviewWorkspace().finally(() => load(['context']));
  if (appState.activeView === 'repository') loadRepositoryWorkspace();
  if (appState.activeView === 'platform') {
    loadGitLabAdmin({ onConnectionsReady: connectionsFirst ? () => { load(['context', 'overview']); loadDatabaseConnectionAdmin(); } : undefined });
    if (!connectionsFirst) loadDatabaseConnectionAdmin();
  }
  if (appState.activeView === 'templates') loadTemplateWorkspace();
  const launchParams = new URLSearchParams(window.location.search);
  if (launchParams.get('externalAccount') === '1') {
    launchParams.delete('externalAccount');
    const cleanUrl = `${window.location.pathname}${launchParams.toString() ? `?${launchParams}` : ''}`;
    window.history.replaceState(window.history.state, document.title, cleanUrl);
    byId('external-account-dialog').showModal();
    loadGitLabAccount();
  }
  scheduleIconLibrary();
}

bootstrap().catch(error => {
  if (authState.status === 'authenticated') showApplicationError(error);
  else showAuth(error, '认证检查未完成，请重试。');
});
import { commentPath, highlightAnchor, bodyNodes, legacyQuote } from './modules/review-publishing/anchors.js';

function restoreReviewAnchor() {
  const id = new URLSearchParams(location.search).get('commentId');
  const root = document.querySelector('.review-document-content .repository-markdown');
  if (!id || !root) return;
  const task = appState.reviewProjection?.detail?.task;
  const comment = task?.reviews?.flatMap(item => item.comments || []).find(item => item.id === id);
  if (!comment?.anchor) { showAppNotice('该意见为全文意见，没有具体位置。'); return; }
  const expected = commentPath(comment.anchor, task, appState.gitlabProjection?.tree || []);
  if (!expected || root.dataset.sourcePath !== expected) return;
  CSS.highlights?.delete('review-anchor');
  const panel = document.createElement('p'); panel.setAttribute('role', 'status');
  panel.dataset.reviewLocationStatus = '';
  document.querySelector('[data-review-location-status]')?.remove();
  root.before(panel);
  const changed = (comment.anchor.sourceCommit && comment.anchor.sourceCommit !== appState.gitlabProjection?.commitSha)
    || (comment.anchor.sourceKind === 'candidate' && comment.candidateDigest !== task.candidate?.digest)
    || (comment.anchor.sourceKind === 'candidate' && !root.closest('.review-reader-snapshot, .review-reader-fallback'));
  const anchor = comment.anchor.selectedText ? comment.anchor : legacyQuote(comment.anchor, task, appState.gitlabProjection?.file?.content);
  if (!changed && anchor && !anchor.deleted && highlightAnchor(root, anchor)) {
    panel.textContent = '已定位引用原文。' + (comment.anchorStatus === 'needs_manual_confirmation' ? '服务端锚点仍需人工确认。' : '');
    return;
  }
  panel.textContent = anchor?.deleted ? '该内容已删除。' : changed ? '文档版本已变化，请确认原始位置。' : '无法唯一定位原文，请核对引用内容。';
  const link = document.createElement('a'); const url = new URL(location.href);
  url.searchParams.set('step', 'diff'); url.searchParams.delete('commentId');
  if (comment.anchor.lineRange?.startLine) url.searchParams.set('line', comment.anchor.lineRange.startLine);
  link.href = url.href; link.textContent = '查看原差异'; panel.append(' ', link);
}

async function navigateReviewComment(id) {
  const task = appState.reviewProjection?.detail?.task;
  const comment = task?.reviews?.flatMap(item => item.comments || []).find(item => item.id === id);
  const path = commentPath(comment?.anchor, task, appState.gitlabProjection?.tree || []);
  if (!path) { showAppNotice(comment?.anchor ? '无法确定意见对应的文档路径。' : '该意见为全文意见，没有具体位置。'); return; }
  const url = new URL(location.href);
  url.searchParams.set('step', 'read'); url.searchParams.set('path', path); url.searchParams.set('commentId', id);
  url.searchParams.set('taskId', task.id); url.searchParams.set('handbookId', task.handbookId);
  url.searchParams.delete('line');
  history.pushState({ view: 'review' }, '', url);
  await loadReviewWorkspace(task.id);
}
