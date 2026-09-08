const endpoint = '/knowledge-center/api/gitlab/connections';
const handbookEndpoint = '/knowledge-center/api/gitlab/handbooks';

function idempotencyKey(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

async function request(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const error = new Error(body?.error?.message || `GitLab 请求失败（HTTP ${response.status}）`);
    error.code = body?.error?.code;
    error.status = response.status;
    throw error;
  }
  return body.data;
}

export const loadGitLabConnections = (params = new URLSearchParams()) => {
  const query = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
  return request(`${endpoint}${query ? `?${query}` : ''}`);
};
export const loadGitLabOAuthStatus = () => request('/knowledge-center/api/gitlab/oauth/status');
export const loadGitLabOAuthConfig = () => request('/knowledge-center/api/gitlab/oauth/config');
export const disconnectGitLabOAuth = () => request('/knowledge-center/api/gitlab/oauth/disconnect', { method: 'POST', headers: { Accept: 'application/json', 'Idempotency-Key': idempotencyKey('gitlab-oauth-disconnect') } });
export const loadHandbookGitLabAccess = handbookId => request(`${handbookEndpoint}/${encodeURIComponent(handbookId)}/access-status`);
export const handbookGitLabOAuthHref = (handbookId, returnTo) => `${handbookEndpoint}/${encodeURIComponent(handbookId)}/oauth/start?returnTo=${encodeURIComponent(returnTo)}`;
export const saveGitLabConnection = value => request(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Idempotency-Key': idempotencyKey('gitlab-connection') }, body: JSON.stringify(value) });
export const verifyGitLabConnection = id => request(`${endpoint}/${encodeURIComponent(id)}/verify`, { method: 'POST', headers: { Accept: 'application/json', 'Idempotency-Key': idempotencyKey(`gitlab-verify-${id}`) } });
export const disableGitLabConnection = id => request(`${endpoint}/${encodeURIComponent(id)}/disable`, { method: 'POST', headers: { Accept: 'application/json', 'Idempotency-Key': idempotencyKey(`gitlab-disable-${id}`) } });
export const enableGitLabConnection = id => request(`${endpoint}/${encodeURIComponent(id)}/enable`, { method: 'POST', headers: { Accept: 'application/json', 'Idempotency-Key': idempotencyKey(`gitlab-enable-${id}`) } });
export const loadGitLabBranches = id => request(`${endpoint}/${encodeURIComponent(id)}/branches`);
export const loadGitLabTree = (id, ref, path = '') => request(`${endpoint}/${encodeURIComponent(id)}/tree?ref=${encodeURIComponent(ref)}&path=${encodeURIComponent(path)}`);
export const loadGitLabFile = (id, ref, path) => request(`${endpoint}/${encodeURIComponent(id)}/file?ref=${encodeURIComponent(ref)}&path=${encodeURIComponent(path)}`);
export const loadHandbookRepository = handbookId => request(`${handbookEndpoint}/${encodeURIComponent(handbookId)}/branches`);
export const loadHandbookRepositoryStatistics = (handbookId, branch, language = 'zh') => request(`${handbookEndpoint}/${encodeURIComponent(handbookId)}/statistics?ref=${encodeURIComponent(branch)}&language=${encodeURIComponent(language)}`);
export const loadHandbookRepositoryTree = (handbookId, branch, language, path = '') => request(`${handbookEndpoint}/${encodeURIComponent(handbookId)}/tree?ref=${encodeURIComponent(branch)}&language=${encodeURIComponent(language)}&path=${encodeURIComponent(path)}`);
export const loadHandbookRepositoryFile = (handbookId, branch, language, path) => request(`${handbookEndpoint}/${encodeURIComponent(handbookId)}/file?ref=${encodeURIComponent(branch)}&language=${encodeURIComponent(language)}&path=${encodeURIComponent(path)}`);
export const loadHandbookRepositoryCommits = (handbookId, branch) => request(`${handbookEndpoint}/${encodeURIComponent(handbookId)}/commits?ref=${encodeURIComponent(branch)}`);
export const loadHandbookRepositoryMapping = handbookId => request(`/knowledge-center/api/gitlab/mappings/${encodeURIComponent(handbookId)}`);
export const saveHandbookRepositoryMapping = (handbookId, value) => request(`/knowledge-center/api/gitlab/mappings/${encodeURIComponent(handbookId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Idempotency-Key': idempotencyKey('gitlab-mapping') }, body: JSON.stringify(value) });

/* ---- 平台管理扩展接口（设计文档 §6） ---- */

export function createGitLabConnection(value) {
  return request(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Idempotency-Key': idempotencyKey('gitlab-create'),
    },
    body: JSON.stringify(value),
  });
}

export function updateGitLabConnection(id, changes) {
  return request(`${endpoint}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Idempotency-Key': idempotencyKey(`gitlab-update-${id}`),
    },
    body: JSON.stringify(changes),
  });
}

export function loadGitLabConnectionAudit(id) {
  return request(`${endpoint}/${encodeURIComponent(id)}/audit`);
}

export function searchGitLabConnections({ q = '', status = '', page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  return loadGitLabConnections(params);
}
