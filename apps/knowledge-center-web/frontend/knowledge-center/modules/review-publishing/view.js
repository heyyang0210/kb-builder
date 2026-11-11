import { renderReviewWorkbench, reviewNavigation, reviewDocumentUrl, reviewUrl } from './workbench.js';
import { escapeHtml } from '../../common/utils/dom.js';
import { safeMarkdown, treeHierarchy } from '../repository/view.js';
import { renderDirectoryTree } from '../../common/directory-tree.js';
import { renderDatabaseMarkdown } from '../../common/markdown/markdown-renderer.js';
import { commentPath } from './anchors.js';

const labels = { candidate_ready: '待提交审核', under_review: '审核中', review_pending: '审核中', approved: '待发布', pending_publish: '待发布', rejected: '已退回', published: '已发布', mr_submitted: '已提交 MR' };
const roleLabels = { reader: '阅读角色', reviewer: '审核角色', publisher: '发布角色' };
const requiredTaskFields = [['id', '任务标识'], ['handbookId', '手册'], ['businessVersion', '业务版本'], ['baselineVersionId', '正式基线'], ['candidateDigest', '候选摘要']];
const list = value => Array.isArray(value) ? value : [];
const idOf = task => task?.id || task?.taskId || '';
const rawStatus = task => task?.state || task?.status || '';
const candidateDigest = task => task?.candidateDigest || task?.candidate?.digest || '';
const esc = value => escapeHtml(value ?? '');
const timestamp = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '';
function productionEditorUrl(handbookId, path = '', branch = '') {
  const query = new URLSearchParams();
  if (path) query.set('reviewPath', path);
  if (branch) query.set('branch', branch);
  return `/knowledge-center/production/handbook/${encodeURIComponent(handbookId)}${query.size ? `?${query}` : ''}`;
}

export function updateReviewWaitingEntry(root, projection = {}) {
  const handbookId = projection.handbookId || '';
  const path = projection.file?.path || projection.path || projection.requestedPath || '';
  const branch = projection.branch || '';
  const entry = root.querySelector('[data-review-production-editor]');
  if (entry) entry.href = productionEditorUrl(handbookId, path, branch);
  const form = root.querySelector('[data-review-online-form]');
  if (form) {
    form.dataset.documentPath = projection.file?.path || '';
    form.dataset.branch = branch;
  }
}

function reviewMetrics(task) {
  const operations = list(task?.candidate?.operations || task?.draft?.operations).map(operation => ({ ...operation, path: operation.path || task?.handbookSource?.documents?.find(item => item.documentId === operation.documentId)?.filePath }));
  const comments = list(task?.reviews).flatMap(review => list(review.comments));
  return {
    operations,
    comments,
    unresolved: comments.filter(comment => comment.resolved !== true).length,
    blockers: comments.filter(comment => comment.resolved !== true && comment.severity === 'blocker').length,
  };
}

function statusLabel(task) { return labels[rawStatus(task)] || '状态异常'; }

function defaultReviewStep(task, review) {
  if (rawStatus(task) === 'mr_submitted' && task?.deliveryObservation?.state === 'closed') return 'read';
  return review?.status === 'pending' && reviewMetrics(task).operations.length ? 'diff' : 'read';
}

function reviewFlow(task, review, reviewerName, editHref, ui = {}) {
  const state = rawStatus(task);
  const delivery = task?.deliveryObservation?.state;
  const completion = task?.completion?.status;
  const closed = state === 'mr_submitted' && delivery === 'closed';
  const mayReturnToWriting = ui.canWrite === true && (ui.canManage === true || String(task?.createdBy?.id || '') === String(ui.currentUserId || ''));
  const phase = state === 'under_review' && review?.status === 'pending' ? '待审核' : state === 'mr_submitted' ? '审核已通过' : statusLabel(task);
  const result = completion === 'completed' ? '文档已完成' : closed ? 'MR 已关闭，交付未完成'
    : state === 'mr_submitted' && delivery === 'merged' ? '已合并，待正文和图片回读'
      : state === 'mr_submitted' ? '等待人工合并' : state === 'approved' || state === 'pending_publish' ? '待创建 MR' : '尚未进入交付';
  let title = '查看当前审核内容';
  let note = '可在阅读、修改和意见之间切换';
  let action = '';
  if (closed) {
    title = result;
    note = '请先核对 MR 关闭原因；重新交付需修订文档并再次送审';
    if (mayReturnToWriting) action = `<a class="button primary" href="${esc(editHref)}">返回文档修订</a>`;
  } else if (review?.status === 'pending') {
    title = reviewerName && reviewerName !== '人员未匹配' ? `待${reviewerName}审核` : '待审核人处理';
    note = reviewMetrics(task).operations.length ? `先核对 ${reviewMetrics(task).operations.length} 处修改，再提出意见或作出决定` : '阅读冻结正文后提出意见或作出决定';
    const step = defaultReviewStep(task, review);
    action = `<button class="button primary" type="button" data-review-step="${step}">${step === 'diff' ? '查看修改' : '阅读文档'}</button>`;
  } else if (state === 'approved' || state === 'pending_publish') {
    title = '审核已通过，待创建 MR';
    note = '由具有交付权限的人员继续处理';
  } else if (state === 'mr_submitted' && task?.deliveryFailure) {
    title = '交付回读失败';
    note = `最近核验失败（${task.deliveryFailure.code || 'DELIVERY_READBACK_FAILED'}），交付尚未完成。请核对目标正文和图片后重新读取。`;
    if (task?.capabilities?.canRefreshDelivery === true) action = `<button class="button primary" type="button" data-review-delivery-refresh="${esc(idOf(task))}">重新回读</button>`;
  } else if (state === 'mr_submitted' && delivery === 'merged' && completion !== 'completed') {
    title = result;
    note = '待服务端核对目标正文与图片';
  } else if (completion === 'completed') {
    title = result;
    note = '交付结果已由服务端确认';
  } else if (state === 'rejected') {
    title = '已退回，待文档负责人修订';
    note = '原审核意见与冻结快照仍可查看';
    if (task?.capabilities?.canRevise === true || mayReturnToWriting && task.handbookSource) action = `<a class="button primary" href="${esc(editHref)}">返回文档修订</a>`;
  }
  return { phase, result, title, note, action, closed };
}

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

