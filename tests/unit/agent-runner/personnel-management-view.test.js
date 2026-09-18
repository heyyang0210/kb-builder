const fs = require('fs');
const path = require('path');

const view = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js'), 'utf8');
const styles = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/styles.css'), 'utf8');
const app = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/app.js'), 'utf8');

describe('平台人员管理工作台', () => {
  test('页头、统计、搜索筛选和行操作形成一个任务闭环', () => {
    expect(view).toContain('管理知识中心可选责任人及其 CAS 账号绑定');
    expect(view).toContain('data-principal-search');
    expect(view).toContain('data-principal-binding-filter');
    expect(view).toContain('data-principal-state-filter');
    expect(view).toContain('data-principal-edit');
    expect(view).toContain('data-principal-toggle');
    expect(view).toContain('CAS 绑定状态');
    expect(view).not.toContain('待首次登录');
  });

  test('新增编辑和 Excel 导入使用可聚焦弹窗与两阶段预检', () => {
    expect(view).toContain('data-principal-editor-dialog');
    expect(view).toContain('data-principal-import-dialog');
    expect(view).toContain('data-principal-import-preview');
    expect(view).toContain('data-principal-import-apply');
    expect(app).toContain("importPrincipals(file, 'preview')");
    expect(app).toContain("importPrincipals(pendingPrincipalImportFile, 'apply')");
    expect(styles).toContain('.principal-dialog::backdrop');
    expect(styles).toContain('min-height:44px');
  });
});
