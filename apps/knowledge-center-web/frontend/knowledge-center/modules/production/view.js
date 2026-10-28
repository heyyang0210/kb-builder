import { emptyState } from '../../common/components/ui.js';
import { escapeHtml } from '../../common/utils/dom.js';
import { renderHandbookProduction } from './handbook-view.js';

const statusNames = {
  draft: '待选来源', editing: '编辑中', checked: '完整性已检查', candidate_ready: '待提交审核',
  under_review: '审核中', approved: '待发布', rejected: '已退回', published: '平台已发布', mr_submitted: '已提交 MR',
};
const phases = [
  ['setup', '建立任务'],
  ['inputs', '确认输入'],
  ['generation', '生成与修订'],
  ['review', '按文档审核'],
  ['publish', '整体发布'],
];

const array = value => Array.isArray(value) ? value : [];
const idOf = value => String(value?.taskId || value?.id || '');
const selectedTask = projection => projection?.detail?.task || projection?.detail || null;
const taskStatus = task => task?.completion?.status === 'completed'
  ? (task.completion.label || '已完成')
  : task?.completion?.status === 'pending' && task?.mergeRequest
    ? (task.completion.label || '待合并回读')
    : task?.statusDisplayName || statusNames[task?.state] || statusNames[task?.status] || task?.state || task?.status || '状态未返回';
function fmtTime(value) { if (!value) return '暂无'; const date = new Date(value); return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleString('zh-CN', { hour12: false }); }
function suggestedPhase(task) {
  const status = task?.state || task?.status;
  if (['pending_publish', 'approved', 'published', 'batch_publish_failed'].includes(status)) return 'publish';
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
  if (!items.length) return emptyState('暂无增量任务', '选择有已发布基线的手册创建第一个任务。');
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
  const sourceTypeName = type => type === 'local' ? '本地资料' : '人工选择';
  return `<section class="incremental-section" id="incremental-source"><header><div><h3>来源材料</h3><p>人工选择并固化本次修改使用的内容。</p></div><span>${sources.length} 项</span></header>${sources.length ? `<ul class="incremental-fact-list">${sources.map(source => `<li><div><strong>${escapeHtml(source.label || source.title || source.name || '未命名来源')}</strong><small>${sourceTypeName(source.sourceType)} · 人工固化，未经连接器验证</small></div>${source.reference ? `<span>${escapeHtml(source.reference)}</span>` : ''}</li>`).join('')}</ul>` : '<p class="incremental-empty">尚未固化来源。</p>'}${editable ? `<form class="incremental-inline-form source" data-incremental-source-form data-task-id="${escapeHtml(idOf(task))}"><label>来源名称<input name="label" required maxlength="120"></label><label>来源引用<input name="reference" placeholder="PingCode 页面或任务编号"></label><label>来源方式<select name="sourceType"><option value="manual">人工选择</option><option value="local">本地资料</option></select></label><label class="wide">已确认的来源内容<textarea name="content" rows="5" required></textarea></label><button class="button" type="submit">选择并固化</button><span class="incremental-form-status" role="status"></span></form>` : ''}</section>`;
}

