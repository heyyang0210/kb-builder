import { taskOperationId } from '../../common/api/document-tasks-api.js';
import { loadDocumentTasks, loadDocumentTask, taskRequest, taskWrite, importDocumentTasks } from '../../common/api/document-tasks-api.js';
import { escapeHtml, icon } from '../../common/utils/dom.js';
import { planCell, openPlanCalendar } from './plan-calendar.js';
const e = value => escapeHtml(String(value ?? ''));
const labels = { pending_scope: '待处理', in_progress: '处理中', completed: '已完成' };
const timestamp = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
export async function loadDocumentTaskWorkspace() {
  try { const [list, context] = await Promise.all([loadDocumentTasks(), taskRequest('/context')]); return { status: 'ok', ...list, context }; }
  catch (error) { return { status: 'unavailable', items: [], error: { message: error.message } }; }
}
export function renderDocumentTasks({ documentTaskProjection }) {
  const root = document.querySelector('#view-root');
  const state = { ...documentTaskProjection, tab: 'list', selected: null, filters: { page: 1, pageSize: 20 }, preview: null, file: null };
  const name = id => state.context?.people.find(p => p.id === id)?.displayName || id || '待指派';
  const options = (items, selected, blank = '请选择') => `<option value="">${blank}</option>${items.map(p => `<option value="${e(p.id)}" ${p.id === selected ? 'selected' : ''}>${e(p.displayName || p.name)}</option>`).join('')}`;
  const person = (field, selected) => `<select name="${e(field)}" aria-label="责任人">${options(state.context?.people || [], selected)}</select>`;
  const button = (action, text, extra = '') => `<button type="button" class="button secondary" data-task-action="${action}" ${extra}>${text}</button>`;
  const status = (message, isError = false) => { const node = root.querySelector('[data-task-message]'); if (node) { node.textContent = message; node.hidden = !message; node.setAttribute('role', isError ? 'alert' : 'status'); } };
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
    root.innerHTML = `<section class="document-task-page"><header class="document-task-page-header"><h1>任务管理</h1><div class="document-task-actions">${button('refresh', icon('refresh-cw') + '刷新')}${ctx.canAdmin ? button('import', icon('upload') + '导入工单') : ''}<input type="file" accept=".json,.xlsx" hidden data-task-file></div></header><p role="alert" data-task-message ${state.error ? '' : 'hidden'}>${e(state.error?.message)}</p><nav class="document-task-tabs" aria-label="任务管理视图">${[['list', '任务列表'], ['flow', '流程流转'], ...(ctx.canAdmin ? [['config', '任务配置']] : [])].map(([id, label]) => `<button data-task-tab="${id}" class="${state.tab === id ? 'active' : ''}" aria-selected="${state.tab === id}">${label}</button>`).join('')}</nav><div data-task-list ${state.tab !== 'list' ? 'hidden' : ''}><form class="document-task-toolbar" data-task-filters><label class="task-search">${icon('search')}<input name="q" aria-label="搜索编号或描述" placeholder="搜索编号或描述" value="${e(state.filters.q)}"></label><select name="ownerId" aria-label="责任人筛选">${options(ctx.people || [], state.filters.ownerId, '全部责任人')}</select><select name="product" aria-label="产品筛选">${options((state.filterOptions?.product || []).map(v => ({ id: v, name: v })), state.filters.product, "全部产品")}</select><select name="version" aria-label="版本筛选">${options((state.filterOptions?.version || []).map(v => ({ id: v, name: v })), state.filters.version, "全部版本")}</select><select name="status" aria-label="状态筛选"><option value="">全部状态</option>${Object.entries(labels).map(([id, label]) => `<option value="${id}" ${state.filters.status === id ? 'selected' : ''}>${label}</option>`).join('')}</select><button class="button secondary">筛选</button></form><div class="document-task-table-wrap"><table class="document-task-table"><thead><tr>${['编号', '描述', '责任人', '产品', '版本', '状态', '开始时间', '结束时间', '输出件/说明', '来源'].map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${(state.items || []).map(t => `<tr><td><button class="task-number" data-task-open="${e(t.number)}">${e(t.number)}</button></td><td>${e(t.description)}</td><td>${e(t.ownerName)}</td><td>${e(t.product || '未指定')}</td><td>${e(t.version || '未指定')}</td><td><span class="document-task-status ${t.status}">${e(labels[t.status])}</span></td><td>${planCell(t, "plannedStartTime")}</td><td>${planCell(t, "plannedEndTime")}</td><td>${e(t.output || '—')}</td><td>${t.sourceUrl ? `<a href="${e(t.sourceUrl)}" target="_blank" rel="noopener noreferrer">PingCode ${icon('external-link')}</a>` : '—'}</td></tr>`).join('') || `<tr><td colspan="10">${state.status === 'loading' ? '正在读取任务…' : state.error ? '任务读取失败，请点击刷新重试' : '暂无任务，请导入工单清单'}</td></tr>`}</tbody></table></div><footer class="task-pagination"><span>共 ${state.total || 0} 条 · 第 ${state.filters.page} 页</span>${button('previous', '上一页', state.filters.page <= 1 ? 'disabled' : '')}${button('next', '下一页', state.filters.page * state.filters.pageSize >= (state.total || 0) ? 'disabled' : '')}</footer></div><section ${state.tab !== 'flow' ? 'hidden' : ''}><h2>${e(state.selected?.number || '流程流转')}</h2>${flow(state.selected)}</section>${ctx.canAdmin ? `<section ${state.tab !== 'config' ? 'hidden' : ''} class="document-task-config"><h2>任务配置</h2><form data-task-config><label>默认责任人${person('defaultOwnerId', ctx.config?.defaultOwnerId)}</label><p class="muted">只影响之后导入的新任务。</p><fieldset><legend>不涉及理由选项</legend>${(ctx.config?.reasonOptions || []).map(r => `<label>${e(r.id === "other" ? "其他" : r.label)}<input name="reasonLabel:${e(r.id)}" value="${e(r.label)}" required aria-label="${e(r.id)}理由名称"></label>`).join('')}</fieldset><button class="button">保存配置</button><span role="status"></span></form></section>` : ''}<div data-task-drawer-host></div><div data-task-modal-host></div></section>`;
    if (state.selected && state.tab === 'list') renderDrawer();
    window.lucide?.createIcons();
  }
  function reasonText(value) { if (!value) return '待确认'; return `${state.context.config.reasonOptions.find(r => r.id === value.id)?.label || value.id}${value.detail ? `：${value.detail}` : ''}`; }
  function renderDrawer() {
    const t = state.selected, s = t.decomposition;
    root.querySelector('[data-task-drawer-host]').innerHTML = `<aside class="task-drawer" aria-label="任务详情"><header><div><h2>${e(t.number)}</h2><p>${e(t.description)}</p></div>${button('close', icon('x'), 'aria-label="关闭详情"')}</header><div class="task-drawer-body"><dl class="task-facts"><dt>责任人</dt><dd>${e(name(t.ownerId))} ${t.canAdmin ? button('owner', '改派') : ''}</dd><dt>状态</dt><dd>${e(labels[t.status])}</dd><dt>PingCode 状态</dt><dd>${e(t.sourceStatus || '未指定')}</dd><dt>来源责任人</dt><dd>${e(t.source?.sourceOwner || '未指定')}</dd><dt>来源创建时间</dt><dd>${e(t.sourceCreatedAt || '未指定')}</dd><dt>开始时间</dt><dd>${planCell(t, "plannedStartTime")}</dd><dt>结束时间</dt><dd>${planCell(t, "plannedEndTime")}</dd><dt>实际开始 / 完成</dt><dd>${timestamp(t.startTime)} / ${timestamp(t.endTime)}</dd></dl><section class="task-next-action"><h3>${icon('arrow-right')}下一步</h3><p>${e(t.pending[0] || '必要处理已完成')}</p>${button('show-flow', '查看流程')}</section><section><div class="task-section-heading"><h3>处理范围</h3><span>${s.handbooks.filter(b => b.completed).length} / ${s.handbooks.length} 本手册完成</span></div><h3>工单范围</h3><p>${!s.confirmed ? '草稿 · 待责任人确认，尚未转交' : s.ticketImpact === 'not_involved' ? `不涉及 · ${e(reasonText(s.ticketReason))}` : `涉及 ${s.handbooks.length} 本手册`}</p>${t.canConfirm ? button('ticket-scope', '确认 / 调整工单范围') : ''}</section>${s.handbooks.map(b => `<section class="task-book"><div class="task-section-heading"><h3>${icon('book-open')}${e(b.name)}</h3>${b.canAssign ? button('book-owner', '改派手册责任人', `data-book="${e(b.id)}"`) : ''}</div><p>${e(name(b.ownerId))} · ${e(bookState(b, s))}</p>${b.canEdit ? button('book-scope', '确认 / 调整文档范围', `data-book="${e(b.id)}"`) : ''}${b.documents.map(d => `<div class="task-document"><div class="task-section-heading"><strong>${icon('file-text')}${e(d.name)}${d.kind === 'new' ? '<span class="task-kind">新增</span>' : ''}</strong>${d.canAssign ? button('document-owner', '改派文档责任人', `data-book="${e(b.id)}" data-doc="${e(d.id)}"`) : ''}</div><p>${e(name(d.ownerId))} · ${!s.confirmed || !b.confirmed ? '草稿未分派' : e(d.completion?.label || '待处理')}</p>${d.canEdit && b.confirmed ? `${d.writingUrl ? `<a class="button secondary" href="${e(d.writingUrl)}">进入编写</a>` : d.kind === 'new' ? button('new-document', '创建 / 关联新增文档', `data-book="${e(b.id)}" data-doc="${e(d.id)}"`) : ''}${button('link', '关联审核与交付', `data-book="${e(b.id)}" data-doc="${e(d.id)}"`)}` : ''}${d.reviewTaskId ? `<a href="/knowledge-center/review?taskId=${encodeURIComponent(d.reviewTaskId)}">查看审核</a>` : ''}${d.completion?.mergeRequest?.webUrl ? `<a href="${e(d.completion.mergeRequest.webUrl)}" target="_blank" rel="noopener noreferrer">查看 MR</a>` : ''}</div>`).join('')}</section>`).join('')}<section><h3>待办</h3><ul>${t.pending.map(p => `<li>${e(p)}</li>`).join('') || '<li>必要处理已完成</li>'}</ul>${t.canConfirm && t.pending.some(p => p.includes('确认') && p.includes('完成')) ? button('complete', '确认不涉及并完成') : ''}</section><details><summary>操作历史（${t.assignmentHistory.length}）</summary>${t.assignmentHistory.slice().reverse().map(a => `<article class="task-audit"><strong>${e(({ import: '导入', source_update: '来源更新', owner: '责任人改派', handbook_owner: '手册责任人改派', document_owner: '文档责任人改派', plan: '计划时间调整', ticket_scope: '工单范围', handbook_scope: '手册范围', review_link: '关联审核', new_document_prepare: '创建大纲候选', new_document_link: '关联新增文档', migration: '历史迁移', no_change_complete: '确认不涉及完成' })[a.type] || a.type)}</strong><p>${e(name(a.operatorId))} · ${timestamp(a.at)}${a.reason ? ' · ' + e(a.reason) : ''}</p><details><summary>变更内容</summary><pre>${e(JSON.stringify({ 原内容: a.previous, 新内容: a.next }, null, 2))}</pre></details></article>`).join('')}</details></div></aside>`;
    window.lucide?.createIcons();
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
  function modal(title, content, onSubmit, { confirm = true, secondary = false, confirmLabel = '确认' } = {}) {
    const host = root.querySelector('[data-task-modal-host]');
    host.innerHTML = `<dialog class="document-task-dialog" aria-label="${e(title)}"><form><header><h2>${e(title)}</h2><button type="button" data-modal-close class="icon-button" aria-label="关闭">${icon('x')}</button></header><div class="task-modal-body">${content}</div><p role="alert" data-modal-error hidden></p><footer><span role="status" data-modal-status></span><button type="button" class="button secondary" data-modal-close>取消</button>${secondary ? '<button class="button secondary" value="draft">保存草稿</button>' : ''}${confirm ? '<button class="button" value="confirm">${e(confirmLabel)}</button>' : ''}</footer></form></dialog>`;
    const dialog = host.querySelector('dialog'); dialog.showModal(); window.lucide?.createIcons();
    dialog.querySelectorAll('[data-modal-close]').forEach(b => b.onclick = () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault(); const message = dialog.querySelector('[data-modal-error]'); message.hidden = true;
      const buttons = [...dialog.querySelectorAll('button')]; buttons.forEach(b => b.disabled = true);
      dialog.querySelector('[data-modal-status]').textContent = '正在保存…';
      try { const confirmed = event.submitter?.value === 'confirm'; await onSubmit(new FormData(event.currentTarget), confirmed); dialog.close(); try { await refresh(); status(confirmed ? '已保存' : '草稿已保存，尚未转交下级责任人'); } catch (error) { status('已保存，刷新失败，请重新读取：' + error.message); } }
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
    choices.insertAdjacentHTML('beforebegin', `<div class="task-choice-heading"><span>${level === 'handbook' ? '手册' : '文档'}</span><span>${level === 'handbook' ? '手册负责人' : '文档负责人'}</span></div>`);
    choices.insertAdjacentHTML('afterend', '<p class="task-assignment-hint" role="status" data-assignment-hint></p>');
    const footer = dialog.querySelector('footer');
    footer.insertAdjacentHTML('afterbegin', `<span class="task-scope-footer-note">${level === 'handbook' ? '确认后由各手册负责人继续选择文档' : '每篇文档由一名责任人处理'}</span>`);
    const why = dialog.querySelector('[name=reason]')?.closest('label');
    if (why) { const details = document.createElement('details'); details.className = 'task-reassign-note'; details.innerHTML = '<summary>需要调整已有负责人</summary>'; why.before(details); details.append(why); }
  }
  function bindScope(dialog) {
    const update = () => {
      const impact = dialog.querySelector('[name=impact]:checked')?.value;
      const confirmButton = dialog.querySelector('button[value=confirm]');
      confirmButton.textContent = impact === 'not_involved' ? '确认不涉及' : dialog.dataset.scopeLevel === 'handbook' ? '确认转交' : '确认分派';
      const impactStep = dialog.querySelector('[data-scope-step="0"]');
      if (impactStep && dialog.querySelector('[data-scope-step="1"][aria-current]')) { impactStep.classList.toggle('done', Boolean(impact)); impactStep.querySelector('span').textContent = impact ? '✓' : '1'; }
      dialog.querySelector('[data-reasons]').hidden = impact !== 'not_involved';
      dialog.querySelector('[data-involved]').hidden = impact !== 'involved';
      dialog.querySelector('[data-other]').hidden = dialog.querySelector('[name=reasonId]').value !== 'other';
      dialog.querySelectorAll('[data-choice]').forEach(row => { const filter = dialog.querySelector('[data-scope-search]').value.trim().toLowerCase(); row.hidden = filter && !row.textContent.toLowerCase().includes(filter); });
      const selected = [...dialog.querySelectorAll('[name=selected]:checked')];
      dialog.querySelector('[data-selected-count]').textContent = `已选 ${selected.length} 项`;
      dialog.querySelectorAll('[data-choice]').forEach(row => { const checked = row.querySelector('[name=selected]').checked; row.classList.toggle('selected', checked); row.querySelector('select').disabled = !checked; });
      const unassigned = selected.filter(input => !input.closest('[data-choice]').querySelector('select').value).length;
      const hint = dialog.querySelector('[data-assignment-hint]');
      if (hint) { hint.textContent = selected.length ? unassigned ? `还有 ${unassigned} 项待指派负责人` : '✓ 已选项负责人均已设置' : '请选择处理范围并逐项指派负责人'; hint.classList.toggle('complete', selected.length > 0 && !unassigned); }

    };
    dialog.addEventListener('change', update); dialog.querySelector('[data-scope-search]').addEventListener('input', update); update();
  }
  function ticketScope() {
    const t = state.selected, s = t.decomposition;
    const dialog = modal('选择涉及的手册', `${decision(s.ticketImpact, s.ticketReason)}<div data-involved><label>搜索手册<input type="search" data-scope-search></label><p data-selected-count></p><div class="task-choices">${state.context.handbooks.map(b => { const old = s.handbooks.find(x => x.id === b.id); return `<div data-choice><label><input type="checkbox" name="selected" value="${e(b.id)}" ${old ? 'checked' : ''}>${e(b.name)}</label>${person(`owner:${b.id}`, old?.ownerId)}</div>`; }).join('')}</div></div>`, async (form, confirm) => taskWrite(`/${encodeURIComponent(t.number)}/decomposition`, { expectedRevision: t.revision, confirm, ticketImpact: form.get('impact'), reasonId: form.get('reasonId'), reasonDetail: form.get('reasonDetail'), reason: form.get('reason'), handbooks: form.getAll('selected').map(id => ({ id, ownerId: form.get(`owner:${id}`) })) }), { secondary: true });
    decorateScope(dialog, t, 'handbook');
    bindScope(dialog);
  }
  async function bookScope(id) {
    const t = state.selected, book = t.decomposition.handbooks.find(b => b.id === id), catalog = await taskRequest(`/catalog?handbookId=${encodeURIComponent(id)}`);
    let newDocs = book.documents.filter(d => d.kind === 'new').map(d => ({ ...d }));
    const choices = docs => docs.map(d => { const old = book.documents.find(x => x.id === d.id); return `<div data-choice><label><input type="checkbox" name="selected" value="${e(d.id)}" ${old || d.kind === 'new' ? 'checked' : ''}>${e(d.name)}${d.kind === 'new' ? '（新增）' : ''}</label>${person(`owner:${d.id}`, old?.ownerId || d.ownerId)}</div>`; }).join('');
    const dialog = modal(`${book.name} · 文档范围`, `${decision(book.impact, book.reason)}<div data-involved><label>目标版本<select name="targetVersion">${options(catalog.versions.map(v => ({ id: v, name: v })), book.targetVersion)}</select></label><label>搜索文档<input type="search" data-scope-search></label><p data-selected-count></p><div class="task-choices">${choices(catalog.documents)}<div data-new-choices>${choices(newDocs)}</div></div><details><summary>在章节下提出新增文档</summary><label>所属章节<select name="parentId">${options(catalog.chapters)}</select></label><label>文档名称<input name="newName"></label><button type="button" class="button secondary" data-add-new>加入选择</button></details></div>`, async (form, confirm) => taskWrite(`/${encodeURIComponent(t.number)}/handbooks/${encodeURIComponent(id)}`, { expectedRevision: t.revision, confirm, impact: form.get('impact'), reasonId: form.get('reasonId'), reasonDetail: form.get('reasonDetail'), reason: form.get('reason'), targetVersion: form.get('targetVersion'), documents: form.getAll('selected').map(key => ({ ...(newDocs.find(d => d.id === key) || { id: key, kind: 'existing' }), ownerId: form.get(`owner:${key}`) })) }), { secondary: true });
    dialog.querySelector('[data-add-new]').onclick = () => {
      const title = dialog.querySelector('[name=newName]').value.trim(), parentId = dialog.querySelector('[name=parentId]').value;
      if (!title || !parentId) { dialog.querySelector('[data-modal-error]').textContent = '请选择章节并填写文档名称'; dialog.querySelector('[data-modal-error]').hidden = false; return; }
      const doc = { id: taskOperationId(), kind: 'new', name: title, parentId }; newDocs.push(doc); dialog.querySelector('[data-new-choices]').insertAdjacentHTML('beforeend', choices([doc])); dialog.querySelector('[name=newName]').value = ''; dialog.dispatchEvent(new Event('change'));
    };
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
    const row = event.target.closest('[data-task-open]');
    try {
      if (row) { state.selected = await readWithFeedback(() => loadDocumentTask(row.dataset.taskOpen)); renderDrawer(); root.querySelector('.task-drawer button')?.focus(); return; }
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
}