function onlineReviewDialog(handbookId, projection, handbook) {
  const name = handbook?.name || handbook?.handbookName || projection?.handbookName || handbookId;
  const branch = projection?.branch || '';
  const filePath = projection?.file?.path || '';
  return `<dialog class="review-online-dialog" data-review-online-dialog aria-labelledby="review-online-title" data-scroll-region="dialog"><form data-review-online-form data-handbook-id="${esc(handbookId)}" data-document-path="${esc(filePath)}" data-branch="${esc(branch)}"><header><div><span class="eyebrow">审核与发布</span><h2 id="review-online-title">发起在线评审</h2><p>选择已保存的修改稿；审核通过后可创建 GitLab MR。</p></div><button class="icon-button" type="button" data-review-online-close aria-label="关闭发起在线评审"><i data-lucide="x" aria-hidden="true"></i></button></header><div class="review-online-context"><div><span>手册</span><strong>${esc(name)}</strong></div><div><span>目标分支</span><strong>${esc(branch || '按所选修改稿确定')}</strong></div></div><fieldset><legend>评审范围</legend><label><input type="radio" name="scope" value="document" checked>单篇文档</label><label><input type="radio" name="scope" value="handbook">整本手册所选文档</label></fieldset><div data-review-online-drafts role="group" aria-label="已保存修改稿"><p>正在读取已保存修改稿…</p></div><label>审核人<select name="reviewerId" required data-review-online-reviewer><option value="">正在读取审核人…</option></select></label><label>提交说明（可选）<textarea name="note" rows="3" maxlength="500"></textarea></label><div class="review-online-error" data-review-online-error role="alert" tabindex="-1" hidden></div><footer><button class="button secondary" type="button" data-review-online-cancel>取消</button><button class="button primary" type="submit">提交在线评审</button></footer></form></dialog>`;
}

function handbookWaitingState(handbookId, projection, handbooks = [], ui = {}, onlineReviewBaselines = [], onlineReviewBaselineError = null, commits = []) {
  const handbook = handbooks.find(item => String(item.handbookId || item.id) === String(handbookId));
  const title = projection?.handbookName || handbook?.name || handbook?.handbookName || handbookId;
  const language = projection?.language === 'en' ? 'English' : '中文';
  const branch = projection?.branch || '候选版本';
  const currentPath = projection?.file?.path || projection?.path || projection?.requestedPath || '';
  const source = projection?.commitSha ? `提交 ${esc(projection.commitSha.slice(0, 8))}` : '正式内容';
  const selector = handbooks.length > 1 ? `<label class="review-task-switcher" for="review-handbook-select"><span>当前手册</span><select id="review-handbook-select" data-review-handbook-select>${handbooks.map(item => `<option value="${esc(item.handbookId || item.id)}" ${String(item.handbookId || item.id) === String(handbookId) ? 'selected' : ''}>${esc(item.name || item.handbookName || item.handbookId)}</option>`).join('')}</select></label>` : '';
  // 阅读区顶部嵌入空态提示条
  const emptyBanner = ui.hasReviewDocuments ? '' : '<div class="review-empty-banner" role="status"><i data-lucide="inbox" aria-hidden="true"></i><div><h3 class="review-empty-banner-title">尚无待审核修改稿</h3><p>请先在文档生产编辑并保存正文，再提交在线评审。与 GitLab 正文相同的内容不能提交 MR。</p></div></div>';
  // 右侧审核信息区：§17.5 结构，首卡为评审准备说明
  const baselineHint = '<p class="review-prep-hint">在线评审只读取已保存修改稿，服务端按目标分支提交冻结对比基线。</p>';
  const evidenceColumn = `<aside class="review-evidence-column" data-scroll-region="panel"><details class="review-evidence-drawer" open><summary><span>审核信息</span><small>准备 · 操作 · 导航</small></summary><div class="review-evidence-content"><section class="review-evidence-card"><h3>评审准备</h3><p>${ui.hasReviewDocuments ? '从目录选择文档，查看其审核候选。开启显示所有文档可以阅读全文。' : '当前手册没有活动的审核任务，可先阅读正文确认内容。'}</p>${baselineHint}</section><section class="review-evidence-card"><h3>操作入口</h3><button class="button primary full-width" type="button" data-review-online-start>发起在线评审</button><a class="button secondary full-width" data-review-production-editor href="${esc(productionEditorUrl(handbookId, currentPath, projection?.branch || ''))}">编辑此文档并发起评审</a></section><section class="review-evidence-card"><h3>导航</h3><nav class="review-waiting-nav"><a class="button secondary" href="/knowledge-center/production?handbookId=${encodeURIComponent(handbookId)}">前往文档生产</a><a class="button secondary" href="/knowledge-center/assets?handbookId=${encodeURIComponent(handbookId)}">返回知识资产</a></nav></section></div></details></aside>`;
  return `<article class="review-workspace review-waiting-workspace"><header class="review-detail-head"><div class="review-heading-group"><span class="eyebrow">审核与发布</span><h2>${esc(title)}</h2><p>阅读正文确认内容；修改后在文档生产保存并送审，审核通过即可创建 GitLab MR。</p>${selector}</div><span class="review-status neutral" data-review-status>${ui.hasReviewDocuments ? '手册阅读' : '准备阶段'}</span></header><div class="review-context-strip" aria-label="当前手册上下文"><span>产品 <strong>${esc(handbook?.productType || 'YashanDB')}</strong></span><span>手册 <strong>${esc(title)}</strong></span><span>分支 <strong>${esc(branch)}</strong></span><span>语言 <strong>${language}</strong></span><span>来源 <strong>${source}</strong></span></div><nav class="review-steps" aria-label="当前阶段"><span class="review-step-label">正文阅读</span><span class="review-step-hint">编辑并保存修改稿后发起评审</span></nav><div class="review-main-grid"><div>${emptyBanner}${reader(projection || {}, { handbookId }, ui)}</div>${evidenceColumn}</div>${onlineReviewDialog(handbookId, projection, handbook)}</article>`;
}