function targetSection(task) {
  const available = array(task.availableTargets || task.availableChapters || task.chapters);
  const selected = new Set(array(task.target?.sectionIds || task.targetScope?.sectionIds).map(String));
  const documentIds = array(task.target?.documentIds).join('\n');
  const selector = `<label class="incremental-draft-field">目标文档 ID（每行一个）<textarea name="documentIds" rows="3" required>${escapeHtml(documentIds)}</textarea></label>${available.length ? `<div class="incremental-target-list">${available.map(item => { const id = String(item.chapterId || item.nodeId || item.id); return `<label><input type="checkbox" name="sectionIds" value="${escapeHtml(id)}" data-document-id="${escapeHtml(item.documentId || '')}" ${selected.has(id) ? 'checked' : ''}><span><strong>${escapeHtml(item.title || item.name || '未命名章节')}</strong><small>${escapeHtml(item.path || item.documentName || '')}</small></span></label>`; }).join('')}</div>` : ''}`;
  const editable = task.capabilities?.canEdit !== false && ['draft', 'editing', 'checked'].includes(task.state);
  return `<section class="incremental-section" id="incremental-target"><header><div><h3>修改范围</h3><p>只保存人工确认的文档和章节，不自动扩大范围。</p></div><span>${array(task.target?.documentIds).length} 个文档 · ${selected.size} 个章节</span></header>${editable ? `<form data-incremental-target-form data-task-id="${escapeHtml(idOf(task))}">${selector}<div class="incremental-form-actions"><label>语言<select name="language"><option value="zh-CN" ${task.target?.language === 'en-US' ? '' : 'selected'}>中文</option><option value="en-US" ${task.target?.language === 'en-US' ? 'selected' : ''}>English</option></select></label><button class="button" type="submit">确认范围</button><span class="incremental-form-status" role="status"></span></div></form>` : (task.target ? `<p class="incremental-empty">已确认：${escapeHtml(documentIds.replace(/\n/g, '、'))}</p>` : '<p class="incremental-empty">未确认修改范围。</p>')}</section>`;
}

function draftSection(task) {
  const draft = task.draft || {};
  const state = task.state || task.status;
  const editable = task.capabilities?.canEdit !== false && !['candidate_ready', 'under_review', 'in_review', 'review_pending', 'pending_publish', 'approved', 'published', 'delivery_pending', 'completed', 'rejected'].includes(state);
  const documents = array(task.target?.documentIds);
  const sections = array(task.target?.sectionIds);
  const documentOptions = documents.map(id => `<option value="${escapeHtml(id)}">${escapeHtml(id)}</option>`).join('');
  const nodeControl = sections.length ? `<select name="nodeId" required><option value="">请选择</option>${sections.map(id => `<option value="${escapeHtml(id)}">${escapeHtml(id)}</option>`).join('')}</select>` : '<input name="nodeId" required placeholder="目标节点">';
  return `<section class="incremental-section incremental-draft" id="incremental-draft"><header><div><h3>增量草稿</h3><p>GitLab 正文可作为初稿；保存不会覆盖正式版本。</p></div><span>${draft.editVersion ? `草稿 ${escapeHtml(String(draft.editVersion))}` : '未保存'}</span></header><form data-incremental-draft-form data-task-id="${escapeHtml(idOf(task))}"><label class="incremental-draft-field">本次修改内容<textarea name="content" rows="14" ${editable ? '' : 'readonly'} placeholder="在此编辑增量内容…">${escapeHtml(draft.content || task.draftContent || '')}</textarea></label>${editable ? `<div class="incremental-operation-fields"><label>变更类型<select name="operationType" data-incremental-operation-type><option value="add">新增</option><option value="update">修改</option><option value="delete">删除</option><option value="move">移动</option></select></label><label>目标文档<select name="operationDocumentId" required><option value="">请选择</option>${documentOptions}</select></label><label>目标节点${nodeControl}</label><label data-operation-field="before" hidden>变更前指纹<input name="beforeDigest" placeholder="当前平台基线节点内容指纹"></label><label data-operation-field="after">变更后内容<textarea name="afterContent" rows="3" required></textarea></label><label data-operation-field="move" hidden>新父节点<input name="targetParentId"></label><label data-operation-field="move" hidden>新顺序<input name="ordinal" type="number" min="0" value="0"></label></div><div class="incremental-form-actions"><button class="button secondary" type="submit">保存草稿</button><button class="button" type="button" data-incremental-checks="${escapeHtml(idOf(task))}">执行完整性检查</button><span class="incremental-form-status" role="status"></span></div>` : '<p class="incremental-lock-note">当前候选已冻结，如需修改必须退回后创建新草稿。</p>'}</form></section>`;
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
  const canStartReview = state === 'candidate_ready' && !reviews.length;
  const canRevise = task.capabilities?.canRevise ?? (task.capabilities?.canEdit ?? true);
  return `<section class="incremental-stage-panel" aria-labelledby="incremental-review-title"><header><div><span class="incremental-stage-eyebrow">第 4 步</span><h3 id="incremental-review-title">按文档审核</h3><p>在专业审核工作区查看全文差异、来源证据和定位意见；此处只汇总各文档状态。</p></div><span class="incremental-stage-state">${escapeHtml(taskStatus(task))}</span></header>${documentStatusList(task)}<div class="incremental-form-actions">${canStartReview ? `<button class="button" type="button" data-incremental-review-create="${escapeHtml(idOf(task))}">提交文档审核</button>` : ''}<a class="button primary" href="/knowledge-center/review?taskId=${encodeURIComponent(idOf(task))}">进入审核工作区</a>${canRevise && state === 'rejected' ? `<button class="button secondary" type="button" data-incremental-revision="${escapeHtml(idOf(task))}">创建修订草稿</button>` : ''}</div>${!reviews.length && !canStartReview ? '<div class="incremental-block-note"><strong>审核事实待接入</strong><p>当前可以打开审核界面查看结构；正式审核必须等待候选版本和服务端审核记录。</p></div>' : ''}<span class="incremental-form-status" role="status"></span></section>`;
}

