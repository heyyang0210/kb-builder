import { dataNote, panel, pendingState } from '../../common/components/ui.js';
import { escapeHtml } from '../../common/utils/dom.js';

const ROLE_DISPLAY_NAMES = {
  PLATFORM_ADMIN: '平台管理员',
  KNOWLEDGE_EDITOR: '文档编辑员',
  OUTLINE_MANAGER: '大纲管理员',
  REVIEWER: '审核管理员',
  TEMPLATE_EDITOR: '模板管理员',
};

const CONNECTION_STATUS_LABELS = {
  unconfigured: '未配置',
  pending: '待验证',
  verified: '已验证',
  failed: '验证失败',
  disabled: '已停用',
};

const TAB_LABELS = {
  governance: '系统治理',
  permissions: '用户权限',
  gitlab: 'GitLab 仓库',
};

/* ---- 标签页导航 ---- */
function renderTabs(activeTab) {
  const tabs = ['governance', 'permissions', 'gitlab'];
  return `<nav class="platform-tabs" role="tablist" aria-label="平台管理分区">
    ${tabs.map(tab => `<button class="platform-tab" role="tab" type="button"
      data-platform-tab="${tab}"
      aria-selected="${tab === activeTab}"
      aria-controls="platform-panel-${tab}"
      id="platform-tab-${tab}"
    >${TAB_LABELS[tab]}</button>`).join('')}
  </nav>`;
}

/* ---- 系统治理标签页 ---- */
function renderGovernanceTab(governanceProjection = {}, projection = {}) {
  const gov = governanceProjection || {};
  const services = Array.isArray(gov.services) ? gov.services : [
    { name: '认证服务', status: 'ok' },
    { name: '文档服务', status: 'ok' },
  ];
  const pendingItems = Array.isArray(gov.pendingItems) ? gov.pendingItems : [];
  const recentOps = Array.isArray(gov.recentOperations) ? gov.recentOperations : [];

  const summaryItems = [
    { label: '服务状态', value: services.every(s => s.status === 'ok') ? '正常' : '存在异常', status: services.every(s => s.status === 'ok') ? 'ok' : 'warning' },
    { label: '存储状态', value: gov.storageStatus || '正常', status: (gov.storageStatus || '正常') === '正常' ? 'ok' : 'warning' },
    { label: '外部连接', value: gov.externalConnectionSummary || `${pendingItems.length} 个需处理`, status: pendingItems.length ? 'warning' : 'ok' },
  ];

  const summaryHtml = `<div class="governance-summary">
    ${summaryItems.map(item => `<div class="governance-summary-item">
      <span class="status-dot ${item.status}" aria-hidden="true"></span>
      <div>
        <div class="governance-summary-label">${item.label}</div>
        <div class="governance-summary-value">${escapeHtml(item.value)}</div>
      </div>
    </div>`).join('')}
  </div>`;

  const healthHtml = `<div>
    <h3 style="margin:0 0 var(--space-3);font-size:15px;font-weight:700">服务健康</h3>
    <div class="governance-health-list">
      ${services.map(s => `<div class="governance-row">
        <span>${escapeHtml(s.name)}</span>
        <span class="status-badge ${s.status === 'ok' ? 'ok' : s.status === 'warning' ? 'warning' : 'error'}">${escapeHtml(s.status === 'ok' ? '正常' : s.status === 'warning' ? '警告' : '异常')}</span>
      </div>`).join('')}
    </div>
  </div>`;

  const pendingHtml = `<div>
    <h3 style="margin:0 0 var(--space-3);font-size:15px;font-weight:700">待处理事项</h3>
    <div class="governance-pending-list">
      ${pendingItems.length ? pendingItems.map(item => `<div class="governance-pending-item">
        <strong>${escapeHtml(item.title || item.name || '待处理')}</strong>
        ${item.description ? `<span style="font-size:13px;color:var(--color-text-secondary)">${escapeHtml(item.description)}</span>` : ''}
        ${item.actionUrl ? `<a href="${escapeHtml(item.actionUrl)}">查看处理</a>` : ''}
      </div>`).join('') : '<div class="empty-state" style="padding:var(--space-4)"><span>暂无待处理事项</span></div>'}
    </div>
  </div>`;

  const recentOpsHtml = recentOps.length ? `<div class="governance-recent-ops">
    <h3 style="margin:0 0 var(--space-3);font-size:15px;font-weight:700">最近治理操作</h3>
    <table class="governance-ops-table">
      <thead><tr><th>时间</th><th>操作者</th><th>操作</th><th>目标</th><th>结果</th></tr></thead>
      <tbody>
        ${recentOps.map(op => `<tr>
          <td>${escapeHtml(op.time || op.updatedAt || '-')}</td>
          <td>${escapeHtml(op.operator || op.createdBy || '-')}</td>
          <td>${escapeHtml(op.action || op.operation || '-')}</td>
          <td>${escapeHtml(op.target || '-')}</td>
          <td><span class="status-badge ${op.result === 'success' ? 'ok' : op.result === 'failure' ? 'error' : 'warning'}">${escapeHtml(op.result === 'success' ? '成功' : op.result === 'failure' ? '失败' : op.result || '-')}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : '';

  return `<div role="tabpanel" id="platform-panel-governance" aria-labelledby="platform-tab-governance">
    ${summaryHtml}
    <div class="governance-columns">
      ${healthHtml}
      ${pendingHtml}
    </div>
    ${recentOpsHtml}
    ${dataNote(projection)}
  </div>`;
}