function unavailableState(projection) {
  const message = typeof projection?.error === 'string' ? projection.error : projection?.error?.message;
  return `<section class="review-zero-state review-error-state" role="alert"><i data-lucide="circle-alert" aria-hidden="true"></i><h2>审核事项暂时无法读取</h2><p>${esc(message || '请检查服务状态后重试，当前页面不会展示缓存任务或旧文档。')}</p><div><button class="button primary" type="button" data-review-reload>重新读取</button><a class="button secondary" href="/knowledge-center/assets">返回知识资产</a></div></section>`;
}

function invalidTaskState(task, issues) {
  return `<section class="review-zero-state review-error-state" role="alert"><i data-lucide="file-warning" aria-hidden="true"></i><h2>审核任务数据不完整</h2><p>缺少或无法识别：${esc(issues.join('、'))}。为避免审核错误版本，差异、评论和发布操作已停止。</p><dl><div><dt>任务</dt><dd>${esc(task?.name || task?.title || idOf(task) || '未识别')}</dd></div><div><dt>处理建议</dt><dd>刷新任务；问题持续时联系平台管理员检查候选版本数据。</dd></div></dl><div><button class="button primary" type="button" data-review-reload>刷新任务</button><a class="button secondary" href="/knowledge-center/assets">返回知识资产</a></div></section>`;
}

function readerTree(items, selected, query = '', task = {}, context = {}) {
  const normalized = String(query || '').trim().toLowerCase();
  const metrics = reviewMetrics(task);
  const reviewId = list(task?.reviews)[0]?.id || task?.reviewId || '';
  const canComment = task?.capabilities?.canComment === true;
  const filter = nodes => nodes.map(node => {
    const children = node.type === 'tree' ? filter(node.children || []) : [];
    const visible = !normalized || String(node.name || node.path || '').toLowerCase().includes(normalized) || children.length;
    return visible ? { ...node, children } : null;
  }).filter(Boolean);
  const roots = filter(treeHierarchy(items));
  return roots.length ? renderDirectoryTree(roots, {
    listClass: 'review-document-tree-list',
    directoryClass: '',
    childrenOf: node => node.children || [],
    isLeaf: node => node.type !== 'tree',
    nodeKey: node => node.path || node.name || '',
    renderDirectoryLabel: node => esc(node.name),
    renderLeaf: node => {
    const path = node.path || node.name || '';
    const operationCount = metrics.operations.filter(operation => operation.path === path || operation.documentId === path).length;
    const opinionCount = metrics.comments.filter(comment => comment.resolved !== true && (comment.anchor?.path === path || comment.anchor?.documentId === path)).length;
    const badges = `${operationCount ? `<span class="review-tree-badge" aria-label="${operationCount} 项修改">改 ${operationCount}</span>` : ''}${opinionCount ? `<span class="review-tree-badge warning" aria-label="${opinionCount} 条未解决意见">议 ${opinionCount}</span>` : ''}`;
    const matching = (context.rows || []).filter(row => row.path === path);
    const row = matching.find(item => item.taskId === idOf(task)) || matching[0];
    const href = row ? reviewDocumentUrl(row, context.back, context.showAll)
      : reviewUrl({ view: 'reader', handbookId: context.handbookId, path, branch: context.branch, back: context.back, ...(context.showAll ? { showAll: '1' } : {}) });
    return `<li class="${path === selected ? 'selected' : ''}" data-review-tree-item><a href="${esc(href)}" data-tree-item data-review-document="${esc(path)}" aria-current="${path === selected ? 'page' : 'false'}"><span>${esc(node.name || path)}</span>${badges}</a></li>`;
    }
  }) : '<p class="review-empty">暂无文档目录。</p>';
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
  return `<form class="review-comment-form" data-review-comment-form ${readerMarker} data-task-id="${esc(idOf(task))}" data-review-id="${esc(reviewId)}"><input type="hidden" name="anchor"><input type="hidden" name="candidateDigest" value="${esc(candidateDigest(task))}"><input type="hidden" name="commentType" value="issue"><input type="hidden" name="severity" value="normal"><p data-review-anchor-status>选中文字可精准定位；不选中则为全文意见。</p><label class="review-comment-body">意见内容<textarea name="comment" required placeholder="在此描述你的意见…"></textarea></label><label class="review-comment-mentions">通知手册负责人（可选）<select name="mentions" multiple size="2" data-review-mention-select data-review-id="${esc(reviewId)}"><option value="">聚焦此处加载当前关联手册</option></select><small data-review-mention-status>未选择手册时仅保存普通审核意见</small></label><button class="button primary" type="submit">提交意见</button></form>`;
}

function contextConflict(projection) {
  const conflict = projection?.contextConflict;
  if (!conflict) return '';
  return `<section class="review-reader-state review-context-conflict" role="alert"><i data-lucide="shield-alert" aria-hidden="true"></i><h3>文档上下文不一致</h3><p>请求文档“${esc(conflict.expectedPath)}”，仓库却返回“${esc(conflict.actualPath || '空路径')}”。为避免意见绑定到错误文档，正文和审核操作已停止。</p><button class="button primary" type="button" data-review-reader-refresh>重新读取文档</button></section>`;
}

function roleCards(task) {
  const capabilities = task?.capabilities || {};
  const roles = [['reader', true, '查看候选、基线和文档快照'], ['reviewer', capabilities.canReview === true, '添加意见并作出审核决定'], ['publisher', capabilities.canPublish === true, '确认基线并交付审核内容']];
  return `<div class="review-role-cards" aria-label="当前角色能力">${roles.map(([key, enabled, description]) => `<div class="review-role-card ${enabled ? 'enabled' : 'disabled'}" data-role-card="${key}"><strong>${enabled ? '可用' : '不可用'} · ${roleLabels[key]}</strong><span>${description}</span></div>`).join('')}</div>`;
}

