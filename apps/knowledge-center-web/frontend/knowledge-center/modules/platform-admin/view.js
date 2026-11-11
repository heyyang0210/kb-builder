import { dataNote, panel, pendingState } from '../../common/components/ui.js';
import { escapeHtml } from '../../common/utils/dom.js';

const ROLE_DISPLAY_NAMES = {
  SUPER_ADMIN: '超级管理员',
  PLATFORM_ADMIN: '平台管理员',
  KNOWLEDGE_EDITOR: '文档编辑员',
  OUTLINE_MANAGER: '大纲管理员',
  REVIEWER: '审核管理员',
  TEMPLATE_EDITOR: '模板管理员',
};

const CONNECTION_STATUS_LABELS = {
  unconfigured: '未配置',
  pending: '待验证',
  verifying: '验证中',
  verified: '通过',
  failed: '失败',
  disabled: '已停用',
};

const VERSION_MAPPING_CANDIDATES = [
  { productCode: 'DB', matchKind: 'EXACT', version: '23.4.7', branch: 'br23.4.7' },
  { productCode: 'DB', matchKind: 'EXACT', version: '23.4.18.0', branch: 'br23.4' },
  { productCode: 'DB', matchKind: 'EXACT', version: '27.1.1.0', branch: 'master' },
  { productCode: 'YCM', matchKind: 'ALL', version: '', branch: 'dev' },
  { productCode: 'YDC', matchKind: 'ALL', version: '', branch: 'dev' },
];

const TAB_LABELS = {
  governance: '系统治理',
  principals: '人员管理',
  permissions: '用户权限',
  gitlab: 'GitLab 仓库',
  mcp: 'MCP 服务',
  models: 'Agent&模型服务',
};

const TAB_ICONS = {
  governance: 'settings-2',
  principals: 'users-round',
  permissions: 'shield-check',
  gitlab: 'git-branch',
  mcp: 'plug',
  models: 'bot',
};

function platformTabLabel(tab, label = TAB_LABELS[tab]) {
  return `<i class="platform-tab-icon" data-lucide="${TAB_ICONS[tab]}" aria-hidden="true"></i><span>${label}</span>`;
}

/* ---- 标签页导航 ---- */
function renderTabs(activeTab, teamGroupView = 'people') {
  const tabButton = tab => `<button class="platform-tab" type="button"
      data-platform-tab="${tab}"
      aria-current="${tab === activeTab ? 'page' : 'false'}"
      aria-controls="platform-panel-${tab}"
      id="platform-tab-${tab}"
    >${platformTabLabel(tab)}</button>`;
  return `<nav class="platform-tabs" aria-label="平台管理分区">
    ${tabButton('governance')}
    <div class="platform-tab-menu" ${activeTab === 'principals' ? 'data-active' : ''}>
      <details data-dismissible-menu>
        <summary class="platform-tab platform-tab-summary" id="platform-tab-principals" aria-haspopup="menu" aria-current="${activeTab === 'principals' ? 'page' : 'false'}">${platformTabLabel('principals', activeTab === 'principals' && teamGroupView === 'groups' ? '人员管理 · 团队小组' : '人员管理')}<i class="platform-nav-chevron" data-lucide="chevron-down" aria-hidden="true"></i></summary>
        <div class="platform-submenu" role="menu" aria-label="人员管理子页面">
          <button type="button" role="menuitem" data-team-group-view="people" aria-current="${teamGroupView === 'people' ? 'page' : 'false'}">人员管理</button>
          <button type="button" role="menuitem" data-team-group-view="groups" aria-current="${teamGroupView === 'groups' ? 'page' : 'false'}">团队小组</button>
        </div>
      </details>
    </div>
    ${tabButton('permissions')}
    ${tabButton('gitlab')}
    ${tabButton('models')}
  </nav>`;
}

/* ---- 系统治理标签页 ---- */
function renderDatabaseConnection(projection = null, drawerOpen = false, formState = null, status = null, advancedOpen = false, drawerOnly = false) {
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
  const needsConfigNote = projection.environmentOverride || projection.restartRequired || unavailable || (healthStatus !== 'healthy' && healthStatus !== 'loading');
  const configHtml = loading ? '<span class="database-summary-skeleton" aria-hidden="true"></span>' : needsConfigNote ? `<small>${escapeHtml(configStateText)}${verificationText ? ` · ${escapeHtml(verificationText)}` : ''}</small>` : verificationText ? `<small>${escapeHtml(verificationText)}</small>` : '';
  const jdbcHtml = loading
    ? '<span class="database-summary-skeleton database-summary-skeleton-jdbc" aria-hidden="true"></span>'
    : `<code>${escapeHtml(runtime.jdbcUrl || conn.jdbcUrl || '尚未配置 JDBC 连接串')}</code>`;
  const card = `<section class="database-connection-panel ${unavailable ? 'is-error' : ''}" aria-label="数据库连接" ${loading ? 'aria-busy="true"' : ''}><div class="database-connection-summary"><div><div class="database-connection-title-row"><strong>数据库连接</strong>${statusHtml}</div>${jdbcHtml}${configHtml}</div><button class="button secondary" type="button" data-database-open>管理数据库连接</button></div></section>`;
  const dialog = `<dialog class="database-connection-drawer" data-database-dialog aria-labelledby="database-connection-title" data-scroll-region="dialog"><div class="database-connection-drawer-shell"><header class="database-connection-drawer-header"><div><span class="eyebrow">系统治理</span><h2 id="database-connection-title">管理数据库连接</h2></div><button class="icon-button" type="button" data-database-close aria-label="关闭数据库连接配置" title="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header><div class="database-connection-drawer-content" data-scroll-region="panel"><section class="database-runtime-card" aria-label="当前运行连接"><div class="database-runtime-heading"><div><span>当前运行连接</span><strong>${escapeHtml(healthText)}</strong></div><span class="status-badge ${statusClass}">${healthy ? '正常' : escapeHtml(healthText)}</span></div><code>${escapeHtml(runtime.jdbcUrl || '尚无运行连接')}</code>${runtime.username ? `<small>用户：${escapeHtml(runtime.username)}</small>` : ''}${unavailable ? `<p class="database-runtime-error">${escapeHtml(projection.healthError?.message || projection.error || '数据库连接状态暂不可用')}</p>` : ''}</section>${connectionNote}<section class="database-connection-form" aria-labelledby="database-config-title"><div class="database-config-heading"><h3 id="database-config-title">页面连接配置</h3><p>验证通过后保存，密码不会回显。</p></div><label>JDBC 连接串<input class="database-jdbc-input" name="jdbcUrl" value="${escapeHtml(current.jdbcUrl || '')}" placeholder="jdbc:yasdb://db.example.internal:1688/yashandb" data-database-field="jdbcUrl" spellcheck="false"><small>已包含数据库地址、端口和数据库名。连接串使用等宽字体，便于核对地址、端口和连接参数。示例：jdbc:yasdb://db.example.internal:1688/yashandb</small></label><div class="database-credential-grid"><label>用户名<input name="username" value="${escapeHtml(current.username || '')}" data-database-field="username" autocomplete="username"></label><label>密码<input type="password" name="password" value="" autocomplete="new-password" placeholder="${conn.passwordConfigured ? '留空表示保留当前密码' : '请输入数据库密码'}" data-database-field="password"><small>留空表示保留当前密码。</small></label></div><details class="database-connection-advanced" data-database-advanced ${advancedOpen ? 'open' : ''}><summary>高级设置</summary><div><label>连接名称<input name="name" value="${escapeHtml(current.name || '知识中心主数据库')}" data-database-field="name"></label><label>连接超时<select name="timeoutMs" data-database-field="timeoutMs">${timeoutOptions}</select></label></div></details></section></div><footer class="database-connection-drawer-footer"><div class="database-connection-feedback form-status ${status?.kind || ''}" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(status?.message || '')}</div><div class="database-connection-actions"><button class="button tertiary" type="button" data-database-close ${busy ? 'disabled' : ''}>取消</button><button class="button secondary" type="button" data-database-test ${busy ? 'disabled' : ''}>${busy ? '处理中…' : '仅测试连接'}</button><button class="button primary" type="button" data-database-save ${busy ? 'disabled' : ''}>验证并保存</button></div></footer></div></dialog>`;
  return `${drawerOnly ? '' : card}${drawerOpen ? dialog : ''}`;
}

