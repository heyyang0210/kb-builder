import { escapeHtml as esc } from '../../common/utils/dom.js';
import { markDynamicSelects, syncSearchableSelect } from '../../common/searchable-combobox.js';

export const hasModelDraft = () => document.querySelector('[data-model-admin]')?.dataset.dirty === 'true';
export const confirmLeavingModels = () => !hasModelDraft() || window.confirm('模型配置尚未保存，确定离开？');

export function mountModelConnection(root, options = {}) {
  if (root.dataset.mounted) return;
  root.dataset.mounted = 'true';
  let projection; let busy = false; let nextClientId = 0;
  const status = message => { root.querySelector('[data-model-status]').textContent = message; };
  async function request(suffix = '', body) {
    const response = await fetch(`${options.baseUrl || "/knowledge-center/api/platform/models"}${suffix}`, {
      method: body ? (suffix ? 'POST' : 'PUT') : 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(body ? { 'If-Match': projection.rowVersion } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 401) window.dispatchEvent(new CustomEvent('knowledge-center:session-expired'));
    if (response.status === 403) window.dispatchEvent(new CustomEvent('knowledge-center:permission-denied'));
    const result = await response.json();
    if (!response.ok || result.success === false) throw new Error(result.error?.message || '模型服务暂不可用');
    return result.data;
  }
  const preferenceKey = id => `knowledge-center:model-test:${id}`;
  function rememberedModel(id) { try { return localStorage.getItem(preferenceKey(id)); } catch (_) { return null; } }
  function rememberModel(id, model) { if (!model) return; try { localStorage.setItem(preferenceKey(id), model); } catch (_) { /* 存储受限时仍允许测试。 */ } }
  const field = (label, name, value, type = 'text', attrs = '') => `<label>${label}<input name="${name}" type="${type}" value="${esc(value ?? '')}" ${attrs}></label>`;
  function addRow(s = {}) {
    const p = projection.limits;
    const row = document.createElement('section'); row.className = 'model-service';
    row.dataset.serviceId = s.id || ''; row.dataset.clientId = `new-${++nextClientId}`;
    const choices = (items, selected) => items.map(v => `<option value="${esc(v.value)}" ${v.value === selected ? 'selected' : ''}>${esc(v.label)}</option>`).join('');
    const provider = s.provider || p.providers[0].value;
    const preset = p.providers.find(item => item.value === provider);
    row.innerHTML = `<div class="model-service-line"><details class="model-service-editor" ${s.id ? '' : 'open'}><summary class="model-service-summary"><strong data-service-title>${esc(s.name || '新模型服务')}</strong><span data-service-description></span><span data-service-state></span><button type="button" class="button secondary model-test-saved" data-test-saved>测试</button></summary><div class="model-service-body">
      <div class="model-basic-grid">
      <label>模型服务商<select name="provider">${choices(p.providers, provider)}</select><small>公司统一提供的接口请选择“其他兼容服务”。</small></label>
      ${field('显示名称', 'name', s.name || preset.label, 'text', `required maxlength="${p.maxNameChars}" aria-label="显示名称"`)}
      <label>API 地址<input name="base_url" type="url" required value="${esc(s.base_url || preset.baseUrl || '')}" placeholder="https://服务地址/v1"><small>填写服务商提供的基础地址，通常以 /v1 结尾，无需添加 /chat/completions。</small></label>
      <label>访问密钥（API Key）<input name="api_key" type="password" autocomplete="new-password" placeholder="${s.api_key_configured ? '已保存密钥，无需重复填写' : '粘贴服务商提供的 API Key'}"><small>${s.api_key_configured ? '留空继续使用已保存密钥；输入新密钥可替换。' : '密钥加密保存，保存后不会回显。'}</small></label>
      <label class="model-wide">可用模型<textarea name="models" rows="2" required placeholder="填写服务商给出的模型名称；多个模型请换行">${esc((s.models || []).join('\n'))}</textarea><small>填写准确的模型标识。保存后，写作页面可选择这里的模型。</small></label></div>
      <details class="model-advanced"><summary>高级设置 · 接口格式与生成参数</summary><div class="model-basic-grid">
      <label>接口格式<select name="protocol">${choices(p.protocols, s.protocol)}</select><small>通常使用 Chat Completions；仅在服务商要求时选择 Responses。</small></label>
      ${field('请求超时（毫秒）', 'timeout', s.timeout ?? p.defaultTimeoutMs, 'number', `required min="${p.minTimeoutMs}" max="${p.maxTimeoutMs}"`)}
      ${field('最大输出长度（Token）', 'max_tokens', s.max_tokens ?? p.defaultMaxTokens, 'number', `required min="${p.minOutputTokens}" max="${p.maxOutputTokens}"`)}
      <label>创作随机性（温度）<input name="temperature" type="number" value="${esc(s.temperature ?? p.defaultTemperature)}" required min="${p.minTemperature}" max="${p.maxTemperature}" step="any"><small>数值越低越稳定；不确定时保留默认值。</small></label>
      <label class="mcp-check"><input name="clearApiKey" type="checkbox">清除已保存的密钥（清除后无法调用）</label></div>
      <p>更换地址、接口格式或服务商时，请重新填写密钥。</p></details>
      <div class="model-service-footer"><label class="mcp-check"><input name="enabled" type="checkbox" ${s.enabled !== false ? 'checked' : ''}>在写作页启用</label>
      <div class="mcp-actions"><label>连接测试使用的模型<select name="testModel"></select></label><button class="button secondary" type="button" data-test-model>测试连接</button></div></div></div></details><button type="button" class="button secondary model-remove platform-danger" data-remove-model aria-label="删除模型服务">删除</button></div><div data-row-result role="status" aria-live="polite"></div>`;
    root.querySelector('[data-model-rows]').append(row);
    let suggestedAddress = s.id ? null : (preset.baseUrl || '');
    let suggestedName = s.id ? null : preset.label;
    row.querySelector('[name=provider]').addEventListener('change', () => {
      const next = p.providers.find(item => item.value === row.querySelector('[name=provider]').value);
      const address = row.querySelector('[name=base_url]'); const name = row.querySelector('[name=name]');
      if (!address.value || address.value === suggestedAddress) { address.value = next.baseUrl || ''; suggestedAddress = address.value; }
      if (!name.value || name.value === suggestedName) { name.value = next.label; suggestedName = name.value; }
    });
    row.querySelector('[data-remove-model]').onclick = () => {
      if (s.id && !window.confirm(`移除“${s.name}”？保存后将不能在写作页选择此服务。`)) return;
      row.remove(); markDirty(); refreshDefaults();
    };
    row.querySelector('[data-test-model]').onclick = () => testService(row, true);
    row.querySelector('[data-test-saved]').onclick = event => { event.preventDefault(); event.stopPropagation(); testService(row, false); };
    row.querySelector('[name=testModel]').addEventListener('change', event => rememberModel(row.dataset.serviceId || row.dataset.clientId, event.target.value));
    refreshTestModels(row); refreshSummary(row);
    markDynamicSelects(row);
    if (!s.id) row.querySelector('[name=name]').focus();
  }
  async function testService(row, includeUnsavedChanges) {
    const button = row.querySelector(includeUnsavedChanges ? '[data-test-model]' : '[data-test-saved]');
    const resultNode = row.querySelector('[data-row-result]');
    if (busy) return;
    busy = true; root.querySelector('fieldset').disabled = true;
    button.setAttribute('aria-busy', 'true');
    function showResult(state, title, detail) {
      resultNode.dataset.state = state;
      const heading = document.createElement('strong'); heading.textContent = title;
      const info = document.createElement('span'); info.textContent = detail;
      resultNode.replaceChildren(heading, info);
    }
    showResult('pending', '测试中…', '正在连接模型服务');
    try {
      let service; let model;
      if (includeUnsavedChanges) { service = readRow(row); model = row.querySelector('[name=testModel]').value; }
      else {
        const saved = projection.services.find(item => item.id === row.dataset.serviceId);
        if (!saved) throw new Error('请先保存服务配置，再测试连接。');
        service = { ...saved, api_key: '', clearApiKey: false };
        const selected = row.querySelector('[name=testModel]').value;
        model = saved.models.includes(selected) ? selected : saved.models[0];
      }
      const result = await request('/test', { service, model });
      rememberModel(row.dataset.serviceId || row.dataset.clientId, model);
      showResult('success', '测试成功', `${result.requestedModel} · 首字 ${result.firstByteMs} 毫秒 · 总耗时 ${result.latencyMs} 毫秒${result.actualModel && result.actualModel !== result.requestedModel ? ` · 实际模型：${result.actualModel}` : ''}`);
    } catch (error) { showResult('error', '测试失败', error.message); }
    finally { busy = false; root.querySelector('fieldset').disabled = false; button.setAttribute('aria-busy', 'false'); }
  }

  function refreshSummary(row) {
    const service = readRow(row);
    const provider = projection.limits.providers.find(item => item.value === service.provider)?.label || service.provider;
    row.querySelector('[data-service-title]').textContent = service.name || '新模型服务';
    const description = row.querySelector('[data-service-description]');
    description.textContent = `${provider} · ${service.models.length ? `${service.models.length} 个模型` : '尚未填写模型'}`;
    description.title = service.models.join('、');
    row.querySelector('[data-service-state]').textContent = service.enabled ? '已启用' : '已停用';
    row.querySelector('[data-service-state]').className = `platform-status ${service.enabled ? 'is-success' : 'is-neutral'}`;
    row.querySelector('[data-remove-model]').setAttribute('aria-label', `删除${service.name || '新模型服务'}`);
  }
  function refreshTestModels(row) {
    const select = row.querySelector('[name=testModel]'); const previous = select.value || rememberedModel(row.dataset.serviceId || row.dataset.clientId);
    select.replaceChildren(...readRow(row).models.map(model => new Option(model, model)));
    if ([...select.options].some(v => v.value === previous)) select.value = previous;
    syncSearchableSelect(select);
  }
  function readRow(row) {
    const v = name => row.querySelector(`[name=${name}]`);
    return { ...(row.dataset.serviceId ? { id: row.dataset.serviceId } : { clientId: row.dataset.clientId }),
      name: v('name').value, provider: v('provider').value, protocol: v('protocol').value, base_url: v('base_url').value,
      api_key: v('api_key').value, clearApiKey: v('clearApiKey').checked, enabled: v('enabled').checked,
      timeout: Number(v('timeout').value), max_tokens: Number(v('max_tokens').value), temperature: Number(v('temperature').value),
      models: v('models').value.split('\n').map(s => s.trim()).filter(Boolean) };
  }
  function refreshDefaults(preferred) {
    const select = root.querySelector('[data-model-default]'); const previous = preferred || select.value;
    select.replaceChildren(new Option('请选择默认模型', ''));
    root.querySelectorAll('.model-service').forEach(row => {
      const service = readRow(row); if (!service.enabled) return;
      service.models.forEach(model => { const value = JSON.stringify({ serviceId: service.id || service.clientId, model }); select.add(new Option(`${service.name || '新服务'} / ${model}`, value)); });
    });
    if (previous && [...select.options].some(v => v.value === previous)) select.value = previous;
    else if (!previous && !projection.defaultSelection && select.options.length > 1) select.selectedIndex = 1;
    syncSearchableSelect(select);
  }
  function refreshListState() {
    const count = root.querySelectorAll('.model-service').length;
    root.querySelector('.model-service-count').textContent = count;
    root.querySelector('.model-empty').hidden = count > 0;
  }
  function markDirty() { root.dataset.dirty = 'true'; options.onDirty?.(); refreshListState(); }
  async function perform(action, successMessage = '配置已保存，新写作任务将使用此配置。') {
    if (busy) return; busy = true; root.querySelector('fieldset').disabled = true; root.setAttribute('aria-busy', 'true'); status('正在处理…');
    try { await action(); status(successMessage); } catch (error) { status(error.message); }
    finally { busy = false; root.querySelector('fieldset').disabled = false; root.setAttribute('aria-busy', 'false'); }
  }
  function draw() {
    root.innerHTML = `<p data-model-status role="status" aria-live="polite"></p><form><fieldset><legend class="model-form-legend">模型服务配置</legend><div class="model-list-heading"><h3>模型服务 <span class="model-service-count">${projection.services.length}</span></h3><button type="button" class="button primary model-add" data-model-add aria-label="添加模型服务" title="添加模型服务"><span aria-hidden="true">＋</span> 添加服务</button></div><div data-model-rows></div><p class="model-empty">暂无模型服务，点击“添加服务”开始配置。</p><div class="model-settings-bar"><label class="model-default-block" ${options.selectionManagedExternally ? 'hidden' : ''}>写作默认模型<select data-model-default></select></label><div class="mcp-actions"><button type="button" class="button secondary" data-model-reload>取消修改</button><button type="submit" class="button primary">保存配置</button></div></div><p class="model-save-hint">修改后保存生效；点击服务行可展开编辑。</p></fieldset></form>`;
    projection.services.forEach(addRow); refreshDefaults(projection.defaultSelection ? JSON.stringify(projection.defaultSelection) : '');
    root.dataset.dirty = 'false'; refreshListState();
    root.querySelector('form').onsubmit = event => { event.preventDefault(); perform(async () => {
      const value = root.querySelector('[data-model-default]').value;
      const testModels = [...root.querySelectorAll('.model-service')].map(row => row.querySelector('[name=testModel]').value);
      projection = await request('', { services: [...root.querySelectorAll('.model-service')].map(readRow), defaultSelection: value ? JSON.parse(value) : null });
      projection.services.forEach((service, index) => { if (service.models.includes(testModels[index])) rememberModel(service.id, testModels[index]); });
      draw(); options.onSaved?.();
    }, '配置已保存，新写作任务将使用此配置。'); };
    root.querySelector('[data-model-add]').onclick = () => { if (root.querySelectorAll('.model-service').length >= projection.limits.maxServices) { status('已达到服务数量上限'); return; } addRow(); markDirty(); };
    root.querySelector('[data-model-reload]').onclick = () => { if (root.dataset.dirty !== 'true' || window.confirm('模型连接尚未保存，确定放弃修改？')) perform(async () => { projection = await request(); draw(); }, '已读取保存的配置。'); };
  }
  root.addEventListener('input', event => { if (event.target.name === 'testModel') return; markDirty(); const row = event.target.closest('.model-service'); if (row) { refreshSummary(row); if (event.target.name === 'models') refreshTestModels(row); refreshDefaults(); } });
  root.addEventListener('change', event => { if (event.target.name === 'testModel') return; markDirty(); const row = event.target.closest('.model-service'); if (row) refreshSummary(row); refreshDefaults(); });
  root.addEventListener('invalid', event => {
    let parent = event.target.parentElement;
    while (parent && parent !== root) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; }
  }, true);
  root.innerHTML = '<p data-model-status role="status">正在读取模型配置…</p><fieldset><button type="button" class="button secondary" data-model-retry>重新读取</button></fieldset>';
  root.querySelector('[data-model-retry]').onclick = () => perform(async () => { projection = await request(); draw(); }, '已读取保存的配置。');
  perform(async () => { projection = await request(); draw(); }, '').catch(() => {});
}
