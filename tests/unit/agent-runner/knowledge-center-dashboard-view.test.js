const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('知识中心工作台领域建设任务前端契约', () => {
  const view = () => read('apps/knowledge-center-web/frontend/knowledge-center/modules/dashboard/view.js');
  const styles = () => read('apps/knowledge-center-web/frontend/knowledge-center/modules/dashboard/dashboard.css');
  const app = () => read('apps/knowledge-center-web/frontend/knowledge-center/app.js');

  test('主工作台按领域展示摘要，不平铺页面任务', () => {
    const source = view();
    expect(source).toContain('domain-task-summary-grid');
    expect(source).toContain('domain-task-summary-card');
    expect(source).toContain('领域负责人');
    expect(source).toContain('页面总数');
    expect(source).toContain('已分派');
    expect(source).toContain('待分派');
    expect(source).not.toContain('<article class="domain-task" data-domain-task>');
  });

  test('领域摘要提供弹窗入口，弹窗内保留页面责任人维护', () => {
    const source = view();
    expect(source).toContain('data-domain-task-open');
    expect(source).toContain('data-domain-task-dialog');
    expect(source).toContain('domain-task-dialog-list');
    expect(source).toContain('data-domain-task-assignee');
    expect(source).toContain('data-task-id=');
    expect(source).toContain('data-item-id=');
    expect(source).toContain('关闭领域任务明细');
  });

  test('工作台事件打开和关闭领域明细，并在刷新后恢复当前弹窗', () => {
    const source = app();
    expect(source).toContain('let openDomainTaskId = null;');
    expect(source).toContain("event.target.closest('[data-domain-task-open]')");
    expect(source).toContain('dialog.showModal()');
    expect(source).toContain("event.target.closest('[data-domain-task-close]')");
    expect(source).toContain('data-domain-task-dialog');
  });

  test('领域明细使用独立弹窗布局并适配窄屏', () => {
    const source = styles();
    expect(source).toContain('.domain-task-summary-grid');
    expect(source).toContain('.domain-task-dialog');
    expect(source).toContain('.domain-task-dialog-content { min-height: 0; overflow: auto; }');
    expect(source).toContain('@media (max-width: 520px)');
    expect(source).toContain('.domain-task-dialog-list li { grid-template-columns: 1fr;');
  });
});
