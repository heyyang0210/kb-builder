import { emptyState } from '../../common/components/ui.js';
import { uiIcon } from '../../common/ui-system.js';
import { escapeHtml } from '../../common/utils/dom.js';
import { renderHandbookProduction } from './handbook-view.js';

const statusNames = {
  draft: '待选来源', editing: '编辑中', checked: '完整性已检查', candidate_ready: '待提交审核',
  under_review: '审核中', approved: '待发布', rejected: '已退回', published: '平台已发布', mr_submitted: '已提交 MR',
};
const phases = [
  ['setup', '建立任务'],
  ['inputs', '确认输入'],
  ['generation', '草稿'],
  ['review', '按文档审核'],
  ['publish', '整体发布'],
];

const array = value => Array.isArray(value) ? value : [];
const idOf = value => String(value?.taskId || value?.id || '');
const selectedTask = projection => projection?.detail?.task || projection?.detail || null;
export const taskStatus = task => task?.completion?.status === 'completed'
  ? (task.completion.label || '已完成')
  : task?.completion?.status === 'pending' && task?.mergeRequest
    ? (task.completion.label || '待合并回读')
    : task?.statusDisplayName || statusNames[task?.state] || statusNames[task?.status] || task?.state || task?.status || '状态未返回';
export function formatProductionTimestamp(value, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false });
}
function fmtTime(value) { return value ? escapeHtml(formatProductionTimestamp(value, '暂无')) : '暂无'; }
function suggestedPhase(task) {
  const status = task?.state || task?.status;
  if (['pending_publish', 'approved', 'published', 'mr_submitted', 'batch_publish_failed'].includes(status)) return 'publish';
  if (['candidate_ready', 'under_review', 'in_review', 'review_pending', 'rejected', 'changes_requested'].includes(status)) return 'review';
  if (['editing', 'checked', 'pending_submission', 'checks_passed', 'generation_failed'].includes(status) && task?.target) return 'generation';
  if (array(task?.sources || task?.sourceSnapshots).length || task?.target) return 'inputs';
  return 'setup';
}

function activePhase(task) {
  const requested = new URLSearchParams(window.location.search).get('stage');
  return phases.some(([key]) => key === requested) ? requested : suggestedPhase(task);
}

function phaseIndex(key) { return Math.max(0, phases.findIndex(([phase]) => phase === key)); }

function taskList(projection) {
  const allItems = array(projection?.items || projection?.tasks);
  const items = allItems;
  const selectedId = idOf(selectedTask(projection));
  if (projection?.status === 'loading') return '<div class="incremental-list-state" role="status">正在读取增量任务…</div>';
  if (projection?.status === 'unavailable') return `<div class="incremental-list-state error"><strong>任务暂时无法读取</strong><span>${escapeHtml(projection?.error?.message || '请稍后重试')}</span><button class="button secondary compact" type="button" data-incremental-reload>重新读取</button></div>`;
  if (!items.length) return emptyState('暂无增量任务', '当前没有可查看的任务记录。');
  return `<div class="incremental-task-list">${items.map(task => { const id = idOf(task); return `<button class="incremental-task-item${id === selectedId ? ' selected' : ''}" type="button" data-incremental-task="${escapeHtml(id)}" aria-pressed="${id === selectedId}"><strong>${escapeHtml(task.name || task.title || '未命名任务')}</strong><span>${escapeHtml(taskStatus(task))}</span><small>${escapeHtml(task.handbookName || task.handbookId || '')}${task.updatedAt ? ` · ${fmtTime(task.updatedAt)}` : ''}</small></button>`; }).join('')}</div>`;
}

function generationStatusClass(status) {
  return ['failed', 'cancelled'].includes(status) ? 'is-error' : status === 'completed' ? 'is-success' : 'is-active';
}

function myGenerations(projection = {}) {
  if (projection.status === 'loading') return '<section class="production-generations-state" role="status">正在读取我的生成…</section>';
  if (projection.status === 'forbidden') return `<section class="production-generations-state error" role="alert"><strong>无权查看生成记录</strong><span>${escapeHtml(projection.error?.message || '请联系管理员检查知识读取权限。')}</span></section>`;
  if (projection.status === 'unavailable') return `<section class="production-generations-state error" role="alert"><strong>我的生成暂时无法读取</strong><span>${escapeHtml(projection.error?.message || '请稍后重试。')}</span><button class="button secondary compact" type="button" data-incremental-reload>重新读取</button></section>`;
  const items = array(projection.items);
  if (!items.length) return `<section class="production-overview-empty">${emptyState('暂无生成记录', '你还没有发起或实际参与过 Agent 生成运行。审核、发布等事项请前往平台工作台的“待我处理”。')}</section>`;
  return `<section class="production-generations" aria-label="我的生成记录"><header><div><h2>我的生成</h2><p>只展示你发起或实际参与的 Agent 生成运行。</p></div><span>${items.length} 条</span></header><div class="production-generation-list">${items.map(item => { const completion = item.completion || {}; return `<article class="production-generation-item"><div class="production-generation-main"><div><strong>${escapeHtml(item.taskName || '未命名生成')}</strong><span>${escapeHtml(item.handbookName || item.handbookId || '手册待确认')}</span></div><em class="${generationStatusClass(item.status)}">${escapeHtml(item.statusDisplayName || '状态待确认')}</em></div><dl><div><dt>运行编号</dt><dd>${escapeHtml(item.generationId)}</dd></div><div><dt>最近更新</dt><dd>${fmtTime(item.updatedAt)}</dd></div>${item.progress !== null && item.progress !== undefined ? `<div><dt>进度</dt><dd>${escapeHtml(String(item.progress))}%</dd></div>` : ''}<div><dt>交付状态</dt><dd>${escapeHtml(completion.label || '待确认')}</dd></div></dl>${item.progressMessage ? `<p>${escapeHtml(item.progressMessage)}</p>` : ''}${item.failureReason ? `<p class="production-generation-error">${escapeHtml(typeof item.failureReason === 'string' ? item.failureReason : item.failureReason.message || '生成失败')}</p>` : ''}<footer><span>${item.association === 'participant' ? '我参与的运行' : '我发起的运行'}</span><a class="button secondary compact" href="${escapeHtml(item.nextAction?.href || `/knowledge-center/production?view=tasks&taskId=${encodeURIComponent(item.taskId)}&stage=generation`)}">${escapeHtml(item.nextAction?.label || '查看生成')}</a></footer></article>`; }).join('')}</div></section>`;
}

function progress(task, active) {
  const suggested = phaseIndex(suggestedPhase(task));
  return `<nav class="incremental-steps" aria-label="增量构建阶段"><span class="incremental-step-count">第 ${phaseIndex(active) + 1} 步，共 ${phases.length} 步</span><ol>${phases.map(([key, label], index) => `<li class="${index < suggested ? 'done' : key === active ? 'current' : ''}"><button type="button" data-incremental-stage="${key}" aria-current="${key === active ? 'step' : 'false'}"><span aria-hidden="true">${index < suggested ? '✓' : index + 1}</span><b>${label}</b></button></li>`).join('')}</ol></nav>`;
}