function handbookReviewOverview(rows, snapshots, back) {
  const latest = [...new Map(rows.slice().reverse().map(row => [row.path || `${row.taskId}:${row.documentId || 'handbook'}`, row])).values()];
  if (!latest.length) return '<section class="review-reader-state"><h3>当前没有审核文档</h3><p>打开“显示所有文档”可阅读有权限的仓库正文。</p></section>';
  return `<section class="review-handbook-overview" aria-label="手册审核内容"><header><h3>手册审核内容</h3><p>以下为各文档最近一次可见候选的冻结正文。打开文档后可查看完整审核信息和作出决定。</p></header>${latest.map(row => {
    const document = snapshots.find(item => item.taskId === row.taskId && item.candidateDigest === row.candidateDigest && item.documentId === row.documentId && item.path === row.path);
    const href = reviewDocumentUrl(row, back);
    const body = typeof document?.markdown === 'string'
      ? `<div class="review-reader-snapshot"><strong>已保存修订 · 冻结审核快照</strong>${renderDatabaseMarkdown(safeMarkdown, document.markdown, row.path, { handbookId: row.handbookId, branch: row.branch, language: 'zh', reviewResourceContext: { taskId: row.taskId, candidateDigest: row.candidateDigest, documentId: row.documentId } }).html}</div>`
      : '<p class="review-overview-unavailable">此事项没有可在总览展示的文档级冻结正文，请打开审核事项查看原始快照。</p>';
    return `<article class="review-handbook-document"><header><div><h4>${esc(row.title || row.path || '整本手册')}</h4><small>${esc(row.path || '整本手册')} · ${esc(labels[row.state] || row.state)} · 候选 ${esc(row.candidateDigest.slice(0, 8))}</small></div><a class="button secondary compact" href="${esc(href)}">查看审核文档</a></header>${body}</article>`;
  }).join('')}</section>`;
}