/* ---- 用户权限标签页 ---- */
function resolveRoles(permissionProjection) {
  if (Array.isArray(permissionProjection.roles) && permissionProjection.roles.length) {
    return permissionProjection.roles.map(role => typeof role === 'string' ? { id: role, name: ROLE_DISPLAY_NAMES[role] || role } : role);
  }
  const assignable = Array.isArray(permissionProjection.assignableRoles) ? permissionProjection.assignableRoles : Object.keys(ROLE_DISPLAY_NAMES);
  return assignable.map(roleId => ({ id: roleId, name: ROLE_DISPLAY_NAMES[roleId] || roleId }));
}

export function renderPermissionResults(permissionProjection = {}, selectedUserId = null, saveStatus = null, userSearch = '', listState = {}) {
  const users = Array.isArray(permissionProjection.users) ? permissionProjection.users : [];
  const roles = resolveRoles(permissionProjection);
  const statusFilter = listState.status || '';
  const roleFilter = listState.role || '';
  const pageSize = Number(listState.pageSize) || 50;
  const page = Math.max(1, Number(listState.page) || 1);
  const filteredUsers = users
    ? users.filter(u => {
        const term = userSearch.toLowerCase();
        const matchesSearch = !term || (u.displayName || u.name || '').toLowerCase().includes(term)
          || (u.loginName || '').toLowerCase().includes(term)
          || (u.id || '').toLowerCase().includes(term);
        const matchesStatus = !statusFilter || (statusFilter === 'active' ? u.enabled !== false : u.enabled === false);
        const matchesRole = !roleFilter || (Array.isArray(u.roles) && u.roles.map(String).includes(roleFilter));
        return matchesSearch && matchesStatus && matchesRole;
      })
    : users;

  const serverPagination = permissionProjection.pagination || null;
  const totalPages = serverPagination ? Math.max(1, Number(serverPagination.totalPages) || 1) : Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = serverPagination ? Math.max(1, Number(serverPagination.page) || 1) : Math.min(page, totalPages);
  const pageUsers = serverPagination ? filteredUsers : filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedUser = users.find(u => u.id === selectedUserId) || pageUsers[0];
  const currentRoles = selectedUser ? new Set([...(selectedUser.roles || [])].map(String)) : new Set();
  const statusText = saveStatus === 'saving' ? '正在保存…' : saveStatus === 'saved' ? '权限已保存' : saveStatus === 'error' ? '保存失败，请重试' : '';
  const statusClass = saveStatus === 'saved' ? 'permission-status-saved' : saveStatus === 'error' ? 'permission-status-error' : '';

  const listHtml = `<ul class="permissions-user-list" role="listbox" aria-label="用户列表">
            ${pageUsers.length ? pageUsers.map(u => {
              const isActive = u.enabled !== false && u.status !== 'inactive' && u.status !== 'disabled';
              const isSelected = selectedUser && u.id === selectedUser.id;
              return `<li class="permissions-user-item${isSelected ? ' selected' : ''}" role="option" aria-selected="${isSelected}" data-permission-user="${escapeHtml(u.id)}" tabindex="0">
                <span class="user-dot ${isActive ? 'active' : 'inactive'}" aria-hidden="true"></span>
                <span class="user-name">${escapeHtml(u.displayName || u.name || '未命名')}</span>
                <span class="user-login">${escapeHtml(u.loginName || '')}</span>
              </li>`;
            }).join('') : '<li class="permissions-no-results">无匹配用户</li>'}
          </ul>`;
  const detailHtml = selectedUser ? `<div class="permissions-detail">
            <div class="permissions-detail-header">
              <h3>${escapeHtml(selectedUser.displayName || selectedUser.name || '未命名用户')}</h3>
              <div class="permissions-detail-meta">
                <span>账号：${selectedUser.status === 'inactive' || selectedUser.status === 'disabled' ? '已停用' : '已激活'}</span>
                <span>来源：${selectedUser.identitySource === 'cas' ? 'CAS' : '本地'}</span>
              </div>
            </div>
            <form class="permission-role-form" data-permission-role-form>
              <p class="muted" style="margin:0 0 var(--space-4);font-size:13px">为该用户分配角色，保存后立即生效。</p>
              <div class="permission-role-grid">
                ${roles.map(role => `<label class="permission-role-label">
                  <input type="checkbox" name="roles" value="${escapeHtml(role.id)}" ${currentRoles.has(String(role.id)) ? 'checked' : ''}>
                  ${escapeHtml(role.name || role.id)}
                </label>`).join('')}
              </div>
              <div class="permission-role-footer">
                <span class="permission-save-status ${statusClass}" role="status">${statusText}</span>
                <button class="button secondary" type="submit" ${saveStatus === 'saving' ? 'disabled' : ''}>保存权限</button>
              </div>
            </form>
          </div>` : '<div class="empty-state"><span>请调整搜索条件</span></div>';

  const paginationHtml = totalPages > 1 ? `<nav class="permissions-pagination" aria-label="用户列表分页">
    <span>第 ${currentPage} / ${totalPages} 页</span>
    <button class="button link compact" type="button" data-permission-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>上一页</button>
    <button class="button link compact" type="button" data-permission-page="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
  </nav>` : '';
  return { listHtml: `${listHtml}${paginationHtml}`, detailHtml, selectedUserId: selectedUser?.id || null, page: currentPage, total: serverPagination ? Number(serverPagination.total) || 0 : filteredUsers.length, totalPages };
}

