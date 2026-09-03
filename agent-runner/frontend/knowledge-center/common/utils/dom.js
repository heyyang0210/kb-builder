export const byId = id => document.getElementById(id);

export const escapeHtml = value => String(value ?? '').replace(
  /[&<>"']/g,
  character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
);

export const icon = name => `<i class="icon" data-lucide="${name}" aria-hidden="true"></i>`;
