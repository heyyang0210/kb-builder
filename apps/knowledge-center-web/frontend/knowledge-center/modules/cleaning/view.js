import { dataNote, panel, pendingState } from '../../common/components/ui.js';
import { escapeHtml } from '../../common/utils/dom.js';

function listItems(value) { return Array.isArray(value) ? value : (Array.isArray(value?.items) ? value.items : []); }
function statusLabel(item) { return item?.status || item?.state || item?.phase || '未提供状态'; }
const pageHeading = '<div class="page-intro"><h2>资料清洗</h2></div>';
function uploadDialog(canWrite) {
  if (!canWrite) return '';
  return `<dialog class="asset-dialog cleaning-upload-dialog" data-cleaning-upload-dialog><form data-cleaning-upload-form><header class="asset-dialog-heading"><div><h2>上传资料</h2><p>上传后将创建资料批次，原始文件保留在资料加工服务。</p></div><button class="icon-button" type="button" data-cleaning-upload-close aria-label="关闭">×</button></header><label>批次名称<input name="name" required maxlength="120" placeholder="例如：安装手册 23.4.5"></label><label>选择文件<input name="file" type="file" required></label><p class="cleaning-upload-status" data-cleaning-upload-status role="status">单次上传一个文件。</p><footer><button class="button tertiary" type="button" data-cleaning-upload-close>取消</button><button class="button secondary" type="submit">开始上传</button></footer></form></dialog>`;
}

export function renderCleaning({ cleaningProjection, cleaningCanWrite = false }) {
  if (!cleaningProjection || cleaningProjection.status === 'loading') return `${pageHeading}${pendingState('正在读取资料加工数据', '正在从资料加工服务读取真实批次、任务和知识库版本。')}`;
  if (cleaningProjection.status === 'unavailable') return `${pageHeading}${pendingState('资料加工服务暂时不可用', cleaningProjection.error?.message || '请稍后重试；旧资料加工入口仍保留。')}`;
  const workbench = cleaningProjection.workbench || {};
  const batches = listItems(cleaningProjection.batches);
  const datasets = listItems(cleaningProjection.datasets);
  const indexStats = cleaningProjection.indexStats;
  const counts = workbench.counts || workbench;
  const metrics = [['资料批次', cleaningProjection.batches?.total ?? batches.length], ['知识库版本', cleaningProjection.datasets?.total ?? datasets.length], ['处理中任务', counts.active ?? counts.running ?? counts.processing ?? '未提供'], ['失败任务', counts.failed ?? '未提供']];
  const rows = (items) => items.slice(0, 10).map(item => `<tr><td>${escapeHtml(item.name || item.batchId || item.datasetId || item.id || '未命名')}</td><td>${escapeHtml(statusLabel(item))}</td><td>${escapeHtml(item.updatedAt || item.createdAt || '未提供')}</td></tr>`).join('');
  const table = (items, title) => { const body = rows(items); return body ? `<div class="table-wrap"><table><caption class="sr-only">${title}</caption><thead><tr><th>名称</th><th>状态</th><th>更新时间</th></tr></thead><tbody>${body}</tbody></table></div>` : pendingState(`暂无${title}`, '资料加工服务当前没有返回记录。'); };
  const indexBody = indexStats?.status === 'unavailable'
    ? pendingState('索引状态暂时不可用', indexStats.error?.message || '资料加工服务未返回索引统计。')
    : `<div class="metric-grid"><div class="metric"><span>索引条目</span><strong>${escapeHtml(indexStats?.total ?? indexStats?.count ?? indexStats?.entries ?? '未提供')}</strong></div><div class="metric"><span>图谱节点</span><strong>${escapeHtml(indexStats?.graphNodes ?? indexStats?.nodes ?? '未提供')}</strong></div><div class="metric"><span>图谱边</span><strong>${escapeHtml(indexStats?.graphEdges ?? indexStats?.edges ?? '未提供')}</strong></div></div><p class="muted">索引与图谱状态来自资料加工服务，不在统一入口重新计算。</p>`;
  return `${pageHeading}<section class="cleaning-workspace"><div class="metric-grid">${metrics.map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>${panel('资料批次', table(batches, '资料批次'), dataNote(cleaningProjection))}${panel('知识库版本', table(datasets, '知识库版本'), dataNote(cleaningProjection))}${panel('索引与图谱', indexBody, dataNote(cleaningProjection))}<p class="muted">上传、扫描、清洗、索引和发布由资料加工服务执行，统一入口展示真实状态。</p></section>${cleaningCanWrite ? '<div class="cleaning-upload-action"><button class="button primary" type="button" data-cleaning-upload-open>上传资料</button></div>' : ''}${uploadDialog(cleaningCanWrite)}`;
}
