import { dataNote, panel, pendingState } from '../../common/components/ui.js';
import { renderPageJump } from '../../common/page-jump.js';
import { escapeHtml } from '../../common/utils/dom.js';

function listItems(value) { return Array.isArray(value) ? value : (Array.isArray(value?.items) ? value.items : []); }
const STATUS_LABELS = {
  pending: '待处理', queued: '等待处理', uploaded: '已上传', scanning: '扫描中',
  preprocessing: '预处理中', processing: '处理中', running: '处理中', in_progress: '处理中',
  completed: '已完成', succeeded: '已完成', success: '已完成', failed: '处理失败',
  cancelled: '已取消', canceled: '已取消', published: '已发布', draft: '草稿',
  deprecated: '已停用', active: '可用',
};
function statusLabel(item) {
  const value = String(item?.status || item?.state || item?.phase || '').trim();
  if (!value) return '状态待确认';
  return STATUS_LABELS[value.toLowerCase()] || (/^[\u3400-\u9fff]/.test(value) ? value : '状态待确认');
}
function updatedText(value) {
  if (!value) return '未提供';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '日期待确认' : new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}
function stateText(value) {
  const key = String(value || '').toLowerCase();
  return STATUS_LABELS[key] || (value && /^[\u3400-\u9fff]/.test(String(value)) ? String(value) : '状态待确认');
}
function field(value) { return value === undefined || value === null || value === '' ? '未提供' : String(value); }
function internalRoute(value) {
  const route = String(value || '');
  return route.startsWith('/knowledge-center/') && !route.startsWith('//') ? route : '';
}
function backHref(detail) {
  const params = new URLSearchParams();
  if (Number(detail.batchPage) > 1) params.set('batchPage', String(detail.batchPage));
  if (Number(detail.datasetPage) > 1) params.set('datasetPage', String(detail.datasetPage));
  return `/knowledge-center/cleaning${params.size ? `?${params}` : ''}`;
}
function detailLink(kind, id, batchPage, datasetPage) {
  const params = new URLSearchParams({ [kind === 'batch' ? 'batchId' : 'datasetId']: id });
  params.set('batchPage', String(batchPage || 1));
  params.set('datasetPage', String(datasetPage || 1));
  return `/knowledge-center/cleaning?${params}`;
}
function sourceLabel(batch) {
  const source = batch.source || batch.sourceSelection || batch.source_selection || {};
  if (typeof source === 'string') return source;
  return source.displayName || source.display_name || source.type || source.sourceType || source.source_type || '未提供';
}
function itemLabel(item) { return item.name || item.fileName || item.file_name || item.path || item.id || '未命名'; }
function renderDetailLoading(detail) {
  const title = detail.type === 'batch' ? '正在读取资料批次' : '正在读取知识库版本';
  return `<section class="cleaning-detail-state" role="status" aria-busy="true"><p>${title}</p></section>`;
}
function renderDetailError(detail) {
  const noun = detail.type === 'batch' ? '资料批次' : '知识库版本';
  return `<section class="cleaning-unavailable cleaning-detail-error" role="alert"><a class="cleaning-back" href="${backHref(detail)}">返回资料清洗</a><h2>${noun}详情暂时不可用</h2><p>${escapeHtml(detail.error?.message || `${noun}可能已删除或当前不可读取。`)}</p><button class="button secondary" type="button" data-cleaning-detail-retry>重新读取</button></section>`;
}
function renderBatchDetail(detail) {
  const batch = detail.batch || {};
  const summary = detail.summary || {};
  const process = summary.processSummary || {};
  const quality = summary.qualitySummary || {};
  const material = summary.materialSummary || {};
  const activity = summary.latestActivity || {};
  const files = listItems(detail.files);
  const filesPage = Math.max(1, Number(detail.files?.page) || 1);
  const filesSize = Math.max(1, Number(detail.files?.pageSize) || 20);
  const filesTotal = Math.max(0, Number(detail.files?.total) || files.length);
  const pages = Math.max(1, Math.ceil(filesTotal / filesSize));
  const route = internalRoute(summary.recommendedAction?.route);
  const fileRows = files.map(file => `<tr><td>${escapeHtml(itemLabel(file))}</td><td>${escapeHtml(stateText(file.state || file.status))}</td><td>${escapeHtml(field(file.sizeBytes ?? file.size_bytes))}</td></tr>`).join('');
  const pageQuery = new URLSearchParams(location.search);
  const filePageLink = page => {
    const params = new URLSearchParams(pageQuery);
    params.set('filePage', String(page));
    return `/knowledge-center/cleaning?${params}`;
  };
  const previousPage = filesPage > 1 ? `<a class="button tertiary" data-cleaning-files-page="${filesPage - 1}" href="${filePageLink(filesPage - 1)}">上一页</a>` : '<span class="button tertiary is-disabled" aria-disabled="true">上一页</span>';
  const nextPage = filesPage < pages ? `<a class="button tertiary" data-cleaning-files-page="${filesPage + 1}" href="${filePageLink(filesPage + 1)}">下一页</a>` : '<span class="button tertiary is-disabled" aria-disabled="true">下一页</span>';
  const filePagination = pages > 1 ? `<nav class="cleaning-pagination" aria-label="批次文件分页"><span>第 ${filesPage} / ${pages} 页，共 ${filesTotal} 个文件</span>${previousPage}${nextPage}${renderPageJump(filesPage, pages, 'cleaning-files')}</nav>` : '';
  const recommended = route ? `<a class="button primary" href="${escapeHtml(route)}">${escapeHtml(summary.recommendedAction.label || '继续处理')}</a>` : '';
  const sourceSnapshot = batch.sourceSnapshot || batch.source_snapshot || {};
  const created = batch.createdAt || batch.created_at;
  const updated = batch.updatedAt || batch.updated_at;
  return `<section class="cleaning-detail" data-cleaning-detail><header class="cleaning-detail-header"><a class="cleaning-back" href="${backHref(detail)}">返回资料清洗</a><div><h2>${escapeHtml(batch.name || `资料批次 ${batch.id || detail.id}`)}</h2><p>${escapeHtml(stateText(process.state || batch.state || batch.status))} · ${escapeHtml(batch.id || detail.id)}</p></div>${recommended}</header><dl class="cleaning-detail-facts"><div><dt>来源</dt><dd>${escapeHtml(sourceLabel(batch))}</dd></div><div><dt>资料空间</dt><dd>${escapeHtml(batch.localSpaceName || batch.local_space_name)}</dd></div><div><dt>当前阶段</dt><dd>${escapeHtml(field(process.stage))}</dd></div><div><dt>进度</dt><dd>${process.percent === undefined || process.percent === null ? '未提供' : `${escapeHtml(process.percent)}%`}</dd></div><div><dt>创建时间</dt><dd>${escapeHtml(updatedText(created))}</dd></div><div><dt>更新时间</dt><dd>${escapeHtml(updatedText(updated))}</dd></div><div><dt>质量结果</dt><dd>${escapeHtml(stateText(quality.state))} · ${escapeHtml(field(quality.errors))} 个错误 · ${escapeHtml(field(quality.warnings))} 个提醒</dd></div><div><dt>资料概况</dt><dd>${escapeHtml(field(material.pages ?? sourceSnapshot.estimatedPages ?? sourceSnapshot.estimated_pages))} 页 · ${escapeHtml(field(material.attachments ?? sourceSnapshot.estimatedAttachments ?? sourceSnapshot.estimated_attachments))} 个附件 · ${escapeHtml(field(material.documents))} 个文档 · ${escapeHtml(field(material.chunks))} 个分块</dd></div></dl><section class="cleaning-detail-section"><h3>最近活动</h3><p>${escapeHtml(activity.message || '未提供')}</p>${activity.at ? `<time>${escapeHtml(updatedText(activity.at))}</time>` : ''}</section><section class="cleaning-detail-section"><h3>批次文件</h3>${fileRows ? `<div class="table-wrap"><table><caption class="sr-only">批次文件</caption><thead><tr><th scope="col">文件</th><th scope="col">状态</th><th scope="col">大小（字节）</th></tr></thead><tbody>${fileRows}</tbody></table></div>${filePagination}` : pendingState('暂无文件', '资料加工服务当前没有返回文件记录。')}</section></section>`;
}
function renderDatasetDetail(detail) {
  const dataset = detail.dataset || {};
  const batchId = dataset.batchId || dataset.batch_id;
  const params = new URLSearchParams({ batchId: batchId || '' });
  params.set('batchPage', String(detail.batchPage || 1));
  params.set('datasetPage', String(detail.datasetPage || 1));
  const batchHref = batchId ? `/knowledge-center/cleaning?${params}` : '';
  const graph = dataset.graphSummary || dataset.graph_summary || {};
  const metrics = dataset.qualityMetrics || dataset.quality_metrics || {};
  const metricEntries = Object.entries(metrics).map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
  const created = dataset.createdAt || dataset.created_at;
  const datasetName = dataset.name || `知识库版本 ${dataset.id || detail.id}`;
  return `<section class="cleaning-detail" data-cleaning-detail><header class="cleaning-detail-header"><a class="cleaning-back" href="${backHref(detail)}">返回资料清洗</a><div><h2>${escapeHtml(datasetName)}</h2><p>${escapeHtml(stateText(dataset.state || dataset.status))} · ${escapeHtml(dataset.id || detail.id)}</p></div></header><dl class="cleaning-detail-facts"><div><dt>来源批次</dt><dd>${batchHref ? `<a href="${batchHref}">${escapeHtml(batchId)}</a>` : '未提供'}</dd></div><div><dt>文档数</dt><dd>${escapeHtml(field(dataset.totalDocuments ?? dataset.total_documents))}</dd></div><div><dt>分块数</dt><dd>${escapeHtml(field(dataset.totalChunks ?? dataset.total_chunks))}</dd></div><div><dt>质量校验</dt><dd>${dataset.qualityPassed === undefined && dataset.quality_passed === undefined ? '未提供' : (dataset.qualityPassed ?? dataset.quality_passed) ? '通过' : '未通过'}</dd></div><div><dt>创建时间</dt><dd>${escapeHtml(updatedText(created))}</dd></div><div><dt>图谱</dt><dd>${(dataset.graphAvailable ?? dataset.graph_available) ? `${escapeHtml(field(graph.nodes ?? graph.nodeCount ?? graph.node_count))} 个节点 · ${escapeHtml(field(graph.edges ?? graph.edgeCount ?? graph.edge_count))} 条边` : '未提供'}</dd></div></dl>${metricEntries ? `<section class="cleaning-detail-section"><h3>质量指标</h3><dl class="cleaning-detail-facts">${metricEntries}</dl></section>` : ''}</section>`;
}
function renderCleaningDetail(detail) {
  if (!detail || detail.status === 'loading') return renderDetailLoading(detail || { type: 'batch' });
  if (detail.status === 'unavailable') return renderDetailError(detail);
  return detail.type === 'batch' ? renderBatchDetail(detail) : renderDatasetDetail(detail);
}
function uploadDialog(canWrite) {
  if (!canWrite) return '';
  return `<dialog class="asset-dialog cleaning-upload-dialog" data-cleaning-upload-dialog data-scroll-region="dialog"><form data-cleaning-upload-form><header class="asset-dialog-heading"><div><h2>上传资料</h2><p>上传后将创建资料批次，原始文件保留在资料加工服务。</p></div><button class="icon-button" type="button" data-cleaning-upload-close aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header><label>批次名称<input name="name" required maxlength="120" placeholder="例如：安装手册 23.4.5"></label><label>选择文件<input name="file" type="file" required></label><p class="cleaning-upload-status" data-cleaning-upload-status role="status">单次上传一个文件。</p><footer><button class="button tertiary" type="button" data-cleaning-upload-close>取消</button><button class="button secondary" type="submit">开始上传</button></footer></form></dialog>`;
}

