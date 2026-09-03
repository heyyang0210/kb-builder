import { dataNote, panel, pendingState } from '../../common/components/ui.js';
import { escapeHtml } from '../../common/utils/dom.js';

function gitLabConnections(gitlabProjection = {}) {
  const projection = gitlabProjection || {};
  const items = Array.isArray(projection.connections) ? projection.connections : [];
  const oauth = projection.oauthStatus || {};
  const connection = items[0] || null;
  const isConfigured = Boolean(connection);
  const isAuthenticated = oauth.connected;
  const needsAuth = isConfigured && !isAuthenticated;
  const warning = oauth.mode === 'development-only'
    ? '<p class="integration-warning" role="note">当前使用 HTTP OAuth 回调，仅用于开发联调；生产环境必须切换为 HTTPS。</p>'
    : '';
  const oauthConfig = projection.oauthConfig || {};
  const oauthNotConfigured = !oauthConfig.configured;
  const setupGuide = oauthNotConfigured
    ? '<div class="oauth-setup-hint"><strong>🔧 GitLab OAuth 尚未配置</strong><p>请先完成 OAuth 应用配置：<a href="/knowledge-center/docs/gitlab-oauth-setup-guide.md" target="_blank">查看配置指南</a> 或运行 <code>./scripts/setup-gitlab-oauth.sh</code></p></div>'
    : '';

  let statusPanel = '';
  if (!isConfigured) {
    statusPanel = pendingState('尚未配置 GitLab 仓库', '填写右侧表单并保存连接后，才能进行认证和内容映射。');
  } else if (needsAuth) {
    const connectHref = `/knowledge-center/api/gitlab/oauth/start?connectionId=${encodeURIComponent(connection.id || '')}&returnTo=${encodeURIComponent('/knowledge-center/platform')}`;
    statusPanel = `<div class="gitlab-auth-needed">
      <div class="gitlab-auth-info">
        <strong>${escapeHtml(connection.name || connection.project || '未命名连接')}</strong>
        <span>${escapeHtml(connection.host || '')} / ${escapeHtml(connection.project || '')}</span>
        <span class="asset-status">${connection.mode === 'production' ? '生产' : connection.mode === 'sandbox' ? '隔离验证' : '未启用'}</span>
      </div>
      <div class="gitlab-auth-actions">
        <a class="button primary" href="${connectHref}" data-gitlab-oauth-connect>连接 GitLab 账号</a>
        <span class="muted">需要 GitLab OAuth 授权才能读取仓库内容</span>
      </div>
    </div>`;
  } else {
    statusPanel = `<div class="gitlab-connected">
      <div class="gitlab-connected-info">
        <strong>${escapeHtml(connection.name || connection.project || '未命名连接')}</strong>
        <span>${escapeHtml(connection.host || '')} / ${escapeHtml(connection.project || '')}</span>
        <span class="asset-status connected">已连接</span>
      </div>
      <div class="gitlab-connected-actions">
        <button class="button tertiary compact" type="button" data-gitlab-refresh-repo>刷新仓库信息</button>
      </div>
    </div>`;
  }

  return `<div class="integration-layout"><div>${warning}${setupGuide}${statusPanel}</div><form class="integration-form" data-gitlab-connection-form><h3>配置手册仓库</h3><label>连接名称<input name="name" value="${escapeHtml(connection?.name || 'yasdoc')}" required></label><label>GitLab 地址<input name="host" type="url" value="${escapeHtml(connection?.host || 'https://git-tools.yasdb.com')}" required></label><label>项目路径<input name="project" value="${escapeHtml(connection?.project || 'cod-doc/yasdoc')}" required></label><label>默认分支<input name="defaultBranch" value="${escapeHtml(connection?.defaultBranch || 'master')}" required></label><label>运行模式<select name="mode"><option value="disabled" ${connection?.mode === 'disabled' ? 'selected' : ''}>未启用</option><option value="sandbox" ${connection?.mode === 'sandbox' ? 'selected' : ''}>隔离验证</option><option value="production" ${connection?.mode === 'production' ? 'selected' : ''}>生产读取</option></select></label><details class="integration-compat"><summary>兼容模式（服务账号）</summary><label>凭证引用<input name="credentialRef" placeholder="可选，例如 production_read" value="${escapeHtml(connection?.credentialRef || '')}"><small>OAuth 是默认连接方式；仅在明确启用服务账号兼容模式时填写。</small></label></details><footer><span class="integration-form-status" role="status"></span><button class="button secondary" type="submit">${isConfigured ? '更新连接' : '保存连接'}</button></footer></form></div>`;
}

