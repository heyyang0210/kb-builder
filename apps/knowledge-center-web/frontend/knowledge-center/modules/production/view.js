import { emptyState } from '../../common/components/ui.js';
import { escapeHtml } from '../../common/utils/dom.js';

const statusNames = {
  draft: '待选来源', editing: '编辑中', checked: '完整性已检查', candidate_ready: '待提交审核',
  under_review: '审核中', approved: '待发布', rejected: '已退回', published: '平台已发布',
};
const steps = [['source', '来源'], ['target', '范围'], ['draft', '草稿'], ['checks', '完整性检查'], ['review', '审核'], ['publish', '发布'], ['delivery', '外部证据']];

const array = value => Array.isArray(value) ? value : [];
const idOf = value => String(value?.taskId || value?.id || '');
const selectedTask = projection => projection?.detail?.task || projection?.detail || null;
const taskStatus = task => task?.statusDisplayName || statusNames[task?.state] || statusNames[task?.status] || task?.state || task?.status || '状态未返回';
function fmtTime(value) { if (!value) return '暂无'; const date = new Date(value); return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleString('zh-CN', { hour12: false }); }
function activeStep(task) {
  const status = task?.state || task?.status;
  if (['draft', 'pending_source', 'source_pending'].includes(status)) return 0;
  if (['pending_target', 'target_pending'].includes(status)) return 1;
  if (status === 'editing') return task?.target ? 2 : task?.sourceSnapshots?.length ? 1 : 0;
  if (['checked', 'pending_submission', 'checks_passed'].includes(status)) return 3;
  if (['candidate_ready', 'under_review', 'in_review', 'review_pending', 'rejected', 'changes_requested'].includes(status)) return 4;
  if (['pending_publish', 'approved'].includes(status)) return 5;
  return 6;
}

function taskList(projection) {
  const items = array(projection?.items || projection?.tasks);
  const selectedId = idOf(selectedTask(projection));
  if (projection?.status === 'loading') return '<div class="incremental-list-state" role="status">正在读取增量任务…</div>';
  if (projection?.status === 'unavailable') return `<div class="incremental-list-state error"><strong>任务暂时无法读取</strong><span>${escapeHtml(projection?.error?.message || '请稍后重试')}</span><button class="button secondary compact" type="button" data-incremental-reload>重新读取</button></div>`;
  if (!items.length) return emptyState('暂无增量任务', '选择有已发布基线的手册创建第一个任务。');
  return `<div class="incremental-task-list">${items.map(task => { const id = idOf(task); return `<button class="incremental-task-item${id === selectedId ? ' selected' : ''}" type="button" data-incremental-task="${escapeHtml(id)}" aria-pressed="${id === selectedId}"><strong>${escapeHtml(task.name || task.title || '未命名任务')}</strong><span>${escapeHtml(taskStatus(task))}</span><small>${escapeHtml(task.handbookName || task.handbookId || '')}${task.updatedAt ? ` · ${fmtTime(task.updatedAt)}` : ''}</small></button>`; }).join('')}</div>`;
}

