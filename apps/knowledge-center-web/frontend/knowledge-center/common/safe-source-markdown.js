import { Marked } from './vendor/marked.esm.js';
import { escapeHtml } from './utils/dom.js';

const markdown = new Marked({ gfm: true, renderer: {
  html({ text }) { return escapeHtml(text); },
  link({ href, tokens }) {
    const label = this.parser.parseInline(tokens);
    return /^(?:https?:|mailto:|#)/i.test(href)
      ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
  },
  image({ text }) { return `<span class="pingcode-image-note">[图片：${escapeHtml(text)}]</span>`; },
} });

export function renderSourceMarkdown(value) {
  return markdown.parse(String(value || '暂无详情内容'));
}

export function renderSourceRecord(title, value) {
  return `<section class="source-record-title"><h4>描述</h4><p>${escapeHtml(String(title || 'PingCode 未填写'))}</p></section>${renderSourceMarkdown(value)}`;
}