function sourceSection(task) {
  const sources = array(task.sources || task.sourceSnapshots);
  const editable = task.capabilities?.canEdit !== false && ['draft', 'editing', 'checked'].includes(task.state);
  const sourceTypeName = type => type === 'local' ? '本地文件' : '人工提供';
  return `<section class="incremental-section" id="incremental-source"><header><div><h3>参考资料</h3><p>保存后作为本次任务的来源快照。</p></div><span>${sources.length} 项</span></header>${sources.length ? `<ul class="incremental-fact-list">${sources.map(source => `<li><div><strong>${escapeHtml(source.label || source.title || source.name || '未命名来源')}</strong><small>${sourceTypeName(source.sourceType)} · 已保存</small></div>${source.reference ? `<span>${escapeHtml(source.reference)}</span>` : ''}</li>`).join('')}</ul>` : '<p class="incremental-empty">尚未添加参考资料。</p>'}${editable ? `<form class="incremental-inline-form source" data-incremental-source-form data-task-id="${escapeHtml(idOf(task))}"><label>资料名称<input name="label" required maxlength="120"></label><label>资料链接或编号<input name="reference" placeholder="可填写网页地址、PingCode 链接或编号"></label><label>资料类型<select name="sourceType"><option value="manual">人工提供</option><option value="local">本地文件</option></select></label><label class="wide">资料内容<textarea name="content" rows="5" required></textarea></label><label class="wide incremental-file-field">选择本地文件<input name="localFile" type="file" accept=".md,.markdown,.html,.htm,.txt,text/markdown,text/html,text/plain" data-incremental-source-file><span data-incremental-source-file-status>支持 Markdown、HTML 和 TXT；文件最大 512 KiB；点击“保存资料”后才会写入任务。</span></label><button class="button" type="submit">保存资料</button><span class="incremental-form-status" role="status"></span></form>` : ''}</section>`;
}

function targetSection(task) {
  const available = array(task.availableTargets || task.availableChapters || task.chapters || task.taskDocuments);
  const selected = new Set(array(task.target?.sectionIds || task.targetScope?.sectionIds).map(String));
  const selectedIds = new Set(array(task.target?.documentIds).map(String));
  const documentPicker = available.length ? `<div class="incremental-target-list" role="group" aria-label="选择目标文档">${available.map(item => { const documentId = String(item.documentId || item.id || ''); const title = item.documentName || item.title || item.name || '未命名文档'; return `<label><input type="checkbox" name="documentIds" value="${escapeHtml(documentId)}" ${selectedIds.has(documentId) ? 'checked' : ''}><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(item.path || item.documentPath || '')}</small></span></label>`; }).join('')}</div>` : `<p class="incremental-empty" role="status">${task.taskOutlineStatus === 'unavailable' ? '无法读取已发布大纲，当前不能确认修改范围。请重新读取任务。' : '当前手册没有可选择的已发布文档。'}</p>`;
  const selector = `${documentPicker}${available.length ? `<fieldset class="incremental-section-picker"><legend>章节范围（可选）</legend><div class="incremental-target-list">${available.flatMap(item => array(item.chapters || item.sections)).map(item => { const id = String(item.chapterId || item.nodeId || item.id); return `<label><input type="checkbox" name="sectionIds" value="${escapeHtml(id)}" ${selected.has(id) ? 'checked' : ''}><span><strong>${escapeHtml(item.title || item.name || '未命名章节')}</strong><small>${escapeHtml(item.path || item.documentName || '')}</small></span></label>`; }).join('')}</div></fieldset>` : ''}`;
  const editable = task.capabilities?.canEdit !== false && ['draft', 'editing', 'checked'].includes(task.state);
  return `<section class="incremental-section" id="incremental-target"><header><div><h3>修改范围</h3><p>只保存人工确认的文档和章节，不自动扩大范围。</p></div><span>${array(task.target?.documentIds).length} 个文档 · ${selected.size} 个章节</span></header>${editable ? `<form data-incremental-target-form data-task-id="${escapeHtml(idOf(task))}">${selector}<div class="incremental-form-actions"><label>语言<select name="language"><option value="zh-CN" ${task.target?.language === 'en-US' ? '' : 'selected'}>中文</option><option value="en-US" ${task.target?.language === 'en-US' ? 'selected' : ''}>英文</option></select></label><button class="button" type="submit" ${available.length ? '' : 'disabled'}>确认范围</button><span class="incremental-form-status" role="status"></span></div></form>` : (task.target ? `<p class="incremental-empty">已确认：${array(task.target.documentIds).map(id => available.find(item => String(item.documentId || item.id) === String(id))?.documentName || available.find(item => String(item.documentId || item.id) === String(id))?.title || id).map(escapeHtml).join('、')}</p>` : '<p class="incremental-empty">未确认修改范围。</p>')}</section>`;
}

function draftSection(task) {
  const draft = task.draft || {};
  const state = task.state || task.status;
  const editable = task.capabilities?.canEdit !== false && !['candidate_ready', 'under_review', 'in_review', 'review_pending', 'pending_publish', 'approved', 'published', 'delivery_pending', 'completed', 'rejected'].includes(state);
  const documents = array(task.target?.documentIds);
  const sections = array(task.target?.sectionIds);
  const documentOptions = documents.map(id => `<option value="${escapeHtml(id)}">${escapeHtml(id)}</option>`).join('');
  const nodeControl = sections.length ? `<select name="nodeId" required><option value="">请选择</option>${sections.map(id => `<option value="${escapeHtml(id)}">${escapeHtml(id)}</option>`).join('')}</select>` : '<input name="nodeId" required placeholder="目标节点">';
  return `<section class="incremental-section incremental-draft" id="incremental-draft"><header><div><h3>增量草稿</h3><p>GitLab 正文可作为初稿；保存不会覆盖正式版本。</p></div><span>${draft.editVersion ? `草稿 ${escapeHtml(String(draft.editVersion))}` : '未保存'}</span></header><form data-incremental-draft-form data-task-id="${escapeHtml(idOf(task))}"><label class="incremental-draft-field">候选正文<textarea name="content" rows="14" ${editable ? '' : 'readonly'} placeholder="编辑本次提交审核的正文…">${escapeHtml(draft.content || task.draftContent || '')}</textarea></label>${editable ? `<fieldset class="incremental-operation-group"><legend>具体变更操作</legend><div class="incremental-operation-fields"><label>变更类型<select name="operationType" data-incremental-operation-type><option value="add">新增</option><option value="update">修改</option><option value="delete">删除</option><option value="move">移动</option></select></label><label>目标文档<select name="operationDocumentId" required><option value="">请选择</option>${documentOptions}</select></label><label>目标节点${nodeControl}</label><label data-operation-field="before" hidden>变更前指纹<input name="beforeDigest" placeholder="当前平台基线节点内容指纹"></label><label data-operation-field="after">变更后内容<textarea name="afterContent" rows="3" required></textarea></label><label data-operation-field="move" hidden>新父节点<input name="targetParentId"></label><label data-operation-field="move" hidden>新顺序<input name="ordinal" type="number" min="0" value="0"></label></div></fieldset><div class="incremental-form-actions"><button class="button secondary" type="submit">保存草稿</button><button class="button" type="button" data-incremental-checks="${escapeHtml(idOf(task))}">执行完整性检查</button><span class="incremental-form-status" role="status"></span></div>` : '<p class="incremental-lock-note">当前候选已冻结，如需修改必须退回后创建新草稿。</p>'}</form></section>`;
}

