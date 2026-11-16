import { taskOperationId } from '../../common/api/document-tasks-api.js';
import { loadDocumentTasks, loadDocumentTask, taskRequest, taskWrite, importDocumentTasks, downloadDocumentTaskFile } from '../../common/api/document-tasks-api.js';
import { escapeHtml, icon } from '../../common/utils/dom.js';
import { planCell, openPlanCalendar } from './plan-calendar.js';
import { markDynamicSelects, cleanupSearchableSelects } from '../../common/searchable-combobox.js';
import { uiIcon } from '../../common/ui-system.js';
import { renderSourceRecord } from '../../common/safe-source-markdown.js';
const e = value => escapeHtml(String(value ?? ''));
const labels = { pending_scope: '待处理', in_progress: '处理中', completed: '已完成' };
const timestamp = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
function scopeImpactTable(items) {
  if (!items.length) return '<p>没有文档范围变化</p>';
  const operation = { add: '新增', update: '调整', withdraw: '撤出' };
  const draft = { saved: '已保存', draft: '草稿', none: '未保存' };
  const review = { pending: '待审核', approved: '已通过', rejected: '已退回' };
  const readback = { consistent: '一致', matched: '一致', success: '一致', mismatch: '不一致', failed: '失败', pending: '待回读' };
  return `<div class="task-scope-impact-table-wrap"><table class="task-scope-impact-table"><thead><tr><th>文档</th><th>操作</th><th>草稿</th><th>审核</th><th>MR</th><th>回读</th><th>时间</th><th>结果</th></tr></thead><tbody>${items.map(item => {
    const mr = item.mergeRequest;
    const mrUrl = typeof mr?.webUrl === 'string' && /^https:\/\//.test(mr.webUrl) ? mr.webUrl : null;
    const mrCell = mrUrl ? `<a href="${e(mrUrl)}" target="_blank" rel="noopener noreferrer">MR链接</a>` : e(item.mrState === 'unknown' ? '未读取' : item.mrState || '未创建');
    const result = item.canConfirm ? '可确认' : item.nextAction === 'close_mr_manually' ? '需关闭 MR' : '需刷新状态';
    const candidate = item.candidateDigest ? `<details class="task-scope-candidate"><summary>候选摘要</summary><code>${e(item.candidateDigest)}</code></details>` : '';
    return `<tr><td data-label="文档">${e(item.documentName || item.documentId)}${candidate}</td><td data-label="操作">${e(operation[item.operation] || item.operation)}</td><td data-label="草稿">${e(draft[item.draftStatus] || item.draftStatus || '—')}</td><td data-label="审核">${e(review[item.reviewStatus] || item.reviewStatus || '—')}</td><td data-label="MR">${mrCell}</td><td data-label="回读">${e(readback[item.readbackStatus] || item.readbackStatus || '—')}</td><td data-label="时间">${e(timestamp(item.observedAt))}</td><td data-label="结果">${e(result)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function outputCell(task) {
  const links = [], seen = new Set();
  const add = (type, name, url, external = false) => {
    if (!url || seen.has(`${type}:${url}`)) return;
    seen.add(`${type}:${url}`);
    links.push({ type, name, url, external });
  };
  for (const book of task.decomposition?.handbooks || []) {
    for (const doc of book.documents || []) {
      const name = doc.name || doc.id;
      if (typeof doc.writingUrl === 'string' && /^\/knowledge-center\/production\/handbook\/[^?#]+(?:\?|$)/.test(doc.writingUrl)) add('文档', name, doc.writingUrl);
      if (doc.reviewTaskId) add('审核', name, `/knowledge-center/review?taskId=${encodeURIComponent(doc.reviewTaskId)}&documentId=${encodeURIComponent(doc.createdDocumentId || doc.id)}`);
      const mr = doc.completion?.mergeRequest;
      if (typeof mr?.webUrl === 'string') {
        try {
          const url = new URL(mr.webUrl);
          if (url.protocol === 'https:' && !url.username && !url.password) add('MR', mr.iid ? `!${mr.iid}` : name, url.href, true);
        } catch (_) { /* An unavailable delivery URL is not a usable output. */ }
      }
    }
  }
  const linkHtml = link => `<a class="task-output-link${link.type === '文档' ? ' task-output-document' : ''}" href="${e(link.url)}" ${link.external ? 'target="_blank" rel="noopener noreferrer"' : ''} title="${e(`${link.type}：${link.name}`)}" aria-label="${e(`查看${link.type}：${link.name}`)}">${e(link.type === '文档' ? link.name.replace(/\.md$/i, '') : link.type)}</a>`;
  const references = links.slice(0, 3).map(linkHtml).join('') + (links.length > 3 ? `<details class="task-output-more"><summary title="展开另外 ${links.length - 3} 个输出件" aria-label="展开另外 ${links.length - 3} 个输出件">+${links.length - 3}</summary><div>${links.slice(3).map(linkHtml).join('')}</div></details>` : '');
  return references ? `<div class="task-output-list">${references}</div>` : '—';
}
export async function loadDocumentTaskWorkspace() {
  try {
    const number = new URLSearchParams(window.location.search).get('task');
    const [list, context, selected] = await Promise.all([loadDocumentTasks(number ? { q: number } : {}), taskRequest('/context'), number ? loadDocumentTask(number) : null]);
    return { status: 'ok', ...list, context, selected };
  }
  catch (error) { return { status: 'unavailable', items: [], error: { message: error.message } }; }
}
export function renderDocumentTasks({ documentTaskProjection }) {
  const root = document.querySelector('#view-root');
  const activeTab = root.querySelector('.document-task-page [data-task-tab].active')?.dataset.taskTab || (new URLSearchParams(window.location.search).get('tab') === 'config' ? 'config' : 'list');
  const state = { ...documentTaskProjection, tab: activeTab, selected: documentTaskProjection.selected || null, activeBookId: new URLSearchParams(window.location.search).get('handbookId'), filters: { page: 1, pageSize: 20, q: new URLSearchParams(window.location.search).get('task') || '', attention: 'normal' }, preview: null, file: null, feedbackMessage: documentTaskProjection.error?.message || '', feedbackIsError: Boolean(documentTaskProjection.error) };
  const name = id => state.context?.people.find(p => p.id === id)?.displayName || id || '待指派';
  const options = (items, selected, blank = '请选择') => `<option value="">${blank}</option>${items.map(p => `<option value="${e(p.id)}" ${p.id === selected ? 'selected' : ''}>${e(p.displayName || p.name)}</option>`).join('')}`;
  const person = (field, selected) => `<select name="${e(field)}" data-searchable-select aria-label="责任人">${options(state.context?.people || [], selected)}</select>`;
  const button = (action, text, extra = '') => `<button type="button" class="button secondary" data-task-action="${action}" ${extra}>${text}</button>`;
  const status = (message, isError = false) => {
    state.feedbackMessage = String(message || '');
    state.feedbackIsError = Boolean(isError);
    const node = root.querySelector('[data-task-message]');
    if (!node) return;
    node.textContent = message;
    node.hidden = !message;
    node.setAttribute('role', isError ? 'alert' : 'status');
    let dismiss = root.querySelector('[data-task-dismiss-message]');
    if (!dismiss && message) {
      node.insertAdjacentHTML('afterend', `<button type="button" class="icon-button" data-task-dismiss-message aria-label="关闭提示" title="关闭提示">${uiIcon('action.close')}</button>`);
      dismiss = root.querySelector('[data-task-dismiss-message]');
      window.lucide?.createIcons({ nodes: [dismiss] });
    }
    if (dismiss) dismiss.hidden = !message;
  };
  function bookState(book, scope) {
    return !scope.confirmed ? '草稿未转交' : !book.confirmed ? '待手册负责人确认' : book.impact === 'not_involved' ? `不涉及 · ${reasonText(book.reason)}` : `${book.targetVersion || '未指定版本'} · ${book.completed ? '已完成' : '处理中'}`;
  }
  function flow(task) {
    if (!task) return '<p class="task-empty">请选择一项任务查看真实进度。</p>';
    const s = task.decomposition;
    return `<div class="task-role-flow"><section><h3>${icon('user')}工单责任人</h3><article><strong>${e(task.number)}</strong><p>${e(name(task.ownerId))}</p><p>${!s.confirmed ? '待处理 · 尚未转交' : s.ticketImpact === 'not_involved' ? `不涉及 · ${e(reasonText(s.ticketReason))}` : `已转交 ${s.handbooks.length} 本手册`}</p></article></section><section><h3>${icon('book-open')}手册负责人</h3>${(s.handbooks || []).map(b => `<article><strong>${e(b.name)}</strong><p>${e(name(b.ownerId))}</p><p>${e(bookState(b, s))}</p></article>`).join('') || '<p>尚无手册任务</p>'}</section><section><h3>${icon('file-text')}文档负责人</h3>${(s.handbooks || []).flatMap(b => (b.documents || []).map(d => `<article><small>${e(b.name)}</small><p><strong>${e(d.name)}</strong></p><p>${e(name(d.ownerId))}</p><p>${!s.confirmed || !b.confirmed ? '草稿未分派' : e(d.completion?.label || '待处理')}</p></article>`)).join('') || '<p>尚无文档任务</p>'}</section></div><p class="task-flow-result">${e(labels[task.status])} · ${e(task.pending.join('；') || '必要处理已完成')}</p>`;
  }
  function render() {
    const ctx = state.context || {};
    root.innerHTML = `<section class="document-task-page"><header class="document-task-page-header"><h1>任务管理</h1><div class="document-task-actions">${button('refresh', icon('refresh-cw') + '刷新')}${button('export', icon('download') + '导出 CSV')}${ctx.canAdmin ? button('import', icon('upload') + '导入工单') : ''}<input type="file" accept=".json,.xlsx" hidden data-task-file></div></header><p role="alert" data-task-message ${state.error ? '' : 'hidden'}>${e(state.error?.message)}</p><nav class="document-task-tabs" aria-label="任务管理视图">${[['list', '任务列表'], ['secondary', '次要事项'], ['flow', '流程流转'], ...(ctx.canAdmin ? [['config', '任务配置']] : [])].map(([id, label]) => `<button data-task-tab="${id}" class="${state.tab === id ? 'active' : ''}" aria-selected="${state.tab === id}">${label}</button>`).join('')}</nav><div data-task-list ${!['list', 'secondary'].includes(state.tab) ? 'hidden' : ''}><form class="document-task-toolbar" data-task-filters><label class="task-search">${icon('search')}<input name="q" aria-label="搜索编号或描述" placeholder="搜索编号或描述" value="${e(state.filters.q)}"></label><input name="ir" aria-label="IR 编号" placeholder="IR 编号" value="${e(state.filters.ir || '')}"><select name="type" aria-label="任务类型"><option value="">全部类型</option><option value="REQUIREMENT" ${state.filters.type === 'REQUIREMENT' ? 'selected' : ''}>需求</option><option value="TICKET" ${state.filters.type === 'TICKET' ? 'selected' : ''}>工单</option></select><select name="ownerId" aria-label="责任人筛选">${options(ctx.people || [], state.filters.ownerId, '全部责任人')}</select><select name="product" aria-label="产品筛选">${options((state.filterOptions?.product || []).map(v => ({ id: v, name: v })), state.filters.product, "全部产品")}</select><select name="version" aria-label="版本筛选">${options((state.filterOptions?.version || []).map(v => ({ id: v, name: v })), state.filters.version, "全部版本")}</select><select name="status" aria-label="状态筛选"><option value="">全部状态</option>${Object.entries(labels).map(([id, label]) => `<option value="${id}" ${state.filters.status === id ? 'selected' : ''}>${label}</option>`).join('')}</select><button class="button secondary">筛选</button></form><div class="document-task-table-wrap"><table class="document-task-table"><thead><tr>${['编号', 'IR', '描述', '责任人', '产品', '版本', '状态', '开始时间', '结束时间', '输出件', '类型', '来源'].map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${(state.items || []).map(t => `<tr class="task-data-row"><td><button class="task-number" data-task-open="${e(t.number)}">${e(t.number)}</button></td><td>${e(t.ir?.[0] || '—')}${t.ir?.length > 1 ? ` +${t.ir.length - 1}` : ''}</td><td>${e(t.description)}</td><td>${e(t.ownerName)}</td><td>${e(t.product || '未指定')}</td><td>${e(t.version || '未指定')}</td><td><span class="document-task-status ${t.status}">${e(labels[t.status])}</span></td><td>${planCell(t, "plannedStartTime")}</td><td>${planCell(t, "plannedEndTime")}</td><td class="task-output-cell">${outputCell(t)}</td><td>${e(t.sourceType === 'REQUIREMENT' ? '需求' : t.sourceType === 'TICKET' ? '工单' : '—')}</td><td>${t.sourceUrl ? `<a href="${e(t.sourceUrl)}" target="_blank" rel="noopener noreferrer">PingCode ${icon('external-link')}</a>` : '—'}</td></tr>`).join('') || `<tr><td colspan="12">${state.status === 'loading' ? '正在读取任务…' : state.error ? '任务读取失败，请点击刷新重试' : state.tab === 'secondary' ? '暂无次要事项' : '暂无任务，请导入工单清单'}</td></tr>`}</tbody></table></div><footer class="task-pagination"><span>共 ${state.total || 0} 条 · 第 ${state.filters.page} 页</span>${button('previous', '上一页', state.filters.page <= 1 ? 'disabled' : '')}${button('next', '下一页', state.filters.page * state.filters.pageSize >= (state.total || 0) ? 'disabled' : '')}</footer></div><section ${state.tab !== 'flow' ? 'hidden' : ''}><h2>${e(state.selected?.number || '流程流转')}</h2>${flow(state.selected)}</section>${ctx.canAdmin ? `<section ${state.tab !== 'config' ? 'hidden' : ''} class="document-task-config"><h2>任务配置</h2><form data-task-config><fieldset><legend>不涉及理由选项</legend>${(ctx.config?.reasonOptions || []).map(r => `<label>${e(r.id === "other" ? "其他" : r.label)}<input name="reasonLabel:${e(r.id)}" value="${e(r.label)}" required aria-label="${e(r.id)}理由名称"></label>`).join('')}</fieldset><button class="button">保存</button><span role="status"></span></form></section>` : ''}<div data-task-drawer-host></div><div data-task-modal-host></div></section>`;
    if (state.selected && ['list', 'secondary'].includes(state.tab)) renderDrawer();
    cleanupSearchableSelects();
    markDynamicSelects(root);
    window.lucide?.createIcons({ nodes: [root] });
    status(state.feedbackMessage, state.feedbackIsError);
  }
  function reasonText(value) { if (!value) return '待确认'; return `${state.context.config.reasonOptions.find(r => r.id === value.id)?.label || value.id}${value.detail ? `：${value.detail}` : ''}`; }
  function renderHistory(events) {
    const titles = { import: '导入任务', source_update: '同步来源信息', owner: '改派工单负责人', handbook_owner: '调整手册负责人', document_owner: '调整文档负责人', plan: '调整计划时间', ticket_scope: '确认手册分派', handbook_scope: '确认文档范围', review_link: '关联审核与交付', new_document_prepare: '创建大纲候选', new_document_link: '关联新增文档', migration: '迁移历史任务', no_change_complete: '确认不涉及并完成', scope_correction_reported: '发起范围调整', scope_correction_cancelled: '取消范围调整', scope_correction_confirmed: '确认范围调整', publication_check: '核对已发布内容' };
    const bookName = id => state.context.handbooks.find(book => book.id === id)?.name || '相关手册';
    return events.slice().reverse().map(event => {
      const next = event.next || {}, previous = event.previous || {};
      let detail = '';
      if (event.type === 'owner') detail = `工单负责人由${name(typeof previous === 'string' ? previous : previous.ownerId)}调整为${name(typeof next === 'string' ? next : next.ownerId)}`;
      else if (['handbook_owner', 'document_owner'].includes(event.type)) detail = `${bookName(next.handbookId)}${event.type === 'document_owner' ? '的文档' : ''}负责人调整为${name(next.ownerId)}`;
      else if (['ticket_scope', 'scope_correction_confirmed'].includes(event.type)) {
        const books = next.handbooks || [];
        const added = books.filter(book => !(previous.handbooks || []).some(old => old.id === book.id));
        const removed = (previous.handbooks || []).filter(book => !books.some(current => current.id === book.id));
        detail = next.ticketImpact === 'not_involved' ? '确认本任务不涉及文档变更' : `手册范围：${books.map(book => book.name || bookName(book.id)).join('、') || '暂无手册'}`;
        if (added.length) detail += `；新增：${added.map(book => book.name || bookName(book.id)).join('、')}`;
        if (removed.length) detail += `；移除：${removed.map(book => book.name || bookName(book.id)).join('、')}`;
      } else if (event.type === 'handbook_scope') detail = `${next.name || bookName(next.id)}：${next.impact === 'not_involved' ? '不涉及文档变更' : `确认${(next.documents || []).length}篇文档${next.targetVersion ? '，目标版本 ' + next.targetVersion : ''}`}`;
      else if (event.type === 'plan') detail = `计划开始：${timestamp(next.plannedStartTime)}；计划结束：${timestamp(next.plannedEndTime)}`;
      else if (event.type === 'review_link') detail = '已关联文档审核与交付记录';
      return `<article class="task-audit"><strong>${e(titles[event.type] || '更新任务记录')}</strong><p>${e(name(event.operatorId))} · ${e(timestamp(event.at))}</p>${detail ? `<p>${e(detail)}</p>` : ''}${event.reason ? `<p>原因：${e(event.reason)}</p>` : ''}</article>`;
    }).join('') || '<p>暂无操作记录</p>';
  }
  function renderDrawer() {
    const t = state.selected, s = t.decomposition;
    const returnFocus = document.activeElement;
    // Relational task projections do not include the legacy aggregate audit array.
    if (!Array.isArray(t.assignmentHistory)) t.assignmentHistory = [];
    root.querySelector('[data-task-drawer-host]').innerHTML = `<aside class="task-drawer" aria-label="任务详情"><header><div><h2>${e(t.number)}</h2><p>${e(t.description)}</p></div>${button('close', icon('x'), 'aria-label="关闭详情"')}</header><div class="task-drawer-body"><dl class="task-facts"><dt>责任人</dt><dd>${e(name(t.ownerId))} ${t.canAdmin ? button('owner', '改派') : ''}</dd><dt>状态</dt><dd>${e(labels[t.status])}</dd><dt>PingCode 状态</dt><dd>${e(t.sourceStatus || '未指定')}</dd><dt>来源责任人</dt><dd>${e(t.source?.sourceOwner || '未指定')}</dd><dt>来源创建时间</dt><dd>${e(t.sourceCreatedAt || '未指定')}</dd><dt>开始时间</dt><dd>${planCell(t, "plannedStartTime")}</dd><dt>结束时间</dt><dd>${planCell(t, "plannedEndTime")}</dd><dt>实际开始 / 完成</dt><dd>${timestamp(t.startTime)} / ${timestamp(t.endTime)}</dd></dl><section class="task-next-action"><h3>${icon('arrow-right')}下一步</h3>${t.nextAction ? `<a class="button primary" href="${e(t.nextAction.url)}">${e(t.nextAction.label)}</a>` : `<p>${e(t.pending[0] || '必要处理已完成')}</p>`}</section><section><div class="task-section-heading"><h3>处理范围</h3><span>${s.handbooks.filter(b => b.completed).length} / ${s.handbooks.length} 本手册完成</span></div><h3>工单范围</h3><p>${!s.confirmed ? '草稿 · 待责任人确认，尚未转交' : s.ticketImpact === 'not_involved' ? `不涉及 · ${e(reasonText(s.ticketReason))}` : `涉及 ${s.handbooks.length} 本手册`}</p>${t.canConfirm ? button('ticket-scope', '确认 / 调整手册范围') : ''}</section>${s.handbooks.map(b => `<section class="task-book"><div class="task-section-heading"><h3>${icon('book-open')}${e(b.name)}</h3></div><p>${e(name(b.ownerId))} · ${e(bookState(b, s))}</p>${b.documents.map(d => `<div class="task-document"><div class="task-section-heading"><strong>${icon('file-text')}${e(d.name)}${d.kind === 'new' ? '<span class="task-kind">新增</span>' : ''}</strong>${d.canAssign ? button('document-owner', '改派文档责任人', `data-book="${e(b.id)}" data-doc="${e(d.id)}"`) : ''}</div><p>${e(name(d.ownerId))} · ${!s.confirmed || !b.confirmed ? '草稿未分派' : e(d.completion?.label || '待处理')}</p>${d.canEdit && b.confirmed ? `${d.writingUrl ? `<a class="button secondary" href="${e(d.writingUrl)}">进入编写</a>` : d.kind === 'new' ? button('new-document', '创建 / 关联新增文档', `data-book="${e(b.id)}" data-doc="${e(d.id)}"`) : ''}${button('link', '关联审核与交付', `data-book="${e(b.id)}" data-doc="${e(d.id)}"`)}` : ''}${d.reviewTaskId ? `<a href="/knowledge-center/review?taskId=${encodeURIComponent(d.reviewTaskId)}">查看审核</a>` : ''}${d.completion?.mergeRequest?.webUrl ? `<a href="${e(d.completion.mergeRequest.webUrl)}" target="_blank" rel="noopener noreferrer">MR链接</a>` : ''}</div>`).join('')}</section>`).join('')}<section><h3>待办</h3><ul>${t.pending.map(p => `<li>${e(p)}</li>`).join('') || '<li>必要处理已完成</li>'}</ul>${t.canConfirm && t.pending.some(p => p.includes('确认') && p.includes('完成')) ? button('complete', '确认不涉及并完成') : ''}</section><details><summary>操作历史（${t.assignmentHistory.length}）</summary>${renderHistory(t.assignmentHistory)}</details></div></aside>`;
    if (t.sourceType) {
      const section = document.createElement('section');
      section.className = 'task-source-actions';
      section.innerHTML = `<h3>Pingcode 来源</h3><p>${e(t.sourceType === 'REQUIREMENT' ? '需求' : '工单')}${t.ir?.length ? ` · 关联 IR ${e(t.ir.join('、'))}` : ''}</p><div>${button('source-view', '查看来源详情')}${button('changes', icon('history') + '同步变化')}${button('source-export', icon('download') + '导出来源资料')}</div>`;
      root.querySelector('.task-drawer-body').append(section);
    }
    if (t.scopeChecks?.length) {
      const section = document.createElement('section');
      section.className = 'task-scope-checks';
      section.innerHTML = `<h3>已发布内容核对</h3>${t.scopeChecks.map(check => `<article><strong>${e(check.documentName)}</strong><p>${e(check.status === 'completed' ? '已核对' : check.status === 'needs_fix' ? '需要修复，待重新交付' : '待核对')} · 原 MR !${e(check.mergeRequestIid || '—')} · 提交 ${e(check.targetCommit || '未知')}</p>${check.status !== 'completed' && t.canPublish ? button('publication-check', check.status === 'needs_fix' ? '提交修复交付' : '核对内容', `data-check="${e(check.id)}"`) : ''}</article>`).join('')}`;
      root.querySelector('.task-drawer-body').append(section);
    }
    const documentRows = root.querySelectorAll('.task-drawer .task-document');
    s.handbooks.flatMap(book => book.documents || []).forEach((doc, index) => {
      if (!doc.completion?.recovery || !documentRows[index]) return;
      const detail = document.createElement('p');
      detail.className = 'task-recovery-detail';
      const action = doc.completion.recovery === 'revise_after_mr_closed' ? '重新编写并提交审核'
        : doc.completion.recovery === 'retry_delivery_readback' ? '核对正文与图片后重新回读'
          : doc.completion.recovery === 'scope_changed' ? '按当前范围提交审核' : '重新编写并提交审核';
      detail.textContent = `下一步：${action} · 处理人：${name(doc.ownerId)}${doc.completion.deliveryFailure ? ` · 最近失败：${doc.completion.deliveryFailure.code}（${timestamp(doc.completion.deliveryFailure.at)}）` : ''}`;
      documentRows[index].append(detail);
    });
    if (t.nextAction?.action) {
      const next = root.querySelector('.task-next-action a');
      if (next) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'button primary';
        button.dataset.taskAction = t.nextAction.action;
        if (t.nextAction.handbookId) button.dataset.book = t.nextAction.handbookId;
        if (t.nextAction.documentId) button.dataset.doc = t.nextAction.documentId;
        if (t.nextAction.checkId) button.dataset.check = t.nextAction.checkId;
        button.textContent = t.nextAction.label;
        next.replaceWith(button);
      }
    }
    focusTaskWorkspace();
    const host = root.querySelector('[data-task-drawer-host]');
    const dialog = document.createElement('dialog');
    dialog.className = 'task-detail-dialog';
    dialog.setAttribute('aria-label', '工单窗口');
    dialog.append(host.querySelector('.task-drawer'));
    host.append(dialog);
    dialog.showModal();
    dialog.addEventListener('close', () => {
      if (dialog.dataset.suspended === 'true') return;
      state.selected = null;
      dialog.remove();
      root.querySelector('.document-task-page')?.classList.remove('task-focus-mode');
      returnFocus?.isConnected && returnFocus.focus();
    });
    dialog.querySelectorAll('[data-assignment-version]').forEach(async cell => {
      if (cell.textContent !== '待匹配') return;
      try {
        const catalog = await taskRequest(`/catalog?handbookId=${encodeURIComponent(cell.dataset.assignmentVersion)}&ticketNumber=${encodeURIComponent(t.number)}`);
        if (cell.isConnected) cell.textContent = catalog.versionMapping?.branch || '映射不可用';
      } catch (_) { if (cell.isConnected) cell.textContent = '映射不可用'; }
    });
    window.lucide?.createIcons({ nodes: [root.querySelector('.task-drawer')] });
  }
  function focusTaskWorkspace() {
    const t = state.selected, s = t.decomposition, books = s.handbooks || [];
    const page = root.querySelector('.document-task-page');
    const workspace = root.querySelector('.task-drawer');
    const body = workspace.querySelector('.task-drawer-body');
    page.classList.add('task-focus-mode');
    workspace.classList.add('task-workspace');
    const preferred = books.find(book => book.id === t.nextAction?.handbookId)
      || books.find(book => book.canEdit && !book.confirmed)
      || books.find(book => book.canEdit)
      || books[0];
    if (!books.some(book => book.id === state.activeBookId)) state.activeBookId = preferred?.id || null;
    const active = books.find(book => book.id === state.activeBookId);
    page.dataset.taskRole = active?.ownerId === state.context.actorId ? 'book'
      : t.ownerId === state.context.actorId ? 'ticket' : 'observer';
    const title = !t.decomposition.confirmed && t.canConfirm ? '确认涉及的手册，并交给负责人'
      : active?.canEdit && !active.confirmed ? '确定文档范围'
        : t.nextAction?.label || '查看任务进度';
    const heading = workspace.querySelector('header > div');
    heading.insertAdjacentHTML('afterbegin', `<span class="task-workspace-eyebrow">${e(t.number)} / ${active?.canEdit ? '手册任务' : t.canConfirm ? '工单任务' : '任务进度'}</span>`);
    heading.querySelector('h2').textContent = title;
    heading.querySelector('p').classList.add('task-workspace-description');
    heading.insertAdjacentHTML('beforeend', `<span class="task-workspace-owner">责任人：${e(name(t.ownerId))} · ${e(labels[t.status])}</span>`);
    const back = workspace.querySelector('header [data-task-action=close]');
    back.innerHTML = `${icon('arrow-left')}<span>返回任务列表</span>`;
    back.setAttribute('aria-label', '返回任务列表');
    const facts = body.querySelector('.task-facts');
    const ownerAction = facts.querySelector('[data-task-action=owner]');
    if (ownerAction) { ownerAction.classList.add('task-workspace-owner-action'); workspace.querySelector('header').append(ownerAction); }
    const more = document.createElement('details');
    more.className = 'task-workspace-more';
    more.innerHTML = '<summary>来源、时间与任务信息</summary>';
    more.append(facts);
    const history = body.querySelector(':scope > details');
    body.append(more);
    if (history) history.classList.add('task-workspace-history');
    const action = body.querySelector('.task-next-action');
    action.querySelector('h3').textContent = '当前操作';
    action.hidden = !t.nextAction;
    const scope = body.querySelector(':scope > section:not(.task-next-action):not(.task-book)');
    scope?.classList.add('task-ticket-scope');
    if (scope) {
      scope.querySelector('.task-section-heading h3').textContent = '工单分派';
      scope.querySelector('[data-task-action=ticket-scope]')?.remove();
      scope.querySelector(':scope > h3')?.remove();
      if (t.decomposition.confirmed && t.canConfirm && active?.canEdit && !active.confirmed) {
        const secondary = document.createElement('details');
        secondary.className = 'task-secondary-scope';
        secondary.innerHTML = '<summary>工单范围与分派</summary>';
        scope.before(secondary);
        secondary.append(scope);
      }
    }
    const bookNodes = [...body.querySelectorAll(':scope > .task-book')];
    bookNodes.forEach((node, index) => {
      node.hidden = books[index].id !== state.activeBookId;
      node.querySelector(':scope > p')?.remove();
    });
    const scopeState = book => !s.confirmed ? '待工单分派确认' : !book.confirmed
      ? '负责人已分配 · 文档范围待确认' : book.impact === 'not_involved'
        ? '文档范围已确认 · 不涉及' : book.completed ? '文档处理已完成' : '文档范围已确认 · 处理中';
    action.hidden = false;
    action.innerHTML = `<div class="task-section-heading"><h3>当前操作</h3><span class="task-scope-status">${e(!s.confirmed ? '工单分派待确认' : books.some(book => !book.confirmed) ? '负责人已分配 · 文档范围待确认' : '文档范围已确认')}</span></div><table class="task-handbook-table"><thead><tr><th>手册名称</th><th>产品类型</th><th>操作</th></tr></thead><tbody>${books.map(book => `<tr><td data-label="手册名称"><button type="button" class="task-handbook-name" data-task-book-select="${e(book.id)}" aria-pressed="${book.id === state.activeBookId}">${e(book.name)}</button><small>${e(scopeState(book))}</small></td><td data-label="产品类型">${e(state.context.handbooks.find(item => item.id === book.id)?.productType || '未配置')}</td><td data-label="操作"><div class="task-handbook-actions">${book.canEdit ? button('book-scope', book.confirmed ? '调整文档范围' : '确认文档范围', `data-book="${e(book.id)}"`) : '<span>等待手册负责人处理</span>'}${t.canConfirm ? button('remove-book', '移除', `data-book="${e(book.id)}"`) : ''}</div></td></tr>`).join('') || '<tr><td colspan="3">尚未添加手册</td></tr>'}</tbody></table>${t.canConfirm ? button('add-book', '新增手册') + button('ticket-scope', s.confirmed ? '调整工单范围' : '确认手册分派') : ''}`;
    const documents = books.flatMap(book => book.impact === 'involved' ? book.documents || [] : []);
    const completedDocuments = documents.filter(document => document.completion?.status === 'completed').length;
    const progress = document.createElement('div');
    progress.className = 'task-workspace-progress';
    progress.setAttribute('aria-label', '任务流转进度');
    progress.innerHTML = `<span>${icon('list-checks')} 工单分派 <strong>${t.decomposition.confirmed ? '已确认' : '待确认'}</strong></span><span>${icon('book-open')} 手册范围 <strong>${books.filter(book => book.confirmed).length}/${books.length} 本已确认</strong></span><span>${icon('file-text')} 文档处理 <strong>${documents.length ? `${completedDocuments}/${documents.length} 篇完成` : '暂无文档任务'}</strong></span>`;
    action.after(progress);
    if (t.decomposition.confirmed && books.length) {
      const summary = document.createElement('section');
      summary.className = 'task-assignment-result';
      summary.innerHTML = `<h3>分派结果</h3><div class="task-assignment-result-table"><table><thead><tr><th>手册名称</th><th>产品类型</th><th>目标分支</th><th>文档名称</th></tr></thead><tbody>${books.map(book => {
        const product = state.context.handbooks.find(item => item.id === book.id)?.productType || '未配置';
        const docs = book.confirmed ? (book.documents || []).map(doc => doc.name).join('、') : '待手册负责人确认';
        return `<tr><td>${e(book.name)}</td><td>${e(product)}</td><td data-assignment-version="${e(book.id)}">${e(book.versionMapping?.targetBranch || book.targetVersion || '待匹配')}</td><td>${e(docs || '无文档变更')}</td></tr>`;
      }).join('')}</tbody></table></div>`;
      progress.after(summary);
    }
    const pending = [...body.querySelectorAll(':scope > section')].find(section => section.querySelector(':scope > h3')?.textContent === '待办');
    if (pending) {
      const complete = pending.querySelector('[data-task-action=complete]');
      if (complete) { pending.replaceChildren(complete); }
      else pending.remove();
    }

  }
  async function refresh({ context = false, detail = true } = {}) {
    status('正在读取任务…');
    root.setAttribute('aria-busy', 'true');
    try {
      const [list, nextContext, selected] = await Promise.all([
        loadDocumentTasks(state.filters),
        context || !state.context ? taskRequest('/context') : state.context,
        detail && state.selected ? loadDocumentTask(state.selected.number) : state.selected,
      ]);
      Object.assign(state, list, { context: nextContext, selected, status: 'ok', error: null });
      render();
    } finally { root.removeAttribute('aria-busy'); }
  }
  async function showSyncChanges(taskNumber, page = 1) {
    const result = await taskRequest(`/${encodeURIComponent(taskNumber)}/sync-changes?page=${page}&pageSize=20`);
    const fieldLabels = { title: '标题', description: '描述', source_status: '来源状态', ir: '关联 IR', type: '类型', source_removed: '来源移除', source_restored: '来源恢复' };
    const value = input => {
      if (input == null || input === '') return '—';
      try { const parsed = JSON.parse(input); return e(typeof parsed === 'string' ? parsed : JSON.stringify(parsed)); }
      catch { return e(input); }
    };
    const rows = result.items.map(item => `<tr><td>${e(timestamp(item.confirmedAt))}</td><td>${e(item.sourceName || '—')}</td><td>${e(fieldLabels[item.field] || item.field)}</td><td>${value(item.before)}</td><td>${value(item.after)}</td></tr>`).join('');
    const content = `<div class="task-change-table-wrap"><table class="task-change-table"><thead><tr><th>同步时间</th><th>来源</th><th>字段</th><th>上次</th><th>本次</th></tr></thead><tbody>${rows || '<tr><td colspan="5">暂无同步变化</td></tr>'}</tbody></table></div><div class="task-change-pagination"><span>第 ${page} 页 · 共 ${result.total} 条</span><button type="button" class="button secondary" data-change-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>上一页</button><button type="button" class="button secondary" data-change-page="${page + 1}" ${page * 20 >= result.total ? 'disabled' : ''}>下一页</button></div>`;
    const dialog = modal(`${taskNumber} · 同步变化`, content, () => {}, { confirm: false });
    dialog.querySelectorAll('[data-change-page]').forEach(button => button.onclick = async () => {
      button.disabled = true;
      try { dialog.close(); await showSyncChanges(taskNumber, Number(button.dataset.changePage)); }
      catch (error) { status(error.message, true); }
    });
  }
  function modal(title, content, onSubmit, { confirm = true, confirmLabel = '确认', inline = false } = {}) {
    const host = root.querySelector('[data-task-modal-host]');
    const parentDialog = root.querySelector('.task-detail-dialog[open]');
    if (parentDialog) { parentDialog.dataset.suspended = 'true'; parentDialog.close(); }
    if (inline && !parentDialog) root.querySelector('.task-book:not([hidden])')?.append(host);
    host.innerHTML = `<dialog class="document-task-dialog" aria-label="${e(title)}"><form><header><h2>${e(title)}</h2><button type="button" data-modal-close class="icon-button" aria-label="关闭">${icon('x')}</button></header><div class="task-modal-body">${content}</div><p role="alert" data-modal-error hidden></p><footer><span role="status" data-modal-status></span><button type="button" class="button secondary" data-modal-close>取消</button>${confirm ? `<button class="button" value="confirm">${e(confirmLabel)}</button>` : ''}</footer></form></dialog>`;
    const dialog = host.querySelector('dialog');
    if (inline && !parentDialog) { dialog.classList.add('task-inline-dialog'); dialog.show(); dialog.scrollIntoView({ block: 'nearest' }); }
    else dialog.showModal();
    markDynamicSelects(dialog); window.lucide?.createIcons({ nodes: [dialog] });
    dialog.querySelectorAll('[data-modal-close]').forEach(b => b.onclick = () => dialog.close());
    dialog.addEventListener('close', async () => {
      if (dialog.dataset.scopeChangeId && dialog.dataset.scopeLinked !== 'true' && dialog.dataset.scopeConfirmed !== 'true') {
        try {
          const current = await loadDocumentTask(state.selected.number);
          await taskWrite(`/${encodeURIComponent(current.number)}/scope-changes/${encodeURIComponent(dialog.dataset.scopeChangeId)}/cancel`, { expectedRevision: current.revision, reason: '用户取消范围纠偏预览' }, 'POST');
          await refresh();
        } catch (error) { status(`范围纠偏取消失败：${error.message}`); }
      }
      dialog.remove(); cleanupSearchableSelects();
      if (parentDialog?.isConnected && parentDialog.dataset.suspended === 'true' && dialog.dataset.saved !== 'true') {
        delete parentDialog.dataset.suspended;
        parentDialog.showModal();
      }
    });
    dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault(); const message = dialog.querySelector('[data-modal-error]'); message.hidden = true;
      const buttons = [...dialog.querySelectorAll('button')]; buttons.forEach(b => b.disabled = true);
      dialog.querySelector('[data-modal-status]').textContent = '正在保存…';
      try { const confirmed = event.submitter?.value === 'confirm'; const result = await onSubmit(new FormData(event.currentTarget), confirmed); if (result?.keepOpen) return; dialog.dataset.saved = 'true'; dialog.dataset.scopeConfirmed = dialog.dataset.scopeChangeId ? 'true' : dialog.dataset.scopeConfirmed; dialog.close(); try { await refresh(); status('已保存'); } catch (error) { status('已保存，刷新失败，请重新读取：' + error.message); } }
      catch (error) { message.textContent = error.message; message.hidden = false; }
      finally { buttons.forEach(b => b.disabled = false); dialog.querySelector('[data-modal-status]').textContent = ''; }
    };
    return dialog;
  }
  function decision(current, reason) {
    return `<fieldset class="task-impact"><legend>是否涉及文档变更</legend><label><input type="radio" name="impact" value="involved" ${current === 'involved' ? 'checked' : ''}>涉及</label><label><input type="radio" name="impact" value="not_involved" ${current === 'not_involved' ? 'checked' : ''}>不涉及</label></fieldset><div data-reasons><label>不涉及理由<select name="reasonId">${options(state.context.config.reasonOptions.map(r => ({ id: r.id, name: r.label })), reason?.id)}</select></label><label data-other>补充理由<input name="reasonDetail" value="${e(reason?.detail)}"></label></div>`;
  }
  function decorateScope(dialog, task, level, book) {
    dialog.classList.add('task-scope-dialog');
    dialog.dataset.scopeLevel = level;
    if (level === 'handbook') return;
    const current = 1;
    const steps = level === 'handbook' ? ['影响判断', '选择手册', '转交手册负责人'] : ['工单已转交', '本手册影响判断', '分派文档负责人'];
    dialog.querySelector('header>h2').insertAdjacentHTML('afterend', `<p class="task-scope-context">${e(task.number)} · ${e(book?.name || task.description)}</p>`);
    dialog.querySelector('.task-modal-body').insertAdjacentHTML('afterbegin', `<ol class="task-scope-steps" aria-label="范围确认步骤">${steps.map((label, i) => `<li data-scope-step="${i}" class="${i === current ? 'current' : i < current ? 'done' : ''}" ${i === current ? 'aria-current="step"' : ''}><span>${i < current ? '✓' : i + 1}</span>${label}</li>`).join('')}</ol>`);
    const choices = dialog.querySelector('.task-choices');
    choices.insertAdjacentHTML('beforebegin', `<div class="task-choice-heading"><span>${level === 'handbook' ? '手册' : '手册目录 / 文档'}</span><span>${level === 'handbook' ? '手册负责人' : '文档负责人'}</span></div>`);
    const why = dialog.querySelector('[name=reason]')?.closest('label');
    if (why) { const details = document.createElement('details'); details.className = 'task-reassign-note'; details.innerHTML = '<summary>需要调整已有负责人</summary>'; why.before(details); details.append(why); }
  }
  function bindScope(dialog) {
    const update = () => {
      const impact = dialog.querySelector('[name=impact]:checked')?.value;
      const confirmButton = dialog.querySelector('button[value=confirm]');
      confirmButton.textContent = ['handbook', 'assignment'].includes(dialog.dataset.scopeLevel) ? '确认' : impact === 'not_involved' ? '确认不涉及' : '确认文档范围';
      const impactStep = dialog.querySelector('[data-scope-step="0"]');
      if (impactStep && dialog.querySelector('[data-scope-step="1"][aria-current]')) { impactStep.classList.toggle('done', Boolean(impact)); impactStep.querySelector('span').textContent = impact ? '✓' : '1'; }
      dialog.querySelector('[data-reasons]').hidden = impact !== 'not_involved';
      dialog.querySelector('[data-involved]').hidden = impact !== 'involved';
      dialog.querySelector('[data-other]').hidden = dialog.querySelector('[name=reasonId]').value !== 'other';
      const filter = dialog.querySelector('[data-scope-search]').value.trim().toLocaleLowerCase();
      const tree = dialog.querySelector('[data-scope-tree]');
      if (tree) {
        if (filter && !tree._openBeforeSearch) tree._openBeforeSearch = new Map([...tree.querySelectorAll('details')].map(item => [item, item.open]));
        const visit = item => {
          if (item.hasAttribute('data-new-editor')) return true;
          const branch = item.querySelector(':scope > details');
          if (!branch) { item.hidden = Boolean(filter) && !item.dataset.searchText.toLocaleLowerCase().includes(filter); return !item.hidden; }
          const ownMatch = branch.querySelector(':scope > summary').textContent.toLocaleLowerCase().includes(filter);
          const children = [...branch.querySelectorAll(':scope > ul > li')];
          const descendantMatch = children.map(visit).some(Boolean);
          if (ownMatch && filter) children.forEach(child => { child.hidden = false; child.querySelectorAll('li').forEach(descendant => { descendant.hidden = false; }); });
          item.hidden = Boolean(filter) && !ownMatch && !descendantMatch;
          if (filter && !item.hidden) branch.open = true;
          return !item.hidden;
        };
        [...tree.querySelectorAll(':scope > ul > li')].forEach(visit);
        if (!filter && tree._openBeforeSearch) { tree._openBeforeSearch.forEach((open, item) => { item.open = open; }); tree._openBeforeSearch = null; }
        tree.querySelector('[data-tree-empty]').hidden = Boolean(tree.querySelector('[data-new-editor]') || [...tree.querySelectorAll('[data-choice]')].find(row => !row.hidden && !row.closest('li[hidden]')));
      } else dialog.querySelectorAll('[data-choice]').forEach(row => { row.hidden = Boolean(filter) && !row.textContent.toLocaleLowerCase().includes(filter); });
      const selected = [...dialog.querySelectorAll('[name=selected]:checked')];
      dialog.querySelector('[data-selected-count]').textContent = `已选 ${selected.length} 项`;
      dialog.querySelectorAll('[data-choice]').forEach(row => { const checked = row.querySelector('[name=selected]').checked; row.classList.toggle('selected', checked); row.querySelector('select').disabled = !checked; });
    };
    dialog.addEventListener('change', update); dialog.querySelector('[data-scope-search]').addEventListener('input', update); update();
  }
  async function saveScopeWithPreview(form, dialog, task, level, handbookId, proposed) {
    const endpoint = `/${encodeURIComponent(task.number)}/scope-changes`;
    if (!dialog.dataset.scopeChangeId) {
      const reason = String(form.get('scopeChangeReason') || '').trim();
      if (!reason) throw new Error('请说明本次范围偏差原因');
      const current = await loadDocumentTask(task.number);
      const selectedDocumentIds = new Set(level === 'handbook' ? (proposed.documents || []).map(doc => String(doc.id)) : []);
      const selectedHandbookIds = new Set(level === 'ticket' ? (proposed.handbooks || []).map(book => String(book.id)) : []);
      const affectedDocuments = (task.decomposition.handbooks || []).flatMap(book => {
        if (level === 'ticket' && selectedHandbookIds.has(String(book.id))) return [];
        if (level === 'handbook' && book.id !== handbookId) return [];
        const scopeChanged = level === 'handbook' && (proposed.impact !== book.impact || (proposed.targetVersion || null) !== (book.targetVersion || null));
        return (book.documents || []).filter(doc => level === 'ticket' || scopeChanged || proposed.impact !== 'involved' || !selectedDocumentIds.has(String(doc.id)))
          .map(doc => ({ handbookId: book.id, documentId: doc.createdDocumentId || doc.id }));
      });
      const params = new URLSearchParams(window.location.search);
      const sourceOpinion = params.get('scopeOpinionTaskId') && params.get('scopeOpinionReviewId') && params.get('scopeOpinionCommentId')
        ? { taskId: params.get('scopeOpinionTaskId'), reviewId: params.get('scopeOpinionReviewId'), commentId: params.get('scopeOpinionCommentId') } : null;
      const change = await taskWrite(endpoint, { expectedRevision: current.revision, level, handbookId, reason, affectedDocuments, ...(sourceOpinion ? { sourceOpinion } : {}) }, 'POST');
      dialog.dataset.scopeChangeId = change.id;
      state.selected = await loadDocumentTask(task.number);
    }
    if (dialog.dataset.previewedProposal !== JSON.stringify(proposed) || !dialog.dataset.impactDigest || dialog.dataset.scopeCanConfirm === 'false') {
      const preview = await taskWrite(`${endpoint}/${encodeURIComponent(dialog.dataset.scopeChangeId)}/preview`, { proposed }, 'POST');
      dialog.dataset.previewedProposal = JSON.stringify(proposed);
      dialog.dataset.impactDigest = preview.impactDigest;
      const summary = dialog.querySelector('.task-scope-impact-preview') || document.createElement('section');
      summary.className = 'task-scope-impact-preview';
      summary.setAttribute('aria-live', 'polite');
      summary.innerHTML = `<h3>变更影响预览</h3>${scopeImpactTable(preview.items)}${preview.canConfirm ? '<p>确认后受影响文档按新范围重新计算。</p>' : '<p role="alert">当前不能确认。请处理表中的 MR 状态后重新预览。</p>'}`;
      dialog.querySelector('.task-modal-body').append(summary);
      dialog.dataset.scopeCanConfirm = String(preview.canConfirm);
      dialog.querySelector('button[value=confirm]').textContent = preview.canConfirm ? '确认' : '重新预览';
      return { keepOpen: true };
    }
    const current = await loadDocumentTask(task.number);
    const result = await taskWrite(`${endpoint}/${encodeURIComponent(dialog.dataset.scopeChangeId)}/confirm`, { expectedRevision: current.revision, proposed, impactDigest: dialog.dataset.impactDigest }, 'POST');
    dialog.dataset.scopeConfirmed = 'true';
    return result;
  }
  function linkedScopeChange(task, level, handbookId) {
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('scopeOpinionTaskId'), reviewId = params.get('scopeOpinionReviewId'), commentId = params.get('scopeOpinionCommentId');
    if (!taskId || !reviewId || !commentId) return null;
    return (task.scopeChanges || []).find(change => change.status === 'reported' && change.level === level
      && (level !== 'handbook' || change.handbookId === handbookId)
      && change.sourceOpinion?.taskId === taskId && change.sourceOpinion.reviewId === reviewId
      && change.sourceOpinion.commentId === commentId) || null;
  }
  function bindLinkedScopeChange(dialog, change) {
    if (!change) return;
    dialog.dataset.scopeChangeId = change.id;
    dialog.dataset.scopeLinked = 'true';
    const reason = dialog.querySelector('[name=scopeChangeReason]');
    if (reason) reason.value = change.reason || '';
  }
  function editHandbooks(removeId = null) {
    const t = state.selected, s = t.decomposition;
    const available = state.context.handbooks.filter(book => !s.handbooks.some(old => old.id === book.id));
    const removed = s.handbooks.find(book => book.id === removeId);
    if (removeId && s.handbooks.length === 1) {
      ticketScope();
      const error = root.querySelector('.document-task-dialog [data-modal-error]');
      error.textContent = '移除最后一本手册时，请明确选择新的手册，或确认工单不涉及并填写理由。';
      error.hidden = false;
      return;
    }
    const content = removed ? `<p>确定将“${e(removed.name)}”移出本任务的手册范围？</p>`
      : available.length ? `<label>手册名称<select name="handbookId" required>${options(available, null)}</select></label><label>手册负责人${person('newBookOwner', null)}</label>` : '<p>所有可用手册均已添加。</p>';
    const reason = s.confirmed ? '<label>范围调整原因<textarea name="scopeChangeReason" rows="2" required></textarea></label>' : '';
    const dialog = modal(removed ? '移除手册' : '新增手册', content + reason, async form => {
      const handbooks = s.handbooks.filter(book => book.id !== removeId).map(book => ({ id: book.id, ownerId: book.ownerId }));
      if (!removed) {
        const id = form.get('handbookId'), ownerId = form.get('newBookOwner');
        if (!id || !ownerId) throw new Error('请选择手册和手册负责人');
        handbooks.push({ id, ownerId });
      }
      const proposed = { ticketImpact: 'involved', handbooks };
      if (s.confirmed) return saveScopeWithPreview(form, dialog, t, 'ticket', null, proposed);
      return taskWrite(`/${encodeURIComponent(t.number)}/decomposition`, { expectedRevision: t.revision, confirm: false, ...proposed });
    }, { confirm: Boolean(removed || available.length), confirmLabel: removed ? '预览并移除' : '新增手册' });
    if (!removed) dialog.querySelector('[name=handbookId]')?.addEventListener('change', event => {
      const owner = state.context.handbooks.find(book => book.id === event.target.value)?.ownerId;
      const select = dialog.querySelector('[name=newBookOwner]');
      select.value = state.context.people.some(person => person.id === owner) ? owner : '';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  function ticketScope() {
    const t = state.selected, s = t.decomposition;
    const reasonField = s.confirmed ? '<label>范围调整原因<textarea name="scopeChangeReason" required rows="2" placeholder="说明为什么需要增减手册"></textarea></label>' : '';
    const facts = `<div class="task-assignment-facts"><strong>${e(t.number)}</strong><span>${e(t.description)}</span><span>${e(t.product || '产品未指定')} · ${e(t.version || '版本未指定')}</span></div>`;
    const choices = state.context.handbooks.map(b => {
      const old = s.handbooks.find(x => x.id === b.id);
      const candidate = old?.ownerId || b.ownerId;
      const valid = state.context.people.some(p => p.id === candidate) ? candidate : null;
      return `<div data-choice data-handbook-id="${e(b.id)}"><label><input type="checkbox" name="selected" value="${e(b.id)}" ${old ? 'checked' : ''}><span>${e(b.name)}</span></label><span>${e(b.productType || '未配置')}</span><span data-mapping-branch>${old?.versionMapping?.targetBranch ? e(old.versionMapping.targetBranch) : '选择后匹配'}</span>${person(`owner:${b.id}`, valid)}</div>`;
    }).join('');
    const content = `${facts}<section class="task-assignment-stage"><h3>工单范围</h3>${s.confirmed ? '<p>已分派范围需要先预览影响，再确认变更。</p>' : ''}${reasonField}${decision(s.ticketImpact, s.ticketReason)}</section><section class="task-assignment-stage" data-involved><div class="task-assignment-heading"><h3>手册分派</h3><p data-selected-count></p></div><label class="task-assignment-search">${uiIcon('action.search')}<input type="search" data-scope-search placeholder="搜索手册名称或产品类型" aria-label="搜索手册名称或产品类型"></label><div class="task-assignment-columns" aria-hidden="true"><span>手册名称</span><span>产品类型</span><span>目标分支</span><span>负责人</span></div><div class="task-choices task-assignment-choices">${choices}</div></section>`;
    const dialog = modal('任务分派', content, async (form, confirm) => {
      const proposed = { ticketImpact: form.get('impact'), reasonId: form.get('reasonId'), reasonDetail: form.get('reasonDetail'), handbooks: form.getAll('selected').map(id => ({ id, ownerId: form.get(`owner:${id}`) })) };
      if (s.confirmed) return saveScopeWithPreview(form, dialog, t, 'ticket', null, proposed);
      return taskWrite(`/${encodeURIComponent(t.number)}/decomposition`, { expectedRevision: t.revision, confirm, ...proposed, reason: form.get('reason') });
    });
    dialog.dataset.scopeLevel = 'assignment';
    const mappingCache = new Set();
    const loadMapping = async row => {
      const id = row.dataset.handbookId;
      if (mappingCache.has(id)) return;
      mappingCache.add(id);
      const cell = row.querySelector('[data-mapping-branch]');
      cell.textContent = '匹配中…';
      try {
        const catalog = await taskRequest(`/catalog?handbookId=${encodeURIComponent(id)}&ticketNumber=${encodeURIComponent(t.number)}`);
        cell.textContent = catalog.versionMapping?.branch || `映射不可用：${catalog.versionMappingError || '未找到版本规则'}`;
      } catch (error) { cell.textContent = `映射不可用：${error.message}`; }
      cell.title = cell.textContent;
    };
    dialog.addEventListener('change', event => {
      if (event.target.matches('[name=selected]:checked')) loadMapping(event.target.closest('[data-choice]'));
    });
    dialog.querySelectorAll('[name=selected]:checked').forEach(input => loadMapping(input.closest('[data-choice]')));
    bindLinkedScopeChange(dialog, linkedScopeChange(t, 'ticket', null));
    decorateScope(dialog, t, 'handbook');
    bindScope(dialog);
  }
  function scopeDirectoryTree(catalog, docs, renderDocument) {
    const folders = new Map(), roots = [], seen = new Set();
    const addable = new Set((catalog.chapters || []).map(chapter => String(chapter.id)));
    const visit = (nodes, parentId = null) => {
      for (const node of Array.isArray(nodes) ? nodes : []) {
        const kind = String(node.kind || '').toLowerCase();
        if (['directory', 'part', 'chapter', 'section'].includes(kind) && node.id != null && !seen.has(String(node.id))) {
          const id = String(node.id);
          seen.add(id);
          folders.set(id, { id, kind, parentId: node.parentId || parentId, name: node.title || node.name || id, children: [] });
        }
        visit(node.children, node.id || parentId);
      }
    };
    visit(catalog.directory?.nodes || catalog.directory?.governance?.nodes || []);
    for (const chapter of catalog.chapters || []) {
      const id = String(chapter.id);
      if (!folders.has(id)) folders.set(id, { id, kind: 'chapter', parentId: chapter.parentId, name: chapter.name, children: [] });
    }
    for (const folder of folders.values()) {
      const parent = folders.get(String(folder.parentId));
      if (parent && parent !== folder) parent.children.push(folder);
      else roots.push(folder);
    }
    for (const doc of docs) {
      const parent = folders.get(String(doc.parentId));
      (parent?.children || roots).push({ document: doc });
    }
    const render = (items, depth = 0, ancestors = []) => items.map(item => {
      if (item.document) return `<li data-choice data-search-text="${e([...ancestors, item.document.name].join(' / '))}">${renderDocument(item.document)}</li>`;
      const path = [...ancestors, item.name];
      const canAdd = addable.has(item.id) && item.kind !== 'part';
      return `<li data-folder="${e(item.id)}" data-folder-path="${e(path.join(' / '))}"><details ${depth < 2 ? 'open' : ''}><summary role="treeitem" tabindex="0">${icon('folder')}<span>${e(item.name)}</span></summary><ul>${render(item.children, depth + 1, path)}</ul></details>${canAdd ? `<button type="button" class="task-folder-menu-button" data-folder-menu aria-label="${e(item.name)}：更多操作" title="${e(item.name)}：更多操作" aria-expanded="false">${icon('ellipsis')}</button><div class="task-folder-menu" hidden><button type="button" data-folder-add>新增文档</button></div>` : ''}</li>`;
    }).join('');
    return `<div class="task-directory-tree" data-scope-tree><ul role="tree">${render(roots)}</ul><p data-tree-empty hidden>没有匹配的目录或文档</p></div>`;
  }
  async function bookScope(id) {
    const t = state.selected, book = t.decomposition.handbooks.find(b => b.id === id), catalog = await taskRequest(`/catalog?handbookId=${encodeURIComponent(id)}&ticketNumber=${encodeURIComponent(t.number)}`);
    let newDocs = book.documents.filter(d => d.kind === 'new').map(d => ({ ...d }));
    const choice = d => {
      const old = book.documents.find(x => x.id === d.id);
      const candidate = d.ownerId;
      const validCandidate = state.context.people.some(p => p.id === candidate) ? candidate : null;
      const validOld = state.context.people.some(p => p.id === old?.ownerId) ? old.ownerId : null;
      const selectedOwner = validOld || validCandidate;
      return `<label><input type="checkbox" name="selected" value="${e(d.id)}" ${old || d.kind === 'new' ? 'checked' : ''}><span title="${e(d.name)}">${e(d.name)}${d.kind === 'new' ? '（新增）' : ''}</span></label>${person(`owner:${d.id}`, selectedOwner)}`;
    };
    const tree = scopeDirectoryTree(catalog, [...(catalog.outlineVersionId ? catalog.documents : []), ...newDocs], choice);
    const versionField = catalog.versionMapping
      ? `<label>PingCode ${e(t.product || '')} · ${e(t.version || '')} → 目标分支<input name="targetVersion" value="${e(catalog.versionMapping.branch)}" readonly></label>`
      : catalog.versionMappingError
        ? `<p class="task-outline-alert" role="alert">映射不可用：${e(catalog.versionMappingError)}。请联系平台管理员配置 GitLab 版本映射。</p>`
        : `<label>目标版本<select name="targetVersion">${options(catalog.versions.map(v => ({ id: v, name: v })), book.targetVersion)}</select></label>`;
    const reasonField = book.confirmed ? '<label>范围调整原因<textarea name="scopeChangeReason" required rows="2" placeholder="说明为什么需要增减或调整文档"></textarea></label>' : '';
    const dialog = modal(`${book.name} · 文档范围`, `${book.confirmed ? '<p>已分派文档需要先预览审核、MR 和交付影响，再确认变更。</p>' : ''}${reasonField}${decision(book.impact, book.reason)}<div data-involved>${versionField}<label>搜索目录或文档<input type="search" data-scope-search></label><p data-selected-count></p>${catalog.outlineVersionId ? '' : '<p class="task-outline-alert" role="alert">未找到已发布大纲，无法选择存量文档</p>'}<div class="task-choices">${tree}</div></div>`, async (form, confirm) => {
      const proposed = { impact: form.get('impact'), reasonId: form.get('reasonId'), reasonDetail: form.get('reasonDetail'), targetVersion: form.get('targetVersion'), documents: form.getAll('selected').map(key => ({ ...(newDocs.find(d => d.id === key) || { id: key, kind: 'existing' }), ownerId: form.get(`owner:${key}`) })) };
      if (book.confirmed) return saveScopeWithPreview(form, dialog, t, 'handbook', id, proposed);
      return taskWrite(`/${encodeURIComponent(t.number)}/handbooks/${encodeURIComponent(id)}`, { expectedRevision: t.revision, confirm, ...proposed, reason: form.get('reason') });
    }, { inline: true });
    bindLinkedScopeChange(dialog, linkedScopeChange(t, 'handbook', id));
    const closeMenus = () => dialog.querySelectorAll('[data-folder-menu]').forEach(button => {
      button.setAttribute('aria-expanded', 'false'); button.nextElementSibling.hidden = true;
    });
    dialog.addEventListener('click', event => {
      const menuButton = event.target.closest('[data-folder-menu]');
      if (menuButton) {
        const opening = menuButton.getAttribute('aria-expanded') !== 'true';
        closeMenus(); menuButton.setAttribute('aria-expanded', String(opening)); menuButton.nextElementSibling.hidden = !opening;
        if (opening) menuButton.closest('[data-folder]').querySelector(':scope > details').open = true;
        if (opening) { menuButton.nextElementSibling.scrollIntoView({ block: 'nearest' }); menuButton.nextElementSibling.querySelector('button').focus(); }
        return;
      }
      const addButton = event.target.closest('[data-folder-add]');
      if (addButton) {
        const folder = addButton.closest('[data-folder]');
        closeMenus(); dialog.querySelector('[data-new-editor]')?.remove(); cleanupSearchableSelects();
        dialog.querySelector('[data-scope-search]').value = '';
        dialog.querySelector('[data-scope-search]').dispatchEvent(new Event('input'));
        const branch = folder.querySelector(':scope > details > ul');
        folder.querySelector(':scope > details').open = true;
        branch.insertAdjacentHTML('afterbegin', `<li class="task-inline-new" data-new-editor><label>文档名称<input name="newName" autocomplete="off"></label><label>文档负责人${person('newOwner', null)}</label><div class="task-inline-actions"><button type="button" class="button primary" data-commit-new>加入选择</button><button type="button" class="button secondary" data-cancel-new>取消</button></div><p role="alert" data-new-error hidden></p></li>`);
        markDynamicSelects(dialog); branch.querySelector('[name=newName]').focus();
        return;
      }
      const cancelButton = event.target.closest('[data-cancel-new]');
      if (cancelButton) {
        const folder = cancelButton.closest('[data-folder]');
        cancelButton.closest('[data-new-editor]').remove(); cleanupSearchableSelects();
        folder.querySelector('[data-folder-menu]')?.focus();
        return;
      }
      const commitButton = event.target.closest('[data-commit-new]');
      if (commitButton) {
        const editor = commitButton.closest('[data-new-editor]');
        const title = editor.querySelector('[name=newName]').value.trim();
        const ownerId = editor.querySelector('[name=newOwner]').value;
        const error = editor.querySelector('[data-new-error]');
        if (!title || !state.context.people.some(p => p.id === ownerId)) {
          error.textContent = !title ? '请输入文档名称' : '请选择文档负责人'; error.hidden = false;
          editor.querySelector(!title ? '[name=newName]' : '.searchable-combobox-input')?.focus();
          return;
        }
        const folder = editor.closest('[data-folder]');
        const doc = { id: taskOperationId(), kind: 'new', name: title, parentId: folder.dataset.folder, ownerId };
        newDocs.push(doc);
        editor.insertAdjacentHTML('afterend', `<li data-choice data-search-text="${e(`${folder.dataset.folderPath} / ${title}`)}">${choice(doc)}</li>`);
        const addedRow = editor.nextElementSibling;
        editor.remove(); cleanupSearchableSelects(); markDynamicSelects(dialog);
        dialog.dispatchEvent(new Event('change'));
        addedRow.querySelector('[name=selected]').focus();
        return;
      }
      closeMenus();
    });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const menu = event.target.closest('.task-folder-menu');
      if (menu) { event.preventDefault(); event.stopPropagation(); const button = menu.previousElementSibling; closeMenus(); button.focus(); }
    });
    decorateScope(dialog, t, 'document', book);
    bindScope(dialog);
  }
  let reading = false;
  async function readWithFeedback(operation) {
    if (reading) return;
    reading = true;
    status('正在读取，请稍候…');
    root.setAttribute('aria-busy', 'true');
    try { const result = await operation(); status(''); return result; }
    finally { reading = false; root.removeAttribute('aria-busy'); }
  }
  root.onclick = async event => {
    if (event.target.closest('[data-task-dismiss-message]')) { status(''); return; }
    if (reading) return;
    const tab = event.target.closest('[data-task-tab]'); if (tab) {
      const previousAttention = state.filters.attention;
      state.tab = tab.dataset.taskTab;
      state.filters.attention = state.tab === 'secondary' ? 'secondary' : 'normal';
      if (previousAttention !== state.filters.attention) {
        state.filters.page = 1;
        try { await refresh({ detail: false }); } catch (error) { status(error.message, true); }
      } else render();
      return;
    }
    const bookSwitch = event.target.closest('[data-task-book-select]');
    if (bookSwitch && state.selected) { state.activeBookId = bookSwitch.dataset.taskBookSelect; renderDrawer(); root.querySelector(`[data-task-book-select="${CSS.escape(state.activeBookId)}"]`)?.focus(); return; }
    const row = event.target.closest('[data-task-open]');
    try {
      if (row) {
        state.selected = await readWithFeedback(() => loadDocumentTask(row.dataset.taskOpen));
        state.activeBookId = null;
        renderDrawer();
        return;
      }
      const action = event.target.closest('[data-task-action]'); if (!action) return;
      const t = state.selected, id = action.dataset.book, docId = action.dataset.doc;
      switch (action.dataset.taskAction) {
        case 'plan': {
          action.disabled = true;
          try {
            // 列表和详情可能停留很久；打开编辑器时取得当前版本，不能沿用旧投影。
            const task = await readWithFeedback(() => loadDocumentTask(action.dataset.number));
            if (!task.canEditPlan) { status('当前账号已无权设置此任务时间，请刷新核对责任人'); break; }
            openPlanCalendar(root.querySelector('[data-task-modal-host]'), task, action.dataset.planKey,
              body => taskWrite(`/${encodeURIComponent(task.number)}/plan`, body),
              async () => { try { await refresh(); } catch (error) { status('时间已保存，列表刷新失败，请点击刷新核对：' + error.message); } },
              () => loadDocumentTask(task.number));
          } finally { action.disabled = false; }
          break;
        }
        case 'refresh': await refresh({ context: true }); break;
        case 'export': {
          const filters = { ...state.filters };
          delete filters.page; delete filters.pageSize;
          await readWithFeedback(() => downloadDocumentTaskFile(`/export.csv?${new URLSearchParams(filters)}`));
          break;
        }
        case 'source-view': {
          const number = t.number;
          const source = await readWithFeedback(() => taskRequest(`/${encodeURIComponent(number)}/source`));
          if (source && state.selected?.number === number) modal(`${number} · 来源详情`, `<div class="task-source-content">${renderSourceRecord(source.title, source.markdown)}</div>`, () => {}, { confirm: false });
          break;
        }
        case 'source-export':
          await readWithFeedback(() => downloadDocumentTaskFile(`/${encodeURIComponent(t.number)}/source-export`));
          break;
        case 'changes': await readWithFeedback(() => showSyncChanges(t.number)); break;
        case 'import': root.querySelector('[data-task-file]').click(); break;
        case 'close': root.querySelector('.task-detail-dialog')?.close(); state.selected = null; break;
        case 'previous': state.filters.page--; await refresh({ detail: false }); break;
        case 'next': state.filters.page++; await refresh({ detail: false }); break;
        case 'add-book': editHandbooks(); break;
        case 'remove-book': editHandbooks(id); break;
        case 'ticket-scope': ticketScope(); break;
        case 'book-scope': await readWithFeedback(() => bookScope(id)); break;
        case 'show-flow': state.tab = 'flow'; render(); root.querySelector('[data-task-drawer-host]').innerHTML = ''; break;
        case 'document-owner': {
          const book = t.decomposition.handbooks.find(b => b.id === id);
          const doc = book.documents.find(d => d.id === docId);
          const isDocument = action.dataset.taskAction === 'document-owner';
          modal(isDocument ? '改派文档责任人' : '改派手册责任人', `<p>${e(isDocument ? doc.name : book.name)}</p><label>责任人${person('ownerId', isDocument ? doc.ownerId : book.ownerId)}</label>`, form => taskWrite(`/${encodeURIComponent(t.number)}/${isDocument ? 'documents/' + encodeURIComponent(docId) : 'handbooks/' + encodeURIComponent(id)}/owner`, { expectedRevision: t.revision, handbookId: id, ownerId: form.get('ownerId') }));
          break;
        }
        case 'owner': modal('改派责任人', `<label>责任人${person('ownerId', t.ownerId)}</label>`, form => taskWrite(`/${encodeURIComponent(t.number)}/owner`, { expectedRevision: t.revision, ownerId: form.get('ownerId'), reason: form.get('reason') })); break;
        case 'complete': modal('确认不涉及并完成', '<p>已确认全部必要的不涉及理由，完成后保留决定与操作记录。</p>', () => taskWrite(`/${encodeURIComponent(t.number)}/complete`, { expectedRevision: t.revision }, 'POST')); break;
        case 'publication-check': {
          const check = (t.scopeChecks || []).find(item => item.id === action.dataset.check);
          if (!check) throw new Error('发布核对事项已变化，请重新读取');
          modal('核对已发布内容', `<p>${e(check.documentName)} · 原目标提交 ${e(check.targetCommit || '未知')}</p><fieldset><legend>核对结论</legend><label><input type="radio" name="conclusion" value="no_repair_required" checked>内容无需修复</label><label><input type="radio" name="conclusion" value="needs_fix">需要修复</label><label><input type="radio" name="conclusion" value="repair_delivered">修复已完成并重新交付</label></fieldset><label data-no-repair>目标提交<input name="targetCommit" value="${e(check.targetCommit || '')}" required></label><label data-no-repair><input type="checkbox" name="bodyVerified" value="true" required>已核对正文</label><label data-no-repair><input type="checkbox" name="resourcesVerified" value="true" required>已核对相关图片</label><label data-repair hidden>修复后的审核任务编号<input name="reviewTaskId"></label><label>核对说明<textarea name="note" rows="2"></textarea></label>`, async form => {
            const conclusion = form.get('conclusion');
            const body = { expectedRevision: state.selected.revision, conclusion, note: form.get('note') };
            if (conclusion === 'no_repair_required') Object.assign(body, { targetCommit: form.get('targetCommit'), bodyVerified: form.get('bodyVerified') === 'true', resourcesVerified: form.get('resourcesVerified') === 'true' });
            if (conclusion === 'repair_delivered') body.reviewTaskId = form.get('reviewTaskId');
            return taskWrite(`/${encodeURIComponent(t.number)}/publication-checks/${encodeURIComponent(check.id)}/complete`, body, 'POST');
          });
          const update = () => { const noRepair = root.querySelector('[name=conclusion]:checked')?.value === 'no_repair_required'; const repair = root.querySelector('[name=conclusion]:checked')?.value === 'repair_delivered'; root.querySelectorAll('[data-no-repair]').forEach(item => { item.hidden = !noRepair; item.querySelectorAll('[required]').forEach(input => { input.required = noRepair; }); }); root.querySelector('[data-repair]').hidden = !repair; root.querySelector('[data-repair] input').required = repair; };
          root.querySelectorAll('[name=conclusion]').forEach(input => input.addEventListener('change', update)); update();
          break;
        }
        case 'link': {
          const choices = await readWithFeedback(() => taskRequest(`/${encodeURIComponent(t.number)}/reviews?handbookId=${encodeURIComponent(id)}&documentId=${encodeURIComponent(docId)}`));
          modal('关联审核与交付', `<label>审核任务<select name="reviewTaskId" required>${options(choices.map(r => ({ id: r.id, name: `${r.name || r.id} · ${r.state}` })))}</select></label>${!choices.length ? '<p>尚无匹配的审核任务，请先进入编写、保存并送审。</p>' : ''}`, form => taskWrite(`/${encodeURIComponent(t.number)}/documents/${encodeURIComponent(docId)}/link`, { expectedRevision: t.revision, handbookId: id, reviewTaskId: form.get('reviewTaskId') }, 'POST')); break;
        }
        case 'new-document': {
          const catalog = await readWithFeedback(() => taskRequest(`/catalog?handbookId=${encodeURIComponent(id)}`));
          const doc = t.decomposition.handbooks.find(b => b.id === id).documents.find(d => d.id === docId);
          const dialog = modal('新增文档', `<p>${e(doc.name)} · 创建候选后，在大纲中确认发布，再关联文档。</p>${doc.outlineProposal ? `<a class="button secondary" href="/knowledge-center/outlines/${encodeURIComponent(doc.outlineProposal.outlineId)}">打开候选大纲</a>` : '<button type="button" class="button secondary" data-prepare-document>创建大纲候选</button>'}<label>已发布文档<select name="createdDocumentId" required>${options(catalog.documents.filter(d => d.name === doc.name && d.parentId === doc.parentId))}</select></label>`, form => taskWrite(`/${encodeURIComponent(t.number)}/documents/${encodeURIComponent(docId)}/resolve-new`, { expectedRevision: t.revision, handbookId: id, createdDocumentId: form.get('createdDocumentId') }, 'POST'));
          const prepare = dialog.querySelector('[data-prepare-document]');
          if (prepare) prepare.onclick = async () => {
            prepare.disabled = true;
            try { await taskWrite(`/${encodeURIComponent(t.number)}/documents/${encodeURIComponent(docId)}/prepare-new`, { expectedRevision: t.revision, handbookId: id }, 'POST'); dialog.close(); await refresh(); }
            catch (error) { const message = dialog.querySelector('[data-modal-error]'); message.hidden = false; message.textContent = error.message; prepare.disabled = false; }
          }; break;
        }
      }
    } catch (error) { status(error.message, true); }
  };
  root.onchange = async event => {
    if (!event.target.matches('[data-task-file]')) return;
    const file = event.target.files[0]; if (!file) return;
    try {
      const preview = await readWithFeedback(() => importDocumentTasks(file, true));
      if (!preview) return;
      modal('导入预览', `<p>新增 ${preview.summary.created} · 更新 ${preview.summary.updated} · 无变化 ${preview.summary.unchanged} · 错误 ${preview.summary.error}</p><div class="task-choices"><table><thead><tr><th>行</th><th>编号</th><th>结果</th></tr></thead><tbody>${preview.items.map(i => `<tr><td>${i.row}</td><td>${e(i.number)}</td><td>${e(i.message || ({ created: '新增', updated: '更新来源', unchanged: '无变化' })[i.action])}</td></tr>`).join('')}</tbody></table></div>`, () => importDocumentTasks(file, false, preview.digest), { confirm: !preview.summary.error });
    } catch (error) { status(error.message, true); }
  };
  root.onsubmit = async event => {
    if (event.target.matches('[data-task-filters]')) { event.preventDefault(); state.filters = { ...Object.fromEntries(new FormData(event.target)), attention: state.tab === 'secondary' ? 'secondary' : 'normal', page: 1, pageSize: 20 }; try { await refresh({ detail: false }); } catch (error) { status(error.message, true); } }
    if (event.target.matches('[data-task-config]')) { event.preventDefault(); const output = event.target.querySelector('[role=status]'); try { const form = new FormData(event.target); state.context.config = await taskWrite('/config', { defaultOwnerId: state.context.config.defaultOwnerId, knowledgeCenterOwnerId: state.context.config.knowledgeCenterOwnerId, reasonOptions: state.context.config.reasonOptions.map(r => ({ id: r.id, label: form.get('reasonLabel:' + r.id) })), expectedRevision: state.context.config.revision }); output.textContent = '配置已保存'; } catch (error) { output.textContent = error.message; } }
  };
  root.onkeydown = event => { if (event.key === 'Escape' && !root.querySelector('dialog[open]') && state.selected) { state.selected = null; render(); } };
  render();
  const requested = new URLSearchParams(window.location.search);
  if (state.selected && ['ticket-scope', 'book-scope', 'new-document', 'complete'].includes(requested.get('action'))) {
    const task = state.selected;
    const action = requested.get('action');
    const handbookId = requested.get('handbookId');
    const documentId = requested.get('documentId');
    const book = task.decomposition.handbooks.find(item => item.id === handbookId);
    const doc = book?.documents.find(item => item.id === documentId);
    const allowed = action === 'ticket-scope' ? task.canConfirm
      : action === 'complete' ? task.nextAction?.action === 'complete'
        : action === 'book-scope' ? book?.canEdit
          : book?.confirmed && doc?.canEdit && doc.kind === 'new' && !doc.writingUrl;
    const selector = `[data-task-action="${action}"]${handbookId ? `[data-book="${CSS.escape(handbookId)}"]` : ''}${documentId ? `[data-doc="${CSS.escape(documentId)}"]` : ''}`;
    if (allowed) root.querySelector(`.task-drawer ${selector}`)?.click();
  }
}
