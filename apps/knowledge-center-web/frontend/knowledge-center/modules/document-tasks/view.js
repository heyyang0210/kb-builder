import { taskOperationId } from '../../common/api/document-tasks-api.js';
import { loadDocumentTasks, loadDocumentTask, taskRequest, taskWrite, importDocumentTasks } from '../../common/api/document-tasks-api.js';
import { escapeHtml, icon } from '../../common/utils/dom.js';
import { planCell, openPlanCalendar } from './plan-calendar.js';
import { markDynamicSelects, cleanupSearchableSelects } from '../../common/searchable-combobox.js';
const e = value => escapeHtml(String(value ?? ''));
const labels = { pending_scope: '待处理', in_progress: '处理中', completed: '已完成' };
const timestamp = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
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
  const activeTab = root.querySelector('.document-task-page [data-task-tab].active')?.dataset.taskTab || 'list';
  const state = { ...documentTaskProjection, tab: activeTab, selected: documentTaskProjection.selected || null, activeBookId: new URLSearchParams(window.location.search).get('handbookId'), filters: { page: 1, pageSize: 20, q: new URLSearchParams(window.location.search).get('task') || '' }, preview: null, file: null };
  const name = id => state.context?.people.find(p => p.id === id)?.displayName || id || '待指派';
  const options = (items, selected, blank = '请选择') => `<option value="">${blank}</option>${items.map(p => `<option value="${e(p.id)}" ${p.id === selected ? 'selected' : ''}>${e(p.displayName || p.name)}</option>`).join('')}`;
  const person = (field, selected) => `<select name="${e(field)}" data-searchable-select aria-label="责任人">${options(state.context?.people || [], selected)}</select>`;
  const button = (action, text, extra = '') => `<button type="button" class="button secondary" data-task-action="${action}" ${extra}>${text}</button>`;
  let statusTimer;
  const status = (message, isError = false) => {
    clearTimeout(statusTimer);
    const node = root.querySelector('[data-task-message]');
    if (!node) return;
    node.textContent = message;
    node.hidden = !message;
    node.setAttribute('role', isError ? 'alert' : 'status');
    if (message && !message.startsWith('正在')) statusTimer = setTimeout(() => { node.hidden = true; }, isError ? 5000 : 3000);
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
    root.innerHTML = `<section class="document-task-page"><header class="document-task-page-header"><h1>任务管理</h1><div class="document-task-actions">${button('refresh', icon('refresh-cw') + '刷新')}${ctx.canAdmin ? button('import', icon('upload') + '导入工单') : ''}<input type="file" accept=".json,.xlsx" hidden data-task-file></div></header><p role="alert" data-task-message ${state.error ? '' : 'hidden'}>${e(state.error?.message)}</p><nav class="document-task-tabs" aria-label="任务管理视图">${[['list', '任务列表'], ['flow', '流程流转'], ...(ctx.canAdmin ? [['config', '任务配置']] : [])].map(([id, label]) => `<button data-task-tab="${id}" class="${state.tab === id ? 'active' : ''}" aria-selected="${state.tab === id}">${label}</button>`).join('')}</nav><div data-task-list ${state.tab !== 'list' ? 'hidden' : ''}><form class="document-task-toolbar" data-task-filters><label class="task-search">${icon('search')}<input name="q" aria-label="搜索编号或描述" placeholder="搜索编号或描述" value="${e(state.filters.q)}"></label><select name="ownerId" aria-label="责任人筛选">${options(ctx.people || [], state.filters.ownerId, '全部责任人')}</select><select name="product" aria-label="产品筛选">${options((state.filterOptions?.product || []).map(v => ({ id: v, name: v })), state.filters.product, "全部产品")}</select><select name="version" aria-label="版本筛选">${options((state.filterOptions?.version || []).map(v => ({ id: v, name: v })), state.filters.version, "全部版本")}</select><select name="status" aria-label="状态筛选"><option value="">全部状态</option>${Object.entries(labels).map(([id, label]) => `<option value="${id}" ${state.filters.status === id ? 'selected' : ''}>${label}</option>`).join('')}</select><button class="button secondary">筛选</button></form><div class="document-task-table-wrap"><table class="document-task-table"><thead><tr>${['编号', '描述', '责任人', '产品', '版本', '状态', '开始时间', '结束时间', '输出件', '来源'].map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${(state.items || []).map(t => `<tr class="task-data-row"><td><button class="task-number" data-task-open="${e(t.number)}">${e(t.number)}</button></td><td>${e(t.description)}</td><td>${e(t.ownerName)}</td><td>${e(t.product || '未指定')}</td><td>${e(t.version || '未指定')}</td><td><span class="document-task-status ${t.status}">${e(labels[t.status])}</span></td><td>${planCell(t, "plannedStartTime")}</td><td>${planCell(t, "plannedEndTime")}</td><td class="task-output-cell">${outputCell(t)}</td><td>${t.sourceUrl ? `<a href="${e(t.sourceUrl)}" target="_blank" rel="noopener noreferrer">PingCode ${icon('external-link')}</a>` : '—'}</td></tr>`).join('') || `<tr><td colspan="10">${state.status === 'loading' ? '正在读取任务…' : state.error ? '任务读取失败，请点击刷新重试' : '暂无任务，请导入工单清单'}</td></tr>`}</tbody></table></div><footer class="task-pagination"><span>共 ${state.total || 0} 条 · 第 ${state.filters.page} 页</span>${button('previous', '上一页', state.filters.page <= 1 ? 'disabled' : '')}${button('next', '下一页', state.filters.page * state.filters.pageSize >= (state.total || 0) ? 'disabled' : '')}</footer></div><section ${state.tab !== 'flow' ? 'hidden' : ''}><h2>${e(state.selected?.number || '流程流转')}</h2>${flow(state.selected)}</section>${ctx.canAdmin ? `<section ${state.tab !== 'config' ? 'hidden' : ''} class="document-task-config"><h2>任务配置</h2><form data-task-config><label>默认责任人${person('defaultOwnerId', ctx.config?.defaultOwnerId)}</label><p class="muted">只影响之后导入的新任务。</p><fieldset><legend>不涉及理由选项</legend>${(ctx.config?.reasonOptions || []).map(r => `<label>${e(r.id === "other" ? "其他" : r.label)}<input name="reasonLabel:${e(r.id)}" value="${e(r.label)}" required aria-label="${e(r.id)}理由名称"></label>`).join('')}</fieldset><button class="button">保存配置</button><span role="status"></span></form></section>` : ''}<div data-task-drawer-host></div><div data-task-modal-host></div></section>`;
    if (state.selected && state.tab === 'list') renderDrawer();
    cleanupSearchableSelects();
    markDynamicSelects(root);
    window.lucide?.createIcons();
  }
  function reasonText(value) { if (!value) return '待确认'; return `${state.context.config.reasonOptions.find(r => r.id === value.id)?.label || value.id}${value.detail ? `：${value.detail}` : ''}`; }
  function renderDrawer() {
    const t = state.selected, s = t.decomposition;
    root.querySelector('[data-task-drawer-host]').innerHTML = `<aside class="task-drawer" aria-label="任务详情"><header><div><h2>${e(t.number)}</h2><p>${e(t.description)}</p></div>${button('close', icon('x'), 'aria-label="关闭详情"')}</header><div class="task-drawer-body"><dl class="task-facts"><dt>责任人</dt><dd>${e(name(t.ownerId))} ${t.canAdmin ? button('owner', '改派') : ''}</dd><dt>状态</dt><dd>${e(labels[t.status])}</dd><dt>PingCode 状态</dt><dd>${e(t.sourceStatus || '未指定')}</dd><dt>来源责任人</dt><dd>${e(t.source?.sourceOwner || '未指定')}</dd><dt>来源创建时间</dt><dd>${e(t.sourceCreatedAt || '未指定')}</dd><dt>开始时间</dt><dd>${planCell(t, "plannedStartTime")}</dd><dt>结束时间</dt><dd>${planCell(t, "plannedEndTime")}</dd><dt>实际开始 / 完成</dt><dd>${timestamp(t.startTime)} / ${timestamp(t.endTime)}</dd></dl><section class="task-next-action"><h3>${icon('arrow-right')}下一步</h3>${t.nextAction ? `<a class="button primary" href="${e(t.nextAction.url)}">${e(t.nextAction.label)}</a>` : `<p>${e(t.pending[0] || '必要处理已完成')}</p>`}</section><section><div class="task-section-heading"><h3>处理范围</h3><span>${s.handbooks.filter(b => b.completed).length} / ${s.handbooks.length} 本手册完成</span></div><h3>工单范围</h3><p>${!s.confirmed ? '草稿 · 待责任人确认，尚未转交' : s.ticketImpact === 'not_involved' ? `不涉及 · ${e(reasonText(s.ticketReason))}` : `涉及 ${s.handbooks.length} 本手册`}</p>${t.canConfirm ? button('ticket-scope', '确认 / 调整手册范围') : ''}</section>${s.handbooks.map(b => `<section class="task-book"><div class="task-section-heading"><h3>${icon('book-open')}${e(b.name)}</h3>${b.canAssign ? button('book-owner', '改派手册责任人', `data-book="${e(b.id)}"`) : ''}</div><p>${e(name(b.ownerId))} · ${e(bookState(b, s))}</p>${b.canEdit ? button('book-scope', '确认 / 调整文档范围', `data-book="${e(b.id)}"`) : ''}${b.documents.map(d => `<div class="task-document"><div class="task-section-heading"><strong>${icon('file-text')}${e(d.name)}${d.kind === 'new' ? '<span class="task-kind">新增</span>' : ''}</strong>${d.canAssign ? button('document-owner', '改派文档责任人', `data-book="${e(b.id)}" data-doc="${e(d.id)}"`) : ''}</div><p>${e(name(d.ownerId))} · ${!s.confirmed || !b.confirmed ? '草稿未分派' : e(d.completion?.label || '待处理')}</p>${d.canEdit && b.confirmed ? `${d.writingUrl ? `<a class="button secondary" href="${e(d.writingUrl)}">进入编写</a>` : d.kind === 'new' ? button('new-document', '创建 / 关联新增文档', `data-book="${e(b.id)}" data-doc="${e(d.id)}"`) : ''}${button('link', '关联审核与交付', `data-book="${e(b.id)}" data-doc="${e(d.id)}"`)}` : ''}${d.reviewTaskId ? `<a href="/knowledge-center/review?taskId=${encodeURIComponent(d.reviewTaskId)}">查看审核</a>` : ''}${d.completion?.mergeRequest?.webUrl ? `<a href="${e(d.completion.mergeRequest.webUrl)}" target="_blank" rel="noopener noreferrer">查看 MR</a>` : ''}</div>`).join('')}</section>`).join('')}<section><h3>待办</h3><ul>${t.pending.map(p => `<li>${e(p)}</li>`).join('') || '<li>必要处理已完成</li>'}</ul>${t.canConfirm && t.pending.some(p => p.includes('确认') && p.includes('完成')) ? button('complete', '确认不涉及并完成') : ''}</section><details><summary>操作历史（${t.assignmentHistory.length}）</summary>${t.assignmentHistory.slice().reverse().map(a => `<article class="task-audit"><strong>${e(({ import: '导入', source_update: '来源更新', owner: '责任人改派', handbook_owner: '手册责任人改派', document_owner: '文档责任人改派', plan: '计划时间调整', ticket_scope: '工单范围', handbook_scope: '手册范围', review_link: '关联审核', new_document_prepare: '创建大纲候选', new_document_link: '关联新增文档', migration: '历史迁移', no_change_complete: '确认不涉及完成' })[a.type] || a.type)}</strong><p>${e(name(a.operatorId))} · ${timestamp(a.at)}${a.reason ? ' · ' + e(a.reason) : ''}</p><details><summary>变更内容</summary><pre>${e(JSON.stringify({ 原内容: a.previous, 新内容: a.next }, null, 2))}</pre></details></article>`).join('')}</details></div></aside>`;
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
      const action = doc.completion.recovery === 'revise_after_mr_closed' ? '修订并重新送审'
        : doc.completion.recovery === 'retry_delivery_readback' ? '核对正文与图片后重新回读'
          : doc.completion.recovery === 'scope_changed' ? '按当前范围重新送审' : '修订并重新送审';
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
        for (const duplicate of root.querySelectorAll(`.task-drawer [data-task-action="${t.nextAction.action}"]`)) {
          if (duplicate !== button && (!t.nextAction.handbookId || duplicate.dataset.book === t.nextAction.handbookId)
            && (!t.nextAction.documentId || duplicate.dataset.doc === t.nextAction.documentId)) duplicate.remove();
        }
      }
    }
    focusTaskWorkspace();
    window.lucide?.createIcons();
  }
  function focusTaskWorkspace() {
    const t = state.selected, books = t.decomposition.handbooks || [];
    const page = root.querySelector('.document-task-page');
    const workspace = root.querySelector('.task-drawer');
    const body = workspace.querySelector('.task-drawer-body');
    page.classList.add('task-focus-mode');
    workspace.classList.add('task-workspace');
    const preferred = books.find(book => book.canEdit && !book.confirmed)
      || books.find(book => book.canEdit)
      || books[0];
    if (!books.some(book => book.id === state.activeBookId)) state.activeBookId = preferred?.id || null;
    const active = books.find(book => book.id === state.activeBookId);
    page.dataset.taskRole = active?.ownerId === state.context.actorId && !t.canConfirm ? 'book' : 'ticket';
    const title = !t.decomposition.confirmed && t.canConfirm ? '确认涉及的手册，并交给负责人'
      : active?.canEdit && !active.confirmed ? '确定本手册涉及的文档'
        : t.nextAction?.label || '查看任务进度';
    const heading = workspace.querySelector('header > div');
    heading.insertAdjacentHTML('afterbegin', `<span class="task-workspace-eyebrow">${e(t.number)} / ${active?.canEdit ? '手册任务' : t.canConfirm ? '工单任务' : '任务进度'}</span>`);
    heading.querySelector('h2').textContent = title;
    heading.querySelector('p').classList.add('task-workspace-description');
    heading.insertAdjacentHTML('beforeend', `<span class="task-workspace-owner">${page.dataset.taskRole === 'book' ? '手册负责人' : '责任人'} ${e(name(page.dataset.taskRole === 'book' ? active.ownerId : t.ownerId))} · ${e(labels[t.status])}</span>`);
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
      scope.querySelector(':scope > h3')?.remove();
    }
    const bookNodes = [...body.querySelectorAll(':scope > .task-book')];
    if (books.length) {
      const nav = document.createElement('nav');
      nav.className = 'task-book-switcher';
      nav.setAttribute('aria-label', '选择手册任务');
      nav.innerHTML = books.map(book => `<button type="button" data-task-book-select="${e(book.id)}" aria-pressed="${book.id === state.activeBookId}"><strong>${e(book.name)}</strong><span>${e(name(book.ownerId))} · ${e(book.confirmed ? book.completed ? '已完成' : '处理中' : '待确认')}</span></button>`).join('');
      scope?.after(nav);
      bookNodes.forEach((node, index) => { node.hidden = books[index].id !== state.activeBookId; });
    }
    const completed = books.filter(book => book.completed).length;
    const progress = document.createElement('div');
    progress.className = 'task-workspace-progress';
    progress.setAttribute('aria-label', '任务流转进度');
    progress.innerHTML = `<span>${icon('list-checks')} 工单分派 <strong>${t.decomposition.confirmed ? '已确认' : '待确认'}</strong></span><span>${icon('book-open')} 手册范围 <strong>${books.filter(book => book.confirmed).length}/${books.length}</strong></span><span>${icon('file-text')} 文档处理 <strong>${completed}/${books.length} 本完成</strong></span>`;
    action.after(progress);
    const pending = [...body.querySelectorAll(':scope > section')].find(section => section.querySelector(':scope > h3')?.textContent === '待办');
    if (pending) { pending.classList.add('task-workspace-pending'); pending.querySelector('h3').textContent = '待处理'; }
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
  function modal(title, content, onSubmit, { confirm = true, confirmLabel = '确认', inline = false } = {}) {
    const host = root.querySelector('[data-task-modal-host]');
    if (inline) root.querySelector('.task-book:not([hidden])')?.append(host);
    host.innerHTML = `<dialog class="document-task-dialog" aria-label="${e(title)}"><form><header><h2>${e(title)}</h2><button type="button" data-modal-close class="icon-button" aria-label="关闭">${icon('x')}</button></header><div class="task-modal-body">${content}</div><p role="alert" data-modal-error hidden></p><footer><span role="status" data-modal-status></span><button type="button" class="button secondary" data-modal-close>取消</button>${confirm ? `<button class="button" value="confirm">${e(confirmLabel)}</button>` : ''}</footer></form></dialog>`;
    const dialog = host.querySelector('dialog');
    if (inline) { dialog.classList.add('task-inline-dialog'); dialog.show(); dialog.scrollIntoView({ block: 'nearest' }); }
    else dialog.showModal();
    markDynamicSelects(dialog); window.lucide?.createIcons();
    dialog.querySelectorAll('[data-modal-close]').forEach(b => b.onclick = () => dialog.close());
    dialog.addEventListener('close', async () => {
      if (dialog.dataset.scopeChangeId && dialog.dataset.scopeConfirmed !== 'true') {
        try {
          const current = await loadDocumentTask(state.selected.number);
          await taskWrite(`/${encodeURIComponent(current.number)}/scope-changes/${encodeURIComponent(dialog.dataset.scopeChangeId)}/cancel`, { expectedRevision: current.revision, reason: '用户取消范围纠偏预览' }, 'POST');
          await refresh();
        } catch (error) { status(`范围纠偏取消失败：${error.message}`); }
      }
      dialog.remove(); cleanupSearchableSelects();
    });
    dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault(); const message = dialog.querySelector('[data-modal-error]'); message.hidden = true;
      const buttons = [...dialog.querySelectorAll('button')]; buttons.forEach(b => b.disabled = true);
      dialog.querySelector('[data-modal-status]').textContent = '正在保存…';
      try { const confirmed = event.submitter?.value === 'confirm'; const result = await onSubmit(new FormData(event.currentTarget), confirmed); if (result?.keepOpen) return; dialog.dataset.scopeConfirmed = dialog.dataset.scopeChangeId ? 'true' : dialog.dataset.scopeConfirmed; dialog.close(); try { await refresh(); status('已保存'); } catch (error) { status('已保存，刷新失败，请重新读取：' + error.message); } }
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
      confirmButton.textContent = impact === 'not_involved' ? '确认不涉及' : dialog.dataset.scopeLevel === 'handbook' ? '确认手册范围' : '确认文档范围';
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
      const change = await taskWrite(endpoint, { expectedRevision: current.revision, level, handbookId, reason, affectedDocuments }, 'POST');
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
      summary.innerHTML = `<h3>变更影响预览</h3><p>${preview.items.length ? preview.items.map(item => `${e(item.operation === 'withdraw' ? '撤出' : item.operation === 'add' ? '新增' : '调整')} ${e(item.documentId)} · MR ${e(item.mrState || '未创建')}${item.canConfirm ? '' : ` · ${e(item.nextAction === 'close_mr_manually' ? '需人工关闭 MR' : '需刷新状态')}`}`).join('<br>') : '没有文档范围变化'}</p>${preview.canConfirm ? '<p>确认后受影响文档按新范围重新计算。</p>' : '<p role="alert">当前不能确认。先处理上方列出的 MR 状态，再重新打开范围调整。</p>'}`;
      dialog.querySelector('.task-modal-body').append(summary);
      dialog.dataset.scopeCanConfirm = String(preview.canConfirm);
      dialog.querySelector('button[value=confirm]').textContent = preview.canConfirm ? '确认范围变更' : '重新预览';
      return { keepOpen: true };
    }
    const current = await loadDocumentTask(task.number);
    const result = await taskWrite(`${endpoint}/${encodeURIComponent(dialog.dataset.scopeChangeId)}/confirm`, { expectedRevision: current.revision, proposed, impactDigest: dialog.dataset.impactDigest }, 'POST');
    dialog.dataset.scopeConfirmed = 'true';
    return result;
  }
  function ticketScope() {
    const t = state.selected, s = t.decomposition;
    const reasonField = s.confirmed ? '<label>范围调整原因<textarea name="scopeChangeReason" required rows="2" placeholder="说明为什么需要增减手册"></textarea></label>' : '';
    const dialog = modal('选择涉及的手册', `${s.confirmed ? '<p>已分派范围需要先预览影响，再确认变更。</p>' : ''}${reasonField}${decision(s.ticketImpact, s.ticketReason)}<div data-involved><label>搜索手册<input type="search" data-scope-search></label><p data-selected-count></p><div class="task-choices">${state.context.handbooks.map(b => { const old = s.handbooks.find(x => x.id === b.id); const candidate = old?.ownerId || b.ownerId; const valid = state.context.people.some(p => p.id === candidate) ? candidate : null; return `<div data-choice><label><input type="checkbox" name="selected" value="${e(b.id)}" ${old ? 'checked' : ''}>${e(b.name)}</label>${person(`owner:${b.id}`, valid)}</div>`; }).join('')}</div></div>`, async (form, confirm) => {
      const proposed = { ticketImpact: form.get('impact'), reasonId: form.get('reasonId'), reasonDetail: form.get('reasonDetail'), handbooks: form.getAll('selected').map(id => ({ id, ownerId: form.get(`owner:${id}`) })) };
      if (s.confirmed) return saveScopeWithPreview(form, dialog, t, 'ticket', null, proposed);
      return taskWrite(`/${encodeURIComponent(t.number)}/decomposition`, { expectedRevision: t.revision, confirm, ...proposed, reason: form.get('reason') });
    });
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
    if (reading) return;
    const tab = event.target.closest('[data-task-tab]'); if (tab) { state.tab = tab.dataset.taskTab; render(); return; }
    const bookSwitch = event.target.closest('[data-task-book-select]');
    if (bookSwitch && state.selected) { state.activeBookId = bookSwitch.dataset.taskBookSelect; renderDrawer(); root.querySelector(`[data-task-book-select="${CSS.escape(state.activeBookId)}"]`)?.focus(); return; }
    const row = event.target.closest('[data-task-open]');
    try {
      if (row) { state.selected = await readWithFeedback(() => loadDocumentTask(row.dataset.taskOpen)); state.activeBookId = null; renderDrawer(); root.querySelector('.task-drawer button')?.focus(); return; }
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
        case 'import': root.querySelector('[data-task-file]').click(); break;
        case 'close': state.selected = null; render(); break;
        case 'previous': state.filters.page--; await refresh({ detail: false }); break;
        case 'next': state.filters.page++; await refresh({ detail: false }); break;
        case 'ticket-scope': ticketScope(); break;
        case 'book-scope': await readWithFeedback(() => bookScope(id)); break;
        case 'show-flow': state.tab = 'flow'; render(); root.querySelector('[data-task-drawer-host]').innerHTML = ''; break;
        case 'book-owner':
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
    if (event.target.matches('[data-task-filters]')) { event.preventDefault(); state.filters = { ...Object.fromEntries(new FormData(event.target)), page: 1, pageSize: 20 }; try { await refresh({ detail: false }); } catch (error) { status(error.message, true); } }
    if (event.target.matches('[data-task-config]')) { event.preventDefault(); const output = event.target.querySelector('[role=status]'); try { const form = new FormData(event.target); state.context.config = await taskWrite('/config', { defaultOwnerId: form.get('defaultOwnerId'), reasonOptions: state.context.config.reasonOptions.map(r => ({ id: r.id, label: form.get('reasonLabel:' + r.id) })), expectedRevision: state.context.config.revision }); output.textContent = '配置已保存'; } catch (error) { output.textContent = error.message; } }
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