function checksSection(task) {
  const report = task.checkReport || task.checks || null;
  const issues = array(report?.issues || report?.items);
  const blockers = report?.passed === false ? issues : issues.filter(item => item.level === 'error' || item.blocking === true);
  return `<section class="incremental-section" id="incremental-checks"><header><div><h3>完整性检查</h3><p>核对来源、修改范围、草稿和变更集是否完整。</p></div><span>${report ? (report.passed ? '已通过' : `${blockers.length} 个阻断项`) : '待检查'}</span></header>${report ? `${issues.length ? `<ul class="incremental-issue-list">${issues.map(issue => `<li class="${report.passed === false || issue.level === 'error' || issue.blocking ? 'blocking' : ''}"><strong>${escapeHtml(issue.title || issue.code || '检查项')}</strong><span>${escapeHtml(issue.message || issue.description || '')}</span></li>`).join('')}</ul>` : '<p class="incremental-empty">来源、范围、草稿和变更集均已完整。</p>'}${task.state === 'checked' && report.passed ? `<button class="button" type="button" data-incremental-candidate="${escapeHtml(idOf(task))}">提交候选版本</button>` : ''}` : '<p class="incremental-empty">保存草稿后执行完整性检查。</p>'}<span class="incremental-form-status" role="status"></span></section>`;
}

function documentTitle(task, documentId, index) {
  const match = array(task.availableTargets || task.availableChapters || task.chapters).find(item => String(item.documentId || item.id) === String(documentId));
  return match?.documentName || match?.title || match?.name || `目标文档 ${index + 1}`;
}

function documentReviewStatus(task, documentId) {
  const reviews = array(task.reviews);
  const review = reviews.find(item => String(item.targetDocumentId || item.documentId || '') === String(documentId));
  if (review) return review.statusDisplayName || ({ pending: '审核中', approved: '已通过', rejected: '已退回' }[review.status]) || '状态待确认';
  if (reviews.length && array(task.target?.documentIds).length === 1) return reviews[0].statusDisplayName || ({ pending: '审核中', approved: '已通过', rejected: '已退回' }[reviews[0].status]) || '状态待确认';
  if (['draft', 'editing', 'checked'].includes(task.state)) return '待形成候选';
  if (task.state === 'candidate_ready') return '待提交审核';
  if (task.state === 'published') return '已发布';
  return '文档级状态待接入';
}

function documentStatusList(task) {
  const documents = array(task.target?.documentIds);
  if (!documents.length) return '<p class="incremental-context-empty">确认修改范围后显示文档状态。</p>';
  return `<ul class="incremental-document-status">${documents.map((id, index) => `<li><span><strong>${escapeHtml(documentTitle(task, id, index))}</strong>${documentTitle(task, id, index).startsWith('目标文档') ? '<small>名称待正式文档事实源返回</small>' : ''}</span><em>${escapeHtml(documentReviewStatus(task, id))}</em></li>`).join('')}</ul>`;
}

function reviewStage(task) {
  const reviews = array(task.reviews);
  const state = task.state || task.status;
  const canStartReview = task.capabilities?.canSubmitReview === true && state === 'candidate_ready' && !reviews.length;
  const canRevise = task.capabilities?.canRevise === true;
  return `<section class="incremental-stage-panel" aria-labelledby="incremental-review-title"><header><div><span class="incremental-stage-eyebrow">第 4 步</span><h3 id="incremental-review-title">按文档审核</h3><p>在专业审核工作区查看全文差异、来源证据和定位意见；此处只汇总各文档状态。</p></div><span class="incremental-stage-state">${escapeHtml(taskStatus(task))}</span></header>${documentStatusList(task)}<div class="incremental-form-actions">${canStartReview ? `<button class="button" type="button" data-incremental-review-create="${escapeHtml(idOf(task))}">提交文档审核</button>` : ''}<a class="button primary" href="/knowledge-center/review?taskId=${encodeURIComponent(idOf(task))}">进入审核工作区</a>${canRevise && state === 'rejected' ? `<button class="button secondary" type="button" data-incremental-revision="${escapeHtml(idOf(task))}">创建修订草稿</button>` : ''}</div>${!reviews.length && !canStartReview ? '<div class="incremental-block-note"><strong>审核事实待接入</strong><p>当前可以打开审核界面查看结构；正式审核必须等待候选版本和服务端审核记录。</p></div>' : ''}<span class="incremental-form-status" role="status"></span></section>`;
}

