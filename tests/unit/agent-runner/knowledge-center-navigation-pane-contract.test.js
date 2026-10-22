const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('知识中心导航面板 P0 契约', () => {
  const controller = read('apps/knowledge-center-web/frontend/knowledge-center/common/resizable-navigation-pane.js');
  const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
  const outline = read('apps/knowledge-center-web/frontend/knowledge-center/modules/outlines/view.js');
  const review = read('apps/knowledge-center-web/frontend/knowledge-center/modules/review-publishing/view.js');
  const production = read('apps/knowledge-center-web/frontend/knowledge-center/modules/production/handbook-view.js');
  const repository = read('apps/knowledge-center-web/frontend/knowledge-center/modules/repository/view.js');
  const tree = read('apps/knowledge-center-web/frontend/knowledge-center/common/directory-tree.js');
  const styles = read('apps/knowledge-center-web/frontend/knowledge-center/styles.css');
  const storage = read('apps/yashandb-storage/src/Main.java');

  test('公共控制器覆盖鼠标、键盘、折叠、默认恢复和本地偏好', () => {
    expect(controller).toContain('pointerdown');
    expect(controller).toContain('pointercancel');
    expect(controller).toContain('ArrowLeft');
    expect(controller).toContain('event.shiftKey ? 48 : 16');
    expect(controller).toContain('dblclick');
    expect(controller).toContain('localStorage');
    expect(controller).toContain('knowledge-center:navigation-pane-change');
    expect(controller).toContain("collapsed ? 'panel-left-open' : 'panel-left-close'");
    expect(controller).toContain('syncToggleIcon');
  });

  test('全局主导航的图标与折叠状态同步', () => {
    expect(app).toContain('function syncSidebarToggleIcon');
    expect(app).toContain("collapsed ? 'panel-left-open' : 'panel-left-close'");
    expect(app).toContain('syncSidebarToggleIcon(sidebarCollapsed)');
  });

  test('刷新首帧先恢复导航状态且完全隐藏入口不覆盖正文', () => {
    expect(app).toContain('applySidebar({ restoring: true })');
    expect(app).toContain("appShell.dataset.sidebarReady = 'true'");
    expect(app).toContain("shell.classList.add('sidebar-state-restoring')");
    expect(styles).toContain('.sidebar-state-restoring .sidebar { transition: none; }');
    expect(styles).toContain('.sidebar-hidden .sidebar-restore { display: inline-flex; position: static;');
    expect(styles).toContain('.sidebar-restore span { position: absolute; width: 1px; height: 1px;');
  });

  test('P0 页面分别声明目录尺寸或手册抽屉入口', () => {
    expect(outline).toContain('data-navigation-layout-id="outline-overview"');
    expect(outline).toContain('data-navigation-min="240"');
    expect(outline).toContain('data-navigation-max="380"');
    expect(review).toContain('data-navigation-layout-id="review"');
    expect(review).toContain('data-navigation-min="220"');
    expect(review).toContain('data-navigation-max="420"');
    expect(production).toContain('data-handbook-directory-open');
    expect(production).toContain('data-handbook-directory-close');
    expect(production).toContain('id="handbook-directory-drawer"');
  });

  test('大纲目录不再把待分领域作为导航筛选入口', () => {
    expect(outline).not.toContain('data-outline-unassigned-filter');
    expect(outline).not.toContain('只看待分领域');
    expect(outline).toContain('data-outline-directory-search');
  });

  test('应用在完整渲染和审核阅读区局部替换后都增强目录面板', () => {
    expect(app).toContain('enhanceResizableNavigation(byId(\'view-root\'))');
    expect(app).toContain('enhanceResizableNavigation(replacement)');
    expect(app).toContain("id === 'production-handbook'");
  });

  test('剩余导航页面接入公共目录树能力', () => {
    expect(tree).toContain('enhanceDirectoryTrees');
    expect(tree).toContain('originalOpen');
    expect(tree).toContain('scrollIntoView');
    expect(repository).toContain('data-navigation-layout-id="repository"');
    expect(repository).toContain('data-directory-search');
    expect(outline).toContain('data-navigation-layout-id="outline-assignment"');
    expect(outline).toContain('data-navigation-layout-id="outline-overview"');
    expect(outline).toContain('class="outline-navigation review-document-tree outline-assignment-directory"');
    expect(controller).toContain("root.dataset.navigationLayoutId === 'outline-assignment'");
  });

  test('手册生产“只看我负责”使用数据库真实分工投影，而不是空责任人占位', () => {
    expect(storage).toContain('taskItemsByDocumentDomain');
    expect(storage).toContain('taskItem.get("assigneeId")');
    expect(storage).toContain('taskItem.get("assigneeName")');
    expect(storage).toContain('body.put("tasks", outlineTasks)');
    expect(production).toContain('effectiveDocumentAssignments');
    expect(production).toContain('ownedByCurrentUser(outline, document.id, currentUser)');
    expect(production).toContain('[currentUser.id, currentUser.userId, currentUser.principalId]');
    expect(production).toContain('ids.has(owner.id)');
  });

  test('P1：目录树提供完整键盘 TreeView 语义和当前项定位', () => {
    expect(tree).toContain('role="tree"');
    expect(tree).toContain('role="treeitem"');
    for (const key of ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End', "case 'Enter'", "case ' '"]) expect(tree).toContain(key);
    expect(tree).toContain('aria-level');
    expect(tree).toContain('aria-expanded');
    expect(tree).toContain('scrollIntoView');
    expect(tree).toContain('item.click()');
  });

  test('弹框目标树保留业务语义并提供搜索入口', () => {
    expect(outline).toContain('data-outline-move-search');
    expect(app).toContain('data-mapping-tree-search');
  });

  test('审核阅读目录在移动端覆盖桌面动态宽度，正文保持可读单列', () => {
    expect(styles).toMatch(/@media\(max-width:700px\)[\s\S]*?\.review-reading-layout\[data-navigation-layout\][\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
    expect(styles).toContain('.review-reading-layout[data-navigation-layout] .review-document-content{width:100%;min-width:0;padding:16px}');
  });
});
