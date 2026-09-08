const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const OPERATIONS = new Set(['add', 'update', 'delete', 'move']);
const EDITABLE_STATES = new Set(['draft', 'editing', 'checked']);

class IncrementalBuildError extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function identifier(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
}

function now() {
  return new Date().toISOString();
}

function actor(session) {
  const user = session?.user || session || {};
  return { id: user.id || user.loginName || 'unknown', displayName: user.displayName || user.loginName || '未知用户' };
}

function actions(session) {
  return new Set(session?.allowedActions || session?.user?.allowedActions || []);
}

function hasAction(session, action) {
  return actions(session).has(action);
}

function requireAnyAction(session, allowed) {
  if (!allowed.some(action => hasAction(session, action))) {
    throw new IncrementalBuildError('ACTION_FORBIDDEN', '当前用户无权执行该操作', 403, { requiredAnyAction: allowed });
  }
}

function requireAction(session, action) {
  if (!actions(session).has(action)) {
    throw new IncrementalBuildError('ACTION_FORBIDDEN', `当前用户缺少 ${action} 权限`, 403, { requiredAction: action });
  }
}

function required(value, field, message) {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
    throw new IncrementalBuildError('VALIDATION_FAILED', message || `${field} 不能为空`, 422, { field });
  }
}

function operationErrors(operation, index) {
  const errors = [];
  const field = name => `operations[${index}].${name}`;
  if (!OPERATIONS.has(operation?.type)) errors.push({ field: field('type'), message: '操作类型无效' });
  if (!operation?.documentId) errors.push({ field: field('documentId'), message: '必须指定目标文档' });
  if (!operation?.nodeId) errors.push({ field: field('nodeId'), message: '必须指定稳定节点' });
  if (['update', 'delete', 'move'].includes(operation?.type) && !operation.beforeDigest) errors.push({ field: field('beforeDigest'), message: '必须记录变更前指纹' });
  if (['add', 'update'].includes(operation?.type) && operation.after === undefined && !operation.contentRef) errors.push({ field: field('after'), message: '必须记录变更后内容或 contentRef' });
  if (operation?.type === 'move') {
    if (!operation.targetParentId) errors.push({ field: field('targetParentId'), message: '移动操作必须指定目标父节点' });
    if (!Number.isInteger(operation.ordinal) || operation.ordinal < 0) errors.push({ field: field('ordinal'), message: '移动操作必须指定非负整数顺序' });
  }
  return errors;
}

