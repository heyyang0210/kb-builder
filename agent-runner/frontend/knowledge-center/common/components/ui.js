import { escapeHtml, icon } from '../utils/dom.js';

export const panel = (title, body, meta = '') => `<section class="panel"><div class="panel-heading"><h2>${title}</h2>${meta}</div>${body}</section>`;

export function section(projection, name) {
  return projection?.sections?.[name]?.status === 'ok' ? projection.sections[name].data : null;
}

export function formattedTime(projection) {
  return projection?.asOf
    ? new Date(projection.asOf).toLocaleString('zh-CN', { hour12: false })
    : '等待数据';
}

export const dataNote = projection => `<span class="data-note">更新于 ${formattedTime(projection)}</span>`;

export function pendingState(title = '功能准备中', description = '该功能尚未开放，当前不会展示示例数据。') {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></div>`;
}

// Semantic alias used by task-oriented modules; both render the same shared empty state.
export const emptyState = pendingState;

export function capabilityState(title, description, action, view) {
  const button = action ? `<button class="button tertiary" data-action="${view}">${escapeHtml(action)}</button>` : '';
  return `<div class="capability-state"><span class="icon-wrap">${icon('blocks')}</span><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></div>${button}</div>`;
}
