import { loadTemplates } from '../../common/api/platform-api.js';
import { enhanceSearchableSelects, syncSearchableSelect, cleanupSearchableSelects } from '../../common/searchable-combobox.js';
import { retainWritingSelection } from './writing-selection.js';
import { loadProductionModels, startHandbookAI, loadHandbookAI, actHandbookAI, loadHandbookAISources, previewHandbookAISource, uploadHandbookAISource, loadHandbookAISkills, runHandbookQuality } from '../../common/api/handbook-production-api.js';
import { renderProductionProvenance } from './production-provenance.js';
import { Marked } from '../../common/vendor/marked.esm.js';

const previewMarkdown = new Marked({ gfm: true, breaks: true, renderer: {
  html({ text }) { return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); },
  link({ href, tokens }) {
    const label = this.parser.parseInline(tokens);
    return /^https?:\/\//i.test(href) ? `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
  },
  image({ href, text }) {
    try {
      const imageURL = new URL(String(href || ''), window.location.origin);
      const hosted = imageURL.origin === window.location.origin && /^\/knowledge-center\/api\/production\/handbooks\/[^/]+\/documents\/[^/]+\/ai-sources\/images\/[a-f0-9]{64}$/.test(imageURL.pathname);
      if (hosted) return `<img src="${escapeAttribute(imageURL.pathname + imageURL.search)}" alt="${escapeAttribute(text)}" loading="lazy">`;
    } catch (_) {}
    return `<span>[图片：${escapeAttribute(text)}]</span>`;
  },
} });
const escapeAttribute = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const names = { generate: '文档生成', polish: '内容修订', continue: '内容续写' };
const normalizeOperation = operation => ['rewrite', 'update'].includes(operation) ? 'polish' : operation || 'generate';
const stateNames = { queued: '等待执行', running: '正在生成', completed: '候选已生成，请比较后采用', failed: '生成失败', cancelled: '已取消', interrupted: '任务中断，可重试' };

