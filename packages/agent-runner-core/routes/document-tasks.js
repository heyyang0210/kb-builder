const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const XLSX = require('xlsx');
const { createAggregateStore } = require('../lib/aggregate-store');
const { AGENT_RUNNER_RUNTIME_ROOT } = require('../lib/repo-paths');
const defaults = require('../../../config/knowledge-center/content-rules.json').documentTasks;
const CONTEXT = Symbol('trusted-task-context');
const clean = value => value == null ? '' : String(value).trim();
const now = () => new Date().toISOString();
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function fail(code, message, status = 422) { throw Object.assign(new Error(message), { code, status }); }
function emptyState(defaultOwnerId) { return { schemaVersion: 2, revision: 0, config: { ...structuredClone(defaults), defaultOwnerId: defaultOwnerId || defaults.defaultOwnerId || null, revision: 0 }, tasks: [], audits: [], idempotency: {} }; }
function actor(ctx) { return clean(ctx.session?.user?.principalId || ctx.session?.user?.id); }
function actions(ctx) { return ctx.session?.user?.allowedActions || ctx.session?.allowedActions || []; }
function admin(ctx) { return actions(ctx).includes('platform:manage'); }
function writable(ctx) { if (!actions(ctx).includes('knowledge:write')) fail('FORBIDDEN', '没有任务处理权限', 403); }
function owns(ctx, id) { writable(ctx); if (actor(ctx) !== id) fail('FORBIDDEN', '只有当前责任人可以确认此层范围', 403); }
function canEditPlan(ctx, task) { return actions(ctx).includes('knowledge:write') && (admin(ctx) || actor(ctx) === task.ownerId); }
function requireAdmin(ctx) { if (!admin(ctx)) fail('FORBIDDEN', '只有管理员可以维护配置与责任人', 403); }
function person(ctx, id, required = true) {
  if (!id && !required) return null;
  const value = ctx.people.find(p => p.id === clean(id));
  if (!value) fail('PERSON_INVALID', '请选择人员目录中的有效人员');
  return value.id;
}
function handbook(ctx, id) { const book = ctx.handbooks.find(b => b.id === id); if (!book) fail('HANDBOOK_FORBIDDEN', '手册不存在或不可见', 403); return book; }
function visible(ctx, task) { return !(task.decomposition?.handbooks || []).some(b => !ctx.handbooks.some(h => h.id === b.id)); }
function requireTask(state, ctx, number) { const task = state.tasks.find(t => t.number === number); if (!task || !visible(ctx, task)) fail('NOT_FOUND', '任务不存在或不可见', 404); return task; }
function revision(value, body) { if (body.expectedRevision == null) fail('REVISION_REQUIRED', '请重新读取后提交版本号', 428); if (Number(body.expectedRevision) !== Number(value.revision || 0)) fail('REVISION_CONFLICT', '内容已由其他人更新，请重新读取后重试', 409); }
function reason(config, value, detail, confirmed) {
  if (!value && !confirmed) return null;
  if (!config.reasonOptions.some(x => x.id === value)) fail('REASON_REQUIRED', '请选择不涉及理由');
  if (value === 'other' && !clean(detail)) fail('REASON_DETAIL_REQUIRED', '选择其他时必须补充理由');
  return { id: value, detail: clean(detail) || null };
}
function audit(state, ctx, task, type, previous, next, note) {
  const event = { type, at: now(), operatorId: actor(ctx), previous: structuredClone(previous ?? null), next: structuredClone(next ?? null), reason: clean(note) || null };
  if (task) { task.assignmentHistory ||= []; task.assignmentHistory.push(event); task.updatedAt = event.at; task.revision = Number(task.revision || 0) + 1; if (['ticket_scope', 'handbook_scope'].includes(type)) task.noChangeConfirmation = null; }
  state.audits.push({ number: task?.number || null, ...event }); state.revision++;
}
function sourceUrl(value) {
  if (!clean(value)) return null;
  let url;
  try { url = new URL(clean(value)); } catch { fail('SOURCE_URL_INVALID', '来源链接必须为有效的 HTTPS 网页地址'); }
  if (url.protocol !== 'https:' || url.username || url.password) fail('SOURCE_URL_INVALID', '来源链接必须为无认证信息的 HTTPS 网页地址');
  return url.href;
}
function spreadsheetRows(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' }), sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  let numberColumn;
  for (let c = range.s.c; c <= range.e.c; c++) {
    const header = clean(sheet[XLSX.utils.encode_cell({ r: range.s.r, c })]?.v);
    if (['编号', 'number', 'id'].includes(header)) { numberColumn = c; break; }
  }
  return rows.map(row => {
    const link = numberColumn == null ? null : sheet[XLSX.utils.encode_cell({ r: row.__rowNum__, c: numberColumn })]?.l?.Target;
    return link ? { ...row, sourceUrl: link } : row;
  });
}
function plannedTime(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail('PLAN_TIME_INVALID', '请选择有效的计划日期和时间');
  return value;
}
function normalizeSource(row) {
  const number = clean(row.number ?? row.编号 ?? row.id);
  if (!number) fail('NUMBER_REQUIRED', '工单编号不能为空');
  return { number, sourceUrl: sourceUrl(row.sourceUrl ?? row.来源链接), description: clean(row.description ?? row.描述 ?? row.title ?? row.标题), product: clean(row.product ?? row.产品) || null, version: clean(row.version ?? row.versionNumber ?? row.版本号 ?? row.复现发布号) || null, sourceStatus: clean(row.sourceStatus ?? row.status ?? row.状态) || null, sourceOwner: clean(row.ownerName ?? row.负责人 ?? row.ownerId) || null, sourceCreatedAt: clean(row.sourceCreatedAt ?? row.创建时间) || null, output: clean(row.output ?? row.输出件 ?? row.说明) || null };
}
function preview(state, rows) {
  const seen = new Set();
  const tasksByNumber = new Map(state.tasks.map(task => [task.number, task]));
  const items = rows.map((row, index) => {
    try {
      const source = normalizeSource(row);
      if (seen.has(source.number)) fail('DUPLICATE_NUMBER', '同一文件的编号重复，请去重');
      seen.add(source.number);
      const old = tasksByNumber.get(source.number);
      if (!source.sourceUrl && old?.source?.sourceUrl) source.sourceUrl = old.source.sourceUrl;
      return { row: index + 2, number: source.number, source, action: !old ? 'created' : hash(old.source) === hash(source) ? 'unchanged' : 'updated' };
    } catch (error) { return { row: index + 2, action: 'error', message: error.message }; }
  });
  const summary = Object.fromEntries(['created', 'updated', 'unchanged', 'error'].map(key => [key, items.filter(i => i.action === key).length]));
  return { items, summary, digest: hash({ revision: state.revision, rows }), revision: state.revision };
}
function reviewDocuments(review) { return review.handbookSource?.documents || []; }
function delivery(ctx, book, doc) {
  if (!doc.reviewTaskId) return { status: 'pending', label: doc.kind === 'new' && !doc.createdDocumentId ? '待创建并发布大纲文档' : '待编写、保存与送审' };
  try {
    const review = ctx.reviewService.get(ctx.session, doc.reviewTaskId);
    const id = doc.createdDocumentId || doc.id;
    if (review.handbookId !== book.id || review.businessVersion !== book.targetVersion || !reviewDocuments(review).some(d => String(d.documentId) === id)) return { status: 'pending', label: '审核关联范围或版本不一致' };
    return { ...review.completion, reviewState: review.state, reviewTaskId: review.id, mergeRequest: review.mergeRequest || null, label: review.state === 'rejected' ? '审核退回，请修订并重新送审' : review.completion.label };
  } catch (error) { return { status: 'pending', label: '关联审核不可读取，请检查权限或重新关联', code: error.code }; }
}
function project(ctx, raw, config) {
  const task = structuredClone(raw);
  task.ownerName = ctx.people.find(p => p.id === task.ownerId)?.displayName || task.ownerId || '待配置';
  task.sourceUrl = sourceUrl(task.source?.sourceUrl);
  task.plannedStartTime ??= null; task.plannedEndTime ??= null;
  task.canEditPlan = canEditPlan(ctx, task);
  const scope = task.decomposition || {};
  let done = Boolean(scope.confirmed && scope.ticketImpact === 'involved' && scope.handbooks?.length);
  let hasDocuments = false;
  for (const book of scope.handbooks || []) {
    book.ownerName = ctx.people.find(p => p.id === book.ownerId)?.displayName || book.ownerId;
    book.canEdit = Boolean(scope.confirmed && actor(ctx) === book.ownerId && actions(ctx).includes('knowledge:write'));
    book.canAssign = actions(ctx).includes('knowledge:write') && (admin(ctx) || actor(ctx) === task.ownerId);
    book.completed = Boolean(book.confirmed && book.impact === 'not_involved' && book.reason);
    if (book.impact === 'involved') {
      hasDocuments = true;
      for (const doc of book.documents || []) {
        doc.completion = delivery(ctx, book, doc);
        doc.ownerName = ctx.people.find(p => p.id === doc.ownerId)?.displayName || doc.ownerId;
        doc.canAssign = Boolean(scope.confirmed && actions(ctx).includes('knowledge:write') && (admin(ctx) || actor(ctx) === book.ownerId));
        doc.canEdit = Boolean(scope.confirmed && book.confirmed && actor(ctx) === doc.ownerId && actions(ctx).includes('knowledge:write'));
        doc.writingUrl = book.targetVersion && doc.kind !== 'new' ? `/knowledge-center/production/handbook/${encodeURIComponent(book.id)}?documentId=${encodeURIComponent(doc.createdDocumentId || doc.id)}&branch=${encodeURIComponent(book.targetVersion)}&taskNumber=${encodeURIComponent(task.number)}` : null;
        if (doc.createdDocumentId) doc.writingUrl = `/knowledge-center/production/handbook/${encodeURIComponent(book.id)}?documentId=${encodeURIComponent(doc.createdDocumentId)}&branch=${encodeURIComponent(book.targetVersion)}&taskNumber=${encodeURIComponent(task.number)}`;
      }
      book.completed = Boolean(book.confirmed && book.documents?.length && book.documents.every(d => d.completion.status === 'completed'));
    }
    done &&= book.completed;
  }
  if (!hasDocuments) done = Boolean(scope.confirmed && task.noChangeConfirmation && (scope.ticketImpact === 'not_involved' || (scope.handbooks?.length && scope.handbooks.every(b => b.confirmed && b.impact === 'not_involved' && b.reason))));
  task.status = done ? 'completed' : !scope.confirmed ? 'pending_scope' : 'in_progress';
  task.endTime = done ? (task.noChangeConfirmation?.at || (scope.handbooks || []).flatMap(b => b.documents || []).map(d => d.completion?.completedAt).filter(Boolean).sort().at(-1) || null) : null;
  task.canConfirm = actor(ctx) === task.ownerId && actions(ctx).includes('knowledge:write');
  task.canAdmin = admin(ctx);
  task.pending = !scope.confirmed ? ['责任人确认工单范围'] : scope.ticketImpact === 'not_involved' ? done ? [] : ['责任人确认不涉及完成'] : (scope.handbooks || []).flatMap(b => !b.confirmed ? [`${b.name}：手册负责人确认范围`] : b.impact === 'involved' ? b.documents.filter(d => d.completion.status !== 'completed').map(d => `${d.name}：${d.completion.label}`) : []);
  if (!done && !hasDocuments && scope.confirmed && !task.pending.length) task.pending.push('责任人确认所有手册不涉及并完成');
  return task;
}
function createDocumentTaskRouter(options = {}) {
  const router = express.Router();
  const store = options.store || createAggregateStore({ namespace: 'document_tasks', key: options.key || 'state', filePath: options.filePath || process.env.DOCUMENT_TASK_STORE_PATH || path.join(AGENT_RUNNER_RUNTIME_ROOT, 'knowledge-center/document-tasks-v2.json'), emptyValue: emptyState(options.defaultOwnerId), ...(options.filePath ? { mode: 'file' } : {}) });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
  router.use(express.json({ limit: '20mb' }));
  router.use(async (req, res, next) => {
    try {
      req.taskContext = req[CONTEXT] || (options.context ? await options.context(req) : null);
      const ctx = req.taskContext;
      if (!ctx || !actor(ctx) || !actions(ctx).includes('knowledge:read')) fail('TRUSTED_SESSION_REQUIRED', '需要网关验证的登录会话', 403);
      res.setHeader('Cache-Control', 'no-store');
      next();
    } catch (error) { next(error); }
  });
  const route = fn => async (req, res, next) => { try { res.json({ success: true, data: await fn(req, req.taskContext) }); } catch (error) { next(error); } };
  async function read() { const state = await store.readAsync(); if (state.schemaVersion !== 2) fail('MIGRATION_REQUIRED', '旧任务数据需要预检迁移', 409); return state; }
  function writeIdentity(req, ctx) {
    const key = clean(req.get('Idempotency-Key'));
    if (!key || key.length > 160) fail('IDEMPOTENCY_REQUIRED', '写入需要有效的幂等键', 428);
    return { identity: `${actor(ctx)}:${key}`, digest: hash({ method: req.method, path: req.path, body: req.body }) };
  }
  function replay(state, identity, digest) {
    const previous = state.idempotency[identity];
    if (previous && previous.digest !== digest) fail('IDEMPOTENCY_CONFLICT', '幂等键对应不同内容', 409);
    return previous;
  }
  async function mutate(req, ctx, fn) {
    const { identity, digest } = writeIdentity(req, ctx);
    const transaction = store.transactionAsync || store.transaction;
    return transaction.call(store, state => {
      if (state.schemaVersion !== 2) fail('MIGRATION_REQUIRED', '旧任务数据需要预检迁移', 409);
      const previous = replay(state, identity, digest);
      if (previous) return previous.result;
      const result = fn(state);
      state.idempotency[identity] = { digest, result: structuredClone(result) };
      return result;
    });
  }
  router.get('/context', route(async (req, ctx) => ({ people: ctx.people, handbooks: ctx.handbooks, actorId: actor(ctx), canAdmin: admin(ctx), canWrite: actions(ctx).includes('knowledge:write'), config: (await read()).config })));
  router.get('/catalog', route(async (req, ctx) => { handbook(ctx, clean(req.query.handbookId)); return ctx.catalog(clean(req.query.handbookId)); }));
  router.get('/config', route(async () => (await read()).config));
  router.put('/config', route((req, ctx) => {
    requireAdmin(ctx);
    return mutate(req, ctx, state => {
      revision(state.config, req.body);
      const next = { ...state.config, defaultOwnerId: person(ctx, req.body.defaultOwnerId), revision: state.config.revision + 1 };
      if (req.body.pingcodeProjectUrl !== undefined) { const url = clean(req.body.pingcodeProjectUrl); if (url && !/^https:\/\//.test(url)) fail('SOURCE_URL_INVALID', '来源地址必须为 HTTPS'); next.pingcodeProjectUrl = url || null; }
      if (req.body.reasonOptions) { if (!Array.isArray(req.body.reasonOptions) || !req.body.reasonOptions.length || req.body.reasonOptions.some(r => !clean(r.id) || !clean(r.label)) || new Set(req.body.reasonOptions.map(r => r.id)).size !== req.body.reasonOptions.length || !req.body.reasonOptions.some(r => r.id === 'other')) fail('REASONS_INVALID', '理由选项须唯一且包含 other'); next.reasonOptions = req.body.reasonOptions.map(r => ({ id: clean(r.id), label: clean(r.label) })); }
      audit(state, ctx, null, 'config', state.config, next); state.config = next; return next;
    });
  }));
  router.post('/import', upload.single('file'), route(async (req, ctx) => {
    requireAdmin(ctx);
    let rows = req.body?.tasks;
    if (req.file) {
      if (/\.json$/i.test(req.file.originalname)) { const parsed = JSON.parse(req.file.buffer.toString('utf8')); rows = Array.isArray(parsed) ? parsed : parsed.tasks; }
      else rows = spreadsheetRows(req.file.buffer);
    }
    if (!Array.isArray(rows) || !rows.length || rows.length > 10000) fail('IMPORT_INVALID', '请选择包含 1 至 10000 行的 JSON 或 XLSX 工单清单');
    const isPreview = req.query.preview === 'true';
    if (isPreview) return preview(await read(), rows);
    return mutate(req, ctx, state => {
      const result = preview(state, rows);
      if (!req.body.digest || req.body.digest !== result.digest) fail('PREVIEW_STALE', '预览已过期，请重新预览', 409);
      if (result.summary.error) fail('IMPORT_ERRORS', '请先修正所有错误行');
      const ownerId = person(ctx, state.config.defaultOwnerId);
      const tasksByNumber = new Map(state.tasks.map(task => [task.number, task]));
      for (const item of result.items) {
        if (item.action === 'unchanged') continue;
        let task = tasksByNumber.get(item.number);
        if (task) { const previous = task.source; task.source = item.source; for (const key of ['description', 'product', 'version', 'sourceStatus', 'sourceCreatedAt']) task[key] = item.source[key]; audit(state, ctx, task, 'source_update', previous, task.source); }
        else { task = { ...item.source, source: item.source, number: item.number, ownerId, revision: 0, decomposition: { ticketImpact: null, ticketReason: null, confirmed: false, handbooks: [] }, startTime: null, endTime: null, plannedStartTime: null, plannedEndTime: null, createdAt: now(), assignmentHistory: [] }; state.tasks.push(task); audit(state, ctx, task, 'import', null, { ownerId, source: item.source }); }
      }
      return { ...result, applied: true };
    });
  }));
  router.get('/', route(async (req, ctx) => {
    const state = await read(); let items = state.tasks.filter(t => visible(ctx, t)).map(t => project(ctx, t, state.config));
    const filterOptions = Object.fromEntries(['product', 'version'].map(key => [key, [...new Set(items.map(t => t[key]).filter(Boolean))].sort()]));
    if (clean(req.query.q)) items = items.filter(t => `${t.number} ${t.description}`.toLowerCase().includes(clean(req.query.q).toLowerCase()));
    for (const key of ['ownerId', 'product', 'version', 'status']) if (clean(req.query[key])) items = items.filter(t => t[key] === req.query[key]);
    items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const total = items.length, pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize) || 20)), page = Math.max(1, Number(req.query.page) || 1);
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, filterOptions };
  }));
  router.get('/:number', route(async (req, ctx) => { const state = await read(); return project(ctx, requireTask(state, ctx, req.params.number), state.config); }));
  router.put('/:number/owner', route((req, ctx) => {
    requireAdmin(ctx);
    return mutate(req, ctx, state => {
      const task = requireTask(state, ctx, req.params.number); revision(task, req.body);
      const previous = task.ownerId; task.ownerId = person(ctx, req.body.ownerId); audit(state, ctx, task, 'owner', previous, task.ownerId, req.body.reason); return project(ctx, task, state.config);
    });
  }));
  router.put('/:number/plan', route((req, ctx) => mutate(req, ctx, state => {
    const task = requireTask(state, ctx, req.params.number);
    if (!canEditPlan(ctx, task)) fail('FORBIDDEN', '只有管理员或当前责任人可以设置时间', 403);
    revision(task, req.body);
    const fields = ['plannedStartTime', 'plannedEndTime'];
    if (!fields.some(key => Object.hasOwn(req.body, key))) fail('PLAN_TIME_REQUIRED', '请提供需要更新的计划时间');
    const previous = Object.fromEntries(fields.map(key => [key, task[key] ?? null]));
    const next = Object.fromEntries(fields.map(key => [key, Object.hasOwn(req.body, key) ? plannedTime(req.body[key]) : previous[key]]));
    if (next.plannedStartTime && next.plannedEndTime && next.plannedEndTime < next.plannedStartTime) fail('PLAN_RANGE_INVALID', '结束时间不能早于开始时间');
    Object.assign(task, next); audit(state, ctx, task, 'plan', previous, next); return project(ctx, task, state.config);
  })));
  router.put('/:number/handbooks/:id/owner', route((req, ctx) => mutate(req, ctx, state => {
    const task = requireTask(state, ctx, req.params.number); writable(ctx);
    if (!admin(ctx) && actor(ctx) !== task.ownerId) fail('FORBIDDEN', '只有工单责任人或管理员可以改派手册责任人', 403);
    revision(task, req.body);
    const book = task.decomposition.handbooks.find(b => b.id === req.params.id);
    if (!book) fail('HANDBOOK_NOT_FOUND', '手册不属于当前任务', 404);
    const previous = { handbookId: book.id, ownerId: book.ownerId };
    book.ownerId = person(ctx, req.body.ownerId);
    audit(state, ctx, task, 'handbook_owner', previous, { handbookId: book.id, ownerId: book.ownerId });
    return project(ctx, task, state.config);
  })));
  router.put('/:number/documents/:key/owner', route((req, ctx) => mutate(req, ctx, state => {
    const task = requireTask(state, ctx, req.params.number); writable(ctx);
    const book = task.decomposition.handbooks.find(b => b.id === req.body.handbookId);
    const doc = book?.documents.find(d => d.id === req.params.key);
    if (!doc || !task.decomposition.confirmed) fail('DOCUMENT_NOT_FOUND', '文档不属于已转交的手册任务', 404);
    if (!admin(ctx) && actor(ctx) !== book.ownerId) fail('FORBIDDEN', '只有手册责任人或管理员可以改派文档责任人', 403);
    revision(task, req.body);
    const previous = { handbookId: book.id, documentId: doc.id, ownerId: doc.ownerId };
    doc.ownerId = person(ctx, req.body.ownerId);
    audit(state, ctx, task, 'document_owner', previous, { handbookId: book.id, documentId: doc.id, ownerId: doc.ownerId });
    return project(ctx, task, state.config);
  })));
  router.put('/:number/decomposition', route((req, ctx) => mutate(req, ctx, state => {
    const task = requireTask(state, ctx, req.params.number); owns(ctx, task.ownerId); revision(task, req.body);
    const input = req.body, confirmed = input.confirm === true;
    if (input.ticketImpact && !['involved', 'not_involved'].includes(input.ticketImpact)) fail('IMPACT_INVALID', '范围判断无效');
    if (confirmed && !input.ticketImpact) fail('IMPACT_REQUIRED', '请选择是否涉及文档');
    const previous = structuredClone(task.decomposition);
    task.scopeHistory ||= []; task.scopeHistory.push(previous);
    const books = (input.handbooks || []).map(b => {
      const known = handbook(ctx, clean(b.id)), old = previous.handbooks.find(h => h.id === b.id);
      const ownerId = person(ctx, b.ownerId, confirmed);
      return { ...(old || { impact: null, reason: null, confirmed: false, documents: [] }), id: known.id, name: known.name, ownerId };
    });
    if (new Set(books.map(b => b.id)).size !== books.length) fail('DUPLICATE_HANDBOOK', '手册不能重复');
    if (confirmed && input.ticketImpact === 'involved' && !books.length) fail('HANDBOOK_REQUIRED', '请选择至少一本手册');
    if (previous.confirmed && previous.handbooks.some(b => input.ticketImpact !== 'involved' || !books.some(next => next.id === b.id))) fail('SCOPE_WITHDRAWAL_REQUIRED', '已转交手册不能直接移除，请保留现有范围');
    task.decomposition = { ticketImpact: input.ticketImpact || null, ticketReason: input.ticketImpact === 'not_involved' ? reason(state.config, input.reasonId, input.reasonDetail, confirmed) : null, confirmed, handbooks: input.ticketImpact === 'involved' ? books : [] };
    if (confirmed && !task.startTime) task.startTime = now();
    audit(state, ctx, task, 'ticket_scope', previous, task.decomposition, input.reason); return project(ctx, task, state.config);
  })));
  router.put('/:number/handbooks/:id', route(async (req, ctx) => {
    const catalog = await ctx.catalog(req.params.id);
    return mutate(req, ctx, state => {
      const task = requireTask(state, ctx, req.params.number); revision(task, req.body);
      const book = task.decomposition.handbooks.find(b => b.id === req.params.id);
      if (!book || !task.decomposition.confirmed) fail('TICKET_SCOPE_REQUIRED', '请先由责任人确认工单范围');
      owns(ctx, book.ownerId);
      const input = req.body, confirmed = input.confirm === true, previous = structuredClone(book);
      task.scopeHistory ||= []; task.scopeHistory.push(previous);
      if (input.impact && !['involved', 'not_involved'].includes(input.impact)) fail('IMPACT_INVALID', '范围判断无效');
      if (confirmed && !input.impact) fail('IMPACT_REQUIRED', '请选择本手册是否涉及文档');
      if (input.targetVersion && !catalog.versions.includes(input.targetVersion)) fail('VERSION_INVALID', '请选择该手册真实目标版本');
      const documents = (input.documents || []).map(d => {
        const id = clean(d.id), kind = d.kind === 'new' ? 'new' : 'existing';
        if (!id) fail('DOCUMENT_REQUIRED', '文档必须有稳定编号');
        if (kind === 'existing' && !catalog.documents.some(x => x.id === id)) fail('DOCUMENT_INVALID', '文档不属于所选手册');
        if (kind === 'new' && (!clean(d.name) || !catalog.chapters.some(c => c.id === d.parentId))) fail('NEW_DOCUMENT_INVALID', '新增文档需要名称与有效章节');
        const previousDoc = book.documents.find(x => x.id === id);
        const old = previousDoc && previousDoc.kind === kind && (kind !== 'new' || previousDoc.name === clean(d.name) && previousDoc.parentId === d.parentId) ? previousDoc : null;
        const ownerId = person(ctx, d.ownerId, confirmed);
        return { ...(old || {}), id, kind, name: kind === 'new' ? clean(d.name) : catalog.documents.find(x => x.id === id).name, parentId: kind === 'new' ? d.parentId : null, ownerId };
      });
      if (new Set(documents.map(d => d.id)).size !== documents.length) fail('DOCUMENT_DUPLICATE', '文档不能重复');
      if (confirmed && input.impact === 'involved' && (!documents.length || !input.targetVersion)) fail('DOCUMENT_SCOPE_REQUIRED', '涉及文档时请选择文档、负责人和真实目标版本');
      if (previous.confirmed && previous.documents.some(d => input.impact !== 'involved' || !documents.some(next => next.id === d.id))) fail('SCOPE_WITHDRAWAL_REQUIRED', '已分派文档不能直接移除，请保留现有范围');
      Object.assign(book, { impact: input.impact || null, reason: input.impact === 'not_involved' ? reason(state.config, input.reasonId, input.reasonDetail, confirmed) : null, confirmed, targetVersion: input.targetVersion || null, documents: input.impact === 'involved' ? documents : [] });
      audit(state, ctx, task, 'handbook_scope', previous, book, input.reason); return project(ctx, task, state.config);
    });
  }));
  router.get('/:number/reviews', route(async (req, ctx) => {
    const state = await read(), task = requireTask(state, ctx, req.params.number);
    const book = task.decomposition.handbooks.find(b => b.id === req.query.handbookId);
    const doc = book?.documents.find(d => d.id === req.query.documentId);
    if (!doc) fail('DOCUMENT_NOT_FOUND', '文档不属于当前任务');
    const documentId = doc.createdDocumentId || doc.id;
    return ctx.reviewService.list(ctx.session, { handbookId: book.id, businessVersion: book.targetVersion }).map(summary => ctx.reviewService.get(ctx.session, summary.id)).filter(review => review.handbookId === book.id && review.businessVersion === book.targetVersion && reviewDocuments(review).some(d => String(d.documentId) === documentId)).map(review => ({ id: review.id, name: review.name || review.title, state: review.state }));
  }));
  router.post('/:number/documents/:key/prepare-new', route(async (req, ctx) => {
    const state = await read(), { identity, digest } = writeIdentity(req, ctx);
    const prior = replay(state, identity, digest); if (prior) return prior.result;
    const task = requireTask(state, ctx, req.params.number); revision(task, req.body);
    const book = task.decomposition.handbooks.find(b => b.id === req.body.handbookId), doc = book?.documents.find(d => d.id === req.params.key);
    if (!doc || doc.kind !== 'new' || !task.decomposition.confirmed || !book.confirmed) fail('DOCUMENT_NOT_FOUND', '请先确认新增文档范围');
    owns(ctx, doc.ownerId);
    if (!actions(ctx).includes('outline:create')) fail('OUTLINE_PERMISSION_REQUIRED', '创建目录文档需要大纲创建权限，请联系手册负责人', 403);
    if (!ctx.createDocument) fail('OUTLINE_UNAVAILABLE', '目录创建服务暂不可用', 503);
    const created = await ctx.createDocument(book.id, { parentId: doc.parentId, name: doc.name, targetVersion: book.targetVersion, proposalKey: hash({ number: task.number, book: book.id, document: doc.id, name: doc.name, parent: doc.parentId, version: book.targetVersion }) });
    return mutate(req, ctx, current => {
      const latest = requireTask(current, ctx, req.params.number); revision(latest, req.body);
      const target = latest.decomposition.handbooks.find(b => b.id === book.id).documents.find(d => d.id === doc.id);
      const previous = target.outlineProposal || null; target.outlineProposal = created;
      audit(current, ctx, latest, 'new_document_prepare', previous, created); return project(ctx, latest, current.config);
    });
  }));
  router.post('/:number/documents/:key/resolve-new', route(async (req, ctx) => {
    const catalog = await ctx.catalog(req.body.handbookId);
    return mutate(req, ctx, state => {
      const task = requireTask(state, ctx, req.params.number); revision(task, req.body);
      const book = task.decomposition.handbooks.find(b => b.id === req.body.handbookId), doc = book?.documents.find(d => d.id === req.params.key);
      if (!doc || doc.kind !== 'new' || !task.decomposition.confirmed || !book.confirmed) fail('DOCUMENT_NOT_FOUND', '新增范围不存在'); owns(ctx, doc.ownerId);
      const created = catalog.documents.find(d => d.id === req.body.createdDocumentId && d.name === doc.name && d.parentId === doc.parentId);
      if (!created) fail('CREATED_DOCUMENT_MISMATCH', '请选择同一章节下、与新增名称一致的真实文档');
      const previous = doc.createdDocumentId; doc.createdDocumentId = created.id;
      audit(state, ctx, task, 'new_document_link', previous, { handbookId: book.id, documentId: created.id }); return project(ctx, task, state.config);
    });
  }));
  router.post('/:number/documents/:key/link', route((req, ctx) => mutate(req, ctx, state => {
    const task = requireTask(state, ctx, req.params.number); revision(task, req.body);
    const book = task.decomposition.handbooks.find(b => b.id === req.body.handbookId); const doc = book?.documents.find(d => d.id === req.params.key);
    if (!doc || !task.decomposition.confirmed || !book.confirmed) fail('DOCUMENT_NOT_FOUND', '请先确认文档范围'); owns(ctx, doc.ownerId);
    const review = ctx.reviewService.get(ctx.session, clean(req.body.reviewTaskId));
    const documentId = doc.createdDocumentId || doc.id;
    if (review.handbookId !== book.id || review.businessVersion !== book.targetVersion || !reviewDocuments(review).some(d => String(d.documentId) === documentId)) fail('REVIEW_SCOPE_MISMATCH', '审核任务的手册、文档或目标版本不一致');
    const previous = doc.reviewTaskId; doc.reviewTaskId = review.id; audit(state, ctx, task, 'review_link', previous, { handbookId: book.id, documentId, reviewTaskId: review.id }); return project(ctx, task, state.config);
  })));
  router.post('/:number/complete', route((req, ctx) => mutate(req, ctx, state => {
    const task = requireTask(state, ctx, req.params.number); revision(task, req.body); owns(ctx, task.ownerId);
    const scope = task.decomposition;
    if (!scope.confirmed || !(scope.ticketImpact === 'not_involved' && scope.ticketReason || scope.ticketImpact === 'involved' && scope.handbooks.length && scope.handbooks.every(b => b.confirmed && b.impact === 'not_involved' && b.reason))) fail('DELIVERY_REQUIRED', '只能明确确认理由齐全的不涉及分支；文档处理必须等待合并与回读');
    audit(state, ctx, task, 'no_change_complete', null, true); task.noChangeConfirmation = { at: now(), operatorId: actor(ctx) }; return project(ctx, task, state.config);
  })));
  router.patch('/:number', route(() => fail('STATUS_WRITE_FORBIDDEN', '完成状态由真实交付结果计算，不能手工修改')));
  router.use((error, req, res, next) => { if (res.headersSent) return next(error); res.status(error.status || (error instanceof SyntaxError ? 422 : 500)).json({ success: false, error: { code: error.code || 'TASK_FAILED', message: error.message } }); });
  router.store = store;
  return router;
}
function createDocumentTaskHandler(options = {}) {
  const app = express(); app.disable('x-powered-by'); app.use('/', createDocumentTaskRouter(options));
  return (req, res, context) => { req[CONTEXT] = context; req.url = req.url.slice('/knowledge-center/api/document-tasks'.length) || '/'; if (req.url.startsWith('?')) req.url = `/${req.url}`; app(req, res); };
}
module.exports = createDocumentTaskRouter;
Object.assign(module.exports, { createDocumentTaskRouter, createDocumentTaskHandler, emptyState, project, preview });
