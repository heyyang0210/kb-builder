import { escapeHtml } from '../../common/utils/dom.js';
import { safeMarkdown, treeHierarchy } from '../repository/view.js';
import { renderDatabaseMarkdown } from '../../common/markdown/markdown-renderer.js';
import { commentPath } from './anchors.js';

const labels = { candidate_ready: '待提交审核', under_review: '审核中', review_pending: '审核中', approved: '待发布', pending_publish: '待发布', rejected: '已退回', published: '已发布' };
const roleLabels = { reader: '阅读角色', reviewer: '审核角色', publisher: '发布角色' };
const requiredTaskFields = [['id', '任务标识'], ['handbookId', '手册'], ['businessVersion', '业务版本'], ['baselineVersionId', '正式基线'], ['candidateDigest', '候选摘要']];
const list = value => Array.isArray(value) ? value : [];
const idOf = task => task?.id || task?.taskId || '';
const rawStatus = task => task?.state || task?.status || '';
const candidateDigest = task => task?.candidateDigest || task?.candidate?.digest || '';
const esc = value => escapeHtml(value ?? '');
const timestamp = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '';

function reviewMetrics(task) {
  const operations = list(task?.candidate?.operations || task?.draft?.operations);
  const comments = list(task?.reviews).flatMap(review => list(review.comments));
  return {
    operations,
    comments,
    unresolved: comments.filter(comment => comment.resolved !== true).length,
    blockers: comments.filter(comment => comment.resolved !== true && comment.severity === 'blocker').length,
  };
}

function statusLabel(task) { return labels[rawStatus(task)] || '状态异常'; }

function taskIssues(task) {
  if (!task || typeof task !== 'object' || !idOf(task)) return ['任务详情'];
  const values = { ...task, id: idOf(task), candidateDigest: candidateDigest(task) };
  const issues = requiredTaskFields.filter(([field]) => !values[field]).map(([, label]) => label);
  if (!labels[rawStatus(task)]) issues.push('任务状态');
  return issues;
}

function taskSelector(tasks, selected) {
  return `<label class="review-task-switcher" for="review-task-select"><span>当前任务</span><select id="review-task-select" data-review-task-select>${tasks.map(task => `<option value="${esc(idOf(task))}" ${String(selected) === String(idOf(task)) ? 'selected' : ''}>${esc(task.name || task.title || '未命名审核事项')} · ${esc(task.businessVersion || '未关联版本')}</option>`).join('')}</select></label>`;
}

function emptyState(handbookId = '') {
  const title = handbookId ? '当前手册尚未提交审核候选' : '当前没有待处理审核事项';
  const message = handbookId ? '该手册仍可阅读正式内容；候选版本冻结并提交审核后，会在此处进入评审工作台。' : '新的候选版本提交审核后会出现在这里。';
  const next = handbookId ? `<a class="button primary" href="/knowledge-center/production?handbookId=${encodeURIComponent(handbookId)}">前往文档生产</a>` : '';
  return `<section class="review-zero-state" aria-labelledby="review-empty-title"><i data-lucide="inbox" aria-hidden="true"></i><h2 id="review-empty-title">${title}</h2><p>${message}</p><div>${next}<button class="button ${next ? 'secondary' : 'primary'}" type="button" data-review-reload>刷新</button><a class="button secondary" href="/knowledge-center/assets${handbookId ? `?handbookId=${encodeURIComponent(handbookId)}` : ''}">返回知识资产</a></div></section>`;
}

function onlineReviewDialog(handbookId, projection, handbook, baselines, baselineError, commits = []) {
  const available = list(baselines).filter(item => item?.current === true);
  const filePath = projection?.file?.path || '';
  const productName = handbook?.productType || 'YashanDB';
  const handbookName = handbook?.name || handbook?.handbookName || projection?.handbookName || handbookId;
  const hasBaseline = available.length > 0;
  const baselineOptions = available.map(item => `<option value="${esc(item.id)}" data-business-version="${esc(item.businessVersion || '')}">${esc(item.businessVersion || item.id)}${item.publishedAt ? ` · 发布于 ${esc(timestamp(item.publishedAt))}` : ''}</option>`).join('');
  const branch = projection?.branch || 'master';
  const defaultBusinessVersion = `review-${new Date().toISOString().slice(0, 10).replace(/-/g, '.')}`;
  // 提交列表用可滚动面板展示完整标题、作者和时间
  const commitItems = list(commits).map((item, idx) => {
    const sha = esc(item.sha || '');
    const shortId = esc(item.shortSha || item.sha?.slice(0, 8) || '');
    const title = esc(item.title || item.message?.split('\n')[0] || '无提交说明');
    const author = esc(item.authorName || '未知作者');
    const date = item.authoredDate ? esc(timestamp(item.authoredDate)) : '';
    const checked = idx === 0 ? 'checked' : '';
    return `<label class="review-commit-item"><input type="radio" name="commitSha" value="${sha}" ${checked}><span class="review-commit-id">${shortId}</span><span class="review-commit-title">${title}</span><span class="review-commit-meta">${author}${date ? ` · ${date}` : ''}</span></label>`;
  }).join('');
  const commitListHtml = commitItems
    ? `<div class="review-commit-list" role="radiogroup" aria-label="选择基线提交">${commitItems}</div>`
    : Array.isArray(commits) && commits.length === 0
      ? '<p class="review-online-hint">该分支暂无提交记录，将使用 HEAD 创建基线。</p>'
      : '<p class="review-online-hint">提交历史加载失败，将使用最新 HEAD 创建基线。</p>';
  const description = hasBaseline
    ? '从当前正式版本创建不可变评审快照，不修改正式文档。'
    : '当前手册尚无已发布版本，将从 GitLab 仓库内容创建初始评审快照。';
  return `<dialog class="review-online-dialog" data-review-online-dialog aria-labelledby="review-online-title"><form method="dialog" data-review-online-form data-handbook-id="${esc(handbookId)}" data-handbook-name="${esc(handbookName)}" data-document-path="${esc(filePath)}" data-branch="${esc(branch)}"><header><div><span class="eyebrow">审核与发布</span><h2 id="review-online-title">发起在线评审</h2><p>${esc(description)}</p></div><button class="icon-button" type="button" data-review-online-close aria-label="关闭发起在线评审"><i data-lucide="x" aria-hidden="true"></i></button></header><div class="review-online-context"><div><span>产品</span><strong>${esc(productName)}</strong></div><div><span>手册</span><strong>${esc(handbookName)}</strong></div></div>${hasBaseline ? `<label for="review-online-baseline">当前正式版本<select id="review-online-baseline" name="baselineVersionId">${baselineOptions}</select></label>` : `<input type="hidden" name="bootstrapFromRepository" value="true"><fieldset class="review-online-commit-fieldset"><legend>选择 Git 提交作为基线来源</legend>${commitListHtml}<p class="review-online-hint">将从选中的提交读取仓库内容创建合成基线。默认使用最新提交（HEAD）。</p></fieldset>`}<label for="review-online-version">业务版本<input id="review-online-version" type="text" name="businessVersion" value="${esc(hasBaseline ? '' : defaultBusinessVersion)}" placeholder="例如 23.4.1" ${hasBaseline ? 'readonly' : ''}><p class="review-online-hint">${hasBaseline ? '业务版本由已发布基线自动确定。' : '合成基线的业务版本标识，可修改。'}</p></label><fieldset><legend>评审范围</legend>${filePath ? `<label><input type="radio" name="scope" value="document" checked>当前文档 <span>${esc(filePath)}</span></label>` : ''}<label><input type="radio" name="scope" value="handbook" ${filePath ? '' : 'checked'}>整本手册</label></fieldset><label for="review-online-note">评审说明（可选）<textarea id="review-online-note" name="note" rows="3" placeholder="例如：核对 23.4 参数依赖与运维命令"></textarea></label><div class="review-online-error" data-review-online-error role="alert" tabindex="-1" hidden></div><footer><button class="button secondary" type="button" data-review-online-cancel>取消</button><button class="button primary" type="submit">创建评审快照</button></footer></form></dialog>`;
}