export function renderPermissionsTab(permissionProjection = {}, selectedUserId = null, saveStatus = null, userSearch = '', listState = {}) {
  if (permissionProjection.status === 'unavailable') {
    return `<div role="tabpanel" id="platform-panel-permissions" aria-labelledby="platform-tab-permissions">
      ${pendingState('权限服务暂不可用', '请稍后重试。')}
    </div>`;
  }
  const users = Array.isArray(permissionProjection.users) ? permissionProjection.users : [];
  const roles = resolveRoles(permissionProjection);
  if (!users.length) {
    return `<div role="tabpanel" id="platform-panel-permissions" aria-labelledby="platform-tab-permissions">
      ${pendingState('暂无可配置用户', '用户首次通过统一认证登录后会出现在这里。')}
    </div>`;
  }
  const results = renderPermissionResults(permissionProjection, selectedUserId, saveStatus, userSearch, listState);

  return `<div role="tabpanel" id="platform-panel-permissions" aria-labelledby="platform-tab-permissions">
    <div class="permissions-layout">
      <div>
        <div class="permissions-search">
          <input type="search" placeholder="搜索用户…" value="${escapeHtml(userSearch)}" data-permission-search aria-label="搜索用户">
          <div class="permissions-filters">
            <select data-permission-status aria-label="按账号状态筛选"><option value="">全部状态</option><option value="active" ${listState.status === 'active' ? 'selected' : ''}>已激活</option><option value="inactive" ${listState.status === 'inactive' ? 'selected' : ''}>已停用</option></select>
            <select data-permission-role aria-label="按角色筛选"><option value="">全部角色</option>${roles.map(role => `<option value="${escapeHtml(role.id)}" ${listState.role === role.id ? 'selected' : ''}>${escapeHtml(role.name || role.id)}</option>`).join('')}</select>
          </div>
          <p class="permissions-count" aria-live="polite">共 ${results.total} 名用户</p>
        </div>
        <div data-permission-user-list>${results.listHtml}</div>
      </div>
      <div data-permission-user-detail>${results.detailHtml}</div>
    </div>
    ${permissionProjection?.generatedAt ? dataNote(permissionProjection) : ''}
  </div>`;
}

