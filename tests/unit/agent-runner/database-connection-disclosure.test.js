const fs = require('fs');
const path = require('path');

const view = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js'), 'utf8');
const app = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/app.js'), 'utf8');
const state = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/common/state/app-state.js'), 'utf8');
const route = fs.readFileSync(path.resolve(__dirname, '../../../packages/agent-runner-core/routes/knowledge-center.js'), 'utf8');

describe('数据库连接右侧抽屉交互', () => {
  test('治理页保留紧凑状态卡，配置在模态抽屉中完成', () => {
    expect(state).toContain('databaseConnectionDrawerOpen: false');
    expect(view).toContain('data-database-open');
    expect(view).toContain('data-database-dialog');
    expect(view).toContain('database-connection-drawer-footer');
    expect(view).not.toContain('data-database-toggle');
  });

  test('抽屉保留运行事实和页面配置的同屏对照', () => {
    expect(view).toContain('当前运行连接');
    expect(view).toContain('页面连接配置');
    expect(view).toContain('管理数据库连接');
    expect(view).not.toContain('页面配置已保存，当前运行连接保持不变');
  });

  test('测试和保存前保留表单草稿，保存成功后清理草稿', () => {
    expect(app).toContain('appState.databaseConnectionForm = databaseConnectionDraft(payload);');
    expect(app).toContain('appState.databaseConnectionForm = null;');
  });

  test('待生效状态不冒充已连接，JDBC 串是唯一地址输入', () => {
    expect(view).toContain('页面配置待生效');
    expect(view).toContain('placeholder="jdbc:yasdb://db.example.internal:1688/yashandb"');
    expect(view).toContain('已包含数据库地址、端口和数据库名');
    expect(view).not.toContain('data-database-field="host"');
    expect(view).not.toContain('data-database-field="port"');
    expect(view).not.toContain('data-database-field="database"');
    expect(app).not.toContain('syncDatabaseConnectionFields');
  });

  test('首屏加载不伪造数据库终态，返回后只展示真实健康结果', () => {
    expect(view).toContain("healthStatus === 'healthy'");
    expect(view).toContain('已配置，尚未验证');
    expect(view).toContain('database-summary-skeleton');
    expect(view).toContain('database-summary-skeleton-card');
    expect(view).toContain('database-status-skeleton');
    expect(view).not.toContain("loading ? '正在检查'");
    expect(view).not.toContain("loading\n    ? '正在读取数据库运行状态…'");
    expect(app).toContain('loadDatabaseConnectionStatus');
    expect(app).toContain("healthStatus: 'loading'");
    expect(app).not.toContain('const projectionResult = await loadDatabaseConnection()');
    expect(route).toContain('const data = databaseConnection.currentHealth()');
    expect(route).toContain('await databaseConnection.refreshHealth({ force: true })');
    expect(route).toContain('autoStartHealthMonitor: false');
    expect(route).toContain("res.writeHead(405, { Allow: 'GET, POST' })");
  });

  test('抽屉内 JDBC 字段保留等宽字体，摘要卡使用页面统一字体', () => {
    expect(view).toContain('连接串使用等宽字体，便于核对地址、端口和连接参数');
    const styles = fs.readFileSync(path.resolve(__dirname, '../../../apps/knowledge-center-web/frontend/knowledge-center/styles.css'), 'utf8');
    expect(styles).toContain('.database-jdbc-input { font-family: ui-monospace');
    expect(styles).toContain('.database-connection-summary code { overflow: hidden; color: var(--color-text); font: inherit;');
  });

  test('运行状态与页面配置分层，不向用户暴露内部来源术语', () => {
    expect(view).toContain('服务启动时已指定连接');
    expect(view).toContain('页面连接配置');
    expect(view).toContain('仅测试连接');
    expect(view).toContain('验证并保存');
    expect(view).not.toContain('部署配置');
    expect(view).not.toContain('部署覆盖');
    expect(view).not.toContain('保存并提示重启');
  });

  test('低频字段进入高级设置，提交期间按钮不可重复点击', () => {
    expect(view).toContain('database-connection-advanced');
    expect(view).toContain('<summary>高级设置</summary>');
    expect(view).toContain("status?.kind === 'pending'");
    expect(view).toContain("${busy ? 'disabled' : ''}");
  });

  test('关闭前保护未保存修改，关闭后恢复焦点', () => {
    expect(app).toContain('当前修改尚未保存，确定关闭吗？');
    expect(app).toContain("document.addEventListener('cancel'");
    expect(app).toContain("document.querySelector('[data-database-open]')?.focus()");
  });

  test('待生效说明只出现一处，保存反馈不重复原因和步骤', () => {
    expect(view).toContain('配置已写入 service.env；当前进程仍使用启动时连接，重启服务后生效。');
    expect(app).toContain("message: '页面配置已保存。'");
    expect(app).not.toContain('页面配置已保存。移除服务启动时指定的数据库连接并重启后生效。');
  });

  test('密码草稿不进入重绘 HTML，测试结果在原抽屉内更新', () => {
    expect(view).toContain('type="password" name="password" value=""');
    expect(view).not.toContain('formState?.password');
    expect(app).toContain('updateDatabaseConnectionOperationUi(dialog');
  });

  test('平台数据刷新引发重绘时保留密码草稿，且不写入持久状态', () => {
    expect(app).toContain("const databasePasswordDraft = document.querySelector('[data-database-dialog] [data-database-field=\"password\"]')?.value || '';");
    expect(app).toContain('if (passwordInput && databasePasswordDraft) passwordInput.value = databasePasswordDraft;');
    expect(state).not.toContain('databaseConnectionPassword');
    expect(app).not.toContain('localStorage.setItem(\'databaseConnectionPassword\'');
    expect(app).toContain('const { password: _password, ...draft } = payload;');
    expect(app).toContain("if (passwordInput) passwordInput.value = '';");
  });
});
