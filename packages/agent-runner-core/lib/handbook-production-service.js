const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createAggregateStore } = require('./aggregate-store');
const { AGENT_RUNNER_RUNTIME_ROOT } = require('./repo-paths');

const IMAGE_TYPES = new Map([
  ['image/png', { extensions: ['.png'], limit: 10 * 1024 * 1024 }],
  ['image/jpeg', { extensions: ['.jpg', '.jpeg'], limit: 10 * 1024 * 1024 }],
  ['image/webp', { extensions: ['.webp'], limit: 10 * 1024 * 1024 }],
  ['image/gif', { extensions: ['.gif'], limit: 10 * 1024 * 1024 }],
]);
const DOCUMENT_TYPES = new Map([
  ['text/markdown', { extensions: ['.md', '.markdown'], limit: 50 * 1024 * 1024 }],
  ['application/pdf', { extensions: ['.pdf'], limit: 50 * 1024 * 1024 }],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', { extensions: ['.docx'], limit: 50 * 1024 * 1024 }],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', { extensions: ['.xlsx'], limit: 50 * 1024 * 1024 }],
]);
const DRAFT_TOTAL_LIMIT = 200 * 1024 * 1024;

class HandbookProductionError extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function digest(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function normalizeMarkdown(value) {
  return String(value || '').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n*$/, '\n');
}

function sanitizeHtml(value) {
  return String(value || '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form|input|button|meta|link)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|form|input|button|meta|link)\b[^>]*\/?\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:href|src)\s*=\s*(["'])\s*(?:javascript|vbscript):[\s\S]*?\1/gi, '')
    .replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
}

function actor(session = {}) {
  const user = session.user || session;
  return {
    id: String(user.principalId || user.id || user.userId || user.loginName || 'unknown'),
    displayName: String(user.displayName || user.name || user.loginName || '未知用户'),
  };
}

function capabilities(session = {}) {
  const roles = new Set(session.user?.roles || session.roles || []);
  const actions = new Set(session.allowedActions || session.user?.allowedActions || []);
  const canEdit = roles.has('PLATFORM_ADMIN') || actions.has('knowledge:write');
  return {
    canRead: roles.has('PLATFORM_ADMIN') || actions.has('knowledge:read') || canEdit,
    canEdit,
    canUploadAttachment: canEdit,
    canViewHistory: roles.has('PLATFORM_ADMIN') || actions.has('knowledge:read') || canEdit,
    canRestore: canEdit,
    canSubmitReview: canEdit,
  };
}

function requireCapability(session, name) {
  const projected = capabilities(session);
  if (!projected[name]) throw new HandbookProductionError('HANDBOOK_PRODUCTION_FORBIDDEN', '当前用户无权执行此操作', 403, { requiredCapability: name });
  return projected;
}

function context(input = {}) {
  const result = {
    handbookId: String(input.handbookId || '').trim(),
    outlineVersionId: String(input.outlineVersionId || '').trim(),
    branch: String(input.branch || '').trim(),
    documentId: String(input.documentId || '').trim(),
  };
  for (const [key, value] of Object.entries(result)) {
    if (!value) throw new HandbookProductionError('DRAFT_CONTEXT_REQUIRED', `缺少草稿上下文：${key}`, 400, { field: key });
  }
  return result;
}

function contextKey(input) {
  const value = context(input);
  return [value.handbookId, value.outlineVersionId, value.branch, value.documentId].map(encodeURIComponent).join('|');
}

function randomId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function attachmentRule(mimeType, fileName) {
  const normalizedMime = String(mimeType || '').split(';')[0].trim().toLowerCase();
  const rule = IMAGE_TYPES.get(normalizedMime) || DOCUMENT_TYPES.get(normalizedMime);
  const extension = path.extname(String(fileName || '')).toLowerCase();
  if (!rule || !rule.extensions.includes(extension)) {
    throw new HandbookProductionError('ATTACHMENT_TYPE_NOT_ALLOWED', '附件类型不受支持，或文件扩展名与内容类型不一致', 415);
  }
  return { ...rule, mimeType: normalizedMime, kind: IMAGE_TYPES.has(normalizedMime) ? 'image' : 'document', extension };
}