/* ---- GitLab 仓库标签页 ---- */
function renderGitLabTab(gitlabProjection = {}, platformAdmin = false, listState = {}, transientVerification = null) {
  gitlabProjection = gitlabProjection || {};
  const connections = Array.isArray(gitlabProjection.connections) ? gitlabProjection.connections : [];
  const search = listState.search || '';
  const page = listState.page || 1;
  const pageSize = listState.pageSize || 20;
  const selectedId = listState.selectedConnectionId;

  const filtered = search
    ? connections.filter(c => {
        const term = search.toLowerCase();
        return (c.name || '').toLowerCase().includes(term)
          || (c.projectPath || c.project || '').toLowerCase().includes(term);
      })
    : connections;

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selected = selectedId ? connections.find(c => c.id === selectedId) : (connections[0] || null);

  const listHtml = `<div class="gitlab-list-panel">
    <div class="gitlab-list-search">
      <i data-lucide="search" class="search-icon" aria-hidden="true"></i>
      <input type="search" placeholder="搜索连接…" value="${escapeHtml(search)}" data-gitlab-list-search aria-label="搜索 GitLab 连接">
    </div>
    <ul class="gitlab-connection-list" role="listbox" aria-label="GitLab 连接列表">
      ${paged.length ? paged.map(c => {
        const status = c.status === 'inactive' || c.managementStatus === 'disabled'
          ? 'disabled'
          : (c.verificationStatus || (c.lastVerification?.status) || (c.verified ? 'verified' : 'unverified'));
        const isSelected = selected && c.id === selected.id;
        const isDisabled = c.managementStatus === 'disabled';
        return `<li class="gitlab-connection-item${isSelected ? ' selected' : ''}${isDisabled ? ' disabled' : ''}" role="option" aria-selected="${isSelected}" data-gitlab-connection="${escapeHtml(c.id)}" tabindex="0">
          <div class="gitlab-connection-name">
            ${escapeHtml(c.name || c.projectPath || c.project || '未命名')}
            ${isDisabled ? '<small style="color:var(--color-text-tertiary);font-weight:400">（已停用）</small>' : ''}
          </div>
          <div class="gitlab-connection-path">${escapeHtml(c.projectPath || c.project || '')}</div>
          <div class="gitlab-connection-meta">
            <span class="conn-status ${status}">${escapeHtml(CONNECTION_STATUS_LABELS[status] || status)}</span>
            ${c.linkedHandbookCount != null ? `<span>· ${c.linkedHandbookCount} 本手册引用</span>` : ''}
          </div>
        </li>`;
      }).join('') : '<li style="padding:16px;text-align:center;color:var(--color-text-secondary);font-size:13px">无匹配连接</li>'}
    </ul>
    ${total > pageSize ? `<div class="gitlab-list-pagination">
      <button data-gitlab-page="prev" ${page <= 1 ? 'disabled' : ''}>上一页</button>
      <span>第 ${page} / ${totalPages} 页</span>
      <button data-gitlab-page="next" ${page >= totalPages ? 'disabled' : ''}>下一页</button>
    </div>` : ''}
    ${platformAdmin ? `<button class="button secondary" type="button" data-gitlab-add-connection style="width:100%">
      <i data-lucide="plus" style="width:16px;height:16px" aria-hidden="true"></i> 添加仓库连接
    </button>` : ''}
  </div>`;

  const detailHtml = selected ? renderGitLabDetail(selected, platformAdmin, transientVerification, gitlabProjection.oauthStatus, gitlabProjection.oauthConfig) : renderGitLabEmpty(platformAdmin);

  return `<div role="tabpanel" id="platform-panel-gitlab" aria-labelledby="platform-tab-gitlab">
    <div class="gitlab-layout">
      ${listHtml}
      <div class="gitlab-detail-panel" id="gitlab-detail-container">
        ${detailHtml}
      </div>
    </div>
  </div>`;
}

function verificationFor(connection, transientVerification) {
  return transientVerification?.connectionId === connection.id ? transientVerification : connection.lastVerification;
}