function publishStage(task, privileged) {
  if (task.handbookSource) {
    const completion = task.completion || {};
    const facts = completion.facts || {};
    const completionText = completion.status === 'completed'
      ? 'GitLab 已合并，目标分支正文与仓库相对图片已回读一致。'
      : facts.mergeState === 'closed' ? 'MR 已关闭且未合并，任务尚未完成。请在 GitLab 核对关闭原因，需要重新交付时进入文档编写并提交审核。'
        : task.mergeRequest ? 'MR 已创建，等待合并及目标分支回读。' : '审核通过后创建 GitLab MR。';
    return `<section class="incremental-stage-panel"><header><div><span class="incremental-stage-eyebrow">第 5 步</span><h3>发布与回读</h3><p>将审核通过的正文提交至 ${escapeHtml(task.handbookSource.branch)}，完成条件是合并并回读一致。</p></div><span class="incremental-stage-state">${escapeHtml(taskStatus(task))}</span></header><div class="incremental-release-summary"><div><span>GitLab MR</span><strong>${task.mergeRequest ? `!${escapeHtml(task.mergeRequest.iid)}` : '待创建'}</strong></div><div><span>正文回读</span><strong>${facts.markdownReadback ? '一致' : '待回读'}</strong></div><div><span>图片资源回读</span><strong>${facts.resourceReadback ? '一致' : '待回读'}</strong></div></div><p class="incremental-block-note">${completionText}</p>${task.mergeRequest ? `<a class="button" href="${escapeHtml(task.mergeRequest.webUrl)}" target="_blank" rel="noopener">MR链接 !${escapeHtml(task.mergeRequest.iid)}</a>` : `<button class="button" type="button" data-incremental-publish="${escapeHtml(idOf(task))}" ${task.capabilities?.canPublish ? '' : 'disabled'}>创建 MR</button>`}<span class="incremental-form-status" role="status"></span></section>`;
  }
  const state = task.state || task.status;
  const canPublish = ['pending_publish', 'approved'].includes(state);
  const canPublishTask = task.capabilities?.canPublish ?? privileged;
  const published = task.publication || task.publishedVersion;
  const evidence = array(task.externalEvidence || task.deliveryEvidence);
  const canRecordEvidence = task.capabilities?.canRecordEvidence ?? privileged;
  const documents = array(task.target?.documentIds);
  return `<section class="incremental-stage-panel" aria-labelledby="incremental-publish-title"><header><div><span class="incremental-stage-eyebrow">第 5 步</span><h3 id="incremental-publish-title">整体发布</h3><p>发布以整个任务为单位执行；任一文档失败时，全部文档保持原正式版本。</p></div><span class="incremental-stage-state">${escapeHtml(taskStatus(task))}</span></header><div class="incremental-release-summary"><div><span>目标文档</span><strong>${documents.length}</strong></div><div><span>审核门禁</span><strong>${canPublish ? '已满足' : published ? '已完成' : '未满足'}</strong></div><div><span>发布方式</span><strong>整体原子发布</strong></div></div>${canPublishTask && canPublish ? `<div class="incremental-release-warning"><strong>发布影响</strong><p>将为 ${documents.length} 个目标文档创建不可变新版本，并整体切换当前版本。</p></div><button class="button" type="button" data-incremental-publish="${escapeHtml(idOf(task))}">确认整体发布</button>` : `<button class="button" type="button" disabled>确认整体发布</button><p class="incremental-block-note" role="status">${!canPublish ? '所有目标文档审核通过后，才能整体发布。' : '当前账号没有整体发布权限。'}</p>`}${published ? `<div class="incremental-published"><strong>平台版本已发布</strong><span>${escapeHtml(published.id || '')} · ${fmtTime(published.publishedAt)}</span></div>` : ''}${published && (canRecordEvidence || evidence.length) ? `<details class="incremental-secondary-evidence"><summary>发布后的外部证据（不属于 MVP 主流程）</summary>${canRecordEvidence ? `<form class="incremental-inline-form evidence" data-incremental-evidence-form data-task-id="${escapeHtml(idOf(task))}"><label>证据类型<select name="type"><option value="gitlab_mr">GitLab MR</option><option value="ci">CI</option><option value="manual">人工记录</option></select></label><label>外部引用<input name="reference" required placeholder="MR 编号或证据地址"></label><label>结果<select name="status"><option value="pending">待确认</option><option value="success">成功</option><option value="failed">失败</option></select></label><label class="wide">说明<input name="note" maxlength="240"></label><button class="button secondary" type="submit">登记外部证据</button><span class="incremental-form-status" role="status"></span></form>` : ''}${evidence.length ? `<ul class="incremental-evidence-list">${evidence.map(item => `<li><strong>${escapeHtml(item.status || '待确认')}</strong><span>${escapeHtml(item.note || item.reference || '')}</span></li>`).join('')}</ul>` : ''}</details>` : ''}<span class="incremental-form-status" role="status"></span></section>`;
}

function setupStage(task) {
  return `<section class="incremental-stage-panel" aria-labelledby="incremental-setup-title"><header><div><span class="incremental-stage-eyebrow">第 1 步</span><h3 id="incremental-setup-title">建立任务</h3><p>确认本次增量更新使用的手册、业务版本和正式发布基线。</p></div><span class="incremental-stage-state">已建立</span></header><dl class="incremental-setup-facts"><div><dt>任务名称</dt><dd>${escapeHtml(task.name || task.title || '增量修改任务')}</dd></div><div><dt>所属手册</dt><dd>${escapeHtml(task.handbookName || task.handbookId || '手册信息待返回')}</dd></div><div><dt>业务版本</dt><dd>${escapeHtml(task.businessVersion || '未返回')}</dd></div><div><dt>发布基线</dt><dd>${escapeHtml(task.baselineVersionName || task.baselineVersionId || '未返回')}</dd></div></dl><div class="incremental-stage-footer"><span>任务已经建立，可以继续确认来源和修改范围。</span><button class="button" type="button" data-incremental-stage="inputs">继续确认输入</button></div></section>`;
}

function inputStage(task) {
  const hasInputs = Boolean(array(task.sources || task.sourceSnapshots).length && task.target?.documentIds?.length);
  return `<section class="incremental-stage-panel" aria-labelledby="incremental-input-title"><header><div><span class="incremental-stage-eyebrow">第 2 步</span><h3 id="incremental-input-title">确认输入</h3><p>添加参考资料，并确认本次修改涉及的文档和章节。</p></div><span class="incremental-stage-state">${array(task.sources || task.sourceSnapshots).length} 项资料</span></header>${sourceSection(task)}${targetSection(task)}<div class="incremental-stage-footer"><span>资料和修改范围保存后才能编写草稿。</span><button class="button" type="button" data-incremental-stage="generation" ${hasInputs ? '' : 'disabled'}>编写草稿</button></div></section>`;
}

function generationStage(task) {
  const hasGeneration = Boolean(task.generationRun || task.generationPlan);
  return `<section class="incremental-stage-panel" aria-labelledby="incremental-generation-title"><header><div><span class="incremental-stage-eyebrow">第 3 步</span><h3 id="incremental-generation-title">编写草稿</h3><p>编辑本次修改内容并保存；保存不会覆盖正式版本。</p></div><span class="incremental-stage-state">${hasGeneration ? escapeHtml(task.generationRun?.statusDisplayName || task.generationRun?.status || '生成状态待确认') : '手动编写'}</span></header>${hasGeneration ? `<div class="incremental-generation-run" role="status"><strong>${escapeHtml(task.generationRun?.statusDisplayName || '生成任务已建立')}</strong><p>${escapeHtml(task.generationRun?.progressMessage || '正在读取服务端运行状态。')}</p></div>` : '<p class="incremental-capability-note" role="note">Agent 自动生成暂未开放。你可以直接编写草稿，保存后继续检查和提交审核。</p>'}${draftSection(task)}${checksSection(task)}<div class="incremental-stage-footer"><span>草稿保存并通过完整性检查后，才能提交候选版本。</span><button class="button" type="button" data-incremental-stage="review" ${task.state !== 'candidate_ready' ? 'disabled' : ''}>按文档审核</button></div></section>`;
}

