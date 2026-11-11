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
function owns(ctx, id) { writable(ctx); if (actor(ctx) !== id && !admin(ctx)) fail('FORBIDDEN', '只有当前责任人或管理员可以确认此层范围', 403); }
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
function assignSubtaskNumbers(task, documents) {
  const previous = [task.decomposition, ...(task.scopeHistory || [])]
    .flatMap(scope => scope?.handbooks || (scope?.documents ? [scope] : [])).flatMap(book => book.documents || []);
  const used = new Set(previous.map(doc => Number(doc.subtaskNumber)).filter(n => Number.isSafeInteger(n) && n > 0));
  let next = Math.max(Number(task.nextSubtaskNumber) || 1, ...used, 0);
  if (used.has(next)) next++;
  const current = new Set();
  for (const doc of documents) {
    if (!Number.isSafeInteger(doc.subtaskNumber) || doc.subtaskNumber < 1) {
      while (used.has(next) || current.has(next)) next++;
      doc.subtaskNumber = next++;
    }
    if (current.has(doc.subtaskNumber)) fail('SUBTASK_NUMBER_CONFLICT', '同一工单的子任务编号重复', 409);
    current.add(doc.subtaskNumber);
    used.add(doc.subtaskNumber);
  }
  task.nextSubtaskNumber = Math.max(next, Number(task.nextSubtaskNumber) || 1);
}
function audit(state, ctx, task, type, previous, next, note) {
  const responsibleId = ['ticket_scope', 'no_change_complete'].includes(type) ? task?.ownerId
    : ['handbook_scope', 'handbook_owner'].includes(type) ? previous?.ownerId || next?.ownerId
      : ['new_document_prepare', 'new_document_link', 'review_link', 'document_owner'].includes(type) ? previous?.ownerId || next?.ownerId || null : null;
  const event = { type, at: now(), operatorId: actor(ctx), responsibleId: responsibleId || null,
    delegatedByAdmin: Boolean(responsibleId && actor(ctx) !== responsibleId && admin(ctx)),
    previous: structuredClone(previous ?? null), next: structuredClone(next ?? null), reason: clean(note) || null };
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
function matchesReviewScope(review, book, documentId) {
  // The task catalog's targetVersion currently identifies the repository
  // branch. Review businessVersion is a separate database version.
  return review.handbookId === book.id
    && review.handbookSource?.branch === book.targetVersion
    && reviewDocuments(review).some(document => String(document.documentId) === String(documentId)
      && document.branch === book.targetVersion);
}
function scopeEvidence(ctx, task, book, doc) {
  if (!doc.reviewTaskId) return { reviewTaskId: null, state: null, observation: null };
  try {
    const review = ctx.reviewService.get(ctx.session, doc.reviewTaskId);
    if (!matchesReviewScope(review, book, doc.createdDocumentId || doc.id)) fail('REVIEW_SCOPE_MISMATCH', '关联审核与当前文档范围不一致', 409);
    return { reviewTaskId: review.id, state: review.state, observation: review.deliveryObservation || null,
      mergeRequest: review.mergeRequest ? { iid: review.mergeRequest.iid || null, webUrl: review.mergeRequest.webUrl || null } : null };
  } catch (error) {
    if (error.code === 'REVIEW_SCOPE_MISMATCH') throw error;
    fail('DEPENDENCY_UNAVAILABLE', '无法读取关联审核与 MR 状态，请重新读取后再预览', 503);
  }
}
function scopeSnapshot(ctx, task) {
  return (task.decomposition?.handbooks || []).flatMap(book => (book.documents || []).map(doc => ({
    handbookId: book.id, documentId: doc.createdDocumentId || doc.id, proposalId: doc.id,
    scopeVersion: doc.scopeVersion || 1, targetVersion: book.targetVersion || null,
    ...scopeEvidence(ctx, task, book, doc),
  })));
}
function activeScopeChange(task, handbookId, documentId) {
  return (task.scopeChanges || []).find(change => !['confirmed', 'cancelled'].includes(change.status)
    && (change.affectedDocuments || []).some(item => item.handbookId === handbookId && item.documentId === documentId));
}
function delivery(ctx, book, doc, task) {
  const scopeChange = activeScopeChange(task, book.id, doc.createdDocumentId || doc.id);
  if (scopeChange) return { status: 'pending', label: '范围纠偏处理中，暂不能继续审核或发布', recovery: 'scope_correction', scopeChangeId: scopeChange.id };
  if (!doc.reviewTaskId) return { status: 'pending', label: doc.kind === 'new' && !doc.createdDocumentId ? '待创建并发布大纲文档' : '待编写、保存与送审' };
  if (doc.linkedScopeVersion != null && doc.scopeVersion != null && doc.linkedScopeVersion !== doc.scopeVersion) {
    return { status: 'pending', label: '处理范围已变化，请重新送审并关联当前审核', recovery: 'scope_changed' };
  }
  try {
    const review = ctx.reviewService.get(ctx.session, doc.reviewTaskId);
    const id = doc.createdDocumentId || doc.id;
    if (!matchesReviewScope(review, book, id)) return { status: 'pending', label: '审核关联范围或分支不一致' };
    const closedMr = review.state === 'mr_submitted' && review.deliveryObservation?.state === 'closed';
    return { ...review.completion, reviewState: review.state, reviewTaskId: review.id, mergeRequest: review.mergeRequest || null,
      recovery: closedMr ? 'revise_after_mr_closed' : review.deliveryFailure ? 'retry_delivery_readback' : review.state === 'rejected' ? 'revise_after_rejection' : null,
      deliveryFailure: review.deliveryFailure || null,
      label: review.state === 'rejected' ? '审核退回，请修订并重新送审' : review.completion.label };
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
    book.canEdit = Boolean(scope.confirmed && (actor(ctx) === book.ownerId || admin(ctx)) && actions(ctx).includes('knowledge:write'));
    book.canAssign = actions(ctx).includes('knowledge:write') && (admin(ctx) || actor(ctx) === task.ownerId);
    book.completed = Boolean(book.confirmed && book.impact === 'not_involved' && book.reason);
    if (book.impact === 'involved') {
      hasDocuments = true;
      for (const doc of book.documents || []) {
        doc.completion = delivery(ctx, book, doc, task);
        doc.ownerName = ctx.people.find(p => p.id === doc.ownerId)?.displayName || doc.ownerId;
        doc.canAssign = Boolean(scope.confirmed && actions(ctx).includes('knowledge:write') && (admin(ctx) || actor(ctx) === book.ownerId));
        doc.canEdit = Boolean(scope.confirmed && book.confirmed && (actor(ctx) === doc.ownerId || admin(ctx)) && actions(ctx).includes('knowledge:write'));
        doc.writingUrl = book.targetVersion && doc.kind !== 'new' ? `/knowledge-center/production/handbook/${encodeURIComponent(book.id)}?documentId=${encodeURIComponent(doc.createdDocumentId || doc.id)}&branch=${encodeURIComponent(book.targetVersion)}&taskNumber=${encodeURIComponent(task.number)}` : null;
        if (doc.createdDocumentId) doc.writingUrl = `/knowledge-center/production/handbook/${encodeURIComponent(book.id)}?documentId=${encodeURIComponent(doc.createdDocumentId)}&branch=${encodeURIComponent(book.targetVersion)}&taskNumber=${encodeURIComponent(task.number)}`;
      }
      book.completed = Boolean(book.confirmed && book.documents?.length && book.documents.every(d => d.completion.status === 'completed'));
    }
    done &&= book.completed;
  }
  if (!hasDocuments) done = Boolean(scope.confirmed && task.noChangeConfirmation && (scope.ticketImpact === 'not_involved' || (scope.handbooks?.length && scope.handbooks.every(b => b.confirmed && b.impact === 'not_involved' && b.reason))));
  task.scopeChecks = structuredClone(task.scopeChecks || []);
  const openChecks = task.scopeChecks.filter(item => item.status !== 'completed');
  done &&= openChecks.length === 0;
  task.status = done ? 'completed' : !scope.confirmed ? 'pending_scope' : 'in_progress';
  task.endTime = done ? (task.noChangeConfirmation?.at || (scope.handbooks || []).flatMap(b => b.documents || []).map(d => d.completion?.completedAt).filter(Boolean).sort().at(-1) || null) : null;
  task.canConfirm = (actor(ctx) === task.ownerId || admin(ctx)) && actions(ctx).includes('knowledge:write');
  task.canPublish = admin(ctx) || actions(ctx).includes('publish:manage');
  task.canAdmin = admin(ctx);
  task.pending = !scope.confirmed ? ['工单责任人确认手册范围'] : scope.ticketImpact === 'not_involved' ? done ? [] : ['责任人确认不涉及完成'] : (scope.handbooks || []).flatMap(b => !b.confirmed ? [`${b.name}：手册负责人确认范围`] : b.impact === 'involved' ? b.documents.filter(d => d.completion.status !== 'completed').map(d => `${d.name}：${d.completion.label}`) : []);
  task.pending.push(...openChecks.map(item => `${item.documentName}：核对已发布内容`));
  task.pending.push(...(task.scopeChanges || []).filter(item => item.status === 'reported' && !(item.affectedDocuments || []).length).map(item => `待核实范围偏差：${item.reason}`));
  if (!done && !hasDocuments && scope.confirmed && !task.pending.length) task.pending.push('责任人确认所有手册不涉及并完成');
  task.nextAction = openChecks.length ? { label: '核对已发布内容', action: 'publication-check', checkId: openChecks[0].id } : null;
  if (!task.nextAction && task.canConfirm && !scope.confirmed) task.nextAction = { label: '确认手册范围', action: 'ticket-scope' };
  if (!task.nextAction && !done) {
    const allScopesNotInvolved = scope.ticketImpact === 'not_involved' && scope.ticketReason
      || scope.ticketImpact === 'involved' && scope.handbooks?.length
        && scope.handbooks.every(book => book.confirmed && book.impact === 'not_involved' && book.reason);
    if (task.canConfirm && !hasDocuments && scope.confirmed && !done && allScopesNotInvolved) task.nextAction = { label: '确认不涉及并完成', action: 'complete' };
    const ownedBook = (scope.handbooks || []).find(book => book.canEdit && !book.confirmed);
    if (ownedBook) task.nextAction = { label: '确认文档范围', action: 'book-scope', handbookId: ownedBook.id };
    if (!task.nextAction) {
      const ownedDocument = (scope.handbooks || []).flatMap(book => (book.documents || []).map(document => ({ book, document })))
        .find(({ book, document }) => document.canEdit && book.confirmed && !['under_review', 'approved'].includes(document.completion?.reviewState)
          && (document.completion?.reviewState !== 'mr_submitted' || document.completion?.recovery === 'revise_after_mr_closed'));
      if (ownedDocument?.document.writingUrl) task.nextAction = { label: ['revise_after_mr_closed', 'revise_after_rejection'].includes(ownedDocument.document.completion?.recovery) ? '修订文档并重新送审' : '进入文档生产', url: ownedDocument.document.writingUrl };
      else if (ownedDocument?.document.kind === 'new') task.nextAction = { label: '创建/关联新增文档', action: 'new-document', handbookId: ownedDocument.book.id, documentId: ownedDocument.document.id };
    }
    if (!task.nextAction) {
      const reviewDocument = (scope.handbooks || []).flatMap(book => (book.documents || []).map(document => ({ book, document })))
        .find(({ document }) => document.reviewTaskId && document.completion?.status !== 'completed'
          && ['under_review', 'approved', 'mr_submitted'].includes(document.completion?.reviewState));
      if (reviewDocument) task.nextAction = { label: reviewDocument.document.completion?.reviewState === 'under_review' ? '查看审核进度' : '查看交付进度', url: `/knowledge-center/review?taskId=${encodeURIComponent(reviewDocument.document.reviewTaskId)}&documentId=${encodeURIComponent(reviewDocument.document.createdDocumentId || reviewDocument.document.id)}` };
    }
  }
  return task;
}
function mine(ctx, state) {
    const current = actor(ctx);
    const canWrite = actions(ctx).includes('knowledge:write');
    if (!canWrite) return { items: [], total: 0, following: [] };
    const items = [];
    const following = [];
    for (const raw of state.tasks) {
      if (!visible(ctx, raw) || raw.status === 'completed') continue;
      const scope = raw.decomposition || {};
      const relevant = raw.ownerId === current || (scope.handbooks || []).some(book => book.ownerId === current || (book.documents || []).some(doc => doc.ownerId === current));
      if (!relevant) continue;
      const task = project(ctx, raw, state.config);
      if (task.status === 'completed') continue;
      const follow = () => {
        const base = { number: task.number, plannedStartTime: task.plannedStartTime, plannedEndTime: task.plannedEndTime,
          updatedAt: task.updatedAt || task.createdAt, queue: 'waiting', state: 'waiting', source: '任务管理',
          url: `/knowledge-center/document-tasks?task=${encodeURIComponent(task.number)}` };
        const add = (id, kind, title, status, book, doc) => following.push({ ...base, id, kind,
          taskType: { assign: '任务管理', document: '文档生产', review: '文档审核', merge: '文档发布' }[kind],
          title, status, subtaskNumber: doc?.subtaskNumber || null,
          version: book?.targetVersion || task.version || '',
          lineage: { ticketNumber: task.number, handbookId: book?.id, handbookName: book?.name, documentId: doc?.id, documentName: doc?.name } });
        if (!scope.confirmed || scope.ticketImpact !== 'involved') {
          if (task.ownerId !== current || scope.confirmed) add(`wait:ticket:${task.number}`, 'assign', task.description || task.number, '等待他人确认范围');
          return;
        }
        let added = false;
        for (const book of task.decomposition?.handbooks || []) {
          if (task.ownerId !== current && book.ownerId !== current && !(book.documents || []).some(doc => doc.ownerId === current)) continue;
          if (!book.confirmed) {
            if (book.ownerId !== current) { add(`wait:handbook:${task.number}:${book.id}`, 'assign', book.name || task.description, '等待他人确认范围', book); added = true; }
            continue;
          }
          for (const doc of book.documents || []) {
            if (task.ownerId !== current && book.ownerId !== current && doc.ownerId !== current) continue;
            if (doc.completion?.status === 'completed') continue;
            const phase = doc.completion?.reviewState;
            const kind = ['approved', 'mr_submitted', 'merged', 'published'].includes(phase) ? 'merge'
              : phase === 'under_review' ? 'review' : 'document';
            const status = kind === 'merge' ? doc.completion?.label || '等待合并或回读'
              : kind === 'review' ? '等待他人审核' : '等待他人编写';
            if (doc.ownerId === current && (kind === 'document' || doc.completion?.recovery === 'revise_after_mr_closed')) continue;
            add(`wait:document:${task.number}:${book.id}:${doc.id}`, kind, doc.name || task.description, status, book, doc);
            added = true;
          }
        }
        if (!added && !items.some(item => item.number === task.number)) add(`wait:ticket:${task.number}`, 'assign', task.description || task.number, '等待他人处理');
      };
      const base = { number: task.number, subtaskNumber: null, taskType: '任务管理', plannedStartTime: task.plannedStartTime, plannedEndTime: task.plannedEndTime, description: task.description, source: '任务管理', updatedAt: task.updatedAt || task.createdAt, url: `/knowledge-center/document-tasks?task=${encodeURIComponent(task.number)}` };
      if (task.ownerId === current && !scope.confirmed) items.push({ ...base, id: `ticket:${task.number}:scope`, kind: 'assign', actionLabel: '确认手册范围', title: `确认 ${task.number} 的手册范围`, context: task.description || task.number, status: '待处理', state: 'pending', version: task.version || '', url: `${base.url}&action=ticket-scope`, lineage: { ticketNumber: task.number } });
      if (task.ownerId === current && scope.confirmed && task.nextAction?.action === 'complete') items.push({ ...base, id: `ticket:${task.number}:complete`, kind: 'assign', actionLabel: '确认不涉及并完成', title: `确认 ${task.number} 不涉及文档并完成`, context: task.description || task.number, status: '待处理', state: 'pending', version: task.version || '', url: `${base.url}&action=complete`, lineage: { ticketNumber: task.number } });
      if (!scope.confirmed || scope.ticketImpact !== 'involved') { follow(); continue; }
      for (const book of task.decomposition.handbooks || []) {
        const context = `${task.number} · ${book.name}`;
        if (book.ownerId === current && !book.confirmed) items.push({ ...base, id: `handbook:${task.number}:${book.id}:scope`, kind: 'assign', actionLabel: '确认文档范围', title: `确认 ${book.name} 的文档范围`, context, status: '待处理', state: 'pending', version: book.targetVersion || task.version || '', url: `${base.url}&action=book-scope&handbookId=${encodeURIComponent(book.id)}`, lineage: { ticketNumber: task.number, handbookId: book.id, handbookName: book.name } });
        if (!book.confirmed || book.impact !== 'involved') continue;
        for (const doc of book.documents || []) {
          if (doc.ownerId !== current || doc.completion?.status === 'completed') continue;
          if (['under_review', 'approved', 'merged', 'published', 'completed'].includes(doc.completion?.reviewState)
            || doc.completion?.reviewState === 'mr_submitted' && doc.completion?.recovery !== 'revise_after_mr_closed') continue;
          const needsCreation = doc.kind === 'new' && !doc.createdDocumentId;
          const writingUrl = needsCreation ? `${base.url}&action=new-document&handbookId=${encodeURIComponent(book.id)}&documentId=${encodeURIComponent(doc.id)}` : doc.writingUrl || base.url;
          const revise = ['revise_after_rejection', 'revise_after_mr_closed'].includes(doc.completion?.recovery);
          items.push({ ...base, subtaskNumber: doc.subtaskNumber || null, taskType: '文档生产', id: `document:${task.number}:${book.id}:${doc.id}:write`, kind: 'document', actionLabel: needsCreation ? '创建/关联新增文档' : revise ? '修订文档并重新送审' : '进入文档生产', title: needsCreation ? `创建 ${doc.name}` : `编写或修订 ${doc.name}`, context: `${context} · ${doc.name}`, status: revise ? doc.completion.label : '待处理', state: revise ? 'risk' : 'pending', version: book.targetVersion || '', url: writingUrl, lineage: { ticketNumber: task.number, handbookId: book.id, handbookName: book.name, documentId: doc.id, documentName: doc.name } });
        }
      }
      follow();
    }
    items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    following.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return { items, total: items.length, following };
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
  const route = fn => async (req, res, next) => { try { res.json({ success: true, data: await fn(req, req.taskContext, res) }); } catch (error) { next(error); } };
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
  function scopeProposal(task, change, proposed) {
    const currentBooks = task.decomposition?.handbooks || [];
    const nextDocuments = change.level === 'ticket'
      ? (proposed.handbooks || []).flatMap(book => {
        const existing = currentBooks.find(item => item.id === book.id);
        return (book.documents || existing?.documents || []).map(doc => ({ handbookId: book.id, documentId: doc.createdDocumentId || doc.id }));
      })
      : (proposed.documents || []).map(doc => ({ handbookId: change.handbookId, documentId: doc.createdDocumentId || doc.id }));
    const nextIds = new Set(nextDocuments.map(item => `${item.handbookId}:${item.documentId}`));
    const current = currentBooks.flatMap(book => (book.documents || []).map(doc => ({ book, doc, key: `${book.id}:${doc.createdDocumentId || doc.id}` })));
    const removed = current.filter(item => change.level === 'ticket' ? !nextIds.has(item.key) : item.book.id === change.handbookId && !nextIds.has(item.key));
    const added = nextDocuments.filter(item => !current.some(entry => entry.key === `${item.handbookId}:${item.documentId}`));
    const changed = current.filter(item => {
      const proposedBook = change.level === 'ticket' ? (proposed.handbooks || []).find(book => book.id === item.book.id) : proposed;
      const proposedDoc = proposedBook?.documents?.find(doc => (doc.createdDocumentId || doc.id) === (item.doc.createdDocumentId || item.doc.id));
      if (!proposedDoc) return false;
      const targetVersion = change.level === 'ticket' ? proposedBook.targetVersion || item.book.targetVersion : proposed.targetVersion;
      return item.book.targetVersion !== targetVersion || item.doc.kind !== (proposedDoc.kind || 'existing')
        || item.doc.parentId !== (proposedDoc.parentId || null) || item.doc.name !== (proposedDoc.name || item.doc.name);
    });
    return { current, added, removed, changed };
  }
  function scopeImpact(ctx, task, change, proposed) {
    const delta = scopeProposal(task, change, proposed);
    const affected = [...delta.changed.map(item => ({ book: item.book, doc: item.doc })), ...delta.removed.map(item => ({ book: item.book, doc: item.doc }))];
    const byId = new Map(affected.map(({ book, doc }) => [`${book.id}:${doc.createdDocumentId || doc.id}`,
      { handbookId: book.id, documentId: doc.createdDocumentId || doc.id, ...scopeEvidence(ctx, task, book, doc) }]));
    const items = [...delta.added.map(item => ({ ...item, operation: 'add', mrState: null, canConfirm: true })),
      ...delta.changed.map(item => ({ handbookId: item.book.id, documentId: item.doc.createdDocumentId || item.doc.id, operation: 'update', evidence: byId.get(item.key) })),
      ...delta.removed.map(item => ({ handbookId: item.book.id, documentId: item.doc.createdDocumentId || item.doc.id, operation: 'withdraw', evidence: byId.get(item.key) }))]
      .map(item => {
        const observation = item.evidence?.observation;
        const observedAt = Date.parse(observation?.observedAt || '');
        const maxAgeMs = Math.max(1000, Number(process.env.KC_SCOPE_MR_OBSERVATION_MAX_AGE_MS) || 300000);
        const fresh = Number.isFinite(observedAt) && Date.now() - observedAt <= maxAgeMs;
        const mrState = observation?.state || 'unknown';
        const canConfirm = !item.evidence || !item.evidence.reviewTaskId || item.evidence.state !== 'mr_submitted'
          ? true : fresh && ['closed', 'merged'].includes(mrState);
        return { handbookId: item.handbookId, documentId: item.documentId, operation: item.operation, mrState,
          reviewTaskId: item.evidence?.reviewTaskId || null, mergeRequest: item.evidence?.mergeRequest || null,
          targetCommit: observation?.targetCommit || observation?.commit || null, observedAt: observation?.observedAt || null,
          canConfirm, nextAction: !fresh && item.evidence?.reviewTaskId ? 'refresh_mr_state' : mrState === 'opened' ? 'close_mr_manually' : null };
      });
    const impactDigest = hash({ number: task.number, revision: task.revision, scopeVersion: task.scopeVersion || 0, changeId: change.id, proposed, items });
    return { items, impactDigest, canConfirm: items.every(item => item.canConfirm), observedAt: now(), revision: task.revision };
  }
  function applyScopeProposal(state, ctx, task, change, proposed, impact, catalog) {
    const previous = structuredClone(task.decomposition);
    task.scopeHistory ||= []; task.scopeHistory.push(previous);
    if (change.level === 'ticket') {
      const ticketImpact = proposed.ticketImpact;
      if (!['involved', 'not_involved'].includes(ticketImpact)) fail('IMPACT_INVALID', '请选择工单是否涉及文档');
      const oldBooks = previous.handbooks || [];
      const books = (proposed.handbooks || []).map(item => {
        const known = handbook(ctx, clean(item.id));
        const old = oldBooks.find(book => book.id === known.id) || [...task.scopeHistory].reverse().flatMap(scope => scope.handbooks || []).find(book => book.id === known.id);
        const ownerId = person(ctx, item.ownerId || old?.ownerId || known.ownerId);
        const documents = old?.documents || [];
        return { ...(old || { impact: null, reason: null, confirmed: false, documents: [] }), id: known.id, name: known.name, ownerId,
          membership: 'active', documents: structuredClone(documents) };
      });
      if (new Set(books.map(book => book.id)).size !== books.length) fail('DUPLICATE_HANDBOOK', '手册不能重复');
      if (ticketImpact === 'involved' && !books.length) fail('HANDBOOK_REQUIRED', '涉及文档时至少保留一本手册');
      const ticketReason = ticketImpact === 'not_involved' ? reason(state.config, proposed.reasonId, proposed.reasonDetail, true) : null;
      task.decomposition = { ticketImpact, ticketReason, confirmed: true, handbooks: ticketImpact === 'involved' ? books : [] };
    } else {
      const oldBook = previous.handbooks.find(book => book.id === change.handbookId);
      if (!oldBook) fail('HANDBOOK_NOT_FOUND', '手册不属于当前任务', 404);
      const impactValue = proposed.impact;
      if (!['involved', 'not_involved'].includes(impactValue)) fail('IMPACT_INVALID', '请选择本手册是否涉及文档');
      if (proposed.targetVersion && !catalog.versions.includes(proposed.targetVersion)) fail('VERSION_INVALID', '请选择该手册真实目标版本');
      const oldDocuments = oldBook.documents || [];
      const documents = (proposed.documents || []).map(item => {
        const id = clean(item.id), kind = item.kind === 'new' ? 'new' : 'existing';
        const catalogDoc = catalog.documents.find(doc => doc.id === id);
        if (!id || kind === 'existing' && (!catalog.outlineVersionId || !catalogDoc) || kind === 'new' && (!clean(item.name) || !catalog.chapters.some(chapter => chapter.id === item.parentId))) fail('DOCUMENT_INVALID', '范围中的文档或章节无效');
        const old = oldDocuments.find(doc => doc.id === id && doc.kind === kind) || [...task.scopeHistory].reverse().flatMap(scope => scope.handbooks || []).filter(book => book.id === change.handbookId).flatMap(book => book.documents || []).find(doc => doc.id === id && doc.kind === kind);
        const ownerId = person(ctx, item.ownerId || old?.ownerId || catalogDoc?.ownerId);
        const changed = Boolean(old && (oldBook.targetVersion !== proposed.targetVersion || old.kind !== kind || old.parentId !== (item.parentId || null) || kind === 'new' && old.name !== clean(item.name)));
        return { ...(old || {}), id, kind, name: kind === 'new' ? clean(item.name) : catalogDoc.name, parentId: kind === 'new' ? item.parentId : null,
          ownerId, scopeVersion: changed ? Number(old.scopeVersion || 1) + 1 : Number(old?.scopeVersion || 1),
          ...(changed ? { reviewTaskId: null, linkedScopeVersion: null } : {}), membership: 'active' };
      });
      if (new Set(documents.map(doc => doc.id)).size !== documents.length) fail('DOCUMENT_DUPLICATE', '文档不能重复');
      if (impactValue === 'involved' && (!documents.length || !proposed.targetVersion)) fail('DOCUMENT_SCOPE_REQUIRED', '涉及文档时必须选择文档、负责人和目标版本');
      const target = task.decomposition.handbooks.find(book => book.id === change.handbookId);
      const nextReason = impactValue === 'not_involved' ? reason(state.config, proposed.reasonId, proposed.reasonDetail, true) : null;
      const changedScope = oldBook.impact !== impactValue || oldBook.targetVersion !== (proposed.targetVersion || null)
        || hash((oldBook.documents || []).map(doc => [doc.id, doc.kind, doc.name, doc.parentId]).sort()) !== hash(documents.map(doc => [doc.id, doc.kind, doc.name, doc.parentId]).sort());
      Object.assign(target, { impact: impactValue, reason: nextReason, confirmed: true, targetVersion: proposed.targetVersion || null, documents: impactValue === 'involved' ? documents : [] });
      if (changedScope) target.scopeVersion = Number(oldBook.scopeVersion || 0) + 1;
      assignSubtaskNumbers(task, documents);
      const activeNumbers = task.decomposition.handbooks.flatMap(book => book.documents || []).map(doc => doc.subtaskNumber).filter(Boolean);
      if (new Set(activeNumbers).size !== activeNumbers.length) fail('SUBTASK_NUMBER_CONFLICT', '同一工单的子任务编号重复', 409);
    }
    const oldTicketBooks = (previous.handbooks || []).map(book => book.id).sort();
    const newTicketBooks = (task.decomposition.handbooks || []).map(book => book.id).sort();
    const changedScope = change.level === 'ticket'
      ? previous.ticketImpact !== task.decomposition.ticketImpact || JSON.stringify(oldTicketBooks) !== JSON.stringify(newTicketBooks)
      : impact.items.length > 0 || previous.handbooks.find(book => book.id === change.handbookId)?.impact !== task.decomposition.handbooks.find(book => book.id === change.handbookId)?.impact;
    if (changedScope) task.scopeVersion = Number(task.scopeVersion || 0) + 1;
    const removed = impact.items.filter(item => item.operation === 'withdraw' && item.mrState === 'merged');
    task.scopeChecks ||= [];
    for (const item of removed) if (!task.scopeChecks.some(check => check.scopeChangeId === change.id && check.documentId === item.documentId)) {
      task.scopeChecks.push({ id: `scope-check-${crypto.randomUUID()}`, scopeChangeId: change.id, number: task.number, handbookId: item.handbookId,
        documentId: item.documentId, documentName: previous.handbooks.flatMap(book => book.documents || []).find(doc => (doc.createdDocumentId || doc.id) === item.documentId)?.name || item.documentId,
        reviewTaskId: item.reviewTaskId, mergeRequestIid: item.mergeRequest?.iid || null, targetCommit: item.targetCommit, reason: change.reason, status: 'pending', ownerId: task.ownerId,
        createdAt: now(), revision: 0, evidence: null });
    }
    change.status = 'confirmed'; change.confirmedAt = now(); change.confirmedBy = actor(ctx); change.impactDigest = impact.impactDigest;
    audit(state, ctx, task, 'scope_correction_confirmed', previous, task.decomposition, change.reason);
  }
  router.get('/context', route(async (req, ctx) => ({ people: ctx.people, handbooks: ctx.handbooks.map(book => ({ ...book, ownerId: ctx.people.some(p => p.id === book.ownerId) ? book.ownerId : null })), actorId: actor(ctx), canAdmin: admin(ctx), canWrite: actions(ctx).includes('knowledge:write'), config: (await read()).config })));
  router.get('/catalog', route(async (req, ctx) => {
    const id = clean(req.query.handbookId); handbook(ctx, id);
    const catalog = await ctx.catalog(id);
    if (ctx.resolveVersionMapping && req.query.ticketNumber) {
      const task = requireTask(await read(), ctx, clean(req.query.ticketNumber));
      const existingBook = task.decomposition.handbooks.find(book => book.id === id);
      const frozen = existingBook?.versionMapping;
      try {
        const rule = frozen ? { branch: frozen.targetBranch, id: frozen.mappingId, rowVersion: frozen.mappingRowVersion }
          : existingBook?.confirmed && existingBook.targetVersion ? { branch: existingBook.targetVersion }
          : await ctx.resolveVersionMapping(id, task.product, task.version);
        catalog.versionMapping = rule;
        catalog.versions = [rule.branch];
      } catch (error) {
        catalog.versionMappingError = error.message;
        catalog.versions = [];
      }
    }
    return catalog;
  }));
  router.get('/config', route(async () => (await read()).config));
  router.get('/mine', route(async (req, ctx) => mine(ctx, await read())));
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
  router.get('/:number', route(async (req, ctx, res) => {
    const started = performance.now();
    const state = ctx.preloadedTaskState || await read();
    const readMs = performance.now() - started;
    const result = project(ctx, requireTask(state, ctx, req.params.number), state.config);
    if (process.env.KC_DOCUMENT_TASK_TIMING === '1') {
      const prior = res.getHeader('Server-Timing');
      res.setHeader('Server-Timing', `${prior ? `${prior}, ` : ''}task-read;dur=${readMs.toFixed(1)}, task-project;dur=${(performance.now() - started - readMs).toFixed(1)}`);
    }
    return result;
  }));
  router.get('/:number/recovery', route(async (req, ctx) => {
    const state = await read(), task = requireTask(state, ctx, req.params.number);
    const projection = project(ctx, task, state.config);
    return { number: task.number, revision: task.revision, scopeVersion: task.scopeVersion || 0,
      documents: projection.decomposition.handbooks.flatMap(book => book.documents.map(doc => ({ handbookId: book.id, handbookName: book.name,
        documentId: doc.createdDocumentId || doc.id, documentName: doc.name, phase: doc.completion?.reviewState || doc.completion?.status,
        issue: doc.completion?.label || null, responsibleId: doc.ownerId, nextAction: doc.writingUrl || (doc.reviewTaskId ? `/knowledge-center/review?taskId=${encodeURIComponent(doc.reviewTaskId)}` : null), observedAt: doc.completion?.deliveryFailure?.at || null }))),
      scopeChanges: structuredClone(task.scopeChanges || []), scopeChecks: structuredClone(task.scopeChecks || []) };
  }));
  router.get('/review/:reviewTaskId/mention-targets', route(async (req, ctx) => {
    if (!actions(ctx).some(action => ['knowledge:write', 'review:manage'].includes(action))) fail('FORBIDDEN', '没有审核意见权限', 403);
    const state = await read();
    const matches = [];
    for (const task of state.tasks || []) {
      if (!visible(ctx, task)) continue;
      for (const book of task.decomposition?.handbooks || []) {
        if (!book.confirmed || book.impact !== 'involved' || !(book.documents || []).some(doc => doc.reviewTaskId === req.params.reviewTaskId)) continue;
        handbook(ctx, book.id);
        matches.push({ handbookId: book.id, handbookName: book.name, ownerId: book.ownerId || null,
          ownerName: ctx.people.find(person => person.id === book.ownerId)?.displayName || null, ticketNumber: task.number });
      }
    }
    const unique = [...new Map(matches.map(item => [item.handbookId, item])).values()];
    return unique;
  }));
  router.post('/:number/scope-changes', route((req, ctx) => mutate(req, ctx, state => {
    const task = requireTask(state, ctx, req.params.number); writable(ctx); revision(task, req.body);
    const level = clean(req.body.level), handbookId = clean(req.body.handbookId) || null, reasonText = clean(req.body.reason);
    if (!['ticket', 'handbook'].includes(level) || level === 'handbook' && !handbookId || !reasonText) fail('SCOPE_CHANGE_INVALID', '请选择纠偏层级并填写原因');
    if (!task.decomposition?.confirmed) fail('SCOPE_NOT_CONFIRMED', '请先确认工单手册范围后再发起纠偏', 409);
    if (level === 'ticket') owns(ctx, task.ownerId);
    else { const book = task.decomposition.handbooks.find(item => item.id === handbookId); if (!book) fail('HANDBOOK_NOT_FOUND', '手册不属于当前任务', 404); if (!book.confirmed) fail('SCOPE_NOT_CONFIRMED', '请先确认该手册范围后再发起纠偏', 409); owns(ctx, book.ownerId); }
    const affectedDocuments = req.body.affectedDocuments || [];
    if (!Array.isArray(affectedDocuments)) fail('SCOPE_CHANGE_INVALID', '受影响文档格式无效');
    const normalized = affectedDocuments.map(item => {
      const book = task.decomposition.handbooks.find(candidate => candidate.id === clean(item.handbookId));
      const doc = book?.documents.find(candidate => (candidate.createdDocumentId || candidate.id) === clean(item.documentId));
      if (!doc || level === 'handbook' && book.id !== handbookId) fail('SCOPE_DOCUMENT_INVALID', '受影响文档不属于当前有效范围');
      return { handbookId: book.id, documentId: doc.createdDocumentId || doc.id, proposalId: doc.id, blocked: true };
    });
    if (new Set(normalized.map(item => `${item.handbookId}:${item.documentId}`)).size !== normalized.length) fail('SCOPE_DOCUMENT_DUPLICATE', '受影响文档不能重复');
    const change = { id: `scope-change-${crypto.randomUUID()}`, number: task.number, level, handbookId, reason: reasonText,
      affectedDocuments: normalized, status: 'reported', createdAt: now(), createdBy: actor(ctx), baseRevision: task.revision,
      responsibleId: level === 'ticket' ? task.ownerId : task.decomposition.handbooks.find(item => item.id === handbookId).ownerId };
    task.scopeChanges ||= []; task.scopeChanges.push(change);
    audit(state, ctx, task, 'scope_correction_reported', null, change, reasonText);
    return change;
  })));
  router.post('/:number/scope-changes/:id/preview', route((req, ctx) => {
    const state = read();
    return Promise.resolve(state).then(value => {
      const task = requireTask(value, ctx, req.params.number), change = (task.scopeChanges || []).find(item => item.id === req.params.id);
      if (!change) fail('SCOPE_CHANGE_NOT_FOUND', '范围纠偏记录不存在', 404);
      if (change.level === 'ticket') owns(ctx, task.ownerId); else owns(ctx, task.decomposition.handbooks.find(item => item.id === change.handbookId)?.ownerId);
      if (!req.body.proposed || typeof req.body.proposed !== 'object') fail('SCOPE_PROPOSAL_REQUIRED', '请提供拟调整后的范围');
      const impact = scopeImpact(ctx, task, change, req.body.proposed);
      return { ...impact, changeId: change.id, operations: impact.items, blockedBy: impact.items.filter(item => !item.canConfirm) };
    });
  }));
  router.post('/:number/scope-changes/:id/confirm', route(async (req, ctx) => {
    const change = (await read()).tasks.find(item => item.number === req.params.number)?.scopeChanges?.find(item => item.id === req.params.id);
    if (!change) fail('SCOPE_CHANGE_NOT_FOUND', '范围纠偏记录不存在', 404);
    const catalog = change.level === 'handbook' ? await ctx.catalog(change.handbookId) : null;
    return mutate(req, ctx, state => {
      const task = requireTask(state, ctx, req.params.number); revision(task, req.body);
      const currentChange = (task.scopeChanges || []).find(item => item.id === req.params.id);
      if (!currentChange || currentChange.status !== 'reported') fail('SCOPE_CHANGE_NOT_ACTIVE', '纠偏请求已处理或取消', 409);
      if (currentChange.level === 'ticket') owns(ctx, task.ownerId); else owns(ctx, task.decomposition.handbooks.find(item => item.id === currentChange.handbookId)?.ownerId);
      const impact = scopeImpact(ctx, task, currentChange, req.body.proposed);
      if (req.body.impactDigest !== impact.impactDigest) fail('IMPACT_STALE', '范围影响已变化，请重新读取并预览', 409);
      if (!impact.canConfirm) {
        if (impact.items.some(item => item.mrState === 'opened')) fail('MR_OPEN', '请由发布人手动关闭受影响的打开 MR，再重新读取并预览', 409,
          { mergeRequests: impact.items.filter(item => item.mrState === 'opened').map(item => ({ handbookId: item.handbookId, documentId: item.documentId, iid: item.mergeRequest?.iid || null })) });
        fail('IMPACT_STALE', 'MR 状态未观察、观察已过期或状态未知，请刷新后重新预览', 409);
      }
      applyScopeProposal(state, ctx, task, currentChange, req.body.proposed, impact, catalog);
      return project(ctx, task, state.config);
    });
  }));
  router.post('/:number/scope-changes/:id/cancel', route((req, ctx) => mutate(req, ctx, state => {
    const task = requireTask(state, ctx, req.params.number); revision(task, req.body);
    const change = (task.scopeChanges || []).find(item => item.id === req.params.id);
    if (!change || change.status !== 'reported') fail('SCOPE_CHANGE_NOT_ACTIVE', '纠偏请求已处理或取消', 409);
    if (actor(ctx) !== change.createdBy && actor(ctx) !== change.responsibleId && !admin(ctx)) fail('FORBIDDEN', '只有发起人、当前责任人或管理员可以取消纠偏', 403);
    change.status = 'cancelled'; change.cancelledAt = now(); change.cancelledBy = actor(ctx);
    audit(state, ctx, task, 'scope_correction_cancelled', null, change, req.body.reason);
    return project(ctx, task, state.config);
  })));
  router.post('/:number/publication-checks/:id/complete', route((req, ctx) => mutate(req, ctx, state => {
    const task = requireTask(state, ctx, req.params.number), check = (task.scopeChecks || []).find(item => item.id === req.params.id);
    if (!check) fail('PUBLICATION_CHECK_NOT_FOUND', '发布内容核对事项不存在', 404);
    if (!admin(ctx) && !actions(ctx).includes('publish:manage')) fail('FORBIDDEN', '只有发布责任人或管理员可以核对已发布内容', 403);
    revision(task, req.body);
    if (req.body.conclusion === 'needs_fix') {
      check.status = 'needs_fix'; check.conclusion = 'needs_fix'; check.evidence = { note: clean(req.body.note) || null, at: now() };
      check.operatorId = actor(ctx); check.revision++;
    } else if (req.body.conclusion === 'no_repair_required') {
      if (!clean(req.body.targetCommit) || req.body.targetCommit !== check.targetCommit || req.body.bodyVerified !== true || req.body.resourcesVerified !== true) fail('PUBLICATION_EVIDENCE_REQUIRED', '无需修复须核对原目标提交、正文及图片');
      check.status = 'completed'; check.conclusion = 'no_repair_required'; check.evidence = { targetCommit: req.body.targetCommit, bodyVerified: true, resourcesVerified: true };
      check.operatorId = actor(ctx); check.completedAt = now(); check.revision++;
    } else if (req.body.conclusion === 'repair_delivered') {
      const review = ctx.reviewService.get(ctx.session, clean(req.body.reviewTaskId));
      const book = task.decomposition.handbooks.find(item => item.id === check.handbookId);
      const doc = book?.documents.find(item => (item.createdDocumentId || item.id) === check.documentId);
      if (!book || !doc || !matchesReviewScope(review, book, check.documentId) || review.completion?.status !== 'completed') fail('PUBLICATION_REPAIR_UNVERIFIED', '修复交付必须关联同手册、同文档且正文和图片回读一致的完成记录', 409);
      check.status = 'completed'; check.conclusion = 'repair_delivered'; check.reviewTaskId = review.id;
      check.evidence = { reviewTaskId: review.id, targetCommit: review.deliveryObservation?.targetCommit || null };
      check.operatorId = actor(ctx); check.completedAt = now(); check.revision++;
    } else fail('PUBLICATION_CONCLUSION_INVALID', '请选择无需修复、需要修复或修复已交付');
    audit(state, ctx, task, 'publication_check', null, check, req.body.note);
    return project(ctx, task, state.config);
  })));
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
      const ownerId = person(ctx, Object.hasOwn(b, 'ownerId') ? b.ownerId : old?.ownerId || known.ownerId, confirmed);
      return { ...(old || { impact: null, reason: null, confirmed: false, documents: [] }), id: known.id, name: known.name, ownerId };
    });
    if (new Set(books.map(b => b.id)).size !== books.length) fail('DUPLICATE_HANDBOOK', '手册不能重复');
    if (confirmed && input.ticketImpact === 'involved' && !books.length) fail('HANDBOOK_REQUIRED', '请选择至少一本手册');
    if (previous.confirmed && previous.handbooks.some(b => input.ticketImpact !== 'involved' || !books.some(next => next.id === b.id))) fail('SCOPE_WITHDRAWAL_REQUIRED', '已转交手册不能直接移除，请保留现有范围');
    const oldScope = JSON.stringify([previous.ticketImpact, previous.handbooks.map(b => b.id).sort()]);
    const newScope = JSON.stringify([input.ticketImpact || null, input.ticketImpact === 'involved' ? books.map(b => b.id).sort() : []]);
    if (oldScope !== newScope) task.scopeVersion = Number(task.scopeVersion || 0) + 1;
    task.decomposition = { ticketImpact: input.ticketImpact || null, ticketReason: input.ticketImpact === 'not_involved' ? reason(state.config, input.reasonId, input.reasonDetail, confirmed) : null, confirmed, handbooks: input.ticketImpact === 'involved' ? books : [] };
    if (confirmed && !task.startTime) task.startTime = now();
    audit(state, ctx, task, 'ticket_scope', previous, task.decomposition, input.reason); return project(ctx, task, state.config);
  })));
  router.put('/:number/handbooks/:id', route(async (req, ctx) => {
    const catalog = await ctx.catalog(req.params.id);
    let resolved = null;
    if (ctx.resolveVersionMapping && req.body.confirm === true && req.body.impact === 'involved') {
      const task = requireTask(await read(), ctx, req.params.number);
      const existingBook = task.decomposition.handbooks.find(item => item.id === req.params.id);
      resolved = existingBook?.confirmed && existingBook.versionMapping
        ? { id: existingBook.versionMapping.mappingId, rowVersion: existingBook.versionMapping.mappingRowVersion,
            connectionId: existingBook.versionMapping.connectionId, branch: existingBook.versionMapping.targetBranch }
        : existingBook?.confirmed && existingBook.targetVersion ? null
        : await ctx.resolveVersionMapping(req.params.id, task.product, task.version);
    }
    return mutate(req, ctx, state => {
      const task = requireTask(state, ctx, req.params.number); revision(task, req.body);
      const book = task.decomposition.handbooks.find(b => b.id === req.params.id);
      if (!book || !task.decomposition.confirmed) fail('TICKET_SCOPE_REQUIRED', '请先由工单责任人确认手册范围');
      owns(ctx, book.ownerId);
      const input = { ...req.body, ...(resolved ? { targetVersion: resolved.branch } : {}) }, confirmed = input.confirm === true, previous = structuredClone(book);
      task.scopeHistory ||= []; task.scopeHistory.push(previous);
      if (input.impact && !['involved', 'not_involved'].includes(input.impact)) fail('IMPACT_INVALID', '范围判断无效');
      if (confirmed && !input.impact) fail('IMPACT_REQUIRED', '请选择本手册是否涉及文档');
      if (input.targetVersion && !catalog.versions.includes(input.targetVersion) && resolved?.branch !== input.targetVersion && !(previous.confirmed && previous.targetVersion === input.targetVersion)) fail('VERSION_INVALID', '请选择该手册真实目标版本');
      const scopeChanged = previous.impact !== (input.impact || null) || previous.targetVersion !== (input.targetVersion || null);
      const documents = (input.documents || []).map(d => {
        const id = clean(d.id), kind = d.kind === 'new' ? 'new' : 'existing';
        if (!id) fail('DOCUMENT_REQUIRED', '文档必须有稳定编号');
        if (kind === 'existing' && !catalog.outlineVersionId) fail('OUTLINE_PUBLISH_REQUIRED', '请先发布手册大纲，再选择存量文档', 409);
        if (kind === 'existing' && !catalog.documents.some(x => x.id === id)) fail('DOCUMENT_INVALID', '文档不属于所选手册');
        if (kind === 'new' && (!clean(d.name) || !catalog.chapters.some(c => c.id === d.parentId))) fail('NEW_DOCUMENT_INVALID', '新增文档需要名称与有效章节');
        const previousDoc = book.documents.find(x => x.id === id);
        const old = previousDoc && previousDoc.kind === kind && (kind !== 'new' || previousDoc.name === clean(d.name) && previousDoc.parentId === d.parentId) ? previousDoc : null;
        const catalogOwner = kind === 'existing' ? catalog.documents.find(x => x.id === id)?.ownerId : null;
        const candidate = ctx.people.some(p => p.id === catalogOwner) ? catalogOwner : null;
        const selectedOwner = Object.hasOwn(d, 'ownerId') ? d.ownerId : old?.ownerId || candidate;
        const ownerId = person(ctx, selectedOwner, confirmed);
        const changed = scopeChanged && old?.reviewTaskId;
        return { ...(old || {}), id, kind, name: kind === 'new' ? clean(d.name) : catalog.documents.find(x => x.id === id).name,
          parentId: kind === 'new' ? d.parentId : null, ownerId,
          scopeVersion: changed ? Number(old.scopeVersion || 1) + 1 : Number(old?.scopeVersion || 1),
          ...(changed ? { reviewTaskId: null, linkedScopeVersion: null } : {}) };
      });
      if (new Set(documents.map(d => d.id)).size !== documents.length) fail('DOCUMENT_DUPLICATE', '文档不能重复');
      if (confirmed && input.impact === 'involved' && (!documents.length || !input.targetVersion)) fail('DOCUMENT_SCOPE_REQUIRED', '涉及文档时请选择文档、负责人和真实目标版本');
      if (previous.confirmed && previous.documents.some(d => input.impact !== 'involved' || !documents.some(next => next.id === d.id))) fail('SCOPE_WITHDRAWAL_REQUIRED', '已分派文档不能直接移除，请保留现有范围');
      if (confirmed && input.impact === 'involved' && task.decomposition.handbooks.some(item => item.confirmed && (item.documents || []).some(document => !document.subtaskNumber))) fail('MIGRATION_REQUIRED', '旧文档任务需先完成编号预检与回填', 409);
      if (confirmed && input.impact === 'involved') assignSubtaskNumbers(task, documents);
      const docScope = list => list.map(doc => [doc.id, doc.kind, doc.kind === 'new' ? doc.name : null, doc.parentId || null]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      const oldScope = JSON.stringify([previous.impact, previous.targetVersion, docScope(previous.documents || [])]);
      const newScope = JSON.stringify([input.impact || null, input.targetVersion || null, input.impact === 'involved' ? docScope(documents) : []]);
      Object.assign(book, { impact: input.impact || null, reason: input.impact === 'not_involved' ? reason(state.config, input.reasonId, input.reasonDetail, confirmed) : null, confirmed, targetVersion: input.targetVersion || null, documents: input.impact === 'involved' ? documents : [], ...(resolved ? { versionMapping: previous.versionMapping || { mappingId: resolved.id, mappingRowVersion: resolved.rowVersion, connectionId: resolved.connectionId, businessProduct: task.product, businessVersion: task.version, targetBranch: resolved.branch, confirmedAt: now() } } : {}) });
      if (oldScope !== newScope) book.scopeVersion = Number(previous.scopeVersion || 0) + 1;
      const activeNumbers = task.decomposition.handbooks.flatMap(item => item.documents || []).map(item => item.subtaskNumber).filter(Boolean);
      if (new Set(activeNumbers).size !== activeNumbers.length) fail('SUBTASK_NUMBER_CONFLICT', '同一工单的子任务编号重复', 409);
      audit(state, ctx, task, 'handbook_scope', previous, book, input.reason); return project(ctx, task, state.config);
    });
  }));
  router.get('/:number/reviews', route(async (req, ctx) => {
    const state = await read(), task = requireTask(state, ctx, req.params.number);
    const book = task.decomposition.handbooks.find(b => b.id === req.query.handbookId);
    const doc = book?.documents.find(d => d.id === req.query.documentId);
    if (!doc) fail('DOCUMENT_NOT_FOUND', '文档不属于当前任务');
    const documentId = doc.createdDocumentId || doc.id;
    return ctx.reviewService.list(ctx.session, { handbookId: book.id }).map(summary => ctx.reviewService.get(ctx.session, summary.id)).filter(review => matchesReviewScope(review, book, documentId)).map(review => ({ id: review.id, name: review.name || review.title, state: review.state }));
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
    if (!matchesReviewScope(review, book, documentId)) fail('REVIEW_SCOPE_MISMATCH', '审核任务的手册、文档或目标分支不一致');
      const previous = doc.reviewTaskId; doc.reviewTaskId = review.id; doc.linkedScopeVersion = Number(doc.scopeVersion || 1);
      audit(state, ctx, task, 'review_link', previous, { handbookId: book.id, documentId, reviewTaskId: review.id, scopeVersion: doc.linkedScopeVersion }); return project(ctx, task, state.config);
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
  router.readState = read;
  return router;
}
function createDocumentTaskHandler(options = {}) {
  const router = createDocumentTaskRouter(options);
  const app = express(); app.disable('x-powered-by'); app.use('/', router);
  const handler = (req, res, context) => { req[CONTEXT] = context; req.url = req.url.slice('/knowledge-center/api/document-tasks'.length) || '/'; if (req.url.startsWith('?')) req.url = `/${req.url}`; app(req, res); };
  handler.store = router.store;
  handler.readState = router.readState;
  return handler;
}
module.exports = createDocumentTaskRouter;
Object.assign(module.exports, { createDocumentTaskRouter, createDocumentTaskHandler, emptyState, project, preview, mine });
