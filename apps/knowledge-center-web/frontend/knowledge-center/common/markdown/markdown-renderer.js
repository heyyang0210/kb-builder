import { enhanceDatabaseMarkdown } from './database-enhancer.js';
import { marked } from '../vendor/marked.esm.js';

marked.setOptions({ gfm: true, breaks: true, headerIds: true, mangle: false });

function normalizeCodeBlocks(html) {
  return String(html).replace(/<pre>\s*<code(?:\s+class="language-([^"]*)")?>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_match, language = '', body) => {
    const normalizedLanguage = String(language || '').trim();
    const attributes = normalizedLanguage ? ` data-language="${normalizedLanguage}"` : '';
    const className = `language-${normalizedLanguage || 'text'}`;
    return `<pre class="repository-code"${attributes}><code class="${className}">${body}</code></pre>`;
  });
}

function markdownBase(renderMarkdown, markdown, filePath, context) {
  // The existing renderer owns repository-relative links, GitLab images and
  // the strict anchor whitelist. Marked supplies the VS Code-like GFM block
  // grammar; on any parser failure we retain the safe legacy renderer.
  try {
    const html = normalizeCodeBlocks(marked.parse(String(markdown ?? '')));
    const safe = html
      .replace(/<(script|style|iframe|object|embed|form)\b[\s\S]*?<\/\1>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s(?:href|src)\s*=\s*["']\s*(?:javascript|vbscript|data):[^"']*["']/gi, '')
      .replace(/(href|src)="((?!https?:\/\/|\/|#|mailto:)[^"]+)"/gi, (_match, attr, target) => {
        const parts = String(filePath || '').split('/'); parts.pop();
        for (const part of target.split('/')) { if (!part || part === '.') continue; if (part === '..') parts.pop(); else parts.push(part); }
        const resolved = parts.join('/');
        if (attr.toLowerCase() === 'src' && context.handbookId) return `src="/knowledge-center/api/gitlab/handbooks/${encodeURIComponent(context.handbookId)}/file?ref=${encodeURIComponent(context.branch || '')}&language=${encodeURIComponent(context.language || 'zh')}&path=${encodeURIComponent(resolved)}&raw=1"`;
        if (attr.toLowerCase() === 'href' && context.handbookId) return `href="/knowledge-center/assets/${encodeURIComponent(context.handbookId)}/repository?branch=${encodeURIComponent(context.branch || '')}&lang=${encodeURIComponent(context.language || 'zh')}&path=${encodeURIComponent(resolved)}"`;
        return `${attr}="${resolved}"`;
      });
    return `<article class="repository-markdown" data-source-path="${String(filePath ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">${safe}</article>`;
  } catch (_) {
    return renderMarkdown(markdown, filePath, context);
  }
}

export function renderDatabaseMarkdown(renderMarkdown, markdown, filePath, context = {}) {
  const base = markdownBase(renderMarkdown, markdown, filePath, context);
  const enhanced = enhanceDatabaseMarkdown(base);
  return enhanced;
}