function publishStage(task, privileged) {
  if (task.handbookSource) {
    const completion = task.completion || {};
    const facts = completion.facts || {};
    const completionText = completion.status === 'completed'
      ? 'GitLab 已合并，目标分支正文与仓库相对图片已回读一致。'
      : task.mergeRequest ? 'MR 已创建，等待合并及目标分支回读。' : '审核通过后创建 GitLab MR。';
    return `<section class="incremental-stage-panel"><header><div><span class="incremental-stage-eyebrow">第 5 步</span><h3>发布与回读</h3><p>将审核通过的正文提交至 ${escapeHtml(task.handbookSource.branch)}，完成条件是合并并回读一致。</p></div><span class="incremental-stage-state">${escapeHtml(taskStatus(task))}</span></header><div class="incremental-release-summary"><div><span>GitLab MR</span><strong>${task.mergeRequest ? `!${escapeHtml(task.mergeRequest.iid)}` : '待创建'}</strong></div><div><span>正文回读</span><strong>${facts.markdownReadback ? '一致' : '待回读'}</strong></div><div><span>图片资源回读</span><strong>${facts.resourceReadback ? '一致' : '待回读'}</strong></div></div><p class="incremental-block-note">${completionText}</p>${task.mergeRequest ? `<a class="button" href="${escapeHtml(task.mergeRequest.webUrl)}" target="_blank" rel="noopener">查看 MR !${escapeHtml(task.mergeRequest.iid)}</a>` : `<button class="button" type="button" data-incremental-publish="${escapeHtml(idOf(task))}" ${task.capabilities?.canPublish ? '' : 'disabled'}>发布：创建 GitLab MR</button>`}<span class="incremental-form-status" role="status"></span></section>`;
  }
  const state = task.state || task.status;
  const canPublish = ['pending_publish', 'approved'].includes(state);
  const canPublishTask = task.capabilities?.canPublish ?? privileged;
  const published = task.publication || task.publishedVersion;
  const evidence = array(task.externalEvidence || task.deliveryEvidence);
  const canRecordEvidence = task.capabilities?.canRecordEvidence ?? privileged;
  const documents = array(task.target?.documentIds);
  return `<section class="incremental-stage-panel" aria-labelledby="incremental-publish-title"><header><div><span class="incremental-stage-eyebrow">第 5 步</span><h3 id="incremental-publish-title">整体发布</h3><p>发布以整个任务为单位执行；任一文档失败时，全部文档保持原正式版本。</p></div><span class="incremental-stage-state">${escapeHtml(taskStatus(task))}</span></header><div class="incremental-release-summary"><div><span>目标文档</span><strong>${documents.length}</strong></div><div><span>审核门禁</span><strong>${canPublish ? '已满足' : published ? '已完成' : '未满足'}</strong></div><div><span>发布方式</span><strong>整体原子发布</strong></div></div>${canPublishTask && canPublish ? `<div class="incremental-release-warning"><strong>发布影响</strong><p>将为 ${documents.length} 个目标文档创建不可变新版本，并整体切换当前版本。</p></div><button class="button" type="button" data-incremental-publish="${escapeHtml(idOf(task))}">确认整体发布</button>` : `<button class="button secondary" type="button" data-incremental-prototype-publish>体验发布确认</button><p class="incremental-prototype-status" role="status">${published ? '服务端已返回发布版本。' : '当前仅展示前端确认，不会改变正式版本。'}</p>`}${published ? `<div class="incremental-published"><strong>平台版本已发布</strong><span>${escapeHtml(published.id || '')} · ${fmtTime(published.publishedAt)}</span></div>` : !canPublish ? '<div class="incremental-block-note"><strong>发布门禁尚未满足</strong><p>正式发布需要所有目标文档审核通过。</p></div>' : ''}${published && (canRecordEvidence || evidence.length) ? `<details class="incremental-secondary-evidence"><summary>发布后的外部证据（不属于 MVP 主流程）</summary>${canRecordEvidence ? `<form class="incremental-inline-form evidence" data-incremental-evidence-form data-task-id="${escapeHtml(idOf(task))}"><label>证据类型<select name="type"><option value="gitlab_mr">GitLab MR</option><option value="ci">CI</option><option value="manual">人工记录</option></select></label><label>外部引用<input name="reference" required placeholder="MR 编号或证据地址"></label><label>结果<select name="status"><option value="pending">待确认</option><option value="success">成功</option><option value="failed">失败</option></select></label><label class="wide">说明<input name="note" maxlength="240"></label><button class="button secondary" type="submit">登记外部证据</button><span class="incremental-form-status" role="status"></span></form>` : ''}${evidence.length ? `<ul class="incremental-evidence-list">${evidence.map(item => `<li><strong>${escapeHtml(item.status || '待确认')}</strong><span>${escapeHtml(item.note || item.reference || '')}</span></li>`).join('')}</ul>` : ''}</details>` : ''}<span class="incremental-form-status" role="status"></span></section>`;
}