function taskContext(task, active) {
  const issues = array(task.checkReport?.issues || task.checks?.issues || task.checks?.items);
  const blockers = issues.filter(item => item.level === 'error' || item.blocking === true).length;
  const sources = array(task.sources || task.sourceSnapshots);
  return `<details class="incremental-context" aria-label="任务摘要与门禁"><summary>任务摘要 · ${escapeHtml(taskStatus(task))}</summary><section><h3>任务信息</h3><dl><div><dt>当前阶段</dt><dd>${escapeHtml(phases.find(([key]) => key === active)?.[1] || '')}</dd></div><div><dt>参考资料</dt><dd>${sources.length} 项</dd></div><div><dt>修改范围</dt><dd>${array(task.target?.documentIds).length} 个文档 · ${array(task.target?.sectionIds || task.targetScope?.sectionIds).length} 个章节</dd></div></dl></section><section class="${blockers ? 'has-blockers' : ''}"><h3>完整性检查</h3>${blockers ? `<p><strong>${blockers} 个阻断项</strong><br>请返回编写草稿并修复后重试。</p>` : task.checkReport || task.checks ? '<p><strong>已完成</strong> · 请按当前阶段继续。</p>' : '<p>尚未执行</p>'}</section><section><h3>发布基线</h3><p>${escapeHtml(task.baselineVersionName || task.baselineVersionId || '未返回')}</p><p>更新于 ${fmtTime(task.updatedAt)}</p></section></details>`;
}

function taskDetail(task, privileged, taskDocuments = [], taskOutlineStatus = 'not-requested') {
  if (!task) return `<section class="incremental-welcome">${emptyState('选择一个增量任务', '查看来源、修改范围、草稿、差异和发布进度。')}</section>`;
  const active = activePhase(task);
  const panels = { setup: setupStage(task), inputs: inputStage({ ...task, taskDocuments, taskOutlineStatus }), generation: generationStage(task), review: reviewStage(task), publish: publishStage(task, privileged) };
  return `<article class="incremental-detail"><header class="incremental-detail-header"><div><span>${escapeHtml(task.handbookName || task.handbookId || '手册待返回')} · ${escapeHtml(task.businessVersion || '业务版本待返回')}</span><h2>${escapeHtml(task.name || task.title || '增量修改任务')}</h2><p>基线：${escapeHtml(task.baselineVersionName || task.baselineVersionId || '未返回')} · 更新于 ${fmtTime(task.updatedAt)}</p></div><strong class="status">${escapeHtml(taskStatus(task))}</strong></header>${progress(task, active)}<div class="incremental-stage-layout"><main class="incremental-stage-main" tabindex="-1" data-incremental-stage-main>${panels[active]}</main>${taskContext(task, active)}</div></article>`;
}

function handbookValue(item, keys = []) {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return '';
}

function handbookOwner(item) {
  const owners = [item?.ownerA, item?.primaryOwner, item?.ownerAName, item?.primaryOwnerName, item?.ownerB, item?.assistantOwner, item?.ownerBName, item?.assistantOwnerName]
    .map(value => value && typeof value === 'object' ? (value.displayName || value.name || value.userName || '') : value)
    .map(value => String(value || '').trim())
    .filter(Boolean);
  return [...new Set(owners)].join('、') || '未分配';
}

function handbookProgress(tasks) {
  if (!tasks.length) return { label: '未开始', detail: '暂无进行中的生产任务' };
  const current = [...tasks].sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())[0];
  const state = current?.state || current?.status;
  const labels = {
    draft: '待确认', editing: '编写中', checked: '待提交', candidate_ready: '待审核', under_review: '审核中',
    rejected: '待修订', approved: '待发布', pending_publish: '待发布', published: '已发布', completed: '已完成',
  };
  const label = current?.completion?.label || current?.statusDisplayName || labels[state] || '处理中';
  const pending = tasks.filter(task => task?.completion?.status
    ? task.completion.status !== 'completed'
    : !['published', 'completed'].includes(task.state || task.status)).length;
  return { label, detail: pending > 1 ? `${pending} 个任务待处理` : pending === 1 ? '1 个任务待处理' : '暂无待处理事项' };
}

function handbookRows(projection, assetCatalog) {
  const source = array(projection?.handbooks?.length ? projection.handbooks : assetCatalog?.items || assetCatalog?.handbooks);
  const tasks = array(projection?.items || projection?.tasks);
  const byHandbook = new Map();
  tasks.forEach(task => {
    const id = String(task.handbookId || task.handbook?.id || task.handbook?.handbookId || '');
    if (!id) return;
    if (!byHandbook.has(id)) byHandbook.set(id, []);
    byHandbook.get(id).push(task);
  });
  return source.map(item => {
    const id = handbookValue(item, ['handbookId', 'id']);
    const related = byHandbook.get(id) || [];
    const progress = handbookProgress(related);
    const publishedTask = related.find(task => task.publication || task.publishedVersion || ['published', 'completed'].includes(task.state || task.status));
    const published = item.latestPublishedVersion || item.publishedVersion || publishedTask?.publication || publishedTask?.publishedVersion;
    return {
      id,
      name: item.name || item.handbookName || '未命名手册',
      product: item.productName || item.product?.name || item.productType || '未指定产品',
      owner: handbookOwner(item),
      progress: progress.label,
      progressDetail: progress.detail,
      published: published?.versionName || published?.name || published?.version || item.latestPublishedVersionName || '暂无发布版本',
      publishedAt: published?.publishedAt || published?.createdAt || item.latestPublishedAt || '',
    };
  }).filter(item => item.id);
}

function handbookOverview(projection, assetCatalog) {
  if (projection?.status === 'loading') return '<section class="production-overview-empty" role="status">正在读取已发布大纲…</section>';
  if (projection?.outlineCatalog?.status !== 'ok') return `<section class="production-overview-empty" role="alert"><strong>发布大纲暂时无法读取</strong><p>${escapeHtml(projection?.outlineCatalog?.error?.message || '请稍后重新读取。')}</p><button class="button secondary compact" type="button" data-incremental-reload>重新读取</button></section>`;
  const outlines = array(projection.outlineCatalog.items);
  const publishedHandbookIds = new Set(outlines.filter(item => String(item.state || item.status || '').toLowerCase() === 'published').map(item => String(item.handbookId || item.manualId || '')).filter(Boolean));
  const allRows = handbookRows(projection, assetCatalog).filter(item => publishedHandbookIds.has(item.id));
  const search = new URLSearchParams(window.location.search).get('q') || '';
  const query = search.trim().toLocaleLowerCase();
  const rows = allRows.filter(item => !query || item.name.toLocaleLowerCase().includes(query));
  if (!allRows.length) return `<section class="production-overview-empty">${emptyState('暂无可生产的手册', '手册发布大纲后会显示在这里。')}</section>`;
  const column = (key, label, required = false) => `<th data-table-column="${key}" data-table-column-label="${label}" data-table-column-required="${required}" data-production-column-head="${key}" class="${required ? 'is-required' : ''}">${label}</th>`;
  const cell = (key, content, className = '') => `<td class="${className}" data-table-column="${key}" data-production-column-cell="${key}">${content}</td>`;
  return `<section class="production-overview" aria-label="手册生产列表"><div class="production-overview-toolbar"><label class="production-handbook-search">搜索手册<input type="search" data-production-handbook-search value="${escapeHtml(search)}" placeholder="输入手册名称" aria-label="搜索已发布大纲的手册"></label><span data-production-handbook-count>${rows.length} / ${allRows.length} 本</span></div><div class="production-handbook-table-wrap" data-table-view-host ${rows.length ? '' : 'hidden'}><table class="production-handbook-table" data-table-view-id="production-handbooks" data-table-view-schema="1" data-table-view-label="手册生产列表" data-table-view-legacy-key="kc-production-handbook-columns"><caption class="sr-only">手册生产进展</caption><thead><tr>${column('handbook', '手册', true)}${column('product', '所属产品')}${column('owner', '负责人')}${column('progress', '当前进展')}${column('published', '最近发布')}</tr></thead><tbody>${allRows.map(item => `<tr class="production-handbook-row" tabindex="0" role="link" data-production-handbook-row data-handbook-search-text="${escapeHtml(item.name.toLocaleLowerCase())}" data-handbook-href="/knowledge-center/production/handbook/${encodeURIComponent(item.id)}" ${query && !item.name.toLocaleLowerCase().includes(query) ? 'hidden' : ''}>${cell('handbook', `<strong>${escapeHtml(item.name)}</strong>`, 'is-required')}${cell('product', escapeHtml(item.product))}${cell('owner', escapeHtml(item.owner))}${cell('progress', `<strong>${escapeHtml(item.progress)}</strong><small>${escapeHtml(item.progressDetail)}</small>`)}${cell('published', `<strong>${escapeHtml(item.published)}</strong><small>${escapeHtml(item.publishedAt ? fmtTime(item.publishedAt) : '发布时间暂不可用')}</small>`)}</tr>`).join('')}</tbody></table></div><section class="production-overview-empty" data-production-handbook-empty role="status" ${rows.length ? 'hidden' : ''}>没有匹配“${escapeHtml(search)}”的手册，请尝试其他名称。</section></section>`;
}

