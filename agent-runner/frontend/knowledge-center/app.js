import { archiveAsset, createAsset, deleteOutline, importOutline, loadAssets, loadOutlineData, loadPlatformData, resolveAssetStatus, restoreAsset, updateAsset, updateAssetStatus, loadPlatformPermissions, updatePlatformUserPermissions } from './common/api/platform-api.js';
import { loadGitLabBranches, loadGitLabConnections, loadGitLabOAuthStatus, loadGitLabOAuthConfig, loadGitLabTree, loadHandbookRepository, loadHandbookRepositoryFile, loadHandbookRepositoryMapping, loadHandbookRepositoryStatistics, loadHandbookRepositoryTree, saveGitLabConnection, saveHandbookRepositoryMapping, createGitLabConnection, updateGitLabConnection, verifyGitLabConnection, disableGitLabConnection, enableGitLabConnection, searchGitLabConnections } from './common/api/gitlab-api.js';
import { addIncrementalSource, commentIncrementalReview, createIncrementalReview, createIncrementalRevision, createIncrementalTask, decideIncrementalReview, loadIncrementalBaselines, loadIncrementalTask, loadIncrementalTasks, publishIncrementalTask, recordIncrementalEvidence, runIncrementalChecks, saveIncrementalDraft, submitIncrementalCandidate, updateIncrementalTarget } from './common/api/incremental-api.js';
import { bootstrapAuth, consumeRememberedTarget, performLogout, rememberCurrentTarget, startCasLogin, submitAdminLogin } from './common/auth/auth-controller.js';
import { appState, views } from './common/state/app-state.js';
import { authState, canAccessView, canPerform, clearSession, displayName, firstAccessibleView, isPlatformAdmin } from './common/state/auth-state.js';
import { pathForView, viewFromPath, platformTabFromSearch } from './common/state/navigation.js';
import { onKnowledgeDataChanged } from './common/state/data-change.js';
import { byId, escapeHtml } from './common/utils/dom.js';
import { renderDashboard } from './modules/dashboard/view.js';
import { renderAssets } from './modules/assets/view.js';
import { renderCleaning } from './modules/cleaning/view.js';
import { renderOutlines } from './modules/outlines/view.js';
import { renderTemplates } from './modules/templates/view.js';
import { renderProduction, renderStages } from './modules/production/view.js';
import { renderReviewPublishing } from './modules/review-publishing/view.js';
import { renderPermissionResults, renderPlatformAdmin } from './modules/platform-admin/view.js';
import { renderRepository } from './modules/repository/view.js';

const renderers = {
  dashboard: renderDashboard,
  assets: renderAssets,
  cleaning: renderCleaning,
  outlines: renderOutlines,
  templates: renderTemplates,
  production: renderProduction,
  review: renderReviewPublishing,
  platform: renderPlatformAdmin,
  stages: renderStages,
  repository: renderRepository,
};

const outlineStages = new Set(['tree', 'responsibility', 'templates', 'changes', 'publish']);

function outlineRouteState() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const handbookId = parts[1] === 'outlines' ? parts[2] || null : null;
  const parameters = new URLSearchParams(window.location.search);
  const requestedStage = parameters.get('stage');
  return {
    handbookId,
    isDetail: Boolean(handbookId),
    activeStage: outlineStages.has(requestedStage) ? requestedStage : 'tree',
    listState: { search: parameters.get('q') || appState.outlineListState.search, status: parameters.get('status') || appState.outlineListState.statusFilter },
  };
}

let assetRenderDeferred = false;