function handbookWaitingState(handbookId, projection, handbooks = [], ui = {}, onlineReviewBaselines = [], onlineReviewBaselineError = null, commits = []) {
  const handbook = handbooks.find(item => String(item.handbookId || item.id) === String(handbookId));
  const title = projection?.handbookName || handbook?.name || handbook?.handbookName || handbookId;
  const language = projection?.language === 'en' ? 'English' : '中文';
  const branch = projection?.branch || '候选版本';
  const source = projection?.commitSha ? `提交 ${esc(projection.commitSha.slice(0, 8))}` : '正式内容';
  const hasBaseline = list(onlineReviewBaselines).some(item => item?.current);
  const selector = handbooks.length > 1 ? `<label class="review-task-switcher" for="review-handbook-select"><span>当前手册</span><select id="review-handbook-select" data-review-handbook-select>${handbooks.map(item => `<option value="${esc(item.handbookId || item.id)}" ${String(item.handbookId || item.id) === String(handbookId) ? 'selected' : ''}>${esc(item.name || item.handbookName || item.handbookId)}</option>`).join('')}</select></label>` : '';
  // 阅读区顶部嵌入空态提示条
  const emptyBanner = `<div class="review-empty-banner" role="status"><i data-lucide="inbox" aria-hidden="true"></i><div><h3 class="review-empty-banner-title">尚无待审核修改稿</h3><p>${hasBaseline ? '已发布的存量手册可以直接进入在线评审。系统会冻结当前正式版本快照，随后可在阅读区提出意见并在线闭环。' : '当前手册尚无已发布版本。发起评审时将从 GitLab 仓库创建初始基线，随后可在阅读区提出意见并在线闭环。'}</p></div></div>`;
  // 右侧审核信息区：§17.5 结构，首卡为评审准备说明
  const baselineHint = !hasBaseline && !onlineReviewBaselineError
    ? '<p class="review-prep-hint">当前手册尚无已发布版本，发起评审时将从 GitLab 仓库创建初始基线。</p>'
    : onlineReviewBaselineError
      ? `<p class="review-online-entry-error">${esc(onlineReviewBaselineError?.message || '当前没有可用于快照的正式版本。')}</p>`
      : '';
  const evidenceColumn = `<aside class="review-evidence-column"><details class="review-evidence-drawer" open><summary><span>审核信息</span><small>准备 · 操作 · 导航</small></summary><div class="review-evidence-content"><section class="review-evidence-card"><h3>评审准备</h3><p>当前手册没有活动的审核任务。可先阅读正文确认内容，再决定是否发起在线评审。</p>${baselineHint}</section><section class="review-evidence-card"><h3>操作入口</h3><button class="button primary full-width" type="button" data-review-online-start>发起在线评审</button></section><section class="review-evidence-card"><h3>导航</h3><nav class="review-waiting-nav"><a class="button secondary" href="/knowledge-center/production?handbookId=${encodeURIComponent(handbookId)}">前往文档生产</a><a class="button secondary" href="/knowledge-center/assets?handbookId=${encodeURIComponent(handbookId)}">返回知识资产</a></nav></section></div></details></aside>`;
  return `<article class="review-workspace review-waiting-workspace"><header class="review-detail-head"><div class="review-heading-group"><span class="eyebrow">审核与发布</span><h2>${esc(title)}</h2><p>阅读正文确认内容，或直接发起在线评审。</p>${selector}</div><span class="review-status neutral" data-review-status>准备阶段</span></header><div class="review-context-strip" aria-label="当前手册上下文"><span>产品 <strong>${esc(handbook?.productType || 'YashanDB')}</strong></span><span>手册 <strong>${esc(title)}</strong></span><span>分支 <strong>${esc(branch)}</strong></span><span>语言 <strong>${language}</strong></span><span>来源 <strong>${source}</strong></span></div><nav class="review-steps" aria-label="当前阶段"><span class="review-step-label">正文阅读</span><span class="review-step-hint">确认内容后可发起在线评审</span></nav><div class="review-main-grid"><div>${emptyBanner}${reader(projection || {}, { handbookId }, ui)}</div>${evidenceColumn}</div>${onlineReviewDialog(handbookId, projection, handbook, onlineReviewBaselines, onlineReviewBaselineError, commits)}</article>`;
}


