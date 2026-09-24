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
  principals: '人员管理',
  permissions: '用户权限',
  gitlab: 'GitLab 仓库',
};

/* ---- 标签页导航 ---- */
function renderTabs(activeTab, teamGroupView = 'people') {
  const tabButton = tab => `<button class="platform-tab" type="button"
      data-platform-tab="${tab}"
      aria-current="${tab === activeTab ? 'page' : 'false'}"
      aria-controls="platform-panel-${tab}"
      id="platform-tab-${tab}"
    >${TAB_LABELS[tab]}</button>`;
  return `<nav class="platform-tabs" aria-label="平台管理分区">
    ${tabButton('governance')}
    <div class="platform-tab-menu" ${activeTab === 'principals' ? 'data-active' : ''}>
      <details>
        <summary class="platform-tab platform-tab-summary" id="platform-tab-principals" aria-haspopup="menu" aria-current="${activeTab === 'principals' ? 'page' : 'false'}">人员管理</summary>
        <div class="platform-submenu" role="menu" aria-label="人员管理子页面">
          <button type="button" role="menuitem" data-team-group-view="people" aria-current="${teamGroupView === 'people' ? 'page' : 'false'}">人员管理</button>
          <button type="button" role="menuitem" data-team-group-view="groups" aria-current="${teamGroupView === 'groups' ? 'page' : 'false'}">团队小组</button>
        </div>
      </details>
    </div>
    ${tabButton('permissions')}
    ${tabButton('gitlab')}
  </nav>`;
}

