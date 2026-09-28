const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('知识中心公共表格视图配置器', () => {
  const component = read('apps/knowledge-center-web/frontend/knowledge-center/common/table-view-configurator.js');
  const styles = read('apps/knowledge-center-web/frontend/knowledge-center/common/table-view-configurator.css');
  const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');

  test('公共能力覆盖显隐、顺序、即时重绘和持久化', () => {
    expect(component).toContain('data-table-drawer-visible');
    expect(component).toContain('data-table-view-move');
    expect(component).not.toContain('data-table-drawer-pin');
    expect(component).not.toContain('data-table-drawer-width');
    expect(component).toContain('localStorage.setItem');
    expect(component).toContain('tableViewScope');
    expect(component).toContain('data-table-column-required');
    expect(component).toContain('enhancementOptions.onChange');
    expect(component).toContain('pendingRestore');
    expect(component).not.toContain('data-table-view-apply');
    expect(app).toContain('enhanceTableViews(byId(\'view-root\')');
    expect(app).toContain('onChange: render');
  });

  test('右侧抽屉具备键盘、触控和响应式门禁', () => {
    expect(component).toContain("event.key === 'Escape'");
    expect(component).toContain('activeTrigger?.focus()');
    expect(styles).toContain('inset: 0 0 0 auto');
    expect(styles).toContain('min-height: 52px');
    expect(styles).toContain('@media (max-width: 640px)');
    expect(styles).toContain('width: 100vw');
  });

  test('九个稳定业务表格纳入配置清单', () => {
    const sources = [
      read('apps/knowledge-center-web/frontend/knowledge-center/modules/assets/view.js'),
      read('apps/knowledge-center-web/frontend/knowledge-center/modules/outlines/view.js'),
      read('apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js'),
      read('apps/knowledge-center-web/frontend/knowledge-center/modules/cleaning/view.js'),
      read('apps/knowledge-center-web/frontend/knowledge-center/modules/production/view.js'),
      component,
    ].join('\n');
    for (const tableId of [
      'asset-catalog', 'outline-catalog', 'outline-structure', 'outline-assignment',
      'platform-principals', 'platform-recent-operations', 'cleaning-batches', 'cleaning-datasets', 'production-handbooks',
    ]) expect(sources).toContain(tableId);
  });

  test('文档生产旧字段偏好可迁移且不再维护独立面板', () => {
    const production = read('apps/knowledge-center-web/frontend/knowledge-center/modules/production/view.js');
    expect(production).toContain('data-table-view-legacy-key="kc-production-handbook-columns"');
    expect(component).toContain('migrateLegacyPreference');
    expect(component).toContain('localStorage.removeItem(legacyKey)');
    expect(production).not.toContain('production-column-picker');
  });

  test('Markdown 内容表格和导入预览不被全局自动增强', () => {
    expect(component).not.toContain("querySelectorAll('table')");
    expect(component).toContain("querySelectorAll('[data-table-view-id]')");
    expect(component).not.toContain('repository-table-wrap');
    expect(component).not.toContain('principal-import-rows');
  });
});