function renderVerificationStatus(connection, transientVerification) {
  const verification = verificationFor(connection, transientVerification);
  if (!verification) return '<div class="gitlab-verification pending" role="status"><strong>尚未验证</strong><span>验证后将显示读取权限、分支数量和验证时间。</span></div>';
  if (verification.status === 'verifying') return '<div class="gitlab-verification verifying" role="status" aria-live="polite" aria-busy="true"><strong>正在验证连接…</strong><span>正在检查项目访问和读取权限。</span></div>';
  const verifiedAt = verification.verifiedAt ? new Date(verification.verifiedAt).toLocaleString('zh-CN', { hour12: false }) : '-';
  if (verification.status === 'verified') {
    return `<div class="gitlab-verification success" role="status" aria-live="polite"><strong>已验证</strong><span>${escapeHtml(String(verification.branchCount ?? 0))} 个分支 · ${escapeHtml(verifiedAt)}</span></div>`;
  }
  return `<div class="gitlab-verification failure" role="alert"><strong>验证失败</strong><span>${escapeHtml(verification.error?.message || '连接暂时不可用，请重试。')} · ${escapeHtml(verifiedAt)}</span></div>`;
}

function renderGitLabDetail(connection, platformAdmin, transientVerification, oauthStatus = {}, oauthConfig = {}) {
  const verification = verificationFor(connection, transientVerification);
  const status = transientVerification?.connectionId === connection.id ? transientVerification.status : (connection.status === 'inactive' || connection.managementStatus === 'disabled' ? 'disabled' : (connection.verificationStatus || verification?.status || 'pending'));
  const isDisabled = connection.status === 'inactive' || connection.managementStatus === 'disabled';
  const fields = [
    { label: '连接地址', value: connection.baseUrl || connection.host || '-' },
    { label: '项目路径', value: connection.projectPath || connection.project || '-' },
    { label: '认证方式', value: connection.authMode === 'user_oauth' ? '用户 OAuth' : connection.authMode === 'service_account' ? '服务账号' : connection.authMode || '-' },
    { label: connection.authMode === 'user_oauth' ? '当前管理员授权' : '认证状态', value: connection.authMode === 'user_oauth' ? (oauthStatus?.connected ? '已连接，可验证平台配置' : '尚未连接') : (connection.credentialConfigured ? '服务凭证已配置' : '服务凭证未配置') },
    { label: '运行模式', value: connection.mode === 'production' ? '生产读取' : connection.mode === 'sandbox' ? '隔离验证' : '已禁用' },
  ];
  if (connection.linkedHandbookCount != null) {
    fields.push({ label: '关联手册', value: `${connection.linkedHandbookCount}（只读）` });
  }
  const purposeLabel = connection.purpose === 'read_write' ? '读取并支持协作' : '读取生产仓库';
  const readLabel = verification?.status === 'verified' ? '已验证' : verification?.status === 'failed' ? '验证失败' : '待验证';
  const writeLabel = connection.purpose === 'read_write' ? (connection.capabilities?.write ? '已启用' : '未验证') : '未配置';
  const needsOAuth = connection.authMode === 'user_oauth' && !oauthStatus?.connected;
  const oauthHref = `/knowledge-center/api/gitlab/oauth/start?connectionId=${encodeURIComponent(connection.id)}&returnTo=${encodeURIComponent('/knowledge-center/platform?tab=gitlab')}`;

  return `<div class="gitlab-detail-header">
      <h3>${escapeHtml(connection.name || connection.project || '未命名连接')}</h3>
      <div class="gitlab-detail-status">
        <span class="conn-status ${status}">${escapeHtml(CONNECTION_STATUS_LABELS[status] || status)}</span>
      </div>
    </div>
    <div class="gitlab-detail-body">
      <div class="gitlab-detail-fields">
        ${fields.map(f => `<div class="gitlab-detail-field">
          <label>${f.label}</label>
          <div class="field-value">${escapeHtml(f.value)}</div>
        </div>`).join('')}
      </div>
      <section class="gitlab-access" aria-labelledby="gitlab-access-title">
        <h4 id="gitlab-access-title">访问能力</h4>
        <div><span>用途</span><strong>${escapeHtml(purposeLabel)}</strong></div>
        <div><span>读取权限</span><strong>${escapeHtml(readLabel)}</strong></div>
        <div><span>写入权限</span><strong>${escapeHtml(writeLabel)}</strong></div>
      </section>
      ${needsOAuth ? `<div class="gitlab-oauth-prompt" role="status"><strong>需要使用管理员账号验证平台连接</strong><span>这里只验证平台配置和项目可读性，不会代替业务用户授权。</span>${oauthConfig?.configured ? `<a class="button secondary" href="${escapeHtml(oauthHref)}">用我的 GitLab 验证连接</a>` : '<span>GitLab OAuth 尚未配置，请先完成平台配置。</span>'}</div>` : ''}
      ${renderVerificationStatus(connection, transientVerification)}
      ${platformAdmin ? `<div class="gitlab-detail-actions">
        <button class="button secondary" type="button" data-gitlab-verify="${escapeHtml(connection.id)}" ${isDisabled || needsOAuth || verification?.status === 'verifying' ? 'disabled' : ''} ${needsOAuth ? 'title="请先用当前管理员的 GitLab 账号验证连接"' : ''}>${verification ? '重新验证' : '验证连接'}</button>
        <button class="button secondary" type="button" data-gitlab-edit="${escapeHtml(connection.id)}" ${isDisabled ? 'disabled' : ''}>编辑</button>
        ${isDisabled
          ? `<button class="button secondary" type="button" data-gitlab-enable="${escapeHtml(connection.id)}">重新启用</button>`
          : `<button class="button secondary" type="button" data-gitlab-disable="${escapeHtml(connection.id)}">停用</button>`}
      </div>` : ''}
      <div class="gitlab-detail-note">手册映射请到“知识资产”配置；业务用户在阅读具体手册时连接自己的 GitLab 账号。</div>
    </div>`;
}

