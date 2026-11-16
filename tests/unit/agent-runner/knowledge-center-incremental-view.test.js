const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('增量构建前端契约', () => {
  const view = () => read('apps/knowledge-center-web/frontend/knowledge-center/modules/production/view.js');
  const api = () => read('apps/knowledge-center-web/frontend/knowledge-center/common/api/incremental-api.js');
  const app = () => read('apps/knowledge-center-web/frontend/knowledge-center/app.js');

  test('AI 写作在仓库无对应文件时使用平台正文快照', () => {
    expect(app()).toContain('if (!file?.matched) return createPlatformOriginSnapshot(getMarkdown(), context)');
    expect(app()).not.toContain("repository.mapped && !file?.matched");
    expect(read('apps/knowledge-center-web/frontend/knowledge-center/modules/production/origin-snapshot.js')).toContain("originType: 'platform'");
  });

  test('使用后端冻结的资源路由和业务状态', () => {
    expect(api()).toContain("const endpoint = '/knowledge-center/api/incremental-tasks'");
    expect(api()).not.toContain('createIncrementalTask');
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
    for (const label of ['参考资料', '修改范围', '增量草稿', '完整性检查', '按文档审核', '整体发布', '登记外部证据']) expect(view()).toContain(label);
    expect(view()).toContain('人工提供');
    expect(view()).not.toContain('GitLab（尚未接入）');
    expect(app()).toContain('expectedCandidateDigest: task?.candidate?.digest');
  });

  test('增量生产五阶段只开放真实接口支持的动作', () => {
    for (const phase of ['建立任务', '确认输入', '编写草稿', '按文档审核', '整体发布']) expect(view()).toContain(phase);
    expect(view()).toContain("['generation', '草稿']");
    expect(view()).toContain('>编写草稿</button>');
    for (const key of ['setup', 'inputs', 'generation', 'review', 'publish']) expect(view()).toContain(`['${key}',`);
    expect(view()).toContain('data-incremental-stage="${key}"');
    expect(view()).toContain('incremental-stage-layout');
    expect(view()).toContain('incremental-context');
    expect(view()).toContain('Agent 自动生成暂未开放');
    expect(view()).not.toContain('data-incremental-prototype-toggle');
    expect(view()).not.toContain('data-incremental-prototype-form');
    expect(view()).not.toContain('data-incremental-prototype-generate');
    expect(view()).not.toContain('data-incremental-prototype-publish');
    expect(view()).toContain('taskOutlineStatus === \'unavailable\'');
    expect(view()).toContain('保存后作为本次任务的来源快照');
    expect(view()).toContain('发布基线');
    expect(view()).not.toContain('来源证据</h3>');
    expect(view()).not.toContain('文档状态</h3>${documentStatusList(task)}');
    expect(app()).toContain("url.searchParams.set('stage', incrementalStage.dataset.incrementalStage)");
    expect(app()).not.toContain('前端已记录启动意图');
    expect(app()).not.toContain('前端已暂存大纲和双模板选择');
  });

  test('生产页按文档汇总审核状态并复用独立审核工作区', () => {
    const review = read('apps/knowledge-center-web/frontend/knowledge-center/modules/review-publishing/view.js');
    expect(view()).toContain('此处只汇总各文档状态');
    expect(view()).toContain('进入审核工作区');
    expect(view()).toContain('/knowledge-center/review?taskId=');
    expect(review).toContain('reviewNavigation(projection.workbench, task, params)');
    expect(read('apps/knowledge-center-web/frontend/knowledge-center/modules/review-publishing/workbench.js'))
      .toContain('返回审核文档清单');
    expect(review).toContain('stage=review');
    expect(view()).toContain('task.capabilities?.canSubmitReview === true');
    expect(view()).toContain('task.capabilities?.canRevise === true');
    expect(view()).not.toContain('canEdit ?? true');
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
    expect(view()).not.toContain('data-incremental-load-baselines');
    expect(view()).not.toContain('<input name="baselineVersionId"');
  });

  test('增量草稿区分候选正文与用于精确变更的操作片段', () => {
    expect(view()).toContain('候选正文<textarea name="content"');
    expect(view()).toContain('<fieldset class="incremental-operation-group"><legend>具体变更操作</legend>');
    expect(view()).toContain('变更后内容<textarea name="afterContent"');
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
    for (const label of ['文档目录', '全局预览', '预览', '编辑', '取消', '保存', 'AI 辅助写作', 'Markdown', '校验', '更多', '显示预览', '显示内容差异']) expect(handbook).toContain(label);
    for (const marker of ['data-handbook-template', 'data-handbook-focus-toggle', 'data-handbook-ai-action="generate"', 'data-handbook-ai-action="check"', 'data-handbook-markdown-preview-toggle', 'data-handbook-history-workspace', 'data-handbook-history-select', 'data-handbook-history-diff']) expect(handbook).toContain(marker);
    expect(handbook).toContain('与当前已保存 v');
    expect(handbook).toContain('history.capabilities?.canRestore');
    expect(app()).toContain('restoreScrollTop: window.scrollY');
    expect(app()).toContain('editorScrollTop: editorElement?.scrollTop || 0');
    expect(app()).toContain('并替换当前未保存编辑');
    expect(app()).toContain('if (!window.confirm(message)) return;');
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
    expect(css).toContain('.handbook-history-layout');
    expect(css).toContain('.handbook-history-diff-removed');
    expect(state).toContain('templateByDocument: {}');
    expect(state).toContain('focusMode: false');
    expect(state).toContain('assistantOpen: false');
    const digest = read('apps/knowledge-center-web/frontend/knowledge-center/common/utils/sha256.js');
    expect(app()).toContain("import { sha256Text } from './common/utils/sha256.js'");
    expect(app()).not.toContain("crypto.subtle.digest('SHA-256'");
    expect(digest).toContain('if (subtle?.digest)');
    expect(digest).toContain('return fallbackSha256(bytes)');
  });

  test('文档生产以手册总览为主入口，任务详情保留深链且任务视图不再占一级页签', () => {
    const css = read('apps/knowledge-center-web/frontend/knowledge-center/modules/production/production.css');
    expect(view()).toContain('data-production-overview-tab="handbooks"');
    expect(view()).not.toContain('data-production-overview-tab="tasks"');
    expect(view()).toContain('data-production-overview-tab="generations"');
    expect(view()).toContain('我的生成');
    expect(view()).not.toContain('data-production-overview-tab="versions"');
    expect(view()).not.toContain('数据库版本汇总');
    expect(view()).not.toContain('production-version-overview');
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
    expect(app()).toContain('needsHandbookCatalog && !taskId ? loadOutlineData() : Promise.resolve(null)');
    expect(app()).toContain('data-production-handbook-search');
    expect(view()).toContain('data-table-column="${key}"');
    expect(view()).toContain('data-production-handbook-row');
    expect(view()).not.toContain('href="/document-generation-workbench.html"');
    expect(css).not.toContain('.production-column-picker');
    expect(css).toContain('.production-handbook-row');
  });

  test('生产进展阶段卡可筛选，未知状态单独呈现，活动日历展示任务标题和活动日期', () => {
    const css = read('apps/knowledge-center-web/frontend/knowledge-center/modules/production/production.css');
    expect(view()).toContain("const progressStages = ['待生成', '生成中', '待审核', '退回修订', '待发布', '已完成', '状态待确认']");
    expect(view()).toContain("if (state === 'published') return '已完成'");
    expect(view()).toContain('aria-label="${escapeHtml(accessibleLabel)}"');
    expect(view()).toContain("if (['draft', 'pending', 'queued', 'not_started', 'waiting_generation'].includes(state)) return '待生成'");
    expect(view()).toContain("return '状态待确认'");
    expect(view()).toContain('const counts = Object.fromEntries(progressStages.map(stage => [stage, matchesFilters.filter(item => productionStage(item) === stage).length]))');
    expect(css).toContain('.production-progress-stages { display: flex; gap: 2px; overflow-x: auto;');
    expect(css).toContain('.production-progress-stages button[aria-pressed="true"] { border-bottom-color: var(--color-brand);');
    expect(css).toContain('.production-progress-stages button strong { padding: 2px 6px;');
    expect(view()).toContain('item?.updatedAt');
    expect(view()).toContain('item?.createdAt');
    expect(view()).toContain('item?.startedAt');
    expect(view()).toContain('item?.activityAt');
    expect(view()).toContain('item?.updated_at');
    expect(view()).toContain('item?.plannedStartTime');
    expect(view()).toContain('未记录活动日期');
    expect(view()).toContain('data-production-overview-tab="progress"');
    expect(view()).toContain("['list', 'calendar', 'charts'].includes(params.get('mode'))");
    expect(view()).toContain("const calendarView = params.get('calendarView') === 'week' ? 'week' : 'month'");
    expect(view()).toContain('Array.from({ length: dayCount }');
    expect(view()).toContain('function productionActivityDate(item)');
    expect(view()).toContain('const dayTasks = stageFiltered.filter(item => productionActivityDate(item) === day)');
    expect(view()).toContain('adjustedWorkday ? \'is-adjusted-workday\'');
    expect(view()).toContain('production-calendar-task-title');
    expect(view()).toContain('production-calendar-task-more');
    expect(view()).toContain('function productionTaskItems(projection)');
    expect(view()).toContain('data-calendar-view="${calendarView}"');
    expect(view()).toContain('当天没有符合条件的任务');
    expect(view()).toContain('data-progress-mode="charts"');
    expect(view()).toContain('data-progress-task-summary');
    expect(view()).toContain('data-production-task-summary');
    expect(view()).not.toContain('data-incremental-create-open');
    expect(view()).not.toContain('data-incremental-create-dialog');
    expect(view()).toContain('data-calendar-legend');
    expect(view()).toContain("        : 'unconfigured'");
    expect(view()).toContain('该年度工作日历未配置，日期性质未知');
    expect(view()).toContain('const calendarConfigured = Boolean(projection?.workCalendars?.[center.getFullYear()]?.configured)');
    expect(css).toContain('.production-calendar-header > button:not(.production-calendar-today) [data-lucide] { width: 14px; height: 14px;');
    expect(css).toContain('.production-calendar-grid button.is-weekend { border-left: 3px solid var(--color-warning); background: var(--color-warning-subtle);');
    expect(css).toContain('.production-calendar-grid button.is-holiday { border-left: 3px solid var(--color-danger);');
    expect(css).toContain('.production-calendar-grid button.is-adjusted-workday { border-left: 3px solid var(--color-success);');
    expect(css).toContain('.production-calendar-grid button[aria-current="date"] { outline: 2px solid var(--color-brand);');
    expect(view()).not.toContain('href="${progressUrl(params, { day })}"');
    expect(app()).toContain('ensureVisibleWorkCalendars');
    expect(view()).toContain('for (const value of [item?.activityAt, item?.lastActivityAt, item?.updatedAt, item?.createdAt, item?.startedAt');
    expect(view()).toContain('const activityAt = [item.updatedAt, item.updated_at, item.activityAt, item.lastActivityAt');
    expect(read('packages/agent-runner-core/lib/incremental-build-service.js')).toContain("'created_at', 'updated_at', 'started_at'");
    expect(view()).toContain('export function formatProductionTimestamp');
    expect(app()).toContain('productionOverviewTab.dataset.productionOverviewTab');
    expect(app()).toContain('data-progress-enter-task');
    expect(api()).toContain('/knowledge-center/api/production/work-calendar?year=');
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