// The page owns polling; the detached workbench retains its editor and unsaved draft.
export function openProductionWritingPage(options) {
  const { context } = options;
  const embedded = options.embedded === true;
  const initialOperation = normalizeOperation(options.operation);
  let original = options.getMarkdown();
  let originSnapshot = options.originSnapshot || null;
  let editVersion = options.editVersion;
  let range = initialOperation === 'continue' ? { start: original.length, end: original.length } : { start: 0, end: original.length };
  const inherited = options.initialRange;
  const validRange = inherited && Number.isInteger(inherited.start) && Number.isInteger(inherited.end) && inherited.start >= 0 && inherited.end >= inherited.start && inherited.end <= original.length;
  let rangeConfirmed = validRange && (initialOperation === 'continue' || inherited.start !== inherited.end);
  if (rangeConfirmed) range = initialOperation === 'continue' ? { start: inherited.end, end: inherited.end } : { ...inherited };
  if (!['polish', 'continue'].includes(initialOperation)) rangeConfirmed = true;
  let writingMode = options.initialEditorFormat === 'markdown' ? 'markdown' : 'rich';
  let markdownPreview = false;
  let writingEditor = null;
  let writingEditorReady = false;
  const richSelection = retainWritingSelection(() => ({ editor: writingEditor, element: find('rich-editor') }));
  let fallbackCandidate = null;
  let feedbackTimer; let feedbackJob = null;
  let job = null; let timer; let closed = false; let busy = false; let pendingStart = null; let pendingRetry = null; let qualityReportId = null;
  let sourceSnapshots = [];
  let referenceOrder = ['knowledge-mcp'];
  let templateId = options.templateId || ''; let templatesLoading = true; let templateCatalog = [];
  let skillCatalog = [];
  let modelsLoading = true; let defaultModel = null;
  const selectedModel = () => defaultModel;
  const storageKey = `knowledge-ai:${JSON.stringify(context)}`;
  const dialog = document.createElement('section');
  dialog.className = `handbook-writing-page${embedded ? ' is-embedded' : ''}`;
  dialog.setAttribute('aria-labelledby', 'handbook-ai-title');
  dialog.innerHTML = `<form><header class="asset-dialog-heading"><div><h2 id="handbook-ai-title">AI 辅助写作</h2><p>明确范围 · 对照候选 · 确认后保存</p></div><div class="handbook-writing-heading-actions"><button type="button" data-ai-panel-toggle class="icon-button" aria-label="隐藏写作助手" title="隐藏写作助手" aria-expanded="true" aria-controls="handbook-writing-assistant"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16M18 9v6"/></svg></button><button type="button" data-ai-close aria-label="返回文档工作台">← 返回文档工作台</button></div></header>
    <div class="handbook-writing-layout">
      <section class="handbook-writing-document" aria-label="本次写作原文"><h3 data-ai-document-title></h3><p>选中需要修改的文字，或将光标放在续写位置，再确认范围。</p>
        <section class="handbook-writing-execution" data-ai-execution hidden tabindex="-1" aria-label="执行过程">
          <header><h3>执行过程</h3><button type="button" data-ai-execution-cancel disabled>取消任务</button></header>
          <p data-ai-status role="status" aria-live="polite"></p>
          <p class="handbook-writing-execution-summary"><span data-ai-phase></span> · <span data-ai-elapsed></span></p>
          <p data-ai-preview-wait hidden></p>
          <div data-ai-stages></div>
          <details data-ai-preview-panel hidden open><summary>生成内容预览 · 完成后可比较采用</summary><pre data-ai-preview aria-label="生成内容预览"></pre><p data-ai-preview-notice></p></details>
        </section>
        <details class="handbook-editor-format" data-dismissible-menu data-ai-format><summary aria-label="正文编写格式"><span data-ai-mode-label>可视化编辑</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m6 9 6 6 6-6"/></svg></summary><div><button type="button" data-ai-mode-rich aria-pressed="true">可视化编辑</button><button type="button" data-ai-mode-markdown aria-pressed="false">Markdown</button></div></details>
        <button class="handbook-markdown-preview-action" type="button" data-ai-markdown-preview-toggle aria-pressed="false" hidden>显示预览</button>
        <div data-ai-rich-editor></div><div data-ai-markdown class="handbook-markdown-workspace" hidden><textarea data-ai-original class="handbook-markdown-editor" aria-label="Markdown 正文" rows="1"></textarea><article data-ai-markdown-preview class="handbook-markdown-preview" aria-label="Markdown 预览" hidden></article></div>
        <div class="handbook-ai-dialog-actions"><button type="button" data-ai-selection>确认选文 / 光标位置</button><button type="button" data-ai-full>处理全文</button></div>

      </section>
      <aside id="handbook-writing-assistant" class="handbook-writing-assistant" aria-label="AI 写作设置">
        <label>写作要求<textarea data-ai-requirements rows="3" placeholder="说明主题、风格或需要更新的内容"></textarea></label>
        <p data-ai-range role="status"></p>
        <div class="handbook-writing-configuration"><div class="handbook-writing-configuration-heading"><span data-ai-operation-summary></span><button type="button" class="button secondary" data-ai-settings-open>生成设置</button></div><p data-ai-settings-summary>正在读取模型…</p></div>
        <div class="handbook-ai-settings" data-ai-settings-panel hidden role="dialog" aria-modal="true" aria-labelledby="handbook-ai-settings-title">
          <div class="handbook-ai-settings-backdrop" data-ai-settings-close></div>
          <section class="handbook-ai-settings-dialog"><header><div><h3 id="handbook-ai-settings-title" tabindex="-1">生成设置</h3><p data-ai-settings-context></p></div><button type="button" class="icon-button" data-ai-settings-cancel aria-label="关闭并放弃本次设置" title="关闭并放弃本次设置"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
            <div class="handbook-ai-settings-body">
              <section><span class="handbook-settings-label">写作方式</span><div class="handbook-settings-operations" role="group" aria-label="本次生成的写作方式">${Object.entries(names).map(([key, name]) => `<button type="button" data-ai-settings-operation="${key}" aria-pressed="false">${name}</button>`).join('')}</div><label hidden>写作方式<select data-ai-operation>${Object.entries(names).map(([key, name]) => `<option value="${key}">${name}</option>`).join('')}</select></label></section>
              <section data-ai-template-section><label>文档模板<select data-ai-template-select data-searchable-select="true" data-searchable-placeholder="输入模板名称搜索或展开选择" data-combobox-size="full" disabled><option value="">正在读取模板…</option></select></label><p data-ai-template role="status"></p></section>
              <section class="handbook-ai-sources" data-ai-sources><div class="handbook-ai-source-heading"><strong>参考资料</strong><span data-ai-source-count>已添加 0 项</span></div><p class="handbook-settings-source-note">引用优先级从高到低，拖动左侧手柄调整。</p><button type="button" class="button tertiary" data-ai-source-add aria-expanded="false" aria-controls="handbook-ai-source-entry">＋ 添加参考资料</button><div id="handbook-ai-source-entry" class="handbook-ai-settings-section" data-ai-source-entry hidden><label>资料来源<select data-ai-source-type><option value="url">网页来源</option><option value="pingcode-design">Pingcode设计文档</option><option value="pingcode-test">Pingcode测试文档</option><option value="knowledge-mcp">知识库（MCP）</option><option value="test-case-library">测试用例集</option><option value="local-document">本地文档</option></select></label><label data-ai-source-locator-label>资料地址或文档标识<input data-ai-source-locator type="text" placeholder="输入 HTTP(S) 网页地址或文档标识"></label><div class="handbook-source-upload" data-ai-source-upload hidden tabindex="0"><input type="file" data-ai-source-file accept=".md,.markdown,.txt,.sql,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden><strong>拖拽本地文档到这里</strong><span>或点击选择，支持 Markdown、TXT、SQL、PDF、DOCX</span></div><button type="button" data-ai-source-preview>添加并读取</button><p data-ai-source-info hidden></p></div><div data-ai-source-list></div></section>
              <details data-ai-skills><summary>扩展能力 <span data-ai-skill-count>（未选）</span></summary><div class="handbook-ai-settings-section"><p data-ai-skill-info>正在读取可选能力…</p><div data-ai-skill-list></div><p data-ai-used-skills></p></div></details>

            </div><footer><small>设置仅作用于本次生成</small><button type="button" class="button tertiary" data-ai-settings-cancel>取消</button><button type="button" class="button" data-ai-settings-apply>应用设置</button></footer>
          </section>
        </div>
        <div class="handbook-writing-submit"><div class="handbook-ai-dialog-actions"><button type="button" data-ai-start>生成候选</button><button type="button" data-ai-cancel hidden disabled>取消任务</button><button type="button" data-ai-retry hidden disabled>重试任务</button></div><button type="button" data-ai-resume hidden>恢复上次任务</button></div>
      </aside>
    </div>
    <section data-ai-candidate hidden tabindex="-1" aria-label="候选对照"><h3>比较后采用</h3><div class="handbook-writing-comparison"><label>原片段<textarea data-ai-before rows="10" readonly></textarea></label><label>候选片段（可人工修改）<textarea data-ai-fragment rows="10"></textarea></label></div><p>采用仅替换已确认的片段；其余原文保留。可调整写作要求后重新生成。内容尚待事实与用例核验。</p><div class="handbook-ai-dialog-actions"><button type="button" data-ai-adopt>采用并保存草稿</button><button type="button" data-ai-refine>调整要求重新生成</button><button type="button" data-ai-quality>执行 YashanDB 用例检查</button><button type="button" data-ai-discard>放弃候选</button></div><p data-ai-quality-result role="status"></p></section>
    </form>`;
  dialog.querySelectorAll('button').forEach(button => button.classList.add('button', 'secondary'));
  const find = selector => dialog.querySelector(`[data-ai-${selector}]`);
  find('start').classList.remove('secondary'); find('adopt').classList.remove('secondary');
  find('settings-apply').classList.remove('secondary');
  find('settings-context').textContent = `当前文档 · ${options.outline || '当前文档'}`;
  dialog.querySelectorAll('[data-ai-settings-operation]').forEach(button => {
    button.onclick = () => { find('operation').value = button.dataset.aiSettingsOperation; find('operation').dispatchEvent(new Event('change')); };
  });
  const provenancePanel = document.createElement('div'); find('candidate').append(provenancePanel);
  if (embedded) {
    const assistant = dialog.querySelector('.handbook-writing-assistant');
    const heading = dialog.querySelector('.asset-dialog-heading');
    heading.querySelector('h2').textContent = 'AI 辅助写作';
    heading.querySelector('p').textContent = options.outline || '当前文档';
    find('close').textContent = '×';
    find('close').setAttribute('aria-label', '关闭 AI 写作');
    find('panel-toggle').hidden = true;
    assistant.prepend(heading);
    const operations = document.createElement('div');
    operations.className = 'handbook-writing-operations';
    operations.setAttribute('role', 'group'); operations.setAttribute('aria-label', '写作方式');
    for (const [value, label] of Object.entries(names)) {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'button secondary'; button.textContent = label;
      button.dataset.aiQuickOperation = value;
      button.onclick = () => { if (busy || job && ['queued', 'running'].includes(job.status)) return; find('operation').value = value; find('operation').dispatchEvent(new Event('change')); };
      operations.append(button);
    }
    heading.after(operations);
    const composer = document.createElement('div'); composer.className = 'handbook-writing-composer';
    const requirements = find('requirements').closest('label'); requirements.before(composer); composer.append(requirements);
    const composerFooter = document.createElement('div'); composerFooter.className = 'handbook-writing-composer-footer';
    composerFooter.append(find('range')); composer.append(composerFooter);
    const templateSummary = dialog.querySelector('.handbook-writing-configuration'); composer.after(templateSummary);
    const documentSurface = dialog.querySelector('.handbook-writing-document');
    const breadcrumb = document.createElement('p'); breadcrumb.className = 'handbook-writing-breadcrumb';
    breadcrumb.textContent = document.querySelector('.handbook-document-heading > p')?.textContent || '当前文档';
    documentSurface.prepend(breadcrumb);
    const note = document.createElement('p'); note.className = 'handbook-writing-adoption-note';
    note.textContent = '生成内容先预览，确认采用后再保存'; dialog.querySelector('.handbook-writing-submit').append(note);
    dialog.querySelector('.handbook-writing-document').append(find('candidate'));
  }
  const operationSection = find('operation').closest('section');
  operationSection.hidden = true;
  if (!embedded) {
    const operations = document.createElement('div'); operations.className = 'handbook-writing-operations';
    operations.setAttribute('role', 'group'); operations.setAttribute('aria-label', '写作方式');
    for (const [value, label] of Object.entries(names)) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'button secondary';
      button.textContent = label; button.dataset.aiQuickOperation = value;
      button.onclick = () => { if (isLocked()) return; find('operation').value = value; find('operation').dispatchEvent(new Event('change')); };
      operations.append(button);
    }
    find('requirements').closest('label').before(operations);
  }
  const references = find('sources'); references.classList.add('handbook-writing-reference');
  const referenceHeading = references.querySelector('strong'); referenceHeading.textContent = '参考文档';
  referenceHeading.after(find('source-count')); references.querySelector('.handbook-ai-source-heading').append(find('source-add'));
  find('source-add').textContent = '＋ 添加';
  const referenceToggle = document.createElement('button'); referenceToggle.type = 'button';
  referenceToggle.className = 'button tertiary handbook-reference-toggle'; referenceToggle.dataset.aiReferencesToggle = '';
  referenceToggle.setAttribute('aria-expanded', 'false'); referenceToggle.setAttribute('aria-controls', 'writing-reference-list');
  find('source-list').id = 'writing-reference-list';
  references.append(referenceToggle);
  const configSummary = dialog.querySelector('.handbook-writing-configuration');
  configSummary.before(references);
  configSummary.querySelector('[data-ai-operation-summary]').hidden = true;
  const configHeading = document.createElement('strong'); configHeading.textContent = '生成设置';
  configSummary.querySelector('.handbook-writing-configuration-heading').prepend(configHeading);
  configSummary.querySelector('.handbook-writing-configuration-heading').append(find('settings-open'));
  find('settings-open').textContent = '调整';
  find('skills').open = true;
  find('skills').querySelector('summary').firstChild.textContent = '扩展能力（Skill） ';
  const sourcePanel = document.createElement('div'); sourcePanel.className = 'handbook-ai-settings handbook-reference-modal';
  sourcePanel.dataset.aiReferencePanel = ''; sourcePanel.hidden = true;
  sourcePanel.setAttribute('role', 'dialog'); sourcePanel.setAttribute('aria-modal', 'true'); sourcePanel.setAttribute('aria-labelledby', 'writing-reference-title');
  sourcePanel.innerHTML = `<div class="handbook-ai-settings-backdrop" data-ai-reference-close></div><section class="handbook-ai-settings-dialog"><header><div><h3 id="writing-reference-title">添加参考文档</h3><p></p></div><button type="button" class="icon-button button secondary" data-ai-reference-close aria-label="关闭添加参考文档">×</button></header><div class="handbook-reference-layout"><nav class="handbook-reference-nav" aria-label="参考文档来源"></nav><div class="handbook-reference-detail"><h4 data-ai-reference-type-title></h4></div></div><footer><small>添加后用于本次写作</small><button type="button" class="button secondary" data-ai-reference-close>完成</button></footer></section>`;
  sourcePanel.querySelector('header p').textContent = options.outline || '当前文档';
  dialog.querySelector('form').append(sourcePanel);
  sourcePanel.querySelector('.handbook-reference-detail').append(find('source-entry'));
  find('source-entry').hidden = false; find('source-type').closest('label').hidden = true;
  const mcpInfo = document.createElement('p'); mcpInfo.dataset.aiMcpStatus = ''; mcpInfo.hidden = true;
  sourcePanel.querySelector('.handbook-reference-detail').append(mcpInfo);
  const types = [['pingcode-design','Pingcode设计文档'],['pingcode-test','Pingcode测试文档'],['test-case-library','测试用例集'],['url','网页来源'],['knowledge-mcp','知识库（MCP）'],['local-document','本地文档']];
  for (const [value, label] of types) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'button tertiary';
    button.textContent = label; button.dataset.referenceType = value; button.setAttribute('aria-pressed','false');
    button.onclick = () => { if (isLocked()) return; find('source-type').value = value; sourceHint(); };
    sourcePanel.querySelector('nav').append(button);
  }
  dialog.querySelector('form').append(sourcePanel);
  const isLocked = () => busy || ['queued', 'running'].includes(job?.status);
  let referenceReturnFocus = null; let referencesExpanded = false; let referenceDragId = null;
  let collapsedReferenceCount = 3;
  function closeReferences() {
    if (busy) return;
    sourcePanel.hidden = true; find('source-add').setAttribute('aria-expanded','false'); referenceReturnFocus?.focus({ preventScroll: true });
  }
  function openReferences() {
    if (isLocked()) return;
    referenceReturnFocus = document.activeElement; sourcePanel.hidden = false; find('source-entry').hidden = false;
    find('source-add').setAttribute('aria-expanded','true'); sourceHint(); sourcePanel.querySelector('[data-reference-type][aria-pressed="true"]')?.focus();
  }
  sourcePanel.querySelectorAll('[data-ai-reference-close]').forEach(button => button.onclick = closeReferences);
  sourcePanel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeReferences(); }
    if (event.key !== 'Tab') return;
    const focusable = [...sourcePanel.querySelectorAll('button,input,select,[tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length);
    if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0]?.focus(); }
  });
  referenceToggle.onclick = () => { referencesExpanded = !referencesExpanded; syncReferenceCollapse(); };
  function syncReferenceCollapse() {
    const rows = [...find('source-list').children];
    rows.forEach((row, index) => { row.hidden = !referencesExpanded && !referenceDragId && index >= collapsedReferenceCount; });
    referenceToggle.hidden = rows.length <= collapsedReferenceCount;
    referenceToggle.textContent = referencesExpanded ? '收起参考文档' : `展开全部 ${rows.length} 项`;
    referenceToggle.setAttribute('aria-expanded', String(referencesExpanded));
    find('source-list').classList.toggle('is-expanded', referencesExpanded || !!referenceDragId);
  }
  renderSources();
  find('operation').value = initialOperation;
  find('original').value = original;
  function resizeOriginal() {
    if (closed || find('markdown').hidden) return;
    const input = find('original');
    if (!CSS.supports('field-sizing', 'content')) {
      input.style.height = 'auto';
      input.style.height = `${input.scrollHeight}px`;
    }
    if (markdownPreview) find('markdown-preview').innerHTML = previewMarkdown.parse(original);
  }
  function setWritingMode(mode, focus = true) {
    writingMode = mode === 'markdown' ? 'markdown' : 'rich';
    const markdownMode = writingMode === 'markdown';
    find('rich-editor').hidden = markdownMode;
    find('markdown').hidden = !markdownMode;
    find('markdown-preview-toggle').hidden = !markdownMode;
    find('mode-rich').setAttribute('aria-pressed', String(!markdownMode));
    find('mode-markdown').setAttribute('aria-pressed', String(markdownMode));
    find('mode-label').textContent = markdownMode ? 'Markdown' : '可视化编辑';
    find('format').open = false;
    options.onEditorFormatChange?.(writingMode);
    resizeOriginal();
    if (focus && markdownMode) find('original').focus({ preventScroll: true });
    else if (focus && writingEditorReady) writingEditor.focus();
  }
  find('mode-rich').onclick = () => setWritingMode('rich');
  find('mode-markdown').onclick = () => setWritingMode('markdown');
  find('markdown-preview-toggle').onclick = () => {
    markdownPreview = !markdownPreview;
    find('markdown').classList.toggle('is-previewing', markdownPreview);
    find('markdown-preview').hidden = !markdownPreview;
    find('markdown-preview-toggle').textContent = markdownPreview ? '返回编辑' : '显示预览';
    find('markdown-preview-toggle').setAttribute('aria-pressed', String(markdownPreview));
    resizeOriginal();
  };
  if (rangeConfirmed) find('original').setSelectionRange(range.start, range.end);
  find('document-title').textContent = options.outline || '当前文档';
  function setAssistantVisible(visible) {
    dialog.querySelector('.handbook-writing-assistant').hidden = !visible;
    dialog.classList.toggle('assistant-collapsed', !visible);
    find('panel-toggle').setAttribute('aria-expanded', String(visible));
    find('panel-toggle').setAttribute('aria-label', visible ? '隐藏写作助手' : '显示写作助手');
    find('panel-toggle').title = visible ? '隐藏写作助手' : '显示写作助手';
  }
  find('panel-toggle').onclick = () => setAssistantVisible(find('panel-toggle').getAttribute('aria-expanded') !== 'true');
  const status = message => { find('execution').hidden = false; find('status').textContent = message; };
  let settingsReturnFocus = null;
  let settingsSnapshot = null;
  const usesTemplate = () => ['generate', 'polish'].includes(find('operation').value);
  function updateSettingsSummary() {
    dialog.querySelectorAll('[data-ai-quick-operation], [data-ai-settings-operation]').forEach(button => button.setAttribute('aria-pressed', String((button.dataset.aiQuickOperation || button.dataset.aiSettingsOperation) === find('operation').value)));
    const skillCount = find('skill-list').querySelectorAll('input:checked').length;
    find('skill-count').textContent = skillCount ? `已选 ${skillCount}` : '未选择';
    find('operation-summary').textContent = names[find('operation').value];
    const template = templateCatalog.find(item => item.id === templateId);
    find('settings-summary').textContent = [usesTemplate() ? template?.name : '', skillCount ? `${skillCount} 个 Skill` : ''].filter(Boolean).join(' · ') || '未选择模板或扩展能力';
  }
  function snapshotSettings() {
    return { operation: find('operation').value, range: { ...range }, rangeConfirmed, templateId, selectedSkillIds: [...find('skill-list').querySelectorAll('input:checked')].map(box => box.value) };
  }
  function restoreSettings() {
    if (!settingsSnapshot) return;
    find('operation').value = settingsSnapshot.operation;
    range = { ...settingsSnapshot.range }; rangeConfirmed = settingsSnapshot.rangeConfirmed; rangeLabel();
    templateId = settingsSnapshot.templateId;
    renderSkills();
    for (const box of find('skill-list').querySelectorAll('input')) box.checked = settingsSnapshot.selectedSkillIds.includes(box.value);
    syncTemplateSelection(); controls();
  }
  function closeSettings(apply = true) {
    if (!apply) restoreSettings();
    find('settings-panel').querySelector('.searchable-combobox-input')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: false }));
    find('settings-panel').hidden = true;
    settingsReturnFocus?.focus({ preventScroll: true });
    settingsReturnFocus = null;
  }
  function openSettings() {
    if (busy || (job && ['queued', 'running'].includes(job.status))) return;
    settingsReturnFocus = document.activeElement;
    settingsSnapshot = snapshotSettings();
    find('settings-panel').hidden = false;
    find('settings-panel').querySelector('#handbook-ai-settings-title').focus({ preventScroll: true });
  }
  find('settings-open').onclick = openSettings;
  find('settings-panel').querySelectorAll('[data-ai-settings-cancel]').forEach(button => button.onclick = () => closeSettings(false));
  find('settings-apply').onclick = () => closeSettings(true);
  find('settings-panel').addEventListener('click', event => { if (event.target.classList.contains('handbook-ai-settings-backdrop')) closeSettings(false); });
  find('settings-panel').addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeSettings(false); }
    if (event.key !== 'Tab') return;
    const focusable = [...find('settings-panel').querySelectorAll('button, input, select, textarea, summary, [tabindex="0"]')].filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
    const first = focusable[0]; const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  const remember = id => { try { if (id) sessionStorage.setItem(storageKey, id); else sessionStorage.removeItem(storageKey); } catch (_) {} };
  function rangeLabel() {
    dialog.querySelectorAll('[data-ai-quick-operation], [data-ai-settings-operation]').forEach(button => button.setAttribute('aria-pressed', String((button.dataset.aiQuickOperation || button.dataset.aiSettingsOperation) === find('operation').value)));
    if (!rangeConfirmed) { find('range').textContent = '处理范围：尚未选择，请在左侧确认选文或插入位置。'; return; }
    find('range').textContent = range.start === range.end
      ? `已确认插入位置：前方 ${range.start} 个字符`
      : `已确认处理 ${range.end - range.start} 个字符${range.start === 0 && range.end === original.length ? '（全文）' : ''}`;
  }
  function controls() {
    const running = job && ['queued', 'running'].includes(job.status);
    dialog.querySelectorAll('[data-ai-quick-operation], [data-ai-settings-operation]').forEach(button => { button.disabled = busy || running; });
    if (writingEditorReady) { if (busy || running) writingEditor.disabled(); else writingEditor.enable(); }
    for (const key of ['original', 'operation', 'requirements', 'selection', 'full', 'start', 'resume', 'source-type', 'source-locator', 'source-preview', 'source-add', 'source-file', 'template-select']) find(key).disabled = busy || running;
    find('source-upload').ariaDisabled = String(busy || running);
    find('settings-open').disabled = busy || running;
    for (const box of find('source-list').querySelectorAll('input')) box.disabled = true;
    for (const handle of find('source-list').querySelectorAll('[draggable]')) handle.draggable = !busy && !running;
    for (const button of sourcePanel.querySelectorAll('button')) button.disabled = !!(busy || running);
    referenceToggle.disabled = !!(busy || running);
    for (const box of find('skill-list').querySelectorAll('input')) box.disabled = busy || running;
    find('start').disabled ||= !rangeConfirmed || modelsLoading || !selectedModel();
    find('template-select').disabled ||= templatesLoading;
    find('template-section').hidden = !usesTemplate();
    find('start').disabled ||= find('operation').value === 'generate' && (templatesLoading || !templateId);
    syncTemplatePlaceholder();
    find('source-preview').disabled ||= find('source-type').value === 'knowledge-mcp';
    find('refine').disabled = busy || running;
    find('discard').disabled = busy || running;
    find('fragment').disabled = busy || running;
    for (const button of find('source-list').querySelectorAll('button')) button.disabled = busy || running;
    find('cancel').hidden = !running;
    find('cancel').disabled = busy || !running;
    let rememberedId; try { rememberedId = sessionStorage.getItem(storageKey); } catch (_) {}
    find('resume').hidden = !!job || !rememberedId;
    find('execution-cancel').disabled = busy || !running;
    find('retry').hidden = !job || !['failed', 'interrupted'].includes(job.status);
    find('retry').disabled = busy || running || !job || !['failed', 'interrupted'].includes(job.status);
    find('adopt').disabled = busy || job?.status !== 'completed' || !!job?.adopted;
    find('quality').disabled = busy || job?.status !== 'completed';
    sourceCount();
    updateSettingsSummary();
  }
  const stageNames = { planner: '规划写作', evidence: '整理参考资料', writer: '生成正文', reviewer: '审核候选' };
  const stageStates = { pending: '等待执行', running: '执行中', succeeded: '已完成', failed: '已停止', skipped: '未执行' };
  function revealExecution() {
    find('execution').hidden = false;
    requestAnimationFrame(() => {
      if (closed) return;
      find('execution').focus({ preventScroll: true });
      find('execution').scrollIntoView({ block: 'start' });
    });
  }
  function updateElapsed() {
    const value = feedbackJob;
    const start = Date.parse(value?.startedAt || value?.createdAt);
    const end = ['queued', 'running'].includes(value?.status) ? Date.now() : Date.parse(value?.endedAt || value?.updatedAt);
    find('elapsed').textContent = Number.isFinite(start) && Number.isFinite(end)
      ? `已用 ${Math.max(0, Math.floor((end - start) / 1000))} 秒` : '等待开始';
  }
  function renderExecution(value) {
    feedbackJob = value;
    clearInterval(feedbackTimer);
    updateElapsed();
    const running = ['queued', 'running'].includes(value.status);
    if (running && !closed) feedbackTimer = setInterval(updateElapsed, 1000);
    const current = (value.stageRuns || []).find(run => run.status === 'running');
    const retrieval = value.mcpRetrieval;
    find('phase').textContent = `${current ? `当前：${stageNames[current.stageId] || current.stageId}` : stateNames[value.status] || value.status} · 引用资料 ${(value.sourceSnapshots || []).length} 项${retrieval ? ` · 知识库${{ succeeded: '已检索', partial: '部分命中', empty: '无命中', not_configured: '未配置', failed: '检索失败' }[retrieval.status] || '检索中'}` : ' · 知识库待检索'}`;
    if (retrieval) mcpStatus(`知识库（MCP）自动检索：${{ succeeded: '已取得引用', partial: '部分检索失败', empty: '未找到可引用原文', not_configured: '尚未配置服务或匹配路由', failed: '检索失败，请重试' }[retrieval.status] || retrieval.status}；查询 ${retrieval.attempts?.length || 0} 次，引用 ${retrieval.sourceIds?.length || 0} 篇。`);
    find('preview-wait').hidden = !running || !!value.executionPreview?.text;
    find('preview-wait').textContent = current?.stageId === 'writer'
      ? '正在等待模型返回正文，收到内容后会在此持续展示。可展开下方阶段查看调用详情。'
      : '正在准备生成，阶段与工具调用会在下方更新，正文返回后将在此展示。';
    find('execution').hidden = false;
    const container = find('stages');
    const ids = new Set((value.stageRuns || []).map(run => run.stageRunId));
    for (const node of [...container.children]) if (!ids.has(node.dataset.runId)) node.remove();
    for (const run of value.stageRuns || []) {
      let detail = [...container.children].find(node => node.dataset.runId === run.stageRunId);
      if (!detail) {
        detail = document.createElement('details'); detail.dataset.runId = run.stageRunId;
        const summary = document.createElement('summary');
        const info = document.createElement('p');
        const input = document.createElement('pre'); input.setAttribute('aria-label', '调用输入摘要');
        const output = document.createElement('pre'); output.setAttribute('aria-label', '执行输出详情');
        detail.append(summary, info, input, output); container.append(detail);
      }
      detail.dataset.state = run.status;
      const [summary, info, input, output] = detail.children;
      summary.textContent = `${stageNames[run.stageId] || run.stageId} · ${stageStates[run.status] || run.status}${run.toolName ? ` · ${run.toolName}` : ''}`;
      info.textContent = run.status === 'skipped' ? '未配置审核服务，本次未执行审核。' : run.startedAt
        ? `开始：${new Date(run.startedAt).toLocaleTimeString()}${run.endedAt ? ` · 结束：${new Date(run.endedAt).toLocaleTimeString()}` : ''} · 第 ${run.attempt || 1} 次执行` : '尚未调用';
      input.textContent = run.inputSummary ? `调用输入摘要\n${JSON.stringify(run.inputSummary, null, 2)}` : '';
      // Display only contract artifacts; never render model configuration or messages.
      const artifact = value.artifacts?.[run.stageId];
      const latest = [...(value.stageRuns || [])].reverse().find(item => item.stageId === run.stageId);
      const result = latest?.stageRunId === run.stageRunId && run.status === 'succeeded' ? artifact : null;
      output.textContent = run.errorSummary || (result || run.outputSummary ? `执行输出\n${JSON.stringify(result || run.outputSummary, null, 2)}` : '等待输出');
    }
    const preview = value.executionPreview;
    find('preview-panel').hidden = !preview?.text;
    find('preview').textContent = preview?.text || '';
    find('preview-notice').textContent = `${preview?.truncated ? '预览已截断，完整结果请在候选中查看。' : ''}${['failed', 'cancelled', 'interrupted'].includes(value.status) ? '任务已停止，以上仅为未完成预览，不能采用。' : '预览不写入草稿。'}`;
  }
  function showJob(value) {
    if (['failed', 'cancelled', 'interrupted'].includes(value.status) && fallbackCandidate) {
      const previous = fallbackCandidate; fallbackCandidate = null;
      showJob(previous.job); renderExecution(value); find('fragment').value = previous.fragment;
      provenancePanel.innerHTML = previous.provenance; remember(previous.job.jobId);
      status(`${value.error?.message || stateNames[value.status]}。上次候选仍保留，可调整要求重试。`); return;
    }
    const newlyCompleted = value.status === 'completed' && (job?.jobId !== value.jobId || job?.status !== 'completed');
    job = value;
    renderExecution(value);
    const selection = value.modelSelection || value.metadata?.modelSelection;
    find('used-skills').textContent = value.skillSnapshots?.length
      ? `本次实际使用：${value.skillSnapshots.map(skill => `${skill.displayName} v${skill.version}（${skill.contentDigest.slice(0, 12)}）`).join('、')}` : '本次未选用扩展能力。';
    status(value.error?.message || stateNames[value.status] || value.status);
    find('candidate').hidden = value.status !== 'completed';
    if (value.status === 'completed') {
      fallbackCandidate = null; find('start').textContent = '重新生成候选';
      find('before').value = original.slice(range.start, range.end);
      find('fragment').value = value.fragment;
      provenancePanel.innerHTML = renderProductionProvenance(value.metadata, value.candidateMarkdown);
      if (newlyCompleted) requestAnimationFrame(() => { if (!closed) { find('candidate').focus({ preventScroll: true }); find('candidate').scrollIntoView({ block: 'start' }); } });
      if (value.adopted) status('此候选已采用，请回到工作台查看已保存草稿。');
    }
    controls();
    clearTimeout(timer);
    if (['queued', 'running'].includes(value.status) && !closed) timer = setTimeout(poll, 1000);
  }
  async function poll() {
    if (closed || !job) return;
    const id = job.jobId;
    try { const value = await loadHandbookAI(context, id); if (!closed && job?.jobId === id && (!['completed', 'cancelled', 'failed', 'interrupted'].includes(job.status) || !['queued', 'running'].includes(value.status))) showJob(value); }
    catch (error) {
      if (closed || job?.jobId !== id) return;
      status(`连接暂时中断：${error.message}。正在重新查询同一任务…`);
      controls(); clearTimeout(timer); timer = setTimeout(poll, 1000);
    }
  }
  dialog.addEventListener('submit', event => event.preventDefault());
  function renderSkills() {
    const selected = new Set([...find('skill-list').querySelectorAll('input:checked')].map(box => box.value));
    find('skill-list').replaceChildren();
    const applicable = skillCatalog.filter(skill => skill.operations.includes(find('operation').value));
    find('skill-info').textContent = applicable.length ? '预览能力说明和指令后，勾选本次使用的能力。' : '当前操作没有可选扩展能力。';
    for (const skill of applicable) {
      const row = document.createElement('section');
      const label = document.createElement('label');
      const box = document.createElement('input'); box.type = 'checkbox'; box.value = skill.skillId; box.checked = selected.has(skill.skillId);
      label.append(box, document.createTextNode(`${skill.displayName} v${skill.version}：${skill.description}`));
      const detail = document.createElement('details');
      const summary = document.createElement('summary'); summary.textContent = '查看能力指令';
      const preview = document.createElement('textarea'); preview.readOnly = true; preview.rows = 5; preview.value = skill.content;
      preview.setAttribute('aria-label', '续写能力指令预览');
      detail.append(summary, preview); row.append(label, detail); find('skill-list').append(row);
    }
    find('skill-list').onchange = updateSettingsSummary;
    updateSettingsSummary();
    controls();
  }
  function mcpStatus(message) {
    find('mcp-status').textContent = message;
    if (find('mcp-summary')) find('mcp-summary').textContent = message;
  }
  function sourceCount() {
    const selected = referenceOrder.filter(id => id === 'knowledge-mcp' || sourceSnapshots.some(source => source.sourceId === id));
    find('source-count').textContent = `已添加 ${sourceSnapshots.length} 项 · 默认引用知识库`;
    for (const row of find('source-list').children) {
      const priority = selected.indexOf(row.dataset.sourceId);
      row.dataset.selected = 'true';
      row.querySelector('[data-source-priority]').textContent = `优先级 ${priority + 1}`;
      for (const button of row.querySelectorAll('[data-source-direction]')) {
        button.hidden = false;
        button.disabled = busy || ['queued', 'running'].includes(job?.status)
          || (button.dataset.sourceDirection === 'up' ? priority <= 0 : priority === selected.length - 1);
      }
    }
  }
  find('source-list').addEventListener('change', () => { sourceCount(); updateSettingsSummary(); });
  function renderSources() {
    find('source-list').replaceChildren();
    const known = new Map(sourceSnapshots.map(source => [source.sourceId, source]));
    for (const source of referenceOrder.filter(id => id === 'knowledge-mcp' || known.has(id)).map(id => id === 'knowledge-mcp' ? { sourceId: id, sourceType: id, title: '知识库（MCP）', locator: '按写作要求自动检索', automatic: true } : known.get(id))) {
      const row = document.createElement('section');
      const label = document.createElement('label');
      const box = document.createElement('input'); box.type = 'checkbox'; box.value = source.sourceId; box.checked = source.sourceId !== 'knowledge-mcp'; box.hidden = true; box.tabIndex = -1;
      row.dataset.sourceId = source.sourceId;
      const handle = document.createElement('span'); handle.className = 'handbook-source-drag-handle'; handle.textContent = '⋮⋮'; handle.title = '拖动调整优先级'; handle.setAttribute('aria-hidden', 'true'); handle.draggable = !isLocked();
      label.append(handle, box, document.createTextNode(source.title || source.locator));
      const priority = document.createElement('span'); priority.dataset.sourcePriority = '';
      priority.className = 'handbook-source-priority';
      const preview = document.createElement('button'); preview.type = 'button'; preview.className = 'button secondary';
      preview.textContent = '预览'; preview.setAttribute('aria-label', `预览资料：${source.title || source.locator}`);
      preview.hidden = source.automatic === true; preview.onclick = () => openSourcePreview(source);
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button secondary'; remove.textContent = '移除资料';
      remove.hidden = source.sourceId === 'knowledge-mcp';
      remove.onclick = () => { if (isLocked()) return; pendingStart = null; sourceSnapshots = sourceSnapshots.filter(item => item.sourceId !== source.sourceId); referenceOrder = referenceOrder.filter(id => id !== source.sourceId); renderSources(); sourceCount(); controls(); };
      const actions = document.createElement('div'); actions.className = 'handbook-source-actions';
      for (const [direction, text] of [['up', '上移'], ['down', '下移']]) {
        const move = document.createElement('button'); move.type = 'button'; move.className = 'button secondary';
        move.textContent = text; move.dataset.sourceDirection = direction;
        move.setAttribute('aria-label', `${text}资料：${source.title || source.locator}`);
        move.onclick = () => {
          if (isLocked()) return;
          const selectedIds = referenceOrder;
          const index = selectedIds.indexOf(source.sourceId);
          const targetId = selectedIds[index + (direction === 'up' ? -1 : 1)];
          if (!targetId) return;
              const fromOrder = referenceOrder.indexOf(source.sourceId); const toOrder = referenceOrder.indexOf(targetId);
          referenceOrder.splice(fromOrder, 1); referenceOrder.splice(toOrder, 0, source.sourceId);
          pendingStart = null; renderSources(); sourceCount(); updateSettingsSummary();
          find('source-list').querySelector(`[data-source-id="${CSS.escape(source.sourceId)}"] [data-source-direction="${direction}"]`)?.focus();
        };
        actions.append(move);
      }
      handle.ondragstart = event => { if (isLocked()) { event.preventDefault(); return; } referenceDragId = source.sourceId; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', source.sourceId); row.classList.add('is-dragging'); syncReferenceCollapse(); };
      handle.ondragend = () => { referenceDragId = null; row.classList.remove('is-dragging'); syncReferenceCollapse(); };
      row.ondragover = event => { if (isLocked() || !referenceDragId) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; row.classList.add('is-drag-target'); };
      row.ondragleave = () => row.classList.remove('is-drag-target');
      row.ondrop = event => { event.preventDefault(); row.classList.remove('is-drag-target'); if (isLocked() || !referenceDragId) return; const id = referenceDragId; referenceDragId = null; const from = referenceOrder.indexOf(id); const to = referenceOrder.indexOf(source.sourceId); if (from < 0 || to < 0 || from === to) { syncReferenceCollapse(); return; } referenceOrder.splice(from, 1); referenceOrder.splice(to, 0, id); pendingStart = null; renderSources(); sourceCount(); syncReferenceCollapse(); };
      actions.append(preview, remove);
      const state = document.createElement('span'); state.className = 'handbook-source-state'; state.textContent = source.automatic ? '默认引用 · 自动检索' : types.find(([value]) => value === source.sourceType)?.[1] || '已引用';
      row.append(label, priority, state, actions); find('source-list').append(row);
    }
    sourceCount(); syncReferenceCollapse();
  }
  find('source-list').addEventListener('click', () => { sourceCount(); updateSettingsSummary(); });
  let sourceCatalog = null;
  function openSourcePreview(source) {
    const page = window.open('', '_blank');
    if (!page) { sourceStatus('浏览器阻止了新标签页，请允许弹出窗口后重试。', true); return; }
    page.opener = null;
    const doc = page.document;
    doc.title = source.title || '参考资料预览';
    const viewport = doc.createElement('meta'); viewport.name = 'viewport'; viewport.content = 'width=device-width,initial-scale=1';
    const csp = doc.createElement('meta'); csp.httpEquiv = 'Content-Security-Policy'; csp.content = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";
    const style = doc.createElement('style'); style.textContent = 'body{margin:0;color:#242a30;background:#fff;font:16px/1.65 system-ui,sans-serif}header{border-bottom:1px solid #dce1e5;padding:20px max(24px,calc((100% - 900px)/2))}h1{font-size:24px;line-height:1.3;margin:0 0 8px}small{color:#66717a;overflow-wrap:anywhere}.modes{display:flex;gap:4px;margin-top:18px}.modes button{font:inherit;border:1px solid #c9d0d5;background:#fff;padding:7px 14px;cursor:pointer}.modes button[aria-pressed=true]{background:#242a30;color:#fff}main{max-width:900px;margin:auto;padding:24px;overflow-wrap:anywhere}main h1{font-size:22px}main h2{font-size:19px;margin-top:28px}main img{display:block;max-width:100%;height:auto;margin:16px 0}main pre{background:#f5f7f8;padding:14px;overflow:auto}main pre,main code{font:14px/1.7 ui-monospace,monospace}main table{border-collapse:collapse;display:block;overflow-x:auto}main th,main td{border:1px solid #dce1e5;padding:6px 10px}main blockquote{border-left:3px solid #a4b2bb;margin:18px 0;padding-left:16px}main a{color:#09698a}#raw{white-space:pre-wrap;overflow-wrap:anywhere;background:none;padding:0}';
    doc.head.append(viewport, csp, style);
    const header = doc.createElement('header'); const title = doc.createElement('h1'); title.textContent = source.title || '参考资料';
    const origin = doc.createElement('small'); origin.textContent = [source.sourceType, source.originalUrl || source.locator].filter(Boolean).join(' · ');
    const imageResources = Array.isArray(source.imageResources) ? source.imageResources : [];
    const imageStatus = doc.createElement('small'); imageStatus.style.display = 'block';
    if (imageResources.length) imageStatus.textContent = `图片：${imageResources.filter(image => image.status === 'ready').length} 张可查看，${imageResources.filter(image => image.status !== 'ready').length} 张未能读取`;
    const modes = doc.createElement('div'); modes.className = 'modes'; modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', '预览模式');
    const readingButton = doc.createElement('button'); readingButton.type = 'button'; readingButton.textContent = '阅读视图'; readingButton.setAttribute('aria-pressed', 'true');
    const rawButton = doc.createElement('button'); rawButton.type = 'button'; rawButton.textContent = '原始内容'; rawButton.setAttribute('aria-pressed', 'false');
    modes.append(readingButton, rawButton); header.append(title, origin, imageStatus, modes);
    const main = doc.createElement('main'); const reading = doc.createElement('article'); reading.id = 'reading'; reading.innerHTML = previewMarkdown.parse(String(source.content || ''));
    for (const image of reading.querySelectorAll('img')) image.addEventListener('error', () => {
      const fallback = doc.createElement('span'); fallback.textContent = `[图片未能读取：${image.alt || '图片'}]`; image.replaceWith(fallback);
    });
    const raw = doc.createElement('pre'); raw.id = 'raw'; raw.textContent = source.content; raw.hidden = true;
    const selectMode = showRaw => { reading.hidden = showRaw; raw.hidden = !showRaw; readingButton.setAttribute('aria-pressed', String(!showRaw)); rawButton.setAttribute('aria-pressed', String(showRaw)); };
    readingButton.onclick = () => selectMode(false); rawButton.onclick = () => selectMode(true);
    main.append(reading, raw);
    doc.body.replaceChildren(header, main);
  }
  find('source-add').onclick = openReferences;
  const sourceStatus = (message, failed = false) => {
    find('source-info').textContent = message;
    find('source-info').hidden = !message;
    find('source-info').setAttribute('role', failed ? 'alert' : 'status');
  };
  function sourceHint() {
    const type = find('source-type').value;
    const pingcode = ['pingcode-design', 'pingcode-test'].includes(type);
    sourcePanel.querySelectorAll('[data-reference-type]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.referenceType === type)));
    find('reference-type-title').textContent = types.find(([value]) => value === type)?.[1] || '参考文档';
    find('mcp-status').hidden = type !== 'knowledge-mcp';
    find('source-locator-label').hidden = type === 'knowledge-mcp' || type === 'local-document';
    find('source-upload').hidden = type !== 'local-document';
    find('source-preview').hidden = type === 'knowledge-mcp' || type === 'local-document';
    find('source-preview').disabled = busy || type === 'knowledge-mcp';
    find('source-locator').placeholder = pingcode ? 'PingCode 页面网址或空间标识/页面ID' : type === 'url' ? '输入 HTTP(S) 网页地址' : '输入文档标识或文件名';
    find('source-locator').setAttribute('aria-describedby', 'writing-source-info');
    find('source-info').id = 'writing-source-info';
    sourceStatus(pingcode ? `请填写 PingCode 页面网址或“空间标识/页面ID”。可引用空间：${sourceCatalog?.pingcodeSpaces?.join('、') || '尚未配置'}`
      : type === 'url' ? (sourceCatalog?.allowPublicWeb ? '支持公开网页、Markdown 和纯文本地址；读取后预览并确认引用。' : '支持管理员配置的网页文献来源。')
        : type === 'local-document' ? '上传后解析正文并加入引用列表；扫描PDF需先转换为可提取文字的文档。' : type === 'test-case-library' ? '请填写测试用例库内的 Markdown、SQL 或文本文件名。' : '知识库默认参与生成。Agent 根据写作要求和文档主题按预设策略检索，不需填写地址或文档标识。');
  }
  find('source-type').addEventListener('change', sourceHint);
  const uploadLocalSource = async file => {
    if (!file || isLocked()) return;
    if (sourceCatalog && sourceSnapshots.length >= sourceCatalog.maxConfirmed) { sourceStatus(`最多引用 ${sourceCatalog.maxConfirmed} 份文档，请先移除不需要的文档。`, true); return; }
    busy = true; controls(); sourceStatus(`正在解析 ${file.name}…`);
    try {
      const source = await uploadHandbookAISource(context, file, percent => sourceStatus(`正在上传并解析 ${file.name}… ${percent}%`));
      sourceSnapshots.push(source); referenceOrder = referenceOrder.filter(id => id !== source.sourceId); referenceOrder.push(source.sourceId); renderSources();
      sourceStatus('本地文档已添加，并已排在引用优先级末尾。拖动资料卡可调整顺序。');
      find('source-file').value = '';
    } catch (error) { sourceStatus(`本地文档读取失败：${error.message}`, true); }
    finally { busy = false; controls(); }
  };
  find('source-file').onchange = () => uploadLocalSource(find('source-file').files?.[0]);
  find('source-upload').onclick = event => { if (event.target !== find('source-file') && !isLocked()) find('source-file').click(); };
  find('source-upload').setAttribute('role', 'button'); find('source-upload').setAttribute('aria-label', '上传本地参考文档');
  find('source-upload').onkeydown = event => { if (['Enter',' '].includes(event.key)) { event.preventDefault(); if (!isLocked()) find('source-file').click(); } };
  find('source-upload').ondragover = event => { event.preventDefault(); if (!isLocked()) find('source-upload').classList.add('is-dragover'); };
  find('source-upload').ondragleave = () => find('source-upload').classList.remove('is-dragover');
  find('source-upload').ondrop = event => { event.preventDefault(); find('source-upload').classList.remove('is-dragover'); if (event.dataTransfer.files?.length > 1) { sourceStatus('请每次上传一份文档，添加后可继续上传。', true); return; } uploadLocalSource(event.dataTransfer.files?.[0]); };
  find('source-preview').onclick = async () => {
    if (isLocked()) return;
    if (sourceCatalog && sourceSnapshots.length >= sourceCatalog.maxConfirmed) { sourceStatus(`最多引用 ${sourceCatalog.maxConfirmed} 份文档，请先移除不需要的文档。`, true); return; }
    busy = true; controls(); sourceStatus('正在拉取参考资料…');
    try {
      const locator = find('source-locator').value.trim();
      if (!locator && find('source-type').value !== 'knowledge-mcp') throw new Error('请填写资料地址或文档标识');
      const source = await previewHandbookAISource(context, { sourceType: find('source-type').value, locator });
      if (sourceSnapshots.some(item => item.sourceId === source.sourceId)) {
        sourceStatus('该资料已添加，请直接在列表中选择或调整优先级。', true);
        return;
      }
      sourceSnapshots.push(source); referenceOrder = referenceOrder.filter(id => id !== source.sourceId); referenceOrder.push(source.sourceId); renderSources();
      sourceCount();
      sourceStatus('资料已添加，并已排在引用优先级末尾。拖动资料卡可调整顺序。');
      find('source-locator').value = '';
    } catch (error) { sourceStatus(`资料读取失败：${error.message}${error.requestId ? `（诊断编号：${error.requestId}）` : ''}`, true); }
    finally { busy = false; controls(); }
  };
  const host = options.host || (embedded ? document.querySelector('.handbook-production-writing') : document.getElementById('view-root'));
  if (!host) throw new Error('写作页面缺少主内容容器');
  const previous = document.createDocumentFragment();
  const scrollOwner = document.getElementById('main-shell') || document.scrollingElement;
  const previousScroll = scrollOwner.scrollTop;
  const previousTitle = document.title;
  const entryURL = new URL(location.href);
  const writingURL = new URL(entryURL);
  writingURL.searchParams.set('writing', initialOperation);
  writingURL.searchParams.set('documentId', context.documentId);
  if (context.outlineVersionId) writingURL.searchParams.set('outlineVersionId', context.outlineVersionId);
  if (context.branch) writingURL.searchParams.set('branch', context.branch);
  if (!entryURL.searchParams.has('writing')) history.pushState(history.state, '', writingURL);
  function closePage(fromHistory = false) {
    if (closed) return;
    closed = true; clearTimeout(timer); clearInterval(feedbackTimer);
    writingEditor?.destroy(); writingEditor = null; writingEditorReady = false;
    document.removeEventListener('selectionchange', trackSelection); richSelection.dispose();
    window.removeEventListener('popstate', onHistory, true);
    window.removeEventListener('resize', resizeOriginal);
    host.replaceChildren(previous);
    host.classList.remove('has-writing-assistant');
    document.removeEventListener('click', onWorkbenchAction, true);
    cleanupSearchableSelects();
    if (!embedded) document.body.classList.remove('immersive-writing');
    document.title = previousTitle;
    if (!fromHistory) {
      const url = new URL(location.href); url.searchParams.delete('writing');
      history.replaceState(history.state, '', url);
    }
    scrollOwner.scrollTop = previousScroll;
    options.trigger?.focus({ preventScroll: true }); options.onClose?.();
  }
  function onHistory(event) {
    const target = new URL(location.href);
    event.handbookWritingReturn = target.pathname === entryURL.pathname
      && target.searchParams.get('documentId') === entryURL.searchParams.get('documentId')
      && target.searchParams.get('branch') === entryURL.searchParams.get('branch');
    closePage(true);
  }
  window.addEventListener('popstate', onHistory, true);
  // 工作台操作先释放会话，再交由原事件处理器执行，避免轮询泄漏或覆盖编辑状态。
  function onWorkbenchAction(event) {
    if (!embedded || dialog.contains(event.target)) return;
    if (event.target.closest('[data-handbook-document], [data-handbook-mode], [data-handbook-draft-save], [data-handbook-editor-format], [data-handbook-focus-toggle], [data-handbook-directory-mode], [data-handbook-ai-action], .handbook-command-document a, [data-handbook-discard], [data-handbook-history], [data-handbook-review-current]')) closePage();
  }
  if (embedded) document.addEventListener('click', onWorkbenchAction, true);
  dialog.close = () => closePage();
  find('close').onclick = () => closePage();
  function editOriginal(value) {
    selectedRichRange = null;
    original = value;
    find('original').value = value;
    resizeOriginal();
    options.onEdit?.(original);
    range = { start: 0, end: original.length }; rangeConfirmed = false;
    resetCandidate(); rangeLabel(); find('execution').hidden = true;
  }
  find('original').addEventListener('input', () => {
    editOriginal(find('original').value); if (writingEditorReady) writingEditor.setValue(original);
  });
  let selectedRichRange = null;
  function trackSelection() {
    const selection = window.getSelection();
    if (selection?.rangeCount && find('rich-editor').contains(selection.anchorNode)) selectedRichRange = richSelection();
  }
  document.addEventListener('selectionchange', trackSelection);
  function resetCandidate() { clearInterval(feedbackTimer); feedbackJob = null; job = null; fallbackCandidate = null; pendingStart = null; remember(null); find('candidate').hidden = true; qualityReportId = null; find('quality-result').textContent = ''; controls(); }
  find('operation').onchange = () => {
    resetCandidate();
    pendingStart = null;
    range = find('operation').value === 'continue' ? { start: find('original').selectionStart, end: find('original').selectionStart } : { start: 0, end: original.length };
    rangeConfirmed = !['polish', 'continue'].includes(find('operation').value);
    rangeLabel();
    renderSkills();
    syncTemplateSelection();
    updateSettingsSummary();
  };
  find('selection').onclick = () => {
    const field = find('markdown').hidden && selectedRichRange
      ? { selectionStart: selectedRichRange.start, selectionEnd: selectedRichRange.end } : find('original');
    if (find('operation').value === 'continue' && field.selectionStart !== field.selectionEnd) { status('续写请只指定光标位置，不要选择原文。'); return; }
    if (find('operation').value !== 'continue' && field.selectionStart === field.selectionEnd) { status('请选择需要修改的文字，或点击“处理全文”。'); return; }
    resetCandidate(); rangeConfirmed = true;
    range = { start: field.selectionStart, end: field.selectionEnd }; pendingStart = null; rangeLabel(); controls();
  };
  find('full').onclick = () => {
    if (find('operation').value === 'continue') { status('续写请指定插入位置。'); return; }
    resetCandidate(); rangeConfirmed = true;
    range = { start: 0, end: original.length }; pendingStart = null; rangeLabel(); controls();
  };
  find('start').onclick = async () => {
    if (busy || !rangeConfirmed || modelsLoading || !selectedModel()) return;
    if (options.getMarkdown() !== original) { status('工作台正文已变化，请关闭并重新打开 AI 文档生产，保留当前人工修改。'); return; }
    if (job?.status === 'completed') fallbackCandidate = { job, fragment: find('fragment').value, provenance: provenancePanel.innerHTML };
    busy = true; controls(); status('正在提交任务…');
    clearInterval(feedbackTimer); feedbackJob = null;
    find('stages').replaceChildren(); find('preview-panel').hidden = true;
    find('phase').textContent = '正在创建任务'; find('elapsed').textContent = '等待开始';
    find('preview-wait').hidden = false; find('preview-wait').textContent = '任务创建后将在此展示执行阶段、调用详情和生成内容。';
    revealExecution();
    const confirmedSourceIds = [...find('source-list').querySelectorAll('input:checked')].map(box => box.value);
    const selectedSkills = [...find('skill-list').querySelectorAll('input:checked')].map(box => {
      const skill = skillCatalog.find(item => item.skillId === box.value);
      return { skillId: skill.skillId, contentDigest: skill.contentDigest };
    });
    const payload = { modelSelection: selectedModel(), operation: find('operation').value, markdown: original, range, editVersion, templateId: usesTemplate() ? templateId || null : null, outline: options.outline, requirements: find('requirements').value, confirmedSourceIds, referenceOrder: referenceOrder.filter(id => id === 'knowledge-mcp' || confirmedSourceIds.includes(id)), selectedSkills, originSnapshot: originSnapshot || { originType: 'blank', contentDigest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', handbookId: context.handbookId, documentId: context.documentId, branch: context.branch }, document: { handbookId: context.handbookId, documentId: context.documentId, outlineVersionId: context.outlineVersionId, branch: context.branch } };
    const digest = JSON.stringify(payload);
    if (!pendingStart || pendingStart.digest !== digest) pendingStart = { digest, key: globalThis.crypto?.randomUUID?.() || `ai-web-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    try {
      const value = await startHandbookAI(context, payload, pendingStart.key);
      remember(value.jobId); pendingStart = null; qualityReportId = null; find('quality-result').textContent = ''; showJob(value);
    } catch (error) {
      status(`无法生成：${error.message}`);
      if (error.code === 'AI_ORIGIN_BASELINE_CHANGED') await resolveOriginDrift();
    }
    finally { busy = false; controls(); }
  };
  async function resolveOriginDrift() {
    if (originSnapshot?.originType !== 'gitlab' || typeof options.loadLatestOrigin !== 'function') return;
    status('正在读取 GitLab 最新基线…');
    try {
      const latest = await options.loadLatestOrigin();
      if (!latest?.snapshot || typeof latest.content !== 'string') throw new Error('未取得有效的新基线');
      const prompt = document.createElement('dialog');
      prompt.className = 'handbook-origin-drift-dialog';
      const heading = document.createElement('h2'); heading.textContent = 'GitLab 基线已更新';
      const explanation = document.createElement('p'); explanation.textContent = '请比较当前基线与 GitLab 最新内容，再选择本次生成使用的版本。载入新基线会替换当前未保存工作副本。';
      const comparison = document.createElement('div'); comparison.className = 'handbook-origin-drift-comparison';
      for (const [title, value] of [['当前 GitLab 基线', options.originBaselineContent ?? original], ['GitLab 最新基线', latest.content]]) {
        const section = document.createElement('section');
        const label = document.createElement('h3'); label.textContent = title;
        const content = document.createElement('pre'); content.textContent = value;
        section.append(label, content); comparison.append(section);
      }
      const actions = document.createElement('footer');
      const keep = document.createElement('button'); keep.type = 'button'; keep.className = 'button secondary'; keep.textContent = '继续使用当前基线';
      const reload = document.createElement('button'); reload.type = 'button'; reload.className = 'button'; reload.textContent = '载入 GitLab 最新基线';
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'button secondary'; cancel.textContent = '稍后处理';
      actions.append(keep, reload, cancel); prompt.append(heading, explanation, comparison, actions); document.body.append(prompt);
      const choice = await new Promise(resolve => {
        const finish = value => { prompt.close(); prompt.remove(); resolve(value); };
        keep.onclick = () => finish('keep'); reload.onclick = () => finish('reload'); cancel.onclick = () => finish('cancel');
        prompt.addEventListener('cancel', event => { event.preventDefault(); finish('cancel'); }, { once: true });
        prompt.showModal();
      });
      if (choice === 'keep') {
        originSnapshot = { ...originSnapshot, pinToCommit: true };
        pendingStart = null;
        status('将固定使用当前 GitLab commit；再次生成会基于已打开的原文快照。');
      } else if (choice === 'reload') {
        originSnapshot = latest.snapshot;
        original = latest.content;
        range = { start: 0, end: original.length }; rangeConfirmed = false;
        find('original').value = original; writingEditor?.setValue(original); options.onEdit?.(original);
        resetCandidate(); rangeLabel(); controls();
        status('已载入 GitLab 最新基线，请重新确认处理范围后生成。');
      }
    } catch (error) { status(`读取 GitLab 最新基线失败：${error.message}`); }
  }
  find('refine').onclick = () => { setAssistantVisible(true); find('requirements').focus(); find('requirements').scrollIntoView({ block: 'center' }); status('调整写作要求后点击“重新生成候选”；本次仍基于原文与已确认范围。'); };
  find('resume').onclick = async () => {
    let id; try { id = sessionStorage.getItem(storageKey); } catch (_) {}
    if (!id) { status('当前文档没有可恢复任务。'); return; }
    busy = true; controls(); clearTimeout(timer); revealExecution();
    try {
      const previous = await loadHandbookAI(context, id);
      fallbackCandidate = null; rangeConfirmed = true;
      templateId = previous.templateSnapshot?.templateId || '';
      syncTemplateSelection();
      original = previous.originalMarkdown; editVersion = previous.editVersion; range = previous.range;
      find('original').value = original; writingEditor?.setValue(original); find('operation').value = normalizeOperation(previous.operation);
      find('requirements').value = previous.requirements; rangeLabel(); showJob(previous);
      renderSkills();
      for (const box of find('skill-list').querySelectorAll('input')) {
        const current = skillCatalog.find(skill => skill.skillId === box.value);
        box.checked = (previous.skillSnapshots || []).some(skill => skill.skillId === box.value && skill.contentDigest === current?.contentDigest);
      }
      sourceSnapshots = (previous.sourceSnapshots || []).filter(source => !source.automatic);
      referenceOrder = [...(previous.referenceOrder || []), ...sourceSnapshots.map(source => source.sourceId)].filter((id, index, list) => (id === 'knowledge-mcp' || sourceSnapshots.some(source => source.sourceId === id)) && list.indexOf(id) === index);
      if (!referenceOrder.includes('knowledge-mcp')) referenceOrder.unshift('knowledge-mcp');
      renderSources();
      sourceCount();
      controls();
    } catch (error) { status(`恢复失败：${error.message}`); }
    finally { busy = false; controls(); }
  };
  find('cancel').onclick = async () => {
    if (!job || busy) return;
    busy = true; controls(); clearTimeout(timer);
    try { showJob(await actHandbookAI(context, job.jobId, 'cancel')); }
    catch (error) { status(`取消未确认：${error.message}，请恢复任务核对。`); job = null; }
    finally { busy = false; controls(); }
  };
  find('retry').onclick = async () => {
    if (!job || busy || !['failed', 'interrupted'].includes(job.status)) return;
    if (!pendingRetry || pendingRetry.jobId !== job.jobId) pendingRetry = { jobId: job.jobId, key: globalThis.crypto?.randomUUID?.() || `ai-retry-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    busy = true; controls(); clearTimeout(timer); status('正在提交重试任务…'); revealExecution();
    try {
      const value = await actHandbookAI(context, job.jobId, 'retry', { idempotencyKey: pendingRetry.key });
      pendingRetry = null; remember(value.jobId); showJob(value);
    } catch (error) { status(`重试未提交：${error.message}。请恢复任务核对。`); }
    finally { busy = false; controls(); }
  };
  find('discard').onclick = () => { resetCandidate(); status('已放弃候选，当前正文保留。'); controls(); };
  find('fragment').addEventListener('input', () => {
    provenancePanel.innerHTML = '<p>候选已人工修改；保存时记录修改区间。原候选依据可在恢复任务后查看，修改内容需重新核验。</p>';
  });
  find('adopt').onclick = async () => {
    if (!job || busy) return;
    if (options.getMarkdown() !== original) { status('工作台正文已变化，请保留人工修改并重新生成。'); return; }
    const fragment = find('fragment').value;
    const markdown = original.slice(0, range.start) + fragment + original.slice(range.end);
    busy = true; controls(); find('fragment').disabled = true; status('正在采用并保存…');
    try {
      const result = await actHandbookAI(context, job.jobId, 'adopt', {
        originalMarkdown: original, markdown, editVersion,
        attachmentIds: options.attachmentIds || [], baselineDigest: await options.baselineDigest(),
      });
      remember(null); closePage();
      await options.onAdopt(result, original);
    } catch (error) { status(`采用未完成：${error.message}。候选仍保留，可核对后重试。`); }
    finally { busy = false; find('fragment').disabled = false; controls(); }
  };
  find('quality').onclick = async () => {
    if (busy || job?.status !== 'completed') return;
    busy = true; controls();
    const output = find('quality-result'); output.textContent = '正在执行用例检查…';
    try {
      const candidateMarkdown = original.slice(0, range.start) + find('fragment').value + original.slice(range.end);
      const report = await runHandbookQuality(context, { markdown: candidateMarkdown, editVersion, rerunOfReportId: qualityReportId, idempotencyKey: `quality-${job?.jobId || Date.now()}-${qualityReportId || 'first'}` });
      qualityReportId = report.reportId;
      output.textContent = `质量报告：${report.gate === 'passed' ? '通过' : '未通过'}；通过 ${report.coverage.passed}，失败 ${report.coverage.failed}，未执行 ${report.coverage.notExecuted}。报告编号 ${report.reportId}`;
    } catch (error) { output.textContent = `质量检查未完成：${error.message}`; }
    finally { busy = false; controls(); }
  };
  async function loadModelCatalog() {
    modelsLoading = true; controls();
    try {
      const catalog = await loadProductionModels(); if (closed) return;
      defaultModel = (catalog.options || []).find(v => v.serviceId === catalog.defaultSelection?.serviceId && v.model === catalog.defaultSelection?.model) || null;
      pendingStart = null;
    } catch (_) { defaultModel = null; }
    finally { modelsLoading = false; if (!closed) controls(); }
  }
  find('execution-cancel').onclick = () => find('cancel').click();
  function syncTemplatePlaceholder() {
    const optional = find('operation').value === 'polish';
    const emptyOption = find('template-select').querySelector('option[value="__none"]');
    const label = optional ? '不使用模板' : '请选择文档模板';
    if (emptyOption && emptyOption.textContent !== label) {
      emptyOption.textContent = label;
      syncSearchableSelect(find('template-select'));
    }
  }
  function syncTemplateSelection() {
    const inheritedTemplate = templateCatalog.find(item => item.id === templateId || item.legacyPath === templateId);
    if (inheritedTemplate && templateId) templateId = inheritedTemplate.id;
    const available = !!inheritedTemplate;
    if (templateId && !available) {
      find('template').textContent = '原模板不可用；历史候选仍可查看，新生成前请选择模板。';
      templateId = '';
    } else find('template').textContent = templateId ? '' : (find('operation').value === 'generate' ? '请选择用于当前文档的模板。' : '');
    find('template-select').value = templateId || '__none';
    syncSearchableSelect(find('template-select'));
  }
  async function loadTemplateCatalog() {
    templatesLoading = true; controls();
    try {
      const result = await loadTemplates({ summary: '1' });
      if (closed) return;
      if (result.success === false) throw new Error(result.error?.message || '模板目录暂不可用');
      const items = result.data || result;
      templateCatalog = (Array.isArray(items) ? items : items.items || []).filter(item => item.status !== 'disabled');
      find('template-select').replaceChildren(new Option('请选择文档模板', '__none'), ...templateCatalog.map(item => new Option(`${item.name || item.title || item.id}${item.currentVersion ? ` · v${item.currentVersion}` : ''}`, item.id)));
      syncTemplateSelection();
    } catch (error) {
      if (closed) return;
      find('template').textContent = `模板读取失败：${error.message}，请刷新页面重试。`;
      find('template-select').replaceChildren(new Option('模板读取失败', '')); templateId = '';
    } finally { if (!closed) { templatesLoading = false; controls(); } }
  }
  find('template-select').onchange = () => { templateId = find('template-select').value === '__none' ? '' : find('template-select').value; pendingStart = null; syncTemplateSelection(); controls(); };
  loadTemplateCatalog();
  loadModelCatalog();
  rangeLabel(); controls();
  while (host.firstChild) previous.append(host.firstChild);
  if (embedded) host.classList.add('has-writing-assistant');
  host.append(dialog); enhanceSearchableSelects(dialog);
  setWritingMode(writingMode, false);
  window.addEventListener('resize', resizeOriginal);
  find('settings-panel').querySelector('.searchable-combobox-input').addEventListener('input', () => { if (!find('template-select').value) { templateId = ''; pendingStart = null; if (find('operation').value === 'generate') find('start').disabled = true; updateSettingsSummary(); } });
  if (!embedded) document.body.classList.add('immersive-writing');
  document.title = `${options.outline || '当前文档'} · AI 辅助写作`;
  if (!embedded) scrollOwner.scrollTop = 0;
  find('requirements').focus({ preventScroll: true });
  if (options.loadEditor) options.loadEditor().then(Vditor => {
    if (closed) return;
    writingEditor = new Vditor(find('rich-editor'), {
      cdn: `${location.origin}/knowledge-center/common/vendor/vditor`,
      mode: 'wysiwyg', lang: 'zh_CN', value: original, minHeight: 450,
      cache: { enable: false }, toolbar: ['headings', 'bold', 'italic', '|', 'list', 'ordered-list', 'check', '|', 'link', 'table', '|', 'undo', 'redo'],
      input: value => editOriginal(value),
      after: () => { if (!closed) { writingEditorReady = true; if (writingEditor.getValue() !== original) writingEditor.setValue(original); controls(); } },
    });
    }).catch(() => { if (!closed) { setWritingMode('markdown'); status('富文本编辑器暂不可用，可继续使用 Markdown 正文。'); } });
  else setWritingMode('markdown');
  loadHandbookAISkills(context).then(result => {
    if (closed) return;
    skillCatalog = result.items; renderSkills();
  }).catch(error => { if (!closed) find('skill-info').textContent = `能力读取失败：${error.message}`; });
  loadHandbookAISources(context).then(result => {
    if (closed) return;
    sourceCatalog = result;
    collapsedReferenceCount = result.referenceListCollapsedCount || collapsedReferenceCount; syncReferenceCollapse();
    if (result.upload?.extensions) find('source-file').accept = result.upload.extensions.map(extension => '.' + extension).join(',');
    const automatic = result.items.find(item => item.sourceType === 'knowledge-mcp');
    mcpStatus(automatic?.available ? '知识库（MCP）默认引用；生成时按预设策略自动检索并记录命中。' : '知识库（MCP）默认参与检索；当前尚未配置可用服务，生成时会明确记录未配置。');
    for (const item of result.items) {
      let option = [...find('source-type').options].find(entry => entry.value === item.sourceType);
      if (!option) { option = document.createElement('option'); option.value = item.sourceType; find('source-type').append(option); }
      option.textContent = `${item.name}${item.available ? '' : '（未配置）'}`;
    }
    sourceHint();
  }).catch(error => { if (!closed) sourceStatus(`来源配置读取失败：${error.message}`, true); });
  return dialog;
}