const ROLE_DISPLAY_NAMES = {
  PLATFORM_ADMIN: '平台管理员',
  KNOWLEDGE_EDITOR: '知识编辑',
  OUTLINE_MANAGER: '大纲管理员',
  REVIEWER: '审核者',
};

function resolveRoles(permissionProjection) {
  if (Array.isArray(permissionProjection.roles) && permissionProjection.roles.length) {
    return permissionProjection.roles.map(role => typeof role === 'string' ? { id: role, name: ROLE_DISPLAY_NAMES[role] || role } : role);
  }
  const assignable = Array.isArray(permissionProjection.assignableRoles) ? permissionProjection.assignableRoles : Object.keys(ROLE_DISPLAY_NAMES);
  return assignable.map(roleId => ({ id: roleId, name: ROLE_DISPLAY_NAMES[roleId] || roleId }));
}

function permissionsPanel(permissionProjection = {}, selectedUserId = null, saveStatus = null) {
  const users = Array.isArray(permissionProjection.users) ? permissionProjection.users : [];
  const roles = resolveRoles(permissionProjection);
  if (permissionProjection.status === 'unavailable') return pendingState('权限服务暂不可用', '请稍后重试。');
  if (!users.length) return pendingState('暂无可配置用户', '用户首次通过统一认证登录后会出现在这里。');

  const selectedUser = users.find(u => u.id === selectedUserId) || users[0];
  const currentRoles = new Set([...(selectedUser.roles || [])].map(String));
  const statusText = saveStatus === 'saving' ? '正在保存…' : saveStatus === 'saved' ? '✓ 权限已保存' : saveStatus === 'error' ? '保存失败，请重试' : '';
  const statusClass = saveStatus === 'saved' ? 'permission-status-saved' : saveStatus === 'error' ? 'permission-status-error' : '';

  return `<div class="permission-config-panel">
    <p class="muted permission-config-desc">为已登录用户分配角色，保存后立即生效。</p>
    <div class="permission-user-select">
      <label for="permission-user-dropdown">选择用户</label>
      <select id="permission-user-dropdown" data-permission-user-select>
        ${users.map(u => `<option value="${escapeHtml(u.id)}" ${u.id === selectedUser.id ? 'selected' : ''}>${escapeHtml(u.displayName || u.name || u.loginName || '未命名用户')}（${escapeHtml(u.loginName || '')}）${u.identitySource === 'cas' ? ' · 统一认证' : ' · 本地账号'}</option>`).join('')}
      </select>
    </div>
    <form class="permission-role-form" data-permission-role-form>
      <div class="permission-role-grid">${roles.map(role => `<label class="permission-role-label"><input type="checkbox" name="roles" value="${escapeHtml(role.id)}" ${currentRoles.has(String(role.id)) ? 'checked' : ''}>${escapeHtml(role.name || role.id)}</label>`).join('')}</div>
      <div class="permission-role-footer">
        <span class="permission-save-status ${statusClass}" role="status">${statusText}</span>
        <button class="button secondary" type="submit" ${saveStatus === 'saving' ? 'disabled' : ''}>保存权限</button>
      </div>
    </form>
  </div>`;
}

function renderPlatformAdminLegacy({ projection, gitlabProjection }) {
  return `<div class="page-intro"><div><p class="eyebrow">连接、权限与审计</p><h2>平台管理</h2><p class="muted">管理连接配置和平台治理。具体参考资料和生产任务仍在文档生产中处理。</p></div></div>${panel('GitLab 手册仓库', gitLabConnections(gitlabProjection), dataNote(projection))}${panel('系统治理', pendingState('治理信息暂不可用', '权限、审计和任务监控将在数据可用后显示。'), dataNote(projection))}`;
}

export function renderPlatformAdmin(args) {
  const base = renderPlatformAdminLegacy(args).replace('<p class="eyebrow">连接、权限与审计</p>', '').replace('<p class="muted">管理连接配置和平台治理。具体参考资料和生产任务仍在文档生产中处理。</p>', '');
  return `${base}${panel('用户权限', permissionsPanel(args.permissionProjection, args.selectedPermissionUserId, args.permissionSaveStatus), args.permissionProjection?.generatedAt ? dataNote(args.permissionProjection) : '')}`;
}
