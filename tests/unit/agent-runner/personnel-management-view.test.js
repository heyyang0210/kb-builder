const fs = require('fs');
const path = require('path');
const read = relativePath => fs.readFileSync(path.resolve(__dirname, '../../..', relativePath), 'utf8');

const view = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js'), 'utf8');
const styles = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/styles.css'), 'utf8');
const platformStyles = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/platform-admin.css'), 'utf8');
const app = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/app.js'), 'utf8');
const api = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js'), 'utf8');
const combobox = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/common/searchable-combobox.js'), 'utf8');
const commonStyles = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/common/components.css'), 'utf8');

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

  test('团队小组使用人员管理下拉导航并支持新建小组', () => {
    const saveIndex = view.indexOf('data-team-group-save>保存</button>');
    const cancelIndex = view.indexOf('data-team-group-cancel>取消</button>', saveIndex);
    expect(view).toContain('class="platform-tab-menu"');
    expect(view).toContain('class="platform-tab platform-tab-summary"');
    expect(view).not.toContain('data-platform-principal-default');
    expect(view).not.toContain('展开人员管理子页面');
    expect(view).toContain('role="menu" aria-label="人员管理子页面"');
    expect(view).toContain('data-team-group-view="groups"');
    expect(view).toContain('data-team-group-view="people"');
    expect(view).not.toContain('>返回人员</button>');
    expect(view).toContain('data-team-group-create');
    expect(view).toContain('新建团队小组');
    expect(view).toContain('关联领域：${escapeHtml(selected.techDomainName)}');
    expect(saveIndex).toBeGreaterThan(-1);
    expect(cancelIndex).toBeGreaterThan(saveIndex);
    expect(app).toContain("const query = new URLSearchParams({ tab: 'principals', view });");
    expect(app).toContain("if (view === 'groups' && groupId) query.set('groupId', groupId);");
    expect(app).toContain("const teamView = event.target.closest('[data-team-group-view]');");
  });

  test('团队不可用状态提供恢复入口，名册直接保存', () => {
    expect(view).toContain('团队小组尚未初始化');
    expect(view).toContain('data-team-group-retry');
    expect(view).toContain('前往系统治理');
    expect(view).not.toContain('变更原因');
    expect(view).toContain('data-team-member-add');
    expect(app).toContain('createTeamGroup');
    expect(app).not.toContain('previewTeamRoster');
    expect(app).not.toContain('rosterSignature');
    expect(app).not.toContain("确认保存");
    expect(app).toContain('saveTeamRoster(groupId');
  });

  test('团队人员下拉支持文字筛选、键盘确认和 Esc 收起', () => {
    expect(app).toContain('markDynamicSelects(document)');
    expect(app).not.toContain('enhanceTeamPersonComboboxes()');
    expect(combobox).toContain("event.key === 'Enter'");
    expect(combobox).toContain("event.key === 'Escape'");
    expect(combobox).toContain("event.key === 'ArrowDown'");
    expect(combobox).toContain('aria-activedescendant');
    expect(combobox).toContain('select.dispatchEvent(new Event(\'change\'');
    expect(commonStyles).toContain('.searchable-combobox-input');
    expect(commonStyles).toContain('.searchable-combobox-listbox');
  });

  test('团队会话失效时进入统一重新登录流程', () => {
    expect(api).toContain('if (response.status === 401)');
    expect(api).toContain("window.dispatchEvent(new CustomEvent('knowledge-center:session-expired'))");
    expect(api).toContain("new Error('登录状态已过期')");
    expect(app).toContain("window.addEventListener('knowledge-center:session-expired'");
    expect(app).toContain('rememberCurrentTarget();');
    expect(app).toContain('clearSession();');
    expect(app).toContain("showAuth({ code: 'SESSION_EXPIRED'");
  });
});