function renderGitLabEmpty(platformAdmin) {
  return `<div class="gitlab-detail-body">
    <div class="empty-state">
      <strong>暂无 GitLab 连接</strong>
      <span>${platformAdmin ? '点击左侧"添加仓库连接"开始配置' : '请联系平台管理员配置 GitLab 连接'}</span>
    </div>
  </div>`;
}


/* ---- 编辑连接表单 ---- */
function renderGitLabEditForm(connection) {
  return `<div class="gitlab-add-form">
    <h3>编辑 GitLab 仓库连接</h3>
    <form data-gitlab-edit-form>
      <input type="hidden" name="id" value="${escapeHtml(connection.id)}">
      <div class="gitlab-form-steps">
        <div class="gitlab-form-step">
          <h4><span class="step-number">1</span> 基本信息</h4>
          <label>连接名称
            <input name="name" required value="${escapeHtml(connection.name || '')}">
          </label>
          <label>GitLab 地址
            <input name="baseUrl" type="url" required value="${escapeHtml(connection.baseUrl || connection.host || '')}">
          </label>
          <label>项目路径
            <input name="projectPath" required value="${escapeHtml(connection.projectPath || connection.project || '')}">
            <small>GitLab 项目的完整路径</small>
          </label>
          <label>用途
            <select name="purpose">
              <option value="read" ${connection.purpose !== 'read_write' ? 'selected' : ''}>读取</option>
              <option value="read_write" ${connection.purpose === 'read_write' ? 'selected' : ''}>读取并支持后续协作</option>
            </select>
          </label>
          <label>认证模式
            <select name="authMode" data-gitlab-auth-mode>
              <option value="user_oauth" ${connection.authMode !== 'service_account' ? 'selected' : ''}>用户 OAuth（推荐）</option>
              <option value="service_account" ${connection.authMode === 'service_account' ? 'selected' : ''}>平台只读服务账号</option>
            </select>
          </label>
          <label data-gitlab-credential-field ${connection.authMode === 'service_account' ? '' : 'hidden'}>凭证引用名
            <input name="credentialRef" value="" placeholder="例如：production_read">
            <small>${connection.credentialConfigured ? '当前已配置服务凭证；留空则保留原引用。' : '对应后端环境变量 GITLAB_TOKEN_&lt;引用名&gt;，不要填写 Token。'}</small>
          </label>
        </div>
      </div>
      <div class="gitlab-form-footer">
        <span class="form-status" role="status"></span>
        <button class="button tertiary" type="button" data-gitlab-cancel-edit>取消</button>
        <button class="button primary" type="submit">保存更改</button>
      </div>
    </form>
  </div>`;
}