function render() {
  if (appState.activeView === 'assets' && document.querySelector('.asset-dialog[open]')) {
    assetRenderDeferred = true;
    return;
  }
  if (appState.activeView === 'platform'
    && (appState.gitlabAddingConnection || appState.gitlabEditingConnection)
    && document.querySelector('[data-gitlab-add-form], [data-gitlab-edit-form]')) return;
  const renderer = renderers[appState.activeView] || renderDashboard;
  byId('page-title').textContent = views[appState.activeView][1];
  document.querySelectorAll('.nav-item').forEach(button => {
    const allowed = canAccessView(button.dataset.view);
    button.hidden = !allowed;
    const active = button.dataset.view === appState.activeView;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  document.querySelector('.nav-caption.governance').hidden = !canAccessView('platform');
  const outlineView = appState.activeView === 'outlines' ? outlineRouteState() : {};
  byId('view-root').innerHTML = renderer({ projection: appState.activeView === 'repository' ? appState.gitlabProjection : appState.projection, outlineProjection: appState.outlineProjection, assetCatalog: appState.assetCatalog, incrementalProjection: appState.incrementalProjection, gitlabProjection: appState.gitlabProjection, permissionProjection: appState.permissionProjection, governanceProjection: appState.platformGovernance, selectedPermissionUserId: appState.selectedPermissionUserId, permissionSaveStatus: appState.permissionSaveStatus, permissionUserSearch: appState.permissionUserSearch, gitlabVerification: appState.gitlabVerification, platformAdmin: isPlatformAdmin(), platformTab: appState.platformTab, gitlabListState: appState.gitlabListState, gitlabAddingConnection: appState.gitlabAddingConnection, gitlabEditingConnection: appState.gitlabEditingConnection, outlinePermissions: { create: canPerform('outline:create'), delete: canPerform('outline:delete') }, outlineView });
  window.lucide?.createIcons();
  if (appState.activeView === 'outlines' && !outlineView.isDetail && appState.outlineListState.scrollPosition) requestAnimationFrame(() => { byId('main-shell').scrollTop = appState.outlineListState.scrollPosition; });
}

function flushDeferredAssetRender() {
  if (!assetRenderDeferred) return;
  assetRenderDeferred = false;
  render();
}

function navigate(view, updateHistory = true) {
  if (!views[view]) return;
  if (!canAccessView(view)) {
    const fallback = firstAccessibleView();
    showAppNotice('当前账号没有访问该页面的权限，已返回可访问页面。');
    if (!fallback || fallback === view) return;
    return navigate(fallback, updateHistory);
  }
  appState.activeView = view;
  const targetPath = view === "platform" ? pathForView(view, { tab: appState.platformTab }) : pathForView(view);
  if (updateHistory && (window.location.pathname + window.location.search) !== targetPath) window.history.pushState({ view, tab: appState.platformTab }, '', targetPath);
  render();
  if (view === 'outlines' && !appState.outlineProjection) loadOutlines();
  if (view === 'assets') loadAssetCatalog();
  if (view === 'production') loadIncrementalWorkspace();
  if (view === 'repository') loadRepositoryWorkspace();
  if (view === 'platform') loadGitLabAdmin();
  closeMobileNavigation(false);
  byId('main').focus();
}

function repositoryRouteState() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const params = new URLSearchParams(window.location.search);
  return { handbookId: parts[1] === 'assets' && parts[3] === 'repository' ? parts[2] : '', branch: params.get('branch') || '', language: params.get('lang') === 'en' ? 'en' : 'zh', path: params.get('path') || '' };
}

async function loadRepositoryWorkspace() {
  const state = repositoryRouteState();
  if (!state.handbookId) return;
  appState.gitlabProjection = { status: 'loading', handbookId: state.handbookId };
  render();
  try {
    const metadata = await loadHandbookRepository(state.handbookId);
    const branches = Array.isArray(metadata) ? metadata : (metadata.items || metadata.branches || []);
    const branch = state.branch || metadata.defaultBranch || branches[0]?.name || '';
    const treeResult = branch ? await loadHandbookRepositoryTree(state.handbookId, branch, state.language) : [];
    const tree = Array.isArray(treeResult) ? treeResult : (treeResult.items || treeResult.tree || []);
    const firstFile = state.path || tree.find(item => item.type !== 'tree' && /\.md$/i.test(item.path || item.name))?.path || '';
    const file = firstFile ? await loadHandbookRepositoryFile(state.handbookId, branch, state.language, firstFile) : null;
    appState.gitlabProjection = { status: 'ok', handbookId: state.handbookId, handbookName: metadata.handbookName, connectionName: metadata.connectionName, project: metadata.project, languages: metadata.languages, branches, branch, language: state.language, tree, file, commitSha: file?.commitId || metadata.commitSha };
  } catch (error) {
    const statusByCode = {
      GITLAB_OAUTH_REQUIRED: 'unauthorized',
      GITLAB_CREDENTIAL_UNAVAILABLE: 'unauthorized',
      GITLAB_MAPPING_NOT_FOUND: 'not-mapped',
      GITLAB_LANGUAGE_NOT_MAPPED: 'not-mapped',
      GITLAB_BRANCH_NOT_FOUND: 'not-found',
      GITLAB_CONNECTION_NOT_FOUND: 'not-found',
      GITLAB_BRANCH_NOT_ALLOWED: 'forbidden',
      GITLAB_PATH_FORBIDDEN: 'forbidden',
      GITLAB_FORBIDDEN: 'forbidden',
      GITLAB_UNAUTHORIZED: 'unauthorized',
      GITLAB_CONNECTION_INACTIVE: 'conflict',
      GITLAB_CONNECTOR_DISABLED: 'conflict',
    };
    const status = statusByCode[error.code] || (error.status === 403 ? 'forbidden' : error.status === 401 ? 'unauthorized' : error.status === 404 ? 'not-found' : error.status === 409 ? 'conflict' : 'unavailable');
    appState.gitlabProjection = { status, handbookId: state.handbookId, error: { code: error.code, message: error.message, httpStatus: error.status } };
  }
  render();
}

async function loadOutlines() {
  const { handbookId } = outlineRouteState();
  appState.outlineProjection = await loadOutlineData(handbookId);
  if (appState.activeView === 'outlines') render();
}

const assetBranchPreferenceKey = handbookId => `knowledge-center:asset-branch:${handbookId}`;
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
    try { Object.assign(item, await loadHandbookRepositoryStatistics(item.handbookId, branch, 'zh'), { statisticsStatus: 'ok' }); }
    catch (error) { item.statisticsStatus = 'unavailable'; item.statisticsError = error.message; }
  }));
  return catalog;
}