function setupStage(task) {
  return `<section class="incremental-stage-panel" aria-labelledby="incremental-setup-title"><header><div><span class="incremental-stage-eyebrow">第 1 步</span><h3 id="incremental-setup-title">建立任务</h3><p>确认本次增量更新使用的手册、业务版本和正式发布基线。</p></div><span class="incremental-stage-state">已建立</span></header><dl class="incremental-setup-facts"><div><dt>任务名称</dt><dd>${escapeHtml(task.name || task.title || '增量修改任务')}</dd></div><div><dt>所属手册</dt><dd>${escapeHtml(task.handbookName || task.handbookId || '手册信息待返回')}</dd></div><div><dt>业务版本</dt><dd>${escapeHtml(task.businessVersion || '未返回')}</dd></div><div><dt>发布基线</dt><dd>${escapeHtml(task.baselineVersionName || task.baselineVersionId || '未返回')}</dd></div></dl><div class="incremental-stage-footer"><span>任务已经建立，可以继续确认来源和修改范围。</span><button class="button" type="button" data-incremental-stage="inputs">继续确认输入</button></div></section>`;
}

function inputStage(task) {
  return `<section class="incremental-stage-panel" aria-labelledby="incremental-input-title"><header><div><span class="incremental-stage-eyebrow">第 2 步</span><h3 id="incremental-input-title">确认输入</h3><p>来源、修改范围、大纲和模板共同决定 Agent 可以生成什么。</p></div><span class="incremental-stage-state">${array(task.sources || task.sourceSnapshots).length} 项来源</span></header><div class="incremental-source-entry-grid"><article><i data-lucide="file-up" aria-hidden="true"></i><div><strong>上传 Markdown</strong><p>选择文件并预览；后端接入后将在这里固化快照。</p></div><button class="button secondary compact" type="button" data-incremental-prototype-toggle="markdown">选择文件</button><div class="incremental-prototype-form" data-incremental-prototype-panel="markdown" hidden><label>Markdown 文件<input type="file" accept=".md,text/markdown" data-incremental-prototype-file></label><p role="status">尚未选择文件。</p></div></article><article><i data-lucide="link" aria-hidden="true"></i><div><strong>选择 PingCode 页面</strong><p>填写页面链接并检查输入；真实正文读取等待连接器接入。</p></div><button class="button secondary compact" type="button" data-incremental-prototype-toggle="pingcode">填写链接</button><form class="incremental-prototype-form" data-incremental-prototype-form="pingcode" hidden><label>PingCode 页面链接<input name="url" type="url" required placeholder="https://.../wiki/..."></label><button class="button secondary compact" type="submit">检查链接</button><p role="status"></p></form></article></div><details class="incremental-compatibility-entry" ${array(task.sources || task.sourceSnapshots).length ? 'open' : ''}><summary>现有人工来源兼容入口</summary>${sourceSection(task)}</details>${targetSection(task)}<section class="incremental-input-contract"><header><div><h4>大纲与模板</h4><p>先完成前端选择；正式版本引用等待接口返回后固化。</p></div><span>前端可配置</span></header><form class="incremental-contract-form" data-incremental-prototype-form="contract"><label>发布大纲<select name="outline" required><option value="">请选择发布大纲</option><option value="current">当前发布大纲</option></select></label><label>原模板<select name="sourceTemplate" required><option value="">请选择原模板</option><option value="baseline">沿用基线模板</option></select></label><label>目标模板<select name="targetTemplate" required><option value="">请选择目标模板</option><option value="incremental">增量内容模板</option></select></label><button class="button secondary" type="submit">确认生成输入</button><p role="status"></p></form></section><div class="incremental-stage-footer"><span>当前可先完成界面选择；真实快照和版本引用将在后端接入后固化。</span><button class="button" type="button" data-incremental-stage="generation">进入生成与修订</button></div></section>`;
}

