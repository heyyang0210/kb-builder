// HTTP 内网环境可能没有 randomUUID；该标识仅用于幂等和草稿定位，不作认证凭据。
export function taskOperationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) return `task-${Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16).padStart(8, '0')).join('')}`;
  return `task-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
const base = '/knowledge-center/api/document-tasks';
export async function taskRequest(suffix = '', options = {}) {
  let response;
  try { response = await fetch(base + suffix, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(30000), ...options }); }
  catch (error) { if (['TimeoutError', 'AbortError'].includes(error.name)) throw new Error('任务读取或提交超过30秒，请刷新后核对结果再重试'); throw error; }
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) throw Object.assign(new Error(body?.error?.message || `任务服务异常（HTTP ${response.status}）`), { status: response.status, code: body?.error?.code });
  return body.data;
}
export const taskWrite = (suffix, body, method = 'PUT') => taskRequest(suffix, { method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': taskOperationId() }, body: JSON.stringify(body) });
export const loadDocumentTasks = (params = {}) => taskRequest(`?${new URLSearchParams(params)}`);
export const loadDocumentTask = id => taskRequest(`/${encodeURIComponent(id)}`);
export const saveDocumentTaskScope = (id, body) => taskWrite(`/${encodeURIComponent(id)}/decomposition`, body);
export const saveDocumentTaskOwner = (id, body) => taskWrite(`/${encodeURIComponent(id)}/owner`, body);
export const loadDocumentTaskConfig = () => taskRequest('/config');
export const saveDocumentTaskConfig = body => taskWrite('/config', body);
export const importDocumentTasks = (file, preview = true, digest) => {
  const form = new FormData(); form.append('file', file); if (digest) form.append('digest', digest);
  return taskRequest(`/import?preview=${preview}`, { method: 'POST', headers: { 'Idempotency-Key': taskOperationId() }, body: form });
};
