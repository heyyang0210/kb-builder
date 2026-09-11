export const KNOWLEDGE_DATA_CHANGED = 'knowledge-data-changed';

export function notifyKnowledgeDataChanged(scopes, source = 'unknown') {
  const normalizedScopes = [...new Set((Array.isArray(scopes) ? scopes : [scopes]).filter(Boolean))];
  if (normalizedScopes.length === 0) throw new TypeError('数据变更事件必须声明至少一个影响范围');
  window.dispatchEvent(new CustomEvent(KNOWLEDGE_DATA_CHANGED, {
    detail: { scopes: normalizedScopes, source, occurredAt: new Date().toISOString() }
  }));
}

export function onKnowledgeDataChanged(listener) {
  const handler = event => {
    if (!Array.isArray(event.detail?.scopes) || event.detail.scopes.length === 0) return;
    listener(event.detail);
  };
  window.addEventListener(KNOWLEDGE_DATA_CHANGED, handler);
  return () => window.removeEventListener(KNOWLEDGE_DATA_CHANGED, handler);
}