function generationStage(task) {
  const hasGeneration = Boolean(task.generationRun || task.generationPlan);
  return `<section class="incremental-stage-panel" aria-labelledby="incremental-generation-title"><header><div><span class="incremental-stage-eyebrow">第 3 步</span><h3 id="incremental-generation-title">生成与修订</h3><p>Agent 只使用已确认输入生成草稿，结果不会直接覆盖正式版本。</p></div><span class="incremental-stage-state">${hasGeneration ? escapeHtml(task.generationRun?.statusDisplayName || task.generationRun?.status || '运行状态待返回') : '前端流程可操作'}</span></header>${hasGeneration ? `<div class="incremental-generation-run" role="status"><strong>${escapeHtml(task.generationRun?.statusDisplayName || '生成任务已建立')}</strong><p>${escapeHtml(task.generationRun?.progressMessage || '正在读取服务端运行状态。')}</p></div>` : '<div class="incremental-generation-console"><div><i data-lucide="bot" aria-hidden="true"></i><div><strong>生成方案</strong><p>先在前端检查输入摘要，再启动真实 Agent；当前启动动作只展示待接入反馈。</p></div></div><dl><div><dt>基线</dt><dd>已关联任务基线</dd></div><div><dt>来源</dt><dd>使用确认输入阶段的选择</dd></div><div><dt>范围</dt><dd>仅允许已确认文档与章节</dd></div><div><dt>输出</dt><dd>增量草稿，不覆盖正式版本</dd></div></dl><button class="button" type="button" data-incremental-prototype-generate>启动 Agent 生成</button><p class="incremental-prototype-status" role="status">尚未启动。</p></div>'}${draftSection(task)}${checksSection(task)}<div class="incremental-stage-footer"><span>可先体验完整前端路径；正式候选仍必须通过真实检查。</span><button class="button" type="button" data-incremental-stage="review">查看文档审核</button></div></section>`;
}