function unavailableState(projection) {
  const message = typeof projection?.error === 'string' ? projection.error : projection?.error?.message;
  return `<section class="review-zero-state review-error-state" role="alert"><i data-lucide="circle-alert" aria-hidden="true"></i><h2>审核事项暂时无法读取</h2><p>${esc(message || '请检查服务状态后重试，当前页面不会展示缓存任务或旧文档。')}</p><div><button class="button primary" type="button" data-review-reload>重新读取</button><a class="button secondary" href="/knowledge-center/assets">返回知识资产</a></div></section>`;
}

function invalidTaskState(task, issues) {
  return `<section class="review-zero-state review-error-state" role="alert"><i data-lucide="file-warning" aria-hidden="true"></i><h2>审核任务数据不完整</h2><p>缺少或无法识别：${esc(issues.join('、'))}。为避免审核错误版本，差异、评论和发布操作已停止。</p><dl><div><dt>任务</dt><dd>${esc(task?.name || task?.title || idOf(task) || '未识别')}</dd></div><div><dt>处理建议</dt><dd>刷新任务；问题持续时联系平台管理员检查候选版本数据。</dd></div></dl><div><button class="button primary" type="button" data-review-reload>刷新任务</button><a class="button secondary" href="/knowledge-center/assets">返回知识资产</a></div></section>`;
}

