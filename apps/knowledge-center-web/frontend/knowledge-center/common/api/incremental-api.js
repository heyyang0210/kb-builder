const endpoint = '/knowledge-center/api/incremental-tasks';

const pendingKeys = new Map();

function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function request(url, options = {}) {
  const isWrite = options.method && options.method !== 'GET';
  const commandSignature = isWrite ? `${options.method}:${url}:${options.body || ''}` : null;
  const commandKey = commandSignature ? (pendingKeys.get(commandSignature) || newIdempotencyKey()) : null;
  if (commandSignature && !pendingKeys.has(commandSignature)) pendingKeys.set(commandSignature, commandKey);
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(isWrite ? { 'Idempotency-Key': commandKey } : {}), ...options.headers },
    ...options,
  });
  const payload = await response.json().catch(() => null);
  if (response.status === 401) window.dispatchEvent(new CustomEvent('knowledge-center:session-expired'));
  if (response.status === 403) window.dispatchEvent(new CustomEvent('knowledge-center:permission-denied'));
  if (!response.ok || payload?.success === false) {
    const error = payload?.error || {};
    throw Object.assign(new Error(error.message || `操作失败（HTTP ${response.status}）`), {
      status: response.status,
      code: error.code,
      details: error.details,
    });
  }
  if (commandSignature) pendingKeys.delete(commandSignature);
  return payload?.data ?? payload;
}

function command(taskId, path, body, method = 'POST') {
  return request(`${endpoint}/${encodeURIComponent(taskId)}/${path}`, {
    method,
    body: JSON.stringify(body || {}),
  });
}

export function loadIncrementalTasks(params = new URLSearchParams()) {
  const query = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
  return request(`${endpoint}${query ? `?${query}` : ''}`);
}

export function loadIncrementalBaselines(handbookId, businessVersion = '') {
  const query = new URLSearchParams({ handbookId });
  if (businessVersion) query.set('businessVersion', businessVersion);
  return request(`${endpoint}/baselines?${query}`);
}

export const loadIncrementalTask = taskId => request(`${endpoint}/${encodeURIComponent(taskId)}`);
export const loadCandidateDiff = taskId => request(`${endpoint}/${encodeURIComponent(taskId)}/diff`);
export const loadHandbookReviewSummary = handbookId => request(`${endpoint}/handbooks/${encodeURIComponent(handbookId)}/review-summary`);
export const createIncrementalTask = body => request(endpoint, { method: 'POST', body: JSON.stringify(body) });
export const createOnlineReview = body => request(`${endpoint}/online-reviews`, { method: 'POST', body: JSON.stringify(body) });
export const bootstrapBaseline = body => request(`${endpoint}/bootstrap-baseline`, { method: 'POST', body: JSON.stringify(body) });
export const addIncrementalSource = (taskId, body) => command(taskId, 'sources', body);
export const updateIncrementalTarget = (taskId, body) => command(taskId, 'target', body, 'PATCH');
export const saveIncrementalDraft = (taskId, body) => command(taskId, 'draft', body, 'PUT');
export const runIncrementalChecks = (taskId, body = {}) => command(taskId, 'checks', body);
export const submitIncrementalCandidate = (taskId, body = {}) => command(taskId, 'candidate', body);
export const createIncrementalReview = (taskId, body = {}) => command(taskId, 'reviews', body);
export const commentIncrementalReview = (taskId, reviewId, body) => command(taskId, `reviews/${encodeURIComponent(reviewId)}/comments`, body);
export const replyIncrementalReviewComment = (taskId, reviewId, commentId, body) => command(taskId, `reviews/${encodeURIComponent(reviewId)}/comments/${encodeURIComponent(commentId)}/replies`, body);
export const resolveIncrementalReviewComment = (taskId, reviewId, commentId, body = {}) => command(taskId, `reviews/${encodeURIComponent(reviewId)}/comments/${encodeURIComponent(commentId)}/resolve`, body);
export const reopenIncrementalReviewComment = (taskId, reviewId, commentId, body = {}) => command(taskId, `reviews/${encodeURIComponent(reviewId)}/comments/${encodeURIComponent(commentId)}/reopen`, body);
export const linkIncrementalReviewCommentOperation = (taskId, reviewId, commentId, body) => command(taskId, `reviews/${encodeURIComponent(reviewId)}/comments/${encodeURIComponent(commentId)}/link-operation`, body);
export const decideIncrementalReview = (taskId, reviewId, body) => command(taskId, `reviews/${encodeURIComponent(reviewId)}/decision`, body);
export const publishIncrementalTask = (taskId, body = {}) => command(taskId, 'publish', body);
export const recordIncrementalEvidence = (taskId, body) => command(taskId, 'external-evidence', body);
export const createIncrementalRevision = (taskId, body = {}) => command(taskId, 'revisions', body);