function taskContext(task, active) {
  const issues = array(task.checkReport?.issues || task.checks?.issues || task.checks?.items);
  const blockers = issues.filter(item => item.level === 'error' || item.blocking === true).length;
  const sources = array(task.sources || task.sourceSnapshots);
  const sourceEvidence = sources.length
    ? `<ul class="incremental-context-source-list">${sources.map(source => `<li><strong>${escapeHtml(source.label || source.title || source.name || '未命名来源')}</strong>${source.reference ? `<span>${escapeHtml(source.reference)}</span>` : ''}</li>`).join('')}</ul>`
    : '<p class="incremental-context-empty">尚未确认来源。</p>';
  return `<details class="incremental-context" aria-label="任务摘要与门禁" open><summary>任务摘要与门禁</summary><section><h3>任务摘要</h3><dl><div><dt>当前阶段</dt><dd>${escapeHtml(phases.find(([key]) => key === active)?.[1] || '')}</dd></div><div><dt>来源</dt><dd>${sources.length} 项</dd></div><div><dt>目标文档</dt><dd>${array(task.target?.documentIds).length} 个</dd></div><div><dt>目标章节</dt><dd>${array(task.target?.sectionIds || task.targetScope?.sectionIds).length} 个</dd></div></dl></section><section><h3>来源证据</h3>${sourceEvidence}</section><section><h3>文档状态</h3>${documentStatusList(task)}</section><section class="${blockers ? 'has-blockers' : ''}"><h3>当前门禁</h3>${blockers ? `<p><strong>${blockers} 个阻断项</strong><br>处理后才能继续提交。</p>` : task.checkReport || task.checks ? '<p><strong>检查结果可用</strong><br>请按当前阶段继续处理。</p>' : '<p><strong>尚未执行检查</strong><br>生成草稿后执行范围与完整性检查。</p>'}</section><section><h3>版本证据</h3><p>基线：${escapeHtml(task.baselineVersionName || task.baselineVersionId || '未返回')}</p><p>更新：${fmtTime(task.updatedAt)}</p></section></details>`;
}

function taskDetail(task, privileged) {
  if (!task) return `<section class="incremental-welcome">${emptyState('选择一个增量任务', '查看来源、修改范围、草稿、差异和发布进度。')}</section>`;
  const active = activePhase(task);
  const panels = { setup: setupStage(task), inputs: inputStage(task), generation: generationStage(task), review: reviewStage(task), publish: publishStage(task, privileged) };
  return `<article class="incremental-detail"><header class="incremental-detail-header"><div><span>${escapeHtml(task.handbookName || task.handbookId || '手册待返回')} · ${escapeHtml(task.businessVersion || '业务版本待返回')}</span><h2>${escapeHtml(task.name || task.title || '增量修改任务')}</h2><p>基线：${escapeHtml(task.baselineVersionName || task.baselineVersionId || '未返回')} · 更新于 ${fmtTime(task.updatedAt)}</p></div><strong class="status">${escapeHtml(taskStatus(task))}</strong></header>${progress(task, active)}<div class="incremental-stage-layout"><main class="incremental-stage-main" tabindex="-1" data-incremental-stage-main>${panels[active]}</main>${taskContext(task, active)}</div></article>`;
}