async function loadAssetCatalog() {
  const params = new URLSearchParams(window.location.search);
  const query = new URLSearchParams();
  for (const key of ['q','owner','status','productId','lifecycle','page','pageSize']) if (params.get(key)) query.set(key, params.get(key));
  if (params.get('archived') === 'true') query.set('includeArchived', 'true');
  const [response, connections] = await Promise.all([loadAssets(query), isPlatformAdmin() ? loadGitLabConnections().catch(() => ({ items: [] })) : Promise.resolve({ items: [] })]);
  appState.assetCatalog = await enrichAssetRepositoryStatistics(response?.data || response || null);
  appState.gitlabProjection = { ...(appState.gitlabProjection || {}), connections: connections?.items || [] };
  if (appState.activeView === 'assets') render();
}

async function loadGitLabAdmin() {
  if (!isPlatformAdmin()) return;
  const [gitlab, oauthStatus, oauthConfig, permissions] = await Promise.all([
    loadGitLabConnections().catch(error => ({ error })),
    loadGitLabOAuthStatus().catch(() => ({ connected: false, mode: 'unavailable' })),
    loadGitLabOAuthConfig().catch(() => ({ configured: false, devHttp: false })),
    loadPlatformPermissions().catch(error => ({ error })),
  ]);
  appState.gitlabProjection = { ...(appState.gitlabProjection || {}), connections: gitlab.error ? [] : (gitlab?.items || gitlab?.data?.items || []), oauthStatus, oauthConfig, adminError: gitlab.error?.message };
  if (permissions.error) appState.permissionProjection = { status: 'unavailable', error: permissions.error.message };
  else {
    const payload = permissions?.data || permissions?.content || permissions;
    appState.permissionProjection = { ...(payload || {}), status: 'ok' };
    if (!appState.selectedPermissionUserId && Array.isArray(payload?.users) && payload.users.length) {
      appState.selectedPermissionUserId = payload.users[0].id;
    }
  }
  if (appState.activeView === 'platform') render();
}

function refreshPermissionResults(searchValue) {
  appState.permissionUserSearch = searchValue.trim();
  const results = renderPermissionResults(appState.permissionProjection || {}, appState.selectedPermissionUserId, appState.permissionSaveStatus, appState.permissionUserSearch);
  appState.selectedPermissionUserId = results.selectedUserId;
  const list = byId('view-root')?.querySelector('[data-permission-user-list]');
  const detail = byId('view-root')?.querySelector('[data-permission-user-detail]');
  if (list) list.innerHTML = results.listHtml;
  if (detail) detail.innerHTML = results.detailHtml;
}

let permissionSearchComposing = false;

async function loadIncrementalWorkspace(preferredTaskId = null) {
  if (appState.activeView !== 'production' && appState.activeView !== 'stages') return;
  const params = new URLSearchParams(window.location.search);
  const taskId = preferredTaskId || params.get('taskId');
  const requestedHandbookId = params.get('handbookId') || '';
  appState.incrementalProjection = { ...(appState.incrementalProjection || {}), status: 'loading', requestedHandbookId };
  render();
  try {
    const [tasks, assets] = await Promise.all([
      loadIncrementalTasks(requestedHandbookId ? { handbookId: requestedHandbookId } : {}),
      loadAssets(new URLSearchParams({ pageSize: '100' })).catch(() => null),
    ]);
    const items = Array.isArray(tasks) ? tasks : (tasks?.items || []);
    const selectedId = taskId || null;
    const detail = selectedId ? await loadIncrementalTask(selectedId) : null;
    appState.incrementalProjection = {
      status: 'ok', items, detail,
      handbooks: assets?.items || assets?.data?.items || [], requestedHandbookId,
    };
  } catch (error) {
    appState.incrementalProjection = { status: 'unavailable', items: [], detail: null, requestedHandbookId, error: { message: error.message } };
  }
  render();
}

