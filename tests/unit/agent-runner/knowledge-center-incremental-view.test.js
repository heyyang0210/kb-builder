const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('增量构建前端契约', () => {
  const view = () => read('apps/knowledge-center-web/frontend/knowledge-center/modules/production/view.js');
  const api = () => read('apps/knowledge-center-web/frontend/knowledge-center/common/api/incremental-api.js');
  const app = () => read('apps/knowledge-center-web/frontend/knowledge-center/app.js');

  test('使用后端冻结的资源路由和业务状态', () => {
    expect(api()).toContain("const endpoint = '/knowledge-center/api/incremental-tasks'");
    for (const pathName of ['sources', 'target', 'draft', 'checks', 'candidate', 'reviews', 'publish', 'external-evidence']) expect(api()).toContain(`'${pathName}'`);
    for (const state of ['draft', 'editing', 'checked', 'candidate_ready', 'under_review', 'approved', 'rejected', 'published']) expect(view()).toContain(`${state}:`);
  });

  test('所有写操作携带幂等键且错误不会被当成成功', () => {
    expect(api()).toContain("'Idempotency-Key': commandKey");
    expect(api()).toContain('pendingKeys.get(commandSignature)');
    expect(api()).toContain('pendingKeys.delete(commandSignature)');
    expect(api()).toContain('payload?.success === false');
    expect(api()).toContain("knowledge-center:session-expired");
    expect(api()).toContain("knowledge-center:permission-denied");
  });

  test('工作区覆盖平台内闭环并禁止伪造外部成功', () => {
    for (const label of ['来源材料', '修改范围', '增量草稿', '完整性检查', '审核与发布', '登记外部证据']) expect(view()).toContain(label);
    expect(view()).toContain('人工选择');
    expect(view()).not.toContain('GitLab（尚未接入）');
    expect(app()).toContain('expectedCandidateDigest: task?.candidate?.digest');
  });

  test('草稿、范围和外部证据字段与 DTO 一致', () => {
    for (const field of ['businessVersion', 'baselineVersionId', 'sourceType', 'documentIds', 'sectionIds', 'editVersion', 'operations', 'reference', 'note']) expect(app() + view()).toContain(field);
    expect(view()).toContain('data-incremental-review-decision="reject"');
    expect(view()).not.toContain('request_changes');
    expect(view()).toContain('data-incremental-comment-form');
    expect(view()).toContain('data-incremental-revision');
    expect(view()).toContain('task.capabilities?.canReview');
    expect(view()).toContain('task.capabilities?.canRecordEvidence');
    expect(view()).toContain('data-incremental-load-baselines');
    expect(view()).not.toContain('<input name="baselineVersionId"');
  });

  test('增量工作区使用独立响应式样式', () => {
    const html = read('apps/knowledge-center-web/frontend/knowledge-center/knowledge-center-management.html');
    const css = read('apps/knowledge-center-web/frontend/knowledge-center/modules/production/production.css');
    expect(html).toContain('./modules/production/production.css');
    expect(css).toContain('.incremental-workspace');
    expect(css).toContain('@media (max-width: 800px)');
    expect(css).toContain('@media (max-width: 560px)');
  });

  test('审核与发布采用三步页面并保留完整差异和行级意见', () => {
    const review = read('apps/knowledge-center-web/frontend/knowledge-center/modules/review-publishing/view.js');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(review).toContain('1 阅读文档');
    expect(review).toContain('2 查看修改');
    expect(review).toContain('3 处理审核意见');
    expect(review).toContain('修改前后全文对照');
    expect(review).toContain('data-review-line');
    expect(review).toContain('data-review-comment-form');
    expect(review).toContain('待审核版本：修改稿');
    expect(review).not.toContain('审核收件箱');
    expect(review).not.toContain('候选版本：v1.0.2');
    expect(app).toContain('loadCandidateDiff');
    expect(app).toContain('loadHandbookReviewSummary');
  });

  test('审核阅读能力复用统一阅读器并以服务端能力驱动多角色门禁', () => {
    const review = read('apps/knowledge-center-web/frontend/knowledge-center/modules/review-publishing/view.js');
    expect(review).toContain("import { safeMarkdown, treeHierarchy } from '../repository/view.js'");
    for (const control of ['data-review-document-search', 'data-review-branch', 'data-review-language', 'data-review-reader-refresh']) expect(review).toContain(control);
    for (const evidence of ['reasoningSummary', 'ruleRefs', 'candidateDigest', 'publicationId']) expect(review).toContain(evidence);
    for (const role of ["['reader', true", "['reviewer', capabilities.canReview === true", "['publisher', capabilities.canPublish === true"]) expect(review).toContain(role);
    expect(review).toContain('data-role-card="${key}"');
    expect(review).toContain('连接 GitLab 账号');
    expect(review).toContain('仓库阅读不可用，当前显示候选快照');
    expect(review).toContain('暂无真实 AI 分析结果');
    expect(review).toContain('文档上下文不一致');
    expect(review).toContain('当前没有待处理审核事项');
    expect(review).toContain('审核任务数据不完整');
    expect(review).toContain('尚无待审核修改稿');
    expect(review).toContain('前往文档生产');
    expect(review).toContain('data-review-handbook-select');
    for (const control of ['data-review-directory-toggle', 'data-review-directory-resizer', 'data-review-focus-toggle']) expect(review).toContain(control);
    for (const honestState of ['数据库语法、参数依赖、版本适配、错误码和运维命令专项检查尚未执行', '分析尚未执行', '版本变更记录', '审核历史']) expect(review).toContain(honestState);
    expect(app()).toContain('appState.gitlabProjection = null');
    expect(app()).toContain('contextConflict');
    expect(app()).toContain("['under_review', 'review_pending', 'approved', 'pending_publish']");
    expect(app()).toContain('requested ? await loadIncrementalTask(requested)');
    expect(app()).toContain("new URLSearchParams({ pageSize: '100' })");
    expect(app()).toContain('knowledge-center-review-directory-collapsed');
    expect(app()).toContain("event.key === 'Escape'");
    expect(read('apps/knowledge-center-web/frontend/knowledge-center/common/state/app-state.js')).toContain('reviewUi:');
    expect(read('apps/knowledge-center-web/frontend/knowledge-center/styles.css')).toContain('body.review-view main');
  });

  test('阅读文档步骤提供在线选区提意见入口并复用审核线程', () => {
    const review = read('apps/knowledge-center-web/frontend/knowledge-center/modules/review-publishing/view.js');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    for (const marker of ['data-review-reader-comment-form', 'candidateDigest', '在阅读文档中提出意见', 'data-review-selection-bubble', 'data-review-bubble-trigger', '全文意见（兼容模式）']) expect(review).toContain(marker);
    for (const marker of ['data-review-inline-form', 'commentType', 'severity']) expect(app).toContain(marker);
    expect(review).not.toContain('value="important"');
    expect(app).toContain('document_span');
    for (const marker of ['contextBefore', 'contextAfter', 'data-review-reply-form', 'data-review-decision-form', 'data-review-comment-resolve', 'data-review-comment-reopen']) expect(app + review).toContain(marker);
    expect(app).toContain("document.addEventListener('mouseup'");
    expect(app).toContain('review-reader-comment-form');
  });

  test('在线评审快照没有增量操作时，当前文档范围仍可生成行级意见锚点', () => {
    const review = read('apps/knowledge-center-web/frontend/knowledge-center/modules/review-publishing/view.js');
    expect(review).toContain("const scopedDocuments = list(task?.target?.documentIds);");
    expect(review).toContain("task?.target?.scope === 'document' && scopedDocuments.length === 1");
    expect(review).toContain("? scopedDocuments[0]");
    expect(review).toContain("const onlineReviewSnapshot = task?.reviewMode === 'online_review' && snapshot;");
    expect(review).toContain('当前显示正式版本评审快照');
    expect(app()).toContain('name: onlineReviewForm.dataset.handbookName ? `${onlineReviewForm.dataset.handbookName} 在线评审` : \'在线评审\'');
  });

  test('审核阅读页的提意见变量必须在 reader 作用域声明', () => {
    const review = read('apps/knowledge-center-web/frontend/knowledge-center/modules/review-publishing/view.js');
    const readerStart = review.indexOf('function reader(projection, task, ui = {})');
    const readerEnd = review.indexOf('\nfunction diff(', readerStart);
    expect(readerStart).toBeGreaterThanOrEqual(0);
    expect(readerEnd).toBeGreaterThan(readerStart);
    const readerBody = review.slice(readerStart, readerEnd);
    expect(readerBody).toContain("const reviewId = list(task?.reviews)[0]?.id || task?.reviewId || '';");
    expect(readerBody).toContain('const canComment = task?.capabilities?.canComment === true;');
  });

  test('审核阅读器统一保留 marked 代码块的语言元数据', () => {
    const renderer = read('apps/knowledge-center-web/frontend/knowledge-center/common/markdown/markdown-renderer.js');
    expect(renderer).toContain('function normalizeCodeBlocks(html)');
    expect(renderer).toContain('class="repository-code"');
    expect(renderer).toContain('data-language="${normalizedLanguage}"');
  });

  test('审核页面不展示全局平台数据错误条，错误由审核投影单独呈现', () => {
    expect(app()).toContain("appState.activeView === 'review' && appState.reviewProjection?.status !== 'unavailable'");
    expect(app()).toContain('globalErrorPanel.hidden = true');
  });
});