function renderGovernanceTab(governanceProjection = {}, projection = {}, databaseProjection = {}, databaseDrawerOpen = false, databaseForm = null, databaseStatus = null, databaseAdvancedOpen = false) {
  const gov = governanceProjection || {};
  const services = Array.isArray(gov.services) ? gov.services : [];
  const pendingItems = Array.isArray(gov.pendingItems) ? gov.pendingItems : [];
  const recentOps = Array.isArray(gov.recentOperations) ? gov.recentOperations : [];
  const db = databaseProjection || {};
  const dbHealth = db.healthStatus === 'healthy' ? 'ok' : db.healthStatus === 'unavailable' ? 'error' : 'unknown';
  const externalStatus = gov.externalConnectionStatus === 'warning' ? 'warning' : gov.externalConnectionStatus === 'ok' ? 'ok' : 'unknown';
  const issueCount = services.filter(service => service.status === 'warning').length + Number(dbHealth === 'error') + Number(externalStatus === 'warning');
  const unknownCount = services.filter(service => service.status === 'unknown').length + Number(services.length === 0) + Number(dbHealth === 'unknown') + Number(externalStatus === 'unknown');
  const conclusion = issueCount ? `当前有 ${issueCount} 项需关注` : unknownCount ? '部分状态待确认' : pendingItems.length ? `有 ${pendingItems.length} 项待处理事项` : '当前运行状态正常';
  const conclusionDetail = issueCount
    ? [services.some(service => service.status === 'warning') && '服务告警', dbHealth === 'error' && '数据库连接不可用', externalStatus === 'warning' && '外部连接需检查'].filter(Boolean).join('、')
    : unknownCount ? `${unknownCount} 项状态尚未确认` : pendingItems.length ? '请查看下方待处理事项' : '各项服务和连接状态已读取';
  const state = (kind, label) => `<span class="governance-state ${kind}">${label}</span>`;
  const rows = services.map(service => `<tr><td><span class="governance-service"><i data-lucide="${service.name === '资料加工服务' ? 'filter' : 'file-text'}" aria-hidden="true"></i>${escapeHtml(service.name)}</span></td><td>${state(service.status === 'ok' ? 'ok' : service.status === 'warning' ? 'warning' : 'unknown', service.status === 'ok' ? '正常' : service.status === 'warning' ? '告警' : '待确认')}</td><td class="governance-detail ${service.status === 'ok' ? 'is-empty' : ''}">${service.status === 'ok' ? '—' : service.status === 'warning' ? '请检查对应服务' : '服务状态暂不可用'}</td><td></td></tr>`).join('');
  const dbRuntime = db.effectiveConnection || db.connection || {};
  const dbDetail = dbHealth === 'error' ? db.healthError?.message || '连接状态读取失败' : db.restartRequired ? '页面配置待重启生效' : dbHealth === 'unknown' ? '运行状态待确认' : '—';
  const dbRow = `<tr><td><span class="governance-service"><i data-lucide="database" aria-hidden="true"></i>数据库连接</span></td><td>${state(dbHealth, dbHealth === 'ok' ? '正常' : dbHealth === 'error' ? '不可用' : '待确认')}</td><td class="governance-detail ${dbDetail === '—' ? 'is-empty' : ''}">${escapeHtml(dbDetail)}${dbHealth === 'error' && dbRuntime.jdbcUrl ? ` · ${escapeHtml(dbRuntime.jdbcUrl)}` : ''}</td><td><button type="button" class="governance-row-action" data-database-open>管理连接<i data-lucide="arrow-up-right" aria-hidden="true"></i></button></td></tr>`;
  const externalRow = `<tr><td><span class="governance-service"><i data-lucide="git-branch" aria-hidden="true"></i>GitLab 外部连接</span></td><td>${state(externalStatus, externalStatus === 'ok' ? '已验证' : externalStatus === 'warning' ? '需关注' : '待确认')}</td><td class="governance-detail">${escapeHtml(gov.externalConnectionSummary || '连接状态待加载')}</td><td><a class="governance-row-action" href="/knowledge-center/platform?tab=gitlab">查看连接<i data-lucide="arrow-up-right" aria-hidden="true"></i></a></td></tr>`;
  const healthHtml = `<section class="governance-runtime" aria-labelledby="governance-runtime-title"><header class="governance-section-head"><h3 id="governance-runtime-title">运行状态</h3><span>${services.length + 2} 项检查</span></header><div class="governance-table-wrap"><table class="governance-status-table"><thead><tr><th>对象</th><th>状态</th><th>当前信息</th><th>操作</th></tr></thead><tbody>${rows}${dbRow}${externalRow}</tbody></table></div></section>`;
  const pendingHtml = `<section class="governance-action-panel" aria-labelledby="governance-pending-title"><header class="governance-section-head"><h3 id="governance-pending-title">待处理事项</h3><span>${pendingItems.length} 项</span></header>${pendingItems.length ? `<div class="governance-pending-list">${pendingItems.map(item => `<div class="governance-pending-item"><span class="governance-pending-level">需要处理</span><div><strong>${escapeHtml(item.title || item.name || '待处理')}</strong>${item.description ? `<span class="governance-pending-description">${escapeHtml(item.description)}</span>` : ''}</div>${item.actionUrl ? `<a href="${escapeHtml(item.actionUrl)}">查看处理<i data-lucide="arrow-up-right" aria-hidden="true"></i></a>` : ''}</div>`).join('')}</div>` : '<div class="governance-pending-empty"><i data-lucide="circle-check" aria-hidden="true"></i><span>暂无待处理事项</span></div>'}</section>`;

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

  return `<div role="tabpanel" id="platform-panel-governance" aria-labelledby="platform-tab-governance"><h2 class="governance-page-title">运行概览</h2><div class="governance-conclusion ${issueCount || pendingItems.length ? 'has-issues' : unknownCount ? 'is-unknown' : 'is-healthy'}" role="status"><i data-lucide="${issueCount || pendingItems.length ? 'triangle-alert' : unknownCount ? 'circle-help' : 'circle-check'}" aria-hidden="true"></i><div><strong>${conclusion}</strong><span>${escapeHtml(conclusionDetail)}</span></div><div class="governance-conclusion-count"><b>${pendingItems.length}</b><span>待处理事项</span></div></div>${pendingHtml}${healthHtml}${recentOpsHtml}${renderDatabaseConnection(databaseProjection, databaseDrawerOpen, databaseForm, databaseStatus, databaseAdvancedOpen, true)}</div>`;
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
  return `<div role="tabpanel" id="platform-panel-principals" aria-labelledby="platform-tab-principals" class="team-group-page"><header class="principal-page-header"><div><h2>团队小组</h2></div><button class="button primary" type="button" data-team-group-create>添加团队小组</button></header><div class="team-group-workspace"><aside class="team-group-list"><div class="team-group-list-heading"><strong>团队小组</strong><span>${groups.length} 个</span></div><div class="team-group-list-scroll" data-scroll-region="panel">${groups.map(group => `<button type="button" class="team-group-list-item ${String(group.teamGroupId) === String(selected?.teamGroupId) ? 'is-selected' : ''}" data-team-group-view="groups" data-team-group-id="${escapeHtml(group.teamGroupId)}"><span><strong>${escapeHtml(group.groupName || '-')}</strong></span><small>${group.leader ? `${escapeHtml(group.leader.displayName)} · ${Number(group.members?.length || 0)} 名成员` : '未设置负责人'}</small></button>`).join('') || '<div class="team-group-list-empty">暂无团队小组</div>'}</div></aside><section class="team-group-detail">${selected ? `<form data-team-group-form data-team-group-id="${escapeHtml(selected.teamGroupId)}" data-team-group-version="${Number(selected.rowVersion || 1)}" data-current-leader-id="${escapeHtml(leaderId)}"><header class="team-group-detail-header"><h3>${escapeHtml(selected.groupName)}</h3>${selected.techDomainName ? `<p>关联领域：${escapeHtml(selected.techDomainName)}</p>` : ''}</header><div class="team-group-field"><label for="team-group-leader">负责人</label><select id="team-group-leader" name="leaderPrincipalId" required><option value="">请选择人员</option>${people.map(person => `<option value="${escapeHtml(person.principalId)}" ${String(person.principalId) === leaderId ? 'selected' : ''}>${escapeHtml(person.displayName)}</option>`).join('')}</select></div><fieldset class="team-group-member-field"><legend>团队成员</legend><div class="team-member-add"><select data-team-member-candidate aria-label="选择要添加的团队成员"><option value="">请选择人员</option>${people.filter(person => String(person.principalId) !== leaderId && !memberIds.has(String(person.principalId))).map(person => `<option value="${escapeHtml(person.principalId)}" data-display-name="${escapeHtml(person.displayName)}">${escapeHtml(person.displayName)}</option>`).join('')}</select><button class="button secondary" type="button" data-team-member-add>添加成员</button></div><div class="team-member-chips" data-team-member-chips>${memberChips || '<span class="team-member-empty" data-team-member-empty>暂无其他团队成员</span>'}</div></fieldset><p class="team-group-status ${savedStatus?.kind || ''}" data-team-group-status role="status" aria-live="polite">${escapeHtml(savedStatus?.message || '')}</p><footer class="team-group-actions" data-scroll-obstacle><button class="button primary" type="button" data-team-group-save>保存</button><button class="button tertiary" type="button" data-team-group-cancel>取消</button></footer></form>` : '<div class="empty-state"><strong>暂无团队小组</strong></div>'}</section></div><dialog class="principal-dialog" data-team-group-create-dialog aria-labelledby="team-group-create-title" data-scroll-region="dialog"><form data-team-group-create-form><header><h2 id="team-group-create-title">新建团队小组</h2><button class="icon-button" type="button" data-team-group-create-close aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header><label><span>小组名称 *</span><input name="groupName" required maxlength="255" autocomplete="off"></label><p class="team-group-status" data-team-group-create-status role="status" aria-live="polite"></p><footer><button class="button primary" type="submit">新建</button><button class="button tertiary" type="button" data-team-group-create-close>取消</button></footer></form></dialog></div>`;
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
    <dialog class="principal-dialog" data-principal-editor-dialog data-scroll-region="dialog">
      <form method="dialog" data-principal-editor-form>
        <header><div><h2 data-principal-dialog-title>新增人员</h2><p>人员可在手册和大纲中被选为责任人。</p></div><button class="icon-button" type="button" data-principal-dialog-close aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header>
        <input type="hidden" name="principalId"><input type="hidden" name="rowVersion">
        <label><span>姓名 *</span><input name="displayName" required maxlength="128" autocomplete="off"></label>
        <label><span>CAS 登录名</span><input name="casLoginName" maxlength="128" autocomplete="off" aria-describedby="principal-login-help principal-login-error"><small id="principal-login-help" data-principal-login-help>可留空，首次登录时自动绑定。</small><small id="principal-login-error" class="principal-field-error" data-principal-login-error role="alert"></small></label>
        <fieldset><legend>使用状态</legend><label><input type="radio" name="state" value="ACTIVE" checked> 启用</label><label><input type="radio" name="state" value="INACTIVE"> 停用</label></fieldset>
        <footer><span data-principal-form-status role="status"></span><button class="button tertiary" type="button" data-principal-dialog-close>取消</button><button class="button primary" type="submit">确认新增</button></footer>
      </form>
    </dialog>
    <dialog class="principal-dialog principal-cas-correction-dialog" data-principal-cas-correction-dialog aria-labelledby="principal-cas-correction-title" data-scroll-region="dialog">
      <form data-principal-cas-correction-form>
        <header><div><h2 id="principal-cas-correction-title">确认更正 CAS 登录名</h2><p>这会改变该人员后续统一认证使用的账号。</p></div><button class="icon-button" type="button" data-principal-correction-cancel aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header>
        <div class="principal-correction-summary">
          <p><span>人员</span><strong data-principal-correction-name></strong></p>
          <p><span>原登录名</span><code data-principal-correction-before></code></p>
          <p><span>新登录名</span><code data-principal-correction-after></code></p>
        </div>
        <p class="principal-correction-warning">更正后，原 CAS 登录名将无法再匹配此人员。请确认新账号属于本人。</p>
        <footer><span data-principal-correction-status role="status"></span><button class="button tertiary" type="button" data-principal-correction-cancel>取消</button><button class="button danger" type="submit">确认更正</button></footer>
      </form>
    </dialog>
    <dialog class="principal-dialog principal-import-dialog" data-principal-import-dialog data-scroll-region="dialog">
      <form data-principal-import-form>
        <header><div><h2>Excel 批量导入</h2><p>先预检变更和冲突，确认后才写入数据库。</p></div><button class="icon-button" type="button" data-principal-dialog-close aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header>
        <div class="principal-import-guide"><a class="button tertiary" href="/knowledge-center/api/platform/principals/template" download="知识中心人员导入模板.xlsx">下载 Excel 模板</a><span>表头：姓名、CAS登录名、状态；单次最多 1000 人。</span></div>
        <label><span>选择 Excel 文件</span><input name="file" type="file" accept=".xlsx" required></label>
        <div class="principal-import-preview" data-principal-import-preview hidden data-scroll-region="panel"></div>
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
  const saveError = saveStatus?.error || (saveStatus === 'error' ? '保存失败，请重试' : '');
  const editable = selectedUser && selectedUser.rolesEditable !== false && selectedUser.identitySource === 'cas';
  const statusText = saveStatus === 'saving' ? '正在保存…' : saveStatus === 'saved' ? '权限已保存' : saveError;
  const statusClass = saveStatus === 'saved' ? 'permission-status-saved' : saveError ? 'permission-status-error' : '';

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
            <form class="permission-role-form" data-permission-role-form data-permission-user-id="${escapeHtml(selectedUser.id)}">
              <p class="muted" style="margin:0 0 var(--space-4);font-size:13px">${editable ? '为该用户分配角色，保存后立即生效。' : '本地账号角色不在此页面维护。'}</p>
              <div class="permission-role-grid">
                ${roles.map(role => `<label class="permission-role-label">
                  <input type="checkbox" name="roles" value="${escapeHtml(role.id)}" ${currentRoles.has(String(role.id)) ? 'checked' : ''} ${!editable || saveStatus === 'saving' ? 'disabled' : ''}>
                  ${escapeHtml(role.name || role.id)}
                </label>`).join('')}
              </div>
              <div class="permission-role-footer">
                <span class="permission-save-status ${statusClass}" role="${saveError ? 'alert' : 'status'}" aria-live="polite">${escapeHtml(statusText)}</span>
                <button class="button primary" type="submit" ${!editable || saveStatus === 'saving' ? 'disabled' : ''}>保存权限</button>
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
  if (listState.mappingView) return renderVersionMappingTab(gitlabProjection, platformAdmin, listState);
  const search = listState.search || '';
  const pageSize = listState.pageSize || 20;
  const isDisabled = c => c.status === 'inactive' || c.managementStatus === 'disabled';
  const verificationStatus = c => transientVerification?.connectionId === c.id
    ? transientVerification.status : (c.verificationStatus || c.lastVerification?.status || (c.verified ? 'verified' : 'pending'));
  const filtered = connections.filter(c => {
    const term = search.trim().toLowerCase();
    return (!term || [c.name, c.projectPath, c.project].some(value => String(value || '').toLowerCase().includes(term)))
      && (!listState.status || (isDisabled(c) ? 'disabled' : 'active') === listState.status)
      && (!listState.verificationStatus || verificationStatus(c) === listState.verificationStatus);
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number(listState.page) || 1));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selected = listState.drawerOpen ? connections.find(c => c.id === listState.selectedConnectionId) : null;
  const rows = paged.map(c => {
    const status = verificationStatus(c);
    const disabled = isDisabled(c);
    const name = escapeHtml(c.name || c.projectPath || c.project || '未命名');
    const verification = verificationFor(c, transientVerification);
    const verifiedAt = formatVerificationTime(verification?.verifiedAt);
    return `<tr data-gitlab-row="${escapeHtml(c.id)}">
      <td data-label="连接名称"><strong>${name}</strong></td>
      <td data-label="项目路径" class="gitlab-connection-path">${escapeHtml(c.projectPath || c.project || '-')}</td>
      <td data-label="认证方式">${c.authMode === 'user_oauth' ? '个人授权' : c.authMode === 'service_account' ? '平台凭证' : escapeHtml(c.authMode || '-')}</td>
      <td data-label="配置访问能力">${c.purpose === 'read_write' ? '读写' : '只读'}</td>
      <td data-label="平台最近读取验证"><div class="gitlab-verification-summary"><span class="conn-status ${escapeHtml(status)}">${escapeHtml(CONNECTION_STATUS_LABELS[status] || '待验证')}</span>${verifiedAt ? `<time datetime="${escapeHtml(verification.verifiedAt)}">${escapeHtml(verifiedAt)}</time>` : '<span class="gitlab-verification-time">—</span>'}</div></td>
      <td data-label="关联手册">${c.linkedHandbookCount == null ? '-' : escapeHtml(String(c.linkedHandbookCount))}</td>
      <td data-label="启停状态"><span class="gitlab-state ${disabled ? 'disabled' : 'active'}">${disabled ? '已停用' : '已启用'}</span></td>
      <td data-label="操作"><button class="icon-button gitlab-row-action" type="button" data-gitlab-connection="${escapeHtml(c.id)}" aria-label="查看 ${name} 详情" title="查看详情"><i data-lucide="panel-right-open" aria-hidden="true"></i></button></td>
    </tr>`;
  }).join('');
  const listHtml = `<div class="gitlab-connection-workspace">
    <div class="gitlab-connection-toolbar">
      <div class="gitlab-list-search"><i data-lucide="search" class="search-icon" aria-hidden="true"></i><input type="search" placeholder="搜索连接或项目路径" value="${escapeHtml(search)}" data-gitlab-list-search aria-label="搜索 GitLab 连接"></div>
      <select data-gitlab-status-filter aria-label="按启停状态筛选"><option value="">全部状态</option><option value="active" ${listState.status === 'active' ? 'selected' : ''}>已启用</option><option value="disabled" ${listState.status === 'disabled' ? 'selected' : ''}>已停用</option></select>
      <select data-gitlab-verification-filter aria-label="按读取验证筛选"><option value="">全部验证</option><option value="verified" ${listState.verificationStatus === 'verified' ? 'selected' : ''}>通过</option><option value="failed" ${listState.verificationStatus === 'failed' ? 'selected' : ''}>失败</option><option value="pending" ${listState.verificationStatus === 'pending' ? 'selected' : ''}>待验证</option></select>
      ${platformAdmin ? '<button class="button primary gitlab-add-connection" type="button" data-gitlab-add-connection><i data-lucide="plus" aria-hidden="true"></i><span>添加仓库连接</span></button>' : ''}
    </div>
    <div class="gitlab-connection-table-wrap"><table class="gitlab-connection-table"><thead><tr><th>连接名称</th><th>项目路径</th><th>认证方式</th><th>配置访问能力</th><th>平台最近读取验证</th><th>关联手册</th><th>启停状态</th><th>操作</th></tr></thead><tbody>${rows || `<tr><td colspan="8" class="gitlab-connection-empty" role="status">${gitlabProjection.connectionLoadStatus === 'loading' ? '正在加载连接…' : gitlabProjection.connectionLoadStatus === 'error' ? escapeHtml(gitlabProjection.adminError || '连接读取失败，请重试。') : connections.length ? '无匹配连接' : '暂无 GitLab 连接'}</td></tr>`}</tbody></table></div>
    <div class="gitlab-connection-footer"><span>共 ${total} 条连接</span>${total > pageSize ? `<div class="gitlab-list-pagination">
      <button data-gitlab-page="prev" ${page <= 1 ? 'disabled' : ''}>上一页</button>
      <span>第 ${page} / ${totalPages} 页</span>
      <button data-gitlab-page="next" ${page >= totalPages ? 'disabled' : ''}>下一页</button>
    </div>` : ''}</div>
  </div>`;
  const detailHtml = selected ? `<div class="gitlab-connection-backdrop" data-gitlab-drawer-close></div><aside class="gitlab-detail-panel gitlab-connection-drawer" id="gitlab-detail-container" role="dialog" aria-modal="true" aria-label="${escapeHtml(selected.name || '仓库连接')}详情"><button class="icon-button gitlab-drawer-close" type="button" data-gitlab-drawer-close aria-label="关闭详情" title="关闭详情"><i data-lucide="x" aria-hidden="true"></i></button>${renderGitLabDetail(selected, platformAdmin, transientVerification, gitlabProjection.oauthStatus, gitlabProjection.oauthConfig)}</aside>` : '';

  return `<div role="tabpanel" id="platform-panel-gitlab" aria-labelledby="platform-tab-gitlab">
    <nav class="gitlab-workspace-tabs" aria-label="GitLab 管理视图"><button class="active" type="button" data-gitlab-view="connections" aria-current="page">仓库连接</button><button type="button" data-gitlab-view="mappings">版本映射</button></nav>
    ${listHtml}${detailHtml}
  </div>`;
}