function incrementalStatus(formOrSection, message, error = false) {
  const status = formOrSection?.querySelector?.('.incremental-form-status');
  if (status) { status.textContent = message; status.classList.toggle('error', error); }
}

async function runIncrementalAction(control, taskId, operation, successMessage) {
  control.disabled = true;
  const container = control.closest('form, .incremental-section');
  incrementalStatus(container, '正在处理…');
  try {
    await operation();
    incrementalStatus(container, successMessage);
    await loadIncrementalWorkspace(taskId);
  } catch (error) {
    incrementalStatus(container, error.message || '操作失败', true);
    control.disabled = false;
  }
}

function showAppNotice(message) {
  const panel = byId('error-panel');
  panel.hidden = false;
  byId('error-message').textContent = message;
}

function showApplicationError(error) {
  showApplication();
  showAppNotice(`页面加载失败：${error?.message || '请重新加载页面。'}`);
}

function authErrorMessage(error) {
  const messages = {
    AUTH_SERVICE_UNAVAILABLE: '认证服务暂时不可用，请稍后重试。',
    CAS_TICKET_INVALID: '统一认证信息已失效，请重新登录。',
    CAS_TICKET_EXPIRED: '统一认证信息已过期，请重新登录。',
    CAS_SERVICE_MISMATCH: '登录请求无法验证，请联系平台管理员。',
    ADMIN_ACCOUNT_LOCKED: '管理员账号暂时无法登录，请联系平台管理员。',
  };
  return messages[error?.code] || error?.message || '登录未完成，请重试。';
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
  byId('auth-loading').hidden = true;
  byId('auth-shell').hidden = true;
  byId('app-shell').hidden = false;
  byId('skip-to-main').hidden = false;
  byId('sidebar-user').textContent = displayName();
}