function progress(task) {
  const current = activeStep(task);
  return `<ol class="incremental-steps" aria-label="增量构建进度">${steps.map(([, label], index) => `<li class="${index < current ? 'done' : index === current ? 'current' : ''}"><span aria-hidden="true">${index < current ? '✓' : index + 1}</span><b>${label}</b></li>`).join('')}</ol>`;
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
  const selector = available.length ? `<div class="incremental-target-list">${available.map(item => { const id = String(item.chapterId || item.nodeId || item.id); return `<label><input type="checkbox" name="sectionIds" value="${escapeHtml(id)}" ${selected.has(id) ? 'checked' : ''}><span><strong>${escapeHtml(item.title || item.name || '未命名章节')}</strong><small>${escapeHtml(item.path || item.documentName || '')}</small></span></label>`; }).join('')}</div>` : `<label class="incremental-draft-field">目标文档（每行一个）<textarea name="documentIds" rows="3" required>${escapeHtml(documentIds)}</textarea></label>`;
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
  return `<section class="incremental-section incremental-draft" id="incremental-draft"><header><div><h3>增量草稿</h3><p>草稿与已发布基线隔离，保存不会覆盖正式版本。</p></div><span>${draft.editVersion ? `草稿 ${escapeHtml(String(draft.editVersion))}` : '未保存'}</span></header><form data-incremental-draft-form data-task-id="${escapeHtml(idOf(task))}"><label class="incremental-draft-field">本次修改内容<textarea name="content" rows="14" ${editable ? '' : 'readonly'} placeholder="在此编辑增量内容…">${escapeHtml(draft.content || task.draftContent || '')}</textarea></label>${editable ? `<div class="incremental-operation-fields"><label>变更类型<select name="operationType" data-incremental-operation-type><option value="update">修改</option><option value="add">新增</option><option value="delete">删除</option><option value="move">移动</option></select></label><label>目标文档<select name="operationDocumentId" required><option value="">请选择</option>${documentOptions}</select></label><label>目标节点${nodeControl}</label><label data-operation-field="before">变更前指纹<input name="beforeDigest" required placeholder="当前节点内容指纹"></label><label data-operation-field="after">变更后内容<textarea name="afterContent" rows="3" required></textarea></label><label data-operation-field="move" hidden>新父节点<input name="targetParentId"></label><label data-operation-field="move" hidden>新顺序<input name="ordinal" type="number" min="0" value="0"></label></div><div class="incremental-form-actions"><button class="button secondary" type="submit">保存草稿</button><button class="button" type="button" data-incremental-checks="${escapeHtml(idOf(task))}">执行完整性检查</button><span class="incremental-form-status" role="status"></span></div>` : '<p class="incremental-lock-note">当前候选已冻结，如需修改必须退回后创建新草稿。</p>'}</form></section>`;
}

function checksSection(task) {
  const report = task.checkReport || task.checks || null;
  const issues = array(report?.issues || report?.items);
  const blockers = report?.passed === false ? issues : issues.filter(item => item.level === 'error' || item.blocking === true);
  return `<section class="incremental-section" id="incremental-checks"><header><div><h3>完整性检查</h3><p>核对来源、修改范围、草稿和变更集是否完整。</p></div><span>${report ? (report.passed ? '已通过' : `${blockers.length} 个阻断项`) : '待检查'}</span></header>${report ? `${issues.length ? `<ul class="incremental-issue-list">${issues.map(issue => `<li class="${report.passed === false || issue.level === 'error' || issue.blocking ? 'blocking' : ''}"><strong>${escapeHtml(issue.title || issue.code || '检查项')}</strong><span>${escapeHtml(issue.message || issue.description || '')}</span></li>`).join('')}</ul>` : '<p class="incremental-empty">来源、范围、草稿和变更集均已完整。</p>'}${task.state === 'checked' && report.passed ? `<button class="button" type="button" data-incremental-candidate="${escapeHtml(idOf(task))}">提交候选版本</button>` : ''}` : '<p class="incremental-empty">保存草稿后执行完整性检查。</p>'}<span class="incremental-form-status" role="status"></span></section>`;
}

