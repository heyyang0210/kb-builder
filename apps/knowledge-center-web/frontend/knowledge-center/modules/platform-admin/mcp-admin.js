import { escapeHtml as esc } from '../../common/utils/dom.js';
import { uiIcon } from '../../common/ui-system.js';

export const hasMcpDraft = () => document.querySelector('[data-mcp-admin]')?.dataset.dirty === 'true';
export const confirmLeavingMcp = () => !hasMcpDraft() || window.confirm('MCP 配置尚未保存，确定离开并放弃修改吗？');

export function mountMcpAdmin(root, options = {}) {
  if (root.dataset.mounted) return;
  root.dataset.mounted = 'true';
  let projection; let busy = false;
  const status = message => { root.querySelector('[data-mcp-status]').textContent = message; };
  const safe = value => esc(String(value ?? ''));
  const field = (label, name, value, attrs = '') => `<label>${label}<input name="${name}" value="${safe(value)}" ${attrs}></label>`;
  async function request(action = '', body, version) {
    const response = await fetch(`${options.baseUrl || "/knowledge-center/api/platform/mcp"}${action ? `/services/${action}` : ''}`, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(body ? { 'If-Match': version } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 401) window.dispatchEvent(new CustomEvent('knowledge-center:session-expired'));
    if (response.status === 403) window.dispatchEvent(new CustomEvent('knowledge-center:permission-denied'));
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || 'MCP 服务操作失败');
    return result.data;
  }
  function sync() {
    const rows = [...root.querySelectorAll('[data-mcp-service]')];
    rows.filter(row => row.dataset.dirty !== 'true').forEach(row => {
      const service = projection.services.find(service => service.id === row.dataset.id);
      if (service) { row.dataset.version = service.rowVersion;  }
    });
    root.dataset.dirty = String(rows.some(row => row.dataset.dirty === 'true'));
    root.querySelector('[data-mcp-count]').textContent = `${rows.length} 个服务 · ${rows.reduce((count, row) => count + row.querySelectorAll('[data-kb-row]').length, 0)} 个知识库`;
    root.querySelector('[data-mcp-empty]').hidden = rows.length > 0;
    const query = root.querySelector('[data-mcp-search]').value.trim().toLowerCase();
    rows.forEach(row => { const data = readRow(row); row.hidden = ![data.name, data.server_url, ...data.knowledgeBases.map(k => `${k.name} ${k.locator}`)].join(' ').toLowerCase().includes(query); });
    syncExpansion();
    options.onSnapshot?.(projection);
  }
  function syncExpansion() {
    const visible = [...root.querySelectorAll('[data-mcp-service]')].filter(row => !row.hidden);
    const button = root.querySelector('[data-mcp-collapse]');
    if (!button) return;
    button.textContent = visible.some(row => row.open) ? '全部收起' : '全部展开';
    button.disabled = visible.length === 0;
  }
  function dirty(row) {
    row.dataset.dirty = 'true'; row.querySelector('[data-service-savebar]').hidden = false;
    row.querySelector('[data-row-result]').replaceChildren();
    const test = row.querySelector('[data-service-test-status]'); test.textContent = '需重新测试'; test.className = 'mcp-muted';
    row.querySelectorAll('[data-kb-status]').forEach(node => { node.textContent = '未测试'; node.className = 'mcp-muted'; });
    sync();
  }
  function headerRow(row, header = {}) {
    const node = document.createElement('div'); node.className = 'mcp-custom-header';
    node.innerHTML = `${field('请求头名称', 'header_name', header.name, 'required')}${field('值', 'header_value', '', `type="password" autocomplete="new-password" placeholder="${header.valueConfigured ? '已保存，留空保留' : '请输入值'}"`)}${field('说明', 'header_description', header.description)}<button type="button" class="button secondary" data-header-remove>移除</button>${header.legacyDuplicate ? '<small class="mcp-error">历史同名项，请删除重复行并重填保留项。</small>' : ''}`;
    row.querySelector('[data-service-headers]').append(node);
  }
  function kbRow(row, kb = {}, edit = false) {
    const tr = document.createElement('tr'); tr.dataset.kbRow = ''; if (kb.id) tr.dataset.id = kb.id;
    tr.innerHTML = `<td><span data-kb-name>${safe(kb.name || '新知识库')}</span><label class="mcp-kb-edit" ${edit ? '' : 'hidden'}>知识库名称<input name="kb_name" value="${safe(kb.name)}" required maxlength="${projection.limits.maxNameChars}"></label></td><td><span data-kb-locator>${safe(kb.locator || '待填写')}</span><label class="mcp-kb-edit" ${edit ? '' : 'hidden'}>知识库 ID<input name="kb_locator" value="${safe(kb.locator)}" required></label></td><td><label class="mcp-inline-check"><input name="kb_enabled" type="checkbox" ${kb.enabled !== false ? 'checked' : ''}>启用</label></td><td><span class="mcp-muted" data-kb-status>未测试</span></td><td class="mcp-table-actions"><button type="button" class="button secondary" data-kb-verify>测试</button><button type="button" class="mcp-link" data-kb-edit>编辑</button><button type="button" class="mcp-link mcp-error" data-kb-remove>移除</button></td>`;
    row.querySelector('[data-service-kbs]').append(tr);
    if (edit) { tr.querySelectorAll('[data-kb-name],[data-kb-locator]').forEach(n => { n.hidden = true; }); tr.querySelector('input').focus(); }
  }
  function readRow(row) {
    const form = row.querySelector('form'); const v = name => form.elements.namedItem(name);
    return { ...(row.dataset.id ? { id: row.dataset.id } : {}), name: v('name').value.trim(), server_url: v('server_url').value.trim(), api_key: v('api_key').value,
      enabled: true, adapter: row.dataset.adapter || 'yashandb', clearApiKey: v('clearApiKey').checked, timeout: Number(v('timeout').value),
      cache: { enabled: v('cacheEnabled').checked, ttl: Number(v('ttl').value), max_size: Number(v('max_size').value) },
      headers: [...row.querySelectorAll('.mcp-custom-header')].map(n => ({ name: n.querySelector('[name=header_name]').value.trim(), value: n.querySelector('[name=header_value]').value, description: n.querySelector('[name=header_description]').value })),
      knowledgeBases: [...row.querySelectorAll('[data-kb-row]')].map(n => ({ ...(n.dataset.id ? { id: n.dataset.id } : {}), name: n.querySelector('[name=kb_name]').value.trim(), locator: n.querySelector('[name=kb_locator]').value.trim(), enabled: n.querySelector('[name=kb_enabled]').checked })) };
  }
  function addRow(service = {}) {
    const p = projection.limits;
    const row = document.createElement('section'); row.className = 'mcp-service'; row.dataset.mcpService = ''; row.dataset.id = service.id || ''; row.dataset.version = service.rowVersion || projection.rowVersion; row.dataset.dirty = String(!service.id); row.dataset.adapter = service.adapter || 'yashandb';
    row.innerHTML = `<details class="mcp-service-editor" ${service.id ? '' : 'open'}><summary class="mcp-service-summary"><span class="mcp-service-name"><span class="mcp-chevron" aria-hidden="true">›</span><span><strong data-service-name>${safe(service.name || '新 MCP 服务')}</strong><small data-service-kb-summary></small></span></span><span class="mcp-service-url" data-service-url title="${safe(service.server_url)}">${safe(service.server_url || '待填写服务地址')}</span><span data-service-kb-count></span><span class="mcp-muted" data-service-test-status>未测试</span><span class="mcp-summary-actions"><button type="button" class="button secondary" data-service-test>测试</button><button type="button" class="button secondary" data-service-settings>设置</button><button type="button" class="mcp-link mcp-error" data-service-delete>删除</button></span></summary>
      <form><div class="mcp-service-content"><div class="mcp-connection-settings" data-connection-settings ${service.id ? 'hidden' : ''}><div class="mcp-connection-grid">
      ${field('服务名称', 'name', service.name, `required maxlength="${p.maxNameChars}"`)}${field('服务地址', 'server_url', service.server_url, 'type="url" required placeholder="https://服务地址/mcp"')}${field('API Key', 'api_key', '', `type="password" autocomplete="new-password" placeholder="${service.api_key_configured ? '已保存，留空保留' : '可选'}"`)}${field('请求超时（毫秒）', 'timeout', service.timeout ?? p.defaultTimeoutMs, `type="number" required min="${p.minTimeoutMs}" max="${p.maxTimeoutMs}"`)}
      </div>
      <details class="mcp-advanced"><summary>高级设置 · 请求头、缓存与密钥</summary><p>更换服务地址时需重新填写或清除旧凭据。知识库 ID 在下方维护。</p><div data-service-headers></div><button type="button" class="button secondary" data-header-add>${uiIcon('action.add')}添加请求头</button><div class="mcp-connection-grid"><label class="mcp-inline-check"><input type="checkbox" name="clearApiKey">清除已保存的 API Key</label><label class="mcp-inline-check"><input type="checkbox" name="cacheEnabled" ${service.cache?.enabled !== false ? 'checked' : ''}>启用缓存</label>${field('缓存有效期（秒）', 'ttl', service.cache?.ttl ?? p.defaultCacheTtlSeconds, `type="number" required min="0" max="${p.maxCacheTtlSeconds}"`)}${field('最大缓存条数', 'max_size', service.cache?.max_size ?? p.defaultCacheEntries, `type="number" required min="1" max="${p.maxCacheEntries}"`)}</div></details><button type="button" class="button secondary" data-service-test-draft>测试</button></div>
      <div class="mcp-kb-heading"><strong>知识库 <span data-kb-total></span></strong><span><button type="button" class="mcp-link" data-service-settings>连接设置</button><button type="button" class="button secondary" data-kb-add>${uiIcon('action.add')}添加知识库</button></span></div><div class="mcp-kb-table-wrap"><table class="mcp-kb-table"><thead><tr><th>知识库名称</th><th>知识库 ID</th><th>启用</th><th>最近测试</th><th class="mcp-table-actions">操作</th></tr></thead><tbody data-service-kbs></tbody></table></div><p class="mcp-kb-empty" data-kb-empty>暂无知识库。</p>
      <div class="mcp-service-savebar" data-service-savebar ${service.id ? 'hidden' : ''}><span></span><span><button type="button" class="button secondary" data-service-cancel>取消</button><button type="submit" class="button primary">保存配置</button></span></div></div></form></details><div data-row-result role="status" aria-live="polite"></div>`;
    Object.defineProperty(row, 'open', { get: () => row.querySelector('.mcp-service-editor').open, set: value => { row.querySelector('.mcp-service-editor').open = value; } });
    (service.headers || []).filter(h => h.searchTargetIndex === undefined).forEach(h => headerRow(row, h));
    (service.knowledgeBases || []).forEach(k => kbRow(row, k));
    root.querySelector('[data-mcp-rows]').append(row); updateSummary(row);
    window.lucide?.createIcons({ nodes: [row] });
    row.querySelector('form').onsubmit = event => { event.preventDefault(); saveRow(row); };
    return row;
  }
  function updateSummary(row) {
    const s = readRow(row); row.querySelector('[data-service-name]').textContent = s.name || '新 MCP 服务';
    row.querySelector('[data-service-url]').textContent = s.server_url || '待填写服务地址'; row.querySelector('[data-service-url]').title = s.server_url;
    row.querySelector('[data-service-kb-summary]').textContent = s.knowledgeBases.map(k => k.name || '新知识库').join('、') || (s.adapter === 'generic' ? '通用 MCP' : '未配置知识库');
    row.querySelector('[data-service-kb-count]').textContent = `${s.knowledgeBases.length} 个`; row.querySelector('[data-kb-total]').textContent = s.knowledgeBases.length;
    row.querySelector('[data-kb-empty]').hidden = s.knowledgeBases.length > 0;
    row.querySelector('[data-kb-add]').disabled = s.adapter === 'generic';
  }
  function result(row, success, title, detail, tools = []) {
    const node = row.querySelector('[data-row-result]'); const heading = document.createElement('strong'); heading.className = success ? 'mcp-success' : 'mcp-error'; heading.textContent = title;
    const info = document.createElement('span'); info.textContent = detail; node.replaceChildren(heading, info);
    if (tools.length) { const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = `查看 ${tools.length} 个工具`; details.append(summary); tools.forEach(t => { const p = document.createElement('p'); p.textContent = `${t.name}：${t.description}`; details.append(p); }); node.append(details); }
  }
  async function action(row, fn) {
    if (busy) return; busy = true; root.setAttribute('aria-busy', 'true');
    const disabled = [...root.querySelectorAll('button,input,select')].filter(n => !n.disabled); disabled.forEach(n => { n.disabled = true; });
    try { await fn(); } catch (error) { result(row, false, '操作失败', error.message); }
    finally { disabled.forEach(n => { n.disabled = false; }); busy = false; root.removeAttribute('aria-busy'); }
  }
  async function saveRow(row) {
    if (!row.querySelector('form').reportValidity()) return;
    // Capture values before disabling controls.
    const body = { service: readRow(row) };
    await action(row, async () => {
      const before = new Set(projection.services.map(s => s.id));
      projection = await request('save', body, row.dataset.id ? row.dataset.version : projection.rowVersion);
      const saved = projection.services.find(s => row.dataset.id ? s.id === row.dataset.id : !before.has(s.id));
      const replacement = addRow(saved); row.replaceWith(replacement); sync(); status('此服务及知识库已保存。');
    });
  }
  function draw() {
    root.innerHTML = `<div class="mcp-list-toolbar"><h3>MCP 服务 <small data-mcp-count></small></h3><div class="mcp-list-tools"><input type="search" data-mcp-search aria-label="搜索服务或知识库" placeholder="搜索服务或知识库"><button type="button" class="button secondary" data-mcp-collapse>全部展开</button><button type="button" class="button" data-mcp-add>${uiIcon('action.add')}添加服务</button><button type="button" class="mcp-link" data-reload-mcp>刷新</button></div></div><p data-mcp-status role="status" aria-live="polite"></p><div class="mcp-list-table"><div class="mcp-service-columns"><span>服务名称</span><span>服务地址</span><span>知识库</span><span>最近测试</span><span class="mcp-table-actions">操作</span></div><div data-mcp-rows></div><p data-mcp-empty>暂无服务</p></div>`;
    window.lucide?.createIcons({ nodes: [root] });
    projection.services.forEach(addRow); sync();
    root.querySelector('[data-mcp-search]').oninput = sync;
  }
  root.addEventListener('input', event => { const row = event.target.closest('[data-mcp-service]'); if (row) { dirty(row); updateSummary(row); } });
  root.addEventListener('toggle', event => { if (event.target.matches('.mcp-service-editor')) syncExpansion(); }, true);
  root.addEventListener('change', event => { const row = event.target.closest('[data-mcp-service]'); if (row) { dirty(row); updateSummary(row); } });
  root.addEventListener('invalid', event => { const row = event.target.closest('[data-mcp-service]'); if (row) { row.open = true; row.querySelector('[data-connection-settings]').hidden = false; event.target.closest('details.mcp-advanced')?.setAttribute('open', ''); } }, true);
  root.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.closest('summary')) { event.preventDefault(); event.stopPropagation(); }
    if (busy) return;
    const row = button.closest('[data-mcp-service]');
    const has = attr => button.hasAttribute(attr);
    if (has('data-mcp-add')) { if (root.querySelectorAll('[data-mcp-service]').length >= projection.limits.maxServices) { status('服务数量已达上限'); return; } root.querySelector('[data-mcp-search]').value = ''; const added = addRow(); sync(); added.querySelector('[name=name]').focus(); }
    if (has('data-mcp-collapse')) {
      const visible = [...root.querySelectorAll('[data-mcp-service]')].filter(n => !n.hidden);
      const open = !visible.some(n => n.open);
      visible.forEach(n => { n.open = open; }); syncExpansion();
    }
    if (has('data-reload-mcp') && confirmLeavingMcp()) { try { projection = await request(); draw(); status('已读取最新配置。'); } catch (error) { status(error.message); } }
    if (!row) return;
    if (has('data-service-settings')) { row.open = true; const settings = row.querySelector('[data-connection-settings]'); settings.hidden = !settings.hidden; row.querySelector('[data-service-savebar]').hidden = settings.hidden && row.dataset.dirty !== 'true'; }
    if (has('data-service-cancel')) { if (row.dataset.id) { const replacement = addRow(projection.services.find(s => s.id === row.dataset.id)); row.replaceWith(replacement); } else row.remove(); sync(); }
    if (has('data-service-delete')) {
      if (!window.confirm(`删除“${readRow(row).name || '新服务'}”及其知识库配置？历史引用快照仍保留。`)) return;
      if (!row.dataset.id) { row.remove(); sync(); return; }
      await action(row, async () => { projection = await request('delete', { serviceId: row.dataset.id }, row.dataset.version); row.remove(); sync(); status('服务已删除。'); });
    }
    if (has('data-header-add')) { if (row.querySelectorAll('.mcp-custom-header').length >= projection.limits.maxHeaders) { status('请求头数量已达上限'); return; } headerRow(row); dirty(row); }
    if (has('data-header-remove')) { button.closest('.mcp-custom-header').remove(); dirty(row); }
    if (has('data-kb-add')) { if (row.querySelectorAll('[data-kb-row]').length >= projection.limits.maxKnowledgeBases) { status('知识库数量已达上限'); return; } kbRow(row, {}, true); dirty(row); updateSummary(row); }
    if (has('data-kb-edit')) { const tr = button.closest('tr'); tr.querySelectorAll('.mcp-kb-edit').forEach(n => { n.hidden = false; }); tr.querySelectorAll('[data-kb-name],[data-kb-locator]').forEach(n => { n.hidden = true; }); tr.querySelector('input').focus(); }
    if (has('data-kb-remove')) { if (!window.confirm('移除此知识库配置？保存后生效，历史快照保留。')) return; button.closest('tr').remove(); dirty(row); updateSummary(row); }
    if (has('data-service-test') || has('data-service-test-draft')) {
      const draft = has('data-service-test-draft');
      if (!draft && row.dataset.dirty === 'true') { result(row, false, '有未保存修改', '请保存后测试，或在设置中测试。'); return; }
      if (!draft && !row.dataset.id) { result(row, false, '请先保存', '新服务可在设置中测试。'); return; }
      if (draft && !row.querySelector('form').reportValidity()) return;
      const body = draft ? { service: readRow(row) } : { serviceId: row.dataset.id };
      await action(row, async () => {
        const node = row.querySelector('[data-service-test-status]'); node.textContent = '测试中…'; node.className = 'mcp-muted';
        try { const r = await request('test', body, row.dataset.id ? row.dataset.version : projection.rowVersion); node.textContent = '测试成功'; node.className = 'mcp-success'; result(row, true, '测试成功', `${new Date(r.testedAt).toLocaleTimeString('zh-CN')} · ${r.latencyMs} 毫秒 · 仅验证握手与工具发现`, r.tools); }
        catch (error) { node.textContent = '测试失败'; node.className = 'mcp-error'; result(row, false, '测试失败', error.message); }
      });
    }
    if (has('data-kb-verify')) {
      const tr = button.closest('tr');
      if (!row.dataset.id || !tr.dataset.id || row.dataset.dirty === 'true') { result(row, false, '请先保存', '请保存修改后测试。'); return; }
      await action(row, async () => {
        const node = tr.querySelector('[data-kb-status]'); node.textContent = '测试中…';
        try { const r = await request('verify', { serviceId: row.dataset.id, knowledgeBaseId: tr.dataset.id }, row.dataset.version); node.textContent = '测试成功'; node.className = 'mcp-success'; result(row, true, '测试成功', `${r.knowledgeBase.name} · ID ${r.knowledgeBase.locator} · ${r.latencyMs} 毫秒 · 工具 ${r.tool}${Number.isInteger(r.matchedCount) ? ` · 本次匹配 ${r.matchedCount} 条` : ''}`); }
        catch (error) { node.textContent = '测试失败'; node.className = 'mcp-error'; result(row, false, '测试失败', error.message); }
      });
    }
  });
  async function load() { try { projection = await request(); draw(); } catch (error) { options.onError?.(error); root.innerHTML = '<p data-mcp-status role="status"></p><button type="button" class="button secondary" data-mcp-retry>重新读取</button>'; status(error.message); root.querySelector('[data-mcp-retry]').onclick = load; } }
  root.innerHTML = '<p data-mcp-status role="status">正在读取 MCP 服务…</p>'; load();
}
