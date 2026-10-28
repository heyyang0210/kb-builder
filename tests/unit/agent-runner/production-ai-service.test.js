const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const { FileAggregateStore } = require('../../../packages/agent-runner-core/lib/aggregate-store');
const { createHandbookProductionService } = require('../../../packages/agent-runner-core/lib/handbook-production-service');

const editor = { user: { id: 'author' }, allowedActions: ['knowledge:read', 'knowledge:write'] };
const ctx = { handbookId: 'HB', documentId: 'doc', outlineVersionId: 'v1', branch: 'main' };
const base = { ...ctx, operation: 'polish', markdown: '前文旧句后文', range: { start: 2, end: 4 }, editVersion: 0 };
const tick = () => new Promise(resolve => setImmediate(resolve));

describe('AI 候选事务和范围保护', () => {
  let root;
  function setup(ai = {}, extras = {}) {
    return createHandbookProductionService({
      store: new FileAggregateStore(path.join(root, 'state.json'), { drafts: {}, idempotency: {}, audits: [] }),
      ai: { loadMCPConfig: async () => ({}), generate: async () => ({ content: '新句', model: 'isolated-test-model' }), ...ai },
      ...extras,
    });
  }
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'production-ai-')); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('候选不写草稿；显式采用原子保存且保留范围外正文，重试只采用一次', async () => {
    const service = setup();
    const job = service.ai.start(base, editor, 'generate');
    expect(service.getDraft(ctx, editor).exists).toBe(false);
    await tick();
    const completed = service.ai.get({ ...ctx, jobId: job.jobId }, editor);
    expect(completed.candidateMarkdown).toBe('前文新句后文');
    const input = { ...ctx, jobId: job.jobId, originalMarkdown: base.markdown, markdown: completed.candidateMarkdown, editVersion: 0 };
    const adopted = service.ai.adopt(input, editor);
    expect(adopted.draft.revision.markdown).toBe('前文新句后文\n');
    expect(adopted.draft.revision.generationMetadata.model).toBe('isolated-test-model');
    expect(service.ai.adopt(input, editor)).toEqual(adopted);
    expect(service.listRevisions(ctx, editor).items).toHaveLength(1);
    expect(() => service.ai.adopt({ ...input, markdown: '另一个结果' }, editor)).toThrow(expect.objectContaining({ code: 'AI_ADOPTION_CONFLICT' }));
  });

  test('请求幂等按作者和文档隔离，冲突请求不再次调用模型', async () => {
    const generate = jest.fn(async () => ({ content: '新句' }));
    const service = setup({ generate });
    const first = service.ai.start(base, editor, 'same');
    expect(service.ai.start(base, editor, 'same').jobId).toBe(first.jobId);
    expect(() => service.ai.start({ ...base, requirements: '不同要求' }, editor, 'same')).toThrow(expect.objectContaining({ code: 'AI_IDEMPOTENCY_CONFLICT' }));
    const other = service.ai.start({ ...base, documentId: 'other' }, editor, 'same');
    expect(other.jobId).not.toBe(first.jobId);
    expect(() => service.ai.get({ ...ctx, documentId: 'other', jobId: first.jobId }, editor)).toThrow(expect.objectContaining({ status: 404 }));
    expect(() => service.ai.get({ ...ctx, jobId: first.jobId }, { ...editor, user: { id: 'other' } })).toThrow(expect.objectContaining({ status: 404 }));
    await tick();
    expect(generate).toHaveBeenCalledTimes(2);
  });

  test('人工采用及后续普通保存保留生成历史，并使旧依据结论失效', async () => {
    const service = setup();
    const job = service.ai.start(base, editor, 'provenance'); await tick();
    const adopted = service.ai.adopt({ ...ctx, jobId: job.jobId, originalMarkdown: base.markdown, markdown: '前文人工新句后文', editVersion: 0 }, editor);
    const originalRevision = adopted.draft.revision;
    expect(originalRevision.generationMetadata.provenance[0].kind).toBe('human_edit');
    expect(originalRevision.generationMetadata.provenanceHistory[0].provenance[0].kind).toBe('model_inference');
    const saved = service.saveDraft({ ...ctx, markdown: '后续人工修订', editVersion: 1 }, editor, 'later-human-save');
    expect(saved.draft.revision.generationMetadata.taskId).toBe(job.jobId);
    expect(saved.draft.revision.generationMetadata.inheritedFromRevisionId).toBe(originalRevision.revisionId);
    expect(saved.draft.revision.generationMetadata.verification).toBe('needs_revalidation');
    expect(saved.draft.revision.generationMetadata.provenance[0].kind).toBe('human_edit');
    expect(service.listRevisions(ctx, editor).items).toHaveLength(2);
    expect(service.getDraft(ctx, editor).draft.revision.generationMetadata.provenanceHistory).toHaveLength(2);
  });

  test('取消立即生效且丢弃迟到的模型结果', async () => {
    let finish;
    const service = setup({ generate: () => new Promise(resolve => { finish = resolve; }) });
    const job = service.ai.start(base, editor, 'cancel');
    await tick();
    service.ai.cancel({ ...ctx, jobId: job.jobId }, editor);
    finish({ content: '迟到正文' }); await tick();
    const cancelled = service.ai.get({ ...ctx, jobId: job.jobId }, editor);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.candidateMarkdown).toBeUndefined();
    expect(service.getDraft(ctx, editor).exists).toBe(false);
  });

  test('租约过期可在重建服务后识别中断，迟到结果不复活任务', async () => {
    let time = Date.now(); let finish;
    const service = setup({ now: () => time, generate: () => new Promise(resolve => { finish = resolve; }) });
    const job = service.ai.start(base, editor, 'interrupt');
    await tick();
    time += 24 * 60 * 60 * 1000;
    const restarted = setup({ now: () => time });
    const interrupted = restarted.ai.get({ ...ctx, jobId: job.jobId }, editor);
    expect(interrupted.status).toBe('interrupted');
    expect(interrupted.stageRuns.filter(run => ['planner', 'evidence', 'writer', 'reviewer'].includes(run.stageId)))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ status: 'failed', errorCode: 'AI_JOB_INTERRUPTED' }),
      ]));
    finish({ content: '迟到' }); await tick();
    expect(service.ai.get({ ...ctx, jobId: job.jobId }, editor).status).toBe('interrupted');
    expect(restarted.ai.start(base, editor, 'retry').jobId).not.toBe(job.jobId);
    await tick();
  });

  test('重启恢复校验成功阶段产物并仅重试未完成 Writer', async () => {
    let time = Date.now(); let lateResult;
    const interrupted = setup({ now: () => time, generate: () => new Promise(resolve => { lateResult = resolve; }) });
    const started = interrupted.ai.start(base, editor, 'restart-recovery');
    await tick();
    time += 24 * 60 * 60 * 1000;
    const recovered = setup({ now: () => time, generate: async () => ({ content: '恢复候选' }) });
    expect(recovered.ai.recover()).toEqual({ recovered: 1 });
    await tick();
    const job = recovered.ai.get({ ...ctx, jobId: started.jobId }, editor);
    expect(job.status).toBe('completed');
    expect(job.stageRuns.filter(run => run.stageId === 'planner').map(run => run.status)).toEqual(['succeeded']);
    expect(job.stageRuns.filter(run => run.stageId === 'evidence').map(run => run.status)).toEqual(['succeeded']);
    expect(job.stageRuns.filter(run => run.stageId === 'writer').map(run => run.attempt)).toEqual([1, 2]);
    expect(job.artifacts.records.writer).toMatchObject({ stageId: 'writer', contractVersion: '1.0' });
    lateResult({ content: '迟到结果' }); await tick();
    expect(recovered.ai.get({ ...ctx, jobId: started.jobId }, editor).candidateMarkdown).toBe('前文恢复候选后文');
  });

  test('服务启动自动接管已过期租约并复用已验证阶段', async () => {
    let time = Date.now(); let lateResult;
    const running = setup({ now: () => time, generate: () => new Promise(resolve => { lateResult = resolve; }) });
    const started = running.ai.start(base, editor, 'startup-recovery');
    await tick();
    time += 24 * 60 * 60 * 1000;
    const recovered = setup({ now: () => time, generate: async () => ({ content: '启动恢复' }) }, { autoRecoverOnStart: true });
    let job = recovered.ai.get({ ...ctx, jobId: started.jobId }, editor);
    for (let attempt = 0; attempt < 10 && job.status !== 'completed'; attempt += 1) {
      await tick();
      job = recovered.ai.get({ ...ctx, jobId: started.jobId }, editor);
    }
    expect(job.status).toBe('completed');
    expect(job.stageRuns.filter(run => run.stageId === 'writer').map(run => run.attempt)).toEqual([1, 2]);
    lateResult({ content: '迟到启动结果' });
  });

  test('周期恢复扫描在服务存续期间接管过期任务且可停止', async () => {
    let time = Date.now(); let lateResult;
    const running = setup({ now: () => time, generate: () => new Promise(resolve => { lateResult = resolve; }) });
    const started = running.ai.start(base, editor, 'periodic-recovery');
    await tick();
    time += 24 * 60 * 60 * 1000;
    const recovered = setup({ now: () => time, generate: async () => ({ content: '周期恢复' }) }, { recoveryIntervalMs: 5 });
    try {
      let job = recovered.ai.get({ ...ctx, jobId: started.jobId }, editor);
      for (let attempt = 0; attempt < 100 && job.status !== 'completed'; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 5));
        job = recovered.ai.get({ ...ctx, jobId: started.jobId }, editor);
      }
      expect(job.status).toBe('completed');
      expect(job.stageRuns.filter(run => run.stageId === 'writer').map(run => run.attempt)).toEqual([1, 2]);
    } finally {
      recovered.stopRecoveryScheduler();
      lateResult({ content: '迟到周期结果' });
    }
  });

  test('恢复 claim 防止两个服务实例重复派发同一任务', async () => {
    let time = Date.now();
    const first = setup({ now: () => time, generate: () => new Promise(() => {}) }, { recoveryOwner: 'instance-a' });
    const started = first.ai.start(base, editor, 'recovery-claim');
    await tick();
    time += 24 * 60 * 60 * 1000;
    const second = setup({ now: () => time, generate: () => new Promise(() => {}) }, { recoveryOwner: 'instance-b' });
    expect(second.ai.recover()).toEqual({ recovered: 1 });
    expect(first.ai.recover()).toEqual({ recovered: 0 });
    const claimed = second.ai.get({ ...ctx, jobId: started.jobId }, editor);
    expect(['queued', 'running']).toContain(claimed.status);
    second.stopRecoveryScheduler();
  });

  test('阶段产物摘要损坏时恢复保持 interrupted', async () => {
    let time = Date.now();
    const running = setup({ now: () => time, generate: () => new Promise(() => {}) });
    const started = running.ai.start(base, editor, 'bad-recovery-artifact'); await tick();
    const stateFile = path.join(root, 'state.json');
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    state.aiJobs[started.jobId].artifacts.records.planner.digest = 'bad';
    fs.writeFileSync(stateFile, JSON.stringify(state));
    time += 24 * 60 * 60 * 1000;
    const restarted = setup({ now: () => time });
    expect(restarted.ai.recover()).toEqual({ recovered: 0 });
    expect(restarted.ai.get({ ...ctx, jobId: started.jobId }, editor).status).toBe('interrupted');
  });

  test('阶段产物正文独立存储，Job 聚合只保留可校验引用', async () => {
    const artifactState = { artifacts: {} };
    const artifactStore = {
      put: record => { artifactState.artifacts[record.artifactId] = structuredClone(record); return record; },
      get: artifactId => artifactState.artifacts[artifactId] || null,
    };
    const service = setup({ stageAdapters: {
      planner: { run: async () => ({ operation: 'polish', range: base.range, requirements: '', outline: '', plan: ['独立保存'] }) },
    } }, { aiArtifactStore: artifactStore });
    const started = service.ai.start(base, editor, 'artifact-boundary');
    await tick();
    const raw = JSON.parse(fs.readFileSync(path.join(root, 'state.json'), 'utf8'));
    const persistedJob = raw.aiJobs[started.jobId];
    expect(persistedJob.artifacts).toEqual(expect.objectContaining({ records: expect.any(Object) }));
    expect(persistedJob.artifacts.planner).toBeUndefined();
    const plannerRef = persistedJob.artifacts.records.planner;
    expect(artifactState.artifacts[plannerRef.artifactId].value.plan).toEqual(['独立保存']);
    expect(service.ai.get({ ...ctx, jobId: started.jobId }, editor).artifacts.planner.plan).toEqual(['独立保存']);
  });

  test('取消任务会闭合未完成阶段轨迹', async () => {
    let finish;
    const service = setup({ generate: () => new Promise(resolve => { finish = resolve; }) });
    const started = service.ai.start(base, editor, 'cancel-stage');
    await tick();
    const cancelled = service.ai.cancel({ ...ctx, jobId: started.jobId }, editor);
    expect(cancelled.stageRuns).toEqual(expect.arrayContaining([
      expect.objectContaining({ stageId: 'writer', status: 'failed', errorCode: 'AI_JOB_CANCELLED' }),
      expect.objectContaining({ stageId: 'reviewer', status: 'failed', errorCode: 'AI_JOB_CANCELLED' }),
    ]));
    expect(cancelled.stageRuns.find(run => run.stageId === 'planner')).toMatchObject({ status: 'succeeded' });
    expect(cancelled.stageRuns.find(run => run.stageId === 'evidence')).toMatchObject({ status: 'succeeded' });
    finish({ content: '迟到' });
  });

  test('Planner、Evidence 与 Reviewer 通过阶段 Adapter 执行并保存契约产物', async () => {
    const calls = [];
    const stageAdapters = {
      planner: { run: async (envelope, { payload }) => {
        calls.push(['planner', envelope.trace.attempt]);
        return { operation: payload.operation, range: payload.range, requirements: payload.requirements, outline: payload.outline, plan: ['按范围润色'] };
      } },
      evidence: { run: async (envelope, { payload }) => {
        calls.push(['evidence', envelope.trace.attempt]);
        return { sources: payload.sources.map(source => ({ sourceId: source.sourceId, contentDigest: source.contentDigest })) };
      } },
      reviewer: { run: async (envelope, { candidateDigest, provenance }) => {
        calls.push(['reviewer', envelope.trace.attempt]);
        return { status: 'contract_valid', candidateDigest, provenanceSegments: provenance.length };
      } },
    };
    const service = setup({ stageAdapters }, { loadSkillProfile: () => ({ skills: [] }) });
    const started = service.ai.start(base, editor, 'stage-adapters');
    await tick();
    const completed = service.ai.get({ ...ctx, jobId: started.jobId }, editor);
    expect(completed.status).toBe('completed');
    expect(calls).toEqual([['planner', 1], ['evidence', 1], ['reviewer', 1]]);
    expect(completed.artifacts.planner.plan).toEqual(['按范围润色']);
    expect(completed.stageRuns.filter(run => ['planner', 'evidence', 'reviewer'].includes(run.stageId)))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ stageId: 'planner', status: 'succeeded', attempt: 1 }),
        expect.objectContaining({ stageId: 'evidence', status: 'succeeded', attempt: 1 }),
        expect.objectContaining({ stageId: 'reviewer', status: 'succeeded', attempt: 1 }),
      ]));
  });

  test('Planner Adapter 产物越权时失败收口且不调用下游阶段', async () => {
    const downstream = jest.fn(async () => ({ content: '不应生成' }));
    const reviewer = jest.fn();
    const service = setup({
      generate: downstream,
      stageAdapters: {
        planner: { run: async () => ({ operation: 'generate', range: base.range, requirements: '', outline: '' }) },
        reviewer: { run: reviewer },
      },
    });
    const started = service.ai.start(base, editor, 'invalid-planner');
    await tick();
    const failed = service.ai.get({ ...ctx, jobId: started.jobId }, editor);
    expect(failed.status).toBe('failed');
    expect(failed.error.code).toBe('AI_STAGE_CONTRACT_INVALID');
    expect(failed.stageRuns.filter(run => ['planner', 'evidence', 'writer', 'reviewer'].includes(run.stageId)))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ stageId: 'planner', status: 'failed', errorCode: 'AI_STAGE_CONTRACT_INVALID' }),
        expect.objectContaining({ stageId: 'evidence', status: 'failed', errorCode: 'AI_STAGE_CONTRACT_INVALID' }),
      ]));
    expect(downstream).not.toHaveBeenCalled();
    expect(reviewer).not.toHaveBeenCalled();
  });

  test('冻结原文来源快照并记录 Writer 阶段轨迹', async () => {
    const content = base.markdown;
    const contentDigest = crypto.createHash('sha256').update(content).digest('hex');
    const service = setup();
    const started = service.ai.start({ ...base, originSnapshot: {
      originType: 'gitlab', snapshotId: 'commit-1', contentDigest, branch: 'main', path: 'docs/test.md', commitId: 'commit-1',
    }, document: { handbookId: 'HB', documentId: 'doc' } }, editor, 'origin-snapshot');
    expect(started.document.originType).toBe('gitlab');
    expect(started.document.baseSnapshotId).toBe('commit-1');
    expect(started.document.baseDigest).toBe(contentDigest);
    expect(started.stageRuns.find(run => run.stageId === 'writer')).toMatchObject({ stageId: 'writer', status: 'pending', attempt: 0, contractVersion: '1.0' });
    expect(started.artifacts).toMatchObject({
      planner: { operation: 'polish', range: base.range },
      evidence: { sourceIds: [], sourceDigests: [] },
    });
    await tick();
    const completed = service.ai.get({ ...ctx, jobId: started.jobId }, editor);
    expect(completed.stageRuns.find(run => run.stageId === 'writer')).toMatchObject({ stageId: 'writer', status: 'succeeded', attempt: 1, outputSummary: { chars: 2 } });
    expect(completed.stageRuns.find(run => run.stageId === 'planner')).toMatchObject({ status: 'succeeded', attempt: 1 });
    expect(completed.stageRuns.find(run => run.stageId === 'evidence')).toMatchObject({ status: 'succeeded', attempt: 1 });
    expect(completed.stageRuns.find(run => run.stageId === 'reviewer')).toMatchObject({ status: 'skipped', attempt: 0, outputSummary: { status: 'not_executed', reason: 'adapter_not_configured' } });
  });

  test('拒绝缺少 GitLab 定位信息的原文快照', () => {
    const service = setup();
    expect(() => service.ai.start({ ...base, originSnapshot: { originType: 'gitlab', contentDigest: 'bad' } }, editor, 'invalid-origin'))
      .toThrow(expect.objectContaining({ code: 'AI_ORIGIN_SNAPSHOT_INVALID', status: 409 }));
  });

  test('采用拒绝原文变化、范围外编辑以及其他作者的新版本', async () => {
    const service = setup();
    const job = service.ai.start(base, editor, 'conflict'); await tick();
    const input = { ...ctx, jobId: job.jobId, originalMarkdown: base.markdown, markdown: '前文人工新句后文', editVersion: 0 };
    expect(() => service.ai.adopt({ ...input, originalMarkdown: '已变正文' }, editor)).toThrow(expect.objectContaining({ code: 'AI_ORIGINAL_CONFLICT' }));
    expect(() => service.ai.adopt({ ...input, markdown: '范围外覆盖' }, editor)).toThrow(expect.objectContaining({ code: 'AI_RANGE_CONFLICT' }));
    service.saveDraft({ ...ctx, editVersion: 0, markdown: '其他作者内容' }, editor, 'other-save');
    expect(() => service.ai.adopt(input, editor)).toThrow(expect.objectContaining({ code: 'DRAFT_VERSION_CONFLICT' }));
    expect(service.getDraft(ctx, editor).draft.revision.markdown).toBe('其他作者内容\n');
  });

  test('输入校验保护 Unicode、插入范围和模板，失败不写入草稿', () => {
    const service = setup();
    for (const payload of [
      { ...base, range: { start: -1, end: 2 } },
      { ...base, markdown: '😀正文', range: { start: 1, end: 2 } },
      { ...base, operation: 'continue' },
    ]) expect(() => service.ai.start(payload, editor, 'invalid')).toThrow(expect.objectContaining({ code: 'AI_RANGE_INVALID' }));
    expect(() => service.ai.start({ ...base, operation: 'rewrite' }, editor, 'template')).toThrow(expect.objectContaining({ code: 'AI_TEMPLATE_REQUIRED' }));
    expect(() => service.ai.start(base, { user: { id: 'reader' }, allowedActions: ['knowledge:read'] }, 'denied')).toThrow(expect.objectContaining({ status: 403 }));
  });

  test.each(['generate', 'rewrite', 'update', 'continue'])('%s 固定规则和模板，并只拼接对应片段', async operation => {
    const generate = jest.fn(async () => ({ content: '新内容', model: 'test' }));
    const snapshot = { templateId: 'tpl', templateVersion: 1, templateContent: '# 测试结构', templateHash: 'fixed' };
    const service = setup({ generate, resolveTemplate: () => snapshot });
    const input = { ...base, operation, templateId: 'tpl', range: operation === 'continue' ? { start: 2, end: 2 } : base.range };
    const job = service.ai.start(input, editor, operation); await tick();
    expect(JSON.parse(generate.mock.calls[0][0][1].content).template).toBe('# 测试结构');
    const candidate = service.ai.get({ ...ctx, jobId: job.jobId }, editor);
    expect(candidate.candidateMarkdown).toBe(operation === 'continue' ? '前文新内容旧句后文' : '前文新内容后文');
    expect(candidate.metadata.template.templateVersion).toBe(1);
  });

  test('按模板改写闭环：冻结模板、重组指定范围并保存后回读', async () => {
    const generate = jest.fn(async messages => {
      const payload = JSON.parse(messages[1].content);
      expect(payload.operation).toBe('rewrite');
      expect(payload.template).toBe('# 标准章节\n\n## 配置\n\n## 验证');
      expect(payload.selectedContent).toBe('旧配置\n旧验证\n');
      return { content: '## 配置\n\n新配置\n\n## 验证\n\n新验证', model: 'isolated-rewrite-model' };
    });
    const snapshot = {
      templateId: 'standard', templateVersion: 3,
      templateContent: '# 标准章节\n\n## 配置\n\n## 验证', templateHash: 'template-v3',
    };
    const service = setup({ generate, resolveTemplate: () => snapshot });
    const original = '前置说明\n旧配置\n旧验证\n后置说明';
    const start = original.indexOf('旧配置');
    const end = original.indexOf('后置说明');
    const job = service.ai.start({ ...ctx, operation: 'rewrite', markdown: original,
      range: { start, end }, editVersion: 0, templateId: 'standard',
      requirements: '保持范围外说明不变', outline: '# 标准章节' }, editor, 'rewrite-e2e');
    await tick();
    const candidate = service.ai.get({ ...ctx, jobId: job.jobId }, editor);
    expect(candidate.status).toBe('completed');
    expect(candidate.candidateMarkdown).toBe('前置说明\n## 配置\n\n新配置\n\n## 验证\n\n新验证后置说明');
    expect(candidate.metadata.template).toEqual(snapshot);
    const adopted = service.ai.adopt({ ...ctx, jobId: job.jobId, originalMarkdown: original,
      markdown: candidate.candidateMarkdown, editVersion: 0 }, editor);
    expect(adopted.draft.revision.markdown).toBe(`${candidate.candidateMarkdown}\n`);
    expect(service.getDraft(ctx, editor).draft.revision.markdown).toBe(`${candidate.candidateMarkdown}\n`);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test('模型错误与空结果如实失败且不泄露提供方错误正文', async () => {
    for (const generate of [async () => { throw new Error('secret-api-key'); }, async () => ({ content: '' })]) {
      const service = setup({ generate });
      const job = service.ai.start(base, editor, crypto.randomUUID()); await tick();
      const failed = service.ai.get({ ...ctx, jobId: job.jobId }, editor);
      expect(failed.status).toBe('failed');
      expect(JSON.stringify(failed)).not.toContain('secret-api-key');
      expect(service.getDraft(ctx, editor).exists).toBe(false);
    }
  });

  test('失败 Writer 重试追加 attempt、保留旧失败轨迹并按幂等键只派发一次', async () => {
    let calls = 0;
    const generate = jest.fn(async () => {
      calls++;
      if (calls === 1) throw new Error('temporary provider failure');
      return { content: '重试成功' };
    });
    const service = setup({ generate });
    const started = service.ai.start(base, editor, 'retry-start');
    await tick();
    const failed = service.ai.get({ ...ctx, jobId: started.jobId }, editor);
    expect(failed.status).toBe('failed');
    const firstWriter = failed.stageRuns.find(run => run.stageId === 'writer');
    const firstReviewer = failed.stageRuns.find(run => run.stageId === 'reviewer');
    expect(firstWriter).toMatchObject({ status: 'failed', attempt: 1 });

    const retryInput = { ...ctx, jobId: started.jobId };
    const retrying = service.ai.retry(retryInput, editor, 'retry-once');
    expect(retrying.status).toBe('queued');
    expect(retrying.stageRuns).toHaveLength(failed.stageRuns.length + 2);
    expect(retrying.stageRuns).toEqual(expect.arrayContaining([
      firstWriter,
      firstReviewer,
      expect.objectContaining({ stageId: 'writer', status: 'pending', attempt: 2, retryOfStageRunId: firstWriter.stageRunId }),
      expect.objectContaining({ stageId: 'reviewer', status: 'pending', attempt: 1, retryOfStageRunId: firstReviewer.stageRunId }),
    ]));
    expect(service.ai.retry(retryInput, editor, 'retry-once').jobId).toBe(started.jobId);
    await tick();
    const completed = service.ai.get(retryInput, editor);
    expect(completed.status).toBe('completed');
    expect(completed.candidateMarkdown).toBe('前文重试成功后文');
    expect(completed.stageRuns.filter(run => run.stageId === 'writer').map(run => run.status)).toEqual(['failed', 'succeeded']);
    expect(completed.stageRuns.filter(run => run.stageId === 'writer').map(run => run.attempt)).toEqual([1, 2]);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  test('运行中或已完成任务不允许使用新幂等键重试', async () => {
    let finish;
    const service = setup({ generate: () => new Promise(resolve => { finish = resolve; }) });
    const started = service.ai.start(base, editor, 'retry-state');
    await tick();
    expect(() => service.ai.retry({ ...ctx, jobId: started.jobId }, editor, 'retry-running'))
      .toThrow(expect.objectContaining({ code: 'AI_JOB_NOT_RETRYABLE', status: 409 }));
    finish({ content: '首次成功' }); await tick();
    expect(() => service.ai.retry({ ...ctx, jobId: started.jobId }, editor, 'retry-completed'))
      .toThrow(expect.objectContaining({ code: 'AI_JOB_NOT_RETRYABLE', status: 409 }));
  });

  test('损坏来源协议不成为候选，不覆盖当前草稿且不泄露模型正文', async () => {
    const service = setup({ generate: async () => ({ content: '{"provenance":[],"private":"secret-provider-text"}' }) });
    const saved = service.saveDraft({ ...ctx, markdown: '保留当前草稿', editVersion: 0 }, editor, 'original');
    const job = service.ai.start({ ...base, markdown: saved.draft.revision.markdown, editVersion: 1 }, editor, 'bad-envelope');
    await tick();
    const failed = service.ai.get({ ...ctx, jobId: job.jobId }, editor);
    expect(failed.status).toBe('failed');
    expect(failed.candidateMarkdown).toBeUndefined();
    expect(JSON.stringify(failed)).not.toContain('secret-provider-text');
    expect(service.getDraft(ctx, editor).draft.revision).toEqual(saved.draft.revision);
  });

  test('登记新增 Skill 后可发现、选用并改变续写，冻结指令和版本并追溯到采用草稿', async () => {
    const skillFile = path.join(root, 'SKILL.md');
    fs.writeFileSync(skillFile, '续写必须补充可核验的执行前提。');
    const rules = JSON.parse(fs.readFileSync(require('../../../packages/agent-runner-core/lib/config-registry').CONFIG_PATHS.contentRules)).productionAI;
    rules.skills = [{ skillId: 'new-continuation', displayName: '新续写能力', description: '补充执行前提', operations: ['continue'] }];
    const runtime = { profile: { skills: [] }, resources: [] };
    let finish;
    const generate = jest.fn(messages => new Promise(resolve => { finish = () => resolve({ content: messages.some(message => message.role === 'system' && message.content.includes('执行前提')) ? '执行前提：授权测试库。' : '普通续写' }); }));
    const service = setup({ rules, loadSkillProfile: () => runtime, generate });
    expect(() => service.ai.skills.list(ctx, editor)).toThrow(expect.objectContaining({ code: 'AI_SKILL_UNAVAILABLE' }));
    runtime.profile.skills.push({ id: 'new-continuation', version: '1.0.0', manifestRef: 'knowledge/skills/new-continuation/SKILL.md' });
    runtime.resources.push({ reference: 'knowledge/skills/new-continuation/SKILL.md', path: skillFile });
    const skill = service.ai.skills.list(ctx, editor).items[0];
    expect(JSON.stringify(skill)).not.toContain(root);
    const input = { ...base, operation: 'continue', range: { start: 2, end: 2 }, selectedSkills: [{ skillId: skill.skillId, contentDigest: skill.contentDigest }] };
    const started = service.ai.start(input, editor, 'skill');
    await tick();
    fs.writeFileSync(skillFile, '修改后的新版本指令');
    finish(); await tick();
    const job = service.ai.get({ ...ctx, jobId: started.jobId }, editor);
    expect(job.candidateMarkdown).toBe('前文执行前提：授权测试库。旧句后文');
    expect(job.metadata.skillVersions[0].content).toBe('续写必须补充可核验的执行前提。');
    expect(service.ai.start(input, editor, 'skill').jobId).toBe(started.jobId);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(() => service.ai.start(input, editor, 'stale-skill')).toThrow(expect.objectContaining({ code: 'AI_SKILL_VERSION_CONFLICT', status: 409 }));
    expect(() => service.ai.start({ ...input, selectedSkills: [input.selectedSkills[0], input.selectedSkills[0]] }, editor, 'duplicate')).toThrow(expect.objectContaining({ code: 'AI_SKILL_SELECTION_INVALID' }));
    expect(() => service.ai.start({ ...input, operation: 'polish' }, editor, 'wrong-operation')).toThrow(expect.objectContaining({ code: 'AI_SKILL_OPERATION_INVALID' }));
    const adopted = service.ai.adopt({ ...ctx, jobId: job.jobId, originalMarkdown: base.markdown, markdown: job.candidateMarkdown, editVersion: 0 }, editor);
    expect(adopted.draft.revision.generationMetadata.skillVersions[0].contentDigest).toBe(skill.contentDigest);
  });
});

describe('Writer 完成后的审核重试', () => {
  test('保留正文和实际模型，只重试失败审核阶段', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'production-review-retry-'));
    let release; let attempt = 0;
    const generate = jest.fn(async () => ({ content: '审核中的正文', model: 'actual-writer-model', usage: { total_tokens: 9 } }));
    const reviewer = jest.fn(async (_envelope, input) => {
      attempt++;
      if (attempt === 1) await new Promise(resolve => { release = resolve; });
      if (attempt === 1) throw new Error('temporary reviewer failure');
      return { status: 'contract_valid', candidateDigest: input.candidateDigest, provenanceSegments: input.provenance.length };
    });
    try {
      const service = createHandbookProductionService({
        store: new FileAggregateStore(path.join(root, 'state.json'), { drafts: {}, idempotency: {}, audits: [] }),
        ai: { loadMCPConfig: async () => ({}), generate, stageAdapters: { reviewer: { run: reviewer } } },
      });
      const started = service.ai.start(base, editor, 'review-start'); await tick();
      const running = service.ai.get({ ...ctx, jobId: started.jobId }, editor);
      expect(running.status).toBe('running');
      expect(running.stageRuns.find(run => run.stageId === 'writer').status).toBe('succeeded');
      expect(running.executionPreview.text).toBe('审核中的正文');
      expect(running.artifacts.writer.fragment).toBe('审核中的正文');
      expect(running.fragment).toBeUndefined();
      release(); await tick();
      expect(service.ai.get({ ...ctx, jobId: started.jobId }, editor).status).toBe('failed');
      service.ai.retry({ ...ctx, jobId: started.jobId }, editor, 'review-retry'); await tick(); await tick();
      const completed = service.ai.get({ ...ctx, jobId: started.jobId }, editor);
      expect(completed.status).toBe('completed');
      expect(generate).toHaveBeenCalledTimes(1);
      expect(reviewer).toHaveBeenCalledTimes(2);
      expect(completed.metadata.model).toBe('actual-writer-model');
      expect(completed.metadata.usage.total_tokens).toBe(9);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
