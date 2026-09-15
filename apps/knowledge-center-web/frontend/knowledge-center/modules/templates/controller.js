import * as api from '../../common/api/platform-api.js';
import { renderTemplateResults } from './view.js';

export function createTemplateController({ appState, render, canPerform }) {
  const ui = appState.templateUi = { search: '', type: '', status: 'active', mode: 'preview', drafts: {}, draftKey: '', historyOpen: false };
  let request = 0;
  // 中文输入法组词期间不能重绘搜索框，否则替换 DOM 会中断 composition 会话。
  const composingSearchFields = new WeakSet();
  let searchTimer = null;
  let lastSearch = null;
  const selected = () => appState.templateProjection?.selected;
  const draft = () => ui.drafts[ui.draftKey];
  function ensureDraft(item) {
    if (!item) return;
    ui.draftKey = item.id;
    ui.drafts[item.id] ||= { name: item.name, type: item.type, description: item.description, content: item.current?.content || '', baseVersion: item.currentVersion, dirty: false };
  }
  function failure(error) { ui.error = error.message; ui.notice = ''; render(); document.querySelector('[data-template-status]')?.focus(); }
  async function load(id) {
    const ticket = ++request;
    ui.error = '';
    try {
      const result = await api.loadTemplates({ summary: '1' });
      if (ticket !== request) return;
      const items = result.data || [];
      const target = id || (ui.draftKey !== 'new' && ui.draftKey) || items.find(item => item.status === 'active')?.id || items[0]?.id;
      // 列表已携带 current 正文；首次进入直接复用，避免刷新时重复慢速存储请求。
      const listed = items.find(item => item.id === target);
      const detail = target ? (await api.loadTemplate(target)).data : null;
      if (ticket !== request) return;
      appState.templateProjection = { items, selected: detail };
      if (id || ui.draftKey !== 'new') ensureDraft(detail);
      ui.historyVersion = null; ui.versions = detail?.versions || [];
      render();
    } catch (error) { if (ticket === request) failure(error); }
  }
  async function operation(action) {
    if (ui.busy) return;
    ui.busy = true; ui.error = ''; ui.notice = ''; render();
    try { await action(); } catch (error) { failure(error); }
    finally { ui.busy = false; render(); if (ui.error) document.querySelector('[data-template-status]')?.focus(); }
  }
  function newDraft(payload = {}) {
    if (ui.drafts.new?.dirty && !window.confirm('已有未保存的新模板草稿，是否放弃并替换？')) return;
    ui.drafts.new = { name: '', type: '', description: '', content: '', dirty: true, ...payload };
    ui.draftKey = 'new'; ui.historyVersion = null; ui.historyOpen = false; ui.mode = 'preview'; render();
  }
  async function click(event) {
    const zone = event.target.closest('[data-template-dropzone]');
    if (zone && appState.activeView === 'templates' && canPerform('template:edit') && !ui.busy) { event.preventDefault(); document.querySelector('[data-template-file]')?.click(); return; }
    const button = event.target.closest('button');
    if (!button || appState.activeView !== 'templates' || ui.busy) return;
    if (button.hasAttribute('data-template-draft')) { ui.draftKey = button.dataset.templateDraft; ui.mode = 'preview'; render(); return; }
    if (button.hasAttribute('data-template-id')) { ui.mode = 'preview'; ui.historyOpen = false; await load(button.dataset.templateId); return; }
    if (button.hasAttribute('data-template-new') && canPerform('template:edit')) { newDraft(); return; }
    if (button.hasAttribute('data-template-cancel') && canPerform('template:edit')) { if (draft()?.dirty && !window.confirm('放弃当前未保存内容？')) return; delete ui.drafts[ui.draftKey]; ui.draftKey = ''; ui.mode = 'preview'; ui.historyVersion = null; render(); return; }
    if (button.hasAttribute('data-template-upload') && canPerform('template:edit')) { document.querySelector('[data-template-file]')?.click(); return; }
    if (button.hasAttribute('data-template-history')) { ui.historyOpen = !ui.historyOpen; render(); if (ui.historyOpen) document.querySelector('[data-template-history-close]')?.focus(); return; }
    if (button.hasAttribute('data-template-history-close')) { ui.historyOpen = false; render(); document.querySelector('[data-template-history]')?.focus(); return; }
    if (button.hasAttribute('data-template-mode')) { ui.mode = button.dataset.templateMode; render(); return; }
    if (button.hasAttribute('data-template-current')) { ui.historyVersion = null; render(); return; }
    if (button.hasAttribute('data-template-version')) { await operation(async () => { ui.historyVersion = (await api.loadTemplateVersion(selected().id, Number(button.dataset.templateVersion))).data; }); return; }
    if (button.hasAttribute('data-template-restore') && canPerform('template:edit')) {
      if (draft()?.dirty && !window.confirm('当前草稿有未保存修改，是否用历史内容替换？')) return;
      await operation(async () => { const result = (await api.restoreTemplateDraft(selected().id, Number(button.dataset.templateRestore))).data; Object.assign(draft(), result, { dirty: true }); ui.historyVersion = null; ui.mode = 'preview'; ui.notice = '历史内容已载入草稿，点击保存后才会创建版本。'; }); return;
    }
    if (button.hasAttribute('data-template-toggle') && canPerform('template:manage')) { await operation(async () => { const id = selected().id; await api.setTemplateEnabled(id, selected().status !== 'active'); await load(id); ui.notice = '模板状态已更新。'; }); return; }
    if (button.hasAttribute('data-template-save') && canPerform('template:edit')) {
      const value = draft(); if (!value) return;
      for (const [key, label] of [['name', '模板名称'], ['type', '类型'], ['description', '描述'], ['content', '正文']]) if (!String(value[key] || '').trim()) { failure(new Error(`请填写${label}。草稿已保留。`)); return; }
      await operation(async () => {
        const key = ui.draftKey; let result;
        if (key === 'new' || key.startsWith('upload:')) result = await api.createTemplate(value);
        else {
          // 正文与元数据在同一个版本事务内保存；失败不产生部分更新。
          result = await api.saveTemplate(key, value);
        }
        delete ui.drafts[key]; ui.draftKey = result.data.id; await load(result.data.id); ui.mode = 'preview'; ui.notice = `保存成功，当前版本 v${result.data.currentVersion}。`;
      });
    }
  }
  function commitSearch(target) {
    if (appState.activeView !== 'templates' || !target.isConnected) return;
    if (target.value === lastSearch) return;
    lastSearch = target.value;
    ui.search = target.value;
    // 仅更新结果，保留输入框、光标和正文，兼容 compositionend 后的最终 input。
    const results = document.querySelector('[data-template-results]');
    if (results) results.innerHTML = renderTemplateResults(appState);
  }
  function scheduleSearch(target) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => commitSearch(target), 180);
  }
  function input(event) {
    if (appState.activeView !== 'templates') return;
    if (event.target.matches('[data-template-content]') && draft()) { draft().content = event.target.value; draft().dirty = true; }
    if (event.target.matches('[data-template-field]') && draft()) { draft()[event.target.dataset.templateField] = event.target.value; draft().dirty = true; }
    if (event.target.matches('[data-template-search]')) {
      // input 事件在 composition 期间只更新原生输入框，待 compositionend 一次性筛选。
      if (composingSearchFields.has(event.target) || event.isComposing) return;
      scheduleSearch(event.target);
    }
  }
  document.addEventListener('compositionstart', event => {
    if (event.target.matches('[data-template-search]')) composingSearchFields.add(event.target);
  });
  document.addEventListener('compositionend', event => {
    if (!event.target.matches('[data-template-search]')) return;
    composingSearchFields.delete(event.target);
    scheduleSearch(event.target);
  });
  async function change(event) {
    if (appState.activeView !== 'templates') return;
    if (event.target.matches('[data-template-filter]')) { ui[event.target.dataset.templateFilter] = event.target.value; render(); }
    if (!event.target.matches('[data-template-file]') || !canPerform('template:edit')) return;
    const files = [...(event.target.files || [])]; if (!files.length) return;
    await importFiles(files); event.target.value = '';
  }
  async function importFiles(files) {
    if (ui.busy || !canPerform('template:edit') || !files.length) return;
    const invalid = files.filter(file => !/\.(?:md|markdown)$/i.test(file.name) || file.size > 10 * 1024 * 1024);
    const rejected = invalid.map(file => `${file.name}（仅支持 Markdown，单个不超过10MB）`);
    files = files.filter(file => !invalid.includes(file));
    if (!files.length) { failure(new Error(rejected.join('；'))); return; }
    await operation(async () => {
      ui.notice = '正在上传、校验并保存模板…'; render();
      const form = new FormData(); files.forEach(file => form.append('files', file));
      const result = await api.importTemplate(form);
      const payload = result?.data;
      if (!Array.isArray(payload?.templates) || !Array.isArray(payload?.drafts)) {
        throw new Error('服务端未确认模板入库，请检查服务版本并查询列表，勿重复上传。');
      }
      const failed = [...rejected, ...payload.drafts.filter(item => item.error).map(item => `${item.sourceFilename}（${item.error.message}）`)];
      const created = payload.templates;
      if (!created.length) throw new Error(failed.join('；') || '未保存任何模板，请检查服务端响应。');
      // Imported templates are durable; do not erase unrelated editor drafts.
      ++request;
      ui.search = ''; ui.type = ''; ui.status = 'active'; ui.mode = 'preview';
      ui.historyVersion = null; ui.historyOpen = false;
      appState.templateProjection = { items: [...(appState.templateProjection?.items || []), ...created], selected: created[0] };
      ensureDraft(created[0]);
      await load(created[0].id);
      ui.notice = `模板上传成功：已保存 ${created.length} 个 Markdown 模板。`;
      if (failed.length) ui.error = `以下文件未保存：${failed.join('；')}`;
      render();
      document.querySelector('[data-template-status]')?.focus();
    });
  }
  document.addEventListener('dragover', event => { const zone = event.target.closest('[data-template-dropzone]'); if (!zone || !canPerform('template:edit')) return; event.preventDefault(); zone.classList.add('is-dragging'); });
  document.addEventListener('dragleave', event => event.target.closest('[data-template-dropzone]')?.classList.remove('is-dragging'));
  document.addEventListener('drop', event => { const zone = event.target.closest('[data-template-dropzone]'); if (!zone || !canPerform('template:edit')) return; event.preventDefault(); zone.classList.remove('is-dragging'); importFiles([...event.dataTransfer.files]); });
  document.addEventListener('keydown', event => { const zone = event.target.closest('[data-template-dropzone]'); if (zone && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); document.querySelector('[data-template-file]')?.click(); } });
  const hasDrafts = () => Object.values(ui.drafts).some(item => item.dirty);
  function canLeave() { return !hasDrafts() || window.confirm('存在未保存草稿。离开后草稿将在本次会话中保留，确定离开？'); }
  document.addEventListener('click', click); document.addEventListener('input', input); document.addEventListener('change', change);
  window.addEventListener('beforeunload', event => { if (hasDrafts()) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('knowledge-center:session-expired', () => { ui.drafts = {}; ui.draftKey = ''; appState.templateProjection = null; render(); });
  window.addEventListener('knowledge-center:permission-denied', () => { ui.drafts = {}; ui.draftKey = ''; render(); });
  document.addEventListener('keydown', event => {
    if (appState.activeView !== 'templates' || !ui.historyOpen) return;
    if (event.key === 'Escape') { ui.historyOpen = false; render(); document.querySelector('[data-template-history]')?.focus(); }
    if (event.key === 'Tab' && window.matchMedia('(max-width: 900px)').matches) {
      const buttons = [...document.querySelectorAll('.template-history button:not(:disabled)')]; const first = buttons[0]; const last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  return { load, canLeave };
}
