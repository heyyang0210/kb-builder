import { escapeHtml as esc, icon } from '../../common/utils/dom.js';
import { uiIcon, uiIconButton } from '../../common/ui-system.js';
import { renderSourceRecord } from '../../common/safe-source-markdown.js';

const base = '/knowledge-center/api/platform/plugins/pingcode';
const typeLabel = type => type === 'REQUIREMENT' ? '需求基线' : '工单视图';
const actionLabel = { created: '新增', updated: '更新', unchanged: '未变化', removed: '来源移除' };
const failureLabel = code => code === 'PINGCODE_RELATION_INCOMPLETE'
  ? '关联工作项不完整，本次未生成预览' : code;

async function request(path, options = {}) {
  const response = await fetch(base + path, { credentials: 'same-origin', cache: 'no-store', ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) throw Object.assign(
    new Error(body?.error?.message || 'Pingcode 插件服务暂不可用'),
    { code: body?.error?.code, status: response.status });
  return body.data;
}
function createIdempotencyKey() {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues !== 'function') throw new Error('当前浏览器不支持安全的请求标识生成');
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const post = body => ({ method: 'POST', headers: { 'Idempotency-Key': createIdempotencyKey() }, body: JSON.stringify(body) });

export function mountPingcodeSync(root) {
  if (!root || root.dataset.mounted) return;
  root.dataset.mounted = 'true';
  const state = { sources: [], sourcesState: 'loading', sourceError: '', selected: null,
    addDialogOpen: false, editDialogOpen: false, deleteDialogOpen: false, search: '', type: 'all', productType: 'all', enabled: 'all', runs: [], run: null, preview: null,
    view: 'created', page: 1, decisions: {}, missing: null,
    workspaceSource: null, workspaceItems: null, workspaceItem: null, workspaceLoading: false, workspaceError: '', workspacePage: 1, pageView: 'workspace', diffQuery: '', diffIr: '', diffConflictCount: 0, returnToDiff: false,
    runItems: null, runSnapshot: null, unlinkedIrs: null, workspacePane: 'list', syncing: false, unlinkedIrWarning: '',
    busy: false, message: '', error: '' };
  let timer = null, resourceTimer = null, unlinkedWarningTimer = null, generation = 0, sourceRequest = 0;
  const selectedId = () => state.selected?.id;
  const busy = value => { state.busy = value; root.setAttribute('aria-busy', String(value)); };
  const stop = () => {
    generation++; clearTimeout(timer); clearTimeout(resourceTimer); clearTimeout(unlinkedWarningTimer);
    timer = null; resourceTimer = null; unlinkedWarningTimer = null;
    state.unlinkedIrWarning = '';
  };
  const showUnlinkedIrWarning = count => {
    clearTimeout(unlinkedWarningTimer);
    unlinkedWarningTimer = null;
    const total = Number(count || 0);
    state.message = ''; state.error = '';
    state.unlinkedIrWarning = total > 0 ? `${total} 条需求暂未关联工单，已跳过，不影响本次同步。` : '';
  };
  const scheduleUnlinkedWarningHide = () => {
    if (!state.unlinkedIrWarning || unlinkedWarningTimer) return;
    unlinkedWarningTimer = setTimeout(() => {
      state.unlinkedIrWarning = ''; unlinkedWarningTimer = null; render();
    }, 3000);
  };
  const showToast = (message, error = false) => {
    clearTimeout(unlinkedWarningTimer); unlinkedWarningTimer = null;
    state.unlinkedIrWarning = '';
    state.error = error ? String(message) : ''; state.message = error ? '' : String(message);
    render();
  };
  const showError = value => showToast(value?.message || String(value), true);

  function renderPreview() {
    const rows = state.preview?.items || [], total = Number(state.preview?.total || 0), run = state.run;
    if (!run || !['AWAITING_CONFIRM', 'CONFIRMED', 'CONFIRMED_MISSING_IMAGES'].includes(run.status)) return '';
    const categories = [
      ['created', '新增', Number(run.newCount || 0)],
      ['updated', '更新', Number(run.changedCount || 0)],
      ['removed', '移除', Number(run.removedCount || 0)],
      ['conflicts', '来源冲突', Number(state.diffConflictCount || 0)],
    ];
    const query = state.diffQuery.trim().toLocaleLowerCase();
    const visibleRows = rows.filter(row => (!query || `${row.number} ${row.title || row.previousTitle || ''} ${(row.ir || []).join(' ')}`.toLocaleLowerCase().includes(query))
      && (!state.diffIr || (row.ir || []).includes(state.diffIr)));
    const irs = [...new Set(rows.flatMap(row => row.ir || []))].sort();
    return `<section class="pingcode-sync-page pingcode-diff-page" aria-label="同步任务变化">
      <header class="pingcode-diff-header"><div><p>PingCode 同步结果</p><h3>同步任务变化 <span class="pingcode-run-status" data-status="${esc(run.status)}">${run.status === 'AWAITING_CONFIRM' ? '待确认' : '已确认'}</span></h3><div class="pingcode-diff-meta"><span>来源：${esc(state.workspaceSource?.name || state.selected?.name || '—')}</span><span>完成时间：${esc(run.finishedAt ? new Date(run.finishedAt).toLocaleString('zh-CN', { hour12: false }) : '—')}</span><span>运行编号：${esc(run.id)}</span></div></div>
        <div class="pingcode-page-actions"><button type="button" class="button secondary" data-pc-diff-back>${uiIcon('action.back')}返回同步工作区</button>${run.status === 'AWAITING_CONFIRM' ? `<button type="button" class="button primary" data-pc-confirm ${state.busy ? 'disabled' : ''}>同步任务列表</button>` : ''}</div></header>
      <div class="pingcode-sync-feedback" ${state.message || state.error ? '' : 'hidden'}><p class="pingcode-sync-message ${state.error ? 'is-error' : ''}" role="${state.error ? 'alert' : 'status'}" aria-live="polite">${esc(state.error || state.message)}</p><button type="button" class="icon-button" data-pc-dismiss-message aria-label="关闭提示">${uiIcon('action.close')}</button></div>
      ${state.workspaceError ? `<div class="pingcode-sync-feedback"><p class="pingcode-sync-message is-error" role="alert">${esc(state.workspaceError)}</p><button type="button" class="icon-button" data-pc-dismiss-workspace-error aria-label="关闭提示">${uiIcon('action.close')}</button></div>` : ''}
      ${state.unlinkedIrs?.total ? `<details class="pingcode-unlinked-irs"><summary>未关联 IR（${Number(state.unlinkedIrs.total)}）</summary><p>PingCode 结构化关系接口返回空列表，表示这些 IR 尚无关联 SR，已跳过且不影响本次同步。</p><ul>${state.unlinkedIrs.items.map(number => `<li><code>${esc(number)}</code></li>`).join('')}</ul></details>` : ''}
      <section class="pingcode-preview" aria-label="与当前任务快照的差异"><header><h4>与当前任务快照的差异</h4><div class="pingcode-preview-tabs" role="tablist" aria-label="差异分类">${categories.map(([key, label, count]) => `<button type="button" role="tab" aria-selected="${state.view === key}" data-pc-view="${key}">${label} <span>${count}</span></button>`).join('')}</div></header>
        <div class="pingcode-diff-filters"><label class="pingcode-search">${icon('search')}<span class="sr-only">搜索任务变化</span><input type="search" data-pc-diff-search value="${esc(state.diffQuery)}" placeholder="搜索编号、标题或 IR"></label><label>IR<select data-pc-diff-ir><option value="">全部 IR</option>${irs.map(ir => `<option value="${esc(ir)}" ${state.diffIr === ir ? 'selected' : ''}>${esc(ir)}</option>`).join('')}</select></label><span>本页 <b data-pc-diff-result-count>${visibleRows.length}</b> 项</span></div>
        <div class="pingcode-preview-table-wrap"><table><thead><tr><th scope="col">编号</th><th scope="col">标题</th><th scope="col">变化</th><th scope="col">IR</th><th scope="col">主来源</th></tr></thead><tbody>${visibleRows.map(row => `<tr><td>${row.action === 'removed' ? `<span class="pingcode-task-number">${esc(row.number)}</span>` : `<button type="button" class="pingcode-task-number" data-pc-run-item="${esc(row.number)}">${esc(row.number)}</button>`}</td><td>${esc(row.title || row.previousTitle || '—')}</td><td><span class="pingcode-action" data-action="${esc(row.action)}">${esc(actionLabel[row.action] || row.action)}</span></td><td>${(row.ir || []).map(value => `<span class="pingcode-ir">${esc(value)}</span>`).join('') || '—'}</td><td>${row.sources?.length > 1 && row.action !== 'removed' ? `<select data-pc-primary="${esc(row.number)}" aria-label="${esc(row.number)} 的主来源"><option value="">选择主来源</option>${row.sources.map(item => `<option value="${esc(item.id)}" ${state.decisions[row.number] === item.id ? 'selected' : ''}>${esc(item.name)}${item.primary ? '（当前）' : ''}</option>`).join('')}</select>` : esc(row.sources?.find(item => item.primary)?.name || row.sources?.[0]?.name || '—')}</td></tr>`).join('') || '<tr><td colspan="5" class="pingcode-empty">当前分类没有条目</td></tr>'}</tbody></table></div>
        <footer><span>第 ${state.page} 页 · 共 ${total} 条</span><button type="button" class="button secondary" data-pc-prev ${state.page <= 1 ? 'disabled' : ''}>上一页</button><button type="button" class="button secondary" data-pc-next ${state.page * 50 >= total ? 'disabled' : ''}>下一页</button></footer>
      </section>${state.missing && (state.missing.total || state.missing.retry) ? `<section class="pingcode-resources"><header><h4>缺失图片 <strong>${state.missing.total || 0}</strong></h4>${state.missing.total && state.missing.retry?.state !== 'running' ? `<button type="button" class="button secondary" data-pc-retry>${icon('refresh-cw')}重试缺图</button>` : ''}</header>${state.missing.retry ? `<p>重试${state.missing.retry.state === 'completed' ? '完成' : state.missing.retry.state === 'running' ? '中' : '失败'} · 修复 ${state.missing.retry.repaired} · 失败 ${state.missing.retry.failed}</p>` : ''}</section>` : ''}
    </section>`;
  }

  async function openDiffPage() {
    state.pageView = 'diff'; state.page = 1; state.diffQuery = ''; state.diffIr = '';
    render();
    try {
      const token = generation, sourceId = selectedId(), runId = state.run?.id;
      const [preview, conflicts] = await Promise.all([
        request(`/runs/${encodeURIComponent(runId)}/preview?page=1&pageSize=50&view=${encodeURIComponent(state.view)}`),
        request(`/runs/${encodeURIComponent(runId)}/preview?page=1&pageSize=1&view=conflicts`),
      ]);
      if (token !== generation || sourceId !== selectedId() || runId !== state.run?.id) return;
      state.preview = preview; state.diffConflictCount = Number(conflicts.total || 0); render();
    } catch (error) {
      state.workspaceError = `读取任务变化失败：${error.message}`; render();
    }
  }

  function renderSourceRows() {
    const search = state.search.trim().toLocaleLowerCase();
    const sources = state.sources.filter(item => {
      const matchesSearch = `${item.name} ${item.url}`.toLocaleLowerCase().includes(search);
      const matchesType = state.type === 'all' || item.type === state.type;
      const matchesProductType = state.productType === 'all' || (item.productType || 'DB') === state.productType;
      const matchesEnabled = state.enabled === 'all' || (state.enabled === 'ACTIVE') === (item.state === 'ACTIVE');
      return matchesSearch && matchesType && matchesProductType && matchesEnabled;
    });
    if (!sources.length) return `<tr><td colspan="8" class="pingcode-table-empty">${state.sources.length ? '没有符合条件的来源' : '尚未添加 Pingcode 来源'}</td></tr>`;
    return sources.map(item => `<tr data-pc-source="${esc(item.id)}" tabindex="0" aria-label="查看 ${esc(item.name)} 同步内容">
      <td><strong>${esc(item.name)}</strong></td><td data-label="类型">${esc(typeLabel(item.type))}</td>
      <td data-label="产品类型">${esc(item.productType || 'DB')}</td><td data-label="已同步数量">${Number(item.syncedTaskCount || 0)}</td>
      <td data-label="状态"><span class="pingcode-source-state" data-state="${esc(item.state)}"><i aria-hidden="true"></i>${item.state === 'ACTIVE' ? '已启用' : '已停用'}</span></td>
      <td data-label="来源 URL" class="pingcode-source-url"><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" data-pc-external>${esc(item.url)}</a></td>
      <td data-label="已同步内容">${uiIconButton({ usage: 'action.open', label: `查看已同步内容：${item.name}`, data: { 'pc-open': item.id } })}</td>
      <td data-label="配置操作"><div class="pingcode-row-actions">
        <button type="button" class="button secondary pingcode-edit-action" data-pc-edit-source="${esc(item.id)}">编辑</button>
        <span class="pingcode-state-control"><span>${state.pendingSourceId === item.id ? (item.state === 'ACTIVE' ? '正在停用' : '正在恢复') : (item.state === 'ACTIVE' ? '已启用' : '已停用')}</span><button type="button" class="pingcode-switch" role="switch" aria-label="${item.state === 'ACTIVE' ? '停用' : '恢复'}${esc(item.name)}" aria-checked="${item.state === 'ACTIVE'}" data-pc-toggle-state="${esc(item.id)}" ${state.pendingSourceId === item.id ? 'disabled' : ''}><span></span></button></span>
        ${item.deletable ? `<details class="pingcode-more"><summary aria-label="更多操作：${esc(item.name)}" title="更多操作">${uiIcon('action.more')}</summary><button type="button" data-pc-delete-source="${esc(item.id)}">删除</button></details>` : ''}</div></td>
    </tr>`).join('');
  }

  function render() {
    if (!root.isConnected) { stop(); return; }
    if (state.workspaceSource) {
      if (state.pageView === 'diff') { root.innerHTML = renderPreview(); window.lucide?.createIcons({ nodes: [root] }); return; }
      renderWorkspace(); return;
    }
    const source = state.selected;
    const sourceBody = state.sourcesState === 'loading'
      ? '<tr><td colspan="8" class="pingcode-table-empty">正在读取来源…</td></tr>'
      : state.sourcesState === 'error'
        ? `<tr><td colspan="8"><div class="pingcode-source-error"><strong>暂时无法读取来源</strong><span>${esc(state.sourceError)}</span><button type="button" class="button secondary" data-pc-refresh>${icon('refresh-cw')}重试</button></div></td></tr>`
        : renderSourceRows();
    root.innerHTML = `<section class="pingcode-sync-page" aria-label="Pingcode 来源同步">
      <header class="pingcode-sync-header"><div><h2>Pingcode 来源</h2><span>手动预览并确认后更新任务</span></div>
        <div class="pingcode-page-actions"><button type="button" class="button secondary" data-pc-refresh ${state.busy ? 'disabled' : ''}>${icon('refresh-cw')}刷新</button>
          <button type="button" class="button primary" data-pc-add>${icon('plus')}添加来源</button></div></header>
      <div class="pingcode-sync-feedback" ${state.message || state.error ? '' : 'hidden'}><p class="pingcode-sync-message ${state.error ? 'is-error' : ''}" role="${state.error ? 'alert' : 'status'}" aria-live="polite">${esc(state.error || state.message)}</p><button type="button" class="icon-button" data-pc-dismiss-message aria-label="关闭提示" title="关闭提示">${uiIcon('action.close')}</button></div>
      <div class="pingcode-source-toolbar"><label class="pingcode-search">${icon('search')}<span class="sr-only">搜索来源</span><input type="search" data-pc-search value="${esc(state.search)}" placeholder="搜索来源名称或 URL"></label>
        <label>类型<select data-pc-type><option value="all" ${state.type === 'all' ? 'selected' : ''}>全部类型</option><option value="REQUIREMENT" ${state.type === 'REQUIREMENT' ? 'selected' : ''}>需求基线</option><option value="TICKET" ${state.type === 'TICKET' ? 'selected' : ''}>工单视图</option></select></label>
        <label>产品类型<select data-pc-product-type><option value="all" ${state.productType === 'all' ? 'selected' : ''}>全部产品</option>${['DB','YCM','YMP','YDC'].map(value => `<option value="${value}" ${state.productType === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
        <label>状态<select data-pc-enabled><option value="all" ${state.enabled === 'all' ? 'selected' : ''}>全部状态</option><option value="ACTIVE" ${state.enabled === 'ACTIVE' ? 'selected' : ''}>已启用</option><option value="INACTIVE" ${state.enabled === 'INACTIVE' ? 'selected' : ''}>已停用</option></select></label>
        ${state.sourcesState === 'ready' ? `<span class="pingcode-source-count">${state.sources.length} 个来源</span>` : ''}</div>
      <div class="pingcode-source-table-wrap"><table class="pingcode-source-table"><thead><tr><th scope="col">来源名称</th><th scope="col">类型</th><th scope="col">产品类型</th><th scope="col">已同步数量</th><th scope="col">状态</th><th scope="col">来源 URL</th><th scope="col">已同步内容</th><th scope="col"><span class="sr-only">配置操作</span></th></tr></thead><tbody>${sourceBody}</tbody></table></div>
      <dialog data-pc-add-dialog aria-labelledby="pingcode-add-title"><form data-pc-form><header><h3 id="pingcode-add-title">添加 Pingcode 来源</h3><button type="button" class="icon-button" data-pc-add-close aria-label="关闭">${icon('x')}</button></header>
        <label>来源名称<input name="name" required maxlength="255" autocomplete="off"></label><label>来源类型<select name="type"><option value="REQUIREMENT">需求基线</option><option value="TICKET">工单视图</option></select></label>
        <label>产品类型<select name="productType" required><option value="DB">DB</option><option value="YCM">YCM</option><option value="YMP">YMP</option><option value="YDC">YDC</option></select></label>
        <label>来源 URL<input name="url" type="url" required placeholder="https://pingcode.yasdb.com/..."></label><p data-pc-form-status role="status" aria-live="polite"></p><p data-pc-form-error role="alert" hidden></p>
        <footer><button type="button" class="button secondary" data-pc-add-close>取消</button><button type="submit" class="button primary">保存来源</button></footer></form></dialog>
      <dialog data-pc-edit-dialog aria-labelledby="pingcode-edit-title"><form data-pc-edit-form><header><h3 id="pingcode-edit-title">Pingcode 配置</h3></header>
        <label>来源名称<input name="name" required maxlength="255" autocomplete="off" value="${esc(source?.name || '')}"></label><label>来源类型<select name="type" ${state.runs.length ? 'disabled' : ''}><option value="REQUIREMENT" ${source?.type === 'REQUIREMENT' ? 'selected' : ''}>需求基线</option><option value="TICKET" ${source?.type === 'TICKET' ? 'selected' : ''}>工单视图</option></select></label>
        <label>产品类型<select name="productType" required>${['DB','YCM','YMP','YDC'].map(value => `<option value="${value}" ${value === (source?.productType || 'DB') ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
        <label>来源 URL<input name="url" type="url" required value="${esc(source?.url || '')}" ${state.runs.length ? 'readonly' : ''}></label>${state.runs.length ? '<p class="pingcode-form-note">已有同步历史，来源类型和 URL 已锁定以保留历史追溯。</p>' : ''}<p data-pc-edit-status role="status" aria-live="polite"></p><p data-pc-edit-error role="alert" hidden></p>
        <footer><button type="button" class="button secondary" data-pc-edit-close>取消</button><button type="submit" class="button primary">保存修改</button></footer></form></dialog>
      <dialog data-pc-delete-dialog aria-labelledby="pingcode-delete-title"><form data-pc-delete-form><header><h3 id="pingcode-delete-title">删除来源</h3></header><p>确定删除“${esc(source?.name || '')}”？此操作不可撤销。</p><p data-pc-delete-error role="alert" hidden></p><footer><button type="button" class="button secondary" data-pc-delete-close>取消</button><button type="submit" class="button danger">确认删除</button></footer></form></dialog>
    </section>`;
    window.lucide?.createIcons({ nodes: [root] });
    const addDialog = root.querySelector('[data-pc-add-dialog]');
    const editDialog = root.querySelector('[data-pc-edit-dialog]');
    const deleteDialog = root.querySelector('[data-pc-delete-dialog]');
    if (state.addDialogOpen && !addDialog.open) addDialog.showModal();
    if (state.editDialogOpen && !editDialog.open) editDialog.showModal();
    if (state.deleteDialogOpen && !deleteDialog.open) deleteDialog.showModal();
    addDialog.addEventListener('close', () => {
      if (root.querySelector('[data-pc-add-dialog]') === addDialog) state.addDialogOpen = false;
    });
    editDialog.addEventListener('close', () => { if (root.querySelector('[data-pc-edit-dialog]') === editDialog) state.editDialogOpen = false; });
    deleteDialog.addEventListener('close', () => { if (root.querySelector('[data-pc-delete-dialog]') === deleteDialog) state.deleteDialogOpen = false; });
  }

  async function loadRuns(token = generation, sourceId = selectedId()) {
    const runs = sourceId ? await request(`/sources/${encodeURIComponent(sourceId)}/runs`) : [];
    if (token !== generation || sourceId !== selectedId()) return false;
    state.runs = runs; return true;
  }
  async function loadPreview() {
    if (!state.run || !['AWAITING_CONFIRM', 'CONFIRMED', 'CONFIRMED_MISSING_IMAGES'].includes(state.run.status)) return;
    const token = generation, sourceId = selectedId(), runId = state.run.id;
    const result = await request(`/runs/${encodeURIComponent(runId)}/preview?page=${state.page}&pageSize=50&view=${state.view}`);
    if (token !== generation || sourceId !== selectedId() || runId !== state.run?.id) return;
    state.preview = result;
  }
  async function loadRunItems(token = generation, sourceId = selectedId(), runId = state.run?.id) {
    if (!runId) return;
    const result = await request(`/runs/${encodeURIComponent(runId)}/items?page=1&pageSize=50`);
    if (token !== generation || sourceId !== selectedId() || runId !== state.run?.id) return;
    state.runItems = result;
  }
  async function loadUnlinkedIrs(token = generation, sourceId = selectedId(), runId = state.run?.id) {
    if (!runId || !Number(state.run?.unlinkedIrCount || 0)) { state.unlinkedIrs = null; return; }
    const result = await request(`/runs/${encodeURIComponent(runId)}/unlinked-irs?page=1&pageSize=100`);
    if (token !== generation || sourceId !== selectedId() || runId !== state.run?.id) return;
    state.unlinkedIrs = result;
  }
  async function loadMissing(token = generation) {
    if (!state.run || !['CONFIRMED', 'CONFIRMED_MISSING_IMAGES'].includes(state.run.status)) { state.missing = null; return; }
    const runId = state.run.id;
    const result = await request(`/runs/${encodeURIComponent(runId)}/resources?page=1&pageSize=20`);
    if (token !== generation || state.run?.id !== runId) return;
    state.missing = result;
    if (result.retry?.state === 'running') resourceTimer = setTimeout(async () => {
      try { await loadMissing(token); render(); }
      catch (e) { if (token === generation) showError(e); }
    }, 1000);
    else if (result.retry?.state === 'completed') {
      const run = await request(`/runs/${encodeURIComponent(runId)}`);
      if (token !== generation || state.run?.id !== runId) return;
      state.run = run;
      await loadRuns(token, run.sourceId);
    }
  }
  async function loadSources() {
    const requestId = ++sourceRequest;
    busy(true); state.sourceError = '';
    try {
      const sources = await request('/sources');
      if (requestId !== sourceRequest) return;
      state.sources = sources;
      state.sourcesState = 'ready';
      state.selected = state.sources.find(item => item.id === selectedId()) || null;
      state.error = '';
    } catch (e) {
      if (requestId !== sourceRequest) return;
      state.sourcesState = 'error'; state.sourceError = e.message;
    } finally { if (requestId === sourceRequest) { busy(false); render(); } }
  }
  async function poll(runId, token, sourceId = selectedId()) {
    if (token !== generation || !root.isConnected) return;
    try {
      const run = await request(`/runs/${encodeURIComponent(runId)}`);
      if (token !== generation || sourceId !== selectedId() || state.run?.id !== runId || run.sourceId !== sourceId) return;
      state.run = run; render();
      if (run.status === 'COLLECTING') timer = setTimeout(() => poll(runId, token, sourceId), 600);
      else if (['AWAITING_CONFIRM', 'CONFIRMED', 'CONFIRMED_MISSING_IMAGES'].includes(run.status)) {
        state.syncing = false;
        showUnlinkedIrWarning(run.unlinkedIrCount);
        state.view = Number(run.newCount || 0) ? 'created' : Number(run.changedCount || 0) ? 'updated' : Number(run.removedCount || 0) ? 'removed' : 'conflicts';
        await Promise.all([
          loadRuns(token, sourceId), loadRunItems(token, sourceId, runId),
          loadUnlinkedIrs(token, sourceId, runId), loadPreview(), loadMissing(token),
        ]);
        if (token !== generation || sourceId !== selectedId() || state.run?.id !== runId) return;
        render();
      } else {
        state.syncing = false;
        state.workspaceError = `本次同步未完成：${failureLabel(run.errorCode || run.status)}。请修复来源问题后重试。`;
        render();
      }
    } catch (e) {
      if (token === generation && sourceId === selectedId() && state.run?.id === runId) {
        state.syncing = false;
        state.workspaceError = `读取同步结果失败：${e.message}。可点击“同步”重新尝试。`;
        render();
      }
    }
  }
  async function openWorkspace(id, page = 1) {
    stop(); state.workspaceSource = state.sources.find(item => item.id === id) || null;
    if (!state.workspaceSource) return;
    state.pageView = 'workspace';
    state.workspaceItems = null; state.workspaceItem = null; state.workspacePane = 'list'; state.workspaceLoading = true;
    state.workspaceError = ''; state.workspacePage = page; const token = generation;
    render();
    try {
      const [source, items] = await Promise.all([
        request(`/sources/${encodeURIComponent(id)}`),
        request(`/sources/${encodeURIComponent(id)}/items?page=${page}&pageSize=50`),
      ]);
      if (token !== generation || id !== state.workspaceSource?.id) return;
      state.workspaceSource = source; state.workspaceItems = items;
    } catch (error) {
      if (token === generation && id === state.workspaceSource?.id) state.workspaceError = error.message;
    } finally {
      if (token === generation && id === state.workspaceSource?.id) { state.workspaceLoading = false; render(); }
    }
  }

  function renderWorkspace() {
    const source = state.workspaceSource, page = state.run ? state.runItems : state.workspaceItems;
    const item = state.run ? state.runSnapshot : state.workspaceItem;
    root.innerHTML = `<section class="pingcode-sync-page pingcode-content-workspace" aria-label="Pingcode 同步内容">
      <header class="pingcode-sync-header"><div><h2>Pingcode 来源 / ${esc(source?.name || '')}</h2><span>${esc(source?.productType || 'DB')} · ${esc(typeLabel(source?.type))} · 当前已关联 ${Number(source?.syncedTaskCount || 0)} 项</span></div>
        <div class="pingcode-page-actions"><button type="button" class="button secondary" data-pc-workspace-back>${uiIcon('action.back')}返回来源</button>${state.run && ['AWAITING_CONFIRM', 'CONFIRMED', 'CONFIRMED_MISSING_IMAGES'].includes(state.run.status) ? '<button type="button" class="button secondary" data-pc-open-diff>查看任务变化</button>' : ''}<button type="button" class="button primary" data-pc-workspace-sync ${state.syncing ? 'disabled aria-disabled="true"' : ''}>${uiIcon('source.sync')}${state.syncing ? '同步中…' : '同步'}</button></div></header>
      <div class="pingcode-sync-feedback" ${state.message || state.error ? '' : 'hidden'}><p class="pingcode-sync-message ${state.error ? 'is-error' : ''}" role="${state.error ? 'alert' : 'status'}" aria-live="polite">${esc(state.error || state.message)}</p><button type="button" class="icon-button" data-pc-dismiss-message aria-label="关闭提示" title="关闭提示">${uiIcon('action.close')}</button></div>
      ${state.syncing ? '<p class="pingcode-sync-progress" role="status" aria-live="polite">正在同步 PingCode 并比较任务快照，完成后显示差异。</p>' : ''}
      ${state.workspaceError ? `<div class="pingcode-sync-feedback"><p class="pingcode-sync-message is-error" role="alert" aria-live="polite">${esc(state.workspaceError)}</p><button type="button" class="icon-button" data-pc-dismiss-workspace-error aria-label="关闭提示" title="关闭提示">${uiIcon('action.close')}</button></div>` : ''}
      ${state.unlinkedIrWarning ? `<div class="pingcode-sync-feedback"><p class="pingcode-sync-warning" role="status" aria-live="polite">${esc(state.unlinkedIrWarning)}</p><button type="button" class="icon-button" data-pc-dismiss-warning aria-label="关闭提示" title="关闭提示">${uiIcon('action.close')}</button></div>` : ''}
      ${state.unlinkedIrs?.total ? `<details class="pingcode-unlinked-irs"><summary>未关联 IR（${Number(state.unlinkedIrs.total)}）</summary><p>采集时 PingCode 的结构化关系接口返回空列表，表示这些 IR 当时尚无 SR 可同步；后续建立关联后可再次同步。</p><ul>${state.unlinkedIrs.items.map(number => `<li><code>${esc(number)}</code></li>`).join('')}</ul></details>` : ''}
      ${state.workspaceLoading ? '<p class="pingcode-empty">正在读取已同步内容…</p>' : `<div class="pingcode-workspace-tabs" role="tablist" aria-label="同步内容视图"><button type="button" role="tab" data-pc-workspace-pane="list" aria-selected="${state.workspacePane === 'list'}">SR 列表</button><button type="button" role="tab" data-pc-workspace-pane="detail" aria-selected="${state.workspacePane === 'detail'}">SR 详情</button></div><div class="pingcode-workspace-grid"><section data-workspace-panel="list" ${state.workspacePane === 'list' ? 'data-active' : ''} aria-label="${state.run ? '本次同步任务' : '已确认任务'}"><header><h3>${state.run ? '本次同步任务' : '已确认任务'}</h3><button type="button" class="icon-button" data-pc-workspace-refresh aria-label="刷新已同步任务">${uiIcon('action.refresh')}</button></header>
        <div class="pingcode-source-table-wrap"><table class="pingcode-source-table"><thead><tr><th>编号</th><th>标题</th><th>IR</th>${state.run ? '' : '<th>确认时间</th>'}</tr></thead><tbody>${(page?.items || []).map(row => `<tr><td><button type="button" class="pingcode-task-number" data-${state.run ? 'pc-run-item' : 'pc-workspace-item'}="${esc(row.number)}">${esc(row.number)}</button></td><td>${esc(row.title || '—')}</td><td>${(row.ir || []).map(esc).join('、') || '—'}</td>${state.run ? '' : `<td>${esc(row.confirmedAt ? new Date(row.confirmedAt).toLocaleString('zh-CN', { hour12: false }) : '—')}</td>`}</tr>`).join('') || `<tr><td colspan="${state.run ? 3 : 4}" class="pingcode-table-empty">${state.run ? '本次同步暂无任务' : '尚未确认同步内容'}</td></tr>`}</tbody></table></div>
        <footer class="pingcode-workspace-pagination"><span>共 ${Number(page?.total || 0)} 项 · 第 ${state.workspacePage} 页</span><button type="button" class="button secondary" data-pc-workspace-prev ${state.workspacePage <= 1 ? 'disabled' : ''}>上一页</button><button type="button" class="button secondary" data-pc-workspace-next ${state.workspacePage * 50 >= Number(page?.total || 0) ? 'disabled' : ''}>下一页</button></footer></section>
      <section class="pingcode-workspace-body" data-workspace-panel="detail" ${state.workspacePane === 'detail' ? 'data-active' : ''} aria-label="Pingcode 工作项详情"><header><button type="button" class="button secondary pingcode-detail-back" data-pc-workspace-pane="list">${uiIcon('action.back')}返回列表</button>${state.returnToDiff ? '<button type="button" class="button secondary" data-pc-back-to-diff>返回任务变化</button>' : ''}<h3>${esc(item?.number || '工作项详情')}</h3></header>${item ? `<p>IR ${(item.ir || []).map(esc).join('、') || '—'}</p><article class="pingcode-workitem-markdown">${renderSourceRecord(item.title, item.markdown)}</article>` : '<p class="pingcode-empty">选择一项查看工作项详情</p>'}</section></div>`}
    </section>`;
    scheduleUnlinkedWarningHide();
    window.lucide?.createIcons({ nodes: [root] });
  }

  root.addEventListener('click', async event => {
    const button = event.target.closest('button');
    const row = event.target.closest('[data-pc-source]');
    if (row && !event.target.closest('a,button,summary,details')) { await openWorkspace(row.dataset.pcSource); return; }
    if (!button || !root.contains(button)) return;
    if (button.type === 'submit') return;
    if (button.hasAttribute('data-pc-dismiss-message')) { state.error = ''; state.message = ''; render(); return; }
    if (button.hasAttribute('data-pc-dismiss-warning')) {
      clearTimeout(unlinkedWarningTimer); unlinkedWarningTimer = null;
      state.unlinkedIrWarning = ''; render(); return;
    }
    if (button.hasAttribute('data-pc-dismiss-workspace-error')) { state.workspaceError = ''; render(); return; }
    if (button.dataset.pcEditSource) {
      stop(); state.workspaceSource = null;
      const listSource = state.sources.find(item => item.id === button.dataset.pcEditSource);
      if (!listSource) return;
      try {
        const [source, runs] = await Promise.all([
          request(`/sources/${encodeURIComponent(listSource.id)}`),
          request(`/sources/${encodeURIComponent(listSource.id)}/runs`),
        ]);
        state.selected = source; state.runs = runs; state.editDialogOpen = true;
        render(); root.querySelector('[data-pc-edit-form] [name="name"]')?.focus();
      } catch (error) { showToast(error.message, true); }
      return;
    }
    if (button.dataset.pcDeleteSource) {
      stop(); state.workspaceSource = null;
      const listSource = state.sources.find(item => item.id === button.dataset.pcDeleteSource);
      if (!listSource) return;
      try {
        state.selected = await request(`/sources/${encodeURIComponent(listSource.id)}`);
        state.deleteDialogOpen = true; render();
      } catch (error) { showToast(error.message, true); }
      return;
    }
    if (button.dataset.pcToggleState) {
      const source = state.sources.find(item => item.id === button.dataset.pcToggleState);
      if (!source || state.pendingSourceId) return;
      state.pendingSourceId = source.id;
      render();
      try {
        state.error = ''; state.message = '';
        const updated = await request(`/sources/${encodeURIComponent(source.id)}/state`, {
          method: 'PATCH', body: JSON.stringify({ state: source.state === 'ACTIVE' ? 'DISABLED' : 'ACTIVE', revision: source.revision }),
        });
        state.sources = state.sources.map(item => item.id === source.id ? updated : item);
        state.message = source.state === 'ACTIVE' ? '来源已停用' : '来源已恢复';
      } catch (e) { state.error = e.message; }
      finally { state.pendingSourceId = null; render(); }
      return;
    }
    if (button.dataset.pcOpen) { await openWorkspace(button.dataset.pcOpen); return; }
    if (button.hasAttribute('data-pc-workspace-back')) { state.workspaceSource = null; state.workspaceItems = null; render(); return; }
    if (button.hasAttribute('data-pc-open-diff')) { await openDiffPage(); return; }
    if (button.hasAttribute('data-pc-diff-back')) { state.pageView = 'workspace'; state.workspacePane = 'list'; state.returnToDiff = false; render(); return; }
    if (button.hasAttribute('data-pc-back-to-diff')) { state.pageView = 'diff'; state.workspacePane = 'list'; state.returnToDiff = false; render(); return; }
    if (button.hasAttribute('data-pc-workspace-refresh')) { await openWorkspace(state.workspaceSource.id, state.workspacePage); return; }
    if (button.dataset.pcWorkspacePane) { state.workspacePane = button.dataset.pcWorkspacePane; render(); return; }
    if (button.dataset.pcWorkspaceItem) {
      const sourceId = state.workspaceSource?.id, token = generation;
      try {
        const item = await request(`/sources/${encodeURIComponent(sourceId)}/items/${encodeURIComponent(button.dataset.pcWorkspaceItem)}`);
        if (token === generation && sourceId === state.workspaceSource?.id) { state.workspaceItem = item; state.workspacePane = 'detail'; render(); }
      } catch (error) { if (token === generation && sourceId === state.workspaceSource?.id) { state.workspaceError = error.message; render(); } }
      return;
    }
    if (button.dataset.pcRunItem) {
      const sourceId = selectedId(), runId = state.run?.id, token = generation;
      try {
        const item = await request(`/runs/${encodeURIComponent(runId)}/items/${encodeURIComponent(button.dataset.pcRunItem)}`);
        if (token === generation && sourceId === selectedId() && runId === state.run?.id) { state.returnToDiff = state.pageView === 'diff'; state.pageView = 'workspace'; state.runSnapshot = item; state.workspacePane = 'detail'; render(); }
      } catch (error) { if (token === generation && sourceId === selectedId() && runId === state.run?.id) { state.workspaceError = error.message; render(); } }
      return;
    }
    if (button.hasAttribute('data-pc-workspace-prev') || button.hasAttribute('data-pc-workspace-next')) {
      await openWorkspace(state.workspaceSource.id, state.workspacePage + (button.hasAttribute('data-pc-workspace-next') ? 1 : -1)); return;
    }
    if (button.hasAttribute('data-pc-workspace-sync')) {
      const id = state.workspaceSource.id, token = generation;
      state.pageView = 'workspace'; state.returnToDiff = false;
      state.selected = state.workspaceSource; state.run = null; state.preview = null;
      state.runItems = null; state.runSnapshot = null; state.unlinkedIrs = null; state.workspacePane = 'list'; state.view = 'created'; state.page = 1;
      state.decisions = {}; state.workspaceError = ''; showUnlinkedIrWarning(0); state.syncing = true; state.busy = true; render();
      try {
        const run = await request(`/sources/${encodeURIComponent(id)}/runs`, post({ revision: state.selected.revision }));
        if (token !== generation || id !== state.workspaceSource?.id) return;
        state.run = run; await loadRuns(token, id); render(); poll(run.id, token, id);
      } catch (error) {
        if (token === generation && id === state.workspaceSource?.id) {
          state.syncing = false;
          state.workspaceError = `无法启动同步：${error.message}。请确认来源已启用且当前账号有权限。`;
        }
      }
      finally { if (token === generation && id === state.workspaceSource?.id) { state.busy = false; render(); } }
      return;
    }
    if (button.hasAttribute('data-pc-add')) { state.addDialogOpen = true; render(); root.querySelector('[data-pc-add-dialog]')?.querySelector('input')?.focus(); return; }
    if (button.hasAttribute('data-pc-add-close')) {
      state.addDialogOpen = false;
      root.querySelector('[data-pc-add-dialog]')?.close();
      return;
    }
    if (button.hasAttribute('data-pc-edit-close')) { state.editDialogOpen = false; root.querySelector('[data-pc-edit-dialog]')?.close(); return; }
    if (button.hasAttribute('data-pc-delete-close')) { state.deleteDialogOpen = false; root.querySelector('[data-pc-delete-dialog]')?.close(); return; }
    if (button.hasAttribute('data-pc-refresh')) { await loadSources(); return; }
    try {
      if (button.hasAttribute('data-pc-view')) {
        state.view = button.dataset.pcView; state.page = 1; await loadPreview();
      } else if (button.hasAttribute('data-pc-prev') || button.hasAttribute('data-pc-next')) {
        state.page += button.hasAttribute('data-pc-next') ? 1 : -1; await loadPreview();
      } else if (button.hasAttribute('data-pc-confirm')) {
        busy(true); render();
        state.run = await request(`/runs/${encodeURIComponent(state.run.id)}/confirm`, post({
          digest: state.preview.run.digest, expectedRevision: state.selected.revision, primarySources: state.decisions,
        }));
        state.selected = await request(`/sources/${encodeURIComponent(selectedId())}`);
        await loadRuns(); await loadPreview(); await loadMissing(); state.message = '已同步到任务管理';
        if (state.workspaceSource?.id === state.selected?.id) {
          state.workspaceSource = await request(`/sources/${encodeURIComponent(selectedId())}`);
          state.workspaceItems = await request(`/sources/${encodeURIComponent(selectedId())}/items?page=${state.workspacePage}&pageSize=50`);
        }
        state.pageView = 'diff';
      } else if (button.hasAttribute('data-pc-retry')) {
        busy(true); render();
        await request(`/runs/${encodeURIComponent(state.run.id)}/resources/retry`, post({}));
        await loadMissing(); state.message = '已开始重试缺失图片';
      }
      state.error = '';
    } catch (e) {
      const confirmed = button.hasAttribute('data-pc-confirm')
        && ['CONFIRMED', 'CONFIRMED_MISSING_IMAGES'].includes(state.run?.status);
      state.error = confirmed ? '同步已确认，但页面回读失败，请刷新工作区'
        : e.code === 'PRIMARY_SOURCE_DECISION_REQUIRED' ? '请在“来源冲突”中逐项选择主来源' : e.message;
    }
    finally { busy(false); render(); }
  });

  root.addEventListener('keydown', event => {
    const toggle = event.target.closest('[data-pc-toggle-state][role="switch"]');
    if (!toggle || event.code !== 'Space' || toggle.disabled) return;
    event.preventDefault();
    toggle.click();
  });
  root.addEventListener('keydown', async event => {
    const row = event.target.closest('[data-pc-source]');
    if (row && !event.target.closest('button,a,summary,input,select')
      && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); await openWorkspace(row.dataset.pcSource); }
  });
  root.addEventListener('input', event => {
    if (event.target.matches('[data-pc-diff-search]')) {
      state.diffQuery = event.target.value;
      const rows = [...root.querySelectorAll('.pingcode-preview tbody tr')];
      let count = 0;
      rows.forEach(row => {
        const matches = !row.querySelector('.pingcode-empty')
          && row.textContent.toLocaleLowerCase().includes(state.diffQuery.trim().toLocaleLowerCase())
          && (!state.diffIr || [...row.querySelectorAll('.pingcode-ir')].some(ir => ir.textContent === state.diffIr));
        row.hidden = !matches;
        if (matches) count++;
      });
      const resultCount = root.querySelector('[data-pc-diff-result-count]');
      if (resultCount) resultCount.textContent = String(count);
      return;
    }
    if (event.target.matches('[data-pc-search]')) {
      state.search = event.target.value;
      if (state.sourcesState === 'ready') {
        root.querySelector('.pingcode-source-table tbody').innerHTML = renderSourceRows();
        const count = root.querySelector('.pingcode-source-count');
        if (count) count.textContent = `${root.querySelectorAll('[data-pc-source]').length} 个来源`;
      }
    }
  });
  root.addEventListener('change', event => {
    if (event.target.matches('[data-pc-diff-ir]')) {
      state.diffIr = event.target.value;
      const query = root.querySelector('[data-pc-diff-search]');
      query?.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (event.target.matches('[data-pc-type]')) { state.type = event.target.value; render(); }
    if (event.target.matches('[data-pc-product-type]')) { state.productType = event.target.value; render(); }
    if (event.target.matches('[data-pc-enabled]')) { state.enabled = event.target.value; render(); }
    if (event.target.matches('[data-pc-primary]')) {
      const number = event.target.dataset.pcPrimary;
      if (event.target.value) state.decisions[number] = event.target.value;
      else delete state.decisions[number];
    }
  });
  root.addEventListener('submit', async event => {
    if (event.target.matches('[data-pc-edit-form]')) {
      event.preventDefault();
      const form = event.target, values = Object.fromEntries(new FormData(form));
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true; form.querySelector('[data-pc-edit-status]').textContent = '正在保存修改…';
      form.querySelector('[data-pc-edit-error]').hidden = true;
      try {
        state.selected = await request(`/sources/${encodeURIComponent(selectedId())}`, {
          method: 'PATCH', body: JSON.stringify({ ...values,
            type: values.type || state.selected.type, revision: state.selected.revision }),
        });
        state.sources = await request('/sources'); state.sourcesState = 'ready';
        state.editDialogOpen = false; state.message = '来源已更新'; state.error = '';
        render();
      } catch (e) {
        const error = form.querySelector('[data-pc-edit-error]'); error.textContent = e.message; error.hidden = false;
        form.querySelector('[data-pc-edit-status]').textContent = '';
        submit.disabled = false;
      }
      return;
    }
    if (event.target.matches('[data-pc-delete-form]')) {
      event.preventDefault();
      const form = event.target, submit = form.querySelector('button[type="submit"]');
      submit.disabled = true; form.querySelector('[data-pc-delete-error]').hidden = true;
      try {
        await request(`/sources/${encodeURIComponent(selectedId())}`, {
          method: 'DELETE', headers: { 'If-Match': String(state.selected.revision) },
        });
        state.sources = await request('/sources'); state.sourcesState = 'ready'; state.selected = null;
        state.deleteDialogOpen = false; state.message = '来源已删除';
        render();
      } catch (e) {
        const error = form.querySelector('[data-pc-delete-error]'); error.textContent = e.message; error.hidden = false;
        submit.disabled = false;
      }
      return;
    }
    if (!event.target.matches('[data-pc-form]')) return;
    event.preventDefault();
    const form = event.target, input = Object.fromEntries(new FormData(form));
    const submit = form.querySelector('button[type="submit"]'); submit.disabled = true;
    const originalLabel = submit.textContent;
    submit.textContent = '保存中…';
    form.querySelector('[data-pc-form-status]').textContent = '正在登记来源…';
    try {
      const created = await request('/sources', post(input));
      state.selected = created; state.error = '';
      state.sources = [created, ...state.sources.filter(item => item.id !== created.id)]; state.sourcesState = 'ready';
      state.addDialogOpen = false; state.message = '来源已添加'; render();
    } catch (e) {
      const message = form.querySelector('[data-pc-form-error]');
      message.textContent = e.message; message.hidden = false; submit.disabled = false;
      submit.textContent = originalLabel;
      form.querySelector('[data-pc-form-status]').textContent = '';
    }
  });
  render(); loadSources();
}
