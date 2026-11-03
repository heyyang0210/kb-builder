import { capabilityState, dataNote, formattedTime, panel, section } from '../../common/components/ui.js';
import { escapeHtml, icon } from '../../common/utils/dom.js';

function renderDashboardLegacy({ projection }) {
  const workbench = section(projection, 'workbench');
  const documents = section(projection, 'documents');
  const datasets = section(projection, 'datasets');
  const batches = section(projection, 'materialBatches');
  const counts = workbench?.counts || {};
  const hasTaskSummary = ['pending', 'review', 'publishable', 'failed'].every(name => counts[name] != null);
  const riskTone = Number(counts.failed) > 0 ? 'danger' : 'neutral';
  const riskSummary = counts.failed != null
    ? `<div class="risk-summary"><span class="risk-summary-icon">${icon(riskTone === 'danger' ? 'triangle-alert' : 'info')}</span><div><strong>${escapeHtml(counts.failed)} 个执行失败事项</strong><span>这是当前已接入的风险事实；其他风险类型仍等待手册风险投影。</span></div><button class="button secondary" data-action="production">查看并处理</button></div>`
    : capabilityState('风险信息暂不可用', '风险类型、影响范围、责任人和恢复动作将在风险投影可用后显示。', '查看生产任务', 'production');
  const taskSummary = hasTaskSummary
    ? `<section class="task-summary" aria-label="当前任务概况"><div class="task-summary-primary"><span class="summary-icon">${icon('inbox')}</span><div><span>需要处理</span><strong>${escapeHtml(counts.pending)}</strong><small>当前待处理任务</small></div></div><div class="task-summary-item"><span>待审核</span><strong>${escapeHtml(counts.review)}</strong><small>需要审核决定</small></div><div class="task-summary-item"><span>可发布</span><strong>${escapeHtml(counts.publishable)}</strong><small>已满足发布条件</small></div><div class="task-summary-item"><span>执行失败</span><strong>${escapeHtml(counts.failed)}</strong><small>需要检查或重试</small></div></section>`
    : capabilityState('任务数据暂不可用', '当前无法读取待处理、待审核和可发布事项。', '进入文档生产', 'production');
  const assets = [];
  if (documents?.total != null) assets.push(`<div class="asset-summary-item"><span class="asset-summary-label">${icon('file-text')}文档资产</span><strong>${escapeHtml(documents.total)}</strong>${documents.roots != null ? `<small>${escapeHtml(documents.roots)} 个资产目录</small>` : ''}</div>`);
  if (datasets?.total != null) assets.push(`<div class="asset-summary-item"><span class="asset-summary-label">${icon('database')}知识库版本</span><strong>${escapeHtml(datasets.total)}</strong><small>可追溯版本总数</small></div>`);
  if (batches?.total != null) assets.push(`<div class="asset-summary-item"><span class="asset-summary-label">${icon('layers-3')}资料批次</span><strong>${escapeHtml(batches.total)}</strong>${batches.active != null ? `<small>${escapeHtml(batches.active)} 个正在处理</small>` : ''}</div>`);
  return `<header class="dashboard-header"><div><span class="dashboard-kicker">负责人工作台</span><h2>知识中心总览</h2><p>优先查看风险、整体进度和可接续事项。暂不可用的内容会明确标注，不使用示例记录替代。</p></div></header><section class="panel dashboard-risk-panel" data-appearance-risk="${riskTone}"><div class="panel-heading"><h2>风险与阻塞</h2>${dataNote(projection)}</div>${riskSummary}</section><section class="dashboard-section dashboard-management-grid">${panel('生产完成度', capabilityState('生产完成度暂不可用', '服务端尚未返回本次范围、已完成节点和统计口径。', '查看知识资产', 'assets'), dataNote(projection))}${panel('手册完整度矩阵', capabilityState('四类完整度暂不可用', '结构、内容、责任和质量门禁将在同一统计时点返回后显示。', '查看知识资产', 'assets'), dataNote(projection))}</section>${panel('关键状态泳道', capabilityState('生产泳道暂不可用', '未开始、生产中、审核发布中和已完成将按一级章节聚合展示。', '查看生产任务', 'stages'), dataNote(projection))}${panel('最近活动', capabilityState('续办活动暂不可用', '对象、最后动作、当前状态和继续处理入口将在活动投影可用后显示。', '查看生产任务', 'production'), dataNote(projection))}<section class="dashboard-section"><div class="dashboard-section-heading"><h3>当前任务</h3><span>仅展示已接入的真实任务统计</span></div>${taskSummary}</section><section class="dashboard-section"><div class="dashboard-section-heading"><h3>资产概况</h3><span>更新于 ${formattedTime(projection)}</span></div>${assets.length ? `<div class="asset-summary">${assets.join('')}</div>` : capabilityState('资产数据暂不可用', '当前无法读取文档、知识库和资料批次统计。', '查看知识资产', 'assets')}</section>`;
}

