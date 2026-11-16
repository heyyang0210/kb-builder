const endpoint = '/knowledge-center/api/cleaning';

async function getJson(path) {
  const response = await fetch(`${endpoint}${path}`, { credentials: 'same-origin', cache: 'no-store' });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(body?.error?.message || `资料加工服务暂不可用（HTTP ${response.status}）`), { status: response.status, code: body?.error?.code });
  return body?.data ?? body;
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${endpoint}${path}`, {
    credentials: 'same-origin', cache: 'no-store', ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(body?.error?.message || `资料加工请求失败（HTTP ${response.status}）`), { status: response.status, code: body?.error?.code });
  return body?.data ?? body;
}

export function loadCleaningWorkspace(batchPage = 1, datasetPage = 1) {
  return Promise.all([
    getJson('/workbench/summary'),
    getJson(`/material-batches?page=${Math.max(1, Number(batchPage) || 1)}&pageSize=20`),
    getJson(`/datasets?page=${Math.max(1, Number(datasetPage) || 1)}&pageSize=20`),
    getJson('/index/stats').catch(error => ({ status: 'unavailable', error: { code: error.code, message: error.message } })),
  ]).then(([workbench, batches, datasets, indexStats]) => ({ workbench, batches, datasets, indexStats }));
}

export const loadCleaningBatches = (page = 1) => getJson(`/material-batches?page=${Math.max(1, Number(page) || 1)}&pageSize=20`);
export const loadCleaningDatasets = (page = 1) => getJson(`/datasets?page=${Math.max(1, Number(page) || 1)}&pageSize=20`);
export const loadCleaningBatchDetail = (batchId, filePage = 1) => {
  const id = encodeURIComponent(batchId);
  const page = Math.max(1, Number(filePage) || 1);
  return Promise.all([
    getJson(`/material-batches/${id}`),
    getJson(`/material-batches/${id}/workbench-summary`),
    getJson(`/material-batches/${id}/files?page=${page}&pageSize=20`),
  ]).then(([batch, summary, files]) => ({ batch, summary, files }));
};
export const loadCleaningDatasetDetail = datasetId => getJson(`/datasets/${encodeURIComponent(datasetId)}`);

export const createUploadSession = body => requestJson('/upload-sessions', { method: 'POST', body: JSON.stringify(body), headers: { 'Idempotency-Key': body.idempotencyKey || crypto.randomUUID() } });
export const addUploadFile = (sessionId, body) => requestJson(`/upload-sessions/${encodeURIComponent(sessionId)}/files`, { method: 'POST', body: JSON.stringify(body) });
export const uploadChunk = (sessionId, fileId, chunkIndex, body, headers = {}) => requestJson(`/upload-sessions/${encodeURIComponent(sessionId)}/files/${encodeURIComponent(fileId)}/chunks/${chunkIndex}`, { method: 'PUT', body, headers: { ...headers, 'Content-Type': 'application/octet-stream' } });
export const completeUploadFile = (sessionId, fileId) => requestJson(`/upload-sessions/${encodeURIComponent(sessionId)}/files/${encodeURIComponent(fileId)}/complete`, { method: 'POST' });
export const completeUploadSession = sessionId => requestJson(`/upload-sessions/${encodeURIComponent(sessionId)}/complete`, { method: 'POST' });
export const createUploadBatch = (sessionId, name = '') => requestJson(`/upload-sessions/${encodeURIComponent(sessionId)}/create-batch`, { method: 'POST', body: JSON.stringify({ name: name || null }), headers: { 'Idempotency-Key': crypto.randomUUID() } });