/* ---- 系统治理标签页 ---- */
function renderDatabaseConnection(projection = null, drawerOpen = false, formState = null, status = null, advancedOpen = false) {
  const loading = !projection || projection.healthStatus === 'loading';
  projection = projection || {};
  const conn = projection.connection || {};
  const current = formState || conn;
  const healthStatus = projection.healthStatus === null ? 'loading' : projection.healthStatus || (projection.status === 'unavailable' ? 'unavailable' : projection.status === 'unconfigured' ? 'unconfigured' : projection.status === 'configured' ? 'configured' : 'loading');
  const healthy = healthStatus === 'healthy';
  const unavailable = healthStatus === 'unavailable';
  const healthText = healthy ? '运行正常' : unavailable ? '暂不可用' : healthStatus === 'unconfigured' ? '未配置' : healthStatus === 'configured' ? '已配置，尚未验证' : projection.status === 'pending_restart' ? '待重启生效' : '';
  const configStateText = loading
    ? ''
    : projection.environmentOverride && projection.restartRequired
    ? '页面配置待生效'
    : projection.environmentOverride
      ? '服务启动时已指定连接'
      : projection.restartRequired
        ? '页面配置待重启生效'
      : unavailable ? (projection.healthError?.message || '连接状态读取失败') : projection.status === 'verified' ? '页面配置已验证' : projection.status === 'configured' ? '页面配置已就绪，运行状态以服务健康为准' : '尚未配置页面连接';
  const verificationText = projection.lastVerification?.verifiedAt ? `最近验证 ${new Date(projection.lastVerification.verifiedAt).toLocaleString('zh-CN', { hour12: false })}` : '';
  const runtime = projection.effectiveConnection || conn;
  const timeoutMs = Number(current.timeoutMs) || 5000;
  const timeoutOptions = [...new Set([5000, 10000, 30000, timeoutMs])].sort((left, right) => left - right).map(value => `<option value="${value}" ${value === timeoutMs ? 'selected' : ''}>${value / 1000} 秒</option>`).join('');
  const busy = status?.kind === 'pending';
  const connectionNote = projection.restartRequired
    ? '<div class="database-connection-note"><strong>配置已保存，等待重启</strong><p>配置已写入 service.env；当前进程仍使用启动时连接，重启服务后生效。</p></div>' : '';
  const statusClass = unavailable ? 'error' : healthy ? 'ok' : 'warning';
  const statusHtml = loading ? '<span class="database-status-skeleton" aria-hidden="true"></span>' : `<span class="status-badge ${statusClass}">${escapeHtml(healthText)}</span>`;
  const configHtml = loading ? '<span class="database-summary-skeleton" aria-hidden="true"></span>' : `<small>${escapeHtml(configStateText)}${verificationText ? ` · ${escapeHtml(verificationText)}` : ''}</small>`;
  const jdbcHtml = loading
    ? '<span class="database-summary-skeleton database-summary-skeleton-jdbc" aria-hidden="true"></span>'
    : `<code>${escapeHtml(runtime.jdbcUrl || conn.jdbcUrl || '尚未配置 JDBC 连接串')}</code>`;
  const card = `<section class="database-connection-panel ${unavailable ? 'is-error' : ''}" ${loading ? 'aria-busy="true"' : ''}><div class="database-connection-summary"><div><div class="database-connection-title-row"><strong>数据库连接</strong>${statusHtml}</div>${configHtml}${jdbcHtml}</div><button class="button secondary" type="button" data-database-open>管理数据库连接</button></div></section>`;
  const dialog = `<dialog class="database-connection-drawer" data-database-dialog aria-labelledby="database-connection-title"><div class="database-connection-drawer-shell"><header class="database-connection-drawer-header"><div><span class="eyebrow">系统治理</span><h2 id="database-connection-title">管理数据库连接</h2></div><button class="icon-button" type="button" data-database-close aria-label="关闭数据库连接配置" title="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header><div class="database-connection-drawer-content"><section class="database-runtime-card" aria-label="当前运行连接"><div class="database-runtime-heading"><div><span>当前运行连接</span><strong>${escapeHtml(healthText)}</strong></div><span class="status-badge ${statusClass}">${healthy ? '正常' : escapeHtml(healthText)}</span></div><code>${escapeHtml(runtime.jdbcUrl || '尚无运行连接')}</code>${runtime.username ? `<small>用户：${escapeHtml(runtime.username)}</small>` : ''}${unavailable ? `<p class="database-runtime-error">${escapeHtml(projection.healthError?.message || projection.error || '数据库连接状态暂不可用')}</p>` : ''}</section>${connectionNote}<section class="database-connection-form" aria-labelledby="database-config-title"><div class="database-config-heading"><h3 id="database-config-title">页面连接配置</h3><p>验证通过后保存，密码不会回显。</p></div><label>JDBC 连接串<input class="database-jdbc-input" name="jdbcUrl" value="${escapeHtml(current.jdbcUrl || '')}" placeholder="jdbc:yasdb://db.example.internal:1688/yashandb" data-database-field="jdbcUrl" spellcheck="false"><small>已包含数据库地址、端口和数据库名。连接串使用等宽字体，便于核对地址、端口和连接参数。示例：jdbc:yasdb://db.example.internal:1688/yashandb</small></label><div class="database-credential-grid"><label>用户名<input name="username" value="${escapeHtml(current.username || '')}" data-database-field="username" autocomplete="username"></label><label>密码<input type="password" name="password" value="" autocomplete="new-password" placeholder="${conn.passwordConfigured ? '留空表示保留当前密码' : '请输入数据库密码'}" data-database-field="password"><small>留空表示保留当前密码。</small></label></div><details class="database-connection-advanced" data-database-advanced ${advancedOpen ? 'open' : ''}><summary>高级设置</summary><div><label>连接名称<input name="name" value="${escapeHtml(current.name || '知识中心主数据库')}" data-database-field="name"></label><label>连接超时<select name="timeoutMs" data-database-field="timeoutMs">${timeoutOptions}</select></label></div></details></section></div><footer class="database-connection-drawer-footer"><div class="database-connection-feedback form-status ${status?.kind || ''}" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(status?.message || '')}</div><div class="database-connection-actions"><button class="button tertiary" type="button" data-database-close ${busy ? 'disabled' : ''}>取消</button><button class="button secondary" type="button" data-database-test ${busy ? 'disabled' : ''}>${busy ? '处理中…' : '仅测试连接'}</button><button class="button primary" type="button" data-database-save ${busy ? 'disabled' : ''}>验证并保存</button></div></footer></div></dialog>`;
  return `${card}${drawerOpen ? dialog : ''}`;
}