function defaultState() {
  return { schemaVersion: 1, drafts: {}, attachments: {}, reviewBatches: [], idempotency: {}, audits: [] };
}

function createHandbookProductionService(options = {}) {
  const store = options.store || createAggregateStore({
    namespace: 'handbook-production',
    key: 'state',
    filePath: options.filePath || path.join(AGENT_RUNNER_RUNTIME_ROOT, 'handbook-production', 'state.json'),
    emptyValue: defaultState(),
  });
  const attachmentRoot = options.attachmentRoot || path.join(AGENT_RUNNER_RUNTIME_ROOT, 'handbook-production', 'attachments');
  const aiArtifactStore = options.aiArtifactStore || require('./production-ai-artifact-store').createProductionAIArtifactStore({
    filePath: options.aiArtifactFilePath || (store.filePath ? `${store.filePath}.artifacts` : undefined),
  });

  // 审核任务保存在增量构建服务中；草稿只保存任务引用。读取草稿时
  // 回读任务投影，避免页面继续显示“审核中”而实际任务已经退回。
  function projectReviewState(reviewState, draft, session, snapshot) {
    if (!reviewState?.taskId || !options.reviewService?.get) return reviewState || null;
    try {
      const task = options.reviewService.get(session, reviewState.taskId, snapshot);
      const review = (task.reviews || []).find(item => String(item.documentId || '') === String(draft.context?.documentId || ''));
      return {
        ...reviewState,
        taskState: task.state || null,
        reviewStatus: review?.status || null,
        completion: task.completion ? { status: task.completion.status, label: task.completion.label } : null,
        reviewDecision: review?.decision ? structuredClone(review.decision) : null,
      };
    } catch (_) {
      // 审核任务暂时不可读时保留草稿中的最后已知引用，不阻断正文读取。
      return reviewState || null;
    }
  }

  function projectDraft(draft, session, reviewStateProjection) {
    if (!draft) return { exists: false, draft: null, capabilities: capabilities(session) };
    const revision = draft.revisions.find(item => item.revisionId === draft.currentRevisionId) || null;
    return {
      exists: true,
      draft: {
        draftId: draft.draftId,
        ...draft.context,
        currentRevisionId: draft.currentRevisionId,
        editVersion: draft.editVersion,
        reviewRevisionIds: draft.reviewRevisionIds || [],
        reviewState: reviewStateProjection === undefined
          ? projectReviewState(draft.reviewState, draft, session)
          : reviewStateProjection,
        revision,
        updatedBy: draft.updatedBy,
        updatedAt: draft.updatedAt,
      },
      capabilities: capabilities(session),
    };
  }

  function getDraft(input, session) {
    requireCapability(session, 'canRead');
    const state = store.read();
    return projectDraft(state.drafts?.[contextKey(input)] || null, session);
  }

  async function getDraftAsync(input, session) {
    requireCapability(session, 'canRead');
    const key = contextKey(input);
    const draft = typeof store.readDraftAsync === 'function'
      ? await store.readDraftAsync(key)
      : (typeof store.readAsync === 'function' ? await store.readAsync() : store.read()).drafts?.[key];
    let reviewState = draft?.reviewState || null;
    if (reviewState?.taskId && options.reviewService?.readState) {
      try {
        const snapshot = await options.reviewService.readState(session);
        reviewState = projectReviewState(reviewState, draft, session, snapshot);
      } catch (_) {
        // Keep the last known reference when the review snapshot is unavailable.
      }
    } else if (reviewState?.taskId) {
      reviewState = projectReviewState(reviewState, draft, session);
    }
    return projectDraft(draft || null, session, reviewState);
  }

  function listReviewDrafts(handbookId, session) {
    requireCapability(session, 'canRead');
    return Object.values(store.read().drafts || {})
      .filter(draft => String(draft.context?.handbookId) === String(handbookId))
      .map(draft => {
        const revision = draft.revisions.find(item => item.revisionId === draft.currentRevisionId);
        return revision ? { ...draft.context, draftRevisionId: revision.revisionId, editVersion: revision.version, updatedAt: draft.updatedAt, reviewState: draft.reviewState || null } : null;
      }).filter(Boolean);
  }

  function saveDraft(input, session, idempotencyKey) {
    return store.transaction(state => saveDraftInState(state, input, session, idempotencyKey));
  }

  function saveDraftInState(state, input, session, idempotencyKey) {
    requireCapability(session, 'canEdit');
    const ctx = context(input);
    if (!idempotencyKey) throw new HandbookProductionError('IDEMPOTENCY_KEY_REQUIRED', '保存草稿需要幂等键', 400);
    const normalizedMarkdown = normalizeMarkdown(input.markdown);
    const normalizedHtml = sanitizeHtml(input.htmlSnapshot);
    const who = actor(session);
    const now = new Date().toISOString();
      state.drafts ||= {};
      state.attachments ||= {};
      state.idempotency ||= {};
      if (state.idempotency[idempotencyKey]) return state.idempotency[idempotencyKey];
      const key = contextKey(ctx);
      let draft = state.drafts[key];
      const expected = Number(input.editVersion || 0);
      const currentVersion = Number(draft?.editVersion || 0);
      if (expected !== currentVersion) {
        throw new HandbookProductionError('DRAFT_VERSION_CONFLICT', '共享草稿已被其他用户更新，请比较后处理', 409, {
          expectedEditVersion: expected,
          currentEditVersion: currentVersion,
          serverDraft: projectDraft(draft, session).draft,
        });
      }
      const attachmentIds = [...new Set((input.attachmentIds || []).map(String))];
      const attachments = attachmentIds.map(id => state.attachments[id]).filter(Boolean);
      if (attachments.length !== attachmentIds.length || attachments.some(item => item.status !== 'ready')) {
        throw new HandbookProductionError('ATTACHMENT_NOT_READY', '存在未完成或无效的附件，暂不能保存草稿', 409);
      }
      const totalBytes = attachments.reduce((sum, item) => sum + Number(item.size || 0), 0);
      if (totalBytes > DRAFT_TOTAL_LIMIT) throw new HandbookProductionError('DRAFT_ATTACHMENT_TOTAL_EXCEEDED', '单个草稿附件总量不能超过 200MB', 413);
      if (attachments.some(item => item.contextKey !== key)) {
        throw new HandbookProductionError('ATTACHMENT_CONTEXT_MISMATCH', '附件不属于当前文档草稿', 409);
      }
      if (!draft) {
        draft = { draftId: randomId('draft'), context: ctx, editVersion: 0, currentRevisionId: null, reviewRevisionIds: [], revisions: [] };
        state.drafts[key] = draft;
      }
      const revision = {
        revisionId: randomId('revision'),
        version: currentVersion + 1,
        markdown: normalizedMarkdown,
        htmlSnapshot: normalizedHtml,
        baselineDigest: String(input.baselineDigest || ''),
        contentDigest: digest(normalizedMarkdown),
        templateVersionId: input.templateVersionId ? String(input.templateVersionId) : null,
        attachmentIds,
        createdBy: who,
        createdAt: now,
        immutable: true,
      };
      const previous = draft.revisions.find(item => item.revisionId === draft.currentRevisionId);
      if (previous?.generationMetadata) {
        revision.generationMetadata = structuredClone(previous.generationMetadata);
        revision.generationMetadata.inheritedFromRevisionId = previous.revisionId;
        if (previous.contentDigest !== revision.contentDigest) {
          const metadata = revision.generationMetadata;
          metadata.provenanceHistory = [...(metadata.provenanceHistory || []), {
            revisionId: previous.revisionId, contentDigest: previous.contentDigest, provenance: metadata.provenance,
          }];
          metadata.provenance = require('./production-ai-provenance').humanChanges(previous.markdown, normalizedMarkdown, metadata.provenance);
          metadata.verification = 'needs_revalidation';
          metadata.humanEdited = true;
          metadata.lastHumanEdit = { actor: who, at: now, contentDigest: revision.contentDigest };
        }
      }
      draft.revisions.push(revision);
      draft.currentRevisionId = revision.revisionId;
      draft.editVersion = revision.version;
      draft.updatedBy = who;
      draft.updatedAt = now;
      attachments.forEach(item => { item.boundDraftId = draft.draftId; item.boundRevisionId = revision.revisionId; item.updatedAt = now; });
      const result = projectDraft(draft, session);
      state.idempotency[idempotencyKey] = result;
      state.audits ||= [];
      state.audits.push({ action: 'DRAFT_SAVED', draftId: draft.draftId, revisionId: revision.revisionId, actor: who, at: now });
      return result;
  }

  function listRevisions(input, session) {
    requireCapability(session, 'canViewHistory');
    const state = store.read();
    const draft = state.drafts?.[contextKey(input)];
    return { items: [...(draft?.revisions || [])].reverse(), capabilities: capabilities(session) };
  }

  function restoreRevision(input, session, idempotencyKey) {
    requireCapability(session, 'canRestore');
    const ctx = context(input);
    if (!idempotencyKey) throw new HandbookProductionError('IDEMPOTENCY_KEY_REQUIRED', '恢复草稿需要幂等键', 400);
    return store.transaction(state => {
      state.idempotency ||= {};
      if (state.idempotency[idempotencyKey]) return state.idempotency[idempotencyKey];
      const draft = state.drafts?.[contextKey(ctx)];
      if (!draft) throw new HandbookProductionError('DRAFT_NOT_FOUND', '草稿不存在', 404);
      if (Number(input.editVersion) !== Number(draft.editVersion)) throw new HandbookProductionError('DRAFT_VERSION_CONFLICT', '共享草稿已变化，请刷新历史记录', 409, { serverDraft: projectDraft(draft, session).draft });
      const source = draft.revisions.find(item => item.revisionId === String(input.revisionId));
      if (!source) throw new HandbookProductionError('DRAFT_REVISION_NOT_FOUND', '要恢复的草稿版本不存在', 404);
      const who = actor(session); const now = new Date().toISOString();
      const revision = { ...source, revisionId: randomId('revision'), version: draft.editVersion + 1, restoredFromRevisionId: source.revisionId, createdBy: who, createdAt: now };
      draft.revisions.push(revision); draft.currentRevisionId = revision.revisionId; draft.editVersion = revision.version; draft.updatedBy = who; draft.updatedAt = now;
      const result = projectDraft(draft, session); state.idempotency[idempotencyKey] = result;
      state.audits.push({ action: 'DRAFT_RESTORED', draftId: draft.draftId, revisionId: revision.revisionId, restoredFromRevisionId: source.revisionId, actor: who, at: now });
      return result;
    });
  }

  function stageAttachment(input, buffer, session) {
    requireCapability(session, 'canUploadAttachment');
    const ctx = context(input);
    const rule = attachmentRule(input.mimeType, input.fileName);
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new HandbookProductionError('ATTACHMENT_EMPTY', '附件内容为空', 400);
    if (buffer.length > rule.limit) throw new HandbookProductionError('ATTACHMENT_TOO_LARGE', `该附件不能超过 ${rule.limit / 1024 / 1024}MB`, 413);
    const attachmentId = randomId('attachment');
    const safeName = `${attachmentId}${rule.extension}`;
    fs.mkdirSync(attachmentRoot, { recursive: true });
    const target = path.join(attachmentRoot, safeName);
    const temporary = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, buffer, { mode: 0o600 });
    fs.renameSync(temporary, target);
    const who = actor(session); const now = new Date().toISOString();
    const metadata = {
      attachmentId, contextKey: contextKey(ctx), ...ctx,
      fileName: path.basename(String(input.fileName)), mimeType: rule.mimeType, kind: rule.kind,
      size: buffer.length, digest: crypto.createHash('sha256').update(buffer).digest('hex'),
      status: 'ready', scanStatus: 'validated', stableReference: `/knowledge-center/api/production/attachments/${attachmentId}`,
      storageName: safeName, createdBy: who, createdAt: now, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    store.transaction(state => { state.attachments ||= {}; state.attachments[attachmentId] = metadata; return metadata; });
    return metadata;
  }

  function readAttachment(attachmentId, session) {
    requireCapability(session, 'canRead');
    const state = store.read();
    const metadata = state.attachments?.[String(attachmentId)];
    if (!metadata || metadata.status !== 'ready') throw new HandbookProductionError('ATTACHMENT_NOT_FOUND', '附件不存在或尚未就绪', 404);
    const filePath = path.resolve(attachmentRoot, metadata.storageName);
    if (!filePath.startsWith(`${path.resolve(attachmentRoot)}${path.sep}`) || !fs.existsSync(filePath)) {
      throw new HandbookProductionError('ATTACHMENT_NOT_FOUND', '附件内容不存在', 404);
    }
    return { metadata, buffer: fs.readFileSync(filePath) };
  }

  function createReviewBatch(input, session, idempotencyKey, eligibleReviewers = []) {
    requireCapability(session, 'canSubmitReview');
    if (!idempotencyKey) throw new HandbookProductionError('IDEMPOTENCY_KEY_REQUIRED', '提交评审需要幂等键', 400);
    const handbookId = String(input.handbookId || '').trim();
    const submittedBy = actor(session);
    const eligibleIds = new Set(eligibleReviewers.map(item => String(item.id || item.principalId || item.userId)));
    const documents = Array.isArray(input.documents) ? input.documents : [];
    if (!handbookId || !documents.length) throw new HandbookProductionError('REVIEW_DOCUMENT_REQUIRED', '至少选择一篇已保存文档', 400);
    return store.transaction(state => {
      state.idempotency ||= {};
      if (state.idempotency[idempotencyKey]) return state.idempotency[idempotencyKey];
      const resolved = documents.map(item => {
        const ctx = context({ handbookId, ...item });
        const draft = state.drafts?.[contextKey(ctx)];
        if (!draft) throw new HandbookProductionError('DRAFT_NOT_FOUND', '所选文档没有共享草稿', 409, { documentId: ctx.documentId });
        const revision = draft.revisions.find(entry => entry.revisionId === String(item.draftRevisionId));
        if (!revision || revision.revisionId !== draft.currentRevisionId) throw new HandbookProductionError('REVIEW_REVISION_STALE', '所选草稿版本不是当前已保存版本', 409, { documentId: ctx.documentId });
        const reviewerIds = [...new Set((item.reviewerIds || input.defaultReviewerIds || []).map(String))]
          .filter(id => id && eligibleIds.has(id));
        if (!reviewerIds.length) throw new HandbookProductionError('REVIEWER_REQUIRED', '每篇文档至少需要一名有审核权限的审核人', 422, { documentId: ctx.documentId });
        return { ctx, draft, revision, reviewerIds };
      });
      const now = new Date().toISOString(); const batchId = randomId('review-batch');
      const batch = {
        batchId, handbookId, note: String(input.note || ''), submittedBy, submittedAt: now, state: 'in_review',
        documents: resolved.map(({ ctx, draft, revision, reviewerIds }) => ({ documentId: ctx.documentId, outlineVersionId: ctx.outlineVersionId, branch: ctx.branch, draftId: draft.draftId, draftRevisionId: revision.revisionId, reviewerIds, reviewId: randomId('review'), state: 'pending' })),
      };
      resolved.forEach(({ draft, revision }) => {
        draft.reviewRevisionIds ||= []; draft.reviewRevisionIds.push(revision.revisionId); draft.reviewState = { state: 'in_review', revisionId: revision.revisionId, batchId };
        const next = { ...revision, revisionId: randomId('revision'), version: draft.editVersion + 1, clonedFromRevisionId: revision.revisionId, createdBy: submittedBy, createdAt: now };
        draft.revisions.push(next); draft.currentRevisionId = next.revisionId; draft.editVersion = next.version; draft.updatedBy = submittedBy; draft.updatedAt = now;
      });
      state.reviewBatches ||= []; state.reviewBatches.push(batch); state.idempotency[idempotencyKey] = batch;
      state.audits ||= []; state.audits.push({ action: 'REVIEW_BATCH_CREATED', batchId, actor: submittedBy, at: now });
      return batch;
    });
  }

  function linkIncrementalReview(input, session) {
    requireCapability(session, 'canSubmitReview');
    return store.transaction(state => {
      const draft = state.drafts?.[contextKey(input)];
      const revision = draft?.revisions.find(item => item.revisionId === input.draftRevisionId);
      if (!revision) throw new HandbookProductionError('REVIEW_REVISION_STALE', '草稿修订不存在', 409);
      draft.reviewRevisionIds ||= [];
      if (!draft.reviewRevisionIds.includes(revision.revisionId)) draft.reviewRevisionIds.push(revision.revisionId);
      draft.reviewState = { state: 'in_review', revisionId: revision.revisionId, editVersion: revision.version, taskId: input.taskId, reviewHref: input.reviewHref };
      return draft.reviewState;
    });
  }

  const configuredStageAdapters = require('./production-ai-http-stage-adapters').createProductionAIHttpStageAdapters({ env: options.aiStageAdapterEnv });
  const ai = require('./production-ai-service').createProductionAIService({
    ...options.ai,
    stageAdapters: { ...configuredStageAdapters, ...(options.ai?.stageAdapters || {}) },
    store, artifactStore: aiArtifactStore, saveDraftInState, context, contextKey, actor, requireCapability,
    ErrorType: HandbookProductionError,
  });
  if (options.autoRecoverOnStart) {
    queueMicrotask(() => {
      try { ai.recoverOnStartup(); } catch (_) { /* startup recovery must not block service creation */ }
    });
  }
  const configuredRecoveryInterval = options.recoveryIntervalMs ?? process.env.KNOWLEDGE_PRODUCTION_RECOVERY_INTERVAL_MS;
  const recoveryIntervalMs = Number(configuredRecoveryInterval || 0);
  let recoveryTimer = null;
  let recoveryRunning = false;
  const stopRecoveryScheduler = () => {
    if (recoveryTimer) clearInterval(recoveryTimer);
    recoveryTimer = null;
  };
  const runRecoveryTick = () => {
    if (recoveryRunning) return;
    recoveryRunning = true;
    Promise.resolve().then(() => ai.recover()).catch(() => {}).finally(() => { recoveryRunning = false; });
  };
  if (Number.isFinite(recoveryIntervalMs) && recoveryIntervalMs > 0) {
    recoveryTimer = setInterval(runRecoveryTick, recoveryIntervalMs);
    recoveryTimer.unref?.();
  }
  const quality = require('./production-quality-service').createProductionQualityService({
    store, yashanDB: options.yashanDB, skills: options.qualitySkills, now: options.now, actor, requireCapability, contextKey,
    contentQuality: options.contentQuality,
  });
  const delivery = require('./production-resource-delivery').createProductionResourceDelivery({
    root: options.deliveryResourceRoot || path.join(attachmentRoot, 'delivery-images'),
    readAttachment,
    readSourceImage: (input, session) => ai.sources.readImage(input, session),
  });
  return { getDraft, getDraftAsync, listReviewDrafts, saveDraft, listRevisions, restoreRevision, stageAttachment, readAttachment, createReviewBatch, linkIncrementalReview, capabilities, attachmentRoot, ai, quality, delivery, stopRecoveryScheduler };
}

module.exports = {
  HandbookProductionError,
  createHandbookProductionService,
  normalizeMarkdown,
  sanitizeHtml,
  contextKey,
  IMAGE_TYPES,
  DOCUMENT_TYPES,
  DRAFT_TOTAL_LIMIT,
};
