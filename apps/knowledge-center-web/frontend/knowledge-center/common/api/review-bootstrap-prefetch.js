import { loadReviewBootstrap } from './incremental-api.js';

const fields = ['handbookId', 'taskId', 'step', 'view', 'documentId', 'path'];
const signature = options => JSON.stringify(fields.map(key => options[key] || ''));
let pending = null;

export function startReviewBootstrapPrefetch(location = window.location) {
  if (pending || !/^\/knowledge-center\/review\/?$/.test(location.pathname)) return;
  const params = new URLSearchParams(location.search);
  if (params.has('ticket')) return;
  const handbookId = params.get('handbookId') || '';
  const taskId = params.get('taskId') || '';
  const options = {
    handbookId, taskId, step: params.get('step') || 'read',
    view: params.get('view') || (taskId || handbookId ? 'reader' : 'handbooks'),
    documentId: params.get('documentId') || '', path: params.get('path') || '',
  };
  pending = { key: signature(options), result: loadReviewBootstrap(options, { notifyAuthErrors: false }).then(data => ({ data }), () => null) };
}

export async function takeReviewBootstrapPrefetch(options) {
  const current = pending;
  pending = null;
  if (!current || current.key !== signature(options)) return null;
  return current.result;
}

startReviewBootstrapPrefetch();
