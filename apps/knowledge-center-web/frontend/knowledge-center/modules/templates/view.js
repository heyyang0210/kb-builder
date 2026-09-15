import { escapeHtml } from '../../common/utils/dom.js';
import { canPerform } from '../../common/state/auth-state.js';
import { Marked } from '../../common/vendor/marked.esm.js';

// 模板预览不执行上传的 HTML，不加载远程图片；只开放安全链接协议。
const markdown = new Marked({ gfm: true, renderer: {
  html({ text }) { return escapeHtml(text); },
  link({ href, tokens }) { const text = this.parser.parseInline(tokens); return /^(?:https?:|mailto:|#)/i.test(href) ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank">${text}</a>` : text; },
  image({ text }) { return `<span class="muted">[图片：${escapeHtml(text)}]</span>`; },
} });
const previewCache = new Map();
function renderMarkdown(content) {
  const value = String(content || '');
  if (!value) return '<p class="muted">暂无正文，请进入 Markdown 编辑或上传文档。</p>';
  if (previewCache.has(value)) return previewCache.get(value);
  const html = markdown.parse(value);
  // 有界缓存避免长时间编辑造成内存无限增长。
  if (previewCache.size >= 40) previewCache.delete(previewCache.keys().next().value);
  previewCache.set(value, html);
  return html;
}
const statusName = status => ({ active: '启用', disabled: '已停用', deleted: '已删除' }[status] || status || '草稿');
const sourceName = source => ({ markdown: '在线编辑', upload: '上传文档', migration: '初始化导入', 'restore-draft': '恢复历史' }[source] || source || '未知');
const date = value => value ? new Date(value).toLocaleString('zh-CN') : '未保存';
const option = (value, label, selected) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;

export function renderTemplateResults({ templateProjection = {}, templateUi = {} }) {
  const data = templateProjection || {}; const ui = templateUi;
  const selected = data.selected; const isNew = ui.draftKey === 'new';
  const items = (data.items || []).filter(item => (!ui.search || `${item.name} ${item.description || ''}`.toLowerCase().includes(ui.search.toLowerCase())) && (!ui.type || item.type === ui.type) && (!ui.status || item.status === ui.status));
  return `<p class="muted">${items.length} 个模板</p>${items.map(item => `<button class="template-list-item ${selected?.id === item.id && !isNew ? 'active' : ''}" aria-current="${selected?.id === item.id ? 'true' : 'false'}" type="button" data-template-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.type)} · v${item.currentVersion} · ${statusName(item.status)}</small></button>`).join('') || `<p class="muted">${data.loading ? '正在加载模板…' : '没有符合条件的模板'}</p>`}`;
}