function reviewAndPublish(task, privileged) {
  const reviews = array(task.reviews);
  const state = task.state || task.status;
  const canStartReview = state === 'candidate_ready' && !reviews.length;
  const canPublish = ['pending_publish', 'approved'].includes(state);
  const published = task.publication || task.publishedVersion;
  const evidence = array(task.externalEvidence || task.deliveryEvidence);
  const canReview = task.capabilities?.canReview ?? privileged;
  const canPublishTask = task.capabilities?.canPublish ?? privileged;
  const canRecordEvidence = task.capabilities?.canRecordEvidence ?? privileged;
  const canComment = task.capabilities?.canComment !== false;
  const canRevise = task.capabilities?.canRevise ?? (task.capabilities?.canEdit ?? true);
  const reviewList = reviews.length ? `<ul class="incremental-fact-list review-list">${reviews.map(review => `<li><div class="incremental-review-record"><div><strong>${escapeHtml(review.status === 'pending' ? '待审核' : review.decision?.decidedBy?.displayName || '审核记录')}</strong><small>${escapeHtml(review.statusDisplayName || review.decision?.value || review.status || '待审核')}</small></div>${array(review.comments).map(comment => `<p>${escapeHtml(comment.author?.displayName || '成员')}：${escapeHtml(comment.content || '')}</p>`).join('')}${canComment ? `<form class="incremental-comment-form" data-incremental-comment-form data-task-id="${escapeHtml(idOf(task))}" data-review-id="${escapeHtml(review.id)}"><label class="sr-only">审核评论</label><input name="comment" required placeholder="添加审核评论"><button class="button secondary compact" type="submit">发送评论</button><span class="incremental-form-status" role="status"></span></form>` : ''}</div>${canReview && review.status === 'pending' ? `<div class="incremental-review-actions"><button class="button secondary compact" type="button" data-incremental-review-decision="approve" data-task-id="${escapeHtml(idOf(task))}" data-review-id="${escapeHtml(review.id)}">通过</button><button class="button tertiary compact" type="button" data-incremental-review-decision="reject" data-task-id="${escapeHtml(idOf(task))}" data-review-id="${escapeHtml(review.id)}">退回</button></div>` : ''}</li>`).join('')}</ul>` : '<p class="incremental-empty">尚无审核记录。</p>';
  return `<section class="incremental-section" id="incremental-review"><header><div><h3>审核与发布</h3><p>候选版本审核通过后，才能形成新的平台版本。</p></div><span>${escapeHtml(taskStatus(task))}</span></header>${reviewList}<div class="incremental-form-actions">${canStartReview ? `<button class="button" type="button" data-incremental-review-create="${escapeHtml(idOf(task))}">提交审核</button>` : ''}${canPublishTask && canPublish ? `<button class="button" type="button" data-incremental-publish="${escapeHtml(idOf(task))}">发布平台版本</button>` : ''}${canRevise && state === 'rejected' ? `<button class="button" type="button" data-incremental-revision="${escapeHtml(idOf(task))}">创建修订任务</button>` : ''}</div>${published ? `<div class="incremental-published"><strong>平台版本已发布</strong><span>${escapeHtml(published.id || '')} · ${fmtTime(published.publishedAt)}</span></div>` : ''}${published && canRecordEvidence ? `<p class="incremental-evidence-note">以下信息由人工登记，不代表平台已验证 GitLab 或 CI 结果。</p><form class="incremental-inline-form evidence" data-incremental-evidence-form data-task-id="${escapeHtml(idOf(task))}"><label>证据类型<select name="type"><option value="gitlab_mr">GitLab MR</option><option value="ci">CI</option><option value="manual">人工记录</option></select></label><label>外部引用<input name="reference" required placeholder="MR 编号或证据地址"></label><label>结果<select name="status"><option value="pending">待确认</option><option value="success">成功</option><option value="failed">失败</option></select></label><label class="wide">说明<input name="note" maxlength="240"></label><button class="button secondary" type="submit">登记外部证据</button><span class="incremental-form-status" role="status"></span></form>` : ''}${evidence.length ? `<ul class="incremental-evidence-list">${evidence.map(item => `<li><strong>${escapeHtml(item.status || '待确认')}</strong><span>${escapeHtml(item.note || item.reference || '')}</span></li>`).join('')}</ul>` : ''}<span class="incremental-form-status" role="status"></span></section>`;
}

