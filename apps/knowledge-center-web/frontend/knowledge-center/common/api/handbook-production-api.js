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
  if (response.status === 403) window.dispatchEvent(new CustomEvent('knowledge-center:permission-denied'));
  if (!isJson || payload === null) {
    throw Object.assign(new Error('共享草稿服务暂不可用，请稍后重试'), {
      status: response.status,
      code: 'DRAFT_API_UNAVAILABLE',
      details: { contentType },
    });
  }
  if (!response.ok || payload?.success === false) {
    const detail = payload?.error || {};
    throw Object.assign(new Error(detail.message || `操作失败（HTTP ${response.status}）`), { status: response.status, code: detail.code, details: detail.details });
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
