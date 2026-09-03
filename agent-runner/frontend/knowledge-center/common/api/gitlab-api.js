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

export const loadGitLabConnections = () => request(endpoint);
export const loadGitLabOAuthStatus = () => request('/knowledge-center/api/gitlab/oauth/status');
export const loadGitLabOAuthConfig = () => request('/knowledge-center/api/gitlab/oauth/config');
export const disconnectGitLabOAuth = () => request('/knowledge-center/api/gitlab/oauth/disconnect', { method: 'POST', headers: { Accept: 'application/json', 'Idempotency-Key': idempotencyKey('gitlab-oauth-disconnect') } });
export const saveGitLabConnection = value => request(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Idempotency-Key': idempotencyKey('gitlab-connection') }, body: JSON.stringify(value) });
export const loadGitLabBranches = id => request(`${endpoint}/${encodeURIComponent(id)}/branches`);
export const loadGitLabTree = (id, ref, path = '') => request(`${endpoint}/${encodeURIComponent(id)}/tree?ref=${encodeURIComponent(ref)}&path=${encodeURIComponent(path)}`);
export const loadGitLabFile = (id, ref, path) => request(`${endpoint}/${encodeURIComponent(id)}/file?ref=${encodeURIComponent(ref)}&path=${encodeURIComponent(path)}`);
export const loadHandbookRepository = handbookId => request(`${handbookEndpoint}/${encodeURIComponent(handbookId)}/branches`);
export const loadHandbookRepositoryStatistics = (handbookId, branch, language = 'zh') => request(`${handbookEndpoint}/${encodeURIComponent(handbookId)}/statistics?ref=${encodeURIComponent(branch)}&language=${encodeURIComponent(language)}`);
export const loadHandbookRepositoryTree = (handbookId, branch, language, path = '') => request(`${handbookEndpoint}/${encodeURIComponent(handbookId)}/tree?ref=${encodeURIComponent(branch)}&language=${encodeURIComponent(language)}&path=${encodeURIComponent(path)}`);
export const loadHandbookRepositoryFile = (handbookId, branch, language, path) => request(`${handbookEndpoint}/${encodeURIComponent(handbookId)}/file?ref=${encodeURIComponent(branch)}&language=${encodeURIComponent(language)}&path=${encodeURIComponent(path)}`);
export const loadHandbookRepositoryMapping = handbookId => request(`/knowledge-center/api/gitlab/mappings/${encodeURIComponent(handbookId)}`);
export const saveHandbookRepositoryMapping = (handbookId, value) => request(`/knowledge-center/api/gitlab/mappings/${encodeURIComponent(handbookId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Idempotency-Key': idempotencyKey('gitlab-mapping') }, body: JSON.stringify(value) });