function readerTree(items, selected, query = '', task = {}) {
  const normalized = String(query || '').trim().toLowerCase();
  const metrics = reviewMetrics(task);
  const reviewId = list(task?.reviews)[0]?.id || task?.reviewId || '';
  const canComment = task?.capabilities?.canComment === true;
  const render = (nodes, prefix = '') => nodes.map(node => {
    const path = node.path || `${prefix}/${node.name}`.replace(/^\//, '');
    const directory = node.type === 'tree';
    const children = directory ? render(node.children || [], path) : '';
    const visible = !normalized || String(node.name || node.path || '').toLowerCase().includes(normalized) || children.includes('data-review-document');
    if (!visible) return '';
    const operationCount = metrics.operations.filter(operation => operation.path === path || operation.documentId === path).length;
    const opinionCount = metrics.comments.filter(comment => comment.resolved !== true && (comment.anchor?.path === path || comment.anchor?.documentId === path)).length;
    const badges = `${operationCount ? `<span class="review-tree-badge" aria-label="${operationCount} 项修改">改 ${operationCount}</span>` : ''}${opinionCount ? `<span class="review-tree-badge warning" aria-label="${opinionCount} 条未解决意见">议 ${opinionCount}</span>` : ''}`;
    return `<li class="${path === selected ? 'selected' : ''}" data-review-tree-item>${directory ? `<details open><summary>${esc(node.name)}</summary>${children}</details>` : `<button type="button" data-review-document="${esc(path)}" aria-current="${path === selected ? 'page' : 'false'}"><span>${esc(node.name || path)}</span>${badges}</button>`}</li>`;
  }).join('');
  const roots = treeHierarchy(items);
  return roots.length ? `<ul class="review-document-tree-list">${render(roots)}</ul>` : '<p class="review-empty">暂无文档目录。</p>';
}

function readerError(projection) {
  const messages = { GITLAB_OAUTH_REQUIRED: 'GitLab 账号尚未连接', GITLAB_CREDENTIAL_UNAVAILABLE: '平台仓库连接不可用', GITLAB_UNAUTHORIZED: '需要重新连接 GitLab', GITLAB_FORBIDDEN: '无权限访问此仓库内容', HANDBOOK_READ_FORBIDDEN: '没有权限查看此手册', GITLAB_MAPPING_NOT_FOUND: '该手册尚未配置可读内容', GITLAB_LANGUAGE_NOT_MAPPED: '当前语言尚未配置内容映射', GITLAB_BRANCH_NOT_FOUND: '找不到请求的仓库分支', GITLAB_PATH_FORBIDDEN: '当前文档不在手册映射范围内' };
  return messages[projection?.error?.code] || '仓库阅读暂不可用';
}

function reviewAuthorizationState(projection, task) {
  const handbookId = task?.handbookId || projection?.handbookId || '';
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const href = `/knowledge-center/api/gitlab/handbooks/${encodeURIComponent(handbookId)}/oauth/start?returnTo=${encodeURIComponent(returnTo)}`;
  const repo = projection?.connectionName || projection?.project || '';
  return `<section class="review-reader-state review-gitlab-auth" role="alert"><i data-lucide="git-branch" aria-hidden="true"></i><h3>需要连接 GitLab 仓库</h3><p>${repo ? `当前内容来源：${esc(repo)}。` : ''}连接后即可读取本手册的完整正文，审核事项和意见不会丢失。</p><a class="button primary" href="${esc(href)}">连接 GitLab 账号并读取</a></section>`;
}

function repositoryConnectionState(projection, task) {
  const handbookId = task?.handbookId || projection?.handbookId || '';
  const href = `/knowledge-center/assets?handbookId=${encodeURIComponent(handbookId)}`;
  const message = projection?.error?.message || '当前手册尚未关联可读取的 GitLab 仓库。';
  return `<section class="review-reader-state review-gitlab-auth" role="alert"><i data-lucide="git-branch" aria-hidden="true"></i><h3>GitLab 仓库未连接</h3><p>${esc(message)}请先配置对应仓库和文档映射。</p><a class="button primary" href="${href}">连接对应 GitLab 仓库</a></section>`;
}

function commentForm(task, reviewId, scope = 'review') {
  if (!reviewId || task?.capabilities?.canComment !== true) return '';
  const readerMarker = scope === 'reader' ? 'data-review-reader-comment-form' : '';
  return `<form class="review-comment-form" data-review-comment-form ${readerMarker} data-task-id="${esc(idOf(task))}" data-review-id="${esc(reviewId)}"><input type="hidden" name="anchor"><input type="hidden" name="candidateDigest" value="${esc(candidateDigest(task))}"><input type="hidden" name="commentType" value="issue"><input type="hidden" name="severity" value="normal"><p data-review-anchor-status>选中文字可精准定位；不选中则为全文意见。</p><label class="review-comment-body">意见内容<textarea name="comment" required placeholder="在此描述你的意见…"></textarea></label><button class="button primary" type="submit">提交意见</button></form>`;
}

function contextConflict(projection) {
  const conflict = projection?.contextConflict;
  if (!conflict) return '';
  return `<section class="review-reader-state review-context-conflict" role="alert"><i data-lucide="shield-alert" aria-hidden="true"></i><h3>文档上下文不一致</h3><p>请求文档“${esc(conflict.expectedPath)}”，仓库却返回“${esc(conflict.actualPath || '空路径')}”。为避免意见绑定到错误文档，正文和审核操作已停止。</p><button class="button primary" type="button" data-review-reader-refresh>重新读取文档</button></section>`;
}

function roleCards(task) {
  const capabilities = task?.capabilities || {};
  const roles = [['reader', true, '查看候选、基线和文档快照'], ['reviewer', capabilities.canReview === true, '添加意见并作出审核决定'], ['publisher', capabilities.canPublish === true, '确认基线并发布平台版本']];
  return `<div class="review-role-cards" aria-label="当前角色能力">${roles.map(([key, enabled, description]) => `<div class="review-role-card ${enabled ? 'enabled' : 'disabled'}" data-role-card="${key}"><strong>${enabled ? '可用' : '不可用'} · ${roleLabels[key]}</strong><span>${description}</span></div>`).join('')}</div>`;
}

function reader(projection, task, ui = {}) {
  const file = projection?.file;
  const reviewId = list(task?.reviews)[0]?.id || task?.reviewId || '';
  const canComment = task?.capabilities?.canComment === true;
  const language = projection?.language === 'en' ? 'en' : 'zh';
  const branches = list(projection?.branches);
  const snapshot = task?.candidate?.content || task?.draft?.content || task?.content || '';
  // 在线评审的唯一评审对象是服务端创建的正式版本快照。GitLab 目录只辅助
  // 文档导航，不能以随后变化的仓库正文替换已冻结的评审内容。
  const onlineReviewSnapshot = task?.reviewMode === 'online_review' && snapshot;
  const needsAuthorization = projection?.status === 'unauthorized' || ['GITLAB_OAUTH_REQUIRED', 'GITLAB_UNAUTHORIZED'].includes(projection?.error?.code);
  let content;
  const renderDb = (value, path) => renderDatabaseMarkdown(safeMarkdown, value, path, { handbookId: projection.handbookId, branch: projection.branch, language }).html;
  // 等待状态：没有活动任务时，直接用仓库文件内容作为阅读正文。
  const isWaitingForReview = !idOf(task) && !task?.candidate && !task?.draft && !task?.reviewMode;
  if (onlineReviewSnapshot) {
    // 快照内容过短（合成基线占位文本）且有真实仓库正文时，优先显示仓库正文
    const snapshotIsPlaceholder = String(snapshot).trim().length < 500 && file?.content && String(file.content).trim().length > String(snapshot).trim().length;
    if (snapshotIsPlaceholder) {
      content = `<div class="review-reader-repository"><strong class="review-reader-source-label">当前显示仓库正文</strong><p class="review-reader-snapshot-note">评审快照内容不完整，已切换到仓库正文。发起评审时可重新创建包含完整内容的快照。</p>${renderDb(file.content, file.path)}</div>`;
    } else {
      const snapshotHtml = renderDb(snapshot, file?.path || list(task?.target?.documentIds)[0] || '');
      content = `<div class="review-reader-snapshot"><strong>当前显示正式版本评审快照</strong>${snapshotHtml}</div>`;
    }
  }
  else if (projection?.contextConflict) content = contextConflict(projection);
  else if (isWaitingForReview && file?.content) content = `<div class="review-reader-repository"><strong class="review-reader-source-label">当前显示仓库正文</strong>${renderDb(file.content, file.path)}</div>`;
  else if (file?.content) content = renderDb(file.content, file.path);
  else if (needsAuthorization) content = reviewAuthorizationState(projection, task);
  else if (['GITLAB_MAPPING_NOT_FOUND', 'GITLAB_LANGUAGE_NOT_MAPPED', 'GITLAB_CONNECTION_INACTIVE', 'GITLAB_CREDENTIAL_UNAVAILABLE', 'GITLAB_CONNECTOR_DISABLED'].includes(projection?.error?.code)) content = repositoryConnectionState(projection, task);
  else if (snapshot) content = `<div class="review-reader-fallback"><strong>仓库阅读不可用，当前显示候选快照</strong>${renderDb(snapshot, '')}</div>`;
  else if (isWaitingForReview) content = `<section class="review-reader-state" role="status"><h3>仓库正文尚未加载</h3><p>${esc(projection?.error?.message || '正在读取手册仓库内容，请稍候刷新。如果持续无法加载，请检查 GitLab 连接状态和手册映射配置。')}</p><button class="button secondary" type="button" data-review-reader-refresh>刷新阅读</button></section>`;
  else content = `<section class="review-reader-state" role="alert"><h3>${esc(readerError(projection))}</h3><p>${esc(projection?.error?.message || '当前没有可阅读的文档快照。')}</p></section>`;
  const languages = projection?.languages || { zh: true, en: true };
  const snapshotIsPlaceholderFinal = onlineReviewSnapshot && String(snapshot).trim().length < 500 && file?.content && String(file.content).trim().length > String(snapshot).trim().length;
  const sourceLabel = snapshotIsPlaceholderFinal ? (projection?.commitSha ? `仓库提交 ${esc(projection.commitSha.slice(0, 8))}` : '仓库正文') : onlineReviewSnapshot ? '正式版本评审快照' : isWaitingForReview ? (projection?.commitSha ? `仓库提交 ${esc(projection.commitSha.slice(0, 8))}` : '仓库正文') : (projection?.commitSha ? `提交 ${esc(projection.commitSha.slice(0, 8))}` : '候选快照');
  const updatedLabel = projection?.updatedAt ? `<span>更新时间：${esc(new Date(projection.updatedAt).toLocaleString('zh-CN', { hour12: false }))}</span>` : '';
  const collapsed = ui.directoryCollapsed === true;
  const directoryWidth = Math.min(360, Math.max(200, Number(ui.directoryWidth) || 260));
  const metrics = reviewMetrics(task);
  const mappedOperations = metrics.operations.filter(operation => operation.path && list(projection?.tree).some(item => item.path === operation.path)).length;
  const markerNote = metrics.operations.length && mappedOperations < metrics.operations.length ? `<p class="review-directory-note">${metrics.operations.length} 项修改中有 ${metrics.operations.length - mappedOperations} 项缺少仓库路径映射，仅在差异视图展示。</p>` : '';
  const matchingOperation = metrics.operations.filter(operation => operation.path === file?.path);
  // 在线评审快照没有增量 operations。当前文档被明确选入评审范围时，
  // 使用冻结 target 中的文档标识，保证阅读选区仍能形成可追溯的行级意见。
  const scopedDocuments = list(task?.target?.documentIds);
  const documentId = matchingOperation.length === 1
    ? matchingOperation[0].documentId
    : (task?.target?.scope === 'document' && scopedDocuments.length === 1 && (scopedDocuments[0] === file?.path || (task.target.documentPaths || task.target.paths || [])[0] === file?.path)
      ? scopedDocuments[0]
      : (file?.path || projection?.requestedPath || ''));
  const commentEntry = canComment && reviewId
    ? '<p class="review-reading-hint" data-review-selection-hint>在阅读文档中提出意见：选中正文中的文字即可精准定位；未选中时作为全文意见提交。</p>'
    : isWaitingForReview ? ''
    : `<p class="review-reading-hint">${task?.capabilities?.canComment === false ? '当前账号仅可阅读，暂无在线提意见权限。' : '请先提交审核候选后再提出意见。'}</p>`;
  const selectionBubble = canComment && reviewId
    ? '<div class="review-selection-bubble" data-review-selection-bubble hidden><button type="button" class="review-bubble-btn" data-review-bubble-trigger aria-label="对选中文字提出意见" title="对选中文字提出意见">💬</button></div>'
    : '';
  return `<section class="review-reading-layout ${collapsed ? 'directory-collapsed' : ''} density-comfortable" style="--review-directory-width:${directoryWidth}px" aria-label="审核文档阅读区"><aside class="review-document-tree"><div class="review-directory-head"><h3>文档目录</h3><button class="review-directory-toggle" type="button" data-review-directory-toggle aria-expanded="${!collapsed}" aria-label="${collapsed ? '展开文档目录' : '收起文档目录'}" title="${collapsed ? '展开文档目录' : '收起文档目录'}"><i data-lucide="${collapsed ? 'panel-left-open' : 'panel-left-close'}" aria-hidden="true"></i><span>${collapsed ? '展开' : '收起'}</span></button></div><div class="review-directory-content"><div class="review-reader-toolbar"><label for="review-document-search">搜索文档</label><input id="review-document-search" type="search" placeholder="按文件名筛选" data-review-document-search></div>${markerNote}${readerTree(projection?.tree, file?.path || projection?.requestedPath, projection?.search || '', task)}</div><div class="review-directory-resizer" data-review-directory-resizer role="separator" aria-orientation="vertical" aria-label="调整文档目录宽度" aria-valuemin="200" aria-valuemax="360" aria-valuenow="${directoryWidth}" tabindex="${collapsed ? '-1' : '0'}"></div></aside><main class="review-document-content" data-review-document-id="${esc(documentId)}"><header class="review-reader-head"><div><h3>${esc(file?.path || (projection?.contextConflict ? '文档读取已停止' : isWaitingForReview ? '手册正文' : '当前候选快照'))}</h3><p>${esc(projection?.branch || '候选版本')} · ${language === 'en' ? 'English' : '中文'} · ${sourceLabel}</p></div>${updatedLabel}</header><div class="review-reader-controls"><label>选择分支<select data-review-branch ${branches.length ? '' : 'disabled'}>${branches.map(branch => `<option value="${esc(branch.name)}" ${branch.name === projection?.branch ? 'selected' : ''}>${esc(branch.name)}</option>`).join('')}</select></label><div class="review-reader-language" role="group" aria-label="文档语言"><button type="button" data-review-language="zh" aria-pressed="${language === 'zh'}" ${languages.zh === false ? 'disabled' : ''}>中文</button><button type="button" data-review-language="en" aria-pressed="${language === 'en'}" ${languages.en === false ? 'disabled' : ''}>English</button></div><button class="button secondary compact" type="button" data-review-focus-toggle aria-pressed="${ui.focusMode === true}">${ui.focusMode === true ? '退出专注' : '专注阅读'}</button><button class="button tertiary compact" type="button" data-review-reader-refresh>刷新阅读</button></div>${content}${commentEntry}${selectionBubble}</main></section>`;
}

function diff(task, data, review) {
  if (data?.error) return `<section class="review-step-panel"><div class="review-reader-state"><h3>差异暂不可用</h3><p>${esc(data.error.message)}</p><button type="button" class="button secondary" data-review-reload>重新读取差异</button></div></section>`;
  const before = data?.baseline?.content ?? data?.before ?? task?.baseline?.content ?? task?.baselineContent ?? '';
  const after = data?.candidate?.content ?? data?.after ?? task?.candidate?.content ?? task?.draft?.content ?? task?.content ?? '';
  const beforeLines = String(before).split(/\r?\n/); const afterLines = String(after).split(/\r?\n/); const max = Math.max(beforeLines.length, afterLines.length, 1);
  const operations = list(data?.operations || task?.candidate?.operations || task?.draft?.operations);
  const operation = operations.length === 1 ? operations[0] : null;
  const reviewId = review?.id || '';
  const focusedLine = Number(new URLSearchParams(window.location.search).get('line'));
  const renderLine = (beforeLine, afterLine, side) => {
    const beforeValue = String(beforeLine ?? ''); const afterValue = String(afterLine ?? '');
    if (!beforeValue || !afterValue || beforeValue === afterValue) return esc(side === 'before' ? beforeValue : afterValue);
    let prefix = 0; while (prefix < beforeValue.length && prefix < afterValue.length && beforeValue[prefix] === afterValue[prefix]) prefix += 1;
    let suffix = 0; while (suffix < beforeValue.length - prefix && suffix < afterValue.length - prefix && beforeValue[beforeValue.length - 1 - suffix] === afterValue[afterValue.length - 1 - suffix]) suffix += 1;
    const value = side === 'before' ? beforeValue : afterValue;
    const changedEnd = Math.max(prefix, value.length - suffix);
    return `${esc(value.slice(0, prefix))}<mark>${esc(value.slice(prefix, changedEnd))}</mark>${esc(value.slice(changedEnd))}`;
  };
  const rows = Array.from({ length: max }, (_, index) => {
    const beforeLine = beforeLines[index] ?? ''; const afterLine = afterLines[index] ?? '';
    const change = beforeLine === afterLine ? 'unchanged' : (!beforeLine ? 'added' : !afterLine ? 'deleted' : 'updated');
    return `<div class="review-full-diff-row ${change} ${focusedLine === index + 1 ? 'selected' : ''}" data-review-diff-row="${index + 1}"><button type="button" class="review-line-button" data-review-line="${index + 1}" data-document-id="${esc(operation?.documentId || '')}" data-node-id="${esc(operation?.nodeId || '')}" data-anchor-kind="after_operation" title="选择第 ${index + 1} 行并添加意见">${index + 1}</button><code class="review-before">${renderLine(beforeLine, afterLine, 'before')}</code><code class="review-after">${renderLine(beforeLine, afterLine, 'after')}</code></div>`;
  }).join('');
  const anchorHint = operations.length > 1 ? '当前修改涉及多个位置；未选择可确认的变更位置时，将作为全文意见提交。' : '选择具体行可关联到当前变更位置；未选择时将作为全文意见提交。';
  return `<section class="review-step-panel"><header><div><h3>修改前后全文对照</h3><p>正式版本内容与候选版本逐行对照；变更行显示字符级高亮。</p></div><span>共 ${max} 行 · 新增 ${data?.counts?.added ?? 0} · 修改 ${data?.counts?.updated ?? 0} · 删除 ${data?.counts?.deleted ?? 0} · 移动 ${data?.counts?.moved ?? 0}</span></header><div class="review-diff-head"><span>行号</span><strong>修改前</strong><strong>修改后</strong></div><div class="review-full-diff">${rows}</div>${reviewId ? `${commentForm(task, reviewId, 'diff').replace('尚未选择具体位置，将作为全文意见提交。', anchorHint)}` : ''}</section>`;
}

function evidence(task, step) {
  const ai = task?.ai || task?.aiAnalysis || null; const lineage = task?.lineage || task?.lineageSummary || null;
  const checks = list(task?.checks?.checks);
  const domainChecks = checks.filter(check => ['sql_syntax', 'parameter_dependency', 'version_compatibility', 'error_code', 'operation_command'].includes(check.category));
  const events = [[task.createdAt, '任务创建', task.createdBy], [task.candidate?.createdAt, '候选冻结', task.candidate?.createdBy], [list(task.reviews)[0]?.submittedAt, '提交审核', list(task.reviews)[0]?.submittedBy], [list(task.reviews)[0]?.decision?.decidedAt, '审核决定', list(task.reviews)[0]?.decision?.decidedBy], [task.publication?.publishedAt, '版本发布', task.publication?.publishedBy]].filter(([at]) => at);
      const checkContent = domainChecks.length ? `<ul class="review-check-list">${domainChecks.map(check => `<li class="${check.passed ? 'passed' : 'failed'}"><strong>${esc(check.label || check.message || check.code)}</strong><span>${check.passed ? '通过' : '需人工确认'} · ${esc(check.evidence || '证据由检查结果记录')}</span></li>`).join('')}</ul>` : '<p class="muted">数据库语法、参数依赖、版本适配、错误码和运维命令专项检查尚未执行。</p>';
  const historyLabel = list(task?.history || []).length ? `审核历史（${list(task.history).length}）` : '审核历史';
      return `<section class="review-evidence-card"><h3>角色与门禁</h3>${roleCards(task)}</section><section class="review-evidence-card"><h3>内容质量检查</h3>${checkContent}${checks.length && !domainChecks.length ? `<small>已完成 ${checks.length} 项完整性检查。</small>` : ''}</section><section class="review-evidence-card"><h3>AI 辅助建议</h3>${ai ? `<details open><summary>${esc(ai.verdict || '待人工确认')} · ${esc(ai.analysisType || '综合检查')}</summary><p>${esc(ai.reasoningSummary || '尚无可展示的分析摘要')}</p><small>规则：${esc(list(ai.ruleRefs).join('、') || '尚无引用')} · 证据：${esc(list(ai.evidenceRefs).join('、') || '尚无引用')} · 执行时间：${esc(timestamp(ai.executedAt) || '尚未记录')}</small></details>` : '<p class="muted">暂无真实 AI 分析结果：分析尚未执行。</p>'}</section><section class="review-evidence-card"><h3>版本变更记录</h3><ol class="review-lineage">${events.length ? events.map(([at, label, actor]) => `<li><strong>${label}</strong><span>${esc(timestamp(at))} · ${esc(actor?.displayName || actor?.name || actor?.id || '系统记录')}</span></li>`).join('') : '<li><strong>尚无变更记录</strong><span>候选、审核和发布时间线将在服务端产生真实事件后显示。</span></li>'}</ol><dl><dt>候选摘要</dt><dd><code>${esc(lineage?.candidateDigest || candidateDigest(task))}</code></dd><dt>发布记录</dt><dd>${esc(lineage?.publicationId || task?.publication?.id || '尚未发布')}</dd></dl></section><section class="review-evidence-card"><h3>${historyLabel}</h3><p class="muted">暂无可回看的历史任务。</p></section>`;
}

function history(items, activeId) {
  const records = list(items).filter(task => ['rejected', 'published'].includes(rawStatus(task)) && String(idOf(task)) !== String(activeId));
  if (!records.length) return '';
  return `<details class="review-history"><summary>审核历史（${records.length}）</summary><ul>${records.map(task => `<li><a href="/knowledge-center/review?taskId=${encodeURIComponent(idOf(task))}&handbookId=${encodeURIComponent(task.handbookId || '')}">${esc(task.name || task.title || '审核事项')}</a><span>${esc(statusLabel(task))} · ${esc(timestamp(task.updatedAt))}</span></li>`).join('')}</ul></details>`;
}

function opinions(task, review) {
  const comments = list(review?.comments || task?.comments);
  const canManageThread = task?.capabilities?.canComment === true;
  const severityLabel = severity => severity === 'blocker' ? '阻断意见' : severity === 'important' ? '历史重要意见' : '普通意见';
  const locationLabel = comment => {
    if (!comment.anchor) return '全文意见';
    const line = comment.anchor.lineRange?.startLine ?? comment.anchor.lineRange?.start;
    const suffix = comment.anchorStatus === 'needs_manual_confirmation' ? '，需要人工确认位置' : comment.anchorStatus === 'invalidated' ? '，位置已失效' : '';
    return `修改位置：${comment.anchor.documentId}${line ? ` · 第 ${line} 行` : ''}${suffix}`;
  };
  const records = comments.length ? comments.map(comment => {
    const replies = list(comment.replies);
    const location = comment.anchor ? `<button class="button link" type="button" data-review-comment-locate="${esc(comment.id)}" data-document-id="${esc(comment.anchor.documentId || comment.anchor.path || '')}" data-review-node-id="${esc(comment.anchor.nodeId || '')}" data-review-anchor-kind="${esc(comment.anchor.anchorKind || '')}" data-review-line="${esc(comment.anchor.lineRange?.startLine ?? comment.anchor.lineRange?.start ?? '')}">查看文档位置</button>` : '';
    const replyFormId = `review-reply-${String(comment.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const lifecycle = canManageThread ? `<div class="review-opinion-actions">${location}<button class="button secondary compact" type="button" data-review-reply-toggle="${esc(comment.id)}" aria-expanded="false" aria-controls="${replyFormId}">回复</button>${comment.resolved === true ? `<button class="button secondary compact" type="button" data-review-comment-reopen="${esc(comment.id)}" data-task-id="${esc(idOf(task))}" data-review-id="${esc(review?.id || '')}">重新打开</button>` : `<button class="button secondary compact" type="button" data-review-comment-resolve="${esc(comment.id)}" data-task-id="${esc(idOf(task))}" data-review-id="${esc(review?.id || '')}">标记已处理</button>`}</div><form id="${replyFormId}" class="review-reply-form" hidden data-review-reply-form data-task-id="${esc(idOf(task))}" data-review-id="${esc(review?.id || '')}" data-comment-id="${esc(comment.id)}"><label for="${replyFormId}-content">回复内容</label><textarea id="${replyFormId}-content" name="comment" required placeholder="补充处理结论或需要确认的事实"></textarea><div><button class="button secondary compact" type="submit">发送回复</button><button class="button link compact" type="button" data-review-reply-cancel="${esc(comment.id)}">取消</button></div></form>` : location;
    return `<article class="review-opinion ${comment.severity === 'blocker' && comment.resolved !== true ? 'blocker' : ''}" tabindex="-1" data-review-opinion data-review-comment-id="${esc(comment.id)}" data-severity="${esc(comment.severity || 'normal')}" data-resolved="${comment.resolved === true}"><header><strong>${esc(comment.author?.displayName || '审核成员')}</strong><span class="review-opinion-state">${esc(comment.resolved === true ? '已处理' : '待处理')}</span></header><div class="review-opinion-meta"><span>${esc(severityLabel(comment.severity))}</span><span>${esc(locationLabel(comment))}</span></div><p>${esc(comment.content || comment.body || comment.comment || '')}</p>${replies.length ? `<ol class="review-replies">${replies.map(reply => `<li><strong>${esc(reply.author?.displayName || '审核成员')}</strong><span>${esc(reply.content || reply.body || '')}</span></li>`).join('')}</ol>` : ''}${lifecycle}</article>`;
  }).join('') : `<section class="review-opinion-empty"><h4>当前没有审核意见</h4><p>请先在“阅读文档”选择文字，或在“查看修改”选择具体行后提出意见。</p><div><button class="button secondary" type="button" data-review-step="read">阅读文档并添加意见</button><button class="button primary" type="button" data-review-step="diff">查看修改并添加意见</button></div></section>`;
  const unresolved = comments.filter(comment => comment.resolved !== true).length;
  const blockers = comments.filter(comment => comment.resolved !== true && comment.severity === 'blocker').length;
  const canReview = task?.capabilities?.canReview === true; const canPublish = task?.capabilities?.canPublish === true;
  const revision = task?.capabilities?.canRevise === true ? `<button class="button secondary" type="button" data-review-revision="${esc(idOf(task))}">创建修订任务</button>` : '';
  const threadPermission = canManageThread
    ? '当前账号可以回复、标记已处理和重新打开意见。'
    : '当前账号仅可查看意见。任务处于审核中且具备文档编辑员或审核管理员权限时，才可回复或标记已处理。';
  return `<section class="review-step-panel review-opinions-panel"><header><div><h3>审核意见与决定</h3><p>按意见处理进度逐项确认；AI 结果仅作为可核对依据，不直接改变审核结论。</p></div><span>${comments.length} 条意见</span></header><p class="review-thread-permission ${canManageThread ? 'enabled' : ''}">${threadPermission}</p>${comments.length ? `<label class="review-opinion-filter">查看<select data-review-opinion-filter><option value="all">全部意见</option><option value="open">未处理意见</option><option value="blocker">阻断意见</option></select></label>` : ''}<div class="review-opinions">${records}</div><div class="review-ai-note"><strong>审核原则</strong><p>数据库语法、参数依赖、版本适配和错误码准确性必须由具备领域责任的审核人确认。</p></div><div class="review-decision-bar"><span>${blockers ? `尚有 ${blockers} 条阻断意见未处理，不能审核通过` : unresolved ? `尚有 ${unresolved} 条未处理意见` : '没有未处理意见'}</span><div>${revision}${canReview && review?.status === 'pending' ? `<details class="review-return"><summary>退回修改</summary><form data-review-decision-form data-task-id="${esc(idOf(task))}" data-review-id="${esc(review?.id || '')}"><label>退回原因<textarea name="comment" required placeholder="请说明需要修改的内容"></textarea></label><button class="button tertiary" type="submit">确认退回</button></form></details><button class="button primary" data-review-decision="approve" data-task-id="${esc(idOf(task))}" data-review-id="${esc(review?.id || '')}" ${blockers ? 'disabled aria-disabled="true" title="请先处理全部阻断意见"' : ''}>审核通过</button>` : ''}${canPublish && ['approved', 'pending_publish'].includes(rawStatus(task)) ? `<button class="button primary" data-review-publish="${esc(idOf(task))}">确认发布</button>` : ''}</div></div></section>`;
}

function detail(task, tasks, allTasks, step, projection, diffData, ui) {
  const issues = taskIssues(task);
  if (issues.length) return invalidTaskState(task, issues);
  const review = list(task.reviews)[0];
  const current = ['read', 'diff', 'opinions'].includes(step) ? step : 'read';
  const body = projection?.contextConflict && current !== 'read' ? contextConflict(projection) : current === 'read' ? reader(projection, task, ui) : current === 'diff' ? diff(task, diffData, review) : opinions(task, review);
  const baseline = task.baselineVersionLabel || task.baselineVersionName || task.baselineVersionId;
  const metrics = reviewMetrics(task); const unresolved = metrics.unresolved;
  const capability = task?.capabilities?.canReview ? '可提交审核决定' : task?.capabilities?.canComment ? '可阅读并提交意见，不可审核当前候选' : '仅可阅读，不可审核或发布';
  const productName = task.productName || 'YashanDB';
  const handbookName = task.handbookName || task.name || task.title || '产品描述手册';
  // 评论抽屉：默认折叠；上半部显示当前文件的已有意见，下半部为全文意见表单
  const drawerComments = list(review?.comments);
  const drawerCommentsList = drawerComments.length
    ? `<div class="review-drawer-comments">${drawerComments.map(comment => {
        const authorName = comment.author?.displayName || comment.author?.name || '审核成员';
        const body = comment.content || comment.body || comment.comment || '';
        const resolved = comment.resolved === true;
        const anchor = comment.anchor || {};
        return `<button type="button" class="review-drawer-comment-item ${resolved ? 'resolved' : ''}" data-review-drawer-comment="${esc(comment.id)}" data-document-id="${esc(commentPath(comment.anchor, task, projection?.tree || []))}"><div class="review-drawer-comment-head"><strong>${esc(authorName)}</strong><span>${resolved ? '已处理' : '待处理'}</span></div><p>${esc(body.length > 60 ? body.slice(0, 60) + '…' : body)}</p><small>${comment.anchor ? esc(anchor.selectedText || '历史位置意见') : '全文意见'}</small></button>`;
      }).join('')}</div>`
    : '<p class="review-drawer-empty">当前文件暂无意见。选中正文文字，点击气泡即可提出。</p>';
  const drawerForm = task?.capabilities?.canComment && review?.id
        ? `<div class="review-drawer-fulltext-form"><p class="review-drawer-hint">全文意见（兼容模式）：</p>${commentForm(task, review.id, 'reader')}</div>`
    : '';
  const commentDrawer = (review?.id)
    ? `<section class="review-evidence-card review-comment-drawer"><details data-review-comment-drawer><summary title="提出意见" aria-label="提出意见"><h3>提出意见</h3><small>${drawerComments.length ? `${drawerComments.length} 条已有意见` : '选中文字精准定位'}</small></summary><button type="button" class="icon-button review-panel-close" data-review-panel-close aria-label="关闭意见侧栏" title="关闭意见侧栏"><i data-lucide="x" aria-hidden="true"></i></button>${drawerCommentsList}${drawerForm}</details></section>`
    : '';
  const evidenceCards = evidence(task, current);
  const evidenceDrawer = `<details class="review-evidence-drawer"><summary title="审核依据" aria-label="审核依据"><span>审核依据</span><small>角色 · 检查 · 血缘</small></summary><button type="button" class="icon-button review-panel-close" data-review-panel-close aria-label="关闭审核依据侧栏" title="关闭审核依据侧栏"><i data-lucide="x" aria-hidden="true"></i></button><div class="review-evidence-content">${evidenceCards}</div></details>`;
  return `<article class="review-workspace"><header class="review-detail-head"><div class="review-heading-group"><span class="eyebrow">审核与发布</span><h2>${esc(task.name || task.title || '审核事项')}</h2><p>${esc(capability)}</p>${tasks.length > 1 ? taskSelector(tasks, idOf(task)) : ''}${history(allTasks, idOf(task))}</div><span class="review-status" data-review-status>${esc(statusLabel(task))}</span></header><div class="review-context-strip" aria-label="当前审核上下文"><span>产品 <strong>${esc(productName)}</strong></span><span>手册 <strong>${esc(handbookName)}</strong></span><span>业务版本 <strong>${esc(task.businessVersion || '未关联')}</strong></span><span>待审核版本：修改稿</span><span>候选 <code>${esc(candidateDigest(task).slice(0, 8))}</code></span><span>未解决意见 <strong>${unresolved}</strong></span></div><nav class="review-steps" aria-label="审核步骤"><button class="${current === 'read' ? 'active' : ''}" data-review-step="read">1 阅读文档</button><button class="${current === 'diff' ? 'active' : ''}" data-review-step="diff">2 查看修改（${metrics.operations.length}）</button><button class="${current === 'opinions' ? 'active' : ''}" data-review-step="opinions">3 处理审核意见（${unresolved}）</button></nav><div class="review-main-grid"><div class="review-stage">${body}</div><aside class="review-evidence-column">${commentDrawer}${evidenceDrawer}</aside></div></article>`;
}

export function renderReviewPublishing({ reviewProjection, gitlabProjection, reviewUi }) {
  const projection = reviewProjection || {};
  if (projection.status === 'loading') return '<section class="review-loading-state" role="status" aria-label="正在读取审核事项"><div class="review-skeleton-head"></div><div class="review-skeleton-body"><i></i><i></i><i></i></div><p>正在读取审核事项…</p></section>';
  if (projection.status === 'unavailable') return unavailableState(projection);
  const tasks = list(projection.items || projection.tasks || projection.data);
  if (!tasks.length && projection.handbookId) return handbookWaitingState(projection.handbookId, gitlabProjection || {}, list(projection.reviewHandbooks), reviewUi || {}, projection.onlineReviewBaselines, projection.onlineReviewBaselineError, projection.onlineReviewCommits || []);
  if (!tasks.length) return emptyState();
  const detailValue = projection.detail?.task ?? projection.detail;
  const detailTask = detailValue && typeof detailValue === 'object' && idOf(detailValue) ? detailValue : null;
  const requested = new URLSearchParams(window.location.search).get('taskId');
  const selected = idOf(detailTask) || requested || idOf(tasks[0]);
  const task = detailTask && String(idOf(detailTask)) === String(selected) ? detailTask : tasks.find(item => String(idOf(item)) === String(selected));
  const step = new URLSearchParams(window.location.search).get('step') || 'read';
  return detail(task, tasks, list(projection.allItems), step, gitlabProjection || {}, projection.diff, reviewUi || {});
}