function createDialog(projection) {
  const handbooks = array(projection?.handbooks || projection?.availableHandbooks);
  const requestedHandbookId = projection?.requestedHandbookId || '';
  return `<dialog class="asset-dialog incremental-create-dialog" data-incremental-create-dialog data-scroll-region="dialog"><form data-incremental-create-form><header class="asset-dialog-heading"><div><span class="eyebrow asset-context-label">增量构建</span><h2>创建增量任务</h2><p>任务将锁定选定的已发布基线。</p></div><button class="icon-button asset-dialog-close" type="button" data-incremental-dialog-close aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header><label>手册<select name="handbookId" required ${handbooks.length ? '' : 'disabled'}><option value="">${handbooks.length ? '请选择' : '暂无可用手册'}</option>${handbooks.map(item => { const id = String(item.handbookId || item.id); return `<option value="${escapeHtml(id)}" ${id === requestedHandbookId ? 'selected' : ''}>${escapeHtml(item.name || item.handbookName)}</option>`; }).join('')}</select></label><label>任务名称<input name="name" required maxlength="120" placeholder="例如：更新安装前检查说明"></label><label>业务版本<input name="businessVersion" required placeholder="例如：23.4.5.100"></label><div class="incremental-baseline-picker"><label>已发布基线<select name="baselineVersionId" required disabled><option value="">请先读取基线</option></select></label><button class="button secondary" type="button" data-incremental-load-baselines ${handbooks.length ? '' : 'disabled'}>读取基线</button></div><p class="incremental-baseline-status" role="status">仅能选择服务端返回的当前已发布基线。</p><footer><span role="status" class="incremental-form-status"></span><button class="button secondary" type="button" data-incremental-dialog-close>取消</button><button class="button" type="submit" disabled>创建任务</button></footer></form></dialog>`;
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
    const id = String(item.handbookId || item.id || '');
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

function taskDocumentCount(task) {
  const documents = array(task?.handbookSource?.documents || task?.target?.documentIds);
  if (documents.length) return new Set(documents.map(item => String(item?.documentId || item?.id || item))).size;
  return new Set(array(task?.candidate?.operations).map(item => item?.documentId).filter(Boolean).map(String)).size;
}

function versionOverview(projection) {
  if (projection?.status === 'loading') return '<section class="production-overview-empty" role="status">正在读取数据库版本任务…</section>';
  if (projection?.status === 'unavailable') return '<section class="production-overview-empty" role="alert">数据库版本任务暂时无法读取，请稍后重试。</section>';
  const tasks = array(projection?.items || projection?.tasks);
  const groups = new Map();
  tasks.forEach(task => {
    const version = String(task?.businessVersion || '').trim() || '版本待核对';
    if (!groups.has(version)) groups.set(version, []);
    groups.get(version).push(task);
  });
  const rows = [...groups.entries()].map(([version, items]) => {
    const completed = items.filter(item => item?.completion?.status === 'completed').length;
    const documentCount = items.reduce((total, item) => total + taskDocumentCount(item), 0);
    const current = [...items].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0];
    const completion = current?.completion;
    const responsibility = current?.ownerName || current?.owner || current?.assigneeName || '责任人待确认';
    const nextAction = completion?.status === 'completed' ? '等待后续变更' : completion?.facts?.mergeState === 'opened' ? '等待合并并回读' : '处理当前交付阻断';
    return { version, taskCount: items.length, documentCount, completed, pending: items.length - completed, current, responsibility, nextAction };
  }).sort((a, b) => a.version.localeCompare(b.version, 'zh-CN', { numeric: true }));
  if (!rows.length) return `<section class="production-overview-empty">${emptyState('暂无数据库版本任务', '创建增量任务后会按业务版本汇总显示。')}</section>`;
  return `<section class="production-overview production-version-overview" aria-label="数据库版本任务汇总"><div class="production-overview-toolbar"><div><strong>数据库版本汇总</strong><p>按任务绑定的业务版本聚合，完成状态沿用公共交付投影。</p></div><span>${rows.length} 个版本</span></div><div class="production-handbook-table-wrap"><table class="production-handbook-table" data-table-view-id="production-versions" data-table-view-schema="1"><caption class="sr-only">数据库版本任务汇总</caption><thead><tr><th>数据库版本</th><th>任务数</th><th>目标文档数</th><th>已完成</th><th>待处理</th><th>最近进展</th></tr></thead><tbody>${rows.map(row => `<tr class="production-handbook-row" tabindex="0" role="link" data-production-handbook-row data-handbook-href="/knowledge-center/production?view=tasks&taskId=${encodeURIComponent(row.current?.id || '')}"><td><strong>${escapeHtml(row.version)}</strong><small>${escapeHtml(row.current?.handbookName || row.current?.handbookId || '手册待确认')}</small></td><td>${row.taskCount}</td><td>${row.documentCount}</td><td><strong>${row.completed}</strong></td><td>${row.pending}</td><td><strong>${escapeHtml(row.current?.completion?.label || row.current?.statusDisplayName || '处理中')}</strong><small>${escapeHtml(`责任：${row.responsibility} · 下一步：${row.nextAction}`)}</small><small>${fmtTime(row.current?.updatedAt)}</small></td></tr>`).join('')}</tbody></table></div></section>`;
}