function taskDetail(task, privileged) {
  if (!task) return `<section class="incremental-welcome">${emptyState('选择一个增量任务', '查看来源、修改范围、草稿、差异和发布进度。')}</section>`;
  return `<article class="incremental-detail"><header class="incremental-detail-header"><div><span>手册 ${escapeHtml(task.handbookId || '')} · ${escapeHtml(task.businessVersion || '')}</span><h2>${escapeHtml(task.name || task.title || '增量修改任务')}</h2><p>基线：${escapeHtml(task.baselineVersionName || task.baselineVersionId || '未返回')} · 更新于 ${fmtTime(task.updatedAt)}</p></div><strong class="status">${escapeHtml(taskStatus(task))}</strong></header>${progress(task)}${sourceSection(task)}${targetSection(task)}${draftSection(task)}${checksSection(task)}${reviewAndPublish(task, privileged)}</article>`;
}

function createDialog(projection) {
  const handbooks = array(projection?.handbooks || projection?.availableHandbooks);
  const requestedHandbookId = projection?.requestedHandbookId || '';
  return `<dialog class="asset-dialog incremental-create-dialog" data-incremental-create-dialog><form data-incremental-create-form><header class="asset-dialog-heading"><div><span class="eyebrow asset-context-label">增量构建</span><h2>创建增量任务</h2><p>任务将锁定选定的已发布基线。</p></div><button class="icon-button asset-dialog-close" type="button" data-incremental-dialog-close aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header><label>手册<select name="handbookId" required ${handbooks.length ? '' : 'disabled'}><option value="">${handbooks.length ? '请选择' : '暂无可用手册'}</option>${handbooks.map(item => { const id = String(item.handbookId || item.id); return `<option value="${escapeHtml(id)}" ${id === requestedHandbookId ? 'selected' : ''}>${escapeHtml(item.name || item.handbookName)}</option>`; }).join('')}</select></label><label>任务名称<input name="name" required maxlength="120" placeholder="例如：更新安装前检查说明"></label><label>业务版本<input name="businessVersion" required placeholder="例如：23.4.5.100"></label><div class="incremental-baseline-picker"><label>已发布基线<select name="baselineVersionId" required disabled><option value="">请先读取基线</option></select></label><button class="button secondary" type="button" data-incremental-load-baselines ${handbooks.length ? '' : 'disabled'}>读取基线</button></div><p class="incremental-baseline-status" role="status">仅能选择服务端返回的当前已发布基线。</p><footer><span role="status" class="incremental-form-status"></span><button class="button secondary" type="button" data-incremental-dialog-close>取消</button><button class="button" type="submit" disabled>创建任务</button></footer></form></dialog>`;
}

export function renderProduction({ incrementalProjection, platformAdmin }) {
  const projection = incrementalProjection || { status: 'loading' };
  const task = selectedTask(projection);
  return `<div class="page-intro production-heading"><div><h2>文档生产</h2></div><button class="button" type="button" data-incremental-create-open>创建增量任务</button></div><div class="incremental-workspace"><aside class="incremental-sidebar" aria-label="增量任务"><header><h2>增量任务</h2><span>${array(projection.items || projection.tasks).length} 项</span></header>${taskList(projection)}</aside><div class="incremental-main">${taskDetail(task, platformAdmin)}</div></div>${createDialog(projection)}`;
}

export function renderStages({ incrementalProjection }) {
  const tasks = array(incrementalProjection?.items || incrementalProjection?.tasks);
  return `<div class="page-intro"><div><h2>生产进展</h2></div><button class="button secondary" data-action="production">返回文档生产</button></div>${tasks.length ? `<div class="incremental-task-list">${tasks.map(task => `<div class="incremental-task-item"><strong>${escapeHtml(task.name || '未命名任务')}</strong><span>${escapeHtml(taskStatus(task))}</span></div>`).join('')}</div>` : emptyState('暂无生产进展', '建立增量任务后将在这里展示真实进展。')}`;
}
