const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../../..');
const read = relative => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

describe('知识中心刷新性能契约', () => {
  const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
  const templateController = read('apps/knowledge-center-web/frontend/knowledge-center/modules/templates/controller.js');
  const domainStore = read('packages/agent-runner-core/lib/domain-store.js');
  const frontendServer = read('apps/knowledge-center-web/frontend-server.js');
  const routes = read('packages/agent-runner-core/routes/knowledge-center.js');
  const authController = read('apps/knowledge-center-web/frontend/knowledge-center/common/auth/auth-controller.js');
  const reviewView = read('apps/knowledge-center-web/frontend/knowledge-center/modules/review-publishing/view.js');
  const entry = read('apps/knowledge-center-web/frontend/knowledge-center/knowledge-center-management.html');
  const storage = read('apps/yashandb-storage/src/Main.java');
  const handbookRepository = read('apps/yashandb-storage/src/HandbookProjectionRepository.java');
  const design = read('.codex/知识中心建设平台/03-详细设计/知识中心-前端-详细设计文档.md');

  test('知识资产先渲染目录，再后台补充仓库统计并检查可读性', () => {
    expect(app).toContain('appState.assetCatalog = response?.data || response || null;');
    expect(app).toContain('await enrichAssetRepositoryStatistics(appState.assetCatalog);');
    expect(app).toContain('const access = await loadHandbookGitLabAccess(item.handbookId);');
    expect(app).toContain("if (access?.canRead === false)");
    expect(app).not.toContain('appState.assetCatalog = await enrichAssetRepositoryStatistics(response?.data || response || null);');
  });

  test('审核启动与仓库上下文使用聚合接口并局部更新阅读区', () => {
    expect(app).toContain("loadReviewBootstrap({ handbookId, taskId: requestedTaskId, step, view, documentId: params.get('documentId') || '', path: requestedPath })");
    expect(app).toContain("if (readerHandbookId && view === 'reader')");
    expect(app).toContain('loadReviewRepositoryContext(handbookId, { branch, language, path: requestedPath })');
    expect(app).toContain("appState.gitlabProjection = { status: 'loading'");
    expect(app).toContain('updateReviewRepositoryRegion()');
    expect(app).toContain("document.querySelector('[data-review-repository-region]')");
    expect(app).not.toContain('requireReadableGitLabAccess(await loadHandbookGitLabAccess(readerHandbookId));');
    expect(routes).toContain("pathname === '/knowledge-center/api/review/bootstrap'");
    expect(routes).toContain("pathname === '/knowledge-center/api/review/repository-context'");
    expect(routes).toContain("'Server-Timing': `metadata;dur=");
    expect(reviewView).toContain("projection?.status === 'loading'");
    expect(reviewView).not.toContain('仓库正文尚未加载');
  });

  test('审核路由提前展示稳定框架、延迟其他页面资源并并行认证', () => {
    expect(entry).toContain('data-review-static-shell');
    expect(entry).toContain('data-href="./modules/dashboard/dashboard.css" data-route-style="dashboard" media="not all"');
    expect(app).toContain("dashboard: () => import('./modules/dashboard/view.js')");
    expect(app).toContain('await ensureRenderer(targetView);');
    expect(authController).toContain('Promise.allSettled([getAuthConfig(), getSession()])');
  });

  test('非工作台页面不预取领域任务，模板摘要仅为选中项读取详情', () => {
    expect(app).toContain("if (appState.activeView === 'dashboard') loadDomainBuildTasksWorkspace();");
    expect(app).toContain("load(appState.activeView === 'dashboard' || appState.activeView === 'platform' ? ['context', 'overview'] : ['context']);");
    expect(templateController).toContain("const hasContent = item => typeof item?.current?.content === 'string';");
    expect(templateController).toContain('const detail = !target ? null : hasContent(listed) ? listed : (await api.loadTemplate(target)).data;');
    expect(templateController).toContain("throw new Error('模板详情未返回正文，请刷新后重试。')");
    expect(design).toContain('当前页面关键数据优先');
  });

  test('浏览器前进后退只由 navigate 触发一次页面数据加载', () => {
    const popstate = app.match(/window\.addEventListener\('popstate',[\s\S]*?\n}\);/)?.[0] || '';
    expect(popstate).toContain('navigate(view, false);');
    expect(popstate).not.toContain("if (view === 'outlines') loadOutlines();");
    expect(popstate).not.toContain("if (view === 'assets') loadAssetCatalog();");
    expect(popstate).not.toContain("if (view === 'repository') loadRepositoryWorkspace();");
  });

  test('数据库手册投影无 N+1，BFF 高频读取不阻塞事件循环', () => {
    expect(handbookRepository).toContain("LEFT JOIN KC_MANUAL_OWNER P ON P.MANUAL_ID = M.MANUAL_ID AND P.OWNER_ROLE = 'PRIMARY'");
    expect(storage).toContain('handbookProjectionRepository.list(connection)');
    expect(storage).toContain('Server-Timing');
    expect(storage).toContain('handbooks.add(projectHandbook(row));');
    expect(domainStore).toContain('async readHandbooksAsync()');
    expect(domainStore).toContain("await fetch(target");
    expect(frontendServer).toContain('readAsync: () => domainStore.readHandbooksAsync()');
  });

  test('大纲目录使用轻量单查询读模型和异步 Storage 链路', () => {
    const outlineRoute = read('packages/agent-runner-core/routes/outline.js');
    expect(storage).toContain('/v1/domain/outlines/catalog');
    expect(storage).toContain('projectOutlineCatalog(connection, timings)');
    expect(storage).toContain('SUM(CASE WHEN N.NODE_TYPE=\'DOCUMENT\' THEN 1 ELSE 0 END)');
    expect(storage).not.toMatch(/projectOutlineCatalog[\s\S]{0,500}outlineNodes\(/);
    expect(domainStore).toContain('async readOutlineCatalogAsync()');
    expect(outlineRoute).toContain('await handbookDomainStore.readOutlineCatalogAsync()');
    expect(outlineRoute).toContain("router.get('/catalog', async");
    expect(routes).toContain("pathname === '/knowledge-center/api/outline/catalog'");
  });
});