function renderVersionMappingTab(projection, platformAdmin, state) {
  const connections = projection.connections || [];
  const rules = projection.versionMappings || [];
  const archived = projection.archivedVersionMappings || [];
  const items = rules;
  const q = (state.mappingSearch || '').trim().toLowerCase();
  const filtered = items.filter(item => (!state.mappingStatus || item.state === state.mappingStatus) && (!q || [item.productCode, item.version, item.branch,
    connections.find(connection => connection.id === item.connectionId)?.name].some(value => String(value || '').toLowerCase().includes(q))));
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pageCount, Math.max(1, Number(state.mappingPage) || 1));
  const edit = rules.find(item => String(item.id) === String(state.mappingEditId));
  const candidate = state.mappingCandidateIndex == null ? null : VERSION_MAPPING_CANDIDATES[state.mappingCandidateIndex];
  const form = state.mappingEditing ? `<form class="gitlab-version-form" data-version-mapping-form>
    <div class="gitlab-version-form-head"><h4>${edit ? '修改版本映射' : '新增版本映射'}</h4><button class="icon-button" type="button" data-version-mapping-cancel aria-label="关闭编辑"><i data-lucide="x" aria-hidden="true"></i></button></div>
    ${edit ? '' : `<label class="gitlab-version-preset">参考候选<select data-version-mapping-preset aria-label="选择参考候选"><option value="">自定义映射</option>${VERSION_MAPPING_CANDIDATES.map((item, index) => `<option value="${index}" data-product="${escapeHtml(item.productCode)}" data-kind="${item.matchKind}" data-version="${escapeHtml(item.version)}" data-branch="${escapeHtml(item.branch)}" ${state.mappingCandidateIndex === index ? 'selected' : ''}>${escapeHtml(item.productCode)} / ${escapeHtml(item.matchKind === 'ALL' ? '所有版本' : item.version)} → ${escapeHtml(item.branch)}</option>`).join('')}</select></label>`}
    ${edit?.state === 'active' ? '<p class="gitlab-version-note">保存后生成草案；当前启用规则持续生效，直到新草案验证并启用。</p>' : ''}
    <div class="gitlab-version-fields"><label>PingCode 产品代码<input name="productCode" required maxlength="64" value="${escapeHtml(edit?.productCode || candidate?.productCode || '')}" autocomplete="off"></label>
    <label>匹配方式<select name="matchKind" data-version-kind><option value="EXACT" ${(edit?.matchKind || candidate?.matchKind) !== 'ALL' ? 'selected' : ''}>精确版本</option><option value="ALL" ${(edit?.matchKind || candidate?.matchKind) === 'ALL' ? 'selected' : ''}>所有版本</option></select></label>
    <label data-version-field ${(edit?.matchKind || candidate?.matchKind) === 'ALL' ? 'hidden' : ''}>业务版本<input name="version" maxlength="128" value="${escapeHtml(edit?.version || candidate?.version || '')}" ${(edit?.matchKind || candidate?.matchKind) === 'ALL' ? '' : 'required'}></label>
    <label>GitLab 仓库连接<select name="connectionId" required data-version-connection><option value="">选择仓库</option>${connections.map(connection => `<option value="${escapeHtml(connection.id)}" ${connection.id === edit?.connectionId ? 'selected' : ''}>${escapeHtml(connection.name)}</option>`).join('')}</select></label>
    <label>目标分支<input name="branch" required maxlength="255" list="version-branch-options" value="${escapeHtml(edit?.branch || candidate?.branch || '')}" autocomplete="off"></label><datalist id="version-branch-options">${(projection.mappingBranches || []).map(branch => `<option value="${escapeHtml(branch.name)}"></option>`).join('')}</datalist></div>
    <div class="gitlab-version-form-actions"><button class="button secondary" type="button" data-version-mapping-cancel>取消</button><button class="button primary" type="submit">保存草案</button></div></form>` : '';
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize).map(item => {
    const connection = connections.find(value => value.id === item.connectionId);
    const stateLabel = { active: '已启用', draft: '草案', disabled: '已停用', superseded: '历史修订' }[item.state] || item.state;
    const action = platformAdmin && item.state !== 'superseded' ? `<button type="button" class="icon-button" data-version-mapping-edit="${item.id}" title="编辑映射" aria-label="编辑 ${escapeHtml(item.productCode)} 映射"><i data-lucide="pencil" aria-hidden="true"></i></button>${item.state === 'active' ? `<button type="button" class="icon-button" data-version-mapping-action="disable" data-version-mapping-id="${item.id}" title="停用映射" aria-label="停用 ${escapeHtml(item.productCode)} 映射"><i data-lucide="power-off" aria-hidden="true"></i></button>` : `<button type="button" class="icon-button" data-version-mapping-action="activate" data-version-mapping-id="${item.id}" title="验证并启用" aria-label="验证并启用 ${escapeHtml(item.productCode)} 映射"><i data-lucide="badge-check" aria-hidden="true"></i></button>`}${item.state === 'draft' ? `<button type="button" class="icon-button gitlab-version-delete" data-version-mapping-delete-open="${item.id}" title="删除草案" aria-label="删除 ${escapeHtml(item.productCode)} ${escapeHtml(item.matchKind === 'ALL' ? '所有版本' : item.version)} 草案"><i data-lucide="trash-2" aria-hidden="true"></i></button>` : ''}${item.state === 'disabled' ? `<button type="button" class="icon-button" data-version-mapping-action="archive" data-version-mapping-id="${item.id}" title="归档映射" aria-label="归档 ${escapeHtml(item.productCode)} 映射"><i data-lucide="archive" aria-hidden="true"></i></button>` : ''}` : '';
    return `<tr><td data-label="产品"><strong>${escapeHtml(item.productCode)}</strong></td><td data-label="PingCode 版本">${item.matchKind === 'ALL' ? '所有版本' : escapeHtml(item.version)}</td><td data-label="GitLab 仓库">${escapeHtml(item.state === 'pending' ? '未关联' : connection?.name || '连接已失效')}</td><td data-label="目标分支"><code>${escapeHtml(item.branch)}</code></td><td data-label="状态"><span class="gitlab-version-state ${escapeHtml(item.state)}">${stateLabel}</span></td><td data-label="操作"><div class="gitlab-version-actions">${action}</div></td></tr>`;
  }).join('');
  return `<div role="tabpanel" id="platform-panel-gitlab" aria-labelledby="platform-tab-gitlab">
    <nav class="gitlab-workspace-tabs" aria-label="GitLab 管理视图"><button type="button" data-gitlab-view="connections">仓库连接</button><button class="active" type="button" data-gitlab-view="mappings" aria-current="page">版本映射</button></nav>
    <section class="gitlab-version-workspace" aria-label="版本映射列表">
      <div class="gitlab-version-toolbar"><label><i data-lucide="search" aria-hidden="true"></i><input type="search" value="${escapeHtml(state.mappingSearch || '')}" data-version-mapping-search placeholder="搜索产品、版本、仓库或分支" aria-label="搜索版本映射"></label><select data-version-mapping-status aria-label="筛选映射状态"><option value="">全部状态</option>${[['active', '已启用'], ['draft', '草案'], ['disabled', '已停用'], ['superseded', '历史修订']].map(([value, label]) => `<option value="${value}" ${state.mappingStatus === value ? 'selected' : ''}>${label}</option>`).join('')}</select><span>${filtered.length} / ${items.length} 条映射</span>${platformAdmin ? '<button class="icon-button" type="button" data-version-mapping-add title="新增映射" aria-label="新增映射"><i data-lucide="plus" aria-hidden="true"></i></button>' : ''}</div>
      <p class="gitlab-version-feedback" role="status" aria-live="polite">${escapeHtml(state.mappingFeedback || projection.mappingError || '')}</p>${form}
      <div class="gitlab-version-table-wrap"><table class="gitlab-version-table"><thead><tr><th>产品</th><th>PingCode 版本</th><th>GitLab 仓库</th><th>目标分支</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows || `<tr><td colspan="6" class="gitlab-version-empty">${projection.mappingError ? '映射读取失败，请检查数据库迁移和服务状态。' : '暂无映射'}</td></tr>`}</tbody></table></div>
      <div class="gitlab-version-footer"><span>共 ${items.length} 条映射</span>${pageCount > 1 ? `<nav class="gitlab-version-pagination" aria-label="版本映射分页"><button class="button secondary" type="button" data-version-mapping-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>上一页</button><span>第 ${page} / ${pageCount} 页</span><button class="button secondary" type="button" data-version-mapping-page="${page + 1}" ${page === pageCount ? 'disabled' : ''}>下一页</button></nav>` : `<span>第 ${page} 页</span>`}</div>
      ${archived.length ? `<details class="gitlab-version-archive"><summary><i data-lucide="archive" aria-hidden="true"></i>已归档（${archived.length}）<i data-lucide="chevron-down" aria-hidden="true"></i></summary><div class="gitlab-version-archive-list">${archived.map(item => { const connection = connections.find(value => value.id === item.connectionId); return `<div class="gitlab-version-archive-row"><span><strong>${escapeHtml(item.productCode)}</strong> · ${escapeHtml(item.matchKind === 'ALL' ? '所有版本' : item.version)} · ${escapeHtml(connection?.name || '连接已失效')} / ${escapeHtml(item.branch)}</span>${platformAdmin ? `<button type="button" class="icon-button" data-version-mapping-action="restore" data-version-mapping-id="${item.id}" title="恢复为已停用" aria-label="恢复 ${escapeHtml(item.productCode)} 映射为已停用"><i data-lucide="rotate-ccw" aria-hidden="true"></i></button>` : ''}</div>`; }).join('')}</div></details>` : ''}
    </section>
    <dialog class="gitlab-version-delete-dialog" data-version-mapping-delete-dialog aria-labelledby="version-mapping-delete-title"><h4 id="version-mapping-delete-title">删除草案？</h4><p>删除后，这条草案将不再出现在版本映射列表中。</p><div class="gitlab-version-delete-target" data-version-mapping-delete-target></div><div class="gitlab-version-form-actions"><button class="button secondary" type="button" data-version-mapping-delete-cancel>取消</button><button class="button danger" type="button" data-version-mapping-action="delete">删除草案</button></div></dialog>
    </div>`;
}

