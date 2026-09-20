const fs = require('fs');
const path = require('path');

const view = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js'), 'utf8');
const app = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/app.js'), 'utf8');
const state = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/common/state/app-state.js'), 'utf8');

describe('数据库连接面板折叠交互', () => {
  test('默认采用三态披露，待重启不会强制展开', () => {
    expect(state).toContain("databaseConnectionDisclosure: 'auto'");
    expect(view).toContain("disclosure === 'expanded'");
    expect(view).toContain("disclosure === 'auto' && projection.status === 'unconfigured'");
    expect(view).not.toContain('projection.restartRequired ||');
    expect(view).not.toContain("status?.kind === 'error'");
  });

  test('用户手动收起优先，摘要保留运行事实', () => {
    expect(app).toContain("databaseConnectionDisclosure = databaseToggle.getAttribute('aria-expanded') === 'true' ? 'collapsed' : 'expanded'");
    expect(view).toContain('effectiveSource');
    expect(view).toContain('restartText');
    expect(view).toContain('data-database-toggle');
  });

  test('测试和保存前保留表单草稿，保存成功后清理草稿', () => {
    expect(app).toContain('appState.databaseConnectionForm = payload;');
    expect(app).toContain('appState.databaseConnectionForm = null;');
  });

  test('待生效状态不冒充已连接，JDBC 串是唯一地址输入', () => {
    expect(view).toContain("projection.status === 'pending_restart' ? '待重启'");
    expect(view).toContain('placeholder="jdbc:yasdb://db.example.internal:1688/yashandb"');
    expect(view).toContain('连接串已包含数据库地址、端口和数据库名');
    expect(view).not.toContain('data-database-field="host"');
    expect(view).not.toContain('data-database-field="port"');
    expect(view).not.toContain('data-database-field="database"');
    expect(app).not.toContain('syncDatabaseConnectionFields');
  });
});
