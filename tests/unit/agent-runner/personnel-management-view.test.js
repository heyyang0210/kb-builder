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

  test('未登录人员可更正错误预绑定账号并需要二次确认', () => {
    expect(view).toContain('data-principal-cas-correction-dialog');
    expect(view).toContain('确认更正 CAS 登录名');
    expect(view).toContain('更正后，原 CAS 登录名将无法再匹配此人员');
    expect(view).toContain('data-principal-login-error');
    expect(app).toContain('const hasLoggedInWithCas = Boolean(item.firstLoginAt || item.lastLoginAt)');
    expect(app).toContain('尚未通过 CAS 登录，可更正错误的预绑定账号');
    expect(app).toContain('该人员已有 CAS 登录记录，不能直接更正');
    expect(app).toContain("error.code === 'CAS_LOGIN_NAME_CONFLICT'");
    expect(styles).toContain('.principal-correction-summary');
  });
});