function verificationFor(connection, transientVerification) {
  return transientVerification?.connectionId === connection.id ? transientVerification : connection.lastVerification;
}

function formatVerificationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function renderVerificationStatus(connection, transientVerification) {
  const verification = verificationFor(connection, transientVerification);
  if (!verification) return '<div class="gitlab-verification pending" role="status"><strong>尚未验证</strong><span>验证后将显示连接的读取结果、分支数量和验证时间。</span></div>';
  if (verification.status === 'verifying') return '<div class="gitlab-verification verifying" role="status" aria-live="polite" aria-busy="true"><strong>正在验证连接…</strong><span>正在检查项目访问和读取权限。</span></div>';
  if (verification.status === 'pending_auth') return `<div class="gitlab-verification pending" role="status"><strong>连接已保存，待完成 GitLab 授权</strong><span>${escapeHtml(verification.message || '请先完成平台 OAuth 配置。')}</span></div>`;
  const verifiedAt = verification.verifiedAt ? new Date(verification.verifiedAt).toLocaleString('zh-CN', { hour12: false }) : '-';
  if (verification.status === 'verified') {
    return `<div class="gitlab-verification success" role="status" aria-live="polite"><strong>读取验证成功</strong><span>${escapeHtml(verifiedAt)}</span></div>`;
  }
  return `<div class="gitlab-verification failure" role="alert"><strong>验证失败</strong><span>${escapeHtml(verification.error?.message || '连接暂时不可用，请重试。')} · ${escapeHtml(verifiedAt)}</span><span>修复建议：${escapeHtml(verification.error?.recovery || '检查连接配置和平台服务日志，修复后重新验证。')}</span></div>`;
}

