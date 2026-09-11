const fs = require('fs');
const path = require('path');
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
    expect(view()).toContain('仓库目录');
    expect(view()).toContain('刷新内容');
    expect(view()).toContain('repository-footer');
    expect(view()).not.toContain('class="repository-review"');
  });
  test('Markdown 先转义再以允许元素渲染', () => {
    expect(view()).toContain('escapeHtml(');
    expect(view()).not.toContain('innerHTML');
  });
  test('仓库内容归入审核与发布，管理员可维护映射', () => {
    const assets = read('apps/knowledge-center-web/frontend/knowledge-center/modules/assets/view.js');
    expect(assets).toContain('repositoryMapped');
    expect(assets).toContain("/knowledge-center/review?handbookId=${encodeURIComponent(id)}");
    expect(assets).toContain('<strong>审核与发布</strong>');
    expect(assets).toContain('阅读文档、查看修改并完成审核');
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
    expect(admin).toContain('个分支');
    expect(connector).toContain('lastVerification');
    expect(connector).toContain('authMode');
  });
  test('OAuth 状态通过同源 API 读取，令牌不暴露到前端', () => {
    const api = read('apps/knowledge-center-web/frontend/knowledge-center/common/api/gitlab-api.js');
    expect(api).toContain('/knowledge-center/api/gitlab/oauth/status');
    expect(api).toContain('/knowledge-center/api/gitlab/oauth/disconnect');
    expect(api).not.toContain('accessToken');
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
