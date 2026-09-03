import { dataNote, panel, pendingState, section } from '../../common/components/ui.js';
import { escapeHtml } from '../../common/utils/dom.js';

function renderCleaningLegacy({ projection }) {
  const batches = section(projection, 'materialBatches');
  const datasets = section(projection, 'datasets');
  const knowledge = section(projection, 'knowledgeIndex');
  const metrics = [];
  if (batches?.total != null) metrics.push(`<div class="metric"><span>资料批次</span><strong>${escapeHtml(batches.total)}</strong>${batches.active != null ? `<small>${escapeHtml(batches.active)} 个正在处理</small>` : ''}</div>`);
  if (datasets?.total != null) metrics.push(`<div class="metric"><span>知识库版本</span><strong>${escapeHtml(datasets.total)}</strong><small>可追溯版本总数</small></div>`);
  if (knowledge?.knowledgePoints != null) metrics.push(`<div class="metric"><span>知识点</span><strong>${escapeHtml(knowledge.knowledgePoints)}</strong><small>已识别知识点</small></div>`);
  return `<div class="page-intro"><div><p class="eyebrow">从原始资料到可用知识</p><h2>资料清洗</h2><p class="muted">查看资料批次、知识库版本和知识点处理情况。</p></div><a class="button secondary" href="/pingcode-materials/">进入资料清洗</a></div>${metrics.length ? `<div class="metric-grid">${metrics.join('')}</div>` : pendingState('资料摘要暂不可用', '当前无法读取资料批次、版本和知识点统计。')}${panel('处理进度', pendingState('处理任务暂不可用', '资料清洗任务的进度和异常将在数据可用后显示。'), dataNote(projection))}${panel('知识库版本', pendingState('版本明细暂不可用', '知识库版本列表将在数据可用后显示。'), dataNote(projection))}`;
}

export function renderCleaning(args) {
  return pendingState('资料清洗待建设', '资料清洗模块正在建设中，当前暂不提供批次、知识库版本和处理进度操作。');
  return renderCleaningLegacy(args).replace('<p class="eyebrow">从原始资料到可用知识</p>', '').replace('<p class="muted">查看资料批次、知识库版本和知识点处理情况。</p>', '');
}
