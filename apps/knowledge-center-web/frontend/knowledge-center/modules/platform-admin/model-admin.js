import { escapeHtml as esc } from '../../common/utils/dom.js';
import { mountModelConnection } from './model-connection.js';
import { mountMcpAdmin } from './mcp-admin.js';
import { markDynamicSelects, cleanupSearchableSelects } from '../../common/searchable-combobox.js';
export const hasModelDraft = () => [...document.querySelectorAll('[data-model-admin],[data-agent-model],[data-mcp-admin]')].some(n => n.dataset.dirty === 'true');
export const confirmLeavingModels = () => !hasModelDraft() || window.confirm('Agent 配置尚未保存，确定离开？');
export function mountModelAdmin(root) {
  if (root.dataset.mounted) return;
  root.dataset.mounted = 'true'; root.classList.add('agent-admin');
  let catalog, selected, model, busy = false, runningId = null, eventSource;
  const runStates = new Map();
  const stopWatching = () => { eventSource?.close(); eventSource = null; };
  const observer = new MutationObserver(() => { if (!root.isConnected) { stopWatching(); observer.disconnect(); } });
  observer.observe(document.body, { childList: true, subtree: true });
  const names = { codex: 'Codex', deepseek: 'DeepSeek Harness', workflow: '平台内置工作流' };
  const creatableNames = { codex: names.codex, workflow: names.workflow };
  const status = text => { const node = root.querySelector('[data-agent-status]'); if (node) { node.textContent = text; node.classList.toggle('is-run-message', /^(正在运行|运行成功|试运行成功|已取消|运行未完成|连接中断)/.test(text)); } };
  const runPanel = () => {
    const state = runStates.get(selected.id) || 'idle';
    const labels = { idle: '尚未运行测试', running: '正在运行', completed: selected.executor === 'deepseek' ? '试运行通过' : '运行通过', failed: '运行未完成', cancelled: '已取消', interrupted: '运行已中断', disconnected: '连接中断', stale: '需要重新测试' };
    const detail = state === 'completed' ? (selected.executor === 'deepseek' ? '模型响应已验证' : '文档文件已校验') : state === 'failed' ? '请检查模型连接' : '';
    return `<div class="agent-run-overview ${esc(state)}" data-agent-run-overview role="status" aria-live="polite"><h4>运行测试</h4><strong>${labels[state]}</strong>${detail ? `<span>${detail}</span>` : ''}</div>`;
  };
  const setRunState = state => {
    runStates.set(selected.id, state);
    const panel = root.querySelector('[data-agent-run-overview]');
    if (panel) panel.outerHTML = runPanel();
  };
  async function request(suffix = '', body, method, version) {
    const response = await fetch(`/knowledge-center/api/platform/agents${suffix}`, { method: method || (body ? 'PUT' : 'GET'), credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(body ? { 'If-Match': version || catalog.rowVersion } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.status === 401) window.dispatchEvent(new CustomEvent('knowledge-center:session-expired'));
    if (response.status === 403) window.dispatchEvent(new CustomEvent('knowledge-center:permission-denied'));
    let result;
    try {
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error();
      result = await response.json();
    } catch (_) {
      throw new Error('Agent 服务暂不可用，请稍后重新读取');
    }
    if (!response.ok || result.success === false) throw new Error(result.error?.message || 'Agent 服务暂不可用');
    return result.data;
  }
  async function perform(action) {
    if (busy) return; busy = true; root.setAttribute('aria-busy', 'true');
    try { await action(); } catch (error) { status(error.message); }
    finally { busy = false; root.removeAttribute('aria-busy'); }
  }
  async function load(id) {
    stopWatching(); runningId = null;
    catalog = await request(); selected = catalog.agents.find(a => a.id === id) || catalog.agents.find(a => a.id === catalog.defaultAgentId) || catalog.agents[0];
    model = await request(`/${selected.id}/models`); draw();
  }
  function draw() {
    root.dataset.dirty = 'false';
    const choices = model.services.filter(s => s.enabled).flatMap(s => s.models.map(m => ({ serviceId: s.id, model: m, provider: s.name })));
    const current = model.defaultSelection;
    const readiness = selected.executor === 'deepseek' ? selected.readiness : null;
    const readinessSummary = readiness?.ready ? '试运行环境已就绪' : '试运行未就绪';
    const isDsh = selected.executor === 'deepseek';
    const trialModelLabel = isDsh && readiness?.modelSource === 'platform' ? readiness.modelName : null;
    const cardState = agent => agent.executor === 'deepseek'
      ? (agent.readiness?.ready ? '可试运行' : '未就绪')
      : agent.id === catalog.defaultAgentId ? '默认' : agent.enabled ? '已启用' : '已停用';
    root.innerHTML = `<header class="agent-section-head"><span>${catalog.agents.length} 套 Agent</span><button class="button secondary" data-agent-add><i data-lucide="plus" aria-hidden="true"></i>新建 Agent</button></header>
      <div class="agent-workspace">
        <aside class="agent-list" aria-label="Agent 列表"><label class="agent-mobile-select">当前 Agent<select data-agent-mobile-select>${catalog.agents.map(a => `<option value="${esc(a.id)}" ${a.id === selected.id ? 'selected' : ''}>${esc(a.name)} · ${esc(cardState(a))}</option>`).join('')}</select></label><div class="agent-list-heading">文档生产</div>${catalog.agents.filter(a => a.executor !== 'deepseek').map(a => `<button class="agent-card" data-agent-select="${esc(a.id)}" aria-pressed="${a.id === selected.id}"><strong>${esc(a.name)}</strong><small>${esc(cardState(a))}</small><span>${esc(names[a.executor])}</span></button>`).join('')}${catalog.agents.some(a => a.executor === 'deepseek') ? '<div class="agent-list-heading agent-trial-heading">管理员试运行</div>' : ''}${catalog.agents.filter(a => a.executor === 'deepseek').map(a => `<button class="agent-card is-dsh" data-agent-select="${esc(a.id)}" aria-pressed="${a.id === selected.id}"><strong>${esc(a.name)}</strong><small class="${a.readiness?.ready ? '' : 'is-not-ready'}">${esc(cardState(a))}</small><span>不参与文档生产</span></button>`).join('')}</aside>
        <section class="agent-editor" aria-label="Agent 设置">
          <header class="agent-editor-head"><div class="agent-editor-title"><h3>${esc(selected.name)}</h3><span>${esc(names[selected.executor])}</span>${selected.id === catalog.defaultAgentId ? '<small class="agent-default-badge">默认 Agent</small>' : ''}</div><div class="agent-header-actions">${isDsh ? '' : `<label class="mcp-inline-check"><input type="checkbox" data-agent-enabled ${selected.enabled ? 'checked' : ''}>已启用</label>`}<button class="button secondary" data-agent-cancel hidden>取消运行</button><button class="button secondary" data-agent-test>${isDsh ? '启动试运行' : '运行测试'}</button><button class="button primary" data-agent-save>保存</button></div></header>
          <div class="agent-editor-workspace"><div class="agent-editor-body">
            <section class="agent-settings-group"><h4>模型配置</h4>
              <div class="agent-setting-row"><span>模型</span><div class="agent-setting-value agent-model-value"><details class="agent-model-picker"><summary>${esc(current?.model || trialModelLabel || '选择模型')} <span>${trialModelLabel && !current?.model ? '平台默认' : selected.executor === 'codex' ? ({ low: '低', medium: '标准', high: '高', xhigh: '极高' }[selected.reasoningEffort]) : '模型选项'} ⌄</span></summary><div class="agent-model-menu"><label>模型<select data-agent-model-choice><option value="">${trialModelLabel ? '沿用平台默认模型' : '请选择模型'}</option>${choices.map(m => `<option value="${esc(JSON.stringify({ serviceId: m.serviceId, model: m.model }))}" ${m.serviceId === current?.serviceId && m.model === current?.model ? 'selected' : ''}>${esc(m.provider)} / ${esc(m.model)}</option>`).join('')}</select></label>${selected.executor === 'codex' ? `<label>推理强度<select data-agent-effort>${[['low','低'],['medium','标准'],['high','高'],['xhigh','极高']].map(([v,t]) => `<option value="${v}" ${selected.reasoningEffort === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}</div></details><button class="button secondary" data-agent-open="model">连接设置</button></div></div>
            </section>
            <section class="agent-settings-group"><h4>知识库工具</h4>${isDsh ? '<div class="agent-setting-row"><span>MCP 服务</span><strong>试运行关闭</strong></div>' : '<div class="agent-setting-row" data-agent-mcp-row><span>MCP 服务</span><div class="agent-setting-value"><span data-agent-mcp-summary role="status">正在读取…</span><button class="button secondary" data-agent-open="mcp">配置</button></div></div>'}</section>
            <section class="agent-settings-group"><h4>运行范围</h4><div class="agent-setting-row"><span>${isDsh ? '执行方式' : '文档写作'}</span><div class="agent-setting-value"><span>${isDsh ? '完整 SDK · 管理员试运行' : '任务工作区'}</span>${isDsh ? '' : '<details class="agent-permissions"><summary>查看权限</summary><p>使用文档生产中选定的技能，在任务工作区交付文件。</p></details>'}</div></div></section>
            <section class="agent-settings-group"><h4>基本信息</h4><div class="agent-setting-row"><label for="agent-setting-name">名称</label><div class="agent-setting-value"><input id="agent-setting-name" data-agent-name value="${esc(selected.name)}" maxlength="80"></div></div>${isDsh ? '' : `<div class="agent-setting-row"><span>默认 Agent</span><label class="mcp-inline-check"><input data-agent-default type="checkbox" ${selected.id === catalog.defaultAgentId ? 'checked' : ''}>用于文档生成</label></div>`}</section>
            <p data-agent-status role="status" aria-live="polite"></p>
          </div><aside class="agent-run-panel" aria-label="运行测试状态">${runPanel()}${readiness ? `<section class="agent-readiness-banner ${readiness.ready ? 'is-ready' : 'is-blocked'}" data-agent-readiness role="status"><div><strong>${esc(readinessSummary)}</strong></div><details><summary>查看${readiness.blockers?.length ? `${readiness.blockers.length} 项` : ''}运行条件</summary>${readiness.blockers?.length ? `<ul>${readiness.blockers.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p>当前配置已通过运行预检。</p>'}</details></section>` : ''}</aside></div>
        </section>
      </div>
      <dialog class="agent-settings-dialog" data-agent-settings="model" aria-labelledby="agent-model-title"><header><h3 id="agent-model-title">模型连接</h3><button class="button secondary" data-agent-close>完成</button></header><div class="agent-dialog-content" data-agent-model></div></dialog>
      ${isDsh ? '' : '<dialog class="agent-settings-dialog" data-agent-settings="mcp" aria-labelledby="agent-mcp-title"><header><h3 id="agent-mcp-title">MCP 配置</h3><button class="button secondary" data-agent-close>完成</button></header><div class="agent-dialog-content" data-mcp-admin></div></dialog>'}
      <dialog data-agent-dialog><h3>新建 Agent</h3><label>Agent 类型<select data-new-executor>${Object.entries(creatableNames).map(([v,t]) => `<option value="${v}">${t}</option>`).join('')}</select></label><div class="agent-dialog-actions"><button class="button secondary" data-new-cancel>取消</button><button class="button primary" data-new-save>创建</button></div></dialog>`;
    cleanupSearchableSelects();
    markDynamicSelects(root);
    root.querySelectorAll('[data-agent-open]').forEach(button => {
      button.onclick = () => root.querySelector(`[data-agent-settings="${button.dataset.agentOpen}"]`).showModal();
    });
    if (readiness && !readiness.ready) {
      const testButton = root.querySelector('[data-agent-test]');
      testButton.disabled = true;
      testButton.title = (readiness.blockers || []).join('；');
    }
    root.querySelectorAll('[data-agent-settings]').forEach(dialog => {
      const close = event => {
        event?.preventDefault();
        if (dialog.querySelector('[aria-busy="true"]')) return;
        dialog.close();
      };
      dialog.querySelector('[data-agent-close]').onclick = close;
      dialog.addEventListener('cancel', close);
    });
    mountModelConnection(root.querySelector('[data-agent-model]'), { baseUrl: `/knowledge-center/api/platform/agents/${selected.id}/models`, selectionManagedExternally: true, onSaved: async () => {
      catalog = await request();
      selected = catalog.agents.find(agent => agent.id === selected.id) || selected;
      model = await request(`/${selected.id}/models`);
      updatePicker(true);
      setRunState('stale');
      if (isDsh) {
        const state = selected.readiness;
        const banner = root.querySelector('[data-agent-readiness]');
        banner.classList.toggle('is-ready', state.ready);
        banner.classList.toggle('is-blocked', !state.ready);
        banner.querySelector('strong').textContent = state.ready ? '试运行环境已就绪' : '试运行未就绪';
        banner.querySelector('details').innerHTML = `<summary>查看${state.blockers?.length ? `${state.blockers.length} 项` : ''}运行条件</summary>${state.blockers?.length ? `<ul>${state.blockers.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p>当前配置已通过运行预检。</p>'}`;
        const testButton = root.querySelector('[data-agent-test]');
        testButton.disabled = !state.ready;
        testButton.title = state.blockers?.join('；') || '';
        root.querySelector(`[data-agent-select="${selected.id}"] small`).textContent = state.ready ? '可试运行' : '未就绪';
      }
      status('连接已保存');
    } });
    let firstMcpSnapshot = true;
    if (!isDsh) mountMcpAdmin(root.querySelector('[data-mcp-admin]'), {
      baseUrl: `/knowledge-center/api/platform/agents/${selected.id}/mcp`,
      onSnapshot: snapshot => {
        if (!firstMcpSnapshot) setRunState('stale');
        firstMcpSnapshot = false;
        const services = snapshot.services || [];
        const count = services.reduce((sum, service) => sum + (service.knowledgeBases?.length || 0), 0);
        root.querySelector('[data-agent-mcp-summary]').textContent = services.length ? `${services[0].name} · ${services.length} 个服务 · ${count} 个知识库` : '未配置';
      },
      onError: () => { root.querySelector('[data-agent-mcp-summary]').textContent = '读取失败，请打开配置重试'; },
    });
    root.querySelectorAll('[data-agent-select]').forEach(b => { b.onclick = () => { if (!confirmLeavingModels()) return; perform(() => load(b.dataset.agentSelect)); }; });
    root.querySelector('[data-agent-mobile-select]')?.addEventListener('change', event => { if (!confirmLeavingModels()) { event.target.value = selected.id; return; } perform(() => load(event.target.value)); });
    root.querySelectorAll('[data-agent-name],[data-agent-enabled],[data-agent-default],[data-agent-effort],[data-agent-model-choice]').forEach(n => n.oninput = () => { root.dataset.dirty = 'true'; setRunState('stale'); if (n.matches('[data-agent-effort],[data-agent-model-choice]')) updatePicker(); });
    root.querySelector('[data-agent-save]').onclick = () => perform(async () => {
      if ([...root.querySelectorAll('[data-agent-model],[data-mcp-admin]')].some(n => n.dataset.dirty === 'true')) throw new Error('请先保存连接设置中的修改');
      const value = root.querySelector('[data-agent-model-choice]').value;
      if (value && value !== JSON.stringify(model.defaultSelection)) await request(`/${selected.id}/models`, { services: model.services.map(s => ({ ...s, api_key: '' })), defaultSelection: JSON.parse(value) }, 'PUT', model.rowVersion);
      const fresh = await request();
      const other = fresh.agents.find(a => a.id === selected.id);
      if (!other || ['name','enabled','reasoningEffort'].some(key => other[key] !== selected[key])) throw new Error('Agent 配置已变化，请重新读取后保存');
      catalog = fresh;
      const agents = catalog.agents.map(a => a.id === selected.id ? { ...a, name: root.querySelector('[data-agent-name]').value, enabled: root.querySelector('[data-agent-enabled]')?.checked ?? false, reasoningEffort: root.querySelector('[data-agent-effort]')?.value || a.reasoningEffort } : a);
      await request('', { agents, defaultAgentId: root.querySelector('[data-agent-default]')?.checked ? selected.id : catalog.defaultAgentId });
      await load(selected.id); status('已保存');
    });
    function updatePicker(rebuild = false) {
      const select = root.querySelector('[data-agent-model-choice]');
      const fallback = isDsh && selected.readiness?.modelSource === 'platform' ? selected.readiness.modelName : null;
      if (rebuild) select.innerHTML = `<option value="">${fallback ? '沿用平台默认模型' : '请选择模型'}</option>` + model.services.filter(s => s.enabled).flatMap(s => s.models.map(m => `<option value="${esc(JSON.stringify({ serviceId: s.id, model: m }))}" ${s.id === model.defaultSelection?.serviceId && m === model.defaultSelection?.model ? 'selected' : ''}>${esc(s.name)} / ${esc(m)}</option>`)).join('');
      const chosen = select.value ? JSON.parse(select.value) : null;
      const effort = root.querySelector('[data-agent-effort]')?.value;
      root.querySelector('.agent-model-picker>summary').innerHTML = `${esc(chosen?.model || fallback || '选择模型')} <span>${!chosen && fallback ? '平台默认' : effort ? ({ low: '低', medium: '标准', high: '高', xhigh: '极高' }[effort]) : '模型选项'} ⌄</span>`;
    }
    root.querySelector('[data-agent-cancel]').onclick = () => perform(async () => {
      if (!runningId) return;
      const response = await fetch(`/knowledge-center/api/platform/agent-runs/${runningId}/cancel`, { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw new Error('取消失败，请重试');
      status('正在取消…');
    });
    root.querySelector('[data-agent-test]').onclick = () => perform(async () => {
      if (hasModelDraft()) throw new Error('请先保存配置再运行测试');
      if (runningId) return;
      const result = await request(`/${selected.id}/run-test`, {}, 'POST');
      setRunState('running'); status('正在运行…');
      runningId = result.id;
      root.querySelector('[data-agent-test]').disabled = true;
      root.querySelector('[data-agent-cancel]').hidden = false;
      eventSource = new EventSource(`/knowledge-center/api/platform/agent-runs/${result.id}/events`);
      const terminal = item => {
        const terminalState = item.kind === 'completed' ? 'completed' : item.kind === 'cancelled' ? 'cancelled' : item.kind === 'interrupted' ? 'interrupted' : 'failed';
        setRunState(hasModelDraft() ? 'stale' : terminalState);
        status(item.kind === 'completed' ? (isDsh ? '试运行成功' : '运行成功，已校验文档文件') : item.kind === 'cancelled' ? '已取消' : '运行未完成，请检查模型连接');
        runningId = null; stopWatching();
        root.querySelector('[data-agent-test]').disabled = false;
        root.querySelector('[data-agent-cancel]').hidden = true;
      };
      eventSource.onmessage = event => { const item = JSON.parse(event.data); if (['completed','failed','cancelled','interrupted'].includes(item.kind)) terminal(item); };
      eventSource.onerror = async () => {
        stopWatching();
        try {
          const response = await fetch(`/knowledge-center/api/platform/agent-runs/${result.id}`, { credentials: 'same-origin' });
          const data = await response.json();
          if (response.ok && !['running','queued','cancelling'].includes(data.data.status)) { terminal({ kind: data.data.status }); return; }
        } catch (_) {}
        setRunState('disconnected'); status('连接中断，可取消后重新运行');
      };
    });
    const dialog = root.querySelector('[data-agent-dialog]');
    root.querySelector('[data-agent-add]').onclick = () => { if (confirmLeavingModels()) dialog.showModal(); };
    root.querySelector('[data-new-cancel]').onclick = () => dialog.close();
    root.querySelector('[data-new-save]').onclick = () => perform(async () => {
      const executor = root.querySelector('[data-new-executor]').value; const before = new Set(catalog.agents.map(a => a.id));
      catalog = await request('', { agents: [...catalog.agents, { name: `${names[executor]} ${catalog.agents.length + 1}`, executor, enabled: false, reasoningEffort: 'medium' }], defaultAgentId: catalog.defaultAgentId });
      await load(catalog.agents.find(a => !before.has(a.id)).id);
    });
  }
  root.innerHTML = '<p data-agent-status role="status">正在读取 Agent 配置…</p><button class="button secondary" data-agent-retry>重新读取</button>';
  root.querySelector('[data-agent-retry]').onclick = () => perform(() => load()); perform(() => load());
}
