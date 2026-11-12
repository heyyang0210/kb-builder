import { escapeHtml as esc, icon } from '../../common/utils/dom.js';

const base = '/knowledge-center/api/platform/plugins/pingcode';
const labels = { COLLECTING: '采集中', AWAITING_CONFIRM: '待确认', CONFIRMED: '已同步',
  CONFIRMED_MISSING_IMAGES: '已同步 · 缺图', FAILED: '失败', CANCELLED: '已取消' };
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
  const state = { sources: [], sourcesState: 'loading', sourceError: '', selected: null, dialogOpen: false,
    addDialogOpen: false, search: '', type: 'all', enabled: 'all', runs: [], run: null, preview: null,
    view: 'current', page: 1, decisions: {}, missing: null, detailsLoading: false,
    busy: false, message: '', error: '' };
  let timer = null, resourceTimer = null, generation = 0;
  const selectedId = () => state.selected?.id;
  const busy = value => { state.busy = value; root.setAttribute('aria-busy', String(value)); };
  const stop = () => { generation++; clearTimeout(timer); clearTimeout(resourceTimer); timer = null; resourceTimer = null; };
  const showError = value => { state.error = value?.message || String(value); state.message = ''; render(); };

  function renderPreview() {
    const rows = state.preview?.items || [], total = Number(state.preview?.total || 0), run = state.run;
    if (!run || !['AWAITING_CONFIRM', 'CONFIRMED', 'CONFIRMED_MISSING_IMAGES'].includes(run.status)) return '';
    return `<section class="pingcode-preview" aria-label="同步预览">
      <header><div><h4>同步预览</h4><span>新增 ${run.newCount ?? 0} · 更新 ${run.changedCount ?? 0} · 移除 ${run.removedCount ?? 0}</span></div>
        <div class="pingcode-preview-tabs" role="tablist" aria-label="预览分类">${[['current', '当前条目'], ['conflicts', '来源冲突'], ['removed', '来源移除']].map(([key, label]) => `<button type="button" role="tab" aria-selected="${state.view === key}" data-pc-view="${key}">${label}</button>`).join('')}</div></header>
      <div class="pingcode-preview-table-wrap"><table><thead><tr><th scope="col">编号</th><th scope="col">标题</th><th scope="col">变化</th><th scope="col">IR</th><th scope="col">主来源</th></tr></thead><tbody>${rows.map(row => `<tr><td><code>${esc(row.number)}</code></td><td>${esc(row.title || row.previousTitle || '—')}</td><td><span class="pingcode-action" data-action="${esc(row.action)}">${esc(actionLabel[row.action] || row.action)}</span></td><td>${(row.ir || []).map(value => `<span class="pingcode-ir">${esc(value)}</span>`).join('') || '—'}</td><td>${row.sources?.length > 1 && row.action !== 'removed' ? `<select data-pc-primary="${esc(row.number)}" aria-label="${esc(row.number)} 的主来源"><option value="">选择主来源</option>${row.sources.map(item => `<option value="${esc(item.id)}" ${state.decisions[row.number] === item.id ? 'selected' : ''}>${esc(item.name)}${item.primary ? '（当前）' : ''}</option>`).join('')}</select>` : esc(row.sources?.find(item => item.primary)?.name || row.sources?.[0]?.name || '—')}</td></tr>`).join('') || '<tr><td colspan="5" class="pingcode-empty">当前分类没有条目</td></tr>'}</tbody></table></div>
      <footer><span>第 ${state.page} 页 · 共 ${total} 条</span><div><button type="button" class="icon-button" data-pc-prev aria-label="上一页" title="上一页" ${state.page <= 1 ? 'disabled' : ''}>${icon('chevron-left')}</button><button type="button" class="icon-button" data-pc-next aria-label="下一页" title="下一页" ${state.page * 50 >= total ? 'disabled' : ''}>${icon('chevron-right')}</button></div>${run.status === 'AWAITING_CONFIRM' ? `<button type="button" class="button primary" data-pc-confirm ${state.busy ? 'disabled' : ''}>确认同步</button>` : ''}</footer>
    </section>`;
  }

  function renderSourceRows() {
    const search = state.search.trim().toLocaleLowerCase();
    const sources = state.sources.filter(item => {
      const matchesSearch = `${item.name} ${item.url}`.toLocaleLowerCase().includes(search);
      const matchesType = state.type === 'all' || item.type === state.type;
      const matchesEnabled = state.enabled === 'all' || (state.enabled === 'ACTIVE') === (item.state === 'ACTIVE');
      return matchesSearch && matchesType && matchesEnabled;
    });
    if (!sources.length) return `<tr><td colspan="5" class="pingcode-table-empty">${state.sources.length ? '没有符合条件的来源' : '尚未添加 Pingcode 来源'}</td></tr>`;
    return sources.map(item => `<tr data-pc-source="${esc(item.id)}" tabindex="0" aria-label="打开 ${esc(item.name)} 详情">
      <td><strong>${esc(item.name)}</strong></td><td>${esc(typeLabel(item.type))}</td>
      <td><span class="pingcode-source-state" data-state="${esc(item.state)}"><i aria-hidden="true"></i>${item.state === 'ACTIVE' ? '已启用' : '已停用'}</span></td>
      <td class="pingcode-source-url"><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" data-pc-external>${esc(item.url)}</a></td>
      <td><button type="button" class="button secondary pingcode-detail-button" data-pc-open="${esc(item.id)}">详情 ${icon('arrow-up-right')}</button></td>
    </tr>`).join('');
  }

  function render() {
    if (!root.isConnected) { stop(); return; }
    const source = state.selected, run = state.run;
    const sourceBody = state.sourcesState === 'loading'
      ? '<tr><td colspan="5" class="pingcode-table-empty">正在读取来源…</td></tr>'
      : state.sourcesState === 'error'
        ? `<tr><td colspan="5"><div class="pingcode-source-error"><strong>暂时无法读取来源</strong><span>${esc(state.sourceError)}</span><button type="button" class="button secondary" data-pc-refresh>${icon('refresh-cw')}重试</button></div></td></tr>`
        : renderSourceRows();
    root.innerHTML = `<section class="pingcode-sync-page" aria-label="Pingcode 来源同步">
      <header class="pingcode-sync-header"><div><h2>Pingcode 来源</h2><span>手动预览并确认后更新任务</span></div>
        <div class="pingcode-page-actions"><button type="button" class="button secondary" data-pc-refresh ${state.busy ? 'disabled' : ''}>${icon('refresh-cw')}刷新</button>
          <button type="button" class="button primary" data-pc-add>${icon('plus')}添加来源</button></div></header>
      <p class="pingcode-sync-message ${state.error ? 'is-error' : ''}" role="status" ${state.message || state.error ? '' : 'hidden'}>${esc(state.error || state.message)}</p>
      <div class="pingcode-source-toolbar"><label class="pingcode-search">${icon('search')}<span class="sr-only">搜索来源</span><input type="search" data-pc-search value="${esc(state.search)}" placeholder="搜索来源名称或 URL"></label>
        <label>类型<select data-pc-type><option value="all" ${state.type === 'all' ? 'selected' : ''}>全部类型</option><option value="REQUIREMENT" ${state.type === 'REQUIREMENT' ? 'selected' : ''}>需求基线</option><option value="TICKET" ${state.type === 'TICKET' ? 'selected' : ''}>工单视图</option></select></label>
        <label>状态<select data-pc-enabled><option value="all" ${state.enabled === 'all' ? 'selected' : ''}>全部状态</option><option value="ACTIVE" ${state.enabled === 'ACTIVE' ? 'selected' : ''}>已启用</option><option value="INACTIVE" ${state.enabled === 'INACTIVE' ? 'selected' : ''}>已停用</option></select></label>
        ${state.sourcesState === 'ready' ? `<span class="pingcode-source-count">${state.sources.length} 个来源</span>` : ''}</div>
      <div class="pingcode-source-table-wrap"><table class="pingcode-source-table"><thead><tr><th scope="col">来源名称</th><th scope="col">类型</th><th scope="col">状态</th><th scope="col">来源 URL</th><th scope="col"><span class="sr-only">操作</span></th></tr></thead><tbody>${sourceBody}</tbody></table></div>
      <dialog data-pc-detail-dialog aria-labelledby="pingcode-detail-title">
        ${source ? `<header class="pingcode-dialog-header"><div><span class="pingcode-dialog-eyebrow">来源详情</span><h3 id="pingcode-detail-title">${esc(source.name)}</h3><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.url)}${icon('external-link')}</a></div><button type="button" class="icon-button" data-pc-detail-close aria-label="关闭详情" title="关闭">${icon('x')}</button></header>
          ${state.message === '来源已添加' ? `<p class="pingcode-sync-message" role="status">${esc(state.message)}</p>` : ''}
          <div class="pingcode-dialog-scroll"><section class="pingcode-source-facts"><div><span>来源类型</span><strong>${esc(typeLabel(source.type))}</strong></div><div><span>连接状态</span><strong class="pingcode-source-state" data-state="${esc(source.state)}"><i aria-hidden="true"></i>${source.state === 'ACTIVE' ? '已启用' : '已停用'}</strong></div><div><span>同步方式</span><strong>手动预览并确认</strong></div><div><span>配置修订</span><strong>${esc(source.revision ?? '—')}</strong></div></section>
            ${state.error ? `<p class="pingcode-sync-message is-error" role="alert">${esc(state.error)}</p>` : ''}
            ${state.detailsLoading ? '<p class="pingcode-empty">正在读取同步记录…</p>' : `<section class="pingcode-run" aria-label="同步运行"><header><h4>最近运行</h4><span class="pingcode-run-status" data-status="${esc(run?.status || 'IDLE')}">${esc(labels[run?.status] || '尚未运行')}</span>
              ${run?.status === 'COLLECTING' ? `<button type="button" class="button secondary" data-pc-cancel ${state.busy ? 'disabled' : ''}>${icon('square')}中断</button>` : ''}</header>
              ${run ? `<div class="pingcode-run-metrics"><span><strong>${run.rowsRead ?? 0}</strong>已读取</span><span><strong>${run.srCount ?? '—'}</strong>SR</span><span><strong>${run.changedCount ?? '—'}</strong>更新</span><span><strong>${run.removedCount ?? '—'}</strong>来源移除</span></div>${run.errorCode ? `<p class="pingcode-run-error">${esc(failureLabel(run.errorCode))}</p>` : ''}` : '<p class="pingcode-empty">尚无同步记录</p>'}
            </section>
            ${state.missing && (state.missing.total || state.missing.retry) ? `<section class="pingcode-resources" aria-label="缺失图片"><header><h4>缺失图片 <strong>${state.missing.total || 0}</strong></h4>${state.missing.total && state.missing.retry?.state !== 'running' ? `<button type="button" class="button secondary" data-pc-retry ${state.busy ? 'disabled' : ''}>${icon('refresh-cw')}重试缺图</button>` : ''}</header>${state.missing.retry ? `<p role="status">${state.missing.retry.state === 'running' ? '重试中' : state.missing.retry.state === 'completed' ? '重试完成' : '重试失败'} · 已尝试 ${state.missing.retry.attempted} · 修复 ${state.missing.retry.repaired} · 失败 ${state.missing.retry.failed}</p>` : ''}${state.missing.total ? `<details><summary>查看失败明细</summary><ul>${state.missing.items.map(item => `<li><strong>${esc(item.number)}</strong> · ${esc(item.errorCode || '读取失败')}</li>`).join('')}</ul>${state.missing.total > state.missing.items.length ? `<p>仅显示前 ${state.missing.items.length} 条；重试会处理全部 ${state.missing.total} 条。</p>` : ''}</details>` : ''}</section>` : ''}
            ${renderPreview()}
            <section class="pingcode-history" aria-label="同步记录"><header><h4>同步历史</h4></header><div>${state.runs.map(item => `<button type="button" data-pc-run="${esc(item.id)}" aria-current="${run?.id === item.id ? 'true' : 'false'}"><span>${esc(labels[item.status] || item.status)}</span><time>${esc(item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN', { hour12: false }) : '')}</time></button>`).join('') || '<p class="pingcode-empty">暂无记录</p>'}</div></section>`}
          </div><footer class="pingcode-dialog-actions"><button type="button" class="button secondary" data-pc-test ${state.busy || source.state !== 'ACTIVE' ? 'disabled' : ''}>测试连接</button><button type="button" class="button primary" data-pc-start ${state.busy || source.state !== 'ACTIVE' ? 'disabled' : ''}>${icon('refresh-cw')}预览同步</button></footer>`
          : '<header class="pingcode-dialog-header"><h3 id="pingcode-detail-title">来源详情</h3><button type="button" class="icon-button" data-pc-detail-close aria-label="关闭详情">×</button></header>'}
      </dialog>
      <dialog data-pc-add-dialog aria-labelledby="pingcode-add-title"><form data-pc-form><header><h3 id="pingcode-add-title">添加 Pingcode 来源</h3><button type="button" class="icon-button" data-pc-add-close aria-label="关闭">${icon('x')}</button></header>
        <label>来源名称<input name="name" required maxlength="255" autocomplete="off"></label><label>来源类型<select name="type"><option value="REQUIREMENT">需求基线</option><option value="TICKET">工单视图</option></select></label>
        <label>来源 URL<input name="url" type="url" required placeholder="https://pingcode.yasdb.com/..."></label><p data-pc-form-status role="status" aria-live="polite"></p><p data-pc-form-error role="alert" hidden></p>
        <footer><button type="button" class="button secondary" data-pc-add-close>取消</button><button type="submit" class="button primary">保存来源</button></footer></form></dialog>
    </section>`;
    window.lucide?.createIcons();
    const detailDialog = root.querySelector('[data-pc-detail-dialog]');
    const addDialog = root.querySelector('[data-pc-add-dialog]');
    if (state.dialogOpen && !detailDialog.open) detailDialog.showModal();
    if (state.addDialogOpen && !addDialog.open) addDialog.showModal();
    detailDialog.addEventListener('close', () => {
      if (root.querySelector('[data-pc-detail-dialog]') === detailDialog) state.dialogOpen = false;
    });
    addDialog.addEventListener('close', () => {
      if (root.querySelector('[data-pc-add-dialog]') === addDialog) state.addDialogOpen = false;
    });
  }

  async function loadRuns() { state.runs = selectedId() ? await request(`/sources/${encodeURIComponent(selectedId())}/runs`) : []; }
  async function loadPreview() {
    if (!state.run || !['AWAITING_CONFIRM', 'CONFIRMED', 'CONFIRMED_MISSING_IMAGES'].includes(state.run.status)) return;
    state.preview = await request(`/runs/${encodeURIComponent(state.run.id)}/preview?page=${state.page}&pageSize=50&view=${state.view}`);
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
      state.run = await request(`/runs/${encodeURIComponent(runId)}`);
      await loadRuns();
    }
  }
  async function loadSelectedDetails() {
    if (!state.dialogOpen || !state.selected) return;
    const token = generation;
    state.detailsLoading = true; state.error = ''; render();
    try {
      await loadRuns();
      state.run = state.runs.find(item => item.id === state.run?.id) || state.runs[0] || null;
      if (state.run?.status === 'COLLECTING') poll(state.run.id, token);
      else { await loadPreview(); await loadMissing(token); }
    } catch (e) { state.error = e.message; }
    finally { state.detailsLoading = false; render(); }
  }
  async function loadSources() {
    busy(true); state.sourceError = '';
    try {
      state.sources = await request('/sources');
      state.sourcesState = 'ready';
      state.selected = state.sources.find(item => item.id === selectedId()) || null;
      state.error = '';
    } catch (e) {
      state.sourcesState = 'error'; state.sourceError = e.message;
    } finally { busy(false); render(); }
  }
  async function poll(runId, token) {
    if (token !== generation || !root.isConnected) return;
    try {
      const run = await request(`/runs/${encodeURIComponent(runId)}`);
      if (token !== generation || state.run?.id !== runId) return;
      state.run = run; render();
      if (run.status === 'COLLECTING') timer = setTimeout(() => poll(runId, token), 600);
      else { await loadRuns(); await loadPreview(); await loadMissing(token); render(); }
    } catch (e) { if (token === generation) showError(e); }
  }
  async function openSource(id) {
    stop(); state.selected = state.sources.find(item => item.id === id) || null;
    if (!state.selected) return;
    state.dialogOpen = true; state.runs = []; state.run = null; state.preview = null;
    state.missing = null; state.page = 1; state.decisions = {}; state.view = 'current';
    render(); await loadSelectedDetails();
  }

  root.addEventListener('click', async event => {
    const button = event.target.closest('button');
    const row = event.target.closest('[data-pc-source]');
    if (row && !event.target.closest('a,button')) { await openSource(row.dataset.pcSource); return; }
    if (!button || !root.contains(button)) return;
    if (button.type === 'submit') return;
    if (button.dataset.pcOpen) { await openSource(button.dataset.pcOpen); return; }
    if (button.hasAttribute('data-pc-add')) { state.addDialogOpen = true; render(); root.querySelector('[data-pc-add-dialog]')?.querySelector('input')?.focus(); return; }
    if (button.hasAttribute('data-pc-add-close')) {
      state.addDialogOpen = false;
      root.querySelector('[data-pc-add-dialog]')?.close();
      return;
    }
    if (button.hasAttribute('data-pc-detail-close')) { root.querySelector('[data-pc-detail-dialog]')?.close(); return; }
    if (button.hasAttribute('data-pc-refresh')) { await loadSources(); return; }
    try {
      if (button.hasAttribute('data-pc-test') || button.hasAttribute('data-pc-start')) {
        busy(true); render();
        if (button.hasAttribute('data-pc-test')) {
          const result = await request(`/sources/${encodeURIComponent(selectedId())}/test`, post({}));
          state.message = `连接成功 · ${result.rowCount ?? 0} 条 · ${result.pageCount ?? 0} 页`;
        } else {
          stop(); state.preview = null; state.missing = null; state.decisions = {}; state.page = 1; state.view = 'current';
          state.run = await request(`/sources/${encodeURIComponent(selectedId())}/runs`, post({ revision: state.selected.revision }));
          await loadRuns(); poll(state.run.id, generation);
        }
        state.error = '';
      } else if (button.hasAttribute('data-pc-cancel')) {
        stop(); busy(true); render();
        state.run = await request(`/runs/${encodeURIComponent(state.run.id)}/cancel`, post({}));
        await loadRuns();
      } else if (button.hasAttribute('data-pc-view')) {
        state.view = button.dataset.pcView; state.page = 1; await loadPreview();
      } else if (button.hasAttribute('data-pc-prev') || button.hasAttribute('data-pc-next')) {
        state.page += button.hasAttribute('data-pc-next') ? 1 : -1; await loadPreview();
      } else if (button.hasAttribute('data-pc-run')) {
        stop(); state.run = await request(`/runs/${encodeURIComponent(button.dataset.pcRun)}`);
        state.page = 1; state.preview = null; state.missing = null; state.decisions = {};
        if (state.run.status === 'COLLECTING') poll(state.run.id, generation); else { await loadPreview(); await loadMissing(); }
      } else if (button.hasAttribute('data-pc-confirm')) {
        busy(true); render();
        state.run = await request(`/runs/${encodeURIComponent(state.run.id)}/confirm`, post({
          digest: state.preview.run.digest, expectedRevision: state.selected.revision, primarySources: state.decisions,
        }));
        state.selected = await request(`/sources/${encodeURIComponent(selectedId())}`);
        await loadRuns(); await loadPreview(); await loadMissing(); state.message = '同步已确认';
      } else if (button.hasAttribute('data-pc-retry')) {
        busy(true); render();
        await request(`/runs/${encodeURIComponent(state.run.id)}/resources/retry`, post({}));
        await loadMissing(); state.message = '已开始重试缺失图片';
      }
      state.error = '';
    } catch (e) { state.error = e.code === 'PRIMARY_SOURCE_DECISION_REQUIRED' ? '请在“来源冲突”中逐项选择主来源' : e.message; }
    finally { busy(false); render(); }
  });
  root.addEventListener('keydown', async event => {
    const row = event.target.closest('[data-pc-source]');
    if (row && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); await openSource(row.dataset.pcSource); }
  });
  root.addEventListener('input', event => {
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
    if (event.target.matches('[data-pc-type]')) { state.type = event.target.value; render(); }
    if (event.target.matches('[data-pc-enabled]')) { state.enabled = event.target.value; render(); }
    if (event.target.matches('[data-pc-primary]')) {
      const number = event.target.dataset.pcPrimary;
      if (event.target.value) state.decisions[number] = event.target.value;
      else delete state.decisions[number];
    }
  });
  root.addEventListener('submit', async event => {
    if (!event.target.matches('[data-pc-form]')) return;
    event.preventDefault();
    const form = event.target, input = Object.fromEntries(new FormData(form));
    const submit = form.querySelector('button[type="submit"]'); submit.disabled = true;
    const originalLabel = submit.textContent;
    submit.textContent = '保存中…';
    form.querySelector('[data-pc-form-status]').textContent = '正在登记来源…';
    try {
      state.selected = await request('/sources', post(input));
      state.run = null; state.preview = null; state.runs = []; state.error = '';
      state.message = '';
      state.sources = await request('/sources'); state.sourcesState = 'ready';
      state.addDialogOpen = false; state.dialogOpen = true; render(); await loadSelectedDetails();
      state.message = '来源已添加'; render();
    } catch (e) {
      const message = form.querySelector('[data-pc-form-error]');
      message.textContent = e.message; message.hidden = false; submit.disabled = false;
      submit.textContent = originalLabel;
      form.querySelector('[data-pc-form-status]').textContent = '';
    }
  });
  render(); loadSources();
}