const progressStages = ['待生成', '生成中', '待审核', '退回修订', '待发布', '已完成', '状态待确认'];
function productionStage(task) {
  const state = String(task?.state || task?.status || '').toLowerCase();
  if (task?.completion?.status === 'completed') return '已完成';
  if (state === 'published') return '已完成';
  if (['rejected', 'changes_requested'].includes(state)) return '退回修订';
  if (['pending_publish', 'approved', 'mr_submitted', 'batch_publish_failed'].includes(state)) return '待发布';
  if (['candidate_ready', 'under_review', 'in_review', 'review_pending'].includes(state)) return '待审核';
  if (['editing', 'checked', 'pending_submission', 'checks_passed', 'generation_failed'].includes(state)) return '生成中';
  if (['draft', 'pending', 'queued', 'not_started', 'waiting_generation'].includes(state)) return '待生成';
  return '状态待确认';
}

function progressUrl(params, changes = {}) {
  const next = new URLSearchParams(params);
  next.set('view', 'progress');
  for (const [key, value] of Object.entries(changes)) value ? next.set(key, value) : next.delete(key);
  return `/knowledge-center/production?${next.toString()}`;
}
const localDateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function productionActivityDate(item) {
  // Calendar placement uses server-provided activity facts and known legacy aliases.
  for (const value of [item?.activityAt, item?.lastActivityAt, item?.updatedAt, item?.createdAt, item?.startedAt,
    item?.plannedStartAt, item?.plannedStartTime, item?.updated_at, item?.created_at, item?.started_at]) {
    const date = new Date(value || '');
    if (!Number.isNaN(date.getTime())) return localDateKey(date);
  }
  return '';
}
function productionTaskItems(projection) {
  const items = array(projection?.items);
  const tasks = array(projection?.tasks);
  return items.length || !tasks.length ? items : tasks;
}

