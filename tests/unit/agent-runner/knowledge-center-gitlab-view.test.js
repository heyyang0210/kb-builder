const fs = require('fs');
const path = require('path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('知识资产 GitLab 阅读前端契约', () => {
  const view = () => read('apps/knowledge-center-web/frontend/knowledge-center/modules/repository/view.js');
  test('普通用户仅按手册映射读取仓库内容', () => {
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/gitlab-api.js');
    expect(api).toContain('/knowledge-center/api/gitlab/handbooks');
    expect(api).toContain('/knowledge-center/api/gitlab/mappings/');
    expect(view()).not.toContain('credentialRef');
    expect(api).toContain("'Idempotency-Key'");
  });
  test('知识资产列表与仓库阅读深链不互相覆盖', () => {
    const navigation = read('apps/knowledge-center-web/frontend/knowledge-center/common/state/navigation.js');
    expect(navigation).toContain("view !== 'repository'");
    expect(navigation).toContain("normalized.startsWith('/knowledge-center/assets/')");
  });
  test('阅读工作区展示目录正文分支提交和错误状态', () => {
    for (const label of ['目录', '分支', '提交', '正在读取仓库内容', '无权限访问此仓库内容', 'GitLab 账号尚未连接', '连接 GitLab 账号', '该手册尚未配置可读内容', '找不到请求的仓库内容', '仓库服务暂时不可用']) expect(view()).toContain(label);
    expect(view()).toContain('repository-workspace');
    expect(view()).toContain('data-repository-file');
    expect(view()).toContain('treeHierarchy');
    expect(view()).toContain('data-repository-language');
    expect(view()).toContain('>英文</button>');
    expect(view()).toContain('仓库目录');
    expect(view()).toContain('刷新内容');
    expect(view()).toContain('repository-footer');
    expect(view()).not.toContain('class="repository-review"');
  });
  test('仓库成功读取后保留真实分支、语言和正文路径恢复所需契约', () => {
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(app).toContain('canonicalUrl.searchParams.set(\'branch\', branch)');
    expect(app).toContain('canonicalUrl.searchParams.set(\'lang\', state.language)');
    expect(app).toContain('canonicalUrl.searchParams.set(\'path\', resolvedPath)');
    expect(app).toContain('window.history.replaceState');
    expect(app).toContain('path: resolvedPath');
  });
  test('映射回填同步公共 Combobox 的可见值', () => {
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    const combobox = read('apps/knowledge-center-web/frontend/knowledge-center/common/searchable-combobox.js');
    expect(app).toContain('syncSearchableSelect(form.elements.connectionId)');
    expect(combobox).toContain('export function syncSearchableSelect(select)');
  });
  test('Markdown 先转义再以允许元素渲染', () => {
    expect(view()).toContain('escapeHtml(');
    expect(view()).not.toContain('innerHTML');
  });
  test('仓库内容归入审核与发布，管理员可维护映射', () => {
    const assets = read('apps/knowledge-center-web/frontend/knowledge-center/modules/assets/view.js');
    expect(assets).toContain('repositoryMapped');
    expect(assets).toContain("/knowledge-center/review?handbookId=${encodeURIComponent(id)}");
    expect(assets).toContain("{ key: 'review', label: '审核与发布', href: reviewHref }");
    expect(assets).toContain('repositoryMapped ? `/knowledge-center/assets/${encodeURIComponent(id)}/repository`');
    expect(assets).not.toContain('<strong>仓库内容</strong>');
    expect(assets).toContain('配置仓库映射');
    expect(assets).toContain('维护仓库映射');
    expect(assets).toContain('data-repository-mapping-form');
  });
  test('平台管理员可在平台管理页配置 GitLab 连接', () => {
    const admin = read('apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js');
    // 新架构：三标签页 + 连接列表 + 添加表单
    expect(admin).toContain('GitLab 仓库');
    expect(admin).toContain('data-gitlab-add-form');
    expect(admin).toContain('GitLab 地址');
    expect(admin).toContain('添加仓库连接');
    expect(admin).toContain('验证连接');
    expect(admin).toContain('停用');
    expect(admin).not.toContain('accessToken');
  });
  test('平台标签与 GitLab 新增操作使用统一的 Lucide 图标', () => {
    const admin = read('apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js');
    const css = read('apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/platform-admin.css');
    for (const name of ['settings-2', 'users-round', 'shield-check', 'git-branch', 'bot']) {
      expect(admin).toContain(`: '${name}'`);
    }
    expect(admin).toContain('data-lucide="chevron-down"');
    expect(admin).toContain('data-gitlab-add-connection><i data-lucide="plus"');
    expect(admin).toContain('data-version-mapping-add title="新增映射" aria-label="新增映射"><i data-lucide="plus"');
    expect(admin).not.toContain('＋ 添加仓库连接');
    expect(css).toContain('.platform-tab-icon { width: 20px; height: 20px;');
    expect(css).toContain('details[open] .platform-nav-chevron');
  });
  test('版本映射页只展示真实规则，参考候选从新增表单选择', () => {
    const admin = read('apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(admin).toContain('const items = rules;');
    expect(admin).toContain('data-version-mapping-preset');
    expect(admin).toContain('状态</th><th>操作</th>');
    expect(admin).not.toContain('data-version-mapping-candidate=');
    expect(admin).not.toContain('gitlab-version-candidates');
    expect(admin).not.toContain('data-version-mapping-preview');
    expect(admin).toContain("productCode: 'DB', matchKind: 'EXACT', version: '23.4.7', branch: 'br23.4.7'");
    expect(admin).toContain("productCode: 'DB', matchKind: 'EXACT', version: '23.4.18.0', branch: 'br23.4'");
    expect(admin).toContain("productCode: 'DB', matchKind: 'EXACT', version: '27.1.1.0', branch: 'master'");
    expect(admin).toContain("productCode: 'YCM', matchKind: 'ALL', version: '', branch: 'dev'");
    expect(admin).toContain("productCode: 'YDC', matchKind: 'ALL', version: '', branch: 'dev'");
    expect(app).toContain('data-version-mapping-preset');
    expect(app).not.toContain('data-version-mapping-preview');
  });
  test('主表只计数真实规则，归档记录默认折叠且可恢复', () => {
    const script = `import { renderPlatformAdmin } from './apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js';
      const render = (rules, archived = [], state = {}) => renderPlatformAdmin({ projection: {}, gitlabProjection: { connections: [{ id: 'r1', name: 'yasdoc' }], versionMappings: rules, archivedVersionMappings: archived }, platformAdmin: true, platformTab: 'gitlab', gitlabListState: { mappingView: true, ...state } });
      const empty = render([]);
      if ((empty.match(/class="gitlab-version-table"/g) || []).length !== 1 || !empty.includes('0 / 0 条映射') || empty.includes('data-version-mapping-candidate=')) throw Error('候选仍混入主表');
      const row = { id: 1, productCode: 'DB', matchKind: 'EXACT', version: '23.4.7', connectionId: 'r1', branch: 'br23.4.7', state: 'draft' };
      const saved = render([row]);
      if (!saved.includes('1 / 1 条映射') || !saved.includes('yasdoc')) throw Error('真实规则未计数');
      const archived = render([], [{ ...row, state: 'archived' }]);
      if (!archived.includes('已归档（1）') || !archived.includes('data-version-mapping-action="restore"') || archived.includes('已归档（1）</summary>')) throw Error('归档缩略区缺失');
      const form = render([], [], { mappingEditing: true });
      if (!form.includes('data-version-mapping-preset') || !form.includes('YCM / 所有版本')) throw Error('新增表单缺少候选');`;
    expect(() => execFileSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', script], { cwd: root })).not.toThrow();
  });
  test('仓库连接以表格比较，筛选后仅为选中连接打开精简详情', () => {
    const script = `import { renderPlatformAdmin } from './apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js';
      const connections = [
        { id: 'active', name: '正式连接', projectPath: 'team/docs', authMode: 'service_account', purpose: 'read', managementStatus: 'active', lastVerification: { status: 'verified', verifiedAt: '2026-11-11T00:00:00Z', branchCount: 3 }, linkedHandbookCount: 2 },
        { id: 'disabled', name: '停用连接', projectPath: 'team/old', authMode: 'user_oauth', managementStatus: 'disabled', lastVerification: { status: 'failed' } },
      ];
      const render = state => renderPlatformAdmin({ projection: {}, gitlabProjection: { connections }, platformAdmin: true, platformTab: 'gitlab', gitlabListState: state });
      const list = render({});
      if (!list.includes('class="gitlab-connection-table"') || !list.includes('data-gitlab-connection="active"') || list.includes('gitlab-connection-drawer')) throw Error('主表或抽屉默认状态错误');
      if (list.includes('<h3>GitLab 仓库</h3>') || !list.includes('data-gitlab-add-connection')) throw Error('仓库标题重复或新增入口缺失');
      if (!list.includes('>通过</span><time datetime="2026-11-11T00:00:00Z">') || !list.includes('class="gitlab-verification-time">—</span>')) throw Error('读取验证结果或时间缺失');
      const filtered = render({ status: 'disabled', verificationStatus: 'failed' });
      if (filtered.includes('data-gitlab-connection="active"') || !filtered.includes('data-gitlab-connection="disabled"')) throw Error('状态与验证筛选未生效');
      const detail = render({ selectedConnectionId: 'active', drawerOpen: true });
      if (!detail.includes('gitlab-connection-drawer') || !detail.includes('平台最近读取验证') || !detail.includes('当前管理员授权') && !detail.includes('平台凭证')) throw Error('详情抽屉缺少关键信息');
      if (detail.includes('关联手册</label>') || detail.includes('分支数量</label>')) throw Error('详情抽屉保留了重复字段');`;
    expect(() => execFileSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', script], { cwd: root })).not.toThrow();
  });
  test('连接表单要求实际默认分支并解释认证身份，编辑提交携带版本', () => {
    const admin = read('apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/gitlab-api.js');
    expect(admin.match(/name="defaultBranch" required/g)).toHaveLength(2);
    expect(admin).toContain('使用者本人授权 GitLab 账号');
    expect(admin).toContain('使用平台预置服务凭证');
    expect(admin).toContain('写入权限不在此步验证');
    expect(app).toContain('rowVersion: appState.gitlabEditingConnection?.rowVersion');
    expect(api).toContain("'If-Match': String(changes.rowVersion)");
  });
  test('新增用户 OAuth 连接会自动发起授权，回调后由服务端完成读取验证', () => {
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    const route = read('packages/agent-runner-core/routes/knowledge-center.js');
    expect(app).toContain('正在打开 GitLab 授权');
    expect(app).toContain('/knowledge-center/api/gitlab/oauth/start?connectionId=');
    expect(route).toContain('gitlabConnectionStatus');
    expect(route).toContain('recordVerification(connection.id');
  });
  test('系统治理使用真实平台投影和 GitLab 验证状态，不回退到静态健康值', () => {
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(app).toContain('function updatePlatformGovernance(');
    expect(app).toContain('failedConnections');
    expect(app).toContain('appState.platformGovernance = {');
    expect(app).toContain('updatePlatformGovernance(currentContext, currentOverview)');
  });
  test('平台管理页提供用户角色权限配置入口', () => {
    const admin = read('apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js');
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/platform-api.js');
    expect(admin).toContain('用户权限');
    expect(admin).toContain('data-permission-user');
    expect(admin).toContain('平台管理员');
    expect(api).toContain('/knowledge-center/api/auth/users');
    expect(api).toContain('updatePlatformUserPermissions');
  });
  test('权限搜索只更新结果区域并支持中文组合输入', () => {
    const admin = read('apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(admin).toContain('data-permission-user-list');
    expect(admin).toContain('data-permission-user-detail');
    expect(admin).toContain('无匹配用户');
    expect(admin).toContain('请调整搜索条件');
    expect(app).toContain('function refreshPermissionResults');
    expect(app).toContain('event.isComposing');
    expect(app).toContain("document.addEventListener('compositionstart'");
    expect(app).toContain("document.addEventListener('compositionend'");
  });
  test('用户权限使用中文角色名并对大量人员分页筛选', () => {
    const admin = read('apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    for (const label of ['文档编辑员', '审核管理员', '模板管理员']) expect(admin).toContain(label);
    expect(admin).toContain('pageSize) || 50');
    expect(admin).toContain('data-permission-status');
    expect(admin).toContain('data-permission-role');
    expect(admin).toContain('data-permission-page');
    expect(app).toContain('permissionListState.page = 1');
  });
  test('用户权限渲染在筛选下拉框中声明角色集合', () => {
    const admin = read('apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js');
    expect(admin).toContain('const roles = resolveRoles(permissionProjection);');
    expect(admin).not.toContain('renderPermissionsTab(permissionProjection, selectedUserId, saveStatus, userSearch, listState);\n\n  return');
  });
  test('GitLab 搜索重绘后恢复光标，避免输入字符倒序', () => {
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(app).toContain('const selectionStart = gitlabSearch.selectionStart;');
    expect(app).toContain('const selectionEnd = gitlabSearch.selectionEnd;');
    expect(app).toContain('restored.setSelectionRange(cursorStart, cursorEnd);');
  });
  test('GitLab 详情明确展示访问能力和验证结果', () => {
    const admin = read('apps/knowledge-center-web/frontend/knowledge-center/modules/platform-admin/view.js');
    const connector = read('packages/agent-runner-core/lib/gitlab-connector.js');
    expect(admin).toContain('访问能力');
    expect(admin).toContain('正在验证连接');
    expect(admin).toContain('验证失败');
    expect(admin).not.toContain('个分支');
    expect(admin).toContain('读取验证成功');
    expect(admin).toContain('<option value="read">只读</option>');
    expect(admin).toContain('<option value="read_write">读写</option>');
    expect(admin).toContain("connection.purpose === 'read_write' ? '未验证' : '未配置'");
    expect(admin).not.toContain('读取并支持后续协作');
    expect(connector).toContain('lastVerification');
    expect(connector).toContain('authMode');
  });
  test('OAuth 状态通过同源 API 读取，令牌不暴露到前端', () => {
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/gitlab-api.js');
    expect(api).toContain('/knowledge-center/api/gitlab/oauth/accounts');
    expect(api).toContain('/knowledge-center/api/gitlab/oauth/disconnect');
    expect(api).not.toContain('accessToken');
  });
  test('个人设置按实例连接并使用用户可理解的状态', () => {
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    for (const label of ['已连接', '未连接', '暂时不可用', '需要重新连接', '平台已停用', '最近使用']) expect(app).toContain(label);
    expect(app).toContain('data-external-account-disconnect');
    expect(app).toContain('loadGitLabOAuthAccounts');
    expect(app).not.toContain('最近授权');
    expect(app).not.toContain('Token 有效');
    expect(app).not.toContain('正在续期');
    expect(app).not.toContain('可用范围');
    expect(app).not.toContain('连接由系统自动保持');
    const styles = read('apps/knowledge-center-web/frontend/knowledge-center/styles.css');
    expect(styles).toContain('max-height:340px;overflow-y:auto');
  });
  test('OAuth Token 使用 GitLab 要求的表单编码交换', () => {
    const oauth = read('packages/agent-runner-core/lib/gitlab-oauth.js');
    expect(oauth).toContain("application/x-www-form-urlencoded");
    expect(oauth).toContain('new URLSearchParams');
    expect(oauth).not.toContain("'Content-Type': 'application/json'");
  });
  test('缺少用户授权时明确引导连接 GitLab 账号', () => {
    const connector = read('packages/agent-runner-core/lib/gitlab-connector.js');
    expect(connector).toContain("'GITLAB_OAUTH_REQUIRED'");
    expect(connector).toContain("'请先连接 GitLab 账号'");
  });
  test('映射分支切换事件允许异步刷新目录', () => {
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(app).toContain("document.addEventListener('change', async event => {");
    expect(app).toContain('await loadMappingTree(form, form.elements.connectionId.value');
  });
  test('中英文内容路径只能从真实目录选择', () => {
    const assets = read('apps/knowledge-center-web/frontend/knowledge-center/modules/assets/view.js');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(assets).toContain('data-mapping-language="zh"');
    expect(assets).toContain('data-mapping-language="en"');
    expect(assets).toContain('已选中文路径');
    expect(assets).toContain('已选英文路径');
    expect(assets).not.toContain('textarea name="zhPaths"');
    expect(assets).not.toContain('textarea name="enPaths"');
    expect(app).toContain('选为${activeLabel}');
    expect(app).toContain('zhPaths: appState.mappingState.zhPaths');
    expect(app).toContain('enPaths: appState.mappingState.enPaths');
  });
  test('手册映射路径使用可展开多层目录树且仅目录可选', () => {
    const assets = read('apps/knowledge-center-web/frontend/knowledge-center/modules/assets/view.js');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(assets).toContain('手册映射路径');
    expect(assets).not.toContain('选择内容路径');
    expect(app).toContain('function buildMappingTreeHierarchy(items)');
    expect(app).toContain('data-mapping-tree-expand');
    expect(app).toContain('role="tree"');
    expect(app).toContain("const selectControl = isDirectory");
    expect(app).not.toContain('data-mapping-tree-enter');
    expect(app).not.toContain('data-mapping-tree-nav');
  });
  test('已选路径自动展开祖先且切换分支清空旧映射路径', () => {
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    expect(app).toContain('function expandSelectedMappingAncestors()');
    expect(app).toContain("expanded.add(parts.slice(0, index).join('/'))");
    expect(app).toContain('appState.mappingState.expandedPaths = new Set()');
    expect(app).toContain('appState.mappingState.zhPaths = []');
    expect(app).toContain('appState.mappingState.enPaths = []');
  });
  test('映射界面支持默认分支和多个启用分支', () => {
    const assets = read('apps/knowledge-center-web/frontend/knowledge-center/modules/assets/view.js');
    const app = read('apps/knowledge-center-web/frontend/knowledge-center/app.js');
    const connector = read('packages/agent-runner-core/lib/gitlab-connector.js');
    expect(assets).toContain('选择分支');
    expect(assets).toContain('允许在知识资产中切换的分支');
    expect(assets).toContain('data-mapping-enabled-branches');
    expect(app).toContain('enabledBranches: appState.mappingState.enabledBranches');
    expect(connector).toContain('enabledBranches,');
  });
});