function renderGovernanceTab(governanceProjection = {}, projection = {}, databaseProjection = {}, databaseDrawerOpen = false, databaseForm = null, databaseStatus = null, databaseAdvancedOpen = false) {
  const gov = governanceProjection || {};
  const services = Array.isArray(gov.services) ? gov.services : [
    { name: '认证服务', status: 'ok' },
    { name: '文档服务', status: 'ok' },
  ];
  const pendingItems = Array.isArray(gov.pendingItems) ? gov.pendingItems : [];
  const recentOps = Array.isArray(gov.recentOperations) ? gov.recentOperations : [];
  const databaseHealthStatus = databaseProjection.healthStatus === null ? 'loading' : databaseProjection.healthStatus || (databaseProjection.status === 'unavailable' ? 'unavailable' : databaseProjection.status === 'configured' ? 'configured' : databaseProjection.status === 'unconfigured' ? 'unconfigured' : 'loading');
  const databaseSummaryValue = databaseHealthStatus === 'healthy'
    ? '正常'
    : databaseHealthStatus === 'unavailable'
      ? '暂不可用'
      : databaseHealthStatus === 'configured'
        ? '已配置，尚未验证'
        : databaseHealthStatus === 'unconfigured'
          ? '未配置'
          : databaseProjection.status === 'pending_restart' ? '待重启生效' : '';
  const databaseSummaryMeta = databaseProjection.environmentOverride && databaseProjection.restartRequired
    ? '页面配置待生效'
    : databaseProjection.environmentOverride
      ? '服务启动时已指定连接'
      : databaseProjection.restartRequired ? '页面配置待重启' : databaseProjection.configured ? '页面配置已就绪' : '';

  const summaryItems = [
    { label: '服务状态', value: services.every(s => s.status === 'ok') ? '正常' : '存在异常', status: services.every(s => s.status === 'ok') ? 'ok' : 'warning' },
    { label: '数据库状态', value: databaseSummaryValue, loading: databaseHealthStatus === 'loading', meta: databaseSummaryMeta, status: databaseHealthStatus === 'healthy' ? 'ok' : databaseHealthStatus === 'unavailable' ? 'error' : 'warning' },
    { label: '外部连接', value: gov.externalConnectionSummary || `${pendingItems.length} 个需处理`, status: pendingItems.length ? 'warning' : 'ok' },
  ];

  const summaryHtml = `<div class="governance-summary">
    ${summaryItems.map(item => `<div class="governance-summary-item">
      <span class="status-dot ${item.status}" aria-hidden="true"></span>
      <div>
        <div class="governance-summary-label">${item.label}</div>
            <div class="governance-summary-value">${item.loading ? '<span class="database-summary-skeleton database-summary-skeleton-card" aria-hidden="true"></span>' : escapeHtml(item.value)}</div>
        ${item.meta ? `<div class="governance-summary-meta">${escapeHtml(item.meta)}</div>` : ''}
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
    <table class="governance-ops-table" data-table-view-id="platform-recent-operations" data-table-view-schema="1" data-table-view-label="最近治理操作">
      <thead><tr><th data-table-column="time" data-table-column-required="true" data-table-column-label="时间">时间</th><th data-table-column="operator" data-table-column-label="操作者">操作者</th><th data-table-column="action" data-table-column-label="操作">操作</th><th data-table-column="target" data-table-column-label="目标">目标</th><th data-table-column="result" data-table-column-label="结果">结果</th></tr></thead>
      <tbody>
        ${recentOps.map(op => `<tr>
          <td data-table-column="time">${escapeHtml(op.time || op.updatedAt || '-')}</td>
          <td data-table-column="operator">${escapeHtml(op.operator || op.createdBy || '-')}</td>
          <td data-table-column="action">${escapeHtml(op.action || op.operation || '-')}</td>
          <td data-table-column="target">${escapeHtml(op.target || '-')}</td>
          <td data-table-column="result"><span class="status-badge ${op.result === 'success' ? 'ok' : op.result === 'failure' ? 'error' : 'warning'}">${escapeHtml(op.result === 'success' ? '成功' : op.result === 'failure' ? '失败' : op.result || '-')}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : '';

  return `<div role="tabpanel" id="platform-panel-governance" aria-labelledby="platform-tab-governance">
    ${summaryHtml}
    ${renderDatabaseConnection(databaseProjection, databaseDrawerOpen, databaseForm, databaseStatus, databaseAdvancedOpen)}
    <div class="governance-columns">
      ${healthHtml}
      ${pendingHtml}
    </div>
    ${recentOpsHtml}
    ${dataNote(projection)}
  </div>`;
}

/* ---- 用户权限标签页 ---- */
function renderPersonPicker({ id, name, label, people, selectedId = '', excluded = new Set(), searchRole, hint = '' }) {
  const available = people.filter(person => !excluded.has(String(person.principalId)));
  const selected = available.find(person => String(person.principalId) === String(selectedId));
  const options = available.map(person => `<button type="button" role="option" class="team-combobox-option" aria-selected="${String(person.principalId) === String(selectedId)}" data-team-combobox-option="${escapeHtml(person.principalId)}" data-display-name="${escapeHtml(person.displayName)}">${escapeHtml(person.displayName)}</button>`).join('');
  return `<div class="team-person-picker team-combobox" data-team-combobox="${searchRole}"><label for="${id}-search">${label}</label><div class="team-combobox-control"><i data-lucide="search" aria-hidden="true"></i><input id="${id}-search" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-options" autocomplete="off" placeholder="输入姓名快速筛选" aria-label="${label}快速筛选" data-team-combobox-input value="${escapeHtml(selected?.displayName || '')}"><button type="button" class="team-combobox-clear" data-team-combobox-clear aria-label="清除${label}" ${selected ? '' : 'hidden'}>×</button></div><div id="${id}-options" class="team-combobox-options" role="listbox" hidden>${options || '<div class="team-combobox-empty" role="status">暂无匹配人员</div>'}</div><input type="hidden" name="${name}" data-team-combobox-value value="${escapeHtml(selectedId)}">${hint ? `<small>${hint}</small>` : ''}</div>`;
}

function renderTeamGroupsTab(projection = {}, principals = [], selectedGroupId = '', ui = {}) {
  if (!projection || projection.status === 'loading') return `<div role="tabpanel" id="platform-panel-principals" aria-labelledby="platform-tab-principals" class="team-group-page"><header class="principal-page-header"><div><h2>团队小组</h2></div></header><div class="team-group-loading" aria-busy="true"><span></span><span></span><span></span></div></div>`;
  if (projection.status === 'unavailable') {
    const uninitialized = projection.statusCode === 404 || projection.errorCode === 'TEAM_GROUP_SERVICE_UNAVAILABLE' || /不存在|初始化|迁移|404|No context/i.test(projection.error || '');
    return `<div role="tabpanel" id="platform-panel-principals" aria-labelledby="platform-tab-principals" class="team-group-page"><header class="principal-page-header"><div><h2>团队小组</h2></div></header><section class="team-group-unavailable" role="alert"><i data-lucide="triangle-alert" aria-hidden="true"></i><div><h3>${uninitialized ? '团队小组尚未初始化' : '团队小组暂不可用'}</h3><p>${uninitialized ? '当前无法读取团队小组数据，请完成初始化后重新加载。' : escapeHtml(projection.error || '权威数据暂时不能读取，请稍后重试。')}</p><div><button class="button primary" type="button" data-team-group-retry>重新加载</button><button class="button tertiary" type="button" data-platform-tab="governance">前往系统治理</button></div></div></section></div>`;
  }
  const groups = Array.isArray(projection.items) ? projection.items : [];
  const selected = groups.find(item => String(item.teamGroupId) === String(selectedGroupId)) || groups[0];
  const people = Array.isArray(principals) ? principals.filter(item => item.state === 'ACTIVE') : [];
  const memberIds = new Set((selected?.members || []).map(item => String(item.principalId)));
  const leaderId = selected?.leader?.principalId ? String(selected.leader.principalId) : '';
  const savedStatus = ui.saveStatus?.groupId === String(selected?.teamGroupId) ? ui.saveStatus : null;
  const impact = ui.impact?.groupId === String(selected?.teamGroupId) ? ui.impact : null;
  const memberChips = (selected?.members || []).map(member => `<span class="team-member-chip" data-team-member-chip="${escapeHtml(member.principalId)}">${escapeHtml(member.displayName)}<button type="button" data-team-member-remove="${escapeHtml(member.principalId)}" aria-label="移除成员 ${escapeHtml(member.displayName)}"><i data-lucide="x" aria-hidden="true"></i></button><input type="hidden" name="memberPrincipalIds" value="${escapeHtml(member.principalId)}"></span>`).join('');
  const leaderPicker = renderPersonPicker({ id: 'team-group-leader', name: 'leaderPrincipalId', label: '负责人', people, selectedId: leaderId, searchRole: 'leader', hint: '支持输入姓名关键字，使用 ↑/↓ 选择，回车确认。' });
  const memberPicker = renderPersonPicker({ id: 'team-group-member-candidate', name: 'memberCandidate', label: '添加成员', people, excluded: new Set([leaderId, ...memberIds]), searchRole: 'member' });
  return `<div role="tabpanel" id="platform-panel-principals" aria-labelledby="platform-tab-principals" class="team-group-page"><header class="principal-page-header"><div><h2>团队小组</h2></div><button class="button primary" type="button" data-team-group-create>新建团队小组</button></header><div class="team-group-workspace"><aside class="team-group-list"><div class="team-group-list-heading"><strong>团队小组</strong><span>${groups.length} 个</span></div><div class="team-group-list-scroll">${groups.map(group => `<button type="button" class="team-group-list-item ${String(group.teamGroupId) === String(selected?.teamGroupId) ? 'is-selected' : ''}" data-team-group-view="groups" data-team-group-id="${escapeHtml(group.teamGroupId)}"><span><strong>${escapeHtml(group.groupName || '-')}</strong></span><small>${group.leader ? `${escapeHtml(group.leader.displayName)} · ${Number(group.members?.length || 0)} 名成员` : '未设置负责人'}</small></button>`).join('') || '<div class="team-group-list-empty">暂无团队小组</div>'}</div></aside><section class="team-group-detail">${selected ? `<form data-team-group-form data-team-group-id="${escapeHtml(selected.teamGroupId)}" data-team-group-version="${Number(selected.rowVersion || 1)}" data-current-leader-id="${escapeHtml(leaderId)}"><header class="team-group-detail-header"><h3>${escapeHtml(selected.groupName)}</h3>${selected.techDomainName ? `<p>关联领域：${escapeHtml(selected.techDomainName)}</p>` : ''}</header><div class="team-group-field"><label for="team-group-leader">负责人</label><select id="team-group-leader" name="leaderPrincipalId" required><option value="">请选择人员</option>${people.map(person => `<option value="${escapeHtml(person.principalId)}" ${String(person.principalId) === leaderId ? 'selected' : ''}>${escapeHtml(person.displayName)}</option>`).join('')}</select></div><fieldset class="team-group-member-field"><legend>团队成员</legend><div class="team-member-add"><select data-team-member-candidate aria-label="选择要添加的团队成员"><option value="">请选择人员</option>${people.filter(person => String(person.principalId) !== leaderId && !memberIds.has(String(person.principalId))).map(person => `<option value="${escapeHtml(person.principalId)}" data-display-name="${escapeHtml(person.displayName)}">${escapeHtml(person.displayName)}</option>`).join('')}</select><button class="button secondary" type="button" data-team-member-add>添加成员</button></div><div class="team-member-chips" data-team-member-chips>${memberChips || '<span class="team-member-empty" data-team-member-empty>暂无其他团队成员</span>'}</div></fieldset><p class="team-group-status ${savedStatus?.kind || ''}" data-team-group-status role="status" aria-live="polite">${escapeHtml(savedStatus?.message || '')}</p><footer class="team-group-actions"><button class="button primary" type="button" data-team-group-save>保存</button><button class="button tertiary" type="button" data-team-group-cancel>取消</button></footer></form>` : '<div class="empty-state"><strong>暂无团队小组</strong></div>'}</section></div><dialog class="principal-dialog" data-team-group-create-dialog aria-labelledby="team-group-create-title"><form data-team-group-create-form><header><h2 id="team-group-create-title">新建团队小组</h2><button class="icon-button" type="button" data-team-group-create-close aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header><label><span>小组名称 *</span><input name="groupName" required maxlength="255" autocomplete="off"></label><p class="team-group-status" data-team-group-create-status role="status" aria-live="polite"></p><footer><button class="button primary" type="submit">新建</button><button class="button tertiary" type="button" data-team-group-create-close>取消</button></footer></form></dialog></div>`;
}

export function renderPrincipalsTab(projection = {}, listState = {}, teamGroupProjection = {}, teamGroupView = 'people', teamGroupUi = {}) {
  if (teamGroupView === 'groups') return renderTeamGroupsTab(teamGroupProjection, projection.items || [], new URLSearchParams(window.location.search).get('groupId') || '', teamGroupUi);
  if (projection.status === 'unavailable') return `<div role="tabpanel" id="platform-panel-principals" aria-labelledby="platform-tab-principals">${pendingState('人员服务暂不可用', projection.error || '请稍后重试。')}</div>`;
  const items = Array.isArray(projection.items) ? projection.items : [];
  const search = String(listState.search || '').trim().toLowerCase();
  const bindingStatus = listState.bindingStatus || '';
  const state = listState.state || '';
  const filtered = items.filter(item => {
    const matchesSearch = !search || String(item.displayName || '').toLowerCase().includes(search) || String(item.casLoginName || '').toLowerCase().includes(search);
    const matchesBinding = !bindingStatus || (bindingStatus === 'BOUND' ? Boolean(item.casLoginName) : !item.casLoginName);
    const matchesState = !state || item.state === state;
    return matchesSearch && matchesBinding && matchesState;
  });
  const summary = projection.summary || {
    total: items.length,
    bound: items.filter(item => item.casLoginName).length,
    pending: items.filter(item => !item.casLoginName).length,
    inactive: items.filter(item => item.state === 'INACTIVE').length,
  };
  const rows = filtered.length ? filtered.map(item => `<tr>
    <td><strong>${escapeHtml(item.displayName || '-')}</strong></td>
    <td>${escapeHtml(item.casLoginName || '—')}</td>
    <td><span class="status-badge ${item.casLoginName ? 'ok' : 'warning'}">${item.casLoginName ? '已绑定' : '待绑定'}</span></td>
    <td><span class="principal-state ${item.state === 'INACTIVE' ? 'inactive' : 'active'}">${item.state === 'INACTIVE' ? '已停用' : '启用'}</span></td>
    <td>${Number(item.manualReferenceCount || 0)}</td>
    <td>${item.lastLoginAt ? escapeHtml(new Date(item.lastLoginAt).toLocaleString('zh-CN', { hour12: false })) : '—'}</td>
    <td><div class="principal-row-actions">
      <button class="button link compact" type="button" data-principal-edit="${escapeHtml(item.principalId)}">编辑</button>
      <button class="button link compact" type="button" data-principal-toggle="${escapeHtml(item.principalId)}">${item.state === 'INACTIVE' ? '启用' : '停用'}</button>
    </div></td>
  </tr>`).join('') : `<tr><td colspan="7"><div class="principal-empty"><strong>没有匹配的人员</strong><span>请调整搜索词或清除筛选条件。</span><button class="button tertiary" type="button" data-principal-clear-filters>清除筛选</button></div></td></tr>`;
  return `<div role="tabpanel" id="platform-panel-principals" aria-labelledby="platform-tab-principals">
    <header class="principal-page-header">
      <div><h2>人员管理</h2><p>管理知识中心可选责任人及其 CAS 账号绑定。</p></div>
      <div class="principal-header-actions">
        <button class="button secondary" type="button" data-principal-open-import>Excel 批量导入</button>
        <button class="button primary" type="button" data-principal-open-create>+  新增人员</button>
      </div>
    </header>
    <div class="principal-summary" aria-label="人员统计">
      <div><span>全部人员</span><strong>${Number(summary.total || 0)}</strong></div>
      <div><span>已绑定 CAS</span><strong>${Number(summary.bound || 0)}</strong></div>
      <div><span>待绑定</span><strong>${Number(summary.pending || 0)}</strong></div>
      <div><span>已停用</span><strong>${Number(summary.inactive || 0)}</strong></div>
    </div>
    <section class="governance-recent-ops principal-directory">
      <div class="principal-toolbar">
        <label class="principal-search"><span class="sr-only">搜索人员</span><input type="search" value="${escapeHtml(listState.search || '')}" placeholder="搜索姓名或 CAS 登录名…" data-principal-search></label>
        <select data-principal-binding-filter aria-label="按 CAS 绑定状态筛选"><option value="">全部绑定状态</option><option value="BOUND" ${bindingStatus === 'BOUND' ? 'selected' : ''}>已绑定</option><option value="PENDING" ${bindingStatus === 'PENDING' ? 'selected' : ''}>待绑定</option></select>
        <select data-principal-state-filter aria-label="按使用状态筛选"><option value="">全部使用状态</option><option value="ACTIVE" ${state === 'ACTIVE' ? 'selected' : ''}>启用</option><option value="INACTIVE" ${state === 'INACTIVE' ? 'selected' : ''}>已停用</option></select>
        <span class="principal-result-count" aria-live="polite">共 ${filtered.length} 人</span>
      </div>
      <div class="principal-table-wrap"><table class="governance-ops-table principal-table" data-table-view-id="platform-principals" data-table-view-schema="1" data-table-view-label="人员管理"><thead><tr><th data-table-column="name" data-table-column-required="true" data-table-column-label="姓名">姓名</th><th data-table-column="login" data-table-column-label="CAS 登录名">CAS 登录名</th><th data-table-column="binding" data-table-column-label="CAS 绑定状态">CAS 绑定状态</th><th data-table-column="state" data-table-column-label="使用状态">使用状态</th><th data-table-column="manuals" data-table-column-label="手册责任">手册责任</th><th data-table-column="lastLogin" data-table-column-label="最近登录">最近登录</th><th data-table-column="actions" data-table-column-required="true" data-table-column-label="操作">操作</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>
    <dialog class="principal-dialog" data-principal-editor-dialog>
      <form method="dialog" data-principal-editor-form>
        <header><div><h2 data-principal-dialog-title>新增人员</h2><p>人员可在手册和大纲中被选为责任人。</p></div><button class="icon-button" type="button" data-principal-dialog-close aria-label="关闭">×</button></header>
        <input type="hidden" name="principalId"><input type="hidden" name="rowVersion">
        <label><span>姓名 *</span><input name="displayName" required maxlength="128" autocomplete="off"></label>
        <label><span>CAS 登录名</span><input name="casLoginName" maxlength="128" autocomplete="off" aria-describedby="principal-login-help principal-login-error"><small id="principal-login-help" data-principal-login-help>可留空，首次登录时自动绑定。</small><small id="principal-login-error" class="principal-field-error" data-principal-login-error role="alert"></small></label>
        <fieldset><legend>使用状态</legend><label><input type="radio" name="state" value="ACTIVE" checked> 启用</label><label><input type="radio" name="state" value="INACTIVE"> 停用</label></fieldset>
        <footer><span data-principal-form-status role="status"></span><button class="button tertiary" type="button" data-principal-dialog-close>取消</button><button class="button primary" type="submit">确认新增</button></footer>
      </form>
    </dialog>
    <dialog class="principal-dialog principal-cas-correction-dialog" data-principal-cas-correction-dialog aria-labelledby="principal-cas-correction-title">
      <form data-principal-cas-correction-form>
        <header><div><h2 id="principal-cas-correction-title">确认更正 CAS 登录名</h2><p>这会改变该人员后续统一认证使用的账号。</p></div><button class="icon-button" type="button" data-principal-correction-cancel aria-label="关闭">×</button></header>
        <div class="principal-correction-summary">
          <p><span>人员</span><strong data-principal-correction-name></strong></p>
          <p><span>原登录名</span><code data-principal-correction-before></code></p>
          <p><span>新登录名</span><code data-principal-correction-after></code></p>
        </div>
        <p class="principal-correction-warning">更正后，原 CAS 登录名将无法再匹配此人员。请确认新账号属于本人。</p>
        <footer><span data-principal-correction-status role="status"></span><button class="button tertiary" type="button" data-principal-correction-cancel>取消</button><button class="button danger" type="submit">确认更正</button></footer>
      </form>
    </dialog>
    <dialog class="principal-dialog principal-import-dialog" data-principal-import-dialog>
      <form data-principal-import-form>
        <header><div><h2>Excel 批量导入</h2><p>先预检变更和冲突，确认后才写入数据库。</p></div><button class="icon-button" type="button" data-principal-dialog-close aria-label="关闭">×</button></header>
        <div class="principal-import-guide"><a class="button tertiary" href="/knowledge-center/api/platform/principals/template" download="知识中心人员导入模板.xlsx">下载 Excel 模板</a><span>表头：姓名、CAS登录名、状态；单次最多 1000 人。</span></div>
        <label><span>选择 Excel 文件</span><input name="file" type="file" accept=".xlsx" required></label>
        <div class="principal-import-preview" data-principal-import-preview hidden></div>
        <footer><span data-principal-import-status role="status"></span><button class="button tertiary" type="button" data-principal-dialog-close>取消</button><button class="button secondary" type="submit" data-principal-import-preview-button>预检文件</button><button class="button primary" type="button" data-principal-import-apply hidden>确认导入</button></footer>
      </form>
    </dialog>
  </div>`;
}

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
  principalProjection,
  principalListState,
  teamGroupProjection,
  teamGroupView,
  teamGroupUi,
  governanceProjection,
  databaseConnectionProjection,
  databaseConnectionDrawerOpen,
  databaseConnectionAdvancedOpen,
  databaseConnectionForm,
  databaseConnectionStatus,
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
    case 'principals':
      tabContent = renderPrincipalsTab(principalProjection || {}, principalListState || {}, teamGroupProjection, teamGroupView || 'people', teamGroupUi || {});
      break;
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
      tabContent = renderGovernanceTab(governanceProjection, projection, databaseConnectionProjection || {}, databaseConnectionDrawerOpen, databaseConnectionForm, databaseConnectionStatus, databaseConnectionAdvancedOpen);
      break;
  }

  return `<div class="page-intro">
    <h2>平台管理</h2>
    <span class="platform-header-meta">${projection?.asOf ? `更新于 ${new Date(projection.asOf).toLocaleString('zh-CN', { hour12: false })}` : ''}</span>
  </div>
  ${renderTabs(activeTab, teamGroupView || 'people')}
  ${tabContent}`;
}
