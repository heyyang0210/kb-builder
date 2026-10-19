import { escapeHtml } from '../../common/utils/dom.js';
const esc = value => escapeHtml(value ?? '');
const states = { under_review: '待审核', approved: '待发布', rejected: '已退回', published: '已发布', mr_submitted: '已提交 MR', cancelled: '已终止' };
const time = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
const person = value => value?.displayName || value?.name || value?.id || '—';
export function reviewUrl(values = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== null && value !== '') params.set(key, value);
  return `/knowledge-center/review${params.size ? `?${params}` : ''}`;
}
export function reviewDocumentUrl(row, back = '', showAll = false) {
  return reviewUrl({ view: 'reader', handbookId: row.handbookId, taskId: row.taskId, documentId: row.documentId, path: row.path, branch: row.branch, back, ...(showAll ? { showAll: '1' } : {}) });
}
export function reviewReturnUrl(params) {
  const back = params.get('back');
  // Restrict return links to this module, even when URL parameters are edited.
  return back && /^\/knowledge-center\/review(?:\?|$)/.test(back) ? back : reviewUrl({ view: 'documents', handbookId: params.get('handbookId') });
}
export function reviewTabs(workbench, selected) {
  return `<nav class="review-hub-tabs" aria-label="审核视图"><a href="${reviewUrl({ view: 'handbooks' })}" ${selected === 'handbooks' ? 'aria-current="page"' : ''}>手册视图</a><a href="${reviewUrl({ view: 'mine' })}" ${selected === 'mine' ? 'aria-current="page"' : ''}>我的审核 <span>${workbench.mine.length}</span></a></nav>`;
}
export function reviewNavigation(workbench, task, params) {
  const next = workbench.mine.find(row => row.taskId !== task?.id);
  const back = reviewReturnUrl(params);
  return `<nav class="review-workbench-nav" aria-label="审核导航">${reviewTabs(workbench, '')}<div><a class="button secondary" href="${esc(back)}">${new URL(back, 'http://localhost').searchParams.get('view') === 'mine' ? '返回我的审核' : '返回审核文档清单'}</a>${next ? `<a class="button primary" href="${esc(reviewDocumentUrl(next, back))}">下一篇待我审核</a>` : '<span>没有其他待我审核文档</span>'}</div></nav>`;
}
export function renderReviewWorkbench(projection, params) {
  const data = projection.workbench;
  const view = projection.view;
  const handbooks = data.handbooks;
  const handbook = handbooks.find(row => row.handbookId === params.get('handbookId'));
  const mine = view === 'mine';
  const isHandbooks = view === 'handbooks';
  const source = isHandbooks ? handbooks : mine ? data.mine : data.documents.filter(row => row.handbookId === params.get('handbookId'));
  const q = (params.get('q') || '').toLowerCase();
  const status = params.get('status') || '';
  const version = params.get('version') || '';
  const reviewer = (params.get('person') || '').toLowerCase();
  const filtered = source.filter(row => {
    const handbookName = handbooks.find(item => item.handbookId === row.handbookId)?.name || row.handbookId;
    return (!q || `${row.name || row.title} ${row.path || ''} ${handbookName}`.toLowerCase().includes(q))
      && (!status || (isHandbooks ? row.status : row.state) === status)
      && (!version || `${row.businessVersion || ''} ${row.candidateDigest || ''}`.includes(version))
      && (!reviewer || `${person(row.submittedBy)} ${row.reviewerDisplay || ''} ${(row.reviewerIds || []).join(' ')}`.toLowerCase().includes(reviewer))
      && (!mine || !params.get('handbookId') || row.handbookId === params.get('handbookId'));
  });
  const size = 20;
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const page = Math.min(pages, Math.max(1, Number.parseInt(params.get('page'), 10) || 1));
  const rows = filtered.slice((page - 1) * size, page * size);
  const back = reviewUrl(Object.fromEntries(params));
  const options = mine ? `<label>手册<select name="handbookId"><option value="">全部手册</option>${handbooks.map(item => `<option value="${esc(item.handbookId)}" ${params.get('handbookId') === item.handbookId ? 'selected' : ''}>${esc(item.name || item.handbookId)}</option>`).join('')}</select></label>` : '';
  const stageOptions = [...new Map(handbooks.map(item => [item.status, item.statusDisplayName || item.status]).filter(([key]) => key)).entries()];
  const stageFilter = isHandbooks ? `<label>业务阶段<select name="status"><option value="">全部阶段</option>${stageOptions.map(([key, label]) => `<option value="${esc(key)}" ${status === key ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>` : '';
  const filters = `<form method="get" action="/knowledge-center/review" class="review-hub-filters"><input type="hidden" name="view" value="${esc(view)}">${!mine && handbook ? `<input type="hidden" name="handbookId" value="${esc(handbook.handbookId)}">` : ''}<label>关键词<input type="search" name="q" value="${esc(params.get('q'))}" placeholder="搜索手册、标题或路径"></label>${stageFilter}${options}${!isHandbooks && !mine ? `<label>审核状态<select name="status"><option value="">全部状态</option>${Object.entries(states).map(([key, label]) => `<option value="${key}" ${status === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>` : ''}${!isHandbooks ? `<label>版本<input name="version" value="${esc(version)}" placeholder="业务版本或候选摘要"></label><label>人员<input name="person" value="${esc(params.get('person'))}" placeholder="提交人或审核人标识"></label>` : ''}<button class="button primary" type="submit">筛选</button><a class="button secondary" href="${reviewUrl({ view, handbookId: !isHandbooks && !mine ? params.get('handbookId') : '' })}">清空</a></form>`;
  const heads = isHandbooks ? ['手册', '业务阶段', '待审核文档', '待发布文档', '最近更新', '操作'] : mine ? ['手册', '文档', '候选版本', '提交人', '指派人', '提交时间', '操作'] : ['文档 / 路径', '候选版本', '状态', '提交人', '审核人', '提交 / 处理时间', '意见', '操作'];
  const body = rows.map(row => {
    if (isHandbooks) {
      const docs = reviewUrl({ view: 'documents', handbookId: row.handbookId });
      return `<tr><td><strong>${esc(row.name || row.handbookId)}</strong><small>${esc(row.handbookId)}</small></td><td>${esc(row.statusDisplayName)}</td><td><a class="review-count-link" href="${docs}" aria-label="查看${esc(row.name || row.handbookId)}的全部审核文档，待审核 ${row.pendingCount} 篇">${row.pendingCount}</a><small>共 ${row.reviewCount} 条审核文档记录</small></td><td>${row.pendingPublishCount}</td><td>${esc(time(row.updatedAt))}</td><td><a class="button secondary" href="${reviewUrl({ view: 'reader', handbookId: row.handbookId, back: docs })}">打开手册</a></td></tr>`;
    }
    const name = handbooks.find(item => item.handbookId === row.handbookId)?.name || row.handbookId;
    const version = `${esc(row.businessVersion)}<small>${esc(row.candidateDigest.slice(0, 8))}</small>`;
    const action = `<td><a class="button secondary" href="${esc(reviewDocumentUrl(row, back))}">${mine ? '开始审核' : '查看文档'}</a>${!mine && row.canReassign ? ` <button class="button secondary" type="button" data-review-reassign data-task-id="${esc(row.taskId)}" data-review-id="${esc(row.reviewId)}" data-document-id="${esc(row.documentId)}" data-digest="${esc(row.candidateDigest)}" data-handbook-id="${esc(row.handbookId)}" data-title="${esc(row.title)}" data-reviewers="${esc(row.reviewerIds.join(','))}">修改审核人</button>` : ''}${!mine && row.canCancelReview ? ` <button class="button secondary" type="button" data-review-cancel data-task-id="${esc(row.taskId)}" data-review-id="${esc(row.reviewId)}" data-digest="${esc(row.candidateDigest)}" data-title="${esc(row.title)}">终止任务</button>` : ''}</td>`;
    if (mine) return `<tr><td>${esc(name)}</td><td><strong>${esc(row.title)}</strong><small>${esc(row.path || '整本手册')}</small></td><td>${version}</td><td>${esc(person(row.submittedBy))}</td><td>${esc(row.assignedBy ? person(row.assignedBy) : '暂无记录')}</td><td>${esc(time(row.submittedAt))}</td>${action}</tr>`;
    return `<tr><td><strong>${esc(row.title)}</strong><small>${esc(row.path || '整本手册')}</small></td><td>${version}</td><td>${esc(states[row.state] || row.state)}</td><td>${esc(person(row.submittedBy))}</td><td>${esc(row.reviewerDisplay || (row.reviewerIds.length ? '人员未匹配' : '未明确指派'))}</td><td>${esc(time(row.submittedAt))}<small>${esc(time(row.decidedAt))}</small></td><td>${row.opinionCount}</td>${action}</tr>`;
  }).join('');
  const title = isHandbooks ? '按手册掌握审核全局' : mine ? '我的审核' : `${handbook?.name || params.get('handbookId') || '手册'} · 审核文档清单`;
  const empty = filtered.length ? '' : `<section class="review-hub-empty" role="status"><h3>${source.length ? '没有符合筛选条件的文档' : mine ? '暂无待我审核的文档' : isHandbooks ? '暂无可见的审核手册' : '此手册暂无可见审核文档'}</h3><p>${mine ? '只有明确指派给你、仍待处理且具备审核资格的文档才会出现在这里。' : '可以刷新重试，或返回文档生产查看进度。'}</p><button class="button secondary" data-review-reload>刷新</button></section>`;
  const pageLink = target => { const query = new URLSearchParams(params); query.set('page', target); return reviewUrl(Object.fromEntries(query)); };
  return `<section class="review-hub">${reviewTabs(data, mine ? 'mine' : 'handbooks')}<header><h2>${esc(title)}</h2><p>${isHandbooks ? '展示内容构建中及之后的手册，以及已有待审核候选的手册。点击审核数量可查看全部审核文档。' : mine ? '处理明确指派给你的审核，阅读与发布操作各自独立。' : '包含全部可见审核状态与候选版本，点击文档进入手册阅读工作区。'}</p></header>${filters}<p class="review-result-count" role="status">共 ${filtered.length} ${isHandbooks ? '本手册' : '条文档记录'}</p>${rows.length ? `<div class="review-hub-table"><table><thead><tr>${heads.map(head => `<th scope="col">${head}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>` : empty}<nav class="review-hub-pagination" aria-label="分页">${page > 1 ? `<a class="button secondary" href="${esc(pageLink(page - 1))}">上一页</a>` : ''}<span>第 ${page} / ${pages} 页</span>${page < pages ? `<a class="button secondary" href="${esc(pageLink(page + 1))}">下一页</a>` : ''}</nav><dialog class="review-online-dialog" data-review-assignment-dialog><form data-review-assignment-form><h3>修改审核人</h3><p data-review-assignment-title></p><label>审核人<select name="reviewerIds" required disabled><option value="">正在读取审核人…</option></select></label><p data-review-assignment-hint hidden>当前为多人指派，保存后将替换为所选一人。</p><p role="alert" data-review-assignment-error hidden></p><footer><button class="button secondary" type="button" data-review-dialog-close>取消</button><button class="button primary" type="submit" disabled>保存</button></footer></form></dialog><dialog class="review-online-dialog" data-review-cancel-dialog><form data-review-cancel-form><h3>终止审核任务</h3><p data-review-cancel-title></p><label>终止原因<textarea name="reason" required rows="3"></textarea></label><p role="alert" data-review-cancel-error hidden></p><footer><button class="button secondary" type="button" data-review-dialog-close>取消</button><button class="button primary" type="submit">确认终止</button></footer></form></dialog></section>`;
}
