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
    for (const label of ['来源材料', '修改范围', '增量草稿', '完整性检查', '按文档审核', '整体发布', '登记外部证据']) expect(view()).toContain(label);
    expect(view()).toContain('人工选择');
    expect(view()).not.toContain('GitLab（尚未接入）');
    expect(app()).toContain('expectedCandidateDigest: task?.candidate?.digest');
  });

  test('增量生产采用五阶段可操作骨架并诚实标记后端待接入能力', () => {
    for (const phase of ['建立任务', '确认输入', '生成与修订', '按文档审核', '整体发布']) expect(view()).toContain(phase);
    for (const key of ['setup', 'inputs', 'generation', 'review', 'publish']) expect(view()).toContain(`['${key}',`);
    expect(view()).toContain('data-incremental-stage="${key}"');
    expect(view()).toContain('incremental-stage-layout');
    expect(view()).toContain('incremental-context');
    for (const marker of ['data-incremental-prototype-toggle="markdown"', 'data-incremental-prototype-toggle="pingcode"', 'data-incremental-prototype-form="contract"', 'data-incremental-prototype-generate', 'data-incremental-prototype-publish']) expect(view()).toContain(marker);
    expect(view()).toContain('当前启动动作只展示待接入反馈');
    expect(view()).toContain('当前仅展示前端确认，不会改变正式版本');
    expect(app()).toContain("url.searchParams.set('stage', incrementalStage.dataset.incrementalStage)");
  });

  test('生产页按文档汇总审核状态并复用独立审核工作区', () => {
    const review = read('apps/knowledge-center-web/frontend/knowledge-center/modules/review-publishing/view.js');
    expect(view()).toContain('此处只汇总各文档状态');
    expect(view()).toContain('进入审核工作区');
    expect(view()).toContain('/knowledge-center/review?taskId=');
    expect(review).toContain('返回增量任务');
    expect(review).toContain('stage=review');
  });

  test('草稿、范围和外部证据字段与 DTO 一致', () => {
    const review = read('apps/knowledge-center-web/frontend/knowledge-center/modules/review-publishing/view.js');
    for (const field of ['businessVersion', 'baselineVersionId', 'sourceType', 'documentIds', 'sectionIds', 'editVersion', 'operations', 'reference', 'note']) expect(app() + view()).toContain(field);
    expect(review).toContain('data-review-decision-form');
    expect(review).not.toContain('request_changes');
    expect(review).toContain('data-review-comment-form');
    expect(view()).toContain('data-incremental-revision');
    expect(review).toContain('task?.capabilities?.canReview');
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

  test('文档工作台统一进入沉浸式 AI 写作，移除重复资料入口', () => {
    const handbook = read('apps/knowledge-center-web/frontend/knowledge-center/modules/production/handbook-view.js');
    const css = read('apps/knowledge-center-web/frontend/knowledge-center/modules/production/production.css');
    const state = read('apps/knowledge-center-web/frontend/knowledge-center/common/state/app-state.js');
    for (const label of ['文档目录', '全局预览', '预览', '编辑', '取消', '保存', 'AI 辅助写作', 'Markdown', '校验', '更多', '显示预览', '查看差异']) expect(handbook).toContain(label);
    for (const marker of ['data-handbook-template', 'data-handbook-focus-toggle', 'data-handbook-ai-action="generate"', 'data-handbook-ai-action="check"', 'data-handbook-markdown-preview-toggle', 'data-handbook-history-compare']) expect(handbook).toContain(marker);
    expect(handbook).not.toContain('<span>文档模板</span>');
    for (const removed of ['data-handbook-generation-setup', '1 产品', '生成文档结构', 'Markdown / 富文本', 'GitLab 未匹配正文', '来源分支', 'data-handbook-reference-open', 'data-handbook-assistant-tab', 'data-handbook-reference-dialog', '粘贴 Markdown', '文档属性与内容依据']) expect(handbook).not.toContain(removed);
    const writing = read('apps/knowledge-center-web/frontend/knowledge-center/modules/production/production-writing-page.js');
    for (const operation of ['continue', 'rewrite', 'update']) expect(writing).toContain(`${operation}:`);
    expect(app()).toContain('openProductionWritingPage');
    expect(css).toContain('grid-template-columns: minmax(220px, 260px) minmax(0, 1fr)');
    expect(css).toContain('.handbook-assistant-panel');
    expect(css).toContain('.handbook-production-page.is-focus-mode');
    expect(css).toContain('position: sticky');
    expect(css).toContain('.handbook-more-menu');
    expect(css).toContain('.handbook-markdown-workspace.is-previewing');
    expect(css).toContain('.handbook-history-comparison');
    expect(state).toContain('templateByDocument: {}');
    expect(state).toContain('focusMode: false');
    expect(state).toContain('assistantOpen: false');
    const digest = read('apps/knowledge-center-web/frontend/knowledge-center/common/utils/sha256.js');
    expect(app()).toContain("import { sha256Text } from './common/utils/sha256.js'");
    expect(app()).not.toContain("crypto.subtle.digest('SHA-256'");
    expect(digest).toContain('if (subtle?.digest)');
    expect(digest).toContain('return fallbackSha256(bytes)');
  });

  test('文档生产以手册总览为主入口，任务工作区保留兼容视图', () => {
    const css = read('apps/knowledge-center-web/frontend/knowledge-center/modules/production/production.css');
    expect(view()).toContain('data-production-overview-tab="handbooks"');
    expect(view()).toContain('data-production-overview-tab="versions"');
    expect(view()).toContain('data-production-overview-tab="tasks"');
    expect(view()).toContain('data-production-overview-tab="generations"');
    expect(view()).toContain('我的生成');
    expect(view()).toContain('数据库版本汇总');
    expect(view()).toContain('data-table-view-id="production-versions"');
    expect(view()).toContain('item.completion || {}');
    expect(view()).toContain('交付状态');
    expect(view()).not.toContain('data-production-overview-tab="todo"');
    expect(view()).not.toContain('我的待办');
    expect(api()).toContain("/knowledge-center/api/production/generations?scope=mine");
    expect(app()).toContain("params.get('view') === 'todo'");
    expect(app()).toContain("canonicalUrl.searchParams.set('view', 'generations')");
    expect(view()).toContain('data-table-view-id="production-handbooks"');
    expect(view()).toContain('data-production-handbook-search');
    expect(view()).toContain("String(item.state || item.status || '').toLowerCase() === 'published'");
    expect(view()).toContain('publishedHandbookIds.has(item.id)');
    expect(view()).toContain('current?.completion?.label');
    expect(view()).toContain("task.completion.status !== 'completed'");
    expect(view()).toContain('projection?.outlineCatalog?.status !== \'ok\'');
    expect(app()).toContain('requestedHandbookId ? Promise.resolve(null) : loadOutlineData()');
    expect(app()).toContain('data-production-handbook-search');
    expect(view()).toContain('data-table-column="${key}"');
    expect(view()).toContain('data-production-handbook-row');
    expect(view()).toContain('href="/document-generation-workbench.html"');
    expect(view()).toContain('target="_blank" rel="noopener"');
    expect(css).not.toContain('.production-column-picker');
    expect(css).toContain('.production-handbook-row');
  });

  test('审核与发布采用三步页面并保留完整差异和行级意见', () => {
    const review = read('apps/knowledge-center-web/frontend/knowledge-center/modules/review-publishing/view.js');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    const css = read('apps/knowledge-center-web/frontend/knowledge-center/styles.css');
    expect(review).toContain('>阅读文档</button>');
    expect(review).toContain('>查看修改（${metrics.operations.length}）</button>');
    expect(review).toContain('>审核意见（${unresolved}）</button>');
    expect(review).toContain('修改前后全文对照');
    expect(review).toContain('data-review-line');
    expect(review).toContain('data-review-comment-form');
    expect(review).toContain('已保存修订 · 冻结审核快照');
    expect(review).not.toContain('审核收件箱');
    expect(review).not.toContain('候选版本：v1.0.2');
    expect(review).toContain('class="icon-button review-panel-close" data-review-panel-close aria-label="关闭审核依据侧栏" title="关闭审核依据侧栏"><i data-lucide="x"');
    expect(review).not.toContain('class="button secondary compact" data-review-panel-close aria-label="关闭审核依据侧栏">关闭</button>');
    expect(css).toContain(':is(.review-comment-drawer,.review-evidence-drawer) .review-panel-close');
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
    expect(app()).toContain('// 保留已成功加载的 gitlabProjection');
    expect(app()).toContain('contextConflict');
    expect(app()).toContain('selectedId ? await loadIncrementalTask(selectedId) : null');
    expect(app()).toContain("new URLSearchParams({ pageSize: '100' })");
    expect(app()).toContain('knowledge-center-review-directory-collapsed');
    expect(app()).toContain("event.key === 'Escape'");
    expect(read('apps/knowledge-center-web/frontend/knowledge-center/common/state/app-state.js')).toContain('reviewUi:');
  });

  test('阅读文档步骤提供在线选区提意见入口并复用审核线程', () => {
    const review = read('apps/knowledge-center-web/frontend/knowledge-center/modules/review-publishing/view.js');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    for (const marker of ['data-review-reader-comment-form', 'candidateDigest', 'data-review-selection-bubble', 'data-review-bubble-trigger', '全文意见（兼容模式）']) expect(review).toContain(marker);
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
    expect(app()).toContain("reviewMode: 'online_review'");
    expect(app()).toContain('draftRevisionId: input.dataset.revisionId');
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