function renderGitLabDetail(connection, platformAdmin, transientVerification, oauthStatus = {}, oauthConfig = {}) {
  const verification = verificationFor(connection, transientVerification);
  const isDisabled = connection.status === 'inactive' || connection.managementStatus === 'disabled';
  const fields = [
    { label: 'GitLab 地址', value: connection.baseUrl || connection.host || '-' },
    { label: '运行模式', value: connection.mode === 'production' ? '生产连接' : connection.mode === 'sandbox' ? '隔离验证' : '已禁用' },
    { label: '默认分支', value: connection.defaultBranch || '-' },
    { label: '认证方式', value: connection.authMode === 'user_oauth' ? '使用者本人授权' : connection.authMode === 'service_account' ? '平台预置服务凭证' : connection.authMode || '-' },
  ];
  const purposeLabel = connection.purpose === 'read_write' ? '读写' : '只读';
  const writeLabel = connection.purpose === 'read_write' ? '未验证' : '未配置';
  const oauthChecking = connection.authMode === 'user_oauth' && oauthStatus?.loading;
  const needsOAuth = connection.authMode === 'user_oauth' && !oauthStatus?.connected && !oauthChecking;
  const oauthHref = `/knowledge-center/api/gitlab/oauth/start?connectionId=${encodeURIComponent(connection.id)}&returnTo=${encodeURIComponent('/knowledge-center/platform?tab=gitlab')}`;

  return `<div class="gitlab-detail-header">
      <h3>${escapeHtml(connection.name || connection.project || '未命名连接')}</h3>
      <div class="gitlab-connection-path">${escapeHtml(connection.projectPath || connection.project || '-')}</div>
      <span class="gitlab-state ${isDisabled ? 'disabled' : 'active'}">${isDisabled ? '已停用' : '已启用'}</span>
    </div>
    <div class="gitlab-detail-body">
      <div class="gitlab-detail-fields">
        ${fields.map(f => `<div class="gitlab-detail-field">
          <label>${f.label}</label>
          <div class="field-value">${escapeHtml(f.value)}</div>
        </div>`).join('')}
      </div>
      <section class="gitlab-access" aria-labelledby="gitlab-access-title">
        <h4 id="gitlab-access-title">访问与授权</h4>
        <div><span>配置访问能力</span><strong>${escapeHtml(purposeLabel)}</strong></div>
        <div><span>写入验证</span><strong>${escapeHtml(writeLabel)}</strong></div>
        <div><span>${connection.authMode === 'user_oauth' ? '当前管理员授权' : '平台凭证'}</span><strong>${connection.authMode === 'user_oauth' ? (oauthChecking ? '检查中' : oauthStatus?.connected ? '已连接' : '尚未连接') : (connection.credentialConfigured ? '已配置' : '未配置')}</strong></div>
      </section>
      <h4 class="gitlab-verification-title">平台最近读取验证</h4>
      ${needsOAuth ? `<div class="gitlab-oauth-prompt" role="status"><strong>我的 GitLab 账号尚未连接</strong><span>重新验证前需连接当前管理员账号；平台最近验证结果保留，业务用户仍需各自授权。</span>${oauthConfig?.configured ? `<a class="button secondary" href="${escapeHtml(oauthHref)}">连接我的 GitLab 账号</a>` : '<span>GitLab OAuth 尚未配置，请先完成平台配置。</span>'}</div>` : ''}
      ${renderVerificationStatus(connection, transientVerification)}
      ${platformAdmin ? `<div class="gitlab-detail-actions">
        ${isDisabled
          ? `<button class="button secondary" type="button" data-gitlab-enable="${escapeHtml(connection.id)}"><i data-lucide="power" aria-hidden="true"></i>重新启用</button>`
          : `<button class="button secondary" type="button" data-gitlab-disable="${escapeHtml(connection.id)}"><i data-lucide="power-off" aria-hidden="true"></i>停用</button>`}
        <button class="button secondary" type="button" data-gitlab-verify="${escapeHtml(connection.id)}" ${isDisabled || needsOAuth || oauthChecking || verification?.status === 'verifying' ? 'disabled' : ''} ${needsOAuth ? 'title="请先用当前管理员的 GitLab 账号验证连接"' : ''}><i data-lucide="refresh-cw" aria-hidden="true"></i>${verification ? '重新验证' : '验证连接'}</button>
        <button class="button secondary" type="button" data-gitlab-edit="${escapeHtml(connection.id)}" ${isDisabled ? 'disabled' : ''}><i data-lucide="pencil" aria-hidden="true"></i>编辑连接</button>
      </div>` : ''}
    </div>`;
}

