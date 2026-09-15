const crypto = require('crypto');
const { createAggregateStore } = require('./aggregate-store');
const path = require('path');
const { CONFIG_PATHS } = require('./config-registry');

function hash(content) { return `sha256:${crypto.createHash('sha256').update(String(content)).digest('hex')}`; }
function validateContent(content) {
  const value = typeof content === 'string' ? content : '';
  const errors = [];
  if (typeof content !== 'string') errors.push('模板正文必须是 Markdown 字符串');
  if (value.includes('\u0000')) errors.push('模板正文不得包含二进制控制字符');
  if (!value.trim()) errors.push('模板正文不能为空');
  if (Buffer.byteLength(value) > 1024 * 1024) errors.push('正文不能超过 1MB');
  if (/["']?(?:password|api[_-]?key|client[_-]?secret|access[_-]?token)["']?\s*[:=]\s*["']?[^${\s"']{8,}/i.test(value)) errors.push('模板不得包含敏感凭证');
  return { valid: errors.length === 0, errors };
}
function initialState() { return { schemaVersion: 1, templates: [], audits: [] }; }
function createTemplateStore(options = {}) {
  // 模板存储遵循统一存储模式：开发环境 file 不应因默认构造而强制访问未启动的 YashanDB 服务。
  const store = options.store || createAggregateStore({
    namespace: 'templates',
    key: process.env.TEMPLATE_STORE_KEY || 'state',
    filePath: process.env.TEMPLATE_STORE_FILE || path.join(path.dirname(CONFIG_PATHS.knowledgeAssets), 'template-library.json'),
    emptyValue: initialState(),
  });
  const listCache = new Map();
  const listCacheTtlMs = Number(options.listCacheTtlMs ?? 1500);
  function invalidateListCache() { listCache.clear(); }
  function normalize(state) { state.templates = Array.isArray(state.templates) ? state.templates : []; state.audits = Array.isArray(state.audits) ? state.audits : []; return state; }
  function list(filters = {}) {
    const cacheable = filters.summary === '1' || filters.summary === true;
    const cacheKey = cacheable ? JSON.stringify(filters) : null;
    if (cacheKey) {
      const cached = listCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return structuredClone(cached.value);
    }
    const query = String(filters.q || '').trim().toLowerCase();
    const type = String(filters.type || '').trim();
    const status = String(filters.status || '').trim();
    const value = normalize(store.read()).templates
      .filter(t => !query || [t.id, t.name, t.description].some(value => String(value || '').toLowerCase().includes(query)))
      .filter(t => !type || String(t.type) === type)
      .filter(t => !status || String(t.status) === status)
      .map(t => {
        const current = t.versions?.find(v => v.version === t.currentVersion) || null;
        if (filters.summary === '1' || filters.summary === true) {
          return { ...t, versions: undefined, current: current ? { ...current, content: undefined } : null };
        }
        return { ...t, versions: undefined, current };
      });
    if (cacheKey) listCache.set(cacheKey, { value, expiresAt: Date.now() + listCacheTtlMs });
    return value;
  }
  async function listAsync(filters = {}) {
    if (typeof store.readAsync !== 'function') return list(filters);
    const state = normalize(await store.readAsync());
    const query = String(filters.q || '').trim().toLowerCase(); const type = String(filters.type || '').trim(); const status = String(filters.status || '').trim();
    return state.templates.filter(t => (!query || [t.id, t.name, t.description].some(value => String(value || '').toLowerCase().includes(query))) && (!type || String(t.type) === type) && (!status || String(t.status) === status)).map(t => { const current = t.versions?.find(v => v.version === t.currentVersion) || null; return filters.summary === '1' || filters.summary === true ? { ...t, versions: undefined, current: current ? { ...current, content: undefined } : null } : { ...t, versions: undefined, current }; });
  }
  function get(id) { const item = normalize(store.read()).templates.find(t => t.id === id); return item ? { ...item, current: item.versions.find(v => v.version === item.currentVersion) || null } : null; }
  function create(input, actor) {
    const content = input.content; const check = validateContent(content); if (!check.valid) { const e = new Error(check.errors.join('；')); e.code = 'TEMPLATE_VALIDATION_FAILED'; e.status = 422; throw e; }
    const result = store.transaction(state => {
      normalize(state);
      const id = input.id || `template_${crypto.randomBytes(8).toString('hex')}`;
      if (state.templates.some(t => t.id === id)) throw Object.assign(new Error('模板已存在'), { code: 'TEMPLATE_EXISTS', status: 409 });
      const now = new Date().toISOString();
      const name = String(input.name || id).trim(); const type = String(input.type || '通用基础').trim(); const description = String(input.description || '').trim();
      if (!name || !type) throw Object.assign(new Error('模板名称和类型不能为空'), { code: 'TEMPLATE_VALIDATION_FAILED', status: 422 });
      const version = { version: 1, content, contentHash: hash(content), name, type, description, validationStatus: 'passed', validationSummary: check, sourceType: input.sourceType || 'markdown', sourceFilename: input.sourceFilename || null, createdBy: actor?.user?.id || null, createdAt: now };
      const item = { id, name, type, description, legacyPath: input.legacyPath || null, status: 'active', currentVersion: 1, sourceType: version.sourceType, sourceFilename: version.sourceFilename, editable: true, createdBy: version.createdBy, updatedBy: version.createdBy, createdAt: now, updatedAt: now, versions: [version] };
      state.templates.push(item); state.audits.push({ action: 'TEMPLATE_CREATED', templateId: id, actorId: version.createdBy, at: now }); return { ...item, current: version };
    });
    invalidateListCache(); return result;
  }
  function save(id, input, actor) {
    const result = store.transaction(state => {
      normalize(state);
      const item = state.templates.find(t => t.id === id);
      if (!item) throw Object.assign(new Error('模板不存在'), { status: 404, code: 'TEMPLATE_NOT_FOUND' });
      if (!Number.isSafeInteger(input.baseVersion) || input.baseVersion < 1 || input.baseVersion !== item.currentVersion)
        throw Object.assign(new Error('模板已被其他用户更新，请刷新后重试'), { status: 409, code: 'TEMPLATE_VERSION_CONFLICT' });
      if (item.status === 'deleted') throw Object.assign(new Error('模板已删除，请先恢复'), { status: 409, code: 'TEMPLATE_INACTIVE' });
      const content = input.content;
      const check = validateContent(content);
      if (!check.valid) throw Object.assign(new Error(check.errors.join('；')), { status: 422, code: 'TEMPLATE_VALIDATION_FAILED' });
      for (const field of ['name', 'type', 'description']) {
        if (input[field] === undefined) continue;
        if (typeof input[field] !== 'string' || !input[field].trim())
          throw Object.assign(new Error('模板名称、类型和描述不能为空'), { status: 422, code: 'TEMPLATE_VALIDATION_FAILED' });
        item[field] = input[field].trim();
      }
      const now = new Date().toISOString();
      const version = {
        version: item.currentVersion + 1, content, contentHash: hash(content),
        name: item.name, type: item.type, description: item.description,
        validationStatus: 'passed', validationSummary: check,
        sourceType: input.sourceType || 'markdown', sourceFilename: input.sourceFilename || null,
        changeSummary: String(input.changeSummary || ''), createdBy: actor?.user?.id || null, createdAt: now,
      };
      item.versions.push(version); item.currentVersion = version.version;
      item.updatedBy = version.createdBy; item.updatedAt = now;
      state.audits.push({ action: 'TEMPLATE_SAVED', templateId: id, version: version.version, actorId: version.createdBy, at: now });
      return { ...item, current: version };
    });
    invalidateListCache(); return result;
  }
  function disable(id, actor, enabled) { const result = store.transaction(state => { normalize(state); const item = state.templates.find(t => t.id === id); if (!item) { const e = new Error('模板不存在'); e.code = 'TEMPLATE_NOT_FOUND'; e.status = 404; throw e; } item.status = enabled ? 'active' : 'disabled'; item.updatedBy = actor?.user?.id || null; item.updatedAt = new Date().toISOString(); state.audits.push({ action: enabled ? 'TEMPLATE_RESTORED' : 'TEMPLATE_DISABLED', templateId: id, actorId: item.updatedBy, at: item.updatedAt }); return item; }); invalidateListCache(); return result; }
  function getVersion(id, version) {
    const item = get(id);
    if (!item) throw Object.assign(new Error('模板不存在'), { status: 404, code: 'TEMPLATE_NOT_FOUND' });
    const selected = Number.isSafeInteger(version) && item.versions.find(v => v.version === version);
    if (!selected) throw Object.assign(new Error('历史版本不存在'), { status: 404, code: 'TEMPLATE_VERSION_NOT_FOUND' });
    return structuredClone(selected);
  }
  function updateMetadata(id, input, actor) {
    const current = get(id);
    if (!current) throw Object.assign(new Error('模板不存在'), { status: 404, code: 'TEMPLATE_NOT_FOUND' });
    return save(id, { ...input, content: current.current.content }, actor);
  }
  function remove(id, actor) { const result = store.transaction(state => {
    normalize(state); const item = state.templates.find(t => t.id === id);
    if (!item) throw Object.assign(new Error('模板不存在'), { status: 404, code: 'TEMPLATE_NOT_FOUND' });
    item.status = 'deleted'; item.updatedAt = new Date().toISOString(); item.updatedBy = actor?.user?.id || null;
    state.audits.push({ action: 'TEMPLATE_DELETED', templateId: id, actorId: item.updatedBy, at: item.updatedAt }); return item;
  }); invalidateListCache(); return result; }
  function restoreDraft(id, version, actor) {
    const item = get(id);
    if (!item) { const e = new Error('模板不存在'); e.code = 'TEMPLATE_NOT_FOUND'; e.status = 404; throw e; }
    const selected = Number.isSafeInteger(version) && item.versions.find(v => v.version === version);
    if (!selected) { const e = new Error('历史版本不存在'); e.code = 'TEMPLATE_VERSION_NOT_FOUND'; e.status = 404; throw e; }
    return { templateId: id, baseVersion: item.currentVersion, content: selected.content, sourceType: 'restore-draft', sourceVersion: selected.version, restoredBy: actor?.user?.id || null };
  }
  function importDraft(input, actor) {
    const content = input.content;
    const check = validateContent(content);
    if (!check.valid) { const e = new Error(check.errors.join('；')); e.code = 'TEMPLATE_VALIDATION_FAILED'; e.status = 422; throw e; }
    return { name: String(input.name || input.sourceFilename || '未命名模板'), type: String(input.type || '通用基础'), description: String(input.description || ''), content, sourceType: 'upload', sourceFilename: input.sourceFilename || null, validationStatus: 'passed', validationSummary: check, draft: true };
  }
  function resolveForGeneration(reference) {
    const normalized = String(reference || '').replace(/^(?:\.\.\/)+/, '');
    const matches = list().filter(t => t.id === normalized || t.legacyPath === normalized);
    if (matches.length !== 1) throw Object.assign(new Error('模板未初始化或引用不唯一'), { status: 404, code: 'TEMPLATE_NOT_FOUND' });
    const item = matches[0]; const version = item.current;
    if (item.status !== 'active') throw Object.assign(new Error('模板已停用，不能用于新任务'), { status: 409, code: 'TEMPLATE_INACTIVE' });
    if (!version || version.validationStatus !== 'passed' || hash(version.content) !== version.contentHash) throw Object.assign(new Error('模板版本校验失败'), { status: 422, code: 'TEMPLATE_VALIDATION_FAILED' });
    return { templateId: item.id, templateVersion: version.version, templateHash: version.contentHash, templateSource: 'database', templateContent: version.content };
  }
  return { list, listAsync, get, getVersion, create, save, disable, remove, updateMetadata, restoreDraft, importDraft, resolveForGeneration, validateContent, hash };
}
module.exports = { createTemplateStore, validateContent, hash };
