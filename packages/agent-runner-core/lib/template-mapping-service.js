const crypto = require('node:crypto');
const path = require('node:path');
const { createAggregateStore } = require('./aggregate-store');
const { readJson } = require('./json-config');
const { REPOSITORY_ROOT } = require('./repo-paths');

const DEFAULT_CONFIG = path.join(REPOSITORY_ROOT, 'config/knowledge-center/template-mapping.json');
const bad = (code, message, status = 400) => Object.assign(new Error(message), { code, status });
const docKey = (handbookId, documentId) => `${encodeURIComponent(handbookId)}|${encodeURIComponent(documentId)}`;
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function projectDocuments(catalog, handbookId) {
  const nodes = catalog?.directory?.nodes || catalog?.directory?.governance?.nodes || [];
  const byId = new Map(nodes.map(node => [String(node.id), node]));
  return (catalog?.documents || []).map(item => {
    let parent = byId.get(String(item.parentId)); const pathParts = []; const seen = new Set();
    while (parent && !seen.has(String(parent.id))) { seen.add(String(parent.id)); pathParts.unshift(String(parent.title || parent.name || parent.id)); parent = byId.get(String(parent.parentId)); }
    return { handbookId: String(handbookId), documentId: String(item.id), title: String(item.name), path: pathParts.join(' / '), type: String(byId.get(String(item.id))?.documentType || '') };
  });
}
function matches(rule, document) {
  const when = rule.when || {};
  if (when.handbookId && when.handbookId !== document.handbookId) return false;
  if (when.pathPrefix && !document.path.startsWith(when.pathPrefix)) return false;
  if (when.documentType && when.documentType !== document.type) return false;
  if (when.titleContains && !document.title.includes(when.titleContains)) return false;
  return true;
}
function evaluateRules(rules, document) {
  const matchesFound = rules.filter(rule => matches(rule, document)).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  if (!matchesFound.length) return { status: 'unmatched', candidates: [] };
  const first = matchesFound[0]; const top = matchesFound.filter(rule => rule.priority === first.priority);
  if (new Set(top.map(rule => rule.templateId)).size > 1) return { status: 'conflict', candidates: top.map(rule => rule.templateId), ruleIds: top.map(rule => rule.id) };
  return { status: 'rule', templateId: first.templateId, ruleIds: top.map(rule => rule.id), candidates: [first.templateId] };
}
function validateRules(rules, templateStore) {
  if (!Array.isArray(rules) || rules.length > 100 || rules.some(rule => !rule || typeof rule !== 'object')) throw bad('MAPPING_RULES_INVALID', '规则必须是数组且最多 100 条');
  const ids = new Set();
  for (const rule of rules) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(rule.id || '') || ids.has(rule.id)) throw bad('MAPPING_RULES_INVALID', '规则 ID 无效或重复');
    ids.add(rule.id);
    if (!Number.isSafeInteger(rule.priority) || rule.priority < 0 || rule.priority > 10000) throw bad('MAPPING_RULES_INVALID', '规则优先级必须是 0～10000 的整数');
    if (templateStore.get(rule.templateId)?.status !== 'active') throw bad('MAPPING_TEMPLATE_INACTIVE', '规则引用的模板不存在或已停用', 409);
    const when = rule.when;
    if (!when || typeof when !== 'object' || Array.isArray(when) || !Object.keys(when).length || Object.keys(when).some(key => !['handbookId', 'pathPrefix', 'documentType', 'titleContains'].includes(key)) || Object.values(when).some(value => typeof value !== 'string' || !value.trim() || value.length > 200)) throw bad('MAPPING_RULES_INVALID', '规则条件无效');
  }
}
function createTemplateMappingService(options = {}) {
  const store = options.store || createAggregateStore({ namespace: 'template-mappings', key: process.env.TEMPLATE_MAPPING_STORE_KEY || 'state', filePath: process.env.TEMPLATE_MAPPING_STORE_FILE || path.join(REPOSITORY_ROOT, 'runtime/agent-runner/template-mappings.json'), emptyValue: { version: 1, rules: [], batches: [], effective: {}, audits: [] } });
  const templateStore = options.templateStore;
  const config = options.config || readJson(DEFAULT_CONFIG);
  const analyzeAI = options.analyzeAI || (async () => ({ templateId: '', reason: '尚未配置模型分析' }));
  const running = new Map();
  const now = () => new Date().toISOString();
  const get = () => { const s = store.read(); return { version: s.version || 1, rules: s.rules || [], batches: s.batches || [], effective: s.effective || {} }; };
  const rules = () => { const s = get(); return { version: s.version, rules: s.rules }; };
  function previewRules(input, catalog, handbookId) {
    validateRules(input.rules, templateStore);
    const state = get();
    if (input.baseVersion !== state.version) throw bad('MAPPING_VERSION_CONFLICT', '规则已更新，请刷新后重试', 409);
    const catalogs = Array.isArray(catalog) ? catalog : [{ handbookId, catalog }];
    const documents = catalogs.flatMap(entry => projectDocuments(entry.catalog, entry.handbookId));
    const activeRules = state.rules.filter(rule => templateStore.get(rule.templateId)?.status === 'active');
    const changes = documents.map(document => {
      const before = evaluateRules(activeRules, document);
      const after = evaluateRules(input.rules, document);
      const current = state.effective[docKey(document.handbookId, document.documentId)] || null;
      return { ...document, before, after, effectiveTemplateId: current?.templateId || null };
    }).filter(row => row.before.status !== row.after.status || row.before.templateId !== row.after.templateId || JSON.stringify(row.before.candidates) !== JSON.stringify(row.after.candidates));
    const handbookVersions = catalogs.map(entry => ({ handbookId: entry.handbookId, outlineVersionId: entry.catalog.outlineVersionId || null }));
    const handbookChanges = handbookVersions.map(entry => ({ handbookId: entry.handbookId,
      total: documents.filter(document => document.handbookId === entry.handbookId).length,
      changed: changes.filter(row => row.handbookId === entry.handbookId).length,
      conflicts: changes.filter(row => row.handbookId === entry.handbookId && row.after.status === 'conflict').length }));
    const outlineVersionId = handbookVersions.find(entry => entry.handbookId === handbookId)?.outlineVersionId || null;
    const candidateDigest = digest({ baseVersion: input.baseVersion, handbookVersions, documents, rules: input.rules });
    return { handbookId, outlineVersionId, handbookVersions, handbookChanges, baseVersion: state.version, candidateDigest, total: documents.length, changed: changes.length, conflicts: changes.filter(row => row.after.status === 'conflict').length, changes };
  }
  function saveRules(input, actor) {
    validateRules(input.rules, templateStore);
    const result = store.transaction(state => {
      if (input.baseVersion !== state.version) throw bad('MAPPING_VERSION_CONFLICT', '规则已更新，请刷新后重试', 409);
      state.version += 1; state.rules = structuredClone(input.rules);
      state.audits ||= []; state.audits.push({ action: 'RULES_SAVED', actor, at: now(), version: state.version });
      return { version: state.version, rules: state.rules };
    });
    return result;
  }
  function list(handbookId, status, cursor = 0, limit = 50, documentId = '') {
    const state = get(); const rows = Object.values(state.effective).filter(row => !handbookId || row.handbookId === handbookId).filter(row => !documentId || row.documentId === documentId).filter(row => !status || row.status === status);
    rows.sort((a, b) => a.handbookId.localeCompare(b.handbookId) || a.documentId.localeCompare(b.documentId));
    return { items: rows.slice(cursor, cursor + limit), total: rows.length, nextCursor: cursor + limit < rows.length ? cursor + limit : null };
  }
  function batch(id) { return get().batches.find(item => item.id === id) || null; }
  function start(handbookId, catalog, actor) {
    const documents = projectDocuments(catalog, handbookId); const state = get(); const templates = templateStore.list({ summary: '1' }).filter(t => t.status === 'active').map(t => ({ id: t.id, name: t.name, description: t.description }));
    // Published rules can outlive a template being disabled. Never propose an inactive template.
    const activeRules = state.rules.filter(rule => templateStore.get(rule.templateId)?.status === 'active');
    const rows = documents.map(document => ({ ...document, ...evaluateRules(activeRules, document), source: 'rule', decision: null }));
    const item = { id: crypto.randomUUID(), handbookId, actor, createdAt: now(), ruleVersion: state.version, status: rows.some(row => row.status !== 'rule') && config.ai?.enabled ? 'running' : 'completed', documents: rows, templateIds: templates.map(t => t.id), catalogVersion: catalog.outlineVersionId || null };
    store.transaction(next => { next.batches ||= []; next.batches.unshift(item); next.batches = next.batches.slice(0, 30); });
    if (item.status === 'running') {
      const controller = new AbortController(); running.set(item.id, controller);
      setImmediate(async () => {
        const pending = rows.filter(value => value.status !== 'rule');
        let cursor = 0;
        const worker = async () => {
          while (!controller.signal.aborted && cursor < pending.length) {
            const row = pending[cursor++];
            try {
              const response = await analyzeAI({ document: row, templates, prompt: config.ai.prompt, timeoutMs: config.ai.timeoutMs, signal: controller.signal });
              row.ai = { templateId: templates.some(t => t.id === response.templateId) ? response.templateId : '', reason: String(response.reason || '').slice(0, config.ai.maxEvidenceChars || 1200), modelRunId: response.modelRunId || null };
            } catch (error) { row.ai = { templateId: '', reason: `模型分析未完成：${error.message}`, modelRunId: null }; }
            if (!controller.signal.aborted) store.transaction(next => { const target = next.batches.find(b => b.id === item.id); if (target && target.status !== 'cancelled') target.documents = structuredClone(rows); });
          }
        };
        await Promise.all(Array.from({ length: Math.min(Math.max(1, Number(config.ai.maxConcurrency || 4)), 8, pending.length) }, worker));
        store.transaction(next => { const target = next.batches.find(b => b.id === item.id); if (target && target.status !== 'cancelled') target.status = 'completed'; });
        running.delete(item.id);
      });
    }
    return { id: item.id, status: item.status, documentCount: rows.length, ruleVersion: item.ruleVersion };
  }
  function cancel(id) {
    const item = batch(id); if (!item) throw bad('MAPPING_BATCH_NOT_FOUND', '分析批次不存在', 404);
    running.get(id)?.abort();
    store.transaction(state => { const target = state.batches.find(value => value.id === id); if (target?.status === 'running') target.status = 'cancelled'; });
    return batch(id);
  }
  function decide(input, actor, visibleDocuments, outlineVersionId) {
    const allowed = new Set(visibleDocuments.map(d => String(d.id)));
    const result = store.transaction(state => {
      const current = state.batches?.find(b => b.id === input.batchId);
      if (!current) throw bad('MAPPING_BATCH_NOT_FOUND', '分析批次不存在', 404);
      if (current.status !== 'completed') throw bad('MAPPING_ANALYSIS_RUNNING', '分析尚未完成', 409);
      if (current.ruleVersion !== state.version) throw bad('MAPPING_VERSION_CONFLICT', '规则已变化，请重新分析', 409);
      if (current.catalogVersion !== (outlineVersionId || null)) throw bad('MAPPING_OUTLINE_CHANGED', '文档大纲已变化，请重新分析', 409);
      const row = current.documents.find(d => d.documentId === String(input.documentId));
      if (!row || !allowed.has(row.documentId)) throw bad('MAPPING_DOCUMENT_UNAVAILABLE', '文档已不可见或不在分析范围', 403);
      const choices = new Set([row.templateId, row.ai?.templateId, ...(row.candidates || [])].filter(Boolean));
      if (!choices.has(input.templateId) && !String(input.reason || '').trim()) throw bad('MAPPING_CHOICE_INVALID', '改选模板请填写理由', 400);
      if (templateStore.get(input.templateId)?.status !== 'active') throw bad('MAPPING_TEMPLATE_INACTIVE', '模板已停用，请重新分析', 409);
      state.effective ||= {}; const key = docKey(current.handbookId, row.documentId); const previous = state.effective[key];
      if (Number(input.baseVersion || 0) !== Number(previous?.version || 0)) throw bad('MAPPING_VERSION_CONFLICT', '映射已被其他人修改', 409);
      const source = input.templateId === row.templateId ? 'rule' : input.templateId === row.ai?.templateId ? 'ai' : 'manual';
      const effective = { decisionId: crypto.randomUUID(), handbookId: current.handbookId, documentId: row.documentId, title: row.title, path: row.path, templateId: input.templateId, status: 'active', source, ruleVersion: current.ruleVersion, modelRunId: row.ai?.modelRunId || null, reason: String(input.reason || row.ai?.reason || row.ruleIds?.join(', ') || '').slice(0, 1200), actor, updatedAt: now(), version: (previous?.version || 0) + 1, batchId: current.id };
      state.effective[key] = effective; state.audits ||= []; state.audits.push({ action: 'MAPPING_DECIDED', before: previous || null, after: effective, at: effective.updatedAt, actor });
      return effective;
    });
    return result;
  }
  const resolve = (handbookId, documentId) => get().effective[docKey(handbookId, documentId)] || null;
  return { rules, previewRules, saveRules, list, batch, start, cancel, decide, resolve, projectDocuments };
}
module.exports = { createTemplateMappingService, projectDocuments, evaluateRules };