function reader(projection, task, ui = {}) {
  const params = new URLSearchParams(window.location.search);
  const showAll = params.get('showAll') === '1';
  const requestedPath = params.get('path') || '';
  const frozenDocument = task?.handbookSource?.documents?.find(item => item.documentId === params.get('documentId') || item.filePath === requestedPath) || (!params.get('documentId') && !requestedPath ? task?.handbookSource?.documents?.[0] : null);
  const file = frozenDocument ? { path: frozenDocument.filePath, content: frozenDocument.markdown } : projection?.file;
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
  const renderDb = (value, path) => renderDatabaseMarkdown(safeMarkdown, value, path, { handbookId: projection.handbookId, branch: projection.branch, language,
    ...(frozenDocument ? { reviewResourceContext: { taskId: idOf(task), candidateDigest: candidateDigest(task), documentId: frozenDocument.documentId } } : {}) }).html;
  // 等待状态：没有活动任务时，直接用仓库文件内容作为阅读正文。
  const isWaitingForReview = !idOf(task) && !task?.candidate && !task?.draft && !task?.reviewMode;
  if (task?.handbookSource) {
    content = frozenDocument && typeof frozenDocument.markdown === 'string'
      ? `<div class="review-reader-snapshot"><strong>当前显示已保存的手册审核快照</strong>${renderDb(frozenDocument.markdown, frozenDocument.filePath)}</div>`
      : '<section class="review-reader-state" role="alert"><h3>审核文档快照缺失或不匹配</h3><p>请返回清单重新选择文档，当前不会用仓库正文代替审核内容。</p></section>';
  }
  else if (onlineReviewSnapshot) {
    content = `<div class="review-reader-snapshot"><strong>当前显示正式版本评审快照</strong>${renderDb(snapshot, file?.path || list(task?.target?.documentIds)[0] || '')}</div>`;
  }
  else if (projection?.contextConflict) content = contextConflict(projection);
  else if (isWaitingForReview && file?.content) content = `<div class="review-reader-repository"><strong class="review-reader-source-label">当前显示仓库正文</strong>${renderDb(file.content, file.path)}</div>`;
  else if (file?.content) content = renderDb(file.content, file.path);
  else if (projection?.status === 'loading') content = '<div class="review-repository-skeleton" role="status" aria-label="正在读取仓库正文"><span></span><span></span><span></span><span></span><span></span></div>';
  else if (needsAuthorization) content = reviewAuthorizationState(projection, task);
  else if (['GITLAB_MAPPING_NOT_FOUND', 'GITLAB_LANGUAGE_NOT_MAPPED', 'GITLAB_CONNECTION_INACTIVE', 'GITLAB_CREDENTIAL_UNAVAILABLE', 'GITLAB_CONNECTOR_DISABLED'].includes(projection?.error?.code)) content = repositoryConnectionState(projection, task);
  else if (snapshot) content = `<div class="review-reader-fallback"><strong>仓库阅读不可用，当前显示候选快照</strong>${renderDb(snapshot, '')}</div>`;
  else if (isWaitingForReview) content = `<section class="review-reader-state" role="alert"><h3>${esc(readerError(projection))}</h3><p>${esc(projection?.error?.message || '仓库没有返回可阅读的正文。')}</p><button class="button secondary" type="button" data-review-reader-refresh>重新读取</button></section>`;
  else content = `<section class="review-reader-state" role="alert"><h3>${esc(readerError(projection))}</h3><p>${esc(projection?.error?.message || '当前没有可阅读的文档快照。')}</p></section>`;
  const languages = projection?.languages || { zh: true, en: true };
  const sourceLabel = task?.handbookSource ? '已保存修订 · 冻结审核快照' : onlineReviewSnapshot ? '正式版本评审快照' : isWaitingForReview ? (projection?.commitSha ? `仓库提交 ${esc(projection.commitSha.slice(0, 8))}` : '仓库正文') : (projection?.commitSha ? `提交 ${esc(projection.commitSha.slice(0, 8))}` : '候选快照');
  const updatedLabel = projection?.updatedAt ? `<span>更新时间：${esc(new Date(projection.updatedAt).toLocaleString('zh-CN', { hour12: false }))}</span>` : '';
  const collapsed = ui.directoryCollapsed === true;
  const directoryWidth = Math.min(420, Math.max(220, Number(ui.directoryWidth) || 260));
  const metrics = reviewMetrics(task);
  const frozenPaths = new Map(list(task?.handbookSource?.documents).map(document => [document.documentId, document.filePath]));
  const mappedOperations = metrics.operations.filter(operation => operation.path || frozenPaths.get(operation.documentId)).length;
  const markerNote = metrics.operations.length && mappedOperations < metrics.operations.length ? `<p class="review-directory-note">${metrics.operations.length} 项修改中有 ${metrics.operations.length - mappedOperations} 项缺少仓库路径映射，仅在差异视图展示。</p>` : '';
  const matchingOperation = metrics.operations.filter(operation => operation.path === file?.path);
  // 在线评审快照没有增量 operations。当前文档被明确选入评审范围时，
  // 使用冻结 target 中的文档标识，保证阅读选区仍能形成可追溯的行级意见。
  const scopedDocuments = list(task?.target?.documentIds);
  const documentId = frozenDocument?.documentId || (matchingOperation.length === 1
    ? matchingOperation[0].documentId
    : (task?.target?.scope === 'document' && scopedDocuments.length === 1 && (scopedDocuments[0] === file?.path || (task.target.documentPaths || task.target.paths || [])[0] === file?.path)
      ? scopedDocuments[0]
      : (file?.path || projection?.requestedPath || '')));
  const commentEntry = canComment && reviewId
    ? ''
    : isWaitingForReview ? ''
    : `<p class="review-reading-hint">${task?.capabilities?.canComment === false ? '当前账号仅可阅读，暂无在线提意见权限。' : '请先提交审核候选后再提出意见。'}</p>`;
  const selectionBubble = canComment && reviewId
    ? '<div class="review-selection-bubble" data-review-selection-bubble hidden><button type="button" class="review-bubble-btn" data-review-bubble-trigger aria-label="对选中文字提出意见" title="对选中文字提出意见">💬</button></div>'
    : '';
  const reviewRows = (ui.workbench?.documents || []).filter(row => row.handbookId === (task?.handbookId || projection?.handbookId));
  const reviewedPaths = new Set(reviewRows.map(row => row.path).filter(Boolean));
  const tree = list(projection?.tree);
  const mergedTree = [...tree, ...[...reviewedPaths].filter(path => !tree.some(item => item.path === path)).map(path => ({ path, name: path.split('/').at(-1), type: 'blob' }))];
  const visibleTree = ui.workbench && !showAll ? mergedTree.filter(item => item.type === 'tree' || reviewedPaths.has(item.path)) : mergedTree;
  const handbookOverview = ui.workbench && !showAll && isWaitingForReview && !requestedPath && projection?.status === 'ok' && !projection?.error;
  if (handbookOverview) content = handbookReviewOverview(reviewRows, ui.workbench?.overview || [], params.get('back') || '');
  const allToggle = ui.workbench ? `<label class="review-show-all"><input type="checkbox" data-review-show-all ${showAll ? 'checked' : ''}>显示所有文档</label>` : '';
  const directoryBody = readerTree(visibleTree, handbookOverview ? '' : file?.path || projection?.requestedPath, projection?.search || '', task, { rows: reviewRows, handbookId: task?.handbookId || projection?.handbookId, branch: task?.handbookSource?.branch || projection?.branch, back: params.get('back') || '', showAll });

  return `<section class="review-reading-layout ${collapsed ? 'directory-collapsed' : ''} density-comfortable" data-navigation-layout data-navigation-layout-id="review" data-navigation-pane-label="文档目录" data-navigation-min="220" data-navigation-max="420" data-navigation-default="260" data-navigation-width-variable="--review-directory-width" data-review-repository-region data-repository-status="${esc(projection?.status || 'empty')}" style="--review-directory-width:${directoryWidth}px" aria-label="审核文档阅读区"><aside class="review-document-tree" data-navigation-pane data-directory-tree data-scroll-region="panel"><div class="review-directory-head"><h3>文档目录</h3><button class="review-directory-toggle" type="button" data-navigation-pane-toggle data-review-directory-toggle aria-expanded="${!collapsed}" aria-label="${collapsed ? '展开文档目录' : '收起文档目录'}" title="${collapsed ? '展开文档目录' : '收起文档目录'}"><i data-lucide="${collapsed ? 'panel-left-open' : 'panel-left-close'}" aria-hidden="true"></i><span>${collapsed ? '展开' : '收起'}</span></button></div><div class="review-directory-content"><div class="review-reader-toolbar"><label for="review-document-search">搜索文档</label><input id="review-document-search" type="search" data-directory-search placeholder="按文件名筛选" data-review-document-search ${projection?.status === 'loading' ? 'disabled' : ''}></div>${allToggle}${markerNote}${directoryBody}</div><div class="review-directory-resizer" data-navigation-pane-resizer data-review-directory-resizer role="separator" aria-orientation="vertical" aria-label="调整文档目录宽度" aria-valuemin="220" aria-valuemax="420" aria-valuenow="${directoryWidth}" tabindex="${collapsed ? '-1' : '0'}"></div></aside><main class="review-document-content" data-review-document-id="${esc(documentId)}" data-scroll-region="panel"><header class="review-reader-head"><div><h3>${esc(handbookOverview ? '手册审核内容' : file?.path || (projection?.status === 'loading' ? '手册正文' : projection?.contextConflict ? '文档读取已停止' : isWaitingForReview ? '手册正文' : '当前候选快照'))}</h3><p>${projection?.status === 'loading' ? '正在读取仓库内容' : `${esc(task?.handbookSource?.branch || projection?.branch || '候选版本')} · ${language === 'en' ? 'English' : '中文'} · ${handbookOverview ? '冻结审核快照汇总' : sourceLabel}`}</p></div>${updatedLabel}</header><div class="review-reader-controls"><label>选择分支<select data-review-branch ${branches.length && !task?.handbookSource ? '' : 'disabled'}>${branches.map(branch => `<option value="${esc(branch.name)}" ${branch.name === projection?.branch ? 'selected' : ''}>${esc(branch.name)}</option>`).join('')}</select></label><div class="review-reader-language" role="group" aria-label="文档语言"><button type="button" data-review-language="zh" aria-pressed="${language === 'zh'}" ${task?.handbookSource || projection?.status === 'loading' || languages.zh === false ? 'disabled' : ''}>中文</button><button type="button" data-review-language="en" aria-pressed="${language === 'en'}" ${task?.handbookSource || projection?.status === 'loading' || languages.en === false ? 'disabled' : ''}>English</button></div><details class="review-more-menu" data-dismissible-menu><summary class="button tertiary compact" aria-label="阅读更多操作" title="阅读更多操作"><span class="review-more-dots" aria-hidden="true">⋯</span></summary><div class="review-more-menu-panel"><button type="button" data-review-focus-toggle aria-pressed="${ui.focusMode === true}"><i data-lucide="scan" aria-hidden="true"></i><span>${ui.focusMode === true ? '退出专注阅读' : '专注阅读'}</span></button>${projection?.status === 'loading' ? '' : '<button type="button" data-review-reader-refresh><i data-lucide="refresh-cw" aria-hidden="true"></i><span>刷新阅读</span></button>'}</div></details></div>${content}${commentEntry}${selectionBubble}</main></section>`;
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
  const records = list(items).filter(task => ['rejected', 'published', 'mr_submitted'].includes(rawStatus(task)) && String(idOf(task)) !== String(activeId));
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
    const mentions = list(comment.mentions);
    const noticeLabel = comment.notificationStatus === 'pending_configuration' ? '通知未投递：通知渠道尚未配置' : comment.notificationStatus === 'delivered' ? '已通知手册负责人' : '';
    return `<article class="review-opinion ${comment.severity === 'blocker' && comment.resolved !== true ? 'blocker' : ''}" tabindex="-1" data-review-opinion data-review-comment-id="${esc(comment.id)}" data-severity="${esc(comment.severity || 'normal')}" data-resolved="${comment.resolved === true}"><header><strong>${esc(comment.author?.displayName || '审核成员')}</strong><span class="review-opinion-state">${esc(comment.resolved === true ? '已处理' : '待处理')}</span></header><div class="review-opinion-meta"><span>${esc(severityLabel(comment.severity))}</span><span>${esc(locationLabel(comment))}</span></div><p>${esc(comment.content || comment.body || comment.comment || '')}</p>${mentions.length ? `<p class="review-opinion-mentions">提及：${mentions.map(item => `@${esc(item.handbookName)}（${esc(item.recipientName || item.recipientId)}）`).join('、')}</p>` : ''}${noticeLabel ? `<small class="review-notification-state">${esc(noticeLabel)}</small>` : ''}${replies.length ? `<ol class="review-replies">${replies.map(reply => `<li><strong>${esc(reply.author?.displayName || '审核成员')}</strong><span>${esc(reply.content || reply.body || '')}</span></li>`).join('')}</ol>` : ''}${lifecycle}</article>`;
  }).join('') : `<section class="review-opinion-empty"><h4>当前没有审核意见</h4><p>请先在“阅读文档”选择文字，或在“查看修改”选择具体行后提出意见。</p><div><button class="button secondary" type="button" data-review-step="read">阅读文档并添加意见</button><button class="button primary" type="button" data-review-step="diff">查看修改并添加意见</button></div></section>`;
  const threadPermission = canManageThread
    ? '当前账号可以回复、标记已处理和重新打开意见。'
    : '当前账号仅可查看意见。任务处于审核中且具备文档编辑员或审核管理员权限时，才可回复或标记已处理。';
  return `<section class="review-step-panel review-opinions-panel"><header><div><h3>审核意见</h3><p>按意见处理进度逐项确认；AI 结果仅作为可核对依据，不直接改变审核结论。</p></div><span>${comments.length} 条意见</span></header><p class="review-thread-permission ${canManageThread ? 'enabled' : ''}">${threadPermission}</p>${comments.length ? `<label class="review-opinion-filter">查看<select data-review-opinion-filter><option value="all">全部意见</option><option value="open">未处理意见</option><option value="blocker">阻断意见</option></select></label>` : ''}<div class="review-opinions">${records}</div><div class="review-ai-note"><strong>审核原则</strong><p>数据库语法、参数依赖、版本适配和错误码准确性必须由具备领域责任的审核人确认。</p></div></section>`;
}