function renderGitLabEmpty(platformAdmin) {
  return `<div class="gitlab-detail-body">
    <div class="empty-state">
      <strong>暂无 GitLab 连接</strong>
      <span>${platformAdmin ? '点击上方"添加仓库连接"开始配置' : '请联系平台管理员配置 GitLab 连接'}</span>
    </div>
  </div>`;
}


/* ---- 编辑连接表单 ---- */
function renderGitLabEditForm(connection) {
  return `<div class="gitlab-add-form">
    <h3>编辑 GitLab 仓库连接</h3>
    <form class="platform-edit-form" data-gitlab-edit-form>
      <input type="hidden" name="id" value="${escapeHtml(connection.id)}">
      <div class="gitlab-form-steps">
        <div class="gitlab-form-step">
          <h4>基本信息</h4>
          <label>连接名称
            <input name="name" required value="${escapeHtml(connection.name || '')}">
          </label>
          <label>GitLab 地址
            <input name="baseUrl" type="url" required value="${escapeHtml(connection.baseUrl || connection.host || '')}">
            <small>填写 GitLab 站点地址；也可粘贴与项目路径一致的项目 URL</small>
          </label>
          <label>项目路径
            <input name="projectPath" required value="${escapeHtml(connection.projectPath || connection.project || '')}">
            <small>GitLab 项目的完整路径</small>
          </label>
          <label>默认分支
            <input name="defaultBranch" required value="${escapeHtml(connection.defaultBranch || '')}" placeholder="按仓库实际分支填写">
          </label>
          <label>访问能力
            <select name="purpose">
              <option value="read" ${connection.purpose !== 'read_write' ? 'selected' : ''}>只读</option>
              <option value="read_write" ${connection.purpose === 'read_write' ? 'selected' : ''}>读写</option>
            </select>
          </label>
          <label>使用哪种 GitLab 身份
            <select name="authMode" data-gitlab-auth-mode>
              <option value="user_oauth" ${connection.authMode !== 'service_account' ? 'selected' : ''}>使用者本人授权 GitLab 账号</option>
              <option value="service_account" ${connection.authMode === 'service_account' ? 'selected' : ''}>使用平台预置服务凭证</option>
            </select>
            <small>本人授权：每位使用者连接自己的账号；平台凭证：统一使用管理员预置的服务账号。验证连接仅检查读取权限。</small>
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
            <small>填写 GitLab 站点地址；也可粘贴与项目路径一致的项目 URL</small>
          </label>
          <label>项目路径
            <input name="projectPath" required placeholder="group/project">
            <small>GitLab 项目的完整路径，例如 cod-doc/yasdoc</small>
          </label>
          <label>默认分支
            <input name="defaultBranch" required placeholder="按仓库实际分支填写，例如 main">
            <small>请以仓库实际默认分支为准，平台不会猜测分支名</small>
          </label>
          <label>访问能力
            <select name="purpose">
              <option value="read">只读</option>
              <option value="read_write">读写</option>
            </select>
          </label>
        </div>
        <div class="gitlab-form-step">
          <h4><span class="step-number">2</span> 认证方式</h4>
          <label>使用哪种 GitLab 身份
            <select name="authMode" data-gitlab-auth-mode>
              <option value="user_oauth">使用者本人授权 GitLab 账号</option>
              <option value="service_account">使用平台预置服务凭证</option>
            </select>
            <small>本人授权：每位使用者连接自己的 GitLab 账号；平台凭证：统一使用管理员预置的服务账号。选择读写不代表已取得写入权限。</small>
          </label>
          <label data-gitlab-credential-field hidden>凭证引用名
            <input name="credentialRef" placeholder="例如：production_read">
            <small>对应后端环境变量 GITLAB_TOKEN_&lt;引用名&gt;，不要在页面填写 Token</small>
          </label>
        </div>
        <div class="gitlab-form-step">
          <h4><span class="step-number">3</span> 连接验证</h4>
          <p style="font-size:13px;color:var(--color-text-secondary);margin:0">保存后验证读取权限；本人授权模式需要先连接 GitLab 账号。写入权限不在此步验证。</p>
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
  const activeTab = platformTab === 'mcp' ? 'models' : platformTab || 'governance';

  let tabContent;
  switch (activeTab) {
    case 'principals':
      tabContent = renderPrincipalsTab(principalProjection || {}, principalListState || {}, teamGroupProjection, teamGroupView || 'people', teamGroupUi || {});
      break;
    case 'permissions':
      tabContent = renderPermissionsTab(permissionProjection, selectedPermissionUserId, permissionSaveStatus, permissionUserSearch || '', permissionListState || {});
      break;

    case 'models':
      tabContent = '<section role="tabpanel" id="platform-panel-models" aria-labelledby="platform-tab-models"><div class="mcp-admin" data-model-admin></div></section>';
      break;
    case 'mcp':
      tabContent = '<section role="tabpanel" id="platform-panel-mcp" aria-labelledby="platform-tab-mcp"><div class="mcp-admin" data-mcp-admin></div></section>';
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

  return `<div class="platform-admin-page ${activeTab === 'models' ? 'agent-tab-active' : ''}"><div class="page-intro">
    <h2>平台管理</h2>
    <span class="platform-header-meta">${projection?.asOf ? `更新于 ${new Date(projection.asOf).toLocaleString('zh-CN', { hour12: false })}` : ''}</span>
  </div>
  ${renderTabs(activeTab, teamGroupView || 'people')}
  ${tabContent}</div>`;
}
