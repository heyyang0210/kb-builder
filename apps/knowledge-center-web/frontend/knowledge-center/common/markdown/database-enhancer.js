import rules from './rules/yashandb.json' with { type: 'json' };

const categories = Object.entries(rules.categories).flatMap(([contentType, entries]) => entries.map(entry => ({ ...entry, contentType })));
const esc = value => String(value ?? '').replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

function markText(text, line) {
  // `safeMarkdown` has already escaped user content; avoid double escaping it.
  let value = String(text ?? '');
  const hits = [];
  for (const rule of categories) {
    const regex = new RegExp(rule.pattern, 'gi');
    value = value.replace(regex, match => {
      const index = hits.length;
      hits.push({ id: rule.id, label: rule.label, contentType: rule.contentType, line });
      return `<mark class="db-semantic-token ${rule.className}" data-db-type="${rule.contentType}" data-db-rule-id="${rule.id}" data-db-line="${line}" title="${esc(rule.label)} · 规则识别，未验证">${esc(match)}</mark>`;
    });
  }
  return { value, hits };
}

function enhanceRenderedHtml(html) {
  const hits = [];
  let line = 1;
  const rendered = String(html).replace(/<(p|td|th|li)([^>]*)>([\s\S]*?)<\/\1>/gi, (whole, tag, attrs, body) => {
    if (body.includes('<mark ') || body.includes('<code')) { line += body.split('\n').length - 1; return whole; }
    // Only annotate plain text blocks. Preserving nested links/emphasis here is
    // important: semantic highlighting must never rewrite Markdown structure.
    if (/<(?:a|code|strong|em|img|span)\b/i.test(body)) { line += body.split('\n').length - 1; return whole; }
    const result = markText(body, line);
    hits.push(...result.hits); line += body.split('\n').length - 1;
    return `<${tag}${attrs}>${result.value}</${tag}>`;
  }).replace(/<pre class="repository-code"([^>]*)><code class="language-([^\"]*)">([\s\S]*?)<\/code><\/pre>/gi, (whole, attrs, language, body) => {
    const rows = body.split('\n').length;
    return `<div class="db-code-block" data-db-code-language="${esc(language)}" data-db-code-lines="${rows}"><div class="db-code-toolbar"><span>${esc(language || 'text')}</span><button type="button" data-db-copy-code>复制</button></div>${whole}</div>`;
  });
  return { html: rendered, hits };
}

export function enhanceDatabaseMarkdown(html) { return enhanceRenderedHtml(html); }
