import * as api from '../../common/api/platform-api.js';
import { renderTemplateResults } from './view.js';

export function createTemplateController({ appState, render, canPerform }) {
  const ui = appState.templateUi = { search: '', type: '', status: '', mode: 'preview', editorFormat: 'rich', metadataOpen: false, tab: 'library', drafts: {}, draftKey: '', historyOpen: false, createOpen: false, focusMode: globalThis.localStorage?.getItem('knowledge-center:template-focus-mode') === 'true' };
  let richEditor = null; let richNode = null; let editorAssets = null; let mountTicket = 0;
  function loadEditorAssets() {
    if (window.Vditor) return Promise.resolve(window.Vditor);
    if (editorAssets) return editorAssets;
    editorAssets = new Promise((resolve, reject) => {
      if (!document.querySelector('[data-template-vditor-style]')) { const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = './common/vendor/vditor/dist/index.css'; style.dataset.templateVditorStyle = ''; document.head.append(style); }
      const script = document.createElement('script'); script.src = './common/vendor/vditor/dist/index.min.js'; script.onload = () => resolve(window.Vditor); script.onerror = () => reject(new Error('编辑器加载失败，请切换 Markdown 模式')); document.head.append(script);
    }).catch(error => { editorAssets = null; throw error; });
    return editorAssets;
  }
  async function mountRichEditor() {
    const node = appState.activeView === 'templates' && ui.tab === 'editor' && ui.mode === 'edit' && ui.editorFormat === 'rich' ? document.querySelector('[data-template-rich-editor]') : null;
    if (!node) { if (richEditor) richEditor.destroy(); richEditor = null; richNode = null; return; }
    if (node === richNode && richEditor) return;
    if (richEditor) { richEditor.destroy(); richEditor = null; richNode = null; }
    const ticket = ++mountTicket;
    try {
      const Vditor = await loadEditorAssets();
      if (ticket !== mountTicket || !node.isConnected || !draft()) return;
      richNode = node;
      richEditor = new Vditor(node, { cdn: `${location.origin}/knowledge-center/common/vendor/vditor`, mode: 'wysiwyg', lang: 'zh_CN', value: draft().content, width: '100%', minHeight: 480, cache: { enable: false }, toolbar: ['headings', 'bold', 'italic', '|', 'list', 'ordered-list', 'table', 'code', 'link', '|', 'undo', 'redo'], after: () => queueMicrotask(() => { if (node.isConnected && richNode === node) richEditor?.clearStack(); }), input: value => { if (node.isConnected && draft()) { draft().content = value; draft().dirty = true; document.querySelector('.template-edit-bar span')?.replaceChildren('正在编辑 · 有未保存修改'); } } });
    } catch (error) { ui.error = error.message; ui.editorFormat = 'markdown'; render(); }
  }
  function syncTemplateDialogs() {
    document.querySelectorAll('[data-template-modal]').forEach(dialog => {
      const wanted = dialog.hasAttribute('data-modal-open') || dialog.matches('[data-map-evidence-dialog], [data-map-rules-dialog]');
      if (wanted && !dialog.open) {
        dialog.showModal();
        if (dialog.matches('[data-template-meta-panel]') && ui.fieldError?.key && ui.fieldError.key !== 'content') dialog.querySelector(`[data-template-field="${ui.fieldError.key}"]`)?.focus();
      }
      else if (!wanted && dialog.open) dialog.close();
    });
  }
  const observer = new MutationObserver(() => { void mountRichEditor(); syncTemplateDialogs(); });
  observer.observe(document.getElementById('view-root') || document.body, { childList: true, subtree: true });
  document.addEventListener('cancel', event => {
    const dialog = event.target.closest?.('[data-template-modal]');
    if (!dialog) return;
    event.preventDefault();
    closeTemplateDialog(dialog);
  });
  let request = 0;
  // 中文输入法组词期间不能重绘搜索框，否则替换 DOM 会中断 composition 会话。
  const composingSearchFields = new WeakSet();
  let searchTimer = null;
  let lastSearch = null;
  const selected = () => appState.templateProjection?.selected;
  const draft = () => ui.drafts[ui.draftKey];
  const hasContent = item => typeof item?.current?.content === 'string';
  let metadataSnapshot = null;
  function syncMetadataHeader() {
    const value = draft(); const header = document.querySelector('.template-editor > header');
    if (!value || !header) return;
    header.querySelector('h3').textContent = value.name || '新建模板';
    const summary = header.querySelector('p');
    if (!summary) return;
    const current = selected(); const state = current?.status === 'active' ? '启用' : current?.status === 'disabled' ? '已停用' : '草稿';
    summary.textContent = `${value.type || '未指定类型'} · ${state} · ${current && ui.draftKey !== 'new' ? `v${current.currentVersion} · ${current.updatedAt ? new Date(current.updatedAt).toLocaleString('zh-CN') : '未保存'}` : '未保存'}`;
    if (value.description) { const description = document.createElement('span'); description.className = 'template-description-inline'; description.textContent = value.description; summary.append(description); }
    document.querySelector('.template-edit-bar span')?.replaceChildren(value.dirty ? '正在编辑 · 有未保存修改' : '正在编辑');
  }
  function setMetadataOpen(open, discard = false) {
    const value = draft();
    if (discard && value && metadataSnapshot) {
      Object.assign(value, metadataSnapshot);
      for (const field of document.querySelectorAll('[data-template-meta-panel] [data-template-field]')) field.value = value[field.dataset.templateField] || '';
      ui.fieldError = null;
    }
    if (open && value) metadataSnapshot = { name: value.name, type: value.type, description: value.description, dirty: value.dirty };
    ui.metadataOpen = open;
    const panel = document.querySelector('[data-template-meta-panel]');
    if (panel) {
      if (open) panel.setAttribute('data-modal-open', 'true');
      else panel.removeAttribute('data-modal-open');
      if (open && !panel.open) panel.showModal();
      else if (!open && panel.open) panel.close();
    }
    const trigger = document.querySelector('[data-template-meta-toggle]');
    trigger?.setAttribute('aria-expanded', String(open));
    syncMetadataHeader();
    if (open) panel?.querySelector('[data-template-field="name"]')?.focus();
    else trigger?.focus();
  }
  async function loadAllMappings(handbookId) {
    const items = []; let cursor = 0; let total = 0;
    do {
      const page = (await api.loadTemplateMappings({ handbookId, cursor, limit: 100 })).data;
      items.push(...(page.items || [])); total = page.total || 0; cursor = page.nextCursor;
    } while (cursor !== null && cursor !== undefined);
    return { items, total };
  }
  async function loadMappings() {
    ui.mappingError = '';
    try {
      const [assets, rules] = await Promise.all([api.loadAssets({ pageSize: '100' }), api.loadTemplateMappingRules()]);
      ui.mappingHandbooks = (assets?.data?.items || assets?.items || []).map(item => ({ id: item.handbookId || item.id, name: item.name || item.title }));
      ui.mappingRules = rules.data;
      if (!ui.mappingHandbookId) ui.mappingHandbookId = ui.mappingHandbooks[0]?.id || '';
      if (ui.mappingHandbookId) ui.mappingEffective = await loadAllMappings(ui.mappingHandbookId);
    } catch (error) { ui.mappingError = error.message; }
    render();
  }
  let mappingPoll = null;
  function scheduleBatchPoll() {
    clearTimeout(mappingPoll);
    if (ui.mappingBatch?.status !== 'running') return;
    mappingPoll = setTimeout(() => {
      if (appState.activeView === 'templates' && ui.tab === 'mappings' && !document.hidden) void refreshBatch();
    }, 1000);
  }
  async function confirmMapping(row, templateId, reason = '') {
    const previous = ui.mappingEffective?.items?.find(item => item.documentId === row.documentId);
    const result = (await api.decideTemplateMapping({ batchId: ui.mappingBatch.id, documentId: row.documentId, templateId, reason, baseVersion: previous?.version || 0 })).data;
    ui.mappingEffective ||= { items: [], total: 0 };
    ui.mappingEffective.items = [...ui.mappingEffective.items.filter(item => item.documentId !== row.documentId), result];
    ui.mappingEffective.total = ui.mappingEffective.items.length;
    ui.mappingSelection = (ui.mappingSelection || []).filter(id => id !== row.documentId);
  }
  async function refreshBatch() {
    if (!ui.mappingBatch?.id) return;
    try { const id = ui.mappingBatch.id; const result = (await api.loadTemplateMappingBatch(id)).data; if (ui.mappingBatch?.id !== id) return; ui.mappingBatch = result; if (!ui.mappingEvidence && !ui.mappingRulesOpen) render(); scheduleBatchPoll(); }
    catch (error) { ui.mappingError = error.message; render(); }
  }
  function ensureDraft(item) {
    if (!item) return;
    if (!hasContent(item)) throw new Error('模板详情未返回正文，请刷新后重试。');
    ui.draftKey = item.id;
    ui.drafts[item.id] ||= { name: item.name, type: item.type, description: item.description, content: item.current.content, baseVersion: item.currentVersion, dirty: false };
  }
  function failure(error) { ui.error = error.message; ui.notice = ''; render(); document.querySelector('[data-template-status]')?.focus(); }
  async function showSaveConflict() {
    const current = (await api.loadTemplate(selected().id)).data;
    ui.saveConflict = { version: current.currentVersion, content: current.current?.content || '', name: current.name, type: current.type, description: current.description };
    ui.error = '模板已由其他用户更新。请比较双方内容，再决定是否以新版为基础保存。';
    render();
  }
  async function load(id) {
    const ticket = ++request;
    ui.error = '';
    try {
      const result = await api.loadTemplates({ summary: '1' });
      if (ticket !== request) return;
      const items = (result.data || []).filter(item => item.status !== 'deleted');
      const shouldOpenTemplate = Boolean(id) || ui.tab === 'editor' && ui.draftKey && ui.draftKey !== 'new';
      const target = id ? (items.some(item => item.id === id) ? id : null)
        : shouldOpenTemplate && items.some(item => item.id === ui.draftKey) ? ui.draftKey
          : shouldOpenTemplate ? items.find(item => item.status === 'active')?.id || items[0]?.id : null;
      // summary=1 只提供列表元数据；仅非摘要对象才能直接作为选中详情使用。
      const listed = items.find(item => item.id === target);
      const detail = !target ? null : hasContent(listed) ? listed : (await api.loadTemplate(target)).data;
      if (ticket !== request) return;
      if (target && !hasContent(detail)) throw new Error('模板详情未返回正文，请刷新后重试。');
      appState.templateProjection = { items, selected: detail };
      if (id) ui.tab = target === id ? 'editor' : 'library';
      if ((id || ui.tab === 'editor') && ui.draftKey !== 'new') ensureDraft(detail);
      ui.historyVersion = null; ui.versions = detail?.versions || [];
      render();
    } catch (error) { if (ticket === request) failure(error); }
  }
  async function operation(action) {
    if (ui.busy) return;
    ui.busy = true; ui.error = ''; ui.notice = ''; render();
    try { await action(); } catch (error) { if (ui.saveConflict && error.code === 'TEMPLATE_VERSION_CONFLICT') { render(); document.querySelector('.template-save-conflict')?.focus(); } else failure(error); }
    finally { ui.busy = false; render(); if (ui.error) document.querySelector('[data-template-status]')?.focus(); }
  }
  function newDraft(payload = {}) {
    if (ui.drafts.new?.dirty && !window.confirm('已有未保存的新模板草稿，是否放弃并替换？')) return;
    ui.drafts.new = { name: '', type: '', description: '', content: '', dirty: true, ...payload };
    ui.draftKey = 'new'; ui.historyVersion = null; ui.historyOpen = false; ui.createOpen = false; ui.tab = 'editor'; ui.mode = 'edit'; ui.metadataOpen = true; metadataSnapshot = { name: ui.drafts.new.name, type: ui.drafts.new.type, description: ui.drafts.new.description, dirty: ui.drafts.new.dirty }; render();
    document.querySelector('[data-template-meta-panel] [data-template-field="name"]')?.focus();
  }
  function closeTemplateDialog(dialog) {
    if (dialog.matches('[data-template-meta-panel]')) { setMetadataOpen(false, true); return; }
    if (dialog.matches('[data-map-rules-dialog]')) { ui.mappingRulesOpen = false; render(); document.querySelector('[data-map-rules]')?.focus(); return; }
    if (dialog.matches('[data-map-evidence-dialog]')) { const trigger = ui.mappingEvidence?.documentId; ui.mappingEvidence = null; render(); [...document.querySelectorAll('[data-map-evidence]')].find(button => button.dataset.mapEvidence === trigger)?.focus(); return; }
    if (dialog.matches('#template-history-panel')) { ui.historyOpen = false; render(); document.querySelector('[data-template-history]')?.focus(); }
  }
  async function click(event) {
    if (appState.activeView === 'templates' && event.target.matches('[data-template-modal]')) { closeTemplateDialog(event.target); return; }
    const zone = event.target.closest('[data-template-dropzone]');
    if (zone && appState.activeView === 'templates' && canPerform('template:edit') && !ui.busy) { event.preventDefault(); document.querySelector('[data-template-file]')?.click(); return; }
    const button = event.target.closest('button');
    if (!button || appState.activeView !== 'templates' || ui.busy || ui.mappingDeciding) return;
    if (button.hasAttribute('data-template-meta-toggle')) { setMetadataOpen(!ui.metadataOpen); return; }
    if (button.hasAttribute('data-template-meta-done')) { setMetadataOpen(false); return; }
    if (button.hasAttribute('data-template-meta-cancel')) { setMetadataOpen(false, true); return; }
    if (button.dataset.templateTab) { clearTimeout(mappingPoll); ui.metadataOpen = false; ui.tab = button.dataset.templateTab; render(); document.querySelector(`[data-template-tab="${ui.tab}"]`)?.focus(); if (ui.tab === 'mappings') { if (!ui.mappingHandbooks) await loadMappings(); scheduleBatchPoll(); document.querySelector(`[data-template-tab="${ui.tab}"]`)?.focus(); } return; }
    if (button.hasAttribute('data-map-analyze')) {
      ui.mappingBusy = true; ui.mappingError = ''; ui.mappingCancelled = false; ui.mappingSelection = []; clearTimeout(mappingPoll); render();
      try { ui.mappingBatch = (await api.analyzeTemplateMappings(ui.mappingHandbookId)).data; }
      catch (error) { ui.mappingError = error.message; }
      finally { ui.mappingBusy = false; render(); scheduleBatchPoll(); }
      return;
    }
    if (button.hasAttribute('data-map-confirm-selected')) {
      ui.mappingDeciding = true; ui.mappingError = ''; render();
      const failures = []; let succeeded = 0;
      for (const id of [...(ui.mappingSelection || [])]) {
        const row = ui.mappingBatch?.documents?.find(item => item.documentId === id);
        if (!row) continue;
        try { await confirmMapping(row, row.status === 'rule' ? row.templateId : row.ai?.templateId || row.candidates?.[0]); succeeded++; }
        catch (error) { failures.push(`${row.title}：${error.message}`); }
      }
      ui.mappingDeciding = false; ui.notice = `批量确认：成功 ${succeeded} 篇，失败 ${failures.length} 篇。`;
      ui.mappingError = failures.join('；'); render(); return;
    }
    if (button.hasAttribute('data-map-refresh')) { await refreshBatch(); return; }
    if (button.hasAttribute('data-map-more')) { ui.mappingShownCount = (ui.mappingShownCount || 50) + 50; render(); return; }
    if (button.hasAttribute('data-map-cancel')) { clearTimeout(mappingPoll); try { await api.cancelTemplateMappingBatch(ui.mappingBatch.id); ui.mappingBatch = null; ui.mappingCancelled = true; } catch (error) { ui.mappingError = error.message; } render(); return; }
    if (button.hasAttribute('data-map-evidence')) { ui.mappingEvidence = ui.mappingBatch?.documents.find(item => item.documentId === button.dataset.mapEvidence) || ui.mappingEffective?.items?.find(item => item.documentId === button.dataset.mapEvidence) || null; render(); const dialog = document.querySelector('[data-map-evidence-dialog]'); if (dialog && !dialog.open) dialog.showModal(); dialog?.querySelector('[data-map-evidence-close]')?.focus(); return; }
    if (button.hasAttribute('data-map-evidence-close')) { closeTemplateDialog(button.closest('[data-template-modal]')); return; }
    if (button.hasAttribute('data-map-rules')) { ui.mappingError = ''; ui.mappingRulesOpen = true; ui.mappingRuleDraft ||= structuredClone(ui.mappingRules?.rules || []); render(); const dialog = document.querySelector('[data-map-rules-dialog]'); if (dialog && !dialog.open) dialog.showModal(); dialog?.querySelector('[data-map-rules-close]')?.focus(); return; }
    if (button.hasAttribute('data-map-rules-close')) { closeTemplateDialog(button.closest('[data-template-modal]')); return; }
    if (button.hasAttribute('data-map-rule-add')) { ui.mappingRuleDraft.push({ id: '', priority: 0, templateId: '', when: {} }); ui.mappingPreview = null; render(); return; }
    if (button.hasAttribute('data-map-rule-remove')) { ui.mappingRuleDraft.splice(Number(button.dataset.mapRuleRemove), 1); ui.mappingPreview = null; render(); return; }
    if (button.hasAttribute('data-map-rules-preview')) {
      try { const rules = JSON.parse(document.querySelector('[data-map-rules-json]').value); ui.mappingPreview = (await api.previewTemplateMappingRules({ handbookId: ui.mappingHandbookId, baseVersion: ui.mappingRules.version, rules })).data; ui.mappingError = ''; }
      catch (error) { ui.mappingPreview = null; ui.mappingError = error.message; }
      render(); return;
    }
    if (button.hasAttribute('data-map-rules-save')) {
      try { const rules = JSON.parse(document.querySelector('[data-map-rules-json]').value); if (!ui.mappingPreview) throw new Error('请先预览影响范围。'); ui.mappingRules = (await api.saveTemplateMappingRules({ baseVersion: ui.mappingRules.version, handbookId: ui.mappingHandbookId, outlineVersionId: ui.mappingPreview.outlineVersionId, candidateDigest: ui.mappingPreview.candidateDigest, rules })).data; ui.mappingRulesOpen = false; ui.mappingRuleDraft = null; ui.mappingPreview = null; ui.mappingBatch = null; ui.notice = '规则已保存，请重新分析适用范围。'; }
      catch (error) { ui.mappingError = error.message; }
      render(); return;
    }
    if (button.hasAttribute('data-map-decide') || button.hasAttribute('data-map-decide-manual')) {
      try {
        const manual = button.hasAttribute('data-map-decide-manual');
        const documentId = manual ? button.dataset.mapDecideManual : button.dataset.mapDecide;
        const templateId = manual ? document.querySelector('[data-map-manual-template]')?.value : button.dataset.mapTemplate;
        const reason = manual ? document.querySelector('[data-map-manual-reason]')?.value.trim() : '';
        if (!templateId || manual && !reason) throw new Error('改选模板时请选择模板并填写理由。');
        const row = ui.mappingBatch.documents.find(item => item.documentId === documentId);
        await confirmMapping(row, templateId, reason);
        ui.mappingEvidence = null; ui.notice = '模板映射已确认，仅影响后续新任务。';
      } catch (error) { ui.mappingError = error.message; }
      render(); return;
    }
    if (button.hasAttribute('data-template-format')) { if (ui.editorFormat === 'rich' && richEditor && draft()) { try { draft().content = richEditor.getValue(); } catch (_) { /* editor initial value is already in draft */ } } ui.editorFormat = button.dataset.templateFormat; render(); return; }
    if (button.hasAttribute('data-template-draft')) { ui.draftKey = button.dataset.templateDraft; ui.tab = 'editor'; ui.mode = button.dataset.templateDraft === 'new' ? 'edit' : 'preview'; ui.metadataOpen = button.dataset.templateDraft === 'new'; if (ui.metadataOpen && draft()) metadataSnapshot = { name: draft().name, type: draft().type, description: draft().description, dirty: draft().dirty }; render(); if (ui.metadataOpen) document.querySelector('[data-template-field="name"]')?.focus(); return; }
    if (button.hasAttribute('data-template-back')) { ui.metadataOpen = false; ui.tab = 'library'; render(); document.querySelector('[data-template-search]')?.focus(); return; }
    if (button.hasAttribute('data-template-id')) { ui.mode = 'preview'; ui.tab = 'editor'; ui.historyOpen = false; ui.metadataOpen = false; await load(button.dataset.templateId); return; }
    if (button.hasAttribute('data-template-new') && canPerform('template:edit')) { ui.createOpen = !ui.createOpen; render(); return; }
    if (button.hasAttribute('data-template-create-blank') && canPerform('template:edit')) { newDraft(); return; }
    if (button.hasAttribute('data-template-create-upload') && canPerform('template:edit')) { document.querySelector('[data-template-file]')?.click(); return; }
    if (button.hasAttribute('data-template-cancel')) { if (draft()?.dirty && !window.confirm('放弃当前未保存内容？')) return; if (ui.draftKey === 'new') { delete ui.drafts.new; ui.draftKey = selected()?.id || ''; ui.tab = 'library'; } else { delete ui.drafts[ui.draftKey]; ensureDraft(selected()); } ui.saveConflict = null; ui.mode = 'preview'; ui.metadataOpen = false; ui.historyVersion = null; render(); return; }
    if (button.hasAttribute('data-template-upload') && canPerform('template:edit')) { document.querySelector('[data-template-file]')?.click(); return; }
    if (button.hasAttribute('data-template-history')) { ui.historyOpen = !ui.historyOpen; render(); if (ui.historyOpen) { const dialog = document.querySelector('#template-history-panel'); if (dialog && !dialog.open) dialog.showModal(); dialog?.querySelector('[data-template-history-close]')?.focus(); } return; }
    if (button.hasAttribute('data-template-history-close')) { closeTemplateDialog(button.closest('[data-template-modal]')); return; }
    if (button.hasAttribute('data-template-focus')) { ui.focusMode = !ui.focusMode; globalThis.localStorage?.setItem('knowledge-center:template-focus-mode', String(ui.focusMode)); render(); return; }
    if (button.hasAttribute('data-template-edit') && canPerform('template:edit')) { ui.mode = 'edit'; ui.metadataOpen = false; ui.fieldError = null; render(); return; }
    if (button.hasAttribute('data-template-current')) { ui.historyVersion = null; ui.compareVersion = false; render(); return; }
    if (button.hasAttribute('data-template-version') || button.hasAttribute('data-template-compare')) { await operation(async () => { ui.compareVersion = button.hasAttribute('data-template-compare'); ui.historyVersion = (await api.loadTemplateVersion(selected().id, Number(ui.compareVersion ? button.dataset.templateCompare : button.dataset.templateVersion))).data; ui.historyOpen = false; }); return; }
    if (button.hasAttribute('data-template-restore') && canPerform('template:edit')) {
      if (draft()?.dirty && !window.confirm('当前草稿有未保存修改，是否用历史内容替换？')) return;
      await operation(async () => { const result = (await api.restoreTemplateDraft(selected().id, Number(button.dataset.templateRestore))).data; Object.assign(draft(), result, { dirty: true }); ui.historyVersion = null; ui.historyOpen = false; ui.mode = 'edit'; ui.metadataOpen = false; ui.notice = '历史内容已载入编辑草稿，确认后点击保存创建新版本。'; }); return;
    }
    if (button.hasAttribute('data-template-toggle') && canPerform('template:manage')) { await operation(async () => { const id = selected().id; await api.setTemplateEnabled(id, selected().status !== 'active'); await load(id); ui.notice = '模板状态已更新。'; }); return; }
    if (button.hasAttribute('data-template-conflict-use-latest')) {
      if (!ui.saveConflict || !window.confirm('将以最新版本为基础保存当前草稿。请先确认右侧远端内容没有需要合并的修改。')) return;
      draft().baseVersion = ui.saveConflict.version; ui.saveConflict = null; ui.error = ''; ui.notice = '已更新保存基线，本地草稿仍在；请再次点击保存。'; render(); return;
    }
    if (button.hasAttribute('data-template-conflict-dismiss')) { ui.saveConflict = null; ui.error = ''; render(); return; }
    if (button.hasAttribute('data-template-save') && canPerform('template:edit')) {
      const value = draft(); if (!value) return;
      for (const [key, label] of [['name', '模板名称'], ['type', '类型'], ['description', '描述'], ['content', '正文']]) if (!String(value[key] || '').trim()) { ui.fieldError = { key, message: `请填写${label}。草稿已保留。` }; ui.metadataOpen = key !== 'content'; if (ui.metadataOpen) metadataSnapshot = { name: value.name, type: value.type, description: value.description, dirty: value.dirty }; failure(new Error(ui.fieldError.message)); document.querySelector(key === 'content' ? '[data-template-content], .template-rich-editor .vditor-wysiwyg' : `[data-template-field="${key}"]`)?.focus(); return; }
      await operation(async () => {
        const key = ui.draftKey; let result;
        if (key === 'new' || key.startsWith('upload:')) result = await api.createTemplate(value);
        else {
          // 正文与元数据在同一个版本事务内保存；失败不产生部分更新。
          try { result = await api.saveTemplate(key, value); }
          catch (error) { if (error.code === 'TEMPLATE_VERSION_CONFLICT') await showSaveConflict(); throw error; }
        }
        delete ui.drafts[key]; ui.draftKey = result.data.id; ui.metadataOpen = false; await load(result.data.id); ui.mode = 'preview'; ui.notice = `保存成功，当前版本 v${result.data.currentVersion}。`;
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
    if (results) {
      results.innerHTML = renderTemplateResults(appState);
      const visible = results.querySelectorAll('.template-catalog-open').length;
      const total = appState.templateProjection?.items?.length || 0;
      const count = document.querySelector('[data-template-library-count]');
      if (count) count.textContent = `显示 ${visible} / ${total}`;
    }
  }
  function scheduleSearch(target) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => commitSearch(target), 180);
  }
  function input(event) {
    if (appState.activeView !== 'templates') return;
    if (event.target.matches('[data-map-rule-field], [data-map-rule-condition]')) {
      ui.mappingPreview = null;
      const rule = ui.mappingRuleDraft[Number(event.target.closest('[data-map-rule-index]').dataset.mapRuleIndex)];
      if (event.target.dataset.mapRuleField) rule[event.target.dataset.mapRuleField] = event.target.dataset.mapRuleField === 'priority' ? Number(event.target.value) : event.target.value;
      else { const key = event.target.dataset.mapRuleCondition; if (event.target.value.trim()) rule.when[key] = event.target.value; else delete rule.when[key]; }
      const json = document.querySelector('[data-map-rules-json]'); if (json) json.value = JSON.stringify(ui.mappingRuleDraft, null, 2);
    }
    if (event.target.matches('[data-template-content]') && draft()) { draft().content = event.target.value; draft().dirty = true; if (ui.fieldError?.key === 'content') ui.fieldError = null; }
    if (event.target.matches('[data-template-field]') && draft()) { draft()[event.target.dataset.templateField] = event.target.value; draft().dirty = true; if (ui.fieldError?.key === event.target.dataset.templateField) { ui.fieldError = null; event.target.setAttribute('aria-invalid', 'false'); event.target.closest('label')?.nextElementSibling?.classList.contains('template-field-error') && event.target.closest('label').nextElementSibling.remove(); } document.querySelector('.template-edit-bar span')?.replaceChildren('正在编辑 · 有未保存修改'); }
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
    if (event.target.matches('[data-map-select]')) { ui.mappingSelection = event.target.checked ? [...new Set([...(ui.mappingSelection || []), event.target.dataset.mapSelect])] : (ui.mappingSelection || []).filter(id => id !== event.target.dataset.mapSelect); render(); return; }
    if (event.target.matches('[data-map-search]')) { ui.mappingSearch = event.target.value; ui.mappingSelection = []; ui.mappingShownCount = 50; render(); document.querySelector('[data-map-search]')?.focus(); return; }
    if (event.target.matches('[data-map-status]')) { ui.mappingStatus = event.target.value; ui.mappingSelection = []; ui.mappingShownCount = 50; render(); return; }
    if (event.target.matches('[data-map-handbook]')) { clearTimeout(mappingPoll); ui.mappingSelection = []; ui.mappingEvidence = null; ui.mappingCancelled = false; ui.mappingHandbookId = event.target.value; ui.mappingBatch = null; ui.mappingEffective = ui.mappingHandbookId ? await loadAllMappings(ui.mappingHandbookId) : null; render(); return; }
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
      ui.search = ''; ui.type = ''; ui.status = ''; ui.mode = 'preview'; ui.tab = 'editor';
      ui.historyVersion = null; ui.historyOpen = false;
      appState.templateProjection = { items: [...(appState.templateProjection?.items || []), ...created], selected: created[0] };
      ensureDraft(created[0]);
      await load(created[0].id);
      ui.notice = `模板上传成功：已保存 ${created.length} 个 Markdown 模板。`;
      ui.uploadResults = [
        ...created.map(item => ({ name: item.sourceFilename || item.name, success: true, message: '已保存' })),
        ...failed.map(message => ({ name: message, success: false, message: '未保存' })),
      ];
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
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(mappingPoll); else if (appState.activeView === 'templates' && ui.tab === 'mappings') scheduleBatchPoll(); });
  window.addEventListener('beforeunload', event => { if (hasDrafts()) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('knowledge-center:session-expired', () => { ui.drafts = {}; ui.draftKey = ''; appState.templateProjection = null; render(); });
  window.addEventListener('knowledge-center:permission-denied', () => { ui.drafts = {}; ui.draftKey = ''; render(); });
  document.addEventListener('keydown', event => {
    const tab = event.target.closest('[data-template-tab]');
    if (tab && appState.activeView === 'templates' && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 'library' : event.key === 'End' ? 'mappings' : tab.dataset.templateTab === 'library' ? 'mappings' : 'library';
      document.querySelector(`[data-template-tab="${next}"]`)?.click();
      return;
    }
    if (appState.activeView === 'templates' && ui.metadataOpen) {
      if (event.key === 'Escape') { event.preventDefault(); setMetadataOpen(false, true); return; }
      if (event.key === 'Tab') {
        const nodes = [...document.querySelectorAll('[data-template-meta-panel] input, [data-template-meta-panel] textarea, [data-template-meta-panel] button')].filter(node => node.getClientRects().length);
        if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
      }
      return;
    }
    if (appState.activeView === 'templates' && (ui.mappingRulesOpen || ui.mappingEvidence)) {
      if (event.key === 'Escape') { const rulesOpen = ui.mappingRulesOpen; ui.mappingRulesOpen = false; ui.mappingEvidence = null; render(); document.querySelector(rulesOpen ? '[data-map-rules]' : '[data-map-handbook]')?.focus(); return; }
      if (event.key === 'Tab') {
        const nodes = [...document.querySelectorAll('.template-map-evidence button:not(:disabled), .template-map-evidence input:not(:disabled), .template-map-evidence select:not(:disabled), .template-map-evidence textarea:not(:disabled), .template-map-evidence summary')].filter(node => node.getClientRects().length);
        const first = nodes[0]; const last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      return;
    }
    if (appState.activeView !== 'templates' || !ui.historyOpen) return;
    if (event.key === 'Escape') { ui.historyOpen = false; render(); document.querySelector('[data-template-history]')?.focus(); }
    if (event.key === 'Tab' && window.matchMedia('(max-width: 900px)').matches) {
      const buttons = [...document.querySelectorAll('.template-history button:not(:disabled)')].filter(button => button.getClientRects().length && (!button.closest('details') || button.closest('details').open)); const first = buttons[0]; const last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  return { load, canLeave };
}