export function renderCleaning({ cleaningProjection, cleaningDetailProjection = null, cleaningCanWrite = false }) {
  if (cleaningDetailProjection) return renderCleaningDetail(cleaningDetailProjection);
  if (!cleaningProjection || cleaningProjection.status === 'loading') return pendingState('正在读取资料加工数据', '正在从资料加工服务读取真实批次、任务和知识库版本。');
  if (cleaningProjection.status === 'unavailable') return `<section class="cleaning-unavailable" role="alert"><h2>资料加工服务暂时不可用</h2><p>${escapeHtml(cleaningProjection.error?.message || '请检查服务连接后重试。')}</p><button class="button secondary" type="button" data-cleaning-retry>重新读取</button></section>`;
  const workbench = cleaningProjection.workbench || {};
  const batches = listItems(cleaningProjection.batches);
  const datasets = listItems(cleaningProjection.datasets);
  const indexStats = cleaningProjection.indexStats;
  const counts = workbench.counts || workbench;
  const metrics = [['资料批次', cleaningProjection.batches?.total ?? batches.length], ['知识库版本', cleaningProjection.datasets?.total ?? datasets.length], ['处理中任务', counts.active ?? counts.running ?? counts.processing ?? '未提供'], ['失败任务', counts.failed ?? '未提供']];
  const batchPage = Math.max(1, Number(cleaningProjection.batches?.page) || 1);
  const batchPageSize = Math.max(1, Number(cleaningProjection.batches?.pageSize) || 20);
  const batchTotal = Math.max(0, Number(cleaningProjection.batches?.total) || batches.length);
  const batchPages = Math.max(1, Math.ceil(batchTotal / batchPageSize));
  const batchPagination = batchPages > 1 ? `<nav class="cleaning-pagination" aria-label="资料批次分页"><span>第 ${batchPage} / ${batchPages} 页，共 ${batchTotal} 批</span><button class="button tertiary" type="button" data-cleaning-page="${batchPage - 1}" data-cleaning-page-kind="batches" ${batchPage <= 1 ? 'disabled' : ''}>上一页</button><button class="button tertiary" type="button" data-cleaning-page="${batchPage + 1}" data-cleaning-page-kind="batches" ${batchPage >= batchPages ? 'disabled' : ''}>下一页</button>${renderPageJump(batchPage, batchPages, 'cleaning-batches')}</nav>` : '';
  const datasetPage = Math.max(1, Number(cleaningProjection.datasets?.page) || 1);
  const datasetPageSize = Math.max(1, Number(cleaningProjection.datasets?.pageSize) || 20);
  const datasetTotal = Math.max(0, Number(cleaningProjection.datasets?.total) || datasets.length);
  const datasetPages = Math.max(1, Math.ceil(datasetTotal / datasetPageSize));
  const datasetPagination = datasetPages > 1 ? `<nav class="cleaning-pagination" aria-label="知识库版本分页"><span>第 ${datasetPage} / ${datasetPages} 页，共 ${datasetTotal} 个版本</span><button class="button tertiary" type="button" data-cleaning-page="${datasetPage - 1}" data-cleaning-page-kind="datasets" ${datasetPage <= 1 ? 'disabled' : ''}>上一页</button><button class="button tertiary" type="button" data-cleaning-page="${datasetPage + 1}" data-cleaning-page-kind="datasets" ${datasetPage >= datasetPages ? 'disabled' : ''}>下一页</button>${renderPageJump(datasetPage, datasetPages, 'cleaning-datasets')}</nav>` : '';
  const indexBody = indexStats?.status === 'unavailable'
    ? pendingState('索引状态暂时不可用', indexStats.error?.message || '资料加工服务未返回索引统计。')
    : `<div class="metric-grid"><div class="metric"><span>索引条目</span><strong>${escapeHtml(indexStats?.total ?? indexStats?.count ?? indexStats?.entries ?? '未提供')}</strong></div><div class="metric"><span>图谱节点</span><strong>${escapeHtml(indexStats?.graphNodes ?? indexStats?.nodes ?? '未提供')}</strong></div><div class="metric"><span>图谱边</span><strong>${escapeHtml(indexStats?.graphEdges ?? indexStats?.edges ?? '未提供')}</strong></div></div><p class="muted">索引与图谱状态来自资料加工服务，不在统一入口重新计算。</p>`;
  const uploadAction = cleaningCanWrite ? '<div class="workspace-action-row cleaning-upload-action"><button class="button primary" type="button" data-cleaning-upload-open>上传资料</button></div>' : '';
  const table = (items, title, tableId, kind, currentBatchPage, currentDatasetPage) => {
    const body = items.map(item => {
      const id = item.id || item.batchId || item.datasetId;
      const name = item.name || item.batchId || item.datasetId || id || '未命名';
      const href = id ? detailLink(kind, id, currentBatchPage, currentDatasetPage) : '';
      return `<tr><td>${href ? `<a class="cleaning-detail-link" href="${escapeHtml(href)}">${escapeHtml(name)}</a>` : escapeHtml(name)}</td><td>${escapeHtml(statusLabel(item))}</td><td>${escapeHtml(updatedText(item.updatedAt || item.updated_at || item.createdAt || item.created_at))}</td></tr>`;
    }).join('');
    return body ? `<div class="table-wrap"><table data-table-view-id="${tableId}" data-table-view-schema="1" data-table-view-label="${title}"><caption class="sr-only">${title}</caption><thead><tr><th data-table-column="name" data-table-column-required="true" data-table-column-label="名称">名称</th><th data-table-column="status" data-table-column-label="状态">状态</th><th data-table-column="updated" data-table-column-label="更新时间">更新时间</th></tr></thead><tbody>${body}</tbody></table></div>` : pendingState(`暂无${title}`, '资料加工服务当前没有返回记录。');
  };
  return `${uploadAction}<section class="cleaning-workspace"><div class="metric-grid">${metrics.map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>${panel('资料批次', `${table(batches, '资料批次', 'cleaning-batches', 'batch', batchPage, datasetPage)}${batchPagination}`, dataNote(cleaningProjection))}${panel('知识库版本', `${table(datasets, '知识库版本', 'cleaning-datasets', 'dataset', batchPage, datasetPage)}${datasetPagination}`, dataNote(cleaningProjection))}${panel('索引与图谱', indexBody, dataNote(cleaningProjection))}<p class="muted">上传、扫描、清洗、索引和发布由资料加工服务执行，统一入口展示真实状态。</p></section>${uploadDialog(cleaningCanWrite)}`;
}