export function renderProductionProgress(projection) {
  if (projection?.status === 'loading') return '<section class="production-overview-empty" role="status">正在读取生产任务…</section>';
  if (projection?.status === 'unavailable') return `<section class="production-overview-empty" role="alert"><strong>生产任务暂时无法读取</strong><p>${escapeHtml(projection.error?.message || '请稍后重新读取。')}</p><button class="button secondary compact" type="button" data-incremental-reload>重新读取</button></section>`;
  const params = new URLSearchParams(window.location.search);
  const all = productionTaskItems(projection);
  const q = String(params.get('q') || '').trim().toLocaleLowerCase();
  const status = params.get('status') || '';
  const handbook = params.get('handbook') || '';
  const version = params.get('version') || '';
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const selectedStage = params.get('stage') || '';
  const mode = ['list', 'calendar', 'charts'].includes(params.get('mode')) ? params.get('mode') : 'calendar';
  const calendarView = params.get('calendarView') === 'week' ? 'week' : 'month';
  const requestedDay = params.get('day') || '';
  const selectedDay = /^\d{4}-\d{2}-\d{2}$/.test(requestedDay) ? requestedDay : all.map(productionActivityDate).filter(Boolean).sort().at(-1) || localDateKey(new Date());
  const handbooks = [...new Set(all.map(item => String(item.handbookName || item.handbookId || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const versions = [...new Set(all.map(item => String(item.businessVersion || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
  const matchesFilters = all.filter(item => {
    const itemStatus = taskStatus(item);
    const itemHandbook = String(item.handbookName || item.handbookId || '').trim();
    const itemVersion = String(item.businessVersion || '').trim();
    const itemDate = productionActivityDate(item);
    const text = `${item.name || item.title || ''} ${item.id || ''} ${itemHandbook} ${itemVersion} ${itemStatus}`.toLocaleLowerCase();
    return (!q || text.includes(q)) && (!status || itemStatus === status)
      && (!handbook || itemHandbook === handbook) && (!version || itemVersion === version)
      && (!from || (itemDate && itemDate >= from)) && (!to || (itemDate && itemDate <= to))
      && (!from && !to || itemDate);
  });
  const stageFiltered = matchesFilters.filter(item => !selectedStage || productionStage(item) === selectedStage);
  const filtered = mode === 'calendar'
    ? stageFiltered.filter(item => productionActivityDate(item) === selectedDay)
    : stageFiltered;
  const undated = mode === 'calendar' ? stageFiltered.filter(item => !productionActivityDate(item)) : [];
  const counts = Object.fromEntries(progressStages.map(stage => [stage, matchesFilters.filter(item => productionStage(item) === stage).length]));
  const form = `<form class="production-progress-filters" data-production-progress-filter><label class="sr-only" for="production-progress-search">搜索任务</label><input id="production-progress-search" name="q" type="search" value="${escapeHtml(params.get('q') || '')}" placeholder="搜索标题或编号"><label class="sr-only" for="production-progress-status">状态</label><select id="production-progress-status" name="status"><option value="">全部状态</option>${[...new Set(all.map(taskStatus))].sort().map(value => `<option value="${escapeHtml(value)}" ${status === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select><label class="sr-only" for="production-progress-handbook">手册</label><select id="production-progress-handbook" name="handbook"><option value="">全部手册</option>${handbooks.map(value => `<option value="${escapeHtml(value)}" ${handbook === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select><label class="sr-only" for="production-progress-version">版本</label><select id="production-progress-version" name="version"><option value="">全部版本</option>${versions.map(value => `<option value="${escapeHtml(value)}" ${version === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select><label class="sr-only" for="production-progress-from">开始日期</label><input id="production-progress-from" name="from" type="date" value="${escapeHtml(from)}"><label class="sr-only" for="production-progress-to">结束日期</label><input id="production-progress-to" name="to" type="date" value="${escapeHtml(to)}"><button class="button secondary compact" type="submit">筛选</button><button class="button tertiary compact" type="button" data-production-progress-clear>清空</button></form>`;
  const stageTiles = `<nav class="production-progress-stages" aria-label="生产阶段筛选"><button type="button" data-progress-stage="" aria-pressed="${!selectedStage}"><span>全部任务</span><strong>${matchesFilters.length}</strong></button>${progressStages.map(stage => `<button type="button" data-progress-stage="${escapeHtml(stage)}" aria-pressed="${selectedStage === stage}"><span>${stage}</span><strong>${counts[stage]}</strong></button>`).join('')}</nav>`;
  const modeTabs = `<nav class="production-progress-modes" aria-label="生产进展显示方式" role="tablist"><button type="button" role="tab" data-progress-mode="list" aria-selected="${mode === 'list'}">列表</button><button type="button" role="tab" data-progress-mode="calendar" aria-selected="${mode === 'calendar'}">日历</button><button type="button" role="tab" data-progress-mode="charts" aria-selected="${mode === 'charts'}">图表</button></nav>`;
  const taskRow = item => {
    const activityAt = [item.updatedAt, item.updated_at, item.activityAt, item.lastActivityAt, item.createdAt, item.created_at, item.startedAt, item.started_at, item.plannedStartAt, item.plannedStartTime].find(Boolean);
    return `<button type="button" class="production-progress-row" data-progress-task-summary="${escapeHtml(idOf(item))}"><span><strong>${escapeHtml(item.name || item.title || '未命名任务')}</strong><small>${escapeHtml(item.handbookName || item.handbookId || '手册待确认')}${item.businessVersion ? ` · ${escapeHtml(item.businessVersion)}` : ''} · ${escapeHtml(item.id || '')}</small></span><span class="production-progress-status">${escapeHtml(taskStatus(item))}</span><time>${escapeHtml(activityAt ? fmtTime(activityAt) : '时间未记录')}</time><span class="production-progress-open">查看</span></button>`;
  };
  let content;
  if (mode === 'calendar') {
    const center = new Date(`${selectedDay}T00:00:00`);
    const weekStart = new Date(center); weekStart.setDate(center.getDate() - ((center.getDay() + 6) % 7));
    const monthStart = new Date(center.getFullYear(), center.getMonth(), 1);
    const gridStart = new Date(monthStart); gridStart.setDate(monthStart.getDate() - ((monthStart.getDay() + 6) % 7));
    const dayCount = calendarView === 'week' ? 7 : 42;
    const rangeStart = calendarView === 'week' ? weekStart : gridStart;
    const days = Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(rangeStart); date.setDate(rangeStart.getDate() + index);
      const day = localDateKey(date);
      const dayTasks = stageFiltered.filter(item => productionActivityDate(item) === day);
      const dayCount = dayTasks.length;
      const taskTitles = dayTasks.slice(0, 2).map(item => `<small class="production-calendar-task-title" title="${escapeHtml(item.name || item.title || '未命名任务')}">${escapeHtml(item.name || item.title || '未命名任务')}</small>`).join('');
      const remainingTasks = dayCount - Math.min(dayCount, 2);
      const outsideMonth = date.getMonth() !== center.getMonth();
      const workCalendar = projection?.workCalendars?.[date.getFullYear()];
      const configured = Boolean(workCalendar?.configured);
      const kind = configured
        ? workCalendar.days?.[day] || (date.getDay() === 0 || date.getDay() === 6 ? 'weekend' : 'workday')
        : 'unconfigured';
      const adjustedWorkday = kind === 'workday' && configured && (date.getDay() === 0 || date.getDay() === 6);
      const dayLabel = kind === 'holiday' ? '法定节假日' : adjustedWorkday ? '调休工作日' : kind === 'weekend' ? '周末' : '';
      const dayClasses = [outsideMonth && calendarView === 'month' ? 'is-outside-month' : '', `is-${kind}`, adjustedWorkday ? 'is-adjusted-workday' : ''].filter(Boolean).join(' ');
      const accessibleLabel = `${day}，${dayLabel ? `${dayLabel}，` : ''}${dayCount} 项${dayTasks.length ? `，${dayTasks.map(item => item.name || item.title || '未命名任务').join('、')}` : ''}`;
      return `<button type="button" data-progress-day="${day}" class="${dayClasses}" aria-label="${escapeHtml(accessibleLabel)}" ${day === selectedDay ? 'aria-current="date"' : ''}><strong>${date.getDate()}</strong>${dayLabel ? `<small class="production-calendar-kind">${dayLabel}</small>` : ''}<small class="production-calendar-task-count">${dayCount} 项</small>${taskTitles}${remainingTasks ? `<small class="production-calendar-task-more">+${remainingTasks}</small>` : ''}</button>`;
    }).join('');
    const previous = new Date(center.getFullYear(), center.getMonth() - 1, 1);
    const next = new Date(center.getFullYear(), center.getMonth() + 1, 1);
    const previousDay = calendarView === 'week' ? localDateKey(new Date(center.getFullYear(), center.getMonth(), center.getDate() - 7)) : localDateKey(previous);
    const nextDay = calendarView === 'week' ? localDateKey(new Date(center.getFullYear(), center.getMonth(), center.getDate() + 7)) : localDateKey(next);
    const periodTitle = calendarView === 'week'
      ? `${localDateKey(weekStart)} 至 ${localDateKey(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6))}`
      : center.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
    const calendarModes = `<nav class="production-calendar-modes" aria-label="日历范围"><button type="button" data-progress-calendar-view="week" aria-pressed="${calendarView === 'week'}">周</button><button type="button" data-progress-calendar-view="month" aria-pressed="${calendarView === 'month'}">月</button></nav>`;
    const calendarHeader = `<header class="production-calendar-header"><button type="button" data-progress-calendar-nav="${previousDay}" aria-label="上一${calendarView === 'week' ? '周' : '月'}">${uiIcon('calendar.previous')}</button><h2>${escapeHtml(periodTitle)}</h2><button type="button" data-progress-calendar-nav="${nextDay}" aria-label="下一${calendarView === 'week' ? '周' : '月'}">${uiIcon('calendar.next')}</button>${calendarModes}<button type="button" class="production-calendar-today" data-progress-calendar-today>今天</button></header>`;
    const weekdays = `<div class="production-calendar-weekdays" aria-hidden="true">${['一', '二', '三', '四', '五', '六', '日'].map(day => `<span>${day}</span>`).join('')}</div>`;
    const agendaTitle = new Date(`${selectedDay}T00:00:00`).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
    const calendarConfigured = Boolean(projection?.workCalendars?.[center.getFullYear()]?.configured);
    const calendarLegend = calendarConfigured
      ? '<span class="is-workday">工作日</span><span class="is-weekend">周末</span><span class="is-holiday">法定节假日</span><span class="is-adjusted">调休工作日</span>'
      : '<span class="is-unconfigured" role="status">该年度工作日历未配置，日期性质未知</span>';
    const undatedSection = undated.length ? `<section class="production-calendar-undated" aria-label="未记录日期的任务"><h2>未记录活动日期</h2>${undated.map(taskRow).join('')}</section>` : '';
    content = `<section class="production-calendar" data-calendar-view="${calendarView}">${calendarHeader}<p class="production-calendar-legend" data-calendar-legend>${calendarLegend}</p>${weekdays}<div class="production-calendar-grid">${days}</div><section class="production-calendar-agenda"><h2>${escapeHtml(agendaTitle)}</h2>${filtered.length ? filtered.map(taskRow).join('') : '<p class="production-overview-empty">当天没有符合条件的任务</p>'}</section>${undatedSection}</section>`;
  } else if (mode === 'charts') {
    const byStage = progressStages.map(stage => ({ stage, count: stageFiltered.filter(item => productionStage(item) === stage).length }));
    const maxStage = Math.max(1, ...byStage.map(item => item.count));
    const byDate = [...new Set(stageFiltered.map(productionActivityDate).filter(Boolean))].sort().slice(-14).map(day => ({ day, count: stageFiltered.filter(item => productionActivityDate(item) === day).length }));
    const maxDate = Math.max(1, ...byDate.map(item => item.count));
    content = `<section class="production-progress-charts"><article><h2>当前阶段</h2>${byStage.map(item => `<div class="production-chart-row"><span>${escapeHtml(item.stage)}</span><div class="production-chart-track"><i style="--chart-value:${Math.round(item.count / maxStage * 100)}%"></i></div><strong>${item.count}</strong></div>`).join('')}</article><article><h2>最近更新时间</h2>${byDate.length ? `<div class="production-date-chart" role="img" aria-label="最近14个有更新时间的日期，每日任务更新数量">${byDate.map(item => `<div><i style="--chart-value:${Math.round(item.count / maxDate * 100)}%" title="${item.day}：${item.count} 项"></i><span>${item.day.slice(5)}</span></div>`).join('')}</div>` : '<p class="production-overview-empty">暂无可统计的更新时间</p>'}<p>依据任务最近更新时间统计，不代表状态变更记录。</p></article></section>`;
  } else {
    content = filtered.length ? `<section class="production-progress-list" aria-label="生产任务列表">${filtered.map(taskRow).join('')}</section>` : `<section class="production-overview-empty">${emptyState('没有符合条件的任务', '调整筛选条件后重试。')}</section>`;
  }
  return `<section class="production-progress-overview"><header class="production-progress-toolbar">${modeTabs}</header>${stageTiles}${form}<div class="production-progress-result"><span>${filtered.length} 项</span></div>${content}</section>`;
}

function productionTabs(active) {
  return `<nav class="production-overview-tabs" role="tablist" aria-label="文档生产视图"><button type="button" role="tab" data-production-overview-tab="handbooks" aria-selected="${active === 'handbooks'}">手册视图</button><button type="button" role="tab" data-production-overview-tab="progress" aria-selected="${active === 'progress'}">生产进展</button><button type="button" role="tab" data-production-overview-tab="generations" aria-selected="${active === 'generations'}">我的生成</button></nav>`;
}

export function renderProduction({ incrementalProjection, assetCatalog, platformAdmin, currentUser, handbookProductionUi, templateProjection }) {
  const projection = incrementalProjection || { status: 'loading' };
  if (projection.requestedHandbookId) return renderHandbookProduction({ projection, currentUser, ui: handbookProductionUi, templateProjection });
  const task = selectedTask(projection);
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get('view');
  const normalizedView = requestedView === 'todo' ? 'generations' : requestedView;
  const active = params.get('taskId') ? 'tasks' : (['handbooks', 'progress', 'tasks', 'generations'].includes(normalizedView) ? normalizedView : 'handbooks');
  const taskItems = array(projection.items || projection.tasks);
  const unavailable = projection.status === 'unavailable' ? `<section class="incremental-list-state error" role="alert"><strong>增量服务暂时不可用</strong><span>${escapeHtml(projection.error?.message || '请稍后重试')}</span><button class="button secondary compact" type="button" data-incremental-reload>重新读取</button></section>` : '';
  const body = unavailable || (active === 'handbooks'
    ? handbookOverview(projection, assetCatalog)
    : active === 'progress'
          ? renderProductionProgress(projection)
    : active === 'generations'
      ? myGenerations(projection.generations || { status: 'loading', items: [] })
      : `<div class="incremental-workspace"><aside class="incremental-sidebar" aria-label="增量任务"><header><div><h2>增量任务</h2><span>${taskItems.length} 项</span></div></header>${taskList(projection)}</aside><div class="incremental-main">${taskDetail(task, platformAdmin, projection.taskDocuments, projection.taskOutlineStatus)}</div></div>`);
  const taskBack = active === 'tasks' && params.get('taskId') ? '<button class="button secondary compact" type="button" data-production-back-progress>返回生产进展</button>' : '';
  return `${active === 'tasks' ? '' : productionTabs(active)}${taskBack}${body}<dialog class="production-task-summary" data-production-task-summary aria-labelledby="production-task-summary-title"><header><h2 id="production-task-summary-title"></h2><button type="button" class="icon-button" data-production-summary-close aria-label="关闭">${uiIcon('action.close')}</button></header><dl><div><dt>手册</dt><dd data-summary-handbook></dd></div><div><dt>版本</dt><dd data-summary-version></dd></div><div><dt>状态</dt><dd data-summary-status></dd></div><div><dt>最近更新</dt><dd data-summary-updated></dd></div></dl><footer><button class="button secondary" type="button" data-production-summary-close>关闭</button><button class="button" type="button" data-progress-enter-task>进入任务</button></footer></dialog>`;
}

export function renderStages({ incrementalProjection }) {
  const tasks = array(incrementalProjection?.items || incrementalProjection?.tasks);
  return `<div class="page-intro"><div><h2>生产进展</h2></div><button class="button secondary" data-action="production">返回文档生产</button></div>${tasks.length ? `<div class="incremental-task-list">${tasks.map(task => `<div class="incremental-task-item"><strong>${escapeHtml(task.name || '未命名任务')}</strong><span>${escapeHtml(taskStatus(task))}</span></div>`).join('')}</div>` : emptyState('暂无生产进展', '当前没有可查看的任务记录。')}`;
}