function reviewActionPanel(task, review) {
  if (task.mergeRequest && rawStatus(task) === 'mr_submitted') return '';
  const metrics = reviewMetrics(task);
  const blockers = metrics.blockers;
  const canReview = task?.capabilities?.canReview === true && review?.status === 'pending';
  const canPublish = task?.capabilities?.canPublish === true && ['approved', 'pending_publish'].includes(rawStatus(task));
  const canRevise = task?.capabilities?.canRevise === true;
  if (!canReview && !canPublish && !canRevise) return '';
  const revision = canRevise ? `<button class="button secondary" type="button" data-review-revision="${esc(idOf(task))}">创建修订任务</button>` : '';
  const decision = canReview ? `<details class="review-return"><summary>退回修改</summary><form data-review-decision-form data-task-id="${esc(idOf(task))}" data-review-id="${esc(review.id)}" data-candidate-digest="${esc(candidateDigest(task))}"><label>退回原因<textarea name="comment" required placeholder="请说明需要修改的内容"></textarea></label><button class="button tertiary" type="submit">确认退回</button></form></details><button class="button primary" data-review-decision="approve" data-task-id="${esc(idOf(task))}" data-review-id="${esc(review.id)}" data-candidate-digest="${esc(candidateDigest(task))}" ${blockers ? 'disabled aria-disabled="true" title="请先处理全部阻断意见"' : ''}>审核通过</button>` : '';
  const legacyOnline = task?.reviewMode === 'online_review' && !task?.handbookSource;
  const publish = canPublish ? `<button class="button primary" data-review-publish="${esc(idOf(task))}">${task?.handbookSource || legacyOnline ? '创建 GitLab MR' : '确认发布'}</button>` : '';
  const legacyHint = legacyOnline ? '<p>此旧在线评审没有修改稿，提交 MR 会报“与 GitLab 内容完全一致”。请返回文档生产修改并重新提交审核。</p>' : '';
  return `<section class="review-evidence-card review-action-card" aria-label="审核操作"><h3>审核操作</h3><p>${blockers ? `尚有 ${blockers} 条阻断意见未处理，不能审核通过` : metrics.unresolved ? `尚有 ${metrics.unresolved} 条未处理意见` : '没有未处理意见'}</p>${legacyHint}<div class="review-action-controls">${revision}${decision}${publish}</div><p class="incremental-form-status" role="alert"></p></section>`;
}