class FileIncrementalBuildRepository {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.lockPath = `${filePath}.lock`;
    this.lockTimeoutMs = Number(options.lockTimeoutMs || 2000);
    this.lockRetryMs = Number(options.lockRetryMs || 10);
  }

  empty() {
    return { schemaVersion: 1, tasks: [], publishedVersions: [], idempotency: {}, audits: [] };
  }

  readUnlocked() {
    if (!fs.existsSync(this.filePath)) return this.empty();
    try {
      return { ...this.empty(), ...JSON.parse(fs.readFileSync(this.filePath, 'utf8')) };
    } catch (error) {
      const backup = `${this.filePath}.bak`;
      if (!fs.existsSync(backup)) throw new IncrementalBuildError('INCREMENTAL_STORE_CORRUPTED', '增量构建数据损坏且无可用备份', 500);
      return { ...this.empty(), ...JSON.parse(fs.readFileSync(backup, 'utf8')) };
    }
  }

  read() {
    return this.readUnlocked();
  }

  acquireLock() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const deadline = Date.now() + this.lockTimeoutMs;
    while (true) {
      try { return fs.openSync(this.lockPath, 'wx'); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (Date.now() >= deadline) throw new IncrementalBuildError('INCREMENTAL_STORE_BUSY', '增量构建数据正在被其他请求更新', 409);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, this.lockRetryMs);
      }
    }
  }

  writeUnlocked(state) {
    let temporary;
    try {
      temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      if (fs.existsSync(this.filePath)) fs.copyFileSync(this.filePath, `${this.filePath}.bak`);
      fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
      fs.renameSync(temporary, this.filePath);
    } finally {
      if (temporary && fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }

  transaction(mutator) {
    const lock = this.acquireLock();
    try {
      const state = this.readUnlocked();
      const result = mutator(state);
      this.writeUnlocked(state);
      return result;
    } finally {
      fs.closeSync(lock);
      try { fs.unlinkSync(this.lockPath); } catch (_) {}
    }
  }

  write(state) {
    return this.transaction(current => {
      Object.keys(current).forEach(key => delete current[key]);
      Object.assign(current, structuredClone(state));
      return state;
    });
  }
}

class MemoryIncrementalBuildRepository {
  constructor(initial) {
    this.state = initial || { schemaVersion: 1, tasks: [], publishedVersions: [], idempotency: {}, audits: [] };
  }
  read() { return structuredClone(this.state); }
  write(state) { this.state = structuredClone(state); }
  transaction(mutator) {
    const state = structuredClone(this.state);
    const result = mutator(state);
    this.state = structuredClone(state);
    return structuredClone(result);
  }
}

class RepositoryBaselineProvider {
  list(state, query = {}) {
    return state.publishedVersions.filter(item => (!query.handbookId || item.handbookId === query.handbookId)
      && (!query.businessVersion || item.businessVersion === query.businessVersion));
  }

  require(state, baselineVersionId, handbookId, businessVersion, requireCurrent = true) {
    const baseline = state.publishedVersions.find(item => item.id === baselineVersionId
      && item.handbookId === handbookId && item.businessVersion === businessVersion);
    if (!baseline) throw new IncrementalBuildError('BASELINE_NOT_FOUND', '未找到与手册和业务版本匹配的已发布基线', 422);
    if (requireCurrent && baseline.current !== true) {
      const current = state.publishedVersions.find(item => item.handbookId === handbookId && item.businessVersion === businessVersion && item.current === true);
      throw new IncrementalBuildError('BASELINE_CONFLICT', '基线已不是当前发布版本', 409, { expected: baselineVersionId, actual: current?.id || null });
    }
    return baseline;
  }

  publish(state, publication) {
    state.publishedVersions.forEach(item => {
      if (item.handbookId === publication.handbookId && item.businessVersion === publication.businessVersion && item.current === true) item.current = false;
    });
    publication.current = true;
    state.publishedVersions.push(publication);
  }
}

class IncrementalBuildService {
  constructor(repository, options = {}) {
    this.repository = repository;
    this.baselines = options.baselineProvider || new RepositoryBaselineProvider();
  }

  withIdempotency(session, key, action, request, operation) {
    if (!key) throw new IncrementalBuildError('IDEMPOTENCY_KEY_REQUIRED', '写操作必须携带 Idempotency-Key', 400);
    const owner = actor(session).id;
    const scope = `${owner}:${action}:${key}`;
    const requestDigest = digest(request);
    return this.repository.transaction(state => {
      const previous = state.idempotency[scope];
      if (previous) {
        if (previous.requestDigest !== requestDigest) throw new IncrementalBuildError('IDEMPOTENCY_KEY_REUSED', '幂等键已用于不同请求', 409);
        return previous.response;
      }
      const response = operation(state);
      state.idempotency[scope] = { requestDigest, response, createdAt: now() };
      return response;
    });
  }

  audit(state, actionName, taskId, session, details = {}) {
    state.audits.push({ id: identifier('audit'), action: actionName, taskId, actor: actor(session), details, at: now() });
  }

  task(state, taskId) {
    const task = state.tasks.find(item => item.id === taskId);
    if (!task) throw new IncrementalBuildError('INCREMENTAL_TASK_NOT_FOUND', '增量构建任务不存在', 404);
    return task;
  }

  isOwner(session, task) {
    return task.createdBy.id === actor(session).id || hasAction(session, 'platform:manage');
  }

  canRead(session, task) {
    if (this.isOwner(session, task)) return true;
    // 审核中的候选允许知识编辑者只读参与并提出意见；编辑、审核决定和发布
    // 仍由各自 capability 控制，不能由此取得写入候选或发布权限。
    if (hasAction(session, 'knowledge:write') && task.state === 'under_review') return true;
    if (hasAction(session, 'review:manage') && task.state === 'under_review') return true;
    if (hasAction(session, 'publish:manage') && ['approved', 'published'].includes(task.state)) return true;
    return false;
  }

  requireReadable(session, task) {
    if (!this.canRead(session, task)) throw new IncrementalBuildError('INCREMENTAL_TASK_NOT_FOUND', '增量构建任务不存在', 404);
  }

  requireOwner(session, task) {
    if (!this.isOwner(session, task)) throw new IncrementalBuildError('INCREMENTAL_TASK_NOT_FOUND', '增量构建任务不存在', 404);
  }

  canComment(session, task) {
    return task.state === 'under_review' && (hasAction(session, 'knowledge:write') || hasAction(session, 'review:manage'));
  }

  create(session, key, body) {
    requireAction(session, 'knowledge:write');
    required(body.name, 'name', '任务名称不能为空');
    required(body.handbookId, 'handbookId', '必须选择手册');
    required(body.businessVersion, 'businessVersion', '必须选择业务版本');
    required(body.baselineVersionId, 'baselineVersionId', '必须选择已发布基线');
    return this.withIdempotency(session, key, 'create', body, state => {
      const baseline = this.baselines.require(state, body.baselineVersionId, body.handbookId, body.businessVersion);
      const timestamp = now();
      const task = {
        id: identifier('inc'), name: String(body.name).trim(), handbookId: body.handbookId,
        businessVersion: body.businessVersion, baselineVersionId: body.baselineVersionId,
        baselineDigest: baseline.contentDigest || null, state: 'draft', sourceSnapshots: [], target: null,
        draft: null, checks: null, candidate: null, reviews: [], publication: null, externalEvidence: [],
        createdBy: actor(session), createdAt: timestamp, updatedAt: timestamp,
      };
      state.tasks.push(task);
      this.audit(state, 'INCREMENTAL_TASK_CREATED', task.id, session);
      return this.project(task, session);
    });
  }

  createOnlineReview(session, key, body = {}) {
    requireAction(session, 'knowledge:write');
    required(body.handbookId, 'handbookId', '必须选择手册');
    required(body.businessVersion, 'businessVersion', '必须选择业务版本');
    required(body.baselineVersionId, 'baselineVersionId', '必须选择已发布正式版本');
    const scope = body.scope || (body.documentId || body.documentIds?.length ? 'document' : 'handbook');
    if (!['handbook', 'document'].includes(scope)) {
      throw new IncrementalBuildError('ONLINE_REVIEW_SCOPE_INVALID', '在线评审范围仅支持 handbook 或 document', 422, { field: 'scope' });
    }
    if (body.documentIds !== undefined && !Array.isArray(body.documentIds)) {
      throw new IncrementalBuildError('ONLINE_REVIEW_SCOPE_INVALID', 'documentIds 必须是文档标识数组', 422, { field: 'documentIds' });
    }
    const documentIds = [...new Set([...(body.documentIds || []), ...(body.documentId ? [body.documentId] : [])].filter(Boolean))];
    if (scope === 'document' && !documentIds.length) {
      throw new IncrementalBuildError('ONLINE_REVIEW_SCOPE_INVALID', '文档范围评审必须指定至少一个文档', 422, { field: 'documentIds' });
    }

    return this.withIdempotency(session, key, 'online-review', body, state => {
      const baseline = this.baselines.require(state, body.baselineVersionId, body.handbookId, body.businessVersion);
      if (baseline.content === undefined || baseline.content === null || baseline.content === '') {
        throw new IncrementalBuildError('ONLINE_REVIEW_SNAPSHOT_UNAVAILABLE', '已发布正式版本未保存正文，无法创建在线评审快照', 409, {
          baselineVersionId: baseline.id,
        });
      }
      const timestamp = now();
      const target = {
        scope,
        documentIds,
        sectionIds: [],
        language: body.language || 'zh-CN',
      };
      const content = structuredClone(baseline.content);
      const candidate = {
        id: identifier('candidate'),
        content,
        operations: [],
        digest: digest({ baselineVersionId: baseline.id, baselineContentDigest: baseline.contentDigest || digest(content), target, content }),
        createdBy: actor(session),
        createdAt: timestamp,
        snapshotOfPublishedVersionId: baseline.id,
      };
      const review = {
        id: identifier('review'),
        candidateDigest: candidate.digest,
        status: 'pending',
        comments: [],
        submittedBy: actor(session),
        submittedAt: timestamp,
        decision: null,
      };
      const task = {
        id: identifier('inc'),
        name: String(body.name || `${body.handbookId} 在线评审`).trim(),
        handbookId: body.handbookId,
        businessVersion: body.businessVersion,
        baselineVersionId: baseline.id,
        baselineDigest: baseline.contentDigest || digest(content),
        reviewMode: 'online_review',
        state: 'under_review',
        sourceSnapshots: [],
        target,
        draft: null,
        checks: null,
        candidate,
        reviews: [review],
        publication: null,
        externalEvidence: [],
        createdBy: actor(session),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      state.tasks.push(task);
      this.audit(state, 'ONLINE_REVIEW_SNAPSHOT_CREATED', task.id, session, {
        reviewId: review.id,
        baselineVersionId: baseline.id,
        candidateDigest: candidate.digest,
        scope,
        documentIds,
      });
      return this.project(task, session);
    });
  }

  list(session, query = {}) {
    requireAction(session, 'knowledge:read');
    let tasks = this.repository.read().tasks.filter(task => this.canRead(session, task));
    if (query.handbookId) tasks = tasks.filter(item => item.handbookId === query.handbookId);
    if (query.state) tasks = tasks.filter(item => item.state === query.state);
    return tasks.map(task => this.project(task, session, true));
  }

  listHandbookReviewSummary(session, handbookId, query = {}) {
    requireAction(session, 'knowledge:read');
    required(handbookId, 'handbookId', '必须指定手册');
    const state = this.repository.read();
    const tasks = state.tasks
      .filter(task => task.handbookId === handbookId && this.canRead(session, task))
      .filter(task => !query.state || task.state === query.state)
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
    const projected = tasks.map(task => this.project(task, session, true));
    const reviews = tasks.flatMap(task => task.reviews || []);
    const allComments = reviews.flatMap(review => review.comments || []);
    const unresolved = allComments.filter(comment => comment.resolved !== true);
    return {
      handbookId,
      tasks: projected,
      summary: {
        total: tasks.length,
        underReview: tasks.filter(task => task.state === 'under_review').length,
        pendingPublish: tasks.filter(task => task.state === 'approved').length,
        rejected: tasks.filter(task => task.state === 'rejected').length,
        published: tasks.filter(task => task.state === 'published').length,
        unresolvedComments: unresolved.length,
        blockers: unresolved.filter(comment => comment.severity === 'blocker').length,
      },
      generatedAt: now(),
    };
  }

  getCandidateDiff(session, taskId) {
    requireAction(session, 'knowledge:read');
    const state = this.repository.read();
    const task = this.task(state, taskId);
    this.requireReadable(session, task);
    const baseline = state.publishedVersions.find(item => item.id === task.baselineVersionId
      && item.handbookId === task.handbookId && item.businessVersion === task.businessVersion) || null;
    const candidate = task.candidate || task.draft || null;
    const operations = Array.isArray(candidate?.operations) ? candidate.operations : [];
    const counts = operations.reduce((result, operation) => {
      const type = operation.type;
      if (type === 'add') result.added += 1;
      else if (type === 'delete') result.deleted += 1;
      else if (type === 'move') result.moved += 1;
      else if (type === 'update') result.updated += 1;
      return result;
    }, { added: 0, updated: 0, deleted: 0, moved: 0 });
    return {
      taskId: task.id,
      handbookId: task.handbookId,
      businessVersion: task.businessVersion,
      baseline: baseline ? { id: baseline.id, contentDigest: baseline.contentDigest || null, content: baseline.content ?? null, publishedAt: baseline.publishedAt || null } : null,
      candidate: candidate ? { id: candidate.id || null, digest: candidate.digest || candidate.contentDigest || null, content: candidate.content ?? null, createdAt: candidate.createdAt || null } : null,
      operations: structuredClone(operations),
      counts,
      completeness: {
        beforeFullText: Boolean(baseline && baseline.content !== undefined && baseline.content !== null),
        afterFullText: Boolean(candidate && candidate.content !== undefined && candidate.content !== null),
        note: (!baseline || baseline.content === undefined || baseline.content === null)
          ? '当前基线未保存全文，只能展示变更操作和候选全文。'
          : null,
      },
      generatedAt: now(),
    };
  }

  get(session, taskId) {
    requireAction(session, 'knowledge:read');
    const task = this.task(this.repository.read(), taskId);
    this.requireReadable(session, task);
    return this.project(task, session);
  }

  listBaselines(session, query = {}) {
    requireAction(session, 'knowledge:read');
    const visible = session?.visibleHandbookIds || session?.user?.visibleHandbookIds || null;
    return this.baselines.list(this.repository.read(), query)
      .filter(item => !visible || visible.includes(item.handbookId))
      .map(item => ({ id: item.id, handbookId: item.handbookId, businessVersion: item.businessVersion, current: item.current === true, contentDigest: item.contentDigest || null, publishedAt: item.publishedAt || null }));
  }

  createSyntheticBaseline(session, key, body) {
    requireAction(session, 'knowledge:write');
    required(body.handbookId, 'handbookId', '手册标识不能为空');
    required(body.businessVersion, 'businessVersion', '业务版本不能为空');
    required(body.content, 'content', '基线内容不能为空');
    return this.withIdempotency(session, key, 'bootstrap-baseline', body, state => {
      const timestamp = now();
      const baseline = {
        id: identifier('baseline'),
        handbookId: body.handbookId,
        businessVersion: body.businessVersion,
        current: true,
        content: body.content,
        contentDigest: digest(body.content),
        publishedAt: timestamp,
        synthetic: true,
        source: {
          type: 'gitlab_bootstrap',
          commitSha: body.commitSha || null,
          filePath: body.filePath || null,
          branch: body.branch || null,
        },
      };
      // Mark existing baselines as not current
      state.publishedVersions.forEach(item => {
        if (item.handbookId === body.handbookId && item.businessVersion === body.businessVersion && item.current === true) {
          item.current = false;
        }
      });
      state.publishedVersions.push(baseline);
      this.audit(state, 'SYNTHETIC_BASELINE_CREATED', baseline.id, session, {
        handbookId: body.handbookId,
        businessVersion: body.businessVersion,
        commitSha: body.commitSha,
      });
      return { id: baseline.id, handbookId: baseline.handbookId, businessVersion: baseline.businessVersion, current: true, contentDigest: baseline.contentDigest, publishedAt: baseline.publishedAt, synthetic: true, source: baseline.source };
    });
  }

  addSource(session, taskId, key, body) {
    requireAction(session, 'knowledge:write');
    this.requireOwner(session, this.task(this.repository.read(), taskId));
    if (!['manual', 'local'].includes(body.sourceType)) throw new IncrementalBuildError('SOURCE_TYPE_INVALID', '来源类型仅支持 manual 或 local', 422);
    required(body.label, 'label', '来源名称不能为空');
    required(body.content, 'content', '来源快照内容不能为空');
    return this.withIdempotency(session, key, `source:${taskId}`, body, state => {
      const task = this.task(state, taskId);
      this.requireOwner(session, task);
      if (!EDITABLE_STATES.has(task.state)) throw new IncrementalBuildError('TASK_SOURCE_FROZEN', '候选版本已冻结，不能继续增加来源', 409);
      const snapshot = {
        id: identifier('src'), sourceType: body.sourceType, label: String(body.label).trim(),
        reference: body.reference || null, content: body.content,
        attachments: Array.isArray(body.attachments) ? body.attachments : [],
        contentDigest: digest({ content: body.content, attachments: body.attachments || [] }),
        capturedBy: actor(session), capturedAt: now(),
      };
      task.sourceSnapshots.push(snapshot); task.state = 'editing'; task.updatedAt = now();
      this.audit(state, 'SOURCE_SNAPSHOT_CAPTURED', taskId, session, { snapshotId: snapshot.id });
      return snapshot;
    });
  }

  updateTarget(session, taskId, key, body) {
    requireAction(session, 'knowledge:write');
    this.requireOwner(session, this.task(this.repository.read(), taskId));
    required(body.documentIds, 'documentIds', '必须选择至少一个目标文档');
    return this.withIdempotency(session, key, `target:${taskId}`, body, state => {
      const task = this.task(state, taskId);
      this.requireOwner(session, task);
      if (!EDITABLE_STATES.has(task.state)) throw new IncrementalBuildError('TASK_TARGET_FROZEN', '候选版本已冻结，不能修改目标范围', 409);
      task.target = { documentIds: [...new Set(body.documentIds)], sectionIds: [...new Set(body.sectionIds || [])], language: body.language || 'zh-CN' };
      task.state = 'editing'; task.updatedAt = now();
      this.audit(state, 'TARGET_SCOPE_UPDATED', taskId, session, task.target);
      return task.target;
    });
  }

  saveDraft(session, taskId, key, body) {
    requireAction(session, 'knowledge:write');
    this.requireOwner(session, this.task(this.repository.read(), taskId));
    required(body.content, 'content', '草稿内容不能为空');
    const operations = Array.isArray(body.operations) ? body.operations : [];
    const schemaErrors = operations.flatMap(operationErrors);
    if (!operations.length) schemaErrors.push({ field: 'operations', message: '变更集不能为空' });
    if (schemaErrors.length) throw new IncrementalBuildError('CHANGESET_INVALID', '变更集不符合 P0 可重放契约', 422, { errors: schemaErrors });
    return this.withIdempotency(session, key, `draft:${taskId}`, body, state => {
      const task = this.task(state, taskId);
      this.requireOwner(session, task);
      if (!EDITABLE_STATES.has(task.state)) throw new IncrementalBuildError('DRAFT_IMMUTABLE', '候选版本已冻结，草稿不可修改', 409);
      const currentVersion = task.draft?.editVersion || 0;
      if (Number(body.editVersion) !== currentVersion) {
        throw new IncrementalBuildError('DRAFT_EDIT_CONFLICT', '草稿已被其他操作更新', 409, { expected: currentVersion, received: body.editVersion });
      }
      task.draft = { content: body.content, operations, editVersion: currentVersion + 1, contentDigest: digest({ content: body.content, operations }), updatedBy: actor(session), updatedAt: now() };
      task.state = 'editing'; task.checks = null; task.updatedAt = task.draft.updatedAt;
      this.audit(state, 'DRAFT_SAVED', taskId, session, { editVersion: task.draft.editVersion });
      return task.draft;
    });
  }

  runChecks(session, taskId, key, body = {}) {
    requireAction(session, 'knowledge:write');
    this.requireOwner(session, this.task(this.repository.read(), taskId));
    return this.withIdempotency(session, key, `checks:${taskId}`, body, state => {
      const task = this.task(state, taskId);
      this.requireOwner(session, task);
      if (!EDITABLE_STATES.has(task.state)) throw new IncrementalBuildError('TASK_CHECK_NOT_ALLOWED', '当前状态不能执行发布前检查', 409);
      const checks = [
        { code: 'SOURCE_SNAPSHOT_PRESENT', passed: task.sourceSnapshots.length > 0, message: '已固化至少一个来源快照' },
        { code: 'TARGET_DOCUMENT_PRESENT', passed: Boolean(task.target?.documentIds?.length), message: '已确认目标文档范围' },
        { code: 'DRAFT_CONTENT_PRESENT', passed: Boolean(task.draft?.content), message: '草稿内容不为空' },
        { code: 'CHANGESET_OPERATION_VALID', passed: Boolean(task.draft?.operations?.length) && task.draft.operations.flatMap(operationErrors).length === 0, message: '变更集符合 P0 可重放契约' },
        { code: 'CHANGESET_TARGET_DOCUMENTS_MATCH', passed: Boolean(task.draft?.operations?.length) && task.draft.operations.every(item => task.target?.documentIds?.includes(item.documentId)), message: '变更操作仅影响已确认的目标文档' },
        { code: 'CHANGESET_TARGET_SECTIONS_MATCH', passed: Boolean(task.draft?.operations?.length) && (!task.target?.sectionIds?.length || task.draft.operations.every(item => task.target.sectionIds.includes(item.nodeId))), message: '变更操作仅影响已确认的节点范围' },
      ];
      const issues = checks.filter(item => !item.passed).map(item => ({ code: item.code, message: item.message }));
      task.checks = { scope: 'incremental_completeness', passed: issues.length === 0, checks, issues, checkedDraftDigest: task.draft?.contentDigest || null, checkedAt: now(), checkedBy: actor(session) };
      task.state = task.checks.passed ? 'checked' : 'editing'; task.updatedAt = task.checks.checkedAt;
      this.audit(state, 'PRE_PUBLISH_CHECK_COMPLETED', taskId, session, { passed: task.checks.passed, issueCodes: issues.map(item => item.code) });
      return task.checks;
    });
  }

  createCandidate(session, taskId, key, body = {}) {
    requireAction(session, 'knowledge:write');
    this.requireOwner(session, this.task(this.repository.read(), taskId));
    return this.withIdempotency(session, key, `candidate:${taskId}`, body, state => {
      const task = this.task(state, taskId);
      this.requireOwner(session, task);
      if (task.state !== 'checked' || !task.checks?.passed || task.checks.checkedDraftDigest !== task.draft?.contentDigest) {
        throw new IncrementalBuildError('CHECK_REQUIRED', '草稿必须通过最新的发布前检查', 409);
      }
      task.candidate = {
        id: identifier('candidate'), draftDigest: task.draft.contentDigest,
        sourceSnapshotIds: task.sourceSnapshots.map(item => item.id), target: task.target,
        content: task.draft.content, operations: task.draft.operations,
        digest: digest({ baselineVersionId: task.baselineVersionId, draft: task.draft, target: task.target, sources: task.sourceSnapshots.map(item => item.contentDigest) }),
        createdBy: actor(session), createdAt: now(),
      };
      task.state = 'candidate_ready'; task.updatedAt = task.candidate.createdAt;
      this.audit(state, 'CANDIDATE_FROZEN', taskId, session, { candidateId: task.candidate.id, digest: task.candidate.digest });
      return task.candidate;
    });
  }

  submitReview(session, taskId, key, body = {}) {
    requireAction(session, 'knowledge:write');
    this.requireOwner(session, this.task(this.repository.read(), taskId));
    return this.withIdempotency(session, key, `review-submit:${taskId}`, body, state => {
      const task = this.task(state, taskId);
      this.requireOwner(session, task);
      if (task.state !== 'candidate_ready') throw new IncrementalBuildError('CANDIDATE_REQUIRED', '必须先冻结候选版本', 409);
      const review = { id: identifier('review'), candidateDigest: task.candidate.digest, status: 'pending', comments: [], submittedBy: actor(session), submittedAt: now(), decision: null };
      task.reviews.push(review); task.state = 'under_review'; task.updatedAt = review.submittedAt;
      this.audit(state, 'REVIEW_SUBMITTED', taskId, session, { reviewId: review.id });
      return review;
    });
  }

  runAiAnalysis(session, taskId, key, body = {}) {
    requireAnyAction(session, ['knowledge:write', 'review:manage']);
    this.requireReadable(session, this.task(this.repository.read(), taskId));
    return this.withIdempotency(session, key, `ai-analysis:${taskId}`, body, state => {
      const task = this.task(state, taskId);
      this.requireReadable(session, task);
      if (!task.candidate?.digest) throw new IncrementalBuildError('CANDIDATE_REQUIRED', '必须先冻结候选版本才能执行 AI 审核', 409);
      const content = String(task.candidate.content || '');
      const findings = [];
      if (/\bselect\s+\*\b/i.test(content)) findings.push({ code: 'SQL_SELECT_STAR', severity: 'warning', message: '检测到 SELECT *，请确认是否会导致字段漂移风险', evidence: '候选正文 SQL 片段' });
      if (/TODO|待补充|TBD/i.test(content)) findings.push({ code: 'DOC_TODO_MARKER', severity: 'warning', message: '正文包含待补充标记', evidence: '候选正文文本' });
      const analysis = {
        id: identifier('aianalysis'), status: 'completed', analysisType: body.analysisType || 'database_document_review',
        verdict: findings.some(item => item.severity === 'blocker') ? '需阻断' : (findings.length ? '需人工确认' : '未发现规则问题'),
        reasoningSummary: findings.length ? '基于已声明规则对候选内容完成静态检查，发现需人工确认的条目。' : '基于已声明规则对候选内容完成静态检查，未发现规则命中的问题。',
        ruleRefs: ['database-document-rules/v1'], evidenceRefs: findings.map(item => item.evidence), findings,
        candidateDigest: task.candidate.digest, executedAt: now(), executedBy: actor(session), modelVersion: 'deterministic-rules-v1'
      };
      task.aiAnalysis = analysis; task.updatedAt = analysis.executedAt;
      this.audit(state, 'AI_REVIEW_ANALYSIS_COMPLETED', taskId, session, { analysisId: analysis.id, candidateDigest: analysis.candidateDigest, findingCount: findings.length });
      return analysis;
    });
  }

  getAiAnalysis(session, taskId) {
    requireAction(session, 'knowledge:read');
    const task = this.task(this.repository.read(), taskId); this.requireReadable(session, task);
    return task.aiAnalysis ? structuredClone(task.aiAnalysis) : { status: 'not_started', candidateDigest: task.candidate?.digest || null };
  }

  createAiFixProposal(session, taskId, key, body = {}) {
    requireAnyAction(session, ['knowledge:write', 'review:manage']);
    this.requireReadable(session, this.task(this.repository.read(), taskId));
    required(body.findingCode, 'findingCode', '必须指定待修复问题');
    required(body.proposedText, 'proposedText', '必须提供修订内容');
    return this.withIdempotency(session, key, `ai-fix:${taskId}`, body, state => {
      const task = this.task(state, taskId); this.requireReadable(session, task);
      if (!task.candidate?.digest) throw new IncrementalBuildError('CANDIDATE_REQUIRED', '候选版本不存在', 409);
      if (!task.aiAnalysis || task.aiAnalysis.candidateDigest !== task.candidate.digest) throw new IncrementalBuildError('AI_ANALYSIS_REQUIRED', '请先对当前候选执行 AI 审核', 409);
      const proposal = { id: identifier('aifix'), status: 'proposed', findingCode: body.findingCode, proposedText: String(body.proposedText), rationale: String(body.rationale || '依据规则检查结果生成的修订建议，需人工确认后应用。'), sourceAnalysisId: task.aiAnalysis.id, candidateDigest: task.candidate.digest, createdBy: actor(session), createdAt: now(), appliedAt: null, appliedBy: null };
      if (!Array.isArray(task.aiFixProposals)) task.aiFixProposals = [];
      task.aiFixProposals.push(proposal); task.updatedAt = proposal.createdAt;
      this.audit(state, 'AI_FIX_PROPOSAL_CREATED', taskId, session, { proposalId: proposal.id, findingCode: proposal.findingCode });
      return proposal;
    });
  }

  listAiFixProposals(session, taskId) {
    requireAction(session, 'knowledge:read'); const task = this.task(this.repository.read(), taskId); this.requireReadable(session, task);
    return structuredClone(task.aiFixProposals || []);
  }

  commentOnReview(session, taskId, reviewId, key, body) {
    requireAnyAction(session, ['knowledge:write', 'review:manage']);
    this.task(this.repository.read(), taskId);
    const content = body.comment ?? body.body;
    required(content, 'comment', '评论内容不能为空');
    const commentType = body.commentType || 'suggestion';
    if (!['question', 'issue', 'suggestion', 'approval_note', 'ai_analysis'].includes(commentType)) {
      throw new IncrementalBuildError('COMMENT_TYPE_INVALID', '评论类型无效', 422, { field: 'commentType' });
    }
    const severity = body.severity || 'normal';
    if (!['normal', 'blocker'].includes(severity)) {
      throw new IncrementalBuildError('COMMENT_SEVERITY_INVALID', '评论严重级别无效', 422, { field: 'severity' });
    }
    return this.withIdempotency(session, key, `review-comment:${taskId}:${reviewId}`, body, state => {
      const task = this.task(state, taskId);
      if (task.state !== 'under_review') throw new IncrementalBuildError('REVIEW_NOT_ACTIVE', '只能评论待审核任务', 409);
      if (!this.canComment(session, task)) throw new IncrementalBuildError('ACTION_FORBIDDEN', '当前用户无权提出审核意见', 403, { requiredAnyAction: ['knowledge:write', 'review:manage'] });
      const review = task.reviews.find(item => item.id === reviewId);
      if (!review) throw new IncrementalBuildError('REVIEW_NOT_FOUND', '审核记录不存在', 404);
      if (body.candidateDigest && body.candidateDigest !== task.candidate?.digest) {
        throw new IncrementalBuildError('REVIEW_CANDIDATE_CONFLICT', '评论对象与当前候选版本不一致', 409, { expected: task.candidate?.digest || null, actual: body.candidateDigest });
      }
      const anchor = body.anchor || null;
      if (anchor) {
        required(body.candidateDigest, 'candidateDigest', '行级评论必须携带候选版本指纹');
        if (!anchor.documentId || !anchor.nodeId) throw new IncrementalBuildError('COMMENT_ANCHOR_INVALID', '行级评论必须指定 documentId 和 nodeId', 422, { field: 'anchor' });
        // 阅读文档页使用 document_span 锚点；差异页继续使用 operation/baseline 锚点。
        // 两类锚点都必须绑定 documentId/nodeId，并携带候选摘要，避免跨候选版本误挂评论。
        if (!['after_operation', 'before_operation', 'baseline', 'document_span'].includes(anchor.anchorKind)) throw new IncrementalBuildError('COMMENT_ANCHOR_INVALID', 'anchorKind 无效', 422, { field: 'anchor.anchorKind' });
        for (const rangeName of ['lineRange', 'charRange']) {
          if (anchor[rangeName]) {
            const range = anchor[rangeName];
            const startKey = rangeName === 'lineRange' ? 'startLine' : 'startChar';
            const endKey = rangeName === 'lineRange' ? 'endLine' : 'endChar';
            // Accept the short start/end form for early clients, while storing the
            // documented startLine/endLine or startChar/endChar shape unchanged.
            const start = Number.isInteger(range[startKey]) ? range[startKey] : range.start;
            const end = Number.isInteger(range[endKey]) ? range[endKey] : range.end;
            if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
              throw new IncrementalBuildError('COMMENT_ANCHOR_INVALID', `${rangeName} 范围无效`, 422, { field: `anchor.${rangeName}` });
            }
          }
        }
        const operation = task.candidate?.operations?.find(item => item.documentId === anchor.documentId && item.nodeId === anchor.nodeId);
        // document_span is allowed on unchanged/undiscovered nodes; the UI must
        // surface the manual-confirmation state instead of pretending it is an
        // operation anchor. Diff anchors still require a real operation.
        if (!operation && anchor.anchorKind !== 'document_span') {
          throw new IncrementalBuildError('COMMENT_ANCHOR_NOT_FOUND', '锚点不属于当前候选版本的变更范围', 422, { documentId: anchor.documentId, nodeId: anchor.nodeId });
        }
      }
      const comment = {
        id: identifier('comment'), content: String(content).trim(), body: String(content).trim(), author: actor(session), at: now(), createdAt: now(), updatedAt: now(),
        commentType, severity, mode: anchor ? 'anchored' : 'global',
        anchorStatus: anchor ? ((anchor.anchorKind === 'document_span' && !task.candidate?.operations?.some(item => item.documentId === anchor.documentId && item.nodeId === anchor.nodeId)) ? 'needs_manual_confirmation' : 'valid') : 'unanchored_compat',
        candidateDigest: body.candidateDigest || task.candidate?.digest || null,
        anchor: anchor ? structuredClone(anchor) : null, diffView: body.diffView ? structuredClone(body.diffView) : null,
        resolved: false, resolvedBy: null, resolvedAt: null,
      };
      review.comments.push(comment); task.updatedAt = comment.at;
      this.audit(state, 'REVIEW_COMMENT_ADDED', taskId, session, { reviewId, commentId: comment.id, mode: comment.mode, candidateDigest: comment.candidateDigest, anchor: comment.anchor });
      return comment;
    });
  }

  listReviewComments(session, taskId, reviewId, query = {}) {
    requireAction(session, 'knowledge:read');
    const task = this.task(this.repository.read(), taskId);
    this.requireReadable(session, task);
    const review = task.reviews.find(item => item.id === reviewId);
    if (!review) throw new IncrementalBuildError('REVIEW_NOT_FOUND', '审核记录不存在', 404);
    return review.comments.filter(comment => (!query.commentType || comment.commentType === query.commentType)
      && (!query.mode || comment.mode === query.mode)
      && (!query.documentId || comment.anchor?.documentId === query.documentId));
  }

  replyToComment(session, taskId, reviewId, commentId, key, body = {}) {
    requireAnyAction(session, ['knowledge:write', 'review:manage']);
    this.requireReadable(session, this.task(this.repository.read(), taskId));
    const content = body.comment ?? body.body;
    required(content, 'comment', '回复内容不能为空');
    return this.withIdempotency(session, key, `review-reply:${taskId}:${reviewId}:${commentId}`, body, state => {
      const task = this.task(state, taskId);
      const review = task.reviews.find(item => item.id === reviewId);
      if (!review) throw new IncrementalBuildError('REVIEW_NOT_FOUND', '审核记录不存在', 404);
      const comment = review?.comments?.find(item => item.id === commentId);
      if (!comment) throw new IncrementalBuildError('COMMENT_NOT_FOUND', '评论不存在', 404);
      if (!Array.isArray(comment.replies)) comment.replies = [];
      const reply = { id: identifier('reply'), content: String(content).trim(), body: String(content).trim(), author: actor(session), createdAt: now() };
      comment.replies.push(reply); comment.updatedAt = reply.createdAt; task.updatedAt = reply.createdAt;
      this.audit(state, 'REVIEW_COMMENT_REPLIED', taskId, session, { reviewId, commentId, replyId: reply.id });
      return reply;
    });
  }

  setCommentResolution(session, taskId, reviewId, commentId, key, action, body = {}) {
    requireAnyAction(session, ['knowledge:write', 'review:manage']);
    this.requireReadable(session, this.task(this.repository.read(), taskId));
    if (!['resolve', 'reopen'].includes(action)) throw new IncrementalBuildError('COMMENT_STATUS_INVALID', '评论状态操作无效', 422);
    return this.withIdempotency(session, key, `review-comment-${action}:${taskId}:${reviewId}:${commentId}`, body, state => {
      const task = this.task(state, taskId); const review = task.reviews.find(item => item.id === reviewId); const comment = review?.comments?.find(item => item.id === commentId);
      if (!comment) throw new IncrementalBuildError('COMMENT_NOT_FOUND', '评论不存在', 404);
      const at = now(); comment.resolved = action === 'resolve'; comment.anchorStatus = comment.anchorStatus === 'invalidated' ? 'invalidated' : (comment.resolved ? 'resolved' : 'valid');
      comment.resolvedBy = comment.resolved ? actor(session) : null; comment.resolvedAt = comment.resolved ? at : null; comment.updatedAt = at; task.updatedAt = at;
      this.audit(state, action === 'resolve' ? 'REVIEW_COMMENT_RESOLVED' : 'REVIEW_COMMENT_REOPENED', taskId, session, { reviewId, commentId, reason: body.reason || null });
      return comment;
    });
  }

  linkCommentOperation(session, taskId, reviewId, commentId, key, body = {}) {
    requireAnyAction(session, ['knowledge:write', 'review:manage']);
    this.requireReadable(session, this.task(this.repository.read(), taskId));
    required(body.operationId, 'operationId', '必须指定变更操作');
    return this.withIdempotency(session, key, `review-link-operation:${taskId}:${reviewId}:${commentId}`, body, state => {
      const task = this.task(state, taskId); const review = task.reviews.find(item => item.id === reviewId); const comment = review?.comments?.find(item => item.id === commentId);
      if (!comment) throw new IncrementalBuildError('COMMENT_NOT_FOUND', '评论不存在', 404);
      const operation = task.candidate?.operations?.find(item => item.id === body.operationId);
      if (!operation) throw new IncrementalBuildError('OPERATION_NOT_FOUND', '变更操作不存在', 422);
      comment.operationId = body.operationId; comment.updatedAt = now(); task.updatedAt = comment.updatedAt;
      this.audit(state, 'REVIEW_COMMENT_LINKED_OPERATION', taskId, session, { reviewId, commentId, operationId: body.operationId });
      return comment;
    });
  }

  getReview(session, taskId, reviewId) {
    requireAction(session, 'knowledge:read');
    const task = this.task(this.repository.read(), taskId);
    this.requireReadable(session, task);
    const review = task.reviews.find(item => item.id === reviewId);
    if (!review) throw new IncrementalBuildError('REVIEW_NOT_FOUND', '审核记录不存在', 404);
    return structuredClone(review);
  }

  decideReview(session, taskId, reviewId, key, body) {
    requireAction(session, 'review:manage');
    this.requireReadable(session, this.task(this.repository.read(), taskId));
    if (!['approve', 'reject'].includes(body.decision)) throw new IncrementalBuildError('REVIEW_DECISION_INVALID', '审核决定仅支持 approve 或 reject', 422);
    if (body.decision === 'reject') required(body.comment, 'comment', '退回时必须说明原因');
    return this.withIdempotency(session, key, `review-decision:${taskId}:${reviewId}`, body, state => {
      const task = this.task(state, taskId);
      this.requireReadable(session, task);
      const review = task.reviews.find(item => item.id === reviewId);
      if (!review) throw new IncrementalBuildError('REVIEW_NOT_FOUND', '审核记录不存在', 404);
      if (review.status !== 'pending' || task.state !== 'under_review') throw new IncrementalBuildError('REVIEW_ALREADY_DECIDED', '审核已完成', 409);
      if (review.candidateDigest !== task.candidate?.digest) throw new IncrementalBuildError('REVIEW_CANDIDATE_CONFLICT', '审核对象与当前候选版本不一致', 409);
      const blockingComments = (review.comments || []).filter(comment => comment.resolved !== true && comment.severity === 'blocker');
      if (body.decision === 'approve' && blockingComments.length) {
        throw new IncrementalBuildError('REVIEW_BLOCKED_BY_COMMENTS', '存在未解决的阻断意见，无法通过审核', 409, { blockerCommentIds: blockingComments.map(comment => comment.id) });
      }
      const reviewer = actor(session);
      review.status = body.decision === 'approve' ? 'approved' : 'rejected';
      review.decision = { value: body.decision, comment: body.comment || null, decidedBy: reviewer, decidedAt: now() };
      task.state = review.status === 'approved' ? 'approved' : 'rejected'; task.updatedAt = review.decision.decidedAt;
      this.audit(state, 'REVIEW_DECIDED', taskId, session, { reviewId, decision: body.decision });
      return review;
    });
  }

  publish(session, taskId, key, body) {
    requireAction(session, 'publish:manage');
    this.requireReadable(session, this.task(this.repository.read(), taskId));
    required(body.expectedCandidateDigest, 'expectedCandidateDigest', '必须确认候选版本指纹');
    return this.withIdempotency(session, key, `publish:${taskId}`, body, state => {
      const task = this.task(state, taskId);
      this.requireReadable(session, task);
      if (task.state !== 'approved') throw new IncrementalBuildError('APPROVAL_REQUIRED', '候选版本必须通过审核', 409);
      if (body.expectedCandidateDigest !== task.candidate.digest) throw new IncrementalBuildError('CANDIDATE_CONFLICT', '候选版本已变化', 409);
      if (!task.reviews.some(item => item.status === 'approved' && item.candidateDigest === task.candidate.digest)) throw new IncrementalBuildError('APPROVAL_REQUIRED', '当前候选版本没有有效审核结论', 409);
      this.baselines.require(state, task.baselineVersionId, task.handbookId, task.businessVersion);
      const publication = {
        id: identifier('docver'), handbookId: task.handbookId, businessVersion: task.businessVersion,
        targetKey: digest(task.target), baseVersionId: task.baselineVersionId, candidateDigest: task.candidate.digest,
        contentDigest: digest(task.candidate.content),
        content: task.candidate.content, operations: task.candidate.operations,
        publishedBy: actor(session), publishedAt: now(),
      };
      this.baselines.publish(state, publication); task.publication = publication; task.state = 'published'; task.updatedAt = publication.publishedAt;
      this.audit(state, 'INCREMENTAL_VERSION_PUBLISHED', taskId, session, { publicationId: publication.id });
      return publication;
    });
  }

  addExternalEvidence(session, taskId, key, body) {
    requireAction(session, 'publish:manage');
    this.requireReadable(session, this.task(this.repository.read(), taskId));
    required(body.type, 'type', '外部交付证据类型不能为空');
    required(body.reference, 'reference', '外部交付证据引用不能为空');
    return this.withIdempotency(session, key, `evidence:${taskId}`, body, state => {
      const task = this.task(state, taskId);
      this.requireReadable(session, task);
      if (task.state !== 'published') throw new IncrementalBuildError('PUBLICATION_REQUIRED', '只能为已发布的平台版本登记外部证据', 409);
      const evidence = { id: identifier('evidence'), type: body.type, reference: body.reference, status: body.status || 'recorded', note: body.note || null, recordedBy: actor(session), recordedAt: now() };
      task.externalEvidence.push(evidence); task.updatedAt = evidence.recordedAt;
      this.audit(state, 'EXTERNAL_EVIDENCE_RECORDED', taskId, session, { evidenceId: evidence.id });
      return evidence;
    });
  }

  createRevision(session, taskId, key, body = {}) {
    requireAction(session, 'knowledge:write');
    this.requireOwner(session, this.task(this.repository.read(), taskId));
    return this.withIdempotency(session, key, `revision:${taskId}`, body, state => {
      const previous = this.task(state, taskId);
      this.requireOwner(session, previous);
      if (previous.state !== 'rejected') throw new IncrementalBuildError('REJECTED_TASK_REQUIRED', '只能从已退回任务创建新草稿', 409);
      const timestamp = now();
      const revision = {
        id: identifier('inc'), name: body.name || previous.name, handbookId: previous.handbookId,
        businessVersion: previous.businessVersion, baselineVersionId: previous.baselineVersionId,
        baselineDigest: previous.baselineDigest, state: 'editing',
        sourceSnapshots: structuredClone(previous.sourceSnapshots), target: structuredClone(previous.target),
        draft: null, checks: null, candidate: null, reviews: [], publication: null, externalEvidence: [],
        revisionOf: previous.id, createdBy: actor(session), createdAt: timestamp, updatedAt: timestamp,
      };
      state.tasks.push(revision);
      this.audit(state, 'REJECTED_TASK_REVISED', revision.id, session, { revisionOf: previous.id });
      return this.project(revision, session);
    });
  }

  project(task, session, summary = false) {
    const owner = this.isOwner(session, task);
    const hasPendingReview = task.reviews.some(review => review.status === 'pending');
    const capabilities = {
      canEdit: owner && hasAction(session, 'knowledge:write') && EDITABLE_STATES.has(task.state),
      canReview: hasAction(session, 'review:manage') && task.state === 'under_review' && hasPendingReview,
      canPublish: hasAction(session, 'publish:manage') && task.state === 'approved',
      canComment: this.canComment(session, task),
      canRevise: owner && hasAction(session, 'knowledge:write') && task.state === 'rejected',
      canRecordEvidence: hasAction(session, 'publish:manage') && task.state === 'published',
    };
    const projection = structuredClone(task);
    projection.capabilities = capabilities;
    projection.candidateSummary = task.candidate ? { id: task.candidate.id, digest: task.candidate.digest, operationCount: task.candidate.operations.length, createdAt: task.candidate.createdAt } : null;
    projection.reviewSummary = { total: task.reviews.length, pending: task.reviews.filter(item => item.status === 'pending').length, approved: task.reviews.filter(item => item.status === 'approved').length, rejected: task.reviews.filter(item => item.status === 'rejected').length };
    if (summary) {
      delete projection.sourceSnapshots;
      delete projection.draft;
      delete projection.candidate;
      delete projection.reviews;
    }
    return projection;
  }
}

function readJsonBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) { reject(new IncrementalBuildError('REQUEST_TOO_LARGE', '请求内容过大', 413)); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (_) { reject(new IncrementalBuildError('INVALID_JSON', '请求内容不是有效 JSON', 400)); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}

function createIncrementalBuildHandler(options = {}) {
  const service = options.service || new IncrementalBuildService(options.repository || new FileIncrementalBuildRepository(options.repositoryPath));
  return async function handle(req, res, session) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const relative = url.pathname.replace(/^\/knowledge-center\/api\/incremental-tasks\/?/, '');
      const parts = relative.split('/').filter(Boolean).map(decodeURIComponent);
      const key = req.headers['idempotency-key'];
      let data;
      if (parts.length === 1 && parts[0] === 'baselines' && req.method === 'GET') data = service.listBaselines(session, Object.fromEntries(url.searchParams));
      else if (parts.length === 1 && parts[0] === 'online-reviews' && req.method === 'POST') data = service.createOnlineReview(session, key, await readJsonBody(req));
      else if (parts.length === 1 && parts[0] === 'bootstrap-baseline' && req.method === 'POST') data = service.createSyntheticBaseline(session, key, await readJsonBody(req));
      else if (parts.length === 3 && parts[0] === 'handbooks' && parts[2] === 'review-summary' && req.method === 'GET') data = service.listHandbookReviewSummary(session, parts[1], Object.fromEntries(url.searchParams));
      else if (!parts.length && req.method === 'GET') data = service.list(session, Object.fromEntries(url.searchParams));
      else if (!parts.length && req.method === 'POST') data = service.create(session, key, await readJsonBody(req));
      else if (parts.length === 1 && req.method === 'GET') data = service.get(session, parts[0]);
      else if (parts[1] === 'sources' && parts.length === 2 && req.method === 'POST') data = service.addSource(session, parts[0], key, await readJsonBody(req));
      else if (parts[1] === 'target' && parts.length === 2 && req.method === 'PATCH') data = service.updateTarget(session, parts[0], key, await readJsonBody(req));
      else if (parts[1] === 'draft' && parts.length === 2 && req.method === 'PUT') data = service.saveDraft(session, parts[0], key, await readJsonBody(req));
      else if (parts[1] === 'checks' && parts.length === 2 && req.method === 'POST') data = service.runChecks(session, parts[0], key, await readJsonBody(req));
      else if (parts[1] === 'candidate' && parts.length === 2 && req.method === 'POST') data = service.createCandidate(session, parts[0], key, await readJsonBody(req));
      else if (parts[1] === 'reviews' && parts.length === 2 && req.method === 'POST') data = service.submitReview(session, parts[0], key, await readJsonBody(req));
      else if (parts[1] === 'reviews' && parts.length === 3 && req.method === 'GET') data = service.getReview(session, parts[0], parts[2]);
      else if (parts[1] === 'reviews' && parts[3] === 'comments' && parts.length === 4 && req.method === 'GET') data = service.listReviewComments(session, parts[0], parts[2], Object.fromEntries(url.searchParams));
      else if (parts[1] === 'reviews' && parts[3] === 'comments' && parts.length === 4 && req.method === 'POST') data = service.commentOnReview(session, parts[0], parts[2], key, await readJsonBody(req));
      else if (parts[1] === 'reviews' && parts[3] === 'comments' && parts[5] === 'replies' && parts.length === 6 && req.method === 'POST') data = service.replyToComment(session, parts[0], parts[2], parts[4], key, await readJsonBody(req));
      else if (parts[1] === 'reviews' && parts[3] === 'comments' && parts[5] === 'resolve' && parts.length === 6 && req.method === 'POST') data = service.setCommentResolution(session, parts[0], parts[2], parts[4], key, 'resolve', await readJsonBody(req));
      else if (parts[1] === 'reviews' && parts[3] === 'comments' && parts[5] === 'reopen' && parts.length === 6 && req.method === 'POST') data = service.setCommentResolution(session, parts[0], parts[2], parts[4], key, 'reopen', await readJsonBody(req));
      else if (parts[1] === 'reviews' && parts[3] === 'comments' && parts[5] === 'link-operation' && parts.length === 6 && req.method === 'POST') data = service.linkCommentOperation(session, parts[0], parts[2], parts[4], key, await readJsonBody(req));
      else if (parts[1] === 'reviews' && parts[3] === 'decision' && parts.length === 4 && req.method === 'POST') data = service.decideReview(session, parts[0], parts[2], key, await readJsonBody(req));
      else if (parts[1] === 'ai-analysis' && parts.length === 2 && req.method === 'POST') data = service.runAiAnalysis(session, parts[0], key, await readJsonBody(req));
      else if (parts[1] === 'ai-analysis' && parts.length === 2 && req.method === 'GET') data = service.getAiAnalysis(session, parts[0]);
      else if (parts[1] === 'ai-fix-proposals' && parts.length === 2 && req.method === 'POST') data = service.createAiFixProposal(session, parts[0], key, await readJsonBody(req));
      else if (parts[1] === 'ai-fix-proposals' && parts.length === 2 && req.method === 'GET') data = service.listAiFixProposals(session, parts[0]);
      else if (parts[1] === 'publish' && parts.length === 2 && req.method === 'POST') data = service.publish(session, parts[0], key, await readJsonBody(req));
      else if (parts[1] === 'external-evidence' && parts.length === 2 && req.method === 'POST') data = service.addExternalEvidence(session, parts[0], key, await readJsonBody(req));
      else if (parts[1] === 'revisions' && parts.length === 2 && req.method === 'POST') data = service.createRevision(session, parts[0], key, await readJsonBody(req));
      else if (parts[1] === 'diff' && parts.length === 2 && req.method === 'GET') data = service.getCandidateDiff(session, parts[0]);
      else throw new IncrementalBuildError('ROUTE_NOT_FOUND', '增量构建接口不存在', 404);
      sendJson(res, parts.length || req.method === 'GET' ? 200 : 201, { success: true, data });
    } catch (error) {
      const known = error instanceof IncrementalBuildError;
      sendJson(res, known ? error.status : 500, { success: false, error: { code: known ? error.code : 'INCREMENTAL_BUILD_FAILED', message: known ? error.message : '增量构建处理失败', ...(error.details ? { details: error.details } : {}) } });
    }
  };
}

module.exports = {
  IncrementalBuildError,
  FileIncrementalBuildRepository,
  MemoryIncrementalBuildRepository,
  RepositoryBaselineProvider,
  IncrementalBuildService,
  createIncrementalBuildHandler,
};
