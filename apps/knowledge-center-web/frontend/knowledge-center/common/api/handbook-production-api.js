const base = '/knowledge-center/api/production/handbooks';

function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function request(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json', ...options.headers }, ...options });
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;
  if (response.status === 401) window.dispatchEvent(new CustomEvent('knowledge-center:session-expired'));
  // Source allowlists restrict the requested resource, not the author's account role.
  const sourceScopeDenied = ['AI_SOURCE_SCOPE_DENIED', 'AI_SOURCE_URL_DENIED'].includes(payload?.error?.code);
  if (response.status === 403 && !sourceScopeDenied) window.dispatchEvent(new CustomEvent('knowledge-center:permission-denied'));
  if (!isJson || payload === null) {
    throw Object.assign(new Error('共享草稿服务暂不可用，请稍后重试'), {
      status: response.status,
      code: 'DRAFT_API_UNAVAILABLE',
      details: { contentType },
    });
  }
  if (!response.ok || payload?.success === false) {
    const detail = payload?.error || {};
    throw Object.assign(new Error(detail.message || `操作失败（HTTP ${response.status}）`), { status: response.status, code: detail.code, details: detail.details, requestId: response.headers.get('x-request-id') || detail.details?.requestId });
  }
  return payload?.data ?? payload;
}

function documentPath(context, suffix = '') {
  return `${base}/${encodeURIComponent(context.handbookId)}/documents/${encodeURIComponent(context.documentId)}/draft${suffix}`;
}

function query(context) {
  return new URLSearchParams({ outlineVersionId: context.outlineVersionId, branch: context.branch }).toString();
}

export const loadHandbookDraft = context => request(`${documentPath(context)}?${query(context)}`);

function aiPath(context, suffix = '') {
  return `${base}/${encodeURIComponent(context.handbookId)}/documents/${encodeURIComponent(context.documentId)}/ai-jobs${suffix}`;
}

export const startHandbookAI = (context, body, key = idempotencyKey()) => request(aiPath(context), {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
  body: JSON.stringify({ ...body, outlineVersionId: context.outlineVersionId, branch: context.branch }),
});
export const loadHandbookAI = (context, jobId) => request(`${aiPath(context, `/${encodeURIComponent(jobId)}`)}?${query(context)}`);
export const loadHandbookAISkills = context => request(`${aiPath(context).replace(/ai-jobs$/, 'ai-skills')}?${query(context)}`);
const sourcePath = context => aiPath(context).replace(/ai-jobs$/, 'ai-sources');
export const loadHandbookAISources = context => request(`${sourcePath(context)}?${query(context)}`);
export const previewHandbookAISource = (context, body) => request(sourcePath(context), {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...body, outlineVersionId: context.outlineVersionId, branch: context.branch }),
});
export const uploadHandbookAISource = (context, file, onProgress) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${sourcePath(context)}/uploads?${query(context)}`);
  xhr.responseType = 'json'; xhr.setRequestHeader('Accept', 'application/json');
  xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
  xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
  xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress?.(Math.round(event.loaded * 100 / event.total)); };
  xhr.onload = () => {
    const payload = xhr.response;
    if (xhr.status >= 200 && xhr.status < 300 && payload?.success !== false) resolve(payload?.data ?? payload);
    else reject(Object.assign(new Error(payload?.error?.message || `上传失败（HTTP ${xhr.status}）`), { status: xhr.status, code: payload?.error?.code, requestId: xhr.getResponseHeader('x-request-id') }));
  };
  xhr.onerror = () => reject(Object.assign(new Error('本地文档上传失败，请检查网络后重试'), { code: 'AI_SOURCE_UPLOAD_FAILED' }));
  xhr.send(file);
});
export const actHandbookAI = (context, jobId, action, body = {}) => request(aiPath(context, `/${encodeURIComponent(jobId)}/${action}`), {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(action === 'retry' ? { 'Idempotency-Key': body.idempotencyKey || idempotencyKey() } : {}) },
  body: JSON.stringify({ ...body, outlineVersionId: context.outlineVersionId, branch: context.branch }),
});
export const runHandbookQuality = (context, body) => request(`${aiPath(context).replace(/ai-jobs$/, 'quality')}`, { method: 'POST', headers: { 'Idempotency-Key': body.idempotencyKey || idempotencyKey(), 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, outlineVersionId: context.outlineVersionId, branch: context.branch }) });
export const loadHandbookQuality = (context, reportId) => request(`${aiPath(context).replace(/ai-jobs$/, `quality/${encodeURIComponent(reportId)}`)}?${query(context)}`);

export const saveHandbookDraft = (context, body) => request(documentPath(context), {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey() },
  body: JSON.stringify({ ...body, outlineVersionId: context.outlineVersionId, branch: context.branch }),
});

export const loadHandbookDraftRevisions = context => request(`${documentPath(context, '/revisions')}?${query(context)}`);

export const restoreHandbookDraftRevision = (context, body) => request(documentPath(context, '/restore'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey() },
  body: JSON.stringify({ ...body, outlineVersionId: context.outlineVersionId, branch: context.branch }),
});

export const uploadHandbookDraftAttachment = (context, file, onProgress) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${base}/${encodeURIComponent(context.handbookId)}/documents/${encodeURIComponent(context.documentId)}/draft-attachments?${query(context)}`);
  xhr.responseType = 'json';
  xhr.setRequestHeader('Accept', 'application/json');
  xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
  xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
  xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress?.(Math.round(event.loaded * 100 / event.total)); };
  xhr.onload = () => {
    const payload = xhr.response;
    if (xhr.status >= 200 && xhr.status < 300 && payload?.success !== false) resolve(payload?.data ?? payload);
    else reject(Object.assign(new Error(payload?.error?.message || `上传失败（HTTP ${xhr.status}）`), { status: xhr.status, code: payload?.error?.code, details: payload?.error?.details }));
  };
  xhr.onerror = () => reject(Object.assign(new Error('附件上传失败，请检查网络后重试'), { code: 'ATTACHMENT_UPLOAD_FAILED' }));
  xhr.send(file);
});

export const loadHandbookReviewers = handbookId => request(`${base}/${encodeURIComponent(handbookId)}/reviewers`);
export const loadHandbookReviewDrafts = handbookId => request(`${base}/${encodeURIComponent(handbookId)}/review-drafts`);

export const createHandbookIncrementalReview = (handbookId, body) => request(`${base}/${encodeURIComponent(handbookId)}/incremental-reviews`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey() },
  body: JSON.stringify(body),
});

export const loadProductionModels = () => request('/knowledge-center/api/production/models');