function productionTabs(active) {
  return `<nav class="production-overview-tabs" role="tablist" aria-label="文档生产视图"><button type="button" role="tab" data-production-overview-tab="handbooks" aria-selected="${active === 'handbooks'}">手册视图</button><button type="button" role="tab" data-production-overview-tab="versions" aria-selected="${active === 'versions'}">数据库版本</button><button type="button" role="tab" data-production-overview-tab="tasks" aria-selected="${active === 'tasks'}">任务视图</button><button type="button" role="tab" data-production-overview-tab="generations" aria-selected="${active === 'generations'}">我的生成</button></nav>`;
}

export function renderProduction({ incrementalProjection, assetCatalog, platformAdmin, currentUser, handbookProductionUi, templateProjection }) {
  const projection = incrementalProjection || { status: 'loading' };
  if (projection.requestedHandbookId) return renderHandbookProduction({ projection, currentUser, ui: handbookProductionUi, templateProjection });
  const task = selectedTask(projection);
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get('view');
  const normalizedView = requestedView === 'todo' ? 'generations' : requestedView;
  const active = params.get('taskId') ? 'tasks' : (['handbooks', 'versions', 'tasks', 'generations'].includes(normalizedView) ? normalizedView : 'handbooks');
  const taskItems = array(projection.items || projection.tasks);
  const unavailable = projection.status === 'unavailable' ? `<section class="incremental-list-state error" role="alert"><strong>增量服务暂时不可用</strong><span>${escapeHtml(projection.error?.message || '请稍后重试')}</span><button class="button secondary compact" type="button" data-incremental-reload>重新读取</button></section>` : '';
  const body = unavailable || (active === 'handbooks'
    ? handbookOverview(projection, assetCatalog)
    : active === 'versions'
      ? versionOverview(projection)
    : active === 'generations'
      ? myGenerations(projection.generations || { status: 'loading', items: [] })
      : `<div class="incremental-workspace"><aside class="incremental-sidebar" aria-label="增量任务"><header><h2>增量任务</h2><span>${taskItems.length} 项</span></header>${taskList(projection)}</aside><div class="incremental-main">${taskDetail(task, platformAdmin)}</div></div>`);
  return `<div class="page-intro production-heading"><div><h2>文档生产</h2><p>统一查看手册进展，进入具体工作台继续编辑、审核和发布。</p></div><div class="production-heading-actions"><a class="button secondary" href="/document-generation-workbench.html" target="_blank" rel="noopener">文档生成工作台</a><button class="button" type="button" data-incremental-create-open>创建增量任务</button></div></div>${productionTabs(active)}${body}${createDialog(projection)}`;
}

export function renderStages({ incrementalProjection }) {
  const tasks = array(incrementalProjection?.items || incrementalProjection?.tasks);
  return `<div class="page-intro"><div><h2>生产进展</h2></div><button class="button secondary" data-action="production">返回文档生产</button></div>${tasks.length ? `<div class="incremental-task-list">${tasks.map(task => `<div class="incremental-task-item"><strong>${escapeHtml(task.name || '未命名任务')}</strong><span>${escapeHtml(taskStatus(task))}</span></div>`).join('')}</div>` : emptyState('暂无生产进展', '建立增量任务后将在这里展示真实进展。')}`;
}
