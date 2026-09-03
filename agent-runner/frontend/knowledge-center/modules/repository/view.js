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

function inlineMarkdown(value, context) {
  const source = String(value || '');
  const token = /(!?\[[^\]]*\]\([^\s)]+(?:\s+"[^"]*")?\)|`[^`]+`|\*\*[^*]+\*\*)/g;
  let output = '', offset = 0;
  for (const match of source.matchAll(token)) {
    output += escapeHtml(source.slice(offset, match.index));
    const current = match[0];
    if (current.startsWith('`')) output += `<code>${escapeHtml(current.slice(1, -1))}</code>`;
    else if (current.startsWith('**')) output += `<strong>${escapeHtml(current.slice(2, -2))}</strong>`;
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
      } else output += escapeHtml(current);
    }
    offset = match.index + current.length;
  }
  return output + escapeHtml(source.slice(offset));
}

function safeMarkdown(markdown, filePath = '', context = {}) {
  const lines = text(markdown).replace(/\r\n?/g, '\n').split('\n');
  const renderContext = { ...context, filePath };
  let out = '', inCode = false, code = [], listOpen = false;
  const closeList = () => { if (listOpen) { out += '</ul>'; listOpen = false; } };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('```')) {
      closeList();
      if (inCode) { out += `<pre class="repository-code"><code>${escapeHtml(code.join('\n'))}</code></pre>`; code = []; }
      inCode = !inCode;
      continue;
    }
    if (inCode) { code.push(line); continue; }
    const next = lines[index + 1] || '';
    if (line.includes('|') && /^\s*\|?\s*:?-{3,}/.test(next)) {
      closeList();
      const headers = line.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|')) { rows.push(lines[index].replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())); index += 1; }
      index -= 1;
      out += `<div class="repository-table-wrap"><table><thead><tr>${headers.map(cell => `<th>${inlineMarkdown(cell, renderContext)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${headers.map((_, cellIndex) => `<td>${inlineMarkdown(row[cellIndex] || '', renderContext)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) { closeList(); const match = line.match(/^(#{1,6})\s+(.*)$/); const level = match[1].length; out += `<h${level}>${inlineMarkdown(match[2], renderContext)}</h${level}>`; continue; }
    if (/^>\s?/.test(line)) { closeList(); out += `<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ''), renderContext)}</blockquote>`; continue; }
    if (/^[-*]\s+/.test(line)) { if (!listOpen) { out += '<ul>'; listOpen = true; } out += `<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ''), renderContext)}</li>`; continue; }
    closeList();
    if (!line.trim()) continue;
    out += `<p>${inlineMarkdown(line, renderContext)}</p>`;
  }
  closeList();
  if (inCode) out += `<pre class="repository-code"><code>${escapeHtml(code.join('\n'))}</code></pre>`;
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

function message(title, detail) { return `<section class="repository-state"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail || '')}</p></section>`; }

export function renderRepository({ projection = {}, platformAdmin = false }) {
  const p = projection || {};
  if (p.status === 'loading') return message('正在读取仓库内容', '请稍候。');
  if (p.status === 'forbidden') return message('没有权限查看仓库', '请联系平台管理员确认手册映射和仓库权限。');
  if (p.status === 'unavailable') return message('仓库暂时不可用', p.error?.message || '请稍后重试。');
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