export function renderTemplates({ templateProjection = {}, templateUi = {} }) {
  const data = templateProjection || {}; const ui = templateUi;
  const editable = canPerform('template:edit'); const manageable = canPerform('template:manage');
  const selected = data.selected; const draft = ui.drafts?.[ui.draftKey]; const historical = ui.historyVersion;
  const display = draft || selected; const isNew = ui.draftKey === 'new';
  const content = historical?.content ?? draft?.content ?? selected?.current?.content ?? '';
  const mode = historical ? 'preview' : (ui.mode || 'preview');
  const types = [...new Set((data.items || []).map(item => item.type))].sort();
  const editing = mode === 'edit' && editable && !historical;
  return `<div class="page-intro template-page-head"><div><h2>模板管理</h2><p class="muted">维护模板内容，历史版本随保存自动保留。</p></div>${editable ? `<div class="template-create"><button class="button" type="button" data-template-new aria-expanded="${Boolean(ui.createOpen)}">新建模板</button><input type="file" data-template-file accept=".md,.markdown" multiple hidden>${ui.createOpen ? '<div class="template-create-menu"><button type="button" data-template-create-blank><strong>空白创建</strong><small>从空白 Markdown 开始</small></button><button type="button" data-template-create-upload><strong>上传 Markdown</strong><small>支持拖拽或一次多选</small></button><div class="template-dropzone" data-template-dropzone tabindex="0" role="button">拖入 .md 文件，或点击选择文件</div></div>' : ''}</div>` : ''}</div>
    <div class="template-message" data-template-status role="${ui.error || data.error ? 'alert' : 'status'}" tabindex="-1">${escapeHtml(ui.error || data.error || ui.notice || '')}</div>
    ${Object.keys(ui.drafts || {}).filter(key => key.startsWith('upload:')).length ? `<div class="template-draft-list" aria-label="待确认上传草稿">待确认草稿：${Object.entries(ui.drafts).filter(([key]) => key.startsWith('upload:')).map(([key, item]) => `<button type="button" data-template-draft="${escapeHtml(key)}">${escapeHtml(item.sourceFilename || item.name)}</button>`).join('')}</div>` : ''}
    <div class="template-workspace ${ui.listCollapsed || ui.focusMode ? 'template-list-collapsed' : ''} ${ui.focusMode ? 'template-focus-mode' : ''}" data-template-workspace style="--template-list-width:${Number(ui.listWidth) || 280}px" aria-busy="${Boolean(ui.busy)}"><aside class="template-list" aria-label="模板列表"><div class="template-list-head"><strong>模板目录</strong><button class="icon-button" data-template-list-toggle aria-label="${ui.listCollapsed || ui.focusMode ? '展开模板目录' : '折叠模板目录'}" title="${ui.listCollapsed || ui.focusMode ? '展开模板目录' : '折叠模板目录'}">${ui.listCollapsed || ui.focusMode ? '›' : '‹'}</button></div><div class="template-list-content">
      <label>搜索<input data-template-search value="${escapeHtml(ui.search || '')}" placeholder="模板名称或描述"></label>
      <div class="template-filters"><label>类型<select data-template-filter="type">${option('', '全部类型', ui.type)}${types.map(type => option(type, type, ui.type)).join('')}</select></label><label>状态<select data-template-filter="status">${option('active', '启用', ui.status)}${option('', '全部状态', ui.status)}${option('disabled', '已停用', ui.status)}</select></label></div>
      <div data-template-results>${renderTemplateResults({ templateProjection, templateUi })}</div></div><div class="template-list-resizer" data-template-list-resizer role="separator" tabindex="0" aria-orientation="vertical" aria-label="调整模板目录宽度" aria-valuemin="240" aria-valuemax="420" aria-valuenow="${Number(ui.listWidth) || 280}"></div>
    </aside><section class="template-editor" aria-label="模板内容"><header><div><h3>${escapeHtml(display?.name || '选择模板')}</h3><p class="muted">${display ? `${escapeHtml(display.type || '')} · ${statusName(selected && !isNew ? selected.status : '')} · ${selected && !isNew ? `v${selected.currentVersion} · ${date(selected.updatedAt)}` : '保存后创建首个版本'}${display.description ? `<span class="template-description-inline">${escapeHtml(display.description)}</span>` : ''}` : '从左侧选择模板，或新建模板。'}</p></div><div class="template-head-actions">${display && !editing ? `<button class="icon-button" type="button" data-template-focus aria-pressed="${Boolean(ui.focusMode)}" aria-label="${ui.focusMode ? '退出聚焦阅读' : '聚焦阅读'}" title="${ui.focusMode ? '退出聚焦阅读' : '聚焦阅读'}">${ui.focusMode ? '⊣' : '⛶'}</button>` : ''}${editable && selected && !isNew && !historical && !editing ? '<button class="button secondary" data-template-edit>编辑模板</button>' : ''}${selected && !isNew ? `<button class="icon-button" type="button" data-template-history aria-expanded="${Boolean(ui.historyOpen)}" aria-controls="template-history-panel" aria-label="查看历史版本" title="历史版本"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/></svg></button>` : ''}</div></header>
      ${display ? `${historical ? `<div class="template-history-banner">正在只读查看历史版本 v${historical.version}<button class="button secondary" data-template-current>返回当前内容</button></div>` : ''}
        ${editing ? `<div class="template-edit-bar"><span>${draft?.dirty ? '正在编辑 · 有未保存修改' : '正在编辑'}</span><div><button class="button secondary" data-template-cancel>取消</button><button class="button" data-template-save ${ui.busy ? 'disabled' : ''}>${ui.busy ? '处理中…' : '保存'}</button></div></div><div class="template-metadata"><label>模板名称<input data-template-field="name" value="${escapeHtml(draft?.name ?? selected?.name ?? '')}" required></label><label>类型<input data-template-field="type" value="${escapeHtml(draft?.type ?? selected?.type ?? '')}" required></label><label class="template-description">描述<input data-template-field="description" value="${escapeHtml(draft?.description ?? selected?.description ?? '')}" required></label></div><label class="template-content-label">Markdown 正文<textarea data-template-content spellcheck="false">${escapeHtml(content)}</textarea></label>` : `<div class="template-reading-surface"><div class="template-preview-scroll"><article class="template-preview" aria-label="模板预览">${renderMarkdown(content)}</article></div></div>`}
        ${!editing && manageable && selected && !isNew && !historical ? `<footer class="template-actions"><span class="muted">${selected.current?.validationStatus === 'passed' ? '校验通过' : '待校验'}</span><button class="button tertiary" data-template-toggle>${selected.status === 'active' ? '停用模板' : '恢复启用'}</button></footer>` : ''}` : ''}
    </section>${ui.historyOpen && selected ? `<aside id="template-history-panel" class="template-history" aria-label="历史版本"><header><h3>历史版本</h3><button class="icon-button" data-template-history-close aria-label="关闭历史版本">×</button></header><p class="muted">查看历史不会覆盖当前草稿。</p>${(ui.versions || selected.versions || []).slice().reverse().map(version => `<section class="template-version"><button class="button secondary" data-template-version="${version.version}" aria-pressed="${historical?.version === version.version}">查看 v${version.version}</button><p>${escapeHtml(version.createdBy || '未知作者')} · ${date(version.createdAt)}</p><p>${sourceName(version.sourceType)} · ${version.validationStatus === 'passed' ? '校验通过' : '待校验'}</p><p>${escapeHtml(version.changeSummary || '未填写变更摘要')}</p>${editable ? `<button class="button secondary" data-template-restore="${version.version}" ${ui.busy ? 'disabled' : ''}>载入为当前草稿</button>` : ''}</section>`).join('')}</aside>` : ''}</div>`;
}
