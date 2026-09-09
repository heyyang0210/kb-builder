import { escapeHtml } from '../../common/utils/dom.js';

const text = value => String(value ?? '');
function resolveRepositoryPath(filePath, target) {
  const raw = String(target || '').split('#')[0].split('?')[0];
  const parts = raw.startsWith('/') ? [] : String(filePath || '').split('/').slice(0, -1);
  for (const part of raw.replace(/^\/+/, '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop(); else parts.push(part);
  }
  return parts.join('/');
}

function safeAnchorSpan(value) {
  const match = String(value || '').match(/^<span\s+([^>]*)><\/span>$/i);
  if (!match) return '';
  const attributes = {};
  const attributePattern = /(?:^|\s+)(id|name)=("([^"]*)"|'([^']*)')/gi;
  let consumed = '';
  for (const attribute of match[1].matchAll(attributePattern)) {
    consumed += attribute[0];
    const name = attribute[1].toLowerCase();
    const attributeValue = attribute[3] ?? attribute[4] ?? '';
    if (!/^[A-Za-z][A-Za-z0-9_.:-]*$/.test(attributeValue) || attributes[name]) return '';
    attributes[name] = attributeValue;
  }
  if (consumed.trim() !== match[1].trim() || (!attributes.id && !attributes.name)) return '';
  const id = attributes.id || attributes.name;
  const name = attributes.name || attributes.id;
  return `<span id="${escapeHtml(id)}" name="${escapeHtml(name)}" class="repository-anchor" aria-hidden="true"></span>`;
}

function inlineMarkdown(value, context) {
  const source = String(value || '');
  const token = /(<span\s+[^>]*><\/span>|!?\[[^\]]*\]\([^\s)]+(?:\s+"[^"]*")?\)|`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|(?<!\*)\*[^*]+\*(?!!))/gi;
  let output = '', offset = 0;
  for (const match of source.matchAll(token)) {
    output += escapeHtml(source.slice(offset, match.index));
    const current = match[0];
    if (/^<span\s/i.test(current)) output += safeAnchorSpan(current) || escapeHtml(current);
    else if (current.startsWith('`')) output += `<code>${escapeHtml(current.slice(1, -1))}</code>`;
    else if (current.startsWith('**')) output += `<strong>${escapeHtml(current.slice(2, -2))}</strong>`;
    else if (current.startsWith('~~')) output += `<del>${escapeHtml(current.slice(2, -2))}</del>`;
    else if (current.startsWith('*')) output += `<em>${escapeHtml(current.slice(1, -1))}</em>`;
    else {
      const parsed = current.match(/^(!?)\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)$/);
      const image = parsed?.[1] === '!';
      const label = parsed?.[2] || '';
      const href = parsed?.[3] || '';
      const external = /^https?:\/\//i.test(href);
      const unsafe = /^(?:javascript|data|vbscript):/i.test(href);
      const resolved = external || unsafe || href.startsWith('#') ? href : resolveRepositoryPath(context.filePath, href);
      if (image && !unsafe && !external && /\.(?:png|jpe?g|gif|webp)$/i.test(resolved)) {
        const src = `/knowledge-center/api/gitlab/handbooks/${encodeURIComponent(context.handbookId)}/file?ref=${encodeURIComponent(context.branch)}&language=${encodeURIComponent(context.language)}&path=${encodeURIComponent(resolved)}&raw=1`;
        output += `<img src="${escapeHtml(src)}" alt="${escapeHtml(label)}" loading="lazy">`;
      } else if (!image && !unsafe) {
        const target = external || href.startsWith('#') ? href : `/knowledge-center/assets/${encodeURIComponent(context.handbookId)}/repository?branch=${encodeURIComponent(context.branch)}&lang=${encodeURIComponent(context.language)}&path=${encodeURIComponent(resolved)}`;
        output += `<a href="${escapeHtml(target)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(label)}</a>`;
      } else output += escapeHtml(image ? label : (unsafe ? label : current));
    }
    offset = match.index + current.length;
  }
  return output + escapeHtml(source.slice(offset));
}