/* ---- 添加连接表单（四步流程） ---- */
function renderGitLabAddForm() {
  return `<div class="gitlab-add-form">
    <h3>添加 GitLab 仓库连接</h3>
    <form data-gitlab-add-form>
      <div class="gitlab-form-steps">
        <div class="gitlab-form-step">
          <h4><span class="step-number">1</span> 基本信息</h4>
          <label>连接名称
            <input name="name" required placeholder="例如：yasdoc">
          </label>
          <label>GitLab 地址
            <input name="baseUrl" type="url" required placeholder="https://gitlab.example.com">
          </label>
          <label>项目路径
            <input name="projectPath" required placeholder="group/project">
            <small>GitLab 项目的完整路径，例如 cod-doc/yasdoc</small>
          </label>
          <label>用途
            <select name="purpose">
              <option value="read">读取</option>
              <option value="read_write">读取并支持后续协作</option>
            </select>
          </label>
        </div>
        <div class="gitlab-form-step">
          <h4><span class="step-number">2</span> 认证方式</h4>
          <label>认证模式
            <select name="authMode" data-gitlab-auth-mode>
              <option value="user_oauth">用户 OAuth（推荐）</option>
              <option value="service_account">平台只读服务账号</option>
            </select>
            <small>CAS 只认证知识中心用户，不等同于 GitLab API 授权</small>
          </label>
          <label data-gitlab-credential-field hidden>凭证引用名
            <input name="credentialRef" placeholder="例如：production_read">
            <small>对应后端环境变量 GITLAB_TOKEN_&lt;引用名&gt;，不要在页面填写 Token</small>
          </label>
        </div>
        <div class="gitlab-form-step">
          <h4><span class="step-number">3</span> 连接验证</h4>
          <p style="font-size:13px;color:var(--color-text-secondary);margin:0">保存后将自动验证地址可访问性、项目权限和读取权限。</p>
          <div id="gitlab-verify-result-container"></div>
        </div>
        <div class="gitlab-form-step">
          <h4><span class="step-number">4</span> 保存并启用</h4>
          <p style="font-size:13px;color:var(--color-text-secondary);margin:0">保存后连接可在"知识资产"中选择使用。</p>
        </div>
      </div>
      <div class="gitlab-form-footer">
        <span class="form-status" role="status"></span>
        <button class="button tertiary" type="button" data-gitlab-cancel-add>取消</button>
        <button class="button primary" type="submit">保存并验证</button>
      </div>
    </form>
  </div>`;
}

/* ---- 主渲染入口 ---- */
export function renderPlatformAdmin({
  projection,
  gitlabProjection,
  permissionProjection,
  governanceProjection,
  selectedPermissionUserId,
  permissionSaveStatus,
  permissionUserSearch,
  permissionListState,
  platformAdmin,
  platformTab,
  gitlabListState,
  gitlabAddingConnection,
  gitlabEditingConnection,
  gitlabVerification,
}) {
  const activeTab = platformTab || 'governance';

  let tabContent;
  switch (activeTab) {
    case 'permissions':
      tabContent = renderPermissionsTab(permissionProjection, selectedPermissionUserId, permissionSaveStatus, permissionUserSearch || '', permissionListState || {});
      break;

    case 'gitlab':
      if (gitlabEditingConnection) {
        tabContent = `<div role="tabpanel" id="platform-panel-gitlab" aria-labelledby="platform-tab-gitlab">
          <div class="gitlab-detail-panel">${renderGitLabEditForm(gitlabEditingConnection)}</div>
        </div>`;
      } else if (gitlabAddingConnection) {
        tabContent = `<div role="tabpanel" id="platform-panel-gitlab" aria-labelledby="platform-tab-gitlab">
          <div class="gitlab-detail-panel">${renderGitLabAddForm()}</div>
        </div>`;
      } else {
        tabContent = renderGitLabTab(gitlabProjection, platformAdmin, gitlabListState || {}, gitlabVerification);
      }
      break;
    case 'governance':
    default:
      tabContent = renderGovernanceTab(governanceProjection, projection);
      break;
  }

  return `<div class="page-intro">
    <h2>平台管理</h2>
    <span class="platform-header-meta">${projection?.asOf ? `更新于 ${new Date(projection.asOf).toLocaleString('zh-CN', { hour12: false })}` : ''}</span>
  </div>
  ${renderTabs(activeTab)}
  ${tabContent}`;
}