function updatePlatformState(context, overview) {
  const states = [context?.status, overview?.status].filter(Boolean);
  const ok = states.length === 2 && states.every(status => status === 'ok');
  const unavailable = states.length === 0 || states.every(status => status === 'unavailable');
  byId('platform-status').textContent = ok ? '平台运行正常' : unavailable ? '平台数据不可用' : '部分服务降级';
  byId('platform-dot').className = `status-dot ${ok ? 'ok' : 'warning'}`;
  byId('error-panel').hidden = !unavailable;
  if (unavailable) byId('error-message').textContent = '当前无法读取平台数据，请稍后重新检查。';
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
    if (requested.context && context) appState.contextProjection = context;
    if (requested.overview && overview && overview.status !== 'unavailable') appState.projection = overview;
    const currentContext = requested.context ? context : appState.contextProjection;
    const currentOverview = requested.overview && overview ? overview : appState.projection;
    if (currentContext?.context?.brand?.enterpriseName) byId('enterprise-name').textContent = currentContext.context.brand.enterpriseName;
    else if (!appState.projection) byId('enterprise-name').textContent = '企业信息暂不可用';
    updatePlatformState(currentContext, currentOverview);
    try {
      render();
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

document.addEventListener('click', async event => {
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
      appState.platformTab = tab;
      appState.gitlabAddingConnection = false;
      window.history.pushState({ view: "platform", tab }, "", pathForView("platform", { tab }));
      render();
      if (tab === "gitlab" && !appState.gitlabProjection?.connections?.length) loadGitLabAdmin();
    }
    return;
  }
  /* ---- GitLab 连接选择 ---- */
  const gitlabConn = event.target.closest("[data-gitlab-connection]");
  if (gitlabConn) {
    appState.gitlabListState.selectedConnectionId = gitlabConn.dataset.gitlabConnection;
    render();
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
      appState.gitlabVerification = null;
      render();
    } catch (error) {
      appState.gitlabVerification = { connectionId: connId, status: 'failed', verifiedAt: new Date().toISOString(), error: { code: error.code, message: error.message } };
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
    appState.selectedPermissionUserId = permUser.dataset.permissionUser;
    appState.permissionSaveStatus = null;
    render();
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
    toggle?.focus();
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
  const outlineStageTarget = event.target.closest('[data-outline-stage-target]');
  if (outlineStageTarget) {
    document.querySelector(`[data-outline-tab="${outlineStageTarget.dataset.outlineStageTarget}"]`)?.click();
    return;
  }
  const outlineTreeControl = event.target.closest('[data-outline-tree-expand]');
  if (outlineTreeControl) {
    const expanded = outlineTreeControl.dataset.outlineTreeExpand === 'true';
    document.querySelectorAll('[data-outline-panel="tree"] details').forEach(item => { item.open = expanded; });
    outlineTreeControl.closest('.outline-tree-toolbar')?.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button === outlineTreeControl)));
    return;
  }
  const outlineDelete = event.target.closest('[data-outline-delete]');
  if (outlineDelete) {
    const id = outlineDelete.dataset.outlineDelete;
    const name = outlineDelete.dataset.outlineDeleteName || '该候选大纲';
    if (!id || !window.confirm(`确认删除“${name}”吗？仅未发布候选可删除，此操作不可恢复。`)) return;
    outlineDelete.disabled = true;
    const originalText = outlineDelete.textContent;
    outlineDelete.textContent = '删除中…';
    try {
      await deleteOutline(id);
      showAppNotice('候选大纲已删除');
      appState.outlineProjection = null;
      if (outlineRouteState().isDetail) window.history.replaceState({ view: 'outlines' }, document.title, '/knowledge-center/outlines');
      await loadOutlines();
    } catch (error) {
      showAppNotice(error.message || '删除失败，请稍后重试');
      outlineDelete.disabled = false;
      outlineDelete.textContent = originalText;
      window.lucide?.createIcons();
    }
    return;
  }
  if (event.target.closest('[data-asset-create-open]')) { document.querySelector('[data-asset-create-dialog]')?.showModal(); return; }
  if (event.target.closest('[data-asset-edit-open]')) { document.querySelector('[data-asset-edit-dialog]')?.showModal(); return; }
  const mappingOpen = event.target.closest('[data-repository-mapping-open]');
  if (mappingOpen) {
    const dialog = document.querySelector('[data-repository-mapping-dialog]');
    const form = dialog?.querySelector('[data-repository-mapping-form]');
    dialog?.showModal();
    appState.mappingState = { connectionId: null, treeItems: [], expandedPaths: new Set(), branches: [], enabledBranches: [], zhPaths: [], enPaths: [], activeLang: 'zh' };
    if (form) {
      try {
        const mapping = await loadHandbookRepositoryMapping(mappingOpen.dataset.repositoryMappingOpen);
        form.elements.connectionId.value = mapping.connectionId || '';
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
  const dialogClose = event.target.closest('[data-asset-dialog-close]');
  if (dialogClose) { dialogClose.closest('dialog')?.close(); flushDeferredAssetRender(); return; }
  const assetStage = event.target.closest('[data-asset-stage]');
  if (assetStage) {
    event.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.set('status', assetStage.dataset.assetStage);
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
    const url = new URL(window.location.href);
    url.searchParams.delete('handbookId');
    window.history.pushState({ view: 'assets' }, document.title, url);
    loadAssetCatalog();
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
  const archive = event.target.closest('[data-asset-archive]');
  if (archive) {
    const item = appState.assetCatalog?.items?.find(entry => String(entry.handbookId || entry.id) === archive.dataset.assetArchive);
    const chapters = Number.isInteger(item?.chapterCount) ? `${item.chapterCount} 个章节` : '章节数暂不可用';
    const documents = Number.isInteger(item?.documentCount) ? `${item.documentCount} 份文档` : '文档数暂不可用';
    if (window.confirm(`停用后手册将从在用资产列表隐藏，${chapters}、${documents}以及仓库映射、责任和审计记录均会保留。确认停用？`)) archiveAsset(archive.dataset.assetArchive).then(() => { archive.closest('dialog')?.close(); return loadAssetCatalog(); }).catch(error => showAppNotice(error.message));
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
    loadAssetCatalog();
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
  if (event.target.closest('[data-repository-refresh]')) { loadRepositoryWorkspace(); return; }
  const repositoryLanguage = event.target.closest('[data-repository-language]');
  if (repositoryLanguage) { const url=new URL(window.location.href); url.searchParams.set('lang',repositoryLanguage.dataset.repositoryLanguage); url.searchParams.delete('path'); window.history.pushState({view:'repository'},'',url); loadRepositoryWorkspace(); return; }
  const repositoryFile = event.target.closest('[data-repository-file]');
  if (repositoryFile) { const url=new URL(window.location.href); url.searchParams.set('path',repositoryFile.dataset.repositoryFile); window.history.pushState({view:'repository'},'',url); loadRepositoryWorkspace(); return; }
  const incrementalTask = event.target.closest('[data-incremental-task]');
  if (incrementalTask) {
    const url = new URL(window.location.href);
    url.searchParams.set('taskId', incrementalTask.dataset.incrementalTask);
    window.history.pushState({ view: 'production', taskId: incrementalTask.dataset.incrementalTask }, document.title, url);
    loadIncrementalWorkspace(incrementalTask.dataset.incrementalTask);
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
  const publish = event.target.closest('[data-incremental-publish]');
  if (publish) {
    const task = appState.incrementalProjection?.detail?.task || appState.incrementalProjection?.detail;
    runIncrementalAction(publish, publish.dataset.incrementalPublish, () => publishIncrementalTask(publish.dataset.incrementalPublish, { expectedCandidateDigest: task?.candidate?.digest }), '平台版本已发布');
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
    outlineTab.dataset.outlineTab === 'tree' ? url.searchParams.delete('stage') : url.searchParams.set('stage', outlineTab.dataset.outlineTab);
    window.history.replaceState({ ...window.history.state, stage: outlineTab.dataset.outlineTab }, document.title, `${url.pathname}${url.search}`);
    document.querySelectorAll('[data-outline-tab]').forEach(tab => {
      const active = tab === outlineTab;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll('[data-outline-panel]').forEach(panelElement => {
      panelElement.hidden = panelElement.dataset.outlinePanel !== outlineTab.dataset.outlineTab;
    });
    return;
  }
  if (views[action]) navigate(action);
});

document.addEventListener('close', event => {
  if (event.target.matches?.('.asset-dialog')) flushDeferredAssetRender();
}, true);

document.addEventListener('change', async event => {
  const assetBranch = event.target.closest('[data-asset-branch]');
  if (assetBranch) {
    const item = appState.assetCatalog?.items?.find(entry => String(entry.handbookId) === assetBranch.dataset.assetBranch);
    if (!item) return;
    assetBranch.disabled = true;
    try {
      const statistics = await loadHandbookRepositoryStatistics(item.handbookId, assetBranch.value, 'zh');
      Object.assign(item, statistics, { selectedBranch: assetBranch.value, statisticsStatus: 'ok' });
      try { window.localStorage.setItem(assetBranchPreferenceKey(item.handbookId), assetBranch.value); } catch (_error) { /* preference is optional */ }
      render();
    } catch (error) { showAppNotice(error.message || '仓库统计暂不可用'); assetBranch.disabled = false; }
    return;
  }
  const userDropdown = event.target.closest('[data-permission-user-select]');
  if (userDropdown) {
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
  if (defaultSelect) defaultSelect.innerHTML = '<option value="">正在读取分支…</option>';
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
    if (defaultSelect) defaultSelect.innerHTML = '<option value="">分支读取失败</option>';
    if (enabledContainer) enabledContainer.innerHTML = '<span class="muted">分支读取失败</span>';
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

function renderMappingTree(form, items) {
  const browser = form.querySelector('[data-mapping-path-browser]');
  if (!browser) return;
  if (!items.length) {
    browser.innerHTML = '<div class="mapping-path-empty">该目录下没有内容</div>';
    return;
  }
  const hierarchy = buildMappingTreeHierarchy(items);
  browser.innerHTML = `<ul class="mapping-tree-root" role="tree" aria-label="GitLab 仓库目录">${renderMappingTreeNodes(hierarchy)}</ul>`;
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

document.addEventListener('submit', async event => {
  const permissionForm = event.target.closest('[data-permission-role-form]');
  if (permissionForm) {
    event.preventDefault();
    const userId = appState.selectedPermissionUserId;
    if (!userId) return;
    const statusEl = permissionForm.querySelector('.permission-save-status');
    const button = permissionForm.querySelector('button[type="submit"]');
    const roles = [...permissionForm.querySelectorAll('input[name="roles"]:checked')].map(input => input.value);
    appState.permissionSaveStatus = 'saving';
    render();
    try {
      await updatePlatformUserPermissions(userId, { roles });
      appState.permissionSaveStatus = 'saved';
      await loadGitLabAdmin();
      setTimeout(() => { appState.permissionSaveStatus = null; render(); }, 2000);
    } catch (error) { appState.permissionSaveStatus = 'error'; render(); }
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
        purpose: gitlabAddForm.elements.purpose.value,
        authMode: gitlabAddForm.elements.authMode.value,
        ...(gitlabAddForm.elements.credentialRef.value.trim() ? { credentialRef: gitlabAddForm.elements.credentialRef.value.trim() } : {}),
      });
      appState.gitlabListState.selectedConnectionId = saved.id;
      appState.gitlabAddingConnection = false;
      if (saved.authMode !== 'user_oauth' || appState.gitlabProjection?.oauthStatus?.connected) {
        appState.gitlabVerification = { connectionId: saved.id, status: 'verifying' };
        await verifyGitLabConnection(saved.id);
      }
      await loadGitLabAdmin();
      appState.gitlabVerification = null;
    } catch (error) {
      statusEl.textContent = error.message || "保存失败，请重试";
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
        purpose: gitlabEditForm.elements.purpose.value,
        authMode: gitlabEditForm.elements.authMode.value,
        ...(gitlabEditForm.elements.credentialRef.value.trim() ? { credentialRef: gitlabEditForm.elements.credentialRef.value.trim() } : {}),
      });
      statusEl.textContent = "连接已更新";
      appState.gitlabEditingConnection = null;
      await loadGitLabAdmin();
    } catch (error) {
      statusEl.textContent = error.message || "保存失败，请重试";
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
    try { const saved=await createAsset({name:createForm.elements.name.value.trim(),productId:createForm.elements.productId.value,ownerA:createForm.elements.ownerA.value.trim(),ownerB:createForm.elements.ownerB.value.trim(),externalVisible:createForm.elements.externalVisible.checked,summary:createForm.elements.summary.value.trim()}); createForm.closest('dialog').close(); const url=new URL(window.location.href); url.searchParams.set('handbookId',saved.handbookId); window.history.pushState({view:'assets'},'',url); await loadAssetCatalog(); }
    catch(error){status.textContent=error.message;} finally{button.disabled=false;} return;
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
      let saved = await updateAsset(id, {
        name: assetForm.elements.name.value.trim(),
        ownerA: assetForm.elements.ownerA.value.trim(),
        ownerB: assetForm.elements.ownerB.value.trim(),
      });
      if (assetForm.elements.status.value !== current?.status) {
        const reason = assetForm.elements.statusReason.value.trim();
        if (!reason) throw new Error('修改手册状态时必须填写变更原因');
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
  const status = form.querySelector('[data-outline-import-status]');
  const results = form.querySelector('[data-outline-import-results]');
  const submit = form.querySelector('button[type="submit"]');
  if (!files.length) { status.textContent = '请选择要导入的文件'; return; }
  submit.disabled = true;
  if (results) results.innerHTML = '';
  const succeeded = [];
  try {
    for (const [index, file] of files.entries()) {
      status.textContent = `正在导入 ${index + 1}/${files.length}：${file.name}`;
      const row = document.createElement('li');
      row.textContent = `${file.name}：解析中`;
      results?.appendChild(row);
      const payload = new FormData();
      payload.append('file', file);
      try {
        let response;
        try {
          response = await importOutline(payload);
        } catch (error) {
          const duplicate = error?.payload?.data?.items?.find(item => item.status === 'duplicate_confirmation_required');
          if (!duplicate || !window.confirm(`文件“${file.name}”已有候选版本，是否仍然导入？`)) throw error;
          const retry = new FormData(); retry.append('file', file); retry.append('confirmDuplicate', 'true');
          response = await importOutline(retry);
        }
        const candidate = response?.data || {};
        row.textContent = `${file.name}：导入成功，${candidate.name || '候选大纲已创建'}`;
        succeeded.push(candidate);
      } catch (error) {
        row.textContent = `${file.name}：导入失败，${error?.message || '请稍后重试'}`;
      }
    }
    status.textContent = `导入完成：成功 ${succeeded.length} 个，失败 ${files.length - succeeded.length} 个`;
    appState.outlineProjection = null;
    const latest = succeeded[succeeded.length - 1];
    if (latest?.id || latest?.handbookId) {
      const id = latest.handbookId || latest.id;
      window.history.pushState({ view: 'outlines' }, '', `/knowledge-center/outlines/${encodeURIComponent(id)}`);
    }
    await loadOutlines();
  } finally { submit.disabled = false; }
});

document.addEventListener('change', event => {
  const gitlabAuthMode = event.target.closest('[data-gitlab-auth-mode]');
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

document.addEventListener('change', event => {
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
    refreshPermissionResults(permSearch.value);
    return;
  }
  const repositorySearch = event.target.closest('[data-repository-search]');
  if (repositorySearch) {
    const query = repositorySearch.value.trim().toLowerCase();
    document.querySelectorAll('.repository-tree li').forEach(item => {
      const ownControl = item.querySelector(':scope > button, :scope > details > summary');
      item.hidden = Boolean(query) && !String(ownControl?.textContent || '').toLowerCase().includes(query) && !String(item.textContent || '').toLowerCase().includes(query);
    });
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
});

document.addEventListener('compositionend', event => {
  const permSearch = event.target.closest('[data-permission-search]');
  if (permSearch) {
    permissionSearchComposing = false;
    refreshPermissionResults(permSearch.value);
  }
});

document.addEventListener('change', event => {
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
    showApplication();
    const target = '/knowledge-center/platform';
    const destination = canAccessView('platform') ? target : (firstAccessibleView() ? pathForView(firstAccessibleView()) : '/knowledge-center/');
    window.history.replaceState({}, document.title, destination);
    appState.activeView = viewFromPath(destination) || 'dashboard';
    render();
    byId('main').focus();
    formElement.reset();
  } catch (error) { showAuth(error); }
});
byId('admin-login-details').addEventListener('toggle', event => {
  if (event.currentTarget.open) byId('admin-username').focus();
});
byId('logout').addEventListener('click', async () => {
  byId('logout').disabled = true;
  try { await performLogout(); } catch { clearSession(); }
  if (authState.status !== 'authenticated') showAuth(null, '您已退出登录');
  byId('logout').disabled = false;
});

onKnowledgeDataChanged(({ scopes }) => load(scopes));

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
  const infoDrawer = byId('outline-handbook-info');
  if (event.key === 'Escape' && infoDrawer && !infoDrawer.hidden) {
    document.querySelector('[data-outline-info-close]')?.click();
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
window.addEventListener('popstate', () => {
  const previousTab = appState.platformTab;
  const view = viewFromPath(window.location.pathname) || 'dashboard';
  if (view === "platform") appState.platformTab = platformTabFromSearch(window.location.search);
  if (authState.status === 'authenticated') {
    appState.outlineProjection = view === 'outlines' ? null : appState.outlineProjection;
    navigate(view, false);
    if (view === 'outlines') loadOutlines();
    if (view === 'assets') loadAssetCatalog();
    if (view === 'repository') loadRepositoryWorkspace();
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

function applySidebar() {
  shell.classList.toggle('sidebar-collapsed', sidebarCollapsed);
  shell.classList.toggle('sidebar-hidden', sidebarHidden);
  sidebar.style.setProperty('--sidebar-width', `${sidebarCollapsed ? 64 : sidebarWidth}px`);
  resizer?.setAttribute('aria-valuenow', String(sidebarWidth));
  if (resizeLabel) resizeLabel.textContent = `${sidebarWidth}px`;
  const collapse = byId('sidebar-collapse');
  const collapseLabel = sidebarCollapsed ? '展开导航' : '收缩导航';
  collapse.setAttribute('aria-label', collapseLabel);
  collapse.setAttribute('title', collapseLabel);
}

function saveSidebar() {
  localStorage.setItem('knowledge-center-sidebar-width', String(sidebarWidth));
  localStorage.setItem('knowledge-center-sidebar-hidden', String(sidebarHidden));
  localStorage.setItem('knowledge-center-sidebar-collapsed', String(sidebarCollapsed));
  applySidebar();
}

byId('sidebar-collapse').addEventListener('click', () => {
  sidebarCollapsed = !sidebarCollapsed;
  sidebarHidden = false;
  saveSidebar();
});
byId('sidebar-hide').addEventListener('click', () => {
  sidebarHidden = true;
  saveSidebar();
});
byId('sidebar-restore').addEventListener('click', () => {
  sidebarHidden = false;
  sidebarCollapsed = false;
  saveSidebar();
});

let dragging = false;
resizer?.addEventListener('pointerdown', event => {
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
  if (initialView === "platform") {
    appState.platformTab = platformTabFromSearch(window.location.search);
  }
} else {
  window.history.replaceState({ view: 'dashboard' }, '', pathForView('dashboard'));
}

async function bootstrap() {
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
  const rememberedTarget = consumeRememberedTarget();
  const remembered = rememberedTarget ? viewFromPath(new URL(rememberedTarget, window.location.origin).pathname) : null;
  const requested = remembered || viewFromPath(window.location.pathname) || 'dashboard';
  const targetView = canAccessView(requested) ? requested : (firstAccessibleView() || 'dashboard');
  if (targetView !== requested) {
    showAppNotice('当前账号没有访问原页面的权限，已打开可访问页面。');
    window.history.replaceState({ view: targetView }, document.title, pathForView(targetView));
  }
  appState.activeView = targetView;
  applySidebar();
  syncMobileNavigationState();
  window.lucide?.createIcons();
  render();
  load();
  if (appState.activeView === 'outlines') loadOutlines();
  if (appState.activeView === 'assets') loadAssetCatalog();
  if (appState.activeView === 'production') loadIncrementalWorkspace();
  if (appState.activeView === 'repository') loadRepositoryWorkspace();
  if (appState.activeView === 'platform') loadGitLabAdmin();
}

bootstrap().catch(error => {
  if (authState.status === 'authenticated') showApplicationError(error);
  else showAuth(error, '认证检查未完成，请重试。');
});