function splitTableRow(line) {
  const value = String(line || '').trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = []; let current = ''; let escaped = false;
  for (const char of value) {
    if (char === '|' && !escaped) { cells.push(current.trim()); current = ''; continue; }
    if (char === '\\' && !escaped) { escaped = true; current += char; continue; }
    escaped = false; current += char;
  }
  cells.push(current.trim());
  return cells.map(cell => cell.replace(/\\\|/g, '|'));
}

function listItemMarkup(content, checked, context) {
  const task = /^\[([ xX])\]\s+/.exec(content);
  const body = task ? content.slice(task[0].length) : content;
  const checkbox = task ? `<input type="checkbox" disabled ${task[1].toLowerCase() === 'x' ? 'checked' : ''}> ` : '';
  return `<li${checked ? ' class="task-item"' : ''}>${checkbox}${inlineMarkdown(body, context)}</li>`;
}

function safeMarkdown(markdown, filePath = '', context = {}) {
  const lines = text(markdown).replace(/\r\n?/g, '\n').split('\n');
  const renderContext = { ...context, filePath };
  let out = '', inCode = false, code = [], codeLanguage = '', listStack = [], quote = [];
  const closeList = () => { const current = listStack.pop(); if (current) out += `</li></${current.ordered ? 'ol' : 'ul'}>`; };
  const closeLists = () => { while (listStack.length) closeList(); };
  const closeQuote = () => { if (quote.length) { out += `<blockquote>${quote.join('')}</blockquote>`; quote = []; } };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = line.match(/^\s*(```+|~~~+)\s*([^\s]*)?.*$/);
    if (fence) {
      closeQuote(); closeLists();
      if (inCode) { out += `<pre class="repository-code"${codeLanguage ? ` data-language="${escapeHtml(codeLanguage)}"` : ''}><code class="language-${escapeHtml(codeLanguage || 'text')}">${escapeHtml(code.join('\n'))}</code></pre>`; code = []; codeLanguage = ''; }
      else codeLanguage = fence[2] || '';
      inCode = !inCode;
      continue;
    }
    if (inCode) { code.push(line); continue; }
    const next = lines[index + 1] || '';
    if (line.includes('|') && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(next)) {
      closeQuote(); closeLists();
      const headers = splitTableRow(line);
      const alignments = splitTableRow(next).map(cell => cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : cell.startsWith(':') ? 'left' : '');
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) { rows.push(splitTableRow(lines[index])); index += 1; }
      index -= 1;
      out += `<div class="repository-table-wrap"><table><thead><tr>${headers.map((cell, i) => `<th${alignments[i] ? ` style="text-align:${alignments[i]}"` : ''}>${inlineMarkdown(cell, renderContext)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${headers.map((_, cellIndex) => `<td${alignments[cellIndex] ? ` style="text-align:${alignments[cellIndex]}"` : ''}>${inlineMarkdown(row[cellIndex] || '', renderContext)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      continue;
    }
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) { closeQuote(); closeLists(); out += '<hr>'; continue; }
    if (/^#{1,6}\s/.test(line)) { closeQuote(); closeLists(); const match = line.match(/^(#{1,6})\s+(.*)$/); const level = match[1].length; out += `<h${level}>${inlineMarkdown(match[2].replace(/\s+#+\s*$/, ''), renderContext)}</h${level}>`; continue; }
    if (/^>\s?/.test(line)) { closeLists(); quote.push(`<p>${inlineMarkdown(line.replace(/^>\s?/, ''), renderContext)}</p>`); continue; }
    const item = line.match(/^(\s*)([-+*]|\d+[.)])\s+(.*)$/);
    if (item) {
      closeQuote(); const level = Math.floor(item[1].length / 2); const ordered = /^\d/.test(item[2]);
      while (listStack.length > level + 1) closeList();
      if (!listStack[level] || listStack[level].ordered !== ordered) { if (listStack[level]) closeList(); listStack[level] = { ordered }; out += ordered ? '<ol>' : '<ul>'; }
      else out += '</li>';
      listStack[level] = { ordered, started: true };
      out += listItemMarkup(item[3], /^\[[ xX]\]/.test(item[3]), renderContext);
      continue;
    }
    closeQuote(); closeLists();
    if (!line.trim()) continue;
    out += `<p>${inlineMarkdown(line, renderContext)}</p>`;
  }
  closeQuote(); closeLists();
  if (inCode) out += `<pre class="repository-code"${codeLanguage ? ` data-language="${escapeHtml(codeLanguage)}"` : ''}><code class="language-${escapeHtml(codeLanguage || 'text')}">${escapeHtml(code.join('\n'))}</code></pre>`;
  return `<article class="repository-markdown" data-source-path="${escapeHtml(filePath)}">${out}</article>`;
}

function tree(items, selected, prefix = '') {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return '<p class="muted">目录为空。</p>';
  return `<ul class="repository-tree">${rows.map(item => {
    const path = item.path || `${prefix}/${item.name}`.replace(/^\//, '');
    const directory = item.type === 'tree';
    return `<li class="${path === selected ? 'selected' : ''}">${directory ? `<details open><summary>${escapeHtml(item.name)}</summary>${tree(item.children || [], selected, path)}</details>` : `<button type="button" data-repository-file="${escapeHtml(path)}">${escapeHtml(item.name)}</button>`}</li>`;
  }).join('')}</ul>`;
}

function treeHierarchy(items) {
  const roots = [];
  const nodes = new Map();
  [...(Array.isArray(items) ? items : [])]
    .sort((left, right) => String(left.path || '').localeCompare(String(right.path || ''), 'zh-CN'))
    .forEach(item => nodes.set(item.path, { ...item, children: [] }));
  nodes.forEach(node => {
    const parentPath = String(node.path || '').split('/').slice(0, -1).join('/');
    const parent = nodes.get(parentPath);
    if (parent?.type === 'tree') parent.children.push(node); else roots.push(node);
  });
  const sort = values => values.sort((a, b) => (a.type === b.type ? String(a.name).localeCompare(String(b.name), 'zh-CN') : a.type === 'tree' ? -1 : 1)).map(item => ({ ...item, children: sort(item.children || []) }));
  return sort(roots);
}

function message(title, detail, action = '', control = '', role = 'status') { return `<section class="repository-state" role="${role}"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail || '')}</p>${control}${action ? `<p class="repository-error-action">${escapeHtml(action)}</p>` : ''}</section>`; }

function authorizationControl(projection) {
  const handbookId = projection.handbookId || '';
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const href = `/knowledge-center/api/gitlab/handbooks/${encodeURIComponent(handbookId)}/oauth/start?returnTo=${encodeURIComponent(returnTo)}`;
  const branch = projection.branch || '默认分支';
  const language = projection.language === 'en' ? 'English' : '中文';
  const path = projection.path || '上次阅读位置';
  return `<div class="repository-auth-action"><a class="button primary" href="${escapeHtml(href)}"><i data-lucide="git-branch" aria-hidden="true"></i><span>连接 GitLab 账号</span></a><dl><div><dt>当前手册</dt><dd>${escapeHtml(projection.handbookName || handbookId || '当前手册')}</dd></div><div><dt>返回位置</dt><dd>${escapeHtml(`${branch} / ${language} / ${path}`)}</dd></div></dl></div>`;
}

function errorState(projection) {
  const detail = projection.error?.message;
  switch (projection.status) {
    case 'unauthorized': return message('GitLab 账号尚未连接', '连接后，将按照你在 GitLab 中原有的项目权限读取当前手册，不会获得新的仓库权限。', '无法连接时，请联系平台管理员检查平台连接和手册映射。', authorizationControl(projection), 'alert');
    case 'forbidden': return message('无权限访问此仓库内容', detail || '当前 GitLab 账号没有读取该手册仓库、分支或目录的权限。', '请联系 GitLab 仓库管理员开通读取权限，或切换有权限的 GitLab 账号。', '', 'alert');
    case 'not-mapped': return message('该手册尚未配置可读内容', detail || '管理员尚未为该手册配置对应的 GitLab 仓库、语言路径或内容映射。', '请联系平台管理员完成手册仓库映射。', '', 'alert');
    case 'not-found': return message('找不到请求的仓库内容', detail || 'GitLab 项目、分支、文件或手册映射不存在，可能已被删除或调整。', '请返回知识资产确认映射和分支配置。', '', 'alert');
    case 'conflict': return message('当前仓库连接不可读取', detail || '该 GitLab 连接已停用、未启用或平台读取凭证不可用。', '请联系平台管理员检查连接配置后再试。', '', 'alert');
    default: return message('仓库服务暂时不可用', detail || 'GitLab 服务暂时不可达或返回了未知错误。', '请稍后重试；如果问题持续，请联系平台管理员。', '<button class="button secondary" type="button" data-repository-refresh>重试</button>', 'alert');
  }
}

export function renderRepository({ projection = {}, platformAdmin = false }) {
  const p = projection || {};
  if (p.status === 'loading') return message('正在读取仓库内容', '请稍候。');
  if (['unauthorized', 'forbidden', 'not-mapped', 'not-found', 'conflict', 'unavailable'].includes(p.status)) return errorState(p);
  const branches = Array.isArray(p.branches) ? p.branches : [];
  const selectedBranch = p.branch || branches[0]?.name || '';
  const content = p.file ? safeMarkdown(p.file.content, p.file.path, { handbookId: p.handbookId, branch: selectedBranch, language: p.language || 'zh' }) : '<p class="muted">请选择左侧文档。</p>';
  const handbookId = p.handbookId || '';
  const language = p.language === 'en' ? 'en' : 'zh';
  const languages = p.languages || { zh: true, en: true };
  const maintenance = platformAdmin ? `<a class="repository-maintain" href="/knowledge-center/assets?handbookId=${encodeURIComponent(handbookId)}">维护映射</a><span class="repository-admin-label">管理员专属</span>` : '';
  const meta = `${escapeHtml(p.connectionName || 'GitLab 仓库')} · ${escapeHtml(p.branch || selectedBranch)} · ${language === 'en' ? 'English' : '中文'} · 提交 ${escapeHtml(p.commitSha ? p.commitSha.slice(0, 8) : '未知')}`;
  return `<div class="repository-page"><header class="repository-header"><a class="repository-back" href="/knowledge-center/assets?handbookId=${encodeURIComponent(handbookId)}">← 返回知识资产</a><div class="repository-title-row"><div><h2>${escapeHtml(p.handbookName || '手册仓库')}</h2><p class="repository-meta">${meta}</p></div><div class="repository-admin-action">${maintenance}</div></div></header><div class="repository-toolbar"><label>选择分支<select data-repository-branch>${branches.map(branch => `<option value="${escapeHtml(branch.name)}" ${branch.name === selectedBranch ? 'selected' : ''}>${escapeHtml(branch.name)}</option>`).join('')}</select></label><div class="repository-language" role="group" aria-label="文档语言"><button type="button" data-repository-language="zh" aria-pressed="${language === 'zh'}" ${languages.zh === false ? 'disabled' : ''}>中文</button><button type="button" data-repository-language="en" aria-pressed="${language === 'en'}" ${languages.en === false ? 'disabled' : ''}>English</button></div><button class="button tertiary compact repository-refresh" type="button" data-repository-refresh>刷新内容</button></div><div class="repository-workspace"><aside class="repository-sidebar"><h3>仓库目录</h3><input type="search" placeholder="搜索文件" data-repository-search>${tree(treeHierarchy(p.tree), p.file?.path)}</aside><main class="repository-content">${content}<div class="repository-review-note"><strong>审核与发布</strong><span>正式分支内容只读，批注与修改建议将在审阅能力启用后显示。</span></div></main></div><footer class="repository-footer">来源：${escapeHtml(p.project || p.connectionName || 'GitLab 仓库')} · ${escapeHtml(p.branch || selectedBranch)} · 更新时间 ${escapeHtml(p.updatedAt ? new Date(p.updatedAt).toLocaleString('zh-CN', { hour12: false }) : '暂不可用')}</footer></div>`;
}

export { safeMarkdown, treeHierarchy };