function detail(task, tasks, allTasks, step, projection, diffData, ui) {
  const issues = taskIssues(task);
  if (issues.length) return invalidTaskState(task, issues);
  const params = new URLSearchParams(window.location.search);
  const currentDocument = task.handbookSource?.documents?.find(item => item.documentId === params.get('documentId') || item.filePath === params.get('path'));
  const review = list(task.reviews).find(item => !currentDocument || String(item.documentId || '') === String(currentDocument.documentId || '')) || list(task.reviews)[0];
  const current = ['read', 'diff', 'opinions'].includes(step) ? step : defaultReviewStep(task, review);
  let body = projection?.contextConflict && current !== 'read' ? contextConflict(projection) : current === 'read' ? reader(projection, task, ui) : current === 'diff' ? diff(task, diffData, review) : opinions(task, review);
  const affected = task.handbookSource?.documents || [];
  const scopeHint = review?.documentId ? `本次仅审核当前文档：${esc(currentDocument?.filePath || review.documentId)}；范围内每篇通过才可交付。` : '本次决定适用于该历史审核记录的全部文档。';
  const scopeNotice = affected.length ? `<details class="review-scope-notice"><summary><strong>审核范围 · ${affected.length} 篇文档</strong><span>查看范围</span></summary><div><p>${scopeHint}</p><ul>${affected.map(item => `<li>${esc(item.filePath)}</li>`).join('')}</ul></div></details>` : '';
  const baseline = task.baselineVersionLabel || task.baselineVersionName || task.baselineVersionId;
  const metrics = reviewMetrics(task); const unresolved = metrics.unresolved;
  const productName = task.productName || 'YashanDB';
  const handbookName = task.handbookName || ui.workbench?.handbooks?.find(item => String(item.handbookId) === String(task.handbookId))?.name || task.name || task.title || '未命名手册';
  const documentPath = currentDocument?.filePath || params.get('path') || (task.target?.scope === 'handbook' ? '整本手册' : '未指定文档');
  const documentName = documentPath.split('/').pop();
  const sourceName = task.handbookSource ? '已保存修订 · 冻结审核快照' : task.reviewMode === 'online_review' ? '正式版本评审快照' : '候选快照';
  // 评论抽屉：默认折叠；上半部显示当前文件的已有意见，下半部为全文意见表单
  const drawerComments = list(review?.comments);
  const drawerCommentsList = drawerComments.length
    ? `<div class="review-drawer-comments" data-scroll-region="panel">${drawerComments.map(comment => {
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
    ? `<section class="review-evidence-card review-comment-drawer"><details data-review-comment-drawer><summary title="提出意见" aria-label="提出意见"><i data-lucide="messages-square" aria-hidden="true"></i><h3>审核意见</h3><small>${drawerComments.length} 条</small></summary><button type="button" class="icon-button review-panel-close" data-review-panel-close aria-label="关闭意见侧栏" title="关闭意见侧栏"><i data-lucide="x" aria-hidden="true"></i></button>${drawerCommentsList}${drawerForm}</details></section>`
    : '';
  const evidenceCards = evidence(task, current);
  const evidenceDrawer = `<details class="review-evidence-drawer"><summary title="审核依据" aria-label="审核依据"><i data-lucide="list-checks" aria-hidden="true"></i><span>审核依据</span><small>角色 · 检查 · 血缘</small></summary><button type="button" class="icon-button review-panel-close" data-review-panel-close aria-label="关闭审核依据侧栏" title="关闭审核依据侧栏"><i data-lucide="x" aria-hidden="true"></i></button><div class="review-evidence-content">${evidenceCards}</div></details>`;
  const editHref = task.handbookSource
    ? productionEditorUrl(task.handbookId, currentDocument?.filePath || task.handbookSource.documents?.[0]?.filePath || '', task.handbookSource.branch)
    : task.reviewMode === 'online_review' ? productionEditorUrl(task.handbookId, params.get('path') || '', '')
      : `/knowledge-center/production?taskId=${encodeURIComponent(idOf(task))}&stage=review`;
  const reviewRow = ui.workbench?.documents?.find(row => String(row.taskId) === String(idOf(task)) && (!currentDocument || String(row.documentId) === String(currentDocument.documentId)));
  let reviewerName = reviewRow?.reviewerDisplay && reviewRow.reviewerDisplay !== '未明确指派' ? reviewRow.reviewerDisplay : '';
  const flow = reviewFlow(task, review, reviewerName, editHref, ui);
  const responsibleName = flow.closed || rawStatus(task) === 'rejected'
    ? (task.createdBy?.displayName && task.createdBy.displayName !== '未知用户' ? task.createdBy.displayName : task.createdBy?.name || '文档提交者')
    : review?.status === 'pending' ? reviewerName || '未明确指派' : '按交付权限处理';
  reviewerName = responsibleName;
  const nextStep = `<section class="review-next-step ${flow.closed ? 'delivery-failed' : ''}" aria-label="当前阶段与下一步"><div><strong>${esc(flow.title)}</strong><span>${esc(flow.note)}</span></div>${flow.action}</section>`;
  if (current === 'read') body = `<div class="review-reading-tools"><strong>${esc(documentName)}</strong><div><button class="icon-button" type="button" data-review-reader-refresh aria-label="刷新阅读" title="刷新阅读"><i data-lucide="refresh-cw" aria-hidden="true"></i></button><button class="icon-button" type="button" data-review-focus-toggle aria-label="${ui.focusMode ? '退出专注阅读' : '专注阅读'}" title="${ui.focusMode ? '退出专注阅读' : '专注阅读'}" aria-pressed="${ui.focusMode === true}"><i data-lucide="scan" aria-hidden="true"></i></button></div></div>${body}`;
  return `<article class="review-workspace review-workbench-detail"><header class="review-detail-head"><div class="review-heading-group"><h2>${esc(task.name || task.title || '审核事项')}</h2>${tasks.length > 1 ? taskSelector(tasks, idOf(task)) : ''}${history(allTasks, idOf(task))}</div><div class="review-detail-actions"><span class="review-status" data-review-status>${esc(flow.phase)}</span>${task.mergeRequest?.webUrl || task.capabilities?.canRefreshDelivery === true && rawStatus(task) === 'mr_submitted' ? `<details class="review-more-menu" data-dismissible-menu><summary class="button tertiary compact" aria-label="审核更多操作" title="审核更多操作"><i data-lucide="ellipsis" aria-hidden="true"></i></summary><div class="review-more-menu-panel">${task.mergeRequest?.webUrl ? `<a href="${esc(task.mergeRequest.webUrl)}" target="_blank" rel="noopener noreferrer"><i data-lucide="external-link" aria-hidden="true"></i><span>查看 GitLab MR !${esc(task.mergeRequest.iid)}</span></a>` : ''}${task.capabilities?.canRefreshDelivery === true && rawStatus(task) === 'mr_submitted' ? `<button type="button" data-review-delivery-refresh="${esc(idOf(task))}"><i data-lucide="refresh-cw" aria-hidden="true"></i><span>状态刷新</span></button>` : ''}</div></details>` : ''}</div></header><div class="review-context-strip" aria-label="当前审核上下文"><span>手册 <strong>${esc(handbookName)}</strong></span><span title="${esc(documentPath)}">文档 <strong>${esc(documentName)}</strong></span><span>版本 <strong>${esc(task.businessVersion || '未关联')}</strong></span><span>当前责任人 <strong>${esc(reviewerName || '未明确指派')}</strong></span><details class="review-context-more"><summary>更多信息</summary><div><span>产品 <strong>${esc(productName)}</strong></span><span>路径 <code>${esc(documentPath)}</code></span><span>分支 <code>${esc(task.handbookSource?.branch || projection?.branch || '未关联')}</code></span><span>候选 <code>${esc(candidateDigest(task).slice(0, 8))}</code></span><span>来源 <strong>${esc(sourceName)}</strong></span></div></details></div>${nextStep}${scopeNotice}<nav class="review-steps" aria-label="审核步骤"><button class="${current === 'diff' ? 'active' : ''}" data-review-step="diff">查看修改（${metrics.operations.length}）</button><button class="${current === 'read' ? 'active' : ''}" data-review-step="read">阅读文档</button><button class="${current === 'opinions' ? 'active' : ''}" data-review-step="opinions">审核意见（${unresolved}）</button></nav><div class="review-main-grid"><div class="review-stage">${body}</div><aside class="review-evidence-column" data-scroll-region="panel"><section class="review-evidence-card review-delivery-summary"><h3>审核与交付</h3><dl><dt>审核阶段</dt><dd>${esc(flow.phase)}</dd><dt>交付结果</dt><dd>${esc(flow.result)}</dd></dl></section>${reviewActionPanel(task, review)}${commentDrawer}${evidenceDrawer}</aside></div></article>`;
}

export function renderReviewPublishing({ reviewProjection, gitlabProjection, reviewUi }) {
  const projection = reviewProjection || {};
  if (projection.status === 'loading') return '<section class="review-loading-state" role="status" aria-label="正在读取审核事项"><div class="review-skeleton-head"></div><div class="review-skeleton-body"><i></i><i></i><i></i></div><p>正在读取审核事项…</p></section>';
  if (projection.status === 'unavailable') return unavailableState(projection);
  if (projection.workbench) {
    const params = new URLSearchParams(window.location.search);
    if (projection.view !== 'reader') return renderReviewWorkbench(projection, params);
    const ui = { ...reviewUi, workbench: projection.workbench, reviewTasks: list(projection.allItems), hasReviewDocuments: projection.workbench.documents.some(row => row.handbookId === projection.handbookId) };
    const task = projection.detail?.task;
    const navigation = reviewNavigation(projection.workbench, task, params);
    return navigation + (task
      ? detail(task, list(projection.items), list(projection.allItems), params.get('step') || '', gitlabProjection || {}, projection.diff, ui)
      : handbookWaitingState(projection.handbookId, gitlabProjection || {}, list(projection.reviewHandbooks), ui, projection.onlineReviewBaselines, projection.onlineReviewBaselineError, projection.onlineReviewCommits || []));
  }
  const tasks = list(projection.items || projection.tasks || projection.data);
  if (!tasks.length && projection.handbookId) return handbookWaitingState(projection.handbookId, gitlabProjection || {}, list(projection.reviewHandbooks), reviewUi || {}, projection.onlineReviewBaselines, projection.onlineReviewBaselineError, projection.onlineReviewCommits || []);
  if (!tasks.length) return emptyState();
  const detailValue = projection.detail?.task ?? projection.detail;
  const detailTask = detailValue && typeof detailValue === 'object' && idOf(detailValue) ? detailValue : null;
  const requested = new URLSearchParams(window.location.search).get('taskId');
  const selected = idOf(detailTask) || requested || idOf(tasks[0]);
  const task = detailTask && String(idOf(detailTask)) === String(selected) ? detailTask : tasks.find(item => String(idOf(item)) === String(selected));
  const step = new URLSearchParams(window.location.search).get('step') || '';
  return detail(task, tasks, list(projection.allItems), step, gitlabProjection || {}, projection.diff, reviewUi || {});
}

export function renderReviewRepositoryRegion({ reviewProjection, gitlabProjection, reviewUi }) {
  const projection = reviewProjection || {};
  if (projection.workbench) return reader(gitlabProjection || {}, projection.detail?.task || { handbookId: projection.handbookId }, { ...reviewUi, workbench: projection.workbench, reviewTasks: list(projection.allItems) });
  const tasks = list(projection.items || projection.tasks || projection.data);
  if (!tasks.length && projection.handbookId) return reader(gitlabProjection || {}, { handbookId: projection.handbookId }, reviewUi || {});
  const detailValue = projection.detail?.task ?? projection.detail;
  const detailTask = detailValue && typeof detailValue === 'object' && idOf(detailValue) ? detailValue : null;
  const requested = new URLSearchParams(window.location.search).get('taskId');
  const selected = idOf(detailTask) || requested || idOf(tasks[0]);
  const task = detailTask && String(idOf(detailTask)) === String(selected) ? detailTask : tasks.find(item => String(idOf(item)) === String(selected));
  return task ? reader(gitlabProjection || {}, task, reviewUi || {}) : '';
}
