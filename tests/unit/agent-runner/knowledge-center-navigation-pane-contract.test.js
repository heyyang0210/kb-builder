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

  test('公共控制器覆盖鼠标、键盘、折叠、默认恢复和本地偏好', () => {
    expect(controller).toContain('pointerdown');
    expect(controller).toContain('pointercancel');
    expect(controller).toContain('ArrowLeft');
    expect(controller).toContain('event.shiftKey ? 48 : 16');
    expect(controller).toContain('dblclick');
    expect(controller).toContain('localStorage');
    expect(controller).toContain('knowledge-center:navigation-pane-change');
  });

  test('P0 页面声明不同的目录尺寸，不用一个全局宽度覆盖', () => {
    expect(outline).toContain('data-navigation-layout-id="outline-overview"');
    expect(outline).toContain('data-navigation-min="240"');
    expect(outline).toContain('data-navigation-max="380"');
    expect(review).toContain('data-navigation-layout-id="review"');
    expect(review).toContain('data-navigation-min="220"');
    expect(review).toContain('data-navigation-max="420"');
    expect(production).toContain('data-navigation-layout-id="production-handbook"');
    expect(production).toContain('data-navigation-min="220"');
    expect(production).toContain('data-navigation-max="360"');
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

  test('弹框目标树保留业务语义并提供搜索入口', () => {
    expect(outline).toContain('data-outline-move-search');
    expect(app).toContain('data-mapping-tree-search');
  });

  test('审核阅读目录在移动端覆盖桌面动态宽度，正文保持可读单列', () => {
    expect(styles).toMatch(/@media\(max-width:700px\)[\s\S]*?\.review-reading-layout\[data-navigation-layout\][\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
    expect(styles).toContain('.review-reading-layout[data-navigation-layout] .review-document-content{width:100%;min-width:0;padding:16px}');
  });
});
