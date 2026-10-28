const crypto = require('crypto');
const { isDeepStrictEqual } = require('util');
const fs = require('fs');
const { loadProfile } = require('./platform-profile/profile-loader');

const DEFAULT_SKILLS = [
  { skillId: 'extract-document-cases', version: '1.0.0' },
  { skillId: 'execute-yashandb-cases', version: '1.0.0' },
  { skillId: 'compare-case-results', version: '1.0.0' },
  { skillId: 'render-test-report', version: '1.0.0' },
];

function createProductionQualityService(options = {}) {
  const store = options.store;
  const db = options.yashanDB || null;
  const skills = options.skills || DEFAULT_SKILLS;
  const contentQuality = require('./production-content-quality').createProductionContentQuality(options.contentQuality);
  const now = options.now || (() => Date.now());
  const actor = options.actor || (() => ({ id: 'unknown', displayName: '未知用户' }));
  const requireCapability = options.requireCapability || ((session, capability) => {
    if (capability === 'canEdit' && !(session?.allowedActions || []).includes('knowledge:write')) fail('QUALITY_FORBIDDEN', '当前用户无权执行质量检查', 403);
    if (capability === 'canRead' && !(session?.allowedActions || []).some(item => item === 'knowledge:read' || item === 'knowledge:write')) fail('QUALITY_FORBIDDEN', '当前用户无权读取质量报告', 403);
  });
  const contextKey = options.contextKey;
  const fail = (code, message, status = 400) => { const error = new Error(message); error.code = code; error.status = status; throw error; };
  const digest = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

  function resolveSkills() {
    const runtime = options.loadSkillProfile ? options.loadSkillProfile() : (global.__KNOWLEDGE_PLATFORM_PROFILE_RUNTIME__ || loadProfile());
    if (skills.length !== DEFAULT_SKILLS.length || skills.some((item, index) => item.skillId !== DEFAULT_SKILLS[index].skillId)) {
      fail('QUALITY_SKILL_CONFIG_INVALID', '质量检查能力配置不完整或顺序不一致', 503);
    }
    return skills.map(item => {
      const entries = runtime.profile.skills.filter(entry => entry.id === item.skillId);
      const entry = entries[0];
      const resource = entry && runtime.resources.find(value => value.reference === entry.manifestRef);
      if (entries.length !== 1 || !resource || !entry.version || (item.version && item.version !== entry.version)) {
        fail('QUALITY_SKILL_UNAVAILABLE', '质量检查能力未登记、版本冲突或资源不可用', 503);
      }
      const content = fs.readFileSync(resource.path, 'utf8');
      if (!content.trim()) fail('QUALITY_SKILL_UNAVAILABLE', '质量检查能力内容为空', 503);
      return { skillId: entry.id, version: entry.version, reference: entry.manifestRef, contentDigest: digest(content) };
    });
  }

  function casesFrom(markdown) {
    const cases = []; const re = /```sql\s*([\s\S]*?)```/gi; let match;
    while ((match = re.exec(String(markdown || '')))) {
      // The storage quality endpoint accepts one statement without a client
      // delimiter; fenced documentation examples commonly include `;`.
      const sql = match[1].trim().replace(/;\s*$/, '');
      if (!sql) continue;
      const declaration = /^\s*```json[ \t]+quality-expected[ \t]*\r?\n([\s\S]*?)```/i.exec(markdown.slice(re.lastIndex));
      let expected = null; let expectationError = null;
      if (declaration) {
        try {
          expected = JSON.parse(declaration[1]);
          if (!expected || Array.isArray(expected) || !Array.isArray(expected.rows) ||
              Object.keys(expected).some(key => !['columns', 'rows'].includes(key)) ||
              (expected.columns !== undefined && (!Array.isArray(expected.columns) || expected.columns.some(column => typeof column !== 'string')))) {
            throw new Error('invalid expectation');
          }
        } catch (_) { expected = null; expectationError = 'QUALITY_EXPECTATION_INVALID'; }
      }
      cases.push({ caseId: `case-${crypto.createHash('sha256').update(`${match.index}:${sql}`).digest('hex').slice(0, 12)}`, sql,
        documentStart: match.index, documentEnd: re.lastIndex, expected, expectationError,
        expectationLocation: declaration ? { start: re.lastIndex + declaration[0].indexOf('```'), end: re.lastIndex + declaration[0].length } : null,
        source: 'document' });
    }
    return cases;
  }
  function referenceCases(cases, markdown, revision) {
    const metadata = revision?.generationMetadata;
    const validRange = (text, range) => Number.isSafeInteger(range?.start) && Number.isSafeInteger(range?.end)
      && range.start >= 0 && range.end > range.start && range.end <= text.length
      && [range.start, range.end].every(offset => !(offset > 0 && offset < text.length
        && /[\uD800-\uDBFF]/.test(text[offset - 1]) && /[\uDC00-\uDFFF]/.test(text[offset])));
    return cases.map(item => {
      const references = [];
      for (const segment of metadata?.provenance || []) {
        if (!['direct_quote', 'source_summary'].includes(segment.kind) || !validRange(markdown, segment)) continue;
        const start = Math.max(segment.start, item.documentStart); const end = Math.min(segment.end, item.documentEnd);
        if (start >= end) continue;
        for (const evidence of segment.evidence || []) {
          const source = metadata.sourceSnapshots?.find(value => value.sourceId === evidence.sourceId);
          if (typeof source?.content !== 'string' || digest(source.content) !== source.contentDigest || !validRange(source.content, evidence)) continue;
          let sourceRange = { start: evidence.start, end: evidence.end };
          if (segment.kind === 'direct_quote') {
            if (markdown.slice(segment.start, segment.end) !== source.content.slice(evidence.start, evidence.end)) continue;
            sourceRange = { start: evidence.start + start - segment.start, end: evidence.start + end - segment.start };
          }
          references.push({ sourceId: source.sourceId, sourceType: source.sourceType, locator: source.locator,
            title: source.title, contentDigest: source.contentDigest, sourceVersion: source.sourceVersion ?? null,
            fetchedAt: source.fetchedAt ?? null, kind: segment.kind,
            verification: segment.kind === 'direct_quote' ? 'text_matched' : 'unverified',
            documentRange: { start, end }, sourceRange });
        }
      }
      return { ...item, references, sourceTrace: references.length ? 'linked' : revision ? 'no_verified_reference' : 'unavailable_revision' };
    });
  }
  async function run(input, session) {
    requireCapability(session, 'canEdit');
    const ctx = { handbookId: input.handbookId, documentId: input.documentId, outlineVersionId: input.outlineVersionId, branch: input.branch };
    if (!ctx.handbookId || !ctx.documentId || !ctx.outlineVersionId || !ctx.branch) fail('QUALITY_CONTEXT_REQUIRED', '缺少质量检查上下文');
    if (typeof input.markdown !== 'string' || !input.markdown.trim()) fail('QUALITY_DOCUMENT_REQUIRED', '缺少待检查文档');
    const state = store.read();
    const revision = state.drafts?.[contextKey?.(input)]?.revisions?.find(item => item.revisionId === input.revisionId);
    if (revision && digest(revision.markdown) !== digest(input.markdown)) fail('QUALITY_CONTENT_MISMATCH', '草稿正文与被测正文不一致，请对已保存版本重新检查', 409);
    let contentInput = null;
    if (input.checkContent === true) {
      if (!revision) fail('QUALITY_REVISION_NOT_FOUND', '内容检查需要已保存的草稿修订', 409);
      const metadata = revision.generationMetadata;
      const job = metadata?.taskId && state.aiJobs?.[metadata.taskId];
      const requirements = job && Object.keys(ctx).every(key => job.context?.[key] === ctx[key]) ? job.requirements : '';
      contentInput = { markdown: input.markdown, revision, metadata, requirements };
    }
    let rerunOf = null;
    if (input.rerunOfReportId) {
      const previous = store.read().qualityReports?.[String(input.rerunOfReportId)];
      if (!previous || Object.keys(ctx).some(key => previous.document[key] !== ctx[key])) {
        fail('QUALITY_RERUN_REPORT_NOT_FOUND', '要复测的质量报告不存在或不属于当前文档', 404);
      }
      rerunOf = { reportId: previous.reportId, contentDigest: previous.document.contentDigest, gate: previous.gate };
    }
    const resolvedSkills = resolveSkills();
    const skillInvocations = [];
    const implementationDigest = digest(fs.readFileSync(__filename, 'utf8'));
    const report = { reportId: `quality-${crypto.randomUUID()}`, status: 'running', createdAt: new Date(now()).toISOString(),
      actor: actor(session), document: { ...ctx, contentDigest: digest(input.markdown), revisionId: input.revisionId || null },
      database: { adapter: db ? 'yashandb' : null, version: db?.version || null, environment: db?.environment || null },
      skills: resolvedSkills, skillInvocations, coverage: { total: 0, executed: 0, passed: 0, failed: 0, notExecuted: 0 }, cases: [],
      limitations: [], rerunOf, gate: 'not_passed' };
    if (contentInput) report.contentQuality = await contentQuality(contentInput);
    const handlers = {
      'extract-document-cases': async ({ markdown, revision }) => referenceCases(casesFrom(markdown), markdown, revision),
      'execute-yashandb-cases': async ({ cases }) => {
        const executions = [];
        for (const item of cases) {
          const row = { ...item, actual: null, error: null, attempts: 0 };
          if (item.expectationError) row.error = item.expectationError;
          else if (!db || typeof db.execute !== 'function') row.error = '未配置有权限的 YashanDB 测试库';
          else {
            row.attempts = 1;
            try { row.actual = await db.execute(item.sql, { testRunId: report.reportId, context: ctx }); }
            catch (error) { row.error = String(error.code || 'YASHANDB_EXECUTION_FAILED'); }
          }
          executions.push(row);
        }
        return executions;
      },
      'compare-case-results': async ({ executions }) => executions.map(item => {
        const row = { ...item, status: 'not_executed', comparison: item.expected ? 'pending' : 'not_provided' };
        if (!item.attempts || ['STORAGE_UNAVAILABLE', 'STORAGE_TIMEOUT', 'QUALITY_SQL_READ_ONLY', 'QUALITY_DATABASE_NOT_CONFIGURED'].includes(item.error)) return row;
        if (item.error) { row.status = 'failed'; return row; }
        if (item.actual?.truncated) {
          row.status = 'failed'; row.error = 'QUALITY_RESULT_TRUNCATED'; row.comparison = 'incomplete';
        } else if (item.expected) {
          const matches = Object.keys(item.expected).every(key => isDeepStrictEqual(item.actual?.[key], item.expected[key]));
          row.status = matches ? 'passed' : 'failed'; row.comparison = matches ? 'matched' : 'mismatched';
          if (!matches) row.error = 'QUALITY_EXPECTATION_MISMATCH';
        } else row.status = 'passed';
        return row;
      }),
      'render-test-report': async ({ cases }) => {
        const coverage = { total: cases.length, executed: 0, passed: 0, failed: 0, notExecuted: 0 };
        for (const item of cases) {
          if (item.status === 'not_executed') coverage.notExecuted++;
          else { coverage.executed++; coverage[item.status]++; }
        }
        const limitations = [];
        if (!db) limitations.push('未执行：缺少有权限的 YashanDB 测试库连接');
        if (cases.some(item => item.sourceTrace !== 'linked')) limitations.push('部分用例没有已保存的可核验引用关联，请回查正文来源；不会自动认定来自测试用例库');
        if (cases.some(item => !item.expected && !item.expectationError)) limitations.push('部分用例未声明预期结果：仅验证 SQL 执行，不代表结果正确性已核验');
        return { cases, coverage, limitations,
          database: { adapter: db ? 'yashandb' : null, version: db?.version || null, environment: db?.environment || null },
          gate: coverage.notExecuted === 0 && coverage.failed === 0 && coverage.total > 0 ? 'passed' : 'not_passed' };
      },
      // Only trusted server-side dependency injection; never populated from HTTP input.
      ...options.skillHandlers,
    };
    async function invokeSkill(skill, payload, summary) {
      const invocation = { invocationId: `quality-skill-${crypto.randomUUID()}`, skillId: skill.skillId, version: skill.version,
        reference: skill.reference, contentDigest: skill.contentDigest, implementationDigest,
        handlerDigest: digest(String(handlers[skill.skillId])),
        startedAt: new Date(now()).toISOString(), finishedAt: null, status: 'running',
        input: { digest: digest(payload), summary }, output: null };
      skillInvocations.push(invocation);
      try {
        const result = await handlers[skill.skillId](payload);
        invocation.output = { digest: digest(result), summary: Array.isArray(result) ? { count: result.length } : { coverage: result.coverage, gate: result.gate } };
        invocation.status = 'succeeded';
        return result;
      } catch (error) {
        invocation.status = 'failed';
        invocation.error = String(error.code || 'QUALITY_SKILL_FAILED');
        throw error;
      } finally { invocation.finishedAt = new Date(now()).toISOString(); }
    }
    try {
      const cases = await invokeSkill(resolvedSkills[0], { markdown: input.markdown, revision }, { documentDigest: report.document.contentDigest });
      const executions = await invokeSkill(resolvedSkills[1], { cases }, { caseCount: cases.length });
      const compared = await invokeSkill(resolvedSkills[2], { executions }, { caseCount: executions.length });
      const rendered = await invokeSkill(resolvedSkills[3], { cases: compared }, { caseCount: compared.length });
      Object.assign(report, rendered, { status: 'completed' });
      report.sqlGate = rendered.gate;
      if (report.contentQuality?.gate === 'not_passed') report.gate = 'not_passed';
    } catch (error) {
      report.status = 'failed';
      report.error = { code: String(error.code || 'QUALITY_SKILL_FAILED'), skillId: skillInvocations.at(-1)?.skillId };
      report.limitations.push('质量能力执行中断，后续阶段未执行；本报告不能作为检查通过的证据');
    }
    return store.transaction(state => { state.qualityReports ||= {}; state.qualityReports[report.reportId] = report; return structuredClone(report); });
  }
  function get(input, session) {
    requireCapability(session, 'canRead');
    const report = store.read().qualityReports?.[input.reportId];
    if (!report || report.document.handbookId !== input.handbookId || report.document.documentId !== input.documentId) fail('QUALITY_REPORT_NOT_FOUND', '质量报告不存在', 404);
    return structuredClone(report);
  }
  function linkToRevision(input, session) {
    requireCapability(session, 'canEdit');
    return store.transaction(state => {
      const report = state.qualityReports?.[input.reportId];
      if (!report || report.document.handbookId !== input.handbookId || report.document.documentId !== input.documentId) fail('QUALITY_REPORT_NOT_FOUND', '质量报告不存在', 404);
      const draft = state.drafts?.[contextKey?.(input)];
      const revision = draft?.revisions?.find(item => item.revisionId === (input.revisionId || report.document.revisionId));
      if (!revision) fail('QUALITY_REVISION_NOT_FOUND', '质量报告绑定的草稿修订不存在', 409);
      if (['handbookId', 'documentId', 'outlineVersionId', 'branch'].some(key => report.document[key] !== input[key]) ||
          (report.document.revisionId && report.document.revisionId !== revision.revisionId)) {
        fail('QUALITY_REVISION_MISMATCH', '质量报告与草稿修订上下文不一致，请对该版本重新检查', 409);
      }
      const contentDigest = crypto.createHash('sha256').update(revision.markdown).digest('hex');
      if (contentDigest !== report.document.contentDigest) {
        fail('QUALITY_CONTENT_MISMATCH', '草稿正文与被测正文不一致，请对已保存版本重新检查', 409);
      }
      revision.qualityReport = { reportId: report.reportId, gate: report.gate, contentDigest: report.document.contentDigest, linkedAt: new Date(now()).toISOString() };
      report.revisionLinked = revision.revisionId;
      return structuredClone(report);
    });
  }
  return { run, get, linkToRevision, skills };
}
module.exports = { createProductionQualityService, DEFAULT_SKILLS };