export function renderDashboard(args) {
  const domainTasks = args.domainBuildTaskProjection;
  const tasks = Array.isArray(domainTasks?.tasks) ? domainTasks.tasks : [];
  const assignedCount = task => (task.items || []).filter(item => item.assigneeId || item.assigneeName).length;
  const statusText = status => ({
    pending: '待开始',
    assigned: '已分派',
    in_progress: '建设中',
    completed: '已完成',
    published: '已完成',
  }[status] || '待开始');
  const peopleForTask = task => {
    const people = [
      { id: task.domainLeaderId, name: task.domainLeaderName },
      ...(Array.isArray(task.domainMembers) ? task.domainMembers : []),
    ].filter(person => person?.id);
    return [...new Map(people.map(person => [String(person.id), person])).values()];
  };
  const assigneeOptions = (task, item) => [
    '<option value="">待分派</option>',
    ...peopleForTask(task).map(person => `<option value="${escapeHtml(person.id)}"${String(person.id) === String(item.assigneeId || '') ? ' selected' : ''}>${escapeHtml(person.name || person.id)}</option>`),
  ].join('');
  const taskSummary = task => {
    const total = Array.isArray(task.items) ? task.items.length : 0;
    const assigned = assignedCount(task);
    const pending = Math.max(total - assigned, 0);
    const taskId = String(task.id || '');
    const dialogId = `domain-task-dialog-${taskId.replace(/[^a-zA-Z0-9_-]/g, '-') || 'unknown'}`;
    return `<article class="domain-task-summary-card">
      <div class="domain-task-summary-heading">
        <div><span class="domain-task-eyebrow">技术领域</span><h4>${escapeHtml(task.techDomainName || task.techDomainId || '技术领域')}</h4></div>
        <span class="domain-task-summary-state">${pending ? '有待分派页面' : '已完成初始分派'}</span>
      </div>
      <dl class="domain-task-summary-metrics">
        <div><dt>领域负责人</dt><dd>${escapeHtml(task.domainLeaderName || '待配置负责人')}</dd></div>
        <div><dt>页面总数</dt><dd>${total}</dd></div>
        <div><dt>已分派</dt><dd>${assigned}</dd></div>
        <div><dt>待分派</dt><dd class="${pending ? 'is-pending' : ''}">${pending}</dd></div>
      </dl>
      <footer class="domain-task-summary-footer">
        <span>${pending ? '请进入领域明细继续细分责任人。' : '页面均已有当前责任人。'}</span>
        <button class="button tertiary compact" type="button" data-domain-task-open="${escapeHtml(taskId)}" aria-controls="${escapeHtml(dialogId)}">
          ${icon('list-tree')}查看页面任务
        </button>
      </footer>
    </article>`;
  };
  const taskDialog = task => {
    const total = Array.isArray(task.items) ? task.items.length : 0;
    const assigned = assignedCount(task);
    const pending = Math.max(total - assigned, 0);
    const taskId = String(task.id || '');
    const dialogId = `domain-task-dialog-${taskId.replace(/[^a-zA-Z0-9_-]/g, '-') || 'unknown'}`;
    return `<dialog class="domain-task-dialog" id="${escapeHtml(dialogId)}" data-domain-task-dialog="${escapeHtml(taskId)}" data-domain-task aria-labelledby="${escapeHtml(dialogId)}-title" data-scroll-region="dialog">
      <div class="domain-task-dialog-shell">
        <header class="domain-task-dialog-header">
          <div><span class="domain-task-eyebrow">领域建设任务</span><h2 id="${escapeHtml(dialogId)}-title">${escapeHtml(task.techDomainName || task.techDomainId || '技术领域')}</h2><p>负责人：${escapeHtml(task.domainLeaderName || '待配置负责人')} · ${total} 个页面</p></div>
          <button class="icon-button domain-task-dialog-close" type="button" data-domain-task-close aria-label="关闭领域任务明细" title="关闭"><i data-lucide="x" aria-hidden="true"></i></button>
        </header>
        <dl class="domain-task-dialog-metrics">
          <div><dt>页面总数</dt><dd>${total}</dd></div>
          <div><dt>已分派</dt><dd>${assigned}</dd></div>
          <div><dt>待分派</dt><dd class="${pending ? 'is-pending' : ''}">${pending}</dd></div>
        </dl>
        <div class="domain-task-dialog-content">
          ${total ? `<ul class="domain-task-dialog-list">${(task.items || []).map(item => `<li>
            <div class="domain-task-item-title"><strong>${escapeHtml(item.documentTitle || item.title || item.documentId || '未命名页面')}</strong><small>${escapeHtml(item.documentId || '')}</small></div>
            <span class="domain-task-item-state">${escapeHtml(statusText(item.status))}</span>
            <label class="domain-task-assignee"><span>页面责任人</span><select data-domain-task-assignee data-task-id="${escapeHtml(taskId)}" data-item-id="${escapeHtml(item.id)}">${assigneeOptions(task, item)}</select></label>
          </li>`).join('')}</ul>` : '<p class="muted">当前领域暂无页面建设任务。</p>'}
        </div>
        <footer class="domain-task-dialog-footer"><span class="domain-task-status" role="status"></span><button class="button tertiary" type="button" data-domain-task-close>关闭</button></footer>
      </div>
    </dialog>`;
  };
  const taskMarkup = domainTasks?.status === 'unavailable'
    ? '<section class="dashboard-section"><div class="dashboard-section-heading"><h3>领域建设任务</h3></div><p class="muted">领域建设任务暂不可用。</p></section>'
    : `<section class="dashboard-section domain-build-tasks"><div class="dashboard-section-heading"><h3>领域建设任务</h3><span>${tasks.length} 个技术领域任务</span></div>${tasks.length ? `<div class="domain-task-summary-grid">${tasks.map(taskSummary).join('')}</div>${tasks.filter(task => String(task.id) === String(args.openDomainTaskId || '')).map(taskDialog).join('')}` : '<p class="muted">发布大纲后，这里会显示技术领域建设任务。</p>'}</section>`;
  return `${renderDashboardLegacy(args).replace('<span class="dashboard-kicker">负责人工作台</span>', '').replace('<h2>知识中心总览</h2><p>优先查看风险、整体进度和可接续事项。暂不可用的内容会明确标注，不使用示例记录替代。</p>', '<h2>工作台</h2>')}${taskMarkup}`;
}
